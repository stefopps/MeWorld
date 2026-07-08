export const ORDER_RESULT_PROMPT_VERSION = 5;

function clip(text, max) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function formatExamRows(exam) {
  if (!Array.isArray(exam)) return '';
  return exam
    .slice(0, 14)
    .map((row) => {
      if (Array.isArray(row) && row.length >= 2) return `${row[0]}: ${row[1]}`;
      if (row && typeof row === 'object') return `${row.system || row.section || ''}: ${row.finding || row.text || ''}`;
      return null;
    })
    .filter(Boolean)
    .join('\n');
}

function formatVitals(vitals) {
  if (!vitals || typeof vitals !== 'object') return '';
  const parts = [];
  if (vitals.sbp != null && vitals.dbp != null) parts.push(`BP ${vitals.sbp}/${vitals.dbp}`);
  if (vitals.hr != null) parts.push(`HR ${vitals.hr}`);
  if (vitals.rr != null) parts.push(`RR ${vitals.rr}`);
  if (vitals.temp != null) parts.push(`Temp ${vitals.temp}`);
  if (vitals.spo2 != null) parts.push(`SpO2 ${vitals.spo2}%`);
  return parts.join(' · ');
}

export function buildOrderResultPrompt({
  orderLabel = '',
  orderKindHint = 'order',
  playbookWhy = '',
  caseContext = {},
  teachMeMode = false,
  fallbackText = '',
  orderLog = [],
  priorLabResults = [],
  trajectoryOccurrence = 0,
}) {
  const learningMode = caseContext.learningMode !== false;
  const cc =
    caseContext.chief_complaint ||
    caseContext.title ||
    caseContext.patientFacts?.chiefComplaint ||
    '';
  const hpi =
    caseContext.clinical_hpi_narrative ||
    caseContext.hpiExcerpt ||
    caseContext.historyText ||
    '';
  const vitalsLine =
    caseContext.vitalsText ||
    formatVitals(caseContext.vitals) ||
    '';
  const examBlock = formatExamRows(caseContext.exam || caseContext.physical_exam);
  const diagnosis = learningMode ? null : caseContext.diagnosis || caseContext.objective || null;
  const stackFinding =
    caseContext.orderStackFinding ||
    caseContext.stackFinding ||
    null;
  const cleanStacks = Array.isArray(caseContext.cleanCaseStacks)
    ? caseContext.cleanCaseStacks.slice(0, 12)
    : null;

  const system = `You write OBJECTIVE clinical results after a physician orders a test, imaging study, or physical exam section in an ED training simulation.

Return JSON only with keys: kind, kindLabel, text.

kind: one of lab, exam, imaging, procedure, counseling, order
kindLabel: short UI label (e.g. "Lab result", "Exam finding", "Imaging result")

text rules:
- LABS: ALWAYS include specific numeric values with units. Never return only "${'{order}'} — completed." For single tests (ANA, complement C3/C4, anti-dsDNA, ESR, CRP, troponin, etc.) give realistic numbers.
- For "CBC / BMP / UA" or combined panels, use separate blocks:
  CBC: WBC … Hgb … Plt …
  BMP: Glucose … Na … K … Cl … HCO₃ … BUN … Cr …
  UA: protein, blood, WBC/HPF, nitrites, etc.
- When canonicalCaseStackFinding or playbookHint describes low/high/positive, reflect that in numbers.
- PHYSICAL EXAM sections: 1–3 sentences of objective findings for THAT body system only (general, chest, abdomen, skin, HEENT, etc.).
- IMAGING: concise structured read (no "see full report in chart").
- PROCEDURES / meds / counseling: brief completion note.
${teachMeMode
    ? '- TEACH MODE: after objective data, add ONE short interpretation clause (≤15 words) — no diagnosis name if learningMode.'
    : '- PRACTICE MODE: objective values and findings ONLY — no interpretation, no "consistent with", no diagnosis names.'}
${learningMode ? '- LEARNING MODE: never name the final diagnosis; describe findings only.' : ''}
- Match patient demographics, vitals, HPI, and canonical exam rows when provided.
- If HPI mentions CKD, ADPKD, ESRD, end-stage renal disease, elevated creatinine, oliguria with azotemia, or declining renal function, BMP must show severe azotemia (Cr typically ≥6 mg/dL, BUN ≥60 mg/dL), hyperkalemia (K+ ≥5.5 mEq/L), and low bicarbonate (≤18 mEq/L) when metabolic acidosis is in the presentation — NOT normal creatinine 0.8. Include hypoCa and hyperphosphatemia when Ca/Phos/Albumin are ordered.
- If HPI mentions CKD, ADPKD, elevated creatinine, hematuria, or declining renal function, UA must reflect hematuria/proteinuria when ordered.
- SESSION: You receive ordersPlacedSoFar and priorLabResults. If this is a REPEAT lab (occurrenceIndex > 0) or treatment was given since the last panel, values MUST change realistically (e.g. K+ down after kayexalate/insulin/fluids, Cr down after hydration/ACEi in AKI on CKD, lactate down after resuscitation). Never return an identical panel after active treatment.
- No markdown, no bullet lists, no "as an AI".`;

  const user = {
    order: orderLabel,
    orderKindHint,
    chiefComplaint: cc,
    category: caseContext.category || null,
    patientLabel: caseContext.patientFacts?.ageLabel
      ? `${caseContext.patientFacts.ageLabel} ${caseContext.patientFacts.sex || ''}`.trim()
      : null,
    diagnosisForConsistency: diagnosis ? clip(diagnosis, 200) : null,
    hpiExcerpt: clip(hpi, 1200),
    vitals: vitalsLine || null,
    canonicalExamRows: examBlock || null,
    playbookHint: playbookWhy ? clip(playbookWhy, 400) : null,
    canonicalCaseStackFinding: stackFinding ? clip(stackFinding, 300) : null,
    caseOrderStacks: cleanStacks,
    teachMeMode: Boolean(teachMeMode),
    learningMode,
    fallbackHint: fallbackText ? clip(fallbackText, 500) : null,
    occurrenceIndex: Number(trajectoryOccurrence) || 0,
    ordersPlacedSoFar: Array.isArray(orderLog)
      ? orderLog.slice(0, 24).map((o) => o?.label || o?.orderId || '')
      : [],
    priorLabResults: Array.isArray(priorLabResults)
      ? priorLabResults.slice(-6).map((r) => ({
          order: r.order || r.label || '',
          occurrence: r.occurrence ?? 0,
          resultExcerpt: clip(r.result || r.text || '', 400),
        }))
      : [],
  };

  return [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Generate the result for this order:\n${JSON.stringify(user, null, 2)}`,
    },
  ];
}

export function parseOrderResultJson(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('Empty model response');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fence ? fence[1].trim() : text;
  const parsed = JSON.parse(payload);
  const body = String(parsed.text || '').trim();
  if (!body) throw new Error('Missing text in JSON');
  return {
    kind: String(parsed.kind || 'order').trim(),
    kindLabel: String(parsed.kindLabel || 'Result').trim(),
    text: body,
  };
}
