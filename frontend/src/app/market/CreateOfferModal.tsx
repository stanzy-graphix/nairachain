'use client'
import { useState } from 'react'
import { Button, Input, Select, Card } from '@/components/ui'
import { offersAPI } from '@/lib/api'
import toast from 'react-hot-toast'

export default function CreateOfferModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    type: 'sell', crypto: 'USDT', pricePerUnit: '', minAmount: '', maxAmount: '',
    bankName: '', bankAccountName: '', bankAccountNumber: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await offersAPI.create(form)
      toast.success('Offer created!')
      onCreated()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create offer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <Card className="p-8 w-full max-w-lg fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-display font-black text-xl">Create New Offer</h2>
          <button onClick={onClose} className="text-muted hover:text-text text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="I want to" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="sell">SELL Crypto</option>
              <option value="buy">BUY Crypto</option>
            </Select>
            <Select label="Crypto" value={form.crypto} onChange={e => setForm({ ...form, crypto: e.target.value })}>
              <option value="USDT">USDT</option>
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
            </Select>
          </div>
          <Input label="My Price per Unit (₦)" type="number" placeholder="e.g. 1520" value={form.pricePerUnit} onChange={e => setForm({ ...form, pricePerUnit: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Amount (₦)" type="number" placeholder="5000" value={form.minAmount} onChange={e => setForm({ ...form, minAmount: e.target.value })} required />
            <Input label="Max Amount (₦)" type="number" placeholder="500000" value={form.maxAmount} onChange={e => setForm({ ...form, maxAmount: e.target.value })} required />
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted mb-3 font-semibold uppercase tracking-wider">Bank Details (for receiving Naira)</p>
            <div className="flex flex-col gap-3">
              <Input label="Bank Name" placeholder="GTBank" value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
              <Input label="Account Name" placeholder="Your full name" value={form.bankAccountName} onChange={e => setForm({ ...form, bankAccountName: e.target.value })} />
              <Input label="Account Number" placeholder="0123456789" value={form.bankAccountNumber} onChange={e => setForm({ ...form, bankAccountNumber: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" loading={loading} className="flex-1">Publish Offer</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
