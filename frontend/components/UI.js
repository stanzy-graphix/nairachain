import { useState, useEffect } from 'react'
import { statusLabel, countdownTimer } from '../lib/utils'

// ─── Status Badge ─────────────────────────────────────
export function StatusBadge({ status }) {
  return (
    <span className={`status-${status}`}
      style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {statusLabel(status)}
    </span>
  )
}

// ─── Star Rating ──────────────────────────────────────
export function Stars({ rating, size = 13 }) {
  const full  = Math.floor(rating)
  const empty = 5 - full
  return (
    <span style={{ fontSize: size }}>
      <span style={{ color: 'var(--gold)' }}>{'★'.repeat(full)}</span>
      <span style={{ color: 'var(--border)' }}>{'★'.repeat(empty)}</span>
      <span style={{ color: 'var(--muted)', marginLeft: 4 }}>{rating.toFixed(1)}</span>
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────
export function StatCard({ value, label, color = 'var(--accent)', icon }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '22px 20px',
    }}>
      {icon && <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>}
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth = 500 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box fade-in" style={{ maxWidth }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Countdown Timer ──────────────────────────────────
export function Countdown({ seconds: initialSeconds, onExpire }) {
  const [seconds, setSeconds] = useState(initialSeconds)

  useEffect(() => {
    if (seconds <= 0) { onExpire?.(); return }
    const t = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  const pct = (seconds / initialSeconds) * 100
  const color = pct > 50 ? 'var(--accent)' : pct > 20 ? 'var(--gold)' : 'var(--danger)'

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 32, fontFamily: "'Syne', sans-serif", fontWeight: 800, color }}>
        {countdownTimer(seconds)}
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 8 }}>
        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 2, transition: 'width 1s linear' }} />
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>Time remaining to complete trade</div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────
export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {message && <div style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>{message}</div>}
      {action}
    </div>
  )
}

// ─── Loading Spinner ──────────────────────────────────
export function Spinner({ size = 24, color = 'var(--accent)' }) {
  return (
    <div style={{
      width: size, height: size, border: `2px solid var(--border)`,
      borderTopColor: color, borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

// ─── Escrow Flow Steps ────────────────────────────────
export function EscrowSteps({ currentStep }) {
  const steps = ['Accept Offer', 'Crypto Locked', 'Send Naira', 'Seller Confirms', 'Complete']
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, fontWeight: 600, letterSpacing: 1 }}>ESCROW PROGRESS</div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((step, i) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: i < currentStep ? 'var(--accent)' : i === currentStep ? 'rgba(0,212,170,0.2)' : 'var(--border)',
                border: i === currentStep ? '2px solid var(--accent)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: i < currentStep ? '#000' : i === currentStep ? 'var(--accent)' : 'var(--muted)',
                fontWeight: 700,
              }}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <div style={{
                fontSize: 9, marginTop: 5, textAlign: 'center', lineHeight: 1.3,
                color: i === currentStep ? 'var(--accent)' : i < currentStep ? 'var(--text)' : 'var(--muted)',
                fontWeight: i === currentStep ? 600 : 400,
              }}>
                {step}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                height: 2, width: 20, flexShrink: 0, marginBottom: 18,
                background: i < currentStep ? 'var(--accent)' : 'var(--border)',
                transition: 'background 0.4s',
              }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Copy to clipboard ────────────────────────────────
export function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="btn-ghost"
      style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12 }}>
      {copied ? '✓ Copied' : label}
    </button>
  )
}

// Add spin keyframe to a style tag once
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }'
  document.head.appendChild(style)
}
