// Regenerate smuggler-airport scene with MeWorld style references attached
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const envPath = 'C:/Users/steve/MeWorld/game/.env';
const env = readFileSync(envPath, 'utf8');
const m = env.match(/^MAGNIFIC_API_KEY=(.+)$/m);
const MAGNIFIC_API_KEY = m ? m[1].trim() : '';

if (!MAGNIFIC_API_KEY) {
  console.error('MAGNIFIC_API_KEY not found in game/.env');
  process.exit(1);
}

// ── Style references to attach ──
const refPaths = [
  'C:/Users/steve/MeWorld/game/game/dev/scene-camera-lock/references/case-154-camera-lock-gold.png',
  'C:/Users/steve/MeWorld/game/game/dev/anatomic-plates/raw/male-ed-anatomic-plate-a.png',
];

const references = [];
for (const p of refPaths) {
  if (existsSync(p)) {
    const buf = readFileSync(p);
    references.push({ type: 'image', image: buf.toString('base64') });
    console.log('Attached ref:', basename(p), '(' + (buf.length / 1024).toFixed(0) + ' KB)');
  } else {
    console.log('Ref missing (skipped):', basename(p));
  }
}

// ── MeWorld style lock (embedded in prompt) ──
// This is NOT a hospital scene — it's an airport metaphor. But the visual craft MUST
// match MeWorld's approved game-engine style.
const STYLE_LOCK = `
VISUAL STYLE LOCK (MeWorld game engine craft — mandatory):
GENRE: Cinematic film-still CGI — tactile sculptural stylized realism. Muted palette with cool tones (blues, greys, deep shadows). Naughty Dog / cinematic game-engine render quality — photographic-game-engine hybrid. Smooth 3D sculptural surfaces with ambient occlusion, soft global illumination, subtle subsurface scattering on skin, tactile fabric textures. Gentle specular on polished surfaces (floor, metal). NO line art, NO comic strokes, NO tilt-shift miniature, NO photoreal DSLR raw photo, NO stock-photo polish, NO oversaturated colors. The style reference images attached show the target sculptural CGI render caliber — match their surface treatment, lighting model, and color grading exactly. This is a game engine cinematic still, not a live-action photograph.`.trim();

// ── The cinematic prompt ──
const PROMPT = `Cinematic wide shot of an international airport terminal at night, overhead security perspective looking down from the high ceiling. Fifty human figures in identical black hooded full-body cloaks walk through the main concourse in disciplined formation, their faces completely obscured by deep shadow within the hoods. The hoods are tactical fabric — texture driven by AO and GI, not illustration. Airport security lights flash red and amber, alarm indicators visible on the ceiling panels. Security personnel in uniform are scrambling at the edges of the frame, gesturing. Ordinary travelers recoil against the walls. The scene is lit with dramatic cool fluorescent overhead lighting casting long shadows across the polished glossy floor. There is a palpable tension — a breach. Wide angle lens, deep depth of field, the hooded figures forming a disciplined column. The composition should feel like a film still from a thriller.

${STYLE_LOCK}`;

const ASPECT = '16:9';
const RESOLUTION = '2K';
const COUNT = 2;

async function main() {
  const taskPath = '/v1/ai/text-to-image/nano-banana-pro';

  console.log('\nPrompt length:', PROMPT.length, 'chars');
  console.log('References:', references.length, '\n');

  // Create task
  const body = {
    prompt: PROMPT,
    aspectRatio: ASPECT,
    resolution: RESOLUTION,
    count: COUNT,
  };
  if (references.length) body.references = references;

  const createR = await fetch('https://api.magnific.com' + taskPath, {
    method: 'POST',
    headers: {
      'x-magnific-api-key': MAGNIFIC_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!createR.ok) {
    const errText = await createR.text();
    console.error('Create failed:', createR.status, errText.slice(0, 500));
    process.exit(1);
  }

  const created = await createR.json();
  const data = created?.data || created;
  const taskId = data?.task_id;
  console.log('Task created:', taskId);

  // Poll
  const started = Date.now();
  const TIMEOUT = 180000;
  let imageUrl = null;

  while (Date.now() - started < TIMEOUT) {
    await new Promise(r => setTimeout(r, 3000));

    const pollR = await fetch('https://api.magnific.com' + taskPath + '/' + taskId, {
      headers: { 'x-magnific-api-key': MAGNIFIC_API_KEY },
    });

    if (!pollR.ok) {
      if (pollR.status === 429) {
        console.log('  rate limited, waiting...');
        await new Promise(r => setTimeout(r, 8000));
        continue;
      }
      const errText = await pollR.text();
      console.error('Poll failed:', pollR.status, errText.slice(0, 300));
      process.exit(1);
    }

    const payload = await pollR.json();
    const pdata = payload?.data || payload;
    const status = String(pdata?.status || '').toUpperCase();

    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log('  ' + elapsed + 's — status:', status);

    if (status === 'COMPLETED') {
      const urls = pdata?.generated;
      if (Array.isArray(urls) && urls[0]) {
        imageUrl = urls[0];
        break;
      }
      console.error('Completed but no URLs');
      process.exit(1);
    }

    if (status === 'FAILED') {
      console.error('Task failed:', pdata?.message || 'unknown');
      process.exit(1);
    }
  }

  if (!imageUrl) {
    console.error('Timed out after', TIMEOUT / 1000, 'seconds');
    process.exit(1);
  }

  console.log('Image URL:', imageUrl);

  // Download
  const imgR = await fetch(imageUrl);
  if (!imgR.ok) {
    console.error('Download failed:', imgR.status);
    process.exit(1);
  }

  const imgBuffer = Buffer.from(await imgR.arrayBuffer());

  // Save
  const outDir = resolve(root, '..', 'assets', 'images');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const outPath = resolve(outDir, 'smuggler-airport-prevalence-v2.png');
  writeFileSync(outPath, imgBuffer);

  console.log('\nSaved:', outPath);
  console.log('File size:', (imgBuffer.length / 1024).toFixed(0), 'KB');
  console.log('Style refs attached:', references.length);
  console.log('\nDone — regenerated with MeWorld style lock + 154 camera ref + male ED baseplate');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
