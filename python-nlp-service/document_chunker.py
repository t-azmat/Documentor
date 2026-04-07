"""
Document Chunker - AI Formatting Pipeline (Step 1)
Splits a document into semantic sections / chunks.

Two modes:
  1. Structured mode  (preferred) — receives a list of typed blocks from
     FileExtractor.extract_structured().  Block styles "Heading 1/2/3" act
     as explicit section boundaries; no regex required.

  2. Text mode (fallback) — receives raw str (TXT / legacy).  Uses the same
     heading-regex approach as before, but now also runs the bottom-up
     reference detector to recover a reference section even when no
     "References" heading is present.

Public API (unchanged from before):
    chunker.chunk(text, title="")         → List[Dict]  (text mode)
    chunker.chunk_blocks(blocks, title="")→ List[Dict]  (structured mode)
"""

import re
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Section-type keyword maps
# ---------------------------------------------------------------------------
HEADING_PATTERNS: List[Tuple[str, str]] = [
    ("abstract",        r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?abstract[ \t]*[:\-]?\s*(?:\n|$)"),
    ("introduction",    r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?introduction[ \t]*[:\-]?\s*(?:\n|$)"),
    ("literature",      r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?(?:literature review|related work|prior work)[ \t]*[:\-]?\s*(?:\n|$)"),
    ("methodology",     r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?(?:methodology|methods?|approach|procedure|research design|experimental setup)[ \t]*[:\-]?\s*(?:\n|$)"),
    ("results",         r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?(?:results?|findings?|outcomes?|experiments?)[ \t]*[:\-]?\s*(?:\n|$)"),
    ("discussion",      r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?(?:discussion|analysis|interpretation|implications|limitations)[ \t]*[:\-]?\s*(?:\n|$)"),
    ("conclusion",      r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?(?:conclusions?|concluding remarks?|future work)[ \t]*[:\-]?\s*(?:\n|$)"),
    ("references",      r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?(?:references?|bibliography|cited works|works cited)[ \t]*[:\-]?\s*(?:\n|$)"),
    ("acknowledgements",r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?(?:acknowledg(?:e)?ments?|funding)[ \t]*[:\-]?\s*(?:\n|$)"),
    ("appendix",        r"(?:^|\n)[ \t]*(?:\d+[\.\)]\s*)?appendix[ \t]*[:\-]?\s*(?:\n|$)"),
]

# Keyword → section_type for heading text classification
_HEADING_KEYWORDS: List[Tuple[str, str]] = [
    ("abstract",         "abstract"),
    ("introduction",     "introduction"),
    ("literature review","literature"),
    ("related work",     "literature"),
    ("prior work",       "literature"),
    ("methodology",      "methodology"),
    ("methods",          "methodology"),
    ("research design",  "methodology"),
    ("experimental setup","methodology"),
    ("results",          "results"),
    ("findings",         "results"),
    ("discussion",       "discussion"),
    ("analysis",         "discussion"),
    ("conclusion",       "conclusion"),
    ("concluding",       "conclusion"),
    ("future work",      "conclusion"),
    ("references",       "references"),
    ("bibliography",     "references"),
    ("works cited",      "references"),
    ("cited works",      "references"),
    ("acknowledgement",  "acknowledgements"),
    ("acknowledgment",   "acknowledgements"),
    ("funding",          "acknowledgements"),
    ("appendix",         "appendix"),
]

# Reference line: [1] …  /  1. Author …  /  Author, A. (2020) …
_REF_LINE_RE = re.compile(
    r'^\s*(?:'
    r'\[\d+\]'                            # [1]
    r'|\d{1,3}\.'                         # 1.  2.  …  99.
    r'|[A-Z][a-z]+(?:,\s|\s[A-Z]\.)'     # Smith, A.  /  Smith A.
    r')'
    r'.{15,}'                             # meaningful content
    r'\b(?:19|20)\d{2}\b'                 # contains a year
)

SLIDING_WINDOW_WORDS = 300
SLIDING_OVERLAP_WORDS = 0  # overlap is meaningless here — chunks are merged back immediately


class DocumentChunker:
    """
    Splits a document into labelled semantic chunks.

    Preferred: call chunk_blocks(blocks) with the output of
               FileExtractor.extract_structured().
    Fallback:  call chunk(text) with raw plain text.
    """

    # ------------------------------------------------------------------
    # Public: structured mode
    # ------------------------------------------------------------------

    def chunk_blocks(self, blocks: List[Dict], title: str = "") -> List[Dict]:
        """
        Convert a list of {style, text} blocks (from FileExtractor) into
        labelled section chunks.

        Heading-style blocks become section boundaries; consecutive Normal
        blocks under one heading are joined into a single chunk body.
        """
        if not blocks:
            return []

        # Pre-pass: run bottom-up reference detector on the block list to
        # reclassify a trailing run of reference-like Normal blocks.
        blocks = self._detect_references_in_blocks(blocks)

        sections: List[Dict] = []
        current_type    = "unknown"
        current_heading = title
        current_level   = 1
        current_parts: List[str] = []
        char_pos = 0

        def _flush(end_pos: int):
            body = "\n".join(current_parts).strip()
            if body:
                sections.append(self._make_chunk(
                    section_type=current_type,
                    heading=current_heading,
                    text=body,
                    char_start=char_pos,
                    char_end=end_pos,
                    sub_chunk=False,
                    level=current_level,
                ))

        for i, block in enumerate(blocks):
            style = block.get("style", "Normal")
            text  = block.get("text", "").strip()
            if not text:
                continue

            block_len = len(text) + 1  # +1 for the newline we count

            if style.startswith("Heading") or style == "Title":
                # Save accumulated body, start a new section
                _flush(char_pos)
                current_parts = []
                current_heading = text
                current_type    = self._classify_heading_text(text)
                current_level   = self._infer_level(text, block_style=style)
                char_pos += block_len
            elif style == "References" and current_type != "references":
                # _detect_references_in_blocks injected this style — treat as
                # a virtual heading that opens a new references section so that
                # reference blocks are not silently merged into the preceding
                # body section (e.g., conclusion).
                _flush(char_pos)
                current_parts   = [text]
                current_heading = "References"
                current_type    = "references"
                current_level   = 1
                char_pos += block_len
            else:
                current_parts.append(text)
                char_pos += block_len

        _flush(char_pos)

        # Sub-chunk large sections and re-index
        return self._finalise(sections)

    # ------------------------------------------------------------------
    # Public: text / legacy mode
    # ------------------------------------------------------------------

    def chunk(self, text: str, title: str = "") -> List[Dict]:
        """
        Chunk raw plain text.  Also accepts the flat-text output of
        FileExtractor.extract_text() for backwards compatibility.
        """
        if not text or not text.strip():
            return []

        # Bottom-up reference detection: find reference block even when
        # no heading is present and inject a synthetic boundary marker.
        text = self._inject_reference_boundary(text)

        boundaries = self._detect_boundaries(text)

        if boundaries:
            chunks = self._build_section_chunks(text, boundaries)
        else:
            logger.info("No headings detected – using sliding-window chunking")
            chunks = self._sliding_window_chunks(
                text, section_type="unknown", heading="", start=0
            )

        return self._finalise(chunks)

    # ------------------------------------------------------------------
    # Bottom-up reference detectors
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_references_in_blocks(blocks: List[Dict]) -> List[Dict]:
        """
        Scan blocks from the end.  If we find a run of 3+ consecutive
        Normal blocks that all look like reference entries, reclassify
        everything from the first such block onward as style="References".
        """
        result = list(blocks)
        n = len(result)
        ref_start = None
        consecutive_misses = 0

        for i in range(n - 1, -1, -1):
            b = result[i]
            if b.get("style") == "Normal" and _REF_LINE_RE.match(b.get("text", "")):
                ref_start = i
                consecutive_misses = 0
            elif b.get("style", "").startswith("Heading"):
                # Stop backtracking at any heading already in the doc
                break
            else:
                # Non-heading, non-reference block — allow up to 2 consecutive
                # irregular entries (URLs, undated entries, corporate names)
                # before giving up on the backwards scan.
                consecutive_misses += 1
                if consecutive_misses > 2:
                    break

        if ref_start is not None and (n - ref_start) >= 3:
            for i in range(ref_start, n):
                if result[i].get("style") == "Normal":
                    result[i] = dict(result[i], style="References")
        return result

    @staticmethod
    def _inject_reference_boundary(text: str) -> str:
        """
        For plain text mode: scan lines from the bottom.
        If 3+ consecutive lines match _REF_LINE_RE and there is no
        'References' heading already above them, prepend a synthetic heading.
        """
        lines = text.splitlines()
        n = len(lines)
        ref_start = None
        consecutive_misses = 0

        for i in range(n - 1, -1, -1):
            line = lines[i].strip()
            if not line:
                continue
            if _REF_LINE_RE.match(line):
                ref_start = i
                consecutive_misses = 0
            else:
                # Allow up to 2 irregular lines (no year, URL-only, corporate)
                # before stopping the scan.
                consecutive_misses += 1
                if consecutive_misses > 2:
                    break

        if ref_start is None or (n - ref_start) < 3:
            return text

        # Check whether a References heading already exists above
        above = "\n".join(lines[:ref_start])
        if re.search(r'\b(?:references?|bibliography|works cited)\b', above, re.IGNORECASE):
            return text  # heading already there — chunker will handle it

        # Inject heading
        lines.insert(ref_start, "\nReferences\n")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Private helpers (text mode)
    # ------------------------------------------------------------------

    def _detect_boundaries(self, text: str) -> List[Tuple[int, str, str]]:
        matches: List[Tuple[int, str, str]] = []
        for section_type, pattern in HEADING_PATTERNS:
            for m in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
                matches.append((m.start(), section_type, m.group().strip()))

        # ── Heuristic scan: catch numbered / title-cased headings not in HEADING_PATTERNS ──
        # Requires a blank line (or start of document) before the candidate line.
        already_covered = {pos for pos, _, _ in matches}
        lines = text.splitlines(keepends=True)
        char_pos = 0
        prev_blank = True  # treat start-of-doc as preceded by a blank line
        for line in lines:
            stripped = line.strip()
            if stripped and prev_blank and self._is_heading_line(stripped):
                if not any(abs(char_pos - cp) < 50 for cp in already_covered):
                    stype = self._classify_heading_text(stripped)
                    matches.append((char_pos, stype, stripped))
                    already_covered.add(char_pos)
            prev_blank = not stripped
            char_pos += len(line)

        matches.sort(key=lambda x: x[0])
        deduped: List[Tuple[int, str, str]] = []
        last_pos = -100
        for pos, stype, heading in matches:
            if pos - last_pos > 20:
                deduped.append((pos, stype, heading))
                last_pos = pos
        return deduped

    def _build_section_chunks(self, text: str, boundaries: List[Tuple[int, str, str]]) -> List[Dict]:
        chunks: List[Dict] = []
        for i, (start, stype, heading) in enumerate(boundaries):
            end  = boundaries[i + 1][0] if i + 1 < len(boundaries) else len(text)
            body = text[start:end].strip()
            body_lines = body.split("\n")
            if body_lines and re.match(
                r"^(?:\d+[\.\)]?\s*)?(?:abstract|introduction|methodology|methods|results|"
                r"discussion|conclusion|references|bibliography|literature|appendix|"
                r"acknowledgements)[\s:\-]*$",
                body_lines[0].strip(),
                re.IGNORECASE,
            ):
                body = "\n".join(body_lines[1:]).strip()
            chunks.append(self._make_chunk(
                section_type=stype, heading=heading,
                text=body, char_start=start, char_end=end, sub_chunk=False,
                level=self._infer_level(heading),
            ))
        return chunks

    def _sliding_window_chunks(
        self, text: str, section_type: str, heading: str, start: int, level: int = 1
    ) -> List[Dict]:
        words = text.split()
        chunks: List[Dict] = []
        idx = 0
        char_cursor = start
        step = max(1, SLIDING_WINDOW_WORDS - SLIDING_OVERLAP_WORDS)
        while idx < len(words):
            window = words[idx: idx + SLIDING_WINDOW_WORDS]
            body   = " ".join(window)
            chunks.append(self._make_chunk(
                section_type=section_type, heading=heading,
                text=body, char_start=char_cursor,
                char_end=char_cursor + len(body), sub_chunk=True,
                level=level,
            ))
            char_cursor += len(" ".join(words[idx: idx + step])) + 1
            idx += step
        return chunks

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    def _finalise(self, chunks: List[Dict]) -> List[Dict]:
        """Sub-chunk large sections and re-index."""
        final: List[Dict] = []
        for chunk in chunks:
            if chunk["word_count"] > 600:
                sub = self._sliding_window_chunks(
                    chunk["text"],
                    section_type=chunk["section_type"],
                    heading=chunk["heading"],
                    start=chunk["char_start"],
                    level=chunk.get("level", 1),
                )
                final.extend(sub)
            else:
                final.append(chunk)
        for i, c in enumerate(final):
            c["id"] = i
        logger.info(f"DocumentChunker produced {len(final)} chunks")
        return final

    @staticmethod
    def _is_heading_line(line: str) -> bool:
        """
        Heuristic: return True if a bare text line looks like a section heading.
        Used in text-mode (plain .txt / unstructured) to catch numbered and
        title-cased headings that are not covered by HEADING_PATTERNS keywords.
        Only called when the preceding line is blank (or start of document).
        """
        line = line.strip()
        if not line or len(line) > 120:
            return False
        # Body sentences almost always end with punctuation
        if line[-1] in '.,:;?!':
            return False
        # Numbered heading: "2.1 Title" / "2. Title" / "2) Title"
        if re.match(r'^\d+(\.\d+)*[\s\.\)]\s*\S', line):
            return True
        # Roman numeral heading (IEEE style): "I. INTRODUCTION"
        if re.match(r'^(?:I{1,3}|IV|VI{0,3}|IX|XI{0,3})\.\s+[A-Z]', line):
            return True
        # Short line (≤10 words) that is mostly title-cased or ALL CAPS
        words = line.split()
        if not words:
            return False
        if len(words) <= 10:
            if line.isupper() and len(words) >= 2:
                return True
            cap_words = sum(1 for w in words if w and w[0].isupper())
            if len(words) >= 2 and cap_words / len(words) >= 0.75:
                return True
        return False

    @staticmethod
    def _classify_heading_text(text: str) -> str:
        """Map a heading string to its section_type."""
        lower = text.lower()
        for keyword, stype in _HEADING_KEYWORDS:
            if keyword in lower:
                return stype
        return "unknown"

    @staticmethod
    def _infer_level(heading: str, block_style: str = None) -> int:
        """
        Infer heading level (1=section, 2=subsection, 3=subsubsection).
        Uses DOCX paragraph style when available; otherwise analyses heading text.
        """
        # Structured DOCX/PDF mode: "Heading 1" → 1, "Heading 2" → 2, etc.
        if block_style:
            m = re.match(r'Heading\s*(\d+)', block_style, re.IGNORECASE)
            if m:
                return min(int(m.group(1)), 3)
        # Numeric prefix: "1." → 1,  "1.1" → 2,  "1.1.1" → 3
        m = re.match(r'^(\d+)((?:\.\d+)*)[\s\.\)]', heading.strip())
        if m:
            dot_count = len([p for p in m.group(2).split('.') if p])
            return min(dot_count + 1, 3)
        # IEEE Roman numeral section: "I. TITLE" → 1
        if re.match(r'^(?:I{1,3}|IV|V?I{0,3}|IX|X{1,3})\.[\s]', heading):
            return 1
        # IEEE/standard lettered subsection: "A. Title" → 2
        if re.match(r'^[A-Z]\.\s+\S', heading):
            return 2
        return 1  # default: top-level section

    @staticmethod
    def _make_chunk(
        section_type: str, heading: str, text: str,
        char_start: int, char_end: int, sub_chunk: bool,
        level: int = 1,
    ) -> Dict:
        return {
            "id": 0,
            "section_type": section_type,
            "heading": heading,
            "text": text,
            "word_count": len(text.split()),
            "char_start": char_start,
            "char_end": char_end,
            "sub_chunk": sub_chunk,
            "level": level,
        }

    def _merge_sub_chunks(self, chunks: List[Dict]) -> List[Dict]:
        """Merge sliding-window sub-chunks back into single section entries."""
        merged: Dict[str, Dict] = {}
        order: List[str] = []
        for c in chunks:
            key = f"{c['section_type']}_{c['heading']}"
            if key not in merged:
                merged[key] = dict(c)
                order.append(key)
            else:
                merged[key]["text"]       += "\n\n" + c["text"]
                merged[key]["word_count"] += c["word_count"]
        return [merged[k] for k in order]

    def build_tree(
        self,
        text: str = None,
        blocks: List[Dict] = None,
        title: str = "",
        flat_chunks: List[Dict] = None,
    ) -> Dict:
        """
        Build a nested section tree.  Accepts one of:
          flat_chunks — pre-computed, already-deduplicated chunk list (skips re-chunking)
          blocks      — structured blocks from FileExtractor (DOCX / PDF)
          text        — raw plain text fallback

        Returns
        -------
        {
          "title":      str,
          "abstract":   str,
          "sections":   [ nested section nodes ],
          "references": [ raw reference line strings ]
        }

        Each section node schema::

            {
              "heading":      str,
              "level":        int,   # 1=section  2=subsection  3=subsubsection
              "section_type": str,
              "text":         str,   # direct body text of this node
              "subsections":  [ ... ]  # children with the same schema
            }
        """
        if flat_chunks is not None:
            merged = flat_chunks
        elif blocks:
            merged = self._merge_sub_chunks(self.chunk_blocks(blocks, title=title))
        elif text:
            merged = self._merge_sub_chunks(self.chunk(text, title=title))
        else:
            return {"title": title, "abstract": "", "sections": [], "references": []}

        abstract   = ""
        references: List[str] = []
        body: List[Dict] = []
        for c in merged:
            if c["section_type"] == "abstract":
                abstract = c["text"]
            elif c["section_type"] == "references":
                references = [ln.strip() for ln in c["text"].splitlines() if ln.strip()]
            else:
                body.append(c)

        # Stack-based nesting: a node whose level is greater than the
        # previous becomes a child; equal/lower level pops back to a sibling.
        root_children: List[Dict] = []
        stack: List[Tuple[int, List]] = [(0, root_children)]  # (level, children_list)

        for c in body:
            level = c.get("level", 1)
            node: Dict = {
                "heading":      c["heading"],
                "level":        level,
                "section_type": c["section_type"],
                "text":         c["text"],
                "subsections":  [],
            }
            while len(stack) > 1 and stack[-1][0] >= level:
                stack.pop()
            stack[-1][1].append(node)
            stack.append((level, node["subsections"]))

        return {
            "title":      title,
            "abstract":   abstract,
            "sections":   root_children,
            "references": references,
        }
