const router = require('express').Router()
const pool = require('../config/db')
const { auth, adminOnly } = require('../middleware/auth')
const escrowService = require('../services/escrowService')

router.use(auth, adminOnly)

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, trades, disputes, fees] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users WHERE role='user'`),
      pool.query(`SELECT COUNT(*) FROM trades WHERE created_at > NOW() - INTERVAL '24h'`),
      pool.query(`SELECT COUNT(*) FROM trades WHERE status='disputed'`),
      pool.query(`SELECT COALESCE(SUM(fee_amount),0) as total FROM trades WHERE status='completed' AND completed_at > NOW() - INTERVAL '30d'`),
    ])
    const volumeRes = await pool.query(`SELECT COALESCE(SUM(naira_amount),0) as total FROM trades WHERE status='completed' AND completed_at > NOW() - INTERVAL '24h'`)

    res.json({
      stats: {
        total_users:    Number(users.rows[0].count),
        trades_24h:     Number(trades.rows[0].count),
        open_disputes:  Number(disputes.rows[0].count),
        fees_30d:       Number(fees.rows[0].total),
        volume_24h:     Number(volumeRes.rows[0].total),
      },
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const { search, page = 1, limit = 30 } = req.query
  const offset = (page - 1) * limit
  let query = `SELECT id, name, email, role, kyc_status, is_verified, is_frozen, total_trades, rating, created_at FROM users`
  const params = []
  if (search) {
    params.push(`%${search}%`)
    query += ` WHERE name ILIKE $1 OR email ILIKE $1`
  }
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
  params.push(limit, offset)

  try {
    const result = await pool.query(query, params)
    res.json({ users: result.rows })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PATCH /api/admin/users/:id/freeze
router.patch('/users/:id/freeze', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_frozen=true WHERE id=$1 AND role!='admin' RETURNING id, name, email, is_frozen`,
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found' })
    res.json({ user: result.rows[0] })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PATCH /api/admin/users/:id/unfreeze
router.patch('/users/:id/unfreeze', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_frozen=false WHERE id=$1 RETURNING id, name, email, is_frozen`,
      [req.params.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found' })
    res.json({ user: result.rows[0] })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/admin/disputes
router.get('/disputes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*,
         b.name as buyer_name, b.email as buyer_email,
         s.name as seller_name, s.email as seller_email
       FROM trades t
       JOIN users b ON b.id=t.buyer_id
       JOIN users s ON s.id=t.seller_id
       WHERE t.status='disputed'
       ORDER BY t.updated_at ASC`
    )
    res.json({ disputes: result.rows })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PATCH /api/admin/disputes/:id/resolve
router.patch('/disputes/:id/resolve', async (req, res) => {
  const { resolution } = req.body // 'buyer' or 'seller'
  if (!['buyer','seller'].includes(resolution)) {
    return res.status(400).json({ message: 'resolution must be buyer or seller' })
  }
  try {
    const trade = await escrowService.resolveDispute(req.params.id, resolution)
    res.json({ trade, message: `Dispute resolved in favor of ${resolution}` })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// GET /api/admin/trades
router.get('/trades', async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query
  const offset = (page - 1) * limit
  const conditions = []
  const params = []
  if (status) { params.push(status); conditions.push(`t.status=$${params.length}`) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(limit, offset)

  try {
    const result = await pool.query(
      `SELECT t.*,
         b.name as buyer_name, s.name as seller_name
       FROM trades t
       JOIN users b ON b.id=t.buyer_id
       JOIN users s ON s.id=t.seller_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    )
    res.json({ trades: result.rows })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
