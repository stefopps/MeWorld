/**
 * Physical exam resolution — presentation bank → HPI-derived → vitals-based.
 * Avoids generic category boilerplate when case bank text is available.
 */

const GENERIC_FINDINGS = new Set([
  'Altered interaction or focal neurologic concern',
  'Rate and rhythm reflect stress response',
  'Protect airway if decreased mentation',
  'Non-focal unless alternate source',
  'Mental status and focal deficits guide urgency',
  'No rash unless infectious etiology suspected',
  'Acutely ill appearance consistent with presentation',
  'Hemodynamics match parsed vitals',
  'Work of breathing matches chief complaint',
  'Targeted exam for red-flag sources',
  'Mental status appropriate to case',
  'Perfusion and temperature align with vitals',
  'Distressed, speaking in short phrases',
  'Tachycardic; assess for murmurs and JVD',
  'Increased work of breathing',
  'Soft, non-distended',
  'Alert unless hypoperfused',
  'Diaphoretic; perfusion varies with stability',
  'Soft, non-distended, no focal peritoneal signs on initial exam.',
  'Alert and oriented unless perfusion or metabolic derangement present.',
  'No acute rash; capillary refill and perfusion assessed.',
  'Exam findings reflect presentation acuity on arrival.',
  'Skin rash morphology and distribution documented.',
  'Abdominal tenderness pattern matches history; no rigid abdomen documented yet.',
]);

const GENERIC_FINDING_PATTERNS = [
  /^soft, non-distended, no focal peritoneal signs/i,
  /^alert and oriented unless perfusion/i,
  /^no acute rash; capillary refill/i,
  /^exam findings reflect presentation acuity/i,
];

/** Authored per-case exams (cases with captured CCS depth). */
export const AUTHORED_CASE_EXAMS = {
  '001': [
    ['General', 'Diaphoretic and anxious, clutching chest'],
    ['Cardiovascular', 'Tachycardic, regular rhythm, no new murmur'],
    ['Respiratory', 'Mild tachypnea, bibasilar crackles absent'],
    ['Abdomen', 'Soft, non-tender'],
    ['Neuro', 'Alert and oriented'],
    ['Skin', 'Cool clammy extremities'],
  ],
  '002': [
    ['General', 'Somnolent, intermittently arousable'],
    ['Cardiovascular', 'Tachycardic with delayed capillary refill'],
    ['Respiratory', 'Compensatory tachypnea'],
    ['Abdomen', 'Soft, no rebound or guarding'],
    ['Neuro', 'Confused, follows simple commands; gait unsteady after recent fall'],
    ['Skin', 'Warm with mild diaphoresis'],
  ],
  '003': [
    ['General', 'Uncomfortable, guarding lower abdomen'],
    ['Cardiovascular', 'Tachycardic with borderline hypotension'],
    ['Respiratory', 'Non-labored breathing'],
    ['Abdomen', 'Suprapubic and unilateral lower quadrant tenderness'],
    ['Neuro', 'Alert but distressed'],
    ['Skin', 'Pale, slightly diaphoretic'],
  ],
  '116': [
    ['General', 'Febrile, fatigued, and concerned; appears mildly ill but hemodynamically stable.'],
    ['Cardiovascular', 'HR 88; BP 135/84.'],
    ['Respiratory', 'RR 18; SpO₂ 96%.'],
    ['Abdomen', 'Soft, non-tender; no peritoneal signs.'],
    [
      'Neuro',
      'Occipital headache; mild vertigo; unsteady gait with veering and near-falls; cranial nerves intact; no meningismus on initial survey.',
    ],
    [
      'Skin',
      'No active rash today; resolved pink macular rash on arms and torso per history (~8 days ago); faint residual patches on upper arms only.',
    ],
  ],
  '086': [
    ['General', 'Hypertensive; uncomfortable with flank pain; ill-appearing but stable.'],
    ['Cardiovascular', 'HR 98; BP 162/98.'],
    ['Respiratory', 'RR 19; SpO₂ 95%.'],
    ['Abdomen', 'Palpable bilateral flank masses; no peritoneal signs.'],
    ['Neuro', 'Alert and oriented.'],
    ['Skin', 'No acute rash; perfusion adequate.'],
  ],
};

/** Presentation-title exams synced with captured CCS playbooks. */
export const PRESENTATION_EXAMS = {
  'Chest Pain': AUTHORED_CASE_EXAMS['001'],
  'Altered Mental Status': AUTHORED_CASE_EXAMS['002'],
  'Pelvic Pain': AUTHORED_CASE_EXAMS['003'],
  'Abdominal Pain': [
    ['General', 'Ill-appearing, diaphoretic, guarding with movement'],
    ['Cardiovascular', 'Tachycardic, delayed capillary refill'],
    ['Respiratory', 'Mild tachypnea, clear breath sounds'],
    ['Abdomen', 'Diffuse tenderness with focal peritoneal signs possible'],
    ['Neuro', 'Alert but uncomfortable, no focal deficits'],
    ['Skin', 'Warm, mildly clammy, no rash'],
  ],
  'Headache': [
    ['General', 'Uncomfortable, photophobic, concerned about worst headache'],
    ['Cardiovascular', 'Normotensive to mildly elevated BP on repeat checks'],
    ['Respiratory', 'Non-labored, no hypoxia'],
    ['Abdomen', 'Soft, non-tender'],
    ['Neuro', 'Occipital tenderness; assess neck stiffness and focal deficits'],
    ['Skin', 'Prior rash resolved per history; no current petechiae'],
  ],
  'Memory Loss': [
    ['General', 'Family reports progressive memory loss and personality change'],
    ['Cardiovascular', 'Hemodynamically stable; continuous monitoring in place'],
    ['Respiratory', 'Airway patent, no respiratory distress'],
    ['Abdomen', 'Soft, non-tender, no organomegaly appreciated'],
    ['Neuro', 'Impaired short-term recall; disorientation; gait instability with recent falls'],
    ['Skin', 'No meningismus; assess for bruising from falls'],
  ],
  'Rash and Lethargy': [
    ['General', 'Lethargic, ill-appearing on presentation'],
    ['Cardiovascular', 'Tachycardic when febrile, capillary refill monitored'],
    ['Respiratory', 'Clear to decreased breath sounds depending on work of breathing'],
    ['Abdomen', 'Soft, may have mild tenderness if systemic illness'],
    ['Neuro', 'Lethargy with intact or fluctuating mental status'],
    ['Skin', 'Rash distribution and morphology documented; petechiae ruled out if toxic'],
  ],
  'Generalized Weakness': [
    ['General', 'Fatigued, reports progressive weakness'],
    ['Cardiovascular', 'Heart rate and BP reflect volume and metabolic status'],
    ['Respiratory', 'Breath sounds clear unless respiratory muscle weakness'],
    ['Abdomen', 'Soft, non-focal'],
    ['Neuro', 'Motor strength testing shows fatigable weakness pattern'],
    ['Skin', 'No rash; hydration and perfusion assessed'],
  ],
  'Burning During Urination': [
    ['General', 'Uncomfortable, afebrile to febrile depending on progression'],
    ['Cardiovascular', 'Tachycardic if febrile or dehydrated'],
    ['Respiratory', 'Non-labored'],
    ['Abdomen', 'Suprapubic tenderness possible; costovertebral angle tenderness if pyelonephritis'],
    ['Neuro', 'Alert, no focal deficits'],
    ['Skin', 'No rash unless STI-related findings'],
  ],
  'Shortness of Breath': [
    ['General', 'Dyspneic, speaking in short phrases if severe'],
    ['Cardiovascular', 'Tachycardic; JVD and peripheral edema assessed'],
    ['Respiratory', 'Increased work of breathing; crackles or wheeze documented'],
    ['Abdomen', 'Soft, non-distended'],
    ['Neuro', 'Alert unless hypercapnic or hypoxic'],
    ['Skin', 'Cyanosis absent unless critical hypoxemia'],
  ],
  Cough: [
    ['General', 'Ill-appearing with frequent cough; fatigued, speaks in short phrases'],
    ['Cardiovascular', 'Tachycardic; no acute murmur or JVD on first pass'],
    ['Respiratory', 'Tachypneic with productive cough; focal crackles or rhonchi on auscultation'],
    ['Abdomen', 'Soft, non-tender, no guarding'],
    ['Neuro', 'Alert and oriented; no meningismus'],
    ['Skin', 'No petechiae; mild diaphoresis with exertional cough'],
  ],
  'Found Unconscious': [
    ['General', 'Unresponsive on arrival, airway and circulation addressed first'],
    ['Cardiovascular', 'Hemodynamics stabilized with monitoring'],
    ['Respiratory', 'Airway protection and oxygenation priority'],
    ['Abdomen', 'Deferred until stable unless trauma pathway'],
    ['Neuro', 'GCS documented; pupils and focal signs assessed'],
    ['Skin', 'Trauma survey for lacerations, track marks, temperature'],
  ],
};

