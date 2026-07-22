const test = require('node:test');
const assert = require('node:assert/strict');

const smdbCache = require('./smdbCache');

function createAdapter(initialEntries = {}) {
  const entries = new Map(Object.entries(initialEntries));
  return {
    entries,
    async get(key) {
      return entries.get(key) ?? null;
    },
    async set(key, value) {
      entries.set(key, value);
      return true;
    },
    async delete(key) {
      return entries.delete(key);
    },
    async exists(key) {
      return entries.has(key);
    }
  };
}

test('SMDB index keeps the newest language when the index is full', async t => {
  const max = smdbCache.__testing.MAX_LANGUAGES_PER_VIDEO;
  const oldEntries = Array.from({ length: max }, (_, index) => ({
    languageCode: `lang-${index}`,
    timestamp: index + 1,
    uploaderHash: 'old'
  }));
  const adapter = createAdapter({
    __index_smdb__video: { version: 1, entries: oldEntries }
  });
  smdbCache.__testing.setStorageAdapter(adapter);
  t.after(() => smdbCache.__testing.reset());

  const result = await smdbCache.saveSubtitle('video', 'new-language', '1\n00:00:00,000 --> 00:00:01,000\nHello', 'uploader');
  const index = adapter.entries.get('__index_smdb__video');

  assert.equal(result.success, true);
  assert.equal(index.entries.length, max);
  assert.equal(index.entries[0].languageCode, 'new-language');
  assert.equal(index.entries.some(entry => entry.languageCode === 'lang-0'), false);
});

test('multi-hash subtitle lookup runs in parallel while preserving hash priority', async t => {
  let active = 0;
  let maxActive = 0;
  const adapter = createAdapter();
  adapter.get = async key => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    try {
      const isFirst = key.includes('smdb:first:');
      await new Promise(resolve => setTimeout(resolve, isFirst ? 35 : 5));
      return {
        content: isFirst ? 'preferred' : 'fallback',
        languageCode: 'eng',
        uploaderHash: 'uploader',
        timestamp: 1
      };
    } finally {
      active -= 1;
    }
  };
  smdbCache.__testing.setStorageAdapter(adapter);
  t.after(() => smdbCache.__testing.reset());

  const result = await smdbCache.getSubtitleMultiHash(['first', 'second'], 'eng');

  assert.equal(maxActive, 2);
  assert.equal(result.videoHash, 'first');
  assert.equal(result.content, 'preferred');
});
