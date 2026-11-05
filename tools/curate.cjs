#!/usr/bin/env node
/* Drafts the story stages: for each recipe, tries many seeds, keeps the best-scoring solvable layout,
 * and writes src/levels.js. Run once; the output is committed and then frozen.
 *   node tools/curate.cjs            (all stages)
 *   node tools/curate.cjs 2-3 3-5    (only these, others are kept from the existing file)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DD = require('./load.cjs')({ skip: ['levels.js', 'i18n.js'] });

const L1 = 2.8, L2 = 2.5, L3 = 2.25;
const B = (n, lo, hi) => ({ balloons: n, balloonSpeed: [lo, hi] });
// Each stage is bigger than it looks on screen: plenty of stardust to run through, several shards to hunt.
const recipes = {
  '1-1': { w: 6, h: 9, shards: 4, loops: 0.14, marble: true, light: L1, target: 45, hints: ['hint.move', 'hint.dust', 'hint.shards'] },
  '1-2': { w: 6, h: 10, shards: 4, loops: 0.16, marble: true, light: L1, target: 55, hints: ['hint.tapMove', 'hint.zoom', 'hint.marble'] },
  '1-3': { w: 7, h: 10, shards: 5, loops: 0.18, marble: true, ...B(1, 0.9, 1.05), light: L1, target: 60, hints: ['hint.balloon'] },
  '1-4': { w: 7, h: 10, shards: 4, loops: 0.12, marble: true, switches: 1, colorFrac: 0.28, require: { toggles: 2 }, light: L1, target: 65, hints: ['hint.switch'] },
  '1-5': { w: 7, h: 11, shards: 5, loops: 0.14, marble: true, switches: 1, colorFrac: 0.25, require: { toggles: 2 }, ...B(1, 0.95, 1.1), light: L1, target: 75 },
  '1-6': { w: 7, h: 11, shards: 5, loops: 0.22, marble: true, ...B(2, 0.95, 1.15), light: L1, target: 75 },
  '1-7': { w: 8, h: 11, shards: 5, loops: 0.16, marble: true, switches: 2, colorFrac: 0.24, require: { toggles: 3 }, ...B(2, 1.0, 1.15), light: L1, target: 85 },
  '1-8': { w: 8, h: 12, shards: 6, loops: 0.18, marble: true, switches: 1, colorFrac: 0.22, require: { toggles: 2 }, ...B(2, 1.0, 1.2), light: L1, target: 95 },
  '1-9': { w: 8, h: 12, shards: 6, loops: 0.2, marble: true, switches: 1, colorFrac: 0.26, require: { toggles: 3 }, ...B(3, 1.0, 1.2), light: L1, target: 100 },
  '1-10': { w: 9, h: 13, shards: 6, loops: 0.2, marble: true, switches: 2, colorFrac: 0.24, require: { toggles: 3 }, ...B(2, 1.0, 1.2), hands: { every: [9, 12], warn: 1.55 }, light: L1, target: 110, hints: ['hint.hand'] },
  '2-1': { w: 7, h: 10, shards: 4, loops: 0.1, marble: true, rotators: 2, require: { rotations: 3 }, light: L2, target: 65, hints: ['hint.rotate'] },
  '2-2': { w: 7, h: 11, shards: 5, loops: 0.12, marble: true, rotators: 2, switches: 1, colorFrac: 0.2, require: { rotations: 2, toggles: 1 }, light: L2, target: 75 },
  '2-3': { w: 8, h: 11, shards: 5, loops: 0.22, marble: true, switches: 1, colorFrac: 0.2, require: { toggles: 2 }, ...B(1, 1.0, 1.15), hands: { every: [7.5, 10], warn: 1.5 }, light: L2, target: 85 },
  '2-4': { w: 8, h: 12, shards: 5, loops: 0.2, marble: true, oneway: 5, require: { oneways: 2 }, hands: { every: [8, 11], warn: 1.5 }, light: L2, target: 90, hints: ['hint.oneway'] },
  '2-5': { w: 8, h: 12, shards: 5, loops: 0.14, marble: true, lock: 1, rotators: 1, require: { unlocks: 1, rotations: 1 }, ...B(1, 1.0, 1.15), light: L2, target: 95, hints: ['hint.key'] },
  '2-6': { w: 8, h: 12, shards: 5, loops: 0.16, marble: true, rotators: 2, oneway: 3, require: { rotations: 2, oneways: 1 }, ...B(2, 1.0, 1.2), light: L2, target: 95 },
  '2-7': { w: 9, h: 12, shards: 6, loops: 0.16, marble: true, lock: 1, switches: 1, colorFrac: 0.2, require: { unlocks: 1, toggles: 2 }, hands: { every: [7, 10], warn: 1.45 }, light: L2, target: 105 },
  '2-8': { w: 9, h: 13, shards: 6, loops: 0.18, marble: true, oneway: 4, rotators: 1, require: { oneways: 1, rotations: 1 }, ...B(3, 1.05, 1.2), light: L2, target: 110 },
  '2-9': { w: 9, h: 13, shards: 6, loops: 0.18, marble: true, lock: 1, oneway: 3, require: { unlocks: 1, oneways: 1 }, ...B(2, 1.05, 1.2), hands: { every: [6.5, 9], warn: 1.4 }, light: L2, target: 115 },
  '2-10': { w: 9, h: 14, shards: 6, loops: 0.16, marble: true, rotators: 2, switches: 1, colorFrac: 0.18, lock: 1, require: { rotations: 2, toggles: 1, unlocks: 1 }, seeds: 80, ...B(2, 1.05, 1.25), hands: { every: [6, 8.5], warn: 1.4 }, light: L2, target: 125 },
  '3-1': { w: 8, h: 11, shards: 5, loops: 0.22, marble: true, crumble: 4, require: { crumbles: 2 }, ...B(1, 1.0, 1.15), light: L3, target: 85, hints: ['hint.crumble'] },
  '3-2': { w: 8, h: 12, shards: 5, loops: 0.18, marble: true, portal: 1, oneway: 3, require: { portals: 1, oneways: 1 }, hands: { every: [7, 9.5], warn: 1.4 }, light: L3, target: 95, hints: ['hint.portal'] },
  '3-3': { w: 8, h: 12, shards: 5, loops: 0.2, marble: true, crumble: 3, portal: 1, require: { crumbles: 1, portals: 1 }, ...B(2, 1.05, 1.25), light: L3, target: 100 },
  '3-4': { w: 9, h: 12, shards: 6, loops: 0.2, marble: true, crumble: 3, switches: 1, colorFrac: 0.18, require: { crumbles: 1, toggles: 2 }, hands: { every: [6, 8.5], warn: 1.35 }, light: L3, target: 110 },
  '3-5': { w: 9, h: 13, shards: 6, loops: 0.16, marble: true, portal: 1, lock: 1, rotators: 1, require: { portals: 1, unlocks: 1, rotations: 1 }, seeds: 80, ...B(2, 1.05, 1.25), light: L3, target: 115 },
  '3-6': { w: 9, h: 13, shards: 6, loops: 0.2, marble: true, crumble: 3, oneway: 3, require: { crumbles: 1, oneways: 1 }, ...B(2, 1.05, 1.25), hands: { every: [6, 8], warn: 1.35 }, light: L3, target: 120 },
  '3-7': { w: 9, h: 14, shards: 6, loops: 0.16, marble: true, switches: 1, colorFrac: 0.18, rotators: 1, portal: 1, require: { toggles: 1, rotations: 1, portals: 1 }, seeds: 80, hands: { every: [5.5, 8], warn: 1.3 }, light: L3, target: 125 },
  '3-8': { w: 10, h: 14, shards: 6, loops: 0.18, marble: true, crumble: 2, lock: 1, portal: 1, require: { crumbles: 1, unlocks: 1, portals: 1 }, seeds: 80, ...B(3, 1.05, 1.3), light: L3, target: 130 },
  '3-9': { w: 10, h: 15, shards: 6, loops: 0.18, marble: true, switches: 1, colorFrac: 0.16, oneway: 3, crumble: 2, lock: 1, require: { toggles: 1, oneways: 1, unlocks: 1 }, seeds: 60, ...B(3, 1.1, 1.3), hands: { every: [5.5, 7.5], warn: 1.3 }, light: L3, target: 140 },
  '3-10': { w: 10, h: 16, shards: 6, loops: 0.16, marble: true, switches: 1, colorFrac: 0.16, rotators: 1, crumble: 2, portal: 1, lock: 1, require: { toggles: 1, rotations: 1, portals: 1, unlocks: 1 }, seeds: 50, ...B(3, 1.1, 1.3), hands: { every: [4.5, 6.5], warn: 1.25 }, light: L3, target: 150, hints: ['hint.final'] }
};
const handmade = {};

function score(def, r) {
  const u = def.usage || {};
  let s = 0;
  for (const k of ['toggles', 'rotations', 'crumbles', 'portals', 'unlocks', 'oneways']) s += Math.min(u[k] || 0, 4) * 6;
  s += Math.min(def.optimal, r.target) * 0.3 - Math.abs(def.optimal - r.target) * 0.5;
  return s;
}

function curate(id) {
  const r = recipes[id];
  let best = null;
  for (let seed = 1; seed <= (r.seeds || 160); seed++) {
    const p = Object.assign({ id, tries: 2, repairs: 12, cap: 600000, straight: 0.7 }, r);
    const def = DD.Gen.make(p, DD.hash(id) + seed * 101);
    if (def.attempt === undefined || def.attempt >= p.tries) continue; // plain fallback
    if (!def.map.join('').includes('M')) continue;
    const sc = score(def, r);
    if (!best || sc > best.sc) best = { sc, def, seed };
  }
  if (!best) throw new Error('no layout for ' + id);
  const d = best.def;
  const out = { id, light: r.light, hints: r.hints || [], map: d.map, rot: d.rot };
  if (d.balloons) out.balloons = d.balloons;
  if (r.hands) out.hands = r.hands;
  console.error(id, 'seed', best.seed, 'moves', d.optimal, 'par', d.par, 'usage', JSON.stringify(d.usage));
  return out;
}

function main() {
  const only = process.argv.slice(2);
  const file = path.join(__dirname, '..', 'src', 'levels.js');
  let existing = {};
  if (only.length && fs.existsSync(file)) {
    delete globalThis.DD.STAGES;
    require(file);
    for (const s of globalThis.DD.STAGES) existing[s.id] = s;
  }
  const ids = Object.keys(recipes);
  const stages = ids.map((id) => {
    if (handmade[id]) return handmade[id];
    if (only.length && !only.includes(id) && existing[id]) return existing[id];
    return curate(id);
  });
  for (const s of stages) {
    const L = DD.Level.parse(s);
    const sol = DD.Solver.solve(L, { maxStates: 3000000 });
    if (!sol.ok) throw new Error('unsolvable ' + s.id);
    s.par = DD.Solver.parFor(L, sol);
  }
  const body = stages.map((s) => {
    const lines = [];
    lines.push('    {');
    lines.push(`      id: '${s.id}', light: ${s.light}, par: ${s.par}, hints: ${JSON.stringify(s.hints).replace(/"/g, "'")},`);
    lines.push('      map: [');
    lines.push(s.map.map((row) => `        '${row}'`).join(',\n'));
    lines.push('      ],');
    lines.push(`      rot: ${JSON.stringify(s.rot).replace(/"/g, "'")}` + (s.balloons || s.hands ? ',' : ''));
    if (s.balloons) lines.push(`      balloons: ${JSON.stringify(s.balloons).replace(/"/g, "'")}` + (s.hands ? ',' : ''));
    if (s.hands) lines.push(`      hands: ${JSON.stringify(s.hands).replace(/"/g, "'")}`);
    lines.push('    }');
    return lines.join('\n');
  }).join(',\n');
  const src = `/* Daedalus Dream — the thirty story stages (drafted by tools/curate.cjs, verified by tools/verify.cjs).
 * See src/level.js for the map legend. Chapter = first digit.
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  DD.STAGES = [
${body}
  ];
  DD.CHAPTERS = [
    { n: 1, stages: ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9', '1-10'] },
    { n: 2, stages: ['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10'] },
    { n: 3, stages: ['3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9', '3-10'] }
  ];
})();
`;
  fs.writeFileSync(file, src);
  console.error('wrote', file);
}
main();