/** Diagnosis-specific exams when presentation title alone is too broad (e.g. Cough → TB). */
const DIAGNOSIS_EXAMS = {
  Tuberculosis: [
    ['General', 'Cachectic-appearing; weak with paroxysmal cough; weeks of symptoms and weight loss'],
    ['Cardiovascular', 'Tachycardic; hemodynamically stable on arrival'],
    ['Respiratory', 'Tachypneic and hypoxemic; decreased breath sounds with upper-lobe crackles possible'],
    ['Abdomen', 'Soft, non-tender, no peritoneal signs'],
    ['Neuro', 'Alert; no focal deficits'],
    ['Skin', 'No acute rash; night sweats reported in history when obtained'],
  ],
  'Community Acquired Pneumonia': [
    ['General', 'Febrile and ill-appearing with productive cough'],
    ['Cardiovascular', 'Tachycardic; BP stable'],
    ['Respiratory', 'Tachypneic; focal crackles and dullness to percussion on affected side'],
    ['Abdomen', 'Soft, non-tender'],
    ['Neuro', 'Alert and oriented'],
    ['Skin', 'Warm with fever; no petechiae'],
  ],
  Pneumonia: [
    ['General', 'Ill-appearing with cough and fever'],
    ['Cardiovascular', 'Tachycardic'],
    ['Respiratory', 'Tachypneic; focal lung findings on exam'],
    ['Abdomen', 'Soft, non-tender'],
    ['Neuro', 'Alert'],
    ['Skin', 'Febrile, no rash'],
  ],
};

function patientVoiceToText(patientVoice) {
  if (!patientVoice || typeof patientVoice !== 'object') return '';
  return [patientVoice.chief_complaint, patientVoice.history, patientVoice.pain]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .join(' ');
}

