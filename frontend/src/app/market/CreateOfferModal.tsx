'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button, Input, Select, Textarea, Modal } from '@/components/ui'
import { offersAPI, apiError } from '@/lib/api'
import { usePrices } from '@/lib/usePrices'
import { formatNaira } from '@/lib/utils'

export default function CreateOfferModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { prices } = usePrices()
  const [form, setForm] = useState({
    type: 'sell', crypto: 'USDT', pricePerUnit: '', minAmount: '', maxAmount: '',
    paymentMethod: 'Bank Transfer', bankName: '', bankAccountName: '', bankAccountNumber: '', terms: '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value })
  const market = prices[form.crypto]?.price
  const diff = market && form.pricePerUnit ? ((Number(form.pricePerUnit) - market) / market) * 100 : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await offersAPI.create(form)
      toast.success('Offer published!')
      onCreated()
    } catch (err) {
      toast.error(apiError(err, 'Failed to create offer'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Create New Offer" onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="I want to" value={form.type} onChange={set('type')}>
            <option value="sell">SELL Crypto</option>
            <option value="buy">BUY Crypto</option>
          </Select>
          <Select label="Crypto" value={form.crypto} onChange={set('crypto')}>
            <option value="USDT">USDT</option>
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </Select>
        </div>
        <div>
          <Input label="My Price per Unit (₦)" type="number" step="any" min="1" placeholder={market ? String(Math.round(market)) : ''} value={form.pricePerUnit} onChange={set('pricePerUnit')} required />
          <p className="text-xs text-muted mt-1">
            Market: {formatNaira(market)}
            {diff !== null && <span className={diff >= 0 ? 'text-accent' : 'text-danger'}> · {diff >= 0 ? '+' : ''}{diff.toFixed(2)}% vs market</span>}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Min Amount (₦)" type="number" min="100" placeholder="5000" value={form.minAmount} onChange={set('minAmount')} required />
          <Input label="Max Amount (₦)" type="number" min="100" placeholder="500000" value={form.maxAmount} onChange={set('maxAmount')} required />
        </div>
        <Input label="Payment Method" value={form.paymentMethod} onChange={set('paymentMethod')} placeholder="Bank Transfer" />

        {form.type === 'sell' ? (
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted mb-3 font-semibold uppercase tracking-wider">Your bank details (buyers pay you here)</p>
            <div className="flex flex-col gap-3">
              <Input label="Bank Name" placeholder="GTBank" value={form.bankName} onChange={set('bankName')} required />
              <Input label="Account Name" placeholder="Your full name" value={form.bankAccountName} onChange={set('bankAccountName')} required />
              <Input label="Account Number" inputMode="numeric" pattern="\d{10}" title="10-digit NUBAN" placeholder="0123456789" value={form.bankAccountNumber} onChange={set('bankAccountNumber')} required />
            </div>
            <p className="text-xs text-muted mt-3">Crypto is locked from your wallet into escrow each time a buyer opens a trade.</p>
          </div>
        ) : (
          <p className="text-xs text-muted border-t border-border pt-4">Sellers who take this offer will share their bank details, and their crypto is locked in escrow before you pay.</p>
        )}

        <Textarea label="Terms (optional)" rows={2} maxLength={500} placeholder="e.g. Only first-party transfers. Online 9am–9pm." value={form.terms} onChange={set('terms')} />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" loading={loading} className="flex-1">Publish Offer</Button>
        </div>
      </form>
    </Modal>
  )
}
