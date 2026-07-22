const test = require('node:test');
const assert = require('node:assert/strict');

const { createBoundedCache, normalizePositiveInteger } = require('./boundedCache');

test('bounded cache evicts the least recently used entry', () => {
  const cache = createBoundedCache({ max: 2, ttl: 1000, updateAgeOnGet: true });
  cache.set('first', 1);
  cache.set('second', 2);
  assert.equal(cache.get('first'), 1);

  cache.set('third', 3);

  assert.equal(cache.has('first'), true);
  assert.equal(cache.has('second'), false);
  assert.equal(cache.has('third'), true);
});

test('bounded cache expires stale entries', async () => {
  const cache = createBoundedCache({ max: 2, ttl: 20 });
  cache.set('temporary', true);
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(cache.get('temporary'), undefined);
  assert.equal(cache.size, 0);
});

test('positive integer normalization rejects unsafe cache sizes', () => {
  assert.equal(normalizePositiveInteger('250', 10), 250);
  assert.equal(normalizePositiveInteger('0', 10), 10);
  assert.equal(normalizePositiveInteger('invalid', 10), 10);
  assert.equal(normalizePositiveInteger('2000000', 10), 1_000_000);
});

test('bounded cache preserves TTL values longer than the entry-count ceiling', () => {
  const oneDay = 24 * 60 * 60 * 1000;
  const cache = createBoundedCache({ max: 10, ttl: oneDay });
  assert.equal(cache.ttl, oneDay);
});
