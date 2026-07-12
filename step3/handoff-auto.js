/**
 * Auto handoff — replays the recorded CCS flow from handoff-recordings/.
 *
 * Canonical sequence (blocks 21–25):
 *   End Block → Confirm → End Review → Create Test → [Practice Mode?] → Begin Test → Q1/50
 */

const fs = require('fs');
const path = require('path');
const { captureRoadblock, ensureLoggedIn, recoverFromRoadblock } = require('./roadblock-helper.js');
const { captureAndLogPoolStats } = require('./pool-stats.js');

const HANDOFF_RECORDINGS_DIR = path.join(__dirname, 'handoff-recordings');
const PAUSE_BEFORE_NEW_TEST = path.join(__dirname, 'PAUSE_BEFORE_NEW_TEST');
const PAUSE_AFTER_BLOCK_LEGACY = path.join(__dirname, 'PAUSE_AFTER_BLOCK');

function shouldPauseBeforeNewTest() {
  return fs.existsSync(PAUSE_BEFORE_NEW_TEST) || fs.existsSync(PAUSE_AFTER_BLOCK_LEGACY);
}

function loadHandoffProfile() {
  if (!fs.existsSync(HANDOFF_RECORDINGS_DIR)) return null;
  const files = fs
    .readdirSync(HANDOFF_RECORDINGS_DIR)
    .filter((f) => f.match(/^handoff-block\d+-to-\d+\.json$/) && !f.includes('incomplete'))
    .sort();
  const good = [];
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(HANDOFF_RECORDINGS_DIR, f), 'utf8'));
      const seq = (j.clickSequence || []).join(' ').toLowerCase();
      if (seq.includes('end block') && seq.includes('begin test')) good.push(j);
    } catch {
      /* skip */
    }
  }
  if (!good.length) return null;
  const pick = good[good.length - 1];
  return {
    source: pick.fromBlock + '→' + pick.toBlock,
    clickSequence: pick.clickSequence,
    medianGapMs: median(pick.stepGapsMs?.filter((n) => n > 100 && n < 60000) || [2000]),
  };
}

