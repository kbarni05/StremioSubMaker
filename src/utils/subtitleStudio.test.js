const test = require('node:test');
const assert = require('node:assert/strict');

const studio = require('../../public/js/subtitle-studio');

const SAMPLE = `\uFEFF2\r
00:00:03.000 --> 00:00:05,000\r
Second subtitle\r
\r
1\r
00:00:01,000 --> 00:00:04,000\r
First subtitle`;

test('repair normalizes, sorts, renumbers, and resolves overlapping SRT cues', () => {
  const output = studio.repairSrt(SAMPLE);
  const parsed = studio.parseSrt(output);

  assert.equal(parsed.cues.length, 2);
  assert.equal(parsed.cues[0].text, 'First subtitle');
  assert.equal(parsed.cues[1].text, 'Second subtitle');
  assert.ok(parsed.cues[0].endMs < parsed.cues[1].startMs);
  assert.match(output, /^1\n00:00:01,000/);
});

test('timing shift clamps negative timestamps and preserves valid durations', () => {
  const shifted = studio.shiftTimings(`1
00:00:01,000 --> 00:00:02,000
Hello`, -1500);
  assert.equal(shifted, `1
00:00:00,000 --> 00:00:00,500
Hello`);
});

test('FPS retiming applies source divided by target scaling', () => {
  const retimed = studio.retimeFps(`1
00:00:10,000 --> 00:00:12,000
Hello`, 25, 50);
  assert.match(retimed, /00:00:05,000 --> 00:00:06,000/);
});

test('smart wrapping preserves every word while respecting the requested line count', () => {
  const wrapped = studio.smartWrap(`1
00:00:00,000 --> 00:00:03,000
This is a deliberately long subtitle sentence for a television screen`, {
    maxLineLength: 24,
    maxLines: 2,
  });
  const text = studio.parseSrt(wrapped).cues[0].text;
  assert.equal(text.split('\n').length, 2);
  assert.equal(text.replace(/\n/g, ' '), 'This is a deliberately long subtitle sentence for a television screen');
});

test('plain search replacement is literal and regex replacement supports capture groups', () => {
  const source = `1
00:00:00,000 --> 00:00:02,000
Price is $5. PRICE is $6.`;
  const plain = studio.searchReplace(source, '$5', '$10');
  assert.match(plain, /Price is \$10/);

  const regex = studio.searchReplace(source, 'price is \\$(\\d+)', 'Cost: $1', {
    useRegex: true,
    caseSensitive: false,
  });
  assert.match(regex, /Cost: 5\. Cost: 6\./);
});

test('non-repair transformations preserve existing cue indexes', () => {
  const source = `7
00:00:01,000 --> 00:00:02,000
Original line`;
  assert.match(studio.shiftTimings(source, 100), /^7\n/);
  assert.match(studio.retimeFps(source, 24, 25), /^7\n/);
  assert.match(studio.smartWrap(source, { maxLineLength: 20, maxLines: 2 }), /^7\n/);
  assert.match(studio.searchReplace(source, 'Original', 'Updated'), /^7\n/);
});

test('diagnostics report invalid blocks, overlaps, reading speed, and long lines', () => {
  const report = studio.analyzeSrt(`${SAMPLE}

broken block without timestamp`, { maxLineLength: 5, maxCps: 5 });
  assert.equal(report.cueCount, 2);
  assert.equal(report.invalidBlocks, 1);
  assert.equal(report.overlaps, 1);
  assert.ok(report.longLines > 0);
  assert.ok(report.highCps > 0);
  assert.ok(report.issueCount >= 4);
});

test('invalid input, unsafe file sizes, and malformed regexes fail explicitly', () => {
  assert.throws(() => studio.repairSrt('not an SRT'), { code: 'NO_VALID_CUES' });
  assert.throws(
    () => studio.shiftTimings(`1
00:00:00,000 --> 00:00:01,000
Valid

orphaned subtitle text`, 500),
    { code: 'UNRECOVERABLE_BLOCKS' }
  );
  assert.throws(
    () => studio.assertFileSize({ size: studio.DEFAULT_MAX_FILE_BYTES + 1 }),
    { code: 'FILE_TOO_LARGE' }
  );
  assert.throws(
    () => studio.searchReplace(`1
00:00:00,000 --> 00:00:01,000
Hello`, '(', '', { useRegex: true }),
    { code: 'INVALID_REGEX' }
  );
  assert.throws(
    () => studio.searchReplace(`1
00:00:00,000 --> 00:00:01,000
Hello`, '(a+)+$', '', { useRegex: true }),
    { code: 'UNSAFE_REGEX' }
  );
  assert.throws(
    () => studio.shiftTimings('x'.repeat(studio.DEFAULT_MAX_TEXT_CHARS + 1), 100),
    { code: 'TEXT_TOO_LARGE' }
  );
});
