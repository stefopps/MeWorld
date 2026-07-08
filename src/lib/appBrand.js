import gameConfig from '../data/gameConfig.json' with { type: 'json' };

const branding = gameConfig.branding ?? {};

/** User-visible product name — change once in `gameConfig.json` → `branding.productName`. */
export const APP_PRODUCT_NAME = String(branding.productName || 'MeWorld').trim() || 'MeWorld';
