'use client'
import { useState } from 'react'
import Link from 'next/link'
import { authAPI } from '@/lib/api'
import { Button, Input, Card } from '@/components/ui'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authAPI.forgotPassword(email)
      setSent(true)
      toast.success('Reset link sent!')
    } catch { toast.error('Request failed') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <Card className="p-9 max-w-md w-full fade-in">
        {sent ? (
          <div className="text-center">
            <div className="text-5xl mb-5">✉️</div>
            <h2 className="font-display font-black text-xl mb-3">Email Sent!</h2>
            <p className="text-muted text-sm mb-5">Check your inbox for the password reset link. It expires in 1 hour.</p>
            <Link href="/auth/login"><Button variant="ghost" className="w-full">Back to Login</Button></Link>
          </div>
        ) : (
          <>
            <h1 className="font-display font-black text-2xl mb-1">Reset Password</h1>
            <p className="text-muted text-sm mb-7">Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <Button type="submit" loading={loading} className="w-full py-3">Send Reset Link</Button>
            </form>
            <div className="mt-4 text-center"><Link href="/auth/login" className="text-xs text-muted hover:text-accent">← Back to Login</Link></div>
          </>
        )}
      </Card>
    </div>
  )
}
