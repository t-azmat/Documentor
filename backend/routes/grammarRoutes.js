import express from 'express'
import { protect } from '../middleware/authMiddleware.js'
import {
  checkGrammar,
  enhanceDocument,
  getEnhancementSuggestions,
  getSuggestions,
  checkReadability,
  enhanceAcademicTone,
  batchCheck,
} from '../controllers/grammarController.js'

const router = express.Router()

// All routes require authentication
router.use(protect)

// Grammar checking endpoints
router.post('/check', checkGrammar)
router.post('/enhance', enhanceDocument)
router.post('/suggestions', getEnhancementSuggestions)
router.post('/readability', checkReadability)
router.post('/academic-tone', enhanceAcademicTone)
router.post('/batch', batchCheck)

export default router
