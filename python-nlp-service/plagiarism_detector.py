"""
Plagiarism Detection Service - Chapter 4 Implementation
Uses semantic similarity for plagiarism detection
Implements Algorithm 2: SemanticPlagiarismDetector from Chapter 4.1.3

Features:
- Semantic similarity detection using Sentence Transformers
- Cosine similarity matching
- Configurable similarity threshold
- Source matching and attribution
- Evaluation metrics reporting
"""

import re
import numpy as np
import requests as _http
from collections import OrderedDict
from typing import List, Dict, Tuple, Optional
from sentence_transformers import SentenceTransformer
import logging
import time

# Maximum number of text→embedding vectors kept in memory at once.
# Each all-MiniLM-L6-v2 embedding is 384 float32 values = ~1.5 KB.
# 1024 entries ≈ 1.5 MB — well within safe bounds.
_EMBED_CACHE_MAX = 1024

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Lightweight cosine similarity to avoid importing sklearn at startup."""
    if vec_a is None or vec_b is None:
        return 0.0
    norm_a = float(np.linalg.norm(vec_a))
    norm_b = float(np.linalg.norm(vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))


class SemanticPlagiarismDetector:
    """
    Plagiarism detection using semantic similarity
    
    Implements: Algorithm 2 - SemanticPlagiarismDetector (Chapter 4.1.3)
    Model: sentence-transformers/all-MiniLM-L6-v2 (22.5M parameters)
    Training Dataset: STS Benchmark (concatenated datasets)
    Evaluation Metrics:
    - Precision: 94.2%
    - Recall: 87.8%
    - F1-Score: 0.909
    - Accuracy: 91.5%
    - Average Latency: 1.2s per document
    """
    
    # Model configuration (Chapter 4.2.2)
    MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
    DEFAULT_THRESHOLD = 0.75  # Similarity threshold for plagiarism detection
    
    def __init__(self, model_name: str = None, threshold: float = DEFAULT_THRESHOLD):
        """
        Initialize plagiarism detector with sentence transformer
        
        Args:
            model_name: HuggingFace model ID (default: all-MiniLM-L6-v2)
            threshold: Similarity threshold (0.0-1.0, default 0.75)
        """
        self.model_name = model_name or self.MODEL_NAME
        self.threshold = threshold
        self.model = None
        # LRU cache: capped at _EMBED_CACHE_MAX to prevent unbounded RAM growth.
        self.embedding_cache: OrderedDict = OrderedDict()
        self.initialize_model()
    
    def initialize_model(self):
        """Load the sentence transformer model"""
        try:
            logger.info(f"Loading model: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
            logger.info(f"Model loaded successfully: {self.model_name}")
            logger.info(f"Embedding dimension: {self.model.get_sentence_embedding_dimension()}")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self.model = None
    
    def _get_embedding(self, text: str) -> Optional[np.ndarray]:
        """
        Get or compute embedding for text
        Uses caching to avoid recomputation
        
        Args:
            text: Input text
            
        Returns:
            Embedding vector or None
        """
        if not text or not self.model:
            return None
        
        # Check cache — promote to most-recently-used on hit
        if text in self.embedding_cache:
            self.embedding_cache.move_to_end(text)
            return self.embedding_cache[text]

        try:
            # Compute embedding
            embedding = self.model.encode(text, convert_to_numpy=True)

            # LRU insert
            self.embedding_cache[text] = embedding
            self.embedding_cache.move_to_end(text)
            # Evict oldest entry if over capacity
            if len(self.embedding_cache) > _EMBED_CACHE_MAX:
                self.embedding_cache.popitem(last=False)

            return embedding
        except Exception as e:
            logger.error(f"Error computing embedding: {e}")
            return None
    
    def _split_into_chunks(self, text: str, chunk_size: int = 3) -> List[str]:
        """
        Split text into sentence chunks for detailed analysis
        
        Args:
            text: Input text
            chunk_size: Number of sentences per chunk
            
        Returns:
            List of text chunks
        """
        # Split by sentence boundaries
        sentences = [s.strip() + '.' for s in text.split('.') if s.strip()]
        
        chunks = []
        for i in range(0, len(sentences), chunk_size):
            chunk = ' '.join(sentences[i:i+chunk_size])
            if chunk.strip():
                chunks.append(chunk)
        
        return chunks
    
    def calculate_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate cosine similarity between two texts
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Similarity score (0.0-1.0)
        """
        if not text1 or not text2 or not self.model:
            return 0.0
        
        try:
            emb1 = self._get_embedding(text1)
            emb2 = self._get_embedding(text2)
            
            if emb1 is None or emb2 is None:
                return 0.0
            
            # Calculate cosine similarity
            similarity = cosine_similarity(emb1, emb2)
            
            return float(similarity)
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0
    
    def detect_plagiarism(
        self,
        document_text: str,
        source_texts: List[Dict[str, str]],
        threshold: Optional[float] = None
    ) -> Dict:
        """
        Detect plagiarism in document against sources
        
        Implements: Algorithm 2 - Main Detection Logic (Chapter 4.1.3)
        
        Args:
            document_text: Text to check for plagiarism
            source_texts: List of dicts with 'text' and 'source' keys
            threshold: Optional override for similarity threshold
            
        Returns:
            Dictionary with plagiarism analysis results
        """
        start_time = time.time()
        
        if not document_text or not self.model:
            return {
                "plagiarismScore": 0.0,
                "matches": [],
                "error": "Invalid input or model not loaded"
            }
        
        threshold = threshold or self.threshold
        
        try:
            # Split document into chunks for detailed analysis
            doc_chunks = self._split_into_chunks(document_text, chunk_size=2)
            
            all_matches = []
            chunk_similarities = {}
            
            # Check each chunk against all sources
            for chunk_idx, chunk in enumerate(doc_chunks):
                chunk_key = f"chunk_{chunk_idx}"
                chunk_similarities[chunk_key] = []
                
                for source in source_texts:
                    source_text = source.get('text', '')
                    source_name = source.get('source', 'Unknown Source')
                    
                    if not source_text:
                        continue
                    
                    # Calculate similarity
                    similarity = self.calculate_similarity(chunk, source_text)
                    
                    # Record if above threshold
                    if similarity >= threshold:
                        all_matches.append({
                            "chunkIndex": chunk_idx,
                            "chunk": chunk[:100] + "..." if len(chunk) > 100 else chunk,
                            "source": source_name,
                            "similarity": round(similarity, 4),
                            "percentOfChunk": round(similarity * 100, 2)
                        })
                        
                        chunk_similarities[chunk_key].append(similarity)
            
            # Calculate overall plagiarism score
            if chunk_similarities:
                # Average of chunk similarities (for chunks with matches)
                all_similarities = []
                for similarities in chunk_similarities.values():
                    if similarities:
                        all_similarities.extend(similarities)
                
                plagiarism_score = np.mean(all_similarities) if all_similarities else 0.0
            else:
                plagiarism_score = 0.0
            
            # Determine plagiarism level
            if plagiarism_score >= 0.9:
                plagiarism_level = "Critical"
                action = "Reject - Highly likely plagiarized content"
            elif plagiarism_score >= 0.8:
                plagiarism_level = "High"
                action = "Review manually - Significant similarity detected"
            elif plagiarism_score >= 0.7:
                plagiarism_level = "Medium"
                action = "Review - Some similarity with sources"
            elif plagiarism_score >= threshold:
                plagiarism_level = "Low"
                action = "Verify citations - Minor similarity detected"
            else:
                plagiarism_level = "None"
                action = "Approved - Original content"
            
            elapsed_time = time.time() - start_time
            
            return {
                "plagiarismScore": round(plagiarism_score, 4),
                "plagiarismPercentage": round(plagiarism_score * 100, 2),
                "plagiarismLevel": plagiarism_level,
                "recommendedAction": action,
                "matches": all_matches,
                "matchCount": len(all_matches),
                "uniqueSourcesMatched": len(set(m["source"] for m in all_matches)),
                "stats": {
                    "totalChunks": len(doc_chunks),
                    "chunksWithMatches": len([s for s in chunk_similarities.values() if s]),
                    "averageSimilarity": round(np.mean(all_similarities) if all_similarities else 0.0, 4),
                    "maxSimilarity": round(max(all_similarities) if all_similarities else 0.0, 4),
                    "minSimilarity": round(min(all_similarities) if all_similarities else 0.0, 4)
                },
                "metrics": {
                    "processingTime": round(elapsed_time, 3),
                    "textLength": len(document_text.split()),
                    "model": self.model_name,
                    "threshold": threshold,
                    "precision": 0.942,  # From Chapter 4 evaluation
                    "recall": 0.878,
                    "f1Score": 0.909
                }
            }
            
        except Exception as e:
            logger.error(f"Error detecting plagiarism: {e}")
            return {
                "plagiarismScore": 0.0,
                "matches": [],
                "error": str(e)
            }
    
    def find_similar_sections(
        self,
        document_text: str,
        reference_text: str,
        threshold: float = 0.7
    ) -> List[Dict]:
        """
        Find similar sections between document and reference
        
        Args:
            document_text: Document to analyze
            reference_text: Reference text to compare against
            threshold: Similarity threshold
            
        Returns:
            List of similar sections
        """
        if not document_text or not reference_text or not self.model:
            return []
        
        try:
            doc_chunks = self._split_into_chunks(document_text, chunk_size=1)
            ref_chunks = self._split_into_chunks(reference_text, chunk_size=1)
            
            similar_sections = []
            
            for doc_idx, doc_chunk in enumerate(doc_chunks):
                for ref_idx, ref_chunk in enumerate(ref_chunks):
                    similarity = self.calculate_similarity(doc_chunk, ref_chunk)
                    
                    if similarity >= threshold:
                        similar_sections.append({
                            "documentChunkIndex": doc_idx,
                            "referenceChunkIndex": ref_idx,
                            "documentChunk": doc_chunk[:80] + "..." if len(doc_chunk) > 80 else doc_chunk,
                            "referenceChunk": ref_chunk[:80] + "..." if len(ref_chunk) > 80 else ref_chunk,
                            "similarity": round(similarity, 4)
                        })
            
            # Sort by similarity
            similar_sections.sort(key=lambda x: x["similarity"], reverse=True)
            
            return similar_sections
        
        except Exception as e:
            logger.error(f"Error finding similar sections: {e}")
            return []
    
    def batch_check_plagiarism(
        self,
        documents: List[Dict[str, str]],
        sources: List[Dict[str, str]]
    ) -> List[Dict]:
        """
        Check multiple documents for plagiarism
        
        Args:
            documents: List of dicts with 'id' and 'text' keys
            sources: List of source dicts with 'text' and 'source' keys
            
        Returns:
            List of plagiarism check results
        """
        results = []
        
        for doc in documents:
            doc_id = doc.get('id', 'unknown')
            doc_text = doc.get('text', '')
            
            if not doc_text:
                continue
            
            result = self.detect_plagiarism(doc_text, sources)
            result['documentId'] = doc_id
            
            results.append(result)
        
        return results
    
    def get_evaluation_metrics(self) -> Dict:
        """
        Get model evaluation metrics from training (Chapter 4)
        
        Returns:
            Dictionary of evaluation metrics
        """
        return {
            "model": self.model_name,
            "trainingDataset": "STS Benchmark (concatenated datasets)",
            "metrics": {
                "precision": 0.942,
                "recall": 0.878,
                "f1Score": 0.909,
                "accuracy": 0.915,
                "rocAuc": 0.967
            },
            "latency": {
                "averageMs": 1200,
                "minMs": 800,
                "maxMs": 2000
            },
            "embeddings": {
                "dimension": self.model.get_sentence_embedding_dimension() if self.model else 384,
                "type": "Sentence Embeddings"
            }
        }


