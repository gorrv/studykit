  /* ============================================================
     TOOL 2: AMBIGUITY / PARSE TREE / DERIVATION EXPLORER
     Grammar:  Exp ::= Num | Exp Op Exp
               Op  ::= + | - | * | div
               Num ::= Digit | Digit Num
               Digit ::= 0..9
     ============================================================ */
  const OP_SYMBOL = { '+': '+', '-': '−', '*': '∗', 'div': 'div' };
  function ptTokenize(src) {
    const toks = [];
    let i = 0;
    const s = src.trim();
    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c >= '0' && c <= '9') {
        let d = '';
        while (i < s.length && s[i] >= '0' && s[i] <= '9') { d += s[i]; i++; }
        toks.push({ k: 'num', v: d });
        continue;
      }
      if (s.substr(i, 3).toLowerCase() === 'div') { toks.push({ k: 'op', v: 'div' }); i += 3; continue; }
      if (c === '+' || c === '-' || c === '*') { toks.push({ k: 'op', v: c }); i++; continue; }
      throw new Error('Unexpected character "' + c + '". Allowed: digits and the operators + - * div.');
    }
    if (toks.length === 0) throw new Error('Empty expression.');
    if (toks[0].k !== 'num') throw new Error('An expression must start with a number.');
    for (let j = 0; j < toks.length; j++) {
      const expected = (j % 2 === 0) ? 'num' : 'op';
      if (toks[j].k !== expected) throw new Error('Expected ' + (expected === 'num' ? 'a number' : 'an operator') + ' at position ' + (j + 1) + '.');
    }
    if (toks.length % 2 === 0) throw new Error('The expression must end with a number.');
    return toks;
  }
  // build tree by folding left or right
  function ptBuild(toks, assoc) {
    const nums = toks.filter(t => t.k === 'num').map(t => ({ t: 'num', d: t.v }));
    const ops  = toks.filter(t => t.k === 'op').map(t => t.v);
    if (nums.length === 1) return nums[0];
    if (assoc === 'left') {
      let node = nums[0];
      for (let i = 0; i < ops.length; i++) node = { t: 'op', op: ops[i], l: node, r: nums[i + 1] };
      return node;
    } else {
      let node = nums[nums.length - 1];
      for (let i = ops.length - 1; i >= 0; i--) node = { t: 'op', op: ops[i], l: nums[i], r: node };
      return node;
    }
  }
  function ptEval(n) {
    if (n.t === 'num') return parseInt(n.d, 10);
    const a = ptEval(n.l), b = ptEval(n.r);
    switch (n.op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case 'div': return b === 0 ? NaN : Math.trunc(a / b);
    }
  }
  function ptTerm(n) {
    if (n.t === 'num') return n.d;
    return OP_SYMBOL[n.op] + '(' + ptTerm(n.l) + ', ' + ptTerm(n.r) + ')';
  }
  function ptInfix(n, top) {
    if (n.t === 'num') return n.d;
    const inner = ptInfix(n.l, false) + ' ' + OP_SYMBOL[n.op] + ' ' + ptInfix(n.r, false);
    return top ? inner : '(' + inner + ')';
  }
  /* --- SVG tree rendering --- */
  function ptLayout(n, depth, ctr) {
    n.depth = depth;
    if (n.t === 'num') { n.x = ctr.i++; return n; }
    ptLayout(n.l, depth + 1, ctr);
    ptLayout(n.r, depth + 1, ctr);
    n.x = (n.l.x + n.r.x) / 2;
    return n;
  }
  function ptDepth(n) { return n.t === 'num' ? 1 : 1 + Math.max(ptDepth(n.l), ptDepth(n.r)); }
  function ptLeaves(n) { return n.t === 'num' ? 1 : ptLeaves(n.l) + ptLeaves(n.r); }
  function ptSvg(root) {
    const ctr = { i: 0 };
    ptLayout(root, 0, ctr);
    const cols = ptLeaves(root), rows = ptDepth(root);
    const CW = 54, RH = 52, PAD = 26, R = 15;
    const W = Math.max(cols * CW, 120) + PAD * 2;
    const H = rows * RH + PAD * 2;
    const px = n => PAD + n.x * CW + CW / 2;
    const py = n => PAD + n.depth * RH + R;
    let edges = '', nodes = '';
    (function walk(n) {
      if (n.t === 'num') {
        nodes += `<circle cx="${px(n)}" cy="${py(n)}" r="${R - 1}" fill="var(--tint-a)" stroke="var(--accent)" stroke-width="1.5"/>`;
        nodes += `<text x="${px(n)}" y="${py(n) + 5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="13" fill="var(--accent)">${n.d}</text>`;
        return;
      }
      [n.l, n.r].forEach(ch => {
        const x1 = px(n), y1 = py(n), x2 = px(ch), y2 = py(ch);
        const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
        const sx = x1 + (dx / len) * R, sy = y1 + (dy / len) * R;
        const ex = x2 - (dx / len) * R, ey = y2 - (dy / len) * R;
        edges += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="var(--ink-soft)" stroke-width="1.5"/>`;
      });
      nodes += `<circle cx="${px(n)}" cy="${py(n)}" r="${R}" fill="var(--tint-b)" stroke="var(--accent-2)" stroke-width="2"/>`;
      nodes += `<text x="${px(n)}" y="${py(n) + 5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="14" fill="var(--accent-2)">${OP_SYMBOL[n.op]}</text>`;
      walk(n.l); walk(n.r);
    })(root);
    return `<svg viewBox="0 0 ${W} ${H}" style="max-width:100%; width:${W}px;" xmlns="http://www.w3.org/2000/svg">${edges}${nodes}</svg>`;
  }
  /* --- leftmost derivation from a tree --- */
  function ptDerivation(root) {
    // symbols: {nt:'Exp'|'Num'|'Digit'|'Op', node|digits} or {t:'...'} terminal
    let form = [{ nt: 'Exp', node: root }];
    const steps = [form.slice()];
    let guard = 0;
    while (guard++ < 300) {
      const idx = form.findIndex(s => s.nt);
      if (idx === -1) break;
      const sym = form[idx];
      let repl = [];
      if (sym.nt === 'Exp') {
        const n = sym.node;
        if (n.t === 'num') repl = [{ nt: 'Num', digits: n.d }];
        else repl = [{ nt: 'Exp', node: n.l }, { nt: 'Op', op: n.op }, { nt: 'Exp', node: n.r }];
      } else if (sym.nt === 'Num') {
        const d = sym.digits;
        if (d.length === 1) repl = [{ nt: 'Digit', digits: d }];
        else repl = [{ nt: 'Digit', digits: d[0] }, { nt: 'Num', digits: d.slice(1) }];
      } else if (sym.nt === 'Digit') {
        repl = [{ t: sym.digits }];
      } else if (sym.nt === 'Op') {
        repl = [{ t: OP_SYMBOL[sym.op] }];
      }
      form = form.slice(0, idx).concat(repl, form.slice(idx + 1));
      steps.push(form.slice());
    }
    return steps;
  }
  function ptRenderDeriv(steps) {
    let html = '<div class="deriv">';
    steps.forEach((form, i) => {
      const nextIdx = form.findIndex(s => s.nt);
      const body = form.map((s, j) => {
        if (s.t) return `<span class="tm">${s.t}</span>`;
        const cls = (j === nextIdx) ? 'nt next' : 'nt';
        return `<span class="${cls}">${s.nt}</span>`;
      }).join(' ');
      const isFinal = nextIdx === -1;
      html += `<div class="deriv-row ${isFinal ? 'final' : ''}" data-step="${i}">`;
      html += `<span class="step-idx">${i}</span>`;
      html += `<span class="arrow">${i === 0 ? '&nbsp;&nbsp;' : '→'}</span>`;
      html += `<span class="sform">${body}</span></div>`;
    });
    html += '</div>';
    return html;
  }
  function runParse() {
    const out = document.getElementById('pt-output');
    let toks;
    try { toks = ptTokenize(document.getElementById('pt-expr').value); }
    catch (e) { out.innerHTML = `<div class="tool-error">${e.message}</div>`; return; }
    const opCount = toks.filter(t => t.k === 'op').length;
    const left  = ptBuild(toks, 'left');
    const right = ptBuild(toks, 'right');
    const vl = ptEval(left), vr = ptEval(right);
    let html = '';
    if (opCount === 0) {
      html += `<div class="verdict safe">A single number has only one parse tree — no ambiguity to show. Add an operator, e.g. <code>1 - 2 - 3</code>.</div>`;
      out.innerHTML = html; return;
    }
    html += '<div class="tree-pair">';
    html += `<div class="tree-card"><div class="tree-title">Reading A · left-associative</div>
      <div class="tree-expr">${ptInfix(left, false)}</div>${ptSvg(left)}
      <div class="tree-expr" style="margin-top:8px; color:var(--accent-2);">${ptTerm(left)}</div>
      <div class="tree-val a">= ${isNaN(vl) ? 'undefined (division by zero)' : vl}</div></div>`;
    html += `<div class="tree-card"><div class="tree-title">Reading B · right-associative</div>
      <div class="tree-expr">${ptInfix(right, false)}</div>${ptSvg(right)}
      <div class="tree-expr" style="margin-top:8px; color:var(--accent-2);">${ptTerm(right)}</div>
      <div class="tree-val b">= ${isNaN(vr) ? 'undefined (division by zero)' : vr}</div></div>`;
    html += '</div>';
    if (opCount === 1) {
      html += `<div class="verdict safe">✓ With a single operator both readings coincide — this string is <strong>not</strong> ambiguous under this grammar. Add a second operator to break it.</div>`;
    } else if (vl === vr) {
      html += `<div class="verdict warn">⚠ Two <strong>distinct parse trees</strong> exist, so the grammar <em>is</em> ambiguous for this string — but here both happen to evaluate to <strong>${vl}</strong>, because these operators are associative. Ambiguity is about <em>structure</em>, not about whether the values coincide. Try <code>1 - 2 - 3</code> or <code>8 div 4 div 2</code>.</div>`;
    } else {
      html += `<div class="verdict bad">💥 Ambiguous — and it matters. The same string of characters yields <strong>${vl}</strong> or <strong>${vr}</strong> depending on which derivation you happened to take. This is exactly why the course switches to abstract syntax.</div>`;
    }
    html += `<div style="margin-top:16px;"><span class="stat-pill a">Reading A: ${ptTerm(left)}</span><span class="stat-pill c">Reading B: ${ptTerm(right)}</span></div>`;
    html += `<h4 style="margin-top:20px; font-size:16px;">Leftmost derivation — Reading A <span style="font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--ink-muted);">(highlighted symbol is expanded next)</span></h4>`;
    html += ptRenderDeriv(ptDerivation(left));
    html += `<h4 style="margin-top:16px; font-size:16px;">Leftmost derivation — Reading B</h4>`;
    html += ptRenderDeriv(ptDerivation(right));
    out.innerHTML = html;
    ixTrace('ptT', 'pt-output', { label: 'derivation step', reset: true });
  }
