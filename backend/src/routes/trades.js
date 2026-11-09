const express = require('express');
const crypto = require('crypto');
const { body } = require('express-validator');
const { query, getClient } = require('../db');
const { authenticate, requireVerified } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sendEmailSafe, emailTemplates } = require('../services/email');
const escrow = require('../services/escrow');
const router = express.Router();

const FEE_RATE = 0.005; // 0.5%
const timeoutMinutes = () => parseInt(process.env.ESCROW_TIMEOUT_MINUTES || '30', 10);

const generateTradeRef = () => 'TRD-' + crypto.randomBytes(5).toString('hex').toUpperCase();

router.param('ref', (req, res, next, ref) => {
  if (!/^TRD-[A-Z0-9]{4,16}$/.test(ref)) return res.status(404).json({ error: 'Trade not found' });
  next();
});

const emit = (req, trade, event, payload) =>
  req.app.get('io')?.to(`trade:${trade.id}`).emit(event, { tradeId: trade.id, ...payload });

// Wraps a state-changing handler in a transaction with the trade row locked.
const withLockedTrade = (handler) => async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM trades WHERE trade_ref = $1 FOR UPDATE', [req.params.ref]);
    const trade = rows[0];
    if (!trade || (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id)) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Trade not found' });
    }
    const fail = async (status, error) => { await client.query('ROLLBACK'); res.status(status).json({ error }); return null; };
    const updated = await handler({ req, client, trade, fail });
    if (!updated) return;
    await client.query('COMMIT');
    emit(req, trade, 'trade_status', { status: updated.status });
    res.json({ trade: updated });
    return updated;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Failed to update trade' });
  } finally {
    client.release();
  }
};

