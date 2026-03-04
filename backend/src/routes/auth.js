const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { sendEmail, emailTemplates } = require('../services/email');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
  return { accessToken, refreshToken };
};

// POST /api/auth/register
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[0-9])/),
  body('phone').optional().isMobilePhone(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, phone } = req.body;
  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = uuidv4();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { rows } = await query(`
      INSERT INTO users (name, email, password_hash, phone, email_verify_token, email_verify_expires)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email
    `, [name, email, passwordHash, phone, verifyToken, verifyExpires]);

    const user = rows[0];

    // Create wallets for each crypto
    for (const crypto of ['BTC', 'ETH', 'USDT']) {
      await query('INSERT INTO wallets (user_id, crypto_type) VALUES ($1, $2)', [user.id, crypto]);
    }

    // Send verification email
    try {
      const tmpl = emailTemplates.verifyEmail(name, verifyToken);
      await sendEmail({ to: email, ...tmpl });
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }

    res.status(201).json({ message: 'Account created. Please verify your email.', userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_frozen) return res.status(403).json({ error: 'Account frozen. Contact support.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]);

    res.json({
      accessToken, refreshToken,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin, kycStatus: user.kyc_status, emailVerified: user.email_verified }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const { rows } = await query('SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2', [refreshToken, decoded.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'Invalid refresh token' });
    if (new Date(rows[0].expires_at) < new Date()) {
      await query('DELETE FROM refresh_tokens WHERE id = $1', [rows[0].id]);
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    const { accessToken, refreshToken: newRefresh } = generateTokens(decoded.userId);
    await query('UPDATE refresh_tokens SET token = $1 WHERE id = $2', [newRefresh, rows[0].id]);
    res.json({ accessToken, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const { rows } = await query(`
      SELECT id FROM users WHERE email_verify_token = $1 AND email_verify_expires > NOW()
    `, [token]);
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired verification link' });
    await query('UPDATE users SET email_verified = true, email_verify_token = null, email_verify_expires = null WHERE id = $1', [rows[0].id]);
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [body('email').isEmail()], async (req, res) => {
  const { email } = req.body;
  try {
    const { rows } = await query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (!rows[0]) return res.json({ message: 'If that email exists, a reset link was sent.' });
    const token = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await query('UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3', [token, expires, rows[0].id]);
    const tmpl = emailTemplates.passwordReset(rows[0].name, token);
    await sendEmail({ to: email, ...tmpl });
    res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    res.status(500).json({ error: 'Request failed' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Z])(?=.*[0-9])/),
], async (req, res) => {
  const { token, password } = req.body;
  try {
    const { rows } = await query('SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()', [token]);
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link' });
    const hash = await bcrypt.hash(password, 12);
    await query('UPDATE users SET password_hash = $1, password_reset_token = null, password_reset_expires = null WHERE id = $2', [hash, rows[0].id]);
    res.json({ message: 'Password reset successfully' });
  } catch {
    res.status(500).json({ error: 'Reset failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
  res.json({ message: 'Logged out' });
});

module.exports = router;
