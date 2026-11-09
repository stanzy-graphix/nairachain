'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { authAPI, apiError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button, Spinner } from '@/components/ui'
import AuthShell from '@/components/AuthShell'

function Verify() {
  const token = useSearchParams()?.get('token')
  const [state, setState] = useState<{ status: 'loading' | 'ok' | 'error'; message?: string }>({ status: 'loading' })
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // strict-mode double effect would burn the one-time token
    ran.current = true
    if (!token) { setState({ status: 'error', message: 'Missing verification token' }); return }
    authAPI.verifyEmail(token)
      .then(() => {
        setState({ status: 'ok' })
        const { user, setUser } = useAuthStore.getState()
        if (user) setUser({ ...user, emailVerified: true })
      })
      .catch((err) => setState({ status: 'error', message: apiError(err, 'Verification failed') }))
  }, [token])

  const loggedIn = !!useAuthStore((s) => s.user)

  return (
    <AuthShell>
      <div className="text-center">
        {state.status === 'loading' && <><Spinner /><p className="text-muted text-sm">Verifying your email…</p></>}
        {state.status === 'ok' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="font-display font-black text-2xl mb-3">Email Verified</h1>
            <p className="text-muted text-sm mb-6">You can now deposit, create offers and trade.</p>
            <Link href={loggedIn ? '/market' : '/auth/login'}><Button className="w-full">{loggedIn ? 'Go to Market' : 'Login'}</Button></Link>
          </>
        )}
        {state.status === 'error' && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="font-display font-black text-2xl mb-3">Verification Failed</h1>
            <p className="text-muted text-sm mb-6">{state.message}. Log in to request a new link.</p>
            <Link href="/auth/login"><Button variant="outline" className="w-full">Login</Button></Link>
          </>
        )}
      </div>
    </AuthShell>
  )
}

export default function VerifyPage() {
  return <Suspense fallback={<Spinner />}><Verify /></Suspense>
}
