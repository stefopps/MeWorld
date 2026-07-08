import { getCaseFlow } from '../data/caseFlows.js';
import { getPreparedCase } from './caseNarrative.js';
import {
  extractPatientFacts,
  hpiExcerpt,
  resolvePatientDemographics,
} from './patientFactsFromHpi.js';
import { resolvePatientName } from './patientName.js';
import { briefCacheKey, resolveCaseBriefMarkdown } from './caseBrief.js';
import { buildCaseDiscussionContext, discussionCacheKey } from './caseDiscussionContext.js';
import { enrichmentCacheKey } from './differentialChatEnrichment.js';
import { resolveSimulationCreativity } from './simulationCreativity.js';
import {
  attendingStyleFingerprint,
  readActiveAttendingStyleLeans,
  readAttendingStylePrefs,
} from './attendingStylePrefs.js';
import { formatVitalsLine } from './vitalsParse.js';
import { getActiveNameRegion } from './patientNameRegions.js';
import { resolvePracticeHpi } from './practiceHpi.js';
import { isLearningMode, sanitizeCaseForLearning } from './learningMode.js';
import { isUberCase } from './uberCases.js';
import { readLocalCaseBrief } from './caseBrief.js';
import { resolvePatientSex } from './patientSex.js';
import { STORAGE } from './storageKeys.js';
import { apiUrl } from './apiBase.js';
const sessions = new Map();
/** Bump when portrait/demographics logic changes — clears stale localStorage personas. */
const PORTRAIT_PERSONA_VERSION = 3;

export function buildCaseChatContext(caseData, {
  patientPersona = null,
  caseDiscussion = null,
  caseBriefMarkdown = null,
  chatMode = 'patient_sim',
} = {}) {
  const flow = getCaseFlow(caseData);
  const prepared = getPreparedCase(caseData?.id);
  const practiceHpi = resolvePracticeHpi(prepared, caseData);
  const enriched = {
    ...caseData,
    clinical_hpi_narrative:
      caseData?.clinical_hpi_narrative ||
      prepared?.hpi_narrative ||
      caseData?.hpi_narrative ||
      caseData?.historyText ||
      '',
    hpi_narrative: prepared?.hpi_narrative || caseData?.hpi_narrative,
  };
  const learningMode = isLearningMode();
  const interviewHpi =
    practiceHpi ||
    (learningMode ? caseData?.historyText : null) ||
    enriched.clinical_hpi_narrative ||
    enriched.historyText ||
    '';
  const enrichedForPatient = {
    ...enriched,
    historyText: interviewHpi || enriched.historyText,
    clinical_hpi_narrative: interviewHpi || enriched.clinical_hpi_narrative,
  };
  const resolvedSex = resolvePatientSex(enrichedForPatient);
  const patientFacts = extractPatientFacts(
    { ...enrichedForPatient, patientSex: resolvedSex },
    patientPersona,
  );
  const patientDemographics = resolvePatientDemographics(enrichedForPatient, patientPersona);
  const simulationCreativity = resolveSimulationCreativity(caseData?.id);
  const attendingStylePrefs = readAttendingStylePrefs();
  const attendingStyleLeans = { ...attendingStylePrefs.slots[attendingStylePrefs.activeSlot].leans };
  const attendingStyleSlot = attendingStylePrefs.activeSlot;
  const attendingStyleLabel = attendingStylePrefs.slots[attendingStylePrefs.activeSlot].label;
  const cleanHpi = interviewHpi.trim();
  const patientVoiceRaw = prepared?.patient_voice || caseData?.patient_voice || null;
  const patientVoice =
    patientVoiceRaw && learningMode && cleanHpi
      ? { ...patientVoiceRaw, history: cleanHpi.slice(0, 800) }
      : patientVoiceRaw;

  const ctx = {
    id: caseData?.id,
    ccsNumber: caseData?.ccsNumber,
    title: caseData?.title,
    category: caseData?.category,
    timeLimit: caseData?.timeLimit,
    playRole: caseData?.playRole || 'doctor',
    sessionDifficulty: caseData?.sessionDifficulty || 'standard',
    chatMode: chatMode === 'patient_sim' ? 'patient_sim' : 'tutor',
    simulationCreativity,
    attendingStyleLeans,
    attendingStyleSlot,
    attendingStyleLabel,
    patientName: resolvePatientName(caseData),
    patientFacts,
    patientDemographics,
    patientVoice,
    hpiExcerpt: hpiExcerpt(enrichedForPatient),
    patientSex: resolvedSex,
    nameRegion: caseData?.nameRegion || getActiveNameRegion(),
    chief_complaint: caseData?.chief_complaint,
    historyText: learningMode && cleanHpi ? cleanHpi : caseData?.historyText,
    clinical_hpi_narrative: enriched.clinical_hpi_narrative,
    vitalsText: caseData?.vitalsText,
    learningMode,
    uberFaceSlug: caseData?.uberFaceSlug || caseData?.uberMeta?.faceSlug || null,
    uberPediatricFaceSlug:
      caseData?.uberPediatricFaceSlug || caseData?.uberMeta?.pediatricFaceSlug || null,
    vitals: flow?.vitals || prepared?.vitals || caseData?.vitals,
    portraitNote: prepared?.portraitNote || caseData?.portraitNote || null,
    exam: flow?.exam,
    flowTrack: flow?.flowTrack,
    dispositionUnits: flow?.dispositionUnits,
    hasSourceIntro: prepared?.hasSourceIntro ?? caseData?.preparedMeta?.hasSourceIntro,
    interventions: (caseData?.interventions || []).map((iv) => {
      const row = {
        id: iv.id,
        label: iv.label,
        guideline: iv.guideline,
        zone: iv.correct_zone,
      };
      if (!learningMode && iv.why) row.why = iv.why;
      return row;
    }),
    algorithm: caseData?.algorithm
      ? {
          title: caseData.algorithm.title,
          steps: (caseData.algorithm.steps || []).map((s) => ({
            order: s.order,
            label: s.label,
            zoneLabel: s.zoneLabel,
          })),
        }
      : null,
  };

  if (patientPersona && typeof patientPersona === 'object') {
    ctx.patientPersona = patientPersona;
  }
  if (caseDiscussion && typeof caseDiscussion === 'object') {
    ctx.caseDiscussion = caseDiscussion;
  }
  if (caseBriefMarkdown && typeof caseBriefMarkdown === 'string') {
    ctx.caseBriefMarkdown = caseBriefMarkdown;
  }
  if (caseData?.differentialStudyContext && typeof caseData.differentialStudyContext === 'object') {
    ctx.differentialStudyContext = caseData.differentialStudyContext;
  }

  if (!ctx.vitalsText?.trim() && ctx.vitals) {
    ctx.vitalsText = formatVitalsLine(ctx.vitals);
  }

  return learningMode ? sanitizeCaseForLearning(ctx) : ctx;
}