// POST /api/trades - Take an offer and open an escrow-backed trade
router.post('/', authenticate, requireVerified, [
  body('offerId').isUUID().withMessage('Invalid offer'),
  body('nairaAmount').isFloat({ min: 100 }).withMessage('Amount must be at least ₦100').toFloat(),
  body('bankName').optional({ checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('bankAccountName').optional({ checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('bankAccountNumber').optional({ checkFalsy: true }).matches(/^\d{10}$/).withMessage('Account number must be 10 digits (NUBAN)'),
], validate, async (req, res) => {
  const { offerId, nairaAmount } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: offerRows } = await client.query(`
      SELECT o.* FROM offers o JOIN users u ON u.id = o.user_id
      WHERE o.id = $1 AND o.status = 'open' AND u.is_frozen = false FOR UPDATE OF o
    `, [offerId]);
    const offer = offerRows[0];
    const fail = async (status, error) => { await client.query('ROLLBACK'); return res.status(status).json({ error }); };

    if (!offer) return fail(404, 'Offer not found or no longer available');
    if (offer.user_id === req.user.id) return fail(400, "You can't trade with your own offer");
    if (nairaAmount < parseFloat(offer.min_amount) || nairaAmount > parseFloat(offer.max_amount)) {
      return fail(400, `Amount must be between ₦${Number(offer.min_amount).toLocaleString()} and ₦${Number(offer.max_amount).toLocaleString()}`);
    }

    const isSellOffer = offer.type === 'sell';
    const buyerId = isSellOffer ? req.user.id : offer.user_id;
    const sellerId = isSellOffer ? offer.user_id : req.user.id;

    // Bank account the buyer pays into always belongs to the seller
    const bank = isSellOffer
      ? { name: offer.bank_name, accountName: offer.bank_account_name, accountNumber: offer.bank_account_number }
      : { name: req.body.bankName, accountName: req.body.bankAccountName, accountNumber: req.body.bankAccountNumber };
    if (!isSellOffer && (!bank.name || !bank.accountName || !bank.accountNumber)) {
      return fail(400, 'Provide your bank details so the buyer can pay you');
    }

    const cryptoAmount = Number((nairaAmount / parseFloat(offer.price_per_unit)).toFixed(8));
    const feeAmount = Number((nairaAmount * FEE_RATE).toFixed(2));

    const locked = await escrow.lock(client, { sellerId, crypto: offer.crypto, amount: cryptoAmount });
    if (!locked) {
      return fail(400, isSellOffer ? 'Seller has insufficient balance for this amount' : `You need ${cryptoAmount} ${offer.crypto} available to sell`);
    }

    const minutes = timeoutMinutes();
    const tradeRef = generateTradeRef();
    const { rows: tradeRows } = await client.query(`
      INSERT INTO trades (trade_ref, offer_id, buyer_id, seller_id, crypto, crypto_amount, naira_amount, price_per_unit, fee_amount,
        seller_bank_name, seller_bank_account_name, seller_bank_account_number, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW() + make_interval(mins => $13)) RETURNING *
    `, [tradeRef, offerId, buyerId, sellerId, offer.crypto, cryptoAmount, nairaAmount, offer.price_per_unit, feeAmount,
        bank.name, bank.accountName, bank.accountNumber, minutes]);
    const trade = tradeRows[0];

    await client.query(`INSERT INTO transactions (user_id, trade_id, type, crypto, amount, notes) VALUES ($1, $2, 'escrow_lock', $3, $4, $5)`,
      [sellerId, trade.id, offer.crypto, cryptoAmount, `Escrow locked for trade ${tradeRef}`]);
    await escrow.systemMessage(client, trade.id, req.user.id,
      `Trade started. ₦${nairaAmount.toLocaleString()} for ${cryptoAmount} ${offer.crypto} is locked in escrow. Buyer should send payment within ${minutes} minutes.`);

    await client.query('COMMIT');

    const { rows: parties } = await query('SELECT id, name, email FROM users WHERE id = ANY($1::uuid[])', [[buyerId, sellerId]]);
    for (const p of parties) {
      const role = p.id === buyerId ? 'Buyer' : 'Seller';
      sendEmailSafe({ to: p.email, ...emailTemplates.tradeStarted(p.name, role, tradeRef, cryptoAmount, offer.crypto, minutes) });
    }

    res.status(201).json({ trade });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Failed to start trade' });
  } finally {
    client.release();
  }
});

// GET /api/trades - Current user's trades
router.get('/', authenticate, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  try {
    let sql = `
      SELECT t.*, buyer.name as buyer_name, buyer.rating as buyer_rating,
        seller.name as seller_name, seller.rating as seller_rating
      FROM trades t
      JOIN users buyer ON t.buyer_id = buyer.id
      JOIN users seller ON t.seller_id = seller.id
      WHERE (t.buyer_id = $1 OR t.seller_id = $1)
    `;
    const params = [req.user.id];
    if (req.query.status) { params.push(req.query.status); sql += ` AND t.status = $${params.length}`; }
    sql += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, (page - 1) * limit);
    const { rows } = await query(sql, params);
    res.json({ trades: rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// GET /api/trades/:ref - Trade detail + chat
router.get('/:ref', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT t.*,
        buyer.name as buyer_name, buyer.rating as buyer_rating,
        seller.name as seller_name, seller.rating as seller_rating,
        o.payment_method, o.terms, o.type as offer_type,
        EXISTS (SELECT 1 FROM ratings r WHERE r.trade_id = t.id AND r.rater_id = $2) as has_rated
      FROM trades t
      JOIN users buyer ON t.buyer_id = buyer.id
      JOIN users seller ON t.seller_id = seller.id
      JOIN offers o ON t.offer_id = o.id
      WHERE t.trade_ref = $1 AND (t.buyer_id = $2 OR t.seller_id = $2)
    `, [req.params.ref, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Trade not found' });

    const { rows: messages } = await query(`
      SELECT m.*, u.name as sender_name FROM trade_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.trade_id = $1 ORDER BY m.created_at ASC
    `, [rows[0].id]);

    res.json({ trade: rows[0], messages, serverTime: new Date() });
  } catch {
    res.status(500).json({ error: 'Failed to fetch trade' });
  }
});

// PATCH /api/trades/:ref/payment-sent - Buyer marks Naira payment as sent
router.patch('/:ref/payment-sent', authenticate, withLockedTrade(async ({ req, client, trade, fail }) => {
  if (trade.buyer_id !== req.user.id) return fail(403, 'Only the buyer can mark payment as sent');
  if (trade.status !== 'pending_payment') return fail(400, `Trade is already ${trade.status.replace('_', ' ')}`);
  if (new Date(trade.expires_at) < new Date()) return fail(400, 'Payment window has expired');

  const { rows } = await client.query(
    "UPDATE trades SET status = 'payment_sent', payment_sent_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *", [trade.id]);
  await escrow.systemMessage(client, trade.id, req.user.id, '💸 Buyer has marked payment as sent. Seller, please confirm receipt in your bank account.');
  return rows[0];
}));

// PATCH /api/trades/:ref/confirm-payment - Seller confirms receipt; escrow releases crypto
router.patch('/:ref/confirm-payment', authenticate, async (req, res, next) => {
  const updated = await withLockedTrade(async ({ req: r, client, trade, fail }) => {
    if (trade.seller_id !== r.user.id) return fail(403, 'Only the seller can confirm payment');
    if (!['payment_sent', 'confirming'].includes(trade.status)) return fail(400, `Cannot confirm a trade that is ${trade.status.replace('_', ' ')}`);
    return escrow.release(client, trade, r.user.id);
  })(req, res, next);

  if (updated) {
    const { rows } = await query('SELECT name, email FROM users WHERE id = ANY($1::uuid[])', [[updated.buyer_id, updated.seller_id]]);
    for (const p of rows) sendEmailSafe({ to: p.email, ...emailTemplates.tradeCompleted(p.name, updated.trade_ref, updated.crypto_amount, updated.crypto) });
  }
});

// PATCH /api/trades/:ref/cancel - Buyer cancels before paying; escrow returns to seller
router.patch('/:ref/cancel', authenticate, withLockedTrade(async ({ req, client, trade, fail }) => {
  if (trade.buyer_id !== req.user.id) return fail(403, 'Only the buyer can cancel. Sellers can open a dispute instead.');
  if (trade.status !== 'pending_payment') return fail(400, 'Only trades awaiting payment can be cancelled');
  return escrow.refund(client, trade, req.user.id, 'Cancelled by buyer');
}));

// PATCH /api/trades/:ref/dispute - Either party escalates to an admin
router.patch('/:ref/dispute', authenticate, [
  body('reason').isString().trim().isLength({ min: 10, max: 1000 }).withMessage('Describe the issue (10–1000 characters)'),
], validate, async (req, res, next) => {
  const updated = await withLockedTrade(async ({ req: r, client, trade, fail }) => {
    // Disputes are for when Naira has (supposedly) moved; before that, buyers cancel and expiry handles no-shows
    if (trade.status !== 'payment_sent') return fail(400, 'Disputes can only be opened after payment is marked as sent');
    const { rows } = await client.query(
      "UPDATE trades SET status = 'disputed', dispute_reason = $1, disputed_by = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
      [r.body.reason, r.user.id, trade.id]);
    await escrow.systemMessage(client, trade.id, r.user.id, `⚠️ Dispute opened by ${r.user.name}: ${r.body.reason}. Escrow is frozen until an admin resolves it.`);
    return rows[0];
  })(req, res, next);

  if (updated && process.env.ADMIN_EMAIL) {
    sendEmailSafe({ to: process.env.ADMIN_EMAIL, ...emailTemplates.disputeOpened(updated.trade_ref, req.body.reason) });
  }
});

// POST /api/trades/:ref/message - Chat
router.post('/:ref/message', authenticate, [
  body('message').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1–1000 characters'),
], validate, async (req, res) => {
  try {
    const { rows: tradeRows } = await query('SELECT id, buyer_id, seller_id, status FROM trades WHERE trade_ref = $1', [req.params.ref]);
    const trade = tradeRows[0];
    if (!trade || (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id)) return res.status(404).json({ error: 'Trade not found' });
    if (['completed', 'cancelled'].includes(trade.status)) return res.status(400).json({ error: 'This trade is closed' });

    const { rows } = await query('INSERT INTO trade_messages (trade_id, sender_id, message) VALUES ($1, $2, $3) RETURNING *',
      [trade.id, req.user.id, req.body.message]);
    const msg = { ...rows[0], sender_name: req.user.name };
    emit(req, trade, 'new_message', msg);
    res.status(201).json({ message: msg });
  } catch {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/trades/:ref/rate - Rate counterparty after completion
router.post('/:ref/rate', authenticate, [
  body('score').isInt({ min: 1, max: 5 }).withMessage('Score must be 1–5').toInt(),
  body('comment').optional({ checkFalsy: true }).isString().trim().isLength({ max: 500 }),
], validate, async (req, res) => {
  const { score, comment } = req.body;
  try {
    const { rows: tradeRows } = await query('SELECT * FROM trades WHERE trade_ref = $1', [req.params.ref]);
    const trade = tradeRows[0];
    if (!trade || (trade.buyer_id !== req.user.id && trade.seller_id !== req.user.id)) return res.status(404).json({ error: 'Trade not found' });
    if (trade.status !== 'completed') return res.status(400).json({ error: 'You can only rate completed trades' });

    const ratedId = trade.buyer_id === req.user.id ? trade.seller_id : trade.buyer_id;
    const { rowCount } = await query(`
      INSERT INTO ratings (trade_id, rater_id, rated_id, score, comment) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (trade_id, rater_id) DO NOTHING
    `, [trade.id, req.user.id, ratedId, score, comment || null]);
    if (!rowCount) return res.status(409).json({ error: 'You already rated this trade' });

    await query('UPDATE users SET rating = (SELECT AVG(score)::numeric(3,2) FROM ratings WHERE rated_id = $1) WHERE id = $1', [ratedId]);
    res.json({ message: 'Rating submitted' });
  } catch {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

module.exports = router;
