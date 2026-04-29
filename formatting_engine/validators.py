"""Schema and post-render validation for the formatting pipeline."""

from __future__ import annotations

import re
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Tuple
from xml.etree import ElementTree


def validate_layout_contract(
    layout_plan: Dict[str, Any],
    snippets: Dict[str, str],
    ir: Dict[str, Any],
) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []

    metadata = layout_plan.get("metadata")
    if not isinstance(metadata, dict):
        errors.append("Layout plan is missing metadata.")
    elif not str(metadata.get("title") or "").strip():
        warnings.append("Layout plan metadata has no title.")

    sections = layout_plan.get("sections")
    if not isinstance(sections, list) or not sections:
        errors.append("Layout plan contains no sections.")
        sections = []

    seen_subsection_ids: set[str] = set()
    paragraph_count = 0
    for section_index, section in enumerate(sections, start=1):
        if not isinstance(section, dict):
            errors.append(f"Section {section_index} is not an object.")
            continue
        subsections = section.get("subsections")
        if not isinstance(subsections, list) or not subsections:
            warnings.append(f"Section {section_index} has no subsections.")
            continue
        for subsection_index, subsection in enumerate(subsections, start=1):
            if not isinstance(subsection, dict):
                errors.append(f"Section {section_index} subsection {subsection_index} is not an object.")
                continue
            subsection_id = str(subsection.get("id") or "").strip()
            if not subsection_id:
                errors.append(f"Section {section_index} subsection {subsection_index} has no id.")
                continue
            if subsection_id in seen_subsection_ids:
                errors.append(f"Duplicate subsection id: {subsection_id}.")
            seen_subsection_ids.add(subsection_id)
            if subsection_id not in snippets:
                errors.append(f"Missing snippet for subsection id: {subsection_id}.")

            paragraphs = subsection.get("paragraphs") or []
            paragraph_formats = subsection.get("paragraph_formats") or []
            if not isinstance(paragraphs, list):
                errors.append(f"Subsection {subsection_id} paragraphs must be a list.")
                continue
            paragraph_count += len(paragraphs)
            if paragraph_formats and len(paragraph_formats) != len(paragraphs):
                warnings.append(
                    f"Subsection {subsection_id} has {len(paragraph_formats)} paragraph formats for {len(paragraphs)} paragraphs."
                )
            heading_level = subsection.get("heading_level", 1)
            try:
                heading_level = int(heading_level)
            except Exception:
                errors.append(f"Subsection {subsection_id} has a non-numeric heading level.")
                continue
            if heading_level < 1 or heading_level > 6:
                errors.append(f"Subsection {subsection_id} heading level is outside 1-6.")

    for snippet_id, snippet in snippets.items():
        if snippet_id not in seen_subsection_ids:
            warnings.append(f"Unused snippet emitted for subsection id: {snippet_id}.")
        if not isinstance(snippet, str) or not snippet.strip().startswith("["):
            errors.append(f"Snippet {snippet_id} is not an array literal.")

    source_paragraphs = sum(len(section.get("paragraphs") or []) for section in ir.get("sections") or [])
    if source_paragraphs and paragraph_count < max(1, int(source_paragraphs * 0.65)):
        warnings.append(
            f"Layout plan retains {paragraph_count} paragraphs from {source_paragraphs} extracted paragraphs."
        )

    return errors, warnings


def validate_rendered_docx(
    docx_path: Path,
    layout_plan: Dict[str, Any],
    ir: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[str]]:
    warnings: List[str] = []
    report: Dict[str, Any] = {
        "docx_path": str(docx_path),
        "exists": docx_path.exists(),
        "valid_zip": False,
        "paragraph_count": 0,
        "table_count": 0,
        "text_chars": 0,
        "checks": {},
    }
    if not docx_path.exists():
        return report, ["Rendered DOCX was not created."]

    try:
        with zipfile.ZipFile(docx_path) as archive:
            names = set(archive.namelist())
            report["valid_zip"] = True
            if "word/document.xml" not in names:
                warnings.append("Rendered DOCX is missing word/document.xml.")
                return report, warnings
            xml = archive.read("word/document.xml")
    except Exception as exc:
        warnings.append(f"Rendered DOCX is not readable: {exc}")
        return report, warnings

    try:
        root = ElementTree.fromstring(xml)
    except Exception as exc:
        warnings.append(f"Rendered DOCX XML is not parseable: {exc}")
        return report, warnings

    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = root.findall(".//w:p", namespace)
    tables = root.findall(".//w:tbl", namespace)
    texts = [node.text or "" for node in root.findall(".//w:t", namespace)]
    rendered_text = " ".join(texts)
    normalized_rendered = _normalize_text(rendered_text)

    report["paragraph_count"] = len(paragraphs)
    report["table_count"] = len(tables)
    report["text_chars"] = len(rendered_text)

    expected_title = str((layout_plan.get("metadata") or {}).get("title") or "").strip()
    if expected_title:
        title_present = _normalize_text(expected_title) in normalized_rendered
        report["checks"]["title_present"] = title_present
        if not title_present:
            warnings.append("Rendered DOCX does not contain the expected title.")

    expected_sections = [
        str(section.get("title") or "").strip()
        for section in layout_plan.get("sections") or []
        if str(section.get("title") or "").strip()
    ]
    missing_sections = [
        title for title in expected_sections if _normalize_text(title) not in normalized_rendered
    ]
    report["checks"]["missing_section_titles"] = missing_sections[:20]
    if missing_sections:
        warnings.append(f"Rendered DOCX is missing {len(missing_sections)} planned section title(s).")

    source_paragraphs = sum(len(section.get("paragraphs") or []) for section in ir.get("sections") or [])
    planned_paragraphs = sum(
        len(subsection.get("paragraphs") or [])
        for section in layout_plan.get("sections") or []
        for subsection in section.get("subsections") or []
    )
    report["checks"]["source_paragraphs"] = source_paragraphs
    report["checks"]["planned_paragraphs"] = planned_paragraphs
    if source_paragraphs and planned_paragraphs < max(1, int(source_paragraphs * 0.65)):
        warnings.append("Rendered plan appears to have dropped a large share of extracted paragraphs.")

    if report["paragraph_count"] <= 1 or report["text_chars"] < 100:
        warnings.append("Rendered DOCX appears unexpectedly sparse.")

    return report, warnings


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()
