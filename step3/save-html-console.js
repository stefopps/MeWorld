// PASTE THIS ENTIRE FILE into DevTools Console on qb.ccscases.com
// Then run:  await ayHtml(50, 10)
const SCRAPER_VERSION = '2026-07-11-html-v2-images';

window.__scraperAbort = false;
window.__scraperRateLimit = window.__scraperRateLimit || { until: 0, hits: 0 };
window.__scraperPaceMs = window.__scraperPaceMs ?? 0;

const UI_ICON_ALTS = new Set(['invert', 'contrast', 'zoom']);
const DECORATIVE_URL_RE =
  /\/images\/(?:doctor|nurse|logo|avatar|placeholder|banner|header|footer|icon|psychqb)[^/?#]*\.(?:png|jpe?g|webp)/i;
const UI_ASSET_RE =
  /\/assets\/(?:.*-icon|favicon|calculator|pause|stop|reverse-color|index-)[^/?#]*/i;
const WEBAPI_MEDIA_RE = /get(?:Question|multipleanswer)Media\.webapi/i;
const __blobStore = new Map();

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function computeTimingBudget(questionCount, totalMinutes) {
  const totalMs = totalMinutes * 60 * 1000;
  const perQ = Math.floor(totalMs / Math.max(1, questionCount));
  const navOverheadMs = 900;
  const burstMs = Math.max(1200, Math.min(Math.floor(perQ * 0.48), perQ - navOverheadMs - 300));
  const paceMs = Math.max(300, perQ - burstMs - navOverheadMs);
  return { questionCount, totalMinutes, totalMs, perQ, burstMs, paceMs };
}

function applyTimingBudget(budget) {
  window.__scraperPaceMs = budget.paceMs;
  return budget;
}

function logTimingBudget(budget) {
  console.log(
    `Timing: ${budget.questionCount} Q in ${budget.totalMinutes} min (~${formatElapsed(budget.perQ)}/Q)`
  );
  console.log(`  reveal wait=${budget.burstMs}ms  pace=${budget.paceMs}ms`);
}

function lightMeta() {
  return {
    capturedAt: new Date().toISOString(),
    questionNumber: document.querySelector('.item-block')?.innerText?.trim() || '',
    questionId: document.querySelector('.item-info span')?.innerText?.trim() || '',
  };
}

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

function parseQuestionNumber(str) {
  const n = parseInt((str || '').split('/')[0], 10);
  return Number.isFinite(n) ? n : null;
}

function getCurrentQuestionNumber() {
  const num = document.querySelector('.item-block')?.innerText?.trim() || '';
  const current = parseInt(num.split('/')[0], 10);
  return Number.isFinite(current) ? current : null;
}

function isRateLimited() {
  return Date.now() < (window.__scraperRateLimit?.until || 0);
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

function isUiIcon(el) {
  const alt = (el.alt || '').trim().toLowerCase();
  if (UI_ICON_ALTS.has(alt)) return true;
  if (el.closest('button, [role="button"], .toolbar, [class*="toolbar" i], [class*="tool-" i]')) {
    return true;
  }
  return false;
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

function hasMedicalViewer() {
  const alts = new Set(
    [...document.querySelectorAll('img[alt]')].map((i) => (i.alt || '').trim().toLowerCase())
  );
  return alts.has('invert') && alts.has('contrast') && alts.has('zoom');
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function installBlobCaptureHook() {
  if (window.__htmlBlobHookInstalled) return;
  if (!window.__htmlOrigCreateObjectURL) {
    window.__htmlOrigCreateObjectURL = URL.createObjectURL.bind(URL);
  }
  URL.createObjectURL = function (blob) {
    const url = window.__htmlOrigCreateObjectURL(blob);
    if (blob instanceof Blob && blob.size >= 512 && String(blob.type || '').startsWith('image/')) {
      blobToDataUrl(blob)
        .then((dataUrl) => {
          __blobStore.set(url, { url, dataUrl, mediaType: blob.type, size: blob.size });
        })
        .catch(() => {});
    }
    return url;
  };
  window.__htmlBlobHookInstalled = true;
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
    return canvas.toDataURL('image/png');
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

async function canvasToDataUrl(canvas) {
  if (!canvasHasContent(canvas)) return null;
  try {
    return canvas.toDataURL('image/png');
  } catch (e) {
    return null;
  }
}

async function resolveUrlToDataUrl(url, liveImg = null) {
  if (!url || isDecorativeImageUrl(url)) return null;
  if (url.startsWith('data:image/')) return url;

  if (__blobStore.has(url)) return __blobStore.get(url).dataUrl;

  if (liveImg) {
    const fromCanvas = await imgElementToDataUrl(liveImg);
    if (fromCanvas) return fromCanvas;
  }

  if (url.startsWith('blob:')) {
    try {
      const blob = await fetch(url).then((r) => r.blob());
      if (blob.size >= 512 && String(blob.type || '').startsWith('image/')) {
        const dataUrl = await blobToDataUrl(blob);
        __blobStore.set(url, { url, dataUrl, mediaType: blob.type, size: blob.size });
        return dataUrl;
      }
    } catch (e) {
      /* blob expired */
    }
  }

  return null;
}

async function fetchQuestionMediaDataUrl(questionId) {
  if (!questionId || isRateLimited()) return null;
  const url = `${location.origin}/getQuestionMedia.webapi?question_id=${encodeURIComponent(questionId)}`;
  try {
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    if (blob.size < 512) return null;
    return blobToDataUrl(blob);
  } catch (e) {
    return null;
  }
}

async function embedImagesInClone(liveRoot, cloneRoot) {
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

    let dataUrl = await resolveUrlToDataUrl(src, live);
    if (dataUrl) {
      clone.setAttribute('src', dataUrl);
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
    const dataUrl = await canvasToDataUrl(liveCanvases[i]);
    const cloneCanvas = cloneCanvases[i];
    if (!dataUrl || !cloneCanvas) continue;
    const img = document.createElement('img');
    img.src = dataUrl;
    img.width = liveCanvases[i].width;
    img.height = liveCanvases[i].height;
    if (cloneCanvas.className) img.className = cloneCanvas.className;
    if (cloneCanvas.getAttribute('style')) img.setAttribute('style', cloneCanvas.getAttribute('style'));
    cloneCanvas.replaceWith(img);
    embedded += 1;
  }

  if (missed > 0 && hasMedicalViewer()) {
    const qid = getCurrentQuestionId();
    const mediaDataUrl = await fetchQuestionMediaDataUrl(qid);
    if (mediaDataUrl) {
      for (const clone of cloneImgs) {
        const src = clone.getAttribute('src') || '';
        if (src.startsWith('blob:') || !src.startsWith('data:image/')) {
          clone.setAttribute('src', mediaDataUrl);
          embedded += 1;
          missed -= 1;
        }
      }
      for (const cloneCanvas of cloneCanvases) {
        if (cloneCanvas.parentElement) {
          const img = document.createElement('img');
          img.src = mediaDataUrl;
          cloneCanvas.replaceWith(img);
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
  if (test && clone) {
    imageStats = await embedImagesInClone(test, clone);
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

function downloadJson(data, filename) {
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function scraperPause(reason) {
  const wait = Math.max(0, (window.__scraperRateLimit?.until || 0) - Date.now());
  if (wait > 0) {
    console.warn(`Cooldown: waiting ${Math.round(wait / 1000)}s${reason ? ` (${reason})` : ''}`);
    await new Promise((r) => setTimeout(r, wait));
  }
  if (window.__scraperPaceMs > 0) {
    await new Promise((r) => setTimeout(r, window.__scraperPaceMs));
  }
}

async function waitForQuestionChange(fromQ, timeoutMs = 6000) {
  if (fromQ === null) return getCurrentQuestionNumber();
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    if (isRateLimited()) await scraperPause('waiting for next Q');
    const cur = getCurrentQuestionNumber();
    if (cur !== null && cur !== fromQ) return cur;
    await new Promise((r) => setTimeout(r, 120));
  }
  return getCurrentQuestionNumber();
}

/** Save one HTML file per question (after reveal), with exhibit images embedded as base64. */
async function saveHtmlBlock(count = 50, totalMinutes = 10, options = {}) {
  installBlobCaptureHook();
  window.__scraperAbort = false;
  const budget = applyTimingBudget(computeTimingBudget(count, totalMinutes));
  logTimingBudget(budget);
  const revealWaitMs = options.revealWaitMs ?? budget.burstMs;
  const proceedWaitMs = options.proceedWaitMs ?? 450;
  const manifest = [];
  const t0 = performance.now();

  console.log(`HTML save: ${count} files (exhibit images embedded inline)`);
  console.log('Stop: window.__scraperAbort = true');

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
      imagesEmbedded: snap.imageStats.embedded,
      imagesMissed: snap.imageStats.missed,
      ...snap.meta,
    });
    const imgNote =
      snap.imageStats.embedded > 0
        ? ` | ${snap.imageStats.embedded} img embedded`
        : snap.imageStats.missed > 0
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
    mode: 'html-save-embedded-images',
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

installBlobCaptureHook();
window.ayHtml = ayHtml;
window.saveHtmlBlock = saveHtmlBlock;

console.log(`CCS HTML saver ${SCRAPER_VERSION} loaded`);
console.log('Run: await ayHtml(50, 10)   → HTML + embedded exhibit images');
