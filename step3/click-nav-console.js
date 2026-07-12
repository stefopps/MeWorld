// PASTE THIS ENTIRE FILE into DevTools Console (F12), then run:
//   await scrapeFromOne(50)
const SCRAPER_VERSION = '2026-07-11-v21';

window.__scraperAbort = false;

window.__scraperRateLimit = window.__scraperRateLimit || { until: 0, hits: 0 };
window.__scraperPaceMs = window.__scraperPaceMs ?? 0;
window.__humanMode = window.__humanMode ?? false;
window.__humanPace = window.__humanPace ?? { minMs: 2200, maxMs: 5800 };
window.__humanBurst = window.__humanBurst ?? { minMs: 2400, maxMs: 4500 };
window.__humanRead = window.__humanRead ?? { msPerChar: 7, minMs: 1800, maxMs: 14000 };
window.__humanProceed = window.__humanProceed ?? { beforeMs: [600, 1800], afterMs: [1200, 2800] };

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randBetween([min, max]) {
  return randInt(min, max);
}

async function humanDelay(label) {
  if (!window.__humanMode) {
    if (window.__scraperPaceMs > 0) await new Promise((r) => setTimeout(r, window.__scraperPaceMs));
    return;
  }
  const ms = randInt(window.__humanPace.minMs, window.__humanPace.maxMs);
  if (label && ms >= 2800) console.log(`  … pause ${Math.round(ms / 1000)}s (${label})`);
  await new Promise((r) => setTimeout(r, ms));
}

async function humanReadDelay(pageData, label = 'reading') {
  if (!window.__humanMode) return;
  const text = `${pageData?.question || ''}\n${pageData?.explanation || ''}`;
  const chars = text.length;
  const { msPerChar, minMs, maxMs } = window.__humanRead;
  const ms = Math.min(maxMs, Math.max(minMs, Math.round(chars * msPerChar + randInt(-400, 1200))));
  if (ms >= 2500) console.log(`  … ${label} ${Math.round(ms / 1000)}s`);
  await new Promise((r) => setTimeout(r, ms));
}

async function humanMicroBreak() {
  if (!window.__humanMode || Math.random() > 0.07) return;
  const ms = randInt(7000, 16000);
  console.log(`  … break ${Math.round(ms / 1000)}s`);
  await new Promise((r) => setTimeout(r, ms));
}

function humanBurstMs(baseMs) {
  if (!window.__humanMode) return baseMs;
  return Math.max(baseMs, randInt(window.__humanBurst.minMs, window.__humanBurst.maxMs));
}

function humanIntervalMs(fallback = 80) {
  return window.__humanMode ? randInt(70, 150) : fallback;
}

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Second arg <= 120 and < 1000 → minutes; otherwise burstMs */
function isMinutesBudget(arg) {
  return typeof arg === 'number' && arg > 0 && arg <= 120 && arg < 1000;
}

function computeTimingBudget(questionCount, totalMinutes) {
  const totalMs = totalMinutes * 60 * 1000;
  const perQ = Math.floor(totalMs / Math.max(1, questionCount));
  const navOverheadMs = 900;
  const burstMs = Math.max(1200, Math.min(Math.floor(perQ * 0.48), perQ - navOverheadMs - 300));
  const paceMs = Math.max(300, perQ - burstMs - navOverheadMs);
  return {
    questionCount,
    totalMinutes,
    totalMs,
    perQ,
    burstMs,
    paceMs,
    formatted: formatElapsed(totalMs),
    perQFormatted: formatElapsed(perQ),
  };
}

function applyTimingBudget(budget) {
  window.__humanMode = false;
  window.__scraperPaceMs = budget.paceMs;
  return budget;
}

function logTimingBudget(budget) {
  console.log(
    `Timing budget: ${budget.questionCount} Q in ${budget.totalMinutes} min (${budget.formatted} total, ~${budget.perQFormatted}/Q)`
  );
  console.log(`  burst=${budget.burstMs}ms  pace=${budget.paceMs}ms  (nav ~900ms/Q overhead)`);
  if (budget.perQ < 5000) {
    console.warn(`⚠ ${budget.perQFormatted}/Q is fast — may hit 429. Try ayText(${budget.questionCount}, ${Math.max(budget.totalMinutes + 3, 10)})`);
  }
}

function restoreNativeFetch() {
  if (window.__scraperOrigFetch) {
    window.fetch = window.__scraperOrigFetch;
  }
}

function setTextOnlyMode() {
  window.__textOnlyMode = true;
  window.__screenshotMode = false;
  window.__fastScreenshot = false;
  restoreNativeFetch();
  return 'text-only';
}

function setJsonScrapeMode(options = {}) {
  window.__textOnlyMode = false;
  window.__screenshotMode = false;
  window.__fastScreenshot = false;
  window.__lightImageMode = options.light !== false;
  installImageCaptureHooks();
  return window.__lightImageMode ? 'json+images-light' : 'json+images-heavy';
}

function setHeavyImageMode() {
  window.__lightImageMode = false;
  return setJsonScrapeMode({ light: false });
}

function setScreenshotMode() {
  window.__textOnlyMode = false;
  window.__screenshotMode = true;
  return 'screenshot';
}

function scraperMode() {
  const mode = window.__screenshotMode
    ? 'screenshot'
    : window.__textOnlyMode
      ? 'text-only'
      : window.__lightImageMode
        ? 'json+images-light'
        : 'json+images-heavy';
  console.log(`Mode: ${mode}`);
  return mode;
}

function humanNavDelay() {
  return window.__humanMode ? randInt(350, 900) : 400;
}

async function loadHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;
  const urls = [
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
  ];
  let lastErr;
  for (const url of urls) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      if (window.html2canvas) return window.html2canvas;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('html2canvas failed to load');
}

function findScrollableContentEl() {
  const prefer = ['.testWrapper', '.question-container', '#test'];
  for (const sel of prefer) {
    const el = document.querySelector(sel);
    if (el && el.scrollHeight > el.clientHeight + 24) return el;
  }
  const test = document.querySelector('#test');
  if (test) {
    for (const el of test.querySelectorAll('*')) {
      const st = getComputedStyle(el);
      if (['auto', 'scroll', 'overlay'].includes(st.overflowY) && el.scrollHeight > el.clientHeight + 24) {
        return el;
      }
    }
  }
  return document.querySelector('#test') || document.body;
}

async function snapElement(el, html2canvas, scale = 1) {
  if (!el) return null;
  await new Promise((r) => setTimeout(r, 80));
  return html2canvas(el, {
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    ignoreElements: (node) => !!node?.closest?.('.Toastify, [class*="toast" i]'),
  });
}

async function captureScrollerStitch(scroller, html2canvas, options = {}) {
  const scale = options.scale ?? 1;
  const sliceWaitMs = options.sliceWaitMs ?? 120;
  const savedScroll = scroller.scrollTop;
  scroller.scrollTop = 0;
  await new Promise((r) => setTimeout(r, sliceWaitMs));

  const width = scroller.scrollWidth || scroller.clientWidth;
  const viewH = scroller.clientHeight;
  const totalH = scroller.scrollHeight;
  const slices = [];

  for (let y = 0; y < totalH; y += viewH) {
    scroller.scrollTop = y;
    await new Promise((r) => setTimeout(r, sliceWaitMs));
    const sliceCanvas = await html2canvas(scroller, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width,
      height: viewH,
      windowWidth: width,
      windowHeight: viewH,
    });
    const cropH = Math.min(viewH, totalH - y);
    slices.push({ canvas: sliceCanvas, cropH });
  }

  scroller.scrollTop = savedScroll;

  const out = document.createElement('canvas');
  out.width = Math.round(width * scale);
  out.height = Math.round(totalH * scale);
  const ctx = out.getContext('2d');
  let dy = 0;
  for (const { canvas, cropH } of slices) {
    const drawH = Math.min(Math.round(cropH * scale), canvas.height, out.height - dy);
    ctx.drawImage(canvas, 0, 0, canvas.width, drawH, 0, dy, canvas.width, drawH);
    dy += drawH;
  }
  return out;
}

function stitchCanvasesVertically(canvases) {
  const parts = canvases.filter(Boolean);
  if (!parts.length) return null;
  const width = Math.max(...parts.map((c) => c.width));
  const height = parts.reduce((n, c) => n + c.height, 0);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const c of parts) {
    ctx.drawImage(c, 0, y);
    y += c.height;
  }
  return out;
}

/** CCS QB layout: fixed header + scrollable .testWrapper + footer — stitch all parts. */
async function captureQBFullScreenshot(options = {}) {
  const html2canvas = await loadHtml2Canvas();
  const scale = options.scale ?? (options.fast ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  const test = document.querySelector('#test');

  if (!test) {
    return capturePageScreenshot({ ...options, fullPage: true });
  }

  const header = test.querySelector('.test-header, header');
  const footer = test.querySelector('footer, .test-footer-wrapper');
  const scroller = findScrollableContentEl();
  const parts = [];

  if (header) parts.push(await snapElement(header, html2canvas, scale));

  if (scroller && scroller.scrollHeight > scroller.clientHeight + 24) {
    parts.push(await captureScrollerStitch(scroller, html2canvas, { scale, sliceWaitMs: options.sliceWaitMs }));
  } else {
    const body = test.querySelector('.testWrapper') || scroller;
    if (body) parts.push(await snapElement(body, html2canvas, scale));
  }

  if (footer) parts.push(await snapElement(footer, html2canvas, scale));

  const stitched = stitchCanvasesVertically(parts);
  if (!stitched) throw new Error('stitch failed');

  return {
    mediaType: 'image/png',
    dataUrl: stitched.toDataURL('image/png'),
    width: stitched.width,
    height: stitched.height,
    method: 'qb-scroll-stitch',
    fullPage: true,
    scrollHeight: scroller?.scrollHeight ?? null,
  };
}

function getFullPageSize() {
  const body = document.body;
  const html = document.documentElement;
  return {
    width: Math.max(
      body.scrollWidth,
      body.offsetWidth,
      html.clientWidth,
      html.scrollWidth,
      html.offsetWidth,
      window.innerWidth
    ),
    height: Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight,
      window.innerHeight
    ),
  };
}

function getScreenshotRoot(fullPage) {
  if (fullPage) return document.documentElement;
  return (
    document.querySelector('#test') ||
    document.querySelector('.testWrapper') ||
    document.querySelector('.question-container') ||
    document.body
  );
}

