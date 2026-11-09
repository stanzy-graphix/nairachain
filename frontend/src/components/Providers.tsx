'use client'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { authAPI } from '@/lib/api'
import { hydrateAuth, useAuthStore } from '@/lib/store'

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    hydrateAuth()
    // Refresh the cached profile (KYC/verification may have changed server-side)
    if (useAuthStore.getState().user) {
      authAPI.me().then(({ data }) => useAuthStore.getState().setUser(data.user)).catch(() => {})
    }
  }, [])

  return (
    <>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#161D2E', color: '#E8EDF5', border: '1px solid #1E2D47', fontFamily: 'DM Mono, monospace', fontSize: '13px' },
        success: { iconTheme: { primary: '#00D4AA', secondary: '#000' } },
        error: { iconTheme: { primary: '#FF4D6D', secondary: '#fff' } },
      }} />
      {children}
    </>
  )
}
