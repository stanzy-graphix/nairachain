import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'
import { StatusBadge, Stars, Modal, EmptyState } from '../../components/UI'
import { formatNaira, formatCrypto, CRYPTO_LIST, timeAgo } from '../../lib/utils'
import { offersAPI } from '../../lib/api'
import { toast } from 'react-toastify'

// Mock data (replace with real API calls via useEffect)
const MOCK_OFFERS = [
  { id: 1, user: { name: 'ChukwuTrader', rating: 4.9, trades: 312 }, type: 'sell', crypto: 'USDT', price: 1520, min: 5000, max: 500000, payment: 'Bank Transfer', online: true, createdAt: new Date(Date.now()-300000) },
  { id: 2, user: { name: 'AbiodunFX', rating: 4.7, trades: 89 },     type: 'sell', crypto: 'BTC',  price: 98500000, min: 50000, max: 5000000, payment: 'Bank Transfer', online: true, createdAt: new Date(Date.now()-600000) },
  { id: 3, user: { name: 'NgoziBuyer', rating: 4.8, trades: 156 },   type: 'buy',  crypto: 'USDT', price: 1490, min: 10000, max: 200000, payment: 'Bank Transfer', online: false, createdAt: new Date(Date.now()-900000) },
  { id: 4, user: { name: 'EmekaCrypto', rating: 5.0, trades: 44 },   type: 'sell', crypto: 'ETH',  price: 5200000, min: 20000, max: 2000000, payment: 'Bank Transfer', online: true, createdAt: new Date(Date.now()-120000) },
  { id: 5, user: { name: 'FatimaExch', rating: 4.6, trades: 203 },   type: 'buy',  crypto: 'BTC',  price: 96000000, min: 100000, max: 10000000, payment: 'Bank Transfer', online: true, createdAt: new Date(Date.now()-180000) },
  { id: 6, user: { name: 'KelechiP2P', rating: 4.9, trades: 520 },   type: 'sell', crypto: 'USDT', price: 1535, min: 1000, max: 300000, payment: 'Bank Transfer', online: false, createdAt: new Date(Date.now()-3600000) },
  { id: 7, user: { name: 'TobiTrades', rating: 4.8, trades: 78 },    type: 'buy',  crypto: 'ETH',  price: 5050000, min: 50000, max: 1000000, payment: 'Bank Transfer', online: true, createdAt: new Date(Date.now()-240000) },
]

function CreateOfferModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ type: 'sell', crypto: 'USDT', price: '', min: '', max: '', payment: 'Bank Transfer' })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.price || !form.min || !form.max) return toast.error('All fields required')
    if (Number(form.min) >= Number(form.max)) return toast.error('Max must be greater than min')
    setLoading(true)
    try {
      // await offersAPI.create(form) — connect to real API
      toast.success('Offer published successfully!')
      onClose()
      onCreated?.()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create offer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create New Offer">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label className="label">Offer Type</label>
          <select value={form.type} onChange={set('type')} className="input-field">
            <option value="sell">Sell</option>
            <option value="buy">Buy</option>
          </select>
        </div>
        <div>
          <label className="label">Cryptocurrency</label>
          <select value={form.crypto} onChange={set('crypto')} className="input-field">
            {CRYPTO_LIST.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="label">Price per Unit (₦)</label>
        <input type="number" placeholder="e.g. 1520" value={form.price} onChange={set('price')} className="input-field" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label className="label">Min Amount (₦)</label>
          <input type="number" placeholder="5000" value={form.min} onChange={set('min')} className="input-field" />
        </div>
        <div>
          <label className="label">Max Amount (₦)</label>
          <input type="number" placeholder="500000" value={form.max} onChange={set('max')} className="input-field" />
        </div>
      </div>
      <div style={{ marginBottom: 22 }}>
        <label className="label">Payment Method</label>
        <select value={form.payment} onChange={set('payment')} className="input-field">
          <option>Bank Transfer</option>
          <option>Opay</option>
          <option>Palmpay</option>
          <option>Kuda</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: 12, borderRadius: 8, fontSize: 14 }}>Cancel</button>
        <button onClick={submit} disabled={loading} className="btn-primary" style={{ flex: 1, padding: 12, borderRadius: 8, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>
          {loading ? 'Publishing...' : 'Publish Offer'}
        </button>
      </div>
    </Modal>
  )
}

