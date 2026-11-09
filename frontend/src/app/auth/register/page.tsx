'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authAPI, apiError } from '@/lib/api'
import { Button, Input } from '@/components/ui'
import AuthShell from '@/components/AuthShell'

const passwordProblems = (p: string) => [
  p.length < 8 && 'at least 8 characters',
  !/[A-Z]/.test(p) && '1 uppercase letter',
  !/[0-9]/.test(p) && '1 number',
].filter(Boolean) as string[]

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ devVerifyUrl?: string } | null>(null)
  const problems = passwordProblems(form.password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (problems.length) { toast.error('Password needs ' + problems.join(', ')); return }
    setLoading(true)
    try {
      const { data } = await authAPI.register({ ...form, phone: form.phone.replace(/\s/g, '') || undefined })
      setDone({ devVerifyUrl: data.devVerifyUrl })
      toast.success('Account created! Check your email.')
    } catch (err) {
      toast.error(apiError(err, 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <AuthShell>
      <div className="text-center">
        <div className="text-5xl mb-5">📧</div>
        <h2 className="font-display font-black text-2xl mb-3">Check Your Email</h2>
        <p className="text-muted text-sm mb-6">We sent a verification link to <strong className="text-text">{form.email}</strong>. Click it to activate trading.</p>
        {done.devVerifyUrl && (
          <a href={done.devVerifyUrl} className="block mb-4 text-xs text-accent underline">Development: open verification link</a>
        )}
        <Link href="/auth/login"><Button variant="outline" className="w-full">Go to Login</Button></Link>
      </div>
    </AuthShell>
  )

  return (
    <AuthShell>
      <h1 className="font-display font-black text-2xl mb-1">Create Account</h1>
      <p className="text-muted text-sm mb-8">Trade crypto for Naira with escrow protection</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Full Name" autoComplete="name" placeholder="Tunde Adeyemi" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} required minLength={2} />
        <Input label="Email Address" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} required />
        <Input label="Phone Number (optional)" type="tel" autoComplete="tel" placeholder="+2348012345678" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} />
        <div>
          <Input label="Password" type="password" autoComplete="new-password" placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password} onChange={(e: any) => setForm({ ...form, password: e.target.value })} required />
          <p className={`text-xs mt-1 ${form.password && problems.length ? 'text-gold' : 'text-muted'}`}>
            {form.password && !problems.length ? '✓ Strong enough' : 'Needs: ' + (problems.length ? problems.join(', ') : 'at least 8 characters, 1 uppercase letter, 1 number')}
          </p>
        </div>
        <Button type="submit" loading={loading} className="w-full py-3 text-base mt-2">Create Account →</Button>
      </form>
      <div className="mt-5 text-center text-sm text-muted">
        Have an account? <Link href="/auth/login" className="text-accent hover:underline">Login</Link>
      </div>
    </AuthShell>
  )
}
