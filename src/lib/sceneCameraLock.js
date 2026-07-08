import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// This file lives at `game/src/lib/sceneCameraLock.js`.
// We need the project root (`game/`) to reach `game/dev/scene-camera-lock/SCENE_LOCK.json`.
const gameRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lockPath = path.join(gameRoot, 'dev/scene-camera-lock/SCENE_LOCK.json');

/** @type {import('../../dev/scene-camera-lock/SCENE_LOCK.json')} */
export const SCENE_CAMERA_LOCK = JSON.parse(readFileSync(lockPath, 'utf8'));

export function getCameraLockPrompt(variant = 'openai') {
  const prompts = SCENE_CAMERA_LOCK.prompts || {};
  return prompts[variant] || prompts.openai || prompts.short || '';
}

let caseInspectionPhilosophyCache = null;

export function getCaseInspectionPhilosophyPromptBlock() {
  if (caseInspectionPhilosophyCache) return caseInspectionPhilosophyCache;
  const promptPath = path.join(
    gameRoot,
    'dev/uber-portrait-refs/prompts/case-inspection-philosophy.txt',
  );
  caseInspectionPhilosophyCache = readFileSync(promptPath, 'utf8').trim();
  return caseInspectionPhilosophyCache;
}

export function getLandscapeFramePrompt(variant = 'magnific') {
  const { width, height } = SCENE_CAMERA_LOCK.exportPixels;
  return `Landscape 16:9 wide cinematic frame (output will be cropped to ${width}x${height}). Full-body case inspection — crown through toes at bottom edge; patient centered on ED stretcher, slightly zoomed out; monitor upper-right and IV fluids upper-left; same central overhead bedside composition as reference crop lock. ${getCameraLockPrompt(variant)}`;
}

/**
 * Hard ban — POV clinician feet / standing-over-patient camera.
 * Duplicate in prompts + audit scripts; never ship frames that violate this.
 */
export const FORBIDDEN_COMPOSITION =
  'Never render examiner feet, POV standing feet, feet-only crop, or camera-as-clinician-standing-at-foot-of-bed.';

export const REFERENCE_FEET_IGNORE_BLOCK = `REFERENCE IMAGE NOTE: The layout/crop-lock reference may show legacy clinician POV feet at the bottom edge — IGNORE and DO NOT copy those feet. Render ONLY the patient's own toes on the mattress at bottom edge. Empty floor/rail at foot of bed below patient feet is OK.`;

export const FORBIDDEN_POV_FEET_BLOCK = `NEVER (hard ban — POV feet):
- NO POV clinician/examiner feet in frame
- NO standing-over-patient camera — viewer is NOT standing at foot of bed
- NO feet-only top-down hero frame
- NO second person's feet at frame bottom edge
ALLOWED: Patient's OWN toes at bottom edge on mattress (inspection philosophy) — patient toes on bed = GOOD; clinician POV standing feet = BAD`;

/** Steve-approved game-scene gold (angle + composition). */
export const GAME_SCENE_ANGLE_GOLD_REFERENCE_REL =
  'dev/uber-portrait-refs/game-scenes-pending/vitiligo-wink-diastema-GAME-SCENE-alt2.png';

/** Pose + dynamics gold (elder-asian supine composition). */
export const GAME_SCENE_POSE_GOLD_REFERENCE_REL =
  'dev/uber-portrait-refs/refs/COMPOSITION_GOLD-elder-asian-conical-hat-bank-alt1.png';

/** Full-body case-inspection gold (Steve approved 2026-06-18). */
export const GAME_SCENE_INSPECTION_GOLD_REFERENCE_REL =
  'dev/uber-portrait-refs/refs/COMPOSITION_GOLD-subway-afro-dandy-alt1.png';

/** Steve-approved nevus anamorphic v2 — pending ship to public/assets/patient/uber/. */
export const GAME_SCENE_NEVUS_ANAMORPHIC_APPROVED_REL =
  'dev/uber-portrait-refs/game-scenes-pending/nevus-speckled-laugh-GAME-SCENE-alt2-anamorphic-v2-20260618-approved-pending-ship.png';

/** Steve-approved craniofacial U06 — case preview shipped 2026-06-19 (alt2). */
export const GAME_SCENE_CRANIOFACIAL_APPROVED_PENDING_SHIP_REL =
  'dev/uber-portrait-refs/game-scenes-pending/craniofacial-asymmetry-goatee-GAME-SCENE-alt2-approved-pending-ship.png';

