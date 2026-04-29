# DocuMentor Formatting Engine

This package implements a journal-formatting pipeline for academic papers.

Pipeline:
- Stage 0: dependency checks
- Stage 1: Docling/native/Nougat extraction into a Python IR
- Stage 1b: PDF zone detection for headers, footers, sidebars, marginalia, and main body
- Stage 1c: semantic IR annotations for body, front matter, floats, references, and source zones
- Stage 2: outline hierarchy classification with Groq or deterministic fallback
- Stage 3: constrained section item generation with deterministic fallback
- Stage 4: schema validation before DOCX assembly
- Stage 5: DOCX assembly in Node with optional PDF and LaTeX export
- Stage 6: post-render DOCX validation

Public API:

```python
from formatting_engine import format_document

result = format_document(
    input_path="paper.pdf",
    target_style="ieee",
    output_dir="./out"
)
```

Returned keys:
- `docx_path`
- `pdf_path`
- `latex_path`
- `ir_path`
- `layout_plan_path`
- `section_snippets_path`
- `validation_report_path`
- `warnings`

Environment:
- `GROQ_API_KEY`
- `GROQ_LAYOUT_MODELS` optional, comma-separated fallback order
- `GROQ_CODEGEN_MODELS` optional, comma-separated fallback order
- `GROQ_LAYOUT_MAX_PAYLOAD_BYTES` optional, default `350000`
- `GROQ_CODEGEN_MAX_PAYLOAD_BYTES` optional, default `120000`
- `GROQ_LAYOUT_MAX_AI_CHAPTERS` optional, default `8`; caps Groq layout calls per document and uses deterministic layout for the remaining chapters.
- `GROQ_HEADING_CANDIDATE_MAX_CHARS` optional, default `140`; paragraph-like blocks longer than this are skipped before Groq.
- `GROQ_HEADING_CANDIDATE_MAX_WORDS` optional, default `14`; sentence-like blocks above this word count are skipped before Groq.
- `GROQ_REQUEST_INTERVAL_SECONDS` optional, default `1.5`; spaces Groq requests to reduce 429 responses.
- `GROQ_RATE_LIMIT_RETRIES` optional, default `2`; retries a rate-limited request before falling back.
- `GROQ_LAYOUT_MODEL` optional legacy single-model override
- `GROQ_CODEGEN_MODEL` optional legacy single-model override
- `ANTHROPIC_API_KEY` optional; when configured, Claude is tried first for outline role classification only.
- `ANTHROPIC_OUTLINE_RECONSTRUCTOR` optional, default `true`
- `ANTHROPIC_LAYOUT_MODEL` optional, default `claude-3-5-haiku-latest`
- `FORMATTING_ENGINE_LOCAL_ONLY` optional; set `false` to allow the outline LLM.
- `FORMATTING_ENGINE_USE_AI` optional; set `true` to enable the outline LLM.
- `GROQ_OUTLINE_RECONSTRUCTOR` optional, default `true`; uses the LLM only to classify extracted section titles as heading/subheading hierarchy.
- `GROQ_CHAPTER_LAYOUT` optional, default recommended `false`; older per-chapter heading mode.
- `FORMATTING_ENGINE_EXTRACTOR` optional, default `auto`; extraction mode (`auto`, `native`, `docling`, `docling-auto`, `nougat`, or `nougat-ocr`). In `auto`, available extractor outputs are scored and the stronger IR is used.
- `FORMATTING_ENGINE_USE_DOCUMENT_CHUNKER` optional, default `auto` (`auto`, `true`, or `false`)
- `FORMATTING_ENGINE_PRESERVE_SOURCE_FORMAT` optional, default `true`; preserves source alignment and emphasis while applying target style rules for page setup, headings, citations, and body font/size.
- `NOUGAT_MODEL` optional, default Nougat model; example `0.1.0-small`.
- `NOUGAT_CHECKPOINT` optional path to a pre-downloaded Nougat checkpoint directory.
- `NOUGAT_PAGES` optional page range for testing, e.g. `1-2`; leave blank for full documents.
- `NOUGAT_TIMEOUT_SECONDS` optional, default `900`.
- `NOUGAT_NO_SKIPPING` optional, default `false`; set `true` if Nougat produces many `[MISSING_PAGE]` markers.
- `NOUGAT_COMMAND` optional path to a custom Nougat executable.

Where to place keys:
- Preferred: `backend/.env` (the engine auto-loads this path)
- Also supported: project root `.env` or `python-nlp-service/.env`
- Example:
  - `GROQ_API_KEY=your_key_here`
  - `FORMATTING_ENGINE_LOCAL_ONLY=false`
  - `FORMATTING_ENGINE_USE_AI=true`
  - `GROQ_OUTLINE_RECONSTRUCTOR=true`
  - `GROQ_LAYOUT_MODELS=llama-3.1-8b-instant,meta-llama/llama-4-scout-17b-16e-instruct,openai/gpt-oss-120b`
  - `GROQ_CODEGEN_MODELS=llama-3.1-8b-instant,meta-llama/llama-4-scout-17b-16e-instruct,openai/gpt-oss-120b`
  - `ANTHROPIC_API_KEY=your_key_here`
  - `ANTHROPIC_OUTLINE_RECONSTRUCTOR=true`
  - `FORMATTING_ENGINE_EXTRACTOR=auto`
  - `GROQ_CHAPTER_LAYOUT=false`
  - `GROQ_LAYOUT_MAX_PAYLOAD_BYTES=350000`
  - `GROQ_CODEGEN_MAX_PAYLOAD_BYTES=120000`
  - `GROQ_LAYOUT_MAX_AI_CHAPTERS=6`
  - `GROQ_HEADING_CANDIDATE_MAX_CHARS=140`
  - `GROQ_HEADING_CANDIDATE_MAX_WORDS=14`
  - `GROQ_REQUEST_INTERVAL_SECONDS=2`
  - `GROQ_RATE_LIMIT_RETRIES=2`
  - `NOUGAT_MODEL=0.1.0-small`
  - `NOUGAT_CHECKPOINT=`

Notes:
- `pandoc` is optional and only used for DOCX -> LaTeX conversion.
- `soffice` is optional and only used for DOCX -> PDF conversion.
- If Groq is not configured, the engine falls back to deterministic layout planning and DOCX code generation so the pipeline still produces a document.

A/B evaluation command:

```bash
python -m formatting_engine.ab_evaluate --style ieee uploads/971b381867cb1675ffd543d9621b6e6a.tmp
```

DocumentChunker integration comparison:

```bash
python -m formatting_engine.chunker_evaluate path/to/source.pdf path/to/reference.docx
```
