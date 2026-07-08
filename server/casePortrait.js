import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  pediatricPortraitPromptBlock,
  pediatricPortraitAccessoryBlock,
  resolvePediatricPortraitRef,
  pediatricAgeLabel,
} from '../src/lib/patientPediatricRefs.js';
import { resolvePortraitSex } from '../src/lib/portraitSex.js';
import { resolvePatientLadyRef } from '../src/lib/resolvePatientLadyRef.js';
import { resolvePatientUberRef } from '../src/lib/resolvePatientUberRef.js';
import {
  BASEPLATE_HEIGHT,
  BASEPLATE_WIDTH,
  PORTRAIT_FRAME_VERSION,
  bufferToBase64,
  fitToBaseplate,
} from './portraitFrame.js';
import { generateImageEditWithMagnific, magnificApiKey } from './magnificImage.js';
import { readCaseStoryCharacterMapBuffer } from './caseStoryCharacterMap.js';
import {
  FORBIDDEN_COMPOSITION,
  getCaseInspectionPhilosophyPromptBlock,
  getForbiddenCompositionPromptBlock,
  getForbiddenRenderStylePromptBlock,
  getGameSceneLandscapeFramePrompt,
  getGameSceneMagnificReferenceText,
  getGameScenePromptBlock,
  getHospitalWardrobePrompt,
  getLandscapeFramePrompt,
} from '../src/lib/sceneCameraLock.server.js';
import {
  buildSceneElementPromptBlock,
  sceneElementIdsForPortrait,
} from './sceneElementRegistry.js';
import { buildClinicalAccuracyPromptBlock } from './clinicalAccuracyRules.js';
import { isCasePortraitBanned } from './bannedCasePortraits.js';
export { resolvePortraitSex };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANATOMY_COMPOSITION_LOCK = fs
  .readFileSync(
    path.join(__dirname, '../dev/anatomic-plates/prompts/anatomy-composition-lock.txt'),
    'utf8',
  )
  .trim();

const DEFAULT_POSE_LINE =
  'Patient supine on mattress — head toward top of frame, feet toward bottom; legs along bed length with natural knee bend; bare feet on mattress with toes slightly visible at bottom frame edge; arms at sides.';

const SOLO_PATIENT_LOCK = `CRITICAL COMPOSITION: ONLY the patient lies on the stretcher — NO standing people, NO parents at bedside, NO staff, NO second person on the bed, NO feet of a standing person at the foot of the frame, NO one standing on the patient. Equipment only (monitor, IV pole). ${FORBIDDEN_COMPOSITION}`;

export function normalizeCaseId(caseId) {
  const s = String(caseId || '').trim();
  if (!s) return null;
  const num = s.replace(/^case_/i, '');
  return `case_${num}`;
}

export function portraitFileName(caseId) {
  const slug = normalizeCaseId(caseId);
  return slug ? `${slug}.png` : null;
}

export function portraitBaselineFileName(caseId) {
  const slug = normalizeCaseId(caseId);
  return slug ? `${slug}-baseline.png` : null;
}

export function portraitBaselinePublicUrl(caseId, origin) {
  const fileName = portraitBaselineFileName(caseId);
  if (!fileName) return null;
  const port = Number(process.env.PORT || process.env.SPORTMAKER_API_PORT || 3001);
  const base =
    origin
    || process.env.PUBLIC_URL?.replace(/\/$/, '')
    || `http://127.0.0.1:${port}`;
  return `${base}/case-portraits/${fileName}`;
}

export async function readPortraitBaseline(portraitDir, caseId) {
  const fileName = portraitBaselineFileName(caseId);
  if (!fileName) return { exists: false, fileName: null, pngPath: null };
  const pngPath = path.join(portraitDir, fileName);
  try {
    await fsp.access(pngPath);
    return { exists: true, fileName, pngPath };
  } catch {
    return { exists: false, fileName, pngPath };
  }
}

/** Copy current portrait to baseline once — preserves arrival look for before/after. */
export async function ensurePortraitBaseline(portraitDir, caseId) {
  const existing = await readPortraitBaseline(portraitDir, caseId);
  if (existing.exists) return { ...existing, created: false };
  const cached = await readPortraitCache(portraitDir, caseId);
  if (!cached.exists) return { exists: false, created: false };
  const baselineName = portraitBaselineFileName(caseId);
  const baselinePath = path.join(portraitDir, baselineName);
  await fsp.copyFile(cached.pngPath, baselinePath);
  return { exists: true, fileName: baselineName, pngPath: baselinePath, created: true };
}