/** Steve-approved pipe-tweed bank — alt1 angle-lock v2, pending ship (bank / optional case pool). */
export const GAME_SCENE_PIPE_TWEED_APPROVED_PENDING_SHIP_REL =
  'dev/uber-portrait-refs/game-scenes-pending/pipe-tweed-mustache-bank-GAME-SCENE-alt1-angle-lock-20260618-approved-pending-ship.png';

export const GAME_SCENE_PIPE_TWEED_COMPOSITION_GOLD_REL =
  'dev/uber-portrait-refs/refs/COMPOSITION_GOLD-pipe-tweed-mustache-bank-alt1-angle-lock.png';

export const GAME_SCENE_CRANIOFACIAL_COMPOSITION_GOLD_REL =
  'dev/uber-portrait-refs/refs/COMPOSITION_GOLD-craniofacial-asymmetry-goatee-alt2.png';

/** Steve-approved psychiatric lunatic-pass — case 107, shipped public/assets/patient/psychiatric/ (gamepass v3 alt1). */
export const GAME_SCENE_PSYCH_DISTORTED_APPROVED_PENDING_SHIP_REL =
  'dev/uber-portrait-refs/game-scenes-pending/distorted-excluded-do-not-gen-GAME-SCENE-alt1-gamepass-v3-20260618-approved-pending-ship.png';

export const GAME_SCENE_PSYCH_DISTORTED_COMPOSITION_GOLD_REL =
  'dev/uber-portrait-refs/refs/COMPOSITION_GOLD-distorted-excluded-do-not-gen-alt1-gamepass-v3.png';

/** Steve-approved game-cam ship candidate (manifest only — do not copy to public/ until wire). */
export const GAME_SCENE_HIJAB_GAME_CAM_APPROVED_REL =
  'dev/uber-portrait-refs/game-scenes-pending/hijab-albino-freckles-GAME-SCENE-alt2-v2-20260618-approved-pending-ship.png';

/** Steve-approved inspection gold — pending ship to public/assets/patient/uber/. */
export const GAME_SCENE_SUBWAY_APPROVED_PENDING_SHIP_REL =
  'dev/uber-portrait-refs/game-scenes-pending/subway-afro-dandy-GAME-SCENE-alt1-approved-pending-ship.png';

/** @deprecated alias — use GAME_SCENE_ANGLE_GOLD_REFERENCE_REL */
export const GAME_SCENE_GOLD_REFERENCE_REL = GAME_SCENE_ANGLE_GOLD_REFERENCE_REL;
export const GAME_SCENE_COMPOSITION_GOLD_REFERENCE_REL = GAME_SCENE_POSE_GOLD_REFERENCE_REL;

export const GAME_SCENE_PROTECTED_FILES = [
  'vitiligo-wink-diastema-GAME-SCENE-alt2.png',
  'elder-asian-conical-hat-bank-GAME-SCENE-alt1.png',
  'subway-afro-dandy-GAME-SCENE-alt1.png',
];

/** Approved pending ship — do not overwrite; not in public/ until Steve wires. */
export const GAME_SCENE_APPROVED_PENDING_SHIP = [
  'hijab-albino-freckles-GAME-SCENE-alt2-v2-20260618.png',
  'hijab-albino-freckles-GAME-SCENE-alt2-v2-20260618-approved-pending-ship.png',
  'subway-afro-dandy-GAME-SCENE-alt1.png',
  'subway-afro-dandy-GAME-SCENE-alt1-approved-pending-ship.png',
  'albino-male-freckles-profile-GAME-SCENE-alt2.png',
  'albino-male-freckles-profile-GAME-SCENE-alt2-approved-pending-ship.png',
  'vitiligo-wink-diastema-GAME-SCENE-alt2-approved-pending-ship.png',
  'nevus-speckled-laugh-GAME-SCENE-alt2-anamorphic-v2-20260618.png',
  'nevus-speckled-laugh-GAME-SCENE-alt2-anamorphic-v2-20260618-approved-pending-ship.png',
  'craniofacial-asymmetry-goatee-GAME-SCENE-alt2.png',
  'craniofacial-asymmetry-goatee-GAME-SCENE-alt2-approved-pending-ship.png',
  'pipe-tweed-mustache-bank-GAME-SCENE-alt1-angle-lock-20260618.png',
  'pipe-tweed-mustache-bank-GAME-SCENE-alt1-angle-lock-20260618-approved-pending-ship.png',
  'copper-afro-headwrap-africa-GAME-SCENE-alt2-3d-v3-20260618.png',
  'copper-afro-headwrap-africa-GAME-SCENE-alt2-3d-v3-20260618-approved-pending-ship.png',
];

let gameSceneLockPromptCache = null;
let gameSceneOpticsPromptCache = null;
let gameScenePoseLockPromptCache = null;
let gameSceneGameCameraPromptCache = null;
let gameEngineStylizationPassPromptCache = null;
let forbiddenRenderStylePromptCache = null;

