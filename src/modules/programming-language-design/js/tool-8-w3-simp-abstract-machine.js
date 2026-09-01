  /* ============================================================
     TOOL 8 (W3): SIMP ABSTRACT MACHINE
     ------------------------------------------------------------
     Abstract syntax
       C ::= skip | l := E | C ; C | if B then C else C | while B do C
       E ::= !l | n | E op E          op  ::= + | - | * | /
       B ::= True | False | E bop E | ~B | B /\ B     bop ::= > | < | =
     ============================================================ */
  /* ---------- tokenizer ---------- */
  function smLex(src) {
    const T = [], s = src.replace(/¬/g, '~').replace(/∧/g, '/\\').replace(/∗/g, '*')
                        .replace(/−/g, '-').replace(/≠/g, '!=');
    let i = 0;
    const kw = ['skip', 'while', 'do', 'if', 'then', 'else', 'True', 'False', 'begin', 'loc', 'end'];
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (s.substr(i, 2) === ':=') { T.push({ k: ':=' }); i += 2; continue; }
      if (s.substr(i, 2) === '/\\') { T.push({ k: 'and' }); i += 2; continue; }
      if (/[0-9]/.test(c)) { let d = ''; while (i < s.length && /[0-9]/.test(s[i])) d += s[i++]; T.push({ k: 'num', v: parseInt(d, 10) }); continue; }
      if (/[A-Za-z_]/.test(c)) {
        let w = ''; while (i < s.length && /[A-Za-z0-9_]/.test(s[i])) w += s[i++];
        T.push(kw.includes(w) ? { k: w } : { k: 'id', v: w });
        continue;
      }
      if ('+-*/'.includes(c)) { T.push({ k: 'op', v: c }); i++; continue; }
      if ('><='.includes(c)) { T.push({ k: 'bop', v: c }); i++; continue; }
      if (c === '!') { T.push({ k: '!' }); i++; continue; }
      if (c === '~') { T.push({ k: '~' }); i++; continue; }
      if (c === '(') { T.push({ k: '(' }); i++; continue; }
      if (c === ')') { T.push({ k: ')' }); i++; continue; }
      if (c === ';') { T.push({ k: ';' }); i++; continue; }
      throw new Error('Unexpected character "' + c + '"');
    }
    T.push({ k: 'eof' });
    return T;
  }
  /* ---------- recursive-descent parser ---------- */
  function smParse(src) {
    const T = smLex(src);
    let p = 0;
    const peek = () => T[p].k;
    const eat = k => {
      if (T[p].k !== k) throw new Error('Expected ' + k + ' but found ' + (T[p].v !== undefined ? T[p].v : T[p].k));
      return T[p++];
    };
    // E: additive
    function pAtom() {
      if (peek() === 'num') return { k: 'num', n: eat('num').v };
      if (peek() === '!') { eat('!'); const id = eat('id').v; return { k: 'deref', l: id }; }
      if (peek() === '(') { eat('('); const e = pArith(); eat(')'); return e; }
      if (peek() === 'id') throw new Error('Location "' + T[p].v + '" used as a value — write !' + T[p].v + ' to dereference it');
      throw new Error('Expected an integer expression, found ' + peek());
    }
    function pMul() {
      let l = pAtom();
      while (peek() === 'op' && (T[p].v === '*' || T[p].v === '/')) { const o = eat('op').v; l = { k: 'op', op: o, e1: l, e2: pAtom() }; }
      return l;
    }
    function pArith() {
      let l = pMul();
      while (peek() === 'op' && (T[p].v === '+' || T[p].v === '-')) { const o = eat('op').v; l = { k: 'op', op: o, e1: l, e2: pMul() }; }
      return l;
    }
    // B
    function pBAtom() {
      if (peek() === 'True') { eat('True'); return { k: 'bool', b: true }; }
      if (peek() === 'False') { eat('False'); return { k: 'bool', b: false }; }
      if (peek() === '~') { eat('~'); return { k: 'not', b: pBAtom() }; }
      if (peek() === '(') {
        // could be a bracketed boolean or a bracketed arithmetic comparison
        const save = p;
        try { eat('('); const b = pBool(); eat(')'); return b; }
        catch (e) { p = save; }
      }
      const e1 = pArith();
      if (peek() !== 'bop') throw new Error('Expected a comparison operator (> < =) after the expression');
      const o = eat('bop').v;
      return { k: 'bop', op: o, e1: e1, e2: pArith() };
    }
    function pBool() {
      let l = pBAtom();
      while (peek() === 'and') { eat('and'); l = { k: 'and', b1: l, b2: pBAtom() }; }
      return l;
    }
    // C
    function pCAtom() {
      if (peek() === 'skip') { eat('skip'); return { k: 'skip' }; }
      if (peek() === 'if') {
        eat('if'); const b = pBool(); eat('then'); const c1 = pCmd(); eat('else'); const c2 = pCmd();
        return { k: 'if', b: b, c1: c1, c2: c2 };
      }
      if (peek() === 'while') { eat('while'); const b = pBool(); eat('do'); const c = pCmd(); return { k: 'while', b: b, c: c }; }
      if (peek() === 'begin') {
        eat('begin'); eat('loc'); const x = eat('id').v; eat(':='); const e = pArith(); eat(';');
        const c = pCmd(); eat('end');
        return { k: 'block', x: x, e: e, c: c };
      }
      if (peek() === '(') { eat('('); const c = pCmd(); eat(')'); return c; }
      if (peek() === 'id') { const l = eat('id').v; eat(':='); return { k: 'assign', l: l, e: pArith() }; }
      throw new Error('Expected a command, found ' + peek());
    }
    function pCmd() {          // ';' is right-associative:  C1 ; (C2 ; C3)
      const c1 = pCAtom();
      if (peek() === ';') { eat(';'); return { k: 'seq', c1: c1, c2: pCmd() }; }
      return c1;
    }
    // top level: a program is a command, an integer expression, or a boolean
    let node;
    const save0 = p;
    try { node = pCmd(); if (peek() !== 'eof') throw new Error('unexpected ' + peek()); }
    catch (e1) {
      p = save0;
      try { node = pBool(); if (peek() !== 'eof') throw new Error('unexpected ' + peek()); }
      catch (e2) {
        p = save0;
        try { node = pArith(); if (peek() !== 'eof') throw new Error('unexpected ' + peek()); }
        catch (e3) { throw e1; }
      }
    }
    return node;
  }
  /* ---------- pretty printer (textual notation, brackets where ambiguous) ---------- */
  const SM_OPSYM = { '+': '+', '-': '−', '*': '∗', '/': '/' };
  function smShow(n, br) {
    switch (n.k) {
      case 'num': return String(n.n);
      case 'bool': return n.b ? 'True' : 'False';
      case 'loc': return n.l;
      case 'deref': return '!' + n.l;
      case 'skip': return 'skip';
      case 'op': { const s = smShow(n.e1, true) + ' ' + SM_OPSYM[n.op] + ' ' + smShow(n.e2, true); return br ? '(' + s + ')' : s; }
      case 'bop': { const s = smShow(n.e1, true) + ' ' + n.op + ' ' + smShow(n.e2, true); return br ? '(' + s + ')' : s; }
      case 'not': return '¬' + smShow(n.b, true);
      case 'and': { const s = smShow(n.b1, true) + ' ∧ ' + smShow(n.b2, true); return br ? '(' + s + ')' : s; }
      case 'assign': return n.l + ' := ' + smShow(n.e, false);   // never needs brackets: ':=' binds one location
      case 'seq': { const s = smShow(n.c1, true) + '; ' + smShow(n.c2, true); return br ? '(' + s + ')' : s; }
      case 'if': { const s = 'if ' + smShow(n.b, false) + ' then ' + smShow(n.c1, true) + ' else ' + smShow(n.c2, true); return br ? '(' + s + ')' : s; }
      case 'while': { const s = 'while ' + smShow(n.b, false) + ' do ' + smShow(n.c, true); return br ? '(' + s + ')' : s; }
      case 'block': return 'begin loc ' + n.x + ' := ' + smShow(n.e, false) + '; ' + smShow(n.c, false) + ' end';
      case 'tok': return n.t;
      default: return '?';
    }
  }
  /* ---------- the transition relation ---------- */
  const TOK = t => ({ k: 'tok', t: t });
  function smStepCfg(cfg) {
    const c = cfg.c, r = cfg.r, m = cfg.m;
    if (c.length === 0) return null;                    // final (or stuck) — caller checks r
    const h = c[0], rest = c.slice(1);
    const M = extra => Object.assign({ c: rest, r: r, m: m }, extra);
    switch (h.k) {
      /* ---- expressions: push values / decompose ---- */
      case 'num':  return M({ r: [h].concat(r), rule: 'num', detail: '⟨n · c, r, m⟩ → ⟨c, n · r, m⟩' });
      case 'bool': return M({ r: [h].concat(r), rule: 'bool', detail: '⟨b · c, r, m⟩ → ⟨c, b · r, m⟩' });
      case 'not':  return M({ c: [h.b, TOK('¬')].concat(rest), rule: 'not-decomp', detail: '⟨¬B · c, r, m⟩ → ⟨B · ¬ · c, r, m⟩' });
      case 'and':  return M({ c: [h.b1, h.b2, TOK('∧')].concat(rest), rule: 'and-decomp', detail: '⟨(B₁ ∧ B₂) · c, r, m⟩ → ⟨B₁ · B₂ · ∧ · c, r, m⟩' });
      case 'op':   return M({ c: [h.e1, h.e2, TOK(SM_OPSYM[h.op])].concat(rest), rule: 'op-decomp', detail: '⟨(E₁ op E₂) · c, r, m⟩ → ⟨E₁ · E₂ · op · c, r, m⟩' });
      case 'bop':  return M({ c: [h.e1, h.e2, TOK(h.op)].concat(rest), rule: 'bop-decomp', detail: '⟨(E₁ bop E₂) · c, r, m⟩ → ⟨E₁ · E₂ · bop · c, r, m⟩' });
      case 'deref': {
        if (!(h.l in m)) return { stuck: 'm(' + h.l + ') is undefined — ' + h.l + ' ∉ dom(m), so the deref rule does not apply and the machine is stuck.' };
        return M({ r: [{ k: 'num', n: m[h.l] }].concat(r), rule: 'deref', detail: '⟨!l · c, r, m⟩ → ⟨c, n · r, m⟩   if m(l) = n' });
      }
      /* ---- commands ---- */
      case 'skip':   return M({ rule: 'skip', detail: '⟨skip · c, r, m⟩ → ⟨c, r, m⟩' });
      case 'assign': return M({ c: [h.e, TOK(':=')].concat(rest), r: [{ k: 'loc', l: h.l }].concat(r), rule: 'assign-decomp', detail: '⟨(l := E) · c, r, m⟩ → ⟨E · := · c, l · r, m⟩' });
      case 'seq':    return M({ c: [h.c1, h.c2].concat(rest), rule: 'seq', detail: '⟨(C₁ ; C₂) · c, r, m⟩ → ⟨C₁ · C₂ · c, r, m⟩' });
      case 'if':     return M({ c: [h.b, TOK('if')].concat(rest), r: [h.c1, h.c2].concat(r), rule: 'if-decomp', detail: '⟨(if B then C₁ else C₂) · c, r, m⟩ → ⟨B · if · c, C₁ · C₂ · r, m⟩' });
      case 'while':  return M({ c: [h.b, TOK('while')].concat(rest), r: [h.b, h.c].concat(r), rule: 'while-decomp', detail: '⟨(while B do C) · c, r, m⟩ → ⟨B · while · c, B · C · r, m⟩' });
      /* ---- tokens: apply ---- */
      case 'tok': {
        const t = h.t;
        if (t === '¬') {
          if (!r.length || r[0].k !== 'bool') return { stuck: '¬ needs a boolean on top of the results stack.' };
          return M({ r: [{ k: 'bool', b: !r[0].b }].concat(r.slice(1)), rule: 'not-apply', detail: '⟨¬ · c, b · r, m⟩ → ⟨c, b′ · r, m⟩   if b′ = not b' });
        }
        if (t === '∧') {
          if (r.length < 2 || r[0].k !== 'bool' || r[1].k !== 'bool') return { stuck: '∧ needs two booleans on the results stack.' };
          const b2 = r[0].b, b1 = r[1].b;   // b2 on top
          return M({ r: [{ k: 'bool', b: b1 && b2 }].concat(r.slice(2)), rule: 'and-apply', detail: '⟨∧ · c, b₂ · b₁ · r, m⟩ → ⟨c, b · r, m⟩   if b₁ and b₂ = b' });
        }
        if (['+', '−', '∗', '/'].includes(t)) {
          if (r.length < 2 || r[0].k !== 'num' || r[1].k !== 'num') return { stuck: 'op needs two integers on the results stack.' };
          const n2 = r[0].n, n1 = r[1].n;   // n2 on top
          let n;
          if (t === '+') n = n1 + n2;
          else if (t === '−') n = n1 - n2;
          else if (t === '∗') n = n1 * n2;
          else { if (n2 === 0) return { stuck: 'division by zero: n₁ / n₂ is undefined for n₂ = 0, so no transition applies.' }; n = Math.trunc(n1 / n2); }
          return M({ r: [{ k: 'num', n: n }].concat(r.slice(2)), rule: 'op-apply', detail: '⟨op · c, n₂ · n₁ · r, m⟩ → ⟨c, n · r, m⟩   if n₁ op n₂ = n   (' + n1 + ' ' + t + ' ' + n2 + ' = ' + n + ')' });
        }
        if (['>', '<', '='].includes(t)) {
          if (r.length < 2 || r[0].k !== 'num' || r[1].k !== 'num') return { stuck: 'bop needs two integers on the results stack.' };
          const n2 = r[0].n, n1 = r[1].n;
          const b = t === '>' ? n1 > n2 : t === '<' ? n1 < n2 : n1 === n2;
          return M({ r: [{ k: 'bool', b: b }].concat(r.slice(2)), rule: 'bop-apply', detail: '⟨bop · c, n₂ · n₁ · r, m⟩ → ⟨c, b · r, m⟩   if n₁ bop n₂ = b   (' + n1 + ' ' + t + ' ' + n2 + ' = ' + (b ? 'True' : 'False') + ')' });
        }
        if (t === ':=') {
          if (r.length < 2 || r[0].k !== 'num' || r[1].k !== 'loc') return { stuck: ':= needs an integer on top of a location.' };
          const n = r[0].n, l = r[1].l;
          const m2 = Object.assign({}, m); m2[l] = n;
          return { c: rest, r: r.slice(2), m: m2, rule: 'assign-apply', detail: '⟨:= · c, n · l · r, m⟩ → ⟨c, r, m[l ↦ n]⟩   (m[' + l + ' ↦ ' + n + '])' };
        }
        if (t === 'if') {
          if (r.length < 3 || r[0].k !== 'bool') return { stuck: 'if needs True/False on top of the two branches.' };
          const b = r[0].b, C1 = r[1], C2 = r[2];
          return { c: [b ? C1 : C2].concat(rest), r: r.slice(3), m: m,
                   rule: b ? 'if-true' : 'if-false',
                   detail: b ? '⟨if · c, True · C₁ · C₂ · r, m⟩ → ⟨C₁ · c, r, m⟩' : '⟨if · c, False · C₁ · C₂ · r, m⟩ → ⟨C₂ · c, r, m⟩' };
        }
        if (t === 'while') {
          if (r.length < 3 || r[0].k !== 'bool') return { stuck: 'while needs True/False on top of B and C.' };
          const b = r[0].b, B = r[1], C = r[2];
          if (b) {
            return { c: [C, { k: 'while', b: B, c: C }].concat(rest), r: r.slice(3), m: m,
                     rule: 'while-true', detail: '⟨while · c, True · B · C · r, m⟩ → ⟨C · (while B do C) · c, r, m⟩' };
          }
          return { c: rest, r: r.slice(3), m: m, rule: 'while-false', detail: '⟨while · c, False · B · C · r, m⟩ → ⟨c, r, m⟩' };
        }
        return { stuck: 'unknown token ' + t };
      }
      default: return { stuck: 'no rule applies to ' + h.k };
    }
  }
  /* ---------- rendering ---------- */
  function smStackHtml(st, hilite) {
    if (!st.length) return '<span class="cfg-item nil">nil</span>';
    return st.map((x, i) => {
      const isTok = x.k === 'tok';
      const cls = 'cfg-item' + (i === 0 && hilite ? ' head' : '') + (isTok ? ' tok' : '');
      return `<span class="${cls}">${esc(smShow(x, false))}</span>`;
    }).join('<span class="cfg-sep"> · </span>') + '<span class="cfg-sep"> · </span><span class="cfg-item nil">nil</span>';
  }
  function smMemHtml(m) {
    const ks = Object.keys(m).sort();
    if (!ks.length) return '<span class="cfg-item nil">{ }</span>';
    return '{ ' + ks.map(k => `${esc(k)} ↦ ${m[k]}`).join(', ') + ' }';
  }
  function smCfgLine(cfg) {
    return '⟨' + smStackLine(cfg.c) + ', &nbsp;' + smStackLine(cfg.r) + ', &nbsp;' + smMemLine(cfg.m) + '⟩';
  }
  function smStackLine(st) {
    if (!st.length) return 'nil';
    return st.map(x => esc(smShow(x, false))).join(' · ') + ' · nil';
  }
  function smMemLine(m) {
    const ks = Object.keys(m).sort();
    return ks.length ? '{' + ks.map(k => `${esc(k)}↦${m[k]}`).join(', ') + '}' : '{}';
  }
  /* ---------- driver ---------- */
  let smState = null;
  function smParseMem(s) {
    const m = {};
    s.split(/[,;]/).forEach(part => {
      const t = part.trim(); if (!t) return;
      const bits = t.split(/=|↦|->/);
      if (bits.length !== 2) throw new Error('Bad memory entry "' + t + '" — write it as  l = 4');
      const name = bits[0].trim(), val = parseInt(bits[1].trim(), 10);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('Bad location name "' + name + '"');
      if (isNaN(val)) throw new Error('Bad value for ' + name);
      m[name] = val;
    });
    return m;
  }
  function smInit() {
    const src = document.getElementById('sm-prog').value;
    const memsrc = document.getElementById('sm-mem').value;
    const ast = smParse(src);
    const m = smParseMem(memsrc);
    smState = { cfg: { c: [ast], r: [], m: m }, trace: [], steps: 0, done: false, stuck: null, ast: ast, m0: m };
  }
  function smStep() {
    try {
      if (!smState || smState.done || smState.stuck) smInit();
      const s = smState;
      if (s.steps++ > 4000) { s.stuck = 'step limit (4000) reached — the program probably does not terminate.'; smRender(); return; }
      const nxt = smStepCfg(s.cfg);
      if (nxt === null) { s.done = true; smRender(); return; }
      if (nxt.stuck) { s.stuck = nxt.stuck; smRender(); return; }
      s.trace.push({ cfg: { c: nxt.c, r: nxt.r, m: nxt.m }, rule: nxt.rule, detail: nxt.detail });
      s.cfg = { c: nxt.c, r: nxt.r, m: nxt.m };
      if (s.cfg.c.length === 0) s.done = true;
      smRender();
    } catch (e) { document.getElementById('sm-output').innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; }
  }
  function smRunAll() {
    try {
      smInit();
      const s = smState;
      let guard = 0;
      while (!s.done && !s.stuck && guard++ < 4000) {
        const nxt = smStepCfg(s.cfg);
        if (nxt === null) { s.done = true; break; }
        if (nxt.stuck) { s.stuck = nxt.stuck; break; }
        s.trace.push({ cfg: { c: nxt.c, r: nxt.r, m: nxt.m }, rule: nxt.rule, detail: nxt.detail });
        s.cfg = { c: nxt.c, r: nxt.r, m: nxt.m };
        if (s.cfg.c.length === 0) s.done = true;
      }
      s.steps = guard;
      if (guard >= 4000 && !s.done) s.stuck = 'step limit (4000) reached — the program probably does not terminate.';
      smRender();
    } catch (e) { document.getElementById('sm-output').innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; }
  }
  function smReset() { try { smInit(); smRender(); } catch (e) { document.getElementById('sm-output').innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; } }
  function smPreset(which) {
    const P = document.getElementById('sm-prog'), M = document.getElementById('sm-mem');
    if (which === 'expr') { P.value = '!l > 0'; M.value = 'l = 4'; }
    else if (which === 'swap') { P.value = 'z := !x ; x := !y ; y := !z'; M.value = 'x = 1, y = 2, z = 0'; }
    else if (which === 'if') { P.value = 'if 5 > 0 then skip else (skip; l := 0)'; M.value = 'l = 7'; }
    else if (which === 'fact') { P.value = 'factorial := 1;\nwhile !l > 0 do\n  (factorial := !factorial * !l;\n   l := !l - 1)'; M.value = 'l = 4'; }
    smRunAll();
  }
  function smRender() {
    const s = smState, out = document.getElementById('sm-output');
    if (!s) { out.innerHTML = ''; return; }
    const cfg = s.cfg;
    let html = '';
    // current configuration panel
    html += '<div class="cfg">';
    html += `<div class="cfg-grid"><div class="cfg-lbl">control c</div><div class="cfg-val ctrl">${smStackHtml(cfg.c, true)}</div></div>`;
    html += `<div class="cfg-grid"><div class="cfg-lbl">results r</div><div class="cfg-val res">${smStackHtml(cfg.r, false)}</div></div>`;
    html += `<div class="cfg-grid"><div class="cfg-lbl">memory m</div><div class="cfg-val mem">${smMemHtml(cfg.m)}</div></div>`;
    html += '</div>';
    // stats
    const counts = {};
    s.trace.forEach(t => { counts[t.rule] = (counts[t.rule] || 0) + 1; });
    const decomp = ['not-decomp', 'and-decomp', 'op-decomp', 'bop-decomp', 'assign-decomp', 'seq', 'if-decomp', 'while-decomp', 'num', 'bool', 'skip'];
    const compute = ['op-apply', 'bop-apply', 'and-apply', 'not-apply', 'assign-apply', 'deref'];
    let nD = 0, nC = 0;
    Object.keys(counts).forEach(k => { if (decomp.includes(k)) nD += counts[k]; else if (compute.includes(k)) nC += counts[k]; });
    html += `<div style="margin:12px 0;"><span class="stat-pill dark">${s.trace.length} transition${s.trace.length === 1 ? '' : 's'}</span>`;
    if (s.trace.length) {
      html += `<span class="stat-pill a">${nD} phrase-analysis</span><span class="stat-pill b">${nC} actually compute</span>`;
    }
    html += '</div>';
    // verdict
    if (s.stuck) {
      html += `<div class="verdict bad">✗ <strong>Stuck.</strong> ${esc(s.stuck)} A stuck configuration is <em>not</em> final: the control stack is non-empty but no rule applies.</div>`;
    } else if (s.done) {
      const finalOK = cfg.c.length === 0 && cfg.r.length === 0;
      if (finalOK) {
        html += `<div class="verdict safe">✓ <strong>Final configuration ⟨nil, nil, m′⟩ reached.</strong> The program terminates successfully producing<br>m′ = ${smMemHtml(cfg.m)}</div>`;
      } else {
        const v = cfg.r.length === 1 ? smShow(cfg.r[0], false) : null;
        html += `<div class="verdict safe">✓ <strong>Control stack empty.</strong> ${v !== null
          ? 'The results stack holds a single value, so this was an <em>expression</em>: its value in the given state is <strong>' + esc(v) + '</strong>.'
          : 'The results stack still holds ' + cfg.r.length + ' items.'}</div>`;
      }
    }
    // trace
    if (s.trace.length) {
      html += `<h4 style="font-size:16px; margin-top:18px;">Transition sequence</h4>`;
      html += '<div class="trans-trace">';
      let dsi = 0;
      html += `<div class="trans-step" data-step="${dsi++}"><span class="ts-n">0</span><span class="ts-a"></span><span class="ts-c">⟨${smStackLine([s.ast])}, &nbsp;nil, &nbsp;${smMemLine(s.m0)}⟩<span class="ts-rule">initial configuration</span></span></div>`;
      const show = s.trace.length > 60 ? s.trace.slice(0, 30).concat([{ ellipsis: true, n: s.trace.length - 60 }], s.trace.slice(-30)) : s.trace;
      let k = 0;
      show.forEach(t => {
        if (t.ellipsis) { html += `<div class="trans-step" data-step="${dsi++}"><span class="ts-n">⋯</span><span class="ts-a"></span><span class="ts-c" style="color:var(--ink-muted);">(${t.n} further transitions omitted)</span></div>`; k += t.n; return; }
        k++;
        const isFinal = (k === s.trace.length) && s.done;
        html += `<div class="trans-step ${isFinal ? 'final' : ''}" data-step="${dsi++}"><span class="ts-n">${k}</span><span class="ts-a">→</span><span class="ts-c">${smCfgLine(t.cfg)}<span class="ts-rule">${esc(t.rule)} &nbsp;·&nbsp; ${esc(t.detail)}</span></span></div>`;
      });
      html += '</div>';
      if (nD + nC > 0) {
        html += `<p style="font-size:13px; color:var(--ink-muted);">Of ${s.trace.length} transitions, <strong>${nD}</strong> are phrase analysis (decomposing and pushing) and only <strong>${nC}</strong> perform a computation or touch memory — the abstract machine's stated disadvantage, measured.</p>`;
      }
    }
    out.innerHTML = html;
    ixTrace('smT', 'sm-output', { label: 'configuration', reset: true });
  }
