'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  summarizeHistory,
  getRuntimeMetrics,
  buildInsights,
  percentile
} = require('./statisticsMetrics');

test('summarizeHistory calculates reliable translation aggregates', () => {
  const now = Date.UTC(2026, 6, 24, 12);
  const history = [
    {
      status: 'completed',
      createdAt: now - 10000,
      completedAt: now - 5000,
      cached: true,
      entryCount: 120,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      sourceLanguage: 'eng',
      targetLanguage: 'hun'
    },
    {
      status: 'completed',
      createdAt: now - 30000,
      completedAt: now - 10000,
      entryCount: 80,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      sourceLanguage: 'eng',
      targetLanguage: 'hun',
      rateLimitErrors: 2,
      usedSecondaryProvider: true,
      keyRotationRetries: 1
    },
    {
      status: 'failed',
      createdAt: now - 86400000,
      completedAt: now - 86390000,
      entryCount: 20,
      provider: 'openai',
      model: 'gpt-test',
      sourceLanguage: 'deu',
      targetLanguage: 'hun'
    },
    { status: 'processing', createdAt: now - 172800000, provider: 'gemini', targetLanguage: 'deu' }
  ];

  const result = summarizeHistory(history, now);
  assert.equal(result.total, 4);
  assert.deepEqual(result.status, { completed: 2, failed: 1, processing: 1 });
  assert.equal(result.successRate, 66.7);
  assert.equal(result.cacheRate, 25);
  assert.equal(result.subtitleEntries, 220);
  assert.equal(result.averageDurationMs, 11667);
  assert.equal(result.p95DurationMs, 20000);
  assert.equal(result.rateLimitErrors, 2);
  assert.equal(result.keyRotations, 1);
  assert.equal(result.fallbackUses, 1);
  assert.deepEqual(result.providers[0], { name: 'gemini', count: 3 });
  assert.deepEqual(result.targets[0], { name: 'hun', count: 3 });
  assert.equal(result.daily.length, 7);
  assert.equal(result.daily.at(-1).completed, 2);
});

test('summarizeHistory handles empty and malformed data without NaN', () => {
  const result = summarizeHistory([{ status: 'completed', durationMs: 'invalid', entryCount: -4 }]);
  assert.equal(result.successRate, 100);
  assert.equal(result.cacheRate, 0);
  assert.equal(result.subtitleEntries, 0);
  assert.equal(result.averageDurationMs, 0);
  assert.equal(result.p95DurationMs, 0);
  assert.equal(percentile([], 95), 0);
});

test('runtime metrics expose bounded, non-sensitive operational values', () => {
  const runtime = getRuntimeMetrics();
  assert.equal(typeof runtime.platform, 'string');
  assert.equal(typeof runtime.architecture, 'string');
  assert.ok(runtime.cpuCores >= 1);
  assert.ok(runtime.processCpuPercent >= 0 && runtime.processCpuPercent <= 100);
  assert.ok(runtime.processMemory.rssBytes > 0);
  assert.ok(runtime.uptimeSeconds >= 0);
  assert.ok(runtime.eventLoop.p95Ms >= 0);
  assert.equal(Object.hasOwn(runtime, 'hostname'), false);
});

test('buildInsights prioritizes actionable health warnings', () => {
  const insights = buildInsights({
    storage: { healthy: false },
    runtime: { eventLoop: { p95Ms: 140 }, systemMemory: { usedPercent: 94 } },
    history: { successRate: 70, rateLimitErrors: 3 },
    addon: { activeTranslations: 12 }
  });
  assert.deepEqual(
    insights.map(item => item.code),
    ['storage-unhealthy', 'event-loop-lag', 'memory-pressure', 'translation-failures', 'rate-limits', 'busy']
  );
  assert.deepEqual(buildInsights({
    storage: { healthy: true },
    runtime: { eventLoop: { p95Ms: 2 }, systemMemory: { usedPercent: 20 } },
    history: { successRate: 100, rateLimitErrors: 0 },
    addon: { activeTranslations: 0 }
  }), [{ level: 'success', code: 'healthy', value: null }]);
});
