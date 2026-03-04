import { useState } from 'react'
import Link from 'next/link'
import { StatusBadge, Modal, StatCard, EmptyState } from '../../components/UI'
import { formatNaira, formatCrypto, timeAgo } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-toastify'

const MOCK_USERS = [
  { id: 1, name: 'Emeka Okafor',   email: 'emeka@mail.com',  kyc: 'verified', trades: 89,  volume: 12400000, status: 'active',  joined: new Date(Date.now()-86400000*90) },
  { id: 2, name: 'Bimpe Adesanya', email: 'bimpe@mail.com',  kyc: 'pending',  trades: 12,  volume: 1800000,  status: 'active',  joined: new Date(Date.now()-86400000*30) },
  { id: 3, name: 'Yusuf Hassan',   email: 'yusuf@mail.com',  kyc: 'verified', trades: 341, volume: 48000000, status: 'frozen',  joined: new Date(Date.now()-86400000*200) },
  { id: 4, name: 'Chinwe Obi',     email: 'chinwe@mail.com', kyc: 'verified', trades: 55,  volume: 7200000,  status: 'active',  joined: new Date(Date.now()-86400000*60) },
  { id: 5, name: 'Abdullahi Teni', email: 'abdu@mail.com',   kyc: 'rejected', trades: 3,   volume: 200000,   status: 'active',  joined: new Date(Date.now()-86400000*10) },
]

const MOCK_DISPUTES = [
  { id: 'DSP-001', tradeId: 'NC-088', buyer: 'AdekunleK', seller: 'FatimaEx', amount: 450000, crypto: 'BTC', cryptoAmt: 0.005, reason: 'Seller not confirming after payment sent', opened: new Date(Date.now()-3600000*2) },
  { id: 'DSP-002', tradeId: 'NC-091', buyer: 'ChinweO',   seller: 'AbdullahiT', amount: 120000, crypto: 'USDT', cryptoAmt: 80, reason: 'Buyer claims payment sent but no receipt', opened: new Date(Date.now()-3600000*5) },
  { id: 'DSP-003', tradeId: 'NC-094', buyer: 'TokeA',     seller: 'BolaTrades', amount: 85000, crypto: 'ETH', cryptoAmt: 0.016, reason: 'Wrong amount sent by buyer', opened: new Date(Date.now()-3600000*1) },
]

const MOCK_ALL_TRADES = [
  { id: 'NC-101', buyer: 'AdekunleK', seller: 'FatimaEx',   crypto: 'BTC',  amount: 0.01,  naira: 985000, status: 'completed', date: new Date(Date.now()-3600000) },
  { id: 'NC-102', buyer: 'BimpeFX',   seller: 'KelechiP2P', crypto: 'USDT', amount: 500,   naira: 760000, status: 'escrow',    date: new Date(Date.now()-1800000) },
  { id: 'NC-103', buyer: 'TokeA',     seller: 'EmekaCrypto',crypto: 'ETH',  amount: 0.2,   naira: 1040000, status: 'pending', date: new Date(Date.now()-900000) },
  { id: 'NC-088', buyer: 'AdekunleK', seller: 'FatimaEx',   crypto: 'BTC',  amount: 0.005, naira: 450000, status: 'disputed', date: new Date(Date.now()-7200000) },
]

