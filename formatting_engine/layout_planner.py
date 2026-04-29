"""Layout-planning stage powered by Groq or a deterministic fallback."""

from __future__ import annotations

import json
import asyncio
import re
import html
from typing import Any, Dict, List

from .config import get_env, get_env_list, load_style


LAYOUT_SYSTEM_PROMPT = (
    "You are an expert academic document layout analyst. You receive a "
    "structured IR of an academic paper and a target journal style. Produce "
    "a Layout Plan JSON. Output ONLY valid JSON - no explanation, no markdown fences."
)

CHAPTER_LAYOUT_SYSTEM_PROMPT = (
    "You are an academic document structure analyst. You receive ONE chapter "
    "or top-level section at a time. Return ONLY JSON. Do not rewrite, shorten, "
    "remove, or add document text. You only classify heading candidates; "
    "paragraph-like text has already been filtered out."
)

OUTLINE_SYSTEM_PROMPT = (
    "You are an academic document outline reconstructor. You receive extracted "
    "section candidates from a paper. Return ONLY JSON. Do not rewrite body text. "
    "Classify each candidate's hierarchy role so a deterministic formatter can style it."
)


async def build_layout_plan(
    ir: Dict[str, Any],
    target_style: str,
    custom_rules: Dict[str, Any] | None = None,
) -> tuple[Dict[str, Any], List[str]]:
    warnings: List[str] = []
    api_key = _configured_api_key("GROQ_API_KEY")
    anthropic_api_key = _configured_api_key("ANTHROPIC_API_KEY")
    style = load_style(target_style)
    max_payload_bytes = _int_env("GROQ_LAYOUT_MAX_PAYLOAD_BYTES", 350000)

    if _truthy_env("FORMATTING_ENGINE_LOCAL_ONLY"):
        warnings.append("FORMATTING_ENGINE_LOCAL_ONLY is enabled. Used deterministic layout-plan fallback.")
        return _fallback_layout_plan(ir, style, custom_rules=custom_rules), warnings

    if anthropic_api_key and _enabled_env("ANTHROPIC_OUTLINE_RECONSTRUCTOR", True):
        plan, anthropic_warnings = await _build_anthropic_outline_layout_plan(
            api_key=anthropic_api_key,
            ir=ir,
            style=style,
            custom_rules=custom_rules,
            max_payload_bytes=max_payload_bytes,
        )
        warnings.extend(anthropic_warnings)
        if plan:
            return plan, warnings

    if not api_key:
        warnings.append("GROQ_API_KEY is not configured. Used deterministic layout-plan fallback.")
        return _fallback_layout_plan(ir, style, custom_rules=custom_rules), warnings

    try:
        from groq import AsyncGroq

        client = AsyncGroq(api_key=api_key)
        models = get_env_list(
            "GROQ_LAYOUT_MODELS",
            default=[
                "llama-3.1-8b-instant",
                "meta-llama/llama-4-scout-17b-16e-instruct",
                "openai/gpt-oss-120b",
            ],
        )
        legacy_single = get_env("GROQ_LAYOUT_MODEL")
        if legacy_single:
            models = [legacy_single]

        if not models:
            models = ["llama-3.1-8b-instant"]

        if _enabled_env("GROQ_OUTLINE_RECONSTRUCTOR", True):
            plan, outline_warnings = await _build_outline_reconstructed_layout_plan(
                client=client,
                models=models,
                ir=ir,
                style=style,
                custom_rules=custom_rules,
                max_payload_bytes=max_payload_bytes,
            )
            warnings.extend(outline_warnings)
            return plan, warnings

        if _enabled_env("GROQ_CHAPTER_LAYOUT", True):
            plan, chapter_warnings = await _build_chapter_scoped_layout_plan(
                client=client,
                models=models,
                ir=ir,
                style=style,
                max_payload_bytes=max_payload_bytes,
            )
            warnings.extend(chapter_warnings)
            return plan, warnings

        compact_ir, compact_note = _compact_ir_for_layout(ir, max_payload_bytes)
        if compact_note:
            warnings.append(compact_note)

        request_payload = {
            "target_style": style["style"],
            "style_rules": style,
            "ir": compact_ir,
            "required_schema": _layout_schema_hint(),
        }
        request_payload_bytes = _payload_size_bytes(request_payload)
        if request_payload_bytes > max_payload_bytes:
            warnings.append(
                f"Layout payload still too large after compaction ({request_payload_bytes} bytes > {max_payload_bytes}); used deterministic fallback."
            )
            return _fallback_layout_plan(ir, style, custom_rules=custom_rules), warnings

        last_exc: Exception | None = None
        for model in models:
            try:
                response = await _create_chat_completion_with_retries(
                    client=client,
                    label=f"Layout model '{model}'",
                    warnings=warnings,
                    model=model,
                    temperature=0.1,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": LAYOUT_SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": json.dumps(request_payload, ensure_ascii=False),
                        },
                    ],
                )
                raw = response.choices[0].message.content or "{}"
                plan = json.loads(raw)
                if model != models[0]:
                    warnings.append(f"Layout inference succeeded using fallback model: {model}")
                return _merge_plan_defaults(plan, ir, style), warnings
            except Exception as exc:
                last_exc = exc
                if _is_payload_too_large_error(exc):
                    warnings.append(
                        f"Layout model '{model}' rejected payload as too large (413). Used deterministic fallback."
                    )
                    return _fallback_layout_plan(ir, style, custom_rules=custom_rules), warnings
                warnings.append(f"Layout model '{model}' failed: {exc}")

        raise RuntimeError(str(last_exc) if last_exc else "All layout models failed")
    except Exception as exc:
        warnings.append(f"Layout Understander call failed: {exc}. Used deterministic fallback.")
        return _fallback_layout_plan(ir, style, custom_rules=custom_rules), warnings


