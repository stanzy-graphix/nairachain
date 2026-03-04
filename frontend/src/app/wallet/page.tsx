'use client'
import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import { Button, Card, Spinner, Badge, EmptyState } from '@/components/ui'
import { walletAPI } from '@/lib/api'
import { formatNaira, formatCrypto, cryptoIcon } from '@/lib/utils'
import toast from 'react-hot-toast'

const RATES: Record<string, number> = { USDT: 1520, BTC: 98500000, ETH: 5200000 }

export default function WalletPage() {
  const [wallets, setWallets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [depositModal, setDepositModal] = useState<string | null>(null)
  const [depositAddress, setDepositAddress] = useState('')
  const [withdrawModal, setWithdrawModal] = useState<string | null>(null)
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', address: '' })
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    Promise.all([walletAPI.getWallets(), walletAPI.getTransactions()])
      .then(([w, t]) => { setWallets(w.data.wallets); setTransactions(t.data.transactions) })
      .catch(() => toast.error('Failed to load wallet'))
      .finally(() => setLoading(false))
  }, [])

  const openDeposit = async (crypto: string) => {
    setDepositModal(crypto); setDepositAddress('Loading...')
    try {
      const { data } = await walletAPI.getDepositAddress(crypto)
      setDepositAddress(data.address)
    } catch { setDepositAddress('Failed to load address') }
  }

  const handleWithdraw = async () => {
    if (!withdrawModal) return
    setActionLoading(true)
    try {
      await walletAPI.withdraw({ crypto: withdrawModal, ...withdrawForm })
      toast.success('Withdrawal request submitted!')
      setWithdrawModal(null)
      setWithdrawForm({ amount: '', address: '' })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Withdrawal failed')
    } finally { setActionLoading(false) }
  }

  const totalNaira = wallets.reduce((acc, w) => acc + (parseFloat(w.balance) * (RATES[w.crypto_type] || 0)), 0)

  if (loading) return <div className="min-h-screen bg-bg"><Navbar /><Spinner /></div>

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10 fade-in">
        <h1 className="font-display font-black text-3xl mb-7">My Wallet</h1>

        {/* Portfolio value */}
        <Card className="p-7 mb-7 border-accent/20">
          <div className="text-xs text-muted uppercase tracking-wider font-semibold mb-2">Total Portfolio Value</div>
          <div className="font-display font-black text-4xl text-accent mb-1">{formatNaira(totalNaira)}</div>
          <div className="text-accent text-sm">↑ +2.4% today</div>
        </Card>

        {/* Wallet cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {wallets.map(w => (
            <Card key={w.id} className="p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-3xl">{cryptoIcon[w.crypto_type]}</span>
                <span className="text-xs text-accent bg-accent-dim px-2.5 py-1 rounded-full border border-accent/20">{w.crypto_type}</span>
              </div>
              <div className="font-display font-black text-2xl mb-0.5">{formatCrypto(w.balance, w.crypto_type)}</div>
              <div className="text-muted text-sm mb-1">{formatNaira(parseFloat(w.balance) * RATES[w.crypto_type])}</div>
              {parseFloat(w.locked_balance) > 0 && (
                <div className="text-xs text-gold mb-3">🔒 {formatCrypto(w.locked_balance, w.crypto_type)} locked in escrow</div>
              )}
              <div className="flex gap-2 mt-4">
                <Button onClick={() => openDeposit(w.crypto_type)} className="flex-1 text-xs py-2">Deposit</Button>
                <Button variant="ghost" onClick={() => setWithdrawModal(w.crypto_type)} className="flex-1 text-xs py-2">Withdraw</Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Transaction history */}
        <h2 className="font-display font-bold text-xl mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <EmptyState icon="📊" title="No transactions yet" description="Your transaction history will appear here." />
        ) : (
          <Card>
            {transactions.map((tx, i) => (
              <div key={tx.id} className={`flex justify-between items-center p-4 ${i < transactions.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${tx.type.includes('buy') || tx.type === 'deposit' ? 'bg-accent-dim' : 'bg-danger/10'}`}>
                    {tx.type.includes('buy') || tx.type === 'deposit' ? '↓' : '↑'}
                  </div>
                  <div>
                    <div className="text-sm font-semibold capitalize">{tx.type.replace('_', ' ')}</div>
                    <div className="text-muted text-xs">{new Date(tx.created_at).toLocaleDateString('en-NG')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold">{tx.amount} {tx.crypto}</div>
                  </div>
                  <Badge status={tx.status} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </main>

      {/* Deposit Modal */}
      {depositModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <Card className="p-7 max-w-sm w-full fade-in">
            <div className="flex justify-between mb-5">
              <h3 className="font-display font-bold text-lg">Deposit {depositModal}</h3>
              <button onClick={() => setDepositModal(null)} className="text-muted hover:text-text">✕</button>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted mb-3">Send {depositModal} to this address:</div>
              <div className="bg-surface border border-border rounded-lg p-4 font-mono text-xs break-all text-accent mb-4">{depositAddress}</div>
              <button onClick={() => { navigator.clipboard.writeText(depositAddress); toast.success('Address copied!') }}
                className="w-full py-2 bg-accent-dim border border-accent/30 text-accent rounded-lg text-sm hover:bg-accent-dim/70 transition">
                📋 Copy Address
              </button>
              <p className="text-xs text-muted mt-4">⚠️ Only send {depositModal} to this address. Wrong coins = permanent loss.</p>
            </div>
          </Card>
        </div>
      )}

      {/* Withdraw Modal */}
      {withdrawModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <Card className="p-7 max-w-sm w-full fade-in">
            <div className="flex justify-between mb-5">
              <h3 className="font-display font-bold text-lg">Withdraw {withdrawModal}</h3>
              <button onClick={() => setWithdrawModal(null)} className="text-muted hover:text-text">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Amount ({withdrawModal})</label>
                <input type="number" value={withdrawForm.amount} onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg px-3.5 py-3 text-sm text-text focus:border-accent outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1.5">Destination Address</label>
                <input value={withdrawForm.address} onChange={e => setWithdrawForm({ ...withdrawForm, address: e.target.value })}
                  className="w-full bg-surface border border-border rounded-lg px-3.5 py-3 text-sm text-text focus:border-accent outline-none" />
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setWithdrawModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleWithdraw} loading={actionLoading} className="flex-1">Withdraw</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
