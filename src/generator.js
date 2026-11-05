/* Daedalus Dream — maze generator for the Endless Gym (also used offline to draft story stages).
 * Every floor it returns has been checked by the solver; if a recipe keeps failing it falls back to
 * fewer gadgets, and finally to a plain maze, which is always solvable.
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  var DX = DD.DX, DY = DD.DY, opp = DD.opp;

  function Graph(w, h) {
    this.w = w; this.h = h; this.N = w * h;
    this.present = new Uint8Array(this.N);
    this.hE = new Array(this.N).fill(null); // edge from n to n+1
    this.vE = new Array(this.N).fill(null); // edge from n to n+w
  }
  Graph.prototype.nb = function (n, d) {
    var x = n % this.w + DX[d], y = ((n / this.w) | 0) + DY[d];
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    var m = y * this.w + x;
    return this.present[m] ? m : -1;
  };
  Graph.prototype.get = function (n, d) {
    switch (d) {
      case 1: return this.hE[n];
      case 2: return this.vE[n];
      case 3: return n % this.w > 0 ? this.hE[n - 1] : null;
      default: return n >= this.w ? this.vE[n - this.w] : null;
    }
  };
  Graph.prototype.set = function (n, d, ch) {
    switch (d) {
      case 1: this.hE[n] = ch; break;
      case 2: this.vE[n] = ch; break;
      case 3: this.hE[n - 1] = ch; break;
      default: this.vE[n - this.w] = ch;
    }
  };
  Graph.prototype.deg = function (n) {
    var c = 0;
    for (var d = 0; d < 4; d++) if (this.get(n, d)) c++;
    return c;
  };
  // BFS distances over existing bars (ignoring their kind). skipA/skipD removes one bar.
  Graph.prototype.dist = function (src, skipN, skipD) {
    var D = new Int16Array(this.N).fill(-1);
    var q = [src]; D[src] = 0;
    var skipM = skipN >= 0 ? this.nb(skipN, skipD) : -1;
    for (var i = 0; i < q.length; i++) {
      var n = q[i];
      for (var d = 0; d < 4; d++) {
        if (!this.get(n, d)) continue;
        if ((n === skipN && d === skipD) || (n === skipM && d === opp(skipD))) continue;
        var m = this.nb(n, d);
        if (m >= 0 && D[m] < 0) { D[m] = D[n] + 1; q.push(m); }
      }
    }
    return D;
  };
  Graph.prototype.edgeList = function () {
    var out = [];
    for (var n = 0; n < this.N; n++) {
      if (this.hE[n]) out.push([n, 1]);
      if (this.vE[n]) out.push([n, 2]);
    }
    return out;
  };

  function carve(w, h, rng, p) {
    var G = new Graph(w, h);
    G.present.fill(1);
    if (p.holes) {
      for (var n = 0; n < G.N; n++) if (rng() < p.holes) G.present[n] = 0;
    }
    // Keep only the largest connected group of joints (by grid adjacency).
    var comp = new Int32Array(G.N).fill(-1), best = -1, bestSize = 0, c = 0;
    for (n = 0; n < G.N; n++) {
      if (!G.present[n] || comp[n] >= 0) continue;
      var q = [n]; comp[n] = c;
      for (var i = 0; i < q.length; i++) {
        for (var d = 0; d < 4; d++) {
          var m = G.nb(q[i], d);
          if (m >= 0 && comp[m] < 0) { comp[m] = c; q.push(m); }
        }
      }
      if (q.length > bestSize) { bestSize = q.length; best = c; }
      c++;
    }
    for (n = 0; n < G.N; n++) if (comp[n] !== best) G.present[n] = 0;

    // Growing-tree spanning maze: mostly "newest" (long corridors), sometimes random (branches).
    var nodes = [];
    for (n = 0; n < G.N; n++) if (G.present[n]) nodes.push(n);
    var visited = new Uint8Array(G.N);
    var first = rng.pick(nodes);
    var active = [first]; visited[first] = 1;
    var straight = p.straight == null ? 0.7 : p.straight;
    while (active.length) {
      var idx = rng() < straight ? active.length - 1 : rng.int(active.length);
      var cur = active[idx];
      var opts = [];
      for (d = 0; d < 4; d++) {
        m = G.nb(cur, d);
        if (m >= 0 && !visited[m]) opts.push(d);
      }
      if (!opts.length) { active.splice(idx, 1); continue; }
      d = rng.pick(opts);
      m = G.nb(cur, d);
      G.set(cur, d, d === 1 || d === 3 ? '-' : '|');
      visited[m] = 1; active.push(m);
    }
    // Extra loops so there is room to dodge.
    var extra = [];
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      for (d = 1; d <= 2; d++) if (G.nb(n, d) >= 0 && !G.get(n, d)) extra.push([n, d]);
    }
    rng.shuffle(extra);
    var count = Math.round(extra.length * (p.loops || 0));
    for (i = 0; i < count; i++) G.set(extra[i][0], extra[i][1], extra[i][1] === 1 ? '-' : '|');
    G.nodes = nodes;
    return G;
  }

  function pickFar(cands, distFns, rng, bonusFn) {
    var best = -1, bestScore = -1e9;
    for (var i = 0; i < cands.length; i++) {
      var n = cands[i], mind = 1e9;
      for (var j = 0; j < distFns.length; j++) {
        var dv = distFns[j][n];
        if (dv < 0) dv = 99;
        if (dv < mind) mind = dv;
      }
      var s = Math.min(mind, 12) + rng() * 2.5 + (bonusFn ? bonusFn(n) : 0);
      if (s > bestScore) { bestScore = s; best = n; }
    }
    return best;
  }

  function buildOnce(p, rng) {
    var w = p.w, h = p.h;
    var G = carve(w, h, rng, p);
    var feat = new Array(G.N).fill(null);
    var used = new Uint8Array(G.N);
    G.nodes.forEach(function (n) { feat[n] = 'o'; });

    // Start near the bottom, exit as far away as possible (preferably near the top).
    var bottom = G.nodes.filter(function (n) { return ((n / w) | 0) >= h - 2; });
    if (!bottom.length) bottom = G.nodes;
    var start = rng.pick(bottom);
    var dS = G.dist(start);
    var exit = -1, bestE = -1;
    G.nodes.forEach(function (n) {
      if (n === start) return;
      var s = dS[n] + (((n / w) | 0) < h / 2 ? 4 : 0) + rng() * 2;
      if (s > bestE) { bestE = s; exit = n; }
    });
    feat[start] = 'S'; used[start] = 1;
    feat[exit] = 'E'; used[exit] = 1;
    var dE = G.dist(exit);

    var dists = [dS, dE];
    var shards = [];
    for (var k = 0; k < p.shards; k++) {
      var cands = G.nodes.filter(function (n) { return !used[n]; });
      if (!cands.length) break;
      var s = pickFar(cands, dists, rng, function (n) { return G.deg(n) === 1 ? 2.5 : 0; });
      shards.push(s); used[s] = 1; feat[s] = '*';
      dists.push(G.dist(s));
    }
    var marble = -1;
    if (p.marble) {
      var mc = G.nodes.filter(function (n) { return !used[n]; });
      if (mc.length) {
        marble = pickFar(mc, dists, rng, function (n) { return G.deg(n) === 1 ? 3 : 0; });
        used[marble] = 1; feat[marble] = 'M';
        dists.push(G.dist(marble));
      }
    }

    var noTouch = new Uint8Array(G.N); // joints whose bars must stay plain (turning joints)
    function freeNodes(minDeg, maxDeg) {
      return G.nodes.filter(function (n) {
        var dg = G.deg(n);
        return !used[n] && dg >= minDeg && dg <= maxDeg && dS[n] >= 2;
      });
    }
    function edgeTouchesRot(n, d) {
      var m = G.nb(n, d);
      return noTouch[n] || (m >= 0 && noTouch[m]);
    }

    // Turning joints first, so later gadgets avoid their bars.
    var rot = [];
    for (k = 0; k < (p.rotators || 0); k++) {
      var rc = freeNodes(2, 3).filter(function (n) {
        for (var d = 0; d < 4; d++) {
          var m = G.nb(n, d);
          if (m >= 0 && (noTouch[m] || feat[m] === 'R')) return false;
          if (G.get(n, d) && G.get(n, d) !== '-' && G.get(n, d) !== '|') return false;
        }
        return true;
      });
      if (!rc.length) break;
      var r = rng.pick(rc);
      var mask = 0;
      for (var d = 0; d < 4; d++) if (G.get(r, d)) mask |= DD.BIT[d];
      var shape, base;
      if (mask === 5 || mask === 10) { shape = 'I'; base = 5; }
      else if (DD.popcount(mask) === 2) { shape = 'L'; base = 3; }
      else { shape = 'T'; base = 14; }
      var orig = 0;
      for (var o = 0; o < 4; o++) if (DD.rotl4(base, o) === mask) { orig = o; break; }
      var period = shape === 'I' ? 2 : 4;
      var start0 = (orig + 1 + rng.int(period - 1)) % period;
      // Give it somewhere new to point.
      for (d = 0; d < 4; d++) {
        var m2 = G.nb(r, d);
        if (m2 >= 0 && !G.get(r, d) && rng() < 0.85) G.set(r, d, d % 2 ? '-' : '|');
      }
      feat[r] = 'R'; used[r] = 1; noTouch[r] = 1;
      rot.push({ n: r, def: [shape, start0] });
    }

    // Bells and coloured bars.
    if (p.switches) {
      for (k = 0; k < p.switches; k++) {
        var sc = freeNodes(2, 4);
        if (!sc.length) break;
        var t = pickFar(sc, dists, rng);
        feat[t] = 'T'; used[t] = 1; dists.push(G.dist(t));
      }
      var edges = G.edgeList().filter(function (e) {
        var m = G.nb(e[0], e[1]);
        return !edgeTouchesRot(e[0], e[1]) && e[0] !== start && m !== start;
      });
      rng.shuffle(edges);
      var nColor = Math.max(2, Math.round(edges.length * (p.colorFrac || 0.22)));
      for (k = 0; k < nColor && k < edges.length; k++) G.set(edges[k][0], edges[k][1], k % 2 ? 'c' : 'p');
    }

    function plainEdges() {
      return G.edgeList().filter(function (e) {
        var ch = G.get(e[0], e[1]);
        return (ch === '-' || ch === '|') && !edgeTouchesRot(e[0], e[1]);
      });
    }
    // One-way slides.
    var ow = rng.shuffle(plainEdges());
    for (k = 0; k < (p.oneway || 0) && k < ow.length; k++) {
      var od = ow[k][1];
      G.set(ow[k][0], od, od === 1 ? (rng() < 0.5 ? '>' : '<') : (rng() < 0.5 ? 'v' : '^'));
    }
    // Rusty bars.
    var cr = rng.shuffle(plainEdges());
    for (k = 0; k < (p.crumble || 0) && k < cr.length; k++) G.set(cr[k][0], cr[k][1], '~');

    // Lock on a bridge along the way to the exit, key somewhere before it.
    if (p.lock) {
      var path = [], cur = exit, D0 = G.dist(start);
      while (cur !== start && D0[cur] > 0) {
        var stepped = false;
        for (d = 0; d < 4 && !stepped; d++) {
          var pm = G.nb(cur, d);
          if (pm >= 0 && G.get(cur, d) && D0[pm] === D0[cur] - 1) { path.push([pm, opp(d)]); cur = pm; stepped = true; }
        }
        if (!stepped) break;
      }
      path.reverse();
      var lockCands = path.filter(function (e, i) {
        var ch = G.get(e[0], e[1]);
        return i >= 2 && i < path.length - 1 && (ch === '-' || ch === '|') && !edgeTouchesRot(e[0], e[1]) &&
          G.dist(start, e[0], e[1])[exit] < 0;
      });
      if (lockCands.length) {
        var le = rng.pick(lockCands);
        var side = G.dist(start, le[0], le[1]);
        var kc = G.nodes.filter(function (n) { return !used[n] && side[n] >= 3; });
        if (kc.length) {
          var key = pickFar(kc, [dS], rng, function (n) { return G.deg(n) === 1 ? 2 : 0; });
          feat[key] = 'K'; used[key] = 1;
          G.set(le[0], le[1], '#');
        }
      }
    }

    // A pair of swirls between two far dead ends.
    if (p.portal) {
      var pc = G.nodes.filter(function (n) { return !used[n] && G.deg(n) <= 2 && dS[n] >= 2; });
      var bestPair = null, bestD = 0;
      for (var tries = 0; tries < 40 && pc.length > 1; tries++) {
        var a = rng.pick(pc), b = rng.pick(pc);
        if (a === b) continue;
        var dd = G.dist(a)[b] + (G.deg(a) === 1 ? 2 : 0) + (G.deg(b) === 1 ? 2 : 0);
        if (dd > bestD) { bestD = dd; bestPair = [a, b]; }
      }
      if (bestPair && bestD >= 5) {
        feat[bestPair[0]] = 'A'; feat[bestPair[1]] = 'a';
        used[bestPair[0]] = used[bestPair[1]] = 1;
      }
    }

    // Read rotators in row-major order to match the parser.
    rot.sort(function (x, y) { return x.n - y.n; });
    var def = {
      id: p.id || 'gen',
      map: DD.Level.toAscii(w, h, feat, G.hE, G.vE),
      rot: rot.map(function (r) { return r.def; }),
      light: p.light || 2.4,
      hands: p.hands || null,
      hints: p.hints || []
    };
    // Balloons drift along straight lines, never starting on top of the girl.
    var sx = start % w, sy = (start / w) | 0;
    var balloons = [];
    for (k = 0; k < (p.balloons || 0); k++) {
      for (var bt = 0; bt < 30; bt++) {
        var horiz = rng() < 0.5;
        var ax, ay, bx, by;
        if (horiz) { ay = by = rng.int(h); ax = rng.int(w); bx = rng.int(w); }
        else { ax = bx = rng.int(w); ay = rng.int(h); by = rng.int(h); }
        if (Math.abs(ax - bx) + Math.abs(ay - by) < Math.min(3, Math.max(w, h) - 1)) continue;
        if (segDist(sx, sy, ax, ay, bx, by) < 2) continue;
        var phase = rng();
        var bs = p.balloonSpeed || [0.9, 1.3];
        balloons.push({ a: [ax, ay], b: [bx, by], speed: +rng.range(bs[0], bs[1]).toFixed(2), phase: +phase.toFixed(2) });
        break;
      }
    }
    if (balloons.length) def.balloons = balloons;
    return def;
  }

  function segDist(px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay;
    var l2 = vx * vx + vy * vy;
    var t = l2 ? DD.clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1) : 0;
    var dx = ax + vx * t - px, dy = ay + vy * t - py;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Replays a solver action list and counts how often each gadget was needed.
  function usage(L, sol) {
    var st = DD.Level.createState(L);
    var u = { toggles: 0, rotations: 0, crumbles: 0, portals: 0, unlocks: 0, oneways: 0, moves: 0 };
    var ev = [];
    for (var i = 0; i < sol.actions.length; i++) {
      var a = sol.actions[i];
      if (a >= 4) { DD.Level.rotate(L, st, a - 4); u.rotations++; continue; }
      ev.length = 0;
      var e = DD.Level.beginMove(L, st, a, ev);
      if (e < 0) throw new Error('solution replay failed');
      DD.Level.arrive(L, st, e, DD.Level.other(L.edges[e], st.pos), ev);
      u.moves++;
      ev.forEach(function (x) {
        if (x.t === 'switch') u.toggles++;
        else if (x.t === 'crumble') u.crumbles++;
        else if (x.t === 'portal') u.portals++;
        else if (x.t === 'unlock') u.unlocks++;
        else if (x.t === 'oneway') u.oneways++;
      });
    }
    return u;
  }

  function scale(p, f) {
    var q = Object.assign({}, p);
    ['rotators', 'oneway', 'crumble'].forEach(function (k) { if (q[k]) q[k] = Math.floor(q[k] * f); });
    if (f < 0.5) { q.switches = 0; q.lock = 0; q.portal = 0; }
    return q;
  }

  // Turn one random gadget bar (or the lock and its key) back into a plain bar.
  // `prefer` lists bar characters to try first (e.g. rusty bars when the state space is too large).
  function revertGadget(def, rng, prefer) {
    var spots = [], preferred = [];
    for (var y = 0; y < def.map.length; y++) {
      var row = def.map[y];
      for (var x = 0; x < row.length; x++) {
        var isH = y % 2 === 0 && x % 2 === 1, isV = y % 2 === 1 && x % 2 === 0;
        if (!isH && !isV) continue;
        var ch = row[x];
        if ('pc~#<>v^'.indexOf(ch) < 0) continue;
        spots.push([y, x, isH]);
        if (prefer && prefer.indexOf(ch) >= 0) preferred.push([y, x, isH]);
      }
    }
    var pool = preferred.length ? preferred : spots;
    if (!pool.length) return false;
    var s = rng.pick(pool);
    var wasLock = def.map[s[0]][s[1]] === '#';
    var r = def.map[s[0]];
    def.map[s[0]] = r.slice(0, s[1]) + (s[2] ? '-' : '|') + r.slice(s[1] + 1);
    if (wasLock && def.map.join('').indexOf('#') < 0) {
      def.map = def.map.map(function (row, i) { return i % 2 === 0 ? row.replace(/K/g, 'o') : row; });
    }
    return true;
  }

  function make(p, seed) {
    var tries = p.tries || 14;
    var cap = p.cap || 60000;
    var maxRepairs = p.repairs == null ? 10 : p.repairs;
    var t0 = DD.now(), budget = p.budget || 0;
    for (var attempt = 0; attempt <= tries; attempt++) {
      // Out of time: jump straight to the plain recipe, which always solves quickly.
      if (budget && attempt < tries && DD.now() - t0 > budget) attempt = tries;
      var f = attempt < tries * 0.5 ? 1 : attempt < tries * 0.8 ? 0.5 : attempt < tries ? 0.34 : 0;
      var q = f === 1 ? p : scale(p, f);
      if (attempt === tries) q = Object.assign({}, p, { rotators: 0, oneway: 0, crumble: 0, switches: 0, lock: 0, portal: 0 });
      var rng = DD.makeRng(((seed >>> 0) * 2654435761 + attempt * 40503 + 17) >>> 0);
      var def, L, sol;
      try { def = buildOnce(q, rng); L = DD.Level.parse(def); } catch (e) { continue; }
      sol = DD.Solver.solve(L, { maxStates: cap });
      for (var rep = 0; !sol.ok && rep < maxRepairs; rep++) {
        if (sol.capped && !/[~#]/.test(def.map.join(''))) break; // repairs cannot shrink this one
        if (!revertGadget(def, rng, sol.capped ? '~#' : null)) break;
        try { L = DD.Level.parse(def); } catch (e3) { break; }
        sol = DD.Solver.solve(L, { maxStates: cap });
      }
      if (!sol.ok) continue;
      if (p.require && attempt < tries) {
        var u = usage(L, sol), ok = true;
        for (var k in p.require) if ((u[k] || 0) < p.require[k]) ok = false;
        if (!ok) continue;
        def.usage = u;
      }
      if (L.marble >= 0) {
        var sm = DD.Solver.solve(L, { maxStates: cap, requireMarble: true });
        if (!sm.ok) {
          def.map = def.map.map(function (row, i) { return i % 2 === 0 ? row.replace('M', 'o') : row; });
          L = DD.Level.parse(def);
        }
      }
      def.par = DD.Solver.parFor(L, sol);
      def.optimal = sol.moves;
      def.attempt = attempt;
      return def;
    }
    // Unreachable in practice: a plain spanning maze is always solvable. Kept as a safety net.
    return {
      id: p.id || 'gen', map: ['S-*-E'], rot: [], light: p.light || 2.4, hands: null, hints: [], par: 20, optimal: 2
    };
  }

  // Recipe for each depth of the Endless Gym.
  function endlessParams(depth, rng) {
    var d = Math.max(1, depth | 0);
    var p = {
      id: 'endless-' + d,
      w: Math.min(5 + Math.floor(d / 3), 9),
      h: Math.min(6 + Math.floor(d / 2), 13),
      shards: Math.min(2 + Math.floor(d / 3), 5),
      loops: 0.1 + Math.min(d, 30) * 0.004,
      holes: d > 6 ? 0.06 : 0,
      straight: 0.65,
      marble: false,
      light: Math.max(1.9, 2.7 - d * 0.03),
      cap: 30000, tries: 10, budget: 160
    };
    var pool = [];
    if (d >= 2) pool.push('switch');
    if (d >= 5) pool.push('rot');
    if (d >= 7) pool.push('oneway');
    if (d >= 9) pool.push('crumble');
    if (d >= 10) pool.push('lock');
    if (d >= 12) pool.push('portal');
    rng.shuffle(pool);
    var nMech = Math.min(pool.length, d < 8 ? 1 : d < 24 ? 2 : 3);
    var chosen = pool.slice(0, nMech);
    // Turning joints and rusty bars together explode the number of states to check; keep one.
    if (chosen.indexOf('rot') >= 0 && chosen.indexOf('crumble') >= 0) chosen.splice(chosen.indexOf('crumble'), 1);
    chosen.forEach(function (m) {
      if (m === 'switch') { p.switches = 1 + (d > 14 && rng() < 0.4 ? 1 : 0); p.colorFrac = 0.18 + rng() * 0.08; }
      if (m === 'rot') { p.rotators = 1 + (d > 20 && nMech < 3 ? rng.int(2) : 0); p.shards = Math.min(p.shards, 4); }
      if (m === 'oneway') p.oneway = 2 + rng.int(3);
      if (m === 'crumble') p.crumble = 2 + (d > 20 ? rng.int(2) : 0);
      if (m === 'lock') p.lock = 1;
      if (m === 'portal') p.portal = 1;
    });
    if (d >= 4) {
      p.balloons = Math.min(1 + Math.floor((d - 4) / 6), 4);
      p.balloonSpeed = [0.9 + Math.min(d, 40) * 0.01, 1.2 + Math.min(d, 40) * 0.012];
    }
    if (d >= 6) {
      var lo = Math.max(3.4, 10 - (d - 6) * 0.22);
      p.hands = { every: [+lo.toFixed(2), +(lo + 3).toFixed(2)], warn: +Math.max(1.0, 1.55 - (d - 6) * 0.015).toFixed(2), max: d >= 24 ? 2 : 1 };
    }
    return p;
  }

  DD.Gen = { make: make, endlessParams: endlessParams, usage: usage, buildOnce: buildOnce };
})();
