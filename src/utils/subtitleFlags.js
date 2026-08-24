function isTrueishFlag(value) {
  if (value === true) return true;
  if (value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }
  return false;
}

function isHearingImpairedSubtitle(sub) {
  if (!sub) return false;
  return (
    isTrueishFlag(sub.hearing_impaired) ||
    isTrueishFlag(sub.hearingImpaired) ||
    isTrueishFlag(sub.hi)
  );
}

function inferHearingImpairedFromName(name) {
  if (!name) return false;
  const s = String(name).toLowerCase();
  if (/(^|[\s._\-\[(])sdh($|[\s._\-\])])/.test(s)) return true;
  if (/hearing[\s._-]*impaired/.test(s)) return true;
  if (/closed[\s._-]*captions/.test(s)) return true;
  if (/(^|[\s._\-\[(])cc($|[\s._\-\])])/.test(s)) return true;
  return false;
}

function inferForcedFromName(name) {
  if (!name) return false;
  const s = String(name).toLowerCase();
  return (
    /(^|[\s._\-\[(])forced($|[\s._\-\])])/.test(s) ||
    /foreign[\s._-]*parts?/.test(s) ||
    /signs?[\s._&+-]*(and|&)?[\s._&+-]*songs?/.test(s)
  );
}

function isForcedSubtitle(sub) {
  if (!sub) return false;
  return (
    isTrueishFlag(sub.forced) ||
    isTrueishFlag(sub.isForced) ||
    isTrueishFlag(sub.foreign_parts_only) ||
    isTrueishFlag(sub.foreignPartsOnly) ||
    isTrueishFlag(sub.foreignParts) ||
    inferForcedFromName(sub.name || sub.fileName || sub.filename || sub.release)
  );
}

function getSubtitleTrackMetadata(sub) {
  const forced = isForcedSubtitle(sub);
  const hearingImpaired = isHearingImpairedSubtitle(sub)
    || inferHearingImpairedFromName(sub?.name || sub?.fileName || sub?.filename || sub?.release);
  return {
    forced,
    foreignPartsOnly: forced,
    hearingImpaired,
    trackType: forced ? 'forced' : (hearingImpaired ? 'sdh' : 'full')
  };
}

module.exports = {
  isTrueishFlag,
  isHearingImpairedSubtitle,
  inferHearingImpairedFromName,
  inferForcedFromName,
  isForcedSubtitle,
  getSubtitleTrackMetadata
};
