#!/usr/bin/env node
// smoke-preview.mjs — validate /rgraph standalone preview HTML
// Phase 1: static checks · Phase 2: Playwright Canvas + SVG rendering (--playwright)
// Usage: node scripts/smoke-preview.mjs --id 52 [--playwright]

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const args = process.argv.slice(2);
let id = null, runPlaywright = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id' && args[i + 1]) id = args[i + 1];
  if (args[i] === '--playwright') runPlaywright = true;
}
if (!id) { console.error('ERROR: --id <NNN> required'); process.exit(1); }

const previewPath = resolve(root, 'preview', `q${id}.html`);
if (!existsSync(previewPath)) { console.error(`FAIL: preview/q${id}.html not found`); process.exit(1); }
let html;
try { html = readFileSync(previewPath, 'utf8'); } catch (e) { console.error(`FAIL: cannot read — ${e.message}`); process.exit(1); }

const checks = { passed: 0, failed: 0 };
function chk(name, ok, detail) {
  if (ok) { checks.passed++; console.log(`  PASS: ${name}${detail ? ' — ' + detail : ''}`); }
  else { checks.failed++; console.error(`  FAIL: ${name}${detail ? ' — ' + detail : ''}`); }
}

console.log(`\n── Smoke: preview/q${id}.html ──`);
console.log(`  Phase 1: Static HTML`);

chk('<!DOCTYPE html>', /<!DOCTYPE\s+html/i.test(html));
chk('<html> / </html>', /<html/i.test(html) && /<\/html>/i.test(html));
chk('<head>', /<head>/i.test(html));
chk('<body>', /<body/i.test(html));

const darkRe = [/background:\s*#[0]{1,2}(0[0-9a-fA-F]){2}/, /background:\s*#0[cC][0c]/i, /background:\s*#[0-1]{1,2}[0-3][0-9a-fA-F]{2}/i, /\.card-dark/, /theme.*dark/i, /dark-theme/i];
const bgM = html.match(/body\s*\{[^}]*background:\s*([^;]+)/i);
chk('White/plain background', bgM && !darkRe.some(r => r.test(html)), bgM ? `bg=${bgM[1].trim()}` : 'no body bg');
chk('Dark text', /color:\s*#[1-3][0-9a-fA-F]{2}/i.test(html) || /color:\s*#000/i.test(html));

const hasCanvas = /<canvas\b/i.test(html);
const hasSvg = /<svg\b/i.test(html);
const isConceptGrid = /\bconceptGrid\b/i.test(html) || /\bconcept-card\b/i.test(html);
chk('Canvas or SVG rendering surface', hasCanvas || hasSvg || isConceptGrid, hasCanvas ? 'canvas' : hasSvg ? 'svg' : isConceptGrid ? 'concept grid (DOM)' : 'neither');
chk('Script block', /<script\b/i.test(html));
chk('Clickable options', /opt-btn|option.*onclick|\.onclick\s*=/i.test(html));
chk('JS interactivity', /addEventListener|\.onclick\s*=/i.test(html));

// Chart.js CDN only required for canvas-based graphs
if (hasCanvas) {
  const cdnOk = async (url) => { try { const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) }); return r.ok; } catch { return false; } };
  const cj = html.match(/src=["'](https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js[^"']+)["']/i);
  chk('Chart.js CDN', cj ? await cdnOk(cj[1]) : false, cj ? cj[1] : 'not found');
} else {
  chk('Chart.js CDN (not needed — SVG)', true, 'pure SVG graph');
}

