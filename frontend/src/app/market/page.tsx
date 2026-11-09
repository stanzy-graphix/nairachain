'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import { Button, Card, Badge, Stars, Spinner, EmptyState } from '@/components/ui'
import { offersAPI, apiError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { formatNaira, cryptoIcon } from '@/lib/utils'
import CreateOfferModal from './CreateOfferModal'

const pill = (active: boolean) =>
  `px-4 py-2 rounded-lg text-sm border transition-colors ${active ? 'bg-accent-dim border-accent text-accent' : 'bg-card border-border text-muted hover:text-accent'}`

function MyOffers({ reloadKey }: { reloadKey: number }) {
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    offersAPI.myOffers().then(({ data }) => setOffers(data.offers)).catch(() => toast.error('Failed to load your offers')).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load, reloadKey])

  const update = async (id: string, status: string) => {
    if (status === 'closed' && !confirm('Close this offer permanently?')) return
    try {
      await offersAPI.updateStatus(id, status)
      toast.success(`Offer ${status === 'open' ? 'reopened' : status}`)
      load()
    } catch (err) { toast.error(apiError(err)) }
  }

  if (loading) return <Spinner />
  if (!offers.length) return <EmptyState icon="📝" title="No offers yet" description="Create an offer to let other traders come to you." />

  return (
    <div className="flex flex-col gap-2">
      {offers.map((o) => (
        <Card key={o.id} className="p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded ${o.type === 'sell' ? 'bg-danger/10 text-danger' : 'bg-accent-dim text-accent'}`}>{o.type.toUpperCase()}</span>
            <span className="font-semibold">{cryptoIcon[o.crypto]} {o.crypto}</span>
            <span className="font-display font-bold text-accent">{formatNaira(o.price_per_unit)}</span>
            <span className="text-xs text-muted">{formatNaira(o.min_amount)} – {formatNaira(o.max_amount)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">{o.total_trades} trades{o.active_trades ? ` · ${o.active_trades} active` : ''}</span>
            <Badge status={o.status} />
            {o.status === 'open' && <Button variant="ghost" className="text-xs py-1.5 px-3" onClick={() => update(o.id, 'paused')}>Pause</Button>}
            {o.status === 'paused' && <Button variant="outline" className="text-xs py-1.5 px-3" onClick={() => update(o.id, 'open')}>Reopen</Button>}
            <Button variant="ghost" className="text-xs py-1.5 px-3 hover:!text-danger hover:!border-danger" onClick={() => update(o.id, 'closed')}>Close</Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

function MarketContent() {
  const searchParams = useSearchParams()
  const { user } = useAuthStore()
  const [offers, setOffers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'market' | 'mine'>('market')
  const [filterCrypto, setFilterCrypto] = useState(searchParams?.get('crypto') || 'ALL')
  // "buy" tab shows sell offers (people selling to you), and vice versa
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [showCreate, setShowCreate] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const loadOffers = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { type: side === 'buy' ? 'sell' : 'buy', sort: side === 'buy' ? 'price_asc' : 'price_desc' }
      if (filterCrypto !== 'ALL') params.crypto = filterCrypto
      const { data } = await offersAPI.list(params)
      setOffers(data.offers)
    } catch (err) {
      toast.error(apiError(err, 'Failed to load offers'))
    } finally {
      setLoading(false)
    }
  }, [filterCrypto, side])

  useEffect(() => { loadOffers() }, [loadOffers])

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 fade-in">
        <div className="flex justify-between items-start mb-7 gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-black text-3xl">P2P Marketplace</h1>
            <p className="text-muted text-sm mt-1">{view === 'market' ? `${offers.length} active offers` : 'Manage your offers'}</p>
          </div>
          {user && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setView(view === 'market' ? 'mine' : 'market')}>{view === 'market' ? 'My Offers' : '← Marketplace'}</Button>
              <Button onClick={() => setShowCreate(true)}>+ Create Offer</Button>
            </div>
          )}
        </div>

        {view === 'mine' ? <MyOffers reloadKey={reloadKey} /> : (
          <>
            <div className="flex gap-3 flex-wrap mb-7">
              <div className="flex gap-1.5">
                <button onClick={() => setSide('buy')} className={pill(side === 'buy')}>Buy Crypto</button>
                <button onClick={() => setSide('sell')} className={pill(side === 'sell')}>Sell Crypto</button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['ALL', 'USDT', 'BTC', 'ETH'].map((c) => (
                  <button key={c} onClick={() => setFilterCrypto(c)} className={pill(filterCrypto === c)}>
                    {c !== 'ALL' ? cryptoIcon[c] + ' ' : ''}{c}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden lg:grid grid-cols-[2fr_1.2fr_1.5fr_1.8fr_1.2fr_110px] gap-3 px-4 mb-2 text-xs text-muted font-semibold uppercase tracking-wider">
              <span>Trader</span><span>Crypto</span><span>Rate</span><span>Limits</span><span>Payment</span><span></span>
            </div>

            {loading ? <Spinner /> : offers.length === 0 ? (
              <EmptyState icon="📭" title="No offers found"
                description={`No one is ${side === 'buy' ? 'selling' : 'buying'} ${filterCrypto === 'ALL' ? 'crypto' : filterCrypto} right now.`}
                action={user ? <Button onClick={() => setShowCreate(true)}>Create the first offer</Button> : undefined} />
            ) : (
              <div className="flex flex-col gap-2">
                {offers.map((offer) => {
                  const own = user?.id === offer.user_id
                  return (
                    <Card key={offer.id} className="p-4 hover:border-accent/30 transition-all">
                      <div className="grid grid-cols-2 lg:grid-cols-[2fr_1.2fr_1.5fr_1.8fr_1.2fr_110px] gap-3 items-center">
                        <div className="flex items-center gap-3 col-span-2 lg:col-span-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue to-accent flex items-center justify-center text-black font-bold text-sm shrink-0">
                            {offer.trader_name?.[0] || '?'}
                          </div>
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-1.5">
                              {offer.trader_name}
                              {offer.trader_kyc === 'verified' && <span title="KYC verified" className="text-accent text-xs">✔</span>}
                              {offer.is_online && <span title="Online" className="w-2 h-2 rounded-full bg-accent pulse-dot inline-block" />}
                            </div>
                            <Stars rating={parseFloat(offer.trader_rating)} />
                            <span className="text-xs text-muted ml-2">{offer.trader_trades} trades</span>
                          </div>
                        </div>
                        <div className="font-semibold">{cryptoIcon[offer.crypto]} {offer.crypto}</div>
                        <div>
                          <div className="font-display font-bold text-accent text-base">{formatNaira(offer.price_per_unit)}</div>
                          <div className="text-xs text-muted">per {offer.crypto}</div>
                        </div>
                        <div className="text-xs text-muted">{formatNaira(offer.min_amount)} – {formatNaira(offer.max_amount)}</div>
                        <div className="text-xs text-muted">🏦 {offer.payment_method}</div>
                        <div className="col-span-2 lg:col-span-1">
                          {own ? (
                            <span className="block text-center text-xs text-muted">Your offer</span>
                          ) : (
                            <Link href={user ? `/trades/new?offer=${offer.id}` : `/auth/login?next=${encodeURIComponent(`/trades/new?offer=${offer.id}`)}`}>
                              <Button variant={offer.type === 'sell' ? 'primary' : 'outline'} className="w-full text-xs py-2">
                                {offer.type === 'sell' ? 'Buy' : 'Sell'} {offer.crypto}
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                      {offer.terms && <p className="text-xs text-muted mt-3 pt-3 border-t border-border/50">📝 {offer.terms}</p>}
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      {showCreate && (
        <CreateOfferModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadOffers(); setReloadKey((k) => k + 1) }} />
      )}
    </div>
  )
}

export default function MarketPage() {
  return <Suspense fallback={<Spinner />}><MarketContent /></Suspense>
}
