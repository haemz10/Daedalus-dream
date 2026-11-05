/* Daedalus Dream — drawing primitives (characters, items, bars). Everything is drawn with canvas paths;
 * there are no image files. Functions draw in whatever units the current transform uses.
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  var TAU = Math.PI * 2;

  var C = {
    bg0: '#070516', bg1: '#140e33', bg2: '#251846',
    yellow: '#ffd23f', yellowDark: '#b98300', yellowLight: '#fff2a6', yellowDeep: '#8a6100',
    pink: '#ff6fae', pinkDark: '#b23a76', cyan: '#43d9ee', cyanDark: '#1d8c9e',
    rust: '#c47a2c', rustDark: '#6e3f12', rustLight: '#e9a75a',
    shard: '#dff3ff', shardGlow: '#8fd3ff', marble: '#ffc928',
    gown: '#ece4ff', gownShade: '#b9a9ef', hair: '#3a2232', skin: '#ffe1cc', blush: '#ff9fb2', ribbon: '#ffd23f',
    suit: '#110c1b', suitEdge: '#2c2240', face: '#ece3f1', hatBand: '#d9a400',
    balloon: '#ff4f6d', balloonDark: '#b0213e', hand: '#e6dfee', handShade: '#a99fb8',
    portalA: '#b78cff', portalB: '#5ff2c1', ink: '#120b1f', lock: '#5b4a7a'
  };

  var sprites = {};
  function canvas(w, h) {
    var c = (typeof OffscreenCanvas !== 'undefined' && !globalThis.document) ? new OffscreenCanvas(w, h) : globalThis.document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function init() {
    // Joint ball
    var j = canvas(64, 64), g = j.getContext('2d');
    var rg = g.createRadialGradient(25, 23, 3, 32, 32, 30);
    rg.addColorStop(0, '#fffbe0'); rg.addColorStop(0.35, C.yellow); rg.addColorStop(0.85, C.yellowDark); rg.addColorStop(1, C.yellowDeep);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(35, 37, 27, 0, TAU); g.fill();
    g.fillStyle = rg; g.beginPath(); g.arc(32, 32, 28, 0, TAU); g.fill();
    sprites.joint = j;
    // Soft disc (used for light and glows)
    var s = canvas(128, 128); g = s.getContext('2d');
    rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    rg.addColorStop(0.75, 'rgba(255,255,255,0.28)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    sprites.soft = s;
    // Lantern light: fully clear in the middle, soft edge
    var l = canvas(128, 128); g = l.getContext('2d');
    rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.6, 'rgba(255,255,255,1)');
    rg.addColorStop(0.85, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    sprites.light = l;
  }
  var glowCache = {};
  function glow(color) {
    if (glowCache[color]) return glowCache[color];
    var c = canvas(64, 64), g = c.getContext('2d');
    var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, color); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    glowCache[color] = c;
    return c;
  }
  function drawGlow(ctx, x, y, r, color, alpha) {
    var a = ctx.globalAlpha;
    ctx.globalAlpha = a * (alpha == null ? 1 : alpha);
    ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = a;
  }

  // ---------- bars ----------
  // Draws a tube from (x1,y1) to (x2,y2): dark underside, body, highlight.
  function tube(ctx, x1, y1, x2, y2, w, body, dark, light) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = dark; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1 + w * 0.18); ctx.lineTo(x2, y2 + w * 0.18); ctx.stroke();
    ctx.strokeStyle = body; ctx.lineWidth = w * 0.86;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    if (light) {
      ctx.strokeStyle = light; ctx.lineWidth = w * 0.26;
      ctx.beginPath(); ctx.moveTo(x1, y1 - w * 0.2); ctx.lineTo(x2, y2 - w * 0.2); ctx.stroke();
    }
  }

  // ---------- the girl ----------
  // (x,y) = her feet. h = height. o = { face: 0..3, walk: phase or -1, t, hurt, lantern: bool, blink }
  function girl(ctx, x, y, h, o) {
    o = o || {};
    var face = o.face == null ? 2 : o.face;
    var walking = o.walk != null && o.walk >= 0;
    var bob = walking ? Math.abs(Math.sin(o.walk)) * 0.035 : Math.sin((o.t || 0) * 2.2) * 0.008;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(h, h);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 0.26, 0.07, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -bob);
    if (face === 3) ctx.scale(-1, 1);
    var side = face === 1 || face === 3;
    // legs
    var sw = walking ? Math.sin(o.walk) * 0.06 : 0;
    ctx.strokeStyle = '#4a3550'; ctx.lineWidth = 0.055; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.07, -0.2); ctx.lineTo(-0.07 + (side ? sw : 0), -0.02 - (side ? 0 : Math.max(0, sw)));
    ctx.moveTo(0.07, -0.2); ctx.lineTo(0.07 - (side ? sw : 0), -0.02 - (side ? 0 : Math.max(0, -sw)));
    ctx.stroke();
    // nightgown
    ctx.fillStyle = C.gown;
    ctx.beginPath();
    ctx.moveTo(-0.11, -0.6);
    ctx.quadraticCurveTo(-0.15, -0.42, -0.26, -0.17);
    ctx.quadraticCurveTo(0, -0.1, 0.26, -0.17);
    ctx.quadraticCurveTo(0.15, -0.42, 0.11, -0.6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.gownShade;
    ctx.beginPath();
    ctx.moveTo(0.06, -0.58); ctx.quadraticCurveTo(0.14, -0.4, 0.26, -0.17);
    ctx.quadraticCurveTo(0.15, -0.135, 0.08, -0.13); ctx.quadraticCurveTo(0.1, -0.4, 0.06, -0.58);
    ctx.fill();
    // little stars on the gown
    ctx.fillStyle = 'rgba(255,210,63,0.75)';
    [[-0.09, -0.36], [0.04, -0.27], [-0.13, -0.22], [0.12, -0.42]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 0.014, 0, TAU); ctx.fill();
    });
    // arms
    ctx.strokeStyle = C.skin; ctx.lineWidth = 0.05;
    var armSwing = walking ? Math.sin(o.walk) * 0.05 : 0;
    ctx.beginPath();
    ctx.moveTo(-0.11, -0.55); ctx.lineTo(-0.17 - armSwing * 0.3, -0.36 + armSwing);
    ctx.moveTo(0.11, -0.55); ctx.lineTo(0.19, -0.38);
    ctx.stroke();
    // lantern in the right hand
    if (o.lantern !== false) {
      var lx = 0.21, ly = -0.33 + Math.sin((o.t || 0) * 3) * 0.006;
      drawGlow(ctx, lx, ly, 0.22, 'rgba(255,226,140,0.55)');
      ctx.strokeStyle = '#7a5a1a'; ctx.lineWidth = 0.015;
      ctx.beginPath(); ctx.moveTo(0.19, -0.38); ctx.lineTo(lx, ly - 0.05); ctx.stroke();
      ctx.fillStyle = '#fff1b0';
      ctx.beginPath(); ctx.ellipse(lx, ly, 0.045, 0.055, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a5a1a'; ctx.fillRect(lx - 0.035, ly - 0.065, 0.07, 0.018); ctx.fillRect(lx - 0.03, ly + 0.048, 0.06, 0.015);
    }
    // head
    var hy = -0.76;
    if (face !== 0) {
      // pigtails (behind)
      ctx.fillStyle = C.hair;
      if (!side) {
        ctx.beginPath(); ctx.arc(-0.19, hy + 0.04, 0.07, 0, TAU); ctx.arc(0.19, hy + 0.04, 0.07, 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(-0.16, hy + 0.05, 0.075, 0, TAU); ctx.fill();
      }
    }
    ctx.fillStyle = C.skin;
    ctx.beginPath(); ctx.arc(0, hy, 0.165, 0, TAU); ctx.fill();
    ctx.fillStyle = C.hair;
    if (face === 0) {
      ctx.beginPath(); ctx.arc(0, hy, 0.172, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(-0.19, hy + 0.03, 0.075, 0, TAU); ctx.arc(0.19, hy + 0.03, 0.075, 0, TAU); ctx.fill();
      ribbon(ctx, -0.15, hy - 0.04); ribbon(ctx, 0.15, hy - 0.04);
    } else if (side) {
      ctx.beginPath();
      ctx.arc(0, hy, 0.172, Math.PI * 0.9, Math.PI * 2.05);
      ctx.quadraticCurveTo(0.05, hy - 0.05, -0.02, hy - 0.02);
      ctx.quadraticCurveTo(-0.1, hy + 0.12, -0.165, hy + 0.06);
      ctx.fill();
      ribbon(ctx, -0.13, hy - 0.05);
      eye(ctx, 0.08, hy + 0.02, o);
      ctx.fillStyle = C.blush; ctx.globalAlpha *= 0.55;
      ctx.beginPath(); ctx.arc(0.07, hy + 0.08, 0.03, 0, TAU); ctx.fill();
      ctx.globalAlpha /= 0.55;
    } else {
      ctx.beginPath();
      ctx.arc(0, hy, 0.172, Math.PI, TAU);
      ctx.quadraticCurveTo(0.1, hy - 0.06, 0.04, hy - 0.03);
      ctx.quadraticCurveTo(0, hy - 0.07, -0.05, hy - 0.03);
      ctx.quadraticCurveTo(-0.11, hy - 0.06, -0.172, hy);
      ctx.fill();
      ribbon(ctx, -0.16, hy - 0.05); ribbon(ctx, 0.16, hy - 0.05);
      eye(ctx, -0.06, hy + 0.025, o); eye(ctx, 0.06, hy + 0.025, o);
      ctx.fillStyle = C.blush; ctx.globalAlpha *= 0.5;
      ctx.beginPath(); ctx.arc(-0.1, hy + 0.08, 0.03, 0, TAU); ctx.arc(0.1, hy + 0.08, 0.03, 0, TAU); ctx.fill();
      ctx.globalAlpha /= 0.5;
      ctx.strokeStyle = '#a0546a'; ctx.lineWidth = 0.012;
      ctx.beginPath();
      if (o.scared) ctx.arc(0, hy + 0.1, 0.018, 0, TAU);
      else ctx.arc(0, hy + 0.075, 0.025, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }
  function eye(ctx, x, y, o) {
    ctx.fillStyle = '#2a1a2a';
    var blink = o.blink || ((o.t || 0) % 3.7 < 0.12);
    if (blink || o.sleep) {
      ctx.strokeStyle = '#2a1a2a'; ctx.lineWidth = 0.012;
      ctx.beginPath(); ctx.arc(x, y - 0.005, 0.02, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(x, y, 0.018, 0.026, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + 0.006, y - 0.01, 0.006, 0, TAU); ctx.fill();
    }
  }
  function ribbon(ctx, x, y) {
    ctx.fillStyle = C.ribbon;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x - 0.05, y - 0.035); ctx.lineTo(x - 0.05, y + 0.035); ctx.closePath();
    ctx.moveTo(x, y); ctx.lineTo(x + 0.05, y - 0.035); ctx.lineTo(x + 0.05, y + 0.035); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0a800'; ctx.beginPath(); ctx.arc(x, y, 0.016, 0, TAU); ctx.fill();
    ctx.fillStyle = C.hair;
  }

  // ---------- Mr. Longlegs ----------
  // (x,y) = between his feet. H = full height to the top of his hat.
  // o = { t, pose: 'stand'|'invite'|'reach'|'bow', smile: 0..1, eyes: 'closed'|'open'|'wide', tilt, lean, old, alpha }
  function longlegs(ctx, x, y, H, o) {
    o = o || {};
    var t = o.t || 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    var u = H;
    var old = !!o.old;
    var sway = Math.sin(t * 0.9) * 0.006 * u;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 0.09 * u, 0.018 * u, 0, 0, TAU); ctx.fill();
    var hipY = (old ? -0.42 : -0.55) * u, shY = (old ? -0.66 : -0.82) * u;
    var lean = (o.lean || 0) * 0.12 * u;
    // legs
    ctx.strokeStyle = C.suit; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 0.022 * u;
    ctx.beginPath();
    ctx.moveTo(-0.025 * u, hipY); ctx.lineTo(-0.04 * u, hipY * 0.48); ctx.lineTo(-0.035 * u, -0.01 * u);
    ctx.moveTo(0.025 * u, hipY); ctx.lineTo(0.042 * u, hipY * 0.5); ctx.lineTo(0.038 * u, -0.01 * u);
    ctx.stroke();
    ctx.fillStyle = C.suit;
    ctx.beginPath();
    ctx.ellipse(-0.05 * u, -0.006 * u, 0.03 * u, 0.012 * u, 0, 0, TAU);
    ctx.ellipse(0.054 * u, -0.006 * u, 0.03 * u, 0.012 * u, 0, 0, TAU);
    ctx.fill();
    // torso (leans toward +x when lean > 0)
    var sx = sway + lean;
    ctx.beginPath();
    ctx.moveTo(-0.045 * u, hipY + 0.02 * u);
    ctx.lineTo(-0.07 * u + sx, shY);
    ctx.quadraticCurveTo(sx, shY - 0.025 * u, 0.07 * u + sx, shY);
    ctx.lineTo(0.045 * u, hipY + 0.02 * u);
    ctx.closePath(); ctx.fill();
    // coat tails
    ctx.beginPath();
    ctx.moveTo(-0.045 * u, hipY); ctx.lineTo(-0.06 * u, hipY + 0.1 * u); ctx.lineTo(-0.015 * u, hipY + 0.02 * u);
    ctx.moveTo(0.045 * u, hipY); ctx.lineTo(0.06 * u, hipY + 0.1 * u); ctx.lineTo(0.015 * u, hipY + 0.02 * u);
    ctx.fill();
    ctx.strokeStyle = C.suitEdge; ctx.lineWidth = 0.004 * u;
    ctx.beginPath(); ctx.moveTo(sx * 0.6, shY + 0.01 * u); ctx.lineTo(-0.012 * u + sx * 0.3, hipY + 0.06 * u);
    ctx.moveTo(sx * 0.6, shY + 0.01 * u); ctx.lineTo(0.012 * u + sx * 0.3, hipY + 0.06 * u); ctx.stroke();
    // arms
    var pose = o.pose || 'stand';
    var la = { x: -0.07 * u + sx, y: shY + 0.01 * u }, ra = { x: 0.07 * u + sx, y: shY + 0.01 * u };
    var lh, rh, le, re;
    var wob = Math.sin(t * 1.3) * 0.006 * u;
    le = { x: la.x - 0.03 * u, y: shY + 0.17 * u };
    lh = { x: la.x - 0.035 * u + wob, y: shY + 0.4 * u };
    if (pose === 'invite') {
      re = { x: ra.x + 0.1 * u, y: shY + 0.08 * u };
      rh = { x: ra.x + 0.22 * u, y: shY + 0.14 * u + wob };
    } else if (pose === 'reach') {
      re = { x: ra.x + 0.1 * u, y: shY + 0.1 * u };
      rh = { x: ra.x + 0.25 * u + wob, y: shY + 0.24 * u };
    } else if (pose === 'hat') {
      re = { x: ra.x + 0.06 * u, y: shY - 0.06 * u };
      rh = { x: ra.x + 0.1 * u, y: shY + 0.06 * u };
    } else {
      re = { x: ra.x + 0.03 * u, y: shY + 0.17 * u };
      rh = { x: ra.x + 0.035 * u - wob, y: shY + 0.4 * u };
    }
    ctx.strokeStyle = C.suit; ctx.lineWidth = 0.02 * u;
    ctx.beginPath();
    ctx.moveTo(la.x, la.y); ctx.lineTo(le.x, le.y); ctx.lineTo(lh.x, lh.y);
    ctx.moveTo(ra.x, ra.y); ctx.lineTo(re.x, re.y); ctx.lineTo(rh.x, rh.y);
    ctx.stroke();
    handFront(ctx, lh.x, lh.y, 0.035 * u, Math.atan2(lh.y - le.y, lh.x - le.x));
    handFront(ctx, rh.x, rh.y, 0.035 * u, Math.atan2(rh.y - re.y, rh.x - re.x));
    // neck + head
    var headY = (old ? -0.73 : -0.9) * u;
    var tilt = (o.tilt || 0) + Math.sin(t * 0.7) * 0.03;
    ctx.save();
    ctx.translate(sx * 1.1, shY);
    ctx.rotate(tilt);
    ctx.translate(0, headY - shY);
    ctx.strokeStyle = C.face; ctx.lineWidth = 0.014 * u;
    ctx.beginPath(); ctx.moveTo(0, 0.03 * u); ctx.lineTo(0, 0.07 * u); ctx.stroke();
    ctx.fillStyle = C.face;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.042 * u, 0.055 * u, 0, 0, TAU); ctx.fill();
    // face
    var eyes = o.eyes || 'closed';
    ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 0.004 * u;
    if (eyes === 'closed') {
      ctx.beginPath();
      ctx.arc(-0.016 * u, -0.004 * u, 0.008 * u, Math.PI * 1.1, Math.PI * 1.9);
      ctx.moveTo(0.024 * u, -0.004 * u);
      ctx.arc(0.016 * u, -0.004 * u, 0.008 * u, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      var er = eyes === 'wide' ? 0.007 * u : 0.0035 * u;
      ctx.beginPath(); ctx.arc(-0.016 * u, -0.006 * u, er, 0, TAU); ctx.arc(0.016 * u, -0.006 * u, er, 0, TAU); ctx.fill();
      if (eyes === 'wide') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-0.016 * u, -0.006 * u, er * 0.35, 0, TAU); ctx.arc(0.016 * u, -0.006 * u, er * 0.35, 0, TAU); ctx.fill();
        ctx.fillStyle = C.ink;
      }
    }
    var sm = o.smile == null ? 0.4 : o.smile;
    var mw = (0.018 + sm * 0.022) * u;
    ctx.beginPath();
    ctx.moveTo(-mw, 0.016 * u);
    ctx.quadraticCurveTo(0, (0.03 + sm * 0.03) * u, mw, 0.016 * u);
    ctx.quadraticCurveTo(0, (0.024 + sm * 0.012) * u, -mw, 0.016 * u);
    ctx.fill();
    if (sm > 0.75) {
      // a row of tiny teeth when the smile gets too wide
      ctx.fillStyle = '#f6f0f8';
      for (var i = -2; i <= 2; i++) ctx.fillRect(i * mw * 0.32 - 0.002 * u, 0.019 * u, 0.004 * u, 0.004 * u);
    }
    // hat
    if (!old) {
      ctx.fillStyle = C.suit;
      ctx.fillRect(-0.068 * u, -0.05 * u, 0.136 * u, 0.012 * u);
      ctx.fillRect(-0.04 * u, -0.17 * u, 0.08 * u, 0.125 * u);
      ctx.fillStyle = C.hatBand;
      ctx.fillRect(-0.04 * u, -0.07 * u, 0.08 * u, 0.012 * u);
    } else {
      ctx.fillStyle = '#e8e4ee';
      ctx.beginPath(); ctx.arc(-0.04 * u, -0.02 * u, 0.016 * u, 0, TAU); ctx.arc(0.04 * u, -0.02 * u, 0.016 * u, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }
  // Long-fingered hand seen from the front (cutscenes).
  function handFront(ctx, x, y, s, ang) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang - Math.PI / 2);
    ctx.fillStyle = C.hand;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.45, s * 0.55, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.hand; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.18;
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var fx = (i - 1.5) * s * 0.22;
      ctx.moveTo(fx, s * 0.3); ctx.lineTo(fx * 1.25, s * (1.35 + (i === 1 || i === 2 ? 0.2 : 0)));
    }
    ctx.stroke();
    ctx.restore();
  }

  // Grabbing hand seen from above (gameplay). p = 0 (high, small) .. 1 (on the ground). s = cell size units.
  function handTop(ctx, x, y, s, p, open) {
    var k = 0.75 + 0.45 * (1 - p);
    ctx.save();
    ctx.translate(x, y - (1 - p) * 0.6 * s);
    ctx.scale(k * s, k * s);
    // arm going up off the screen
    ctx.fillStyle = C.suit;
    ctx.beginPath(); ctx.moveTo(-0.14, -0.35); ctx.lineTo(-0.11, -30); ctx.lineTo(0.11, -30); ctx.lineTo(0.14, -0.35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9cfe4';
    ctx.fillRect(-0.15, -0.42, 0.3, 0.08);
    ctx.fillStyle = C.hand;
    ctx.beginPath(); ctx.ellipse(0, -0.12, 0.2, 0.24, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.hand; ctx.lineCap = 'round'; ctx.lineWidth = 0.075;
    var spread = open == null ? 1 : open;
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      var a = (i - 1.5) * (0.22 + 0.12 * spread);
      ctx.moveTo(Math.sin(a) * 0.12, 0.05);
      ctx.lineTo(Math.sin(a) * (0.5 + 0.1 * spread), 0.05 + Math.cos(a) * (0.42 + 0.1 * (i === 1 || i === 2 ? 1 : 0)));
    }
    ctx.moveTo(0.17, -0.12); ctx.lineTo(0.36, 0.04 + 0.05 * spread);
    ctx.stroke();
    ctx.strokeStyle = C.handShade; ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (i = 0; i < 4; i++) {
      var a2 = (i - 1.5) * (0.22 + 0.12 * spread);
      ctx.moveTo(Math.sin(a2) * 0.3, 0.05 + Math.cos(a2) * 0.2);
      ctx.lineTo(Math.sin(a2) * 0.34, 0.05 + Math.cos(a2) * 0.24);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---------- items ----------
  function star4(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = rot + i * Math.PI / 4;
      var rr = i % 2 === 0 ? r : r * 0.32;
      var px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  function shard(ctx, x, y, r, t) {
    var bob = Math.sin(t * 2.4 + x * 1.7) * r * 0.25;
    drawGlow(ctx, x, y + bob, r * 3.2, 'rgba(143,211,255,0.55)');
    ctx.fillStyle = C.shard;
    star4(ctx, x, y + bob, r * (1 + Math.sin(t * 5 + y) * 0.08), t * 0.6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    star4(ctx, x, y + bob, r * 0.45, -t * 0.9);
    ctx.fill();
  }
  function marble(ctx, x, y, r, t) {
    var bob = Math.sin(t * 2 + x) * r * 0.2;
    drawGlow(ctx, x, y + bob, r * 3, 'rgba(255,201,40,0.5)');
    var g = ctx.createRadialGradient(x - r * 0.35, y + bob - r * 0.35, r * 0.1, x, y + bob, r);
    g.addColorStop(0, '#fff7cf'); g.addColorStop(0.45, C.marble); g.addColorStop(1, '#a86b00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y + bob, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = r * 0.15;
    ctx.beginPath(); ctx.arc(x, y + bob, r * 0.6, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  }
  function key(ctx, x, y, s, t) {
    var bob = Math.sin(t * 2.6) * s * 0.06;
    drawGlow(ctx, x, y + bob, s * 0.6, 'rgba(255,220,120,0.5)');
    ctx.save();
    ctx.translate(x, y + bob); ctx.rotate(-0.7 + Math.sin(t * 1.4) * 0.15);
    ctx.strokeStyle = '#ffcf3a'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-s * 0.16, 0, s * 0.09, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.07, 0); ctx.lineTo(s * 0.22, 0);
    ctx.moveTo(s * 0.12, 0); ctx.lineTo(s * 0.12, s * 0.08);
    ctx.moveTo(s * 0.2, 0); ctx.lineTo(s * 0.2, s * 0.1);
    ctx.stroke();
    ctx.restore();
  }
  function bellIcon(ctx, x, y, s, sw, t, ring) {
    var col = sw ? C.cyan : C.pink;
    drawGlow(ctx, x, y, s * 0.55, sw ? 'rgba(67,217,238,0.55)' : 'rgba(255,111,174,0.55)');
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.arc(x, y, s * 0.26, 0, TAU); ctx.stroke();
    var sway = Math.sin(t * 18) * (ring || 0) * 0.5;
    ctx.save(); ctx.translate(x, y - s * 0.1); ctx.rotate(sway);
    ctx.fillStyle = '#ffdf6b';
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.16);
    ctx.quadraticCurveTo(-s * 0.13, -s * 0.06, 0, -s * 0.07);
    ctx.quadraticCurveTo(s * 0.13, -s * 0.06, s * 0.15, s * 0.16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.yellowDark;
    ctx.fillRect(-s * 0.17, s * 0.15, s * 0.34, s * 0.04);
    ctx.beginPath(); ctx.arc(0, s * 0.22, s * 0.035, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function portal(ctx, x, y, s, t, kind, dim) {
    var col = kind === 'B' ? C.portalB : C.portalA;
    drawGlow(ctx, x, y, s * 0.7, kind === 'B' ? 'rgba(95,242,193,0.5)' : 'rgba(183,140,255,0.5)', dim ? 0.5 : 1);
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      ctx.lineWidth = s * (0.05 - i * 0.012);
      ctx.globalAlpha = 0.9 - i * 0.2;
      ctx.beginPath();
      var r = s * (0.3 - i * 0.08);
      var a0 = t * (2 + i) + i * 2;
      ctx.arc(0, 0, r, a0, a0 + Math.PI * 1.3);
      ctx.stroke();
    }
    ctx.restore();
  }
  function balloon(ctx, x, y, s, t, hit) {
    var bob = Math.sin(t * 2.1 + x * 3) * s * 0.06;
    var by = y - s * 0.32 + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.12, s * 0.2, s * 0.06, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(240,230,255,0.7)'; ctx.lineWidth = s * 0.015;
    ctx.beginPath(); ctx.moveTo(x, by + s * 0.28);
    ctx.quadraticCurveTo(x + Math.sin(t * 3) * s * 0.08, y, x, y + s * 0.1); ctx.stroke();
    var g = ctx.createRadialGradient(x - s * 0.09, by - s * 0.1, s * 0.03, x, by, s * 0.3);
    g.addColorStop(0, '#ffb3c1'); g.addColorStop(0.5, C.balloon); g.addColorStop(1, C.balloonDark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, by, s * 0.25, s * 0.29, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.balloonDark;
    ctx.beginPath(); ctx.moveTo(x, by + s * 0.27); ctx.lineTo(x - s * 0.04, by + s * 0.33); ctx.lineTo(x + s * 0.04, by + s * 0.33); ctx.fill();
    // face
    ctx.fillStyle = '#fff3f6';
    ctx.beginPath(); ctx.arc(x - s * 0.08, by - s * 0.04, s * 0.03, 0, TAU); ctx.arc(x + s * 0.08, by - s * 0.04, s * 0.03, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a0a12';
    ctx.beginPath(); ctx.arc(x - s * 0.08, by - s * 0.035, s * 0.016, 0, TAU); ctx.arc(x + s * 0.08, by - s * 0.035, s * 0.016, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff3f6'; ctx.lineWidth = s * 0.022; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, by + s * 0.02, s * (hit ? 0.06 : 0.13), 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }
  function padlock(ctx, x, y, s, open) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#d8d0ea'; ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.arc(0, -s * 0.08 - open * s * 0.1, s * 0.09, Math.PI, TAU); ctx.stroke();
    ctx.fillStyle = C.lock;
    ctx.fillRect(-s * 0.14, -s * 0.09, s * 0.28, s * 0.22);
    ctx.fillStyle = C.yellow;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.035, 0, TAU); ctx.fill();
    ctx.fillRect(-s * 0.012, 0, s * 0.024, s * 0.07);
    ctx.restore();
  }

  DD.Render = {
    C: C, init: init, sprites: sprites, glow: glow, drawGlow: drawGlow, tube: tube,
    girl: girl, longlegs: longlegs, handTop: handTop, handFront: handFront,
    shard: shard, marble: marble, key: key, bellIcon: bellIcon, portal: portal, balloon: balloon, padlock: padlock, star4: star4
  };
})();
