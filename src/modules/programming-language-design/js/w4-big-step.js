  /* ============================================================
     TOOL 10 (W4): BIG-STEP ⇓ DERIVATION PROVER
     ============================================================ */
  const BS_DOWN = (p, s, v, s2) => `⟨${esc(smShow(p, false))}, ${stShow(s)}⟩ ⇓ ⟨${esc(smShow(v, false))}, ${stShow(s2)}⟩`;
  let bsFresh = 0, bsBudget = 0;
  function bsSubst(P, x, l) {                       // C{x ↦ l}
    if (!P || typeof P !== 'object') return P;
    switch (P.k) {
      case 'deref': return P.l === x ? { k: 'deref', l: l } : P;
      case 'assign': return { k: 'assign', l: P.l === x ? l : P.l, e: bsSubst(P.e, x, l) };
      case 'op': case 'bop': return Object.assign({}, P, { e1: bsSubst(P.e1, x, l), e2: bsSubst(P.e2, x, l) });
      case 'not': return { k: 'not', b: bsSubst(P.b, x, l) };
      case 'and': return { k: 'and', b1: bsSubst(P.b1, x, l), b2: bsSubst(P.b2, x, l) };
      case 'seq': return { k: 'seq', c1: bsSubst(P.c1, x, l), c2: bsSubst(P.c2, x, l) };
      case 'if': return { k: 'if', b: bsSubst(P.b, x, l), c1: bsSubst(P.c1, x, l), c2: bsSubst(P.c2, x, l) };
      case 'while': return { k: 'while', b: bsSubst(P.b, x, l), c: bsSubst(P.c, x, l) };
      case 'block': return P.x === x ? P : { k: 'block', x: P.x, e: bsSubst(P.e, x, l), c: bsSubst(P.c, x, l) };
      default: return P;
    }
  }
  function bsLocs(P, acc) {
    acc = acc || {};
    if (!P || typeof P !== 'object') return acc;
    if (P.k === 'deref') acc[P.l] = 1;
    if (P.k === 'assign') { acc[P.l] = 1; bsLocs(P.e, acc); }
    ['e1', 'e2', 'b', 'b1', 'b2', 'c', 'c1', 'c2', 'e'].forEach(f => { if (P[f] && typeof P[f] === 'object') bsLocs(P[f], acc); });
    return acc;
  }
  function bsEval(P, s) {
    // returns {v, s, deriv}  or throws {bsErr:...}
    if (bsBudget++ > 6000) throw { bsErr: 'No finite derivation could be built within the budget — the program is probably divergent. Remember: a divergent program has NO big-step derivation at all.' };
    switch (P.k) {
      case 'num': case 'bool':
        return { v: P, s: s, deriv: { rule: 'const', side: 'c ∈ ℤ ∪ {True, False}', concl: BS_DOWN(P, s, P, s), prem: [] } };
      case 'skip':
        return { v: P, s: s, deriv: { rule: 'skip', concl: BS_DOWN(P, s, P, s), prem: [] } };
      case 'deref': {
        if (!(P.l in s)) throw { bsErr: 'blocked: ' + P.l + ' ∉ dom(s), so the (var) rule cannot be applied and no derivation exists.' };
        const v = { k: 'num', n: s[P.l] };
        return { v: v, s: s, deriv: { rule: 'var', side: 's(' + P.l + ') = ' + s[P.l], concl: BS_DOWN(P, s, v, s), prem: [] } };
      }
      case 'op': case 'bop': {
        const r1 = bsEval(P.e1, s), r2 = bsEval(P.e2, r1.s);
        const n1 = r1.v.n, n2 = r2.v.n;
        let v, sd;
        if (P.k === 'bop') {
          const b = P.op === '>' ? n1 > n2 : P.op === '<' ? n1 < n2 : n1 === n2;
          v = { k: 'bool', b: b }; sd = 'b = ' + n1 + ' ' + P.op + ' ' + n2;
        } else {
          if (P.op === '/' && n2 === 0) throw { bsErr: 'division by zero: no n with n = n₁ / n₂, so the (op) rule does not apply.' };
          const n = P.op === '+' ? n1 + n2 : P.op === '-' ? n1 - n2 : P.op === '*' ? n1 * n2 : Math.trunc(n1 / n2);
          v = { k: 'num', n: n }; sd = 'n = ' + n1 + ' ' + SM_OPSYM[P.op] + ' ' + n2;
        }
        return { v: v, s: r2.s, deriv: { rule: P.k === 'bop' ? 'bop' : 'op', side: sd, concl: BS_DOWN(P, s, v, r2.s), prem: [r1.deriv, r2.deriv] } };
      }
      case 'not': {
        const r = bsEval(P.b, s), v = { k: 'bool', b: !r.v.b };
        return { v: v, s: r.s, deriv: { rule: 'not', side: 'b = not ' + (r.v.b ? 'True' : 'False'), concl: BS_DOWN(P, s, v, r.s), prem: [r.deriv] } };
      }
      case 'and': {
        const r1 = bsEval(P.b1, s), r2 = bsEval(P.b2, r1.s);
        const v = { k: 'bool', b: r1.v.b && r2.v.b };
        return { v: v, s: r2.s, deriv: { rule: 'and', side: 'b = b₁ and b₂', concl: BS_DOWN(P, s, v, r2.s), prem: [r1.deriv, r2.deriv] } };
      }
      case 'assign': {
        const r = bsEval(P.e, s), s2 = stSet(r.s, P.l, r.v.n), sk = { k: 'skip' };
        return { v: sk, s: s2, deriv: { rule: ':=', concl: BS_DOWN(P, s, sk, s2), prem: [r.deriv] } };
      }
      case 'seq': {
        const r1 = bsEval(P.c1, s), r2 = bsEval(P.c2, r1.s), sk = { k: 'skip' };
        return { v: sk, s: r2.s, deriv: { rule: 'seq', concl: BS_DOWN(P, s, sk, r2.s), prem: [r1.deriv, r2.deriv] } };
      }
      case 'if': {
        const rb = bsEval(P.b, s);
        const branch = rb.v.b ? P.c1 : P.c2;
        const rc = bsEval(branch, rb.s), sk = { k: 'skip' };
        return { v: sk, s: rc.s, deriv: { rule: rb.v.b ? 'ifT' : 'ifF', concl: BS_DOWN(P, s, sk, rc.s), prem: [rb.deriv, rc.deriv] } };
      }
      case 'while': {
        const rb = bsEval(P.b, s), sk = { k: 'skip' };
        if (!rb.v.b) return { v: sk, s: rb.s, deriv: { rule: 'whileF', concl: BS_DOWN(P, s, sk, rb.s), prem: [rb.deriv] } };
        const rc = bsEval(P.c, rb.s);
        const rw = bsEval(P, rc.s);
        return { v: sk, s: rw.s, deriv: { rule: 'whileT', concl: BS_DOWN(P, s, sk, rw.s), prem: [rb.deriv, rc.deriv, rw.deriv] } };
      }
      case 'block': {
        const r = bsEval(P.e, s);
        // pick a fresh l ∉ dom(s') ∪ locations(C)
        const used = Object.assign({}, r.s, bsLocs(P.c));
        let l; do { l = 'l' + (bsFresh++); } while (l in used);
        const body = bsSubst(P.c, P.x, l);
        const rc = bsEval(body, stSet(r.s, l, r.v.n));
        const sOut = Object.assign({}, rc.s); delete sOut[l];      // l is discarded on block exit
        const sk = { k: 'skip' };
        return { v: sk, s: sOut, deriv: { rule: 'block', side: 'l = ' + l + ' fresh; C{' + P.x + ' ↦ ' + l + '}', concl: BS_DOWN(P, s, sk, sOut), prem: [r.deriv, rc.deriv] } };
      }
      default: throw { bsErr: 'no big-step rule for this construct' };
    }
  }
  function bsPreset(w) {
    const P = document.getElementById('bs-prog'), S = document.getElementById('bs-store');
    if (w === 'swap') { P.value = '(z := !x; x := !y); y := !z'; S.value = 'x = 1, y = 2, z = 0'; }
    else if (w === 'while') { P.value = 'while !n > 0 do n := !n - 1'; S.value = 'n = 2'; }
    else if (w === 'block') { P.value = 'begin loc z := !x; (x := !y; y := !z) end'; S.value = 'x = 1, y = 2'; }
    else if (w === 'div') { P.value = 'while True do skip'; S.value = 'x = 0'; }
    runBigStep();
  }
  function runBigStep() {
    const out = document.getElementById('bs-output');
    let P, s;
    try { P = smParse(document.getElementById('bs-prog').value); s = smParseMem(document.getElementById('bs-store').value); }
    catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    bsFresh = 0; bsBudget = 0;
    let res;
    try { res = bsEval(P, s); }
    catch (e) {
      if (e && e.bsErr) {
        out.innerHTML = `<div class="verdict bad">✗ <strong>No derivation exists.</strong> ${esc(e.bsErr)}
          <br><br>This is the key asymmetry with small-step: ⇓ relates a configuration only to a <em>terminal</em> one, so a divergent or blocked program is simply <strong>not in the relation</strong> — big-step cannot tell the two cases apart, whereas small-step can.</div>`;
        return;
      }
      out.innerHTML = `<div class="tool-error">${esc(String(e && e.message || e))}</div>`; return;
    }
    const size = infSize(res.deriv);
    let html = `<div style="margin-bottom:10px;"><span class="stat-pill dark">${size} rule applications</span>`;
    html += `<span class="stat-pill b">final store ${stShow(res.s)}</span></div>`;
    html += `<div class="verdict safe">✓ <strong>${BS_DOWN(P, s, res.v, res.s)}</strong></div>`;
    if (size > 130) {
      html += `<div class="verdict warn">The derivation has ${size} rule applications — too large to draw legibly. Reduce the number of loop iterations (this is exactly why exam questions use tiny loops).</div>`;
    } else {
      html += `<div class="deriv-box"><div class="db-title">derivation</div>${infHtml(res.deriv, true)}</div>`;
    }
    out.innerHTML = html;
    ixTrace('bsT', 'bs-output', { label: 'rule application', reset: true });
  }
