const test = require('node:test');
const assert = require('node:assert/strict');

const { createNonOverlappingRunner } = require('./backgroundInterval');

test('non-overlapping runner skips a tick while work is active', async () => {
  let release;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const run = createNonOverlappingRunner(async () => {
    calls += 1;
    await gate;
  });

  const first = run();
  assert.equal(run.isRunning(), true);
  assert.equal(await run(), false);
  assert.equal(calls, 1);

  release();
  assert.equal(await first, true);
  assert.equal(run.isRunning(), false);
});

test('non-overlapping runner recovers after a rejected task', async () => {
  const errors = [];
  let calls = 0;
  const run = createNonOverlappingRunner(async () => {
    calls += 1;
    if (calls === 1) throw new Error('temporary failure');
  }, error => errors.push(error.message));

  assert.equal(await run(), false);
  assert.deepEqual(errors, ['temporary failure']);
  assert.equal(await run(), true);
  assert.equal(calls, 2);
});
