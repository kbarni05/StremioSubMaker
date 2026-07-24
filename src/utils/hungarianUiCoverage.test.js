const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { expandDottedMessages, mergeMessages } = require('./i18n');

const ROOT = path.join(__dirname, '..', '..');

function flattenMessages(value, prefix = '', result = {}) {
  Object.entries(value || {}).forEach(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flattenMessages(child, fullKey, result);
    } else {
      result[fullKey] = child;
    }
  });
  return result;
}

function collectHungarianUiKeys() {
  const publicDir = path.join(ROOT, 'public');
  const pageGeneratorDir = path.join(ROOT, 'src', 'utils');
  const files = [
    ...fs.readdirSync(publicDir, { recursive: true })
      .filter((file) => /\.(?:html|js)$/.test(file))
      .map((file) => path.join(publicDir, file)),
    ...fs.readdirSync(pageGeneratorDir)
      .filter((file) => /PageGenerator\.js$/.test(file))
      .map((file) => path.join(pageGeneratorDir, file)),
  ];
  const keys = new Set();
  const patterns = [
    /data-i18n(?:-placeholder|-title|-aria-label)?=["']([^"']+)["']/g,
    /\b(?:tConfig|translate|tr|tt)\(\s*["'`]([^"'`]+)["'`]/g,
    /\bt\(\s*["'`]([^"'`]+)["'`]/g,
  ];

  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(source))) keys.add(match[1]);
    });
  });
  return keys;
}

test('Hungarian covers every known main UI and subtitle-menu message without English fallback', () => {
  const englishBase = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'en.json'), 'utf8')).messages;
  const englishFragment = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'locales', 'fragments', 'en-ui.json'), 'utf8')
  ).messages;
  const english = mergeMessages(englishBase, expandDottedMessages(englishFragment));
  const hungarian = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'hu.json'), 'utf8')).messages;
  const fragment = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'locales', 'fragments', 'hu-ui.json'), 'utf8')
  ).messages;
  const localized = flattenMessages(mergeMessages(hungarian, expandDottedMessages(fragment)));
  const englishKeys = flattenMessages(english);
  const required = collectHungarianUiKeys();

  Object.keys(englishKeys)
    .filter((key) => key.startsWith('subtitleMenu.'))
    .forEach((key) => required.add(key));
  Object.keys(fragment)
    .filter((key) => key.startsWith('subtitleMenu.'))
    .forEach((key) => required.add(key));

  const missing = [...required]
    .filter((key) => !key.includes('${'))
    .filter((key) => !key.endsWith('.'))
    .filter((key) => !Object.hasOwn(localized, key))
    .sort();

  assert.deepEqual(missing, []);

  const technicalOrBrandValues = new Set([
    'config.heroTitle',
    'config.opensubs.title',
    'config.otherApiKeys.cloudflare.placeholder',
    'config.providerAdvanced.labels.topP',
    'config.providers.subdl.linkLabel',
    'config.providers.subdl.title',
    'config.providers.subsource.linkLabel',
    'config.providers.subsource.title',
    'config.providers.subsro.linkLabel',
    'config.providers.subsro.title',
    'config.providers.wyzie.linkLabel',
    'config.providers.wyzie.title',
    'config.providersUi.main.defaultGemini',
    'config.providersUi.placeholders.cfworkers',
    'config.quickSetup.step2.wyzieName',
    'config.quickSetup.step3.defaultModelValue',
    'config.quickSetup.step3.required',
    'fileUpload.queue.meta.target',
    'statistics.cache.smdb',
    'subtitleMenu.meta.hash',
    'sync.badges.hash',
    'toolbox.autoSubs.badges.hash',
    'toolbox.autoSubs.steps.modeAssembly',
    'toolbox.autoSubs.steps.modelTurbo',
    'toolbox.autoSubs.steps.modeRemote',
    'toolbox.downloads.unitB',
    'toolbox.studio.fileMeta',
  ]);
  const untranslated = [...required]
    .filter((key) => !key.endsWith('.'))
    .filter((key) => !technicalOrBrandValues.has(key))
    .filter((key) => typeof englishKeys[key] === 'string' && englishKeys[key].trim())
    .filter((key) => localized[key] === englishKeys[key])
    .sort();

  assert.deepEqual(untranslated, []);
});
