const test = require('node:test');
const assert = require('node:assert/strict');

const TranslationEngine = require('./translationEngine');

test('Gemini invalid requests do not put healthy API keys on cooldown', async () => {
  const firstKey = 'AIza-test-invalid-request-key-1';
  const secondKey = 'AIza-test-invalid-request-key-2';
  const engine = new TranslationEngine({ apiKey: firstKey }, 'gemini-3.1-flash-lite', {}, {
    keyRotationConfig: { enabled: true, mode: 'per-request', keys: [firstKey, secondKey] }
  });
  engine._keyHealthErrors.delete(firstKey);

  try {
    const error = new Error('Invalid JSON payload');
    error.statusCode = 400;
    error.type = 'client_error';
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await engine._recordKeyError(firstKey, error);
    }
    assert.equal(engine._keyHealthErrors.get(firstKey), undefined);
  } finally {
    engine._keyHealthErrors.delete(firstKey);
  }
});

test('structured-output fallback sees the real Gemini error behind a friendly wrapper', () => {
  const engine = new TranslationEngine({ apiKey: 'AIza-test-structured-fallback' }, 'gemini-3.1-flash-lite');
  const error = new Error('Invalid request. Please check your configuration.');
  error.statusCode = 400;
  error.originalError = new Error('Request failed with status code 400');
  error.originalError.providerMessage = 'Unknown name "responseSchema": Cannot find field.';

  assert.equal(engine._isStructuredOutputCapabilityError(error), true);
  error.originalError.providerMessage = 'Unknown name "systemInstruction": Cannot find field.';
  assert.equal(engine._isStructuredOutputCapabilityError(error), false);
});