async function capturePageScreenshot(options = {}) {
  const fast = options.fast ?? window.__fastScreenshot ?? false;
  const fullPage = options.fullPage ?? window.__fullPageScreenshot ?? fast;

  if (fullPage && document.querySelector('#test')) {
    const settle = options.settleMs ?? (fast ? 150 : 250);
    await new Promise((r) => setTimeout(r, settle));
    return captureQBFullScreenshot(options);
  }

  const html2canvas = await loadHtml2Canvas();
  const root = getScreenshotRoot(fullPage);
  const settle = options.settleMs ?? (fast ? 150 : window.__humanMode ? randInt(350, 700) : 250);
  await new Promise((r) => setTimeout(r, settle));

  const scale = options.scale ?? (fast ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  const opts = {
    useCORS: true,
    allowTaint: true,
    logging: false,
    scale,
    backgroundColor: '#ffffff',
    ignoreElements: (el) => !!el?.closest?.('.Toastify, [class*="toast" i]'),
  };

  if (fullPage) {
    const { width, height } = getFullPageSize();
    const scrollX = window.scrollX ?? window.pageXOffset ?? 0;
    const scrollY = window.scrollY ?? window.pageYOffset ?? 0;
    Object.assign(opts, {
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: -scrollX,
      scrollY: -scrollY,
      x: 0,
      y: 0,
    });
  }

  const canvas = await html2canvas(root, opts);
  return {
    mediaType: 'image/png',
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    method: fullPage ? 'fullpage-screenshot' : fast ? 'html2canvas-fast' : 'html2canvas-region',
    fullPage,
    pageSize: fullPage ? getFullPageSize() : null,
  };
}

function lightMeta() {
  return {
    capturedAt: new Date().toISOString(),
    questionNumber: document.querySelector('.item-block')?.innerText?.trim() || '',
    questionId: document.querySelector('.item-info span')?.innerText?.trim() || '',
  };
}

function downloadPngNow(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Fast full-page screenshots for OCR later. No text scrape, no image hooks, no human delays.
 * One PNG per question (captured on reveal screen — question + answers + explanation).
 */
async function fastScreenshotBlock(count = 50, options = {}) {
  setScreenshotMode();
  window.__fastScreenshot = true;
  window.__fullPageScreenshot = options.fullPage ?? true;
  window.__humanMode = false;
  window.__scraperAbort = false;

  const revealWaitMs = options.revealWaitMs ?? 850;
  const proceedWaitMs = options.proceedWaitMs ?? 350;
  const prefix = options.prefix ?? 'block';
  const downloadNow = options.downloadNow ?? true;
  const manifest = [];

  console.log(`Fast FULL-PAGE screenshot: ${count} questions`);
  console.log('Stop anytime: window.__scraperAbort = true');

  await loadHtml2Canvas();

  for (let i = 1; i <= count; i++) {
    if (window.__scraperAbort) {
      console.warn('Stopped by user (__scraperAbort)');
      break;
    }
    await scraperPause(`Q${i}`);

    const btn = document.querySelector('.next-button');
    if (!btn) {
      console.error('Next button not found');
      break;
    }

    const beforeMeta = lightMeta();
    btn.click();
    console.log(`Next ${i}/${count}…`);
    await new Promise((r) => setTimeout(r, revealWaitMs));

    let shot;
    try {
      shot = await capturePageScreenshot({ fast: true, fullPage: true, settleMs: 150 });
    } catch (e) {
      console.warn(`Screenshot failed Q${i}:`, e.message);
      manifest.push({ step: i, ...beforeMeta, error: e.message });
      continue;
    }

    const meta = { step: i, ...lightMeta(), ...beforeMeta, screenshot: { w: shot.width, h: shot.height } };
    const file = screenshotFilename(meta, prefix);
    meta.file = file;

    if (downloadNow) {
      downloadPngNow(shot.dataUrl, file);
    } else {
      meta.dataUrl = shot.dataUrl;
    }

    manifest.push(meta);
    console.log(`  ✓ ${file}`);

    const proceed = document.querySelector('.button-container-light button');
    if (proceed) {
      proceed.click();
      await new Promise((r) => setTimeout(r, proceedWaitMs));
    }

    const fromQ = parseQuestionNumber(beforeMeta.questionNumber);
    if (fromQ !== null) {
      await waitForQuestionChange(fromQ, 4000);
    }
  }

  const output = {
    scrapedAt: new Date().toISOString(),
    mode: 'fast-screenshot-ocr',
    scraperVersion: SCRAPER_VERSION,
    count: manifest.length,
    screens: manifest.map(({ dataUrl, ...rest }) => rest),
  };

  downloadJson(output, `${prefix}-manifest.json`);
  console.log(`Done — ${manifest.length} screenshots, manifest downloaded`);
  return output;
}

function enrichTextOnly(data) {
  return {
    ...data,
    hasMedicalViewer: hasMedicalViewer(),
    imageCount: 0,
    hasImages: false,
    images: [],
    pngDataUrls: [],
    textOnly: true,
  };
}

async function enrichPageCapture(data) {
  if (window.__textOnlyMode) return enrichTextOnly(data);
  if (!window.__screenshotMode) {
    return enrichWithImages(data);
  }
  try {
    const shot = await capturePageScreenshot();
    return {
      ...data,
      hasMedicalViewer: hasMedicalViewer(),
      imageCount: 0,
      hasImages: false,
      images: [],
      pngDataUrls: [],
      screenshot: shot,
      hasScreenshot: true,
    };
  } catch (e) {
    console.warn('Screenshot failed:', e.message);
    return { ...data, hasScreenshot: false, screenshotError: e.message };
  }
}

function screenshotFilename(page, prefix = 'scrape') {
  const q = parseQuestionNumber(page.questionNumber) || page.step || 0;
  const id = normalizeQuestionId(page.questionId) || 'unknown';
  return `${prefix}-q${String(q).padStart(2, '0')}-id${id}.png`;
}

async function flushScreenshotDownloads(pages, prefix = 'scrape') {
  const withShots = pages.filter((p) => p.screenshot?.dataUrl);
  if (!withShots.length) return 0;
  console.log(`Downloading ${withShots.length} screenshots...`);
  let n = 0;
  for (const page of withShots) {
    const a = document.createElement('a');
    a.href = page.screenshot.dataUrl;
    a.download = screenshotFilename(page, prefix);
    document.body.appendChild(a);
    a.click();
    a.remove();
    n += 1;
    await new Promise((r) => setTimeout(r, 450));
  }
  console.log(`Downloaded ${n} PNG screenshots`);
  return n;
}

function isRateLimited() {
  return Date.now() < (window.__scraperRateLimit?.until || 0);
}

function noteRateLimitResponse(resp, url) {
  if (!resp || resp.status !== 429) return false;
  const rl = window.__scraperRateLimit;
  const now = Date.now();

  if (now - (rl.last429At || 0) < 4000) {
    rl.until = Math.max(rl.until, now + 60000);
    return true;
  }

  rl.last429At = now;
  rl.hits += 1;
  const backoff = Math.min(120000, 8000 * Math.pow(2, Math.min(rl.hits - 1, 4)));
  rl.until = Math.max(rl.until, now + backoff);
  console.warn(`429 on ${String(url || '').slice(0, 70)} — pause ${Math.round(backoff / 1000)}s (hit ${rl.hits})`);

  if (rl.hits >= 3) {
    window.__scraperAbort = true;
    console.error('AUTO-STOPPED — server blocked you. Wait 30 min, hard refresh, paste script ONCE, then: await ayText(50, 15)');
  }
  return true;
}

async function scraperPause(reason) {
  const wait = Math.max(0, (window.__scraperRateLimit?.until || 0) - Date.now());
  if (wait > 0) {
    console.warn(`Rate-limit cooldown: waiting ${Math.round(wait / 1000)}s${reason ? ` (${reason})` : ''}`);
    await new Promise((r) => setTimeout(r, wait));
  }
}

function scraperFetch(...args) {
  const fn = window.__scraperOrigFetch || window.fetch.bind(window);
  return fn(...args);
}

function extractAnswerDetails() {
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
    const imgs = [...div.querySelectorAll('img')].map((img) => img.src);

    return {
      letter,
      text,
      hasImage: imgs.length > 0,
      imageSrcs: imgs,
      selected: !!div.querySelector('input[type="radio"]:checked'),
      flagged: !!div.querySelector('input[type="checkbox"]:checked'),
      className,
      struck:
        /strike|strikethrough|line-through/i.test(className + style.textDecoration),
      likelyCorrect:
        /correct|right|green|success|true/i.test(className + html),
      likelyIncorrect: /wrong|incorrect|red|false/i.test(className + html),
      votePercent:
        div.querySelector('[class*="percent"], [class*="vote"], [class*="choice"]')
          ?.innerText?.trim() || null,
    };
  });
}

function extractExplanation() {
  const selectors = [
    '.explanation',
    '[class*="explanation" i]',
    '[class*="Explanation"]',
    '[class*="split" i]',
    '.answer-explanation',
    '.explanation-container',
    '.test-contentWrapper ~ div',
  ];

  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 10) {
        return el.innerText.trim();
      }
    } catch (e) {
      /* ignore */
    }
  }

  const extras = [...document.querySelectorAll('.testWrapper > *')].filter(
    (el) =>
      !el.matches('#testQuestion, .answers, .button-container-light, .button-container') &&
      el.innerText.trim().length > 15
  );
  if (extras.length) return extras.map((el) => el.innerText.trim()).join('\n\n');
  return '';
}

function extractPageDataSync() {
  const header = document.querySelector('.test-header') || document;

  const questionId =
    header.querySelector('.item-info span')?.innerText?.trim() ||
    document.querySelector('.item-info span')?.innerText?.trim() ||
    '';

  const questionNumber =
    header.querySelector('.item-block')?.innerText?.trim() || '';

  const question =
    document.querySelector('#testQuestion')?.innerText?.trim() ||
    document.querySelector('.question')?.innerText?.trim() ||
    '';

  const answers = extractAnswerDetails();
  const explanation = extractExplanation();
  const container =
    document.querySelector('.question-container') ||
    document.querySelector('.testWrapper') ||
    document.body;
  const fullText = container.innerText.trim();

  const lower = fullText.toLowerCase();
  const hasReveal =
    explanation.length > 20 ||
    lower.includes('explanation') ||
    lower.includes('correct answer') ||
    answers.some((a) => a.likelyCorrect || a.votePercent) ||
    [...document.querySelectorAll('[class*="explanation" i], [class*="correct" i]')].some(
      (el) => el.innerText.trim().length > 10
    );

  const likelyCorrectAnswer =
    answers.find((a) => a.likelyCorrect)?.letter ||
    answers.find((a) => a.votePercent && !a.struck)?.letter ||
    null;

  const hasSelection = answers.some((a) => a.selected);
  const hasCheckmarks =
    hasSelection ||
    answers.some((a) => a.likelyCorrect || a.struck || a.votePercent);
  const flagged = !!document.querySelector('#flag:checked');

  return {
    capturedAt: new Date().toISOString(),
    questionId,
    questionNumber,
    question,
    answers,
    explanation,
    likelyCorrectAnswer,
    hasReveal,
    hasSelection,
    hasCheckmarks,
    flagged,
    looksFresh: !hasReveal && !hasCheckmarks && !hasSelection,
    fullText,
  };
}

function getImageRoots() {
  const roots = new Set();
  for (const doc of getSearchDocuments()) {
    for (const sel of [
      '.question-container',
      '.testWrapper',
      '[class*="explanation" i]',
      '#testQuestion',
    ]) {
      const el = doc.querySelector(sel);
      if (el) roots.add(el);
    }
    if (!doc.querySelector('.question-container, .testWrapper, #testQuestion')) {
      roots.add(doc.body);
    }
  }
  return [...roots];
}

