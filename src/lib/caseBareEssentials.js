import essentialsData from '../data/caseBareEssentials.json' with { type: 'json' };
import { neutralStackOrderName } from './stackDecoys.js';

export const ORDER_TIER_META = {
  critical: {
    id: 'critical',
    label: 'Case specific',
    hint: 'Treatments, consults, and must-not-miss orders for this case',
    defaultCollapsed: false,
  },
  general: {
    id: 'general',
    label: 'General',
    hint: 'Physical exams and sex-specific workflow',
    defaultCollapsed: true,
  },
  misc: {
    id: 'misc',
    label: 'Miscellaneous',
    hint: 'Labs, imaging, and diagnostic tests',
    defaultCollapsed: true,
  },
};

function normalizeCaseId(id) {
  const raw = String(id ?? '').replace(/^case[_-]?/i, '').trim();
  if (!raw) return '';
  return raw.padStart(3, '0');
}

function findIntervention(interventions, item) {
  const byId = Object.fromEntries(interventions.map((iv) => [iv.id, iv]));
  for (const iid of item.matchInterventionIds || []) {
    if (byId[iid]) return byId[iid];
  }
  const needles = (item.matchLabels || []).map((l) => String(l).toLowerCase());
  if (!needles.length) return null;
  return (
    interventions.find((iv) => {
      const label = String(iv.label || '').toLowerCase();
      return needles.some((n) => label.includes(n));
    }) || null
  );
}

export function getCaseBareEssentialsSpec(caseData = {}) {
  const id = normalizeCaseId(caseData.id);
  const byCase = essentialsData.cases?.[id];
  if (byCase) return byCase;

  const dx = String(caseData.diagnosis || '').toLowerCase();
  for (const pat of essentialsData.diagnosisPatterns || []) {
    try {
      if (new RegExp(pat.match, 'i').test(dx)) return pat;
    } catch {
      /* skip bad pattern */
    }
  }
  return null;
}

function resolveCriticalInterventionIds(caseData = {}, interventions = []) {
  const spec = getCaseBareEssentialsSpec(caseData);
  const ids = new Set(spec?.criticalInterventionIds || []);
  for (const item of spec?.items || []) {
    const iv = findIntervention(interventions, item);
    if (iv?.id) ids.add(iv.id);
  }
  const examPatterns = (spec?.criticalExamLabelPatterns || []).map((p) =>
    String(p).toLowerCase(),
  );
  if (examPatterns.length) {
    for (const iv of interventions) {
      const label = String(iv.label || '').toLowerCase();
      if (examPatterns.some((p) => label.includes(p))) ids.add(iv.id);
    }
  }
  return ids;
}

function labelMatchesMisc(label, patterns = []) {
  const norm = String(label || '').toLowerCase();
  if (!norm) return false;
  return patterns.some((p) => norm.includes(String(p).toLowerCase()));
}

function interventionByIdMap(interventions = []) {
  return Object.fromEntries(interventions.map((iv) => [iv.id, iv]));
}

/** Sex / pregnancy screening workflow → General tier (with physical exams). */
export function isSexRelatedGeneralIntervention(iv) {
  if (!iv) return false;
  const label = String(iv.label || '');
  return /\bhcg\b|\bpregnancy test\b|\bsexual history\b|\bpelvic exam\b|\bstd\b/i.test(label);
}

/** Physical exam stacks → General tier. */
export function isPhysicalExamIntervention(iv) {
  if (!iv) return false;
  const id = String(iv.id || '').toLowerCase();
  const label = String(iv.label || '');
  return (
    id.startsWith('physical-exam')
    || /^physical exam\b/i.test(label)
    || /^physical exam:/i.test(label)
  );
}

