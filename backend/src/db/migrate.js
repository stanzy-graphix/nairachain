const { Pool } = require('pg');
require('dotenv').config();

const TX_TYPES = [
  'deposit', 'withdrawal', 'trade_buy', 'trade_sell', 'fee',
  'escrow_lock', 'escrow_release', 'escrow_return',
];

const migrate = async (pool) => {
  const client = await pool.connect();
  try {
    // Naira signs and names need UTF8; Windows installs sometimes default to WIN1252
    const { rows: enc } = await client.query("SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = current_database()");
    if (enc[0].enc !== 'UTF8') {
      throw new Error(`Database encoding is ${enc[0].enc}; NairaChain needs UTF8. Recreate it with: CREATE DATABASE nairachain ENCODING 'UTF8' TEMPLATE template0;`);
    }

    await client.query('BEGIN');

    // gen_random_uuid() is built in from PG13; pgcrypto provides it on older versions
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

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
        last_seen_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ');

    // WALLETS
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        crypto_type VARCHAR(10) NOT NULL CHECK (crypto_type IN ('BTC','ETH','USDT')),
        balance DECIMAL(28,8) DEFAULT 0 CHECK (balance >= 0),
        locked_balance DECIMAL(28,8) DEFAULT 0 CHECK (locked_balance >= 0),
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
        terms TEXT,
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','paused','closed')),
        total_trades INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('ALTER TABLE offers ADD COLUMN IF NOT EXISTS terms TEXT');

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
        seller_bank_name VARCHAR(100),
        seller_bank_account_name VARCHAR(100),
        seller_bank_account_number VARCHAR(20),
        payment_sent_at TIMESTAMPTZ,
        payment_confirmed_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        cancel_reason TEXT,
        expires_at TIMESTAMPTZ,
        dispute_reason TEXT,
        disputed_by UUID REFERENCES users(id),
        dispute_resolved_by UUID REFERENCES users(id),
        dispute_resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    for (const col of [
      'seller_bank_name VARCHAR(100)',
      'seller_bank_account_name VARCHAR(100)',
      'seller_bank_account_number VARCHAR(20)',
      'cancelled_at TIMESTAMPTZ',
      'cancel_reason TEXT',
      'disputed_by UUID REFERENCES users(id)',
    ]) {
      await client.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS ${col}`);
    }

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

    // TRANSACTIONS (deposit/withdraw/escrow history)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        trade_id UUID REFERENCES trades(id),
        type VARCHAR(20) NOT NULL,
        crypto VARCHAR(10),
        amount DECIMAL(28,8) NOT NULL,
        fee DECIMAL(28,8) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
        tx_hash VARCHAR(255),
        notes TEXT,
        processed_by UUID REFERENCES users(id),
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(id)');
    await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ');
    // (Re)create the type constraint so older databases pick up new transaction types
    await client.query('ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check');
    await client.query(`ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN (${TX_TYPES.map(t => `'${t}'`).join(',')}))`);

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
    await client.query('CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_offers_crypto ON offers(crypto)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_trades_expires ON trades(expires_at) WHERE status = \'pending_payment\'');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_trade ON trade_messages(trade_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)');

    await client.query('COMMIT');
    console.log('✅ Migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { migrate };

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: require('./index').ssl });
  migrate(pool)
    .then(() => pool.end())
    .catch(() => { pool.end(); process.exit(1); });
}
