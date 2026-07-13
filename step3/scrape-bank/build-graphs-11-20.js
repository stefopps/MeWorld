#!/usr/bin/env node
/**
 * Build concept-graph data + viewer HTML for Sets 11–20.
 *
 * Auto-classification:
 *   primary = first 2 Qs of scene 1 + first 2 Qs of scene 5 (anchor beats)
 *   mimic   = everything else (differential deep-dives)
 *
 * One viewer HTML per set (same template, different DATA_URL).
 * Run from scrape-bank: node build-graphs-11-20.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MANIFEST = path.join(ROOT, 'sets-11-20-manifest.json');
const VIEWER_TEMPLATE = path.join(ROOT, 'set-01-concept-graph.html');

function extractItems(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf('const ITEMS = ') + 'const ITEMS = '.length;
  const end = html.lastIndexOf('];', html.indexOf('\nconst SCENES'));
  return JSON.parse(html.slice(start, end + 1));
}

function classifyItems(items) {
  // primary = first 2 Qs of scene 1, first 2 Qs of scene 5
  const primaryIds = new Set();
  for (const q of items) {
    if ((q.sceneId === 1 && q.indexInScene <= 2) || (q.sceneId === 5 && q.indexInScene <= 2)) {
      primaryIds.add(String(q.id));
    }
  }
  const nodes = items.map((q) => ({
    id: String(q.id),
    category: primaryIds.has(String(q.id)) ? 'primary' : 'mimic',
    why: '',
  }));
  return nodes;
}

function buildEdges(items, nodes) {
  const edges = [];
  // scene edges: all Qs within same scene linked
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
  // primary thread edges: link all primary nodes
  const primary = items.filter((q) => {
    const n = nodes.find((nn) => nn.id === String(q.id));
    return n && n.category === 'primary';
  });
  for (let i = 0; i < primary.length; i++) {
    for (let j = i + 1; j < primary.length; j++) {
      edges.push({
        source: String(primary[i].id),
        target: String(primary[j].id),
        kind: 'thread',
        category: 'primary',
      });
    }
  }
  return edges;
}

function buildGraph(items, setNum, storyFile, setMeta) {
  const nodes = classifyItems(items);
  const edges = buildEdges(items, nodes);
  const primary = nodes.filter((n) => n.category === 'primary');
  const mainPath = primary.map((n) => n.id); // ordered by scene then index

  const counts = {
    primary: primary.length,
    mimic: nodes.length - primary.length,
    thread: 0,
  };

  return {
    set: setNum,
    storyFile: storyFile,
    source: 'auto-classification: first 2/Qs scene1 + scene5 = primary, rest = mimic. Master review needed.',
    repo: 'https://github.com/stefopps/MeWorld (step3/scrape-bank)',
    coreDiagnosis: setMeta.spine.split('—')[0].trim(),
    recurringThread: 'Auto-generated — not reviewed',
    mainPath,
    generatedAt: new Date().toISOString(),
    counts,
    nodes,
    edges,
  };
}

function buildViewerHtml(dataFile, storyFile, setNum, setMeta) {
  const template = fs.readFileSync(VIEWER_TEMPLATE, 'utf8');
  const title = `Set ${String(setNum).padStart(2, '0')} · story map`;
  const coreDiag = setMeta.spine.split('—')[0].trim();

  let html = template;
  // Replace DATA_URL
  html = html.replace(
    /const DATA_URL = '\.\/graph-data-set-\d+\.json';/,
    `const DATA_URL = './${dataFile}';`
  );
  // Replace title
  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${title}</title>`
  );
  // Replace h1
  html = html.replace(
    /<h1>[\s\S]*?<\/h1>/,
    `<h1>Set ${setNum} · story map</h1>`
  );
  // Replace subtitle paragraph
  html = html.replace(
    /<p class="sub">[\s\S]*?<\/p>/,
    `<p class="sub">Auto-classified: primary nodes = scene 1 &amp; 5 anchor beats. Rest = differential doors.
    Data loads live from <code>${dataFile}</code> + <code>${storyFile}</code>.
    <strong>Core: ${coreDiag}</strong>.</p>`
  );
  // Replace legend (no SS thread for auto sets)
  html = html.replace(
    /<div class="legend">[\s\S]*?<\/div>/,
    `<div class="legend">
    <span><span class="dot" style="background:var(--coral)"></span>Main spine (scene 1 &amp; 5 anchors)</span>
    <span><span class="dot" style="background:var(--gray)"></span>Differential doors (scenes 2–4)</span>
    <span style="color:var(--muted)">Auto-classified — Master review before final</span>
  </div>`
  );
  return html;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  let table = '';

  for (const setMeta of manifest) {
    const sn = setMeta.set;
    const storyFile = setMeta.file;
    const storyPath = path.join(ROOT, storyFile);
    if (!fs.existsSync(storyPath)) {
      console.error(`Missing: ${storyFile}`);
      continue;
    }

    // Build graph-data JSON
    const items = extractItems(storyPath);
    const graph = buildGraph(items, sn, storyFile, setMeta);
    const dataFile = `graph-data-set-${String(sn).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(ROOT, dataFile), JSON.stringify(graph, null, 2));
    console.log(`  graph-data: ${dataFile}  (${graph.counts.primary}P / ${graph.counts.mimic}M)`);

    // Build viewer HTML
    const viewerFile = `set-${String(sn).padStart(2, '0')}-concept-graph.html`;
    const html = buildViewerHtml(dataFile, storyFile, sn, setMeta);
    fs.writeFileSync(path.join(ROOT, viewerFile), html);
    const kb = Math.round(fs.statSync(path.join(ROOT, viewerFile)).size / 1024);
    console.log(`  viewer:     ${viewerFile}  (${kb} KB)`);

    table += `| ${sn} | ${setMeta.pattern} | ${graph.counts.primary}P · ${graph.counts.mimic}M | ${viewerFile} | ${dataFile} |\n`;
  }

  // Write manifest
  let md = `# Concept graphs — Sets 11–20

Auto-classified. Primary nodes = first 2 questions from scene 1 + first 2 from scene 5.
Rest = mimic doors. Needs Master review for manual classification.

| Set | Pattern | Split | Viewer | Data |
|-----|---------|-------|--------|------|
${table}

**Serve folder over HTTP** for live data loading:
\`\`\`bash
cd scrape-bank && python -m http.server 8765
# Open http://localhost:8765/set-11-concept-graph.html
\`\`\`

## How to review a set
1. Open the viewer — all nodes are live from the JSON + story HTML
2. Click spine nodes (coral) for primary story beats
3. Click coral lines between spine nodes for the bridge story
4. Click gray nodes for differential deep-dives
5. Adjust the slider to fade secondary nodes
6. Drag nodes to rearrange the force layout
`;
  fs.writeFileSync(path.join(ROOT, 'graph-manifest-11-20.md'), md);
  console.log('\nWrote graph-manifest-11-20.md');
}

main();
