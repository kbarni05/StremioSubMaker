const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSubtitleResponseSchema,
  buildThinkingConfig,
  extractCandidateText,
  getBackoffDelayMs,
  getServerRetryDelayMs,
  isTransientGeminiError,
  normalizeGeminiModelId,
} = require('./geminiSupport');

test('Gemini model identifiers are normalized and validated', () => {
  assert.equal(normalizeGeminiModelId(' models/gemini-3.1-flash-lite '), 'gemini-3.1-flash-lite');
  assert.throws(() => normalizeGeminiModelId('../bad/model'), /Invalid Gemini model identifier/);
  assert.throws(() => normalizeGeminiModelId('gemini model'), /Invalid Gemini model identifier/);
});

test('Gemini 2.5 thinking budgets preserve explicit disable and dynamic modes', () => {
  assert.deepEqual(buildThinkingConfig('gemini-2.5-flash', 0), { thinkingBudget: 0 });
  assert.deepEqual(buildThinkingConfig('gemini-2.5-flash', -1), { thinkingBudget: -1 });
  assert.deepEqual(buildThinkingConfig('gemini-2.5-pro', 0), { thinkingBudget: -1 });
  assert.deepEqual(buildThinkingConfig('gemini-2.5-flash-lite', 1), { thinkingBudget: 512 });
});

test('Gemini 3 numeric compatibility settings map to supported thinking levels', () => {
  assert.deepEqual(buildThinkingConfig('gemini-3.1-flash-lite', 0), { thinkingLevel: 'low' });
  assert.deepEqual(buildThinkingConfig('gemini-3.5-flash', 4096), { thinkingLevel: 'medium' });
  assert.deepEqual(buildThinkingConfig('gemini-3.1-pro-preview', -1), { thinkingLevel: 'high' });
  assert.equal(buildThinkingConfig('gemma-3-27b-it', -1), null);
});

test('thought parts are excluded from translated subtitle output', () => {
  const text = extractCandidateText({
    content: {
      parts: [
        { thought: true, text: 'Hmm, I should translate this carefully...' },
        { text: '[{"id":1,"text":"Szia!"}]' },
      ],
    },
  });

  assert.equal(text, '[{"id":1,"text":"Szia!"}]');
});

test('retry delay honors Retry-After and Google RetryInfo with a bounded delay', () => {
  const error = {
    response: {
      status: 429,
      headers: { 'retry-after': '2' },
      data: { error: { details: [{ retryDelay: '3.5s' }] } },
    },
  };

  assert.equal(getServerRetryDelayMs(error), 3500);
  assert.equal(getBackoffDelayMs(error, 0, 1000, () => 0), 3500);
});

test('transient Gemini errors include timeouts, rate limits, server and network failures', () => {
  for (const status of [408, 429, 500, 503, 504]) {
    assert.equal(isTransientGeminiError({ response: { status } }), true);
  }
  assert.equal(isTransientGeminiError({ code: 'EAI_AGAIN' }), true);
  assert.equal(isTransientGeminiError({ response: { status: 400 } }), false);
  assert.equal(isTransientGeminiError({ response: { status: 403 } }), false);
});

test('structured subtitle schema requires stable IDs and translated text', () => {
  const schema = buildSubtitleResponseSchema();
  assert.equal(schema.type, 'ARRAY');
  assert.deepEqual(schema.items.required, ['id', 'text']);
  assert.equal(schema.items.properties.id.type, 'INTEGER');
  assert.equal(schema.items.properties.text.type, 'STRING');
});