export function portraitPublicUrl(caseId, origin) {
  const fileName = portraitFileName(caseId);
  if (!fileName) return null;
  const port = Number(process.env.PORT || process.env.SPORTMAKER_API_PORT || 3001);
  const base =
    origin
    || process.env.PUBLIC_URL?.replace(/\/$/, '')
    || `http://127.0.0.1:${port}`;
  return `${base}/case-portraits/${fileName}`;
}

export function portraitPreviewFileName(caseId) {
  const slug = normalizeCaseId(caseId);
  return slug ? `${slug}_preview.png` : null;
}

export function portraitPreviewPublicUrl(caseId, origin) {
  const fileName = portraitPreviewFileName(caseId);
  if (!fileName) return null;
  const port = Number(process.env.PORT || process.env.SPORTMAKER_API_PORT || 3001);
  const base =
    origin
    || process.env.PUBLIC_URL?.replace(/\/$/, '')
    || `http://127.0.0.1:${port}`;
  return `${base}/case-portraits/${fileName}`;
}

function presentationCueForComplaint(cc) {
  const ccLower = String(cc || '').toLowerCase();
  if (/chest pain|mi|acs|angina/.test(ccLower)) {
    return 'mild diaphoresis, clutching chest, anxious expression';
  }
  if (/dyspnea|shortness|breath/.test(ccLower)) {
    return 'labored breathing, accessory muscle use, upright in bed';
  }
  if (/abdominal|belly|nausea|vomit|bleed/.test(ccLower)) {
    return 'guarding abdomen, mild nausea, uncomfortable but stable';
  }
  if (/fever|rash|infection/.test(ccLower)) {
    return 'febrile appearance, flushed or ill-appearing as appropriate';
  }
  if (/altered|confusion|syncope|seizure/.test(ccLower)) {
    return 'altered mental status cues without exaggeration';
  }
  return 'appropriate distress for the chief complaint';
}

function voiceToneForComplaint(cc, { speakAsChild = false } = {}) {
  if (speakAsChild) {
    return 'child voice — simple words, short sentences; parent may answer some questions';
  }
  const ccLower = String(cc || '').toLowerCase();
  if (/chest pain|mi|acs/.test(ccLower)) return 'anxious, guarded, speaks in short phrases';
  if (/dyspnea|shortness|breath/.test(ccLower)) return 'breathless, pauses between short sentences';
  if (/abdominal|belly|nausea|vomit|bleed/.test(ccLower)) return 'uncomfortable, quiet, may wince';
  if (/altered|confusion|ams|seizure|obtunded/i.test(ccLower)) {
    return 'confused, slow responses; may minimize alcohol and drug use until labs prove otherwise — cooperative but defensive';
  }
  if (/fever|infection/.test(ccLower)) return 'fatigued, weak voice, intermittently alert';
  return 'tired but cooperative, answers in plain language';
}

/** Structured persona for patient_sim chat — from case JSON (+ optional vision pass on portrait). */
export function buildPortraitPersona(caseContext = {}, visionDetails = null) {
  const facts = caseContext.patientFacts || {};
  const demo = caseContext.patientDemographics || {};
  const age =
    facts.ageLabel ||
    demo.ageLabel ||
    (facts.age != null ? `${facts.age} ${facts.ageUnit || 'years'}` : demo.isPediatric ? '7 years' : 'adult');
  const sex = facts.sex || caseContext.patientSex || 'patient';
  const name = caseContext.patientName || facts.name || 'the patient';
  const cc =
    facts.chiefComplaint ||
    caseContext.chief_complaint ||
    caseContext.title ||
    'undifferentiated complaint';
  const presentationCue = presentationCueForComplaint(cc);
  const composition =
    'Lived-in busy ED training plate — off-center ~38° bedside view with slight 3/4 depth; crown-through-toes with toes at bottom edge (not dead-center MCU, not 90° bird\'s-eye).';
  const isPediatric = Boolean(demo.isPediatric || facts.isPediatric);
  const speakAsChild = Boolean(demo.speakAsChild || facts.speakAsChild);

  const base = {
    patientName: name,
    age,
    sex,
    chiefComplaint: cc,
    category: caseContext.category || null,
    isPediatric,
    speakAsChild,
    appearance: `${age} ${sex} in the ED with ${presentationCue}.`,
    distressLevel: presentationCue,
    composition,
    voiceTone: voiceToneForComplaint(cc, { speakAsChild }),
    summary: `${name} is a ${age} old ${sex} presenting with ${cc}. Visible distress: ${presentationCue}. ${composition}`,
  };

  if (!visionDetails || typeof visionDetails !== 'object') return base;

  const visionAge = visionDetails.estimatedAgeYears;
  const visionConflictsPediatric =
    base.isPediatric &&
    visionAge != null &&
    Number.isFinite(Number(visionAge)) &&
    Number(visionAge) >= 18;

  return {
    ...base,
    ...visionDetails,
    age: base.age,
    isPediatric: base.isPediatric,
    speakAsChild: base.speakAsChild,
    estimatedAgeYears:
      visionConflictsPediatric && base.isPediatric ? 7 : visionAge,
    summary: visionConflictsPediatric
      ? base.summary
      : visionDetails.summary ||
        [visionDetails.appearance, visionDetails.distress, visionDetails.composition]
          .filter(Boolean)
          .join(' ') ||
        base.summary,
  };
}

