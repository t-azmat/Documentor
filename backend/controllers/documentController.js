import Document from '../models/Document.js'
import User from '../models/User.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { extractTextFromFile, calculateMetadata, cleanupDocumentMediaDirectory } from '../services/fileExtractorService.js'
import axios from 'axios'
import mammoth from 'mammoth'
import FormattingJob from '../models/FormattingJob.js'
import { cleanupFormattingJobArtifacts } from '../services/formattingJobQueue.js'

const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || 'http://localhost:5001'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure multer for file upload
import crypto from 'crypto'
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex')
    cb(null, uniqueSuffix + '.tmp')
  }
})

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/x-tex',
    'application/x-latex'
  ]
  const allowedExts = ['.docx', '.pdf', '.txt', '.tex', '.latex']
  const ext = path.extname(file.originalname).toLowerCase()
  
  if (allowedMimeTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Signature check failed.'))
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
})

// @desc    Upload document
// @route   POST /api/documents/upload
// @access  Private
export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      console.error('No file in request')
      return res.status(400).json({
        status: 'error',
        message: 'Please upload a file'
      })
    }

    const { title, projectId, formattingStyle } = req.body
    console.log('Upload request:', { title, projectId, formattingStyle, filename: req.file.originalname })

    const user = await User.findById(req.user.id)
    if (!user) {
      console.error('User not found:', req.user.id)
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      })
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase().replace('.', '')
    console.log('File extension:', fileExt)
    
    // ✅ Create document first to get ID for media storage
    let document = new Document({
      userId: req.user.id,
      title: title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      originalFileName: req.file.originalname,
      fileType: fileExt,
      fileSize: req.file.size,
      filePath: req.file.path,
      projectId: projectId || null,
      status: 'processing',
      metadata: {
        uploadedAt: new Date(),
        requestedStyle: formattingStyle || 'APA'
      },
      content: {
        raw: '',
        formatted: ''
      }
    })

    await document.save()
    console.log('Document created:', document._id)

    // ✅ Extract with document ID for media organization
    console.log('Starting file extraction...')
    const extraction = await extractTextFromFile(req.file.path, fileExt, document._id)
    console.log('Extraction complete:', { 
      words: extraction.wordCount, 
      method: extraction.extractionMethod,
      blocks: extraction.blocks?.length || 0,
      headings: extraction.headingInfo,
      toc: extraction.toc?.length || 0,
      media: extraction.mediaFiles?.length || 0 
    })
    
    // ✅ Store extraction results with structure preservation
    document.content = {
      raw: extraction.text,
      formatted: extraction.text,
      structure: extraction.elements || [],
      mediaReferences: extraction.mediaFiles || [],
      structuredBlocks: extraction.blocks || null,  // ✅ Store for intelligent formatting
      tableOfContents: extraction.toc || [],  // ✅ Store TOC
      docling: extraction.docling || null
    }

    // ✅ Update metadata with heading information
    const metadata = calculateMetadata(extraction)
    document.metadata = {
      ...document.metadata,
      ...metadata,
      extractionMethod: extraction.extractionMethod,
      extractionBackend: extraction.extractionBackend,
      headingStats: extraction.headingInfo || {},
      lastProcessedAt: new Date()
    }

    // ✅ Store media info
    if (extraction.mediaFiles && extraction.mediaFiles.length > 0) {
      document.media = {
        storagePath: `uploads/doc-${document._id}/`,
        files: extraction.mediaFiles.map(f => f.relativePath)
      }
    }

    document.status = 'uploaded'  // Set to 'uploaded' instead of 'processing' - NLP is now on-demand
    await document.save()

    // ✅ NLP processing is now on-demand via /api/nlp endpoints
    // Document is ready to view immediately after extraction
    // Users can run NLP analysis separately when needed

    // Update user usage
    user.usage.documentsProcessed += 1
    user.usage.documentsThisMonth += 1
    user.usage.storageUsed += req.file.size
    await user.save()

    res.status(201).json({
      status: 'success',
      document: {
        _id: document._id,
        id: document._id,
        title: document.title,
        status: document.status,
        fileType: document.fileType,
        fileSize: document.fileSize,
        originalFileName: document.originalFileName,
        createdAt: document.createdAt,
        metadata: document.metadata,
        extractionMethod: document.metadata?.extractionMethod,
        headingStats: document.metadata?.headingStats,
        hasStructure: !!extraction.blocks,
        tocLength: extraction.toc?.length || 0
      }
    })
  } catch (error) {
    console.error('=== UPLOAD ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)

    return res.status(500).json({
      status: 'error',
      message: error.message || 'Upload failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

// @desc    Apply AI formatting to document content
// @route   POST /api/documents/:id/ai-format
// @access  Private
export const aiFormatDocument = async (req, res, next) => {
  try {
    const { formattingStyle = 'APA' } = req.body

    const document = await Document.findById(req.params.id)
    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    if (document.userId.toString() !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to format this document'
      })
    }

    console.log(`[AI-Format] Starting AI formatting for doc ${document._id}`)

    // Prepare data for Python AI formatter
    const structuredBlocks = document.content?.structuredBlocks
    const rawText = document.content?.raw || ''
    
    if (!structuredBlocks && !rawText) {
      return res.status(400).json({
        status: 'error',
        message: 'Document has no content to format'
      })
    }

    const requestBody = {
      text: rawText,
      structured_blocks: structuredBlocks || [],
      table_of_contents: document.content?.tableOfContents || [],
      target_style: formattingStyle,
      title: document.title,
      authors: [],
      generate_latex: true
    }

    if (structuredBlocks) {
      console.log(`[AI-Format] Using ${structuredBlocks.length} structured blocks for AI formatting`)
    } else {
      console.log(`[AI-Format] Using plain text for AI formatting`)
    }

    // Call Python AI formatter
    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/formatting/ai-format`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 180000  // 3 minutes for AI formatting
      }
    )

    if (!response.data.success) {
      console.error(`[AI-Format] Formatting failed:`, response.data.error)
      return res.status(400).json({
        status: 'error',
        message: 'AI formatting failed: ' + response.data.error
      })
    }

    console.log(`[AI-Format] Formatting complete - ${response.data.plain_sections?.length || 0} sections`)

    // Store formatted content
    document.content.formatted = response.data.plain_sections
      .map(s => `${'#'.repeat(s.section_level || 1)} ${s.heading}\n\n${s.text}`)
      .join('\n\n')
    
    document.metadata.lastFormattedAt = new Date()
    document.metadata.formattingStyle = formattingStyle
    document.metadata.formattingStats = response.data.citation_stats || {}
    
    await document.save()

    return res.status(200).json({
      status: 'success',
      message: 'Document AI formatted successfully',
      document: {
        _id: document._id,
        title: document.title,
        formattingStyle: formattingStyle,
        sectionsCount: response.data.plain_sections?.length || 0,
        citationStats: response.data.citation_stats,
        hasLatex: !!response.data.latex
      }
    })
  } catch (error) {
    console.error('[AI-Format] Error:', error.message)
    return res.status(500).json({
      status: 'error',
      message: 'AI formatting error: ' + error.message
    })
  }
}

// @desc    Get all documents
// @route   GET /api/documents
// @access  Private
export const getDocuments = async (req, res, next) => {
  try {
    const { status, projectId, limit = 10, page = 1 } = req.query
    
    const query = { userId: req.user.id }
    if (status) query.status = status
    if (projectId) query.projectId = projectId

    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('projectId', 'name color')

    const total = await Document.countDocuments(query)

    res.status(200).json({
      status: 'success',
      documents,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get single document
// @route   GET /api/documents/:id
// @access  Private
export const getDocument = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Document ID is required'
      })
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.user.id
    }).populate('projectId', 'name color')

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    res.status(200).json({
      status: 'success',
      document
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Update document
// @route   PUT /api/documents/:id
// @access  Private
export const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Document ID is required'
      })
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    // Handle direct fields
    if (req.body.title) document.title = req.body.title
    if (req.body.projectId !== undefined) document.projectId = req.body.projectId

    // Handle nested content field
    if (req.body['content.raw']) {
      if (!document.content) document.content = {}
      document.content.raw = req.body['content.raw']
      document.markModified('content')
    }

    // Handle nested formatting field
    if (req.body['formatting.style']) {
      if (!document.formatting) document.formatting = {}
      document.formatting.style = req.body['formatting.style']
      document.markModified('formatting')
    } else if (req.body.formattingStyle) {
      if (!document.formatting) document.formatting = {}
      document.formatting.style = req.body.formattingStyle
      document.markModified('formatting')
    }

    await document.save()

    res.status(200).json({
      status: 'success',
      document
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Private
export const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params
    const cleanupWarnings = []

    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Document ID is required and must be a valid MongoDB ID'
      })
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    // Delete file from filesystem
    try {
      if (document.filePath && fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath)
      }
    } catch (error) {
      cleanupWarnings.push(`Failed to remove source file: ${error.message}`)
    }

    // Best-effort cleanup for extracted media directory
    if (document.media?.storagePath) {
      const mediaCleanup = cleanupDocumentMediaDirectory(document.media.storagePath)
      if (!mediaCleanup.removed && mediaCleanup.reason !== 'Media directory does not exist') {
        cleanupWarnings.push(`Media cleanup warning: ${mediaCleanup.reason}`)
      }
    }

    // Best-effort cleanup for transient formatting job artifacts
    const relatedJobs = await FormattingJob.find({
      documentId: document._id,
      userId: req.user.id
    })

    for (const job of relatedJobs) {
      const artifactCleanup = await cleanupFormattingJobArtifacts(job)
      if (artifactCleanup.warnings?.length > 0) {
        cleanupWarnings.push(...artifactCleanup.warnings)
      }
    }

    try {
      await FormattingJob.deleteMany({
        documentId: document._id,
        userId: req.user.id
      })
    } catch (error) {
      cleanupWarnings.push(`Failed to remove formatting jobs: ${error.message}`)
    }

    // Update user storage
    const user = await User.findById(req.user.id)
    if (user) {
      user.usage.storageUsed = Math.max(0, (user.usage.storageUsed || 0) - (document.fileSize || 0))
      await user.save()
    }

    await document.deleteOne()

    res.status(200).json({
      status: 'success',
      message: 'Document deleted successfully',
      cleanup: {
        warnings: cleanupWarnings
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    Get document statistics
// @route   GET /api/documents/stats
// @access  Private
export const getDocumentStats = async (req, res, next) => {
  try {
    const total = await Document.countDocuments({ userId: req.user.id })
    const uploaded = await Document.countDocuments({ userId: req.user.id, status: 'uploaded' })
    const processing = await Document.countDocuments({ userId: req.user.id, status: 'processing' })
    const formatted = await Document.countDocuments({ userId: req.user.id, status: 'formatted' })

    res.status(200).json({
      status: 'success',
      stats: {
        total,
        uploaded,
        processing,
        formatted
      }
    })
  } catch (error) {
    next(error)
  }
}

// @desc    View document (public with token in query)
// @route   GET /api/documents/:id/view
// @access  Private (token in query)
export const viewDocument = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).send('Document ID is required')
    }

    // Get token from query parameter
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).send('Authentication required')
    }

    // Verify token manually
    const jwt = await import('jsonwebtoken')
    let decoded
    try {
      decoded = jwt.default.verify(token, process.env.JWT_SECRET)
    } catch (err) {
      return res.status(401).send('Invalid token')
    }

    const document = await Document.findOne({
      _id: id,
      userId: decoded.id
    })

    if (!document) {
      return res.status(404).send('Document not found')
    }

    if (!fs.existsSync(document.filePath)) {
      return res.status(404).send('File not found on server')
    }

    // Handle DOCX files by converting to HTML
    if (document.fileType === 'docx') {
      try {
        const result = await mammoth.convertToHtml({ path: document.filePath })
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${document.title}</title>
            <style>
              body {
                font-family: 'Calibri', 'Arial', sans-serif;
                line-height: 1.6;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
                background: #f5f5f5;
              }
              .document-container {
                background: white;
                padding: 60px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
              }
              h1, h2, h3, h4, h5, h6 {
                margin-top: 1.5em;
                margin-bottom: 0.5em;
              }
              p {
                margin-bottom: 1em;
              }
              img {
                max-width: 100%;
                height: auto;
              }
            </style>
          </head>
          <body>
            <div class="document-container">
              ${result.value}
            </div>
          </body>
          </html>
        `
        res.setHeader('Content-Type', 'text/html')
        return res.send(html)
      } catch (err) {
        console.error('Error converting DOCX:', err)
        return res.status(500).send('Failed to convert document')
      }
    }

    // Set content type based on file type
    const contentTypes = {
      'pdf': 'application/pdf',
      'txt': 'text/plain'
    }

    res.setHeader('Content-Type', contentTypes[document.fileType] || 'application/octet-stream')
    res.setHeader('Content-Disposition', 'inline')
    
    const fileStream = fs.createReadStream(document.filePath)
    fileStream.pipe(res)
  } catch (error) {
    next(error)
  }
}

