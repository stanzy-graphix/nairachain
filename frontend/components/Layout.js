import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'
import { formatNaira } from '../lib/utils'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const MOCK_PRICES = [
  ['BTC',  98500000, +2.4],
  ['ETH',   5200000, +1.1],
  ['USDT',     1520, +0.3],
  ['BNB',   620000, -0.8],
  ['SOL',   148000, +3.2],
  ['DOGE',    1240, +5.1],
]

export default function Layout({ children }) {
  const { user, isLoggedIn, isAdmin, logout } = useAuth()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { href: '/',        label: 'Home',    icon: '⬡' },
    { href: '/market',  label: 'Market',  icon: '◈' },
    ...(isLoggedIn ? [
      { href: '/wallet',  label: 'Wallet',  icon: '◎' },
      { href: '/trades',  label: 'Trades',  icon: '⟳' },
    ] : []),
    ...(isAdmin ? [
      { href: '/admin',   label: 'Admin',   icon: '⚙' },
    ] : []),
  ]

  const isActive = (href) =>
    href === '/' ? router.pathname === '/' : router.pathname.startsWith(href)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Price Ticker */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '7px 0', overflow: 'hidden' }}>
        <div className="ticker" style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap', width: '200%' }}>
          {[...Array(2)].map((_, i) => (
            <span key={i} style={{ display: 'flex', gap: 48 }}>
              {MOCK_PRICES.map(([sym, price, chg]) => (
                <span key={sym + i} style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{sym}</span>
                  {' '}{formatNaira(price)}
                  {' '}<span style={{ color: chg >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                    {chg >= 0 ? '+' : ''}{chg}%
                  </span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Logo + Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Link href="/" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px', textDecoration: 'none' }}>
            <span style={{ color: 'var(--text)' }}>NAIRA</span>
            <span style={{ color: 'var(--accent)' }}>CHAIN</span>
          </Link>
          <nav className="hide-mobile" style={{ display: 'flex', gap: 4 }}>
            {navLinks.map(l => (
              <Link key={l.href} href={l.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 6, fontSize: 13,
                  background: isActive(l.href) ? 'rgba(0,212,170,0.1)' : 'transparent',
                  color: isActive(l.href) ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: 500, textDecoration: 'none', transition: 'all 0.2s',
                }}>
                <span>{l.icon}</span> {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Auth buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isLoggedIn ? (
            <>
              <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent), var(--blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, color: '#000', fontSize: 14,
                }}>
                  {user?.name?.[0] || 'U'}
                </div>
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{user?.name?.split(' ')[0]}</div>
                  <div style={{ color: 'var(--accent)', fontSize: 11 }}>
                    {user?.kyc_status === 'verified' ? '● KYC Verified' : '○ KYC Pending'}
                  </div>
                </div>
              </div>
              <button onClick={logout} className="btn-ghost" style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12 }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" style={{
                background: 'transparent', color: 'var(--text)',
                border: '1px solid var(--border)', padding: '8px 18px',
                borderRadius: 6, fontSize: 13, textDecoration: 'none',
              }}>Login</Link>
              <Link href="/auth/signup" className="btn-primary" style={{
                padding: '8px 18px', borderRadius: 6, fontSize: 13,
                display: 'inline-block', textDecoration: 'none',
                fontFamily: "'Syne', sans-serif",
              }}>Sign Up</Link>
            </>
          )}
        </div>
      </header>

      {/* Page Content */}
      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: 'var(--muted)',
      }}>
        <div>
          <span style={{ fontFamily: "'Syne', sans-serif", color: 'var(--accent)', fontWeight: 700 }}>NAIRACHAIN</span>
          {' '}· Nigeria's Trusted P2P Exchange · All trades are escrow-protected
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <span>Terms</span><span>Privacy</span><span>Support</span>
          <span>© 2025</span>
        </div>
      </footer>

      <ToastContainer
        position="top-right" autoClose={3000} hideProgressBar={false}
        theme="dark" toastStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontFamily: 'inherit' }}
      />
    </div>
  )
}