/** Style gold — MeWorld sculptural 3D CGI (NOT stroke/illustration / tilt-shift miniature). */
export const GAME_SCENE_STYLE_GOLD_REFERENCE_RELS = [
  'dev/uber-portrait-refs/game-scenes-pending/subway-afro-dandy-GAME-SCENE-alt1-approved-pending-ship.png',
  'dev/uber-portrait-refs/game-scenes-pending/vitiligo-wink-diastema-GAME-SCENE-alt2.png',
  'dev/uber-portrait-refs/game-scenes-pending/albino-male-freckles-profile-GAME-SCENE-alt2-approved-pending-ship.png',
];

/** Fallback style refs when approved-pending-ship copies are missing. */
export const GAME_SCENE_STYLE_GOLD_REFERENCE_FALLBACK_RELS = [
  'dev/uber-portrait-refs/game-scenes-pending/subway-afro-dandy-GAME-SCENE-alt1.png',
  'dev/uber-portrait-refs/game-scenes-pending/vitiligo-wink-diastema-GAME-SCENE-alt2.png',
  'dev/uber-portrait-refs/game-scenes-pending/albino-male-freckles-profile-GAME-SCENE-alt2.png',
];

export function getGameSceneCameraLockPromptBlock() {
  if (gameSceneLockPromptCache) return gameSceneLockPromptCache;
  const promptPath = path.join(
    gameRoot,
    'dev/uber-portrait-refs/prompts/game-scene-camera-lock.txt',
  );
  gameSceneLockPromptCache = readFileSync(promptPath, 'utf8').trim();
  return gameSceneLockPromptCache;
}

export function getGameSceneCameraOpticsPromptBlock() {
  if (gameSceneOpticsPromptCache) return gameSceneOpticsPromptCache;
  const promptPath = path.join(
    gameRoot,
    'dev/uber-portrait-refs/prompts/camera-optics-lock.txt',
  );
  gameSceneOpticsPromptCache = readFileSync(promptPath, 'utf8').trim();
  return gameSceneOpticsPromptCache;
}

export function getGameSceneGoldReferenceAbsPath() {
  return path.join(gameRoot, GAME_SCENE_COMPOSITION_GOLD_REFERENCE_REL);
}

export function getGameSceneAngleGoldReferenceAbsPath() {
  return path.join(gameRoot, GAME_SCENE_ANGLE_GOLD_REFERENCE_REL);
}

export function getGameSceneCompositionGoldReferenceAbsPath() {
  return path.join(gameRoot, GAME_SCENE_POSE_GOLD_REFERENCE_REL);
}

export function getGameSceneHijabGameCamApprovedAbsPath() {
  return path.join(gameRoot, GAME_SCENE_HIJAB_GAME_CAM_APPROVED_REL);
}

export function getGameSceneNevusAnamorphicApprovedAbsPath() {
  return path.join(gameRoot, GAME_SCENE_NEVUS_ANAMORPHIC_APPROVED_REL);
}

export function getGameScenePoseLockPromptBlock() {
  if (gameScenePoseLockPromptCache) return gameScenePoseLockPromptCache;
  const promptPath = path.join(
    gameRoot,
    'dev/uber-portrait-refs/prompts/game-scene-pose-lock.txt',
  );
  gameScenePoseLockPromptCache = readFileSync(promptPath, 'utf8').trim();
  return gameScenePoseLockPromptCache;
}

export function getGameSceneGameCameraPromptBlock() {
  if (gameSceneGameCameraPromptCache) return gameSceneGameCameraPromptCache;
  const promptPath = path.join(
    gameRoot,
    'dev/uber-portrait-refs/prompts/game-scene-game-camera.txt',
  );
  gameSceneGameCameraPromptCache = readFileSync(promptPath, 'utf8').trim();
  return gameSceneGameCameraPromptCache;
}

/** MeWorld in-engine sculptural CGI pass — use with --game-pass on uber game scenes. */
export function getGameEngineStylizationPassPromptBlock() {
  if (gameEngineStylizationPassPromptCache) return gameEngineStylizationPassPromptCache;
  const promptPath = path.join(
    gameRoot,
    'dev/uber-portrait-refs/prompts/game-engine-stylization-pass.txt',
  );
  gameEngineStylizationPassPromptCache = readFileSync(promptPath, 'utf8').trim();
  return gameEngineStylizationPassPromptCache;
}

