'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { generateDiagnosticsPage, buildLinks } = require('./diagnosticsPageGenerator');

test('diagnostics page is localized, responsive, and contains privacy-safe report actions', () => {
  const token = 'b'.repeat(32);
  const html = generateDiagnosticsPage(token, {
    uiLanguage: 'hu',
    geminiApiKey: 'SENTINEL_PRIVATE_GEMINI_KEY',
    translationPrompt: 'SENTINEL_PRIVATE_PROMPT',
    subtitleProviders: { opensubtitles: { password: 'SENTINEL_PRIVATE_PASSWORD' } }
  }, 'tt123', 'movie.mkv');
  assert.match(html, /Rendszerdiagnosztika/);
  assert.match(html, /\/api\/diagnostics\?config=/);
  assert.match(html, /id="copyReport"/);
  assert.match(html, /id="downloadReport"/);
  assert.match(html, /API-kulcs/);
  assert.match(html, /@media \(max-width:560px\)/);
  assert.doesNotMatch(html, /SENTINEL_PRIVATE_/);

  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(source => source.trim());
  scripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: `diagnostics-inline-${index}.js` }));
  });
});

test('diagnostics links preserve stream context without leaking it into configure', () => {
  const links = buildLinks('a'.repeat(32), 'tt123', 'movie.mkv');
  assert.match(links.diagnostics, /videoId=tt123/);
  assert.match(links.diagnostics, /filename=movie.mkv/);
  assert.doesNotMatch(links.configure, /videoId|filename/);
});
