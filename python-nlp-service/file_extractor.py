"""
Centralized File Extraction Utility
Handles text extraction from DOCX, PDF, and LaTeX files
Used across all services: Grammar, Plagiarism, Citations, Formatting
"""

import io
import re
import logging
from typing import Dict, Optional
import docx
from PyPDF2 import PdfReader

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FileExtractor:
    """
    Centralized file text extraction service
    Supports: PDF, DOCX, TXT, and LaTeX files
    """
    
    SUPPORTED_FORMATS = ['.pdf', '.docx', '.txt', '.tex', '.latex']
    
    def __init__(self):
        """Initialize the file extractor"""
        logger.info("File Extractor initialized")
    
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
    
    def _extract_from_pdf(self, file_content: bytes, filename: str) -> Dict:
        """Extract text from PDF file"""
        try:
            pdf = PdfReader(io.BytesIO(file_content))
            text = ""
            
            for page_num, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
                logger.debug(f"Extracted {len(page_text)} chars from page {page_num}")
            
            if not text.strip():
                return {
                    'success': False,
                    'error': 'PDF appears to be empty or contains only images',
                    'text': '',
                    'file_type': 'pdf'
                }
            
            logger.info(f"PDF extraction complete - {len(text)} characters")
            return {
                'success': True,
                'text': text,
                'file_type': 'pdf'
            }
            
        except Exception as e:
            logger.error(f"PDF extraction error: {str(e)}")
            return {
                'success': False,
                'error': f'Error reading PDF: {str(e)}',
                'text': '',
                'file_type': 'pdf'
            }
    
    def _extract_from_docx(self, file_content: bytes, filename: str) -> Dict:
        """Extract text from DOCX file"""
        try:
            doc = docx.Document(io.BytesIO(file_content))
            text = ""
            
            # Extract from paragraphs
            for para in doc.paragraphs:
                if para.text.strip():
                    text += para.text + "\n"
            
            # Extract from tables
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        if cell.text.strip():
                            text += cell.text + " "
                text += "\n"
            
            if not text.strip():
                return {
                    'success': False,
                    'error': 'DOCX file appears to be empty',
                    'text': '',
                    'file_type': 'docx'
                }
            
            logger.info(f"DOCX extraction complete - {len(text)} characters")
            return {
                'success': True,
                'text': text,
                'file_type': 'docx'
            }
            
        except Exception as e:
            logger.error(f"DOCX extraction error: {str(e)}")
            return {
                'success': False,
                'error': f'Error reading DOCX: {str(e)}',
                'text': '',
                'file_type': 'docx'
            }
    
    def _extract_from_txt(self, file_content: bytes, filename: str) -> Dict:
        """Extract text from TXT file"""
        try:
            # Try UTF-8 first
            try:
                text = file_content.decode('utf-8')
            except UnicodeDecodeError:
                # Fallback to latin-1 or windows-1252
                try:
                    text = file_content.decode('latin-1')
                except:
                    text = file_content.decode('windows-1252')
            
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
