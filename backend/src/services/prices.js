// NGN market prices from CoinGecko, cached in memory. Falls back to the
// last good value (or static defaults) if the API is unreachable.

const FALLBACK = {
  BTC: { price: 98500000, change24h: 0 },
  ETH: { price: 5200000, change24h: 0 },
  USDT: { price: 1520, change24h: 0 },
};
const IDS = { BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether' };
const TTL_MS = 60 * 1000;

let cache = { data: FALLBACK, source: 'fallback', fetchedAt: 0 };
let inflight = null;

const fetchPrices = async () => {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(IDS).join(',')}&vs_currencies=ngn&include_24hr_change=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = await res.json();
  const data = {};
  for (const [sym, id] of Object.entries(IDS)) {
    const row = json[id];
    if (!row?.ngn) throw new Error(`Missing price for ${sym}`);
    data[sym] = { price: row.ngn, change24h: Number((row.ngn_24h_change || 0).toFixed(2)) };
  }
  return data;
};

const getPrices = async () => {
  if (process.env.DISABLE_PRICE_FEED === 'true') return { ...cache, data: FALLBACK, source: 'fallback' };
  if (Date.now() - cache.fetchedAt < TTL_MS) return cache;
  if (!inflight) {
    inflight = fetchPrices()
      .then(data => { cache = { data, source: 'coingecko', fetchedAt: Date.now() }; })
      .catch(err => {
        console.warn('Price feed unavailable, using cached/fallback prices:', err.message);
        cache = { ...cache, fetchedAt: Date.now() }; // back off for one TTL
      })
      .finally(() => { inflight = null; });
  }
  await inflight;
  return cache;
};

module.exports = { getPrices, FALLBACK };
