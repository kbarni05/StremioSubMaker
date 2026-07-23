const DEFAULT_MOBILE_WAIT_SECONDS = 240;
const MIN_MOBILE_WAIT_SECONDS = 60;
const MAX_MOBILE_WAIT_SECONDS = 600;

function clampMobileWaitSeconds(value, fallback = DEFAULT_MOBILE_WAIT_SECONDS) {
  const parsed = Number.parseInt(value, 10);
  const safeFallback = Number.isFinite(Number.parseInt(fallback, 10))
    ? Number.parseInt(fallback, 10)
    : DEFAULT_MOBILE_WAIT_SECONDS;
  const seconds = Number.isFinite(parsed) ? parsed : safeFallback;
  return Math.max(MIN_MOBILE_WAIT_SECONDS, Math.min(MAX_MOBILE_WAIT_SECONDS, seconds));
}

function getMobileWaitTimeoutMs(config, env = process.env) {
  const envDefault = clampMobileWaitSeconds(
    env?.MOBILE_MODE_WAIT_TIMEOUT_SECONDS,
    DEFAULT_MOBILE_WAIT_SECONDS
  );
  return clampMobileWaitSeconds(config?.mobileModeTimeoutSeconds, envDefault) * 1000;
}

function extractTranslationContent(result) {
  if (typeof result === 'string' && result.trim()) return result;
  if (result && typeof result === 'object' && typeof result.content === 'string' && result.content.trim()) {
    return result.content;
  }
  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for a mobile translation without depending exclusively on storage polling.
 * A local promise can deliver the finished subtitle immediately; readFinal keeps
 * multi-instance/Redis deployments working when another process owns the job.
 */
async function waitForMobileTranslation({
  translationPromise = null,
  readFinal,
  timeoutMs,
  startedAt = Date.now(),
  initialPollMs = 500,
  maxPollMs = 3000,
}) {
  const safeTimeoutMs = Math.max(1, Number(timeoutMs) || (DEFAULT_MOBILE_WAIT_SECONDS * 1000));
  const safeStartedAt = Number.isFinite(Number(startedAt)) ? Number(startedAt) : Date.now();
  const deadline = safeStartedAt + safeTimeoutMs;
  let promiseOutcome = null;
  let pollMs = Math.max(10, Number(initialPollMs) || 500);
  const pollLimit = Math.max(pollMs, Number(maxPollMs) || 3000);

  const trackedPromise = translationPromise
    ? Promise.resolve(translationPromise).then(
      value => {
        promiseOutcome = { status: 'fulfilled', value };
        return promiseOutcome;
      },
      error => {
        promiseOutcome = { status: 'rejected', error };
        return promiseOutcome;
      }
    )
    : null;

  const tryReadFinal = async () => {
    if (typeof readFinal !== 'function') return null;
    try {
      return extractTranslationContent(await readFinal());
    } catch (_) {
      return null;
    }
  };

  while (Date.now() < deadline) {
    const remainingBeforePoll = deadline - Date.now();
    if (trackedPromise && !promiseOutcome && remainingBeforePoll > 0) {
      await Promise.race([
        trackedPromise,
        delay(Math.min(pollMs, remainingBeforePoll))
      ]);
    }

    if (promiseOutcome?.status === 'fulfilled') {
      const directContent = extractTranslationContent(promiseOutcome.value);
      if (directContent) {
        return { status: 'completed', content: directContent, source: 'promise' };
      }
    } else if (promiseOutcome?.status === 'rejected') {
      return { status: 'failed', error: promiseOutcome.error };
    }

    const cachedContent = await tryReadFinal();
    if (cachedContent) {
      return { status: 'completed', content: cachedContent, source: 'cache' };
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    const waitMs = Math.min(pollMs, remainingMs);
    if (!trackedPromise || promiseOutcome) {
      await delay(waitMs);
    }
    pollMs = Math.min(pollLimit, Math.ceil(pollMs * 1.6));
  }

  const finalContent = await tryReadFinal();
  if (finalContent) {
    return { status: 'completed', content: finalContent, source: 'cache' };
  }
  if (promiseOutcome?.status === 'fulfilled') {
    const directContent = extractTranslationContent(promiseOutcome.value);
    if (directContent) {
      return { status: 'completed', content: directContent, source: 'promise' };
    }
  }
  if (promiseOutcome?.status === 'rejected') {
    return { status: 'failed', error: promiseOutcome.error };
  }
  return { status: 'timeout' };
}

module.exports = {
  DEFAULT_MOBILE_WAIT_SECONDS,
  MAX_MOBILE_WAIT_SECONDS,
  MIN_MOBILE_WAIT_SECONDS,
  clampMobileWaitSeconds,
  extractTranslationContent,
  getMobileWaitTimeoutMs,
  waitForMobileTranslation,
};
