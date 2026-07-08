import fs from 'fs';
import {
  caseStoryBeatImagePath,
  caseStoryGridImagePath,
  readCaseStoryCache,
  resolveCaseStoryOversightImagePath,
} from './caseStoryCache.js';
import { resolveCaseStoryCharacterMap } from './caseStoryCharacterMap.js';
import { readCaseStoryCharacterLock } from './caseStoryCharacterLock.js';
import {
  auditCaseStoryLaterality,
  resolveLateralityLock,
} from '../src/lib/caseStoryLaterality.js';

export async function buildCaseStoryReadiness({
  gameRoot,
  cacheDir,
  caseId,
  caseContext = {},
  narrative = null,
  promptVersion = null,
}) {
  const cid = String(caseId || '').trim();
  const cached =
    narrative
    || (await readCaseStoryCache(cacheDir, cid, { promptVersion }).catch(() => null));
  const characterLockMarkdown = (await readCaseStoryCharacterLock(gameRoot, cid)) || '';
  const characterMap = resolveCaseStoryCharacterMap(gameRoot, caseContext);
  const laterality = resolveLateralityLock({
    caseId: cid,
    caseContext,
    characterLockMarkdown,
  });
  const lateralityAudit = cached
    ? auditCaseStoryLaterality(cached, laterality)
    : { ok: true, issues: [] };

  const chapters = cached?.chapters || [];
  const beatPaths = chapters.map((ch) => {
    const id = String(ch.id || '');
    const p = caseStoryBeatImagePath(cacheDir, cid, id);
    return { id, exists: Boolean(p && fs.existsSync(p)) };
  });

  const oversightRef = resolveCaseStoryOversightImagePath(cacheDir, cid, cached || {});
  const gridPath = caseStoryGridImagePath(cacheDir, cid);

  const hasNarrative = chapters.length > 0;
  const hasMasterImage = Boolean(oversightRef.path);
  const oversightBeatId = oversightRef.beatId;
  const oversightSource = oversightRef.source;
  const hasGridPlate = Boolean(gridPath && fs.existsSync(gridPath));
  const beatsReady = beatPaths.filter((b) => b.exists).length;
  const lateralityOk = !laterality.locked || lateralityAudit.ok;

  return {
    caseId: cid,
    characterMapUrl: characterMap?.publicUrl || null,
    characterMapFile: characterMap?.file || null,
    hasCharacterMap: Boolean(characterMap),
    hasCharacterLockDoc: Boolean(characterLockMarkdown),
    laterality,
    lateralityOk,
    lateralityIssues: lateralityAudit.issues || [],
    hasNarrative,
    hasMasterImage,
    oversightBeatId,
    oversightSource,
    hasGridPlate,
    beatCount: chapters.length,
    beatsReady,
    readyForReview:
      hasNarrative
      && Boolean(characterMap)
      && lateralityOk
      && (hasGridPlate || hasMasterImage),
  };
}
