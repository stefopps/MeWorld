import psychRefs from '../data/patientPsychiatricRefs.json' with { type: 'json' };

const SHIPPED_GAME_SCENE_STATUSES = new Set(['approved', 'approved-pending-ship']);
const SHIPPED_INTRO_STATUSES = new Set(['approved', 'approved-pending-ship']);

function resolveSlug(caseContext = {}) {
  const caseId = String(caseContext?.id ?? caseContext?.ccsNumber ?? '').trim();
  if (caseContext?.psychFaceSlug) return caseContext.psychFaceSlug;
  if (psychRefs.caseSlugs?.[caseId]) return psychRefs.caseSlugs[caseId];
  return null;
}

function refEntry(slug) {
  return psychRefs.refs?.[slug] || null;
}

/** Tier A psychiatric preview — shipped GAME-SCENE in public/assets/patient/psychiatric/. */
export function resolvePsychiatricCasePreviewScene(caseContext = {}) {
  const slug = resolveSlug(caseContext);
  if (!slug) return null;

  const entry = refEntry(slug);
  if (!entry?.gameSceneFile) return null;
  if (!SHIPPED_GAME_SCENE_STATUSES.has(entry.gameSceneStatus)) return null;

  const assetBase = psychRefs.assetBase || '/assets/patient/psychiatric';
  return {
    slug,
    caseId: String(caseContext?.id ?? ''),
    url: `${assetBase}/${entry.gameSceneFile}`,
    file: entry.gameSceneFile,
    status: entry.gameSceneStatus,
  };
}

/** Lunatic-pass intro loop config — pending cases only when pendingOnly !== false on ref. */
export function resolvePsychiatricLunaticIntro(caseContext = {}) {
  const slug = resolveSlug(caseContext);
  if (!slug) return null;

  const entry = refEntry(slug);
  if (!entry) return null;
  if (entry.pendingOnly === false) return null;

  const assetBase = psychRefs.assetBase || '/assets/patient/psychiatric';
  const preview = resolvePsychiatricCasePreviewScene(caseContext);
  const introReady =
    entry.lunaticIntroFile && SHIPPED_INTRO_STATUSES.has(entry.lunaticIntroStatus);

  return {
    enabled: Boolean(preview?.url),
    slug,
    caseId: String(caseContext?.id ?? ''),
    anchorUrl: preview?.url || null,
    videoUrl: introReady ? `${assetBase}/${entry.lunaticIntroFile}` : null,
    introStatus: entry.lunaticIntroStatus || 'pending',
    durationSec: entry.lunaticIntroDurationSec || 15,
    pendingOnly: entry.pendingOnly !== false,
  };
}