def _base_layout_plan(ir: Dict[str, Any], style: Dict[str, Any]) -> Dict[str, Any]:
    citation_counter = 1
    citation_map: Dict[str, str] = {}
    sections: List[Dict[str, Any]] = []

    for section_index, section in enumerate(ir.get("sections", []), start=1):
        source_paragraphs = section.get("paragraphs", []) or []
        paragraphs = [_convert_citations_deterministically(paragraph, style["citation_style"], citation_map, citation_counter) for paragraph in source_paragraphs]
        paragraph_formats = (section.get("paragraph_formats") or [{} for _ in source_paragraphs])[: len(paragraphs)]
        citation_counter = len(citation_map) + 1
        sections.append(
            {
                "id": f"section-{section_index}",
                "title": section.get("title", f"Section {section_index}"),
                "subsections": [
                    {
                        "id": f"section-{section_index}-body",
                        "title": section.get("title", f"Section {section_index}"),
                        "paragraphs": paragraphs,
                        "paragraph_formats": paragraph_formats,
                        "figures": section.get("figures", []),
                        "tables": section.get("tables", []),
                    }
                ],
            }
        )

    references = [
        {"index": index, "formatted": _format_reference_deterministically(reference, index, style["citation_style"])}
        for index, reference in enumerate(ir.get("references", []), start=1)
    ]

    return {
        "style": style["style"],
        "font": style["font"],
        "body_size_pt": style["body_size_pt"],
        "abstract_size_pt": style["abstract_size_pt"],
        "columns": style["columns"],
        "column_gap_inches": style["column_gap_inches"],
        "margin_inches": style["margin_inches"],
        "page_size": style["page_size"],
        "body_alignment": style.get("body_alignment", "left"),
        "line_spacing": style.get("line_spacing", 1.15),
        "paragraph_spacing_after_twips": style.get("paragraph_spacing_after_twips", 120),
        "first_line_indent_inches": style.get("first_line_indent_inches", 0.0),
        "reference_hanging_indent_inches": style.get("reference_hanging_indent_inches", 0.5),
        "metadata": {
            "title": ir["metadata"].get("title") or "Untitled Paper",
            "authors": ir["metadata"].get("authors", []),
            "affiliation": ir["metadata"].get("affiliation") or "",
            "abstract": ir["metadata"].get("abstract") or "",
            "keywords": ir["metadata"].get("keywords", []),
        },
        "section_rules": style["section_rules"],
        "citation_style": style["citation_style"],
        "preserve_source_format": _enabled_env("FORMATTING_ENGINE_PRESERVE_SOURCE_FORMAT", True),
        "citation_map": citation_map,
        "sections": sections,
        "references": references,
    }


