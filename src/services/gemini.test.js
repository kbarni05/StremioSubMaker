const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { Readable } = require('node:stream');

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
    assert.deepEqual(capturedBody.generationConfig.thinkingConfig, { thinkingLevel: 'minimal' });
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

test('Gemini token counting nests system instructions in generateContentRequest', async () => {
  const originalPost = axios.post;
  let capturedBody;
  axios.post = async (_url, body) => {
    capturedBody = body;
    return { data: { totalTokens: 42 } };
  };

  try {
    const gemini = new GeminiService('AIza-test-key-for-counting', 'gemini-3.1-flash-lite');
    assert.equal(await gemini.countTokensForTranslation('Hello!', 'Hungarian'), 42);
    assert.equal(Object.hasOwn(capturedBody, 'systemInstruction'), false);
    assert.equal(Object.hasOwn(capturedBody, 'contents'), false);
    assert.equal(capturedBody.generateContentRequest.model, 'models/gemini-3.1-flash-lite');
    assert.match(capturedBody.generateContentRequest.systemInstruction.parts[0].text, /Translate the following subtitles/);
    assert.match(capturedBody.generateContentRequest.contents[0].parts[0].text, /Hello!/);
  } finally {
    axios.post = originalPost;
  }
});

test('Gemini streaming HTTP errors preserve the bounded provider explanation', async () => {
  const originalPost = axios.post;
  const leakedKey = 'AIza0123456789abcdefghijklmnop';
  axios.post = async () => {
    const error = new Error('Request failed with status code 400');
    error.response = {
      status: 400,
      data: Readable.from([JSON.stringify({
        error: { status: 'INVALID_ARGUMENT', message: `Unknown name "responseSchema": Cannot find field. ${leakedKey}` }
      })]),
    };
    throw error;
  };

  try {
    const gemini = new GeminiService('AIza-test-key-for-stream-errors', 'gemini-3.1-flash-lite', { maxRetries: 0 });
    gemini.getModelLimits = async () => ({ outputTokenLimit: 65536 });
    await assert.rejects(
      gemini.streamTranslateSubtitle('Hello!', 'English', 'Hungarian'),
      error => error.statusCode === 400
        && error.originalError?.providerMessage === 'Unknown name "responseSchema": Cannot find field. [REDACTED_API_KEY]'
        && !JSON.stringify(error.originalError?.response?.data).includes(leakedKey)
    );
  } finally {
    axios.post = originalPost;
  }
});

test('Gemini API_KEY_INVALID 400 reaches translation as a specific authentication error', async () => {
  const originalPost = axios.post;
  axios.post = async () => {
    const error = new Error('Request failed with status code 400');
    error.response = {
      status: 400,
      data: Readable.from([JSON.stringify({
        error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' }
      })]),
    };
    throw error;
  };

  try {
    const gemini = new GeminiService('AIza-test-key-auth-error', 'gemini-3.7-flash', { maxRetries: 0 });
    gemini.getModelLimits = async () => ({ outputTokenLimit: 65536 });
    await assert.rejects(
      gemini.streamTranslateSubtitle('Hello!', 'English', 'Hungarian'),
      error => error.statusCode === 400
        && error.type === 'authentication'
        && error.translationErrorType === 'GEMINI_AUTH'
        && /Gemini rejected the API key/i.test(error.message)
    );
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
