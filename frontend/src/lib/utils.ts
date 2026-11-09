export const CRYPTOS = ['USDT', 'BTC', 'ETH'] as const

export const formatNaira = (n: number | string) =>
  '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

const DECIMALS: Record<string, number> = { USDT: 2, BTC: 6, ETH: 4 }

export const formatCrypto = (n: number | string, crypto: string) => {
  const v = Number(n || 0)
  const d = DECIMALS[crypto] ?? 6
  // Show more precision for tiny amounts so they don't render as 0
  const digits = v !== 0 && Math.abs(v) < Math.pow(10, -d) ? 8 : d
  return `${v.toLocaleString('en-US', { minimumFractionDigits: Math.min(d, 2), maximumFractionDigits: digits })} ${crypto}`
}

export const cryptoIcon: Record<string, string> = { BTC: '🟠', ETH: '🔵', USDT: '🟢' }
export const cryptoName: Record<string, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether' }

export const statusColor: Record<string, string> = {
  completed: '#00D4AA', pending_payment: '#3D8EFF', payment_sent: '#F5A623', confirming: '#F5A623',
  disputed: '#FF4D6D', cancelled: '#64748B', open: '#00D4AA', paused: '#F5A623', closed: '#64748B',
  pending: '#F5A623', failed: '#FF4D6D', verified: '#00D4AA', rejected: '#FF4D6D', frozen: '#FF4D6D', active: '#00D4AA',
}

export const statusLabel: Record<string, string> = {
  completed: 'Completed', pending_payment: 'Pending Payment', payment_sent: 'Payment Sent', confirming: 'Confirming',
  disputed: 'Disputed', cancelled: 'Cancelled', open: 'Open', paused: 'Paused', closed: 'Closed',
  pending: 'Pending', failed: 'Failed', verified: 'Verified', rejected: 'Rejected', frozen: 'Frozen', active: 'Active',
}

export const txLabel: Record<string, string> = {
  deposit: 'Deposit', withdrawal: 'Withdrawal', trade_buy: 'Bought', trade_sell: 'Sold', fee: 'Fee',
  escrow_lock: 'Escrow Locked', escrow_release: 'Escrow Released', escrow_return: 'Escrow Returned',
}

/** Whether a transaction type adds to the user's available balance. */
export const txIsCredit = (type: string) => ['deposit', 'trade_buy', 'escrow_return'].includes(type)

export const truncate = (str: string, n = 12) => (str.length > n ? str.slice(0, n) + '…' : str)

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const formatTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
