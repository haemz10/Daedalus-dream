/* Daedalus Dream — shared helpers. Works in the browser and in Node (tools/tests). */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});

  DD.VERSION = '1.2.0';

  // Directions: 0 = North (up), 1 = East, 2 = South, 3 = West (clockwise).
  DD.DX = [0, 1, 0, -1];
  DD.DY = [-1, 0, 1, 0];
  DD.BIT = [1, 2, 4, 8];
  DD.opp = function (d) { return (d + 2) & 3; };

  DD.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  DD.lerp = function (a, b, t) { return a + (b - a) * t; };
  // Frame-rate independent smoothing toward a target.
  DD.approach = function (cur, target, rate, dt) {
    return cur + (target - cur) * (1 - Math.exp(-rate * dt));
  };
  DD.ease = {
    outCubic: function (t) { t = 1 - t; return 1 - t * t * t; },
    inCubic: function (t) { return t * t * t; },
    inOutSine: function (t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); },
    outBack: function (t) { var c = 1.70158; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; },
    outElastic: function (t) {
      if (t <= 0) return 0; if (t >= 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
    }
  };

  // Small, fast, deterministic PRNG (mulberry32).
  DD.makeRng = function (seed) {
    var a = (seed >>> 0) || 0x9e3779b9;
    var r = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = function (n) { return Math.floor(r() * n); };
    r.range = function (lo, hi) { return lo + r() * (hi - lo); };
    r.chance = function (p) { return r() < p; };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    r.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(r() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    };
    return r;
  };

  DD.hash = function (str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };

  DD.popcount = function (n) {
    var c = 0;
    while (n) { n &= n - 1; c++; }
    return c;
  };

  DD.formatTime = function (s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  };

  // localStorage can be missing or throw (private mode, sandboxed frames).
  DD.store = {
    get: function (k) {
      try { return globalThis.localStorage ? globalThis.localStorage.getItem(k) : null; } catch (e) { return null; }
    },
    set: function (k, v) {
      try { if (globalThis.localStorage) { globalThis.localStorage.setItem(k, v); return true; } } catch (e) { /* ignore */ }
      return false;
    },
    remove: function (k) {
      try { if (globalThis.localStorage) globalThis.localStorage.removeItem(k); } catch (e) { /* ignore */ }
    }
  };

  DD.vibrate = function (pattern) {
    try {
      if (DD.Save && DD.Save.data && !DD.Save.data.vibrate) return;
      if (globalThis.navigator && typeof globalThis.navigator.vibrate === 'function') globalThis.navigator.vibrate(pattern);
    } catch (e) { /* not allowed here */ }
  };

  DD.now = function () {
    return (globalThis.performance && globalThis.performance.now) ? globalThis.performance.now() : Date.now();
  };
})();