export function formatPersonaForChat(persona) {
  if (!persona || typeof persona !== 'object') return '';
  const lines = [
    persona.summary && `Summary: ${persona.summary}`,
    persona.appearance && `Appearance: ${persona.appearance}`,
    persona.distressLevel && `Distress: ${persona.distressLevel}`,
    persona.composition && `Scene/composition: ${persona.composition}`,
    persona.voiceTone && `Voice & manner: ${persona.voiceTone}`,
    persona.visibleFindings && `Visible findings: ${persona.visibleFindings}`,
    persona.personalityCues && `Personality cues: ${persona.personalityCues}`,
  ].filter(Boolean);
  return lines.join('\n');
}

/** Vision pass on generated portrait — grounds patient_sim in what the learner sees. */
export async function extractPersonaFromPortraitImage(imageBase64) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !imageBase64) return null;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      max_tokens: 520,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Describe this emergency department patient photo for a medical simulation chatbot.
Return JSON only with keys: appearance, distress, composition, visibleFindings, voiceTone, personalityCues, summary, estimatedAgeYears.
- estimatedAgeYears: best estimate of patient age in years (number; use decimals for infants, e.g. 0.5 for 6 months)
- appearance: age/sex presentation, skin, posture, clothing (1-2 sentences) — state if child vs adult clearly
- distress: how sick they look
- composition: bed, monitors, pose in frame
- visibleFindings: only what is clearly visible (no invented labs)
- voiceTone: how they would sound when speaking
- personalityCues: brief demeanor (cooperative, anxious, etc.)
- summary: one paragraph the chat model should treat as ground truth for roleplay
Clinical, dignified, no names unless visible on image.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}` },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!r.ok) return null;
  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      appearance: parsed.appearance || null,
      distressLevel: parsed.distress || parsed.distressLevel || null,
      composition: parsed.composition || null,
      visibleFindings: parsed.visibleFindings || null,
      voiceTone: parsed.voiceTone || null,
      personalityCues: parsed.personalityCues || null,
      summary: parsed.summary || null,
      estimatedAgeYears:
        parsed.estimatedAgeYears != null ? Number(parsed.estimatedAgeYears) : null,
      source: 'vision',
    };
  } catch {
    return null;
  }
}

export const PORTRAIT_ASPECT = '16:9';
export const PORTRAIT_OPENAI_SIZE = '1536x1024';

const LANDSCAPE_FRAME = getLandscapeFramePrompt();
const GAME_SCENE_LANDSCAPE_FRAME = getGameSceneLandscapeFramePrompt('magnific');
const CASE_INSPECTION_BLOCK = getCaseInspectionPhilosophyPromptBlock();

/** House-style cold-open portrait prompt from case presentation context. */
export function buildPortraitPrompt(
  caseContext = {},
  { portraitBrief = '', directorBrief = null, variant = 'base', sessionUpdate = false } = {},
) {
  const facts = caseContext.patientFacts || {};
  const demo = caseContext.patientDemographics || {};
  const pedRef =
    demo.pediatricPortraitRef ||
    resolvePediatricPortraitRef(caseContext.id ?? caseContext.ccsNumber, caseContext);
  const pedAgeLabel = pedRef ? pediatricAgeLabel(pedRef) : null;
  const age =
    pedAgeLabel ||
    facts.ageLabel ||
    demo.ageLabel ||
    (facts.age != null ? `${facts.age} ${facts.ageUnit || 'years'}` : demo.isPediatric ? '7 years' : 'adult');
  const sex = resolvePortraitSex(caseContext);
  const isPediatricCase = Boolean(demo.isPediatric || facts.isPediatric || pedRef?.isPediatric);
  const sexLabel =
    sex === 'female'
      ? isPediatricCase
        ? 'girl'
        : 'woman'
      : isPediatricCase
        ? 'boy'
        : 'man';
  const name = caseContext.patientName || facts.name || 'the patient';
  const cc =
    facts.chiefComplaint ||
    caseContext.chief_complaint ||
    caseContext.title ||
    'undifferentiated complaint';
  const category = caseContext.category ? ` (${caseContext.category})` : '';
  const excerpt = String(caseContext.hpiExcerpt || '').trim().slice(0, 220);

  const presentationCue = presentationCueForComplaint(cc);

  const director = directorBrief && typeof directorBrief === 'object' ? directorBrief : null;
  const contextLine = director?.visibleFindings
    ? `Presentation: ${director.visibleFindings}`
    : excerpt
      ? `History cue: ${excerpt}.`
      : '';
  const distressLine = director?.distress ? `Distress: ${director.distress}.` : `Show ${presentationCue}.`;
  const examLine = director?.skinAndExam ? `${director.skinAndExam}` : '';
  const poseLine = director?.pose || DEFAULT_POSE_LINE;

  const custom = String(portraitBrief || caseContext.portraitBrief || '').trim();
  const uberRef = resolvePatientUberRef(caseContext);
  const ladyRef = uberRef ? null : resolvePatientLadyRef(caseContext, { sex });
  const identityBlock = uberRef?.identityPrompt
    ? `\nUBER IDENTITY LOCK (unique face ref: ${uberRef.label}): ${uberRef.identityPrompt}`
    : ladyRef?.identityPrompt
      ? `\nFEMALE IDENTITY LOCK (LongMan Atta character ref: ${ladyRef.label}): ${ladyRef.identityPrompt}`
      : '';
  const pediatricBlock = pediatricPortraitPromptBlock(pedRef);
  const pediatricAccessoryBlock = pediatricPortraitAccessoryBlock(pedRef);

  const ivBlock =
    variant === 'iv'
      ? `
