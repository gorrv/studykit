  /* ============================================================
     TOOL 14 (W8): SFUN — syntax, CBV / CBN evaluation, derivations
     ============================================================ */
  function sfLex(src) {
    const T = []; let i = 0;
    const s = src.replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/¬/g, '~')
                 .replace(/∧/g, '/\\').replace(/∗/g, '*').replace(/−/g, '-').replace(/≠/g, '/=');
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c)) { let d = ''; while (i < s.length && /[0-9]/.test(s[i])) d += s[i++]; T.push({ k: 'num', v: +d }); continue; }
      if (/[A-Za-z_]/.test(c)) {
        let w = ''; while (i < s.length && /[A-Za-z0-9_']/.test(s[i])) w += s[i++];
        T.push(['if', 'then', 'else', 'True', 'False'].includes(w) ? { k: w } : { k: 'id', v: w });
        continue;
      }
      if (s.substr(i, 2) === '/\\') { T.push({ k: 'and' }); i += 2; continue; }
      if (['>=', '<='].includes(s.substr(i, 2))) { T.push({ k: 'bop', v: s.substr(i, 2) }); i += 2; continue; }
      if ('+-*/'.includes(c)) { T.push({ k: 'op', v: c }); i++; continue; }
      if ('><'.includes(c)) { T.push({ k: 'bop', v: c }); i++; continue; }
      if (c === '=') { T.push({ k: '=' }); i++; continue; }
      if (c === '~') { T.push({ k: '~' }); i++; continue; }
      if ('(),'.includes(c)) { T.push({ k: c }); i++; continue; }
      throw new Error('Unexpected character "' + c + '"');
    }
    T.push({ k: 'eof' }); return T;
  }
  function sfParseTerm(T, pos) {
    let p = pos;
    const peek = () => T[p].k, tok = () => T[p];
    const eat = k => { if (T[p].k !== k) throw new Error('Expected ' + k + ', found ' + (T[p].v !== undefined ? T[p].v : T[p].k)); return T[p++]; };
    function atom() {
      if (peek() === 'num') return { k: 'num', n: eat('num').v };
      if (peek() === 'True') { eat('True'); return { k: 'bool', b: true }; }
      if (peek() === 'False') { eat('False'); return { k: 'bool', b: false }; }
      if (peek() === '~') { eat('~'); return { k: 'not', t: atom() }; }
      if (peek() === '(') { eat('('); const e = term(); eat(')'); return e; }
      if (peek() === 'if') { eat('if'); const c = term(); eat('then'); const a = term(); eat('else'); const b = term(); return { k: 'if', t0: c, t1: a, t2: b }; }
      if (peek() === 'id') {
        const name = eat('id').v;
        if (peek() === '(') {                      // function application
          eat('('); const args = [];
          if (peek() !== ')') { args.push(term()); while (peek() === ',') { eat(','); args.push(term()); } }
          eat(')');
          return { k: 'call', f: name, args: args };
        }
        return { k: 'var', v: name };
      }
      throw new Error('Expected a term, found ' + peek());
    }
    function mul() { let l = atom(); while (peek() === 'op' && ['*', '/'].includes(tok().v)) { const o = eat('op').v; l = { k: 'op', op: o, t1: l, t2: atom() }; } return l; }
    function add() { let l = mul(); while (peek() === 'op' && ['+', '-'].includes(tok().v)) { const o = eat('op').v; l = { k: 'op', op: o, t1: l, t2: mul() }; } return l; }
    function cmp() { let l = add(); if (peek() === 'bop') { const o = eat('bop').v; l = { k: 'bop', op: o, t1: l, t2: add() }; } else if (peek() === '=') { eat('='); l = { k: 'bop', op: '=', t1: l, t2: add() }; } return l; }
    function term() { let l = cmp(); while (peek() === 'and') { eat('and'); l = { k: 'and', t1: l, t2: cmp() }; } return l; }
    const e = term();
    return { e: e, pos: p };
  }
  function sfParseProgram(src) {
    const P = {};
    src.split('\n').forEach((line, ln) => {
      const l = line.trim(); if (!l || l.startsWith('--')) return;
      const T = sfLex(l);
      let p = 0;
      if (T[p].k !== 'id') throw new Error('Line ' + (ln + 1) + ': an equation must start with a function name');
      const name = T[p++].v;
      const params = [];
      if (T[p].k === '(') {
        p++;
        if (T[p].k !== ')') { while (true) { if (T[p].k !== 'id') throw new Error('Line ' + (ln + 1) + ': parameters must be variables'); params.push(T[p++].v); if (T[p].k === ',') { p++; continue; } break; } }
        if (T[p].k !== ')') throw new Error('Line ' + (ln + 1) + ': expected )'); p++;
      }
      if (T[p].k !== '=') throw new Error('Line ' + (ln + 1) + ': expected = in the equation for ' + name);
      p++;
      const r = sfParseTerm(T, p);
      if (T[r.pos].k !== 'eof') throw new Error('Line ' + (ln + 1) + ': unexpected input after the body');
      if (P[name]) throw new Error('There is more than one equation for ' + name + ' — SFUN allows only one per function name');
      P[name] = { params: params, body: r.e };
    });
    return P;
  }
  const SF_OPS = { '+': '+', '-': '−', '*': '∗', '/': '/' };
  function sfShow(t, prec) {
    prec = prec || 0;
    switch (t.k) {
      case 'num': return String(t.n);
      case 'bool': return t.b ? 'True' : 'False';
      case 'var': return t.v;
      case 'not': return '¬' + sfShow(t.t, 4);
      case 'op': { const s = sfShow(t.t1, 2) + ' ' + SF_OPS[t.op] + ' ' + sfShow(t.t2, 3); return prec > 2 ? '(' + s + ')' : s; }
      case 'bop': { const s = sfShow(t.t1, 2) + ' ' + (t.op === '>=' ? '≥' : t.op === '<=' ? '≤' : t.op) + ' ' + sfShow(t.t2, 2); return prec > 1 ? '(' + s + ')' : s; }
      case 'and': { const s = sfShow(t.t1, 2) + ' ∧ ' + sfShow(t.t2, 2); return prec > 1 ? '(' + s + ')' : s; }
      case 'if': { const s = 'if ' + sfShow(t.t0, 0) + ' then ' + sfShow(t.t1, 0) + ' else ' + sfShow(t.t2, 0); return prec > 0 ? '(' + s + ')' : s; }
      case 'call': return t.f + (t.args.length ? '(' + t.args.map(a => sfShow(a, 0)).join(', ') + ')' : '');
      default: return '?';
    }
  }
  function sfSubst(t, env) {
    switch (t.k) {
      case 'var': return Object.prototype.hasOwnProperty.call(env, t.v) ? env[t.v] : t;
      case 'num': case 'bool': return t;
      case 'not': return { k: 'not', t: sfSubst(t.t, env) };
      case 'op': return { k: 'op', op: t.op, t1: sfSubst(t.t1, env), t2: sfSubst(t.t2, env) };
      case 'bop': return { k: 'bop', op: t.op, t1: sfSubst(t.t1, env), t2: sfSubst(t.t2, env) };
      case 'and': return { k: 'and', t1: sfSubst(t.t1, env), t2: sfSubst(t.t2, env) };
      case 'if': return { k: 'if', t0: sfSubst(t.t0, env), t1: sfSubst(t.t1, env), t2: sfSubst(t.t2, env) };
      case 'call': return { k: 'call', f: t.f, args: t.args.map(a => sfSubst(a, env)) };
      default: return t;
    }
  }
  function sfSubstLabel(body, params, args) {
    if (!params.length) return sfShow(body, 0);
    return sfShow(body, 0) + '{' + params.map((x, i) => x + ' ↦ ' + sfShow(args[i], 0)).join(', ') + '}';
  }
  let sfBudget = 0;
  function sfEval(t, P, strat) {
    if (sfBudget++ > 4000) throw { sfErr: 'No finite derivation could be built — the term appears to have no value under this strategy.' };
    const D = (rule, concl, prem, side) => ({ rule: rule, concl: concl, prem: prem || [], side: side });
    switch (t.k) {
      case 'num': return { v: t, d: D('n', sfShow(t, 0) + ' ⇓<sub>P</sub> ' + t.n) };
      case 'bool': return { v: t, d: D('b', sfShow(t, 0) + ' ⇓<sub>P</sub> ' + sfShow(t, 0)) };
      case 'var': throw { sfErr: 'the term is not closed: the variable ' + t.v + ' has no value' };
      case 'op': {
        const r1 = sfEval(t.t1, P, strat), r2 = sfEval(t.t2, P, strat);
        const n1 = r1.v.n, n2 = r2.v.n;
        if (typeof n1 !== 'number' || typeof n2 !== 'number') throw { sfErr: 'arithmetic applied to a non-integer (the term is not well-typed)' };
        if (t.op === '/' && n2 === 0) throw { sfErr: 'division by zero' };
        const n = t.op === '+' ? n1 + n2 : t.op === '-' ? n1 - n2 : t.op === '*' ? n1 * n2 : Math.trunc(n1 / n2);
        const v = { k: 'num', n: n };
        return { v: v, d: D('op', sfShow(t, 0) + ' ⇓<sub>P</sub> ' + n, [r1.d, r2.d], 'if ' + n1 + ' ' + SF_OPS[t.op] + ' ' + n2 + ' = ' + n) };
      }
      case 'bop': {
        const r1 = sfEval(t.t1, P, strat), r2 = sfEval(t.t2, P, strat);
        const n1 = r1.v.n, n2 = r2.v.n;
        if (typeof n1 !== 'number' || typeof n2 !== 'number') throw { sfErr: 'comparison applied to a non-integer (the term is not well-typed)' };
        const b = t.op === '>' ? n1 > n2 : t.op === '<' ? n1 < n2 : t.op === '=' ? n1 === n2 : t.op === '>=' ? n1 >= n2 : n1 <= n2;
        const v = { k: 'bool', b: b };
        const sym = t.op === '>=' ? '≥' : t.op === '<=' ? '≤' : t.op;
        return { v: v, d: D('bop', sfShow(t, 0) + ' ⇓<sub>P</sub> ' + (b ? 'True' : 'False'), [r1.d, r2.d], 'if ' + n1 + ' ' + sym + ' ' + n2 + ' = ' + (b ? 'True' : 'False')) };
      }
      case 'and': {
        const r1 = sfEval(t.t1, P, strat), r2 = sfEval(t.t2, P, strat);
        const v = { k: 'bool', b: r1.v.b && r2.v.b };
        return { v: v, d: D('and', sfShow(t, 0) + ' ⇓<sub>P</sub> ' + (v.b ? 'True' : 'False'), [r1.d, r2.d], 'if b₁ ∧ b₂ = ' + (v.b ? 'True' : 'False')) };
      }
      case 'not': {
        const r = sfEval(t.t, P, strat);
        const v = { k: 'bool', b: !r.v.b };
        return { v: v, d: D('not', sfShow(t, 0) + ' ⇓<sub>P</sub> ' + (v.b ? 'True' : 'False'), [r.d], 'if b = ¬' + (r.v.b ? 'True' : 'False')) };
      }
      case 'if': {
        const r0 = sfEval(t.t0, P, strat);
        if (typeof r0.v.b !== 'boolean') throw { sfErr: 'the condition of an if did not evaluate to a Boolean' };
        const branch = r0.v.b ? t.t1 : t.t2;
        const rb = sfEval(branch, P, strat);
        return { v: rb.v, d: D(r0.v.b ? 'if_t' : 'if_f', sfShow(t, 0) + ' ⇓<sub>P</sub> ' + sfShow(rb.v, 0), [r0.d, rb.d]) };
      }
      case 'call': {
        const def = P[t.f];
        if (!def) throw { sfErr: 'there is no equation for the function ' + t.f };
        if (def.params.length !== t.args.length) throw { sfErr: t.f + ' has arity ' + def.params.length + ' but is applied to ' + t.args.length + ' argument(s)' };
        if (strat === 'cbv') {
          const rs = t.args.map(a => sfEval(a, P, strat));
          const env = {}; def.params.forEach((x, i) => env[x] = rs[i].v);
          const rb = sfEval(sfSubst(def.body, env), P, strat);
          const label = sfSubstLabel(def.body, def.params, rs.map(r => r.v));
          const bodyD = Object.assign({}, rb.d, { concl: label + ' ⇓<sub>P</sub> ' + sfShow(rb.v, 0) });
          return { v: rb.v, d: D('fn_val', sfShow(t, 0) + ' ⇓<sub>P</sub> ' + sfShow(rb.v, 0), rs.map(r => r.d).concat([bodyD])) };
        } else {
          const env = {}; def.params.forEach((x, i) => env[x] = t.args[i]);
          const rb = sfEval(sfSubst(def.body, env), P, strat);
          const label = sfSubstLabel(def.body, def.params, t.args);
          const bodyD = Object.assign({}, rb.d, { concl: label + ' ⇓<sub>P</sub> ' + sfShow(rb.v, 0) });
          return { v: rb.v, d: D('fn_name', sfShow(t, 0) + ' ⇓<sub>P</sub> ' + sfShow(rb.v, 0), [bodyD]) };
        }
      }
      default: throw { sfErr: 'unknown term' };
    }
  }
  function sfPreset(w) {
    const G = document.getElementById('sf-prog'), T = document.getElementById('sf-term');
    const std = 'infinity = infinity + 1\nfortytwo(x) = 42\nsquare(x) = x * x\nmax(x, y) = if x >= y then x else y';
    G.value = std;
    if (w === 'max') T.value = 'max(3, square(2))';
    else if (w === 'sq') T.value = 'square(2 + 1)';
    else if (w === 'inf') T.value = 'fortytwo(infinity)';
    else if (w === 'fact') { G.value = std + '\nfact(x) = if x <= 0 then 1 else x * fact(x - 1)'; T.value = 'fact(3)'; }
    runSfun();
  }
  function runSfun() {
    const out = document.getElementById('sf-output');
    let P, t;
    try { P = sfParseProgram(document.getElementById('sf-prog').value); t = sfParseTerm(sfLex(document.getElementById('sf-term').value), 0); }
    catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    if (t.pos !== undefined) t = t.e;
    const runs = [];
    ['cbv', 'cbn'].forEach(strat => {
      sfBudget = 0;
      try { const r = sfEval(t, P, strat); runs.push({ strat: strat, ok: true, v: r.v, d: r.d, size: infSize(r.d) }); }
      catch (e) { runs.push({ strat: strat, ok: false, why: e && e.sfErr ? e.sfErr : String(e && e.message || e) }); }
    });
    let html = '<div style="margin-bottom:10px;">';
    runs.forEach(r => {
      html += `<span class="stat-pill ${r.ok ? 'b' : 'c'}">${r.strat === 'cbv' ? 'call-by-value' : 'call-by-name'}: ${r.ok ? sfShow(r.v, 0) + ' (' + r.size + ' rules)' : 'no derivation'}</span>`;
    });
    html += '</div>';
    runs.forEach(r => {
      const name = r.strat === 'cbv' ? 'Call-by-value <span style="font-weight:400; font-size:12px; color:var(--ink-muted);">(fn<sub>val</sub>)</span>' : 'Call-by-name <span style="font-weight:400; font-size:12px; color:var(--ink-muted);">(fn<sub>name</sub>)</span>';
      html += `<h4 style="font-size:16px; margin-top:16px;">${name}</h4>`;
      if (!r.ok) {
        html += `<div class="verdict bad">✗ <strong>No derivation exists</strong> — ${esc(r.why)}</div>`;
      } else if (r.size > 130) {
        html += `<div class="verdict warn">The derivation has ${r.size} rule applications — too large to draw legibly. Try a smaller term.</div>`;
      } else {
        html += `<div class="deriv-box">${infHtml(r.d, true)}</div>`;
      }
    });
    const a = runs[0], b = runs[1];
    if (a.ok && !b.ok) html += `<div class="verdict warn">Call-by-value succeeds but call-by-name does not — unusual; check the program.</div>`;
    else if (!a.ok && b.ok) html += `<div class="verdict bad">💥 <strong>Call-by-value has no derivation; call-by-name gives ${esc(sfShow(b.v, 0))}.</strong> Under fn<sub>val</sub> every argument must be evaluated to a value first, and here one of them has none. Under fn<sub>name</sub> the argument is substituted <em>unevaluated</em> and then discarded. This is exactly the <code>fortytwo(infinity)</code> case.</div>`;
    else if (a.ok && b.ok) {
      if (a.size !== b.size) {
        const bigger = a.size > b.size ? 'call-by-value' : 'call-by-name';
        html += `<div class="verdict safe">✓ Both give <strong>${esc(sfShow(a.v, 0))}</strong>, but the derivations differ in size: <strong>${a.size}</strong> rule applications for call-by-value vs <strong>${b.size}</strong> for call-by-name. The larger (${bigger}) contains <em>repeated sub-derivations</em> — the same argument evaluated more than once. That duplication is what sharing removes in a lazy implementation.</div>`;
      } else {
        html += `<div class="verdict safe">✓ Both strategies give <strong>${esc(sfShow(a.v, 0))}</strong> with derivations of the same size. Try <code>square(2 + 1)</code> or <code>max(3, square(2))</code> to see them diverge.</div>`;
      }
    }
    out.innerHTML = html;
    ixTrace('sfT', 'sf-output', { label: 'rule application', reset: true });
  }
