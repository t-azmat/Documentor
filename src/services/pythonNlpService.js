import axios from 'axios'

const PYTHON_NLP_URL = import.meta.env.VITE_PYTHON_NLP_URL || 'http://localhost:5001'

// Centralized File Extraction API (supports PDF, DOCX, TXT, LaTeX)
export const fileExtractorAPI = {
  // Extract text from any supported file format
  extractText: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return axios.post(`${PYTHON_NLP_URL}/api/extract/file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

export const pythonNlpAPI = {
  // Health check
  healthCheck: () => axios.get(`${PYTHON_NLP_URL}/health`),

  // Analyze text
  analyze: (text) => 
    axios.post(`${PYTHON_NLP_URL}/api/nlp/analyze`, { text }),

  // Extract from file
  extractFromFile: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return axios.post(`${PYTHON_NLP_URL}/api/nlp/extract`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // Extract entities
  extractEntities: (text) =>
    axios.post(`${PYTHON_NLP_URL}/api/nlp/entities`, { text }),

  // Extract keywords
  extractKeywords: (text, maxKeywords = 10) =>
    axios.post(`${PYTHON_NLP_URL}/api/nlp/keywords`, { text, max_keywords: maxKeywords }),

  // Summarize text
  summarize: (text, maxLength = 150) =>
    axios.post(`${PYTHON_NLP_URL}/api/nlp/summarize`, { text, max_length: maxLength }),

  // Analyze sentiment
  analyzeSentiment: (text) =>
    axios.post(`${PYTHON_NLP_URL}/api/nlp/sentiment`, { text })
}

// Citation Management API
export const citationAPI = {
  // Extract citations from uploaded file
  extractFromFile: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return axios.post(`${PYTHON_NLP_URL}/api/citations/extract`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  // Detect citation style from text
  detectStyle: (text) =>
    axios.post(`${PYTHON_NLP_URL}/api/citations/detect-style`, { text }),

  // Match citations to references
  matchCitations: (text) =>
    axios.post(`${PYTHON_NLP_URL}/api/citations/match`, { text }),

  // Extract citations directly from plain text (no file upload needed)
  extractFromText: async (text) => {
    const [matchRes, styleRes] = await Promise.allSettled([
      axios.post(`${PYTHON_NLP_URL}/api/citations/match`, { text }),
      axios.post(`${PYTHON_NLP_URL}/api/citations/detect-style`, { text })
    ])
    if (matchRes.status === 'rejected') throw matchRes.reason
    const data = matchRes.value.data
    const detectedStyle = styleRes.status === 'fulfilled' ? styleRes.value.data.style : 'Unknown'
    return {
      data: {
        ...data,
        text,
        word_count: text.split(/\s+/).filter(Boolean).length,
        char_count: text.length,
        detected_style: detectedStyle,
        unmatched_citations: (data.citations?.length || 0) - (data.matched_count || 0),
        uncited_references: (data.references?.length || 0) - new Set(Object.values(data.mapping || {})).size
      }
    }
  },

  // Format document in specific citation style
  formatDocument: (text, style) =>
    axios.post(`${PYTHON_NLP_URL}/api/citations/format`, { text, style }),

  // Generate single bibliography entry
  generateCitation: (citationData, style) =>
    axios.post(`${PYTHON_NLP_URL}/api/citations/generate`, {
      citation_data: citationData,
      style
    }),

  // Validate citations against style
  validateCitations: (text, style) =>
    axios.post(`${PYTHON_NLP_URL}/api/citations/validate`, { text, style })
}
