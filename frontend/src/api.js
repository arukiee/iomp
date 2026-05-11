/**
 * api.js — Centralised Axios instance + typed API helpers
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

let isRefreshing = false
let refreshQueue = []

const processRefreshQueue = (error, token = null) => {
  refreshQueue.forEach((callback) => callback(error, token))
  refreshQueue = []
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('epicast_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((err, token) => {
            if (err) {
              reject(err)
            } else {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            }
          })
        })
      }

      isRefreshing = true
      try {
        const refreshResponse = await api.post('/refresh')
        const newToken = refreshResponse.data.access_token
        localStorage.setItem('epicast_token', newToken)
        processRefreshQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processRefreshQueue(refreshError, null)
        localStorage.removeItem('epicast_token')
        localStorage.removeItem('epicast_user')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    if (error.response?.status === 403) {
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email, password) => api.post('/login', { email, password })
export const refreshSession = () => api.post('/refresh')
export const logout = () => api.post('/logout')
export const requestDemoAccess = (payload) => api.post('/request-demo', payload)
export const forgotPassword = (payload) => api.post('/auth/forgot-password', payload)
export const getRolePreviews = () => api.get('/auth/roles')
export const getMe = () => api.get('/me')

export const getAccessRequests = () => api.get('/admin/access-requests')
export const markAccessRequestProvisioned = (id, provisionedUsername) =>
  api.patch(`/admin/access-requests/${id}`, { provisioned_username: provisionedUsername })

// ── Admin: User management ────────────────────────────────────────────────────
export const getUsers    = ()           => api.get('/admin/users')
export const createUser  = (data)       => api.post('/admin/users', data)
export const updateUser  = (id, data)   => api.patch(`/admin/users/${id}`, data)
export const deleteUser  = (id)         => api.delete(`/admin/users/${id}`)

// ── Reports ───────────────────────────────────────────────────────────────────
export const getReports  = ()     => api.get('/reports')
export const reportCase  = (data) => api.post('/report_case',  data)
export const reportDeath = (data) => api.post('/report_death', data)

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardStats  = ()            => api.get('/dashboard/stats')
export const getDashboardZones  = (params = {}) => api.get('/dashboard/zones',  { params })
export const getDashboardAlerts = ()            => api.get('/dashboard/alerts')
export const getAreaSummary     = ()            => api.get('/dashboard/areas')
export const getForecast        = (disease)     => api.get(`/dashboard/forecast/${encodeURIComponent(disease)}`)

// ── Alerts ────────────────────────────────────────────────────────────────────
export const acknowledgeAlert = (id) => api.post(`/alerts/${id}/acknowledge`)

// ── Logs ──────────────────────────────────────────────────────────────────────
export const getLogs = () => api.get('/logs')

export default api
