const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const GeminiService = require('./gemini');
const {
  cacheProviderAuthFailure,
  getProviderAuthFailureCacheKey,
  resetProviderAuthFailureCache
} = require('../utils/providerAuthFailureCache');

test('Gemini AQ keys use the v1beta header-auth path without key truncation', async () => {
  const originalGet = axios.get;
  const aqKey = 'AQ.AbCdEf0123456789_-long-key-shape';
  let observed;
  axios.get = async (url, config) => {
    observed = { url, config };
    return {
      data: {
        models: [{
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          supportedGenerationMethods: ['generateContent']
        }]
      }
    };
  };

  try {
    const service = new GeminiService(`  ${aqKey}\r\n`, 'gemini-2.5-flash');
    const models = await service.getAvailableModels({ silent: true, throwOnError: true });
    assert.equal(observed.url, 'https://generativelanguage.googleapis.com/v1beta/models');
    assert.equal(observed.config.headers['x-goog-api-key'], aqKey);
    assert.equal(Object.hasOwn(observed.config.params, 'key'), false);
    assert.equal(models[0].name, 'gemini-2.5-flash');
  } finally {
    axios.get = originalGet;
  }
});

test('explicit Gemini validation bypasses a stale cached authentication failure', async () => {
  const originalGet = axios.get;
  const aqKey = 'AQ.newly-provisioned-key.with-symbols_-';
  let request = null;
  axios.get = async (url, config) => {
    request = { url, config };
    return {
      data: {
        models: [{
          name: 'models/gemini-3.7-flash',
          displayName: 'Gemini 3.7 Flash',
          supportedGenerationMethods: ['generateContent']
        }]
      }
    };
  };

  try {
    const service = new GeminiService(aqKey, 'gemini-3.7-flash');
    await cacheProviderAuthFailure(getProviderAuthFailureCacheKey('gemini', aqKey));

    assert.deepEqual(await service.getAvailableModels({ silent: true, throwOnError: true }), []);
    assert.equal(request, null);

    const models = await service.getAvailableModels({
      silent: true,
      throwOnError: true,
      bypassAuthFailureCache: true
    });

    assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models');
    assert.equal(request.config.headers['x-goog-api-key'], aqKey);
    assert.deepEqual(models.map(model => model.name), ['gemini-3.7-flash']);

    const serverSource = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
    assert.match(serverSource, /new GeminiService\(geminiApiKey[\s\S]{0,300}bypassAuthFailureCache: true/);
  } finally {
    axios.get = originalGet;
    resetProviderAuthFailureCache();
  }
});
