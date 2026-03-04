const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const { v4: uuid } = require('uuid')
const { body, validationResult } = require('express-validator')
const pool  = require('../config/db')
const email = require('../services/emailService')
const { auth } = require('../middleware/auth')

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })

// ─── POST /api/auth/signup ────────────────────────────
router.post('/signup', [
  body('name').trim().notEmpty().withMessage('Name required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be 8+ characters'),
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg })

  const { name, email: emailAddr, password } = req.body
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [emailAddr])
    if (existing.rows[0]) return res.status(409).json({ message: 'Email already registered' })

    const hash = await bcrypt.hash(password, 12)
    const verifyToken = uuid()

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, verify_token)
       VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, kyc_status`,
      [name, emailAddr, hash, verifyToken]
    )
    const user = result.rows[0]

    // Create default wallets
    await pool.query(
      `INSERT INTO wallets (user_id, crypto_type) VALUES ($1,'USDT'),($1,'BTC'),($1,'ETH')`,
      [user.id]
    )

    // Send verification email (non-blocking)
    email.sendVerificationEmail(emailAddr, name, verifyToken).catch(console.error)

    res.status(201).json({ message: 'Account created. Check your email to verify.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ─── POST /api/auth/login ─────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const { email: emailAddr, password } = req.body
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email=$1', [emailAddr]
    )
    const user = result.rows[0]
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })
    if (user.is_frozen) return res.status(403).json({ message: 'Account is frozen. Contact support.' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' })

    const token = signToken(user.id)
    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, kyc_status: user.kyc_status,
        is_verified: user.is_verified,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// ─── GET /api/auth/me ─────────────────────────────────
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user })
})

// ─── POST /api/auth/verify-email ──────────────────────
router.post('/verify-email', async (req, res) => {
  const { token } = req.body
  try {
    const result = await pool.query(
      `UPDATE users SET is_verified=true, verify_token=NULL
       WHERE verify_token=$1 RETURNING id, name, email`,
      [token]
    )
    if (!result.rows[0]) return res.status(400).json({ message: 'Invalid or expired token' })
    res.json({ message: 'Email verified successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// ─── POST /api/auth/reset-password-request ────────────
router.post('/reset-password-request', async (req, res) => {
  const { email: emailAddr } = req.body
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [emailAddr])
    if (!result.rows[0]) return res.json({ message: 'If this email exists, a reset link was sent.' })

    const token = uuid()
    const expires = new Date(Date.now() + 3600000) // 1 hour
    await pool.query(`UPDATE users SET reset_token=$1, reset_expires=$2 WHERE email=$3`, [token, expires, emailAddr])

    email.sendPasswordResetEmail(emailAddr, result.rows[0].name, token).catch(console.error)
    res.json({ message: 'Reset link sent if email exists.' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// ─── POST /api/auth/reset-password ────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body
  if (!password || password.length < 8) return res.status(400).json({ message: 'Password must be 8+ characters' })
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE reset_token=$1 AND reset_expires > NOW()`, [token]
    )
    if (!result.rows[0]) return res.status(400).json({ message: 'Invalid or expired reset token' })

    const hash = await bcrypt.hash(password, 12)
    await pool.query(
      `UPDATE users SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE id=$2`,
      [hash, result.rows[0].id]
    )
    res.json({ message: 'Password reset successfully' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

module.exports = router
