import { buildCaseChatContext, writeCasePortraitPersona } from './caseChat.js';
import { loadPersistedChatHistory } from './caseUserLog.js';
import {
  generateCasePortraitFromAvatarSource,
  readStoredCaseAvatarSource,
} from './caseAvatar.js';
import { writeCasePortraitBaseline } from './casePortraitBaseline.js';
import { resolvePortraitBriefForApi } from './casePortraitBrief.js';
import { getBuiltInPatientSrc, isValidSceneSrc, portraitCacheBust } from './patientImage.js';
import { PORTRAIT_LAYERS_VERSION } from './portraitLayers.js';
import { resolvePatientSex } from './patientSex.js';
import { STORAGE } from './storageKeys.js';
import { apiUrl } from './apiBase.js';

const portraitInflight = new Map();

async function fetchBuiltInImagePayload(caseData) {
  const src = getBuiltInPatientSrc(caseData);
  const resp = await fetch(src);
  if (!resp.ok) throw new Error(`Patient image not found: ${src}`);
  const blob = await resp.blob();
  const mimeType = blob.type || 'image/png';
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return {
    base64: dataUrl.split(',')[1] || '',
    mimeType,
    source: `builtin:${src}`,
  };
}

export function readCaseRegenImage(caseId) {
  try {
    const raw = localStorage.getItem(STORAGE.caseRegenImages);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const src = parsed?.[String(caseId)] || null;
    return isValidSceneSrc(src) ? src : null;
  } catch {
    return null;
  }
}

