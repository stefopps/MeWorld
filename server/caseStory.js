/** Case story — master narrative + third-person oversight still after session. */

import {
  beatCompositionDirective,
  buildCharacterLockPromptSection,
} from './caseStoryCharacterLock.js';
import {
  buildClinicalAccuracyPromptBlock,
  isHomeStoryBeat,
} from './clinicalAccuracyRules.js';
import { CASE_STORY_INSPECTION_FRAMING_BLOCK } from '../src/lib/sceneCameraLock.js';
import { getForbiddenRenderStylePromptBlock, getGameEngineStylizationPassPromptBlock, getGameSceneCameraLockPromptBlock } from '../src/lib/sceneCameraLock.server.js';
import { buildStorycraftMechanismPreflight, buildMechanismTeachingPromptBlock } from './mechanismTeaching.js';
import {
  buildLateralityPromptBlock,
  auditCaseStoryLaterality,
  resolveLateralityLock,
} from '../src/lib/caseStoryLaterality.js';

/** Bump when narrative prompt / storycraft rules change — stale cache ignored. */
export const CASE_STORY_PROMPT_VERSION = 13;

const SPOKEN_ENGLISH_VOICE = `SPOKEN ENGLISH VOICE (mandatory — chapter bodies are read aloud):
- Write every chapter **body** as **spoken prose**: complete sentences a narrator can read naturally — NOT chart shorthand, HPI paste, or telegraphic vitals lists.
- **Read-aloud test:** if a sentence sounds awkward when spoken, rewrite it before returning JSON.
- **Copulas required:** "his right leg **is** stiff" — never drop is/are/was ("leg stiff", "face pale", "vitals soft").
- **Vitals with verbs:** weave numbers into running prose — "the triage nurse **takes** vitals and notes borderline low blood pressure", "his heart rate **is** 110", "SpO₂ **hovers** just under 95%". NEVER bare noun-stack labels like "quiet tachycardia", "soft hypotension", or "deceptively soft vitals" without a spoken clause.
- **Banned phrases:** "quiet tachycardia", telegraphic vitals dumps with no verbs ("HR 116, BP 82/50" alone), journal-style participial chains without a clear subject.
- **Embodied qualia first:** show the patient moving through space — face clenched with each step, barely able to move, grabs the doorframe, eases into a chair exhaling slowly — before abstract pathophysiology.
- **Clinicians act:** "Dr. Oppong kneels beside him" — nurses **take**, **note**, **place**; active verbs, not passive labels.
- Mechanism teaching stays Immersa/MeWorld — threaded through spoken sentences, not stacked adjectives.

Gold arrival beat (tone only — adapt patient, injury, and vitals to THIS case):
"He limps into triage — his right leg is stiff, and his face clenches with every step. He can barely move; one hand stays on the doorframe until he eases into the chair and exhales slowly, still tired from the marathon. The triage nurse takes vitals and notes borderline low blood pressure while his SpO₂ hovers just under 95%."`;

