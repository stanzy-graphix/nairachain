'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import AuthGuard from '@/components/AuthGuard'
import { Button, Card, Spinner, Stars, Input, Row } from '@/components/ui'
import { offersAPI, tradesAPI, walletAPI, apiError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { formatNaira, formatCrypto, cryptoIcon } from '@/lib/utils'

const FEE_RATE = 0.005

function NewTradeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)!
  const offerId = searchParams?.get('offer')
  const [offer, setOffer] = useState<any>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState({ bankName: '', bankAccountName: '', bankAccountNumber: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!offerId) { router.replace('/market'); return }
    offersAPI.get(offerId)
      .then(async ({ data }) => {
        setOffer(data.offer)
        if (data.offer.type === 'buy') {
          // Taker is selling: show how much they can sell
          const { data: w } = await walletAPI.getWallets()
          const wallet = w.wallets.find((x: any) => x.crypto_type === data.offer.crypto)
          setAvailable(wallet ? parseFloat(wallet.balance) : 0)
        }
      })
      .catch(() => { toast.error('Offer not found'); router.replace('/market') })
      .finally(() => setLoading(false))
  }, [offerId, router])

  if (loading) return <div className="min-h-screen bg-bg"><Navbar /><Spinner /></div>
  if (!offer) return null

  const isBuying = offer.type === 'sell' // taker buys from a sell offer
  const naira = parseFloat(amount) || 0
  const cryptoAmount = naira / parseFloat(offer.price_per_unit)
  const feeAmount = naira * FEE_RATE
  const maxBySellerBalance = available !== null ? available * parseFloat(offer.price_per_unit) : Infinity
  const max = Math.min(parseFloat(offer.max_amount), maxBySellerBalance)

  const handleTrade = async () => {
    if (!user.emailVerified) { toast.error('Verify your email before trading'); return }
    if (naira < parseFloat(offer.min_amount)) { toast.error(`Minimum amount is ${formatNaira(offer.min_amount)}`); return }
    if (naira > parseFloat(offer.max_amount)) { toast.error(`Maximum amount is ${formatNaira(offer.max_amount)}`); return }
    setSubmitting(true)
    try {
      const { data } = await tradesAPI.create({ offerId: offer.id, nairaAmount: naira, ...(isBuying ? {} : bank) })
      toast.success('Trade started! Crypto is locked in escrow.')
      router.push(`/trades/${data.trade.trade_ref}`)
    } catch (err) {
      toast.error(apiError(err, 'Failed to start trade'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 md:px-6 py-10 fade-in">
        <Link href="/market" className="text-muted text-sm hover:text-accent mb-6 inline-flex items-center gap-1">← Back to Market</Link>

        <Card className="p-6 md:p-7">
          <div className="flex justify-between items-start pb-5 mb-5 border-b border-border">
            <div>
              <h1 className="font-display font-black text-2xl mb-1">{isBuying ? 'Buy' : 'Sell'} {cryptoIcon[offer.crypto]} {offer.crypto}</h1>
              <div className="text-muted text-sm">{isBuying ? 'from' : 'to'} {offer.trader_name}</div>
              <Stars rating={parseFloat(offer.trader_rating)} />
            </div>
            <div className="text-right">
              <div className="font-display font-black text-2xl text-accent">{formatNaira(offer.price_per_unit)}</div>
              <div className="text-xs text-muted">per {offer.crypto}</div>
            </div>
          </div>

          <div className="bg-surface rounded-lg p-3.5 mb-5">
            <Row k="Limits" v={`${formatNaira(offer.min_amount)} – ${formatNaira(offer.max_amount)}`} />
            <Row k="Payment" v={offer.payment_method} />
            {available !== null && <Row k={`Your ${offer.crypto} balance`} v={formatCrypto(available, offer.crypto)} />}
          </div>
          {offer.terms && <div className="text-xs text-muted bg-surface rounded-lg p-3.5 mb-5">📝 {offer.terms}</div>}

          <div className="mb-5">
            <div className="flex justify-between items-end mb-2">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider">Amount in Naira (₦)</label>
              {isFinite(max) && max >= parseFloat(offer.min_amount) && (
                <button type="button" onClick={() => setAmount(String(Math.floor(max)))} className="text-xs text-accent hover:underline">Max</button>
              )}
            </div>
            <input type="number" min={offer.min_amount} max={offer.max_amount} value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min: ${formatNaira(offer.min_amount)}`}
              className="w-full bg-surface border border-border rounded-lg px-4 py-4 text-2xl font-display font-bold text-text focus:border-accent outline-none transition" />
          </div>

          {naira > 0 && (
            <div className="bg-surface rounded-lg p-4 mb-5 text-sm">
              <Row k={isBuying ? 'You receive' : 'You send (from escrow)'} v={<span className="text-accent">{formatCrypto(cryptoAmount, offer.crypto)}</span>} />
              <Row k={isBuying ? 'You pay by bank transfer' : 'You receive by bank transfer'} v={formatNaira(naira)} strong />
              <Row k="Platform fee (0.5%, recorded on completion)" v={formatNaira(feeAmount)} />
            </div>
          )}

          {!isBuying && (
            <div className="border-t border-border pt-5 mb-5">
              <p className="text-xs text-muted mb-3 font-semibold uppercase tracking-wider">Your bank details (the buyer pays you here)</p>
              <div className="flex flex-col gap-3">
                <Input label="Bank Name" value={bank.bankName} onChange={(e: any) => setBank({ ...bank, bankName: e.target.value })} placeholder="GTBank" />
                <Input label="Account Name" value={bank.bankAccountName} onChange={(e: any) => setBank({ ...bank, bankAccountName: e.target.value })} placeholder={user.name} />
                <Input label="Account Number" inputMode="numeric" value={bank.bankAccountNumber} onChange={(e: any) => setBank({ ...bank, bankAccountNumber: e.target.value })} placeholder="0123456789" />
              </div>
            </div>
          )}

          <div className="bg-surface rounded-lg p-3.5 mb-5 text-xs text-muted">
            ⏱ {isBuying ? 'You have' : 'The buyer has'} <span className="text-gold font-semibold">30 minutes</span> to send payment once the trade opens.
            {isBuying ? " The seller's" : ' Your'} crypto is locked in escrow immediately and released only after the seller confirms payment.
          </div>

          <Button onClick={handleTrade} loading={submitting} className="w-full py-4 text-base">
            {isBuying ? 'Open Trade & Lock Escrow →' : 'Lock My Crypto & Open Trade →'}
          </Button>
        </Card>
      </main>
    </div>
  )
}

export default function NewTradePage() {
  return <AuthGuard><Suspense fallback={<Spinner />}><NewTradeContent /></Suspense></AuthGuard>
}
