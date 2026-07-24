'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { generateStatisticsPage } = require('./statisticsPageGenerator');

test('statistics page is localized, responsive, and includes safe live controls', () => {
  const token = 'a'.repeat(32);
  const html = generateStatisticsPage(token, { uiLanguage: 'hu' }, 'tt123', 'movie.mkv');

  assert.match(html, /Statisztika és teljesítmény/);
  assert.match(html, /Fordítási előzmények/);
  assert.match(html, /\/api\/statistics\?config=/);
  assert.match(html, /id="refreshInterval"/);
  assert.match(html, /id="dailyChart"/);
  assert.match(html, /@media \(max-width: 700px\)/);

  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(source => source.trim());
  assert.ok(scripts.length >= 3);
  scripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: `statistics-inline-${index}.js` }));
  });
});

test('configure page exposes top-level history and statistics shortcuts', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'partials', 'main.html'), 'utf8');
  const client = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'config.js'), 'utf8');
  assert.match(main, /id="activityQuickLinks"/);
  assert.match(main, /id="translationHistoryLauncher"/);
  assert.match(main, /id="statisticsLauncher"/);
  assert.match(client, /buildActivityUrl\('\/sub-history'/);
  assert.match(client, /buildActivityUrl\('\/statistics'/);
});