const STORYCRAFT_SYSTEM = `${buildStorycraftMechanismPreflight()}

You are a clinical storyteller for MeWorld emergency medicine training (Storycraft Scale).

After the learner finishes (or pauses) a case, write a **case story** — third-person oversight prose the learner reads like a short clinical episode, NOT a chart note or order list.

${SPOKEN_ENGLISH_VOICE}

Storycraft rules (mandatory):
- **Exactly 6 chapters** (ids c1–c6) — one per 2×3 storyboard panel. Use these **learner-facing headings** (exact wording):
  - c1: "Scene 1 — With the patient"
  - c2: "Scene 2 — With the attending"
  - c3: "Scene 3 — Orders and data"
  - c4: "Scene 4 — Results land"
  - c5: "Scene 5 — Treatment and mechanism"
  - c6: "Scene 6 — Plan together"
  Never use Disruption, Embodiment, Escalation, Crisis point, Mechanism turn, or Recontextualization as headings.
- **Qualia:** at least one embodied sensory detail (cold floor, hollow stare, bruit under the stethoscope)
- **Sequence logic:** each beat causes the next ("because" not "and then")
- **Tellability:** one memorable true image or phrase tied to mechanism (e.g. scattered DWI specks = brain "peppered" with emboli for TIA)
- **Title:** short, human; witty clinical pun OK if accurate (e.g. TIA/embolic case → "The Man Who Got Peppered" not generic "Altered Mental Status")
- **Order channels:** acute/ABCs separate from prophylaxis and workup — do not collapse into one beat when learner flagged teaching moments or orders span channels.
- **Laterality:** when case context locks injury side (e.g. right forearm bite), every chapter body and visualHint must keep the same side — never mirror to the opposite limb.
- **ED visualHint framing:** crown through toes — patient's bare feet/toes visible at bottom frame edge on mattress (inspection gold). Mid-thigh crop without toes = FAIL.

Return ONLY valid JSON:
{
  "title": "short episode title",
  "synopsis": "2-3 sentences — emotional + clinical hook",
  "chapters": [
    { "id": "c1", "heading": "Scene 1 — With the patient", "body": "2-4 sentences third-person spoken prose — complete sentences, read-aloud natural", "visualHint": "smart camera for THIS beat only — MCU, wide 3/4, or close on finding; vary angle across the six chapters" }
  ],
  "masterImagePrompt": "One paragraph visual brief for third-person oversight still — patient likeness, distress, props — NO bird's-eye overhead",
  "patientLock": "age, sex, ethnicity, gown — likeness lock for image gen"
}`;

const THIRD_PERSON_CAMERA = `${CASE_STORY_INSPECTION_FRAMING_BLOCK}

THIRD-PERSON OVERSIGHT CAMERA (mandatory):
NOT bird's-eye 90° overhead — NOT camera standing directly above the patient.
Clinician-height beside the bed (~1.4m), 3/4 angle from foot of stretcher looking toward head.
Patient supine on ED stretcher, room depth visible — monitor upper-right, IV upper-left, both rails.
16:9 cinematic medical training still — MeWorld game style, sculptural tactile realism, muted clinical palette.
IN-GAME ONLY: smooth 3D sculptural CGI — NO uniform outlines, cel-shade, comic book, ink strokes, NPR illustration (comic strip style parked — see COMIC_STRIP_STYLE_FUTURE.md).`;

const COMPOSITION_VARIETY = `COMPOSITION (vary per beat — NOT every panel dead-center):
Avoid symmetrical foot-of-bed centerline on every still. Use rule-of-thirds: subject left-third, right-third, or lower third.
Alternate MCU, medium three-quarter, wide establishing, foreground occlusion (rail, paperwork, equipment).
Shallow depth of field — name foreground blur, midground subject, background room depth.`;

const HOME_SCENE_CAMERA = `HOME SCENE CAMERA (pre-hospital beats only):
Domestic interior — bedroom or living room, natural morning window light.
Third-person cinematic still — same MeWorld sculptural tactile realism, muted palette.
Patient in home clothes or pajamas — NOT hospital gown, NOT stretcher, NOT ED equipment.
16:9 cinematic still — environmental storytelling (fallen cane, bedside table, quiet isolation).`;

