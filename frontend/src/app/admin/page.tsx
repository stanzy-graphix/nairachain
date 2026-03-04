'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import { Button, Card, Badge, Spinner } from '@/components/ui'
import { adminAPI } from '@/lib/api'
import { formatNaira } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const [tab, setTab] = useState<'overview'|'disputes'|'users'|'transactions'>('overview')
  const [stats, setStats] = useState<any>(null)
  const [disputes, setDisputes] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [txns, setTxns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, d, u, t] = await Promise.all([
        adminAPI.stats(), adminAPI.disputes(), adminAPI.users(), adminAPI.transactions()
      ])
      setStats(s.data); setDisputes(d.data.disputes); setUsers(u.data.users); setTxns(t.data.transactions)
    } catch { toast.error('Failed to load admin data') }
    finally { setLoading(false) }
  }

  const toggleFreeze = async (userId: string, frozen: boolean) => {
    setActionLoading(userId)
    try {
      await adminAPI.freezeUser(userId, !frozen)
      setUsers(u => u.map(x => x.id === userId ? { ...x, is_frozen: !frozen } : x))
      toast.success(`User ${!frozen ? 'frozen' : 'unfrozen'}`)
    } catch { toast.error('Action failed') }
    finally { setActionLoading(null) }
  }

  const updateKyc = async (userId: string, status: string) => {
    try {
      await adminAPI.updateKyc(userId, status)
      setUsers(u => u.map(x => x.id === userId ? { ...x, kyc_status: status } : x))
      toast.success(`KYC updated to ${status}`)
    } catch { toast.error('KYC update failed') }
  }

  const resolveDispute = async (tradeId: string, winner: 'buyer' | 'seller') => {
    setActionLoading(tradeId)
    try {
      await adminAPI.resolveDispute(tradeId, { winner, resolution: `Admin resolved in favour of ${winner}` })
      setDisputes(d => d.filter(x => x.id !== tradeId))
      toast.success(`Dispute resolved — ${winner} wins`)
    } catch { toast.error('Failed to resolve') }
    finally { setActionLoading(null) }
  }

  if (loading) return <div className="min-h-screen bg-bg"><Navbar /><Spinner /></div>

  const filteredUsers = users.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search))

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10 fade-in">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="font-display font-black text-3xl">Admin Panel</h1>
          <span className="text-xs text-danger bg-danger/10 border border-danger/30 px-3 py-1 rounded-full font-bold">RESTRICTED</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-7 flex-wrap">
          {[['overview','Overview'],['disputes','Disputes'],['users','Users'],['transactions','Transactions']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v as any)}
              className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${tab === v ? 'bg-accent-dim border-accent text-accent' : 'bg-card border-border text-muted hover:text-accent'}`}>
              {l}
              {v === 'disputes' && disputes.length > 0 && <span className="ml-2 bg-danger text-white text-xs rounded-full w-4 h-4 inline-flex items-center justify-center">{disputes.length}</span>}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && stats && (
          <div className="fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { val: stats.users?.total || 0, label: 'Total Users', sub: `+${stats.users?.today || 0} today`, color: 'text-accent' },
                { val: formatNaira(stats.volume?.total_24h || 0), label: 'Volume (24h)', color: 'text-blue' },
                { val: stats.openDisputes || 0, label: 'Open Disputes', color: 'text-danger' },
                { val: formatNaira(stats.totalFees?.total || 0), label: 'Total Fees', color: 'text-gold' },
              ].map(({ val, label, sub, color }) => (
                <Card key={label} className="p-6">
                  <div className={`font-display font-black text-3xl ${color} mb-1`}>{val}</div>
                  <div className="text-muted text-xs">{label}</div>
                  {sub && <div className="text-accent text-xs mt-1">{sub}</div>}
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6">
                <div className="font-display font-bold mb-3">Trade Stats</div>
                {[['Total Trades', stats.trades?.total], ['Completed', stats.trades?.completed], ['Disputed', stats.trades?.disputed]].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-border/50 text-sm last:border-0">
                    <span className="text-muted">{k}</span><span className="font-semibold">{v}</span>
                  </div>
                ))}
              </Card>
              <Card className="p-6">
                <div className="font-display font-bold mb-3">Quick Links</div>
                {[['View all disputes', () => setTab('disputes')], ['Manage users', () => setTab('users')], ['View transactions', () => setTab('transactions')]].map(([l, fn]) => (
                  <button key={l as string} onClick={fn as any} className="block w-full text-left py-2 border-b border-border/50 text-sm text-accent hover:text-[#00FFD0] last:border-0">{l as string} →</button>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* DISPUTES */}
        {tab === 'disputes' && (
          <div className="fade-in">
            <h2 className="font-display font-bold text-xl mb-5">Open Disputes ({disputes.length})</h2>
            {disputes.length === 0 ? (
              <Card className="p-10 text-center"><div className="text-4xl mb-3">✅</div><div className="font-display font-bold">No open disputes</div></Card>
            ) : disputes.map(d => (
              <Card key={d.id} className="p-5 mb-4 border-danger/20">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-semibold flex items-center gap-2">{d.trade_ref} <Badge status="disputed" /></div>
                    <div className="text-muted text-xs mt-1">{d.crypto_amount} {d.crypto} · {formatNaira(d.naira_amount)}</div>
                  </div>
                  <div className="text-xs text-muted">{new Date(d.created_at).toLocaleDateString()}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="bg-surface p-3 rounded-lg"><div className="text-muted text-xs mb-1">BUYER</div><div className="font-semibold">{d.buyer_name}</div><div className="text-muted text-xs">{d.buyer_email}</div></div>
                  <div className="bg-surface p-3 rounded-lg"><div className="text-muted text-xs mb-1">SELLER</div><div className="font-semibold">{d.seller_name}</div><div className="text-muted text-xs">{d.seller_email}</div></div>
                </div>
                {d.dispute_reason && <div className="text-sm text-danger bg-danger/10 border border-danger/20 p-3 rounded-lg mb-4">⚠️ {d.dispute_reason}</div>}
                <div className="flex gap-3">
                  <Button onClick={() => resolveDispute(d.id, 'buyer')} loading={actionLoading === d.id} className="flex-1 text-sm py-2.5">Release to Buyer</Button>
                  <Button variant="ghost" onClick={() => resolveDispute(d.id, 'seller')} loading={actionLoading === d.id} className="flex-1 text-sm py-2.5">Return to Seller</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <div className="fade-in">
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-display font-bold text-xl">Users ({users.length})</h2>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..."
                className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-text placeholder:text-muted focus:border-accent outline-none w-64" />
            </div>
            <Card>
              {filteredUsers.map((u, i) => (
                <div key={u.id} className={`flex justify-between items-center p-4 ${i < filteredUsers.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue to-accent flex items-center justify-center text-black font-bold text-sm">{u.name[0]}</div>
                    <div>
                      <div className="font-semibold text-sm">{u.name} {u.is_admin && <span className="text-xs text-gold ml-1">Admin</span>}</div>
                      <div className="text-muted text-xs">{u.email} · {u.total_trades} trades · ★{Number(u.rating).toFixed(1)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge status={u.is_frozen ? 'cancelled' : 'open'} />
                    <select value={u.kyc_status} onChange={e => updateKyc(u.id, e.target.value)}
                      className="bg-surface border border-border rounded text-xs px-2 py-1 text-text outline-none focus:border-accent">
                      <option value="pending">KYC Pending</option>
                      <option value="verified">KYC Verified</option>
                      <option value="rejected">KYC Rejected</option>
                    </select>
                    <button onClick={() => toggleFreeze(u.id, u.is_frozen)} disabled={actionLoading === u.id}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${u.is_frozen ? 'text-accent border-accent/40 hover:bg-accent-dim' : 'text-danger border-danger/40 hover:bg-danger/10'}`}>
                      {actionLoading === u.id ? '...' : u.is_frozen ? 'Unfreeze' : 'Freeze'}
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* TRANSACTIONS */}
        {tab === 'transactions' && (
          <div className="fade-in">
            <h2 className="font-display font-bold text-xl mb-5">All Transactions</h2>
            <Card>
              {txns.slice(0, 50).map((tx, i) => (
                <div key={tx.id} className={`flex justify-between items-center p-4 text-sm ${i < txns.length - 1 ? 'border-b border-border' : ''}`}>
                  <div>
                    <div className="font-semibold capitalize">{tx.type.replace(/_/g, ' ')}</div>
                    <div className="text-muted text-xs">{tx.user_name} · {new Date(tx.created_at).toLocaleDateString()}</div>
                    {tx.notes && <div className="text-muted text-xs">{tx.notes}</div>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right font-semibold">{tx.amount} {tx.crypto}</div>
                    <Badge status={tx.status} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
