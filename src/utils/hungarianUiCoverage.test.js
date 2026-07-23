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

function collectPublicUiKeys() {
  const publicDir = path.join(ROOT, 'public');
  const files = fs.readdirSync(publicDir, { recursive: true })
    .filter((file) => /\.(?:html|js)$/.test(file));
  const keys = new Set();
  const patterns = [
    /data-i18n(?:-placeholder|-title|-aria-label)?=["']([^"']+)["']/g,
    /(?:tConfig|translate)\(\s*["'`]([^"'`]+)["'`]/g,
  ];

  files.forEach((file) => {
    const source = fs.readFileSync(path.join(publicDir, file), 'utf8');
    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(source))) keys.add(match[1]);
    });
  });
  return keys;
}

test('Hungarian covers every known main UI and subtitle-menu message without English fallback', () => {
  const english = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'en.json'), 'utf8')).messages;
  const hungarian = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'hu.json'), 'utf8')).messages;
  const fragment = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'locales', 'fragments', 'hu-ui.json'), 'utf8')
  ).messages;
  const localized = flattenMessages(mergeMessages(hungarian, expandDottedMessages(fragment)));
  const englishKeys = flattenMessages(english);
  const required = collectPublicUiKeys();

  Object.keys(englishKeys)
    .filter((key) => key.startsWith('subtitleMenu.'))
    .forEach((key) => required.add(key));
  Object.keys(fragment)
    .filter((key) => key.startsWith('subtitleMenu.'))
    .forEach((key) => required.add(key));

  const missing = [...required]
    .filter((key) => !key.includes('${'))
    .filter((key) => Object.hasOwn(englishKeys, key) || key.startsWith('subtitleMenu.'))
    .filter((key) => !Object.hasOwn(localized, key))
    .sort();

  assert.deepEqual(missing, []);
});