export default function AdminPage() {
  const { isLoggedIn, isAdmin } = useAuth()
  const [tab, setTab] = useState('overview')
  const [userSearch, setUserSearch] = useState('')
  const [users, setUsers] = useState(MOCK_USERS)
  const [disputes, setDisputes] = useState(MOCK_DISPUTES)
  const [selectedDispute, setSelectedDispute] = useState(null)

  if (!isLoggedIn) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Login Required</div>
      <Link href="/auth/login" className="btn-primary" style={{ padding: '12px 28px', borderRadius: 8, textDecoration: 'none', display: 'inline-block' }}>Login →</Link>
    </div>
  )

  const toggleFreeze = (userId) => {
    setUsers(us => us.map(u => u.id === userId ? { ...u, status: u.status === 'frozen' ? 'active' : 'frozen' } : u))
    const u = users.find(u => u.id === userId)
    toast.success(`${u.name} ${u.status === 'frozen' ? 'unfrozen' : 'frozen'}`)
  }

  const resolveDispute = (disputeId, favor) => {
    setDisputes(ds => ds.filter(d => d.id !== disputeId))
    setSelectedDispute(null)
    toast.success(`Dispute resolved in favor of ${favor === 'buyer' ? 'Buyer' : 'Seller'}`)
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  const tabs = ['overview', 'disputes', 'users', 'trades']

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <h1 className="section-title">Admin Panel</h1>
        <span style={{ background: 'rgba(255,77,109,0.15)', color: 'var(--danger)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
          RESTRICTED
        </span>
        {disputes.length > 0 && (
          <span style={{ background: 'rgba(255,77,109,0.15)', color: 'var(--danger)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
            🔴 {disputes.length} open disputes
          </span>
        )}
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', color: tab === t ? 'var(--accent)' : 'var(--muted)',
              padding: '10px 20px', fontSize: 14, fontWeight: tab === t ? 600 : 400,
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              textTransform: 'capitalize', cursor: 'pointer', transition: 'all 0.2s', marginBottom: -1,
            }}>
            {t === 'disputes' && disputes.length > 0 ? `${t} (${disputes.length})` : t}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            <StatCard value="18,421"    label="Total Users"       color="var(--accent)" icon="👥" />
            <StatCard value="₦2.4B"     label="Volume (24h)"      color="var(--blue)"   icon="📊" />
            <StatCard value={String(disputes.length)} label="Open Disputes" color="var(--danger)" icon="⚠️" />
            <StatCard value="₦12.4M"   label="Fees Earned (30d)" color="var(--gold)"   icon="💰" />
          </div>

          {/* Recent Activity */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Recent Activity</div>
            {[
              ['New user signup', 'Folake Adewale joined', '2m ago', '👤'],
              ['Trade completed', 'NC-098: 0.01 BTC sold for ₦985,000', '5m ago', '✅'],
              ['Dispute opened', 'NC-088 disputed by buyer', '2h ago', '⚠️'],
              ['KYC submitted', 'Musa Ibrahim submitted documents', '3h ago', '📋'],
            ].map(([title, desc, time, icon]) => (
              <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{desc}</div>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DISPUTES */}
      {tab === 'disputes' && (
        <div>
          {disputes.length === 0 ? (
            <EmptyState icon="✅" title="No open disputes" message="All trade disputes have been resolved." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {disputes.map(d => (
                <div key={d.id} style={{ background: 'var(--card)', border: '1px solid rgba(255,77,109,0.2)', borderRadius: 12, padding: 22 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>{d.id}</span>
                        <span style={{ color: 'var(--muted)', fontSize: 13 }}>· Trade {d.tradeId}</span>
                        <StatusBadge status="escrow" />
                      </div>
                      <div style={{ fontSize: 14, marginBottom: 4 }}>
                        <span style={{ color: 'var(--accent)' }}>Buyer: {d.buyer}</span>
                        <span style={{ color: 'var(--muted)', margin: '0 8px' }}>vs</span>
                        <span style={{ color: 'var(--blue)' }}>Seller: {d.seller}</span>
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                        {formatCrypto(d.cryptoAmt, d.crypto)} · {formatNaira(d.amount)}
                      </div>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{timeAgo(d.opened)}</div>
                  </div>
                  <div style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--danger)' }}>
                    ⚠ {d.reason}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => resolveDispute(d.id, 'buyer')} className="btn-primary"
                      style={{ padding: '9px 20px', borderRadius: 7, fontSize: 13 }}>
                      Release to Buyer ✓
                    </button>
                    <button onClick={() => resolveDispute(d.id, 'seller')} className="btn-ghost"
                      style={{ padding: '9px 20px', borderRadius: 7, fontSize: 13 }}>
                      Return to Seller
                    </button>
                    <button onClick={() => setSelectedDispute(d)}
                      style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '9px 20px', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
              placeholder="Search by name or email..." className="input-field" style={{ maxWidth: 340 }} />
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1.5fr 1fr', gap: 12, padding: '12px 20px', fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
              <span>Name</span><span>Email</span><span>KYC</span><span>Trades</span><span>Volume</span><span>Action</span>
            </div>
            {filteredUsers.map(u => (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1.5fr 1fr', gap: 12, padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 11 }}>Joined {timeAgo(u.joined)}</div>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{u.email}</div>
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                    color: u.kyc === 'verified' ? 'var(--accent)' : u.kyc === 'pending' ? 'var(--gold)' : 'var(--danger)',
                    background: u.kyc === 'verified' ? 'rgba(0,212,170,0.1)' : u.kyc === 'pending' ? 'rgba(245,166,35,0.1)' : 'rgba(255,77,109,0.1)',
                  }}>
                    {u.kyc}
                  </span>
                </div>
                <div style={{ fontWeight: 600 }}>{u.trades}</div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>{formatNaira(u.volume)}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <StatusBadge status={u.status} />
                  <button onClick={() => toggleFreeze(u.id)}
                    style={{ background: 'none', border: `1px solid ${u.status === 'frozen' ? 'rgba(0,212,170,0.3)' : 'rgba(255,77,109,0.3)'}`, color: u.status === 'frozen' ? 'var(--accent)' : 'var(--danger)', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>
                    {u.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALL TRADES */}
      {tab === 'trades' && (
        <div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1.2fr 1fr 1fr', gap: 12, padding: '12px 20px', fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
              <span>Trade ID</span><span>Buyer</span><span>Seller</span><span>Crypto</span><span>Naira</span><span>Status</span><span>Time</span>
            </div>
            {MOCK_ALL_TRADES.map(t => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr 1fr 1.2fr 1fr 1fr', gap: 12, padding: '14px 20px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{t.id}</div>
                <div style={{ fontSize: 13 }}>{t.buyer}</div>
                <div style={{ fontSize: 13 }}>{t.seller}</div>
                <div style={{ fontWeight: 600 }}>{formatCrypto(t.amount, t.crypto)}</div>
                <div style={{ fontWeight: 600 }}>{formatNaira(t.naira)}</div>
                <StatusBadge status={t.status} />
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{timeAgo(t.date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dispute Detail Modal */}
      <Modal open={!!selectedDispute} onClose={() => setSelectedDispute(null)} title="Dispute Details" maxWidth={560}>
        {selectedDispute && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                ['Dispute ID', selectedDispute.id],
                ['Trade ID',   selectedDispute.tradeId],
                ['Buyer',      selectedDispute.buyer],
                ['Seller',     selectedDispute.seller],
                ['Amount',     formatNaira(selectedDispute.amount)],
                ['Crypto',     formatCrypto(selectedDispute.cryptoAmt, selectedDispute.crypto)],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--surface)', padding: '12px 14px', borderRadius: 8 }}>
                  <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4 }}>{k.toUpperCase()}</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 13, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--danger)' }}>Reason: </strong>{selectedDispute.reason}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => resolveDispute(selectedDispute.id, 'buyer')} className="btn-primary" style={{ flex: 1, padding: 12, borderRadius: 8 }}>
                Release to Buyer
              </button>
              <button onClick={() => resolveDispute(selectedDispute.id, 'seller')} className="btn-ghost" style={{ flex: 1, padding: 12, borderRadius: 8 }}>
                Return to Seller
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
