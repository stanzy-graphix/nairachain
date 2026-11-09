const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');
const { query, getClient } = require('../db');
const { sendEmailSafe, emailTemplates, smtpConfigured } = require('../services/email');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { serializeUser, CRYPTOS } = require('../utils/serialize');
const router = express.Router();

const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_RULE = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/^(?=.*[A-Z])(?=.*[0-9])/).withMessage('Password needs at least 1 uppercase letter and 1 number');

const generateTokens = (userId) => ({
  accessToken: jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }),
  refreshToken: jwt.sign({ userId, jti: uuidv4() }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }),
});

// In local dev without SMTP, hand the link back so the flow is testable
const devLink = (path) => (!smtpConfigured && process.env.NODE_ENV !== 'production')
  ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}${path}` : undefined;

// POST /api/auth/register
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail({ gmail_remove_dots: false }),
  PASSWORD_RULE,
  body('phone').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Invalid phone number'),
], validate, async (req, res) => {
  const { name, email, password, phone } = req.body;
  const client = await getClient();
  try {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyToken = uuidv4();
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await client.query('BEGIN');
    const { rows } = await client.query(`
      INSERT INTO users (name, email, password_hash, phone, email_verify_token, email_verify_expires)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [name, email, passwordHash, phone || null, verifyToken, verifyExpires]);
    for (const crypto of CRYPTOS) {
      await client.query('INSERT INTO wallets (user_id, crypto_type) VALUES ($1, $2)', [rows[0].id, crypto]);
    }
    await client.query('COMMIT');

    sendEmailSafe({ to: email, ...emailTemplates.verifyEmail(name, verifyToken) });

    res.status(201).json({
      message: 'Account created. Please verify your email.',
      userId: rows[0].id,
      devVerifyUrl: devLink(`/auth/verify?token=${verifyToken}`),
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail({ gmail_remove_dots: false }),
  body('password').notEmpty().withMessage('Password required'),
], validate, async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.is_frozen) return res.status(403).json({ error: 'Account frozen. Contact support.' });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, new Date(Date.now() + REFRESH_MS)]);
    await query('DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()', [user.id]);
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

    res.json({ accessToken, refreshToken, user: serializeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh — rotates the refresh token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const { rows } = await query('SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2', [refreshToken, decoded.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'Invalid refresh token' });
    if (new Date(rows[0].expires_at) < new Date()) {
      await query('DELETE FROM refresh_tokens WHERE id = $1', [rows[0].id]);
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    const { rows: users } = await query('SELECT is_frozen FROM users WHERE id = $1', [decoded.userId]);
    if (!users[0] || users[0].is_frozen) return res.status(401).json({ error: 'Account unavailable' });

    const tokens = generateTokens(decoded.userId);
    await query('UPDATE refresh_tokens SET token = $1, expires_at = $2 WHERE id = $3',
      [tokens.refreshToken, new Date(Date.now() + REFRESH_MS), rows[0].id]);
    res.json(tokens);
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
      UPDATE users SET email_verified = true, email_verify_token = null, email_verify_expires = null, updated_at = NOW()
      WHERE email_verify_token = $1 AND email_verify_expires > NOW() RETURNING id
    `, [String(token)]);
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired verification link' });
    res.json({ message: 'Email verified successfully' });
  } catch {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/resend-verification (logged in)
router.post('/resend-verification', authenticate, async (req, res) => {
  if (req.user.email_verified) return res.json({ message: 'Email already verified' });
  try {
    const token = uuidv4();
    await query('UPDATE users SET email_verify_token = $1, email_verify_expires = $2 WHERE id = $3',
      [token, new Date(Date.now() + 24 * 60 * 60 * 1000), req.user.id]);
    sendEmailSafe({ to: req.user.email, ...emailTemplates.verifyEmail(req.user.name, token) });
    res.json({ message: 'Verification email sent', devVerifyUrl: devLink(`/auth/verify?token=${token}`) });
  } catch {
    res.status(500).json({ error: 'Failed to resend verification' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail({ gmail_remove_dots: false }),
], validate, async (req, res) => {
  const generic = { message: 'If that email exists, a reset link was sent.' };
  try {
    const { rows } = await query('SELECT id, name FROM users WHERE email = $1', [req.body.email]);
    if (!rows[0]) return res.json(generic);
    const token = uuidv4();
    await query('UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [token, new Date(Date.now() + 60 * 60 * 1000), rows[0].id]);
    sendEmailSafe({ to: req.body.email, ...emailTemplates.passwordReset(rows[0].name, token) });
    res.json({ ...generic, devResetUrl: devLink(`/auth/reset-password?token=${token}`) });
  } catch {
    res.status(500).json({ error: 'Request failed' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', [body('token').notEmpty().withMessage('Token required'), PASSWORD_RULE], validate, async (req, res) => {
  const { token, password } = req.body;
  try {
    const { rows } = await query('SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()', [token]);
    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired reset link' });
    const hash = await bcrypt.hash(password, 12);
    await query('UPDATE users SET password_hash = $1, password_reset_token = null, password_reset_expires = null, updated_at = NOW() WHERE id = $2', [hash, rows[0].id]);
    // Sign out all existing sessions
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [rows[0].id]);
    res.json({ message: 'Password reset successfully' });
  } catch {
    res.status(500).json({ error: 'Reset failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  res.json({ user: serializeUser(rows[0]) });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) await query('DELETE FROM refresh_tokens WHERE token = $1 AND user_id = $2', [refreshToken, req.user.id]);
  res.json({ message: 'Logged out' });
});

module.exports = router;
