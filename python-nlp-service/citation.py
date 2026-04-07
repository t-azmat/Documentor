"""
Citation Manager Module
Handles citation formatting for various academic styles (APA, MLA, Chicago, Harvard)
"""

import re
import logging
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from file_extractor import FileExtractor

logger = logging.getLogger(__name__)


class CitationManager:
    """Manages citation detection and formatting for academic documents"""
    
    CITATION_STYLES = {
        'APA': 'American Psychological Association (7th ed.)',
        'MLA': 'Modern Language Association (9th ed.)',
        'Chicago': 'Chicago Manual of Style (17th ed.)',
        'Harvard': 'Harvard Referencing Style',
        'IEEE': 'Institute of Electrical and Electronics Engineers'
    }
    
    def __init__(self):
        """Initialize the Citation Manager"""
        self.detected_citations = []
        self.references = []
        self.citation_to_reference_map = {}
        self.file_extractor = FileExtractor()
        
    def detect_citation_style(self, text: str) -> str:
        """
        Detect the citation style used in the document
        
        Args:
            text: Document text
            
        Returns:
            Detected citation style (APA, MLA, Chicago, Harvard, or Unknown)
        """
        # APA patterns: (Author, Year) or Author (Year)
        apa_pattern = r'\([A-Z][a-z]+(?:\s+&\s+[A-Z][a-z]+)?,?\s+\d{4}[a-z]?\)'
        apa_matches = len(re.findall(apa_pattern, text))

        # MLA patterns: (Author Page) or (Author)
        mla_pattern = r'\([A-Z][a-z]+(?:\s+\d+)?\)'
        mla_matches = len(re.findall(mla_pattern, text))

        # Chicago pattern: Footnote/endnote superscript numbers
        chicago_pattern = r'\^\d+'
        chicago_matches = len(re.findall(chicago_pattern, text))

        # Harvard pattern: Similar to APA but no comma before year
        harvard_pattern = r'\([A-Z][a-z]+(?:,\s+[A-Z]\.[A-Z]\.?)?\s+\d{4}\)'
        harvard_matches = len(re.findall(harvard_pattern, text))

        # IEEE pattern: [1], [2], [3], [1, 2], [1]-[3]
        ieee_pattern = r'\[\d+(?:[,\s]+\d+)*\]'
        ieee_matches = len(re.findall(ieee_pattern, text))

        # Determine most likely style
        # IEEE: brackets with only numbers — needs to outscore Chicago (which also uses brackets)
        # so if bracket-numeric matches dominate and there are no year-author pairs → IEEE
        scores = {
            'APA': apa_matches,
            'MLA': mla_matches,
            'Chicago': chicago_matches,
            'Harvard': harvard_matches,
            'IEEE': ieee_matches,
        }

        # Disambiguate IEEE vs Chicago: Chicago uses footnote superscripts (^n)
        # while IEEE uses [n] inline. If apa/harvard also have matches, prefer those.
        if ieee_matches > 0 and chicago_matches == 0 and apa_matches == 0 and harvard_matches == 0:
            scores['IEEE'] = ieee_matches * 1.5  # boost IEEE when other author-date styles absent

        max_score = max(scores.values())
        if max_score == 0:
            return 'Unknown'

        return max(scores, key=scores.get)
    
    def extract_citations_from_text(self, text: str) -> List[Dict]:
        """
        Extract all citations from the text with line numbers
        
        Args:
            text: Document text
            
        Returns:
            List of dictionaries containing citation information
        """
        citations = []
        lines = text.split('\n')
        
        # Extract different citation patterns
        patterns = [
            (r'\(([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)?),?\s+(\d{4}[a-z]?)\)', 'APA/Harvard'),  # APA/Harvard
            (r'\(([A-Z][a-z]+)(?:\s+(\d+))?\)', 'MLA'),                                              # MLA
            (r'\[(\d+(?:[,\s]+\d+)*)\]', 'IEEE'),                                                    # IEEE [1], [1, 2]
            (r'\^(\d+)', 'Chicago'),                                                                   # Chicago superscript
        ]
        
        current_position = 0
        for line_num, line in enumerate(lines, 1):
            for pattern, style_type in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    citation_text = match.group(0)
                    author = match.group(1) if len(match.groups()) > 0 else ''
                    year_or_page = match.group(2) if len(match.groups()) > 1 else ''
                    
                    citations.append({
                        'text': citation_text,
                        'line': line_num,
                        'position': current_position + match.start(),
                        'column': match.start(),
                        'author': author,
                        'year_or_page': year_or_page,
                        'style_type': style_type,
                        'context': line.strip()
                    })
            current_position += len(line) + 1  # +1 for newline
        
        self.detected_citations = citations
        return citations
    
    def format_citation_apa(self, author: str, year: str, title: str = "", 
                           source: str = "", url: str = "", 
                           doi: str = "", access_date: str = "") -> str:
        """Format a citation in APA style"""
        citation = f"{author} ({year})."
        
        if title:
            citation += f" {title}."
        
        if source:
            citation += f" {source}."
        
        if doi:
            citation += f" https://doi.org/{doi}"
        elif url:
            citation += f" Retrieved from {url}"
            if access_date:
                citation += f" (accessed {access_date})"
        
        return citation
    
    def format_citation_mla(self, author: str, title: str, source: str = "",
                           publisher: str = "", year: str = "", 
                           url: str = "", access_date: str = "") -> str:
        """Format a citation in MLA style"""
        citation = f"{author}. \"{title}.\""
        
        if source:
            citation += f" {source}"
        
        if publisher:
            citation += f", {publisher}"
        
        if year:
            citation += f", {year}"
        
        citation += "."
        
        if url:
            citation += f" {url}."
            if access_date:
                citation += f" Accessed {access_date}."
        
        return citation
    
    def format_citation_chicago(self, author: str, title: str, 
                               publication_info: str = "", year: str = "",
                               pages: str = "") -> str:
        """Format a citation in Chicago style"""
        citation = f"{author}. {title}."
        
        if publication_info:
            citation += f" {publication_info}"
        
        if year:
            citation += f", {year}"
        
        if pages:
            citation += f", {pages}"
        
        citation += "."
        
        return citation
    
    def format_citation_harvard(self, author: str, year: str, title: str,
                               source: str = "", volume: str = "",
                               pages: str = "") -> str:
        """Format a citation in Harvard style"""
        citation = f"{author} ({year}). {title}."

        if source:
            citation += f" {source}"

        if volume:
            citation += f", {volume}"

        if pages:
            citation += f", pp. {pages}"

        citation += "."

        return citation

    def format_citation_ieee(self, author: str, title: str, source: str = "",
                             year: str = "", volume: str = "", issue: str = "",
                             pages: str = "", doi: str = "",
                             url: str = "") -> str:
        """
        Format a reference entry in IEEE style.
        Example:
          J. Smith and A. Jones, "A paper title," IEEE Trans. Neural Netw.,
          vol. 12, no. 3, pp. 45-56, 2020. doi: 10.1234/xyz
        """
        citation = f"{author}, \"{title}.\""

        if source:
            citation += f" {source},"

        if volume:
            citation += f" vol. {volume},"

        if issue:
            citation += f" no. {issue},"

        if pages:
            citation += f" pp. {pages},"

        if year:
            citation += f" {year}."
        else:
            citation = citation.rstrip(',') + "."

        if doi:
            citation += f" doi: {doi}"
        elif url:
            citation += f" [Online]. Available: {url}"

        return citation
    
    def format_reference_list(self, citations: List[Dict], style: str) -> str:
        """
        Format a reference list according to the specified citation style
        
        Args:
            citations: List of citation dictionaries
            style: Citation style (APA, MLA, Chicago, Harvard)
            
        Returns:
            Formatted reference list as string
        """
        if style == 'APA':
            header = "References\n\n"
        elif style == 'MLA':
            header = "Works Cited\n\n"
        elif style == 'Chicago':
            header = "Bibliography\n\n"
        elif style == 'Harvard':
            header = "Reference List\n\n"
        elif style == 'IEEE':
            header = "References\n\n"
        else:
            header = "References\n\n"
        
        formatted_refs = []
        for i, citation in enumerate(sorted(citations, key=lambda x: x.get('author', '')), 1):
            if style == 'APA':
                formatted_refs.append(self.format_citation_apa(**citation))
            elif style == 'MLA':
                formatted_refs.append(self.format_citation_mla(**citation))
            elif style == 'Chicago':
                formatted_refs.append(self.format_citation_chicago(**citation))
            elif style == 'Harvard':
                formatted_refs.append(self.format_citation_harvard(**citation))
            elif style == 'IEEE':
                # IEEE numbers entries sequentially
                entry = self.format_citation_ieee(**{k: v for k, v in citation.items()
                                                     if k in ('author','title','source','year',
                                                               'volume','issue','pages','doi','url')})
                formatted_refs.append(f"[{i}] {entry}")
        
        return header + '\n'.join(formatted_refs)
    
    def validate_citations(self, text: str, style: str) -> List[Dict]:
        """
        Validate citations in the document against the specified style
        
        Args:
            text: Document text
            style: Expected citation style
            
        Returns:
            List of validation issues
        """
        issues = []
        citations = self.extract_citations_from_text(text)
        
        for citation in citations:
            # Check if citation matches the expected style
            citation_text = citation['text']
            
            if style == 'APA':
                if not re.match(r'\([A-Z][a-z]+.*?,?\s+\d{4}[a-z]?\)', citation_text):
                    issues.append({
                        'citation': citation_text,
                        'position': citation['position'],
                        'issue': 'Does not match APA format',
                        'suggestion': 'Use (Author, Year) format'
                    })
            
            elif style == 'MLA':
                if not re.match(r'\([A-Z][a-z]+(?:\s+\d+)?\)', citation_text):
                    issues.append({
                        'citation': citation_text,
                        'position': citation['position'],
                        'issue': 'Does not match MLA format',
                        'suggestion': 'Use (Author Page) or (Author) format'
                    })

            elif style == 'IEEE':
                if not re.match(r'\[\d+(?:[,\s]+\d+)*\]', citation_text):
                    issues.append({
                        'citation': citation_text,
                        'position': citation['position'],
                        'issue': 'Does not match IEEE format',
                        'suggestion': 'Use [n] numeric reference format, e.g. [1] or [1, 2]'
                    })

        return issues
    
    def extract_text_from_file(self, file_content: bytes, filename: str) -> str:
        """
        Extract text from uploaded file using centralized extractor
        Supports: PDF, DOCX, TXT, LaTeX
        
        Args:
            file_content: File bytes
            filename: Name of the file
            
        Returns:
            Extracted text (or error message string)
        """
        result = self.file_extractor.extract_text(file_content, filename)
        
        if not result['success']:
            return result['error']
        
        return result['text']
    
    def apply_citation_formatting(self, text: str, style: str) -> str:
        """
        Apply citation formatting to the entire document
        
        Args:
            text: Document text
            style: Citation style to apply
            
        Returns:
            Formatted text
        """
        # This is a placeholder for more sophisticated formatting
        # In a real implementation, this would parse and reformat all citations
        
        formatted_text = text
        
        # Add formatting instructions at the top
        header = f"=== Document Formatted in {style} Style ===\n\n"
        
        return header + formatted_text
    
    def generate_bibliography_entry(self, citation_data: Dict, style: str) -> str:
        """
        Generate a bibliography entry from citation data
        
        Args:
            citation_data: Dictionary with citation information
            style: Citation style (APA, MLA, Chicago, Harvard)
            
        Returns:
            Formatted bibliography entry
        """
        if style == 'APA':
            return self.format_citation_apa(**citation_data)
        elif style == 'MLA':
            return self.format_citation_mla(**citation_data)
        elif style == 'Chicago':
            return self.format_citation_chicago(**citation_data)
        elif style == 'Harvard':
            return self.format_citation_harvard(**citation_data)
        elif style == 'IEEE':
            return self.format_citation_ieee(**{k: v for k, v in citation_data.items()
                                                if k in ('author','title','source','year',
                                                         'volume','issue','pages','doi','url')})
        else:
            return "Unknown citation style"


