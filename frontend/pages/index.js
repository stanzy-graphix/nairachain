import Link from 'next/link'
import { StatCard } from '../components/UI'
import { formatNaira } from '../lib/utils'

const RATES = [
  { name: 'Bitcoin',  sym: 'BTC',  price: 98500000, chg: +2.4, icon: '🟠' },
  { name: 'Ethereum', sym: 'ETH',  price: 5200000,  chg: +1.1, icon: '🔵' },
  { name: 'Tether',   sym: 'USDT', price: 1520,     chg: +0.3, icon: '🟢' },
]

export default function Home() {
  return (
    <div className="fade-in">

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '64px 0 52px', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -60%)',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          display: 'inline-block',
          fontSize: 12, color: 'var(--accent)', letterSpacing: 4,
          fontWeight: 600, marginBottom: 18, textTransform: 'uppercase',
          background: 'rgba(0,212,170,0.08)', padding: '6px 18px', borderRadius: 20,
          border: '1px solid rgba(0,212,170,0.2)',
        }}>
          🇳🇬 Nigeria's #1 P2P Crypto Exchange
        </div>
        <h1 style={{
          fontFamily: "'Syne', sans-serif", fontSize: 56, fontWeight: 800,
          lineHeight: 1.08, marginBottom: 22, letterSpacing: '-2px',
        }}>
          Trade Crypto for<br />
          <span style={{ color: 'var(--accent)' }}>Naira. Instantly.</span>
        </h1>
        <p style={{
          color: 'var(--muted)', fontSize: 17, maxWidth: 500,
          margin: '0 auto 38px', lineHeight: 1.75,
        }}>
          Buy & sell Bitcoin, USDT, and Ethereum directly with other Nigerians.
          Escrow-protected. Zero bank wahala.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          <Link href="/market" className="btn-primary glow"
            style={{
              padding: '15px 36px', borderRadius: 8, fontSize: 16,
              fontFamily: "'Syne', sans-serif", display: 'inline-block', textDecoration: 'none',
            }}>
            Start Trading →
          </Link>
          <Link href="/auth/signup"
            style={{
              padding: '15px 36px', borderRadius: 8, fontSize: 15,
              border: '1px solid var(--border)', color: 'var(--text)',
              display: 'inline-block', textDecoration: 'none', transition: 'all 0.2s',
            }}>
            Create Account
          </Link>
        </div>
      </section>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
        <StatCard value="₦2.4B+"   label="Volume (24h)"      color="var(--accent)" />
        <StatCard value="18,400+"  label="Active Traders"    color="var(--blue)"   />
        <StatCard value="99.2%"    label="Escrow Success"    color="var(--gold)"   />
        <StatCard value="< 15min"  label="Avg Trade Time"    color="var(--accent)" />
      </div>

      {/* Live Rates */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 28, marginBottom: 32,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700 }}>Live Market Rates</div>
          <Link href="/market" style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none' }}>View all offers →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {RATES.map(r => (
            <div key={r.sym} style={{
              background: 'var(--surface)', borderRadius: 10,
              padding: 20, border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 26 }}>{r.icon}</span>
                <span style={{
                  color: r.chg >= 0 ? 'var(--accent)' : 'var(--danger)',
                  background: r.chg >= 0 ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,109,0.1)',
                  padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                }}>
                  {r.chg >= 0 ? '+' : ''}{r.chg}%
                </span>
              </div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20 }}>
                {formatNaira(r.price)}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
                {r.name} ({r.sym})
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, textAlign: 'center', marginBottom: 32 }}>
          How NairaChain Works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            ['01', '🔍', 'Browse Offers', 'Find the best buy or sell offer from verified traders.'],
            ['02', '🔒', 'Escrow Locks Crypto', 'Crypto is instantly locked in escrow when you accept.'],
            ['03', '💸', 'Send Naira', 'Transfer Naira via bank. No middleman, direct P2P.'],
            ['04', '✅', 'Receive Crypto', 'Seller confirms and crypto is released to your wallet.'],
          ].map(([num, icon, title, desc]) => (
            <div key={num} style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 24, position: 'relative',
            }}>
              <div style={{ color: 'var(--border)', fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 40, position: 'absolute', top: 16, right: 18 }}>
                {num}
              </div>
              <div style={{ fontSize: 30, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, marginBottom: 8 }}>{title}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 48 }}>
        {[
          ['🔒', 'Escrow Protected', 'Crypto is locked until Naira payment is confirmed. Zero scam risk.'],
          ['⚡', 'Lightning Fast', 'Most trades complete in under 15 minutes. Fastest P2P in Nigeria.'],
          ['🇳🇬', 'Built for Nigeria', 'Pay bills, buy airtime, fund bet wallet — all from your crypto.'],
          ['👤', 'KYC Verified', 'All traders are verified. Trade with confidence every time.'],
          ['💬', 'Live Trade Chat', 'Communicate with your trade partner in real-time, securely.'],
          ['⚖️', 'Dispute Resolution', 'Admin-mediated disputes ensure you never lose your funds.'],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24,
          }}>
            <div style={{ fontSize: 30, marginBottom: 12 }}>{icon}</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, marginBottom: 8 }}>{title}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* CTA Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,212,170,0.1) 0%, rgba(61,142,255,0.1) 100%)',
        border: '1px solid rgba(0,212,170,0.2)', borderRadius: 16, padding: '40px 36px',
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, marginBottom: 12 }}>
          Ready to Trade?
        </div>
        <div style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 15 }}>
          Join 18,000+ Nigerians already trading on NairaChain.
        </div>
        <Link href="/auth/signup" className="btn-primary glow"
          style={{ padding: '14px 40px', borderRadius: 8, fontSize: 15, fontFamily: "'Syne', sans-serif", display: 'inline-block', textDecoration: 'none' }}>
          Create Free Account →
        </Link>
      </div>

    </div>
  )
}
