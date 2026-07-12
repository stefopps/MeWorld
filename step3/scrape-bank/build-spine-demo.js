#!/usr/bin/env node
/**
 * Mine one concept spine from scrape-bank/raw and emit an HTML next/next viewer.
 * Does NOT invent questions — only real QIDs from scraped JSON.
 */
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, 'raw');
const OUT_HTML = path.join(__dirname, 'spine-demo.html');
const OUT_JSON = path.join(__dirname, 'spine-demo-trajectory.json');

function loadDeduped() {
  const byId = new Map();
  for (const f of fs.readdirSync(RAW).filter((x) => /^scrape-playwright/.test(x))) {
    let j;
    try {
      j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
    } catch {
      continue;
    }
    for (const p of j.pages || []) {
      const id = String(p.questionId || '').replace(/\D/g, '');
      if (!id || !(p.question || '').trim()) continue;
      const score =
        (p.hasReveal ? 10 : 0) +
        (p.explanation || '').length / 100 +
        (p.answers ? 2 : 0);
      const prev = byId.get(id);
      if (!prev || score > prev._score) {
        byId.set(id, {
          id,
          question: p.question || '',
          answers: p.answers || [],
          explanation: (p.explanation || '').slice(0, 2500),
          likely: p.likelyCorrectAnswer || '',
          hasReveal: !!p.hasReveal,
          _score: score,
          sourceFile: f,
        });
      }
    }
  }
  return [...byId.values()];
}

function textOf(q) {
  const ans = Array.isArray(q.answers)
    ? q.answers
        .map((a) => (typeof a === 'string' ? a : a.text || a.label || JSON.stringify(a)))
        .join(' ')
    : '';
  return `${q.question}\n${ans}\n${q.explanation}`.toLowerCase();
}

function matchScore(t, patterns) {
  let s = 0;
  for (const [re, w] of patterns) {
    if (re.test(t)) s += w;
  }
  return s;
}

// Scene spines: concept-adjacent (lupus/CTD → photo skin → lung forks)
const SCENES = [
  {
    id: 1,
    beat: 'entry',
    title: 'Pressure, immune system, skin',
    hook: 'Clinic: hypertension + systemic clues + skin',
    patterns: [
      [/lupus|sle\b|systemic lupus/i, 5],
      [/hypertens/i, 3],
      [/malar|butterfly|discoid|livedo|raynaud|photosensitiv/i, 4],
      [/antinuclear|\bana\b|anti-?dsdna|anti-?smith|complement/i, 3],
      [/connective tissue|autoimmune/i, 2],
    ],
  },
  {
    id: 2,
    beat: 'complication',
    title: 'Sun, no lotion — rash fork',
    hook: 'Outside / swimming: sun exposure → cracking rash — dermatitis vs lupus skin',
    patterns: [
      [/photosensitiv|sun.?expos|uv\b|photodistribut/i, 5],
      [/dermatitis|eczema|contact derm/i, 4],
      [/discoid|cutaneous lupus|cle\b|subacute cutaneous|malar/i, 5],
      [/rash|plaque|scale|erythema/i, 2],
      [/lupus|sle\b/i, 2],
    ],
  },
  {
    id: 3,
    beat: 'deepening',
    title: 'Smoke in the air — lung fork',
    hook: 'Walks through smoke: asthma trigger vs CTD/lupus lung vs fibrosis',
    patterns: [
      [/asthma|wheez|bronchospasm|reactive airway/i, 4],
      [/interstitial|ild\b|pulmonary fibrosis|ground.?glass|restrictive/i, 5],
      [/scleroderma|systemic sclerosis|nsip|uip\b/i, 5],
      [/lupus.*lung|pneumonitis|pleurit|shrinking lung/i, 5],
      [/smoke|cigarette|inhalation|dyspnea|shortness of breath/i, 2],
      [/pulmonary|lung|respiratory/i, 1],
    ],
  },
  {
    id: 4,
    beat: 'turning point',
    title: 'Kidneys / serology — systemic weight',
    hook: 'Labs catch up: nephritis, complements, antibody pattern',
    patterns: [
      [/lupus nephritis|glomeruloneph|proteinuria|cast/i, 5],
      [/anti-?dsdna|anti-?smith|low complement|c3|c4/i, 4],
      [/creatinine|renal|kidney/i, 2],
      [/sle\b|lupus/i, 2],
      [/biopsy|immunofluorescen/i, 2],
    ],
  },
  {
    id: 5,
    beat: 'resolution',
    title: 'Treatment / flare / next step',
    hook: 'What do you do now — steroids, HCQ, immunosuppression, counseling',
    patterns: [
      [/hydroxychloroquine|hcq|chloroquine/i, 4],
      [/prednisone|corticosteroid|methylprednisolone/i, 3],
      [/mycophenolate|cyclophosphamide|azathioprine|belimumab|rituximab/i, 4],
      [/flare|maintenance|sun protection|sunscreen/i, 3],
      [/lupus|sle\b|cutaneous lupus/i, 2],
      [/first.?step|most appropriate|next step/i, 1],
    ],
  },
];

