  /* ============================================================
     INTERACTION LAYER
     A tiny shared toolkit: SVG dragging, a transport bar, and a
     generic "step through anything tagged data-step" player.
     ============================================================ */
  var IX = {};
  IX.svgXY = function (svg, ev, W, H) {
    var r = svg.getBoundingClientRect();
    var cx = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX);
    var cy = (ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY);
    var sc = Math.min(r.width / W, r.height / H) || 1;
    var ox = (r.width - W * sc) / 2, oy = (r.height - H * sc) / 2;
    return { x: (cx - r.left - ox) / sc, y: (cy - r.top - oy) / sc };
  };
  IX.drag = function (svg, opts) {
    var active = null;
    function start(ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var key = t.getAttribute('data-ix');
      if (key === null) {
        if (opts.onBlank) { var p = IX.svgXY(svg, ev, opts.W, opts.H); if (opts.onBlank(p.x, p.y, ev)) ev.preventDefault(); }
        return;
      }
      if (ev.shiftKey || ev.altKey) { if (opts.onRemove) { opts.onRemove(key); ev.preventDefault(); } return; }
      active = key; ev.preventDefault();
    }
    function move(ev) {
      if (active === null) return;
      var p = IX.svgXY(svg, ev, opts.W, opts.H);
      opts.onMove(p.x, p.y, active); ev.preventDefault();
    }
    function end() { if (active === null) return; active = null; if (opts.onDrop) opts.onDrop(); }
    svg.addEventListener('mousedown', start);
    svg.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
  };
  IX.playing = {};
  IX.timers = {};
  IX.play = function (id, total, getFrame, setFrame, ms) {
    if (IX.playing[id]) { IX.stop(id); return; }
    IX.playing[id] = true;
    IX.timers[id] = setInterval(function () {
      var f = getFrame();
      if (f >= total - 1) { IX.stop(id); setFrame(f); return; }
      setFrame(f + 1);
    }, ms || 800);
  };
  IX.stop = function (id) {
    IX.playing[id] = false;
    if (IX.timers[id]) { clearInterval(IX.timers[id]); IX.timers[id] = null; }
  };
  IX.player = function (id, frame, total, label, phase) {
    var at0 = frame <= 0, atEnd = frame >= total - 1;
    return '<div class="ix-bar transport">'
      + '<button class="ix-btn nav" onclick="' + id + 'Step(\'first\')" ' + (at0 ? 'disabled' : '') + ' title="First step">⏮</button>'
      + '<button class="ix-btn nav" onclick="' + id + 'Step(-1)" ' + (at0 ? 'disabled' : '') + ' title="Previous step">◀</button>'
      + '<button class="ix-btn play" onclick="' + id + 'Step(\'play\')">' + (IX.playing[id] ? '❚❚ pause' : '▶ play') + '</button>'
      + '<button class="ix-btn nav" onclick="' + id + 'Step(1)" ' + (atEnd ? 'disabled' : '') + ' title="Next step">▶</button>'
      + '<button class="ix-btn nav" onclick="' + id + 'Step(\'last\')" ' + (atEnd ? 'disabled' : '') + ' title="Last step">⏭</button>'
      + '<span class="ix-lab">' + label + '</span>'
      + (phase ? '<span class="ix-phase ' + phase[0] + '">' + phase[1] + '</span>' : '')
      + '<input type="range" min="0" max="' + Math.max(0, total - 1) + '" value="' + frame + '"'
      + ' oninput="' + id + 'Step(Number(this.value), true)" aria-label="Step through">'
      + IX.revealSeg()
      + '</div>';
  };
  /* How much of what lies ahead is visible: dimmed, hidden, or all of it. */
  IX.reveal = 'dim';
  IX.setReveal = function (m) {
    IX.reveal = m;
    try { localStorage.setItem('ix-reveal', m); } catch (e) {}
    var b = document.body;
    b.classList.remove('ix-mode-dim', 'ix-mode-hide', 'ix-mode-all');
    b.classList.add('ix-mode-' + m);
    var segs = document.querySelectorAll('.ix-seg[data-seg="reveal"] button');
    for (var i = 0; i < segs.length; i++) segs[i].className = (segs[i].getAttribute('data-m') === m) ? 'on' : '';
  };
  IX.revealSeg = function () {
    var m = IX.reveal;
    var out = '<span class="ix-lab">ahead</span><span class="ix-seg" data-seg="reveal">';
    ['dim', 'hide', 'all'].forEach(function (k) {
      out += '<button data-m="' + k + '" class="' + (m === k ? 'on' : '') + '" onclick="IX.setReveal(\'' + k + '\')">' + k + '</button>';
    });
    return out + '</span>';
  };
  IX.initReveal = function () {
    var m = 'dim';
    try { m = localStorage.getItem('ix-reveal') || 'dim'; } catch (e) {}
    IX.setReveal(m);
  };
  IX.toggles = function (items) {
    return items.map(function (t) {
      return '<label class="ix-tog"><input type="checkbox" ' + (t.on ? 'checked' : '') + ' onchange="' + t.fn + '"> ' + t.label + '</label>';
    }).join('');
  };
  /* ------------------------------------------------------------
     Generic trace player.
     A tool renders rows carrying data-step="k". Call ixTrace(id,
     outputId, {label, reset}) at the end of its render and it gets
     ⏮ ◀ ▶ ⏭, play and a scrubber for free — no recompute per step.
     ------------------------------------------------------------ */
  IX.frames = {};
  IX.hosts = {};
  function ixTrace(id, outId, opts) {
    opts = opts || {};
    var out = document.getElementById(outId);
    if (!out) return;
    var rows = out.querySelectorAll('[data-step]');
    if (!rows.length) { IX.frames[id] = 0; return; }
    var total = 0;
    for (var q = 0; q < rows.length; q++) total = Math.max(total, Number(rows[q].getAttribute('data-step')) + 1);
    IX.hosts[id] = { outId: outId, label: opts.label || 'step', total: total, unit: opts.unit || '' };
    var f = IX.frames[id];
    if (opts.reset || f === undefined || f > total - 1) f = total - 1;
    IX.frames[id] = f;
    var bar = document.createElement('div');
    bar.id = id + '-ixbar';
    out.insertBefore(bar, out.firstChild);
    ixPaint(id);
  }
  function ixPaint(id) {
    var h = IX.hosts[id];
    if (!h) return;
    var out = document.getElementById(h.outId);
    if (!out) return;
    var rows = out.querySelectorAll('[data-step]');
    var f = IX.frames[id];
    var cur = null;
    for (var i = 0; i < rows.length; i++) {
      var k = Number(rows[i].getAttribute('data-step'));
      if (k > f) rows[i].classList.add('ix-future'); else rows[i].classList.remove('ix-future');
      if (k === f) { rows[i].classList.add('ix-now'); cur = rows[i]; } else rows[i].classList.remove('ix-now');
    }
    var bar = document.getElementById(id + '-ixbar');
    if (bar) {
      bar.innerHTML = IX.player(id, f, h.total,
        h.label + ' <strong>' + (f + 1) + '</strong> of ' + h.total + (h.unit ? ' ' + h.unit : ''), null);
    }
    if (cur && cur.scrollIntoView && IX.playing[id]) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function ixStep(id, d, fromSlider) {
    var h = IX.hosts[id];
    if (!h) return;
    if (d === 'play') { IX.play(id, h.total, function () { return IX.frames[id]; },
      function (f) { IX.frames[id] = f; ixPaint(id); }, 650); ixPaint(id); return; }
    IX.stop(id);
    if (d === 'first') IX.frames[id] = 0;
    else if (d === 'last') IX.frames[id] = h.total - 1;
    else if (typeof d === 'number' && fromSlider) IX.frames[id] = d;
    else IX.frames[id] = Math.max(0, Math.min(h.total - 1, IX.frames[id] + d));
    ixPaint(id);
  }
  /* per-tool step entry points for the shared trace player */
  function smTStep(d, s) { ixStep('smT', d, s); }
  function ssTStep(d, s) { ixStep('ssT', d, s); }
  function unTStep(d, s) { ixStep('unT', d, s); }
  function pmTStep(d, s) { ixStep('pmT', d, s); }
  function rdTStep(d, s) { ixStep('rdT', d, s); }
  function plTStep(d, s) { ixStep('plT', d, s); }
  function ptTStep(d, s) { ixStep('ptT', d, s); }
  function loTStep(d, s) { ixStep('loT', d, s); }
  function feTStep(d, s) { ixStep('feT', d, s); }
  function cuTStep(d, s) { ixStep('cuT', d, s); }
  function bsTStep(d, s) { ixStep('bsT', d, s); }
  function sfTStep(d, s) { ixStep('sfT', d, s); }
  function tyTStep(d, s) { ixStep('tyT', d, s); }
  function sdTStep(d, s) { ixStep('sdT', d, s); }
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
        var fields = tool.querySelectorAll('input[type="text"], input[type="number"], input:not([type]), textarea');
        for (var j = 0; j < fields.length; j++) {
          var f = fields[j];
          if (f.getAttribute('data-nolive') !== null) continue;
          f.addEventListener('input', function () {
            if (!IX.liveOn) return;
            if (IX.liveTimers[name]) clearTimeout(IX.liveTimers[name]);
            IX.liveTimers[name] = setTimeout(function () {
              var fn = TOOL_RUNNERS[name];
              if (typeof fn !== 'function') return;
              try { IX.stop(name); fn(); } catch (e) { /* keep typing */ }
            }, 300);
          });
        }
        var sels = tool.querySelectorAll('select');
        for (var q = 0; q < sels.length; q++) {
          if (sels[q].getAttribute('onchange')) continue;
          if (sels[q].getAttribute('data-nolive') !== null) continue;
          sels[q].addEventListener('change', function () {
            var fn = TOOL_RUNNERS[name];
            if (typeof fn === 'function') { try { IX.stop(name); fn(); } catch (e) {} }
          });
        }
      })(tools[i]);
    }
  }
  function showWeek(id) {
    document.querySelectorAll('.week-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) { target.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }
