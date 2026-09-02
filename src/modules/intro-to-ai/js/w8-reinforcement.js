  /* ============================================================
     W8 · REINFORCEMENT LEARNING
       k-armed bandits · action values · ε-greedy · UCB
     ============================================================ */
  /* deterministic RNG so every run is reproducible and every claim checkable */
  function rlRng(seed) {
    /* splitmix32: every output is a hash of the counter, so a freshly seeded
       generator is already well distributed on its very first call — which
       matters because bdChoose reseeds once per step. */
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x9E3779B9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x21F0AAAD) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735A2D97) >>> 0;
      return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
    };
  }
  function rlNorm(rnd) {
    let u = 0, v = 0;
    while (u <= 1e-12) u = rnd();
    while (v <= 1e-12) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function rlPdf(x, mu, sd) { const z = (x - mu) / sd; return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI)); }
  function rlN(v, dp) {
    if (v === null || v === undefined || !isFinite(v)) return v === Infinity ? '∞' : '—';
    const r = Math.round(v * 1e7) / 1e7;
    if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
    const d = dp === undefined ? 4 : dp;
    return String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
  }
  function rlSign(v, dp) { const s = rlN(v, dp); return String(s).replace(/^-/, '−'); }
  /* argmax with the course's tie rule: lowest index wins */
  function rlArgmax(vals) {
    let bi = 0;
    for (let i = 1; i < vals.length; i++) if (vals[i] > vals[bi] + 1e-12) bi = i;
    const ties = [];
    for (let i = 0; i < vals.length; i++) if (Math.abs(vals[i] - vals[bi]) < 1e-12) ties.push(i);
    return { i: bi, ties: ties };
  }

  /* ------------------------------------------------------------
     TOOL · play a k-armed bandit  (runBandit)
     ------------------------------------------------------------ */
  const BD = { arms: [], hist: [], seed: 7, draws: 0, reveal: false, policy: 'you', eps: 0.1, c: 2, err: '' };
  const BD_W = 470, BD_H = 300, BD_L = 44, BD_R = 14, BD_T = 14, BD_B = 46;
  function bdQ(i) { let s = 0, n = 0; BD.hist.forEach(h => { if (h.a === i) { s += h.r; n++; } }); return { q: n ? s / n : 0, n: n, s: s }; }
  function bdBest() { let bi = 0; BD.arms.forEach((a, i) => { if (a.mu > BD.arms[bi].mu) bi = i; }); return bi; }
  function bdSample(i) {
    const rnd = rlRng(BD.seed * 7919 + BD.draws * 104729 + i * 6151);
    BD.draws++;
    return BD.arms[i].mu + BD.arms[i].sd * rlNorm(rnd);
  }
  function bdPull(i) {
    if (!BD.arms[i] || BD.hist.length >= 4000) return;
    BD.hist.push({ a: i, r: bdSample(i) });
    bdRender();
  }
  function bdChoose() {
    const t = BD.hist.length + 1, k = BD.arms.length;
    const rnd = rlRng(BD.seed * 3571 + t * 97);
    if (BD.policy === 'random') return Math.floor(rnd() * k) % k;
    if (BD.policy === 'ucb') {
      const v = BD.arms.map((_, i) => { const s = bdQ(i); return s.n === 0 ? Infinity : s.q + BD.c * Math.sqrt(Math.log(t) / s.n); });
      return rlArgmax(v).i;
    }
    const explore = BD.policy === 'eps' && rnd() < BD.eps;
    if (explore) return Math.floor(rlRng(BD.seed * 131 + t * 31)() * k) % k;
    const v = BD.arms.map((_, i) => bdQ(i).q);
    const am = rlArgmax(v);
    return am.ties[Math.floor(rlRng(BD.seed * 17 + t * 7)() * am.ties.length) % am.ties.length];
  }
  function bdRun(n) {
    if (BD.policy === 'you') return;
    for (let s = 0; s < n && BD.hist.length < 4000; s++) { const i = bdChoose(); BD.hist.push({ a: i, r: bdSample(i) }); }
    bdRender();
  }
  function bdSet(k, v) { BD[k] = (k === 'policy') ? v : Number(v); bdRender(); }
  function bdTog(k) { BD[k] = !BD[k]; bdRender(); }
  function bdReset(newSeed) { BD.hist = []; BD.draws = 0; if (newSeed) BD.seed = (BD.seed * 1103515245 + 12345) & 0x7fffffff; bdRender(); }
  function bdUndo() { BD.hist.pop(); bdRender(); }
  function bdRender() {
    const out = document.getElementById('bd-output');
    if (!out) return;
    if (BD.err) { out.innerHTML = `<div class="tool-error">${BD.err}</div>`; return; }
    const k = BD.arms.length, best = bdBest();
    let lo = Infinity, hi = -Infinity;
    BD.arms.forEach(a => { lo = Math.min(lo, a.mu - 3.2 * a.sd); hi = Math.max(hi, a.mu + 3.2 * a.sd); });
    BD.hist.forEach(h => { lo = Math.min(lo, h.r); hi = Math.max(hi, h.r); });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const cy = v => BD_H - BD_B - (v - lo) / (hi - lo) * (BD_H - BD_B - BD_T);
    const slot = (BD_W - BD_L - BD_R) / k, cxi = i => BD_L + slot * (i + 0.5);
    let maxPdf = 0;
    BD.arms.forEach(a => { maxPdf = Math.max(maxPdf, rlPdf(a.mu, a.mu, a.sd)); });
    let g = '';
    for (let q = 0; q <= 5; q++) {
      const v = lo + (hi - lo) * q / 5;
      g += `<line x1="${BD_L}" y1="${cy(v).toFixed(1)}" x2="${BD_W - BD_R}" y2="${cy(v).toFixed(1)}" stroke="var(--rule)" stroke-width="0.7"/>`;
      g += `<text x="${BD_L - 7}" y="${(cy(v) + 3.5).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-muted)">${rlN(v, 1)}</text>`;
    }
    BD.arms.forEach((a, i) => {
      const cx = cxi(i), half = slot * 0.36, st = bdQ(i);
      if (BD.reveal) {
        let up = '', dn = '';
        for (let s = 0; s <= 40; s++) {
          const y = a.mu - 3.2 * a.sd + (6.4 * a.sd) * s / 40;
          const w = (rlPdf(y, a.mu, a.sd) / maxPdf) * half;
          up += (s ? ' L ' : 'M ') + (cx - w).toFixed(1) + ' ' + cy(y).toFixed(1);
        }
        for (let s = 40; s >= 0; s--) {
          const y = a.mu - 3.2 * a.sd + (6.4 * a.sd) * s / 40;
          const w = (rlPdf(y, a.mu, a.sd) / maxPdf) * half;
          dn += ' L ' + (cx + w).toFixed(1) + ' ' + cy(y).toFixed(1);
        }
        g += `<path d="${up}${dn} Z" fill="${i === best ? 'var(--accent-3)' : 'var(--accent)'}" opacity="0.22" stroke="${i === best ? 'var(--accent-3)' : 'var(--accent)'}" stroke-width="1.2"/>`;
        g += `<line x1="${(cx - half).toFixed(1)}" y1="${cy(a.mu).toFixed(1)}" x2="${(cx + half).toFixed(1)}" y2="${cy(a.mu).toFixed(1)}" stroke="${i === best ? 'var(--accent-3)' : 'var(--accent-2)'}" stroke-width="1.8" stroke-dasharray="4 3"/>`;
        g += `<text x="${(cx + half + 3).toFixed(1)}" y="${(cy(a.mu) - 3).toFixed(1)}" font-family="IBM Plex Mono" font-size="9" fill="${i === best ? 'var(--accent-3)' : 'var(--accent-2)'}">q⋆=${rlN(a.mu, 2)}</text>`;
      }
      /* the clickable arm */
      g += `<rect class="hit" onclick="bdPull(${i})" x="${(cx - slot * 0.46).toFixed(1)}" y="${BD_T}" width="${(slot * 0.92).toFixed(1)}" height="${BD_H - BD_T - BD_B}" fill="transparent"/>`;
      /* every reward this arm actually paid */
      BD.hist.forEach((h, j) => {
        if (h.a !== i) return;
        const jitter = ((j * 37) % 11 - 5) / 5 * half * 0.55;
        g += `<circle cx="${(cx + jitter).toFixed(1)}" cy="${cy(h.r).toFixed(1)}" r="2.6" fill="var(--ink-muted)" opacity="0.5" pointer-events="none"/>`;
      });
      if (st.n) {
        g += `<line x1="${(cx - half).toFixed(1)}" y1="${cy(st.q).toFixed(1)}" x2="${(cx + half).toFixed(1)}" y2="${cy(st.q).toFixed(1)}" stroke="var(--accent-4)" stroke-width="2.6" pointer-events="none"/>`;
        g += `<text x="${(cx - half - 3).toFixed(1)}" y="${(cy(st.q) - 4).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono" font-size="9.5" fill="var(--accent-4)" pointer-events="none">Q=${rlN(st.q, 2)}</text>`;
      }
      g += `<text x="${cx.toFixed(1)}" y="${BD_H - BD_B + 16}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11.5" fill="var(--ink)" font-weight="600" pointer-events="none">${esc(a.name)}</text>`;
      g += `<text x="${cx.toFixed(1)}" y="${BD_H - BD_B + 29}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-muted)" pointer-events="none">N=${st.n}</text>`;
      g += `<text x="${cx.toFixed(1)}" y="${BD_H - BD_B + 41}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="var(--accent)" pointer-events="none">pull ▾</text>`;
    });
    let html = `<div class="ix-canvas"><svg width="100%" viewBox="0 0 ${BD_W} ${BD_H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + `<title>k-armed bandit</title><desc>One violin per arm showing its reward distribution, the rewards it has actually paid, and the current estimate Q.</desc>${g}</svg></div>`;
    html += `<div class="ix-bar"><span class="ix-lab"><strong>click an arm to pull it</strong></span>
      ${IX.toggles([{ label: 'reveal the true q⋆', on: BD.reveal, fn: "bdTog('reveal')" }])}
      <button class="ix-btn" onclick="bdUndo()" ${BD.hist.length ? '' : 'disabled'}>↶ undo</button>
      <button class="ix-btn" onclick="bdReset(false)">clear history</button>
      <button class="ix-btn" onclick="bdReset(true)">new luck (reseed)</button></div>`;
    html += `<div class="ix-bar"><span class="ix-lab">let a policy play</span>
      <select onchange="bdSet('policy', this.value)" data-nolive>
        <option value="you"${BD.policy === 'you' ? ' selected' : ''}>you (click above)</option>
        <option value="greedy"${BD.policy === 'greedy' ? ' selected' : ''}>greedy — Definition 8.5</option>
        <option value="random"${BD.policy === 'random' ? ' selected' : ''}>random — Definition 8.4</option>
        <option value="eps"${BD.policy === 'eps' ? ' selected' : ''}>ε-greedy — Definition 8.6</option>
        <option value="ucb"${BD.policy === 'ucb' ? ' selected' : ''}>UCB — Definition 8.7</option>
      </select>`;
    if (BD.policy === 'eps') html += `<span class="ix-lab">ε <strong>${rlN(BD.eps, 3)}</strong></span>
      <input type="range" min="0" max="1" step="0.01" value="${BD.eps}" oninput="bdSet('eps', this.value)" aria-label="epsilon">`;
    if (BD.policy === 'ucb') html += `<span class="ix-lab">c <strong>${rlN(BD.c, 2)}</strong></span>
      <input type="range" min="0" max="6" step="0.1" value="${BD.c}" oninput="bdSet('c', this.value)" aria-label="exploration parameter">`;
    html += `<button class="ix-btn" onclick="bdRun(1)" ${BD.policy === 'you' ? 'disabled' : ''}>▶ 1 step</button>
      <button class="ix-btn" onclick="bdRun(50)" ${BD.policy === 'you' ? 'disabled' : ''}>▶ 50</button>
      <button class="ix-btn" onclick="bdRun(500)" ${BD.policy === 'you' ? 'disabled' : ''}>▶ 500</button></div>`;
    const T = BD.hist.length;
    const tot = BD.hist.reduce((a, h) => a + h.r, 0);
    const nOpt = BD.hist.filter(h => h.a === best).length;
    const regret = BD.hist.reduce((a, h) => a + (BD.arms[best].mu - BD.arms[h.a].mu), 0);
    html += `<div class="metrics">
      <div class="metric"><div class="mn">steps taken</div><div class="mv">${T}</div><div class="mf">t = ${T + 1} next</div></div>
      <div class="metric"><div class="mn">average reward</div><div class="mv">${T ? rlSign(tot / T, 3) : '—'}</div><div class="mf">total ${rlSign(tot, 2)}</div></div>
      <div class="metric"><div class="mn">% optimal action</div><div class="mv">${T ? rlN(100 * nOpt / T, 1) + '%' : '—'}</div><div class="mf">${BD.reveal ? 'the best arm is <strong>' + esc(BD.arms[best].name) + '</strong>' : 'reveal q⋆ to see which'}</div></div>
      <div class="metric dim"><div class="mn">cumulative regret</div><div class="mv">${T ? rlSign(regret, 2) : '—'}</div><div class="mf">Σ (q⋆(best) − q⋆(chosen))</div></div>
    </div>`;
    html += '<table><tr><th>a</th><th>N<sub>t</sub>(a)</th><th>Σ rewards</th><th>Q<sub>t</sub>(a)</th>'
      + (BD.reveal ? '<th>q⋆(a)</th><th>error</th>' : '') + '</tr>';
    BD.arms.forEach((a, i) => {
      const st = bdQ(i), hot = i === best && BD.reveal ? ' style="background:var(--tint-c);"' : '';
      html += `<tr${hot}><td><strong>${esc(a.name)}</strong></td><td><code>${st.n}</code></td><td><code>${st.n ? rlSign(st.s, 3) : '—'}</code></td>
        <td><code>${st.n ? rlSign(st.q, 4) : '0 <span style="opacity:.6;">(never taken)</span>'}</code></td>`
        + (BD.reveal ? `<td><code>${rlSign(a.mu, 3)}</code> <span style="opacity:.6;">σ=${rlN(a.sd, 2)}</span></td><td><code>${st.n ? rlSign(st.q - a.mu, 3) : '—'}</code></td>` : '') + '</tr>';
    });
    html += '</table>';
    if (T) {
      const tail = BD.hist.slice(-24);
      html += `<div class="ix-bar" style="margin-top:14px;"><span class="ix-lab">last ${tail.length} pulls</span><span style="font-family:'IBM Plex Mono',monospace; font-size:11px;">`
        + tail.map(h => `<span class="tag" style="margin:1px 2px; background:${h.a === best && BD.reveal ? 'var(--tint-c2)' : 'var(--chip-bg)'}; color:${h.a === best && BD.reveal ? 'var(--accent-3)' : 'var(--chip-fg)'};">${esc(BD.arms[h.a].name)}:${rlSign(h.r, 1)}</span>`).join('')
        + '</span></div>';
    }
    html += `<p class="ix-hint">Every arm starts at <strong>Q₁(a) = 0</strong> and stays there until you pull it — that is Definition 8.5's convention, and it is why a greedy player can get stuck on the first arm that pays anything positive.
      <strong>Pull each arm two or three times and try to name the best one; then reveal q⋆.</strong> With A ∼ N(10, 1) and B ∼ N(11, 4) it takes a surprising number of pulls before the estimates settle in the right order.</p>`;
    out.innerHTML = html;
  }
  function bdPreset(which) {
    const el = document.getElementById('bd-arms');
    if (!el) return;
    if (which === 'ex81') el.value = 'A  10  1\nB  11  2';
    else if (which === 'ten') { let s = ''; const rnd = rlRng(20260210); for (let i = 1; i <= 10; i++) s += 'a' + i + '  ' + (Math.round(rlNorm(rnd) * 100) / 100) + '  1\n'; el.value = s.trim(); }
    else if (which === 'trap') el.value = 'safe   1    0.2\ntempt  0.9  0.2\njackpot 1.4  3';
    BD.hist = []; BD.draws = 0;
    runBandit();
  }
  function runBandit() {
    const out = document.getElementById('bd-output');
    if (!out) return;
    const el = document.getElementById('bd-arms');
    const arms = [], errs = [];
    String(el ? el.value : '').split(/\n+/).forEach((raw, i) => {
      const t = raw.trim();
      if (!t || t.charAt(0) === '#') return;
      const b = t.split(/[\s,;]+/).filter(s => s.length);
      if (b.length < 2) { errs.push(`line ${i + 1}: “${esc(t)}” needs a name and a mean`); return; }
      const mu = Number(b[1]), sd = b.length > 2 ? Number(b[2]) : 1;
      if (!isFinite(mu) || !isFinite(sd) || sd < 0) { errs.push(`line ${i + 1}: “${esc(t)}” — mean and σ must be numbers, σ ≥ 0`); return; }
      arms.push({ name: b[0], mu: mu, sd: sd });
    });
    if (errs.length) { BD.err = errs.slice(0, 4).join('<br>'); bdRender(); return; }
    if (arms.length < 2) { BD.err = 'Give at least two arms — a one-armed bandit has nothing to learn.'; bdRender(); return; }
    if (arms.length > 12) { BD.err = 'Twelve arms at most for the canvas.'; bdRender(); return; }
    BD.err = ''; BD.arms = arms;
    if (BD.hist.some(h => h.a >= arms.length)) { BD.hist = []; BD.draws = 0; }
    bdRender();
  }
  TOOL_RUNNERS.runBandit = runBandit;

  /* ------------------------------------------------------------
     TOOL · Q_t(a) from a history  (runQT) — Exercise 2
     ------------------------------------------------------------ */
  const QT = { rows: [], names: [], frame: 0, err: '' };
  function qtStep(d, fromSlider) {
    const total = QT.rows.length + 1;
    if (d === 'play') { IX.play('qt', total, () => QT.frame, f => { QT.frame = f; qtRender(); }, 1000); qtRender(); return; }
    IX.stop('qt');
    if (d === 'first') QT.frame = 0;
    else if (d === 'last') QT.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) QT.frame = d;
    else QT.frame = Math.max(0, Math.min(total - 1, QT.frame + d));
    qtRender();
  }
  function qtLoad(which) {
    const el = document.getElementById('qt-hist');
    if (!el) return;
    if (which === 'ex2') el.value = 'A 0.5\nA -0.3\nB 0.4\nA 1.0\nB 1.5';
    else if (which === 'outlier') el.value = 'A 10\nB 11\nB 8\nB 12\nB 9\nA 9\nA 11';
    QT.frame = 0;
    runQT();
  }
  function qtRender() {
    const out = document.getElementById('qt-output');
    if (!out) return;
    if (QT.err) { out.innerHTML = `<div class="tool-error">${QT.err}</div>`; return; }
    const rows = QT.rows, names = QT.names, F = QT.frame, T = rows.length;
    /* Q_t(a) uses only rewards from strictly before t */
    const Q = [], N = [], S = [];
    for (let t = 1; t <= T + 1; t++) {
      const q = {}, n = {}, s = {};
      names.forEach(a => {
        const got = [];
        for (let i = 0; i < t - 1; i++) if (rows[i].a === a) got.push(rows[i].r);
        n[a] = got.length; s[a] = got.reduce((x, y) => x + y, 0);
        q[a] = got.length ? s[a] / got.length : 0;
      });
      Q.push(q); N.push(n); S.push(s);
    }
    let html = '<table><tr><th>t</th><th>A<sub>t</sub></th><th>R<sub>t</sub></th>'
      + names.map(a => `<th>Q<sub>t</sub>(${esc(a)})</th>`).join('') + '</tr>';
    for (let t = 1; t <= T + 1; t++) {
      const cur = t - 1 === F, fut = t - 1 > F;
      const cls = (cur ? 'ix-now' : '') + (fut ? ' ix-future' : '');
      const r = rows[t - 1];
      html += `<tr class="${cls}" data-step="${t - 1}">`
        + `<td><strong>${t}</strong></td>`
        + `<td>${r ? '<code>' + esc(r.a) + '</code>' : '<span style="opacity:.5;">—</span>'}</td>`
        + `<td>${r ? '<code>' + rlSign(r.r, 4) + '</code>' : '<span style="opacity:.5;">—</span>'}</td>`
        + names.map(a => {
          const n = N[t - 1][a];
          return `<td><code>${rlSign(Q[t - 1][a], 4)}</code>${n ? `<span style="opacity:.55; font-size:10.5px;"> = ${rlSign(S[t - 1][a], 3)}/${n}</span>` : '<span style="opacity:.45; font-size:10.5px;"> (N=0)</span>'}</td>`;
        }).join('') + '</tr>';
    }
    html += '</table>';
    html += IX.player('qt', F, T + 1, `at <strong>t = ${F + 1}</strong>`, F >= T ? ['done', 'after the last reward'] : ['assign', 'choosing A' + (F + 1)]);
    const t = F + 1;
    let d = `<div class="kmstep"><h5>Q<sub>${t}</sub> from Definition 8.3</h5>`;
    d += `<p style="margin:0 0 8px 0; font-size:12.5px;">Q<sub>t</sub>(a) averages the rewards from <strong>every step strictly before t</strong> on which a was chosen. At t = ${t} that means steps 1 … ${t - 1}${t === 1 ? ' — none at all' : ''}.</p>`;
    names.forEach(a => {
      const got = [];
      for (let i = 0; i < t - 1; i++) if (rows[i].a === a) got.push({ i: i + 1, r: rows[i].r });
      if (!got.length) {
        d += `<div style="font-family:'IBM Plex Mono',monospace; font-size:12.5px; padding:3px 0;">Q<sub>${t}</sub>(${esc(a)}) = <strong>0</strong> &nbsp;<span style="color:var(--ink-muted);">— never taken, so we use the stated convention Q = 0</span></div>`;
      } else {
        d += `<div style="font-family:'IBM Plex Mono',monospace; font-size:12.5px; padding:3px 0;">Q<sub>${t}</sub>(${esc(a)}) = (${got.map(g => rlSign(g.r, 3)).join(' + ').replace(/\+ −/g, '− ')}) / ${got.length} = <strong>${rlSign(Q[t - 1][a], 4)}</strong> &nbsp;<span style="color:var(--ink-muted);">— from t = ${got.map(g => g.i).join(', ')}</span></div>`;
      }
    });
    d += '</div>';
    html += d;
    const gv = names.map(a => Q[F][a]);
    const am = rlArgmax(gv);
    html += `<div class="verdict safe" style="margin-top:12px;">A <strong>greedy</strong> player at t = ${t} would take <strong>${am.ties.map(i => esc(names[i])).join(' or ')}</strong>`
      + (am.ties.length > 1 ? ` — the estimates tie at ${rlSign(gv[am.i], 4)}, and Definition 8.5 says <strong>randomise between them</strong>.` : ` (Q = ${rlSign(gv[am.i], 4)}).`)
      + `</div>`;
    out.innerHTML = html;
  }
  function runQT() {
    const out = document.getElementById('qt-output');
    if (!out) return;
    const el = document.getElementById('qt-hist');
    const rows = [], names = [], errs = [];
    String(el ? el.value : '').split(/\n+/).forEach((raw, i) => {
      const t = raw.trim();
      if (!t || t.charAt(0) === '#') return;
      const b = t.split(/[\s,;:]+/).filter(s => s.length);
      if (b.length < 2) { errs.push(`line ${i + 1}: “${esc(t)}” needs an action and a reward`); return; }
      const r = Number(b[1]);
      if (!isFinite(r)) { errs.push(`line ${i + 1}: “${esc(b[1])}” is not a number`); return; }
      rows.push({ a: b[0], r: r });
      if (names.indexOf(b[0]) < 0) names.push(b[0]);
    });
    if (errs.length) { QT.err = errs.slice(0, 4).join('<br>'); qtRender(); return; }
    if (!rows.length) { QT.err = 'Give at least one <code>action reward</code> line.'; qtRender(); return; }
    if (rows.length > 60) { QT.err = 'Sixty steps at most.'; qtRender(); return; }
    names.sort();
    QT.err = ''; QT.rows = rows; QT.names = names;
    if (QT.frame > rows.length) QT.frame = rows.length;
    qtRender();
  }
  TOOL_RUNNERS.runQT = runQT;

  /* ------------------------------------------------------------
     TOOL · the 10-armed testbed  (runEG) — Figure 8.4 and Exercise 7
     ------------------------------------------------------------ */
  const EG = { k: 10, steps: 500, sims: 200, seed: 2026, show: 'reward',
               eps: [0, 0.01, 0.1, 1], cache: null };
  const EG_ALL = [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1];
  function egCol(e) {
    const i = EG_ALL.indexOf(e);
    return ['var(--accent-2)', 'var(--accent-3)', 'var(--accent)', 'var(--clu4)', 'var(--clu5)', 'var(--clu6)', 'var(--ink-muted)'][i < 0 ? 6 : i];
  }
  function egLab(e) { return e === 0 ? 'ε = 0 (greedy)' : e === 1 ? 'ε = 1 (random)' : 'ε = ' + e; }
  function egToggle(e) {
    e = Number(e);
    const i = EG.eps.indexOf(e);
    if (i >= 0) { if (EG.eps.length > 1) EG.eps.splice(i, 1); } else EG.eps.push(e);
    EG.eps.sort((a, b) => a - b);
    EG.cache = null; egRender();
  }
  function egSet(k, v) { EG[k] = (k === 'show') ? v : Number(v); if (k !== 'show') EG.cache = null; egRender(); }
  function egRun() {
    const K = EG.k, ST = EG.steps, SI = EG.sims;
    const res = {};
    EG.eps.forEach(e => { res[e] = { r: new Float64Array(ST), o: new Float64Array(ST) }; });
    for (let s = 0; s < SI; s++) {
      const rnd = rlRng(EG.seed + s * 7919);
      const q = new Float64Array(K);
      let bi = 0;
      for (let i = 0; i < K; i++) { q[i] = rlNorm(rnd); if (q[i] > q[bi]) bi = i; }
      EG.eps.forEach(e => {
        const pr = rlRng(EG.seed + s * 104729 + Math.round(e * 1000) * 31 + 17);
        const Q = new Float64Array(K), N = new Int32Array(K);
        const acc = res[e];
        for (let t = 0; t < ST; t++) {
          let a;
          if (pr() < e) a = Math.floor(pr() * K) % K;
          else {
            a = 0;
            for (let i = 1; i < K; i++) if (Q[i] > Q[a] + 1e-12) a = i;
            const ties = [];
            for (let i = 0; i < K; i++) if (Math.abs(Q[i] - Q[a]) < 1e-12) ties.push(i);
            a = ties[Math.floor(pr() * ties.length) % ties.length];
          }
          const r = q[a] + rlNorm(pr);
          N[a]++; Q[a] += (r - Q[a]) / N[a];
          acc.r[t] += r;
          if (a === bi) acc.o[t]++;
        }
      });
    }
    EG.eps.forEach(e => { for (let t = 0; t < ST; t++) { res[e].r[t] /= SI; res[e].o[t] = 100 * res[e].o[t] / SI; } });
    EG.cache = { res: res, k: K, steps: ST, sims: SI, eps: EG.eps.slice(), seed: EG.seed };
    return EG.cache;
  }
  function egSmooth(arr, w) {
    const out = new Float64Array(arr.length);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
      if (i >= w) sum -= arr[i - w];
      out[i] = sum / Math.min(i + 1, w);
    }
    return out;
  }
  function egRender() {
    const out = document.getElementById('eg-output');
    if (!out) return;
    const fresh = !EG.cache || EG.cache.steps !== EG.steps || EG.cache.sims !== EG.sims || EG.cache.k !== EG.k
      || EG.cache.seed !== EG.seed || EG.cache.eps.join() !== EG.eps.join();
    const C = fresh ? egRun() : EG.cache;
    const W = 480, H = 300, L = 52, R = 14, T = 14, B = 40;
    const reward = EG.show === 'reward';
    let ymin = reward ? 0 : 0, ymax = reward ? 0.1 : 100;
    const curves = {};
    EG.eps.forEach(e => {
      const raw = reward ? C.res[e].r : C.res[e].o;
      const sm = egSmooth(raw, Math.max(1, Math.round(EG.steps / 50)));
      curves[e] = sm;
      for (let t = 0; t < sm.length; t++) { ymin = Math.min(ymin, sm[t]); ymax = Math.max(ymax, sm[t]); }
    });
    ymax *= 1.08; ymin = Math.min(ymin, 0) * 1.08;
    const cx = t => L + (t / Math.max(1, EG.steps - 1)) * (W - L - R);
    const cy = v => H - B - ((v - ymin) / (ymax - ymin)) * (H - B - T);
    let g = '';
    for (let q = 0; q <= 5; q++) {
      const v = ymin + (ymax - ymin) * q / 5;
      g += `<line x1="${L}" y1="${cy(v).toFixed(1)}" x2="${W - R}" y2="${cy(v).toFixed(1)}" stroke="var(--rule)" stroke-width="0.7"/>`;
      g += `<text x="${L - 7}" y="${(cy(v) + 3.5).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-muted)">${reward ? rlN(v, 1) : Math.round(v) + '%'}</text>`;
    }
    for (let q = 0; q <= 5; q++) {
      const t = Math.round(EG.steps * q / 5);
      g += `<text x="${cx(Math.min(t, EG.steps - 1)).toFixed(1)}" y="${H - B + 15}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-muted)">${t}</text>`;
    }
    EG.eps.forEach(e => {
      const sm = curves[e];
      let d = '';
      const stride = Math.max(1, Math.floor(EG.steps / 400));
      for (let t = 0; t < EG.steps; t += stride) d += (d ? ' L ' : 'M ') + cx(t).toFixed(1) + ' ' + cy(sm[t]).toFixed(1);
      d += ' L ' + cx(EG.steps - 1).toFixed(1) + ' ' + cy(sm[EG.steps - 1]).toFixed(1);
      g += `<path d="${d}" fill="none" stroke="${egCol(e)}" stroke-width="2" opacity="0.92"/>`;
      g += `<text x="${(W - R - 3).toFixed(1)}" y="${(cy(sm[EG.steps - 1]) - 4).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono" font-size="9.5" fill="${egCol(e)}">${egLab(e)}</text>`;
    });
    g += `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="var(--ink-muted)"/>`;
    g += `<line x1="${L}" y1="${cy(0).toFixed(1)}" x2="${W - R}" y2="${cy(0).toFixed(1)}" stroke="var(--ink-muted)" stroke-width="1.1"/>`;
    g += `<text x="${W - R}" y="${H - 6}" text-anchor="end" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)">steps →</text>`;
    g += `<text x="14" y="${H / 2}" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)" transform="rotate(-90 14 ${H / 2})">${reward ? 'average reward over ' + EG.sims + ' simulations' : '% optimal action'} →</text>`;
    let html = `<div class="ix-canvas"><svg width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + `<title>ε-greedy on the ${EG.k}-armed testbed</title><desc>Average reward against step for several values of epsilon.</desc>${g}</svg></div>`;
    html += '<div class="ix-bar"><span class="ix-lab">curves</span>'
      + EG_ALL.map(e => `<button class="ix-btn${EG.eps.indexOf(e) >= 0 ? ' on' : ''}" onclick="egToggle(${e})">${egLab(e)}</button>`).join('') + '</div>';
    html += `<div class="ix-bar"><span class="ix-lab">show</span>
      <span class="ix-seg"><button class="${reward ? 'on' : ''}" onclick="egSet('show','reward')">average reward</button><button class="${reward ? '' : 'on'}" onclick="egSet('show','optimal')">% optimal action</button></span>
      <span class="ix-lab">steps <strong>${EG.steps}</strong></span>
      <input type="range" min="100" max="2000" step="100" value="${EG.steps}" oninput="egSet('steps', this.value)" aria-label="steps">
      <span class="ix-lab">sims <strong>${EG.sims}</strong></span>
      <input type="range" min="20" max="600" step="20" value="${EG.sims}" oninput="egSet('sims', this.value)" aria-label="simulations">
      <span class="ix-lab">k <strong>${EG.k}</strong></span>
      <input type="range" min="2" max="50" step="1" value="${EG.k}" oninput="egSet('k', this.value)" aria-label="number of arms">
      <button class="ix-btn" onclick="egSet('seed', ${(EG.seed * 31 + 7) % 100000})">new testbed</button></div>`;
    html += '<table><tr><th>ε</th><th>average reward at step ' + EG.steps + '</th><th>% optimal at step ' + EG.steps + '</th><th>mean reward over the run</th></tr>';
    const ranked = EG.eps.slice().sort((a, b) => curves[b][EG.steps - 1] - curves[a][EG.steps - 1]);
    EG.eps.forEach(e => {
      const rEnd = egSmooth(C.res[e].r, Math.max(1, Math.round(EG.steps / 50)))[EG.steps - 1];
      const oEnd = egSmooth(C.res[e].o, Math.max(1, Math.round(EG.steps / 50)))[EG.steps - 1];
      let m = 0; for (let t = 0; t < EG.steps; t++) m += C.res[e].r[t]; m /= EG.steps;
      const win = e === ranked[0] && reward;
      html += `<tr${win ? ' style="background:var(--tint-c);"' : ''}><td><strong style="color:${egCol(e)};">${egLab(e)}</strong></td>
        <td><code>${rlSign(rEnd, 3)}</code></td><td><code>${rlN(oEnd, 1)}%</code></td><td><code>${rlSign(m, 3)}</code></td></tr>`;
    });
    html += '</table>';
    html += `<p class="ix-hint"><strong>This is Figure 8.4, recomputed live.</strong> Random hovers around 0 because the action values are drawn from N(0, 1), so the average action is worth nothing.
      Greedy climbs fast and then stalls — it is stuck on whatever looked good early. Turn on <strong>ε = 0.75</strong> to settle <a href="#z-7" onclick="showSection('t8-ex')">Exercise 7</a>, and switch to <em>% optimal action</em> to see the ceiling each ε imposes on itself: ε-greedy can never exceed <strong>1 − ε + ε/k</strong>.</p>`;
    out.innerHTML = html;
  }
  function runEG() { EG.cache = null; egRender(); }
  TOOL_RUNNERS.runEG = runEG;

  /* ------------------------------------------------------------
     TOOL · UCB, step by step  (runUCB) — Exercise 8
     ------------------------------------------------------------ */
  const UC = { names: [], rew: [], c: 2, steps: 8, frame: 0, trace: [], err: '' };
  function ucCompute() {
    const k = UC.names.length, N = new Array(k).fill(0), S = new Array(k).fill(0);
    const trace = [];
    for (let t = 1; t <= UC.steps; t++) {
      const row = { t: t, arms: [] };
      let bi = -1, bv = -Infinity;
      for (let i = 0; i < k; i++) {
        const q = N[i] ? S[i] / N[i] : 0;
        const ex = N[i] === 0 ? Infinity : UC.c * Math.sqrt(Math.log(t) / N[i]);
        const v = N[i] === 0 ? Infinity : q + ex;
        row.arms.push({ q: q, n: N[i], ex: ex, v: v });
        if (v > bv + 1e-12) { bv = v; bi = i; }
      }
      row.ties = [];
      for (let i = 0; i < k; i++) if (row.arms[i].v === bv || Math.abs(row.arms[i].v - bv) < 1e-12) row.ties.push(i);
      row.pick = row.ties[0];
      if (N[row.pick] >= UC.rew[row.pick].length) { row.out = true; trace.push(row); break; }
      row.r = UC.rew[row.pick][N[row.pick]];
      N[row.pick]++; S[row.pick] += row.r;
      trace.push(row);
    }
    UC.trace = trace;
    UC.final = { N: N, S: S };
  }
  function ucStep(d, fromSlider) {
    const total = UC.trace.length;
    if (d === 'play') { IX.play('uc', total, () => UC.frame, f => { UC.frame = f; ucRender(); }, 1200); ucRender(); return; }
    IX.stop('uc');
    if (d === 'first') UC.frame = 0;
    else if (d === 'last') UC.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) UC.frame = d;
    else UC.frame = Math.max(0, Math.min(total - 1, UC.frame + d));
    ucRender();
  }
  function ucSet(k, v) { UC[k] = Number(v); runUCB(); }
  function ucLoad(which) {
    const el = document.getElementById('uc-rew');
    if (!el) return;
    if (which === 'ex8') el.value = 'a1: 5, 4, 7, 3, 7\na2: 3.5, 7, 1, 1, 1\na3: 6, 0, 4, 4, 3';
    else if (which === 'sleeper') el.value = 'a1: 9, 1, 1, 1, 1, 1, 1, 1\na2: 2, 8, 8, 8, 8, 8, 8, 8';
    UC.frame = 0;
    runUCB();
  }
  function ucRender() {
    const out = document.getElementById('uc-output');
    if (!out) return;
    if (UC.err) { out.innerHTML = `<div class="tool-error">${UC.err}</div>`; return; }
    const tr = UC.trace, F = Math.min(UC.frame, tr.length - 1), k = UC.names.length;
    if (!tr.length) { out.innerHTML = '<div class="tool-error">Nothing to trace.</div>'; return; }
    const row = tr[F];
    /* the Figure 8.5 picture at this step */
    const W = 470, H = 44 + k * 34, L = 74, R = 60;
    let lo = Infinity, hi = -Infinity;
    row.arms.forEach(a => {
      if (a.n === 0) { lo = Math.min(lo, 0); hi = Math.max(hi, a.q + 1); return; }
      lo = Math.min(lo, a.q - a.ex); hi = Math.max(hi, a.q + a.ex);
    });
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const cx = v => L + (v - lo) / (hi - lo) * (W - L - R);
    let g = '';
    row.arms.forEach((a, i) => {
      const y = 26 + i * 34, on = i === row.pick;
      g += `<text x="${L - 10}" y="${y + 4}" text-anchor="end" font-family="IBM Plex Mono" font-size="11.5" fill="${on ? 'var(--accent)' : 'var(--ink-soft)'}" font-weight="${on ? 600 : 400}">${esc(UC.names[i])}</text>`;
      if (a.n === 0) {
        g += `<line x1="${cx(lo).toFixed(1)}" y1="${y}" x2="${(W - R).toFixed(1)}" y2="${y}" stroke="var(--accent-2)" stroke-width="2" stroke-dasharray="5 3"/>`;
        g += `<text x="${(W - R + 5)}" y="${y + 4}" font-family="IBM Plex Mono" font-size="10.5" fill="var(--accent-2)">+∞ (N=0)</text>`;
        return;
      }
      const a1 = cx(a.q - a.ex), a2 = cx(a.q + a.ex), am = cx(a.q);
      g += `<line x1="${a1.toFixed(1)}" y1="${y}" x2="${a2.toFixed(1)}" y2="${y}" stroke="${on ? 'var(--accent)' : 'var(--ink-muted)'}" stroke-width="${on ? 3 : 2}" opacity="${on ? 1 : 0.55}"/>`;
      [a1, a2].forEach(x => { g += `<line x1="${x.toFixed(1)}" y1="${y - 6}" x2="${x.toFixed(1)}" y2="${y + 6}" stroke="${on ? 'var(--accent)' : 'var(--ink-muted)'}" stroke-width="${on ? 2.4 : 1.6}" opacity="${on ? 1 : 0.55}"/>`; });
      g += `<circle cx="${am.toFixed(1)}" cy="${y}" r="4" fill="var(--accent-4)"/>`;
      g += `<text x="${am.toFixed(1)}" y="${y - 10}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="var(--accent-4)">Q=${rlN(a.q, 2)}</text>`;
      g += `<text x="${(a2 + 5).toFixed(1)}" y="${y + 4}" font-family="IBM Plex Mono" font-size="10.5" fill="${on ? 'var(--accent)' : 'var(--ink-muted)'}" font-weight="${on ? 600 : 400}">${rlN(a.v, 3)}</text>`;
    });
    g += `<text x="${L}" y="14" font-family="IBM Plex Sans" font-size="10" fill="var(--ink-muted)">Q ± c√(ln t / N) — the method takes the arm whose <tspan font-weight="600">right-hand end</tspan> is furthest right</text>`;
    let html = `<div class="ix-canvas"><svg width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + `<title>Confidence intervals at t = ${row.t}</title><desc>One interval per arm, centred on Q with half-width equal to the exploration term.</desc>${g}</svg></div>`;
    html += IX.player('uc', F, tr.length, `t = <strong>${row.t}</strong> · A<sub>${row.t}</sub> = <strong>${esc(UC.names[row.pick])}</strong>`,
      row.out ? ['done', 'out of rewards'] : ['assign', row.arms[row.pick].n === 0 ? 'first pull — N = 0' : 'arg max']);
    html += `<div class="ix-bar"><span class="ix-lab">c <strong>${rlN(UC.c, 2)}</strong></span>
      <input type="range" min="0" max="6" step="0.1" value="${UC.c}" oninput="ucSet('c', this.value)" aria-label="exploration parameter">
      <span class="ix-lab">steps <strong>${UC.steps}</strong></span>
      <input type="range" min="2" max="15" step="1" value="${UC.steps}" oninput="ucSet('steps', this.value)" aria-label="number of steps">
      <button class="ix-btn" onclick="ucLoad('ex8')">Exercise 8</button>
      <button class="ix-btn" onclick="ucLoad('sleeper')">the sleeper</button></div>`;
    /* the arithmetic at this step */
    let d = `<div class="kmstep"><h5>step t = ${row.t} — UCB<sub>${row.t}</sub>(a) = Q<sub>${row.t}</sub>(a) + c·√(ln ${row.t} / N<sub>${row.t}</sub>(a))</h5>`;
    d += `<p style="margin:0 0 8px 0; font-size:12.5px;">ln ${row.t} = <code>${rlN(Math.log(row.t), 4)}</code>, c = <code>${rlN(UC.c, 2)}</code>.</p>`;
    d += '<table><tr><th>a</th><th>N<sub>t</sub>(a)</th><th>Q<sub>t</sub>(a)</th><th>exploration term</th><th>UCB<sub>t</sub>(a)</th></tr>';
    row.arms.forEach((a, i) => {
      const on = i === row.pick;
      d += `<tr${on ? ' style="background:var(--tint-c);"' : ''}><td><strong>${esc(UC.names[i])}</strong>${on ? ' ✓' : ''}</td><td><code>${a.n}</code></td>
        <td><code>${rlSign(a.q, 4)}</code></td>
        <td><code>${a.n === 0 ? '+∞' : rlN(UC.c, 2) + '·√(' + rlN(Math.log(row.t), 4) + '/' + a.n + ') = ' + rlN(a.ex, 4)}</code></td>
        <td><code>${a.n === 0 ? '+∞' : rlN(a.v, 4)}</code></td></tr>`;
    });
    d += '</table>';
    if (row.out) d += `<div class="verdict warn" style="margin-top:10px;">The reward list for <strong>${esc(UC.names[row.pick])}</strong> has run out, so the trace stops here. Add more rewards to that line to go further.</div>`;
    else {
      const zero = row.arms.filter(a => a.n === 0).length;
      d += `<div class="verdict safe" style="margin-top:10px;">`;
      if (zero) d += `<strong>N<sub>${row.t}</sub> = 0</strong> for ${zero} arm${zero === 1 ? '' : 's'}, so their UCB is <strong>+∞</strong> and they are all maximising. Remark 8.8 breaks the tie by <strong>lowest index</strong> → <strong>A<sub>${row.t}</sub> = ${esc(UC.names[row.pick])}</strong>.`;
      else if (row.ties.length > 1) d += `${row.ties.length} arms tie at ${rlN(row.arms[row.pick].v, 4)}; Remark 8.8 takes the <strong>lowest index</strong> → <strong>A<sub>${row.t}</sub> = ${esc(UC.names[row.pick])}</strong>.`;
      else d += `arg max is <strong>${esc(UC.names[row.pick])}</strong> at ${rlN(row.arms[row.pick].v, 4)} → <strong>A<sub>${row.t}</sub> = ${esc(UC.names[row.pick])}</strong>, paying <strong>${rlSign(row.r, 3)}</strong>.`;
      const q = row.arms[row.pick];
      if (!zero && row.ties.length === 1 && q.q < Math.max.apply(null, row.arms.map(x => x.q)) - 1e-9)
        d += ` Note it does <em>not</em> have the best Q — it wins on the width of its interval. <strong>That is Figure 8.5.</strong>`;
      d += '</div>';
    }
    d += '</div>';
    html += d;
    html += '<table style="margin-top:14px;"><tr><th>t</th>' + UC.names.map(n => `<th>UCB<sub>t</sub>(${esc(n)})</th>`).join('') + '<th>A<sub>t</sub></th><th>R<sub>t</sub></th></tr>';
    tr.forEach((r, i) => {
      const cls = (i === F ? 'ix-now' : '') + (i > F ? ' ix-future' : '');
      html += `<tr class="${cls}" data-step="${i}"><td><strong>${r.t}</strong></td>`
        + r.arms.map((a, j) => `<td${j === r.pick ? ' style="color:var(--accent-3); font-weight:600;"' : ''}><code>${a.n === 0 ? '+∞' : rlN(a.v, 4)}</code></td>`).join('')
        + `<td><strong>${r.out ? '—' : esc(UC.names[r.pick])}</strong></td><td><code>${r.out ? '—' : rlSign(r.r, 3)}</code></td></tr>`;
    });
    html += '</table>';
    const done = tr.filter(r => !r.out);
    html += '<div class="metrics"><div class="metric"><div class="mn">sequence</div><div class="mv" style="font-size:14px;">'
      + done.map(r => esc(UC.names[r.pick])).join(' · ') + '</div><div class="mf">A₁ … A' + done.length + '</div></div>';
    UC.names.forEach((n, i) => {
      html += `<div class="metric dim"><div class="mn">${esc(n)}</div><div class="mv">${UC.final.N[i] ? rlSign(UC.final.S[i] / UC.final.N[i], 3) : '—'}</div><div class="mf">pulled ${UC.final.N[i]}×, total ${rlSign(UC.final.S[i], 2)}</div></div>`;
    });
    html += '</div>';
    html += `<p class="ix-hint"><strong>Drag c to 0</strong> and UCB collapses into the greedy method — the exploration term vanishes and only Q matters.
      <strong>Drag it up</strong> and the intervals swell until the arm with the fewest pulls always wins, which is round-robin, not learning. The default <strong>c = 2</strong> is the exercise's value; the notes mention √2 as a common choice.</p>`;
    out.innerHTML = html;
  }
  function runUCB() {
    const out = document.getElementById('uc-output');
    if (!out) return;
    const el = document.getElementById('uc-rew');
    const names = [], rew = [], errs = [];
    String(el ? el.value : '').split(/\n+/).forEach((raw, i) => {
      const t = raw.trim();
      if (!t || t.charAt(0) === '#') return;
      const m = t.match(/^([^:]+):(.*)$/);
      const nm = m ? m[1].trim() : ('a' + (names.length + 1));
      const body = m ? m[2] : t;
      const vals = body.split(/[\s,;]+/).filter(s => s.length).map(Number);
      if (!vals.length || vals.some(v => !isFinite(v))) { errs.push(`line ${i + 1}: “${esc(t)}” — expected <code>name: r1, r2, …</code>`); return; }
      names.push(nm); rew.push(vals);
    });
    if (errs.length) { UC.err = errs.slice(0, 4).join('<br>'); ucRender(); return; }
    if (names.length < 2) { UC.err = 'Give at least two arms, one per line, as <code>a1: 5, 4, 7</code>.'; ucRender(); return; }
    if (names.length > 8) { UC.err = 'Eight arms at most.'; ucRender(); return; }
    UC.err = ''; UC.names = names; UC.rew = rew;
    ucCompute();
    if (UC.frame > UC.trace.length - 1) UC.frame = UC.trace.length - 1;
    ucRender();
  }
  TOOL_RUNNERS.runUCB = runUCB;