def _fallback_layout_plan(
    ir: Dict[str, Any],
    style: Dict[str, Any],
    custom_rules: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    outline_plan = _deterministic_outline_plan(ir)
    if outline_plan.get("outline"):
        plan = _layout_from_outline(ir, style, outline_plan)
        _apply_deterministic_citation_conversion(plan, style)
        plan.setdefault("engine_report", {})["layout_mode"] = "deterministic_outline_reconstructor"
        if custom_rules:
            plan.setdefault("engine_report", {})["custom_guidelines"] = {
                "source_name": custom_rules.get("source_name"),
                "heading_rule_count": len(custom_rules.get("heading_rules") or []),
                "formatting_rule_count": len(custom_rules.get("formatting_rules") or []),
            }
        return plan
    return _base_layout_plan(ir, style)


def _deterministic_outline_plan(ir: Dict[str, Any]) -> Dict[str, Any]:
    outline: List[Dict[str, Any]] = []
    has_major = False
    for index, section in enumerate(ir.get("sections") or []):
        title = str(section.get("title") or f"Section {index + 1}").strip()
        normalized = _normalize_outline_title(title)
        if not normalized:
            continue

        if normalized in {"references", "bibliography", "works cited"}:
            role = "reference_heading"
        elif _looks_like_false_heading(title):
            role = "paragraph_false_positive"
        elif not has_major or _is_major_academic_section(normalized):
            role = "heading_1"
            has_major = True
        else:
            role = "heading_2"

        outline.append(
            {
                "section_index": index,
                "role": role,
                "parent_section_index": None,
                "normalized_title": title,
                "reason": "deterministic fallback",
            }
        )
    return {"outline": outline}


def _normalize_outline_title(title: str) -> str:
    value = re.sub(
        r"^\s*(?:[ivxlcdm]+\.|[a-z]\.|chapter\s+\d+\s*:|\d+(?:\.\d+)*\.?)\s*",
        "",
        str(title or ""),
        flags=re.I,
    )
    return re.sub(r"\s+", " ", value).strip(" .:-").lower()


def _is_major_academic_section(normalized_title: str) -> bool:
    return normalized_title in {
        "abstract",
        "introduction",
        "background",
        "related work",
        "literature review",
        "review of literature",
        "review of the literature",
        "method",
        "methods",
        "methodology",
        "materials and methods",
        "research methodology",
        "results",
        "findings",
        "discussion",
        "conclusion",
        "conclusions",
        "references",
        "bibliography",
        "works cited",
        "acknowledgment",
        "acknowledgments",
        "acknowledgement",
        "acknowledgements",
    }


def _looks_like_false_heading(title: str) -> bool:
    value = re.sub(r"\s+", " ", str(title or "").strip())
    lowered = value.lower()
    if not value:
        return True
    if value.startswith(('"', "'")) and value.endswith(('"', "'")):
        return True
    if value.endswith("?"):
        return True
    if re.match(r"^prediction\s*:", lowered):
        return True
    if re.search(r"[%~]|(?:accuracy|precision|recall|support|samples?)\s*:", lowered):
        return True
    if re.match(r"^(?:who|what|when|where|why|how|can|could|should|would|does|do|did|is|are|in what|to what)\b", lowered):
        return True
    if len(value.split()) > 11 and not _is_major_academic_section(_normalize_outline_title(value)):
        return True
    return False


def _looks_like_continuation(text: str) -> bool:
    value = str(text or "").strip()
    return bool(value) and value[:1].islower()


def _split_embedded_heading_subsections(
    section_id: str,
    section_title: str,
    paragraphs: List[str],
    paragraph_formats: List[Dict[str, Any]],
    figures: List[Any],
    tables: List[Any],
    first_heading_level: int = 1,
    start_index: int = 0,
) -> List[Dict[str, Any]]:
    heading_indexes = [
        index
        for index, paragraph in enumerate(paragraphs)
        if index > 0 and _is_embedded_heading_candidate(paragraph)
    ]
    if not heading_indexes:
        return [
            {
                "id": f"{section_id}-sub-{start_index + 1}",
                "title": section_title,
                "heading_level": first_heading_level,
                "layout_source": "outline_reconstructor",
                "paragraphs": list(paragraphs),
                "paragraph_formats": list(paragraph_formats),
                "figures": figures,
                "tables": tables,
            }
        ]

    subsections: List[Dict[str, Any]] = []
    first_heading = heading_indexes[0]
    if first_heading > 0:
        subsections.append(
            {
                "id": f"{section_id}-sub-{start_index + len(subsections) + 1}",
                "title": section_title,
                "heading_level": first_heading_level,
                "layout_source": "outline_reconstructor",
                "paragraphs": list(paragraphs[:first_heading]),
                "paragraph_formats": list(paragraph_formats[:first_heading]),
                "figures": figures,
                "tables": tables,
            }
        )

    for position, heading_index in enumerate(heading_indexes):
        next_heading = heading_indexes[position + 1] if position + 1 < len(heading_indexes) else len(paragraphs)
        body = list(paragraphs[heading_index + 1:next_heading])
        body_formats = list(paragraph_formats[heading_index + 1:next_heading])
        if not body:
            continue
        subsections.append(
            {
                "id": f"{section_id}-sub-{start_index + len(subsections) + 1}",
                "title": _normalize_candidate_text(paragraphs[heading_index]),
                "heading_level": min(first_heading_level + 1, 3),
                "layout_source": "deterministic_embedded_heading",
                "paragraphs": body,
                "paragraph_formats": body_formats,
                "figures": [],
                "tables": [],
            }
        )

    return subsections


def _is_embedded_heading_candidate(text: str) -> bool:
    value = _normalize_candidate_text(text)
    lowered = value.lower()
    if not _is_heading_candidate(value, max_chars=120, max_words=10):
        return False
    if re.match(r"^(?:o|[-*•])\s+", lowered):
        return False
    if re.search(r"[%~]|(?:accuracy|precision|recall|support|samples?|prediction)\s*:", lowered):
        return False
    if re.search(r":\s*(?:\d|~)", value):
        return False
    digit_count = sum(1 for char in value if char.isdigit())
    if digit_count >= 2:
        return False
    return True


def _convert_citations_deterministically(
    paragraph: str,
    citation_style: str,
    citation_map: Dict[str, str],
    next_index: int,
) -> str:
    converted = html.unescape(str(paragraph or ""))
    matches = re_findall(r"\(([^()]+?,\s*\d{4}[a-z]?)\)", converted)
    for match in matches:
        token = f"({match})"
        if token not in citation_map:
            if citation_style == "bracket_numbered":
                citation_map[token] = f"[{next_index}]"
            elif citation_style == "superscript":
                citation_map[token] = f"^{next_index}"
            else:
                citation_map[token] = token
            next_index += 1
        converted = converted.replace(token, citation_map[token])
    return converted


def _format_reference_deterministically(reference: str, index: int, citation_style: str) -> str:
    value = html.unescape(str(reference or "")).strip()
    value = re.sub(r"\s+", " ", value)
    if citation_style == "bracket_numbered":
        stripped = re.sub(r"^\s*\[\d+\]\s*", "", value)
        return f"[{index}] {stripped}".strip()
    return re.sub(r"^\s*(?:\[\d+\]|\d+[.)])\s*", "", value).strip()


def _merge_plan_defaults(plan: Dict[str, Any], ir: Dict[str, Any], style: Dict[str, Any]) -> Dict[str, Any]:
    merged = _base_layout_plan(ir, style)
    merged.update({key: value for key, value in plan.items() if value is not None})
    merged["metadata"].update(plan.get("metadata", {}))
    merged["section_rules"].update(plan.get("section_rules", {}))
    if plan.get("sections"):
        merged["sections"] = plan["sections"]
    if plan.get("references"):
        merged["references"] = plan["references"]
    if plan.get("citation_map"):
        merged["citation_map"] = plan["citation_map"]
    return merged


async def _build_outline_reconstructed_layout_plan(
    client: Any,
    models: List[str],
    ir: Dict[str, Any],
    style: Dict[str, Any],
    custom_rules: Dict[str, Any] | None,
    max_payload_bytes: int,
) -> tuple[Dict[str, Any], List[str]]:
    warnings: List[str] = []
    fallback = _fallback_layout_plan(ir, style)
    payload = _outline_payload(ir, style, custom_rules)
    payload_bytes = _payload_size_bytes(payload)
    if payload_bytes > max_payload_bytes:
        warnings.append(
            f"Outline payload too large ({payload_bytes} bytes > {max_payload_bytes}); used deterministic layout fallback."
        )
        return fallback, warnings

    outline_plan, outline_warnings = await _generate_outline_with_fallback(
        client=client,
        models=models,
        payload=payload,
    )
    warnings.extend(outline_warnings)
    if not outline_plan.get("outline"):
        warnings.append("Outline reconstructor returned no outline; used deterministic layout fallback.")
        return fallback, warnings

    plan = _layout_from_outline(ir, style, outline_plan)
    _apply_deterministic_citation_conversion(plan, style)
    warnings.append("Used LLM outline reconstructor for heading/subheading hierarchy; formatting remained rule-based.")
    return plan, warnings


async def _build_anthropic_outline_layout_plan(
    api_key: str,
    ir: Dict[str, Any],
    style: Dict[str, Any],
    custom_rules: Dict[str, Any] | None,
    max_payload_bytes: int,
) -> tuple[Dict[str, Any] | None, List[str]]:
    warnings: List[str] = []
    fallback = _fallback_layout_plan(ir, style)
    payload = _outline_payload(ir, style, custom_rules)
    payload_bytes = _payload_size_bytes(payload)
    if payload_bytes > max_payload_bytes:
        warnings.append(
            f"Claude outline payload too large ({payload_bytes} bytes > {max_payload_bytes}); trying next layout provider."
        )
        return None, warnings

    try:
        from anthropic import AsyncAnthropic  # type: ignore

        client = AsyncAnthropic(api_key=api_key)
        model = get_env("ANTHROPIC_LAYOUT_MODEL", "claude-3-5-haiku-latest")
        response = await client.messages.create(
            model=model,
            max_tokens=_int_env("ANTHROPIC_LAYOUT_MAX_TOKENS", 4096),
            temperature=0.0,
            system=OUTLINE_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=False),
                }
            ],
        )
        raw = _anthropic_text(response)
        outline_plan = json.loads(raw)
        if not outline_plan.get("outline"):
            warnings.append("Claude outline reconstructor returned no outline; trying next layout provider.")
            return None, warnings
        plan = _layout_from_outline(ir, style, outline_plan)
        _apply_deterministic_citation_conversion(plan, style)
        plan.setdefault("engine_report", {})["outline_provider"] = "anthropic"
        warnings.append("Used Claude only for heading/subheading role classification; rendering remained rule-based.")
        return plan, warnings
    except Exception as exc:
        warnings.append(f"Claude outline reconstructor failed: {exc}. Trying next layout provider.")
        return None, warnings


def _anthropic_text(response: Any) -> str:
    parts = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if text:
            parts.append(str(text))
    return "\n".join(parts).strip() or "{}"


