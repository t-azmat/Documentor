"""
RAG Analyzer - AI Formatting Pipeline (Step 2)
Uses sentence-transformer embeddings + a local knowledge base to detect
missing or thin sections in an academic document.

The 'knowledge base' is a curated set of description sentences for every
expected academic section.  Each document chunk is embedded and compared
against the KB entries to:
  a) Confirm covered sections
  b) Surface sections that are absent or have very low coverage
  c) Return focused retrieval context that the LLM formatter can use
     to understand what a section SHOULD contain.
"""

import logging
import re
from typing import List, Dict, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static knowledge base
# Each entry: (section_type, description snippet used as embedding anchor)
# ---------------------------------------------------------------------------
KNOWLEDGE_BASE: List[Tuple[str, str]] = [
    # Abstract
    ("abstract", "The abstract provides a concise summary of the entire paper including the research problem, methodology, key findings, and conclusions in 150–250 words."),
    ("abstract", "A well-written abstract states the purpose of the study, the approach taken, the principal results, and major conclusions without references or undefined acronyms."),

    # Introduction
    ("introduction", "The introduction establishes the research context, identifies the gap in existing literature, states the research questions or hypotheses, and outlines the paper structure."),
    ("introduction", "The introduction motivates the study by explaining the significance of the problem, providing background information, and clearly stating the aims and objectives."),

    # Literature Review
    ("literature", "The literature review critically analyses existing research related to the topic, identifies research gaps, and justifies the need for the current study."),
    ("literature", "A literature review synthesises prior work by grouping related studies thematically and highlighting agreements, contradictions, and unanswered questions."),

    # Methodology
    ("methodology", "The methodology section describes the research design, data collection procedures, sample selection, instruments used, and data analysis techniques in sufficient detail to allow replication."),
    ("methodology", "The methodology justifies the chosen research approach, explains the experimental or analytical framework, and addresses potential limitations or biases."),

    # Results
    ("results", "The results section presents the empirical findings objectively, using tables, figures, and statistical analysis without interpretation or discussion."),
    ("results", "Results are reported clearly with appropriate statistical measures such as means, standard deviations, p-values, and confidence intervals where applicable."),

    # Discussion
    ("discussion", "The discussion interprets the results in light of the research questions and existing literature, explains unexpected findings, and acknowledges limitations."),
    ("discussion", "The discussion situates the findings within the broader field, discusses theoretical and practical implications, and suggests directions for future research."),

    # Conclusion
    ("conclusion", "The conclusion succinctly summarises the main findings, restates their significance, and highlights contributions to the field without introducing new results."),
    ("conclusion", "The conclusion addresses whether the research objectives were met, discusses limitations of the study, and proposes avenues for future work."),

    # References
    ("references", "The references list all sources cited in the paper, formatted consistently according to the chosen citation style such as APA, MLA, IEEE, Chicago, or Harvard."),
    ("references", "Every reference entry includes complete bibliographic information: authors, year, title, journal or publisher, volume, issue, and page numbers or DOI."),

    # Acknowledgements
    ("acknowledgements", "The acknowledgements section credits funding sources, institutional support, and individuals who contributed to the research but are not listed as authors."),
]

# Required sections for a typical academic paper
REQUIRED_SECTIONS = {"abstract", "introduction", "methodology", "results", "discussion", "conclusion", "references"}
RECOMMENDED_SECTIONS = {"literature", "acknowledgements"}


