/**
 * Screenshot + parse page state on handoff roadblocks; login and recover.
 */

const fs = require('fs');
const path = require('path');

const ROADBLOCK_DIR = path.join(__dirname, 'roadblock-screenshots');
const CREDS_PATH = path.join(__dirname, 'ccs_credentials.json');
const QB_URL = 'https://qb.ccscases.com/';

function loadCreds() {
  if (!fs.existsSync(CREDS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function parsePageState(page) {
  return page.evaluate(() => {
    const btn = (el) =>
      (el?.getAttribute('title') || el?.innerText || el?.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();

    const buttons = [...document.querySelectorAll('button, [role="button"], a.sidebarNavButton')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: btn(el).slice(0, 120),
          className: (el.className || '').slice(0, 80),
          visible: r.width > 2 && r.height > 2,
          img: el.querySelector('img')?.src?.split('/').pop() || null,
        };
      })
      .filter((b) => b.label && b.visible);

    const overlays = [];
    for (const el of [
      document.getElementById('modal-root'),
      ...document.querySelectorAll('[role="dialog"], [class*="testPopup" i], [class*="popup" i], [class*="modal" i]'),
    ]) {
      if (!el) continue;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (text.length < 3) continue;
      overlays.push(text.slice(0, 500));
    }

    const num = document.querySelector('.item-block')?.innerText?.trim() || '';
    const loginEmail = document.querySelector('input[autocomplete="email"], input[type="email"]');
    const loginPass = document.querySelector('input[type="password"]');

    return {
      url: location.href,
      pathname: location.pathname,
      title: document.title,
      questionNumber: num,
      questionId: document.querySelector('.item-info span')?.innerText?.trim() || '',
      inTest: !!document.querySelector('#test'),
      hasNext: !!document.querySelector('.next-button'),
      loginForm: !!(loginEmail && loginPass),
      overlays,
      buttons: buttons.slice(0, 40),
      bodySnippet: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 800),
    };
  });
}

async function captureRoadblock(page, tag, reason = '') {
  fs.mkdirSync(ROADBLOCK_DIR, { recursive: true });
  const ts = stamp();
  const base = `${ts}_${tag}`;
  const pngPath = path.join(ROADBLOCK_DIR, `${base}.png`);
  const jsonPath = path.join(ROADBLOCK_DIR, `${base}.json`);

  const state = await parsePageState(page).catch(() => ({}));
  await page.screenshot({ path: pngPath, fullPage: true }).catch(() => {});

  const record = {
    at: new Date().toISOString(),
    tag,
    reason,
    screenshot: pngPath,
    state,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2));

  console.log(`\n📸 ROADBLOCK [${tag}] — ${reason || 'unknown'}`);
  console.log(`   screenshot: ${pngPath}`);
  console.log(`   url: ${state.url || '?'}`);
  console.log(`   pathname: ${state.pathname || '?'}  Q: ${state.questionNumber || '—'}`);
  if (state.overlays?.length) console.log(`   overlay: ${state.overlays[0].slice(0, 120)}…`);
  const labels = (state.buttons || []).map((b) => b.label).slice(0, 12);
  if (labels.length) console.log(`   buttons: ${labels.join(' | ')}`);

  return record;
}

async function ensureLoggedIn(page) {
  const state = await parsePageState(page);
  if (!state.loginForm) return { ok: true, already: true };

  const creds = loadCreds();
  if (!creds?.email || !creds?.password) {
    await captureRoadblock(page, 'login_missing_creds', 'Login form visible but no ccs_credentials.json');
    return { ok: false, reason: 'no_credentials' };
  }

  console.log('  [recover] Logging in…');
  await page.locator('input[autocomplete="email"], input[type="email"]').first().fill(creds.email);
  await page.locator('input[type="password"]').first().fill(creds.password);
  await page.getByRole('button', { name: /^Login$/i }).click({ timeout: 15000 }).catch(async () => {
    await page.locator('.loginButton, .loginPrimaryButton').first().click();
  });

  await page.waitForTimeout(2000);
  const after = await parsePageState(page);
  if (after.loginForm) {
    await captureRoadblock(page, 'login_failed', 'Still on login after submit');
    return { ok: false, reason: 'login_failed' };
  }
  console.log('  [recover] Logged in →', after.pathname || after.url);
  return { ok: true, already: false };
}

