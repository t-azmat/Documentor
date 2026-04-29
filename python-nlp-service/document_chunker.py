"""
Document Chunker - Builds structured DocumentIR from extracted TextBlocks

Processes flat list of TextBlocks into a hierarchical document structure
with properly nested sections, merged paragraphs, and grouped lists.
"""

import re
from typing import List, Dict, Optional
from document_model import TextBlock, BlockType, DocumentSection, DocumentIR


class DocumentChunker:
    """Build structured DocumentIR from flat TextBlock list"""

    SECTION_KEYWORDS = {
        'abstract': ['abstract', 'summary', 'overview'],
        'introduction': ['introduction', 'background', 'motivation', 'problem statement'],
        'methodology': ['methodology', 'methods', 'approach', 'procedure', 'research design'],
        'results': ['results', 'findings', 'outcomes', 'analysis'],
        'discussion': ['discussion', 'implications', 'significance', 'limitations'],
        'conclusion': ['conclusion', 'conclusions', 'concluding remarks', 'final remarks'],
        'references': ['references', 'bibliography', 'cited works', 'works cited'],
        'acknowledgements': ['acknowledgements', 'acknowledgments', 'thanks'],
    }

    def __init__(self):
        self.blocks: List[TextBlock] = []
        self.modal_font_size = 0.0

    @staticmethod
    def _normalize_heading(text: str) -> str:
        return re.sub(r'\s+', ' ', (text or '').strip()).lower()

    @staticmethod
    def _normalize_toc_entries(table_of_contents: Optional[List[Dict]]) -> List[Dict]:
        normalized = []
        for idx, entry in enumerate(table_of_contents or []):
            text = str(entry.get('text', '')).strip()
            if not text:
                continue
            level = entry.get('level', 1)
            try:
                level = int(level)
            except (TypeError, ValueError):
                level = 1
            normalized.append({
                'text': text,
                'normalized': DocumentChunker._normalize_heading(text),
                'level': max(1, min(level, 6)),
                'index': entry.get('index', idx)
            })
        return normalized

    def chunk(self, text: str, title: str = "Untitled") -> List[Dict]:
        """
        Legacy interface: takes raw text and returns list of chunk dicts.
        Expected format: [{"id": int, "section_type": str, "heading": str, "text": str, ...}]
        This is for backward compatibility with ai_document_formatter.
        """
        if not text.strip():
            return []
        blocks = self._text_to_structured_blocks(text)
        return self.chunk_blocks(blocks, title=title)

    def chunk_blocks(
        self,
        structured_blocks: List[Dict],
        title: str = "Untitled",
        table_of_contents: Optional[List[Dict]] = None
    ) -> List[Dict]:
        """
        Process structured blocks from FileExtractor (dicts with 'style' and 'text').
        Converts style information to section chunks compatible with formatter.
        
        Input format: [{"style": "Heading 1", "text": "..."}, ...]
        Output format: [{"id": 1, "section_type": "...", "heading": "...", "text": "...", ...}]
        """
        if not structured_blocks:
            return []
        
        normalized_toc = self._normalize_toc_entries(table_of_contents)

        chunks = []
        chunk_id = 1
        current_section = None
        current_blocks = []
        char_cursor = 0

        def flush_current():
            nonlocal chunk_id, current_blocks, current_section, char_cursor
            if current_section is None:
                return

            block_texts = [b.get('text', '').strip() for b in current_blocks if b.get('text', '').strip()]
            section_text = '\n\n'.join(block_texts).strip()
            if not section_text and current_section.get('heading'):
                section_text = current_section['heading']

            if not section_text:
                return

            start = char_cursor
            char_cursor += len(section_text)

            chunks.append({
                "id": chunk_id,
                "section_type": self._match_section_type(current_section['heading']),
                "heading": current_section['heading'],
                "text": section_text,
                "word_count": len(section_text.split()),
                "char_start": start,
                "char_end": char_cursor,
                "sub_chunk": 0,
                "section_level": current_section.get('level', 1),
                "block_count": len(current_blocks),
                "blocks": list(current_blocks),
            })
            chunk_id += 1
            char_cursor += 2

        for idx, block in enumerate(structured_blocks):
            text = block.get('text', '').strip()
            if not text:
                continue

            level = self._extract_section_level(block, normalized_toc)
            is_heading = level > 0

            if is_heading:
                flush_current()
                current_section = {
                    'heading': text,
                    'style': block.get('style', 'Heading 1'),
                    'level': level,
                    'index': idx
                }
                current_blocks = []
                continue

            if current_section is None:
                current_section = {
                    'heading': title,
                    'style': 'Title',
                    'level': 1,
                    'index': 0
                }
                current_blocks = []

            current_blocks.append(block)

        flush_current()
        return chunks

    def chunk_textblocks(self, blocks: List[TextBlock],
                         source_filename: str = "") -> DocumentIR:
        """
        Internal method: takes flat TextBlock list, builds structured DocumentIR.
        For internal use only - not part of the AI formatter pipeline.
        """
        self.blocks = blocks
        
        # PHASE 1 — Strip noise blocks
        self.blocks = self._strip_noise_blocks(self.blocks)
        
        # PHASE 2 — Extract title page content
        title, authors, institution, abstract, keywords = self._extract_title_page()
        
        # PHASE 3 — Build section tree
        sections, heading_blocks = self._build_section_tree()
        
        # PHASE 4 — Merge paragraph continuations
        self._merge_paragraph_continuations(sections)
        
        # PHASE 5 — Build list groups
        self._build_list_groups(sections)
        
        # PHASE 6 — Extract references
        references_raw = self._extract_references()
        
        # PHASE 7 — Assemble DocumentIR
        ir = DocumentIR(
            title=title,
            authors=authors,
            institution=institution,
            abstract=abstract,
            keywords=keywords,
            sections=sections,
            all_blocks=self.blocks,
            references_raw=references_raw,
            page_count=max((b.page_num for b in self.blocks), default=1),
            source_filename=source_filename
        )
        
        return ir

    def _strip_noise_blocks(self, blocks: List[TextBlock]) -> List[TextBlock]:
        """Remove running headers and empty blocks"""
        cleaned = []
        for block in blocks:
            # Skip running headers
            if block.block_type == BlockType.RUNNING_HEADER:
                continue
            # Skip empty text
            if not block.text.strip() or len(block.text.strip()) < 3:
                continue
            cleaned.append(block)
        return cleaned

    def _extract_title_page(self) -> tuple:
        """Extract title, authors, institution, abstract, keywords from page 1"""
        title = ""
        authors = []
        institution = ""
        abstract_text = ""
        keywords = []

        # Find title (largest font on page 1)
        page1_blocks = [b for b in self.blocks if b.page_num == 1]
        if page1_blocks:
            title_block = max(
                (b for b in page1_blocks if b.block_type in (BlockType.TITLE_PAGE, BlockType.HEADING)),
                key=lambda b: b.font_size,
                default=None
            )
            if title_block:
                title = title_block.text.strip()

        # Find authors (title case text on page 1)
        for block in page1_blocks:
            if block.block_type == BlockType.TITLE_PAGE and block != title_block:
                text = block.text.strip()
                # Simple heuristic: proper capitalized names
                if re.match(r'^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$', text):
                    if len(text.split()) <= 4:  # Name should have 1-4 words
                        authors.append(text)

        # Find institution
        for block in page1_blocks:
            if any(word in block.text.lower() for word in ['university', 'college', 'institute', 'school', 'department']):
                institution = block.text.strip()
                break

        # Find abstract
        abstract_block = None
        for i, block in enumerate(self.blocks):
            if block.block_type == BlockType.HEADING and 'abstract' in block.text.lower():
                # Next non-heading block is the abstract
                for j in range(i + 1, len(self.blocks)):
                    if self.blocks[j].block_type != BlockType.HEADING:
                        abstract_block = self.blocks[j]
                        break
                break

        if abstract_block:
            abstract_text = abstract_block.text.strip()
            # Extract keywords if present
            if 'keywords' in abstract_text.lower():
                match = re.search(r'keywords?\s*[:\-]\s*(.+?)(?:\.|$)', abstract_text, re.IGNORECASE)
                if match:
                    keywords_text = match.group(1)
                    keywords = [k.strip() for k in keywords_text.split(',')]

        return title, authors, institution, abstract_text, keywords

    def _build_section_tree(self) -> tuple:
        """Build hierarchical section tree from heading blocks"""
        sections = []
        stack = []  # Stack of (level, section) for nesting

        section_num = {1: 0, 2: 0, 3: 0}

        for block in self.blocks:
            if block.block_type == BlockType.HEADING:
                level = block.level
                section_num[level] += 1
                # Reset lower-level counters
                for l in range(level + 1, 4):
                    section_num[l] = 0

                # Build section_id
                section_id = ".".join(str(section_num[i]) for i in range(1, level + 1))
                section_id = "s" + section_id

                section_type = self._match_section_type(block.text)

                sec = DocumentSection(
                    section_id=section_id,
                    heading=self._clean_heading(block.text),
                    level=level,
                    section_type=section_type,
                    page_start=block.page_num,
                    page_end=block.page_num
                )

                # Add to tree
                if level == 1:
                    sections.append(sec)
                    stack = [(1, sec)]
                elif level == 2:
                    if stack and stack[-1][0] == 1:
                        stack[-1][1].subsections.append(sec)
                        stack = [(1, stack[-1][1]), (2, sec)]
                elif level == 3:
                    if len(stack) >= 2 and stack[-1][0] == 2:
                        stack[-1][1].subsections.append(sec)
                        stack = [(1, stack[0][1]), (2, stack[1][1]), (3, sec)]

            else:
                # Add block to current section
                if stack:
                    current_section = stack[-1][1]
                    current_section.blocks.append(block)
                    current_section.page_end = max(current_section.page_end, block.page_num)

        return sections, [b for b in self.blocks if b.block_type == BlockType.HEADING]

    def _match_section_type(self, heading_text: str) -> str:
        """Match heading text to section types"""
        heading_lower = heading_text.lower()
        for section_type, keywords in self.SECTION_KEYWORDS.items():
            for keyword in keywords:
                if keyword in heading_lower:
                    return section_type
        return "generic"

    def _extract_section_level(self, block: Dict, normalized_toc: Optional[List[Dict]] = None) -> int:
        explicit_level = block.get('section_level')
        try:
            explicit_level = int(explicit_level)
        except (TypeError, ValueError):
            explicit_level = 0
        if explicit_level > 0:
            return max(1, min(explicit_level, 6))

        style = str(block.get('style', ''))
        text = str(block.get('text', '')).strip()

        if style == 'Title':
            return 1

        match = re.search(r'Heading\s*(\d+)', style, re.IGNORECASE)
        if match:
            return max(1, min(int(match.group(1)), 6))

        normalized = self._normalize_heading(text)
        for toc_entry in normalized_toc or []:
            if toc_entry['normalized'] == normalized:
                return toc_entry['level']

        return 0

    def _text_to_structured_blocks(self, text: str) -> List[Dict]:
        blocks = []
        lines = text.splitlines()
        paragraph_buffer = []

        def flush_paragraph():
            nonlocal paragraph_buffer
            paragraph = ' '.join(part.strip() for part in paragraph_buffer if part.strip()).strip()
            if paragraph:
                blocks.append({'style': 'Normal', 'text': paragraph})
            paragraph_buffer = []

        for line in lines:
            stripped = line.strip()
            if not stripped:
                flush_paragraph()
                continue

            heading_match = re.match(r'^(#{1,6})\s+(.+)$', stripped)
            if heading_match:
                flush_paragraph()
                level = len(heading_match.group(1))
                blocks.append({
                    'style': f'Heading {level}',
                    'text': heading_match.group(2).strip(),
                    'section_level': level
                })
                continue

            if re.match(r'^\d+(?:\.\d+)*\s+[A-Z]', stripped) and len(stripped.split()) <= 12:
                flush_paragraph()
                blocks.append({
                    'style': 'Heading 2',
                    'text': re.sub(r'^\d+(?:\.\d+)*\s+', '', stripped),
                    'section_level': 2
                })
                continue

            paragraph_buffer.append(stripped)

        flush_paragraph()
        return blocks

    def _clean_heading(self, text: str) -> str:
        """Remove leading numbers/dots from heading"""
        return re.sub(r'^(\d+(\.\d+)*\s*[:\.\-]?\s*)', '', text).strip()

    def _merge_paragraph_continuations(self, sections: List[DocumentSection]):
        """Merge paragraphs that were split across pages"""
        for section in sections:
            self._merge_paragraphs_in_section(section)
            for subsection in section.subsections:
                self._merge_paragraphs_in_section(subsection)

    def _merge_paragraphs_in_section(self, section: DocumentSection):
        """Merge continuation paragraphs within a section"""
        merged_blocks = []
        i = 0
        while i < len(section.blocks):
            block = section.blocks[i]
            if (block.block_type == BlockType.PARAGRAPH and
                i + 1 < len(section.blocks) and
                section.blocks[i + 1].block_type == BlockType.PARAGRAPH and
                section.blocks[i + 1].continues_from_prev):
                # Merge with next
                merged_text = block.text + " " + section.blocks[i + 1].text
                merged_block = TextBlock(
                    block_type=BlockType.PARAGRAPH,
                    text=merged_text,
                    level=1,
                    page_num=block.page_num,
                    font_size=block.font_size
                )
                merged_blocks.append(merged_block)
                i += 2
            else:
                merged_blocks.append(block)
                i += 1
        section.blocks = merged_blocks

    def _build_list_groups(self, sections: List[DocumentSection]):
        """Group consecutive list items into single list blocks"""
        for section in sections:
            self._group_lists_in_section(section)
            for subsection in section.subsections:
                self._group_lists_in_section(subsection)

    def _group_lists_in_section(self, section: DocumentSection):
        """Group list items in a section"""
        grouped_blocks = []
        i = 0
        while i < len(section.blocks):
            block = section.blocks[i]
            if block.block_type in (BlockType.BULLET_LIST, BlockType.NUMBERED_LIST):
                list_type = block.block_type
                list_items = [block.text]
                list_markers = [block.list_marker]
                j = i + 1
                # Collect consecutive list items of same type
                while j < len(section.blocks):
                    next_block = section.blocks[j]
                    if next_block.block_type == list_type:
                        list_items.append(next_block.text)
                        list_markers.append(next_block.list_marker)
                        j += 1
                    else:
                        break
                
                # Combine into single list block
                if list_type == BlockType.BULLET_LIST:
                    formatted_text = "\n".join(f"• {item}" for item in list_items)
                else:
                    formatted_text = "\n".join(f"{i+1}. {item}" for i, item in enumerate(list_items))
                
                combined_block = TextBlock(
                    block_type=list_type,
                    text=formatted_text,
                    level=1,
                    page_num=block.page_num,
                    font_size=block.font_size
                )
                grouped_blocks.append(combined_block)
                i = j
            else:
                grouped_blocks.append(block)
                i += 1
        section.blocks = grouped_blocks

    def build_tree(self, flat_chunks: List[Dict], title: str = "Untitled") -> Dict:
        """
        Build a nested section tree from flat chunks.
        
        Takes the output of chunk_blocks() (flat list of dicts with section_type, heading, text)
        and builds a hierarchical tree structure for LaTeX generation.
        
        Returns a dict representing the root of the tree with nested subsections.
        """
        if not flat_chunks:
            return {
                "section_id": "root",
                "heading": title,
                "level": 0,
                "section_type": "root",
                "text": "",
                "word_count": 0,
                "subsections": []
            }
        
        # Create root node
        root = {
            "section_id": "root",
            "heading": title,
            "level": 0,
            "section_type": "root",
            "text": "",
            "word_count": 0,
            "subsections": []
        }
        
        # Stack to track the current nesting level
        stack = [root]
        
        for chunk in flat_chunks:
            # Infer heading level from section type or heading text
            heading = chunk.get("heading", "")
            section_type = chunk.get("section_type", "generic")
            
            level = chunk.get("section_level", 1)
            try:
                level = int(level)
            except (TypeError, ValueError):
                level = 1
            level = max(1, min(level, 6))
            
            # Create node for this chunk
            node = {
                "section_id": chunk.get("id", ""),
                "heading": heading,
                "level": level,
                "section_type": section_type,
                "text": chunk.get("text", ""),
                "word_count": chunk.get("word_count", 0),
                "subsections": []
            }
            
            # Find proper parent and add as child
            while len(stack) > 1 and stack[-1]["level"] >= level:
                stack.pop()
            
            stack[-1]["subsections"].append(node)
            
            # If this node has children, add it to stack
            if level < 3:  # Don't nest deeper than level 3
                stack.append(node)
        
        return root

    def _extract_references(self) -> List[str]:
        """Extract raw reference strings"""
        references = []
        in_references = False
        for block in self.blocks:
            if block.block_type == BlockType.HEADING and 'references' in block.text.lower():
                in_references = True
                continue
            if in_references and block.block_type in (BlockType.HEADING, BlockType.UNKNOWN):
                break
            if in_references and block.block_type == BlockType.REFERENCE_ENTRY:
                references.append(block.text)
        return references

    def to_formatter_input(self, ir: DocumentIR) -> dict:
        """
        Converts DocumentIR to the dict format expected by
        formatting_engine.format_document()
        """
        def section_to_dict(sec: DocumentSection) -> dict:
            return {
                "section_type": sec.section_type,
                "heading": sec.heading,
                "level": sec.level,
                "text": sec.get_full_text(),
                "subsections": [section_to_dict(s) for s in sec.subsections]
            }

        return {
            "title": ir.title,
            "authors": ir.authors,
            "institution": ir.institution,
            "abstract": ir.abstract,
            "keywords": ir.keywords,
            "sections": [section_to_dict(s) for s in ir.sections
                         if s.section_type != "references"],
            "references": [{"raw_text": r} for r in ir.references_raw]
        }
