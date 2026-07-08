// Browser smoke: cycle through questions, verify graph rendering
const { chromium } = require('playwright');
const path = require('node:path');

const root = path.dirname(__dirname);
const URL = 'http://localhost:9091/index.html';
const errors = [];
const ok = (msg) => console.log('  OK  ' + msg);
const fail = (msg) => { errors.push(msg); console.log('  !!  ' + msg); };

async function checkActiveGraph(page) {
  return page.evaluate(() => {
    const canvasIds = ['chart-quiz-cumulative','chart-quiz-normal','chart-quiz-bar','chart-quiz-ppv','chart-quiz-roc','chart-quiz-dot'];
    for (const id of canvasIds) {
      const el = document.getElementById(id);
      if (el) {
        const style = window.getComputedStyle(el);
        if (style.visibility === 'visible' && style.display !== 'none') return id;
      }
    }
    const htmlDiv = document.getElementById('chart-quiz-html');
    if (htmlDiv && htmlDiv.style.display !== 'none') return 'html-div';
    const forestDiv = document.getElementById('chart-quiz-forest');
    if (forestDiv && forestDiv.style.display !== 'none') return 'forest-div';
    const banner = document.getElementById('graph-crash-banner');
    if (banner && banner.style.display !== 'none') return 'CRASH:' + banner.textContent;
    return null;
  });
}

async function run() {
  console.log('Biostats browser smoke\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));
  
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  
  // 1. Check all canvases have non-zero dimensions
  const dims = await page.evaluate(() => {
    const ids = ['chart-quiz-cumulative','chart-quiz-normal','chart-quiz-bar','chart-quiz-ppv','chart-quiz-roc','chart-quiz-dot'];
    const result = {};
    for (const id of ids) {
      const c = document.getElementById(id);
      if (!c) { result[id] = 'missing'; continue; }
      const r = c.getBoundingClientRect();
      result[id] = Math.round(r.width) + 'x' + Math.round(r.height);
    }
    return result;
  });
  for (const [id, dim] of Object.entries(dims)) {
    if (dim === 'missing' || dim.startsWith('0x')) {
      fail('canvas dim ' + id + ': ' + dim);
    } else {
      ok('canvas ' + id + ': ' + dim);
    }
  }
  
  // 2. Check initial Q1 render
  let info = await page.evaluate(() => ({
    stem: document.getElementById('q-stem')?.textContent?.slice(0, 60),
  }));
  const active0 = await checkActiveGraph(page);
  active0 && !active0.startsWith('CRASH')
    ? ok('Q1 initial: "' + info.stem + '" -> ' + active0)
    : fail('Q1 initial render: ' + (active0 || 'no graph! ' + info.stem));
  
  // 3. Cycle through questions 2-15
  const coverage = new Set();
  if (active0 && !active0.startsWith('CRASH')) coverage.add(active0);
  
  for (let i = 0; i < 14; i++) {
    const nextBtn = page.locator('#next-btn');
    if (!(await nextBtn.isVisible())) break;
    await nextBtn.click();
    await page.waitForTimeout(500);
    
    const active = await checkActiveGraph(page);
    const stem = await page.evaluate(() => document.getElementById('q-stem')?.textContent?.slice(0, 50));
    
    if (active && active.startsWith('CRASH')) {
      fail('Q' + (i+2) + ' CRASH: ' + active.replace('CRASH:','') + ' (stem: ' + stem + ')');
    } else if (!active) {
      fail('Q' + (i+2) + ': NO visible graph! stem="' + stem + '"');
    } else {
      coverage.add(active);
      ok('Q' + (i+2) + ': "' + stem + '" -> ' + active);
    }
  }
  
  console.log('\n  Type coverage: ' + coverage.size + ' render targets: [' + [...coverage].join(', ') + ']');
  
  // 4. JS errors
  if (jsErrors.length) {
    console.log('\n  JS Console Errors (' + jsErrors.length + '):');
    for (const e of [...new Set(jsErrors)].slice(0, 12)) fail(e.slice(0, 130));
  } else {
    ok('no JS console errors');
  }
  
  // 5. Screenshot final state
  await page.screenshot({ path: path.join(root, 'scripts', 'smoke-final.png'), fullPage: false });
  ok('screenshot: scripts/smoke-final.png');
  
  await browser.close();
  
  console.log('');
  if (errors.length) {
    console.log('FAILED: ' + errors.length + ' issue(s)');
    process.exit(1);
  }
  console.log('BROWSER SMOKE PASSED - all graphs render correctly');
}

run().catch(e => { console.error(e); process.exit(1); });
