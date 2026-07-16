'use strict';

function uniqueKeys(keys) {
  return [...new Set((keys || []).filter(key => typeof key === 'string' && key.length > 0))];
}

function createRunningStatus({ userHash = '', now = Date.now() } = {}) {
  return {
    status: 'running',
    stage: 'starting',
    inProgress: true,
    startedAt: now,
    updatedAt: now,
    userHash
  };
}

function updateTranslationJobStatus(cache, keys, patch, now = Date.now()) {
  const targetKeys = uniqueKeys(keys);
  const existing = targetKeys.map(key => cache.get(key)).find(Boolean) || {};
  const next = {
    ...existing,
    ...patch,
    updatedAt: patch.updatedAt || now
  };

  for (const key of targetKeys) cache.set(key, next);
  return next;
}

function calculatePercent(status) {
  if (status.status === 'completed') return 100;
  const completed = Number(status.completedEntries);
  const total = Number(status.totalEntries);
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(99, Math.round((completed / total) * 100)));
}

function toPublicTranslationJobStatus(status, now = Date.now()) {
  if (!status) {
    return { status: 'idle', stage: 'idle', inProgress: false, progress: null };
  }

  const startedAt = Number.isFinite(status.startedAt) ? status.startedAt : null;
  const progress = Number.isFinite(Number(status.totalEntries)) && Number(status.totalEntries) > 0
    ? {
        currentBatch: Number(status.currentBatch) || 0,
        totalBatches: Number(status.totalBatches) || 0,
        completedEntries: Number(status.completedEntries) || 0,
        totalEntries: Number(status.totalEntries),
        percent: calculatePercent(status)
      }
    : null;

  return {
    status: status.status || (status.inProgress ? 'running' : 'idle'),
    stage: status.stage || (status.inProgress ? 'translating' : 'idle'),
    inProgress: status.inProgress === true,
    startedAt,
    updatedAt: Number.isFinite(status.updatedAt) ? status.updatedAt : startedAt,
    completedAt: Number.isFinite(status.completedAt) ? status.completedAt : null,
    failedAt: Number.isFinite(status.failedAt) ? status.failedAt : null,
    elapsedSeconds: startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0,
    progress
  };
}

module.exports = {
  createRunningStatus,
  updateTranslationJobStatus,
  toPublicTranslationJobStatus
};
