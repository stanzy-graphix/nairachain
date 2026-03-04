import axios from 'axios'

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
})

// Attach token to every request
API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh on 401
API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, { refreshToken })
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('refreshToken', data.refreshToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return API(original)
      } catch {
        localStorage.clear()
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  register: (data: any) => API.post('/auth/register', data),
  login: (data: any) => API.post('/auth/login', data),
  logout: (refreshToken: string) => API.post('/auth/logout', { refreshToken }),
  me: () => API.get('/auth/me'),
  verifyEmail: (token: string) => API.get(`/auth/verify-email?token=${token}`),
  forgotPassword: (email: string) => API.post('/auth/forgot-password', { email }),
  resetPassword: (data: any) => API.post('/auth/reset-password', data),
}

export const walletAPI = {
  getWallets: () => API.get('/wallet'),
  getDepositAddress: (crypto: string) => API.get(`/wallet/${crypto}/deposit-address`),
  withdraw: (data: any) => API.post('/wallet/withdraw', data),
  getTransactions: (params?: any) => API.get('/wallet/transactions', { params }),
}

export const offersAPI = {
  list: (params?: any) => API.get('/offers', { params }),
  get: (id: string) => API.get(`/offers/${id}`),
  create: (data: any) => API.post('/offers', data),
  updateStatus: (id: string, status: string) => API.patch(`/offers/${id}/status`, { status }),
  myOffers: () => API.get('/offers/my/offers'),
}

export const tradesAPI = {
  create: (data: any) => API.post('/trades', data),
  list: (params?: any) => API.get('/trades', { params }),
  get: (ref: string) => API.get(`/trades/${ref}`),
  markPaymentSent: (ref: string) => API.patch(`/trades/${ref}/payment-sent`),
  confirmPayment: (ref: string) => API.patch(`/trades/${ref}/confirm-payment`),
  openDispute: (ref: string, reason: string) => API.patch(`/trades/${ref}/dispute`, { reason }),
  sendMessage: (ref: string, message: string) => API.post(`/trades/${ref}/message`, { message }),
  rate: (ref: string, data: any) => API.post(`/trades/${ref}/rate`, data),
}

export const adminAPI = {
  stats: () => API.get('/admin/stats'),
  users: (params?: any) => API.get('/admin/users', { params }),
  freezeUser: (id: string, frozen: boolean) => API.patch(`/admin/users/${id}/freeze`, { frozen }),
  updateKyc: (id: string, status: string) => API.patch(`/admin/users/${id}/kyc`, { status }),
  disputes: () => API.get('/admin/disputes'),
  resolveDispute: (tradeId: string, data: any) => API.patch(`/admin/disputes/${tradeId}/resolve`, data),
  transactions: (params?: any) => API.get('/admin/transactions', { params }),
}

export default API
