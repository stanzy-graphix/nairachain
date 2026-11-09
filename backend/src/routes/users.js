const express = require('express');
const { body } = require('express-validator');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { serializeUser, isUUID } = require('../utils/serialize');
const router = express.Router();

// GET /api/users/:id/profile - Public profile with recent ratings
router.get('/:id/profile', async (req, res) => {
  if (!isUUID(req.params.id)) return res.status(404).json({ error: 'User not found' });
  try {
    const { rows } = await query(`
      SELECT id, name, kyc_status, rating, total_trades, successful_trades, created_at
      FROM users WHERE id = $1 AND is_frozen = false
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const { rows: ratings } = await query(`
      SELECT r.score, r.comment, r.created_at, u.name as rater_name
      FROM ratings r JOIN users u ON u.id = r.rater_id
      WHERE r.rated_id = $1 ORDER BY r.created_at DESC LIMIT 10
    `, [req.params.id]);
    res.json({ profile: rows[0], ratings });
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/users/profile - Update own profile
router.patch('/profile', authenticate, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('phone').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Invalid phone number'),
], validate, async (req, res) => {
  const { name, phone } = req.body;
  try {
    const { rows } = await query(
      'UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone), updated_at = NOW() WHERE id = $3 RETURNING *',
      [name || null, phone || null, req.user.id]);
    res.json({ user: serializeUser(rows[0]) });
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
