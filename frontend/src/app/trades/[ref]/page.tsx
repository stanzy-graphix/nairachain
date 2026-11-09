'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { io, Socket } from 'socket.io-client'
import Navbar from '@/components/Navbar'
import AuthGuard from '@/components/AuthGuard'
import { Button, Card, Badge, Spinner, Row, Textarea } from '@/components/ui'
import { tradesAPI, apiError, refreshAccessToken, SOCKET_URL } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { formatNaira, formatCrypto, formatTime } from '@/lib/utils'

const STEPS = [
  { key: 'pending_payment', label: 'Awaiting Payment' },
  { key: 'payment_sent', label: 'Payment Sent' },
  { key: 'completed', label: 'Completed' },
]

function useCountdown(target: string | null, offsetMs: number) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!target) return
    const tick = () => setLeft(Math.max(0, new Date(target).getTime() - (Date.now() + offsetMs)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [target, offsetMs])
  return left
}

function TradeRoom() {
  const ref = useParams<{ ref: string }>()?.ref ?? ''
  const router = useRouter()
  const user = useAuthStore((s) => s.user)!
  const [trade, setTrade] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clockOffset, setClockOffset] = useState(0)
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  const loadTrade = useCallback(async () => {
    try {
      const { data } = await tradesAPI.get(ref)
      setTrade(data.trade)
      setMessages(data.messages)
      if (data.serverTime) setClockOffset(new Date(data.serverTime).getTime() - Date.now())
    } catch {
      toast.error('Trade not found')
      router.push('/trades')
    } finally {
      setLoading(false)
    }
  }, [ref, router])

  useEffect(() => { loadTrade() }, [loadTrade])

  // Real-time updates: join this trade's room once we know its id
  const tradeId = trade?.id
  useEffect(() => {
    if (!tradeId) return
    const socket = io(SOCKET_URL, { auth: (cb) => cb({ token: localStorage.getItem('accessToken') }) })
    socketRef.current = socket
    socket.on('connect', () => socket.emit('join_trade', tradeId))
    socket.on('connect_error', async (err) => {
      if (err.message === 'Invalid token') { try { await refreshAccessToken(); socket.connect() } catch {} }
    })
    socket.on('new_message', (msg: any) => setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])))
    socket.on('trade_status', () => loadTrade())
    return () => { socket.disconnect() }
  }, [tradeId, loadTrade])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const msLeft = useCountdown(trade?.status === 'pending_payment' ? trade.expires_at : null, clockOffset)

  const run = async (fn: () => Promise<any>, success: string) => {
    setActionLoading(true)
    try { await fn(); toast.success(success); await loadTrade() }
    catch (e) { toast.error(apiError(e)) }
    finally { setActionLoading(false) }
  }

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = msgInput.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const { data } = await tradesAPI.sendMessage(ref, text)
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]))
      setMsgInput('')
    } catch (err) { toast.error(apiError(err, 'Failed to send')) }
    finally { setSending(false) }
  }

  if (loading) return <div className="min-h-screen bg-bg"><Navbar /><Spinner /></div>
  if (!trade) return null

  const isBuyer = user.id === trade.buyer_id
  const isSeller = user.id === trade.seller_id
  const counterparty = isBuyer ? trade.seller_name : trade.buyer_name
  const stepIndex = trade.status === 'completed' ? 2 : trade.status === 'pending_payment' ? 0 : 1
  const closed = ['completed', 'cancelled'].includes(trade.status)
  const mm = Math.floor(msLeft / 60000)
  const ss = Math.floor((msLeft % 60000) / 1000).toString().padStart(2, '0')

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 fade-in">
        <Link href="/trades" className="text-muted text-sm hover:text-accent mb-5 inline-flex items-center gap-1">← My Trades</Link>

        <div className="flex justify-between items-center mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-black text-2xl">{trade.trade_ref}</h1>
            <p className="text-muted text-sm">
              <span className={isBuyer ? 'text-accent' : 'text-danger'}>{isBuyer ? 'Buying' : 'Selling'}</span>{' '}
              {formatCrypto(trade.crypto_amount, trade.crypto)} · {formatNaira(trade.naira_amount)} · with {counterparty}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {trade.status === 'pending_payment' && (
              <span className={`font-display font-bold text-lg ${msLeft < 5 * 60000 ? 'text-danger' : 'text-gold'}`}>⏱ {mm}:{ss}</span>
            )}
            <Badge status={trade.status} />
          </div>
        </div>

        {/* Progress */}
        {['cancelled', 'disputed'].includes(trade.status) ? (
          <Card className={`p-5 mb-5 ${trade.status === 'disputed' ? 'border-danger/30' : ''}`}>
            {trade.status === 'disputed' ? (
              <div className="text-sm"><span className="text-danger font-semibold">⚠️ Under dispute.</span> <span className="text-muted">Escrow is frozen while an admin reviews the trade. Keep any payment evidence and use the chat to share details.</span></div>
            ) : (
              <div className="text-sm"><span className="font-semibold">Trade cancelled.</span> <span className="text-muted">{trade.cancel_reason || ''} — escrowed crypto was returned to the seller.</span></div>
            )}
          </Card>
        ) : (
          <Card className="p-5 mb-5">
            <div className="flex items-center">
              {STEPS.map(({ key, label }, i) => (
                <div key={key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= stepIndex ? 'bg-accent text-black' : 'bg-border text-muted'}`}>
                      {i < stepIndex || trade.status === 'completed' ? '✓' : i + 1}
                    </div>
                    <div className={`text-xs mt-1 text-center whitespace-nowrap ${i <= stepIndex ? 'text-accent' : 'text-muted'}`}>{label}</div>
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-2 mb-5 ${i < stepIndex ? 'bg-accent' : 'bg-border'}`} />}
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-5">
            <Card className="p-5">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Trade Details</div>
              <Row k="Amount" v={formatCrypto(trade.crypto_amount, trade.crypto)} />
              <Row k="Naira Value" v={formatNaira(trade.naira_amount)} />
              <Row k="Rate" v={`${formatNaira(trade.price_per_unit)} / ${trade.crypto}`} />
              <Row k="Platform Fee" v={formatNaira(trade.fee_amount)} />
              <Row k="Buyer" v={trade.buyer_name + (isBuyer ? ' (you)' : '')} />
              <Row k="Seller" v={trade.seller_name + (isSeller ? ' (you)' : '')} />
              <Row k="Escrow" v={trade.escrow_status} />
            </Card>

            {/* Payment instructions */}
            {['pending_payment', 'payment_sent', 'disputed'].includes(trade.status) && (
              <Card className="p-5 border-accent/30">
                <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-4">
                  {isBuyer ? '💳 Send Naira To' : '💳 Buyer Pays Into Your Account'}
                </div>
                <Row k="Bank" v={trade.seller_bank_name || '—'} strong />
                <Row k="Account Name" v={trade.seller_bank_account_name || '—'} strong />
                <Row k="Account Number" v={
                  trade.seller_bank_account_number ? (
                    <button className="hover:text-accent" onClick={() => { navigator.clipboard.writeText(trade.seller_bank_account_number); toast.success('Copied') }}>
                      {trade.seller_bank_account_number} 📋
                    </button>
                  ) : '—'
                } strong />
                <Row k="Amount" v={formatNaira(trade.naira_amount)} strong />
                {isBuyer && trade.status === 'pending_payment' && (
                  <div className="mt-4 p-3 bg-gold/10 rounded-lg text-xs text-gold border border-gold/20">
                    ⚠️ Transfer EXACTLY {formatNaira(trade.naira_amount)} from an account in your own name. Don&apos;t mention crypto in the narration.
                  </div>
                )}
                {isSeller && trade.status === 'payment_sent' && (
                  <div className="mt-4 p-3 bg-gold/10 rounded-lg text-xs text-gold border border-gold/20">
                    ⚠️ Check your bank app and confirm the money has actually arrived before releasing. Releasing is irreversible.
                  </div>
                )}
              </Card>
            )}

            {/* Actions */}
            <Card className="p-5">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Actions</div>
              <div className="flex flex-col gap-3">
                {isBuyer && trade.status === 'pending_payment' && (
                  <>
                    <Button onClick={() => confirm('Only confirm after you have actually transferred the money. Continue?') && run(() => tradesAPI.markPaymentSent(ref), 'Payment marked as sent')} loading={actionLoading} className="w-full">
                      ✓ I Have Sent Payment
                    </Button>
                    <Button variant="ghost" onClick={() => confirm('Cancel this trade? The seller’s crypto will be returned.') && run(() => tradesAPI.cancel(ref), 'Trade cancelled')} disabled={actionLoading} className="w-full text-xs">
                      Cancel Trade
                    </Button>
                  </>
                )}
                {isSeller && trade.status === 'pending_payment' && (
                  <p className="text-sm text-muted">Waiting for the buyer to pay. If they don&apos;t pay within the window, the trade is cancelled automatically and your crypto is returned.</p>
                )}
                {isBuyer && trade.status === 'payment_sent' && (
                  <p className="text-sm text-muted">Waiting for the seller to confirm your payment and release the crypto.</p>
                )}
                {isSeller && trade.status === 'payment_sent' && (
                  <Button onClick={() => confirm(`Release ${formatCrypto(trade.crypto_amount, trade.crypto)} to ${trade.buyer_name}? This cannot be undone.`) && run(() => tradesAPI.confirmPayment(ref), 'Payment confirmed — crypto released')} loading={actionLoading} className="w-full">
                    ✓ Confirm Payment Received & Release
                  </Button>
                )}

                {trade.status === 'completed' && !trade.has_rated && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs text-muted">Rate {counterparty}:</div>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} onClick={() => setRating(s)} aria-label={`${s} stars`}
                          className={`text-2xl transition-transform hover:scale-110 ${s <= rating ? 'text-gold' : 'text-muted'}`}>★</button>
                      ))}
                    </div>
                    {rating > 0 && (
                      <>
                        <Textarea rows={2} maxLength={500} placeholder="Optional comment" value={ratingComment} onChange={(e: any) => setRatingComment(e.target.value)} />
                        <Button onClick={() => run(() => tradesAPI.rate(ref, { score: rating, comment: ratingComment || undefined }), 'Rating submitted!')} loading={actionLoading} className="text-xs">Submit Rating</Button>
                      </>
                    )}
                  </div>
                )}
                {trade.status === 'completed' && trade.has_rated && <div className="text-accent text-sm">⭐ Thanks for rating this trade.</div>}
                {trade.status === 'cancelled' && <div className="text-sm text-muted">This trade is closed.</div>}
                {trade.status === 'disputed' && <div className="text-sm text-muted">An admin will resolve this dispute. You&apos;ll see the outcome here.</div>}

                {trade.status === 'payment_sent' && !showDispute && (
                  <button onClick={() => setShowDispute(true)} className="text-xs text-muted hover:text-danger transition-colors text-left">⚠️ Something wrong? Open a dispute</button>
                )}
                {showDispute && trade.status === 'payment_sent' && (
                  <div className="flex flex-col gap-2">
                    <Textarea value={disputeReason} onChange={(e: any) => setDisputeReason(e.target.value)} rows={3} maxLength={1000}
                      placeholder="Describe the issue in detail (e.g. payment not received after 1 hour)…" />
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setShowDispute(false)} className="flex-1 text-xs">Cancel</Button>
                      <Button variant="danger" loading={actionLoading} className="flex-1 text-xs" onClick={() => {
                        if (disputeReason.trim().length < 10) { toast.error('Describe the issue (min 10 characters)'); return }
                        run(() => tradesAPI.openDispute(ref, disputeReason.trim()), 'Dispute opened. An admin will review.').then(() => setShowDispute(false))
                      }}>Submit Dispute</Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Chat */}
          <Card className="p-5 flex flex-col min-h-[480px] max-h-[720px]">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Trade Chat</div>
            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
              {messages.map((msg) => {
                const mine = msg.sender_id === user.id
                return (
                  <div key={msg.id} className={`flex flex-col gap-0.5 ${msg.is_system ? 'items-center' : mine ? 'items-end' : 'items-start'}`}>
                    {msg.is_system ? (
                      <div className="text-xs text-muted bg-surface px-3 py-1.5 rounded-xl border border-border text-center max-w-[95%]">{msg.message}</div>
                    ) : (
                      <>
                        <div className={`max-w-[80%] px-3.5 py-2.5 rounded-xl text-sm whitespace-pre-wrap break-words ${mine ? 'bg-accent text-black' : 'bg-surface text-text border border-border'}`}>
                          {msg.message}
                        </div>
                        <div className="text-[10px] text-muted">{mine ? 'You' : msg.sender_name} · {formatTime(msg.created_at)}</div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            {closed ? (
              <div className="text-xs text-muted text-center">Chat is closed for this trade.</div>
            ) : (
              <form onSubmit={sendMessage} className="flex gap-2 mt-auto">
                <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} maxLength={1000}
                  placeholder="Type a message…" className="flex-1 bg-surface border border-border rounded-lg px-3.5 py-2.5 text-sm text-text placeholder:text-muted focus:border-accent outline-none" />
                <Button type="submit" loading={sending} className="px-4 py-2.5 text-sm">Send</Button>
              </form>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function TradePage() {
  return <AuthGuard><TradeRoom /></AuthGuard>
}
