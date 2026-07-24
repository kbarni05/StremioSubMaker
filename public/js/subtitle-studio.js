(function subtitleStudioModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SubtitleStudio = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSubtitleStudio() {
  'use strict';

  const TIMESTAMP_PATTERN = /^(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{1,3})\s*-->\s*(\d{1,3}):([0-5]\d):([0-5]\d)[,.](\d{1,3})(?:\s+.*)?$/;
  const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;
  const DEFAULT_MAX_TEXT_CHARS = 5 * 1024 * 1024;

  function normalizeInput(value) {
    return String(value == null ? '' : value)
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .trim();
  }

  function timestampPartsToMs(hours, minutes, seconds, milliseconds) {
    const msText = String(milliseconds || '').padEnd(3, '0').slice(0, 3);
    return (
      (Number(hours) * 60 * 60 * 1000) +
      (Number(minutes) * 60 * 1000) +
      (Number(seconds) * 1000) +
      Number(msText)
    );
  }

  function parseTimestampLine(line) {
    const match = String(line || '').trim().match(TIMESTAMP_PATTERN);
    if (!match) return null;
    return {
      startMs: timestampPartsToMs(match[1], match[2], match[3], match[4]),
      endMs: timestampPartsToMs(match[5], match[6], match[7], match[8]),
    };
  }

  function formatTimestamp(milliseconds) {
    const safe = Math.max(0, Math.round(Number(milliseconds) || 0));
    const hours = Math.floor(safe / 3600000);
    const minutes = Math.floor((safe % 3600000) / 60000);
    const seconds = Math.floor((safe % 60000) / 1000);
    const millis = safe % 1000;
    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0'),
    ].join(':') + ',' + String(millis).padStart(3, '0');
  }

  function parseSrt(value) {
    const normalized = normalizeInput(value);
    if (!normalized) return { cues: [], invalidBlocks: [], normalized: '' };

    const blocks = normalized.split(/\n{2,}/);
    const cues = [];
    const invalidBlocks = [];

    blocks.forEach((block, blockIndex) => {
      const lines = block.split('\n');
      const timestampIndex = lines.findIndex(line => TIMESTAMP_PATTERN.test(String(line || '').trim()));
      if (timestampIndex < 0) {
        invalidBlocks.push({ block: blockIndex + 1, reason: 'missing-timestamp', text: block });
        return;
      }

      const times = parseTimestampLine(lines[timestampIndex]);
      if (!times) {
        invalidBlocks.push({ block: blockIndex + 1, reason: 'invalid-timestamp', text: block });
        return;
      }

      const rawIndex = timestampIndex > 0 ? Number.parseInt(lines[0], 10) : NaN;
      const text = lines.slice(timestampIndex + 1).join('\n').trim();
      cues.push({
        originalIndex: Number.isFinite(rawIndex) ? rawIndex : blockIndex + 1,
        sourceOrder: blockIndex,
        startMs: times.startMs,
        endMs: times.endMs,
        text,
      });
    });

    return { cues, invalidBlocks, normalized };
  }

  function serializeSrt(cues, options) {
    const preserveIndices = options && options.preserveIndices === true;
    return (Array.isArray(cues) ? cues : []).map((cue, index) => (
      `${preserveIndices ? cue.originalIndex : index + 1}\n${formatTimestamp(cue.startMs)} --> ${formatTimestamp(cue.endMs)}\n${String(cue.text || '').trim()}`
    )).join('\n\n').trim();
  }

  function visibleLength(text) {
    return Array.from(String(text || '').replace(/<[^>]*>/g, '')).length;
  }

  function analyzeSrt(value, options) {
    const settings = options || {};
    const maxLineLength = Math.max(10, Number(settings.maxLineLength) || 42);
    const maxCps = Math.max(5, Number(settings.maxCps) || 20);
    const parsed = parseSrt(value);
    let overlaps = 0;
    let reversed = 0;
    let outOfOrder = 0;
    let emptyText = 0;
    let longLines = 0;
    let highCps = 0;
    let previous = null;
    let durationMs = 0;

    parsed.cues.forEach((cue) => {
      if (cue.endMs <= cue.startMs) reversed += 1;
      if (!String(cue.text || '').trim()) emptyText += 1;
      if (previous) {
        if (cue.startMs < previous.startMs) outOfOrder += 1;
        if (cue.startMs < previous.endMs) overlaps += 1;
      }
      const cueDurationSeconds = Math.max(0.001, (cue.endMs - cue.startMs) / 1000);
      const characters = visibleLength(String(cue.text || '').replace(/\n/g, ' '));
      if ((characters / cueDurationSeconds) > maxCps) highCps += 1;
      longLines += String(cue.text || '').split('\n')
        .filter(line => visibleLength(line) > maxLineLength).length;
      durationMs = Math.max(durationMs, cue.endMs);
      previous = cue;
    });

    const issueCount = (
      parsed.invalidBlocks.length +
      overlaps +
      reversed +
      outOfOrder +
      emptyText +
      longLines +
      highCps
    );

    return {
      cueCount: parsed.cues.length,
      durationMs,
      invalidBlocks: parsed.invalidBlocks.length,
      overlaps,
      reversed,
      outOfOrder,
      emptyText,
      longLines,
      highCps,
      issueCount,
      isValid: parsed.cues.length > 0 && parsed.invalidBlocks.length === 0 && reversed === 0,
    };
  }

  function requireCues(value) {
    if (String(value == null ? '' : value).length > DEFAULT_MAX_TEXT_CHARS) {
      const error = new RangeError('Subtitle text is larger than the 5 MB browser processing limit.');
      error.code = 'TEXT_TOO_LARGE';
      throw error;
    }
    const parsed = parseSrt(value);
    if (!parsed.cues.length) {
      const error = new Error('No valid SRT cues found.');
      error.code = 'NO_VALID_CUES';
      throw error;
    }
    if (parsed.invalidBlocks.length) {
      const error = new Error(
        `${parsed.invalidBlocks.length} block(s) have no valid timestamp. Fix them manually before applying changes so no subtitle text is lost.`
      );
      error.code = 'UNRECOVERABLE_BLOCKS';
      error.invalidBlocks = parsed.invalidBlocks.length;
      throw error;
    }
    return parsed;
  }

  function repairSrt(value, options) {
    const settings = options || {};
    const minDurationMs = Math.max(50, Number(settings.minDurationMs) || 500);
    const gapMs = Math.max(0, Number(settings.gapMs) || 1);
    const fixOverlaps = settings.fixOverlaps !== false;
    const parsed = requireCues(value);
    const cues = parsed.cues
      .map(cue => ({ ...cue, text: String(cue.text || '').trim() }))
      .filter(cue => cue.text)
      .sort((a, b) => (a.startMs - b.startMs) || (a.endMs - b.endMs) || (a.sourceOrder - b.sourceOrder));

    cues.forEach((cue, index) => {
      cue.startMs = Math.max(0, Math.round(cue.startMs));
      cue.endMs = Math.max(cue.startMs + minDurationMs, Math.round(cue.endMs));
      if (!fixOverlaps || index === 0) return;

      const previous = cues[index - 1];
      if (cue.startMs >= previous.endMs + gapMs) return;
      const shortenedPreviousEnd = cue.startMs - gapMs;
      if (shortenedPreviousEnd >= previous.startMs + minDurationMs) {
        previous.endMs = shortenedPreviousEnd;
        return;
      }

      const duration = Math.max(minDurationMs, cue.endMs - cue.startMs);
      cue.startMs = previous.endMs + gapMs;
      cue.endMs = cue.startMs + duration;
    });

    if (!cues.length) {
      const error = new Error('No non-empty SRT cues found.');
      error.code = 'NO_NONEMPTY_CUES';
      throw error;
    }
    return serializeSrt(cues);
  }

  function mapTimings(value, mapper) {
    const parsed = requireCues(value);
    return serializeSrt(parsed.cues.map((cue) => {
      const originalDuration = Math.max(1, cue.endMs - cue.startMs);
      const mapped = mapper(cue);
      const startMs = Math.max(0, Math.round(mapped.startMs));
      const endMs = Math.max(startMs + 1, Math.round(mapped.endMs));
      return {
        ...cue,
        startMs,
        endMs: Number.isFinite(endMs) ? endMs : startMs + originalDuration,
      };
    }), { preserveIndices: true });
  }

  function shiftTimings(value, offsetMs) {
    const offset = Number(offsetMs);
    if (!Number.isFinite(offset)) throw new TypeError('Offset must be a finite number.');
    return mapTimings(value, cue => ({
      startMs: cue.startMs + offset,
      endMs: cue.endMs + offset,
    }));
  }

  function retimeFps(value, sourceFps, targetFps) {
    const source = Number(sourceFps);
    const target = Number(targetFps);
    if (!Number.isFinite(source) || !Number.isFinite(target) || source <= 0 || target <= 0) {
      throw new TypeError('Source and target FPS must be positive numbers.');
    }
    const scale = source / target;
    return mapTimings(value, cue => ({
      startMs: cue.startMs * scale,
      endMs: cue.endMs * scale,
    }));
  }

  function splitWords(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  }

  function rebalanceLines(words, maxLines) {
    if (!words.length) return [];
    const lineCount = Math.min(Math.max(1, maxLines), words.length);
    const lines = [];
    let cursor = 0;

    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      const remainingLines = lineCount - lineIndex;
      if (remainingLines === 1) {
        lines.push(words.slice(cursor).join(' '));
        break;
      }

      const remainingWords = words.slice(cursor);
      const remainingLength = remainingWords.reduce((sum, word) => sum + visibleLength(word), 0) +
        Math.max(0, remainingWords.length - 1);
      const targetLength = Math.ceil(remainingLength / remainingLines);
      const maxEnd = words.length - (remainingLines - 1);
      let end = cursor;
      let lineLength = 0;

      while (end < maxEnd) {
        const projected = lineLength + (end > cursor ? 1 : 0) + visibleLength(words[end]);
        if (end > cursor && projected > targetLength) break;
        lineLength = projected;
        end += 1;
      }
      if (end === cursor) end += 1;
      lines.push(words.slice(cursor, end).join(' '));
      cursor = end;
    }
    return lines;
  }

  function wrapCueText(text, maxLineLength, maxLines) {
    const words = splitWords(text);
    if (!words.length) return '';
    const maxLength = Math.max(10, Number(maxLineLength) || 42);
    const allowedLines = Math.min(4, Math.max(1, Number(maxLines) || 2));
    const greedy = [];
    let current = '';

    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (current && visibleLength(candidate) > maxLength) {
        greedy.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) greedy.push(current);
    if (greedy.length <= allowedLines) return greedy.join('\n');
    return rebalanceLines(words, allowedLines).join('\n');
  }

  function smartWrap(value, options) {
    const settings = options || {};
    const parsed = requireCues(value);
    return serializeSrt(parsed.cues.map(cue => ({
      ...cue,
      text: wrapCueText(cue.text, settings.maxLineLength, settings.maxLines),
    })), { preserveIndices: true });
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function isLikelyUnsafeRegex(pattern) {
    const source = String(pattern || '');
    return (
      /(\([^)]*(?:\+|\*)[^)]*\))(?:\+|\*|\{\d*,?\d*\})/.test(source) ||
      /(?:\.\*){2,}/.test(source) ||
      /(?:\.\+){2,}/.test(source)
    );
  }

  function searchReplace(value, find, replacement, options) {
    const query = String(find == null ? '' : find);
    if (!query) throw new TypeError('Search text cannot be empty.');
    if (query.length > 256) throw new RangeError('Search pattern is too long.');
    const settings = options || {};
    if (settings.useRegex && isLikelyUnsafeRegex(query)) {
      const error = new Error('This regular expression contains nested repetition and could freeze the browser.');
      error.code = 'UNSAFE_REGEX';
      throw error;
    }
    const flags = `g${settings.caseSensitive ? '' : 'i'}${settings.multiline ? 'm' : ''}`;
    let matcher;
    try {
      matcher = new RegExp(settings.useRegex ? query : escapeRegExp(query), flags);
    } catch (error) {
      const wrapped = new Error(`Invalid regular expression: ${error.message}`);
      wrapped.code = 'INVALID_REGEX';
      throw wrapped;
    }
    const parsed = requireCues(value);
    const literalReplacement = String(replacement == null ? '' : replacement);
    return serializeSrt(parsed.cues.map(cue => ({
      ...cue,
      text: settings.useRegex
        ? String(cue.text || '').replace(matcher, literalReplacement)
        : String(cue.text || '').replace(matcher, () => literalReplacement),
    })), { preserveIndices: true });
  }

  function assertFileSize(file, maxBytes) {
    const limit = Math.max(1024, Number(maxBytes) || DEFAULT_MAX_FILE_BYTES);
    if (file && Number(file.size) > limit) {
      const error = new RangeError(`Subtitle file is larger than ${Math.round(limit / 1024 / 1024)} MB.`);
      error.code = 'FILE_TOO_LARGE';
      throw error;
    }
    return true;
  }

  return Object.freeze({
    DEFAULT_MAX_FILE_BYTES,
    DEFAULT_MAX_TEXT_CHARS,
    analyzeSrt,
    assertFileSize,
    formatTimestamp,
    normalizeInput,
    parseSrt,
    repairSrt,
    retimeFps,
    searchReplace,
    serializeSrt,
    shiftTimings,
    smartWrap,
    wrapCueText,
  });
}));
