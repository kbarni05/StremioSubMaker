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

test('Stremio translation actions are localized without fragmenting the language group', () => {
  const label = buildStremioActionLabel({
    kind: 'translate',
    language: getLocalizedLanguageName('hun', 'hu', 'Hungarian'),
    sourceCode: 'eng',
    index: 2,
    total: 16,
    t: getTranslator('hu'),
  });

  assert.equal(label, '▶ Fordítás: magyar');
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
  assert.equal(learn, '◇ Tanulás: latin-amerikai spanyol');
  assert.equal(buildCachedSubtitleLabel('xSync', 'magyar'), 'xSync ✓ magyar');
  assert.equal(buildStremioNoticeLabel('toolbox', getTranslator('hu')), '🧰 Felirat-eszköztár');
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
  assert.equal(label, '📱 Mobilfordítás: magyar');
});

test('all sources for one target language share the exact Stremio group label', () => {
  const t = getTranslator('en');
  const labels = [
    { sourceCode: 'eng', index: 1 },
    { sourceCode: 'deu', index: 2 },
    { sourceCode: 'spa', index: 3 },
  ].map(source => buildStremioActionLabel({
    kind: 'translate',
    language: 'Hungarian',
    sourceCode: source.sourceCode,
    index: source.index,
    total: 3,
    t,
  }));

  assert.deepEqual(labels, ['▶ Make Hungarian', '▶ Make Hungarian', '▶ Make Hungarian']);
  assert.equal(new Set(labels).size, 1);
});

test('Stremio labels remove control characters and enforce a safe display length', () => {
  const label = sanitizeStremioLabel(`Line one\n${'x'.repeat(120)}`);
  assert.equal(label.includes('\n'), false);
  assert.equal(Array.from(label).length, 96);
  assert.equal(label.endsWith('…'), true);
});