function formatSessionBlock(sessionContext = {}) {
  const parts = [];
  const placed = Array.isArray(sessionContext?.stacksPlaced)
    ? sessionContext.stacksPlaced.map((s) => (typeof s === 'string' ? s : s.label || s.id)).filter(Boolean)
    : [];
  if (placed.length) parts.push(`Orders placed: ${placed.join(', ')}`);

  const timeline = (sessionContext?.ordersTimeline || [])
    .slice(-12)
    .map((e) => e.label || e.type)
    .filter(Boolean);
  if (timeline.length) parts.push(`Order timeline: ${timeline.join(' → ')}`);

  const notes = String(sessionContext?.learnerNotes || '').trim();
  if (notes) parts.push(`Learner notes:\n${notes.slice(0, 1200)}`);

  const chat = (sessionContext?.chatMessages || [])
    .slice(-16)
    .map((m) => `${m.role}: ${String(m.content || '').slice(0, 280)}`)
    .join('\n');
  if (chat) parts.push(`Attendant / patient chat:\n${chat}`);

  const activity = (sessionContext?.sessionActivity || [])
    .slice(-12)
    .map((e) => `${e.role}: ${String(e.text || e.content || '').slice(0, 200)}`)
    .join('\n');
  if (activity) parts.push(`Scene activity:\n${activity}`);

  const exams = (sessionContext?.physicalExamFindings || [])
    .map((r) => `${r.label}: ${String(r.text || '').slice(0, 200)}`)
    .join('\n');
  if (exams) parts.push(`Physical exam proof:\n${exams}`);

  const labs = (sessionContext?.labResults || [])
    .map((r) => `${r.label}: ${String(r.text || '').slice(0, 200)}`)
    .join('\n');
  if (labs) parts.push(`Lab / imaging proof:\n${labs}`);

  const discuss = sessionContext?.caseDiscussion;
  if (discuss && typeof discuss === 'object') {
    const d = JSON.stringify(discuss).slice(0, 800);
    if (d.length > 4) parts.push(`Case discussion context: ${d}`);
  }

  if (sessionContext?.standardFlow) {
    parts.push(`Teach Me standard flow: ${JSON.stringify(sessionContext.standardFlow).slice(0, 600)}`);
  }

  const moments = sessionContext?.teachingMoments || [];
  if (moments.length) {
    parts.push(
      `Learner-flagged teaching moments (MUST appear in story — mechanism beats, not footnotes):\n${moments
        .map((m) => {
          const head = m.orderLabel || m.prompt || 'Moment';
          return `- ${head}: ${String(m.answer || '').slice(0, 420)}`;
        })
        .join('\n')}`,
    );
  }

  return parts.length ? parts.join('\n\n') : '(no session activity yet — use case HPI only)';
}

export function buildCaseStoryNarrativePrompt({
  caseContext = {},
  sessionContext = {},
  orders = [],
  medicalSequence = null,
  characterLockMarkdown = '',
} = {}) {
  const orderBlock = orders
    .map(
      (o, i) =>
        `${i + 1}. [${o.teachingChannel || 'workup'}] ${o.label}${o.why ? ` — ${String(o.why).slice(0, 200)}` : ''}`,
    )
    .join('\n');

  const placed = Array.isArray(sessionContext?.stacksPlaced)
    ? sessionContext.stacksPlaced.map((s) => (typeof s === 'string' ? s : s.label || s.id)).join(', ')
    : '';

  const sessionBlock = formatSessionBlock(sessionContext);

  const caseId = caseContext?.id ?? caseContext?.ccsNumber ?? '';
  const mechanismBlock = buildMechanismTeachingPromptBlock(caseId);
  const lateralityBlock = buildLateralityPromptBlock(
    resolveLateralityLock({ caseId, caseContext, characterLockMarkdown }),
  );

  return [
    {
      role: 'system',
      content: STORYCRAFT_SYSTEM,
    },
    {
      role: 'user',
      content: `CASE
Title: ${caseContext.title || '—'}
Category: ${caseContext.category || '—'}
Diagnosis: ${String(caseContext.diagnosis || caseContext.clinical_tip || '').slice(0, 400)}
HPI: ${String(caseContext.hpiExcerpt || caseContext.clinical_hpi_narrative || caseContext.historyText || '').slice(0, 700)}
Vitals: ${String(caseContext.vitalsText || JSON.stringify(caseContext.vitals || {})).slice(0, 200)}
${mechanismBlock ? `\n${mechanismBlock}\n` : ''}
${lateralityBlock ? `\n${lateralityBlock}\n` : ''}

STANDARD FLOW ORDERS
${orderBlock || '(none)'}

LEARNER SESSION (compile story from this — attendant chat, patient replies, exam/lab proof, notes)
${sessionBlock}

Orders placed summary: ${placed || '(none yet)'}

${medicalSequence?.missedPath?.length ? `DETERIORATION PATH (if missed): ${medicalSequence.missedPath.map((b) => b.title).join(' → ')}` : ''}`,
    },
  ];
}

