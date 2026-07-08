import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

export function orderCacheKey(orderId, occurrence = 0) {
  const key = String(orderId || '').trim();
  const occ = Number.isFinite(Number(occurrence)) ? Number(occurrence) : 0;
  return occ > 0 ? `${key}::occ::${occ}` : key;
}

export function orderResultCachePath(cacheDir, caseId) {
  const num = String(caseId || '').replace(/^case_/i, '').trim();
  return path.join(cacheDir, `case_${num}.json`);
}

function normalizeCaseFile(caseId) {
  const num = String(caseId || '').replace(/^case_/i, '').trim();
  return num ? `case_${num}` : null;
}

/** @returns {Record<string, { practice?: object, teach?: object }> | null} */
export async function readOrderResultCache(cacheDir, caseId) {
  const file = orderResultCachePath(cacheDir, caseId);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(await fsp.readFile(file, 'utf8'));
    return raw?.entries && typeof raw.entries === 'object' ? raw.entries : null;
  } catch {
    return null;
  }
}

export async function readOrderResultEntry(
  cacheDir,
  caseId,
  orderId,
  teachMeMode = false,
  occurrence = 0,
) {
  const entries = await readOrderResultCache(cacheDir, caseId);
  const key = orderCacheKey(orderId, occurrence);
  if (!entries || !key) return null;
  const slot = teachMeMode ? 'teach' : 'practice';
  const row = entries[key]?.[slot];
  if (!row?.text) return null;
  return row;
}

export async function writeOrderResultEntry(
  cacheDir,
  caseId,
  orderId,
  teachMeMode,
  { text, kind = 'order', kindLabel = 'Result', promptVersion = 1, orderLabel = '' },
  occurrence = 0,
) {
  const slug = normalizeCaseFile(caseId);
  const key = orderCacheKey(orderId, occurrence);
  const slot = teachMeMode ? 'teach' : 'practice';
  if (!slug || !key || !text) return null;

  await fsp.mkdir(cacheDir, { recursive: true });
  const file = orderResultCachePath(cacheDir, caseId);
  let doc = { caseId: slug, entries: {} };
  if (fs.existsSync(file)) {
    try {
      const existing = JSON.parse(await fsp.readFile(file, 'utf8'));
      if (existing?.entries && typeof existing.entries === 'object') {
        doc = existing;
      }
    } catch {
      /* overwrite corrupt file */
    }
  }

  if (!doc.entries[key]) doc.entries[key] = {};
  doc.entries[key][slot] = {
    text: String(text).trim(),
    kind: String(kind || 'order'),
    kindLabel: String(kindLabel || 'Result'),
    orderLabel: String(orderLabel || '').trim() || doc.entries[key][slot]?.orderLabel || '',
    promptVersion,
    cachedAt: new Date().toISOString(),
  };
  doc.updatedAt = new Date().toISOString();
  await fsp.writeFile(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return doc.entries[key][slot];
}
