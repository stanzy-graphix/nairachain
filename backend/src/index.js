require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const offerRoutes = require('./routes/offers');
const tradeRoutes = require('./routes/trades');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');

const app = express();
const server = http.createServer(app);

// Socket.IO for real-time trade chat
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, methods: ['GET','POST'] }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many auth attempts' });
app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Socket.IO - Trade chat rooms
io.on('connection', (socket) => {
  socket.on('join_trade', (tradeId) => socket.join(`trade:${tradeId}`));
  socket.on('trade_message', (data) => {
    io.to(`trade:${data.tradeId}`).emit('new_message', data);
  });
  socket.on('trade_update', (data) => {
    io.to(`trade:${data.tradeId}`).emit('trade_status', data);
  });
});

app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 NairaChain API running on port ${PORT}`));
