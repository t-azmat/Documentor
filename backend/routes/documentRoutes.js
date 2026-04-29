import express from 'express'
import {
  uploadDocument,
  getDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  getDocumentStats,
  viewDocument,
  downloadDocument,
  extractContent,
  aiFormatDocument,
  upload
} from '../controllers/documentController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(protect)

// View route without protect middleware (handles auth in controller)
router.get('/:id/view', viewDocument)

router.use(protect)

router.post('/upload', upload.single('file'), uploadDocument)
router.post('/:id/ai-format', aiFormatDocument)  // ✅ AI formatting endpoint
router.get('/stats', getDocumentStats)
router.get('/', getDocuments)
router.get('/:id', getDocument)
router.get('/:id/download', downloadDocument)
router.get('/:id/extract', extractContent)
router.put('/:id', updateDocument)
router.delete('/:id', deleteDocument)

export default router
