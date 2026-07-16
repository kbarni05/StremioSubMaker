'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerTranslationStatusRoutes } = require('./translationStatusRoutes');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('translation status route returns sanitized local progress', async () => {
  let handler;
  const limiter = (_req, _res, next) => next();
  const app = {
    post(path, actualLimiter, actualHandler) {
      assert.equal(path, '/api/translation-status');
      assert.equal(actualLimiter, limiter);
      handler = actualHandler;
    }
  };
  const cache = new Map([['source_en', {
    status: 'running',
    stage: 'translating',
    inProgress: true,
    startedAt: Date.now() - 2000,
    completedEntries: 5,
    totalEntries: 10,
    userHash: 'must-not-leak'
  }]]);

  registerTranslationStatusRoutes(app, {
    limiter,
    resolveConfigGuarded: async () => ({ __configHash: 'hash' }),
    translationStatus: cache,
    isSharedTranslationInFlight: async () => null,
    hasCachedTranslation: async () => false,
    setNoStore: () => {},
    log: { warn: () => {} }
  });

  const res = createResponse();
  await handler({ body: { configStr: 'config', sourceFileId: 'source', targetLanguage: 'en' } }, res);
  assert.equal(res.body.status, 'running');
  assert.equal(res.body.progress.percent, 50);
  assert.equal('userHash' in res.body, false);
});

test('translation status route rejects malformed identifiers before config lookup', async () => {
  let handler;
  let resolved = false;
  const app = { post(_path, _limiter, actualHandler) { handler = actualHandler; } };
  registerTranslationStatusRoutes(app, {
    limiter: () => {},
    resolveConfigGuarded: async () => { resolved = true; },
    translationStatus: new Map(),
    isSharedTranslationInFlight: async () => null,
    hasCachedTranslation: async () => false,
    setNoStore: () => {},
    log: { warn: () => {} }
  });

  const res = createResponse();
  await handler({ body: { configStr: 'config', sourceFileId: '../secret', targetLanguage: 'en' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(resolved, false);
});
