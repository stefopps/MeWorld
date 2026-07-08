import { STORAGE } from './storageKeys.js';

function normalizeCaseId(caseId) {
  const raw = String(caseId ?? '').trim();
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE.caseStoryOverrides);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE.caseStoryOverrides, JSON.stringify(map));
  } catch {
    /* storage full */
  }
}

export function readCaseStoryOverride(caseId) {
  const cid = normalizeCaseId(caseId);
  if (!cid) return null;
  const row = readMap()[cid];
  return row && typeof row === 'object' ? row : null;
}

export function writeCaseStoryOverride(caseId, override) {
  const cid = normalizeCaseId(caseId);
  if (!cid || !override) return;
  const map = readMap();
  map[cid] = {
    ...override,
    updatedAt: new Date().toISOString(),
  };
  writeMap(map);
}

export function clearCaseStoryOverride(caseId) {
  const cid = normalizeCaseId(caseId);
  if (!cid) return;
  const map = readMap();
  delete map[cid];
  writeMap(map);
}

/** Apply Steve's saved title / synopsis / chapters / twist on top of API or offline story. */
export function mergeCaseStoryWithOverride(story, caseId) {
  if (!story) return story;
  const override = readCaseStoryOverride(caseId);
  if (!override) return story;

  const baseChapters = story.chapters || [];
  const chapters = Array.isArray(override.chapters) && override.chapters.length
    ? override.chapters.map((c, i) => {
        const base = baseChapters.find((b) => b.id === c.id) || baseChapters[i] || {};
        return {
          id: String(c.id || `c${i + 1}`),
          heading: String(c.heading || 'Chapter').trim(),
          body: String(c.body || '').trim(),
          visualHint: String(c.visualHint || base.visualHint || '').trim(),
        };
      })
    : [...baseChapters];

  const twist = String(override.twist || '').trim();
  if (twist && !chapters.some((c) => c.id === 'twist')) {
    chapters.push({
      id: 'twist',
      heading: String(override.twistHeading || 'Your twist').trim(),
      body: twist,
    });
  }

  return {
    ...story,
    title: String(override.title || story.title || '').trim() || story.title,
    synopsis: String(override.synopsis ?? story.synopsis ?? '').trim(),
    chapters,
    hasOverride: true,
  };
}
