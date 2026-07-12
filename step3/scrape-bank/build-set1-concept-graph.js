#!/usr/bin/env node
/**
 * Build Set 1 graph-data JSON (classification + edges only).
 * Questions and story prose stay in set-01-story-va.html — the viewer fetches both live.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const STORY = path.join(ROOT, 'set-01-story-va.html');
const OUT_JSON = path.join(ROOT, 'graph-data-set-01.json');
const OUT_HTML = path.join(ROOT, 'set-01-concept-graph.html');
const OUT_MANIFEST = path.join(ROOT, 'graph-manifest.md');

/** Explicit Set 1 tags — Nadia = SLE; recurring thread = systemic sclerosis. */
const CLASS_BY_ID = {
  '5117': { category: 'primary', why: 'Lupus nephritis immune-complex mechanism (story Find)' },
  '183': { category: 'mimic', why: 'Pregnancy HTN/preeclampsia look-alike (story Search)' },
  '1094': { category: 'primary', why: 'Young adult SLE serology/joints threshold (story Go)' },
  '5285': { category: 'primary', why: 'Neuropsychiatric SLE / seizure cost (story Take)' },
  '5158': { category: 'primary', why: 'SLE arthritis reference without cutaneous break (story Change)' },
  '5297': { category: 'primary', why: 'Cheap discriminator / ANA path into SLE (story Need)' },
  '5198': { category: 'thread', why: 'Systemic sclerosis tight-skin near-miss (story Return; SS thread)' },
  '2187': { category: 'mimic', why: 'Ordinary psoriasis plaque — not SLE (story You)' },
  '5530': { category: 'mimic', why: 'Pellagra / niacin deficiency Casal necklace' },
  '2139': { category: 'mimic', why: 'Rosacea flush — not photosensitive SLE dermatitis' },
  '1212': { category: 'mimic', why: 'Porphyria cutanea tarda blisters after sun' },
  '1404': { category: 'mimic', why: 'Drug (doxy) photosensitivity, not CLE' },
  '654': { category: 'mimic', why: 'Riboflavin deficiency angular cheilitis' },
  '5756': { category: 'mimic', why: 'Malabsorption / short-gut nutrient deficiency rash' },
  '5393': { category: 'mimic', why: 'Mechanical OA thumbs — no autoimmune rash' },
  '121': { category: 'primary', why: 'Recurrent pregnancy loss → APS/SLE systemic weight' },
  '1129': { category: 'mimic', why: 'Occupational / infection lung needing BAL, not CTD ILD' },
  '5343': { category: 'mimic', why: 'Asbestos/pleural fluid look-alike vs lupus serositis' },
  '4930': { category: 'mimic', why: 'Pregnancy asthma — ordinary reactive airway' },
  '1988': { category: 'mimic', why: 'Drug-induced bronchospasm (beta-blocker/ASA)' },
  '4882': { category: 'mimic', why: 'COPD air trapping from smoking' },
  '4992': { category: 'mimic', why: 'Normal pregnancy dyspnea physiology' },
  '4717': { category: 'thread', why: 'Systemic sclerosis ILD / base scarring (SS thread)' },
  '4917': { category: 'thread', why: 'Limited SS / PAH vessel pressure (SS thread)' },
  '994': { category: 'primary', why: 'Biopsy / next step in SLE nephritis path' },
  '4708': { category: 'mimic', why: 'IgA nephropathy post-URI tea-colored urine' },
  '5135': { category: 'mimic', why: 'Post-strep GN after skin infection' },
  '4710': { category: 'mimic', why: 'Alport hereditary nephritis + deafness' },
  '5268': { category: 'mimic', why: 'RA long-standing amyloid organ cost' },
  '1362': { category: 'primary', why: 'SLE with low complement / immune-complex kidney' },
  '5169': { category: 'mimic', why: 'Cryoglobulinemia from hepatitis, not SLE' },
  '4764': { category: 'primary', why: 'Classic SLE diagnosis (malar + complement + kidneys)' },
  '1261': { category: 'mimic', why: "Behçet mouth ulcers + eye — not SLE" },
  '345': { category: 'primary', why: 'Hot joint → aspirate before assuming SLE flare' },
  '3488': { category: 'mimic', why: 'MS relapse high-dose steroids — different disease' },
  '1717': { category: 'mimic', why: 'RA first-line methotrexate path' },
  '5820': { category: 'mimic', why: 'Transplant metabolic maintenance costs' },
  '3781': { category: 'mimic', why: 'Spinal cord lesion urgent steroids — not SLE cerebritis' },
  '1251': { category: 'mimic', why: 'GPA/Wegener vasculitis nose-lung mimic' },
  '3298': { category: 'primary', why: 'APS clot on therapy — lupus-adjacent systemic thread close' },
};

