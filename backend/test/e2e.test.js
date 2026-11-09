// End-to-end API test. Requires a running API on a seeded database:
//   npm run seed && npm run dev   (in another terminal)
//   npm test
// Uses the dev accounts created by src/db/seed.js.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');

const API = process.env.API_URL || 'http://localhost:5000/api';
const PASSWORD = process.env.SEED_PASSWORD || 'Password123';

const call = async (method, path, token, body) => {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};
const login = async (email) => {
  const { status, data } = await call('POST', '/auth/login', null, { email, password: PASSWORD });
  assert.equal(status, 200, `login ${email}: ${JSON.stringify(data)}`);
  return data;
};
const balance = async (token, sym) => {
  const { data } = await call('GET', '/wallet', token);
  const w = data.wallets.find((x) => x.crypto_type === sym);
  return { available: Number(w.balance), locked: Number(w.locked_balance) };
};
const close = (a, b) => Math.abs(a - b) < 1e-8;

let admin, seller, buyer, sellOffer;

before(async () => {
  admin = await login('admin@nairachain.test');
  seller = await login('tunde@nairachain.test');
  buyer = await login('chioma@nairachain.test');
  // Fresh sell offer so tests don't depend on seed state
  const { status, data } = await call('POST', '/offers', seller.accessToken, {
    type: 'sell', crypto: 'USDT', pricePerUnit: 1500, minAmount: 1500, maxAmount: 150000,
    bankName: 'GTBank', bankAccountName: 'Tunde Adeyemi', bankAccountNumber: '0123456789',
  });
  assert.equal(status, 201, JSON.stringify(data));
  sellOffer = data.offer;
});

test('public endpoints', async () => {
  const prices = await call('GET', '/prices');
  assert.equal(prices.status, 200);
  assert.ok(prices.data.prices.USDT.price > 0);
  const offers = await call('GET', '/offers?type=sell&crypto=USDT');
  assert.equal(offers.status, 200);
  assert.ok(offers.data.offers.some((o) => o.id === sellOffer.id));
  assert.equal(offers.data.offers[0].bank_account_number, undefined, 'bank details must not leak publicly');
});

test('auth: validation, me, refresh rotation', async () => {
  const bad = await call('POST', '/auth/register', null, { name: 'X', email: 'nope', password: 'weak' });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.error);
  const me = await call('GET', '/auth/me', buyer.accessToken);
  assert.equal(me.data.user.email, 'chioma@nairachain.test');
  const r = await call('POST', '/auth/refresh', null, { refreshToken: buyer.refreshToken });
  assert.equal(r.status, 200);
  const reuse = await call('POST', '/auth/refresh', null, { refreshToken: buyer.refreshToken });
  assert.equal(reuse.status, 401, 'old refresh token must be rotated out');
  buyer.refreshToken = r.data.refreshToken;
});

test('happy path: escrow lock → payment sent → release → rating', async () => {
  const s0 = await balance(seller.accessToken, 'USDT');
  const b0 = await balance(buyer.accessToken, 'USDT');

  const own = await call('POST', '/trades', seller.accessToken, { offerId: sellOffer.id, nairaAmount: 15000 });
  assert.equal(own.status, 400, 'cannot take own offer');

  const created = await call('POST', '/trades', buyer.accessToken, { offerId: sellOffer.id, nairaAmount: 15000 });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const ref = created.data.trade.trade_ref;
  assert.ok(close(Number(created.data.trade.crypto_amount), 10));

  const s1 = await balance(seller.accessToken, 'USDT');
  assert.ok(close(s1.available, s0.available - 10) && close(s1.locked, s0.locked + 10), 'crypto locked in escrow');

  const detail = await call('GET', `/trades/${ref}`, buyer.accessToken);
  assert.equal(detail.data.trade.seller_bank_account_number, '0123456789');
  const stranger = await call('GET', `/trades/${ref}`, admin.accessToken);
  assert.equal(stranger.status, 404, 'non-parties cannot read trade');

  assert.equal((await call('PATCH', `/trades/${ref}/confirm-payment`, seller.accessToken)).status, 400, 'cannot release before payment sent');
  assert.equal((await call('PATCH', `/trades/${ref}/payment-sent`, seller.accessToken)).status, 403);
  assert.equal((await call('POST', `/trades/${ref}/message`, buyer.accessToken, { message: 'Sent via GTBank' })).status, 201);
  assert.equal((await call('PATCH', `/trades/${ref}/payment-sent`, buyer.accessToken)).data.trade.status, 'payment_sent');
  const done = await call('PATCH', `/trades/${ref}/confirm-payment`, seller.accessToken);
  assert.equal(done.data.trade.status, 'completed');

  const s2 = await balance(seller.accessToken, 'USDT');
  const b2 = await balance(buyer.accessToken, 'USDT');
  assert.ok(close(s2.locked, s0.locked), 'escrow emptied');
  assert.ok(close(b2.available, b0.available + 10), 'buyer credited');

  assert.equal((await call('POST', `/trades/${ref}/rate`, buyer.accessToken, { score: 5, comment: 'Fast' })).status, 200);
  assert.equal((await call('POST', `/trades/${ref}/rate`, buyer.accessToken, { score: 4 })).status, 409);
});

