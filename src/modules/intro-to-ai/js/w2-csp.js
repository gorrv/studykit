  /* ============================================================
     W2 · CSP — parsing, backtracking, forward checking, AC-3
     ============================================================ */
  function cspParse(varsText, consText) {
    const vars = [], dom = {}, cons = [], errs = [];
    String(varsText).split(/\n+/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line[0] === '#') return;
      const m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
      if (!m) { errs.push(`variables line ${i + 1}: expected  NAME : v1 v2 v3`); return; }
      const name = m[1].toUpperCase();
      if (dom[name]) { errs.push(`variable ${name} is declared twice`); return; }
      const vals = m[2].split(/[\s,]+/).filter(Boolean);
      if (!vals.length) { errs.push(`variable ${name} has an empty domain`); return; }
      vars.push(name); dom[name] = vals;
    });
    String(consText).split(/\n+/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line[0] === '#') return;
      const m = line.match(/^([A-Za-z0-9_]+)\s*(!=|<>|≠|==|=)\s*([A-Za-z0-9_]+)$/);
      if (!m) { errs.push(`constraints line ${i + 1}: expected  A != B  or  A = B`); return; }
      const a = m[1].toUpperCase(), b = m[3].toUpperCase();
      if (!dom[a]) { errs.push(`constraints line ${i + 1}: unknown variable ${a}`); return; }
      if (!dom[b]) { errs.push(`constraints line ${i + 1}: unknown variable ${b}`); return; }
      if (a === b) { errs.push(`constraints line ${i + 1}: ${a} constrained against itself`); return; }
      cons.push({ a: a, b: b, eq: (m[2] === '=' || m[2] === '==') });
    });
    const nbr = {}; vars.forEach(v => nbr[v] = []);
    cons.forEach(c => { nbr[c.a].push({ o: c.b, eq: c.eq }); nbr[c.b].push({ o: c.a, eq: c.eq }); });
    return { vars: vars, dom: dom, cons: cons, nbr: nbr, errs: errs };
  }
  function cspOk(eq, x, y) { return eq ? x === y : x !== y; }
  function cspCopy(d) { const o = {}; for (const k in d) o[k] = d[k].slice(); return o; }
  function cspFC(P, v, val, dom) {
    const removed = [];
    for (const n of P.nbr[v]) {
      if (dom[n.o].length === 1 && dom[n.o][0] === val && !n.eq) { /* fall through, will empty */ }
      const keep = dom[n.o].filter(x => cspOk(n.eq, x, val));
      if (keep.length !== dom[n.o].length) {
        dom[n.o].filter(x => !cspOk(n.eq, x, val)).forEach(x => removed.push(n.o + '=' + x));
        dom[n.o] = keep;
      }
      if (!dom[n.o].length) return { ok: false, wipe: n.o, removed: removed };
    }
    return { ok: true, removed: removed };
  }
  function cspAC3(P, dom, logArr, limit) {
    const queue = [];
    P.cons.forEach(c => { queue.push([c.a, c.b, c.eq]); queue.push([c.b, c.a, c.eq]); });
    let pops = 0;
    while (queue.length) {
      if (++pops > (limit || 4000)) return { ok: true, truncated: true };
      const arc = queue.shift(), xi = arc[0], xj = arc[1], eq = arc[2];
      const keep = dom[xi].filter(x => dom[xj].some(y => cspOk(eq, x, y)));
      if (keep.length !== dom[xi].length) {
        const gone = dom[xi].filter(x => keep.indexOf(x) < 0);
        dom[xi] = keep;
        const requeued = [];
        P.nbr[xi].forEach(n => { if (n.o !== xj) { queue.push([n.o, xi, n.eq]); requeued.push(n.o + '→' + xi); } });
        if (logArr) logArr.push({ xi: xi, xj: xj, removed: gone, requeued: requeued, empty: !keep.length });
        if (!keep.length) return { ok: false, wipe: xi };
      } else if (logArr && logArr.length < 90) {
        logArr.push({ xi: xi, xj: xj, removed: [], requeued: [] });
      }
    }
    return { ok: true };
  }
  function cspSolve(P, opts) {
    const steps = [];
    let assigns = 0, backtracks = 0, nodes = 0, stopped = false, wipeNote = null;
    const LIMIT = 30000, TRACECAP = 200;
    const deg = {}; P.vars.forEach(v => deg[v] = P.nbr[v].length);
    function push(o) { if (steps.length < TRACECAP) steps.push(o); }
    function snap(dom, assign) {
      const o = {};
      P.vars.forEach(v => o[v] = { d: dom[v].slice(), a: assign[v] !== undefined });
      return o;
    }
    function pickVar(un, dom, assign) {
      if (opts.varOrder === 'static') return un[0];
      let best = un[0];
      for (const v of un) {
        if (opts.varOrder === 'deg') {
          const dv = P.nbr[v].filter(n => assign[n.o] === undefined).length;
          const db = P.nbr[best].filter(n => assign[n.o] === undefined).length;
          if (dv > db) best = v;
        } else if (opts.varOrder === 'mrv') {
          if (dom[v].length < dom[best].length) best = v;
        } else {
          if (dom[v].length < dom[best].length) best = v;
          else if (dom[v].length === dom[best].length) {
            const dv = P.nbr[v].filter(n => assign[n.o] === undefined).length;
            const db = P.nbr[best].filter(n => assign[n.o] === undefined).length;
            if (dv > db) best = v;
          }
        }
      }
      return best;
    }
    function orderVals(v, dom, assign) {
      const vals = dom[v].slice();
      if (opts.valOrder !== 'lcv') return vals;
      const cost = {};
      vals.forEach(val => {
        let c = 0;
        P.nbr[v].forEach(n => { if (assign[n.o] === undefined) c += dom[n.o].filter(x => !cspOk(n.eq, x, val)).length; });
        cost[val] = c;
      });
      return vals.sort((x, y) => cost[x] - cost[y] || vals.indexOf(x) - vals.indexOf(y));
    }
    function consistent(v, val, assign) {
      for (const n of P.nbr[v]) if (assign[n.o] !== undefined && !cspOk(n.eq, assign[n.o], val)) return false;
      return true;
    }
    function rec(assign, dom) {
      if (++nodes > LIMIT) { stopped = true; return null; }
      const un = P.vars.filter(v => assign[v] === undefined);
      if (!un.length) return Object.assign({}, assign);
      const v = pickVar(un, dom, assign);
      const vals = orderVals(v, dom, assign);
      push({ kind: 'pick', v: v, vals: vals.slice(), dom: snap(dom, assign), depth: P.vars.length - un.length });
      for (const val of vals) {
        if (!consistent(v, val, assign)) {
          push({ kind: 'reject', v: v, val: val, dom: snap(dom, assign), depth: P.vars.length - un.length });
          continue;
        }
        assigns++;
        const a2 = Object.assign({}, assign); a2[v] = val;
        const d2 = cspCopy(dom); d2[v] = [val];
        let inf = { ok: true };
        if (opts.inf === 'fc') inf = cspFC(P, v, val, d2);
        else if (opts.inf === 'ac3') inf = cspAC3(P, d2, null);
        push({ kind: 'assign', v: v, val: val, dom: snap(d2, a2), ok: inf.ok, wipe: inf.wipe || null,
          depth: P.vars.length - un.length });
        if (inf.ok) { const r = rec(a2, d2); if (r) return r; }
        backtracks++;
        push({ kind: 'undo', v: v, val: val, dom: snap(dom, assign), depth: P.vars.length - un.length });
      }
      if (!wipeNote) wipeNote = v;
      return null;
    }
    const dom0 = {}; P.vars.forEach(v => dom0[v] = P.dom[v].slice());
    let pre = { ok: true };
    if (opts.inf === 'ac3') pre = cspAC3(P, dom0, null);
    const sol = pre.ok ? rec({}, dom0) : null;
    return { sol: sol, steps: steps, assigns: assigns, backtracks: backtracks, nodes: nodes,
      stopped: stopped, truncated: steps.length >= TRACECAP, wipeNote: wipeNote,
      preFail: !pre.ok ? pre.wipe : null };
  }
  function cspValClass(v) {
    const s = String(v).toLowerCase();
    if (s === 'red' || s === 'r') return 'v-red';
    if (s === 'green' || s === 'g') return 'v-green';
    if (s === 'blue' || s === 'b') return 'v-blue';
    return 'v-other';
  }
  function cspDomCell(full, cur, assigned) {
    if (!cur.length) return `<td class="wipeout"><span class="vbox">${full.map(x => `<span class="v ${cspValClass(x)} gone" title="${esc(x)}"></span>`).join('')}</span><span class="vlabel">empty</span></td>`;
    const inner = full.map(x => `<span class="v ${cspValClass(x)}${cur.indexOf(x) < 0 ? ' gone' : ''}" title="${esc(x)}"></span>`).join('');
    return `<td class="${assigned ? 'assigned' : ''}"><span class="vbox">${inner}</span></td>`;
  }
  function cspDomTable(P, rows) {
    let h = '<table class="dom-table"><tr><th class="steplab">step</th>' + P.vars.map(v => `<th>${esc(v)}</th>`).join('') + '</tr>';
    rows.forEach(r => {
      h += `<tr><td class="steplab">${r.label}</td>`;
      P.vars.forEach(v => { const c = r.dom[v]; h += cspDomCell(P.dom[v], c.d, c.a); });
      h += '</tr>';
    });
    return h + '</table>';
  }
  /* ---------- W2 CSP: constraint graph + backtracking step player ---------- */
  const CS = { P: null, res: null, frame: 0, pos: {}, W: 430, H: 300 };
  function csLayout(P, force) {
    if (!force) { let all = true; P.vars.forEach(v => { if (!CS.pos[v]) all = false; }); if (all) return; }
    const nb = {};
    P.vars.forEach(v => nb[v] = P.nbr[v].map(n => ({ to: n.o })));
    CS.pos = IX.layout(P.vars, nb, CS.W, CS.H);
  }
  function csCanvas() {
    const P = CS.P, R = CS.res;
    if (!P) return '';
    const st = CS.frame > 0 ? R.steps[CS.frame - 1] : null;
    const assign = {}, dom = {};
    P.vars.forEach(v => {
      const cell = st ? st.dom[v] : { d: P.dom[v].slice(), a: false };
      dom[v] = cell.d;
      if (cell.a) assign[v] = cell.d[0];
    });
    const focus = st ? st.v : null;
    let g = '';
    const drawn = {};
    P.cons.forEach(c => {
      const key = c.a < c.b ? c.a + '|' + c.b : c.b + '|' + c.a;
      if (drawn[key]) return; drawn[key] = 1;
      const A = CS.pos[c.a], B = CS.pos[c.b];
      if (!A || !B) return;
      const violated = assign[c.a] !== undefined && assign[c.b] !== undefined && !cspOk(c.eq, assign[c.a], assign[c.b]);
      g += `<line x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}" `
        + `stroke="${violated ? 'var(--accent-2)' : 'var(--ink-muted)'}" stroke-width="${violated ? 3 : 1.3}" opacity="${violated ? 1 : 0.6}"/>`;
    });
    P.vars.forEach(v => {
      const Q = CS.pos[v]; if (!Q) return;
      const a = assign[v], d = dom[v] || [];
      const empty = d.length === 0;
      const fill = a !== undefined ? cspSwatch(a) : empty ? 'var(--tint-bad)' : 'var(--surface-2)';
      g += `<circle class="grab" data-ix="${v}" cx="${Q.x.toFixed(1)}" cy="${Q.y.toFixed(1)}" r="19" fill="${fill}" `
        + `stroke="${v === focus ? 'var(--accent)' : empty ? 'var(--accent-2)' : 'var(--rule)'}" stroke-width="${v === focus ? 3.5 : empty ? 3 : 1.5}"/>`;
      g += `<text x="${Q.x.toFixed(1)}" y="${(Q.y + 4).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10.5" `
        + `fill="${a !== undefined ? 'var(--paper)' : 'var(--ink)'}" pointer-events="none">${esc(v)}</text>`;
      // remaining domain as dots underneath
      const full = P.dom[v];
      const dots = full.map((val, i) => {
        const alive = d.indexOf(val) >= 0;
        return `<circle cx="${(Q.x - (full.length - 1) * 5 + i * 10).toFixed(1)}" cy="${(Q.y + 29).toFixed(1)}" r="4" `
          + `fill="${cspSwatch(val)}" opacity="${alive ? 1 : 0.15}" stroke="${alive ? 'var(--rule)' : 'none'}" stroke-width="0.7"/>`;
      }).join('');
      g += dots;
    });
    return `<div class="ix-canvas"><svg id="cs-svg" class="hit" width="100%" viewBox="0 0 ${CS.W} ${CS.H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + '<title>Constraint graph</title><desc>Variables as nodes, constraints as edges. A filled node is assigned; the dots underneath are its remaining domain.</desc>'
      + g + '</svg></div>';
  }
  function cspSwatch(v) {
    const s = String(v).toLowerCase();
    if (s === 'red' || s === 'r') return 'var(--val-r)';
    if (s === 'green' || s === 'g') return 'var(--val-g)';
    if (s === 'blue' || s === 'b') return 'var(--val-b)';
    let hsh = 0; for (let i = 0; i < s.length; i++) hsh = (hsh * 31 + s.charCodeAt(i)) % 8;
    return 'var(--clu' + (hsh + 1) + ')';
  }
  function csDrag(px, py, key) {
    if (!CS.pos[key]) return;
    CS.pos[key] = { x: Math.max(24, Math.min(CS.W - 24, px)), y: Math.max(24, Math.min(CS.H - 34, py)) };
    csRender();
  }
  function csRelayout() { csLayout(CS.P, true); csRender(); }
  function csStep(d, fromSlider) {
    const total = CS.res.steps.length + 1;
    if (d === 'play') { IX.play('cs', total, () => CS.frame, f => { CS.frame = f; csRender(); }, 420); csRender(); return; }
    IX.stop('cs');
    if (d === 'first') CS.frame = 0;
    else if (d === 'last') CS.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) CS.frame = d;
    else CS.frame = Math.max(0, Math.min(total - 1, CS.frame + d));
    csRender();
  }
  function csOpt() { IX.stop('cs'); runCSP(); }
  function csRender() {
    const out = document.getElementById('cs-output');
    if (!out || !CS.P || !CS.res) return;
    const P = CS.P, R = CS.res;
    const opts = { varOrder: document.getElementById('cs-var').value,
      valOrder: document.getElementById('cs-val').value, inf: document.getElementById('cs-inf').value };
    const label = { static: 'static order', mrv: 'MRV', deg: 'degree', mrvdeg: 'MRV + degree tie-break' }[opts.varOrder]
      + ' · ' + (opts.valOrder === 'lcv' ? 'LCV' : 'static values')
      + ' · ' + { none: 'no inference', fc: 'forward checking', ac3: 'arc consistency' }[opts.inf];
    let html = `<div class="verdict ${R.sol ? 'safe' : 'bad'}"><strong>${label}</strong></div>`;
    if (R.sol) html += '<div class="csp-sol">' + P.vars.map(v => `<strong>${esc(v)}</strong> = ${esc(R.sol[v])}`).join(' &nbsp;·&nbsp; ') + '</div>';
    else if (R.stopped) html += '<div class="csp-sol none">Gave up after 30,000 nodes.</div>';
    else if (R.preFail) html += `<div class="csp-sol none">No solution — arc consistency emptied <strong>${esc(R.preFail)}</strong> before any assignment was made.</div>`;
    else html += `<div class="csp-sol none">No solution exists. Every value of every variable was tried and failed${R.wipeNote ? ' — the search bottomed out on <strong>' + esc(R.wipeNote) + '</strong>' : ''}.</div>`;
    html += `<div class="quiz-score" style="margin:12px 0;">
      <span class="stat-pill dark">${R.assigns} assignments</span>
      <span class="stat-pill a">${R.backtracks} backtracks</span>
      <span class="stat-pill b">${R.nodes} nodes</span></div>`;
    html += csCanvas();
    const st = CS.frame > 0 ? R.steps[CS.frame - 1] : null;
    let phase = null, lab = 'before the search starts';
    if (st) {
      lab = `step <strong>${CS.frame}</strong> of ${R.steps.length}`;
      phase = st.kind === 'assign' ? (st.ok ? ['update', esc(st.v) + ' = ' + esc(st.val)] : ['assign', esc(st.wipe || '') + ' wiped out'])
        : st.kind === 'pick' ? ['assign', 'choose ' + esc(st.v)]
          : st.kind === 'reject' ? ['assign', esc(st.v) + ' ≠ ' + esc(st.val)]
            : ['update', 'backtrack'];
      if (st.kind === 'assign' && !st.ok) phase = ['update', 'dead end'];
    }
    html += IX.player('cs', CS.frame, R.steps.length + 1, lab, phase);
    html += `<div class="ix-bar">
      <span class="ix-lab">variable order:</span>
      ${[['static', 'static'], ['mrv', 'MRV'], ['deg', 'degree'], ['mrvdeg', 'MRV+deg']].map(o =>
        `<button class="ix-btn ${opts.varOrder === o[0] ? 'on' : ''}" onclick="document.getElementById('cs-var').value='${o[0]}'; csOpt();">${o[1]}</button>`).join('')}
    </div>
    <div class="ix-bar">
      <span class="ix-lab">values:</span>
      ${[['static', 'static'], ['lcv', 'LCV']].map(o =>
        `<button class="ix-btn ${opts.valOrder === o[0] ? 'on' : ''}" onclick="document.getElementById('cs-val').value='${o[0]}'; csOpt();">${o[1]}</button>`).join('')}
      <span class="ix-lab">inference:</span>
      ${[['none', 'none'], ['fc', 'forward check'], ['ac3', 'AC-3']].map(o =>
        `<button class="ix-btn ${opts.inf === o[0] ? 'on' : ''}" onclick="document.getElementById('cs-inf').value='${o[0]}'; csOpt();">${o[1]}</button>`).join('')}
      <button class="ix-btn" onclick="csRelayout()">⤢ re-layout</button>
    </div>`;
    html += `<p class="ix-hint"><strong>Drag the variables</strong> to untangle the constraint graph · a filled node is assigned, the dots under it are
      what is left of its domain, and an edge turns <strong style="color:var(--accent-2);">orange</strong> the instant it is violated.
      The buttons re-solve immediately — flip inference from <em>none</em> to <em>AC-3</em> and watch the step count collapse.</p>`;
    if (st) {
      let d = '';
      if (st.kind === 'pick') d = `Choose <strong>${esc(st.v)}</strong> next; values to try, in order: <code>${st.vals.map(esc).join(', ')}</code>`;
      else if (st.kind === 'reject') d = `<span style="color:var(--accent-2);">${esc(st.v)} = ${esc(st.val)} clashes with an already-assigned neighbour — skip it without recursing.</span>`;
      else if (st.kind === 'assign') d = `Assign <strong>${esc(st.v)} = ${esc(st.val)}</strong>` + (st.ok ? ' and propagate.' : ` — but inference wipes out <strong style="color:var(--accent-2);">${esc(st.wipe || '')}</strong>, so this branch is dead.`);
      else d = `<span style="color:var(--ink-muted);">Undo ${esc(st.v)} = ${esc(st.val)} and back up.</span>`;
      html += `<div class="kmstep"><h5>Step ${CS.frame}</h5><div style="font-size:13px;">${d}</div>`;
      html += cspDomTable(P, [{ label: 'domains now', dom: st.dom }]);
      html += '</div>';
    }
    const rows = R.steps.map((s, i) => {
      let l;
      if (s.kind === 'pick') l = `pick <strong>${esc(s.v)}</strong>`;
      else if (s.kind === 'reject') l = `<span style="color:var(--accent-2);">${esc(s.v)}=${esc(s.val)} clashes</span>`;
      else if (s.kind === 'assign') l = `${esc(s.v)} = ${esc(s.val)}` + (s.ok ? '' : ` <span style="color:var(--accent-2);">→ ${esc(s.wipe || '')} empty</span>`);
      else l = `<span style="color:var(--ink-muted);">undo ${esc(s.v)}=${esc(s.val)}</span>`;
      return { label: `<span style="cursor:pointer;" onclick="csStep(${i + 1}, true)">` + '&nbsp;'.repeat(Math.max(0, s.depth) * 2) + l + '</span>', dom: s.dom, hot: i + 1 === CS.frame };
    });
    if (rows.length) {
      html += '<h3 style="margin-top:16px;">Whole search — click any row to jump there</h3>';
      html += cspDomTableHot(P, rows);
      if (R.truncated) html += '<p style="font-size:12.5px; color:var(--ink-muted);">Trace cut off at 200 steps — turn on inference to shorten the search.</p>';
    }
    html += `<p style="font-size:12.5px; color:var(--ink-muted); margin-top:10px;">
      Faded squares are values removed from a domain; a shaded cell is an assigned variable.</p>`;
    out.innerHTML = html;
    const svg = document.getElementById('cs-svg');
    if (svg) IX.drag(svg, { W: CS.W, H: CS.H, onMove: csDrag });
  }
  function cspDomTableHot(P, rows) {
    let h = '<table class="dom-table"><tr><th class="steplab">step</th>' + P.vars.map(v => `<th>${esc(v)}</th>`).join('') + '</tr>';
    rows.forEach(r => {
      h += `<tr${r.hot ? ' style="outline:2px solid var(--accent);"' : ''}><td class="steplab">${r.label}</td>`;
      P.vars.forEach(v => { const c = r.dom[v]; h += cspDomCell(P.dom[v], c.d, c.a); });
      h += '</tr>';
    });
    return h + '</table>';
  }
  function runCSP() {
    const out = document.getElementById('cs-output');
    if (!out) return;
    IX.stop('cs');
    const P = cspParse(document.getElementById('cs-vars').value, document.getElementById('cs-cons').value);
    let head = '';
    if (P.errs.length) head += `<div class="verdict bad">${P.errs.map(esc).join('<br>')}</div>`;
    if (!P.vars.length) { out.innerHTML = head + '<div class="tool-error">No variables to solve.</div>'; return; }
    if (P.vars.length > 25) { out.innerHTML = head + '<div class="tool-error">More than 25 variables — the domain table would be unreadable.</div>'; return; }
    const opts = { varOrder: document.getElementById('cs-var').value,
      valOrder: document.getElementById('cs-val').value, inf: document.getElementById('cs-inf').value };
    const same = CS.P && CS.P.vars.join() === P.vars.join();
    CS.P = P;
    CS.res = cspSolve(P, opts);
    CS.frame = 0;
    csLayout(P, !same);
    csRender();
    if (head) out.innerHTML = head + out.innerHTML;
  }
  TOOL_RUNNERS.runCSP = runCSP;
  /* ---------- W2: FC vs AC-3, arc by arc ---------- */
  const AC = { P: null, base: null, log: [], frame: 0, assign: {}, fcDom: null, fcOk: true, fcWipe: null, acR: null };
  function acStep(d, fromSlider) {
    const total = AC.log.length + 1;
    if (d === 'play') { IX.play('ac', total, () => AC.frame, f => { AC.frame = f; acRender(); }, 420); acRender(); return; }
    IX.stop('ac');
    if (d === 'first') AC.frame = 0;
    else if (d === 'last') AC.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) AC.frame = d;
    else AC.frame = Math.max(0, Math.min(total - 1, AC.frame + d));
    acRender();
  }
  function acToggle(v, val) {
    if (AC.assign[v] === val) delete AC.assign[v]; else AC.assign[v] = val;
    const el = document.getElementById('ac-assign');
    if (el) el.value = Object.keys(AC.assign).map(k => k + '=' + AC.assign[k]).join(', ');
    IX.stop('ac'); runAC3();
  }
  function acDomAt(frame) {
    const P = AC.P, dom = {};
    P.vars.forEach(v => dom[v] = AC.base[v].slice());
    for (let i = 0; i < frame && i < AC.log.length; i++) {
      const s = AC.log[i];
      if (s.removed.length) dom[s.xi] = dom[s.xi].filter(x => s.removed.indexOf(x) < 0);
    }
    return dom;
  }
  function acRender() {
    const out = document.getElementById('ac-output');
    if (!out || !AC.P) return;
    const P = AC.P;
    const snapFC = () => { const o = {}; P.vars.forEach(v => o[v] = { d: AC.fcDom[v].slice(), a: AC.assign[v] !== undefined }); return o; };
    const cur = acDomAt(AC.frame);
    const snapAC = () => { const o = {}; P.vars.forEach(v => o[v] = { d: cur[v].slice(), a: AC.assign[v] !== undefined }); return o; };
    let html = '';
    html += '<div class="ix-bar"><span class="ix-lab">click to assign / unassign:</span></div>';
    html += '<div class="chartbox" style="padding:10px 12px;">';
    P.vars.forEach(v => {
      html += `<div style="display:flex; align-items:center; gap:8px; padding:3px 0; font-family:'IBM Plex Mono',monospace; font-size:12px;">
        <span style="width:52px; font-weight:600;">${esc(v)}</span>`;
      P.dom[v].forEach(val => {
        const on = AC.assign[v] === val;
        html += `<button class="ix-btn ${on ? 'on' : ''}" style="padding:3px 9px;" onclick="acToggle('${esc(v)}','${esc(val)}')">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cspSwatch(val)};margin-right:4px;vertical-align:baseline;"></span>${esc(val)}</button>`;
      });
      html += '</div>';
    });
    html += '</div>';
    const acFailedBy = AC.log.findIndex(s => s.empty);
    const acFailsHere = acFailedBy >= 0 && AC.frame > acFailedBy;
    html += '<div class="compare-2" style="margin-top:8px;">';
    html += `<div class="mode-box" style="background:var(--tint-a); border-color:var(--accent); padding:14px;">
      <h4 style="color:var(--accent); font-size:16px;">Forward checking</h4>
      <div class="verdict ${AC.fcOk ? 'warn' : 'bad'}" style="margin:0 0 8px 0; font-size:13px;">${AC.fcOk ? 'survives — no domain is empty' : '<strong>fails</strong> — ' + esc(AC.fcWipe) + ' has no legal values'}</div>
      ${cspDomTable(P, [{ label: 'after FC', dom: snapFC() }])}</div>`;
    html += `<div class="mode-box" style="background:var(--tint-c); border-color:var(--accent-3); padding:14px;">
      <h4 style="color:var(--accent-3); font-size:16px;">Arc consistency, after ${AC.frame} arc${AC.frame === 1 ? '' : 's'}</h4>
      <div class="verdict ${acFailsHere ? 'bad' : 'warn'}" style="margin:0 0 8px 0; font-size:13px;">${acFailsHere ? '<strong>fails</strong> — ' + esc(AC.acR.wipe) + ' has no legal values' : (AC.frame >= AC.log.length && AC.acR.ok ? 'survives — no domain is empty' : 'still working…')}</div>
      ${cspDomTable(P, [{ label: 'domains now', dom: snapAC() }])}</div>`;
    html += '</div>';
    const s = AC.frame > 0 ? AC.log[AC.frame - 1] : null;
    html += IX.player('ac', AC.frame, AC.log.length + 1,
      s ? `arc <strong>${esc(s.xi)} → ${esc(s.xj)}</strong>` : 'before any arc is processed',
      s ? (s.empty ? ['update', 'domain emptied'] : s.removed.length ? ['assign', 'deleted ' + s.removed.length] : ['done', 'already consistent']) : null);
    html += `<p class="ix-hint"><strong>Click the value buttons</strong> above to build any partial assignment you like, then
      <strong>step through AC-3 one arc at a time</strong> and watch the domains shrink. Checking X → Y only ever deletes from <strong>X</strong>.</p>`;
    if (AC.fcOk && !AC.acR.ok) {
      html += `<div class="verdict safe"><strong>This is the point, live.</strong>
        Forward checking sees nothing wrong, but arc consistency proves the position is already dead —
        it compares <em>unassigned</em> variables against each other, which forward checking never does.
        <strong>Arc consistency detects failure earlier.</strong>
        <br><br><span style="font-size:13px;">Which variable ends up empty (here <strong>${esc(AC.acR.wipe)}</strong>) depends on the order arcs come off the queue —
        the usual trace happens to empty SA. AC-3 only promises that <em>some</em> domain will empty, not which one.</span></div>`;
    } else if (!AC.fcOk && !AC.acR.ok) {
      html += '<div class="verdict warn">Both detect the failure here. Un-assign one variable to find the point where only arc consistency notices.</div>';
    } else if (AC.fcOk && AC.acR.ok) {
      html += '<div class="verdict warn">Neither finds a contradiction — but note how many more values AC-3 stripped out. Every one of those is a branch the search will never have to try.</div>';
    }
    html += '<h3 style="margin-top:18px;">AC-3 arc log — click any line to jump there</h3><div style="max-height:340px; overflow-y:auto; padding-right:6px;">';
    if (!AC.log.length) html += '<div class="arcstep okk">no arcs — this CSP has no constraints.</div>';
    AC.log.forEach((x, i) => {
      const hot = i + 1 === AC.frame;
      html += `<div class="arcstep" style="cursor:pointer; ${hot ? 'background:var(--tint-a2); border-radius:4px;' : ''} ${i < AC.frame ? '' : 'opacity:.55;'}" onclick="acStep(${i + 1}, true)">
        <span style="color:var(--ink-muted);">${i + 1}.</span> <span class="arc">${esc(x.xi)} → ${esc(x.xj)}</span> &nbsp;`;
      if (!x.removed.length) html += '<span class="okk">already consistent</span>';
      else {
        html += `<span class="rm">delete ${x.removed.map(esc).join(', ')} from ${esc(x.xi)}</span>`;
        if (x.empty) html += ' <span class="rm"><strong>→ DOMAIN EMPTY, fail</strong></span>';
        else if (x.requeued.length) html += ` <span class="okk">· re-queue ${x.requeued.map(esc).join(', ')}</span>`;
      }
      html += '</div>';
    });
    html += '</div><p style="font-size:12.5px; color:var(--ink-muted);">When X shrinks, every arc <em>pointing into</em> X goes back in the queue.</p>';
    out.innerHTML = html;
  }
  function runAC3() {
    const out = document.getElementById('ac-output');
    if (!out) return;
    IX.stop('ac');
    const P = cspParse(document.getElementById('cs-vars').value, document.getElementById('cs-cons').value);
    let head = '';
    if (P.errs.length) head += `<div class="verdict bad">${P.errs.map(esc).join('<br>')}</div>`;
    if (!P.vars.length) { out.innerHTML = head + '<div class="tool-error">Enter a CSP in the solver above first.</div>'; return; }
    const assign = {}, bad = [];
    String(document.getElementById('ac-assign').value).split(',').forEach(part => {
      const t = part.trim(); if (!t) return;
      const m = t.match(/^([A-Za-z0-9_]+)\s*=\s*([A-Za-z0-9_]+)$/);
      if (!m) { bad.push(`could not read "${t}" — expected VAR=value`); return; }
      const v = m[1].toUpperCase();
      if (!P.dom[v]) { bad.push(`unknown variable ${v}`); return; }
      if (P.dom[v].indexOf(m[2]) < 0) { bad.push(`${m[2]} is not in the domain of ${v} (${P.dom[v].join(', ')})`); return; }
      assign[v] = m[2];
    });
    if (bad.length) head += `<div class="verdict bad">${bad.map(esc).join('<br>')}</div>`;
    const base = {}; P.vars.forEach(v => base[v] = assign[v] !== undefined ? [assign[v]] : P.dom[v].slice());
    const fcDom = cspCopy(base);
    let fcOk = true, fcWipe = null;
    Object.keys(assign).forEach(v => { if (fcOk) { const r = cspFC(P, v, assign[v], fcDom); if (!r.ok) { fcOk = false; fcWipe = r.wipe; } } });
    const acDom = cspCopy(base), log = [];
    const acR = cspAC3(P, acDom, log);
    AC.P = P; AC.base = base; AC.assign = assign; AC.log = log;
    AC.fcDom = fcDom; AC.fcOk = fcOk; AC.fcWipe = fcWipe; AC.acR = acR;
    AC.frame = log.length;
    acRender();
    if (head) out.innerHTML = head + out.innerHTML;
  }
  TOOL_RUNNERS.runAC3 = runAC3;
