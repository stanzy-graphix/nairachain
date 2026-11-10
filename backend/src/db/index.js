const { Pool } = require('pg');
require('dotenv').config();

// DATABASE_SSL=true|false overrides the default (on in production, off otherwise).
// Managed databases such as RDS need it on; a local or compose Postgres needs it off.
const sslEnabled = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL === 'true'
  : process.env.NODE_ENV === 'production';
const ssl = sslEnabled ? { rejectUnauthorized: false } : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err);
});

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = { query, getClient, pool, ssl };
