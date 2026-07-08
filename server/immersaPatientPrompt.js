import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatPersonaForChat } from './casePortrait.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Skill default — higher than tutor for human variation. */
export const IMMERSA_PATIENT_BASE_TEMPERATURE = 0.85;

let cachedCorePrompt = null;

export function loadImmersaPatientCorePrompt() {
  if (cachedCorePrompt) return cachedCorePrompt;
  const raw = fs.readFileSync(path.join(__dirname, 'prompts/immersa-patient.md'), 'utf8');
  cachedCorePrompt = raw.trim();
  return cachedCorePrompt;
}

/** Map simulation creativity slider to patient temperature (skill base 0.85). */
export function immersaPatientTemperature(simulationCreativity = 55) {
  const c = Math.max(0, Math.min(100, Number(simulationCreativity) || 55));
  if (c < 30) return 0.72;
  if (c < 65) return IMMERSA_PATIENT_BASE_TEMPERATURE;
  return 0.88;
}

function pickMisleadingPositives(facts = {}) {
  const noise = [];
  if (facts.travel && !/no recent travel/i.test(facts.travel)) noise.push(facts.travel);
  if (facts.smoking && !/never/i.test(facts.smoking)) noise.push(facts.smoking);
  return noise;
}

/** Case profile block from skill — diagnosis only when present in ctx (learning mode strips it). */
export function buildPatientProfileBlock(ctx = {}) {
  const facts = ctx.patientFacts || {};
  const demo = ctx.patientDemographics || {};
  return {
    name: ctx.patientName || facts.name || null,
    age: demo.ageLabel || facts.ageLabel || null,
    gender: facts.sex || ctx.patientSex || null,
    chiefComplaint: facts.chiefComplaint || ctx.chief_complaint || ctx.title || null,
    hiddenDiagnosis: ctx.diagnosis || null,
    symptomHistory: ctx.hpiExcerpt || ctx.historyText || null,
    keyPositiveFindings:
      'Surface only when asked — draw from symptomHistory in lay language; do not name diagnoses.',
    keyNegativeFindings: 'Answer truthfully when asked (e.g. denies chest pain if not in history).',
    misleadingPositives: pickMisleadingPositives(facts),
    emotionalContext:
      ctx.patientVoice?.chief_complaint ||
      (typeof ctx.patientVoice?.history === 'string'
        ? ctx.patientVoice.history.slice(0, 240)
        : null),
    isPediatric: demo.isPediatric || facts.isPediatric || false,
    speakAsChild: demo.speakAsChild || facts.speakAsChild || false,
  };
}

export function buildImmersaPatientSystemPrompt(ctx, { formatCaseDiscussionForChat } = {}) {
  const name = ctx?.patientName || 'the patient';
  const profile = buildPatientProfileBlock(ctx);
  const formatDiscussion =
    typeof formatCaseDiscussionForChat === 'function' ? formatCaseDiscussionForChat : () => '';

  return `${loadImmersaPatientCorePrompt()}

---

## Runtime binding (this case)

You ARE ${name} in the emergency department. The learner is interviewing you.

### Output format (mandatory — violations break the UI)
- Reply with ONLY the words you say aloud. No asterisks, parentheses, stage directions, or bullet lists.
- If the learner uses medical jargon you do not understand, respond in plain language ("I don't know what that means, but…").
- When asked your age, use patientDemographics.ageLabel exactly.
- If isPediatric/speakAsChild, you are a child — never claim an adult age.
- NEVER say "not documented", "JSON", "simulation", or read chart labels aloud.
- For tests not done yet: "They haven't told me those results yet."

### PATIENT PROFILE (ground truth — Law 2: reveal only when asked)
${JSON.stringify(profile, null, 2)}

### PATIENT DEMOGRAPHICS
${JSON.stringify(ctx?.patientDemographics || {}, null, 2)}

### PATIENT FACTS
${JSON.stringify(ctx?.patientFacts || {}, null, 2)}
${
  ctx?.patientVoice
    ? `
### PATIENT VOICE (tone cues)
${JSON.stringify(ctx.patientVoice, null, 2)}
`
    : ''
}${
  ctx?.patientPersona
    ? `
### APPEARANCE (stay consistent — do not narrate gestures)
${formatPersonaForChat(ctx.patientPersona)}
`
    : ''
}
### SYMPTOM HISTORY (lay-language source — do not dump all at once)
${ctx?.hpiExcerpt || ctx?.historyText || '(see profile.symptomHistory)'}
${
  ctx?.caseDiscussion
    ? `
### PRIOR CONVERSATION ON THIS CASE (stay consistent)
${formatDiscussion(ctx.caseDiscussion)}
`
    : ''
}${
  ctx?.caseBriefMarkdown
    ? `
### CASE DOSSIER (reference only — never read aloud)
${ctx.caseBriefMarkdown}
`
    : ''
}
When the learner message includes SESSION SO FAR, you may reference what already happened in this visit — still in patient voice.

### CASE CHART (for consistency — you are the patient, not the chart)
${JSON.stringify(ctx, null, 2)}`;
}
