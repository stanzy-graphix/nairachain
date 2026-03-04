const jwt = require('jsonwebtoken')
const pool = require('../config/db')

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' })
    }
    const token = header.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const result = await pool.query(
      'SELECT id, name, email, role, kyc_status, is_verified, is_frozen FROM users WHERE id = $1',
      [decoded.id]
    )
    if (!result.rows[0]) return res.status(401).json({ message: 'User not found' })
    if (result.rows[0].is_frozen) return res.status(403).json({ message: 'Account is frozen' })

    req.user = result.rows[0]
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' })
  }
  next()
}

const kycRequired = (req, res, next) => {
  if (req.user?.kyc_status !== 'verified') {
    return res.status(403).json({ message: 'KYC verification required to trade' })
  }
  next()
}

module.exports = { auth, adminOnly, kycRequired }
