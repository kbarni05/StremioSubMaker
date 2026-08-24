const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { deriveVideoHash } = require('./videoHash');
const { selectStreamFilename, deriveStreamHashFromUrl } = require('./streamUrlIdentity');
const { generateEmbeddedSubtitlePage, generateAutoSubtitlePage } = require('./toolboxPageGenerator');
const { generateSubtitleSyncPage } = require('./syncPageGenerator');

const LOCAL_URL = 'http://127.0.0.1:11470/6bbd66ccc0adccc8db658f335ed23f55e32b0dd8/0?';
const LINKED_FILENAME = 'Example.Show.S01E07.1080p.WEB.mkv';
const VIDEO_ID = 'tt2301351:1:7';

test('opaque Stremio local and LAN routes retain linked filename identity', () => {
  const expectedHash = deriveVideoHash(LINKED_FILENAME, VIDEO_ID);
  assert.equal(selectStreamFilename(LOCAL_URL, LINKED_FILENAME), LINKED_FILENAME);
  assert.equal(selectStreamFilename('http://192.168.1.20:11470/abcdef1234567890/0', LINKED_FILENAME), LINKED_FILENAME);

  const identity = deriveStreamHashFromUrl(LOCAL_URL, { filename: LINKED_FILENAME, videoId: VIDEO_ID });
  assert.equal(identity.filename, LINKED_FILENAME);
  assert.equal(identity.hash, expectedHash);
  assert.notEqual(identity.hash, deriveVideoHash('0', VIDEO_ID));
});

test('reliable URL filenames override linked metadata while weak hints do not', () => {
  assert.equal(selectStreamFilename('https://cdn.example/movie/Other.Release.2026.mkv', LINKED_FILENAME), 'Other.Release.2026.mkv');
  assert.equal(selectStreamFilename('https://resolver.example/resolve/abc?name=Short+Title', LINKED_FILENAME), LINKED_FILENAME);
  assert.equal(selectStreamFilename('https://resolver.example/play?file=0&download=1', LINKED_FILENAME), LINKED_FILENAME);
  assert.equal(selectStreamFilename('https://resolver.example/play?filename=Encoded%20Movie.mkv', LINKED_FILENAME), 'Encoded Movie.mkv');
});

test('all stream-based toolbox pages embed the shared filename selector', async () => {
  const config = { uiLanguage: 'en', sourceLanguages: ['eng'], targetLanguages: ['hun'], providers: {} };
  const pages = await Promise.all([
    generateEmbeddedSubtitlePage('test-config', '', LINKED_FILENAME, config),
    generateAutoSubtitlePage('test-config', '', LINKED_FILENAME, config),
    generateSubtitleSyncPage([], '', LINKED_FILENAME, 'test-config', config)
  ]);

  for (const html of pages) {
    assert.match(html, /const selectStreamFilename = function selectStreamFilename/);
    assert.match(html, /selectStreamFilename\(streamUrl,/);
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
      if (match[1].trim()) assert.doesNotThrow(() => new Function(match[1]));
    }
  }

  const serverSource = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
  assert.match(serverSource, /deriveStreamHashFromUrl\(streamUrl, fallback\)/);
});