export function buildCaseStoryMasterImagePrompt({
  caseContext = {},
  narrative = {},
  portraitNote = '',
  characterLockMarkdown = '',
} = {}) {
  const visual =
    narrative.masterImagePrompt
    || `${caseContext.title || 'ED patient'} on stretcher, clinical distress appropriate to presentation`;
  const lockSection = buildCharacterLockPromptSection(characterLockMarkdown);
  const clinicalBlock = buildClinicalAccuracyPromptBlock({ scene: 'ed' });
  const lateralityBlock = buildLateralityPromptBlock(
    resolveLateralityLock({ caseId: caseContext?.id, caseContext, characterLockMarkdown }),
  );
  const gameStyleBlock = `${getGameEngineStylizationPassPromptBlock()}\n\n${getGameSceneCameraLockPromptBlock()}`;
  const likenessLine = lockSection.trim()
    ? 'CHARACTER LOCK likeness mandatory — sepia caricature identity from white-bg map overrides chart age/ethnicity in prose.'
    : `Patient lock: ${narrative.patientLock || portraitNote || 'match reference patient likeness exactly'}.`;

  return `${THIRD_PERSON_CAMERA}

${getForbiddenRenderStylePromptBlock()}

${gameStyleBlock}

${clinicalBlock}

${lateralityBlock ? `${lateralityBlock}\n\n` : ''}${visual}

${likenessLine}
${lockSection ? `\n${lockSection}\n` : ''}
${caseContext.category === 'Pediatrics' ? 'Pediatric body proportions — school-age child, NOT adult body.' : ''}
ONLY the patient on the stretcher — no standing staff on the bed, no extra feet at frame bottom.
Master still establishes character identity map for all storyboard beats.`;
}

export function deriveChapterVisualHint(chapter, { patientLock = '', caseContext = {} } = {}) {
  const hint = String(chapter?.visualHint || '').trim();
  if (hint) return hint;
  const heading = String(chapter?.heading || 'Beat').trim();
  const body = String(chapter?.body || '').slice(0, 180);
  const loc =
    caseContext?.category === 'Pediatrics'
      ? 'pediatric ED bay'
      : heading.toLowerCase().includes('home') || heading.toLowerCase().includes('disruption')
        ? 'home or ED arrival — match beat'
        : 'ED bay';
  return `${patientLock || 'same patient likeness'}, ${loc}, story beat "${heading}": ${body}`;
}

export function buildCaseStoryBeatImagePrompt({
  chapter = {},
  narrative = {},
  caseContext = {},
  portraitNote = '',
  characterLockMarkdown = '',
} = {}) {
  const visual = deriveChapterVisualHint(chapter, {
    patientLock: narrative.patientLock || portraitNote,
    caseContext,
  });
  const heading = String(chapter.heading || 'Beat').trim();
  const beatId = String(chapter.id || '').trim();
  const composition = beatCompositionDirective(beatId, { lockMarkdown: characterLockMarkdown });
  const lockSection = buildCharacterLockPromptSection(characterLockMarkdown, { beatsOnly: true });
  const homeBeat = isHomeStoryBeat(chapter);
  const cameraBlock = homeBeat ? HOME_SCENE_CAMERA : THIRD_PERSON_CAMERA;
  const clinicalBlock = buildClinicalAccuracyPromptBlock({
    scene: homeBeat ? 'home' : 'ed',
    beatId,
    chapter,
  });
  const lateralityBlock = buildLateralityPromptBlock(
    resolveLateralityLock({ caseId: caseContext?.id, caseContext, characterLockMarkdown }),
  );

  const gameStyleBlock = `${getGameEngineStylizationPassPromptBlock()}\n\n${getGameSceneCameraLockPromptBlock()}`;

  return `${cameraBlock}

${getForbiddenRenderStylePromptBlock()}

${gameStyleBlock}

${clinicalBlock}

${lateralityBlock ? `${lateralityBlock}\n\n` : ''}${homeBeat ? '' : `${COMPOSITION_VARIETY}\n\n`}STORYBOARD — "${heading}" (${beatId || 'beat'}): ${visual}

FRAMING: ${composition}

Patient: ${narrative.patientLock || portraitNote || 'match master likeness'}.
${lockSection ? `\n${lockSection}\n` : ''}
${caseContext.category === 'Pediatrics' ? 'Pediatric body proportions — school-age child, NOT adult body.' : ''}
MeWorld sculptural ${homeBeat ? 'domestic' : 'clinical'} still — one frozen moment from this beat. Match master reference likeness exactly.
${homeBeat ? 'Home interior — no hospital equipment.' : 'ONLY the patient (and implied family in depth if beat requires) — no clinician standing on the bed.'}`;
}