async function clickVisibleButton(page, patterns, { exclude = [] } = {}) {
  const sources = patterns.map((p) => (p instanceof RegExp ? p.source : String(p)));
  const excludeSources = exclude.map((p) => (p instanceof RegExp ? p.source : String(p)));
  return page.evaluate(
    ({ sources, excludeSources }) => {
      const pats = sources.map((s) => new RegExp(s, 'i'));
      const excl = excludeSources.map((s) => new RegExp(s, 'i'));
      for (const btn of document.querySelectorAll('button, [role="button"], a')) {
        const t = (btn.innerText || btn.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
        if (!t || excl.some((p) => p.test(t))) continue;
        if (!pats.some((p) => p.test(t))) continue;
        const r = btn.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        btn.click();
        return t;
      }
      return null;
    },
    { sources, excludeSources }
  );
}

async function recoverFromRoadblock(page, reason = 'handoff_stuck') {
  await page.goto(QB_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);

  const login = await ensureLoggedIn(page);
  if (!login.ok) return { ok: false, action: 'login', login };

  let state = await parsePageState(page);
  await captureRoadblock(page, 'recover_start', reason);

  // Pause Block = wrong path — cancel
  if (/pause block|attempt name|pause your test/i.test(state.bodySnippet || '')) {
    console.log('  [recover] Cancelling Pause Block modal');
    await clickVisibleButton(page, [/^Cancel$/i, /^Close$/i], { exclude: [] });
    await page.waitForTimeout(600);
    state = await parsePageState(page);
  }

  // End Block confirm popup
  if ((state.buttons || []).some((b) => /^Confirm$/i.test(b.label))) {
    console.log('  [recover] Clicking Confirm');
    await clickVisibleButton(page, [/^Confirm$/i], { exclude: [/cancel/i] });
    await page.waitForTimeout(1000);
    state = await parsePageState(page);
    await captureRoadblock(page, 'after_confirm', 'post-confirm');
  }

  // Review screen
  if ((state.buttons || []).some((b) => /end review/i.test(b.label))) {
    console.log('  [recover] Clicking End Review');
    await clickVisibleButton(page, [/end review/i]);
    await page.waitForTimeout(1500);
    state = await parsePageState(page);
  }

  // Dashboard / completed — create fresh test
  if (/completetests|createtest|^\/$/.test(state.pathname || '')) {
    if (!(state.buttons || []).some((b) => /begin test|start test/i.test(b.label))) {
      console.log('  [recover] Navigating Create Test');
      await clickVisibleButton(page, [/create test/i, /create block/i]);
      await page.waitForTimeout(1200);
      state = await parsePageState(page);
    }
  }

  if (/createtest/i.test(state.pathname || '')) {
    const hasBegin = (state.buttons || []).some((b) => /begin test|start test/i.test(b.label));
    if (!hasBegin) {
      await clickVisibleButton(page, [/practice mode/i]);
      await page.waitForTimeout(400);
    }
    console.log('  [recover] Clicking Begin Test');
    await clickVisibleButton(page, [/begin test/i, /start test/i]);
    await page.waitForTimeout(2000);
    state = await parsePageState(page);
  }

  // In test but not ended — End Block flow if stuck mid-test after duplicate
  if (state.inTest && state.hasNext && /end block/i.test((state.buttons || []).map((b) => b.label).join(' '))) {
    const endBtn = (state.buttons || []).find(
      (b) => /^End Block$/i.test(b.label) && !/suspend|pause/i.test(b.label)
    );
    if (endBtn && (reason.includes('duplicate') || reason.includes('same_block'))) {
      console.log('  [recover] Same block detected — End Block for fresh test');
      await clickVisibleButton(page, [/^End Block$/i], { exclude: [/suspend/i, /pause/i, /resume/i] });
      await page.waitForTimeout(800);
      await clickVisibleButton(page, [/^Confirm$/i], { exclude: [/cancel/i] });
      await page.waitForTimeout(1000);
      await clickVisibleButton(page, [/end review/i]);
      await page.waitForTimeout(1000);
      await clickVisibleButton(page, [/create test/i]);
      await page.waitForTimeout(1000);
      await clickVisibleButton(page, [/begin test/i, /start test/i]);
      await page.waitForTimeout(2000);
      state = await parsePageState(page);
    }
  }

  const q1 = state.questionNumber?.match(/^1\s*\/\s*50/);
  const ready = q1 && state.hasNext && state.inTest;

  if (!ready) {
    await captureRoadblock(page, 'recover_failed', `Still not on Q1/50 — ${reason}`);
    return { ok: false, action: 'recover_incomplete', state };
  }

  await captureRoadblock(page, 'recover_ok', `Q1 ready ID ${state.questionId}`);
  return { ok: true, action: 'recover_ok', state };
}

module.exports = {
  ROADBLOCK_DIR,
  parsePageState,
  captureRoadblock,
  ensureLoggedIn,
  recoverFromRoadblock,
  loadCreds,
};
