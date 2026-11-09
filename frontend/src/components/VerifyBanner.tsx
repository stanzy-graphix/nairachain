'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { authAPI, apiError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

/** Reminds unverified users to confirm their email (required to trade). */
export default function VerifyBanner() {
  const { user } = useAuthStore()
  const [sending, setSending] = useState(false)
  const [devUrl, setDevUrl] = useState<string | null>(null)
  if (!user || user.emailVerified) return null

  const resend = async () => {
    setSending(true)
    try {
      const { data } = await authAPI.resendVerification()
      toast.success('Verification email sent')
      if (data.devVerifyUrl) setDevUrl(data.devVerifyUrl)
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="bg-gold/10 border-b border-gold/30 text-gold text-xs px-6 py-2.5 flex flex-wrap items-center justify-center gap-3">
      <span>📧 Verify your email to deposit, create offers and trade.</span>
      <button onClick={resend} disabled={sending} className="underline hover:text-text disabled:opacity-50">
        {sending ? 'Sending…' : 'Resend link'}
      </button>
      {devUrl && <a href={devUrl} className="underline text-accent">Open dev verify link</a>}
    </div>
  )
}
