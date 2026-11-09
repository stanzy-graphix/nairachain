'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import Navbar from '@/components/Navbar'
import AuthGuard from '@/components/AuthGuard'
import { Button, Card, Spinner, Badge, EmptyState, Modal, Input, Row } from '@/components/ui'
import { walletAPI, apiError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { usePrices } from '@/lib/usePrices'
import { formatNaira, formatCrypto, formatDate, cryptoIcon, cryptoName, txLabel, txIsCredit } from '@/lib/utils'

function Wallet() {
  const user = useAuthStore((s) => s.user)!
  const { prices } = usePrices()
  const [wallets, setWallets] = useState<any[]>([])
  const [fees, setFees] = useState<Record<string, number>>({})
  const [mins, setMins] = useState<Record<string, number>>({})
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deposit, setDeposit] = useState<{ crypto: string; address?: string; network?: string; error?: string } | null>(null)
  const [withdrawCrypto, setWithdrawCrypto] = useState<string | null>(null)
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', address: '' })
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([walletAPI.getWallets(), walletAPI.getTransactions({ limit: 50 })])
      setWallets(w.data.wallets)
      setFees(w.data.withdrawalFees || {})
      setMins(w.data.minWithdrawals || {})
      setTransactions(t.data.transactions)
    } catch (err) {
      toast.error(apiError(err, 'Failed to load wallet'))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const openDeposit = async (crypto: string) => {
    setDeposit({ crypto })
    try {
      const { data } = await walletAPI.getDepositAddress(crypto)
      setDeposit({ crypto, address: data.address, network: data.network })
    } catch (err) {
      setDeposit({ crypto, error: apiError(err, 'Failed to load address') })
    }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withdrawCrypto) return
    setActionLoading(true)
    try {
      await walletAPI.withdraw({ crypto: withdrawCrypto, amount: Number(withdrawForm.amount), address: withdrawForm.address.trim() })
      toast.success('Withdrawal request submitted!')
      setWithdrawCrypto(null)
      setWithdrawForm({ amount: '', address: '' })
      load()
    } catch (err) {
      toast.error(apiError(err, 'Withdrawal failed'))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-bg"><Navbar /><Spinner /></div>

  const valueOf = (w: any, field = 'balance') => parseFloat(w[field]) * (prices[w.crypto_type]?.price || 0)
  const totalNaira = wallets.reduce((acc, w) => acc + valueOf(w) + valueOf(w, 'locked_balance'), 0)
  const withdrawWallet = wallets.find((w) => w.crypto_type === withdrawCrypto)
  const withdrawFee = withdrawCrypto ? fees[withdrawCrypto] || 0 : 0
  const maxWithdraw = withdrawWallet ? Math.max(0, parseFloat(withdrawWallet.balance) - withdrawFee) : 0

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-10 fade-in">
        <h1 className="font-display font-black text-3xl mb-7">My Wallet</h1>

        <Card className="p-7 mb-7 border-accent/20">
          <div className="text-xs text-muted uppercase tracking-wider font-semibold mb-2">Estimated Portfolio Value</div>
          <div className="font-display font-black text-4xl text-accent mb-1">{formatNaira(totalNaira)}</div>
          <div className="text-muted text-xs">Includes crypto locked in escrow · valued at market rates</div>
        </Card>

        {user.kycStatus !== 'verified' && (
          <Card className="p-4 mb-7 border-gold/30 text-sm text-gold">
            🪪 Your KYC is <strong>{user.kycStatus}</strong>. You can trade, but withdrawals unlock once an admin verifies your identity.
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {wallets.map((w) => (
            <Card key={w.id} className="p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-3xl">{cryptoIcon[w.crypto_type]}</span>
                <span className="text-xs text-accent bg-accent-dim px-2.5 py-1 rounded-full border border-accent/20">{cryptoName[w.crypto_type]}</span>
              </div>
              <div className="text-xs text-muted mb-1">Available</div>
              <div className="font-display font-black text-2xl mb-0.5">{formatCrypto(w.balance, w.crypto_type)}</div>
              <div className="text-muted text-sm mb-1">≈ {formatNaira(valueOf(w))}</div>
              <div className={`text-xs mb-3 ${parseFloat(w.locked_balance) > 0 ? 'text-gold' : 'text-muted'}`}>
                🔒 {formatCrypto(w.locked_balance, w.crypto_type)} in escrow
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={() => openDeposit(w.crypto_type)} className="flex-1 text-xs py-2">Deposit</Button>
                <Button variant="ghost" onClick={() => setWithdrawCrypto(w.crypto_type)} className="flex-1 text-xs py-2">Withdraw</Button>
              </div>
            </Card>
          ))}
        </div>

        <h2 className="font-display font-bold text-xl mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <EmptyState icon="📊" title="No transactions yet" description="Deposits, withdrawals and trades will appear here."
            action={<Link href="/market"><Button variant="outline">Browse Market</Button></Link>} />
        ) : (
          <Card>
            {transactions.map((tx, i) => {
              const credit = txIsCredit(tx.type)
              const neutral = tx.type === 'escrow_release' || tx.type === 'trade_sell' // already left balance at lock time
              return (
                <div key={tx.id} className={`flex justify-between items-center gap-4 p-4 ${i < transactions.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-lg ${credit ? 'bg-accent-dim text-accent' : neutral ? 'bg-surface text-muted' : 'bg-danger/10 text-danger'}`}>
                      {credit ? '↓' : neutral ? '•' : '↑'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{txLabel[tx.type] || tx.type}</div>
                      <div className="text-muted text-xs truncate">{formatDate(tx.created_at)}{tx.notes ? ` · ${tx.notes}` : ''}</div>
                      {tx.tx_hash && <div className="text-muted text-[10px] truncate">tx: {tx.tx_hash}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className={`text-right font-semibold text-sm ${credit ? 'text-accent' : ''}`}>
                      {credit ? '+' : neutral ? '' : '−'}{formatCrypto(tx.amount, tx.crypto)}
                    </div>
                    <Badge status={tx.status} />
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </main>

      {deposit && (
        <Modal title={`Deposit ${deposit.crypto}`} onClose={() => setDeposit(null)} className="max-w-sm">
          <div className="text-center">
            {deposit.error ? <p className="text-danger text-sm">{deposit.error}</p> : !deposit.address ? <Spinner /> : (
              <>
                <div className="bg-white p-3 rounded-lg inline-block mb-4"><QRCodeSVG value={deposit.address} size={160} /></div>
                <div className="text-xs text-muted mb-2">Send only {deposit.crypto} on the <strong className="text-text">{deposit.network}</strong> network to:</div>
                <div className="bg-surface border border-border rounded-lg p-4 font-mono text-xs break-all text-accent mb-4">{deposit.address}</div>
                <button onClick={() => { navigator.clipboard.writeText(deposit.address!); toast.success('Address copied!') }}
                  className="w-full py-2 bg-accent-dim border border-accent/30 text-accent rounded-lg text-sm hover:opacity-80 transition">
                  📋 Copy Address
                </button>
                <p className="text-xs text-muted mt-4">⚠️ Sending other coins or using another network means permanent loss. Deposits are credited after network confirmation.</p>
              </>
            )}
          </div>
        </Modal>
      )}

      {withdrawCrypto && (
        <Modal title={`Withdraw ${withdrawCrypto}`} onClose={() => setWithdrawCrypto(null)} className="max-w-sm">
          <form onSubmit={handleWithdraw} className="flex flex-col gap-4">
            <div>
              <Input label={`Amount (${withdrawCrypto})`} type="number" step="any" min={mins[withdrawCrypto] || 0} value={withdrawForm.amount}
                onChange={(e: any) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} required />
              <button type="button" onClick={() => setWithdrawForm({ ...withdrawForm, amount: String(Number(maxWithdraw.toFixed(8))) })} className="text-xs text-accent mt-1 hover:underline">
                Max: {formatCrypto(maxWithdraw, withdrawCrypto)}
              </button>
            </div>
            <Input label="Destination Address" value={withdrawForm.address} onChange={(e: any) => setWithdrawForm({ ...withdrawForm, address: e.target.value })} required minLength={20} />
            <div className="bg-surface rounded-lg p-3">
              <Row k="Network fee" v={formatCrypto(withdrawFee, withdrawCrypto)} />
              <Row k="Minimum" v={formatCrypto(mins[withdrawCrypto] || 0, withdrawCrypto)} />
              <Row k="Total deducted" v={formatCrypto((Number(withdrawForm.amount) || 0) + withdrawFee, withdrawCrypto)} strong />
            </div>
            {user.kycStatus !== 'verified' && <p className="text-xs text-gold">KYC verification is required before withdrawing.</p>}
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => setWithdrawCrypto(null)} className="flex-1">Cancel</Button>
              <Button type="submit" loading={actionLoading} className="flex-1">Withdraw</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default function WalletPage() {
  return <AuthGuard><Wallet /></AuthGuard>
}
