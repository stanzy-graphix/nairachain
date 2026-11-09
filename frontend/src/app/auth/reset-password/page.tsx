'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { authAPI, apiError } from '@/lib/api'
import { Button, Input, Spinner } from '@/components/ui'
import AuthShell from '@/components/AuthShell'

function ResetForm() {
  const token = useSearchParams()?.get('token') || ''
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await authAPI.resetPassword({ token, password })
      toast.success('Password updated. Please log in.')
      router.push('/auth/login')
    } catch (err) {
      toast.error(apiError(err, 'Reset failed'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) return (
    <AuthShell>
      <div className="text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="font-display font-black text-xl mb-3">Invalid reset link</h1>
        <Link href="/auth/forgot-password"><Button variant="outline" className="w-full">Request a new link</Button></Link>
      </div>
    </AuthShell>
  )

  return (
    <AuthShell>
      <h1 className="font-display font-black text-2xl mb-1">Choose a New Password</h1>
      <p className="text-muted text-sm mb-7">At least 8 characters with 1 uppercase letter and 1 number.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="New Password" type="password" autoComplete="new-password" value={password} onChange={(e: any) => setPassword(e.target.value)} required minLength={8} />
        <Input label="Confirm Password" type="password" autoComplete="new-password" value={confirm} onChange={(e: any) => setConfirm(e.target.value)} required />
        <Button type="submit" loading={loading} className="w-full py-3">Update Password</Button>
      </form>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<Spinner />}><ResetForm /></Suspense>
}
