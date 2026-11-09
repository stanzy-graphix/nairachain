require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { query } = require('./db');
const { startEscrowExpiryJob } = require('./services/escrowExpiry');
const { getPrices } = require('./services/prices');

for (const key of ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET']) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const isProd = process.env.NODE_ENV === 'production';

const app = express();
const server = http.createServer(app);

// ─── Socket.IO: authenticated, per-trade rooms ─────────────────────────
const io = new Server(server, { cors: { origin: FRONTEND_URL, methods: ['GET', 'POST'], credentials: true } });

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Auth required'));
  try {
    socket.userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.on('join_trade', async (tradeId, ack) => {
    try {
      const { rows } = await query(
        'SELECT 1 FROM trades t JOIN users u ON u.id = $2 WHERE t.id = $1 AND (t.buyer_id = $2 OR t.seller_id = $2 OR u.is_admin)',
        [tradeId, socket.userId]);
      if (!rows[0]) return ack?.({ ok: false });
      socket.join(`trade:${tradeId}`);
      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false });
    }
  });
  socket.on('leave_trade', (tradeId) => socket.leave(`trade:${tradeId}`));
});

app.set('io', io);
app.set('trust proxy', 1);

// ─── Middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || (isProd ? 300 : 3000),
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || (isProd ? 10 : 100),
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' },
});
app.use('/api/', limiter);
// Only credential endpoints get the strict limiter (not /me or /refresh)
for (const p of ['login', 'register', 'forgot-password', 'reset-password', 'resend-verification']) {
  app.use(`/api/auth/${p}`, authLimiter);
}

// ─── Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/trades', require('./routes/trades'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/users', require('./routes/users'));

app.get('/api/prices', async (req, res) => {
  const { data, source, fetchedAt } = await getPrices();
  res.json({ prices: data, source, updatedAt: fetchedAt ? new Date(fetchedAt) : null });
});

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', timestamp: new Date() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down', timestamp: new Date() });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err.stack);
  res.status(err.status || 500).json({ error: isProd ? 'Internal server error' : err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 NairaChain API running on port ${PORT}`);
  if (process.env.DISABLE_ESCROW_JOB !== 'true') startEscrowExpiryJob(io);
});

module.exports = { app, server, io };
