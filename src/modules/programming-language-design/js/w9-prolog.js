  /* ============================================================
     TOOL 19 (W9): PROLOG INTERPRETER (SLD resolution + backtracking)
     ============================================================ */
  function prParseProgram(src) {
    const clauses = [];
    // split on '.' at depth 0 followed by whitespace/end
    const lines = src.split('\n').map(l => l.replace(/%.*$/, '')).join('\n');
    let d = 0, cur = '';
    for (let i = 0; i < lines.length; i++) {
      const ch = lines[i];
      if ('(['.includes(ch)) d++; if (')]'.includes(ch)) d--;
      if (ch === '.' && d === 0 && (i + 1 >= lines.length || /\s/.test(lines[i + 1]))) { if (cur.trim()) clauses.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) clauses.push(cur.trim());
    return clauses.map(c => {
      const T = plLex(c);
      const h = plParseTerm(T, 0);
      let p = h.pos, body = [];
      if (T[p].k === ':-') {
        p++;
        while (true) {
          let neg = false;
          if (T[p].k === 'naf') { neg = true; p++; }
          const g = plParseTerm(T, p); body.push({ neg: neg, atom: g.t }); p = g.pos;
          if (T[p].k === ',') { p++; continue; }
          break;
        }
      }
      if (T[p].k !== 'eof') throw new Error('Could not parse the clause: ' + c);
      return { head: h.t, body: body };
    });
  }
  function prParseGoals(src) {
    const T = plLex(src.replace(/^\s*:-/, ''));
    const goals = []; let p = 0;
    if (T[p].k === 'eof') return goals;
    while (true) {
      let neg = false;
      if (T[p].k === 'naf') { neg = true; p++; }
      const g = plParseTerm(T, p); goals.push({ neg: neg, atom: g.t }); p = g.pos;
      if (T[p].k === ',') { p++; continue; }
      break;
    }
    if (T[p].k === '.') p++;
    if (T[p].k !== 'eof') throw new Error('Could not parse the query');
    return goals;
  }
  let prCounter = 0;
  function prRename(t, map) {
    switch (t.k) {
      case 'V': { if (!(t.n in map)) map[t.n] = { k: 'V', n: t.n + '_' + prCounter }; return map[t.n]; }
      case 'N': return t;
      case 'C': return { k: 'C', f: t.f, args: t.args.map(a => prRename(a, map)) };
      default: return t;
    }
  }
  function prDeref(t, s) { while (t.k === 'V' && s[t.n] !== undefined) t = s[t.n]; return t; }
  function prOccurs(v, t, s) {
    t = prDeref(t, s);
    if (t.k === 'V') return t.n === v;
    if (t.k === 'C') return t.args.some(a => prOccurs(v, a, s));
    return false;
  }
  function prUnify(a, b, s) {
    a = prDeref(a, s); b = prDeref(b, s);
    if (a.k === 'V' && b.k === 'V' && a.n === b.n) return s;
    if (a.k === 'V') { if (prOccurs(a.n, b, s)) return null; const t = Object.assign({}, s); t[a.n] = b; return t; }
    if (b.k === 'V') { if (prOccurs(b.n, a, s)) return null; const t = Object.assign({}, s); t[b.n] = a; return t; }
    if (a.k === 'N' && b.k === 'N') return a.v === b.v ? s : null;
    if (a.k === 'C' && b.k === 'C') {
      if (a.f !== b.f || a.args.length !== b.args.length) return null;
      let cur = s;
      for (let i = 0; i < a.args.length; i++) { cur = prUnify(a.args[i], b.args[i], cur); if (!cur) return null; }
      return cur;
    }
    return null;
  }
  function prApply(t, s) {
    t = prDeref(t, s);
    if (t.k === 'C') return { k: 'C', f: t.f, args: t.args.map(a => prApply(a, s)) };
    return t;
  }
  function prArith(t, s) {
    t = prDeref(t, s);
    if (t.k === 'N') return t.v;
    if (t.k === 'V') throw new Error('arguments are not sufficiently instantiated');
    if (t.k === 'C' && t.args.length === 2 && ['+', '-', '*', '/'].includes(t.f)) {
      const a = prArith(t.args[0], s), b = prArith(t.args[1], s);
      if (t.f === '+') return a + b; if (t.f === '-') return a - b;
      if (t.f === '*') return a * b; if (t.f === '/') { if (b === 0) throw new Error('division by zero'); return Math.trunc(a / b); }
    }
    if (t.k === 'C' && t.args.length === 1 && t.f === '-') return -prArith(t.args[0], s);
    throw new Error('not an arithmetic expression: ' + plShow(t, 0));
  }
  const PR_BUILTIN = ['is', '<', '>', '=<', '>=', '=', 'true', 'fail'];
  function prSolveBuiltin(g, s) {
    const a = g;
    if (a.k !== 'C') return null;
    if (a.f === 'true' && !a.args.length) return s;
    if (a.f === 'fail' && !a.args.length) return null;
    if (a.f === '=' && a.args.length === 2) return prUnify(a.args[0], a.args[1], s);
    if (a.f === 'is' && a.args.length === 2) {
      const v = prArith(a.args[1], s);
      return prUnify(a.args[0], { k: 'N', v: v }, s);
    }
    if (['<', '>', '=<', '>='].includes(a.f) && a.args.length === 2) {
      const x = prArith(a.args[0], s), y = prArith(a.args[1], s);
      const ok = a.f === '<' ? x < y : a.f === '>' ? x > y : a.f === '=<' ? x <= y : x >= y;
      return ok ? s : null;
    }
    return undefined;                                  // not a built-in
  }
  function prSolve(goals, prog, s, depth, ctx) {
    if (ctx.steps++ > ctx.maxSteps) throw { prLimit: true };
    if (!goals.length) { ctx.onSolution(s); return ctx.solutions.length >= ctx.maxSolutions; }
    if (depth > ctx.maxDepth) return false;
    const [g, ...rest] = goals;
    const atom = prApply(g.atom, s);
    if (ctx.trace.length < ctx.maxTrace) ctx.trace.push({ depth: depth, goals: goals.map(x => (x.neg ? '\\+ ' : '') + plShow(prApply(x.atom, s), 0)) });
    // negation as failure
    if (g.neg) {
      const sub = { steps: 0, maxSteps: 4000, maxDepth: ctx.maxDepth, maxSolutions: 1, maxTrace: 0, trace: [], solutions: [], onSolution: function (b) { this.solutions.push(b); } };
      let proved = false;
      try { prSolve([{ neg: false, atom: g.atom }], prog, s, depth + 1, sub); proved = sub.solutions.length > 0; }
      catch (e) { if (!e || !e.prLimit) throw e; }
      if (proved) return false;                          // \+ G fails because G succeeds
      return prSolve(rest, prog, s, depth + 1, ctx);
    }
    // built-ins
    let bi;
    try { bi = prSolveBuiltin(atom, s); }
    catch (e) { ctx.errors.push(e.message); return false; }
    if (bi !== undefined) {
      if (bi === null) return false;
      return prSolve(rest, prog, bi, depth + 1, ctx);
    }
    // user clauses, in program order
    for (const cl of prog) {
      const map = {}; prCounter++;
      const h = prRename(cl.head, map);
      const s2 = prUnify(atom, h, s);
      if (!s2) continue;
      const body = cl.body.map(b => ({ neg: b.neg, atom: prRename(b.atom, map) }));
      if (prSolve(body.concat(rest), prog, s2, depth + 1, ctx)) return true;
    }
    return false;
  }
  function prVarsOf(t, acc) {
    acc = acc || [];
    if (t.k === 'V') { if (!acc.includes(t.n)) acc.push(t.n); }
    else if (t.k === 'C') t.args.forEach(a => prVarsOf(a, acc));
    return acc;
  }
  function prPreset(w) {
    const P = document.getElementById('pr-prog'), Q = document.getElementById('pr-query');
    if (w === 'likes') {
      P.value = 'based(prolog, logic).\nbased(haskell, maths).\nlikes(claire, maths).\nlikes(claire, logic).\nlikes(max, logic).\nlikes(X, P) :- based(P, Y), likes(X, Y).';
      Q.value = 'likes(Z, prolog)';
    } else if (w === 'snowy') {
      P.value = 'rainy(tuesday).\ntemperature(tuesday, celsius(0)).\nsnowy(X) :- rainy(X), temperature(X, celsius(Y)), Y =< 0.';
      Q.value = 'snowy(X)';
    } else if (w === 'rev') {
      P.value = 'app([], L, L).\napp([X|L], Y, [X|Z]) :- app(L, Y, Z).\nrev([],[]).\nrev([H|T],L) :- rev(T,L1), app(L1,[H],L).';
      Q.value = 'rev([1,2,3],X)';
    } else if (w === 'append') {
      P.value = 'app([], L, L).\napp([X|L], Y, [X|Z]) :- app(L, Y, Z).';
      Q.value = 'app(X, [1,2], U)';
    } else if (w === 'fact') {
      P.value = 'fact(0, 1).\nfact(X, N) :- X > 0, Y is X - 1, fact(Y, M), N is X * M.';
      Q.value = 'fact(5, N)';
    } else if (w === 'naf') {
      P.value = 'p(a).\nq(a).\ns(b).\nr(X) :- p(X), q(X), \\+ s(X).';
      Q.value = 'r(X)';
    }
    runProlog();
  }
  function runProlog() {
    const out = document.getElementById('pr-output');
    let prog, goals;
    try { prog = prParseProgram(document.getElementById('pr-prog').value); goals = prParseGoals(document.getElementById('pr-query').value); }
    catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    if (!goals.length) { out.innerHTML = `<div class="tool-error">Give a query.</div>`; return; }
    const qvars = []; goals.forEach(g => prVarsOf(g.atom, qvars));
    prCounter = 0;
    const ctx = {
      steps: 0, maxSteps: 60000, maxDepth: 120, maxSolutions: 8, maxTrace: 24,
      trace: [], solutions: [], errors: [],
      onSolution: function (s) {
        // rename any remaining fresh variables to _A, _B, ... for readability
        const seen = {}; let next = 0;
        const pretty = t => {
          t = prApply(t, s);
          if (t.k === 'V') {
            if (!(t.n in seen)) seen[t.n] = qvars.includes(t.n) ? t.n : '_' + String.fromCharCode(65 + (next++ % 26));
            return { k: 'V', n: seen[t.n] };
          }
          if (t.k === 'C') return { k: 'C', f: t.f, args: t.args.map(pretty) };
          return t;
        };
        const b = qvars.map(v => v + ' = ' + plShow(pretty({ k: 'V', n: v }), 0));
        const txt = b.length ? b.join(', ') : 'true';
        if (!this.solutions.includes(txt)) this.solutions.push(txt);
      }
    };
    let limited = false;
    try { prSolve(goals, prog, {}, 0, ctx); }
    catch (e) { if (e && e.prLimit) limited = true; else { out.innerHTML = `<div class="tool-error">${esc(String(e && e.message || e))}</div>`; return; } }
    let html = '';
    html += `<div style="margin-bottom:10px;"><span class="stat-pill dark">${ctx.solutions.length}${ctx.solutions.length >= ctx.maxSolutions || limited ? '+' : ''} solution${ctx.solutions.length === 1 ? '' : 's'}</span>`;
    html += `<span class="stat-pill a">${ctx.steps} resolution steps</span></div>`;
    html += '<div class="sols">';
    if (!ctx.solutions.length) html += `<div class="sol none">false.</div>`;
    else ctx.solutions.forEach(s => { html += `<div class="sol">${esc(s)}${s === 'true' ? '' : ' .'}</div>`; });
    html += '</div>';
    if (ctx.errors.length) html += `<div class="verdict warn">⚠ ${esc(ctx.errors[0])} — in Prolog, arithmetic with <code>is</code> requires its right-hand side to be fully instantiated.</div>`;
    if (limited) html += `<div class="verdict warn">Search stopped at the step limit — this query may have infinitely many solutions or a non-terminating branch. (Try <code>app(X,[1,2],U)</code> to see this deliberately.)</div>`;
    else if (ctx.solutions.length >= ctx.maxSolutions) html += `<div class="verdict warn">Showing the first ${ctx.maxSolutions} solutions only.</div>`;
    // goal trace
    if (ctx.trace.length) {
      html += `<h4 style="font-size:16px; margin-top:16px;">Goal sequence <span style="font-size:11px; color:var(--ink-muted); font-family:'IBM Plex Mono',monospace;">(first ${Math.min(ctx.trace.length, ctx.maxTrace)} states of the search, leftmost literal selected)</span></h4>`;
      html += '<div class="goal-trace">';
      ctx.trace.forEach((t, i) => {
        html += `<div class="gt-row" data-step="${i}"><span class="gt-n">${i + 1}</span><span class="gt-goal">:- ${esc(t.goals.join(', '))}.</span></div>`;
      });
      html += '</div>';
    }
    out.innerHTML = html;
    ixTrace('plT', 'pr-output', { label: 'goal state', reset: true });
  }
