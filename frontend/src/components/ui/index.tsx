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

export const Stars = ({ rating }: { rating: number }) => (
  <span className="text-gold text-xs">
    {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
    <span className="text-muted ml-1">{Number(rating).toFixed(1)}</span>
  </span>
)

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
