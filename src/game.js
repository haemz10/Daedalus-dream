/* Daedalus Dream — inside the maze: movement, gadgets, hazards, fog, camera and drawing. */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  var Lv = DD.Level, EK = DD.EK, R = DD.Render, C = R.C, opp = DD.opp, DX = DD.DX, DY = DD.DY;
  var TAU = Math.PI * 2;
  var SPEED = 5.4;          // joints per second (x1.3 during FEVER)
  var BAR = 0.15;           // bar thickness in cells
  var GIRL_H = 0.8;
  var G = null;
  var fog = null, fogCtx = null;
  var view = { w: 1, h: 1, dpr: 1, top: 60, bottom: 0, ox: 0, oy: 0, s: 60 };
  var autoplay = false, autoQueue = [];

  function nx(n) { return n % G.L.w; }
  function ny(n) { return (n / G.L.w) | 0; }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function start(def, opts) {
    var L = Lv.parse(def);
    var st = Lv.createState(L);
    G = {
      def: def, L: L, st: st, opts: opts || {}, time: 0, ended: false, paused: false, result: null, endT: 0,
      girl: { mv: null, face: 2, walk: -1, nudgeX: 0, nudgeY: 0, inv: 0, grace: 1.6, hurtT: 0, tp: 0, lift: 0 },
      wantDir: -1, wantT: 0, heldDir: -1, runDir: -1, path: [],
      hearts: opts.hearts || 3, maxHearts: opts.maxHearts || 3,
      discovered: new Uint8Array(L.N),
      balloons: L.balloons.map(function (b) {
        return { ax: b.ax, ay: b.ay, bx: b.bx, by: b.by, speed: b.speed, phase: b.phase, len: Math.hypot(b.bx - b.ax, b.by - b.ay), x: b.ax, y: b.ay, hitT: 0 };
      }),
      hands: [], handTimer: L.hands ? rnd(L.hands.every[0], L.hands.every[1]) * 0.7 + 2 : 0,
      particles: [], exitOpen: false, exitT: 0,
      cam: { x: nx0(L, L.start), y: ny0(L, L.start), s: 0, overview: false },
      shake: 0, flash: 0, flashColor: '255,80,110',
      rotTarget: new Float32Array(L.rotators.length), rotVis: new Float32Array(L.rotators.length),
      swVis: 0, bellRing: 0,
      crumbleT: new Float32Array(L.edges.length).fill(-1), unlockT: new Float32Array(L.edges.length).fill(-1),
      hits: 0, shardsGot: 0, stuck: false, stuckCheckT: 0,
      ambientT: rnd(18, 30), ambient: null, lockInput: 0, catcher: null,
      reduceMotion: !!(DD.Save && DD.Save.data.reduceMotion),
      dust: new Uint8Array(L.N), dustTotal: 0, dustGot: 0,
      combo: 0, comboT: 0, maxCombo: 0, comboPop: 0, nextFever: 30, fever: 0, score: opts.score || 0, popups: []
    };
    for (var dn = 0; dn < L.N; dn++) {
      if (L.node[dn] && (L.feat[dn] === 'o' || L.feat[dn] === 'E')) { G.dust[dn] = 1; G.dustTotal++; }
    }
    L.rotators.forEach(function (r, i) { G.rotVis[i] = G.rotTarget[i] = r.o0; });
    discover();
    G.cam.s = baseScale();
    autoQueue = [];
    return G;
  }
  function nx0(L, n) { return n % L.w; }
  function ny0(L, n) { return (n / L.w) | 0; }

  function girlPos() {
    var g = G.girl;
    var x, y;
    if (g.mv) {
      var t = g.mv.t;
      x = DD.lerp(nx(g.mv.from), nx(g.mv.to), t);
      y = DD.lerp(ny(g.mv.from), ny(g.mv.to), t);
    } else { x = nx(G.st.pos); y = ny(G.st.pos); }
    return { x: x + g.nudgeX, y: y + g.nudgeY };
  }

  // ---------- input ----------
  function dirInput(d) {
    if (!G || G.ended || G.paused) return;
    autoplay = false;
    G.path.length = 0;
    var g = G.girl;
    if (g.mv && d === opp(g.mv.d) && G.L.edges[g.mv.e].kind !== EK.ONEWAY) {
      // turn around on the spot
      g.mv = { from: g.mv.to, to: g.mv.from, d: d, e: g.mv.e, t: 1 - g.mv.t, reversed: !g.mv.reversed };
      g.face = d; G.runDir = d; G.wantDir = -1;
      return;
    }
    G.wantDir = d; G.wantT = 0.9; // remembered for the next joint where that turn is possible
    if (!g.mv && G.lockInput <= 0) {
      decide();
      if (!g.mv) { bonk(d); G.wantDir = -1; }
    }
  }
  function holdInput(d) {
    if (!G) return;
    G.heldDir = d;
    if (d >= 0) dirInput(d);
  }
  function release(d) { if (G && (d == null || G.heldDir === d)) G.heldDir = -1; }

  function tap(sx, sy) {
    if (!G || G.ended || G.paused) return false;
    var wx = (sx - view.ox) / view.s, wy = (sy - view.oy) / view.s;
    var L = G.L, best = -1, bd = 0.6;
    for (var r = 0; r < L.rotators.length; r++) {
      var n = L.rotators[r].node;
      var d = Math.hypot(nx(n) - wx, ny(n) - wy);
      if (d < bd && G.discovered[n]) { bd = d; best = r; }
    }
    if (best >= 0) { spin(best); return true; }
    var tx = Math.round(wx), ty = Math.round(wy);
    if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return false;
    var tn = ty * L.w + tx;
    if (!L.node[tn] || !G.discovered[tn] || Math.hypot(tx - wx, ty - wy) > 0.55) return false;
    var p = findPath(tn);
    if (!p) { DD.Audio.play('bonk'); return false; }
    autoplay = false;
    G.path = p; G.wantDir = -1; G.runDir = -1;
    pingAt(tx, ty);
    if (!G.girl.mv && G.lockInput <= 0) decide();
    return true;
  }
  function action() {
    // keyboard: spin the turning joint nearest to the girl
    if (!G || G.ended || G.paused) return;
    var p = girlPos(), best = -1, bd = 1.6;
    G.L.rotators.forEach(function (r, i) {
      var d = Math.hypot(nx(r.node) - p.x, ny(r.node) - p.y);
      if (d < bd && G.discovered[r.node]) { bd = d; best = i; }
    });
    if (best >= 0) spin(best); else DD.Audio.play('bonk');
  }
  function spin(r) {
    var node = G.L.rotators[r].node, g = G.girl;
    if (g.mv && (g.mv.from === node || g.mv.to === node)) { DD.Audio.play('bonk'); return; }
    Lv.rotate(G.L, G.st, r);
    G.rotTarget[r] += 1;
    DD.Audio.play('rotate');
    DD.vibrate(8);
    burst(nx(node), ny(node), 6, '255,230,140', 1.5);
  }

  // Shortest walk to a seen joint, following the rules (bells and swirls included), avoiding rusty bars when possible.
  function findPath(target) {
    var L = G.L, st = G.st, g = G.girl;
    var sPos = g.mv ? g.mv.to : st.pos, sSw = st.sw;
    if (g.mv && !g.mv.reversed) {
      if (L.feat[sPos] === 'T') sSw ^= 1;
      if (L.portal[sPos] >= 0) sPos = L.portal[sPos];
    }
    if (sPos === target) return [];
    var probe = { sw: 0, rot: st.rot, crumbled: st.crumbled, unlocked: st.unlocked, keyMask: st.keyMask };
    for (var pass = 0; pass < 2; pass++) {
      var prev = new Map(), q = [sPos * 2 + sSw];
      prev.set(q[0], null);
      for (var i = 0; i < q.length; i++) {
        var k = q[i], pos = k >> 1;
        probe.sw = k & 1;
        for (var d = 0; d < 4; d++) {
          var e = Lv.canMove(L, probe, pos, d);
          if (e < 0) continue;
          if (pass === 0 && L.edges[e].kind === EK.CRUMBLE) continue;
          var to = Lv.other(L.edges[e], pos);
          if (!G.discovered[to]) continue;
          var sw = probe.sw, np = to;
          if (L.feat[to] === 'T') sw ^= 1;
          if (L.portal[to] >= 0) np = L.portal[to];
          var nk = np * 2 + sw;
          if (prev.has(nk)) continue;
          prev.set(nk, [k, d]);
          if (to === target || np === target) {
            var dirs = [], cur = nk;
            while (prev.get(cur)) { dirs.push(prev.get(cur)[1]); cur = prev.get(cur)[0]; }
            return dirs.reverse();
          }
          q.push(nk);
        }
      }
    }
    return null;
  }

  // ---------- movement ----------
  function tryStart(d) {
    var L = G.L, st = G.st, g = G.girl;
    var ev = [];
    var e = Lv.beginMove(L, st, d, ev);
    if (e < 0) return false;
    g.mv = { from: st.pos, to: Lv.other(L.edges[e], st.pos), d: d, e: e, t: 0, reversed: false };
    g.face = d;
    handleEvents(ev);
    return true;
  }
  function bonk(d) {
    G.girl.nudgeX = DX[d] * 0.1; G.girl.nudgeY = DY[d] * 0.1;
    G.girl.face = d;
    DD.Audio.play('bonk');
  }
  function decide() {
    var L = G.L, st = G.st;
    if (G.path.length) {
      var pd = G.path.shift();
      if (!tryStart(pd)) G.path.length = 0;
      return;
    }
    if (G.heldDir >= 0 && tryStart(G.heldDir)) { G.runDir = G.heldDir; G.wantDir = -1; return; }
    if (G.wantDir >= 0) {
      var wd = G.wantDir;
      if (tryStart(wd)) { G.wantDir = -1; G.runDir = wd; return; }
      if (G.runDir < 0 && G.heldDir < 0) { G.wantDir = -1; return; }
    }
    if (G.runDir >= 0) {
      // Keep running straight while the bar continues.
      if (tryStart(G.runDir)) return;
      // Blocked: take the corner if there is exactly one way on, otherwise stop and let the player choose.
      var exits = [];
      for (var d = 0; d < 4; d++) if (d !== opp(G.runDir) && Lv.canMove(L, st, st.pos, d) >= 0) exits.push(d);
      if (exits.length === 1 && tryStart(exits[0])) { G.runDir = exits[0]; return; }
      G.runDir = -1;
      G.wantDir = -1;
    }
  }
  function moveUpdate(dt) {
    var g = G.girl;
    if (G.lockInput > 0) G.lockInput -= dt;
    if (G.wantDir >= 0) { G.wantT -= dt; if (G.wantT <= 0 && g.mv) G.wantDir = -1; }
    if (autoplay && !g.mv && !G.path.length) autoStep();
    if (!g.mv && G.lockInput <= 0) decide();
    if (g.mv) {
      g.mv.t += dt * SPEED * (G.fever > 0 ? 1.3 : 1);
      g.walk = (g.walk < 0 ? 0 : g.walk) + dt * 15;
      var guard = 0;
      while (g.mv && g.mv.t >= 1 && guard++ < 4) {
        var over = g.mv.t - 1, mv = g.mv;
        g.mv = null;
        arrive(mv);
        if (G.ended) return;
        if (autoplay && !G.path.length) autoStep();
        if (G.lockInput <= 0) decide();
        if (g.mv) g.mv.t = Math.min(over, 0.9);
      }
    } else g.walk = -1;
  }
  function arrive(mv) {
    var g = G.girl;
    if (mv.reversed) { g.face = mv.d; return; } // she turned back: still on her joint, nothing happens
    var ev = [];
    var won = Lv.arrive(G.L, G.st, mv.e, mv.to, ev);
    if (!collectDust(mv.to)) DD.Audio.play('step', { alt: (G.st.pos & 1) === 1 });
    handleEvents(ev);
    if (won) win();
  }

  // ---------- stardust, combo and FEVER ----------
  function mult() { return Math.min(5, 1 + Math.floor(G.combo / 10)) * (G.fever > 0 ? 2 : 1); }
  function addCombo() {
    G.combo++;
    G.comboT = G.fever > 0 ? 2.4 : 1.6;
    G.comboPop = 1;
    if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    if (G.combo % 10 === 0) { DD.Audio.play('comboUp', { n: G.combo }); DD.vibrate(12); }
    if (G.combo >= G.nextFever) startFever();
  }
  function collectDust(n) {
    if (!G.dust[n]) return false;
    G.dust[n] = 0; G.dustGot++;
    addCombo();
    var pts = 10 * mult();
    G.score += pts;
    DD.Audio.play('dust', { n: G.combo });
    G.particles.push({ x: nx(n), y: ny(n), vx: 0, vy: -0.6, g: 0, life: 0.5, max: 0.5, size: 0.05, color: G.fever > 0 ? '255,170,240' : '255,236,160', type: 'spark' });
    if (G.dustGot === G.dustTotal) {
      G.score += 1000;
      popup(nx(n), ny(n) - 0.6, '+1000 ✧', '255,236,160');
      DD.Audio.play('reveal');
    }
    return true;
  }
  function startFever() {
    G.fever = 6;
    G.nextFever = G.combo + 40;
    DD.Audio.play('fever'); DD.vibrate([20, 30, 20, 30, 40]);
    if (DD.UI) DD.UI.toast(DD.t('toast.fever'), 1500);
    var p = girlPos();
    burst(p.x, p.y - 0.3, 30, '255,150,230', 4);
  }
  function popup(x, y, text, color) {
    G.popups.push({ x: x, y: y, text: text, color: color || '255,240,190', t: 0 });
    if (G.popups.length > 12) G.popups.shift();
  }

  function handleEvents(ev) {
    var L = G.L;
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i], E, mx, my;
      switch (e.t) {
        case 'shard':
          G.shardsGot++;
          G.score += 200 * mult(); addCombo();
          popup(nx(e.n), ny(e.n) - 0.5, '+' + 200 * mult(), '200,235,255');
          DD.Audio.play('shard'); DD.vibrate(15);
          burst(nx(e.n), ny(e.n), 16, '200,235,255', 3);
          if (e.all) {
            G.exitOpen = true; G.exitT = 0;
            DD.Audio.play('reveal'); DD.vibrate([30, 40, 30]);
            if (DD.UI) DD.UI.toast(DD.t('toast.exit'), 2600);
            burst(nx(L.exit), ny(L.exit), 30, '255,240,170', 4);
          }
          break;
        case 'marble':
          G.score += 1000; popup(nx(e.n), ny(e.n) - 0.5, '+1000', '255,205,60');
          DD.Audio.play('marble'); DD.vibrate(20);
          burst(nx(e.n), ny(e.n), 20, '255,205,60', 3);
          if (DD.UI) DD.UI.toast(DD.t('toast.marble'), 1800);
          break;
        case 'key':
          DD.Audio.play('key');
          burst(nx(e.n), ny(e.n), 12, '255,220,120', 2.5);
          if (DD.UI) DD.UI.toast(DD.t('toast.key'), 1600);
          break;
        case 'unlock':
          G.unlockT[e.e] = G.time;
          E = L.edges[e.e]; mx = (E.ax + E.bx) / 2; my = (E.ay + E.by) / 2;
          DD.Audio.play('unlock');
          burst(mx, my, 10, '230,220,255', 2);
          scheduleStuck();
          break;
        case 'switch':
          G.bellRing = 1;
          DD.Audio.play('bell', { sw: e.sw }); DD.vibrate(10);
          burst(nx(e.n), ny(e.n), 10, e.sw ? '67,217,238' : '255,111,174', 2);
          break;
        case 'crumble':
          G.crumbleT[e.e] = G.time;
          E = L.edges[e.e]; mx = (E.ax + E.bx) / 2; my = (E.ay + E.by) / 2;
          DD.Audio.play('crumble'); DD.vibrate(25);
          if (!G.reduceMotion) G.shake = Math.max(G.shake, 0.12);
          for (var c = 0; c < 9; c++) {
            G.particles.push({ x: mx + rnd(-0.3, 0.3) * (E.dir === 1 ? 1 : 0.2), y: my + rnd(-0.3, 0.3) * (E.dir === 2 ? 1 : 0.2), vx: rnd(-0.6, 0.6), vy: rnd(-0.8, 0.2), g: 3, life: 0.9, max: 0.9, size: rnd(0.03, 0.06), color: '196,122,44', type: 'chunk' });
          }
          scheduleStuck();
          break;
        case 'oneway':
          scheduleStuck();
          break;
        case 'portal':
          G.girl.tp = 0.4;
          G.lockInput = Math.max(G.lockInput, 0.18);
          if (!G.path.length) { G.runDir = -1; G.wantDir = -1; }
          DD.Audio.play('portal'); DD.vibrate(15);
          burst(nx(e.from), ny(e.from), 14, L.portalKind[e.from] === 'B' ? '95,242,193' : '183,140,255', 2.5);
          burst(nx(e.to), ny(e.to), 14, L.portalKind[e.to] === 'B' ? '95,242,193' : '183,140,255', 2.5);
          discover();
          break;
      }
    }
  }

  function scheduleStuck() { if (!G.stuck) G.stuckCheckT = 0.35; }
  function stuckCheck() {
    var res = DD.Solver.solve(G.L, { from: G.st, maxStates: 20000 });
    if (!res.ok && !res.capped) {
      G.stuck = true;
      if (DD.UI) { DD.UI.toast(DD.t('toast.stuck'), 6000); DD.UI.pulseRestart(true); }
    }
  }

  function discover() {
    var L = G.L, p = girlPos(), r = L.light * 0.9;
    var x0 = Math.max(0, Math.floor(p.x - r)), x1 = Math.min(L.w - 1, Math.ceil(p.x + r));
    var y0 = Math.max(0, Math.floor(p.y - r)), y1 = Math.min(L.h - 1, Math.ceil(p.y + r));
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var n = y * L.w + x;
      if (L.node[n] && !G.discovered[n] && Math.hypot(x - p.x, y - p.y) <= r) G.discovered[n] = 1;
    }
  }

  // ---------- hazards ----------
  function hit(src) {
    var g = G.girl;
    if (G.ended || g.inv > 0 || g.grace > 0 || G.god) return;
    G.hearts--; G.hits++;
    g.inv = 1.8; g.hurtT = 0.45;
    if (!G.reduceMotion) G.shake = 0.35;
    G.flash = G.reduceMotion ? 0.2 : 0.45;
    DD.Audio.play(src === 'balloon' ? 'squeak' : 'slam');
    DD.Audio.play('hurt');
    DD.vibrate(90);
    var p = girlPos();
    burst(p.x, p.y - 0.3, 10, '255,120,150', 2.5);
    if (G.hearts <= 0) caught();
  }
  function updateBalloons(dt) {
    var p = girlPos();
    G.balloons.forEach(function (b) {
      var u = (b.phase + G.time * b.speed / b.len) % 2;
      if (u > 1) u = 2 - u;
      b.x = b.ax + (b.bx - b.ax) * u; b.y = b.ay + (b.by - b.ay) * u;
      if (b.hitT > 0) b.hitT -= dt;
      if (Math.hypot(b.x - p.x, b.y - p.y) < 0.42 && !G.ended) {
        if (G.girl.inv <= 0 && G.girl.grace <= 0) b.hitT = 0.5;
        hit('balloon');
      }
    });
  }
  function updateHands(dt) {
    var L = G.L;
    if (L.hands && !G.ended && !G.god) {
      var pressure = (L.par && G.time > L.par) ? 1.35 : 1;
      G.handTimer -= dt * pressure;
      if (G.handTimer <= 0) {
        if (G.time > 3 && G.hands.length < (L.hands.max || 1)) spawnHand();
        G.handTimer = rnd(L.hands.every[0], L.hands.every[1]);
      }
    }
    var p = girlPos();
    for (var i = G.hands.length - 1; i >= 0; i--) {
      var h = G.hands[i];
      h.t += dt;
      if (h.phase === 'warn' && h.t >= h.warn) { h.phase = 'down'; h.t = 0; }
      else if (h.phase === 'down' && h.t >= 0.16) {
        h.phase = 'hold'; h.t = 0;
        DD.Audio.play('slam');
        if (!G.reduceMotion) G.shake = Math.max(G.shake, 0.18);
        for (var k = 0; k < 8; k++) G.particles.push({ x: h.x + rnd(-0.3, 0.3), y: h.y + rnd(-0.1, 0.2), vx: rnd(-0.8, 0.8), vy: rnd(-0.6, 0), g: 1.5, life: 0.6, max: 0.6, size: rnd(0.02, 0.04), color: '220,210,240', type: 'dust' });
        if (Math.hypot(p.x - h.x, p.y - h.y) < 0.45) hit('hand');
      } else if (h.phase === 'hold' && h.t >= 0.35) { h.phase = 'up'; h.t = 0; }
      else if (h.phase === 'up' && h.t >= 0.45) G.hands.splice(i, 1);
    }
  }
  function spawnHand() {
    var g = G.girl, n = g.mv ? (g.mv.t > 0.35 ? g.mv.to : g.mv.from) : G.st.pos;
    G.hands.push({ x: nx(n), y: ny(n), t: 0, warn: G.L.hands.warn, phase: 'warn' });
    DD.Audio.play('handWarn');
  }
  function updateAmbient(dt) {
    var chapter = G.opts.chapter || 0;
    if (chapter < 2 && !(G.opts.mode === 'endless' && G.opts.depth >= 6)) return;
    if (G.ambient) {
      G.ambient.t += dt;
      if (G.ambient.t > 4) G.ambient = null;
      return;
    }
    G.ambientT -= dt;
    if (G.ambientT <= 0) {
      G.ambient = { t: 0, side: Math.random() < 0.5 ? -1 : 1, y: rnd(0.2, 0.7) };
      G.ambientT = rnd(22, 38);
      DD.Audio.play('chuckle');
    }
  }

  // ---------- ending a stage ----------
  function win() {
    G.ended = true; G.result = 'win'; G.endT = 0;
    G.bonus = { clear: 1000, time: Math.max(0, Math.round((G.L.par - G.time) * 20)), unhurt: G.hits === 0 ? 500 : 0 };
    G.score += G.bonus.clear + G.bonus.time + G.bonus.unhurt;
    G.fever = 0;
    G.hands.length = 0;
    DD.Audio.play('clear'); DD.vibrate([20, 30, 60]);
    burst(nx(G.L.exit), ny(G.L.exit), 40, '255,240,170', 4);
  }
  function caught() {
    G.ended = true; G.result = 'caught'; G.endT = 0;
    var p = girlPos();
    G.catcher = { x: p.x, y: p.y, t: 0 };
    G.hands.length = 0;
    DD.Audio.play('caught');
  }
  function stats() {
    return {
      time: G.time, par: G.L.par, marble: !!G.st.marble, hasMarble: G.L.marble >= 0,
      hits: G.hits, hearts: G.hearts, shards: G.L.shards.length, result: G.result,
      score: G.score, dust: G.dustGot, dustTotal: G.dustTotal, maxCombo: G.maxCombo, bonus: G.bonus || null
    };
  }

  // ---------- particles ----------
  function burst(x, y, n, color, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, s = Math.random() * speed * 0.5 + 0.2;
      G.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.3, g: 0.6, life: rnd(0.4, 0.9), max: 0.9, size: rnd(0.025, 0.06), color: color, type: 'spark' });
    }
    if (G.particles.length > 400) G.particles.splice(0, G.particles.length - 400);
  }
  function pingAt(x, y) {
    G.particles.push({ x: x, y: y, vx: 0, vy: 0, g: 0, life: 0.5, max: 0.5, size: 0.3, color: '255,240,190', type: 'ring' });
  }

  // ---------- update ----------
  function update(dt) {
    if (!G || G.paused) return;
    var g = G.girl;
    if (!G.ended) {
      G.time += dt;
      moveUpdate(dt);
      discover();
      updateBalloons(dt);
      updateHands(dt);
      updateAmbient(dt);
      if (G.stuckCheckT > 0) {
        G.stuckCheckT -= dt;
        if (G.stuckCheckT <= 0) { if (g.mv) G.stuckCheckT = 0.1; else stuckCheck(); }
      }
    } else {
      G.endT += dt;
      if (G.result === 'caught' && G.catcher) G.catcher.t += dt;
      if (!G.endCalled && G.endT > (G.result === 'win' ? 1.1 : 1.9)) {
        G.endCalled = true;
        var cb = G.result === 'win' ? G.opts.onWin : G.opts.onCaught;
        var me = G;
        if (cb) cb(stats());
        if (G !== me) return; // the callback started another stage
      }
    }
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var q = G.particles[i];
      q.life -= dt;
      if (q.life <= 0) { G.particles.splice(i, 1); continue; }
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 1 - dt * 1.5;
    }
    g.inv = Math.max(0, g.inv - dt); g.grace = Math.max(0, g.grace - dt);
    g.hurtT = Math.max(0, g.hurtT - dt); g.tp = Math.max(0, g.tp - dt);
    g.nudgeX = DD.approach(g.nudgeX, 0, 14, dt); g.nudgeY = DD.approach(g.nudgeY, 0, 14, dt);
    for (var r = 0; r < G.rotVis.length; r++) G.rotVis[r] = DD.approach(G.rotVis[r], G.rotTarget[r], 16, dt);
    G.swVis = DD.approach(G.swVis, G.st.sw, 10, dt);
    G.bellRing = Math.max(0, G.bellRing - dt * 1.5);
    G.comboPop = Math.max(0, G.comboPop - dt * 4);
    if (!G.ended) {
      if (G.combo > 0) {
        G.comboT -= dt;
        if (G.comboT <= 0) { if (G.combo >= 10) DD.Audio.play('comboEnd'); G.combo = 0; }
      }
      if (G.fever > 0) {
        G.fever -= dt;
        if (G.girl.mv && Math.random() < 0.6) {
          var fp = girlPos();
          G.particles.push({ x: fp.x + rnd(-0.1, 0.1), y: fp.y - 0.15 + rnd(-0.1, 0.1), vx: 0, vy: 0, g: 0, life: 0.45, max: 0.45, size: 0.06, color: 'hsl', hue: (G.time * 400) % 360, type: 'spark' });
        }
      }
    }
    for (var pi = G.popups.length - 1; pi >= 0; pi--) { G.popups[pi].t += dt; if (G.popups[pi].t > 1.1) G.popups.splice(pi, 1); }
    G.shake = Math.max(0, G.shake - dt);
    G.flash = Math.max(0, G.flash - dt * 1.6);
    if (G.exitOpen) G.exitT += dt;
    var warn = G.hands.some(function (h) { return h.phase === 'warn'; });
    DD.Audio.tension(G.ended ? 0 : warn ? 0.9 : G.L.hands ? 0.12 : 0);
    updateCamera(dt);
  }

  // ---------- camera ----------
  function baseScale() {
    var avail = Math.min(view.w, view.h - view.top - view.bottom);
    return DD.clamp(avail / 6.4, 42, 120);
  }
  function fitScale() {
    var L = G.L;
    return Math.min(view.w / (L.w + 0.8), (view.h - view.top - view.bottom) / (L.h + 0.8));
  }
  function updateCamera(dt) {
    var L = G.L, cam = G.cam;
    var targetS = cam.overview ? Math.min(fitScale(), baseScale()) : baseScale();
    cam.s = dt > 0 ? DD.approach(cam.s, targetS, 7, dt) : targetS;
    var p = girlPos();
    var tx = p.x, ty = p.y - 0.25;
    if (cam.overview) { tx = (L.w - 1) / 2; ty = (L.h - 1) / 2; }
    var halfW = view.w / 2 / cam.s, halfH = (view.h - view.top - view.bottom) / 2 / cam.s;
    var m = 0.9;
    if ((L.w - 1) + m * 2 <= halfW * 2) tx = (L.w - 1) / 2;
    else tx = DD.clamp(tx, -m + halfW, L.w - 1 + m - halfW);
    if ((L.h - 1) + m * 2 <= halfH * 2) ty = (L.h - 1) / 2;
    else ty = DD.clamp(ty, -m + halfH, L.h - 1 + m - halfH);
    if (dt > 0) { cam.x = DD.approach(cam.x, tx, 6, dt); cam.y = DD.approach(cam.y, ty, 6, dt); }
    else { cam.x = tx; cam.y = ty; }
  }
  function setView(w, h, dpr, top, bottom) {
    view.w = w; view.h = h; view.dpr = dpr; view.top = top; view.bottom = bottom;
    if (G) updateCamera(0);
  }
  function toggleOverview() {
    if (!G) return false;
    G.cam.overview = !G.cam.overview;
    DD.Audio.play('ui');
    return G.cam.overview;
  }

  // ---------- drawing ----------
  var stars = null;
  function background(ctx) {
    var w = view.w, h = view.h;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#05040f'); g.addColorStop(1, '#100b26');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (!stars) {
      var rng = DD.makeRng(11);
      stars = [];
      for (var i = 0; i < 90; i++) stars.push({ x: rng(), y: rng(), r: rng() * 1.3 + 0.3, ph: rng() * TAU });
    }
    var cx = G ? G.cam.x * 4 : 0, cy = G ? G.cam.y * 4 : 0;
    for (var j = 0; j < stars.length; j++) {
      var s = stars[j];
      var x = ((s.x * w - cx) % w + w) % w, y = ((s.y * h - cy) % h + h) % h;
      ctx.fillStyle = 'rgba(200,190,255,' + (0.25 + 0.25 * Math.sin(G.time * 1.2 + s.ph)) + ')';
      ctx.fillRect(x, y, s.r, s.r);
    }
  }

  function draw(ctx) {
    if (!G) return;
    var L = G.L, st = G.st, dpr = view.dpr, t = G.time + G.endT;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    background(ctx);
    var s = G.cam.s;
    var shx = 0, shy = 0;
    if (G.shake > 0) { shx = (Math.random() - 0.5) * G.shake * 16; shy = (Math.random() - 0.5) * G.shake * 16; }
    var playH = view.h - view.top - view.bottom;
    view.s = s;
    view.ox = view.w / 2 - G.cam.x * s + shx;
    view.oy = view.top + playH / 2 - G.cam.y * s + shy;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * view.ox, dpr * view.oy);
    var x0 = Math.floor(-view.ox / s) - 1, x1 = Math.ceil((view.w - view.ox) / s) + 1;
    var y0 = Math.floor(-view.oy / s) - 1, y1 = Math.ceil((view.h - view.oy) / s) + 1;
    var vb = { x0: Math.max(0, x0), x1: Math.min(L.w - 1, x1), y0: Math.max(0, y0), y1: Math.min(L.h - 1, y1) };

    drawBars(ctx, vb, t);
    drawJoints(ctx, vb, t);
    drawBalloons(ctx, t);
    drawGirl(ctx, t);
    drawFog(ctx, vb, t);
    // above the dark: things you can sense from afar
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * view.ox, dpr * view.oy);
    L.shards.forEach(function (n, i) {
      if (st.shardMask & (1 << i)) return;
      var tw = 0.35 + 0.35 * Math.sin(t * 3 + i * 1.7);
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#dff3ff';
      R.star4(ctx, nx(n), ny(n), 0.1, t * 0.5); ctx.fill();
      ctx.globalAlpha = 1;
    });
    if (G.exitOpen) {
      var ex = nx(L.exit), ey = ny(L.exit), pulse = 0.6 + 0.4 * Math.sin(t * 3);
      R.drawGlow(ctx, ex, ey, 0.9 + pulse * 0.3, 'rgba(255,240,170,0.8)', Math.min(1, G.exitT * 2));
      ctx.globalAlpha = Math.min(1, G.exitT) * 0.25;
      ctx.fillStyle = '#fff6d0';
      ctx.fillRect(ex - 0.2, ey - 12, 0.4, 12);
      ctx.globalAlpha = 1;
    }
    drawHands(ctx, t);
    drawParticles(ctx);
    // screen space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawAmbient(ctx, t);
    drawPointers(ctx, t);
    drawCombo(ctx, t);
    if (G.flash > 0) {
      ctx.fillStyle = 'rgba(' + G.flashColor + ',' + (G.flash * 0.45) + ')';
      ctx.fillRect(0, 0, view.w, view.h);
    }
    var vg = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, view.w, view.h);
    if (G.ended && G.result === 'win') {
      ctx.fillStyle = 'rgba(255,240,200,' + Math.min(0.32, G.endT * 0.4) + ')';
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  function edgeVisible(E, vb) {
    return !(Math.max(E.ax, E.bx) < vb.x0 - 1 || Math.min(E.ax, E.bx) > vb.x1 + 1 || Math.max(E.ay, E.by) < vb.y0 - 1 || Math.min(E.ay, E.by) > vb.y1 + 1);
  }
  function drawBars(ctx, vb, t) {
    var L = G.L, st = G.st;
    var plain = [], stubs = [];
    var i, E;
    for (i = 0; i < L.edges.length; i++) {
      E = L.edges[i];
      if (!edgeVisible(E, vb)) continue;
      var ra = L.rotIdx[E.a] >= 0, rb = L.rotIdx[E.b] >= 0;
      if (ra || rb) {
        if (!ra) stubs.push([E.ax, E.ay, (E.ax + E.bx) / 2, (E.ay + E.by) / 2]);
        if (!rb) stubs.push([E.bx, E.by, (E.ax + E.bx) / 2, (E.ay + E.by) / 2]);
        continue;
      }
      if (E.kind === EK.BAR || E.kind === EK.LOCK || E.kind === EK.ONEWAY) plain.push([E.ax, E.ay, E.bx, E.by]);
    }
    var segs = plain.concat(stubs);
    // shadows on the floor below
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.32)'; ctx.lineWidth = BAR * 1.1;
    ctx.beginPath();
    segs.forEach(function (q) { ctx.moveTo(q[0] + 0.07, q[1] + 0.12); ctx.lineTo(q[2] + 0.07, q[3] + 0.12); });
    ctx.stroke();
    batch(ctx, segs, C.yellowDark, BAR, 0, BAR * 0.18);
    batch(ctx, segs, C.yellow, BAR * 0.86, 0, 0);
    batch(ctx, segs, C.yellowLight, BAR * 0.26, 0, -BAR * 0.2);

    for (i = 0; i < L.edges.length; i++) {
      E = L.edges[i];
      if (!edgeVisible(E, vb)) continue;
      var mx = (E.ax + E.bx) / 2, my = (E.ay + E.by) / 2;
      if (E.kind === EK.PINK || E.kind === EK.CYAN) {
        var solid = E.kind === EK.PINK ? 1 - G.swVis : G.swVis;
        var col = E.kind === EK.PINK ? C.pink : C.cyan, dark = E.kind === EK.PINK ? C.pinkDark : C.cyanDark;
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([0.08, 0.1]);
        ctx.strokeStyle = col; ctx.lineWidth = 0.035;
        ctx.beginPath(); ctx.moveTo(E.ax, E.ay); ctx.lineTo(E.bx, E.by); ctx.stroke();
        ctx.setLineDash([]);
        if (solid > 0.02) {
          ctx.globalAlpha = solid;
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = BAR * 1.1 * solid;
          ctx.beginPath(); ctx.moveTo(E.ax + 0.07, E.ay + 0.12); ctx.lineTo(E.bx + 0.07, E.by + 0.12); ctx.stroke();
          R.tube(ctx, E.ax, E.ay, E.bx, E.by, BAR * (0.6 + 0.4 * solid), col, dark, 'rgba(255,255,255,0.55)');
        }
        ctx.globalAlpha = 1;
      } else if (E.kind === EK.CRUMBLE) {
        var ct = G.crumbleT[i];
        if (ct < 0) {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = BAR * 1.1;
          ctx.beginPath(); ctx.moveTo(E.ax + 0.07, E.ay + 0.12); ctx.lineTo(E.bx + 0.07, E.by + 0.12); ctx.stroke();
          var wob = (G.girl.mv && G.girl.mv.e === i && !G.girl.mv.reversed) ? Math.sin(t * 60) * 0.015 : 0;
          R.tube(ctx, E.ax + wob, E.ay + wob, E.bx - wob, E.by - wob, BAR, C.rust, C.rustDark, C.rustLight);
          ctx.strokeStyle = C.rustDark; ctx.lineWidth = 0.02;
          ctx.beginPath();
          for (var k = 1; k <= 3; k++) {
            var fx = DD.lerp(E.ax, E.bx, k / 4), fy = DD.lerp(E.ay, E.by, k / 4);
            if (E.dir === 1) { ctx.moveTo(fx - 0.02, fy - 0.05); ctx.lineTo(fx + 0.02, fy + 0.05); }
            else { ctx.moveTo(fx - 0.05, fy - 0.02); ctx.lineTo(fx + 0.05, fy + 0.02); }
          }
          ctx.stroke();
        } else {
          var sl = 0.2;
          var dx = E.bx - E.ax, dy = E.by - E.ay;
          R.tube(ctx, E.ax, E.ay, E.ax + dx * sl, E.ay + dy * sl, BAR * 0.8, C.rust, C.rustDark, null);
          R.tube(ctx, E.bx, E.by, E.bx - dx * sl, E.by - dy * sl, BAR * 0.8, C.rust, C.rustDark, null);
        }
      } else if (E.kind === EK.ONEWAY) {
        var d = E.ow, off = (t * 0.8) % 0.33;
        ctx.strokeStyle = C.yellowDeep; ctx.lineWidth = 0.035; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (var c = 0; c < 3; c++) {
          var u = -0.33 + c * 0.33 + off;
          if (u < -0.4 || u > 0.4) continue;
          var px = mx + DX[d] * u, py = my + DY[d] * u;
          var bx = -DX[d] * 0.07, by = -DY[d] * 0.07, sx = -DY[d] * 0.06, sy = DX[d] * 0.06;
          ctx.moveTo(px + bx + sx, py + by + sy); ctx.lineTo(px, py); ctx.lineTo(px + bx - sx, py + by - sy);
        }
        ctx.stroke();
      } else if (E.kind === EK.LOCK) {
        var lb = 1 << L.lockBit[i];
        if (!(st.unlocked & lb)) R.padlock(ctx, mx, my, 0.9, 0);
        else {
          var ut = G.time - G.unlockT[i];
          if (G.unlockT[i] >= 0 && ut < 0.8) { ctx.globalAlpha = 1 - ut / 0.8; R.padlock(ctx, mx, my - ut * 0.3, 0.9, Math.min(1, ut * 3)); ctx.globalAlpha = 1; }
        }
      }
    }
    // turning joints
    L.rotators.forEach(function (r, ri) {
      var x = nx(r.node), y = ny(r.node);
      if (x < vb.x0 - 1 || x > vb.x1 + 1 || y < vb.y0 - 1 || y > vb.y1 + 1) return;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(x + 0.06, y + 0.1, 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2a10';
      ctx.beginPath(); ctx.arc(x, y, 0.29, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.yellowDark; ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.arc(x, y, 0.27, 0, TAU); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(G.rotVis[ri] * Math.PI / 2);
      for (var d2 = 0; d2 < 4; d2++) {
        if (!(r.mask & DD.BIT[d2])) continue;
        R.tube(ctx, 0, 0, DX[d2] * 0.5, DY[d2] * 0.5, BAR, C.yellow, C.yellowDark, C.yellowLight);
      }
      ctx.restore();
      // spin hint arrows
      ctx.strokeStyle = 'rgba(255,240,190,0.7)'; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.arc(x, y, 0.36, -0.9 + t * 0.6, 0.3 + t * 0.6); ctx.stroke();
    });
  }
  function batch(ctx, segs, color, width, dx, dy) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath();
    for (var i = 0; i < segs.length; i++) { var q = segs[i]; ctx.moveTo(q[0] + dx, q[1] + dy); ctx.lineTo(q[2] + dx, q[3] + dy); }
    ctx.stroke();
  }

  function drawJoints(ctx, vb, t) {
    var L = G.L, st = G.st, spr = R.sprites.joint, js = 0.27;
    for (var y = vb.y0; y <= vb.y1; y++) for (var x = vb.x0; x <= vb.x1; x++) {
      var n = y * L.w + x;
      if (!L.node[n] || L.rotIdx[n] >= 0) continue;
      ctx.drawImage(spr, x - js / 2, y - js / 2, js, js);
    }
    L.rotators.forEach(function (r) {
      var x = nx(r.node), y = ny(r.node);
      ctx.drawImage(spr, x - 0.17, y - 0.17, 0.34, 0.34);
    });
    // stardust: round pale-blue pellets sitting on the joints (contrast against the yellow bars)
    var tw = G.fever > 0;
    ctx.beginPath();
    for (var dy = vb.y0; dy <= vb.y1; dy++) for (var dx = vb.x0; dx <= vb.x1; dx++) {
      var dn = dy * L.w + dx;
      if (!G.dust[dn]) continue;
      var dr = 0.085 + Math.sin(t * 4 + dx * 1.3 + dy * 0.7) * 0.012;
      ctx.moveTo(dx + dr, dy - 0.02);
      ctx.arc(dx, dy - 0.02, dr, 0, TAU);
    }
    ctx.lineWidth = 0.04;
    ctx.strokeStyle = 'rgba(30,20,70,0.9)';
    ctx.stroke();
    ctx.fillStyle = tw ? 'hsl(' + ((t * 300) % 360) + ',100%,82%)' : '#d9f6ff';
    ctx.fill();
    // start mat
    ctx.strokeStyle = 'rgba(200,180,255,0.45)'; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.arc(nx(L.start), ny(L.start), 0.3, 0, TAU); ctx.stroke();
    // exit hatch
    if (G.exitOpen) {
      var ex = nx(L.exit), ey = ny(L.exit), k = Math.min(1, G.exitT * 1.5), pulse = Math.sin(t * 4) * 0.03;
      ctx.fillStyle = 'rgba(20,10,30,0.9)';
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.34 * k, 0.24 * k, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.yellow; ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.ellipse(ex, ey, (0.36 + pulse) * k, (0.26 + pulse) * k, 0, 0, TAU); ctx.stroke();
      var gg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 0.3 * k + 0.001);
      gg.addColorStop(0, 'rgba(255,246,200,0.95)'); gg.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(ex, ey, 0.3 * k, 0.2 * k, 0, 0, TAU); ctx.fill();
    }
    // items
    for (var i = 0; i < L.N; i++) {
      var f = L.feat[i];
      if (!f || f === 'o' || f === 'S' || f === 'E' || f === 'R') continue;
      var ix = nx(i), iy = ny(i);
      if (ix < vb.x0 - 1 || ix > vb.x1 + 1 || iy < vb.y0 - 1 || iy > vb.y1 + 1) continue;
      if (f === '*') { if (!(st.shardMask & (1 << L.shardBit[i]))) R.shard(ctx, ix, iy - 0.08, 0.17, t); }
      else if (f === 'M') { if (!st.marble) R.marble(ctx, ix, iy - 0.08, 0.12, t); }
      else if (f === 'K') { if (!(st.keyMask & (1 << L.keyBit[i]))) R.key(ctx, ix, iy - 0.1, 0.8, t); }
      else if (f === 'T') R.bellIcon(ctx, ix, iy, 1, st.sw, t, G.bellRing);
      else R.portal(ctx, ix, iy, 1, t, L.portalKind[i]);
    }
  }

  function drawBalloons(ctx, t) {
    G.balloons.forEach(function (b) { R.balloon(ctx, b.x, b.y, 1, t, b.hitT > 0); });
  }

  function drawGirl(ctx, t) {
    var g = G.girl, p = girlPos();
    if (G.result === 'caught' && G.catcher) {
      var ct = G.catcher.t;
      if (ct > 0.55) p = { x: p.x, y: p.y - Math.pow(ct - 0.55, 2) * 6 };
    }
    if (g.inv > 0 && Math.floor(g.inv * 12) % 2 === 0 && !G.ended) return;
    var scale = g.tp > 0 ? 1 - Math.sin((g.tp / 0.4) * Math.PI) * 0.6 : 1;
    if (G.result === 'win') scale *= Math.max(0, 1 - G.endT * 0.8);
    ctx.save();
    ctx.translate(p.x, p.y + 0.14);
    if (g.tp > 0) ctx.rotate(Math.sin(g.tp * 20) * 0.3);
    ctx.scale(scale, scale);
    R.girl(ctx, 0, 0, GIRL_H, { face: g.face, walk: g.mv ? g.walk : -1, t: t, scared: g.hurtT > 0 || G.result === 'caught' });
    ctx.restore();
  }

  function drawFog(ctx, vb, t) {
    var L = G.L, dpr = view.dpr, k = 0.5;
    var W = Math.max(1, Math.ceil(view.w * dpr * k)), H = Math.max(1, Math.ceil(view.h * dpr * k));
    if (!fog) { fog = globalThis.document.createElement('canvas'); fogCtx = fog.getContext('2d'); }
    if (fog.width !== W || fog.height !== H) { fog.width = W; fog.height = H; }
    var f = fogCtx, s = view.s, soft = R.sprites.soft;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, W, H);
    f.fillStyle = 'rgba(5,3,16,0.985)';
    f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'destination-out';
    var kk = dpr * k;
    f.setTransform(kk * s, 0, 0, kk * s, kk * view.ox, kk * view.oy);
    f.globalAlpha = 0.34;
    for (var y = vb.y0; y <= vb.y1; y++) for (var x = vb.x0; x <= vb.x1; x++) {
      var n = y * L.w + x;
      if (G.discovered[n]) f.drawImage(soft, x - 0.95, y - 0.95, 1.9, 1.9);
    }
    var p = girlPos();
    var r = L.light * 1.22 * (G.fever > 0 ? 1.45 : 1) * (1 + Math.sin(t * 6.3) * 0.02 + Math.sin(t * 2.1) * 0.02);
    f.globalAlpha = 1;
    f.drawImage(R.sprites.light, p.x - r, p.y - 0.2 - r, r * 2, r * 2);
    if (G.exitOpen) { f.globalAlpha = 0.8; f.drawImage(soft, nx(L.exit) - 1.4, ny(L.exit) - 1.4, 2.8, 2.8); }
    G.hands.forEach(function (h) { f.globalAlpha = 0.5; f.drawImage(soft, h.x - 1, h.y - 1, 2, 2); });
    f.globalAlpha = 1;
    f.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fog, 0, 0, W, H, 0, 0, view.w * dpr, view.h * dpr);
  }

  function drawHands(ctx, t) {
    G.hands.forEach(function (h) {
      if (h.phase === 'warn') {
        var k = Math.min(1, h.t / h.warn);
        ctx.fillStyle = 'rgba(10,0,20,' + (0.25 + 0.45 * k) + ')';
        ctx.beginPath(); ctx.ellipse(h.x, h.y + 0.05, 0.2 + 0.3 * k, 0.12 + 0.18 * k, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,70,120,' + (0.4 + 0.5 * Math.abs(Math.sin(t * (6 + k * 10)))) + ')';
        ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.ellipse(h.x, h.y + 0.05, 0.5 - 0.1 * k, 0.32 - 0.06 * k, 0, 0, TAU); ctx.stroke();
      } else {
        var pp = h.phase === 'down' ? h.t / 0.16 : h.phase === 'hold' ? 1 : 1 - h.t / 0.45;
        ctx.fillStyle = 'rgba(10,0,20,0.55)';
        ctx.beginPath(); ctx.ellipse(h.x, h.y + 0.05, 0.45, 0.28, 0, 0, TAU); ctx.fill();
        R.handTop(ctx, h.x, h.y, 1, DD.clamp(pp, 0, 1), h.phase === 'hold' ? 0.6 : 1);
      }
    });
    if (G.catcher) {
      var c = G.catcher, ct = c.t;
      var pd = ct < 0.35 ? ct / 0.35 : 1;
      var yy = c.y - (ct > 0.55 ? Math.pow(ct - 0.55, 2) * 6 : 0);
      R.handTop(ctx, c.x, yy, 1.1, pd, ct > 0.35 ? 0.3 : 1);
    }
  }

  function drawParticles(ctx) {
    G.particles.forEach(function (q) {
      var a = Math.max(0, q.life / q.max);
      if (q.type === 'ring') {
        ctx.strokeStyle = 'rgba(' + q.color + ',' + a + ')'; ctx.lineWidth = 0.04;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.6 - a), 0, TAU); ctx.stroke();
      } else if (q.type === 'chunk') {
        ctx.fillStyle = 'rgba(' + q.color + ',' + a + ')';
        ctx.fillRect(q.x - q.size, q.y - q.size, q.size * 2, q.size * 2);
      } else {
        ctx.fillStyle = q.color === 'hsl' ? 'hsla(' + q.hue + ',100%,72%,' + a + ')' : 'rgba(' + q.color + ',' + a + ')';
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, TAU); ctx.fill();
      }
    });
  }

  function drawAmbient(ctx, t) {
    var a = G.ambient;
    if (!a) return;
    var k = a.t < 1 ? a.t : a.t > 3 ? Math.max(0, 4 - a.t) : 1;
    var size = Math.min(view.w, view.h) * 0.22;
    var x = a.side < 0 ? size * 0.7 : view.w - size * 0.7, y = view.top + (view.h - view.top) * a.y;
    ctx.save();
    ctx.globalAlpha = 0.33 * k;
    ctx.fillStyle = '#f2ecf6';
    ctx.beginPath(); ctx.arc(x - size * 0.18, y, size * 0.03, 0, TAU); ctx.arc(x + size * 0.18, y, size * 0.03, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - size * 0.32, y + size * 0.22);
    ctx.quadraticCurveTo(x, y + size * 0.45, x + size * 0.32, y + size * 0.22);
    ctx.quadraticCurveTo(x, y + size * 0.36, x - size * 0.32, y + size * 0.22);
    ctx.fill();
    ctx.restore();
  }

  function drawCombo(ctx, t) {
    var font = '800 {px}px Sniglet, Jua, "M PLUS Rounded 1c", "ZCOOL KuaiLe", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    G.popups.forEach(function (p) {
      var a = 1 - p.t / 1.1;
      var sx = view.ox + p.x * view.s, sy = view.oy + (p.y - p.t * 0.8) * view.s;
      ctx.font = font.replace('{px}', 16);
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,6,24,' + a * 0.8 + ')';
      ctx.strokeText(p.text, sx, sy);
      ctx.fillStyle = 'rgba(' + p.color + ',' + a + ')';
      ctx.fillText(p.text, sx, sy);
    });
    if (G.combo >= 3 && !G.ended) {
      var gp = girlPos();
      var cx = DD.clamp(view.ox + gp.x * view.s, 64, view.w - 64), cy = Math.max(view.top + 24, view.oy + gp.y * view.s - view.s * 0.8 - 62);
      var k = 1 + G.comboPop * 0.35;
      var fade = Math.min(1, G.comboT / 0.5);
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(k, k);
      ctx.font = font.replace('{px}', 20);
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,6,24,' + 0.85 * fade + ')';
      var label = G.combo + ' combo';
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = G.fever > 0 ? 'hsla(' + ((t * 300) % 360) + ',100%,75%,' + fade + ')' : 'rgba(255,214,80,' + fade + ')';
      ctx.fillText(label, 0, 0);
      var m = mult();
      if (m > 1) {
        ctx.font = font.replace('{px}', 13);
        ctx.strokeText('×' + m, 0, 17); ctx.fillText('×' + m, 0, 17);
      }
      // time left before the combo breaks
      ctx.fillStyle = 'rgba(255,255,255,' + 0.25 * fade + ')';
      ctx.fillRect(-26, 27, 52, 3);
      ctx.fillStyle = 'rgba(255,214,80,' + 0.9 * fade + ')';
      ctx.fillRect(-26, 27, 52 * DD.clamp(G.comboT / (G.fever > 0 ? 2.4 : 1.6), 0, 1), 3);
      ctx.restore();
    }
    if (G.fever > 0) {
      var hue = (t * 200) % 360, al = Math.min(1, G.fever) * (0.35 + 0.15 * Math.sin(t * 12));
      var g1 = ctx.createLinearGradient(0, 0, 0, view.h);
      g1.addColorStop(0, 'hsla(' + hue + ',100%,65%,' + al + ')'); g1.addColorStop(0.15, 'hsla(' + hue + ',100%,65%,0)');
      g1.addColorStop(0.85, 'hsla(' + ((hue + 120) % 360) + ',100%,65%,0)'); g1.addColorStop(1, 'hsla(' + ((hue + 120) % 360) + ',100%,65%,' + al + ')');
      ctx.fillStyle = g1; ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  // Arrows at the screen edge toward the open exit (and the last shards).
  function drawPointers(ctx, t) {
    var L = G.L, st = G.st, targets = [];
    if (G.exitOpen) targets.push({ n: L.exit, c: '255,236,150' });
    var left = L.shards.length - G.shardsGot;
    if (left > 0 && left <= 2) L.shards.forEach(function (n, i) { if (!(st.shardMask & (1 << i))) targets.push({ n: n, c: '200,235,255' }); });
    var m = 28, top = view.top + 8, bottom = view.h - view.bottom - 8;
    targets.forEach(function (tg) {
      var sx = view.ox + nx(tg.n) * view.s, sy = view.oy + ny(tg.n) * view.s;
      if (sx > m && sx < view.w - m && sy > top + m && sy < bottom - m) return;
      var cx = view.w / 2, cy = (top + bottom) / 2;
      var dx = sx - cx, dy = sy - cy;
      var kx = dx !== 0 ? (view.w / 2 - m) / Math.abs(dx) : Infinity, ky = dy !== 0 ? ((bottom - top) / 2 - m) / Math.abs(dy) : Infinity;
      var k = Math.min(kx, ky);
      var px = cx + dx * k, py = cy + dy * k, ang = Math.atan2(dy, dx);
      var pulse = 1 + Math.sin(t * 5) * 0.12;
      ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(' + tg.c + ',0.9)';
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
  }

  // ---------- test helpers ----------
  function autoStep() {
    if (!autoQueue.length) {
      var res = DD.Solver.solve(G.L, { from: G.st, maxStates: 3000000, requireMarble: G.autoMarble && !G.st.marble });
      if (!res.ok) { autoplay = false; return; }
      autoQueue = res.actions.slice();
    }
    var a = autoQueue.shift();
    if (a == null) return;
    if (a >= 4) { spin(a - 4); autoStep(); }
    else G.path = [a];
  }

  DD.Game = {
    start: start, update: update, draw: draw, setView: setView,
    dirInput: dirInput, holdInput: holdInput, release: release, tap: tap, action: action, toggleOverview: toggleOverview,
    get: function () { return G; },
    clear: function () { G = null; },
    setPaused: function (p) { if (G) { G.paused = !!p; if (p) { G.heldDir = -1; DD.Audio.tension(0); } } },
    hearts: function () { return G ? G.hearts : 0; },
    autoplay: function (on, marble) { autoplay = !!on; autoQueue = []; if (G) { G.autoMarble = !!marble; } },
    setGod: function (on) { if (G) G.god = !!on; }
  };
})();
