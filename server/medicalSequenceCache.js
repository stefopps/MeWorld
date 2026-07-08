import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

function normalizeCaseFile(caseId) {
  const num = String(caseId || '').replace(/^case_/i, '').trim();
  return num ? `case_${num.padStart(3, '0')}` : null;
}

export function medicalSequenceCachePath(cacheDir, caseId) {
  const slug = normalizeCaseFile(caseId);
  return slug ? path.join(cacheDir, `${slug}.json`) : null;
}

/** @returns {object | null} */
export async function readMedicalSequenceCache(cacheDir, caseId) {
  const file = medicalSequenceCachePath(cacheDir, caseId);
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export async function writeMedicalSequenceCache(cacheDir, caseId, payload) {
  const slug = normalizeCaseFile(caseId);
  if (!slug || !payload) return null;
  await fsp.mkdir(cacheDir, { recursive: true });
  const file = medicalSequenceCachePath(cacheDir, slug);
  const doc = {
    caseId: slug,
    ...payload,
    cachedAt: new Date().toISOString(),
  };
  await fsp.writeFile(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return doc;
}
