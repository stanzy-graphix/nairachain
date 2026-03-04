const express = require('express');
const { query, getClient } = require('../db');
const { authenticate, requireVerified } = require('../middleware/auth');
const { sendEmail, emailTemplates } = require('../services/email');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const FEE_RATE = 0.005; // 0.5%

const generateTradeRef = () => 'TRD-' + Date.now().toString(36).toUpperCase();

// POST /api/trades - Initiate a trade (buyer accepts offer)
router.post('/', authenticate, requireVerified, [
  body('offerId').isUUID(),
  body('nairaAmount').isFloat({ min: 100 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { offerId, nairaAmount } = req.body;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Lock offer row
    const { rows: offerRows } = await client.query('SELECT * FROM offers WHERE id = $1 AND status = $2 FOR UPDATE', [offerId, 'open']);
    const offer = offerRows[0];
    if (!offer) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Offer not found or not available' }); }
    if (offer.user_id === req.user.id) { await client.query('ROLLBACK'); return res.status(400).json({ error: "You can't trade with your own offer" }); }
    if (nairaAmount < offer.min_amount || nairaAmount > offer.max_amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Amount must be between ₦${offer.min_amount} and ₦${offer.max_amount}` });
    }

    const cryptoAmount = parseFloat(nairaAmount) / parseFloat(offer.price_per_unit);
    const feeAmount = parseFloat(nairaAmount) * FEE_RATE;
    const buyerId = offer.type === 'sell' ? req.user.id : offer.user_id;
    const sellerId = offer.type === 'sell' ? offer.user_id : req.user.id;

    // Lock crypto in seller's wallet
    const { rows: walletRows } = await client.query(
      'SELECT balance FROM wallets WHERE user_id = $1 AND crypto_type = $2 FOR UPDATE', [sellerId, offer.crypto]);
    if (!walletRows[0] || parseFloat(walletRows[0].balance) < cryptoAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Seller has insufficient balance' });
    }

    // Deduct from seller, add to locked
    await client.query('UPDATE wallets SET balance = balance - $1, locked_balance = locked_balance + $1 WHERE user_id = $2 AND crypto_type = $3',
      [cryptoAmount, sellerId, offer.crypto]);

    const expiresAt = new Date(Date.now() + parseInt(process.env.ESCROW_TIMEOUT_MINUTES || 30) * 60 * 1000);
    const tradeRef = generateTradeRef();

    const { rows: tradeRows } = await client.query(`
      INSERT INTO trades (trade_ref, offer_id, buyer_id, seller_id, crypto, crypto_amount, naira_amount, price_per_unit, fee_amount, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [tradeRef, offerId, buyerId, sellerId, offer.crypto, cryptoAmount, nairaAmount, offer.price_per_unit, feeAmount, expiresAt]);

    // Log escrow lock transaction
    await client.query(`INSERT INTO transactions (user_id, trade_id, type, crypto, amount, notes) VALUES ($1, $2, 'escrow_lock', $3, $4, $5)`,
      [sellerId, tradeRows[0].id, offer.crypto, cryptoAmount, `Escrow locked for trade ${tradeRef}`]);

    // System message
    await client.query(`INSERT INTO trade_messages (trade_id, sender_id, message, is_system) VALUES ($1, $2, $3, true)`,
      [tradeRows[0].id, req.user.id, `Trade started. ₦${nairaAmount} for ${cryptoAmount.toFixed(8)} ${offer.crypto}. Buyer should send payment within 30 minutes.`]);

    await client.query('COMMIT');

    // Send email notifications
    try {
      const { rows: buyerRows } = await query('SELECT name, email FROM users WHERE id = $1', [buyerId]);
      const { rows: sellerRows } = await query('SELECT name, email FROM users WHERE id = $1', [sellerId]);
      const tmpl = emailTemplates.tradeStarted(buyerRows[0].name, tradeRef, cryptoAmount.toFixed(8), offer.crypto);
      await sendEmail({ to: buyerRows[0].email, ...tmpl });
      await sendEmail({ to: sellerRows[0].email, subject: `Trade ${tradeRef} - Buyer Incoming`, html: tmpl.html });
    } catch (e) { console.error('Email error:', e.message); }

    res.status(201).json({ trade: tradeRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to start trade' });
  } finally {
    client.release();
  }
});

// GET /api/trades - Get user's trades
router.get('/', authenticate, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  try {
    let sql = `
      SELECT t.*, 
        buyer.name as buyer_name, buyer.rating as buyer_rating,
        seller.name as seller_name, seller.rating as seller_rating
      FROM trades t
      JOIN users buyer ON t.buyer_id = buyer.id
      JOIN users seller ON t.seller_id = seller.id
      WHERE (t.buyer_id = $1 OR t.seller_id = $1)
    `;
    const params = [req.user.id];
    if (status) { params.push(status); sql += ` AND t.status = $${params.length}`; }
    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const { rows } = await query(sql, params);
    res.json({ trades: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// GET /api/trades/:ref - Get single trade
router.get('/:ref', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT t.*,
        buyer.name as buyer_name, buyer.email as buyer_email, buyer.rating as buyer_rating,
        seller.name as seller_name, seller.email as seller_email, seller.rating as seller_rating,
        o.bank_name, o.bank_account_name, o.bank_account_number, o.payment_method
      FROM trades t
      JOIN users buyer ON t.buyer_id = buyer.id
      JOIN users seller ON t.seller_id = seller.id
      JOIN offers o ON t.offer_id = o.id
      WHERE t.trade_ref = $1 AND (t.buyer_id = $2 OR t.seller_id = $2)
    `, [req.params.ref, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Trade not found' });

    // Get messages
    const { rows: messages } = await query(`
      SELECT m.*, u.name as sender_name FROM trade_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.trade_id = $1 ORDER BY m.created_at ASC
    `, [rows[0].id]);

    res.json({ trade: rows[0], messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

// PATCH /api/trades/:ref/payment-sent - Buyer marks payment sent
router.patch('/:ref/payment-sent', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM trades WHERE trade_ref = $1 FOR UPDATE', [req.params.ref]);
    const trade = rows[0];
    if (!trade) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Trade not found' }); }
    if (trade.buyer_id !== req.user.id) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only buyer can mark payment sent' }); }
    if (trade.status !== 'pending_payment') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Trade is ${trade.status}` }); }
    if (new Date(trade.expires_at) < new Date()) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Trade has expired' }); }

    const { rows: updated } = await client.query(`
      UPDATE trades SET status = 'payment_sent', payment_sent_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *
    `, [trade.id]);

    await client.query(`INSERT INTO trade_messages (trade_id, sender_id, message, is_system) VALUES ($1, $2, $3, true)`,
      [trade.id, req.user.id, 'Buyer has marked payment as sent. Seller please confirm receipt.']);

    await client.query('COMMIT');

    // Notify via Socket.IO
    req.app.get('io')?.to(`trade:${trade.id}`).emit('trade_status', { status: 'payment_sent', tradeId: trade.id });

    res.json({ trade: updated[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update trade' });
  } finally {
    client.release();
  }
});

// PATCH /api/trades/:ref/confirm-payment - Seller confirms payment, releases crypto
router.patch('/:ref/confirm-payment', authenticate, async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM trades WHERE trade_ref = $1 FOR UPDATE', [req.params.ref]);
    const trade = rows[0];
    if (!trade) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Trade not found' }); }
    if (trade.seller_id !== req.user.id) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Only seller can confirm payment' }); }
    if (!['payment_sent','confirming'].includes(trade.status)) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Cannot confirm at status: ${trade.status}` }); }

    // Release crypto from locked → buyer's wallet
    await client.query('UPDATE wallets SET locked_balance = locked_balance - $1 WHERE user_id = $2 AND crypto_type = $3',
      [trade.crypto_amount, trade.seller_id, trade.crypto]);
    await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2 AND crypto_type = $3',
      [trade.crypto_amount, trade.buyer_id, trade.crypto]);

    // Update trade
    const { rows: updated } = await client.query(`
      UPDATE trades SET status = 'completed', escrow_status = 'released', payment_confirmed_at = NOW(), updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [trade.id]);

    // Log transactions
    await client.query(`INSERT INTO transactions (user_id, trade_id, type, crypto, amount, notes) VALUES ($1, $2, 'trade_buy', $3, $4, $5)`,
      [trade.buyer_id, trade.id, trade.crypto, trade.crypto_amount, `Bought ${trade.crypto_amount} ${trade.crypto}`]);
    await client.query(`INSERT INTO transactions (user_id, trade_id, type, crypto, amount, notes) VALUES ($1, $2, 'trade_sell', $3, $4, $5)`,
      [trade.seller_id, trade.id, trade.crypto, trade.crypto_amount, `Sold ${trade.crypto_amount} ${trade.crypto}`]);

    // Update user stats
    await client.query('UPDATE users SET total_trades = total_trades + 1, successful_trades = successful_trades + 1 WHERE id = $1 OR id = $2',
      [trade.buyer_id, trade.seller_id]);

    await client.query(`INSERT INTO trade_messages (trade_id, sender_id, message, is_system) VALUES ($1, $2, $3, true)`,
      [trade.id, req.user.id, `✅ Trade completed! ${trade.crypto_amount} ${trade.crypto} released to buyer.`]);

    await client.query('COMMIT');

    req.app.get('io')?.to(`trade:${trade.id}`).emit('trade_status', { status: 'completed', tradeId: trade.id });

    res.json({ trade: updated[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to release crypto' });
  } finally {
    client.release();
  }
});

// PATCH /api/trades/:ref/dispute - Open dispute
router.patch('/:ref/dispute', authenticate, [body('reason').isString().isLength({ min: 10 })], async (req, res) => {
  const { reason } = req.body;
  try {
    const { rows } = await query('SELECT * FROM trades WHERE trade_ref = $1', [req.params.ref]);
    const trade = rows[0];
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    if (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id) return res.status(403).json({ error: 'Not your trade' });
    if (!['payment_sent','confirming','pending_payment'].includes(trade.status)) return res.status(400).json({ error: 'Cannot dispute at this stage' });

    const { rows: updated } = await query(`
      UPDATE trades SET status = 'disputed', dispute_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `, [reason, trade.id]);

    await query(`INSERT INTO trade_messages (trade_id, sender_id, message, is_system) VALUES ($1, $2, $3, true)`,
      [trade.id, req.user.id, `⚠️ Dispute opened: ${reason}`]);

    res.json({ trade: updated[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to open dispute' });
  }
});

// POST /api/trades/:ref/message - Send chat message
router.post('/:ref/message', authenticate, [body('message').isString().isLength({ min: 1, max: 1000 })], async (req, res) => {
  try {
    const { rows: tradeRows } = await query('SELECT id, buyer_id, seller_id FROM trades WHERE trade_ref = $1', [req.params.ref]);
    const trade = tradeRows[0];
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    if (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id) return res.status(403).json({ error: 'Not your trade' });

    const { rows } = await query(`
      INSERT INTO trade_messages (trade_id, sender_id, message) VALUES ($1, $2, $3) RETURNING *
    `, [trade.id, req.user.id, req.body.message]);

    const msg = { ...rows[0], sender_name: req.user.name };
    req.app.get('io')?.to(`trade:${trade.id}`).emit('new_message', msg);

    res.status(201).json({ message: msg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/trades/:ref/rate - Rate trader after completion
router.post('/:ref/rate', authenticate, [body('score').isInt({ min: 1, max: 5 }), body('comment').optional().isString()], async (req, res) => {
  const { score, comment } = req.body;
  try {
    const { rows: tradeRows } = await query('SELECT * FROM trades WHERE trade_ref = $1', [req.params.ref]);
    const trade = tradeRows[0];
    if (!trade || trade.status !== 'completed') return res.status(400).json({ error: 'Trade not completed' });
    if (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id) return res.status(403).json({ error: 'Not your trade' });

    const ratedId = trade.buyer_id === req.user.id ? trade.seller_id : trade.buyer_id;
    await query('INSERT INTO ratings (trade_id, rater_id, rated_id, score, comment) VALUES ($1, $2, $3, $4, $5)',
      [trade.id, req.user.id, ratedId, score, comment]);

    // Recalculate avg rating
    const { rows } = await query('SELECT AVG(score)::numeric(3,2) as avg FROM ratings WHERE rated_id = $1', [ratedId]);
    await query('UPDATE users SET rating = $1 WHERE id = $2', [rows[0].avg, ratedId]);

    res.json({ message: 'Rating submitted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

module.exports = router;
