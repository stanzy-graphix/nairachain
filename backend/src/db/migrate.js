const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // USERS
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending','verified','rejected')),
        is_admin BOOLEAN DEFAULT false,
        is_frozen BOOLEAN DEFAULT false,
        email_verified BOOLEAN DEFAULT false,
        email_verify_token VARCHAR(255),
        email_verify_expires TIMESTAMPTZ,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMPTZ,
        total_trades INTEGER DEFAULT 0,
        successful_trades INTEGER DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // WALLETS
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        crypto_type VARCHAR(10) NOT NULL CHECK (crypto_type IN ('BTC','ETH','USDT')),
        balance DECIMAL(28,8) DEFAULT 0,
        locked_balance DECIMAL(28,8) DEFAULT 0,
        deposit_address VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, crypto_type)
      )
    `);

    // OFFERS
    await client.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(4) NOT NULL CHECK (type IN ('buy','sell')),
        crypto VARCHAR(10) NOT NULL CHECK (crypto IN ('BTC','ETH','USDT')),
        price_per_unit DECIMAL(20,2) NOT NULL,
        min_amount DECIMAL(20,2) NOT NULL,
        max_amount DECIMAL(20,2) NOT NULL,
        payment_method VARCHAR(100) DEFAULT 'Bank Transfer',
        bank_name VARCHAR(100),
        bank_account_name VARCHAR(100),
        bank_account_number VARCHAR(20),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','paused','closed')),
        total_trades INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // TRADES
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trade_ref VARCHAR(20) UNIQUE NOT NULL,
        offer_id UUID NOT NULL REFERENCES offers(id),
        buyer_id UUID NOT NULL REFERENCES users(id),
        seller_id UUID NOT NULL REFERENCES users(id),
        crypto VARCHAR(10) NOT NULL,
        crypto_amount DECIMAL(28,8) NOT NULL,
        naira_amount DECIMAL(20,2) NOT NULL,
        price_per_unit DECIMAL(20,2) NOT NULL,
        fee_amount DECIMAL(20,2) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'pending_payment'
          CHECK (status IN ('pending_payment','payment_sent','confirming','completed','cancelled','disputed')),
        escrow_status VARCHAR(20) DEFAULT 'locked'
          CHECK (escrow_status IN ('locked','released','returned','none')),
        payment_sent_at TIMESTAMPTZ,
        payment_confirmed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        dispute_reason TEXT,
        dispute_resolved_by UUID REFERENCES users(id),
        dispute_resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // TRADE MESSAGES (chat)
    await client.query(`
      CREATE TABLE IF NOT EXISTS trade_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id),
        message TEXT NOT NULL,
        is_system BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // TRANSACTIONS (deposit/withdraw history)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        trade_id UUID REFERENCES trades(id),
        type VARCHAR(20) NOT NULL CHECK (type IN ('deposit','withdrawal','trade_buy','trade_sell','fee','escrow_lock','escrow_release')),
        crypto VARCHAR(10),
        amount DECIMAL(28,8) NOT NULL,
        fee DECIMAL(28,8) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
        tx_hash VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // RATINGS
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trade_id UUID NOT NULL REFERENCES trades(id),
        rater_id UUID NOT NULL REFERENCES users(id),
        rated_id UUID NOT NULL REFERENCES users(id),
        score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(trade_id, rater_id)
      )
    `);

    // REFRESH TOKENS
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // INDEXES
    await client.query(`CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_offers_crypto ON offers(crypto)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)`);

    await client.query('COMMIT');
    console.log('✅ Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
};

migrate();
