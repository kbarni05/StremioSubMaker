const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function readWorkspaceFile(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('mobile duplicate requests join the primary response instead of returning a cached placeholder', () => {
  const source = readWorkspaceFile('index.js');
  const routeStart = source.indexOf("app.get('/addon/:config/translate/:sourceFileId/:targetLang'");
  const routeEnd = source.indexOf('// Custom route: Learn Mode', routeStart);
  const route = source.slice(routeStart, routeEnd);

  assert.notEqual(routeStart, -1);
  assert.match(route, /Mobile mode duplicate request[\s\S]*joining primary request/);
  assert.doesNotMatch(route, /return res\.send\(t\('server\.errors\.translationInProgress'/);
  assert.match(route, /const subtitleContent = await deduplicate\(\s*dedupKey/);
  assert.match(route, /mobileDedupTtlMs[\s\S]*\{ ttl: mobileDedupTtlMs \}/);
});

test('mobile action URLs are revisioned and completed translations return their content directly', () => {
  const source = readWorkspaceFile('src/handlers/subtitles.js');

  assert.match(source, /translateQueryParts\.push\('mobile=1'\)/);
  assert.match(source, /translateQueryParts\.push\(`mobileRev=\$\{subtitleSearchRevision\}`\)/);
  assert.match(source, /waitForMobileTranslationResult\(\{/);
  assert.match(source, /content: translatedContent/);
  assert.match(source, /config\?\.mobileMode === true \|\| embeddedSource/);
});
