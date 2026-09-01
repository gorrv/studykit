  /* ============================================================
     TOOL 13 (W6): TYPE PARSER, COMPOSITION CHECK, PARTIAL APPLICATION
     ============================================================ */
  function tyLex(s) {
    const T = []; let i = 0;
    const src = s.replace(/→/g, '->');
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (src.substr(i, 2) === '->') { T.push({ k: '->' }); i += 2; continue; }
      if (/[A-Za-z_]/.test(c)) { let w = ''; while (i < src.length && /[A-Za-z0-9_']/.test(src[i])) w += src[i++]; T.push({ k: 'name', v: w }); continue; }
      if ('([,)]'.includes(c)) { T.push({ k: c }); i++; continue; }
      throw new Error('Unexpected character "' + c + '" in a type');
    }
    T.push({ k: 'eof' }); return T;
  }
  function tyParse(s) {
    const T = tyLex(s); let p = 0;
    const peek = () => T[p].k;
    const eat = k => { if (T[p].k !== k) throw new Error('Expected ' + k + ' in the type'); return T[p++]; };
    function atom() {
      if (peek() === 'name') { const n = eat('name').v; return /^[a-z]/.test(n) ? { k: 'tvar', n: n } : { k: 'con', n: n }; }
      if (peek() === '[') { eat('['); const t = fun(); eat(']'); return { k: 'list', t: t }; }
      if (peek() === '(') {
        eat('('); const first = fun();
        if (peek() === ',') { const ts = [first]; while (peek() === ',') { eat(','); ts.push(fun()); } eat(')'); return { k: 'tuple', ts: ts }; }
        eat(')'); return first;
      }
      throw new Error('Expected a type, found ' + peek());
    }
    function fun() { const l = atom(); if (peek() === '->') { eat('->'); return { k: 'fun', from: l, to: fun() }; } return l; }
    const t = fun();
    if (peek() !== 'eof') throw new Error('Unexpected input after the type');
    return t;
  }
  function tyShow(t, prec) {
    prec = prec || 0;
    switch (t.k) {
      case 'con': case 'tvar': return t.n;
      case 'list': return '[' + tyShow(t.t, 0) + ']';
      case 'tuple': return '(' + t.ts.map(x => tyShow(x, 0)).join(', ') + ')';
      case 'fun': { const s = tyShow(t.from, 1) + ' → ' + tyShow(t.to, 0); return prec > 0 ? '(' + s + ')' : s; }
      default: return '?';
    }
  }
  function tyEq(a, b) {
    if (a.k === 'tvar' || b.k === 'tvar') return true;         // a type variable matches anything
    if (a.k !== b.k) return false;
    switch (a.k) {
      case 'con': return a.n === b.n;
      case 'list': return tyEq(a.t, b.t);
      case 'tuple': return a.ts.length === b.ts.length && a.ts.every((x, i) => tyEq(x, b.ts[i]));
      case 'fun': return tyEq(a.from, b.from) && tyEq(a.to, b.to);
      default: return false;
    }
  }
  function runCompose() {
    const out = document.getElementById('cp-output');
    let f, g;
    try { f = tyParse(document.getElementById('cp-f').value); g = tyParse(document.getElementById('cp-g').value); }
    catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    let html = `<div style="font-family:'IBM Plex Mono',monospace; font-size:13.5px; margin-bottom:10px;">`;
    html += `(·) :: (b → c) → (a → b) → (a → c)<br><br>`;
    html += `f :: ${esc(tyShow(f, 0))}<br>g :: ${esc(tyShow(g, 0))}</div>`;
    if (f.k !== 'fun') { out.innerHTML = html + `<div class="verdict bad">✗ <strong>f is not a function type</strong>, so it cannot be the left argument of composition.</div>`; return; }
    if (g.k !== 'fun') { out.innerHTML = html + `<div class="verdict bad">✗ <strong>g is not a function type</strong>, so it cannot be the right argument of composition.</div>`; return; }
    const b1 = f.from, c = f.to, a = g.from, b2 = g.to;
    html += `<div class="tystep">
      <div class="tyrow"><span class="ty-expr">g takes</span><span class="ty-col">::</span><span class="ty-type">${esc(tyShow(a, 0))}</span></div>
      <div class="tyrow"><span class="ty-expr">g produces</span><span class="ty-col">::</span><span class="ty-type">${esc(tyShow(b2, 0))}</span></div>
      <div class="tyrow"><span class="ty-expr">f expects</span><span class="ty-col">::</span><span class="ty-type">${esc(tyShow(b1, 0))}</span></div>
      <div class="tyrow"><span class="ty-expr">f produces</span><span class="ty-col">::</span><span class="ty-type">${esc(tyShow(c, 0))}</span></div>
    </div>`;
    if (tyEq(b1, b2)) {
      html += `<div class="verdict safe">✓ <strong>Types match.</strong> g produces <code>${esc(tyShow(b2, 0))}</code> and f expects <code>${esc(tyShow(b1, 0))}</code>, so:
        <br><br><strong>f · g :: ${esc(tyShow({ k: 'fun', from: a, to: c }, 0))}</strong>
        <br><br>Remember <code>(f · g) x = f (g x)</code> — <em>g runs first</em>, even though it is written second.</div>`;
    } else {
      html += `<div class="verdict bad">✗ <strong>Type error.</strong> g produces <code>${esc(tyShow(b2, 0))}</code>, but f expects <code>${esc(tyShow(b1, 0))}</code>. The types do not meet in the middle, so <code>f · g</code> is ill-typed.
        <br><br>Try swapping them: composition is <em>not</em> commutative, and often exactly one order type-checks.</div>`;
    }
    out.innerHTML = html;
  }
  function cuPreset(w) {
    const N = document.getElementById('cu-name'), T = document.getElementById('cu-type'), A = document.getElementById('cu-args');
    if (w === 'plus') { N.value = 'plus'; T.value = 'Int -> Int -> Int'; A.value = '3 2'; }
    else if (w === 'partial') { N.value = 'plus'; T.value = 'Int -> Int -> Int'; A.value = '3'; }
    else if (w === 'tuple') { N.value = 'plusTuple'; T.value = '(Int,Int) -> Int'; A.value = '3'; }
    else if (w === 'over') { N.value = 'plus'; T.value = 'Int -> Int -> Int'; A.value = '3 2 1'; }
    runCurry();
  }
  /* split on spaces but keep bracketed groups together:  "(3,4) 5" -> ["(3,4)", "5"] */
  function cuSplitArgs(s) {
    const out = []; let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (/\s/.test(ch) && depth === 0) { if (cur) { out.push(cur); cur = ''; } continue; }
      cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }
  /* light shape check: does this argument look like a value of this type? */
  function cuArgFits(arg, ty) {
    const a = arg.trim();
    switch (ty.k) {
      case 'tvar': return true;
      case 'list': return a.startsWith('[');
      case 'tuple': return a.startsWith('(') && a.includes(',');
      case 'fun': return /^[A-Za-z_(]/.test(a);              // a function name or a section
      case 'con':
        if (['Int', 'Integer'].includes(ty.n)) return /^-?\d+$/.test(a);
        if (['Float', 'Double'].includes(ty.n)) return /^-?\d+(\.\d+)?$/.test(a);
        if (ty.n === 'Bool') return a === 'True' || a === 'False';
        if (ty.n === 'Char') return a.startsWith("'");
        if (ty.n === 'String') return a.startsWith('"');
        return true;
      default: return true;
    }
  }
  function runCurry() {
    const out = document.getElementById('cu-output');
    const name = (document.getElementById('cu-name').value || 'f').trim();
    const argsSrc = document.getElementById('cu-args').value.trim();
    let t;
    try { t = tyParse(document.getElementById('cu-type').value); }
    catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    const args = argsSrc === '' ? [] : cuSplitArgs(argsSrc);
    let cur = t, expr = name, html = '<div class="tystep">';
    html += `<div class="tyrow" data-step="0"><span class="ty-expr">${esc(expr)}</span><span class="ty-col">::</span><span class="ty-type">${esc(tyShow(cur, 0))}</span></div>`;
    let err = null, cuI = 0;
    for (const a of args) {
      if (cur.k !== 'fun') { err = `<strong>${esc(expr)}</strong> has type <code>${esc(tyShow(cur, 0))}</code>, which is not a function type — it cannot be applied to <code>${esc(a)}</code>.`; break; }
      if (!cuArgFits(a, cur.from)) {
        err = `<strong>${esc(expr)}</strong> expects an argument of type <code>${esc(tyShow(cur.from, 0))}</code>, but <code>${esc(a)}</code> is not one.`;
        if (cur.from.k === 'tuple') err += ` A tuple argument must be supplied <em>whole</em> — e.g. <code>${esc(name)} (3,4)</code>.`;
        break;
      }
      expr = (expr.includes(' ') ? '(' + expr + ')' : expr) + ' ' + a;
      cur = cur.to;
      const isFn = cur.k === 'fun';
      html += `<div class="tyrow ${isFn ? '' : 'done'}" data-step="${++cuI}"><span class="ty-expr">${esc(expr)}</span><span class="ty-col">::</span><span class="ty-type">${esc(tyShow(cur, 0))}</span></div>`;
    }
    html += '</div>';
    if (err) {
      html += `<div class="verdict bad">✗ ${err}<br><br>This is what the slides mean by "<em>multiple arguments can be passed as one in a tuple, but this does not allow partial application</em>": a tuple argument is <strong>one</strong> argument, so there is no intermediate stage to stop at.</div>`;
    } else if (cur.k === 'fun') {
      html += `<div class="verdict warn">⚠ <strong>Partially applied.</strong> After ${args.length} argument${args.length === 1 ? '' : 's'}, <code>${esc(expr)}</code> still has the function type <code>${esc(tyShow(cur, 0))}</code>. That is not an error — it is a perfectly good <em>value</em>, a new function built by partial application.</div>`;
    } else {
      html += `<div class="verdict safe">✓ Fully applied: <code>${esc(expr)} :: ${esc(tyShow(cur, 0))}</code>. Each application peeled off one arrow — which is what "<em>functions take no more than one argument</em>" means in practice.</div>`;
    }
    out.innerHTML = html;
    ixTrace('cuT', 'cu-output', { label: 'application', reset: true });
  }
