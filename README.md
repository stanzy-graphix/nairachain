# 🇳🇬 NairaChain — P2P Crypto Exchange

A full-stack P2P crypto exchange for Nigeria. Trade Bitcoin, USDT, and Ethereum for Naira with escrow protection.

- **Backend:** Node.js + Express + PostgreSQL + Socket.IO
- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + Zustand

---

## 🗂️ Project Structure

```
nairachain/
├── docker-compose.yml        Local PostgreSQL
├── backend/
│   ├── src/
│   │   ├── index.js          Express server, Socket.IO (JWT-authenticated trade rooms), escrow expiry job
│   │   ├── db/
│   │   │   ├── index.js      PostgreSQL pool
│   │   │   ├── migrate.js    Idempotent schema migration
│   │   │   └── seed.js       Dev data: admin, two traders with balances, sample offers
│   │   ├── middleware/       auth.js (JWT, admin, verified), validate.js
│   │   ├── routes/           auth, wallet, offers, trades, admin, users
│   │   ├── services/
│   │   │   ├── escrow.js       Lock / release / refund ledger operations
│   │   │   ├── escrowExpiry.js Auto-cancels unpaid trades and refunds escrow
│   │   │   ├── prices.js       CoinGecko NGN prices (cached, with fallback)
│   │   │   └── email.js        Nodemailer templates (console fallback in dev)
│   │   └── utils/serialize.js
│   └── test/e2e.test.js      End-to-end API test of the full trade lifecycle
└── frontend/src/
    ├── app/
    │   ├── page.tsx              Home (live rates)
    │   ├── market/               Marketplace, create offer, manage my offers
    │   ├── trades/               List · new trade · trade room (chat, countdown, actions)
    │   ├── wallet/               Balances, deposit (QR), withdraw, history
    │   ├── profile/              Profile + feedback
    │   ├── admin/                Stats, disputes, withdrawals, users/KYC/credit, transactions
    │   └── auth/                 login · register · verify · forgot-password · reset-password
    ├── components/               Navbar, AuthGuard, Providers, VerifyBanner, ui/
    └── lib/                      api.ts (axios + token refresh), store.ts, usePrices.ts, utils.ts
```

---

## 🚀 Quick Start (local)

Prerequisites: Node.js 18+, and either Docker or PostgreSQL 14+.

```bash
# 1. Database
docker compose up -d db

# 2. Backend
cd backend
npm install
cp .env.example .env          # set JWT secrets; DATABASE_URL already matches docker-compose
npm run migrate
npm run seed                  # optional dev data
npm run dev                   # → http://localhost:5000

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                   # → http://localhost:3000
```

**Seeded dev accounts** (all KYC-verified; password is `SEED_PASSWORD` or the default in `backend/src/db/seed.js`):

| Role | Email |
|---|---|
| Admin | `admin@nairachain.test` |
| Trader (has BTC/ETH/USDT) | `tunde@nairachain.test` |
| Trader (has BTC/ETH/USDT) | `chioma@nairachain.test` |

**Email in development:** leave `SMTP_HOST` empty and emails are printed to the backend console. Register, resend-verification and forgot-password also return the link in the API response, and the UI shows it as a "Development" link.

**Run the API test** (with the backend running on a seeded DB): `cd backend && npm test`

### Making an admin manually

```sql
UPDATE users SET is_admin = true, email_verified = true, kyc_status = 'verified' WHERE email = 'your@email.com';
```

---

## 🔄 Trade Lifecycle

1. **Open** — a user takes an offer. The seller's crypto moves from `balance` to `locked_balance` (escrow) in the same DB transaction.
   - Sell offer: the taker is the buyer and pays into the offer owner's bank account.
   - Buy offer: the taker is the seller, and must supply their own bank details for the buyer to pay into.
2. **Payment sent** — the buyer transfers Naira and taps "I have sent payment". The buyer can cancel before this step.
3. **Release** — the seller confirms receipt. Escrow is released to the buyer, and the 0.5% fee is recorded on the trade.
4. **Expiry** — if the buyer doesn't mark payment within `ESCROW_TIMEOUT_MINUTES`, a background job cancels the trade and refunds the seller.
5. **Dispute** — after payment is marked as sent, either party can dispute. An admin reviews the chat log and releases to the buyer or returns to the seller.

All balance changes run in transactions with row locks, and every movement is written to `transactions`.

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account (+ wallets) |
| POST | `/api/auth/login` | Login → access + refresh token |
| POST | `/api/auth/refresh` | Rotate refresh token |
| GET | `/api/auth/verify-email?token=` | Verify email |
| POST | `/api/auth/resend-verification` | Resend verification email |
| POST | `/api/auth/forgot-password` | Request reset |
| POST | `/api/auth/reset-password` | Set new password (signs out all sessions) |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Revoke refresh token |

