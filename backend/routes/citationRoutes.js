import express from 'express'
import multer from 'multer'
import { protect } from '../middleware/authMiddleware.js'
import {
  extractCitations,
  detectCitationStyle,
  matchCitationsToReferences,
  formatCitations,
  generateCitation,
  validateCitations
} from '../controllers/citationController.js'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/x-tex',
      'application/x-latex'
    ]
    const allowedExts = ['.pdf', '.docx', '.txt', '.tex', '.latex']
    const fileExt = file.originalname.toLowerCase().match(/\.[^.]+$/)
    
    if (allowedTypes.includes(file.mimetype) || (fileExt && allowedExts.includes(fileExt[0]))) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, TXT, and LaTeX files are allowed.'))
    }
  }
})

// All routes require authentication
router.use(protect)

// Extract citations from uploaded document
router.post('/extract', upload.single('file'), extractCitations)

// Detect citation style from text
router.post('/detect-style', detectCitationStyle)

// Match citations to references
router.post('/match', matchCitationsToReferences)

// Format document according to citation style
router.post('/format', formatCitations)

// Generate single bibliography entry
router.post('/generate', generateCitation)

// Validate citations in document
router.post('/validate', validateCitations)

export default router
