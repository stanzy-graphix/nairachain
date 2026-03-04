import { useState } from 'react'
import { Modal, CopyButton, EmptyState, StatusBadge } from '../../components/UI'
import { formatNaira, formatCrypto, CRYPTO_LIST, cryptoIcons, timeAgo } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import Link from 'next/link'
import { toast } from 'react-toastify'

const MOCK_BALANCES = {
  USDT: { balance: 850.50, locked: 200 },
  BTC:  { balance: 0.0234, locked: 0 },
  ETH:  { balance: 1.45,   locked: 0.1 },
}

const MOCK_TXNS = [
  { id: 1, type: 'deposit',    crypto: 'USDT',  amount: 500,    status: 'completed', date: new Date(Date.now()-86400000*1), hash: '0xabc123' },
  { id: 2, type: 'trade_buy',  crypto: 'BTC',   amount: 0.005,  status: 'completed', date: new Date(Date.now()-86400000*2) },
  { id: 3, type: 'withdrawal', crypto: 'USDT',  amount: -200,   status: 'pending',   date: new Date(Date.now()-86400000*0.5) },
  { id: 4, type: 'trade_sell', crypto: 'ETH',   amount: -0.1,   status: 'completed', date: new Date(Date.now()-86400000*3) },
  { id: 5, type: 'deposit',    crypto: 'ETH',   amount: 0.5,    status: 'completed', date: new Date(Date.now()-86400000*4), hash: '0xdef456' },
]

const CRYPTO_PRICES = { USDT: 1520, BTC: 98500000, ETH: 5200000 }

function DepositModal({ crypto, onClose }) {
  const MOCK_ADDRESSES = {
    USDT: 'TXaBc1234567890XYZ_TRON_ADDRESS',
    BTC:  'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    ETH:  '0x742d35Cc6634C0532925a3b8D4C9B7F93c2bfA1E',
  }
  const address = MOCK_ADDRESSES[crypto]

  return (
    <Modal open={!!crypto} onClose={onClose} title={`Deposit ${crypto}`}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ background: '#fff', padding: 16, borderRadius: 12, display: 'inline-block', marginBottom: 14 }}>
          {/* QR placeholder */}
          <div style={{ width: 140, height: 140, background: 'var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>
            QR Code<br />(use qrcode.react)
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Your {crypto} deposit address</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
          <span style={{ flex: 1, fontSize: 12, wordBreak: 'break-all', textAlign: 'left' }}>{address}</span>
          <CopyButton text={address} />
        </div>
      </div>
      <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: 8, padding: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
        ⚠ Only send <strong style={{ color: 'var(--text)' }}>{crypto}</strong> to this address.
        Minimum deposit: {crypto === 'BTC' ? '0.0001 BTC' : crypto === 'ETH' ? '0.01 ETH' : '10 USDT'}.
        Deposits are credited after 2 network confirmations.
      </div>
    </Modal>
  )
}

function WithdrawModal({ crypto, balance, onClose }) {
  const [form, setForm] = useState({ address: '', amount: '' })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.address || !form.amount) return toast.error('Fill all fields')
    if (Number(form.amount) > balance) return toast.error('Insufficient balance')
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      toast.success(`Withdrawal of ${form.amount} ${crypto} submitted!`)
      onClose()
    }, 1200)
  }

  return (
    <Modal open={!!crypto} onClose={onClose} title={`Withdraw ${crypto}`}>
      <div style={{ marginBottom: 16 }}>
        <label className="label">Withdrawal Address</label>
        <input placeholder={`Your ${crypto} wallet address`} value={form.address} onChange={set('address')} className="input-field" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <label className="label" style={{ margin: 0 }}>Amount</label>
          <button onClick={() => setForm(f => ({ ...f, amount: String(balance) }))}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer' }}>
            Max: {formatCrypto(balance, crypto)}
          </button>
        </div>
        <input type="number" placeholder="0.00" value={form.amount} onChange={set('amount')} className="input-field" />
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 20 }}>
        Network fee: ~{crypto === 'BTC' ? '0.00003 BTC' : crypto === 'ETH' ? '0.002 ETH' : '2 USDT'}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: 12, borderRadius: 8, fontSize: 14 }}>Cancel</button>
        <button onClick={submit} disabled={loading} className="btn-primary" style={{ flex: 1, padding: 12, borderRadius: 8, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>
          {loading ? 'Processing...' : 'Withdraw'}
        </button>
      </div>
    </Modal>
  )
}