function median(nums) {
  if (!nums.length) return 2000;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function readPageSnapshot(page) {
  return page
    .evaluate(() => {
      const roots = [
        document.getElementById('modal-root'),
        ...document.querySelectorAll('[role="dialog"], [class*="modal" i], [class*="testPopup" i], [class*="popup" i]'),
      ].filter(Boolean);
      let modalText = '';
      for (const modal of roots) {
        const t = modal.innerText.replace(/\s+/g, ' ').trim();
        if (t.length > modalText.length) modalText = t;
      }
      const confirmVisible = [...document.querySelectorAll('button, [role="button"]')].some((btn) => {
        const t = (btn.innerText || btn.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
        return /^Confirm$/i.test(t) && btn.getBoundingClientRect().width > 2;
      });
      const num = document.querySelector('.item-block')?.innerText?.trim() || '';
      const m = num.match(/^(\d+)\s*\/\s*(\d+)/);
      return {
        pathname: location.pathname,
        questionNumber: num,
        questionIndex: m ? parseInt(m[1], 10) : null,
        questionId: document.querySelector('.item-info span')?.innerText?.trim() || '',
        modalOpen: modalText.length > 0 || confirmVisible,
        modalSnippet: modalText.slice(0, 100),
        hasNext: !!document.querySelector('.next-button'),
        inTest: !!document.querySelector('#test'),
      };
    })
    .catch(() => ({}));
}

const DEFAULT_ATTEMPT_NAME = 'auto';

async function fillModalAttemptName(page, name = DEFAULT_ATTEMPT_NAME) {
  const filled = await page.evaluate((attemptName) => {
    const modal =
      document.getElementById('modal-root') ||
      document.querySelector('[role="dialog"], [class*="modal" i]');
    if (!modal) return false;
    const text = (modal.innerText || '').replace(/\s+/g, ' ');
    if (!/pause block|attempt name|pause your test|name this attempt/i.test(text)) return false;

    for (const inp of modal.querySelectorAll('input, textarea')) {
      if (inp.type === 'hidden' || inp.type === 'checkbox' || inp.type === 'radio') continue;
      const r = inp.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      inp.focus();
      inp.value = attemptName;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }, name);

  if (filled) console.log(`  [auto] filled Attempt Name: "${name}"`);
  return filled;
}

async function clickButton(page, patterns, { scope = 'page', timeoutMs = 20000, label, exclude = [] } = {}) {
  const sources = patterns.map((p) => (p instanceof RegExp ? p.source : String(p)));
  const excludeSources = exclude.map((p) => (p instanceof RegExp ? p.source : String(p)));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const picked = await page.evaluate(
      ({ sources, excludeSources, scope }) => {
        const pats = sources.map((s) => new RegExp(s, 'i'));
        const excl = excludeSources.map((s) => new RegExp(s, 'i'));
        const modalRoots = [
          document.getElementById('modal-root'),
          ...document.querySelectorAll('[role="dialog"], [class*="modal" i], [class*="testPopup" i], [class*="popup" i]'),
        ].filter(Boolean);
        const root =
          scope === 'modal'
            ? modalRoots.length
              ? modalRoots
              : [document.body]
            : [document.body];
        for (const scopeRoot of root) {
          for (const btn of scopeRoot.querySelectorAll('button, [role="button"], a')) {
            const t = (btn.innerText || btn.getAttribute('title') || btn.getAttribute('aria-label') || '')
              .replace(/\s+/g, ' ')
              .trim();
            if (!t || t.length > 200) continue;
            if (excl.some((p) => p.test(t))) continue;
            if (!pats.some((p) => p.test(t))) continue;
            const r = btn.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            btn.click();
            return t;
          }
        }
        return null;
      },
      { sources, excludeSources, scope }
    );
    if (picked) {
      console.log(`  [auto] ${label || 'click'}: ${picked.slice(0, 80)}`);
      return picked;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function waitForPath(page, pattern, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snap = await readPageSnapshot(page);
    if (pattern.test(snap.pathname || '')) return snap;
    await page.waitForTimeout(300);
  }
  return null;
}

async function waitForModal(page, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snap = await readPageSnapshot(page);
    if (snap.modalOpen) return snap;
    await page.waitForTimeout(200);
  }
  return null;
}

async function waitForQ1(page, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snap = await readPageSnapshot(page);
    // Accept 1/N (not only 1/50) — last unused pack may be smaller
    if (snap.questionIndex === 1 && snap.hasNext && snap.inTest) return snap;
    await page.waitForTimeout(400);
  }
  return null;
}

async function stepEndBlock(page) {
  const snap = await readPageSnapshot(page);
  if (!snap.inTest && !snap.hasNext) {
    console.log('  [auto] skip End Block — not in active test');
    return true;
  }
  const endReviewVisible = await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const t = (btn.innerText || btn.getAttribute('title') || '').trim();
      if (/end review/i.test(t)) return true;
    }
    return false;
  });
  if (endReviewVisible) {
    console.log('  [auto] skip End Block — already on review screen');
    return true;
  }

  const picked = await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button, [role="button"], a')) {
      const label = (btn.getAttribute('title') || btn.innerText || btn.textContent || '')
        .replace(/\s+/g, ' ')
        .trim();
      const src = btn.querySelector('img')?.src || '';
      const r = btn.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (/suspend|pause|resume/i.test(label)) continue;
      const isStopIcon = /stop-icon/i.test(src);
      const isEndBlock = /^End Block$/i.test(label);
      if (isStopIcon || isEndBlock) {
        btn.click();
        return label || (isStopIcon ? 'End Block (stop-icon)' : 'End Block');
      }
    }
    return null;
  });
  if (picked) {
    console.log(`  [auto] End Block: ${picked.slice(0, 80)}`);
    return true;
  }
  return false;
}

async function isPauseBlockModal(page) {
  const snap = await readPageSnapshot(page);
  return /pause block|attempt name|pause your test|name this attempt/i.test(snap.modalSnippet || '');
}

async function hasConfirmButton(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('button, [role="button"]')].some((btn) => {
      const t = (btn.innerText || '').replace(/\s+/g, ' ').trim();
      return /^Confirm$/i.test(t) && btn.getBoundingClientRect().width > 2;
    })
  );
}

