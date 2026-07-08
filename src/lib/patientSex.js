/** Patient sex from HPI intro patterns, explicit fields, and narrative heuristics. */

const INTRO_PATTERNS = [
  /\b(\d{1,3})[\s-]*year[\s-]*old\s+(male|female|man|woman|boy|girl)\b/i,
  /\b(?:a|an)\s+(\d{1,3})[\s-]*year[\s-]*old\s+(male|female)\b/i,
  /\b(\d{1,3})[\s-]*yo\s+(m|f|male|female)\b/i,
];

function normalizeSexToken(token) {
  const t = String(token || '').toLowerCase();
  if (t === 'f' || t === 'female' || t === 'woman' || t === 'girl') return 'female';
  if (t === 'm' || t === 'male' || t === 'man' || t === 'boy') return 'male';
  return null;
}

/** Highest-priority: "55-year-old female" / "A 55-year-old female" / "55 yo f" in clinical intro. */
export function parseSexFromClinicalIntro(text = '') {
  const t = String(text || '');
  if (!t.trim()) return null;
  for (const re of INTRO_PATTERNS) {
    const m = t.match(re);
    if (m) {
      const sexToken = m[2];
      const sex = normalizeSexToken(sexToken);
      if (sex) return sex;
    }
  }
  return null;
}

function voiceLines(caseData = {}) {
  const pv = caseData.patient_voice || caseData.patientVoice;
  if (!pv || typeof pv !== 'object') return '';
  return Object.values(pv)
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ');
}

function buildSexCorpus(caseData = {}) {
  return [
    caseData.chief_complaint,
    caseData.historyText,
    caseData.hpi_narrative,
    caseData.clinical_hpi_narrative,
    voiceLines(caseData),
    caseData.title,
    caseData.preparedIntro,
    caseData.narrativeIntro,
  ]
    .filter(Boolean)
    .join(' ');
}

