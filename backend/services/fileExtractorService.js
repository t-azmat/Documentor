import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import FormData from 'form-data'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || 'http://localhost:5001'
const UPLOADS_DIR = path.join(__dirname, '../../uploads')

/**
 * Extract complete document content including text, structure, and media
 * Uses STRUCTURED extraction to preserve headings, styles, and document hierarchy
 * Supports: PDF, DOCX, TXT, LaTeX
 */
export const extractTextFromFile = async (filePath, fileType, docId) => {
  try {
    console.log(`[FileExtractor] Starting STRUCTURED extraction for doc ${docId}, type: ${fileType}`)
    
    if (!fs.existsSync(filePath)) {
      console.error(`[FileExtractor] File not found: ${filePath}`)
      throw new Error('File not found')
    }

    const fileSize = fs.statSync(filePath).size
    console.log(`[FileExtractor] File exists, size: ${fileSize} bytes`)

    // Use structured Python extractor to preserve headings and document structure
    const formData = new FormData()
    
    const fileStream = fs.createReadStream(filePath)
    const filename = `document.${fileType.replace('.', '')}`
    
    console.log(`[FileExtractor] Creating form data with file: ${filename}`)
    formData.append('file', fileStream, {
      filename: filename,
      contentType: getMimeType(fileType)
    })

    // ✅ Use structured extraction to preserve document structure
    console.log(`[FileExtractor] Sending to Python service at ${PYTHON_NLP_URL}`)
    console.log(`[FileExtractor] Form data headers:`, formData.getHeaders())
    let response
    try {
      // First try structured extraction (preserves headings, styles)
      response = await axios.post(
        `${PYTHON_NLP_URL}/api/extract/structured`,
        formData,
        {
          headers: formData.getHeaders(),
          maxContentLength: 100 * 1024 * 1024,  // 100MB limit
          maxBodyLength: 100 * 1024 * 1024,
          timeout: 120000  // 120 seconds
        }
      )
    } catch (axiosError) {
      console.error(`[FileExtractor] Structured extraction failed (status ${axiosError.response?.status}), trying fallback...`)
      console.error(`[FileExtractor] Error response:`, axiosError.response?.data?.error)
      
      // Fallback to simple extraction if structured fails
      try {
        console.log(`[FileExtractor] Using fallback simple extraction`)
        response = await axios.post(
          `${PYTHON_NLP_URL}/api/extract/file`,
          formData,
          {
            headers: formData.getHeaders(),
            timeout: 120000
          }
        )
      } catch (fallbackError) {
        console.error(`[FileExtractor] Both extractions failed:`, fallbackError.response?.data)
        throw fallbackError
      }
    }

    console.log(`[FileExtractor] Python service response status: ${response.status}`)
    
    if (!response.data.success) {
      console.error(`[FileExtractor] Extraction failed:`, response.data.error)
      throw new Error(response.data.error || 'Extraction failed')
    }

    // ✅ Handle both structured and simple extraction responses
    let extraction
    const isStructured = response.data.blocks && Array.isArray(response.data.blocks)
    
    if (isStructured) {
      console.log(`[FileExtractor] Processing STRUCTURED extraction (${response.data.blocks.length} blocks)`)
      
      // Convert structured blocks to text and preserve structure info
      const text = response.data.blocks
        .map(b => b.text)
        .join('\n')
      
      extraction = {
        text: text,
        wordCount: response.data.word_count || 0,
        blocks: response.data.blocks,  // ✅ Keep structured blocks for formatting
        toc: response.data.table_of_contents || [],
        headingInfo: {
          h1_count: response.data.heading_1_count || 0,
          h2_count: response.data.heading_2_count || 0,
          h3_count: response.data.heading_3_count || 0
        },
        elements: response.data.structure || [],
        mediaFiles: response.data.media || [],
        docling: response.data.docling || null,
        extractionBackend: response.data.metadata?.backend || response.data.backend || 'native',
        extractionMethod: 'structured'
      }
    } else {
      console.log(`[FileExtractor] Processing SIMPLE extraction`)
      
      extraction = {
        text: response.data.text || '',
        wordCount: response.data.word_count || 0,
        blocks: null,  // No structured blocks
        toc: [],
        elements: response.data.structure || [],
        mediaFiles: response.data.media || [],
        docling: null,
        extractionBackend: 'native',
        extractionMethod: 'simple'
      }
    }

    console.log(`[FileExtractor] Extracted: ${extraction.wordCount} words, ${extraction.blocks?.length || 0} structured blocks, ${extraction.elements.length} elements, ${extraction.mediaFiles.length} media files`)

    // ✅ Save extracted media files to disk if present
    if (extraction.mediaFiles && extraction.mediaFiles.length > 0) {
      const mediaDir = path.join(UPLOADS_DIR, `doc-${docId}`)
      
      console.log(`[FileExtractor] Creating media directory: ${mediaDir}`)
      if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir, { recursive: true })
      }

      extraction.mediaFiles = await Promise.all(
        extraction.mediaFiles.map(async (media) => {
          try {
            const safeFilename = media.filename || `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`
            const savedPath = path.join(mediaDir, safeFilename)
            
            console.log(`[FileExtractor] Saving media: ${safeFilename}`)
            // Save base64 or binary data
            if (media.data) {
              const buffer = Buffer.from(media.data, media.encoding || 'base64')
              fs.writeFileSync(savedPath, buffer)
              console.log(`[FileExtractor] Saved ${(buffer.length / 1024).toFixed(2)}KB to ${savedPath}`)
            }
            
            return {
              ...media,
              filename: safeFilename,
              savedPath: savedPath,
              relativePath: media.data ? `uploads/doc-${docId}/${safeFilename}` : (media.relativePath || ''),
              type: media.type || 'image'
            }
          } catch (err) {
            console.error(`[FileExtractor] Error saving media ${media.filename}:`, err)
            return null
          }
        })
      ).then(files => files.filter(f => f !== null))
    }

    console.log(`[FileExtractor] Extraction complete for doc ${docId}`)
    return extraction

  } catch (error) {
    console.error(`[FileExtractor] Error extracting file:`, error.message)
    console.error(`[FileExtractor] Stack:`, error.stack)
    // ✅ Throw error instead of returning error text
    throw new Error(`Failed to extract ${fileType.toUpperCase()}: ${error.message}`)
  }
}

