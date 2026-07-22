const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('request-controlled process caches use bounded TTL-aware storage', () => {
  const files = [
    'src/services/opensubtitles.js',
    'src/services/translationEngine.js',
    'src/utils/config.js',
    'src/utils/providerAuthFailureCache.js',
    'src/utils/sentry.js',
    'src/utils/smdbCache.js'
  ];

  for (const file of files) {
    assert.match(read(file), /createBoundedCache\s*\(/, `${file} must use a bounded cache`);
  }

  const combined = files.map(read).join('\n');
  for (const cacheName of [
    'credentialFailureCache',
    'tokenCacheLocal',
    '_sharedKeyHealthErrors',
    'memoryRotationCounters',
    'localAuthFailureCache',
    'eventSendCounts',
    'overrideTracker'
  ]) {
    assert.doesNotMatch(combined, new RegExp(`${cacheName}\\s*=\\s*new Map\\(`));
  }
});

test('periodic maintenance is non-overlapping and avoids diagnostic session scans', () => {
  const subtitles = read('src/handlers/subtitles.js');
  const storageFactory = read('src/storage/StorageFactory.js');
  const sessionManager = read('src/utils/sessionManager.js');
  const metricsStart = subtitles.indexOf('async function logCacheMetrics()');
  const metricsEnd = subtitles.indexOf('// Initialize cache on module load', metricsStart);
  const metricsBody = subtitles.slice(metricsStart, metricsEnd);

  assert.ok(metricsStart >= 0 && metricsEnd > metricsStart);
  assert.doesNotMatch(metricsBody, /adapter\.list\s*\(/);
  assert.match(metricsBody, /adapter\.getSessionCount\s*\(/);
  assert.doesNotMatch(storageFactory, /setInterval\s*\(/);
  assert.match(storageFactory, /scheduleNonOverlappingInterval\s*\(/);
  assert.match(sessionManager, /this\.saveTimer\s*=\s*scheduleNonOverlappingInterval/);
  assert.match(sessionManager, /this\.cleanupTimer\s*=\s*scheduleNonOverlappingInterval/);

  const scheduledBypassRuns = subtitles.match(
    /scheduleNonOverlappingInterval\(async \(\) => \{[\s\S]{0,300}?verifyBypassCacheIntegrity\(\)/g
  ) || [];
  assert.equal(scheduledBypassRuns.length, 1);
});
