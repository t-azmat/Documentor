"""Export helpers for DOCX, PDF, and LaTeX outputs."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List


def build_docx(layout_plan: Dict[str, Any], snippets: Dict[str, str], output_dir: Path) -> Path:
    output_path = output_dir / f"{_safe_stem(layout_plan['metadata'].get('title') or 'document')}.docx"
    plan_path = output_dir / "layout_plan.json"
    snippets_path = output_dir / "section_snippets.json"

    plan_path.write_text(json.dumps(layout_plan, indent=2), encoding="utf-8")
    snippets_path.write_text(json.dumps(snippets, indent=2), encoding="utf-8")

    script_path = Path(__file__).resolve().parent / "node" / "build_docx.mjs"
    completed = subprocess.run(
        ["node", str(script_path), str(plan_path), str(snippets_path), str(output_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            "DOCX generation failed. "
            f"stdout={completed.stdout[-2000:]} stderr={completed.stderr[-2000:]}"
        )
    return output_path


def build_pdf(docx_path: Path, output_dir: Path) -> tuple[Path | None, List[str]]:
    warnings: List[str] = []
    soffice = shutil.which("soffice")
    if not soffice:
        warnings.append("LibreOffice headless is not installed; PDF export skipped.")
        return None, warnings

    completed = subprocess.run(
        [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(output_dir), str(docx_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    pdf_path = output_dir / f"{docx_path.stem}.pdf"
    if completed.returncode != 0 or not pdf_path.exists():
        warnings.append(
            "LibreOffice conversion failed: "
            + (completed.stderr[-1000:] if completed.stderr else completed.stdout[-1000:])
        )
        return None, warnings
    return pdf_path, warnings


def build_latex(docx_path: Path, output_dir: Path) -> tuple[Path | None, List[str]]:
    warnings: List[str] = []
    pandoc = shutil.which("pandoc")
    if not pandoc:
        warnings.append("Pandoc is not installed; LaTeX export skipped.")
        return None, warnings

    tex_path = output_dir / f"{docx_path.stem}.tex"
    completed = subprocess.run(
        [pandoc, str(docx_path), "-o", str(tex_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0 or not tex_path.exists():
        warnings.append(
            "Pandoc conversion failed: "
            + (completed.stderr[-1000:] if completed.stderr else completed.stdout[-1000:])
        )
        return None, warnings
    return tex_path, warnings


def _safe_stem(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in value.strip())
    return cleaned[:80] or "document"