const UI_ICON_ALTS = new Set(['invert', 'contrast', 'zoom']);
const RASTER_PREFIXES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const DECORATIVE_URL_RE =
  /\/images\/(?:doctor|nurse|logo|avatar|placeholder|banner|header|footer|icon|psychqb)[^/?#]*\.(?:png|jpe?g|webp)/i;
const UI_ASSET_RE =
  /\/assets\/(?:.*-icon|favicon|calculator|pause|stop|reverse-color|index-)[^/?#]*/i;
const WEBAPI_MEDIA_RE = /get(?:Question|multipleanswer)Media\.webapi/i;
const LAZY_ATTRS = ['data-src', 'data-original', 'data-image', 'data-url', 'data-img', 'data-lazy-src'];
const __imageUrlStore = new Map();
const __blobStore = new Map();
const __questionMediaStore = new Map();

function normalizeQuestionId(raw) {
  if (!raw) return '';
  const m = String(raw).trim().match(/(\d{1,8})/);
  return m ? m[1] : String(raw).trim();
}

function getCurrentQuestionId() {
  const raw =
    document.querySelector('.test-header .item-info span')?.innerText?.trim() ||
    document.querySelector('.item-info span')?.innerText?.trim() ||
    '';
  return normalizeQuestionId(raw);
}

function parseQuestionIdFromApiUrl(url) {
  try {
    const u = new URL(url, location.origin);
    return u.searchParams.get('question_id') || u.searchParams.get('questionId') || null;
  } catch (e) {
    return null;
  }
}

async function storeRasterBlob(url, blob, mediaType, meta = {}) {
  if (!blob || blob.size < 512) return null;
  let mt = String(mediaType || blob.type || '').split(';')[0].trim();
  if (!mt.startsWith('image/') || isSvgMediaType(mt)) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const sniffed = sniffImageMediaType(buf);
    if (!sniffed) return null;
    mt = sniffed;
    blob = new Blob([buf], { type: sniffed });
  }
  if (!isRasterMediaType(mt)) return null;

  const dataUrl = await blobToDataUrl(blob);
  const entry = {
    url,
    dataUrl,
    mediaType: mt,
    size: blob.size,
    questionId:
      normalizeQuestionId(meta.questionId) ||
      normalizeQuestionId(parseQuestionIdFromApiUrl(url)) ||
      (meta.source === 'createObjectURL' ? null : getCurrentQuestionId()) ||
      null,
    questionNumber: meta.questionNumber ?? (meta.source === 'createObjectURL' ? null : getCurrentQuestionNumber()),
    capturedAt: Date.now(),
    source: meta.source || 'network',
  };

  __imageUrlStore.set(url, {
    url,
    mediaType: mt,
    questionNumber: entry.questionNumber,
    seenAt: entry.capturedAt,
  });

  if (entry.questionId) __questionMediaStore.set(String(entry.questionId), entry);
  if (url.startsWith('blob:')) __blobStore.set(url, entry);
  return entry;
}

function installBlobCaptureHook() {
  if (window.__blobHookInstalled) return;
  if (!window.__scraperOrigCreateObjectURL) {
    window.__scraperOrigCreateObjectURL = URL.createObjectURL.bind(URL);
  }
  URL.createObjectURL = function (blob) {
    const url = window.__scraperOrigCreateObjectURL(blob);
    if (blob instanceof Blob) {
      storeRasterBlob(url, blob, blob.type, { source: 'createObjectURL' }).catch(() => {});
    }
    return url;
  };
  window.__blobHookInstalled = true;
}

function installFetchImageHooks() {
  if (window.__fetchHookInstalled || window.__textOnlyMode || window.__lightImageMode) return;
  installBlobCaptureHook();

  if (!window.__scraperOrigFetch) {
    window.__scraperOrigFetch = window.fetch.bind(window);
  }

  function recordNetworkImage(url, mediaType) {
    if (!url || isSvgSrc(url)) return;
    if (isDecorativeImageUrl(url)) return;
    const mt = String(mediaType || '').toLowerCase();
    const looksRaster =
      WEBAPI_MEDIA_RE.test(url) ||
      isRasterMediaType(mt) ||
      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) ||
      url.startsWith('blob:') ||
      (url.startsWith('data:image/') && isRasterMediaType(url.slice(5, url.indexOf(';'))));
    if (!looksRaster) return;

    __imageUrlStore.set(url, {
      url,
      mediaType: mediaType || null,
      questionNumber: getCurrentQuestionNumber(),
      seenAt: Date.now(),
    });
  }

  window.fetch = async function (...args) {
    const req = args[0];
    const url = typeof req === 'string' ? req : req?.url;
    const resp = await window.__scraperOrigFetch(...args);
    try {
      if (noteRateLimitResponse(resp, url)) return resp;

      const ct = resp.headers.get('content-type') || '';
      if (resp.ok && WEBAPI_MEDIA_RE.test(url || '')) {
        const clone = resp.clone();
        clone
          .blob()
          .then((blob) =>
            storeRasterBlob(url, blob, ct, {
              source: 'webapi',
              questionId: parseQuestionIdFromApiUrl(url),
            })
          )
          .catch(() => {});
      } else if (resp.ok && ct.startsWith('image/') && !isDecorativeImageUrl(url)) {
        recordNetworkImage(url, ct);
        const clone = resp.clone();
        clone
          .blob()
          .then((blob) => storeRasterBlob(url, blob, ct, { source: 'fetch-image' }))
          .catch(() => {});
      }
    } catch (e) {
      /* ignore */
    }
    return resp;
  };

  if (!window.__scraperXhrHookInstalled) {
    window.__scraperXhrHookInstalled = true;
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.addEventListener('load', function () {
        try {
          if (this.status === 429) {
            noteRateLimitResponse({ status: 429 }, url);
            return;
          }
          const ct = this.getResponseHeader('content-type') || '';
          if (WEBAPI_MEDIA_RE.test(url || '')) {
            const blob =
              this.response instanceof Blob ? this.response : new Blob([this.response], { type: ct });
            storeRasterBlob(url, blob, ct, {
              source: 'xhr-webapi',
              questionId: parseQuestionIdFromApiUrl(url),
            }).catch(() => {});
          } else if (ct.startsWith('image/') && !isDecorativeImageUrl(url)) {
            recordNetworkImage(url, ct);
          }
        } catch (e) {
          /* ignore */
        }
      });
      return origOpen.call(this, method, url, ...rest);
    };
  }

  if (!window.__scraperPerfObserverInstalled) {
    window.__scraperPerfObserverInstalled = true;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType !== 'resource') continue;
          const name = entry.name || '';
          if (isSvgSrc(name) || isDecorativeImageUrl(name)) continue;
          if (
            WEBAPI_MEDIA_RE.test(name) ||
            /\.(png|jpe?g|webp|gif)(\?|$)/i.test(name) ||
            name.startsWith('blob:') ||
            entry.initiatorType === 'img'
          ) {
            recordNetworkImage(name, null);
          }
        }
      }).observe({ type: 'resource', buffered: true });
    } catch (e) {
      /* ignore */
    }
  }

  window.__fetchHookInstalled = true;
}

function installImageCaptureHooks() {
  if (window.__textOnlyMode) return;
  installBlobCaptureHook();
  if (!window.__lightImageMode) installFetchImageHooks();
}

function hasMedicalViewer() {
  const imgs = [...document.querySelectorAll('img[alt]')];
  const alts = new Set(imgs.map((i) => (i.alt || '').trim().toLowerCase()));
  return alts.has('invert') && alts.has('contrast') && alts.has('zoom');
}

function queryAllDeep(root, selector) {
  const results = [];
  const walk = (node) => {
    if (!node) return;
    if (node.querySelectorAll) {
      results.push(...node.querySelectorAll(selector));
      node.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) walk(el.shadowRoot);
      });
    }
  };
  walk(root);
  return results;
}

function getSearchDocuments() {
  const docs = [document];
  for (const iframe of document.querySelectorAll('iframe')) {
    try {
      if (iframe.contentDocument) docs.push(iframe.contentDocument);
    } catch (e) {
      /* cross-origin iframe */
    }
  }
  return docs;
}

function findViewerRoot() {
  const gallery =
    document.querySelector('.media-gallery-border') ||
    document.querySelector('.media-gallery') ||
    document.querySelector('[class*="media-gallery" i]');
  if (gallery) return gallery;

  const invert = [...document.querySelectorAll('img[alt]')].find(
    (img) => (img.alt || '').trim().toLowerCase() === 'invert'
  );
  if (!invert) return null;

  let el = invert.parentElement;
  for (let depth = 0; depth < 10 && el; depth += 1) {
    const canvases = queryAllDeep(el, 'canvas');
    const bigImg = queryAllDeep(el, 'img').find(
      (img) => !isUiIcon(img) && (img.naturalWidth > 120 || img.width > 120)
    );
    if (canvases.length || bigImg) return el;
    el = el.parentElement;
  }

  return (
    invert.closest('[class*="viewer" i], [class*="image" i], [class*="xray" i], [class*="media" i]') ||
    invert.parentElement?.parentElement?.parentElement ||
    null
  );
}

function waitForImageLoad(img, timeoutMs = 4000) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

async function imgElementToDataUrl(img) {
  await waitForImageLoad(img);
  if (!img.naturalWidth || !img.naturalHeight) return null;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    return {
      mediaType: 'image/png',
      dataUrl,
      isImage: true,
      method: 'canvas-draw',
    };
  } catch (e) {
    return null;
  }
}

function canvasHasContent(canvas) {
  if (!canvas || canvas.width < 80 || canvas.height < 80) return false;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return true;
    const sampleW = Math.min(canvas.width, 48);
    const sampleH = Math.min(canvas.height, 48);
    const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
    let nonTransparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) nonTransparent += 1;
    }
    return nonTransparent > sampleW * sampleH * 0.05;
  } catch (e) {
    return canvas.width >= 100 && canvas.height >= 100;
  }
}

async function captureCanvasElement(canvas, source = 'canvas') {
  const rect = canvas.getBoundingClientRect();
  try {
    const dataUrl = canvas.toDataURL('image/png');
    return {
      type: 'canvas',
      source,
      mediaType: 'image/png',
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      displayWidth: Math.round(rect.width),
      displayHeight: Math.round(rect.height),
      isImage: true,
    };
  } catch (e) {
    return { type: 'canvas', source, error: e.message, isImage: false };
  }
}

function collectPerformanceImageUrls() {
  const urls = [];
  for (const entry of performance.getEntriesByType('resource')) {
    const name = entry.name || '';
    if (isSvgSrc(name)) continue;
    if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(name) || entry.initiatorType === 'img') {
      urls.push(name);
    }
  }
  return urls;
}

function collectNetworkImageUrls() {
  const q = getCurrentQuestionNumber();
  const questionId = getCurrentQuestionId();
  const urls = new Set();

  for (const entry of __imageUrlStore.values()) {
    if (entry.questionNumber === q || entry.questionNumber === null) urls.add(entry.url);
  }

  if (questionId && __questionMediaStore.has(String(questionId))) {
    urls.add(__questionMediaStore.get(String(questionId)).url);
  }

  for (const [blobUrl] of __blobStore) urls.add(blobUrl);

  for (const url of collectPerformanceImageUrls()) urls.add(url);

  if (hasMedicalViewer()) {
    const gallery = findViewerRoot();
    if (gallery) {
      for (const url of scrapeUrlsFromHtml(gallery)) urls.add(url);
      for (const url of collectSvgImageUrls(gallery)) urls.add(url);
      for (const img of queryAllDeep(gallery, 'img')) {
        const src = img.currentSrc || img.src;
        if (src && !isUiIcon(img)) urls.add(src);
      }
    }
  }

  return [...urls].filter((url) => url && !isSvgSrc(url) && isLikelyClinicalUrl(url));
}

function scrapeUrlsFromHtml(root) {
  const urls = new Set();
  const html = root.innerHTML || '';
  for (const match of html.matchAll(
    /(?:src|href|xlink:href)=["']([^"']+)["']/gi
  )) {
    const url = match[1];
    if (isSvgSrc(url)) continue;
    if (
      url.startsWith('blob:') ||
      url.startsWith('data:image/') ||
      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) ||
      /media|image|photo|xray|x-ray|attachment|asset|content|gallery/i.test(url)
    ) {
      urls.add(url);
    }
  }
  return [...urls];
}

function collectSvgImageUrls(root) {
  const urls = [];
  for (const el of queryAllDeep(root, 'image, svg image')) {
    const href =
      el.getAttribute('href') ||
      el.getAttribute('xlink:href') ||
      el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    if (href && !isSvgSrc(href)) urls.push(href);
  }
  return urls;
}

function sniffImageMediaType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp';
  }
  return null;
}

function findEmbeddedDataUrls(root) {
  const found = [];
  const html = root.innerHTML || '';
  for (const match of html.matchAll(/data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+/g)) {
    found.push(match[0]);
  }
  return found;
}

function collectLazyImageUrls(root) {
  const urls = [];
  for (const el of queryAllDeep(root, '[data-src],[data-original],[data-image],[data-url],[data-img],[data-lazy-src]')) {
    for (const attr of LAZY_ATTRS) {
      const val = el.getAttribute(attr);
      if (val && !isSvgSrc(val)) urls.push(val);
    }
  }
  for (const el of queryAllDeep(root, 'picture source[srcset], img[srcset]')) {
    const srcset = el.getAttribute('srcset') || '';
    for (const part of srcset.split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (url && !isSvgSrc(url)) urls.push(url);
    }
  }
  return urls;
}

async function waitForViewerImages(timeoutMs = 3000) {
  if (!hasMedicalViewer()) return [];
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    const images = await extractImages({ skipWait: true });
    if (images.length > 0) return images;
    await new Promise((r) => setTimeout(r, 120));
  }
  return extractImages({ skipWait: true });
}

function getVisibleBlobImgElements() {
  const roots = [findViewerRoot(), ...getImageRoots()].filter(Boolean);
  const seen = new Set();
  const imgs = [];
  for (const root of roots) {
    for (const img of queryAllDeep(root, 'img')) {
      if (isUiIcon(img)) continue;
      const src = img.currentSrc || img.src || '';
      if (!src.startsWith('blob:') || seen.has(src)) continue;
      seen.add(src);
      imgs.push(img);
    }
  }
  return imgs;
}

function blobUuid(url) {
  const m = String(url || '').match(/blob:[^/]+\/([0-9a-f-]{8,})/i);
  return m ? m[1].slice(0, 13) + '…' : (url || '').slice(0, 20);
}

async function extractCachedQuestionMedia(seen) {
  const images = [];
  const questionId = getCurrentQuestionId();
  const qNum = getCurrentQuestionNumber();

  const candidates = [];
  if (questionId && __questionMediaStore.has(String(questionId))) {
    candidates.push(__questionMediaStore.get(String(questionId)));
  }
  for (const entry of __questionMediaStore.values()) {
    if (entry.questionNumber === qNum && !candidates.includes(entry)) candidates.push(entry);
  }

  if (!candidates.length && questionId && hasMedicalViewer()) {
    const apiUrl = `${location.origin}/getQuestionMedia.webapi?question_id=${encodeURIComponent(questionId)}`;
    const payload = await srcToImagePayload(apiUrl);
    if (payload?.dataUrl && __questionMediaStore.has(String(questionId))) {
      candidates.push(__questionMediaStore.get(String(questionId)));
    } else if (payload?.dataUrl) {
      candidates.push({
        url: apiUrl,
        dataUrl: payload.dataUrl,
        mediaType: payload.mediaType,
        questionId,
        questionNumber: qNum,
        source: 'webapi-fetch-fallback',
      });
    }
  }

  for (const entry of candidates) {
    if (!entry?.dataUrl || seen.has(entry.dataUrl)) continue;
    seen.add(entry.dataUrl);
    if (entry.url) seen.add(entry.url);
    images.push({
      type: 'webapi-cache',
      source: entry.source || 'webapi',
      src: entry.url,
      mediaType: entry.mediaType,
      dataUrl: entry.dataUrl,
      size: entry.size,
      questionId: entry.questionId,
      isImage: true,
      method: 'webapi-hook',
    });
  }

  const gallery = findViewerRoot();
  const blobImgs = getVisibleBlobImgElements();
  if (!blobImgs.length && gallery) {
    blobImgs.push(...queryAllDeep(gallery, 'img').filter((img) => !isUiIcon(img)));
  }

  for (const img of blobImgs) {
    const src = img.currentSrc || img.src;
    if (!src?.startsWith('blob:')) continue;
    const key = 'blob|' + src;
    if (seen.has(key)) continue;

    let payload = null;
    if (__blobStore.has(src)) {
      const cached = __blobStore.get(src);
      payload = {
        mediaType: cached.mediaType,
        dataUrl: cached.dataUrl,
        isImage: true,
        method: 'blob-hook',
      };
    }
    if (!payload?.dataUrl) payload = await imgElementToDataUrl(img);
    if (!payload?.dataUrl) continue;

    seen.add(key);
    seen.add(src);
    seen.add(payload.dataUrl);
    images.push({
      type: 'blob-img',
      source: 'gallery-blob',
      alt: img.alt || '',
      width: img.naturalWidth,
      height: img.naturalHeight,
      src,
      ...payload,
      isImage: true,
    });
  }

  return images;
}

