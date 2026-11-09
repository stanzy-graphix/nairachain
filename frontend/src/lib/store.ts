import { create } from 'zustand'

export interface User {
  id: string
  name: string
  email: string
  phone?: string | null
  isAdmin: boolean
  kycStatus: 'pending' | 'verified' | 'rejected'
  emailVerified: boolean
  rating?: number
  totalTrades?: number
  successfulTrades?: number
  createdAt?: string
}

interface AuthStore {
  user: User | null
  isLoading: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  setUser: (user: User) => void
  clearAuth: () => void
  setLoading: (v: boolean) => void
}

const KEYS = ['accessToken', 'refreshToken', 'user']

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },
  clearAuth: () => {
    KEYS.forEach((k) => localStorage.removeItem(k))
    set({ user: null })
  },
  setLoading: (v) => set({ isLoading: v }),
}))

export const getRefreshToken = () => (typeof window === 'undefined' ? null : localStorage.getItem('refreshToken'))

/** Restore the session from localStorage (call once on the client). */
export const hydrateAuth = () => {
  const store = useAuthStore.getState()
  try {
    const raw = localStorage.getItem('user')
    if (raw && localStorage.getItem('accessToken')) useAuthStore.setState({ user: JSON.parse(raw) })
  } catch {
    KEYS.forEach((k) => localStorage.removeItem(k))
  }
  store.setLoading(false)
}
