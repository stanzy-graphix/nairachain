'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { authAPI, apiError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button, Input, Spinner } from '@/components/ui'
import AuthShell from '@/components/AuthShell'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Only allow internal redirects
  const nextParam = searchParams?.get('next') || '/market'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/market'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authAPI.login(form)
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success('Welcome back, ' + data.user.name.split(' ')[0] + '!')
      router.push(next)
    } catch (err) {
      setError(apiError(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="font-display font-black text-2xl mb-1">Welcome Back</h1>
      <p className="text-muted text-sm mb-8">Login to your NairaChain wallet</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Email Address" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} required />
        <Input label="Password" type="password" autoComplete="current-password" placeholder="••••••••" value={form.password} onChange={(e: any) => setForm({ ...form, password: e.target.value })} required />
        {error && <p className="text-danger text-xs">{error}</p>}
        <Button type="submit" loading={loading} className="w-full py-3 text-base mt-2">Login →</Button>
      </form>
      <div className="mt-5 text-center text-sm text-muted">
        No account? <Link href="/auth/register" className="text-accent hover:underline">Sign Up Free</Link>
      </div>
      <div className="mt-2 text-center">
        <Link href="/auth/forgot-password" className="text-xs text-muted hover:text-accent">Forgot password?</Link>
      </div>
    </AuthShell>
  )
}

export default function LoginPage() {
  return <Suspense fallback={<Spinner />}><LoginForm /></Suspense>
}
