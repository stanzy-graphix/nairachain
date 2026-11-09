const express = require('express');
const { body } = require('express-validator');
const { query, getClient } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const escrow = require('../services/escrow');
const { CRYPTOS, isUUID } = require('../utils/serialize');
const router = express.Router();

router.use(authenticate, requireAdmin);

router.param('id', (req, res, next, id) => (isUUID(id) ? next() : res.status(404).json({ error: 'Not found' })));
router.param('tradeId', (req, res, next, id) => (isUUID(id) ? next() : res.status(404).json({ error: 'Not found' })));

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, trades, volume, fees, withdrawals] = await Promise.all([
      query("SELECT COUNT(*)::int as total, (COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'))::int as today, (COUNT(*) FILTER (WHERE kyc_status = 'pending'))::int as kyc_pending FROM users"),
      query(`SELECT COUNT(*)::int as total,
               (COUNT(*) FILTER (WHERE status='completed'))::int as completed,
               (COUNT(*) FILTER (WHERE status='disputed'))::int as disputed,
               (COUNT(*) FILTER (WHERE status IN ('pending_payment','payment_sent')))::int as active,
               (COUNT(*) FILTER (WHERE status='cancelled'))::int as cancelled
             FROM trades`),
      query("SELECT COALESCE(SUM(naira_amount),0) as total_24h FROM trades WHERE status='completed' AND payment_confirmed_at > NOW() - INTERVAL '24 hours'"),
      query("SELECT COALESCE(SUM(fee_amount),0) as total FROM trades WHERE status='completed'"),
      query("SELECT COUNT(*)::int as count FROM transactions WHERE type='withdrawal' AND status='pending'"),
    ]);
    res.json({
      users: users.rows[0],
      trades: trades.rows[0],
      volume: { total_24h: Number(volume.rows[0].total_24h) },
      openDisputes: trades.rows[0].disputed,
      pendingWithdrawals: withdrawals.rows[0].count,
      totalFees: Number(fees.rows[0].total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const { search, kyc, frozen } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  try {
    const conditions = [];
    const params = [];
    if (search) { params.push(`%${search}%`); conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`); }
    if (kyc) { params.push(kyc); conditions.push(`kyc_status = $${params.length}`); }
    if (frozen !== undefined) { params.push(frozen === 'true'); conditions.push(`is_frozen = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limit, (page - 1) * limit);
    const { rows } = await query(`
      SELECT id, name, email, phone, kyc_status, is_frozen, is_admin, email_verified, total_trades, rating, created_at
      FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);
    res.json({ users: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id/freeze
router.patch('/users/:id/freeze', [body('frozen').isBoolean().withMessage('frozen must be true or false').toBoolean()], validate, async (req, res) => {
  const { frozen } = req.body;
  if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't freeze your own account" });
  try {
    const { rows } = await query('UPDATE users SET is_frozen = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_frozen', [frozen, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    if (frozen) {
      await query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.params.id]);
      await query("UPDATE offers SET status = 'paused', updated_at = NOW() WHERE user_id = $1 AND status = 'open'", [req.params.id]);
    }
    res.json({ user: rows[0], message: `User ${frozen ? 'frozen' : 'unfrozen'} successfully` });
  } catch {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PATCH /api/admin/users/:id/kyc
router.patch('/users/:id/kyc', async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'verified', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid KYC status' });
  try {
    const { rows } = await query('UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, kyc_status', [status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to update KYC' });
  }
});

// POST /api/admin/users/:id/credit — record a confirmed on-chain deposit.
// Stand-in for a custody provider webhook until real deposits are wired up.
router.post('/users/:id/credit', [
  body('crypto').isIn(CRYPTOS).withMessage('Invalid crypto'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive').toFloat(),
  body('txHash').optional({ checkFalsy: true }).isString().trim().isLength({ max: 255 }),
], validate, async (req, res) => {
  const { crypto, amount, txHash } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: users } = await client.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!users[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
    await client.query(`
      INSERT INTO wallets (user_id, crypto_type, balance) VALUES ($1, $2, $3)
      ON CONFLICT (user_id, crypto_type) DO UPDATE SET balance = wallets.balance + $3
    `, [req.params.id, crypto, amount]);
    await client.query(`
      INSERT INTO transactions (user_id, type, crypto, amount, status, tx_hash, notes, processed_by, processed_at)
      VALUES ($1, 'deposit', $2, $3, 'completed', $4, 'Deposit confirmed by admin', $5, NOW())
    `, [req.params.id, crypto, amount, txHash || null, req.user.id]);
    await client.query('COMMIT');
    res.json({ message: `Credited ${amount} ${crypto}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to credit wallet' });
  } finally {
    client.release();
  }
});

// GET /api/admin/disputes
router.get('/disputes', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT t.*, buyer.name as buyer_name, buyer.email as buyer_email,
        seller.name as seller_name, seller.email as seller_email, opener.name as disputed_by_name,
        (SELECT json_agg(json_build_object('sender', u.name, 'message', m.message, 'is_system', m.is_system, 'created_at', m.created_at) ORDER BY m.created_at)
           FROM trade_messages m JOIN users u ON u.id = m.sender_id WHERE m.trade_id = t.id) as messages
      FROM trades t
      JOIN users buyer ON t.buyer_id = buyer.id
      JOIN users seller ON t.seller_id = seller.id
      LEFT JOIN users opener ON t.disputed_by = opener.id
      WHERE t.status = 'disputed' ORDER BY t.updated_at ASC
    `);
    res.json({ disputes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// PATCH /api/admin/disputes/:tradeId/resolve
router.patch('/disputes/:tradeId/resolve', async (req, res) => {
  const { resolution, winner } = req.body || {};
  if (!['buyer', 'seller'].includes(winner)) return res.status(400).json({ error: 'winner must be buyer or seller' });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query("SELECT * FROM trades WHERE id = $1 AND status = 'disputed' FOR UPDATE", [req.params.tradeId]);
    const trade = rows[0];
    if (!trade) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Disputed trade not found' }); }

    const note = `🛡 Admin resolved the dispute in favour of the ${winner}.${resolution ? ' ' + resolution : ''}`;
    let updated;
    if (winner === 'buyer') {
      updated = await escrow.release(client, trade, req.user.id, note);
    } else {
      updated = await escrow.refund(client, trade, req.user.id, 'Dispute resolved in favour of seller');
      await escrow.systemMessage(client, trade.id, req.user.id, note);
    }
    await client.query('UPDATE trades SET dispute_resolved_by = $1, dispute_resolved_at = NOW() WHERE id = $2', [req.user.id, trade.id]);
    await client.query('COMMIT');

    req.app.get('io')?.to(`trade:${trade.id}`).emit('trade_status', { tradeId: trade.id, status: updated.status });
    res.json({ message: `Dispute resolved in favour of ${winner}.`, trade: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  } finally {
    client.release();
  }
});

// GET /api/admin/withdrawals?status=pending
router.get('/withdrawals', async (req, res) => {
  const status = req.query.status || 'pending';
  try {
    const { rows } = await query(`
      SELECT t.*, u.name as user_name, u.email as user_email, u.kyc_status
      FROM transactions t JOIN users u ON u.id = t.user_id
      WHERE t.type = 'withdrawal' AND t.status = $1 ORDER BY t.created_at ASC LIMIT 200
    `, [status]);
    res.json({ withdrawals: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// PATCH /api/admin/withdrawals/:id — approve (with tx hash) or reject (refund)
router.patch('/withdrawals/:id', [
  body('action').isIn(['approve', 'reject']).withMessage('action must be approve or reject'),
  body('txHash').optional({ checkFalsy: true }).isString().trim().isLength({ max: 255 }),
  body('reason').optional({ checkFalsy: true }).isString().trim().isLength({ max: 255 }),
], validate, async (req, res) => {
  const { action, txHash, reason } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "SELECT * FROM transactions WHERE id = $1 AND type = 'withdrawal' AND status = 'pending' FOR UPDATE", [req.params.id]);
    const tx = rows[0];
    if (!tx) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pending withdrawal not found' }); }

    if (action === 'approve') {
      await client.query(`
        UPDATE transactions SET status = 'completed', tx_hash = $1, processed_by = $2, processed_at = NOW() WHERE id = $3
      `, [txHash || null, req.user.id, tx.id]);
    } else {
      await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2 AND crypto_type = $3',
        [Number(tx.amount) + Number(tx.fee || 0), tx.user_id, tx.crypto]);
      await client.query(`
        UPDATE transactions SET status = 'failed', notes = notes || $1, processed_by = $2, processed_at = NOW() WHERE id = $3
      `, [` — rejected: ${reason || 'no reason given'} (refunded)`, req.user.id, tx.id]);
    }
    await client.query('COMMIT');
    res.json({ message: action === 'approve' ? 'Withdrawal approved' : 'Withdrawal rejected and refunded' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to process withdrawal' });
  } finally {
    client.release();
  }
});

// GET /api/admin/transactions
router.get('/transactions', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  try {
    const { rows } = await query(`
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM transactions t JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC LIMIT $1 OFFSET $2
    `, [limit, (page - 1) * limit]);
    res.json({ transactions: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
