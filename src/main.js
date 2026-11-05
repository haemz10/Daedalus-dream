/* Daedalus Dream — the director: boot, story flow, stage flow, Endless Gym, main loop. */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  var $ = function (id) { return document.getElementById(id); };
  var t = function (k, p) { return DD.t(k, p); };
  var UI, Game, Scenes, Audio, Save;

  var canvas, ctx, vw = 1, vh = 1, dpr = 1;
  var mode = 'scene';          // 'scene' | 'play'
  var flowId = 0;              // bumps when a new flow starts; old async flows stop at their next await
  var cur = { stage: null, endless: null, def: null, restartArmed: 0, hintTimer: null };
  var lastTs = 0, errors = 0;

  function newFlow() { flowId++; return flowId; }
  function alive(id) { return id === flowId; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function stageDef(id) { for (var i = 0; i < DD.STAGES.length; i++) if (DD.STAGES[i].id === id) return DD.STAGES[i]; return null; }
  function nextStageId(id) {
    var ids = DD.STAGES.map(function (s) { return s.id; });
    var i = ids.indexOf(id);
    return i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
  }

  // ---------- layout ----------
  function resize() {
    var app = $('app');
    vw = Math.max(1, app.clientWidth); vh = Math.max(1, app.clientHeight);
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    var W = Math.round(vw * dpr), H = Math.round(vh * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    layoutGame();
  }
  function layoutGame() {
    var top = 0, bottom = 0;
    if (!$('hud').hidden) {
      var r = document.querySelector('.hud-top').getBoundingClientRect();
      top = Math.max(0, r.bottom - 14);
      if (!$('dpad').hidden) bottom = $('dpad').getBoundingClientRect().height * 0.6;
    }
    Game.setView(vw, vh, dpr, top, bottom);
  }

  // ---------- title ----------
  function showTitle() {
    newFlow();
    stopStage();
    mode = 'scene';
    Scenes.set('title');
    UI.showHud(false);
    UI.show('scr-title');
    $('btn-play-label').textContent = t(Save.data.entered ? 'btn.continue' : 'btn.start');
    $('btn-endless').hidden = !Save.data.storyCleared;
    Audio.music('dream');
  }
  function onPlay() {
    Audio.unlock(); Audio.play('ui');
    if (!Save.data.entered) runDream();
    else showSelect();
  }

  // ---------- the dream (prologue + the refusal loop) ----------
  function refusalLine(n) {
    var keys = ['ll.r1', 'll.r2', 'll.r3', 'll.r4', 'll.r5', 'll.r6', 'll.r7', 'll.r8'];
    var k = n <= 8 ? keys[n - 1] : ['ll.r4', 'll.r5', 'll.r6', 'll.r7', 'll.r8'][(n - 9) % 5];
    return { who: 'll', key: k, params: { n: n } };
  }
  async function runDream() {
    var id = newFlow();
    mode = 'scene';
    UI.hideScreens();
    Audio.music('dream');
    var r;
    if (!Save.data.seenPrologue) {
      Scenes.set('void', { girl: 0, glowFar: 0 });
      Scenes.tween({ girl: 1 }, 1.6);
      r = await UI.narrate(['n.p1', 'n.p2', 'n.p3']);
      if (!alive(id)) return;
      Scenes.tween({ glowFar: 1 }, 2.2);
      await UI.narrate(['n.p4']);
      if (!alive(id)) return;
      Scenes.set('gym', { gym: 0, ll: 0 });
      Scenes.tween({ gym: 1 }, 2.4);
      await UI.narrate(['n.p5', 'n.p6', 'n.p7']);
      if (!alive(id)) return;
      Scenes.tween({ ll: 1 }, 1.8);
      Audio.play('chuckle');
      await UI.narrate(['n.p8']);
      if (!alive(id)) return;
      Scenes.state.p.pose = 'invite';
      await UI.dialog([{ who: 'll', key: 'll.hello' }, { who: 'll', key: 'll.invite' }]);
      if (!alive(id)) return;
      await UI.narrate(['n.p9', 'n.p10']);
      if (!alive(id)) return;
      Save.data.seenPrologue = true; Save.save();
    } else {
      Scenes.set('gym', { gym: 1, ll: 1, step: Save.data.refusals, pose: 'invite' });
      r = await UI.narrate(['n.again'], { skippable: true });
      if (!alive(id)) return;
      if (r !== 'skip') await UI.dialog([refusalLine(Math.max(1, Save.data.refusals)), { who: 'll', key: 'll.invite' }], { skippable: true });
      if (!alive(id)) return;
    }
    for (;;) {
      Scenes.state.p.pose = 'invite';
      var c = await UI.choice(Save.data.refusals);
      if (!alive(id)) return;
      if (c === 'enter') break;
      Save.data.refusals++; Save.save();
      await wakeUp(Save.data.refusals, id);
      if (!alive(id)) return;
      Scenes.set('gym', { gym: 0, ll: 1, step: Save.data.refusals, pose: 'stand' });
      Scenes.tween({ gym: 1 }, 1.2);
      r = await UI.narrate(['n.again'], { skippable: true });
      if (!alive(id)) return;
      if (r !== 'skip') await UI.dialog([refusalLine(Save.data.refusals), { who: 'll', key: 'll.invite' }], { skippable: true });
      if (!alive(id)) return;
    }
    await enterMaze(id);
  }
  async function wakeUp(n, id) {
    UI.hideScreens();
    Audio.play('wake'); DD.vibrate(30);
    Audio.music('night');
    Scenes.set('bedroom', { loop: n, flash: 1 });
    Scenes.tween({ flash: 0 }, 1.3);
    var lines = ['n.w1'];
    if (n === 1) lines.push('n.w2');
    else if (n === 2) lines.push('n.wClock');
    else if (n === 3) lines.push('n.wToy');
    else if (n === 4) lines.push('n.wWindow');
    else if (n === 5) lines.push('n.wUnsure');
    else lines.push(n % 2 ? 'n.wShadow' : 'n.wUnsure');
    lines.push('n.wSleep');
    await UI.narrate(lines, { skippable: Save.data.refusals > 1 });
    if (!alive(id)) return;
    Scenes.state.p.eyesClosed = 1;
    Audio.play('sleep');
    await Scenes.tween({ dark: 1 }, 1.3);
    Audio.music('dream');
  }
  async function enterMaze(id) {
    Scenes.state.p.pose = 'stand';
    await UI.dialog([{ who: 'll', key: 'll.e1' }, { who: 'll', key: 'll.e2' }, { who: 'll', key: 'll.e3' }]);
    if (!alive(id)) return;
    UI.hideScreens();
    await Scenes.tween({ girlX: 1 }, 2.3);
    if (!alive(id)) return;
    Scenes.tween({ girl: 0 }, 0.6);
    await sleep(450);
    Scenes.tween({ gate: 1 }, 0.35);
    Audio.play('door');
    await UI.narrate(['n.e4']);
    if (!alive(id)) return;
    Save.data.entered = true; Save.save();
    await Scenes.tween({ fade: 1 }, 0.8);
    if (!alive(id)) return;
    await UI.card(t('ch.1'), t('sel.chapter', { n: 1 }), 1500);
    if (!alive(id)) return;
    startStage('1-1');
  }

  // ---------- stage select ----------
  function showSelect() {
    if (Save.stage('3-5').clear && !Save.data.storyCleared) { ending(); return; }
    newFlow();
    stopStage();
    mode = 'scene';
    Scenes.set('title');
    UI.showHud(false);
    UI.show('scr-select');
    var first = UI.buildSelect(function (id) { startStage(id); }, startEndless);
    $('scr-select').scrollTop = 0;
    if (first) setTimeout(function () { try { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ignore */ } }, 60);
    Audio.music('dream');
  }

  // ---------- a story stage ----------
  function stopStage() {
    clearTimeout(cur.hintTimer);
    UI.clearToast();
    UI.modal('modal-pause', false);
    UI.modal('modal-result', false);
    Game.clear();
    Audio.tension(0);
  }
  function startStage(id) {
    newFlow();
    stopStage();
    var def = stageDef(id);
    if (!def) { showSelect(); return; }
    if (id === '2-1' && Save.stage('1-5').clear && !Save.data.interludes['1']) { interlude(1, '2-1'); return; }
    if (id === '3-1' && Save.stage('2-5').clear && !Save.data.interludes['2']) { interlude(2, '3-1'); return; }
    cur.stage = id; cur.endless = null; cur.def = def;
    mode = 'play';
    UI.hideScreens();
    Game.start(def, { mode: 'story', chapter: +id[0], stage: id, hearts: 3, maxHearts: 3, onWin: onStageWin, onCaught: onStageCaught });
    UI.showHud(true, { label: id + '  ' + t('st.' + id) });
    layoutGame();
    Audio.music('maze');
    UI.card(t('st.' + id), t('sel.chapter', { n: +id[0] }) + ' · ' + id, 1100);
    showHints(def.hints || [], flowId);
  }
  function showHints(hints, id) {
    var list = hints.filter(function (h) { return !Save.data.seenHints[h]; });
    var i = 0;
    function next() {
      if (!alive(id) || i >= list.length) return;
      var h = list[i++];
      UI.toast(t(h), 4600, true);
      Save.data.seenHints[h] = true; Save.save();
      cur.hintTimer = setTimeout(next, 5000);
    }
    cur.hintTimer = setTimeout(next, 1700);
  }
  function endOfStageUI() { clearTimeout(cur.hintTimer); UI.clearToast(); }
  function onStageWin(s) {
    var id = cur.stage, fid = flowId;
    endOfStageUI();
    var rec = Save.record(id, s);
    var next = nextStageId(id);
    var actions = [];
    var story = needsStory(id);
    if (next || story) actions.push({ id: 'next', label: t('btn.next'), cls: 'primary' });
    actions.push({ id: 'retry', label: t('btn.retry'), cls: next || story ? 'ghost' : 'primary' });
    if (!story) actions.push({ id: 'map', label: t('btn.stages'), cls: 'ghost' });
    Audio.tension(0);
    UI.result({
      title: t('res.clear'),
      stars: [
        { on: true, label: t('star.escape') },
        { on: rec.after.marble, label: t('star.marble'), icon: 'marble' },
        { on: rec.after.fast, label: t('star.fast', { t: DD.formatTime(s.par) }), icon: 'clock' }
      ],
      stats: [
        [t('res.time'), DD.formatTime(s.time), s.time <= s.par ? 'best' : ''],
        [t('res.goal'), DD.formatTime(s.par)],
        [t('res.marble'), t(s.marble ? 'res.found' : 'res.missed'), s.marble ? 'best' : '']
      ],
      actions: actions
    }).then(function (a) {
      if (!alive(fid)) return;
      if (a === 'retry') startStage(id);
      else if (a === 'map') showSelect();
      else if (story === 'i1') interlude(1, '2-1');
      else if (story === 'i2') interlude(2, '3-1');
      else if (story === 'end') ending();
      else if (next) startStage(next);
    });
  }
  function needsStory(id) {
    if (id === '1-5' && !Save.data.interludes['1']) return 'i1';
    if (id === '2-5' && !Save.data.interludes['2']) return 'i2';
    if (id === '3-5' && !Save.data.storyCleared) return 'end';
    return null;
  }
  function caughtLine() { return '“' + t(['ll.c1', 'll.c2', 'll.c3'][Math.floor(Math.random() * 3)]) + '”'; }
  function onStageCaught() {
    var id = cur.stage, fid = flowId;
    endOfStageUI();
    Audio.tension(0);
    UI.result({
      title: t('res.caught'), line: caughtLine(),
      actions: [{ id: 'retry', label: t('btn.retry'), cls: 'primary' }, { id: 'map', label: t('btn.stages'), cls: 'ghost' }]
    }).then(function (a) {
      if (!alive(fid)) return;
      if (a === 'retry') startStage(id); else showSelect();
    });
  }

  // ---------- story between chapters ----------
  async function interlude(n, nextId) {
    var id = newFlow();
    stopStage();
    mode = 'scene';
    UI.showHud(false);
    UI.hideScreens();
    Audio.music('dream');
    Scenes.set('interlude', { face: 0, smile: n === 1 ? 0.45 : 0.7, eyes: n === 1 ? 'closed' : 'open' });
    Scenes.tween({ face: 1 }, 2.6);
    Audio.play('chuckle');
    await sleep(1400);
    if (!alive(id)) return;
    var lines = n === 1
      ? [{ who: 'll', key: 'll.i1a' }, { who: 'girl', key: 'g.i1b' }, { who: 'll', key: 'll.i1c' }]
      : [{ who: 'll', key: 'll.i2a' }, { who: 'll', key: 'll.i2b' }, { who: 'll', key: 'll.i2c' }, { who: 'girl', key: 'g.i2d' }, { who: 'll', key: 'll.i2e' }];
    await UI.dialog(lines, { skippable: true });
    if (!alive(id)) return;
    Save.data.interludes[String(n)] = true; Save.save();
    UI.hideScreens();
    await Scenes.tween({ fade: 1 }, 0.9);
    if (!alive(id)) return;
    await UI.card(t('ch.' + (n + 1)), t('sel.chapter', { n: n + 1 }), 1600);
    if (!alive(id)) return;
    startStage(nextId);
  }

  async function ending() {
    var id = newFlow();
    stopStage();
    mode = 'scene';
    UI.showHud(false);
    UI.hideScreens();
    Audio.music('ending');
    var trueEnd = Save.totals().marbles >= DD.STAGES.length;
    Scenes.set('door', { glow: 0, girlX: 0 });
    Scenes.tween({ glow: 1 }, 2.4);
    await UI.narrate(['n.f1']);
    if (!alive(id)) return;
    await UI.dialog([{ who: 'll', key: 'll.f2' }, { who: 'll', key: 'll.f3' }, { who: 'girl', key: 'g.f4' }, { who: 'll', key: 'll.f5' }, { who: 'girl', key: 'g.f6' }]);
    if (!alive(id)) return;
    if (trueEnd) {
      await UI.dialog([{ who: 'll', key: 'll.t1' }, { who: 'll', key: 'll.t2' }]);
      if (!alive(id)) return;
      Scenes.state.p.llPose = 'hat';
      await sleep(700);
      Scenes.state.p.old = 1; Scenes.state.p.llPose = 'stand';
      Audio.play('reveal');
      await UI.narrate(['n.t3']);
      if (!alive(id)) return;
      await UI.dialog([{ who: 'll', key: 'll.t4' }]);
      if (!alive(id)) return;
    }
    UI.hideScreens();
    Scenes.state.p.walking = true;
    await Scenes.tween({ girlX: 1 }, 2.6);
    Scenes.state.p.walking = false;
    Scenes.tween({ girlAlpha: 0 }, 0.9);
    await UI.narrate(['n.f7']);
    if (!alive(id)) return;
    if (trueEnd) {
      UI.hideScreens();
      await Scenes.tween({ llX: 1 }, 2.6);
      Scenes.tween({ llAlpha: 0 }, 1);
      await UI.narrate(['n.t5']);
      if (!alive(id)) return;
    }
    Audio.play('wake');
    Scenes.set('bedroom', { morning: 1, flash: 1, marble: 0 });
    Scenes.tween({ flash: 0 }, 1.6);
    await UI.narrate(['n.f8', 'n.f9']);
    if (!alive(id)) return;
    Scenes.tween({ marble: 1 }, 1.2);
    Audio.play('marble');
    await UI.narrate(['n.f10']);
    if (!alive(id)) return;
    Save.data.storyCleared = true;
    if (trueEnd) Save.data.trueEnding = true;
    Save.save();
    UI.hideScreens();
    await UI.card(t('n.theEnd'), '', 2400);
    if (!alive(id)) return;
    if (!trueEnd) {
      var tot = Save.totals();
      await UI.narrate([{ key: 'n.marbleHint', params: { n: tot.marbles, t: tot.maxMarbles } }]);
      if (!alive(id)) return;
    }
    await UI.card(t('n.thanks'), t('game.title'), 2200);
    if (!alive(id)) return;
    Audio.music('dream');
    Scenes.set('gym', { gym: 1, ll: 1, step: 2, pose: 'invite', fade: 1 });
    Scenes.tween({ fade: 0 }, 1.4);
    await UI.narrate(['n.f11']);
    if (!alive(id)) return;
    await UI.dialog([{ who: 'll', key: 'll.f12' }, { who: 'll', key: 'll.f13' }]);
    if (!alive(id)) return;
    showSelect();
    UI.toast(t('toast.endless'), 3200);
  }

  // ---------- Endless Gym ----------
  async function startEndless() {
    var id = newFlow();
    stopStage();
    if (!Save.data.storyCleared) return;
    cur.stage = null;
    cur.endless = { depth: 1, hearts: 3, floorHearts: 3, seed: (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0, shards: 0, bestBefore: Save.data.endlessBest };
    if (!Save.data.endlessIntro) {
      mode = 'scene';
      UI.showHud(false);
      UI.hideScreens();
      Scenes.set('interlude', { face: 0, smile: 0.8, eyes: 'open' });
      Scenes.tween({ face: 1 }, 2);
      Audio.play('chuckle');
      await sleep(1000);
      if (!alive(id)) return;
      await UI.dialog([{ who: 'll', key: 'll.x1' }, { who: 'll', key: 'll.x2' }], { skippable: true });
      if (!alive(id)) return;
      Save.data.endlessIntro = true; Save.save();
    }
    runFloor(false);
  }
  async function runFloor(sameLayout) {
    var id = newFlow();
    var E = cur.endless;
    stopStage();
    UI.hideScreens();
    UI.showHud(false);
    mode = 'scene';
    Scenes.set('black');
    if (E.depth > Save.data.endlessBest) { Save.data.endlessBest = E.depth; Save.save(); }
    if (!sameLayout) UI.card(t('hud.depth', { n: E.depth }), t('btn.endless'), 900);
    await sleep(sameLayout ? 30 : 380);
    if (!alive(id)) return;
    var def = cur.def;
    if (!sameLayout || !def) {
      var p = DD.Gen.endlessParams(E.depth, DD.makeRng(E.seed + E.depth * 977));
      p.budget = 220;
      def = DD.Gen.make(p, (E.seed + E.depth * 131) >>> 0);
      cur.def = def;
    }
    E.floorHearts = E.hearts;
    mode = 'play';
    Game.start(def, { mode: 'endless', depth: E.depth, hearts: E.hearts, maxHearts: 5, onWin: onFloorWin, onCaught: onFloorCaught });
    UI.showHud(true, { label: t('btn.endless') + ' · ' + t('hud.depth', { n: E.depth }) });
    layoutGame();
    Audio.music('maze');
    var said = { 5: 'll.d1', 10: 'll.d2', 20: 'll.d3' }[E.depth];
    if (said && !sameLayout) setTimeout(function () { if (alive(id)) UI.toast('“' + t(said) + '”', 3200); }, 1600);
  }
  function onFloorWin(s) {
    var E = cur.endless;
    if (!E) return;
    E.shards += s.shards;
    E.hearts = Game.hearts();
    E.depth++;
    if ((E.depth - 1) % 5 === 0 && E.hearts < 5) { E.hearts++; UI.toast(t('toast.heart'), 1800); Audio.play('heart'); }
    Audio.play('descend');
    runFloor(false);
  }
  function onFloorCaught() {
    var E = cur.endless, fid = flowId;
    endOfStageUI();
    if (!E) return;
    Audio.tension(0);
    var best = Save.data.endlessBest;
    var isNew = E.depth > E.bestBefore;
    UI.result({
      title: t('res.endTitle'), line: caughtLine(),
      stats: [
        [t('res.depth', { n: E.depth }), isNew ? t('res.newBest') : '', isNew ? 'best' : ''],
        [t('res.shards', { n: E.shards }), ''],
        [t('res.best', { n: best }), '']
      ],
      actions: [{ id: 'retry', label: t('btn.retry'), cls: 'primary' }, { id: 'map', label: t('btn.stages'), cls: 'ghost' }]
    }).then(function (a) {
      if (!alive(fid)) return;
      if (a === 'retry') startEndless(); else showSelect();
    });
  }

  // ---------- pause & restart ----------
  function canPause() { var G = Game.get(); return mode === 'play' && G && !G.ended && !UI.modalOpen(); }
  function pause() {
    if (!canPause()) return;
    Game.setPaused(true);
    Audio.play('ui');
    $('p-map').querySelector('span').textContent = t('btn.stages');
    UI.modal('modal-pause', true);
  }
  function resume() {
    UI.modal('modal-pause', false);
    Game.setPaused(false);
  }
  function restart() {
    UI.modal('modal-pause', false);
    if (cur.endless) { cur.endless.hearts = cur.endless.floorHearts; runFloor(true); }
    else if (cur.stage) startStage(cur.stage);
  }
  function restartTap() {
    var G = Game.get();
    if (!G || G.ended || mode !== 'play') return;
    if (G.stuck || DD.now() - cur.restartArmed < 2200) { cur.restartArmed = 0; Audio.play('ui'); restart(); return; }
    cur.restartArmed = DD.now();
    UI.toast(t('toast.restartAgain'), 1800);
    UI.pulseRestart(true);
    setTimeout(function () { var g = Game.get(); if (g && !g.stuck) UI.pulseRestart(false); }, 2200);
  }

  // ---------- main loop ----------
  function frame(ts) {
    var dt = lastTs ? Math.min(0.05, Math.max(0, (ts - lastTs) / 1000)) : 0;
    lastTs = ts;
    dt *= DD.timeScale || 1; // tests may fast-forward
    try {
      var G = Game.get();
      if (mode === 'play' && G) {
        Game.update(dt);
        Game.draw(ctx);
        UI.updateHud(G);
      } else {
        Scenes.update(dt);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        Scenes.draw(ctx, vw, vh);
      }
    } catch (e) {
      errors++;
      if (errors < 5 && globalThis.console) console.error(e);
      if (errors === 30) UI.fatal();
    }
    requestAnimationFrame(frame);
  }

  function bind() {
    $('btn-play').addEventListener('click', onPlay);
    $('btn-endless').addEventListener('click', function () { Audio.unlock(); Audio.play('ui'); startEndless(); });
    $('btn-settings').addEventListener('click', function () { Audio.unlock(); Audio.play('ui'); UI.openSettings(); });
    $('btn-lang').addEventListener('click', function () { Audio.unlock(); Audio.play('ui'); UI.openSettings(); });
    $('sel-back').addEventListener('click', function () { Audio.play('ui'); showTitle(); });
    $('sel-settings').addEventListener('click', function () { Audio.play('ui'); UI.openSettings(); });
    $('hud-pause').addEventListener('click', pause);
    $('hud-zoom').addEventListener('click', function () { Game.toggleOverview(); });
    $('hud-restart').addEventListener('click', restartTap);
    $('p-resume').addEventListener('click', function () { Audio.play('ui'); resume(); });
    $('p-restart').addEventListener('click', function () { Audio.play('ui'); restart(); });
    $('p-settings').addEventListener('click', function () {
      Audio.play('ui');
      UI.modal('modal-pause', false);
      UI.openSettings().then(function () { if (Game.get() && mode === 'play') { UI.modal('modal-pause', true); layoutGame(); } });
    });
    $('p-map').addEventListener('click', function () {
      Audio.play('ui');
      UI.modal('modal-pause', false);
      showSelect();
    });
    UI.onLanguage = function () {
      if (!$('scr-select').hidden) UI.buildSelect(function (id) { startStage(id); }, startEndless);
      if (!$('scr-title').hidden) $('btn-play-label').textContent = t(Save.data.entered ? 'btn.continue' : 'btn.start');
      if (mode === 'play' && cur.stage) $('hud-stage').textContent = cur.stage + '  ' + t('st.' + cur.stage);
      if (mode === 'play' && cur.endless) $('hud-stage').textContent = t('btn.endless') + ' · ' + t('hud.depth', { n: cur.endless.depth });
    };
    UI.onReset = function () { UI.modal('modal-settings', false); showTitle(); };

    DD.Input.init(canvas, {
      enabled: function () { var G = Game.get(); return mode === 'play' && G && !G.paused && !G.ended && !UI.modalOpen(); },
      hold: function (d) { Game.holdInput(d); },
      release: function (d) { Game.release(d); },
      tap: function (x, y) { Game.tap(x, y); },
      action: function () { Game.action(); },
      zoom: function () { Game.toggleOverview(); },
      restart: function () { restartTap(); },
      key: function (e) {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          if ($('modal-pause').hidden === false) { resume(); return true; }
          if (canPause()) { pause(); return true; }
          return false;
        }
        if ((e.code === 'Space' || e.code === 'Enter') && UI.hasWaiter() && !UI.modalOpen()) { UI.advance(); return true; }
        return false;
      }
    });
    // iOS only lets audio start inside certain gestures, so listen to all of them.
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (ev) {
      document.addEventListener(ev, function () { Audio.unlock(); }, { capture: true, passive: true });
    });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
    if (globalThis.visualViewport) globalThis.visualViewport.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (canPause()) pause();
        Audio.suspend();
        Save.save();
      } else {
        Audio.resume();
        lastTs = 0;
      }
    });
    window.addEventListener('pagehide', function () { Save.save(); });
  }

  function registerSW() {
    try {
      var inFrame = globalThis.self !== globalThis.top;
      if (inFrame || DD.SINGLE_FILE || !('serviceWorker' in navigator) || globalThis.claude) return;
      if (!/^https?:$/.test(location.protocol)) return;
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* offline play just won't be available */ });
      });
    } catch (e) { /* ignore */ }
  }

  function boot(data) {
    UI = DD.UI; Game = DD.Game; Scenes = DD.Scenes; Audio = DD.Audio; Save = DD.Save;
    if (data && data.save) Save.restore(data.save); else Save.load();
    DD.setLang(Save.data.lang);
    canvas = $('stage');
    ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
    DD.Render.init();
    UI.init();
    document.body.classList.toggle('reduce-motion', !!Save.data.reduceMotion);
    Audio.setVolumes(Save.data.music, Save.data.sfx);
    bind();
    resize();
    requestAnimationFrame(frame);
    showTitle();
    registerSW();
  }

  // Debug / test hooks (harmless in production).
  DD.Director = {
    startStage: function (id) { startStage(id); },
    startEndless: function () { Save.data.storyCleared = true; startEndless(); },
    showSelect: function () { showSelect(); },
    showTitle: function () { showTitle(); },
    ending: function () { ending(); },
    interlude: function (n) { interlude(n, n === 1 ? '2-1' : '3-1'); },
    mode: function () { return mode; },
    endless: function () { return cur.endless; }
  };

  function start() {
    var hot = globalThis.claude && globalThis.claude.hot;
    try {
      if (hot && typeof hot.snapshot === 'function') hot.snapshot(function () { return { save: DD.Save.snapshot() }; });
    } catch (e) { /* ignore */ }
    if (hot && typeof hot.ready === 'function') hot.ready(boot);
    else boot((hot && hot.data) || {});
  }
  window.addEventListener('error', function () { errors++; if (errors === 30 && DD.UI) DD.UI.fatal(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
