  /* ============================================================
     TOOL: MOST GENERAL TYPE  (Hindley–Milner inference)
     Infers the principal type of a Haskell-subset expression or
     definition, showing the constraints exactly the way the
     Topic 06 worked examples do.
     ============================================================ */
  /* ---------- types ---------- */
  function tv(n) { return { k: 'v', n: n }; }
  function tc(n) { return { k: 'c', n: n }; }
  function tf(a, b) { return { k: 'f', a: a, b: b }; }
  function tl(a) { return { k: 'l', a: a }; }
  function tt(xs) { return { k: 't', xs: xs }; }
  let HM_N = 0;
  function fresh() { return tv('t' + (HM_N++)); }
  function hmShow(t, prec) {
    prec = prec || 0;
    if (t.k === 'v') return t.n;
    if (t.k === 'c') return t.n;
    if (t.k === 'l') return '[' + hmShow(t.a, 0) + ']';
    if (t.k === 't') return '(' + t.xs.map(x => hmShow(x, 0)).join(', ') + ')';
    const s = hmShow(t.a, 1) + ' -> ' + hmShow(t.b, 0);
    return prec > 0 ? '(' + s + ')' : s;
  }
  function hmVars(t, out) {
    out = out || [];
    if (t.k === 'v') { if (out.indexOf(t.n) < 0) out.push(t.n); }
    else if (t.k === 'l') hmVars(t.a, out);
    else if (t.k === 't') t.xs.forEach(x => hmVars(x, out));
    else if (t.k === 'f') { hmVars(t.a, out); hmVars(t.b, out); }
    return out;
  }
  function hmApply(s, t) {
    if (t.k === 'v') { const r = s[t.n]; return r ? hmApply(s, r) : t; }
    if (t.k === 'l') return tl(hmApply(s, t.a));
    if (t.k === 't') return tt(t.xs.map(x => hmApply(s, x)));
    if (t.k === 'f') return tf(hmApply(s, t.a), hmApply(s, t.b));
    return t;
  }
  function hmOccurs(n, t, s) {
    t = hmApply(s, t);
    if (t.k === 'v') return t.n === n;
    if (t.k === 'l') return hmOccurs(n, t.a, s);
    if (t.k === 't') return t.xs.some(x => hmOccurs(n, x, s));
    if (t.k === 'f') return hmOccurs(n, t.a, s) || hmOccurs(n, t.b, s);
    return false;
  }
  /* unify, mutating the substitution; throws on failure */
  function hmUnify(a, b, s, why, trace) {
    const A = hmApply(s, a), B = hmApply(s, b);
    if (A.k === 'v' && B.k === 'v' && A.n === B.n) return;
    if (A.k === 'v') {
      if (hmOccurs(A.n, B, s)) throw { hm: true, msg: 'cannot construct the infinite type ' + A.n + ' = ' + hmShow(hmApply(s, B)), why: why };
      s[A.n] = B;
      if (trace) trace.push({ kind: 'bind', l: A.n, r: hmShow(B), why: why });
      return;
    }
    if (B.k === 'v') return hmUnify(B, A, s, why, trace);
    if (A.k === 'c' && B.k === 'c') {
      if (A.n !== B.n) throw { hm: true, msg: 'cannot match <code>' + A.n + '</code> with <code>' + B.n + '</code>', why: why };
      return;
    }
    if (A.k === 'l' && B.k === 'l') return hmUnify(A.a, B.a, s, why, trace);
    if (A.k === 't' && B.k === 't') {
      if (A.xs.length !== B.xs.length) throw { hm: true, msg: 'tuples of different sizes', why: why };
      A.xs.forEach((x, i) => hmUnify(x, B.xs[i], s, why, trace));
      return;
    }
    if (A.k === 'f' && B.k === 'f') { hmUnify(A.a, B.a, s, why, trace); hmUnify(A.b, B.b, s, why, trace); return; }
    throw { hm: true, msg: 'cannot match <code>' + hmShow(A) + '</code> with <code>' + hmShow(B) + '</code>', why: why };
  }
  /* ---------- class constraints ---------- */
  const HM_CLASSES = {
    Num: ['Int', 'Float'], Fractional: ['Float'],
    Eq: ['Int', 'Float', 'Bool', 'Char'], Ord: ['Int', 'Float', 'Bool', 'Char'],
    Show: ['Int', 'Float', 'Bool', 'Char']
  };
  /* Ord implies Eq, Fractional implies Num — keep only the strongest per variable */
  const HM_IMPLIES = { Ord: ['Eq'], Fractional: ['Num'] };
  /* ---------- primitive environment ---------- */
  function hmScheme(vars, cs, t) { return { vars: vars, cs: cs, t: t }; }
  function P(str) { return hmParseType(str); }
  /* a tiny type parser so the table below reads like Haskell */
  function hmParseType(src) {
    let i = 0;
    const s = src.replace(/\s+/g, ' ').trim();
    function ws() { while (i < s.length && s[i] === ' ') i++; }
    function atom() {
      ws();
      if (s[i] === '(') {
        i++; const parts = [fun()];
        ws();
        while (s[i] === ',') { i++; parts.push(fun()); ws(); }
        if (s[i] !== ')') throw new Error('expected )');
        i++;
        return parts.length === 1 ? parts[0] : tt(parts);
      }
      if (s[i] === '[') { i++; const t = fun(); ws(); if (s[i] !== ']') throw new Error('expected ]'); i++; return tl(t); }
      const m = /^[A-Za-z]\w*/.exec(s.slice(i));
      if (!m) throw new Error('bad type at ' + i);
      i += m[0].length;
      return /^[a-z]/.test(m[0]) ? tv(m[0]) : tc(m[0]);
    }
    function fun() {
      const a = atom(); ws();
      if (s.startsWith('->', i)) { i += 2; return tf(a, fun()); }
      return a;
    }
    const t = fun(); ws();
    if (i !== s.length) throw new Error('trailing type input: ' + s.slice(i));
    return t;
  }
  function sch(cs, str) {
    const t = P(str);
    return hmScheme(hmVars(t), cs, t);
  }
  const HM_ENV = {
    '+': sch([['Num', 'a']], 'a -> a -> a'),
    '-': sch([['Num', 'a']], 'a -> a -> a'),
    '*': sch([['Num', 'a']], 'a -> a -> a'),
    '/': sch([['Fractional', 'a']], 'a -> a -> a'),
    '==': sch([['Eq', 'a']], 'a -> a -> Bool'),
    '/=': sch([['Eq', 'a']], 'a -> a -> Bool'),
    '<': sch([['Ord', 'a']], 'a -> a -> Bool'),
    '<=': sch([['Ord', 'a']], 'a -> a -> Bool'),
    '>': sch([['Ord', 'a']], 'a -> a -> Bool'),
    '>=': sch([['Ord', 'a']], 'a -> a -> Bool'),
    '&&': sch([], 'Bool -> Bool -> Bool'),
    '||': sch([], 'Bool -> Bool -> Bool'),
    ':': sch([], 'a -> [a] -> [a]'),
    '++': sch([], '[a] -> [a] -> [a]'),
    '.': sch([], '(b -> c) -> (a -> b) -> a -> c'),
    'not': sch([], 'Bool -> Bool'),
    'id': sch([], 'a -> a'),
    'const': sch([], 'a -> b -> a'),
    'flip': sch([], '(a -> b -> c) -> b -> a -> c'),
    'head': sch([], '[a] -> a'),
    'tail': sch([], '[a] -> [a]'),
    'null': sch([], '[a] -> Bool'),
    'length': sch([], '[a] -> Int'),
    'reverse': sch([], '[a] -> [a]'),
    'map': sch([], '(a -> b) -> [a] -> [b]'),
    'filter': sch([], '(a -> Bool) -> [a] -> [a]'),
    'foldr': sch([], '(a -> b -> b) -> b -> [a] -> b'),
    'foldl': sch([], '(b -> a -> b) -> b -> [a] -> b'),
    'zip': sch([], '[a] -> [b] -> [(a, b)]'),
    'fst': sch([], '(a, b) -> a'),
    'snd': sch([], '(a, b) -> b'),
    'sum': sch([['Num', 'a']], '[a] -> a'),
    'product': sch([['Num', 'a']], '[a] -> a'),
    'maximum': sch([['Ord', 'a']], '[a] -> a'),
    'minimum': sch([['Ord', 'a']], '[a] -> a'),
    'elem': sch([['Eq', 'a']], 'a -> [a] -> Bool'),
    'even': sch([], 'Int -> Bool'),
    'odd': sch([], 'Int -> Bool'),
    'div': sch([], 'Int -> Int -> Int'),
    'mod': sch([], 'Int -> Int -> Int'),
    'succ': sch([['Num', 'a']], 'a -> a'),
    'abs': sch([['Num', 'a']], 'a -> a'),
    'negate': sch([['Num', 'a']], 'a -> a'),
    'ord': sch([], 'Char -> Int'),
    'chr': sch([], 'Int -> Char'),
    'True': sch([], 'Bool'), 'False': sch([], 'Bool')
  };
  function hmInstantiate(scm, cs) {
    const m = {};
    scm.vars.forEach(v => m[v] = fresh());
    function go(t) {
      if (t.k === 'v') return m[t.n] || t;
      if (t.k === 'l') return tl(go(t.a));
      if (t.k === 't') return tt(t.xs.map(go));
      if (t.k === 'f') return tf(go(t.a), go(t.b));
      return t;
    }
    scm.cs.forEach(c => cs.push([c[0], m[c[1]] || tv(c[1])]));
    return go(scm.t);
  }
  /* ---------- expression parser ---------- */
  const HM_OPS = [
    { ops: ['||'], assoc: 'r' }, { ops: ['&&'], assoc: 'r' },
    { ops: ['==', '/=', '<=', '>=', '<', '>'], assoc: 'n' },
    { ops: [':', '++'], assoc: 'r' },
    { ops: ['+', '-'], assoc: 'l' },
    { ops: ['*', '/'], assoc: 'l' },
    { ops: ['.'], assoc: 'r' }
  ];
  function hmLex(src) {
    const out = [];
    let i = 0;
    const two = ['->', '==', '/=', '<=', '>=', '&&', '||', '++', '\\\\'];
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      const t2 = src.substr(i, 2);
      if (two.indexOf(t2) >= 0) { out.push(t2); i += 2; continue; }
      if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][\w']*/.exec(src.slice(i)); out.push(m[0]); i += m[0].length; continue; }
      if (/[0-9]/.test(c)) { const m = /^\d+(\.\d+)?/.exec(src.slice(i)); out.push(m[0]); i += m[0].length; continue; }
      if ("()[],\\+-*/<>:.=".indexOf(c) >= 0) { out.push(c); i++; continue; }
      if (c === "'") { const m = /^'(\\.|[^'])'/.exec(src.slice(i)); if (m) { out.push(m[0]); i += m[0].length; continue; } }
      throw new Error('unexpected character "' + c + '"');
    }
    return out;
  }
  function hmParseExpr(toks) {
    let i = 0;
    const peek = () => toks[i];
    const eat = x => { if (x !== undefined && toks[i] !== x) throw new Error('expected "' + x + '" but found ' + (toks[i] === undefined ? 'end of input' : '"' + toks[i] + '"')); return toks[i++]; };
    function atom() {
      const t = peek();
      if (t === undefined) throw new Error('unexpected end of expression');
      if (t === '(' && isOp(toks[i + 1]) && toks[i + 2] === ')') {
        eat('('); const o = eat(); eat(')');
        return { k: 'var', n: o };          /* (+)  — the bare operator */
      }
      if (t === '(' && toks[i + 1] === '-' ) {
        /* Haskell reads (- e) as negation, not a section */
        eat('('); eat('-'); const e0 = expr(0); eat(')');
        return { k: 'app', f: { k: 'var', n: 'negate' }, x: e0 };
      }
      if (t === '(' && isOp(toks[i + 1])) {
        eat('('); const o = eat(); const e0 = expr(0); eat(')');
        /* right section (op e) == \x -> x op e */
        const p0 = '_s' + (HM_N++);
        return { k: 'lam', p: p0,
                 b: { k: 'app', f: { k: 'app', f: { k: 'var', n: o }, x: { k: 'var', n: p0 } }, x: e0 } };
      }
      if (t === '(') {
        /* look ahead for a left section  (e op)  */
        let depth = 0, j = i;
        for (; j < toks.length; j++) {
          if (toks[j] === '(' || toks[j] === '[') depth++;
          else if (toks[j] === ')' || toks[j] === ']') { depth--; if (depth === 0) break; }
        }
        if (j < toks.length && j - 1 > i + 1 && isOp(toks[j - 1])) {
          const inner = toks.slice(i + 1, j - 1), o = toks[j - 1];
          const lhs = hmParseExpr(inner);
          i = j + 1;
          const p0 = '_s' + (HM_N++);
          return { k: 'lam', p: p0,
                   b: { k: 'app', f: { k: 'app', f: { k: 'var', n: o }, x: lhs }, x: { k: 'var', n: p0 } } };
        }
        eat('(');
        if (peek() === ')') throw new Error('empty ()');
        const parts = [expr(0)];
        while (peek() === ',') { eat(','); parts.push(expr(0)); }
        eat(')');
        return parts.length === 1 ? parts[0] : { k: 'tup', xs: parts };
      }
      if (t === '[') {
        eat('[');
        if (peek() === ']') { eat(']'); return { k: 'nil' }; }
        const parts = [expr(0)];
        while (peek() === ',') { eat(','); parts.push(expr(0)); }
        eat(']');
        return { k: 'list', xs: parts };
      }
      if (t === '\\') {
        eat('\\');
        const ps = [];
        while (peek() !== '->' && peek() !== undefined) ps.push(eat());
        eat('->');
        let body = expr(0);
        for (let j = ps.length - 1; j >= 0; j--) body = { k: 'lam', p: ps[j], b: body };
        return body;
      }
      if (t === 'if') {
        eat('if'); const c = expr(0); eat('then'); const a = expr(0); eat('else'); const b = expr(0);
        return { k: 'if', c: c, a: a, b: b };
      }
      if (/^\d+\.\d+$/.test(t)) { eat(); return { k: 'flt' }; }
      if (/^\d+$/.test(t)) { eat(); return { k: 'int' }; }
      if (/^'.*'$/.test(t)) { eat(); return { k: 'chr' }; }
      if (/^[A-Za-z_]/.test(t)) { eat(); return { k: 'var', n: t }; }
      /* a bare operator in parentheses, e.g. (+) — handled by atom via '(' path */
      throw new Error('unexpected "' + t + '"');
    }
    function isOp(t) { return HM_OPS.some(l => l.ops.indexOf(t) >= 0); }
    function app() {
      let f = atom();
      while (startsAtom()) f = { k: 'app', f: f, x: atom() };
      return f;
    }
    function startsAtom() {
      const t = peek();
      if (t === undefined) return false;
      if (t === ')' || t === ']' || t === ',' || t === 'then' || t === 'else' || t === '->') return false;
      if (isOp(t) || t === '=') return false;
      return true;
    }
    function expr(lvl) {
      if (lvl >= HM_OPS.length) return app();
      let left = expr(lvl + 1);
      const L = HM_OPS[lvl];
      for (;;) {
        const t = peek();
        if (t === undefined || L.ops.indexOf(t) < 0) break;
        eat();
        const right = L.assoc === 'r' ? expr(lvl) : expr(lvl + 1);
        left = { k: 'app', f: { k: 'app', f: { k: 'var', n: t }, x: left }, x: right };
        if (L.assoc === 'r' || L.assoc === 'n') break;
      }
      return left;
    }
    const e = expr(0);
    if (i < toks.length) throw new Error('unexpected "' + toks[i] + '" after the expression');
    return e;
  }
  /* ---------- inference ---------- */
  function hmInfer(e, env, s, cs, trace) {
    switch (e.k) {
      case 'int': { const a = fresh(); cs.push(['Num', a]); trace.push({ e: 'a numeric literal', t: hmShow(a), note: 'literals are <code>Num a =&gt; a</code>, not <code>Int</code>' }); return a; }
      case 'flt': { const a = fresh(); cs.push(['Fractional', a]); return a; }
      case 'chr': return tc('Char');
      case 'nil': { const a = fresh(); return tl(a); }
      case 'var': {
        if (env[e.n]) { const t = hmInstantiate(env[e.n], cs); trace.push({ e: '<code>' + esc(e.n) + '</code>', t: hmShow(t), note: 'fresh instance of its type' }); return t; }
        throw { hm: true, msg: '<code>' + esc(e.n) + '</code> is not in scope', why: 'unknown name' };
      }
      case 'lam': {
        const a = fresh();
        const env2 = Object.create(env);
        env2[e.p] = hmScheme([], [], a);
        trace.push({ e: 'the parameter <code>' + esc(e.p) + '</code>', t: hmShow(a), note: 'assume the most general type' });
        const b = hmInfer(e.b, env2, s, cs, trace);
        return tf(a, b);
      }
      case 'app': {
        const tf1 = hmInfer(e.f, env, s, cs, trace);
        const tx = hmInfer(e.x, env, s, cs, trace);
        const r = fresh();
        hmUnify(tf1, tf(tx, r), s, 'applying a function of type <code>' + hmShow(hmApply(s, tf1)) + '</code> to an argument of type <code>' + hmShow(hmApply(s, tx)) + '</code>', trace);
        return r;
      }
      case 'if': {
        const c = hmInfer(e.c, env, s, cs, trace);
        hmUnify(c, tc('Bool'), s, 'the condition of an <code>if</code> must be <code>Bool</code>', trace);
        const a = hmInfer(e.a, env, s, cs, trace);
        const b = hmInfer(e.b, env, s, cs, trace);
        hmUnify(a, b, s, 'both branches of an <code>if</code> must have the same type', trace);
        return a;
      }
      case 'list': {
        const a = fresh();
        e.xs.forEach((x, j) => {
          const t = hmInfer(x, env, s, cs, trace);
          hmUnify(a, t, s, 'every element of a list must have the same type' + (j ? ' (element ' + (j + 1) + ')' : ''), trace);
        });
        return tl(a);
      }
      case 'tup': return tt(e.xs.map(x => hmInfer(x, env, s, cs, trace)));
    }
    throw { hm: true, msg: 'cannot type this expression', why: '' };
  }
  /* ---------- pretty printing with a context ---------- */
  function hmCanon(t, cs) {
    const order = hmVars(t);
    const map = {};
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    order.forEach((v, j) => map[v] = letters[j % 26] + (j >= 26 ? String(Math.floor(j / 26)) : ''));
    function go(x) {
      if (x.k === 'v') return tv(map[x.n] || x.n);
      if (x.k === 'l') return tl(go(x.a));
      if (x.k === 't') return tt(x.xs.map(go));
      if (x.k === 'f') return tf(go(x.a), go(x.b));
      return x;
    }
    const t2 = go(t);
    const seen = {};
    const cs2 = [];
    cs.forEach(c => {
      const nm = map[c[1]];
      if (!nm) return;
      const key = c[0] + ' ' + nm;
      if (seen[key]) return;
      seen[key] = 1;
      cs2.push([c[0], nm]);
    });
    return { t: t2, cs: cs2 };
  }
  function hmCtxString(cs) {
    if (!cs.length) return '';
    const parts = cs.slice().sort((a, b) => (a[1] + a[0]).localeCompare(b[1] + b[0])).map(c => c[0] + ' ' + c[1]);
    return (parts.length === 1 ? parts[0] : '(' + parts.join(', ') + ')') + ' => ';
  }
  /* Resolve class constraints against the final substitution.
     Drops those satisfied by a concrete type, errors on impossible ones,
     and keeps the strongest per variable. */
  function hmSolveCs(cs, s) {
    const keep = [];
    cs.forEach(c => {
      const t = hmApply(s, c[1]);
      if (t.k === 'v') { keep.push([c[0], t.n]); return; }
      if (t.k === 'c') {
        const ok = (HM_CLASSES[c[0]] || []).indexOf(t.n) >= 0;
        if (!ok) throw { hm: true, msg: 'no instance for <code>' + c[0] + ' ' + t.n + '</code>', why: 'a class constraint ended up on a type that does not support it' };
        return;
      }
      throw { hm: true, msg: 'no instance for <code>' + c[0] + ' ' + hmShow(t) + '</code>', why: 'a class constraint ended up on a type that does not support it' };
    });
    /* strongest per variable: Ord beats Eq, Fractional beats Num */
    const byVar = {};
    keep.forEach(c => { (byVar[c[1]] = byVar[c[1]] || []).push(c[0]); });
    const out = [];
    Object.keys(byVar).forEach(v => {
      let names = byVar[v].filter((x, j, arr) => arr.indexOf(x) === j);
      names.forEach(n => {
        const weaker = HM_IMPLIES[n] || [];
        names = names.filter(m => m === n || weaker.indexOf(m) < 0);
      });
      names.forEach(n => out.push([n, v]));
    });
    return out;
  }
  /* ---------- the public entry point ---------- */
  function hmAssume(src) {
    /* parse lines like  square :: Int -> Int  or  f :: Num a => a -> a  */
    const env = Object.assign({}, HM_ENV), errs = [];
    String(src || '').split(/\n+/).forEach((raw, ln) => {
      const line = raw.trim();
      if (!line || line.startsWith('--')) return;
      const m = line.match(/^([A-Za-z_][\w']*)\s*::\s*(.+)$/);
      if (!m) { errs.push('line ' + (ln + 1) + ': expected  name :: Type'); return; }
      let body = m[2].trim(), cs = [];
      const arrow = body.indexOf('=>');
      if (arrow >= 0) {
        let c = body.slice(0, arrow).trim().replace(/^\(|\)$/g, '');
        body = body.slice(arrow + 2).trim();
        c.split(',').map(x => x.trim()).filter(Boolean).forEach(x => {
          const q = x.split(/\s+/);
          if (q.length !== 2) { errs.push('line ' + (ln + 1) + ': bad constraint "' + x + '"'); return; }
          if (!HM_CLASSES[q[0]]) { errs.push('line ' + (ln + 1) + ': unknown class "' + q[0] + '"'); return; }
          cs.push([q[0], q[1]]);
        });
      }
      let t;
      try { t = hmParseType(body); }
      catch (e) { errs.push('line ' + (ln + 1) + ': could not read the type "' + body + '"'); return; }
      env[m[1]] = hmScheme(hmVars(t), cs, t);
    });
    return { env: env, errs: errs };
  }
  function hmTypeOf(src, assumeSrc) {
    HM_N = 0;
    const A = hmAssume(assumeSrc);
    let text = String(src).trim();
    let defName = null, params = [];
    /* "f x y = e"  ->  treat as  f = \x y -> e */
    const eq = text.indexOf('=');
    const looksLikeDef = eq > 0 && !/^[^=]*[=/<>!]=/.test(text.slice(0, eq + 2)) && /^[a-z_][\w']*(\s+[a-z_][\w']*)*\s*$/.test(text.slice(0, eq).trim());
    if (looksLikeDef) {
      const lhs = text.slice(0, eq).trim().split(/\s+/);
      defName = lhs[0]; params = lhs.slice(1);
      text = (params.length ? '\\' + params.join(' ') + ' -> ' : '') + text.slice(eq + 1).trim();
    }
    const toks = hmLex(text);
    const ast = hmParseExpr(toks);
    const s = {}, cs = [], trace = [];
    const t = hmInfer(ast, A.env, s, cs, trace);
    const fin = hmApply(s, t);
    const solved = hmSolveCs(cs, s);
    const canon = hmCanon(fin, solved);
    return { name: defName, params: params, type: hmShow(canon.t), ctx: hmCtxString(canon.cs),
             full: hmCtxString(canon.cs) + hmShow(canon.t), trace: trace, sub: s, raw: fin,
             cs: canon.cs, assumeErrs: A.errs };
  }
  /* alpha-equivalence check so an answer with different variable letters still marks correct */
  function hmSameType(a, b) {
    let A, B;
    try { A = hmNormalise(a); B = hmNormalise(b); } catch (e) { return false; }
    return A === B;
  }
  function hmNormalise(str) {
    let s = String(str).trim().replace(/\s+/g, ' ');
    let ctx = [], body = s;
    const arrow = s.indexOf('=>');
    if (arrow >= 0) {
      let c = s.slice(0, arrow).trim();
      body = s.slice(arrow + 2).trim();
      c = c.replace(/^\(|\)$/g, '');
      ctx = c.split(',').map(x => x.trim()).filter(Boolean);
    }
    const t = hmParseType(body);
    const order = hmVars(t), map = {};
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    order.forEach((v, j) => map[v] = letters[j % 26]);
    function go(x) {
      if (x.k === 'v') return tv(map[x.n] || x.n);
      if (x.k === 'l') return tl(go(x.a));
      if (x.k === 't') return tt(x.xs.map(go));
      if (x.k === 'f') return tf(go(x.a), go(x.b));
      return x;
    }
    const norm = hmShow(go(t));
    const ctx2 = ctx.map(c => {
      const p = c.split(/\s+/);
      return p[0] + ' ' + (map[p[1]] || p[1]);
    }).sort().join(',');
    return (ctx2 ? ctx2 + ' => ' : '') + norm;
  }
  /* ---------- the UI ---------- */
  const MG = { mode: 'infer', drill: null, score: { r: 0, t: 0 }, answered: false, given: '' };
  const MG_BANK = [
    '\\x -> x', '\\x y -> x', '\\x y -> y', '\\f x -> f x', '\\f x -> f (f x)',
    '\\f g x -> f (g x)', '\\x -> x + 1', '\\x y -> x + y', '\\x y z -> x + y + z',
    'square x = x * x', 'twice f x = f (f x)', '\\x -> [x]', '\\x xs -> x : xs',
    '\\xs -> head xs', '\\xs -> head (tail xs)', '\\xs -> length xs == 0',
    '\\x y -> x == y', '\\x y -> x < y', '\\xs -> sum xs', '\\xs -> sum xs / 2',
    '(+1)', '(>0)', '(1:)', 'map (+1)', 'filter (>0)', 'map even',
    'foldr (+) 0', 'foldr (:) []', '\\f -> f 1', '\\p -> (snd p, fst p)',
    '\\b -> if b then 1 else 0', '\\b xs -> if b then xs else []',
    '(.)', 'flip', 'const', 'zip', '\\g -> g . g', '\\f xs -> map f (map f xs)',
    '\\xs ys -> length xs + length ys', '\\x -> not (x == x)',
    '\\f xs -> filter f (map f xs)'
  ];
  function mgMode(m) { MG.mode = m; if (m === 'drill' && !MG.drill) mgNew(); runMGT(); }
  function mgNew() {
    let pick = null, tries = 0;
    while (tries++ < 40) {
      const cand = MG_BANK[Math.floor(Math.random() * MG_BANK.length)];
      try {
        const r = hmTypeOf(cand, '');
        if (MG.drill && MG.drill.src === cand) continue;
        pick = { src: cand, ans: r.full }; break;
      } catch (e) { /* skip anything that doesn't type */ }
    }
    MG.drill = pick; MG.answered = false; MG.given = '';
    runMGT();
  }
  function mgCheck() {
    const el = document.getElementById('mg-ans');
    if (!el || MG.answered || !MG.drill) return;
    const v = el.value.trim();
    if (!v) return;
    MG.given = v;
    MG.answered = true;
    MG.score.t++;
    if (hmSameType(v, MG.drill.ans)) MG.score.r++;
    runMGT();
  }
  function mgReveal() {
    if (!MG.drill) return;
    if (!MG.answered) { MG.answered = true; MG.score.t++; MG.given = ''; }
    runMGT();
  }
  function mgResetScore() { MG.score = { r: 0, t: 0 }; runMGT(); }
  function mgTry(x) {
    const el = document.getElementById('mg-expr');
    if (el) { el.value = x; MG.mode = 'infer'; runMGT(); }
  }
  function runMGT() {
    const out = document.getElementById('mg-output');
    if (!out) return;
    let html = '';
    html += `<div class="ix-bar"><span class="ix-lab">mode:</span>
      <button class="ix-btn ${MG.mode === 'infer' ? 'on' : ''}" onclick="mgMode('infer')">infer a type</button>
      <button class="ix-btn ${MG.mode === 'drill' ? 'on' : ''}" onclick="mgMode('drill')">★ test me</button></div>`;
    if (MG.mode === 'drill') {
      const pct = MG.score.t ? Math.round(100 * MG.score.r / MG.score.t) : 0;
      html += `<div class="quiz-score" style="margin:10px 0;">
        <span class="stat-pill dark">score ${MG.score.r} / ${MG.score.t}</span>
        ${MG.score.t ? `<span class="stat-pill ${pct >= 70 ? 'b' : pct >= 40 ? 'a' : 'c'}">${pct}%</span>` : ''}</div>`;
      if (!MG.drill) { html += '<div class="tool-error">Could not build a question — press New.</div>'; out.innerHTML = html; return; }
      html += `<div class="quiz-prompt"><div class="qp-topic">most general type</div>
        What is the most general type of<pre>${esc(MG.drill.src)}</pre>
        <span style="font-size:12.5px; color:var(--ink-muted);">Include the class context if there is one, e.g. <code>Num a =&gt; a -&gt; a</code>. Any variable letters are accepted.</span></div>`;
      html += `<div class="tool-controls" style="margin:10px 0;">
        <div class="tool-field" style="flex:1; min-width:240px;"><label>your answer</label>
          <input type="text" id="mg-ans" data-nolive placeholder="e.g. Num a => a -> a" style="width:100%;"
                 value="${MG.answered ? esc(MG.given) : ''}" ${MG.answered ? 'disabled' : ''}
                 onkeydown="if(event.key==='Enter'){mgCheck();}"></div>
        <button class="tool-btn" onclick="mgCheck()" ${MG.answered ? 'disabled' : ''}>Check</button>
        <button class="tool-btn secondary" onclick="mgReveal()">Show answer</button>
        <button class="tool-btn green" onclick="mgNew()">New question ▶</button>
        <button class="tool-btn danger" onclick="mgResetScore()">Reset score</button></div>`;
      if (MG.answered) {
        const right = MG.given && hmSameType(MG.given, MG.drill.ans);
        html += `<div class="verdict ${right ? 'safe' : 'bad'}">${right ? '✓ <strong>Correct.</strong>' : (MG.given ? '✗ Not quite.' : '')}
          The most general type is <code>${esc(MG.drill.ans)}</code>.</div>`;
        try {
          const r = hmTypeOf(MG.drill.src, '');
          html += mgSteps(r, MG.drill.src);
        } catch (e) {}
      }
      out.innerHTML = html;
      return;
    }
    const src = document.getElementById('mg-expr').value;
    const assume = document.getElementById('mg-assume').value;
    if (!src.trim()) { out.innerHTML = html + '<div class="tool-error">Type an expression or a definition above.</div>'; return; }
    let r;
    try { r = hmTypeOf(src, assume); }
    catch (e) {
      const msg = e && e.hm ? e.msg : (e.message || String(e));
      html += `<div class="verdict bad">✗ <strong>This expression has no type.</strong><br><br>${msg}${e && e.why ? '<br><br><span style="font-size:13px; color:var(--ink-soft);">While ' + e.why + '.</span>' : ''}</div>`;
      html += `<p class="ix-hint">An expression that cannot be typed is <strong>rejected by the compiler without evaluation</strong> — that is the point of static typing. The two classic failures are a <em>clash</em> (matching one concrete type against another) and the <em>occur check</em> (a type would have to contain itself).</p>`;
      out.innerHTML = html;
      return;
    }
    if (r.assumeErrs && r.assumeErrs.length)
      html += `<div class="verdict warn">In the assumptions box — ${r.assumeErrs.map(esc).join('; ')}</div>`;
    html += `<div class="verdict safe" style="font-size:17px;">
      <code style="font-size:17px;">${esc(r.name || 'it')} :: <strong>${esc(r.full)}</strong></code></div>`;
    html += `<p class="ix-hint">The <strong>letters are arbitrary</strong> — any consistent renaming is the same type and would get full marks.
      What matters is the <em>shape</em>: which positions share a variable, where the brackets go, and what the context is.</p>`;
    if (r.cs.length) {
      html += `<div class="callout tip" style="margin:10px 0;"><div class="callout-label">Reading the context</div>
        <code>${esc(r.ctx)}</code> means "for any type${r.cs.length > 1 ? 's' : ''}
        ${r.cs.map(c => '<strong>' + c[1] + '</strong> that ' + (c[1].length === 1 ? 'is' : 'are') + ' a <strong>' + c[0] + '</strong>').join(' and ')}".
        Without it the type would be <em>too general</em> — it would permit types that do not support the operations used.</div>`;
    }
    html += mgSteps(r, src);
    out.innerHTML = html;
  }
  function mgSteps(r, src) {
    let html = '<h4 style="margin-top:16px; font-size:16px;">How the inference goes</h4>';
    html += '<div class="tystep">';
    const seen = {};
    r.trace.filter(x => x.e).forEach((x, j) => {
      const key = x.e + x.t;
      if (seen[key]) return;
      seen[key] = 1;
      html += `<div class="tyrow"><span class="ty-expr">${x.e}</span><span class="ty-col">::</span>
        <span class="ty-type">${esc(hmShow(hmApply(r.sub, hmParseType(x.t))))}</span>
        <span style="font-size:11.5px; color:var(--ink-muted); margin-left:10px;">${x.note || ''}</span></div>`;
    });
    html += '</div>';
    const binds = r.trace.filter(x => x.kind === 'bind');
    if (binds.length) {
      html += '<h4 style="margin-top:14px; font-size:16px;">Constraints solved, in order</h4>';
      html += '<div class="unif">';
      binds.forEach((b, j) => {
        html += `<div class="unif-row" data-step="${j}"><span class="u-rule">${j + 1}</span>
          <span class="u-set"><code>${esc(b.l)} = ${esc(b.r)}</code>
          <span style="color:var(--ink-muted); font-size:12px; margin-left:10px;">${b.why || ''}</span></span></div>`;
      });
      html += '</div>';
    }
    html += `<p class="ix-hint">Every step is one of two things: <strong>an assumption</strong> (a fresh type variable for something we don't know yet)
      or <strong>a constraint</strong> (an equation forced by how the pieces are put together). Solve the equations by unification and read off
      what's left — that is the most general type.</p>`;
    return html;
  }
  TOOL_RUNNERS.runMGT = runMGT;
