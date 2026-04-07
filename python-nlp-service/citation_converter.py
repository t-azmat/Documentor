"""
Citation Converter - AI Formatting Pipeline (Step 3)
Parses reference entries in any supported style and re-formats them
into the target style.

Supports:
  - APA  7th ed.
  - MLA  9th ed.
  - IEEE
  - Chicago 17th ed. (author-date)
  - Harvard

Strategy:
  1.  Regex-based parser extracts a normalised BibTeX-like record from each
      reference line (works for most well-formed references).
  2.  A rule-based renderer serialises that record into the target style.
  3.  In-text citation patterns are also converted (e.g., (Smith, 2020) →
      [1] for IEEE, or Smith (2020) for author-date styles).
"""

import re
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Normalised reference record fields
# ---------------------------------------------------------------------------
EMPTY_RECORD: Dict = {
    "authors":    [],   # list of "Last, First" strings
    "year":       "",
    "title":      "",
    "journal":    "",
    "volume":     "",
    "issue":      "",
    "pages":      "",
    "publisher":  "",
    "location":   "",
    "doi":        "",
    "url":        "",
    "edition":    "",
    "editors":    [],
    "type":       "article",   # article | book | chapter | conference | website
    "raw":        "",          # original unparsed text
}


class CitationConverter:
    """
    Parse-and-render citation style converter.
    """

    STYLES = ("APA", "MLA", "IEEE", "Chicago", "Harvard")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def convert_reference_list(
        self,
        references_text: str,
        source_style: str,
        target_style: str,
    ) -> Dict:
        """
        Convert an entire references section from source_style to target_style.

        Args:
            references_text: Raw text of the references section (one ref per line/block)
            source_style:    Detected or declared source style (may be 'unknown')
            target_style:    Desired output style

        Returns:
            {
              "converted_references": str,       # full formatted reference list
              "entries": [                        # per-entry detail
                  {"original": str, "parsed": dict, "converted": str}
              ],
              "count": int,
              "warnings": [str],
            }
        """
        raw_entries = self._split_references(references_text)
        results = []
        warnings = []

        for raw in raw_entries:
            record = self._parse(raw, source_style)
            converted = self._render(record, target_style)
            results.append({
                "original":  raw.strip(),
                "parsed":    record,
                "converted": converted,
            })

        heading = self._section_heading(target_style)
        # IEEE references must carry [N] bracket numbers
        if target_style == "IEEE":
            body_lines = []
            for i, r in enumerate(results, 1):
                entry = r["converted"]
                if not re.match(r"^\[\d+\]", entry):
                    entry = f"[{i}] {entry}"
                body_lines.append(f"  {entry}")
            body = "\n".join(body_lines)
        else:
            body = "\n".join(f"  {r['converted']}" for r in results)
        converted_references = f"{heading}\n{body}"

        return {
            "converted_references": converted_references,
            "entries":  results,
            "count":    len(results),
            "warnings": warnings,
        }

    def convert_intext_citations(
        self,
        text: str,
        source_style: str,
        target_style: str,
        reference_list: Optional[List[Dict]] = None,
    ) -> str:
        """
        Scan body text and rewrite in-text citation patterns.

        For author-date ↔ author-date: straightforward regex replacement.
        For author-date → IEEE numbered: requires a reference_list to build
        the mapping author→number.
        """
        if source_style == target_style:
            return text

        # Build author→number map for IEEE targets
        if target_style == "IEEE" and reference_list:
            text = self._author_date_to_numbered(text, reference_list)
        elif source_style == "IEEE" and target_style in ("APA", "Harvard", "Chicago", "MLA"):
            text = self._numbered_to_author_date(text, reference_list or [], target_style)
        else:
            text = self._normalise_author_date(text, target_style)

        return text

    def parse_reference_list(self, references_text: str, style: str = "unknown") -> List[Dict]:
        """
        Parse a references block into a list of normalised record dicts.
        Useful when you only need the parsed entries without conversion.
        """
        raw_entries = self._split_references(references_text)
        return [self._parse(raw, style) for raw in raw_entries]

    def detect_style(self, references_text: str) -> str:
        """Heuristic detection of citation style from the references section."""
        sample = references_text[:2000]

        # IEEE: [1] Author, "Title," …
        if re.search(r"^\s*\[\d+\]", sample, re.MULTILINE):
            return "IEEE"
        # APA: Author, A. (Year).
        if re.search(r"\(\d{4}\)\.", sample):
            return "APA"
        # Harvard: Author (Year) …
        if re.search(r"\w+\s*\(\d{4}\)\s+[A-Z'\"]", sample):
            return "Harvard"
        # MLA: Author. "Title." …
        if re.search(r'"\w[^"]{10,}[.!?]"', sample):
            return "MLA"
        # Chicago: Author. Title. City: Publisher, Year.
        if re.search(r"\.\s+[A-Z][a-z]+:\s+\w+,\s+\d{4}", sample):
            return "Chicago"

        return "unknown"

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def _parse(self, raw: str, style: str) -> Dict:
        """Parse a single raw reference into a normalised record."""
        rec = dict(EMPTY_RECORD)
        rec["raw"] = raw.strip()

        parsers = [
            self._parse_apa,
            self._parse_ieee,
            self._parse_mla,
            self._parse_chicago,
            self._parse_generic,
        ]

        # Try style-specific parser first, then fall through
        style_map = {
            "APA": self._parse_apa,
            "IEEE": self._parse_ieee,
            "MLA": self._parse_mla,
            "Chicago": self._parse_chicago,
            "Harvard": self._parse_apa,   # Harvard ≈ APA for parsing
        }
        preferred = style_map.get(style, self._parse_generic)
        result = preferred(raw, rec)
        if result.get("title"):
            return result

        for parser in parsers:
            result = parser(raw, dict(EMPTY_RECORD, raw=raw))
            if result.get("title"):
                return result

        return rec

    def _parse_apa(self, raw: str, rec: Dict) -> Dict:
        """Author, A. B., & Other, C. (Year). Title. Journal, vol(issue), pages. https://doi"""
        # Capture the entire author block as everything before (Year).
        # This handles both abbreviated (Last, F.) and full-name (Last, First) formats.
        m = re.match(r"^(.+?)\s*\((\d{4}[a-z]?)\)\.\s*(.+)", raw)
        if not m or len(m.group(1)) > 250:
            return rec
        authors_raw, year, rest = m.group(1).strip(), m.group(2), m.group(3)
        rec["authors"] = self._parse_authors_apa(authors_raw)
        rec["year"] = year

        # Title (up to first period that is NOT an abbreviation)
        tm = re.match(r"^([^.]+(?:\.[^.A-Z]{0,3}[A-Z][^.]+)*)\.\s*(.*)", rest)
        if tm:
            rec["title"] = tm.group(1).strip()
            rest2 = tm.group(2)
        else:
            rec["title"] = rest.strip()
            rest2 = ""

        # Journal vol(issue), pages
        jm = re.search(r"([A-Za-z &]+),?\s*(\d+)(?:\((\d+)\))?,?\s*([\d–\-]+)\.", rest2)
        if jm:
            rec["journal"] = jm.group(1).strip()
            rec["volume"]  = jm.group(2)
            rec["issue"]   = jm.group(3) or ""
            rec["pages"]   = jm.group(4)
            rec["type"]    = "article"
        else:
            # Book
            rec["publisher"] = rest2.strip().rstrip(".")
            rec["type"] = "book"

        dm = re.search(r"https?://(?:doi\.org/)?(10\.\S+)", rest2)
        if dm:
            rec["doi"] = dm.group(1)

        return rec

    def _parse_ieee(self, raw: str, rec: Dict) -> Dict:
        """[N] A. Author, "Title," Journal, vol. V, no. N, pp. X–Y, Year."""
        m = re.match(r"^\[?\d+\]?\s*(.+)", raw)
        if not m:
            return rec
        body = m.group(1)

        # Authors (first initial. Last, …)
        am = re.match(r"^((?:[A-Z]\.\s*[A-Z][a-z'-]+(?:,\s*)?)+(?:and\s*[A-Z]\.\s*[A-Z][a-z'-]+)?),\s*\"(.+?)\"[,\.](.+)", body)
        if am:
            rec["authors"] = [a.strip() for a in re.split(r",\s*(?:and\s*)?", am.group(1))]
            rec["title"]   = am.group(2).strip()
            rest = am.group(3)
        else:
            rec["title"] = body[:80]
            rest = body

        vm = re.search(r"vol\.?\s*(\d+)", rest, re.IGNORECASE)
        nm = re.search(r"no\.?\s*(\d+)", rest, re.IGNORECASE)
        pm = re.search(r"pp\.?\s*([\d\–\-]+)", rest, re.IGNORECASE)
        ym = re.search(r",\s*(\d{4})", rest)
        jm = re.match(r"\s*([A-Za-z &.]+?),", rest)

        if jm: rec["journal"] = jm.group(1).strip()
        if vm: rec["volume"]  = vm.group(1)
        if nm: rec["issue"]   = nm.group(1)
        if pm: rec["pages"]   = pm.group(1)
        if ym: rec["year"]    = ym.group(1)
        rec["type"] = "article"
        return rec

    def _parse_mla(self, raw: str, rec: Dict) -> Dict:
        """Last, First. "Title." Journal vol.issue (Year): pages."""
        m = re.match(r"^([A-Z][a-z'-]+,\s*[A-Za-z .-]+)\.\s*\"([^\"]+)\"\.\s*([^,]+),?\s*vol\.\s*(\d+)(?:,?\s*no\.\s*(\d+))?\s*\((\d{4})\):\s*([\d\–\-]+)\.?", raw)
        if m:
            rec["authors"] = [m.group(1).strip()]
            rec["title"]   = m.group(2).strip()
            rec["journal"] = m.group(3).strip()
            rec["volume"]  = m.group(4)
            rec["issue"]   = m.group(5) or ""
            rec["year"]    = m.group(6)
            rec["pages"]   = m.group(7)
            rec["type"]    = "article"
            return rec
        return rec

    def _parse_chicago(self, raw: str, rec: Dict) -> Dict:
        """Last, First. Title. City: Publisher, Year."""
        m = re.match(r"^([A-Z][a-z'-]+,\s*[A-Za-z .-]+)\.\s*([^.]+)\.\s*([A-Za-z ]+):\s*([^,]+),\s*(\d{4})", raw)
        if m:
            rec["authors"]   = [m.group(1).strip()]
            rec["title"]     = m.group(2).strip()
            rec["location"]  = m.group(3).strip()
            rec["publisher"] = m.group(4).strip()
            rec["year"]      = m.group(5)
            rec["type"]      = "book"
            return rec
        return rec

    def _parse_generic(self, raw: str, rec: Dict) -> Dict:
        """Last-resort heuristic extraction."""
        ym = re.search(r"\b(19|20)\d{2}\b", raw)
        if ym:
            rec["year"] = ym.group(0)

        tm = re.search(r'"([^"]{10,})"', raw)
        if tm:
            rec["title"] = tm.group(1)
        elif "." in raw:
            parts = raw.split(".")
            # Skip parts that look like a year "(2020)" or author initials (very short)
            for candidate in parts[1:]:
                candidate = candidate.strip()
                if (candidate
                        and len(candidate) > 8
                        and not re.fullmatch(r"[\s\(\)\[\]\d]+", candidate)):
                    rec["title"] = candidate
                    break
            else:
                rec["title"] = parts[-1].strip() if parts else ""

        # Rough author (first segment before the first period)
        author_chunk = raw.split(".")[0].split(",")
        if author_chunk:
            rec["authors"] = [author_chunk[0].strip()]

        rec["raw"] = raw
        return rec

    # ------------------------------------------------------------------
    # Rendering
    # ------------------------------------------------------------------

    def _render(self, rec: Dict, style: str) -> str:
        renderer = {
            "APA":     self._render_apa,
            "MLA":     self._render_mla,
            "IEEE":    self._render_ieee,
            "Chicago": self._render_chicago,
            "Harvard": self._render_harvard,
        }.get(style, self._render_apa)
        return renderer(rec)

    def _render_apa(self, rec: Dict) -> str:
        authors = self._format_authors_apa(rec["authors"]) or "Unknown Author"
        year    = rec.get("year")    or "n.d."
        title   = rec.get("title")   or "Untitled"
        doi     = rec.get("doi")

        if rec.get("type") == "book":
            pub = ""
            if rec.get("location"):  pub += rec["location"] + ": "
            if rec.get("publisher"): pub += rec["publisher"]
            s = f"{authors} ({year}). *{title}*."
            if pub: s += f" {pub}."
        else:
            journal = rec.get("journal") or ""
            vol     = rec.get("volume")  or ""
            issue   = rec.get("issue")   or ""
            pages   = rec.get("pages")   or ""
            s = f"{authors} ({year}). {title}. *{journal}*"
            if vol:
                s += f", *{vol}*"
                if issue: s += f"({issue})"
            if pages: s += f", {pages}"
            s += "."
        if doi: s += f" https://doi.org/{doi}"
        return s

    def _render_mla(self, rec: Dict) -> str:
        authors = self._format_authors_mla(rec["authors"]) or "Unknown"
        title   = f'"{rec.get("title", "Untitled")}"'
        journal = rec.get("journal") or ""
        vol     = rec.get("volume")  or ""
        issue   = rec.get("issue")   or ""
        year    = rec.get("year")    or "n.d."
        pages   = rec.get("pages")   or ""

        if rec.get("type") == "book":
            pub = rec.get("publisher") or ""
            s = f"{authors}. *{rec.get('title', 'Untitled')}*. {pub}, {year}."
        else:
            s = f"{authors}. {title}. *{journal}*"
            if vol:
                s += f", vol. {vol}"
                if issue: s += f", no. {issue}"
            s += f" ({year})"
            if pages: s += f": {pages}"
            s += "."
        return s

    def _render_ieee(self, rec: Dict) -> str:
        authors = self._format_authors_ieee(rec["authors"]) or "Unknown"
        title   = f'"{rec.get("title", "Untitled")},"'
        journal = rec.get("journal") or ""
        vol     = rec.get("volume")  or ""
        issue   = rec.get("issue")   or ""
        year    = rec.get("year")    or "n.d."
        pages   = rec.get("pages")   or ""
        doi     = rec.get("doi")

        parts = [authors + ",", title]
        if journal: parts.append(f"*{journal}*,")
        if vol:
            vn = f"vol. {vol}"
            if issue: vn += f", no. {issue}"
            parts.append(vn + ",")
        if pages: parts.append(f"pp. {pages},")
        parts.append(year + ".")
        if doi: parts.append(f"doi: {doi}.")
        return " ".join(parts)

    def _render_chicago(self, rec: Dict) -> str:
        authors  = self._format_authors_chicago(rec["authors"]) or "Unknown"
        title    = rec.get("title", "Untitled")
        year     = rec.get("year")    or "n.d."
        journal  = rec.get("journal") or ""
        vol      = rec.get("volume")  or ""
        issue    = rec.get("issue")   or ""
        pages    = rec.get("pages")   or ""
        pub      = rec.get("publisher") or ""
        location = rec.get("location")  or ""
        doi      = rec.get("doi")

        if rec.get("type") == "book":
            s = f"{authors}. *{title}*."
            if location: s += f" {location}:"
            if pub: s += f" {pub},"
            s += f" {year}."
        else:
            s = f'{authors}. "{title}." *{journal}*'
            if vol:
                s += f" {vol}"
                if issue: s += f", no. {issue}"
            s += f" ({year})"
            if pages: s += f": {pages}"
            s += "."
        if doi: s += f" https://doi.org/{doi}."
        return s

    def _render_harvard(self, rec: Dict) -> str:
        authors  = self._format_authors_harvard(rec["authors"]) or "Unknown"
        year     = rec.get("year")    or "n.d."
        title    = rec.get("title",  "Untitled")
        journal  = rec.get("journal") or ""
        vol      = rec.get("volume")  or ""
        issue    = rec.get("issue")   or ""
        pages    = rec.get("pages")   or ""
        pub      = rec.get("publisher") or ""
        doi      = rec.get("doi")

        if rec.get("type") == "book":
            s = f"{authors} ({year}) *{title}*."
            if pub: s += f" {pub}."
        else:
            s = f"{authors} ({year}) '{title}', *{journal}*"
            if vol:
                s += f", vol. {vol}"
                if issue: s += f", no. {issue}"
            if pages: s += f", pp. {pages}"
            s += "."
        if doi: s += f" doi:{doi}."
        return s

    # ------------------------------------------------------------------
    # Author formatters
    # ------------------------------------------------------------------

    def _parse_authors_apa(self, raw: str) -> List[str]:
        """Split APA author string into individual 'Last, First' entries.
        Handles abbreviated (Last, F.) and full-name (Last, First) formats,
        with authors separated by ', ' and the final pair joined by ' & ' or ' and '.
        """
        raw = raw.strip().rstrip(',').strip()
        # Normalise '&' and 'and' connectors into an unambiguous delimiter
        raw = re.sub(r',?\s*&\s*', '|||', raw)
        raw = re.sub(r',?\s+and\s+(?=[A-Z])', '|||', raw)
        segments = raw.split('|||')
        authors: List[str] = []
        for seg in segments:
            # Within each segment split only at ', ' that is followed by a new
            # 'Lastname, ' pattern (capital word followed by comma) so that
            # 'Smith, John' is NOT split at the comma before 'John'.
            sub = re.split(r',\s+(?=[A-Z][a-z\'-]+\s*,)', seg)
            for s in sub:
                s = s.strip().rstrip(',').strip()
                if s:
                    authors.append(s)
        return authors

    def _format_authors_apa(self, authors: List[str]) -> str:
        if not authors: return ""
        if len(authors) == 1: return authors[0]
        if len(authors) <= 6:
            return ", ".join(authors[:-1]) + ", & " + authors[-1]
        return ", ".join(authors[:6]) + ", … " + authors[-1]

    def _format_authors_mla(self, authors: List[str]) -> str:
        if not authors: return ""
        if len(authors) == 1: return authors[0]
        if len(authors) == 2: return f"{authors[0]}, and {authors[1]}"
        return f"{authors[0]}, et al."

    def _format_authors_ieee(self, authors: List[str]) -> str:
        """Convert Last, First → F. Last for IEEE."""
        formatted = []
        for a in authors[:6]:
            m = re.match(r"([A-Za-z'-]+),\s*([A-Z][a-z]*)(?:\s*([A-Z])\.?)?", a)
            if m:
                initials = m.group(2)[0] + "."
                if m.group(3): initials += " " + m.group(3) + "."
                formatted.append(f"{initials} {m.group(1)}")
            else:
                formatted.append(a)
        if len(authors) > 6:
            formatted.append("et al.")
        return ", ".join(formatted)

    def _format_authors_chicago(self, authors: List[str]) -> str:
        if not authors: return ""
        if len(authors) == 1: return authors[0]
        return authors[0] + ", and " + " ".join(a.split(",")[0].strip() for a in authors[1:])

    def _format_authors_harvard(self, authors: List[str]) -> str:
        """Last, F.I. and Last, F.I."""
        parts = []
        for a in authors:
            m = re.match(r"([A-Za-z'-]+),\s*([A-Z])", a)
            if m:
                parts.append(f"{m.group(1)}, {m.group(2)}.")
            else:
                parts.append(a)
        if len(parts) <= 2:
            return " and ".join(parts)
        return ", ".join(parts[:-1]) + " and " + parts[-1]

    # ------------------------------------------------------------------
    # In-text citation helpers
    # ------------------------------------------------------------------

    def _author_date_to_numbered(self, text: str, ref_list: List[Dict]) -> str:
        """Replace (Author, Year) with [N] using the ordered reference list."""
        number_map = {}
        for i, ref in enumerate(ref_list, 1):
            parsed = ref.get("parsed") or self._parse(ref.get("original", ""), "unknown")
            if parsed["authors"] and parsed["year"]:
                last_name = parsed["authors"][0].split(",")[0].strip()
                key = f"{last_name},{parsed['year']}"
                number_map[key] = i

        def replace_match(m):
            author = m.group(1).strip()
            year   = m.group(2).strip()
            key = f"{author},{year}"
            n = number_map.get(key)
            return f"[{n}]" if n else m.group(0)

        return re.sub(r"\(([A-Za-z][a-z'-]+(?:\s+et\s+al\.)?),\s*(\d{4}[a-z]?)\)", replace_match, text)

    def _numbered_to_author_date(self, text: str, ref_list: List[Dict], style: str) -> str:
        """Replace [N] with (Author, Year)."""
        index_map = {}
        for i, ref in enumerate(ref_list, 1):
            parsed = ref.get("parsed") or self._parse(ref.get("original", ""), "IEEE")
            if parsed["authors"] and parsed["year"]:
                last_name = parsed["authors"][0].split(",")[0].strip() if "," in parsed["authors"][0] else parsed["authors"][0].split()[-1]
                index_map[i] = (last_name, parsed["year"])

        def replace_match(m):
            n = int(m.group(1))
            info = index_map.get(n)
            if not info:
                return m.group(0)
            author, year = info
            if style in ("APA", "Chicago"):
                return f"({author}, {year})"
            return f"({author} {year})"

        return re.sub(r"\[(\d+)\]", replace_match, text)

    def _normalise_author_date(self, text: str, target_style: str) -> str:
        """Reformat author-date in-text citations into the target style."""
        # (Smith, 2020) → (Smith 2020) for Harvard/MLA
        if target_style in ("Harvard", "MLA"):
            text = re.sub(r"\(([A-Za-z][a-z'-]+(?:\s+et\s+al\.)?),\s*(\d{4}[a-z]?)\)",
                          lambda m: f"({m.group(1)} {m.group(2)})", text)
        # (Smith 2020) → (Smith, 2020) for APA/Chicago
        elif target_style in ("APA", "Chicago"):
            text = re.sub(r"\(([A-Za-z][a-z'-]+(?:\s+et\s+al\.)?)\s+(\d{4}[a-z]?)\)",
                          lambda m: f"({m.group(1)}, {m.group(2)})", text)
        return text

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def _split_references(self, text: str) -> List[str]:
        """Split a references block into individual entries.

        Handles three layouts:
        1. Blank-line-separated blocks (well-formatted text).
        2. IEEE [N]-marker-separated entries.
        3. Single-spaced lists (e.g., DOCX output) where each entry starts
           with 'Lastname, ' on a new line immediately after a sentence end.
        """
        text = text.strip()
        if not text:
            return []

        # 1. Blank-line-separated blocks
        blocks = re.split(r"\n\s*\n", text)
        if len(blocks) >= 2:
            return [b.replace("\n", " ").strip() for b in blocks if b.strip()]

        # 2. IEEE [N] markers
        if re.search(r"^\s*\[\d+\]", text, re.MULTILINE):
            parts = re.split(r"(?=^\s*\[\d+\])", text, flags=re.MULTILINE)
            return [p.replace("\n", " ").strip() for p in parts if p.strip()]

        # 3. Single-spaced: detect entry boundary heuristically.
        # Fast path: if ≥60 % of non-empty lines already start with an
        # author/bracket pattern, each line is its own complete entry
        # (typical DOCX output where every paragraph is one reference).
        non_empty = [l.strip() for l in text.splitlines() if l.strip()]
        if not non_empty:
            return []
        _start_re = re.compile(
            r"^(?:"
            r"\[\d+\]"                          # [1] IEEE bracket
            r"|[A-Z][a-z'-]+,\s*"               # Last, …  (APA/MLA/Harvard)
            r"|[A-Z]\.\s+[A-Z][a-z'-]+"         # F. Last   (IEEE author-first)
            r"|\d{1,3}\.\s+[A-Z]"              # 1. Numbered list
            r")"
        )
        density = sum(1 for l in non_empty if _start_re.match(l)) / len(non_empty)
        if density >= 0.55:
            # Each line is a self-contained entry
            return non_empty

        # Slow path: multi-line entries joined across lines.
        # A new entry is signalled when the current line starts with the
        # author pattern AND the previous accumulated line ended with a
        # sentence-ending character OR ended with a URL (no punct).
        lines = text.splitlines()
        entries: List[str] = []
        current: List[str] = []
        entry_start_re = re.compile(r"^[A-Z][a-z'-]+,\s*")
        end_chars = set('.);]"\'')

        def _looks_like_entry_end(s: str) -> bool:
            """True when s ends with sentence punctuation OR a URL segment."""
            return bool(s) and (
                s[-1] in end_chars
                or re.search(r"https?://\S+$", s)
                or re.search(r"\b(?:19|20)\d{2}\b\.?$", s)
            )

        for line in lines:
            stripped = line.strip()
            if not stripped:
                if current:
                    entries.append(" ".join(current))
                    current = []
                continue
            if (current
                    and entry_start_re.match(stripped)
                    and _looks_like_entry_end(current[-1])):
                entries.append(" ".join(current))
                current = [stripped]
            else:
                current.append(stripped)

        if current:
            entries.append(" ".join(current))

        return entries if entries else [text]

    def _section_heading(self, style: str) -> str:
        headings = {
            "APA":     "References",
            "MLA":     "Works Cited",
            "IEEE":    "References",
            "Chicago": "Bibliography",
            "Harvard": "Reference List",
        }
        return headings.get(style, "References")
