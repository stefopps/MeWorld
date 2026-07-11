// PASTE THIS ENTIRE FILE into DevTools Console (F12), then run:
//   await scrapeFromOne(50)
const SCRAPER_VERSION = '2026-07-10-v7';

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

function installImageCaptureHooks() {
  if (window.__imageCaptureHooksInstalled) return;
  window.__imageCaptureHooksInstalled = true;

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

  const origCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (blob) {
    const url = origCreateObjectURL.call(URL, blob);
    if (blob instanceof Blob) {
      storeRasterBlob(url, blob, blob.type, { source: 'createObjectURL' }).catch(() => {});
    }
    return url;
  };

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const resp = await origFetch.apply(this, args);
    try {
      const req = args[0];
      const url = typeof req === 'string' ? req : req?.url;
      const ct = resp.headers.get('content-type') || '';

      if (WEBAPI_MEDIA_RE.test(url || '')) {
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
      } else if (ct.startsWith('image/') && !isDecorativeImageUrl(url)) {
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

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.addEventListener('load', function () {
      try {
        const ct = this.getResponseHeader('content-type') || '';
        if (WEBAPI_MEDIA_RE.test(url || '')) {
          const blob = this.response instanceof Blob ? this.response : new Blob([this.response], { type: ct });
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
    try {
      const resp = await fetch(src, { credentials: 'include' });
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

  try {
    const resp = await fetch(src, { credentials: 'include' });
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

async function enrichWithImages(data) {
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

function downloadJson(data, filename = 'scrape-output.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  return json;
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

async function waitForQuestionChange(fromQ, timeoutMs = 2500) {
  if (fromQ === null) return getCurrentQuestionNumber();
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    const cur = getCurrentQuestionNumber();
    if (cur !== null && cur !== fromQ) return cur;
    await new Promise((r) => setTimeout(r, 80));
  }
  return getCurrentQuestionNumber();
}

async function advanceAfterCapture(fromQ) {
  const cur = getCurrentQuestionNumber();
  if (cur === fromQ) {
    const proceed = document.querySelector('.button-container-light button');
    if (proceed) {
      proceed.click();
      console.log('  → Proceed to next item');
    }
  }
  return waitForQuestionChange(fromQ, 2500);
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
    await new Promise((r) => setTimeout(r, delayMs));
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
  const times = toQ - fromQ + 1;
  const filename = `scrape-output-q${fromQ}-${toQ}.json`;
  console.log(`Scraping Q${fromQ}–Q${toQ} → ${filename}`);
  await goToQuestion(fromQ, 200);
  return clickNav('next', times, burstMs, 50, filename);
}

async function scrapeFromOne(questionCount = 50, burstMs = 900) {
  console.log(`Fast scrape: ${questionCount} questions (~${Math.round(questionCount * burstMs / 1000)}s)...`);
  await goToQuestion(1, 200);
  return clickNav('next', questionCount, burstMs, 50);
}

async function clickNav(direction = 'next', times = 49, burstMs = 900, intervalMs = 50, filename = 'scrape-output.json') {
  const selector =
    direction === 'previous' ? '.previous-button' : '.next-button';

  const pages = [];
  const startData = await enrichWithImages(extractPageDataSync());
  pages.push({ step: 0, action: 'start', ...startData });
  console.log(`Captured step 0 (${startData.imageCount} PNGs)`);

  for (let i = 1; i <= times; i++) {
    const btn = document.querySelector(selector);
    if (!btn) {
      console.error('Button not found:', selector);
      break;
    }

    // Capture CURRENT question BEFORE click (with your selections / flag)
    const beforeClick = await enrichWithImages(extractPageDataSync());
    const effectiveBurst = hasMedicalViewer() ? Math.max(burstMs, 2500) : burstMs;

    btn.click();
    console.log(`Click ${i}/${times}...`);

    const allSnapshots = await captureBurst(intervalMs, effectiveBurst);
    const first = await enrichWithImages(allSnapshots[0]);
    const last = await enrichWithImages(allSnapshots[allSnapshots.length - 1]);
    const revealSync = allSnapshots.find((s) => s.hasReveal) || null;
    const reveal =
      revealSync && revealSync !== allSnapshots[0]
        ? await enrichWithImages(revealSync)
        : first.hasReveal || first.hasImages
          ? first
          : null;

    const snapshots = [first];
    if (reveal && reveal !== first && reveal !== last) snapshots.push(reveal);
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
      console.log(
        `Progress: ${i}/${times} (${qLabel}, ${imgs} clinical PNG${imgs === 1 ? '' : 's'})`
      );
    }
  }

  const summary = buildSummary(pages);
  const output = {
    scrapedAt: new Date().toISOString(),
    direction,
    totalClicks: pages.length - 1,
    pageCount: pages.length,
    summary,
    pages,
  };

  downloadJson(output, filename);
  await copyJson(JSON.stringify(output, null, 2));

  printSummary(summary);
  console.log(`SUCCESS — ${filename} downloaded`);
  return output;
}

if (window.__SCRAPER_VERSION && window.__SCRAPER_VERSION !== SCRAPER_VERSION) {
  console.warn(
    `Replacing old scraper ${window.__SCRAPER_VERSION} with ${SCRAPER_VERSION}. Clear console (Ctrl+L) next time to avoid duplicate hooks.`
  );
}
window.__SCRAPER_VERSION = SCRAPER_VERSION;

console.log(`Scraper loaded: ${SCRAPER_VERSION}`);
console.log('1) Refresh page OR clear console (Ctrl+L) before pasting');
console.log('2) Paste this ENTIRE file once, then: await probeViewer() on an x-ray question');
console.log('3) await scrapeFromOne(50)  |  missing tail: await scrapeRest(49, 50)');
console.log('Debug: await downloadViewerPng()');

installImageCaptureHooks();

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

window.probeViewer = probeViewer;
window.downloadViewerPng = downloadViewerPng;
