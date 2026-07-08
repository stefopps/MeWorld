/** Build LLM prompt for case medical-sequence storyboard (prequel / missed / saved). */

import { sequenceFailsDemographicsCheck } from '../src/lib/medicalSequenceValidate.js';

export const MEDICAL_SEQUENCE_PROMPT_VERSION = 3;

/** Reject cached LLM output that applied AMS/alcohol template to drowning cases. */
export function sequenceFailsDrowningContentCheck(parsed, caseContext = {}) {
  const blob = `${caseContext.title || ''} ${caseContext.diagnosis || ''} ${caseContext.presentationKey || ''} ${caseContext.hpiExcerpt || caseContext.clinical_hpi_narrative || caseContext.historyText || ''}`.toLowerCase();
  if (!/drown|submersion|near-drown|water rescue/.test(blob)) return false;
  const beats = [...(parsed?.prequel || []), ...(parsed?.missedPath || []), ...(parsed?.savedPath || [])];
  const text = beats.map((b) => `${b.title || ''} ${b.caption || ''}`).join(' ').toLowerCase();
  return /alcohol|tox screen|toxicology|weeks of decline|seizure|post.?ictal|metabolic\/tox/.test(text);
}

export function caseDataStubFromContext(caseContext = {}, caseId = '') {
  return {
    id: caseId,
    title: caseContext.title,
    category: caseContext.category,
    hpi_narrative:
      caseContext.hpiExcerpt ||
      caseContext.clinical_hpi_narrative ||
      caseContext.historyText ||
      '',
    patientSex: caseContext.patientSex,
    diagnosis: caseContext.diagnosis,
    presentationKey: caseContext.presentationKey,
  };
}

export function assertMedicalSequenceDemographics(parsed, caseContext, caseId) {
  const stub = caseDataStubFromContext(caseContext, caseId);
  if (sequenceFailsDemographicsCheck(parsed, stub)) {
    throw new Error('Medical sequence failed demographics validation');
  }
  return parsed;
}

export function buildMedicalSequencePrompt({
  caseContext = {},
  orders = [],
  realWorldStories = [],
  portraitNote = '',
} = {}) {
  const orderBlock = orders
    .map(
      (o, i) =>
        `${i + 1}. [${o.id}] ${o.label}\n   Attendant why: ${String(o.why || o.playbookWhy || '').slice(0, 900)}`,
    )
    .join('\n\n');

  const rwBlock = realWorldStories
    .slice(0, 2)
    .map((s) => `- ${s.name}: ${String(s.summary || s.headline || '').slice(0, 400)}`)
    .join('\n');

  return [
    {
      role: 'system',
      content: `You are a clinical storyboard director for MeWorld emergency medicine training.

Given case context and attendant explanations for each order, produce a **medical sequence** — a visual storyboard of what happened before the ED and what would happen if critical orders were missed vs placed in time.

Rules:
- **Demographics lock (mandatory):** Read age/sex from case HPI and category. Adults (≥13y) never appear as infants — no wet diapers, bottles, "mom's arms" for a 70-year-old. Pediatric beats only for Pediatrics / age <13.
- Use attendant **mechanism** from order rationales (Immersa explainer voice) — tie missed/saved beats to specific orders.
- Same patient likeness throughout (age, sex, ethnicity from case).
- **prequel**: 2–4 beats at home / before arrival — must match chief complaint. **Drowning/submersion:** water rescue, wet patient, EMS oxygen — NEVER weeks-of-decline AMS, alcohol, or tox-screen beats. **AMS:** weeks of decline + seizure only when NOT drowning.
- **missedPath**: one beat per standard-flow order (3–6) — **patient consequence while the order waits**, NOT lab jargon alone. Example (porphyria): urine porphyrins delayed → porphyrins keep building in skin, blisters worsen near light; plasma porphyrins delayed → circulating load keeps rising; HCV/HIV/iron delayed → silent infection or iron overload may stay hidden. Title pattern: "{Order} delayed".
- **savedPath**: mirror missed beats — **visible improvement** when each order lands on time (levels drop, patient calmer, trigger found).
- **realWorldEcho**: one optional real-world teaching parallel if stories provided.
- **visualHint (mandatory):** describe what the patient looks like RIGHT NOW — smart camera angle per beat (MCU, wide 3/4, close on lesion) + MeWorld sculptural CGI clinical still. **Never** repeat only the patientLock string or "ED stretcher, clinical stress".
- **caption:** mechanism in patient language — what they feel/see at the bedside. No memorization lists.
- Do NOT invent impossible anatomy.

Return ONLY valid JSON (no markdown fence):
{
  "patientLock": "string — age, sex, setting, likeness lock for image gen",
  "prequel": [{ "id": "p1", "title": "", "caption": "", "visualHint": "" }],
  "missedPath": [{ "id": "m1", "title": "", "caption": "", "visualHint": "", "tiedOrderId": "", "tiedOrderLabel": "" }],
  "savedPath": [{ "id": "s1", "title": "", "caption": "", "visualHint": "", "tiedOrderId": "" }],
  "realWorldEcho": { "name": "", "summary": "" }
}`,
    },
    {
      role: 'user',
      content: `CASE
Title: ${caseContext.title || '—'}
Category: ${caseContext.category || '—'}
Diagnosis pearl: ${String(caseContext.diagnosis || caseContext.clinical_tip || '').slice(0, 500)}
HPI: ${String(caseContext.hpiExcerpt || caseContext.clinical_hpi_narrative || caseContext.historyText || '').slice(0, 800)}
Vitals: ${String(caseContext.vitalsText || JSON.stringify(caseContext.vitals || {})).slice(0, 200)}
${portraitNote ? `Portrait lock: ${portraitNote}` : ''}

STANDARD FLOW ORDERS + ATTENDANT RATIONALE
${orderBlock || '(none)'}

REAL WORLD STORIES (optional echo)
${rwBlock || '(none)'}`,
    },
  ];
}

export function parseMedicalSequenceJson(raw) {
  const text = String(raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in model response');
  const parsed = JSON.parse(text.slice(start, end + 1));
  const normBeats = (arr) =>
    (Array.isArray(arr) ? arr : []).map((b, i) => ({
      id: String(b.id || `beat-${i + 1}`),
      title: String(b.title || 'Beat').trim(),
      caption: String(b.caption || '').trim(),
      visualHint: String(b.visualHint || b.visual || '').trim(),
      tiedOrderId: b.tiedOrderId ? String(b.tiedOrderId) : '',
      tiedOrderLabel: b.tiedOrderLabel ? String(b.tiedOrderLabel) : '',
    }));
  return {
    patientLock: String(parsed.patientLock || '').trim(),
    prequel: normBeats(parsed.prequel),
    missedPath: normBeats(parsed.missedPath),
    savedPath: normBeats(parsed.savedPath),
    realWorldEcho: parsed.realWorldEcho
      ? {
          name: String(parsed.realWorldEcho.name || '').trim(),
          summary: String(parsed.realWorldEcho.summary || '').trim(),
        }
      : null,
  };
}
