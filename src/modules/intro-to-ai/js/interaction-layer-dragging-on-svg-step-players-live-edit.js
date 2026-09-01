  /* ============================================================
     INTERACTION LAYER — dragging on SVG, step players, live edit
     Shared by the K-means, hierarchical, grid-world and fitting tools.
     ============================================================ */
  const IX = {};
  /* Map a mouse/touch event to user coordinates inside an SVG that was
     laid out with width:100% and a fixed viewBox (so it may be letterboxed). */
  IX.svgXY = function (svg, ev, W, H) {
    const r = svg.getBoundingClientRect();
    const cx = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX);
    const cy = (ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY);
    /* A detached node reports a zero box. Mapping against it produces negative
       offsets and pins everything to a corner, so refuse rather than guess. */
    if (!r.width || !r.height) return null;
    const sc = Math.min(r.width / W, r.height / H) || 1;
    const ox = (r.width - W * sc) / 2, oy = (r.height - H * sc) / 2;
    return { x: (cx - r.left - ox) / sc, y: (cy - r.top - oy) / sc };
  };
  /* Attach a drag handler. onMove(dataX, dataY, key) fires continuously;
     onDrop() fires once at the end. Handles mouse and touch. */
  IX._dragOpts = {};
  IX._dragActive = null;
  IX._dragBound = false;
  IX._dragSeq = 0;
  IX.drag = function (svg, opts) {
    if (!svg) return;
    /* Every render replaces the SVG element. Key the handler off the element's
       id and resolve it live at event time — closing over the node means the
       drag keeps talking to a detached copy after the first re-render. */
    if (!svg.id) svg.id = 'ix-svg-' + (++IX._dragSeq);
    const id = svg.id;
    IX._dragOpts[id] = opts;
    const start = function (ev) {
      const t = ev.target;
      if (!t || !t.getAttribute) return;
      const key = t.getAttribute('data-ix');
      if (key === null) {
        if (opts.onBlank) {
          const p = IX.svgXY(svg, ev, opts.W, opts.H);
          if (p && opts.onBlank(p.x, p.y, ev)) { ev.preventDefault(); }
        }
        return;
      }
      if (ev.shiftKey || ev.altKey) {
        if (opts.onRemove) { opts.onRemove(key); ev.preventDefault(); }
        return;
      }
      IX._dragActive = { id: id, key: key };
      ev.preventDefault();
    };
    svg.addEventListener('mousedown', start);
    svg.addEventListener('touchstart', start, { passive: false });
    svg.addEventListener('contextmenu', function (ev) {
      const key = ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-ix') : null;
      if (key !== null && opts.onRemove) { ev.preventDefault(); opts.onRemove(key); }
    });
    /* window-level listeners are bound exactly once for the whole page */
    if (IX._dragBound) return;
    IX._dragBound = true;
    const move = function (ev) {
      const a = IX._dragActive;
      if (!a) return;
      const el = document.getElementById(a.id), o = IX._dragOpts[a.id];
      if (!el || !o) { IX._dragActive = null; return; }
      const p = IX.svgXY(el, ev, o.W, o.H);
      if (!p) return;
      o.onMove(p.x, p.y, a.key);
      ev.preventDefault();
    };
    const end = function () {
      const a = IX._dragActive;
      if (!a) return;
      IX._dragActive = null;
      const o = IX._dragOpts[a.id];
      if (o && o.onDrop) o.onDrop();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
  };
  /* A reusable transport bar: ⏮ ◀ ▶ ⏭, play/pause, scrubber. */
  IX.player = function (id, frame, total, label, phase) {
    const at0 = frame <= 0, atEnd = frame >= total - 1;
    return `<div class="ix-bar transport">
      <button class="ix-btn nav" onclick="${id}Step('first')" ${at0 ? 'disabled' : ''} title="First step">⏮</button>
      <button class="ix-btn nav" onclick="${id}Step(-1)" ${at0 ? 'disabled' : ''} title="Previous step">◀</button>
      <button class="ix-btn play" onclick="${id}Step('play')">${IX.playing[id] ? '❚❚ pause' : '▶ play'}</button>
      <button class="ix-btn nav" onclick="${id}Step(1)" ${atEnd ? 'disabled' : ''} title="Next step">▶</button>
      <button class="ix-btn nav" onclick="${id}Step('last')" ${atEnd ? 'disabled' : ''} title="Last step">⏭</button>
      <span class="ix-lab">${label}</span>
      ${phase ? `<span class="ix-phase ${phase[0]}">${phase[1]}</span>` : ''}
      <input type="range" min="0" max="${Math.max(0, total - 1)}" value="${frame}"
             oninput="${id}Step(Number(this.value), true)" aria-label="Step through the algorithm">
      ${IX.revealSeg()}
    </div>`;
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
  IX.playing = {};
  IX.timers = {};
  IX.play = function (id, total, getFrame, setFrame, ms) {
    if (IX.playing[id]) { IX.stop(id); return; }
    IX.playing[id] = true;
    IX.timers[id] = setInterval(function () {
      const f = getFrame();
      if (f >= total - 1) { IX.stop(id); setFrame(f); return; }
      setFrame(f + 1);
    }, ms || 900);
  };
  IX.stop = function (id) {
    IX.playing[id] = false;
    if (IX.timers[id]) { clearInterval(IX.timers[id]); IX.timers[id] = null; }
  };
  /* deterministic force-directed layout for small graphs */
  IX.layout = function (names, adj, W, H) {
    const n = names.length, idx = {};
    names.forEach((v, i) => idx[v] = i);
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const p = names.map((v, i) => {
      const a = 2 * Math.PI * i / n;
      return { x: W / 2 + Math.cos(a) * W * 0.3 + (rnd() - 0.5) * 20, y: H / 2 + Math.sin(a) * H * 0.3 + (rnd() - 0.5) * 20 };
    });
    const k = Math.sqrt((W * H) / Math.max(1, n)) * 0.7;
    for (let it = 0; it < 240; it++) {
      const t = k * 0.1 * (1 - it / 240) + 0.5;
      const dx = new Array(n).fill(0), dy = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let ex = p[i].x - p[j].x, ey = p[i].y - p[j].y;
        const dd = Math.sqrt(ex * ex + ey * ey) || 0.01, rep = (k * k) / dd;
        ex /= dd; ey /= dd;
        dx[i] += ex * rep; dy[i] += ey * rep; dx[j] -= ex * rep; dy[j] -= ey * rep;
      }
      names.forEach((v, i) => (adj[v] || []).forEach(e => {
        const j = idx[e.to];
        if (j === undefined || j <= i) return;
        let ex = p[i].x - p[j].x, ey = p[i].y - p[j].y;
        const dd = Math.sqrt(ex * ex + ey * ey) || 0.01, att = (dd * dd) / k;
        ex /= dd; ey /= dd;
        dx[i] -= ex * att; dy[i] -= ey * att; dx[j] += ex * att; dy[j] += ey * att;
      }));
      for (let i = 0; i < n; i++) {
        const dd = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
        p[i].x += (dx[i] / dd) * Math.min(dd, t);
        p[i].y += (dy[i] / dd) * Math.min(dd, t);
        p[i].x = Math.max(30, Math.min(W - 30, p[i].x));
        p[i].y = Math.max(30, Math.min(H - 38, p[i].y));
      }
    }
    const out = {};
    names.forEach((v, i) => out[v] = { x: p[i].x, y: p[i].y });
    return out;
  };
  IX.snap = function (v, on) { return on ? Math.round(v) : Math.round(v * 100) / 100; };
  IX.toggles = function (items) {
    return items.map(t => `<label class="ix-tog"><input type="checkbox" ${t.on ? 'checked' : ''} onchange="${t.fn}"> ${t.label}</label>`).join('');
  };
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
