/**
 * Shared spoiler detection + HPI split for learner-facing presentation fixes.
 */

export const SPOILER_SENTENCE_PATTERNS = [
  /^Diagnosis:/i,
  /^(Differential )?Diagnosis is\b/i,
  /^Treatment:/i,
  /^Management:/i,
  /^Other causes:/i,
  /^Note:/i,
  /^Teaching:/i,
  /^The clinical picture is consistent with/i,
  /^This (presentation |case )?is consistent with/i,
  /^(This |These findings )?(are |is )?consistent with (a |an |new-onset )/i,
  /^Time is critical/i,
  /^The \d+ P'?s of\b/i,
  /^Importantly,? (this|he|she|they) ha[sd]/i,
  /^[A-Z][a-z]+ (trachomatis|pneumoniae|aureus|difficile|influenzae|meningitidis)\b.*\bis (the most common|an obligate|a gram)/i,
  /\bis the most common (bacterial|viral|fungal|cause of|STI|STD)\b/i,
  /\bis an obligate intracellular pathogen\b/i,
  /^Co-infection with\b/i,
  /^Most cases are asymptomatic\b/i,
  /^First-line diagnosis is\b/i,
  /^Empiric treatment (for|covers|targets)\b/i,
  /^(Hydroxyurea|Cholinesterase|Memantine|Donepezil|Rivastigmine)\b/i,
  /EMERGENCY (MRI|CT|neurosurgical|decompression|laminectomy)/i,
  /^Penicillin prophylaxis/i,
  /^Caregiver support/i,
  /^(Start|Begin|Initiate) (IV |oxygen|antibiotics|heparin|aspirin|insulin)/i,
  /^Admit to (inpatient|ICU|hospital)/i,
  /^\d+\.\s+(Start|Give|Administer|Order|Obtain|Initiate|Consider)\b/i,
  /^On exam:/i,
  /^Exam reveals\b/i,
  /^Stop [a-z]+ immediately/i,
  /^Full skin exam:/i,
  /\bresults from\b/i,
  /\bis a (life-threatening|neuroendocrine|chronic|autoimmune|medical)\b/i,
  /^Historically caused by\b/i,
  /^Do NOT\b/i,
  /^Most common:/i,
  /^Differential:/i,
  /^Workup:/i,
  /^Labs:/i,
  /^Immediate management:/i,
  /\bWells criteria\b/i,
  /\bVirchow's triad\b/i,
  /\bCentor criteria\b/i,
];

/** Inline HPI spoilers (case-insensitive phrases). */
export const HPI_INLINE_SPOILER =
  /\b(consistent with|hallmark of|pathophysiology|first-line treatment|gold standard|offending agent|stop now|classic \d[\s–-]\d|classic trigeminal neuralgia|On exam:|Stevens-Johnson|Nikolsky sign|BSA epidermal|Treatment:|Diagnosis:|Management:|is the most common|most common endocrine|ECG shows|EKG shows|previously undiagnosed sickle cell|dermatomal distribution|peau d'orange|peau d’orange|Family history of ADPKD|hemoglobinuria following)\b/i;

/** Short diagnosis acronyms — case-sensitive (avoid matching "Ten minutes"). */
export const HPI_DIAGNOSIS_ACRONYM = /\b(SJS|TEN|STEMI|NSTEMI|HbSS)\b/;

export const EXAM_INFERENCE_PATTERNS = [
  /no acute surgical abdomen/i,
  /\bnot TEN\b/i,
  /\bnot SSSS\b/i,
  /\(SJS[^)]*\)/i,
  /\bconsistent with\b/i,
  /\brules out\b/i,
  /\bpathognomonic\b/i,
  /\bgold standard\b/i,
  /\bdiagnosis is\b/i,
  /Nikolsky/i,
  /\bBSA\b.*%/i,
  /epidermal detachment/i,
  /\bno tamponade\b/i,
  /\bno pyelo\b/i,
];

export function splitSentences(text) {
  const results = [];
  const re = /(?<=[.!?])\s+(?=[A-Z])/g;
  let prev = 0;
  for (const m of String(text || '').matchAll(re)) {
    results.push({ text: text.slice(prev, m.index + 1), start: prev });
    prev = m.index + m[0].length;
  }
  results.push({ text: text.slice(prev), start: prev });
  return results;
}

export function findSpoilerStart(text) {
  if (!text) return -1;
  for (const { text: s, start } of splitSentences(text)) {
    if (SPOILER_SENTENCE_PATTERNS.some((p) => p.test(s.trim()))) {
      return start;
    }
  }
  return -1;
}

