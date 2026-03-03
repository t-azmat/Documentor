import api from './api'

export const nlpAPI = {
  processDocument: (documentId) => api.post(`/nlp/process/${documentId}`),
  getAnalysis: (documentId) => api.get(`/nlp/analysis/${documentId}`),
  extractEntities: (text) => api.post('/nlp/entities', { text }),
  summarize: (text) => api.post('/nlp/summarize', { text }),
  analyzeSentiment: (text) => api.post('/nlp/sentiment', { text }),
  classify: (text) => api.post('/nlp/classify', { text }),
  extractKeywords: (text) => api.post('/nlp/keywords', { text }),
}

export default nlpAPI
