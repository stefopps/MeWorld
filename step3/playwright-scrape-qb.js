#!/usr/bin/env node
/**
 * Playwright scraper for qb.ccscases.com — captures text from DOM + images from
 * network responses ONCE (no in-page fetch hooks, no resp.clone doubling).
 *
 * Setup (once):
 *   cd C:\Users\steve\MeWorld\step3
 *   npm install
 *   npx playwright install chromium
 *
 * Usage:
 *   node playwright-scrape-qb.js
 *   node playwright-scrape-qb.js --count 50 --minutes 9 --auto-start
 *   node playwright-scrape-qb.js --loop --handoff --record-clicks --auto-start --start-block 8
 *   node playwright-scrape-qb.js --loop --auto-next --auto-start --start-block 8
 *
 * Loop mode rejects duplicate blocks (same 50-pack). Use --allow-duplicate to override.
 *
 * First run: browser opens → log in → open a 50-Q block → press Enter in this terminal.
 * Later runs: reuses qb_browser_profile/ session folder.
 *
 * Extract PNGs afterward:
 *   node extract-scrape-images.js scrape-playwright-output.json
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { runAutoHandoff, loadHandoffProfile } = require('./handoff-auto.js');
const { ensureLoggedIn, captureRoadblock } = require('./roadblock-helper.js');

const VERSION = '2026-07-11-playwright-v7';
const DEFAULT_HANDOFF_GRACE_MS = 90000;
const HANDOFF_RECORDINGS_DIR = path.join(__dirname, 'handoff-recordings');
const QB_URL = 'https://qb.ccscases.com/';
const PROFILE_DIR = path.join(__dirname, 'qb_browser_profile');
const MEDIA_RE = /get(?:Question|multipleanswer)Media\.webapi/i;

function parseArgs(argv) {
  const args = {
    count: 50,
    minutes: 9,
    output: 'scrape-playwright-output.json',
    headless: false,
    loginOnly: false,
    autoStart: false,
    blocks: 1,
    loop: false,
    handoff: false,
    autoNext: false,
    recordClicks: undefined,
    startBlock: 1,
    keepOpen: true,
    allowDuplicate: false,
    duplicateThreshold: 3,
    handoffGraceMs: DEFAULT_HANDOFF_GRACE_MS,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--count') args.count = Number(argv[++i]);
    else if (a === '--minutes') args.minutes = Number(argv[++i]);
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--blocks') args.blocks = Number(argv[++i]);
    else if (a === '--start-block') args.startBlock = Number(argv[++i]);
    else if (a === '--headless') args.headless = true;
    else if (a === '--login-only') args.loginOnly = true;
    else if (a === '--auto-start') args.autoStart = true;
    else if (a === '--loop') args.loop = true;
    else if (a === '--handoff') args.handoff = true;
    else if (a === '--auto-next') args.autoNext = true;
    else if (a === '--record-clicks') args.recordClicks = true;
    else if (a === '--no-record-clicks') args.recordClicks = false;
    else if (a === '--keep-open') args.keepOpen = true;
    else if (a === '--close') args.keepOpen = false;
    else if (a === '--allow-duplicate') args.allowDuplicate = true;
    else if (a === '--duplicate-threshold') args.duplicateThreshold = Number(argv[++i]);
    else if (a === '--handoff-grace-ms') args.handoffGraceMs = Number(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  if (args.loop && !args.handoff && !args.autoNext) args.handoff = true;
  if (args.loop && args.recordClicks === undefined) args.recordClicks = true;
  return args;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatElapsed(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function computeBudget(count, minutes) {
  const totalMs = minutes * 60 * 1000;
  const perQ = Math.floor(totalMs / Math.max(1, count));
  const burstMs = Math.max(1500, Math.min(Math.floor(perQ * 0.45), perQ - 1200));
  const paceMs = Math.max(500, perQ - burstMs - 900);
  return { count, minutes, burstMs, paceMs, perQ };
}

function parseQuestionIdFromUrl(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('question_id') || u.searchParams.get('questionId') || null;
  } catch {
    return null;
  }
}

function normId(raw) {
  const m = String(raw || '').trim().match(/(\d{1,8})/);
  return m ? m[1] : String(raw || '').trim();
}

function questionIdsFromPages(pages) {
  const ids = new Set();
  for (const p of pages || []) {
    const id = normId(p.questionId);
    if (id) ids.add(id);
  }
  return ids;
}

function questionIdsFromJsonFile(jsonPath) {
  if (!jsonPath || !fs.existsSync(jsonPath)) return new Set();
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return questionIdsFromPages(raw.pages);
  } catch {
    return new Set();
  }
}

function blockJsonPath(blockNum) {
  const name =
    blockNum === 1 ? 'scrape-playwright-output.json' : `scrape-playwright-block${blockNum}.json`;
  const bank = path.join(__dirname, 'scrape-bank', 'raw', name);
  if (fs.existsSync(bank)) return bank;
  return path.join(__dirname, name);
}

function overlapStats(setA, setB) {
  let overlap = 0;
  for (const id of setA) if (setB.has(id)) overlap += 1;
  const denom = Math.max(setA.size, setB.size, 1);
  return { overlap, pct: Math.round((100 * overlap) / denom) };
}

function isDuplicateBlock(currentIds, previousIds, threshold) {
  if (!previousIds?.size || !currentIds?.size) return { duplicate: false, overlap: 0, pct: 0 };
  const { overlap, pct } = overlapStats(currentIds, previousIds);
  const minSize = Math.min(currentIds.size, previousIds.size);
  const hitThreshold = overlap >= threshold || (minSize >= 5 && overlap >= minSize - 1);
  return { duplicate: hitThreshold, overlap, pct };
}

function bodyToDataUrl(body, contentType) {
  const mt = String(contentType || 'image/png').split(';')[0].trim();
  return `data:${mt};base64,${body.toString('base64')}`;
}

async function installHandoffBridge(page) {
  if (page.__handoffBridgeOn) return;
  page.__handoffBridgeOn = true;
  page.__handoffGraceUntil = 0;
  await page.exposeFunction('__ccsPopupClosedHandoff', () => {
    page.__handoffGraceUntil = Date.now() + (page.__handoffGraceMs || DEFAULT_HANDOFF_GRACE_MS);
  });
}

async function waitForHandoffGrace(page, graceMs) {
  await installHandoffBridge(page);
  page.__handoffGraceMs = graceMs;

  const popupVisible = await page
    .evaluate((id) => {
      const el = document.getElementById(id);
      return !!(el && el.style.display !== 'none');
    }, FRESH_BATCH_POPUP_ID)
    .catch(() => false);

  if (popupVisible) {
    console.log('\nClose the popup when ready — then you get time to create the new batch.');
    if (page.__handoffSession) {
      await logHandoffSystem(page, 'popup_waiting', 'Waiting for popup close');
    }
    const t0 = Date.now();
    while (Date.now() - t0 < 900000) {
      const still = await page
        .evaluate((id) => {
          const el = document.getElementById(id);
          return !!(el && el.style.display !== 'none');
        }, FRESH_BATCH_POPUP_ID)
        .catch(() => false);
      if (!still) break;
      await page.waitForTimeout(400);
    }
    if (!page.__handoffGraceUntil) {
      page.__handoffGraceUntil = Date.now() + graceMs;
    }
    if (page.__handoffSession) {
      await logHandoffSystem(page, 'popup_closed', 'Popup closed — handoff grace starting');
    }
  }

  const remaining = (page.__handoffGraceUntil || 0) - Date.now();
  if (remaining > 0) {
    console.log(
      `Handoff pause — ${Math.ceil(remaining / 1000)}s to End Block → Create Test → Begin Test (Q1/50)…`
    );
    if (page.__handoffSession) {
      await logHandoffSystem(page, 'grace_start', `Grace period ${Math.ceil(remaining / 1000)}s`);
    }
    await page.waitForTimeout(remaining);
    if (page.__handoffSession) {
      await logHandoffSystem(page, 'grace_end', 'Grace period ended — watching for Q1/50');
    }
  }
  page.__handoffGraceUntil = 0;
}

async function readQuestionPosition(page) {
  return page.evaluate(() => {
    const num = document.querySelector('.item-block')?.innerText?.trim() || '';
    const m = num.match(/^(\d+)\s*\/\s*(\d+)/);
    if (!m) return { raw: num, index: null, total: null };
    return { raw: num, index: parseInt(m[1], 10), total: parseInt(m[2], 10) };
  });
}

async function waitForNextButtonReady(page, timeoutMs = 900000, options = {}) {
  const requireQ1 = options.requireQ1 !== false;
  console.log(
    requireQ1
      ? '\nWaiting for Q1 — Next button on question 1 (no Enter needed)…'
      : '\nWaiting for Next button on screen (no Enter needed)…'
  );
  console.log('Finish Create Test in the browser; scrape starts automatically.\n');
  const t0 = Date.now();
  let lastLog = 0;
  while (Date.now() - t0 < timeoutMs) {
    const nextVisible = await page.locator('.next-button').isVisible().catch(() => false);
    if (nextVisible) {
      const pos = await readQuestionPosition(page);
      if (requireQ1 && pos.index !== 1) {
        if (Date.now() - lastLog > 15000) {
          console.log(`  Next visible but on ${pos.raw || '?'} — need Q1 for a fresh batch`);
          lastLog = Date.now();
        }
        await page.waitForTimeout(1200);
        continue;
      }
      console.log(`Ready — ${pos.raw || 'question page detected'}`);
      await page.waitForTimeout(800);
      return true;
    }
    const elapsed = Date.now() - t0;
    if (elapsed - lastLog > 15000) {
      console.log(`  still waiting… ${formatElapsed(elapsed)}`);
      lastLog = elapsed;
    }
    await page.waitForTimeout(1200);
  }
  console.error(requireQ1 ? 'Timed out waiting for Q1/50' : 'Timed out waiting for Next button');
  return false;
}

/** Runs inside the browser page — keep in sync with click-nav-console extractors. */
function extractPageInBrowser() {
  function extractAnswers() {
    return [...document.querySelectorAll('.answers .questionDiv')].map((div, idx) => {
      const letter =
        div.querySelector('.optionLetterSpan')?.innerText?.trim() ||
        String.fromCharCode(65 + idx) + '.';
      const optionSpan = div.querySelector('.optionSpan');
      let text = '';
      if (optionSpan) text = optionSpan.innerText.replace(letter, '').trim();
      const style = window.getComputedStyle(div);
      const className = div.className || '';
      const html = div.innerHTML;
      return {
        letter,
        text,
        hasImage: !!div.querySelector('img'),
        selected: !!div.querySelector('input[type="radio"]:checked'),
        flagged: !!div.querySelector('input[type="checkbox"]:checked'),
        struck: /strike|line-through/i.test(className + style.textDecoration),
        likelyCorrect: /correct|right|green|success|true/i.test(className + html),
        likelyIncorrect: /wrong|incorrect|red|false/i.test(className + html),
        votePercent:
          div.querySelector('[class*="percent"], [class*="vote"], [class*="choice"]')?.innerText?.trim() ||
          null,
      };
    });
  }

  function extractExplanation() {
    for (const sel of [
      '.explanation',
      '[class*="explanation" i]',
      '.answer-explanation',
      '.explanation-container',
    ]) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 10) return el.innerText.trim();
    }
    const extras = [...document.querySelectorAll('.testWrapper > *')].filter(
      (el) =>
        !el.matches('#testQuestion, .answers, .button-container-light, .button-container') &&
        el.innerText.trim().length > 15
    );
    return extras.length ? extras.map((el) => el.innerText.trim()).join('\n\n') : '';
  }

  const header = document.querySelector('.test-header') || document;
  const questionId =
    header.querySelector('.item-info span')?.innerText?.trim() ||
    document.querySelector('.item-info span')?.innerText?.trim() ||
    '';
  const questionNumber = header.querySelector('.item-block')?.innerText?.trim() || '';
  const question =
    document.querySelector('#testQuestion')?.innerText?.trim() ||
    document.querySelector('.question')?.innerText?.trim() ||
    '';
  const answers = extractAnswers();
  const explanation = extractExplanation();

  const alts = new Set(
    [...document.querySelectorAll('img[alt]')].map((i) => (i.alt || '').trim().toLowerCase())
  );
  const hasMedicalViewer = alts.has('invert') && alts.has('contrast') && alts.has('zoom');

  const hasReveal =
    explanation.length > 20 ||
    answers.some((a) => a.likelyCorrect || a.votePercent);

  return {
    capturedAt: new Date().toISOString(),
    questionId,
    questionNumber,
    question,
    answers,
    explanation,
    likelyCorrectAnswer: answers.find((a) => a.likelyCorrect)?.letter || null,
    hasReveal,
    hasMedicalViewer,
    hasSelection: answers.some((a) => a.selected),
    hasCheckmarks: answers.some((a) => a.likelyCorrect || a.struck || a.votePercent),
  };
}

