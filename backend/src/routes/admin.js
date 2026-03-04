const express = require('express');
const { query } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, trades, volume, disputes, fees] = await Promise.all([
      query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h') as today FROM users"),
      query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='completed') as completed, COUNT(*) FILTER (WHERE status='disputed') as disputed FROM trades"),
      query("SELECT COALESCE(SUM(naira_amount),0) as total_24h FROM trades WHERE status='completed' AND created_at > NOW() - INTERVAL '24h'"),
      query("SELECT COUNT(*) as count FROM trades WHERE status = 'disputed'"),
      query("SELECT COALESCE(SUM(fee_amount),0) as total FROM trades WHERE status='completed'"),
    ]);
    res.json({
      users: users.rows[0],
      trades: trades.rows[0],
      volume: volume.rows[0],
      openDisputes: disputes.rows[0].count,
      totalFees: fees.rows[0].total,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const { page = 1, limit = 30, search, kyc, frozen } = req.query;
  const offset = (page - 1) * limit;
  try {
    let conditions = [];
    const params = [];
    if (search) { params.push(`%${search}%`); conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`); }
    if (kyc) { params.push(kyc); conditions.push(`kyc_status = $${params.length}`); }
    if (frozen !== undefined) { params.push(frozen === 'true'); conditions.push(`is_frozen = $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limit, offset);
    const { rows } = await query(`SELECT id, name, email, kyc_status, is_frozen, is_admin, email_verified, total_trades, rating, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params);
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id/freeze
router.patch('/users/:id/freeze', async (req, res) => {
  const { frozen } = req.body;
  try {
    const { rows } = await query('UPDATE users SET is_frozen = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, is_frozen', [frozen, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0], message: `User ${frozen ? 'frozen' : 'unfrozen'} successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PATCH /api/admin/users/:id/kyc
router.patch('/users/:id/kyc', async (req, res) => {
  const { status } = req.body;
  if (!['pending','verified','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid KYC status' });
  try {
    const { rows } = await query('UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, kyc_status', [status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update KYC' });
  }
});

// GET /api/admin/disputes
router.get('/disputes', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT t.*, buyer.name as buyer_name, buyer.email as buyer_email,
        seller.name as seller_name, seller.email as seller_email
      FROM trades t
      JOIN users buyer ON t.buyer_id = buyer.id
      JOIN users seller ON t.seller_id = seller.id
      WHERE t.status = 'disputed' ORDER BY t.created_at DESC
    `);
    res.json({ disputes: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// PATCH /api/admin/disputes/:tradeId/resolve
router.patch('/disputes/:tradeId/resolve', async (req, res) => {
  const { resolution, winner } = req.body; // winner: 'buyer' | 'seller'
  if (!['buyer','seller'].includes(winner)) return res.status(400).json({ error: 'winner must be buyer or seller' });
  const client = await require('../db').getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM trades WHERE id = $1 AND status = $2 FOR UPDATE', [req.params.tradeId, 'disputed']);
    const trade = rows[0];
    if (!trade) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Disputed trade not found' }); }

    if (winner === 'buyer') {
      // Release crypto to buyer
      await client.query('UPDATE wallets SET locked_balance = locked_balance - $1 WHERE user_id = $2 AND crypto_type = $3', [trade.crypto_amount, trade.seller_id, trade.crypto]);
      await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2 AND crypto_type = $3', [trade.crypto_amount, trade.buyer_id, trade.crypto]);
      await client.query(`UPDATE trades SET status='completed', escrow_status='released', dispute_resolved_by=$1, dispute_resolved_at=NOW(), updated_at=NOW() WHERE id=$2`, [req.user.id, trade.id]);
    } else {
      // Return crypto to seller
      await client.query('UPDATE wallets SET locked_balance = locked_balance - $1, balance = balance + $1 WHERE user_id = $2 AND crypto_type = $3', [trade.crypto_amount, trade.seller_id, trade.crypto]);
      await client.query(`UPDATE trades SET status='cancelled', escrow_status='returned', dispute_resolved_by=$1, dispute_resolved_at=NOW(), updated_at=NOW() WHERE id=$2`, [req.user.id, trade.id]);
    }

    await client.query(`INSERT INTO trade_messages (trade_id, sender_id, message, is_system) VALUES ($1, $2, $3, true)`,
      [trade.id, req.user.id, `Admin resolved dispute in favour of ${winner}. ${resolution || ''}`]);

    await client.query('COMMIT');
    res.json({ message: `Dispute resolved. ${winner} wins.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  } finally {
    client.release();
  }
});

// GET /api/admin/transactions
router.get('/transactions', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  try {
    const { rows } = await query(`
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM transactions t JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC LIMIT $1 OFFSET $2
    `, [limit, offset]);
    res.json({ transactions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
