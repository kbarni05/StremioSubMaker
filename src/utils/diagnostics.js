'use strict';

const KEY_OPTIONAL_PROVIDERS = new Set(['googletranslate']);

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function countGeminiKeys(config = {}) {
  const keys = new Set();
  if (typeof config.geminiApiKey === 'string' && config.geminiApiKey.trim()) {
    keys.add(config.geminiApiKey.trim());
  }
  if (Array.isArray(config.geminiApiKeys)) {
    config.geminiApiKeys.forEach(key => {
      if (typeof key === 'string' && key.trim()) keys.add(key.trim());
    });
  }
  return keys.size;
}

function providerIsConfigured(name, provider = {}) {
  if (!provider || provider.enabled !== true) return false;
  const normalized = String(name || '').toLowerCase();
  const hasModel = typeof provider.model === 'string' && provider.model.trim().length > 0;
  if (normalized === 'custom') {
    return hasModel && typeof provider.baseUrl === 'string' && provider.baseUrl.trim().length > 0;
  }
  if (KEY_OPTIONAL_PROVIDERS.has(normalized)) return hasModel;
  return hasModel && typeof provider.apiKey === 'string' && provider.apiKey.trim().length > 0;
}

function summarizeConfiguration(config = {}) {
  const geminiKeyCount = countGeminiKeys(config);
  const configuredAiProviders = [];
  if (geminiKeyCount > 0 && String(config.geminiModel || '').trim()) {
    configuredAiProviders.push('gemini');
  }
  Object.entries(config.providers || {}).forEach(([name, provider]) => {
    if (providerIsConfigured(name, provider)) configuredAiProviders.push(String(name).toLowerCase());
  });

  const enabledSubtitleProviders = Object.entries(config.subtitleProviders || {})
    .filter(([, provider]) => provider?.enabled === true)
    .map(([name]) => name);
  const noTranslationMode = config.noTranslationMode === true;
  const sourceLanguages = Array.isArray(config.sourceLanguages) ? config.sourceLanguages : [];
  const targetLanguages = noTranslationMode
    ? (Array.isArray(config.noTranslationLanguages) ? config.noTranslationLanguages : [])
    : (Array.isArray(config.targetLanguages) ? config.targetLanguages : []);

  return {
    mode: noTranslationMode ? 'fetch-only' : 'translation',
    sourceLanguageCount: sourceLanguages.length,
    targetLanguageCount: targetLanguages.length,
    learnLanguageCount: Array.isArray(config.learnTargetLanguages) ? config.learnTargetLanguages.length : 0,
    configuredAiProviders,
    configuredAiProviderCount: configuredAiProviders.length,
    primaryProvider: noTranslationMode ? null : String(config.mainProvider || 'gemini').toLowerCase(),
    fallbackEnabled: !noTranslationMode && config.multiProviderEnabled === true && config.secondaryProviderEnabled === true,
    fallbackProvider: !noTranslationMode && config.secondaryProviderEnabled === true
      ? String(config.secondaryProvider || '').toLowerCase() || null
      : null,
    enabledSubtitleProviders,
    enabledSubtitleProviderCount: enabledSubtitleProviders.length,
    mobileMode: config.mobileMode === true,
    mobileWaitSeconds: config.mobileMode === true ? finiteNumber(config.mobileModeTimeoutSeconds) : null,
    toolboxEnabled: config.subToolboxEnabled === true,
    cacheEnabled: config.translationCache?.enabled !== false,
    persistentCache: config.translationCache?.persistent !== false,
    uiLanguage: String(config.uiLanguage || 'en')
  };
}

function check(id, category, status, weight, value = null) {
  return { id, category, status, weight, value };
}