async function getPageData(page) {
  return page.evaluate(extractPageInBrowser);
}

async function getQ1Snapshot(page) {
  const data = await getPageData(page);
  return {
    questionId: normId(data.questionId),
    questionNumber: data.questionNumber || '',
    questionPreview: String(data.question || '').replace(/\s+/g, ' ').trim().slice(0, 80),
  };
}

const FRESH_BATCH_POPUP_ID = 'ccs-scraper-fresh-batch-popup';

async function showFreshBatchPopup(page, { title, reason, detail, variant = 'duplicate' } = {}) {
  await installHandoffBridge(page);

  const payload = {
    title: title || 'CREATE A FRESH BATCH',
    reason: reason || 'Same question block detected — do not re-scrape this pack.',
    detail: detail || '',
    variant,
  };

  await page
    .evaluate(({ id, data }) => {
      if (!document.getElementById('ccs-scraper-fresh-batch-styles')) {
        const style = document.createElement('style');
        style.id = 'ccs-scraper-fresh-batch-styles';
        style.textContent = `
          #${id} { position: fixed; inset: 0; z-index: 2147483646; display: flex; align-items: center; justify-content: center; font-family: system-ui, Segoe UI, sans-serif; }
          #${id} .ccs-popup-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); backdrop-filter: blur(2px); }
          #${id} .ccs-popup-card {
            position: relative; max-width: 520px; width: calc(100% - 32px); margin: 16px;
            border-radius: 14px; padding: 24px 28px; box-shadow: 0 20px 60px rgba(0,0,0,.45);
            animation: ccsPopIn .35s ease;
          }
          #${id}.handoff .ccs-popup-card { background: linear-gradient(145deg, #1e3a5f, #0f2744); color: #fff; border: 2px solid #4da3ff; }
          #${id}.duplicate .ccs-popup-card { background: linear-gradient(145deg, #5c1a1a, #3d0f0f); color: #fff; border: 2px solid #ff6b6b; }
          #${id} h2 { margin: 0 0 12px; font-size: 22px; letter-spacing: .02em; }
          #${id} .ccs-popup-reason { margin: 0 0 8px; font-size: 15px; line-height: 1.45; opacity: .95; }
          #${id} .ccs-popup-detail { margin: 0 0 14px; font-size: 13px; opacity: .85; font-family: Consolas, monospace; }
          #${id} ol { margin: 0 0 14px 20px; padding: 0; line-height: 1.7; font-size: 15px; }
          #${id} .ccs-popup-note { margin: 0 0 16px; font-size: 13px; opacity: .8; }
          #${id} .ccs-popup-close-x {
            position: absolute; top: 10px; right: 12px; width: 32px; height: 32px;
            border: none; border-radius: 8px; background: rgba(255,255,255,.15); color: #fff;
            font-size: 20px; line-height: 1; cursor: pointer;
          }
          #${id} .ccs-popup-close-x:hover { background: rgba(255,255,255,.28); }
          #${id} .ccs-popup-close-btn {
            display: block; width: 100%; padding: 12px 16px; border: none; border-radius: 10px;
            font-size: 15px; font-weight: 600; cursor: pointer;
          }
          #${id}.handoff .ccs-popup-close-btn { background: #4da3ff; color: #0f2744; }
          #${id}.duplicate .ccs-popup-close-btn { background: #ff6b6b; color: #3d0f0f; }
          #${id} .ccs-popup-close-btn:hover { filter: brightness(1.08); }
          @keyframes ccsPopIn { from { transform: scale(.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        `;
        document.documentElement.appendChild(style);
      }

      let root = document.getElementById(id);
      if (!root) {
        root = document.createElement('div');
        root.id = id;
        root.innerHTML = `
          <div class="ccs-popup-backdrop"></div>
          <div class="ccs-popup-card">
            <button type="button" class="ccs-popup-close-x" title="Close">×</button>
            <h2 class="ccs-popup-title"></h2>
            <p class="ccs-popup-reason"></p>
            <p class="ccs-popup-detail"></p>
            <ol>
              <li>End Block</li>
              <li>Confirm</li>
              <li>End Review</li>
              <li><strong>Create Test</strong> — not Resume!</li>
              <li>Begin Test → Q1</li>
            </ol>
            <p class="ccs-popup-note"></p>
            <button type="button" class="ccs-popup-close-btn">Close — I'll create the next batch</button>
          </div>
        `;
        document.documentElement.appendChild(root);
      }

      if (!root.querySelector('.ccs-popup-close-btn')) {
        const card = root.querySelector('.ccs-popup-card');
        if (card) {
          const x = document.createElement('button');
          x.type = 'button';
          x.className = 'ccs-popup-close-x';
          x.title = 'Close';
          x.textContent = '×';
          card.prepend(x);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ccs-popup-close-btn';
          btn.textContent = "Close — I'll create the next batch";
          card.appendChild(btn);
        }
      }
      const hide = () => {
        root.style.display = 'none';
        if (typeof __ccsPopupClosedHandoff === 'function') __ccsPopupClosedHandoff();
      };
      for (const sel of ['.ccs-popup-close-x', '.ccs-popup-close-btn', '.ccs-popup-backdrop']) {
        const el = root.querySelector(sel);
        if (el && !el.dataset.ccsCloseBound) {
          el.addEventListener('click', hide);
          el.dataset.ccsCloseBound = '1';
        }
      }

      root.className = data.variant;
      root.querySelector('.ccs-popup-title').textContent = data.title;
      root.querySelector('.ccs-popup-reason').textContent = data.reason;
      root.querySelector('.ccs-popup-detail').textContent = data.detail;
      root.querySelector('.ccs-popup-note').textContent =
        data.variant === 'handoff'
          ? 'Close this popup — scraper waits 90s, then watches for Q1/50 on a new test.'
          : 'Close this popup — you get 90s to End Block → Create Test → Begin Test before checks resume.';
      root.style.display = 'flex';
    }, { id: FRESH_BATCH_POPUP_ID, data: payload })
    .catch(() => {});

  try {
    await page.bringToFront();
  } catch {
    /* ignore */
  }

  process.stdout.write('\u0007');
}

