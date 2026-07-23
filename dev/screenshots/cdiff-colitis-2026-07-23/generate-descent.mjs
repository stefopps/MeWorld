import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, 'images');
const KEY = 'MS6b2d6d7d3fb64d30960c9856197a9f83';
const API_BASE = 'https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro';

mkdirSync(IMAGES_DIR, { recursive: true });

const PANELS = [
  {
    id: 1,
    label: 'Hospital Bed — Red Man',
    prompt: 'Medical illustration. Wide hospital room. A 35-year-old man in a hospital bed, knees drawn up in abdominal discomfort, IV pole beside him. His face, neck, and upper chest are flushed bright red with erythematous skin. A commode nearby in the room. He looks tired and uncomfortable. The red skin is the visual alarm. Cinematic lighting, clinical atmosphere. Dark background (#111111). No text labels. Clean medical illustration.'
  },
  {
    id: 2,
    label: 'Antibiotics Kill Flora',
    prompt: 'Medical scientific illustration. Zoom into the intestinal lumen. A lush diverse ecosystem of beneficial bacteria (various shapes: rods, cocci, spirals in teal blue green colors) living on the villus surface. A wave of antibiotic molecules (cyan-white cephalosporin ring structures) floods through the lumen. The beneficial bacteria are dying: fading, dissolving, turning gray. Empty patches forming on the epithelial surface. Microbiology style. Dark background (#111111). No text labels. Clean medical illustration.'
  },
  {
    id: 3,
    label: 'C. diff Spores Germinate',
    prompt: 'Medical scientific illustration. Intestinal lumen now mostly empty of bacteria. Scattered C. diff spores survive: small oval dark gold-brown bodies with tough outer coats on the epithelium. One spore shown mid-germination: coat cracking open, a vegetative rod-shaped C. diff bacterium emerging with flagella. The empty niche means exponential growth begins. Microbiology style. Dark background (#111111). No text labels. Clean medical illustration.'
  },
  {
    id: 4,
    label: 'Toxin A + Toxin B',
    prompt: 'Medical scientific illustration. Close-up of colonic epithelium. Vegetative C. diff bacteria (gold-brown rods with flagella) releasing two toxin types. Smaller orange spheres (Toxin A enterotoxin) triggering fluid secretion from epithelial cells. Larger red-violet molecules (Toxin B cytotoxin) entering epithelial cells and disrupting actin cytoskeleton: internal scaffolding collapsing, tight junctions between cells breaking apart. Molecular pathology style. Dark background (#111111). No text labels. Clean medical illustration.'
  },
  {
    id: 5,
    label: 'Pseudomembranes',
    prompt: 'Medical scientific illustration. Colonoscopic view of the inner colon surface. Raised yellow-white plaques dotting the inflamed erythematous mucosa. Each plaque a composite of fibrin mesh, dead neutrophils, necrotic epithelial debris, and C. diff bacteria. Blood vessels visible in inflamed tissue between plaques. Endoscopic pathology style. Dark background (#111111). No text labels. Clean medical illustration.'
  },
  {
    id: 6,
    label: 'Wrong Drug — Ceftriaxone',
    prompt: 'Medical scientific illustration. Intestinal lumen. IV ceftriaxone molecules (cephalosporin beta-lactam rings, cyan-white) arriving via bloodstream into gut lumen, killing last remaining beneficial bacteria. C. diff bacteria completely unaffected, multiplying rapidly in the empty space. Visual worsening arrow. The wrong treatment. Pharmacology error illustration. Dark background (#111111). No text labels. Clean medical illustration.'
  },
  {
    id: 7,
    label: 'Oral Vancomycin',
    prompt: 'Medical scientific illustration. Intestinal lumen. Oral vancomycin molecules arrive: large complex purple-gold glycopeptide structures traveling through GI tract into colon. They do NOT cross epithelium, staying in lumen. Vancomycin binding to D-Ala-D-Ala peptidoglycan precursor on C. diff cell wall, blocking cell wall synthesis. C. diff bacteria dying, cell walls disintegrating. Beneficial flora beginning to recolonize. Molecular pharmacology style. Dark background (#111111). No text labels. Clean medical illustration.'
  },
  {
    id: 8,
    label: 'Gut Blood Barrier',
    prompt: 'Medical scientific illustration. Split panel. LEFT: tight junction between two intestinal epithelial cells. Large purple-gold vancomycin molecule (~1449 Da) bumping against tight junction, too large to pass through. RIGHT: skin mast cell in dermis, quiescent, no histamine granules being released, skin normal color. Red X over Red Man Syndrome label area. Pharmacokinetics illustration. Dark background (#111111). No text labels. Clean medical illustration.'
  },
  {
    id: 9,
    label: 'Recovery',
    prompt: 'Medical illustration. Same hospital room. Patient sitting up, comfortable, skin normal color, no erythema. Commode pushed aside. Oral medication cup with vancomycin capsules on bedside table. Sunlight through window. IV pole pushed to background. Small colonoscopic inset showing pseudomembranes fading, healthy pink mucosa returning. Recovery and healing. Dark background (#111111). No text labels. Clean medical illustration.'
  }
];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function submitPanel(panel) {
  console.log(`Panel ${panel.id}: submitting "${panel.label}"...`);
  const r = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'x-magnific-api-key': KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: panel.prompt,
      aspect_ratio: '1:1',
      resolution: '2K',
    }),
  });

  if (r.status === 429) {
    console.log(`  rate-limited, waiting 10s...`);
    await sleep(10000);
    return submitPanel(panel);
  }

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Panel ${panel.id} submit failed (${r.status}): ${err}`);
  }

  const created = await r.json();
  const taskId = created?.data?.task_id || created?.task_id;
  if (!taskId) throw new Error(`Panel ${panel.id}: no task_id`);

  const started = Date.now();
  while (Date.now() - started < 240000) {
    const pr = await fetch(`https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/${taskId}`, {
      headers: { 'x-magnific-api-key': KEY },
    });
    if (pr.status === 429) { await sleep(8000); continue; }
    if (!pr.ok) throw new Error(`Panel ${panel.id} poll failed (${pr.status})`);
    const payload = await pr.json();
    const data = payload?.data || payload;
    const status = String(data?.status || '').toUpperCase();
    if (status === 'COMPLETED') {
      const urls = data?.generated;
      if (Array.isArray(urls) && urls[0]) {
        const imgResp = await fetch(urls[0]);
        if (!imgResp.ok) throw new Error(`Panel ${panel.id}: download failed`);
        const buf = Buffer.from(await imgResp.arrayBuffer());
        const outPath = join(IMAGES_DIR, `panel-${panel.id}.png`);
        writeFileSync(outPath, buf);
        console.log(`  saved panel-${panel.id}.png (${buf.length} bytes)`);
        return outPath;
      }
      throw new Error(`Panel ${panel.id}: completed but no URL`);
    }
    if (status === 'FAILED') throw new Error(`Panel ${panel.id} FAILED`);
    await sleep(3000);
  }
  throw new Error(`Panel ${panel.id}: timed out`);
}

async function main() {
  console.log('=== C. diff Descent 3x3 Grid Generation ===');
  const panelFiles = [];
  for (const panel of PANELS) {
    try {
      const path = await submitPanel(panel);
      panelFiles.push(path);
    } catch (err) {
      console.error(`Panel ${panel.id} ERROR:`, err.message);
    }
    await sleep(2000);
  }
  console.log(`\nCompleted ${panelFiles.length}/${PANELS.length} panels`);
  const status = {
    completed: panelFiles.length,
    total: PANELS.length,
    panelFiles: panelFiles.map((f) => f.replace(__dirname + '/', '')),
    timestamp: new Date().toISOString(),
  };
  writeFileSync(join(__dirname, 'generation-status.json'), JSON.stringify(status, null, 2));
  console.log('Status saved to generation-status.json');
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
