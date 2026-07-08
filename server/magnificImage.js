import crypto from 'crypto';
import { Router } from 'express';

const refStore = new Map();

const MODEL_PATH = {
  'nano-banana-pro': '/v1/ai/text-to-image/nano-banana-pro',
  'nano-banana-pro-flash': '/v1/ai/text-to-image/nano-banana-pro-flash',
  'imagen-nano-banana-2': '/v1/ai/text-to-image/nano-banana-pro',
  'imagen-nano-banana-2-flash': '/v1/ai/text-to-image/nano-banana-pro-flash',
};

export function listMagnificApiKeys() {
  const keys = [
    process.env.MAGNIFIC_API_KEY,
    process.env.MAGNIFIC_API_KEY_B2B,
    process.env.MAGNIFIC_API_KEY_LEGACY,
  ];
  return [...new Set(keys.map((k) => String(k || '').trim()).filter(Boolean))];
}

export function magnificApiKey() {
  return listMagnificApiKeys()[0] || '';
}

export function magnificImageModel() {
  const raw = String(process.env.MAGNIFIC_IMAGE_MODEL || 'imagen-nano-banana-2').trim();
  return MODEL_PATH[raw] ? raw : 'imagen-nano-banana-2';
}

export function magnificImagePath() {
  return MODEL_PATH[magnificImageModel()] || MODEL_PATH['nano-banana-pro'];
}

export function portraitImageAvailable() {
  return Boolean(magnificApiKey() || process.env.FAL_KEY);
}

export function magnificRefRouter() {
  const router = Router();
  router.get('/:token', (req, res) => {
    const token = String(req.params.token || '').replace(/\.(png|jpe?g|webp)$/i, '');
    const item = refStore.get(token);
    if (!item || Date.now() > item.expires) {
      return res.status(404).end();
    }
    res.setHeader('Content-Type', item.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(item.buffer);
  });
  return router;
}

function stashRef(imageBase64, mimeType, ttlMs = 180000) {
  const token = crypto.randomBytes(16).toString('hex');
  refStore.set(token, {
    buffer: Buffer.from(imageBase64, 'base64'),
    mimeType: mimeType || 'image/png',
    expires: Date.now() + ttlMs,
  });
  return token;
}

function publicApiBase() {
  const port = Number(process.env.PORT || process.env.SPORTMAKER_API_PORT || 3001);
  return process.env.PUBLIC_URL?.replace(/\/$/, '') || `http://127.0.0.1:${port}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Magnific REST caps prompt at 3000 chars — preserve CHARACTER LOCK tail when trimming. */
function trimMagnificPrompt(prompt, max = 2990) {
  const text = String(prompt || '');
  if (text.length <= max) return text;
  const marker = 'CHARACTER LOCK';
  const idx = text.indexOf(marker);
  if (idx >= 0) {
    const tail = text.slice(idx);
    const headBudget = max - tail.length - 4;
    if (headBudget > 400) return `${text.slice(0, headBudget)}\n…\n${tail}`;
  }
  return text.slice(0, max);
}

async function pollMagnificTask(taskPath, taskId, { timeoutMs = 180000, apiKey } = {}) {
  const key = apiKey || magnificApiKey();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const r = await fetch(`https://api.magnific.com${taskPath}/${taskId}`, {
      headers: { 'x-magnific-api-key': key },
    });
    if (!r.ok) {
      const err = await r.text();
      if (r.status === 429) {
        await sleep(8000);
        continue;
      }
      throw new Error(`Magnific task poll failed: ${err || r.status}`);
    }
    const payload = await r.json();
    const data = payload?.data || payload;
    const status = String(data?.status || '').toUpperCase();
    if (status === 'COMPLETED') {
      const urls = data?.generated;
      if (Array.isArray(urls) && urls[0]) return urls[0];
      throw new Error('Magnific task completed without image URL');
    }
    if (status === 'FAILED') {
      throw new Error(data?.message || 'Magnific image task failed');
    }
    await sleep(2500);
  }
  throw new Error('Magnific image task timed out');
}

async function createMagnificImageTask(body, { keys = listMagnificApiKeys() } = {}) {
  const taskPath = magnificImagePath();
  if (!keys.length) {
    throw new Error(
      'MAGNIFIC_API_KEY not configured — use Magnific MCP in Cursor (Kojo upload flow) or add REST key from magnific.com/developers',
    );
  }

  let created;
  let activeKey = keys[0];
  let lastErr = null;

  for (const key of keys) {
    activeKey = key;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const r = await fetch(`https://api.magnific.com${taskPath}`, {
        method: 'POST',
        headers: {
          'x-magnific-api-key': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (r.status === 429) {
        await sleep(8000 + attempt * 4000);
        continue;
      }

      if (r.status === 402) {
        lastErr = new Error(`Magnific image create failed: ${await r.text() || r.status}`);
        break;
      }

      if (!r.ok) {
        const err = await r.text();
        throw new Error(`Magnific image create failed: ${err || r.status}`);
      }

      created = await r.json();
      break;
    }
    if (created) break;
  }

  if (!created) {
    throw lastErr || new Error('Magnific image create failed: no API keys with credits');
  }

  const taskId = created?.data?.task_id || created?.task_id;
  if (!taskId) throw new Error('Magnific did not return task_id');

  const imageUrl = await pollMagnificTask(taskPath, taskId, { apiKey: activeKey });
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) throw new Error(`Could not download Magnific image (${imgResp.status})`);
  return Buffer.from(await imgResp.arrayBuffer());
}

/** Text-to-image via Beiza REST key (no reference images). */
export async function generateTextToImageWithMagnific({
  prompt,
  aspectRatio = '1:1',
  resolution = '2K',
}) {
  return createMagnificImageTask({
    prompt: trimMagnificPrompt(prompt),
    aspect_ratio: aspectRatio,
    resolution,
  });
}

/**
 * Reference-guided edit via Magnific REST (Nano Banana Pro API).
 * Kojo/MCP agents use OAuth + creations_request_upload instead — see
 * `.cursor/rules/meworld-magnific-mcp.mdc`.
 *
 * REST refs use inline data URLs (Magnific cloud cannot fetch localhost).
 */
export async function generateImageEditWithMagnific({
  imageBase64,
  mimeType = 'image/png',
  prompt,
  aspectRatio = '16:9',
  resolution = '2K',
  referenceText = 'CAMERA LOCK — match bed composition, camera angle, and room layout exactly.',
  extraReferenceImages = [],
}) {
  const mime =
    mimeType === 'image/jpeg' ? 'image/jpeg' : mimeType === 'image/webp' ? 'image/webp' : 'image/png';
  const dataUrl = `data:${mime};base64,${imageBase64}`;

  const reference_images = [
    {
      image: dataUrl,
      mime_type: mime,
      text: referenceText,
    },
    ...extraReferenceImages,
  ];

  return createMagnificImageTask({
    prompt: trimMagnificPrompt(prompt),
    aspect_ratio: aspectRatio,
    resolution,
    reference_images,
  });
}