def parse_citation_string(citation_str: str) -> Dict:
    """
    Parse a citation string to extract author, year, etc.
    
    Args:
        citation_str: Citation string like "(Smith, 2020)"
        
    Returns:
        Dictionary with parsed components
    """
    result = {}
    
    # Try to extract author and year (APA/Harvard style)
    match = re.match(r'\(([A-Za-z\s&,]+),?\s+(\d{4}[a-z]?)\)', citation_str)
    if match:
        result['author'] = match.group(1).strip()
        result['year'] = match.group(2)
    else:
        # Try MLA style
        match = re.match(r'\(([A-Za-z\s]+)(?:\s+(\d+))?\)', citation_str)
        if match:
            result['author'] = match.group(1).strip()
            if match.group(2):
                result['page'] = match.group(2)
    
    return result


def extract_references_section(text: str) -> Tuple[List[Dict], int]:
    """
    Extract the references/bibliography section from the document.

    Handles:
    • Standard single-column documents with one reference per line.
    • Two-column IEEE PDFs where pdfplumber collapses all references onto a
      single long "line" (paragraph block).
    • IEEE section-numbered headers like "VIII. REFERENCES" or "IX. REFERENCES".
    • Case-insensitive header detection.
    • Full-document fallback: if no header is found but sequential [1]…[n]
      entries are present, extract them anyway.
    """
    lines = text.split('\n')
    references  = []
    ref_start_line = -1
    in_ref_section = False

    # ── Header patterns (case-insensitive; optional Roman-numeral prefix) ──
    # Matches standalone headers like: REFERENCES, IX. REFERENCES,
    # VIII. Bibliography, Works Cited, etc.
    _REF_HEADER = re.compile(
        r'^\s*(?:[IVXLC]+\.\s+)?'
        r'(references?|bibliography|works\s+cited|reference\s+list|sources)'
        r'\s*$',
        re.IGNORECASE,
    )

    # Also detect header embedded at the start of a long block line, e.g.:
    # "REFERENCES [1] Smith, J. …  [2] Jones, K. …"
    _INLINE_HEADER = re.compile(
        r'(?:^|\b)'
        r'(?:[IVXLC]+\.\s+)?'
        r'(?:references?|bibliography|works\s+cited|reference\s+list|sources)'
        r'\s*(?:\[1\]|$)',
        re.IGNORECASE,
    )

    def _parse_ieee_block(block: str, start_line: int) -> List[Dict]:
        """Split a block containing concatenated [n] entries into individual refs."""
        entries = []
        # Split on every [n] boundary (keep the delimiter)
        parts = re.split(r'(?=\[\d+\])', block)
        for part in parts:
            part = part.strip()
            if not part:
                continue
            m = re.match(r'^\[(\d+)\]\s*(.*)', part, re.DOTALL)
            if m:
                ref_num  = int(m.group(1))
                ref_body = re.sub(r'\s+', ' ', m.group(2)).strip()
                if ref_body:
                    entries.append({
                        'text':       ref_body,
                        'line':       start_line,
                        'ref_number': ref_num,
                        'author':     extract_author_from_reference(ref_body),
                    })
        return entries

    # ── Pass 1: line-by-line scan ───────────────────────────────────────────
    for line_num, line in enumerate(lines, 1):
        stripped     = line.strip()
        stripped_low = stripped.lower()

        if not in_ref_section:
            # Check for standalone header line
            if _REF_HEADER.match(stripped):
                in_ref_section = True
                ref_start_line = line_num
                continue

            # Check for header embedded at the start of a long block
            # (common in two-column PDFs — entire reference list = one line)
            if _INLINE_HEADER.search(stripped) and '[1]' in stripped:
                in_ref_section = True
                ref_start_line = line_num
                # Strip the header text, then parse the rest as a block
                after_header = re.sub(
                    r'^.*?(?:references?|bibliography|works\s+cited|reference\s+list|sources)\s*',
                    '',
                    stripped,
                    count=1,
                    flags=re.IGNORECASE,
                ).strip()
                if after_header:
                    references.extend(_parse_ieee_block(after_header, line_num))
                continue

        else:  # in_ref_section
            if not stripped:
                continue

            # ── Block line containing multiple [n] entries (collapsed PDF) ──
            if stripped.count('[') >= 2 and re.search(r'\[\d+\]', stripped):
                references.extend(_parse_ieee_block(stripped, line_num))
                continue

            # ── Single IEEE reference: starts with [n] ───────────────────
            m = re.match(r'^\[(\d+)\]\s*(.*)', stripped)
            if m:
                ref_num  = int(m.group(1))
                ref_body = m.group(2).strip()
                references.append({
                    'text':       ref_body,
                    'line':       line_num,
                    'ref_number': ref_num,
                    'author':     extract_author_from_reference(ref_body),
                })
                continue

            # ── Continuation line (indented) ──────────────────────────────
            if references and (line.startswith('   ') or line.startswith('\t')):
                references[-1]['text'] += ' ' + stripped
                continue

            # ── Author-date style reference ───────────────────────────────
            if re.match(r'^[A-Z][a-z]+', stripped):
                references.append({
                    'text':   stripped,
                    'line':   line_num,
                    'author': extract_author_from_reference(stripped),
                })

    # ── Pass 2: full-text fallback ──────────────────────────────────────────
    # If no header was found but the full text contains sequential [1]…[n]
    # entries (e.g., single-page PDF with no explicit "References" heading),
    # extract them from the raw text directly.
    if not references:
        logger.debug("No reference section header found — running full-text [n] fallback")
        # Find the position of "[1]" closest to the end of the document
        # (to avoid matching inline [1] citations in body text).
        full_text_no_ws = text
        # Collect all positions of [1] and pick the last one (most likely refs)
        positions = [m.start() for m in re.finditer(r'\[1\]', full_text_no_ws)]
        if positions:
            # Use last occurrence of [1] as the start of references
            ref_start_pos = positions[-1]
            ref_block = full_text_no_ws[ref_start_pos:]
            parsed = _parse_ieee_block(ref_block, -1)
            # Only accept if we got a sequential-looking list (1, 2, 3 …)
            nums = [r['ref_number'] for r in parsed]
            if nums == list(range(1, len(nums) + 1)):
                references   = parsed
                ref_start_line = text[:ref_start_pos].count('\n') + 1
                logger.info("Fallback extracted %d references starting at pos %d",
                            len(references), ref_start_pos)

    return references, ref_start_line


