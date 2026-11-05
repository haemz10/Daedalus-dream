#!/usr/bin/env node
/* Quick browser smoke test: boots the game on a phone viewport, walks through the dream,
 * refuses three times, enters the maze, and auto-plays stage 1-1. Saves screenshots.
 *   BASE=http://127.0.0.1:8765/ OUT=./shots node tests/smoke.cjs
 */
'use strict';
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = process.env.OUT || 'shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); };
  const visible = (sel) => page.locator(sel).isVisible();
  const tap = async (sel) => { try { await page.locator(sel).click({ position: { x: 190, y: 300 }, timeout: 800 }); } catch (e) { /* screen changed */ } };
  const tapThrough = async (until, max = 40) => {
    for (let i = 0; i < max; i++) {
      if (await visible(until)) return true;
      if (await visible('#scr-narr')) await tap('#scr-narr');
      else if (await visible('#scr-dialog')) await tap('#scr-dialog');
      await page.waitForTimeout(520);
    }
    return visible(until);
  };

  await page.goto(BASE);
  await page.waitForSelector('#scr-title:not([hidden])');
  await page.waitForTimeout(800);
  await shot('01-title');
  await page.click('#btn-play');
  await page.waitForTimeout(1500);
  await shot('02-void');
  if (!(await tapThrough('#scr-choice'))) throw new Error('never reached the choice');
  await shot('03-choice');
  for (let n = 1; n <= 3; n++) {
    await page.waitForTimeout(500);
    await page.click('#ch-wake');
    await page.waitForTimeout(1800);
    await shot(`04-bedroom-${n}`);
    if (!(await tapThrough('#scr-choice'))) throw new Error('never came back to the choice');
    await shot(`05-choice-${n}`);
  }
  const refusals = await page.evaluate(() => DD.Save.data.refusals);
  if (refusals !== 3) throw new Error('refusals = ' + refusals);
  await page.waitForTimeout(500);
  await page.click('#ch-enter');
  await page.waitForTimeout(800);
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => DD.Director.mode() === 'play')) break;
    if (await visible('#scr-narr')) await tap('#scr-narr');
    else if (await visible('#scr-dialog')) await tap('#scr-dialog');
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(2500);
  await shot('06-stage-1-1');
  // swipe test: drag on the canvas
  const box = await page.locator('#stage').boundingBox();
  await page.mouse.move(box.width / 2, box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.width / 2 + 60, box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  const moved = await page.evaluate(() => DD.Game.get().st.pos !== DD.Game.get().L.start || !!DD.Game.get().girl.mv);
  console.log('swipe moved the girl:', moved);
  await page.evaluate(() => { DD.Game.setGod(true); DD.Game.autoplay(true, true); DD.timeScale = 3; });
  await page.waitForTimeout(1500);
  await shot('07-playing');
  await page.waitForSelector('#modal-result:not([hidden])', { timeout: 60000 });
  await page.waitForTimeout(900);
  await shot('08-result');
  const rec = await page.evaluate(() => DD.Save.stage('1-1'));
  console.log('1-1 record', JSON.stringify(rec));
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
