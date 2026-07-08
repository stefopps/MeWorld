import gameConfig from './gameConfig.json' with { type: 'json' };
import { getPreparedCase } from '../lib/caseNarrative.js';
import { hpiContainsSpoilers } from '../lib/practiceHpi.js';
import { resolvePatientSceneKey } from '../lib/patientSceneKey.js';
import { sanitizeScenePlateSrc } from '../lib/scenePlatePath.js';
import { resolvePatientSex } from '../lib/patientSex.js';
import { resolvePlaybook } from './resolvePlaybook.js';
import { getUberDefinition, enrichUberGameCase } from '../lib/uberCases.js';

export function getGameConfig() {
  return gameConfig;
}

export function getBranding() {
  return gameConfig.branding;
}

export function getZones() {
  return gameConfig.zones;
}

export function getZoneColors() {
  return gameConfig.zoneColors;
}

export function getUi() {
  return gameConfig.ui;
}

export function getDragConfig() {
  return gameConfig.drag;
}

export function getLayout() {
  return gameConfig.layout;
}

export function getPatientScene(sexOrKey = 'male') {
  const key = sexOrKey;
  let scene;
  if (key === 'pedFemale' && gameConfig.patientScenePedFemale) {
    scene = gameConfig.patientScenePedFemale;
  } else if (key === 'pedMale' && gameConfig.patientScenePedMale) {
    scene = gameConfig.patientScenePedMale;
  } else if ((key === 'female' || key === 'pedFemale') && gameConfig.patientSceneFemale) {
    scene = gameConfig.patientSceneFemale;
  } else {
    scene = gameConfig.patientScene;
  }
  if (!scene?.src) return scene;
  return {
    ...scene,
    src: sanitizeScenePlateSrc(scene.src, { sceneKey: key }),
  };
}

export function getPatientSceneForCase(caseData) {
  return getPatientScene(resolvePatientSceneKey(caseData));
}

/** Build ordered clinical steps from playbook (JSON algorithm overrides). */
export function buildAlgorithm(pb, zones) {
  if (pb.algorithm?.steps?.length) {
    return {
      title: pb.algorithm.title || pb.objective,
      steps: pb.algorithm.steps.map((s, i) => {
        const iv = pb.interventions.find((x) => x.id === s.interventionId);
        return {
          order: s.order ?? i + 1,
          label: s.label || iv?.label,
          interventionId: s.interventionId,
          zone: s.zone || iv?.correct_zone,
          zoneLabel: s.zoneLabel || zones[s.zone || iv?.correct_zone]?.label,
          mapNode: s.mapNode,
          why: iv?.why,
          guideline: iv?.guideline,
        };
      }),
    };
  }
  return {
    title: pb.objective,
    steps: pb.interventions.map((iv, i) => ({
      order: i + 1,
      label: iv.label,
      interventionId: iv.id,
      zone: iv.correct_zone,
      zoneLabel: zones[iv.correct_zone]?.label,
      why: iv.why,
      guideline: iv.guideline,
    })),
  };
}

export function resolvePlaybookForCase(ccsCase) {
  return resolvePlaybook(ccsCase);
}

/** Prefer refined order_sets for gameplay; fall back to raw stacks. */
export function resolveCaseOrders(preparedCase) {
  const rawOrders = preparedCase?.order_sets || preparedCase?.stacks || [];
  if (!Array.isArray(rawOrders) || rawOrders.length === 0) return null;
  return rawOrders;
}

