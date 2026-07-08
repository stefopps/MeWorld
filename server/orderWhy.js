import {
  buildImmersaOrderWhySystemPrompt,
  buildImmersaSecondOpinionOrderWhyPrompt,
} from './immersaAttendantPrompt.js';
import { buildAttendingStylePromptBlock } from './attendingStylePrompt.js';
import { getOrderMechanismHint } from './mechanismTeaching.js';
import { formatVitalsLine } from '../src/lib/vitalsParse.js';

function buildPatientTeachingAnchor(caseContext = {}, { patientAnchorDone = false } = {}) {
  const demo = caseContext.patientDemographics || {};
  const ageLabel = demo.ageLabel || demo.ageBand || null;
  const sex = caseContext.patientSex || demo.sex || null;
  const vitals =
    caseContext.vitals && typeof caseContext.vitals === 'object'
      ? caseContext.vitals
      : null;
  const vitalsLine =
    String(caseContext.vitalsText || '').trim() || (vitals ? formatVitalsLine(vitals) : '');
  const portraitNote = String(caseContext.portraitNote || '').trim();
  const injuryHint =
    portraitNote.match(/forearm|face|neck|hand|leg|bite[^.]{0,40}/i)?.[0] ||
    caseContext.patientFacts?.injurySite ||
    null;

  const who = [
    ageLabel,
    sex === 'male' ? 'man' : sex === 'female' ? 'woman' : sex,
    caseContext.patientName && caseContext.patientName !== 'Patient' ? caseContext.patientName : null,
  ]
    .filter(Boolean)
    .join(' ');

  const mandate = patientAnchorDone
    ? 'The learner already heard who this patient is and their baseline vitals earlier in this session. Do NOT reopen with full name + vitals ("Let\'s look at Mr. X — pulse…"). Start with mechanism, pronouns, or "this febrile child" — cite a vital only if this order turns on that number.'
    : 'First attending beat this session: open once with demographics + current vitals from patientAnchor, then mechanism. Do not use "Let\'s look at" filler — weave name/vitals in one tight clause, then teach.';

  return {
    who: who || 'this patient',
    vitalsLine: vitalsLine || null,
    injurySite: injuryHint,
    chiefComplaint: caseContext.chief_complaint || caseContext.title || null,
    patientAnchorDone: Boolean(patientAnchorDone),
    mandate,
  };
}

export function buildOrderWhyPrompt({
  orderLabel,
  orderId = '',
  playbookWhy = '',
  caseContext = {},
  peerReview = false,
  secondOpinionDepth = 0,
  firstOpinionDepth = 3,
  patientAnchorDone = false,
} = {}) {
  const caseId = caseContext?.id ?? caseContext?.ccsNumber ?? '';
  const cc =
    caseContext.chief_complaint ||
    caseContext.title ||
    caseContext.patientFacts?.chiefComplaint ||
    '';
  const diagnosis =
    caseContext.diagnosis ||
    caseContext.objective ||
    caseContext.clinical_tip ||
    '';
  const hpi =
    caseContext.hpiExcerpt ||
    caseContext.clinical_hpi_narrative ||
    caseContext.historyText ||
    '';
  const vitals = caseContext.vitalsText || '';
  const patientAnchor = buildPatientTeachingAnchor(caseContext, { patientAnchorDone });
  const mechanismHint =
    getOrderMechanismHint(caseId, orderId || orderLabel) ||
    (playbookWhy ? String(playbookWhy).slice(0, 400) : null);

  const user = {
    order: orderLabel,
    orderId: orderId || null,
    chiefComplaint: cc,
    caseTitle: caseContext.title || null,
    category: caseContext.category || null,
    diagnosisOrPearl: diagnosis ? String(diagnosis).slice(0, 600) : null,
    hpiExcerpt: hpi ? String(hpi).slice(0, 900) : null,
    vitals: vitals ? String(vitals).slice(0, 400) : patientAnchor.vitalsLine,
    patientAnchor,
    mechanismAnchor: mechanismHint,
    playbookHint: playbookWhy && !mechanismHint ? String(playbookWhy).slice(0, 400) : null,
  };

  const secondOpinionDepthLevels = [
    { maxWords: 45 },
    { maxWords: 65 },
    { maxWords: 80 },
    { maxWords: 95 },
  ];
  const firstOpinionDepthLevels = [
    { maxWords: 100, sentences: '2–4 sentences' },
    { maxWords: 140, sentences: '4–6 sentences' },
    { maxWords: 180, sentences: '6–8 sentences' },
    { maxWords: 220, sentences: '4–8 sentences or 2–3 short paragraphs' },
  ];
  const peerDepthIdx = Math.max(0, Math.min(3, Number(secondOpinionDepth) || 0));
  const firstDepthIdx = Math.max(0, Math.min(3, Number(firstOpinionDepth) || 0));
  const depthWords = secondOpinionDepthLevels[peerDepthIdx].maxWords;
  const firstWords = firstOpinionDepthLevels[firstDepthIdx].maxWords;
  const firstShape = firstOpinionDepthLevels[firstDepthIdx].sentences;
  const styleBlock = buildAttendingStylePromptBlock(caseContext?.attendingStyleLeans, {
    slotLabel: caseContext?.attendingStyleLabel || caseContext?.attendingStyleSlot || null,
  });

  const styleSuffix = `\n\n${styleBlock}`;

  return [
    {
      role: 'system',
      content: peerReview
        ? buildImmersaSecondOpinionOrderWhyPrompt(caseId, { maxWords: depthWords })
        : buildImmersaOrderWhySystemPrompt(caseId),
    },
    {
      role: 'user',
      content: peerReview
        ? `Second opinion — brief peer mechanism punch. NOT a repeat of the first opinion and NOT a longer lecture.

MANDATORY: 2–4 sentences max (~${depthWords} words). Lead with forcing mechanism (value/pathway → tissue failure → bedside sign). Rule-out logic in one clause is fine. Gold shape: "Low FVIII means the intrinsic pathway can't form a stable clot in the joint space — that's why you see hemarthrosis with trivial trauma. A normal PT and platelets already ruled out the liver, vitamin K, and platelet causes."

Anchor to THIS patient (pronouns OK; repeat full name + vitals only if patientAnchorDone is false and they change the punch).

${JSON.stringify(user, null, 2)}${styleSuffix}`
        : patientAnchorDone
          ? `First attending opinion — why this order belongs. First-principles interconnected teaching arc.

MANDATORY: patientAnchorDone is TRUE — learner already knows who is on the monitor. Do NOT repeat full name + vitals. Jump to mechanism for THIS order. ${firstShape}. Max ~${firstWords} words. Interconnected chains ("because" / "so"), not a feature list.

${JSON.stringify(user, null, 2)}${styleSuffix}`
          : `First attending opinion — why this order belongs. First-principles interconnected teaching arc.

MANDATORY: First rationale this session — anchor once with demographics + vitals on the monitor (cite actual numbers), then mechanism. ${firstShape}. Max ~${firstWords} words. Interconnected chains ("because" / "so"), not a feature list.

${JSON.stringify(user, null, 2)}${styleSuffix}`,
    },
  ];
}
