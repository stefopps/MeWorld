// Generate cinematic smuggler-airport prevalence metaphor image via Magnific REST API
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const MAGNIFIC_API_KEY = (() => {
  const envPath = 'C:/Users/steve/MeWorld/game/.env';
  const env = readFileSync(envPath, 'utf8');
  const m = env.match(/^MAGNIFIC_API_KEY=(.+)$/m);
  return m ? m[1].trim() : '';
})();

if (!MAGNIFIC_API_KEY) {
  console.error('MAGNIFIC_API_KEY not found in game/.env');
  process.exit(1);
}

const PROMPT = `Cinematic wide shot of an international airport terminal at night, overhead security perspective. Fifty human figures in identical black hooded cloaks walk through the main concourse in formation, their faces obscured by deep shadows. Airport security lights flash red and amber, alarm indicators visible on the ceiling. Security personnel in uniform are scrambling at the edges of the frame. The scene is lit with dramatic cool fluorescent overhead lighting casting long shadows across the polished floor. There is a palpable tension — a breach. The composition should feel like a film still from a thriller: wide angle, deep depth of field, the hooded figures forming a disciplined column while ordinary travelers recoil at the edges. Photorealistic cinematic render, muted color palette with cool blue-green tones, tactical fabric texture on the hoods, glossy airport floor reflections. Overhead angle, looking down from the ceiling at a slight angle.`

const ASPECT = '16:9';
const RESOLUTION = '2K';
const COUNT = 2;

async function main() {
  const taskPath = '/v1/ai/text-to-image/nano-banana-pro';

  console.log('Creating Magnific image task...');
  console.log('Prompt length:', PROMPT.length);

  const createR = await fetch(`https://api.magnific.com${taskPath}`, {
    method: 'POST',
    headers: {
      'x-magnific-api-key': MAGNIFIC_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: PROMPT,
      aspectRatio: ASPECT,
      resolution: RESOLUTION,
      count: COUNT,
    }),
  });

  if (!createR.ok) {
    const errText = await createR.text();
    console.error(`Create failed: ${createR.status}`, errText.slice(0, 500));
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
    await new Promise(r => setTimeout(r, 2500));

    const pollR = await fetch(`https://api.magnific.com${taskPath}/${taskId}`, {
      headers: { 'x-magnific-api-key': MAGNIFIC_API_KEY },
    });

    if (!pollR.ok) {
      if (pollR.status === 429) {
        console.log('  rate limited, waiting...');
        await new Promise(r => setTimeout(r, 8000));
        continue;
      }
      const errText = await pollR.text();
      console.error(`Poll failed: ${pollR.status}`, errText.slice(0, 300));
      process.exit(1);
    }

    const payload = await pollR.json();
    const pdata = payload?.data || payload;
    const status = String(pdata?.status || '').toUpperCase();

    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`  ${elapsed}s — status: ${status}`);

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

  // Save to biostats assets
  const outDir = resolve('C:/Users/steve/MeWorld/game/study/biostats-mastery/assets/images');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const outPath = resolve(outDir, 'smuggler-airport-prevalence.png');
  writeFileSync(outPath, imgBuffer);

  console.log('Saved to:', outPath);
  console.log('File size:', (imgBuffer.length / 1024).toFixed(0), 'KB');

  // Also save a second copy with a more descriptive name
  const outPath2 = resolve(outDir, 'smuggler-airport-prevalence-metaphor.png');
  writeFileSync(outPath2, imgBuffer);
  console.log('Also saved to:', outPath2);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
