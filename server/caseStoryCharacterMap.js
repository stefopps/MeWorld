import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { resolvePatientUberRef } from '../src/lib/resolvePatientUberRef.js';

const PENDING_UBER_MAPS_DIR = path.join('dev', 'uber-portrait-refs', 'character-maps-pending');

/** Steve-approved pending alts only — never use *-caricature* variants. */
function pendingMapCandidates(slug) {
  return [`${slug}-CHARACTER-MAP-alt1.png`, `${slug}-CHARACTER-MAP-alt2.png`];
}

function resolvePendingUberCharacterMap(gameRoot, slug) {
  if (!slug) return null;
  const dir = path.join(gameRoot, PENDING_UBER_MAPS_DIR);
  for (const name of pendingMapCandidates(slug)) {
    const absPath = path.join(dir, name);
    if (!fs.existsSync(absPath)) continue;
    const relPath = path.join(PENDING_UBER_MAPS_DIR, name).replace(/\\/g, '/');
    return {
      absPath,
      relPath,
      publicUrl: null,
      file: name,
      slug,
      source: 'pending-uber-character-map',
    };
  }
  return null;
}

/** White-background CHARACTER-MAP — public/ shipped first, then character-maps-pending alt1/alt2. */
export function resolveCaseStoryCharacterMap(gameRoot, caseContext = {}) {
  const uber = resolvePatientUberRef(caseContext);
  const slug = uber?.slug || caseContext?.uberFaceSlug || null;

  if (uber?.file) {
    const relPath = path.join('public', 'assets', 'patient', 'uber', uber.file).replace(/\\/g, '/');
    const absPath = path.join(gameRoot, relPath);
    if (fs.existsSync(absPath)) {
      return {
        absPath,
        relPath,
        publicUrl: uber.publicUrl || `/assets/patient/uber/${uber.file}`,
        file: uber.file,
        slug: uber.slug,
        source: 'uber-character-map',
      };
    }
  }

  return resolvePendingUberCharacterMap(gameRoot, slug);
}

export async function readCaseStoryCharacterMapBuffer(gameRoot, caseContext = {}) {
  const ref = resolveCaseStoryCharacterMap(gameRoot, caseContext);
  if (!ref) return null;
  const buffer = await fsp.readFile(ref.absPath);
  return {
    ...ref,
    buffer,
    mimeType: 'image/png',
    imageBase64: buffer.toString('base64'),
  };
}
