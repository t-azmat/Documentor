import re
from typing import List, Dict
from collections import Counter
import pdfplumber
from document_model import TextBlock, BlockType


def extract_pdf_complete(pdf_path: str) -> Dict:
    """
    Compatibility wrapper for existing extraction pipeline.
    Extracts PDF and returns in legacy format expected by Flask app.
    """
    try:
        extractor = PDFExtractor()
        blocks = extractor.extract(pdf_path)
        
        # Convert TextBlock objects to legacy format
        text_parts = []
        structure = []
        
        for block in blocks:
            text_parts.append(block.text)
            
            structure.append({
                'type': block.block_type.value,
                'content': block.text,
                'level': block.level,
                'font_size': block.font_size,
                'is_bold': block.is_bold,
                'page': block.page_num
            })
        
        full_text = ' '.join(text_parts)
        
        return {
            'text': full_text,
            'word_count': len(full_text.split()),
            'structure': structure,
            'media': [],
            'blocks': blocks  # Also return structured blocks for intelligent formatting
        }
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return {
            'text': '',
            'word_count': 0,
            'structure': [],
            'media': [],
            'error': str(e)
        }


class PDFExtractor:
    def __init__(self):
        self.blocks = []
        self.modal_font_size = 12.0

    def extract(self, pdf_path: str) -> List[TextBlock]:
        self.blocks = []
        self.modal_font_size = 12.0
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    self._extract_page_blocks(page, page_num)
                self._compute_modal_font_size()
                self._reclassify_with_modal_size()
                return self.blocks
        except Exception as e:
            print(f"PDF extraction error: {e}")
            return []

    def _extract_page_blocks(self, page, page_num: int):
        try:
            words = page.extract_words(extra_attrs=["size", "fontname"], keep_blank_chars=False, use_text_flow=True)
            if not words:
                return
            lines = self._group_words_into_lines(words)
            blocks_on_page = self._group_lines_into_blocks(lines, page_num)
            for block in blocks_on_page:
                if block:
                    self.blocks.append(block)
        except Exception as e:
            print(f"Error extracting page {page_num}: {e}")

    def _group_words_into_lines(self, words: List[Dict]) -> List[List[Dict]]:
        if not words:
            return []
        sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
        lines = []
        current_line = [sorted_words[0]]
        for word in sorted_words[1:]:
            if abs(word["top"] - current_line[0]["top"]) <= 2:
                current_line.append(word)
            else:
                lines.append(current_line)
                current_line = [word]
        if current_line:
            lines.append(current_line)
        return lines

    def _group_lines_into_blocks(self, lines: List[List[Dict]], page_num: int) -> List[TextBlock]:
        blocks = []
        if not lines:
            return blocks
        current_block_lines = [lines[0]]
        for line in lines[1:]:
            line_height = line[0].get("size", 12) if line else 12
            prev_bottom = max(w["bottom"] for w in current_block_lines[-1])
            curr_top = min(w["top"] for w in line)
            gap = curr_top - prev_bottom
            threshold = 1.5 * line_height
            if gap <= threshold:
                current_block_lines.append(line)
            else:
                block = self._lines_to_block(current_block_lines, page_num)
                if block:
                    blocks.append(block)
                current_block_lines = [line]
        if current_block_lines:
            block = self._lines_to_block(current_block_lines, page_num)
            if block:
                blocks.append(block)
        return blocks

    def _lines_to_block(self, lines: List[List[Dict]], page_num: int) -> TextBlock:
        all_words = [w for line in lines for w in line]
        if not all_words:
            return None
        text_parts = []
        for line in lines:
            line_text = " ".join(w["text"] for w in line)
            text_parts.append(line_text)
        text = " ".join(text_parts)
        font_sizes = [w.get("size", 0) for w in all_words]
        avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 0.0
        fontnames = [w.get("fontname", "") for w in all_words]
        bold_count = sum(1 for fn in fontnames if "Bold" in fn)
        italic_count = sum(1 for fn in fontnames if "Italic" in fn)
        is_bold = bold_count > len(fontnames) / 2
        is_italic = italic_count > len(fontnames) / 2
        x0 = min(w["x0"] for w in all_words)
        y0 = min(w["top"] for w in all_words)
        x1 = max(w["x1"] for w in all_words)
        y1 = max(w["bottom"] for w in all_words)
        bbox = (x0, y0, x1, y1)
        block_type = self._classify_block(text, avg_font_size, is_bold, is_italic, page_num)
        return TextBlock(block_type=block_type, text=text, level=1, page_num=page_num, bbox=bbox, font_size=avg_font_size, is_bold=is_bold, is_italic=is_italic)

    def _classify_block(self, text: str, font_size: float, is_bold: bool, is_italic: bool, page_num: int) -> BlockType:
        text = text.strip()
        if not text or len(text) < 3:
            return BlockType.UNKNOWN
        word_count = len(text.split())
        
        if len(text) < 80 and word_count < 15:
            if re.search(r'\d+\s*$', text):
                return BlockType.RUNNING_HEADER
        
        if page_num == 1 and font_size > 16:
            return BlockType.TITLE_PAGE
        
        if font_size > self.modal_font_size + 1.5:
            return BlockType.HEADING
        if self._looks_like_heading(text):
            return BlockType.HEADING
        if is_bold and 2 <= word_count <= 8:
            return BlockType.HEADING
        
        if self._is_bullet_list(text):
            return BlockType.BULLET_LIST
        if self._is_numbered_list(text):
            return BlockType.NUMBERED_LIST
        
        if self._looks_like_reference(text):
            return BlockType.REFERENCE_ENTRY
        
        if self._looks_like_quote(text):
            return BlockType.BLOCK_QUOTE
        
        return BlockType.PARAGRAPH

    def _looks_like_heading(self, text: str) -> bool:
        word_count = len(text.split())
        if word_count > 10 or len(text) > 80:
            return False
        if re.match(r'^\d+(\.\d+)*\s+[A-Z]', text):
            return True
        return False

    def _is_bullet_list(self, text: str) -> bool:
        bullet_markers = ['•', '-', '*', '◦', '▪', '–']
        for marker in bullet_markers:
            if text.startswith(marker):
                return True
        if re.match(r'^[a-zA-Z0-9ivxlcdm]{1,3}[\)\.\:]', text):
            return True
        return False

    def _is_numbered_list(self, text: str) -> bool:
        if re.match(r'^\d+[\.\):\-]\s+', text):
            return True
        return False

    def _looks_like_reference(self, text: str) -> bool:
        if re.match(r'^\[\d+\]', text):
            return True
        if re.match(r'^[A-Z][a-z]+,?\s+[A-Z]\.?.*\(\d{4}\)', text):
            return True
        return False

    def _looks_like_quote(self, text: str) -> bool:
        if text.startswith('"') or text.startswith('"'):
            return True
        return False

    def _compute_modal_font_size(self):
        paragraph_sizes = [b.font_size for b in self.blocks if b.block_type == BlockType.PARAGRAPH and b.font_size > 0]
        if paragraph_sizes:
            size_counter = Counter([round(s) for s in paragraph_sizes])
            self.modal_font_size = size_counter.most_common(1)[0][0]
        else:
            all_sizes = [b.font_size for b in self.blocks if b.block_type != BlockType.TITLE_PAGE and b.font_size > 0]
            if all_sizes:
                self.modal_font_size = sum(all_sizes) / len(all_sizes)

    def _reclassify_with_modal_size(self):
        for block in self.blocks:
            new_block_type = self._classify_block(block.text, block.font_size, block.is_bold, block.is_italic, block.page_num)
            block.block_type = new_block_type
            if block.block_type == BlockType.HEADING:
                if block.font_size >= self.modal_font_size + 3:
                    block.level = 1
                elif block.font_size >= self.modal_font_size + 1:
                    block.level = 2
                else:
                    block.level = 3
                match = re.match(r'^(\d+)(\.(\d+))?', block.text.strip())
                if match:
                    if match.group(3):
                        block.level = 2
                    else:
                        block.level = 1
