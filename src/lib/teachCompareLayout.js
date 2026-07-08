import { STORAGE } from './storageKeys.js';

/** @returns {'vertical' | 'landscape'} */
export function readTeachCompareLayout() {
  try {
    const v = localStorage.getItem(STORAGE.teachCompareLayout);
    return v === 'landscape' ? 'landscape' : 'vertical';
  } catch {
    return 'vertical';
  }
}

export function writeTeachCompareLayout(mode) {
  const next = mode === 'landscape' ? 'landscape' : 'vertical';
  try {
    localStorage.setItem(STORAGE.teachCompareLayout, next);
  } catch {
    /* ignore */
  }
  return next;
}
