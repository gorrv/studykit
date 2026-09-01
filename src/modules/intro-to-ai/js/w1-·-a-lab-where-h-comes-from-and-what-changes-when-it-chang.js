  /* ============================================================
     W1 · A* LAB — where h comes from, and what changes when it changes
     ============================================================ */
  const AL_GRAPH = 'ARAD - A : 118\nARAD - B : 75\nARAD - D : 140\nB - C : 71\nD - C : 151\nD - E : 80\nD - F : 99\nA - I : 111\nI - L : 70\nL - M : 75\nM - H : 120\nH - E : 146\nH - G : 138\nE - G : 97\nG - BUCHAREST : 101\nF - BUCHAREST : 211';
  const AL_H0 = { ARAD: 366, A: 329, B: 374, C: 380, D: 253, E: 193, F: 176, G: 100, H: 160, I: 244, L: 241, M: 242, BUCHAREST: 0 };
  /* real map positions — this is what a ruler would be laid across */
  const AL_XY = { ARAD: [91, 492], A: [94, 410], B: [108, 531], C: [131, 571], D: [207, 457],
                  E: [233, 410], F: [305, 449], G: [320, 368], H: [253, 288], I: [165, 379],
                  L: [168, 339], M: [165, 299], BUCHAREST: [400, 327] };
  const AL = { h: {}, key: 'f', frame: 0, frames: [], G: null, star: {}, rulers: true };
  const AL_W = 560, AL_H = 392;
  const alX = n => 55 + (AL_XY[n][0] - 91) * 1.5;
  const alY = n => 30 + (571 - AL_XY[n][1]) * 1.15;
  const AL_KEY = { g: ['Uniform cost', 'f(n) = g(n)', 'the road behind you, only'],
                   h: ['Greedy best-first', 'f(n) = h(n)', 'the guess ahead of you, only'],
                   f: ['A*', 'f(n) = g(n) + h(n)', 'both, added together'] };
  function alVal(e) { return AL.key === 'g' ? e.g : AL.key === 'h' ? e.h : e.g + e.h; }
  function alSearch() {
    const adj = AL.G.adj, H = AL.h, start = 'ARAD', goal = 'BUCHAREST';
    const val = e => AL.key === 'g' ? e.g : AL.key === 'h' ? (H[e.n] || 0) : e.g + (H[e.n] || 0);
    let frontier = [{ n: start, g: 0, path: [start], born: 0 }];
    const closed = {}, frames = [];
    for (let step = 0; step < 40 && frontier.length; step++) {
      let bi = 0;
      for (let i = 1; i < frontier.length; i++) if (val(frontier[i]) < val(frontier[bi]) - 1e-9) bi = i;
      const cur = frontier[bi];
      frames.push({
        step: step, pick: cur.n,
        rows: frontier.map(e => ({ n: e.n, g: e.g, h: H[e.n] || 0, v: val(e), path: e.path.slice(), waited: step - e.born }))
                      .sort((a, b) => a.v - b.v || (a.n < b.n ? -1 : 1)),
        closed: Object.keys(closed).slice(),
        done: cur.n === goal, path: cur.path.slice(), cost: cur.g
      });
      if (cur.n === goal) break;
      frontier.splice(bi, 1);
      closed[cur.n] = true;
      (adj[cur.n] || []).forEach(e => {
        if (closed[e.to]) return;
        const g2 = cur.g + e.cost, ex = frontier.filter(x => x.n === e.to)[0];
        if (ex) { if (g2 < ex.g - 1e-9) { ex.g = g2; ex.path = cur.path.concat([e.to]); ex.born = step + 1; } return; }
        frontier.push({ n: e.to, g: g2, path: cur.path.concat([e.to]), born: step + 1 });
      });
    }
    AL.frames = frames;
    if (AL.frame > frames.length - 1) AL.frame = frames.length - 1;
  }
  function alSetKey(k) { AL.key = k; AL.frame = 0; alSearch(); alRender(); }
  function alH(n, v) { AL.h[n] = Math.max(0, Math.round(Number(v))); alSearch(); alRender(); }
  function alReset() { AL.h = Object.assign({}, AL_H0); AL.frame = 0; alSearch(); alRender(); }
  function alRuler() { AL.rulers = !AL.rulers; alRender(); }
  function alZero() { Object.keys(AL.h).forEach(n => AL.h[n] = 0); AL.frame = 0; alSearch(); alRender(); }
  function alStep(d, fromSlider) {
    const total = AL.frames.length;
    if (d === 'play') { IX.play('al', total, () => AL.frame, f => { AL.frame = f; alRender(); }, 950); alRender(); return; }
    IX.stop('al');
    if (d === 'first') AL.frame = 0;
    else if (d === 'last') AL.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) AL.frame = d;
    else AL.frame = Math.max(0, Math.min(total - 1, AL.frame + d));
    alRender();
  }
  function alRender() {
    const out = document.getElementById('al-output');
    if (!out) return;
    const F = AL.frames[AL.frame], nodes = AL.G.order, adj = AL.G.adj;
    const inFrontier = {}, waited = {};
    F.rows.forEach(r => { inFrontier[r.n] = r; waited[r.n] = r.waited; });
    const isClosed = {}; F.closed.forEach(n => isClosed[n] = true);
    const onPath = {};
    for (let i = 0; i < F.path.length - 1; i++) onPath[F.path[i] + '|' + F.path[i + 1]] = onPath[F.path[i + 1] + '|' + F.path[i]] = true;
    let g = '';
    /* roads */
    nodes.forEach(a => (adj[a] || []).forEach(e => {
      if (a > e.to) return;
      const hot = onPath[a + '|' + e.to];
      g += `<line x1="${alX(a).toFixed(1)}" y1="${alY(a).toFixed(1)}" x2="${alX(e.to).toFixed(1)}" y2="${alY(e.to).toFixed(1)}"
        stroke="${hot ? 'var(--accent)' : 'var(--rule)'}" stroke-width="${hot ? 3.4 : 1}"/>`;
      const mx = (alX(a) + alX(e.to)) / 2, my = (alY(a) + alY(e.to)) / 2;
      g += `<text x="${mx.toFixed(1)}" y="${(my - 3).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9"
        fill="${hot ? 'var(--accent)' : 'var(--ink-muted)'}" opacity="${hot ? 1 : 0.75}">${e.cost}</text>`;
    }));
    /* rulers: the straight line h is measured along */
    if (AL.rulers && AL.key !== 'g') {
      F.rows.forEach(r => {
        if (r.n === 'BUCHAREST') return;
        const bad = r.h > AL.star[r.n] + 1e-9;
        g += `<line x1="${alX(r.n).toFixed(1)}" y1="${alY(r.n).toFixed(1)}" x2="${alX('BUCHAREST').toFixed(1)}" y2="${alY('BUCHAREST').toFixed(1)}"
          stroke="${bad ? 'var(--accent-2)' : 'var(--accent-4)'}" stroke-width="1.4" stroke-dasharray="5 4" opacity="0.75"/>`;
      });
    }
    /* nodes */
    nodes.forEach(n => {
      const x = alX(n), y = alY(n), pick = n === F.pick;
      const cls = isClosed[n] ? 'closed' : inFrontier[n] ? 'front' : 'un';
      const fill = cls === 'closed' ? 'var(--ink-muted)' : 'var(--surface)';
      const stroke = pick ? 'var(--accent)' : cls === 'front' ? 'var(--accent-4)' : cls === 'closed' ? 'var(--ink-muted)' : 'var(--rule)';
      if (pick) g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="none" stroke="var(--accent)" stroke-width="1.6" opacity="0.5"/>`;
      if (n === 'BUCHAREST') g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="none" stroke="var(--accent-3)" stroke-width="1.6"/>`;
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${pick ? 8 : 6}" fill="${fill}" stroke="${stroke}" stroke-width="${pick ? 3 : 2}"/>`;
      const lab = n === 'BUCHAREST' ? 'BUC' : n === 'ARAD' ? 'ARAD' : n;
      const lx = n === 'BUCHAREST' ? x - 16 : x, anch = n === 'BUCHAREST' ? 'end' : 'middle';
      g += `<text x="${lx.toFixed(1)}" y="${(y - 12).toFixed(1)}" text-anchor="${anch}" font-family="IBM Plex Mono" font-size="11.5"
        font-weight="600" fill="${pick ? 'var(--accent)' : 'var(--ink)'}">${lab}</text>`;
      if (AL.key !== 'g') g += `<text x="${lx.toFixed(1)}" y="${(y + 20).toFixed(1)}" text-anchor="${anch}" font-family="IBM Plex Mono" font-size="9.5"
        fill="${AL.h[n] > AL.star[n] + 1e-9 ? 'var(--accent-2)' : 'var(--accent-4)'}">h=${AL.h[n]}</text>`;
    });
    let html = `<div class="ix-canvas"><svg width="100%" viewBox="0 0 ${AL_W} ${AL_H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + `<title>Romania map during search</title><desc>Towns positioned as on a real map, with roads labelled by cost and dashed straight lines showing each frontier node's heuristic.</desc>${g}</svg></div>`;
    html += `<div class="ix-bar"><span class="ix-lab">rank the frontier by</span><span class="ix-seg">`
      + ['g', 'h', 'f'].map(k => `<button class="${AL.key === k ? 'on' : ''}" onclick="alSetKey('${k}')">${AL_KEY[k][1]}</button>`).join('')
      + `</span><span class="ix-lab"><strong>${AL_KEY[AL.key][0]}</strong> — uses ${AL_KEY[AL.key][2]}</span>
      ${IX.toggles([{ label: 'draw the rulers', on: AL.rulers, fn: 'alRuler()' }])}</div>`;
    html += IX.player('al', AL.frame, AL.frames.length, `expansion <strong>${AL.frame + 1}</strong> of ${AL.frames.length}`,
      F.done ? ['done', 'goal reached'] : ['assign', 'about to expand ' + F.pick]);
    /* frontier table */
    html += '<table><tr><th>frontier</th><th>g</th>' + (AL.key !== 'g' ? '<th>h</th>' : '')
      + `<th>${AL.key === 'g' ? 'g' : AL.key === 'h' ? 'h' : 'f = g + h'}</th><th>waiting</th><th>path so far</th></tr>`;
    F.rows.forEach((r, i) => {
      const pick = r.n === F.pick;
      html += `<tr${pick ? ' style="background:var(--tint-c);"' : ''}>
        <td><strong>${r.n === 'BUCHAREST' ? 'BUC' : r.n}</strong>${pick ? ' ←' : ''}</td>
        <td><code>${r.g}</code></td>` + (AL.key !== 'g' ? `<td><code>${r.h}</code></td>` : '')
        + `<td><code><strong>${AL.key === 'f' ? r.g + ' + ' + r.h + ' = ' + r.v : r.v}</strong></code></td>
        <td>${r.waited ? `<span style="color:var(--accent-2);">${r.waited} step${r.waited === 1 ? '' : 's'}</span>` : '—'}</td>
        <td style="font-family:'IBM Plex Mono',monospace; font-size:11px;">${r.path.map(p => p === 'BUCHAREST' ? 'BUC' : p).join(' → ')}</td></tr>`;
    });
    html += '</table>';
    /* narration */
    const best = F.rows[0], worstG = F.rows.slice().sort((a, b) => a.g - b.g)[0];
    let note;
    if (F.done) note = `<strong>Goal reached after ${AL.frames.length} expansions</strong>, by the path <code>${F.path.map(p => p === 'BUCHAREST' ? 'BUC' : p).join(' → ')}</code> at a cost of <strong>${F.cost}</strong>.`;
    else if (AL.key === 'f' && worstG.n !== best.n)
      note = `<strong>${worstG.n}</strong> has the cheapest road so far (g = ${worstG.g}) — UCS would take it. But its ruler line is long (h = ${worstG.h}), so f = ${worstG.g + worstG.h}. <strong>${best.n}</strong> costs more to reach yet has the smaller total estimate, <strong>${best.v}</strong>, so A* expands that instead.`;
    else note = `Smallest ${AL.key === 'g' ? 'g' : AL.key === 'h' ? 'h' : 'f'} in the frontier is <strong>${best.n}</strong> at <strong>${best.v}</strong>, so that is what gets expanded next.`;
    const stuck = F.rows.filter(r => r.waited >= 2).sort((a, b) => b.waited - a.waited);
    if (stuck.length) note += `<br><br><strong>${stuck[0].n}</strong> has now been sitting in the frontier for <strong>${stuck[0].waited} expansions</strong> without being chosen.`;
    html += `<div class="verdict ${F.done ? 'safe' : 'warn'}" style="margin-top:12px;">${note}</div>`;
    /* the h controls */
    let bad = 0;
    html += '<div class="ix-bar" style="margin-top:14px;"><span class="ix-lab"><strong>drag any h</strong> — the numbers below are the only thing A* knows about the goal</span>'
      + `<button class="ix-btn" onclick="alReset()">restore the given values</button>
         <button class="ix-btn" onclick="alZero()">set every h to 0</button></div>`;
    html += '<div class="concept-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px;">';
    AL.G.order.forEach(n => {
      if (n === 'BUCHAREST') return;
      const over = AL.h[n] > AL.star[n] + 1e-9;
      if (over) bad++;
      html += `<div style="border:1px solid ${over ? 'var(--accent-2)' : 'var(--rule)'}; border-radius:6px; padding:6px 8px; background:var(--surface-2);">
        <div style="font-family:'IBM Plex Mono',monospace; font-size:11px; display:flex; justify-content:space-between;">
          <span><strong>${n === 'ARAD' ? 'ARAD' : n}</strong></span>
          <span style="color:${over ? 'var(--accent-2)' : 'var(--accent-4)'};">h=${AL.h[n]}</span></div>
        <input type="range" min="0" max="500" step="1" value="${AL.h[n]}" style="width:100%; accent-color:${over ? 'var(--accent-2)' : 'var(--accent)'};"
          oninput="alH('${n}', this.value)" aria-label="heuristic for ${n}">
        <div style="font-family:'IBM Plex Mono',monospace; font-size:9.5px; color:var(--ink-muted);">true remaining ${AL.star[n]}${over ? ' <strong style="color:var(--accent-2);">· over</strong>' : ''}</div></div>`;
    });
    html += '</div>';
    html += `<div class="verdict ${bad ? 'bad' : 'safe'}" style="margin-top:10px;">${bad
      ? `<strong>${bad} heuristic${bad === 1 ? ' is' : 's are'} now inadmissible</strong> — larger than the true remaining road distance. A* may return a path that is not the cheapest. Those nodes are drawn in red.`
      : `<strong>Every h is admissible</strong> — never larger than the true remaining road distance shown under each slider. This is what makes A* guaranteed to return the cheapest path.`}</div>`;
    html += `<p class="ix-hint"><strong>Where the given numbers come from:</strong> they are straight-line distances to Bucharest, measured off the map — the dashed lines above.
      Knowing <em>where</em> Bucharest is costs nothing; knowing <em>how to drive there</em> is the whole search problem. That is why h is available before you have explored anything.
      <strong>Set every h to 0</strong> and f = g + 0 = g, so A* becomes UCS exactly — the clearest possible statement of what h contributes.</p>`;
    out.innerHTML = html;
  }
  function runALab() {
    const out = document.getElementById('al-output');
    if (!out) return;
    if (!AL.G) {
      AL.G = sxParseGraph(AL_GRAPH);
      AL.star = adTrueCosts(AL.G.adj, 'BUCHAREST');
      AL.h = Object.assign({}, AL_H0);
    }
    alSearch();
    alRender();
  }
  TOOL_RUNNERS.runALab = runALab;
