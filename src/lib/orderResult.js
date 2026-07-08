/**
 * Patient-facing results for placed orders — exam findings, labs, imaging, procedures.
 * Practice mode: objective values/findings only. Teach Me mode: adds interpretation cues.
 */

import { getPreparedCase } from './caseNarrative.js';
import { resolveLabPanelResult, resolveSingleLabResult } from './labPanelValues.js';
import { mergeCleanCaseIntoCtx } from './cleanCaseClinical.js';
import { resolveTrajectoryOrderResult } from './clinicalTrajectory/index.js';

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function examRows(exam) {
  if (!Array.isArray(exam)) return [];
  return exam
    .map((row) => {
      if (Array.isArray(row) && row.length >= 2) {
        return { system: String(row[0] || '').trim(), finding: String(row[1] || '').trim() };
      }
      return null;
    })
    .filter(Boolean);
}

const PHYS_EXAM_ALIASES = [
  { re: /general appearance/i, keys: ['general'] },
  { re: /chest|lung/i, keys: ['respiratory', 'chest', 'pulmonary'] },
  { re: /heart|cardiovascular/i, keys: ['cardiovascular', 'cardiac', 'heart'] },
  { re: /abdomen/i, keys: ['abdominal', 'abdomen', 'gi'] },
  { re: /genital|pelvic/i, keys: ['genitourinary', 'genital', 'pelvic', 'gu'] },
  { re: /heent|neck/i, keys: ['heent', 'head', 'ent'] },
  { re: /skin/i, keys: ['skin'] },
  { re: /neuro|psych/i, keys: ['neurological', 'neuro', 'psych'] },
  { re: /extremit|spine|musculoskeletal/i, keys: ['extremities', 'musculoskeletal', 'msk'] },
];

function matchExamSystem(system, keys) {
  const s = norm(system);
  return keys.some((k) => s === k || s.startsWith(k) || s.includes(k));
}

export function resolvePhysicalExamResult(label, exam) {
  if (!/physical exam/i.test(label || '')) return null;
  const rows = examRows(exam);
  if (!rows.length) return null;

  for (const { re, keys } of PHYS_EXAM_ALIASES) {
    if (!re.test(label)) continue;
    const hit = rows.find((r) => matchExamSystem(r.system, keys));
    if (hit?.finding) return hit.finding;
  }

  const subsection = label.replace(/^physical exam:\s*/i, '').trim();
  if (subsection) {
    const sub = norm(subsection);
    const loose = rows.find((r) => {
      const sys = norm(r.system);
      return sys.includes(sub) || sub.includes(sys);
    });
    if (loose?.finding) return loose.finding;
  }
  return null;
}

function isDkaContext(diagnosis, hpi) {
  const blob = `${diagnosis} ${hpi}`;
  return /diabetic keto|dka|ketoacidosis/i.test(blob);
}

function labResultForLabel(label, ctx, teachMeMode) {
  const l = norm(label);
  const { diagnosis = '', vitals = {}, hpi = '', why = '', caseId, category, chiefComplaint } = ctx;
  const panelCtx = { diagnosis, vitals, hpi, why, caseId, category, chiefComplaint };
  const dka = isDkaContext(diagnosis, hpi);

  const panelResult = resolveLabPanelResult(label, panelCtx, teachMeMode);
  if (panelResult) return panelResult;

  const singleLab = resolveSingleLabResult(label, panelCtx, teachMeMode);
  if (singleLab) return singleLab;

  if (/hcg|pregnancy/i.test(l)) {
    return teachMeMode
      ? 'β-hCG negative (serum). Not pregnant.'
      : 'β-hCG negative (qualitative urine).';
  }
  if (/hemoglobin a1c|hba1c|a1c/i.test(l)) {
    return teachMeMode && dka
      ? 'HbA1c 11.8% — consistent with poorly controlled / new-onset diabetes.'
      : 'HbA1c 11.8%.';
  }
  if (/arterial blood|abg|\babg\b/i.test(l)) {
    return teachMeMode && dka
      ? 'pH 7.18, pCO₂ 28, HCO₃⁻ 12, glucose 598. Anion gap metabolic acidosis.'
      : 'pH 7.18. pCO₂ 28 mmHg. HCO₃⁻ 12 mEq/L. Glucose 598 mg/dL.';
  }
  if (/troponin/i.test(l)) {
    return teachMeMode
      ? 'Troponin undetectable on serial sampling.'
      : 'Troponin <0.04 ng/mL.';
  }
  if (/lactate/i.test(l)) {
    const val = vitals.lactate != null ? vitals.lactate : 1.8;
    return `Lactate ${val} mmol/L.`;
  }
  if (/culture|blood draw/i.test(l)) {
    return teachMeMode
      ? 'Specimens sent — preliminary: no growth at 24 hours.'
      : 'Specimens sent. Preliminary culture pending.';
  }

  if (teachMeMode) {
    const fromWhy = whyAsClinicalResult(why);
    if (fromWhy && /lab|blood|glucose|electrolyte/i.test(l + why)) return fromWhy;
  }
  return null;
}