function buildDiagnosticReport(snapshot = {}, config = {}, options = {}) {
  const configuration = summarizeConfiguration(config);
  const validation = options.validation && typeof options.validation === 'object'
    ? options.validation
    : { valid: true, errors: [] };
  const history = snapshot.history || {};
  const runtime = snapshot.runtime || {};
  const storage = snapshot.storage || {};
  const checks = [];

  checks.push(check('storage', 'core', storage.healthy === true ? 'pass' : 'fail', 22, storage.type || 'unknown'));
  checks.push(check('configuration', 'configuration', validation.valid === true ? 'pass' : 'fail', 18,
    Array.isArray(validation.errors) ? validation.errors.length : 0));
  checks.push(check('subtitle-providers', 'configuration', configuration.enabledSubtitleProviderCount > 0 ? 'pass' : 'fail', 12,
    configuration.enabledSubtitleProviderCount));

  if (configuration.mode === 'fetch-only') {
    checks.push(check('ai-provider', 'configuration', 'info', 0, 'not-required'));
    checks.push(check('languages', 'configuration', configuration.targetLanguageCount > 0 ? 'pass' : 'fail', 12,
      configuration.targetLanguageCount));
  } else {
    checks.push(check('ai-provider', 'configuration', configuration.configuredAiProviderCount > 0 ? 'pass' : 'fail', 14,
      configuration.configuredAiProviderCount));
    checks.push(check('languages', 'configuration', configuration.sourceLanguageCount > 0 && configuration.targetLanguageCount > 0 ? 'pass' : 'fail', 12,
      `${configuration.sourceLanguageCount}/${configuration.targetLanguageCount}`));
  }

  if (history.successRate === null || history.successRate === undefined) {
    checks.push(check('translation-health', 'activity', 'info', 0, null));
  } else {
    const successRate = finiteNumber(history.successRate);
    checks.push(check('translation-health', 'activity', successRate >= 90 ? 'pass' : (successRate >= 75 ? 'warn' : 'fail'), 10, successRate));
  }
  const rateLimits = finiteNumber(history.rateLimitErrors);
  checks.push(check('rate-limits', 'activity', rateLimits === 0 ? 'pass' : 'warn', 5, rateLimits));

  const eventLoopP95 = finiteNumber(runtime.eventLoop?.p95Ms);
  checks.push(check('event-loop', 'runtime', eventLoopP95 <= 100 ? 'pass' : (eventLoopP95 <= 250 ? 'warn' : 'fail'), 4, eventLoopP95));
  const memoryUsed = finiteNumber(runtime.systemMemory?.usedPercent);
  checks.push(check('memory', 'runtime', memoryUsed < 85 ? 'pass' : (memoryUsed < 95 ? 'warn' : 'fail'), 4, memoryUsed));

  const maxCacheUtilization = Array.isArray(storage.caches)
    ? storage.caches.reduce((max, item) => Math.max(max, finiteNumber(item?.utilizationPercent)), 0)
    : 0;
  checks.push(check('cache-capacity', 'runtime', maxCacheUtilization < 80 ? 'pass' : (maxCacheUtilization < 95 ? 'warn' : 'fail'), 3, maxCacheUtilization));
  checks.push(check('mobile-mode', 'experience', configuration.mobileMode ? 'pass' : 'info', 0,
    configuration.mobileWaitSeconds));

  let score = 100;
  checks.forEach(item => {
    if (item.status === 'fail') score -= item.weight;
    if (item.status === 'warn') score -= Math.max(1, Math.ceil(item.weight / 2));
  });
  score = Math.max(0, Math.min(100, Math.round(score)));
  const failed = checks.filter(item => item.status === 'fail').length;
  const warnings = checks.filter(item => item.status === 'warn').length;
  const status = failed > 0 || score < 70 ? 'critical' : (warnings > 0 || score < 95 ? 'warning' : 'healthy');

  return {
    schemaVersion: 1,
    generatedAt: snapshot.generatedAt || new Date().toISOString(),
    version: snapshot.version || options.version || '',
    score,
    status,
    summary: {
      passed: checks.filter(item => item.status === 'pass').length,
      warnings,
      failed,
      informational: checks.filter(item => item.status === 'info').length
    },
    checks,
    configuration,
    runtime: {
      platform: runtime.platform || '',
      architecture: runtime.architecture || '',
      nodeVersion: runtime.nodeVersion || '',
      cpuCores: finiteNumber(runtime.cpuCores),
      processCpuPercent: finiteNumber(runtime.processCpuPercent),
      processMemoryBytes: finiteNumber(runtime.processMemory?.rssBytes),
      systemMemoryUsedPercent: memoryUsed,
      eventLoopP95Ms: eventLoopP95,
      uptimeSeconds: finiteNumber(runtime.uptimeSeconds)
    },
    activity: {
      total: finiteNumber(history.total),
      successRate: history.successRate ?? null,
      averageDurationMs: finiteNumber(history.averageDurationMs),
      cacheRate: history.cacheRate ?? null,
      rateLimitErrors: rateLimits,
      activeTranslations: finiteNumber(snapshot.addon?.activeTranslations)
    },
    storage: {
      type: String(storage.type || 'unknown'),
      healthy: storage.healthy === true,
      maxCacheUtilizationPercent: maxCacheUtilization
    }
  };
}

module.exports = {
  buildDiagnosticReport,
  summarizeConfiguration,
  providerIsConfigured,
  countGeminiKeys
};