async function dismissTestOverlays(page) {
  // Escape closes labs/calculator/settings without toggling them open.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
  }

  // Close Labs if SI panel text is visible — click Lab Values tool to toggle OFF.
  const labsStillOpen = await page.evaluate(() =>
    /SI Reference Intervals|Alanine aminotransferase/i.test((document.body?.innerText || '').replace(/\s+/g, ' '))
  );
  if (labsStillOpen) {
    await page.locator('button.tools-button', { hasText: /^Lab Values$/i }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape').catch(() => {});
  }

  // Close Settings if theme panel visible
  const settingsOpen = await page.evaluate(() => /Lavender|Content Width/i.test(document.body?.innerText || ''));
  if (settingsOpen) {
    await page.locator('button.tools-button', { hasText: /^Settings$/i }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape').catch(() => {});
  }

  await page.waitForTimeout(200);
}

async function clickTestPopupConfirm(page) {
  // Mouse click at Confirm button center — force DOM clicks often miss React handlers here.
  const box = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll(
        'button.testPopupPrimaryButton, button.testPopupFooterButton, [class*="testPopup" i] button'
      ),
    ];
    for (const btn of candidates) {
      const t = (btn.innerText || '').replace(/\s+/g, ' ').trim();
      if (!/^Confirm$/i.test(t)) continue;
      const r = btn.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    for (const btn of document.querySelectorAll('button')) {
      const t = (btn.innerText || '').replace(/\s+/g, ' ').trim();
      if (!/^Confirm$/i.test(t)) continue;
      const r = btn.getBoundingClientRect();
      if (r.width >= 40 && r.height >= 20) {
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    return null;
  });

  if (box) {
    await page.mouse.click(box.x, box.y);
    console.log(`  [auto] Confirm (mouse @ ${Math.round(box.x)},${Math.round(box.y)})`);
    await page.waitForTimeout(500);
    return true;
  }

  try {
    const btn = page
      .locator('button.testPopupPrimaryButton, button.testPopupFooterButton')
      .filter({ hasText: /^Confirm$/i })
      .first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click({ force: true, timeout: 5000 });
      console.log('  [auto] Confirm (testPopup force)');
      return true;
    }
  } catch {
    /* fall through */
  }

  try {
    const roleBtn = page.getByRole('button', { name: /^Confirm$/i }).first();
    if (await roleBtn.isVisible({ timeout: 800 }).catch(() => false)) {
      await roleBtn.click({ force: true, timeout: 5000 });
      console.log('  [auto] Confirm (role force)');
      return true;
    }
  } catch {
    /* fall through */
  }

  return false;
}

async function endBlockModalOpen(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
    return /end block\?|submit your answers for this test/i.test(text);
  });
}

async function stepConfirm(page, maxClicks = 8) {
  let clicked = 0;
  for (let i = 0; i < maxClicks; i++) {
    // Leave test? Confirm already worked.
    const snap = await readPageSnapshot(page);
    if (!snap.inTest || /completetests|createtest/i.test(snap.pathname || '')) {
      console.log('  [auto] Confirm done — left test page');
      return true;
    }
    const endReview = await page.evaluate(() =>
      [...document.querySelectorAll('button, [role="button"]')].some((b) =>
        /end review/i.test((b.innerText || '').trim())
      )
    );
    if (endReview) {
      console.log('  [auto] Confirm done — End Review visible');
      return true;
    }

    await dismissTestOverlays(page);
    await page.waitForTimeout(400);

    const confirmBtn = await hasConfirmButton(page);
    const endBlockOpen = await endBlockModalOpen(page);
    if (!confirmBtn && !endBlockOpen) {
      // Modal may have closed; wait briefly for navigation
      await page.waitForTimeout(1500);
      const after = await readPageSnapshot(page);
      if (!after.inTest || /completetests|createtest/i.test(after.pathname || '')) return true;
      break;
    }

    if (await isPauseBlockModal(page)) {
      console.warn('  [auto] Pause Block modal — wrong button (Suspend). Cancelling.');
      await clickButton(page, [/^Cancel$/i, /^Close$/i, /^No$/i], {
        scope: 'modal',
        label: 'Cancel Pause',
        timeoutMs: 5000,
      });
      return false;
    }

    const ok = await clickTestPopupConfirm(page);
    if (!ok) break;
    clicked += 1;
    await page.waitForTimeout(1200);
  }

  // Final check: did we leave the End Block modal / test?
  for (let w = 0; w < 15; w++) {
    const snap = await readPageSnapshot(page);
    if (!snap.inTest || /completetests|createtest/i.test(snap.pathname || '')) return true;
    if (!(await endBlockModalOpen(page))) {
      const hasEndReview = await page.evaluate(() =>
        [...document.querySelectorAll('button')].some((b) => /end review/i.test((b.innerText || '').trim()))
      );
      if (hasEndReview) return true;
    }
    await page.waitForTimeout(400);
  }
  return clicked > 0 && !(await endBlockModalOpen(page));
}

