import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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
    label: 'Gut Wall Before',
    prompt: `Medical scientific illustration. Cross-section of healthy small intestine. Pink finger-like villi standing upright like coral. Microvilli brush border visible on epithelial surface. Clean intestinal lumen with a few harmless translucent particles suspended in fluid. Cellular level detail, histology textbook style. Dark background (#111111). No text labels. No blood. No faces. Clean vector-subtle medical illustration.`
  },
  {
    id: 2,
    label: 'E. coli Attaches',
    prompt: `Medical scientific illustration. Cross-section of small intestine villus. A cluster of rod-shaped gold-brown E. coli bacteria with thin wavy flagella docked onto the brush border. Each bacterium has tiny adhesin protein structures gripping the microvilli surface. The villi are slightly flattened at the attachment point. Cellular microbiology style. Dark background (#111111). No text labels. No blood. No faces. Clean medical illustration.`
  },
  {
    id: 3,
    label: 'Toxin Secretion',
    prompt: `Medical scientific illustration. Cross-section of small intestine epithelium. Gold-brown E. coli bacteria docked on the surface secreting small glowing yellow-orange enterotoxin molecules crossing the epithelial cell membrane. Inside the cell, toxins bind to a G-protein receptor on the basolateral side, activating adenylate cyclase. Chain reaction: multiple cAMP molecules lighting up inside the cell, then chloride channels (CFTR) opening on the apical surface. Cyclic AMP cascade, molecular biology style. Dark background (#111111). No text labels. No faces. Clean vector-subtle medical illustration.`
  },
  {
    id: 4,
    label: 'Osmotic Flood',
    prompt: `Medical scientific illustration. Cross-section of small intestine. Tiny green chloride ion spheres rushing out of epithelial cells into the intestinal lumen through open CFTR channels. Teal-blue water molecules following passively through tight junctions between cells. The lumen beginning to fill with translucent teal fluid, distending gently. Pink villi now partially submerged in the rising fluid level. Cellular transport biology style. Dark background (#111111). No text labels. No blood. No faces. Clean medical illustration.`
  },
  {
    id: 5,
    label: 'Dehydration Cascade',
    prompt: `Medical scientific illustration. Anatomical cutaway of human torso showing small intestine flooding with translucent teal fluid, large intestine distended with liquid stool. Blood vessels drawn as thinner collapsed tubes indicating volume depletion. Heart shown with speed lines indicating tachycardia. Transparent overlay: face silhouette with sweat droplets and dry mouth. Physiological overview, clinical medicine style. Dark background (#111111). No text labels. No blood. Clean vector-subtle medical illustration.`
  },
  {
    id: 6,
    label: 'Culture Plate',
    prompt: `Medical scientific illustration. Microbiology agar plate viewed from above. Small gold-brown E. coli bacterial colonies scattered on the reddish agar surface. Three white antibiotic discs placed on the agar: cephalosporin disc with colonies growing right up to the edge (no zone = resistant), ciprofloxacin disc with a wide clear inhibition zone around it (sensitive), azithromycin disc with a medium zone. Laboratory microbiology style, clean petri dish. Dark background (#111111). No text labels. No faces. Clean medical illustration.`
  },
  {
    id: 7,
    label: 'Ciprofloxacin Mechanism',
    prompt: `Medical scientific illustration. Molecular close-up inside a dividing E. coli bacterium. DNA gyrase enzyme shown as a blue circular protein complex gripping the bacterial circular chromosome (looped DNA strands). A cyan-white ciprofloxacin fluoroquinolone molecule with distinctive fused ring structure binding to the DNA gyrase-DNA complex, locking it in place. The DNA cannot unwind. The bacterium shown stuck mid-division, unable to replicate. Molecular pharmacology style. Dark background (#111111). No text labels. No faces. Clean vector-subtle medical illustration.`
  },
  {
    id: 8,
    label: 'Giardia Negative',
    prompt: `Medical scientific illustration. Close-up of a rapid antigen test dipstick. One bright red control line visible. The test line zone is completely blank, indicating negative result. In the background, a faded translucent silhouette of a Giardia trophozoite: pear-shaped single-celled organism with two nuclei and four pairs of flagella, marked with a subtle red X indicating ruled out. Medical diagnostics style. Dark background (#111111). No text labels. No faces. Clean vector-subtle medical illustration.`
  },
  {
    id: 9,
    label: 'Recovery',
    prompt: `Medical scientific illustration. Return to healthy small intestine cross-section. The lumen is clear, no fluid. No bacteria visible. Pink villi standing upright again, microvilli brush border fully restored. Epithelium regenerating. Lower portion shows a forearm cutaway with an IV line delivering teal-blue fluid (NS/LR) into a vein, refilling the vascular compartment. Small inset showing heart rate numbers transitioning from 98 to 72. Recovery and healing. Dark background (#111111). No text labels. No faces. Clean vector-subtle medical illustration.`
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

  // Poll until done
  const started = Date.now();
  while (Date.now() - started < 240000) {
    const pr = await fetch(`https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/${taskId}`, {
      headers: { 'x-magnific-api-key': KEY },
    });

    if (pr.status === 429) {
      await sleep(8000);
      continue;
    }

    if (!pr.ok) {
      const err = await pr.text();
      throw new Error(`Panel ${panel.id} poll failed (${pr.status}): ${err}`);
    }

    const payload = await pr.json();
    const data = payload?.data || payload;
    const status = String(data?.status || '').toUpperCase();

    if (status === 'COMPLETED') {
      const urls = data?.generated;
      if (Array.isArray(urls) && urls[0]) {
        const imgResp = await fetch(urls[0]);
        if (!imgResp.ok) throw new Error(`Panel ${panel.id}: download failed (${imgResp.status})`);
        const buf = Buffer.from(await imgResp.arrayBuffer());
        const outPath = join(IMAGES_DIR, `panel-${panel.id}.png`);
        writeFileSync(outPath, buf);
        console.log(`  saved panel-${panel.id}.png (${buf.length} bytes)`);
        return outPath;
      }
      throw new Error(`Panel ${panel.id}: completed but no URL`);
    }

    if (status === 'FAILED') {
      throw new Error(`Panel ${panel.id} FAILED: ${data?.message || 'unknown'}`);
    }

    await sleep(3000);
  }

  throw new Error(`Panel ${panel.id}: timed out`);
}

