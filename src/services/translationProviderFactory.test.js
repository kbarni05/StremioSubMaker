const test = require('node:test');
const assert = require('node:assert/strict');

const { createTranslationProvider } = require('./translationProviderFactory');

test('OpenRouter remains primary and Gemini is called only after a primary failure', async () => {
  const result = await createTranslationProvider({
    multiProviderEnabled: true,
    mainProvider: 'openrouter',
    secondaryProviderEnabled: true,
    secondaryProvider: 'gemini',
    geminiApiKey: 'gemini-fallback-key',
    geminiModel: 'gemini-2.5-flash',
    providers: {
      openrouter: {
        enabled: true,
        apiKey: 'openrouter-primary-key',
        model: 'openai/gpt-4.1-mini'
      }
    },
    advancedSettings: {}
  });

  assert.equal(result.providerName, 'openrouter');
  assert.equal(result.fallbackProviderName, 'gemini');
  assert.equal(result.provider.primary.providerName, 'openrouter');

  let primaryCalls = 0;
  let fallbackCalls = 0;
  result.provider.primary.translateSubtitle = async () => {
    primaryCalls += 1;
    return 'translated by OpenRouter';
  };
  result.provider.fallback.translateSubtitle = async () => {
    fallbackCalls += 1;
    return 'translated by Gemini';
  };

  const translated = await result.provider.translateSubtitle('hello', 'en', 'hu');
  assert.equal(translated, 'translated by OpenRouter');
  assert.equal(primaryCalls, 1);
  assert.equal(fallbackCalls, 0);
});
