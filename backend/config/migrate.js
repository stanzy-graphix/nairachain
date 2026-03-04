require('dotenv').config()
const pool = require('./db')

const migrate = async () => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(120) NOT NULL,
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(20)  NOT NULL DEFAULT 'user',
        kyc_status    VARCHAR(20)  NOT NULL DEFAULT 'pending',
        is_verified   BOOLEAN      NOT NULL DEFAULT false,
        is_frozen     BOOLEAN      NOT NULL DEFAULT false,
        verify_token  VARCHAR(255),
        reset_token   VARCHAR(255),
        reset_expires TIMESTAMPTZ,
        total_trades  INTEGER      NOT NULL DEFAULT 0,
        rating        NUMERIC(3,1) NOT NULL DEFAULT 5.0,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `)

    // Wallets
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        crypto_type VARCHAR(10)    NOT NULL,
        balance     NUMERIC(20,8)  NOT NULL DEFAULT 0,
        locked      NUMERIC(20,8)  NOT NULL DEFAULT 0,
        address     VARCHAR(255),
        created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, crypto_type)
      );
    `)

    // Offers
    await client.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type           VARCHAR(4)    NOT NULL CHECK (type IN ('buy','sell')),
        crypto         VARCHAR(10)   NOT NULL,
        price          NUMERIC(20,2) NOT NULL,
        min_amount     NUMERIC(20,2) NOT NULL,
        max_amount     NUMERIC(20,2) NOT NULL,
        payment_method VARCHAR(60)   NOT NULL DEFAULT 'Bank Transfer',
        status         VARCHAR(20)   NOT NULL DEFAULT 'open',
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `)

    // Trades
    await client.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        offer_id       UUID NOT NULL REFERENCES offers(id),
        buyer_id       UUID NOT NULL REFERENCES users(id),
        seller_id      UUID NOT NULL REFERENCES users(id),
        crypto         VARCHAR(10)   NOT NULL,
        crypto_amount  NUMERIC(20,8) NOT NULL,
        naira_amount   NUMERIC(20,2) NOT NULL,
        fee_amount     NUMERIC(20,2) NOT NULL DEFAULT 0,
        rate           NUMERIC(20,2) NOT NULL,
        payment_method VARCHAR(60),
        status         VARCHAR(30)   NOT NULL DEFAULT 'pending',
        escrow_status  VARCHAR(20)   NOT NULL DEFAULT 'pending',
        dispute_reason TEXT,
        expires_at     TIMESTAMPTZ,
        completed_at   TIMESTAMPTZ,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `)

    // Messages (trade chat)
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trade_id   UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
        sender_id  UUID NOT NULL REFERENCES users(id),
        content    TEXT NOT NULL,
        is_system  BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // Transactions (wallet ledger)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID NOT NULL REFERENCES users(id),
        trade_id     UUID REFERENCES trades(id),
        type         VARCHAR(30) NOT NULL,
        crypto       VARCHAR(10) NOT NULL,
        amount       NUMERIC(20,8) NOT NULL,
        status       VARCHAR(20) NOT NULL DEFAULT 'pending',
        tx_hash      VARCHAR(255),
        address      VARCHAR(255),
        note         TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    // Ratings
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trade_id   UUID NOT NULL REFERENCES trades(id),
        rater_id   UUID NOT NULL REFERENCES users(id),
        rated_id   UUID NOT NULL REFERENCES users(id),
        score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
        comment    TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(trade_id, rater_id)
      );
    `)

    await client.query('COMMIT')
    console.log('✅ Database migrated successfully')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    client.release()
    pool.end()
  }
}

migrate()
