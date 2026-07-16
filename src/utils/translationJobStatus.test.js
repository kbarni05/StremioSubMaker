'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunningStatus, updateTranslationJobStatus, toPublicTranslationJobStatus } = require('./translationJobStatus');

test('translation status exposes progress without leaking internal identity fields', () => {
  const cache = new Map();
  const initial = createRunningStatus({ userHash: 'secret-user-hash', now: 1000 });
  updateTranslationJobStatus(cache, ['runtime', 'shared'], initial, 1000);
  updateTranslationJobStatus(cache, ['runtime', 'shared'], {
    completedEntries: 25,
    totalEntries: 100,
    currentBatch: 1,
    totalBatches: 4,
    stage: 'streaming'
  }, 2000);

  const result = toPublicTranslationJobStatus(cache.get('runtime'), 6000);
  assert.equal(result.progress.percent, 25);
  assert.equal(result.elapsedSeconds, 5);
  assert.equal(result.stage, 'streaming');
  assert.equal('userHash' in result, false);
  assert.strictEqual(cache.get('runtime'), cache.get('shared'));
});

test('completed translation is always reported as 100 percent', () => {
  const result = toPublicTranslationJobStatus({
    status: 'completed',
    stage: 'completed',
    inProgress: false,
    startedAt: 1000,
    completedAt: 3000,
    completedEntries: 2,
    totalEntries: 2
  }, 3000);
  assert.equal(result.progress.percent, 100);
  assert.equal(result.inProgress, false);
});