export default function MarketPage() {
  const { isLoggedIn } = useAuth()
  const router = useRouter()
  const [filterCrypto, setFilterCrypto] = useState('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = MOCK_OFFERS.filter(o => {
    if (filterCrypto !== 'ALL' && o.crypto !== filterCrypto) return false
    if (filterType !== 'ALL' && o.type !== filterType) return false
    return true
  })

  const handleTrade = (offer) => {
    if (!isLoggedIn) { router.push('/auth/login'); return }
    router.push(`/market/trade/${offer.id}`)
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="section-title">P2P Marketplace</h1>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{filtered.length} active offers</div>
        </div>
        {isLoggedIn && (
          <button onClick={() => setShowCreate(true)} className="btn-primary"
            style={{ padding: '10px 22px', borderRadius: 8, fontSize: 14, fontFamily: "'Syne', sans-serif" }}>
            + Create Offer
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['ALL', ...CRYPTO_LIST].map(c => (
            <button key={c} onClick={() => setFilterCrypto(c)}
              style={{
                background: filterCrypto === c ? 'rgba(0,212,170,0.1)' : 'var(--card)',
                color: filterCrypto === c ? 'var(--accent)' : 'var(--muted)',
                border: `1px solid ${filterCrypto === c ? 'rgba(0,212,170,0.4)' : 'var(--border)'}`,
                padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
              }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['ALL', 'All Offers'], ['sell', 'Sell Offers'], ['buy', 'Buy Offers']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterType(v)}
              style={{
                background: filterType === v ? 'rgba(0,212,170,0.1)' : 'var(--card)',
                color: filterType === v ? 'var(--accent)' : 'var(--muted)',
                border: `1px solid ${filterType === v ? 'rgba(0,212,170,0.4)' : 'var(--border)'}`,
                padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
              }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.7fr 1.4fr 1.5fr 1fr 0.8fr',
        gap: 12, padding: '10px 20px', color: 'var(--muted)',
        fontSize: 11, letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase',
      }}>
        <span>Trader</span><span>Type</span><span>Coin</span>
        <span>Rate / Unit</span><span>Limits (₦)</span>
        <span>Payment</span><span></span>
      </div>

      {/* Offers */}
      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="No offers found" message="Try changing your filters" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(offer => (
            <div key={offer.id} className="card-hover" style={{
              background: 'var(--card)', borderRadius: 10, padding: '16px 20px',
              display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.7fr 1.4fr 1.5fr 1fr 0.8fr',
              gap: 12, alignItems: 'center',
            }}>
              {/* Trader */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--blue), var(--accent))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, color: '#000', fontSize: 14,
                }}>
                  {offer.user.name[0]}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {offer.user.name}
                    {offer.online && (
                      <span className="pulse" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Stars rating={offer.user.rating} size={11} />
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>{offer.user.trades} trades</span>
                  </div>
                </div>
              </div>

              {/* Type */}
              <span style={{
                color: offer.type === 'sell' ? 'var(--danger)' : 'var(--accent)',
                background: offer.type === 'sell' ? 'rgba(255,77,109,0.1)' : 'rgba(0,212,170,0.1)',
                padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              }}>
                {offer.type}
              </span>

              {/* Crypto */}
              <div style={{ fontWeight: 600 }}>{offer.crypto}</div>

              {/* Price */}
              <div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>
                  {formatNaira(offer.price)}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>per {offer.crypto}</div>
              </div>

              {/* Limits */}
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {formatNaira(offer.min)} – {formatNaira(offer.max)}
              </div>

              {/* Payment */}
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>🏦 {offer.payment}</div>

              {/* Action */}
              <button onClick={() => handleTrade(offer)}
                style={{
                  background: offer.type === 'sell' ? 'var(--accent)' : 'var(--blue)',
                  color: '#000', border: 'none', padding: '8px 16px',
                  borderRadius: 6, fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
                }}>
                {offer.type === 'sell' ? 'Buy' : 'Sell'}
              </button>
            </div>
          ))}
        </div>
      )}

      <CreateOfferModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => {}} />
    </div>
  )
}
