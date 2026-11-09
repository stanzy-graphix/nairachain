'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import Navbar from './Navbar'
import { Spinner } from './ui'

/** Renders children only for logged-in users (and admins, if `admin`). */
export default function AuthGuard({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, isLoading } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname() || '/'

  useEffect(() => {
    if (isLoading) return
    if (!user) router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`)
    else if (admin && !user.isAdmin) router.replace('/')
  }, [user, isLoading, admin, pathname, router])

  if (isLoading || !user || (admin && !user.isAdmin)) {
    return <div className="min-h-screen bg-bg"><Navbar /><Spinner /></div>
  }
  return <>{children}</>
}
