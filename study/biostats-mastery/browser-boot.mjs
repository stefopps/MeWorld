import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

const resp = await page.goto('http://localhost:8090/index.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);

const boot = await page.evaluate(() => ({
  status: document.readyState,
  title: document.title,
  hasSwitchTab: typeof switchTab === 'function',
  hasTogglePivot: typeof togglePivotMode === 'function',
  hasBank: typeof QUESTION_BANK !== 'undefined',
  bankLen: typeof QUESTION_BANK !== 'undefined' ? QUESTION_BANK.length : -1,
  bodyLen: document.body?.innerText?.length || 0,
}));

console.log('HTTP', resp?.status());
console.log('BOOT', JSON.stringify(boot, null, 2));
console.log('ERRORS', errors);

await browser.close();
process.exit(boot.hasSwitchTab && boot.bankLen === 179 && errors.length === 0 ? 0 : 1);
