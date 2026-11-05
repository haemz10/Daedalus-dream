/* Daedalus Dream — cutscene painter (title, the dream, the bedroom, interludes, the ending).
 * Draws in CSS pixels. The director sets a scene and tweens its parameters.
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  var R = DD.Render, C = R.C, TAU = Math.PI * 2;

  var S = {
    name: 'black', t: 0, p: {}, tweens: [],
    dust: null
  };

  function set(name, params) {
    S.name = name; S.t = 0; S.tweens = [];
    S.p = Object.assign({}, defaults[name] || {}, params || {});
  }
  // Tween scene parameters. Returns a promise that resolves when done.
  function tween(to, dur, ease) {
    return new Promise(function (resolve) {
      var from = {};
      Object.keys(to).forEach(function (k) { from[k] = S.p[k] == null ? 0 : S.p[k]; });
      S.tweens.push({ from: from, to: to, dur: Math.max(0.001, dur), t: 0, ease: ease || DD.ease.inOutSine, done: resolve });
    });
  }
  function finishTweens() {
    S.tweens.forEach(function (tw) { Object.assign(S.p, tw.to); tw.done(); });
    S.tweens = [];
  }
  function update(dt) {
    S.t += dt;
    for (var i = S.tweens.length - 1; i >= 0; i--) {
      var tw = S.tweens[i];
      tw.t += dt;
      var k = Math.min(1, tw.t / tw.dur), e = tw.ease(k);
      for (var key in tw.to) S.p[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e;
      if (k >= 1) { S.tweens.splice(i, 1); tw.done(); }
    }
  }

  var defaults = {
    title: {},
    void: { girl: 1, light: 1, glowFar: 0 },
    gym: { gym: 1, ll: 0, girl: 1, girlX: 0, step: 0, pose: 'stand', eyes: 'closed', smile: 0.35, gate: 0, zoom: 1 },
    bedroom: { loop: 1, morning: 0, marble: 0, flash: 0, dark: 0, eyesClosed: 0 },
    interlude: { face: 0, smile: 0.5, eyes: 'closed' },
    door: { girlX: 0, llAlpha: 1, old: 0, llX: 0, glow: 1, girlAlpha: 1, llPose: 'stand' },
    black: {}
  };

  // ---------- shared atmosphere ----------
  function ensureDust() {
    if (S.dust) return;
    var rng = DD.makeRng(7);
    S.dust = [];
    for (var i = 0; i < 70; i++) S.dust.push({ x: rng(), y: rng(), r: rng() * 1.6 + 0.4, s: rng() * 0.02 + 0.004, ph: rng() * TAU, yel: rng() < 0.25 });
  }
  function sky(ctx, w, h, warm) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, C.bg0); g.addColorStop(0.6, C.bg1); g.addColorStop(1, warm ? '#2b1c35' : C.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function dust(ctx, w, h, t, alpha) {
    ensureDust();
    S.dust.forEach(function (d) {
      var x = ((d.x + Math.sin(t * 0.1 + d.ph) * 0.02) % 1) * w;
      var y = (((d.y - t * d.s) % 1) + 1) % 1 * h;
      var a = (0.35 + 0.35 * Math.sin(t * 1.3 + d.ph)) * (alpha == null ? 1 : alpha);
      ctx.fillStyle = d.yel ? 'rgba(255,224,120,' + a + ')' : 'rgba(210,200,255,' + a + ')';
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, TAU); ctx.fill();
    });
  }
  function vignette(ctx, w, h, strength) {
    var g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.25, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (strength || 0.7) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  // Isometric jungle-gym lattice. cx,cy = front-bottom corner. s = cube size.
  function lattice(ctx, cx, cy, s, nx, ny, nz, alpha, t, opts) {
    opts = opts || {};
    var P = function (x, y, z) { return [cx + (x - y) * s * 0.866, cy - (x + y) * s * 0.5 - z * s]; };
    var edges = [];
    for (var x = 0; x <= nx; x++) for (var y = 0; y <= ny; y++) for (var z = 0; z <= nz; z++) {
      if (x < nx) edges.push([x, y, z, x + 1, y, z]);
      if (y < ny) edges.push([x, y, z, x, y + 1, z]);
      if (z < nz) edges.push([x, y, z, x, y, z + 1]);
    }
    // The entrance: the bottom bar of one front cell is missing.
    var ex = opts.entrance == null ? 1 : opts.entrance;
    edges = edges.filter(function (e) { return !(e[2] === 0 && e[5] === 0 && e[1] === 0 && e[4] === 0 && e[0] === ex && e[3] === ex + 1); });
    edges.sort(function (a, b) { return (b[0] + b[1] + b[3] + b[4]) - (a[0] + a[1] + a[3] + a[4]) || (a[2] + a[5]) - (b[2] + b[5]); });
    var maxD = nx + ny;
    ctx.lineCap = 'round';
    edges.forEach(function (e) {
      var d = (e[0] + e[1] + e[3] + e[4]) / 2;
      var fade = 1 - Math.pow(d / maxD, 0.7) * 0.95;
      // the far top dissolves into the dark: no visible way out
      fade *= 1 - Math.max(0, (e[2] + e[5]) / 2 - nz * 0.5) / nz * 0.5 * (d / maxD);
      var a = P(e[0], e[1], e[2]), b = P(e[3], e[4], e[5]);
      ctx.globalAlpha = alpha * fade * 0.35;
      ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.lineWidth = s * 0.24;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.globalAlpha = alpha * fade;
      R.tube(ctx, a[0], a[1], b[0], b[1], s * 0.09, C.yellow, C.yellowDark, C.yellowLight);
    });
    ctx.globalAlpha = 1;
    return P;
  }

  // ---------- scenes ----------
  function drawTitle(ctx, w, h, t) {
    sky(ctx, w, h);
    dust(ctx, w, h, t);
    var u = Math.min(w, h * 0.8) / 10;
    var wide = w > h * 1.3;
    var gy = h * (wide ? 0.66 : 0.62), cx = wide ? w * 0.8 : w / 2;
    R.drawGlow(ctx, cx, gy - u * 1.5, u * 6, 'rgba(255,200,60,0.22)');
    var P = lattice(ctx, cx, gy, u * 0.62, 4, 4, 3, 0.9, t);
    var lp = P(3.2, -0.8, 0);
    R.longlegs(ctx, lp[0], lp[1], u * 4.1, { t: t, smile: 0.4, flip: true, alpha: 0.45 + 0.1 * Math.sin(t * 0.5) });
    ctx.fillStyle = 'rgba(255,210,63,0.12)';
    ctx.beginPath(); ctx.ellipse(cx, gy + u * 0.3, u * 4, u * 0.6, 0, 0, TAU); ctx.fill();
    vignette(ctx, w, h, 0.75);
  }

  function drawVoid(ctx, w, h, t, p) {
    sky(ctx, w, h);
    dust(ctx, w, h, t, 0.8);
    var u = Math.min(w, h * 0.8) / 10;
    if (p.glowFar > 0) R.drawGlow(ctx, w * 0.5, h * 0.35, u * 3 * p.glowFar, 'rgba(255,210,63,0.6)', p.glowFar);
    var gx = w / 2, gy = h * 0.62 + Math.sin(t * 0.8) * u * 0.1;
    R.drawGlow(ctx, gx, gy - u * 0.8, u * 3.5 * p.light, 'rgba(255,230,160,0.35)');
    if (p.girl > 0) {
      ctx.globalAlpha = p.girl;
      R.girl(ctx, gx, gy, u * 2.1, { t: t, face: p.face == null ? 2 : p.face, walk: p.walk ? t * 6 : -1, scared: p.scared });
      ctx.globalAlpha = 1;
    }
    vignette(ctx, w, h, 0.8);
  }

  function gymLayout(w, h) {
    var landscape = w > h * 1.1;
    if (landscape) {
      var gyL = h * 0.76, sL = Math.min(h * 0.075, w * 0.05);
      return { landscape: true, gy: gyL, s: sL, cx: w * 0.42, girlX0: w * 0.14, llX: w * 0.72, H: Math.min(gyL - 8, h * 0.66) };
    }
    var gy = h * 0.64, s = Math.min(w * 0.1, h * 0.052);
    return { landscape: false, gy: gy, s: s, cx: w * 0.44, girlX0: w * 0.12, llX: w * 0.8, H: Math.min(gy - 8, h * 0.5) };
  }
  function drawGym(ctx, w, h, t, p) {
    sky(ctx, w, h);
    dust(ctx, w, h, t, 0.7);
    var Lo = gymLayout(w, h);
    var s = Lo.s, gy = Lo.gy;
    var z = p.zoom || 1;
    ctx.save();
    ctx.translate(w / 2, gy); ctx.scale(z, z); ctx.translate(-w / 2, -gy);
    // ground glow
    ctx.globalAlpha = p.gym;
    ctx.fillStyle = 'rgba(255,210,63,0.09)';
    ctx.beginPath(); ctx.ellipse(Lo.cx, gy + s * 0.3, s * 5.2, s * 1.1, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    var P = lattice(ctx, Lo.cx, gy, s, 4, 4, 3, p.gym, t, { entrance: 1 });
    // the entrance: a warm opening in the front face
    var e0 = P(1.5, 0, 0.5);
    R.drawGlow(ctx, e0[0], e0[1], s * 1.1, 'rgba(255,240,180,0.55)', p.gym * (0.75 + 0.25 * Math.sin(t * 2)));
    if (p.gate > 0) {
      var a = P(1, 0, 0), b = P(2, 0, 0);
      ctx.globalAlpha = p.gate;
      R.tube(ctx, a[0], a[1], b[0], b[1], s * 0.09, C.yellow, C.yellowDark, C.yellowLight);
      ctx.globalAlpha = 1;
    }
    // the girl walks from the left to the entrance
    var startX = Lo.girlX0, startY = gy + s * 0.9;
    var door = P(1.5, -0.2, 0);
    var gx = DD.lerp(startX, door[0], p.girlX), gyy = DD.lerp(startY, door[1], p.girlX);
    // Mr. Longlegs: a little closer, taller and smilier every time she refuses
    var step = Math.min(p.step || 0, 8);
    var near = Math.min(step, 6) / 6;
    var lx = DD.lerp(Lo.llX, startX + w * 0.28, near * 0.42);
    var ly = gy + s * (0.6 + near * 0.5);
    var H = Math.min(ly - 6, Lo.H * (1 + step * 0.03));
    var girlH = s * 1.7;
    var ahead = p.girlX > 0.02 && p.girlX < 0.98;
    function drawGirl() {
      if (p.girl <= 0) return;
      ctx.globalAlpha = p.girl;
      R.drawGlow(ctx, gx + girlH * 0.2, gyy - girlH * 0.35, girlH * 1.2, 'rgba(255,230,160,0.3)');
      R.girl(ctx, gx, gyy, girlH, { t: t, face: ahead ? 1 : (p.girlFace == null ? 1 : p.girlFace), walk: ahead ? t * 7 : -1, scared: p.scared || step >= 3 });
      ctx.globalAlpha = 1;
    }
    function drawLL() {
      if (p.ll <= 0) return;
      R.longlegs(ctx, lx, ly, H, {
        t: t, pose: p.pose, eyes: step >= 6 ? 'wide' : step >= 3 ? 'open' : p.eyes,
        smile: Math.min(1, p.smile + step * 0.07), tilt: 0.06 + step * 0.025, lean: step >= 4 ? 0.35 : 0, alpha: p.ll, flip: true
      });
    }
    if (ly < gyy) { drawLL(); drawGirl(); } else { drawGirl(); drawLL(); }
    ctx.restore();
    if (step >= 5) {
      ctx.fillStyle = 'rgba(80,40,0,' + Math.min(0.18, (step - 4) * 0.04) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    vignette(ctx, w, h, 0.65 + step * 0.03);
  }

  function drawBedroom(ctx, w, h, t, p) {
    var n = p.loop || 1, m = p.morning || 0;
    var wobble = n >= 5 && !m ? Math.sin(t * 0.6) * 0.008 * Math.min(n - 4, 4) : 0;
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.rotate(wobble); ctx.translate(-w / 2, -h / 2);
    // wall
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, m ? '#f6d9c4' : '#151a3c'); g.addColorStop(1, m ? '#e8b9a6' : '#0b0d24');
    ctx.fillStyle = g; ctx.fillRect(-w, -h, w * 3, h * 3);
    // wallpaper dots
    ctx.fillStyle = m ? 'rgba(255,255,255,0.35)' : 'rgba(150,160,255,0.08)';
    for (var yy = 20; yy < h * 0.72; yy += 46) for (var xx = (yy / 46 % 2) * 23; xx < w; xx += 46) { ctx.beginPath(); ctx.arc(xx, yy, 3, 0, TAU); ctx.fill(); }
    // floor
    ctx.fillStyle = m ? '#c98f6f' : '#090a1c';
    ctx.fillRect(-w, h * 0.74, w * 3, h);
    var landscape = w > h;
    // window
    var wx = landscape ? w * 0.6 : w * 0.52, wy = h * 0.13, ww = landscape ? w * 0.26 : w * 0.38, wh = h * (landscape ? 0.36 : 0.24);
    var sg = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sg.addColorStop(0, m ? '#8fd0ff' : '#060820'); sg.addColorStop(1, m ? '#fff1c2' : '#1d1846');
    ctx.fillStyle = sg; ctx.fillRect(wx, wy, ww, wh);
    if (m) {
      R.drawGlow(ctx, wx + ww * 0.75, wy + wh * 0.3, ww * 0.5, 'rgba(255,240,170,0.9)');
      ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(wx + ww * 0.75, wy + wh * 0.3, ww * 0.09, 0, TAU); ctx.fill();
      // birds
      ctx.strokeStyle = '#4a3b52'; ctx.lineWidth = 1.5;
      for (var bi = 0; bi < 2; bi++) {
        var bx = wx + ((t * 18 + bi * 60) % (ww + 40)) - 20, by = wy + wh * (0.35 + bi * 0.2) + Math.sin(t * 3 + bi) * 4;
        var f = Math.sin(t * 9 + bi) * 3;
        ctx.beginPath(); ctx.moveTo(bx - 6, by - f); ctx.quadraticCurveTo(bx - 3, by - 4, bx, by); ctx.quadraticCurveTo(bx + 3, by - 4, bx + 6, by - f); ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#fff4d6';
      ctx.beginPath(); ctx.arc(wx + ww * 0.3, wy + wh * 0.32, ww * 0.1, 0, TAU); ctx.fill();
      ctx.fillStyle = '#060820';
      ctx.beginPath(); ctx.arc(wx + ww * 0.34, wy + wh * 0.29, ww * 0.09, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (var si = 0; si < 9; si++) { ctx.fillRect(wx + ((si * 37) % ww), wy + ((si * 23) % wh), 1.5, 1.5); }
      if (n >= 6) {
        // someone very tall outside the window
        var sx2 = wx + ww * 0.68, sy2 = wy + wh;
        ctx.save();
        ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
        R.longlegs(ctx, sx2, sy2 + wh * 1.4, wh * 2.6, { t: t, smile: 0.9, eyes: 'open', alpha: 0.85, tilt: 0.2 });
        ctx.restore();
      }
    }
    // window frame + yellow bars
    ctx.strokeStyle = m ? '#fbf3ea' : '#2c2a52'; ctx.lineWidth = 6;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    if (n >= 4 && !m) {
      for (var k = 1; k < 6; k++) R.tube(ctx, wx + ww * k / 6, wy + 2, wx + ww * k / 6, wy + wh - 2, 5, C.yellow, C.yellowDark, C.yellowLight);
    }
    // clock (always 3:33)
    var cxk = landscape ? w * 0.12 : w * 0.16, cyk = h * 0.17, cr = Math.min(w, h) * 0.055;
    ctx.fillStyle = m ? '#fffaf3' : '#d9d4f0'; ctx.beginPath(); ctx.arc(cxk, cyk, cr, 0, TAU); ctx.fill();
    ctx.strokeStyle = m ? '#9b6b55' : '#4b4579'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#2a2140'; ctx.lineCap = 'round';
    var hr = (3 + 33 / 60) / 12 * TAU - Math.PI / 2, mn = 33 / 60 * TAU - Math.PI / 2;
    if (m) { hr = (7 + 10 / 60) / 12 * TAU - Math.PI / 2; mn = 10 / 60 * TAU - Math.PI / 2; }
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cxk, cyk); ctx.lineTo(cxk + Math.cos(hr) * cr * 0.5, cyk + Math.sin(hr) * cr * 0.5); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cxk, cyk); ctx.lineTo(cxk + Math.cos(mn) * cr * 0.78, cyk + Math.sin(mn) * cr * 0.78); ctx.stroke();
    // shelf (+ the little yellow toy)
    var shx = landscape ? w * 0.08 : w * 0.06, shy = h * 0.38, shw = landscape ? w * 0.22 : w * 0.36;
    ctx.fillStyle = m ? '#a86f4f' : '#3a2f5e'; ctx.fillRect(shx, shy, shw, 6);
    ['#7d6bd6', '#e07a9b', '#5bb4c9'].forEach(function (col, i) { ctx.fillStyle = col; ctx.fillRect(shx + 8 + i * 13, shy - 30 + i * 3, 10, 30 - i * 3); });
    if (n >= 3 && !m) lattice(ctx, shx + shw * 0.72, shy - 2, Math.min(w, h) * 0.022, 2, 2, 2, 1, t);
    // bed
    var bx0 = landscape ? w * 0.1 : w * 0.04, bw = landscape ? w * 0.42 : w * 0.7, by0 = h * 0.64, bh = h * 0.12;
    ctx.fillStyle = m ? '#8b5a3c' : '#2b2148';
    ctx.fillRect(bx0, by0 - bh * 0.6, 10, bh * 1.9);
    ctx.fillRect(bx0 + bw - 10, by0, 10, bh * 1.3);
    ctx.fillStyle = m ? '#fff' : '#a9a3cf'; ctx.fillRect(bx0 + 10, by0, bw - 20, bh * 0.35);
    var girlX = bx0 + bw * 0.28, girlY = by0 + bh * 0.25;
    R.drawGlow(ctx, girlX, girlY - bh, bh * 1.6, m ? 'rgba(255,240,200,0.5)' : 'rgba(170,160,255,0.18)');
    R.girl(ctx, girlX, girlY, Math.min(w, h) * 0.28, { t: t, face: 2, lantern: false, sleep: p.eyesClosed > 0.5, scared: !m && n >= 2 });
    if (p.marble > 0) {
      R.marble(ctx, girlX + Math.min(w, h) * 0.06, girlY - Math.min(w, h) * 0.11, Math.min(w, h) * 0.018, t);
      R.drawGlow(ctx, girlX + Math.min(w, h) * 0.06, girlY - Math.min(w, h) * 0.11, Math.min(w, h) * 0.07, 'rgba(255,230,120,0.7)', p.marble);
    }
    // blanket
    ctx.fillStyle = m ? '#b9a7ff' : '#4a3f8a';
    ctx.beginPath();
    ctx.moveTo(bx0 + 8, by0 + bh * 0.2);
    ctx.quadraticCurveTo(bx0 + bw * 0.5, by0 - bh * 0.15, bx0 + bw - 8, by0 + bh * 0.25);
    ctx.lineTo(bx0 + bw - 8, by0 + bh * 1.1); ctx.lineTo(bx0 + 8, by0 + bh * 1.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = m ? 'rgba(255,255,255,0.5)' : 'rgba(255,210,63,0.25)';
    for (var q = 0; q < 6; q++) R.star4(ctx, bx0 + bw * (0.15 + q * 0.14), by0 + bh * 0.65, 5, 0), ctx.fill();
    ctx.restore();
    if (m) {
      ctx.fillStyle = 'rgba(255,230,180,0.15)';
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + ww, wy); ctx.lineTo(w * 0.6, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    }
    if (n >= 5 && !m) { ctx.fillStyle = 'rgba(255,200,40,' + Math.min(0.14, (n - 4) * 0.035) + ')'; ctx.fillRect(0, 0, w, h); }
    if (!m) vignette(ctx, w, h, 0.6);
    if (p.dark > 0) { ctx.fillStyle = 'rgba(3,2,10,' + p.dark + ')'; ctx.fillRect(0, 0, w, h); }
    if (p.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + p.flash + ')'; ctx.fillRect(0, 0, w, h); }
  }

  function drawInterlude(ctx, w, h, t, p) {
    sky(ctx, w, h);
    // top-down bars receding into the dark
    var cell = Math.min(w, h) / 6;
    var ox = (w / 2) % cell, oy = (h * 0.6) % cell;
    ctx.save();
    for (var x = -1; x < w / cell + 1; x++) for (var y = -1; y < h / cell + 1; y++) {
      var px = ox + x * cell, py = oy + y * cell;
      var d = Math.hypot(px - w / 2, py - h * 0.6) / (Math.min(w, h) * 0.55);
      var a = Math.max(0, 1 - d);
      if (a <= 0.02) continue;
      ctx.globalAlpha = a * 0.9;
      R.tube(ctx, px, py, px + cell, py, cell * 0.1, C.yellow, C.yellowDark, C.yellowLight);
      R.tube(ctx, px, py, px, py + cell, cell * 0.1, C.yellow, C.yellowDark, C.yellowLight);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    R.drawGlow(ctx, w / 2, h * 0.6 - cell * 0.3, cell * 1.8, 'rgba(255,230,160,0.4)');
    R.girl(ctx, w / 2, h * 0.6, cell * 0.8, { t: t, face: 0 });
    // the face, peering down from above
    if (p.face > 0) {
      var fw = Math.min(w * 0.9, h * 0.6), fy = DD.lerp(-fw * 0.95, -fw * 0.02, p.face);
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.face * 1.2) * 0.92;
      ctx.translate(w / 2, fy);
      ctx.rotate(Math.sin(t * 0.4) * 0.04);
      ctx.fillStyle = C.face;
      ctx.beginPath(); ctx.ellipse(0, 0, fw * 0.42, fw * 0.55, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineWidth = fw * 0.012;
      if (p.eyes === 'closed') {
        ctx.beginPath(); ctx.arc(-fw * 0.15, fw * 0.12, fw * 0.06, Math.PI * 1.1, Math.PI * 1.9);
        ctx.moveTo(fw * 0.21, fw * 0.12); ctx.arc(fw * 0.15, fw * 0.12, fw * 0.06, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(-fw * 0.15, fw * 0.1, fw * 0.02, 0, TAU); ctx.arc(fw * 0.15, fw * 0.1, fw * 0.02, 0, TAU); ctx.fill();
      }
      var mw = fw * (0.14 + p.smile * 0.16);
      ctx.beginPath(); ctx.moveTo(-mw, fw * 0.3);
      ctx.quadraticCurveTo(0, fw * (0.38 + p.smile * 0.12), mw, fw * 0.3);
      ctx.quadraticCurveTo(0, fw * (0.35 + p.smile * 0.04), -mw, fw * 0.3); ctx.fill();
      ctx.restore();
    }
    dust(ctx, w, h, t, 0.6);
    vignette(ctx, w, h, 0.7);
  }

  function drawDoor(ctx, w, h, t, p) {
    sky(ctx, w, h);
    var u = Math.min(w, h * 0.7) / 10;
    var gy = h * 0.74;
    // a few bars framing the stage
    ctx.globalAlpha = 0.6;
    for (var i = 0; i < 7; i++) {
      var x = w * (i / 6);
      R.tube(ctx, x, gy - u * 9, x, gy, u * 0.14, C.yellow, C.yellowDark, C.yellowLight);
    }
    R.tube(ctx, 0, gy, w, gy, u * 0.14, C.yellow, C.yellowDark, C.yellowLight);
    ctx.globalAlpha = 1;
    // the door of light
    var dx = w / 2, dw = u * 2.2, dh = u * 4.2;
    R.drawGlow(ctx, dx, gy - dh / 2, dh * 1.4 * p.glow, 'rgba(255,248,215,0.75)');
    ctx.fillStyle = 'rgba(255,252,235,' + (0.85 * p.glow) + ')';
    ctx.beginPath();
    ctx.moveTo(dx - dw / 2, gy); ctx.lineTo(dx - dw / 2, gy - dh + dw / 2);
    ctx.arc(dx, gy - dh + dw / 2, dw / 2, Math.PI, 0);
    ctx.lineTo(dx + dw / 2, gy); ctx.closePath(); ctx.fill();
    // rays
    ctx.save(); ctx.globalAlpha = 0.18 * p.glow; ctx.fillStyle = '#fff8dc';
    for (var r = 0; r < 8; r++) {
      var a = -Math.PI / 2 + (r - 3.5) * 0.22 + Math.sin(t * 0.5 + r) * 0.03;
      ctx.beginPath(); ctx.moveTo(dx, gy - dh * 0.55);
      ctx.lineTo(dx + Math.cos(a - 0.05) * h, gy - dh * 0.55 + Math.sin(a - 0.05) * h);
      ctx.lineTo(dx + Math.cos(a + 0.05) * h, gy - dh * 0.55 + Math.sin(a + 0.05) * h); ctx.fill();
    }
    ctx.restore();
    // Mr. Longlegs to the right (or the old man he really is)
    var lx = DD.lerp(dx + u * 3.1, dx, p.llX), lH = p.old > 0.5 ? u * 4.2 : h * 0.62;
    R.longlegs(ctx, lx, gy, lH, { t: t, pose: p.llPose, smile: p.old > 0.5 ? 0.25 : 0.45, eyes: p.old > 0.5 ? 'closed' : 'open', old: p.old > 0.5, alpha: p.llAlpha, flip: true });
    // the girl walks from the left into the light
    var gx = DD.lerp(u * 1.5, dx, p.girlX);
    ctx.globalAlpha = p.girlAlpha;
    R.girl(ctx, gx, gy, u * 1.7, { t: t, face: p.girlX > 0.01 && p.girlX < 0.99 ? 1 : 1, walk: p.walking ? t * 7 : -1 });
    ctx.globalAlpha = 1;
    dust(ctx, w, h, t, 0.8);
    vignette(ctx, w, h, 0.55);
  }

  function draw(ctx, w, h) {
    var t = S.t;
    switch (S.name) {
      case 'title': drawTitle(ctx, w, h, t); break;
      case 'void': drawVoid(ctx, w, h, t, S.p); break;
      case 'gym': drawGym(ctx, w, h, t, S.p); break;
      case 'bedroom': drawBedroom(ctx, w, h, t, S.p); break;
      case 'interlude': drawInterlude(ctx, w, h, t, S.p); break;
      case 'door': drawDoor(ctx, w, h, t, S.p); break;
      default:
        ctx.fillStyle = C.bg0; ctx.fillRect(0, 0, w, h);
        dust(ctx, w, h, t, 0.35);
    }
    if (S.p.fade > 0) { ctx.fillStyle = 'rgba(3,2,10,' + Math.min(1, S.p.fade) + ')'; ctx.fillRect(0, 0, w, h); }
  }

  DD.Scenes = { set: set, tween: tween, finishTweens: finishTweens, update: update, draw: draw, state: S, lattice: lattice };
})();
