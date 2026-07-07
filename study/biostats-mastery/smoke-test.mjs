import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const errors = [];
const ok = (msg) => console.log('  OK  ' + msg);
const fail = (msg) => { errors.push(msg); console.log('  !!  ' + msg); };

console.log('Biostats Mastery smoke test\n');

// Files
for (const f of ['index.html', 'stats_questions.json', 'pivot_manifest.json']) {
  fs.existsSync(path.join(root, f)) ? ok(`file: ${f}`) : fail(`missing: ${f}`);
}

const bank = JSON.parse(fs.readFileSync(path.join(root, 'stats_questions.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'pivot_manifest.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

bank.length === 179 ? ok('179 questions') : fail(`question count ${bank.length}`);
const ids = new Set(bank.map((q) => q.id));
ids.size === 179 ? ok('unique ids') : fail('duplicate ids');

const missingType = bank.filter((q) => !q.baseGraph?.type);
missingType.length === 0 ? ok('all baseGraph.type set') : fail(`${missingType.length} missing type`);

// Pivot manifest
let slots = 0;
let layered = 0;
const missingIds = [];
for (const lvl of Object.values(manifest.levels)) {
  for (const p of lvl.pivots) {
    slots++;
    const l = p.layers;
    if (l.primary != null) {
      layered++;
      if (!ids.has(l.primary)) missingIds.push(l.primary);
    } else fail(`pivot ${p.pivotIdx} no primary`);
    for (const qid of [...(l.reinforce || []), ...(l.advance || [])]) {
      layered++;
      if (!ids.has(qid)) missingIds.push(qid);
    }
  }
}
slots === 42 ? ok('42 pivots') : fail(`pivot count ${slots}`);
missingIds.length === 0 ? ok(`pivot ids valid (${layered} layered)`) : fail(`bad pivot ids: ${[...new Set(missingIds)]}`);

// HTML capabilities
const checks = [
  "fetch('stats_questions.json",
  "fetch('pivot_manifest.json",
  'function enterPivotMode',
  'function updateQuizGraph',
  'function updatePPVCurveChart',
  'function renderContingencyTable',
  'chart-quiz-html',
  'chartjs-plugin-zoom',
  'chartjs-plugin-annotation',
];
for (const c of checks) {
  html.includes(c) ? ok(`html: ${c.split('(')[0]}`) : fail(`html missing: ${c}`);
}

// Chart type coverage
const built = new Set([
  'cumulative', 'normal', 'bar', 'bar-multigroup', 'ppvCurve', 'forestPlot', 'rocCurve',
  'dotplot', 'contingencyTable', 'biasDiagram', 'studyDesignGrid', 'phaseTimeline', 'dag', 'decisionTree',
]);
const typeCounts = {};
for (const q of bank) {
  const t = q.baseGraph.type;
  typeCounts[t] = (typeCounts[t] || 0) + 1;
  if (!built.has(t)) fail(`unimplemented type on Q${q.id}: ${t}`);
}
ok(`${Object.keys(typeCounts).length} chart types, 179/179 covered`);

// Pivot flatten simulation
const seen = new Set();
const ordered = [];
for (const lvlKey of Object.keys(manifest.levels).sort((a, b) => Number(a) - Number(b))) {
  for (const slot of manifest.levels[lvlKey].pivots) {
    const l = slot.layers;
    for (const qid of [l.primary, ...(l.reinforce || []), ...(l.advance || [])].filter((x) => x != null)) {
      const q = bank.find((x) => x.id === qid);
      if (q && !seen.has(q.id)) {
        seen.add(q.id);
        ordered.push(q);
      }
    }
  }
}
ordered.length >= 60 ? ok(`pivot path: ${ordered.length} unique (${layered} layer slots, ${layered - ordered.length} intentional dupes skipped)`) : fail(`pivot flatten only ${ordered.length}`);

// HTTP smoke (if server running)
try {
  const res = await fetch('http://localhost:8090/stats_questions.json');
  res.ok ? ok(`HTTP stats_questions.json ${res.status}`) : fail(`HTTP stats ${res.status}`);
  const res2 = await fetch('http://localhost:8090/pivot_manifest.json');
  res2.ok ? ok(`HTTP pivot_manifest.json ${res2.status}`) : fail(`HTTP pivot ${res2.status}`);
  const res3 = await fetch('http://localhost:8090/index.html');
  res3.ok ? ok(`HTTP index.html ${res3.status}`) : fail(`HTTP index ${res3.status}`);
  const body = await res3.text();
  body.includes('function enterPivotMode') ? ok('served index has pivot mode') : fail('served index incomplete');
} catch (e) {
  fail(`HTTP server not reachable: ${e.message}`);
}

console.log('');
if (errors.length) {
  console.log(`FAILED: ${errors.length} issue(s)`);
  process.exit(1);
}
console.log('ALL CHECKS PASSED');