async function main() {
  console.log('=== E. coli Descent 3x3 Grid Generation ===');
  console.log(`API key: ${KEY.slice(0, 8)}...`);

  const panelFiles = [];
  for (const panel of PANELS) {
    try {
      const path = await submitPanel(panel);
      panelFiles.push(path);
    } catch (err) {
      console.error(`Panel ${panel.id} ERROR:`, err.message);
      // Retry once with simpler prompt
      console.log(`  retrying panel ${panel.id} with simpler prompt...`);
      try {
        const simplePrompt = `Medical scientific illustration, clean professional style, dark background, no text. ${panel.label}.`;
        const r = await fetch(API_BASE, {
          method: 'POST',
          headers: {
            'x-magnific-api-key': KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: simplePrompt,
            aspect_ratio: '1:1',
            resolution: '2K',
          }),
        });

        if (!r.ok) {
          const err = await r.text();
          throw new Error(`Retry failed (${r.status}): ${err}`);
        }

        const created = await r.json();
        const taskId = created?.data?.task_id || created?.task_id;
        const started = Date.now();
        while (Date.now() - started < 240000) {
          const pr = await fetch(`https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro/${taskId}`, {
            headers: { 'x-magnific-api-key': KEY },
          });
          if (!pr.ok) {
            if (pr.status === 429) { await sleep(8000); continue; }
            throw new Error(`Retry poll failed (${pr.status})`);
          }
          const payload = await pr.json();
          const data = payload?.data || payload;
          const status = String(data?.status || '').toUpperCase();
          if (status === 'COMPLETED') {
            const urls = data?.generated;
            if (Array.isArray(urls) && urls[0]) {
              const imgResp = await fetch(urls[0]);
              const buf = Buffer.from(await imgResp.arrayBuffer());
              const outPath = join(IMAGES_DIR, `panel-${panel.id}.png`);
              writeFileSync(outPath, buf);
              console.log(`  retry saved panel-${panel.id}.png (${buf.length} bytes)`);
              panelFiles.push(outPath);
            }
            break;
          }
          if (status === 'FAILED') throw new Error(`Retry failed: ${data?.message}`);
          await sleep(3000);
        }
      } catch (retryErr) {
        console.error(`Panel ${panel.id} retry also failed:`, retryErr.message);
      }
    }

    // Rate limit: short pause between panels
    await sleep(2000);
  }

  console.log(`\nCompleted ${panelFiles.length}/${PANELS.length} panels`);
  console.log(`Output dir: ${IMAGES_DIR}`);

  // Write completion marker
  const status = {
    completed: panelFiles.length,
    total: PANELS.length,
    panelFiles: panelFiles.map((f) => f.replace(__dirname + '/', '')),
    timestamp: new Date().toISOString(),
  };
  writeFileSync(join(__dirname, 'generation-status.json'), JSON.stringify(status, null, 2));
  console.log('Status saved to generation-status.json');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