async function hideFreshBatchPopup(page) {
  await page
    .evaluate((id) => {
      const root = document.getElementById(id);
      if (root) root.style.display = 'none';
    }, FRESH_BATCH_POPUP_ID)
    .catch(() => {});
}

async function waitForQuestionChange(page, fromQ, timeoutMs = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const cur = await page.evaluate(() => {
      const num = document.querySelector('.item-block')?.innerText?.trim() || '';
      const n = parseInt(num.split('/')[0], 10);
      return Number.isFinite(n) ? n : null;
    });
    if (cur !== null && cur !== fromQ) return cur;
    await page.waitForTimeout(150);
  }
  return page.evaluate(() => {
    const num = document.querySelector('.item-block')?.innerText?.trim() || '';
    const n = parseInt(num.split('/')[0], 10);
    return Number.isFinite(n) ? n : null;
  });
}

function attachMediaCapture(page, mediaByQuestionId, onRateLimit) {
  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (!url.includes('ccscases.com')) return;

      if (response.status() === 429) {
        onRateLimit(url);
        return;
      }

      if (!MEDIA_RE.test(url) || !response.ok()) return;

      const qid = parseQuestionIdFromUrl(url);
      if (!qid) return;

      const body = await response.body();
      if (!body || body.length < 512) return;

      const ct = response.headers()['content-type'] || 'image/png';
      if (!String(ct).startsWith('image/')) return;

      mediaByQuestionId.set(String(qid), {
        questionId: qid,
        url,
        dataUrl: bodyToDataUrl(body, ct),
        mediaType: ct.split(';')[0],
        size: body.length,
        capturedAt: new Date().toISOString(),
        source: 'playwright-response',
      });
    } catch {
      /* page navigated away mid-body read */
    }
  });
}

