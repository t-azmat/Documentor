"""Dependency checks for DocuMentor."""

from __future__ import annotations

import importlib
import importlib.util
import shutil
from typing import Dict, List


PYTHON_MODULES = {
    "pdfplumber": "pdfplumber",
    "groq": "groq",
}


def check_dependencies() -> Dict[str, List[str]]:
    missing_python: List[str] = []
    for package_name, module_name in PYTHON_MODULES.items():
        try:
            importlib.import_module(module_name)
        except Exception:
            missing_python.append(package_name)

    missing_binaries: List[str] = []
    for command in ("node",):
        if shutil.which(command) is None:
            missing_binaries.append(command)

    optional_missing: List[str] = []
    for command in ("pandoc", "soffice"):
        if shutil.which(command) is None:
            optional_missing.append(command)

    try:
        importlib.import_module("pymupdf")
    except Exception:
        optional_missing.append("pymupdf")

    if importlib.util.find_spec("nougat") is None and shutil.which("nougat") is None:
        optional_missing.append("nougat-ocr")

    if importlib.util.find_spec("docling") is None:
        optional_missing.append("docling")

    return {
        "missing_python": missing_python,
        "missing_binaries": missing_binaries,
        "optional_missing": optional_missing,
    }


def build_install_hints() -> Dict[str, str]:
    return {
        "python": "pip install -r formatting_engine/requirements.txt",
        "node": "npm install docx",
        "pymupdf": "Install PyMuPDF to enable image extraction from PDFs.",
        "nougat-ocr": "Install nougat-ocr to enable optional academic PDF OCR extraction.",
        "docling": "Install Docling to enable optional document AI extraction.",
        "pandoc": "Install Pandoc and add it to PATH to enable LaTeX export.",
        "soffice": "Install LibreOffice and add soffice to PATH to enable PDF export.",
    }
