const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { version } = require('./version');
const { loadChangelog, parseChangelogMarkdown } = require('./changelog');

const projectRoot = path.resolve(__dirname, '..', '..');

test('changelog parser returns released versions newest first', () => {
  const entries = parseChangelogMarkdown([
    '# Changelog',
    '## Unreleased',
    'No changes yet.',
    '## SubMaker v2.0.0',
    '**New Features:**',
    '- New release',
    '## SubMaker v1.9.0',
    '**Bug Fixes:**',
    '- Previous release',
  ].join('\n'));

  assert.deepEqual(entries.map(entry => entry.version), ['2.0.0', '1.9.0']);
  assert.match(entries[0].content, /New release/);
});

test('application changelog starts with the package version', () => {
  const changelog = loadChangelog({ currentVersion: version, baseDir: projectRoot, cwd: projectRoot });

  assert.equal(changelog.isFallback, undefined);
  assert.equal(changelog.entries[0].version, version);
  assert.match(changelog.entries[0].content, /\*\*Bug Fixes:\*\*/);
});

test('in-app release links target the maintained repository', () => {
  const configScript = fs.readFileSync(path.join(projectRoot, 'public', 'config.js'), 'utf8');

  assert.match(configScript, /github\.com\/kbarni05\/StremioSubMaker\/releases\/tag\/v/);
  assert.doesNotMatch(configScript, /github\.com\/xtremexq\/StremioSubMaker\/releases\/tag\/v/);
});