function pngPayloadsForQuestion(mediaByQuestionId, questionId) {
  const qid = normId(questionId);
  const hit = mediaByQuestionId.get(qid);
  if (!hit) return { pngDataUrls: [], imageCount: 0, hasImages: false };
  return {
    pngDataUrls: [
      {
        mediaType: hit.mediaType,
        dataUrl: hit.dataUrl,
        source: hit.source,
        type: 'network-capture',
      },
    ],
    imageCount: 1,
    hasImages: true,
  };
}

async function scrapeBlock(page, options, mediaByQuestionId, rateLimit) {
  const pos0 = await readQuestionPosition(page);
  const actualCount =
    pos0.total && pos0.total > 0 ? Math.min(options.count || 50, pos0.total) : options.count || 50;
  const budget = computeBudget(actualCount, options.minutes);
  const pages = [];
  const t0 = Date.now();
  const duplicateCheck = options.duplicateCheck || null;

  console.log(`Scraping ${budget.count} questions in ~${budget.minutes} min`);
  console.log(`  burst=${budget.burstMs}ms  pace=${budget.paceMs}ms (+ jitter)`);
  console.log('Images: captured from network only — no extra API calls\n');

  const start = await getPageData(page);
  pages.push({ step: 0, action: 'start', ...start, ...pngPayloadsForQuestion(mediaByQuestionId, start.questionId) });

  for (let i = 1; i <= budget.count; i++) {
    if (rateLimit.aborted) {
      console.warn('Stopped — rate limit threshold hit');
      break;
    }

    const paceJitter = randInt(0, Math.min(2500, Math.floor(budget.paceMs * 0.3)));
    await page.waitForTimeout(budget.paceMs + paceJitter);

    const nextBtn = page.locator('.next-button');
    if (!(await nextBtn.isVisible().catch(() => false))) {
      console.error('Next button not found — are you on a question block?');
      break;
    }

    const before = await getPageData(page);
    const fromQ = parseInt(String(before.questionNumber).split('/')[0], 10);
    const beforeMedia = pngPayloadsForQuestion(mediaByQuestionId, before.questionId);

    await nextBtn.click();
    process.stdout.write(`Q${i}/${budget.count} Next… `);

    let reveal = null;
    const burstEnd = Date.now() + budget.burstMs;
    while (Date.now() < burstEnd) {
      const snap = await getPageData(page);
      if (snap.hasReveal) {
        reveal = snap;
        break;
      }
      await page.waitForTimeout(120);
    }
    if (!reveal) reveal = await getPageData(page);

    const proceed = page.locator('.button-container-light button');
    if (await proceed.isVisible().catch(() => false)) {
      await proceed.click();
      await page.waitForTimeout(500);
    }

    const afterQ = await waitForQuestionChange(page, Number.isFinite(fromQ) ? fromQ : null);

    const primary = {
      ...before,
      ...beforeMedia,
      explanation: reveal.explanation || before.explanation,
      likelyCorrectAnswer: reveal.likelyCorrectAnswer || before.likelyCorrectAnswer,
      answers: reveal.answers?.some((a) => a.likelyCorrect || a.votePercent) ? reveal.answers : before.answers,
      hasReveal: !!(reveal.hasReveal || before.hasReveal),
    };

    pages.push({
      step: i,
      action: 'click-next',
      status: reveal.hasReveal ? 'ok' : 'missed_reveal',
      revealCaptured: !!reveal.hasReveal,
      advancedTo: afterQ,
      ...primary,
    });

    console.log(`✓ ${before.questionNumber || i} | imgs=${beforeMedia.imageCount} | ${formatElapsed(Date.now() - t0)}`);

    if (duplicateCheck && i >= duplicateCheck.earlyAfter && duplicateCheck.previousIds?.size) {
      const sampleIds = questionIdsFromPages(pages.filter((p) => p.step > 0).slice(0, duplicateCheck.earlyAfter));
      const early = isDuplicateBlock(sampleIds, duplicateCheck.previousIds, duplicateCheck.threshold);
      if (early.duplicate) {
        console.warn(
          `\n⚠ DUPLICATE BLOCK — first ${sampleIds.size} questions match previous block (${early.overlap}/${sampleIds.size}, ${early.pct}%).`
        );
        console.warn('Aborting scrape. End Block → Create Test → Begin Test (do NOT Resume).\n');
        await showFreshBatchPopup(page, {
          variant: 'duplicate',
          title: 'SAME BATCH — CREATE A FRESH ONE',
          reason: `First ${sampleIds.size} questions match the previous block (${early.overlap}/${sampleIds.size} IDs overlap).`,
          detail: 'Scrape aborted so you do not waste time on duplicate questions.',
        });
        return {
          scrapedAt: new Date().toISOString(),
          scraperVersion: VERSION,
          mode: 'playwright-network-capture',
          blockIndex: options.blockIndex ?? 1,
          aborted: true,
          abortReason: 'duplicate_block_early',
          duplicateOverlap: early,
          pages,
          summary: {
            questionsScraped: pages.filter((p) => p.step > 0).length,
            revealsCaptured: pages.filter((p) => p.step > 0 && p.revealCaptured).length,
            totalPngCaptured: pages.reduce((n, p) => n + (p.imageCount || 0), 0),
            elapsedFormatted: formatElapsed(Date.now() - t0),
            targetMinutes: options.minutes,
          },
        };
      }
    }

    if (rateLimit.until > Date.now()) {
      const wait = rateLimit.until - Date.now();
      console.warn(`  429 cooldown ${Math.round(wait / 1000)}s…`);
      await page.waitForTimeout(wait);
    }
  }

  const clicks = pages.filter((p) => p.step > 0);
  const result = {
    scrapedAt: new Date().toISOString(),
    scraperVersion: VERSION,
    mode: 'playwright-network-capture',
    blockIndex: options.blockIndex ?? 1,
    direction: 'next',
    totalClicks: clicks.length,
    pageCount: pages.length,
    pages,
    summary: {
      questionsScraped: clicks.length,
      revealsCaptured: clicks.filter((p) => p.revealCaptured).length,
      totalPngCaptured: clicks.reduce((n, p) => n + (p.imageCount || 0), 0),
      elapsedFormatted: formatElapsed(Date.now() - t0),
      targetMinutes: options.minutes,
    },
  };

  if (duplicateCheck?.previousIds?.size && clicks.length >= 10) {
    const allIds = questionIdsFromPages(clicks);
    const full = isDuplicateBlock(allIds, duplicateCheck.previousIds, duplicateCheck.threshold);
    if (full.duplicate) {
      result.aborted = true;
      result.abortReason = 'duplicate_block_full';
      result.duplicateOverlap = full;
    }
  }

  return result;
}

