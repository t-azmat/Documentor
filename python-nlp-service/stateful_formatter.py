"""
Stateful Document Formatter  —  100-Page Pipeline
==================================================
Implements stages 2-6 of the AI Formatter Pipeline for long documents:

  Stage 2 — Global pre-scan: build citation map + refs.bib
  Stage 3 — Word-count chunking (~1000 words, heading boundaries)
  Stage 4 — Per-chunk LaTeX generation with carried state
  Stage 5 — Validate + auto-repair each snippet  (via LaTeXValidator)
  Stage 6 — Assembly: preamble + snippets + bibliography

Usage:
    formatter = StatefulDocumentFormatter(job_dir='/tmp/jobs/abc123')
    for event in formatter.format_large_document(blocks, style, title, authors):
        print(event)   # {'type':'progress', 'chunk':5, 'total':32, ...}
        # final event: {'type':'complete', 'latex':..., 'bib':...}

Resume support:
    Pass resume=True to skip already-completed chunks (reads state.json).
"""

import json
import logging
import os
import re
from typing import Dict, Generator, List, Optional, Set, Tuple

from latex_validator import LaTeXValidator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
CHUNK_TARGET_WORDS  = max(500, int(os.getenv('STATEFUL_CHUNK_TARGET_WORDS', '2000')))
CHUNK_OVERLAP_WORDS = 200   # kept for metadata; overlap NOT duplicated in output
CHECKPOINT_INTERVAL = max(1, int(os.getenv('STATEFUL_CHECKPOINT_INTERVAL', '5')))
WRITE_LEGACY_SNIPPETS = os.getenv('STATEFUL_WRITE_LEGACY_SNIPPETS', 'false').lower() == 'true'
SNIPPETS_STORE_FILE = 'snippets.jsonl'

# Heading style → LaTeX section command
_HEADING_CMD: Dict[str, str] = {
    'title':     None,          # handled by preamble
    'heading 1': 'section',
    'heading 2': 'subsection',
    'heading 3': 'subsubsection',
    'heading 4': 'paragraph',
    'heading 5': 'subparagraph',
}

# Heading text keywords → semantic section type
_HEADING_KEYWORDS: List[Tuple[str, str]] = [
    ('abstract',          'abstract'),
    ('introduction',      'introduction'),
    ('literature review', 'literature'),
    ('related work',      'literature'),
    ('prior work',        'literature'),
    ('methodology',       'methodology'),
    ('methods',           'methodology'),
    ('experimental setup','methodology'),
    ('results',           'results'),
    ('findings',          'results'),
    ('discussion',        'discussion'),
    ('analysis',          'discussion'),
    ('conclusion',        'conclusion'),
    ('concluding',        'conclusion'),
    ('future work',       'conclusion'),
    ('references',        'references'),
    ('bibliography',      'references'),
    ('works cited',       'references'),
    ('cited works',       'references'),
    ('acknowledgement',   'acknowledgements'),
    ('acknowledgment',    'acknowledgements'),
    ('appendix',          'appendix'),
]

# Style → cite command
_CITE_CMD: Dict[str, str] = {
    'APA':     r'\parencite',
    'MLA':     r'\parencite',
    'IEEE':    r'\cite',
    'Chicago': r'\parencite',
    'Harvard': r'\parencite',
}

# Style → bibliography command (bottom of assembled doc)
_BIBLIO_CMD: Dict[str, str] = {
    'APA':     r'\printbibliography[title={References}]',
    'MLA':     r'\printbibliography[title={Works Cited}]',
    'IEEE':    '',          # thebibliography env used directly
    'Chicago': r'\printbibliography[title={Bibliography}]',
    'Harvard': r'\printbibliography[title={Reference List}]',
}

