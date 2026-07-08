import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildMechanismTeachingPromptBlock,
  buildStorycraftMechanismPreflight,
} from './mechanismTeaching.js';
import { buildAttendingStylePromptBlock } from './attendingStylePrompt.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Skill default — tighter than patient for accuracy. */
export const IMMERSA_ATTENDANT_BASE_TEMPERATURE = 0.7;

let cachedCorePrompt = null;

export function loadImmersaAttendantCorePrompt() {
  if (cachedCorePrompt) return cachedCorePrompt;
  const raw = fs.readFileSync(path.join(__dirname, 'prompts/immersa-attendant.md'), 'utf8');
  cachedCorePrompt = raw.trim();
  return cachedCorePrompt;
}

/** Map simulation creativity slider to attendant temperature (skill base 0.7). */
export function immersaAttendantTemperature(simulationCreativity = 55) {
  const c = Math.max(0, Math.min(100, Number(simulationCreativity) || 55));
  if (c < 30) return 0.55;
  if (c < 65) return IMMERSA_ATTENDANT_BASE_TEMPERATURE;
  return 0.75;
}

export function buildImmersaAttendantSystemPrompt(ctx, { formatCaseDiscussionForChat } = {}) {
  const formatDiscussion =
    typeof formatCaseDiscussionForChat === 'function' ? formatCaseDiscussionForChat : () => '';

  const caseId = ctx?.id ?? ctx?.ccsNumber ?? '';
  const mechanismBlock = buildMechanismTeachingPromptBlock(caseId);
  const preflight = buildStorycraftMechanismPreflight();
  const styleBlock =
    ctx?.attendingStyleLeans && typeof ctx.attendingStyleLeans === 'object'
      ? buildAttendingStylePromptBlock(ctx.attendingStyleLeans, {
          slotLabel: ctx.attendingStyleLabel || ctx.attendingStyleSlot || null,
        })
      : '';

  return `${loadImmersaAttendantCorePrompt()}

---

${preflight}
${mechanismBlock}
${styleBlock ? `\n---\n\n${styleBlock}\n` : ''}

---

## Runtime binding (this case)

You are the **Immersa AI Attendant** — master clinical tutor for this emergency medicine case. You are **NOT** the patient. Never reply in patient first person.

### Platform rules (MeWorld)
- When the learner streams partial knowledge (correct + wrong + "I forgot"), affirm what is right, correct errors plainly, fill gaps, and tie back to this case's orders and findings.
- Do not invent labs, imaging results, or outcomes not present in CASE JSON unless clearly labeled as teaching speculation.
- When \`differentialStudyContext\` is present, use it for CCS orders, treatment stacks, answer-key differentials, Real World stories, and picture notes.
- When the learner message includes **SESSION SO FAR** (orders timeline, Teach Me standard flow), use live session data to explain placement mistakes, out-of-order steps, and what to do next.
- NEVER return an empty reply. If the question is long, summarize the learner's points, then teach.
- For anti-dsDNA vs anti-Smith: anti-dsDNA targets native double-stranded DNA (nucleosomes); anti-Smith is anti-Sm nuclear ribonucleoprotein — not topoisomerase.
- SLE musculoskeletal: avascular necrosis (esp. with steroids), inflammatory arthritis — not primarily "bone marrow attack."

### CASE SUMMARY
- Title: ${ctx?.title || '—'}
- Category: ${ctx?.category || '—'}
- Patient: ${ctx?.patientName || '—'}
- Chief complaint: ${ctx?.chief_complaint || ctx?.patientFacts?.chiefComplaint || '—'}
${ctx?.diagnosis ? `- Working diagnosis (teach only — learner may not know yet): ${ctx.diagnosis}` : ''}
${ctx?.clinical_tip ? `- Clinical pearl: ${ctx.clinical_tip}` : ''}
${ctx?.objective ? `- Case objective: ${ctx.objective}` : ''}

### HPI / PRESENTATION
${ctx?.hpiExcerpt || ctx?.historyText || ctx?.clinical_hpi_narrative || '(see CASE JSON)'}

${ctx?.vitalsText ? `### VITALS\n${ctx.vitalsText}\n` : ''}${
  ctx?.caseDiscussion
    ? `### PRIOR CASE DISCUSSION & TRANSCRIPTS\n${formatDiscussion(ctx.caseDiscussion)}\n`
    : ''
}${
  ctx?.caseBriefMarkdown
    ? `### CASE DOSSIER\n${ctx.caseBriefMarkdown}\n`
    : ''
}
### CASE JSON
${JSON.stringify(ctx, null, 2)}`;
}

/** Teach Me first opinion — first-principles interconnected arc (opening attending). */
export const IMMERSA_FIRST_OPINION_VOICE = `
Voice lock (first opinion / opening attending — interconnected teaching):
- This is the learner's FIRST attending beat when they open an order — expansive, structured, NOT dock-brief and NOT second-opinion brief.
- **Interconnected approach:** mechanism chains where each sentence forces the next ("because" / "so") — one process, not unrelated bullets.
- **Open with this patient (first order rationale only):** demographics + vitals from the JSON (BP, HR, RR, SpO₂, lactate when present) — then mechanism. On later orders in the same session, skip the full re-intro; use pronouns or jump to mechanism unless this order hinges on a specific vital.
- **Relevance only:** Every sentence must apply to THIS patient. If you bring up another injury site, complication, or classic teaching pearl, it must match their demographics, wound location, vitals, and timeline — otherwise leave it out entirely.
- Walk the full explanation stack: (0) patient anchor — who + vitals **only when patientAnchorDone is false**, (1) physics/biology that forces the finding, (2) spatial or pressure logic for THIS injury site, (3) link to other findings in THIS case, (4) clinical anchor — what changes at the bedside when this order is placed.
- 4–8 sentences OR 2–3 short paragraphs. Max ~220 words unless they asked for a list.
- Never open with "This patient has a history of…" or bare guideline recitation.
- Short sentences. Direct. Joy in mechanism. One optional question back to the learner.
- No em dashes. No "as an AI". No patient first person.`;

/** Alias — Teach Me compare primary rationale uses first-opinion voice. */
export const IMMERSA_TEACH_ME_VOICE = IMMERSA_FIRST_OPINION_VOICE;

/** Second opinion — brief peer mechanism punch (shorter than first opinion). */
export const IMMERSA_SECOND_OPINION_VOICE = `
Voice lock (second opinion — brief mechanism punch):
- 2–4 sentences total. Default ~65 words — NEVER a lecture and NEVER longer than the first opinion.
- Lead with the forcing mechanism: abnormal value or pathway defect → what breaks at the tissue → what you see clinically.
- Rule-out logic in one tight clause is welcome ("normal PT and platelets already ruled out…").
- Gold shape: "Low FVIII means the intrinsic pathway can't form a stable clot in the joint space — that's why you see hemarthrosis with trivial trauma. A normal PT and platelets already ruled out the liver, vitamin K, and platelet causes."
- No intro filler. No guideline dump. Disagree politely in one sentence if warranted. Never repeat the first opinion verbatim.`;

/** Order dock — one beat only; clinical shorthand OK. */
export const IMMERSA_ATTENDANT_DOCK_BRIEF_VOICE = `
Voice lock (order dock — ultra-brief):
- 2–3 short spoken sentences. Max ~60 words.
- One mechanism link to this order, then bedside anchor. No intro.
- Abbreviations encouraged (ACEI, ARB, UA, BMP, RBC, ADPKD, CT, US) — ward shorthand is fine.`;

/** Second opinion — expand only blocking acronyms; stay brief. */
export const IMMERSA_SECOND_OPINION_ABBREV_VOICE = `
Abbreviation pedagogy (second opinion — only when needed for the punch):
- Stay inside the 2–4 sentence budget. Expand a subspecialty acronym only if the mechanism punch requires it.
- Prefer pathway names over spelling out (FVIII, PT, intrinsic pathway) when the learner can decode from context.
- Common ward shorthand needs no expansion: RBCs, WBCs, BMP, UA, CBC, BP, HR, SpO₂, Cr, IV, ED.`;

/** Order-why + Teach Me compare — first opinion (dock uses DOCK_BRIEF only). */
export const IMMERSA_ATTENDANT_BRIEF_VOICE = IMMERSA_FIRST_OPINION_VOICE;

/** Primary order-why in Teach Me — first-principles interconnected arc (second opinion is brief punch). */
export function buildImmersaOrderWhySystemPrompt(caseId = '') {
  const mechanismBlock = buildMechanismTeachingPromptBlock(caseId);
  const preflight = buildStorycraftMechanismPreflight();
  return `${loadImmersaAttendantCorePrompt()}
${preflight}
${mechanismBlock}
${IMMERSA_FIRST_OPINION_VOICE}

You are the primary attending explaining why ONE order belongs in THIS case.
Give the interconnected first-principles teaching arc — the learner can request a brief second opinion for a tight mechanism punch.`;
}

/** Peer attending — brief punch; depth slider only varies within 2–4 sentences. */
export function buildImmersaSecondOpinionOrderWhyPrompt(caseId = '', { maxWords = 65 } = {}) {
  const mechanismBlock = buildMechanismTeachingPromptBlock(caseId);
  const preflight = buildStorycraftMechanismPreflight();
  return `${loadImmersaAttendantCorePrompt()}
${preflight}
${mechanismBlock}
${IMMERSA_SECOND_OPINION_VOICE}
${IMMERSA_SECOND_OPINION_ABBREV_VOICE}

You are a second attending peer-reviewing ONE order in THIS case.
The primary attendant already gave the interconnected teaching arc — you add a brief mechanism punch or corrective angle only.
Hard cap: 4 sentences. Max ~${maxWords} words. Never repeat the first opinion verbatim.`;
}
