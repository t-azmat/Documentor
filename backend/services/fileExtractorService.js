import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || 'http://localhost:5001'

/**
 * Extract text content from uploaded files using centralized Python extractor
 * Supports: PDF, DOCX, TXT, LaTeX
 */
export const extractTextFromFile = async (filePath, fileType) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found')
    }

    // Use centralized Python file extractor for all formats
    const FormData = require('form-data')
    const formData = new FormData()
    
    const fileStream = fs.createReadStream(filePath)
    const filename = path.basename(filePath)
    
    formData.append('file', fileStream, {
      filename: filename,
      contentType: getMimeType(fileType)
    })

    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/extract/file`,
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    )

    if (response.data.success) {
      console.log(`Extracted ${response.data.word_count} words from ${filename}`)
      return response.data.text
    } else {
      console.error('Extraction failed:', response.data.error)
      return `[Error: ${response.data.error}]`
    }
    
  } catch (error) {
    console.error('Error extracting text:', error)
    // Fallback to basic extraction for TXT files
    if (fileType.toLowerCase() === 'txt') {
      try {
        return fs.readFileSync(filePath, 'utf8')
      } catch {
        return ''
      }
    }
    return `[Error extracting ${fileType.toUpperCase()} content]`
  }
}

/**
 * Get MIME type for file extension
 */
const getMimeType = (fileType) => {
  const mimeTypes = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'tex': 'application/x-tex',
    'latex': 'application/x-latex'
  }
  return mimeTypes[fileType.toLowerCase()] || 'application/octet-stream'
}

/**
 * Calculate basic metadata from text
 */
export const calculateMetadata = (text) => {
  if (!text || text.trim().length === 0) {
    return {
      wordCount: 0,
      pageCount: 0
    }
  }

  const words = text.trim().split(/\s+/).filter(word => word.length > 0)
  const wordCount = words.length
  
  // Approximate page count (250 words per page)
  const pageCount = Math.ceil(wordCount / 250)

  return {
    wordCount,
    pageCount
  }
}

export default {
  extractTextFromFile,
  calculateMetadata
}
