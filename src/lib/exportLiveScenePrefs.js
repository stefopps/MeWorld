import { STORAGE } from './storageKeys.js';

/** When true, case export PNG uses live play scene (portrait + placed order pins). */
export function readExportUseLiveScene() {
  try {
    return localStorage.getItem(STORAGE.exportUseLiveScene) === '1';
  } catch {
    return false;
  }
}

export function writeExportUseLiveScene(on) {
  try {
    localStorage.setItem(STORAGE.exportUseLiveScene, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