# Style → LaTeX preamble (documentclass + packages)
_PREAMBLE: Dict[str, str] = {
    'APA': r"""\documentclass[12pt, a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{times}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\usepackage{indentfirst}
\usepackage[style=apa,backend=biber]{biblatex}
\usepackage{hyperref}
\doublespacing
\setlength{\parindent}{0.5in}""",

    'MLA': r"""\documentclass[12pt, a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{times}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\usepackage[style=mla,backend=biber]{biblatex}
\usepackage{hyperref}
\doublespacing""",

    'IEEE': r"""\documentclass[10pt, conference]{IEEEtran}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{cite}
\usepackage{amsmath}
\usepackage{graphicx}
\usepackage{hyperref}""",

    'Chicago': r"""\documentclass[12pt, a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{times}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\usepackage[style=chicago-authordate,backend=biber]{biblatex}
\usepackage{hyperref}
\doublespacing
\setlength{\parindent}{0.5in}""",

    'Harvard': r"""\documentclass[12pt, a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{times}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\usepackage[style=authoryear,backend=biber]{biblatex}
\usepackage{hyperref}
\doublespacing""",
}

# LaTeX special-char escaping (plain text only, not used on already-LaTeX content)
_ESCAPE_MAP = [
    ('\\', r'\textbackslash{}'),
    ('&',  r'\&'),
    ('%',  r'\%'),
    ('$',  r'\$'),
    ('#',  r'\#'),
    ('_',  r'\_'),
    ('{',  r'\{'),
    ('}',  r'\}'),
    ('~',  r'\textasciitilde{}'),
    ('^',  r'\textasciicircum{}'),
]


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _escape(text: str) -> str:
    """Escape a plain-text string for inclusion in LaTeX."""
    for char, repl in _ESCAPE_MAP:
        text = text.replace(char, repl)
    return text


def _is_heading(style: str) -> bool:
    return any(k in style.lower() for k in ('heading', 'title'))


def _heading_cmd(style: str) -> Optional[str]:
    for key, cmd in _HEADING_CMD.items():
        if key in style.lower():
            return cmd
    return 'section'


def _classify_section(text: str) -> str:
    """Return semantic section type from heading text."""
    lower = text.lower()
    for kw, stype in _HEADING_KEYWORDS:
        if kw in lower:
            return stype
    return 'unknown'


def _replace_cites_with_placeholders(
    text: str,
    bib_keys_map: Dict[str, str],
) -> Tuple[str, Dict[str, str]]:
    """
    Replace raw citation strings with __CITE_N__ placeholders.
    Returns (modified_text, {placeholder: latex_cmd}).
    """
    placeholders: Dict[str, str] = {}
    idx = 0
    # Sort by length descending so longer patterns match first
    for raw_cite, bib_key in sorted(bib_keys_map.items(), key=lambda x: -len(x[0])):
        if raw_cite in text:
            ph = f'__CITE_{idx}__'
            text = text.replace(raw_cite, ph)
            placeholders[ph] = bib_key
            idx += 1
    return text, placeholders


def _build_paragraph_latex(
    raw_text: str,
    bib_keys_map: Dict[str, str],
    cite_cmd: str,
) -> str:
    """
    Convert a plain paragraph to LaTeX:
      1. Replace citation strings with placeholders
      2. Escape remaining special chars
      3. Restore placeholders as \\cite{key}
    """
    text, placeholders = _replace_cites_with_placeholders(raw_text, bib_keys_map)
    text = _escape(text)
    for ph, key in placeholders.items():
        text = text.replace(ph, f'{cite_cmd}{{{key}}}')
    return text


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------

