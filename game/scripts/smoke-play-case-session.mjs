/**
 * Welcome → nav panels → Play (random case) → Briefing → Play scene → uber U01 deep-link.
 * Screenshots for agent/human verification before "dev is ready".
 *
 * Run with dev servers up:
 *   npm run dev
 *   npm run smoke:play-case
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditComponentCss } from './audit-component-css.mjs';
import { assertRenderable } from './smoke-screen-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const WEB = process.env.WEB_BASE || 'http://127.0.0.1:5173';
const API = process.env.API_BASE || 'http://127.0.0.1:3001';
function shotDir() {
  const day = new Date().toISOString().slice(0, 10);
  const run = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const dir = path.join(root, 'docs', 'smoke-screenshots', day, 'play-case', `run-${run}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let OUT_DIR = shotDir();
let shotSeq = 0;
let fail = 0;

function ok(cond, name, detail = '') {
  const mark = cond ? '✅' : '❌';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fail += 1;
  return cond;
}

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${String(++shotSeq).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`   📸 ${file} (${kb} KB)`);
  return file;
}

async function waitForServer(url, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function dismissPhysicianOnboarding(page) {
  const physicianBtn = page.getByRole('button', { name: /continue as physician/i });
  if (await physicianBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await physicianBtn.click();
    await page.waitForSelector('.welcome-entry-modal', { state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

async function openCaseFromWelcome(page) {
  const playNav = page.locator('.welcome-nav-item').filter({ hasText: 'Play' });
  await playNav.click();
  await page.waitForSelector('main.briefing, .briefing-with-scene', { timeout: 45000 });
}

async function smokeWelcomeNavPanels(page, prefix) {
  const timelineNav = page.locator('.welcome-nav-item').filter({ hasText: 'Timeline' });
  ok(await timelineNav.isEnabled({ timeout: 5000 }), 'Timeline nav enabled');
  await timelineNav.click();
  await page.waitForSelector('.welcome-panel--timeline', { timeout: 10000 });
  await assertRenderable(page, ok, 'timeline panel');
  await shot(page, `${prefix}-timeline-panel`);
  await page.locator('.welcome-panel--timeline .welcome-panel-close').click();
  await page.waitForSelector('.welcome-panel--timeline', { state: 'hidden', timeout: 5000 });
}

async function smokeOrderDockRole(page, prefix) {
  const dock = page.locator('.scene-order-command-dock').first();
  ok(await dock.isVisible({ timeout: 8000 }), 'order command dock visible');
  const roleSeg = dock.locator('.scene-order-command-role .ap-role-segment');
  ok((await roleSeg.count()) > 0, 'patient/attending icon toggle on order dock');
  await shot(page, `${prefix}-order-dock`);
  const attendingBtn = roleSeg.getByRole('tab', { name: /attending/i });
  if (await attendingBtn.count()) {
    await attendingBtn.first().click();
    await page.waitForTimeout(350);
    await shot(page, `${prefix}-order-dock-attending`);
  }
}

async function smokePlaySettingsToggles(page, prefix) {
  await page.locator('.scene-timeline-dock, .play-notes-session-foot, .panel-rail').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(200);
  // Current Play chrome: Scene tools gear on the right panel rail (not PlaySceneToolbar).
  const settingsBtn = page.locator('button.panel-settings-btn[aria-label="Scene tools"]').first();
  ok(await settingsBtn.isVisible({ timeout: 8000 }), 'play settings button visible');
  await settingsBtn.scrollIntoViewIfNeeded().catch(() => {});
  // Use DOM click to avoid Playwright pointerdown racing the outside-close listener.
  await settingsBtn.evaluate((el) => {
    if (el.getAttribute('aria-expanded') !== 'true') el.click();
  });
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button.panel-settings-btn[aria-label="Scene tools"]');
      const pop = document.querySelector('.toolbar-settings-popover, .settings-popover[aria-label="Scene tools"]');
      return btn?.getAttribute('aria-expanded') === 'true' && !!pop;
    },
    { timeout: 10000 },
  );

  async function readToggleState(locator) {
    return locator.first().evaluate((el) => ({
      pressed: el.getAttribute('aria-pressed') === 'true',
      active: el.classList.contains('settings-popover-btn--on'),
      label: el.textContent?.trim() || '',
    }));
  }

  async function assertToggleTwoWay(locator, name) {
    ok((await locator.count()) > 0, `${name} toggle present`);
    const before = await readToggleState(locator);
    await locator.first().click();
    await page.waitForTimeout(200);
    const mid = await readToggleState(locator);
    const changed =
      before.pressed !== mid.pressed ||
      before.active !== mid.active ||
      before.label !== mid.label;
    ok(changed, `${name} toggle changes state on first click`, `${before.label} → ${mid.label}`);
    if (mid.pressed || mid.active) {
      ok(mid.pressed && mid.active, `${name} toggle ON shows pressed + active class`, mid.label);
      await shot(page, `${prefix}-${name.toLowerCase().replace(/\s+/g, '-')}-on`);
    }
    await locator.first().click();
    await page.waitForTimeout(200);
    const after = await readToggleState(locator);
    const restored =
      after.pressed !== mid.pressed ||
      after.active !== mid.active ||
      after.label !== mid.label;
    ok(restored, `${name} toggle changes state on second click`, `${mid.label} → ${after.label}`);
    ok(
      after.pressed === before.pressed &&
        after.active === before.active &&
        after.label === before.label,
      `${name} toggle round-trip restores initial state`,
      after.label,
    );
  }

  await assertToggleTwoWay(
    page.locator('.toolbar-settings-popover button').filter({
      hasText: /^(Timed: ON|Untimed)$/,
    }),
    'Timed',
  );

  await assertToggleTwoWay(
    page.locator('.toolbar-settings-popover button').filter({
      hasText: /^(Deterioration: ON|Simulate deterioration)$/,
    }),
    'Deterioration',
  );

  await settingsBtn.click();
  await page.waitForSelector('.toolbar-settings-popover', { state: 'hidden', timeout: 5000 }).catch(() => {});
}

async function smokeUberDeepLink(page) {
  await page.goto(`${WEB}/?case=U01`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.game-scene, main.briefing, .briefing-with-scene', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await assertRenderable(page, ok, 'uber U01 route');
  await shot(page, '09-uber-u01');
  const hasPlayOrBriefing =
    (await page.locator('.game-scene').isVisible().catch(() => false)) ||
    (await page.locator('main.briefing, .briefing-with-scene').isVisible().catch(() => false));
  ok(hasPlayOrBriefing, 'uber U01 opens briefing or play');
}

async function main() {
  console.log('=== Play case session smoke + screenshots ===\n');

  const cssIssues = auditComponentCss(root);
  ok(cssIssues.length === 0, 'css-audit', cssIssues[0] || 'ok');

  ok(await waitForServer(`${WEB}/`), 'vite reachable', WEB);
  ok(await waitForServer(`${API}/api/health`), 'api reachable', API);

  const errors = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    const now = new Date().toISOString();
    localStorage.setItem(
      'schoonmaker_progress',
      JSON.stringify({
        cases: {
          '001': { plays: 1, attempted: true, attemptedAt: now, lastVisited: now },
          U01: { plays: 1, attempted: true, attemptedAt: now, lastVisited: now },
        },
        lastMode: 'browse',
      }),
    );
    localStorage.setItem('schoonmaker_onboarding_complete', '1');
    localStorage.setItem(
      'schoonmaker_audience_profile',
      JSON.stringify({
        level: 'advanced',
        playRole: 'doctor',
        difficulty: 'standard',
        timerSeconds: 150,
      }),
    );
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/React does not recognize|Warning:/i.test(text)) return;
    if (/Failed to load resource:.*\b500\b/i.test(text)) return;
    if (/Failed to load resource:.*\b429\b/i.test(text)) return;
    errors.push(text);
  });

  await page.goto(WEB, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(800);
  await assertRenderable(page, ok, 'welcome load');
  await shot(page, '01-welcome');

  const showedOnboarding = await dismissPhysicianOnboarding(page);
  if (showedOnboarding) await shot(page, '02-after-physician');

  ok(
    await page.locator('.welcome-nav, .welcome-title').first().isVisible({ timeout: 8000 }),
    'welcome hud visible',
  );
  await shot(page, showedOnboarding ? '03-welcome-ready' : '02-welcome-ready');
  await assertRenderable(page, ok, 'welcome ready');

  await smokeWelcomeNavPanels(page, showedOnboarding ? '04' : '03');

  await page.goto(WEB, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(500);
  await openCaseFromWelcome(page);

  await page.waitForTimeout(1200);
  await assertRenderable(page, ok, 'briefing');
  await shot(page, showedOnboarding ? '05-briefing' : '04-briefing');

  const caseLabel = await page.locator('.briefing-case').first().textContent().catch(() => '');
  ok(Boolean(caseLabel?.trim()), 'briefing shows case id', caseLabel?.trim() || 'missing');

  const beginBtn = page.getByRole('button', { name: /begin case/i });
  ok(await beginBtn.isVisible({ timeout: 8000 }), 'Begin case button visible');
  await beginBtn.click();

  await page.waitForSelector('main.briefing', { state: 'hidden', timeout: 20000 }).catch(() => {});
  await page.waitForSelector('.game-scene, div.game', { timeout: 60000 });
  await page.waitForSelector('.game-scene', { timeout: 20000 });
  await page.waitForTimeout(2000);
  await assertRenderable(page, ok, 'play scene');
  await shot(page, showedOnboarding ? '06-play-scene' : '05-play-scene');

  const lifeBar = page.locator('.pack-life-fill, .play-life-top-left').first();
  ok(await lifeBar.isVisible({ timeout: 8000 }), 'play scene mounted (life bar)');

  const stacks = page.locator('.scene-order-command-dock, .game-sidebar, .icu-monitor-docked').first();
  ok(await stacks.isVisible({ timeout: 10000 }), 'play chrome visible (dock / sidebar / monitor)');

  await smokeOrderDockRole(page, showedOnboarding ? '06' : '05b');

  await smokePlaySettingsToggles(page, showedOnboarding ? '07' : '06');

  await smokeUberDeepLink(page);

  const portraitBtn = page.locator('.panel-portrait-btn');
  if (await portraitBtn.count()) {
    await portraitBtn.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, 'portrait-panel');
    ok(await page.locator('.portrait-brief-popover:not(.is-closed)').count() > 0, 'portrait panel opens');
  }

  if (errors.length) {
    console.log('\n⚠ Browser console errors:');
    for (const e of errors.slice(0, 8)) console.log(`   ${e.slice(0, 200)}`);
    ok(errors.length === 0, 'no page errors', `${errors.length} error(s)`);
  } else {
    ok(true, 'no page errors');
  }

  await browser.close();

  console.log(`\nScreenshots folder: ${OUT_DIR}`);
  if (fail) {
    console.log(`\n❌ ${fail} check(s) failed.\n`);
    process.exit(1);
  }
  console.log('\n✅ Play case session smoke passed with screenshots.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