export default function WalletPage() {
  const { isLoggedIn } = useAuth()
  const [depositCrypto, setDepositCrypto] = useState(null)
  const [withdrawCrypto, setWithdrawCrypto] = useState(null)

  if (!isLoggedIn) return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Login Required</div>
      <Link href="/auth/login" className="btn-primary" style={{ padding: '12px 28px', borderRadius: 8, textDecoration: 'none', display: 'inline-block' }}>Login →</Link>
    </div>
  )

  const totalNaira = CRYPTO_LIST.reduce((sum, c) => sum + MOCK_BALANCES[c].balance * CRYPTO_PRICES[c], 0)

  return (
    <div className="fade-in">
      <h1 className="section-title" style={{ marginBottom: 24 }}>My Wallet</h1>

      {/* Portfolio Total */}
      <div style={{ background: 'linear-gradient(135deg, rgba(0,212,170,0.12) 0%, rgba(61,142,255,0.1) 100%)', border: '1px solid rgba(0,212,170,0.25)', borderRadius: 16, padding: '28px 32px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>TOTAL PORTFOLIO VALUE</div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 800, color: 'var(--accent)' }}>
            {formatNaira(totalNaira)}
          </div>
          <div style={{ color: 'var(--accent)', fontSize: 13, marginTop: 6 }}>↑ +2.4% today</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/market" className="btn-primary" style={{ padding: '10px 22px', borderRadius: 8, textDecoration: 'none', fontFamily: "'Syne', sans-serif", fontSize: 14 }}>
            Trade Now
          </Link>
        </div>
      </div>

      {/* Crypto Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
        {CRYPTO_LIST.map(crypto => {
          const { balance, locked } = MOCK_BALANCES[crypto]
          const naira = balance * CRYPTO_PRICES[crypto]
          const available = balance - locked
          return (
            <div key={crypto} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 30 }}>{cryptoIcons[crypto]}</span>
                <span style={{ fontSize: 12, color: 'var(--accent)', background: 'rgba(0,212,170,0.1)', padding: '3px 10px', borderRadius: 20 }}>
                  {crypto}
                </span>
              </div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
                {formatCrypto(balance, crypto)}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>{formatNaira(naira)}</div>
              {locked > 0 && (
                <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 12 }}>
                  🔒 {formatCrypto(locked, crypto)} in escrow
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                Available: {formatCrypto(available, crypto)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setDepositCrypto(crypto)} className="btn-primary"
                  style={{ flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 13 }}>
                  Deposit
                </button>
                <button onClick={() => setWithdrawCrypto(crypto)} className="btn-ghost"
                  style={{ flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 13 }}>
                  Withdraw
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Transaction History */}
      <div>
        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Transaction History</div>
        {MOCK_TXNS.length === 0 ? (
          <EmptyState icon="📋" title="No transactions yet" message="Your trade and deposit history will appear here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MOCK_TXNS.map(tx => {
              const isIncoming = tx.amount > 0
              const typeLabels = { deposit: 'Deposit', withdrawal: 'Withdrawal', trade_buy: 'Trade Buy', trade_sell: 'Trade Sell' }
              return (
                <div key={tx.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      background: isIncoming ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,109,0.1)',
                    }}>
                      {isIncoming ? '↓' : '↑'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{typeLabels[tx.type]}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{timeAgo(tx.date)} · {tx.crypto}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: isIncoming ? 'var(--accent)' : 'var(--danger)' }}>
                        {isIncoming ? '+' : ''}{formatCrypto(Math.abs(tx.amount), tx.crypto)}
                      </div>
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <DepositModal crypto={depositCrypto} onClose={() => setDepositCrypto(null)} />
      <WithdrawModal crypto={withdrawCrypto} balance={withdrawCrypto ? MOCK_BALANCES[withdrawCrypto].balance : 0} onClose={() => setWithdrawCrypto(null)} />
    </div>
  )
}
