import { useCallback, useEffect, useState } from 'react';
import { STORAGE } from '../lib/storageKeys.js';
import {
  clampDockLayout,
  defaultBriefingDockLayout,
  defaultPlayDockLayout,
  readPlayDockLayout,
  writePlayDockLayout,
} from '../lib/playDockLayout.js';
import { readPlayUiFavorite } from '../lib/playUiFavorite.js';

export function usePlayDockLayout(options = {}) {
  const storageKey = options.storageKey || STORAGE.playDockLayout;
  const getDefault =
    options.getDefault ||
    (storageKey === STORAGE.briefingDockLayout
      ? defaultBriefingDockLayout
      : defaultPlayDockLayout);

  const [layout, setLayout] = useState(() => readPlayDockLayout(storageKey));
  const [activeDrag, setActiveDrag] = useState(null);

  const persist = useCallback(
    (next, { write = true } = {}) => {
      const clamped = clampDockLayout(next);
      setLayout(clamped);
      if (write) writePlayDockLayout(clamped, storageKey);
      return clamped;
    },
    [storageKey],
  );

  useEffect(() => {
    setLayout(readPlayDockLayout(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const onResize = () => {
      setLayout((prev) => clampDockLayout(prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!activeDrag) return undefined;

    const onMove = (event) => {
      const { mode, startX, startY, startLayout } = activeDrag;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (mode === 'move') {
        persist(
          {
            ...startLayout,
            x: startLayout.x + dx,
            y: startLayout.y + dy,
          },
          { write: false },
        );
        return;
      }
      if (mode === 'resize-e') {
        persist({ ...startLayout, width: startLayout.width + dx }, { write: false });
        return;
      }
      if (mode === 'resize-s') {
        persist({ ...startLayout, height: startLayout.height + dy }, { write: false });
        return;
      }
      if (mode === 'resize-se') {
        persist(
          {
            ...startLayout,
            width: startLayout.width + dx,
            height: startLayout.height + dy,
          },
          { write: false },
        );
        return;
      }
      if (mode === 'split') {
        persist(
          {
            ...startLayout,
            clinicalPx: startLayout.clinicalPx + dy,
          },
          { write: false },
        );
        return;
      }
      if (mode === 'resize-stacks') {
        const base = startLayout.stacksListPx > 0 ? startLayout.stacksListPx : 220;
        persist(
          {
            ...startLayout,
            stacksListPx: base + dy,
          },
          { write: false },
        );
      }
    };

    const onUp = () => {
      setActiveDrag(null);
      setLayout((prev) => {
        const clamped = clampDockLayout(prev);
        writePlayDockLayout(clamped, storageKey);
        return clamped;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [activeDrag, persist, storageKey]);

  const startDrag = useCallback(
    (mode, event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setActiveDrag({
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: { ...layout },
      });
    },
    [layout],
  );

  const resetLayout = useCallback(() => {
    if (storageKey === STORAGE.playDockLayout) {
      const fav = readPlayUiFavorite();
      if (fav.dockLayout) {
        persist(fav.dockLayout);
        return;
      }
    }
    persist(getDefault());
  }, [getDefault, persist, storageKey]);

  return { layout, persist, startDrag, resetLayout, isDragging: Boolean(activeDrag) };
}