export function splitAtSpoiler(text) {
  if (!text) return { clean: text, teaching: '' };
  const idx = findSpoilerStart(text);
  if (idx === -1) return { clean: text, teaching: '' };
  const clean = text.slice(0, idx).replace(/[.,;:]\s*$/, '.').trim();
  const teaching = text.slice(idx).trim();
  return { clean, teaching };
}

export function sanitizeExamFinding(text = '') {
  let t = String(text).trim();
  if (!t) return t;

  t = t.replace(/\s*[—–-]\s*pathognomonic[^.]*\.?/gi, '.');
  t = t.replace(/\([^)]*pathognomonic[^)]*\)/gi, '');
  t = t.replace(/\([^)]*rules out[^)]*\)/gi, '');
  t = t.replace(/,?\s*no CVA tenderness[^.]*\.?/gi, '.');
  t = t.replace(/\.?\s*No muffled heart sounds[^.]*\.?/gi, '.');
  t = t.replace(/\s*[—–-]\s*no acute surgical abdomen\.?/gi, '.');
  t = t.replace(/,?\s*no acute surgical abdomen\.?/gi, '.');
  t = t.replace(/\.?\s*not TEN[^.]*\.?/gi, '.');
  t = t.replace(/\.?\s*not SSSS[^.]*\.?/gi, '.');
  t = t.replace(/\(SJS[^)]*\)/gi, '');
  t = t.replace(/\(<?10% BSA\)/gi, '');
  t = t.replace(/Acutely ill appearance consistent with [^.]+\./gi, 'Ill-appearing; moderate distress.');
  t = t.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
  return t;
}

export function stripInlineHpiSpoilers(text = '') {
  let t = String(text || '').trim();
  if (!t) return t;
  const cutPatterns = [
    /\.\s*(?:ECG|EKG)\s+shows\b[\s\S]*/i,
    /\bconsistent with\b[\s\S]*/i,
    /;\s*Initiate ACS protocol\b[\s\S]*/i,
    /\bPain follows dermatomal\b[\s\S]*/i,
    /\bTreatment:\b[\s\S]*/i,
    /\bDiagnosis:\b[\s\S]*/i,
    /\bManagement:\b[\s\S]*/i,
  ];
  for (const re of cutPatterns) {
    t = t.replace(re, '.').trim();
  }
  t = t.replace(/\s+with previously undiagnosed sickle cell disease\s*\(HbSS\)/gi, '');
  t = t.replace(/\bpreviously undiagnosed sickle cell disease\s*\(HbSS\)\b/gi, '');
  t = t.replace(/\bpreviously undiagnosed sickle cell disease\b/gi, '');
  t = t.replace(/\bclassic trigeminal neuralgia\s*[—–-]\s*/gi, '');
  t = t.replace(/\bin one area of the trigeminal nerve distribution\b/gi, 'in one area of the face');
  t = t.replace(/\(hemoglobinuria\)\s*following exposure\b[\s\S]*/i, '');
  t = t.replace(/\(peau d'orange\)/gi, '');
  t = t.replace(/\(peau d’orange\)/gi, '');
  t = t.replace(/\.\s*PCOS is\b[\s\S]*/i, '.');
  t = t.replace(/\.\s*[A-Z][A-Za-z ()]{2,40} is the most common\b[\s\S]*/i, '.');
  t = t.replace(/\bFamily history of ADPKD\b[^.]*\.?/gi, '');
  t = t.replace(/\bautosomal dominant polycystic kidney disease\b/gi, 'polycystic kidney disease');
  t = t.replace(/\bacute low back pain radiating down the leg \(sciatica\)/gi, 'acute low back pain radiating down the leg');
  t = t.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
  return t;
}

export function hpiFieldHasSpoiler(text = '') {
  const t = String(text || '').trim();
  if (!t) return false;
  if (HPI_INLINE_SPOILER.test(t)) return true;
  if (HPI_DIAGNOSIS_ACRONYM.test(t)) return true;
  return findSpoilerStart(t) !== -1;
}

export function extractPracticeHpi(text = '') {
  const prepped = stripInlineHpiSpoilers(String(text || '').trim());
  const sentences = splitSentences(prepped)
    .map((s) => s.text.trim())
    .filter(Boolean);
  const kept = [];
  for (const s of sentences) {
    if (SPOILER_SENTENCE_PATTERNS.some((p) => p.test(s))) break;
    if (HPI_INLINE_SPOILER.test(s) || HPI_DIAGNOSIS_ACRONYM.test(s)) break;
    kept.push(s);
  }
  return kept.join(' ').trim();
}

export function examHasInference(text = '') {
  return EXAM_INFERENCE_PATTERNS.some((p) => p.test(text));
}
