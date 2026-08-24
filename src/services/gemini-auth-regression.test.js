const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const GeminiService = require('./gemini');

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