const GRID_PLATE_CAMERA = `2×3 STORYBOARD GRID PLATE (single image — six equal panels, thin dark gutters between cells):
- Layout: 2 rows × 3 columns reading left-to-right, top-to-bottom (panels numbered 1–6).
- Same patient likeness in every panel — continuity lock across the grid.
- Smart camera per panel — vary MCU, wide 3/4, over-shoulder, close on finding; NOT identical foot-of-bed angle on every cell. NOT bird's-eye overhead.
- MeWorld sculptural CGI — muted clinical palette, tactile fabric/skin, NO comic ink outlines, NO photoreal stock photography.
- NO paragraph text inside panels — optional tiny panel numbers 1–6 only.
- Each panel is one frozen story beat — rule-of-thirds within each cell.`;

/** One Magnific call — full session storyboard as 2×3 grid. */
export function buildCaseStoryGridPlatePrompt({
  chapters = [],
  narrative = {},
  caseContext = {},
  portraitNote = '',
  characterLockMarkdown = '',
} = {}) {
  const beats = (Array.isArray(chapters) ? chapters : []).slice(0, 6);
  if (beats.length < 6) {
    console.warn(`[case-story] Grid plate expects 6 chapters; got ${beats.length} — padding (regenerate narrative with prompt v${CASE_STORY_PROMPT_VERSION})`);
  }
  while (beats.length < 6) {
    const i = beats.length;
    beats.push({
      id: `pad${i + 1}`,
      heading: i === 5 ? 'Scene 6 — Plan together' : `Scene ${i + 1}`,
      body: narrative.synopsis || 'Same patient — maintain likeness and ED bay continuity.',
      visualHint: 'Same patient likeness — atmospheric bridge panel, no new characters',
    });
  }

  const panelLines = beats.map((ch, i) => {
    const hint = deriveChapterVisualHint(ch, {
      patientLock: narrative.patientLock || portraitNote,
      caseContext,
    });
    const heading = String(ch.heading || `Beat ${i + 1}`).trim();
    return `Panel ${i + 1}: ${heading} — ${hint.slice(0, 220)}`;
  });

  const lockSection = buildCharacterLockPromptSection(characterLockMarkdown);
  const clinicalBlock = buildClinicalAccuracyPromptBlock({ scene: 'ed' });
  const lateralityBlock = buildLateralityPromptBlock(
    resolveLateralityLock({ caseId: caseContext?.id, caseContext, characterLockMarkdown }),
  );
  const ped =
    caseContext.category === 'Pediatrics' || /pediatric|child|drown/i.test(String(caseContext.category))
      ? 'Pediatric body proportions — school-age child in every panel, NOT adult body.'
      : '';

  const gameStyleBlock = `${getGameEngineStylizationPassPromptBlock()}\n\n${getGameSceneCameraLockPromptBlock()}`;

  return `${GRID_PLATE_CAMERA}

${getForbiddenRenderStylePromptBlock()}

${gameStyleBlock}

${clinicalBlock}

${lateralityBlock ? `${lateralityBlock}\n\n` : ''}${panelLines.join('\n')}

Episode: ${narrative.title || caseContext.title || 'Case story'}.
Patient lock: ${narrative.patientLock || portraitNote || 'match reference likeness exactly'}.
${ped}
${lockSection ? `\n${lockSection}\n` : ''}
Render ONE image containing all six panels — cinematic case storyboard plate for MeWorld Case Story mode.`;
}

export function parseCaseStoryJson(raw) {
  const text = String(raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON in case story response');
  const parsed = JSON.parse(text.slice(start, end + 1));
  return {
    title: String(parsed.title || 'Case story').trim(),
    synopsis: String(parsed.synopsis || '').trim(),
    chapters: (Array.isArray(parsed.chapters) ? parsed.chapters : []).map((c, i) => ({
      id: String(c.id || `c${i + 1}`),
      heading: String(c.heading || 'Chapter').trim(),
      body: String(c.body || '').trim(),
      visualHint: String(c.visualHint || c.visual || '').trim(),
    })),
    masterImagePrompt: String(parsed.masterImagePrompt || '').trim(),
    patientLock: String(parsed.patientLock || '').trim(),
  };
}
