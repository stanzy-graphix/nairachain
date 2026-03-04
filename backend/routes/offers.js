const router = require('express').Router()
const pool = require('../config/db')
const { auth, kycRequired } = require('../middleware/auth')

// GET /api/offers?crypto=USDT&type=sell&page=1
router.get('/', async (req, res) => {
  const { crypto, type, page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit
  const conditions = [`o.status = 'open'`]
  const params = []

  if (crypto) { params.push(crypto.toUpperCase()); conditions.push(`o.crypto = $${params.length}`) }
  if (type)   { params.push(type.toLowerCase());   conditions.push(`o.type = $${params.length}`) }

  params.push(limit, offset)
  const where = conditions.join(' AND ')

  try {
    const result = await pool.query(
      `SELECT o.*, u.name as user_name, u.rating, u.total_trades,
              (SELECT COUNT(*) FROM trades t WHERE (t.buyer_id=u.id OR t.seller_id=u.id) AND t.status='completed') as completed_trades
       FROM offers o
       JOIN users u ON u.id = o.user_id
       WHERE ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    res.json({ offers: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/offers
router.post('/', auth, kycRequired, async (req, res) => {
  const { type, crypto, price, min_amount, max_amount, payment_method } = req.body
  if (!type || !crypto || !price || !min_amount || !max_amount) {
    return res.status(400).json({ message: 'All fields required' })
  }
  if (!['buy','sell'].includes(type)) return res.status(400).json({ message: 'Type must be buy or sell' })
  if (!['USDT','BTC','ETH'].includes(crypto.toUpperCase())) return res.status(400).json({ message: 'Invalid crypto' })
  if (Number(min_amount) >= Number(max_amount)) return res.status(400).json({ message: 'max must be > min' })

  try {
    // For sell offers, verify user has enough balance
    if (type === 'sell') {
      const walletRes = await pool.query(
        `SELECT balance, locked FROM wallets WHERE user_id=$1 AND crypto_type=$2`,
        [req.user.id, crypto.toUpperCase()]
      )
      const wallet = walletRes.rows[0]
      if (!wallet || (Number(wallet.balance) - Number(wallet.locked)) <= 0) {
        return res.status(400).json({ message: 'Insufficient balance to create sell offer' })
      }
    }

    const result = await pool.query(
      `INSERT INTO offers (user_id, type, crypto, price, min_amount, max_amount, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, type, crypto.toUpperCase(), price, min_amount, max_amount, payment_method || 'Bank Transfer']
    )
    res.status(201).json({ offer: result.rows[0] })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/offers/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.name as user_name, u.rating, u.total_trades
       FROM offers o JOIN users u ON u.id=o.user_id WHERE o.id=$1`,
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Offer not found' })
    res.json({ offer: result.rows[0] })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PATCH /api/offers/:id/close
router.patch('/:id/close', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE offers SET status='closed', updated_at=NOW()
       WHERE id=$1 AND user_id=$2 AND status='open' RETURNING *`,
      [req.params.id, req.user.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Offer not found or not yours' })
    res.json({ offer: result.rows[0] })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
