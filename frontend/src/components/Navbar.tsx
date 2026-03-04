'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { authAPI } from '@/lib/api'
import clsx from 'clsx'

const CRYPTO_TICKERS = [
  { sym: 'BTC', price: '₦98,500,000', chg: '+2.4%', up: true },
  { sym: 'ETH', price: '₦5,200,000', chg: '+1.1%', up: true },
  { sym: 'USDT', price: '₦1,520', chg: '+0.3%', up: true },
  { sym: 'BNB', price: '₦620,000', chg: '-0.8%', up: false },
  { sym: 'SOL', price: '₦148,000', chg: '+3.2%', up: true },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, clearAuth, refreshToken } = useAuthStore()

  const handleLogout = async () => {
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

  return (
    <div className="sticky top-0 z-50">
      {/* Price ticker */}
      <div className="bg-card border-b border-border py-2 overflow-hidden ticker-wrap">
        <div className="ticker" style={{ width: '200%' }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-14 px-4" style={{ width: '50%' }}>
              {CRYPTO_TICKERS.map(({ sym, price, chg, up }) => (
                <span key={sym} className="text-xs text-muted whitespace-nowrap">
                  <span className="text-text font-medium">{sym}</span> {price}{' '}
                  <span className={up ? 'text-accent' : 'text-danger'}>{chg}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main nav */}
      <nav className="bg-surface border-b border-border px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-display font-black text-xl tracking-tight">
            <span className="text-text">NAIRA</span><span className="text-accent">CHAIN</span>
          </Link>
          <div className="flex gap-1">
            {navLinks.map(({ href, label, icon }) => (
              <Link key={href} href={href}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  pathname === href ? 'bg-accent-dim text-accent' : 'text-muted hover:text-accent'
                )}>
                <span>{icon}</span> {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-blue flex items-center justify-center text-black font-bold text-sm">
                  {user.name[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold leading-none mb-0.5">{user.name.split(' ')[0]}</div>
                  <div className="text-xs text-accent leading-none">● KYC {user.kycStatus}</div>
                </div>
              </div>
              <button onClick={handleLogout} className="px-4 py-2 text-xs text-muted border border-border rounded-lg hover:text-accent hover:border-accent transition-colors">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="px-4 py-2 text-sm border border-border rounded-lg hover:border-accent hover:text-accent transition-colors">
                Login
              </Link>
              <Link href="/auth/register" className="px-4 py-2 text-sm bg-accent text-black font-bold rounded-lg hover:bg-[#00FFD0] transition-colors font-display">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>
  )
}
