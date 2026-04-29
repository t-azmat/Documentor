"""Per-section DOCX code generation stage."""

from __future__ import annotations

import json
import re
import asyncio
from typing import Any, Dict, List

from .config import get_env, get_env_list


SECTION_SYSTEM_PROMPT = (
    "You are a docx.js v9 code generator. You receive one section of a "
    "document Layout Plan and style rules. Generate ONLY a JavaScript array "
    "literal of docx Paragraph/Table/ImageRun objects for this section. "
    "No imports. No Document wrapper. No explanation. Output only the raw "
    "array content that goes inside children: [...]"
)

SECTION_RULES = [
    "Font must match style_rules.font exactly.",
    "Never use \\n in TextRun; use separate Paragraph objects.",
    "Never use unicode bullet characters; use LevelFormat.BULLET with numbering.",
    "Always set alignment: AlignmentType.JUSTIFIED for body paragraphs.",
    "Section headings use smallCaps: true when style is small_caps_centered.",
    "Tables must set both columnWidths array and width on each TableCell.",
    "Use ShadingType.CLEAR never ShadingType.SOLID for table shading.",
]


async def generate_section_snippets(layout_plan: Dict[str, Any], ir: Dict[str, Any]) -> tuple[Dict[str, str], List[str]]:
    warnings: List[str] = []
    api_key = get_env("GROQ_API_KEY")
    max_payload_bytes = _int_env("GROQ_CODEGEN_MAX_PAYLOAD_BYTES", 120000)
    section_payloads = _section_payloads(layout_plan, ir)

    if _truthy_env("FORMATTING_ENGINE_LOCAL_ONLY"):
        warnings.append("FORMATTING_ENGINE_LOCAL_ONLY is enabled. Used deterministic section code generation fallback.")
        return {payload["id"]: _fallback_section_snippet(payload, layout_plan) for payload in section_payloads}, warnings

    if not _truthy_env("FORMATTING_ENGINE_CODEGEN_USE_AI"):
        warnings.append("FORMATTING_ENGINE_CODEGEN_USE_AI is disabled. Used deterministic section code generation fallback.")
        return {payload["id"]: _fallback_section_snippet(payload, layout_plan) for payload in section_payloads}, warnings

    if not api_key:
        warnings.append("GROQ_API_KEY is not configured. Used deterministic section code generation fallback.")
        return {payload["id"]: _fallback_section_snippet(payload, layout_plan) for payload in section_payloads}, warnings

    try:
        from groq import AsyncGroq

        client = AsyncGroq(api_key=api_key)
        models = get_env_list(
            "GROQ_CODEGEN_MODELS",
            default=[
                
                "openai/gpt-oss-120b"
            ],
        )
        legacy_single = get_env("GROQ_CODEGEN_MODEL")
        if legacy_single:
            models = [legacy_single]
        if not models:
            models = ["llama-3.1-8b-instant"]

        snippets: Dict[str, str] = {}
        for payload in section_payloads:
            compact_payload = _compact_section_payload(payload)
            if _codegen_payload_size_bytes(layout_plan, compact_payload) > max_payload_bytes:
                warnings.append(
                    f"Section {payload['id']} payload too large for Groq request; used deterministic fallback."
                )
                snippets[payload["id"]] = _fallback_section_snippet(payload, layout_plan)
                continue

            snippet, section_warnings = await _generate_section_with_fallback(
                client=client,
                models=models,
                payload=compact_payload,
                layout_plan=layout_plan,
            )
            warnings.extend(section_warnings)
            snippets[payload["id"]] = snippet
        return snippets, warnings
    except Exception as exc:
        warnings.append(f"Llama 4 Scout setup failed: {exc}. Used deterministic fallback.")
        return {payload["id"]: _fallback_section_snippet(payload, layout_plan) for payload in section_payloads}, warnings


async def _generate_one_section(
    client: Any,
    model: str,
    payload: Dict[str, Any],
    layout_plan: Dict[str, Any],
    warnings: List[str],
) -> str:
    response = await _create_chat_completion_with_retries(
        client=client,
        label=f"Section {payload['id']} model '{model}'",
        warnings=warnings,
        model=model,
        temperature=0.0,
        messages=[
            {
                "role": "system",
                "content": SECTION_SYSTEM_PROMPT + " Rules: " + " ".join(SECTION_RULES),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "style_rules": {
                            "font": layout_plan["font"],
                            "body_size_pt": layout_plan["body_size_pt"],
                            "abstract_size_pt": layout_plan["abstract_size_pt"],
                            "section_rules": layout_plan["section_rules"],
                            "columns": layout_plan["columns"],
                            "citation_style": layout_plan["citation_style"],
                        },
                        "section": payload,
                    },
                    ensure_ascii=False,
                ),
            },
        ],
    )
    content = (response.choices[0].message.content or "").strip()
    return _ensure_array_literal(content)


