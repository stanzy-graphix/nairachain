import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { EscrowSteps, Countdown, StatusBadge, Stars, Modal } from '../../../components/UI'
import { formatNaira, formatCrypto } from '../../../lib/utils'
import { useAuth } from '../../../context/AuthContext'
import { toast } from 'react-toastify'

// Mock offer (in production, fetch from API using router.query.id)
const MOCK_OFFER = {
  id: 1, type: 'sell', crypto: 'USDT', price: 1520,
  min: 5000, max: 500000, payment: 'Bank Transfer',
  user: { name: 'ChukwuTrader', rating: 4.9, trades: 312 },
  bankName: 'GTBank', accountName: 'Chukwuemeka Eze', accountNumber: '0123456789',
}

const TRADE_STEPS = {
  INPUT:    0,  // Enter amount
  ESCROW:   1,  // Crypto locked
  PAYMENT:  2,  // Buyer sends Naira
  CONFIRM:  3,  // Seller confirming
  DONE:     4,  // Complete
}

function ChatBox({ tradeId }) {
  const [messages, setMessages] = useState([
    { from: 'system', text: 'Trade started. Please be respectful and transact safely.', time: new Date() },
    { from: 'seller', text: 'Hello! Please send the exact amount shown.', time: new Date() },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  const send = () => {
    if (!input.trim()) return
    setMessages(m => [...m, { from: 'me', text: input.trim(), time: new Date() }])
    setInput('')
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
        💬 Trade Chat
      </div>
      <div style={{ height: 220, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
            {m.from === 'system' ? (
              <div style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'center', width: '100%', background: 'var(--surface)', borderRadius: 6, padding: '6px 12px' }}>
                🔒 {m.text}
              </div>
            ) : (
              <div style={{
                maxWidth: '75%', padding: '8px 12px', borderRadius: 10, fontSize: 13,
                background: m.from === 'me' ? 'var(--accent)' : 'var(--surface)',
                color: m.from === 'me' ? '#000' : 'var(--text)',
              }}>
                {m.text}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          placeholder="Type a message..." className="input-field" style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={send} className="btn-primary" style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13 }}>Send</button>
      </div>
    </div>
  )
}

export default function TradePage() {
  const router = useRouter()
  const { user, isLoggedIn } = useAuth()
  const [step, setStep] = useState(TRADE_STEPS.INPUT)
  const [amount, setAmount] = useState('')
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)
  const [rating, setRating] = useState(0)

  const offer = MOCK_OFFER
  const nairaAmount = Number(amount)
  const cryptoAmount = nairaAmount / offer.price
  const fee = nairaAmount * 0.005
  const cryptoAfterFee = (nairaAmount - fee) / offer.price

  const acceptOffer = () => {
    if (!nairaAmount) return toast.error('Enter an amount')
    if (nairaAmount < offer.min) return toast.error(`Minimum is ${formatNaira(offer.min)}`)
    if (nairaAmount > offer.max) return toast.error(`Maximum is ${formatNaira(offer.max)}`)
    setStep(TRADE_STEPS.ESCROW)
    toast.success('Crypto locked in escrow!')
  }

  const markPaid = () => {
    setStep(TRADE_STEPS.CONFIRM)
    toast.success('Payment marked as sent. Awaiting seller confirmation.')
  }

  // Simulate seller confirming (in real app this is via socket.io)
  const simulateSellerConfirm = () => {
    setStep(TRADE_STEPS.DONE)
    toast.success('🎉 Trade complete! Crypto released to your wallet.')
  }

  const openDispute = () => {
    if (!disputeReason.trim()) return toast.error('Describe the issue')
    setShowDispute(false)
    toast.success('Dispute opened. Admin will review within 2 hours.')
  }

  if (!isLoggedIn) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Login Required</div>
      <Link href="/auth/login" className="btn-primary" style={{ padding: '12px 28px', borderRadius: 8, textDecoration: 'none', display: 'inline-block' }}>Login →</Link>
    </div>
  )

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Back */}
      <Link href="/market" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none', display: 'block', marginBottom: 20 }}>
        ← Back to Market
      </Link>

      {/* Escrow Steps */}
      <EscrowSteps currentStep={step} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Main Trade Card */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>

          {/* Offer Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 20, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 22 }}>
                {offer.type === 'sell' ? 'Buy' : 'Sell'} {offer.crypto}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 8px' }}>
                from {offer.user.name}
              </div>
              <Stars rating={offer.user.rating} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
                {formatNaira(offer.price)}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>per {offer.crypto}</div>
            </div>
          </div>

          {/* STEP 0: Enter Amount */}
          {step === TRADE_STEPS.INPUT && (
            <div>
              <label className="label">Amount in Naira</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={`Min: ${formatNaira(offer.min)}`}
                className="input-field" style={{ fontSize: 22, fontFamily: "'Syne', sans-serif", fontWeight: 700, marginBottom: 16 }} />

              {nairaAmount > 0 && (
                <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, marginBottom: 16, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: 'var(--muted)' }}>You'll receive</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{cryptoAmount.toFixed(6)} {offer.crypto}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: 'var(--muted)' }}>Platform fee (0.5%)</span>
                    <span style={{ color: 'var(--danger)' }}>-{formatNaira(fee)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--muted)' }}>Net receive</span>
                    <span style={{ fontWeight: 700 }}>{cryptoAfterFee.toFixed(6)} {offer.crypto}</span>
                  </div>
                </div>
              )}

              <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 20 }}>
                Limits: {formatNaira(offer.min)} – {formatNaira(offer.max)} · 🏦 {offer.payment}
              </div>

              <button onClick={acceptOffer} className="btn-primary glow"
                style={{ width: '100%', padding: 15, borderRadius: 8, fontSize: 16, fontFamily: "'Syne', sans-serif" }}>
                Accept Offer & Lock Escrow →
              </button>
            </div>
          )}

          {/* STEP 1: Crypto Locked */}
          {step === TRADE_STEPS.ESCROW && (
            <div>
              <div style={{ background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ color: 'var(--gold)', fontWeight: 600, marginBottom: 6 }}>🔒 Crypto Locked in Escrow</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {cryptoAmount.toFixed(6)} {offer.crypto} has been locked by {offer.user.name}. Now send Naira via bank transfer.
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, fontWeight: 600, letterSpacing: 1 }}>SELLER'S BANK DETAILS</div>
                {[
                  ['Bank',         offer.bankName],
                  ['Account Name', offer.accountName],
                  ['Account No.',  offer.accountNumber],
                  ['Amount',       formatNaira(nairaAmount)],
                  ['Reference',    `NC-${router.query.id || '001'}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                    <span style={{ color: 'var(--muted)' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              <Countdown seconds={1800} onExpire={() => toast.error('Trade expired!')} />

              <div style={{ marginTop: 20 }}>
                <button onClick={markPaid} className="btn-primary"
                  style={{ width: '100%', padding: 15, borderRadius: 8, fontSize: 15, fontFamily: "'Syne', sans-serif", background: 'var(--blue)', color: '#fff' }}>
                  ✓ I Have Sent {formatNaira(nairaAmount)}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Waiting for Confirmation */}
          {step === TRADE_STEPS.CONFIRM && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>⏳</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
                Waiting for Confirmation
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
                Payment marked as sent. {offer.user.name} will confirm receipt of {formatNaira(nairaAmount)}.
              </div>
              <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 16, marginBottom: 24, fontSize: 13, color: 'var(--muted)' }}>
                If seller doesn't confirm within <span style={{ color: 'var(--gold)' }}>30 minutes</span>, you can open a dispute.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {/* Demo button — in production seller confirms via their own UI */}
                <button onClick={simulateSellerConfirm}
                  style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  [Demo] Seller Confirms →
                </button>
                <button onClick={() => setShowDispute(true)}
                  style={{ background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(255,77,109,0.3)', padding: '10px 24px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                  Open Dispute
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Complete */}
          {step === TRADE_STEPS.DONE && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: 'var(--accent)', marginBottom: 10 }}>
                Trade Complete!
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
                {cryptoAfterFee.toFixed(6)} {offer.crypto} has been released to your wallet.
              </div>

              {/* Rating */}
              <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Rate {offer.user.name}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => { setRating(n); toast.success('Rating submitted!') }}
                      style={{ background: 'none', border: 'none', fontSize: 30, cursor: 'pointer', color: n <= rating ? 'var(--gold)' : 'var(--border)', transition: 'color 0.15s' }}>
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <Link href="/market" className="btn-primary"
                style={{ padding: '12px 32px', borderRadius: 8, display: 'inline-block', textDecoration: 'none', fontFamily: "'Syne', sans-serif", fontSize: 14 }}>
                Back to Market
              </Link>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Trade Summary */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, fontWeight: 600, letterSpacing: 1 }}>TRADE SUMMARY</div>
            {[
              ['Trade ID',   `NC-${router.query.id || '001'}`],
              ['Type',       offer.type === 'sell' ? 'Buy' : 'Sell'],
              ['Crypto',     offer.crypto],
              ['Rate',       formatNaira(offer.price)],
              ...(nairaAmount ? [
                ['Naira',    formatNaira(nairaAmount)],
                ['Crypto',   `${cryptoAmount.toFixed(6)} ${offer.crypto}`],
              ] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Chat */}
          {step > TRADE_STEPS.INPUT && <ChatBox tradeId={router.query.id} />}

          {/* Safety Tips */}
          <div style={{ background: 'var(--card)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600, marginBottom: 12 }}>⚠ SAFETY TIPS</div>
            <ul style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.8, paddingLeft: 16 }}>
              <li>Never send to a different account</li>
              <li>Only click "I have paid" after transfer</li>
              <li>Don't share your OTP or password</li>
              <li>NairaChain will never DM you first</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Dispute Modal */}
      <Modal open={showDispute} onClose={() => setShowDispute(false)} title="Open Dispute">
        <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16, lineHeight: 1.7 }}>
          Describe the issue. An admin will review and resolve within 2 hours. Your crypto remains safe in escrow.
        </div>
        <label className="label">Reason for Dispute</label>
        <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
          placeholder="e.g. I sent the money but seller is not confirming..."
          rows={4} className="input-field" style={{ resize: 'vertical', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowDispute(false)} className="btn-ghost" style={{ flex: 1, padding: 12, borderRadius: 8, fontSize: 14 }}>Cancel</button>
          <button onClick={openDispute} className="btn-danger" style={{ flex: 1, padding: 12, borderRadius: 8, fontSize: 14 }}>Submit Dispute</button>
        </div>
      </Modal>
    </div>
  )
}
