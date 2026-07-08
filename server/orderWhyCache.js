import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

export function orderWhyCachePath(cacheDir, caseId) {
  const num = String(caseId || '').replace(/^case_/i, '').trim();
  return path.join(cacheDir, `case_${num}.json`);
}

function normalizeCaseFile(caseId) {
  const num = String(caseId || '').replace(/^case_/i, '').trim();
  return num ? `case_${num}` : null;
}

/** Bump when attendant voice / length rules change — stale cache entries are ignored. */
export const ORDER_WHY_PROMPT_VERSION = 4;

/** @returns {Record<string, { why: string, orderLabel?: string, cachedAt: string, promptVersion?: number }> | null} */
export async function readOrderWhyCache(cacheDir, caseId) {
  const file = orderWhyCachePath(cacheDir, caseId);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(await fsp.readFile(file, 'utf8'));
    return raw?.entries && typeof raw.entries === 'object' ? raw.entries : null;
  } catch {
    return null;
  }
}

export async function readOrderWhyEntry(cacheDir, caseId, orderId) {
  const entries = await readOrderWhyCache(cacheDir, caseId);
  const key = String(orderId || '').trim();
  if (!entries || !key) return null;
  const row = entries[key];
  if (!row?.why) return null;
  if (row.promptVersion !== ORDER_WHY_PROMPT_VERSION) return null;
  return row;
}

export async function writeOrderWhyEntry(cacheDir, caseId, orderId, { why, orderLabel = '' }) {
  const slug = normalizeCaseFile(caseId);
  const key = String(orderId || '').trim();
  if (!slug || !key || !why) return null;

  await fsp.mkdir(cacheDir, { recursive: true });
  const file = orderWhyCachePath(cacheDir, caseId);
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

  doc.entries[key] = {
    why: String(why).trim(),
    orderLabel: String(orderLabel || '').trim() || doc.entries[key]?.orderLabel || '',
    cachedAt: new Date().toISOString(),
    promptVersion: ORDER_WHY_PROMPT_VERSION,
  };
  doc.updatedAt = new Date().toISOString();
  await fsp.writeFile(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return doc.entries[key];
}
