#!/usr/bin/env node
/* Static checks for Daedalus Dream. Exits non-zero on any problem.
 *  - every story stage parses, is solvable, its golden marble can be collected, and its goal time is current
 *  - balloons stay inside the stage and never start on top of the girl
 *  - every language has exactly the English keys and the same {placeholders}
 *  - every text key used by the code and the HTML exists
 *  - Endless Gym floors are always solvable and quick to generate
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DD = require('./load.cjs')();
const root = path.join(__dirname, '..');
let problems = 0;
const bad = (msg) => { problems++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

console.log('Story stages');
const ids = new Set();
let marbles = 0;
for (const def of DD.STAGES) {
  if (ids.has(def.id)) bad('duplicate stage id ' + def.id);
  ids.add(def.id);
  let L;
  try { L = DD.Level.parse(def); } catch (e) { bad(e.message); continue; }
  const t0 = Date.now();
  const sol = DD.Solver.solve(L, { maxStates: 4000000 });
  if (!sol.ok) { bad(def.id + ' is not solvable'); continue; }
  const par = DD.Solver.parFor(L, sol);
  if (par !== def.par) bad(`${def.id} goal time is ${def.par}, solver says ${par} (re-run tools/curate.cjs)`);
  if (L.marble < 0) bad(def.id + ' has no golden marble');
  else {
    const sm = DD.Solver.solve(L, { maxStates: 4000000, requireMarble: true });
    if (!sm.ok) bad(def.id + ': golden marble cannot be collected');
    else marbles++;
  }
  // the in-game "stuck" check must be able to answer quickly from the start position
  const quick = DD.Solver.solve(L, { maxStates: 60000 });
  const sx = L.start % L.w, sy = (L.start / L.w) | 0;
  for (const b of L.balloons) {
    for (const v of [b.ax, b.bx]) if (v < 0 || v > L.w - 1) bad(def.id + ' balloon outside the stage');
    for (const v of [b.ay, b.by]) if (v < 0 || v > L.h - 1) bad(def.id + ' balloon outside the stage');
    const len = Math.hypot(b.bx - b.ax, b.by - b.ay);
    for (let t = 0; t <= 2; t += 0.05) {
      let u = (b.phase + t * b.speed / len) % 2;
      if (u > 1) u = 2 - u;
      const x = b.ax + (b.bx - b.ax) * u, y = b.ay + (b.by - b.ay) * u;
      if (Math.hypot(x - sx, y - sy) < 1.2) { bad(def.id + ' balloon passes the start in the first 2s'); break; }
    }
  }
  if (L.hands && !(L.hands.every[0] > 2 && L.hands.every[1] >= L.hands.every[0] && L.hands.warn >= 0.9)) bad(def.id + ' unfair hand timing');
  for (const h of def.hints || []) if (!(h in DD.I18N.en)) bad(def.id + ' unknown hint ' + h);
  if (!(('st.' + def.id) in DD.I18N.en)) bad(def.id + ' has no name');
  ok(`${def.id}  ${L.w}x${L.h}  shards ${L.shards.length}  optimal ${sol.moves} moves + ${sol.rotations} turns  goal ${def.par}s  ${quick.ok ? '' : '(slow stuck-check)'}  ${Date.now() - t0}ms`);
}
if (DD.STAGES.length !== 15) bad('expected 15 stages');
if (marbles !== 15) bad('expected 15 collectable marbles, got ' + marbles);
for (const ch of DD.CHAPTERS) for (const id of ch.stages) if (!ids.has(id)) bad('chapter lists missing stage ' + id);

console.log('Text');
const en = DD.I18N.en;
const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
for (const lang of DD.LANGS) {
  const T = DD.I18N[lang];
  if (!T) { bad('missing language ' + lang); continue; }
  for (const k of Object.keys(en)) {
    if (!(k in T)) bad(`${lang} is missing ${k}`);
    else if (ph(T[k]) !== ph(en[k])) bad(`${lang} ${k} placeholders differ`);
    else if (!String(T[k]).trim()) bad(`${lang} ${k} is empty`);
  }
  for (const k of Object.keys(T)) if (!(k in en)) bad(`${lang} has extra key ${k}`);
}
// keys referenced from code and markup
const used = new Set();
const scan = (file) => {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9.\-]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/data-i18n(?:-aria)?="([a-zA-Z0-9.\-]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bkey:\s*'([a-zA-Z0-9.\-]+)'/g)) used.add(m[1]);
};
for (const f of fs.readdirSync(path.join(root, 'src'))) if (f.endsWith('.js') && f !== 'i18n.js') scan(path.join(root, 'src', f));
if (fs.existsSync(path.join(root, 'index.html'))) scan(path.join(root, 'index.html'));
for (const k of used) {
  if (/[.\-]$/.test(k)) { if (!Object.keys(en).some((e) => e.startsWith(k))) bad('code uses unknown text key prefix ' + k); continue; }
  if (!(k in en)) bad('code uses unknown text key ' + k);
}
ok(`${DD.LANGS.length} languages × ${Object.keys(en).length} keys; ${used.size} keys referenced`);

console.log('Endless Gym');
let worst = 0, sum = 0, n = 0;
for (let depth = 1; depth <= 80; depth++) {
  for (let s = 1; s <= 5; s++) {
    const seed = DD.hash('verify') + s * 7919 + depth;
    const p = DD.Gen.endlessParams(depth, DD.makeRng(seed));
    const t0 = Date.now();
    const def = DD.Gen.make(p, seed);
    const dt = Date.now() - t0;
    worst = Math.max(worst, dt); sum += dt; n++;
    let L;
    try { L = DD.Level.parse(def); } catch (e) { bad('depth ' + depth + ': ' + e.message); continue; }
    const sol = DD.Solver.solve(L, { maxStates: 2000000 });
    if (!sol.ok) bad(`depth ${depth} seed ${s} unsolvable`);
    if (def.map.length === 1) bad(`depth ${depth} seed ${s} used the emergency layout`);
  }
}
ok(`${n} floors, average ${(sum / n).toFixed(1)}ms, worst ${worst}ms`);

console.log(problems ? `\n${problems} problem(s) found.` : '\nAll checks passed.');
process.exit(problems ? 1 : 0);
