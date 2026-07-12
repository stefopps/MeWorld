#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const raw = path.join(__dirname, 'raw');
const out = __dirname;

const files = fs.readdirSync(raw).filter((f) => /^scrape-playwright/.test(f));
files.sort((a, b) => {
  const na = a.includes('output') ? 1 : +(a.match(/block(\d+)/) || [])[1] || 0;
  const nb = b.includes('output') ? 1 : +(b.match(/block(\d+)/) || [])[1] || 0;
  return na - nb;
});

const all = new Set();
const blocks = [];
let slots = 0;
let reveals = 0;
let imgs = 0;

for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(raw, f), 'utf8'));
  const n = f.includes('output') ? 1 : +(f.match(/block(\d+)/) || [])[1];
  const pages = j.pages || [];
  const ids = pages
    .map((p) => String(p.questionId || '').replace(/\D/g, ''))
    .filter(Boolean);
  ids.forEach((id) => all.add(id));
  const s = j.summary || {};
  const q = s.questionsScraped || ids.length;
  const r = s.revealsCaptured ?? pages.filter((p) => p.hasReveal).length;
  const i = s.totalPngCaptured ?? pages.reduce((n, p) => n + (p.imageCount || 0), 0);
  slots += q;
  reveals += r;
  imgs += i;
  blocks.push({ block: n, file: f, questions: q, reveals: r, images: i, q1: ids[0] || null });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  source: 'qb.ccscases.com',
  location: raw,
  blockCount: blocks.length,
  uniqueQuestionIds: all.size,
  totalQuestionSlots: slots,
  approximateRepeats: slots - all.size,
  totalRevealsLogged: reveals,
  totalImageRefs: imgs,
  poolLastKnown: {
    unused: 0,
    omitted: 5643,
    correct: 2,
    incorrect: 1,
    marked: 0,
    note: 'Unused drained; block 119 was final ~39-Q unused pack. Omitted still large.',
  },
  blocks,
};

fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(
  path.join(out, 'unique-question-ids.txt'),
  [...all].sort((a, b) => +a - +b).join('\n') + '\n'
);
console.log(
  JSON.stringify(
    { blocks: blocks.length, unique: all.size, slots, repeats: slots - all.size },
    null,
    2
  )
);
