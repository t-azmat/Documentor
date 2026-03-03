import api from './api'

// Document API
export const documentAPI = {
  upload: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAll: (params) => api.get('/documents', { params }),
  getOne: (id) => api.get(`/documents/${id}`),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  getStats: () => api.get('/documents/stats'),
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
