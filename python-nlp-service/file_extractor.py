"""
Centralized File Extraction Utility
Handles text extraction from DOCX, PDF, and LaTeX files
Used across all services: Grammar, Plagiarism, Citations, Formatting

Key design:
  - DOCX: reads paragraph styles (Heading 1/2/3, Title, Normal) to produce
          a structured block list instead of flat text.
  - PDF:  uses pdfplumber which exposes font-size per word; crops top/bottom
          8 % of each page to drop running headers/footers; infers headings
          from font size relative to the page's median body size.
  - TXT / LaTeX: unchanged (flat text).

The new `extract_structured()` method returns a list of blocks:
    [{"style": "Heading 1" | "Normal" | ..., "text": str}, ...]
The legacy `extract_text()` method still works — it flattens the blocks.
"""

import io
import re
import logging
import statistics
from typing import Dict, List, Optional, Tuple
import docx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FileExtractor:
    """
    Centralized file text extraction service
    Supports: PDF, DOCX, TXT, and LaTeX files
    """
    
    SUPPORTED_FORMATS = ['.pdf', '.docx', '.txt', '.tex', '.latex']

    # Word paragraph styles that map to heading levels
    _DOCX_HEADING_STYLES = {
        'title':     'Title',
        'heading 1': 'Heading 1',
        'heading 2': 'Heading 2',
        'heading 3': 'Heading 3',
        'heading 4': 'Heading 4',
        'heading 5': 'Heading 5',
    }
    
    def __init__(self):
        """Initialize the file extractor"""
        logger.info("File Extractor initialized")

    # ------------------------------------------------------------------
    # Public: structured extraction (preferred for the AI formatter)
    # ------------------------------------------------------------------

    def extract_structured(self, file_content: bytes, filename: str) -> Dict:
        """
        Extract document content as a list of typed blocks.

        Returns:
        {
          success : bool,
          blocks  : [{"style": str, "text": str}, ...],
          file_type: str,
          word_count: int,
          error   : str | None,
        }
        Block styles: "Title", "Heading 1"–"Heading 5", "Normal"
        """
        fn = filename.lower()
        try:
            if fn.endswith('.docx'):
                blocks = self._structured_from_docx(file_content)
            elif fn.endswith('.pdf'):
                blocks = self._structured_from_pdf(file_content)
            elif fn.endswith('.txt'):
                raw = self._decode(file_content)
                blocks = self._text_to_blocks(raw)
            elif fn.endswith(('.tex', '.latex')):
                raw = self._clean_latex(self._decode(file_content))
                blocks = self._text_to_blocks(raw)
            else:
                return {'success': False, 'blocks': [],
                        'error': f'Unsupported format', 'file_type': 'unknown'}

            word_count = sum(len(b['text'].split()) for b in blocks)
            logger.info(f"Structured extraction: {len(blocks)} blocks, {word_count} words")
            return {
                'success': True,
                'blocks': blocks,
                'file_type': fn.rsplit('.', 1)[-1],
                'word_count': word_count,
                'error': None,
            }
        except Exception as e:
            logger.error(f"extract_structured error: {e}")
            return {'success': False, 'blocks': [], 'error': str(e), 'file_type': 'unknown'}

    # ------------------------------------------------------------------
    # Public: legacy flat-text extraction (kept for grammar / plagiarism)
    # ------------------------------------------------------------------

    def extract_text(self, file_content: bytes, filename: str) -> Dict[str, any]:
        """
        Extract text from uploaded file with comprehensive error handling
        
        Args:
            file_content: File bytes
            filename: Name of the file
            
        Returns:
            Dictionary with:
            - success: bool
            - text: str (extracted text)
            - file_type: str (pdf/docx/txt/latex)
            - char_count: int
            - word_count: int
            - line_count: int
            - error: str (if failed)
        """
        try:
            filename_lower = filename.lower()
            file_size = len(file_content)
            logger.info(f"Extracting text from {filename} (size: {file_size} bytes)")
            
            # Determine file type and extract
            if filename_lower.endswith('.pdf'):
                result = self._extract_from_pdf(file_content, filename)
            elif filename_lower.endswith('.docx'):
                result = self._extract_from_docx(file_content, filename)
            elif filename_lower.endswith('.txt'):
                result = self._extract_from_txt(file_content, filename)
            elif filename_lower.endswith(('.tex', '.latex')):
                result = self._extract_from_latex(file_content, filename)
            else:
                return {
                    'success': False,
                    'error': f'Unsupported file format. Supported: {", ".join(self.SUPPORTED_FORMATS)}',
                    'file_type': 'unknown'
                }
            
            if result['success']:
                # Add metadata
                text = result['text']
                result['char_count'] = len(text)
                result['word_count'] = len(text.split())
                result['line_count'] = len(text.split('\n'))
                logger.info(f"Extraction successful - {result['word_count']} words, {result['line_count']} lines")
            
            return result
            
        except Exception as e:
            logger.error(f"Unexpected error in extract_text: {str(e)}")
            return {
                'success': False,
                'error': f'Extraction failed: {str(e)}',
                'text': '',
                'file_type': 'unknown'
            }

    # ------------------------------------------------------------------
    # Structured extractors
    # ------------------------------------------------------------------

    def _structured_from_docx(self, file_content: bytes) -> List[Dict]:
        """
        Read DOCX paragraph styles to produce typed blocks.
        Heading 1/2/3 from the Word style map become structural markers.
        Tables are included as Normal blocks.
        """
        doc = docx.Document(io.BytesIO(file_content))
        blocks: List[Dict] = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            style_name = para.style.name if para.style else 'Normal'
            mapped = self._DOCX_HEADING_STYLES.get(style_name.lower(), 'Normal')
            blocks.append({'style': mapped, 'text': text})

        # Include table cell text as Normal blocks
        for table in doc.tables:
            for row in table.rows:
                row_text = '  |  '.join(
                    cell.text.strip() for cell in row.cells if cell.text.strip()
                )
                if row_text:
                    blocks.append({'style': 'Normal', 'text': row_text})

        if not blocks:
            raise ValueError('DOCX file appears to be empty')
        return blocks

    def _structured_from_pdf(self, file_content: bytes) -> List[Dict]:
        """
        Use pdfplumber to extract text with font-size metadata.

        Strategy:
          1. Crop the top 8 % and bottom 8 % of every page to exclude
             running headers, footers, and page numbers.
          2. Detect two-column layouts (e.g. IEEE) by finding a vertical gutter
             gap in the middle 40 % of the page width.  When found, words are
             reordered: full-width content first (title/abstract area), then
             the entire left column top-to-bottom, then the entire right column
             top-to-bottom.  This prevents left- and right-column sentences
             from being interleaved, which would corrupt citation context windows.
          3. Collect all word font-sizes across the document; compute the
             median (= body text size).
          4. A line whose average font size >= body_median * 1.20 OR whose
             fontname contains 'Bold' is treated as a heading.
          5. Lines are grouped by proximity (y-gap > 6 pt = new paragraph).
        """
        try:
            import pdfplumber
        except ImportError:
            raise ImportError(
                "pdfplumber is required for PDF extraction. "
                "Run: pip install pdfplumber"
            )

        all_sizes: List[float] = []
        pages_data: List[List[Dict]] = []   # per-page list of word dicts

        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            if not pdf.pages:
                raise ValueError('PDF is empty')

            for page in pdf.pages:
                h = page.height
                pw = page.width
                # Crop: exclude top 8 % and bottom 8 %
                cropped = page.crop((0, h * 0.08, pw, h * 0.92))
                # use_text_flow=False gives us raw positional data so we can
                # detect the gutter and reorder columns ourselves.
                raw_words = cropped.extract_words(
                    extra_attrs=['size', 'fontname'],
                    use_text_flow=False,
                    keep_blank_chars=False,
                    x_tolerance=3,
                    y_tolerance=3,
                )

                # ── Column detection ────────────────────────────────────────
                gutter = self._find_column_gutter(raw_words, pw)
                if gutter:
                    full_w, left_w, right_w = self._split_by_column(raw_words, gutter)
                    # Reading order: full-width span (title/abstract) first,
                    # then left column top→bottom, then right column top→bottom.
                    ordered = full_w + left_w + right_w
                    logger.debug(
                        "Two-column page: gutter=%.0f  full=%d  left=%d  right=%d",
                        gutter, len(full_w), len(left_w), len(right_w),
                    )
                else:
                    ordered = sorted(raw_words,
                                     key=lambda wd: (round(wd['top'], 1), wd['x0']))

                pages_data.append(ordered)
                for wd in ordered:
                    sz = wd.get('size') or 0
                    if sz > 0:
                        all_sizes.append(sz)

        if not all_sizes:
            raise ValueError('PDF appears to contain no selectable text (may be scanned image)')

        body_median = statistics.median(all_sizes)
        heading_threshold = body_median * 1.18   # 18 % larger than body = heading

        blocks: List[Dict] = []
        for words in pages_data:
            if not words:
                continue
            # Group words into lines by their top-y coordinate (within 3 pt)
            lines: List[List[Dict]] = []
            for w in words:
                if lines and abs(w['top'] - lines[-1][0]['top']) <= 3:
                    lines[-1].append(w)
                else:
                    lines.append([w])

            # Group consecutive lines into paragraphs (gap > 6 pt = new para)
            paras: List[List[List[Dict]]] = []
            for line in lines:
                if paras and (line[0]['top'] - paras[-1][-1][-1]['bottom']) <= 6:
                    paras[-1].append(line)
                else:
                    paras.append([line])

            for para_lines in paras:
                flat_words = [w for line in para_lines for w in line]
                text = ' '.join(w['text'] for w in flat_words).strip()
                if not text:
                    continue

                # Determine if this paragraph is a heading
                sizes = [w.get('size') or 0 for w in flat_words if w.get('size')]
                fonts = [w.get('fontname') or '' for w in flat_words]
                avg_size = statistics.mean(sizes) if sizes else 0
                is_bold = any('bold' in f.lower() for f in fonts)
                word_count = len(text.split())

                if word_count <= 12 and (
                    avg_size >= heading_threshold or
                    (is_bold and avg_size >= body_median * 1.05)
                ):
                    # Classify heading level by relative size
                    if avg_size >= body_median * 1.45:
                        style = 'Heading 1'
                    elif avg_size >= body_median * 1.28:
                        style = 'Heading 2'
                    else:
                        style = 'Heading 3'
                else:
                    style = 'Normal'

                # Fix hyphenated line-breaks (e.g. "meth-\nodology" → "methodology")
                text = re.sub(r'(\w)-\s+(\w)', r'\1\2', text)
                blocks.append({'style': style, 'text': text})

        if not blocks:
            raise ValueError('No text could be extracted from the PDF')
        return blocks

    # ------------------------------------------------------------------
    # Helper: two-column layout detection
    # ------------------------------------------------------------------

    @staticmethod
    def _find_column_gutter(words: List[Dict], page_width: float) -> Optional[float]:
        """
        Detect the x-coordinate of a two-column gutter, if one exists.

        Algorithm:
          - Focus on word x-midpoints in the central 40 % of the page (x in
            30 %–70 % of page width) — that is where a gutter must lie.
          - Find the largest gap between consecutive x-midpoints in that zone.
          - Accept it as a gutter only when it is >= 10 pt wide  (≈ 1/7 inch,
            which is narrower than any real IEEE gutter of ~17 pt).

        Returns gutter centre x, or None if the page appears single-column.
        """
        if len(words) < 20:
            return None

        lo, hi = page_width * 0.30, page_width * 0.70
        central = sorted(
            (w['x0'] + w['x1']) / 2.0
            for w in words
            if lo <= (w['x0'] + w['x1']) / 2.0 <= hi
        )

        if len(central) < 6:
            # Very sparse centre — likely already a wide gutter; fall back to
            # checking whether words cluster on both sides of the midpoint.
            left_n  = sum(1 for w in words if (w['x0'] + w['x1']) / 2.0 < page_width * 0.50)
            right_n = sum(1 for w in words if (w['x0'] + w['x1']) / 2.0 > page_width * 0.50)
            if left_n >= 10 and right_n >= 10:
                return page_width * 0.50
            return None

        gaps = [
            (central[i + 1] - central[i], (central[i] + central[i + 1]) / 2.0)
            for i in range(len(central) - 1)
        ]
        max_gap_size, max_gap_centre = max(gaps, key=lambda g: g[0])

        if max_gap_size < 10:
            return None

        logger.debug(
            "Two-column gutter at x=%.1f  gap=%.1f pt  page_w=%.0f",
            max_gap_centre, max_gap_size, page_width,
        )
        return max_gap_centre

    @staticmethod
    def _split_by_column(
        words: List[Dict], gutter: float
    ) -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """
        Partition words into three ordered lists:
          full_width  — words that physically straddle the gutter
                        (title block, abstract box, wide figures/tables)
          left_col    — words entirely left of the gutter
          right_col   — words entirely right of the gutter

        Each list is sorted top→bottom then left→right so that subsequent
        line-grouping logic produces correct reading order within each region.
        """
        key = lambda w: (round(w['top'], 1), w['x0'])
        full_width, left_col, right_col = [], [], []
        for w in words:
            x_mid = (w['x0'] + w['x1']) / 2.0
            if w['x0'] < gutter and w['x1'] > gutter:
                full_width.append(w)
            elif x_mid <= gutter:
                left_col.append(w)
            else:
                right_col.append(w)
        return sorted(full_width, key=key), sorted(left_col, key=key), sorted(right_col, key=key)

    # ------------------------------------------------------------------
    # Helper: convert flat text to blocks (used for TXT / LaTeX)
    # ------------------------------------------------------------------

    @staticmethod
    def _text_to_blocks(text: str) -> List[Dict]:
        """
        Heuristically annotate plain text with heading/normal styles.
        Rules (in priority order):
          1. ALL-CAPS short line  → Heading 1
          2. Numbered heading     → Heading 2  (e.g. "1. Introduction")
          3. Short line followed by blank line → Heading 3
          4. Everything else      → Normal
        """
        lines = text.splitlines()
        blocks: List[Dict] = []
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            wc = len(line.split())
            # ALL-CAPS heading
            if wc <= 8 and line == line.upper() and re.search(r'[A-Z]', line):
                blocks.append({'style': 'Heading 1', 'text': line.title()})
            # Numbered section like "1. Introduction" or "2.1 Related Work"
            elif re.match(r'^\d+(\.\d+)?\s+[A-Z]', line) and wc <= 10:
                blocks.append({'style': 'Heading 2', 'text': re.sub(r'^\d+(\.\d+)?\s+', '', line)})
            # Short line followed by blank — likely a heading
            elif wc <= 6 and i + 1 < len(lines) and not lines[i + 1].strip():
                blocks.append({'style': 'Heading 3', 'text': line})
            else:
                blocks.append({'style': 'Normal', 'text': line})
            i += 1
        return blocks

    @staticmethod
    def _decode(file_content: bytes) -> str:
        for enc in ('utf-8', 'latin-1', 'windows-1252'):
            try:
                return file_content.decode(enc)
            except UnicodeDecodeError:
                continue
        raise ValueError('Could not decode file content')
    
    def _extract_from_pdf(self, file_content: bytes, filename: str) -> Dict:
        """Extract flat text from PDF using pdfplumber (legacy path for grammar/plagiarism)."""
        try:
            blocks = self._structured_from_pdf(file_content)
            text = '\n'.join(
                ('\n' + b['text'] if b['style'].startswith('Heading') else b['text'])
                for b in blocks
            )
            if not text.strip():
                return {'success': False, 'error': 'PDF appears to be empty or image-only',
                        'text': '', 'file_type': 'pdf'}
            logger.info(f"PDF extraction complete - {len(text)} characters")
            return {'success': True, 'text': text, 'file_type': 'pdf'}
        except Exception as e:
            logger.error(f"PDF extraction error: {str(e)}")
            return {'success': False, 'error': f'Error reading PDF: {str(e)}',
                    'text': '', 'file_type': 'pdf'}
    
    def _extract_from_docx(self, file_content: bytes, filename: str) -> Dict:
        """Extract flat text from DOCX (legacy path for grammar/plagiarism)."""
        try:
            blocks = self._structured_from_docx(file_content)
            text = '\n'.join(
                ('\n' + b['text'] if b['style'].startswith('Heading') or b['style'] == 'Title' else b['text'])
                for b in blocks
            )
            if not text.strip():
                return {'success': False, 'error': 'DOCX file appears to be empty',
                        'text': '', 'file_type': 'docx'}
            logger.info(f"DOCX extraction complete - {len(text)} characters")
            return {'success': True, 'text': text, 'file_type': 'docx'}
        except Exception as e:
            logger.error(f"DOCX extraction error: {str(e)}")
            return {'success': False, 'error': f'Error reading DOCX: {str(e)}',
                    'text': '', 'file_type': 'docx'}
    
    def _extract_from_txt(self, file_content: bytes, filename: str) -> Dict:
        """Extract text from TXT file"""
        try:
            text = self._decode(file_content)
            
            if not text.strip():
                return {
                    'success': False,
                    'error': 'Text file is empty',
                    'text': '',
                    'file_type': 'txt'
                }
            
            logger.info(f"TXT extraction complete - {len(text)} characters")
            return {
                'success': True,
                'text': text,
                'file_type': 'txt'
            }
            
        except Exception as e:
            logger.error(f"TXT decoding error: {str(e)}")
            return {
                'success': False,
                'error': f'Error reading TXT file: {str(e)}',
                'text': '',
                'file_type': 'txt'
            }
    
    def _extract_from_latex(self, file_content: bytes, filename: str) -> Dict:
        """Extract text from LaTeX file, removing LaTeX commands"""
        try:
            # Decode LaTeX file
            try:
                text = file_content.decode('utf-8')
            except UnicodeDecodeError:
                text = file_content.decode('latin-1')
            
            # Remove LaTeX commands but keep content
            cleaned_text = self._clean_latex(text)
            
            if not cleaned_text.strip():
                return {
                    'success': False,
                    'error': 'LaTeX file appears to be empty after processing',
                    'text': '',
                    'file_type': 'latex'
                }
            
            logger.info(f"LaTeX extraction complete - {len(cleaned_text)} characters")
            return {
                'success': True,
                'text': cleaned_text,
                'file_type': 'latex',
                'original_latex': text  # Keep original for reference
            }
            
        except Exception as e:
            logger.error(f"LaTeX extraction error: {str(e)}")
            return {
                'success': False,
                'error': f'Error reading LaTeX file: {str(e)}',
                'text': '',
                'file_type': 'latex'
            }
    
    def _clean_latex(self, latex_text: str) -> str:
        """
        Remove LaTeX commands and keep readable text
        
        Args:
            latex_text: Raw LaTeX text
            
        Returns:
            Cleaned text without LaTeX commands
        """
        text = latex_text
        
        # Remove comments
        text = re.sub(r'%.*?\n', '\n', text)
        
        # Remove preamble (everything before \begin{document})
        doc_start = text.find(r'\begin{document}')
        if doc_start != -1:
            text = text[doc_start:]
        
        # Remove \end{document} and everything after
        doc_end = text.find(r'\end{document}')
        if doc_end != -1:
            text = text[:doc_end]
        
        # Remove common commands but keep their content
        # \textbf{text} -> text
        text = re.sub(r'\\textbf\{([^}]*)\}', r'\1', text)
        text = re.sub(r'\\textit\{([^}]*)\}', r'\1', text)
        text = re.sub(r'\\emph\{([^}]*)\}', r'\1', text)
        text = re.sub(r'\\underline\{([^}]*)\}', r'\1', text)
        
        # Remove section commands but keep titles
        text = re.sub(r'\\section\{([^}]*)\}', r'\n\n\1\n', text)
        text = re.sub(r'\\subsection\{([^}]*)\}', r'\n\1\n', text)
        text = re.sub(r'\\subsubsection\{([^}]*)\}', r'\n\1\n', text)
        text = re.sub(r'\\chapter\{([^}]*)\}', r'\n\n\1\n\n', text)
        
        # Remove citations but keep them marked
        text = re.sub(r'\\cite\{([^}]*)\}', r'[Citation: \1]', text)
        text = re.sub(r'\\citep\{([^}]*)\}', r'[\1]', text)
        text = re.sub(r'\\citet\{([^}]*)\}', r'\1', text)
        
        # Remove labels and refs
        text = re.sub(r'\\label\{[^}]*\}', '', text)
        text = re.sub(r'\\ref\{([^}]*)\}', r'[ref]', text)
        
        # Remove begin/end environments but keep content
        text = re.sub(r'\\begin\{([^}]*)\}', '', text)
        text = re.sub(r'\\end\{([^}]*)\}', '', text)
        
        # Remove remaining simple commands
        text = re.sub(r'\\[a-zA-Z]+(\[[^\]]*\])?\{([^}]*)\}', r'\2', text)
        
        # Remove remaining backslash commands
        text = re.sub(r'\\[a-zA-Z]+', '', text)
        
        # Clean up extra whitespace
        text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
        text = re.sub(r' +', ' ', text)
        
        return text.strip()
    
    def is_supported(self, filename: str) -> bool:
        """
        Check if file format is supported
        
        Args:
            filename: Name of the file
            
        Returns:
            True if supported, False otherwise
        """
        filename_lower = filename.lower()
        return any(filename_lower.endswith(fmt) for fmt in self.SUPPORTED_FORMATS)
    
    def get_file_type(self, filename: str) -> Optional[str]:
        """
        Get file type from filename
        
        Args:
            filename: Name of the file
            
        Returns:
            File type (pdf/docx/txt/latex) or None
        """
        filename_lower = filename.lower()
        if filename_lower.endswith('.pdf'):
            return 'pdf'
        elif filename_lower.endswith('.docx'):
            return 'docx'
        elif filename_lower.endswith('.txt'):
            return 'txt'
        elif filename_lower.endswith(('.tex', '.latex')):
            return 'latex'
        return None
