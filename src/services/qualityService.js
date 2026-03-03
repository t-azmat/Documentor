import api from './api'

// Grammar API
export const grammarAPI = {
  check: (data) => api.post('/grammar/check', data),
  getSuggestions: (data) => api.post('/grammar/suggestions', data),
  checkReadability: (data) => api.post('/grammar/readability', data),
  enhanceAcademicTone: (data) => api.post('/grammar/academic-tone', data),
  batchCheck: (data) => api.post('/grammar/batch', data),
}

// Plagiarism API
export const plagiarismAPI = {
  check: (data) => api.post('/plagiarism/check', data),
  getReport: (documentId) => api.get(`/plagiarism/report/${documentId}`),
  compareDocuments: (data) => api.post('/plagiarism/compare', data),
  getHistory: () => api.get('/plagiarism/history'),
}
