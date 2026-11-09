import axios, { AxiosError } from 'axios'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'

const API = axios.create({ baseURL: API_URL })

API.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// One refresh at a time, shared by all requests that hit a 401 together
let refreshing: Promise<string> | null = null

export const refreshAccessToken = (): Promise<string> => {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) throw new Error('No refresh token')
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      return data.accessToken as string
    })().finally(() => { refreshing = null })
  }
  return refreshing
}

API.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original: any = err.config
    const isAuthCall = original?.url?.startsWith('/auth/login') || original?.url?.startsWith('/auth/refresh')
    if (err.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true
      try {
        const token = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${token}`
        return API(original)
      } catch {
        ;['accessToken', 'refreshToken', 'user'].forEach((k) => localStorage.removeItem(k))
        const next = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/auth/login?next=${next}`
      }
    }
    return Promise.reject(err)
  }
)

/** Best human-readable message from an API error. */
export const apiError = (err: any, fallback = 'Something went wrong') =>
  err?.response?.data?.error || (err?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Is the API running?' : fallback)

export const authAPI = {
  register: (data: any) => API.post('/auth/register', data),
  login: (data: any) => API.post('/auth/login', data),
  logout: (refreshToken: string) => API.post('/auth/logout', { refreshToken }),
  me: () => API.get('/auth/me'),
  verifyEmail: (token: string) => API.get('/auth/verify-email', { params: { token } }),
  resendVerification: () => API.post('/auth/resend-verification'),
  forgotPassword: (email: string) => API.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; password: string }) => API.post('/auth/reset-password', data),
}

export const usersAPI = {
  profile: (id: string) => API.get(`/users/${id}/profile`),
  update: (data: { name?: string; phone?: string }) => API.patch('/users/profile', data),
}

export const pricesAPI = {
  get: () => API.get('/prices'),
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
  cancel: (ref: string) => API.patch(`/trades/${ref}/cancel`),
  openDispute: (ref: string, reason: string) => API.patch(`/trades/${ref}/dispute`, { reason }),
  sendMessage: (ref: string, message: string) => API.post(`/trades/${ref}/message`, { message }),
  rate: (ref: string, data: { score: number; comment?: string }) => API.post(`/trades/${ref}/rate`, data),
}

export const adminAPI = {
  stats: () => API.get('/admin/stats'),
  users: (params?: any) => API.get('/admin/users', { params }),
  freezeUser: (id: string, frozen: boolean) => API.patch(`/admin/users/${id}/freeze`, { frozen }),
  updateKyc: (id: string, status: string) => API.patch(`/admin/users/${id}/kyc`, { status }),
  creditUser: (id: string, data: { crypto: string; amount: number; txHash?: string }) => API.post(`/admin/users/${id}/credit`, data),
  disputes: () => API.get('/admin/disputes'),
  resolveDispute: (tradeId: string, data: { winner: 'buyer' | 'seller'; resolution?: string }) => API.patch(`/admin/disputes/${tradeId}/resolve`, data),
  withdrawals: (status = 'pending') => API.get('/admin/withdrawals', { params: { status } }),
  processWithdrawal: (id: string, data: { action: 'approve' | 'reject'; txHash?: string; reason?: string }) => API.patch(`/admin/withdrawals/${id}`, data),
  transactions: (params?: any) => API.get('/admin/transactions', { params }),
}

export default API
