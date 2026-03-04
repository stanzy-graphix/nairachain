require('dotenv').config()
const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')
const helmet     = require('helmet')
const morgan     = require('morgan')
const rateLimit  = require('express-rate-limit')
const jwt        = require('jsonwebtoken')

const app    = express()
const server = http.createServer(app)

// ─── Socket.io ────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})

// Socket.io auth + trade chat rooms
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) return next(new Error('Auth required'))
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    socket.userId = decoded.id
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.userId}`)

  socket.on('join_trade', (tradeId) => {
    socket.join(`trade:${tradeId}`)
  })

  socket.on('trade_message', ({ tradeId, content }) => {
    // Broadcast to all in trade room
    io.to(`trade:${tradeId}`).emit('trade_message', {
      sender_id: socket.userId,
      content,
      created_at: new Date(),
    })
  })

  // Emit trade status updates
  socket.on('trade_status_update', (data) => {
    io.to(`trade:${data.tradeId}`).emit('trade_status_update', data)
  })

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.userId}`)
  })
})

// Make io accessible in routes
app.set('io', io)

// ─── Middleware ───────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      Number(process.env.RATE_LIMIT_MAX)        || 100,
  message: { message: 'Too many requests, please try again later.' },
})
app.use('/api/', limiter)

// Auth-specific stricter limiter
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { message: 'Too many login attempts.' } })
app.use('/api/auth/login',    authLimiter)
app.use('/api/auth/signup',   authLimiter)

// ─── Routes ───────────────────────────────────────────
app.use('/api/auth',   require('./routes/auth'))
app.use('/api/wallet', require('./routes/wallet'))
app.use('/api/offers', require('./routes/offers'))
app.use('/api/trades', require('./routes/trades'))
app.use('/api/admin',  require('./routes/admin'))

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }))

// 404
app.use((req, res) => res.status(404).json({ message: 'Route not found' }))

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
})

// ─── Start ────────────────────────────────────────────
const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`
╔═════════════════════════════════════════╗
║   NairaChain Backend  ·  Port ${PORT}       ║
║   Environment: ${process.env.NODE_ENV || 'development'}               ║
╚═════════════════════════════════════════╝
  `)
})

module.exports = { app, io }
