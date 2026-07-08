import { useCallback, useEffect, useMemo, useState } from 'react';
import { CASE_AVATAR_EVENT } from '../lib/caseAvatar.js';
import { resolveSceneSrc } from '../lib/patientImage.js';
import { resolvePsychiatricCasePreviewScene } from '../lib/resolvePatientPsychiatricRef.js';
import {
  resolveUberCasePlayScene,
  resolveUberCasePreviewScene,
} from '../lib/resolvePatientUberRef.js';
import {
  clearCaseRegenImage,
  ensureCasePortrait,
  fetchCasePortraitStatus,
  readCaseRegenImage,
  writeCaseRegenImage,
} from '../lib/patientRegen.js';

/**
 * One portrait pipeline for case browser preview, briefing, and play ER scene.
 * Loads server cache → localStorage, then resolves sex-aware template fallback.
 * When preferUberPreviewPlate is true and a shipped GAME-SCENE exists, skip server gen (Tier A).
 * When preferUberPlayPlate is true, use angled GAME-PLAY-SCENE for in-case ER view.
 */
export function useCasePortraitSrc(
  caseData,
  { preferUberPreviewPlate = false, preferUberPlayPlate = false } = {},
) {
  const caseId = caseData?.id;
  const psychPreview = preferUberPreviewPlate ? resolvePsychiatricCasePreviewScene(caseData) : null;
  const uberPlay = preferUberPlayPlate ? resolveUberCasePlayScene(caseData) : null;
  const uberPreview =
    preferUberPreviewPlate && !psychPreview ? resolveUberCasePreviewScene(caseData) : null;
  const tierAPreview = psychPreview || uberPlay || uberPreview;
  const [portraitTick, setPortraitTick] = useState(0);
  const bumpPortrait = useCallback(() => setPortraitTick((n) => n + 1), []);
  const [previewSrc, setPreviewSrc] = useState(null);

  useEffect(() => {
    if (!caseId || tierAPreview?.url) return undefined;
    let cancelled = false;
    // When preferUberPreviewPlate and no uber/psych plate, try case-level _preview.png
    if (preferUberPreviewPlate) {
      fetchCasePortraitStatus(caseId, { preview: true }).then((status) => {
        if (!cancelled && status?.url) {
          setPreviewSrc(status.url);
          bumpPortrait();
        }
      });
    }
    void ensureCasePortrait(caseData).then((url) => {
      if (!cancelled && url) bumpPortrait();
    });
    return () => {
      cancelled = true;
    };
  }, [caseId, caseData?.patientSex, caseData, bumpPortrait, tierAPreview?.url, preferUberPreviewPlate]);

  useEffect(() => {
    if (!caseId) return undefined;
    const onAvatar = (e) => {
      if (String(e.detail?.caseId) !== String(caseId)) return;
      if (e.detail?.url) writeCaseRegenImage(caseId, e.detail.url);
      bumpPortrait();
    };
    window.addEventListener(CASE_AVATAR_EVENT, onAvatar);
    return () => window.removeEventListener(CASE_AVATAR_EVENT, onAvatar);
  }, [caseId, bumpPortrait]);

  const portraitForceSrc = useMemo(() => {
    void portraitTick;
    if (tierAPreview?.url) return tierAPreview.url;
    if (preferUberPreviewPlate && previewSrc) return previewSrc;
    return caseId ? readCaseRegenImage(caseId) : null;
  }, [caseId, portraitTick, tierAPreview?.url, preferUberPreviewPlate, previewSrc]);

  const portraitDisplaySrc = useMemo(
    () =>
      resolveSceneSrc({
        forceSrc: portraitForceSrc,
        sceneSrc: caseData?.patientScene?.src,
        caseData,
      }),
    [caseData, portraitForceSrc],
  );

  const setPortraitSrc = useCallback(
    (url) => {
      if (!caseId || !url) return;
      writeCaseRegenImage(caseId, url);
      bumpPortrait();
    },
    [caseId, bumpPortrait],
  );

  const clearPortraitSrc = useCallback(() => {
    if (!caseId) return;
    clearCaseRegenImage(caseId);
    bumpPortrait();
  }, [caseId, bumpPortrait]);

  return {
    portraitForceSrc,
    portraitDisplaySrc,
    portraitTick,
    bumpPortrait,
    setPortraitSrc,
    clearPortraitSrc,
  };
}