def extract_author_from_reference(ref_text: str) -> str:
    """
    Extract author name from a reference entry
    
    Args:
        ref_text: Reference text
        
    Returns:
        Author name
    """
    # Try to extract first author from reference
    # Pattern: Last name, First Initial(s).
    match = re.match(r'^([A-Z][a-z]+(?:,\s+[A-Z]\.?)?)', ref_text)
    if match:
        return match.group(1).strip()
    
    # Pattern: Last name (for simpler formats)
    match = re.match(r'^([A-Z][a-z]+)', ref_text)
    if match:
        return match.group(1).strip()
    
    return ""


def match_citations_to_references(citations: List[Dict], references: List[Dict]) -> Dict:
    """
    Match in-text citations to reference list entries.

    Strategy (two-pass):
      1. Regex/string pass  — exact last-name + year matching (fast, zero memory)
      2. AI semantic pass   — for any citation still unmatched, use cosine similarity
                              of the citation's context sentence vs the reference text.

    Args:
        citations: List of in-text citations (from extract_citations_from_text)
        references: List of reference entries (from extract_references_section)

    Returns:
        {cit_idx: ref_idx} mapping; values include 'ai_score' key when AI matched.
    """
    mapping = {}

    # ── IEEE: numeric direct mapping (no AI needed) ─────────────────────────
    # Use majority vote — don't rely solely on citations[0] which may be APA
    ieee_count = sum(1 for c in citations if c.get('style_type', '').upper() == 'IEEE')
    is_ieee    = ieee_count > len(citations) / 2 or (
        ieee_count > 0 and all(
            c.get('style_type', '').upper() == 'IEEE' for c in citations
        )
    )

    if is_ieee:
        # Build a ref_number → list_index lookup so we tolerate gaps in the
        # extracted reference list (multi-line refs that were partially missed).
        ref_by_number: Dict[int, int] = {}
        for list_idx, ref in enumerate(references):
            num = ref.get('ref_number')
            if num is not None:
                ref_by_number[num] = list_idx
            else:
                # Fallback: assume sequential numbering
                ref_by_number[list_idx + 1] = list_idx

        for cit_idx, citation in enumerate(citations):
            if citation.get('style_type', '').upper() != 'IEEE':
                continue
            raw  = citation.get('author', citation.get('text', ''))
            nums = re.findall(r'\d+', str(raw))
            # Handle multi-citation [1, 2, 3]: map each number separately.
            # The first number is the primary mapping; extras stored in 'extra_refs'.
            primary_set = False
            extras = []
            for num_str in nums:
                n = int(num_str)
                if n in ref_by_number:
                    if not primary_set:
                        mapping[cit_idx] = ref_by_number[n]
                        primary_set = True
                    else:
                        extras.append(ref_by_number[n])
            # Store extra refs so callers can use them if needed
            if extras:
                citation['extra_ref_indices'] = extras
        return mapping

    # ── Pass 1: regex / string matching ──────────────────────────────────────
    for cit_idx, citation in enumerate(citations):
        author = citation.get('author', '').replace('&', 'and').strip()
        year = citation.get('year_or_page', '')

        for ref_idx, reference in enumerate(references):
            ref_author = reference.get('author', '').strip()
            ref_text   = reference.get('text', '')

            if author and ref_author:
                cit_last = author.split()[-1].replace(',', '').lower()
                ref_last = ref_author.split(',')[0].lower()

                if cit_last in ref_last or ref_last in cit_last:
                    if year and year in ref_text:
                        mapping[cit_idx] = ref_idx
                        break
                    elif not year:
                        mapping[cit_idx] = ref_idx
                        break

    # ── Pass 2: AI semantic fallback for unmatched citations ─────────────────
    unmatched = [i for i in range(len(citations)) if i not in mapping]
    if unmatched and references:
        try:
            matcher = AISemanticCitationMatcher()
            matcher.fit(references)
            for cit_idx in unmatched:
                citation = citations[cit_idx]
                ref_idx, score = matcher.match_single(citation)
                if score >= AISemanticCitationMatcher.MATCH_THRESHOLD:
                    mapping[cit_idx] = ref_idx
        except Exception as e:
            logger.warning("AI citation matching failed, staying with regex results: %s", e)

    return mapping