async def _generate_section_with_fallback(
    client: Any,
    models: List[str],
    payload: Dict[str, Any],
    layout_plan: Dict[str, Any],
) -> tuple[str, List[str]]:
    warnings: List[str] = []
    last_exc: Exception | None = None
    for model in models:
        try:
            snippet = await _generate_one_section(client, model, payload, layout_plan, warnings)
            if model != models[0]:
                warnings.append(f"Section {payload['id']} used fallback codegen model: {model}")
            return snippet, warnings
        except Exception as exc:
            last_exc = exc
            if _is_payload_too_large_error(exc):
                warnings.append(f"Section {payload['id']} model '{model}' rejected payload as too large (413).")
                break
            if _is_rate_limit_error(exc):
                warnings.append(f"Section {payload['id']} model '{model}' hit Groq rate limit.")
                break
            warnings.append(f"Section {payload['id']} model '{model}' failed: {exc}")

    warnings.append(
        f"Section code generation failed for {payload['id']}: {last_exc}. Used deterministic fallback."
    )
    return _fallback_section_snippet(payload, layout_plan), warnings


def _fallback_section_snippet(payload: Dict[str, Any], layout_plan: Dict[str, Any]) -> str:
    font = layout_plan["font"]
    body_size = layout_plan["body_size_pt"]
    heading_level = int(payload.get("heading_level") or 1)
    heading_style = (
        layout_plan["section_rules"].get("heading_style", "bold_left")
        if heading_level <= 1
        else layout_plan["section_rules"].get("subsection_style", "bold_left")
    )
    heading_align = "AlignmentType.CENTER" if "centered" in heading_style else "AlignmentType.LEFT"
    small_caps = "true" if heading_style == "small_caps_centered" else "false"
    heading_title = _format_heading_title(payload, layout_plan)
    heading_size = body_size + (2 if heading_level <= 1 else 1)

    entries: List[str] = []
    entries.append(
        (
            "{ type: 'heading', title: "
            + json.dumps(heading_title)
            + ", font: "
            + json.dumps(font)
            + f", size: {heading_size}, align: {heading_align}, smallCaps: {small_caps}, level: {heading_level} }}"
        )
    )

    paragraph_formats = payload.get("paragraph_formats", []) or []
    for index, paragraph in enumerate(payload.get("paragraphs", [])):
        source_format = paragraph_formats[index] if index < len(paragraph_formats) else {}
        list_item = _list_item_from_paragraph(paragraph, font, body_size, source_format)
        if list_item:
            entries.append(list_item)
            continue
        entries.append(
            (
                "{ type: 'paragraph', text: "
                + json.dumps(paragraph)
                + ", font: "
                + json.dumps(font)
                + f", size: {body_size}, sourceFormat: "
                + json.dumps(source_format)
                + " }"
            )
        )

    for figure in payload.get("figure_objects", []):
        entries.append(
            "{ type: 'figure', imagePath: "
            + json.dumps(figure["image_path"])
            + ", caption: "
            + json.dumps(figure.get("caption") or figure["id"])
            + " }"
        )

    for table in payload.get("table_objects", []):
        entries.append(
            "{ type: 'table', rows: "
            + json.dumps(table["rows"])
            + ", caption: "
            + json.dumps(table.get("caption") or table["id"])
            + " }"
        )

    return "[" + ", ".join(entries) + "]"


def _list_item_from_paragraph(paragraph: str, font: str, body_size: int, source_format: Dict[str, Any]) -> str | None:
    text = str(paragraph or "").strip()
    if not text:
        return None

    unordered = re.match(r"^(?:[-*\u2022\u2023\u25e6]\s+)(.+)$", text)
    ordered = re.match(r"^(?:\(?\d+[\.\)]|[a-zA-Z][\.\)])\s+(.+)$", text)
    if unordered:
        marker = "false"
        item_text = unordered.group(1).strip()
    elif ordered:
        marker = "true"
        item_text = ordered.group(1).strip()
    else:
        return None

    return (
        "{ type: 'list', ordered: "
        + marker
        + ", items: ["
        + json.dumps(item_text)
        + "], font: "
        + json.dumps(font)
        + f", size: {body_size}, sourceFormat: "
        + json.dumps(source_format)
        + " }"
    )


