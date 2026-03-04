'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { Button, Card, Badge, Spinner } from '@/components/ui'
import { tradesAPI } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { formatNaira, formatCrypto } from '@/lib/utils'
import toast from 'react-hot-toast'
import { io, Socket } from 'socket.io-client'

const STEPS = ['pending_payment', 'payment_sent', 'confirming', 'completed']

export default function TradePage() {
  const { ref } = useParams<{ ref: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [trade, setTrade] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msgInput, setMsgInput] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingDone, setRatingDone] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const msgEndRef = useRef<HTMLDivElement>(null)

  const isBuyer = user?.id === trade?.buyer_id
  const isSeller = user?.id === trade?.seller_id

  const loadTrade = async () => {
    try {
      const { data } = await tradesAPI.get(ref)
      setTrade(data.trade); setMessages(data.messages)
    } catch { toast.error('Trade not found'); router.push('/trades') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadTrade()
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000')
    socketRef.current = socket
    socket.on('connect', () => socket.emit('join_trade', trade?.id))
    socket.on('new_message', (msg: any) => setMessages(prev => [...prev, msg]))
    socket.on('trade_status', (data: any) => setTrade((prev: any) => ({ ...prev, status: data.status })))
    return () => { socket.disconnect() }
  }, [ref])

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    if (!msgInput.trim()) return
    try {
      await tradesAPI.sendMessage(ref, msgInput)
      setMsgInput('')
    } catch { toast.error('Failed to send') }
  }

  const markPaymentSent = async () => {
    setActionLoading(true)
    try { await tradesAPI.markPaymentSent(ref); loadTrade(); toast.success('Payment marked as sent') }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
    finally { setActionLoading(false) }
  }

  const confirmPayment = async () => {
    setActionLoading(true)
    try { await tradesAPI.confirmPayment(ref); loadTrade(); toast.success('Payment confirmed! Crypto released.') }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
    finally { setActionLoading(false) }
  }

  const submitDispute = async () => {
    if (disputeReason.length < 10) { toast.error('Describe the issue (min 10 chars)'); return }
    setActionLoading(true)
    try { await tradesAPI.openDispute(ref, disputeReason); loadTrade(); setShowDispute(false); toast.success('Dispute opened. Admin will review.') }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
    finally { setActionLoading(false) }
  }

  const submitRating = async (score: number) => {
    try { await tradesAPI.rate(ref, { score }); setRatingDone(true); toast.success('Rating submitted!') }
    catch { toast.error('Failed to submit rating') }
  }

  if (loading || !user) return <div className="min-h-screen bg-bg"><Navbar /><Spinner /></div>
  if (!trade) return null

  const stepIndex = STEPS.indexOf(trade.status)

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-8 fade-in">
        <button onClick={() => router.push('/trades')} className="text-muted text-sm hover:text-accent mb-5 flex items-center gap-1">← My Trades</button>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-display font-black text-2xl">{trade.trade_ref}</h1>
            <p className="text-muted text-sm">{isBuyer ? 'Buying' : 'Selling'} {formatCrypto(trade.crypto_amount, trade.crypto)} · {formatNaira(trade.naira_amount)}</p>
          </div>
          <Badge status={trade.status} />
        </div>

        {/* Progress steps */}
        <Card className="p-5 mb-5">
          <div className="flex items-center">
            {['Pending Payment', 'Payment Sent', 'Confirming', 'Completed'].map((label, i) => (
              <div key={label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= stepIndex ? 'bg-accent text-black' : 'bg-border text-muted'}`}>
                    {i < stepIndex ? '✓' : i + 1}
                  </div>
                  <div className={`text-xs mt-1 text-center ${i <= stepIndex ? 'text-accent' : 'text-muted'}`}>{label}</div>
                </div>
                {i < 3 && <div className={`h-0.5 flex-shrink-0 w-4 mb-5 ${i < stepIndex ? 'bg-accent' : 'bg-border'}`} />}
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Trade details */}
          <div className="flex flex-col gap-5">
            <Card className="p-5">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Trade Details</div>
              {[
                ['Amount', formatCrypto(trade.crypto_amount, trade.crypto)],
                ['Naira Value', formatNaira(trade.naira_amount)],
                ['Rate', `${formatNaira(trade.price_per_unit)} / ${trade.crypto}`],
                ['Fee', formatNaira(trade.fee_amount)],
                ['Buyer', trade.buyer_name],
                ['Seller', trade.seller_name],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-border/50 text-sm last:border-0">
                  <span className="text-muted">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </Card>

            {/* Bank details - show to buyer when pending */}
            {isBuyer && trade.status === 'pending_payment' && (
              <Card className="p-5 border-accent/30">
                <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-4">💳 Send Naira To</div>
                {[
                  ['Bank', trade.bank_name || 'GTBank'],
                  ['Account Name', trade.bank_account_name || trade.seller_name],
                  ['Account Number', trade.bank_account_number || 'Contact seller'],
                  ['Amount', formatNaira(trade.naira_amount)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 border-b border-border/50 text-sm last:border-0">
                    <span className="text-muted">{k}</span>
                    <span className="font-semibold">{v}</span>
                  </div>
                ))}
                <div className="mt-4 p-3 bg-gold/10 rounded-lg text-xs text-gold border border-gold/20">
                  ⚠️ Transfer EXACTLY {formatNaira(trade.naira_amount)}. Do not include fees or notes.
                </div>
              </Card>
            )}

            {/* Actions */}
            <Card className="p-5">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Actions</div>
              <div className="flex flex-col gap-3">
                {isBuyer && trade.status === 'pending_payment' && (
                  <Button onClick={markPaymentSent} loading={actionLoading} className="w-full">
                    ✓ I Have Sent Payment
                  </Button>
                )}
                {isSeller && trade.status === 'payment_sent' && (
                  <Button onClick={confirmPayment} loading={actionLoading} className="w-full">
                    ✓ Confirm Payment Received
                  </Button>
                )}
                {trade.status === 'completed' && !ratingDone && (
                  <div>
                    <div className="text-xs text-muted mb-2">Rate this trader:</div>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => { setRating(s); submitRating(s); }}
                          className={`text-2xl transition-transform hover:scale-110 ${s <= rating ? 'text-gold' : 'text-muted'}`}>★</button>
                      ))}
                    </div>
                  </div>
                )}
                {ratingDone && <div className="text-accent text-sm">⭐ Rating submitted. Thank you!</div>}
                {['pending_payment','payment_sent'].includes(trade.status) && !showDispute && (
                  <button onClick={() => setShowDispute(true)} className="text-xs text-muted hover:text-danger transition-colors">
                    ⚠️ Open Dispute
                  </button>
                )}
                {showDispute && (
                  <div className="flex flex-col gap-2">
                    <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                      placeholder="Describe the issue in detail..." rows={3}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-danger outline-none resize-none" />
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setShowDispute(false)} className="flex-1 text-xs">Cancel</Button>
                      <Button variant="danger" onClick={submitDispute} loading={actionLoading} className="flex-1 text-xs">Submit Dispute</Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Chat */}
          <Card className="p-5 flex flex-col h-full min-h-[400px]">
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Trade Chat</div>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[280px]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-0.5 ${msg.is_system ? 'items-center' : msg.sender_id === user.id ? 'items-end' : 'items-start'}`}>
                  {msg.is_system ? (
                    <div className="text-xs text-muted bg-surface px-3 py-1.5 rounded-full border border-border">{msg.message}</div>
                  ) : (
                    <>
                      <div className={`max-w-[80%] px-3.5 py-2.5 rounded-xl text-sm ${msg.sender_id === user.id ? 'bg-accent text-black' : 'bg-surface text-text border border-border'}`}>
                        {msg.message}
                      </div>
                      <div className="text-[10px] text-muted">{msg.sender_name}</div>
                    </>
                  )}
                </div>
              ))}
              <div ref={msgEndRef} />
            </div>
            {!['completed','cancelled','disputed'].includes(trade.status) && (
              <div className="flex gap-2 mt-auto">
                <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..." className="flex-1 bg-surface border border-border rounded-lg px-3.5 py-2.5 text-sm text-text placeholder:text-muted focus:border-accent outline-none" />
                <Button onClick={sendMessage} className="px-4 py-2.5 text-sm">Send</Button>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}
