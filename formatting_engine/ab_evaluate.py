"""A/B evaluation between legacy formatter and new formatting_engine pipeline."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

from .main import format_document


def run_ab_evaluation(input_paths: List[str], target_style: str, output_dir: str) -> Dict[str, Any]:
    repo_root = Path(__file__).resolve().parent.parent
    legacy_path = repo_root / "python-nlp-service"
    if str(legacy_path) not in sys.path:
        sys.path.insert(0, str(legacy_path))

    # Lazy imports from legacy pipeline.
    from ai_document_formatter import AIDocumentFormatter  # type: ignore
    from file_extractor import FileExtractor  # type: ignore

    extractor = FileExtractor()
    legacy_formatter = AIDocumentFormatter()
    out_root = Path(output_dir).expanduser().resolve()
    out_root.mkdir(parents=True, exist_ok=True)

    cases: List[Dict[str, Any]] = []
    for raw_path in input_paths:
        case = _evaluate_single_case(
            Path(raw_path).expanduser().resolve(),
            target_style=target_style,
            out_root=out_root,
            extractor=extractor,
            legacy_formatter=legacy_formatter,
        )
        cases.append(case)

    legacy_scores = [c["legacy"]["score"] for c in cases]
    new_scores = [c["new_engine"]["score"] for c in cases]

    summary = {
        "target_style": target_style,
        "cases": cases,
        "averages": {
            "legacy": round(_avg(legacy_scores), 3),
            "new_engine": round(_avg(new_scores), 3),
        },
    }
    summary["winner"] = (
        "new_engine"
        if summary["averages"]["new_engine"] >= summary["averages"]["legacy"]
        else "legacy"
    )
    return summary


def _evaluate_single_case(
    source_path: Path,
    target_style: str,
    out_root: Path,
    extractor: Any,
    legacy_formatter: Any,
) -> Dict[str, Any]:
    detected_suffix = _detect_suffix(source_path)
    work_path = source_path
    temp_copy: Path | None = None
    if source_path.suffix.lower() != detected_suffix:
        temp_copy = out_root / f"{source_path.stem}{detected_suffix}"
        shutil.copyfile(source_path, temp_copy)
        work_path = temp_copy

    try:
        with open(work_path, "rb") as handle:
            raw_bytes = handle.read()

        legacy_extract = extractor.extract_text(raw_bytes, work_path.name)
        source_text = legacy_extract.get("text", "") if legacy_extract.get("success") else ""
        source_words = max(1, len(source_text.split()))

        legacy_result = legacy_formatter.format(
            source_text,
            target_style=target_style.upper(),
            source_style="unknown",
            title=work_path.stem,
        )
        legacy_text = "\n".join(section.get("text", "") for section in legacy_result.get("plain_sections", []))
        legacy_words = len(legacy_text.split())
        legacy_sections = len(legacy_result.get("plain_sections", []))
        legacy_citations = int(legacy_result.get("citation_stats", {}).get("intext_converted", 0))

        new_result = format_document(str(work_path), target_style=target_style, output_dir=str(out_root / "new_engine_runs"))
        ir = _read_json(Path(new_result["ir_path"]))
        layout = _read_json(Path(new_result["layout_plan_path"]))
        new_words = _layout_word_count(layout)
        new_sections = len(ir.get("sections", []))
        new_citations = len(layout.get("citation_map", {}))

        legacy_score = _score_pipeline(
            words_out=legacy_words,
            words_src=source_words,
            section_count=legacy_sections,
            citation_count=legacy_citations,
            docx_ready=False,
            warning_count=len(legacy_result.get("warnings", [])),
        )
        new_score = _score_pipeline(
            words_out=new_words,
            words_src=source_words,
            section_count=new_sections,
            citation_count=new_citations,
            docx_ready=Path(new_result["docx_path"]).exists(),
            warning_count=len(new_result.get("warnings", [])),
        )

        return {
            "input": str(source_path),
            "detected_type": detected_suffix.lstrip("."),
            "source_words": source_words,
            "legacy": {
                "score": round(legacy_score, 3),
                "output_words": legacy_words,
                "sections": legacy_sections,
                "citations_converted": legacy_citations,
                "success": bool(legacy_result.get("success")),
            },
            "new_engine": {
                "score": round(new_score, 3),
                "output_words": new_words,
                "sections": new_sections,
                "citations_converted": new_citations,
                "docx_path": new_result.get("docx_path"),
                "warning_count": len(new_result.get("warnings", [])),
            },
        }
    finally:
        if temp_copy and temp_copy.exists():
            temp_copy.unlink(missing_ok=True)


def _score_pipeline(
    words_out: int,
    words_src: int,
    section_count: int,
    citation_count: int,
    docx_ready: bool,
    warning_count: int,
) -> float:
    retention = min(words_out / max(1, words_src), 1.0)
    section_score = min(section_count / 8.0, 1.0)
    citation_score = min(citation_count / 10.0, 1.0)
    docx_bonus = 1.0 if docx_ready else 0.0
    warning_penalty = min(warning_count / 10.0, 1.0)
    score = (
        0.45 * retention
        + 0.20 * section_score
        + 0.20 * citation_score
        + 0.15 * docx_bonus
        - 0.10 * warning_penalty
    )
    return max(0.0, min(score, 1.0))


def _detect_suffix(path: Path) -> str:
    with path.open("rb") as handle:
        sig = handle.read(8)
    if sig.startswith(b"%PDF"):
        return ".pdf"
    if sig.startswith(b"PK"):
        return ".docx"
    return path.suffix.lower() or ".txt"


def _layout_word_count(layout: Dict[str, Any]) -> int:
    words = 0
    metadata = layout.get("metadata", {})
    words += len(str(metadata.get("abstract", "")).split())
    for section in layout.get("sections", []):
        for subsection in section.get("subsections", []):
            for paragraph in subsection.get("paragraphs", []):
                words += len(str(paragraph).split())
    return words


def _read_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _avg(values: List[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run A/B evaluation for DocuMentor formatters.")
    parser.add_argument("--style", default="ieee", help="Target style: ieee|apa|acm|nature|elsevier|chicago")
    parser.add_argument("--output-dir", default="formatting_engine/.runtime/ab_eval", help="Output directory")
    parser.add_argument("inputs", nargs="+", help="Input file paths")
    args = parser.parse_args()

    summary = run_ab_evaluation(args.inputs, args.style.lower(), args.output_dir)
    output_path = Path(args.output_dir).expanduser().resolve() / "ab_summary.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({"summary_path": str(output_path), "winner": summary["winner"], "averages": summary["averages"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
