const pool = require('../config/db')
const emailService = require('./emailService')

const FEE_RATE = 0.005 // 0.5%

const escrowService = {

  /**
   * Lock crypto in escrow when a trade is accepted.
   * The seller's available balance decreases; locked increases.
   */
  async lockCrypto(client, sellerId, crypto, amount) {
    const result = await client.query(
      `UPDATE wallets
       SET balance = balance - $1,
           locked  = locked  + $1,
           updated_at = NOW()
       WHERE user_id = $2 AND crypto_type = $3
         AND balance >= $1
       RETURNING *`,
      [amount, sellerId, crypto]
    )
    if (result.rowCount === 0) {
      throw new Error('Insufficient balance to lock in escrow')
    }
    return result.rows[0]
  },

  /**
   * Release crypto from escrow to buyer.
   * Deducts locked from seller, credits buyer.
   */
  async releaseCrypto(client, sellerId, buyerId, crypto, amount) {
    // Remove locked from seller
    await client.query(
      `UPDATE wallets SET locked = locked - $1 WHERE user_id = $2 AND crypto_type = $3`,
      [amount, sellerId, crypto]
    )
    // Credit buyer
    await client.query(
      `INSERT INTO wallets (user_id, crypto_type, balance)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, crypto_type) DO UPDATE
       SET balance = wallets.balance + $3`,
      [buyerId, crypto, amount]
    )
  },

  /**
   * Return locked crypto to seller (cancelled/dispute resolved for seller)
   */
  async returnToSeller(client, sellerId, crypto, amount) {
    await client.query(
      `UPDATE wallets
       SET balance = balance + $1,
           locked  = locked  - $1
       WHERE user_id = $2 AND crypto_type = $3`,
      [amount, sellerId, crypto]
    )
  },

  /**
   * Initiate a trade: lock escrow, create DB records.
   */
  async startTrade({ offerId, buyerId, nairaAmount }) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Get offer
      const offerRes = await client.query(
        `SELECT o.*, u.id as seller_id FROM offers o
         JOIN users u ON u.id = o.user_id
         WHERE o.id = $1 AND o.status = 'open'`,
        [offerId]
      )
      const offer = offerRes.rows[0]
      if (!offer) throw new Error('Offer not found or closed')
      if (offer.seller_id === buyerId) throw new Error('Cannot trade with yourself')
      if (nairaAmount < offer.min_amount) throw new Error(`Minimum is ₦${offer.min_amount}`)
      if (nairaAmount > offer.max_amount) throw new Error(`Maximum is ₦${offer.max_amount}`)

      const cryptoAmount = nairaAmount / offer.price
      const fee = nairaAmount * FEE_RATE

      // Lock crypto in escrow (for sell offers)
      if (offer.type === 'sell') {
        await escrowService.lockCrypto(client, offer.seller_id, offer.crypto, cryptoAmount)
      }

      // Create trade
      const tradeRes = await client.query(
        `INSERT INTO trades
           (offer_id, buyer_id, seller_id, crypto, crypto_amount, naira_amount, fee_amount, rate, payment_method, status, escrow_status, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending','locked', NOW() + INTERVAL '30 minutes')
         RETURNING *`,
        [offerId, buyerId, offer.seller_id, offer.crypto, cryptoAmount, nairaAmount, fee, offer.price, offer.payment_method]
      )
      const trade = tradeRes.rows[0]

      // System message
      await client.query(
        `INSERT INTO messages (trade_id, sender_id, content, is_system) VALUES ($1,$2,$3,true)`,
        [trade.id, buyerId, `Trade started. ${cryptoAmount.toFixed(6)} ${offer.crypto} locked in escrow.`]
      )

      await client.query('COMMIT')
      return trade
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  /**
   * Buyer marks payment as sent.
   */
  async markPaid(tradeId, buyerId) {
    const result = await pool.query(
      `UPDATE trades SET status = 'paid', updated_at = NOW()
       WHERE id = $1 AND buyer_id = $2 AND status = 'pending'
       RETURNING *`,
      [tradeId, buyerId]
    )
    if (!result.rows[0]) throw new Error('Cannot mark this trade as paid')
    return result.rows[0]
  },

  /**
   * Seller confirms payment received — releases crypto to buyer.
   */
  async confirmPayment(tradeId, sellerId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const tradeRes = await client.query(
        `SELECT * FROM trades WHERE id = $1 AND seller_id = $2 AND status = 'paid'`,
        [tradeId, sellerId]
      )
      const trade = tradeRes.rows[0]
      if (!trade) throw new Error('Cannot confirm this trade')

      // Release crypto to buyer
      await escrowService.releaseCrypto(
        client, trade.seller_id, trade.buyer_id,
        trade.crypto, Number(trade.crypto_amount)
      )

      // Update trade status
      await client.query(
        `UPDATE trades SET status='completed', escrow_status='released', completed_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [tradeId]
      )

      // Log transactions
      await client.query(
        `INSERT INTO transactions (user_id, trade_id, type, crypto, amount, status)
         VALUES ($1,$2,'trade_sell',$3,$4,'completed'), ($5,$2,'trade_buy',$3,$4,'completed')`,
        [trade.seller_id, tradeId, trade.crypto, trade.crypto_amount, trade.buyer_id]
      )

      // Update trade counts
      await client.query(
        `UPDATE users SET total_trades = total_trades + 1 WHERE id = ANY($1)`,
        [[trade.buyer_id, trade.seller_id]]
      )

      await client.query('COMMIT')
      return trade
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  /**
   * Cancel a trade — return crypto to seller.
   */
  async cancelTrade(tradeId, userId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const tradeRes = await client.query(
        `SELECT * FROM trades WHERE id=$1 AND (buyer_id=$2 OR seller_id=$2) AND status='pending'`,
        [tradeId, userId]
      )
      const trade = tradeRes.rows[0]
      if (!trade) throw new Error('Cannot cancel this trade')

      await escrowService.returnToSeller(client, trade.seller_id, trade.crypto, trade.crypto_amount)
      await client.query(`UPDATE trades SET status='cancelled', escrow_status='returned', updated_at=NOW() WHERE id=$1`, [tradeId])

      await client.query('COMMIT')
      return trade
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },

  /**
   * Open a dispute.
   */
  async openDispute(tradeId, userId, reason) {
    const result = await pool.query(
      `UPDATE trades SET status='disputed', dispute_reason=$1, updated_at=NOW()
       WHERE id=$2 AND (buyer_id=$3 OR seller_id=$3) AND status='paid'
       RETURNING *`,
      [reason, tradeId, userId]
    )
    if (!result.rows[0]) throw new Error('Cannot dispute this trade')

    // Notify admin
    emailService.sendDisputeOpened(
      process.env.ADMIN_EMAIL, result.rows[0], reason
    ).catch(console.error)

    return result.rows[0]
  },

  /**
   * Admin resolves dispute.
   */
  async resolveDispute(tradeId, resolution) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const tradeRes = await client.query(`SELECT * FROM trades WHERE id=$1 AND status='disputed'`, [tradeId])
      const trade = tradeRes.rows[0]
      if (!trade) throw new Error('Dispute not found')

      if (resolution === 'buyer') {
        await escrowService.releaseCrypto(client, trade.seller_id, trade.buyer_id, trade.crypto, trade.crypto_amount)
        await client.query(`UPDATE trades SET status='completed',escrow_status='released_to_buyer',updated_at=NOW() WHERE id=$1`, [tradeId])
      } else {
        await escrowService.returnToSeller(client, trade.seller_id, trade.crypto, trade.crypto_amount)
        await client.query(`UPDATE trades SET status='cancelled',escrow_status='returned',updated_at=NOW() WHERE id=$1`, [tradeId])
      }

      await client.query('COMMIT')
      return trade
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  },
}

module.exports = escrowService
