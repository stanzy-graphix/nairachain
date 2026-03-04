const express = require('express');
const { query } = require('../db');
const { authenticate, requireVerified } = require('../middleware/auth');
const router = express.Router();

// GET /api/wallet - Get all user wallets
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT w.*, 
        COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.user_id = $1 AND t.crypto = w.crypto_type AND t.type = 'deposit' AND t.status = 'completed'), 0) as total_deposited
      FROM wallets w WHERE w.user_id = $1 ORDER BY w.crypto_type
    `, [req.user.id]);
    res.json({ wallets: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// GET /api/wallet/:crypto/deposit-address - Get deposit address
router.get('/:crypto/deposit-address', authenticate, requireVerified, async (req, res) => {
  const { crypto } = req.params;
  if (!['BTC','ETH','USDT'].includes(crypto.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid crypto' });
  }
  try {
    // In production: call Coinbase Commerce or generate HD wallet address
    // For MVP: return a placeholder or pre-assigned address
    const { rows } = await query('SELECT deposit_address FROM wallets WHERE user_id = $1 AND crypto_type = $2', [req.user.id, crypto.toUpperCase()]);
    
    let address = rows[0]?.deposit_address;
    if (!address) {
      // Generate mock address for MVP (replace with real crypto wallet generation)
      const mockAddresses = {
        BTC: `bc1q${Math.random().toString(36).substr(2, 38)}`,
        ETH: `0x${Math.random().toString(16).substr(2, 40)}`,
        USDT: `T${Math.random().toString(36).substr(2, 33).toUpperCase()}`,
      };
      address = mockAddresses[crypto.toUpperCase()];
      await query('UPDATE wallets SET deposit_address = $1 WHERE user_id = $2 AND crypto_type = $3', [address, req.user.id, crypto.toUpperCase()]);
    }
    res.json({ address, crypto: crypto.toUpperCase(), network: crypto === 'USDT' ? 'TRC-20' : crypto });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get deposit address' });
  }
});

// POST /api/wallet/withdraw - Request withdrawal
router.post('/withdraw', authenticate, requireVerified, async (req, res) => {
  const { crypto, amount, address } = req.body;
  if (!crypto || !amount || !address) return res.status(400).json({ error: 'crypto, amount, and address required' });
  if (!['BTC','ETH','USDT'].includes(crypto.toUpperCase())) return res.status(400).json({ error: 'Invalid crypto' });
  if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const client = await require('../db').getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT balance FROM wallets WHERE user_id = $1 AND crypto_type = $2 FOR UPDATE', [req.user.id, crypto.toUpperCase()]);
    if (!rows[0] || parseFloat(rows[0].balance) < parseFloat(amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND crypto_type = $3', [amount, req.user.id, crypto.toUpperCase()]);
    await client.query(`INSERT INTO transactions (user_id, type, crypto, amount, status, notes) VALUES ($1, 'withdrawal', $2, $3, 'pending', $4)`,
      [req.user.id, crypto.toUpperCase(), amount, `Withdrawal to ${address}`]);
    await client.query('COMMIT');
    // In production: trigger actual blockchain withdrawal via Coinbase/Binance API
    res.json({ message: 'Withdrawal request submitted. Processing within 24 hours.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Withdrawal failed' });
  } finally {
    client.release();
  }
});

// GET /api/wallet/transactions - Transaction history
router.get('/transactions', authenticate, async (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const offset = (page - 1) * limit;
  try {
    let sql = 'SELECT * FROM transactions WHERE user_id = $1';
    const params = [req.user.id];
    if (type) { sql += ' AND type = $2'; params.push(type); }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const { rows } = await query(sql, params);
    res.json({ transactions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
