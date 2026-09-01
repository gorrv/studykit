  /* ============================================================
     W4 · MDPs — grid worlds and value iteration
     ============================================================ */
  const MDP_ACTS = [
    { name: 'Up', arrow: '↑', d: [0, 1] },
    { name: 'Down', arrow: '↓', d: [0, -1] },
    { name: 'Left', arrow: '←', d: [-1, 0] },
    { name: 'Right', arrow: '→', d: [1, 0] }
  ];
  function mdpPerp(d) { return [[-d[1], d[0]], [d[1], -d[0]]]; }
  function mdpParse(text) {
    const rows = String(text).split(/\n/).map(l => l.trim()).filter(l => l.length);
    const errs = [];
    if (!rows.length) return { errs: ['The grid is empty.'] };
    const cells = rows.map(l => l.split(/\s+/));
    const W = Math.max.apply(null, cells.map(r => r.length));
    cells.forEach((r, i) => { if (r.length !== W) errs.push(`row ${i + 1} has ${r.length} cells but row 1 has ${W}`); });
    const H = cells.length;
    // grid[x][y] with y=0 at the BOTTOM row (so (1,1) is bottom-left, matching the slides)
    const g = [];
    for (let x = 0; x < W; x++) { g[x] = []; for (let y = 0; y < H; y++) g[x][y] = null; }
    let start = null;
    for (let i = 0; i < H; i++) {
      const y = H - 1 - i;
      for (let x = 0; x < (cells[i] || []).length; x++) {
        const c = cells[i][x];
        if (c === '#') { g[x][y] = { wall: true }; continue; }
        if (c === '.' || c === '_') { g[x][y] = { wall: false, term: false }; continue; }
        if (c.toUpperCase() === 'S') { g[x][y] = { wall: false, term: false }; start = [x, y]; continue; }
        const n = parseFloat(c);
        if (isNaN(n)) { errs.push(`"${c}" at row ${i + 1}, column ${x + 1} — use . for a normal square, # for a wall, or a number for a terminal`); g[x][y] = { wall: false, term: false }; continue; }
        g[x][y] = { wall: false, term: true, r: n };
      }
      for (let x = (cells[i] || []).length; x < W; x++) g[x][y] = { wall: true };
    }
    return { g: g, W: W, H: H, start: start, errs: errs };
  }
  function mdpMove(G, x, y, d) {
    const nx = x + d[0], ny = y + d[1];
    if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H) return [x, y];
    if (G.g[nx][ny].wall) return [x, y];
    return [nx, ny];
  }
  function mdpOutcomes(G, x, y, act, pMain) {
    const pSide = (1 - pMain) / 2;
    const res = {};
    const add = (p, c) => { const k = c[0] + ',' + c[1]; res[k] = (res[k] || 0) + p; };
    add(pMain, mdpMove(G, x, y, act.d));
    mdpPerp(act.d).forEach(pd => add(pSide, mdpMove(G, x, y, pd)));
    return Object.keys(res).map(k => { const p = k.split(','); return { x: +p[0], y: +p[1], p: res[k] }; })
      .sort((a, b) => b.p - a.p);
  }
  function mdpEU(G, U, x, y, act, pMain) {
    let s = 0;
    mdpOutcomes(G, x, y, act, pMain).forEach(o => { s += o.p * U[o.x][o.y]; });
    return s;
  }
  function mdpZeroU(G) {
    const U = [];
    for (let x = 0; x < G.W; x++) { U[x] = []; for (let y = 0; y < G.H; y++) U[x][y] = G.g[x][y].term ? G.g[x][y].r : 0; }
    return U;
  }
  function mdpCopyU(U) { return U.map(c => c.slice()); }
  /* Stopping rule follows Russell & Norvig: δ < ε(1−γ)/γ. With γ = 1 that
     degenerates to 0, so we fall back to a small absolute threshold. */
  function mdpThreshold(gamma, eps) {
    const e = (eps === undefined ? 1e-4 : eps);
    return gamma < 1 ? e * (1 - gamma) / gamma : 1e-9;
  }
  function mdpVI(G, R, gamma, pMain, eps, maxIter) {
    const thresh = mdpThreshold(gamma, eps);
    let U = mdpZeroU(G);
    const hist = [mdpCopyU(U)];
    const deltas = [];
    let it = 0, diverged = false;
    const CAP = maxIter || 2000;
    for (; it < CAP; it++) {
      const U2 = mdpCopyU(U);
      let delta = 0;
      for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) {
        const c = G.g[x][y];
        if (c.wall || c.term) continue;
        let best = -Infinity;
        MDP_ACTS.forEach(a => { const v = mdpEU(G, U, x, y, a, pMain); if (v > best) best = v; });
        U2[x][y] = R + gamma * best;
        const d = Math.abs(U2[x][y] - U[x][y]);
        if (d > delta) delta = d;
      }
      U = U2;
      hist.push(mdpCopyU(U));
      deltas.push(delta);
      if (!isFinite(delta) || Math.abs(delta) > 1e12) { diverged = true; it++; break; }
      if (delta < thresh) { it++; break; }
    }
    const last = deltas.length ? deltas[deltas.length - 1] : 0;
    const converged = !diverged && last < thresh;
    return { U: U, hist: hist, iters: it, deltas: deltas, thresh: thresh,
      diverged: diverged || (!converged && last > thresh * 100),
      capped: !converged && !diverged && last <= thresh * 100 };
  }
  function mdpPolicy(G, U, pMain) {
    const P = [];
    for (let x = 0; x < G.W; x++) { P[x] = []; for (let y = 0; y < G.H; y++) P[x][y] = null; }
    for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) {
      const c = G.g[x][y];
      if (c.wall || c.term) continue;
      let best = -Infinity, bi = 0;
      MDP_ACTS.forEach((a, i) => { const v = mdpEU(G, U, x, y, a, pMain); if (v > best + 1e-12) { best = v; bi = i; } });
      P[x][y] = MDP_ACTS[bi];
    }
    return P;
  }
  function mdpFmt(v, dp) { const n = Number(v); if (!isFinite(n)) return '∞'; return n.toFixed(dp === undefined ? 3 : dp); }
  function mdpGridHtml(G, opts) {
    // opts: {U, P, label, dp, hot:[x,y], showStart}
    let h = '<div class="gw-unit">';
    if (opts.label) h += `<div class="gw-label">${opts.label}</div>`;
    h += '<table class="gw">';
    for (let i = 0; i < G.H; i++) {
      const y = G.H - 1 - i;
      h += '<tr>';
      for (let x = 0; x < G.W; x++) {
        const c = G.g[x][y];
        const hot = opts.hot && opts.hot[0] === x && opts.hot[1] === y ? ' hot' : '';
        if (c.wall) { h += `<td class="wall${hot}"></td>`; continue; }
        if (c.term) {
          h += `<td class="${c.r >= 0 ? 'term-pos' : 'term-neg'}${hot}">${c.r > 0 ? '+' : ''}${c.r}</td>`;
          continue;
        }
        const isStart = opts.showStart && G.start && G.start[0] === x && G.start[1] === y;
        if (opts.P) {
          const a = opts.P[x][y];
          h += `<td class="arrow${hot}">${a ? a.arrow : '·'}${isStart ? '<span class="sub">start</span>' : ''}</td>`;
        } else {
          h += `<td class="${hot}">${mdpFmt(opts.U[x][y], opts.dp)}${isStart ? '<span class="sub">start</span>' : ''}</td>`;
        }
      }
      h += '</tr>';
    }
    return h + '</table></div>';
  }
  function mdpRead(id, dflt) {
    const el = document.getElementById(id);
    if (!el) return dflt;
    const v = parseFloat(el.value);
    return isNaN(v) ? dflt : v;
  }
  function mdpSetup() {
    const G = mdpParse(document.getElementById('vi-grid').value);
    return { G: G, R: mdpRead('vi-r', -0.04), gamma: mdpRead('vi-g', 1), pMain: mdpRead('vi-p', 0.8) };
  }
  /* ---------- Grid world: paintable cells, live sliders, sweep player ---------- */
  const VI = { G: null, R: -0.04, gamma: 1, pMain: 0.8, frame: 0, res: null, paint: 'wall', pol: true };
  const VI_PAINTS = [
    { k: 'wall', label: '▪ wall' },
    { k: 'norm', label: '□ normal' },
    { k: 'pos', label: '+1 goal' },
    { k: 'neg', label: '−1 trap' },
    { k: 'start', label: '★ start' }
  ];
  function viGridText() {
    const G = VI.G;
    const rows = [];
    for (let i = 0; i < G.H; i++) {
      const y = G.H - 1 - i, r = [];
      for (let x = 0; x < G.W; x++) {
        const c = G.g[x][y];
        if (c.wall) r.push('#');
        else if (c.term) r.push((c.r > 0 ? '+' : '') + c.r);
        else if (G.start && G.start[0] === x && G.start[1] === y) r.push('S');
        else r.push('.');
      }
      rows.push(r.join('  '));
    }
    return rows.join('\n');
  }
  function viSync() {
    const el = document.getElementById('vi-grid');
    if (el) el.value = viGridText();
    const r = document.getElementById('vi-r'), g = document.getElementById('vi-g'), p = document.getElementById('vi-p');
    if (r) r.value = VI.R; if (g) g.value = VI.gamma; if (p) p.value = VI.pMain;
  }
  function viCompute() {
    VI.res = mdpVI(VI.G, VI.R, VI.gamma, VI.pMain, 1e-4, 3000);
    const total = VI.res.hist.length;
    if (VI.frame > total - 1) VI.frame = total - 1;
  }
  function viPaint(x, y) {
    const G = VI.G, c = G.g[x][y];
    const mode = VI.paint;
    if (mode === 'wall') { G.g[x][y] = c.wall ? { wall: false, term: false } : { wall: true }; }
    else if (mode === 'norm') { G.g[x][y] = { wall: false, term: false }; }
    else if (mode === 'pos') { G.g[x][y] = c.term && c.r > 0 ? { wall: false, term: false } : { wall: false, term: true, r: 1 }; }
    else if (mode === 'neg') { G.g[x][y] = c.term && c.r < 0 ? { wall: false, term: false } : { wall: false, term: true, r: -1 }; }
    else if (mode === 'start') {
      if (c.wall || c.term) return;
      G.start = (G.start && G.start[0] === x && G.start[1] === y) ? null : [x, y];
    }
    if (G.start && (G.g[G.start[0]][G.start[1]].wall || G.g[G.start[0]][G.start[1]].term)) G.start = null;
    IX.stop('vi'); VI.frame = 0; viSync(); viCompute(); viRender();
  }
  function viSetPaint(k) { VI.paint = k; viRender(); }
  function viResize(dw, dh) {
    const G = VI.G, W = G.W + dw, H = G.H + dh;
    if (W < 2 || H < 2 || W > 12 || H > 12) return;
    const ng = [];
    for (let x = 0; x < W; x++) { ng[x] = []; for (let y = 0; y < H; y++) ng[x][y] = (x < G.W && y < G.H) ? G.g[x][y] : { wall: false, term: false }; }
    VI.G = { g: ng, W: W, H: H, start: G.start && G.start[0] < W && G.start[1] < H ? G.start : null, errs: [] };
    IX.stop('vi'); VI.frame = 0; viSync(); viCompute(); viRender();
  }
  function viSlide(what, v) {
    VI[what] = Number(v);
    IX.stop('vi'); viCompute();
    if (VI.frame > VI.res.hist.length - 1) VI.frame = VI.res.hist.length - 1;
    viSync(); viRender();
  }
  function viStep(d, fromSlider) {
    const total = VI.res.hist.length;
    if (d === 'play') { IX.play('vi', total, () => VI.frame, f => { VI.frame = f; viRender(); }, 420); viRender(); return; }
    IX.stop('vi');
    if (d === 'first') VI.frame = 0;
    else if (d === 'last') VI.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) VI.frame = d;
    else VI.frame = Math.max(0, Math.min(total - 1, VI.frame + d));
    viRender();
  }
  function viTogglePol(on) { VI.pol = on; viRender(); }
  function viEditGrid(x, y, cls, inner) {
    return `<td class="${cls}" onclick="viPaint(${x},${y})" style="cursor:pointer;" title="click to paint ${VI.paint}">${inner}</td>`;
  }
  function viGridHtml(U, P, label, prevU) {
    const G = VI.G;
    let h = '<div class="gw-unit">';
    if (label) h += `<div class="gw-label">${label}</div>`;
    h += '<table class="gw">';
    for (let i = 0; i < G.H; i++) {
      const y = G.H - 1 - i;
      h += '<tr>';
      for (let x = 0; x < G.W; x++) {
        const c = G.g[x][y];
        const isStart = G.start && G.start[0] === x && G.start[1] === y;
        if (c.wall) { h += viEditGrid(x, y, 'wall', ''); continue; }
        if (c.term) { h += viEditGrid(x, y, c.r >= 0 ? 'term-pos' : 'term-neg', (c.r > 0 ? '+' : '') + c.r); continue; }
        if (P) {
          const a = P[x][y];
          h += viEditGrid(x, y, 'arrow', (a ? a.arrow : '·') + (isStart ? '<span class="sub">start</span>' : ''));
        } else {
          const v = U[x][y];
          let mark = '';
          if (prevU) { const dd = v - prevU[x][y]; if (Math.abs(dd) > 1e-9) mark = `<span class="sub" style="color:${dd > 0 ? 'var(--accent-3)' : 'var(--accent-2)'};">${dd > 0 ? '+' : ''}${mdpFmt(dd, 3)}</span>`; }
          h += viEditGrid(x, y, '', mdpFmt(v) + (isStart && !mark ? '<span class="sub">start</span>' : mark));
        }
      }
      h += '</tr>';
    }
    return h + '</table></div>';
  }
  function viRender() {
    const out = document.getElementById('vi-output');
    if (!out) return;
    const G = VI.G, R = VI.res;
    if (!G || !R) { out.innerHTML = '<div class="tool-error">Nothing to solve.</div>'; return; }
    const total = R.hist.length;
    const U = R.hist[VI.frame], prevU = VI.frame > 0 ? R.hist[VI.frame - 1] : null;
    const P = mdpPolicy(G, U, VI.pMain);
    let anyTerm = false;
    for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) if (G.g[x][y].term) anyTerm = true;
    let html = `<div class="verdict ${R.diverged ? 'warn' : 'safe'}">
      <strong>R(s) = ${VI.R}</strong> &nbsp;·&nbsp; <strong>γ = ${VI.gamma}</strong> &nbsp;·&nbsp;
      <strong>P(intended) = ${VI.pMain}</strong>, ${+((1 - VI.pMain) / 2).toFixed(4)} to each side
      &nbsp;·&nbsp; ${R.diverged ? '<strong>utilities diverge</strong>' : 'converges in <strong>' + R.iters + '</strong> iteration' + (R.iters === 1 ? '' : 's')}
      <br><span style="font-size:12.5px;">stopping rule δ &lt; ${VI.gamma < 1 ? 'ε(1−γ)/γ = ' + R.thresh.toExponential(2) + ' with ε = 10⁻⁴' : '10⁻⁹ (γ = 1, so ε(1−γ)/γ degenerates to 0)'}</span></div>`;
    if (!anyTerm) html += '<div class="verdict warn">This grid has no terminal states, so nothing ever ends. Paint a <strong>+1 goal</strong> somewhere.</div>';
    if (R.diverged) html += `<div class="verdict bad">The utilities are <strong>not converging</strong>. With <strong>R(s) = ${VI.R} &gt; 0</strong> and <strong>γ = ${VI.gamma}</strong>, staying alive pays forever and Σγ<sup>t</sup>R(S<sub>t</sub>) has no limit. The <em>policy</em> is still meaningful (it is the "never terminate" policy). <strong>Slide γ below 1 for finite numbers.</strong></div>`;
    // the two live grids
    html += '<div class="gw-wrap">';
    html += viGridHtml(U, null, VI.frame === 0 ? 'U₀ — click any cell to edit' : 'U<sub>' + VI.frame + '</sub> — change from the previous sweep in small type', prevU);
    if (VI.pol) html += viGridHtml(U, P, 'π from U<sub>' + VI.frame + '</sub> = arg max<sub>a</sub> Σ P(s′|s,a) U(s′)');
    html += '</div>';
    const lab = VI.frame === 0 ? 'U₀ — zero everywhere except the ends'
      : `after sweep <strong>${VI.frame}</strong> of ${total - 1}` + (R.deltas[VI.frame - 1] !== undefined ? ` · δ = ${R.deltas[VI.frame - 1] < 1e-4 ? R.deltas[VI.frame - 1].toExponential(1) : R.deltas[VI.frame - 1].toFixed(4)}` : '');
    const settled = VI.frame > 0 && R.deltas[VI.frame - 1] !== undefined && R.deltas[VI.frame - 1] < R.thresh;
    html += IX.player('vi', VI.frame, total, lab, settled ? ['done', 'converged'] : ['update', 'Bellman sweep']);
    // paint palette
    html += '<div class="ix-bar"><span class="ix-lab">paint:</span>'
      + VI_PAINTS.map(p => `<button class="ix-btn ${VI.paint === p.k ? 'on' : ''}" onclick="viSetPaint('${p.k}')">${p.label}</button>`).join('')
      + `<span class="ix-lab">grid ${G.W}×${G.H}</span>
      <button class="ix-btn" onclick="viResize(-1,0)" ${G.W <= 2 ? 'disabled' : ''}>− col</button>
      <button class="ix-btn" onclick="viResize(1,0)" ${G.W >= 12 ? 'disabled' : ''}>+ col</button>
      <button class="ix-btn" onclick="viResize(0,-1)" ${G.H <= 2 ? 'disabled' : ''}>− row</button>
      <button class="ix-btn" onclick="viResize(0,1)" ${G.H >= 12 ? 'disabled' : ''}>+ row</button>
      ${IX.toggles([{ label: 'show policy', on: VI.pol, fn: 'viTogglePol(this.checked)' }])}</div>`;
    // live sliders
    html += `<div class="ix-bar">
      <span class="ix-lab">R(s) <strong>${VI.R}</strong></span>
      <input type="range" min="-2" max="0.4" step="0.01" value="${VI.R}" oninput="viSlide('R', this.value)" aria-label="Reward per step">
      <span class="ix-lab">γ <strong>${VI.gamma}</strong></span>
      <input type="range" min="0.5" max="1" step="0.005" value="${VI.gamma}" oninput="viSlide('gamma', this.value)" aria-label="Discount factor">
      <span class="ix-lab">P(intended) <strong>${VI.pMain}</strong></span>
      <input type="range" min="0.34" max="1" step="0.01" value="${VI.pMain}" oninput="viSlide('pMain', this.value)" aria-label="Probability the action does what you asked">
    </div>`;
    html += `<p class="ix-hint"><strong>Click any cell</strong> to paint it with whatever is selected above — build your own maze.
      <strong>Drag the sliders</strong> and watch the policy reshape itself live: push R(s) down past about −1.6 and the agent starts diving into the −1;
      drag it up to 0 and it refuses all risk. Slide <strong>P(intended)</strong> to 1 and the world turns deterministic.</p>`;
    if (G.start) {
      const su = U[G.start[0]][G.start[1]];
      html += `<div class="csp-sol">Expected utility of the <strong>start</strong> state at this sweep = <strong>${mdpFmt(su)}</strong>
        &nbsp;·&nbsp; π(start) = <strong>${P[G.start[0]][G.start[1]] ? P[G.start[0]][G.start[1]].name : '—'}</strong></div>`;
    }
    if (R.deltas.length) {
      const chips = R.deltas.slice(0, 14).map((d, i) => `<span class="chipq ${i + 1 === VI.frame ? 'head' : ''}" style="cursor:pointer;" onclick="viStep(${i + 1}, true)">${i + 1}<span class="f">δ=${d < 1e-4 ? d.toExponential(1) : d.toFixed(4)}</span></span>`).join('');
      html += `<div class="qrow"><div class="qlab">δ per sweep</div><div class="frontier">${chips}${R.deltas.length > 14 ? '<span class="chipq done">… ' + R.deltas.length + ' total</span>' : ''}</div></div>`;
    }
    html += `<p style="font-size:12.5px; color:var(--ink-muted); margin-top:10px;">
      δ is the largest change any state saw in that sweep; the loop stops when δ drops below the threshold shown above.
      Watch U₁ → U₂ → U₃: utility <strong>spreads outwards from the terminals, one square per sweep</strong>.</p>`;
    out.innerHTML = html;
  }
  function runVI() {
    const out = document.getElementById('vi-output');
    if (!out) return;
    IX.stop('vi');
    const G = mdpParse(document.getElementById('vi-grid').value);
    let head = '';
    if (G.errs && G.errs.length) head = `<div class="verdict bad">${G.errs.map(esc).join('<br>')}</div>`;
    if (!G.W) { out.innerHTML = head + '<div class="tool-error">Nothing to solve.</div>'; return; }
    if (G.W * G.H > 144) { out.innerHTML = head + '<div class="tool-error">That grid is too big — 12 × 12 is the maximum.</div>'; return; }
    const pM = mdpRead('vi-p', 0.8), gm = mdpRead('vi-g', 1);
    if (pM < 0 || pM > 1) { out.innerHTML = head + '<div class="tool-error">P(intended) must be between 0 and 1.</div>'; return; }
    if (gm < 0 || gm > 1) { out.innerHTML = head + '<div class="tool-error">γ must be between 0 and 1.</div>'; return; }
    VI.G = G; VI.R = mdpRead('vi-r', -0.04); VI.gamma = gm; VI.pMain = pM; VI.frame = 0;
    viCompute();
    viRender();
    if (head) out.innerHTML = head + out.innerHTML;
  }
  TOOL_RUNNERS.runVI = runVI;
  /* ---------- W4: Bellman calculator, cell picked by clicking ---------- */
  const EU = { x: 2, y: 2, which: 'final' };
  function euPick(x, y) {
    EU.x = x; EU.y = y;
    const a = document.getElementById('eu-col'), b = document.getElementById('eu-row');
    if (a) a.value = x + 1; if (b) b.value = y + 1;
    runEU();
  }
  function euWhich(k) { EU.which = k; const s = document.getElementById('eu-at'); if (s) s.value = k; runEU(); }
  function runEU() {
    const out = document.getElementById('eu-output');
    if (!out) return;
    const cfg = mdpSetup(), G = cfg.G;
    if (!G.W || (G.errs && G.errs.length)) { out.innerHTML = '<div class="tool-error">Fix the grid in the solver above first.</div>'; return; }
    const cx = Math.round(mdpRead('eu-col', 1)) - 1, cy = Math.round(mdpRead('eu-row', 1)) - 1;
    EU.x = cx; EU.y = cy;
    EU.which = document.getElementById('eu-at').value;
    if (cx < 0 || cy < 0 || cx >= G.W || cy >= G.H) {
      out.innerHTML = `<div class="tool-error">That square is off the grid — columns run 1…${G.W} from the left, rows 1…${G.H} from the bottom.</div>`; return;
    }
    const cell = G.g[cx][cy];
    const R = mdpVI(G, cfg.R, cfg.gamma, cfg.pMain, 1e-4, 3000);
    let U, ulab;
    if (EU.which === 'final') { U = R.U; ulab = 'converged U'; }
    else { const k = Math.min(parseInt(EU.which, 10), R.hist.length - 1); U = R.hist[k]; ulab = 'U' + (k === 0 ? '₀' : '<sub>' + k + '</sub>'); }
    /* clickable grid */
    let grid = '<div class="gw-unit"><div class="gw-label">' + ulab + ' — click any square</div><table class="gw">';
    for (let i = 0; i < G.H; i++) {
      const y = G.H - 1 - i;
      grid += '<tr>';
      for (let x = 0; x < G.W; x++) {
        const c = G.g[x][y], hot = x === cx && y === cy ? ' hot' : '';
        const click = ` onclick="euPick(${x},${y})" style="cursor:pointer;"`;
        if (c.wall) grid += `<td class="wall${hot}"${click}></td>`;
        else if (c.term) grid += `<td class="${c.r >= 0 ? 'term-pos' : 'term-neg'}${hot}"${click}>${c.r > 0 ? '+' : ''}${c.r}</td>`;
        else grid += `<td class="${hot}"${click}>${mdpFmt(U[x][y])}</td>`;
      }
      grid += '</tr>';
    }
    grid += '</table></div>';
    let html = '<div class="gw-wrap">' + grid + '</div>';
    html += `<div class="ix-bar"><span class="ix-lab">utilities to use:</span>
      ${[['final', 'converged U'], ['0', 'U₀'], ['1', 'U₁'], ['2', 'U₂'], ['3', 'U₃']].map(o =>
        `<button class="ix-btn ${EU.which === o[0] ? 'on' : ''}" onclick="euWhich('${o[0]}')">${o[1]}</button>`).join('')}</div>`;
    html += `<p class="ix-hint"><strong>Click any square</strong> above to compute the Bellman update there, and the buttons switch which
      utility map you are reading from. Try <strong>(3,3) with U₀</strong> to see where 0.76 comes from, and
      <strong>(4,1) with the converged U</strong> to see in the numbers why the policy walks away from the goal.</p>`;
    if (cell.wall) { out.innerHTML = html + '<div class="verdict bad">That square is a wall — no actions are available there.</div>'; return; }
    if (cell.term) { out.innerHTML = html + `<div class="verdict warn">That square is a <strong>terminal state</strong>. Terminals have no actions: U(s) = R(s) = <strong>${cell.r}</strong>, permanently.</div>`; return; }
    const rows = MDP_ACTS.map(a => {
      const outs = mdpOutcomes(G, cx, cy, a, cfg.pMain);
      let tot = 0;
      const terms = outs.map(o => {
        const u = U[o.x][o.y]; tot += o.p * u;
        const stay = (o.x === cx && o.y === cy);
        return `${o.p.toFixed(2).replace(/0$/, '')}×${mdpFmt(u)}<span style="color:var(--ink-muted); font-size:10.5px;">(${o.x + 1},${o.y + 1})${stay ? '=stay' : ''}</span>`;
      });
      return { a: a, terms: terms, tot: tot };
    });
    let best = -Infinity; rows.forEach(r => { if (r.tot > best) best = r.tot; });
    html += `<h3 style="margin-top:14px;">E[U | s, a] &nbsp;=&nbsp; Σ<sub>s′</sub> P(s′|s,a) U(s′) &nbsp; at (${cx + 1}, ${cy + 1})</h3>`;
    rows.forEach(r => {
      const win = Math.abs(r.tot - best) < 1e-12;
      html += `<div class="eu-row ${win ? 'best' : ''}">
        <div class="act">${r.a.arrow} ${r.a.name}</div>
        <div style="font-size:11.5px;">${r.terms.join(' &nbsp;+&nbsp; ')}</div>
        <div class="tot">${mdpFmt(r.tot)}${win ? ' ★' : ''}</div></div>`;
    });
    const bestAct = rows.filter(r => Math.abs(r.tot - best) < 1e-12)[0].a;
    html += `<div class="csp-sol" style="margin-top:14px;">
      <strong>π(${cx + 1},${cy + 1}) = arg max = ${bestAct.arrow} ${bestAct.name}</strong> &nbsp; (value ${mdpFmt(best)})<br>
      Bellman update: U′ = R(s) + γ · max = ${cfg.R} + ${cfg.gamma} × ${mdpFmt(best)} = <strong>${mdpFmt(cfg.R + cfg.gamma * best)}</strong></div>`;
    html += `<p style="font-size:12.5px; color:var(--ink-muted);">
      Outcomes that would leave the grid or hit a wall come back to the same square — those show as <em>stay</em>.
      R(s) and γ appear only in the last line: they cannot change which action wins, which is why the policy formula drops them.</p>`;
    out.innerHTML = html;
  }
  TOOL_RUNNERS.runEU = runEU;
  /* ---------- W4: reward sweep with a scrubber ---------- */
  const SW = { list: [], frame: 0, pols: [] };
  function swStep(d, fromSlider) {
    const total = SW.pols.length;
    if (!total) return;
    if (d === 'play') { IX.play('sw', total, () => SW.frame, f => { SW.frame = f; swRender(); }, 700); swRender(); return; }
    IX.stop('sw');
    if (d === 'first') SW.frame = 0;
    else if (d === 'last') SW.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) SW.frame = d;
    else SW.frame = Math.max(0, Math.min(total - 1, SW.frame + d));
    swRender();
  }
  function swScan(v) {
    const r = Number(v);
    const cfg = mdpSetup(), G = cfg.G;
    const useGamma = (r > 0 && cfg.gamma >= 1) ? 0.999 : cfg.gamma;
    const S = mdpVI(G, r, useGamma, cfg.pMain, 1e-6, 6000);
    SW.scanR = r; SW.scanP = mdpPolicy(G, S.U, cfg.pMain); SW.scanG = G; SW.scanGamma = useGamma;
    swRender();
  }
  function swRender() {
    const out = document.getElementById('sw-output');
    if (!out || !SW.pols.length) return;
    const G = SW.G;
    let html = '';
    /* the live scanner */
    html += `<div class="ix-bar">
      <span class="ix-lab">scan R(s) = <strong>${SW.scanR}</strong>${SW.scanGamma !== SW.gamma ? ' <span style="color:var(--accent-2);">(γ=' + SW.scanGamma + ')</span>' : ''}</span>
      <input type="range" min="-2.5" max="0.3" step="0.01" value="${SW.scanR}" oninput="swScan(this.value)" aria-label="Scan the per-step reward">
    </div>`;
    html += '<div class="gw-wrap">' + mdpGridHtml(G, { P: SW.scanP, showStart: true, label: 'π* at R(s) = ' + SW.scanR }) + '</div>';
    html += `<p class="ix-hint"><strong>Drag the scanner</strong> slowly from 0 down to −2.5. The policy is <em>piecewise constant</em>: it holds
      steady for a whole interval and then snaps. Find the exact R at which (3,2) flips from pointing away from the −1 to diving into it.</p>`;
    /* the fixed set of grids */
    html += '<div class="gw-wrap">';
    SW.pols.forEach((p, i) => {
      html += mdpGridHtml(G, { P: p.P, showStart: true,
        label: (i === SW.frame ? '▶ ' : '') + 'R(s) = ' + p.r + (p.g !== SW.gamma ? ' <span style="text-transform:none;">(γ=' + p.g + ')</span>' : '') });
    });
    html += '</div>';
    html += IX.player('sw', SW.frame, SW.pols.length, `grid <strong>${SW.frame + 1}</strong> of ${SW.pols.length} — R(s) = ${SW.pols[SW.frame].r}`, null);
    const key = p => { let s = ''; for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) s += p[x][y] ? p[x][y].name[0] : '-'; return s; };
    const changes = [];
    for (let i = 1; i < SW.pols.length; i++) {
      if (key(SW.pols[i].P) !== key(SW.pols[i - 1].P)) {
        const diff = [];
        for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) {
          const a = SW.pols[i - 1].P[x][y], b = SW.pols[i].P[x][y];
          if (a && b && a.name !== b.name) diff.push(`(${x + 1},${y + 1}) ${a.arrow}→${b.arrow}`);
        }
        changes.push(`between <strong>R = ${SW.pols[i - 1].r}</strong> and <strong>R = ${SW.pols[i].r}</strong>: ${diff.join(', ') || 'the policy changes'}`);
      }
    }
    html += `<div class="verdict ${changes.length ? 'safe' : 'warn'}" style="margin-top:8px;">
      ${changes.length ? '<strong>The policy changes ' + changes.length + ' time' + (changes.length === 1 ? '' : 's') + ' across this list:</strong><br>' + changes.join('<br>')
        : 'The policy is identical for every reward in this list — widen the range to find a boundary.'}</div>`;
    if (SW.list.some(r => r > 0)) html += `<div class="verdict warn" style="margin-top:8px;">
      For <strong>R(s) &gt; 0</strong> with γ = 1 the utilities diverge, so those grids were solved with <strong>γ = 0.999</strong>.
      The policy is the point: the agent <strong>steers away from both terminals</strong> and collects reward forever.</div>`;
    out.innerHTML = html;
  }
  function runSweep() {
    const out = document.getElementById('sw-output');
    if (!out) return;
    IX.stop('sw');
    const cfg = mdpSetup(), G = cfg.G;
    if (!G.W || (G.errs && G.errs.length)) { out.innerHTML = '<div class="tool-error">Fix the grid in the solver above first.</div>'; return; }
    const list = [], bad = [];
    String(document.getElementById('sw-list').value).split(',').forEach(t => {
      const s = t.trim(); if (!s) return;
      const v = parseFloat(s);
      if (isNaN(v)) bad.push(s); else list.push(v);
    });
    let head = '';
    if (bad.length) head += `<div class="verdict bad">Could not read: ${bad.map(esc).join(', ')}</div>`;
    if (!list.length) { out.innerHTML = head + '<div class="tool-error">Give at least one reward value.</div>'; return; }
    if (list.length > 12) { out.innerHTML = head + '<div class="tool-error">Twelve values at most.</div>'; return; }
    list.sort((a, b) => a - b);
    SW.G = G; SW.gamma = cfg.gamma; SW.list = list;
    SW.pols = list.map(r => {
      const useGamma = (r > 0 && cfg.gamma >= 1) ? 0.999 : cfg.gamma;
      const S = mdpVI(G, r, useGamma, cfg.pMain, 1e-6, 6000);
      return { r: r, P: mdpPolicy(G, S.U, cfg.pMain), g: useGamma };
    });
    SW.frame = 0;
    if (SW.scanR === undefined) SW.scanR = -0.04;
    swScan(SW.scanR);
    if (head) out.innerHTML = head + out.innerHTML;
  }
  TOOL_RUNNERS.runSweep = runSweep;