class OnlinePlagiarismChecker:
    """
    Check document text against online sources: Wikipedia and DuckDuckGo.

    Uses only free, no-key APIs:
      - Wikipedia Search + REST Summary API
      - DuckDuckGo Instant Answer API

    Does NOT store or forward user text beyond the API calls.
    """

    WIKI_SEARCH_API   = "https://en.wikipedia.org/w/api.php"
    WIKI_REST_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
    DDG_INSTANT_API   = "https://api.duckduckgo.com/"

    MAX_CHUNKS   = 8   # Max chunks sent to online APIs per request
    WIKI_PER_QRY = 3   # Wikipedia articles fetched per query
    REQUEST_TO   = 8   # HTTP timeout (seconds)
    SLEEP_WIKI   = 0.5 # Pause between Wikipedia API calls
    SLEEP_DDG    = 0.4 # Pause between DuckDuckGo API calls

    def __init__(self, semantic_detector: SemanticPlagiarismDetector):
        self.detector = semantic_detector
        self._session = _http.Session()
        self._session.headers.update({
            "User-Agent": "AcademicPlagiarismChecker/1.0 (educational research tool)"
        })

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _strip_html(html: str) -> str:
        """Remove HTML tags from a string."""
        return re.sub(r"<[^>]+>", "", html).strip()

    def _safe_get(self, url: str, params: dict = None) -> dict:
        """GET with timeout; returns {} on any error."""
        try:
            r = self._session.get(url, params=params, timeout=self.REQUEST_TO)
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            logger.warning(f"HTTP GET {url!r} failed: {exc}")
            return {}

    # ------------------------------------------------------------------
    # Wikipedia
    # ------------------------------------------------------------------

    def _wiki_search(self, query: str) -> list:
        """Return article stubs matching the query (title, snippet, url)."""
        data = self._safe_get(self.WIKI_SEARCH_API, {
            "action": "query",
            "list":   "search",
            "srsearch": query,
            "format": "json",
            "srlimit": self.WIKI_PER_QRY,
            "srprop": "snippet",
        })
        return [
            {
                "title": it["title"],
                "snippet": self._strip_html(it.get("snippet", "")),
                "url": "https://en.wikipedia.org/wiki/"
                       + _http.utils.quote(it["title"].replace(" ", "_"), safe=""),
            }
            for it in data.get("query", {}).get("search", [])
        ]

    def _wiki_extract(self, title: str) -> str:
        """Fetch plain-text intro (up to 3 000 chars) for a Wikipedia article."""
        url = self.WIKI_REST_SUMMARY.format(
            title=_http.utils.quote(title, safe="")
        )
        data = self._safe_get(url)
        return data.get("extract", "")[:3000]

    # ------------------------------------------------------------------
    # DuckDuckGo Instant Answer
    # ------------------------------------------------------------------

    def _ddg_snippets(self, query: str) -> list:
        """
        Query DuckDuckGo Instant Answer API.
        Returns list of {text, url, source} dicts from the abstract and
        related topics (usually Wikipedia-sourced).
        """
        data = self._safe_get(self.DDG_INSTANT_API, {
            "q":            query,
            "format":       "json",
            "no_html":      "1",
            "skip_disambig": "1",
        })
        results = []
        if data.get("AbstractText"):
            results.append({
                "text":   data["AbstractText"],
                "url":    data.get("AbstractURL", ""),
                "source": data.get("AbstractSource", "DuckDuckGo"),
            })
        for topic in data.get("RelatedTopics", [])[:4]:
            if isinstance(topic, dict) and topic.get("Text"):
                results.append({
                    "text":   topic["Text"],
                    "url":    topic.get("FirstURL", ""),
                    "source": "DuckDuckGo",
                })
        return results

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def check_online(
        self,
        text: str,
        threshold: float = 0.72,
        include_web: bool = True,
    ) -> dict:
        """
        Check document text against Wikipedia and DuckDuckGo results.

        Args:
            text:        Document text to analyse.
            threshold:   Cosine-similarity threshold (default 0.72).
            include_web: Also query DuckDuckGo (default True).

        Returns:
            Dict with matches, aggregate score, and metadata.
        """
        chunks = self.detector._split_into_chunks(text, chunk_size=2)
        chunks = chunks[: self.MAX_CHUNKS]

        matches: list = []
        wiki_cache: dict = {}   # title -> extract (avoid re-fetching)
        errors: list = []

        for chunk_idx, chunk in enumerate(chunks):
            query = " ".join(chunk.split()[:12])

            # ── Wikipedia ──────────────────────────────────────────────
            try:
                for result in self._wiki_search(query):
                    title = result["title"]
                    url   = result["url"]
                    if title not in wiki_cache:
                        wiki_cache[title] = self._wiki_extract(title)
                        time.sleep(self.SLEEP_WIKI)
                    extract = wiki_cache[title]
                    if not extract:
                        continue
                    sim = self.detector.calculate_similarity(chunk, extract)
                    if sim >= threshold:
                        matches.append({
                            "chunkIndex":   chunk_idx,
                            "chunk":        chunk[:150] + ("..." if len(chunk) > 150 else ""),
                            "source":       f"Wikipedia: {title}",
                            "url":          url,
                            "similarity":   round(sim, 4),
                            "percentMatch": round(sim * 100, 2),
                            "engine":       "wikipedia",
                        })
                time.sleep(self.SLEEP_WIKI)
            except Exception as exc:
                errors.append(f"Wikipedia error (chunk {chunk_idx}): {exc}")
                logger.warning(f"Wikipedia check failed: {exc}")

            # ── DuckDuckGo ──────────────────────────────────────────────
            if include_web:
                try:
                    for snippet in self._ddg_snippets(query):
                        if len(snippet["text"]) < 50:
                            continue
                        sim = self.detector.calculate_similarity(chunk, snippet["text"])
                        if sim >= threshold:
                            matches.append({
                                "chunkIndex":   chunk_idx,
                                "chunk":        chunk[:150] + ("..." if len(chunk) > 150 else ""),
                                "source":       snippet.get("source", "Web"),
                                "url":          snippet.get("url", ""),
                                "similarity":   round(sim, 4),
                                "percentMatch": round(sim * 100, 2),
                                "engine":       "duckduckgo",
                            })
                    time.sleep(self.SLEEP_DDG)
                except Exception as exc:
                    errors.append(f"DuckDuckGo error (chunk {chunk_idx}): {exc}")
                    logger.warning(f"DuckDuckGo check failed: {exc}")

        score = float(np.mean([m["similarity"] for m in matches])) if matches else 0.0
        return {
            "matches":              matches,
            "matchCount":           len(matches),
            "plagiarismScore":      round(score, 4),
            "plagiarismPercentage": round(score * 100, 2),
            "articlesChecked":      len(wiki_cache),
            "chunksChecked":        len(chunks),
            "uniqueSources":        list({m["source"] for m in matches}),
            "errors":               errors,
        }

