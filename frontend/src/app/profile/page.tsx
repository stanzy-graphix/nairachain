'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import AuthGuard from '@/components/AuthGuard'
import { Button, Card, Input, Row, Badge, Stars } from '@/components/ui'
import { authAPI, usersAPI, apiError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { formatDate } from '@/lib/utils'

function Profile() {
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState({ name: user!.name, phone: user!.phone || '' })
  const [saving, setSaving] = useState(false)
  const [ratings, setRatings] = useState<any[]>([])

  useEffect(() => {
    authAPI.me().then(({ data }) => { setUser(data.user); setForm({ name: data.user.name, phone: data.user.phone || '' }) }).catch(() => {})
    usersAPI.profile(user!.id).then(({ data }) => setRatings(data.ratings)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await usersAPI.update({ name: form.name.trim(), phone: form.phone.replace(/\s/g, '') || undefined })
      setUser(data.user)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(apiError(err, 'Update failed'))
    } finally {
      setSaving(false)
    }
  }

  const u = user!
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-10 fade-in">
        <h1 className="font-display font-black text-3xl mb-7">My Profile</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-blue flex items-center justify-center text-black font-bold text-xl">{u.name[0]?.toUpperCase()}</div>
              <div>
                <div className="font-display font-bold text-lg">{u.name}</div>
                <Stars rating={u.rating || 0} />
              </div>
            </div>
            <Row k="Email" v={u.email} />
            <Row k="Email verified" v={u.emailVerified ? '✓ Yes' : 'No'} />
            <Row k="KYC" v={<Badge status={u.kycStatus} />} />
            <Row k="Trades" v={`${u.successfulTrades ?? 0} completed / ${u.totalTrades ?? 0} total`} />
            {u.createdAt && <Row k="Member since" v={formatDate(u.createdAt)} />}
          </Card>

          <Card className="p-6">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Edit Details</div>
            <form onSubmit={save} className="flex flex-col gap-4">
              <Input label="Full Name" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} required minLength={2} />
              <Input label="Phone" type="tel" placeholder="+2348012345678" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} />
              <Button type="submit" loading={saving}>Save Changes</Button>
            </form>
          </Card>
        </div>

        <h2 className="font-display font-bold text-xl mt-10 mb-4">Recent Feedback</h2>
        {ratings.length === 0 ? <p className="text-muted text-sm">No ratings yet. Complete trades to build your reputation.</p> : (
          <Card>
            {ratings.map((r, i) => (
              <div key={i} className={`p-4 ${i < ratings.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{r.rater_name}</span><Stars rating={r.score} /></div>
                {r.comment && <p className="text-muted text-sm mt-1">{r.comment}</p>}
                <div className="text-[10px] text-muted mt-1">{formatDate(r.created_at)}</div>
              </div>
            ))}
          </Card>
        )}
      </main>
    </div>
  )
}

export default function ProfilePage() {
  return <AuthGuard><Profile /></AuthGuard>
}
