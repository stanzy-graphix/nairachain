'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authAPI } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button, Input, Card } from '@/components/ui'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    try {
      const { data } = await authAPI.login(form)
      setAuth(data.user, data.accessToken, data.refreshToken)
      toast.success('Welcome back, ' + data.user.name.split(' ')[0] + '!')
      router.push('/')
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Login failed'
      toast.error(msg)
      setErrors({ form: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="font-display font-black text-2xl">
            <span className="text-text">NAIRA</span><span className="text-accent">CHAIN</span>
          </Link>
        </div>
        <Card className="p-9">
          <h1 className="font-display font-black text-2xl mb-1">Welcome Back</h1>
          <p className="text-muted text-sm mb-8">Login to your NairaChain wallet</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email Address" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            <Input label="Password" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            {errors.form && <p className="text-danger text-xs">{errors.form}</p>}
            <Button type="submit" loading={loading} className="w-full py-3 text-base mt-2">Login →</Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted">
            No account?{' '}
            <Link href="/auth/register" className="text-accent hover:underline">Sign Up Free</Link>
          </div>
          <div className="mt-2 text-center">
            <Link href="/auth/forgot-password" className="text-xs text-muted hover:text-accent">Forgot password?</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
