const express = require('express');
const { body } = require('express-validator');
const { query } = require('../db');
const { authenticate, requireVerified } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CRYPTOS, isUUID } = require('../utils/serialize');
const router = express.Router();

const OFFER_SELECT = `
  SELECT o.*, u.name as trader_name, u.rating as trader_rating, u.total_trades as trader_trades,
    u.successful_trades as trader_successful_trades, u.kyc_status as trader_kyc,
    (u.last_seen_at > NOW() - INTERVAL '5 minutes') as is_online
  FROM offers o JOIN users u ON o.user_id = u.id
`;

// Bank details are only revealed to a buyer inside a trade
const publicOffer = ({ bank_account_number, bank_account_name, ...o }) => o;

// GET /api/offers - Browse open offers
router.get('/', async (req, res) => {
  const { crypto, type, minAmount, maxAmount, sort } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  try {
    const conditions = ["o.status = 'open'", 'u.is_frozen = false'];
    const params = [];
    if (crypto) { params.push(String(crypto).toUpperCase()); conditions.push(`o.crypto = $${params.length}`); }
    if (type) { params.push(type); conditions.push(`o.type = $${params.length}`); }
    if (minAmount) { params.push(minAmount); conditions.push(`o.max_amount >= $${params.length}`); }
    if (maxAmount) { params.push(maxAmount); conditions.push(`o.min_amount <= $${params.length}`); }

    // Best price first: cheapest sell offers for buyers, highest buy offers for sellers
    let orderBy = 'o.created_at DESC';
    if (sort === 'price_asc') orderBy = 'o.price_per_unit ASC';
    else if (sort === 'price_desc') orderBy = 'o.price_per_unit DESC';
    else if (sort === 'rating') orderBy = 'u.rating DESC, u.total_trades DESC';

    params.push(limit, (page - 1) * limit);
    const { rows } = await query(`
      ${OFFER_SELECT}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    res.json({ offers: rows.map(publicOffer) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// GET /api/offers/my/offers - Current user's offers
router.get('/my/offers', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT o.*, (SELECT COUNT(*) FROM trades t WHERE t.offer_id = o.id AND t.status IN ('pending_payment','payment_sent','disputed'))::int as active_trades
      FROM offers o WHERE o.user_id = $1 AND o.status != 'closed' ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json({ offers: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// GET /api/offers/:id
router.get('/:id', async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(404).json({ error: 'Offer not found' });
  try {
    const { rows } = await query(`${OFFER_SELECT} WHERE o.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Offer not found' });
    res.json({ offer: publicOffer(rows[0]) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

// POST /api/offers - Create offer
router.post('/', authenticate, requireVerified, [
  body('type').isIn(['buy', 'sell']).withMessage('Type must be buy or sell'),
  body('crypto').isIn(CRYPTOS).withMessage('Unsupported crypto'),
  body('pricePerUnit').isFloat({ min: 1 }).withMessage('Price must be at least ₦1').toFloat(),
  body('minAmount').isFloat({ min: 100 }).withMessage('Minimum limit must be at least ₦100').toFloat(),
  body('maxAmount').isFloat({ min: 100 }).withMessage('Maximum limit must be at least ₦100').toFloat(),
  body('paymentMethod').optional({ checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('bankName').optional({ checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('bankAccountName').optional({ checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('bankAccountNumber').optional({ checkFalsy: true }).matches(/^\d{10}$/).withMessage('Account number must be 10 digits (NUBAN)'),
  body('terms').optional({ checkFalsy: true }).isString().trim().isLength({ max: 500 }),
], validate, async (req, res) => {
  const { type, crypto, pricePerUnit, minAmount, maxAmount, paymentMethod, bankName, bankAccountName, bankAccountNumber, terms } = req.body;
  if (minAmount > maxAmount) return res.status(400).json({ error: 'Minimum limit cannot exceed maximum limit' });

  try {
    if (type === 'sell') {
      // Sellers receive Naira, so they must provide bank details and hold enough crypto
      if (!bankName || !bankAccountName || !bankAccountNumber) {
        return res.status(400).json({ error: 'Bank details are required for sell offers (where buyers send Naira)' });
      }
      const { rows } = await query('SELECT balance FROM wallets WHERE user_id = $1 AND crypto_type = $2', [req.user.id, crypto]);
      const requiredCrypto = minAmount / pricePerUnit;
      if (!rows[0] || parseFloat(rows[0].balance) < requiredCrypto) {
        return res.status(400).json({ error: `Insufficient ${crypto} balance. You need at least ${requiredCrypto.toFixed(8)} ${crypto} to cover your minimum limit.` });
      }
    }

    const { rows } = await query(`
      INSERT INTO offers (user_id, type, crypto, price_per_unit, min_amount, max_amount, payment_method, bank_name, bank_account_name, bank_account_number, terms)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
    `, [req.user.id, type, crypto, pricePerUnit, minAmount, maxAmount, paymentMethod || 'Bank Transfer',
        bankName || null, bankAccountName || null, bankAccountNumber || null, terms || null]);
    res.status(201).json({ offer: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// PATCH /api/offers/:id/status - Pause, reopen or close own offer
router.patch('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body || {};
  if (!['open', 'paused', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (!isUUID(req.params.id)) return res.status(404).json({ error: 'Offer not found' });
  try {
    const { rows } = await query(
      "UPDATE offers SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 AND status != 'closed' RETURNING *",
      [status, req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Offer not found or not yours' });
    res.json({ offer: rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

module.exports = router;
