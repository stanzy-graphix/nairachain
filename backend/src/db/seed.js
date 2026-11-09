// Development seed: an admin, two verified traders with balances, and sample offers.
// Usage: npm run seed   (refuses to run when NODE_ENV=production)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('./index');
const { migrate } = require('./migrate');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

// Development-only credentials. Override with SEED_PASSWORD if you like.
const PASSWORD = process.env.SEED_PASSWORD || 'Password123';

const USERS = [
  { name: 'NairaChain Admin', email: 'admin@nairachain.test', admin: true, balances: {} },
  { name: 'Tunde Adeyemi', email: 'tunde@nairachain.test', balances: { USDT: 5000, BTC: 0.05, ETH: 1.5 } },
  { name: 'Chioma Okafor', email: 'chioma@nairachain.test', balances: { USDT: 2500, BTC: 0.02, ETH: 0.5 } },
];

const OFFERS = [
  { owner: 'tunde@nairachain.test', type: 'sell', crypto: 'USDT', price: 1525, min: 5000, max: 2000000, bank: ['GTBank', 'Tunde Adeyemi', '0123456789'] },
  { owner: 'tunde@nairachain.test', type: 'sell', crypto: 'BTC', price: 98900000, min: 50000, max: 3000000, bank: ['GTBank', 'Tunde Adeyemi', '0123456789'] },
  { owner: 'chioma@nairachain.test', type: 'sell', crypto: 'ETH', price: 5180000, min: 20000, max: 1500000, bank: ['Access Bank', 'Chioma Okafor', '0987654321'] },
  { owner: 'chioma@nairachain.test', type: 'buy', crypto: 'USDT', price: 1510, min: 10000, max: 1000000, bank: [null, null, null] },
];

(async () => {
  await migrate(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(PASSWORD, 12);
    const ids = {};
    for (const u of USERS) {
      const { rows } = await client.query(`
        INSERT INTO users (name, email, password_hash, is_admin, email_verified, kyc_status)
        VALUES ($1, $2, $3, $4, true, 'verified')
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [u.name, u.email, hash, !!u.admin]);
      ids[u.email] = rows[0].id;
      for (const sym of ['BTC', 'ETH', 'USDT']) {
        const bal = u.balances[sym] || 0;
        await client.query(`
          INSERT INTO wallets (user_id, crypto_type, balance) VALUES ($1, $2, $3)
          ON CONFLICT (user_id, crypto_type) DO NOTHING
        `, [rows[0].id, sym, bal]);
        if (bal) {
          const { rowCount } = await client.query(
            "SELECT 1 FROM transactions WHERE user_id = $1 AND crypto = $2 AND notes = 'Seed deposit'", [rows[0].id, sym]);
          if (!rowCount) {
            await client.query("INSERT INTO transactions (user_id, type, crypto, amount, notes) VALUES ($1, 'deposit', $2, $3, 'Seed deposit')",
              [rows[0].id, sym, bal]);
          }
        }
      }
    }

    const { rows: existing } = await client.query('SELECT COUNT(*)::int as n FROM offers');
    if (existing[0].n === 0) {
      for (const o of OFFERS) {
        await client.query(`
          INSERT INTO offers (user_id, type, crypto, price_per_unit, min_amount, max_amount, bank_name, bank_account_name, bank_account_number)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [ids[o.owner], o.type, o.crypto, o.price, o.min, o.max, ...o.bank]);
      }
    }
    await client.query('COMMIT');
    console.log('🌱 Seed complete. Dev accounts (password from SEED_PASSWORD or the default in src/db/seed.js):');
    for (const u of USERS) console.log(`   ${u.admin ? 'admin ' : 'trader'}  ${u.email}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