export function writeCaseRegenImage(caseId, dataUrl) {
  try {
    const raw = localStorage.getItem(STORAGE.caseRegenImages);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[String(caseId)] = dataUrl;
    localStorage.setItem(STORAGE.caseRegenImages, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function clearCaseRegenImage(caseId) {
  try {
    const raw = localStorage.getItem(STORAGE.caseRegenImages);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    delete parsed[String(caseId)];
    localStorage.setItem(STORAGE.caseRegenImages, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function clearCaseSceneVariantsForSig(sceneSourceSig) {
  if (!sceneSourceSig) return;
  try {
    const raw = localStorage.getItem(STORAGE.sceneVariants);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    delete parsed[sceneSourceSig];
    localStorage.setItem(STORAGE.sceneVariants, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function clearSceneVariantUnit(sceneSourceSig, unit) {
  if (!sceneSourceSig || !unit) return;
  try {
    const raw = localStorage.getItem(STORAGE.sceneVariants);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const bucket = parsed[sceneSourceSig];
    if (!bucket || typeof bucket !== 'object') return;
    delete bucket[unit];
    if (Object.keys(bucket).length === 0) delete parsed[sceneSourceSig];
    localStorage.setItem(STORAGE.sceneVariants, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function buildSceneSourceSig(caseData, erSrc) {
  const sex = resolvePatientSex(caseData);
  return `${caseData.id}:${sex}:${erSrc.slice(0, 96)}:${erSrc.length}`;
}

export async function fetchCasePortraitStatus(caseId, { preview = false } = {}) {
  if (!caseId) return { exists: false, url: null };
  try {
    const params = preview ? '?preview=1' : '';
    const r = await fetch(apiUrl(`/api/case-portrait/${encodeURIComponent(caseId)}${params}`));
    if (!r.ok) return { exists: false, url: null };
    const data = await r.json();
    if (data.exists && data.url) {
      if (!preview && data.persona) writeCasePortraitPersona(caseId, data.persona);
      const busted = portraitCacheBust(
        data.url,
        data.cachedAt || data.ladyRefSlug || data.patientSex || caseId,
      );
      // Only cache the main portrait, not previews
      if (!preview) writeCaseRegenImage(caseId, busted);
      return {
        exists: true,
        url: busted,
        baselineUrl: data.baselineUrl || null,
        hasBaseline: Boolean(data.hasBaseline),
        layers: data.layers || null,
        analysis: data.analysis || null,
        persona: data.persona || null,
        cachedAt: data.cachedAt || null,
        sourceVideo: data.sourceVideo || null,
        patientSex: data.patientSex || null,
        uberRefSlug: data.uberRefSlug || null,
        ladyRefSlug: data.ladyRefSlug || null,
        portraitFrameVersion: data.portraitFrameVersion || 1,
        portraitLayersVersion: data.portraitLayersVersion || 0,
      };
    }
    return { exists: false, url: null };
  } catch {
    return { exists: false, url: null };
  }
}

/** Load or generate a case-specific patient portrait (Magnific Nano Banana, server disk cache). */
export async function ensureCasePortrait(caseData, { refresh = false } = {}) {
  const caseId = caseData?.id;
  if (!caseId) return null;

  const expectedSex = resolvePatientSex(caseData);

  const storePortraitUrl = (status) => {
    if (!status?.url) return null;
    const busted = portraitCacheBust(
      status.url,
      status.cachedAt || status.ladyRefSlug || expectedSex,
    );
    writeCaseRegenImage(caseId, busted);
    return busted;
  };

  // Manual-only generation. On load (non-refresh): serve the cached portrait if one
  // exists, otherwise fall back to the DEFAULT sex-aware plate (male / female /
  // pediatric) — never generate. A portrait is only built when the user explicitly
  // presses Regenerate (refresh:true), optionally after attaching a character ref.
  if (!refresh) {
    const status = await fetchCasePortraitStatus(caseId);
    if (status.exists && status.url) {
      return storePortraitUrl(status);
    }
    clearCaseRegenImage(caseId);
    return getBuiltInPatientSrc(caseData);
  }

  const avatarSource = readStoredCaseAvatarSource(caseId);
  const genKey = avatarSource?.youtubeId ? 'avatar-video' : 'builtin';
  const key = `${caseId}:${genKey}:${refresh ? 'refresh' : 'gen'}`;
  if (portraitInflight.has(key)) return portraitInflight.get(key);

  const work = (async () => {
    try {
      if (avatarSource?.youtubeId) {
        return await generateCasePortraitFromAvatarSource(caseData, { refresh });
      }
      const result = await regeneratePatientFromCase(caseData, { refresh });
      return result.dataUrl;
    } catch {
      return null;
    } finally {
      portraitInflight.delete(key);
    }
  })();
  portraitInflight.set(key, work);
  return work;
}

/** Base template image + case JSON → analyzed & reconstructed patient (once cached per case/context). */
export async function regeneratePatientFromCase(
  caseData,
  {
    refresh = false,
    sessionContext = null,
    sessionUpdate = false,
  } = {},
) {
  const payload = await fetchBuiltInImagePayload(caseData);
  const caseContext = buildCaseChatContext(caseData);
  const chatMessages = await loadPersistedChatHistory(caseData?.id);

  const portraitBrief = resolvePortraitBriefForApi(caseData.id);
  const useSession =
    sessionUpdate
    || Boolean(sessionContext?.hasSessionData);

  const r = await fetch(apiUrl('/api/regenerate-patient-from-case'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: payload.base64,
      mimeType: payload.mimeType,
      caseContext,
      portraitBrief,
      chatMessages,
      sessionContext,
      sessionUpdate: useSession,
      refresh,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || 'Could not regenerate patient from presentation');
  }

  const resolvedUrl = data.dataUrl || data.url;
  if (!resolvedUrl) throw new Error('No regenerated patient image returned');

  const busted = portraitCacheBust(resolvedUrl, data.cachedAt || data.patientSex || caseData.id);
  writeCaseRegenImage(caseData.id, busted);
  if (data.persona) writeCasePortraitPersona(caseData.id, data.persona);
  if (data.baselineUrl) writeCasePortraitBaseline(caseData.id, data.baselineUrl);
  return {
    dataUrl: busted,
    baselineUrl: data.baselineUrl || null,
    hasBaseline: Boolean(data.hasBaseline || data.baselineUrl),
    sessionPortrait: Boolean(data.sessionPortrait),
    directorBriefSource: data.directorBriefSource || null,
    cached: Boolean(data.cached),
    layers: data.layers || null,
    analysis: data.analysis || null,
    persona: data.persona || null,
    portraitLayersVersion: data.portraitLayersVersion || PORTRAIT_LAYERS_VERSION,
  };
}
