  /* ============================================================
     TOOL 20 (W10): UNIFICATION STEPPER (Martelli–Montanari)
     ============================================================ */
  function unParseProblem(src) {
    // split on top-level commas, then each part on '='
    const parts = []; let d = 0, cur = '';
    for (const ch of src) {
      if ('(['.includes(ch)) d++; if (')]'.includes(ch)) d--;
      if (ch === ',' && d === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    return parts.map(p => {
      const t = p.trim(); if (!t) return null;
      let d2 = 0, at = -1;
      for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if ('(['.includes(ch)) d2++; if (')]'.includes(ch)) d2--;
        if (ch === '=' && d2 === 0) { at = i; break; }
      }
      if (at < 0) throw new Error('Missing = in the equation "' + t + '"');
      return { l: plParse(t.slice(0, at)), r: plParse(t.slice(at + 1)) };
    }).filter(x => x);
  }
  const unIsVar = t => t.k === 'V';
  function unOccurs(v, t) {
    if (t.k === 'V') return t.n === v;
    if (t.k === 'C') return t.args.some(a => unOccurs(v, a));
    return false;
  }
  function unSubstT(t, v, r) {
    if (t.k === 'V') return t.n === v ? r : t;
    if (t.k === 'C') return { k: 'C', f: t.f, args: t.args.map(a => unSubstT(a, v, r)) };
    return t;
  }
  function unShowSet(eqs, sel) {
    if (!eqs.length) return '{ }';
    return '{ ' + eqs.map((e, i) =>
      `<span class="u-eq${i === sel ? ' sel' : ''}">${esc(plShow(e.l, 0))} = ${esc(plShow(e.r, 0))}</span>`
    ).join(', &nbsp;') + ' }';
  }
  function unSolve(eqs) {
    const steps = [{ eqs: eqs.map(e => ({ l: e.l, r: e.r })), rule: null, sel: -1 }];
    let cur = eqs.map(e => ({ l: e.l, r: e.r }));
    let guard = 0;
    while (guard++ < 400) {
      let applied = null;
      for (let i = 0; i < cur.length; i++) {
        const { l, r } = cur[i];
        // (1) / (2): both compound
        if (l.k === 'C' && r.k === 'C') {
          if (l.f === r.f && l.args.length === r.args.length) {
            const news = l.args.map((a, j) => ({ l: a, r: r.args[j] }));
            applied = { rule: 1, i: i, next: cur.slice(0, i).concat(news, cur.slice(i + 1)) };
          } else {
            applied = { rule: 2, i: i, fail: 'the function symbols ' + l.f + '/' + l.args.length + ' and ' + r.f + '/' + r.args.length + ' clash' };
          }
          break;
        }
        if (l.k === 'N' && r.k === 'N') {
          if (l.v === r.v) { applied = { rule: 1, i: i, next: cur.slice(0, i).concat(cur.slice(i + 1)) }; }
          else { applied = { rule: 2, i: i, fail: 'the constants ' + l.v + ' and ' + r.v + ' clash' }; }
          break;
        }
        if ((l.k === 'N' && r.k === 'C') || (l.k === 'C' && r.k === 'N')) {
          applied = { rule: 2, i: i, fail: 'a number cannot equal a compound term' }; break;
        }
        // (3) X = X
        if (unIsVar(l) && unIsVar(r) && l.n === r.n) {
          applied = { rule: 3, i: i, next: cur.slice(0, i).concat(cur.slice(i + 1)) }; break;
        }
        // (4) t = X with t not a variable
        if (!unIsVar(l) && unIsVar(r)) {
          const swapped = cur.slice(); swapped[i] = { l: r, r: l };
          applied = { rule: 4, i: i, next: swapped }; break;
        }
        // X = t
        if (unIsVar(l)) {
          const X = l.n;
          if (unOccurs(X, r) && !(unIsVar(r) && r.n === X)) { applied = { rule: 6, i: i, fail: X + ' occurs in ' + plShow(r, 0) + ' — occur-check failure' }; break; }
          const elsewhere = cur.some((e, j) => j !== i && (unOccurs(X, e.l) || unOccurs(X, e.r)));
          if (elsewhere) {
            const next = cur.map((e, j) => j === i ? e : { l: unSubstT(e.l, X, r), r: unSubstT(e.r, X, r) });
            applied = { rule: 5, i: i, next: next }; break;
          }
        }
      }
      if (!applied) break;                       // no rule applies — done
      if (applied.fail) { steps.push({ eqs: cur, rule: applied.rule, sel: applied.i, fail: applied.fail }); return { steps: steps, ok: false }; }
      cur = applied.next;
      steps.push({ eqs: cur.map(e => ({ l: e.l, r: e.r })), rule: applied.rule, sel: -1, from: applied.i });
    }
    return { steps: steps, ok: true, mgu: cur };
  }
  function unPreset(w) {
    const P = document.getElementById('un-prob');
    if (w === 'e1') P.value = 'f(a, a) = f(X, a)';
    else if (w === 'e2') P.value = '[X | L] = [0], Y = [1, 2], [X | Z] = U';
    else if (w === 'e3') P.value = 'f(g(a), b) = f(X, b), X = g(Z), f(a, Y) = f(Z, Y)';
    else if (w === 'occ') P.value = 'X = f(X)';
    else if (w === 'clash') P.value = 'f(X, a) = g(X, a)';
    else if (w === 'rename') P.value = '[X|Y] = Y, Z = [2], [X|W] = W';
    runUnify();
  }
  function runUnify() {
    const out = document.getElementById('un-output');
    let eqs;
    try { eqs = unParseProblem(document.getElementById('un-prob').value); }
    catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    if (!eqs.length) { out.innerHTML = `<div class="tool-error">Give at least one equation.</div>`; return; }
    const res = unSolve(eqs);
    let html = '<div class="unif">';
    res.steps.forEach((st, i) => {
      if (i === 0) { html += `<div class="unif-row start" data-step="${i}"><span class="u-rule">Input</span><span class="u-set">${unShowSet(st.eqs, -1)}</span></div>`; return; }
      if (st.fail) {
        html += `<div class="unif-row fail" data-step="${i}"><span class="u-rule">rule (${st.rule}), eq ${st.sel + 1}</span><span class="u-set">failure — ${esc(st.fail)}</span></div>`;
        return;
      }
      html += `<div class="unif-row" data-step="${i}"><span class="u-rule">rule (${st.rule}), eq ${st.from + 1}</span><span class="u-set">${unShowSet(st.eqs, -1)}</span></div>`;
    });
    if (res.ok) {
      const mguTxt = res.mgu.length
        ? '{ ' + res.mgu.map(e => esc(plShow(e.l, 0)) + ' ↦ ' + esc(plShow(e.r, 0))).join(', &nbsp;') + ' }'
        : '{ }';
      html += `<div class="unif-row done" data-step="${res.steps.length}"><span class="u-rule">Output</span><span class="u-set">${mguTxt}</span></div>`;
    }
    html += '</div>';
    if (res.ok) {
      html += `<div class="verdict safe">✓ <strong>Unifiable.</strong> No rule applies to the final set, so it <em>is</em> the mgu — change each <code>=</code> to <code>↦</code> and read it off. ${res.mgu.length === 0 ? 'Here the empty substitution suffices: the terms were already identical.' : ''}</div>`;
    } else {
      const last = res.steps[res.steps.length - 1];
      html += `<div class="verdict bad">✗ <strong>Failure — the terms are not unifiable.</strong> Rule (${last.rule}) applied: ${esc(last.fail)}.
        ${last.rule === 6 ? '<br><br>This is the <strong>occur-check</strong>. Note it is exactly what makes the un-renamed <code>myappend</code> resolution fail — the fix is to rename the clause variables apart.' : ''}</div>`;
    }
    out.innerHTML = html;
    ixTrace('unT', 'un-output', { label: 'rule application', reset: true });
  }
