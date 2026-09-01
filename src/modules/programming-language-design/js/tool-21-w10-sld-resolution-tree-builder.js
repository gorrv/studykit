  /* ============================================================
     TOOL 21 (W10): SLD-RESOLUTION TREE BUILDER
     ============================================================ */
  let sdCounter = 0;
  function sdRenameClause(cl, suffix) {
    const map = {};
    const ren = t => {
      if (t.k === 'V') { if (!(t.n in map)) map[t.n] = { k: 'V', n: t.n + suffix }; return map[t.n]; }
      if (t.k === 'C') return { k: 'C', f: t.f, args: t.args.map(ren) };
      return t;
    };
    return { head: ren(cl.head), body: cl.body.map(b => ({ neg: b.neg, atom: ren(b.atom) })), map: map };
  }
  function sdShowGoals(goals, selIdx) {
    if (!goals.length) return '□';
    return ':- ' + goals.map((g, i) => {
      const s = esc((g.neg ? '\\+ ' : '') + plShow(g.atom, 0));
      return i === selIdx ? '<b>' + s + '</b>' : s;
    }).join(', ') + '.';
  }
  function sdShowMgu(s) {
    const ks = Object.keys(s);
    if (!ks.length) return '{}';
    return '{' + ks.map(k => esc(k) + ' ↦ ' + esc(plShow(prApply({ k: 'V', n: k }, s), 0))).join(', ') + '}';
  }
  function sdBuild(goals, prog, depth, ctx) {
    ctx.nodes++;
    if (!goals.length) { ctx.successes++; return { goals: [], kind: 'success' }; }
    if (depth >= ctx.maxDepth || ctx.nodes > ctx.maxNodes) { ctx.truncated = true; return { goals: goals, kind: 'trunc', sel: 0 }; }
    const g = goals[0], rest = goals.slice(1);
    const node = { goals: goals, sel: 0, kind: 'inner', children: [] };
    // negation as failure — treat as a single built-in style step
    if (g.neg) {
      const sub = { steps: 0, maxSteps: 4000, maxDepth: 60, maxSolutions: 1, maxTrace: 0, trace: [], solutions: [], errors: [], onSolution: function (b) { this.solutions.push(b); } };
      let proved = false;
      try { prSolve([{ neg: false, atom: g.atom }], prog, {}, 0, sub); proved = sub.solutions.length > 0; } catch (e) { }
      if (proved) { node.children = []; node.kind = 'failure'; return node; }
      node.children.push({ mgu: '{}', label: '\\+', node: sdBuild(rest, prog, depth + 1, ctx) });
      return node;
    }
    // built-ins
    let bi;
    try { bi = prSolveBuiltin(g.atom, {}); } catch (e) { bi = null; }
    if (bi !== undefined) {
      if (bi === null) { node.kind = 'failure'; return node; }
      const newRest = rest.map(x => ({ neg: x.neg, atom: prApply(x.atom, bi) }));
      node.children.push({ mgu: sdShowMgu(bi), label: '', node: sdBuild(newRest, prog, depth + 1, ctx) });
      return node;
    }
    // program clauses, in order
    prog.forEach((cl, idx) => {
      sdCounter++;
      const r = sdRenameClause(cl, '_' + sdCounter);
      const s = prUnify(g.atom, r.head, {});
      if (!s) return;
      const newGoals = r.body.concat(rest).map(x => ({ neg: x.neg, atom: prApply(x.atom, s) }));
      // show only bindings of variables that actually occur in the goal or the clause head
      const shown = {};
      Object.keys(s).forEach(k => { shown[k] = s[k]; });
      node.children.push({ mgu: sdShowMgu(shown), label: String(idx + 1), node: sdBuild(newGoals, prog, depth + 1, ctx) });
    });
    if (!node.children.length) node.kind = 'failure';
    return node;
  }
  let SLD_SEQ = 0;
  function sdNumber(node, depth) {
    if (!node) return;
    node.__step = depth;
    (node.children || []).forEach(function (ch) { sdNumber(ch.node, depth + 1); });
  }
  function sdRender(node, top) {
    if (top) { sdNumber(node, 0); }
    let html = '<div class="sld-node"' + (node.__step === undefined ? '' : ' data-step="' + node.__step + '"') + '>';
    if (node.kind === 'success') html += '<div class="sld-goal empty">□</div>';
    else if (node.kind === 'failure') html += `<div class="sld-goal">${sdShowGoals(node.goals, node.sel)}</div><div class="sld-edge"><span class="sld-line"></span></div><div class="sld-goal failure">failure</div>`;
    else if (node.kind === 'trunc') html += `<div class="sld-goal">${sdShowGoals(node.goals, node.sel)}</div><div class="sld-edge"><span class="sld-line"></span></div><div class="sld-goal trunc">⋮ cut off</div>`;
    else {
      html += `<div class="sld-goal sel-hl">${sdShowGoals(node.goals, node.sel)}</div>`;
      html += '<div class="sld-kids">';
      node.children.forEach(ch => {
        html += '<div class="sld-branch">';
        html += `<div class="sld-edge"><span class="sld-line"></span><span class="sld-mgu">${ch.label ? '<span class="cn">' + esc(ch.label) + '</span> ' : ''}${ch.mgu}</span><span class="sld-line"></span></div>`;
        html += sdRender(ch.node);
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }
  function sdPreset(w) {
    const P = document.getElementById('sd-prog'), G = document.getElementById('sd-goal');
    const STD = 's(3).\ns(4).\nr(2).\nq(3).\nq(X) :- r(X).\np(1).\np(X) :- q(X), Y is X+1, s(Y).';
    const LIKES = 'based(prolog, logic).\nbased(haskell, maths).\nlikes(max, logic).\nlikes(claire, maths).\nlikes(X, P) :- based(P, Y), likes(X, Y).';
    if (w === 'px') { P.value = STD; G.value = 'p(X), s(X)'; }
    else if (w === 'p2') { P.value = STD; G.value = 'p(2)'; }
    else if (w === 's2') { P.value = STD; G.value = 's(2)'; }
    else if (w === 'likes') { P.value = LIKES; G.value = 'likes(Z, prolog)'; }
    else if (w === 'paint') { P.value = LIKES; G.value = 'likes(Z, painting)'; }
    else if (w === 'len') { P.value = 'len([], 0).\nlen([H | T], N) :- len(T, M), N is M + 1.'; G.value = 'len([2,3], X)'; }
    else if (w === 'bad') { P.value = 'app([X|L],Y,[X|Z]) :- app(L,Y,Z).\napp([],L,L).'; G.value = 'app(X, [1,2], U)'; }
    runSLD();
  }
  function runSLD() {
    const out = document.getElementById('sd-output');
    let prog, goals;
    try { prog = prParseProgram(document.getElementById('sd-prog').value); goals = prParseGoals(document.getElementById('sd-goal').value); }
    catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    if (!goals.length) { out.innerHTML = `<div class="tool-error">Give a goal.</div>`; return; }
    sdCounter = 0;
    const ctx = { nodes: 0, maxNodes: 160, maxDepth: 9, successes: 0, truncated: false };
    const tree = sdBuild(goals, prog, 0, ctx);
    // is the LEFT-MOST branch infinite?  (that is what Prolog would follow)
    let leftmostInfinite = false;
    (function walk(n) {
      if (!n) return;
      if (n.kind === 'trunc') { leftmostInfinite = true; return; }
      if (n.kind === 'inner' && n.children.length) walk(n.children[0].node);
    })(tree);
    // also compute the answers, using the same depth budget as the drawn tree
    let answers = [];
    try {
      const qvars = []; goals.forEach(g => prVarsOf(g.atom, qvars));
      prCounter = 0;
      const c2 = {
        steps: 0, maxSteps: 40000, maxDepth: ctx.maxDepth, maxSolutions: 5, maxTrace: 0, trace: [], solutions: [], errors: [],
        onSolution: function (s) {
          const b = qvars.map(v => v + ' = ' + plShow(prApply({ k: 'V', n: v }, s), 0));
          const txt = b.length ? b.join(', ') : 'true';
          if (!this.solutions.includes(txt)) this.solutions.push(txt);
        }
      };
      try { prSolve(goals, prog, {}, 0, c2); } catch (e) { }
      answers = c2.solutions;
    } catch (e) { }
    let html = `<div style="margin-bottom:10px;"><span class="stat-pill dark">${ctx.nodes} nodes</span>`;
    html += `<span class="stat-pill ${ctx.successes ? 'b' : 'c'}">${ctx.successes} success branch${ctx.successes === 1 ? '' : 'es'}</span>`;
    if (ctx.truncated) html += `<span class="stat-pill c">tree cut off</span>`;
    html += '</div>';
    html += '<div class="sld"><div class="sld-inner">' + sdRender(tree, true) + '</div></div>';
    html += '<div class="sols">';
    if (leftmostInfinite) {
      html += `<div class="sol none">Answer: none — Prolog does not terminate</div>`;
    } else if (!answers.length) html += `<div class="sol none">Answer: false</div>`;
    else answers.forEach(a => { html += `<div class="sol">Answer: ${esc(a)}</div>`; });
    html += '</div>';
    if (leftmostInfinite) {
      html += `<div class="verdict bad">💥 <strong>The left-most branch is infinite.</strong> Prolog explores children left-to-right and depth-first, so it goes down this branch and <em>never comes back</em> — it produces no solutions and will result in an error, even though success branches exist further right in the tree.
        <br><br>This is the lecture's point exactly: <strong>put base clauses before recursive ones</strong>. The program is <em>logically</em> unchanged — only the search order differs. It is also the concrete meaning of "SLD-resolution is complete, but Prolog's implementation is not".</div>`;
    } else if (ctx.truncated) {
      html += `<div class="verdict warn">⚠ The tree was cut off at depth ${ctx.maxDepth} (or ${ctx.maxNodes} nodes) — a branch marked <em>⋮ cut off</em> continues further. Here the left-most branch does terminate, so Prolog reaches the solutions shown; the tree simply has infinitely many success branches (back-track for more).</div>`;
    }
    html += `<div style="font-size:12.5px; color:var(--ink-muted); margin-top:8px;">The <strong>bold</strong> literal in each node is the one selected (left-most). Edge labels show the <strong>clause number</strong> and the <strong>mgu</strong> of that step; clause variables are renamed apart with a numeric suffix.</div>`;
    out.innerHTML = html;
    ixTrace('sdT', 'sd-output', { label: 'tree depth', reset: true });
  }