# ---------------------------------------------------------------------------
# AI Semantic Citation Matcher
# ---------------------------------------------------------------------------

class AISemanticCitationMatcher:
    """
    Uses sentence-transformers to semantically match in-text citations to
    their corresponding reference list entries.

    Why this beats pure regex
    ─────────────────────────
    • Handles "et al." — the context sentence around the citation carries
      enough domain keywords to find the right reference even when only the
      first author is named.
    • Handles reversed / abbreviated names — embedding space is style-agnostic.
    • Works as a fallback: regex runs first (free), AI fills the gaps.

    Algorithm
    ─────────
    1. fit(references)       — encode every reference text once → ref_embeddings
    2. match_single(citation) → encode  query = author tokens + context sentence
                              → cosine_similarity(query, ref_embeddings)
                              → return (best_ref_idx, similarity_score)
    3. match_all(citations)  → batch wrapper returning full mapping dict

    Model: all-MiniLM-L6-v2  (already used by plagiarism detector and RAG analyzer)
    Similarity threshold: 0.30  (liberal; higher reduces false positives)
    """

    MODEL_NAME      = "all-MiniLM-L6-v2"
    MATCH_THRESHOLD = 0.30   # minimum cosine similarity to accept a match

    def __init__(self):
        self._model        = None   # lazy-loaded
        self._ref_texts:    List[str]    = []
        self._ref_embeddings             = None  # numpy array (N, D)

    # ── Model loading ────────────────────────────────────────────────────────

    def _load_model(self):
        if self._model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.MODEL_NAME)
            logger.info("AISemanticCitationMatcher: loaded %s", self.MODEL_NAME)
        except ImportError as exc:
            raise RuntimeError(
                "sentence-transformers is required for AI citation matching. "
                "Run: pip install sentence-transformers"
            ) from exc

    # ── Public API ───────────────────────────────────────────────────────────

    def fit(self, references: List[Dict]) -> "AISemanticCitationMatcher":
        """
        Encode all reference entries so they are ready for lookup.

        Args:
            references: List of dicts with at least a 'text' key
                        (output of extract_references_section)

        Returns:
            self  (allows chaining: matcher.fit(refs).match_all(cits))
        """
        self._load_model()
        self._ref_texts = [r.get('text', '') for r in references]
        if not self._ref_texts:
            return self

        import numpy as np
        raw = self._model.encode(self._ref_texts, convert_to_numpy=True,
                                 show_progress_bar=False, normalize_embeddings=True)
        self._ref_embeddings = raw        # shape (N, D), already L2-normalised
        logger.info("AISemanticCitationMatcher: encoded %d references", len(self._ref_texts))
        return self

    def _build_query(self, citation: Dict) -> str:
        """
        Build a query string from the citation that best represents its semantic
        content for embedding lookup.

        We combine:
          • The citation marker (author + year/page)
          • The surrounding context sentence (already stored in citation['context'])

        The context sentence carries topic keywords (e.g. "significantly improved
        accuracy in neural networks") that align with the reference text even when
        the author name is abbreviated.
        """
        parts = []

        author = citation.get('author', '').strip()
        year   = citation.get('year_or_page', '').strip()
        if author:
            parts.append(author)
        if year:
            parts.append(year)

        context = citation.get('context', '').strip()
        if context:
            # Remove the literal citation marker from the context to avoid
            # the model focusing purely on "[1]" or "(Smith, 2020)".
            cit_text = re.escape(citation.get('text', ''))
            context_clean = re.sub(cit_text, '', context).strip()
            if context_clean:
                parts.append(context_clean)

        return ' '.join(parts) if parts else citation.get('text', '')

    def match_single(self, citation: Dict) -> Tuple[int, float]:
        """
        Find the best-matching reference for a single citation.

        Args:
            citation: Dict from extract_citations_from_text

        Returns:
            (best_ref_idx, cosine_similarity_score)
            Returns (-1, 0.0) if no references were fitted.
        """
        if self._ref_embeddings is None or len(self._ref_texts) == 0:
            return -1, 0.0

        import numpy as np
        query = self._build_query(citation)
        q_emb = self._model.encode([query], convert_to_numpy=True,
                                   show_progress_bar=False,
                                   normalize_embeddings=True)[0]  # shape (D,)

        # Dot product = cosine similarity (both sides are L2-normalised)
        scores    = self._ref_embeddings @ q_emb                   # shape (N,)
        best_idx  = int(np.argmax(scores))
        best_score = float(scores[best_idx])
        return best_idx, best_score

    def match_all(self, citations: List[Dict]) -> Dict[int, Dict]:
        """
        Match every citation in the list to its best reference.

        Args:
            citations: List of dicts from extract_citations_from_text

        Returns:
            {
              cit_idx: {
                "ref_idx":   int,    # 0-based index into the references list
                "score":     float,  # cosine similarity (0–1)
                "matched":   bool,   # True when score >= MATCH_THRESHOLD
                "query":     str,    # the query string that was embedded
              },
              ...
            }
        """
        if self._ref_embeddings is None:
            raise RuntimeError("Call fit(references) before match_all()")

        import numpy as np

        # Batch-encode all queries at once for efficiency
        queries  = [self._build_query(c) for c in citations]
        q_embs   = self._model.encode(queries, convert_to_numpy=True,
                                      show_progress_bar=False,
                                      normalize_embeddings=True)  # (M, D)
        # Cosine similarity matrix: (M, N)
        sim_matrix = q_embs @ self._ref_embeddings.T

        result = {}
        for cit_idx, row in enumerate(sim_matrix):
            best_idx   = int(np.argmax(row))
            best_score = float(row[best_idx])
            result[cit_idx] = {
                "ref_idx": best_idx,
                "score":   round(best_score, 4),
                "matched": best_score >= self.MATCH_THRESHOLD,
                "query":   queries[cit_idx],
            }
        return result
