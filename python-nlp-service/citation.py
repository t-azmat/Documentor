"""
Citation Manager Module
Handles citation formatting for various academic styles (APA, MLA, Chicago, Harvard)
"""

import re
from datetime import datetime
from typing import List, Dict, Tuple
from file_extractor import FileExtractor


class CitationManager:
    """Manages citation detection and formatting for academic documents"""
    
    CITATION_STYLES = {
        'APA': 'American Psychological Association (7th ed.)',
        'MLA': 'Modern Language Association (9th ed.)',
        'Chicago': 'Chicago Manual of Style (17th ed.)',
        'Harvard': 'Harvard Referencing Style'
    }
    
    def __init__(self):
        """Initialize the Citation Manager"""
        self.detected_citations = []
        self.references = []
        self.citation_to_reference_map = {}
        self.file_extractor = FileExtractor()
        
    def detect_citation_style(self, text: str) -> str:
        """
        Detect the citation style used in the document
        
        Args:
            text: Document text
            
        Returns:
            Detected citation style (APA, MLA, Chicago, Harvard, or Unknown)
        """
        # APA patterns: (Author, Year) or Author (Year)
        apa_pattern = r'\([A-Z][a-z]+(?:\s+&\s+[A-Z][a-z]+)?,?\s+\d{4}[a-z]?\)'
        apa_matches = len(re.findall(apa_pattern, text))
        
        # MLA patterns: (Author Page) or (Author)
        mla_pattern = r'\([A-Z][a-z]+(?:\s+\d+)?\)'
        mla_matches = len(re.findall(mla_pattern, text))
        
        # Chicago pattern: Footnote numbers
        chicago_pattern = r'\[\d+\]|\^\d+'
        chicago_matches = len(re.findall(chicago_pattern, text))
        
        # Harvard pattern: Similar to APA but different formatting
        harvard_pattern = r'\([A-Z][a-z]+(?:,\s+[A-Z]\.[A-Z]\.?)?\s+\d{4}\)'
        harvard_matches = len(re.findall(harvard_pattern, text))
        
        # Determine most likely style
        scores = {
            'APA': apa_matches,
            'MLA': mla_matches,
            'Chicago': chicago_matches,
            'Harvard': harvard_matches
        }
        
        max_score = max(scores.values())
        if max_score == 0:
            return 'Unknown'
        
        return max(scores, key=scores.get)
    
    def extract_citations_from_text(self, text: str) -> List[Dict]:
        """
        Extract all citations from the text with line numbers
        
        Args:
            text: Document text
            
        Returns:
            List of dictionaries containing citation information
        """
        citations = []
        lines = text.split('\n')
        
        # Extract different citation patterns
        patterns = [
            (r'\(([A-Z][a-z]+(?:\s+(?:&|and)\s+[A-Z][a-z]+)?),?\s+(\d{4}[a-z]?)\)', 'APA/Harvard'),  # APA/Harvard
            (r'\(([A-Z][a-z]+)(?:\s+(\d+))?\)', 'MLA'),  # MLA
            (r'\[(\d+)\]', 'Chicago'),  # Chicago footnotes
        ]
        
        current_position = 0
        for line_num, line in enumerate(lines, 1):
            for pattern, style_type in patterns:
                matches = re.finditer(pattern, line)
                for match in matches:
                    citation_text = match.group(0)
                    author = match.group(1) if len(match.groups()) > 0 else ''
                    year_or_page = match.group(2) if len(match.groups()) > 1 else ''
                    
                    citations.append({
                        'text': citation_text,
                        'line': line_num,
                        'position': current_position + match.start(),
                        'column': match.start(),
                        'author': author,
                        'year_or_page': year_or_page,
                        'style_type': style_type,
                        'context': line.strip()
                    })
            current_position += len(line) + 1  # +1 for newline
        
        self.detected_citations = citations
        return citations
    
    def format_citation_apa(self, author: str, year: str, title: str = "", 
                           source: str = "", url: str = "", 
                           doi: str = "", access_date: str = "") -> str:
        """Format a citation in APA style"""
        citation = f"{author} ({year})."
        
        if title:
            citation += f" {title}."
        
        if source:
            citation += f" {source}."
        
        if doi:
            citation += f" https://doi.org/{doi}"
        elif url:
            citation += f" Retrieved from {url}"
            if access_date:
                citation += f" (accessed {access_date})"
        
        return citation
    
    def format_citation_mla(self, author: str, title: str, source: str = "",
                           publisher: str = "", year: str = "", 
                           url: str = "", access_date: str = "") -> str:
        """Format a citation in MLA style"""
        citation = f"{author}. \"{title}.\""
        
        if source:
            citation += f" {source}"
        
        if publisher:
            citation += f", {publisher}"
        
        if year:
            citation += f", {year}"
        
        citation += "."
        
        if url:
            citation += f" {url}."
            if access_date:
                citation += f" Accessed {access_date}."
        
        return citation
    
    def format_citation_chicago(self, author: str, title: str, 
                               publication_info: str = "", year: str = "",
                               pages: str = "") -> str:
        """Format a citation in Chicago style"""
        citation = f"{author}. {title}."
        
        if publication_info:
            citation += f" {publication_info}"
        
        if year:
            citation += f", {year}"
        
        if pages:
            citation += f", {pages}"
        
        citation += "."
        
        return citation
    
    def format_citation_harvard(self, author: str, year: str, title: str,
                               source: str = "", volume: str = "",
                               pages: str = "") -> str:
        """Format a citation in Harvard style"""
        citation = f"{author} ({year}). {title}."
        
        if source:
            citation += f" {source}"
        
        if volume:
            citation += f", {volume}"
        
        if pages:
            citation += f", pp. {pages}"
        
        citation += "."
        
        return citation
    
    def format_reference_list(self, citations: List[Dict], style: str) -> str:
        """
        Format a reference list according to the specified citation style
        
        Args:
            citations: List of citation dictionaries
            style: Citation style (APA, MLA, Chicago, Harvard)
            
        Returns:
            Formatted reference list as string
        """
        if style == 'APA':
            header = "References\n\n"
        elif style == 'MLA':
            header = "Works Cited\n\n"
        elif style == 'Chicago':
            header = "Bibliography\n\n"
        elif style == 'Harvard':
            header = "Reference List\n\n"
        else:
            header = "References\n\n"
        
        formatted_refs = []
        for citation in sorted(citations, key=lambda x: x.get('author', '')):
            if style == 'APA':
                formatted_refs.append(self.format_citation_apa(**citation))
            elif style == 'MLA':
                formatted_refs.append(self.format_citation_mla(**citation))
            elif style == 'Chicago':
                formatted_refs.append(self.format_citation_chicago(**citation))
            elif style == 'Harvard':
                formatted_refs.append(self.format_citation_harvard(**citation))
        
        return header + '\n'.join(formatted_refs)
    
    def validate_citations(self, text: str, style: str) -> List[Dict]:
        """
        Validate citations in the document against the specified style
        
        Args:
            text: Document text
            style: Expected citation style
            
        Returns:
            List of validation issues
        """
        issues = []
        citations = self.extract_citations_from_text(text)
        
        for citation in citations:
            # Check if citation matches the expected style
            citation_text = citation['text']
            
            if style == 'APA':
                if not re.match(r'\([A-Z][a-z]+.*?,?\s+\d{4}[a-z]?\)', citation_text):
                    issues.append({
                        'citation': citation_text,
                        'position': citation['position'],
                        'issue': 'Does not match APA format',
                        'suggestion': 'Use (Author, Year) format'
                    })
            
            elif style == 'MLA':
                if not re.match(r'\([A-Z][a-z]+(?:\s+\d+)?\)', citation_text):
                    issues.append({
                        'citation': citation_text,
                        'position': citation['position'],
                        'issue': 'Does not match MLA format',
                        'suggestion': 'Use (Author Page) or (Author) format'
                    })
        
        return issues
    
    def extract_text_from_file(self, file_content: bytes, filename: str) -> str:
        """
        Extract text from uploaded file using centralized extractor
        Supports: PDF, DOCX, TXT, LaTeX
        
        Args:
            file_content: File bytes
            filename: Name of the file
            
        Returns:
            Extracted text (or error message string)
        """
        result = self.file_extractor.extract_text(file_content, filename)
        
        if not result['success']:
            return result['error']
        
        return result['text']
    
    def apply_citation_formatting(self, text: str, style: str) -> str:
        """
        Apply citation formatting to the entire document
        
        Args:
            text: Document text
            style: Citation style to apply
            
        Returns:
            Formatted text
        """
        # This is a placeholder for more sophisticated formatting
        # In a real implementation, this would parse and reformat all citations
        
        formatted_text = text
        
        # Add formatting instructions at the top
        header = f"=== Document Formatted in {style} Style ===\n\n"
        
        return header + formatted_text
    
    def generate_bibliography_entry(self, citation_data: Dict, style: str) -> str:
        """
        Generate a bibliography entry from citation data
        
        Args:
            citation_data: Dictionary with citation information
            style: Citation style (APA, MLA, Chicago, Harvard)
            
        Returns:
            Formatted bibliography entry
        """
        if style == 'APA':
            return self.format_citation_apa(**citation_data)
        elif style == 'MLA':
            return self.format_citation_mla(**citation_data)
        elif style == 'Chicago':
            return self.format_citation_chicago(**citation_data)
        elif style == 'Harvard':
            return self.format_citation_harvard(**citation_data)
        else:
            return "Unknown citation style"


