const jwt = require('jsonwebtoken');
const { query } = require('../db');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query('SELECT id, name, email, is_admin, is_frozen, email_verified, kyc_status FROM users WHERE id = $1', [decoded.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    if (rows[0].is_frozen) return res.status(403).json({ error: 'Account is frozen. Contact support.' });
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
};

const requireVerified = (req, res, next) => {
  if (!req.user?.email_verified) return res.status(403).json({ error: 'Please verify your email first' });
  next();
};

module.exports = { authenticate, requireAdmin, requireVerified };
