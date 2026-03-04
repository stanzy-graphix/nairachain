'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Button, Card, Badge, Stars, Spinner, EmptyState } from '@/components/ui'
import { offersAPI } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { formatNaira, cryptoIcon } from '@/lib/utils'
import toast from 'react-hot-toast'
import CreateOfferModal from './CreateOfferModal'

function MarketContent() {
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCrypto, setFilterCrypto] = useState(searchParams.get('crypto') || 'ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)

  const loadOffers = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (filterCrypto !== 'ALL') params.crypto = filterCrypto
      if (filterType !== 'ALL') params.type = filterType
      const { data } = await offersAPI.list(params)
      setOffers(data.offers)
    } catch {
      toast.error('Failed to load offers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOffers() }, [filterCrypto, filterType])

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10 fade-in">
        <div className="flex justify-between items-start mb-7">
          <div>
            <h1 className="font-display font-black text-3xl">P2P Marketplace</h1>
            <p className="text-muted text-sm mt-1">{offers.length} active offers</p>
          </div>
          {user && <Button onClick={() => setShowCreate(true)}>+ Create Offer</Button>}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap mb-7">
          <div className="flex gap-1.5">
            {['ALL', 'USDT', 'BTC', 'ETH'].map(c => (
              <button key={c} onClick={() => setFilterCrypto(c)}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${filterCrypto === c ? 'bg-accent-dim border-accent text-accent' : 'bg-card border-border text-muted hover:text-accent'}`}>
                {c !== 'ALL' ? cryptoIcon[c] + ' ' : ''}{c}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {[['ALL', 'All Types'], ['buy', 'Buy Offers'], ['sell', 'Sell Offers']].map(([v, l]) => (
              <button key={v} onClick={() => setFilterType(v)}
                className={`px-4 py-2 rounded-lg text-sm border transition-colors ${filterType === v ? 'bg-accent-dim border-accent text-accent' : 'bg-card border-border text-muted hover:text-accent'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1.5fr_1fr_100px] gap-3 px-4 mb-2 text-xs text-muted font-semibold uppercase tracking-wider">
          <span>TRADER</span><span>TYPE</span><span>CRYPTO</span><span>RATE</span><span>LIMITS</span><span>PAYMENT</span><span></span>
        </div>

        {loading ? <Spinner /> : offers.length === 0 ? (
          <EmptyState icon="📭" title="No offers found" description="No offers match your filters. Try changing the crypto or type." />
        ) : (
          <div className="flex flex-col gap-2">
            {offers.map(offer => (
              <Card key={offer.id} className="p-4 hover:border-accent/30 hover:-translate-y-0.5 transition-all">
                <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1.5fr_1fr_100px] gap-3 items-center">
                  {/* Trader */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue to-accent flex items-center justify-center text-black font-bold text-sm shrink-0">
                      {offer.trader_name?.[0] || '?'}
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        {offer.trader_name}
                        {offer.is_online && <span className="w-2 h-2 rounded-full bg-accent pulse-dot inline-block" />}
                      </div>
                      <Stars rating={parseFloat(offer.trader_rating) || 0} />
                      <span className="text-xs text-muted">{offer.trader_trades} trades</span>
                    </div>
                  </div>

                  {/* Type */}
                  <div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded ${offer.type === 'sell' ? 'bg-danger/10 text-danger' : 'bg-accent-dim text-accent'}`}>
                      {offer.type.toUpperCase()}
                    </span>
                  </div>

                  {/* Crypto */}
                  <div className="font-semibold">{cryptoIcon[offer.crypto]} {offer.crypto}</div>

                  {/* Rate */}
                  <div>
                    <div className="font-display font-bold text-accent text-base">{formatNaira(offer.price_per_unit)}</div>
                    <div className="text-xs text-muted">per {offer.crypto}</div>
                  </div>

                  {/* Limits */}
                  <div className="text-xs text-muted">
                    {formatNaira(offer.min_amount)} – {formatNaira(offer.max_amount)}
                  </div>

                  {/* Payment */}
                  <div className="text-xs text-muted">🏦 {offer.payment_method}</div>

                  {/* Action */}
                  <Link href={`/trades/new?offer=${offer.id}`}>
                    <Button variant={offer.type === 'sell' ? 'primary' : 'outline'} className="w-full text-xs py-2">
                      {offer.type === 'sell' ? 'Buy' : 'Sell'}
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {showCreate && <CreateOfferModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadOffers(); }} />}
    </div>
  )
}

export default function MarketPage() {
  return <Suspense fallback={<Spinner />}><MarketContent /></Suspense>
}