def parse_citation_string(citation_str: str) -> Dict:
    """
    Parse a citation string to extract author, year, etc.
    
    Args:
        citation_str: Citation string like "(Smith, 2020)"
        
    Returns:
        Dictionary with parsed components
    """
    result = {}
    
    # Try to extract author and year (APA/Harvard style)
    match = re.match(r'\(([A-Za-z\s&,]+),?\s+(\d{4}[a-z]?)\)', citation_str)
    if match:
        result['author'] = match.group(1).strip()
        result['year'] = match.group(2)
    else:
        # Try MLA style
        match = re.match(r'\(([A-Za-z\s]+)(?:\s+(\d+))?\)', citation_str)
        if match:
            result['author'] = match.group(1).strip()
            if match.group(2):
                result['page'] = match.group(2)
    
    return result


def extract_references_section(text: str) -> Tuple[List[Dict], int]:
    """
    Extract the references/bibliography section from the document
    
    Args:
        text: Document text
        
    Returns:
        Tuple of (list of references, start line number)
    """
    lines = text.split('\n')
    references = []
    ref_start_line = -1
    in_ref_section = False
    
    # Common reference section headers
    ref_headers = [
        r'^\s*references\s*$',
        r'^\s*bibliography\s*$',
        r'^\s*works\s+cited\s*$',
        r'^\s*reference\s+list\s*$',
        r'^\s*sources\s*$'
    ]
    
    for line_num, line in enumerate(lines, 1):
        line_lower = line.lower().strip()
        
        # Check if we've reached the reference section
        if not in_ref_section:
            for header_pattern in ref_headers:
                if re.match(header_pattern, line_lower):
                    in_ref_section = True
                    ref_start_line = line_num
                    break
        elif in_ref_section and line.strip():
            # Extract reference entries
            # Look for lines that start with author names or numbers
            if re.match(r'^[A-Z][a-z]+|^\[?\d+\]?', line.strip()):
                references.append({
                    'text': line.strip(),
                    'line': line_num,
                    'author': extract_author_from_reference(line)
                })
    
    return references, ref_start_line


