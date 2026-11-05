/* Daedalus Dream — progress and settings, kept in this browser only. Survives missing or broken storage. */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  var KEY = 'daedalus-dream/v2';
  var OLD_KEY = 'daedalus-dream/v1'; // 15-stage version: settings and story flags carry over, stage records do not

  function defaults() {
    var reduce = false;
    try { reduce = !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* ignore */ }
    return {
      v: 1,
      lang: 'en',
      music: 0.6, sfx: 0.8, vibrate: true, dpad: false, reduceMotion: reduce, muted: false,
      seenPrologue: false, refusals: 0, entered: false,
      stages: {},            // id -> { clear, marble, fast, best }
      seenHints: {},
      interludes: {},        // '1', '2'
      storyCleared: false, trueEnding: false,
      endlessBest: 0, endlessBestScore: 0, endlessIntro: false
    };
  }

  function sanitize(d) {
    var base = defaults();
    if (!d || typeof d !== 'object') return base;
    var out = base;
    ['music', 'sfx'].forEach(function (k) { if (typeof d[k] === 'number' && isFinite(d[k])) out[k] = DD.clamp(d[k], 0, 1); });
    ['vibrate', 'dpad', 'reduceMotion', 'muted', 'seenPrologue', 'entered', 'storyCleared', 'trueEnding', 'endlessIntro'].forEach(function (k) {
      if (typeof d[k] === 'boolean') out[k] = d[k];
    });
    if (typeof d.lang === 'string' && DD.I18N && DD.I18N[d.lang]) out.lang = d.lang;
    if (typeof d.refusals === 'number' && isFinite(d.refusals)) out.refusals = Math.max(0, Math.min(9999, d.refusals | 0));
    if (typeof d.endlessBest === 'number' && isFinite(d.endlessBest)) out.endlessBest = Math.max(0, d.endlessBest | 0);
    if (typeof d.endlessBestScore === 'number' && isFinite(d.endlessBestScore)) out.endlessBestScore = Math.max(0, Math.floor(d.endlessBestScore));
    if (d.stages && typeof d.stages === 'object') {
      Object.keys(d.stages).forEach(function (id) {
        var s = d.stages[id];
        if (!s || typeof s !== 'object' || !/^[1-3]-([1-9]|10)$/.test(id)) return;
        var num = function (v) { return typeof v === 'number' && isFinite(v) ? v : 0; };
        out.stages[id] = { clear: !!s.clear, marble: !!s.marble, unhurt: !!s.unhurt, best: num(s.best), score: Math.max(0, Math.floor(num(s.score))) };
      });
    }
    if (d.seenHints && typeof d.seenHints === 'object') Object.keys(d.seenHints).forEach(function (k) { out.seenHints[k] = true; });
    if (d.interludes && typeof d.interludes === 'object') Object.keys(d.interludes).forEach(function (k) { out.interludes[k] = true; });
    return out;
  }

  var Save = {
    data: defaults(),
    load: function () {
      var raw = DD.store.get(KEY), parsed = null;
      if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
      if (!parsed) {
        var old = DD.store.get(OLD_KEY);
        if (old) {
          try {
            parsed = JSON.parse(old);
            parsed.stages = {}; parsed.interludes = {}; parsed.storyCleared = false; parsed.trueEnding = false;
          } catch (e2) { parsed = null; }
        }
      }
      Save.data = sanitize(parsed);
      return Save.data;
    },
    save: function () { DD.store.set(KEY, JSON.stringify(Save.data)); },
    reset: function () {
      var keep = { lang: Save.data.lang, music: Save.data.music, sfx: Save.data.sfx, vibrate: Save.data.vibrate, dpad: Save.data.dpad, reduceMotion: Save.data.reduceMotion };
      Save.data = Object.assign(defaults(), keep);
      Save.save();
    },
    stage: function (id) { return Save.data.stages[id] || { clear: false, marble: false, unhurt: false, best: 0, score: 0 }; },
    record: function (id, r) {
      var s = Save.stage(id);
      var out = {
        clear: true,
        marble: s.marble || !!r.marble,
        unhurt: s.unhurt || r.hits === 0,
        best: s.best ? Math.min(s.best, r.time) : r.time,
        score: Math.max(s.score || 0, r.score || 0)
      };
      Save.data.stages[id] = out;
      Save.save();
      return { before: s, after: out };
    },
    stars: function (id) { var s = Save.stage(id); return (s.clear ? 1 : 0) + (s.marble ? 1 : 0) + (s.unhurt ? 1 : 0); },
    totals: function () {
      var stars = 0, marbles = 0;
      (DD.STAGES || []).forEach(function (st) { stars += Save.stars(st.id); if (Save.stage(st.id).marble) marbles++; });
      return { stars: stars, marbles: marbles, maxStars: (DD.STAGES || []).length * 3, maxMarbles: (DD.STAGES || []).length };
    },
    endlessOpen: function () { return Save.data.storyCleared || Save.stage('1-10').clear; },
    unlocked: function (id) {
      var ids = (DD.STAGES || []).map(function (s) { return s.id; });
      var i = ids.indexOf(id);
      return i === 0 || (i > 0 && Save.stage(ids[i - 1]).clear);
    },
    // for the hot-update hook in the artifact viewer
    snapshot: function () { return JSON.parse(JSON.stringify(Save.data)); },
    restore: function (d) { Save.data = sanitize(d); }
  };
  DD.Save = Save;
})();
