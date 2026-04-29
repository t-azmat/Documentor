"""Guideline document extraction for user-supplied formatting guides."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List


def extract_guideline_rules(path: str, max_chars: int = 12000) -> Dict[str, Any]:
    source_path = Path(path).expanduser().resolve()
    text = _extract_text(source_path)
    compact = _compact_guideline_text(text, max_chars=max_chars)
    return {
        "source_path": str(source_path),
        "source_name": source_path.name,
        "text_chars": len(text),
        "summary_text": compact,
        "heading_rules": _extract_heading_rules(text),
        "formatting_rules": _extract_formatting_rules(text),
    }


def _extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        import pdfplumber

        with pdfplumber.open(path) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    if suffix == ".docx":
        from docx import Document

        document = Document(str(path))
        return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
    return path.read_text(encoding="utf-8", errors="replace")


def _compact_guideline_text(text: str, max_chars: int) -> str:
    lines = [re.sub(r"\s+", " ", line).strip() for line in str(text or "").splitlines()]
    interesting = [
        line
        for line in lines
        if line
        and (
            re.search(r"\b(?:heading|title page|abstract|reference|font|margin|spacing|indent|page number|running head|level\s+\d|student paper|professional paper)\b", line, re.I)
            or re.search(r"\b(?:APA|IEEE|MLA|Chicago|Harvard)\b", line)
        )
    ]
    compact = "\n".join(interesting or lines)
    return compact[:max_chars].strip()


def _extract_heading_rules(text: str) -> List[str]:
    rules: List[str] = []
    for line in str(text or "").splitlines():
        clean = re.sub(r"\s+", " ", line).strip()
        if not clean:
            continue
        if re.search(r"\b(?:heading|level\s+[1-5])\b", clean, re.I):
            rules.append(clean)
    return _dedupe(rules)[:40]


def _extract_formatting_rules(text: str) -> List[str]:
    rules: List[str] = []
    for line in str(text or "").splitlines():
        clean = re.sub(r"\s+", " ", line).strip()
        if not clean:
            continue
        if re.search(r"\b(?:font|margin|spacing|indent|title page|abstract|reference|page number|running head)\b", clean, re.I):
            rules.append(clean)
    return _dedupe(rules)[:80]


def _dedupe(values: List[str]) -> List[str]:
    seen = set()
    result = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result
