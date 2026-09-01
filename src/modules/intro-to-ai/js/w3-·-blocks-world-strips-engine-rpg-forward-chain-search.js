  /* ============================================================
     W3 · BLOCKS WORLD — STRIPS engine, RPG, forward-chain search
     ============================================================ */
  function bwBlocks(text) {
    const bs = String(text).toUpperCase().split(/[\s,]+/).filter(Boolean);
    const out = [], seen = {};
    bs.forEach(b => { if (b !== 'T' && !seen[b]) { seen[b] = 1; out.push(b); } });
    return out;
  }
  function bwFacts(text) {
    return String(text).toUpperCase().split(/[\s,]+/).filter(Boolean)
      .map(f => f.replace(/^ON/, 'on').replace(/^CLEAR/, 'clear'));
  }
  function bwActions(blocks) {
    const objs = ['T'].concat(blocks), acts = [];
    blocks.forEach(X => objs.forEach(Y => objs.forEach(Z => {
      if (Y === X || Z === X || Y === Z) return;
      const drop = f => f !== 'clearT';
      acts.push({
        name: X + ' to ' + Y + ' from ' + Z,
        pretty: 'Put ' + X + ' on ' + Y + ' from ' + Z,
        pre: ['clear' + X, 'on' + X + Z, 'clear' + Y].filter(drop),
        add: ['clear' + Z, 'on' + X + Y].filter(drop),
        del: ['on' + X + Z, 'clear' + Y].filter(drop)
      });
    })));
    return acts;
  }
  function bwValidate(blocks, facts) {
    const objs = ['T'].concat(blocks), errs = [];
    facts.forEach(f => {
      let m = f.match(/^on(.+)$/);
      if (m) {
        const s = m[1];
        let found = false;
        for (const X of blocks) for (const Y of objs) if (X + Y === s) found = true;
        if (!found) errs.push(`"on${s}" doesn't name a block and a destination — use e.g. onAB or onAT`);
        return;
      }
      m = f.match(/^clear(.+)$/);
      if (m) { if (blocks.indexOf(m[1]) < 0) errs.push(`"clear${m[1]}" — ${m[1]} is not one of the blocks`); return; }
      errs.push(`"${f}" is not a fact — use onXY or clearX`);
    });
    return errs;
  }
  function bwKey(set) { return Array.from(set).sort().join('|'); }
  function bwApply(set, a) {
    const s = new Set(set);
    a.del.forEach(f => s.delete(f));
    a.add.forEach(f => s.add(f));
    return s;
  }
  function bwApplicable(set, acts) { return acts.filter(a => a.pre.every(p => set.has(p))); }
  function bwDraw(set, blocks) {
    // reconstruct stacks for a nice picture; returns '' if the state isn't a well-formed tower set
    const on = {}, hasOn = {};
    let bad = false;
    blocks.forEach(X => {
      const ys = ['T'].concat(blocks).filter(Y => Y !== X && set.has('on' + X + Y));
      if (ys.length !== 1) bad = true; else { on[X] = ys[0]; hasOn[ys[0]] = (hasOn[ys[0]] || 0) + 1; }
    });
    if (bad) return '';
    for (const b of blocks) if (hasOn[b] > 1) return '';
    const bottoms = blocks.filter(b => on[b] === 'T');
    let html = '<div class="stack-row">';
    bottoms.forEach(b => {
      const col = [b];
      for (;;) { const up = blocks.filter(x => on[x] === col[col.length - 1]); if (!up.length) break; col.push(up[0]); }
      html += '<div class="blocks">' + col.slice().reverse().map(x => `<div class="blk">${x}</div>`).join('') + '</div>';
    });
    html += '</div><div class="tbl"></div>';
    return html;
  }
  function rpgBuild(blocks, init, goal, cap) {
    const acts = bwActions(blocks);
    const f = [new Set(init)];
    const a = [];
    const used = {};
    const MAX = cap || 40;
    for (let n = 0; n < MAX; n++) {
      if (goal.every(g => f[n].has(g))) return { f: f, a: a, acts: acts, found: true, m: n };
      const na = acts.filter(x => !used[x.name] && x.pre.every(p => f[n].has(p)));
      const nf = new Set(f[n]);
      na.forEach(x => x.add.forEach(y => nf.add(y)));
      if (nf.size === f[n].size) return { f: f, a: a, acts: acts, found: false, fixpoint: true };
      na.forEach(x => used[x.name] = 1);
      a.push(na); f.push(nf);
    }
    return { f: f, a: a, acts: acts, found: false, capped: true };
  }
  function rpgExtract(G, goal) {
    const m = G.m, g = [];
    for (let i = 0; i <= m; i++) g[i] = [];
    const inG = [];
    for (let i = 0; i <= m; i++) inG[i] = {};
    const addG = (i, x) => { if (!inG[i][x]) { inG[i][x] = 1; g[i].push(x); } };
    goal.forEach(x => addG(m, x));
    const chosen = [];
    for (let i = 0; i < m; i++) chosen[i] = [];
    for (let n = m; n >= 1; n--) {
      for (let k = 0; k < g[n].length; k++) {
        const fact = g[n][k];
        if (G.f[n - 1].has(fact)) { addG(n - 1, fact); continue; }
        let act = null;
        for (const x of G.a[n - 1]) if (x.add.indexOf(fact) >= 0) { act = x; break; }
        if (!act) continue;
        if (chosen[n - 1].indexOf(act) < 0) chosen[n - 1].push(act);
        act.pre.forEach(p => addG(n - 1, p));
      }
    }
    let h = 0; chosen.forEach(o => h += o.length);
    return { g: g, chosen: chosen, h: h, m: m };
  }
  function rpgH(blocks, stateSet, goal) {
    const G = rpgBuild(blocks, Array.from(stateSet), goal, 40);
    if (!G.found) return Infinity;
    return rpgExtract(G, goal).h;
  }
  /* ---------- W3: clickable block towers, shared by both planning tools ---------- */
  function bwStacks(set, blocks) {
    const on = {}, above = {};
    let bad = false;
    blocks.forEach(X => {
      const ys = ['T'].concat(blocks).filter(Y => Y !== X && set.has('on' + X + Y));
      if (ys.length !== 1) bad = true; else { on[X] = ys[0]; above[ys[0]] = (above[ys[0]] || 0) + 1; }
    });
    if (bad) return null;
    for (const b of blocks) if (above[b] > 1) return null;
    const cols = [];
    blocks.filter(b => on[b] === 'T').forEach(b => {
      const col = [b];
      for (;;) { const up = blocks.filter(x => on[x] === col[col.length - 1]); if (!up.length) break; col.push(up[0]); }
      cols.push(col);
    });
    return { cols: cols, on: on };
  }
  /* draw towers; every block and the table are click targets */
  function bwSvg(set, blocks, id, sel, W) {
    const S = bwStacks(set, blocks);
    const BW = W || 300, BH = 150, bw = 34, bh = 26, gap = 16;
    let g = '';
    if (!S) {
      g += `<text x="${BW / 2}" y="${BH / 2}" text-anchor="middle" font-family="IBM Plex Sans" font-size="12" fill="var(--accent-2)">not a well-formed set of towers</text>`;
    } else {
      const nCol = Math.max(1, S.cols.length);
      const totalW = nCol * bw + (nCol - 1) * gap;
      let x0 = (BW - totalW) / 2;
      const floor = BH - 24;
      g += `<rect data-ix="T" x="18" y="${floor}" width="${BW - 36}" height="7" rx="3" fill="var(--ink-muted)" class="grab"/>`;
      g += `<text x="${BW - 22}" y="${floor + 20}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)" pointer-events="none">table</text>`;
      S.cols.forEach((col, ci) => {
        const cx = x0 + ci * (bw + gap);
        col.forEach((b, bi) => {
          const y = floor - (bi + 1) * (bh + 2);
          const isSel = sel === b;
          g += `<rect class="grab" data-ix="${b}" x="${cx}" y="${y}" width="${bw}" height="${bh}" rx="4" `
            + `fill="${isSel ? 'var(--accent-2)' : 'var(--tint-b)'}" stroke="${isSel ? 'var(--accent-2)' : 'var(--accent-2)'}" stroke-width="${isSel ? 3 : 1.4}"/>`;
          g += `<text x="${cx + bw / 2}" y="${y + bh / 2 + 4.5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="13" `
            + `font-weight="700" fill="${isSel ? 'var(--paper)' : 'var(--accent-2)'}" pointer-events="none">${b}</text>`;
        });
      });
    }
    return `<svg id="${id}" class="hit" width="100%" viewBox="0 0 ${BW} ${BH}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + '<title>Blocks world</title><desc>Block towers; click a block to pick it up and click a destination to move it.</desc>' + g + '</svg>';
  }
  function bwMove(set, blocks, X, Y) {
    /* returns a new fact set with X moved onto Y, or null if illegal */
    if (X === Y || X === 'T') return null;
    if (!set.has('clear' + X)) return null;
    if (Y !== 'T' && !set.has('clear' + Y)) return null;
    let Z = null;
    ['T'].concat(blocks).forEach(z => { if (z !== X && set.has('on' + X + z)) Z = z; });
    if (Z === null || Z === Y) return null;
    const s = new Set(set);
    s.delete('on' + X + Z);
    if (Y !== 'T') s.delete('clear' + Y);
    if (Z !== 'T') s.add('clear' + Z);
    s.add('on' + X + Y);
    return s;
  }
  function bwFactsOf(set) { return Array.from(set).sort().join(' '); }
  /* ---------- RPG builder: layer-by-layer reveal + editable start state ---------- */
  const RP = { blocks: [], init: null, goal: [], G: null, E: null, frame: 0, sel: null };
  function rpSync() {
    const el = document.getElementById('rp-init');
    if (el) el.value = bwFactsOf(RP.init);
  }
  function rpCompute() {
    RP.G = rpgBuild(RP.blocks, Array.from(RP.init), RP.goal, 40);
    RP.E = RP.G.found ? rpgExtract(RP.G, RP.goal) : null;
    const total = RP.G.f.length + RP.G.a.length;
    if (RP.frame > total) RP.frame = total;
  }
  function rpClick(key) {
    if (RP.sel === null) { if (key !== 'T') RP.sel = key; rpRender(); return; }
    const moved = bwMove(RP.init, RP.blocks, RP.sel, key);
    RP.sel = null;
    if (moved) { RP.init = moved; RP.frame = 0; rpSync(); rpCompute(); }
    rpRender();
  }
  function rpStep(d, fromSlider) {
    const total = RP.G ? RP.G.f.length + RP.G.a.length : 1;
    if (d === 'play') { IX.play('rp', total, () => RP.frame, f => { RP.frame = f; rpRender(); }, 700); rpRender(); return; }
    IX.stop('rp');
    if (d === 'first') RP.frame = 0;
    else if (d === 'last') RP.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) RP.frame = d;
    else RP.frame = Math.max(0, Math.min(total - 1, RP.frame + d));
    rpRender();
  }
  function rpRender() {
    const out = document.getElementById('rp-output');
    if (!out) return;
    const G = RP.G, E = RP.E;
    let html = '';
    html += `<div class="ix-canvas" style="max-width:340px;">${bwSvg(RP.init, RP.blocks, 'rp-svg', RP.sel, 300)}</div>`;
    html += `<p class="ix-hint">${RP.sel ? '<strong style="color:var(--accent-2);">' + RP.sel + ' picked up</strong> — now click a destination (another block, or the table).' : '<strong>Click a block</strong> to pick it up, then click where to put it. The whole graph rebuilds instantly.'}
      Goal: <code>${RP.goal.map(esc).join(', ')}</code>.</p>`;
    if (!G.found) {
      html += `<div class="planline none">No relaxed plan exists — the graph reached a <strong>fixpoint</strong> at layer ${G.f.length - 1} without containing all the goals.
        Because the relaxation only ever <em>adds</em> facts, this proves <strong>no real plan exists either</strong>: <code>h = ∞</code>.</div>`;
      const missing = RP.goal.filter(x => !G.f[G.f.length - 1].has(x));
      html += `<div class="verdict bad">Unreachable even when deletes are ignored: ${missing.map(esc).join(', ')}</div>`;
      out.innerHTML = html;
      attachClicks('rp-svg', rpClick);
      return;
    }
    html += `<div class="planline"><strong>h(s) = ${E.h}</strong>
      &nbsp;·&nbsp; first fact layer containing all goals: <strong>f(${E.m})</strong>
      &nbsp;·&nbsp; ${E.m} action layer${E.m === 1 ? '' : 's'}, ${E.h} action${E.h === 1 ? '' : 's'} in total`;
    if (E.h) html += '<br><br><strong>Relaxed plan:</strong><br>' + E.chosen.map((o, i) => `O<sub>${i}</sub> = { ${o.map(a => esc(a.pretty)).join(' , ')} }`).join('<br>');
    else html += '<br><br>The goals already hold — this <em>is</em> a goal state.';
    html += '</div>';
    /* columns revealed up to RP.frame: 0 = f(0), 1 = a(1), 2 = f(1), … */
    const total = G.f.length + G.a.length;
    const allFacts = Array.from(G.f[G.f.length - 1]).sort();
    const chosenNames = {};
    if (E) E.chosen.forEach(o => o.forEach(a => chosenNames[a.name] = 1));
    let cols = '';
    let shown = 0;
    for (let n = 0; n < G.f.length; n++) {
      if (shown > RP.frame) break;
      const prev = n > 0 ? G.f[n - 1] : null;
      cols += `<div class="rpg-col fact"${shown === RP.frame ? ' style="outline:3px solid var(--accent);"' : ''}><h5>fact layer ${n}</h5>`;
      allFacts.forEach(f => {
        const on = G.f[n].has(f);
        const isNew = on && prev && !prev.has(f);
        const isGoal = RP.goal.indexOf(f) >= 0;
        cols += `<div class="rpg-f ${on ? (isNew ? 'new' : 'on') : ''} ${on && isGoal ? 'goal' : ''}">${esc(f)}${on ? ' <span style="opacity:.6;">{T}</span>' : ''}</div>`;
      });
      cols += '</div>';
      shown++;
      if (n < G.a.length) {
        if (shown > RP.frame) break;
        cols += `<div class="rpg-col act"${shown === RP.frame ? ' style="outline:3px solid var(--accent);"' : ''}><h5>action layer ${n + 1}</h5>`;
        G.a[n].forEach(a => { cols += `<div class="rpg-a ${chosenNames[a.name] ? 'chosen' : ''}">${esc(a.name)}</div>`; });
        cols += '</div>';
        shown++;
      }
    }
    html += '<h3 style="margin-top:14px;">The graph — revealed one layer at a time</h3><div class="rpg-wrap">' + cols + '</div>';
    const kind = RP.frame % 2 === 0 ? 'fact layer ' + (RP.frame / 2) : 'action layer ' + ((RP.frame + 1) / 2);
    html += IX.player('rp', RP.frame, total, `showing up to <strong>${kind}</strong>`,
      RP.frame % 2 === 0 ? ['assign', 'facts'] : ['update', 'applicable actions']);
    html += `<p style="font-size:12.5px; color:var(--ink-muted);">
      Green = the fact is <strong>new</strong> in this layer · outlined = a goal fact · orange actions are the ones the extraction chose.
      Watch which fact unlocks the next action layer.</p>`;
    html += '<h3 style="margin-top:18px;">Backwards extraction</h3><table><tr><th>Layer</th><th>Goals g(n)</th><th>Actions chosen from a(n)</th></tr>';
    for (let n = E.m; n >= 0; n--) {
      html += `<tr><td><strong>g(${n})</strong></td>
        <td style="font-family:'IBM Plex Mono',monospace; font-size:12px;">${E.g[n].map(esc).join(', ') || '—'}</td>
        <td style="font-family:'IBM Plex Mono',monospace; font-size:12px;">${n >= 1 ? (E.chosen[n - 1].map(a => esc(a.pretty)).join('<br>') || '—') : '<em>start — all facts hold in the initial state</em>'}</td></tr>`;
    }
    html += '</table>';
    html += `<p style="font-size:12.5px; color:var(--ink-muted);">
      A fact already present in f(n−1) drops straight down to g(n−1); otherwise an action from a(n) is chosen and
      <strong>its preconditions</strong> become part of g(n−1). <code>h = Σ |O<sub>i</sub>|</code> — the number of
      <em>actions</em>, not the number of layers.</p>`;
    out.innerHTML = html;
    attachClicks('rp-svg', rpClick);
  }
  /* plain click-to-select on an SVG (no dragging) */
  function attachClicks(id, fn) {
    const svg = document.getElementById(id);
    if (!svg) return;
    svg.addEventListener('mousedown', function (ev) {
      const k = ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-ix') : null;
      if (k !== null) { ev.preventDefault(); fn(k); }
    });
    svg.addEventListener('touchstart', function (ev) {
      const k = ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-ix') : null;
      if (k !== null) { ev.preventDefault(); fn(k); }
    }, { passive: false });
  }
  function runRPG() {
    const out = document.getElementById('rp-output');
    if (!out) return;
    IX.stop('rp');
    const blocks = bwBlocks(document.getElementById('rp-blocks').value);
    const init = bwFacts(document.getElementById('rp-init').value);
    const goal = bwFacts(document.getElementById('rp-goal').value);
    if (!blocks.length) { out.innerHTML = '<div class="tool-error">Name at least one block. T is reserved for the table.</div>'; return; }
    if (blocks.length > 5) { out.innerHTML = '<div class="tool-error">Five blocks is the sensible maximum — beyond that the graph is too wide to read.</div>'; return; }
    const errs = bwValidate(blocks, init).concat(bwValidate(blocks, goal));
    if (errs.length) { out.innerHTML = `<div class="tool-error">${errs.map(esc).join('<br>')}</div>`; return; }
    if (!goal.length) { out.innerHTML = '<div class="tool-error">Give at least one goal fact.</div>'; return; }
    RP.blocks = blocks; RP.init = new Set(init); RP.goal = goal; RP.frame = 0; RP.sel = null;
    rpCompute();
    RP.frame = RP.G.f.length + RP.G.a.length - 1;
    rpRender();
  }
  TOOL_RUNNERS.runRPG = runRPG;
  function bwSearch(blocks, init, goal, useH, limit) {
    const acts = bwActions(blocks);
    const start = new Set(init);
    const root = { set: start, parent: null, act: null, g: 0 };
    const seen = {}; seen[bwKey(start)] = 0;
    let frontier = [root], expansions = 0, generated = 1, seq = 0;
    root.seq = seq++;
    root.h = useH ? rpgH(blocks, start, goal) : 0;
    const LIM = limit || 8000;
    while (frontier.length) {
      if (expansions >= LIM) return { found: false, capped: true, expansions: expansions, generated: generated };
      let bi = 0;
      for (let i = 1; i < frontier.length; i++) {
        const fa = frontier[i].g + frontier[i].h, fb = frontier[bi].g + frontier[bi].h;
        if (fa < fb || (fa === fb && frontier[i].seq < frontier[bi].seq)) bi = i;
      }
      const node = frontier[bi];
      frontier.splice(bi, 1);
      expansions++;
      if (goal.every(x => node.set.has(x))) {
        const plan = []; let c = node;
        while (c && c.act) { plan.unshift(c.act); c = c.parent; }
        return { found: true, plan: plan, expansions: expansions, generated: generated };
      }
      bwApplicable(node.set, acts).forEach(a => {
        const s2 = bwApply(node.set, a), k = bwKey(s2);
        if (Object.prototype.hasOwnProperty.call(seen, k) && seen[k] <= node.g + 1) return;
        seen[k] = node.g + 1;
        generated++;
        const kid = { set: s2, parent: node, act: a, g: node.g + 1, seq: seq++ };
        kid.h = useH ? rpgH(blocks, s2, goal) : 0;
        if (kid.h === Infinity) return;
        frontier.push(kid);
      });
    }
    return { found: false, expansions: expansions, generated: generated };
  }
  /* ---------- Forward-chain planner: walk the plan, towers and all ---------- */
  const PL = { blocks: [], init: null, goal: [], res: null, frame: 0, sel: null, mode: 'astar' };
  function plSync() { const el = document.getElementById('pl-init'); if (el) el.value = bwFactsOf(PL.init); }
  function plClick(key) {
    if (PL.sel === null) { if (key !== 'T') PL.sel = key; plRender(); return; }
    const moved = bwMove(PL.init, PL.blocks, PL.sel, key);
    PL.sel = null;
    if (moved) { PL.init = moved; PL.frame = 0; plSync(); plCompute(); }
    plRender();
  }
  function plCompute() {
    PL.mode = document.getElementById('pl-mode').value;
    const useH = PL.mode !== 'bfs';
    if (PL.mode === 'expand') { PL.res = null; return; }
    PL.res = bwSearch(PL.blocks, Array.from(PL.init), PL.goal, useH, 8000);
    if (PL.mode === 'both') PL.res2 = bwSearch(PL.blocks, Array.from(PL.init), PL.goal, false, 8000);
    else PL.res2 = null;
    if (PL.res && PL.res.found && PL.frame > PL.res.plan.length) PL.frame = PL.res.plan.length;
  }
  function plStep(d, fromSlider) {
    const total = PL.res && PL.res.found ? PL.res.plan.length + 1 : 1;
    if (d === 'play') { IX.play('pl', total, () => PL.frame, f => { PL.frame = f; plRender(); }, 800); plRender(); return; }
    IX.stop('pl');
    if (d === 'first') PL.frame = 0;
    else if (d === 'last') PL.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) PL.frame = d;
    else PL.frame = Math.max(0, Math.min(total - 1, PL.frame + d));
    plRender();
  }
  function plMode(m) { document.getElementById('pl-mode').value = m; IX.stop('pl'); PL.frame = 0; plCompute(); plRender(); }
  function plStateAt(k) {
    let s = new Set(PL.init);
    if (!PL.res || !PL.res.found) return s;
    for (let i = 0; i < k && i < PL.res.plan.length; i++) {
      const a = PL.res.plan[i];
      a.del.forEach(f => s.delete(f));
      a.add.forEach(f => s.add(f));
    }
    return s;
  }
  function plRender() {
    const out = document.getElementById('pl-output');
    if (!out) return;
    const acts = bwActions(PL.blocks);
    let html = '';
    const mode = PL.mode;
    html += `<div class="ix-bar"><span class="ix-lab">mode:</span>
      ${[['expand', 'expand one step'], ['bfs', 'BFS'], ['astar', 'A* with RPG h'], ['both', 'compare']].map(m =>
        `<button class="ix-btn ${mode === m[0] ? 'on' : ''}" onclick="plMode('${m[0]}')">${m[1]}</button>`).join('')}</div>`;
    const cur = mode === 'expand' ? new Set(PL.init) : plStateAt(PL.frame);
    html += '<div class="compare-2" style="align-items:start;">';
    html += `<div class="ix-canvas">${bwSvg(cur, PL.blocks, 'pl-svg', PL.sel, 300)}
      <div style="text-align:center; font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--ink-muted);">${mode === 'expand' || PL.frame === 0 ? 'initial state — click to edit' : 'after ' + PL.frame + ' action' + (PL.frame === 1 ? '' : 's')}</div></div>`;
    html += `<div class="ix-canvas">${bwSvg(new Set(PL.goal.concat(PL.blocks.map(b => 'clear' + b)).filter((f, i, a) => true)), PL.blocks, 'pl-goal-svg', null, 300)}
      <div style="text-align:center; font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--ink-muted);">goal · <code>${PL.goal.map(esc).join(', ')}</code></div></div>`;
    html += '</div>';
    html += `<p class="ix-hint">${PL.sel ? '<strong style="color:var(--accent-2);">' + PL.sel + ' picked up</strong> — click a destination.' : '<strong>Click a block</strong> on the left to pick it up, then click where to put it — the planner re-solves from your new start state.'}</p>`;
    if (mode === 'expand') {
      const app = bwApplicable(cur, acts);
      html += `<div class="verdict safe"><strong>${app.length}</strong> action${app.length === 1 ? ' is' : 's are'} applicable here
        (of ${acts.length} ground actions), so forward chaining generates ${app.length} successor state${app.length === 1 ? '' : 's'}.</div>`;
      if (!app.length) { html += '<div class="planline none">Dead end — no action has its preconditions satisfied.</div>'; out.innerHTML = html; attachClicks('pl-svg', plClick); return; }
      html += '<table><tr><th>Action</th><th>Preconditions</th><th>S′ = S − del + add</th><th>h<sub>RPG</sub></th></tr>';
      app.forEach(a => {
        const s2 = bwApply(cur, a), h = rpgH(PL.blocks, s2, PL.goal), isGoal = PL.goal.every(x => s2.has(x));
        html += `<tr><td><strong>${esc(a.pretty)}</strong></td>
          <td style="font-family:'IBM Plex Mono',monospace; font-size:11.5px;">${a.pre.map(esc).join('<br>')}</td>
          <td style="font-family:'IBM Plex Mono',monospace; font-size:11.5px;">
            <span style="color:var(--accent-2);">− ${a.del.map(esc).join(', ')}</span><br>
            <span style="color:var(--accent-3);">+ ${a.add.map(esc).join(', ')}</span></td>
          <td style="text-align:center;"><strong style="color:${isGoal ? 'var(--accent-3)' : 'var(--accent)'};">${h === Infinity ? '∞' : h}</strong>${isGoal ? '<br><span style="font-size:10px; color:var(--accent-3);">GOAL</span>' : ''}</td></tr>`;
      });
      html += '</table><p style="font-size:12.5px; color:var(--ink-muted);">The last column is what A* uses to choose — each value costs a full RPG construction.</p>';
      out.innerHTML = html; attachClicks('pl-svg', plClick); return;
    }
    const R = PL.res;
    if (!R || !R.found) {
      html += `<div class="planline none">${R && R.capped ? 'Gave up after 8000 expansions.' : 'No plan exists from this state.'}</div>`;
      out.innerHTML = html; attachClicks('pl-svg', plClick); return;
    }
    html += `<div class="verdict safe"><strong>${mode === 'bfs' ? 'Breadth-first (h = 0)' : 'A* with the RPG heuristic'}</strong>
      &nbsp;·&nbsp; ${R.plan.length} action${R.plan.length === 1 ? '' : 's'}
      &nbsp;·&nbsp; states expanded <strong>${R.expansions}</strong> &nbsp;·&nbsp; generated <strong>${R.generated}</strong></div>`;
    html += '<div class="planline">' + R.plan.map((a, i) =>
      `<span style="${i < PL.frame ? 'color:var(--accent-3); font-weight:600;' : 'opacity:.62;'} cursor:pointer;" onclick="plStep(${i + 1}, true)">${i + 1}. ${esc(a.pretty)}</span>`).join('<br>') + '</div>';
    const done = PL.frame >= R.plan.length;
    html += IX.player('pl', PL.frame, R.plan.length + 1,
      PL.frame === 0 ? 'initial state' : `after action <strong>${PL.frame}</strong> — ${esc(R.plan[PL.frame - 1].pretty)}`,
      done ? ['done', 'goal reached'] : ['update', 'executing']);
    if (PL.frame > 0) {
      const a = R.plan[PL.frame - 1];
      html += `<div class="kmstep"><h5>${esc(a.pretty)}</h5>
        <div style="font-family:'IBM Plex Mono',monospace; font-size:12px; line-height:1.9;">
          pre: ${a.pre.map(esc).join(', ')}<br>
          <span style="color:var(--accent-2);">− ${a.del.map(esc).join(', ')}</span><br>
          <span style="color:var(--accent-3);">+ ${a.add.map(esc).join(', ')}</span><br>
          <span style="color:var(--ink-muted);">= ${Array.from(plStateAt(PL.frame)).sort().map(esc).join(', ')}</span></div></div>`;
    }
    if (mode === 'both' && PL.res2 && PL.res2.found) {
      html += `<div class="verdict warn">Both find a <strong>${R.plan.length}</strong>-action plan — the heuristic does not change the answer, only the effort.
        BFS expanded <strong>${PL.res2.expansions}</strong> states; A* with the RPG expanded <strong>${R.expansions}</strong>.
        ${R.expansions < PL.res2.expansions ? 'That ratio is what the heuristic buys, and it grows fast with the number of blocks.' : 'On a problem this small there is little to save — add a fourth block.'}</div>`;
    }
    out.innerHTML = html;
    attachClicks('pl-svg', plClick);
  }
  function runPlanner() {
    const out = document.getElementById('pl-output');
    if (!out) return;
    IX.stop('pl');
    const blocks = bwBlocks(document.getElementById('pl-blocks').value);
    const init = bwFacts(document.getElementById('pl-init').value);
    const goal = bwFacts(document.getElementById('pl-goal').value);
    if (!blocks.length) { out.innerHTML = '<div class="tool-error">Name at least one block.</div>'; return; }
    if (blocks.length > 5) { out.innerHTML = '<div class="tool-error">Five blocks maximum.</div>'; return; }
    const errs = bwValidate(blocks, init).concat(bwValidate(blocks, goal));
    if (errs.length) { out.innerHTML = `<div class="tool-error">${errs.map(esc).join('<br>')}</div>`; return; }
    PL.blocks = blocks; PL.init = new Set(init); PL.goal = goal; PL.frame = 0; PL.sel = null;
    plCompute();
    plRender();
  }
  TOOL_RUNNERS.runPlanner = runPlanner;