async function clickSuspendBlock(page) {
  const label = await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const text = (btn.getAttribute('title') || btn.innerText || '').trim();
      const src = btn.querySelector('img')?.src || '';
      if (/suspend block/i.test(text) || /pause-icon/i.test(src)) {
        btn.click();
        return text || 'Suspend Block';
      }
    }
    return null;
  });
  if (label) console.log(`Clicked Suspend Block (${label})`);
  return !!label;
}

async function capturePageState(page) {
  return page
    .evaluate(() => {
      const modal =
        document.getElementById('modal-root') ||
        document.querySelector('[role="dialog"], [class*="modal" i]');
      const modalText = modal ? modal.innerText.replace(/\s+/g, ' ').trim() : '';
      return {
        url: location.href,
        pathname: location.pathname,
        questionNumber: document.querySelector('.item-block')?.innerText?.trim() || '',
        questionId: document.querySelector('.item-info span')?.innerText?.trim() || '',
        modalOpen: !!modal && modalText.length > 0,
        modalSnippet: modalText.slice(0, 160),
        hasNext: !!document.querySelector('.next-button'),
        inTest: !!document.querySelector('#test'),
      };
    })
    .catch(() => ({}));
}

function formatMs(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function startHandoffRecording(page, fromBlock, toBlock) {
  page.__handoffSession = {
    fromBlock,
    toBlock,
    startedAt: new Date().toISOString(),
    t0: Date.now(),
    events: [],
  };
  console.log(`\nHandoff recorder ON — block ${fromBlock} → ${toBlock} (all clicks + timing)`);
}

function pushHandoffEvent(page, event) {
  if (!page.__handoffSession) return;
  const now = Date.now();
  const prev = page.__handoffSession.events[page.__handoffSession.events.length - 1];
  const entry = {
    seq: page.__handoffSession.events.length + 1,
    at: new Date(now).toISOString(),
    sinceStartMs: now - page.__handoffSession.t0,
    sincePreviousMs: prev ? now - prev._ts : 0,
    ...event,
  };
  entry._ts = now;
  page.__handoffSession.events.push(entry);

  const where = event.pageState?.questionNumber || event.pageState?.pathname || '';
  const modal = event.pageState?.modalOpen ? ' [modal]' : '';
  const delta = entry.sincePreviousMs ? ` Δ${formatMs(entry.sincePreviousMs)}` : '';
  console.log(
    `  [handoff +${formatMs(entry.sinceStartMs)}${delta}] ${event.kind || 'click'}: ${event.label || event.action || '?'}${modal}${where ? ` @ ${where}` : ''}`
  );
}

async function logHandoffSystem(page, action, label) {
  const pageState = await capturePageState(page);
  pushHandoffEvent(page, { kind: 'system', action, label, pageState });
}

async function saveHandoffRecording(page, { success, q1, toBlock, note } = {}) {
  const session = page.__handoffSession;
  if (!session?.events?.length) return null;

  const endedAt = new Date().toISOString();
  const clickEvents = session.events.filter((e) => e.kind === 'click');
  const recording = {
    recordedAt: endedAt,
    scraperVersion: VERSION,
    fromBlock: session.fromBlock,
    toBlock: toBlock ?? session.toBlock,
    success: !!success,
    note: note || null,
    startedAt: session.startedAt,
    endedAt,
    totalMs: Date.now() - session.t0,
    q1: q1 || null,
    eventCount: session.events.length,
    clickSequence: clickEvents.map((e) => e.label || e.title || e.tag).filter(Boolean),
    clickTimingsMs: clickEvents.map((e) => e.sinceStartMs),
    stepGapsMs: clickEvents.map((e) => e.sincePreviousMs),
    events: session.events.map(({ _ts, ...rest }) => rest),
  };

  fs.mkdirSync(HANDOFF_RECORDINGS_DIR, { recursive: true });
  const fname = `handoff-block${session.fromBlock}-to-${recording.toBlock}${success ? '' : '-incomplete'}.json`;
  const outPath = path.join(HANDOFF_RECORDINGS_DIR, fname);
  fs.writeFileSync(outPath, JSON.stringify(recording, null, 2));
  console.log(`Handoff recording saved: ${outPath}`);
  console.log(`  Clicks: ${clickEvents.length}  Total time: ${formatMs(recording.totalMs)}`);
  if (recording.clickSequence.length) {
    console.log(`  Sequence: ${recording.clickSequence.join(' → ')}`);
  }

  page.__handoffSession = null;
  return outPath;
}

async function installHandoffRecorder(page) {
  if (page.__handoffRecorderOn) return;
  page.__handoffRecorderOn = true;

  await page.exposeFunction('__logHandoffClick', async (info) => {
    const pageState = await capturePageState(page);
    pushHandoffEvent(page, { kind: 'click', ...info, pageState });
  });

  await page.exposeFunction('__logHandoffSystem', async (info) => {
    const pageState = await capturePageState(page);
    pushHandoffEvent(page, { kind: 'system', ...info, pageState });
  });

  await page.evaluate(() => {
    if (window.__ccsHandoffRecorder) return;
    window.__ccsHandoffRecorder = true;

    function pickLabel(el) {
      return (el.innerText || el.getAttribute('title') || el.getAttribute('aria-label') || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    }

    document.addEventListener(
      'click',
      (e) => {
        const el = e.target.closest(
          'button, [role="button"], a, input[type="submit"], input[type="button"], label'
        );
        if (!el) return;
        const inOurPopup = el.closest('#ccs-scraper-fresh-batch-popup');
        __logHandoffClick({
          tag: el.tagName,
          label: pickLabel(el),
          title: el.getAttribute('title') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          href: el.tagName === 'A' ? el.href : '',
          id: el.id || '',
          className: (el.className || '').toString().slice(0, 80),
          fromPopup: !!inOurPopup,
        });
      },
      true
    );
  });
}

/** @deprecated use installHandoffRecorder */
async function installClickRecorder(page) {
  return installHandoffRecorder(page);
}

async function clickButtonMatching(page, patterns, label = 'button') {
  await page.waitForTimeout(400);
  const regexSources = patterns.map((p) => (p instanceof RegExp ? p.source : String(p)));
  const picked = await page.evaluate((sources) => {
    const pats = sources.map((s) => new RegExp(s, 'i'));
    for (const btn of document.querySelectorAll('button, [role="button"], a')) {
      const t = (btn.innerText || btn.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
      if (pats.some((p) => p.test(t))) {
        btn.click();
        return t;
      }
    }
    return null;
  }, regexSources);
  if (picked) console.log(`Clicked ${label}: ${picked}`);
  return picked;
}

async function autoAdvanceToNewTest(page) {
  const result = await runAutoHandoff(page, {
    hidePopup: hideFreshBatchPopup,
    q1TimeoutMs: 90000,
  });
  return result.ok;
}

async function waitForFreshBlock(page, args, previousIds, lastQ1) {
  const maxAttempts = args.autoNext ? 5 : Infinity;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (args.autoNext) {
      console.log(`\n--- AUTO HANDOFF attempt ${attempt}/${maxAttempts} ---`);
      await hideFreshBatchPopup(page);
      const { ok, paused } = await runAutoHandoff(page, {
        hidePopup: hideFreshBatchPopup,
        q1TimeoutMs: 90000,
      });
      if (paused) {
        console.log('\n⏸ Handoff paused before Create Test — browser left open for inspection.');
        return null;
      }
      if (!ok) {
        console.warn('Auto handoff did not reach Q1 — manual fallback');
        await showFreshBatchPopup(page, {
          variant: 'duplicate',
          title: 'AUTO HANDOFF FAILED — CREATE FRESH BATCH',
          reason: 'Automatic clicks did not reach Q1/50. Complete handoff manually.',
          detail: 'Check browser — then End Block → Create Test → Begin Test',
        });
        await waitForHandoffGrace(page, args.handoffGraceMs);
        if (args.recordClicks) await installHandoffRecorder(page);
        const ready = await waitForNextButtonReady(page);
        if (!ready) return null;
      }
    } else if (attempt > 1) {
      console.log('\n--- STILL SAME BLOCK — create a NEW test (not Resume) ---');
      console.log('Required: End Block → Confirm → End Review → Create Test → Begin Test\n');
      await waitForHandoffGrace(page, args.handoffGraceMs);
      if (args.recordClicks) await installHandoffRecorder(page);
      const ready = await waitForNextButtonReady(page);
      if (!ready) return null;
    } else {
      console.log('\n--- YOUR TURN (same browser) ---');
      console.log('Click: End Block → Create Test → Begin Test → Q1 (clicks logged below)');
      await waitForHandoffGrace(page, args.handoffGraceMs);
      if (args.recordClicks) await installHandoffRecorder(page);
      const ready = await waitForNextButtonReady(page);
      if (!ready) return null;
    }

    const q1 = await getQ1Snapshot(page);
    const pos = await readQuestionPosition(page);
    console.log(
      `Q1 check: ID ${q1.questionId || '?'} @ ${pos.raw || q1.questionNumber} — ${q1.questionPreview || ''}`
    );

    if (pos.index !== null && pos.index !== 1) {
      console.warn(`⚠ Not on Q1 (on ${pos.raw}) — create a fresh test, not Resume.`);
      await showFreshBatchPopup(page, {
        variant: 'duplicate',
        title: 'NEED Q1/50 — CREATE A FRESH BATCH',
        reason: `Scraper sees ${pos.raw}, not question 1. Finish Create Test → Begin Test on a new block.`,
        detail: '',
      });
      continue;
    }

    if (!previousIds?.size) {
      await saveHandoffRecording(page, {
        success: true,
        q1: { id: q1.questionId, number: pos.raw, preview: q1.questionPreview },
      });
      return q1;
    }

    if (lastQ1 && q1.questionId && q1.questionId === lastQ1) {
      console.warn(`⚠ Q1 unchanged (ID ${q1.questionId}) — this is the SAME block, not a new test.`);
      await showFreshBatchPopup(page, {
        variant: 'duplicate',
        title: 'SAME BATCH — CREATE A FRESH ONE',
        reason: `Q1 is still question ID ${q1.questionId}. You resumed the old block instead of creating a new test.`,
        detail: lastQ1 ? `Previous block also started with ID ${lastQ1}.` : '',
      });
      if (args.allowDuplicate) {
        console.warn('--allow-duplicate set — continuing anyway');
        await hideFreshBatchPopup(page);
        return q1;
      }
      continue;
    }

    if (previousIds.has(q1.questionId)) {
      console.warn(`⚠ Q1 (ID ${q1.questionId}) appeared in the previous block — likely recycled.`);
      await showFreshBatchPopup(page, {
        variant: 'duplicate',
        title: 'SAME BATCH — CREATE A FRESH ONE',
        reason: `Q1 (ID ${q1.questionId}) was already in the last scraped block.`,
        detail: 'Use Create Test → Begin Test. Do not Resume or Suspend.',
      });
      if (args.allowDuplicate) {
        await hideFreshBatchPopup(page);
        return q1;
      }
      continue;
    }

    await hideFreshBatchPopup(page);
    await logHandoffSystem(page, 'q1_ready', `Fresh Q1 ID ${q1.questionId} @ ${pos.raw}`);
    await saveHandoffRecording(page, {
      success: true,
      q1: { id: q1.questionId, number: pos.raw, preview: q1.questionPreview },
    });
    return q1;
  }

  console.error('Could not get a fresh block after auto-retries');
  return null;
}

async function prepareNextBlock(page, args, previousIds, lastQ1) {
  return waitForFreshBlock(page, args, previousIds, lastQ1);
}

async function clickEndBlock(page) {
  const label = await page.evaluate(() => {
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const text = (btn.getAttribute('title') || btn.innerText || '').replace(/\s+/g, ' ').trim();
      const src = btn.querySelector('img')?.src || '';
      if (/suspend|pause|resume/i.test(text)) continue;
      if (/^End Block$/i.test(text) || /stop-icon/i.test(src)) {
        btn.click();
        return text || 'End Block';
      }
    }
    return null;
  });
  if (label) console.log(`Clicked End Block (${label})`);
  return !!label;
}

async function confirmModal(page, words = ['yes', 'confirm', 'ok', 'end']) {
  await page.waitForTimeout(600);
  const picked = await page.evaluate((patterns) => {
    const modal =
      document.getElementById('modal-root') ||
      document.querySelector('[role="dialog"], [class*="modal" i]');
    const scope = modal || document.body;
    for (const btn of scope.querySelectorAll('button, [role="button"]')) {
      const t = (btn.innerText || btn.getAttribute('title') || '').trim();
      if (patterns.some((p) => new RegExp(p, 'i').test(t))) {
        btn.click();
        return t;
      }
    }
    return null;
  }, words);
  if (picked) console.log(`Confirmed modal: ${picked}`);
  return !!picked;
}

async function waitForLeaveTest(page, timeoutMs = 25000) {
  try {
    await page.waitForFunction(
      () => !document.querySelector('#test') || !document.querySelector('.next-button'),
      null,
      { timeout: timeoutMs }
    );
    return true;
  } catch {
    return false;
  }
}

async function clickStartNewBlock(page) {
  await page.waitForTimeout(1500);
  const label = await page.evaluate(() => {
    const patterns = [
      /create block/i,
      /new block/i,
      /start block/i,
      /create new block/i,
      /start test/i,
      /start practice/i,
      /create test/i,
    ];
    for (const btn of document.querySelectorAll('button, [role="button"]')) {
      const t = (btn.innerText || btn.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
      if (patterns.some((p) => p.test(t))) {
        btn.click();
        return t;
      }
    }
    return null;
  });
  if (label) console.log(`Started next block: ${label}`);
  else console.warn('Could not find Create/Start block button — may need manual click');
  return !!label;
}

function blockOutputPath(baseOutput, blockIndex, startBlock) {
  const n = startBlock + blockIndex - 1;
  const bankRaw = path.join(__dirname, 'scrape-bank', 'raw');
  if (fs.existsSync(bankRaw)) {
    if (n <= 1 && blockIndex <= 1 && !String(baseOutput).includes('block')) {
      return path.join(bankRaw, 'scrape-playwright-output.json');
    }
    return path.join(bankRaw, `scrape-playwright-block${n}.json`);
  }
  if (n <= 1 && blockIndex <= 1 && !baseOutput.includes('block')) {
    return path.isAbsolute(baseOutput) ? baseOutput : path.join(process.cwd(), baseOutput);
  }
  const dir = path.dirname(path.isAbsolute(baseOutput) ? baseOutput : path.join(process.cwd(), baseOutput));
  return path.join(dir, `scrape-playwright-block${n}.json`);
}

function previousBlockJsonPath(baseOutput, blockNum) {
  return blockJsonPath(blockNum);
}

async function runBlockLoop(page, args, mediaByQuestionId, rateLimit) {
  const results = [];
  let blockIndex = 0;
  const maxBlocks = args.loop ? Infinity : args.blocks;
  let previousIds = new Set();
  let lastQ1 = null;

  if (args.startBlock > 1) {
    const prevFile = previousBlockJsonPath(args.output, args.startBlock - 1);
    previousIds = questionIdsFromJsonFile(prevFile);
    if (previousIds.size) {
      console.log(
        `Loaded ${previousIds.size} question IDs from ${path.basename(prevFile)} for duplicate checks`
      );
    }
  }

  while (blockIndex < maxBlocks && !rateLimit.aborted) {
    blockIndex += 1;
    const blockNum = args.startBlock + blockIndex - 1;
    let q1Snapshot = null;

    if (blockIndex > 1) {
      const handoff = page.__nextHandoff || {
        fromBlock: blockNum - 1,
        toBlock: blockNum,
      };
      if (args.recordClicks) {
        startHandoffRecording(page, handoff.fromBlock, handoff.toBlock);
        await installHandoffRecorder(page);
      }
      q1Snapshot = await prepareNextBlock(page, args, previousIds, lastQ1);
      if (!q1Snapshot) break;
    }

    console.log(`\n===== BLOCK ${blockNum}${args.loop ? ' (loop)' : `/${args.startBlock + maxBlocks - 1}`} =====`);
    const outPath = blockOutputPath(args.output, blockIndex, args.startBlock);

    if (blockIndex === 1 && page.__handoffSession) {
      const bootQ1 = await getQ1Snapshot(page);
      const bootPos = await readQuestionPosition(page);
      await logHandoffSystem(page, 'q1_ready', `Fresh Q1 ID ${bootQ1.questionId} @ ${bootPos.raw}`);
      await saveHandoffRecording(page, {
        success: true,
        q1: { id: bootQ1.questionId, number: bootPos.raw, preview: bootQ1.questionPreview },
      });
    }

    const duplicateCheck =
      args.allowDuplicate || !previousIds.size
        ? null
        : {
            previousIds,
            threshold: args.duplicateThreshold,
            earlyAfter: 5,
          };

    const result = await scrapeBlock(
      page,
      { ...args, blockIndex: blockNum, duplicateCheck },
      mediaByQuestionId,
      rateLimit
    );

    const isDup =
      result.aborted &&
      (result.abortReason === 'duplicate_block_early' || result.abortReason === 'duplicate_block_full');

    if (isDup && !args.allowDuplicate) {
      console.warn(`Block ${blockNum} NOT saved — duplicate of previous block.`);
      await showFreshBatchPopup(page, {
        variant: 'duplicate',
        title: 'SAME BATCH — CREATE A FRESH ONE',
        reason: `Block ${blockNum} matched the previous block and was not saved.`,
        detail: result.duplicateOverlap
          ? `${result.duplicateOverlap.overlap} overlapping question IDs (${result.duplicateOverlap.pct}%).`
          : '',
      });
      blockIndex -= 1;
      continue;
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`Saved: ${outPath}`);
    results.push({ block: blockNum, path: outPath, summary: result.summary, duplicate: isDup });

    const blockIds = questionIdsFromPages(result.pages?.filter((p) => p.step > 0) || []);
    previousIds = blockIds;
    lastQ1 =
      q1Snapshot?.questionId ||
      normId(result.pages?.find((p) => p.step === 0)?.questionId) ||
      normId(result.pages?.find((p) => p.step === 1)?.questionId);

    if (rateLimit.aborted) break;
    if (!args.loop && blockIndex >= maxBlocks) break;

    console.log(`\nBlock ${blockNum} done — ${result.summary.revealsCaptured}/${result.summary.questionsScraped} reveals`);

    if (args.loop && blockIndex < maxBlocks && !rateLimit.aborted && args.autoNext) {
      const nextBlockNum = args.startBlock + blockIndex;
      page.__nextHandoff = { fromBlock: blockNum, toBlock: nextBlockNum };
      console.log(`\nBlock ${blockNum} done — auto handoff → block ${nextBlockNum} in 3s…`);
      await page.waitForTimeout(3000);
    } else if (args.loop && blockIndex < maxBlocks && !rateLimit.aborted) {
      const nextBlockNum = args.startBlock + blockIndex;
      page.__nextHandoff = { fromBlock: blockNum, toBlock: nextBlockNum };
      await showFreshBatchPopup(page, {
        variant: 'handoff',
        title: `BLOCK ${blockNum} DONE — NEW BATCH NEEDED`,
        reason: `Create a fresh 50-question test for block ${nextBlockNum}.`,
        detail: 'Do not Resume the finished block.',
      });
    }
  }

  return results;
}

async function scrapeMultipleBlocks(page, args, mediaByQuestionId, rateLimit) {
  const oldStart = args.startBlock;
  args.startBlock = 1;
  const results = await runBlockLoop(page, { ...args, loop: false, blocks: args.blocks }, mediaByQuestionId, rateLimit);
  args.startBlock = oldStart;
  return results;
}

async function enableScrollAssist(page) {
  await page.addInitScript(() => {
    const fix = () => {
      const styleId = 'ccs-playwright-scroll-fix';
      if (document.getElementById(styleId)) return;
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = `
        html, body, #root, #test { overflow: auto !important; }
        .testWrapper, .question-container, #testQuestion {
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch;
        }
        .testWrapper::-webkit-scrollbar, .question-container::-webkit-scrollbar {
          width: 12px;
        }
        .testWrapper::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 6px;
        }
      `;
      document.documentElement.appendChild(s);
    };
    fix();
    new MutationObserver(fix).observe(document.documentElement, { childList: true, subtree: true });
  });
  await page.evaluate(() => {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    const tw = document.querySelector('.testWrapper');
    if (tw) {
      tw.style.overflowY = 'auto';
      tw.style.maxHeight = 'calc(100vh - 180px)';
    }
  }).catch(() => {});
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node playwright-scrape-qb.js [--count 50] [--minutes 9] [--loop] [--handoff] [--auto-next] [--record-clicks] [--start-block N] [--auto-start] [--allow-duplicate]`);
    process.exit(0);
  }

  const outputPath = path.isAbsolute(args.output)
    ? args.output
    : path.join(process.cwd(), args.output);

  const mediaByQuestionId = new Map();
  const rateLimit = { hits: 0, until: 0, aborted: false };

  const onRateLimit = (url) => {
    rateLimit.hits += 1;
    const backoff = Math.min(180000, 15000 * Math.pow(2, Math.min(rateLimit.hits - 1, 3)));
    rateLimit.until = Math.max(rateLimit.until, Date.now() + backoff);
    console.warn(`\n429 on ${String(url).slice(0, 80)} — backoff ${Math.round(backoff / 1000)}s (hit ${rateLimit.hits})`);
    if (rateLimit.hits >= 3) rateLimit.aborted = true;
  };

  if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

  console.log(`CCS QB Playwright scraper ${VERSION}`);
  console.log(`Profile: ${PROFILE_DIR}\n`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: args.headless,
    viewport: null,
    args: ['--start-maximized'],
    acceptDownloads: true,
  });

  const page = context.pages()[0] || (await context.newPage());
  await enableScrollAssist(page);
  attachMediaCapture(page, mediaByQuestionId, onRateLimit);

  await page.goto(QB_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await enableScrollAssist(page);

  const login = await ensureLoggedIn(page);
  if (!login.ok) {
    await captureRoadblock(page, 'startup_login_failed', login.reason || 'login');
    console.error('Auto-login failed — see roadblock-screenshots/');
    await context.close();
    process.exit(1);
  }

  console.log('Scroll tip: CCS scrolls INSIDE the question panel (.testWrapper), not the browser edge.');
  console.log('  → Hover over the question text and use mouse wheel / two-finger swipe.\n');

  if (args.loginOnly) {
    console.log('Login-only mode — browser stays open. Log in, browse, then close the window when done.');
    console.log('Session saved to qb_browser_profile/\n');
    await page.waitForEvent('close', { timeout: 0 }).catch(() => {});
    await context.close();
    return;
  }

  console.log('1. Log in if needed and open your 50-question block (Q1 visible).');
  console.log('2. Make sure the Next button is on screen.');
  if (args.startBlock > 1 && args.recordClicks) {
    page.__nextHandoff = { fromBlock: args.startBlock - 1, toBlock: args.startBlock };
    startHandoffRecording(page, args.startBlock - 1, args.startBlock);
    await installHandoffRecorder(page);
  }
  if (args.autoNext && args.startBlock > 1) {
    const bootPos = await readQuestionPosition(page);
    if (bootPos.index !== 1) {
      console.log(`\nNot on Q1 (${bootPos.raw || '?'}) — running auto handoff for block ${args.startBlock}…`);
      await runAutoHandoff(page, { hidePopup: hideFreshBatchPopup, q1TimeoutMs: 120000 });
    }
  }
  if (!args.autoStart) {
    await waitForNextButtonReady(page, 120000, { requireQ1: args.loop || args.startBlock > 1 });
  } else {
    const requireQ1 = args.loop || args.startBlock > 1;
    const bootTimeout = requireQ1 ? 900000 : 60000;
    console.log(
      `\nAuto-start — waiting for Q1/50 + Next (up to ${Math.round(bootTimeout / 60000)} min)…`
    );
    const ready = await waitForNextButtonReady(page, bootTimeout, { requireQ1 });
    if (!ready) {
      console.error('Need Q1/50 with Next button visible. Create a fresh test, then run again.');
      await context.close();
      process.exit(1);
    }
    console.log('Ready on Q1 — starting scrape.\n');
  }

  const hasNext = await page.locator('.next-button').isVisible().catch(() => false);
  if (!hasNext) {
    console.error('No .next-button found. Open a question block first, then run again.');
    await context.close();
    process.exit(1);
  }

  if (args.loop) {
    console.log('Loop mode — browser stays open between blocks. Ctrl+C to stop.');
    console.log('Duplicate protection ON — same 50-pack will be rejected (use --allow-duplicate to override).\n');
    if (args.autoNext) {
      const prof = loadHandoffProfile();
      console.log('AUTO-NEXT ON — handoff clicks run automatically between blocks');
      if (prof) console.log(`  Loaded profile from block ${prof.source}`);
    } else {
      console.log('Between blocks: End Block → Create Test → Begin Test — scraper verifies Q1 is new');
    }
    if (args.recordClicks) console.log('Handoff recorder ON — saves click sequences to handoff-recordings/');
  }

  const useLoop = args.loop || args.blocks > 1 || args.autoNext;
  const result = useLoop
    ? await runBlockLoop(page, args, mediaByQuestionId, rateLimit)
    : (() => {
        const outPath = blockOutputPath(args.output, 1, args.startBlock);
        return scrapeBlock(page, { ...args, blockIndex: args.startBlock }, mediaByQuestionId, rateLimit).then(
          (r) => {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, JSON.stringify(r, null, 2));
            return [{ block: args.startBlock, path: outPath, summary: r.summary }];
          }
        );
      })();

  const resolved = await result;

  console.log('\n========== DONE ==========');
  for (const item of resolved) {
    const summary = item.summary || item;
    const file = item.path || outputPath;
    console.log(`File:      ${file}`);
    console.log(`Questions: ${summary.questionsScraped}`);
    console.log(`Reveals:   ${summary.revealsCaptured}`);
    console.log(`Images:    ${summary.totalPngCaptured}`);
    console.log(`Elapsed:   ${summary.elapsedFormatted}`);
  }
  console.log('\nExtract PNGs: node extract-scrape-images.js "<json file>"');

  if (args.keepOpen && !args.loop) {
    console.log('\nBrowser left open. For multi-block without restarting, use: --loop --handoff');
    await page.waitForEvent('close', { timeout: 0 }).catch(() => {});
  } else if (
    fs.existsSync(path.join(__dirname, 'PAUSE_BEFORE_NEW_TEST')) ||
    fs.existsSync(path.join(__dirname, 'PAUSE_AFTER_BLOCK'))
  ) {
    console.log('\nBrowser left open — inspect Create Test screen, then delete PAUSE_BEFORE_NEW_TEST and restart.');
    await page.waitForEvent('close', { timeout: 0 }).catch(() => {});
  }
  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