export function composeCaseHistory({
  history = '',
  patientVoice = null,
  clinicalHpi = '',
  chiefComplaint = '',
} = {}) {
  const pv = patientVoiceToText(patientVoice);
  const parts = [
    String(history || '').trim(),
    pv,
    String(clinicalHpi || '').trim(),
    String(chiefComplaint || '').trim(),
  ].filter((p) => p.length > 0);
  const seen = new Set();
  const unique = [];
  for (const p of parts) {
    const key = p.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique.join(' ');
}

function diagnosisKey(diagnosis = '') {
  const d = String(diagnosis || '').trim();
  if (!d || d === 'Unknown') return null;
  if (DIAGNOSIS_EXAMS[d]) return d;
  const found = Object.keys(DIAGNOSIS_EXAMS).find(
    (k) => k.toLowerCase() === d.toLowerCase(),
  );
  return found || null;
}

function isTeachingHpi(text = '') {
  return /this case highlights|emphasizes the importance|follow ccs review|complete diagnosis and treatment orders/i.test(
    text,
  );
}

function isGenericFinding(text = '') {
  const t = String(text || '').trim();
  if (!t) return true;
  if (GENERIC_FINDINGS.has(t)) return true;
  return GENERIC_FINDING_PATTERNS.some((re) => re.test(t));
}

function isGenericTemplateExam(exam) {
  if (!Array.isArray(exam) || !exam.length) return true;
  const genericCount = exam.filter(([, finding]) => GENERIC_FINDINGS.has(finding)).length;
  return genericCount >= Math.ceil(exam.length * 0.5);
}

function clip(text = '', max = 220) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function formatCardiovascular(vitals = {}, historyLower = '') {
  const v = vitals && typeof vitals === 'object' ? vitals : {};
  const parts = [];
  if (v.hr != null) {
    let note = `HR ${v.hr}`;
    if (v.hr > 110) note += ', tachycardic';
    else if (v.hr < 60) note += ', bradycardic';
    parts.push(note);
  }
  if (v.sbp != null && v.dbp != null) {
    parts.push(`BP ${v.sbp}/${v.dbp}`);
    if (v.sbp < 95) parts.push('hypotensive');
  }
  if (/murmur|jvd|gallop|clutching chest|diaphoretic/i.test(historyLower)) {
    parts.push('cardiac exam guided by presentation acuity');
  }
  return parts.length ? `${parts.join('; ')}.` : 'Heart rate and rhythm assessed at bedside.';
}

function formatRespiratory(vitals = {}, historyLower = '', diagnosis = '', title = '') {
  const parts = [];
  const dl = String(diagnosis || '').toLowerCase();
  const tl = String(title || '').toLowerCase();

  if (vitals.rr != null) {
    let note = `RR ${vitals.rr}`;
    if (vitals.rr > 22) note += ', tachypneic';
    parts.push(note);
  }
  if (vitals.spo2 != null) {
    parts.push(`SpO₂ ${vitals.spo2}%`);
    if (vitals.spo2 < 94) parts.push('hypoxemic');
  }
  if (/tuberculosis|\btb\b|mycobacter/i.test(dl)) {
    parts.push('productive cough; decreased breath sounds with possible upper-lobe crackles');
  } else if (/pneumonia/i.test(dl)) {
    parts.push('focal crackles and dullness to percussion on affected side');
  } else if (/cough/.test(tl) || /cough/.test(historyLower)) {
    parts.push('productive cough with scattered rhonchi; increased work of breathing');
  } else if (/dyspnea|shortness of breath|respiratory distress|wheez|crackles/i.test(historyLower)) {
    parts.push('increased work of breathing noted');
  }
  return parts.length ? `${parts.join('; ')}.` : 'Breath sounds and work of breathing assessed.';
}

function deriveGeneral(history = '', title = '', diagnosis = '', patientVoice = null) {
  const h = history;
  const hl = h.toLowerCase();
  const pv = patientVoiceToText(patientVoice).toLowerCase();
  const dl = String(diagnosis || '').toLowerCase();
  const tl = String(title || '').toLowerCase();

  if (/tuberculosis|\btb\b|mycobacter/i.test(dl)) {
    return 'Cachectic-appearing; weak with paroxysmal cough; reports weeks of symptoms and weight loss.';
  }
  if (/cough/.test(tl) || /cough/.test(pv) || /cough/.test(hl)) {
    if (/weight loss|weak|weeks/i.test(pv + hl)) {
      return 'Ill-appearing with chronic cough; fatigued and thinner than stated baseline.';
    }
    return 'Ill-appearing with frequent cough; speaks in short phrases between paroxysms.';
  }
  if (/pneumonia/i.test(dl)) {
    return 'Febrile and ill-appearing with productive cough and malaise.';
  }
  if (/diaphoretic|anxious|clutching|acute distress|moaning/i.test(h)) {
    const m = h.match(/[^.!?]*(?:diaphoretic|distress|moaning|anxious)[^.!?]*[.!?]/i);
    if (m) return clip(m[0]);
  }
  if (/behavioral|barely talks|stares|somnolent|confused|lethargic|altered mental|memory loss/i.test(hl)) {
    return 'Decreased engagement and cognitive change compared with reported baseline.';
  }
  if (!isTeachingHpi(h) && /pain|rash|weakness|headache|bleeding/i.test(hl)) {
    const m = h.match(/(?:presents|complaining|reports)[^.!?]{20,180}[.!?]/i);
    if (m) return clip(m[0]);
  }
  if (title) return 'Ill-appearing; moderate distress.';
  return 'Exam findings reflect presentation acuity on arrival.';
}

function deriveAbdomen(historyLower = '', title = '') {
  if (/abdominal|pelvic|suprapubic|nausea|vomit|guarding|rlq|llq/i.test(historyLower)) {
    if (/guarding|tender|rebound|peritoneal/i.test(historyLower)) {
      return 'Tenderness with guarding; peritoneal signs assessed.';
    }
    return 'Abdominal tenderness pattern matches history; no rigid abdomen documented yet.';
  }
  if (/burning during urination|dysuria|flank/i.test(historyLower)) {
    return 'Suprapubic or CVA tenderness assessed for UTI/pyelonephritis source.';
  }
  if (/pelvic/i.test(title.toLowerCase())) {
    return 'Pelvic and abdominal exam indicated for pain source localization.';
  }
  return 'Soft, non-distended, no focal peritoneal signs on initial exam.';
}

function deriveNeuro(historyLower = '', title = '') {
  const tl = title.toLowerCase();
  if (/memory loss|confus|altered mental|somnolent|stares|barely talks|gait|fall|weakness|headache|seizure|stroke|numbness|focal/i.test(historyLower + tl)) {
    if (/memory loss/i.test(tl)) {
      return 'Impaired recall and orientation; gait and focal motor/sensory exam documented.';
    }
    if (/headache/i.test(tl)) {
      if (/vertigo|off-balance|unsteady|ataxia|fall when walking|tendency to fall/i.test(historyLower)) {
        return 'Occipital headache; mild vertigo; unsteady gait with veering; cranial nerves intact; neck stiffness assessed.';
      }
      return 'Occipital tenderness; mental status intact; cranial nerves and neck stiffness assessed.';
    }
    if (/vertigo|off-balance|unsteady|ataxia|fall when walking|tendency to fall/i.test(historyLower)) {
      return 'Gait unsteady with veering; mild vertigo; cranial nerves intact; focal deficits assessed.';
    }
    if (/altered mental|confus|somnolent/i.test(historyLower + tl)) {
      return 'Altered mental status with attention and command-following documented.';
    }
    if (/weakness/i.test(historyLower + tl)) {
      return 'Motor strength and reflexes tested for fatigability and focal deficits.';
    }
    return 'Neurologic exam focused on mental status and focal deficits.';
  }
  return 'Alert and oriented unless perfusion or metabolic derangement present.';
}

function deriveSkin(historyLower = '', vitals = {}) {
  const v = vitals && typeof vitals === 'object' ? vitals : {};
  if (/night sweat|weight loss|cachectic|tuberculosis|\btb\b/i.test(historyLower)) {
    return 'No acute rash; night sweats and weight loss noted in history when obtained.';
  }
  if (/rash|petech|lesion|jaundice|diaphoretic|clammy|pale/i.test(historyLower)) {
    if (/rash.*(improv|resolv|went away|cleared)|(?:improv|resolv|went away|cleared).*rash/i.test(historyLower)) {
      return 'No active rash today; resolved rash per history; faint residual macular patches may remain on arms or torso.';
    }
    if (/rash|petech/i.test(historyLower)) return 'Skin rash morphology and distribution documented.';
    if (/diaphoretic|clammy|pale/i.test(historyLower)) return 'Diaphoretic or pale skin with perfusion checked.';
  }
  if (v.temp >= 38.5) return 'Warm skin with fever; no purpura on initial survey.';
  return 'No acute rash; capillary refill and perfusion assessed.';
}

/** Build exam rows from history, vitals, diagnosis, and patient voice. */
export function deriveExamFromHistory(
  history = '',
  vitals = {},
  title = '',
  category = '',
  diagnosis = '',
  patientVoice = null,
) {
  const clean = String(history).replace(/\s+/g, ' ').trim();
  const pv = patientVoiceToText(patientVoice);
  const usable = isTeachingHpi(clean) ? pv || clean : clean || pv;
  if (usable.length < 24 && !diagnosisKey(diagnosis) && !PRESENTATION_EXAMS[titleKey(title)]) {
    return null;
  }

  const hl = `${usable} ${diagnosis} ${title}`.toLowerCase();
  return [
    ['General', deriveGeneral(usable || pv, title, diagnosis, patientVoice)],
    ['Cardiovascular', formatCardiovascular(vitals, hl)],
    ['Respiratory', formatRespiratory(vitals, hl, diagnosis, title)],
    ['Abdomen', deriveAbdomen(hl, title || category)],
    ['Neuro', deriveNeuro(hl, title || category)],
    ['Skin', deriveSkin(hl, vitals)],
  ];
}

function titleKey(title = '') {
  const t = String(title).trim();
  if (PRESENTATION_EXAMS[t]) return t;
  const found = Object.keys(PRESENTATION_EXAMS).find(
    (key) => key.toLowerCase() === t.toLowerCase(),
  );
  return found || t;
}

function applyVitalsToExam(exam, vitals = {}, diagnosis = '', title = '') {
  return exam.map(([system, finding]) => {
    if (system === 'Cardiovascular') return [system, formatCardiovascular(vitals, '')];
    if (system === 'Respiratory') return [system, formatRespiratory(vitals, '', diagnosis, title)];
    return [system, finding];
  });
}

function mergeExamWithVitals(template, derived, vitals, diagnosis = '', title = '') {
  const derivedMap = Object.fromEntries(derived);
  return template.map(([system, finding]) => {
    if (system === 'Cardiovascular') return [system, formatCardiovascular(vitals, '')];
    if (system === 'Respiratory') return [system, formatRespiratory(vitals, '', diagnosis, title)];
    const fromHistory = derivedMap[system];
    if (system === 'General' || system === 'Neuro' || system === 'Abdomen' || system === 'Skin') {
      const pick =
        fromHistory && !isGenericFinding(fromHistory) ? fromHistory : finding;
      return [system, pick];
    }
    return [system, finding];
  });
}

function vitalsBasedExam(vitals = {}, title = '', category = '', diagnosis = '', patientVoice = null) {
  const pv = patientVoiceToText(patientVoice);
  const hl = `${pv} ${title} ${category} ${diagnosis}`.toLowerCase();
  return [
    ['General', deriveGeneral(pv, title || category, diagnosis, patientVoice)],
    ['Cardiovascular', formatCardiovascular(vitals, hl)],
    ['Respiratory', formatRespiratory(vitals, hl, diagnosis, title)],
    ['Abdomen', deriveAbdomen(hl, title)],
    ['Neuro', deriveNeuro(hl, title)],
    ['Skin', deriveSkin(hl, vitals)],
  ];
}

/**
 * Resolve physical exam for a case from the case bank.
 * Priority: per-case authored → presentation title → HPI-derived → stored (if not generic) → vitals-based.
 */
export function resolveCaseExam({
  caseId = '',
  title = '',
  category = '',
  diagnosis = '',
  history = '',
  vitals = {},
  patientVoice = null,
  preparedExam = null,
  hasSourceIntro = false,
} = {}) {
  const key = String(caseId || '').padStart(3, '0');
  const safeVitals = vitals && typeof vitals === 'object' ? vitals : {};
  const presentationTitle = titleKey(title);
  const dxKey = diagnosisKey(diagnosis);

  if (AUTHORED_CASE_EXAMS[key]) {
    return AUTHORED_CASE_EXAMS[key];
  }

  if (dxKey && DIAGNOSIS_EXAMS[dxKey]) {
    const template = DIAGNOSIS_EXAMS[dxKey];
    const derived = deriveExamFromHistory(
      history,
      safeVitals,
      presentationTitle,
      category,
      diagnosis,
      patientVoice,
    );
    if (derived) {
      return mergeExamWithVitals(template, derived, safeVitals, diagnosis, presentationTitle);
    }
    return applyVitalsToExam(template, safeVitals, diagnosis, presentationTitle);
  }

  if (PRESENTATION_EXAMS[presentationTitle]) {
    const template = PRESENTATION_EXAMS[presentationTitle];
    const derived = deriveExamFromHistory(
      history,
      safeVitals,
      presentationTitle,
      category,
      diagnosis,
      patientVoice,
    );
    if (derived) {
      return mergeExamWithVitals(template, derived, safeVitals, diagnosis, presentationTitle);
    }
    return applyVitalsToExam(template, safeVitals, diagnosis, presentationTitle);
  }

  const derived = deriveExamFromHistory(
    history,
    safeVitals,
    presentationTitle,
    category,
    diagnosis,
    patientVoice,
  );
  if (derived) return derived;

  if (preparedExam?.length && !isGenericTemplateExam(preparedExam)) {
    return applyVitalsToExam(preparedExam, safeVitals, diagnosis, presentationTitle);
  }

  return vitalsBasedExam(safeVitals, presentationTitle, category, diagnosis, patientVoice);
}

export function isGenericExam(exam) {
  return isGenericTemplateExam(exam);
}
