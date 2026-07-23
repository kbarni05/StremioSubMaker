const fs = require('fs');
const path = require('path');

// Simple in-memory cache to avoid re-reading locale files
const localeCache = new Map();
const DEFAULT_LANG = 'en';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeMessages(base, override) {
  const result = isPlainObject(base) ? { ...base } : {};
  if (!isPlainObject(override)) return result;

  Object.entries(override).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = mergeMessages(result[key], value);
    } else {
      result[key] = value;
    }
  });
  return result;
}

function expandDottedMessages(input) {
  const expanded = {};
  if (!isPlainObject(input)) return expanded;

  Object.entries(input).forEach(([key, value]) => {
    const parts = String(key).split('.').filter(Boolean);
    if (parts.length === 0) return;
    let current = expanded;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = value;
      } else {
        if (!isPlainObject(current[part])) current[part] = {};
        current = current[part];
      }
    });
  });
  return expanded;
}

function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  Object.getOwnPropertyNames(obj).forEach((key) => {
    const value = obj[key];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}

/**
 * Load locale messages from the locales folder.
 * Falls back to English when the requested locale is missing or invalid.
 * @param {string} lang - language code (e.g., en, es, fr)
 * @returns {{ lang: string, messages: Object }}
 */
function loadLocale(lang) {
  const normalized = (lang || DEFAULT_LANG)
    .toString()
    .trim()
    .toLowerCase()
    .replace(/_/g, '-') || DEFAULT_LANG;
  // Allow alphanumeric BCP-47 tags with dashes (reject anything else to keep paths safe)
  const safeLang = /^[a-z0-9-]+$/i.test(normalized) ? normalized : DEFAULT_LANG;

  if (localeCache.has(safeLang)) {
    return localeCache.get(safeLang);
  }

  const localesDir = path.join(__dirname, '..', '..', 'locales');
  const readLocale = (code) => {
    const filePath = path.join(localesDir, `${code}.json`);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  };
  const readFragment = (code) => {
    const filePath = path.join(localesDir, 'fragments', `${code}-ui.json`);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const fragment = JSON.parse(raw);
      return expandDottedMessages(fragment.messages || fragment);
    } catch (_) {
      return {};
    }
  };

  const baseLang = safeLang.split('-')[0];
  const english = readLocale(DEFAULT_LANG) || {};
  const localized =
    readLocale(safeLang) ||
    (baseLang !== safeLang ? readLocale(baseLang) : null) ||
    (safeLang === 'pt-pt' ? readLocale('pt-br') : null) ||
    english;
  const fragment = mergeMessages(
    baseLang !== safeLang ? readFragment(baseLang) : {},
    readFragment(safeLang)
  );
  const localizedMessages = mergeMessages(localized.messages || {}, fragment);
  const messages = safeLang === DEFAULT_LANG
    ? mergeMessages(english.messages || {}, fragment)
    : mergeMessages(english.messages || {}, localizedMessages);
  const payload = { lang: localized.lang || safeLang, messages };

  // Freeze to prevent accidental cross-request mutation of cached locale objects
  const frozen = deepFreeze(payload);
  localeCache.set(safeLang, frozen);
  return frozen;
}

/**
 * Return a translator function bound to a language.
 * @param {string} lang
 * @returns {(key: string, vars?: Object, fallback?: string) => string}
 */
function getTranslator(lang) {
  const { messages } = loadLocale(lang);
  const enMessages = loadLocale(DEFAULT_LANG).messages || {};

  const interpolate = (tpl, vars = {}) => {
    if (!tpl || typeof tpl !== 'string') return tpl;
    return tpl.replace(/\{(\w+)\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match;
    }).replace(/\\n/g, '\n');
  };

  return function t(key, vars = {}, fallback = '') {
    if (!key) return typeof fallback === 'string' && fallback ? fallback : key;

    const lookup = (table) => {
      const parts = key.split('.');
      let current = table;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          return null;
        }
      }
      return typeof current === 'string' ? current : null;
    };

    const value = lookup(messages) || lookup(enMessages) || fallback || key;
    return interpolate(value, vars);
  };
}

/**
 * Build a browser bootstrap script that installs window.__LOCALE__ and window.t
 * @param {Object} localePayload - { lang, messages }
 * @returns {string}
 */
function buildClientBootstrap(localePayload) {
  const safePayload = localePayload || loadLocale(DEFAULT_LANG);
  const json = JSON.stringify(safePayload);
  return `
    <script>
      (function() {
        try {
          window.__LOCALE__ = ${json};
          var missingKeys = new Set();
          var hasOwn = Object.prototype.hasOwnProperty;
          function logMissing(key) {
            try {
              if (!key || missingKeys.has(key)) return;
              if (missingKeys.size > 250) return; // cap noise
              missingKeys.add(key);
              console.warn('[i18n] Missing locale key:', key);
            } catch (_) {}
          }
          window.t = function(key, vars, fallback) {
            vars = vars || {};
            if (!key) return fallback || key;
            var parts = String(key).split('.');
            var current = (window.__LOCALE__ && window.__LOCALE__.messages) || {};
            for (var i = 0; i < parts.length; i++) {
              if (current && hasOwn.call(current, parts[i])) {
                current = current[parts[i]];
              } else {
                current = null;
                break;
              }
            }
            var direct = window.__LOCALE__ && window.__LOCALE__.messages && window.__LOCALE__.messages[key];
            var template = (typeof current === 'string' && current) ||
              (typeof direct === 'string' && direct) ||
              fallback || key;
            if ((!current && !direct) && !fallback) {
              logMissing(key);
            }
            return String(template).replace(/\\{(\\w+)\\}/g, function(match, k) {
              return hasOwn.call(vars, k) ? vars[k] : match;
            }).replace(/\\\\n/g, '\\n');
          };
          if (document && document.documentElement) {
            document.documentElement.lang = window.__LOCALE__.lang || 'en';
          }
        } catch (_) {}
      })();
    </script>
  `;
}

module.exports = {
  loadLocale,
  getTranslator,
  buildClientBootstrap,
  mergeMessages,
  expandDottedMessages,
  DEFAULT_LANG,
};
