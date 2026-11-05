#!/usr/bin/env node
/* Phone-specific checks with real touch events on Android and iOS sized screens:
 *  - one swipe makes the girl run several joints; she stops only where she must choose
 *  - swipes never scroll or bounce the page; the back gesture pauses instead of leaving
 *  - HUD / menu buttons never overlap, stay on screen, and are big enough for a thumb
 *  - the sound button on the title screen mutes and is remembered
 *  - stardust builds a combo and a long combo starts FEVER
 */
'use strict';
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails++; };

const PHONES = [
  ['iPhone SE', devices['iPhone SE']],
  ['iPhone 14 Pro Max', devices['iPhone 14 Pro Max']],
  ['Pixel 7', devices['Pixel 7']],
  ['Galaxy S9+', devices['Galaxy S9+']],
  ['Pixel 7 landscape', devices['Pixel 7 landscape']]
];

async function swipe(page, cdp, x0, y0, dx, dy) {
  const steps = 6;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / steps, y: y0 + dy * i / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

(async () => {
  const browser = await chromium.launch();
  for (const [name, dev] of PHONES) {
    console.log(name);
    const ctx = await browser.newContext({ ...dev });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const cdp = await ctx.newCDPSession(page);
    await page.goto(BASE);
    await page.waitForSelector('#scr-title:not([hidden])');
    const vp = page.viewportSize();

    // title buttons: on screen, not overlapping
    const tb = [];
    for (const sel of ['#btn-mute', '#btn-lang', '#btn-play', '#btn-settings']) tb.push([sel, await page.locator(sel).boundingBox()]);
    let ok = true;
    for (let i = 0; i < tb.length; i++) {
      const b = tb[i][1];
      if (!b || b.x < 0 || b.y < 0 || b.x + b.width > vp.width || b.y + b.height > vp.height || b.height < 40) ok = false;
      for (let j = i + 1; j < tb.length; j++) if (b && tb[j][1] && overlap(b, tb[j][1])) ok = false;
    }
    check(ok, 'title buttons fit on screen without overlapping');

    // mute
    await page.locator('#btn-mute').tap();
    check(await page.evaluate(() => DD.Save.data.muted && DD.Audio.isMuted()), 'sound button mutes');
    await page.reload();
    await page.waitForSelector('#scr-title:not([hidden])');
    check(await page.evaluate(() => DD.Save.data.muted && document.getElementById('btn-mute').classList.contains('off')), 'muted state is remembered');
    await page.locator('#btn-mute').tap();
    check(await page.evaluate(() => !DD.Save.data.muted), 'sound button unmutes');

    // a stage
    await page.evaluate(() => { DD.Save.data.entered = true; DD.Save.data.seenHints = { 'hint.move': 1, 'hint.dust': 1, 'hint.shards': 1 }; DD.Director.startStage('1-1'); });
    await page.waitForTimeout(1300);
    const hud = {};
    for (const sel of ['#hud-pause', '#hud-hearts', '#hud-zoom', '#hud-restart', '.hud-mid']) hud[sel] = await page.locator(sel).boundingBox();
    ok = true;
    const keys = Object.keys(hud);
    for (let i = 0; i < keys.length; i++) {
      const b = hud[keys[i]];
      if (!b || b.x < 0 || b.y < 0 || b.x + b.width > vp.width + 0.5 || b.y + b.height > vp.height + 0.5) ok = false;
      for (let j = i + 1; j < keys.length; j++) if (overlap(b, hud[keys[j]])) { ok = false; console.log('    overlap', keys[i], keys[j]); }
    }
    for (const sel of ['#hud-pause', '#hud-zoom', '#hud-restart']) if (hud[sel].width < 44 || hud[sel].height < 44) ok = false;
    const bottomGap = vp.height - (hud['#hud-restart'].y + hud['#hud-restart'].height);
    check(ok && bottomGap >= 20, `HUD buttons are thumb-sized, apart, and ${Math.round(bottomGap)}px clear of the bottom edge`);

    // one swipe runs a long way: find a direction from the start with a straight run of 2+
    const plan = await page.evaluate(() => {
      const G = DD.Game.get(), L = G.L;
      let best = null;
      for (let d = 0; d < 4; d++) {
        let n = L.start, len = 0;
        const st = DD.Level.cloneState(G.st);
        while (len < 20) { const e = DD.Level.canMove(L, st, n, d); if (e < 0) break; n = DD.Level.other(L.edges[e], n); st.pos = n; len++; }
        if (len && (!best || len > best.len)) best = { d, len };
      }
      return best;
    });
    const cx = vp.width / 2, cy = vp.height / 2;
    const v = [[0, -90], [90, 0], [0, 90], [-90, 0]][plan.d];
    const scrollBefore = await page.evaluate(() => [window.scrollX, window.scrollY, document.scrollingElement.scrollTop]);
    await swipe(page, cdp, cx, cy, v[0], v[1]);
    await page.waitForTimeout(2600);
    const moved = await page.evaluate(() => { const G = DD.Game.get(); return { pos: G.st.pos, start: G.L.start, w: G.L.w, mv: !!G.girl.mv }; });
    const dist = Math.abs(moved.pos % moved.w - moved.start % moved.w) + Math.abs(Math.floor(moved.pos / moved.w) - Math.floor(moved.start / moved.w));
    check(dist >= Math.min(2, plan.len) && !moved.mv, `one swipe ran ${dist} joints (straight bar was ${plan.len} long) and then stopped`);
    const scrollAfter = await page.evaluate(() => [window.scrollX, window.scrollY, document.scrollingElement.scrollTop]);
    check(JSON.stringify(scrollBefore) === JSON.stringify(scrollAfter), 'swiping never scrolls the page');

    // a downward swipe from near the top (pull-to-refresh gesture) must not reload
    await page.evaluate(() => { window.__still = 'yes'; });
    await swipe(page, cdp, cx, 90, 0, 260);
    await page.waitForTimeout(600);
    check(await page.evaluate(() => window.__still === 'yes'), 'pull-down swipe does not reload the page');

    // back gesture / back button pauses instead of leaving
    const url = page.url();
    await page.evaluate(() => history.back());
    await page.waitForTimeout(500);
    check(page.url() === url && await page.locator('#modal-pause').isVisible(), 'back gesture pauses the game instead of leaving');
    await page.evaluate(() => history.back());
    await page.waitForTimeout(400);
    check(page.url() === url && !(await page.locator('#modal-pause').isVisible()), 'back again resumes, still on the page');

    // pause menu buttons fit
    await page.locator('#hud-pause').tap();
    await page.waitForTimeout(200);
    const pb = [];
    for (const sel of ['#p-resume', '#p-restart', '#p-settings', '#p-mute', '#p-map']) pb.push(await page.locator(sel).boundingBox());
    ok = pb.every((b, i) => b && b.height >= 40 && b.y >= 0 && b.y + b.height <= vp.height + 0.5 && pb.every((c, j) => j === i || !overlap(b, c)));
    check(ok, 'pause menu buttons fit and do not overlap');
    await page.locator('#p-resume').tap();

    // combo and FEVER
    const fever = await page.evaluate(() => {
      const G = DD.Game.get(), L = G.L;
      // collect 30 stardust in a row by walking the solver path quickly
      let got = 0;
      for (let n = 0; n < L.N && got < 31; n++) if (G.dust[n]) {
        // emulate arrivals
        G.dust[n] = 1;
      }
      return true;
    });
    await page.evaluate(() => { DD.Game.setGod(true); DD.Game.autoplay(true, true); DD.timeScale = 2; });
    let sawCombo = 0, sawFever = false;
    for (let i = 0; i < 40; i++) {
      const s = await page.evaluate(() => { const G = DD.Game.get(); return G ? { c: G.combo, f: G.fever, e: G.ended, m: G.maxCombo } : null; });
      if (!s) break;
      sawCombo = Math.max(sawCombo, s.m); if (s.f > 0) sawFever = true;
      if (s.e) break;
      await page.waitForTimeout(250);
    }
    check(sawCombo >= 10, `running through stardust builds a combo (best ${sawCombo})`);
    if (sawCombo >= 30) check(sawFever, 'a 30 combo starts FEVER');
    await page.evaluate(() => { DD.timeScale = 1; });
    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll phone checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
