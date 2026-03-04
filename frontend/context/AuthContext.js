import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import Cookies from 'js-cookie'
import { useRouter } from 'next/router'

const AuthContext = createContext(null)

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Set axios auth header
  const setAxiosAuth = (token) => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }

  // Load user from token on mount
  useEffect(() => {
    const token = Cookies.get('nc_token')
    if (token) {
      setAxiosAuth(token)
      axios.get(`${API}/api/auth/me`)
        .then(res => setUser(res.data.user))
        .catch(() => { Cookies.remove('nc_token'); setAxiosAuth(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const signup = async ({ name, email, password }) => {
    const res = await axios.post(`${API}/api/auth/signup`, { name, email, password })
    return res.data
  }

  const login = async ({ email, password }) => {
    const res = await axios.post(`${API}/api/auth/login`, { email, password })
    const { token, user } = res.data
    Cookies.set('nc_token', token, { expires: 7 })
    setAxiosAuth(token)
    setUser(user)
    return user
  }

  const logout = () => {
    Cookies.remove('nc_token')
    setAxiosAuth(null)
    setUser(null)
    router.push('/')
  }

  const verifyEmail = async (token) => {
    const res = await axios.post(`${API}/api/auth/verify-email`, { token })
    return res.data
  }

  const resetPasswordRequest = async (email) => {
    const res = await axios.post(`${API}/api/auth/reset-password-request`, { email })
    return res.data
  }

  const resetPassword = async (token, password) => {
    const res = await axios.post(`${API}/api/auth/reset-password`, { token, password })
    return res.data
  }

  return (
    <AuthContext.Provider value={{
      user, loading, setUser,
      signup, login, logout,
      verifyEmail, resetPasswordRequest, resetPassword,
      isLoggedIn: !!user,
      isAdmin: user?.role === 'admin',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