export function toGameCase(ccsCase, catalog) {
  const pb = resolvePlaybook(ccsCase);
  const prepared = getPreparedCase(ccsCase.id);
  const pres = catalog?.presentations?.[ccsCase.title];
  const introText =
    prepared?.narrative?.doctor?.standard?.intro ||
    pres?.intro?.replace(/\s+/g, ' ').trim().slice(0, 500) ||
    '';
  const vitalsText =
    prepared?.vitalsText || pres?.vitals?.replace(/\s+/g, ' ').trim() || '';
  const catalogHistory = pres?.history?.replace(/\s+/g, ' ').trim() || '';
  const practiceHpi = prepared?.practice_hpi?.trim();
  const historyText =
    practiceHpi ||
    (catalogHistory && !hpiContainsSpoilers(catalogHistory) ? catalogHistory : '');
  const hpiNarrative =
    (typeof prepared?.hpi_narrative === 'string' && prepared.hpi_narrative.trim()) ||
    (typeof prepared?.narrative?.doctor?.standard?.hpi === 'string' &&
      prepared.narrative.doctor.standard.hpi.trim()) ||
    '';
  const clinicalTip = prepared?.clinical_tip || pb.clinical_tip;
  const objective = prepared?.objective || pb.objective;
  const interventions =
    prepared?.interventions?.length > 0 ? prepared.interventions : pb.interventions;
  const chiefComplaint = introText || `${ccsCase.title} — CCS Case ${ccsCase.caseNumber}`;
  const sexHint = resolvePatientSex({
    chief_complaint: introText,
    historyText,
    hpi_narrative: hpiNarrative,
    title: ccsCase.title,
    patientSex: prepared?.patientSex,
    preparedIntro: introText,
  });

  const sceneCasePayload = {
    id: ccsCase.id,
    ccsNumber: ccsCase.caseNumber,
    category: prepared?.category || ccsCase.category,
    chief_complaint: introText,
    historyText,
    hpi_narrative: hpiNarrative || undefined,
    title: ccsCase.title,
    patientSex: sexHint,
    uberFaceSlug: prepared?.uberFaceSlug || undefined,
    portraitNote: prepared?.portraitNote || undefined,
  };

  const base = {
    id: ccsCase.id,
    ccsNumber: ccsCase.caseNumber,
    title: (prepared?.title || ccsCase.title).toUpperCase(),
    presentationKey: prepared?.presentationKey || ccsCase.title,
    category: ccsCase.category,
    diagnosis: prepared?.diagnosis || pb.diagnosis || null,
    case_summary: prepared?.case_summary?.trim() || undefined,
    playbookKey: pb.playbookKey || ccsCase.title,
    chief_complaint: chiefComplaint,
    vitalsText,
    historyText,
    hpi_narrative: hpiNarrative || undefined,
    patient_name_default: prepared?.patient_name_default || undefined,
    physical_exam: prepared?.physical_exam || undefined,
    clinical_tip: clinicalTip,
    objective,
    timeLimit: ccsCase.timeLimit,
    interventions,
    zones: gameConfig.zones,
    zoneColors: gameConfig.zoneColors,
    patientScene: getPatientSceneForCase(sceneCasePayload),
    patientSex: sexHint,
    uberFaceSlug: prepared?.uberFaceSlug || undefined,
    portraitNote: prepared?.portraitNote || undefined,
    preparedMeta: prepared
      ? {
          vitalsSource: prepared.vitalsSource,
          hasSourceIntro: prepared.hasSourceIntro,
          flowTrack: prepared.flowTrack,
          presentationKey: prepared.presentationKey,
        }
      : null,
    completionThreshold: gameConfig.branding?.completionThreshold ?? 99,
    thanksDoctorVideos: gameConfig.cinematics?.thanksDoctorVideos || [],
    thanksDoctorVideo:
      gameConfig.cinematics?.thanksDoctorVideo ||
      gameConfig.cinematics?.thanksDoctorVideos?.[0] ||
      null,
    algorithm: buildAlgorithm(pb, gameConfig.zones),
    layout: gameConfig.layout,
  };

  if (ccsCase.isUber || String(ccsCase.id).startsWith('U')) {
    const uber = getUberDefinition(ccsCase.id);
    const anchorId = String(uber?.anchorId || ccsCase.uberMemberIds?.[0] || '007').padStart(3, '0');
    const anchorRaw = catalog?.cases?.find((c) => c.id === anchorId) || ccsCase;
    const anchorPrepared = getPreparedCase(anchorId);
    if (anchorPrepared && !prepared) {
      return enrichUberGameCase(
        {
          ...base,
          diagnosis: anchorPrepared.diagnosis || base.diagnosis,
          vitalsText: anchorPrepared.vitalsText || base.vitalsText,
          hpi_narrative: anchorPrepared.hpi_narrative || base.hpi_narrative,
          physical_exam: anchorPrepared.physical_exam || base.physical_exam,
          patient_name_default: anchorPrepared.patient_name_default || base.patient_name_default,
          patientSex: anchorPrepared.patientSex || base.patientSex,
        },
        ccsCase,
        catalog,
      );
    }
    return enrichUberGameCase(base, ccsCase, catalog);
  }

  return base;
}
