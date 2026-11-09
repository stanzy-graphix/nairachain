'use client'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Button, Card } from '@/components/ui'
import { formatNaira, CRYPTOS, cryptoIcon, cryptoName } from '@/lib/utils'
import { usePrices } from '@/lib/usePrices'
import { useAuthStore } from '@/lib/store'

const highlights = [
  { value: '0.5%', label: 'Flat trading fee' },
  { value: '30 min', label: 'Escrow payment window' },
  { value: '100%', label: 'Trades escrow-backed' },
  { value: 'BTC · ETH · USDT', label: 'Supported assets' },
]

const features = [
  { icon: '🔒', title: 'Escrow Protected', desc: "The seller's crypto is locked in escrow the moment a trade opens, and only released once they confirm your Naira arrived." },
  { icon: '⚡', title: 'Fast Settlement', desc: 'Pay by bank transfer, tap "I have paid", and receive crypto as soon as the seller confirms — usually minutes.' },
  { icon: '🛡', title: 'Dispute Resolution', desc: 'If something goes wrong, open a dispute. Escrow stays frozen until an admin reviews the chat and evidence.' },
]

const steps = [
  { label: 'Browse Offers', icon: '🔍' },
  { label: 'Escrow Locks Crypto', icon: '🔒' },
  { label: 'Send Naira', icon: '💸' },
  { label: 'Seller Confirms', icon: '✅' },
]

export default function HomePage() {
  const { prices, source } = usePrices()
  const user = useAuthStore((s) => s.user)

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12">
        {/* Hero */}
        <div className="text-center py-12 md:py-16 relative">
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-radial from-accent/5 to-transparent pointer-events-none" />
          <p className="text-xs text-accent tracking-[0.3em] font-semibold uppercase mb-5">Peer-to-peer · Escrow-protected</p>
          <h1 className="font-display font-black text-4xl md:text-6xl leading-tight tracking-tight mb-6">
            Trade Crypto for<br /><span className="text-accent">Naira. Safely.</span>
          </h1>
          <p className="text-muted text-base max-w-lg mx-auto mb-10 leading-relaxed">
            Buy & sell Bitcoin, USDT, and Ethereum directly with other Nigerians. Every trade is backed by escrow.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/market"><Button className="glow-accent px-8 py-3 text-base">Start Trading →</Button></Link>
            {!user && <Link href="/auth/register"><Button variant="ghost" className="px-8 py-3 text-base">Create Account</Button></Link>}
          </div>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {highlights.map(({ value, label }) => (
            <Card key={label} className="p-6 text-center">
              <div className="font-display font-black text-2xl md:text-3xl text-accent mb-1">{value}</div>
              <div className="text-muted text-xs">{label}</div>
            </Card>
          ))}
        </div>

        {/* Market rates */}
        <Card className="p-6 md:p-7 mb-8">
          <div className="flex justify-between items-baseline mb-5">
            <div className="font-display font-bold text-lg">Market Rates</div>
            <div className="text-xs text-muted">{source === 'coingecko' ? 'Live · CoinGecko' : 'Indicative'}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CRYPTOS.map((sym) => {
              const { price, change24h } = prices[sym]
              return (
                <div key={sym} className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-3xl">{cryptoIcon[sym]}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${change24h >= 0 ? 'text-accent bg-accent-dim border-accent/20' : 'text-danger bg-danger/10 border-danger/20'}`}>
                      {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                    </span>
                  </div>
                  <div className="font-display font-bold text-xl mb-1">{formatNaira(price)}</div>
                  <div className="text-muted text-xs">{cryptoName[sym]} ({sym})</div>
                  <div className="mt-4">
                    <Link href={`/market?crypto=${sym}`}><Button variant="ghost" className="w-full text-xs py-2">Trade {sym}</Button></Link>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {features.map(({ icon, title, desc }) => (
            <Card key={title} className="p-6">
              <div className="text-3xl mb-3">{icon}</div>
              <div className="font-display font-bold mb-2">{title}</div>
              <p className="text-muted text-sm leading-relaxed">{desc}</p>
            </Card>
          ))}
        </div>

        {/* How it works */}
        <Card className="p-8">
          <div className="font-display font-bold text-xl mb-7 text-center">How It Works</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.label} className="text-center">
                <div className="w-12 h-12 bg-accent-dim border border-accent/20 rounded-xl flex items-center justify-center text-2xl mx-auto mb-2">{s.icon}</div>
                <div className="text-xs text-muted mb-0.5">Step {i + 1}</div>
                <div className="font-display font-semibold text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  )
}
