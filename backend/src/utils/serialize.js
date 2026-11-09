// Shape returned to the frontend for the logged-in user.
const serializeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone || null,
  isAdmin: !!u.is_admin,
  kycStatus: u.kyc_status,
  emailVerified: !!u.email_verified,
  rating: u.rating !== undefined ? Number(u.rating) : undefined,
  totalTrades: u.total_trades,
  successfulTrades: u.successful_trades,
  createdAt: u.created_at,
});

const CRYPTOS = ['BTC', 'ETH', 'USDT'];

const isUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));

module.exports = { serializeUser, CRYPTOS, isUUID };
