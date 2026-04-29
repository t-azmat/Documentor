"""Main orchestration entry point for DocuMentor."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from .codegen import generate_section_snippets
from .config import ensure_output_dir, ensure_runtime_dirs, load_style
from .dependencies import build_install_hints, check_dependencies
from .exporters import build_docx, build_latex, build_pdf
from .extractors import extract_to_ir
from .layout_planner import build_layout_plan
from .validators import validate_layout_contract, validate_rendered_docx


def format_document(
    input_path: str,
    target_style: str,
    output_dir: str | None = None,
    custom_rules: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    dependency_report = check_dependencies()
    fatal_missing = dependency_report["missing_python"] + dependency_report["missing_binaries"]
    if fatal_missing:
        raise RuntimeError(
            "Missing required dependencies: "
            + ", ".join(fatal_missing)
            + ". Install with: "
            + build_install_hints()["python"]
            + " and "
            + build_install_hints()["node"]
        )

    ensure_runtime_dirs()
    source_path = Path(input_path).expanduser().resolve()
    destination_dir = ensure_output_dir(output_dir)
    run_dir = destination_dir / f"run_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    run_dir.mkdir(parents=True, exist_ok=True)

    warnings: List[str] = []
    style = load_style(target_style)

    ir, extract_warnings = extract_to_ir(str(source_path))
    warnings.extend(extract_warnings)

    layout_plan, layout_warnings = asyncio.run(build_layout_plan(ir, style["style"], custom_rules=custom_rules))
    warnings.extend(layout_warnings)
    if custom_rules:
        layout_plan["custom_guidelines"] = {
            "source_name": custom_rules.get("source_name"),
            "heading_rule_count": len(custom_rules.get("heading_rules") or []),
            "formatting_rule_count": len(custom_rules.get("formatting_rules") or []),
        }

    snippets, codegen_warnings = asyncio.run(generate_section_snippets(layout_plan, ir))
    warnings.extend(codegen_warnings)

    contract_errors, contract_warnings = validate_layout_contract(layout_plan, snippets, ir)
    warnings.extend(contract_warnings)
    if contract_errors:
        raise RuntimeError("Layout contract validation failed: " + "; ".join(contract_errors))

    docx_path = build_docx(layout_plan, snippets, run_dir)
    render_report, render_warnings = validate_rendered_docx(docx_path, layout_plan, ir)
    warnings.extend(render_warnings)
    pdf_path, pdf_warnings = build_pdf(docx_path, run_dir)
    tex_path, tex_warnings = build_latex(docx_path, run_dir)
    warnings.extend(pdf_warnings)
    warnings.extend(tex_warnings)
    warnings.extend(_dependency_warnings(dependency_report))

    ir_path = run_dir / "ir.json"
    layout_path = run_dir / "layout_plan.json"
    snippets_path = run_dir / "section_snippets.json"
    validation_path = run_dir / "validation_report.json"
    ir_path.write_text(json.dumps(ir, indent=2), encoding="utf-8")
    layout_path.write_text(json.dumps(layout_plan, indent=2), encoding="utf-8")
    snippets_path.write_text(json.dumps(snippets, indent=2), encoding="utf-8")
    validation_path.write_text(json.dumps(render_report, indent=2), encoding="utf-8")

    return {
        "input_path": str(source_path),
        "target_style": style["style"],
        "docx_path": str(docx_path),
        "pdf_path": str(pdf_path) if pdf_path else None,
        "latex_path": str(tex_path) if tex_path else None,
        "ir_path": str(ir_path),
        "layout_plan_path": str(layout_path),
        "section_snippets_path": str(snippets_path),
        "validation_report_path": str(validation_path),
        "custom_guidelines": layout_plan.get("custom_guidelines"),
        "warnings": warnings,
    }


def _dependency_warnings(report: Dict[str, List[str]]) -> List[str]:
    warnings: List[str] = []
    if report["optional_missing"]:
        hints = build_install_hints()
        for command in report["optional_missing"]:
            warnings.append(hints.get(command, f"Optional dependency missing: {command}"))
    return warnings