function pickForScene(pool, scene, used, want = 8) {
  const scored = pool
    .filter((q) => !used.has(q.id))
    .map((q) => ({ q, s: matchScore(textOf(q), scene.patterns) }))
    .filter((x) => x.s >= 3)
    .sort((a, b) => b.s - a.s || b.q._score - a.q._score);

  const picks = [];
  for (const { q, s } of scored) {
    if (picks.length >= want) break;
    picks.push({ ...q, sceneScore: s });
    used.add(q.id);
  }
  return picks;
}

function normalizeAnswers(answers) {
  if (!Array.isArray(answers)) return [];
  return answers.map((a, i) => {
    if (typeof a === 'string') return { label: String.fromCharCode(65 + i), text: a };
    return {
      label: a.label || String.fromCharCode(65 + i),
      text: a.text || a.label || JSON.stringify(a),
    };
  });
}

function main() {
  console.log('Loading deduped bank…');
  const pool = loadDeduped();
  console.log('Unique items with stems:', pool.length);

  const used = new Set();
  const scenes = SCENES.map((sc) => {
    const questions = pickForScene(pool, sc, used, 8);
    return {
      ...sc,
      patterns: undefined,
      questions: questions.map((q) => ({
        id: q.id,
        sceneScore: q.sceneScore,
        question: q.question,
        answers: normalizeAnswers(q.answers),
        explanation: q.explanation,
        likely: q.likely,
        hasReveal: q.hasReveal,
        sourceFile: q.sourceFile,
      })),
    };
  });

  const total = scenes.reduce((n, s) => n + s.questions.length, 0);
  console.log(
    'Spine picks:',
    scenes.map((s) => `S${s.id}:${s.questions.length}`).join(' '),
    'total',
    total
  );

  const trajectory = {
    spine: 'Lupus / CTD — skin photo fork — lung fork — nephritis — treatment',
    avatar: 'Avatar 1 (demo)',
    rule: 'All QIDs from scrape-bank/raw — none invented',
    generatedAt: new Date().toISOString(),
    scenes,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(trajectory, null, 2));

  const flat = [];
  for (const sc of scenes) {
    sc.questions.forEach((q, i) => {
      flat.push({
        sceneId: sc.id,
        sceneBeat: sc.beat,
        sceneTitle: sc.title,
        sceneHook: sc.hook,
        indexInScene: i + 1,
        sceneSize: sc.questions.length,
        globalIndex: flat.length + 1,
        ...q,
      });
    });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Spine demo — Lupus/CTD chain</title>
<style>
  :root {
    --bg: #0f1419;
    --card: #1a2332;
    --ink: #e7ecf3;
    --muted: #8b9bb4;
    --accent: #3d8bfd;
    --hook: #f0c14a;
    --border: #2a3548;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    font-family: "Segoe UI", system-ui, sans-serif;
    background: radial-gradient(1200px 600px at 20% -10%, #1a2a44, var(--bg));
    color: var(--ink);
  }
  .wrap { max-width: 820px; margin: 0 auto; padding: 24px 20px 100px; }
  header h1 { font-size: 1.25rem; margin: 0 0 6px; font-weight: 650; }
  header p { margin: 0; color: var(--muted); font-size: 0.9rem; line-height: 1.45; }
  .badge {
    display: inline-block; margin-top: 12px; padding: 4px 10px; border-radius: 999px;
    background: #243044; color: var(--hook); font-size: 0.75rem; letter-spacing: 0.02em;
  }
  .scene-bar {
    margin-top: 20px; padding: 14px 16px; border-radius: 12px;
    background: linear-gradient(135deg, #243552, #1a2332);
    border: 1px solid var(--border);
  }
  .scene-bar .beat { color: var(--accent); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .scene-bar h2 { margin: 4px 0; font-size: 1.05rem; }
  .scene-bar .hook { color: var(--hook); font-size: 0.92rem; margin: 0; }
  .card {
    margin-top: 16px; padding: 18px 18px 14px; border-radius: 12px;
    background: var(--card); border: 1px solid var(--border);
  }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 14px; color: var(--muted); font-size: 0.8rem; margin-bottom: 12px; }
  .meta strong { color: var(--ink); }
  .stem { font-size: 1rem; line-height: 1.55; white-space: pre-wrap; }
  .answers { margin: 16px 0 0; padding: 0; list-style: none; }
  .answers li {
    margin: 8px 0; padding: 10px 12px; border-radius: 8px;
    background: #121a26; border: 1px solid var(--border); font-size: 0.92rem; line-height: 1.4;
  }
  .likely { margin-top: 12px; color: #7ddea5; font-size: 0.85rem; }
  details.explain { margin-top: 12px; color: var(--muted); font-size: 0.85rem; }
  details.explain summary { cursor: pointer; color: var(--accent); }
  details.explain pre {
    white-space: pre-wrap; font-family: inherit; margin: 8px 0 0;
    max-height: 220px; overflow: auto; color: #c5d0e0;
  }
  .nav {
    position: fixed; bottom: 0; left: 0; right: 0;
    display: flex; gap: 10px; justify-content: center; align-items: center;
    padding: 14px 16px 18px;
    background: linear-gradient(transparent, rgba(15,20,25,0.95) 30%);
  }
  .nav button {
    appearance: none; border: 0; border-radius: 10px; padding: 12px 22px;
    font-size: 0.95rem; font-weight: 600; cursor: pointer;
  }
  .nav .prev { background: #2a3548; color: var(--ink); }
  .nav .next { background: var(--accent); color: #fff; min-width: 140px; }
  .nav .next:disabled, .nav .prev:disabled { opacity: 0.35; cursor: default; }
  .progress { color: var(--muted); font-size: 0.85rem; min-width: 90px; text-align: center; }
  .empty { color: var(--muted); padding: 40px 0; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Spine demo — real bank QIDs only</h1>
    <p><strong>${trajectory.spine}</strong><br/>
    Avatar demo · ${flat.length} questions across ${scenes.length} scenes · mined from scrape-bank/raw</p>
    <span class="badge">No invented stems — recursive keyword adjacency on scraped text</span>
  </header>

  <div id="app"></div>
</div>

<div class="nav">
  <button class="prev" id="prev" type="button">← Prev</button>
  <div class="progress" id="progress">—</div>
  <button class="next" id="next" type="button">Next →</button>
</div>

<script>
const ITEMS = ${JSON.stringify(flat)};
let i = 0;

function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function render() {
  const el = document.getElementById('app');
  if (!ITEMS.length) {
    el.innerHTML = '<p class="empty">No matching questions found for this spine.</p>';
    return;
  }
  const q = ITEMS[i];
  const ans = (q.answers || []).map(a =>
    '<li><strong>' + esc(a.label) + '.</strong> ' + esc(a.text) + '</li>'
  ).join('');
  el.innerHTML = \`
    <div class="scene-bar">
      <div class="beat">Scene \${q.sceneId}/5 · \${esc(q.sceneBeat)} · Q \${q.indexInScene}/\${q.sceneSize}</div>
      <h2>\${esc(q.sceneTitle)}</h2>
      <p class="hook">\${esc(q.sceneHook)}</p>
    </div>
    <div class="card">
      <div class="meta">
        <span>QID <strong>\${esc(q.id)}</strong></span>
        <span>Global <strong>\${q.globalIndex}/\${ITEMS.length}</strong></span>
        <span>Match score <strong>\${q.sceneScore}</strong></span>
        <span>\${q.hasReveal ? 'Reveal ✓' : 'No reveal'}</span>
      </div>
      <div class="stem">\${esc(q.question)}</div>
      <ul class="answers">\${ans}</ul>
      \${q.likely ? '<div class="likely">Likely correct (this scrape): ' + esc(q.likely) + '</div>' : ''}
      <details class="explain"><summary>Explanation / reveal text</summary>
        <pre>\${esc(q.explanation || '(none captured)')}</pre>
      </details>
    </div>\`;
  document.getElementById('progress').textContent = (i + 1) + ' / ' + ITEMS.length;
  document.getElementById('prev').disabled = i === 0;
  document.getElementById('next').disabled = i >= ITEMS.length - 1;
  document.getElementById('next').textContent =
    i >= ITEMS.length - 1 ? 'Done' : (q.indexInScene === q.sceneSize ? 'Next scene →' : 'Next →');
}

document.getElementById('prev').onclick = () => { if (i > 0) { i--; render(); window.scrollTo(0,0); } };
document.getElementById('next').onclick = () => { if (i < ITEMS.length - 1) { i++; render(); window.scrollTo(0,0); } };
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'n') document.getElementById('next').click();
  if (e.key === 'ArrowLeft' || e.key === 'p') document.getElementById('prev').click();
});
render();
</script>
</body>
</html>`;

  fs.writeFileSync(OUT_HTML, html);
  console.log('Wrote', OUT_HTML);
  console.log('Wrote', OUT_JSON);
}

main();