const TEST_ORDER_PATTERNS = [
  /\bx-?ray\b/i,
  /\bct\b/i,
  /\bmri\b/i,
  /\becg\b/i,
  /\bekg\b/i,
  /\bcbc\b/i,
  /\bbmp\b/i,
  /\bcmp\b/i,
  /\blipase\b/i,
  /\btroponin\b/i,
  /\bpulse ox/i,
  /\boximetry\b/i,
  /\bantibody\b/i,
  /\belectromyography\b/i,
  /\bemg\b/i,
  /\btensilon\b/i,
  /\bedrophonium\b/i,
  /\burinalysis\b/i,
  /\bculture\b/i,
  /\bgram stain\b/i,
  /\btype and screen\b/i,
  /\bpt\b/i,
  /\bptt\b/i,
  /\binr\b/i,
  /\btsh\b/i,
  /\bhcg\b/i,
  /\bsedimentation\b/i,
  /\besr\b/i,
  /\bultrasound\b/i,
  /\becho\b/i,
  /\barterial blood\b/i,
  /\babg\b/i,
  /\blumbar puncture\b/i,
  /\bspirometry\b/i,
  /\bnaat\b/i,
  /\bdna probe\b/i,
  /\bmetabolic profile\b/i,
  /\bbasic metabolic\b/i,
  /\bcomprehensive metabolic\b/i,
];

/** Labs, imaging, and diagnostic studies → Misc tier. */
export function isTestOrderIntervention(iv) {
  if (!iv || isPhysicalExamIntervention(iv)) return false;
  if (isTreatmentOrderIntervention(iv)) return false;
  const label = String(iv.label || '');
  const id = String(iv.id || '').toLowerCase();
  return TEST_ORDER_PATTERNS.some((p) => p.test(label) || p.test(id));
}

const TREATMENT_ORDER_PATTERNS = [
  /\bdonepezil\b/i,
  /\bmemantine\b/i,
  /\brivastigmine\b/i,
  /\bgalantamine\b/i,
  /\bcholinesterase\b/i,
  /\bphototherapy\b/i,
  /\binsulin\b/i,
  /\bvasopressor\b/i,
  /\bantibiotic\b/i,
  /\btransfusion\b/i,
  /\bintubat/i,
  /\bnaloxone\b/i,
  /\bheparin\b/i,
  /\badmit for safety\b/i,
  /\bchild protective\b/i,
  /\breport to cps\b/i,
  /\bsocial work\b/i,
  /\blactation\b/i,
  /\bbreastfeeding optim/i,
  /\bcaregiver support\b/i,
  /\badvance care planning\b/i,
  /\bfactor viii\b/i,
  /\bddavp\b/i,
  /\bdesmopressin\b/i,
  /\bavoid nsaid/i,
  /\bavoid im\b/i,
  /\bbleeding precaution/i,
];

/** Medications, admits, CPS, and definitive treatments → Critical tier (visible in Teach Me). */
export function isTreatmentOrderIntervention(iv) {
  if (!iv) return false;
  const label = String(iv.label || '');
  const id = String(iv.id || '').toLowerCase();
  return TREATMENT_ORDER_PATTERNS.some((p) => p.test(label) || p.test(id));
}

/**
 * Rule of thumb: physical → general, tests → misc, case-specific → critical.
 * Explicit caseBareEssentials entries always win for critical/misc overrides.
 */
function resolveGeneralInterventionIds(
  caseData = {},
  interventions = [],
  criticalIds = new Set(),
  miscIds = new Set(),
) {
  const caseId = normalizeCaseId(caseData.id);
  const caseSpec = essentialsData.cases?.[caseId];
  const ids = new Set(caseSpec?.generalInterventionIds || []);

  const patterns = [
    ...(essentialsData.generalLabelPatterns || []),
    ...(caseSpec?.generalLabelPatterns || []),
  ];

  for (const iv of interventions) {
    if (!iv?.id || criticalIds.has(iv.id) || miscIds.has(iv.id)) continue;
    if (ids.has(iv.id)) continue;
    if (isPhysicalExamIntervention(iv)) {
      ids.add(iv.id);
      continue;
    }
    if (isSexRelatedGeneralIntervention(iv)) {
      ids.add(iv.id);
      continue;
    }
    if (labelMatchesMisc(iv.label, patterns)) ids.add(iv.id);
  }

  return ids;
}

