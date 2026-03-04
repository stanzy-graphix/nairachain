'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Button, Card, Spinner, Stars } from '@/components/ui'
import { offersAPI, tradesAPI } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { formatNaira, formatCrypto, cryptoIcon } from '@/lib/utils'
import toast from 'react-hot-toast'

function NewTradeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const offerId = searchParams.get('offer')
  const [offer, setOffer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!offerId) { router.push('/market'); return }
    offersAPI.get(offerId).then(({ data }) => setOffer(data.offer)).catch(() => {
      toast.error('Offer not found'); router.push('/market')
    }).finally(() => setLoading(false))
  }, [offerId])

  const cryptoAmount = amount && offer ? (parseFloat(amount) / parseFloat(offer.price_per_unit)) : 0
  const feeAmount = amount ? parseFloat(amount) * 0.005 : 0

  const handleTrade = async () => {
    if (!user) { router.push('/auth/login'); return }
    if (!amount || parseFloat(amount) < parseFloat(offer.min_amount)) {
      toast.error(`Minimum amount is ${formatNaira(offer.min_amount)}`); return
    }
    if (parseFloat(amount) > parseFloat(offer.max_amount)) {
      toast.error(`Maximum amount is ${formatNaira(offer.max_amount)}`); return
    }
    setSubmitting(true)
    try {
      const { data } = await tradesAPI.create({ offerId: offer.id, nairaAmount: parseFloat(amount) })
      toast.success('Trade started! Escrow locked.')
      router.push(`/trades/${data.trade.trade_ref}`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start trade')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-bg"><Navbar /><Spinner /></div>
  if (!offer) return null

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-lg mx-auto px-6 py-10 fade-in">
        <button onClick={() => router.back()} className="text-muted text-sm hover:text-accent mb-6 flex items-center gap-1">← Back to Market</button>

        {/* Escrow steps */}
        <Card className="p-5 mb-5">
          <div className="text-xs text-muted font-semibold uppercase tracking-wider mb-4">Escrow Protection</div>
          <div className="flex items-center gap-1">
            {['Accept', 'Lock Crypto', 'Send ₦', 'Confirm', '✓ Done'].map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-accent text-black' : 'bg-border text-muted'}`}>
                    {i === 0 ? '1' : i + 1}
                  </div>
                  <div className={`text-[10px] mt-1 text-center leading-tight ${i === 0 ? 'text-accent' : 'text-muted'}`}>{s}</div>
                </div>
                {i < 4 && <div className="h-0.5 bg-border flex-shrink-0 w-2 mb-4" />}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-7">
          {/* Offer header */}
          <div className="flex justify-between items-start pb-5 mb-5 border-b border-border">
            <div>
              <h1 className="font-display font-black text-2xl mb-1">
                {offer.type === 'sell' ? 'Buy' : 'Sell'} {cryptoIcon[offer.crypto]} {offer.crypto}
              </h1>
              <div className="text-muted text-sm">with {offer.trader_name}</div>
              <Stars rating={parseFloat(offer.trader_rating) || 0} />
            </div>
            <div className="text-right">
              <div className="font-display font-black text-2xl text-accent">{formatNaira(offer.price_per_unit)}</div>
              <div className="text-xs text-muted">per {offer.crypto}</div>
            </div>
          </div>

          {/* Limits */}
          <div className="bg-surface rounded-lg p-3.5 mb-5 text-sm flex justify-between">
            <span className="text-muted">Limits</span>
            <span>{formatNaira(offer.min_amount)} – {formatNaira(offer.max_amount)}</span>
          </div>

          {/* Amount input */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-2">Amount in Naira (₦)</label>
            <input
              type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={`Min: ${formatNaira(offer.min_amount)}`}
              className="w-full bg-surface border border-border rounded-lg px-4 py-4 text-2xl font-display font-bold text-text focus:border-accent outline-none transition"
            />
          </div>

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-surface rounded-lg p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">You receive</span>
                <span className="text-accent font-semibold">{formatCrypto(cryptoAmount, offer.crypto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Platform fee (0.5%)</span>
                <span className="text-danger">-{formatNaira(feeAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold">Total Naira to send</span>
                <span className="font-semibold">{formatNaira(amount)}</span>
              </div>
            </div>
          )}

          <div className="bg-surface rounded-lg p-3.5 mb-5 text-xs text-muted">
            ⏱ Trade expires in <span className="text-gold font-semibold">30 minutes</span> after you accept. Crypto will be locked in escrow immediately.
          </div>

          <Button onClick={handleTrade} loading={submitting} className="w-full py-4 text-base">
            Accept Offer & Lock Escrow →
          </Button>
        </Card>
      </main>
    </div>
  )
}

export default function NewTradePage() {
  return <Suspense fallback={<Spinner />}><NewTradeContent /></Suspense>
}