def _outline_payload(
    ir: Dict[str, Any],
    style: Dict[str, Any],
    custom_rules: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    sections = ir.get("sections") or []
    candidates = []
    for index, section in enumerate(sections):
        paragraphs = section.get("paragraphs") or []
        previous_title = sections[index - 1].get("title") if index > 0 else ""
        next_title = sections[index + 1].get("title") if index + 1 < len(sections) else ""
        candidates.append(
            {
                "section_index": index,
                "title": _trim_text(str(section.get("title") or f"Section {index + 1}"), 180),
                "level_hint": int(section.get("level") or 1),
                "paragraph_count": len(paragraphs),
                "first_paragraph_sample": _trim_text(str(paragraphs[0] if paragraphs else ""), 360),
                "previous_title": _trim_text(str(previous_title or ""), 120),
                "next_title": _trim_text(str(next_title or ""), 120),
            }
        )
    return {
        "target_style": style["style"],
        "document_title": (ir.get("metadata") or {}).get("title") or "",
        "user_guidelines": _compact_custom_rules(custom_rules),
        "candidates": candidates,
        "allowed_roles": ["heading_1", "heading_2", "heading_3", "paragraph_false_positive", "reference_heading", "noise"],
        "required_schema": {
            "outline": [
                {
                    "section_index": 0,
                    "role": "heading_1",
                    "parent_section_index": None,
                    "normalized_title": "Introduction",
                    "reason": "short optional reason",
                }
            ]
        },
        "rules": [
            "Classify every candidate by section_index.",
            "Use heading_1 for major paper chapters such as Introduction, Literature Review, Methodology, Results, Discussion, Conclusion.",
            "Use heading_2 or heading_3 for subsections that belong under the nearest preceding heading_1.",
            "Use paragraph_false_positive for extracted titles that are really body questions, author/copyright text, or paragraph fragments.",
            "Do not output body paragraphs.",
            "Do not invent sections that are not in candidates.",
            "When user_guidelines are present, use them to decide heading levels and false heading cases, but never rewrite body text.",
        ],
    }


def _compact_custom_rules(custom_rules: Dict[str, Any] | None) -> Dict[str, Any] | None:
    if not custom_rules:
        return None
    return {
        "source_name": custom_rules.get("source_name"),
        "summary_text": _trim_text(str(custom_rules.get("summary_text") or ""), 6000),
        "heading_rules": (custom_rules.get("heading_rules") or [])[:30],
        "formatting_rules": (custom_rules.get("formatting_rules") or [])[:40],
    }


async def _generate_outline_with_fallback(
    client: Any,
    models: List[str],
    payload: Dict[str, Any],
) -> tuple[Dict[str, Any], List[str]]:
    warnings: List[str] = []
    last_exc: Exception | None = None
    for model in models:
        try:
            response = await _create_chat_completion_with_retries(
                client=client,
                label=f"Outline model '{model}'",
                warnings=warnings,
                model=model,
                temperature=0.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": OUTLINE_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            )
            raw = response.choices[0].message.content or "{}"
            plan = json.loads(raw)
            if model != models[0]:
                warnings.append(f"Outline reconstruction used fallback model: {model}")
            return plan, warnings
        except Exception as exc:
            last_exc = exc
            if _is_payload_too_large_error(exc):
                warnings.append(f"Outline model '{model}' rejected payload as too large (413).")
                break
            if _is_rate_limit_error(exc):
                warnings.append(f"Outline model '{model}' hit Groq rate limit.")
                break
            warnings.append(f"Outline model '{model}' failed: {exc}")

    warnings.append(f"Outline reconstruction failed: {last_exc}.")
    return {}, warnings


def _layout_from_outline(ir: Dict[str, Any], style: Dict[str, Any], outline_plan: Dict[str, Any]) -> Dict[str, Any]:
    plan = _base_layout_plan(ir, style)
    source_sections = ir.get("sections") or []
    roles: Dict[int, Dict[str, Any]] = {}
    for item in outline_plan.get("outline") or []:
        if not isinstance(item, dict):
            continue
        try:
            section_index = int(item.get("section_index"))
        except Exception:
            continue
        if 0 <= section_index < len(source_sections):
            roles[section_index] = item

    rebuilt: List[Dict[str, Any]] = []
    current_section: Dict[str, Any] | None = None
    current_subsection: Dict[str, Any] | None = None
    section_counter = 0
    subsection_counter = 0

    def ensure_current_section(default_index: int) -> Dict[str, Any]:
        nonlocal current_section, section_counter, subsection_counter, current_subsection
        if current_section is None:
            section_counter += 1
            subsection_counter = 0
            current_subsection = None
            title = source_sections[default_index].get("title") or f"Section {section_counter}"
            current_section = {
                "id": f"section-{section_counter}",
                "title": title,
                "layout_source": "outline_reconstructor",
                "subsections": [],
            }
            rebuilt.append(current_section)
        return current_section

    for index, source_section in enumerate(source_sections):
        role_item = roles.get(index, {})
        role = str(role_item.get("role") or "heading_1").strip().lower()
        title = str(role_item.get("normalized_title") or source_section.get("title") or f"Section {index + 1}").strip()
        paragraphs = source_section.get("paragraphs") or []
        paragraph_formats = (source_section.get("paragraph_formats") or [{} for _ in paragraphs])[: len(paragraphs)]

        if role in {"noise", "reference_heading"}:
            continue

        if role == "paragraph_false_positive":
            target = current_subsection
            if target is None:
                target_section = ensure_current_section(index)
                if not target_section["subsections"]:
                    subsection_counter += 1
                    target = {
                        "id": f"{target_section['id']}-sub-{subsection_counter}",
                        "title": target_section["title"],
                        "heading_level": 1,
                        "layout_source": "outline_reconstructor",
                        "paragraphs": [],
                        "paragraph_formats": [],
                        "figures": [],
                        "tables": [],
                    }
                    target_section["subsections"].append(target)
                    current_subsection = target
                else:
                    target = target_section["subsections"][-1]
            if title and paragraphs and _looks_like_continuation(paragraphs[0]):
                target["paragraphs"].append(f"{title} {paragraphs[0]}".strip())
                target["paragraph_formats"].append(paragraph_formats[0] if paragraph_formats else {})
                target["paragraphs"].extend(paragraphs[1:])
                target["paragraph_formats"].extend(paragraph_formats[1:])
            else:
                if title:
                    target["paragraphs"].append(title)
                    target["paragraph_formats"].append({})
                target["paragraphs"].extend(paragraphs)
                target["paragraph_formats"].extend(paragraph_formats)
            continue

        if role == "heading_1" or current_section is None:
            section_counter += 1
            subsection_counter = 1
            current_section = {
                "id": f"section-{section_counter}",
                "title": title,
                "layout_source": "outline_reconstructor",
                "subsections": [],
            }
            rebuilt.append(current_section)
            embedded_subsections = _split_embedded_heading_subsections(
                section_id=f"section-{section_counter}",
                section_title=title,
                paragraphs=paragraphs,
                paragraph_formats=paragraph_formats,
                figures=source_section.get("figures", []),
                tables=source_section.get("tables", []),
            )
            current_section["subsections"].extend(embedded_subsections)
            subsection_counter = len(embedded_subsections)
            current_subsection = embedded_subsections[-1] if embedded_subsections else None
            continue

        target_section = ensure_current_section(index)
        subsection_counter += 1
        heading_level = 3 if role == "heading_3" else 2
        embedded_subsections = _split_embedded_heading_subsections(
            section_id=target_section["id"],
            section_title=title,
            paragraphs=paragraphs,
            paragraph_formats=paragraph_formats,
            figures=source_section.get("figures", []),
            tables=source_section.get("tables", []),
            first_heading_level=heading_level,
            start_index=subsection_counter,
        )
        target_section["subsections"].extend(embedded_subsections)
        subsection_counter += len(embedded_subsections)
        current_subsection = embedded_subsections[-1] if embedded_subsections else None

    if rebuilt:
        plan["sections"] = rebuilt
    plan["engine_report"] = {
        "layout_mode": "llm_outline_reconstructor",
        "outline_items": len(roles),
        "total_sections": len(rebuilt),
        "source_sections": len(source_sections),
    }
    return plan


async def _build_chapter_scoped_layout_plan(
    client: Any,
    models: List[str],
    ir: Dict[str, Any],
    style: Dict[str, Any],
    max_payload_bytes: int,
) -> tuple[Dict[str, Any], List[str]]:
    warnings: List[str] = []
    plan = _fallback_layout_plan(ir, style)
    refined_sections: List[Dict[str, Any]] = []
    ai_chapter_count = 0
    groq_sections = 0
    groq_called_sections = 0
    groq_no_heading_sections = 0
    fallback_sections = 0
    skipped_sections = 0
    max_ai_chapters = _int_env("GROQ_LAYOUT_MAX_AI_CHAPTERS", 8)
    min_ai_paragraphs = _int_env("GROQ_LAYOUT_MIN_PARAGRAPHS_FOR_AI", 2)

    for section_index, section in enumerate(ir.get("sections", []), start=1):
        paragraph_count = len(section.get("paragraphs", []) or [])
        if paragraph_count < min_ai_paragraphs:
            refined_sections.append(_with_layout_source(_fallback_section_layout(section, section_index, style), "deterministic_short_section"))
            skipped_sections += 1
            continue

        if ai_chapter_count >= max_ai_chapters:
            if ai_chapter_count == max_ai_chapters:
                warnings.append(
                    f"Groq chapter layout call cap reached ({max_ai_chapters}); remaining chapters used deterministic layout."
                )
                ai_chapter_count += 1
            refined_sections.append(_with_layout_source(_fallback_section_layout(section, section_index, style), "deterministic_after_ai_cap"))
            fallback_sections += 1
            continue

        payload = _chapter_layout_payload(section, section_index, style)
        if not payload["chapter"]["heading_candidates"]:
            refined_sections.append(_with_layout_source(_fallback_section_layout(section, section_index, style), "deterministic_no_heading_candidates"))
            skipped_sections += 1
            continue

        payload_bytes = _payload_size_bytes(payload)
        if payload_bytes > max_payload_bytes:
            warnings.append(
                f"Chapter {section_index} layout payload too large ({payload_bytes} bytes); used deterministic chapter fallback."
            )
            refined_sections.append(_with_layout_source(_fallback_section_layout(section, section_index, style), "deterministic_payload_too_large"))
            fallback_sections += 1
            continue

        chapter_plan, chapter_warnings = await _generate_chapter_layout_with_fallback(
            client=client,
            models=models,
            payload=payload,
            section_index=section_index,
        )
        ai_chapter_count += 1
        groq_called_sections += 1
        warnings.extend(chapter_warnings)
        if chapter_plan.get("_rate_limited"):
            warnings.append("Groq rate limit reached; remaining chapters used deterministic layout.")
            refined_sections.append(_with_layout_source(_merge_chapter_structure(section, section_index, {}, style), "deterministic_rate_limited"))
            fallback_sections += 1
            for remaining_index, remaining_section in enumerate((ir.get("sections", []) or [])[section_index:], start=section_index + 1):
                refined_sections.append(_with_layout_source(_fallback_section_layout(remaining_section, remaining_index, style), "deterministic_after_rate_limit"))
                fallback_sections += 1
            break
        source = "groq_heading_candidates" if chapter_plan.get("subsections") else "groq_no_headings"
        if source == "groq_heading_candidates":
            groq_sections += 1
        else:
            groq_no_heading_sections += 1
            skipped_sections += 1
        refined_sections.append(_with_layout_source(_merge_chapter_structure(section, section_index, chapter_plan, style), source))

    if refined_sections:
        plan["sections"] = refined_sections
        plan["engine_report"] = {
            "layout_mode": "chapter_scoped_candidates",
            "groq_sections": groq_sections,
            "groq_called_sections": groq_called_sections,
            "groq_no_heading_sections": groq_no_heading_sections,
            "fallback_sections": fallback_sections,
            "skipped_sections": skipped_sections,
            "total_sections": len(refined_sections),
            "partial_groq": groq_called_sections > 0 and fallback_sections > 0,
        }
        _apply_deterministic_citation_conversion(plan, style)
        warnings.append(
            f"Used chapter-scoped candidate layout: {groq_sections} Groq sections, {fallback_sections} deterministic fallback sections, {skipped_sections} skipped/no-candidate sections."
        )
    return plan, warnings


def _chapter_layout_payload(section: Dict[str, Any], section_index: int, style: Dict[str, Any]) -> Dict[str, Any]:
    candidates = _heading_candidates(section.get("paragraphs", []) or [])
    return {
        "target_style": style["style"],
        "style_rules": {
            "section_rules": style.get("section_rules", {}),
            "citation_style": style.get("citation_style"),
        },
        "chapter": {
            "index": section_index,
            "title": section.get("title", f"Section {section_index}"),
            "level": section.get("level", 1),
            "heading_candidates": candidates,
            "paragraph_count": len(section.get("paragraphs", []) or []),
            "figures": section.get("figures", [])[:30],
            "tables": section.get("tables", [])[:30],
        },
        "required_schema": {
            "subsections": [
                {
                    "title": "str",
                    "heading_index": 3,
                    "level": 2,
                    "notes": "optional short reason",
                }
            ]
        },
        "rules": [
            "Only return candidates that are real subheadings/headings.",
            "Ignore candidate text that is actually a normal paragraph, sentence fragment, citation, author line, or running header.",
            "Use heading_index from the provided candidates; do not invent indices.",
            "Do not return paragraph text or paragraph ranges.",
            "Keep this chapter independent; do not use context from earlier or later chapters.",
        ],
    }


async def _generate_chapter_layout_with_fallback(
    client: Any,
    models: List[str],
    payload: Dict[str, Any],
    section_index: int,
) -> tuple[Dict[str, Any], List[str]]:
    warnings: List[str] = []
    last_exc: Exception | None = None
    rate_limited = False
    for model in models:
        try:
            response = await _create_chat_completion_with_retries(
                client=client,
                label=f"Chapter {section_index} layout model '{model}'",
                warnings=warnings,
                model=model,
                temperature=0.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": CHAPTER_LAYOUT_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            )
            raw = response.choices[0].message.content or "{}"
            plan = json.loads(raw)
            if model != models[0]:
                warnings.append(f"Chapter {section_index} layout used fallback model: {model}")
            return plan, warnings
        except Exception as exc:
            last_exc = exc
            if _is_payload_too_large_error(exc):
                warnings.append(f"Chapter {section_index} model '{model}' rejected payload as too large (413).")
                break
            if _is_rate_limit_error(exc):
                rate_limited = True
                warnings.append(f"Chapter {section_index} model '{model}' hit Groq rate limit.")
                break
            warnings.append(f"Chapter {section_index} model '{model}' failed: {exc}")

    if rate_limited:
        return {"_rate_limited": True}, warnings

    warnings.append(
        f"Chapter {section_index} layout failed: {last_exc}. Used deterministic chapter fallback."
    )
    return {}, warnings


def _merge_chapter_structure(
    section: Dict[str, Any],
    section_index: int,
    chapter_plan: Dict[str, Any],
    style: Dict[str, Any],
) -> Dict[str, Any]:
    source_paragraphs = section.get("paragraphs", []) or []
    paragraph_formats = (section.get("paragraph_formats") or [{} for _ in source_paragraphs])[: len(source_paragraphs)]
    subsections: List[Dict[str, Any]] = []
    used_indices: set[int] = set()

    if any(isinstance(item, dict) and "heading_index" in item for item in (chapter_plan.get("subsections") or [])):
        heading_subsections = _subsections_from_heading_candidates(section, section_index, chapter_plan, paragraph_formats)
        if heading_subsections:
            return {
                "id": f"section-{section_index}",
                "title": section.get("title", f"Section {section_index}"),
                "subsections": heading_subsections,
            }

    for subsection_index, proposed in enumerate(chapter_plan.get("subsections") or [], start=1):
        if not isinstance(proposed, dict):
            continue
        indices = _valid_unique_indices(proposed.get("paragraph_indices"), len(source_paragraphs), used_indices)
        if not indices:
            continue
        title = str(proposed.get("title") or section.get("title") or f"Section {section_index}").strip()
        subsections.append(
            _subsection_from_indices(
                section=section,
                section_index=section_index,
                subsection_index=len(subsections) + 1,
                title=title,
                indices=indices,
                paragraphs=source_paragraphs,
                paragraph_formats=paragraph_formats,
            )
        )
        used_indices.update(indices)

    missing_indices = [index for index in range(len(source_paragraphs)) if index not in used_indices]
    if missing_indices:
        if subsections:
            subsections[-1]["paragraphs"].extend(source_paragraphs[index] for index in missing_indices)
            subsections[-1]["paragraph_formats"].extend(paragraph_formats[index] if index < len(paragraph_formats) else {} for index in missing_indices)
        else:
            subsections.append(
                _subsection_from_indices(
                    section=section,
                    section_index=section_index,
                    subsection_index=1,
                    title=section.get("title", f"Section {section_index}"),
                    indices=missing_indices,
                    paragraphs=source_paragraphs,
                    paragraph_formats=paragraph_formats,
                )
            )

    if not subsections:
        return _fallback_section_layout(section, section_index, style)

    if subsections:
        subsections[0]["figures"] = section.get("figures", [])
        subsections[0]["tables"] = section.get("tables", [])

    return {
        "id": f"section-{section_index}",
        "title": section.get("title", f"Section {section_index}"),
        "subsections": subsections,
    }


def _fallback_section_layout(section: Dict[str, Any], section_index: int, style: Dict[str, Any]) -> Dict[str, Any]:
    source_paragraphs = section.get("paragraphs", []) or []
    paragraph_formats = (section.get("paragraph_formats") or [{} for _ in source_paragraphs])[: len(source_paragraphs)]
    return {
        "id": f"section-{section_index}",
        "title": section.get("title", f"Section {section_index}"),
        "subsections": [
            {
                "id": f"section-{section_index}-body",
                "title": section.get("title", f"Section {section_index}"),
                "paragraphs": source_paragraphs,
                "paragraph_formats": paragraph_formats,
                "figures": section.get("figures", []),
                "tables": section.get("tables", []),
            }
        ],
    }


def _with_layout_source(section_layout: Dict[str, Any], source: str) -> Dict[str, Any]:
    section_layout["layout_source"] = source
    for subsection in section_layout.get("subsections", []) or []:
        subsection["layout_source"] = source
    return section_layout


def _subsection_from_indices(
    section: Dict[str, Any],
    section_index: int,
    subsection_index: int,
    title: str,
    indices: List[int],
    paragraphs: List[str],
    paragraph_formats: List[Dict[str, Any]],
) -> Dict[str, Any]:
    return {
        "id": f"section-{section_index}-sub-{subsection_index}",
        "title": title or section.get("title", f"Section {section_index}"),
        "paragraphs": [paragraphs[index] for index in indices],
        "paragraph_formats": [paragraph_formats[index] if index < len(paragraph_formats) else {} for index in indices],
        "figures": [],
        "tables": [],
    }


def _valid_unique_indices(raw_indices: Any, paragraph_count: int, used_indices: set[int]) -> List[int]:
    if not isinstance(raw_indices, list):
        return []
    indices: List[int] = []
    for raw in raw_indices:
        try:
            index = int(raw)
        except Exception:
            continue
        if 0 <= index < paragraph_count and index not in used_indices and index not in indices:
            indices.append(index)
    return indices


def _heading_candidates(paragraphs: List[str]) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    max_chars = _int_env("GROQ_HEADING_CANDIDATE_MAX_CHARS", 140)
    max_words = _int_env("GROQ_HEADING_CANDIDATE_MAX_WORDS", 14)
    for index, paragraph in enumerate(paragraphs):
        text = _normalize_candidate_text(paragraph)
        if _is_heading_candidate(text, max_chars=max_chars, max_words=max_words):
            candidates.append({"index": index, "text": text})
    return candidates


def _normalize_candidate_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _is_heading_candidate(text: str, max_chars: int, max_words: int) -> bool:
    if not text:
        return False
    if len(text) > max_chars:
        return False
    words = re.findall(r"[A-Za-z0-9]+", text)
    if len(words) == 0 or len(words) > max_words:
        return False
    lowered = text.lower().strip()
    if lowered in {"abstract", "references", "bibliography", "works cited"}:
        return False
    if re.search(r"\b(et al|doi|http|www|@)\b", lowered):
        return False
    if re.search(r"\([A-Za-z][^)]*,\s*\d{4}[a-z]?\)", text):
        return False
    if text.endswith((".", ",", ";", ":")) and not re.match(r"^\s*(?:[IVXLCDM]+\.|\d+(?:\.\d+)*\.?|[A-Z]\.)\s+", text):
        return False
    if re.match(r"^\s*(?:[IVXLCDM]+\.|\d+(?:\.\d+)*\.?|[A-Z]\.)\s+\S+", text):
        return True
    letters = [char for char in text if char.isalpha()]
    if letters and sum(1 for char in letters if char.isupper()) / len(letters) > 0.65:
        return True
    title_words = sum(1 for word in text.split() if word[:1].isupper())
    if len(words) <= 8 and title_words >= max(1, len(text.split()) // 2):
        return True
    known_heading_terms = {
        "background",
        "related work",
        "literature review",
        "methodology",
        "methods",
        "results",
        "discussion",
        "limitations",
        "conclusion",
        "future work",
        "experimental setup",
        "dataset",
        "data collection",
        "evaluation",
    }
    return lowered in known_heading_terms


def _subsections_from_heading_candidates(
    section: Dict[str, Any],
    section_index: int,
    chapter_plan: Dict[str, Any],
    paragraph_formats: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    source_paragraphs = section.get("paragraphs", []) or []
    heading_indices: List[int] = []
    titles: Dict[int, str] = {}
    for proposed in chapter_plan.get("subsections") or []:
        if not isinstance(proposed, dict):
            continue
        try:
            heading_index = int(proposed.get("heading_index"))
        except Exception:
            continue
        if 0 <= heading_index < len(source_paragraphs) and heading_index not in heading_indices:
            heading_indices.append(heading_index)
            titles[heading_index] = str(proposed.get("title") or source_paragraphs[heading_index]).strip()

    heading_indices.sort()
    if not heading_indices:
        return []

    subsections: List[Dict[str, Any]] = []
    if heading_indices[0] > 0:
        subsections.append(
            _subsection_from_indices(
                section=section,
                section_index=section_index,
                subsection_index=1,
                title=section.get("title", f"Section {section_index}"),
                indices=list(range(0, heading_indices[0])),
                paragraphs=source_paragraphs,
                paragraph_formats=paragraph_formats,
            )
        )

    for heading_position, heading_index in enumerate(heading_indices):
        next_heading_index = heading_indices[heading_position + 1] if heading_position + 1 < len(heading_indices) else len(source_paragraphs)
        body_indices = list(range(heading_index + 1, next_heading_index))
        if not body_indices:
            continue
        subsections.append(
            _subsection_from_indices(
                section=section,
                section_index=section_index,
                subsection_index=len(subsections) + 1,
                title=titles.get(heading_index) or source_paragraphs[heading_index],
                indices=body_indices,
                paragraphs=source_paragraphs,
                paragraph_formats=paragraph_formats,
            )
        )

    if subsections:
        subsections[0]["figures"] = section.get("figures", [])
        subsections[0]["tables"] = section.get("tables", [])
    return subsections


def _apply_deterministic_citation_conversion(plan: Dict[str, Any], style: Dict[str, Any]) -> None:
    citation_map: Dict[str, str] = {}
    citation_counter = 1
    for section in plan.get("sections", []) or []:
        for subsection in section.get("subsections", []) or []:
            converted = []
            for paragraph in subsection.get("paragraphs", []) or []:
                converted.append(
                    _convert_citations_deterministically(
                        paragraph,
                        style["citation_style"],
                        citation_map,
                        citation_counter,
                    )
                )
                citation_counter = len(citation_map) + 1
            subsection["paragraphs"] = converted
    plan["citation_map"] = citation_map


def _layout_schema_hint() -> Dict[str, Any]:
    return {
        "style": "str",
        "font": "str",
        "body_size_pt": 10,
        "abstract_size_pt": 9,
        "columns": 2,
        "column_gap_inches": 0.25,
        "margin_inches": 0.75,
        "page_size": "letter",
        "body_alignment": "justified",
        "line_spacing": 1.0,
        "paragraph_spacing_after_twips": 80,
        "first_line_indent_inches": 0.0,
        "reference_hanging_indent_inches": 0.25,
        "metadata": {
            "title": "str",
            "authors": ["str"],
            "affiliation": "str",
            "abstract": "str",
            "keywords": ["str"],
        },
        "section_rules": {
            "numbering": "roman",
            "heading_style": "small_caps_centered",
            "subsection_numbering": "alpha",
            "subsection_style": "italic_bold_left",
        },
        "citation_style": "bracket_numbered",
        "citation_map": {"(Author, Year)": "[1]"},
        "sections": [
            {
                "id": "section-1",
                "title": "Introduction",
                "subsections": [
                    {
                        "id": "section-1-sub-1",
                        "title": "Background",
                        "paragraphs": ["..."],
                        "figures": [],
                        "tables": [],
                    }
                ],
            }
        ],
        "references": [{"index": 1, "formatted": "..."}],
    }


def re_findall(pattern: str, text: str) -> List[str]:
    import re

    return re.findall(pattern, text or "")


def _compact_ir_for_layout(ir: Dict[str, Any], max_payload_bytes: int) -> tuple[Dict[str, Any], str | None]:
    levels = [
        {"max_paragraphs": 0, "max_para_chars": 0, "max_refs": 120, "max_ref_chars": 180},
        {"max_paragraphs": 0, "max_para_chars": 0, "max_refs": 80, "max_ref_chars": 140},
        {"max_paragraphs": 0, "max_para_chars": 0, "max_refs": 50, "max_ref_chars": 120},
        {"max_paragraphs": 0, "max_para_chars": 0, "max_refs": 40, "max_ref_chars": 120},
    ]

    for index, level in enumerate(levels):
        compact = _build_compact_ir(
            ir=ir,
            max_paragraphs=level["max_paragraphs"],
            max_para_chars=level["max_para_chars"],
            max_refs=level["max_refs"],
            max_ref_chars=level["max_ref_chars"],
        )
        if _payload_size_bytes({"ir": compact}) <= max_payload_bytes:
            note = None
            if index > 0:
                note = f"Layout input compacted (level {index + 1}) to fit payload limits."
            return compact, note

    return _build_compact_ir(ir, 0, 0, 30, 100), "Layout input heavily compacted for large document."


def _build_compact_ir(
    ir: Dict[str, Any],
    max_paragraphs: int,
    max_para_chars: int,
    max_refs: int,
    max_ref_chars: int,
) -> Dict[str, Any]:
    sections = []
    for section in ir.get("sections", []):
        original_paragraphs = section.get("paragraphs", []) or []
        if max_paragraphs <= 0:
            paragraphs = []
        else:
            paragraphs = [
                _trim_text(paragraph, max_para_chars)
                for paragraph in original_paragraphs[:max_paragraphs]
                if str(paragraph).strip()
            ]

        sections.append(
            {
                "level": section.get("level", 1),
                "title": _trim_text(str(section.get("title") or ""), 220),
                "paragraphs": paragraphs,
                "figures": section.get("figures", [])[:20],
                "tables": section.get("tables", [])[:20],
            }
        )

    references = [
        _trim_text(reference, max_ref_chars)
        for reference in (ir.get("references") or [])[:max_refs]
        if str(reference).strip()
    ]

    figures = [
        {
            "id": figure.get("id"),
            "page": figure.get("page"),
            "caption": _trim_text(str(figure.get("caption") or ""), 220),
        }
        for figure in (ir.get("figures") or [])[:120]
    ]

    tables = []
    for table in (ir.get("tables") or [])[:60]:
        rows = table.get("rows") or []
        compact_rows = []
        for row in rows[:8]:
            compact_rows.append([_trim_text(str(cell or ""), 90) for cell in row[:8]])
        tables.append(
            {
                "id": table.get("id"),
                "page": table.get("page"),
                "caption": _trim_text(str(table.get("caption") or ""), 220),
                "rows": compact_rows,
            }
        )

    metadata = dict(ir.get("metadata") or {})
    if isinstance(metadata.get("abstract"), str):
        metadata["abstract"] = _trim_text(metadata["abstract"], 1200)
    metadata["keywords"] = (metadata.get("keywords") or [])[:15]

    return {
        "metadata": metadata,
        "sections": sections,
        "figures": figures,
        "tables": tables,
        "references": references,
        "footnotes": (ir.get("footnotes") or [])[:60],
        "source": ir.get("source") or {},
    }


def _payload_size_bytes(payload: Dict[str, Any]) -> int:
    return len(json.dumps(payload, ensure_ascii=False).encode("utf-8"))


def _trim_text(text: str, max_chars: int) -> str:
    value = str(text or "").strip()
    if max_chars <= 0:
        return ""
    if len(value) <= max_chars:
        return value
    return value[:max_chars].rstrip() + "..."


def _int_env(name: str, default: int) -> int:
    raw = get_env(name)
    if raw is None:
        return default
    try:
        value = int(str(raw).strip())
        return value if value > 0 else default
    except Exception:
        return default


def _truthy_env(name: str) -> bool:
    raw = get_env(name)
    return str(raw or "").strip().lower() in {"1", "true", "yes", "on"}


def _enabled_env(name: str, default: bool) -> bool:
    raw = get_env(name)
    if raw is None:
        return default
    return str(raw or "").strip().lower() in {"1", "true", "yes", "on"}


def _configured_api_key(name: str) -> str | None:
    value = get_env(name)
    if not value:
        return None
    normalized = str(value).strip().lower()
    if normalized.startswith("your_") or normalized in {"changeme", "change_me"}:
        return None
    return str(value).strip()


def _is_payload_too_large_error(exc: Exception) -> bool:
    text = str(exc or "")
    return "413" in text or "Payload Too Large" in text


def _is_rate_limit_error(exc: Exception) -> bool:
    text = str(exc or "").lower()
    status = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
    return status == 429 or "429" in text or "too many requests" in text or "rate limit" in text


def _retry_after_seconds(exc: Exception) -> float | None:
    headers = getattr(getattr(exc, "response", None), "headers", None) or getattr(exc, "headers", None) or {}
    retry_after = None
    try:
        retry_after = headers.get("retry-after") or headers.get("Retry-After")
    except Exception:
        retry_after = None
    if retry_after:
        try:
            return max(1.0, float(retry_after))
        except Exception:
            pass

    match = re.search(r"try again in\s+([0-9.]+)\s*([smh]?)", str(exc or ""), re.I)
    if not match:
        return None
    value = float(match.group(1))
    unit = match.group(2).lower()
    if unit == "h":
        return value * 3600
    if unit == "m":
        return value * 60
    return value


async def _create_chat_completion_with_retries(
    client: Any,
    label: str,
    warnings: List[str],
    **kwargs: Any,
) -> Any:
    retries = _int_env("GROQ_RATE_LIMIT_RETRIES", 2)
    base_delay = _float_env("GROQ_RATE_LIMIT_BACKOFF_SECONDS", 8.0)
    request_interval = _float_env("GROQ_REQUEST_INTERVAL_SECONDS", 1.5)

    if request_interval > 0:
        await asyncio.sleep(request_interval)

    for attempt in range(retries + 1):
        try:
            return await client.chat.completions.create(**kwargs)
        except Exception as exc:
            if not _is_rate_limit_error(exc) or attempt >= retries:
                raise
            delay = _retry_after_seconds(exc) or base_delay * (2 ** attempt)
            delay = min(delay, _float_env("GROQ_RATE_LIMIT_MAX_SLEEP_SECONDS", 45.0))
            warnings.append(f"{label} rate limited; retrying in {delay:.1f}s.")
            await asyncio.sleep(delay)

    raise RuntimeError(f"{label} failed after rate-limit retries.")


def _float_env(name: str, default: float) -> float:
    raw = get_env(name)
    if raw is None:
        return default
    try:
        value = float(str(raw).strip())
        return value if value >= 0 else default
    except Exception:
        return default
