import Document from '../models/Document.js'
import User from '../models/User.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { extractTextFromFile, calculateMetadata } from '../services/fileExtractorService.js'
import nlpService from '../services/nlpService.js'
import mammoth from 'mammoth'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.docx', '.pdf', '.txt', '.tex', '.latex']
  const ext = path.extname(file.originalname).toLowerCase()
  
  if (allowedTypes.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, TXT, and LaTeX files are allowed.'))
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
      return res.status(400).json({
        status: 'error',
        message: 'Please upload a file'
      })
    }

    const { title, projectId, formattingStyle } = req.body
    const user = await User.findById(req.user.id)

    const fileExt = path.extname(req.file.originalname).toLowerCase().replace('.', '')
    
    // Extract text content from file
    const rawContent = await extractTextFromFile(req.file.path, fileExt)
    const metadata = calculateMetadata(rawContent)
    
    const documentData = {
      userId: req.user.id,
      title: title || req.file.originalname,
      originalFileName: req.file.originalname,
      fileType: fileExt,
      fileSize: req.file.size,
      filePath: req.file.path,
      projectId: projectId || null,
      content: {
        raw: rawContent,
        formatted: rawContent
      },
      metadata: {
        wordCount: metadata.wordCount,
        pageCount: metadata.pageCount
      }
    }

    // Only add formatting if provided
    if (formattingStyle) {
      documentData.formatting = {
        style: formattingStyle
      }
    }
    
    const document = await Document.create(documentData)

    // Process with NLP in background (don't wait for it)
    if (rawContent && rawContent.length > 50) {
      nlpService.processDocument(rawContent, metadata)
        .then(nlpResults => {
          document.nlp = {
            processed: true,
            processedAt: new Date(),
            entities: nlpResults.entities,
            keywords: nlpResults.keywords,
            summary: nlpResults.summary,
            sentiment: nlpResults.sentiment,
            classification: nlpResults.classification,
          }
          document.metadata = {
            ...document.metadata,
            ...nlpResults.metadata,
          }
          return document.save()
        })
        .catch(err => console.error('Background NLP processing error:', err.message))
    }

    // Update user usage
    user.usage.documentsProcessed += 1
    user.usage.documentsThisMonth += 1
    user.usage.storageUsed += req.file.size
    await user.save()

    res.status(201).json({
      status: 'success',
      document
    })
  } catch (error) {
    next(error)
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
    const document = await Document.findOne({
      _id: req.params.id,
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
    const document = await Document.findOne({
      _id: req.params.id,
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
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user.id
    })

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      })
    }

    // Delete file from filesystem
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath)
    }

    // Update user storage
    const user = await User.findById(req.user.id)
    user.usage.storageUsed -= document.fileSize
    await user.save()

    await document.deleteOne()

    res.status(200).json({
      status: 'success',
      message: 'Document deleted successfully'
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
      _id: req.params.id,
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
    const document = await Document.findOne({
      _id: req.params.id,
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

// @desc    Extract content from document
// @route   GET /api/documents/:id/extract
// @access  Private
export const extractContent = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
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