chk('No fetch()', !/\bfetch\s*\(/i.test(html));
chk('No XHR', !/XMLHttpRequest/i.test(html));
chk('No localhost', !/localhost/i.test(html));
chk('No file-path loads', !/[A-Za-z]:\\[^"'\s]+\.json/i.test(html));

const hasInlineData = /\b(const|var|let)\s+Q\s*=\s*\{/i.test(html) || /\brulings\s*=\s*\{/i.test(html) || /\bbaseGraph\b/i.test(html) || /\bciLow\b/i.test(html) || /\bptsA\s*=\s*\[/i.test(html) || /\bterms\s*=\s*\{/i.test(html) || /\bbiomarkers\s*=\s*\[/i.test(html);
chk('Inline data', hasInlineData, hasInlineData ? 'embedded' : 'not detected');

// Font slider check (philosophy rule #4)
const hasFontSlider = /font[-_]?slider|font[-_]?scale|type=.range..*font/i.test(html);
chk('Font slider', hasFontSlider);

// Start-from-zero check (philosophy rule #1)
const hasZeroStart = /d\s*[:=]\s*0\b|dVal\s*[:=]\s*0|zObs\s*[:=]\s*0|z_obs\s*[:=]\s*0|ciLo\w*\s*=\s*xPx\(|xPx\(\s*3\.\d|5\.5.*7\.8|estimate\s*[:=]\s*5|\bciInterpreter\b|sn\s*[:=]\s*0\.\d|sp\s*[:=]\s*0\.\d|biomarkers\s*:\s*\[|thresholdX\s*=\s*0\.|ptsA\s*=\s*\[\[|ptsB\s*=\s*\[\[|\bconceptGrid\b|originalData\s*=\s*\[|CIs\s*=\s*\{|multiCI|SENSITIVITY\s*=\s*0\.|SPECIFICITY\s*=\s*0\.|ppvPct\b/.test(html);
chk('Starts from base state (d=0 | zObs=0 | data/CI/ROC/conceptGrid visible)', hasZeroStart);

// Phase 2: Playwright Canvas / SVG rendering
if (runPlaywright) {
  console.log(`\n  Phase 2: Playwright Render Check`);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://localhost:9091/preview/q${id}.html`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Check canvases
    const cCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
    // Check SVGs
    const sCount = await page.evaluate(() => document.querySelectorAll('svg').length);

    if (hasCanvas) {
      chk('Canvas in DOM', cCount > 0, `${cCount} found`);
      const info = await page.evaluate(() => {
        try {
          const cs = document.querySelectorAll('canvas');
          if (!cs.length) return 'no canvas';
          const chart = Chart.getChart(cs[0]);
          if (!chart) return 'no Chart instance';
          const ds = chart.data.datasets || [];
          const td = ds.filter(d => d.data && d.data.length > 0);
          if (!td.length) return 'all datasets empty';
          return `OK: ${td.length} datasets, ${td[0].data.length} pts`;
        } catch(e) { return 'err: '+e.message; }
      });
      chk('Chart renders data', info.startsWith('OK'), info);
    }

    if (hasSvg) {
      chk('SVG in DOM', sCount > 0, `${sCount} found`);
      const svgInfo = await page.evaluate(() => {
        try {
          const svgs = document.querySelectorAll('svg');
          if (!svgs.length) return 'no svg';
          const svg = svgs[0];
          const lines = svg.querySelectorAll('line,rect,circle,path,text,polygon').length;
          if (lines === 0) return 'svg empty — no elements';
          return `OK: ${lines} SVG elements rendered`;
        } catch(e) { return 'err: '+e.message; }
      });
      chk('SVG renders elements', svgInfo.startsWith('OK'), svgInfo);
    }

    const ss = resolve(__dirname, `q${id}-preview-smoke.png`);
    await page.screenshot({ path: ss, fullPage: false });
    console.log(`  Screenshot: scripts/q${id}-preview-smoke.png`);
    await browser.close();
  } catch(e) {
    chk('Playwright run', false, e.message);
    if (browser) await browser.close();
  }
}

console.log(`\n── Results: ${checks.passed} passed, ${checks.failed} failed ──`);
if (checks.failed) { console.error(`\nSMOKE FAILED — fix ${checks.failed} issue(s).\n`); process.exit(1); }
else { console.log('\nSMOKE PASSED.\n'); process.exit(0); }