// @desc    Download document
// @route   GET /api/documents/:id/download
// @access  Private
export const downloadDocument = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Document ID is required'
      })
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'File not found on server'
      })
    }

    res.download(document.filePath, `${document.title}.${document.fileType}`)
  } catch (error) {
    next(error)
  }
}

// ✅ NEW: Download document as formatted Word with media
// @desc    Download document as Word format with media
// @route   GET /api/documents/:id/export/word
// @access  Private
export const downloadAsWord = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Document ID is required'
      })
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({ status: 'error', message: 'Document not found' })
    }

    // Use formatted content with structure and media references
    const content = document.content.formatted || document.content.raw
    
    // For now, return as text with placeholders for media
    // In production, use library to generate proper Word document
    const wordContent = `
${document.title}

${content}

${document.content.mediaReferences ? '\n--- Media Files ---\n' + 
  document.content.mediaReferences.map((m, i) => `[${i+1}] ${m.caption}: ${m.filename}`).join('\n') 
  : ''}`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${document.title}.docx"`)
    res.send(wordContent)
  } catch (error) {
    next(error)
  }
}

// ✅ NEW: Download document as formatted PDF with media
// @desc    Download document as PDF format with media
// @route   GET /api/documents/:id/export/pdf
// @access  Private
export const downloadAsPdf = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Document ID is required'
      })
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({ status: 'error', message: 'Document not found' })
    }

    // For now, return formatted content
    // In production, use library to generate proper PDF with embedded media
    const pdfContent = `
${document.title}

${document.content.formatted || document.content.raw}

${document.content.mediaReferences ? 'Media: ' + 
  document.content.mediaReferences.map(m => m.caption).join(', ')
  : ''}`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${document.title}.pdf"`)
    res.send(pdfContent)
  } catch (error) {
    next(error)
  }
}

// @desc    Extract content from document
// @route   GET /api/documents/:id/extract
// @access  Private
export const extractContent = async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'Document ID is required'
      })
    }

    const document = await Document.findOne({
      _id: id,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    // If content already exists, return it
    if (document.content?.raw) {
      return res.status(200).json({
        status: 'success',
        content: document.content.raw,
        metadata: document.metadata
      })
    }

    // Extract content from file
    const rawContent = await extractTextFromFile(document.filePath, document.fileType)
    const metadata = calculateMetadata(rawContent)

    // Update document
    document.content = {
      raw: rawContent,
      formatted: rawContent
    }
    document.metadata = {
      ...document.metadata,
      wordCount: metadata.wordCount,
      pageCount: metadata.pageCount
    }
    await document.save()

    res.status(200).json({
      status: 'success',
      content: rawContent,
      metadata: metadata
    })
  } catch (error) {
    next(error)
  }
}
