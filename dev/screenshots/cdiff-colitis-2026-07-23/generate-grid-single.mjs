import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, 'images');
const KEY = 'MS6b2d6d7d3fb64d30960c9856197a9f83';
const API_BASE = 'https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro';
const OUTPUT_FILE = join(IMAGES_DIR, 'descent-3x3.png');
const PROMPT_FILE = join(IMAGES_DIR, 'descent-3x3.prompt.txt');

const PROMPT = `Naughty Dog cinematic CGI style, volumetric rays, PBR materials, dramatic key light with deep falloff into near-black shadow, cinematic concept still — not a photograph, not a textbook diagram, not flat medical illustration.
Film grain, high contrast, near-black void isolating every panel.
Consistent volumetric lighting.
No text, labels, numbers, UI, captions, or arrows anywhere.

3x3 grid, 9 panels, one unbroken descent.

Story Spine: Healthy gut suppresses C. diff until antibiotics for sinus infection kill protective flora. Spores germinate in empty colon, releasing Toxin A (watery diarrhea) and Toxin B (tight junction destruction). IV ceftriaxone kills remaining flora while C. diff overgrows into pseudomembranes. Oral vancomycin enters gut lumen, kills C. diff locally, stays out of blood — no Red Man.

Camera: wide hospital, dolly lumen, macro spore, crash epithelium, bird's-eye colon, medium error, macro lumen, worm's-eye junction, wide return.

Panel 1 (ONCE — wide, hospital): 35M in bed, knees up, flushed red face and neck, IV pole, commode. Redness warns: IV vancomycin = Red Man. Oral vancomycin = no Red Man.

Panel 2 (EVERY DAY — dolly, lumen): Lush teal beneficial bacteria coating pink villi. Volumetric light through lumen. C. diff spores dormant in shadows.

Panel 3 (UNTIL — macro, spore): Cyan-white cephalosporin molecules flood in, killing flora to gray dust. One C. diff spore cracks open, gold-brown rod emerging with flagella into empty niche.

Panel 4 (BECAUSE — crash, epithelium): Gold-brown C. diff multiplying, releasing orange Toxin A spheres and red-violet Toxin B destroying tight junctions. Actin scaffolding collapsing inside cells.

Panel 5 (THEREFORE — bird's-eye, colon): Yellow-white pseudomembrane plaques on inflamed mucosa. Fibrin webs, necrotic debris. Vessels pulsing beneath.

Panel 6 (BUT — medium, drug error): IV ceftriaxone cyan-white rings pouring through lumen, incinerating last flora. C. diff proliferates unchecked. Patient silhouette worsening behind.

Panel 7 (THEREFORE — macro, lumen): Oral vancomycin purple-gold glycopeptide molecules flooding colon, binding C. diff D-Ala-D-Ala. Bacteria disintegrate. Flora begin recolonizing.

Panel 8 (UNTIL — worm's-eye, junction): Vancomycin molecule pressed against tight junction, too large to cross. Below: skin mast cell quiescent, no histamine, normal skin. Red X over Red Man.

Panel 9 (EVER SINCE — wide pull-back, hospital): Same bed, patient sitting up, normal skin. Vancomycin capsules on table. Sunlight. Colon inset: pseudomembranes fading, pink mucosa returning.

Consistent volumetric lighting, deep black void, no flat diagrams, no histological slides, no cutaways.`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  mkdirSync(IMAGES_DIR, { recursive: true });

  // Save prompt text
  writeFileSync(PROMPT_FILE, PROMPT, 'utf-8');
  console.log(`Prompt saved: ${PROMPT_FILE} (${PROMPT.length} chars)`);

  // Submit
  console.log('Submitting 3x3 descent grid to Magnific...');
  const r = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'x-magnific-api-key': KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: PROMPT,
      aspect_ratio: '16:9',
      resolution: '2K',
    }),
  });

  if (r.status === 429) {
    console.log('Rate-limited, waiting 10s...');
    await sleep(10000);
    return main();
  }

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Submit failed (${r.status}): ${err}`);
  }

  const created = await r.json();
  console.log('Submit response:', JSON.stringify(created, null, 2));
  const taskId = created?.data?.task_id || created?.task_id;
  if (!taskId) throw new Error('No task_id in response');

  console.log(`Task ID: ${taskId} — polling for completion...`);

  const started = Date.now();
  while (Date.now() - started < 300000) {
    const pr = await fetch(`${API_BASE}/${taskId}`, {
      headers: { 'x-magnific-api-key': KEY },
    });
    if (pr.status === 429) { await sleep(8000); continue; }
    if (!pr.ok) {
      const errText = await pr.text();
      throw new Error(`Poll failed (${pr.status}): ${errText}`);
    }
    const payload = await pr.json();
    const data = payload?.data || payload;
    const status = String(data?.status || '').toUpperCase();
    console.log(`  status: ${status} (${Math.round((Date.now() - started) / 1000)}s)`);

    if (status === 'COMPLETED') {
      const urls = data?.generated;
      if (Array.isArray(urls) && urls[0]) {
        console.log(`Downloading from: ${urls[0]}`);
        const imgResp = await fetch(urls[0]);
        if (!imgResp.ok) throw new Error('Image download failed');
        const buf = Buffer.from(await imgResp.arrayBuffer());
        writeFileSync(OUTPUT_FILE, buf);
        console.log(`\nSAVED: ${OUTPUT_FILE}`);
        console.log(`FILE SIZE: ${buf.length} bytes (${(buf.length / 1024).toFixed(1)} KB)`);
        return;
      }
      throw new Error('Completed but no generated URL');
    }

    if (status === 'FAILED') throw new Error('Generation FAILED');

    await sleep(3000);
  }
  throw new Error('Timed out after 5 minutes');
}

main().catch((err) => { console.error('FATAL:', err.message); process.exit(1); });
