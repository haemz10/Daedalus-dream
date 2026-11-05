/* Daedalus Dream — level model and rules (shared by game, solver, generator, tools).
 *
 * A level is drawn as ASCII. Nodes (joints) sit on even rows/columns, bars between them.
 *   Nodes:  o joint   S start   E exit   * dream shard   M golden marble
 *           T bell (swaps pink/cyan bars)   R turning joint   K key
 *           A/a and B/b portal pairs        (space) no joint
 *   Bars:   - |  normal        p pink (solid at start)   c cyan (solid after one bell)
 *           ~    rusty (breaks after one crossing)       # locked (needs a key)
 *           > <  one-way east/west     v ^  one-way south/north
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});

  var EK = DD.EK = { BAR: 0, PINK: 1, CYAN: 2, CRUMBLE: 3, ONEWAY: 4, LOCK: 5 };
  var DX = DD.DX, DY = DD.DY, BIT = DD.BIT;

  var SHAPES = { I: 5, L: 3, T: 14, X: 15, U: 1 };
  var NODE_CHARS = 'oSE*MTRKAaBb';

  function rotl4(mask, k) {
    k &= 3;
    return ((mask << k) | (mask >> (4 - k))) & 15;
  }
  DD.rotl4 = rotl4;

  function fail(def, msg) {
    throw new Error('Level ' + (def && def.id ? def.id : '?') + ': ' + msg);
  }

  function parse(def) {
    if (!def || !Array.isArray(def.map) || def.map.length === 0) fail(def, 'missing map');
    var rows = def.map.slice();
    if (rows.length % 2 === 0) fail(def, 'map must have an odd number of rows');
    var maxLen = 0;
    for (var i = 0; i < rows.length; i++) maxLen = Math.max(maxLen, rows[i].length);
    if (maxLen % 2 === 0) maxLen++;
    for (i = 0; i < rows.length; i++) while (rows[i].length < maxLen) rows[i] += ' ';
    var w = (maxLen + 1) / 2, h = (rows.length + 1) / 2;
    var N = w * h;
    var L = {
      id: def.id || 'level', w: w, h: h, N: N,
      node: new Uint8Array(N), feat: new Array(N),
      edges: [], adj: new Int32Array(N * 4).fill(-1),
      start: -1, exit: -1, shards: [], marble: -1, switches: [], keys: [], rotators: [],
      rotIdx: new Int8Array(N).fill(-1), portal: new Int32Array(N).fill(-1), portalKind: new Array(N),
      shardBit: new Int8Array(N).fill(-1), keyBit: new Int8Array(N).fill(-1),
      crumbles: [], locks: [], crumbleBit: null, lockBit: null,
      def: def
    };
    var portals = {};
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = rows[2 * y][2 * x];
        var n = y * w + x;
        if (ch === ' ' || ch === undefined) { L.feat[n] = null; continue; }
        if (NODE_CHARS.indexOf(ch) < 0) fail(def, 'unknown joint "' + ch + '" at ' + x + ',' + y);
        L.node[n] = 1; L.feat[n] = ch;
        switch (ch) {
          case 'o': break;
          case 'S': if (L.start >= 0) fail(def, 'two starts'); L.start = n; break;
          case 'E': if (L.exit >= 0) fail(def, 'two exits'); L.exit = n; break;
          case '*': L.shardBit[n] = L.shards.length; L.shards.push(n); break;
          case 'M': if (L.marble >= 0) fail(def, 'two marbles'); L.marble = n; break;
          case 'T': L.switches.push(n); break;
          case 'K': L.keyBit[n] = L.keys.length; L.keys.push(n); break;
          case 'R': L.rotIdx[n] = L.rotators.length; L.rotators.push({ node: n, mask: 0, o0: 0, period: 4, shape: 'L' }); break;
          default: // portals
            var key = ch.toUpperCase();
            portals[key] = portals[key] || [];
            portals[key].push(n);
            L.portalKind[n] = key;
        }
      }
    }
    if (L.start < 0) fail(def, 'no start');
    if (L.exit < 0) fail(def, 'no exit');
    if (L.shards.length < 1) fail(def, 'needs at least one shard');
    if (L.shards.length > 12) fail(def, 'too many shards');
    Object.keys(portals).forEach(function (k) {
      var p = portals[k];
      if (p.length !== 2 || L.feat[p[0]] === L.feat[p[1]]) fail(def, 'portal ' + k + ' needs exactly one upper and one lower case end');
      L.portal[p[0]] = p[1]; L.portal[p[1]] = p[0];
    });

    function addEdge(a, b, dir, ch, x, y) {
      var kind, ow = -1;
      switch (ch) {
        case '-': case '|': kind = EK.BAR; break;
        case 'p': kind = EK.PINK; break;
        case 'c': kind = EK.CYAN; break;
        case '~': kind = EK.CRUMBLE; break;
        case '#': kind = EK.LOCK; break;
        case '>': if (dir !== 1) fail(def, 'bad bar ">"'); kind = EK.ONEWAY; ow = 1; break;
        case '<': if (dir !== 1) fail(def, 'bad bar "<"'); kind = EK.ONEWAY; ow = 3; break;
        case 'v': if (dir !== 2) fail(def, 'bad bar "v"'); kind = EK.ONEWAY; ow = 2; break;
        case '^': if (dir !== 2) fail(def, 'bad bar "^"'); kind = EK.ONEWAY; ow = 0; break;
        default: fail(def, 'unknown bar "' + ch + '" near ' + x + ',' + y);
      }
      if (!L.node[a] || !L.node[b]) fail(def, 'bar without joints near ' + x + ',' + y);
      var e = L.edges.length;
      L.edges.push({ a: a, b: b, dir: dir, kind: kind, ow: ow, ax: a % w, ay: (a / w) | 0, bx: b % w, by: (b / w) | 0 });
      L.adj[a * 4 + dir] = e;
      L.adj[b * 4 + DD.opp(dir)] = e;
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var n0 = y * w + x;
        if (x < w - 1) {
          var hc = rows[2 * y][2 * x + 1];
          if (hc !== ' ') addEdge(n0, n0 + 1, 1, hc, x, y);
        }
        if (y < h - 1) {
          var vc = rows[2 * y + 1][2 * x];
          if (vc !== ' ') addEdge(n0, n0 + w, 2, vc, x, y);
        }
      }
    }
    L.crumbleBit = new Int8Array(L.edges.length).fill(-1);
    L.lockBit = new Int8Array(L.edges.length).fill(-1);
    for (i = 0; i < L.edges.length; i++) {
      var E = L.edges[i];
      if (E.kind === EK.CRUMBLE) { L.crumbleBit[i] = L.crumbles.length; L.crumbles.push(i); }
      if (E.kind === EK.LOCK) { L.lockBit[i] = L.locks.length; L.locks.push(i); }
    }
    if (L.crumbles.length > 24) fail(def, 'too many rusty bars');
    if (L.locks.length > 8 || L.keys.length > 8) fail(def, 'too many locks or keys');

    // Turning joints
    var rotDefs = def.rot || [];
    if (rotDefs.length !== L.rotators.length) fail(def, 'rot list has ' + rotDefs.length + ' entries for ' + L.rotators.length + ' turning joints');
    for (i = 0; i < L.rotators.length; i++) {
      var rd = rotDefs[i], R = L.rotators[i];
      var shape = rd[0], o = (rd[1] | 0) & 3;
      var mask = typeof shape === 'number' ? shape : SHAPES[shape];
      if (!mask) fail(def, 'unknown turning joint shape ' + shape);
      R.shape = typeof shape === 'number' ? 'custom' : shape;
      R.mask = mask; R.o0 = o;
      R.period = mask === 15 ? 1 : (rotl4(mask, 2) === mask ? 2 : 4);
      for (var d = 0; d < 4; d++) {
        var e2 = L.adj[R.node * 4 + d];
        if (e2 >= 0 && L.edges[e2].kind !== EK.BAR) fail(def, 'turning joints only connect to plain bars');
      }
    }
    L.allShards = (1 << L.shards.length) - 1;

    // Static degree (ignoring dynamic state) for drawing and generation.
    L.deg = new Uint8Array(N);
    for (n = 0; n < N; n++) {
      var c = 0;
      for (d = 0; d < 4; d++) if (L.adj[n * 4 + d] >= 0) c++;
      L.deg[n] = c;
    }

    // Extras (validated lightly; the game tolerates their absence).
    L.balloons = (def.balloons || []).map(function (b) {
      return { ax: +b.a[0], ay: +b.a[1], bx: +b.b[0], by: +b.b[1], speed: +(b.speed || 1.1), phase: +(b.phase || 0) };
    });
    L.balloons.forEach(function (b) {
      [b.ax, b.ay, b.bx, b.by, b.speed, b.phase].forEach(function (v) { if (!isFinite(v)) fail(def, 'bad balloon'); });
      if (b.ax === b.bx && b.ay === b.by) fail(def, 'balloon path has zero length');
    });
    L.hands = def.hands ? { every: [+def.hands.every[0], +def.hands.every[1]], warn: +(def.hands.warn || 1.4), max: def.hands.max || 1 } : null;
    L.light = +(def.light || 2.5);
    L.par = def.par || 0;
    L.hints = def.hints || [];
    return L;
  }

  function createState(L) {
    var rot = new Int8Array(L.rotators.length);
    for (var i = 0; i < rot.length; i++) rot[i] = L.rotators[i].o0 % L.rotators[i].period;
    return { pos: L.start, sw: 0, rot: rot, crumbled: 0, unlocked: 0, keyMask: 0, shardMask: 0, marble: 0 };
  }

  function cloneState(s, into) {
    var o = into || { rot: new Int8Array(s.rot.length) };
    o.pos = s.pos; o.sw = s.sw; o.crumbled = s.crumbled; o.unlocked = s.unlocked;
    o.keyMask = s.keyMask; o.shardMask = s.shardMask; o.marble = s.marble;
    if (o.rot.length !== s.rot.length) o.rot = new Int8Array(s.rot.length);
    o.rot.set(s.rot);
    return o;
  }

  function keysHeld(st) { return DD.popcount(st.keyMask) - DD.popcount(st.unlocked); }

  function rotMask(L, st, r) { return rotl4(L.rotators[r].mask, st.rot[r]); }

  function other(E, n) { return E.a === n ? E.b : E.a; }

  // Returns the edge index if the girl standing on node n may start moving in direction d, else -1.
  function canMove(L, st, n, d) {
    var e = L.adj[n * 4 + d];
    if (e < 0) return -1;
    var E = L.edges[e];
    switch (E.kind) {
      case EK.PINK: if (st.sw !== 0) return -1; break;
      case EK.CYAN: if (st.sw !== 1) return -1; break;
      case EK.CRUMBLE: if (st.crumbled & (1 << L.crumbleBit[e])) return -1; break;
      case EK.ONEWAY: if (E.ow !== d) return -1; break;
      case EK.LOCK:
        if (!(st.unlocked & (1 << L.lockBit[e])) && keysHeld(st) <= 0) return -1;
        break;
    }
    var r = L.rotIdx[n];
    if (r >= 0 && !(rotMask(L, st, r) & BIT[d])) return -1;
    var m = other(E, n);
    r = L.rotIdx[m];
    if (r >= 0 && !(rotMask(L, st, r) & BIT[DD.opp(d)])) return -1;
    return e;
  }

  // Is edge e currently solid (ignoring direction rules)? Used for drawing.
  function edgeSolid(L, st, e) {
    var E = L.edges[e];
    switch (E.kind) {
      case EK.PINK: return st.sw === 0;
      case EK.CYAN: return st.sw === 1;
      case EK.CRUMBLE: return !(st.crumbled & (1 << L.crumbleBit[e]));
      default: return true;
    }
  }

  // Start a move: validates and consumes a key if a locked bar is opened. Returns the edge or -1.
  function beginMove(L, st, d, events) {
    var n = st.pos;
    var e = canMove(L, st, n, d);
    if (e < 0) return -1;
    var E = L.edges[e];
    if (E.kind === EK.LOCK) {
      var bit = 1 << L.lockBit[e];
      if (!(st.unlocked & bit)) {
        st.unlocked |= bit;
        if (events) events.push({ t: 'unlock', e: e });
      }
    }
    return e;
  }

  // Finish a move along edge e arriving at node `to`. Returns true when the level is won.
  function arrive(L, st, e, to, events) {
    var E = L.edges[e];
    if (E.kind === EK.CRUMBLE) {
      st.crumbled |= 1 << L.crumbleBit[e];
      if (events) events.push({ t: 'crumble', e: e });
    }
    if (E.kind === EK.ONEWAY && events) events.push({ t: 'oneway', e: e });
    st.pos = to;
    var f = L.feat[to];
    var bit;
    switch (f) {
      case '*':
        bit = 1 << L.shardBit[to];
        if (!(st.shardMask & bit)) {
          st.shardMask |= bit;
          if (events) events.push({ t: 'shard', n: to, all: st.shardMask === L.allShards });
        }
        break;
      case 'M':
        if (!st.marble) { st.marble = 1; if (events) events.push({ t: 'marble', n: to }); }
        break;
      case 'K':
        bit = 1 << L.keyBit[to];
        if (!(st.keyMask & bit)) { st.keyMask |= bit; if (events) events.push({ t: 'key', n: to }); }
        break;
      case 'T':
        st.sw ^= 1;
        if (events) events.push({ t: 'switch', n: to, sw: st.sw });
        break;
      case 'A': case 'a': case 'B': case 'b':
        st.pos = L.portal[to];
        if (events) events.push({ t: 'portal', from: to, to: st.pos });
        break;
    }
    if (st.pos === L.exit && st.shardMask === L.allShards) {
      if (events) events.push({ t: 'win' });
      return true;
    }
    return false;
  }

  function rotate(L, st, r) {
    st.rot[r] = (st.rot[r] + 1) % L.rotators[r].period;
  }

  // Serialize a generator graph back to ASCII (used by the generator and the curation tool).
  function toAscii(w, h, feat, hEdge, vEdge) {
    var rows = [];
    for (var y = 0; y < h; y++) {
      var r1 = '', r2 = '';
      for (var x = 0; x < w; x++) {
        var n = y * w + x;
        r1 += feat[n] || ' ';
        if (x < w - 1) r1 += hEdge[n] || ' ';
        if (y < h - 1) {
          r2 += vEdge[n] || ' ';
          if (x < w - 1) r2 += ' ';
        }
      }
      rows.push(r1);
      if (y < h - 1) rows.push(r2);
    }
    return rows;
  }

  DD.Level = {
    parse: parse,
    createState: createState,
    cloneState: cloneState,
    keysHeld: keysHeld,
    rotMask: rotMask,
    canMove: canMove,
    edgeSolid: edgeSolid,
    beginMove: beginMove,
    arrive: arrive,
    rotate: rotate,
    other: other,
    toAscii: toAscii
  };
})();
