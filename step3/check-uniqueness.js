const fs = require('fs');
const path = require('path');

// Prefer organized bank; fall back to step3 root
const CANDIDATE_DIRS = [
  path.join(__dirname, 'scrape-bank', 'raw'),
  __dirname,
];

function loadBlock(n) {
  const name = n === 1 ? 'scrape-playwright-output.json' : `scrape-playwright-block${n}.json`;
  for (const dir of CANDIDATE_DIRS) {
    const f = path.join(dir, name);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  throw new Error('missing ' + name);
}

function ids(j) {
  return new Set(
    (j.pages || [])
      .map((x) => String(x.questionId || '').replace(/\D/g, ''))
      .filter(Boolean)
  );
}

function overlap(a, b) {
  let o = 0;
  for (const x of a) if (b.has(x)) o++;
  return o;
}

const global = new Set();
let prevSet = new Set();

console.log('Block | Q1    | vs PREV block | vs ALL prior blocks');
console.log('------|-------|---------------|--------------------');

for (let n = 1; n <= 200; n++) {
  const f = n === 1 ? 'scrape-playwright-output.json' : `scrape-playwright-block${n}.json`;
  let exists = false;
  for (const dir of CANDIDATE_DIRS) {
    if (fs.existsSync(path.join(dir, f))) {
      exists = true;
      break;
    }
  }
  if (!exists) continue;

  const set = ids(loadBlock(n));
  const q1 = [...set][0] || '?';
  const vsPrev = n > 1 ? overlap(set, prevSet) : 0;
  const vsAll = overlap(set, global);
  const flag = vsPrev >= 40 ? ' *** SAME 50-PACK ***' : vsPrev >= 3 ? ' (overlap warn)' : ' ✓ fresh pack';

  console.log(
    `${String(n).padStart(5)} | ${String(q1).padStart(5)} | ${String(vsPrev).padStart(2)}/50 (${Math.round((100 * vsPrev) / 50)}%)`.padEnd(36) +
      `| ${String(vsAll).padStart(3)}/${set.size}${flag}`
  );

  set.forEach((x) => global.add(x));
  prevSet = set;
}

console.log(`\nTotal unique question IDs across all saved blocks: ${global.size}`);
