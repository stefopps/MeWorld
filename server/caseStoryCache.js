import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

function normalizeCaseFile(caseId) {
  const num = String(caseId || '').replace(/^case_/i, '').trim();
  return num ? `case_${num.padStart(3, '0')}` : null;
}

export function caseStoryCachePath(cacheDir, caseId) {
  const slug = normalizeCaseFile(caseId);
  return slug ? path.join(cacheDir, `${slug}.json`) : null;
}

export function caseStoryImagePath(cacheDir, caseId) {
  const slug = normalizeCaseFile(caseId);
  return slug ? path.join(cacheDir, `${slug}-master.png`) : null;
}

/** Beat id for the prose oversight hero — explicit cache field or last story chapter. */
export function resolveCaseStoryOversightBeatId(narrative = {}) {
  const explicit = String(narrative?.oversightBeatId || '').trim();
  if (explicit) return explicit;
  const chapters = (narrative?.chapters || []).filter((c) => c?.id && c.id !== 'twist');
  if (!chapters.length) return null;
  return String(chapters[chapters.length - 1].id).trim() || null;
}

/**
 * Shipped oversight still for Case Story prose — prefers final beat PNG (e.g. c5) over master.
 */
export function resolveCaseStoryOversightImagePath(cacheDir, caseId, narrative = {}) {
  const beatId = resolveCaseStoryOversightBeatId(narrative);
  if (beatId) {
    const beatPath = resolveCaseStoryBeatImagePath(cacheDir, caseId, beatId);
    if (beatPath && fs.existsSync(beatPath)) {
      return { path: beatPath, source: 'beat', beatId };
    }
  }
  const masterPath = caseStoryImagePath(cacheDir, caseId);
  if (masterPath && fs.existsSync(masterPath)) {
    return { path: masterPath, source: 'master', beatId: null };
  }
  return { path: null, source: null, beatId: null };
}

export function buildCaseStoryOversightImageUrl(cacheDir, caseId, narrative, origin) {
  const ref = resolveCaseStoryOversightImagePath(cacheDir, caseId, narrative);
  if (!ref.path) return null;
  const base = String(origin || '').replace(/\/$/, '');
  return {
    url: `${base}/case-story-images/${path.basename(ref.path)}`,
    source: ref.source,
    beatId: ref.beatId,
    file: path.basename(ref.path),
  };
}

/** One 2×3 composite storyboard plate (all beats in a single Magnific render). */
export function caseStoryGridImagePath(cacheDir, caseId) {
  const slug = normalizeCaseFile(caseId);
  return slug ? path.join(cacheDir, `${slug}-grid-2x3.png`) : null;
}

export function caseStoryBeatImagePath(cacheDir, caseId, beatId, { variant } = {}) {
  const slug = normalizeCaseFile(caseId);
  const bid = String(beatId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  if (!slug || !bid) return null;
  const variantSuffix = variant ? `-${String(variant).replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
  return path.join(cacheDir, `${slug}-beat-${bid}${variantSuffix}.png`);
}

export function caseStoryBeatImageSlug(caseId, beatId) {
  const file = caseStoryBeatImagePath('/tmp', caseId, beatId);
  return file ? path.basename(file) : null;
}

/**
 * Prefer highest `-vN` variant over canonical beat PNG (Steve approval workflow).
 * e.g. case_051-beat-c3-v3.png wins over case_051-beat-c3.png
 */
export function resolveCaseStoryBeatImagePath(cacheDir, caseId, beatId) {
  const canonical = caseStoryBeatImagePath(cacheDir, caseId, beatId);
  if (!canonical || !cacheDir) return canonical;
  const slug = normalizeCaseFile(caseId);
  const bid = String(beatId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  if (!slug || !bid) return canonical;

  let bestPath = fs.existsSync(canonical) ? canonical : null;
  let bestScore = bestPath ? 0 : -1;

  let entries = [];
  try {
    entries = fs.readdirSync(cacheDir);
  } catch {
    return canonical;
  }

  const prefix = `${slug}-beat-${bid}`;
  for (const name of entries) {
    if (!name.startsWith(prefix) || !name.endsWith('.png')) continue;
    const rest = name.slice(prefix.length, -4);
    let score = 0;
    if (rest === '') {
      score = 0;
    } else if (rest.startsWith('-')) {
      const tag = rest.slice(1);
      const vMatch = /^v(\d+)$/.exec(tag);
      if (vMatch) {
        score = parseInt(vMatch[1], 10);
      } else {
        score = 1;
      }
    } else {
      continue;
    }
    if (score > bestScore) {
      bestScore = score;
      bestPath = path.join(cacheDir, name);
    }
  }

  return bestPath || canonical;
}

export async function readCaseStoryCache(cacheDir, caseId, { promptVersion } = {}) {
  const file = caseStoryCachePath(cacheDir, caseId);
  if (!file || !fs.existsSync(file)) return null;
  try {
    const doc = JSON.parse(await fsp.readFile(file, 'utf8'));
    if (
      promptVersion != null
      && doc?.promptVersion != null
      && doc.promptVersion !== promptVersion
    ) {
      return null;
    }
    return doc;
  } catch {
    return null;
  }
}

export async function writeCaseStoryCache(cacheDir, caseId, payload, { promptVersion } = {}) {
  const slug = normalizeCaseFile(caseId);
  if (!slug || !payload) return null;
  await fsp.mkdir(cacheDir, { recursive: true });
  const file = caseStoryCachePath(cacheDir, slug);
  const doc = {
    caseId: slug,
    ...payload,
    ...(promptVersion != null ? { promptVersion } : {}),
    cachedAt: new Date().toISOString(),
  };
  await fsp.writeFile(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return doc;
}
