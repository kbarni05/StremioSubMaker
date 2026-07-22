function createNonOverlappingRunner(callback, onError = null) {
  if (typeof callback !== 'function') {
    throw new TypeError('Background callback must be a function');
  }

  let running = false;

  const run = async () => {
    if (running) {
      return false;
    }

    running = true;
    try {
      await callback();
      return true;
    } catch (error) {
      if (typeof onError === 'function') {
        onError(error);
      }
      return false;
    } finally {
      running = false;
    }
  };

  run.isRunning = () => running;
  return run;
}

function scheduleNonOverlappingInterval(callback, intervalMs, onError = null) {
  const delay = Number(intervalMs);
  if (!Number.isFinite(delay) || delay <= 0) {
    throw new TypeError('Background interval must be a positive number');
  }

  const run = createNonOverlappingRunner(callback, onError);
  const timer = setInterval(() => {
    void run();
  }, delay);
  timer.unref?.();
  return timer;
}

module.exports = {
  createNonOverlappingRunner,
  scheduleNonOverlappingInterval
};