test('buyer cancel returns escrow', async () => {
  const s0 = await balance(seller.accessToken, 'USDT');
  const { data } = await call('POST', '/trades', buyer.accessToken, { offerId: sellOffer.id, nairaAmount: 3000 });
  const ref = data.trade.trade_ref;
  const c = await call('PATCH', `/trades/${ref}/cancel`, buyer.accessToken);
  assert.equal(c.data.trade.status, 'cancelled');
  const s1 = await balance(seller.accessToken, 'USDT');
  assert.ok(close(s1.available, s0.available) && close(s1.locked, s0.locked));
});

test('dispute resolved by admin in favour of seller', async () => {
  const s0 = await balance(seller.accessToken, 'USDT');
  const { data } = await call('POST', '/trades', buyer.accessToken, { offerId: sellOffer.id, nairaAmount: 4500 });
  const { trade_ref: ref, id } = data.trade;
  assert.equal((await call('PATCH', `/trades/${ref}/dispute`, seller.accessToken, { reason: 'Too early to dispute' })).status, 400);
  await call('PATCH', `/trades/${ref}/payment-sent`, buyer.accessToken);
  const d = await call('PATCH', `/trades/${ref}/dispute`, seller.accessToken, { reason: 'Payment never arrived in my account' });
  assert.equal(d.data.trade.status, 'disputed');

  assert.equal((await call('GET', '/admin/disputes', buyer.accessToken)).status, 403);
  const list = await call('GET', '/admin/disputes', admin.accessToken);
  assert.ok(list.data.disputes.some((x) => x.id === id));
  const r = await call('PATCH', `/admin/disputes/${id}/resolve`, admin.accessToken, { winner: 'seller' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const s1 = await balance(seller.accessToken, 'USDT');
  assert.ok(close(s1.available, s0.available) && close(s1.locked, s0.locked));
});

test('buy offer: taker sells and must give bank details', async () => {
  const offer = await call('POST', '/offers', buyer.accessToken, { type: 'buy', crypto: 'USDT', pricePerUnit: 1490, minAmount: 1490, maxAmount: 100000 });
  assert.equal(offer.status, 201);
  const noBank = await call('POST', '/trades', seller.accessToken, { offerId: offer.data.offer.id, nairaAmount: 14900 });
  assert.equal(noBank.status, 400);
  const t = await call('POST', '/trades', seller.accessToken, {
    offerId: offer.data.offer.id, nairaAmount: 14900, bankName: 'Kuda', bankAccountName: 'Tunde A', bankAccountNumber: '1111111111',
  });
  assert.equal(t.status, 201, JSON.stringify(t.data));
  assert.equal(t.data.trade.buyer_id, buyer.user.id);
  assert.equal(t.data.trade.seller_bank_account_number, '1111111111', 'buyer pays the seller (taker), not themselves');
  await call('PATCH', `/trades/${t.data.trade.trade_ref}/cancel`, buyer.accessToken);
  await call('PATCH', `/offers/${offer.data.offer.id}/status`, buyer.accessToken, { status: 'closed' });
});

test('withdrawal: queued, rejected by admin, refunded', async () => {
  const b0 = await balance(buyer.accessToken, 'USDT');
  const w = await call('POST', '/wallet/withdraw', buyer.accessToken, { crypto: 'USDT', amount: 5, address: 'TXYZabcdefghijkmnopqrstuvwxyz12345' });
  assert.equal(w.status, 200, JSON.stringify(w.data));
  const b1 = await balance(buyer.accessToken, 'USDT');
  assert.ok(close(b1.available, b0.available - 6), 'amount + 1 USDT fee deducted');
  const r = await call('PATCH', `/admin/withdrawals/${w.data.transaction.id}`, admin.accessToken, { action: 'reject', reason: 'test' });
  assert.equal(r.status, 200);
  const b2 = await balance(buyer.accessToken, 'USDT');
  assert.ok(close(b2.available, b0.available), 'refunded');
});

test('admin stats and credit', async () => {
  const s = await call('GET', '/admin/stats', admin.accessToken);
  assert.equal(s.status, 200);
  assert.ok(s.data.trades.completed >= 1);
  const b0 = await balance(buyer.accessToken, 'BTC');
  assert.equal((await call('POST', `/admin/users/${buyer.user.id}/credit`, admin.accessToken, { crypto: 'BTC', amount: 0.001 })).status, 200);
  const b1 = await balance(buyer.accessToken, 'BTC');
  assert.ok(close(b1.available, b0.available + 0.001));
});

test('cleanup', async () => {
  await call('PATCH', `/offers/${sellOffer.id}/status`, seller.accessToken, { status: 'closed' });
});