class StatefulDocumentFormatter:
    """
    Stateful formatter for documents of 100+ pages.
    Yields progress events; checkpoints state periodically for resumability.
    """

    CHUNK_TARGET_WORDS  = CHUNK_TARGET_WORDS
    CHUNK_OVERLAP_WORDS = CHUNK_OVERLAP_WORDS
    CHECKPOINT_INTERVAL = CHECKPOINT_INTERVAL
    WRITE_LEGACY_SNIPPETS = WRITE_LEGACY_SNIPPETS

    def __init__(self, job_dir: str):
        self.job_dir   = job_dir
        self.validator = LaTeXValidator()
        os.makedirs(job_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def format_large_document(
        self,
        blocks:  List[Dict],
        style:   str,
        title:   str,
        authors: List[str],
        resume:  bool = False,
    ) -> Generator[Dict, None, None]:
        """
        Generator.  Yields dicts:
          {'type':'start',    'total': N, 'job_id': str}
          {'type':'stage',    'stage': int, 'description': str}
          {'type':'progress', 'chunk': i, 'total': N, 'section': str,
                              'words': int, 'repairs': int}
          {'type':'complete', 'latex': str, 'bib': str,
                              'chunks_processed': N, 'total_repairs': int,
                              'bib_entry_count': int, 'word_count': int}
          {'type':'error',    'message': str}
        """
        try:
            cite_cmd = _CITE_CMD.get(style, r'\cite')

            # ---- Stage 2: global pre-scan --------------------------------
            yield {'type': 'stage', 'stage': 2,
                   'description': 'Building global citation map and bibliography…'}

            bib_keys_map, bib_content, bib_entry_count = \
                self._build_citation_state(blocks, style)

            # Save refs.bib
            bib_path = os.path.join(self.job_dir, 'refs.bib')
            with open(bib_path, 'w', encoding='utf-8') as f:
                f.write(bib_content)

            # ---- Stage 3: word-count chunking ----------------------------
            yield {'type': 'stage', 'stage': 3,
                   'description': 'Splitting document into processing chunks…'}

            chunks = self._make_word_chunks(blocks)
            total  = len(chunks)

            yield {'type': 'start', 'total': total,
                   'bib_entries': bib_entry_count}

            # ---- Load or initialise state --------------------------------
            state = self._load_or_init_state(
                style, title, authors, chunks, bib_keys_map,
                resume=resume
            )
            start_at = state['completed_chunks']
            snippets_by_chunk = self._load_snippets_store()

            bib_keys_set: Set[str] = set(bib_keys_map.values())
            total_repairs = state.get('total_repairs', 0)

            # ---- Stage 4+5: translation loop ----------------------------
            yield {'type': 'stage', 'stage': 4,
                   'description': f'Translating {total - start_at} remaining chunks to LaTeX…'}

            for i in range(start_at, total):
                chunk = chunks[i]

                # 4.1 + 4.2: generate snippet
                snippet = self._chunk_to_snippet(chunk, state, cite_cmd)

                # 5: validate + auto-repair
                snippet, report = self.validator.validate_and_repair(
                    snippet, bib_keys_set
                )
                repairs_this = len(report['repairs_applied'])
                total_repairs += repairs_this

                snippets_by_chunk[i] = snippet
                self._append_snippet_store(i, snippet)

                # Optional legacy snippet files for backward compatibility/debugging.
                if self.WRITE_LEGACY_SNIPPETS:
                    snippet_path = os.path.join(
                        self.job_dir, f'snippet_{i:04d}.tex'
                    )
                    with open(snippet_path, 'w', encoding='utf-8') as f:
                        f.write(snippet)

                # 4.3: update state
                state['completed_chunks'] = i + 1
                state['total_repairs']    = total_repairs

                should_checkpoint = (
                    state['completed_chunks'] % self.CHECKPOINT_INTERVAL == 0 or
                    state['completed_chunks'] == total
                )
                if should_checkpoint:
                    self._save_state(state)

                yield {
                    'type':    'progress',
                    'chunk':   i + 1,
                    'total':   total,
                    'section': chunk.get('section', ''),
                    'words':   chunk.get('word_count', 0),
                    'repairs': repairs_this,
                }

            # ---- Stage 6: assembly --------------------------------------
            yield {'type': 'stage', 'stage': 6,
                   'description': 'Assembling final document…'}

            self._save_state(state)

            latex = self._assemble(
                total,
                title,
                authors,
                style,
                bib_content,
                bib_entry_count,
                snippets_by_chunk,
            )

            # Save paper.tex
            tex_path = os.path.join(self.job_dir, 'paper.tex')
            with open(tex_path, 'w', encoding='utf-8') as f:
                f.write(latex)

            total_words = sum(c.get('word_count', 0) for c in chunks)

            yield {
                'type':             'complete',
                'latex':            latex,
                'bib':              bib_content,
                'chunks_processed': total,
                'total_repairs':    total_repairs,
                'bib_entry_count':  bib_entry_count,
                'word_count':       total_words,
            }

        except Exception as exc:
            logger.exception('[StatefulFormatter] Fatal error')
            yield {'type': 'error', 'message': str(exc)}

    # ------------------------------------------------------------------
    # Stage 2 helpers
    # ------------------------------------------------------------------

    def _build_citation_state(
        self,
        blocks: List[Dict],
        style:  str,
    ) -> Tuple[Dict[str, str], str, int]:
        """
        Scan all blocks once.
        Returns (bib_keys_map, bib_content, entry_count).

        bib_keys_map: {raw_citation_string → bibtex_key}
        bib_content:  full refs.bib text
        """
        all_text = ' '.join(b.get('text', '') for b in blocks)

        # Find the references section text
        refs_text = self._extract_references_text(blocks)

        # Parse references into structured records
        try:
            from citation_converter import CitationConverter
            conv = CitationConverter()
            detected_style = conv.detect_style(refs_text) if refs_text else style
            parsed_refs = conv.parse_reference_list(refs_text, detected_style) \
                          if refs_text else []
        except Exception as e:
            logger.warning('[StatefulFormatter] CitationConverter unavailable: %s', e)
            parsed_refs = []
            detected_style = style

        # Build bibtex key for each reference
        bib_lines: List[str]         = []
        bib_keys_map: Dict[str, str] = {}

        for i, ref in enumerate(parsed_refs, 1):
            key = self._make_bib_key(ref, i, style)
            bib_lines.append(self._ref_to_bibtex(ref, key))

            # Map citation strings → key
            if style == 'IEEE':
                # Direct numeric mapping [i] → key
                bib_keys_map[f'[{i}]'] = key
                bib_keys_map[f'[{i} ]'] = key
            else:
                first_author = (ref.get('authors') or [''])[0]
                last = self._last_name(first_author)
                year = ref.get('year', '')
                if last and year:
                    bib_keys_map[f'({last}, {year})'] = key
                    bib_keys_map[f'({last.capitalize()}, {year})'] = key
                    bib_keys_map[f'({last.title()}, {year})'] = key

        # Fallback: scan text for citation patterns not covered by refs
        bib_keys_map = self._augment_map_from_text(
            all_text, bib_keys_map, parsed_refs, style
        )

        bib_content   = '\n\n'.join(bib_lines) if bib_lines else \
                        '% No references parsed from document\n'
        entry_count   = len(bib_lines)
        return bib_keys_map, bib_content, entry_count

    def _extract_references_text(self, blocks: List[Dict]) -> str:
        """
        Return the text of blocks after the References heading (bottom of doc).
        Falls back to scanning all blocks for reference-looking lines.
        """
        in_refs  = False
        ref_lines: List[str] = []

        for b in blocks:
            style = b.get('style', 'Normal')
            text  = b.get('text', '').strip()
            if not text:
                continue

            if _is_heading(style):
                sec_type = _classify_section(text)
                in_refs  = (sec_type == 'references')
                continue

            if in_refs:
                ref_lines.append(text)

        return '\n'.join(ref_lines)

    def _make_bib_key(self, ref: Dict, idx: int, style: str) -> str:
        if style == 'IEEE':
            return f'ref{idx}'
        authors = ref.get('authors') or []
        first   = authors[0] if authors else ''
        last    = self._last_name(first) or f'unknown{idx}'
        year    = ref.get('year', str(idx))
        return re.sub(r'[^a-z0-9]', '', last.lower()) + year

    def _last_name(self, author_str: str) -> str:
        """Extract last name from 'Last, First' or 'First Last' form."""
        if not author_str:
            return ''
        if ',' in author_str:
            return author_str.split(',')[0].strip()
        parts = author_str.split()
        return parts[-1] if parts else ''

    def _ref_to_bibtex(self, ref: Dict, key: str) -> str:
        """Convert a parsed reference record into a BibTeX @article entry."""
        lines = [f'@article{{{key},']
        fields = [
            ('author',  ' and '.join(ref.get('authors') or [])),
            ('title',   ref.get('title', '')),
            ('journal', ref.get('journal') or ref.get('source', '')),
            ('year',    ref.get('year', '')),
            ('volume',  ref.get('volume', '')),
            ('number',  ref.get('number') or ref.get('issue', '')),
            ('pages',   ref.get('pages', '')),
            ('doi',     ref.get('doi', '')),
            ('url',     ref.get('url', '')),
        ]
        for fname, fval in fields:
            if fval:
                safe = str(fval).replace('{', r'\{').replace('}', r'\}')
                lines.append(f'  {fname} = {{{safe}}},')
        lines.append('}')
        return '\n'.join(lines)

    def _augment_map_from_text(
        self,
        text: str,
        existing: Dict[str, str],
        parsed_refs: List[Dict],
        style: str,
    ) -> Dict[str, str]:
        """
        Scan raw text for citation patterns not yet covered in the map
        and create placeholder BibTeX keys for them.
        """
        if style == 'IEEE':
            for m in re.finditer(r'\[(\d+(?:[,\s]*\d+)*)\]', text):
                nums = re.findall(r'\d+', m.group(1))
                for n in nums:
                    raw = f'[{n}]'
                    if raw not in existing:
                        existing[raw] = f'ref{n}'
        else:
            # APA/Harvard: (Author, Year)
            for m in re.finditer(
                r'\(([A-Z][a-z\'-]+(?:\s+(?:&|and)\s+[A-Z][a-z\'-]+)?)'
                r'(?:,?\s+)(\d{4}[a-z]?)\)',
                text
            ):
                raw = m.group(0)
                if raw not in existing:
                    last = m.group(1).split()[0].lower()
                    year = m.group(2)
                    existing[raw] = re.sub(r'[^a-z0-9]', '', last) + year

        return existing

    # ------------------------------------------------------------------
    # Stage 3 helpers
    # ------------------------------------------------------------------

    def _make_word_chunks(self, blocks: List[Dict]) -> List[Dict]:
        """
        Split blocks into ~CHUNK_TARGET_WORDS-word chunks.
        Heading blocks always start a new chunk and update section context.
        """
        chunks: List[Dict]        = []
        current_section           = ''
        current_section_type      = 'unknown'
        buf_blocks: List[Dict]    = []
        buf_words                 = 0

        def flush():
            nonlocal buf_blocks, buf_words
            if not buf_blocks:
                return
            text = '\n'.join(b.get('text', '') for b in buf_blocks)
            chunks.append({
                'id':           f'c{len(chunks)}',
                'section':      current_section,
                'section_type': current_section_type,
                'text':         text,
                'word_count':   buf_words,
                '_blocks':      list(buf_blocks),
            })
            buf_blocks = []
            buf_words  = 0

        for block in blocks:
            bstyle = block.get('style', 'Normal')
            text   = block.get('text', '').strip()
            if not text:
                continue

            words = len(text.split())

            if _is_heading(bstyle):
                flush()
                current_section      = text
                current_section_type = _classify_section(text)
                buf_blocks  = [block]
                buf_words   = words
            else:
                if buf_words + words > self.CHUNK_TARGET_WORDS and buf_blocks:
                    flush()
                    buf_blocks = [block]
                    buf_words  = words
                else:
                    buf_blocks.append(block)
                    buf_words += words

        flush()
        return chunks

    # ------------------------------------------------------------------
    # Stage 4 helpers
    # ------------------------------------------------------------------

    def _chunk_to_snippet(
        self,
        chunk:    Dict,
        state:    Dict,
        cite_cmd: str,
    ) -> str:
        """Convert one chunk to a LaTeX snippet string."""
        bib_keys_map  = state.get('bib_keys_map', {})
        sec_type      = chunk.get('section_type', 'unknown')
        emitted: List = state.setdefault('emitted_sections', [])
        lines: List[str] = []

        for i, block in enumerate(chunk.get('_blocks', [])):
            bstyle = block.get('style', 'Normal')
            text   = block.get('text', '').strip()
            if not text:
                continue

            if _is_heading(bstyle):
                cmd = _heading_cmd(bstyle)
                if cmd is None:
                    # Title block — skip (handled by preamble)
                    continue

                sec_key = f'{sec_type}:{text}'
                if sec_key not in emitted:
                    emitted.append(sec_key)

                    if sec_type == 'abstract':
                        lines.append(r'\begin{abstract}')
                        state['_open_abstract'] = True
                    elif sec_type == 'appendix' and \
                            'appendix' not in state.get('emitted_specials', []):
                        lines.append(r'\appendix')
                        state.setdefault('emitted_specials', []).append('appendix')
                        lines.append(f'\\{cmd}{{{_escape(text)}}}')
                    elif sec_type == 'acknowledgements':
                        lines.append(f'\\section*{{{_escape(text)}}}')
                    else:
                        lines.append(f'\\{cmd}{{{_escape(text)}}}')
            else:
                # Close abstract if open
                if state.pop('_open_abstract', False):
                    lines.append(r'\end{abstract}')

                # Caption / figure detection
                if re.match(r'(?i)^(figure|fig\.?)\s*\d+', text):
                    state['figure_counter'] = state.get('figure_counter', 0) + 1
                    n = state['figure_counter']
                    lines.append(r'\begin{figure}[htbp]')
                    lines.append(r'\centering')
                    lines.append(f'\\caption{{{_escape(text)}}}')
                    lines.append(f'\\label{{fig:{n}}}')
                    lines.append(r'\end{figure}')
                    lines.append('')

                elif re.match(r'(?i)^table\s*\d+', text):
                    state['table_counter'] = state.get('table_counter', 0) + 1
                    n = state['table_counter']
                    lines.append(r'\begin{table}[htbp]')
                    lines.append(r'\centering')
                    lines.append(f'\\caption{{{_escape(text)}}}')
                    lines.append(f'\\label{{tab:{n}}}')
                    lines.append(r'\end{table}')
                    lines.append('')

                else:
                    # Regular paragraph
                    para = _build_paragraph_latex(text, bib_keys_map, cite_cmd)
                    # Split into paragraphs if there are embedded newlines
                    for sub in re.split(r'\n{2,}', para):
                        sub = sub.strip()
                        if sub:
                            lines.append(sub)
                            lines.append('')

        # Close unclosed abstract at end of chunk
        if state.pop('_open_abstract', False):
            lines.append(r'\end{abstract}')

        return '\n'.join(lines)

    # ------------------------------------------------------------------
    # Stage 6 helpers
    # ------------------------------------------------------------------

    def _assemble(
        self,
        total_chunks: int,
        title:        str,
        authors:      List[str],
        style:        str,
        bib_content:  str,
        bib_entry_count: int,
        snippets_by_chunk: Dict[int, str],
    ) -> str:
        """Assemble the full .tex document from snippet store (with legacy fallback)."""
        preamble   = _PREAMBLE.get(style, _PREAMBLE['APA'])
        author_str = ' \\and '.join(_escape(a) for a in authors) \
                     if authors else 'Author'
        biblio_cmd = _BIBLIO_CMD.get(style, r'\printbibliography')

        parts: List[str] = [
            preamble,
            '',
            r'\title{' + _escape(title) + '}',
            r'\author{' + author_str + '}',
            r'\date{\today}',
            '',
            r'\begin{document}',
            r'\maketitle',
            '',
        ]

        for i in range(total_chunks):
            snippet = snippets_by_chunk.get(i)
            if snippet is None:
                # Legacy fallback for older checkpoints that wrote snippet files.
                path = os.path.join(self.job_dir, f'snippet_{i:04d}.tex')
                if os.path.exists(path):
                    with open(path, 'r', encoding='utf-8') as f:
                        snippet = f.read()

            if snippet:
                parts.append(snippet)
                parts.append('')

        # Bibliography
        parts.append('')
        if style == 'IEEE' and bib_entry_count > 0:
            parts.append(r'\begin{thebibliography}{99}')
            for line in bib_content.splitlines():
                # Convert @article{refN, ...} to \bibitem{refN} author, ...
                m = re.match(r'@\w+\{(\w+),', line)
                if m:
                    parts.append(f'\\bibitem{{{m.group(1)}}}')
                elif line.strip().startswith('author') or \
                     line.strip().startswith('title'):
                    # Strip BibTeX field syntax → plain text
                    clean = re.sub(r'^\s*\w+\s*=\s*\{(.*)\},?\s*$', r'\1', line)
                    if clean != line:
                        parts.append(clean)
            parts.append(r'\end{thebibliography}')
        elif biblio_cmd:
            parts.append(biblio_cmd)
        else:
            parts.append('% No bibliography command for this style')

        parts.append('')
        parts.append(r'\end{document}')
        return '\n'.join(parts)

    # ------------------------------------------------------------------
    # State persistence
    # ------------------------------------------------------------------

    def _load_or_init_state(
        self,
        style:        str,
        title:        str,
        authors:      List[str],
        chunks:       List[Dict],
        bib_keys_map: Dict[str, str],
        resume:       bool,
    ) -> Dict:
        state_path = os.path.join(self.job_dir, 'state.json')

        if resume and os.path.exists(state_path):
            try:
                with open(state_path, 'r', encoding='utf-8') as f:
                    state = json.load(f)
                logger.info(
                    '[StatefulFormatter] Resumed state: %d/%d chunks done',
                    state.get('completed_chunks', 0),
                    len(chunks),
                )
                return state
            except Exception as e:
                logger.warning('[StatefulFormatter] Could not read state: %s', e)

        self._reset_snippet_artifacts()

        state = {
            'style':             style,
            'title':             title,
            'authors':           authors,
            'total_chunks':      len(chunks),
            'completed_chunks':  0,
            'section_path':      [],
            'figure_counter':    0,
            'table_counter':     0,
            'total_repairs':     0,
            'emitted_sections':  [],
            'emitted_specials':  [],
            'bib_keys_map':      bib_keys_map,
        }
        self._save_state(state)
        return state

    def _save_state(self, state: Dict) -> None:
        path = os.path.join(self.job_dir, 'state.json')
        # _blocks are not JSON-serializable → strip before saving
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(state, f, indent=2, default=str)
        except Exception as e:
            logger.warning('[StatefulFormatter] State save failed: %s', e)

    def _snippets_store_path(self) -> str:
        return os.path.join(self.job_dir, SNIPPETS_STORE_FILE)

    def _reset_snippet_artifacts(self) -> None:
        store_path = self._snippets_store_path()
        if os.path.exists(store_path):
            try:
                os.remove(store_path)
            except Exception as e:
                logger.warning('[StatefulFormatter] Could not remove snippet store: %s', e)

        for name in os.listdir(self.job_dir):
            if not name.startswith('snippet_') or not name.endswith('.tex'):
                continue
            try:
                os.remove(os.path.join(self.job_dir, name))
            except Exception as e:
                logger.warning('[StatefulFormatter] Could not remove legacy snippet file %s: %s', name, e)

    def _load_snippets_store(self) -> Dict[int, str]:
        snippets: Dict[int, str] = {}
        store_path = self._snippets_store_path()

        if not os.path.exists(store_path):
            return snippets

        try:
            with open(store_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    record = json.loads(line)
                    chunk_idx = int(record.get('chunk', -1))
                    snippet = record.get('snippet', '')
                    if chunk_idx >= 0 and snippet:
                        snippets[chunk_idx] = snippet
        except Exception as e:
            logger.warning('[StatefulFormatter] Could not load snippet store: %s', e)

        return snippets

    def _append_snippet_store(self, chunk_idx: int, snippet: str) -> None:
        store_path = self._snippets_store_path()
        record = {
            'chunk': chunk_idx,
            'snippet': snippet,
        }

        try:
            with open(store_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps(record, ensure_ascii=False))
                f.write('\n')
        except Exception as e:
            logger.warning('[StatefulFormatter] Could not append snippet store: %s', e)
