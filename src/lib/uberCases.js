import uberManifest from '../data/uberCases.json' with { type: 'json' };
import uberExtensions from '../data/uberCaseExtensions.json' with { type: 'json' };
import { getPreparedCase } from './caseNarrative.js';
import { getAnchorCaseInterventions } from './anchorCaseBank.js';
import { resolvePlaybook } from '../data/resolvePlaybook.js';
import { buildAlgorithm, getZones } from '../data/gameData.js';

const UBER_BY_ID = new Map((uberManifest.cases || []).map((c) => [c.id, c]));

export function getUberManifest() {
  return uberManifest;
}

export function getUberDefinitions() {
  return uberManifest.cases || [];
}

export function getUberDefinition(caseId) {
  const raw = String(caseId ?? '').trim();
  return UBER_BY_ID.get(raw) || UBER_BY_ID.get(raw.toUpperCase()) || null;
}

export function isUberCase(caseId) {
  return Boolean(getUberDefinition(caseId));
}

export function getUberCaseIds() {
  return getUberDefinitions().map((c) => c.id);
}

function normalizeMemberId(id) {
  const raw = String(id ?? '').trim();
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

export function getUberCaseExtension(caseId) {
  const raw = String(caseId ?? '').trim();
  return uberExtensions.cases?.[raw] || uberExtensions.cases?.[raw.toUpperCase()] || null;
}

/** Merge interventions from member CCS cases (deduped by id or label). */
export function mergeMemberInterventions(memberCaseIds, catalog, uberCaseId = null) {
  const seen = new Set();
  const merged = [];

  for (const rawId of memberCaseIds || []) {
    const id = normalizeMemberId(rawId);
    const ccsCase =
      catalog?.cases?.find((c) => c.id === id) ||
      catalog?.cases?.find((c) => String(c.caseNumber) === id);
    if (!ccsCase) continue;

    const prepared = getPreparedCase(id);
    const anchorIvs = getAnchorCaseInterventions(id);
    const pb = resolvePlaybook(ccsCase);
    const ivs =
      prepared?.interventions?.length > 0
        ? prepared.interventions
        : anchorIvs?.length > 0
          ? anchorIvs
          : pb.interventions || [];

    for (const iv of ivs) {
      const key = iv.id || iv.label;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(iv);
    }
  }

  const ext = uberCaseId ? getUberCaseExtension(uberCaseId) : null;
  for (const iv of ext?.additionalInterventions || []) {
    const key = iv.id || iv.label;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(iv);
  }

  return merged;
}

/** Merge decoys from member prepared cases (deduped by id or label). */
export function mergeMemberDecoys(memberCaseIds) {
  const seen = new Set();
  const merged = [];

  for (const rawId of memberCaseIds || []) {
    const id = normalizeMemberId(rawId);
    const prepared = getPreparedCase(id);
    for (const d of prepared?.decoys || []) {
      const key = d.id || d.label;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(d);
    }
  }

  return merged;
}

/** Attach uber metadata and merged stacks to a base game case. */
export function enrichUberGameCase(gameCase, ccsCase, catalog) {
  const uber = getUberDefinition(ccsCase.id);
  if (!uber) return gameCase;

  const anchorId = normalizeMemberId(uber.anchorId);
  const anchorCcs = catalog?.cases?.find((c) => c.id === anchorId);
  const mergedInterventions = mergeMemberInterventions(uber.memberCaseIds, catalog, uber.id);
  const mergedDecoys = mergeMemberDecoys(uber.memberCaseIds);
  const ext = getUberCaseExtension(uber.id);
  const zones = getZones();

  const segments = (uber.memberCaseIds || []).map((rawId, i) => {
    const id = normalizeMemberId(rawId);
    const member = catalog?.cases?.find((c) => c.id === id);
    return {
      id,
      ccsNumber: member?.caseNumber || id,
      title: member?.title || id,
      label: uber.segmentLabels?.[i] || member?.title || id,
    };
  });

  const playbookForAlgo = {
    objective: uber.objective || gameCase.objective,
    interventions: mergedInterventions,
    algorithm: anchorCcs ? resolvePlaybook(anchorCcs).algorithm : null,
  };

  return {
    ...gameCase,
    title: uber.title.toUpperCase(),
    category: 'Uber Cases',
    patient_name_default: uber.patientName || gameCase.patient_name_default,
    diagnosis: gameCase.diagnosis || `Multi-domain · ${uber.domains.join(' · ')}`,
    objective: uber.objective || gameCase.objective,
    chief_complaint: ext?.chiefComplaint || uber.chiefComplaint || gameCase.chief_complaint,
    presentationTitle: uber.presentationTitle || ext?.presentationTitle || null,
    practice_hpi: ext?.practiceHpi || gameCase.practice_hpi || '',
    hpi_narrative: ext?.hpiNarrative || gameCase.hpi_narrative,
    clinical_hpi_narrative: ext?.hpiNarrative || gameCase.clinical_hpi_narrative || gameCase.hpi_narrative,
    historyText: ext?.practiceHpi || gameCase.historyText || '',
    clinical_tip: ext?.clinicalTip || gameCase.clinical_tip,
    vitals: ext?.vitals ? { ...gameCase.vitals, ...ext.vitals } : gameCase.vitals,
    interventions:
      mergedInterventions.length > 0 ? mergedInterventions : gameCase.interventions,
    decoys: mergedDecoys.length > 0 ? mergedDecoys : gameCase.decoys,
    algorithm: buildAlgorithm(playbookForAlgo, zones),
    uberFaceSlug: uber.faceSlug || null,
    uberPediatricFaceSlug: uber.pediatricFaceSlug || null,
    patientSex: uber.patientSex || (uber.pediatricFaceSlug ? 'female' : gameCase.patientSex),
    precallVideo: ext?.precallVideo || null,
    precallPoster: ext?.precallPoster || null,
    precallTitle: ext?.precallTitle || null,
    precallDurationSec: ext?.precallDurationSec || null,
    uberMeta: {
      id: uber.id,
      domains: uber.domains,
      memberCaseIds: uber.memberCaseIds.map(normalizeMemberId),
      segments,
      patientName: uber.patientName,
      presentationTitle: uber.presentationTitle || ext?.presentationTitle || null,
      briefingNote: uber.briefingNote,
      compositeHpi: Boolean(ext?.hpiNarrative),
      extensionOrderCount: ext?.additionalInterventions?.length || 0,
      faceSlug: uber.faceSlug || null,
      pediatricFaceSlug: uber.pediatricFaceSlug || null,
    },
  };
}