function imagingResultForLabel(label, ctx, teachMeMode) {
  const l = norm(label);
  const { diagnosis = '', hpi = '', why = '' } = ctx;
  const dka = isDkaContext(diagnosis, hpi);

  if (/chest x|cxr|\bx-ray\b.*chest/i.test(l)) {
    return 'Heart size normal. Lungs clear without focal consolidation, effusion, or pneumothorax.';
  }
  if (/ct.*abdomen|abdomen.*ct/i.test(l)) {
    return teachMeMode && dka
      ? 'No free air or acute surgical abdomen. Fatty infiltration of liver noted. Prioritize metabolic treatment for DKA.'
      : 'No free air. No acute surgical findings. Fatty infiltration of liver.';
  }
  if (/ct.*chest|pe protocol/i.test(l)) {
    return teachMeMode
      ? 'No pulmonary embolism. No parenchymal opacity requiring intervention.'
      : 'No pulmonary embolism. Lungs clear.';
  }
  if (/mri|ultrasound|sonograph|\bus\b/i.test(l)) {
    return teachMeMode
      ? 'Study completed — see full report in chart; no immediate life threat reported.'
      : 'Study completed. Full report in chart.';
  }
  if (/ecg|ekg|electrocardiog/i.test(l)) {
    return teachMeMode
      ? 'Sinus tachycardia. No ST elevation. QTc within normal limits.'
      : 'Sinus tachycardia. No ST elevation.';
  }

  if (teachMeMode) {
    const fromWhy = whyAsClinicalResult(why);
    if (fromWhy && /ct|mri|x-ray|imaging|ultrasound/i.test(l)) return fromWhy;
  }
  return null;
}

function procedureResultForLabel(label, ctx, teachMeMode) {
  const l = norm(label);
  const dka = isDkaContext(ctx.diagnosis, ctx.hpi);

  if (/intravenous access|\biv access\b|\bpiv\b|peripheral iv/i.test(l)) {
    return '18-gauge peripheral IV placed in the right forearm. Blood return confirmed; line flushes easily.';
  }
  if (/central line|picc/i.test(l)) {
    return 'Central venous access obtained under sterile technique. Tip position confirmed.';
  }
  if (/foley|urinary catheter/i.test(l)) {
    return 'Foley catheter placed. Urine amber; adequate output documented.';
  }
  if (/intubat|airway/i.test(l)) {
    return 'Airway secured. Endotracheal tube placement confirmed with waveform capnography.';
  }
  if (/papanicolaou|pap smear|hpv dna/i.test(l)) {
    return 'Pap sample obtained. HPV co-testing sent to pathology.';
  }
  if (/tdap|tetanus/i.test(l)) {
    return 'Tdap 0.5 mL administered IM (deltoid). Tolerated without immediate reaction.';
  }
  if (/hpv vaccine/i.test(l)) {
    return 'HPV vaccine dose documented per immunization schedule. Observation period uneventful.';
  }
  if (/insulin/i.test(l)) {
    return teachMeMode && dka
      ? 'Regular insulin infusion started after K⁺ verified (>3.3). Rate per DKA protocol; glucose checks q1h.'
      : 'Regular insulin infusion running. Glucose checks per protocol.';
  }
  if (/normal saline|lactated|ringer|0\.45% saline|iv fluid/i.test(l)) {
    return teachMeMode
      ? 'Isotonic IV fluids running wide open initially, then adjusted per BMP and urine output.'
      : 'IV fluids infusing per order.';
  }
  if (/potassium|kcl|k citrate|k phosphate/i.test(l)) {
    return teachMeMode
      ? 'Potassium repletion initiated after BMP reviewed. Repeat K⁺ per protocol before escalating insulin.'
      : 'Potassium repletion ordered per BMP.';
  }
  if (/advise|instruct|counsel|education/i.test(l)) {
    return teachMeMode
      ? 'Counseling documented in chart. Patient verbalized understanding of key safety points.'
      : 'Counseling documented in chart.';
  }
  return null;
}

