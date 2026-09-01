  /* ============================================================
     TOOL 9 (W4): SMALL-STEP SOS REDUCER
     ============================================================ */
  const SS_ARROW = (p, s, p2, s2) => `⟨${esc(smShow(p, false))}, ${stShow(s)}⟩ → ⟨${esc(smShow(p2, false))}, ${stShow(s2)}⟩`;
  function ssStep(P, s) {
    // returns {p, s, deriv} or null (terminal) or {blocked:true, why}
    switch (P.k) {
      case 'num': case 'bool': case 'skip': return null;             // terminal
      case 'deref': {
        if (!(P.l in s)) return { blocked: true, why: P.l + ' ∉ dom(s)' };
        const v = { k: 'num', n: s[P.l] };
        return { p: v, s: s, deriv: { rule: 'var', side: 's(' + P.l + ') = ' + s[P.l], concl: SS_ARROW(P, s, v, s), prem: [] } };
      }
      case 'op': case 'bop': {
        const isB = P.k === 'bop';
        const L = isB ? 'bopL' : 'opL', R = isB ? 'bopR' : 'opR', AX = isB ? 'bop' : 'op';
        if (!isNum(P.e1)) {
          const r1 = ssStep(P.e1, s); if (!r1 || r1.blocked) return r1;
          const np = Object.assign({}, P, { e1: r1.p });
          return { p: np, s: r1.s, deriv: { rule: L, concl: SS_ARROW(P, s, np, r1.s), prem: [r1.deriv] } };
        }
        if (!isNum(P.e2)) {
          const r2 = ssStep(P.e2, s); if (!r2 || r2.blocked) return r2;
          const np = Object.assign({}, P, { e2: r2.p });
          return { p: np, s: r2.s, deriv: { rule: R, concl: SS_ARROW(P, s, np, r2.s), prem: [r2.deriv] } };
        }
        const n1 = P.e1.n, n2 = P.e2.n;
        let v, sd;
        if (isB) {
          const b = P.op === '>' ? n1 > n2 : P.op === '<' ? n1 < n2 : n1 === n2;
          v = { k: 'bool', b: b }; sd = 'b = (' + n1 + ' ' + P.op + ' ' + n2 + ') = ' + (b ? 'True' : 'False');
        } else {
          if (P.op === '/' && n2 === 0) return { blocked: true, why: 'division by zero — n₁ / n₂ is undefined' };
          const n = P.op === '+' ? n1 + n2 : P.op === '-' ? n1 - n2 : P.op === '*' ? n1 * n2 : Math.trunc(n1 / n2);
          v = { k: 'num', n: n }; sd = 'n = (' + n1 + ' ' + SM_OPSYM[P.op] + ' ' + n2 + ') = ' + n;
        }
        return { p: v, s: s, deriv: { rule: AX, side: sd, concl: SS_ARROW(P, s, v, s), prem: [] } };
      }
      case 'not': {
        if (!isBool(P.b)) {
          const r = ssStep(P.b, s); if (!r || r.blocked) return r;
          const np = { k: 'not', b: r.p };
          return { p: np, s: r.s, deriv: { rule: 'notArg', concl: SS_ARROW(P, s, np, r.s), prem: [r.deriv] } };
        }
        const v = { k: 'bool', b: !P.b.b };
        return { p: v, s: s, deriv: { rule: 'not', side: "b′ = not " + (P.b.b ? 'True' : 'False'), concl: SS_ARROW(P, s, v, s), prem: [] } };
      }
      case 'and': {
        if (!isBool(P.b1)) {
          const r = ssStep(P.b1, s); if (!r || r.blocked) return r;
          const np = { k: 'and', b1: r.p, b2: P.b2 };
          return { p: np, s: r.s, deriv: { rule: 'andL', concl: SS_ARROW(P, s, np, r.s), prem: [r.deriv] } };
        }
        if (!isBool(P.b2)) {
          const r = ssStep(P.b2, s); if (!r || r.blocked) return r;
          const np = { k: 'and', b1: P.b1, b2: r.p };
          return { p: np, s: r.s, deriv: { rule: 'andR', concl: SS_ARROW(P, s, np, r.s), prem: [r.deriv] } };
        }
        const v = { k: 'bool', b: P.b1.b && P.b2.b };
        return { p: v, s: s, deriv: { rule: 'and', side: 'b = (' + P.b1.b + ' and ' + P.b2.b + ')', concl: SS_ARROW(P, s, v, s), prem: [] } };
      }
      case 'assign': {
        if (!isNum(P.e)) {
          const r = ssStep(P.e, s); if (!r || r.blocked) return r;
          const np = { k: 'assign', l: P.l, e: r.p };
          return { p: np, s: r.s, deriv: { rule: ':=R', concl: SS_ARROW(P, s, np, r.s), prem: [r.deriv] } };
        }
        const s2 = stSet(s, P.l, P.e.n), sk = { k: 'skip' };
        return { p: sk, s: s2, deriv: { rule: ':=', concl: SS_ARROW(P, s, sk, s2), prem: [] } };
      }
      case 'seq': {
        if (isSkip(P.c1)) return { p: P.c2, s: s, deriv: { rule: 'skip', concl: SS_ARROW(P, s, P.c2, s), prem: [] } };
        const r = ssStep(P.c1, s); if (!r || r.blocked) return r;
        const np = { k: 'seq', c1: r.p, c2: P.c2 };
        return { p: np, s: r.s, deriv: { rule: 'seq', concl: SS_ARROW(P, s, np, r.s), prem: [r.deriv] } };
      }
      case 'if': {
        if (!isBool(P.b)) {
          const r = ssStep(P.b, s); if (!r || r.blocked) return r;
          const np = { k: 'if', b: r.p, c1: P.c1, c2: P.c2 };
          return { p: np, s: r.s, deriv: { rule: 'if', concl: SS_ARROW(P, s, np, r.s), prem: [r.deriv] } };
        }
        const taken = P.b.b ? P.c1 : P.c2;
        return { p: taken, s: s, deriv: { rule: P.b.b ? 'ifT' : 'ifF', concl: SS_ARROW(P, s, taken, s), prem: [] } };
      }
      case 'while': {
        const unfold = { k: 'if', b: P.b, c1: { k: 'seq', c1: P.c, c2: { k: 'while', b: P.b, c: P.c } }, c2: { k: 'skip' } };
        return { p: unfold, s: s, deriv: { rule: 'while', concl: SS_ARROW(P, s, unfold, s), prem: [] } };
      }
      default: return { blocked: true, why: 'no small-step rule for this construct (blocks are only given a big-step rule)' };
    }
  }
  let ssState = null;
  function ssInit() {
    const P = smParse(document.getElementById('ss-prog').value);
    const s = smParseMem(document.getElementById('ss-store').value);
    ssState = { p: P, s: s, p0: P, s0: s, trace: [], done: false, blocked: null, capped: false };
  }
  function ssOne() {
    const st = ssState;
    const r = ssStep(st.p, st.s);
    if (r === null) { st.done = true; return false; }
    if (r.blocked) { st.blocked = r.why; return false; }
    st.trace.push({ p: r.p, s: r.s, deriv: r.deriv });
    st.p = r.p; st.s = r.s;
    return true;
  }
  function ssStepBtn() {
    try {
      if (!ssState || ssState.done || ssState.blocked || ssState.capped) ssInit();
      if (ssState.trace.length > 400) { ssState.capped = true; ssRender(); return; }
      ssOne(); ssRender();
    } catch (e) { document.getElementById('ss-output').innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; }
  }
  function ssRunAll() {
    try {
      ssInit();
      let g = 0;
      while (g++ < 400 && ssOne()) { }
      if (g >= 400) ssState.capped = true;
      ssRender();
    } catch (e) { document.getElementById('ss-output').innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; }
  }
  function ssReset() { try { ssInit(); ssRender(); } catch (e) { document.getElementById('ss-output').innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; } }
  function ssPreset(w) {
    const P = document.getElementById('ss-prog'), S = document.getElementById('ss-store');
    if (w === 'zplus') { P.value = '!z + 1'; S.value = 'z = 0'; }
    else if (w === 'swap') { P.value = 'z := !x; x := !y; y := !z'; S.value = 'x = 1, y = 2, z = 0'; }
    else if (w === 'blocked') { P.value = 'if !x = 0 then skip else skip'; S.value = 'y = 1'; }
    else if (w === 'div') { P.value = 'while True do skip'; S.value = 'x = 0'; }
    ssRunAll();
  }
  function ssRender() {
    const st = ssState, out = document.getElementById('ss-output');
    if (!st) { out.innerHTML = ''; return; }
    let html = '';
    // classification
    let cat, catCls, catTxt;
    if (st.blocked) { cat = 'Blocked (stuck)'; catCls = 'bad'; catTxt = `the sequence reached a <strong>blocked</strong> configuration: ${esc(st.blocked)}. No rule applies, but this is <em>not</em> a result.`; }
    else if (st.capped) { cat = 'Divergent'; catCls = 'warn'; catTxt = 'no terminal configuration after 400 transitions — the evaluation sequence appears to be <strong>infinite</strong>.'; }
    else if (st.done) {
      const p = st.p;
      cat = 'Terminating'; catCls = 'safe';
      catTxt = isSkip(p) ? `reached the terminal configuration ⟨skip, s′⟩ — the command has a <strong>successful execution</strong> and produces s′ = ${stShow(st.s)}.`
        : `reached the terminal configuration ⟨${esc(smShow(p, false))}, s′⟩ — the expression has the <strong>value ${esc(smShow(p, false))}</strong> in the given state.`;
    }
    html += `<div style="margin-bottom:10px;"><span class="stat-pill dark">${st.trace.length} transition${st.trace.length === 1 ? '' : 's'}</span>`;
    if (cat) html += `<span class="stat-pill ${catCls === 'safe' ? 'b' : catCls === 'bad' ? 'c' : 'a'}">${cat}</span>`;
    html += '</div>';
    // trace
    html += '<div class="ss-trace">';
    let dsi = 0;
    html += `<div class="ss-row" data-step="${dsi++}"><span class="ss-n">0</span><span class="ss-a"></span><span class="ss-c">⟨${esc(smShow(st.p0, false))}, ${stShow(st.s0)}⟩</span></div>`;
    const show = st.trace.length > 40 ? st.trace.slice(0, 20).concat([{ ell: st.trace.length - 40 }], st.trace.slice(-20)) : st.trace;
    let k = 0;
    show.forEach(t => {
      if (t.ell) { html += `<div class="ss-row" data-step="${dsi++}"><span class="ss-n">⋯</span><span class="ss-a"></span><span class="ss-c" style="color:var(--ink-muted);">(${t.ell} further transitions omitted)</span></div>`; k += t.ell; return; }
      k++;
      const last = (k === st.trace.length);
      const cls = last && st.done ? 'final' : (last && st.blocked ? 'blocked' : '');
      html += `<div class="ss-row ${cls}" data-step="${dsi++}"><span class="ss-n">${k}</span><span class="ss-a">→</span><span class="ss-c">⟨${esc(smShow(t.p, false))}, ${stShow(t.s)}⟩<span class="ss-rule">${esc(t.deriv.rule)}</span></span></div>`;
    });
    if (st.blocked) html += `<div class="ss-row blocked" data-step="${dsi++}"><span class="ss-n">⊥</span><span class="ss-a"></span><span class="ss-c">blocked — no rule applies</span></div>`;
    html += '</div>';
    if (cat) html += `<div class="verdict ${catCls}"><strong>${cat}:</strong> ${catTxt}</div>`;
    // derivation trees for the first few steps
    const nShow = Math.min(st.trace.length, 3);
    if (nShow) {
      html += `<h4 style="font-size:16px; margin-top:18px;">Proof of each transition <span style="font-size:11px; color:var(--ink-muted); font-family:'IBM Plex Mono',monospace;">(first ${nShow} step${nShow === 1 ? '' : 's'})</span></h4>`;
      for (let i = 0; i < nShow; i++) {
        html += `<div class="deriv-box"><div class="db-title">step ${i + 1}</div>${infHtml(st.trace[i].deriv, true)}</div>`;
      }
      if (st.trace.length > nShow) {
        html += `<p style="font-size:12.5px; color:var(--ink-muted);">${st.trace.length - nShow} further transition${st.trace.length - nShow === 1 ? '' : 's'} each have their own proof, built the same way.</p>`;
      }
    }
    out.innerHTML = html;
    ixTrace('ssT', 'ss-output', { label: 'configuration', reset: true });
  }
