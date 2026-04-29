"""Configuration helpers for DocuMentor."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv

from .styles import STYLE_REGISTRY


PACKAGE_ROOT = Path(__file__).resolve().parent
REPO_ROOT = PACKAGE_ROOT.parent
RUNTIME_ROOT = PACKAGE_ROOT / ".runtime"
DEFAULT_OUTPUT_ROOT = PACKAGE_ROOT / "outputs"
_ENV_LOADED = False


def load_environment() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    # Load from the most common project locations; keep existing env values intact.
    for env_path in (
        REPO_ROOT / ".env",
        REPO_ROOT / "backend" / ".env",
        REPO_ROOT / "python-nlp-service" / ".env",
        REPO_ROOT / "backend" / ".env.example",
    ):
        if env_path.exists():
            load_dotenv(env_path, override=False)
    _ENV_LOADED = True


def ensure_runtime_dirs() -> Dict[str, Path]:
    runtime = RUNTIME_ROOT
    images = runtime / "images"
    temp = runtime / "temp"
    plans = runtime / "plans"
    for path in (runtime, images, temp, plans, DEFAULT_OUTPUT_ROOT):
        path.mkdir(parents=True, exist_ok=True)
    return {
        "runtime": runtime,
        "images": images,
        "temp": temp,
        "plans": plans,
        "default_output": DEFAULT_OUTPUT_ROOT,
    }


def ensure_output_dir(output_dir: str | None) -> Path:
    base = Path(output_dir).expanduser().resolve() if output_dir else DEFAULT_OUTPUT_ROOT
    base.mkdir(parents=True, exist_ok=True)
    return base


def load_style(style_name: str) -> Dict[str, Any]:
    key = str(style_name or "").strip().lower()
    if key not in STYLE_REGISTRY:
        supported = ", ".join(sorted(STYLE_REGISTRY))
        raise ValueError(f"Unsupported style '{style_name}'. Supported styles: {supported}")
    return STYLE_REGISTRY[key]


def get_env(name: str, default: str | None = None) -> str | None:
    load_environment()
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


def get_env_list(name: str, default: list[str] | None = None) -> list[str]:
    raw = get_env(name)
    if not raw:
        return list(default or [])
    return [part.strip() for part in str(raw).split(",") if part.strip()]
