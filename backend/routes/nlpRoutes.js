import express from 'express'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.use(protect)

// Placeholder routes - NLP features coming soon
router.post('/process/:id', (req, res) => {
  res.status(501).json({ message: 'NLP processing coming soon' })
})

router.get('/analysis/:id', (req, res) => {
  res.status(501).json({ message: 'NLP analysis coming soon' })
})

router.post('/entities', (req, res) => {
  res.status(501).json({ message: 'Entity extraction coming soon' })
})

router.post('/summarize', (req, res) => {
  res.status(501).json({ message: 'Text summarization coming soon' })
})

router.post('/sentiment', (req, res) => {
  res.status(501).json({ message: 'Sentiment analysis coming soon' })
})

router.post('/classify', (req, res) => {
  res.status(501).json({ message: 'Document classification coming soon' })
})

router.post('/keywords', (req, res) => {
  res.status(501).json({ message: 'Keyword extraction coming soon' })
})

export default router
