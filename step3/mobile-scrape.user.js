// ==UserScript==
// @name         CCS QB Mobile Scraper
// @namespace    ccsqb-mobile
// @version      2026-07-11
// @description  Text JSON scrape for qb.ccscases.com on iPhone — tap UI, no console
// @match        https://qb.ccscases.com/*
// @match        https://*.ccscases.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  if (window.__ccsMobileLoaded) return;
  window.__ccsMobileLoaded = true;

  const VERSION = '2026-07-11-mobile-v1';

  window.__scraperAbort = false;
  window.__scraperPaceMs = 0;

  function $(sel) {
    return document.querySelector(sel);
  }

  function parseQ(str) {
    const n = parseInt((str || '').split('/')[0], 10);
    return Number.isFinite(n) ? n : null;
  }

  function normId(raw) {
    const m = String(raw || '').trim().match(/(\d{1,8})/);
    return m ? m[1] : String(raw || '').trim();
  }

  function fmt(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60);
    return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
  }

  function budget(count, mins) {
    const totalMs = mins * 60 * 1000;
    const perQ = Math.floor(totalMs / Math.max(1, count));
    const burstMs = Math.max(1500, Math.min(Math.floor(perQ * 0.45), perQ - 1200));
    const paceMs = Math.max(400, perQ - burstMs - 900);
    return { count, mins, burstMs, paceMs, perQ };
  }

  function extractAnswers() {
    return [...document.querySelectorAll('.answers .questionDiv')].map((div, idx) => {
      const letter =
        div.querySelector('.optionLetterSpan')?.innerText?.trim() ||
        String.fromCharCode(65 + idx) + '.';
      const optionSpan = div.querySelector('.optionSpan');
      let text = '';
      if (optionSpan) text = optionSpan.innerText.replace(letter, '').trim();
      const style = getComputedStyle(div);
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
      const el = $(sel);
      if (el && el.innerText.trim().length > 10) return el.innerText.trim();
    }
    const extras = [...document.querySelectorAll('.testWrapper > *')].filter(
      (el) =>
        !el.matches('#testQuestion, .answers, .button-container-light, .button-container') &&
        el.innerText.trim().length > 15
    );
    return extras.length ? extras.map((el) => el.innerText.trim()).join('\n\n') : '';
  }

  function extractPage() {
    const questionId =
      $('.test-header .item-info span')?.innerText?.trim() ||
      $('.item-info span')?.innerText?.trim() ||
      '';
    const questionNumber = $('.item-block')?.innerText?.trim() || '';
    const question =
      $('#testQuestion')?.innerText?.trim() || $('.question')?.innerText?.trim() || '';
    const answers = extractAnswers();
    const explanation = extractExplanation();
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
      hasMedicalViewer: false,
      imageCount: 0,
      hasImages: false,
      textOnly: true,
    };
  }

  async function waitQChange(fromQ, ms = 8000) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      const cur = parseQ($('.item-block')?.innerText?.trim());
      if (cur !== null && cur !== fromQ) return cur;
      await new Promise((r) => setTimeout(r, 150));
    }
    return parseQ($('.item-block')?.innerText?.trim());
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function scrapeBlock(count, mins, log) {
    window.__scraperAbort = false;
    const b = budget(count, mins);
    window.__scraperPaceMs = b.paceMs;
    const pages = [];
    const t0 = performance.now();
    log(`Start ${count} Q / ${mins} min (~${fmt(b.perQ)}/Q)`);
    log('Keep Safari open — don\'t lock screen');

    pages.push({ step: 0, action: 'start', ...extractPage() });

    for (let i = 1; i <= count; i++) {
      if (window.__scraperAbort) {
        log('Stopped');
        break;
      }

      if (window.__scraperPaceMs > 0) {
        await new Promise((r) => setTimeout(r, window.__scraperPaceMs));
      }

      const btn = $('.next-button');
      if (!btn) {
        log('Next button missing');
        break;
      }

      const before = extractPage();
      const fromQ = parseQ(before.questionNumber);
      btn.click();
      log(`Q${i}/${count} Next…`);
      await new Promise((r) => setTimeout(r, b.burstMs));

      const snaps = [];
      const snapT0 = performance.now();
      while (performance.now() - snapT0 <= b.burstMs) {
        snaps.push(extractPage());
        await new Promise((r) => setTimeout(r, 100));
      }
      const reveal = snaps.find((s) => s.hasReveal) || snaps[snaps.length - 1];

      const proceed = $('.button-container-light button');
      if (proceed) {
        proceed.click();
        await new Promise((r) => setTimeout(r, 500));
      }
      const afterQ = await waitQChange(fromQ);

      pages.push({
        step: i,
        action: 'click-next',
        status: reveal?.hasReveal ? 'ok' : 'missed_reveal',
        revealCaptured: !!reveal?.hasReveal,
        advancedTo: afterQ,
        ...before,
        explanation: reveal?.explanation || before.explanation,
        likelyCorrectAnswer: reveal?.likelyCorrectAnswer || before.likelyCorrectAnswer,
        answers: reveal?.answers?.some((a) => a.likelyCorrect || a.votePercent)
          ? reveal.answers
          : before.answers,
      });

      log(`  ✓ ${before.questionNumber || i} | ${fmt(performance.now() - t0)}`);
    }

    const slim = pages.map((p) => ({
      step: p.step,
      questionNumber: p.questionNumber,
      questionId: p.questionId,
      question: p.question,
      answers: p.answers,
      explanation: p.explanation,
      likelyCorrectAnswer: p.likelyCorrectAnswer,
      hasReveal: p.hasReveal,
      revealCaptured: p.revealCaptured,
      status: p.status,
    }));

    const output = {
      scrapedAt: new Date().toISOString(),
      scraperVersion: VERSION,
      mode: 'mobile-text-only',
      platform: 'iphone',
      pageCount: slim.length,
      pages: slim,
      summary: {
        questionsScraped: slim.filter((p) => p.step > 0).length,
        revealsCaptured: slim.filter((p) => p.revealCaptured).length,
        elapsedFormatted: fmt(performance.now() - t0),
      },
    };

    downloadJson(output, 'scrape-mobile-text.json');
    log(`Done — download started (${output.summary.questionsScraped} Q)`);
    return output;
  }

  function buildUI() {
    if ($('#ccs-mobile-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ccs-mobile-panel';
    panel.innerHTML = `
<style>
#ccs-mobile-panel{position:fixed;bottom:0;left:0;right:0;z-index:2147483647;
  background:#111;color:#fff;font:14px/1.4 -apple-system,sans-serif;
  border-top:2px solid #0a84ff;padding:10px 12px  max(12px,env(safe-area-inset-bottom));
  box-shadow:0 -4px 20px rgba(0,0,0,.35)}
#ccs-mobile-panel .row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
#ccs-mobile-panel button{flex:1;min-width:90px;padding:12px 10px;border:0;border-radius:10px;
  font-size:15px;font-weight:600}
#ccs-mobile-panel .go{background:#0a84ff;color:#fff}
#ccs-mobile-panel .stop{background:#ff453a;color:#fff}
#ccs-mobile-panel .hide{background:#333;color:#fff;flex:0}
#ccs-mobile-panel #ccs-mobile-log{max-height:72px;overflow:auto;font-size:12px;color:#ccc;
  white-space:pre-wrap}
#ccs-mobile-panel .title{font-weight:700;margin-bottom:6px}
</style>
<div class="title">CCS Scraper ${VERSION}</div>
<div class="row">
  <button class="go" id="ccs-m-start50">Scrape 50 (15 min)</button>
  <button class="go" id="ccs-m-start10">Scrape 10 (5 min)</button>
  <button class="stop" id="ccs-m-stop">Stop</button>
  <button class="hide" id="ccs-m-hide">Hide</button>
</div>
<div id="ccs-mobile-log">Ready — stay on question page, tap Scrape.</div>`;

    document.body.appendChild(panel);

    const logEl = $('#ccs-mobile-log');
    const log = (msg) => {
      logEl.textContent = (logEl.textContent + '\n' + msg).trim().slice(-800);
      logEl.scrollTop = logEl.scrollHeight;
    };

    $('#ccs-m-hide').onclick = () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };
    $('#ccs-m-stop').onclick = () => {
      window.__scraperAbort = true;
      log('Stop requested…');
    };
    $('#ccs-m-start50').onclick = async () => {
      $('#ccs-m-start50').disabled = true;
      $('#ccs-m-start10').disabled = true;
      try {
        await scrapeBlock(50, 15, log);
      } catch (e) {
        log('Error: ' + e.message);
      }
      $('#ccs-m-start50').disabled = false;
      $('#ccs-m-start10').disabled = false;
    };
    $('#ccs-m-start10').onclick = async () => {
      $('#ccs-m-start50').disabled = true;
      $('#ccs-m-start10').disabled = true;
      try {
        await scrapeBlock(10, 5, log);
      } catch (e) {
        log('Error: ' + e.message);
      }
      $('#ccs-m-start50').disabled = false;
      $('#ccs-m-start10').disabled = false;
    };

    log('Panel loaded.');
  }

  if (document.body) buildUI();
  else addEventListener('DOMContentLoaded', buildUI);
})();
