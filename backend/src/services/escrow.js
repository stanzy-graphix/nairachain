// Escrow ledger operations. Every function takes a pg client that is already
// inside a transaction, so callers control BEGIN/COMMIT.

const systemMessage = (client, tradeId, senderId, message) =>
  client.query('INSERT INTO trade_messages (trade_id, sender_id, message, is_system) VALUES ($1, $2, $3, true)',
    [tradeId, senderId, message]);

// Move crypto from seller's available balance into locked escrow.
// Returns false if the seller does not have enough available balance.
const lock = async (client, { sellerId, crypto, amount }) => {
  const { rowCount } = await client.query(`
    UPDATE wallets SET balance = balance - $1, locked_balance = locked_balance + $1
    WHERE user_id = $2 AND crypto_type = $3 AND balance >= $1
  `, [amount, sellerId, crypto]);
  return rowCount === 1;
};

// Release locked crypto to the buyer and mark the trade completed.
const release = async (client, trade, actorId, note) => {
  await client.query('UPDATE wallets SET locked_balance = locked_balance - $1 WHERE user_id = $2 AND crypto_type = $3',
    [trade.crypto_amount, trade.seller_id, trade.crypto]);
  await client.query(`
    INSERT INTO wallets (user_id, crypto_type, balance) VALUES ($1, $2, $3)
    ON CONFLICT (user_id, crypto_type) DO UPDATE SET balance = wallets.balance + $3
  `, [trade.buyer_id, trade.crypto, trade.crypto_amount]);

  const { rows } = await client.query(`
    UPDATE trades SET status = 'completed', escrow_status = 'released', payment_confirmed_at = NOW(), updated_at = NOW()
    WHERE id = $1 RETURNING *
  `, [trade.id]);

  await client.query(`
    INSERT INTO transactions (user_id, trade_id, type, crypto, amount, notes) VALUES
      ($1, $3, 'trade_buy', $4, $5, $6),
      ($2, $3, 'trade_sell', $4, $5, $7),
      ($2, $3, 'escrow_release', $4, $5, $8)
  `, [trade.buyer_id, trade.seller_id, trade.id, trade.crypto, trade.crypto_amount,
      `Bought ${trade.crypto_amount} ${trade.crypto} (${trade.trade_ref})`,
      `Sold ${trade.crypto_amount} ${trade.crypto} (${trade.trade_ref})`,
      `Escrow released for ${trade.trade_ref}`]);

  await client.query(`
    UPDATE users SET total_trades = total_trades + 1, successful_trades = successful_trades + 1, updated_at = NOW()
    WHERE id = ANY($1::uuid[])
  `, [[trade.buyer_id, trade.seller_id]]);
  await client.query('UPDATE offers SET total_trades = total_trades + 1 WHERE id = $1', [trade.offer_id]);

  await systemMessage(client, trade.id, actorId, note || `✅ Trade completed! ${trade.crypto_amount} ${trade.crypto} released to buyer.`);
  return rows[0];
};

// Return locked crypto to the seller and mark the trade cancelled.
const refund = async (client, trade, actorId, reason) => {
  await client.query(`
    UPDATE wallets SET locked_balance = locked_balance - $1, balance = balance + $1
    WHERE user_id = $2 AND crypto_type = $3
  `, [trade.crypto_amount, trade.seller_id, trade.crypto]);

  const { rows } = await client.query(`
    UPDATE trades SET status = 'cancelled', escrow_status = 'returned', cancelled_at = NOW(), cancel_reason = $2, updated_at = NOW()
    WHERE id = $1 RETURNING *
  `, [trade.id, reason]);

  await client.query(`INSERT INTO transactions (user_id, trade_id, type, crypto, amount, notes) VALUES ($1, $2, 'escrow_return', $3, $4, $5)`,
    [trade.seller_id, trade.id, trade.crypto, trade.crypto_amount, `Escrow returned for ${trade.trade_ref}: ${reason}`]);
  await client.query('UPDATE users SET total_trades = total_trades + 1, updated_at = NOW() WHERE id = ANY($1::uuid[])',
    [[trade.buyer_id, trade.seller_id]]);

  await systemMessage(client, trade.id, actorId, `❌ Trade cancelled: ${reason}. ${trade.crypto_amount} ${trade.crypto} returned to seller.`);
  return rows[0];
};

module.exports = { lock, release, refund, systemMessage };
