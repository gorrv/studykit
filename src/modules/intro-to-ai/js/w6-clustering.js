  /* ============================================================
     W6 · CLUSTERING — K-means, within-cluster variance, hierarchical
     ============================================================ */
  const CLU_N = 8;
  function cluColour(i) { return 'var(--clu' + ((i % CLU_N) + 1) + ')'; }
  function clParsePoints(text) {
    const pts = [], errs = [];
    String(text).split(/\n+/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line[0] === '#') return;
      let name = null, rest = line;
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(.*)$/);
      if (m) { name = m[1]; rest = m[2]; }
      const nums = rest.split(/[\s,;]+/).filter(Boolean).map(t => ({ raw: t, v: parseFloat(t) }));
      const bad = nums.filter(o => isNaN(o.v));
      if (bad.length) { errs.push(`line ${i + 1}: "${bad[0].raw}" is not a number`); return; }
      if (!nums.length) { errs.push(`line ${i + 1}: no coordinates`); return; }
      pts.push({ name: name || ('p' + (pts.length + 1)), x: nums.map(o => o.v) });
    });
    const dims = pts.length ? pts[0].x.length : 0;
    pts.forEach((p, i) => { if (p.x.length !== dims) errs.push(`${p.name} has ${p.x.length} coordinates but ${pts[0].name} has ${dims}`); });
    const seen = {};
    pts.forEach(p => { if (seen[p.name]) errs.push(`duplicate point name "${p.name}"`); seen[p.name] = 1; });
    return { pts: pts, dims: dims, errs: errs };
  }
  function clD2(a, b) { let s = 0; for (let j = 0; j < a.length; j++) { const d = a[j] - b[j]; s += d * d; } return s; }
  function clL1(a, b) { let s = 0; for (let j = 0; j < a.length; j++) s += Math.abs(a[j] - b[j]); return s; }
  function clL2(a, b) { return Math.sqrt(clD2(a, b)); }
  function clFmt(v, dp) {
    const n = Number(v);
    if (!isFinite(n)) return '—';
    const d = dp === undefined ? 2 : dp;
    const s = n.toFixed(d);
    return s.replace(/\.?0+$/, '') === '' ? '0' : (Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : s);
  }
  function clNum(v, dp) { const n = Number(v); return isFinite(n) ? n.toFixed(dp === undefined ? 2 : dp) : '—'; }
  function clVec(v, dp) { return '(' + v.map(x => clNum(x, dp === undefined ? 2 : dp)).join(', ') + ')'; }
  /* ---------- scatter plot shared by the clustering tools ---------- */
  function clPlot(pts, assign, centres, title) {
    if (!pts.length || pts[0].x.length !== 2) return '';
    const W = 420, H = 300, pad = 40;
    let lo0 = Infinity, hi0 = -Infinity, lo1 = Infinity, hi1 = -Infinity;
    const all = pts.map(p => p.x).concat(centres || []);
    all.forEach(v => {
      if (v[0] < lo0) lo0 = v[0]; if (v[0] > hi0) hi0 = v[0];
      if (v[1] < lo1) lo1 = v[1]; if (v[1] > hi1) hi1 = v[1];
    });
    const padX = Math.max(1, (hi0 - lo0) * 0.12), padY = Math.max(1, (hi1 - lo1) * 0.12);
    lo0 -= padX; hi0 += padX; lo1 -= padY; hi1 += padY;
    const cx = x => pad + (x - lo0) / (hi0 - lo0) * (W - pad - 16);
    const cy = y => H - pad - (y - lo1) / (hi1 - lo1) * (H - pad - 20);
    let g = `<line x1="${pad}" y1="16" x2="${pad}" y2="${H - pad}" stroke="var(--ink-muted)"/>`
      + `<line x1="${pad}" y1="${H - pad}" x2="${W - 16}" y2="${H - pad}" stroke="var(--ink-muted)"/>`;
    if (lo1 <= 0 && hi1 >= 0) g += `<line x1="${pad}" y1="${cy(0).toFixed(1)}" x2="${W - 16}" y2="${cy(0).toFixed(1)}" stroke="var(--rule)" stroke-dasharray="3 3"/>`;
    if (lo0 <= 0 && hi0 >= 0) g += `<line x1="${cx(0).toFixed(1)}" y1="16" x2="${cx(0).toFixed(1)}" y2="${H - pad}" stroke="var(--rule)" stroke-dasharray="3 3"/>`;
    pts.forEach((p, i) => {
      const k = assign ? assign[i] : -1;
      const col = k >= 0 ? cluColour(k) : 'var(--ink-muted)';
      g += `<circle cx="${cx(p.x[0]).toFixed(1)}" cy="${cy(p.x[1]).toFixed(1)}" r="5.5" fill="${col}" stroke="var(--surface)" stroke-width="1"/>`;
      g += `<text x="${(cx(p.x[0]) + 8).toFixed(1)}" y="${(cy(p.x[1]) - 6).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--ink-muted)">${esc(p.name)}</text>`;
    });
    (centres || []).forEach((c, k) => {
      const X = cx(c[0]), Y = cy(c[1]), col = cluColour(k);
      g += `<line x1="${(X - 7).toFixed(1)}" y1="${(Y - 7).toFixed(1)}" x2="${(X + 7).toFixed(1)}" y2="${(Y + 7).toFixed(1)}" stroke="${col}" stroke-width="2.6"/>`;
      g += `<line x1="${(X - 7).toFixed(1)}" y1="${(Y + 7).toFixed(1)}" x2="${(X + 7).toFixed(1)}" y2="${(Y - 7).toFixed(1)}" stroke="${col}" stroke-width="2.6"/>`;
      g += `<text x="${(X + 10).toFixed(1)}" y="${(Y + 14).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9" fill="${col}">${clVec(c)}</text>`;
    });
    g += `<text x="${pad}" y="${H - 12}" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">${clFmt(lo0, 1)}</text>`;
    g += `<text x="${W - 16}" y="${H - 12}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">${clFmt(hi0, 1)}</text>`;
    return `<div class="chartbox"><svg width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + `<title>${esc(title || 'clustering')}</title><desc>Scatter plot of the points coloured by cluster; crosses mark cluster centres.</desc>`
      + g + '</svg></div>';
  }
  /* ---------- within-cluster variance ---------- */
  function clWCV(members) {
    const terms = [];
    let sum = 0;
    for (let a = 0; a < members.length; a++)
      for (let b = a + 1; b < members.length; b++) {
        const d = clD2(members[a].x, members[b].x);
        terms.push({ a: members[a].name, b: members[b].name, d: d });
        sum += d;
      }
    return { terms: terms, sum: sum, V: members.length ? sum / members.length : 0 };
  }
  function clCentroid(members) {
    if (!members.length) return null;
    const D = members[0].x.length, c = new Array(D).fill(0);
    members.forEach(m => { for (let j = 0; j < D; j++) c[j] += m.x[j]; });
    for (let j = 0; j < D; j++) c[j] /= members.length;
    return c;
  }
  /* ---------- W6: within-cluster variance with a draggable canvas ---------- */
  const WV = { pts: [], sets: [], which: 0, snap: true, bounds: null };
  const WV_W = 400, WV_H = 300, WV_PAD = 38;
  function wvBounds(force) {
    if (WV.bounds && !force) return WV.bounds;
    let lo0 = Infinity, hi0 = -Infinity, lo1 = Infinity, hi1 = -Infinity;
    if (!WV.pts.length) { WV.bounds = { lo0: 0, hi0: 10, lo1: 0, hi1: 10 }; return WV.bounds; }
    WV.pts.forEach(p => {
      if (p.x[0] < lo0) lo0 = p.x[0]; if (p.x[0] > hi0) hi0 = p.x[0];
      if (p.x[1] < lo1) lo1 = p.x[1]; if (p.x[1] > hi1) hi1 = p.x[1];
    });
    const mx = Math.max(1.5, (hi0 - lo0) * 0.2), my = Math.max(1.5, (hi1 - lo1) * 0.2);
    WV.bounds = { lo0: lo0 - mx, hi0: hi0 + mx, lo1: lo1 - my, hi1: hi1 + my };
    return WV.bounds;
  }
  function wvCx(x) { const b = wvBounds(); return WV_PAD + (x - b.lo0) / (b.hi0 - b.lo0) * (WV_W - WV_PAD - 18); }
  function wvCy(y) { const b = wvBounds(); return WV_H - WV_PAD - (y - b.lo1) / (b.hi1 - b.lo1) * (WV_H - WV_PAD - 20); }
  function wvUx(px) { const b = wvBounds(); return b.lo0 + (px - WV_PAD) / (WV_W - WV_PAD - 18) * (b.hi0 - b.lo0); }
  function wvUy(py) { const b = wvBounds(); return b.lo1 + (WV_H - WV_PAD - py) / (WV_H - WV_PAD - 20) * (b.hi1 - b.lo1); }
  function wvSync() {
    const a = document.getElementById('wv-pts'), b = document.getElementById('wv-clu');
    if (a) a.value = WV.pts.map(p => p.name + ': ' + p.x.map(v => clNum(v, Number.isInteger(v) ? 0 : 2)).join(' ')).join('\n');
    if (b) b.value = WV.sets.map(cl => cl.map(g => g.join(' ')).join(' | ')).join('\n');
  }
  function wvMove(px, py, key) {
    const i = parseInt(key.slice(1), 10);
    if (!WV.pts[i]) return;
    const bb = wvBounds();
    let x = IX.snap(wvUx(px), WV.snap), y = IX.snap(wvUy(py), WV.snap);
    WV.pts[i].x = [Math.max(bb.lo0, Math.min(bb.hi0, x)), Math.max(bb.lo1, Math.min(bb.hi1, y))];
    wvRender();
  }
  function wvCycle(key) {
    /* shift-click a point to move it to the next cluster of the shown clustering */
    const i = parseInt(key.slice(1), 10);
    const name = WV.pts[i].name, cl = WV.sets[WV.which];
    let from = -1;
    cl.forEach((g, k) => { if (g.indexOf(name) >= 0) from = k; });
    if (from < 0) return;
    cl[from] = cl[from].filter(n => n !== name);
    const to = (from + 1) % cl.length;
    cl[to] = cl[to].concat([name]);
    if (!cl[from].length) cl.splice(from, 1);
    wvSync(); wvRender();
  }
  function wvPick(i) { WV.which = i; wvRender(); }
  function wvToggle(on) {
    WV.snap = on;
    if (on) { WV.pts.forEach(p => p.x = p.x.map(v => Math.round(v))); wvSync(); }
    wvRender();
  }
  function wvFit() { wvBounds(true); wvRender(); }
  function wvGroups(idx) {
    const byName = {}; WV.pts.forEach(p => byName[p.name] = p);
    return (WV.sets[idx] || []).map(g => g.map(n => byName[n]).filter(Boolean));
  }
  function wvTotal(idx) {
    let t = 0;
    wvGroups(idx).forEach(c => { if (c.length) t += clWCV(c).V; });
    return t;
  }
  function wvRender() {
    const out = document.getElementById('wv-output');
    if (!out) return;
    const groups = wvGroups(WV.which);
    const owner = {};
    groups.forEach((c, k) => c.forEach(p => owner[p.name] = k));
    let g = '';
    const bb = wvBounds();
    const gx0 = Math.ceil(bb.lo0), gx1 = Math.floor(bb.hi0), gy0 = Math.ceil(bb.lo1), gy1 = Math.floor(bb.hi1);
    if (gx1 - gx0 <= 22) for (let x = gx0; x <= gx1; x++)
      g += `<line x1="${wvCx(x).toFixed(1)}" y1="14" x2="${wvCx(x).toFixed(1)}" y2="${WV_H - WV_PAD}" stroke="var(--rule)" stroke-width="0.5"/>`;
    if (gy1 - gy0 <= 22) for (let y = gy0; y <= gy1; y++)
      g += `<line x1="${WV_PAD}" y1="${wvCy(y).toFixed(1)}" x2="${WV_W - 18}" y2="${wvCy(y).toFixed(1)}" stroke="var(--rule)" stroke-width="0.5"/>`;
    g += `<line x1="${WV_PAD}" y1="14" x2="${WV_PAD}" y2="${WV_H - WV_PAD}" stroke="var(--ink-muted)"/>`;
    g += `<line x1="${WV_PAD}" y1="${WV_H - WV_PAD}" x2="${WV_W - 18}" y2="${WV_H - WV_PAD}" stroke="var(--ink-muted)"/>`;
    /* every counted pair, drawn */
    groups.forEach((c, k) => {
      for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++) {
        g += `<line x1="${wvCx(c[a].x[0]).toFixed(1)}" y1="${wvCy(c[a].x[1]).toFixed(1)}" x2="${wvCx(c[b].x[0]).toFixed(1)}" y2="${wvCy(c[b].x[1]).toFixed(1)}" stroke="${cluColour(k)}" stroke-width="1.3" opacity="0.45"/>`;
      }
      const mu = c.length ? clCentroid(c) : null;
      if (mu) {
        g += `<line x1="${(wvCx(mu[0]) - 6).toFixed(1)}" y1="${(wvCy(mu[1]) - 6).toFixed(1)}" x2="${(wvCx(mu[0]) + 6).toFixed(1)}" y2="${(wvCy(mu[1]) + 6).toFixed(1)}" stroke="${cluColour(k)}" stroke-width="2.2" opacity="0.8"/>`;
        g += `<line x1="${(wvCx(mu[0]) - 6).toFixed(1)}" y1="${(wvCy(mu[1]) + 6).toFixed(1)}" x2="${(wvCx(mu[0]) + 6).toFixed(1)}" y2="${(wvCy(mu[1]) - 6).toFixed(1)}" stroke="${cluColour(k)}" stroke-width="2.2" opacity="0.8"/>`;
      }
    });
    WV.pts.forEach((p, i) => {
      const k = owner[p.name];
      g += `<circle class="grab" data-ix="p${i}" cx="${wvCx(p.x[0]).toFixed(1)}" cy="${wvCy(p.x[1]).toFixed(1)}" r="7" fill="${k === undefined ? 'var(--ink-muted)' : cluColour(k)}" stroke="var(--surface)" stroke-width="1.5"/>`;
      g += `<text x="${(wvCx(p.x[0]) + 9).toFixed(1)}" y="${(wvCy(p.x[1]) - 7).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--ink-muted)" pointer-events="none">${esc(p.name)}</text>`;
    });
    let html = `<div class="ix-canvas"><svg id="wv-svg" width="100%" viewBox="0 0 ${WV_W} ${WV_H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + '<title>Clustering canvas</title><desc>Points coloured by cluster; every line is a pair counted in the within-cluster variance, and the cross is the cluster centre.</desc>'
      + g + '</svg></div>';
    html += '<div class="ix-bar"><span class="ix-lab">showing:</span>'
      + WV.sets.map((cl, i) => `<button class="ix-btn ${WV.which === i ? 'on' : ''}" onclick="wvPick(${i})">clustering ${i + 1} · V = ${clFmt(wvTotal(i), 3)}</button>`).join('')
      + `<button class="ix-btn" onclick="wvFit()">⤢ fit view</button>`
      + IX.toggles([{ label: 'snap to integers', on: WV.snap, fn: 'wvToggle(this.checked)' }]) + '</div>';
    html += `<p class="ix-hint"><strong>Drag any point</strong> and every V recomputes · <strong>shift-click a point</strong> to move it into the next cluster ·
      each thin line is one of the pairs counted in V, and the ✕ is that cluster's centre.
      <strong>Drag p₄ towards the top-right pair</strong> and watch clustering 2 overtake clustering 1.</p>`;
    WV.sets.forEach((cl, ri) => {
      const gs = wvGroups(ri);
      html += `<h3 style="margin-top:${ri ? 20 : 8}px;">Clustering ${ri + 1}${ri === WV.which ? ' <span style="font-size:12px; color:var(--accent);">— shown above</span>' : ''}</h3>`;
      html += '<div class="frontier" style="margin-bottom:8px;">';
      gs.forEach((c, k) => { html += `<span class="clu" style="border-color:${cluColour(k)}; color:${cluColour(k)};"><span class="dot" style="background:${cluColour(k)};"></span>C${k + 1} = {${c.map(m => esc(m.name)).join(', ')}}</span>`; });
      html += '</div>';
      html += '<table><tr><th>Cluster</th><th>|C|</th><th>Pairwise d²</th><th>Sum</th><th>V(C) = sum / |C|</th><th>Σ d(p, µ)²</th></tr>';
      let total = 0;
      gs.forEach((c, k) => {
        const W = clWCV(c); total += W.V;
        const mu = clCentroid(c);
        let s2 = 0; if (mu) c.forEach(m => s2 += clD2(m.x, mu));
        html += `<tr><td><strong style="color:${cluColour(k)};">C${k + 1}</strong></td><td>${c.length}</td>
          <td style="font-family:'IBM Plex Mono',monospace; font-size:11.5px;">${W.terms.length ? W.terms.map(t => `d(${esc(t.a)},${esc(t.b)})²=${clFmt(t.d, 3)}`).join('<br>') : '<em>single point — no pairs</em>'}</td>
          <td><code>${clFmt(W.sum, 3)}</code></td><td><strong><code>${clFmt(W.V, 4)}</code></strong></td><td><code>${clFmt(s2, 4)}</code></td></tr>`;
      });
      html += `<tr style="font-weight:700;"><td colspan="4" style="text-align:right;">total within-cluster variance</td><td colspan="2"><code>${clFmt(total, 4)}</code></td></tr></table>`;
    });
    if (WV.sets.length > 1) {
      const totals = WV.sets.map((c, i) => wvTotal(i));
      let bi = 0; totals.forEach((t, i) => { if (t < totals[bi]) bi = i; });
      html += `<div class="verdict safe" style="margin-top:14px;">
        <strong>Clustering ${bi + 1} has the lower total within-cluster variance</strong> —
        ${totals.map((t, i) => `clustering ${i + 1}: <strong>${clFmt(t, 4)}</strong>`).join(' &nbsp;vs&nbsp; ')}. Lower is better.</div>`;
    }
    html += `<p style="font-size:12.5px; color:var(--ink-muted); margin-top:10px;">
      Each unordered pair is counted <strong>once</strong>, and the sum is divided by <strong>|C|</strong>, the number of points — not the number of pairs.
      The last column checks <strong>Proposition 6.3</strong>: with each pair counted once it equals V(C) <em>exactly</em>, with no factor of 2.</p>`;
    out.innerHTML = html;
    const svg = document.getElementById('wv-svg');
    if (svg) IX.drag(svg, { W: WV_W, H: WV_H, onMove: wvMove, onRemove: wvCycle, onDrop: wvSync });
  }
  function runWCV() {
    const out = document.getElementById('wv-output');
    if (!out) return;
    const P = clParsePoints(document.getElementById('wv-pts').value);
    let head = '';
    if (P.errs.length) head += `<div class="verdict bad">${P.errs.map(esc).join('<br>')}</div>`;
    if (P.pts.length < 2) { out.innerHTML = head + '<div class="tool-error">Give at least two points.</div>'; return; }
    if (P.dims !== 2) { out.innerHTML = head + '<div class="tool-error">The interactive canvas needs 2-D points — give exactly two coordinates each.</div>'; return; }
    const byName = {}; P.pts.forEach(p => byName[p.name] = p);
    const lines = String(document.getElementById('wv-clu').value).split(/\n+/).map(l => l.trim()).filter(l => l && l[0] !== '#');
    if (!lines.length) { out.innerHTML = head + '<div class="tool-error">Give at least one clustering.</div>'; return; }
    const sets = [], bad = [];
    lines.forEach((line, li) => {
      const seen = {}, cl = [];
      line.split('|').map(g => g.trim()).filter(g => g.length).forEach(gr => {
        const names = gr.split(/[\s,]+/).filter(Boolean).filter(n => {
          if (!byName[n]) { bad.push(`clustering ${li + 1}: unknown point "${n}"`); return false; }
          if (seen[n]) { bad.push(`clustering ${li + 1}: "${n}" appears twice`); return false; }
          seen[n] = 1; return true;
        });
        if (names.length) cl.push(names);
      });
      const missing = P.pts.filter(p => !seen[p.name]).map(p => p.name);
      if (missing.length) bad.push(`clustering ${li + 1}: not assigned — ${missing.join(', ')}`);
      sets.push(cl);
    });
    if (bad.length) head += `<div class="verdict warn">${bad.map(esc).join('<br>')}</div>`;
    const same = WV.pts.length === P.pts.length && WV.pts.every((p, i) => p.name === P.pts[i].name);
    WV.pts = P.pts.map(p => ({ name: p.name, x: p.x.slice() }));
    WV.sets = sets;
    if (WV.which >= sets.length) WV.which = 0;
    wvBounds(!same);
    wvRender();
    if (head) out.innerHTML = head + out.innerHTML;
  }
  TOOL_RUNNERS.runWCV = runWCV;
  /* ---------- K-means ---------- */
  const KM_PRESETS = {
    fig: { pts: 'p1: 2 5\np2: 2 6\np3: 6 4\np4: 1 8\np5: 4 5\np6: 4 4\np7: 1 1\np8: 4 7', mu: '2 5\n2 6\n6 4' },
    ex2: { pts: 'p1: 1 2\np2: 2 3\np3: 3 0\np4: 4 4\np5: 6 7\np6: 7 6', mu: '1 2\n6 7' },
    ex3: { pts: 'p1: 1 2\np2: 2 3\np3: 3 0\np4: 4 4\np5: 6 7\np6: 7 6', mu: '6 7\n1 2' }
  };
  function kmPreset() {
    const k = document.getElementById('km-preset').value, p = KM_PRESETS[k];
    if (p) { document.getElementById('km-pts').value = p.pts; document.getElementById('km-mu').value = p.mu; }
    runKM();
  }
  /* ---------- K-means: interactive canvas + step player ---------- */
  const KM = { pts: [], mu: [], frames: [], frame: 0, snap: true, regions: true,
               bounds: null, ready: false };
  const KM_W = 460, KM_H = 330, KM_PAD = 38;
  function kmBounds(force) {
    if (KM.bounds && !force) return KM.bounds;
    let lo0 = Infinity, hi0 = -Infinity, lo1 = Infinity, hi1 = -Infinity;
    const all = KM.pts.map(p => p.x).concat(KM.mu);
    if (!all.length) { KM.bounds = { lo0: 0, hi0: 10, lo1: 0, hi1: 10 }; return KM.bounds; }
    all.forEach(v => {
      if (v[0] < lo0) lo0 = v[0]; if (v[0] > hi0) hi0 = v[0];
      if (v[1] < lo1) lo1 = v[1]; if (v[1] > hi1) hi1 = v[1];
    });
    const mx = Math.max(1.5, (hi0 - lo0) * 0.22), my = Math.max(1.5, (hi1 - lo1) * 0.22);
    KM.bounds = { lo0: lo0 - mx, hi0: hi0 + mx, lo1: lo1 - my, hi1: hi1 + my };
    return KM.bounds;
  }
  function kmCx(x) { const b = kmBounds(); return KM_PAD + (x - b.lo0) / (b.hi0 - b.lo0) * (KM_W - KM_PAD - 18); }
  function kmCy(y) { const b = kmBounds(); return KM_H - KM_PAD - (y - b.lo1) / (b.hi1 - b.lo1) * (KM_H - KM_PAD - 22); }
  function kmUx(px) { const b = kmBounds(); return b.lo0 + (px - KM_PAD) / (KM_W - KM_PAD - 18) * (b.hi0 - b.lo0); }
  function kmUy(py) { const b = kmBounds(); return b.lo1 + (KM_H - KM_PAD - py) / (KM_H - KM_PAD - 22) * (b.hi1 - b.lo1); }
  function kmCompute() {
    const K = KM.mu.length, frames = [];
    if (!KM.pts.length || !K) { KM.frames = []; return; }
    let mu = KM.mu.map(m => m.slice());
    frames.push({ kind: 'init', mu: mu.map(m => m.slice()), assign: null, rows: [], t: 0 });
    let prevKey = null, converged = false;
    for (let t = 1; t <= 40; t++) {
      const assign = [], rows = [];
      KM.pts.forEach(p => {
        const ds = mu.map(m => clD2(p.x, m));
        let best = 0;
        for (let k = 1; k < K; k++) if (ds[k] < ds[best] - 1e-12) best = k;
        const tie = ds.filter(d => Math.abs(d - ds[best]) < 1e-12).length > 1;
        assign.push(best);
        rows.push({ p: p, ds: ds, k: best, tie: tie });
      });
      const clusters = [];
      for (let k = 0; k < K; k++) clusters.push([]);
      KM.pts.forEach((p, i) => clusters[assign[i]].push(p));
      const key = assign.join(',');
      const same = key === prevKey;
      frames.push({ kind: 'assign', mu: mu.map(m => m.slice()), assign: assign.slice(), rows: rows,
                    clusters: clusters, t: t, same: same });
      const newMu = clusters.map((c, k) => c.length ? clCentroid(c) : mu[k].slice());
      frames.push({ kind: 'update', mu: newMu.map(m => m.slice()), assign: assign.slice(), rows: rows,
                    clusters: clusters, t: t, same: same, moved: newMu.map((m, k) => clD2(m, mu[k]) > 1e-18) });
      mu = newMu;
      if (same) { converged = true; break; }
      prevKey = key;
    }
    KM.frames = frames;
    KM.converged = converged;
    KM.iters = frames.length > 1 ? frames[frames.length - 1].t : 0;
    if (KM.frame > frames.length - 1) KM.frame = frames.length - 1;
  }
  function kmRegions(mu) {
    if (!KM.regions || !mu.length) return '';
    const cols = 76, rows = 54;
    const b = kmBounds();
    let g = '';
    const x0 = KM_PAD, x1 = KM_W - 18, y0 = 22, y1 = KM_H - KM_PAD;
    const dw = (x1 - x0) / cols, dh = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) {
      const py = y0 + (r + 0.5) * dh, uy = kmUy(py);
      let runStart = 0, runK = -1;
      for (let c = 0; c <= cols; c++) {
        let k = -2;
        if (c < cols) {
          const ux = kmUx(x0 + (c + 0.5) * dw);
          let best = 0, bd = Infinity;
          for (let i = 0; i < mu.length; i++) {
            const d = (ux - mu[i][0]) * (ux - mu[i][0]) + (uy - mu[i][1]) * (uy - mu[i][1]);
            if (d < bd - 1e-12) { bd = d; best = i; }
          }
          k = best;
        }
        if (k !== runK) {
          if (runK >= 0 && c > runStart) {
            g += `<rect x="${(x0 + runStart * dw).toFixed(1)}" y="${(y0 + r * dh).toFixed(1)}" `
              + `width="${((c - runStart) * dw + 0.6).toFixed(1)}" height="${(dh + 0.6).toFixed(1)}" `
              + `fill="${cluColour(runK)}" opacity="0.10"/>`;
          }
          runStart = c; runK = k;
        }
      }
    }
    return g;
  }
  function kmCanvas() {
    const f = KM.frames[KM.frame] || { mu: KM.mu, assign: null };
    const b = kmBounds();
    let g = kmRegions(f.mu);
    // grid + axes
    const gx0 = Math.ceil(b.lo0), gx1 = Math.floor(b.hi0), gy0 = Math.ceil(b.lo1), gy1 = Math.floor(b.hi1);
    if (gx1 - gx0 <= 24) for (let x = gx0; x <= gx1; x++)
      g += `<line x1="${kmCx(x).toFixed(1)}" y1="22" x2="${kmCx(x).toFixed(1)}" y2="${KM_H - KM_PAD}" stroke="var(--rule)" stroke-width="0.5"/>`;
    if (gy1 - gy0 <= 24) for (let y = gy0; y <= gy1; y++)
      g += `<line x1="${KM_PAD}" y1="${kmCy(y).toFixed(1)}" x2="${KM_W - 18}" y2="${kmCy(y).toFixed(1)}" stroke="var(--rule)" stroke-width="0.5"/>`;
    g += `<line x1="${KM_PAD}" y1="22" x2="${KM_PAD}" y2="${KM_H - KM_PAD}" stroke="var(--ink-muted)"/>`;
    g += `<line x1="${KM_PAD}" y1="${KM_H - KM_PAD}" x2="${KM_W - 18}" y2="${KM_H - KM_PAD}" stroke="var(--ink-muted)"/>`;
    if (gx1 - gx0 <= 24) for (let x = gx0; x <= gx1; x++)
      g += `<text x="${kmCx(x).toFixed(1)}" y="${KM_H - KM_PAD + 14}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">${x}</text>`;
    if (gy1 - gy0 <= 24) for (let y = gy0; y <= gy1; y++)
      g += `<text x="${KM_PAD - 6}" y="${(kmCy(y) + 3).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">${y}</text>`;
    // links from points to their centre (assign phase makes the decision visible)
    if (f.assign && f.kind === 'assign') {
      KM.pts.forEach((p, i) => {
        const k = f.assign[i];
        g += `<line x1="${kmCx(p.x[0]).toFixed(1)}" y1="${kmCy(p.x[1]).toFixed(1)}" `
          + `x2="${kmCx(f.mu[k][0]).toFixed(1)}" y2="${kmCy(f.mu[k][1]).toFixed(1)}" `
          + `stroke="${cluColour(k)}" stroke-width="1" opacity="0.5" stroke-dasharray="3 2"/>`;
      });
    }
    // ghost of the previous centre position during the update phase
    if (f.kind === 'update') {
      const prev = KM.frames[KM.frame - 1];
      if (prev) f.mu.forEach((m, k) => {
        const o = prev.mu[k];
        if (clD2(m, o) < 1e-18) return;
        g += `<line x1="${kmCx(o[0]).toFixed(1)}" y1="${kmCy(o[1]).toFixed(1)}" x2="${kmCx(m[0]).toFixed(1)}" y2="${kmCy(m[1]).toFixed(1)}" stroke="${cluColour(k)}" stroke-width="1.4" opacity="0.55"/>`;
        g += `<circle cx="${kmCx(o[0]).toFixed(1)}" cy="${kmCy(o[1]).toFixed(1)}" r="3" fill="none" stroke="${cluColour(k)}" stroke-width="1" opacity="0.55"/>`;
      });
    }
    // points
    KM.pts.forEach((p, i) => {
      const k = f.assign ? f.assign[i] : -1;
      const col = k >= 0 ? cluColour(k) : 'var(--ink-muted)';
      const tie = f.rows && f.rows[i] && f.rows[i].tie;
      g += `<circle class="grab" data-ix="p${i}" cx="${kmCx(p.x[0]).toFixed(1)}" cy="${kmCy(p.x[1]).toFixed(1)}" r="7" `
        + `fill="${col}" stroke="${tie ? 'var(--accent-2)' : 'var(--surface)'}" stroke-width="${tie ? 2.5 : 1.5}"/>`;
      g += `<text x="${(kmCx(p.x[0]) + 9).toFixed(1)}" y="${(kmCy(p.x[1]) - 7).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--ink-muted)" pointer-events="none">${esc(p.name)}</text>`;
    });
    // centres
    f.mu.forEach((m, k) => {
      const X = kmCx(m[0]), Y = kmCy(m[1]), col = cluColour(k);
      g += `<g class="grab" data-ix="m${k}">`
        + `<circle data-ix="m${k}" cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="11" fill="transparent"/>`
        + `<line data-ix="m${k}" x1="${(X - 8).toFixed(1)}" y1="${(Y - 8).toFixed(1)}" x2="${(X + 8).toFixed(1)}" y2="${(Y + 8).toFixed(1)}" stroke="${col}" stroke-width="3"/>`
        + `<line data-ix="m${k}" x1="${(X - 8).toFixed(1)}" y1="${(Y + 8).toFixed(1)}" x2="${(X + 8).toFixed(1)}" y2="${(Y - 8).toFixed(1)}" stroke="${col}" stroke-width="3"/></g>`;
      g += `<text x="${(X + 11).toFixed(1)}" y="${(Y + 15).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9" fill="${col}" pointer-events="none">µ${k + 1}${clVec(m)}</text>`;
    });
    return `<div class="ix-canvas"><svg id="km-svg" class="hit" width="100%" viewBox="0 0 ${KM_W} ${KM_H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + `<title>K-means canvas</title><desc>Drag points and cluster centres; shaded regions show which centre currently owns each part of the plane.</desc>`
      + g + '</svg></div>';
  }
  function kmSync() {
    const a = document.getElementById('km-pts'), b = document.getElementById('km-mu');
    if (a) a.value = KM.pts.map(p => p.name + ': ' + p.x.map(v => clNum(v, Number.isInteger(v) ? 0 : 2)).join(' ')).join('\n');
    if (b) b.value = KM.mu.map(m => m.map(v => clNum(v, Number.isInteger(v) ? 0 : 2)).join(' ')).join('\n');
    const sel = document.getElementById('km-preset');
    if (sel) sel.value = 'custom';
  }
  function kmMove(px, py, key) {
    const i = parseInt(key.slice(1), 10);
    let x = IX.snap(kmUx(px), KM.snap), y = IX.snap(kmUy(py), KM.snap);
    const b = kmBounds();
    x = Math.max(b.lo0, Math.min(b.hi0, x)); y = Math.max(b.lo1, Math.min(b.hi1, y));
    if (key[0] === 'p') { if (!KM.pts[i]) return; KM.pts[i].x = [x, y]; }
    else { if (!KM.mu[i]) return; KM.mu[i] = [x, y]; }
    IX.stop('km');
    kmCompute();
    kmRender();
  }
  function kmAddPoint(px, py) {
    if (px < KM_PAD - 6 || px > KM_W - 12 || py < 16 || py > KM_H - KM_PAD + 6) return false;
    if (KM.pts.length >= 40) return false;
    const x = IX.snap(kmUx(px), KM.snap), y = IX.snap(kmUy(py), KM.snap);
    let n = KM.pts.length + 1;
    const used = {}; KM.pts.forEach(p => used[p.name] = 1);
    while (used['p' + n]) n++;
    KM.pts.push({ name: 'p' + n, x: [x, y] });
    IX.stop('km'); KM.frame = 0; kmSync(); kmCompute(); kmRender();
    return true;
  }
  function kmRemove(key) {
    const i = parseInt(key.slice(1), 10);
    if (key[0] === 'p') { if (KM.pts.length <= 2) return; KM.pts.splice(i, 1); }
    else { if (KM.mu.length <= 1) return; KM.mu.splice(i, 1); }
    IX.stop('km'); KM.frame = 0; kmSync(); kmCompute(); kmRender();
  }
  function kmSetK(d) {
    if (d > 0) {
      if (KM.mu.length >= Math.min(8, KM.pts.length)) return;
      const taken = KM.mu.map(m => m.join(','));
      let seed = KM.pts.filter(p => taken.indexOf(p.x.join(',')) < 0)[0];
      KM.mu.push(seed ? seed.x.slice() : KM.pts[0].x.slice());
    } else {
      if (KM.mu.length <= 1) return;
      KM.mu.pop();
    }
    IX.stop('km'); KM.frame = 0; kmSync(); kmCompute(); kmRender();
  }
  function kmReseed() {
    const K = KM.mu.length, idx = [];
    const pool = KM.pts.map((p, i) => i);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    for (let k = 0; k < K && k < pool.length; k++) idx.push(pool[k]);
    KM.mu = idx.map(i => KM.pts[i].x.slice());
    IX.stop('km'); KM.frame = 0; kmSync(); kmCompute(); kmRender();
  }
  function kmToggle(what, on) {
    KM[what] = on;
    if (what === 'snap' && on) {
      KM.pts.forEach(p => p.x = p.x.map(v => Math.round(v)));
      KM.mu = KM.mu.map(m => m.map(v => Math.round(v)));
      kmSync(); kmCompute();
    }
    kmRender();
  }
  function kmFit() { kmBounds(true); kmRender(); }
  function kmStep(d, fromSlider) {
    const total = KM.frames.length;
    if (d === 'play') {
      IX.play('km', total, () => KM.frame, f => { KM.frame = f; kmRender(); }, 800);
      kmRender(); return;
    }
    IX.stop('km');
    if (d === 'first') KM.frame = 0;
    else if (d === 'last') KM.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) KM.frame = d;
    else KM.frame = Math.max(0, Math.min(total - 1, KM.frame + d));
    kmRender();
  }
  function kmRender() {
    const out = document.getElementById('km-output');
    if (!out) return;
    if (!KM.frames.length) { out.innerHTML = '<div class="tool-error">Nothing to cluster.</div>'; return; }
    const f = KM.frames[KM.frame], K = KM.mu.length;
    const total = KM.frames.length;
    let html = '';
    const last = KM.frames[KM.frames.length - 1];
    let totalV = 0;
    if (last.clusters) last.clusters.forEach(c => { if (c.length) totalV += clWCV(c).V; });
    html += `<div class="verdict ${KM.converged ? 'safe' : 'warn'}">
      <strong>K = ${K}</strong> &nbsp;·&nbsp; ${KM.pts.length} points &nbsp;·&nbsp;
      ${KM.converged ? 'converges after <strong>' + KM.iters + '</strong> iteration' + (KM.iters === 1 ? '' : 's')
        : 'has not settled within 40 iterations'}
      &nbsp;·&nbsp; final total within-cluster variance <strong>${clFmt(totalV, 4)}</strong></div>`;
    html += kmCanvas();
    const phase = f.kind === 'init' ? ['assign', 'start'] : f.kind === 'assign'
      ? (f.same ? ['done', 'assign — nothing moved'] : ['assign', 'step 2 · assign'])
      : ['update', 'step 3 · recompute centres'];
    const label = f.kind === 'init' ? 'initial centres' : `iteration <strong>${f.t}</strong> of ${KM.iters}`;
    html += IX.player('km', KM.frame, total, label, phase);
    html += `<div class="ix-bar">
      <button class="ix-btn" onclick="kmSetK(-1)" ${K <= 1 ? 'disabled' : ''}>− K</button>
      <span class="ix-lab">K = <strong>${K}</strong></span>
      <button class="ix-btn" onclick="kmSetK(1)" ${K >= Math.min(8, KM.pts.length) ? 'disabled' : ''}>+ K</button>
      <button class="ix-btn" onclick="kmReseed()" title="Pick K random data points as the new centres">⟳ reseed centres</button>
      <button class="ix-btn" onclick="kmFit()" title="Rescale the axes to fit the data">⤢ fit view</button>
      ${IX.toggles([
        { label: 'snap to integers', on: KM.snap, fn: "kmToggle('snap', this.checked)" },
        { label: 'shade regions', on: KM.regions, fn: "kmToggle('regions', this.checked)" }
      ])}
    </div>`;
    html += `<p class="ix-hint"><strong>Drag</strong> any point or ✕ centre to move it · <strong>click empty space</strong> to add a point ·
      <kbd>shift</kbd>-click or right-click to delete · the shaded regions are the <em>current</em> decision boundaries,
      so a point is assigned to whichever shade it sits in.</p>`;
    // current-step detail
    if (f.kind !== 'init') {
      html += `<div class="kmstep ${f.same ? 'conv' : ''}"><h5>Iteration ${f.t} — ${f.kind === 'assign' ? 'assignment' : 'centre update'}${f.same ? ' · clusters unchanged, algorithm stops' : ''}</h5>`;
      if (f.kind === 'assign') {
        const shown = KM.frames[KM.frame].mu;
        html += '<div style="font-family:\'IBM Plex Mono\',monospace; font-size:11.5px; margin-bottom:8px; color:var(--ink-muted);">centres in use: '
          + shown.map((m, k) => `<span style="color:${cluColour(k)};">µ${k + 1}=${clVec(m)}</span>`).join(' &nbsp; ') + '</div>';
        f.rows.forEach(r => {
          html += `<div class="assign-row">${esc(r.p.name)} &nbsp; `
            + r.ds.map((d, k) => `<span style="color:${k === r.k ? cluColour(k) : 'var(--ink-muted)'}; font-weight:${k === r.k ? 700 : 400};">d²(µ${k + 1})=${clFmt(d, 3)}</span>`).join(' &nbsp; ')
            + ` &nbsp;→&nbsp; <strong style="color:${cluColour(r.k)};">C${r.k + 1}</strong>`
            + (r.tie ? ' <span class="tie">TIE — lowest index wins</span>' : '') + '</div>';
        });
      } else {
        const prev = KM.frames[KM.frame - 1];
        f.clusters.forEach((c, k) => {
          const moved = f.moved && f.moved[k];
          html += `<div class="assign-row"><strong style="color:${cluColour(k)};">µ${k + 1}</strong> = mean of {${c.map(m => esc(m.name)).join(', ') || '∅'}} = `
            + (c.length ? `(${c.map(m => clNum(m.x[0], 0)).join('+')})/${c.length}, (${c.map(m => clNum(m.x[1], 0)).join('+')})/${c.length} = ` : '')
            + `<strong>${clVec(f.mu[k])}</strong>`
            + (moved ? ` <span style="color:var(--ink-muted);">moved from ${clVec(prev.mu[k])}</span>` : ' <span style="color:var(--accent-3);">unchanged</span>')
            + '</div>';
        });
      }
      html += '<div class="frontier" style="margin-top:8px;">';
      f.clusters.forEach((c, k) => {
        const V = c.length ? clWCV(c).V : 0;
        html += `<span class="clu" style="border-color:${cluColour(k)}; color:${cluColour(k)};"><span class="dot" style="background:${cluColour(k)};"></span>C${k + 1} = {${c.map(m => esc(m.name)).join(', ') || '∅'}} · V = ${clFmt(V, 3)}</span>`;
      });
      html += '</div></div>';
    } else {
      html += `<div class="kmstep"><h5>t = 0 — initial centres</h5>
        <div style="font-family:'IBM Plex Mono',monospace; font-size:12px;">`
        + KM.mu.map((m, k) => `<span style="color:${cluColour(k)};">µ${k + 1}<sup>(0)</sup> = ${clVec(m)}</span>`).join('<br>')
        + `</div><p style="font-size:12.5px; color:var(--ink-muted); margin:8px 0 0 0;">There are no clusters yet at t = 0. Press <strong>▶</strong> to run the first assignment.</p></div>`;
    }
    html += `<p style="font-size:12.5px; color:var(--ink-muted); margin-top:10px;">
      Distances are <strong>squared</strong> — comparing squares orders points identically and avoids square roots.
      Ties break to the <strong>lowest cluster index</strong>, as Definition 6.2 requires; tied points are ringed in orange.</p>`;
    out.innerHTML = html;
    const svg = document.getElementById('km-svg');
    if (svg) IX.drag(svg, { W: KM_W, H: KM_H, onMove: kmMove, onRemove: kmRemove,
      onBlank: kmAddPoint, onDrop: function () { kmSync(); } });
  }
  function runKM() {
    const out = document.getElementById('km-output');
    if (!out) return;
    IX.stop('km');
    const P = clParsePoints(document.getElementById('km-pts').value);
    const M = clParsePoints(document.getElementById('km-mu').value);
    const errs = P.errs.concat(M.errs);
    let head = '';
    if (errs.length) head = `<div class="verdict bad">${errs.map(esc).join('<br>')}</div>`;
    if (P.pts.length < 2) { out.innerHTML = head + '<div class="tool-error">Give at least two points.</div>'; return; }
    if (!M.pts.length) { out.innerHTML = head + '<div class="tool-error">Give at least one initial centre.</div>'; return; }
    if (P.dims !== 2) { out.innerHTML = head + '<div class="tool-error">The interactive canvas needs 2-D points — give exactly two coordinates each.</div>'; return; }
    if (M.dims !== P.dims) { out.innerHTML = head + `<div class="tool-error">Points have ${P.dims} coordinates but the centres have ${M.dims}.</div>`; return; }
    if (M.pts.length > P.pts.length) { out.innerHTML = head + '<div class="tool-error">More centres than points.</div>'; return; }
    if (P.pts.length > 40) { out.innerHTML = head + '<div class="tool-error">Forty points at most.</div>'; return; }
    KM.pts = P.pts.map(p => ({ name: p.name, x: p.x.slice() }));
    KM.mu = M.pts.map(p => p.x.slice());
    KM.frame = 0;
    kmBounds(true);
    kmCompute();
    kmRender();
    if (head) out.innerHTML = head + out.innerHTML;
  }
  TOOL_RUNNERS.runKM = runKM;
  TOOL_RUNNERS.kmPreset = runKM;
  /* ---------- hierarchical clustering ---------- */
  function hcLink(c1, c2, metric, crit) {
    let best = crit === 'complete' ? -Infinity : Infinity, sum = 0, n = 0;
    for (let a = 0; a < c1.length; a++)
      for (let b = 0; b < c2.length; b++) {
        const d = metric(c1[a].x, c2[b].x);
        sum += d; n++;
        if (crit === 'complete') { if (d > best) best = d; }
        else if (d < best) best = d;
      }
    return crit === 'average' ? sum / n : best;
  }
  function hcRun(pts, metric, crit, cap) {
    let clusters = pts.map((p, i) => ({ members: [p], label: [i], id: i, h: 0, kids: null, order: i }));
    const steps = [];
    let guard = 0;
    while (clusters.length > 1 && guard++ < (cap || 200)) {
      const table = [];
      let min = Infinity;
      for (let i = 0; i < clusters.length; i++)
        for (let j = i + 1; j < clusters.length; j++) {
          const d = hcLink(clusters[i].members, clusters[j].members, metric, crit);
          table.push({ i: i, j: j, d: d });
          if (d < min - 1e-9) min = d;
        }
      const atMin = table.filter(e => Math.abs(e.d - min) < 1e-9);
      // union-find over the tied pairs (handles both tie scenarios in Remark 6.11)
      const par = clusters.map((_, i) => i);
      const find = x => { while (par[x] !== x) x = par[x]; return x; };
      atMin.forEach(e => { const a = find(e.i), b = find(e.j); if (a !== b) par[Math.max(a, b)] = Math.min(a, b); });
      const groups = {};
      clusters.forEach((c, i) => { const r = find(i); (groups[r] = groups[r] || []).push(i); });
      const merged = [];
      Object.keys(groups).map(Number).sort((a, b) => a - b).forEach(r => {
        const idxs = groups[r];
        if (idxs.length === 1) { merged.push(clusters[idxs[0]]); return; }
        const members = [], label = [], kids = [];
        idxs.forEach(i => { clusters[i].members.forEach(m => members.push(m)); clusters[i].label.forEach(l => label.push(l)); kids.push(clusters[i]); });
        label.sort((a, b) => a - b);
        merged.push({ members: members, label: label, h: min, kids: kids, order: Math.min.apply(null, kids.map(k => k.order)) });
      });
      merged.sort((a, b) => Math.min.apply(null, a.label) - Math.min.apply(null, b.label));
      steps.push({ t: steps.length + 1, before: clusters, table: table, threshold: min, after: merged,
        mergedGroups: Object.keys(groups).map(k => groups[Number(k)]).filter(g => g.length > 1) });
      clusters = merged;
    }
    return { steps: steps, root: clusters.length === 1 ? clusters[0] : null, final: clusters };
  }
  function hcLabel(c, pts) { return '{' + c.label.map(i => pts[i].name.replace(/^p/, '')).join(',') + '}'; }
  function hcDendro(root, pts) {
    if (!root) return '';
    const leaves = [];
    (function walk(n) { if (!n.kids) { leaves.push(n); return; } n.kids.forEach(walk); })(root);
    const W = Math.max(360, 60 + leaves.length * 62), H = 300, padL = 46, padB = 40, padT = 22;
    let maxH = 0;
    (function mx(n) { if (n.h > maxH) maxH = n.h; if (n.kids) n.kids.forEach(mx); })(root);
    if (maxH <= 0) maxH = 1;
    const stepX = (W - padL - 16) / Math.max(1, leaves.length);
    leaves.forEach((l, i) => { l.px = padL + stepX * (i + 0.5); });
    const cy = h => H - padB - (h / (maxH * 1.08)) * (H - padB - padT);
    let g = '';
    (function pos(n) {
      if (!n.kids) return n.px;
      const xs = n.kids.map(pos);
      n.px = xs.reduce((a, b) => a + b, 0) / xs.length;
      return n.px;
    })(root);
    (function draw(n) {
      if (!n.kids) return;
      const y = cy(n.h);
      const xs = n.kids.map(k => k.px);
      g += `<line x1="${Math.min.apply(null, xs).toFixed(1)}" y1="${y.toFixed(1)}" x2="${Math.max.apply(null, xs).toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--accent)" stroke-width="1.8"/>`;
      n.kids.forEach(k => {
        g += `<line x1="${k.px.toFixed(1)}" y1="${cy(k.kids ? k.h : 0).toFixed(1)}" x2="${k.px.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--accent)" stroke-width="1.8"/>`;
        draw(k);
      });
      g += `<text x="${(n.px + 5).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--accent-2)">${clFmt(n.h, 2)}</text>`;
    })(root);
    leaves.forEach(l => {
      g += `<text x="${l.px.toFixed(1)}" y="${(H - padB + 15).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="var(--ink)">${esc(pts[l.label[0]].name)}</text>`;
    });
    // axis
    g += `<line x1="${padL - 12}" y1="${cy(0)}" x2="${padL - 12}" y2="${padT}" stroke="var(--ink-muted)"/>`;
    for (let s = 0; s <= 4; s++) {
      const v = maxH * s / 4, y = cy(v);
      g += `<line x1="${padL - 16}" y1="${y.toFixed(1)}" x2="${padL - 12}" y2="${y.toFixed(1)}" stroke="var(--ink-muted)"/>`;
      g += `<text x="${padL - 19}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">${clFmt(v, 1)}</text>`;
    }
    g += `<line x1="${padL - 12}" y1="${cy(0)}" x2="${W - 16}" y2="${cy(0)}" stroke="var(--rule)"/>`;
    return `<div class="chartbox"><svg width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + '<title>Dendogram</title><desc>A dendogram: leaves are the data points, each horizontal join sits at the height of the threshold at which those clusters merged.</desc>'
      + g + '</svg><div class="caption">Join heights are the merge thresholds. A long vertical gap below a join means those clusters were far apart — a good place to cut.</div></div>';
  }
  /* ---------- Hierarchical: interactive canvas, step player, cuttable dendogram ---------- */
  const HC = { pts: [], run: null, frame: 0, snap: true, hulls: true, bounds: null };
  const HC_W = 430, HC_H = 320, HC_PAD = 40;
  function hcBounds(force) {
    if (HC.bounds && !force) return HC.bounds;
    let lo0 = Infinity, hi0 = -Infinity, lo1 = Infinity, hi1 = -Infinity;
    if (!HC.pts.length) { HC.bounds = { lo0: 0, hi0: 10, lo1: 0, hi1: 10 }; return HC.bounds; }
    HC.pts.forEach(p => {
      if (p.x[0] < lo0) lo0 = p.x[0]; if (p.x[0] > hi0) hi0 = p.x[0];
      if (p.x[1] < lo1) lo1 = p.x[1]; if (p.x[1] > hi1) hi1 = p.x[1];
    });
    const mx = Math.max(1.5, (hi0 - lo0) * 0.18), my = Math.max(1.5, (hi1 - lo1) * 0.18);
    HC.bounds = { lo0: lo0 - mx, hi0: hi0 + mx, lo1: lo1 - my, hi1: hi1 + my };
    return HC.bounds;
  }
  function hcCx(x) { const b = hcBounds(); return HC_PAD + (x - b.lo0) / (b.hi0 - b.lo0) * (HC_W - HC_PAD - 18); }
  function hcCy(y) { const b = hcBounds(); return HC_H - HC_PAD - (y - b.lo1) / (b.hi1 - b.lo1) * (HC_H - HC_PAD - 22); }
  function hcUx(px) { const b = hcBounds(); return b.lo0 + (px - HC_PAD) / (HC_W - HC_PAD - 18) * (b.hi0 - b.lo0); }
  function hcUy(py) { const b = hcBounds(); return b.lo1 + (HC_H - HC_PAD - py) / (HC_H - HC_PAD - 22) * (b.hi1 - b.lo1); }
  function hcMetric() { return document.getElementById('hc-metric').value === 'l1' ? clL1 : clL2; }
  function hcCrit() { return document.getElementById('hc-link').value; }
  function hcCompute() {
    HC.run = HC.pts.length >= 2 ? hcRun(HC.pts, hcMetric(), hcCrit(), 200) : null;
    const total = HC.run ? HC.run.steps.length + 1 : 1;
    if (HC.frame > total - 1) HC.frame = total - 1;
  }
  /* clusters visible at the current frame (frame 0 = all singletons) */
  function hcAt(frame) {
    if (!HC.run) return HC.pts.map((p, i) => ({ label: [i], members: [p] }));
    if (frame <= 0) return HC.pts.map((p, i) => ({ label: [i], members: [p] }));
    return HC.run.steps[frame - 1].after;
  }
  function hcHull(members) {
    /* convex hull (monotone chain) so a cluster reads as a blob */
    const pts = members.map(m => [hcCx(m.x[0]), hcCy(m.x[1])]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    pts.forEach(p => { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); });
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }
  function hcCanvas() {
    const clusters = hcAt(HC.frame);
    const owner = {};
    clusters.forEach((c, k) => c.label.forEach(i => owner[i] = k));
    const b = hcBounds();
    let g = '';
    const gx0 = Math.ceil(b.lo0 / 5) * 5, gx1 = Math.floor(b.hi0 / 5) * 5;
    const gy0 = Math.ceil(b.lo1 / 5) * 5, gy1 = Math.floor(b.hi1 / 5) * 5;
    for (let x = gx0; x <= gx1; x += 5)
      g += `<line x1="${hcCx(x).toFixed(1)}" y1="22" x2="${hcCx(x).toFixed(1)}" y2="${HC_H - HC_PAD}" stroke="var(--rule)" stroke-width="0.5"/>`;
    for (let y = gy0; y <= gy1; y += 5)
      g += `<line x1="${HC_PAD}" y1="${hcCy(y).toFixed(1)}" x2="${HC_W - 18}" y2="${hcCy(y).toFixed(1)}" stroke="var(--rule)" stroke-width="0.5"/>`;
    g += `<line x1="${HC_PAD}" y1="22" x2="${HC_PAD}" y2="${HC_H - HC_PAD}" stroke="var(--ink-muted)"/>`;
    g += `<line x1="${HC_PAD}" y1="${HC_H - HC_PAD}" x2="${HC_W - 18}" y2="${HC_H - HC_PAD}" stroke="var(--ink-muted)"/>`;
    for (let x = gx0; x <= gx1; x += 5)
      g += `<text x="${hcCx(x).toFixed(1)}" y="${HC_H - HC_PAD + 14}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">${x}</text>`;
    for (let y = gy0; y <= gy1; y += 5)
      g += `<text x="${HC_PAD - 6}" y="${(hcCy(y) + 3).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">${y}</text>`;
    // cluster blobs
    if (HC.hulls) clusters.forEach((c, k) => {
      if (c.members.length < 2) return;
      const h = hcHull(c.members);
      if (h.length === 2) {
        g += `<line x1="${h[0][0].toFixed(1)}" y1="${h[0][1].toFixed(1)}" x2="${h[1][0].toFixed(1)}" y2="${h[1][1].toFixed(1)}" stroke="${cluColour(k)}" stroke-width="13" opacity="0.16" stroke-linecap="round"/>`;
      } else if (h.length > 2) {
        g += `<polygon points="${h.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="${cluColour(k)}" opacity="0.15" stroke="${cluColour(k)}" stroke-width="9" stroke-linejoin="round" stroke-opacity="0.16"/>`;
      }
    });
    // the pair(s) about to merge at this frame
    if (HC.run && HC.frame < HC.run.steps.length) {
      const s = HC.run.steps[HC.frame];
      s.mergedGroups.forEach(gr => {
        for (let a = 0; a < gr.length; a++) for (let bq = a + 1; bq < gr.length; bq++) {
          const A = s.before[gr[a]].members, B = s.before[gr[bq]].members;
          let bestA = null, bestB = null, bd = Infinity;
          A.forEach(p => B.forEach(q => { const dd = hcMetric()(p.x, q.x); if (dd < bd) { bd = dd; bestA = p; bestB = q; } }));
          if (bestA) g += `<line x1="${hcCx(bestA.x[0]).toFixed(1)}" y1="${hcCy(bestA.x[1]).toFixed(1)}" x2="${hcCx(bestB.x[0]).toFixed(1)}" y2="${hcCy(bestB.x[1]).toFixed(1)}" stroke="var(--accent-2)" stroke-width="2" stroke-dasharray="5 3"/>`;
        }
      });
    }
    HC.pts.forEach((p, i) => {
      const k = owner[i] === undefined ? -1 : owner[i];
      g += `<circle class="grab" data-ix="p${i}" cx="${hcCx(p.x[0]).toFixed(1)}" cy="${hcCy(p.x[1]).toFixed(1)}" r="7" fill="${k >= 0 ? cluColour(k) : 'var(--ink-muted)'}" stroke="var(--surface)" stroke-width="1.5"/>`;
      g += `<text x="${(hcCx(p.x[0]) + 9).toFixed(1)}" y="${(hcCy(p.x[1]) - 7).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--ink-muted)" pointer-events="none">${esc(p.name)}</text>`;
    });
    return `<div class="ix-canvas"><svg id="hc-svg" class="hit" width="100%" viewBox="0 0 ${HC_W} ${HC_H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + '<title>Hierarchical clustering canvas</title><desc>Points coloured by the clusters that exist at the current step; the dashed line marks the pair about to merge.</desc>'
      + g + '</svg></div>';
  }
  /* dendogram with a draggable cut line */
  function hcDendroIx() {
    if (!HC.run || !HC.run.root) return '';
    const root = HC.run.root, pts = HC.pts;
    const leaves = [];
    (function walk(n) { if (!n.kids) { leaves.push(n); return; } n.kids.forEach(walk); })(root);
    const W = Math.max(380, 70 + leaves.length * 56), H = 280, padL = 52, padB = 38, padT = 26;
    let maxH = 0;
    (function mx(n) { if (n.h > maxH) maxH = n.h; if (n.kids) n.kids.forEach(mx); })(root);
    if (maxH <= 0) maxH = 1;
    const stepX = (W - padL - 20) / Math.max(1, leaves.length);
    leaves.forEach((l, i) => { l.px = padL + stepX * (i + 0.5); });
    const cy = h => H - padB - (h / (maxH * 1.12)) * (H - padB - padT);
    const uh = py => Math.max(0, (H - padB - py) / (H - padB - padT) * maxH * 1.12);
    (function pos(n) { if (!n.kids) return n.px; const xs = n.kids.map(pos); n.px = xs.reduce((a, b) => a + b, 0) / xs.length; return n.px; })(root);
    // colour subtrees by the clusters alive at the current frame
    const clusters = hcAt(HC.frame), owner = {};
    clusters.forEach((c, k) => c.label.forEach(i => owner[i] = k));
    const colOf = n => { const ks = n.label.map(i => owner[i]); return ks.every(k => k === ks[0]) && ks[0] !== undefined ? cluColour(ks[0]) : 'var(--ink-muted)'; };
    let g = '';
    (function draw(n) {
      if (!n.kids) return;
      const y = cy(n.h), xs = n.kids.map(k => k.px), col = colOf(n);
      g += `<line x1="${Math.min.apply(null, xs).toFixed(1)}" y1="${y.toFixed(1)}" x2="${Math.max.apply(null, xs).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="2"/>`;
      n.kids.forEach(k => {
        g += `<line x1="${k.px.toFixed(1)}" y1="${cy(k.kids ? k.h : 0).toFixed(1)}" x2="${k.px.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${colOf(k)}" stroke-width="2"/>`;
        draw(k);
      });
      g += `<text x="${(n.px + 5).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--ink-muted)" pointer-events="none">${clFmt(n.h, 2)}</text>`;
    })(root);
    leaves.forEach(l => {
      g += `<text x="${l.px.toFixed(1)}" y="${(H - padB + 15).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="${colOf(l)}" pointer-events="none">${esc(pts[l.label[0]].name)}</text>`;
    });
    for (let s = 0; s <= 4; s++) {
      const v = maxH * s / 4, y = cy(v);
      g += `<line x1="${padL - 16}" y1="${y.toFixed(1)}" x2="${padL - 12}" y2="${y.toFixed(1)}" stroke="var(--ink-muted)"/>`;
      g += `<text x="${padL - 19}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">${clFmt(v, 1)}</text>`;
    }
    g += `<line x1="${padL - 12}" y1="${cy(0)}" x2="${padL - 12}" y2="${padT}" stroke="var(--ink-muted)"/>`;
    g += `<line x1="${padL - 12}" y1="${cy(0)}" x2="${W - 16}" y2="${cy(0)}" stroke="var(--rule)"/>`;
    // the cut line: everything strictly below it has already merged
    const cutH = HC.frame === 0 ? 0 : HC.run.steps[HC.frame - 1].threshold;
    const nextH = HC.frame < HC.run.steps.length ? HC.run.steps[HC.frame].threshold : maxH * 1.12;
    const cutY = cy((cutH + nextH) / 2);
    g += `<rect data-ix="cut" x="${padL - 12}" y="${(cutY - 9).toFixed(1)}" width="${(W - padL - 4).toFixed(1)}" height="18" fill="transparent" class="grab"/>`;
    g += `<line data-ix="cut" class="grab" x1="${padL - 12}" y1="${cutY.toFixed(1)}" x2="${W - 16}" y2="${cutY.toFixed(1)}" stroke="var(--accent-2)" stroke-width="2" stroke-dasharray="7 4"/>`;
    g += `<text x="${W - 16}" y="${(cutY - 6).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="10" fill="var(--accent-2)" pointer-events="none">cut → K = ${clusters.length}</text>`;
    return `<div class="ix-canvas"><svg id="hc-dendro" width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg"
        data-maxh="${maxH}" data-padb="${padB}" data-padt="${padT}" data-h="${H}">`
      + '<title>Dendogram</title><desc>Leaves are the data points; each horizontal join sits at the merge threshold. The dashed line is the cut, and can be dragged.</desc>'
      + g + '</svg></div>';
  }
  function hcCutTo(px, py) {
    const svg = document.getElementById('hc-dendro');
    if (!svg || !HC.run) return;
    const maxH = Number(svg.getAttribute('data-maxh')), padB = Number(svg.getAttribute('data-padb'));
    const padT = Number(svg.getAttribute('data-padt')), H = Number(svg.getAttribute('data-h'));
    const h = Math.max(0, (H - padB - py) / (H - padB - padT) * maxH * 1.12);
    let f = 0;
    HC.run.steps.forEach((s, i) => { if (s.threshold <= h + 1e-9) f = i + 1; });
    if (f !== HC.frame) { IX.stop('hc'); HC.frame = f; hcRender(); }
  }
  function hcSync() {
    const a = document.getElementById('hc-pts');
    if (a) a.value = HC.pts.map(p => p.name + ': ' + p.x.map(v => clNum(v, Number.isInteger(v) ? 0 : 2)).join(' ')).join('\n');
  }
  function hcMove(px, py, key) {
    if (key === 'cut') { hcCutTo(px, py); return; }
    const i = parseInt(key.slice(1), 10);
    if (!HC.pts[i]) return;
    let x = IX.snap(hcUx(px), HC.snap), y = IX.snap(hcUy(py), HC.snap);
    const b = hcBounds();
    HC.pts[i].x = [Math.max(b.lo0, Math.min(b.hi0, x)), Math.max(b.lo1, Math.min(b.hi1, y))];
    IX.stop('hc'); hcCompute(); hcRender();
  }
  function hcAdd(px, py) {
    if (px < HC_PAD - 6 || px > HC_W - 12 || py < 16 || py > HC_H - HC_PAD + 6) return false;
    if (HC.pts.length >= 14) return false;
    let n = HC.pts.length + 1;
    const used = {}; HC.pts.forEach(p => used[p.name] = 1);
    while (used['p' + n]) n++;
    HC.pts.push({ name: 'p' + n, x: [IX.snap(hcUx(px), HC.snap), IX.snap(hcUy(py), HC.snap)] });
    IX.stop('hc'); HC.frame = 0; hcSync(); hcCompute(); hcRender();
    return true;
  }
  function hcDel(key) {
    if (key === 'cut') return;
    const i = parseInt(key.slice(1), 10);
    if (HC.pts.length <= 2) return;
    HC.pts.splice(i, 1);
    IX.stop('hc'); HC.frame = 0; hcSync(); hcCompute(); hcRender();
  }
  function hcToggle(what, on) {
    HC[what] = on;
    if (what === 'snap' && on) { HC.pts.forEach(p => p.x = p.x.map(v => Math.round(v))); hcSync(); hcCompute(); }
    hcRender();
  }
  function hcFit() { hcBounds(true); hcRender(); }
  function hcOpt() { IX.stop('hc'); hcCompute(); hcRender(); }
  function hcStep(d, fromSlider) {
    const total = HC.run ? HC.run.steps.length + 1 : 1;
    if (d === 'play') { IX.play('hc', total, () => HC.frame, f => { HC.frame = f; hcRender(); }, 950); hcRender(); return; }
    IX.stop('hc');
    if (d === 'first') HC.frame = 0;
    else if (d === 'last') HC.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) HC.frame = d;
    else HC.frame = Math.max(0, Math.min(total - 1, HC.frame + d));
    hcRender();
  }
  function hcRender() {
    const out = document.getElementById('hc-output');
    if (!out) return;
    if (!HC.run) { out.innerHTML = '<div class="tool-error">Give at least two points.</div>'; return; }
    const crit = hcCrit(), mname = document.getElementById('hc-metric').value;
    const R = HC.run, total = R.steps.length + 1;
    const clusters = hcAt(HC.frame);
    const critName = { single: 'single-linkage (min)', complete: 'complete-linkage (max)', average: 'average-linkage (mean)' }[crit];
    let html = `<div class="verdict safe"><strong>${critName}</strong> with <strong>${mname === 'l1' ? 'Manhattan L₁' : 'Euclidean L₂'}</strong>
      &nbsp;·&nbsp; ${HC.pts.length} points &nbsp;·&nbsp; ${R.steps.length} step${R.steps.length === 1 ? '' : 's'}
      &nbsp;·&nbsp; thresholds <strong>${R.steps.map(s => clFmt(s.threshold, 2)).join(', ')}</strong></div>`;
    if (R.steps.length < HC.pts.length - 1)
      html += `<div class="verdict warn">Finished in ${R.steps.length} steps rather than the maximum ${HC.pts.length - 1} — at least one step merged more than two clusters at the threshold (Remark 6.11), so some values of K never occur.</div>`;
    const label = HC.frame === 0 ? 't = 0 · every point its own cluster'
      : `after step <strong>${HC.frame}</strong> · threshold ${clFmt(R.steps[HC.frame - 1].threshold, 2)}`;
    html += '<div class="compare-2" style="align-items:start; gap:14px;">' + hcCanvas() + hcDendroIx() + '</div>';
    html += IX.player('hc', HC.frame, total, label, ['assign', 'K = ' + clusters.length]);
    html += `<div class="ix-bar">
      <button class="ix-btn" onclick="hcFit()" title="Rescale the axes to fit the data">⤢ fit view</button>
      ${IX.toggles([
        { label: 'snap to integers', on: HC.snap, fn: "hcToggle('snap', this.checked)" },
        { label: 'shade clusters', on: HC.hulls, fn: "hcToggle('hulls', this.checked)" }
      ])}
    </div>`;
    html += `<p class="ix-hint"><strong>Drag points</strong> on the left to move them · <strong>click empty space</strong> to add one ·
      <kbd>shift</kbd>-click to delete · <strong>drag the dashed cut line</strong> on the dendogram to pick K, or use the player.
      Changing the linkage or metric dropdown re-clusters immediately.</p>`;
    html += '<div class="frontier" style="margin:10px 0;">';
    clusters.forEach((c, k) => {
      html += `<span class="clu" style="border-color:${cluColour(k)}; color:${cluColour(k)};"><span class="dot" style="background:${cluColour(k)};"></span>${c.label.map(i => esc(HC.pts[i].name)).join(', ')}</span>`;
    });
    html += '</div>';
    // distance table for the current step
    if (HC.frame < R.steps.length) {
      const s = R.steps[HC.frame], n = s.before.length;
      html += `<div class="kmstep"><h5>Next merge — cluster distance table, minimum ${clFmt(s.threshold, 2)}</h5>`;
      html += '<table class="dmx"><tr><th></th>';
      for (let j = 0; j < n - 1; j++) html += `<th>${hcLabel(s.before[j], HC.pts)}</th>`;
      html += '</tr>';
      for (let i = 1; i < n; i++) {
        html += `<tr><th>${hcLabel(s.before[i], HC.pts)}</th>`;
        for (let j = 0; j < n - 1; j++) {
          if (j >= i) { html += '<td class="empty"></td>'; continue; }
          const e = s.table.filter(x => x.i === j && x.j === i)[0];
          const isMin = e && Math.abs(e.d - s.threshold) < 1e-9;
          html += `<td class="${isMin ? 'min' : ''}">${e ? clFmt(e.d, 2) : ''}</td>`;
        }
        html += '</tr>';
      }
      html += `</table><div style="font-size:12px; color:var(--ink-muted); margin-top:6px;">Merging ${s.mergedGroups.map(gr => gr.map(i => hcLabel(s.before[i], HC.pts)).join(' + ')).join(' and ')} at <strong>${clFmt(s.threshold, 2)}</strong> — shown dashed on the plot.</div></div>`;
    } else {
      html += '<div class="kmstep conv"><h5>Done — everything is in one cluster</h5><div style="font-size:12.5px; color:var(--ink-muted);">Drag the cut line back up the dendogram, or press ⏮, to walk through the merges again.</div></div>';
    }
    // full history
    html += '<table><tr><th>t</th><th>Threshold</th><th>Merged</th><th>Clusters after</th><th>K</th></tr>';
    html += `<tr${HC.frame === 0 ? ' style="background:var(--tint-a);"' : ''}><td>0</td><td>—</td><td>—</td>
      <td style="font-family:'IBM Plex Mono',monospace; font-size:11.5px;">${HC.pts.map(p => '{' + esc(p.name.replace(/^p/, '')) + '}').join(' ')}</td><td>${HC.pts.length}</td></tr>`;
    R.steps.forEach(s => {
      const mg = s.mergedGroups.map(gr => gr.map(i => hcLabel(s.before[i], HC.pts)).join(' + ')).join(' &nbsp;and&nbsp; ');
      html += `<tr${HC.frame === s.t ? ' style="background:var(--tint-a);"' : ''}><td>${s.t}</td><td><strong>${clFmt(s.threshold, 2)}</strong></td>
        <td style="font-family:'IBM Plex Mono',monospace; font-size:11.5px;">${mg}</td>
        <td style="font-family:'IBM Plex Mono',monospace; font-size:11.5px;">${s.after.map(c => hcLabel(c, HC.pts)).join(' ')}</td><td>${s.after.length}</td></tr>`;
    });
    html += '</table>';
    if (R.steps.length > 1) {
      let bg = 0, bgi = 0;
      for (let i = 1; i < R.steps.length; i++) { const gap = R.steps[i].threshold - R.steps[i - 1].threshold; if (gap > bg) { bg = gap; bgi = i; } }
      const kAt = R.steps[bgi - 1].after.length;
      html += `<div class="verdict warn">The biggest jump in threshold is from <strong>${clFmt(R.steps[bgi - 1].threshold, 2)}</strong> to
        <strong>${clFmt(R.steps[bgi].threshold, 2)}</strong> — a gap of ${clFmt(bg, 2)}. That long vertical part of the dendogram suggests
        <strong>K = ${kAt}</strong> as a natural place to cut. <button class="ix-btn" onclick="hcStep(${bgi}, true)">jump the cut there</button></div>`;
    }
    const other = crit === 'single' ? 'complete' : 'single';
    const R2 = hcRun(HC.pts, hcMetric(), other, 200);
    const snap = res => {
      const m = {}; m[HC.pts.length] = HC.pts.map((p, i) => '{' + i + '}').join(' ');
      res.steps.forEach(s => { m[s.after.length] = s.after.map(c => '{' + c.label.join(',') + '}').sort().join(' '); });
      return m;
    };
    const A = snap(R), B = snap(R2);
    let diffK = null;
    Object.keys(A).map(Number).sort((a, b) => b - a).forEach(k => { if (diffK === null && B[k] !== undefined && A[k] !== B[k]) diffK = k; });
    html += `<div class="verdict ${diffK ? 'bad' : 'warn'}" style="margin-top:12px;">
      Compared against <strong>${other}-linkage</strong> on the same points and metric:
      ${diffK ? `the highest K at which the two assignments differ is <strong>K = ${diffK}</strong>.<br>
        <span style="font-family:'IBM Plex Mono',monospace; font-size:12px;">${crit}: ${esc(A[diffK])} &nbsp;·&nbsp; ${other}: ${esc(B[diffK])}</span>`
      : 'the two produce the same clustering at every K on this data.'}</div>`;
    out.innerHTML = html;
    const svg = document.getElementById('hc-svg');
    if (svg) IX.drag(svg, { W: HC_W, H: HC_H, onMove: hcMove, onRemove: hcDel, onBlank: hcAdd, onDrop: hcSync });
    const den = document.getElementById('hc-dendro');
    if (den) {
      const vb = den.getAttribute('viewBox').split(' ');
      IX.drag(den, { W: Number(vb[2]), H: Number(vb[3]), onMove: hcMove });
    }
  }
  function runHC() {
    const out = document.getElementById('hc-output');
    if (!out) return;
    IX.stop('hc');
    const P = clParsePoints(document.getElementById('hc-pts').value);
    let head = '';
    if (P.errs.length) head = `<div class="verdict bad">${P.errs.map(esc).join('<br>')}</div>`;
    if (P.pts.length < 2) { out.innerHTML = head + '<div class="tool-error">Give at least two points.</div>'; return; }
    if (P.pts.length > 14) { out.innerHTML = head + '<div class="tool-error">Fourteen points at most — beyond that the distance tables are unreadable.</div>'; return; }
    if (P.dims !== 2) { out.innerHTML = head + '<div class="tool-error">The interactive canvas needs 2-D points — give exactly two coordinates each.</div>'; return; }
    HC.pts = P.pts.map(p => ({ name: p.name, x: p.x.slice() }));
    HC.frame = 0;
    hcBounds(true);
    hcCompute();
    hcRender();
    if (head) out.innerHTML = head + out.innerHTML;
  }
  TOOL_RUNNERS.runHC = runHC;
