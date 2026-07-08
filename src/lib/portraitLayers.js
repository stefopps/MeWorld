export const PORTRAIT_LAYERS_VERSION = 1;
export const IV_ORDER_ID = 'intravenous-access';

export function hasIvOrderPlaced(placed = {}) {
  return Boolean(placed?.[IV_ORDER_ID]);
}

export function portraitCacheNeedsLayers(status) {
  if (!status?.exists) return true;
  if ((status.portraitFrameVersion || 1) < 3) return true;
  if ((status.portraitLayersVersion || 0) < PORTRAIT_LAYERS_VERSION) return true;
  if (!status.layers?.iv || !status.layers?.mask) return true;
  return false;
}
