"""
Document Data Model - TextBlock and DocumentIR dataclasses

Defines the canonical representation of extracted documents with full
structural metadata preserved for accurate formatting and analysis.
"""

from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum


class BlockType(Enum):
    """Classification of document blocks"""
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    BULLET_LIST = "bullet_list"
    NUMBERED_LIST = "numbered_list"
    BLOCK_QUOTE = "block_quote"
    CAPTION = "caption"
    RUNNING_HEADER = "running_header"  # page headers/footers — to be stripped
    TITLE_PAGE = "title_page"
    REFERENCE_ENTRY = "reference_entry"
    UNKNOWN = "unknown"


@dataclass
class TextBlock:
    """Individual text block extracted from document with metadata"""
    block_type: BlockType
    text: str                      # full text content of this block
    level: int = 1                 # heading level (1/2/3) or list depth
    page_num: int = 0              # which page this block came from (1-indexed)
    bbox: Optional[tuple] = None   # (x0, y0, x1, y1) bounding box
    font_size: float = 0.0         # average font size
    is_bold: bool = False
    is_italic: bool = False

    # For list items — tracks the list they belong to
    list_index: Optional[int] = None   # position within list (1-based)
    list_marker: str = ""              # original marker: "•", "1.", "a)", etc.

    # For paragraphs — merge tracking
    continues_from_prev: bool = False  # True if continuation of split paragraph

    # For headings — section tracking
    section_id: str = ""           # e.g. "s1", "s1.2", "s1.2.3"

    def __repr__(self) -> str:
        marker = f" (marker={self.list_marker})" if self.list_marker else ""
        level = f" (level={self.level})" if self.level > 1 else ""
        return f"TextBlock({self.block_type.value}{level}{marker}, page={self.page_num}, '{self.text[:50]}...')"


@dataclass
class DocumentSection:
    """Represents a single document section (heading + content + subsections)"""
    section_id: str                # "s1", "s1.2", "s1.2.3"
    heading: str                   # heading text cleaned
    level: int                     # 1, 2, or 3
    section_type: str              # "abstract", "introduction", etc. or "generic"
    blocks: List[TextBlock] = field(default_factory=list)
    subsections: List['DocumentSection'] = field(default_factory=list)
    page_start: int = 0
    page_end: int = 0

    def get_full_text(self) -> str:
        """
        Returns all paragraph text merged in order,
        properly joining continuation paragraphs.
        """
        parts = []
        pending = []
        
        for block in self.blocks:
            if block.block_type == BlockType.PARAGRAPH:
                if block.continues_from_prev and pending:
                    # Continuation of previous paragraph
                    pending.append(block.text)
                else:
                    # New paragraph
                    if pending:
                        parts.append(" ".join(pending))
                    pending = [block.text]
            elif block.block_type in (BlockType.BULLET_LIST,
                                       BlockType.NUMBERED_LIST):
                # List blocks
                if pending:
                    parts.append(" ".join(pending))
                    pending = []
                parts.append(block.text)
            else:
                # Other block types
                if pending:
                    parts.append(" ".join(pending))
                    pending = []
                if block.text:
                    parts.append(block.text)
        
        # Don't forget the last pending paragraph
        if pending:
            parts.append(" ".join(pending))
        
        return "\n\n".join(parts)

    def __repr__(self) -> str:
        return f"DocumentSection({self.section_id} {self.heading}, level={self.level}, blocks={len(self.blocks)})"


@dataclass
class DocumentIR:
    """
    Internal Representation of a complete document.
    This is the canonical format passed downstream to formatting engine.
    """
    title: str
    authors: List[str]
    institution: str
    abstract: str
    keywords: List[str]
    sections: List[DocumentSection]     # top-level sections only
    all_blocks: List[TextBlock]         # flat ordered list of ALL blocks
    references_raw: List[str]           # raw reference strings
    page_count: int
    source_filename: str

    def __repr__(self) -> str:
        return (f"DocumentIR(\n"
                f"  title={self.title!r},\n"
                f"  authors={self.authors},\n"
                f"  pages={self.page_count},\n"
                f"  sections={len(self.sections)},\n"
                f"  blocks={len(self.all_blocks)},\n"
                f"  references={len(self.references_raw)}\n"
                f")")