class RAGAnalyzer:
    """
    Retrieval-Augmented Gap Analysis for academic documents.

    Workflow:
    1.  Embed all knowledge-base entries once (lazy, cached).
    2.  For each document chunk, find the KB entries it best matches.
    3.  Identify which required sections have NO matching chunk above
        a similarity threshold → these are 'missing'.
    4.  Return structured gap report + per-section retrieval context.
    """

    SIMILARITY_THRESHOLD = 0.35   # cosine similarity above this = section is 'present'
    THIN_THRESHOLD = 0.25         # between this and SIMILARITY_THRESHOLD = section is 'thin'

    def __init__(self):
        self._model = None
        self._kb_embeddings: Optional[np.ndarray] = None
        self._kb_entries: List[Tuple[str, str]] = KNOWLEDGE_BASE

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyse(self, chunks: List[Dict]) -> Dict:
        """
        Analyse document chunks and return a gap report.

        Returns:
        {
          "present_sections":   [str, ...],
          "missing_sections":   [str, ...],
          "thin_sections":      [str, ...],
          "section_scores":     {section_type: float},
          "section_contexts":   {section_type: str},   # RAG retrieval context
          "overall_coverage":   float,                 # 0–1
          "recommendations":    [str, ...],
        }
        """
        if not chunks:
            return self._empty_report()

        model = self._get_model()
        if model is None:
            # Fallback: keyword-based coverage check without embeddings
            return self._keyword_fallback(chunks)

        kb_embs = self._get_kb_embeddings(model)
        chunk_texts = [c["text"] for c in chunks]
        chunk_embs = model.encode(chunk_texts, show_progress_bar=False, batch_size=32)

        # Per-section best similarity score
        section_scores: Dict[str, float] = {}
        section_best_chunk: Dict[str, str] = {}

        for chunk, c_emb in zip(chunks, chunk_embs):
            stype = chunk["section_type"]
            for kb_idx, (kb_stype, _) in enumerate(self._kb_entries):
                sim = float(np.dot(c_emb, kb_embs[kb_idx]) /
                             (np.linalg.norm(c_emb) * np.linalg.norm(kb_embs[kb_idx]) + 1e-10))
                if sim > section_scores.get(kb_stype, 0.0):
                    section_scores[kb_stype] = sim
                    section_best_chunk[kb_stype] = chunk["text"][:500]

        return self._build_report(section_scores, section_best_chunk)

    def get_section_context(self, section_type: str) -> str:
        """Return the KB description for a given section (used by the LLM as a prompt hint)."""
        entries = [desc for st, desc in self._kb_entries if st == section_type]
        return " ".join(entries) if entries else ""

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    def _get_model(self):
        if self._model is not None:
            return self._model
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("RAGAnalyzer: loaded sentence-transformer model")
        except Exception as e:
            logger.warning(f"RAGAnalyzer: sentence-transformer unavailable: {e}")
            self._model = None
        return self._model

    def _get_kb_embeddings(self, model) -> np.ndarray:
        if self._kb_embeddings is not None:
            return self._kb_embeddings
        kb_texts = [desc for _, desc in self._kb_entries]
        self._kb_embeddings = model.encode(kb_texts, show_progress_bar=False)
        return self._kb_embeddings

    def _build_report(self, section_scores: Dict[str, float], section_best_chunk: Dict[str, str]) -> Dict:
        present, missing, thin = [], [], []

        all_sections = REQUIRED_SECTIONS | RECOMMENDED_SECTIONS
        for sec in all_sections:
            score = section_scores.get(sec, 0.0)
            if score >= self.SIMILARITY_THRESHOLD:
                present.append(sec)
            elif score >= self.THIN_THRESHOLD:
                thin.append(sec)
            else:
                if sec in REQUIRED_SECTIONS:
                    missing.append(sec)

        recommendations = []
        for sec in missing:
            ctx = self.get_section_context(sec)
            recommendations.append(f"Missing required section '{sec}': {ctx[:120]}…")
        for sec in thin:
            recommendations.append(f"Section '{sec}' is present but appears thin — consider expanding it.")

        # Section contexts (KB text) to pass to the LLM
        section_contexts = {sec: self.get_section_context(sec) for sec in all_sections}

        coverage = len(present) / len(REQUIRED_SECTIONS) if REQUIRED_SECTIONS else 0.0

        return {
            "present_sections":  present,
            "missing_sections":  missing,
            "thin_sections":     thin,
            "section_scores":    {k: round(v, 4) for k, v in section_scores.items()},
            "section_contexts":  section_contexts,
            "overall_coverage":  round(coverage, 3),
            "recommendations":   recommendations,
        }

    def _keyword_fallback(self, chunks: List[Dict]) -> Dict:
        """Simple keyword check when embeddings are unavailable."""
        from document_chunker import HEADING_PATTERNS
        found_types = {c["section_type"] for c in chunks if c["section_type"] != "unknown"}

        # Also scan text for keyword presence
        full_text = " ".join(c["text"] for c in chunks).lower()
        keyword_map = {
            "abstract": ["abstract", "summary"],
            "introduction": ["introduction", "background"],
            "methodology": ["methodology", "method", "approach"],
            "results": ["results", "findings"],
            "discussion": ["discussion", "analysis"],
            "conclusion": ["conclusion"],
            "references": ["references", "bibliography"],
        }
        for sec, kws in keyword_map.items():
            if any(kw in full_text for kw in kws):
                found_types.add(sec)

        missing = list(REQUIRED_SECTIONS - found_types)
        present = list(found_types & REQUIRED_SECTIONS)
        section_contexts = {sec: self.get_section_context(sec) for sec in REQUIRED_SECTIONS | RECOMMENDED_SECTIONS}

        recommendations = [f"Missing required section '{s}'" for s in missing]

        return {
            "present_sections":  present,
            "missing_sections":  missing,
            "thin_sections":     [],
            "section_scores":    {s: (1.0 if s in found_types else 0.0) for s in REQUIRED_SECTIONS},
            "section_contexts":  section_contexts,
            "overall_coverage":  round(len(present) / max(1, len(REQUIRED_SECTIONS)), 3),
            "recommendations":   recommendations,
        }

    def _empty_report(self) -> Dict:
        return {
            "present_sections":  [],
            "missing_sections":  list(REQUIRED_SECTIONS),
            "thin_sections":     [],
            "section_scores":    {},
            "section_contexts":  {},
            "overall_coverage":  0.0,
            "recommendations":   ["Document appears empty."],
        }
