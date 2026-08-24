const test = require('node:test');
const assert = require('node:assert/strict');

const {
  inferForcedFromName,
  isForcedSubtitle,
  getSubtitleTrackMetadata
} = require('./subtitleFlags');

test('forced and foreign-parts tracks are identified from flags and common names', () => {
  assert.equal(isForcedSubtitle({ foreign_parts_only: true }), true);
  assert.equal(isForcedSubtitle({ foreignParts: 'yes' }), true);
  assert.equal(inferForcedFromName('Movie.2026.English.Forced.srt'), true);
  assert.equal(inferForcedFromName('Foreign Parts Only'), true);
  assert.equal(inferForcedFromName('Signs & Songs [ENG]'), true);
  assert.equal(inferForcedFromName('English Full subtitles'), false);
});

test('subtitle JSON metadata distinguishes forced, SDH and full tracks', () => {
  assert.deepEqual(getSubtitleTrackMetadata({ name: 'English Forced' }), {
    forced: true,
    foreignPartsOnly: true,
    hearingImpaired: false,
    trackType: 'forced'
  });
  assert.equal(getSubtitleTrackMetadata({ name: 'English SDH' }).trackType, 'sdh');
  assert.equal(getSubtitleTrackMetadata({ name: 'English Full' }).trackType, 'full');
});
