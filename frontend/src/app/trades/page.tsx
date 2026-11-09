'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import AuthGuard from '@/components/AuthGuard'
import { Button, Card, Badge, Spinner, EmptyState } from '@/components/ui'
import { tradesAPI, apiError } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { formatNaira, formatCrypto, formatDate, cryptoIcon } from '@/lib/utils'

const FILTERS = [['ALL', 'All'], ['pending_payment', 'Pending'], ['payment_sent', 'Awaiting Confirm'], ['completed', 'Completed'], ['disputed', 'Disputed'], ['cancelled', 'Cancelled']]

function Trades() {
  const user = useAuthStore((s) => s.user)!
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

  useEffect(() => {
    setLoading(true)
    tradesAPI.list(filter !== 'ALL' ? { status: filter, limit: 100 } : { limit: 100 })
      .then(({ data }) => setTrades(data.trades))
      .catch((err) => toast.error(apiError(err, 'Failed to load trades')))
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-10 fade-in">
        <h1 className="font-display font-black text-3xl mb-6">My Trades</h1>

        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTERS.map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${filter === v ? 'bg-accent-dim border-accent text-accent' : 'bg-card border-border text-muted hover:text-accent'}`}>
              {l}
            </button>
          ))}
        </div>

        {loading ? <Spinner /> : trades.length === 0 ? (
          <EmptyState icon="📋" title="No trades here" description="Start trading by browsing the marketplace."
            action={<Link href="/market"><Button>Browse Market</Button></Link>} />
        ) : (
          <div className="flex flex-col gap-3">
            {trades.map((trade) => {
              const isBuyer = trade.buyer_id === user.id
              const counterparty = isBuyer ? trade.seller_name : trade.buyer_name
              return (
                <Link key={trade.id} href={`/trades/${trade.trade_ref}`}>
                  <Card className="p-5 hover:border-accent/30 hover:-translate-y-0.5 transition-all cursor-pointer">
                    <div className="flex justify-between items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${isBuyer ? 'bg-accent-dim' : 'bg-danger/10'}`}>
                          {cryptoIcon[trade.crypto]}
                        </div>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                            <span className={isBuyer ? 'text-accent' : 'text-danger'}>{isBuyer ? 'BUY' : 'SELL'}</span>
                            {trade.trade_ref}
                            <span className="text-xs text-muted">with {counterparty}</span>
                          </div>
                          <div className="text-muted text-xs mt-0.5">{formatDate(trade.created_at)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="text-right">
                          <div className="font-display font-bold">{formatCrypto(trade.crypto_amount, trade.crypto)}</div>
                          <div className="text-muted text-xs">{formatNaira(trade.naira_amount)}</div>
                        </div>
                        <Badge status={trade.status} />
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default function TradesPage() {
  return <AuthGuard><Trades /></AuthGuard>
}
