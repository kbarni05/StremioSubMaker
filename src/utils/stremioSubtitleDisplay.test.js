const test = require('node:test');
const assert = require('node:assert/strict');

const { getTranslator } = require('./i18n');
const {
  buildCachedSubtitleLabel,
  buildStremioActionLabel,
  buildStremioNoticeLabel,
  getLocalizedLanguageName,
  sanitizeStremioLabel,
} = require('./stremioSubtitleDisplay');

test('Stremio translation actions are localized and identify the source entry', () => {
  const label = buildStremioActionLabel({
    kind: 'translate',
    language: getLocalizedLanguageName('hun', 'hu', 'Hungarian'),
    sourceCode: 'eng',
    index: 2,
    total: 16,
    t: getTranslator('hu'),
  });

  assert.equal(label, '▶ Fordítás: magyar · 2/16. forrás · ENG');
});

test('Stremio learning and cached labels stay compact and descriptive', () => {
  const learn = buildStremioActionLabel({
    kind: 'learn',
    language: getLocalizedLanguageName('es-419', 'hu', 'Spanish'),
    sourceCode: 'eng',
    index: 1,
    total: 4,
    t: getTranslator('hu'),
  });
  assert.equal(learn, '◇ Tanulás: latin-amerikai spanyol · 1/4. forrás · ENG');
  assert.equal(buildCachedSubtitleLabel('xSync', 'magyar'), 'xSync ✓ magyar');
  assert.equal(buildStremioNoticeLabel('toolbox', getTranslator('hu')), '🧰 Sub Toolbox');
});

test('Stremio mobile actions are visibly distinct from streaming desktop actions', () => {
  const label = buildStremioActionLabel({
    kind: 'translate',
    language: 'magyar',
    sourceCode: 'eng',
    index: 3,
    total: 12,
    mobileMode: true,
    t: getTranslator('hu'),
  });
  assert.equal(label, '📱 Mobilfordítás: magyar · 3/12. forrás · ENG');
});

test('Stremio labels remove control characters and enforce a safe display length', () => {
  const label = sanitizeStremioLabel(`Line one\n${'x'.repeat(120)}`);
  assert.equal(label.includes('\n'), false);
  assert.equal(Array.from(label).length, 96);
  assert.equal(label.endsWith('…'), true);
});
