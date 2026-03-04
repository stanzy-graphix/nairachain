const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// GET /api/users/:id/profile - Public profile
router.get('/:id/profile', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT id, name, kyc_status, rating, total_trades, successful_trades, created_at
      FROM users WHERE id = $1 AND is_frozen = false
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/users/profile - Update own profile
router.patch('/profile', authenticate, async (req, res) => {
  const { name, phone } = req.body;
  try {
    const { rows } = await query('UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), updated_at = NOW() WHERE id = $3 RETURNING id, name, email, phone, kyc_status',
      [name, phone, req.user.id]);
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
