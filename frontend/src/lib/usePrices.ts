'use client'
import { useEffect } from 'react'
import { create } from 'zustand'
import { pricesAPI } from './api'

export type Prices = Record<string, { price: number; change24h: number }>

// Used until the API answers (and if it can't be reached)
export const DEFAULT_PRICES: Prices = {
  BTC: { price: 98500000, change24h: 0 },
  ETH: { price: 5200000, change24h: 0 },
  USDT: { price: 1520, change24h: 0 },
}

interface PriceStore {
  prices: Prices
  source: string
  loaded: boolean
  lastFetch: number
  fetch: () => Promise<void>
}

const usePriceStore = create<PriceStore>((set, get) => ({
  prices: DEFAULT_PRICES,
  source: 'fallback',
  loaded: false,
  lastFetch: 0,
  fetch: async () => {
    if (Date.now() - get().lastFetch < 30_000) return
    set({ lastFetch: Date.now() })
    try {
      const { data } = await pricesAPI.get()
      set({ prices: data.prices, source: data.source, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
}))

/** Live NGN prices, shared across components and refreshed every minute. */
export const usePrices = () => {
  const state = usePriceStore()
  useEffect(() => {
    state.fetch()
    const t = setInterval(() => usePriceStore.getState().fetch(), 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}
