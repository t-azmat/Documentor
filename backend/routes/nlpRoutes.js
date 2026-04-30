import express from 'express'
import axios from 'axios'
import multer from 'multer'
import FormData from 'form-data'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()
const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || 'http://localhost:5001'
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
})

router.use(protect)

const proxyPythonPost = async (req, res, endpoint) => {
  try {
    const response = await axios.post(`${PYTHON_NLP_URL}${endpoint}`, req.body, {
      timeout: 180000
    })
    res.status(response.status).json(response.data)
  } catch (error) {
    res.status(error.response?.status || 500).json({
      message: 'Python NLP service request failed',
      error: error.response?.data?.error || error.message,
      details: error.response?.data
    })
  }
}

router.post('/extract/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const formData = new FormData()
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    })

    const response = await axios.post(`${PYTHON_NLP_URL}/api/extract/file`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: 100 * 1024 * 1024,
      maxBodyLength: 100 * 1024 * 1024,
      timeout: 180000
    })

    res.status(response.status).json(response.data)
  } catch (error) {
    res.status(error.response?.status || 500).json({
      message: 'File extraction failed',
      error: error.response?.data?.error || error.message,
      details: error.response?.data
    })
  }
})

router.post('/ai-detect', (req, res) => proxyPythonPost(req, res, '/api/ai-detect'))
router.post('/document/sections', (req, res) => proxyPythonPost(req, res, '/api/document/sections'))
router.post('/document/extract-section', (req, res) => proxyPythonPost(req, res, '/api/document/extract-section'))
router.post('/document/validate-structure', (req, res) => proxyPythonPost(req, res, '/api/document/validate-structure'))
router.post('/analyze', (req, res) => proxyPythonPost(req, res, '/api/nlp/analyze'))
router.post('/entities', (req, res) => proxyPythonPost(req, res, '/api/nlp/entities'))
router.post('/summarize', (req, res) => proxyPythonPost(req, res, '/api/nlp/summarize'))
router.post('/sentiment', (req, res) => proxyPythonPost(req, res, '/api/nlp/sentiment'))
router.post('/keywords', (req, res) => proxyPythonPost(req, res, '/api/nlp/keywords'))

router.post('/process/:id', (req, res) => {
  res.status(501).json({ message: 'NLP processing coming soon' })
})

router.get('/analysis/:id', (req, res) => {
  res.status(501).json({ message: 'NLP analysis coming soon' })
})

router.post('/classify', (req, res) => {
  res.status(501).json({ message: 'Document classification coming soon' })
})

export default router
