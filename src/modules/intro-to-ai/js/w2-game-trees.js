  /* ============================================================
     W2 · GAME TREES — minimax and alpha-beta
     ============================================================ */
  function gtParse(text) {
    const s = String(text).replace(/\s+/g, '');
    if (!s) throw new Error('Nothing to parse.');
    let i = 0;
    function node() {
      if (s[i] === '[') {
        i++;
        const kids = [];
        if (s[i] === ']') throw new Error('empty "[]" at position ' + (i + 1) + ' — a node needs at least one child');
        for (;;) {
          kids.push(node());
          if (s[i] === ',') { i++; continue; }
          if (s[i] === ']') { i++; break; }
          throw new Error('expected "," or "]" at position ' + (i + 1));
        }
        return { kids: kids };
      }
      const m = /^-?\d+(?:\.\d+)?/.exec(s.slice(i));
      if (!m) throw new Error('expected a number or "[" at position ' + (i + 1));
      i += m[0].length;
      return { leaf: true, val: parseFloat(m[0]) };
    }
    const t = node();
    if (i < s.length) throw new Error('unexpected "' + s[i] + '" at position ' + (i + 1));
    if (t.leaf) throw new Error('the whole tree is a single number — wrap it in brackets, e.g. [3,12,8]');
    return t;
  }
  function gtLetter(i) { let s = ''; i++; while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); } return s; }
  function gtAnnotate(root, rootIsMax) {
    const leaves = [], internals = [];
    let maxDepth = 0;
    (function walk(n, d) {
      n.depth = d; n.isMax = rootIsMax ? (d % 2 === 0) : (d % 2 === 1);
      if (d > maxDepth) maxDepth = d;
      if (n.leaf) leaves.push(n); else { internals.push(n); n.kids.forEach(k => walk(k, d + 1)); }
    })(root, 0);
    const q = [root]; let c = 0;
    while (q.length) { const n = q.shift(); if (!n.leaf) { n.name = gtLetter(c++); n.kids.forEach(k => q.push(k)); } }
    return { leaves: leaves, internals: internals, maxDepth: maxDepth };
  }
  function gtMinimax(n) {
    if (n.leaf) { n.mm = n.val; return n.val; }
    let best = null;
    n.kids.forEach(k => { const v = gtMinimax(k); if (best === null || (n.isMax ? v > best : v < best)) best = v; });
    n.mm = best;
    for (let i = 0; i < n.kids.length; i++) if (n.kids[i].mm === best) { n.bestIdx = i; break; }
    return best;
  }
  function gtMarkPruned(n) { n.pruned = true; if (n.kids) n.kids.forEach(gtMarkPruned); }
  function gtAlphaBeta(root) {
    const trace = []; let evals = 0, visits = 0;
    function rec(n, a, b) {
      n.aIn = a; n.bIn = b; n.seen = true; visits++;
      if (n.leaf) { evals++; n.ab = n.val; n.step = trace.length; trace.push({ n: n, kind: 'leaf', a: a, b: b, v: n.val }); return n.val; }
      let v = n.isMax ? -Infinity : Infinity;
      n.cutAt = -1;
      for (let i = 0; i < n.kids.length; i++) {
        const cv = rec(n.kids[i], a, b);
        if (n.isMax) { if (cv > v) v = cv; if (v > a) a = v; }
        else { if (cv < v) v = cv; if (v < b) b = v; }
        n.aOut = a; n.bOut = b;
        trace.push({ n: n, kind: 'update', a: a, b: b, v: v, i: i, from: n.kids[i] });
        if (b <= a && i < n.kids.length - 1) {
          n.cutAt = i;
          for (let j = i + 1; j < n.kids.length; j++) { gtMarkPruned(n.kids[j]); (function mk(z) { z.step = trace.length; if (z.kids) z.kids.forEach(mk); })(n.kids[j]); }
          trace.push({ n: n, kind: 'cut', a: a, b: b, v: v, i: i });
          break;
        }
      }
      n.ab = v;
      n.step = trace.length;
      trace.push({ n: n, kind: 'done', a: a, b: b, v: v });
      return v;
    }
    rec(root, -Infinity, Infinity);
    return { trace: trace, evals: evals, visits: visits };
  }
  function gtNum(x) { return x === Infinity ? '+∞' : x === -Infinity ? '−∞' : String(x); }
  function gtSvg(root, info, useAB, upto) {
    const gap = 52, lh = 76, padL = 34, padT = 26;
    info.leaves.forEach((l, i) => { l.x = padL + i * gap; });
    (function pos(n) {
      if (n.leaf) return n.x;
      const xs = n.kids.map(pos);
      n.x = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
      return n.x;
    })(root);
    (function setY(n, d) { n.y = padT + d * lh; if (!n.leaf) n.kids.forEach(k => setY(k, d + 1)); })(root, 0);
    const W = padL * 2 + (info.leaves.length - 1) * gap + 40;
    const H = padT + info.maxDepth * lh + 56;
    let g = '';
    // edges
    (function edges(n) {
      if (n.leaf) return;
      n.kids.forEach((k, i) => {
        const dead = useAB && k.pruned;
        const on = !useAB && n.bestIdx === i;
        g += `<line x1="${n.x}" y1="${n.y + 13}" x2="${k.x}" y2="${k.y - 12}" stroke="${dead ? 'var(--rule)' : on ? 'var(--accent)' : 'var(--ink-muted)'}" stroke-width="${on ? 2.2 : 1}"${dead ? ' stroke-dasharray="3 3"' : ''}/>`;
        edges(k);
      });
    })(root);
    // nodes
    (function draw(n) {
      const future = upto !== undefined && (n.step === undefined || n.step > upto);
      const dead = useAB && n.pruned && !future;
      const op = future ? ' opacity="0.4"' : dead ? ' opacity="0.45"' : '';
      if (n.leaf) {
        if (future) {
          g += `<rect x="${n.x - 15}" y="${n.y - 11}" width="30" height="22" rx="3" fill="none" stroke="var(--rule)" stroke-dasharray="3 2"/>`;
          g += `<text x="${n.x}" y="${n.y + 5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11.5" fill="var(--ink-muted)" opacity="0.75">?</text>`;
          return;
        }
        if (dead) {
          g += `<text x="${n.x}" y="${n.y + 6}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="14" font-weight="700" fill="var(--accent-2)">✗</text>`;
          g += `<text x="${n.x}" y="${n.y + 20}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="var(--ink-muted)">${n.val}</text>`;
        } else {
          g += `<rect x="${n.x - 15}" y="${n.y - 11}" width="30" height="22" rx="3" fill="var(--surface-2)" stroke="var(--rule)"/>`;
          g += `<text x="${n.x}" y="${n.y + 5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11.5" fill="var(--ink)">${n.val}</text>`;
        }
        return;
      }
      const col = n.isMax ? 'var(--accent)' : 'var(--accent-2)';
      const fill = n.isMax ? 'var(--tint-a2)' : 'var(--tint-b2)';
      const tri = n.isMax ? `${n.x},${n.y - 13} ${n.x + 15},${n.y + 12} ${n.x - 15},${n.y + 12}`
        : `${n.x - 15},${n.y - 12} ${n.x + 15},${n.y - 12} ${n.x},${n.y + 13}`;
      g += `<polygon points="${tri}" fill="${fill}" stroke="${col}" stroke-width="1.4"${op}/>`;
      g += `<text x="${n.x}" y="${n.y + (n.isMax ? 8 : 2)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="${col}"${op}>${n.name}</text>`;
      const val = useAB ? n.ab : n.mm;
      if (val !== undefined && val !== null && !dead && !future) {
        const bound = useAB && n.cutAt >= 0 ? (n.isMax ? '≥' : '≤') : '';
        g += `<text x="${n.x + 19}" y="${n.y - 2}" font-family="IBM Plex Sans" font-size="12.5" font-weight="700" fill="${col}">${bound}${val}</text>`;
      }
      if (useAB && !dead && !future && n.aOut !== undefined) {
        g += `<text x="${n.x + 19}" y="${n.y + 11}" font-family="IBM Plex Mono, monospace" font-size="8.5" fill="var(--ink-muted)">α${gtNum(n.aOut)} β${gtNum(n.bOut)}</text>`;
      }
      n.kids.forEach(draw);
    })(root);
    g += `<text x="6" y="${padT + 4}" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)">${root.isMax ? 'MAX' : 'MIN'}</text>`;
    if (info.maxDepth >= 1) g += `<text x="6" y="${padT + lh + 4}" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)">${root.isMax ? 'MIN' : 'MAX'}</text>`;
    return `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img"><title>Game tree</title>${g}</svg>`;
  }
  /* step player over the alpha-beta walk */
  const GT = { frame: -1, total: 0 };
  function gtStep(d, fromSlider) {
    const total = GT.total;
    if (d === 'play') {
      IX.play('gt', total + 1, () => GT.frame + 1, f => { GT.frame = f - 1; runGameTree(true); }, 700);
      runGameTree(true); return;
    }
    IX.stop('gt');
    if (d === 'first') GT.frame = -1;
    else if (d === 'last') GT.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) GT.frame = d - 1;
    else GT.frame = Math.max(-1, Math.min(total - 1, GT.frame + d));
    runGameTree(true);
  }
  function runGameTree(keepFrame) {
    const out = document.getElementById('gt-output');
    if (!out) return;
    const txt = document.getElementById('gt-tree').value;
    const rootIsMax = document.getElementById('gt-root').value === 'max';
    const mode = document.getElementById('gt-mode').value;
    let html = '';
    let tree, info;
    if (!keepFrame) { IX.stop('gt'); GT.frame = -1; }
    try { tree = gtParse(txt); info = gtAnnotate(tree, rootIsMax); }
    catch (e) { out.innerHTML = `<div class="tool-error">Could not read the tree — ${esc(e.message)}</div>`; return; }
    if (info.leaves.length > 40) { out.innerHTML = '<div class="tool-error">That tree has more than 40 leaves — the picture would be unreadable. Try a smaller one.</div>'; return; }
    gtMinimax(tree);
    if (mode !== 'ab') {
      html += `<div class="verdict safe"><strong>Minimax value = ${tree.mm}</strong>`;
      if (tree.bestIdx !== undefined) html += ` &nbsp;·&nbsp; ${rootIsMax ? 'MAX' : 'MIN'} plays child <strong>#${tree.bestIdx + 1}</strong>`;
      html += ` &nbsp;·&nbsp; all <strong>${info.leaves.length}</strong> leaves evaluated</div>`;
      html += '<div class="diagram" style="margin:12px 0;">' + gtSvg(tree, info, false)
        + '<div class="caption">Every node labelled with its minimax value; the bold edge is the move that gets played.</div></div>';
      html += '<div class="qrow"><div class="qlab">node values</div><div class="frontier">'
        + info.internals.map(n => `<span class="chipq ${n === tree ? 'head' : ''}">${n.name}<span class="f">${n.isMax ? 'max' : 'min'}=${n.mm}</span></span>`).join('')
        + '</div></div>';
    }
    if (mode !== 'minimax') {
      const t2 = gtParse(txt), i2 = gtAnnotate(t2, rootIsMax);
      gtMinimax(t2);
      const R = gtAlphaBeta(t2);
      const pruned = i2.leaves.filter(l => l.pruned);
      html += `<div class="verdict ${t2.ab === tree.mm ? 'safe' : 'bad'}" style="margin-top:${mode === 'both' ? '18' : '0'}px;">
        <strong>Alpha-beta value = ${t2.ab}</strong> — ${t2.ab === tree.mm ? 'identical to minimax, as it must be' : 'MISMATCH (this is a bug, please report it)'}
        &nbsp;·&nbsp; leaves evaluated <strong>${R.evals}</strong> of ${i2.leaves.length}
        &nbsp;·&nbsp; pruned <strong>${pruned.length}</strong>${pruned.length ? ' (values ' + pruned.map(l => l.val).join(', ') + ' never looked at)' : ''}</div>`;
      GT.total = R.trace.filter(x => x.kind !== 'update').length;
      if (GT.frame > GT.total - 1) GT.frame = GT.total - 1;
      // map the visible-step counter onto raw trace indices
      const shown = [];
      R.trace.forEach((x, ix) => { if (x.kind !== 'update') shown.push(ix); });
      const upto = GT.frame < 0 ? -1 : shown[Math.min(GT.frame, shown.length - 1)];
      html += '<div class="diagram" style="margin:12px 0;">' + gtSvg(t2, i2, true, upto)
        + `<div class="caption">${GT.frame < 0 ? 'Nothing evaluated yet — press ▶ to walk the tree.' : 'Faded, dashed and ✗ = never evaluated. Ghosted nodes have not been reached yet at this step.'}</div></div>`;
      const cur = GT.frame < 0 ? null : R.trace[upto];
      html += IX.player('gt', GT.frame + 1, GT.total + 1,
        GT.frame < 0 ? 'before the walk starts' : `evaluation step <strong>${GT.frame + 1}</strong> of ${GT.total}`,
        cur ? (cur.kind === 'cut' ? ['update', 'β ≤ α — prune'] : cur.kind === 'leaf' ? ['assign', 'evaluate leaf'] : ['done', 'node settles']) : null);
      html += `<p class="ix-hint">Step through the depth-first walk one evaluation at a time. Watch <strong>α</strong> rise and <strong>β</strong> fall
        under each node, and the moment a cut fires the whole subtree to its right greys out and is never touched.</p>`;
      html += '<div style="margin-top:12px;"><table><tr><th>#</th><th>Node</th><th>Event</th><th>α</th><th>β</th><th>value</th></tr>';
      let k = 0;
      R.trace.forEach(s => {
        if (s.kind === 'update') return;
        k++;
        let ev, cls = '';
        if (s.kind === 'leaf') ev = `evaluate leaf <strong>${s.v}</strong>`;
        else if (s.kind === 'cut') { ev = `<strong style="color:var(--accent-2);">β ≤ α → prune</strong> — skip children after #${s.i + 1}`; cls = ' style="background:var(--tint-bad);"'; }
        else ev = `${s.n.isMax ? 'MAX' : 'MIN'} node <strong>${s.n.name}</strong> settles at <strong>${s.v}</strong>`;
        const label = s.kind === 'leaf' ? '<em>leaf</em>' : s.n.name;
        if (k === GT.frame + 1) cls = ' style="background:var(--tint-a2); font-weight:600;"';
        html += `<tr${cls}><td>${k}</td><td><strong>${label}</strong></td><td>${ev}</td><td><code>${gtNum(s.a)}</code></td><td><code>${gtNum(s.b)}</code></td><td><code>${gtNum(s.v)}</code></td></tr>`;
      });
      html += '</table></div>';
      if (mode === 'both') {
        const saved = i2.leaves.length - R.evals;
        html += `<div class="verdict warn" style="margin-top:12px;">Same answer either way — <strong>${tree.mm}</strong>. Alpha-beta got there while skipping <strong>${saved}</strong> of ${i2.leaves.length} leaves${saved === 0 ? '. With this ordering nothing could be cut; try putting the smallest leaf of each MIN group first.' : ' — that saving is entirely down to the order the children happen to be listed in.'}</div>`;
      }
    }
    out.innerHTML = html;
  }
  TOOL_RUNNERS.runGameTree = runGameTree;
