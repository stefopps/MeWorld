import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

let cachedBundle = null;

function loadBundle() {
  if (cachedBundle) return cachedBundle;
  const file = path.join(ROOT, 'src/data/mechanismTeaching.json');
  cachedBundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  return cachedBundle;
}

function normalizeCaseId(caseId) {
  const raw = String(caseId ?? '').trim();
  if (!raw) return '';
  const digits = raw.replace(/^case_/i, '').replace(/^0+/, '') || raw.replace(/^case_/i, '');
  return /^\d+$/.test(digits) ? digits.padStart(3, '0') : raw;
}

/** Storycraft + mechanism preflight — prepended before every DeepSeek attendant pass. */
export function buildStorycraftMechanismPreflight() {
  return `## STORYCRAFT + MECHANISM PREFLIGHT (mandatory — run mentally before you write)

Before answering, apply the **Explanation Stack** (mechanism → spatial physics → connect findings → clinical anchor).

**Patient anchor (first attending beat only):** On the **first** order rationale in a Teach Me session, ground the learner with demographics plus **current vitals numbers** from CASE JSON / patientAnchor. On **every later order** in the same case, the learner already knows who is on the monitor — **do not** repeat the full name + vitals line ("Let's look at Mr. X — BP…"). Use he/she/this child, or jump straight to mechanism. Cite a vital number only when **this specific order** turns on that number (e.g. lactate for sepsis workup, SpO₂ for hypoxia).

**Relevance gate (non-negotiable):** If you open any other idea — alternate injury pattern, anatomy, complication, or "also remember" beat — it must be **relevant to this patient** (age, sex, injury site, vitals, HPI, time course). Do not import textbook tangents that do not apply (e.g. face/neck airway compromise when the bite is forearm; pediatric drowning cues on an adult; rabies prodrome lecture before ABCs when he is hypoxic and septic now). When a classic teaching point does not fit, **omit it** — do not mention it "for completeness."

Storycraft Scale gates (internal — do not print scores):
- **D3 Storyworld coherence:** every claim must follow cause-and-effect physics in this case.
- **D6 Sequence logic:** each sentence must force the next ("because" / "so" — not a feature list).
- **D2 Qualia:** one embodied image when it teaches (impact, tension, pressure, cold water).

Default mode is **first-principles linking** — not guideline recitation. If an order is discussed, trace it to the injury mechanism in THIS case.

Never open with "This patient has a history of…" — open with what forces the finding or order.`;
}

export function getMechanismTeachingForCase(caseId) {
  const id = normalizeCaseId(caseId);
  if (!id) return null;
  const row = loadBundle().cases?.[id] || loadBundle().cases?.[String(Number(id))];
  if (!row) return null;
  return row;
}

export function getOrderMechanismHint(caseId, orderIdOrLabel = '') {
  const row = getMechanismTeachingForCase(caseId);
  if (!row?.managementLinks) return '';
  const key = String(orderIdOrLabel ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9/-]/g, '');
  const links = row.managementLinks;
  if (links[key]) return links[key];
  const label = String(orderIdOrLabel ?? '').toLowerCase();
  for (const [k, v] of Object.entries(links)) {
    if (label.includes(k.replace(/-/g, ' ')) || k.replace(/-/g, ' ').includes(label)) return v;
  }
  return '';
}

/** Runtime block for attendant system prompt. */
export function buildMechanismTeachingPromptBlock(caseId) {
  const row = getMechanismTeachingForCase(caseId);
  if (!row) return '';

  const beats = (row.physicsBeats || []).map((b) => `- ${b}`).join('\n');
  const linkLines = Object.entries(row.managementLinks || {})
    .map(([k, v]) => `- **${k.replace(/-/g, ' ')}:** ${v}`)
    .join('\n');
  const anchor = row.patientAnchor;
  const anchorBlock = anchor
    ? `
**Patient anchor (cite in your opening):**
- **Who:** ${anchor.demographics || '—'}
- **Injury site:** ${anchor.injurySite || '—'}
- **Vitals on arrival:** ${anchor.vitals || '—'}`
    : '';

  return `
### MECHANISM ANCHOR (this case — teach from here; link every order back to this physics)

**Injury mechanism:** ${row.injuryMechanism || '—'}
${row.teachingHook ? `\n**Teaching hook:** ${row.teachingHook}\n` : ''}${anchorBlock}
**Physics sequence:**
${beats || '(see injury mechanism)'}

**Order ↔ mechanism links (use when explaining management):**
${linkLines || '(link orders to submersion + impact physics)'}`;
}
