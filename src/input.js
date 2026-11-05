/* Daedalus Dream — touch, mouse and keyboard.
 * Swipe to run, keep the finger down to keep steering, tap to spin a joint or walk to a seen spot.
 */
(function () {
  'use strict';
  var DD = (globalThis.DD = globalThis.DD || {});

  var SWIPE = 22;     // px before a drag counts as a direction
  var TAP = 12;       // px a tap may wander
  var active = null;  // { id, x0, y0, ax, ay, t0, dir, moved }
  var handlers = null;

  function dirOf(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
    return dy > 0 ? 2 : 0;
  }

  function init(canvas, h) {
    handlers = h;
    canvas.addEventListener('pointerdown', function (e) {
      DD.Audio.unlock();
      if (!h.enabled()) return;
      if (active && active.id !== e.pointerId) return; // ignore a second finger
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      active = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ax: e.clientX, ay: e.clientY, t0: DD.now(), dir: -1, moved: false };
    }, { passive: false });

    canvas.addEventListener('pointermove', function (e) {
      if (!active || active.id !== e.pointerId) return;
      e.preventDefault();
      var dx = e.clientX - active.ax, dy = e.clientY - active.ay;
      if (Math.hypot(e.clientX - active.x0, e.clientY - active.y0) > TAP) active.moved = true;
      if (Math.hypot(dx, dy) < SWIPE) return;
      var d = dirOf(dx, dy);
      // re-anchor so the same finger can steer again in another direction
      active.ax = e.clientX; active.ay = e.clientY;
      if (d !== active.dir) {
        active.dir = d;
        if (h.enabled()) h.hold(d);
      }
    }, { passive: false });

    function end(e) {
      if (!active || active.id !== e.pointerId) return;
      var a = active;
      active = null;
      if (h.enabled()) {
        if (!a.moved && DD.now() - a.t0 < 450) h.tap(e.clientX, e.clientY);
        h.release();
      }
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', function (e) { if (active && active.id === e.pointerId) { active = null; h.release(); } });
    canvas.addEventListener('lostpointercapture', function (e) { if (active && active.id === e.pointerId) { active = null; h.release(); } });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // On-screen arrows
    document.querySelectorAll('.dp').forEach(function (b) {
      var d = +b.getAttribute('data-dir');
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); DD.Audio.unlock();
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        b.classList.add('active');
        if (h.enabled()) h.hold(d);
      });
      var up = function () { b.classList.remove('active'); h.release(d); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    var KEYS = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
    window.addEventListener('keydown', function (e) {
      DD.Audio.unlock();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (h.key && h.key(e)) { e.preventDefault(); return; }
      if (!h.enabled()) return;
      if (e.code in KEYS) {
        e.preventDefault();
        if (!e.repeat) h.hold(KEYS[e.code]);
      } else if (e.code === 'Space' || e.code === 'Enter') {
        if (e.target && e.target.tagName === 'BUTTON') return;
        e.preventDefault(); if (!e.repeat) h.action();
      } else if (e.code === 'KeyZ') { h.zoom(); }
      else if (e.code === 'KeyR') { h.restart(); }
    });
    window.addEventListener('keyup', function (e) {
      if (e.code in KEYS) h.release(KEYS[e.code]);
    });
    window.addEventListener('blur', function () { active = null; h.release(); });
  }

  function cancel() { active = null; }

  DD.Input = { init: init, cancel: cancel };
})();