def extract_author_from_reference(ref_text: str) -> str:
    """
    Extract author name from a reference entry
    
    Args:
        ref_text: Reference text
        
    Returns:
        Author name
    """
    # Try to extract first author from reference
    # Pattern: Last name, First Initial(s).
    match = re.match(r'^([A-Z][a-z]+(?:,\s+[A-Z]\.?)?)', ref_text)
    if match:
        return match.group(1).strip()
    
    # Pattern: Last name (for simpler formats)
    match = re.match(r'^([A-Z][a-z]+)', ref_text)
    if match:
        return match.group(1).strip()
    
    return ""


def match_citations_to_references(citations: List[Dict], references: List[Dict]) -> Dict:
    """
    Match in-text citations to reference list entries
    
    Args:
        citations: List of in-text citations
        references: List of reference entries
        
    Returns:
        Dictionary mapping citation indices to reference indices
    """
    mapping = {}
    
    for cit_idx, citation in enumerate(citations):
        author = citation.get('author', '').replace('&', 'and').strip()
        year = citation.get('year_or_page', '')
        
        # Try to find matching reference
        for ref_idx, reference in enumerate(references):
            ref_author = reference.get('author', '').strip()
            ref_text = reference.get('text', '')
            
            # Check if author matches (fuzzy match)
            if author and ref_author:
                # Extract last name for comparison
                cit_last = author.split()[-1].replace(',', '').lower()
                ref_last = ref_author.split(',')[0].lower()
                
                if cit_last in ref_last or ref_last in cit_last:
                    # Check year if available
                    if year and year in ref_text:
                        mapping[cit_idx] = ref_idx
                        break
                    elif not year:  # MLA style without year
                        mapping[cit_idx] = ref_idx
                        break
    
    return mapping
