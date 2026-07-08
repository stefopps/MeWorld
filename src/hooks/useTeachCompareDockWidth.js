import { useCallback, useEffect, useState } from 'react';
import { STORAGE } from '../lib/storageKeys.js';

export const TEACH_COMPARE_DOCK_DEFAULT_WIDTH = 272;
const MIN_WIDTH = 220;
const MAX_WIDTH = 560;

function clampWidth(width) {
  const vwCap = typeof window !== 'undefined' ? Math.floor(window.innerWidth * 0.52) : MAX_WIDTH;
  return Math.round(Math.min(MAX_WIDTH, vwCap, Math.max(MIN_WIDTH, width)));
}

function readStoredWidth() {
  try {
    const raw = localStorage.getItem(STORAGE.teachCompareDockWidth);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return clampWidth(parsed);
  } catch {
    /* ignore */
  }
  return TEACH_COMPARE_DOCK_DEFAULT_WIDTH;
}

export function useTeachCompareDockWidth() {
  const [width, setWidth] = useState(readStoredWidth);
  const [activeDrag, setActiveDrag] = useState(null);

  const persist = useCallback((next) => {
    const clamped = clampWidth(next);
    setWidth(clamped);
    try {
      localStorage.setItem(STORAGE.teachCompareDockWidth, String(clamped));
    } catch {
      /* ignore */
    }
    return clamped;
  }, []);

  useEffect(() => {
    const onResize = () => setWidth((prev) => clampWidth(prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!activeDrag) return undefined;

    const onMove = (event) => {
      const dx = event.clientX - activeDrag.startX;
      persist(activeDrag.startWidth - dx);
    };

    const onUp = () => setActiveDrag(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [activeDrag, persist]);

  const startResize = useCallback(
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setActiveDrag({
        startX: event.clientX,
        startWidth: width,
      });
    },
    [width],
  );

  return { width, startResize, isResizing: Boolean(activeDrag) };
}
