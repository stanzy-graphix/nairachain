const jwt = require('jsonwebtoken');
const { query } = require('../db');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  let decoded;
  try {
    decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    // Touch last_seen_at (at most once a minute) for the "online" indicator
    const { rows } = await query(`
      UPDATE users SET last_seen_at = CASE WHEN last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '1 minute' THEN NOW() ELSE last_seen_at END
      WHERE id = $1
      RETURNING id, name, email, is_admin, is_frozen, email_verified, kyc_status
    `, [decoded.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    if (rows[0].is_frozen) return res.status(403).json({ error: 'Account is frozen. Contact support.' });
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
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
