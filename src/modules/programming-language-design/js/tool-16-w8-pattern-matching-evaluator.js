  /* ============================================================
     TOOL 16 (W8): PATTERN-MATCHING EVALUATOR
     Mini-Haskell with constructors, list syntax and pattern matching.
     ============================================================ */
  function pmLex(src) {
    const T = []; let i = 0; const s = src;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c)) { let d = ''; while (i < s.length && /[0-9]/.test(s[i])) d += s[i++]; T.push({ k: 'num', v: +d }); continue; }
      if (/[A-Za-z_]/.test(c)) {
        let w = ''; while (i < s.length && /[A-Za-z0-9_']/.test(s[i])) w += s[i++];
        if (['if', 'then', 'else', 'True', 'False'].includes(w)) T.push({ k: w });
        else if (w === '_') T.push({ k: 'wild' });
        else T.push({ k: /^[A-Z]/.test(w) ? 'con' : 'id', v: w });
        continue;
      }
      const two = s.substr(i, 2);
      if (['==', '<=', '>=', '/=', '&&', '||'].includes(two)) { T.push({ k: 'op', v: two }); i += 2; continue; }
      if (c === '_') { T.push({ k: 'wild' }); i++; continue; }
      if ('+-*/<>'.includes(c)) { T.push({ k: 'op', v: c }); i++; continue; }
      if (c === ':') { T.push({ k: 'cons' }); i++; continue; }
      if ('()[],'.includes(c)) { T.push({ k: c }); i++; continue; }
      if (c === '=') { T.push({ k: '=' }); i++; continue; }
      throw new Error('Unexpected character "' + c + '"');
    }
    T.push({ k: 'eof' }); return T;
  }
  const PM_NIL = { k: 'con', c: '[]', args: [] };
  function pmListFrom(items) { return items.reduceRight((acc, x) => ({ k: 'con', c: ':', args: [x, acc] }), PM_NIL); }
  function pmParseExpr(T, pos) {
    let p = pos;
    const peek = () => T[p].k, tok = () => T[p];
    const eat = k => { if (T[p].k !== k) throw new Error('Expected ' + k + ', found ' + (T[p].v !== undefined ? T[p].v : T[p].k)); return T[p++]; };
    function atom() {
      if (peek() === 'num') return { k: 'num', n: eat('num').v };
      if (peek() === 'True') { eat('True'); return { k: 'bool', b: true }; }
      if (peek() === 'False') { eat('False'); return { k: 'bool', b: false }; }
      if (peek() === 'id') return { k: 'var', v: eat('id').v };
      if (peek() === 'con') return { k: 'con', c: eat('con').v, args: [] };
      if (peek() === '[') {
        eat('['); const items = [];
        if (peek() !== ']') { items.push(expr()); while (peek() === ',') { eat(','); items.push(expr()); } }
        eat(']'); return pmListFrom(items);
      }
      if (peek() === '(') { eat('('); const e = expr(); eat(')'); return e; }
      if (peek() === 'if') { eat('if'); const c = expr(); eat('then'); const a = expr(); eat('else'); const b = expr(); return { k: 'if', c: c, t: a, e: b }; }
      throw new Error('Expected an expression, found ' + peek());
    }
    function app() {
      let head = atom();
      const args = [];
      while (['num', 'id', 'con', '(', '[', 'True', 'False'].includes(peek())) args.push(atom());
      if (!args.length) return head;
      if (head.k === 'con') return { k: 'con', c: head.c, args: head.args.concat(args) };
      return args.reduce((f, a) => ({ k: 'app', f: f, a: a }), head);
    }
    function mul() { let l = app(); while (peek() === 'op' && ['*', '/'].includes(tok().v)) { const o = eat('op').v; l = { k: 'bin', op: o, l: l, r: app() }; } return l; }
    function add() { let l = mul(); while (peek() === 'op' && ['+', '-'].includes(tok().v)) { const o = eat('op').v; l = { k: 'bin', op: o, l: l, r: mul() }; } return l; }
    function consE() { const l = add(); if (peek() === 'cons') { eat('cons'); return { k: 'con', c: ':', args: [l, consE()] }; } return l; }
    function cmp() { let l = consE(); if (peek() === 'op' && ['==', '<', '>', '<=', '>=', '/='].includes(tok().v)) { const o = eat('op').v; l = { k: 'bin', op: o, l: l, r: consE() }; } return l; }
    function expr() { let l = cmp(); while (peek() === 'op' && ['&&', '||'].includes(tok().v)) { const o = eat('op').v; l = { k: 'bin', op: o, l: l, r: cmp() }; } return l; }
    const e = expr(); return { e: e, pos: p };
  }
  function pmParsePat(T, pos, top) {
    let p = pos;
    const peek = () => T[p].k;
    function patAtom() {
      if (T[p].k === 'num') return { k: 'plit', n: T[p++].v };
      if (T[p].k === 'wild') { p++; return { k: 'pwild' }; }
      if (T[p].k === 'id') return { k: 'pvar', v: T[p++].v };
      if (T[p].k === 'con') return { k: 'pcon', c: T[p++].v, args: [] };
      if (T[p].k === '[') { p++; if (T[p].k !== ']') throw new Error('only [] is supported as a list pattern'); p++; return { k: 'pcon', c: '[]', args: [] }; }
      if (T[p].k === '(') { p++; const inner = pmParsePat(T, p, true); p = inner.pos; if (T[p].k !== ')') throw new Error('Expected ) in a pattern'); p++; return inner.pat; }
      throw new Error('Expected a pattern, found ' + T[p].k);
    }
    let first;
    if (top && T[p].k === 'con') {                      // constructor applied to sub-patterns
      const c = T[p++].v; const args = [];
      while (['num', 'wild', 'id', 'con', '[', '('].includes(T[p].k)) { const a = patAtom(); args.push(a); }
      first = { k: 'pcon', c: c, args: args };
    } else first = patAtom();
    if (T[p].k === 'cons') { p++; const rest = pmParsePat(T, p, true); return { pat: { k: 'pcon', c: ':', args: [first, rest.pat] }, pos: rest.pos }; }
    return { pat: first, pos: p };
  }
  function pmParseDefs(src) {
    const defs = {};
    src.split('\n').forEach((line, ln) => {
      const l = line.trim(); if (!l || l.startsWith('--')) return;
      const T = pmLex(l);
      let p = 0;
      if (T[p].k !== 'id') throw new Error('Line ' + (ln + 1) + ': a definition must start with a function name');
      const name = T[p++].v;
      const pats = [];
      while (T[p].k !== '=' && T[p].k !== 'eof') { const r = pmParsePat(T, p, false); pats.push(r.pat); p = r.pos; }
      if (T[p].k !== '=') throw new Error('Line ' + (ln + 1) + ': expected = in the definition of ' + name);
      p++;
      const r = pmParseExpr(T, p);
      if (T[r.pos].k !== 'eof') throw new Error('Line ' + (ln + 1) + ': unexpected input after the body');
      if (!defs[name]) defs[name] = { arity: pats.length, eqs: [] };
      if (defs[name].arity !== pats.length) throw new Error('Equations for ' + name + ' have different numbers of arguments');
      defs[name].eqs.push({ pats: pats, body: r.e, line: ln + 1 });
    });
    return defs;
  }
  function pmShow(e, prec) {
    prec = prec || 0;
    switch (e.k) {
      case 'num': return String(e.n);
      case 'bool': return e.b ? 'True' : 'False';
      case 'var': return e.v;
      case 'app': { const s = pmShow(e.f, 9) + ' ' + pmShow(e.a, 10); return prec > 9 ? '(' + s + ')' : s; }
      case 'bin': { const pr = FP_PREC[e.op] || 2; const s = pmShow(e.l, pr) + ' ' + e.op + ' ' + pmShow(e.r, pr + 1); return prec > pr ? '(' + s + ')' : s; }
      case 'if': { const s = 'if ' + pmShow(e.c, 0) + ' then ' + pmShow(e.t, 0) + ' else ' + pmShow(e.e, 0); return prec > 0 ? '(' + s + ')' : s; }
      case 'con': {
        if (e.c === '[]') return '[]';
        if (e.c === ':') {                                  // print as a list when fully spined
          const items = []; let cur = e;
          while (cur && cur.k === 'con' && cur.c === ':') { items.push(cur.args[0]); cur = cur.args[1]; }
          if (cur && cur.k === 'con' && cur.c === '[]') return '[' + items.map(x => pmShow(x, 0)).join(', ') + ']';
          const s = pmShow(e.args[0], 6) + ' : ' + pmShow(e.args[1], 5);
          return prec > 5 ? '(' + s + ')' : s;
        }
        if (!e.args.length) return e.c;
        const s = e.c + ' ' + e.args.map(a => pmShow(a, 10)).join(' ');
        return prec > 9 ? '(' + s + ')' : s;
      }
      default: return '?';
    }
  }
  function pmIsVal(e) {
    if (e.k === 'num' || e.k === 'bool') return true;
    if (e.k === 'con') return e.args.every(pmIsVal);
    return false;
  }
  function pmMatch(pat, e, env) {
    switch (pat.k) {
      case 'pwild': return true;
      case 'pvar': env[pat.v] = e; return true;
      case 'plit': return e.k === 'num' && e.n === pat.n;
      case 'pcon': {
        if (e.k !== 'con' || e.c !== pat.c || e.args.length !== pat.args.length) return false;
        for (let i = 0; i < pat.args.length; i++) if (!pmMatch(pat.args[i], e.args[i], env)) return false;
        return true;
      }
      default: return false;
    }
  }
  function pmNeedsValue(pat) { return pat.k === 'plit' || pat.k === 'pcon'; }
  function pmSubst(e, env) {
    switch (e.k) {
      case 'var': return Object.prototype.hasOwnProperty.call(env, e.v) ? env[e.v] : e;
      case 'num': case 'bool': return e;
      case 'app': return { k: 'app', f: pmSubst(e.f, env), a: pmSubst(e.a, env) };
      case 'bin': return { k: 'bin', op: e.op, l: pmSubst(e.l, env), r: pmSubst(e.r, env) };
      case 'if': return { k: 'if', c: pmSubst(e.c, env), t: pmSubst(e.t, env), e: pmSubst(e.e, env) };
      case 'con': return { k: 'con', c: e.c, args: e.args.map(a => pmSubst(a, env)) };
      default: return e;
    }
  }
  function pmSpine(e) { const args = []; let h = e; while (h.k === 'app') { args.unshift(h.a); h = h.f; } return { head: h, args: args }; }
  function pmStep(e, defs) {
    // returns {e, why} or null
    switch (e.k) {
      case 'num': case 'bool': return null;
      case 'if': {
        if (e.c.k !== 'bool') { const r = pmStep(e.c, defs); return r ? { e: { k: 'if', c: r.e, t: e.t, e: e.e }, why: r.why } : null; }
        return { e: e.c.b ? e.t : e.e, why: e.c.b ? 'if True → then' : 'if False → else' };
      }
      case 'bin': {
        if (!pmIsVal(e.l)) { const r = pmStep(e.l, defs); return r ? { e: { k: 'bin', op: e.op, l: r.e, r: e.r }, why: r.why } : null; }
        if (!pmIsVal(e.r)) { const r = pmStep(e.r, defs); return r ? { e: { k: 'bin', op: e.op, l: e.l, r: r.e }, why: r.why } : null; }
        if (e.op === '&&') return { e: { k: 'bool', b: e.l.b && e.r.b }, why: 'and' };
        if (e.op === '||') return { e: { k: 'bool', b: e.l.b || e.r.b }, why: 'or' };
        if (e.l.k === 'num' && e.r.k === 'num') {
          const v = fpApplyPrim(e.op, e.l.n, e.r.n);
          if (!v) return null;
          return { e: v, why: e.l.n + ' ' + e.op + ' ' + e.r.n };
        }
        if (e.op === '==' || e.op === '/=') {                 // structural equality on values
          const eq = pmShow(e.l, 0) === pmShow(e.r, 0);
          return { e: { k: 'bool', b: e.op === '==' ? eq : !eq }, why: 'structural ' + e.op };
        }
        return null;
      }
      case 'con': {
        for (let i = 0; i < e.args.length; i++) {
          if (!pmIsVal(e.args[i])) {
            const r = pmStep(e.args[i], defs);
            if (r) { const args = e.args.slice(); args[i] = r.e; return { e: { k: 'con', c: e.c, args: args }, why: r.why }; }
          }
        }
        return null;
      }
      case 'app': {
        const sp = pmSpine(e);
        if (sp.head.k !== 'var') return null;
        const d = defs[sp.head.v];
        if (!d || sp.args.length < d.arity) return null;
        const used = sp.args.slice(0, d.arity);
        for (const eq of d.eqs) {
          let env = {}, ok = true, forcedIdx = -1;
          for (let i = 0; i < eq.pats.length; i++) {
            const p = eq.pats[i], a = used[i];
            if (pmNeedsValue(p) && !pmIsVal(a)) { forcedIdx = i; ok = false; break; }
            if (!pmMatch(p, a, env)) { ok = false; break; }
          }
          if (forcedIdx >= 0) {
            const r = pmStep(used[forcedIdx], defs);
            if (!r) return null;
            const args = sp.args.slice(); args[forcedIdx] = r.e;
            let ne = sp.head; args.forEach(a => ne = { k: 'app', f: ne, a: a });
            return { e: ne, why: r.why };
          }
          if (!ok) continue;
          let body = pmSubst(eq.body, env);
          for (let i = d.arity; i < sp.args.length; i++) body = { k: 'app', f: body, a: sp.args[i] };
          return { e: body, why: 'eq. ' + sp.head.v + ' (line ' + eq.line + ')' };
        }
        return null;
      }
      default: return null;
    }
  }
  function pmPreset(w) {
    const D = document.getElementById('pm-defs'), E = document.getElementById('pm-expr');
    const std = 'size [] = 0\nsize (x : xs) = 1 + size xs\nheight (Leaf a) = 1\nheight (Branch l r) = 1 + max (height l) (height r)\nmax x y = if x > y then x else y\nadd Zero x = x\nadd (Succ x) y = Succ (add x y)';
    D.value = std;
    if (w === 'size') E.value = 'size [1, 6, 1, 8, 0]';
    else if (w === 'height') E.value = 'height (Branch (Leaf 1) (Branch (Leaf 2) (Leaf 3)))';
    else if (w === 'add') E.value = 'add (Succ (Succ Zero)) Zero';
    else if (w === 'take') { D.value = std + "\ntake' 0 l = []\ntake' n [] = []\ntake' n (x : xs) = x : (take' (n - 1) xs)"; E.value = "take' 3 [1, 2, 3, 4, 5]"; }
    else if (w === 'elem') { D.value = std + "\nelem' x [] = False\nelem' x (y : ys) = (x == y) || elem' x ys"; E.value = "elem' 8 [1, 6, 1, 8, 0]"; }
    runPatMatch();
  }
  function runPatMatch() {
    const out = document.getElementById('pm-output');
    let defs, e;
    try { defs = pmParseDefs(document.getElementById('pm-defs').value); const r = pmParseExpr(pmLex(document.getElementById('pm-expr').value), 0); e = r.e; }
    catch (err) { out.innerHTML = `<div class="tool-error">${esc(err.message)}</div>`; return; }
    const seq = [{ text: pmShow(e, 0), why: null }];
    let cur = e, n = 0;
    const CAP = 120;
    while (n < CAP) {
      const r = pmStep(cur, defs);
      if (!r) break;
      cur = r.e; n++;
      seq.push({ text: pmShow(cur, 0), why: r.why });
    }
    const done = n < CAP;
    let html = `<div style="margin-bottom:10px;"><span class="stat-pill dark">${n} reduction${n === 1 ? '' : 's'}</span>`;
    html += `<span class="stat-pill ${done && pmIsVal(cur) ? 'b' : 'c'}">${done ? (pmIsVal(cur) ? 'normal form: ' + esc(pmShow(cur, 0)) : 'stuck') : 'capped at ' + CAP}</span></div>`;
    html += '<div class="red-seq">';
    const show = seq.length > 26 ? seq.slice(0, 13).concat([{ ell: seq.length - 26 }], seq.slice(-13)) : seq;
    let k = 0;
    show.forEach(st => {
      if (st.ell) { html += `<div class="red-step" data-step="${k}"><span class="rs-n">⋯</span><span class="rs-a"></span><span class="rs-e" style="color:var(--ink-muted);">(${st.ell} more)</span></div>`; k += st.ell; return; }
      const isLast = (k === seq.length - 1) && done && pmIsVal(cur);
      html += `<div class="red-step ${isLast ? 'nf' : ''}" data-step="${k}"><span class="rs-n">${k}</span><span class="rs-a">${k ? '→' : ''}</span><span class="rs-e">${esc(st.text)}${st.why ? '<span class="rs-why">' + esc(st.why) + '</span>' : ''}</span></div>`;
      k++;
    });
    html += '</div>';
    if (done && !pmIsVal(cur)) {
      html += `<div class="verdict warn">⚠ <strong>Stuck</strong> — no equation matches, or the head is not a defined function. Check that the patterns cover this case, and remember they are tried <em>in the order written</em>.</div>`;
    } else if (!done) {
      html += `<div class="verdict bad">Reduction did not terminate within ${CAP} steps.</div>`;
    }
    out.innerHTML = html;
    ixTrace('pmT', 'pm-output', { label: 'reduction', reset: true });
  }
