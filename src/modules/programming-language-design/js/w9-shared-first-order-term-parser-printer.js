  /* ============================================================
     W9 SHARED: first-order term parser / printer
     Terms:  V (variable, capitalised or _)  |  C (compound/atom)  |  N (number)
     ============================================================ */
  function plLex(src) {
    const T = []; let i = 0;
    const s = src.replace(/¬/g, '~').replace(/∨/g, '\\/').replace(/↦/g, '->').replace(/≤/g, '=<').replace(/≥/g, '>=');
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '%') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (/[0-9]/.test(c)) { let d = ''; while (i < s.length && /[0-9]/.test(s[i])) d += s[i++]; T.push({ k: 'num', v: +d }); continue; }
      if (/[A-Z_]/.test(c)) { let w = ''; while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) w += s[i++]; T.push({ k: 'var', v: w }); continue; }
      if (/[a-z]/.test(c)) { let w = ''; while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) w += s[i++]; T.push({ k: 'atom', v: w }); continue; }
      if (c === '"' || c === "'") { const q = c; let w = ''; i++; while (i < s.length && s[i] !== q) w += s[i++]; i++; T.push({ k: 'atom', v: w, quoted: true }); continue; }
      if (s.substr(i, 2) === ':-') { T.push({ k: ':-' }); i += 2; continue; }
      if (s.substr(i, 2) === '\\+') { T.push({ k: 'naf' }); i += 2; continue; }
      if (s.substr(i, 2) === '\\/') { T.push({ k: 'or' }); i += 2; continue; }
      if (s.substr(i, 2) === '->') { T.push({ k: 'to' }); i += 2; continue; }
      if (s.substr(i, 2) === '=<') { T.push({ k: 'bin', v: '=<' }); i += 2; continue; }
      if (s.substr(i, 2) === '>=') { T.push({ k: 'bin', v: '>=' }); i += 2; continue; }
      if (s.substr(i, 2) === '=:') { T.push({ k: 'bin', v: '=' }); i += 2; if (s[i] === '=') i++; continue; }
      if (c === '~') { T.push({ k: 'neg' }); i++; continue; }
      if ('+-*/'.includes(c)) { T.push({ k: 'arith', v: c }); i++; continue; }
      if ('<>='.includes(c)) { T.push({ k: 'bin', v: c }); i++; continue; }
      if ('()[],|.'.includes(c)) { T.push({ k: c }); i++; continue; }
      throw new Error('Unexpected character "' + c + '"');
    }
    T.push({ k: 'eof' }); return T;
  }
  const PL_NIL = { k: 'C', f: '[]', args: [] };
  function plList(items, tail) { return items.reduceRight((a, x) => ({ k: 'C', f: '.', args: [x, a] }), tail || PL_NIL); }
  function plParseTerm(T, pos) {
    let p = pos;
    const peek = () => T[p].k, tok = () => T[p];
    const eat = k => { if (T[p].k !== k) throw new Error('Expected ' + k + ', found ' + (T[p].v !== undefined ? T[p].v : T[p].k)); return T[p++]; };
    function primary() {
      if (peek() === 'num') return { k: 'N', v: eat('num').v };
      if (peek() === 'var') { const n = eat('var').v; return { k: 'V', n: n }; }
      if (peek() === 'arith' && tok().v === '-') { eat('arith'); const a = primary(); if (a.k === 'N') return { k: 'N', v: -a.v }; return { k: 'C', f: '-', args: [a] }; }
      if (peek() === 'atom') {
        const f = eat('atom').v;
        if (peek() === '(') {
          eat('('); const args = [primary2()];
          while (peek() === ',') { eat(','); args.push(primary2()); }
          eat(')'); return { k: 'C', f: f, args: args };
        }
        return { k: 'C', f: f, args: [] };
      }
      if (peek() === '[') {
        eat('[');
        if (peek() === ']') { eat(']'); return PL_NIL; }
        const items = [primary2()];
        while (peek() === ',') { eat(','); items.push(primary2()); }
        let tail = PL_NIL;
        if (peek() === '|') { eat('|'); tail = primary2(); }
        eat(']'); return plList(items, tail);
      }
      if (peek() === '(') {
        eat('('); const t = primary2();
        if (peek() === ',') throw new Error('tuples are not terms — a term is either a variable or f(t\u2081,\u2026,t\u2099)');
        eat(')'); return t;
      }
      throw new Error('Expected a term, found ' + peek());
    }
    function mul() { let l = primary(); while (peek() === 'arith' && ['*', '/'].includes(tok().v)) { const o = eat('arith').v; l = { k: 'C', f: o, args: [l, mul0()] }; } return l; }
    function mul0() { return primary(); }
    function addE() { let l = mul(); while (peek() === 'arith' && ['+', '-'].includes(tok().v)) { const o = eat('arith').v; l = { k: 'C', f: o, args: [l, mul()] }; } return l; }
    function primary2() {                             // full term incl. arithmetic and comparison
      let l = addE();
      if (peek() === 'bin') { const o = eat('bin').v; l = { k: 'C', f: o, args: [l, addE()] }; }
      else if (peek() === 'atom' && tok().v === 'is') { eat('atom'); l = { k: 'C', f: 'is', args: [l, addE()] }; }
      return l;
    }
    const t = primary2();
    return { t: t, pos: p };
  }
  function plParse(src) { const T = plLex(src); const r = plParseTerm(T, 0); if (T[r.pos].k !== 'eof') throw new Error('Unexpected input after the term'); return r.t; }
  const PL_INFIX = ['+', '-', '*', '/', '<', '>', '=<', '>=', '=', 'is'];
  function plShow(t, prec) {
    prec = prec || 0;
    switch (t.k) {
      case 'V': return t.n;
      case 'N': return String(t.v);
      case 'C': {
        if (t.f === '[]' && !t.args.length) return '[]';
        if (t.f === '.' && t.args.length === 2) {
          const items = []; let cur = t;
          while (cur.k === 'C' && cur.f === '.' && cur.args.length === 2) { items.push(cur.args[0]); cur = cur.args[1]; }
          const tail = (cur.k === 'C' && cur.f === '[]') ? '' : '|' + plShow(cur, 0);
          return '[' + items.map(x => plShow(x, 0)).join(',') + tail + ']';
        }
        if (PL_INFIX.includes(t.f) && t.args.length === 2) {
          const s = plShow(t.args[0], 1) + ' ' + t.f + ' ' + plShow(t.args[1], 1);
          return prec > 0 ? '(' + s + ')' : s;
        }
        if (!t.args.length) return t.f;
        return t.f + '(' + t.args.map(a => plShow(a, 0)).join(',') + ')';
      }
      default: return '?';
    }
  }
