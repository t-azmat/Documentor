import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    common: {
      'Accept': 'application/json'
    }
  }
})

// Add token to requests and handle FormData
api.interceptors.request.use(
  (config) => {
    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {}
    }
    
    if (!config.headers['x-correlation-id'] && window.crypto?.randomUUID) {
      config.headers['x-correlation-id'] = window.crypto.randomUUID()
    }

    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // ✅ Important: For FormData, let browser set Content-Type automatically
    if (config.data instanceof FormData) {
      // Delete Content-Type to let axios/browser set it with boundary
      delete config.headers['Content-Type']
      console.log('[API] FormData request detected - Content-Type will be set by browser')
    } else {
      // For non-FormData requests, set JSON content type
      config.headers['Content-Type'] = 'application/json'
    }
    
    console.log('[API] Request config:', {
      method: config.method,
      url: config.url,
      hasFile: config.data instanceof FormData,
      headers: config.headers
    })
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API] Response error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
      message: error.message
    })
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  socialLogin: (data) => api.post('/auth/social', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.put(`/auth/reset-password/${token}`, { password }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// Subscription API
export const subscriptionAPI = {
  getPlans: () => api.get('/subscriptions/plans'),
  getCurrentSubscription: () => api.get('/subscriptions/current'),
  createCheckout: (data) => api.post('/subscriptions/create-checkout', data),
  updateSubscription: (data) => api.post('/subscriptions/update', data),
  cancelSubscription: () => api.post('/subscriptions/cancel'),
}

// User API
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  updatePassword: (data) => api.put('/users/password', data),
  getUsage: () => api.get('/users/usage'),
  deleteAccount: () => api.delete('/users/account'),
}

export const adminAPI = {
  getOverview: () => api.get('/admin/overview'),
  getPublicOverview: () => api.get('/admin/overview/public'),
  getUsers: () => api.get('/admin/users'),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  getTemplates: () => api.get('/admin/templates'),
  createTemplate: (data) => api.post('/admin/templates', data),
  updateTemplate: (id, data) => api.put(`/admin/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/admin/templates/${id}`),
  getLogs: (params) => api.get('/admin/logs', { params }),
  getProjects: () => api.get('/admin/projects'),
  getFormattingJobs: () => api.get('/admin/formatting-jobs')
}

// Grammar API
export const grammarAPI = {
  enhance: (data) => api.post('/grammar/enhance', data),
  getSuggestions: (data) => api.post('/grammar/suggestions', data),
  check: (data) => api.post('/grammar/check', data),
  getReadability: (data) => api.post('/grammar/readability', data),
  enhanceAcademicTone: (data) => api.post('/grammar/academic-tone', data),
}

export default api
