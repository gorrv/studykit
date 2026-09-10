  /* ============================================================
     W4 · HOW INFORMATION SPREADS — the picture behind value iteration
     ============================================================ */
  const SP = { frame: 0, res: null, dist: null, G: null, cfg: null, err: '' };
  /* how many squares each cell is from the nearest terminal, walls blocked */
  function spDist(G) {
    const d = [];
    for (let x = 0; x < G.W; x++) { d.push([]); for (let y = 0; y < G.H; y++) d[x].push(Infinity); }
    const q = [];
    for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) {
      if (G.g[x][y].term) { d[x][y] = 0; q.push([x, y]); }
    }
    const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let h = 0; h < q.length; h++) {
      const x = q[h][0], y = q[h][1];
      STEP.forEach(s => {
        const nx = x + s[0], ny = y + s[1];
        if (nx < 0 || ny < 0 || nx >= G.W || ny >= G.H) return;
        const c = G.g[nx][ny];
        if (c.wall || c.term) return;
        if (d[nx][ny] > d[x][y] + 1) { d[nx][ny] = d[x][y] + 1; q.push([nx, ny]); }
      });
    }
    return d;
  }
  /* what a square is worth if no news has reached it yet: just k step-fees */
  function spBlind(k) {
    const R = SP.cfg.R, g = SP.cfg.gamma;
    if (k <= 0) return 0;
    if (Math.abs(g - 1) < 1e-12) return R * k;
    return R * (1 - Math.pow(g, k)) / (1 - g);
  }
  function spStep(dir, fromSlider) {
    const total = SP.res ? SP.res.hist.length : 1;
    if (dir === 'play') { IX.play('sp', total, () => SP.frame, f => { SP.frame = f; spRender(); }, 900); spRender(); return; }
    IX.stop('sp');
    if (dir === 'first') SP.frame = 0;
    else if (dir === 'last') SP.frame = total - 1;
    else if (typeof dir === 'number' && fromSlider) SP.frame = dir;
    else SP.frame = Math.max(0, Math.min(total - 1, SP.frame + dir));
    spRender();
  }
  function spRender() {
    const out = document.getElementById('sp-output');
    if (!out) return;
    if (SP.err) { out.innerHTML = `<div class="tool-error">${SP.err}</div>`; return; }
    const G = SP.G, d = SP.dist, k = SP.frame, U = SP.res.hist[k];
    const now = spBlind(k), prev = spBlind(Math.max(0, k - 1));
    const moved = (v, base) => Math.abs(v - base) > 1e-9;
    let informed = 0, live = 0, justNow = 0, maxD = 0;
    for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) {
      const c = G.g[x][y];
      if (c.wall || c.term) continue;
      live++;
      if (isFinite(d[x][y])) maxD = Math.max(maxD, d[x][y]);
      const hereNow = moved(U[x][y], now);
      const herePrev = k > 0 && moved(SP.res.hist[k - 1][x][y], prev);
      if (hereNow) informed++;
      if (hereNow && !herePrev) justNow++;
    }
    let grid = '<table class="gw"><tbody>';
    for (let y = G.H - 1; y >= 0; y--) {
      grid += '<tr>';
      for (let x = 0; x < G.W; x++) {
        const c = G.g[x][y];
        if (c.wall) { grid += '<td class="gw-wall"></td>'; continue; }
        if (c.term) {
          grid += `<td class="${c.r >= 0 ? 'term-pos' : 'term-neg'}"><strong>${c.r > 0 ? '+' : ''}${c.r}</strong>
            <span class="gw-label">source</span></td>`;
          continue;
        }
        const dd = d[x][y], v = U[x][y];
        const heard = moved(v, now);
        const fresh = heard && !(k > 0 && moved(SP.res.hist[k - 1][x][y], prev));
        const bg = !heard ? 'background:var(--surface-2);'
          : fresh ? 'background:var(--tint-a2); box-shadow:inset 0 0 0 2px var(--accent);'
          : (v >= 0 ? 'background:rgba(var(--accent3-rgb),' + Math.min(0.28, Math.abs(v) * 0.3).toFixed(3) + ');'
                    : 'background:rgba(var(--accent2-rgb),' + Math.min(0.28, Math.abs(v) * 0.5).toFixed(3) + ');');
        grid += `<td style="${bg}">
          <strong style="color:${heard ? 'var(--ink)' : 'var(--ink-muted)'};">${mdpFmt(v)}</strong>
          <span class="gw-label">${!heard ? 'unmoved · d=' + dd : fresh ? 'just moved' : 'd = ' + dd}</span></td>`;
      }
      grid += '</tr>';
    }
    grid += '</tbody></table>';
    let html = `<div class="gw-wrap">${grid}</div>`;
    html += IX.player('sp', k, SP.res.hist.length, `after <strong>${k}</strong> sweep${k === 1 ? '' : 's'}`,
      informed === live ? ['done', 'whole grid informed'] : ['assign', 'spreading']);
    html += `<div class="metrics">
      <div class="metric"><div class="mn">sweeps done</div><div class="mv">${k}</div><div class="mf">U<sub>${k}</sub></div></div>
      <div class="metric"><div class="mn">squares whose value has moved</div><div class="mv">${informed} / ${live}</div><div class="mf">off the do-nothing baseline of ${mdpFmt(now)}</div></div>
      <div class="metric"><div class="mn">moved this sweep</div><div class="mv">${justNow || '—'}</div><div class="mf">${justNow ? 'the outlined ring' : 'nothing new this sweep'}</div></div>
      <div class="metric dim"><div class="mn">furthest square</div><div class="mv">d = ${maxD}</div><div class="mf">news cannot arrive before sweep d</div></div>
    </div>`;
    let note;
    if (k === 0) note = `<strong>Nothing has happened yet.</strong> Every non-terminal square is set to <strong>0</strong> — not because it is worth nothing, but because we have no idea yet and have to start somewhere. The only real information in the whole grid is the two terminals.`;
    else if (informed < live) note = `<strong>After ${k} sweep${k === 1 ? '' : 's'}, ${informed} square${informed === 1 ? '' : 's'} ${informed === 1 ? 'has' : 'have'} moved off the baseline of ${mdpFmt(now)}.</strong>
      The rest averaged over neighbours that were all still on the baseline, so they got <code>R + γ·(baseline)</code> and nothing more.
      <strong>News travels one square per sweep — a square d steps from a terminal cannot possibly move before sweep d.</strong>`;
    else note = `<strong>Every square has now moved off the baseline.</strong> From here the sweeps stop spreading news and start refining numbers — the values shift by smaller and smaller amounts until δ drops under the threshold and value iteration stops.`;
    if (k >= 1 && informed < live) {
      let lag = 0;
      for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) {
        const c = G.g[x][y];
        if (!c.wall && !c.term && d[x][y] <= k && !moved(U[x][y], now)) lag++;
      }
      if (lag) note += `<br><br><strong>${lag} square${lag === 1 ? ' is' : 's are'} close enough to have heard, yet still sitting on the baseline.</strong>
        Those are the ones next to the <strong>−1</strong>. Bad news does not change what a square is worth until it forces you to take a worse route —
        and right now the best action there is simply to step away from the pit, which costs exactly what doing nothing costs.
        <strong>Good news spreads visibly; bad news only shows up once it starts closing off routes.</strong>`;
    }
    html += `<div class="verdict ${informed === live ? 'safe' : 'warn'}" style="margin-top:12px;">${note}</div>`;
    html += `<p class="ix-hint">The grid, R, γ and the slip probability all come from the <a href="#v-tool" onclick="showSection('t4-vi')">solver below</a> — change them there and this picture follows.
      <strong>The thing to watch is the outlined ring</strong> — the squares whose value moved for the first time this sweep. It spreads out from the <strong>+1</strong> one square per sweep, like a stone dropped in water.</p>`;
    out.innerHTML = html;
  }
  function runSpread() {
    const out = document.getElementById('sp-output');
    if (!out) return;
    const cfg = mdpSetup(), G = cfg.G;
    if (!G.W || (G.errs && G.errs.length)) { SP.err = 'Fix the grid in the solver below first.'; spRender(); return; }
    SP.err = ''; SP.G = G; SP.cfg = cfg;
    SP.dist = spDist(G);
    SP.res = mdpVI(G, cfg.R, cfg.gamma, cfg.pMain, 1e-4, 300);
    if (SP.frame > SP.res.hist.length - 1) SP.frame = SP.res.hist.length - 1;
    spRender();
  }
  TOOL_RUNNERS.runSpread = runSpread;
  /* ---------- W5: confusion matrix driven by a decision threshold ---------- */
  const CM = { mode: 'counts', n: 2000, prev: 0.05, sep: 1.8, thr: 0.5 };
  function cmMode(m) { CM.mode = m; runCM(); }
  function cmSlide(k, v) { CM[k] = Number(v); runCM(); }
  /* two logistic-ish score distributions; returns counts at the current threshold */
  function cmSimulate() {
    const n = CM.n, pos = Math.max(1, Math.round(n * CM.prev)), neg = n - pos;
    const bins = 60;
    const pdf = (x, mu, s) => Math.exp(-0.5 * Math.pow((x - mu) / s, 2));
    const muN = 0.5 - CM.sep * 0.12, muP = 0.5 + CM.sep * 0.12, sd = 0.16;
    const hN = [], hP = [];
    let sN = 0, sP = 0;
    for (let i = 0; i < bins; i++) {
      const x = (i + 0.5) / bins;
      const a = pdf(x, muN, sd), b = pdf(x, muP, sd);
      hN.push(a); hP.push(b); sN += a; sP += b;
    }
    let tp = 0, fn = 0, fp = 0, tn = 0;
    for (let i = 0; i < bins; i++) {
      const x = (i + 0.5) / bins;
      const cN = neg * hN[i] / sN, cP = pos * hP[i] / sP;
      if (x >= CM.thr) { tp += cP; fp += cN; } else { fn += cP; tn += cN; }
    }
    return { tp: Math.round(tp), fp: Math.round(fp), fn: Math.round(fn), tn: Math.round(tn),
             hN: hN, hP: hP, sN: sN, sP: sP, pos: pos, neg: neg, bins: bins };
  }
  function cmCurve(sim) {
    /* precision & recall as the threshold sweeps 0 → 1 */
    const pts = [];
    for (let t = 0; t <= 50; t++) {
      const th = t / 50;
      let tp = 0, fp = 0, fn = 0;
      for (let i = 0; i < sim.bins; i++) {
        const x = (i + 0.5) / sim.bins;
        const cN = sim.neg * sim.hN[i] / sim.sN, cP = sim.pos * sim.hP[i] / sim.sP;
        if (x >= th) { tp += cP; fp += cN; } else { fn += cP; }
      }
      const p = (tp + fp) > 0 ? tp / (tp + fp) : null, r = (tp + fn) > 0 ? tp / (tp + fn) : 0;
      pts.push({ th: th, p: p, r: r, f1: (p !== null && p + r > 0) ? 2 * p * r / (p + r) : 0 });
    }
    return pts;
  }
  function cmChart(sim) {
    const W = 460, H = 190, pad = 34;
    const maxH = Math.max.apply(null, sim.hN.map((v, i) => Math.max(sim.neg * v / sim.sN, sim.pos * sim.hP[i] / sim.sP)));
    const bx = i => pad + (i / sim.bins) * (W - pad - 14);
    const by = c => H - 26 - (c / (maxH || 1)) * (H - 52);
    let g = '';
    for (let i = 0; i < sim.bins; i++) {
      const cN = sim.neg * sim.hN[i] / sim.sN, cP = sim.pos * sim.hP[i] / sim.sP;
      const wdt = (W - pad - 14) / sim.bins + 0.6;
      const past = (i + 0.5) / sim.bins >= CM.thr;
      g += `<rect x="${bx(i).toFixed(1)}" y="${by(cN).toFixed(1)}" width="${wdt.toFixed(1)}" height="${(H - 26 - by(cN)).toFixed(1)}" fill="var(--ink-muted)" opacity="${past ? 0.55 : 0.25}"/>`;
      g += `<rect x="${bx(i).toFixed(1)}" y="${by(cP).toFixed(1)}" width="${wdt.toFixed(1)}" height="${(H - 26 - by(cP)).toFixed(1)}" fill="var(--accent-2)" opacity="${past ? 0.85 : 0.35}"/>`;
    }
    const tx = pad + CM.thr * (W - pad - 14);
    g += `<line x1="${tx.toFixed(1)}" y1="12" x2="${tx.toFixed(1)}" y2="${H - 26}" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="6 3"/>`;
    g += `<text x="${tx.toFixed(1)}" y="9" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--accent)">threshold ${CM.thr.toFixed(2)}</text>`;
    g += `<line x1="${pad}" y1="${H - 26}" x2="${W - 14}" y2="${H - 26}" stroke="var(--ink-muted)"/>`;
    g += `<text x="${pad}" y="${H - 12}" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">score 0</text>`;
    g += `<text x="${W - 14}" y="${H - 12}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">1</text>`;
    g += `<text x="${W - 14}" y="22" text-anchor="end" font-family="IBM Plex Sans" font-size="10.5" fill="var(--accent-2)">■ actually positive</text>`;
    g += `<text x="${W - 14}" y="35" text-anchor="end" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)">■ actually negative</text>`;
    return `<div class="chartbox"><svg width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + '<title>Score distributions and the decision threshold</title>'
      + '<desc>Two overlapping score distributions; everything right of the dashed threshold is predicted positive.</desc>'
      + g + '</svg><div class="caption">Everything to the <strong>right</strong> of the dashed line is predicted positive. Slide it and watch the four counts trade off.</div></div>';
  }
  function cmPRChart(pts) {
    const W = 460, H = 180, pad = 40;
    const cx = r => pad + r * (W - pad - 16), cy = p => H - 30 - p * (H - 52);
    let path = '', f1p = '';
    pts.forEach((q, i) => {
      if (q.p === null) return;
      path += (path ? ' L' : 'M') + cx(q.r).toFixed(1) + ',' + cy(q.p).toFixed(1);
      f1p += (f1p ? ' L' : 'M') + cx(q.r).toFixed(1) + ',' + cy(q.f1).toFixed(1);
    });
    let cur = pts.reduce((a, b) => Math.abs(b.th - CM.thr) < Math.abs(a.th - CM.thr) ? b : a, pts[0]);
    let g = `<line x1="${pad}" y1="12" x2="${pad}" y2="${H - 30}" stroke="var(--ink-muted)"/>`
      + `<line x1="${pad}" y1="${H - 30}" x2="${W - 16}" y2="${H - 30}" stroke="var(--ink-muted)"/>`
      + `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`
      + `<path d="${f1p}" fill="none" stroke="var(--accent-3)" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    if (cur.p !== null) g += `<circle cx="${cx(cur.r).toFixed(1)}" cy="${cy(cur.p).toFixed(1)}" r="5" fill="var(--accent-2)"/>`;
    g += `<text x="${(W - 16)}" y="${H - 12}" text-anchor="end" font-family="IBM Plex Sans" font-size="10" fill="var(--ink-muted)">recall →</text>`;
    g += `<text x="${pad - 6}" y="18" text-anchor="end" font-family="IBM Plex Sans" font-size="10" fill="var(--ink-muted)">1</text>`;
    g += `<text x="${pad + 6}" y="18" font-family="IBM Plex Sans" font-size="10.5" fill="var(--accent)">— precision</text>`;
    g += `<text x="${pad + 90}" y="18" font-family="IBM Plex Sans" font-size="10.5" fill="var(--accent-3)">-- F1</text>`;
    return `<div class="chartbox"><svg width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + '<title>Precision–recall curve</title><desc>Precision against recall as the threshold sweeps; the dot is the current threshold.</desc>'
      + g + '</svg><div class="caption">The precision–recall trade-off. <strong>You cannot move right without moving down</strong> — that is why one number alone never settles it.</div></div>';
  }
  function runCM() {
    const out = document.getElementById('cm-output');
    if (!out) return;
    let tp, fp, fn, tn, sim = null, preset = null;
    if (CM.mode === 'threshold') {
      sim = cmSimulate();
      tp = sim.tp; fp = sim.fp; fn = sim.fn; tn = sim.tn;
    } else {
      tp = cmNum('cm-tp'); fp = cmNum('cm-fp'); fn = cmNum('cm-fn'); tn = cmNum('cm-tn');
      const bad = [];
      [['TP', tp], ['FP', fp], ['FN', fn], ['TN', tn]].forEach(p => {
        if (isNaN(p[1])) bad.push(p[0] + ' is not a number');
        else if (p[1] < 0) bad.push(p[0] + ' cannot be negative');
        else if (p[1] !== Math.round(p[1])) bad.push(p[0] + ' should be a whole count');
      });
      if (bad.length) { out.innerHTML = `<div class="tool-error">${bad.map(esc).join('<br>')}</div>`; return; }
      const sel = document.getElementById('cm-preset');
      const pr = sel ? CM_PRESETS[sel.value] : null;
      if (pr && pr.tp === tp && pr.fp === fp && pr.fn === fn && pr.tn === tn) preset = pr;
    }
    const total = tp + fp + fn + tn;
    if (total === 0) { out.innerHTML = '<div class="tool-error">All four counts are zero — there is nothing to measure.</div>'; return; }
    const acc = (tp + tn) / total;
    const prec = (tp + fp) > 0 ? tp / (tp + fp) : null;
    const rec = (tp + fn) > 0 ? tp / (tp + fn) : null;
    const spec = (tn + fp) > 0 ? tn / (tn + fp) : null;
    const f1 = (prec !== null && rec !== null && (prec + rec) > 0) ? 2 * prec * rec / (prec + rec) : null;
    const pos = tp + fn, prev = pos / total;
    let html = `<div class="ix-bar"><span class="ix-lab">mode:</span>
      <button class="ix-btn ${CM.mode === 'counts' ? 'on' : ''}" onclick="cmMode('counts')">type the four counts</button>
      <button class="ix-btn ${CM.mode === 'threshold' ? 'on' : ''}" onclick="cmMode('threshold')">slide a decision threshold</button></div>`;
    if (CM.mode === 'threshold') {
      html += cmChart(sim);
      html += `<div class="ix-bar">
        <span class="ix-lab">threshold <strong>${CM.thr.toFixed(2)}</strong></span>
        <input type="range" min="0" max="1" step="0.01" value="${CM.thr}" oninput="cmSlide('thr', this.value)" aria-label="Decision threshold">
      </div><div class="ix-bar">
        <span class="ix-lab">prevalence <strong>${(CM.prev * 100).toFixed(1)}%</strong></span>
        <input type="range" min="0.005" max="0.5" step="0.005" value="${CM.prev}" oninput="cmSlide('prev', this.value)" aria-label="Prevalence">
        <span class="ix-lab">how good the model is <strong>${CM.sep.toFixed(1)}</strong></span>
        <input type="range" min="0" max="4" step="0.1" value="${CM.sep}" oninput="cmSlide('sep', this.value)" aria-label="Class separation">
      </div>`;
      html += `<p class="ix-hint"><strong>Drag the threshold</strong> and watch the four counts trade against each other — there is no setting that
        makes both precision and recall perfect. <strong>Drag prevalence down to 1%</strong> and push the threshold to the right:
        accuracy stays near 99% the whole way while recall collapses. That is the rare-disease example, live.</p>`;
    } else if (preset) html += `<div class="verdict warn">${preset.note}</div>`;
    html += `<table class="cmx"><tr><td class="corner"></td><th colspan="2">Actually</th><th>row total</th></tr>
      <tr><td class="corner"></td><th>positive</th><th>negative</th><th></th></tr>
      <tr><th>predicted positive</th><td class="tp">${tp}<span class="lbl">TP</span></td><td class="fp">${fp}<span class="lbl">FP</span></td><td>${tp + fp}</td></tr>
      <tr><th>predicted negative</th><td class="fn">${fn}<span class="lbl">FN</span></td><td class="tn">${tn}<span class="lbl">TN</span></td><td>${fn + tn}</td></tr>
      <tr><th>column total</th><td>${pos}</td><td>${fp + tn}</td><td>${total}</td></tr></table>`;
    const cls = v => v === null ? 'dim' : (v >= 0.8 ? 'good' : v < 0.5 ? 'warn' : '');
    html += '<div class="metrics">';
    html += `<div class="metric ${cls(acc)}"><div class="mn">accuracy</div><div class="mv">${cmFmt(acc)}</div><div class="mf">(${tp}+${tn}) / ${total}</div></div>`;
    html += `<div class="metric ${cls(prec)}"><div class="mn">precision</div><div class="mv">${prec === null ? 'undef.' : cmFmt(prec)}</div><div class="mf">${tp} / (${tp}+${fp})${prec === null ? ' = 0/0' : ''}</div></div>`;
    html += `<div class="metric ${cls(rec)}"><div class="mn">recall · sensitivity</div><div class="mv">${rec === null ? 'undef.' : cmFmt(rec)}</div><div class="mf">${tp} / (${tp}+${fn})${rec === null ? ' = 0/0' : ''}</div></div>`;
    html += `<div class="metric ${cls(spec)}"><div class="mn">specificity</div><div class="mv">${spec === null ? 'undef.' : cmFmt(spec)}</div><div class="mf">${tn} / (${tn}+${fp})</div></div>`;
    html += `<div class="metric ${cls(f1)}"><div class="mn">F1 score</div><div class="mv">${f1 === null ? 'undef.' : cmFmt(f1)}</div><div class="mf">2PR / (P+R)</div></div>`;
    html += `<div class="metric dim"><div class="mn">prevalence</div><div class="mv">${cmFmt(prev)}</div><div class="mf">${pos} / ${total} really positive</div></div>`;
    html += '</div>';
    if (CM.mode === 'threshold') html += cmPRChart(cmCurve(sim));
    const notes = [];
    if (prec === null) notes.push('<strong>Precision is undefined</strong> — the model never predicted positive, so TP + FP = 0 and the fraction is 0/0. It cannot even be computed, let alone expose the problem.');
    if (rec !== null && rec === 0 && pos > 0) notes.push(`<strong>Recall is 0</strong> — not one of the ${pos} real positive cases was caught. This is the number that exposes the model, whatever accuracy says.`);
    if (acc >= 0.9 && rec !== null && rec < 0.2) notes.push(`<strong>${cmFmt(acc * 100, 1)}% accurate and it catches almost nothing.</strong> Accuracy is high only because ${cmFmt((1 - prev) * 100, 1)}% of the test set is negative and the model gets those for free.`);
    if (prec !== null && rec !== null && prec >= 0.95 && rec < 0.2) notes.push(`<strong>Precision is ${cmFmt(prec, 2)} — it looks perfect</strong> — while recall is ${cmFmt(rec, 2)}. <em>This is the point: sensitivity, not precision, reveals the weakness.</em>`);
    if (prec !== null && rec !== null && rec >= 0.95 && prec < 0.3) notes.push('<strong>Recall is near-perfect and precision is poor</strong> — the mirror failure. The model flags nearly everything, so it misses nothing and is right about almost none of it.');
    if (f1 !== null && prec !== null && rec !== null) {
      const arith = (prec + rec) / 2;
      if (arith - f1 > 0.1) notes.push(`The harmonic mean at work: the ordinary average of precision and recall would be <strong>${cmFmt(arith, 3)}</strong>, but F1 is <strong>${cmFmt(f1, 3)}</strong>. F1 is dragged towards the <em>smaller</em> of the two.`);
    }
    if (Math.abs(prev - 0.5) < 0.06 && pos > 0) notes.push('This test set is roughly <strong>balanced</strong>, so accuracy is meaningful again — the always-"no" trick would score about 50% here, not 99%.');
    if (notes.length) html += '<div class="verdict ' + (rec !== null && rec < 0.2 && acc > 0.9 ? 'bad' : 'warn') + '">' + notes.join('<br><br>') + '</div>';
    html += `<p style="font-size:12.5px; color:var(--ink-muted); margin-top:10px;">
      <strong>Neither precision nor recall uses TN</strong> — which is exactly why they survive class imbalance and accuracy does not.</p>`;
    out.innerHTML = html;
  }
  TOOL_RUNNERS.runCM = runCM;
  TOOL_RUNNERS.cmPreset = runCM;
  /* ---------- W5: regression metrics with a draggable scatter ---------- */
  const RG = { pts: [], sel: -1, lo: 0, hi: 10 };
  const RG_W = 400, RG_H = 300, RG_PAD = 42;
  function rgCx(v) { return RG_PAD + (v - RG.lo) / (RG.hi - RG.lo) * (RG_W - RG_PAD - 18); }
  function rgCy(v) { return RG_H - RG_PAD - (v - RG.lo) / (RG.hi - RG.lo) * (RG_H - RG_PAD - 20); }
  function rgUy(py) { return RG.lo + (RG_H - RG_PAD - py) / (RG_H - RG_PAD - 20) * (RG.hi - RG.lo); }
  function rgSync() {
    const a = document.getElementById('rg-pred'), b = document.getElementById('rg-true');
    if (a) a.value = RG.pts.map(p => clNum(p.p, Number.isInteger(p.p) ? 0 : 2)).join('  ');
    if (b) b.value = RG.pts.map(p => clNum(p.y, Number.isInteger(p.y) ? 0 : 2)).join('  ');
  }
  function rgMove(px, py, key) {
    const i = parseInt(key, 10);
    if (!RG.pts[i]) return;
    let v = Math.round(rgUy(py) * 10) / 10;
    /* let the axis grow if you drag past the edge — that is how you build an outlier */
    const span = RG.hi - RG.lo;
    if (v > RG.hi - span * 0.04) RG.hi = Math.ceil(v + span * 0.12);
    if (v < RG.lo + span * 0.04) RG.lo = Math.floor(v - span * 0.12);
    RG.pts[i].p = v;
    rgRender();
  }
  function rgReset() {
    RG.pts.forEach(p => p.p = p.y);
    rgSync(); rgRender();
  }
  function rgRender() {
    const out = document.getElementById('rg-output');
    if (!out) return;
    const n = RG.pts.length;
    let sAbs = 0, sSq = 0, worst = 0, worstI = 0;
    RG.pts.forEach((r, i) => {
      const e = r.p - r.y, a = Math.abs(e);
      sAbs += a; sSq += e * e;
      if (a > worst) { worst = a; worstI = i; }
    });
    const mae = sAbs / n, mse = sSq / n, rmse = Math.sqrt(mse);
    /* the scatter: true value on x, prediction on y, perfect = the diagonal */
    let g = `<line x1="${rgCx(RG.lo)}" y1="${rgCy(RG.lo)}" x2="${rgCx(RG.hi)}" y2="${rgCy(RG.hi)}" stroke="var(--accent-3)" stroke-width="1.6" stroke-dasharray="5 3"/>`;
    g += `<line x1="${RG_PAD}" y1="14" x2="${RG_PAD}" y2="${RG_H - RG_PAD}" stroke="var(--ink-muted)"/>`;
    g += `<line x1="${RG_PAD}" y1="${RG_H - RG_PAD}" x2="${RG_W - 18}" y2="${RG_H - RG_PAD}" stroke="var(--ink-muted)"/>`;
    RG.pts.forEach((r, i) => {
      const X = rgCx(r.y), Y = rgCy(r.p), Y0 = rgCy(r.y);
      g += `<line x1="${X.toFixed(1)}" y1="${Y0.toFixed(1)}" x2="${X.toFixed(1)}" y2="${Y.toFixed(1)}" stroke="${i === worstI && n > 1 ? 'var(--accent-2)' : 'var(--ink-muted)'}" stroke-width="${i === worstI && n > 1 ? 3 : 1.5}" opacity="0.8"/>`;
      g += `<circle class="grab" data-ix="${i}" cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="7" fill="${i === worstI && n > 1 ? 'var(--accent-2)' : 'var(--accent)'}" stroke="var(--surface)" stroke-width="1.5"/>`;
    });
    g += `<text x="${RG_W - 18}" y="${RG_H - 14}" text-anchor="end" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)">true value y →</text>`;
    g += `<text x="16" y="${RG_H / 2}" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)" transform="rotate(-90 16 ${RG_H / 2})">prediction ŷ →</text>`;
    g += `<text x="${rgCx(RG.hi) - 4}" y="${rgCy(RG.hi) + 16}" text-anchor="end" font-family="IBM Plex Sans" font-size="10" fill="var(--accent-3)">perfect prediction</text>`;
    let html = `<div class="ix-canvas"><svg id="rg-svg" width="100%" viewBox="0 0 ${RG_W} ${RG_H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + '<title>Predictions against true values</title><desc>Each dot is a prediction; the vertical line is its residual, and the dashed diagonal is a perfect prediction.</desc>'
      + g + '</svg></div>';
    html += `<div class="ix-bar"><button class="ix-btn" onclick="rgReset()">set every prediction to the truth</button>
      <span class="ix-lab">drag a dot up or down to change its prediction</span></div>`;
    html += `<p class="ix-hint"><strong>Drag one dot far from the diagonal</strong> and watch the numbers below: MAE moves a little, <strong>MSE moves enormously</strong>.
      That is the entire practical difference between them, and the reason RMSE exists is to put MSE back into the original units.</p>`;
    html += `<div class="metrics">
      <div class="metric"><div class="mn">MAE</div><div class="mv">${cmFmt(mae)}</div><div class="mf">${cmFmt(sAbs, 4)} / ${n}</div></div>
      <div class="metric"><div class="mn">MSE</div><div class="mv">${cmFmt(mse)}</div><div class="mf">${cmFmt(sSq, 4)} / ${n}</div></div>
      <div class="metric"><div class="mn">RMSE</div><div class="mv">${cmFmt(rmse)}</div><div class="mf">√${cmFmt(mse, 4)}</div></div>
      <div class="metric dim"><div class="mn">n</div><div class="mv">${n}</div><div class="mf">predictions</div></div>
      <div class="metric dim"><div class="mn">largest error</div><div class="mv">${cmFmt(worst, 3)}</div><div class="mf">at point ${worstI + 1}</div></div>
    </div>`;
    html += '<table><tr><th>i</th><th>ŷᵢ</th><th>yᵢ</th><th>residual</th><th>|ŷᵢ − yᵢ|</th><th>(ŷᵢ − yᵢ)²</th></tr>';
    RG.pts.forEach((r, i) => {
      const e = r.p - r.y;
      const hot = i === worstI && n > 1 ? ' style="background:var(--tint-b2);"' : '';
      html += `<tr${hot}><td>${i + 1}</td><td><code>${clNum(r.p, 2)}</code></td><td><code>${clNum(r.y, 2)}</code></td>
        <td><code>${cmFmt(e, 4)}</code></td><td><code>${cmFmt(Math.abs(e), 4)}</code></td><td><code>${cmFmt(e * e, 4)}</code></td></tr>`;
    });
    html += `<tr style="font-weight:600;"><td colspan="4" style="text-align:right;">sum</td><td><code>${cmFmt(sAbs, 4)}</code></td><td><code>${cmFmt(sSq, 4)}</code></td></tr></table>`;
    const share = sSq > 0 ? (worst * worst) / sSq : 0;
    const notes = [`<strong>RMSE ≥ MAE</strong> — ${cmFmt(rmse, 4)} vs ${cmFmt(mae, 4)}. They are equal only when every error has the same size; the gap here is <strong>${cmFmt(rmse - mae, 4)}</strong>, a measure of how uneven your errors are.`];
    if (n > 1 && share > 0.5) notes.push(`Point <strong>${worstI + 1}</strong> alone accounts for <strong>${cmFmt(share * 100, 1)}%</strong> of the squared error, but only ${cmFmt(100 * worst / sAbs, 1)}% of the absolute error. <strong>That is MSE's outlier sensitivity in one number.</strong>`);
    html += '<div class="verdict warn" style="margin-top:12px;">' + notes.join('<br><br>') + '</div>';
    out.innerHTML = html;
    const svg = document.getElementById('rg-svg');
    if (svg) IX.drag(svg, { W: RG_W, H: RG_H, onMove: rgMove, onDrop: rgSync });
  }
  function runReg() {
    const out = document.getElementById('rg-output');
    if (!out) return;
    const P = rgNums(document.getElementById('rg-pred').value);
    const Y = rgNums(document.getElementById('rg-true').value);
    const bad = P.concat(Y).filter(o => isNaN(o.v));
    if (bad.length) { out.innerHTML = `<div class="tool-error">Not a number: ${bad.slice(0, 6).map(o => esc(o.raw)).join(', ')}</div>`; return; }
    if (!P.length) { out.innerHTML = '<div class="tool-error">Give at least one prediction.</div>'; return; }
    if (P.length !== Y.length) { out.innerHTML = `<div class="tool-error">${P.length} prediction${P.length === 1 ? '' : 's'} but ${Y.length} true value${Y.length === 1 ? '' : 's'} — they must match up one for one.</div>`; return; }
    if (P.length > 60) { out.innerHTML = '<div class="tool-error">Sixty values at most for the canvas.</div>'; return; }
    RG.pts = P.map((o, i) => ({ p: o.v, y: Y[i].v }));
    let lo = Infinity, hi = -Infinity;
    RG.pts.forEach(r => { lo = Math.min(lo, r.p, r.y); hi = Math.max(hi, r.p, r.y); });
    const pad = Math.max(1, (hi - lo) * 0.15);
    RG.lo = Math.floor(lo - pad); RG.hi = Math.ceil(hi + pad);
    rgRender();
  }
  TOOL_RUNNERS.runReg = runReg;
