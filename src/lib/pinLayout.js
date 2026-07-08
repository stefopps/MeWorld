import { getPhysicalExamPinPosition, sectionIdForPin } from './physicalExamPinLayout.js';

/** Vertical offset per additional pin in the same zone (in 0-1 space). */
const ZONE_STACK_STEP = 0.045;

function isPhysicalExamPin(pin) {
  const label = String(pin?.label || '');
  const id = String(pin?.ivId || '').toLowerCase();
  return id.startsWith('phys-exam') || /^physical exam\b/i.test(label);
}

/**
 * @param frame - { left, top, w, h } in scene percent (same as Play imageFrame * 100)
 */
export function computePinDisplayPercent(pin, zones, frame, index = 0) {
  const frameLeft = frame?.left ?? 0;
  const frameTop = frame?.top ?? 0;
  const frameW = frame?.w ?? 100;
  const frameH = frame?.h ?? 100;

  // User-dragged or free-drop position — return as-is (no clamping).
  if (pin.cx != null && pin.cy != null) {
    return {
      leftPct: pin.cx * 100,
      topPct: pin.cy * 100,
    };
  }

  const z = zones?.[pin.zoneId];
  if (!z) return null;
  let leftPct = frameLeft + z.cx * frameW;
  let topPct = frameTop + z.cy * frameH;

  // Zone-based vertical stacking: offset each subsequent pin in the same zone
  if (!isPhysicalExamPin(pin) && index > 0) {
    topPct += index * ZONE_STACK_STEP * frameH;
  }

  if (isPhysicalExamPin(pin)) {
    const sectionId = sectionIdForPin(pin);
    const saved = sectionId ? getPhysicalExamPinPosition(sectionId) : null;
    if (saved) {
      return {
        leftPct: saved.cx * 100,
        topPct: saved.cy * 100,
      };
    }
    const rail = index % 2 === 0 ? 0.04 : 0.9;
    const stack = Math.floor(index / 2);
    return {
      leftPct: frameLeft + rail * frameW,
      topPct: frameTop + (0.1 + stack * 0.08) * frameH,
    };
  }

  return { leftPct, topPct };
}
