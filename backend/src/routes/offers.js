const express = require('express');
const { query } = require('../db');
const { authenticate, requireVerified } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// GET /api/offers - Browse all open offers
router.get('/', async (req, res) => {
  const { crypto, type, page = 1, limit = 20, minAmount, maxAmount } = req.query;
  const offset = (page - 1) * limit;
  try {
    let conditions = ["o.status = 'open'", "u.is_frozen = false"];
    const params = [];
    if (crypto) { params.push(crypto.toUpperCase()); conditions.push(`o.crypto = $${params.length}`); }
    if (type) { params.push(type); conditions.push(`o.type = $${params.length}`); }
    if (minAmount) { params.push(minAmount); conditions.push(`o.max_amount >= $${params.length}`); }
    if (maxAmount) { params.push(maxAmount); conditions.push(`o.min_amount <= $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limit, offset);

    const { rows } = await query(`
      SELECT o.*, u.name as trader_name, u.rating as trader_rating, u.total_trades as trader_trades,
        u.kyc_status as trader_kyc,
        (SELECT COUNT(*) FROM trades t2 WHERE (t2.seller_id = u.id OR t2.buyer_id = u.id) AND t2.created_at > NOW() - INTERVAL '5 minutes') > 0 as is_online
      FROM offers o
      JOIN users u ON o.user_id = u.id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ offers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// GET /api/offers/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT o.*, u.name as trader_name, u.rating as trader_rating, u.total_trades as trader_trades, u.kyc_status as trader_kyc
      FROM offers o JOIN users u ON o.user_id = u.id WHERE o.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Offer not found' });
    res.json({ offer: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

// POST /api/offers - Create offer
router.post('/', authenticate, requireVerified, [
  body('type').isIn(['buy','sell']),
  body('crypto').isIn(['BTC','ETH','USDT']),
  body('pricePerUnit').isFloat({ min: 1 }),
  body('minAmount').isFloat({ min: 100 }),
  body('maxAmount').isFloat({ min: 100 }),
  body('bankName').optional().isString(),
  body('bankAccountName').optional().isString(),
  body('bankAccountNumber').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { type, crypto, pricePerUnit, minAmount, maxAmount, paymentMethod, bankName, bankAccountName, bankAccountNumber } = req.body;
  if (parseFloat(minAmount) > parseFloat(maxAmount)) return res.status(400).json({ error: 'minAmount cannot exceed maxAmount' });

  try {
    // For sell offers: check sufficient wallet balance
    if (type === 'sell') {
      const { rows } = await query('SELECT balance FROM wallets WHERE user_id = $1 AND crypto_type = $2', [req.user.id, crypto]);
      const requiredCrypto = parseFloat(maxAmount) / parseFloat(pricePerUnit);
      if (!rows[0] || parseFloat(rows[0].balance) < requiredCrypto) {
        return res.status(400).json({ error: `Insufficient ${crypto} balance. Need at least ${requiredCrypto.toFixed(8)} ${crypto}` });
      }
    }

    const { rows } = await query(`
      INSERT INTO offers (user_id, type, crypto, price_per_unit, min_amount, max_amount, payment_method, bank_name, bank_account_name, bank_account_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [req.user.id, type, crypto, pricePerUnit, minAmount, maxAmount, paymentMethod || 'Bank Transfer', bankName, bankAccountName, bankAccountNumber]);

    res.status(201).json({ offer: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// PATCH /api/offers/:id/status - Pause or close own offer
router.patch('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  if (!['open','paused','closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const { rows } = await query('UPDATE offers SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *', [status, req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Offer not found or not yours' });
    res.json({ offer: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

// GET /api/offers/my/offers - Get user's own offers
router.get('/my/offers', authenticate, async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM offers WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ offers: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

module.exports = router;