async function extractGalleryImages(seen) {
  const images = [];
  const gallery = findViewerRoot();
  if (!gallery) return images;

  for (const img of queryAllDeep(gallery, 'img')) {
    if (isUiIcon(img)) continue;
    const src = img.currentSrc || img.src;
    if (!src || isSvgSrc(src)) continue;
    const key = src + '|' + img.naturalWidth + 'x' + img.naturalHeight;
    if (seen.has(key)) continue;

    let payload = await imgElementToDataUrl(img);
    if (!payload?.dataUrl) payload = await srcToImagePayload(src);
    if (!payload?.dataUrl) continue;

    seen.add(key);
    seen.add(src);
    if (payload.dataUrl) seen.add(payload.dataUrl);

    images.push({
      type: 'gallery-img',
      source: 'media-gallery-border',
      alt: img.alt || '',
      width: img.naturalWidth,
      height: img.naturalHeight,
      src,
      ...payload,
      isImage: true,
    });
  }

  for (const el of queryAllDeep(gallery, '*')) {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none') continue;
    for (const match of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const url = match[1];
      if (isSvgSrc(url) || seen.has(url)) continue;
      seen.add(url);
      const payload = await srcToImagePayload(url);
      if (!payload?.dataUrl) continue;
      images.push({
        type: 'gallery-bg',
        source: 'media-gallery-border',
        src: url,
        ...payload,
        isImage: true,
      });
    }
  }

  return images;
}

async function extractLargeQuestionImages(seen) {
  const images = [];
  for (const root of getImageRoots()) {
    for (const img of queryAllDeep(root, 'img')) {
      if (isUiIcon(img)) continue;
      await waitForImageLoad(img);
      if (img.naturalWidth < 150 && img.naturalHeight < 150) continue;

      const src = img.currentSrc || img.src;
      if (!src || isSvgSrc(src)) continue;
      const key = 'large|' + src;
      if (seen.has(key)) continue;

      let payload = await imgElementToDataUrl(img);
      if (!payload?.dataUrl) payload = await srcToImagePayload(src);
      if (!payload?.dataUrl) continue;

      seen.add(key);
      seen.add(src);
      images.push({
        type: 'large-img',
        source: 'question-area',
        alt: img.alt || '',
        width: img.naturalWidth,
        height: img.naturalHeight,
        src,
        ...payload,
        isImage: true,
      });
    }
  }
  return images;
}

async function extractViewerImages(seen) {
  const images = [];
  images.push(...(await extractCachedQuestionMedia(seen)));
  images.push(...(await extractGalleryImages(seen)));
  images.push(...(await extractLargeQuestionImages(seen)));

  const viewerRoot = findViewerRoot();
  const searchRoots = [viewerRoot, ...getImageRoots()].filter(Boolean);

  for (const root of searchRoots) {
    for (const canvas of queryAllDeep(root, 'canvas')) {
      if (canvas.closest('button, [role="button"]')) continue;
      if (!canvasHasContent(canvas)) continue;
      const captured = await captureCanvasElement(canvas, 'viewer-canvas');
      if (!captured.dataUrl || seen.has(captured.dataUrl)) continue;
      seen.add(captured.dataUrl);
      images.push(captured);
    }

    for (const url of collectLazyImageUrls(root)) {
      if (seen.has(url)) continue;
      seen.add(url);
      const payload = await srcToImagePayload(url);
      if (!payload?.isImage || !payload.dataUrl) continue;
      images.push({ type: 'lazy', source: 'data-attr', ...payload });
    }

    for (const dataUrl of findEmbeddedDataUrls(root)) {
      if (seen.has(dataUrl)) continue;
      seen.add(dataUrl);
      const payload = await srcToImagePayload(dataUrl);
      if (!payload?.isImage || !payload.dataUrl) continue;
      images.push({ type: 'embedded', source: 'html-data-url', ...payload });
    }
  }

  for (const url of collectNetworkImageUrls()) {
    if (seen.has(url)) continue;
    seen.add(url);
    const payload = await srcToImagePayload(url);
    if (!payload?.isImage || !payload.dataUrl) continue;
    images.push({ type: 'network', source: 'fetch-hook', src: url, ...payload });
  }

  return images.filter((img) => !isDecorativeImageUrl(img.src));
}

function isSvgMediaType(mediaType) {
  return String(mediaType || '').toLowerCase().includes('svg');
}

function isSvgSrc(src) {
  const s = String(src || '').toLowerCase();
  return s.includes('svg+xml') || s.endsWith('.svg') || s.includes('image/svg');
}

function isRasterMediaType(mediaType) {
  const mt = String(mediaType || '').toLowerCase();
  if (isSvgMediaType(mt)) return false;
  return RASTER_PREFIXES.some((prefix) => mt.startsWith(prefix));
}

function isDecorativeImageUrl(url) {
  if (!url) return true;
  const s = String(url);
  if (DECORATIVE_URL_RE.test(s)) return true;
  if (UI_ASSET_RE.test(s)) return true;
  if (/doctor\.png|nurse\.png|psychqb|placeholder|favicon|calculator-icon|pause-icon|stop-icon|reverse-color-icon/i.test(s)) {
    return true;
  }
  return false;
}

