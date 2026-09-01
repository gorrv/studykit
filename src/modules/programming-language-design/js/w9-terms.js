  /* ============================================================
     TOOL 17 (W9): TERM / LITERAL / CLAUSE CHECKER
     ============================================================ */
  function lpParseSig(s) {
    const S = {};
    s.split(',').forEach(part => {
      const p = part.trim(); if (!p) return;
      const m = p.split('/');
      if (m.length !== 2 || isNaN(+m[1])) throw new Error('Bad signature entry "' + p + '" — write it as  f/2');
      S[m[0].trim()] = +m[1];
    });
    return S;
  }
  function lpCheckTerm(t, funs, errs, path) {
    switch (t.k) {
      case 'V': return true;
      case 'N': return true;
      case 'C': {
        if (!(t.f in funs)) { errs.push('<code>' + esc(t.f) + '</code> is not a declared function symbol'); return false; }
        if (funs[t.f] !== t.args.length) { errs.push('<code>' + esc(t.f) + '</code> has arity ' + funs[t.f] + ' but is used with ' + t.args.length + ' argument' + (t.args.length === 1 ? '' : 's')); return false; }
        let ok = true;
        t.args.forEach(a => { if (!lpCheckTerm(a, funs, errs)) ok = false; });
        return ok;
      }
      default: return false;
    }
  }
  function lpCheckLiteral(lit, funs, preds, errs) {
    const a = lit.atom;
    if (a.k !== 'C') { errs.push('a literal must be a predicate applied to terms'); return false; }
    if (!(a.f in preds)) {
      if (a.f in funs) errs.push('<code>' + esc(a.f) + '</code> is a <em>function</em> symbol, not a predicate — functions build terms, predicates make statements');
      else errs.push('<code>' + esc(a.f) + '</code> is not a declared predicate symbol');
      return false;
    }
    if (preds[a.f] !== a.args.length) { errs.push('<code>' + esc(a.f) + '</code> is a predicate of arity ' + preds[a.f] + ' but is used with ' + a.args.length + ' argument' + (a.args.length === 1 ? '' : 's')); return false; }
    let ok = true;
    a.args.forEach(arg => {
      if (arg.k === 'C' && (arg.f in preds) && !(arg.f in funs)) { errs.push('<code>' + esc(arg.f) + '</code> is a predicate, and <strong>only terms can be used as arguments to predicates</strong>'); ok = false; return; }
      if (!lpCheckTerm(arg, funs, errs)) ok = false;
    });
    return ok;
  }
  function lpParseClause(src) {                // returns a list of {neg, atom}
    const T = plLex(src);
    const lits = []; let p = 0;
    while (true) {
      let neg = false;
      if (T[p].k === 'neg' || T[p].k === 'naf') { neg = true; p++; }
      const r = plParseTerm(T, p);
      lits.push({ neg: neg, atom: r.t }); p = r.pos;
      if (T[p].k === 'or') { p++; continue; }
      break;
    }
    if (T[p].k !== 'eof') throw new Error('Unexpected input at the end of the expression');
    return lits;
  }
  function lpPreset(w) {
    const F = document.getElementById('lc-funs'), P = document.getElementById('lc-preds'), E = document.getElementById('lc-expr');
    F.value = 'a/0, b/0, f/2, g/1'; P.value = 'p/2, q/1';
    if (w === 't1') E.value = 'g(f)';
    else if (w === 't2') E.value = 'f(X, f(X, g(f(Y,a))))';
    else if (w === 'l1') E.value = '~p(q(g(Y),g(a)))';
    else if (w === 'c1') E.value = '~p(X,a) \\/ ~q(Y)';
    else if (w === 'c2') E.value = 'q(a) \\/ p(b,g(X))';
    runLpCheck();
  }
  function runLpCheck() {
    const out = document.getElementById('lc-output');
    let funs, preds, lits;
    try {
      funs = lpParseSig(document.getElementById('lc-funs').value);
      preds = lpParseSig(document.getElementById('lc-preds').value);
      lits = lpParseClause(document.getElementById('lc-expr').value);
    } catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    let html = '';
    // single unnegated atom: could be a term
    if (lits.length === 1 && !lits[0].neg) {
      const tErrs = [];
      const isTerm = lpCheckTerm(lits[0].atom, funs, tErrs);
      html += '<div class="chk">';
      html += `<span class="mark ${isTerm ? 'y' : 'n'}">${isTerm ? '✓' : '✗'}</span><span><strong>valid term?</strong> ${isTerm ? 'Yes' : 'No — ' + tErrs[0]}</span>`;
      html += '</div>';
    }
    // literal check
    const lErrsAll = [];
    const litOk = lits.map(l => { const errs = []; const ok = lpCheckLiteral(l, funs, preds, errs); lErrsAll.push(errs); return ok; });
    html += '<div class="chk">';
    lits.forEach((l, i) => {
      const label = (l.neg ? '¬' : '') + esc(plShow(l.atom, 0));
      html += `<span class="mark ${litOk[i] ? 'y' : 'n'}">${litOk[i] ? '✓' : '✗'}</span><span><strong>valid literal</strong> <code>${label}</code>? ${litOk[i] ? 'Yes' : 'No — ' + lErrsAll[i][0]}</span>`;
    });
    html += '</div>';
    if (!litOk.every(x => x)) { out.innerHTML = html + `<div class="verdict bad">Not a well-formed clause, because at least one literal is invalid.</div>`; return; }
    // Horn classification
    const pos = lits.filter(l => !l.neg), neg = lits.filter(l => l.neg);
    if (pos.length > 1) {
      html += `<div class="verdict bad">✗ <strong>Not a Horn clause</strong>, as it contains <strong>${pos.length} positive literals</strong> (${pos.map(l => '<code>' + esc(plShow(l.atom, 0)) + '</code>').join(', ')}). A Horn clause has <em>at most one</em> positive literal.</div>`;
      out.innerHTML = html; return;
    }
    let kind, prolog, why;
    if (pos.length === 1 && neg.length === 0) {
      kind = 'fact'; prolog = plShow(pos[0].atom, 0) + '.';
      why = 'a definite clause comprising a single positive literal';
    } else if (pos.length === 1) {
      kind = 'rule'; prolog = plShow(pos[0].atom, 0) + ' :- ' + neg.map(l => plShow(l.atom, 0)).join(', ') + '.';
      why = 'a definite clause with some negative literals — read the implication backwards';
    } else {
      kind = 'goal'; prolog = ':- ' + neg.map(l => plShow(l.atom, 0)).join(', ') + '.';
      why = 'a Horn clause containing only negative literals — a query to the program';
    }
    html += `<div class="verdict safe">✓ This is a <strong>${kind}</strong> — ${why}.<br><br>In Prolog syntax: &nbsp;<code style="font-size:14px;">${esc(prolog)}</code></div>`;
    if (kind !== 'goal') html += `<div style="font-size:13px; color:var(--ink-muted);">It is also a <strong>definite clause</strong> (exactly one positive literal), so it may appear in a program.</div>`;
    out.innerHTML = html;
  }
