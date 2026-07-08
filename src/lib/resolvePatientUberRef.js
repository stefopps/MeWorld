import uberRefs from '../data/patientUberRefs.json' with { type: 'json' };
import { isUberCase } from './uberCases.js';
import { resolvePediatricCharacterMap } from './patientPediatricRefs.js';

const SHIPPED_GAME_SCENE_STATUSES = new Set(['approved', 'approved-pending-ship']);

/** Tier A — case browser / picker hero plate (shipped GAME-SCENE in public/). */
export function resolveUberCasePreviewScene(caseContext = {}) {
  const ref = resolvePatientUberRef(caseContext);
  if (!ref?.gameSceneUrl) return null;
  if (!SHIPPED_GAME_SCENE_STATUSES.has(ref.gameSceneStatus)) return null;
  return {
    slug: ref.slug,
    caseId: ref.caseId,
    url: ref.gameSceneUrl,
    file: ref.gameSceneFile,
    status: ref.gameSceneStatus,
    tier: 'preview',
  };
}

/** Tier A play — angled in-case plate (GAME-PLAY-SCENE or gamePlaySceneFile). */
export function resolveUberCasePlayScene(caseContext = {}) {
  const ref = resolvePatientUberRef(caseContext);
  const playFile = ref?.gamePlaySceneFile || ref?.gameSceneFile;
  const playStatus = ref?.gamePlaySceneStatus || ref?.gameSceneStatus;
  if (!playFile || !SHIPPED_GAME_SCENE_STATUSES.has(playStatus)) return null;
  const assetBase = uberRefs.assetBase || '/assets/patient/uber';
  return {
    slug: ref.slug,
    caseId: ref.caseId,
    url: `${assetBase}/${playFile}`,
    file: playFile,
    status: playStatus,
    tier: 'play',
  };
}

/** Unique-face ref for Uber composite cases (U01–U08).
 *  Tier A (preview): gameSceneFile → public/assets/patient/uber/<slug>-GAME-SCENE.png
 *  Tier B (in-case): character map publicUrl + buildPortraitPrompt() style lock
 *  Trace copy: game-scenes-pending/<slug>-GAME-SCENE-altN-approved-pending-ship.png */
function normalizeCatalogCaseKey(caseId) {
  const raw = String(caseId ?? '').trim().replace(/^case_/i, '');
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

export function resolvePatientUberRef(caseContext = {}) {
  const caseId = String(caseContext?.id ?? caseContext?.ccsNumber ?? '').trim();
  const caseKey = normalizeCatalogCaseKey(caseId);
  const uberCase = isUberCase(caseId);

  const pedSlug =
    caseContext?.uberPediatricFaceSlug ||
    caseContext?.uberMeta?.pediatricFaceSlug ||
    null;
  if (uberCase && pedSlug) {
    const pedMap = resolvePediatricCharacterMap(pedSlug);
    if (pedMap) {
      const mapFile = pedMap.file;
      return {
        slug: pedSlug,
        caseId,
        label: pedSlug,
        sex: 'female',
        sourceFile: pedMap.refImage || null,
        devSourcePath: pedMap.refImage || null,
        file: mapFile,
        publicUrl: pedMap.publicUrl,
        gameSceneFile: mapFile,
        gameSceneStatus: 'approved',
        gameSceneAlt: null,
        gameSceneUrl: pedMap.publicUrl,
        gamePlaySceneFile: mapFile,
        gamePlaySceneStatus: 'approved',
        gamePlaySceneUrl: pedMap.publicUrl,
        identityPrompt: pedMap.use || 'School-age pediatric patient — worried affect',
        status: pedMap.status,
        isPediatricTemperament: true,
      };
    }
  }

  const slug =
    caseContext?.uberFaceSlug ||
    uberRefs.caseSlugs?.[caseId] ||
    uberRefs.caseSlugs?.[caseKey] ||
    null;
  if (!slug) return null;

  if ((uberRefs.excludedSlugs || []).includes(slug)) return null;

  const entry = uberRefs.refs?.[slug];
  if (!entry || entry.status === 'excluded') return null;

  const assetBase = uberRefs.assetBase || '/assets/patient/uber';
  const mapFile = entry.mapFile || `${slug}-CHARACTER-MAP.png`;
  const gameSceneFile = entry.gameSceneFile || null;
  const gameSceneStatus = entry.gameSceneStatus || null;
  const gamePlaySceneFile = entry.gamePlaySceneFile || null;
  const gamePlaySceneStatus = entry.gamePlaySceneStatus || gameSceneStatus;

  return {
    slug,
    caseId,
    label: entry.label || slug,
    sex: entry.sex || null,
    sourceFile: entry.sourceFile || null,
    devSourcePath: entry.sourceFile
      ? `${uberRefs.devSourceDir}/${entry.sourceFile}`
      : null,
    file: mapFile,
    publicUrl: `${assetBase}/${mapFile}`,
    gameSceneFile,
    gameSceneStatus,
    gameSceneAlt: entry.gameSceneAlt || null,
    gameSceneUrl: gameSceneFile ? `${assetBase}/${gameSceneFile}` : null,
    gamePlaySceneFile,
    gamePlaySceneStatus,
    gamePlaySceneUrl: gamePlaySceneFile ? `${assetBase}/${gamePlaySceneFile}` : null,
    identityPrompt: entry.identityPrompt || '',
    status: entry.status || 'source-packaged',
  };
}
