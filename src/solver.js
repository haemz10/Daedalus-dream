/* Daedalus Dream — breadth-first puzzle solver.
 * Used to verify every level is solvable, to compute goal times, to validate generated floors,
 * and in-game to notice when a broken bar has made the current attempt impossible.
 * Hazards (balloons, hands) are timing challenges and are ignored here.
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  var Lv = DD.Level;

  function solve(L, opts) {
    opts = opts || {};
    var requireMarble = !!opts.requireMarble && L.marble >= 0;
    var maxStates = opts.maxStates || 300000;
    var start = opts.from ? Lv.cloneState(opts.from) : Lv.createState(L);
    var S = L.shards.length, R = L.rotators.length, C = L.crumbles.length;
    var K = L.keys.length, LK = L.locks.length;
    var hasSwitch = L.switches.length > 0;
    var periods = L.rotators.map(function (r) { return r.period; });

    // Mixed-radix encoding of the whole puzzle state into one safe integer.
    var radix = L.N * Math.pow(2, S) * (requireMarble ? 2 : 1) * (hasSwitch ? 2 : 1) *
      periods.reduce(function (a, b) { return a * b; }, 1) * Math.pow(2, C + K + LK);
    if (!(radix < 9007199254740991)) return { ok: false, capped: true, reason: 'space', explored: 0 };

    function encode(st) {
      var key = st.pos, m = L.N;
      key += m * st.shardMask; m *= (1 << S);
      if (requireMarble) { key += m * st.marble; m *= 2; }
      if (hasSwitch) { key += m * st.sw; m *= 2; }
      for (var r = 0; r < R; r++) { key += m * (st.rot[r] % periods[r]); m *= periods[r]; }
      key += m * st.crumbled; m *= Math.pow(2, C);
      key += m * st.keyMask; m *= Math.pow(2, K);
      key += m * st.unlocked;
      return key;
    }
    function decode(key, st) {
      st.pos = key % L.N; key = Math.floor(key / L.N);
      var p = 1 << S;
      st.shardMask = key % p; key = Math.floor(key / p);
      if (requireMarble) { st.marble = key % 2; key = Math.floor(key / 2); } else st.marble = 0;
      if (hasSwitch) { st.sw = key % 2; key = Math.floor(key / 2); } else st.sw = 0;
      for (var r = 0; r < R; r++) { st.rot[r] = key % periods[r]; key = Math.floor(key / periods[r]); }
      p = Math.pow(2, C);
      st.crumbled = key % p; key = Math.floor(key / p);
      p = Math.pow(2, K);
      st.keyMask = key % p; key = Math.floor(key / p);
      st.unlocked = key;
    }

    // If the marble is not tracked, picking it up must not split states.
    if (!requireMarble) start.marble = 0;
    if (start.pos === L.exit && start.shardMask === L.allShards) return { ok: true, actions: [], moves: 0, rotations: 0, explored: 1 };

    var keys = [encode(start)];
    var parent = [-1];
    var action = [-1];
    var seen = new Map();
    seen.set(keys[0], 0);
    var cur = Lv.cloneState(start), nx = Lv.cloneState(start);
    var head = 0;

    function finish(idx, lastAction) {
      var acts = [lastAction];
      while (idx > 0) { acts.push(action[idx]); idx = parent[idx]; }
      acts.reverse();
      var moves = 0, rots = 0;
      for (var i = 0; i < acts.length; i++) { if (acts[i] < 4) moves++; else rots++; }
      return { ok: true, actions: acts, moves: moves, rotations: rots, explored: keys.length };
    }

    while (head < keys.length) {
      decode(keys[head], cur);
      for (var d = 0; d < 4; d++) {
        Lv.cloneState(cur, nx);
        var e = Lv.beginMove(L, nx, d, null);
        if (e < 0) continue;
        var to = Lv.other(L.edges[e], nx.pos);
        var won = Lv.arrive(L, nx, e, to, null);
        if (!requireMarble) nx.marble = 0;
        if (won) {
          if (!requireMarble || nx.marble) return finish(head, d);
          continue; // the level would end without the marble
        }
        var k = encode(nx);
        if (!seen.has(k)) { seen.set(k, keys.length); keys.push(k); parent.push(head); action.push(d); }
      }
      for (var r = 0; r < R; r++) {
        if (periods[r] < 2) continue;
        Lv.cloneState(cur, nx);
        Lv.rotate(L, nx, r);
        var k2 = encode(nx);
        if (!seen.has(k2)) { seen.set(k2, keys.length); keys.push(k2); parent.push(head); action.push(4 + r); }
      }
      if (keys.length > maxStates) return { ok: false, capped: true, explored: keys.length };
      head++;
    }
    return { ok: false, capped: false, explored: keys.length };
  }

  // Goal time for the "fast" star: generous enough for a second attempt.
  function parFor(L, sol, speed) {
    if (!sol || !sol.ok) return 0;
    var t = sol.moves / (speed || 3.3) * 1.8 + sol.rotations * 0.8 + 8 + L.shards.length;
    return Math.ceil(t / 5) * 5;
  }

  DD.Solver = { solve: solve, parFor: parFor };
})();
