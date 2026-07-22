const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

process.env.LOG_TO_FILE = 'false';
process.env.LOG_LEVEL = 'error';

const GeminiService = require('./gemini');

test('workflow prompts include subtitle content exactly once', () => {
  const gemini = new GeminiService('AIza-test-key-for-prompt', 'gemini-3.1-flash-lite');
  const content = '<s id="1">Hello</s>';
  const workflow = `Translate to {target_language}.\nINPUT:\n${content}`;
  const prompt = gemini.buildUserPrompt(content, 'Hungarian', workflow);

  assert.equal(prompt.contentPrompt, 'Translate to Hungarian.\nINPUT:\n<s id="1">Hello</s>');
  assert.equal(prompt.userPrompt.split(content).length - 1, 1);
  assert.match(prompt.systemPrompt, /Return only the requested translated payload/);
});

test('Gemini 3 request uses structured JSON, qualitative thinking and final-only text', async () => {
  const originalPost = axios.post;
  let capturedBody;
  const gemini = new GeminiService('AIza-test-key-for-gemini3', 'gemini-3.1-flash-lite', {
    enableJsonOutput: true,
    thinkingBudget: 0,
    maxRetries: 0,
  });
  gemini.getModelLimits = async () => ({ inputTokenLimit: 1_000_000, outputTokenLimit: 65536 });

  axios.post = async (_url, body) => {
    capturedBody = body;
    return {
      data: {
        candidates: [{
          finishReason: 'STOP',
          content: { parts: [
            { thought: true, text: 'Let me think... sigh.' },
            { text: '[{"id":1,"text":"Szia!"}]' },
          ] },
        }],
      },
    };
  };

  try {
    const result = await gemini.translateSubtitle('[{"id":1,"text":"Hello!"}]', 'English', 'Hungarian');
    assert.equal(result, '[{"id":1,"text":"Szia!"}]');
    assert.deepEqual(capturedBody.generationConfig.thinkingConfig, { thinkingLevel: 'low' });
    assert.equal(capturedBody.generationConfig.responseMimeType, 'application/json');
    assert.equal(capturedBody.generationConfig.responseSchema.type, 'ARRAY');
    assert.equal('temperature' in capturedBody.generationConfig, false);
    assert.equal('topK' in capturedBody.generationConfig, false);
    assert.equal('topP' in capturedBody.generationConfig, false);
    assert.equal(capturedBody.contents[0].role, 'user');
    assert.match(capturedBody.systemInstruction.parts[0].text, /Translate the following subtitles/);
  } finally {
    axios.post = originalPost;
  }
});

test('Gemini 2.5 Flash explicitly disables thinking and keeps supported sampling settings', async () => {
  const originalPost = axios.post;
  let capturedBody;
  const gemini = new GeminiService('AIza-test-key-for-gemini25', 'gemini-2.5-flash', {
    thinkingBudget: 0,
    temperature: 0.4,
    maxRetries: 0,
  });
  gemini.getModelLimits = async () => ({ inputTokenLimit: 1_000_000, outputTokenLimit: 65536 });

  axios.post = async (_url, body) => {
    capturedBody = body;
    return {
      data: {
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Szia!' }] } }],
      },
    };
  };

  try {
    assert.equal(await gemini.translateSubtitle('Hello!', 'English', 'Hungarian'), 'Szia!');
    assert.deepEqual(capturedBody.generationConfig.thinkingConfig, { thinkingBudget: 0 });
    assert.equal(capturedBody.generationConfig.temperature, 0.4);
    assert.equal(capturedBody.generationConfig.topK, 40);
    assert.equal(capturedBody.generationConfig.topP, 0.95);
  } finally {
    axios.post = originalPost;
  }
});

test('Gemini model discovery follows pagination and removes duplicates', async () => {
  const originalGet = axios.get;
  const calls = [];
  const gemini = new GeminiService('AIza-test-key-for-model-pages', 'gemini-3.1-flash-lite');

  axios.get = async (_url, config) => {
    calls.push(config.params);
    if (!config.params.pageToken) {
      return {
        data: {
          models: [{
            name: 'models/gemini-3.1-flash-lite',
            displayName: 'Gemini 3.1 Flash-Lite',
            supportedGenerationMethods: ['generateContent'],
          }],
          nextPageToken: 'page-2',
        },
      };
    }
    return {
      data: {
        models: [
          {
            name: 'models/gemini-3.1-flash-lite',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/gemini-3.5-flash',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      },
    };
  };

  try {
    const models = await gemini.getAvailableModels({ throwOnError: true, silent: true });
    assert.deepEqual(models.map(model => model.name), ['gemini-3.1-flash-lite', 'gemini-3.5-flash']);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].pageToken, 'page-2');
  } finally {
    axios.get = originalGet;
  }
});

test('rate limits rotate to another key immediately when rotation is available', async () => {
  const delays = [];
  const gemini = new GeminiService('AIza-test-key-for-rotation', 'gemini-2.5-flash', {
    maxRetries: 3,
    deferRateLimitRetries: true,
    sleep: async delay => delays.push(delay),
  });
  const error = new Error('quota exceeded');
  error.response = { status: 429 };

  await assert.rejects(() => gemini.retryWithBackoff(async () => { throw error; }), /quota exceeded/);
  assert.deepEqual(delays, []);
});
