// Inject debug: trace updateQuizGraph execution
const { chromium } = require('playwright');
const path = require('node:path');
const URL = 'http://localhost:9091/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message.slice(0,200)));
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('[DEBUG')) {
      console.log(msg.type().toUpperCase() + ':', msg.text().slice(0,250));
    }
  });
  
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  
  // Inject spy that logs what updateQuizGraph sees
  await page.evaluate(() => {
    const orig = window.updateQuizGraph;
    window.updateQuizGraph = function() {
      const q = QUESTION_BANK[currentQ];
      const bg = q.baseGraph || {};
      const gt = bg.type || 'cumulative';
      console.log('[DEBUG] updateQuizGraph called, gt=' + gt + ' qId=' + q.id + ' stem=' + q.stem.slice(0,30));
      
      // Check classList BEFORE hideAll
      const cumBefore = document.getElementById('chart-quiz-cumulative').classList.contains('active');
      const barBefore = document.getElementById('chart-quiz-bar').classList.contains('active');
      console.log('[DEBUG] before hideAll: cumActive=' + cumBefore + ' barActive=' + barBefore);
      
      // Call original
      orig.call(this);
      
      // Check classList AFTER
      const cumAfter = document.getElementById('chart-quiz-cumulative').classList.contains('active');
      const barAfter = document.getElementById('chart-quiz-bar').classList.contains('active');
      const normalAfter = document.getElementById('chart-quiz-normal').classList.contains('active');
      console.log('[DEBUG] after render: cumActive=' + cumAfter + ' barActive=' + barAfter + ' normActive=' + normalAfter);
    };
    
    // Also spy on hideAllQuizChartPanels
    const origHide = window.hideAllQuizChartPanels;
    window.hideAllQuizChartPanels = function() {
      const cumBefore = document.getElementById('chart-quiz-cumulative').classList.contains('active');
      const barBefore = document.getElementById('chart-quiz-bar').classList.contains('active');
      origHide.call(this);
      const cumAfter = document.getElementById('chart-quiz-cumulative').classList.contains('active');
      const barAfter = document.getElementById('chart-quiz-bar').classList.contains('active');
      console.log('[DEBUG] hideAll: cum ' + cumBefore + '->' + cumAfter + ' bar ' + barBefore + '->' + barAfter);
    };
  });
  
  // Q1 already rendered. Check state.
  let s = await page.evaluate(() => ({
    cum: document.getElementById('chart-quiz-cumulative').classList.contains('active'),
    bar: document.getElementById('chart-quiz-bar').classList.contains('active'),
  }));
  console.log('Post-Q1:', JSON.stringify(s));
  
  // Go to Q2
  await page.locator('#next-btn').click();
  await page.waitForTimeout(500);
  
  s = await page.evaluate(() => ({
    cum: document.getElementById('chart-quiz-cumulative').classList.contains('active'),
    bar: document.getElementById('chart-quiz-bar').classList.contains('active'),
  }));
  console.log('Post-Q2:', JSON.stringify(s));
  
  // Go to Q6 (studyDesignGrid)
  for (let i = 0; i < 4; i++) { await page.locator('#next-btn').click(); await page.waitForTimeout(300); }
  
  s = await page.evaluate(() => ({
    cum: document.getElementById('chart-quiz-cumulative').classList.contains('active'),
    html: document.getElementById('chart-quiz-html').style.display,
    stem: document.getElementById('q-stem')?.textContent?.slice(0,40),
  }));
  console.log('Post-Q6:', JSON.stringify(s));
  
  await browser.close();
})();
