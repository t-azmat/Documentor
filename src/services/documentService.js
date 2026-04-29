import api from './api'

// Document API
export const documentAPI = {
  upload: (formData, config = {}) => api.post('/documents/upload', formData, config),
  getAll: (params) => api.get('/documents', { params }),
  getOne: (id) => api.get(`/documents/${id}`),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  getStats: () => api.get('/documents/stats'),

  createFormattingJob: ({ documentId, formattingStyle = 'APA', useStatefulPipeline = false }) =>
    api.post('/formatting-jobs', {
      documentId,
      formattingStyle,
      useStatefulPipeline
    }),
  getFormattingJobStatus: (jobId) => api.get(`/formatting-jobs/${jobId}`),
  cancelFormattingJob: (jobId) => api.post(`/formatting-jobs/${jobId}/cancel`),
  getFormattingJobResult: (jobId) => api.get(`/formatting-jobs/${jobId}/result`),
  downloadFormattingJobResult: (jobId, format) =>
    api.get(`/formatting-jobs/${jobId}/download`, {
      params: { format },
      responseType: 'blob'
    }),

  runExperimentalFormattingEngine: ({ documentId, targetJournal = 'ieee', useAi = true, guidelinesFile = null }) => {
    if (guidelinesFile) {
      const formData = new FormData()
      formData.append('documentId', documentId)
      formData.append('targetJournal', targetJournal)
      formData.append('useAi', String(useAi))
      formData.append('guidelines', guidelinesFile)
      return api.post('/formatting-jobs/new-engine/run', formData)
    }
    return api.post('/formatting-jobs/new-engine/run', {
      documentId,
      targetJournal,
      useAi
    })
  },
  downloadExperimentalFormattingResult: (runId, { file = 'docx', documentId }) =>
    api.get(`/formatting-jobs/new-engine/${runId}/download`, {
      params: { file, documentId },
      responseType: 'blob'
    })
}

// Project API
export const projectAPI = {
  create: (data) => api.post('/projects', data),
  getAll: (params) => api.get('/projects', { params }),
  getOne: (id) => api.get(`/projects/${id}`),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  addDocument: (projectId, documentId) => 
    api.post(`/projects/${projectId}/documents/${documentId}`),
}

export default api