function extractItems(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf('const ITEMS = ') + 'const ITEMS = '.length;
  const end = html.lastIndexOf('];', html.indexOf('\nconst SCENES'));
  return JSON.parse(html.slice(start, end + 1));
}

function buildGraph(items) {
  const nodes = items.map((q) => {
    const tag = CLASS_BY_ID[String(q.id)];
    if (!tag) throw new Error('Missing classification for QID ' + q.id);
    return { id: String(q.id), category: tag.category, why: tag.why };
  });

  const edges = [];
  for (let sid = 1; sid <= 5; sid++) {
    const inScene = items.filter((q) => q.sceneId === sid);
    for (let i = 0; i < inScene.length; i++) {
      for (let j = i + 1; j < inScene.length; j++) {
        edges.push({
          source: String(inScene[i].id),
          target: String(inScene[j].id),
          kind: 'scene',
        });
      }
    }
  }
  for (const cat of ['primary', 'thread']) {
    const group = nodes.filter((n) => n.category === cat);
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        edges.push({
          source: group[i].id,
          target: group[j].id,
          kind: 'thread',
          category: cat,
        });
      }
    }
  }

  const counts = {
    primary: nodes.filter((n) => n.category === 'primary').length,
    mimic: nodes.filter((n) => n.category === 'mimic').length,
    thread: nodes.filter((n) => n.category === 'thread').length,
  };

  return {
    set: 1,
    storyFile: 'set-01-story-va.html',
    source: 'classification + edges only; questions/story fetched live from storyFile',
    repo: 'https://github.com/stefopps/MeWorld (step3/scrape-bank)',
    coreDiagnosis: 'SLE / lupus (Nadia)',
    recurringThread: 'Systemic sclerosis',
    // Ordered coral spine numbers (from story-map). Click progress 1…N in this order.
    mainPath: [
      '5117',
      '1094',
      '5285',
      '5158',
      '5297',
      '121',
      '994',
      '1362',
      '4764',
      '345',
      '3298',
    ],
    generatedAt: new Date().toISOString(),
    counts,
    nodes,
    edges,
  };
}

function main() {
  if (!fs.existsSync(STORY)) {
    console.error('Missing', STORY);
    process.exit(1);
  }
  const items = extractItems(STORY);
  const graph = buildGraph(items);
  fs.writeFileSync(OUT_JSON, JSON.stringify(graph, null, 2));

  if (!fs.existsSync(OUT_HTML)) {
    console.warn('Missing viewer:', OUT_HTML);
  }

  const md = `# Graph manifest

Status: DRAFT classification for Master correction before baking further sets.

## Set 1 — Lupus / CTD
- **Viewer:** \`set-01-concept-graph.html\` (fetches data live; no embedded bank)
- **Classification:** \`graph-data-set-01.json\` (category/why + edges only)
- **Questions/story:** \`set-01-story-va.html\`
- **Core diagnosis:** SLE / lupus (Nadia)
- **Recurring thread:** Systemic sclerosis
- **Counts:** ${graph.counts.primary} primary · ${graph.counts.mimic} mimic · ${graph.counts.thread} thread
- **Sanity:** mimic-heavy (${graph.counts.mimic}/40)
- **Note:** Serve the folder over HTTP so \`fetch\` works (\`file://\` is blocked)
`;
  fs.writeFileSync(OUT_MANIFEST, md);
  console.log('Wrote', path.basename(OUT_JSON), fs.statSync(OUT_JSON).size, 'bytes');
  console.log('Counts', graph.counts);
}

main();