function isLikelyClinicalUrl(url) {
  if (!url || isSvgSrc(url) || isDecorativeImageUrl(url)) return false;
  if (WEBAPI_MEDIA_RE.test(url)) return true;
  if (url.startsWith('blob:') || url.startsWith('data:image/')) return true;

  const gallery = findViewerRoot();
  if (gallery) {
    const html = gallery.innerHTML || '';
    if (html.includes(url) || html.includes(url.split('?')[0])) return true;
  }

  if (/getquestionmedia|getmultipleanswermedia|xray|x-ray|dicom|study|attachment|upload/i.test(url)) {
    return true;
  }

  // Site chrome under /images/ or hashed /assets/ bundles — not clinical media
  if (/qb\.ccscases\.com\/images\//i.test(url)) return false;
  if (/qb\.ccscases\.com\/assets\//i.test(url)) return false;

  return false;
}

function isUiIcon(el) {
  const alt = (el.alt || '').trim().toLowerCase();
  if (UI_ICON_ALTS.has(alt)) return true;
  if (isSvgSrc(el.src)) return true;
  if (
    el.closest(
      'button, [role="button"], .toolbar, [class*="toolbar" i], [class*="tool-" i], [class*="controls" i]'
    )
  ) {
    return true;
  }
  return false;
}

function isRasterImage(item) {
  if (!item?.dataUrl) return false;
  if (item.type === 'canvas') return true;
  if (isSvgSrc(item.dataUrl) || isSvgSrc(item.src)) return false;
  return item.isImage === true || isRasterMediaType(item.mediaType);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function srcToImagePayload(src) {
  if (!src) return null;
  if (src.startsWith('data:image/')) {
    const mediaType = src.slice(5, src.indexOf(';'));
    const isRaster = isRasterMediaType(mediaType);
    return { mediaType, dataUrl: src, isImage: isRaster };
  }
  if (isSvgSrc(src)) {
    return { src, mediaType: 'image/svg+xml', isImage: false };
  }
  if (isDecorativeImageUrl(src)) {
    return { src, mediaType: 'skipped', isImage: false, error: 'decorative' };
  }

  if (src.startsWith('blob:') && !__blobStore.has(src)) {
    return { src, error: 'blob-not-cached', isImage: false };
  }

  if (__blobStore.has(src)) {
    const cached = __blobStore.get(src);
    return {
      src,
      mediaType: cached.mediaType,
      dataUrl: cached.dataUrl,
      isImage: true,
      method: 'blob-cache',
    };
  }

  const qid = normalizeQuestionId(parseQuestionIdFromApiUrl(src) || getCurrentQuestionId());
  if (qid && __questionMediaStore.has(String(qid))) {
    const cached = __questionMediaStore.get(String(qid));
    if (cached.dataUrl) {
      return {
        src,
        mediaType: cached.mediaType,
        dataUrl: cached.dataUrl,
        isImage: true,
        method: 'webapi-cache',
      };
    }
  }

  if (WEBAPI_MEDIA_RE.test(src)) {
    if (isRateLimited()) {
      return { src, error: 'rate-limited', isImage: false };
    }
    try {
      const resp = await scraperFetch(src, { credentials: 'include' });
      if (noteRateLimitResponse(resp, src)) {
        return { src, error: 'rate-limited', isImage: false };
      }
      const blob = await resp.blob();
      const stored = await storeRasterBlob(src, blob, resp.headers.get('content-type'), {
        source: 'webapi-fetch',
        questionId: parseQuestionIdFromApiUrl(src),
      });
      if (stored?.dataUrl) {
        return {
          src,
          mediaType: stored.mediaType,
          dataUrl: stored.dataUrl,
          isImage: true,
          method: 'webapi-fetch',
        };
      }
    } catch (e) {
      return { src, error: e.message };
    }
  }

  if (isRateLimited()) {
    return { src, error: 'rate-limited', isImage: false };
  }

  try {
    const resp = await scraperFetch(src, { credentials: 'include' });
    const blob = await resp.blob();
    let mediaType = blob.type || resp.headers.get('content-type') || 'unknown';
    mediaType = mediaType.split(';')[0].trim();

    if (!mediaType.startsWith('image/') || mediaType === 'image/svg+xml') {
      const buf = new Uint8Array(await blob.arrayBuffer());
      const sniffed = sniffImageMediaType(buf);
      if (sniffed) mediaType = sniffed;
      else return { src, mediaType, isImage: false };
    }

    const isRaster = isRasterMediaType(mediaType);
    if (!isRaster) {
      return { src, mediaType, isImage: false };
    }
    return { src, mediaType, dataUrl: await blobToDataUrl(blob), isImage: true, method: 'fetch' };
  } catch (e) {
    return { src, error: e.message };
  }
}

function collectBackgroundImageUrls(root) {
  const urls = [];
  for (const el of root.querySelectorAll('*')) {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none') continue;
    for (const match of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const url = match[1];
      if (!isSvgSrc(url)) urls.push({ url, source: 'background-image' });
    }
  }
  return urls;
}

async function extractImages(options = {}) {
  installImageCaptureHooks();
  if (!options.skipWait && hasMedicalViewer()) {
    await new Promise((r) => setTimeout(r, 400));
  }

  const roots = getImageRoots();
  const seen = new Set();
  const images = [];

  for (const root of roots) {
    const nodes = queryAllDeep(root, 'img, canvas');
    for (const el of nodes) {
      if (el.closest('.test-header, .tools, .test-footer-wrapper, .nav-buttons')) continue;

      if (el.tagName === 'IMG') {
        const src = el.currentSrc || el.src;
        if (!src || seen.has(src) || isUiIcon(el) || isDecorativeImageUrl(src)) continue;
        seen.add(src);

        let payload = null;
        if (src.startsWith('blob:') || (el.naturalWidth >= 150 && el.naturalHeight >= 150)) {
          payload = await imgElementToDataUrl(el);
        }
        if (!payload?.dataUrl) payload = await srcToImagePayload(src);
        if (!payload?.isImage || !payload.dataUrl) continue;
        images.push({
          type: 'img',
          alt: el.alt || '',
          width: el.naturalWidth,
          height: el.naturalHeight,
          ...payload,
        });
      } else if (el.tagName === 'CANVAS') {
        if (el.closest('button, [role="button"], .toolbar, [class*="toolbar" i]')) continue;
        if (!canvasHasContent(el)) continue;
        const captured = await captureCanvasElement(el, 'canvas');
        if (!captured.dataUrl || seen.has(captured.dataUrl)) continue;
        seen.add(captured.dataUrl);
        images.push(captured);
      }
    }

    for (const { url, source } of collectBackgroundImageUrls(root)) {
      if (seen.has(url)) continue;
      seen.add(url);
      const payload = await srcToImagePayload(url);
      if (!payload?.isImage || !payload.dataUrl) continue;
      images.push({ type: 'background', source, ...payload });
    }
  }

  if (hasMedicalViewer()) {
    images.push(...(await extractViewerImages(seen)));
  }

  return images.filter(isRasterImage).filter((img) => !isDecorativeImageUrl(img.src));
}

function filterClinicalImages(images) {
  return images
    .filter(isRasterImage)
    .filter((img) => !isDecorativeImageUrl(img.src))
    .filter(
      (img) =>
        !(
          img.method === 'fetch' &&
          img.src &&
          /\/assets\//i.test(img.src) &&
          !img.src.startsWith('blob:')
        )
    );
}

async function enrichWithImagesLight(data) {
  installBlobCaptureHook();
  const viewer = hasMedicalViewer();
  if (!viewer) {
    return {
      ...data,
      hasMedicalViewer: false,
      images: [],
      imageCount: 0,
      hasImages: false,
      pngDataUrls: [],
    };
  }

  await new Promise((r) => setTimeout(r, 1400));
  const seen = new Set();
  const images = [];

  for (const img of getVisibleBlobImgElements()) {
    const src = img.currentSrc || img.src || '';
    if (!src || seen.has(src)) continue;
    let dataUrl = null;
    if (__blobStore.has(src)) dataUrl = __blobStore.get(src).dataUrl;
    if (!dataUrl) {
      const drawn = await imgElementToDataUrl(img);
      if (drawn?.dataUrl) dataUrl = drawn.dataUrl;
      else if (typeof drawn === 'string') dataUrl = drawn;
    }
    if (!dataUrl) continue;
    seen.add(src);
    seen.add(dataUrl);
    images.push({
      type: 'blob-img',
      source: 'light-dom',
      src,
      mediaType: 'image/png',
      dataUrl,
      isImage: true,
      method: 'canvas-draw',
    });
  }

  const gallery = findViewerRoot();
  if (gallery) {
    for (const canvas of queryAllDeep(gallery, 'canvas')) {
      if (canvas.closest('button, [role="button"]') || !canvasHasContent(canvas)) continue;
      const shot = await captureCanvasElement(canvas);
      if (!shot?.dataUrl || seen.has(shot.dataUrl)) continue;
      seen.add(shot.dataUrl);
      images.push({ type: 'canvas', source: 'light-dom', ...shot, isImage: true });
    }
  }

  if (!images.length && !isRateLimited()) {
    const qid = getCurrentQuestionId();
    if (qid) {
      const apiUrl = `${location.origin}/getQuestionMedia.webapi?question_id=${encodeURIComponent(qid)}`;
      try {
        const resp = await scraperFetch(apiUrl, { credentials: 'include' });
        if (!noteRateLimitResponse(resp, apiUrl) && resp.ok) {
          const blob = await resp.blob();
          const stored = await storeRasterBlob(apiUrl, blob, resp.headers.get('content-type'), {
            source: 'light-webapi-once',
            questionId: qid,
          });
          if (stored?.dataUrl) {
            images.push({
              type: 'webapi-once',
              source: 'light-webapi-once',
              src: apiUrl,
              mediaType: stored.mediaType,
              dataUrl: stored.dataUrl,
              isImage: true,
              method: 'webapi-fetch',
            });
          }
        }
      } catch (e) {
        /* skip */
      }
    }
  }

  const pngImages = filterClinicalImages(images);
  return {
    ...data,
    hasMedicalViewer: viewer,
    images: pngImages,
    imageCount: pngImages.length,
    hasImages: pngImages.length > 0,
    pngDataUrls: pngImages.map((i) => ({
      mediaType: i.mediaType,
      alt: i.alt || null,
      type: i.type || null,
      source: i.source || null,
      dataUrl: i.dataUrl,
    })),
  };
}

async function enrichWithImages(data) {
  if (window.__lightImageMode) return enrichWithImagesLight(data);
  installImageCaptureHooks();
  if (hasMedicalViewer()) {
    await waitForViewerImages(3000);
  }
  const images = await extractImages({ skipWait: true });
  const pngImages = filterClinicalImages(images);
  return {
    ...data,
    hasMedicalViewer: hasMedicalViewer(),
    images: pngImages,
    imageCount: pngImages.length,
    hasImages: pngImages.length > 0,
    pngDataUrls: pngImages.map((i) => ({
      mediaType: i.mediaType,
      alt: i.alt || null,
      type: i.type || null,
      source: i.source || null,
      dataUrl: i.dataUrl,
    })),
  };
}

async function captureBurst(intervalMs = 50, durationMs = 900) {
  if (hasMedicalViewer()) durationMs = Math.max(durationMs, 2500);
  const snapshots = [];
  const t0 = performance.now();

  while (performance.now() - t0 <= durationMs) {
    snapshots.push({
      msAfterClick: Math.round(performance.now() - t0),
      ...extractPageDataSync(),
    });
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return snapshots;
}

function pickBestSnapshot(snapshots) {
  return (
    snapshots.find((s) => s.hasReveal || s.hasImages) ||
    snapshots.reduce((best, s) =>
      s.fullText.length > best.fullText.length ? s : best
    )
  );
}

function slimPageForExport(page) {
  return {
    step: page.step,
    action: page.action,
    status: page.status,
    revealCaptured: page.revealCaptured,
    revealAtMs: page.revealAtMs,
    advancedTo: page.advancedTo,
    stuckOnQuestion: page.stuckOnQuestion,
    capturedAt: page.capturedAt,
    questionId: page.questionId,
    questionNumber: page.questionNumber,
    question: page.question,
    answers: page.answers?.map(
      ({ letter, text, hasImage, selected, flagged, struck, likelyCorrect, likelyIncorrect, votePercent }) => ({
        letter,
        text,
        hasImage,
        selected,
        flagged,
        struck,
        likelyCorrect,
        likelyIncorrect,
        votePercent,
      })
    ),
    explanation: page.explanation,
    likelyCorrectAnswer: page.likelyCorrectAnswer,
    hasReveal: page.hasReveal,
    hasSelection: page.hasSelection,
    hasCheckmarks: page.hasCheckmarks,
    flagged: page.flagged,
    hasMedicalViewer: page.hasMedicalViewer,
    imageCount: page.imageCount,
    hasImages: page.hasImages,
    images: page.images?.map(({ type, source, alt, width, height, mediaType, src, method }) => ({
      type,
      source,
      alt,
      width,
      height,
      mediaType,
      src: src ? String(src).slice(0, 200) : null,
      method,
    })),
    pngDataUrls: page.pngDataUrls,
    screenshot: page.screenshot
      ? {
          width: page.screenshot.width,
          height: page.screenshot.height,
          method: page.screenshot.method,
          file: screenshotFilename(page),
        }
      : undefined,
    hasScreenshot: page.hasScreenshot,
  };
}

function prepareExportPayload(output, options = {}) {
  const keepDebug = options.keepDebug ?? false;
  return {
    scrapedAt: output.scrapedAt,
    scraperVersion: SCRAPER_VERSION,
    direction: output.direction,
    totalClicks: output.totalClicks,
    pageCount: output.pageCount,
    summary: output.summary,
    pages: keepDebug ? output.pages : output.pages.map(slimPageForExport),
  };
}

function stripInlineImages(payload) {
  const stripped = {
    ...payload,
    pages: payload.pages.map((page) => ({
      ...page,
      pngDataUrls: undefined,
      images: page.images?.map(({ dataUrl, ...rest }) => rest),
    })),
  };
  stripped.summary = {
    ...stripped.summary,
    exportNote: 'Inline PNG data omitted — JSON was too large to stringify',
  };
  return stripped;
}

function downloadJson(data, filename = 'scrape-output.json', options = {}) {
  const pretty = options.pretty ?? false;
  let payload = data;
  let json;

  try {
    json = pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
  } catch (e) {
    console.warn('Export too large — retrying compact slim JSON:', e.message);
    payload = prepareExportPayload(data, { keepDebug: false });
    json = JSON.stringify(payload);
  }

  try {
    if (!json) throw new Error('empty json');
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return { json, payload, bytes: json.length, stripped: false };
  } catch (e) {
    console.warn('Download still too large — saving text-only JSON:', e.message);
    payload = stripInlineImages(prepareExportPayload(data, { keepDebug: false }));
    json = JSON.stringify(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.replace(/\.json$/i, '-text-only.json');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return { json, payload, bytes: json.length, stripped: true };
  }
}

async function copyJson(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.warn('Clipboard copy skipped — use the downloaded JSON file.');
    return false;
  }
}

function getCurrentQuestionNumber() {
  const num = document.querySelector('.item-block')?.innerText?.trim() || '';
  const current = parseInt(num.split('/')[0], 10);
  return Number.isFinite(current) ? current : null;
}

function parseQuestionNumber(str) {
  const n = parseInt((str || '').split('/')[0], 10);
  return Number.isFinite(n) ? n : null;
}

async function waitForQuestionChange(fromQ, timeoutMs = 5000) {
  if (fromQ === null) return getCurrentQuestionNumber();
  const t0 = performance.now();
  const pollMs = isRateLimited() ? 250 : 120;
  while (performance.now() - t0 < timeoutMs) {
    if (isRateLimited()) await scraperPause('waiting for question change');
    const cur = getCurrentQuestionNumber();
    if (cur !== null && cur !== fromQ) return cur;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return getCurrentQuestionNumber();
}

async function advanceAfterCapture(fromQ) {
  const cur = getCurrentQuestionNumber();
  if (cur === fromQ) {
    const proceed = document.querySelector('.button-container-light button');
    if (proceed) {
      if (window.__humanMode) {
        await new Promise((r) => setTimeout(r, randBetween(window.__humanProceed.beforeMs)));
      }
      proceed.click();
      console.log('  → Proceed to next item');
      const afterMs = window.__humanMode
        ? randBetween(window.__humanProceed.afterMs)
        : 700;
      await new Promise((r) => setTimeout(r, afterMs));
    }
  }
  await scraperPause('after proceed');
  return waitForQuestionChange(fromQ, isRateLimited() ? 12000 : 8000);
}

async function goToQuestion(target = 1, delayMs = 200) {
  for (let guard = 0; guard < 100; guard++) {
    const current = getCurrentQuestionNumber();
    if (current === target) {
      console.log(`At question ${target}`);
      return current;
    }
    if (current === null) return null;

    const btn = document.querySelector(
      current > target ? '.previous-button' : '.next-button'
    );
    if (!btn) return current;

    btn.click();
    const waitMs = window.__humanMode ? randInt(Math.max(300, delayMs), Math.max(600, delayMs + 500)) : delayMs;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return getCurrentQuestionNumber();
}

function buildSummary(pages) {
  const missedReveals = [];
  const missedImages = [];
  const freshQuestions = [];
  const emptyQuestions = [];
  let prevQ = null;

  for (const page of pages) {
    const qNum = parseInt((page.questionNumber || '').split('/')[0], 10);

    if (!page.question?.trim() && !page.hasImages) {
      emptyQuestions.push({
        step: page.step,
        questionNumber: page.questionNumber,
        questionId: page.questionId,
        issue: 'empty_question',
      });
    }

    if (page.looksFresh && page.step > 0) {
      freshQuestions.push({
        step: page.step,
        questionNumber: page.beforeClick?.questionNumber || page.questionNumber,
        questionId: page.beforeClick?.questionId || page.questionId,
        issue: 'no_checkmarks_or_reveal',
      });
    }

    if (page.step > 0 && !page.revealCaptured) {
      missedReveals.push({
        step: page.step,
        questionNumber: page.questionNumber,
        questionId: page.questionId,
        questionPreview: (page.question || '').slice(0, 80),
        issue: 'no_reveal',
      });
    }

    const hadViewer = page.beforeClick?.hasMedicalViewer || page.hasMedicalViewer;
    const clinicalCount = page.beforeClick?.imageCount ?? page.imageCount ?? 0;
    if (page.step > 0 && hadViewer && clinicalCount === 0) {
      missedImages.push({
        step: page.step,
        questionNumber: page.questionNumber,
        questionId: page.questionId,
        issue: 'viewer_no_clinical_png',
      });
    }

    if (Number.isFinite(qNum) && prevQ !== null && qNum !== prevQ + 1 && qNum !== prevQ) {
      emptyQuestions.push({
        step: page.step,
        questionNumber: page.questionNumber,
        issue: 'skipped_or_stuck',
        expected: prevQ + 1,
        got: qNum,
      });
    }
    if (Number.isFinite(qNum)) prevQ = qNum;
  }

  const clicksWithReveal = pages.filter((p) => p.step > 0 && p.revealCaptured).length;
  const clicksWithoutReveal = pages.filter((p) => p.step > 0 && !p.revealCaptured).length;
  const totalImages = pages.reduce((n, p) => n + (p.imageCount || 0), 0);

  const uniqueQuestions = [
    ...new Set(
      pages.map((p) => parseQuestionNumber(p.questionNumber)).filter(Number.isFinite)
    ),
  ].sort((a, b) => a - b);

  const lastPage = pages[pages.length - 1];
  const endedOn =
    lastPage?.advancedTo ??
    parseQuestionNumber(
      lastPage?.afterClick?.questionNumber || lastPage?.questionNumber
    );
  const totalInBlock = parseInt((pages[0]?.questionNumber || '').split('/')[1], 10);

  return {
    totalPages: pages.length,
    questionsScraped: pages.length,
    uniqueQuestionsCaptured: uniqueQuestions.length,
    uniqueQuestionNumbers: uniqueQuestions,
    startedOn: uniqueQuestions[0] ?? null,
    endedOn,
    expectedEnd: Number.isFinite(totalInBlock) ? totalInBlock : null,
    navigationComplete: endedOn !== null && Number.isFinite(totalInBlock) && endedOn >= totalInBlock,
    revealsCaptured: clicksWithReveal,
    revealsMissed: clicksWithoutReveal,
    freshLooking: freshQuestions.length,
    totalPngCaptured: totalImages,
    missedReveals,
    missedImages,
    freshQuestions,
    otherIssues: emptyQuestions,
    allRevealsCaptured: clicksWithoutReveal === 0,
  };
}

function printSummary(summary) {
  console.log('\n========== SCRAPE SUMMARY ==========');
  if (summary.elapsedMs != null) {
    console.log(`Elapsed:          ${summary.elapsedFormatted} (${summary.avgPerQuestionFormatted || '?'}/Q)`);
    if (summary.targetMinutes) {
      console.log(`Target:           ${summary.targetMinutes} min (${summary.onBudget ? 'on budget ✓' : 'over budget'})`);
    }
  }
  console.log(`Questions saved:  ${summary.questionsScraped}`);
  console.log(`Unique Qs:        ${summary.uniqueQuestionsCaptured} (Q${summary.startedOn} → Q${summary.endedOn})`);
  if (summary.expectedEnd && summary.endedOn < summary.expectedEnd) {
    console.warn(`⚠ Stopped early — expected Q${summary.expectedEnd}, got Q${summary.endedOn}`);
    console.warn('  Cause: Next shows reveal but needs "Proceed to next item" — now fixed in script');
  }
  console.log(`Reveals captured: ${summary.revealsCaptured}`);
  console.log(`Reveals MISSED:   ${summary.revealsMissed}`);
  console.log(`PNG images saved: ${summary.totalPngCaptured}`);

  console.log(`Fresh (no marks): ${summary.freshLooking}`);

  if (summary.freshQuestions.length) {
    console.log('\nLook fresh — likely missed reveal/checkmarks:');
    console.table(summary.freshQuestions);
  }
  if (summary.missedReveals.length) {
    console.log('\nMissed reveals:');
    console.table(summary.missedReveals);
  }
  if (summary.missedImages.length) {
    console.log('\nViewer questions with no clinical PNG (x-ray missed):');
    console.table(summary.missedImages);
  }
  if (summary.otherIssues.length) {
    console.log('\nOther issues:');
    console.table(summary.otherIssues);
  }
  console.log('====================================\n');
}

async function scrapeRest(fromQ = 49, toQ = 50, burstMs = 1200) {
  setJsonScrapeMode();
  const times = toQ - fromQ + 1;
  const filename = `scrape-output-q${fromQ}-${toQ}.json`;
  console.log(`Scraping Q${fromQ}–Q${toQ} → ${filename}`);
  await goToQuestion(fromQ, 200);
  return clickNav('next', times, burstMs, 50, filename);
}

async function ayText(questionCount = 50, totalMinutes = 15, options = {}) {
  setTextOnlyMode();
  const budget = applyTimingBudget(computeTimingBudget(questionCount, totalMinutes));
  logTimingBudget(budget);
  return scrapeTextOnly(questionCount, budget.burstMs, { ...options, budget });
}

async function embedImagesInHtmlClone(liveRoot, cloneRoot) {
  let embedded = 0;
  let missed = 0;

  const liveImgs = queryAllDeep(liveRoot, 'img').filter((img) => !isUiIcon(img));
  const cloneImgs = queryAllDeep(cloneRoot, 'img').filter((img) => !isUiIcon(img));

  for (let i = 0; i < liveImgs.length; i++) {
    const live = liveImgs[i];
    const clone = cloneImgs[i];
    if (!clone) continue;
    const src = live.currentSrc || live.src || '';
    if (!src || isDecorativeImageUrl(src)) continue;

    let payload = null;
    if (src.startsWith('blob:') || live.naturalWidth >= 80) {
      payload = await imgElementToDataUrl(live);
    }
    if (!payload && __blobStore.has(src)) payload = __blobStore.get(src).dataUrl;
    if (!payload) {
      const resolved = await srcToImagePayload(src);
      payload = resolved?.dataUrl;
    }
    if (payload) {
      clone.setAttribute('src', payload);
      embedded += 1;
    } else if (src.startsWith('blob:')) {
      missed += 1;
    }
  }

  const liveCanvases = queryAllDeep(liveRoot, 'canvas').filter(
    (c) => !c.closest('button, [role="button"]') && canvasHasContent(c)
  );
  const cloneCanvases = queryAllDeep(cloneRoot, 'canvas').filter(
    (c) => !c.closest('button, [role="button"]')
  );

  for (let i = 0; i < liveCanvases.length; i++) {
    const shot = await captureCanvasElement(liveCanvases[i]);
    const cloneCanvas = cloneCanvases[i];
    if (!shot?.dataUrl || !cloneCanvas) continue;
    const img = document.createElement('img');
    img.src = shot.dataUrl;
    img.width = liveCanvases[i].width;
    img.height = liveCanvases[i].height;
    if (cloneCanvas.className) img.className = cloneCanvas.className;
    if (cloneCanvas.getAttribute('style')) img.setAttribute('style', cloneCanvas.getAttribute('style'));
    cloneCanvas.replaceWith(img);
    embedded += 1;
  }

  if (missed > 0 && hasMedicalViewer()) {
    const qid = getCurrentQuestionId();
    const apiUrl = `${location.origin}/getQuestionMedia.webapi?question_id=${encodeURIComponent(qid)}`;
    const resolved = await srcToImagePayload(apiUrl);
    if (resolved?.dataUrl) {
      for (const clone of cloneImgs) {
        const src = clone.getAttribute('src') || '';
        if (src.startsWith('blob:') || !src.startsWith('data:image/')) {
          clone.setAttribute('src', resolved.dataUrl);
          embedded += 1;
        }
      }
    }
  }

  return { embedded, missed };
}

async function buildQuestionHtmlSnapshot(options = {}) {
  const test = document.querySelector('#test');
  const meta = lightMeta();
  const q = parseQuestionNumber(meta.questionNumber) || 0;
  const id = normalizeQuestionId(meta.questionId) || 'unknown';

  if (options.imageWaitMs !== 0) {
    await new Promise((r) => setTimeout(r, options.imageWaitMs ?? 700));
  }

  const clone = test ? test.cloneNode(true) : null;
  let imageStats = { embedded: 0, missed: 0 };
  if (test && clone && typeof embedImagesInHtmlClone === 'function') {
    imageStats = await embedImagesInHtmlClone(test, clone);
  }

  const css = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map((l) => `<link rel="stylesheet" href="${l.href}">`)
    .join('\n');
  const bodyHtml = clone ? clone.outerHTML : document.body.innerHTML;
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>CCSQB Q${q} ID${id}</title>
${css}
</head><body>${bodyHtml}</body></html>`;
  return {
    filename: `ccsqb-q${String(q).padStart(2, '0')}-id${id}.html`,
    html,
    meta,
    imageStats,
  };
}

function downloadHtmlNow(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/** Automated "Save Page As" — one HTML file per question (after reveal). No image API hooks. */
async function saveHtmlBlock(count = 50, totalMinutes = 10, options = {}) {
  setTextOnlyMode();
  window.__scraperAbort = false;
  const budget = applyTimingBudget(computeTimingBudget(count, totalMinutes));
  logTimingBudget(budget);
  const revealWaitMs = options.revealWaitMs ?? budget.burstMs;
  const proceedWaitMs = options.proceedWaitMs ?? 450;
  const manifest = [];
  const t0 = performance.now();

  console.log(`Save HTML block: ${count} files (like Ctrl+S "Webpage, Complete" per question)`);
  console.log('Saves AFTER reveal — includes explanation. X-ray blob: URLs may break offline.');

  for (let i = 1; i <= count; i++) {
    if (window.__scraperAbort) {
      console.warn('Stopped');
      break;
    }
    await scraperPause(`Q${i}`);

    const btn = document.querySelector('.next-button');
    if (!btn) {
      console.error('Next button not found');
      break;
    }

    btn.click();
    console.log(`Next ${i}/${count}…`);
    await new Promise((r) => setTimeout(r, revealWaitMs));

    const snap = await buildQuestionHtmlSnapshot(options);
    downloadHtmlNow(snap.html, snap.filename);
    manifest.push({
      step: i,
      file: snap.filename,
      imagesEmbedded: snap.imageStats?.embedded ?? 0,
      imagesMissed: snap.imageStats?.missed ?? 0,
      ...snap.meta,
    });
    const imgNote =
      snap.imageStats?.embedded > 0
        ? ` | ${snap.imageStats.embedded} img embedded`
        : snap.imageStats?.missed > 0
          ? ' | ⚠ exhibit image missed'
          : '';
    console.log(`  ✓ ${snap.filename}${imgNote} | ${formatElapsed(performance.now() - t0)}`);

    const proceed = document.querySelector('.button-container-light button');
    if (proceed) {
      proceed.click();
      await new Promise((r) => setTimeout(r, proceedWaitMs));
    }

    const fromQ = parseQuestionNumber(snap.meta.questionNumber);
    if (fromQ !== null) await waitForQuestionChange(fromQ, 6000);
  }

  const elapsedMs = Math.round(performance.now() - t0);
  const output = {
    scrapedAt: new Date().toISOString(),
    mode: 'html-save',
    scraperVersion: SCRAPER_VERSION,
    count: manifest.length,
    elapsedFormatted: formatElapsed(elapsedMs),
    files: manifest,
  };
  downloadJson(output, 'ccsqb-html-manifest.json');
  console.log(`Done — ${manifest.length} HTML files in ${formatElapsed(elapsedMs)}`);
  return output;
}

async function ayHtml(questionCount = 50, totalMinutes = 10, options = {}) {
  return saveHtmlBlock(questionCount, totalMinutes, options);
}

async function scrapeTextOnly(questionCount = 50, burstOrMinutes = 2500, options = {}) {
  setTextOnlyMode();

  let burstMs = burstOrMinutes;
  let budget = options.budget || null;

  if (isMinutesBudget(burstOrMinutes)) {
    budget = applyTimingBudget(computeTimingBudget(questionCount, burstOrMinutes));
    burstMs = budget.burstMs;
    logTimingBudget(budget);
  }

  if (budget) {
    console.log(`Text-only JSON: ${questionCount} Q, budget ${budget.totalMinutes} min — no image downloads`);
  } else {
    console.log(`Text-only JSON: ${questionCount} questions — no image hooks, no PNGs`);
  }
  console.log('Output: scrape-text-output.json');

  await goToQuestion(1, humanNavDelay());
  return clickNav(
    'next',
    questionCount,
    burstMs,
    humanIntervalMs(80),
    options.filename || 'scrape-text-output.json',
    { budget, textOnly: true }
  );
}

async function ay(questionCount = 50, totalMinutes = 20, options = {}) {
  window.__lightImageMode = options.heavy ? false : true;
  const budget = applyTimingBudget(computeTimingBudget(questionCount, totalMinutes));
  logTimingBudget(budget);
  if (window.__lightImageMode) {
    console.log('Light image mode — blob hook only, no fetch doubling (safer vs 429)');
  } else {
    console.warn('Heavy image mode — may trigger 429; prefer default ay() or ayText()');
  }
  return scrapeFromOne(questionCount, budget.burstMs, { ...options, budget, keepMode: false });
}

async function scrapeFromOne(questionCount = 50, burstOrMinutes = 2500, options = {}) {
  if (!options.keepMode) {
    setJsonScrapeMode({ light: window.__lightImageMode !== false });
  }

  let burstMs = burstOrMinutes;
  let budget = options.budget || null;

  if (isMinutesBudget(burstOrMinutes)) {
    budget = applyTimingBudget(computeTimingBudget(questionCount, burstOrMinutes));
    burstMs = budget.burstMs;
    logTimingBudget(budget);
  }

  if (!budget) {
    const perQ = window.__humanMode
      ? (window.__humanPace.minMs + window.__humanPace.maxMs) / 2 + burstMs
      : burstMs + (window.__scraperPaceMs || 0);
    const mode = window.__humanMode ? 'Human JSON scrape' : 'JSON scrape';
    console.log(`${mode}: ${questionCount} questions (~${Math.round((questionCount * perQ) / 60000)} min)...`);
  } else {
    console.log(`JSON scrape: ${questionCount} questions, budget ${budget.totalMinutes} min`);
  }
  console.log('Output: scrape-output.json only (no block-q*.png files)');
  await goToQuestion(1, humanNavDelay());
  return clickNav('next', questionCount, burstMs, humanIntervalMs(80), 'scrape-output.json', { budget });
}

async function scrapeFromOneHuman(questionCount = 50, burstMs = 2500) {
  window.__humanMode = true;
  return scrapeFromOne(questionCount, burstMs);
}

async function scrapeFromOneScreenshot(questionCount = 50, burstMs = 2500) {
  setScreenshotMode();
  window.__humanMode = true;
  console.log('Screenshot mode — no fetch/image hooks; captures visible page only');
  const perQ = (window.__humanPace.minMs + window.__humanPace.maxMs) / 2 + burstMs;
  console.log(`Screenshot scrape: ${questionCount} questions (~${Math.round((questionCount * perQ) / 60000)} min)...`);
  await goToQuestion(1, humanNavDelay());
  return clickNav('next', questionCount, burstMs, humanIntervalMs(80));
}

async function clickNav(direction = 'next', times = 49, burstMs = 900, intervalMs = 50, filename = 'scrape-output.json', runOptions = {}) {
  const selector =
    direction === 'previous' ? '.previous-button' : '.next-button';
  const budget = runOptions.budget || null;
  const t0 = performance.now();

  const pages = [];
  const startData = await enrichPageCapture(extractPageDataSync());
  pages.push({ step: 0, action: 'start', ...startData });
  console.log(
    `Captured step 0 (${startData.hasScreenshot ? 'screenshot' : startData.textOnly ? 'text-only' : `${startData.imageCount || 0} PNGs`})`
  );

  for (let i = 1; i <= times; i++) {
    if (window.__scraperAbort) {
      console.warn('Stopped (__scraperAbort or 429 auto-stop)');
      break;
    }
    await scraperPause('before question');
    if (window.__scraperAbort) break;
    if (!window.__textOnlyMode) {
      await humanMicroBreak();
      await humanDelay('between questions');
    } else if (window.__scraperPaceMs > 0) {
      const jitter = randInt(0, Math.min(2000, Math.floor(window.__scraperPaceMs * 0.25)));
      await new Promise((r) => setTimeout(r, window.__scraperPaceMs + jitter));
    }

    const btn = document.querySelector(selector);
    if (!btn) {
      console.error('Button not found:', selector);
      break;
    }

    const pageSync = extractPageDataSync();
    if (!window.__textOnlyMode) await humanReadDelay(pageSync, 'reading Q');

    // Capture CURRENT question BEFORE click (with your selections / flag)
    const beforeClick = await enrichPageCapture(pageSync);
    const effectiveBurst = window.__textOnlyMode
      ? burstMs
      : hasMedicalViewer()
        ? humanBurstMs(Math.max(burstMs, 2800))
        : humanBurstMs(burstMs);

    if (window.__humanMode && !window.__textOnlyMode) {
      await new Promise((r) => setTimeout(r, randInt(400, 1100)));
    }

    btn.click();
    console.log(`Click ${i}/${times}...`);

    const allSnapshots = await captureBurst(intervalMs, effectiveBurst);
    const first = allSnapshots[0];
    const last = allSnapshots[allSnapshots.length - 1];
    const revealSync = allSnapshots.find((s) => s.hasReveal) || null;
    const reveal =
      revealSync && revealSync !== allSnapshots[0]
        ? window.__screenshotMode || window.__textOnlyMode || window.__lightImageMode
          ? revealSync
          : await enrichWithImages(revealSync)
        : first.hasReveal || first.hasImages
          ? window.__screenshotMode || window.__textOnlyMode || window.__lightImageMode
            ? first
            : await enrichWithImages(first)
          : null;

    const snapshots = [first];
    if (reveal && revealSync && revealSync !== first && revealSync !== last) snapshots.push(revealSync);
    if (last !== first) snapshots.push(last);

    const fromQ = parseQuestionNumber(beforeClick.questionNumber);
    const afterQ = await advanceAfterCapture(fromQ);

    // Primary = question we LEFT; images always from beforeClick (x-ray is on question page)
    const primary = reveal
      ? {
          ...beforeClick,
          ...reveal,
          questionNumber: beforeClick.questionNumber,
          questionId: beforeClick.questionId,
          question: beforeClick.question || reveal.question,
          explanation: reveal.explanation || beforeClick.explanation,
          likelyCorrectAnswer: reveal.likelyCorrectAnswer || beforeClick.likelyCorrectAnswer,
          answers: reveal.answers?.some((a) => a.likelyCorrect || a.votePercent)
            ? reveal.answers
            : beforeClick.answers,
          images: beforeClick.images,
          imageCount: beforeClick.imageCount,
          hasImages: beforeClick.hasImages,
          pngDataUrls: beforeClick.pngDataUrls,
          hasMedicalViewer: beforeClick.hasMedicalViewer,
        }
      : beforeClick;

    pages.push({
      step: i,
      action: `click-${direction}`,
      status: reveal ? 'ok' : beforeClick.hasCheckmarks ? 'partial' : 'missed_reveal',
      revealCaptured: !!(reveal && (reveal.hasReveal || reveal.hasImages)),
      revealAtMs: reveal?.msAfterClick ?? null,
      beforeClick,
      reveal,
      afterClick: last,
      advancedTo: afterQ,
      stuckOnQuestion: afterQ === fromQ,
      ...primary,
      snapshots,
    });

    if (i % 10 === 0 || i === times) {
      const imgs = beforeClick.imageCount || 0;
      const qLabel = beforeClick.questionNumber || `Q${fromQ}`;
      const elapsed = formatElapsed(performance.now() - t0);
      const eta =
        budget && i > 0
          ? formatElapsed(((performance.now() - t0) / i) * (times - i))
          : null;
      console.log(
        `Progress: ${i}/${times} (${qLabel}${window.__textOnlyMode ? ', text' : `, ${imgs} PNG${imgs === 1 ? '' : 's'}`}) | ${elapsed}${eta ? ` | ETA ${eta}` : ''}`
      );
    }
  }

  const elapsedMs = Math.round(performance.now() - t0);
  const clicksDone = Math.max(1, pages.length - 1);
  const summary = buildSummary(pages);
  summary.elapsedMs = elapsedMs;
  summary.elapsedFormatted = formatElapsed(elapsedMs);
  summary.avgPerQuestionMs = Math.round(elapsedMs / clicksDone);
  summary.avgPerQuestionFormatted = formatElapsed(summary.avgPerQuestionMs);
  if (budget) {
    summary.targetMinutes = budget.totalMinutes;
    summary.targetMs = budget.totalMs;
    summary.onBudget = elapsedMs <= budget.totalMs * 1.05;
  }
  const output = {
    scrapedAt: new Date().toISOString(),
    mode: runOptions.textOnly ? 'text-only' : window.__screenshotMode ? 'screenshot' : 'json+images',
    direction,
    totalClicks: pages.length - 1,
    pageCount: pages.length,
    elapsedMs,
    elapsedFormatted: summary.elapsedFormatted,
    avgPerQuestionFormatted: summary.avgPerQuestionFormatted,
    timingBudget: budget
      ? {
          totalMinutes: budget.totalMinutes,
          burstMs: budget.burstMs,
          paceMs: budget.paceMs,
          onBudget: summary.onBudget,
        }
      : undefined,
    summary,
    pages,
  };

  const exportPayload = prepareExportPayload(output);
  const result = downloadJson(exportPayload, filename);
  if (window.__screenshotMode) {
    const pngPrefix = filename.replace(/\.json$/i, '');
    await flushScreenshotDownloads(pages, pngPrefix);
  }
  if (result.bytes < 5_000_000) {
    await copyJson(result.json);
  } else {
    console.warn(
      'Clipboard skipped — JSON is',
      Math.round(result.bytes / 1024),
      'KB. Use the downloaded file.'
    );
  }

  printSummary(summary);
  const label = result.stripped ? result.payload.summary?.exportNote || 'text-only export' : filename;
  console.log(
    `SUCCESS — ${filename} (${Math.round(result.bytes / 1024)} KB) in ${summary.elapsedFormatted}${summary.onBudget === false ? ' — over budget' : ''}`
  );
  if (result.stripped) console.warn(label);
  return exportPayload;
}

if (window.__SCRAPER_VERSION && window.__SCRAPER_VERSION !== SCRAPER_VERSION) {
  console.warn(
    `Replacing old scraper ${window.__SCRAPER_VERSION} with ${SCRAPER_VERSION}. Clear console (Ctrl+L) next time to avoid duplicate hooks.`
  );
}
window.__SCRAPER_VERSION = SCRAPER_VERSION;

console.log(`Scraper loaded: ${SCRAPER_VERSION}`);
console.log('SAFEST (text only):     await ayText(50, 15)  → scrape-text-output.json');
console.log('JSON + images (light):  await ay(50, 20)       → scrape-output.json');
console.log('If blocked: wait 30 min, hard refresh, paste ONCE, use ayText not ay');
console.log('Stop: window.__scraperAbort = true');

setTextOnlyMode();

async function probeViewer() {
  installImageCaptureHooks();
  const viewerRoot = findViewerRoot();
  const galleryImgs = viewerRoot
    ? queryAllDeep(viewerRoot, 'img').map((img) => ({
        alt: img.alt || '',
        src: (img.currentSrc || img.src || '').slice(0, 160),
        w: img.naturalWidth,
        h: img.naturalHeight,
        complete: img.complete,
        uiIcon: isUiIcon(img),
      }))
    : [];
  const largeImgs = queryAllDeep(document, 'img')
    .filter((img) => !isUiIcon(img) && (img.naturalWidth >= 150 || img.naturalHeight >= 150))
    .map((img) => ({
      alt: img.alt || '',
      src: (img.currentSrc || img.src || '').slice(0, 160),
      w: img.naturalWidth,
      h: img.naturalHeight,
    }));
  const networkUrls = collectNetworkImageUrls();
  const extracted = filterClinicalImages(await extractImages());
  const fetchTests = [];

  console.log('\n========== VIEWER PROBE ==========');
  console.log('version:', SCRAPER_VERSION);
  console.log('questionId:', getCurrentQuestionId() || '(none)');
  console.log('cached webapi:', __questionMediaStore.size, '| blob cache:', __blobStore.size);
  console.log('extractedCount:', extracted.length);

  const visibleBlobUrls = new Set(
    getVisibleBlobImgElements().map((img) => img.currentSrc || img.src).filter(Boolean)
  );
  const visibleBlobs = [...visibleBlobUrls].map((src) => {
    const img = getVisibleBlobImgElements().find((i) => (i.currentSrc || i.src) === src);
    const cached = __blobStore.get(src);
    return {
      uuid: blobUuid(src),
      alt: img?.alt || '',
      w: img?.naturalWidth || 0,
      h: img?.naturalHeight || 0,
      kb: cached ? Math.round((cached.size || 0) / 1024) : '?',
      cached: !!cached,
      visible: true,
    };
  });
  console.log('\nVisible blob UUID imgs (THIS question — these are the x-rays):');
  console.table(visibleBlobs);

  const allBlobs = [...__blobStore.entries()]
    .map(([url, e]) => ({
      uuid: blobUuid(url),
      kb: Math.round((e.size || 0) / 1024),
      qId: e.questionId || '',
      visible: visibleBlobUrls.has(url),
      source: e.source,
    }))
    .sort((a, b) => b.kb - a.kb);
  console.log('\nAll cached blob UUIDs on page (preloaded — only visible ones belong to this Q):');
  console.table(allBlobs.slice(0, 15));
  console.log('viewerRoot:', viewerRoot?.className || null);
  console.log('\nGallery imgs (inside media-gallery-border):');
  console.table(galleryImgs);
  console.log('\nLarge imgs anywhere on page (>=150px):');
  console.table(largeImgs);
  console.log('\nNetwork / HTML image URLs (clinical candidates only):');
  console.table(
    networkUrls.map((u, i) => ({
      i,
      url: u.slice(0, 120),
      decorative: isDecorativeImageUrl(u),
    }))
  );

  const allResources = performance
    .getEntriesByType('resource')
    .filter((e) => /\.(png|jpe?g|webp)/i.test(e.name) || e.name.includes('blob:'))
    .map((e) => ({
      url: e.name.slice(0, 120),
      kb: Math.round((e.transferSize || 0) / 1024),
      decorative: isDecorativeImageUrl(e.name),
      clinical: isLikelyClinicalUrl(e.name),
    }))
    .sort((a, b) => b.kb - a.kb);
  console.log('\nAll PNG/JPEG resources on page (by size):');
  console.table(allResources.slice(0, 12));

  for (const url of networkUrls.slice(0, 8)) {
    const p = await srcToImagePayload(url);
    fetchTests.push({
      url: url.slice(0, 100),
      decorative: isDecorativeImageUrl(url),
      ok: !!p?.isImage,
      method: p?.method || null,
      type: p?.mediaType || p?.error || 'fail',
      bytes: p?.dataUrl?.length || 0,
    });
  }
  console.log('\nFetch tests:');
  console.table(fetchTests);

  if (extracted.length) {
    console.log('\nExtracted images:');
    console.table(
      extracted.map((i, n) => ({
        n,
        type: i.type,
        method: i.method,
        w: i.width,
        h: i.height,
        bytes: i.dataUrl?.length || 0,
        src: (i.src || '').slice(0, 100),
      }))
    );
  } else {
    console.warn('\n⚠ No PNG captured yet.');
    console.warn('Ignore Doctor.png / PsychQB_logo — look for blob UUID rows above (visible: true).');
    console.warn('Re-paste script BEFORE loading questions, or refresh this question after paste.');
  }
  console.log('==================================\n');

  return {
    hasMedicalViewer: hasMedicalViewer(),
    viewerRoot: viewerRoot ? viewerRoot.className || viewerRoot.tagName : null,
    galleryImgs,
    largeImgs,
    networkUrls,
    fetchTests,
    extractedCount: extracted.length,
    extracted,
  };
}

async function downloadViewerPng() {
  const images = filterClinicalImages(await extractImages());
  if (!images.length) {
    console.warn('No clinical PNG found on this question.');
    console.warn('Doctor.png and other /images/ stock art are ignored — need the gallery x-ray URL.');
    return null;
  }
  const best = images.reduce((a, b) =>
    (b.width || 0) * (b.height || 0) > (a.width || 0) * (a.height || 0) ? b : a
  );
  const a = document.createElement('a');
  a.href = best.dataUrl;
  a.download = `viewer-q${getCurrentQuestionNumber() || 'x'}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log('Downloaded', a.download, best.width + 'x' + best.height);
  return best;
}

function getAllClickableButtons() {
  return [...document.querySelectorAll('button, [role="button"]')];
}

function buttonLabel(el) {
  return (el?.getAttribute('title') || el?.innerText || el?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function describeButton(btn) {
  if (!btn) return null;
  const rect = btn.getBoundingClientRect();
  return {
    found: true,
    label: buttonLabel(btn),
    title: btn.getAttribute('title'),
    disabled: !!btn.disabled,
    visible: rect.width > 0 && rect.height > 0,
    className: btn.className || '',
    img: btn.querySelector('img')?.src?.split('/').pop() || null,
  };
}

function findFooterButton(kind) {
  const k = String(kind || '').toLowerCase();
  const wantEnd = /end/.test(k);
  const wantSuspend = /suspend|pause/.test(k);

  for (const btn of getAllClickableButtons()) {
    const label = buttonLabel(btn);
    const title = btn.getAttribute('title') || '';
    const src = btn.querySelector('img')?.src || '';

    if (wantEnd && (/end block/i.test(label) || /end block/i.test(title) || /stop-icon/i.test(src))) {
      return btn;
    }
    if (
      wantSuspend &&
      (/suspend block/i.test(label) || /suspend block/i.test(title) || /pause-icon/i.test(src))
    ) {
      return btn;
    }
  }
  return null;
}

function getBlockControlState() {
  const suspendBtn = findFooterButton('suspend');
  const endBtn = findFooterButton('end');
  return {
    questionNumber: document.querySelector('.item-block')?.innerText?.trim() || null,
    questionId: document.querySelector('.item-info span')?.innerText?.trim() || null,
    onTestPage: !!document.querySelector('#test'),
    suspend: describeButton(suspendBtn),
    end: describeButton(endBtn),
    footerButtons: [...document.querySelectorAll('footer button, .footer-button, .test-footer-wrapper button')]
      .map(describeButton)
      .filter(Boolean),
  };
}

function findVisibleModalRoot() {
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot && modalRoot.innerText.trim().length > 0) return modalRoot;

  for (const el of document.querySelectorAll('[role="dialog"], [class*="modal" i]')) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && el.innerText.trim().length > 0) return el;
  }
  return null;
}

function findModalButtons() {
  const modal = findVisibleModalRoot();
  const scope = modal || document.body;
  return [...scope.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')].filter(
    (btn) => {
      const rect = btn.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
  );
}

function findButtonByText(scope, patterns) {
  const regs = patterns.map((p) => (typeof p === 'string' ? new RegExp(p, 'i') : p));
  for (const btn of scope.querySelectorAll('button, [role="button"]')) {
    const text = buttonLabel(btn);
    if (regs.some((re) => re.test(text))) return btn;
  }
  return null;
}

function probeModalState() {
  const modal = findVisibleModalRoot();
  if (!modal) return { open: false };
  return {
    open: true,
    textPreview: modal.innerText.trim().slice(0, 400),
    buttons: findModalButtons().map(describeButton),
  };
}

async function probeBlockControls() {
  const state = getBlockControlState();
  console.log('\n========== BLOCK CONTROLS PROBE ==========');
  console.log('version:', SCRAPER_VERSION);
  console.table({
    questionNumber: state.questionNumber,
    questionId: state.questionId,
    onTestPage: state.onTestPage,
  });
  console.log('\nSuspend Block — pause icon (Button #44):');
  console.log(state.suspend || 'NOT FOUND');
  console.log('\nEnd Block — stop icon (Button #45):');
  console.log(state.end || 'NOT FOUND');
  console.log('\nAll footer buttons:');
  console.table(state.footerButtons);
  const modal = probeModalState();
  console.log('\nModal open:', modal.open);
  if (modal.open) console.table(modal.buttons);
  console.log('Try: await clickBlockAction("end", { dryRun: true })');
  console.log('Then: await endBlock()  |  await suspendBlock()');
  console.log('==========================================\n');
  return state;
}

async function probeModal() {
  const modal = probeModalState();
  console.log('\n========== MODAL PROBE ==========');
  if (!modal.open) {
    console.log('No modal visible.');
  } else {
    console.log('Text preview:', modal.textPreview);
    console.table(modal.buttons);
  }
  console.log('=================================\n');
  return modal;
}

async function clickBlockAction(kind = 'end', options = {}) {
  const dryRun = options.dryRun ?? false;
  const btn = findFooterButton(kind);
  if (!btn) {
    console.error(`Block button not found: ${kind}`);
    await probeBlockControls();
    return { ok: false, error: 'button_not_found', kind };
  }
  if (btn.disabled) {
    console.warn(`${kind} button is disabled`);
    return { ok: false, error: 'button_disabled', kind, button: describeButton(btn) };
  }
  const label = buttonLabel(btn);
  if (dryRun) {
    console.log(`[dry run] Would click: ${label}`);
    return { ok: true, dryRun: true, kind, label, button: describeButton(btn) };
  }
  btn.click();
  console.log(`Clicked: ${label}`);
  await new Promise((r) => setTimeout(r, 600));
  return { ok: true, kind, label, modal: probeModalState() };
}

async function confirmOpenModal(patterns = ['yes', 'confirm', 'end block', 'ok', 'proceed', 'continue']) {
  await new Promise((r) => setTimeout(r, 300));
  const modal = findVisibleModalRoot();
  const scope = modal || document;
  const btn = findButtonByText(scope, patterns) || findButtonByText(document, patterns);
  if (!btn) {
    console.warn('No confirm button found — run await probeModal()');
    await probeModal();
    return { ok: false, error: 'confirm_not_found' };
  }
  btn.click();
  const label = buttonLabel(btn);
  console.log(`Confirmed modal: ${label}`);
  await new Promise((r) => setTimeout(r, 800));
  return { ok: true, clicked: label };
}

async function endBlock(options = {}) {
  const confirm = options.confirm ?? true;
  const dryRun = options.dryRun ?? false;
  const click = await clickBlockAction('end', { dryRun });
  if (!click.ok || dryRun) return click;
  if (confirm) click.confirm = await confirmOpenModal();
  click.after = getBlockControlState();
  return click;
}

async function suspendBlock(options = {}) {
  const confirm = options.confirm ?? true;
  const dryRun = options.dryRun ?? false;
  const click = await clickBlockAction('suspend', { dryRun });
  if (!click.ok || dryRun) return click;
  if (confirm) click.confirm = await confirmOpenModal(['yes', 'confirm', 'suspend', 'ok']);
  return click;
}

async function waitForLeaveTestPage(timeoutMs = 15000) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    if (!document.querySelector('#test') || !document.querySelector('.next-button')) {
      return {
        left: true,
        url: location.href,
        preview: document.body.innerText.trim().slice(0, 250),
      };
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return { left: false, url: location.href };
}

async function probeStartScreen() {
  const buttons = getAllClickableButtons().map(describeButton).filter((b) => b?.visible);
  const interesting = buttons.filter((b) =>
    /block|start|create|new|practice|timed|resume|continue/i.test(b.label)
  );
  console.log('\n========== START / BLOCK MENU PROBE ==========');
  console.log('url:', location.href);
  console.log('Interesting buttons:');
  console.table(interesting);
  console.log('All visible buttons (first 30):');
  console.table(buttons.slice(0, 30));
  console.log('==============================================\n');
  return { url: location.href, interesting, buttons };
}

async function clickStartNewBlock(options = {}) {
  const dryRun = options.dryRun ?? false;
  const patterns = [
    'create block',
    'new block',
    'start block',
    'create new block',
    'start test',
    'start practice',
    'create test',
  ];
  for (const pat of patterns) {
    const btn = findButtonByText(document, [pat]);
    if (btn) {
      const label = buttonLabel(btn);
      if (dryRun) return { ok: true, dryRun: true, label };
      btn.click();
      console.log(`Clicked: ${label}`);
      await new Promise((r) => setTimeout(r, 1500));
      return { ok: true, label };
    }
  }
  console.warn('No start/new block button found — run await probeStartScreen()');
  await probeStartScreen();
  return { ok: false, error: 'start_button_not_found' };
}

async function scrapeMultipleBlocks(blockCount = 2, questionsPerBlock = 50, burstMs = 1200) {
  const results = [];
  for (let b = 1; b <= blockCount; b++) {
    console.log(`\n===== BLOCK ${b}/${blockCount} =====`);
    const filename = `scrape-output-block${b}.json`;
    const scrape = await clickNav('next', questionsPerBlock, burstMs, 50, filename);
    results.push({ block: b, filename, summary: scrape.summary });

    if (b >= blockCount) break;

    const ended = await endBlock({ confirm: true });
    if (!ended.ok) {
      console.error('End block failed — stopping loop');
      results.push({ block: b, loopStopped: 'end_block_failed', ended });
      break;
    }

    const left = await waitForLeaveTestPage();
    console.log('Left test page:', left.left, left.url);
    const started = await clickStartNewBlock();
    if (!started.ok) {
      console.warn('Could not auto-start next block. Use probeStartScreen(), start manually, then scrape again.');
      results.push({ block: b, loopStopped: 'start_block_failed', left, started });
      break;
    }

    await new Promise((r) => setTimeout(r, 2000));
    await goToQuestion(1, 200);
  }
  return results;
}

window.probeViewer = probeViewer;
window.downloadViewerPng = downloadViewerPng;
window.probeBlockControls = probeBlockControls;
window.probeModal = probeModal;
window.clickBlockAction = clickBlockAction;
window.endBlock = endBlock;
window.suspendBlock = suspendBlock;
window.waitForLeaveTestPage = waitForLeaveTestPage;
window.probeStartScreen = probeStartScreen;
window.clickStartNewBlock = clickStartNewBlock;
window.ay = ay;
window.ayHtml = ayHtml;
window.saveHtmlBlock = saveHtmlBlock;
window.ayText = ayText;
window.scrapeTextOnly = scrapeTextOnly;
window.setTextOnlyMode = setTextOnlyMode;
window.scrapeFromOneHuman = scrapeFromOneHuman;
window.scrapeFromOneScreenshot = scrapeFromOneScreenshot;
window.fastScreenshotBlock = fastScreenshotBlock;
window.setJsonScrapeMode = setJsonScrapeMode;
window.setScreenshotMode = setScreenshotMode;
window.scraperMode = scraperMode;
window.captureQBFullScreenshot = captureQBFullScreenshot;
window.capturePageScreenshot = capturePageScreenshot;
window.scrapeMultipleBlocks = scrapeMultipleBlocks;