async function stepEndReview(page) {
  const picked = await clickButton(page, [/^End Review$/i, /end review/i], {
    label: 'End Review',
    timeoutMs: 15000,
  });
  if (picked) {
    await waitForPath(page, /completetests|createtest|dashboard/i, 20000);
    return true;
  }
  const snap = await readPageSnapshot(page);
  if (/completetests|createtest|dashboard/i.test(snap.pathname || '')) {
    console.log('  [auto] skip End Review — already on', snap.pathname);
    return true;
  }
  return false;
}

async function stepCreateTest(page) {
  const picked = await clickButton(
    page,
    [/^Create Test$/i, /create test/i, /create block/i, /new block/i, /start block/i],
    { label: 'Create Test', timeoutMs: 20000 }
  );
  if (picked) {
    await page.waitForTimeout(800);
    await waitForPath(page, /createtest|test/i, 15000).catch(() => null);
    return true;
  }
  return /createtest/i.test((await readPageSnapshot(page)).pathname || '');
}

async function setQuestionCount(page, count) {
  try {
    // Prefer Playwright fill so React controlled input updates
    const input = page.locator('input').filter({ hasText: /^$/ }).first();
    const candidates = page.locator('input[type="number"], input[type="text"]');
    const n = await candidates.count();
    for (let i = 0; i < n; i++) {
      const el = candidates.nth(i);
      const val = await el.inputValue().catch(() => '');
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;
      if (val === '50' || val === String(count) || /^\d+$/.test(val)) {
        await el.click({ clickCount: 3 });
        await el.fill(String(count));
        await el.press('Tab');
        console.log(`  [auto] set question count → ${count}`);
        return true;
      }
    }
  } catch {
    /* fall through */
  }

  const ok = await page.evaluate((n) => {
    const inputs = [...document.querySelectorAll('input')];
    for (const inp of inputs) {
      const r = inp.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (inp.type === 'hidden' || inp.type === 'checkbox' || inp.type === 'radio') continue;
      const nearby = (inp.parentElement?.innerText || inp.previousElementSibling?.innerText || '').slice(0, 200);
      if (!/question|maximum|50/i.test(nearby + (inp.value || ''))) continue;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(inp, String(n));
      else inp.value = String(n);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      return inp.value === String(n);
    }
    return false;
  }, count);
  if (ok) console.log(`  [auto] set question count → ${count} (DOM)`);
  return ok;
}

async function readUnusedCount(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ');
    const m = text.match(/Unused\s*\((\d+)\)/i);
    return m ? parseInt(m[1], 10) : null;
  });
}

