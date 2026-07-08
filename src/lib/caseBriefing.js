import { formatClinicalText } from './clinicalTextFormat.js';
import { applyPatientName, resolvePatientName } from './patientName.js';
import { getPreparedCase } from './caseNarrative.js';
import { isLearningMode } from './learningMode.js';
import { hpiContainsSpoilers, resolveAnswerKeyHpi } from './practiceHpi.js';

function formatVitalsLine(vitals = {}) {
  const temp =
    typeof vitals.temp === 'number' ? `${vitals.temp.toFixed(1)}°C` : '—';
  const lactate =
    typeof vitals.lactate === 'number' ? vitals.lactate.toFixed(1) : '—';
  return `BP ${vitals.sbp ?? '—'}/${vitals.dbp ?? '—'} · HR ${vitals.hr ?? '—'} · RR ${vitals.rr ?? '—'} · Temp ${temp} · SpO₂ ${vitals.spo2 ?? '—'}% · Lactate ${lactate}`;
}

function resolveHpiText(source) {
  if (!source) return '';
  if (typeof source === 'string') return source.trim();
  if (typeof source === 'object') {
    if (source.narrative) return String(source.narrative).trim();
    if (source.raw) return String(source.raw).trim();
    const parts = [];
    if (source.reason_for_visit) parts.push(`Reason(s) for visit: ${source.reason_for_visit}`);
    if (source.history) parts.push(String(source.history).trim());
    return parts.join('\n\n').trim();
  }
  return '';
}

function resolveDisplayPatientName(caseData) {
  if (caseData?.patientDisplayName) {
    return caseData.patientDisplayName;
  }
  return resolvePatientName(caseData);
}

/** Answer-key HPI (diagnosis, workup, treatment) — teach / notes only, not briefing HPI tab. */
export function getCaseHpiNarrative(caseData, presentationHpi = '') {
  void presentationHpi;
  const prepared = getPreparedCase(caseData?.id);
  const raw = resolveHpiText(resolveAnswerKeyHpi(prepared, caseData));
  if (!raw) return '';
  const displayName = resolveDisplayPatientName(caseData);
  return applyPatientName(raw, displayName);
}

/** Practice presentation for briefing / play HPI tab — never the answer-key narrative. */
export function getBriefingHpi(caseData, caseFlow, presentationHpi = '') {
  void caseFlow;
  const candidates = [
    presentationHpi,
    caseData?.historyText,
    getPreparedCase(caseData?.id)?.practice_hpi,
  ];
  for (const raw of candidates) {
    const text = formatClinicalText(String(raw || '').trim());
    if (text && !hpiContainsSpoilers(text)) return text;
  }
  const chief = formatClinicalText(caseData?.chief_complaint?.trim() || '');
  if (chief && !hpiContainsSpoilers(chief)) return chief;
  return 'No HPI available for this case.';
}

/** One line per exam system (General, CV, Resp, …) — uses pre-wrap in UI. */
export function formatExamForDisplay(examRows) {
  if (!Array.isArray(examRows) || examRows.length === 0) return '';
  return examRows
    .map(([system, finding]) => `${String(system).trim()}: ${String(finding).trim()}`)
    .join('\n\n');
}

export function getBriefingExam(caseFlow) {
  const exam = caseFlow?.exam || [];
  if (!exam.length) return 'No physical exam findings documented yet.';
  return formatExamForDisplay(exam);
}

/** Treatment plan summary (text only — stacks appear after Begin). */
export function getBriefingTreatment(caseData, interventions = []) {
  if (!interventions.length) {
    return caseData?.clinical_tip?.trim() || 'Review expected orders after you begin the case.';
  }
  const lines = interventions.map((iv, i) => {
    const why = iv.why?.trim();
    return why ? `${i + 1}. ${iv.label}\n   ${why}` : `${i + 1}. ${iv.label}`;
  });
  const blocks = [`Expected orders (${interventions.length} stacks):`, '', ...lines];
  if (caseData?.clinical_tip?.trim()) {
    blocks.push('', `Teaching focus: ${caseData.clinical_tip.trim()}`);
  }
  return blocks.join('\n');
}

/** Structured sections for Briefing Notes tab (Working diagnosis, Case summary, …). */
export function getBriefingNoteSections(caseData, caseFlow, presentationHpi = '') {
  const sections = [];
  const learning = isLearningMode();
  const chief = formatClinicalText(caseData?.chief_complaint?.trim() || '');
  const history = formatClinicalText(caseData?.historyText?.trim() || '');
  const summaryHpi = formatClinicalText(presentationHpi || '');

  if (chief) {
    sections.push({ title: 'Chief complaint', body: chief });
  }
  if (history && history !== summaryHpi && history.length > summaryHpi.length + 20) {
    sections.push({ title: 'History of present illness', body: history });
  } else if (summaryHpi) {
    sections.push({ title: 'History of present illness', body: summaryHpi });
  }

  if (caseFlow?.vitals) {
    sections.push({ title: 'Vitals', body: formatVitalsLine(caseFlow.vitals) });
  }
  if (caseData?.vitalsText?.trim()) {
    sections.push({ title: 'Vitals narrative', body: caseData.vitalsText.trim() });
  }

  const exam = getBriefingExam(caseFlow);
  if (exam) {
    sections.push({ title: 'Physical examination', body: exam });
  }

  const treatment = getBriefingTreatment(caseData, caseData?.interventions || []);
  if (treatment && !learning) {
    sections.push({ title: 'Treatment plan', body: treatment });
  }

  if (!learning) {
    if (caseData?.diagnosis) {
      sections.push({ title: 'Working diagnosis', body: caseData.diagnosis });
    }
    if (caseData?.case_summary?.trim()) {
      sections.push({ title: 'Case summary', body: caseData.case_summary.trim() });
    }
    if (caseData?.clinical_tip?.trim()) {
      sections.push({ title: 'Clinical tip', body: caseData.clinical_tip.trim() });
    }
    if (caseData?.objective?.trim()) {
      sections.push({ title: 'Learning objective', body: caseData.objective.trim() });
    }
  } else {
    sections.push({
      title: 'Study mode',
      body: 'Diagnosis and teaching content unlock after you complete the case. Use HPI and physical exam tabs while you work.',
    });
  }

  return sections;
}

/** Full chart note for the Notes tab — deep dive beyond the summary tabs. */
export function getBriefingNotes(caseData, caseFlow, presentationHpi = '') {
  const sections = getBriefingNoteSections(caseData, caseFlow, presentationHpi);
  if (!sections.length) {
    return 'No extended chart note available for this case yet.';
  }
  return sections.map(({ title, body }) => `${title}\n${body}`).join('\n\n');
}
