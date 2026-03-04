export const formatNaira = (n: number | string) =>
  '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const formatCrypto = (n: number | string, crypto: string) => {
  const v = Number(n)
  if (crypto === 'USDT') return v.toFixed(2) + ' USDT'
  if (crypto === 'BTC') return v.toFixed(6) + ' BTC'
  return v.toFixed(4) + ' ETH'
}

export const cryptoIcon: Record<string, string> = { BTC: '🟠', ETH: '🔵', USDT: '🟢' }

export const statusColor: Record<string, string> = {
  completed: '#00D4AA', pending_payment: '#3D8EFF', payment_sent: '#F5A623',
  disputed: '#FF4D6D', cancelled: '#64748B', open: '#00D4AA', paused: '#F5A623', closed: '#64748B',
}

export const statusLabel: Record<string, string> = {
  completed: 'Completed', pending_payment: 'Pending Payment', payment_sent: 'Payment Sent',
  disputed: 'Disputed', cancelled: 'Cancelled', open: 'Open', paused: 'Paused', closed: 'Closed',
}

export const truncate = (str: string, n = 12) => str.length > n ? str.slice(0, n) + '...' : str
