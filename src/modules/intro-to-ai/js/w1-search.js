  /* ============================================================
     TOPIC TOOLS — added here as each topic's content goes in.
     ============================================================ */

  /* ---------- W1: graph + heuristic parsing ---------- */
  function sxParseGraph(text) {
    const adj = {}, order = [], errs = [];
    const touch = n => { if (!adj[n]) { adj[n] = []; order.push(n); } };
    String(text).split(/\n+/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) return;
      const m = line.match(/^([A-Za-z0-9_]+)\s*[-–>]+\s*([A-Za-z0-9_]+)\s*[:=]\s*(-?\d+(?:\.\d+)?)$/);
      if (!m) { errs.push(`line ${i + 1}: could not read "${line}" — expected  FROM - TO : COST`); return; }
      const a = m[1].toUpperCase(), b = m[2].toUpperCase(), c = parseFloat(m[3]);
      if (c < 0) errs.push(`line ${i + 1}: negative cost ${c} — UCS and A* assume non-negative costs`);
      touch(a); touch(b);
      adj[a].push({ to: b, cost: c });
      adj[b].push({ to: a, cost: c });
    });
    return { adj: adj, order: order, errs: errs };
  }
  function sxParseHeur(text) {
    const h = {}, errs = [];
    const toks = String(text).replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    // support "A : 12" split across tokens as well as "A:12"
    const joined = toks.join(' ').replace(/\s*:\s*/g, ':').split(/\s+/).filter(Boolean);
    joined.forEach(t => {
      const m = t.match(/^([A-Za-z0-9_]+):(-?\d+(?:\.\d+)?)$/);
      if (!m) { errs.push(`could not read "${t}" — expected  NODE:VALUE`); return; }
      h[m[1].toUpperCase()] = parseFloat(m[2]);
    });
    return { h: h, errs: errs };
  }
  const SX_ALG_NAME = { bfs: 'Breadth-first search', dfs: 'Depth-first search',
    ucs: 'Uniform-cost search', greedy: 'Greedy best-first search', astar: 'A*' };
  const SX_ALG_F = { bfs: 'f(n) = depth(n)', dfs: 'f(n) = −depth(n)', ucs: 'f(n) = g(n)',
    greedy: 'f(n) = h(n)', astar: 'f(n) = g(n) + h(n)' };
  /* ---------- W1: the one search engine, five values of f ---------- */
  function sxSearch(adj, h, start, goal, alg, limit) {
    limit = limit || 2000;
    const hv = n => (h && typeof h[n] === 'number') ? h[n] : 0;
    const fOf = n => alg === 'bfs' ? n.depth
      : alg === 'dfs' ? -n.depth
        : alg === 'ucs' ? n.g
          : alg === 'greedy' ? hv(n.state)
            : n.g + hv(n.state);
    const costOrdered = (alg === 'ucs' || alg === 'astar');
    let seq = 0;
    const root = { state: start, parent: null, g: 0, depth: 0, seq: seq++ };
    let frontier = [root];
    const reached = {}; reached[start] = 0;
    const steps = [], expandOrder = [];
    let expansions = 0, generated = 1, truncated = false;
    const chip = n => ({ state: n.state, f: fOf(n), g: n.g, h: hv(n.state), depth: n.depth });
    while (frontier.length) {
      if (expansions >= limit) { truncated = true; break; }
      // pick min f; tie-break FIFO everywhere except DFS, which is LIFO
      let bi = 0;
      for (let i = 1; i < frontier.length; i++) {
        const a = fOf(frontier[i]), b = fOf(frontier[bi]);
        if (a < b || (a === b && (alg === 'dfs' ? frontier[i].seq > frontier[bi].seq
          : frontier[i].seq < frontier[bi].seq))) bi = i;
      }
      const node = frontier[bi];
      const before = frontier.map(chip);
      frontier.splice(bi, 1);
      expansions++;
      expandOrder.push({ state: node.state, f: fOf(node), goal: node.state === goal });
      if (node.state === goal) {
        steps.push({ n: expansions, pick: chip(node), before: before, kids: [], after: frontier.map(chip),
          note: 'goal test passes on expansion — stop' });
        const path = []; let c = node;
        while (c) { path.unshift(c.state); c = c.parent; }
        return { found: true, path: path, cost: node.g, actions: path.length - 1,
          expansions: expansions, generated: generated, steps: steps, order: expandOrder, truncated: false };
      }
      const kids = [];
      (adj[node.state] || []).forEach(e => {
        const g2 = node.g + e.cost;
        const seen = Object.prototype.hasOwnProperty.call(reached, e.to);
        let take, why;
        if (!seen) { take = true; why = 'new'; }
        else if (costOrdered && g2 < reached[e.to]) { take = true; why = `cheaper (${g2} < ${reached[e.to]})`; }
        else { take = false; why = 'already reached'; }
        if (take) {
          reached[e.to] = g2; generated++;
          const kid = { state: e.to, parent: node, g: g2, depth: node.depth + 1, seq: seq++ };
          frontier.push(kid);
          kids.push({ chip: chip(kid), why: why, taken: true });
        } else {
          kids.push({ chip: { state: e.to, f: null, g: g2, h: hv(e.to), depth: node.depth + 1 },
            why: why, taken: false });
        }
      });
      steps.push({ n: expansions, pick: chip(node), before: before, kids: kids, after: frontier.map(chip) });
    }
    return { found: false, path: null, cost: null, actions: null, expansions: expansions,
      generated: generated, steps: steps, order: expandOrder, truncated: truncated };
  }
  /* ---------- W1: rendering helpers ---------- */
  function sxChip(c, alg, cls) {
    const showF = c.f !== null && c.f !== undefined;
    let sub = '';
    if (alg === 'astar') sub = `${c.g}+${c.h}=${c.f}`;
    else if (alg === 'ucs') sub = `g=${c.g}`;
    else if (alg === 'greedy') sub = `h=${c.h}`;
    else sub = `d=${c.depth}`;
    return `<span class="chipq ${cls || ''}">${esc(c.state)}<span class="f">${showF ? sub : 'skip'}</span></span>`;
  }
  function sxPath(p) { return p.map(esc).join(' → '); }
  /* ---------- W1 search: draggable graph + frontier step player ---------- */
  const SX = { G: null, H: {}, pos: {}, start: '', goal: '', alg: 'ucs', frame: 0, res: null,
               labels: true, pick: 'start' };
  const SX_W = 560, SX_H = 380;
  function sxLayout(order, adj, force) {
    /* deterministic force-directed placement, then the user may drag */
    if (!force) {
      let allThere = true;
      order.forEach(n => { if (!SX.pos[n]) allThere = false; });
      if (allThere) return;
    }
    const n = order.length, idx = {};
    order.forEach((v, i) => idx[v] = i);
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const p = order.map((v, i) => {
      const a = 2 * Math.PI * i / n;
      return { x: SX_W / 2 + Math.cos(a) * SX_W * 0.3 + (rnd() - 0.5) * 20,
               y: SX_H / 2 + Math.sin(a) * SX_H * 0.3 + (rnd() - 0.5) * 20 };
    });
    const k = Math.sqrt((SX_W * SX_H) / Math.max(1, n)) * 0.72;
    for (let it = 0; it < 260; it++) {
      const t = k * 0.1 * (1 - it / 260) + 0.5;
      const dx = new Array(n).fill(0), dy = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let ex = p[i].x - p[j].x, ey = p[i].y - p[j].y;
        let dd = Math.sqrt(ex * ex + ey * ey) || 0.01;
        const rep = (k * k) / dd;
        ex /= dd; ey /= dd;
        dx[i] += ex * rep; dy[i] += ey * rep; dx[j] -= ex * rep; dy[j] -= ey * rep;
      }
      order.forEach((v, i) => (adj[v] || []).forEach(e => {
        const j = idx[e.to];
        if (j === undefined || j <= i) return;
        let ex = p[i].x - p[j].x, ey = p[i].y - p[j].y;
        let dd = Math.sqrt(ex * ex + ey * ey) || 0.01;
        const att = (dd * dd) / k;
        ex /= dd; ey /= dd;
        dx[i] -= ex * att; dy[i] -= ey * att; dx[j] += ex * att; dy[j] += ey * att;
      }));
      for (let i = 0; i < n; i++) {
        const dd = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1;
        p[i].x += (dx[i] / dd) * Math.min(dd, t);
        p[i].y += (dy[i] / dd) * Math.min(dd, t);
        p[i].x = Math.max(34, Math.min(SX_W - 34, p[i].x));
        p[i].y = Math.max(26, Math.min(SX_H - 26, p[i].y));
      }
    }
    SX.pos = {};
    order.forEach((v, i) => SX.pos[v] = { x: p[i].x, y: p[i].y });
  }
  function sxCanvas() {
    const G = SX.G, R = SX.res;
    if (!G) return '';
    const upto = SX.frame;
    /* state of every node after `upto` expansions */
    const expandedAt = {}, order = R ? R.order : [];
    order.forEach((o, i) => { if (expandedAt[o.state] === undefined) expandedAt[o.state] = i; });
    const step = upto > 0 ? R.steps[upto - 1] : null;
    const onFrontier = {};
    if (step) step.after.forEach(c => onFrontier[c.state] = c);
    const reached = {};
    for (let i = 0; i < upto; i++) reached[R.order[i].state] = true;
    if (step) step.after.forEach(c => reached[c.state] = true);
    const cur = upto > 0 ? R.order[upto - 1].state : null;
    /* the path back from the current node, if we have it */
    let pathEdges = {};
    if (R && R.found && upto >= R.order.length) {
      for (let i = 0; i + 1 < R.path.length; i++) pathEdges[R.path[i] + '|' + R.path[i + 1]] = 1;
    }
    let g = '';
    const drawn = {};
    G.order.forEach(a => (G.adj[a] || []).forEach(e => {
      const key = a < e.to ? a + '|' + e.to : e.to + '|' + a;
      if (drawn[key]) return;
      drawn[key] = 1;
      const A = SX.pos[a], B = SX.pos[e.to];
      if (!A || !B) return;
      const onPath = pathEdges[a + '|' + e.to] || pathEdges[e.to + '|' + a];
      const used = reached[a] && reached[e.to];
      g += `<line x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}" `
        + `stroke="${onPath ? 'var(--accent-3)' : used ? 'var(--ink-muted)' : 'var(--rule)'}" stroke-width="${onPath ? 4 : 1.3}" `
        + `opacity="${onPath ? 0.95 : used ? 0.75 : 0.45}"/>`;
      if (SX.labels) {
        const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        g += `<rect x="${(mx - 12).toFixed(1)}" y="${(my - 8).toFixed(1)}" width="24" height="14" rx="3" fill="var(--surface)" opacity="0.85"/>`;
        g += `<text x="${mx.toFixed(1)}" y="${(my + 3).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9.5" fill="var(--ink-muted)" pointer-events="none">${e.cost}</text>`;
      }
    }));
    G.order.forEach(v => {
      const P = SX.pos[v];
      if (!P) return;
      const isStart = v === SX.start, isGoal = v === SX.goal;
      const wasExpanded = expandedAt[v] !== undefined && expandedAt[v] < upto;
      const fr = onFrontier[v];
      let fill = 'var(--surface-2)', stroke = 'var(--rule)', sw = 1.4;
      if (!reached[v]) { fill = 'var(--surface-3)'; }
      if (fr) { fill = 'var(--tint-a2)'; stroke = 'var(--accent)'; sw = 2; }
      if (wasExpanded) { fill = 'var(--tint-n)'; stroke = 'var(--ink-muted)'; }
      if (v === cur) { fill = 'var(--tint-b2)'; stroke = 'var(--accent-2)'; sw = 3; }
      if (isGoal) { stroke = 'var(--accent-3)'; sw = 3; }
      const r = 17;
      g += `<circle class="grab" data-ix="${v}" cx="${P.x.toFixed(1)}" cy="${P.y.toFixed(1)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
      g += `<text x="${P.x.toFixed(1)}" y="${(P.y + 3.5).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" fill="var(--ink)" pointer-events="none">${esc(v.length > 4 ? v.slice(0, 4) : v)}</text>`;
      if (isStart) g += `<text x="${P.x.toFixed(1)}" y="${(P.y - r - 5).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--accent)" pointer-events="none">START</text>`;
      if (isGoal) g += `<text x="${P.x.toFixed(1)}" y="${(P.y - r - 5).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--accent-3)" pointer-events="none">GOAL</text>`;
      if (fr) g += `<text x="${P.x.toFixed(1)}" y="${(P.y + r + 11).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--accent)" pointer-events="none">f=${clFmt(fr.f, 0)}</text>`;
      else if (wasExpanded) g += `<text x="${P.x.toFixed(1)}" y="${(P.y + r + 11).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)" pointer-events="none">#${expandedAt[v] + 1}</text>`;
    });
    return `<div class="ix-canvas"><svg id="sx-svg" class="hit" width="100%" viewBox="0 0 ${SX_W} ${SX_H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + '<title>Search graph</title><desc>The graph with nodes coloured by search state: grey = already expanded, blue = on the frontier, faint = not yet reached.</desc>'
      + g + '</svg></div>';
  }
  function sxNodeAt(px, py) {
    let best = null, bd = 26 * 26;
    SX.G.order.forEach(v => {
      const P = SX.pos[v]; if (!P) return;
      const dd = (P.x - px) * (P.x - px) + (P.y - py) * (P.y - py);
      if (dd < bd) { bd = dd; best = v; }
    });
    return best;
  }
  function sxCompute() {
    if (!SX.G || !SX.G.adj[SX.start] || !SX.G.adj[SX.goal]) { SX.res = null; return; }
    SX.res = sxSearch(SX.G.adj, SX.H, SX.start, SX.goal, SX.alg, 2000);
    const total = SX.res.order.length + 1;
    if (SX.frame > total - 1) SX.frame = total - 1;
  }
  function sxDragNode(px, py, key) {
    if (!SX.pos[key]) return;
    SX.pos[key] = { x: Math.max(24, Math.min(SX_W - 24, px)), y: Math.max(20, Math.min(SX_H - 20, py)) };
    sxRender();
  }
  function sxClickNode(px, py, ev) {
    const v = sxNodeAt(px, py);
    if (!v) return false;
    if (ev && (ev.shiftKey || ev.altKey)) return false;
    return false;   /* plain clicks start a drag instead */
  }
  function sxPickNode(key) {
    if (SX.pick === 'start') { if (key === SX.goal) return; SX.start = key; const el = document.getElementById('sx-start'); if (el) el.value = key; }
    else { if (key === SX.start) return; SX.goal = key; const el = document.getElementById('sx-goal'); if (el) el.value = key; }
    IX.stop('sx'); SX.frame = 0; sxCompute(); sxRender();
  }
  function sxSetPick(k) { SX.pick = k; sxRender(); }
  function sxSetAlg(a) {
    SX.alg = a;
    const el = document.getElementById('sx-alg'); if (el) el.value = a;
    IX.stop('sx'); SX.frame = 0; sxCompute(); sxRender();
  }
  function sxRelayout() { sxLayout(SX.G.order, SX.G.adj, true); sxRender(); }
  function sxToggleLabels(on) { SX.labels = on; sxRender(); }
  function sxStep(d, fromSlider) {
    const total = SX.res ? SX.res.order.length + 1 : 1;
    if (d === 'play') { IX.play('sx', total, () => SX.frame, f => { SX.frame = f; sxRender(); }, 700); sxRender(); return; }
    IX.stop('sx');
    if (d === 'first') SX.frame = 0;
    else if (d === 'last') SX.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) SX.frame = d;
    else SX.frame = Math.max(0, Math.min(total - 1, SX.frame + d));
    sxRender();
  }
  function sxRender() {
    const out = document.getElementById('sx-output');
    if (!out) return;
    const R = SX.res;
    let html = '';
    if (!R) { out.innerHTML = '<div class="tool-error">Start or goal is not in the graph.</div>'; return; }
    const total = R.order.length + 1;
    html += `<div class="verdict ${R.found ? 'safe' : 'bad'}">
      <strong>${esc(SX_ALG_NAME[SX.alg])}</strong> &nbsp;·&nbsp; <code>${esc(SX_ALG_F[SX.alg])}</code>
      &nbsp;·&nbsp; ${esc(SX.start)} → ${esc(SX.goal)}</div>`;
    if (R.found) {
      html += `<div class="pathbox">${sxPath(R.path)}<br>
        <span style="font-size:12px; color:var(--ink-muted);">cost</span> <strong>${R.cost}</strong>
        &nbsp;·&nbsp; <span style="font-size:12px; color:var(--ink-muted);">actions</span> <strong>${R.actions}</strong>
        &nbsp;·&nbsp; <span style="font-size:12px; color:var(--ink-muted);">nodes expanded</span> <strong>${R.expansions}</strong>
        &nbsp;·&nbsp; <span style="font-size:12px; color:var(--ink-muted);">generated</span> <strong>${R.generated}</strong></div>`;
    } else {
      html += `<div class="pathbox none">${R.truncated ? 'Gave up after 2000 expansions.' : 'No path exists from ' + esc(SX.start) + ' to ' + esc(SX.goal) + '.'}</div>`;
    }
    html += sxCanvas();
    const cur = SX.frame > 0 ? R.order[SX.frame - 1] : null;
    html += IX.player('sx', SX.frame, total,
      SX.frame === 0 ? 'before the first expansion' : `expansion <strong>${SX.frame}</strong> of ${R.order.length} — popped <strong>${esc(cur.state)}</strong> (f = ${clFmt(cur.f, 0)})`,
      cur && cur.goal ? ['done', 'goal expanded — stop'] : ['assign', 'pop lowest f']);
    html += `<div class="ix-bar">
      <span class="ix-lab">algorithm:</span>
      ${['bfs', 'dfs', 'ucs', 'greedy', 'astar'].map(a =>
        `<button class="ix-btn ${SX.alg === a ? 'on' : ''}" onclick="sxSetAlg('${a}')">${a === 'astar' ? 'A*' : a.toUpperCase()}</button>`).join('')}
      <span class="ix-lab">click a node to set:</span>
      <button class="ix-btn ${SX.pick === 'start' ? 'on' : ''}" onclick="sxSetPick('start')">start</button>
      <button class="ix-btn ${SX.pick === 'goal' ? 'on' : ''}" onclick="sxSetPick('goal')">goal</button>
      <button class="ix-btn" onclick="sxRelayout()" title="Re-run the automatic layout">⤢ re-layout</button>
      ${IX.toggles([{ label: 'edge costs', on: SX.labels, fn: 'sxToggleLabels(this.checked)' }])}
    </div>`;
    html += `<p class="ix-hint"><strong>Drag nodes</strong> to untangle the graph · <strong>shift-click a node</strong> to make it the start or goal
      (whichever is selected above) · the algorithm buttons swap <code>f</code> instantly.
      <span style="color:var(--accent);">Blue = on the frontier</span> with its <code>f</code> underneath,
      <span style="color:var(--ink-muted);">grey = already expanded</span> with its expansion number,
      <span style="color:var(--accent-2);">orange = just popped</span>.</p>`;
    /* frontier at this frame */
    if (SX.frame > 0) {
      const s = R.steps[SX.frame - 1];
      html += '<div class="kmstep"><h5>Step ' + SX.frame + '</h5>';
      html += `<div class="qrow"><div class="qlab">frontier was</div><div class="frontier">`
        + (s.before.length ? s.before.map(c => sxChip(c, SX.alg, c.state === s.pick.state ? 'head' : '')).join('') : '<em style="color:var(--ink-muted);">empty</em>')
        + '</div></div>';
      html += `<div class="qrow"><div class="qlab">expand</div><div class="frontier">${sxChip(s.pick, SX.alg, 'head')}`
        + (s.note ? ` <span style="font-size:12.5px; color:var(--accent-3);">— ${esc(s.note)}</span>` : '') + '</div></div>';
      if (s.kids && s.kids.length) {
        html += `<div class="qrow"><div class="qlab">generates</div><div class="frontier">`
          + s.kids.map(k => sxChip(k.chip, SX.alg, k.taken ? '' : 'done')
            + `<span style="font-size:10.5px; color:var(--ink-muted); margin:0 8px 0 -2px;">${esc(k.why)}</span>`).join('')
          + '</div></div>';
      }
      html += `<div class="qrow"><div class="qlab">frontier now</div><div class="frontier">`
        + (s.after.length ? s.after.map(c => sxChip(c, SX.alg, '')).join('') : '<em style="color:var(--ink-muted);">empty</em>')
        + '</div></div></div>';
    }
    html += '<div class="qrow"><div class="qlab">expansion order</div><div class="expand-order">'
      + R.order.map((o, i) => `<span class="eo ${o.goal ? 'goalhit' : ''}" style="cursor:pointer; ${i < SX.frame ? '' : 'opacity:.5;'}" onclick="sxStep(${i + 1}, true)"><span class="n">${i + 1}</span>${esc(o.state)}</span>`).join('')
      + '</div></div>';
    html += `<p style="font-size:12.5px; color:var(--ink-muted); margin-top:10px;">
      Children are tried in the order the edges are listed. Ties in <code>f</code> break FIFO (LIFO for DFS),
      which is what makes BFS a queue and DFS a stack. The goal test runs when a node is
      <strong>expanded</strong>, not when it is generated.</p>`;
    out.innerHTML = html;
    const svg = document.getElementById('sx-svg');
    if (svg) IX.drag(svg, { W: SX_W, H: SX_H, onMove: sxDragNode, onRemove: sxPickNode });
  }
  function runSearch() {
    const out = document.getElementById('sx-output');
    if (!out) return;
    IX.stop('sx');
    const gTxt = document.getElementById('sx-graph').value;
    const hTxt = document.getElementById('sx-heur').value;
    const start = document.getElementById('sx-start').value.trim().toUpperCase();
    const goal = document.getElementById('sx-goal').value.trim().toUpperCase();
    const alg = document.getElementById('sx-alg').value;
    const G = sxParseGraph(gTxt), H = sxParseHeur(hTxt);
    let head = '';
    const errs = G.errs.concat(H.errs);
    if (errs.length) head += `<div class="verdict bad">${errs.map(esc).join('<br>')}</div>`;
    if (!G.order.length) { out.innerHTML = head + '<div class="tool-error">No edges to search.</div>'; return; }
    if (!G.adj[start]) { out.innerHTML = head + `<div class="tool-error">Start node "${esc(start)}" is not in the graph.</div>`; return; }
    if (!G.adj[goal]) { out.innerHTML = head + `<div class="tool-error">Goal node "${esc(goal)}" is not in the graph.</div>`; return; }
    if (G.order.length > 40) { out.innerHTML = head + '<div class="tool-error">Forty nodes at most for the canvas.</div>'; return; }
    if ((alg === 'greedy' || alg === 'astar')) {
      const missing = G.order.filter(n => typeof H.h[n] !== 'number');
      if (missing.length) head += `<div class="verdict warn">No heuristic given for ${missing.map(esc).join(', ')} — treating those as <code>h = 0</code>.</div>`;
    }
    const sameGraph = SX.G && SX.G.order.length === G.order.length && SX.G.order.every(v => G.adj[v]);
    SX.G = G; SX.H = H.h; SX.start = start; SX.goal = goal; SX.alg = alg; SX.frame = 0;
    sxLayout(G.order, G.adj, !sameGraph);
    sxCompute();
    sxRender();
    if (head) out.innerHTML = head + out.innerHTML;
  }
  TOOL_RUNNERS.runSearch = runSearch;
  /* ---------- W1: true cheapest cost to the goal (Dijkstra, undirected) ---------- */
  function adTrueCosts(adj, goal) {
    const dist = {}; dist[goal] = 0;
    const done = {};
    for (;;) {
      let best = null;
      Object.keys(dist).forEach(n => { if (!done[n] && (best === null || dist[n] < dist[best])) best = n; });
      if (best === null) break;
      done[best] = true;
      (adj[best] || []).forEach(e => {
        const d = dist[best] + e.cost;
        if (!(e.to in dist) || d < dist[e.to]) dist[e.to] = d;
      });
    }
    return dist;
  }
  /* ---------- W1: race all five algorithms, step in lock-step ---------- */
  const CA = { frame: 0, rows: [], max: 0 };
  function caStep(d, fromSlider) {
    const total = CA.max + 1;
    if (d === 'play') { IX.play('ca', total, () => CA.frame, f => { CA.frame = f; caRender(); }, 550); caRender(); return; }
    IX.stop('ca');
    if (d === 'first') CA.frame = 0;
    else if (d === 'last') CA.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) CA.frame = d;
    else CA.frame = Math.max(0, Math.min(total - 1, CA.frame + d));
    caRender();
  }
  function caRender() {
    const out = document.getElementById('ca-output');
    if (!out || !CA.rows.length) return;
    const found = CA.rows.filter(x => x.r.found);
    const best = found.length ? Math.min.apply(null, found.map(x => x.r.cost)) : null;
    const worst = found.length ? Math.max.apply(null, found.map(x => x.r.cost)) : null;
    const fewestActs = found.length ? Math.min.apply(null, found.map(x => x.r.actions)) : null;
    const fewestExp = found.length ? Math.min.apply(null, found.map(x => x.r.expansions)) : null;
    let html = `<div class="verdict safe">${esc(CA.start)} → ${esc(CA.goal)} &nbsp;·&nbsp; all five algorithms on the same graph, stepped together.</div>`;
    // the race
    html += '<div class="chartbox"><div style="font-family:\'IBM Plex Mono\',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--ink-muted); margin-bottom:10px;">expansion order · step ' + CA.frame + '</div>';
    CA.rows.forEach(x => {
      const ord = x.r.order || [];
      const done = CA.frame >= ord.length;
      html += `<div class="fitrow" style="grid-template-columns:150px 1fr;">
        <div><strong style="color:${done && x.r.found ? 'var(--accent-3)' : 'var(--ink)'};">${esc(SX_ALG_NAME[x.a])}</strong>
          <span style="color:var(--ink-muted); font-size:10.5px;">${x.r.found ? (done ? 'cost ' + x.r.cost : ord.length + ' pops') : 'no path'}</span></div>
        <div class="expand-order" style="margin:0;">`
        + ord.map((o, i) => `<span class="eo ${o.goal && i < CA.frame ? 'goalhit' : ''}" style="${i < CA.frame ? '' : 'opacity:.5;'} ${i === CA.frame - 1 ? 'outline:2px solid var(--accent-2);' : ''}">${esc(o.state)}</span>`).join('')
        + (done && x.r.found ? '<span class="eo goalhit">✓</span>' : '')
        + '</div></div>';
    });
    html += '</div>';
    html += IX.player('ca', CA.frame, CA.max + 1, `step <strong>${CA.frame}</strong> of ${CA.max}`, null);
    html += `<p class="ix-hint">Every algorithm pops one node per step. <strong>Press ▶</strong> and watch A* walk almost straight at the goal
      while UCS fans out in every direction — the gap between the two rows <em>is</em> what the heuristic buys you.</p>`;
    html += `<table class="cmp-table"><tr><th>Algorithm</th><th>f(n)</th><th>Path</th><th>Cost</th><th>Actions</th><th>Expanded</th></tr>`;
    CA.rows.forEach(x => {
      const r = x.r;
      html += '<tr><td><strong>' + esc(SX_ALG_NAME[x.a]) + '</strong></td>' + `<td><code>${esc(SX_ALG_F[x.a])}</code></td>`;
      if (!r.found) { html += '<td colspan="4"><em>no path found</em></td></tr>'; return; }
      html += `<td style="font-family:'IBM Plex Mono',monospace; font-size:12px;">${sxPath(r.path)}</td>`
        + `<td class="${r.cost === best ? 'best' : (found.length > 1 && r.cost === worst ? 'worst' : '')}">${r.cost}</td>`
        + `<td class="${r.actions === fewestActs ? 'best' : ''}">${r.actions}</td>`
        + `<td class="${r.expansions === fewestExp ? 'best' : ''}">${r.expansions}</td></tr>`;
    });
    html += '</table>';
    const get = a => CA.rows.filter(x => x.a === a)[0].r;
    const ucs = get('ucs'), ast = get('astar'), grd = get('greedy'), bfs = get('bfs');
    const notes = [];
    if (ucs.found && ast.found) {
      if (ucs.cost === ast.cost) notes.push(`UCS and A* both return cost <strong>${ucs.cost}</strong> — as they must, when the heuristic is admissible. A* got there by expanding <strong>${ast.expansions}</strong> nodes instead of <strong>${ucs.expansions}</strong>; that saving is the whole value of the heuristic.`);
      else notes.push(`A* returned <strong>${ast.cost}</strong> but UCS returned <strong>${ucs.cost}</strong>. UCS is always optimal, so a cheaper UCS answer means the heuristic <strong>over-estimates somewhere</strong> — it is not admissible. Run the admissibility checker.`);
    }
    if (grd.found && ucs.found && grd.cost > ucs.cost) notes.push(`Greedy returned <strong>${grd.cost}</strong> against the optimal <strong>${ucs.cost}</strong> — it ignores <code>g</code>, so it has no idea what the route has already cost.`);
    if (bfs.found && ucs.found && bfs.cost !== ucs.cost) notes.push(`BFS found a route with <strong>${bfs.actions}</strong> action(s) costing <strong>${bfs.cost}</strong>, while UCS found <strong>${ucs.actions}</strong> action(s) costing <strong>${ucs.cost}</strong>. Fewest actions ≠ cheapest, unless every action costs the same.`);
    if (notes.length) html += '<div class="verdict warn" style="margin-top:12px;">' + notes.join('<br><br>') + '</div>';
    out.innerHTML = html;
  }
  function runCompareAlgos() {
    const out = document.getElementById('ca-output');
    if (!out) return;
    IX.stop('ca');
    const gEl = document.getElementById('sx-graph'), hEl = document.getElementById('sx-heur');
    if (!gEl) { out.innerHTML = '<div class="tool-error">Search explorer not found on this page.</div>'; return; }
    const G = sxParseGraph(gEl.value), H = sxParseHeur(hEl ? hEl.value : '');
    const start = document.getElementById('ca-start').value.trim().toUpperCase();
    const goal = document.getElementById('ca-goal').value.trim().toUpperCase();
    if (!G.adj[start] || !G.adj[goal]) {
      out.innerHTML = `<div class="tool-error">Both "${esc(start)}" and "${esc(goal)}" must appear in the graph above.</div>`; return;
    }
    const algs = ['bfs', 'dfs', 'ucs', 'greedy', 'astar'];
    CA.rows = algs.map(a => ({ a: a, r: sxSearch(G.adj, H.h, start, goal, a, 2000) }));
    CA.start = start; CA.goal = goal;
    CA.max = Math.max.apply(null, CA.rows.map(x => (x.r.order || []).length));
    CA.frame = CA.max;
    caRender();
  }
  TOOL_RUNNERS.runCompareAlgos = runCompareAlgos;
  /* ---------- W1: admissibility, with a slider per node ---------- */
  const AD = { h: {}, dist: {}, G: null, goal: '' };
  function adSet(node, v) {
    AD.h[node] = Number(v);
    const el = document.getElementById('ad-heur');
    if (el) el.value = AD.G.order.map(n => n + ':' + (AD.h[n] === undefined ? 0 : AD.h[n])).join('  ');
    adRender();
  }
  function adReset(kind) {
    if (kind === 'zero') AD.G.order.forEach(n => AD.h[n] = 0);
    else if (kind === 'true') AD.G.order.forEach(n => AD.h[n] = (n in AD.dist) ? AD.dist[n] : 0);
    else if (kind === 'slides') {
      const S = { ARAD: 366, A: 329, B: 374, C: 380, D: 253, E: 193, F: 176, G: 100, H: 160, I: 244, L: 241, M: 242, BUCHAREST: 0 };
      AD.G.order.forEach(n => AD.h[n] = S[n] === undefined ? 0 : S[n]);
    }
    const el = document.getElementById('ad-heur');
    if (el) el.value = AD.G.order.map(n => n + ':' + (AD.h[n] === undefined ? 0 : AD.h[n])).join('  ');
    adRender();
  }
  function adRender() {
    const out = document.getElementById('ad-output');
    if (!out || !AD.G) return;
    const G = AD.G, dist = AD.dist, goal = AD.goal;
    const nodes = G.order.slice().sort();
    const bad = [];
    let slackSum = 0, slackN = 0, maxTrue = 1;
    nodes.forEach(n => { if ((n in dist) && dist[n] > maxTrue) maxTrue = dist[n]; });
    let html = '<table><tr><th>Node</th><th>h(n) — drag to change</th><th>true cost</th><th>verdict</th></tr>';
    nodes.forEach(n => {
      const h = typeof AD.h[n] === 'number' ? AD.h[n] : 0;
      const t = (n in dist) ? dist[n] : null;
      let v;
      if (t === null) v = '<em>unreachable — any h is vacuously fine</em>';
      else if (h > t) { v = `<strong style="color:var(--accent-2);">OVER-ESTIMATES by ${+(h - t).toFixed(2)}</strong>`; bad.push({ n: n, h: h, t: t }); }
      else { v = `ok (under by ${+(t - h).toFixed(2)})`; slackSum += (t - h); slackN++; }
      const cap = Math.ceil(maxTrue * 1.4 / 10) * 10;
      html += `<tr><td><strong>${esc(n)}</strong></td>
        <td style="min-width:190px;"><input type="range" min="0" max="${cap}" step="1" value="${h}"
             oninput="adSet('${esc(n)}', this.value)" style="width:120px; accent-color:${t !== null && h > t ? 'var(--accent-2)' : 'var(--accent)'};"
             aria-label="heuristic for ${esc(n)}">
          <span style="font-family:'IBM Plex Mono',monospace; font-size:12px; margin-left:6px;">${h}</span></td>
        <td>${t === null ? '∞' : t}</td><td>${v}</td></tr>`;
    });
    html += '</table>';
    html += `<div class="ix-bar">
      <span class="ix-lab">set every h to:</span>
      <button class="ix-btn" onclick="adReset('slides')">the lectures' values</button>
      <button class="ix-btn" onclick="adReset('zero')">0 (admissible, useless)</button>
      <button class="ix-btn" onclick="adReset('true')">the true cost (perfect)</button>
    </div>`;
    if (bad.length) {
      html += `<div class="verdict bad" style="margin-top:12px;"><strong>Not admissible.</strong>
        ${bad.length} node(s) over-estimate: ${bad.map(b => `<code>h(${esc(b.n)}) = ${b.h}</code> but the true cheapest cost is <strong>${b.t}</strong>`).join('; ')}.
        <br><br>A* is <strong>not guaranteed optimal</strong> with this heuristic.</div>`;
    } else {
      const avg = slackN ? +(slackSum / slackN).toFixed(1) : 0;
      html += `<div class="verdict safe" style="margin-top:12px;"><strong>Admissible.</strong>
        No node over-estimates, so <strong>A* with this heuristic is optimal</strong>.
        <br><br>Average under-estimate: <strong>${avg}</strong>. Smaller is more <em>informative</em> — the heuristic sits closer to
        the truth, so A* expands fewer nodes.</div>`;
    }
    /* the consequence, computed live */
    const startEl = document.getElementById('sx-start');
    const st = startEl && G.adj[startEl.value.trim().toUpperCase()] ? startEl.value.trim().toUpperCase() : G.order[0];
    const rA = sxSearch(G.adj, AD.h, st, goal, 'astar', 2000);
    const rU = sxSearch(G.adj, AD.h, st, goal, 'ucs', 2000);
    if (rA.found && rU.found) {
      const optimal = rA.cost === rU.cost;
      html += `<div class="verdict ${optimal ? 'warn' : 'bad'}" style="margin-top:10px;">
        <strong>What A* actually returns from ${esc(st)}, with these numbers:</strong>
        <code>${sxPath(rA.path)}</code> at cost <strong>${rA.cost}</strong>, expanding ${rA.expansions} nodes.
        The true optimum (UCS) is <strong>${rU.cost}</strong>.
        ${optimal ? ' They agree — as they must while the heuristic stays admissible.'
          : ' <strong>They disagree, so A* has returned a sub-optimal path.</strong> That is exactly what over-estimating costs you.'}
        <br><br><span style="font-size:12.5px;">Drag <code>h(G)</code> up past its true cost of ${dist.G === undefined ? '?' : dist.G} and watch this line flip.</span></div>`;
    }
    html += `<p style="font-size:12.5px; color:var(--ink-muted); margin-top:10px;">
      True costs come from running Dijkstra backwards from the goal, so they are exact.
      <strong>Admissible means h(n) ≤ true cost for every n</strong> — one violation anywhere is enough to void A*'s guarantee.</p>`;
    out.innerHTML = html;
  }
  function runAdmissible() {
    const out = document.getElementById('ad-output');
    if (!out) return;
    const gEl = document.getElementById('sx-graph');
    if (!gEl) { out.innerHTML = '<div class="tool-error">Search explorer not found on this page.</div>'; return; }
    const G = sxParseGraph(gEl.value);
    const H = sxParseHeur(document.getElementById('ad-heur').value);
    const goal = document.getElementById('ad-goal').value.trim().toUpperCase();
    if (!G.adj[goal]) { out.innerHTML = `<div class="tool-error">Goal "${esc(goal)}" is not in the graph above.</div>`; return; }
    let head = '';
    if (H.errs.length) head = `<div class="verdict bad">${H.errs.map(esc).join('<br>')}</div>`;
    AD.G = G; AD.goal = goal; AD.dist = adTrueCosts(G.adj, goal);
    AD.h = {};
    G.order.forEach(n => AD.h[n] = typeof H.h[n] === 'number' ? H.h[n] : 0);
    adRender();
    if (head) out.innerHTML = head + out.innerHTML;
  }
  TOOL_RUNNERS.runAdmissible = runAdmissible;
