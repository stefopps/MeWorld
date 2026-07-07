import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

await page.goto('http://localhost:8090/index.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

const result = await page.evaluate(() => ({
  title: document.title,
  qCount: typeof QUESTION_BANK !== 'undefined' ? QUESTION_BANK.length : -1,
  hasPivot: typeof togglePivotMode === 'function',
  tabs: [...document.querySelectorAll('.tab-btn')].map((e) => e.textContent.trim()),
  stem: document.getElementById('q-stem')?.textContent?.slice(0, 100) || '',
  progressBefore: document.getElementById('q-progress')?.textContent || '',
}));

// Switch to Questions tab via app API (more reliable than click)
await page.evaluate(() => switchTab('quiz'));
await page.waitForTimeout(1500);

const afterTab = await page.evaluate(() => ({
  activeTab,
  stem: document.getElementById('q-stem')?.textContent?.slice(0, 100) || '',
  pivotDisplay: getComputedStyle(document.getElementById('pivot-toggle')).display,
  navDisplay: getComputedStyle(document.getElementById('quiz-nav-group')).display,
  chartVisible: ['chart-quiz-cumulative', 'chart-quiz-normal', 'chart-quiz-bar', 'chart-quiz-ppv', 'chart-quiz-html']
    .some((id) => {
      const el = document.getElementById(id);
      return el && getComputedStyle(el).display !== 'none';
    }),
}));

// Enable pivot mode via app API
await page.evaluate(async () => {
  if (!pivotManifest) await loadPivotManifest();
  await togglePivotMode();
});
await page.waitForTimeout(1500);

const pivot = await page.evaluate(() => ({
  pivotMode,
  pivotManifestLoaded: !!pivotManifest,
  progress: document.getElementById('q-progress')?.textContent || '',
  pivotBarVisible: document.getElementById('pivot-info-bar')?.classList.contains('pivot-visible'),
  chartVisible: ['chart-quiz-cumulative', 'chart-quiz-normal', 'chart-quiz-bar', 'chart-quiz-ppv', 'chart-quiz-html']
    .some((id) => {
      const el = document.getElementById(id);
      return el && getComputedStyle(el).display !== 'none';
    }),
}));

// Click first answer option
const opt = page.locator('.q-opt').first();
if (await opt.count()) {
  await opt.click();
  await page.waitForTimeout(800);
}

const afterClick = await page.evaluate(() => ({
  formulaPanel: document.getElementById('panel-body-formula')?.innerHTML?.slice(0, 120) || '',
  chartStillVisible: ['chart-quiz-cumulative', 'chart-quiz-normal', 'chart-quiz-bar', 'chart-quiz-ppv', 'chart-quiz-html']
    .some((id) => {
      const el = document.getElementById(id);
      return el && getComputedStyle(el).display !== 'none';
    }),
}));

await browser.close();

const report = { ...result, afterTab, pivot, afterClick, jsErrors: errors };
console.log(JSON.stringify(report, null, 2));

const ok =
  result.qCount === 179 &&
  result.hasPivot &&
  pivot.pivotMode === true &&
  pivot.pivotManifestLoaded === true &&
  (afterTab.chartVisible || pivot.chartVisible) &&
  errors.length === 0;

if (!ok) {
  console.error('\nBROWSER SMOKE FAILED');
  process.exit(1);
}
console.log('\nBROWSER SMOKE PASSED');
