const express = require('express');
const crypto = require('crypto');
const { body } = require('express-validator');
const { query, getClient } = require('../db');
const { authenticate, requireVerified } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CRYPTOS } = require('../utils/serialize');
const router = express.Router();

const NETWORKS = { BTC: 'Bitcoin', ETH: 'ERC-20', USDT: 'TRC-20' };
const MIN_WITHDRAWAL = { BTC: 0.0001, ETH: 0.001, USDT: 1 };
// Flat network fee charged on withdrawals (deducted from balance on top of amount)
const WITHDRAWAL_FEE = { BTC: 0.00005, ETH: 0.0005, USDT: 1 };

// Placeholder address generator for the MVP. Replace with an HD wallet or
// custody provider (Coinbase Commerce, Binance Pay, Fireblocks…) in production.
const mockAddress = (sym) => {
  const hex = (n) => crypto.randomBytes(n).toString('hex');
  const b58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const base58 = (n) => Array.from(crypto.randomBytes(n), b => b58[b % 58]).join('');
  if (sym === 'BTC') return `bc1q${hex(19).slice(0, 38)}`;
  if (sym === 'ETH') return `0x${hex(20)}`;
  return `T${base58(33)}`;
};

// GET /api/wallet - Get all user wallets
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT w.*,
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.user_id = $1 AND t.crypto = w.crypto_type AND t.type = 'deposit' AND t.status = 'completed'), 0) as total_deposited
      FROM wallets w WHERE w.user_id = $1 ORDER BY w.crypto_type
    `, [req.user.id]);
    res.json({ wallets: rows, withdrawalFees: WITHDRAWAL_FEE, minWithdrawals: MIN_WITHDRAWAL });
  } catch {
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// GET /api/wallet/transactions - Transaction history
router.get('/transactions', authenticate, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  try {
    let sql = 'SELECT * FROM transactions WHERE user_id = $1';
    const params = [req.user.id];
    if (req.query.type) { params.push(req.query.type); sql += ` AND type = $${params.length}`; }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, (page - 1) * limit);
    const { rows } = await query(sql, params);
    res.json({ transactions: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/wallet/:crypto/deposit-address
router.get('/:crypto/deposit-address', authenticate, requireVerified, async (req, res) => {
  const sym = req.params.crypto.toUpperCase();
  if (!CRYPTOS.includes(sym)) return res.status(400).json({ error: 'Invalid crypto' });
  try {
    const { rows } = await query('SELECT deposit_address FROM wallets WHERE user_id = $1 AND crypto_type = $2', [req.user.id, sym]);
    let address = rows[0]?.deposit_address;
    if (!address) {
      address = mockAddress(sym);
      await query(`
        INSERT INTO wallets (user_id, crypto_type, deposit_address) VALUES ($1, $2, $3)
        ON CONFLICT (user_id, crypto_type) DO UPDATE SET deposit_address = $3
      `, [req.user.id, sym, address]);
    }
    res.json({ address, crypto: sym, network: NETWORKS[sym] });
  } catch {
    res.status(500).json({ error: 'Failed to get deposit address' });
  }
});

// POST /api/wallet/withdraw - Request withdrawal (queued for admin approval)
router.post('/withdraw', authenticate, requireVerified, [
  body('crypto').customSanitizer(v => String(v || '').toUpperCase()).isIn(CRYPTOS).withMessage('Invalid crypto'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive').toFloat(),
  body('address').trim().isLength({ min: 20, max: 120 }).withMessage('Enter a valid destination address'),
], validate, async (req, res) => {
  const { crypto: sym, amount, address } = req.body;
  if (req.user.kyc_status !== 'verified') return res.status(403).json({ error: 'KYC verification is required before withdrawing' });
  if (amount < MIN_WITHDRAWAL[sym]) return res.status(400).json({ error: `Minimum withdrawal is ${MIN_WITHDRAWAL[sym]} ${sym}` });

  const fee = WITHDRAWAL_FEE[sym];
  const total = amount + fee;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      'UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND crypto_type = $3 AND balance >= $1',
      [total, req.user.id, sym]);
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient balance (amount + ${fee} ${sym} network fee)` });
    }
    const { rows } = await client.query(`
      INSERT INTO transactions (user_id, type, crypto, amount, fee, status, notes)
      VALUES ($1, 'withdrawal', $2, $3, $4, 'pending', $5) RETURNING *
    `, [req.user.id, sym, amount, fee, `Withdrawal to ${address}`]);
    await client.query('COMMIT');
    res.json({ message: 'Withdrawal request submitted. Processing within 24 hours.', transaction: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Withdrawal failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
