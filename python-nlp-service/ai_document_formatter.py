"""
AI Document Formatter - Orchestrator (Step 5)
Coordinates the full AI formatting pipeline:
  1. DocumentChunker    → semantic section chunks
  2. RAGAnalyzer        → identify missing / thin sections
  3. CitationConverter  → convert citations to target style
  4. LaTeXGenerator     → produce compilable LaTeX

Usage (standalone):
    from ai_document_formatter import AIDocumentFormatter
    result = AIDocumentFormatter().format(text, target_style="APA")
"""

import logging
import re
import traceback
from typing import Dict, List, Optional

from document_chunker   import DocumentChunker
from citation_converter import CitationConverter
from latex_generator    import LaTeXGenerator
from rag_analyzer       import RAGAnalyzer

logger = logging.getLogger(__name__)


class AIDocumentFormatter:
    """
    End-to-end AI academic document formatter.
    """

    def __init__(self):
        self.chunker    = DocumentChunker()
        self.converter  = CitationConverter()
        self.latex_gen  = LaTeXGenerator()
        self.rag        = RAGAnalyzer()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def format(
        self,
        text: str,
        target_style: str        = "APA",
        source_style: str        = "unknown",
        title: str               = "Untitled Document",
        authors: Optional[List[str]] = None,
        extra_metadata: Optional[Dict] = None,
        generate_latex: bool     = True,
        structured_blocks: Optional[List[Dict]] = None,
        table_of_contents: Optional[List[Dict]] = None,
    ) -> Dict:
        """
        structured_blocks: if provided (output of FileExtractor.extract_structured()),
        the chunker uses the style-aware path instead of regex on raw text.
        """
        """
        Format a document end-to-end.

        Parameters
        ----------
        text            : Raw document text
        target_style    : Desired output style (APA / MLA / IEEE / Chicago / Harvard)
        source_style    : Original citation style; 'unknown' triggers auto-detection
        title           : Document title
        authors         : List of author names
        extra_metadata  : Dict with optional 'date', 'institution', 'keywords'
        generate_latex  : If False, skips LaTeX generation (returns plain sections only)

        Returns
        -------
        {
          success        : bool,
          latex          : str (full .tex source),
          plain_sections : list of {section_type, heading, text},
          citation_stats : {detected_style, refs_converted, intext_converted},
          warnings       : list of warning strings,
          error          : str or None,
        }
        """
        authors = authors or []
        result  = {
            "success":        False,
            "latex":          "",
            "plain_sections": [],
            "citation_stats": {},
            "gap_report": {},
            "warnings":       [],
            "error":          None,
        }

        try:
            # ----------------------------------------------------------
            # Step 1 – Chunk document into labelled sections
            # ----------------------------------------------------------
            logger.info("[Formatter] Step 1: Chunking document …")
            if structured_blocks:
                # Preferred path: structured blocks carry explicit heading styles
                logger.info("[Formatter] Using structured block chunking (DOCX/PDF metadata)")
                chunks = self.chunker.chunk_blocks(
                    structured_blocks,
                    title=title,
                    table_of_contents=table_of_contents
                )
            else:
                # Fallback: regex + bottom-up reference detection on raw text
                logger.info("[Formatter] Using text-mode chunking (regex + ref detector)")
                chunks = self.chunker.chunk(text, title=title)

            if not chunks:
                result["warnings"].append("No sections detected — treating document as a single block.")
                chunks = [{
                    "id": 1, "section_type": "unknown", "heading": title,
                    "text": text, "word_count": len(text.split()),
                    "char_start": 0, "char_end": len(text), "sub_chunk": 0,
                }]

            # Deduplicate (keep first sub_chunk per section_type when consecutive)
            deduped_chunks = self._deduplicate_chunks(chunks)

            # ----------------------------------------------------------
            # Step 2 – Structural gap analysis (RAG)
            # ----------------------------------------------------------
            logger.info("[Formatter] Step 2: Analysing structure and gaps …")
            gap_report = self.rag.analyse(deduped_chunks)
            gap_report["table_of_contents"] = table_of_contents or []
            gap_report["toc_alignment"] = self._build_toc_alignment(
                deduped_chunks,
                table_of_contents or []
            )
            result["gap_report"] = gap_report

            # ----------------------------------------------------------
            # Step 3 – Citation style conversion
            # ----------------------------------------------------------
            logger.info("[Formatter] Step 3: Converting citations …")
            citation_stats, converted_chunks, parsed_references = self._convert_citations(
                deduped_chunks, source_style, target_style
            )
            result["citation_stats"] = citation_stats

            # ----------------------------------------------------------
            # Step 3b – Rebuild references: parse → render → sort → end
            # ----------------------------------------------------------
            logger.info("[Formatter] Step 3b: Rebuilding references section …")
            converted_chunks, parsed_references = self._rebuild_references_section(
                converted_chunks,
                target_style,
                parsed_references=parsed_references,
            )
            result["plain_sections"] = [
                {
                    "section_type": c["section_type"],
                    "heading": c["heading"],
                    "text": c["text"],
                    "section_level": c.get("section_level", 1),
                    "block_count": c.get("block_count", 0)
                }
                for c in converted_chunks
            ]

            # ----------------------------------------------------------
            # Step 4 – Build nested section tree from converted chunks
            # ----------------------------------------------------------
            logger.info("[Formatter] Step 4: Building nested section tree …")
            section_tree = None
            try:
                section_tree = self.chunker.build_tree(
                    flat_chunks=converted_chunks,
                    title=title,
                )
                result["document_tree"] = section_tree
            except Exception as e:
                result["warnings"].append(f"Tree building failed: {e}")
                logger.warning("[Formatter] Tree building failed: %s", e)

            # ----------------------------------------------------------
            # Step 5 – LaTeX generation
            # ----------------------------------------------------------
            if not generate_latex:
                result["success"] = True
                return result

            logger.info("[Formatter] Step 5: Generating LaTeX …")
            abstract_text   = self._extract_section(converted_chunks, "abstract")
            references_text = self._extract_section(converted_chunks, "references")
            body_sections   = [
                c for c in converted_chunks
                if c["section_type"] not in ("abstract", "references")
            ]

            references_latex = self._build_references_latex(
                references_text,
                target_style,
                parsed_entries=parsed_references,
            )

            latex = self.latex_gen.generate(
                title           = title,
                authors         = authors,
                abstract        = abstract_text,
                sections        = body_sections,
                references_latex= references_latex,
                style           = target_style,
                extra_metadata  = extra_metadata,
                section_tree    = section_tree,
            )
            result["latex"]   = latex
            result["success"] = True

        except Exception as exc:
            logger.error("[Formatter] Fatal error: %s", traceback.format_exc())
            result["error"] = str(exc)

        return result

    def _build_toc_alignment(self, chunks: List[Dict], table_of_contents: List[Dict]) -> Dict:
        if not table_of_contents:
            return {
                "toc_entries": 0,
                "matched_entries": [],
                "missing_entries": [],
                "coverage": 0.0
            }

        chunk_map = {
            self._normalize_heading(c.get("heading", "")): {
                "heading": c.get("heading", ""),
                "section_type": c.get("section_type", "generic"),
                "section_level": c.get("section_level", 1)
            }
            for c in chunks
            if c.get("heading")
        }

        matched = []
        missing = []

        for entry in table_of_contents:
            text = str(entry.get("text", "")).strip()
            if not text:
                continue
            normalized = self._normalize_heading(text)
            if normalized in chunk_map:
                matched.append({
                    "toc_text": text,
                    "section_type": chunk_map[normalized]["section_type"],
                    "section_level": chunk_map[normalized]["section_level"]
                })
            else:
                missing.append(text)

        total = len(matched) + len(missing)
        coverage = (len(matched) / total) if total else 0.0
        return {
            "toc_entries": total,
            "matched_entries": matched,
            "missing_entries": missing,
            "coverage": round(coverage, 3)
        }

    @staticmethod
    def _normalize_heading(text: str) -> str:
        return re.sub(r'\s+', ' ', (text or '').strip()).lower()

    # ------------------------------------------------------------------
    # Helper methods
    # ------------------------------------------------------------------

    def _rebuild_references_section(
        self,
        chunks: List[Dict],
        style: str,
        parsed_references: Optional[List[Dict]] = None,
    ) -> (List[Dict], List[Dict]):
        """
        AI-powered reference rebuilding:
        1. Collect every entry from all references chunks.
        2. Strip any section heading that convert_reference_list may have embedded.
        3. Parse each raw entry through CitationConverter and re-render in target style.
        4. Deduplicate, sort (IEEE: numeric, others: alphabetic), and reassemble.
        5. Move the rebuilt references section to the very end of the chunk list.
        """
        _HEADINGS = {"references", "works cited", "bibliography", "reference list", "sources"}
        _STYLE_HEADINGS = {
            "APA": "References",
            "MLA": "Works Cited",
            "IEEE": "References",
            "Chicago": "Bibliography",
            "Harvard": "Reference List",
        }

        non_ref: List[Dict] = []
        all_raw_entries: List[str] = []
        first_ref_chunk: Optional[Dict] = None

        for c in chunks:
            if c["section_type"] == "references":
                if first_ref_chunk is None:
                    first_ref_chunk = dict(c)
                text = c["text"]
                # Strip embedded heading (added by convert_reference_list or present
                # in original chunk) before splitting into individual entries.
                first_line, _, rest = text.partition("\n")
                if first_line.strip().lower() in _HEADINGS:
                    text = rest
                # Use _split_references so multi-line entries are joined correctly
                # rather than being fragmented by a raw splitlines() call.
                raw_entries = self.converter._split_references(text)
                all_raw_entries.extend(raw_entries)
            else:
                non_ref.append(c)

        if not all_raw_entries:
            return chunks, (parsed_references or [])  # nothing to rebuild — leave document unchanged

        # Deduplicate raw entries first (before parsing) so that distinct but
        # poorly-parsed entries are never collapsed together.
        seen_raw: set = set()
        deduped_raw: List[str] = []
        for raw in all_raw_entries:
            key = " ".join(raw.lower().split())
            if key and key not in seen_raw:
                seen_raw.add(key)
                deduped_raw.append(raw.strip())

        parsed_by_raw = {}
        for record in parsed_references or []:
            raw_key = " ".join(str(record.get("raw", "")).lower().split())
            if raw_key:
                parsed_by_raw[raw_key] = record

        next_parsed: List[Dict] = []

        # Parse-and-render each unique raw entry into the target style.
        # A "parse failure" occurs when the record has no real authors/title/year —
        # in that case we preserve the original raw text verbatim so nothing is lost.
        _FAIL_AUTHORS = {"", "unknown author"}
        _FAIL_TITLES  = {"", "untitled"}
        _FAIL_YEARS   = {"", "n.d."}

        unique: List[str] = []
        for raw in deduped_raw:
            try:
                raw_key = " ".join(raw.lower().split())
                record = parsed_by_raw.get(raw_key) or self.converter._parse(raw, style)
                next_parsed.append(record)
                authors_str = self.converter._format_authors_apa(record.get("authors", [])).lower()
                title_str   = (record.get("title") or "").lower()
                year_str    = (record.get("year")  or "").lower()
                # If every key field is a fallback placeholder, the parse failed
                parse_failed = (
                    authors_str in _FAIL_AUTHORS
                    and title_str  in _FAIL_TITLES
                    and year_str   in _FAIL_YEARS
                )
                if parse_failed:
                    unique.append(raw)
                else:
                    out = self.converter._render(record, style).strip()
                    unique.append(out if len(out) >= 10 else raw)
            except Exception:
                unique.append(raw.strip())

        # For IEEE, assign sequential [N] bracket numbers before sorting
        if style == "IEEE":
            unique = [
                f"[{i}] {e}" if not re.match(r"^\[\d+\]", e) else e
                for i, e in enumerate(unique, 1)
            ]

        # Sort using existing helper (IEEE numeric, others alphabetic)
        sorted_text = self._sort_ref_entries("\n".join(unique), style)

        # Rebuild the references chunk
        heading = _STYLE_HEADINGS.get(style, "References")
        ref_chunk = first_ref_chunk or {
            "id": len(chunks) + 1,
            "section_type": "references",
            "sub_chunk": 0,
            "char_start": 0,
            "char_end": 0,
        }
        ref_chunk = dict(ref_chunk)
        ref_chunk["section_type"] = "references"
        ref_chunk["heading"]      = heading
        ref_chunk["text"]         = sorted_text
        ref_chunk["word_count"]   = len(sorted_text.split())

        logger.info("[Formatter] Rebuilt %d reference entries (style: %s)",
                    len(unique), style)

        # References section always goes to the end
        return non_ref + [ref_chunk], next_parsed

    def _sort_ref_entries(self, text: str, style: str) -> str:
        """
        Split a raw references block into individual entries and sort them.
        IEEE  → split on [n] markers, sort numerically.
        Others → split on blank lines (fallback: detect entry boundaries),
                 sort alphabetically.
        Returns a newline-joined string (one entry per line) ready for
        both the plain_sections preview and _build_docx / _build_pdf.
        """
        import re
        text = text.strip()
        if not text:
            return text

        entries = []
        if style == 'IEEE':
            parts = re.split(r'(?=\[\d+\])', text)
            for p in parts:
                p = p.strip()
                if p:
                    entries.append(' '.join(ln.strip() for ln in p.splitlines() if ln.strip()))
            entries.sort(key=lambda e: int(re.match(r'\[(\d+)\]', e).group(1))
                         if re.match(r'\[(\d+)\]', e) else 9999)
        else:
            raw = re.split(r'\n{2,}', text)
            if len(raw) > 1:
                for r in raw:
                    entry = ' '.join(ln.strip() for ln in r.splitlines() if ln.strip())
                    if entry:
                        entries.append(entry)
            else:
                lines = text.splitlines()
                current: list = []
                end_chars = set('.);]"\'')
                entry_start = re.compile(r'^(?:[A-Z][a-z]|[A-Z]{2,}|[(\[])')
                for line in lines:
                    stripped = line.strip()
                    if not stripped:
                        if current:
                            entries.append(' '.join(current))
                            current = []
                        continue
                    if (current and entry_start.match(stripped)
                            and current[-1] and current[-1][-1] in end_chars):
                        entries.append(' '.join(current))
                        current = [stripped]
                    else:
                        current.append(stripped)
                if current:
                    entries.append(' '.join(current))
            entries.sort(key=lambda e: re.sub(r'^[\[(]?\d+[\])]?\s*', '', e).lower())

        return '\n'.join(entries)

    def _deduplicate_chunks(self, chunks: List[Dict]) -> List[Dict]:
        """
        When the chunker splits one long section into sub-chunks (sub_chunk > 0),
        merge them back into a single chunk to simplify downstream processing.
        """
        merged: Dict[str, Dict] = {}
        order:  List[str]       = []

        for c in chunks:
            key = f"{c['section_type']}_{c['heading']}"
            if key not in merged:
                merged[key] = dict(c)
                order.append(key)
            else:
                merged[key]["text"]       += "\n\n" + c["text"]
                merged[key]["word_count"] += c["word_count"]
                merged[key]["char_end"]    = c["char_end"]

        return [merged[k] for k in order]

    def _convert_citations(
        self,
        chunks: List[Dict],
        source_style: str,
        target_style: str,
    ) -> (Dict, List[Dict], List[Dict]):
        """
        Detect source style from the references chunk, then convert all in-text
        citations AND the references section to target_style.
        Returns (stats_dict, updated_chunks_list).
        """
        stats = {"detected_style": source_style, "refs_converted": 0, "intext_converted": 0}

        # Find references chunk
        ref_chunk = next(
            (c for c in chunks if c["section_type"] == "references"), None
        )
        ref_text = ref_chunk["text"] if ref_chunk else ""

        # Auto-detect style from reference list
        if source_style in ("unknown", "", None) and ref_text:
            detected = self.converter.detect_style(ref_text)
            stats["detected_style"] = detected
            source_style = detected

        # Nothing to do if styles match
        if source_style == target_style:
            parsed_refs = []
            if ref_text:
                try:
                    parsed_refs = self.converter.parse_reference_list(ref_text, source_style)
                except Exception:
                    parsed_refs = []
            return stats, chunks, parsed_refs

        # Pre-parse reference list for in-text conversion mapping
        parsed_refs = []
        if ref_text:
            try:
                parsed_refs = self.converter.parse_reference_list(ref_text, source_style)
            except Exception:
                pass

        updated = []
        for chunk in chunks:
            c = dict(chunk)
            if c["section_type"] == "references" and ref_text:
                try:
                    conversion_result = self.converter.convert_reference_list(
                        ref_text, source_style, target_style
                    )
                    entries = conversion_result.get("entries", [])
                    stats["refs_converted"] = conversion_result.get("count", 0)
                    c["text"] = conversion_result.get("converted_references", ref_text)
                except Exception as e:
                    logger.warning("[Formatter] Reference conversion failed: %s", e)
            else:
                # Convert in-text citations in body sections
                try:
                    orig      = c["text"]
                    converted = self.converter.convert_intext_citations(
                        orig, source_style, target_style,
                        reference_list=parsed_refs,
                    )
                    if converted != orig:
                        stats["intext_converted"] += 1
                    c["text"] = converted
                except Exception as e:
                    logger.debug("[Formatter] In-text conversion failed for '%s': %s",
                                 c.get("heading"), e)
            updated.append(c)

        return stats, updated, parsed_refs

    def _extract_section(self, chunks: List[Dict], section_type: str) -> str:
        """Return the merged text for all chunks of a given section_type."""
        parts = [c["text"] for c in chunks if c["section_type"] == section_type]
        return "\n\n".join(parts)

    def _build_references_latex(
        self,
        references_text: str,
        style: str,
        parsed_entries: Optional[List[Dict]] = None,
    ) -> str:
        """
        Convert a plain-text reference list into LaTeX bibliography entries.
        For biblatex styles returns BibTeX @article blocks;
        for IEEE returns \\bibitem blocks.
        """
        if not references_text.strip():
            return ""

        entries = parsed_entries or self.converter.parse_reference_list(references_text)
        if not entries:
            # Fallback: wrap raw lines as bibitems
            lines = [l.strip() for l in references_text.splitlines() if l.strip()]
            bibitems = []
            for i, line in enumerate(lines, 1):
                bibitems.append(f"\\bibitem{{ref{i}}}\n{line}\n")
            return "\n".join(bibitems)

        entry_dicts = [{"parsed": e, "converted": e.get("raw", "")} for e in entries]
        return self.latex_gen.sections_to_bibitems(entry_dicts, style)
