'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authAPI } from '@/lib/api'
import { Button, Input, Card } from '@/components/ui'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await authAPI.register(form)
      setDone(true)
      toast.success('Account created! Check your email.')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <Card className="p-10 max-w-md w-full text-center fade-in">
        <div className="text-5xl mb-5">📧</div>
        <h2 className="font-display font-black text-2xl mb-3">Check Your Email</h2>
        <p className="text-muted text-sm mb-6">We sent a verification link to <strong className="text-text">{form.email}</strong>. Click it to activate your account.</p>
        <Link href="/auth/login"><Button variant="outline" className="w-full">Go to Login</Button></Link>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="font-display font-black text-2xl">
            <span className="text-text">NAIRA</span><span className="text-accent">CHAIN</span>
          </Link>
        </div>
        <Card className="p-9">
          <h1 className="font-display font-black text-2xl mb-1">Create Account</h1>
          <p className="text-muted text-sm mb-8">Join 18,000+ traders on NairaChain</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full Name" placeholder="Tunde Adeyemi" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            <Input label="Email Address" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
            <Input label="Phone Number" type="tel" placeholder="+234 801 234 5678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <div>
              <Input label="Password" type="password" placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              <p className="text-xs text-muted mt-1">At least 8 characters with 1 uppercase and 1 number</p>
            </div>
            <Button type="submit" loading={loading} className="w-full py-3 text-base mt-2">Create Account →</Button>
          </form>
          <div className="mt-5 text-center text-sm text-muted">
            Have an account? <Link href="/auth/login" className="text-accent hover:underline">Login</Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