IV LAYER (identical framing/composition to arrival portrait): ADD a peripheral IV only —
20g catheter in LEFT antecubital fossa (inner elbow crease), IV tubing secured with tape.
Antecubital portal per ED training — NOT dorsal hand, wrist, or neck unless specified.
Patient otherwise identical to arrival state.`
      : `
NO IV lines, catheters, central lines, or IV fluids — patient as they ARRIVED to the ED.`;

  const sessionUpdateBlock =
    (sessionUpdate || director?.sessionUpdate) && director
      ? `
SESSION PORTRAIT UPDATE (before/after teaching — edit reference in place):
LOCK IDENTICAL: camera angle, 16:9 framing, bed rails, monitor upper-right, patient identity, age, sex, ethnicity, hair, gown.
UPDATE ONLY clinical appearance from this encounter:
${director.visibleFindings || 'discovered exam and presentation findings'}.
${director.distress ? `Distress: ${director.distress}.` : ''}
${director.skinAndExam || ''}
${director.pose ? `Pose: ${director.pose}` : 'Supine on ED stretcher unless session findings require a different posture (e.g. lethargic neonate flat, not sitting up).'}
Do not add diagnosis text labels or watermarks.`
      : '';

  const useGameSceneLock = Boolean(uberRef?.gameSceneUrl || uberRef?.gameSceneFile);
  const frameBlock = useGameSceneLock ? GAME_SCENE_LANDSCAPE_FRAME : LANDSCAPE_FRAME;
  const cameraLockBlock = useGameSceneLock
    ? getGameScenePromptBlock({ includeOptics: true, includeInspection: false })
    : '';
  const wardrobeBlock = getHospitalWardrobePrompt({
    sex,
    isPediatric: isPediatricCase,
  });
  const clinicalBlock = buildClinicalAccuracyPromptBlock({ scene: 'ed' });

  const base = `Cinematic hospital film-still CGI — MeWorld game style: tactile sculptural stylized clinical realism, muted palette (NOT photoreal live-action headswap). ${frameBlock}