async function stepBeginTest(page) {
  if (/createtest/i.test((await readPageSnapshot(page)).pathname || '')) {
    const unused = await readUnusedCount(page);
    if (unused != null && unused > 0 && unused < 50) {
      await setQuestionCount(page, unused);
      await page.waitForTimeout(600);
      // Verify + retry if still showing "not enough questions"
      const stillShort = await page.evaluate(() =>
        /do not have enough questions/i.test(document.body?.innerText || '')
      );
      if (stillShort) {
        await setQuestionCount(page, unused);
        await page.waitForTimeout(400);
      }
    } else if (unused === 0) {
      console.warn('  [auto] Unused=0 — no new unused questions left');
      return false;
    }
  }

  let picked = await clickButton(page, [/^Begin Test$/i, /^Start Test$/i, /begin test/i, /start test/i], {
    label: 'Begin Test',
    timeoutMs: 10000,
  });
  if (!picked) {
    await clickButton(page, [/practice mode/i], { label: 'Practice Mode (optional)', timeoutMs: 4000 });
    await page.waitForTimeout(500);
    const unused = await readUnusedCount(page);
    if (unused != null && unused > 0 && unused < 50) await setQuestionCount(page, unused);
    picked = await clickButton(page, [/^Begin Test$/i, /^Start Test$/i, /begin test/i], {
      label: 'Begin Test',
      timeoutMs: 15000,
    });
  }
  return !!picked;
}

/**
 * Run full auto handoff. Returns { ok, snap } with Q1 snapshot on success.
 */
async function runAutoHandoff(page, options = {}) {
  const profile = loadHandoffProfile();
  console.log('\n=== AUTO HANDOFF (recorded flow) ===');
  if (profile) {
    console.log(`  Profile: block ${profile.source}  median gap ${profile.medianGapMs}ms`);
    console.log(`  Target: ${profile.clickSequence.filter((s) => !s.includes('Close')).join(' → ')}`);
  }

  if (options.hidePopup) await options.hidePopup(page);
  await dismissTestOverlays(page);

  const steps = [
    ['End Block', stepEndBlock],
    ['Confirm', stepConfirm],
    ['End Review', stepEndReview],
    ['Create Test', stepCreateTest],
    ['Begin Test', stepBeginTest],
  ];

  for (const [name, fn] of steps) {
    if (name === 'Create Test') {
      const snap = await readPageSnapshot(page);
      if (/createtest/i.test(snap.pathname || '')) {
        await captureAndLogPoolStats(page, {
          event: 'before_create_test',
          block: options.blockNum ?? null,
          paused: shouldPauseBeforeNewTest(),
        });
      }
    }

    if (name === 'Create Test' && shouldPauseBeforeNewTest()) {
      const snap = await readPageSnapshot(page);
      await captureRoadblock(page, 'pause_before_new_test', 'User inspection before Create Test');
      console.log('\n⏸ PAUSED before Create Test — inspect the screen now (e.g. questions remaining).');
      console.log('   Browser stays open. Delete PAUSE_BEFORE_NEW_TEST (or PAUSE_AFTER_BLOCK) when done.');
      console.log(`   URL: ${snap.pathname || '/'}  — click Create Test yourself, or restart scraper.\n`);
      return { ok: false, paused: true, snap };
    }

    const ok = await fn(page);
    if (!ok && name !== 'End Block') {
      console.warn(`  [auto] step failed or skipped: ${name}`);
      if (options.onRoadblock) {
        await options.onRoadblock(page, `handoff_step_${name}`);
      } else {
        await captureRoadblock(page, `handoff_step_${name}`, `step ${name} failed`);
      }
    }
    await page.waitForTimeout(profile?.medianGapMs ? Math.min(profile.medianGapMs, 3000) : 800);
  }

  let q1 = await waitForQ1(page, options.q1TimeoutMs || 90000);
  if (!q1) {
    console.warn('  [auto] Q1/50 not reached — attempting recovery');
    await captureRoadblock(page, 'handoff_no_q1', 'Q1 not reached after steps');
    await ensureLoggedIn(page);
    const rec = await recoverFromRoadblock(page, 'handoff_no_q1');
    if (rec.ok) q1 = await waitForQ1(page, 30000);
  }
  if (!q1) {
    console.warn('  [auto] Q1/50 not reached');
    await captureRoadblock(page, 'handoff_failed', 'final failure');
    return { ok: false, snap: await readPageSnapshot(page) };
  }

  console.log(`  [auto] Q1 ready — ${q1.questionNumber} ID ${q1.questionId}`);
  return { ok: true, snap: q1 };
}

module.exports = {
  runAutoHandoff,
  loadHandoffProfile,
  readPageSnapshot,
  HANDOFF_RECORDINGS_DIR,
  shouldPauseBeforeNewTest,
};