/**
 * Get MIME type for file extension
 */
const getMimeType = (fileType) => {
  const mimeTypes = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'txt': 'text/plain',
    'tex': 'application/x-tex',
    'latex': 'application/x-latex'
  }
  return mimeTypes[fileType.toLowerCase()] || 'application/octet-stream'
}

/**
 * ✅ IMPROVED: Calculate metadata accounting for visual elements
 */
export const calculateMetadata = (extraction) => {
  if (!extraction || (!extraction.text && (!extraction.mediaFiles || extraction.mediaFiles.length === 0))) {
    return {
      wordCount: 0,
      pageCount: 0,
      tableCount: 0,
      imageCount: 0,
      graphCount: 0
    }
  }

  const words = extraction.text ? extraction.text.trim().split(/\s+/).filter(w => w.length > 0) : []
  const wordCount = words.length
  
  // ✅ Count visual elements
  const tableCount = extraction.elements?.filter(e => e.type === 'table').length || 0
  const imageCount = extraction.mediaFiles?.filter(m => m.type === 'image').length || 0
  const graphCount = extraction.mediaFiles?.filter(m => m.type === 'graph').length || 0
  
  // ✅ Better page count estimation accounting for media
  let pageCount = Math.ceil(wordCount / 250)
  // Add ~0.5 pages per visual element
  pageCount += Math.ceil((tableCount + imageCount + graphCount) * 0.5)
  
  return {
    wordCount,
    pageCount,
    tableCount,
    imageCount,
    graphCount
  }
}

/**
 * Remove extracted media directory for a document.
 * Cleanup is best-effort and should never break API control-flow.
 */
export const cleanupDocumentMediaDirectory = (mediaStoragePath) => {
  if (!mediaStoragePath) {
    return {
      removed: false,
      reason: 'No media storage path set on document'
    }
  }

  try {
    const uploadsRoot = path.resolve(UPLOADS_DIR)
    const resolvedPath = path.isAbsolute(mediaStoragePath)
      ? path.resolve(mediaStoragePath)
      : path.resolve(__dirname, '../../', mediaStoragePath)

    if (!resolvedPath.startsWith(uploadsRoot)) {
      return {
        removed: false,
        reason: `Refused cleanup outside uploads directory: ${resolvedPath}`
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      return {
        removed: false,
        reason: 'Media directory does not exist'
      }
    }

    fs.rmSync(resolvedPath, { recursive: true, force: true })
    return {
      removed: true,
      path: resolvedPath
    }
  } catch (error) {
    return {
      removed: false,
      reason: error.message
    }
  }
}

export default {
  extractTextFromFile,
  calculateMetadata,
  cleanupDocumentMediaDirectory
}
