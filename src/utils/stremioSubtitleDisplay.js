const { toISO6391 } = require('./languages');

const LANGUAGE_TAG_ALIASES = Object.freeze({
  pob: 'pt-BR',
  ptbr: 'pt-BR',
  ptp: 'pt-PT',
  ptpt: 'pt-PT',
  spn: 'es-419',
  es419: 'es-419',
  zhs: 'zh-Hans',
  zht: 'zh-Hant',
});

function sanitizeStremioLabel(value, maxLength = 96) {
  const compact = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = Array.from(compact);
  if (chars.length <= maxLength) return compact;
  return `${chars.slice(0, Math.max(1, maxLength - 1)).join('').trimEnd()}…`;
}

function normalizeDisplayLanguageTag(code) {
  const raw = String(code || '').trim().replace(/_/g, '-');
  if (!raw) return '';
  const compact = raw.toLowerCase().replace(/-/g, '');
  if (LANGUAGE_TAG_ALIASES[compact]) return LANGUAGE_TAG_ALIASES[compact];
  if (/^[a-z]{2}(?:-[a-z0-9]{2,4})?$/i.test(raw)) return raw;
  const iso1 = toISO6391(raw);
  return iso1 || raw;
}

function getLocalizedLanguageName(code, uiLanguage = 'en', fallback = '') {
  const tag = normalizeDisplayLanguageTag(code);
  if (!tag) return sanitizeStremioLabel(fallback || code);
  try {
    const displayNames = new Intl.DisplayNames([uiLanguage || 'en', 'en'], { type: 'language' });
    const localized = displayNames.of(tag);
    if (localized && localized.toLowerCase() !== tag.toLowerCase()) {
      return sanitizeStremioLabel(localized);
    }
  } catch (_) {
    // Older ICU builds or uncommon custom language codes fall back safely.
  }
  return sanitizeStremioLabel(fallback || code || tag);
}

function buildStremioActionLabel({ kind = 'translate', language, sourceCode, index, total, t }) {
  const safeLanguage = sanitizeStremioLabel(language || '');
  const safeSource = sanitizeStremioLabel(String(sourceCode || '').toUpperCase(), 16);
  const safeIndex = Math.max(1, Number.parseInt(index, 10) || 1);
  const safeTotal = Math.max(safeIndex, Number.parseInt(total, 10) || safeIndex);
  const key = kind === 'learn' ? 'subtitleMenu.stremio.learnEntry' : 'subtitleMenu.stremio.makeEntry';
  const fallback = kind === 'learn'
    ? `◇ Learn ${safeLanguage} · ${safeIndex}/${safeTotal} · ${safeSource}`
    : `▶ Make ${safeLanguage} · ${safeIndex}/${safeTotal} · ${safeSource}`;
  const translated = typeof t === 'function'
    ? t(key, { language: safeLanguage, source: safeSource, index: safeIndex, total: safeTotal }, fallback)
    : fallback;
  return sanitizeStremioLabel(translated);
}

function buildCachedSubtitleLabel(service, language) {
  return sanitizeStremioLabel(`${service} ✓ ${language}`);
}

function buildStremioNoticeLabel(kind, t) {
  const definitions = {
    error: ['subtitleMenu.stremio.configError', '! SubMaker error'],
    warning: ['subtitleMenu.stremio.configWarning', '⚠ SubMaker notice'],
    toolbox: ['subtitleMenu.stremio.toolbox', '🧰 Sub Toolbox'],
  };
  const [key, fallback] = definitions[kind] || definitions.warning;
  return sanitizeStremioLabel(typeof t === 'function' ? t(key, {}, fallback) : fallback);
}

module.exports = {
  buildCachedSubtitleLabel,
  buildStremioActionLabel,
  buildStremioNoticeLabel,
  getLocalizedLanguageName,
  normalizeDisplayLanguageTag,
  sanitizeStremioLabel,
};
