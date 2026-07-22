const MAX_RETRY_DELAY_MS = 60_000;

function normalizeGeminiModelId(model, fallback = 'gemini-3.1-flash-lite') {
  const raw = String(model || fallback).trim().replace(/^models\//i, '');
  if (!raw || raw.length > 128 || !/^[a-z0-9._-]+$/i.test(raw)) {
    throw new Error('Invalid Gemini model identifier');
  }
  return raw;
}

function getGeminiModelProfile(model) {
  const name = normalizeGeminiModelId(model).toLowerCase();
  const isGemma = name.includes('gemma');
  const isGemini3 = /^gemini-3(?:[.-]|$)/.test(name)
    || name === 'gemini-flash-latest'
    || name === 'gemini-flash-lite-latest';
  const isGemini25 = /^gemini-2\.5(?:[.-]|$)/.test(name);

  return {
    name,
    isGemma,
    isGemini3,
    isGemini25,
    isFlashLite: name.includes('flash-lite'),
    isPro: name.includes('pro'),
    supportsThinking: !isGemma && (isGemini3 || isGemini25),
    omitSamplingParameters: isGemini3,
  };
}

function buildThinkingConfig(model, requestedBudget) {
  const profile = getGeminiModelProfile(model);
  if (!profile.supportsThinking) return null;

  const parsed = Number.parseInt(requestedBudget, 10);
  const budget = Number.isFinite(parsed) ? parsed : 0;

  if (profile.isGemini3) {
    // Gemini 3 uses qualitative levels. Preserve the old numeric UI while mapping
    // it to supported API values: 0=fast, -1=dynamic/deep, positive=scaled.
    if (budget === -1) return { thinkingLevel: 'high' };
    if (budget <= 2048) return { thinkingLevel: 'low' };
    if (budget <= 8192) return { thinkingLevel: 'medium' };
    return { thinkingLevel: 'high' };
  }

  // Gemini 2.5 uses token budgets. Pro cannot disable thinking, while Flash and
  // Flash-Lite require an explicit zero to disable it (omitting the config enables
  // the model default instead).
  if (budget === -1 || (profile.isPro && budget === 0)) {
    return { thinkingBudget: -1 };
  }
  if (budget <= 0) {
    return { thinkingBudget: 0 };
  }

  const minimum = profile.isFlashLite ? 512 : (profile.isPro ? 128 : 1);
  const maximum = profile.isPro ? 32768 : 24576;
  return { thinkingBudget: Math.max(minimum, Math.min(maximum, budget)) };
}

function buildSubtitleResponseSchema() {
  return {
    type: 'ARRAY',
    description: 'Translated subtitle entries in the same order and with the same IDs as the input.',
    items: {
      type: 'OBJECT',
      properties: {
        id: {
          type: 'INTEGER',
          description: 'The unchanged numeric subtitle entry ID from the input.',
        },
        text: {
          type: 'STRING',
          description: 'Only the translated subtitle text, preserving formatting tags and line breaks.',
        },
      },
      required: ['id', 'text'],
    },
  };
}

function extractCandidateText(candidate) {
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  return parts
    .filter(part => part?.thought !== true && typeof part?.text === 'string')
    .map(part => part.text)
    .join('');
}

function unwrapError(error) {
  let current = error;
  const seen = new Set();
  for (let depth = 0; current && depth < 5 && !seen.has(current); depth += 1) {
    seen.add(current);
    if (current.response || current.code || current.statusCode || current.status) return current;
    current = current.originalError;
  }
  return error;
}

function getGeminiStatusCode(error) {
  const unwrapped = unwrapError(error);
  return Number(unwrapped?.response?.status || unwrapped?.statusCode || unwrapped?.status || 0);
}

function isTransientGeminiError(error) {
  const unwrapped = unwrapError(error);
  const status = getGeminiStatusCode(unwrapped);
  const code = String(unwrapped?.code || '').toUpperCase();
  const message = String(unwrapped?.message || error?.message || '').toLowerCase();

  return error?.isRetryable === true
    || unwrapped?.isRetryable === true
    || status === 408
    || status === 429
    || status >= 500
    || ['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH'].includes(code)
    || message.includes('socket hang up')
    || message.includes('timeout');
}

function parseDurationMs(value) {
  const match = String(value || '').trim().match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
  return match ? Math.round(Number.parseFloat(match[1]) * 1000) : null;
}

function getServerRetryDelayMs(error, now = Date.now()) {
  const unwrapped = unwrapError(error);
  const headers = unwrapped?.response?.headers || {};
  const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
  let delay = null;

  if (retryAfter !== undefined) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds)) {
      delay = Math.max(0, Math.round(seconds * 1000));
    } else {
      const dateMs = Date.parse(String(retryAfter));
      if (Number.isFinite(dateMs)) delay = Math.max(0, dateMs - now);
    }
  }

  const details = unwrapped?.response?.data?.error?.details;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const retryDelay = parseDurationMs(detail?.retryDelay);
      if (retryDelay !== null) delay = Math.max(delay || 0, retryDelay);
    }
  }

  return delay === null ? null : Math.min(MAX_RETRY_DELAY_MS, delay);
}

function getBackoffDelayMs(error, attempt, baseDelay = 1000, random = Math.random) {
  const exponential = Math.min(MAX_RETRY_DELAY_MS, Math.max(0, baseDelay) * (2 ** attempt));
  const jittered = Math.round(exponential * (0.75 + (Math.max(0, Math.min(1, random())) * 0.5)));
  const serverDelay = getServerRetryDelayMs(error);
  return Math.min(MAX_RETRY_DELAY_MS, Math.max(jittered, serverDelay || 0));
}

module.exports = {
  MAX_RETRY_DELAY_MS,
  buildSubtitleResponseSchema,
  buildThinkingConfig,
  extractCandidateText,
  getBackoffDelayMs,
  getGeminiModelProfile,
  getGeminiStatusCode,
  getServerRetryDelayMs,
  isTransientGeminiError,
  normalizeGeminiModelId,
  unwrapError,
};
