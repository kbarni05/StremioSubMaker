'use strict';

const os = require('os');
const { monitorEventLoopDelay, performance } = require('perf_hooks');

const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopHistogram.enable();

let previousCpuSample = {
  usage: process.cpuUsage(),
  time: performance.now()
};

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(finiteNumber(value) * factor) / factor;
}

function percentile(values, percentage) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = values
    .map(value => finiteNumber(value))
    .filter(value => value >= 0)
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.max(0, Math.ceil((percentage / 100) * sorted.length) - 1);
  return sorted[Math.min(index, sorted.length - 1)];
}

function increment(map, key, amount = 1) {
  const safeKey = String(key || '').trim();
  if (!safeKey) return;
  map.set(safeKey, (map.get(safeKey) || 0) + amount);
}

function rankedEntries(map, limit = 6) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function summarizeHistory(historyEntries, now = Date.now()) {
  const entries = Array.isArray(historyEntries) ? historyEntries : [];
  const status = { completed: 0, failed: 0, processing: 0 };
  const durations = [];
  const providers = new Map();
  const models = new Map();
  const targets = new Map();
  const sources = new Map();
  let cached = 0;
  let subtitleEntries = 0;
  let rateLimitErrors = 0;
  let keyRotations = 0;
  let fallbackUses = 0;
  let recoveredEntries = 0;

  const days = [];
  const dailyMap = new Map();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * 86400000);
    const key = date.toISOString().slice(0, 10);
    const item = { date: key, completed: 0, failed: 0, processing: 0 };
    dailyMap.set(key, item);
    days.push(item);
  }

  entries.forEach(entry => {
    const entryStatus = entry?.status === 'completed'
      ? 'completed'
      : (entry?.status === 'failed' ? 'failed' : 'processing');
    status[entryStatus] += 1;

    if (entry?.cached === true) cached += 1;
    subtitleEntries += Math.max(0, finiteNumber(entry?.entryCount));
    rateLimitErrors += Math.max(0, finiteNumber(entry?.rateLimitErrors));
    keyRotations += Math.max(0, finiteNumber(entry?.keyRotationRetries));
    recoveredEntries += Math.max(0, finiteNumber(entry?.recoveredEntries));
    if (entry?.secondaryProviderUsed === true || entry?.usedSecondaryProvider === true) fallbackUses += 1;

    const measuredDuration = finiteNumber(entry?.completedAt) - finiteNumber(entry?.createdAt);
    const durationMs = finiteNumber(entry?.durationMs ?? entry?.duration, measuredDuration);
    if (durationMs > 0) durations.push(durationMs);

    increment(providers, entry?.provider || 'Unknown');
    increment(models, entry?.model || 'Default');
    increment(targets, entry?.targetLanguage || 'Unknown');
    increment(sources, entry?.sourceLanguage || 'Auto');

    const timestamp = finiteNumber(entry?.createdAt);
    if (timestamp > 0) {
      const day = dailyMap.get(new Date(timestamp).toISOString().slice(0, 10));
      if (day) day[entryStatus] += 1;
    }
  });

  const terminal = status.completed + status.failed;
  const total = entries.length;
  const averageDurationMs = durations.length
    ? durations.reduce((sum, value) => sum + value, 0) / durations.length
    : 0;

  return {
    total,
    status,
    successRate: terminal ? round((status.completed / terminal) * 100) : null,
    cacheRate: total ? round((cached / total) * 100) : null,
    cached,
    subtitleEntries,
    averageDurationMs: Math.round(averageDurationMs),
    p95DurationMs: Math.round(percentile(durations, 95)),
    rateLimitErrors,
    keyRotations,
    fallbackUses,
    recoveredEntries,
    providers: rankedEntries(providers),
    models: rankedEntries(models),
    targets: rankedEntries(targets),
    sources: rankedEntries(sources),
    daily: days
  };
}

function readCpuPercent() {
  const now = performance.now();
  const usage = process.cpuUsage();
  const elapsedMs = Math.max(1, now - previousCpuSample.time);
  const cpuDeltaMs = (
    (usage.user - previousCpuSample.usage.user)
    + (usage.system - previousCpuSample.usage.system)
  ) / 1000;
  previousCpuSample = { usage, time: now };
  return round(Math.max(0, Math.min(100, (cpuDeltaMs / elapsedMs) * 100)));
}

function histogramMs(value) {
  const number = finiteNumber(value);
  return Number.isFinite(number) ? round(number / 1e6, 2) : 0;
}

function getRuntimeMetrics() {
  const memory = process.memoryUsage();
  const systemTotal = Math.max(0, finiteNumber(os.totalmem()));
  const systemFree = Math.max(0, finiteNumber(os.freemem()));
  const cpus = os.cpus() || [];
  const resourceUsage = typeof process.resourceUsage === 'function' ? process.resourceUsage() : {};
  const availableMemory = typeof process.availableMemory === 'function'
    ? finiteNumber(process.availableMemory())
    : systemFree;

  const runtime = {
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    cpuModel: cpus[0]?.model || 'Unknown',
    cpuCores: cpus.length,
    processCpuPercent: readCpuPercent(),
    loadAverage: os.loadavg().map(value => round(value, 2)),
    processMemory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers || 0
    },
    systemMemory: {
      totalBytes: systemTotal,
      freeBytes: systemFree,
      availableBytes: Math.max(0, availableMemory),
      usedPercent: systemTotal ? round(((systemTotal - systemFree) / systemTotal) * 100) : 0
    },
    eventLoop: {
      meanMs: histogramMs(eventLoopHistogram.mean),
      p95Ms: histogramMs(eventLoopHistogram.percentile(95)),
      maxMs: histogramMs(eventLoopHistogram.max)
    },
    uptimeSeconds: Math.floor(process.uptime()),
    process: {
      userCpuSeconds: round(finiteNumber(resourceUsage.userCPUTime) / 1e6, 2),
      systemCpuSeconds: round(finiteNumber(resourceUsage.systemCPUTime) / 1e6, 2),
      maxRssBytes: finiteNumber(resourceUsage.maxRSS) * 1024,
      voluntaryContextSwitches: finiteNumber(resourceUsage.voluntaryContextSwitches),
      involuntaryContextSwitches: finiteNumber(resourceUsage.involuntaryContextSwitches)
    }
  };

  eventLoopHistogram.reset();
  return runtime;
}

function buildInsights(snapshot) {
  const insights = [];
  const add = (level, code, value = null) => insights.push({ level, code, value });
  const history = snapshot?.history || {};
  const runtime = snapshot?.runtime || {};
  const storage = snapshot?.storage || {};
  const activeJobs = finiteNumber(snapshot?.addon?.activeTranslations);

  if (!storage.healthy) add('critical', 'storage-unhealthy');
  if (finiteNumber(runtime?.eventLoop?.p95Ms) > 100) add('warning', 'event-loop-lag', runtime.eventLoop.p95Ms);
  if (finiteNumber(runtime?.systemMemory?.usedPercent) >= 90) add('warning', 'memory-pressure', runtime.systemMemory.usedPercent);
  if (history.successRate !== null && finiteNumber(history.successRate) < 85) add('warning', 'translation-failures', history.successRate);
  if (finiteNumber(history.rateLimitErrors) > 0) add('warning', 'rate-limits', history.rateLimitErrors);
  if (activeJobs > 8) add('info', 'busy', activeJobs);

  if (!insights.length) add('success', 'healthy');
  return insights;
}

module.exports = {
  summarizeHistory,
  getRuntimeMetrics,
  buildInsights,
  percentile
};
