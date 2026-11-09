const { getClient } = require('../db');
const escrow = require('./escrow');

// Cancels trades whose payment window has passed without the buyer marking
// payment as sent, and returns the locked crypto to the seller.
const expireTrades = async (io) => {
  const client = await getClient();
  const expired = [];
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT * FROM trades
      WHERE status = 'pending_payment' AND expires_at < NOW()
      FOR UPDATE SKIP LOCKED
    `);
    for (const trade of rows) {
      await escrow.refund(client, trade, trade.buyer_id, 'Payment window expired');
      expired.push(trade);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Escrow expiry job failed:', err.message);
    return [];
  } finally {
    client.release();
  }
  for (const t of expired) {
    io?.to(`trade:${t.id}`).emit('trade_status', { tradeId: t.id, status: 'cancelled' });
  }
  if (expired.length) console.log(`⏱  Expired ${expired.length} trade(s): ${expired.map(t => t.trade_ref).join(', ')}`);
  return expired;
};

const startEscrowExpiryJob = (io, intervalMs = 60 * 1000) => {
  const timer = setInterval(() => expireTrades(io), intervalMs);
  timer.unref();
  expireTrades(io);
  return timer;
};

module.exports = { expireTrades, startEscrowExpiryJob };
