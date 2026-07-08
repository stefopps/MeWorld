import fsp from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { BASEPLATE_HEIGHT, BASEPLATE_WIDTH } from './portraitFrame.js';
import { normalizeCaseId } from './casePortrait.js';

export const PORTRAIT_LAYERS_VERSION = 1;

export function portraitLayerFileName(caseId, layer = 'base') {
  const slug = normalizeCaseId(caseId);
  if (!slug) return null;
  if (layer === 'base') return `${slug}.png`;
  return `${slug}_${layer}.png`;
}

export function portraitLayerPublicUrl(caseId, layer, origin, port = 3001) {
  const fileName = portraitLayerFileName(caseId, layer);
  if (!fileName) return null;
  const base =
    origin?.replace(/\/$/, '') || process.env.PUBLIC_URL?.replace(/\/$/, '') || `http://127.0.0.1:${port}`;
  return `${base}/case-portraits/${fileName}`;
}

export async function writePortraitLayer(portraitDir, caseId, layer, outB64) {
  const fileName = portraitLayerFileName(caseId, layer);
  if (!fileName) throw new Error('Invalid case id');
  const pngPath = path.join(portraitDir, fileName);
  await fsp.writeFile(pngPath, Buffer.from(outB64, 'base64'));
  return { fileName, pngPath };
}

export async function readPortraitLayers(portraitDir, caseId) {
  const baseName = portraitLayerFileName(caseId, 'base');
  const ivName = portraitLayerFileName(caseId, 'iv');
  const maskName = portraitLayerFileName(caseId, 'mask');
  const out = { base: false, iv: false, mask: false };
  for (const [key, name] of [
    ['base', baseName],
    ['iv', ivName],
    ['mask', maskName],
  ]) {
    if (!name) continue;
    try {
      await fsp.access(path.join(portraitDir, name));
      out[key] = true;
    } catch {
      /* missing */
    }
  }
  return out;
}

/** Feathered alpha mask from base vs IV pixel diff (same resolution). */
export async function deriveIvMaskFromDiff(baseBuffer, ivBuffer) {
  const w = BASEPLATE_WIDTH;
  const h = BASEPLATE_HEIGHT;
  const baseRaw = await sharp(baseBuffer).resize(w, h).ensureAlpha().raw().toBuffer();
  const ivRaw = await sharp(ivBuffer).resize(w, h).ensureAlpha().raw().toBuffer();
  const pixels = w * h;
  const mask = Buffer.alloc(pixels * 4);

  for (let i = 0; i < pixels; i += 1) {
    const bi = i * 4;
    const dr = Math.abs(ivRaw[bi] - baseRaw[bi]);
    const dg = Math.abs(ivRaw[bi + 1] - baseRaw[bi + 1]);
    const db = Math.abs(ivRaw[bi + 2] - baseRaw[bi + 2]);
    const diff = Math.max(dr, dg, db);
    const alpha = diff > 16 ? Math.min(255, (diff - 16) * 5) : 0;
    mask[bi] = 255;
    mask[bi + 1] = 255;
    mask[bi + 2] = 255;
    mask[bi + 3] = alpha;
  }

  return sharp(mask, { raw: { width: w, height: h, channels: 4 } })
    .blur(2.5)
    .png()
    .toBuffer();
}

export async function writeIvMaskLayer(portraitDir, caseId, baseBuffer, ivBuffer) {
  const maskBuf = await deriveIvMaskFromDiff(baseBuffer, ivBuffer);
  const fileName = portraitLayerFileName(caseId, 'mask');
  const pngPath = path.join(portraitDir, fileName);
  await fsp.writeFile(pngPath, maskBuf);
  return { fileName, pngPath, base64: maskBuf.toString('base64') };
}
