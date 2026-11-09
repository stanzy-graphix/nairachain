'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { useAuthStore, getRefreshToken } from '@/lib/store'
import { authAPI } from '@/lib/api'
import { usePrices } from '@/lib/usePrices'
import { formatNaira, CRYPTOS } from '@/lib/utils'
import VerifyBanner from './VerifyBanner'

export default function Navbar() {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  const { prices } = usePrices()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    const refreshToken = getRefreshToken()
    try { if (refreshToken) await authAPI.logout(refreshToken) } catch {}
    clearAuth()
    router.push('/')
  }

  const navLinks = [
    { href: '/', label: 'Home', icon: '⬡' },
    { href: '/market', label: 'Market', icon: '◈' },
    ...(user ? [
      { href: '/wallet', label: 'Wallet', icon: '◎' },
      { href: '/trades', label: 'Trades', icon: '⟳' },
      ...(user.isAdmin ? [{ href: '/admin', label: 'Admin', icon: '⚙' }] : []),
    ] : []),
  ]
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  const ticker = CRYPTOS.map((sym) => ({ sym, ...prices[sym] }))

  return (
    <div className="sticky top-0 z-40">
      {/* Price ticker */}
      <div className="bg-card border-b border-border py-2 overflow-hidden ticker-wrap">
        {/* Two identical copies side by side; the animation shifts by exactly one copy (-50%) */}
        <div className="ticker w-max">
          {[0, 1].map((i) => (
            <div key={i} className="flex shrink-0 gap-14 pr-14" aria-hidden={i === 1}>
              {[...ticker, ...ticker, ...ticker].map(({ sym, price, change24h }, j) => (
                <span key={`${sym}-${j}`} className="text-xs text-muted whitespace-nowrap">
                  <span className="text-text font-medium">{sym}/NGN</span> {formatNaira(price)}{' '}
                  <span className={change24h >= 0 ? 'text-accent' : 'text-danger'}>
                    {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main nav */}
      <nav className="bg-surface border-b border-border px-4 md:px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display font-black text-xl tracking-tight">
            <span className="text-text">NAIRA</span><span className="text-accent">CHAIN</span>
          </Link>
          <div className="hidden md:flex gap-1">
            {navLinks.map(({ href, label, icon }) => (
              <Link key={href} href={href}
                className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive(href) ? 'bg-accent-dim text-accent' : 'text-muted hover:text-accent')}>
                <span>{icon}</span> {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link href="/profile" className="flex items-center gap-2 group">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-blue flex items-center justify-center text-black font-bold text-sm">
                  {user.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold leading-none mb-0.5 group-hover:text-accent">{user.name.split(' ')[0]}</div>
                  <div className={clsx('text-xs leading-none', user.kycStatus === 'verified' ? 'text-accent' : 'text-gold')}>● KYC {user.kycStatus}</div>
                </div>
              </Link>
              <button onClick={handleLogout} className="px-4 py-2 text-xs text-muted border border-border rounded-lg hover:text-accent hover:border-accent transition-colors">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="px-4 py-2 text-sm border border-border rounded-lg hover:border-accent hover:text-accent transition-colors">Login</Link>
              <Link href="/auth/register" className="px-4 py-2 text-sm bg-accent text-black font-bold rounded-lg hover:bg-[#00FFD0] transition-colors font-display">Sign Up</Link>
            </>
          )}
        </div>

        <button className="md:hidden text-2xl text-muted" onClick={() => setOpen(!open)} aria-label="Menu">{open ? '✕' : '☰'}</button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-surface border-b border-border px-4 py-3 flex flex-col gap-1">
          {navLinks.map(({ href, label, icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={clsx('px-3 py-2.5 rounded-md text-sm', isActive(href) ? 'bg-accent-dim text-accent' : 'text-muted')}>
              {icon} {label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/profile" onClick={() => setOpen(false)} className="px-3 py-2.5 text-sm text-muted">👤 Profile</Link>
              <button onClick={handleLogout} className="text-left px-3 py-2.5 text-sm text-danger">Logout</button>
            </>
          ) : (
            <div className="flex gap-2 pt-2">
              <Link href="/auth/login" className="flex-1 text-center px-4 py-2 text-sm border border-border rounded-lg">Login</Link>
              <Link href="/auth/register" className="flex-1 text-center px-4 py-2 text-sm bg-accent text-black font-bold rounded-lg">Sign Up</Link>
            </div>
          )}
        </div>
      )}
      <VerifyBanner />
    </div>
  )
}
