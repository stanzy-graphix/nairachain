import { create } from 'zustand'

interface User {
  id: string; name: string; email: string; isAdmin: boolean;
  kycStatus: string; emailVerified: boolean;
}

interface AuthStore {
  user: User | null; accessToken: string | null; refreshToken: string | null;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void; setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null, accessToken: null, refreshToken: null, isLoading: true,
  setAuth: (user, accessToken, refreshToken) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(user))
    }
    set({ user, accessToken, refreshToken })
  },
  clearAuth: () => {
    if (typeof window !== 'undefined') localStorage.clear()
    set({ user: null, accessToken: null, refreshToken: null })
  },
  setLoading: (v) => set({ isLoading: v }),
}))

export const initAuth = () => {
  if (typeof window === 'undefined') return
  const store = useAuthStore.getState()
  const user = localStorage.getItem('user')
  const accessToken = localStorage.getItem('accessToken')
  const refreshToken = localStorage.getItem('refreshToken')
  if (user && accessToken) {
    store.setAuth(JSON.parse(user), accessToken, refreshToken || '')
  }
  store.setLoading(false)
}