/** Turn rationale phrasing into a chart-style result when possible. */
export function whyAsClinicalResult(why) {
  const w = String(why || '').trim();
  if (!w) return null;
  if (/^will (show|find|reveal|demonstrate)\s+/i.test(w)) {
    return w
      .replace(/^will (show|find|reveal|demonstrate)\s+/i, '')
      .replace(/^that\s+/i, '')
      .replace(/\.$/, '')
      .concat('.');
  }
  if (/^patient (is|appears|has)\s+/i.test(w)) return w;
  if (/^(glucose|wbc|hb|sodium|potassium|ph)\b/i.test(w)) return w;
  if (/^(no |negative|positive|elevated|decreased)/i.test(w)) return w;
  return null;
}

export function classifyOrderKind(label) {
  const l = norm(label);
  if (/physical exam/i.test(l)) return { kind: 'exam', kindLabel: 'Exam finding' };
  if (/ct |mri|x-ray|cxr|ultrasound|sonograph|imaging|ekg|ecg/i.test(l)) {
    return { kind: 'imaging', kindLabel: 'Imaging result' };
  }
  if (
    /cbc|bmp|cmp|lab|blood|urinalysis|ua\b|hcg|a1c|abg|troponin|culture|lactate|complement|anti-dsdna|anti-smith|\bana\b|antinuclear|\besr\b|\bcrp\b|d-dimer|\bbnp\b|\btsh\b|lipase|amylase|coombs|ferritin|procalcitonin|rheumatoid|anti-ccp|\binr\b|\bptt\b|serolog|antibody|titer/i.test(
      l,
    )
  ) {
    return { kind: 'lab', kindLabel: 'Lab result' };
  }
  if (/advise|instruct|counsel|vaccine|smear/i.test(l)) {
    return { kind: 'counseling', kindLabel: 'Done' };
  }
  if (/insulin|saline|fluid|access|line|catheter|intubat/i.test(l)) {
    return { kind: 'procedure', kindLabel: 'Procedure note' };
  }
  return { kind: 'order', kindLabel: 'Result' };
}

/**
 * @returns {{ kind: string, kindLabel: string, text: string } | null}
 */
export function resolveOrderResult(
  intervention,
  { caseData, caseFlow, teachMeMode = false, cleanCase = null, orderLog = null, liveAttendantLabs = true } = {},
) {
  if (!intervention?.label) return null;

  const label = intervention.label;

  const trajectoryHit = resolveTrajectoryOrderResult(intervention, {
    caseId: caseData?.id,
    orderLog: orderLog || undefined,
    teachMeMode,
  });
  if (trajectoryHit) return trajectoryHit;
  const prepared = getPreparedCase(caseData?.id);
  const exam =
    (Array.isArray(prepared?.exam) && prepared.exam.length ? prepared.exam : null) ||
    caseFlow?.exam ||
    caseData?.physical_exam ||
    [];
  const vitals = caseFlow?.vitals || caseData?.preparedVitals || {};
  const merged = mergeCleanCaseIntoCtx(
    {
      diagnosis: caseData?.diagnosis || prepared?.diagnosis || '',
      hpi:
        caseData?.hpi_narrative ||
        caseData?.clinical_hpi_narrative ||
        caseData?.historyText ||
        '',
      chiefComplaint: caseData?.chief_complaint || prepared?.patient_voice?.chief_complaint || '',
      category: caseData?.category || prepared?.category || '',
    },
    cleanCase,
    label,
  );
  const diagnosis = merged.diagnosis || '';
  const hpi = merged.hpi || '';
  const why = intervention.why || '';
  const ctx = {
    diagnosis,
    vitals,
    hpi,
    why,
    stackFinding: merged.stackFinding || '',
    caseId: caseData?.id,
    category: merged.category,
    chiefComplaint: merged.chiefComplaint,
  };

  const meta = classifyOrderKind(label);

  const phys = resolvePhysicalExamResult(label, exam);
  if (phys) return { ...meta, kind: 'exam', kindLabel: 'Exam finding', text: phys };

  if (!liveAttendantLabs) {
    const lab = labResultForLabel(label, ctx, teachMeMode);
    if (lab) return { ...meta, kind: 'lab', kindLabel: 'Lab result', text: lab };
  }

  const imaging = imagingResultForLabel(label, ctx, teachMeMode);
  if (imaging) return { ...meta, kind: 'imaging', kindLabel: 'Imaging result', text: imaging };

  const proc = procedureResultForLabel(label, ctx, teachMeMode);
  if (proc) return { ...meta, text: proc };

  if (teachMeMode) {
    const fromWhy = whyAsClinicalResult(why);
    if (fromWhy) return { ...meta, text: fromWhy };

    if (why && !/^important to|^good practice|^every |^mainstay|^this is the presenting/i.test(why)) {
      return { ...meta, text: why };
    }
  }

  return {
    ...meta,
    text: teachMeMode
      ? `${label} — completed. See timeline for sequence.`
      : `${label} — completed.`,
  };
}
