'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDiagnosticReport, summarizeConfiguration } = require('./diagnostics');

function healthySnapshot() {
  return {
    generatedAt: '2026-08-15T10:00:00.000Z',
    version: '1.8.0',
    history: { total: 10, successRate: 100, cacheRate: 40, averageDurationMs: 1200, rateLimitErrors: 0 },
    runtime: {
      platform: 'linux', architecture: 'arm64', nodeVersion: 'v24.0.0', cpuCores: 4,
      processCpuPercent: 4, processMemory: { rssBytes: 1000 }, systemMemory: { usedPercent: 42 },
      eventLoop: { p95Ms: 8 }, uptimeSeconds: 120
    },
    storage: { type: 'redis', healthy: true, caches: [{ utilizationPercent: 12 }] },
    addon: { activeTranslations: 0 }
  };
}

test('diagnostic report is healthy and never includes credentials', () => {
  const config = {
    uiLanguage: 'hu', sourceLanguages: ['eng'], targetLanguages: ['hun'],
    geminiApiKey: 'secret-key', geminiApiKeys: ['secret-key', 'second-secret'], geminiModel: 'gemini-test',
    mainProvider: 'gemini', subtitleProviders: { opensubtitles: { enabled: true, password: 'secret-password' } },
    translationCache: { enabled: true, persistent: true }, mobileMode: true, mobileModeTimeoutSeconds: 240
  };
  const report = buildDiagnosticReport(healthySnapshot(), config, { validation: { valid: true, errors: [] } });
  assert.equal(report.status, 'healthy');
  assert.equal(report.score, 100);
  assert.equal(report.configuration.configuredAiProviderCount, 1);
  assert.equal(report.configuration.mobileWaitSeconds, 240);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /secret-key|second-secret|secret-password/);
});

test('diagnostic report prioritizes storage and invalid configuration failures', () => {
  const snapshot = healthySnapshot();
  snapshot.storage.healthy = false;
  snapshot.history.successRate = 50;
  snapshot.runtime.systemMemory.usedPercent = 97;
  const report = buildDiagnosticReport(snapshot, { subtitleProviders: {} }, {
    validation: { valid: false, errors: ['missing provider'] }
  });
  assert.equal(report.status, 'critical');
  assert.ok(report.score < 50);
  assert.ok(report.summary.failed >= 4);
});

test('fetch-only mode does not require an AI provider', () => {
  const summary = summarizeConfiguration({
    noTranslationMode: true,
    noTranslationLanguages: ['hun'],
    subtitleProviders: { scs: { enabled: true } }
  });
  assert.equal(summary.mode, 'fetch-only');
  assert.equal(summary.configuredAiProviderCount, 0);
  const report = buildDiagnosticReport(healthySnapshot(), {
    noTranslationMode: true,
    noTranslationLanguages: ['hun'],
    subtitleProviders: { scs: { enabled: true } }
  }, { validation: { valid: true, errors: [] } });
  assert.equal(report.checks.find(item => item.id === 'ai-provider').status, 'info');
  assert.equal(report.status, 'healthy');
});
