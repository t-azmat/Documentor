"""
LaTeX Generator - AI Formatting Pipeline (Step 4)
Converts structured document content into valid LaTeX source code
styled according to the selected citation/formatting style.

Each style maps to different:
  - Document class & options
  - Bibliography package (biblatex backend + style, or plain natbib)
  - Section heading commands
  - In-text citation commands
"""

import re
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Style → LaTeX configuration
# ---------------------------------------------------------------------------
STYLE_CONFIGS: Dict[str, Dict] = {
    "APA": {
        "documentclass":  r"\documentclass[12pt, a4paper]{article}",
        "packages": [
            r"\usepackage[T1]{fontenc}",
            r"\usepackage[utf8]{inputenc}",
            r"\usepackage{times}",
            r"\usepackage[margin=1in]{geometry}",
            r"\usepackage{setspace}",
            r"\usepackage{indentfirst}",
            r"\usepackage[style=apa,backend=biber]{biblatex}",
            r"\usepackage{hyperref}",
        ],
        "preamble_extra": r"\doublespacing" + "\n" + r"\setlength{\parindent}{0.5in}",
        "cite_command":   r"\parencite",
        "biblio_cmd":     r"\printbibliography",
        "biblio_title":   "References",
    },
    "MLA": {
        "documentclass":  r"\documentclass[12pt, a4paper]{article}",
        "packages": [
            r"\usepackage[T1]{fontenc}",
            r"\usepackage[utf8]{inputenc}",
            r"\usepackage{times}",
            r"\usepackage[margin=1in]{geometry}",
            r"\usepackage{setspace}",
            r"\usepackage[style=mla,backend=biber]{biblatex}",
            r"\usepackage{hyperref}",
        ],
        "preamble_extra": r"\doublespacing",
        "cite_command":   r"\parencite",
        "biblio_cmd":     r"\printbibliography[title={Works Cited}]",
        "biblio_title":   "Works Cited",
    },
    "IEEE": {
        "documentclass":  r"\documentclass[10pt, conference]{IEEEtran}",
        "packages": [
            r"\usepackage[T1]{fontenc}",
            r"\usepackage[utf8]{inputenc}",
            r"\usepackage{cite}",
            r"\usepackage{amsmath}",
            r"\usepackage{graphicx}",
            r"\usepackage{hyperref}",
        ],
        "preamble_extra": "",
        "cite_command":   r"\cite",
        "biblio_cmd":     r"\bibliographystyle{IEEEtran}",
        "biblio_title":   "References",
    },
    "Chicago": {
        "documentclass":  r"\documentclass[12pt, a4paper]{article}",
        "packages": [
            r"\usepackage[T1]{fontenc}",
            r"\usepackage[utf8]{inputenc}",
            r"\usepackage{times}",
            r"\usepackage[margin=1in]{geometry}",
            r"\usepackage{setspace}",
            r"\usepackage[style=chicago-authordate,backend=biber]{biblatex}",
            r"\usepackage{hyperref}",
        ],
        "preamble_extra": r"\doublespacing" + "\n" + r"\setlength{\parindent}{0.5in}",
        "cite_command":   r"\parencite",
        "biblio_cmd":     r"\printbibliography[title={Bibliography}]",
        "biblio_title":   "Bibliography",
    },
    "Harvard": {
        "documentclass":  r"\documentclass[12pt, a4paper]{article}",
        "packages": [
            r"\usepackage[T1]{fontenc}",
            r"\usepackage[utf8]{inputenc}",
            r"\usepackage{times}",
            r"\usepackage[margin=1in]{geometry}",
            r"\usepackage{setspace}",
            r"\usepackage[style=authoryear,backend=biber]{biblatex}",
            r"\usepackage{hyperref}",
        ],
        "preamble_extra": r"\doublespacing",
        "cite_command":   r"\parencite",
        "biblio_cmd":     r"\printbibliography[title={Reference List}]",
        "biblio_title":   "Reference List",
    },
}

# Section type → LaTeX command
SECTION_COMMANDS: Dict[str, str] = {
    "abstract":        "abstract",    # special environment
    "introduction":    "section",
    "literature":      "section",
    "methodology":     "section",
    "results":         "section",
    "discussion":      "section",
    "conclusion":      "section",
    "references":      None,          # handled by \printbibliography
    "acknowledgements":"section*",
    "appendix":        "appendix",
    "unknown":         "section",
}

