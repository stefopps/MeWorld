/**
 * Default stack drop targets — green torso on anatomic plates (IV_ACCESS_PORTALS.json).
 * Extra catalog orders use the same torso pins as case stacks.
 */
import { resolveStackDropZone, TORSO_DROP_ZONES, isTorsoDropZone, stackDropZoneForIv } from './torsoDropZone.js';

export { TORSO_DROP_ZONES, isTorsoDropZone, resolveStackDropZone, stackDropZoneForIv };

/** @deprecated Use stackDropZoneForIv — extras land on green torso, not arm/monitor. */
export function zoneForExtraOrder(_category, _label = '', placementIndex = 0) {
  return resolveStackDropZone(placementIndex);
}

export function extraOrderPinId(label) {
  const key = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `extra-order-${key || 'unknown'}`;
}
