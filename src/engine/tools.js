  /* ============================================================
     TOOLS — registry, reset, live inputs, boot
     ============================================================ */

  /**
   * Every interactive tool is a `<div class="tool" data-run="fnName">`.
   * `fnName` is looked up here first and on `window` second, so a tool
   * declared as a plain top-level `function` needs no registration, and one
   * defined inside a closure can opt in with TOOL_RUNNERS.fnName = fn.
   */
  var TOOL_RUNNERS = {};

  function toolFn(name) {
    var fn = TOOL_RUNNERS[name];
    if (typeof fn === 'function') return fn;
    fn = window[name];
    return typeof fn === 'function' ? fn : null;
  }

  /* Snapshot every input on load so "Reset tool" restores the inputs the
     reader first saw, not just the output pane. */
  var TOOL_DEFAULTS = new WeakMap();

  function snapshotTools() {
    var tools = document.querySelectorAll('.tool');
    for (var i = 0; i < tools.length; i++) {
      var fields = [], els = tools[i].querySelectorAll('input, textarea, select');
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        fields.push({ el: el, v: (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value });
      }
      TOOL_DEFAULTS.set(tools[i], fields);
    }
  }

  function toolReset(btn) {
    var t = btn.closest('.tool');
    if (!t) return;
    var fields = TOOL_DEFAULTS.get(t);
    if (fields) {
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        if (f.el.type === 'checkbox' || f.el.type === 'radio') f.el.checked = f.v;
        else f.el.value = f.v;
      }
    }
    var name = t.getAttribute('data-run');
    if (name) IX.stop(name);
    var fn = name ? toolFn(name) : null;
    if (fn) fn();
    if (t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ------------------------------------------------------------
     LIVE INPUTS
     Every .tool[data-run] re-runs itself ~300 ms after you stop
     typing, so editing a program, a grid or a set of points shows
     its consequences immediately. Errors are shown, not thrown.
     ------------------------------------------------------------ */
  IX.liveTimers = {};
  IX.liveOn = true;

  function ixLive() {
    var tools = document.querySelectorAll('.tool[data-run]');
    for (var i = 0; i < tools.length; i++) {
      (function (tool) {
        var name = tool.getAttribute('data-run');
        var rerun = function () {
          var fn = toolFn(name);
          if (!fn) return;
          try { IX.stop(name); fn(); } catch (e) { /* mid-edit input is expected to be invalid */ }
        };

        var fields = tool.querySelectorAll('input[type="text"], input[type="number"], input:not([type]), textarea');
        for (var j = 0; j < fields.length; j++) {
          if (fields[j].getAttribute('data-nolive') !== null) continue;
          fields[j].addEventListener('input', function () {
            if (!IX.liveOn) return;
            if (IX.liveTimers[name]) clearTimeout(IX.liveTimers[name]);
            IX.liveTimers[name] = setTimeout(rerun, 300);
          });
        }

        var sels = tool.querySelectorAll('select');
        for (var q = 0; q < sels.length; q++) {
          if (sels[q].getAttribute('onchange')) continue;
          if (sels[q].getAttribute('data-nolive') !== null) continue;
          sels[q].addEventListener('change', rerun);
        }

        // Say that the tool is live.
        //
        // Most tools used to carry a button whose only job was to run them
        // again. They were removed, because the tool had already re-run by the
        // time anyone could press one. That leaves a reader wondering what to
        // press, so tell them: nothing. Added here rather than written into
        // every tool, so it cannot drift out of step with the behaviour.
        if (fields.length) {
          var controls = tool.querySelectorAll('.tool-controls');
          var last = controls[controls.length - 1];
          if (last && !tool.querySelector('.tool-live')) {
            var note = document.createElement('div');
            note.className = 'tool-live';
            note.textContent = 'Updates as you type.';
            last.parentNode.insertBefore(note, last.nextSibling);
          }
        }

        // Acknowledge every re-render, even when nothing changed.
        //
        // Because tools are live, pressing "Run" usually recomputes an
        // identical answer and replaces the output with the same HTML. The
        // tool did exactly what it was asked; it just left no trace, so the
        // button reads as broken. Watching the output pane for replaced
        // children catches every re-render — from a click, a keystroke or a
        // reset — and flashes it, which is the difference between "nothing
        // happened" and "nothing changed".
        var pane = tool.querySelector('.tool-output');
        if (pane && typeof MutationObserver === 'function') {
          var clear = null;
          new MutationObserver(function () {
            pane.classList.remove('just-ran');
            void pane.offsetWidth;                 // restart the animation
            pane.classList.add('just-ran');
            if (clear) clearTimeout(clear);
            clear = setTimeout(function () { pane.classList.remove('just-ran'); }, 700);
          }).observe(pane, { childList: true });
        }
      })(tools[i]);
    }
  }

  /**
   * Render every tool once, in document order.
   *
   * This used to be a hand-written list of calls per module, which meant a new
   * tool silently rendered blank until someone remembered to add it to the
   * list. Walking the DOM cannot forget. Failures are collected rather than
   * thrown, so one broken tool does not take the page down — and the test
   * suite asserts the list is empty, so they stay loud where it matters.
   */
  var TOOL_BOOT_ERRORS = [];

  function toolBoot() {
    var tools = document.querySelectorAll('.tool[data-run]');
    for (var i = 0; i < tools.length; i++) {
      var name = tools[i].getAttribute('data-run');
      var fn = toolFn(name);
      if (!fn) { TOOL_BOOT_ERRORS.push(name + ': no such runner'); continue; }
      try { fn(); } catch (e) { TOOL_BOOT_ERRORS.push(name + ': ' + e.message); }
    }
  }
