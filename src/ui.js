/* Daedalus Dream — DOM screens: narration, dialogue, choices, menus, HUD, modals. */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});
  var t = function (k, p) { return DD.t(k, p); };
  var $ = function (id) { return document.getElementById(id); };

  var ICONS = {
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/></svg>',
    ff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6l8 6-8 6zM12 6l8 6-8 6z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="2"/><rect x="14" y="5" width="4" height="14" rx="2"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>',
    restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v4h4"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.6 4 4.5 7.3 4.5c2 0 3.5 1.1 4.7 2.7 1.2-1.6 2.7-2.7 4.7-2.7 3.3 0 5.7 3.1 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z"/></svg>',
    marble: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="currentColor"/><path d="M8.5 9.5a4.5 4.5 0 0 1 3-2.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none" opacity=".8"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="7.5" cy="12" r="3.5"/><path d="M11 12h10M17 12v3M20 12v2.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    shard: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
    dust: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="8" r="2.6"/><circle cx="16.5" cy="6.5" r="1.8"/><circle cx="12.5" cy="15" r="3"/><circle cx="19" cy="16.5" r="1.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>'
  };
  function icon(name, cls) { return '<i class="ico' + (cls ? ' ' + cls : '') + '">' + (ICONS[name] || '') + '</i>'; }
  function fillIcons(root) {
    (root || document).querySelectorAll('[data-ico]').forEach(function (el) { el.innerHTML = ICONS[el.getAttribute('data-ico')] || ''; });
  }

  var screens = ['scr-boot', 'scr-title', 'scr-narr', 'scr-dialog', 'scr-choice', 'scr-select'];
  function show(id) {
    screens.forEach(function (s) { $(s).hidden = s !== id; });
    if (id !== 'scr-narr' && id !== 'scr-dialog' && id !== 'scr-choice') $('btn-skip').hidden = true;
  }
  function hideScreens() { show(null); }

  function applyLang() {
    var code = DD.getLang();
    document.documentElement.lang = DD.LANG_TAGS[code] || code;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    $('lang-name').textContent = t('lang.name');
    document.title = t('game.title');
    $('version').textContent = 'v' + DD.VERSION;
    buildLangGrid();
  }

  // ---------- tap-to-continue plumbing ----------
  var waiter = null; // { onTap, onSkip }
  var skipFn = null;
  function setSkip(fn) {
    skipFn = fn;
    $('btn-skip').hidden = !fn;
  }
  function onAdvance(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    DD.Audio.unlock();
    if (waiter && waiter.onTap) waiter.onTap();
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // Narration: one line at a time, tap to continue. Resolves 'done' or 'skip'.
  function narrate(keys, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var i = -1, shownAt = 0, el = $('narr-text'), hint = document.querySelector('#scr-narr .tap-hint');
      var timer = null;
      show('scr-narr');
      function finish(v) { waiter = null; setSkip(null); clearTimeout(timer); resolve(v); }
      function next() {
        i++;
        if (i >= keys.length) { el.classList.remove('in'); hint.classList.remove('in'); setTimeout(function () { finish('done'); }, 350); waiter = null; return; }
        var k = keys[i];
        shownAt = DD.now() + (i === 0 ? 120 : 380);
        el.classList.remove('in'); hint.classList.remove('in');
        timer = setTimeout(function () {
          el.textContent = typeof k === 'string' ? t(k) : t(k.key, k.params);
          void el.offsetWidth;
          el.classList.add('in');
          shownAt = DD.now();
          DD.Audio.play('voiceNarr');
          if (opts.onLine) opts.onLine(i, k);
          timer = setTimeout(function () { hint.classList.add('in'); }, 1400);
        }, i === 0 ? 120 : 380);
      }
      waiter = { onTap: function () { if (DD.now() - shownAt > 450) next(); } };
      if (opts.skippable) setSkip(function () { finish('skip'); });
      next();
    });
  }

  // Dialogue with a typewriter. lines: [{ who: 'll'|'girl'|null, key, params }]
  function dialog(lines, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var box = $('dialog'), whoEl = $('dlg-who'), textEl = $('dlg-text');
      var i = -1, full = '', shown = 0, typing = false, raf = null, last = 0, startedAt = 0;
      show('scr-dialog');
      function finish(v) { cancelAnimationFrame(raf); waiter = null; setSkip(null); resolve(v); }
      function type(now) {
        if (!typing) return;
        var dt = Math.min(0.1, (now - last) / 1000); last = now;
        var before = Math.floor(shown);
        shown = Math.min(full.length, shown + dt * (DD.getLang() === 'en' || DD.getLang() === 'fr' || DD.getLang() === 'es' ? 42 : 24));
        var n = Math.floor(shown);
        if (n !== before) {
          textEl.textContent = full.slice(0, n);
          if (n % 2 === 0 && /\S/.test(full[n - 1] || '')) DD.Audio.play(lines[i].who === 'll' ? 'voiceLL' : lines[i].who === 'girl' ? 'voiceGirl' : 'voiceNarr');
        }
        if (n >= full.length) { typing = false; box.classList.add('done'); return; }
        raf = requestAnimationFrame(type);
      }
      function next() {
        i++;
        if (i >= lines.length) { finish('done'); return; }
        var L = lines[i];
        box.className = 'dialog' + (L.who === 'll' ? ' ll' : L.who ? '' : ' narr');
        whoEl.textContent = L.who === 'll' ? t('who.longlegs') : L.who === 'girl' ? t('who.girl') : '';
        full = t(L.key, L.params);
        shown = 0; typing = true; textEl.textContent = '';
        last = DD.now(); startedAt = last;
        if (opts.onLine) opts.onLine(i, L);
        raf = requestAnimationFrame(type);
      }
      waiter = {
        onTap: function () {
          if (DD.now() - startedAt < 180) return;
          if (typing) { typing = false; shown = full.length; textEl.textContent = full; box.classList.add('done'); }
          else next();
        }
      };
      if (opts.skippable) setSkip(function () { finish('skip'); });
      next();
    });
  }

  // The big choice. n = how many times she has already refused.
  function choice(n) {
    return new Promise(function (resolve) {
      var wake = $('ch-wake'), enter = $('ch-enter');
      var label = n <= 0 ? 'choice.wake' : n === 1 ? 'choice.wake2' : n === 2 ? 'choice.wake3' : 'choice.wake4';
      $('ch-wake-label').textContent = t(label);
      wake.classList.toggle('uneasy', n >= 4);
      wake.classList.toggle('faint', n >= 6);
      show('scr-choice');
      var opened = DD.now();
      function pick(v) {
        return function (e) {
          e.preventDefault();
          if (DD.now() - opened < 400) return;
          enter.onclick = wake.onclick = null;
          DD.Audio.unlock(); DD.Audio.play('ui');
          resolve(v);
        };
      }
      enter.onclick = pick('enter');
      wake.onclick = pick('wake');
      setTimeout(function () { try { enter.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
    });
  }

  // ---------- toast & title cards ----------
  var toastTimer = null;
  function toast(text, ms, hint) {
    var el = $('toast');
    el.textContent = text;
    el.classList.toggle('hint', !!hint);
    el.classList.add('in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('in'); }, ms || 2200);
  }
  function clearToast() { clearTimeout(toastTimer); $('toast').classList.remove('in'); }
  function card(title, sub, ms) {
    var el = $('card');
    $('card-title').textContent = title || '';
    $('card-sub').textContent = sub || '';
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('in');
    return sleep(ms || 1800).then(function () {
      el.classList.remove('in');
      return sleep(600);
    }).then(function () { el.hidden = true; });
  }

  // ---------- HUD ----------
  var hudCache = {};
  function showHud(on, opts) {
    $('hud').hidden = !on;
    if (on) {
      hudCache = {};
      $('dpad').hidden = !DD.Save.data.dpad;
      $('hud-restart').classList.remove('pulse');
      $('hud-stage').textContent = opts && opts.label || '';
      $('hud-score').textContent = '0';
    }
  }
  function setText(id, html, key) {
    if (hudCache[key || id] === html) return;
    hudCache[key || id] = html;
    $(id).innerHTML = html;
  }
  function updateHud(G) {
    if (!G) return;
    var L = G.L, st = G.st;
    var got = DD.popcount(st.shardMask), total = L.shards.length;
    setText('hud-shards', icon('shard') + got + '/' + total);
    var shardsEl = $('hud-shards');
    if (shardsEl.classList.contains('full') !== (got === total)) shardsEl.classList.toggle('full', got === total);
    setText('hud-dust', icon('dust') + G.dustGot + '/' + G.dustTotal);
    var sc = String(G.score).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (hudCache.score !== sc) { hudCache.score = sc; $('hud-score').textContent = sc; }
    var keys = DD.Level.keysHeld(st);
    if (L.keys.length) { $('hud-keys').hidden = false; setText('hud-keys', icon('key') + '×' + keys); }
    else $('hud-keys').hidden = true;
    $('hud-marble').hidden = !(st.marble && L.marble >= 0);
    var hk = G.hearts + '/' + G.maxHearts;
    if (hudCache.hearts !== hk) {
      var prev = hudCache.heartsN;
      hudCache.hearts = hk; hudCache.heartsN = G.hearts;
      var h = '';
      for (var i = 0; i < G.maxHearts; i++) {
        var cls = i < G.hearts ? '' : 'off';
        if (prev != null && i === G.hearts && G.hearts < prev) cls += ' lost';
        h += icon('heart', cls);
      }
      $('hud-hearts').innerHTML = h;
    }
  }
  function pulseRestart(on) { $('hud-restart').classList.toggle('pulse', !!on); }

  // ---------- modals ----------
  var openModal = null;
  function modal(id, on) {
    $(id).hidden = !on;
    openModal = on ? id : (openModal === id ? null : openModal);
    if (on) {
      var f = $(id).querySelector('button');
      if (f) setTimeout(function () { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    }
  }
  function confirmBox(text) {
    return new Promise(function (resolve) {
      $('confirm-text').textContent = text;
      modal('modal-confirm', true);
      function done(v) { return function () { $('confirm-yes').onclick = $('confirm-no').onclick = null; modal('modal-confirm', false); resolve(v); }; }
      $('confirm-yes').onclick = done(true);
      $('confirm-no').onclick = done(false);
    });
  }

  // Result sheet. m = { title, line, stars: [{on,label}], stats: [[label, value, cls]], actions: [{id,label,cls}] } → resolves action id
  function result(m) {
    return new Promise(function (resolve) {
      $('res-title').textContent = m.title;
      $('res-line').textContent = m.line || '';
      var sh = '';
      (m.stars || []).forEach(function (s) { sh += '<div class="rstar' + (s.on ? ' on' : '') + '">' + icon(s.icon || 'star') + '<span>' + esc(s.label) + '</span></div>'; });
      $('res-stars').innerHTML = sh;
      var st = '';
      (m.stats || []).forEach(function (r) { st += '<dt>' + esc(r[0]) + '</dt><dd class="' + (r[2] || '') + '">' + esc(r[1]) + '</dd>'; });
      $('res-stats').innerHTML = st;
      var box = $('res-actions');
      box.innerHTML = '';
      var opened = DD.now();
      m.actions.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pipe ' + (a.cls || '');
        b.innerHTML = '<span>' + esc(a.label) + '</span>';
        b.onclick = function () {
          if (DD.now() - opened < 500) return;
          DD.Audio.play('ui');
          modal('modal-result', false);
          resolve(a.id);
        };
        box.appendChild(b);
      });
      modal('modal-result', true);
    });
  }
  function fmt(n) { return String(Math.floor(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- settings ----------
  var settingsClose = null;
  function buildLangGrid() {
    var g = $('lang-grid');
    g.innerHTML = '';
    DD.LANGS.forEach(function (code) {
      var b = document.createElement('button');
      b.type = 'button';
      b.lang = DD.LANG_TAGS[code];
      b.textContent = DD.I18N[code]['lang.name'];
      b.setAttribute('aria-pressed', String(code === DD.getLang()));
      b.onclick = function () { setLanguage(code); };
      g.appendChild(b);
    });
  }
  function setLanguage(code) {
    DD.setLang(code);
    DD.Save.data.lang = DD.getLang();
    DD.Save.save();
    applyLang();
    if (UI.onLanguage) UI.onLanguage();
  }
  function openSettings() {
    return new Promise(function (resolve) {
      var d = DD.Save.data;
      $('set-music').value = Math.round(d.music * 100);
      $('set-sfx').value = Math.round(d.sfx * 100);
      $('set-vibrate').checked = !!d.vibrate;
      $('set-dpad').checked = !!d.dpad;
      $('set-motion').checked = !!d.reduceMotion;
      buildLangGrid();
      settingsClose = resolve;
      modal('modal-settings', true);
    });
  }
  function bindSettings() {
    $('set-music').addEventListener('input', function (e) { DD.Save.data.music = e.target.value / 100; DD.Audio.setVolumes(DD.Save.data.music, DD.Save.data.sfx); });
    $('set-sfx').addEventListener('input', function (e) { DD.Save.data.sfx = e.target.value / 100; DD.Audio.setVolumes(DD.Save.data.music, DD.Save.data.sfx); });
    $('set-sfx').addEventListener('change', function () { DD.Audio.play('shard'); });
    $('set-vibrate').addEventListener('change', function (e) { DD.Save.data.vibrate = e.target.checked; if (e.target.checked) DD.vibrate(30); });
    $('set-dpad').addEventListener('change', function (e) { DD.Save.data.dpad = e.target.checked; $('dpad').hidden = !e.target.checked; });
    $('set-motion').addEventListener('change', function (e) { DD.Save.data.reduceMotion = e.target.checked; document.body.classList.toggle('reduce-motion', e.target.checked); });
    $('set-reset').addEventListener('click', function () {
      confirmBox(t('set.resetAsk')).then(function (yes) {
        if (!yes) return;
        DD.Save.reset();
        toast(t('set.resetDone'), 2000);
        if (UI.onReset) UI.onReset();
      });
    });
    $('set-close').addEventListener('click', function () {
      DD.Save.save();
      modal('modal-settings', false);
      DD.Audio.play('ui');
      var f = settingsClose; settingsClose = null;
      if (f) f();
    });
  }

  // ---------- stage select ----------
  function buildSelect(onPick, onEndless) {
    var root = $('chapters');
    root.innerHTML = '';
    var tot = DD.Save.totals();
    $('tot-stars').innerHTML = icon('star') + ' ' + esc(t('sel.stars', { n: tot.stars, t: tot.maxStars }));
    $('tot-marbles').innerHTML = icon('marble') + ' ' + esc(t('sel.marbles', { n: tot.marbles, t: tot.maxMarbles }));
    var firstOpen = null;
    DD.CHAPTERS.forEach(function (ch) {
      var sec = document.createElement('section');
      sec.className = 'chapter';
      var anyOpen = DD.Save.unlocked(ch.stages[0]);
      if (!anyOpen) sec.classList.add('locked');
      sec.innerHTML = '<div class="ch-head"><span class="ch-num">' + esc(t('sel.chapter', { n: ch.n })) + '</span><span class="ch-name">' + esc(t('ch.' + ch.n)) + '</span></div>';
      var tiles = document.createElement('div');
      tiles.className = 'tiles';
      ch.stages.forEach(function (id) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tile';
        var open = DD.Save.unlocked(id), s = DD.Save.stage(id);
        if (!open) {
          b.disabled = true;
          b.innerHTML = '<span class="num">' + id + '</span>' + icon('lock', 'lockico');
        } else {
          if (!s.clear && !firstOpen) { firstOpen = b; b.classList.add('next'); }
          b.innerHTML = '<span class="num">' + id + '</span>' +
            '<span class="stars">' + icon('star', s.clear ? 'on' : '') + icon('marble', 'mb' + (s.marble ? ' on' : '')) + icon('heart', 'hp' + (s.unhurt ? ' on' : '')) + '</span>' +
            (s.score ? '<span class="nm">' + s.score + '</span>' : '');
          b.onclick = function () { DD.Audio.play('ui'); onPick(id); };
        }
        b.setAttribute('aria-label', id + (open ? '' : ' — ' + t('sel.locked')));
        tiles.appendChild(b);
      });
      sec.appendChild(tiles);
      root.appendChild(sec);
    });
    var eb = $('sel-endless');
    var eo = DD.Save.endlessOpen();
    eb.disabled = !eo;
    $('sel-endless-sub').textContent = eo ? t('sel.best', { n: DD.Save.data.endlessBest }) + (DD.Save.data.endlessBestScore ? ' · ' + t('res.bestScore') + ' ' + fmt(DD.Save.data.endlessBestScore) : '') : t('sel.endlessLocked');
    eb.onclick = function () { if (!eb.disabled) { DD.Audio.play('ui'); onEndless(); } };
    return firstOpen;
  }

  function fatal() { $('fatal').hidden = false; }
  function syncMute() {
    var off = !!DD.Save.data.muted;
    $('mute-ico').innerHTML = ICONS[off ? 'soundOff' : 'soundOn'];
    $('p-mute-ico').innerHTML = ICONS[off ? 'soundOff' : 'soundOn'];
    $('btn-mute').classList.toggle('off', off);
    $('btn-mute').setAttribute('aria-pressed', String(!off));
    $('p-mute').classList.toggle('off', off);
  }
  function toggleMute() {
    DD.Save.data.muted = !DD.Save.data.muted;
    DD.Save.save();
    DD.Audio.unlock();
    DD.Audio.setMuted(DD.Save.data.muted);
    if (!DD.Save.data.muted) DD.Audio.play('ui');
    syncMute();
  }

  function init() {
    fillIcons();
    ['scr-narr', 'scr-dialog'].forEach(function (id) {
      $(id).addEventListener('click', onAdvance);
    });
    $('btn-skip').addEventListener('click', function (e) { e.stopPropagation(); DD.Audio.play('ui'); if (skipFn) { var f = skipFn; skipFn = null; f(); } });
    bindSettings();
    applyLang();
    $('btn-mute').addEventListener('click', toggleMute);
    $('p-mute').addEventListener('click', toggleMute);
    syncMute();
  }

  var UI = {
    init: init, show: show, hideScreens: hideScreens, applyLang: applyLang, setLanguage: setLanguage,
    narrate: narrate, dialog: dialog, choice: choice, toast: toast, clearToast: clearToast, card: card,
    showHud: showHud, updateHud: updateHud, pulseRestart: pulseRestart,
    modal: modal, confirm: confirmBox, result: result, openSettings: openSettings, buildSelect: buildSelect,
    advance: onAdvance, hasWaiter: function () { return !!waiter; }, modalOpen: function () { return openModal; },
    icon: icon, fatal: fatal, sleep: sleep, fmt: fmt,
    onLanguage: null, onReset: null
  };
  DD.UI = UI;
})();
