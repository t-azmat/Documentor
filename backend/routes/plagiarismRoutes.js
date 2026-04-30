import express from 'express'
import axios from 'axios'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()
const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || 'http://localhost:5001'

// All routes require authentication
router.use(protect)

const proxyPythonPost = async (req, res, endpoint) => {
  try {
    const response = await axios.post(`${PYTHON_NLP_URL}${endpoint}`, req.body, {
      timeout: 180000
    })
    res.status(response.status).json(response.data)
  } catch (error) {
    res.status(error.response?.status || 500).json({
      message: 'Python plagiarism service request failed',
      error: error.response?.data?.error || error.message,
      details: error.response?.data
    })
  }
}

router.post('/check', (req, res) => proxyPythonPost(req, res, '/api/plagiarism/check'))
router.post('/studio', (req, res) => proxyPythonPost(req, res, '/api/plagiarism/studio'))
router.post('/check-online', (req, res) => proxyPythonPost(req, res, '/api/plagiarism/check-online'))
router.post('/find-similar', (req, res) => proxyPythonPost(req, res, '/api/plagiarism/find-similar'))

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
