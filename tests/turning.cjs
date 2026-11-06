#!/usr/bin/env node
/* Checks the pace and the turn helpers: seconds per joint, an early swipe is remembered,
 * and a swipe made just after passing a corner still takes that corner. */
'use strict';
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails++; };
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
  await page.goto(BASE);
  await page.waitForSelector('#scr-title:not([hidden])');
  await page.evaluate(() => { DD.Save.data.entered = true; DD.Save.data.seenHints = { 'hint.move': 1, 'hint.dust': 1, 'hint.shards': 1 }; });

  // find, in stage 1-2, a joint with a straight bar in and a side branch (a fork she runs past)
  const setup = () => page.evaluate(() => {
    DD.Director.startStage('1-2');
    const G = DD.Game.get(), L = G.L;
    const can = (n, d) => DD.Level.canMove(L, G.st, n, d) >= 0;
    for (let n = 0; n < L.N; n++) {
      if (!L.node[n]) continue;
      for (let d = 0; d < 4; d++) {
        const side = (d + 1) & 3;
        const back = (d + 2) & 3;
        if (can(n, d) && can(n, back) && can(n, side)) {
          const prev = DD.Level.other(L.edges[L.adj[n * 4 + back]], n);
          if (L.feat[prev] === 'o' && L.feat[n] === 'o') return { fork: n, prev, d, side };
        }
      }
    }
    return null;
  });
  const f = await setup();
  if (!f) throw new Error('no fork found');

  // pace
  await page.evaluate((f) => { const G = DD.Game.get(); G.god = true; G.st.pos = f.prev; G.girl.mv = null; G.hands.length = 0; DD.Game.holdInput(f.d); DD.Game.release(); }, f);
  const t0 = Date.now();
  await page.waitForFunction((f) => DD.Game.get().st.pos === f.fork, f, { timeout: 5000 });
  const perJoint = (Date.now() - t0) / 1000;
  check(perJoint > 0.27 && perJoint < 0.5, `one joint takes ${perJoint.toFixed(2)} s from a standstill (playable range 0.27–0.5 s)`);

  // early swipe is remembered and taken at the fork
  await setup();
  await page.evaluate((f) => { const G = DD.Game.get(); G.god = true; G.st.pos = f.prev; G.girl.mv = null; DD.Game.holdInput(f.d); DD.Game.release(); }, f);
  await page.waitForTimeout(90);
  await page.evaluate((f) => { DD.Game.holdInput(f.side); DD.Game.release(); }, f);
  await page.waitForFunction((f) => { const G = DD.Game.get(); return G.girl.mv && G.girl.mv.from === f.fork; }, f, { timeout: 4000 });
  check(await page.evaluate((f) => DD.Game.get().girl.mv.d === f.side, f), 'a swipe made before the fork is taken at the fork');

  // late swipe: just after passing the fork, still turns there
  await setup();
  await page.evaluate((f) => { const G = DD.Game.get(); G.god = true; G.st.pos = f.prev; G.girl.mv = null; DD.Game.holdInput(f.d); DD.Game.release(); }, f);
  await page.waitForFunction((f) => { const G = DD.Game.get(); return G.girl.mv && G.girl.mv.from === f.fork && G.girl.mv.t > 0.05; }, f, { timeout: 4000 });
  await page.evaluate((f) => { DD.Game.holdInput(f.side); DD.Game.release(); }, f);
  await page.waitForFunction((f) => { const G = DD.Game.get(); return G.girl.mv && !G.girl.mv.reversed && G.girl.mv.from === f.fork; }, f, { timeout: 4000 });
  check(await page.evaluate((f) => DD.Game.get().girl.mv.d === f.side, f), 'a swipe made just after passing the fork still turns there');

  await browser.close();
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll turning checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
