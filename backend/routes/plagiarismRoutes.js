import express from 'express'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

// All routes require authentication
router.use(protect)

// Placeholder routes - Plagiarism features coming soon
router.post('/check', (req, res) => {
  res.status(501).json({ message: 'Plagiarism checking coming soon' })
})

router.get('/report/:documentId', (req, res) => {
  res.status(501).json({ message: 'Plagiarism report coming soon' })
})

router.post('/compare', (req, res) => {
  res.status(501).json({ message: 'Document comparison coming soon' })
})

router.get('/history', (req, res) => {
  res.status(501).json({ message: 'Plagiarism history coming soon' })
})

export default router
