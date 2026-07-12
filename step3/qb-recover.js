#!/usr/bin/env node
/** Diagnose QB state, screenshot roadblocks, login, navigate to Q1/50. */
const { chromium } = require('playwright');
const path = require('path');
const { captureRoadblock, ensureLoggedIn, recoverFromRoadblock, parsePageState } = require('./roadblock-helper.js');
const { runAutoHandoff } = require('./handoff-auto.js');

const PROFILE_DIR = path.join(__dirname, 'qb_browser_profile');
const QB_URL = 'https://qb.ccscases.com/';

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: null,
    args: ['--start-maximized'],
  });
  const page = context.pages()[0] || (await context.newPage());

  console.log('=== QB RECOVER ===');
  await page.goto(QB_URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

  let state = await parsePageState(page);
  await captureRoadblock(page, 'initial', 'boot state');

  const login = await ensureLoggedIn(page);
  if (!login.ok) {
    console.error('Login failed — check roadblock-screenshots/');
    await context.close();
    process.exit(1);
  }

  state = await parsePageState(page);
  const onQ1 = /^1\s*\/\s*50/.test(state.questionNumber || '') && state.hasNext;

  if (!onQ1) {
    console.log('\nNot on Q1 — trying auto handoff…');
    let { ok } = await runAutoHandoff(page, { q1TimeoutMs: 60000 });
    if (!ok) {
      console.log('\nAuto handoff failed — intuitive recovery…');
      const rec = await recoverFromRoadblock(page, 'qb-recover boot');
      ok = rec.ok;
    }
    if (!ok) {
      console.error('\nCould not reach Q1/50. See roadblock-screenshots/');
      await context.close();
      process.exit(1);
    }
  }

  state = await parsePageState(page);
  console.log(`\n✓ Ready: ${state.questionNumber}  ${state.questionId}`);
  console.log('Recovery complete.\n');
  await context.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
