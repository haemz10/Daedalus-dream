/* Daedalus Dream — synthesized sound. No audio files: music box, pads and effects are made with WebAudio.
 * Audio starts only after the first tap (browser rule). Every call is safe when audio is unavailable.
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});

  var ctx = null, master = null, musicBus = null, sfxBus = null, revSend = null, noiseBuf = null;
  var unlocked = false, musicVol = 0.6, sfxVol = 0.8;
  var tensionOsc = null, tensionGain = null;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function init() {
    if (ctx) return true;
    var AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; return false; } }
    master = ctx.createGain(); master.gain.value = 0.9;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.5; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    try {
      var rev = ctx.createConvolver();
      rev.buffer = impulse(2.8, 2.2);
      revSend = ctx.createGain(); revSend.gain.value = 0.32;
      revSend.connect(rev); rev.connect(master);
    } catch (e3) { revSend = null; }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function impulse(seconds, decay) {
    var rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    var buf = ctx.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++) {
      var ch = buf.getChannelData(c);
      for (var i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function unlock() {
    if (!init()) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      if (!unlocked) {
        var b = ctx.createBuffer(1, 1, 22050);
        var s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
        unlocked = true;
        startScheduler();
      }
    } catch (e) { /* ignore */ }
  }

  function ready() { return !!(ctx && unlocked && ctx.state !== 'closed'); }

  // ---------- building blocks ----------
  function env(g, t, peak, attack, decay) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function tone(type, freq, t, dur, peak, dest, attack, glideTo) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    env(g, t, peak, attack || 0.005, dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + (attack || 0.005) + dur + 0.05);
    return g;
  }
  function noise(t, dur, peak, dest, type, f0, f1, q) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0 || 1000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain(); env(g, t, peak, 0.005, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
    return g;
  }
  function wet(node, amount) {
    if (!revSend) return;
    var g = ctx.createGain(); g.gain.value = amount; node.connect(g); g.connect(revSend);
  }

  // Music-box note: bright, short attack, ringing decay.
  function box(t, midi, len, vel, dest) {
    var f = mtof(midi);
    var g = ctx.createGain();
    env(g, t, vel, 0.004, 0.7 + len * 0.25);
    var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.002;
    var o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = f * 3.995;
    var g2 = ctx.createGain(); g2.gain.value = 0.22;
    var g3 = ctx.createGain(); g3.gain.value = 0.04;
    o1.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
    g.connect(dest); wet(g, 0.7);
    var end = t + 1.2 + len * 0.3;
    o1.start(t); o2.start(t); o3.start(t); o1.stop(end); o2.stop(end); o3.stop(end);
  }
  function bass(t, midi, len, vel, dest) {
    var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(midi);
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    var g = ctx.createGain(); env(g, t, vel, 0.01, 0.5 + len * 0.2);
    o.connect(f); f.connect(g); g.connect(dest); wet(g, 0.2);
    o.start(t); o.stop(t + 0.8 + len * 0.3);
  }
  function pad(t, midis, dur, vel, dest) {
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.4;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    f.connect(g); g.connect(dest); wet(g, 0.6);
    midis.forEach(function (m) {
      [-6, 6].forEach(function (det) {
        var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.7);
      });
    });
  }
  function tick(t, vel, dest) { noise(t, 0.025, vel, dest, 'highpass', 5000); }
  function bell(t, freq, vel, dest, dur) {
    var car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sine'; mod.type = 'sine';
    car.frequency.value = freq; mod.frequency.value = freq * 1.41;
    mg.gain.setValueAtTime(freq * 1.2, t); mg.gain.exponentialRampToValueAtTime(1, t + (dur || 0.9));
    mod.connect(mg); mg.connect(car.frequency);
    env(g, t, vel, 0.003, dur || 0.9);
    car.connect(g); g.connect(dest); wet(g, 0.6);
    car.start(t); mod.start(t); car.stop(t + (dur || 0.9) + 0.1); mod.stop(t + (dur || 0.9) + 0.1);
  }

  // ---------- music ----------
  // Note lists: [step, midi, lengthInSteps, velocity]
  function chordSteps(bars, stepsPerBar, offsets, vel) {
    var out = [];
    bars.forEach(function (root, b) {
      offsets.forEach(function (o) { out.push([b * stepsPerBar + o[0], root + o[1], o[2] || 1, vel]); });
    });
    return out;
  }
  var TRACKS = {
    dream: {
      bpm: 74, spb: 2, len: 48,
      lead: [[0, 76, 2, .26], [2, 81, 2, .24], [4, 79, 1, .2], [5, 76, 1, .18], [6, 74, 3, .24], [9, 72, 1, .18], [10, 71, 2, .2],
        [12, 72, 2, .24], [14, 76, 2, .22], [16, 79, 2, .22], [18, 78, 3, .24], [21, 76, 1, .18], [22, 74, 2, .2],
        [24, 76, 2, .26], [26, 81, 2, .24], [28, 83, 1, .2], [29, 81, 1, .18], [30, 79, 2, .22], [32, 76, 2, .2], [34, 72, 2, .2],
        [36, 74, 2, .22], [38, 76, 1, .18], [39, 74, 1, .16], [40, 71, 2, .2], [42, 69, 6, .24]],
      bass: [[0, 45, 6, .32], [6, 41, 6, .3], [12, 48, 6, .3], [18, 43, 6, .3], [24, 45, 6, .32], [30, 41, 6, .3], [36, 40, 6, .3], [42, 45, 6, .32]],
      plinks: chordSteps([57, 53, 60, 55, 57, 53, 52, 57], 6, [[2, 7], [2, 12], [4, 4], [4, 12]], 0.07),
      pads: [[0, [57, 60, 64], 12], [12, [55, 60, 64], 12], [24, [57, 60, 64], 12], [36, [56, 59, 64], 12]]
    },
    maze: {
      bpm: 92, spb: 2, len: 64, ticks: 2,
      lead: [[0, 81, 3, .2], [3, 77, 1, .15], [4, 76, 2, .17], [6, 74, 4, .19], [10, 72, 2, .15], [12, 74, 4, .18],
        [16, 84, 3, .19], [19, 81, 1, .15], [20, 79, 2, .16], [22, 77, 4, .18], [26, 76, 2, .15], [28, 79, 4, .17],
        [32, 81, 3, .2], [35, 86, 1, .16], [36, 84, 2, .17], [38, 81, 4, .18], [42, 82, 2, .15], [44, 79, 4, .17],
        [48, 76, 2, .17], [50, 77, 2, .17], [52, 79, 2, .17], [54, 81, 2, .18], [56, 85, 4, .19], [60, 81, 4, .17]],
      bass: [[0, 38, 3, .3], [4, 45, 3, .22], [8, 34, 3, .3], [12, 41, 3, .22], [16, 41, 3, .3], [20, 48, 3, .22], [24, 36, 3, .3], [28, 43, 3, .22],
        [32, 38, 3, .3], [36, 45, 3, .22], [40, 43, 3, .3], [44, 50, 3, .22], [48, 45, 3, .3], [52, 40, 3, .22], [56, 45, 3, .3], [60, 43, 3, .22]],
      plinks: (function () {
        var roots = [62, 58, 65, 60, 62, 55, 57, 57];
        var thirds = [3, 4, 4, 4, 3, 3, 4, 4];
        var out = [];
        roots.forEach(function (r, b) {
          var pat = [0, 7, 12, 7, 12 + thirds[b], 7, 12, 7];
          pat.forEach(function (o, i) { out.push([b * 8 + i, r + o, 1, i % 2 ? 0.05 : 0.075]); });
        });
        return out;
      })()
    },
    night: {
      bpm: 60, spb: 1, len: 16, ticks: 1,
      lead: [[0, 88, 3, .07], [6, 83, 3, .06], [11, 86, 4, .06]],
      bass: [], plinks: [],
      pads: [[0, [52, 59, 64], 8], [8, [53, 57, 64], 8]]
    },
    ending: {
      bpm: 70, spb: 2, len: 48,
      lead: [[0, 76, 2, .24], [2, 79, 2, .22], [4, 84, 2, .22], [6, 83, 3, .24], [9, 81, 1, .18], [10, 76, 2, .2],
        [12, 77, 2, .22], [14, 81, 2, .22], [16, 84, 2, .22], [18, 86, 3, .24], [21, 84, 1, .18], [22, 83, 2, .2],
        [24, 84, 2, .24], [26, 79, 2, .2], [28, 76, 2, .2], [30, 79, 3, .22], [33, 83, 1, .18], [34, 88, 2, .2],
        [36, 81, 2, .22], [38, 79, 2, .2], [40, 77, 2, .2], [42, 76, 4, .24], [46, 72, 2, .2]],
      bass: [[0, 48, 6, .3], [6, 45, 6, .3], [12, 41, 6, .3], [18, 43, 6, .3], [24, 48, 6, .3], [30, 40, 6, .3], [36, 41, 6, .3], [42, 48, 6, .3]],
      plinks: chordSteps([60, 57, 53, 55, 60, 52, 53, 60], 6, [[2, 7], [2, 12], [4, 4], [4, 12]], 0.07),
      pads: [[0, [60, 64, 67], 12], [12, [53, 57, 60], 12], [24, [60, 64, 67], 12], [36, [53, 57, 60], 6], [42, [55, 60, 64], 6]]
    }
  };

  var song = null, songGain = null, nextStep = 0, nextTime = 0, timer = null, wantSong = null;
  function startScheduler() {
    if (timer) return;
    timer = setInterval(schedule, 40);
  }
  function music(name) {
    wantSong = name || null;
    if (!ready()) return;
    if (song && song.name === wantSong) return;
    var now = ctx.currentTime;
    if (songGain) {
      var old = songGain;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0.0001, now + 1.2);
      setTimeout(function () { try { old.disconnect(); } catch (e) { /* ignore */ } }, 1600);
    }
    song = null; songGain = null;
    if (!wantSong || !TRACKS[wantSong]) return;
    song = { name: wantSong, def: TRACKS[wantSong] };
    songGain = ctx.createGain();
    songGain.gain.setValueAtTime(0.0001, now);
    songGain.gain.linearRampToValueAtTime(1, now + 1.5);
    songGain.connect(musicBus);
    nextStep = 0; nextTime = now + 0.12;
  }
  function schedule() {
    if (!ready()) return;
    if (wantSong !== (song ? song.name : null)) music(wantSong);
    if (!song || ctx.state !== 'running') return;
    var def = song.def;
    var stepDur = 60 / def.bpm / def.spb;
    // Recover gracefully after the tab was hidden.
    if (nextTime < ctx.currentTime - 0.5) nextTime = ctx.currentTime + 0.05;
    while (nextTime < ctx.currentTime + 0.25) {
      var s = nextStep, t = nextTime;
      for (var i = 0; i < def.lead.length; i++) if (def.lead[i][0] === s) box(t, def.lead[i][1], def.lead[i][2], def.lead[i][3], songGain);
      for (i = 0; i < def.plinks.length; i++) if (def.plinks[i][0] === s) box(t, def.plinks[i][1], 1, def.plinks[i][3], songGain);
      for (i = 0; i < def.bass.length; i++) if (def.bass[i][0] === s) bass(t, def.bass[i][1], def.bass[i][2], def.bass[i][3], songGain);
      if (def.pads) for (i = 0; i < def.pads.length; i++) if (def.pads[i][0] === s) pad(t, def.pads[i][1], def.pads[i][2] * stepDur, 0.022, songGain);
      if (def.ticks && s % def.ticks === 0) tick(t, s % (def.ticks * 4) === 0 ? 0.05 : 0.03, songGain);
      nextStep = (nextStep + 1) % def.len;
      nextTime += stepDur;
    }
  }

  // Low drone that swells when danger is near (0..1).
  function tension(v) {
    if (!ready()) return;
    var now = ctx.currentTime;
    if (!tensionOsc) {
      tensionGain = ctx.createGain(); tensionGain.gain.value = 0.0001; tensionGain.connect(musicBus);
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.connect(tensionGain);
      tensionOsc = [55, 55 * 1.06, 82.4].map(function (fr) {
        var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); return o;
      });
    }
    tensionGain.gain.cancelScheduledValues(now);
    tensionGain.gain.setTargetAtTime(Math.max(0.0001, v * 0.12), now, 0.25);
  }

  // ---------- effects ----------
  var lastPlay = {};
  var SFX = {
    step: function (t, o) { var f = 1700 + (o && o.alt ? 220 : 0) + Math.random() * 60; tone('sine', f, t, 0.05, 0.05, sfxBus); tone('sine', f * 1.5, t, 0.035, 0.025, sfxBus); },
    bonk: function (t) { tone('triangle', 150, t, 0.1, 0.18, sfxBus, 0.003, 110); },
    shard: function (t) { [88, 91, 95].forEach(function (m, i) { box(t + i * 0.06, m, 1, 0.22, sfxBus); }); noise(t, 0.4, 0.05, sfxBus, 'highpass', 6000); },
    reveal: function (t) { [72, 76, 79, 84, 88].forEach(function (m, i) { box(t + i * 0.09, m, 2, 0.24, sfxBus); }); noise(t, 1.4, 0.06, sfxBus, 'bandpass', 3000, 9000, 2); },
    marble: function (t) { bell(t, 1318, 0.2, sfxBus, 1.4); box(t + 0.08, 100, 2, 0.15, sfxBus); },
    key: function (t) { bell(t, 1046, 0.15, sfxBus, 0.5); bell(t + 0.12, 1568, 0.15, sfxBus, 0.7); },
    unlock: function (t) { noise(t, 0.04, 0.3, sfxBus, 'highpass', 3000); tone('square', 220, t + 0.03, 0.12, 0.07, sfxBus, 0.003, 110); },
    bell: function (t, o) { bell(t, o && o.sw ? 988 : 784, 0.22, sfxBus, 1.0); bell(t + 0.11, o && o.sw ? 1318 : 1046, 0.12, sfxBus, 0.8); },
    rotate: function (t) { for (var i = 0; i < 3; i++) noise(t + i * 0.045, 0.03, 0.22, sfxBus, 'bandpass', 2400 - i * 300, null, 6); tone('triangle', 330, t, 0.15, 0.05, sfxBus, 0.005, 440); },
    crumble: function (t) { noise(t, 0.5, 0.35, sfxBus, 'lowpass', 2200, 200); tone('sine', 120, t, 0.25, 0.25, sfxBus, 0.004, 50); for (var i = 0; i < 4; i++) noise(t + 0.08 + i * 0.07, 0.03, 0.12, sfxBus, 'bandpass', 1800 + Math.random() * 1500, null, 4); },
    portal: function (t) { var g = noise(t, 0.55, 0.25, sfxBus, 'bandpass', 300, 4000, 3); wet(g, 0.5); tone('sine', 300, t, 0.5, 0.1, sfxBus, 0.02, 1200); },
    handWarn: function (t) { var g = tone('sine', 98, t, 1.0, 0.16, sfxBus, 0.5, 130); wet(g, 0.4); tone('sine', 104, t, 1.0, 0.1, sfxBus, 0.5, 139); },
    slam: function (t) { tone('sine', 90, t, 0.3, 0.45, sfxBus, 0.003, 40); noise(t, 0.18, 0.25, sfxBus, 'lowpass', 900, 150); },
    hurt: function (t) { var g = tone('square', 520, t, 0.35, 0.09, sfxBus, 0.005, 180); wet(g, 0.3); },
    squeak: function (t) { tone('sine', 950, t, 0.2, 0.12, sfxBus, 0.01, 620); },
    caught: function (t) { [45, 46, 51].forEach(function (m) { tone('sawtooth', mtof(m), t, 1.6, 0.05, sfxBus, 0.3); }); box(t + 0.2, 64, 3, 0.15, sfxBus); box(t + 0.5, 63, 3, 0.12, sfxBus); },
    clear: function (t) { [72, 76, 79, 84, 88, 91].forEach(function (m, i) { box(t + i * 0.08, m, 2, 0.24, sfxBus); }); },
    ui: function (t) { tone('sine', 1250, t, 0.04, 0.06, sfxBus); },
    voiceLL: function (t) { var g = tone('triangle', 95 + Math.random() * 45, t, 0.07, 0.11, sfxBus, 0.005); wet(g, 0.5); },
    voiceGirl: function (t) { tone('sine', 620 + Math.random() * 160, t, 0.05, 0.05, sfxBus, 0.004); },
    voiceNarr: function (t) { tone('sine', 1500 + Math.random() * 300, t, 0.03, 0.012, sfxBus, 0.002); },
    wake: function (t) { noise(t, 0.6, 0.2, sfxBus, 'bandpass', 400, 5000, 1.5); [79, 84, 88].forEach(function (m, i) { box(t + 0.15 + i * 0.03, m, 1, 0.12, sfxBus); }); },
    sleep: function (t) { var g = tone('sine', 880, t, 1.4, 0.07, sfxBus, 0.2, 220); wet(g, 0.8); },
    door: function (t) { noise(t, 0.05, 0.25, sfxBus, 'bandpass', 1800, null, 3); tone('sine', 180, t + 0.03, 0.2, 0.15, sfxBus, 0.003, 90); },
    chuckle: function (t) { for (var i = 0; i < 3; i++) { var g = tone('triangle', 120 - i * 8, t + i * 0.16, 0.1, 0.07, sfxBus, 0.01); wet(g, 0.8); } },
    descend: function (t) { var g = tone('sine', 1300, t, 0.7, 0.12, sfxBus, 0.01, 260); wet(g, 0.5); },
    heart: function (t) { box(t, 84, 1, 0.18, sfxBus); box(t + 0.1, 91, 2, 0.18, sfxBus); }
  };

  function play(name, opts) {
    if (!ready() || !SFX[name]) return;
    var nowMs = DD.now();
    var minGap = name === 'step' ? 45 : name.indexOf('voice') === 0 ? 40 : 30;
    if (lastPlay[name] && nowMs - lastPlay[name] < minGap) return;
    lastPlay[name] = nowMs;
    try { SFX[name](ctx.currentTime + 0.005, opts); } catch (e) { /* never let audio break the game */ }
  }

  function setVolumes(m, s) {
    musicVol = DD.clamp(m, 0, 1); sfxVol = DD.clamp(s, 0, 1);
    if (!ctx) return;
    var now = ctx.currentTime;
    musicBus.gain.setTargetAtTime(musicVol * 0.5, now, 0.05);
    sfxBus.gain.setTargetAtTime(sfxVol, now, 0.05);
  }

  function suspend() { try { if (ctx && ctx.state === 'running') ctx.suspend(); } catch (e) { /* ignore */ } }
  function resume() { try { if (ctx && unlocked && ctx.state === 'suspended') ctx.resume(); } catch (e) { /* ignore */ } }

  DD.Audio = { unlock: unlock, ready: ready, music: music, play: play, tension: tension, setVolumes: setVolumes, suspend: suspend, resume: resume };
})();