function inferSexFromHeuristics(blob) {
  if (!blob) return 'unknown';

  const femaleHits =
    (blob.match(/\bfemale\b|\bwoman\b|\bwomen\b|\bgirl\b|\bdaughter\b|\bmother\b|\bgravida\b|\bg\d+p\d+\b/gi) || [])
      .length +
    (/\bpregnant\b|\bchildbearing\s+age\b|\bmenstrual\b|\btampon\b|\bpap\s+smear\b|\bhpv\b|\btdap\b|\bectopic\b|\bpelvic\s+pain\b|\bobstetric\b|\bvaginal\b|\bvulvar\b|\bcervix\b|\bcervical\b|\bdyspareunia\b|\bbartholin\b|\bendometrial\b|\bovarian\b|\buterine\b|\bclitoris\b|\blabia\b|\bbreast\b|\bmammary\b|\bmastectomy\b|\bhysterectomy\b|\boophorectomy\b|\bmenopause\b|\bmenorrhagia\b|\bendometriosis\b|\blactation\b|\bvaginitis\b|\bcontraceptive\b|\bcontraception\b|\boral\s+contraceptive\b|\bocp\b|\biud\b|\bintrauterine\b|\bfibroid\b|\bleiomyoma\b|\bmyoma\b|\bprolapse\b|\bincontinence\b|\buti\b|\burinary\s+tract\s+infection\b|\bvaginal\s+discharge\b|\bvaginal\s+itching\b|\bvaginal\s+dryness\b|\bvaginal\s+bleeding\b|\bpostmenopausal\b|\bperimenopausal\b|\bhrl\b|\bhormone\s+replacement\b|\bmammogram\b|\bcolposcopy\b|\blaparoscopy\b|\bhysterosalpingogram\b|\bhsg\b|\bamniocentesis\b|\bchorionic\b|\bterbutaline\b|\bmagnesium\s+sulfate\b|\bpreeclampsia\b|\bgestational\b|\bpostpartum\b|\bperineal\b|\bepisiotomy\b|\blochia\b|\bcolostrum\b|\bmecenium\b|\bneonatal\b|\bnewborn\b|\bwell\s+woman\b|\bwell-woman\b|\bannual\s+exam\b|\bpelvic\s+exam\b|\bbimanual\b|\bspeculum\b|\bwet\s+mount\b|\bkoh\b|\bclue\s+cell\b|\bwhiff\s+test\b|\bamniotic\b|\bchorioamnionitis\b|\bendometritis\b|\bsalpingitis\b|\bpid\b|\bpelvic\s+inflammatory\b|\bvaginal\s+atrophy\b|\bvaginal\s+stenosis\b|\bvaginal\s+septum\b|\bvaginal\s+agenesis\b|\bmullerian\b/gi.test(
      blob,
    )
      ? 2
      : 0);
  const maleHits = (blob.match(/\bmale\b|\bman\b|\bmen\b|\bboy\b|\bson\b|\bfather\b|\bprostate\b|\btesticle\b|\btesticular\b|\bscrotum\b|\bscrotal\b|\bpenis\b|\bpenile\b|\bphimosis\b|\bcircumcision\b|\buncircumcised\b|\bvasectomy\b|\bsemen\b|\bsperm\b|\bepididymis\b|\bepididymitis\b|\bvaricocele\b|\bhydrocele\b|\bingunial\b|\bhernia\b|\bherniorrhaphy\b|\bdht\b|\btestosterone\b|\bandrogen\b|\bandropause\b|\bpsa\b|\bprostatitis\b|\bbenign\s+prostatic\b|\bbph\b|\bpriapism\b|\bhematospermia\b|\bhypogonadism\b|\bgyno\b|\bgynecomastia\b/gi) || []).length;
  if (femaleHits > maleHits) return 'female';
  if (maleHits > femaleHits) return 'male';

  const she = (blob.match(/\bshe\b/gi) || []).length;
  const he = (blob.match(/\bhe\b/gi) || []).length;
  const his = (blob.match(/\bhis\b/gi) || []).length;
  const her = (blob.match(/\bher\b/gi) || []).length;
  const femaleScore = she + her;
  const maleScore = he + his;
  if (femaleScore > maleScore + 2) return 'female';
  if (maleScore > femaleScore + 2) return 'male';

  return 'unknown';
}

/**
 * Resolve patient sex for portraits, TTS, and simulation.
 * Priority: HPI intro age/sex pattern → explicit patientSex → narrative heuristics → unknown default.
 */
export function resolvePatientSex(caseData = {}) {
  const corpus = buildSexCorpus(caseData);
  const introSex = parseSexFromClinicalIntro(corpus);
  if (introSex) return introSex;

  const explicit = caseData?.patientSex;
  if (explicit === 'female' || explicit === 'male') return explicit;

  return inferSexFromHeuristics(corpus);
}

/** @deprecated Prefer resolvePatientSex — kept for existing call sites. */
export function inferPatientSex(caseData) {
  return resolvePatientSex(caseData);
}

/** Compare intro-derived sex vs declared patientSex for audit scripts. */
export function sexMismatchAudit(caseData = {}) {
  const corpus = buildSexCorpus(caseData);
  const introSex = parseSexFromClinicalIntro(corpus);
  const declared = caseData?.patientSex || null;
  const resolved = resolvePatientSex(caseData);
  const mismatch =
    Boolean(introSex)
    && declared
    && declared !== 'unknown'
    && introSex !== declared;

  return {
    caseId: caseData?.id ?? caseData?.ccsNumber ?? null,
    introSex,
    declaredSex: declared,
    resolvedSex: resolved,
    mismatch,
    introSnippet:
      corpus.match(/\b(?:a|an\s+)?\d{1,3}[\s-]*(?:year[\s-]*old|yo)\s+\w+/i)?.[0] || null,
  };
}
