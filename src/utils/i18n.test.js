const test = require('node:test');
const assert = require('node:assert/strict');

const { loadLocale, getTranslator, mergeMessages } = require('./i18n');

test('regional Hungarian locale resolves to the Hungarian base locale', () => {
  const locale = loadLocale('hu-HU');
  assert.equal(locale.lang, 'hu');
  assert.equal(locale.messages.config.heroSubtitle, 'MI-alapú feliratfordítás');
});

test('partial locales inherit missing English messages', () => {
  const locale = loadLocale('hu');
  const english = loadLocale('en');
  assert.equal(
    locale.messages.server.errors.storageUnavailable,
    english.messages.server.errors.storageUnavailable,
  );
});

test('Hungarian translations preserve interpolation variables', () => {
  const t = getTranslator('hu-HU');
  assert.equal(t('config.quickSetup.stepOf', { current: 2, total: 7 }), '2. lépés / 7');
});

test('mobile mode guidance and timeout subtitles are available in Hungarian', () => {
  const t = getTranslator('hu');
  assert.equal(t('config.otherSettings.mobileMode.timeout4m'), '4 perc (ajánlott)');
  assert.equal(t('subtitle.mobileTimeoutTitle'), 'A MOBILFORDÍTÁS MÉG FOLYAMATBAN VAN');
});

test('message merging does not mutate either input', () => {
  const base = { section: { title: 'English', description: 'Fallback' } };
  const override = { section: { title: 'Magyar' } };
  const merged = mergeMessages(base, override);

  assert.deepEqual(merged, { section: { title: 'Magyar', description: 'Fallback' } });
  assert.equal(base.section.title, 'English');
  assert.equal(override.section.title, 'Magyar');
});