### Users · Prices
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/:id/profile` | Public profile + recent ratings |
| PATCH | `/api/users/profile` | Update name/phone |
| GET | `/api/prices` | NGN prices for BTC/ETH/USDT |

### Wallet
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/wallet` | Balances, withdrawal fees and minimums |
| GET | `/api/wallet/:crypto/deposit-address` | Deposit address (mock in MVP) |
| POST | `/api/wallet/withdraw` | Request withdrawal (KYC required; queued for admin) |
| GET | `/api/wallet/transactions` | Transaction history |

### Offers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/offers` | Browse (`crypto`, `type`, `sort=price_asc|price_desc|rating`) |
| GET | `/api/offers/my/offers` | My offers |
| GET | `/api/offers/:id` | Offer detail |
| POST | `/api/offers` | Create offer |
| PATCH | `/api/offers/:id/status` | Open / pause / close |

### Trades (Escrow)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/trades` | Take an offer, lock escrow |
| GET | `/api/trades` | My trades |
| GET | `/api/trades/:ref` | Trade detail + chat |
| PATCH | `/api/trades/:ref/payment-sent` | Buyer marks paid |
| PATCH | `/api/trades/:ref/confirm-payment` | Seller releases crypto |
| PATCH | `/api/trades/:ref/cancel` | Buyer cancels (before paying) |
| PATCH | `/api/trades/:ref/dispute` | Open dispute (after payment sent) |
| POST | `/api/trades/:ref/message` | Chat message |
| POST | `/api/trades/:ref/rate` | Rate counterparty |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | Platform stats |
| GET | `/api/admin/users` | Users |
| PATCH | `/api/admin/users/:id/freeze` | Freeze/unfreeze (revokes sessions, pauses offers) |
| PATCH | `/api/admin/users/:id/kyc` | Update KYC |
| POST | `/api/admin/users/:id/credit` | Record a confirmed deposit |
| GET | `/api/admin/disputes` | Open disputes with chat logs |
| PATCH | `/api/admin/disputes/:tradeId/resolve` | `{ winner: 'buyer' | 'seller' }` |
| GET | `/api/admin/withdrawals` | Withdrawal queue |
| PATCH | `/api/admin/withdrawals/:id` | `{ action: 'approve' | 'reject', txHash?, reason? }` |
| GET | `/api/admin/transactions` | All transactions |

### Socket.IO
Connect with `auth: { token: <accessToken> }`, then emit `join_trade(tradeId)`. Only trade parties (and admins) can join. The server emits `new_message` and `trade_status`.

---

## 🔐 Security Features

- JWT access tokens (15 min) + rotating refresh tokens (7 days), revoked on logout, password reset and freeze
- Bcrypt password hashing (12 rounds)
- Email verification required to deposit, create offers and trade; KYC required to withdraw
- Rate limiting (strict on credential endpoints), Helmet headers, CORS locked to `FRONTEND_URL`
- Input validation on all write endpoints; DB `CHECK` constraints prevent negative balances
- Bank account numbers are hidden from public offer listings and shown only to trade parties
- Authenticated Socket.IO rooms (no client-side broadcast)

---

## 💰 Fees

- **0.5% trading fee**, recorded in `trades.fee_amount` on each trade and summed in the admin dashboard
- Flat network fee on withdrawals (BTC 0.00005 · ETH 0.0005 · USDT 1), configured in `backend/src/routes/wallet.js`

---

## 🚢 Deployment

**Backend → Railway / Render:** set the env vars from `.env.example` (`NODE_ENV=production`, real JWT secrets, SMTP, `FRONTEND_URL`), set the start command to `npm start`, and run `npm run migrate` once. The escrow expiry job runs inside the API process; if you run several instances, set `DISABLE_ESCROW_JOB=true` on all but one. It uses `SKIP LOCKED`, so overlapping runs are safe anyway.

**Frontend → Vercel:** set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL`.

---

## ⚙️ Before Going Live

These remain stubs or manual steps by design:

- [ ] Replace mock deposit addresses and admin "credit" with a custody provider (HD wallet, Coinbase/Binance/Fireblocks) and deposit webhooks
- [ ] Automate withdrawal broadcasting (currently approved by an admin with a tx hash)
- [ ] KYC document upload and provider integration (currently admin-set status)
- [ ] 2FA, SMS notifications (e.g. Termii)
- [ ] Monitoring (Sentry), backups, SSL and domain
