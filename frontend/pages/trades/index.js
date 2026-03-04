import { useState } from 'react'
import Link from 'next/link'
import { StatusBadge, EmptyState } from '../../components/UI'
import { formatNaira, formatCrypto, timeAgo } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'

const MOCK_TRADES = [
  { id: 'NC-001', crypto: 'USDT', amount: 200,   naira: 304000,    status: 'completed', counterparty: 'AbiodunFX',   date: new Date(Date.now()-86400000*1), type: 'buy' },
  { id: 'NC-002', crypto: 'BTC',  amount: 0.005, naira: 492500,    status: 'escrow',    counterparty: 'NgoziBuyer',  date: new Date(Date.now()-86400000*0.2), type: 'sell' },
  { id: 'NC-003', crypto: 'ETH',  amount: 0.1,   naira: 520000,    status: 'pending',   counterparty: 'EmekaCrypto', date: new Date(Date.now()-86400000*0.1), type: 'buy' },
  { id: 'NC-004', crypto: 'USDT', amount: 500,   naira: 762500,    status: 'completed', counterparty: 'KelechiP2P',  date: new Date(Date.now()-86400000*3), type: 'sell' },
  { id: 'NC-005', crypto: 'BTC',  amount: 0.002, naira: 197000,    status: 'cancelled', counterparty: 'FatimaExch',  date: new Date(Date.now()-86400000*4), type: 'buy' },
]

export default function TradesPage() {
  const { isLoggedIn } = useAuth()
  const [filter, setFilter] = useState('ALL')

  if (!isLoggedIn) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Login Required</div>
      <Link href="/auth/login" className="btn-primary" style={{ padding: '12px 28px', borderRadius: 8, textDecoration: 'none', display: 'inline-block' }}>Login →</Link>
    </div>
  )

  const filters = ['ALL', 'pending', 'escrow', 'completed', 'cancelled']
  const filtered = filter === 'ALL' ? MOCK_TRADES : MOCK_TRADES.filter(t => t.status === filter)

  const stats = {
    total:     MOCK_TRADES.length,
    completed: MOCK_TRADES.filter(t => t.status === 'completed').length,
    volume:    MOCK_TRADES.filter(t => t.status === 'completed').reduce((s, t) => s + t.naira, 0),
  }

  return (
    <div className="fade-in">
      <h1 className="section-title" style={{ marginBottom: 24 }}>My Trades</h1>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          ['Total Trades',    String(stats.total),             'var(--text)'],
          ['Completed',       String(stats.completed),          'var(--accent)'],
          ['Total Volume',    formatNaira(stats.volume),        'var(--gold)'],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color, marginBottom: 4 }}>{val}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              background: filter === f ? 'rgba(0,212,170,0.1)' : 'var(--card)',
              color: filter === f ? 'var(--accent)' : 'var(--muted)',
              border: `1px solid ${filter === f ? 'rgba(0,212,170,0.4)' : 'var(--border)'}`,
              padding: '7px 16px', borderRadius: 6, fontSize: 13, textTransform: 'capitalize', transition: 'all 0.2s',
            }}>
            {f === 'ALL' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Trade List */}
      {filtered.length === 0 ? (
        <EmptyState icon="📋" title="No trades here" message="Start trading on the marketplace." action={
          <Link href="/market" className="btn-primary" style={{ padding: '10px 24px', borderRadius: 8, display: 'inline-block', textDecoration: 'none' }}>Browse Offers</Link>
        } />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(trade => (
            <div key={trade.id} className="card-hover" style={{ background: 'var(--card)', borderRadius: 12, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                    background: trade.type === 'buy' ? 'rgba(0,212,170,0.1)' : 'rgba(61,142,255,0.1)',
                    color: trade.type === 'buy' ? 'var(--accent)' : 'var(--blue)',
                  }}>
                    {trade.type === 'buy' ? '↓' : '↑'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {trade.type === 'buy' ? 'Bought' : 'Sold'} {formatCrypto(trade.amount, trade.crypto)}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>
                      {trade.id} · with {trade.counterparty} · {timeAgo(trade.date)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>
                      {formatNaira(trade.naira)}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{formatCrypto(trade.amount, trade.crypto)}</div>
                  </div>
                  <StatusBadge status={trade.status} />
                  {['escrow', 'pending'].includes(trade.status) && (
                    <Link href={`/market/trade/1`}
                      style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'none', background: 'rgba(0,212,170,0.1)', padding: '6px 14px', borderRadius: 6 }}>
                      View →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
