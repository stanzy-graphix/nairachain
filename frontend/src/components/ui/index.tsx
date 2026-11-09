'use client'
import { statusColor, statusLabel } from '@/lib/utils'
import clsx from 'clsx'
import React from 'react'

export const Button = ({ children, variant = 'primary', className = '', disabled, loading, ...props }: any) => (
  <button
    disabled={disabled || loading}
    className={clsx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-display font-semibold transition-all duration-150 px-5 py-2.5 text-sm',
      variant === 'primary' && 'bg-accent text-black hover:bg-[#00FFD0] disabled:opacity-50',
      variant === 'ghost' && 'bg-transparent border border-border text-muted hover:bg-accent-dim hover:text-accent hover:border-accent',
      variant === 'danger' && 'bg-danger text-white hover:opacity-90',
      variant === 'outline' && 'bg-transparent border border-accent text-accent hover:bg-accent-dim',
      className
    )}
    {...props}
  >
    {loading ? <span className="animate-spin">⟳</span> : null}
    {children}
  </button>
)

export const Input = ({ label, error, className = '', ...props }: any) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-semibold tracking-widest text-muted uppercase">{label}</label>}
    <input
      className={clsx(
        'w-full bg-surface border border-border rounded-lg px-3.5 py-3 text-sm text-text placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none transition',
        error && 'border-danger',
        className
      )}
      {...props}
    />
    {error && <span className="text-xs text-danger">{error}</span>}
  </div>
)

export const Select = ({ label, children, className = '', ...props }: any) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-semibold tracking-widest text-muted uppercase">{label}</label>}
    <select
      className={clsx('w-full bg-surface border border-border rounded-lg px-3.5 py-3 text-sm text-text focus:border-accent outline-none transition', className)}
      {...props}
    >
      {children}
    </select>
  </div>
)

export const Card = ({ children, className = '', ...props }: any) => (
  <div className={clsx('bg-card border border-border rounded-xl', className)} {...props}>
    {children}
  </div>
)

export const Badge = ({ status, className = '' }: { status: string; className?: string }) => (
  <span
    className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border', className)}
    style={{ color: statusColor[status] || '#64748B', background: (statusColor[status] || '#64748B') + '18', borderColor: (statusColor[status] || '#64748B') + '40' }}
  >
    {statusLabel[status] || status}
  </span>
)

export const Stars = ({ rating }: { rating: number }) => {
  const r = Math.max(0, Math.min(5, Number(rating) || 0))
  return (
  <span className="text-gold text-xs">
    {'★'.repeat(Math.round(r))}{'☆'.repeat(5 - Math.round(r))}
    <span className="text-muted ml-1">{r ? r.toFixed(1) : 'New'}</span>
  </span>
  )
}

export const Spinner = () => (
  <div className="flex items-center justify-center p-8">
    <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
  </div>
)

export const EmptyState = ({ icon, title, description, action }: any) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="text-5xl mb-4">{icon}</div>
    <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
    <p className="text-muted text-sm mb-6 max-w-xs">{description}</p>
    {action}
  </div>
)

export const Textarea = ({ label, className = '', ...props }: any) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-semibold tracking-widest text-muted uppercase">{label}</label>}
    <textarea
      className={clsx('w-full bg-surface border border-border rounded-lg px-3.5 py-3 text-sm text-text placeholder:text-muted focus:border-accent outline-none transition resize-none', className)}
      {...props}
    />
  </div>
)

export const Modal = ({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: React.ReactNode; className?: string }) => (
  <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <Card className={clsx('p-7 w-full max-w-md fade-in max-h-[90vh] overflow-y-auto', className)} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-display font-bold text-lg">{title}</h3>
        <button onClick={onClose} className="text-muted hover:text-text text-xl" aria-label="Close">✕</button>
      </div>
      {children}
    </Card>
  </div>
)

export const Row = ({ k, v, strong = false }: { k: React.ReactNode; v: React.ReactNode; strong?: boolean }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b border-border/50 text-sm last:border-0">
    <span className="text-muted">{k}</span>
    <span className={clsx('text-right break-all', strong ? 'font-semibold' : 'font-medium')}>{v}</span>
  </div>
)
