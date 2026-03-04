import axios from 'axios'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

const api = axios.create({ baseURL: BASE })

// ─── Auth ─────────────────────────────────────────────
export const authAPI = {
  signup:               (d) => api.post('/api/auth/signup', d),
  login:                (d) => api.post('/api/auth/login', d),
  me:                   ()  => api.get('/api/auth/me'),
  verifyEmail:          (t) => api.post('/api/auth/verify-email', { token: t }),
  resetRequest:         (e) => api.post('/api/auth/reset-password-request', { email: e }),
  resetPassword:        (t, p) => api.post('/api/auth/reset-password', { token: t, password: p }),
}

// ─── Wallet ───────────────────────────────────────────
export const walletAPI = {
  getBalances:          ()  => api.get('/api/wallet/balances'),
  getDepositAddress:    (c) => api.get(`/api/wallet/deposit-address/${c}`),
  withdraw:             (d) => api.post('/api/wallet/withdraw', d),
  getTransactions:      ()  => api.get('/api/wallet/transactions'),
}

// ─── Offers ───────────────────────────────────────────
export const offersAPI = {
  list:                 (params) => api.get('/api/offers', { params }),
  create:               (d)      => api.post('/api/offers', d),
  getOne:               (id)     => api.get(`/api/offers/${id}`),
  close:                (id)     => api.patch(`/api/offers/${id}/close`),
}

// ─── Trades ───────────────────────────────────────────
export const tradesAPI = {
  create:               (d)      => api.post('/api/trades', d),
  getOne:               (id)     => api.get(`/api/trades/${id}`),
  myTrades:             ()       => api.get('/api/trades/my'),
  markPaid:             (id)     => api.patch(`/api/trades/${id}/mark-paid`),
  confirmPayment:       (id)     => api.patch(`/api/trades/${id}/confirm-payment`),
  cancelTrade:          (id)     => api.patch(`/api/trades/${id}/cancel`),
  openDispute:          (id, r)  => api.patch(`/api/trades/${id}/dispute`, { reason: r }),
}

// ─── Admin ────────────────────────────────────────────
export const adminAPI = {
  stats:                ()       => api.get('/api/admin/stats'),
  getUsers:             (params) => api.get('/api/admin/users', { params }),
  freezeUser:           (id)     => api.patch(`/api/admin/users/${id}/freeze`),
  unfreezeUser:         (id)     => api.patch(`/api/admin/users/${id}/unfreeze`),
  getDisputes:          ()       => api.get('/api/admin/disputes'),
  resolveDispute:       (id, d)  => api.patch(`/api/admin/disputes/${id}/resolve`, d),
  getAllTrades:          (params) => api.get('/api/admin/trades', { params }),
}

// ─── Interceptor: attach token ────────────────────────
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const Cookies = require('js-cookie')
    const token = Cookies.get('nc_token')
    if (token) config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

export default api