${getForbiddenRenderStylePromptBlock()}
${CASE_INSPECTION_BLOCK}
${ANATOMY_COMPOSITION_LOCK}
${clinicalBlock}
${cameraLockBlock ? `\n${cameraLockBlock}\n` : ''}
${age} old ${sexLabel} (${sex}) named ${name} in an ED hospital bed${category}.
Wardrobe: ${wardrobeBlock}
Chief complaint: ${cc}. ${contextLine}
${distressLine} ${examLine}
${poseLine}
Monitor cables and pulse ox visible, dignified clinical lighting. Patient must clearly present as ${sexLabel}; match reference bed composition exactly.${pediatricBlock}${pediatricAccessoryBlock}${identityBlock}
${ivBlock}
${sessionUpdateBlock}
${SOLO_PATIENT_LOCK}
${getForbiddenCompositionPromptBlock()}
No text, watermark, logos, diagnosis labels, or extra people. No gore or sensational injury.${buildSceneElementPromptBlock(sceneElementIdsForPortrait(caseContext, variant))}`;

  if (!custom) return base;

  return `${base}

MANDATORY USER PORTRAIT DIRECTION (follow closely; overrides generic cues where they conflict):
${custom}
Match the described age, body size, ethnicity, pose, distress, clothing, and who is in frame. Keep dignified clinical ED photography — no gore, watermarks, or text.`;
}

/** Best-effort YouTube still for Real World avatar source (public thumbnail CDN). */
export async function fetchYouTubeThumbnailBase64(youtubeId) {
  const id = String(youtubeId || '').trim();
  if (!id || id.includes(' ')) throw new Error('Invalid YouTube id');

  const urls = [
    `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 1200) continue;
      return {
        base64: buf.toString('base64'),
        mimeType: 'image/jpeg',
        thumbnailUrl: url,
      };
    } catch {
      /* try next */
    }
  }
  throw new Error('Could not fetch YouTube thumbnail for avatar');
}

/** Likeness portrait from a Real World patient still + case JSON. */
export function buildVideoAvatarPrompt(caseContext = {}, { patientName = '', videoTitle = '' } = {}) {
  const base = buildPortraitPrompt(caseContext);
  const who = [patientName, videoTitle].filter(Boolean).join(' — ');
  return `${base}

REAL PATIENT REFERENCE (from public patient story video${who ? `: ${who}` : ''}):
Preserve this person's facial likeness, apparent age, skin tone, and identity.
Place them in the same 3D-style ED hospital bed scene as other case portraits — dignified clinical training photo.
Single patient in hospital gown on stretcher, monitor cables visible, wide bedside framing.`;
}

export function buildPortraitAnalysis(caseContext = {}, persona = null) {
  const facts = caseContext.patientFacts || {};
  const base = {
    patientName: caseContext.patientName || facts.name || null,
    chiefComplaint:
      facts.chiefComplaint || caseContext.chief_complaint || caseContext.title || null,
    age: facts.age ?? null,
    ageUnit: facts.ageUnit || 'years',
    sex: facts.sex || caseContext.patientSex || null,
    category: caseContext.category || null,
  };
  if (!persona) return base;
  return { ...base, persona };
}

export async function readPortraitCache(portraitDir, caseId, { allowBanned = false } = {}) {
  const fileName = portraitFileName(caseId);
  if (!fileName) return { exists: false, fileName: null, meta: null };
  // A banned portrait is normally hidden (never reused as a generation reference or
  // shipped). On the live LOAD path we pass allowBanned so an existing portrait is
  // still served instead of triggering a ~90s rebuild on every case open — the bad
  // portrait is only replaced when the user explicitly presses Regenerate (refresh).
  if (!allowBanned && isCasePortraitBanned(caseId)) {
    return { exists: false, fileName, pngPath: path.join(portraitDir, fileName), meta: null, banned: true };
  }
  const pngPath = path.join(portraitDir, fileName);
  const metaPath = path.join(portraitDir, fileName.replace(/\.png$/i, '.json'));
  try {
    await fsp.access(pngPath);
    let meta = {};
    try {
      meta = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    } catch {
      /* no meta */
    }
    return { exists: true, fileName, pngPath, meta };
  } catch {
    return { exists: false, fileName, pngPath, meta: null };
  }
}