def _format_heading_title(payload: Dict[str, Any], layout_plan: Dict[str, Any]) -> str:
    title = str(payload.get("title") or "Section").strip()
    heading_level = int(payload.get("heading_level") or 1)
    if heading_level > 1:
        return title
    numbering = (layout_plan.get("section_rules") or {}).get("numbering", "none")
    section_id = str(payload.get("section_id") or "")
    match = re_search(r"section-(\d+)", section_id)
    index = int(match) if match else 0

    if numbering == "roman" and index > 0:
        return f"{_to_roman(index)}. {title.upper()}"
    if numbering == "arabic" and index > 0:
        return f"{index}. {title}"
    return title


def _to_roman(value: int) -> str:
    pairs = [
        (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
        (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
        (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
    ]
    result = []
    number = max(1, min(int(value), 3999))
    for amount, symbol in pairs:
        while number >= amount:
            result.append(symbol)
            number -= amount
    return "".join(result)


def re_search(pattern: str, text: str) -> str | None:
    import re

    match = re.search(pattern, text)
    return match.group(1) if match else None


def _section_payloads(layout_plan: Dict[str, Any], ir: Dict[str, Any]) -> List[Dict[str, Any]]:
    figure_map = {figure["id"]: figure for figure in ir.get("figures", [])}
    table_map = {table["id"]: table for table in ir.get("tables", [])}
    payloads: List[Dict[str, Any]] = []
    for section in layout_plan.get("sections", []):
        for subsection in section.get("subsections", []):
            payloads.append(
                {
                    "id": subsection["id"],
                    "section_id": section["id"],
                    "title": subsection.get("title") or section.get("title") or "Section",
                    "heading_level": subsection.get("heading_level") or 1,
                    "paragraphs": subsection.get("paragraphs", []),
                    "paragraph_formats": subsection.get("paragraph_formats", []),
                    "figures": subsection.get("figures", []),
                    "tables": subsection.get("tables", []),
                    "figure_objects": [figure_map[item] for item in subsection.get("figures", []) if item in figure_map],
                    "table_objects": [table_map[item] for item in subsection.get("tables", []) if item in table_map],
                }
            )
    return payloads


def _ensure_array_literal(content: str) -> str:
    trimmed = content.strip()
    if trimmed.startswith("```"):
        trimmed = trimmed.strip("`")
        if "\n" in trimmed:
            trimmed = trimmed.split("\n", 1)[1]
    trimmed = trimmed.strip()
    if not trimmed.startswith("["):
        raise ValueError("Generated section payload was not an array literal.")
    return trimmed


def _compact_section_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    paragraphs = payload.get("paragraphs", []) or []
    compact_paragraphs = [_trim_text(paragraph, 1200) for paragraph in paragraphs[:40] if str(paragraph).strip()]
    compact_paragraph_formats = (payload.get("paragraph_formats") or [])[: len(compact_paragraphs)]

    compact_figure_objects = []
    for figure in (payload.get("figure_objects") or [])[:20]:
        compact_figure_objects.append(
            {
                "id": figure.get("id"),
                "caption": _trim_text(str(figure.get("caption") or ""), 220),
                "image_path": figure.get("image_path"),
            }
        )

    compact_table_objects = []
    for table in (payload.get("table_objects") or [])[:20]:
        rows = table.get("rows") or []
        compact_rows = []
        for row in rows[:8]:
            compact_rows.append([_trim_text(str(cell or ""), 90) for cell in row[:8]])
        compact_table_objects.append(
            {
                "id": table.get("id"),
                "caption": _trim_text(str(table.get("caption") or ""), 220),
                "rows": compact_rows,
            }
        )

    return {
        "id": payload.get("id"),
        "section_id": payload.get("section_id"),
        "title": _trim_text(str(payload.get("title") or "Section"), 220),
        "paragraphs": compact_paragraphs,
        "paragraph_formats": compact_paragraph_formats,
        "figures": (payload.get("figures") or [])[:20],
        "tables": (payload.get("tables") or [])[:20],
        "figure_objects": compact_figure_objects,
        "table_objects": compact_table_objects,
    }


def _codegen_payload_size_bytes(layout_plan: Dict[str, Any], payload: Dict[str, Any]) -> int:
    body = {
        "style_rules": {
            "font": layout_plan["font"],
            "body_size_pt": layout_plan["body_size_pt"],
            "abstract_size_pt": layout_plan["abstract_size_pt"],
            "section_rules": layout_plan["section_rules"],
            "columns": layout_plan["columns"],
            "citation_style": layout_plan["citation_style"],
        },
        "section": payload,
    }
    return len(json.dumps(body, ensure_ascii=False).encode("utf-8"))


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
