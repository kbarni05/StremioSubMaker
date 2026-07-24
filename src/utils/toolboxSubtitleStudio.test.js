const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { generateSubToolboxPage } = require('./toolboxPageGenerator');

function renderToolbox(uiLanguage = 'en') {
  return generateSubToolboxPage('test-config', 'tt1234567:1:2', 'Example.S01E02.mkv', {
    uiLanguage,
    sourceLanguages: ['eng'],
    targetLanguages: ['hun'],
  });
}

test('Toolbox renders all five Subtitle Studio tools and the local processor', () => {
  const html = renderToolbox();
  assert.match(html, /id="subtitleStudio"/);
  assert.match(html, /data-studio-action="repair"/);
  assert.match(html, /data-studio-action="shift"/);
  assert.match(html, /data-studio-action="fps"/);
  assert.match(html, /data-studio-action="wrap"/);
  assert.match(html, /data-studio-action="replace"/);
  assert.match(html, /\/js\/subtitle-studio\.js/);
  assert.equal(html.includes('\u0000'), false);
});

test('generated Toolbox inline scripts remain syntactically valid', () => {
  const html = renderToolbox('hu');
  assert.match(html, /Források <span>angol<\/span>/);
  assert.match(html, /Célok <span>magyar<\/span>/);
  assert.match(html, /SRT-fájlok fordítása/);
  assert.match(html, /Az eszköztár az aktuális munkamenethez/);
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(Boolean);

  assert.ok(inlineScripts.length >= 2);
  inlineScripts.forEach((source, index) => {
    assert.doesNotThrow(
      () => new vm.Script(source, { filename: `toolbox-inline-${index}.js` }),
      `inline script ${index} should parse`
    );
  });
});
