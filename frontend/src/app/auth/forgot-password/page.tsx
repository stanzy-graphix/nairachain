'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { authAPI, apiError } from '@/lib/api'
import { Button, Input } from '@/components/ui'
import AuthShell from '@/components/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<{ devResetUrl?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await authAPI.forgotPassword(email)
      setSent({ devResetUrl: data.devResetUrl })
    } catch (err) {
      toast.error(apiError(err, 'Request failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <div className="text-center">
          <div className="text-5xl mb-5">✉️</div>
          <h2 className="font-display font-black text-xl mb-3">Check Your Inbox</h2>
          <p className="text-muted text-sm mb-5">If an account exists for <strong className="text-text">{email}</strong>, a reset link is on its way. It expires in 1 hour.</p>
          {sent.devResetUrl && <a href={sent.devResetUrl} className="block mb-4 text-xs text-accent underline">Development: open reset link</a>}
          <Link href="/auth/login"><Button variant="ghost" className="w-full">Back to Login</Button></Link>
        </div>
      ) : (
        <>
          <h1 className="font-display font-black text-2xl mb-1">Reset Password</h1>
          <p className="text-muted text-sm mb-7">Enter your email and we&apos;ll send a reset link.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email Address" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} required />
            <Button type="submit" loading={loading} className="w-full py-3">Send Reset Link</Button>
          </form>
          <div className="mt-4 text-center"><Link href="/auth/login" className="text-xs text-muted hover:text-accent">← Back to Login</Link></div>
        </>
      )}
    </AuthShell>
  )
}
