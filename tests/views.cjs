#!/usr/bin/env node
/* Layout check across devices and languages: title, settings, stage select, a stage, a dialogue. */
'use strict';
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = process.env.OUT || 'shots';
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = [
  ['iphone-se', devices['iPhone SE']],
  ['galaxy-s9', devices['Galaxy S9+']],
  ['iphone13-land', devices['iPhone 13 landscape']],
  ['ipad', devices['iPad Mini']],
  ['desktop', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }]
];
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [name, dev] of VIEWS) {
    const ctx = await browser.newContext({ ...dev });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
    await page.goto(BASE);
    await page.waitForSelector('#scr-title:not([hidden])');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}-title.png` });
    await page.evaluate(() => { DD.Save.data.entered = true; DD.Save.data.seenPrologue = true; DD.Save.data.stages['1-1'] = { clear: true, marble: true, unhurt: false, best: 20, score: 4200 }; DD.Director.showSelect(); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${name}-select.png` });
    await page.evaluate(() => DD.Director.startStage('2-2'));
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/${name}-stage.png` });
    await page.click('#hud-zoom');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}-zoom.png` });
    await page.click('#hud-pause');
    await page.click('#p-settings');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/${name}-settings.png` });
    // overflow check: nothing should scroll sideways
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (over) errors.push(name + ': horizontal overflow');
    await ctx.close();
  }
  // languages on a phone
  for (const lang of ['ko', 'ja', 'zh', 'fr', 'es']) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(lang + ' pageerror: ' + e.message));
    await page.goto(BASE);
    await page.waitForSelector('#scr-title:not([hidden])');
    await page.evaluate((l) => { DD.UI.setLanguage(l); DD.Director.showTitle(); }, lang);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/lang-${lang}-title.png` });
    await page.click('#btn-play');
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${OUT}/lang-${lang}-narr.png` });
    await page.evaluate(() => { DD.Save.data.entered = true; DD.Director.showSelect(); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/lang-${lang}-select.png` });
    await page.evaluate(() => DD.Director.interlude(2));
    await page.waitForTimeout(3600);
    await page.screenshot({ path: `${OUT}/lang-${lang}-dialog.png` });
    await ctx.close();
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
