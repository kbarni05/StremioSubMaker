'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const iconv = require('iconv-lite');
const { detectAndConvertEncoding } = require('./encodingDetector');

test('decodes Windows-1250 Serbian Latin subtitles with a script hint', () => {
  const subtitle = '1\r\n00:00:01,000 --> 00:00:03,000\r\nČovek kaže: Šta radiš? Đak, ćup i žaba.\r\n';
  const encoded = iconv.encode(subtitle, 'windows-1250');
  assert.equal(detectAndConvertEncoding(encoded, 'fixture', 'sr-Latn'), subtitle);
});

test('decodes Windows-1251 Serbian Cyrillic subtitles with a script hint', () => {
  const subtitle = '1\r\n00:00:01,000 --> 00:00:03,000\r\nЧовек каже: Шта радиш? Ђак и жаба.\r\n';
  const encoded = iconv.encode(subtitle, 'windows-1251');
  assert.equal(detectAndConvertEncoding(encoded, 'fixture', 'sr-Cyrl'), subtitle);
});

test('accepts both Serbian scripts for an ambiguous base-language hint', () => {
  const latin = '1\n00:00:01,000 --> 00:00:03,000\nČovek kaže: Šta radiš? Đak, ćup i žaba.\n';
  const cyrillic = '1\n00:00:01,000 --> 00:00:03,000\nЧовек каже: Шта радиш? Ђак и жаба.\n';
  assert.equal(detectAndConvertEncoding(iconv.encode(latin, 'windows-1250'), 'fixture', 'sr'), latin);
  assert.equal(detectAndConvertEncoding(iconv.encode(cyrillic, 'windows-1251'), 'fixture', 'sr'), cyrillic);
});
