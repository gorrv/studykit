  /* ============================================================
     TOOL 12 (W6): REDUCTION STRATEGY EXPLORER
     A miniature functional language, reduced under CBN / CBV / lazy.
     Nodes are MUTABLE so that lazy evaluation can share sub-terms.
     ============================================================ */
  /* ---------- lexer / parser ---------- */
  function fpLex(src) {
    const T = []; let i = 0;
    const s = src.replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '/=');
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c)) { let d = ''; while (i < s.length && /[0-9]/.test(s[i])) d += s[i++]; T.push({ k: 'num', v: +d }); continue; }
      if (/[A-Za-z_]/.test(c)) {
        let w = ''; while (i < s.length && /[A-Za-z0-9_']/.test(s[i])) w += s[i++];
        T.push(['if', 'then', 'else', 'True', 'False'].includes(w) ? { k: w } : { k: 'id', v: w });
        continue;
      }
      const two = s.substr(i, 2);
      if (['==', '<=', '>=', '/='].includes(two)) { T.push({ k: 'op', v: two }); i += 2; continue; }
      if ('+-*/<>'.includes(c)) { T.push({ k: 'op', v: c }); i++; continue; }
      if (c === '(') { T.push({ k: '(' }); i++; continue; }
      if (c === ')') { T.push({ k: ')' }); i++; continue; }
      if (c === '=') { T.push({ k: '=' }); i++; continue; }
      throw new Error('Unexpected character "' + c + '"');
    }
    T.push({ k: 'eof' }); return T;
  }
  function fpParseExpr(T, pos) {
    let p = pos;
    const peek = () => T[p].k, tok = () => T[p];
    const eat = k => { if (T[p].k !== k) throw new Error('Expected ' + k + ', found ' + (T[p].v !== undefined ? T[p].v : T[p].k)); return T[p++]; };
    function atom() {
      if (peek() === 'num') return { k: 'num', n: eat('num').v };
      if (peek() === 'True') { eat('True'); return { k: 'bool', b: true }; }
      if (peek() === 'False') { eat('False'); return { k: 'bool', b: false }; }
      if (peek() === 'id') return { k: 'var', v: eat('id').v };
      if (peek() === '(') { eat('('); const e = expr(); eat(')'); return e; }
      if (peek() === 'if') { eat('if'); const c = expr(); eat('then'); const t = expr(); eat('else'); const f = expr(); return { k: 'if', c: c, t: t, e: f }; }
      throw new Error('Expected an expression, found ' + peek());
    }
    function app() {                      // juxtaposition, left-associative
      let e = atom();
      while (['num', 'id', '(', 'True', 'False'].includes(peek())) e = { k: 'app', f: e, a: atom() };
      return e;
    }
    function unary() {
      if (peek() === 'op' && tok().v === '-') { eat('op'); const a = unary(); return { k: 'bin', op: '-', l: { k: 'num', n: 0 }, r: a }; }
      return app();
    }
    function mul() { let l = unary(); while (peek() === 'op' && ['*', '/'].includes(tok().v)) { const o = eat('op').v; l = { k: 'bin', op: o, l: l, r: unary() }; } return l; }
    function add() { let l = mul(); while (peek() === 'op' && ['+', '-'].includes(tok().v)) { const o = eat('op').v; l = { k: 'bin', op: o, l: l, r: mul() }; } return l; }
    function expr() {
      let l = add();
      if (peek() === 'op' && ['==', '<', '>', '<=', '>=', '/='].includes(tok().v)) { const o = eat('op').v; l = { k: 'bin', op: o, l: l, r: add() }; }
      return l;
    }
    const e = expr();
    return { e: e, pos: p };
  }
  function fpParse(src) { const T = fpLex(src); const r = fpParseExpr(T, 0); if (T[r.pos].k !== 'eof') throw new Error('Unexpected input after the expression'); return r.e; }
  function fpParseDefs(src) {
    const defs = {};
    src.split('\n').forEach((line, ln) => {
      const l = line.trim(); if (!l || l.startsWith('--')) return;
      const T = fpLex(l);
      let p = 0;
      if (T[p].k !== 'id') throw new Error('Line ' + (ln + 1) + ': a definition must start with a function name');
      const name = T[p++].v;
      const pats = [];
      while (T[p].k === 'id' || T[p].k === 'num') {
        pats.push(T[p].k === 'num' ? { k: 'plit', n: T[p].v } : { k: 'pvar', v: T[p].v });
        p++;
      }
      if (T[p].k !== '=') throw new Error('Line ' + (ln + 1) + ': expected = after the parameters of ' + name);
      p++;
      const r = fpParseExpr(T, p);
      if (T[r.pos].k !== 'eof') throw new Error('Line ' + (ln + 1) + ': unexpected input after the body');
      if (!defs[name]) defs[name] = { arity: pats.length, eqs: [] };
      if (defs[name].arity !== pats.length) throw new Error('Equations for ' + name + ' have different numbers of arguments');
      defs[name].eqs.push({ pats: pats, body: r.e });
    });
    return defs;
  }
  /* ---------- printing ---------- */
  const FP_PREC = { '==': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '/=': 1, '+': 2, '-': 2, '*': 3, '/': 3 };
  function fpShow(e, prec, mark) {
    prec = prec || 0;
    let s;
    switch (e.k) {
      case 'num': s = String(e.n); break;
      case 'bool': s = e.b ? 'True' : 'False'; break;
      case 'var': s = e.v; break;
      case 'app': s = fpShow(e.f, 9, mark) + ' ' + fpShow(e.a, 10, mark); if (prec > 9) s = '(' + s + ')'; break;
      case 'bin': {
        const pr = FP_PREC[e.op];
        s = fpShow(e.l, pr, mark) + ' ' + e.op + ' ' + fpShow(e.r, pr + 1, mark);
        if (prec > pr) s = '(' + s + ')';
        break;
      }
      case 'if': s = 'if ' + fpShow(e.c, 0, mark) + ' then ' + fpShow(e.t, 0, mark) + ' else ' + fpShow(e.e, 0, mark); if (prec > 0) s = '(' + s + ')'; break;
      default: s = '?';
    }
    if (mark && e === mark) return '' + s + '';
    return s;
  }
  function fpShowMarked(e, mark) {
    const raw = fpShow(e, 0, mark);
    return esc(raw).replace(//g, '<span class="red-redex">').replace(//g, '</span>');
  }
  /* ---------- reduction ---------- */
  const fpIsVal = e => e.k === 'num' || e.k === 'bool';
  function fpCopy(e) {
    switch (e.k) {
      case 'num': case 'bool': case 'var': return Object.assign({}, e);
      case 'app': return { k: 'app', f: fpCopy(e.f), a: fpCopy(e.a) };
      case 'bin': return { k: 'bin', op: e.op, l: fpCopy(e.l), r: fpCopy(e.r) };
      case 'if': return { k: 'if', c: fpCopy(e.c), t: fpCopy(e.t), e: fpCopy(e.e) };
      default: return Object.assign({}, e);
    }
  }
  function fpSubst(body, env, share) {   // env: name -> node
    switch (body.k) {
      case 'var': {
        if (Object.prototype.hasOwnProperty.call(env, body.v)) return share ? env[body.v] : fpCopy(env[body.v]);
        return Object.assign({}, body);
      }
      case 'num': case 'bool': return Object.assign({}, body);
      case 'app': return { k: 'app', f: fpSubst(body.f, env, share), a: fpSubst(body.a, env, share) };
      case 'bin': return { k: 'bin', op: body.op, l: fpSubst(body.l, env, share), r: fpSubst(body.r, env, share) };
      case 'if': return { k: 'if', c: fpSubst(body.c, env, share), t: fpSubst(body.t, env, share), e: fpSubst(body.e, env, share) };
      default: return body;
    }
  }
  function fpBecome(node, other) { for (const k in node) delete node[k]; Object.assign(node, other); }
  function fpSpine(e) { const args = []; let h = e; while (h.k === 'app') { args.unshift(h.a); h = h.f; } return { head: h, args: args }; }
  function fpApplyPrim(op, a, b) {
    switch (op) {
      case '+': return { k: 'num', n: a + b }; case '-': return { k: 'num', n: a - b };
      case '*': return { k: 'num', n: a * b };
      case '/': if (b === 0) return null; return { k: 'num', n: Math.trunc(a / b) };
      case '==': return { k: 'bool', b: a === b }; case '/=': return { k: 'bool', b: a !== b };
      case '<': return { k: 'bool', b: a < b }; case '>': return { k: 'bool', b: a > b };
      case '<=': return { k: 'bool', b: a <= b }; case '>=': return { k: 'bool', b: a >= b };
    }
    return null;
  }
  /* one reduction step; mutates in place; returns {rule, redex} or null */
  function fpStep(node, defs, strat) {
    const share = (strat === 'lazy');
    switch (node.k) {
      case 'num': case 'bool': return null;
      case 'var': {
        const d = defs[node.v];
        if (d && d.arity === 0) { const body = fpSubst(d.eqs[0].body, {}, false); const redex = node; fpBecome(node, body); return { rule: 'unfold ' + redex.v, redex: node }; }
        return null;
      }
      case 'if': {
        if (node.c.k !== 'bool') { const r = fpStep(node.c, defs, strat); return r; }
        const chosen = node.c.b ? node.t : node.e;
        const rule = node.c.b ? 'if True → then-branch' : 'if False → else-branch';
        fpBecome(node, chosen); return { rule: rule, redex: node };
      }
      case 'bin': {
        // primitives need both operands as values, whatever the strategy
        if (!fpIsVal(node.l)) { const r = fpStep(node.l, defs, strat); if (r) return r; }
        if (!fpIsVal(node.r)) { const r = fpStep(node.r, defs, strat); if (r) return r; }
        if (node.l.k === 'num' && node.r.k === 'num') {
          const v = fpApplyPrim(node.op, node.l.n, node.r.n);
          if (!v) return null;
          const shown = node.l.n + ' ' + node.op + ' ' + node.r.n;
          fpBecome(node, v); return { rule: shown, redex: node };
        }
        return null;
      }
      case 'app': {
        const sp = fpSpine(node);
        if (sp.head.k !== 'var') { const r = fpStep(sp.head, defs, strat); return r; }
        const d = defs[sp.head.v];
        if (!d) return null;                                   // unknown function: stuck
        if (sp.args.length < d.arity) return null;             // partial application: a value
        const used = sp.args.slice(0, d.arity);
        if (strat === 'cbv') {                                 // evaluate arguments first
          for (const a of used) if (!fpIsVal(a)) { const r = fpStep(a, defs, strat); if (r) return r; }
        }
        // choose the first equation whose patterns match (evaluating args only where a literal demands it)
        for (const eq of d.eqs) {
          let ok = true, env = {}, forced = null;
          for (let i = 0; i < eq.pats.length; i++) {
            const p = eq.pats[i], a = used[i];
            if (p.k === 'pvar') { env[p.v] = a; continue; }
            if (a.k !== 'num') { forced = a; ok = false; break; }   // literal pattern demands a value
            if (a.n !== p.n) { ok = false; break; }
          }
          if (forced) { const r = fpStep(forced, defs, strat); if (r) return r; return null; }
          if (!ok) continue;
          const body = fpSubst(eq.body, env, share);
          if (sp.args.length > d.arity) {                       // over-application: rebuild the extra args
            let e = body;
            for (let i = d.arity; i < sp.args.length; i++) e = { k: 'app', f: e, a: sp.args[i] };
            fpBecome(node, e);
          } else fpBecome(node, body);
          return { rule: 'unfold ' + sp.head.v, redex: node };
        }
        return null;                                            // no equation matched
      }
      default: return null;
    }
  }
  function fpReduce(src, defsSrc, strat, cap) {
    const defs = fpParseDefs(defsSrc);
    const root = fpParse(src);
    const seq = [{ text: fpShowMarked(root, null), rule: null }];
    let n = 0;
    while (n < cap) {
      const snapshotBefore = fpCopy(root);
      const r = fpStep(root, defs, strat);
      if (!r) break;
      n++;
      seq.push({ text: fpShowMarked(root, null), rule: r.rule });
      if (n > cap) break;
    }
    const done = n < cap;
    return { seq: seq, steps: n, done: done, final: root, nf: fpIsVal(root) };
  }
  function fpPreset(w) {
    const D = document.getElementById('fp-defs'), E = document.getElementById('fp-expr');
    const std = 'square x = x * x\nfortytwo x = 42\ninfinity = infinity + 1\nfact 0 = 1\nfact n = n * fact (n - 1)';
    D.value = std;
    if (w === 'square6') E.value = 'square 6';
    else if (w === 'sharing') E.value = 'square (3 + 1)';
    else if (w === 'plus') E.value = '(3 + 1) + (2 + 1)';
    else if (w === 'inf') E.value = 'fortytwo infinity';
    else if (w === 'fact') E.value = 'fact 3';
    runReduce();
  }
  function runReduce() {
    const out = document.getElementById('fp-output');
    const defsSrc = document.getElementById('fp-defs').value;
    const exprSrc = document.getElementById('fp-expr').value;
    const CAP = 60;
    let results;
    try {
      results = [
        { key: 'cbn', name: 'Call-by-name', sub: 'normal order', cls: 'strat-cbn', r: fpReduce(exprSrc, defsSrc, 'cbn', CAP) },
        { key: 'cbv', name: 'Call-by-value', sub: 'applicative order', cls: 'strat-cbv', r: fpReduce(exprSrc, defsSrc, 'cbv', CAP) },
        { key: 'lazy', name: 'Lazy', sub: 'call-by-name + sharing', cls: 'strat-lazy', r: fpReduce(exprSrc, defsSrc, 'lazy', CAP) }
      ];
    } catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    let html = '<div style="margin-bottom:10px;">';
    results.forEach(x => {
      const ok = x.r.done && x.r.nf;
      html += `<span class="stat-pill ${ok ? 'b' : 'c'}">${x.name}: ${x.r.done ? x.r.steps + ' step' + (x.r.steps === 1 ? '' : 's') : 'no normal form'}</span>`;
    });
    html += '</div>';
    html += '<div class="strat-grid">';
    results.forEach(x => {
      html += `<div class="strat-col ${x.cls}"><h5>${x.name}</h5><div class="sc-sub">${x.sub}</div>`;
      html += '<div class="red-seq" style="margin:0; box-shadow:none; border:none;">';
      const seq = x.r.seq;
      const show = seq.length > 14 ? seq.slice(0, 7).concat([{ ell: seq.length - 14 }], seq.slice(-7)) : seq;
      let k = 0;
      show.forEach(st => {
        if (st.ell) { html += `<div class="red-step" data-step="${k}"><span class="rs-n">⋯</span><span class="rs-a"></span><span class="rs-e" style="color:var(--ink-muted);">(${st.ell} more)</span></div>`; k += st.ell; return; }
        const isLast = (k === seq.length - 1) && x.r.done && x.r.nf;
        html += `<div class="red-step ${isLast ? 'nf' : ''}" data-step="${k}"><span class="rs-n">${k}</span><span class="rs-a">${k ? '→' : ''}</span><span class="rs-e">${st.text}${st.rule ? '<span class="rs-why">' + esc(st.rule) + '</span>' : ''}</span></div>`;
        k++;
      });
      if (!x.r.done) html += `<div class="red-step" data-step="${k}"><span class="rs-n">⋯</span><span class="rs-a">→</span><span class="rs-e" style="color:var(--accent-2);">does not terminate</span></div>`;
      html += '</div>';
      if (x.r.done && x.r.nf) html += `<div style="margin-top:8px; font-family:'IBM Plex Mono',monospace; font-size:13px; color:var(--accent-3); font-weight:600; text-align:center;">value = ${esc(fpShow(x.r.final, 0, null))}</div>`;
      else if (x.r.done) html += `<div style="margin-top:8px; font-size:12px; color:var(--ink-muted); text-align:center;">stuck — not a number or boolean</div>`;
      else html += `<div style="margin-top:8px; font-size:12px; color:var(--accent-2); text-align:center;">capped at ${CAP} steps</div>`;
      html += '</div>';
    });
    html += '</div>';
    // verdict
    const cbn = results[0].r, cbv = results[1].r, lz = results[2].r;
    if (cbn.done && cbn.nf && !(cbv.done && cbv.nf)) {
      html += `<div class="verdict bad">💥 <strong>Call-by-value fails where call-by-name succeeds.</strong> The value is <strong>${esc(fpShow(cbn.final, 0, null))}</strong>, and call-by-name finds it in ${cbn.steps} steps — but call-by-value insists on evaluating the argument first, and that evaluation never terminates. This is exactly the point: <em>call-by-name always finds the value, if there is one; call-by-value may fail to find a value.</em></div>`;
    } else if (cbn.done && cbv.done && lz.done && cbn.nf) {
      if (lz.steps < cbn.steps) {
        html += `<div class="verdict safe">✓ All three reach the same value <strong>${esc(fpShow(cbn.final, 0, null))}</strong> — <em>unicity of normal forms</em>. Note the step counts: call-by-name takes <strong>${cbn.steps}</strong> because it duplicates the unevaluated argument and reduces it twice; lazy takes <strong>${lz.steps}</strong> because <strong>sharing</strong> means the duplicated copies are the same object and are reduced once. Call-by-value takes ${cbv.steps}. <em>That gap is what "+ sharing" buys.</em></div>`;
      } else {
        html += `<div class="verdict safe">✓ All three reach the same value <strong>${esc(fpShow(cbn.final, 0, null))}</strong> — <em>unicity of normal forms</em>, independent of the order of reduction. Steps: ${cbn.steps} / ${cbv.steps} / ${lz.steps}. Try <code>square (3 + 1)</code> to see sharing make a difference.</div>`;
      }
    } else if (!cbn.done) {
      html += `<div class="verdict warn">No strategy reached a normal form within ${CAP} steps — this expression appears to have <strong>no value at all</strong>. Since even call-by-name fails, and call-by-name always finds a value if one exists, there is none.</div>`;
    }
    out.innerHTML = html;
    ixTrace('rdT', 'fp-output', { label: 'reduction step', reset: true });
  }
