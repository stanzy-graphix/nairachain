# 🇳🇬 NairaChain — P2P Crypto Exchange

A full-stack P2P crypto exchange for Nigeria. Trade Bitcoin, USDT, and Ethereum for Naira with escrow protection.

---

## 🗂️ Project Structure

```
nairachain/
├── backend/          Node.js + Express API
│   ├── src/
│   │   ├── index.js          Main server + Socket.IO
│   │   ├── db/
│   │   │   ├── index.js      PostgreSQL pool
│   │   │   └── migrate.js    DB schema migration
│   │   ├── middleware/
│   │   │   └── auth.js       JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js       Register, login, verify email, password reset
│   │   │   ├── wallet.js     Balances, deposit addresses, withdrawals
│   │   │   ├── offers.js     Create/browse P2P offers
│   │   │   ├── trades.js     Escrow, trade flow, chat, ratings
│   │   │   ├── admin.js      Admin panel — disputes, users, stats
│   │   │   └── users.js      User profiles
│   │   └── services/
│   │       └── email.js      Email templates (Nodemailer)
│
└── frontend/         Next.js 14 + Tailwind CSS
    └── src/
        ├── app/
        │   ├── page.tsx              Home
        │   ├── market/               P2P Marketplace
        │   ├── trades/               Trade history + trade detail + new trade
        │   ├── wallet/               Crypto wallet
        │   ├── admin/                Admin panel
        │   └── auth/                 Login, register, forgot/reset password
        ├── components/
        │   ├── Navbar.tsx
        │   └── ui/index.tsx          Button, Input, Card, Badge, etc.
        └── lib/
            ├── api.ts                Axios client (all endpoints)
            ├── store.ts              Zustand auth store
            └── utils.ts              Formatters, helpers
```

---

## 🚀 Setup Instructions

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

---

### 2. Database Setup

```bash
# Create database
psql -U postgres
CREATE DATABASE nairachain;
\q
```

---

### 3. Backend Setup

```bash
cd backend
npm install

# Copy and fill environment variables
cp .env.example .env
# Edit .env with your DB credentials, SMTP, JWT secrets

# Run database migration (creates all tables)
node src/db/migrate.js

# Start development server
npm run dev
# → API running on http://localhost:5000
```

**Required .env values:**
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random 32+ char string |
| `JWT_REFRESH_SECRET` | Different random 32+ char string |
| `SMTP_HOST/USER/PASS` | Gmail or Mailtrap credentials |
| `FRONTEND_URL` | http://localhost:3000 |

---

### 4. Frontend Setup

```bash
cd frontend
npm install

# Copy env
cp .env.local.example .env.local

# Start dev server
npm run dev
# → App running on http://localhost:3000
```

---

### 5. Create Admin User

After running the backend, manually update a user to admin in PostgreSQL:

```sql
UPDATE users SET is_admin = true, email_verified = true, kyc_status = 'verified'
WHERE email = 'your@email.com';
```

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh JWT |
| GET | `/api/auth/verify-email?token=` | Verify email |
| POST | `/api/auth/forgot-password` | Request reset |
| POST | `/api/auth/reset-password` | Set new password |
| GET | `/api/auth/me` | Get current user |

### Wallet
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/wallet` | All wallet balances |
| GET | `/api/wallet/:crypto/deposit-address` | Get deposit address |
| POST | `/api/wallet/withdraw` | Request withdrawal |
| GET | `/api/wallet/transactions` | Transaction history |

### Offers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/offers` | Browse offers (filterable) |
| POST | `/api/offers` | Create offer |
| PATCH | `/api/offers/:id/status` | Pause/close offer |

### Trades (Escrow)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/trades` | Accept offer, start trade |
| GET | `/api/trades` | My trades |
| GET | `/api/trades/:ref` | Trade detail + chat |
| PATCH | `/api/trades/:ref/payment-sent` | Buyer marks paid |
| PATCH | `/api/trades/:ref/confirm-payment` | Seller releases crypto |
| PATCH | `/api/trades/:ref/dispute` | Open dispute |
| POST | `/api/trades/:ref/message` | Send chat message |
| POST | `/api/trades/:ref/rate` | Rate trader |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | Platform stats |
| GET | `/api/admin/users` | All users |
| PATCH | `/api/admin/users/:id/freeze` | Freeze/unfreeze |
| PATCH | `/api/admin/users/:id/kyc` | Update KYC |
| GET | `/api/admin/disputes` | Open disputes |
| PATCH | `/api/admin/disputes/:id/resolve` | Resolve dispute |

---

## 🔐 Security Features

- JWT access tokens (15min) + refresh tokens (7 days)
- Bcrypt password hashing (12 rounds)
- Email verification required
- Rate limiting on all routes (stricter on auth)
- Helmet.js security headers
- Account freeze by admin
- KYC status checks
- Escrow timeout (30 min configurable)
- Input validation on all endpoints

---

## 💰 Fee System

- **0.5% trading fee** on all completed trades
- Fee deducted from Naira amount
- Tracked in `trades.fee_amount` column
- Visible in admin transaction dashboard

---

## 🚢 Deployment

### Backend → Railway or Render
1. Push `backend/` to GitHub
2. Connect to Railway/Render
3. Add environment variables
4. Set start command: `node src/index.js`
5. Add PostgreSQL plugin (Railway auto-configures DATABASE_URL)

### Frontend → Vercel
1. Push `frontend/` to GitHub
2. Import to Vercel
3. Set `NEXT_PUBLIC_API_URL` = your backend URL
4. Deploy

---

## ⚙️ Production Checklist

- [ ] Replace mock deposit addresses with Coinbase Commerce / Binance Pay API
- [ ] Add KYC document upload (ID card, selfie)
- [ ] Add real-time price feed (CoinGecko API)
- [ ] Set up automated escrow expiry cron job
- [ ] Configure proper SSL and domain
- [ ] Set up monitoring (Sentry, Datadog)
- [ ] Add SMS notifications (Termii for Nigeria)
- [ ] Add 2FA authentication
