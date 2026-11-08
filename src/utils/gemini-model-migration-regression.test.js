const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getModelSpecificDefaults,
  normalizeConfig,
  normalizeGeminiModelName
} = require('./config');

const projectRoot = path.resolve(__dirname, '..', '..');

test('offline Gemini model catalog agrees with the supported configuration model policy', () => {
  const GeminiService = require('../services/gemini');
  const service = new GeminiService('test-key');
  const models = service.getDefaultModels().map((model) => model.name);
  assert.ok(models.includes('gemini-3.8-flash'));
  for (const model of models) {
    assert.equal(normalizeGeminiModelName(model), model, `offline choice ${model} must not immediately migrate`);
  }
});

test('retired Gemini IDs migrate without silently changing supported saved models', () => {
  assert.equal(normalizeGeminiModelName('models/gemini-2.5-flash-lite'), 'gemini-2.5-flash-lite');
  assert.equal(normalizeGeminiModelName('gemini-2.5-flash'), 'gemini-2.5-flash');
  assert.equal(normalizeGeminiModelName('gemini-2.5-pro'), 'gemini-2.5-pro');
  assert.equal(normalizeGeminiModelName('gemini-3-flash-preview'), 'gemini-3-flash-preview');
  assert.equal(normalizeGeminiModelName('gemini-3.5-flash'), 'gemini-3.6-flash');
  assert.equal(normalizeGeminiModelName('gemini-2.0-flash'), 'gemini-3.6-flash');

  const normalized = normalizeConfig({
    geminiApiKey: 'saved-key',
    geminiModel: 'gemini-2.5-flash-lite',
    advancedSettings: { enabled: true, geminiModel: 'gemini-2.5-flash' }
  });
  assert.equal(normalized.geminiModel, 'gemini-2.5-flash-lite');
  assert.equal(normalized.advancedSettings.geminiModel, 'gemini-2.5-flash');
  assert.deepEqual(getModelSpecificDefaults('gemini-3.8-flash'), {
    thinkingBudget: -1,
    thinkingLevel: 'medium',
    temperature: 0.5
  });
});

test('configuration UI offers current Gemini models and filters retired discovery results', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'public', 'partials', 'main.html'), 'utf8');
  const client = fs.readFileSync(path.join(projectRoot, 'public', 'config.js'), 'utf8');

  for (const model of ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-3-flash-preview']) {
    assert.match(html, new RegExp(`value=["']${model}["']`));
  }
  for (const model of ['gemini-2.0-flash', 'gemini-3.5-flash']) {
    assert.doesNotMatch(html, new RegExp(`value=["']${model}["']`));
  }
  assert.match(client, /!isDeprecatedGeminiModelName\(model\.name\)/);
});
