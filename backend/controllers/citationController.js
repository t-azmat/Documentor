import axios from 'axios'

const PYTHON_NLP_URL = process.env.PYTHON_NLP_URL || 'http://localhost:5001'

/**
 * Extract citations from uploaded document
 * @route POST /api/citations/extract
 */
export const extractCitations = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const FormData = require('form-data')
    const formData = new FormData()
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    })

    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/citations/extract`,
      formData,
      {
        headers: formData.getHeaders()
      }
    )

    res.status(200).json(response.data)
  } catch (error) {
    console.error('Citation extraction error:', error)
    console.error('Error response:', error.response?.data)
    res.status(500).json({ 
      message: 'Failed to extract citations',
      error: error.response?.data?.error || error.message,
      details: error.response?.data || error.toString()
    })
  }
}

/**
 * Detect citation style from text
 * @route POST /api/citations/detect-style
 */
export const detectCitationStyle = async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ message: 'Text is required' })
    }

    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/citations/detect-style`,
      { text }
    )

    res.status(200).json(response.data)
  } catch (error) {
    console.error('Style detection error:', error)
    res.status(500).json({ 
      message: 'Failed to detect citation style',
      error: error.message 
    })
  }
}

/**
 * Match citations to references
 * @route POST /api/citations/match
 */
export const matchCitationsToReferences = async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ message: 'Text is required' })
    }

    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/citations/match`,
      { text }
    )

    res.status(200).json(response.data)
  } catch (error) {
    console.error('Citation matching error:', error)
    res.status(500).json({ 
      message: 'Failed to match citations',
      error: error.message 
    })
  }
}

/**
 * Format citations in a specific style
 * @route POST /api/citations/format
 */
export const formatCitations = async (req, res) => {
  try {
    const { text, style } = req.body

    if (!text || !style) {
      return res.status(400).json({ message: 'Text and style are required' })
    }

    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/citations/format`,
      { text, style }
    )

    res.status(200).json(response.data)
  } catch (error) {
    console.error('Citation formatting error:', error)
    res.status(500).json({ 
      message: 'Failed to format citations',
      error: error.message 
    })
  }
}

/**
 * Generate single bibliography entry
 * @route POST /api/citations/generate
 */
export const generateCitation = async (req, res) => {
  try {
    const { citationData, style } = req.body

    if (!citationData || !style) {
      return res.status(400).json({ message: 'Citation data and style are required' })
    }

    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/citations/generate`,
      { citation_data: citationData, style }
    )

    res.status(200).json(response.data)
  } catch (error) {
    console.error('Citation generation error:', error)
    res.status(500).json({ 
      message: 'Failed to generate citation',
      error: error.message 
    })
  }
}

/**
 * Validate citations in document
 * @route POST /api/citations/validate
 */
export const validateCitations = async (req, res) => {
  try {
    const { text, style } = req.body

    if (!text || !style) {
      return res.status(400).json({ message: 'Text and style are required' })
    }

    const response = await axios.post(
      `${PYTHON_NLP_URL}/api/citations/validate`,
      { text, style }
    )

    res.status(200).json(response.data)
  } catch (error) {
    console.error('Citation validation error:', error)
    res.status(500).json({ 
      message: 'Failed to validate citations',
      error: error.message 
    })
  }
}
