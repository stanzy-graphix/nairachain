'use client'
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import AuthGuard from '@/components/AuthGuard'
import { Button, Card, Badge, Spinner, Modal, Input, Select, Row } from '@/components/ui'
import { adminAPI, apiError } from '@/lib/api'
import { formatNaira, formatCrypto, formatDate, formatTime, txLabel } from '@/lib/utils'

type Tab = 'overview' | 'disputes' | 'withdrawals' | 'users' | 'transactions'

function Admin() {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<any>(null)
  const [disputes, setDisputes] = useState<any[]>([])
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [txns, setTxns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [credit, setCredit] = useState<{ user: any; crypto: string; amount: string; txHash: string } | null>(null)
  const [openChat, setOpenChat] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [s, d, w, u, t] = await Promise.all([
        adminAPI.stats(), adminAPI.disputes(), adminAPI.withdrawals(), adminAPI.users(), adminAPI.transactions(),
      ])
      setStats(s.data); setDisputes(d.data.disputes); setWithdrawals(w.data.withdrawals); setUsers(u.data.users); setTxns(t.data.transactions)
    } catch (err) {
      toast.error(apiError(err, 'Failed to load admin data'))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { loadAll() }, [loadAll])

  const act = async (key: string, fn: () => Promise<any>, msg: string) => {
    setBusy(key)
    try { await fn(); toast.success(msg); await loadAll(); return true }
    catch (err) { toast.error(apiError(err, 'Action failed')); return false }
    finally { setBusy(null) }
  }

  if (loading) return <div className="min-h-screen bg-bg"><Navbar /><Spinner /></div>

  const q = search.toLowerCase()
  const filteredUsers = users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  const tabs: [Tab, string, number?][] = [
    ['overview', 'Overview'], ['disputes', 'Disputes', disputes.length], ['withdrawals', 'Withdrawals', withdrawals.length],
    ['users', 'Users'], ['transactions', 'Transactions'],
  ]

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 fade-in">
        <div className="flex items-center gap-3 mb-8">
          <h1 className="font-display font-black text-3xl">Admin Panel</h1>
          <span className="text-xs text-danger bg-danger/10 border border-danger/30 px-3 py-1 rounded-full font-bold">RESTRICTED</span>
          <button onClick={() => { setLoading(true); loadAll() }} className="ml-auto text-xs text-muted hover:text-accent">⟳ Refresh</button>
        </div>

        <div className="flex gap-2 mb-7 flex-wrap">
          {tabs.map(([v, l, n]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-5 py-2 rounded-lg text-sm font-medium border transition-colors ${tab === v ? 'bg-accent-dim border-accent text-accent' : 'bg-card border-border text-muted hover:text-accent'}`}>
              {l}
              {!!n && <span className="ml-2 bg-danger text-white text-xs rounded-full min-w-4 h-4 px-1 inline-flex items-center justify-center">{n}</span>}
            </button>
          ))}
        </div>

        {tab === 'overview' && stats && (
          <div className="fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { val: stats.users.total, label: 'Total Users', sub: `+${stats.users.today} today`, color: 'text-accent' },
                { val: formatNaira(stats.volume.total_24h), label: 'Completed Volume (24h)', color: 'text-blue' },
                { val: stats.openDisputes, label: 'Open Disputes', color: 'text-danger' },
                { val: formatNaira(stats.totalFees), label: 'Total Fees Earned', color: 'text-gold' },
              ].map(({ val, label, sub, color }) => (
                <Card key={label} className="p-6">
                  <div className={`font-display font-black text-2xl md:text-3xl ${color} mb-1`}>{val}</div>
                  <div className="text-muted text-xs">{label}</div>
                  {sub && <div className="text-accent text-xs mt-1">{sub}</div>}
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6">
                <div className="font-display font-bold mb-3">Trades</div>
                <Row k="Total" v={stats.trades.total} />
                <Row k="Active" v={stats.trades.active} />
                <Row k="Completed" v={stats.trades.completed} />
                <Row k="Cancelled" v={stats.trades.cancelled} />
                <Row k="Disputed" v={stats.trades.disputed} />
              </Card>
              <Card className="p-6">
                <div className="font-display font-bold mb-3">Queues</div>
                <Row k="Pending withdrawals" v={<button className="text-accent" onClick={() => setTab('withdrawals')}>{stats.pendingWithdrawals} →</button>} />
                <Row k="Open disputes" v={<button className="text-accent" onClick={() => setTab('disputes')}>{stats.openDisputes} →</button>} />
                <Row k="KYC pending" v={<button className="text-accent" onClick={() => setTab('users')}>{stats.users.kyc_pending} →</button>} />
              </Card>
            </div>
          </div>
        )}

        {tab === 'disputes' && (
          <div className="fade-in">
            <h2 className="font-display font-bold text-xl mb-5">Open Disputes ({disputes.length})</h2>
            {disputes.length === 0 ? (
              <Card className="p-10 text-center"><div className="text-4xl mb-3">✅</div><div className="font-display font-bold">No open disputes</div></Card>
            ) : disputes.map((d) => (
              <Card key={d.id} className="p-5 mb-4 border-danger/20">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-semibold flex items-center gap-2">{d.trade_ref} <Badge status="disputed" /></div>
                    <div className="text-muted text-xs mt-1">{formatCrypto(d.crypto_amount, d.crypto)} · {formatNaira(d.naira_amount)} · paid to {d.seller_bank_name} {d.seller_bank_account_number}</div>
                  </div>
                  <div className="text-xs text-muted text-right">Opened by {d.disputed_by_name || '—'}<br />{formatDate(d.updated_at)}</div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="bg-surface p-3 rounded-lg"><div className="text-muted text-xs mb-1">BUYER</div><div className="font-semibold">{d.buyer_name}</div><div className="text-muted text-xs">{d.buyer_email}</div></div>
                  <div className="bg-surface p-3 rounded-lg"><div className="text-muted text-xs mb-1">SELLER</div><div className="font-semibold">{d.seller_name}</div><div className="text-muted text-xs">{d.seller_email}</div></div>
                </div>
                {d.dispute_reason && <div className="text-sm text-danger bg-danger/10 border border-danger/20 p-3 rounded-lg mb-4">⚠️ {d.dispute_reason}</div>}
                <button onClick={() => setOpenChat(openChat === d.id ? null : d.id)} className="text-xs text-accent mb-3">
                  {openChat === d.id ? 'Hide' : 'Show'} chat log ({d.messages?.length || 0})
                </button>
                {openChat === d.id && (
                  <div className="bg-surface rounded-lg p-3 mb-4 max-h-64 overflow-y-auto space-y-1.5 text-xs">
                    {(d.messages || []).map((m: any, i: number) => (
                      <div key={i} className={m.is_system ? 'text-muted italic' : ''}>
                        <span className="text-muted">{formatTime(m.created_at)}</span> <strong>{m.is_system ? 'System' : m.sender}:</strong> {m.message}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <Button onClick={() => confirm(`Release ${d.crypto_amount} ${d.crypto} to ${d.buyer_name}?`) && act(d.id, () => adminAPI.resolveDispute(d.id, { winner: 'buyer' }), 'Released to buyer')}
                    loading={busy === d.id} className="flex-1 text-sm py-2.5">Release to Buyer</Button>
                  <Button variant="ghost" onClick={() => confirm(`Return ${d.crypto_amount} ${d.crypto} to ${d.seller_name}?`) && act(d.id, () => adminAPI.resolveDispute(d.id, { winner: 'seller' }), 'Returned to seller')}
                    loading={busy === d.id} className="flex-1 text-sm py-2.5">Return to Seller</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'withdrawals' && (
          <div className="fade-in">
            <h2 className="font-display font-bold text-xl mb-5">Pending Withdrawals ({withdrawals.length})</h2>
            {withdrawals.length === 0 ? (
              <Card className="p-10 text-center"><div className="text-4xl mb-3">✅</div><div className="font-display font-bold">Queue is empty</div></Card>
            ) : (
              <Card>
                {withdrawals.map((w, i) => (
                  <div key={w.id} className={`p-4 flex flex-wrap gap-4 justify-between items-center ${i < withdrawals.length - 1 ? 'border-b border-border' : ''}`}>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{formatCrypto(w.amount, w.crypto)} <span className="text-muted text-xs">+ {w.fee} fee</span></div>
                      <div className="text-muted text-xs">{w.user_name} · {w.user_email} · KYC {w.kyc_status}</div>
                      <div className="text-muted text-xs break-all">{w.notes}</div>
                      <div className="text-muted text-[10px]">{formatDate(w.created_at)}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="text-xs py-1.5 px-3" loading={busy === w.id} onClick={() => {
                        const txHash = prompt('On-chain transaction hash (optional):') ?? undefined
                        act(w.id, () => adminAPI.processWithdrawal(w.id, { action: 'approve', txHash: txHash || undefined }), 'Withdrawal approved')
                      }}>Approve</Button>
                      <Button variant="ghost" className="text-xs py-1.5 px-3" disabled={busy === w.id} onClick={() => {
                        const reason = prompt('Reason for rejection:')
                        if (reason !== null) act(w.id, () => adminAPI.processWithdrawal(w.id, { action: 'reject', reason }), 'Rejected and refunded')
                      }}>Reject</Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="fade-in">
            <div className="flex justify-between items-center mb-5 gap-4 flex-wrap">
              <h2 className="font-display font-bold text-xl">Users ({users.length})</h2>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…"
                className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-text placeholder:text-muted focus:border-accent outline-none w-64" />
            </div>
            <Card>
              {filteredUsers.map((u, i) => (
                <div key={u.id} className={`flex flex-wrap gap-3 justify-between items-center p-4 ${i < filteredUsers.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-blue to-accent flex items-center justify-center text-black font-bold text-sm">{u.name[0]}</div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{u.name} {u.is_admin && <span className="text-xs text-gold ml-1">Admin</span>} {!u.email_verified && <span className="text-xs text-muted ml-1">(unverified)</span>}</div>
                      <div className="text-muted text-xs truncate">{u.email} · {u.total_trades} trades · ★{Number(u.rating).toFixed(1)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge status={u.is_frozen ? 'frozen' : 'active'} />
                    <select value={u.kyc_status} onChange={(e) => act(u.id + 'kyc', () => adminAPI.updateKyc(u.id, e.target.value), `KYC set to ${e.target.value}`)}
                      className="bg-surface border border-border rounded text-xs px-2 py-1.5 text-text outline-none focus:border-accent">
                      <option value="pending">KYC Pending</option>
                      <option value="verified">KYC Verified</option>
                      <option value="rejected">KYC Rejected</option>
                    </select>
                    <button onClick={() => setCredit({ user: u, crypto: 'USDT', amount: '', txHash: '' })}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-accent hover:border-accent">Credit</button>
                    {!u.is_admin && (
                      <button onClick={() => act(u.id, () => adminAPI.freezeUser(u.id, !u.is_frozen), u.is_frozen ? 'User unfrozen' : 'User frozen')} disabled={busy === u.id}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${u.is_frozen ? 'text-accent border-accent/40 hover:bg-accent-dim' : 'text-danger border-danger/40 hover:bg-danger/10'}`}>
                        {busy === u.id ? '…' : u.is_frozen ? 'Unfreeze' : 'Freeze'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab === 'transactions' && (
          <div className="fade-in">
            <h2 className="font-display font-bold text-xl mb-5">Recent Transactions</h2>
            <Card>
              {txns.map((tx, i) => (
                <div key={tx.id} className={`flex justify-between items-center gap-4 p-4 text-sm ${i < txns.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="min-w-0">
                    <div className="font-semibold">{txLabel[tx.type] || tx.type}</div>
                    <div className="text-muted text-xs">{tx.user_name} · {formatDate(tx.created_at)}</div>
                    {tx.notes && <div className="text-muted text-xs truncate">{tx.notes}</div>}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right font-semibold">{formatCrypto(tx.amount, tx.crypto)}</div>
                    <Badge status={tx.status} />
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </main>

      {credit && (
        <Modal title={`Credit deposit · ${credit.user.name}`} onClose={() => setCredit(null)} className="max-w-sm">
          <form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault()
            act('credit', () => adminAPI.creditUser(credit.user.id, { crypto: credit.crypto, amount: Number(credit.amount), txHash: credit.txHash || undefined }),
              `Credited ${credit.amount} ${credit.crypto}`).then((ok) => ok && setCredit(null))
          }}>
            <p className="text-xs text-muted">Record a confirmed on-chain deposit. Use until a custody provider webhook is connected.</p>
            <Select label="Crypto" value={credit.crypto} onChange={(e: any) => setCredit({ ...credit, crypto: e.target.value })}>
              <option>USDT</option><option>BTC</option><option>ETH</option>
            </Select>
            <Input label="Amount" type="number" step="any" min="0" value={credit.amount} onChange={(e: any) => setCredit({ ...credit, amount: e.target.value })} required />
            <Input label="Tx hash (optional)" value={credit.txHash} onChange={(e: any) => setCredit({ ...credit, txHash: e.target.value })} />
            <Button type="submit" loading={busy === 'credit'}>Credit Wallet</Button>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default function AdminPage() {
  return <AuthGuard admin><Admin /></AuthGuard>
}
