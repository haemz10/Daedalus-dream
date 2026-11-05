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

const L1 = 2.7, L2 = 2.4, L3 = 2.15;
const recipes = {
  '1-2': { w: 6, h: 8, shards: 4, loops: 0.12, marble: true, light: L1, target: 40, hints: ['hint.tapMove', 'hint.zoom', 'hint.marble'] },
  '1-3': { w: 6, h: 7, shards: 3, loops: 0.1, marble: true, switches: 1, colorFrac: 0.3, require: { toggles: 2 }, light: L1, target: 40, hints: ['hint.switch'] },
  '1-4': { w: 6, h: 8, shards: 4, loops: 0.2, marble: true, balloons: 2, balloonSpeed: [0.9, 1.1], light: L1, target: 45, hints: ['hint.balloon'] },
  '1-5': { w: 7, h: 9, shards: 5, loops: 0.14, marble: true, switches: 1, colorFrac: 0.25, require: { toggles: 2 }, balloons: 2, balloonSpeed: [0.95, 1.15], light: L1, target: 60, hints: [] },
  '2-1': { w: 6, h: 7, shards: 3, loops: 0.08, marble: true, rotators: 2, require: { rotations: 2 }, light: L2, target: 35, hints: ['hint.rotate'] },
  '2-2': { w: 7, h: 8, shards: 4, loops: 0.1, marble: true, rotators: 2, switches: 1, colorFrac: 0.22, require: { rotations: 1, toggles: 1 }, light: L2, target: 50, hints: [] },
  '2-3': { w: 7, h: 9, shards: 4, loops: 0.22, marble: true, switches: 1, colorFrac: 0.2, require: { toggles: 1 }, hands: { every: [7, 10], warn: 1.5 }, light: L2, target: 55, hints: ['hint.hand'] },
  '2-4': { w: 7, h: 9, shards: 4, loops: 0.18, marble: true, oneway: 5, require: { oneways: 2 }, balloons: 1, hands: { every: [8, 12], warn: 1.5 }, light: L2, target: 55, hints: ['hint.oneway'] },
  '2-5': { w: 7, h: 10, shards: 4, loops: 0.14, marble: true, lock: 1, rotators: 1, require: { unlocks: 1, rotations: 1 }, hands: { every: [7, 10], warn: 1.45 }, light: L2, target: 60, hints: ['hint.key'] },
  '3-1': { w: 7, h: 8, shards: 4, loops: 0.2, marble: true, crumble: 4, require: { crumbles: 2 }, balloons: 1, light: L3, target: 50, hints: ['hint.crumble'] },
  '3-2': { w: 7, h: 9, shards: 4, loops: 0.16, marble: true, portal: 1, oneway: 3, require: { portals: 1, oneways: 1 }, hands: { every: [6.5, 9.5], warn: 1.4 }, light: L3, target: 55, hints: ['hint.portal'] },
  '3-3': { w: 8, h: 10, shards: 5, loops: 0.18, marble: true, crumble: 3, portal: 1, require: { crumbles: 1, portals: 1 }, balloons: 2, balloonSpeed: [1.0, 1.25], light: L3, target: 70, hints: [] },
  '3-4': { w: 8, h: 11, shards: 5, loops: 0.16, marble: true, switches: 1, colorFrac: 0.18, rotators: 1, lock: 1, oneway: 3, require: { toggles: 1, rotations: 1, unlocks: 1 }, balloons: 2, balloonSpeed: [1.0, 1.25], hands: { every: [5.5, 8.5], warn: 1.35 }, light: L3, target: 80, hints: [] },
  '3-5': { w: 9, h: 12, shards: 6, loops: 0.15, marble: true, switches: 1, colorFrac: 0.16, rotators: 1, crumble: 2, portal: 1, lock: 1, require: { toggles: 1, rotations: 1, portals: 1, unlocks: 1 }, seeds: 50, balloons: 3, balloonSpeed: [1.0, 1.3], hands: { every: [4.5, 7], warn: 1.25 }, light: L3, target: 100, hints: ['hint.final'] }
};

const handmade = {
  '1-1': {
    id: '1-1', light: L1, hints: ['hint.move', 'hint.shards'],
    map: [
      '*-o-o o-E',
      '|   | | |',
      'o o-o o o',
      '| |   | |',
      'o-o o-o-o',
      '  | |   |',
      'o-o-o o-*',
      '|     |  ',
      'o o-o-o-o',
      '| |     |',
      'S-o M-*-o'
    ],
    rot: []
  }
};

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
  const out = { id, light: r.light, hints: r.hints, map: d.map, rot: d.rot };
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
  const ids = ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '2-5', '3-1', '3-2', '3-3', '3-4', '3-5'];
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
  const src = `/* Daedalus Dream — the fifteen story stages (drafted by tools/curate.cjs, verified by tools/verify.cjs).
 * See src/level.js for the map legend. Chapter = first digit.
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  DD.STAGES = [
${body}
  ];
  DD.CHAPTERS = [
    { n: 1, stages: ['1-1', '1-2', '1-3', '1-4', '1-5'] },
    { n: 2, stages: ['2-1', '2-2', '2-3', '2-4', '2-5'] },
    { n: 3, stages: ['3-1', '3-2', '3-3', '3-4', '3-5'] }
  ];
})();
`;
  fs.writeFileSync(file, src);
  console.error('wrote', file);
}
main();
