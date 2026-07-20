/**
 * Differential practice smoke — data integrity + live API (record / buttons).
 * Run before Real World search or after differential UI/server changes:
 *   npm run smoke:differential
 * Requires dev API for voice checks: npm run dev
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const API = process.env.API_BASE || 'http://127.0.0.1:3001';

let fail = 0;

function ok(cond, name, detail = '') {
  const mark = cond ? '✅' : '❌';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fail += 1;
  return cond;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

async function fetchJson(route) {
  try {
    const res = await fetch(`${API}${route}`, { signal: AbortSignal.timeout(route.includes('voice-note') ? 20000 : 8000) });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) return { error: `HTTP ${res.status}` };
    if (!ct.includes('json')) return { error: 'not JSON' };
    return { data: await res.json() };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function main() {
  console.log('=== Differential Practice — Smoke Test ===\n');

  const { auditComponentCss } = await import('./audit-component-css.mjs');
  const cssIssues = auditComponentCss(root);
  ok(cssIssues.length === 0, 'css-audit: differential-practice wired', cssIssues[0] || 'ok');

  const bank = readJson('src/data/differentialBank.json');
  const reviewRaw = readJson('src/data/differentialReview.json');
  const review = reviewRaw.cases || {};
  const prepared = readJson('src/data/preparedCases.json').cases || {};

  console.log('\n1. Data sources');
  ok(Array.isArray(bank) && bank.length === 181, 'differentialBank: 181 entries', `${bank.length}`);
  ok(
    bank.every((e) => e.caseId && e.topic && e.diagnosis && Array.isArray(e.diagnoses)),
    'differentialBank: required fields',
  );
  ok(Object.keys(review).length >= 181, 'differentialReview: cases', `${Object.keys(review).length}`);
  ok(Object.keys(prepared).length >= 181, 'preparedCases: cases', `${Object.keys(prepared).length}`);

  let reviewMismatch = 0;
  for (const entry of bank.slice(0, 30)) {
    const key = String(entry.caseId);
    const rev = review[key];
    const revTopic = rev?.topic || rev?.title || '';
    if (!revTopic || revTopic !== entry.topic) reviewMismatch += 1;
  }
  ok(reviewMismatch === 0, 'differentialReview: topic matches bank (sample 30)', reviewMismatch ? `${reviewMismatch} mismatches` : '');

  const c149 = bank.find((e) => e.caseId === 149);
  ok(c149?.topic === 'Chronic Diarrhea', 'case 149 topic', c149?.topic || 'missing');
  ok(/zollinger|gastrin|diarrhea/i.test(c149?.diagnosis || ''), 'case 149 diagnosis sane', c149?.diagnosis);

  console.log('\n2. Live API (record + Real World)');
  const health = await fetchJson('/api/health');
  if (health.error) {
    ok(false, 'api: server running', `${API} — ${health.error} (run npm run dev)`);
    console.log('\n⚠ Skipping voice-note / real-world checks — start API first.\n');
  } else {
    ok(true, 'api: health', JSON.stringify(health.data));

    const voice = await fetchJson('/api/voice-note/status');
    if (voice.error) {
      ok(false, 'voice-note/status', voice.error);
    } else {
      const s = voice.data;
      ok(s?.merge === true, 'voice-note: merge available', `merge=${s?.merge}`);
      ok(s?.batch === true, 'voice-note: batch STT (record button)', `mode=${s?.mode} batch=${s?.batch}`);
      ok(s?.mode !== 'browser', 'voice-note: not browser-only fallback', `mode=${s?.mode}`);
    }

    const rwPost = await fetch(`${API}/api/differential/real-world`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId: 78,
        topic: 'Generalized Weakness',
        diagnosis: 'Renal Cell Carcinoma',
        refresh: false,
      }),
      signal: AbortSignal.timeout(45000),
    }).catch((e) => ({ ok: false, status: 0, error: String(e.message || e) }));
    if (rwPost.error) {
      ok(false, 'real-world: POST reachable', rwPost.error);
    } else {
      ok(rwPost.ok || rwPost.status === 200, 'real-world: POST responds', `status=${rwPost.status}`);
    }
  }

  console.log('\n--- Summary ---');
  if (fail) {
    console.log(`❌ ${fail} check(s) failed — fix before Real World search or record work.\n`);
    process.exit(1);
  }
  console.log('✅ All differential smoke checks passed.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
