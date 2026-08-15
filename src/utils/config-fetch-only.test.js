'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDefaultConfig, validateConfig } = require('./config');

test('fetch-only mode validates without any AI provider credentials', () => {
  const config = getDefaultConfig();
  config.noTranslationMode = true;
  config.noTranslationLanguages = ['hun'];
  config.geminiApiKey = '';
  config.geminiApiKeys = [];
  config.providers = {};

  const result = validateConfig(config);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('fetch-only mode still requires at least one requested language', () => {
  const config = getDefaultConfig();
  config.noTranslationMode = true;
  config.noTranslationLanguages = [];
  config.geminiApiKey = '';
  config.geminiApiKeys = [];

  const result = validateConfig(config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.doesNotMatch(result.errors.join(' '), /Gemini|API key/i);
});