function personaCacheKey(persona) {
  try {
    return JSON.stringify(persona || null);
  } catch {
    return '';
  }
}

function demographicsCacheKey(demographics) {
  try {
    return JSON.stringify(demographics || null);
  } catch {
    return '';
  }
}

export function readCasePortraitPersona(caseId) {
  try {
    const raw = localStorage.getItem(STORAGE.casePortraitPersona);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const persona = parsed?.[String(caseId)] || null;
    if (persona && persona.personaVersion !== PORTRAIT_PERSONA_VERSION) return null;
    return persona;
  } catch {
    return null;
  }
}

export function writeCasePortraitPersona(caseId, persona) {
  if (!caseId || !persona) return;
  try {
    const raw = localStorage.getItem(STORAGE.casePortraitPersona);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[String(caseId)] = { ...persona, personaVersion: PORTRAIT_PERSONA_VERSION };
    localStorage.setItem(STORAGE.casePortraitPersona, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export async function resolvePatientPersona(caseData) {
  const caseId = caseData?.id;
  if (!caseId) return null;

  const cached = readCasePortraitPersona(caseId);
  if (cached?.summary) return cached;

  try {
    const caseContext = buildCaseChatContext(caseData);
    const r = await fetch(apiUrl('/api/case-persona'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseContext }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.persona) {
      writeCasePortraitPersona(caseId, data.persona);
      return data.persona;
    }
  } catch {
    /* ignore */
  }

  return cached || null;
}

export async function checkCaseChatAvailable() {
  try {
    const r = await fetch(apiUrl('/api/health'));
    if (!r.ok) return false;
    const data = await r.json();
    return Boolean(data.openai || data.deepseek);
  } catch {
    return false;
  }
}

let _cachedModelLabel = null;

export async function fetchChatModelLabel() {
  if (_cachedModelLabel) return _cachedModelLabel;
  try {
    const r = await fetch(apiUrl('/api/health'));
    if (!r.ok) return null;
    const data = await r.json();
    if (data.chatProvider === 'deepseek') {
      _cachedModelLabel = data.chatModel || 'DeepSeek';
    } else if (data.chatProvider === 'openai') {
      _cachedModelLabel = data.chatModel || 'OpenAI';
    } else {
      _cachedModelLabel = null;
    }
    return _cachedModelLabel;
  } catch {
    return null;
  }
}

/** One chat session per case + mode — case JSON + portrait persona in the system prompt. */
function sessionMapKey(caseId, chatMode) {
  const mode = chatMode === 'patient_sim' ? 'patient_sim' : 'tutor';
  return `${String(caseId || '')}:${mode}`;
}

export async function ensureCaseChatSession(caseData, { chatMode = 'patient_sim' } = {}) {
  const caseId = String(caseData?.id || '');
  if (!caseId) throw new Error('Missing case id');
  const mode = chatMode === 'patient_sim' ? 'patient_sim' : 'tutor';
  const mapKey = sessionMapKey(caseId, mode);

  const patientPersona = await resolvePatientPersona(caseData);
  const caseDiscussion = buildCaseDiscussionContext(caseId);
  const draftContext = buildCaseChatContext(caseData, { patientPersona, caseDiscussion, chatMode: mode });
  let caseBriefMarkdown = readLocalCaseBrief(caseId);
  if (!caseBriefMarkdown && !isUberCase(caseId)) {
    caseBriefMarkdown = await resolveCaseBriefMarkdown(caseId, {
      caseDiscussion,
      caseContext: draftContext,
      refresh: false,
    });
  }
  const caseContext = buildCaseChatContext(caseData, {
    patientPersona,
    caseDiscussion,
    caseBriefMarkdown,
    chatMode: mode,
  });
  const personaKey = personaCacheKey(patientPersona);
  const demographicsKey = demographicsCacheKey(caseContext.patientDemographics);
  const discussionKey = discussionCacheKey(caseDiscussion);
  const briefKey = briefCacheKey(caseBriefMarkdown);
  const enrichKey = enrichmentCacheKey(caseData?.differentialStudyContext);
  // Attending style/slot is baked into the system prompt at /start — rebuild the
  // session when the learner switches slot A/B or moves the lean sliders, else the
  // change silently has no effect on the running chat.
  const styleKey = `${caseContext.attendingStyleSlot || 'a'}:${attendingStyleFingerprint(caseContext.attendingStyleLeans)}`;
  const cached = sessions.get(mapKey);

  if (
    cached?.sessionId &&
    cached.chatMode === mode &&
    cached.creativity === caseContext.simulationCreativity &&
    cached.personaKey === personaKey &&
    cached.demographicsKey === demographicsKey &&
    cached.discussionKey === discussionKey &&
    cached.briefKey === briefKey &&
    cached.enrichKey === enrichKey &&
    cached.styleKey === styleKey
  ) {
    return cached.sessionId;
  }

  sessions.delete(mapKey);
  const r = await fetch(apiUrl('/api/case-chat/start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseContext }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || 'Could not start case chat session');
  }
  sessions.set(mapKey, {
    sessionId: data.sessionId,
    caseId,
    chatMode: mode,
    creativity: caseContext.simulationCreativity,
    personaKey,
    demographicsKey,
    discussionKey,
    briefKey,
    enrichKey,
    styleKey,
  });
  return data.sessionId;
}

export function clearCaseChatSession(caseId, chatMode = null) {
  const id = String(caseId || '');
  if (!id) return;
  if (chatMode) {
    sessions.delete(sessionMapKey(id, chatMode));
    return;
  }
  sessions.delete(sessionMapKey(id, 'patient_sim'));
  sessions.delete(sessionMapKey(id, 'tutor'));
}

export function clearAllCaseChatSessions() {
  sessions.clear();
}

async function postCaseChatMessage(sessionId, message, sessionContext) {
  const r = await fetch(apiUrl('/api/case-chat/message'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, sessionContext }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

/** @param {{ caseData: object, chatMode?: string } | null} recover — retry once after server lost in-memory session */
export async function sendCaseChatMessage(
  sessionId,
  message,
  sessionContext = null,
  recover = null,
) {
  let { ok, status, data } = await postCaseChatMessage(sessionId, message, sessionContext);
  const expired =
    status === 404 &&
    String(data.error || '').toLowerCase().includes('session expired');
  if (!ok && expired && recover?.caseData) {
    clearCaseChatSession(recover.caseData.id);
    const freshId = await ensureCaseChatSession(recover.caseData, {
      chatMode: recover.chatMode || 'patient_sim',
    });
    ({ ok, status, data } = await postCaseChatMessage(freshId, message, sessionContext));
    if (ok) {
      return { reply: data.reply, sessionId: freshId };
    }
  }
  if (!ok) {
    throw new Error(data.error || 'Case chat request failed');
  }
  return { reply: data.reply, sessionId };
}
