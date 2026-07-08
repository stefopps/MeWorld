/** Spoiler phrases that must not appear in briefing / play HPI. */
export const HPI_SPOILER_RE =
  /\b(consistent with|hallmark of|pathophysiology|first-line|gold standard|offending agent|stop now|classic \d[\s–-]\d|On exam:|Stevens-Johnson|\bSJS\b|\bTEN\b|Nikolsky sign|BSA epidermal|myasthenia gravis|\bMG\b|thymoma|lambert-eaton|myasthenic crisis|autoimmune antibody|postsynaptic acetylcholine|resection can lead|CT chest is essential|Treatment:|Diagnosis:|Management:|is the most common)\b/i;

export function hpiContainsSpoilers(text) {
  return HPI_SPOILER_RE.test(String(text || ''));
}

/** Stub CCS import line — not a real HPI. */
export function isPlaceholderPresentation(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/— emergency presentation\.?$/i.test(t)) return true;
  if (t.length < 80 && !t.includes('.')) return true;
  return false;
}

/** Spoiler-free HPI for briefing / play — never fall back to answer-key narrative. */
export function resolvePracticeHpi(prepared, caseData = {}, catalogHistory = '') {
  const practice =
    prepared?.practice_hpi?.trim() || caseData?.practice_hpi?.trim();
  if (practice && !hpiContainsSpoilers(practice) && !isPlaceholderPresentation(practice)) {
    return practice;
  }

  const history = caseData?.historyText?.trim() || catalogHistory?.trim() || '';
  if (history && !hpiContainsSpoilers(history) && !isPlaceholderPresentation(history)) {
    return history;
  }

  const chief = caseData?.chief_complaint?.trim() || '';
  if (chief && !hpiContainsSpoilers(chief)) return chief;

  return practice || '';
}

/** Full answer-key HPI — teach / notes / chat only. */
export function resolveAnswerKeyHpi(prepared, caseData = {}) {
  return (
    prepared?.answer_key_hpi?.trim() ||
    prepared?.hpi_narrative?.trim() ||
    caseData?.clinical_hpi_narrative?.trim() ||
    caseData?.hpi_narrative?.trim() ||
    ''
  );
}
