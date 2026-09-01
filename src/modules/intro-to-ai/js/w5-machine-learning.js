  /* ============================================================
     W5 · MACHINE LEARNING — metrics and curve fitting
     ============================================================ */
  const CM_PRESETS = {
    none:  { tp: 0,   fp: 0,   fn: 100, tn: 9900, note: 'The always-"no" model on 10,000 patients with 1% prevalence — the slide\'s example.' },
    tiny:  { tp: 1,   fp: 0,   fn: 99,  tn: 9900, note: 'Flags 0.01% of the population and happens to be right every time. This is the "assume 0.01% of true positives" case from the slide.' },
    all:   { tp: 100, fp: 9900, fn: 0,  tn: 0,    note: 'The always-"yes" model — perfect recall, useless precision. The mirror image of the always-"no" model.' },
    good:  { tp: 82,  fp: 130, fn: 18,  tn: 9770, note: 'A model that actually works: catches 82 of the 100 real cases, at the cost of 130 false alarms.' },
    bal:   { tp: 82,  fp: 11,  fn: 18,  tn: 89,   note: 'The same model measured on a balanced test set — 100 positives and 100 negatives. Accuracy is informative again.' },
    spam:  { tp: 480, fp: 220, fn: 20,  tn: 3280, note: 'An over-eager spam filter: it catches almost everything (high recall) but throws real mail away (poor precision).' }
  };
  function cmPreset() {
    const k = document.getElementById('cm-preset').value;
    const p = CM_PRESETS[k];
    if (p) {
      document.getElementById('cm-tp').value = p.tp;
      document.getElementById('cm-fp').value = p.fp;
      document.getElementById('cm-fn').value = p.fn;
      document.getElementById('cm-tn').value = p.tn;
    }
    runCM();
  }
  function cmNum(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    const v = parseFloat(String(el.value).replace(/[, ]/g, ''));
    return v;
  }
  function cmFmt(v, dp) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return Number(v).toFixed(dp === undefined ? 4 : dp);
  }
  function rgNums(text) {
    return String(text).split(/[\s,;]+/).filter(Boolean).map(t => ({ raw: t, v: parseFloat(t) }));
  }
  /* ---------- W5: polynomial fitting ---------- */
  function ftRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function ftNormal(rnd) {
    let u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function ftTrue(x) { return Math.cos(1.5 * Math.PI * x); }
  /* least squares fit of a polynomial, in the scaled variable u = 2x − 1 ∈ [−1,1] */
  function ftFit(xs, ys, deg) {
    const m = deg + 1;
    const A = [], b = [];
    for (let i = 0; i < m; i++) { A.push(new Array(m).fill(0)); b.push(0); }
    for (let k = 0; k < xs.length; k++) {
      const u = 2 * xs[k] - 1;
      const pow = [1];
      for (let i = 1; i < 2 * m; i++) pow.push(pow[i - 1] * u);
      for (let i = 0; i < m; i++) {
        b[i] += pow[i] * ys[k];
        for (let j = 0; j < m; j++) A[i][j] += pow[i + j];
      }
    }
    // Gaussian elimination with partial pivoting
    for (let c = 0; c < m; c++) {
      let piv = c;
      for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-14) return null;
      if (piv !== c) { const t = A[piv]; A[piv] = A[c]; A[c] = t; const tb = b[piv]; b[piv] = b[c]; b[c] = tb; }
      for (let r = c + 1; r < m; r++) {
        const f = A[r][c] / A[c][c];
        if (!f) continue;
        for (let j = c; j < m; j++) A[r][j] -= f * A[c][j];
        b[r] -= f * b[c];
      }
    }
    const co = new Array(m).fill(0);
    for (let i = m - 1; i >= 0; i--) {
      let s = b[i];
      for (let j = i + 1; j < m; j++) s -= A[i][j] * co[j];
      co[i] = s / A[i][i];
    }
    for (let i = 0; i < m; i++) if (!isFinite(co[i])) return null;
    return co;
  }
  function ftEval(co, x) {
    const u = 2 * x - 1;
    let s = 0;
    for (let i = co.length - 1; i >= 0; i--) s = s * u + co[i];
    return s;
  }
  function ftMSE(co, xs, ys) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) { const d = ftEval(co, xs[i]) - ys[i]; s += d * d; }
    return s / xs.length;
  }
  function ftExp(v) {
    if (!isFinite(v)) return '∞';
    if (v === 0) return '0';
    if (v >= 1e-3 && v < 1e5) return v.toPrecision(3);
    return v.toExponential(2);
  }
  /* live controls for the fitting explorer */
  function ftSet(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v;
    IX.stop('ft');
    runFit();
  }
  function ftShuffle() { ftSet('ft-seed', Math.floor(Math.random() * 9000) + 1); }
  function ftStep(d, fromSlider) {
    const cur = Math.round(parseFloat(document.getElementById('ft-deg').value) || 1);
    const max = Math.round(parseFloat(document.getElementById('ft-max').value) || 14);
    if (d === 'play') {
      IX.play('ft', max, () => Math.round(parseFloat(document.getElementById('ft-deg').value) || 1) - 1,
        f => { document.getElementById('ft-deg').value = f + 1; runFit(); }, 650);
      runFit(); return;
    }
    IX.stop('ft');
    let next;
    if (d === 'first') next = 1;
    else if (d === 'last') next = max;
    else if (typeof d === 'number' && fromSlider) next = d + 1;
    else next = Math.max(1, Math.min(max, cur + d));
    document.getElementById('ft-deg').value = next;
    runFit();
  }
  function ftControls(deg, maxDeg, nTrain, noise, seed, best) {
    let h = IX.player('ft', deg - 1, maxDeg, `polynomial degree <strong>${deg}</strong> of ${maxDeg}`,
      best ? (deg < best ? ['assign', 'underfitting'] : deg > best ? ['update', 'overfitting'] : ['done', 'about right']) : null);
    h += `<div class="ix-bar">
      <span class="ix-lab">degree <strong>${deg}</strong></span>
      <input type="range" min="1" max="${maxDeg}" step="1" value="${deg}" oninput="ftSet('ft-deg', this.value)" aria-label="Polynomial degree">
      <span class="ix-lab">max <strong>${maxDeg}</strong></span>
      <button class="ix-btn" onclick="ftSet('ft-max', ${Math.max(2, maxDeg - 2)})" ${maxDeg <= 2 ? 'disabled' : ''}>−</button>
      <button class="ix-btn" onclick="ftSet('ft-max', ${Math.min(30, maxDeg + 2)})" ${maxDeg >= 30 ? 'disabled' : ''}>+</button>
    </div>
    <div class="ix-bar">
      <span class="ix-lab">training points <strong>${nTrain}</strong></span>
      <input type="range" min="4" max="60" step="1" value="${nTrain}" oninput="ftSet('ft-n', this.value)" aria-label="Number of training points">
      <span class="ix-lab">noise σ <strong>${noise}</strong></span>
      <input type="range" min="0" max="0.6" step="0.01" value="${noise}" oninput="ftSet('ft-noise', this.value)" aria-label="Noise standard deviation">
      <button class="ix-btn" onclick="ftShuffle()" title="Redraw the random sample">⟳ new sample (seed ${seed})</button>
    </div>
    <p class="ix-hint"><strong>Drag the degree slider</strong> and watch the fit go from a straight line, through the sweet spot, to a
      scribble that passes through every training point. <strong>Press ▶</strong> to sweep it automatically.
      Drop <strong>noise σ to 0</strong> and the U-shape disappears entirely — there is nothing left to memorise.</p>`;
    return h;
  }
  function runFit() {
    const out = document.getElementById('ft-output');
    if (!out) return;
    const rd = (id, d) => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? d : v; };
    let deg = Math.round(rd('ft-deg', 4)), nTrain = Math.round(rd('ft-n', 24));
    const noise = rd('ft-noise', 0.12), seed = Math.round(rd('ft-seed', 7));
    let maxDeg = Math.round(rd('ft-max', 14));
    if (nTrain < 3 || nTrain > 200) { out.innerHTML = '<div class="tool-error">Training points must be between 3 and 200.</div>'; return; }
    if (noise < 0 || noise > 5) { out.innerHTML = '<div class="tool-error">Noise σ must be between 0 and 5.</div>'; return; }
    if (maxDeg < 1) maxDeg = 1;
    if (maxDeg > 30) maxDeg = 30;
    if (deg < 0) deg = 0;
    if (deg > maxDeg) maxDeg = deg;
    const rnd = ftRng(seed * 2654435761 + 12345);
    const xt = [], yt = [], xv = [], yv = [];
    for (let i = 0; i < nTrain; i++) { const x = rnd(); xt.push(x); yt.push(ftTrue(x) + noise * ftNormal(rnd)); }
    const nVal = Math.max(8, Math.round(nTrain * 0.6));
    for (let i = 0; i < nVal; i++) { const x = rnd(); xv.push(x); yv.push(ftTrue(x) + noise * ftNormal(rnd)); }
    const sweep = [];
    for (let d = 1; d <= maxDeg; d++) {
      const co = ftFit(xt, yt, d);
      if (!co) { sweep.push({ d: d, bad: true }); continue; }
      sweep.push({ d: d, co: co, tr: ftMSE(co, xt, yt), va: ftMSE(co, xv, yv) });
    }
    const okSweep = sweep.filter(s => !s.bad && isFinite(s.va));
    let best = null;
    okSweep.forEach(s => { if (!best || s.va < best.va) best = s; });
    const cur = sweep.filter(s => s.d === deg)[0];
    let html = '';
    if (!cur || cur.bad) {
      html += `<div class="verdict bad">Degree ${deg} could not be fitted — with only ${nTrain} training points the normal equations are singular: there are more coefficients than data. Lower the degree or add points.</div>`;
    } else {
      const gap = cur.va / (cur.tr || 1e-12);
      const verdict = (best && cur.d < best.d - 0.5) ? ['underfitting', 'bad', 'Both errors are high. The model is too simple to follow the shape of the data.']
        : (best && cur.d > best.d + 0.5) ? ['overfitting', 'bad', 'Training error is lower than at the optimum but validation error is worse — the extra flexibility went into memorising noise.']
        : ['about right', 'safe', 'Both errors are low and close to each other. This is the bottom of the U.'];
      html += `<div class="verdict ${verdict[1]}"><strong>Degree ${deg} — ${verdict[0]}.</strong> ${verdict[2]}<br><br>
        Train MSE <strong>${ftExp(cur.tr)}</strong> &nbsp;·&nbsp; Validation MSE <strong>${ftExp(cur.va)}</strong>
        &nbsp;·&nbsp; ratio validation/train <strong>${isFinite(gap) ? ftExp(gap) : '∞'}×</strong></div>`;
      // fitted-curve plot
      const W = 520, H = 250, pad = 34;
      let lo = -2.2, hi = 2.2;
      const cx = x => pad + x * (W - pad - 14);
      const cy = y => H - pad - ((y - lo) / (hi - lo)) * (H - pad - 16);
      const clamp = y => Math.max(10, Math.min(H - pad + 4, cy(y)));
      let path = '';
      for (let i = 0; i <= 300; i++) {
        const x = i / 300, y = ftEval(cur.co, x);
        path += (i ? ' L' : 'M') + cx(x).toFixed(1) + ',' + clamp(y).toFixed(1);
      }
      let truePath = '';
      for (let i = 0; i <= 200; i++) { const x = i / 200; truePath += (i ? ' L' : 'M') + cx(x).toFixed(1) + ',' + cy(ftTrue(x)).toFixed(1); }
      let dots = '';
      for (let i = 0; i < xt.length; i++) dots += `<circle cx="${cx(xt[i]).toFixed(1)}" cy="${clamp(yt[i]).toFixed(1)}" r="3" fill="var(--accent)" opacity="0.8"/>`;
      let vdots = '';
      for (let i = 0; i < xv.length; i++) vdots += `<circle cx="${cx(xv[i]).toFixed(1)}" cy="${clamp(yv[i]).toFixed(1)}" r="2.6" fill="none" stroke="var(--accent-3)" stroke-width="1.3"/>`;
      html += `<div class="chartbox"><svg width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">
        <title>Polynomial of degree ${deg} fitted to the sample</title>
        <desc>The fitted curve against the true function and the sampled points.</desc>
        <line x1="${pad}" y1="${cy(0)}" x2="${W - 14}" y2="${cy(0)}" stroke="var(--rule)"/>
        <line x1="${pad}" y1="10" x2="${pad}" y2="${H - pad}" stroke="var(--ink-muted)"/>
        <line x1="${pad}" y1="${H - pad}" x2="${W - 14}" y2="${H - pad}" stroke="var(--ink-muted)"/>
        <path d="${truePath}" fill="none" stroke="var(--accent-2)" stroke-width="2" stroke-dasharray="5 3"/>
        <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>
        ${dots}${vdots}
        <text x="${pad}" y="${H - 12}" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--ink-muted)">x = 0</text>
        <text x="${W - 14}" y="${H - 12}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--ink-muted)">x = 1</text>
        <text x="${W - 14}" y="20" text-anchor="end" font-family="IBM Plex Sans" font-size="10.5" fill="var(--accent)">— fitted (degree ${deg})</text>
        <text x="${W - 14}" y="33" text-anchor="end" font-family="IBM Plex Sans" font-size="10.5" fill="var(--accent-2)">-- true function cos(1.5πx)</text>
        <text x="${W - 14}" y="46" text-anchor="end" font-family="IBM Plex Sans" font-size="10.5" fill="var(--accent-3)">○ validation points</text>
      </svg><div class="caption">Filled dots are the ${nTrain} training points, hollow circles the ${nVal} validation points. The curve is clipped at ±2.2 — a spike that leaves the box has gone far further than it looks.</div></div>`;
    }
    // sweep table
    let maxErr = 0;
    okSweep.forEach(s => { if (s.tr > maxErr) maxErr = s.tr; if (isFinite(s.va) && s.va < 1e6 && s.va > maxErr) maxErr = s.va; });
    if (!maxErr) maxErr = 1;
    html += '<h3 style="margin-top:16px;">Every degree, train vs validation</h3>';
    html += '<div class="fitrow" style="border-bottom:1px solid var(--rule); font-weight:600;"><div>degree</div><div>train MSE</div><div>validation MSE</div></div>';
    sweep.forEach(s => {
      if (s.bad) { html += `<div class="fitrow"><div>${s.d}</div><div colspan="2" style="color:var(--ink-muted);">singular — cannot fit</div><div></div></div>`; return; }
      const isBest = best && s.d === best.d, isCur = s.d === deg;
      const wTr = Math.max(2, Math.min(100, 100 * s.tr / maxErr));
      const wVa = isFinite(s.va) ? Math.max(2, Math.min(100, 100 * s.va / maxErr)) : 100;
      html += `<div class="fitrow ${isBest ? 'best' : ''}">
        <div>${s.d}${isCur ? ' ◀' : ''}${isBest ? ' ★' : ''}</div>
        <div><span class="bar" style="width:${wTr.toFixed(0)}%"></span> ${ftExp(s.tr)}</div>
        <div><span class="bar val" style="width:${wVa.toFixed(0)}%"></span> ${ftExp(s.va)}</div></div>`;
    });
    if (best) {
      const rising = okSweep.filter(s => s.d > best.d && s.va > best.va).length;
      html += `<div class="verdict safe" style="margin-top:12px;">
        <strong>Lowest validation error at degree ${best.d}</strong> (validation ${ftExp(best.va)}, train ${ftExp(best.tr)}) — that is the model you would choose.
        ${rising ? 'Every degree above it does worse on validation while doing <strong>better</strong> on training: the right-hand arm of the U.' : ''}</div>`;
    }
    let mono = true;
    for (let i = 1; i < okSweep.length; i++) if (okSweep[i].tr > okSweep[i - 1].tr + 1e-9) mono = false;
    html += `<p style="font-size:12.5px; color:var(--ink-muted); margin-top:10px;">
      ★ marks the minimum validation error, ◀ the degree drawn above.
      ${mono ? 'Note the training column <strong>never rises</strong> — more complexity can never fit the training data worse, which is why training error alone can never tell you when to stop.' : ''}
      Bars are scaled to the largest finite error shown.</p>`;
    out.innerHTML = html;
    const ctl = document.getElementById('ft-controls');
    if (ctl) ctl.innerHTML = ftControls(deg, maxDeg, nTrain, noise, seed, best ? best.d : null);
  }
  TOOL_RUNNERS.runFit = runFit;
