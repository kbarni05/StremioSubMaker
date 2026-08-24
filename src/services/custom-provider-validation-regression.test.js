const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');

const OpenAICompatibleProvider = require('./providers/openaiCompatible');

test('custom provider UI exposes a localized connection test wired to a protected endpoint', () => {
  const root = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'public', 'partials', 'main.html'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'public', 'config.js'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'index.js'), 'utf8');

  assert.match(html, /id="validateCustomProvider"/);
  assert.match(html, /id="customProviderValidationFeedback"/);
  assert.match(client, /validateApiKey\('custom'\)/);
  assert.match(client, /endpoint = '\/api\/validate-custom'/);
  assert.match(server, /app\.post\('\/api\/validate-custom', validationLimiter/);
});

test('custom provider validation can surface model endpoint failures', async () => {
  const originalGet = axios.get;
  axios.get = async () => {
    const error = new Error('model endpoint rejected credentials');
    error.response = { status: 401, data: { error: { message: 'invalid token' } } };
    throw error;
  };
  try {
    const provider = new OpenAICompatibleProvider({
      providerName: 'custom',
      baseUrl: 'https://example.com/v1',
      apiKey: 'bad-key',
      model: 'example-model'
    });
    await assert.rejects(
      provider.getAvailableModels({ throwOnError: true }),
      /model endpoint rejected credentials/
    );
  } finally {
    axios.get = originalGet;
  }
});
