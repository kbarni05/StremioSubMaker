'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSearchText, tokenizeQuery, matchesSearchText } = require('./config-search');

test('settings search is accent and case insensitive', () => {
  assert.equal(normalizeSearchText('Szolgáltatói BEÁLLÍTÁSOK'), 'szolgaltatoi beallitasok');
  assert.equal(matchesSearchText('Gemini szolgáltatói beállítások', 'GEMINI beallitas'), true);
});

test('all search tokens must match and duplicates are removed', () => {
  assert.deepEqual(tokenizeQuery('mobil mobil timeout'), ['mobil', 'timeout']);
  assert.equal(matchesSearchText('Mobil mód teljes várakozás', 'mobil varakozas'), true);
  assert.equal(matchesSearchText('Mobil mód teljes várakozás', 'mobil redis'), false);
});
