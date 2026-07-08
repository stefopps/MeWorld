/**
 * Default stack drop targets — green torso on anatomic plates (IV_ACCESS_PORTALS.json).
 * All case stacks pin here unless grid placement supplies explicit cells.
 */
export const TORSO_DROP_ZONES = ['zone-custom-1', 'zone-custom-3'];

/** Primary abdomen; alternate chest so pins don't stack on one dot. */
export function resolveStackDropZone(placementIndex = 0) {
  const idx = Math.max(0, Number(placementIndex) || 0);
  return TORSO_DROP_ZONES[idx % TORSO_DROP_ZONES.length];
}

export function isTorsoDropZone(zoneId) {
  return TORSO_DROP_ZONES.includes(zoneId);
}

/** Map any legacy correct_zone to torso for default play placement. */
export function stackDropZoneForIv(_iv, placementIndex = 0) {
  return resolveStackDropZone(placementIndex);
}
