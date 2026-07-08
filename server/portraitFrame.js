import fsp from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getCropLockRelPath, sanitizeScenePlateRelPath } from '../src/lib/sceneCameraLock.js';
import { resolvePatientSceneKey } from '../src/lib/patientSceneKey.js';

/** Canonical play viewport frame — see `dev/scene-camera-lock/SCENE_LOCK.json`. */
export const BASEPLATE_WIDTH = 1536;
export const BASEPLATE_HEIGHT = 864;
export const PORTRAIT_FRAME_VERSION = 3;

const BASEPLATE_FILES = {
  male: 'public/assets/patient/patient-scene.png',
  female: 'public/assets/patient/patient-scene-source-square.png',
  pedMale: 'public/assets/patient/patient-scene-ped-male.png',
  pedFemale: 'public/assets/patient/patient-scene-source-square.png',
};

export function baseplateRelPath(sceneKey = 'male') {
  const rel = BASEPLATE_FILES[sceneKey] || BASEPLATE_FILES.male;
  return sanitizeScenePlateRelPath(rel, { sceneKey });
}

export async function readBaseplateBuffer(gameRoot, caseContext = {}) {
  const sceneKey = resolvePatientSceneKey(caseContext);
  const rel = baseplateRelPath(sceneKey);
  const abs = path.join(gameRoot, rel);
  try {
    const buf = await fsp.readFile(abs);
    return { buffer: buf, mimeType: 'image/png', relPath: rel, sex: sceneKey };
  } catch {
    const fallbackKey = sceneKey.startsWith('ped') ? 'pedMale' : 'male';
    const fallbackRel = baseplateRelPath(fallbackKey);
    const fallbackAbs = path.join(gameRoot, fallbackRel);
    const buf = await fsp.readFile(fallbackAbs);
    return { buffer: buf, mimeType: 'image/png', relPath: fallbackRel, sex: fallbackKey };
  }
}

/**
 * Magnific layout input for portrait/scene gens.
 * Adult male + female: always male anatomic crop lock (never patient-scene-female.png — POV feet artifact).
 * Pediatric: ped baseplate from readBaseplateBuffer.
 */
export async function readGenerationLayoutBuffer(gameRoot, caseContext = {}) {
  const sceneKey = resolvePatientSceneKey(caseContext);
  if (sceneKey === 'pedMale') {
    return readBaseplateBuffer(gameRoot, caseContext);
  }
  const rel = getCropLockRelPath('male');
  const abs = path.join(gameRoot, rel);
  const buf = await fsp.readFile(abs);
  return {
    buffer: buf,
    mimeType: 'image/png',
    relPath: rel,
    sex: sceneKey,
    layoutSource: 'cropLock',
  };
}

/** Resize/crop any PNG to the approved 16:9 baseplate dimensions. */
export async function fitToBaseplate(buffer) {
  return sharp(buffer)
    .resize(BASEPLATE_WIDTH, BASEPLATE_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .png()
    .toBuffer();
}

export function bufferToBase64(buffer) {
  return buffer.toString('base64');
}
