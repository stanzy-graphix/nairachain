'use client'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Button, Card } from '@/components/ui'
import { formatNaira } from '@/lib/utils'

const stats = [
  { value: '₦2.4B+', label: 'Volume (24h)' },
  { value: '18,400+', label: 'Active Traders' },
  { value: '99.2%', label: 'Escrow Success' },
  { value: '< 15min', label: 'Avg Trade Time' },
]

const marketRates = [
  { name: 'Bitcoin', sym: 'BTC', price: 98500000, chg: 2.4, icon: '🟠' },
  { name: 'Ethereum', sym: 'ETH', price: 5200000, chg: 1.1, icon: '🔵' },
  { name: 'Tether', sym: 'USDT', price: 1520, chg: 0.3, icon: '🟢' },
]

const features = [
  { icon: '🔒', title: 'Escrow Protected', desc: 'Crypto is locked in escrow until the seller confirms your Naira payment. Zero scam risk.' },
  { icon: '⚡', title: 'Fast Settlement', desc: 'Most trades complete in under 15 minutes — fastest P2P in Nigeria.' },
  { icon: '🇳🇬', title: 'Built for Nigeria', desc: 'Buy airtime, data, pay bills and fund your bet wallet directly from your crypto balance.' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="text-center py-16 relative">
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-radial from-accent/5 to-transparent pointer-events-none" />
          <p className="text-xs text-accent tracking-[0.3em] font-semibold uppercase mb-5">Nigeria's #1 P2P Crypto Exchange</p>
          <h1 className="font-display font-black text-5xl md:text-6xl leading-tight tracking-tight mb-6">
            Trade Crypto for<br /><span className="text-accent">Naira. Instantly.</span>
          </h1>
          <p className="text-muted text-base max-w-lg mx-auto mb-10 leading-relaxed">
            Buy & sell Bitcoin, USDT, and Ethereum directly with Nigerians. Escrow-protected. Zero bank stress.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/market">
              <Button className="glow-accent px-8 py-3 text-base">Start Trading →</Button>
            </Link>
            <Link href="/auth/register">
              <Button variant="ghost" className="px-8 py-3 text-base">Create Account</Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {stats.map(({ value, label }) => (
            <Card key={label} className="p-6 text-center">
              <div className="font-display font-black text-3xl text-accent mb-1">{value}</div>
              <div className="text-muted text-xs">{label}</div>
            </Card>
          ))}
        </div>

        {/* Market rates */}
        <Card className="p-7 mb-8">
          <div className="font-display font-bold text-lg mb-5">Live Market Rates</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {marketRates.map(({ name, sym, price, chg, icon }) => (
              <div key={sym} className="bg-surface border border-border rounded-xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-3xl">{icon}</span>
                  <span className="text-xs text-accent bg-accent-dim px-2.5 py-1 rounded-full border border-accent/20">+{chg}%</span>
                </div>
                <div className="font-display font-bold text-xl mb-1">{formatNaira(price)}</div>
                <div className="text-muted text-xs">{name} ({sym})</div>
                <div className="mt-4">
                  <Link href={`/market?crypto=${sym}`}>
                    <Button variant="ghost" className="w-full text-xs py-2">Trade {sym}</Button>
                  </Link>
                </div>
              </div>
            ))}
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
            {[
              { step: '1', label: 'Browse Offers', icon: '🔍' },
              { step: '→', label: '', icon: '' },
              { step: '2', label: 'Lock Escrow', icon: '🔒' },
              { step: '→', label: '', icon: '' },
              { step: '3', label: 'Send Naira', icon: '💸' },
            ].map((item, i) => item.icon ? (
              <div key={i} className="text-center">
                <div className="w-12 h-12 bg-accent-dim border border-accent/20 rounded-xl flex items-center justify-center text-2xl mx-auto mb-2">{item.icon}</div>
                <div className="font-display font-semibold text-sm">{item.label}</div>
              </div>
            ) : (
              <div key={i} className="text-center text-muted text-xl hidden md:block">→</div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  )
}
