const { LRUCache } = require('lru-cache');

function normalizePositiveInteger(value, fallback, minimum = 1, maximum = 1_000_000) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }
  return Math.min(maximum, parsed);
}

function createBoundedCache(options = {}) {
  const max = normalizePositiveInteger(options.max, 1000);
  const ttl = normalizePositiveInteger(
    options.ttl,
    60 * 60 * 1000,
    1,
    Number.MAX_SAFE_INTEGER
  );

  return new LRUCache({
    max,
    ttl,
    updateAgeOnGet: options.updateAgeOnGet === true,
    allowStale: false
  });
}

module.exports = {
  createBoundedCache,
  normalizePositiveInteger
};
