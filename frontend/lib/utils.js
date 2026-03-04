export const formatNaira = (n) =>
  '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export const formatCrypto = (n, crypto) => {
  const num = Number(n)
  if (crypto === 'USDT') return num.toFixed(2) + ' USDT'
  if (crypto === 'BTC')  return num.toFixed(6) + ' BTC'
  if (crypto === 'ETH')  return num.toFixed(4) + ' ETH'
  return num + ' ' + crypto
}

export const cryptoIcons = { BTC: '🟠', ETH: '🔵', USDT: '🟢' }

export const CRYPTO_LIST = ['USDT', 'BTC', 'ETH']

export const truncate = (str, len = 12) =>
  str?.length > len ? str.slice(0, len) + '...' : str

export const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000)
  if (seconds < 60)   return 'just now'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago'
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago'
  return Math.floor(seconds / 86400) + 'd ago'
}

export const statusLabel = (s) => ({
  completed: 'Completed',
  escrow:    'In Escrow',
  pending:   'Pending',
  cancelled: 'Cancelled',
  open:      'Open',
  frozen:    'Frozen',
  disputed:  'Disputed',
  paid:      'Payment Sent',
})[s] || s

export const countdownTimer = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
