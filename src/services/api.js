import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
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

// Grammar API
export const grammarAPI = {
  enhance: (data) => api.post('/grammar/enhance', data),
  getSuggestions: (data) => api.post('/grammar/suggestions', data),
  check: (data) => api.post('/grammar/check', data),
  getReadability: (data) => api.post('/grammar/readability', data),
  enhanceAcademicTone: (data) => api.post('/grammar/academic-tone', data),
}

export default api
