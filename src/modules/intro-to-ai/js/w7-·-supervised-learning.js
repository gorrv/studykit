  /* ============================================================
     W7 · SUPERVISED LEARNING
       Part 1 — linear regression: normal noise, least squares
       Part 2 — decision trees: Gini index, Gini-Split
     ============================================================ */
  function w7Gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
  function w7Rat(num, den) {
    if (!den || !isFinite(num) || !isFinite(den)) return null;
    if (Math.abs(num - Math.round(num)) > 1e-7 || Math.abs(den - Math.round(den)) > 1e-7) return null;
    num = Math.round(num); den = Math.round(den);
    const g = w7Gcd(num, den) || 1;
    num /= g; den /= g;
    if (den < 0) { num = -num; den = -den; }
    return { n: num, d: den };
  }
  function w7RatStr(r) {
    if (!r) return null;
    if (r.d === 1) return String(r.n);
    return (r.n < 0 ? '−' : '') + Math.abs(r.n) + '/' + r.d;
  }
  /* a short, honest number: exact when it is an integer, 4 dp otherwise */
  function w7N(v, dp) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    const r = Math.round(v * 1e7) / 1e7;
    if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
    return String(Math.round(v * Math.pow(10, dp === undefined ? 4 : dp)) / Math.pow(10, dp === undefined ? 4 : dp));
  }
  function w7Minus(s) { return String(s).replace(/^-/, '−'); }
  /* " + 3β₀", " − β₀", "" — for writing polynomials that read like the notes */
  function w7Term(c, sym, first) {
    if (Math.abs(c) < 1e-12) return '';
    const neg = c < 0, a = Math.abs(c);
    const co = (Math.abs(a - 1) < 1e-12 && sym) ? '' : w7N(a);
    const head = first ? (neg ? '−' : '') : (neg ? ' − ' : ' + ');
    return head + co + (sym || '');
  }
  function w7Poly(terms) {
    let out = '', first = true;
    terms.forEach(t => { const s = w7Term(t[0], t[1], first); if (s) { out += s; first = false; } });
    return out || '0';
  }

  /* ------------------------------------------------------------
     TOOL · the normal curve behind ε  (runNorm)
     ------------------------------------------------------------ */
  const NM = { mu: 2.5, sd: 0.3, lo: -1, hi: 1, slope: 0.5, showSamp: false };
  const NM_W = 460, NM_H = 250, NM_L = 46, NM_R = 16, NM_T = 14, NM_B = 42;
  function nmPdf(x, mu, sd) { const z = (x - mu) / sd; return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI)); }
  /* Abramowitz–Stegun 7.1.26 error function, plenty accurate for a picture */
  function nmErf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function nmCdf(x, mu, sd) { return 0.5 * (1 + nmErf((x - mu) / (sd * Math.SQRT2))); }
  function nmSet(k, v) { NM[k] = Number(v); nmRender(); }
  function nmTog(k) { NM[k] = !NM[k]; nmRender(); }
  function nmRender() {
    const out = document.getElementById('nm-output');
    if (!out) return;
    const mu = NM.mu, sd = Math.max(0.05, NM.sd);
    const xlo = mu - 4 * sd, xhi = mu + 4 * sd, ymax = nmPdf(mu, mu, sd) * 1.12;
    const cx = v => NM_L + (v - xlo) / (xhi - xlo) * (NM_W - NM_L - NM_R);
    const cy = v => NM_H - NM_B - (v / ymax) * (NM_H - NM_B - NM_T);
    const band = (a, b, fill, op) => {
      let d = `M ${cx(a).toFixed(1)} ${cy(0).toFixed(1)}`;
      for (let i = 0; i <= 60; i++) { const x = a + (b - a) * i / 60; d += ` L ${cx(x).toFixed(1)} ${cy(nmPdf(x, mu, sd)).toFixed(1)}`; }
      d += ` L ${cx(b).toFixed(1)} ${cy(0).toFixed(1)} Z`;
      return `<path d="${d}" fill="${fill}" opacity="${op}"/>`;
    };
    let g = '';
    g += band(mu - 3 * sd, mu + 3 * sd, 'var(--accent)', 0.10);
    g += band(mu - 2 * sd, mu + 2 * sd, 'var(--accent)', 0.14);
    g += band(mu - sd, mu + sd, 'var(--accent)', 0.26);
    let d = '';
    for (let i = 0; i <= 200; i++) { const x = xlo + (xhi - xlo) * i / 200; d += (i ? ' L ' : 'M ') + cx(x).toFixed(1) + ' ' + cy(nmPdf(x, mu, sd)).toFixed(1); }
    g += `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`;
    g += `<line x1="${NM_L}" y1="${cy(0)}" x2="${NM_W - NM_R}" y2="${cy(0)}" stroke="var(--ink-muted)"/>`;
    g += `<line x1="${cx(mu).toFixed(1)}" y1="${cy(0)}" x2="${cx(mu).toFixed(1)}" y2="${cy(nmPdf(mu, mu, sd)).toFixed(1)}" stroke="var(--accent-2)" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    g += `<text x="${cx(mu).toFixed(1)}" y="${NM_T + 2}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10.5" fill="var(--accent-2)">µ = ${w7N(mu)}</text>`;
    [-3, -2, -1, 1, 2, 3].forEach(k => {
      const x = mu + k * sd;
      g += `<line x1="${cx(x).toFixed(1)}" y1="${cy(0)}" x2="${cx(x).toFixed(1)}" y2="${(cy(0) + 5).toFixed(1)}" stroke="var(--ink-muted)"/>`;
      g += `<text x="${cx(x).toFixed(1)}" y="${(cy(0) + 17).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-muted)">${k > 0 ? k + 'σ' : k === -1 ? '−σ' : k + 'σ'}</text>`;
      g += `<text x="${cx(x).toFixed(1)}" y="${(cy(0) + 30).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="var(--ink-muted)">${w7N(x, 2)}</text>`;
    });
    let html = `<div class="ix-canvas"><svg width="100%" viewBox="0 0 ${NM_W} ${NM_H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + `<title>Normal density</title><desc>The density of N(${w7N(mu)}, ${w7N(sd * sd, 4)}), with the one-, two- and three-sigma bands shaded.</desc>` + g + '</svg></div>';
    html += `<div class="ix-bar"><span class="ix-lab">µ <strong>${w7N(mu)}</strong></span>
      <input type="range" min="-3" max="6" step="0.1" value="${mu}" oninput="nmSet('mu', this.value)" aria-label="mean">
      <span class="ix-lab">σ <strong>${w7N(sd, 3)}</strong></span>
      <input type="range" min="0.05" max="1.5" step="0.05" value="${sd}" oninput="nmSet('sd', this.value)" aria-label="standard deviation"></div>`;
    html += `<div class="ix-bar"><span class="ix-lab">area between</span>
      <input type="range" min="-4" max="4" step="0.05" value="${NM.lo}" oninput="nmSet('lo', this.value)" aria-label="lower bound in sigmas">
      <input type="range" min="-4" max="4" step="0.05" value="${NM.hi}" oninput="nmSet('hi', this.value)" aria-label="upper bound in sigmas">
      <span class="ix-lab">µ ${NM.lo < 0 ? '−' : '+'} ${w7N(Math.abs(NM.lo), 2)}σ … µ ${NM.hi < 0 ? '−' : '+'} ${w7N(Math.abs(NM.hi), 2)}σ</span></div>`;
    const a = mu + Math.min(NM.lo, NM.hi) * sd, b = mu + Math.max(NM.lo, NM.hi) * sd;
    const area = nmCdf(b, mu, sd) - nmCdf(a, mu, sd);
    html += `<div class="metrics">
      <div class="metric"><div class="mn">notation</div><div class="mv" style="font-size:16px;">N(${w7N(mu)}, ${w7N(sd * sd, 4)})</div><div class="mf">N(µ, σ²) — the <em>variance</em>, not σ</div></div>
      <div class="metric"><div class="mn">σ</div><div class="mv">${w7N(sd, 3)}</div><div class="mf">σ² = ${w7N(sd * sd, 4)}</div></div>
      <div class="metric"><div class="mn">P(${w7N(a, 3)} ≤ y ≤ ${w7N(b, 3)})</div><div class="mv">${w7N(area * 100, 1)}%</div><div class="mf">area under the curve</div></div>
      <div class="metric dim"><div class="mn">P(y = ${w7N(mu)})</div><div class="mv">0</div><div class="mf">continuous — points have no mass</div></div>
    </div>`;
    html += `<p class="ix-hint"><strong>Drag σ and watch the ±1σ number stay at 68%.</strong> That is the point of quoting σ at all:
      it is the same 68 / 95 / 99.7 whatever the scale. Set µ = 2.5 and σ = 0.3 to get exactly Figure 7.2, the distribution of <em>y</em> when <em>x</em> = 5 for the line <em>y</em> = ½<em>x</em> + ε.</p>`;
    const tab = [[1, 68.27], [2, 95.45], [3, 99.73]];
    html += '<table><tr><th>interval</th><th>in this picture</th><th>exact</th></tr>';
    tab.forEach(t => {
      const lo = mu - t[0] * sd, hi = mu + t[0] * sd;
      html += `<tr><td>µ ± ${t[0]}σ</td><td><code>${w7N(lo, 3)} … ${w7N(hi, 3)}</code></td><td><code>${t[1]}%</code></td></tr>`;
    });
    html += '</table>';
    out.innerHTML = html;
  }
  function runNorm() { nmRender(); }
  TOOL_RUNNERS.runNorm = runNorm;

  /* ------------------------------------------------------------
     TOOL · least squares by hand  (runLSQ)
     ------------------------------------------------------------ */
  const LS = { pts: [], frame: 0, mine: false, mb0: 0, mb1: 0, snap: true, at: 5,
               xlo: -2, xhi: 6, ylo: -2, yhi: 4 };
  const LS_W = 460, LS_H = 330, LS_L = 46, LS_R = 16, LS_T = 16, LS_B = 40;
  function lsCx(v) { return LS_L + (v - LS.xlo) / (LS.xhi - LS.xlo) * (LS_W - LS_L - LS_R); }
  function lsCy(v) { return LS_H - LS_B - (v - LS.ylo) / (LS.yhi - LS.ylo) * (LS_H - LS_B - LS_T); }
  function lsUx(px) { return LS.xlo + (px - LS_L) / (LS_W - LS_L - LS_R) * (LS.xhi - LS.xlo); }
  function lsUy(py) { return LS.ylo + (LS_H - LS_B - py) / (LS_H - LS_B - LS_T) * (LS.yhi - LS.ylo); }
  function lsFit(pts) {
    const n = pts.length;
    let Sx = 0, Sy = 0, Sxx = 0, Sxy = 0, Syy = 0;
    pts.forEach(p => { Sx += p.x; Sy += p.y; Sxx += p.x * p.x; Sxy += p.x * p.y; Syy += p.y * p.y; });
    const den = n * Sxx - Sx * Sx;
    const num1 = n * Sxy - Sx * Sy, num0 = Sxx * Sy - Sx * Sxy;
    return { n: n, Sx: Sx, Sy: Sy, Sxx: Sxx, Sxy: Sxy, Syy: Syy, den: den,
             num0: num0, num1: num1, b0: num0 / den, b1: num1 / den };
  }
  function lsSSE(pts, b0, b1) { let s = 0; pts.forEach(p => { const e = p.y - b0 - b1 * p.x; s += e * e; }); return s; }
  function lsInt() { return LS.pts.every(p => Math.abs(p.x - Math.round(p.x)) < 1e-9 && Math.abs(p.y - Math.round(p.y)) < 1e-9); }
  function lsExact(num, den) { return lsInt() ? w7RatStr(w7Rat(num, den)) : null; }
  function lsRange() {
    let xlo = Infinity, xhi = -Infinity, ylo = Infinity, yhi = -Infinity;
    LS.pts.forEach(p => { xlo = Math.min(xlo, p.x); xhi = Math.max(xhi, p.x); ylo = Math.min(ylo, p.y); yhi = Math.max(yhi, p.y); });
    if (!isFinite(xlo)) { xlo = 0; xhi = 1; ylo = 0; yhi = 1; }
    xhi = Math.max(xhi, LS.at); xlo = Math.min(xlo, LS.at);
    const px = Math.max(1, (xhi - xlo) * 0.18), py = Math.max(1, (yhi - ylo) * 0.22);
    LS.xlo = xlo - px; LS.xhi = xhi + px; LS.ylo = ylo - py; LS.yhi = yhi + py;
  }
  function lsSync() {
    const t = document.getElementById('ls-pts');
    if (t) t.value = LS.pts.map(p => w7N(p.x) + ' ' + w7N(p.y)).join('\n');
  }
  function lsMove(px, py, key) {
    const i = parseInt(key, 10);
    if (!LS.pts[i]) return;
    let x = lsUx(px), y = lsUy(py);
    if (LS.snap) { x = Math.round(x); y = Math.round(y); } else { x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10; }
    /* grow the frame rather than clamp, so an outlier can actually be dragged out */
    const sx = LS.xhi - LS.xlo, sy = LS.yhi - LS.ylo;
    if (x > LS.xhi - sx * 0.04) LS.xhi = x + sx * 0.12;
    if (x < LS.xlo + sx * 0.04) LS.xlo = x - sx * 0.12;
    if (y > LS.yhi - sy * 0.04) LS.yhi = y + sy * 0.12;
    if (y < LS.ylo + sy * 0.04) LS.ylo = y - sy * 0.12;
    LS.pts[i].x = x; LS.pts[i].y = y;
    lsRender();
  }
  function lsAdd(px, py) {
    if (LS.pts.length >= 40) return false;
    let x = lsUx(px), y = lsUy(py);
    if (px < LS_L - 6 || px > LS_W - LS_R + 6 || py < LS_T - 6 || py > LS_H - LS_B + 6) return false;
    if (LS.snap) { x = Math.round(x); y = Math.round(y); } else { x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10; }
    LS.pts.push({ x: x, y: y });
    lsSync(); lsRender();
    return true;
  }
  function lsDel(key) {
    const i = parseInt(key, 10);
    if (LS.pts.length <= 2 || !LS.pts[i]) return;
    LS.pts.splice(i, 1);
    lsSync(); lsRender();
  }
  function lsTog(k) { LS[k] = !LS[k]; if (k === 'mine' && LS.mine) { const f = lsFit(LS.pts); LS.mb0 = Math.round(f.b0 * 10) / 10; LS.mb1 = Math.round(f.b1 * 10) / 10; } lsRender(); }
  function lsSet(k, v) { LS[k] = Number(v); if (k === 'at') lsRange(); lsRender(); }
  function lsPreset(which) {
    if (which === 'notes') LS.pts = [{ x: -1, y: 2 }, { x: 0, y: 0 }, { x: 2, y: 0 }];
    else if (which === 'ex2') LS.pts = [{ x: -1, y: 2 }, { x: 0, y: 0 }, { x: 2, y: 1 }];
    else if (which === 'ex3') LS.pts = [{ x: -1, y: 2 }, { x: 0, y: 0 }, { x: 2, y: 1 }, { x: 3, y: -7 }];
    else if (which === 'half') LS.pts = [{ x: 1, y: 0.6 }, { x: 2, y: 0.9 }, { x: 3, y: 1.7 }, { x: 4, y: 1.8 }, { x: 5, y: 2.7 }, { x: 6, y: 2.9 }, { x: 7, y: 3.6 }, { x: 8, y: 3.8 }];
    LS.frame = 0; LS.mine = false;
    lsSync(); lsRange(); lsRender();
  }
  function lsStep(d, fromSlider) {
    const total = 6;
    if (d === 'play') { IX.play('ls', total, () => LS.frame, f => { LS.frame = f; lsRender(); }, 1500); lsRender(); return; }
    IX.stop('ls');
    if (d === 'first') LS.frame = 0;
    else if (d === 'last') LS.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) LS.frame = d;
    else LS.frame = Math.max(0, Math.min(total - 1, LS.frame + d));
    lsRender();
  }
  function lsRow(i, F, title, body, note) {
    const cls = i > F ? ' ix-future' : (i === F ? ' ix-now' : '');
    return `<div class="deriv-box${cls}" data-step="${i}" style="margin:10px 0;">
      <div class="db-title">step ${i + 1} · ${title}</div>${body}${note ? `<p style="margin:10px 0 0 0; font-size:12px; color:var(--ink-muted); font-style:italic;">${note}</p>` : ''}</div>`;
  }
  function lsRender() {
    const out = document.getElementById('ls-output');
    if (!out) return;
    const pts = LS.pts, f = lsFit(pts), F = LS.frame;
    const ok = isFinite(f.b0) && isFinite(f.b1);
    const exact = lsInt();
    /* ---- canvas ---- */
    let g = '';
    const gx0 = Math.ceil(LS.xlo), gx1 = Math.floor(LS.xhi), gy0 = Math.ceil(LS.ylo), gy1 = Math.floor(LS.yhi);
    const stepX = Math.max(1, Math.ceil((gx1 - gx0) / 10)), stepY = Math.max(1, Math.ceil((gy1 - gy0) / 8));
    for (let v = gx0; v <= gx1; v += stepX) g += `<line x1="${lsCx(v).toFixed(1)}" y1="${LS_T}" x2="${lsCx(v).toFixed(1)}" y2="${LS_H - LS_B}" stroke="var(--rule)" stroke-width="0.7"/>`;
    for (let v = gy0; v <= gy1; v += stepY) g += `<line x1="${LS_L}" y1="${lsCy(v).toFixed(1)}" x2="${LS_W - LS_R}" y2="${lsCy(v).toFixed(1)}" stroke="var(--rule)" stroke-width="0.7"/>`;
    if (LS.ylo < 0 && LS.yhi > 0) g += `<line x1="${LS_L}" y1="${lsCy(0).toFixed(1)}" x2="${LS_W - LS_R}" y2="${lsCy(0).toFixed(1)}" stroke="var(--ink-muted)" stroke-width="1.2"/>`;
    if (LS.xlo < 0 && LS.xhi > 0) g += `<line x1="${lsCx(0).toFixed(1)}" y1="${LS_T}" x2="${lsCx(0).toFixed(1)}" y2="${LS_H - LS_B}" stroke="var(--ink-muted)" stroke-width="1.2"/>`;
    for (let v = gx0; v <= gx1; v += stepX) g += `<text x="${lsCx(v).toFixed(1)}" y="${LS_H - LS_B + 15}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-muted)">${v}</text>`;
    for (let v = gy0; v <= gy1; v += stepY) g += `<text x="${LS_L - 7}" y="${(lsCy(v) + 3.5).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-muted)">${v}</text>`;
    const drawLine = (b0, b1, col, w, dash) => {
      const y0 = b0 + b1 * LS.xlo, y1 = b0 + b1 * LS.xhi;
      return `<line x1="${lsCx(LS.xlo).toFixed(1)}" y1="${lsCy(y0).toFixed(1)}" x2="${lsCx(LS.xhi).toFixed(1)}" y2="${lsCy(y1).toFixed(1)}" stroke="${col}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} clip-path="url(#lsclip)"/>`;
    };
    if (LS.mine) {
      pts.forEach(p => { const yh = LS.mb0 + LS.mb1 * p.x; g += `<line x1="${lsCx(p.x).toFixed(1)}" y1="${lsCy(p.y).toFixed(1)}" x2="${lsCx(p.x).toFixed(1)}" y2="${lsCy(yh).toFixed(1)}" stroke="var(--accent-2)" stroke-width="1.4" stroke-dasharray="3 2" opacity="0.75"/>`; });
      g += drawLine(LS.mb0, LS.mb1, 'var(--accent-2)', 2, '6 4');
    }
    if (ok) {
      pts.forEach(p => { const yh = f.b0 + f.b1 * p.x; g += `<line x1="${lsCx(p.x).toFixed(1)}" y1="${lsCy(p.y).toFixed(1)}" x2="${lsCx(p.x).toFixed(1)}" y2="${lsCy(yh).toFixed(1)}" stroke="var(--accent-3)" stroke-width="2" opacity="0.85"/>`; });
      g += drawLine(f.b0, f.b1, 'var(--accent-3)', 2.4);
      if (F >= 5) {
        const yh = f.b0 + f.b1 * LS.at;
        g += `<line x1="${lsCx(LS.at).toFixed(1)}" y1="${lsCy(LS.ylo).toFixed(1)}" x2="${lsCx(LS.at).toFixed(1)}" y2="${lsCy(yh).toFixed(1)}" stroke="var(--accent-4)" stroke-width="1.4" stroke-dasharray="4 3"/>`;
        g += `<circle cx="${lsCx(LS.at).toFixed(1)}" cy="${lsCy(yh).toFixed(1)}" r="6" fill="none" stroke="var(--accent-4)" stroke-width="2.2"/>`;
        g += `<text x="${lsCx(LS.at).toFixed(1)}" y="${(lsCy(yh) - 11).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="var(--accent-4)">ŷ = ${w7N(yh, 3)}</text>`;
      }
    }
    pts.forEach((p, i) => {
      g += `<circle class="grab" data-ix="${i}" cx="${lsCx(p.x).toFixed(1)}" cy="${lsCy(p.y).toFixed(1)}" r="7" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.6"/>`;
    });
    g += `<text x="${LS_W - LS_R}" y="${LS_H - 8}" text-anchor="end" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)">x →</text>`;
    g += `<text x="14" y="${LS_H / 2}" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)" transform="rotate(-90 14 ${LS_H / 2})">y →</text>`;
    let html = `<div class="ix-canvas"><svg id="ls-svg" width="100%" viewBox="0 0 ${LS_W} ${LS_H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + `<title>Least-squares fit</title><desc>Data points with vertical residuals to the best-fit line.</desc>`
      + `<defs><clipPath id="lsclip"><rect x="${LS_L}" y="${LS_T}" width="${LS_W - LS_L - LS_R}" height="${LS_H - LS_T - LS_B}"/></clipPath></defs>`
      + g + '</svg></div>';
    html += `<div class="ix-bar"><span class="ix-lab">drag a dot · click empty space to add · shift-click to delete</span>
      ${IX.toggles([{ label: 'snap to integers', on: LS.snap, fn: "lsTog('snap')" }, { label: 'compare my own line', on: LS.mine, fn: "lsTog('mine')" }])}
      <button class="ix-btn" onclick="lsPreset('notes')">Table 7.1</button>
      <button class="ix-btn" onclick="lsPreset('ex2')">Exercise 2</button>
      <button class="ix-btn" onclick="lsPreset('ex3')">Table 7.2</button>
      <button class="ix-btn" onclick="lsPreset('half')">y = ½x + ε</button></div>`;
    if (LS.mine) {
      const mySSE = lsSSE(pts, LS.mb0, LS.mb1), bestSSE = ok ? lsSSE(pts, f.b0, f.b1) : NaN;
      html += `<div class="ix-bar"><span class="ix-lab">β₀ <strong>${w7N(LS.mb0, 2)}</strong></span>
        <input type="range" min="${w7N(LS.ylo - 2, 2)}" max="${w7N(LS.yhi + 2, 2)}" step="0.05" value="${LS.mb0}" oninput="lsSet('mb0', this.value)" aria-label="my intercept">
        <span class="ix-lab">β₁ <strong>${w7N(LS.mb1, 2)}</strong></span>
        <input type="range" min="-5" max="5" step="0.05" value="${LS.mb1}" oninput="lsSet('mb1', this.value)" aria-label="my slope">
        <span class="ix-lab">my SSE <strong style="color:var(--accent-2);">${w7N(mySSE, 4)}</strong> vs best <strong style="color:var(--accent-3);">${w7N(bestSSE, 4)}</strong></span></div>`;
    }
    html += IX.player('ls', F, 6, `derivation step <strong>${F + 1}</strong> / 6`,
      F === 5 ? ['done', 'answer'] : (F >= 3 ? ['update', 'solve'] : ['assign', 'set up']));
    if (!ok) {
      out.innerHTML = html + `<div class="tool-error">All ${f.n} points share the same x, so no line of the form ŷ = β₀ + β₁x can be fitted — the denominator n·Σx² − (Σx)² is zero. Drag a point sideways.</div>`;
      const s0 = document.getElementById('ls-svg');
      if (s0) IX.drag(s0, { W: LS_W, H: LS_H, onMove: lsMove, onDrop: lsSync, onRemove: lsDel, onBlank: lsAdd });
      return;
    }
    /* ---- the derivation ---- */
    const A = f.n, B = f.Sxx, C = 2 * f.Sx, D = -2 * f.Sy, E = -2 * f.Sxy, G = f.Syy;
    let s0 = '<div style="font-family:\'IBM Plex Mono\',monospace; font-size:12.5px; line-height:2;">';
    pts.forEach((p, i) => {
      s0 += `ε<sub>${i + 1}</sub> = ${w7N(p.y)} − β₀${w7Term(-p.x, 'β₁')} &nbsp;→&nbsp; ε<sub>${i + 1}</sub>² = (${w7N(p.y)} − β₀${w7Term(-p.x, 'β₁')})²<br>`;
    });
    s0 += '</div>';
    html += lsRow(0, F, 'write one residual per point',
      `<p style="margin:0 0 8px 0;">Every point contributes <code>εᵢ = yᵢ − β₀ − β₁xᵢ</code>. Nothing has been minimised yet — this is just bookkeeping.</p>${s0}`,
      'Sign slips live here. For a negative xᵢ the −β₁xᵢ term becomes a <em>plus</em>.');
    html += lsRow(1, F, 'add the squares and collect terms',
      `<p style="margin:0 0 8px 0;">SSE = Σ εᵢ², expanded and gathered by power of β₀ and β₁:</p>
       <div style="text-align:center; font-family:'IBM Plex Mono',monospace; font-size:14px; margin:8px 0;">SSE = ${w7Poly([[A, 'β₀²'], [B, 'β₁²'], [C, 'β₀β₁'], [D, 'β₀'], [E, 'β₁'], [G, '']])}</div>
       <table style="margin-top:10px;"><tr><th>coefficient</th><th>formula</th><th>value here</th></tr>
        <tr><td>β₀²</td><td><code>n</code></td><td><code>${w7N(A)}</code></td></tr>
        <tr><td>β₁²</td><td><code>Σxᵢ²</code></td><td><code>${w7N(B)}</code></td></tr>
        <tr><td>β₀β₁</td><td><code>2Σxᵢ</code></td><td><code>${w7N(C)}</code></td></tr>
        <tr><td>β₀</td><td><code>−2Σyᵢ</code></td><td><code>${w7Minus(w7N(D))}</code></td></tr>
        <tr><td>β₁</td><td><code>−2Σxᵢyᵢ</code></td><td><code>${w7Minus(w7N(E))}</code></td></tr>
        <tr><td>constant</td><td><code>Σyᵢ²</code></td><td><code>${w7N(G)}</code></td></tr></table>`,
      'Those six numbers are the whole dataset as far as the fit is concerned. Two datasets with the same six sums get the same line.');
    html += lsRow(2, F, 'freeze one β and read off a parabola',
      `<p style="margin:0 0 8px 0;">Hold β₁ fixed and SSE is a parabola in β₀; hold β₀ fixed and it is a parabola in β₁. Both in the shape <code>ax² + bx + c</code>:</p>
       <div style="font-family:'IBM Plex Mono',monospace; font-size:13px; line-height:2.1; margin-left:8px;">
        g(β₀) = ${w7N(A)}β₀² + (${w7Poly([[D, ''], [C, 'β₁']])})β₀ + (${w7Poly([[G, ''], [E, 'β₁'], [B, 'β₁²']])})<br>
        h(β₁) = ${w7N(B)}β₁² + (${w7Poly([[E, ''], [C, 'β₀']])})β₁ + (${w7Poly([[G, ''], [D, 'β₀'], [A, 'β₀²']])})
       </div>`,
      'Same expression, twice, sorted differently. You never need partial derivatives for this — the vertex of a parabola is enough.');
    html += lsRow(3, F, 'each parabola is lowest at x = −b/2a',
      `<div style="font-family:'IBM Plex Mono',monospace; font-size:13.5px; line-height:2.3; margin-left:8px;">
        β̂₀ = −(${w7Poly([[D, ''], [C, 'β₁']])}) / ${w7N(2 * A)} = (${w7Poly([[-D, ''], [-C, 'β₁']])}) / ${w7N(2 * A)}<br>
        β̂₁ = −(${w7Poly([[E, ''], [C, 'β₀']])}) / ${w7N(2 * B)} = (${w7Poly([[-E, ''], [-C, 'β₀']])}) / ${w7N(2 * B)}
       </div>`,
      'Two equations, two unknowns — and each is linear, because the β² terms have gone.');
    const detA = 2 * A, detB = 2 * B;
    html += lsRow(4, F, 'solve the two together',
      `<p style="margin:0 0 8px 0;">Substituting one into the other clears the β₁ (or β₀) and leaves a single linear equation. In closed form that is exactly Theorem 7.3:</p>
       <div style="font-family:'IBM Plex Mono',monospace; font-size:13px; line-height:2.1; margin-left:8px;">
        β̂₁ = (n·Σxᵢyᵢ − Σxᵢ·Σyᵢ) / (n·Σxᵢ² − (Σxᵢ)²) = (${w7N(A)}·${w7N(f.Sxy)} − ${w7N(f.Sx)}·${w7N(f.Sy)}) / (${w7N(A)}·${w7N(f.Sxx)} − ${w7N(f.Sx)}²) = ${w7Minus(w7N(f.num1))} / ${w7N(f.den)}${exact ? ' = <strong>' + w7RatStr(w7Rat(f.num1, f.den)) + '</strong>' : ''}<br>
        β̂₀ = (Σxᵢ²·Σyᵢ − Σxᵢ·Σxᵢyᵢ) / (n·Σxᵢ² − (Σxᵢ)²) = (${w7N(f.Sxx)}·${w7N(f.Sy)} − ${w7N(f.Sx)}·${w7N(f.Sxy)}) / ${w7N(f.den)} = ${w7Minus(w7N(f.num0))} / ${w7N(f.den)}${exact ? ' = <strong>' + w7RatStr(w7Rat(f.num0, f.den)) + '</strong>' : ''}
       </div>`,
      'Both routes — parabola vertices or the theorem — must give the same pair. If they do not, one of your six sums is wrong.');
    const yh = f.b0 + f.b1 * LS.at, sse = lsSSE(pts, f.b0, f.b1);
    html += lsRow(5, F, 'write the line and use it',
      `<div style="text-align:center; font-family:'IBM Plex Mono',monospace; font-size:17px; margin:10px 0; color:var(--accent-3);">
        ŷ = ${w7Poly([[f.b1 === 0 ? 0 : f.b1, 'x'], [f.b0, '']])}${exact ? `<div style="font-size:12.5px; color:var(--ink-muted); margin-top:6px;">exactly: ŷ = ${w7RatStr(w7Rat(f.num1, f.den))}x + ${w7RatStr(w7Rat(f.num0, f.den))}</div>` : ''}</div>
       <div class="ix-bar" style="margin-top:6px;"><span class="ix-lab">predict at x =</span>
        <input type="range" min="${w7N(Math.floor(LS.xlo) - 2)}" max="${w7N(Math.ceil(LS.xhi) + 4)}" step="0.5" value="${LS.at}" oninput="lsSet('at', this.value)" aria-label="prediction point">
        <span class="ix-lab"><strong>${w7N(LS.at)}</strong> → ŷ = <strong style="color:var(--accent-4);">${w7N(yh, 4)}</strong></span></div>`,
      'Prediction is one substitution. That is the whole payoff of the algebra above.');
    html += `<div class="metrics">
      <div class="metric"><div class="mn">β̂₀ (intercept)</div><div class="mv">${w7N(f.b0, 4)}</div><div class="mf">${exact ? w7RatStr(w7Rat(f.num0, f.den)) : w7N(f.num0, 4) + ' / ' + w7N(f.den, 4)}</div></div>
      <div class="metric"><div class="mn">β̂₁ (slope)</div><div class="mv">${w7N(f.b1, 4)}</div><div class="mf">${exact ? w7RatStr(w7Rat(f.num1, f.den)) : w7N(f.num1, 4) + ' / ' + w7N(f.den, 4)}</div></div>
      <div class="metric"><div class="mn">SSE at the optimum</div><div class="mv">${w7N(sse, 4)}</div><div class="mf">MSE = ${w7N(sse / f.n, 4)}</div></div>
      <div class="metric dim"><div class="mn">n</div><div class="mv">${f.n}</div><div class="mf">Σx=${w7N(f.Sx)} Σy=${w7N(f.Sy)} Σx²=${w7N(f.Sxx)} Σxy=${w7N(f.Sxy)}</div></div>
    </div>`;
    html += '<table><tr><th>i</th><th>xᵢ</th><th>yᵢ</th><th>ŷᵢ</th><th>residual εᵢ</th><th>εᵢ²</th></tr>';
    let sr = 0;
    pts.forEach((p, i) => {
      const yy = f.b0 + f.b1 * p.x, e = p.y - yy; sr += e;
      html += `<tr><td>${i + 1}</td><td><code>${w7N(p.x)}</code></td><td><code>${w7N(p.y)}</code></td><td><code>${w7N(yy, 4)}</code></td><td><code>${w7Minus(w7N(e, 4))}</code></td><td><code>${w7N(e * e, 4)}</code></td></tr>`;
    });
    html += `<tr style="font-weight:600;"><td colspan="4" style="text-align:right;">sum</td><td><code>${w7N(Math.abs(sr) < 1e-9 ? 0 : sr, 4)}</code></td><td><code>${w7N(sse, 4)}</code></td></tr></table>`;
    html += `<div class="verdict safe" style="margin-top:12px;">The residuals sum to <strong>${w7N(Math.abs(sr) < 1e-9 ? 0 : sr, 4)}</strong>. At the least-squares optimum they always sum to zero — that <em>is</em> the first of the two normal equations, <code>nβ̂₀ + β̂₁Σxᵢ = Σyᵢ</code>. It is the cheapest possible check on an exam answer.</div>`;
    out.innerHTML = html;
    const svg = document.getElementById('ls-svg');
    if (svg) IX.drag(svg, { W: LS_W, H: LS_H, onMove: lsMove, onDrop: lsSync, onRemove: lsDel, onBlank: lsAdd });
  }
  function lsParse(text) {
    const pts = [], errs = [];
    String(text).split(/\n+/).forEach((raw, i) => {
      const t = raw.trim();
      if (!t || t.charAt(0) === '#') return;
      const bits = t.split(/[\s,;]+/).filter(s => s.length);
      if (bits.length < 2) { errs.push(`line ${i + 1}: “${esc(t)}” needs two numbers`); return; }
      const x = Number(bits[0]), y = Number(bits[1]);
      if (!isFinite(x) || !isFinite(y)) { errs.push(`line ${i + 1}: “${esc(t)}” is not a pair of numbers`); return; }
      pts.push({ x: x, y: y });
    });
    return { pts: pts, errs: errs };
  }
  function runLSQ() {
    const out = document.getElementById('ls-output');
    if (!out) return;
    const el = document.getElementById('ls-pts');
    const r = lsParse(el ? el.value : '');
    if (r.errs.length) { out.innerHTML = `<div class="tool-error">${r.errs.slice(0, 5).join('<br>')}</div>`; return; }
    if (r.pts.length < 2) { out.innerHTML = '<div class="tool-error">Give at least two points — one point does not determine a line.</div>'; return; }
    if (r.pts.length > 40) { out.innerHTML = '<div class="tool-error">Forty points at most.</div>'; return; }
    LS.pts = r.pts;
    lsRange();
    lsRender();
  }
  TOOL_RUNNERS.runLSQ = runLSQ;

  /* ------------------------------------------------------------
     TOOL · the Gini index  (runGini)
     ------------------------------------------------------------ */
  const GI = { v: [6, 5, 4], names: [] };
  function giOf(v) {
    const n = v.reduce((a, b) => a + b, 0);
    if (!n) return 0;
    return v.reduce((a, c) => a + (c / n) * (1 - c / n), 0);
  }
  function giBar(val, max, col) {
    const w = max > 0 ? Math.max(2, (val / max) * 160) : 2;
    return `<span class="bar" style="display:inline-block; height:9px; border-radius:3px; background:${col || 'var(--accent)'}; width:${w.toFixed(1)}px; vertical-align:middle;"></span>`;
  }
  function giSet(i, d) {
    GI.v[i] = Math.max(0, (GI.v[i] || 0) + d);
    const el = document.getElementById('gi-v');
    if (el) el.value = GI.v.join(' ');
    giRender();
  }
  function giRender() {
    const out = document.getElementById('gi-output');
    if (!out) return;
    const v = GI.v, k = v.length, n = v.reduce((a, b) => a + b, 0);
    if (!k) { out.innerHTML = '<div class="tool-error">Give at least one count.</div>'; return; }
    if (!n) { out.innerHTML = '<div class="tool-error">All counts are zero — there is nothing in this node.</div>'; return; }
    const g = giOf(v), max = 1 - 1 / k;
    const names = v.map((_, i) => GI.names[i] || ('class ' + String.fromCharCode(65 + i)));
    let html = '<table><tr><th>class</th><th>vᵢ</th><th>pᵢ = vᵢ/n</th><th>1 − pᵢ</th><th>pᵢ(1 − pᵢ)</th><th></th></tr>';
    v.forEach((c, i) => {
      const p = c / n, t = p * (1 - p);
      html += `<tr><td>${esc(names[i])}</td>
        <td><code>${c}</code> <button class="ix-btn" style="padding:0 6px; font-size:11px;" onclick="giSet(${i},-1)">−</button><button class="ix-btn" style="padding:0 6px; font-size:11px;" onclick="giSet(${i},1)">+</button></td>
        <td><code>${c}/${n} = ${w7N(p, 4)}</code></td><td><code>${w7N(1 - p, 4)}</code></td><td><code>${w7N(t, 4)}</code></td><td>${giBar(t, 0.25)}</td></tr>`;
    });
    html += `<tr style="font-weight:600;"><td colspan="4" style="text-align:right;">Gini(v) = Σ pᵢ(1 − pᵢ)</td><td><code>${w7N(g, 4)}</code></td><td>${giBar(g, Math.max(0.001, max), 'var(--accent-3)')}</td></tr></table>`;
    const maj = v.indexOf(Math.max.apply(null, v));
    html += `<div class="metrics">
      <div class="metric"><div class="mn">Gini index</div><div class="mv">${w7N(g, 4)}</div><div class="mf">n = ${n}, k = ${k}</div></div>
      <div class="metric"><div class="mn">maximum for k = ${k}</div><div class="mv">${w7N(max, 4)}</div><div class="mf">1 − 1/k, all classes equal</div></div>
      <div class="metric"><div class="mn">how impure</div><div class="mv">${w7N(max > 0 ? (g / max) * 100 : 0, 1)}%</div><div class="mf">of the worst possible for k = ${k}</div></div>
      <div class="metric dim"><div class="mn">node label</div><div class="mv" style="font-size:16px;">${esc(names[maj])}</div><div class="mf">majority; ties → lowest index</div></div>
    </div>`;
    /* the k = 2 curve, which is the whole intuition */
    const W = 420, H = 170, L = 46, R = 16, T = 12, Bm = 32;
    const cx = p => L + p * (W - L - R), cy = q => H - Bm - (q / 0.55) * (H - Bm - T);
    let s = `<line x1="${L}" y1="${cy(0)}" x2="${W - R}" y2="${cy(0)}" stroke="var(--ink-muted)"/><line x1="${L}" y1="${T}" x2="${L}" y2="${cy(0)}" stroke="var(--ink-muted)"/>`;
    let d = '';
    for (let i = 0; i <= 100; i++) { const p = i / 100; d += (i ? ' L ' : 'M ') + cx(p).toFixed(1) + ' ' + cy(2 * p * (1 - p)).toFixed(1); }
    s += `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`;
    s += `<line x1="${cx(0.5).toFixed(1)}" y1="${cy(0)}" x2="${cx(0.5).toFixed(1)}" y2="${cy(0.5).toFixed(1)}" stroke="var(--accent-2)" stroke-width="1.4" stroke-dasharray="4 3"/>`;
    s += `<text x="${cx(0.5).toFixed(1)}" y="${(cy(0.5) - 6).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10.5" fill="var(--accent-2)">max = 0.5 at p = ½</text>`;
    if (k === 2) {
      const p0 = v[0] / n;
      s += `<circle cx="${cx(p0).toFixed(1)}" cy="${cy(g).toFixed(1)}" r="6" fill="var(--accent-3)" stroke="var(--surface)" stroke-width="1.6"/>`;
      s += `<text x="${cx(p0).toFixed(1)}" y="${(cy(g) - 11).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="var(--accent-3)">you are here</text>`;
    }
    [0, 0.25, 0.5, 0.75, 1].forEach(p => s += `<text x="${cx(p).toFixed(1)}" y="${(cy(0) + 15).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-muted)">${p}</text>`);
    [0, 0.25, 0.5].forEach(q => s += `<text x="${L - 7}" y="${(cy(q) + 3.5).toFixed(1)}" text-anchor="end" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-muted)">${q}</text>`);
    s += `<text x="${W - R}" y="${H - 6}" text-anchor="end" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)">p (share of the first class) →</text>`;
    html += `<div class="ix-canvas" style="margin-top:14px;"><svg width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg"><title>Gini for two classes</title><desc>Gini = 2p(1−p) rises from zero at p = 0 to one half at p = a half and back to zero at p = 1.</desc>${s}</svg></div>`;
    html += `<p class="ix-hint">For <strong>k = 2</strong>, Gini = p(1−p) + (1−p)p = <strong>2p(1−p)</strong>, a downward parabola with vertex at p = ½ and value <strong>½</strong>.
      That is <a href="#y-4" onclick="showWeek('w7-ex')">Exercise 4</a>. In general the maximum is <strong>1 − 1/k</strong>, reached when every class is equally represented — try <code>5 5 5 5</code> above and watch it land on 0.75.</p>`;
    const presets = [['6 5 4', 'root of Fig. 7.5'], ['6 0 0', 'a pure node'], ['0 5 4', 'HasJob = Yes'], ['2 0 4', 'OwnsHome = No'], ['5 5 5 5', 'four equal classes'], ['1 1', 'the k = 2 maximum']];
    html += '<div class="ix-bar"><span class="ix-lab">try</span>' + presets.map(p => `<button class="ix-btn" onclick="giLoad('${p[0]}')">${p[0]} <span style="opacity:.6;">· ${p[1]}</span></button>`).join('') + '</div>';
    out.innerHTML = html;
  }
  function giLoad(s) { const el = document.getElementById('gi-v'); if (el) el.value = s; runGini(); }
  function runGini() {
    const out = document.getElementById('gi-output');
    if (!out) return;
    const el = document.getElementById('gi-v'), nm = document.getElementById('gi-names');
    const raw = (el ? el.value : '').trim();
    const bits = raw.split(/[\s,;]+/).filter(s => s.length);
    const v = [], bad = [];
    bits.forEach(b => { const x = Number(b); if (!isFinite(x) || x < 0) bad.push(b); else v.push(x); });
    if (bad.length) { out.innerHTML = `<div class="tool-error">Not a non-negative count: ${bad.slice(0, 6).map(esc).join(', ')}</div>`; return; }
    if (!v.length) { out.innerHTML = '<div class="tool-error">Give a vector of class counts, e.g. <code>6 5 4</code>.</div>'; return; }
    if (v.length > 10) { out.innerHTML = '<div class="tool-error">Ten classes at most.</div>'; return; }
    GI.v = v;
    GI.names = (nm && nm.value.trim()) ? nm.value.split(/[\s,;]+/).filter(s => s.length) : [];
    giRender();
  }
  TOOL_RUNNERS.runGini = runGini;

  /* ------------------------------------------------------------
     TOOL · decision tree builder  (runDT)
     ------------------------------------------------------------ */
  const DT = { feats: [], rows: [], classes: [], tree: null, exp: [], nodes: [], frame: 0, sel: -1, root: 'auto', err: '' };
  function dtParse(text) {
    const lines = String(text).split(/\n+/).map(s => s.trim()).filter(s => s.length && s.charAt(0) !== '#');
    if (lines.length < 2) return { err: 'Give a header line and at least one data row.' };
    const split = s => (s.indexOf(',') >= 0 ? s.split(',') : s.split(/\t+|\s{1,}/)).map(t => t.trim()).filter(t => t.length);
    const head = split(lines[0]);
    if (head.length < 2) return { err: 'The header needs at least one feature and a final class column.' };
    if (head.length > 7) return { err: 'Six features at most (plus the class column).' };
    const feats = head.slice(0, head.length - 1), rows = [];
    for (let i = 1; i < lines.length; i++) {
      const b = split(lines[i]);
      if (b.length !== head.length) return { err: `Row ${i} has ${b.length} field${b.length === 1 ? '' : 's'} but the header has ${head.length}: “${esc(lines[i])}”` };
      rows.push({ f: b.slice(0, feats.length), c: b[feats.length] });
    }
    if (rows.length > 300) return { err: 'Three hundred rows at most.' };
    const classes = [];
    rows.forEach(r => { if (classes.indexOf(r.c) < 0) classes.push(r.c); });
    classes.sort();
    if (classes.length > 8) return { err: 'Eight classes at most.' };
    return { feats: feats, rows: rows, classes: classes, label: head[head.length - 1] };
  }
  function dtVec(rows) { return DT.classes.map(c => rows.filter(r => r.c === c).length); }
  function dtMajor(v) { let bi = 0; for (let i = 1; i < v.length; i++) if (v[i] > v[bi]) bi = i; return bi; }
  function dtVals(rows, fi) { const out = []; rows.forEach(r => { if (out.indexOf(r.f[fi]) < 0) out.push(r.f[fi]); }); out.sort(); return out; }
  function dtSplitScore(rows, fi) {
    const vals = dtVals(rows, fi), n = rows.length, parts = [];
    let tot = 0;
    vals.forEach(v => {
      const sub = rows.filter(r => r.f[fi] === v), vec = dtVec(sub), g = giOf(vec);
      tot += (sub.length / n) * g;
      parts.push({ val: v, rows: sub, vec: vec, gini: g, n: sub.length });
    });
    return { score: tot, parts: parts, vals: vals };
  }
  function dtBuild(rows, used, path, depth, forced) {
    const vec = dtVec(rows), g = giOf(vec);
    const nd = { rows: rows, vec: vec, gini: g, path: path, depth: depth, cls: DT.classes[dtMajor(vec)], kids: null, feat: -1, cand: [] };
    if (g < 1e-12 || depth >= 6 || used.length >= DT.feats.length) return nd;
    /* score every feature we have not already split on along this path */
    const cand = [];
    DT.feats.forEach((f, fi) => {
      if (used.indexOf(fi) >= 0) return;
      const s = dtSplitScore(rows, fi);
      cand.push({ fi: fi, name: f, score: s.score, parts: s.parts, useless: s.parts.length < 2 });
    });
    if (!cand.length) return nd;
    nd.cand = cand;
    let best = null;
    if (forced !== undefined && forced >= 0) { best = cand.filter(c => c.fi === forced)[0] || null; }
    if (!best) { cand.forEach(c => { if (c.useless) return; if (!best || c.score < best.score - 1e-12) best = c; }); }
    if (!best || best.useless) return nd;
    nd.feat = best.fi; nd.featName = best.name; nd.score = best.score;
    nd.kids = best.parts.map(p => ({ val: p.val, node: dtBuild(p.rows, used.concat([best.fi]), path + '/' + best.name + '=' + p.val, depth + 1) }));
    return nd;
  }
  /* breadth-first, so the stepper grows the tree level by level like a person would */
  function dtCollect(root) {
    root.parent = null;
    const all = [], exp = [], q = [root];
    while (q.length) {
      const nd = q.shift();
      nd.nid = all.length; all.push(nd);
      if (nd.kids) { nd.expIdx = exp.length; exp.push(nd); nd.kids.forEach(k => { k.node.parent = nd; q.push(k.node); }); }
    }
    return { all: all, exp: exp };
  }
  function dtStep(d, fromSlider) {
    const total = DT.exp.length + 1;
    if (d === 'play') { IX.play('dt', total, () => DT.frame, f => { DT.frame = f; dtRender(); }, 1300); dtRender(); return; }
    IX.stop('dt');
    if (d === 'first') DT.frame = 0;
    else if (d === 'last') DT.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) DT.frame = d;
    else DT.frame = Math.max(0, Math.min(total - 1, DT.frame + d));
    dtRender();
  }
  function dtPick(i) { i = Number(i); DT.sel = (DT.sel === i ? -1 : i); dtRender(); }
  function dtRoot(v) { DT.root = v; DT.frame = 0; DT.sel = -1; runDT(); }
  function dtLoad(which) {
    const el = document.getElementById('dt-data');
    if (!el) return;
    if (which === '73') el.value = 'OwnsHome, HasJob, CreditRisk\nYes, Yes, Low\nNo, Yes, Medium\nNo, No, High\nYes, No, High\nYes, Yes, Low\nNo, Yes, Medium\nYes, No, High\nNo, No, High\nYes, Yes, Low\nNo, Yes, Medium\nYes, No, High\nYes, Yes, Low\nNo, Yes, Medium\nYes, No, High\nYes, Yes, Low';
    else if (which === '74') el.value = 'Feature1, Feature2, Feature3, Class\n1, 0, 1, A\n0, 1, 0, B\n1, 0, 0, C\n0, 1, 1, A\n1, 1, 0, B\n0, 0, 1, C\n1, 1, 0, D\n0, 0, 1, A\n1, 0, 1, B\n0, 1, 0, C\n1, 1, 1, D\n0, 1, 0, A\n1, 0, 0, B\n0, 0, 1, C\n1, 1, 0, D\n1, 0, 1, A\n0, 1, 1, B\n0, 1, 0, C\n1, 0, 1, D\n0, 1, 0, A';
    else if (which === 'tennis') el.value = 'Outlook, Temp, Humidity, Windy, Play\nSunny, Hot, High, No, No\nSunny, Hot, High, Yes, No\nOvercast, Hot, High, No, Yes\nRain, Mild, High, No, Yes\nRain, Cool, Normal, No, Yes\nRain, Cool, Normal, Yes, No\nOvercast, Cool, Normal, Yes, Yes\nSunny, Mild, High, No, No\nSunny, Cool, Normal, No, Yes\nRain, Mild, Normal, No, Yes\nSunny, Mild, Normal, Yes, Yes\nOvercast, Mild, High, Yes, Yes\nOvercast, Hot, Normal, No, Yes\nRain, Mild, High, Yes, No';
    DT.root = 'auto'; DT.frame = 0; DT.sel = -1;
    runDT();
  }
  const DT_BW = 116, DT_BH = 64, DT_GX = 16, DT_GY = 52;
  function dtLayout(root, F) {
    let leaf = 0, maxD = 0;
    const walk = nd => {
      maxD = Math.max(maxD, nd.depth);
      const open = nd.kids && nd.expIdx < F;
      if (!open) { nd.ox = leaf++; return; }
      nd.kids.forEach(k => walk(k.node));
      nd.ox = (nd.kids[0].node.ox + nd.kids[nd.kids.length - 1].node.ox) / 2;
    };
    walk(root);
    return { leaves: leaf, maxD: maxD };
  }
  function dtDraw(root, F) {
    const lay = dtLayout(root, F);
    const W = Math.max(360, lay.leaves * (DT_BW + DT_GX) + 24), H = (lay.maxD + 1) * (DT_BH + DT_GY) + 20;
    const px = nd => 12 + nd.ox * (DT_BW + DT_GX);
    const py = nd => 10 + nd.depth * (DT_BH + DT_GY);
    let g = '';
    const walk = nd => {
      const open = nd.kids && nd.expIdx < F;
      if (open) nd.kids.forEach(k => {
        const c = k.node;
        const x1 = px(nd) + DT_BW / 2, y1 = py(nd) + DT_BH, x2 = px(c) + DT_BW / 2, y2 = py(c);
        g += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${(y1 + 22).toFixed(1)}, ${x2.toFixed(1)} ${(y2 - 22).toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="var(--ink-muted)" stroke-width="1.4"/>`;
        g += `<rect x="${((x1 + x2) / 2 - 22).toFixed(1)}" y="${((y1 + y2) / 2 - 8).toFixed(1)}" width="44" height="16" rx="8" fill="var(--surface)" stroke="var(--rule)"/>`;
        g += `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${((y1 + y2) / 2 + 4).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9.5" fill="var(--ink-soft)">${esc(String(k.val)).slice(0, 7)}</text>`;
        walk(c);
      });
      const x = px(nd), y = py(nd), pure = nd.gini < 1e-12;
      const on = DT.sel === nd.nid;
      g += `<rect class="hit" onclick="dtPick(${nd.nid})" x="${x}" y="${y}" width="${DT_BW}" height="${DT_BH}" rx="8"
        fill="${pure ? 'var(--tint-c)' : 'var(--surface-2)'}" stroke="${on ? 'var(--accent)' : (pure ? 'var(--accent-3)' : 'var(--rule)')}" stroke-width="${on ? 2.6 : 1.3}"/>`;
      const t = (dy, s, col, sz, weight) => { g += `<text x="${x + DT_BW / 2}" y="${y + dy}" text-anchor="middle" pointer-events="none" font-family="IBM Plex Mono" font-size="${sz || 10}" fill="${col || 'var(--ink-soft)'}"${weight ? ' font-weight="600"' : ''}>${s}</text>`; };
      if (open) t(14, esc(nd.featName), 'var(--accent)', 10.5, 1); else t(14, pure ? 'leaf' : (nd.kids ? '…' : 'leaf'), pure ? 'var(--accent-3)' : 'var(--ink-muted)', 9.5);
      t(27, 'gini = ' + w7N(nd.gini, 3), 'var(--ink-muted)', 9.5);
      t(39, 'n = ' + nd.rows.length + ' · [' + nd.vec.join(',') + ']', 'var(--ink-muted)', 9.5);
      t(52, esc(nd.cls), 'var(--ink)', 11, 1);
    };
    walk(root);
    return `<div class="ix-canvas" style="overflow-x:auto;"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg" style="min-width:100%;"><title>Decision tree</title><desc>Each box shows the splitting feature, the Gini index, the sample count, the class-count vector and the majority class.</desc>${g}</svg></div>`;
  }
  function dtPanel(nd) {
    const n = nd.rows.length;
    let h = `<div class="kmstep"><h5>node &nbsp;<code>${nd.path === '' ? 'root' : esc(nd.path.replace(/^\//, ''))}</code></h5>`;
    h += `<p style="margin:0 0 8px 0; font-size:12.5px;">${n} sample${n === 1 ? '' : 's'}, class counts <code>[${nd.vec.join(', ')}]</code> over <code>${DT.classes.map(esc).join(', ')}</code>.</p>`;
    h += `<div style="font-family:'IBM Plex Mono',monospace; font-size:12.5px; margin-bottom:10px;">Gini = ${nd.vec.map(c => `${c}/${n}·${n - c}/${n}`).join(' + ')} = <strong>${w7N(nd.gini, 4)}</strong></div>`;
    if (nd.gini < 1e-12) { h += `<div class="verdict safe" style="margin-top:0;">Pure — every point here is <strong>${esc(nd.cls)}</strong>. No split can improve on zero, so this is a leaf.</div></div>`; return h; }
    if (!nd.cand.length) { h += `<div class="verdict warn" style="margin-top:0;">Every feature has already been used on the path to this node, so there is nothing left to split by. It becomes a leaf labelled <strong>${esc(nd.cls)}</strong> — the majority — even though it is not pure.</div></div>`; return h; }
    h += '<table><tr><th>split by</th><th>children</th><th>Gini-Split</th><th></th></tr>';
    let best = Infinity;
    nd.cand.forEach(c => { if (!c.useless) best = Math.min(best, c.score); });
    nd.cand.forEach(c => {
      const win = !c.useless && Math.abs(c.score - best) < 1e-12;
      const detail = c.parts.map(p => `<span style="white-space:nowrap;"><code>${esc(c.name)}=${esc(p.val)}</code> ${p.n}/${n}·${w7N(p.gini, 4)}</span>`).join(' &nbsp;+&nbsp; ');
      h += `<tr${win ? ' style="background:var(--tint-c);"' : ''}><td><strong>${esc(c.name)}</strong>${win ? ' ✓' : ''}</td><td style="font-size:11.5px;">${c.useless ? '<em>one value only — useless here</em>' : detail}</td>
        <td><code>${c.useless ? '—' : w7N(c.score, 4)}</code></td><td>${c.useless ? '' : giBar(c.score, Math.max(0.001, nd.gini), win ? 'var(--accent-3)' : 'var(--accent-2)')}</td></tr>`;
    });
    h += '</table>';
    if (nd.feat >= 0) h += `<div class="verdict safe" style="margin-top:10px;">arg min gives <strong>${esc(nd.featName)}</strong> at <strong>${w7N(nd.score, 4)}</strong> — down from ${w7N(nd.gini, 4)} at this node.</div>`;
    return h + '</div>';
  }
  function dtRender() {
    const out = document.getElementById('dt-output');
    if (!out) return;
    if (DT.err) { out.innerHTML = `<div class="tool-error">${DT.err}</div>`; return; }
    const F = DT.frame, total = DT.exp.length + 1;
    let html = dtDraw(DT.tree, F);
    html += `<div class="ix-bar"><span class="ix-lab">root split</span>
      <select onchange="dtRoot(this.value)" data-nolive><option value="auto"${DT.root === 'auto' ? ' selected' : ''}>arg min Gini-Split (the algorithm)</option>`
      + DT.feats.map((f, i) => `<option value="${i}"${String(DT.root) === String(i) ? ' selected' : ''}>force ${esc(f)}</option>`).join('') + `</select>
      <span class="ix-lab">click any box for its full Gini-Split table</span>
      <button class="ix-btn" onclick="dtLoad('73')">Table 7.3</button>
      <button class="ix-btn" onclick="dtLoad('74')">Table 7.4</button>
      <button class="ix-btn" onclick="dtLoad('tennis')">play tennis</button></div>`;
    html += IX.player('dt', F, total, `split <strong>${F}</strong> / ${total - 1} placed`, F >= total - 1 ? ['done', 'tree complete'] : ['assign', 'growing']);
    const sel = DT.sel >= 0 ? DT.nodes[DT.sel] : null;
    if (sel) html += dtPanel(sel);
    else if (DT.exp.length) html += dtPanel(F < DT.exp.length ? DT.exp[F] : DT.tree);
    /* summary */
    const leaves = [], impure = [];
    (function walk(nd) { if (!nd.kids) { leaves.push(nd); if (nd.gini > 1e-12) impure.push(nd); } else nd.kids.forEach(k => walk(k.node)); })(DT.tree);
    const depth = leaves.reduce((a, l) => Math.max(a, l.depth), 0);
    const right = DT.rows.filter(r => {
      let nd = DT.tree;
      while (nd.kids) { const k = nd.kids.filter(k => k.val === r.f[nd.feat])[0]; if (!k) break; nd = k.node; }
      return nd.cls === r.c;
    }).length;
    html += `<div class="metrics">
      <div class="metric"><div class="mn">root Gini</div><div class="mv">${w7N(DT.tree.gini, 4)}</div><div class="mf">[${DT.tree.vec.join(', ')}] over ${DT.rows.length}</div></div>
      <div class="metric"><div class="mn">splits used</div><div class="mv">${DT.exp.length}</div><div class="mf">${leaves.length} leaves, depth ${depth}</div></div>
      <div class="metric"><div class="mn">training accuracy</div><div class="mv">${w7N(100 * right / DT.rows.length, 1)}%</div><div class="mf">${right} / ${DT.rows.length} rows land on their own class</div></div>
      <div class="metric dim"><div class="mn">impure leaves</div><div class="mv">${impure.length}</div><div class="mf">${impure.length ? 'features ran out before purity' : 'every leaf is pure'}</div></div>
    </div>`;
    html += `<p class="ix-hint"><strong>Class-count vectors are in alphabetical order</strong> — <code>${DT.classes.map(esc).join(', ')}</code> — which is what scikit-learn does and what makes “ties broken by lowest index” well defined.
      Switch the root split above to force the <em>worse</em> feature and watch every Gini-Split downstream get bigger.</p>`;
    out.innerHTML = html;
  }
  function runDT() {
    const out = document.getElementById('dt-output');
    if (!out) return;
    const el = document.getElementById('dt-data');
    const p = dtParse(el ? el.value : '');
    if (p.err) { DT.err = p.err; DT.tree = null; out.innerHTML = `<div class="tool-error">${p.err}</div>`; return; }
    DT.err = ''; DT.feats = p.feats; DT.rows = p.rows; DT.classes = p.classes;
    const forced = DT.root === 'auto' ? undefined : Number(DT.root);
    DT.tree = dtBuild(DT.rows, [], '', 0, forced);
    const c = dtCollect(DT.tree);
    DT.nodes = c.all; DT.exp = c.exp;
    if (DT.frame > DT.exp.length) DT.frame = DT.exp.length;
    if (DT.sel >= DT.nodes.length) DT.sel = -1;
    dtRender();
  }
  TOOL_RUNNERS.runDT = runDT;
