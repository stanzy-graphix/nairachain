const router = require('express').Router()
const pool   = require('../config/db')
const { auth } = require('../middleware/auth')

// GET /api/wallet/balances
router.get('/balances', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT crypto_type, balance, locked, address FROM wallets WHERE user_id=$1 ORDER BY crypto_type`,
      [req.user.id]
    )
    // Return as object: { USDT: {...}, BTC: {...}, ETH: {...} }
    const balances = {}
    result.rows.forEach(r => {
      balances[r.crypto_type] = {
        balance: Number(r.balance),
        locked:  Number(r.locked),
        available: Number(r.balance) - Number(r.locked),
        address: r.address,
      }
    })
    res.json({ balances })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/wallet/deposit-address/:crypto
router.get('/deposit-address/:crypto', auth, async (req, res) => {
  const { crypto } = req.params
  if (!['USDT', 'BTC', 'ETH'].includes(crypto.toUpperCase())) {
    return res.status(400).json({ message: 'Invalid crypto' })
  }
  try {
    const result = await pool.query(
      `SELECT address FROM wallets WHERE user_id=$1 AND crypto_type=$2`,
      [req.user.id, crypto.toUpperCase()]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Wallet not found' })

    let { address } = result.rows[0]

    // In production: generate a real address via Coinbase Commerce / BitGo / Fireblocks
    // For now we return a mock address if not set
    if (!address) {
      const MOCK = {
        USDT: `TRC20_${req.user.id.slice(0,16).toUpperCase()}`,
        BTC:  `bc1q${req.user.id.replace(/-/g,'').slice(0,28)}`,
        ETH:  `0x${req.user.id.replace(/-/g,'').slice(0,40)}`,
      }
      address = MOCK[crypto.toUpperCase()]
      await pool.query(`UPDATE wallets SET address=$1 WHERE user_id=$2 AND crypto_type=$3`, [address, req.user.id, crypto.toUpperCase()])
    }

    res.json({ crypto, address })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/wallet/withdraw
router.post('/withdraw', auth, async (req, res) => {
  const { crypto, amount, address } = req.body
  if (!crypto || !amount || !address) return res.status(400).json({ message: 'crypto, amount, address required' })
  const amt = Number(amount)
  if (isNaN(amt) || amt <= 0) return res.status(400).json({ message: 'Invalid amount' })

  try {
    const walletRes = await pool.query(
      `SELECT balance, locked FROM wallets WHERE user_id=$1 AND crypto_type=$2`,
      [req.user.id, crypto.toUpperCase()]
    )
    const wallet = walletRes.rows[0]
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' })

    const available = Number(wallet.balance) - Number(wallet.locked)
    if (amt > available) return res.status(400).json({ message: 'Insufficient available balance' })

    // Deduct balance and log transaction
    await pool.query(
      `UPDATE wallets SET balance=balance-$1 WHERE user_id=$2 AND crypto_type=$3`,
      [amt, req.user.id, crypto.toUpperCase()]
    )
    await pool.query(
      `INSERT INTO transactions (user_id,type,crypto,amount,status,address) VALUES ($1,'withdrawal',$2,$3,'pending',$4)`,
      [req.user.id, crypto.toUpperCase(), amt, address]
    )

    // In production: trigger real blockchain withdrawal via Coinbase Commerce / wallet provider

    res.json({ message: `Withdrawal of ${amt} ${crypto} submitted. Processing within 24h.` })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/wallet/transactions
router.get('/transactions', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, tr.id as trade_ref
       FROM transactions t
       LEFT JOIN trades tr ON tr.id = t.trade_id
       WHERE t.user_id=$1
       ORDER BY t.created_at DESC LIMIT 50`,
      [req.user.id]
    )
    res.json({ transactions: result.rows })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