/** Hard ban on stroke/illustration render drift — Steve reject 2026-06-18. */
export function getForbiddenRenderStylePromptBlock() {
  if (forbiddenRenderStylePromptCache) return forbiddenRenderStylePromptCache;
  const promptPath = path.join(
    gameRoot,
    'dev/uber-portrait-refs/prompts/forbidden-render-style.txt',
  );
  forbiddenRenderStylePromptCache = readFileSync(promptPath, 'utf8').trim();
  return forbiddenRenderStylePromptCache;
}

export function getGameSceneStyleGoldReferenceAbsPaths() {
  return GAME_SCENE_STYLE_GOLD_REFERENCE_RELS.map((rel, idx) => {
    const primary = path.join(gameRoot, rel);
    if (existsSync(primary)) return primary;
    return path.join(gameRoot, GAME_SCENE_STYLE_GOLD_REFERENCE_FALLBACK_RELS[idx]);
  });
}

/** Off-center game-scene framing — use for uber ED scenes + case preview. */
export function getGameSceneLandscapeFramePrompt(variant = 'magnific') {
  const { width, height } = SCENE_CAMERA_LOCK.exportPixels;
  return `Landscape 16:9 (${width}x${height}). Off-center ~38° bedside, slight 3/4 depth, full head-to-toe inspection frame — toes at bottom edge, monitor upper-right, IV upper-left.`;
}

/** Full lock block for prompts — keep under Magnific 3000 char budget when composed. */
export function getGameScenePromptBlock({
  includeOptics = false,
  includeGameCamera = true,
  includeInspection = true,
} = {}) {
  const parts = [];
  if (includeInspection) parts.push(getCaseInspectionPhilosophyPromptBlock());
  if (includeOptics) parts.push(getGameSceneCameraOpticsPromptBlock());
  parts.push(getGameSceneCameraLockPromptBlock());
  if (includeGameCamera) parts.push(getGameSceneGameCameraPromptBlock());
  return parts.join('\n');
}

export function getHospitalWardrobePrompt({ sex = 'male', isPediatric = false } = {}) {
  if (isPediatric) {
    return 'Pediatric hospital gown — age-appropriate coverage; follow pediatric portrait rules.';
  }
  if (sex === 'female') {
    return 'Light blue hospital gown (preserve hijab/cultural markers from identity ref). No street clothes.';
  }
  return 'Adult male in ED: bare chest or open-back hospital exam gown — NO shirt, NO jacket, NO tweed, NO street clothes.';
}

export function getForbiddenCompositionPromptBlock() {
  return `${FORBIDDEN_POV_FEET_BLOCK}\n${REFERENCE_FEET_IGNORE_BLOCK}`;
}

export function getGameSceneMagnificReferenceText() {
  return `CASE INSPECTION + GAME SCENE GOLD — patient toes at bottom edge on mattress; vitiligo alt2 angle + elder-asian pose + subway inspection gold + hijab alt2 v2 game-cam; off-center ~38° elevated 3/4 bedside, stable mounted rig with subtle 2–5° dutch tilt OK, monitor upper-right, IV upper-left. NO handheld shake. Patient supine on stretcher only. ${FORBIDDEN_COMPOSITION} Change identity and gown — never camera or room layout.`;
}

export function getGameSceneInspectionGoldReferenceAbsPath() {
  return path.join(gameRoot, GAME_SCENE_INSPECTION_GOLD_REFERENCE_REL);
}

/** Magnific layout ref for ALL adult gens — always male anatomic plate (never patient-scene-female.png). */
export function getCropLockRelPath(_sex = 'male') {
  return (
    SCENE_CAMERA_LOCK.cropLock?.male?.path
    || 'dev/anatomic-plates/raw/male-ed-anatomic-plate-a.png'
  );
}

export function getCropLockAbsPath(_sex = 'male') {
  return path.join(gameRoot, getCropLockRelPath(_sex));
}

export function getBaseplateRelPath(sex = 'male') {
  const key = sex === 'female' ? 'female' : 'male';
  return SCENE_CAMERA_LOCK.baseplates[key]?.path || 'public/assets/patient/patient-scene.png';
}

export function getBaseplateAbsPath(sex = 'male') {
  return path.join(gameRoot, getBaseplateRelPath(sex));
}

/** Normalize baseplate path for play vs generation (female uses square source plate). */
export function sanitizeScenePlateRelPath(relPath, { sceneKey } = {}) {
  const rel = String(relPath || '').trim();
  if (!rel) return getBaseplateRelPath(sceneKey === 'female' ? 'female' : 'male');
  return rel;
}

/** Case story + inspection stills — crown through toes framing block. */
export const CASE_STORY_INSPECTION_FRAMING_BLOCK = getCaseInspectionPhilosophyPromptBlock();
