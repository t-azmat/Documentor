"""Compare legacy formatting_engine IR extraction with DocumentChunker IR extraction."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .extractors import compare_chunker_ir


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate DocumentChunker integration for formatting_engine.")
    parser.add_argument("inputs", nargs="+", help="PDF, DOCX, TXT, or Markdown files to compare")
    parser.add_argument("--json", action="store_true", help="Print full JSON report")
    args = parser.parse_args()

    reports = [compare_chunker_ir(path) for path in args.inputs]
    if args.json:
        print(json.dumps(reports, indent=2, ensure_ascii=False))
        return

    for report in reports:
        print(f"\n{Path(report['input_path']).name}")
        print(f"  blocks: {report['block_count']}")
        print(
            "  legacy: "
            f"{report['legacy']['section_count']} sections, "
            f"{report['legacy']['paragraph_count']} paragraphs, "
            f"{report['legacy']['reference_count']} refs, "
            f"{report['legacy']['elapsed_ms']} ms"
        )
        print(
            "  chunker: "
            f"{report['document_chunker']['section_count']} sections, "
            f"{report['document_chunker']['paragraph_count']} paragraphs, "
            f"{report['document_chunker']['reference_count']} refs, "
            f"{report['document_chunker']['elapsed_ms']} ms"
        )
        if report["warnings"]:
            print("  warnings:")
            for warning in report["warnings"]:
                print(f"    - {warning}")
        print(f"  deltas: {report['deltas']}")


if __name__ == "__main__":
    main()