export async function writePortraitCache(portraitDir, caseId, outB64, meta = {}) {
  const fileName = portraitFileName(caseId);
  if (!fileName) throw new Error('Invalid case id');
  const pngPath = path.join(portraitDir, fileName);
  const metaPath = path.join(portraitDir, fileName.replace(/\.png$/i, '.json'));
  await fsp.writeFile(pngPath, Buffer.from(outB64, 'base64'));
  const payload = {
    caseId: normalizeCaseId(caseId),
    cachedAt: new Date().toISOString(),
    provider: meta.provider || 'magnific',
    ...meta,
  };
  await fsp.writeFile(metaPath, JSON.stringify(payload, null, 2), 'utf8');
  return { fileName, pngPath, meta: payload };
}

export function buildPortraitMeta(caseContext = {}) {
  const sex = resolvePortraitSex(caseContext);
  const uberRef = resolvePatientUberRef(caseContext);
  const ladyRef = uberRef ? null : resolvePatientLadyRef(caseContext, { sex });
  return {
    patientSex: sex,
    portraitAspect: PORTRAIT_ASPECT,
    portraitFrameVersion: PORTRAIT_FRAME_VERSION,
    portraitWidth: BASEPLATE_WIDTH,
    portraitHeight: BASEPLATE_HEIGHT,
    uberRefSlug: uberRef?.slug || null,
    uberRefUrl: uberRef?.publicUrl || null,
    uberGameSceneFile: uberRef?.gameSceneFile || null,
    uberGameSceneUrl: uberRef?.gameSceneUrl || null,
    uberGameSceneStatus: uberRef?.gameSceneStatus || null,
    ladyRefSlug: ladyRef?.slug || null,
    ladyRefUrl: ladyRef?.publicUrl || null,
  };
}
/** Magnific extra refs — uber CHARACTER-MAP when no shipped GAME-SCENE yet. */
export async function buildPortraitMagnificExtras(gameRoot, caseContext = {}) {
  const characterMap = await readCaseStoryCharacterMapBuffer(gameRoot, caseContext);
  if (!characterMap?.imageBase64) return [];
  return [
    {
      image: `data:image/png;base64,${characterMap.imageBase64}`,
      mime_type: 'image/png',
      text:
        'WHITE-BG CHARACTER MAP — match face, hair, age, skin tone, ethnicity, and likeness exactly in the ED scene.',
    },
  ];
}

async function generatePortraitWithMagnific({ imageBase64, mimeType, prompt, extraReferenceImages = [] }) {
  const buf = await generateImageEditWithMagnific({
    imageBase64,
    mimeType,
    prompt,
    aspectRatio: PORTRAIT_ASPECT,
    resolution: process.env.MAGNIFIC_PORTRAIT_RESOLUTION || '2K',
    referenceText: getGameSceneMagnificReferenceText(),
    extraReferenceImages,
  });
  const fitted = await fitToBaseplate(buf);
  return bufferToBase64(fitted);
}

async function generatePortraitWithFal({ imageBase64, mimeType, prompt }) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY not configured');
  const model = process.env.FAL_SCENE_MODEL || 'fal-ai/joyai-image-edit';
  const r = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_url: `data:${mimeType};base64,${imageBase64}`,
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`fal portrait failed: ${err || r.status}`);
  }
  const data = await r.json();
  const imageUrl =
    data?.images?.[0]?.url
    || data?.image?.url
    || data?.output?.url
    || data?.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error('No image returned from fal');
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) throw new Error('Could not download fal portrait');
  const buf = Buffer.from(await imgResp.arrayBuffer());
  const fitted = await fitToBaseplate(buf);
  return bufferToBase64(fitted);
}

/** Magnific Nano Banana Pro first; legacy fal fallback when Magnific fails or is unset. */
export async function generatePortraitWithFallback({
  imageBase64,
  mimeType,
  prompt,
  extraReferenceImages = [],
} = {}) {
  const opts = { imageBase64, mimeType, prompt, extraReferenceImages };
  if (magnificApiKey()) {
    try {
      return { b64: await generatePortraitWithMagnific(opts), provider: 'magnific' };
    } catch (e) {
      console.warn('[case-portrait] Magnific failed, trying fal:', e.message);
      if (!process.env.FAL_KEY) throw e;
    }
  }
  if (process.env.FAL_KEY) {
    return { b64: await generatePortraitWithFal(opts), provider: 'fal' };
  }
  throw new Error('MAGNIFIC_API_KEY or FAL_KEY required for portrait generation');
}