export function classifyInterventionTier(
  iv,
  { criticalIds = new Set(), miscIds = new Set(), generalIds = new Set() } = {},
) {
  if (!iv?.id) return 'general';
  if (criticalIds.has(iv.id)) return 'critical';
  if (generalIds.has(iv.id)) return 'general';
  if (isTreatmentOrderIntervention(iv)) return 'critical';
  if (isPhysicalExamIntervention(iv)) return 'general';
  if (isSexRelatedGeneralIntervention(iv)) return 'general';
  if (miscIds.has(iv.id) || isTestOrderIntervention(iv)) return 'misc';
  return 'critical';
}

function resolveMiscInterventionIds(caseData = {}, interventions = [], criticalIds = new Set()) {
  const caseId = normalizeCaseId(caseData.id);
  const caseSpec = essentialsData.cases?.[caseId];
  const ids = new Set(caseSpec?.miscInterventionIds || []);

  const patterns = [
    ...(essentialsData.miscLabelPatterns || []),
    ...(caseSpec?.miscLabelPatterns || []),
  ];

  for (const iv of interventions) {
    if (!iv?.id || criticalIds.has(iv.id)) continue;
    if (ids.has(iv.id)) continue;
    if (labelMatchesMisc(iv.label, patterns)) ids.add(iv.id);
  }

  return ids;
}

/** Split standard-flow rows into Critical / General / Misc tiers. */
export function groupTeachCompareRowsByTier({
  rows = [],
  caseData = {},
  interventions = [],
} = {}) {
  const criticalIds = resolveCriticalInterventionIds(caseData, interventions);
  const miscIds = resolveMiscInterventionIds(caseData, interventions, criticalIds);
  const generalIds = resolveGeneralInterventionIds(
    caseData,
    interventions,
    criticalIds,
    miscIds,
  );
  const ivById = interventionByIdMap(interventions);

  const buckets = { critical: [], general: [], misc: [] };
  for (const row of rows) {
    const iv = ivById[row.id] || row.iv || { id: row.id, label: row.label };
    const tier = classifyInterventionTier(iv, { criticalIds, miscIds, generalIds });
    buckets[tier].push(row);
  }

  return ['general', 'critical', 'misc']
    .map((key) => {
      const meta = ORDER_TIER_META[key];
      const tierRows = buckets[key];
      return {
        ...meta,
        rows: tierRows,
        placedCount: tierRows.filter((r) => r.isPlaced).length,
        total: tierRows.length,
      };
    })
    .filter((tier) => tier.total > 0);
}

/** Non-negotiable orders for this case — matched to live stacks + placement status. */
export function buildBareEssentialsRows({ caseData = {}, interventions = [], placed = {} } = {}) {
  const spec = getCaseBareEssentialsSpec(caseData);
  if (!spec?.items?.length) {
    return { title: '', subtitle: '', rows: [], doneCount: 0, total: 0 };
  }

  const rows = spec.items.map((item, idx) => {
    const iv = findIntervention(interventions, item);
    const interventionId = iv?.id || null;
    const isDone = interventionId ? Boolean(placed[interventionId]) : false;
    return {
      seq: idx + 1,
      id: item.id,
      shortLabel: item.shortLabel,
      label: iv ? neutralStackOrderName(iv.label) : item.shortLabel,
      why: item.why || iv?.why || '',
      interventionId,
      isDone,
    };
  });

  const doneCount = rows.filter((r) => r.isDone).length;
  return {
    title: spec.title || 'Critical — non-negotiables',
    subtitle: spec.subtitle || '',
    rows,
    doneCount,
    total: rows.length,
  };
}
