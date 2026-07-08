import baked from '../data/physicalExamPinLayout.json' with { type: 'json' };
import { physicalExamSectionForOrderLabel } from '../data/physicalExamSections.js';
import { STORAGE } from './storageKeys.js';

export const PHYSICAL_EXAM_LAYOUT_VERSION = baked.version || 1;

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

export function sectionIdForPin(pin) {
  const section = physicalExamSectionForOrderLabel(pin?.label || '');
  return section?.id || null;
}

export function isPhysicalExamPinLabel(label) {
  return Boolean(physicalExamSectionForOrderLabel(label));
}

/** Baked defaults + optional localStorage override (Save PE layout). */
export function readPhysicalExamPinLayout() {
  const base = { ...(baked.sections || {}) };
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(STORAGE.physicalExamPinLayout);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (parsed?.sections && typeof parsed.sections === 'object') {
      return { ...base, ...parsed.sections };
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function writePhysicalExamPinLayout(sections) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE.physicalExamPinLayout,
      JSON.stringify({
        version: PHYSICAL_EXAM_LAYOUT_VERSION,
        sections,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    /* ignore */
  }
}

export function getPhysicalExamPinPosition(sectionId, layout = null) {
  if (!sectionId) return null;
  const map = layout || readPhysicalExamPinLayout();
  const pos = map[sectionId];
  if (pos && typeof pos.cx === 'number' && typeof pos.cy === 'number') {
    return { cx: pos.cx, cy: pos.cy };
  }
  return null;
}

/** Attach saved cx/cy when placing a physical exam pin. */
export function applyLayoutToPhysicalExamPin(pin, layout = null) {
  const sectionId = sectionIdForPin(pin);
  if (!sectionId) return pin;
  const pos = getPhysicalExamPinPosition(sectionId, layout);
  if (!pos) return pin;
  return {
    ...pin,
    cx: pos.cx,
    cy: pos.cy,
    zoneId: pin.zoneId || 'zone-custom-1',
  };
}

/** Read positions from currently placed pins (after drag). */
export function capturePhysicalExamLayoutFromPins(pins = []) {
  const sections = {};
  for (const pin of pins) {
    const sectionId = sectionIdForPin(pin);
    if (!sectionId || pin.cx == null || pin.cy == null) continue;
    sections[sectionId] = {
      cx: round4(pin.cx),
      cy: round4(pin.cy),
    };
  }
  return sections;
}

export function formatPhysicalExamLayoutJson(sections) {
  return JSON.stringify(
    {
      version: PHYSICAL_EXAM_LAYOUT_VERSION,
      description: baked.description,
      sections,
    },
    null,
    2,
  );
}

export function formatPhysicalExamLayoutRepoSnippet(sections) {
  const body = Object.fromEntries(
    Object.entries(sections).map(([id, pos]) => [id, { cx: pos.cx, cy: pos.cy }]),
  );
  return JSON.stringify({ version: PHYSICAL_EXAM_LAYOUT_VERSION, sections: body }, null, 2);
}

export function persistPhysicalExamSectionMove(pin, cx, cy) {
  const sectionId = sectionIdForPin(pin);
  if (!sectionId) return;
  const layout = readPhysicalExamPinLayout();
  layout[sectionId] = { cx: round4(cx), cy: round4(cy) };
  writePhysicalExamPinLayout(layout);
}
