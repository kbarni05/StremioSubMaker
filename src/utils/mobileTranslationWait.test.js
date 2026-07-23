const test = require('node:test');
const assert = require('node:assert/strict');

const {
  clampMobileWaitSeconds,
  getMobileWaitTimeoutMs,
  waitForMobileTranslation,
} = require('./mobileTranslationWait');

test('mobile wait timeout is independent from per-request AI timeout and remains bounded', () => {
  assert.equal(getMobileWaitTimeoutMs({ advancedSettings: { translationTimeout: 30 } }, {}), 240_000);
  assert.equal(getMobileWaitTimeoutMs({ mobileModeTimeoutSeconds: 360 }, {}), 360_000);
  assert.equal(getMobileWaitTimeoutMs({}, { MOBILE_MODE_WAIT_TIMEOUT_SECONDS: '420' }), 420_000);
  assert.equal(clampMobileWaitSeconds(5), 60);
  assert.equal(clampMobileWaitSeconds(9999), 600);
});

test('mobile wait returns local translation output without waiting for cache persistence', async () => {
  const outcome = await waitForMobileTranslation({
    translationPromise: Promise.resolve({ content: '1\n00:00:00,000 --> 00:00:01,000\nKész' }),
    readFinal: async () => null,
    timeoutMs: 100,
    initialPollMs: 5,
    maxPollMs: 10,
  });

  assert.equal(outcome.status, 'completed');
  assert.equal(outcome.source, 'promise');
  assert.match(outcome.content, /Kész/);
});

test('mobile wait uses shared cache and reports promise failures without timing out', async () => {
  let reads = 0;
  const cached = await waitForMobileTranslation({
    readFinal: async () => (++reads >= 2 ? 'cached final subtitle' : null),
    timeoutMs: 100,
    initialPollMs: 5,
    maxPollMs: 10,
  });
  assert.equal(cached.status, 'completed');
  assert.equal(cached.source, 'cache');

  const failure = new Error('provider unavailable');
  const failed = await waitForMobileTranslation({
    translationPromise: Promise.reject(failure),
    readFinal: async () => null,
    timeoutMs: 100,
    initialPollMs: 5,
    maxPollMs: 10,
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, failure);
});
