#!/usr/bin/env node
/* Full run: auto-plays all 30 story stages (collecting every golden marble), the interludes,
 * the true ending, and several Endless Gym floors, on a phone viewport. Fails on any page error.
 *   BASE=http://127.0.0.1:8765/ OUT=./shots node tests/full.cjs
 */
'use strict';
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = process.env.OUT || 'shots';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  const visible = (sel) => page.locator(sel).isVisible();
  const tap = async (sel) => { try { await page.locator(sel).click({ position: { x: 150, y: 250 }, timeout: 800 }); } catch (e) { /* changed */ } };
  async function tapUntil(cond, max = 80, shots) {
    for (let i = 0; i < max; i++) {
      if (await cond()) return true;
      if (shots && i % 4 === 0) await shot(shots + '-' + i);
      if (await visible('#scr-narr')) await tap('#scr-narr');
      else if (await visible('#scr-dialog')) await tap('#scr-dialog');
      await page.waitForTimeout(450);
    }
    return cond();
  }

  await page.goto(BASE);
  await page.waitForSelector('#scr-title:not([hidden])');
  await page.evaluate(() => { DD.Save.reset(); DD.Save.data.entered = true; DD.Save.data.seenPrologue = true; DD.Save.data.interludes = { 1: true, 2: true }; DD.Save.save(); });

  const ids = await page.evaluate(() => DD.STAGES.map((s) => s.id));
  for (const id of ids) {
    await page.evaluate((sid) => { DD.Director.startStage(sid); DD.Game.setGod(true); DD.Game.autoplay(true, true); DD.timeScale = 4; }, id);
    await page.waitForTimeout(1200);
    await shot('stage-' + id);
    await page.waitForSelector('#modal-result:not([hidden])', { timeout: 120000 });
    const rec = await page.evaluate((sid) => DD.Save.stage(sid), id);
    const ok = rec.clear && rec.marble;
    console.log(`${id}: clear=${rec.clear} marble=${rec.marble} unhurt=${rec.unhurt} score=${rec.score} time=${rec.best.toFixed(1)}`);
    if (!ok) errors.push('stage ' + id + ' not fully cleared');
  }
  await page.evaluate(() => { DD.timeScale = 1; });
  const totals = await page.evaluate(() => DD.Save.totals());
  console.log('totals', JSON.stringify(totals));

  // interlude screens
  await page.evaluate(() => DD.Director.interlude(1));
  await page.waitForTimeout(2600);
  await shot('interlude-1');
  await tapUntil(() => page.evaluate(() => DD.Director.mode() === 'play'));
  await page.evaluate(() => DD.Director.interlude(2));
  await page.waitForTimeout(3000);
  await shot('interlude-2');
  await tapUntil(() => page.evaluate(() => DD.Director.mode() === 'play'));

  // the (true) ending
  await page.evaluate(() => DD.Director.ending());
  await page.waitForTimeout(2500);
  await shot('ending-door');
  const reached = await tapUntil(() => visible('#scr-select'), 160, 'ending');
  if (!reached) errors.push('ending did not finish');
  const after = await page.evaluate(() => ({ cleared: DD.Save.data.storyCleared, trueEnd: DD.Save.data.trueEnding }));
  console.log('after ending', JSON.stringify(after));
  await shot('select-after-ending');

  // Endless Gym: auto-play a few floors
  await page.evaluate(() => { DD.Save.data.endlessIntro = true; DD.Director.startEndless(); });
  for (let f = 0; f < 6; f++) {
    await page.waitForFunction(() => DD.Director.mode() === 'play' && DD.Game.get() && !DD.Game.get().ended, null, { timeout: 30000 });
    await page.evaluate(() => { DD.Game.setGod(true); DD.Game.autoplay(true, false); DD.timeScale = 4; });
    if (f === 0 || f === 5) { await page.waitForTimeout(800); await shot('endless-' + (f + 1)); }
    await page.waitForFunction((d) => DD.Director.endless() && DD.Director.endless().depth > d, f + 1, { timeout: 120000 });
  }
  const E = await page.evaluate(() => DD.Director.endless());
  console.log('endless depth', E.depth, 'best', await page.evaluate(() => DD.Save.data.endlessBest));
  // get caught on purpose
  await page.waitForFunction(() => DD.Director.mode() === 'play' && DD.Game.get() && !DD.Game.get().ended, null, { timeout: 30000 });
  await page.evaluate(() => { DD.timeScale = 1; const G = DD.Game.get(); G.god = false; G.girl.grace = 0; G.hearts = 1; });
  await page.evaluate(() => { const G = DD.Game.get(); G.girl.inv = 0; G.hands.push({ x: G.st.pos % G.L.w, y: (G.st.pos / G.L.w) | 0, t: 0, warn: 0.2, phase: 'warn' }); DD.Game.autoplay(false); });
  await page.waitForSelector('#modal-result:not([hidden])', { timeout: 20000 });
  await page.waitForTimeout(800);
  await shot('endless-over');

  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
