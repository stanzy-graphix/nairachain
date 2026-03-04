const router = require('express').Router()
const pool = require('../config/db')
const { auth } = require('../middleware/auth')
const escrowService = require('../services/escrowService')
const emailService  = require('../services/emailService')

// POST /api/trades  — accept an offer, start trade
router.post('/', auth, async (req, res) => {
  const { offer_id, naira_amount } = req.body
  if (!offer_id || !naira_amount) return res.status(400).json({ message: 'offer_id and naira_amount required' })
  try {
    const trade = await escrowService.startTrade({
      offerId:     offer_id,
      buyerId:     req.user.id,
      nairaAmount: Number(naira_amount),
    })

    // Get both users for email notification
    const usersRes = await pool.query(`SELECT id, email, name FROM users WHERE id=ANY($1)`, [[trade.buyer_id, trade.seller_id]])
    const buyer  = usersRes.rows.find(u => u.id === trade.buyer_id)
    const seller = usersRes.rows.find(u => u.id === trade.seller_id)
    if (buyer && seller) {
      emailService.sendTradeStarted(buyer.email, seller.email, trade).catch(console.error)
    }

    res.status(201).json({ trade })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// GET /api/trades/my
router.get('/my', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*,
         b.name as buyer_name, s.name as seller_name
       FROM trades t
       JOIN users b ON b.id = t.buyer_id
       JOIN users s ON s.id = t.seller_id
       WHERE t.buyer_id=$1 OR t.seller_id=$1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    )
    res.json({ trades: result.rows })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// GET /api/trades/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*,
         b.name as buyer_name, b.email as buyer_email,
         s.name as seller_name, s.email as seller_email,
         o.payment_method
       FROM trades t
       JOIN users b ON b.id=t.buyer_id
       JOIN users s ON s.id=t.seller_id
       JOIN offers o ON o.id=t.offer_id
       WHERE t.id=$1 AND (t.buyer_id=$2 OR t.seller_id=$2)`,
      [req.params.id, req.user.id]
    )
    if (!result.rows[0]) return res.status(404).json({ message: 'Trade not found' })

    // Get messages
    const messages = await pool.query(
      `SELECT m.*, u.name as sender_name FROM messages m
       JOIN users u ON u.id=m.sender_id
       WHERE m.trade_id=$1 ORDER BY m.created_at ASC`,
      [req.params.id]
    )

    res.json({ trade: result.rows[0], messages: messages.rows })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// PATCH /api/trades/:id/mark-paid
router.patch('/:id/mark-paid', auth, async (req, res) => {
  try {
    const trade = await escrowService.markPaid(req.params.id, req.user.id)
    res.json({ trade })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// PATCH /api/trades/:id/confirm-payment
router.patch('/:id/confirm-payment', auth, async (req, res) => {
  try {
    const trade = await escrowService.confirmPayment(req.params.id, req.user.id)

    // Notify buyer
    const userRes = await pool.query('SELECT email FROM users WHERE id=$1', [trade.buyer_id])
    if (userRes.rows[0]) emailService.sendTradeComplete(userRes.rows[0].email, trade).catch(console.error)

    res.json({ trade, message: 'Payment confirmed! Crypto released to buyer.' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// PATCH /api/trades/:id/cancel
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const trade = await escrowService.cancelTrade(req.params.id, req.user.id)
    res.json({ trade })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// PATCH /api/trades/:id/dispute
router.patch('/:id/dispute', auth, async (req, res) => {
  const { reason } = req.body
  if (!reason) return res.status(400).json({ message: 'Reason required' })
  try {
    const trade = await escrowService.openDispute(req.params.id, req.user.id, reason)
    res.json({ trade, message: 'Dispute opened. Admin will review within 2 hours.' })
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// POST /api/trades/:id/messages
router.post('/:id/messages', auth, async (req, res) => {
  const { content } = req.body
  if (!content?.trim()) return res.status(400).json({ message: 'Message content required' })
  try {
    // Verify user is part of trade
    const tradeRes = await pool.query(`SELECT * FROM trades WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2)`, [req.params.id, req.user.id])
    if (!tradeRes.rows[0]) return res.status(403).json({ message: 'Not authorized' })

    const result = await pool.query(
      `INSERT INTO messages (trade_id, sender_id, content) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, req.user.id, content.trim()]
    )
    res.status(201).json({ message: result.rows[0] })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/trades/:id/rate
router.post('/:id/rate', auth, async (req, res) => {
  const { score } = req.body
  if (!score || score < 1 || score > 5) return res.status(400).json({ message: 'Score must be 1-5' })
  try {
    const tradeRes = await pool.query(`SELECT * FROM trades WHERE id=$1 AND status='completed'`, [req.params.id])
    const trade = tradeRes.rows[0]
    if (!trade) return res.status(404).json({ message: 'Completed trade not found' })

    const ratedId = trade.buyer_id === req.user.id ? trade.seller_id : trade.buyer_id

    await pool.query(
      `INSERT INTO ratings (trade_id, rater_id, rated_id, score) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id, ratedId, score]
    )

    // Update user average rating
    await pool.query(
      `UPDATE users SET rating = (SELECT AVG(score) FROM ratings WHERE rated_id=$1) WHERE id=$1`,
      [ratedId]
    )

    res.json({ message: 'Rating submitted!' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
