#!/usr/bin/env node
/* Interaction checks on a touch phone: tap-to-walk, spinning joints, keyboard, on-screen arrows,
 * pause/resume, double-tap restart, getting caught, the "stuck" warning, auto-pause when hidden,
 * saved language, erasing progress, and offline play through the service worker.
 */
'use strict';
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(BASE);
  await page.waitForSelector('#scr-title:not([hidden])');
  await page.evaluate(() => { DD.Save.data.entered = true; DD.Save.data.seenPrologue = true; DD.Save.save(); });

  // ---- spinning a joint by tapping it (stage 2-1) ----
  await page.evaluate(() => DD.Director.startStage('2-1'));
  await page.waitForTimeout(1200);
  const spin = await page.evaluate(() => {
    const G = DD.Game.get(); const L = G.L;
    const r = L.rotators[0];
    G.discovered[r.node] = 1;
    const before = G.st.rot[0];
    // find the screen position through the game's own view math
    const x = r.node % L.w, y = (r.node / L.w) | 0;
    return { before, x, y };
  });
  // read view transform after a frame
  const view = await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
    const G = DD.Game.get();
    res({ s: G.cam.s });
  })));
  const pos = await page.evaluate(({ x, y }) => {
    // invert draw(): screen = ox + x*s ; ox = w/2 - cam.x*s ; oy = top + playH/2 - cam.y*s
    const G = DD.Game.get();
    const c = document.getElementById('stage');
    const w = c.clientWidth, h = c.clientHeight;
    const hud = document.querySelector('.hud-top').getBoundingClientRect();
    const top = Math.max(0, hud.bottom - 14);
    const playH = h - top;
    return { sx: w / 2 - G.cam.x * G.cam.s + x * G.cam.s, sy: top + playH / 2 - G.cam.y * G.cam.s + y * G.cam.s };
  }, spin);
  await page.evaluate(() => { DD.Game.get().cam.overview = true; });
  await page.waitForTimeout(1200);
  const pos2 = await page.evaluate(({ x, y }) => {
    const G = DD.Game.get();
    const c = document.getElementById('stage');
    const w = c.clientWidth, h = c.clientHeight;
    const hud = document.querySelector('.hud-top').getBoundingClientRect();
    const top = Math.max(0, hud.bottom - 14);
    return { sx: w / 2 - G.cam.x * G.cam.s + x * G.cam.s, sy: top + (h - top) / 2 - G.cam.y * G.cam.s + y * G.cam.s };
  }, spin);
  await page.touchscreen.tap(pos2.sx, pos2.sy);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => DD.Game.get().st.rot[0]);
  check(after !== spin.before, `tapping a turning joint spins it (${spin.before} → ${after})`);

  // ---- tap to walk to a seen joint ----
  await page.evaluate(() => DD.Director.startStage('1-2'));
  await page.waitForTimeout(1500);
  const target = await page.evaluate(() => {
    const G = DD.Game.get(); const L = G.L;
    // the farthest joint reachable through seen joints only
    const dist = new Map([[L.start, 0]]), q = [L.start];
    let best = -1;
    for (let i = 0; i < q.length; i++) {
      for (let d = 0; d < 4; d++) {
        const e = DD.Level.canMove(L, G.st, q[i], d);
        if (e < 0) continue;
        const m = DD.Level.other(L.edges[e], q[i]);
        if (!G.discovered[m] || dist.has(m) || L.feat[m] === 'T' || L.portal[m] >= 0) continue;
        dist.set(m, dist.get(q[i]) + 1); q.push(m);
        if (dist.get(m) >= 2) best = m;
      }
    }
    return best;
  });
  const tp = await page.evaluate((n) => {
    const G = DD.Game.get(); const L = G.L;
    const c = document.getElementById('stage');
    const w = c.clientWidth, h = c.clientHeight;
    const hud = document.querySelector('.hud-top').getBoundingClientRect();
    const top = Math.max(0, hud.bottom - 14);
    const x = n % L.w, y = (n / L.w) | 0;
    return { sx: w / 2 - G.cam.x * G.cam.s + x * G.cam.s, sy: top + (h - top) / 2 - G.cam.y * G.cam.s + y * G.cam.s };
  }, target);
  await page.touchscreen.tap(tp.sx, tp.sy);
  await page.waitForTimeout(2500);
  const arrived = await page.evaluate((n) => DD.Game.get().st.pos === n, target);
  check(target >= 0 && arrived, 'tapping a seen joint walks the girl there');

  // ---- keyboard ----
  const kb = await page.evaluate(() => DD.Game.get().st.pos);
  for (const k of ['ArrowUp', 'ArrowRight', 'ArrowLeft', 'ArrowDown']) {
    await page.keyboard.down(k); await page.waitForTimeout(250); await page.keyboard.up(k); await page.waitForTimeout(350);
  }
  const kb2 = await page.evaluate(() => DD.Game.get().st.pos);
  check(kb !== kb2, 'arrow keys move the girl');

  // ---- on-screen arrows ----
  await page.evaluate(() => { DD.Save.data.dpad = true; DD.Director.startStage('1-1'); });
  await page.waitForTimeout(1200);
  check(await page.locator('#dpad').isVisible(), 'on-screen arrows appear when enabled');
  const d0 = await page.evaluate(() => DD.Game.get().st.pos);
  const up = page.locator('.dp.up');
  const ub = await up.boundingBox();
  await page.touchscreen.tap(ub.x + ub.width / 2, ub.y + ub.height / 2);
  await page.waitForTimeout(700);
  const d1 = await page.evaluate(() => DD.Game.get().st.pos);
  check(d0 !== d1, 'on-screen up arrow moves the girl');
  await page.evaluate(() => { DD.Save.data.dpad = false; });

  // ---- pause / resume ----
  await page.click('#hud-pause');
  const t0 = await page.evaluate(() => DD.Game.get().time);
  await page.waitForTimeout(800);
  const t1 = await page.evaluate(() => DD.Game.get().time);
  check(await page.locator('#modal-pause').isVisible() && t0 === t1, 'pause stops time');
  await page.click('#p-resume');
  await page.waitForTimeout(500);
  const t2 = await page.evaluate(() => DD.Game.get().time);
  check(t2 > t1, 'resume continues');

  // ---- restart needs two taps ----
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => DD.Game.get().time);
  await page.click('#hud-restart');
  await page.waitForTimeout(300);
  const still = await page.evaluate(() => DD.Game.get().time);
  await page.click('#hud-restart');
  await page.waitForTimeout(300);
  const reset = await page.evaluate(() => DD.Game.get().time);
  check(still >= before && reset < 0.6, 'restart asks for a second tap, then restarts');

  // ---- getting caught ----
  await page.evaluate(() => DD.Director.startStage('2-3'));
  await page.waitForTimeout(2000);
  await page.evaluate(() => { const G = DD.Game.get(); G.hearts = 1; G.girl.grace = 0; G.girl.inv = 0; G.hands.push({ x: G.st.pos % G.L.w, y: (G.st.pos / G.L.w) | 0, t: 0, warn: 0.3, phase: 'warn' }); });
  await page.waitForSelector('#modal-result:not([hidden])', { timeout: 8000 });
  const title = await page.textContent('#res-title');
  check(/Caught/.test(title), 'losing every heart shows “Caught!”');
  await page.waitForTimeout(600);
  await page.click('#res-actions .pipe.primary');
  await page.waitForTimeout(800);
  check(await page.evaluate(() => DD.Game.get() && DD.Game.get().hearts === 3 && !DD.Game.get().ended), 'try again restarts with full hearts');

  // ---- stuck warning after a rusty bar breaks the only way ----
  await page.evaluate(() => DD.Director.startStage('3-1'));
  await page.waitForTimeout(800);
  const canStick = await page.evaluate(() => {
    const G = DD.Game.get();
    const s = DD.Level.cloneState(G.st);
    s.crumbled = (1 << G.L.crumbles.length) - 1;
    return !DD.Solver.solve(G.L, { from: s, maxStates: 20000 }).ok;
  });
  if (canStick) {
    await page.evaluate(() => { const G = DD.Game.get(); G.st.crumbled = (1 << G.L.crumbles.length) - 1; G.stuckCheckT = 0.05; });
    await page.waitForTimeout(600);
    check(await page.evaluate(() => DD.Game.get().stuck && document.getElementById('hud-restart').classList.contains('pulse')), 'an impossible state shows the restart hint');
  } else console.log('  - (3-1 stays solvable with every rusty bar broken; stuck check skipped)');

  // ---- auto-pause when the app goes to the background ----
  await page.evaluate(() => DD.Director.startStage('1-1'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(200);
  check(await page.locator('#modal-pause').isVisible(), 'leaving the app pauses the game');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });

  // ---- language is remembered; erase progress keeps settings ----
  await page.evaluate(() => { DD.UI.setLanguage('ko'); });
  await page.reload();
  await page.waitForSelector('#scr-title:not([hidden])');
  check((await page.textContent('.game-title')).includes('다이달로스'), 'chosen language survives a reload');
  await page.click('#btn-settings');
  await page.click('#set-reset');
  await page.click('#confirm-yes');
  await page.waitForTimeout(400);
  const erased = await page.evaluate(() => ({ entered: DD.Save.data.entered, lang: DD.Save.data.lang, stars: DD.Save.totals().stars }));
  check(!erased.entered && erased.lang === 'ko' && erased.stars === 0, 'erasing progress resets the story but keeps the language');
  await page.evaluate(() => { DD.UI.setLanguage('en'); });

  // ---- offline play via the service worker ----
  await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await page.waitForTimeout(1500);
  await ctx.setOffline(true);
  await page.reload();
  const offlineOk = await page.waitForSelector('#scr-title:not([hidden])', { timeout: 8000 }).then(() => true).catch(() => false);
  check(offlineOk, 'the game opens with no network after the first visit');
  await ctx.setOffline(false);

  const real = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource|fonts\.g/.test(e));
  check(real.length === 0, 'no page errors' + (real.length ? ':\n' + real.join('\n') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll interaction checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
