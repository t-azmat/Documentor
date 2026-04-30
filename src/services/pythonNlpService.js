import api from './api'

// Centralized File Extraction API (supports PDF, DOCX, TXT, LaTeX)
export const fileExtractorAPI = {
  // Extract text from any supported file format
  extractText: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/nlp/extract/file', formData)
  }
}

export const pythonNlpAPI = {
  // Health check
  healthCheck: () => api.get('/health'),

  // Analyze text
  analyze: (text) => 
    api.post('/nlp/analyze', { text }),

  // Extract from file
  extractFromFile: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/nlp/extract/file', formData)
  },

  // Extract entities
  extractEntities: (text) =>
    api.post('/nlp/entities', { text }),

  // Extract keywords
  extractKeywords: (text, maxKeywords = 10) =>
    api.post('/nlp/keywords', { text, max_keywords: maxKeywords }),

  // Summarize text
  summarize: (text, maxLength = 150) =>
    api.post('/nlp/summarize', { text, max_length: maxLength }),

  // Analyze sentiment
  analyzeSentiment: (text) =>
    api.post('/nlp/sentiment', { text })
}

// Citation Management API
export const citationAPI = {
  // Extract citations from uploaded file
  extractFromFile: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/citations/extract', formData)
  },

  // Detect citation style from text
  detectStyle: (text) =>
    api.post('/citations/detect-style', { text }),

  // Match citations to references
  matchCitations: (text) =>
    api.post('/citations/match', { text }),

  // Extract citations directly from plain text (no file upload needed)
  extractFromText: async (text) => {
    const [matchRes, styleRes] = await Promise.allSettled([
      api.post('/citations/match', { text }),
      api.post('/citations/detect-style', { text })
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
    api.post('/citations/format', { text, style }),

  // Generate single bibliography entry
  generateCitation: (citationData, style) =>
    api.post('/citations/generate', {
      citationData,
      style
    }),

  // Validate citations against style
  validateCitations: (text, style) =>
    api.post('/citations/validate', { text, style })
}