SECTION_TITLES: Dict[str, str] = {
    "abstract":        "Abstract",
    "introduction":    "Introduction",
    "literature":      "Literature Review",
    "methodology":     "Methodology",
    "results":         "Results",
    "discussion":      "Discussion",
    "conclusion":      "Conclusion",
    "acknowledgements":"Acknowledgements",
    "appendix":        "Appendix",
}


class LaTeXGenerator:
    """
    Generates a compilable LaTeX document from structured content.
    """

    def generate(
        self,
        title: str,
        authors: List[str],
        abstract: str,
        sections: List[Dict] = None,           # flat list {section_type, heading, text}
        references_latex: str = "",            # pre-formatted bibliography entries
        style: str = "APA",
        extra_metadata: Optional[Dict] = None,
        section_tree: Optional[Dict] = None,   # nested tree from DocumentChunker.build_tree()
    ) -> str:
        """
        Build and return the full LaTeX source string.

        Parameters
        ----------
        title            : Document title
        authors          : List of author strings
        abstract         : Abstract text
        sections         : Ordered list of section dicts from the chunker/formatter
        references_latex : LaTeX-formatted bibliography entries (\\bibitem or BibTeX)
        style            : Target citation style
        extra_metadata   : Optional dict with 'date', 'institution', 'keywords'
        """
        cfg = STYLE_CONFIGS.get(style, STYLE_CONFIGS["APA"])
        meta = extra_metadata or {}

        parts: List[str] = []

        # ---- Preamble ----
        parts.append(cfg["documentclass"])
        parts.append("")
        for pkg in cfg["packages"]:
            parts.append(pkg)
        if cfg["preamble_extra"]:
            parts.append("")
            parts.append(cfg["preamble_extra"])

        # ---- Title / author block ----
        parts.append("")
        parts.append(r"\title{" + self._escape(title) + "}")
        author_str = " \\and ".join(self._escape(a) for a in authors) if authors else "Author"
        parts.append(r"\author{" + author_str + "}")
        parts.append(r"\date{" + self._escape(meta.get("date", r"\today")) + "}")
        if meta.get("institution"):
            parts.append(r"\thanks{" + self._escape(meta["institution"]) + "}")

        # ---- Begin document ----
        parts.append("")
        parts.append(r"\begin{document}")
        parts.append(r"\maketitle")

        # ---- Abstract ----
        if abstract:
            parts.append("")
            parts.append(r"\begin{abstract}")
            parts.append(self._clean_text(abstract))
            parts.append(r"\end{abstract}")
            if meta.get("keywords"):
                parts.append(r"\noindent\textbf{Keywords:} " + self._escape(meta["keywords"]))

        # ---- Sections ----
        in_appendix = False
        if section_tree and section_tree.get("sections"):
            # Nested tree path — recursive rendering preserves full hierarchy
            for node in section_tree["sections"]:
                if node.get("section_type") == "appendix" and not in_appendix:
                    parts.append("")
                    parts.append(r"\appendix")
                    in_appendix = True
                parts.extend(self._render_section_node(node, cfg))
        else:
            # Flat list fallback — backwards compatible
            for sec in (sections or []):
                stype   = sec.get("section_type", "unknown")
                heading = sec.get("heading") or SECTION_TITLES.get(stype, stype.title())
                text    = sec.get("text", "")

                if stype in ("references", "abstract"):
                    continue

                if stype == "appendix" and not in_appendix:
                    parts.append("")
                    parts.append(r"\appendix")
                    in_appendix = True

                cmd = SECTION_COMMANDS.get(stype, "section")
                parts.append("")
                parts.append(f"\\{cmd}{{{self._escape(heading)}}}")
                parts.append(self._body_to_latex(text, cfg["cite_command"]))

        # ---- Bibliography ----
        parts.append("")
        if references_latex.strip():
            if style == "IEEE":
                parts.append(r"\begin{thebibliography}{99}")
                for line in references_latex.strip().splitlines():
                    if line.strip():
                        parts.append(line)
                parts.append(r"\end{thebibliography}")
            else:
                parts.append(cfg["biblio_cmd"])
        else:
            parts.append(f"% No references provided")

        parts.append("")
        parts.append(r"\end{document}")

        return "\n".join(parts)

    def sections_to_bibitems(self, entries: List[Dict], style: str) -> str:
        """
        Convert parsed reference entries into \\bibitem blocks for IEEE
        or BibTeX-style \addbibresource content for biblatex styles.
        """
        lines: List[str] = []
        for i, entry in enumerate(entries, 1):
            rec = entry.get("parsed", {})
            key = self._make_cite_key(rec, i)
            converted = entry.get("converted", rec.get("raw", ""))

            if style == "IEEE":
                lines.append(f"\\bibitem{{{key}}}")
                lines.append(converted)
            else:
                # Emit a minimal @article/@book for biblatex
                btype = "book" if rec.get("type") == "book" else "article"
                lines.append(f"@{btype}{{{key},")
                if rec.get("authors"):
                    lines.append(f"  author  = {{{' and '.join(rec['authors'])}}},")
                if rec.get("year"):    lines.append(f"  year    = {{{rec['year']}}},")
                if rec.get("title"):   lines.append(f"  title   = {{{self._escape(rec['title'])}}},")
                if rec.get("journal"): lines.append(f"  journal = {{{self._escape(rec['journal'])}}},")
                if rec.get("volume"):  lines.append(f"  volume  = {{{rec['volume']}}},")
                if rec.get("issue"):   lines.append(f"  number  = {{{rec['issue']}}},")
                if rec.get("pages"):   lines.append(f"  pages   = {{{rec['pages']}}},")
                if rec.get("doi"):     lines.append(f"  doi     = {{{rec['doi']}}},")
                if rec.get("publisher"): lines.append(f"  publisher = {{{rec['publisher']}}},")
                lines.append("}")
            lines.append("")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _escape(self, text: str) -> str:
        """Escape LaTeX special characters (basic set)."""
        if not text:
            return ""
        replacements = [
            ("\\", r"\textbackslash{}"),
            ("&",  r"\&"),
            ("%",  r"\%"),
            ("$",  r"\$"),
            ("#",  r"\#"),
            ("_",  r"\_"),
            ("{",  r"\{"),
            ("}",  r"\}"),
            ("~",  r"\textasciitilde{}"),
            ("^",  r"\textasciicircum{}"),
        ]
        for old, new in replacements:
            text = text.replace(old, new)
        return text

    def _clean_text(self, text: str) -> str:
        """Light cleanup + escape for body text."""
        # Remove markdown-style bold/italic markers
        text = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", text)
        text = re.sub(r"\*(.+?)\*",     r"\\textit{\1}", text)
        # Escape LaTeX specials (except already-inserted commands)
        lines = []
        for line in text.splitlines():
            if line.strip():
                lines.append(self._escape(line))
            else:
                lines.append("")
        # Collapse multiple blank lines
        result = re.sub(r"\n{3,}", "\n\n", "\n".join(lines))
        return result

    def _body_to_latex(self, text: str, cite_cmd: str) -> str:
        """Convert plain body text to LaTeX paragraphs."""
        if not text:
            return ""

        cleaned = self._clean_text(text)

        # Convert (Author, Year) / (Author Year) inline citations
        cleaned = re.sub(
            r"\(([A-Za-z][a-z'-]+(?:\s+et\s+al\.)?),?\s*(\d{4}[a-z]?)\)",
            lambda m: f"{cite_cmd}{{{m.group(1).lower()}{m.group(2)}}}",
            cleaned,
        )
        # Convert [N] numbered citations
        cleaned = re.sub(r"\[(\d+)\]", r"\\cite{ref\1}", cleaned)

        return cleaned

    def _render_section_node(self, node: Dict, cfg: Dict) -> List[str]:
        """
        Recursively render a nested section node (from DocumentChunker.build_tree())
        into a list of LaTeX source lines.

        Level mapping:  1 → \\section  |  2 → \\subsection  |  3 → \\subsubsection
        """
        level   = node.get("level", 1)
        heading = node.get("heading", "")
        text    = (node.get("text") or "").strip()
        stype   = node.get("section_type", "unknown")

        LEVEL_CMDS = {1: "section", 2: "subsection", 3: "subsubsection"}
        cmd = LEVEL_CMDS.get(min(level, 3), "paragraph")
        if stype == "acknowledgements":
            cmd = "section*"

        lines: List[str] = ["", f"\\{cmd}{{{self._escape(heading)}}}"]
        if text:
            lines.append(self._body_to_latex(text, cfg["cite_command"]))
        for sub in node.get("subsections", []):
            lines.extend(self._render_section_node(sub, cfg))
        return lines

    def _make_cite_key(self, rec: Dict, fallback_index: int) -> str:
        last = ""
        if rec.get("authors"):
            last = re.sub(r"[^A-Za-z]", "", rec["authors"][0].split(",")[0])
        year  = re.sub(r"\D", "", rec.get("year", ""))
        title = re.sub(r"\W", "", (rec.get("title") or "")[:8]).lower()
        if last and year:
            return f"{last}{year}{title}"
        return f"ref{fallback_index}"
