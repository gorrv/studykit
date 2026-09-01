  /* ============================================================
     TOOL 22: SELF-TEST GENERATOR
     Questions are generated, and marked by the same engines the
     week-by-week tools use.
     ============================================================ */
  const qzPick = a => a[Math.floor(Math.random() * a.length)];
  const qzInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  function qzNorm(s) { return String(s).toLowerCase().replace(/\s+/g, '').replace(/[.;]$/, ''); }
  /* parse a user-written substitution into a canonical string */
  function qzCanonSubst(txt) {
    let t = txt.trim();
    while (t.startsWith('{') && t.endsWith('}')) t = t.slice(1, -1).trim();   // tolerate {…} and {{…}}
    if (t === '') return '{}';
    const parts = []; let d = 0, cur = '';
    for (const ch of t) {
      if ('(['.includes(ch)) d++; if (')]'.includes(ch)) d--;
      if (ch === ',' && d === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    const pairs = parts.map(p => {
      const q = p.trim().replace(/↦/g, '->').replace(/:=/g, '->');
      let i = q.indexOf('->');
      if (i < 0) i = q.indexOf('=');
      if (i < 0) throw new Error('could not read "' + p.trim() + '" as a binding');
      const v = q.slice(0, i).trim();
      const rest = q.slice(i + (q[i] === '-' ? 2 : 1)).trim();
      return v + '->' + plShow(plParse(rest), 0);
    });
    pairs.sort();
    return '{' + pairs.join(',') + '}';
  }
  function qzCanonTerm(txt) { return plShow(plParse(txt), 0); }
  /* ---------- generators ---------- */
  const QZ_GEN = [];
  /* --- unification --- */
  QZ_GEN.push({ topic: 'log', make: function () {
    const cs = ['a', 'b', 'c'], vs = ['X', 'Y', 'Z'];
    const shape = qzPick(['ok1', 'ok2', 'clash', 'occ', 'ok3']);
    let prob;
    if (shape === 'ok1') { const c = qzPick(cs), v = qzPick(vs); prob = `f(${c}, ${c}) = f(${v}, ${c})`; }
    else if (shape === 'ok2') { const c = qzPick(cs), d = qzPick(cs); prob = `p(X, g(Y)) = p(${c}, g(${d}))`; }
    else if (shape === 'ok3') { const c = qzPick(cs); prob = `f(g(${c}), Y) = f(X, ${c})`; }
    else if (shape === 'clash') { const c = qzPick(cs); prob = `f(X, ${c}) = g(X, ${c})`; }
    else { const v = qzPick(vs); prob = `${v} = f(${v})`; }
    const res = unSolve(unParseProblem(prob));
    const ans = res.ok
      ? '{' + res.mgu.map(e => plShow(e.l, 0) + '->' + plShow(e.r, 0)).sort().join(',') + '}'
      : 'failure';
    return {
      topic: 'Unification (W10)',
      prompt: `Solve the unification problem — give the <strong>mgu</strong>, or write <code>failure</code> if the terms are not unifiable.<pre>{ ${esc(prob)} }</pre>`,
      placeholder: 'X -> a, Y -> b   (or: failure)',
      answer: ans === 'failure' ? 'failure' : ans.replace(/->/g, ' ↦ '),
      check: function (inp) {
        const t = qzNorm(inp);
        if (['failure', 'fail', 'none', 'nomgu', 'notunifiable'].includes(t)) return { ok: ans === 'failure' };
        if (ans === 'failure') return { ok: false };
        try { return { ok: qzCanonSubst(inp).replace(/\s/g, '') === ans.replace(/\s/g, '') }; }
        catch (e) { return { ok: false, msg: 'Could not read that as a substitution — write it like <code>X -&gt; a, Y -&gt; b</code>.' }; }
      },
      explain: res.ok
        ? `Applying the Martelli–Montanari rules gives <code>${esc(ans.replace(/->/g, ' ↦ '))}</code>. Step through it in the <em>unification stepper</em>.`
        : `This is a <strong>failure</strong> case — rule (${res.steps[res.steps.length - 1].rule}) applies: ${esc(res.steps[res.steps.length - 1].fail)}.`
    };
  }});
  /* --- substitution application --- */
  QZ_GEN.push({ topic: 'log', make: function () {
    const t = qzPick(['f(f(X, g(a)), Y)', 'p(X, X, f(g(a), Y))', 'g(f(X, Y))', 'f(X, g(Y))']);
    const sg = qzPick(['X -> g(Y), Y -> a', 'X -> a, Y -> b', 'X -> Y, Y -> b', 'Y -> f(a,b)']);
    const sigma = sbParseSigma(sg);
    const res = plShow(sbApplySim(plParse(t), sigma), 0);
    return {
      topic: 'Substitutions (W9)',
      prompt: `Apply the substitution to the term. Remember the replacements happen <strong>simultaneously</strong>.<pre>t = ${esc(t)}\nσ = {${esc(sg.replace(/->/g, ' ↦ '))}}</pre>What is <code>tσ</code>?`,
      placeholder: 'f(...)',
      answer: res,
      check: function (inp) { try { return { ok: qzCanonTerm(inp) === res }; } catch (e) { return { ok: false, msg: 'Could not parse that term.' }; } },
      explain: `<code>tσ = ${esc(res)}</code>. Applying the mappings one after another instead of at once is the classic mistake — check with the <em>substitution applier</em>.`
    };
  }});
  /* --- Prolog query --- */
  QZ_GEN.push({ topic: 'log', make: function () {
    const bank = [
      { p: 'sunny(mon).\nsunny(tue).\nsunny(wed).\nwarm(mon).\nwarm(wed).\nglorious(D) :- sunny(D), warm(D).', qs: ['glorious(D)', 'glorious(tue)', 'warm(W)'] },
      { p: 'even(0).\neven(N) :- N > 1, N1 is N-2, even(N1).', qs: ['even(4)', 'even(3)', 'even(6)'] },
      { p: 'app([],L,L).\napp([X|L],Y,[X|Z]) :- app(L,Y,Z).', qs: ['app([1],[2,3],U)', 'app([1,2],X,[1])'] },
      { p: 'mem(X,[X|_]).\nmem(X,[_|T]) :- mem(X,T).', qs: ['mem(2,[1,2,3])', 'mem(9,[1,2,3])', 'mem(X,[7,8])'] }
    ];
    const b = qzPick(bank), q = qzPick(b.qs);
    const prog = prParseProgram(b.p), goals = prParseGoals(q);
    const qvars = []; goals.forEach(g => prVarsOf(g.atom, qvars));
    prCounter = 0;
    const ctx = { steps: 0, maxSteps: 20000, maxDepth: 40, maxSolutions: 1, maxTrace: 0, trace: [], solutions: [], errors: [],
      onSolution: function (s) {
        const bs = qvars.map(v => v + ' = ' + plShow(prApply({ k: 'V', n: v }, s), 0));
        const txt = bs.length ? bs.join(', ') : 'true';
        if (!this.solutions.includes(txt)) this.solutions.push(txt);
      } };
    try { prSolve(goals, prog, {}, 0, ctx); } catch (e) { }
    const ans = ctx.solutions.length ? ctx.solutions[0] : 'false';
    return {
      topic: 'Prolog (W9–10)',
      prompt: `What is Prolog's <strong>first</strong> answer to this query?<pre>${esc(b.p)}\n\n?- ${esc(q)}.</pre>`,
      placeholder: 'X = ...   or   true   or   false',
      answer: ans,
      check: function (inp) {
        const t = qzNorm(inp);
        if (ans === 'false') return { ok: ['false', 'no', 'fails', 'failure'].includes(t) };
        if (ans === 'true') return { ok: ['true', 'yes', 'succeeds'].includes(t) };
        return { ok: t === qzNorm(ans) || t === qzNorm(ans.split('=')[1]) };
      },
      explain: `Clauses are tried <strong>top to bottom</strong> and the left-most literal is selected, so the first answer is <code>${esc(ans)}</code>. Build the tree in the <em>SLD-tree builder</em>.`
    };
  }});
  /* --- clause classification --- */
  QZ_GEN.push({ topic: 'log', make: function () {
    const opts = [
      { e: 'p(g(Y), a)', k: 'fact' },
      { e: '~p(X, a) \\/ ~q(Y)', k: 'goal' },
      { e: 'q(f(Y,a)) \\/ ~q(X) \\/ ~p(Y, g(a))', k: 'rule' },
      { e: '~q(f(a, g(Y)))', k: 'goal' },
      { e: 'q(a) \\/ p(b, g(X))', k: 'not a Horn clause' },
      { e: 'p(a, b)', k: 'fact' },
      { e: 'p(X,a) \\/ ~q(X)', k: 'rule' }
    ];
    const o = qzPick(opts);
    return {
      topic: 'Horn clauses (W9)',
      prompt: `Is this a fact, a rule, a goal — or not a Horn clause at all?<pre>${esc(o.e.replace(/\\\//g, ' ∨ ').replace(/~/g, '¬'))}</pre>`,
      kind: 'choice',
      choices: ['fact', 'rule', 'goal', 'not a Horn clause'],
      answer: o.k,
      check: function (inp) { return { ok: qzNorm(inp) === qzNorm(o.k) }; },
      explain: `A <strong>fact</strong> has one positive literal and no negatives; a <strong>rule</strong> has one positive and some negatives; a <strong>goal</strong> has only negatives; <strong>two or more positive literals</strong> is not a Horn clause.`
    };
  }});
  /* --- SIMP big-step / abstract machine --- */
  QZ_GEN.push({ topic: 'imp', make: function () {
    const a = qzInt(1, 9), b = qzInt(1, 9), c = qzInt(1, 5);
    const shape = qzPick(['seq', 'if', 'while']);
    let prog, mem, ask;
    if (shape === 'seq') { prog = `x := ${a}; y := !x * ${b}; z := !y - ${c}`; mem = 'x = 0, y = 0, z = 0'; ask = 'z'; }
    else if (shape === 'if') { prog = `if ${a} > ${b} then m := ${a} else m := ${b}`; mem = 'm = 0'; ask = 'm'; }
    else { prog = `s := 0; while !n > 0 do (s := !s + !n; n := !n - 1)`; mem = `n = ${c}`; ask = 's'; }
    let cfg = { c: [smParse(prog)], r: [], m: smParseMem(mem) }, g = 0;
    while (g++ < 4000) { const nx = smStepCfg(cfg); if (nx === null || nx.stuck) break; cfg = { c: nx.c, r: nx.r, m: nx.m }; if (!cfg.c.length) break; }
    const val = cfg.m[ask];
    return {
      topic: 'SIMP semantics (W3–4)',
      prompt: `Run this SIMP program in the given store. What is the final value of <code>${ask}</code>?<pre>${esc(prog)}\n\ninitial store: {${esc(mem.replace(/=/g, ' ↦ '))}}</pre>`,
      placeholder: 'a number',
      answer: String(val),
      check: function (inp) { return { ok: parseInt(inp, 10) === val }; },
      explain: `The final store is <code>{${Object.keys(cfg.m).sort().map(k => k + ' ↦ ' + cfg.m[k]).join(', ')}}</code>, so <code>${ask} = ${val}</code>. Trace it in the <em>SIMP machine</em> or the <em>big-step prover</em>.`
    };
  }});
  /* --- evaluation strategies --- */
  QZ_GEN.push({ topic: 'fun', make: function () {
    const defs = 'square x = x * x\nfortytwo x = 42\ninfinity = infinity + 1';
    const n = qzInt(1, 5), m = qzInt(1, 5);
    const which = qzPick(['sharing', 'inf', 'inf2']);
    if (which === 'inf' || which === 'inf2') {
      const expr = 'fortytwo infinity';
      const strat = which === 'inf' ? 'cbv' : 'cbn';
      const r = fpReduce(expr, defs, strat, 60);
      const ok = r.done && r.nf;
      return {
        topic: 'Evaluation strategies (W6)',
        prompt: `With the definitions<pre>${esc(defs)}</pre>does <code>${esc(expr)}</code> reach a value under <strong>${strat === 'cbv' ? 'call-by-value' : 'call-by-name'}</strong>?`,
        kind: 'choice', choices: ['yes', 'no'],
        answer: ok ? 'yes' : 'no',
        check: function (inp) { return { ok: qzNorm(inp) === (ok ? 'yes' : 'no') }; },
        explain: `<strong>Call-by-name always finds the value if there is one</strong>; call-by-value must evaluate the argument first, and <code>infinity</code> has no value — so CBV diverges here while CBN returns 42.`
      };
    }
    const expr = `square (${n} + ${m})`;
    const rc = fpReduce(expr, defs, 'cbn', 60), rl = fpReduce(expr, defs, 'lazy', 60);
    return {
      topic: 'Evaluation strategies (W6)',
      prompt: `With <code>square x = x * x</code>, how many reduction steps does <strong>call-by-name</strong> take to evaluate <code>${esc(expr)}</code>?`,
      placeholder: 'a number',
      answer: String(rc.steps),
      check: function (inp) { return { ok: parseInt(inp, 10) === rc.steps }; },
      explain: `Call-by-name takes <strong>${rc.steps}</strong> steps because it substitutes <code>${n} + ${m}</code> unevaluated into <em>both</em> occurrences of x and reduces it twice. Lazy evaluation (call-by-name + <em>sharing</em>) takes ${rl.steps}. Check it in the <em>strategy explorer</em>.`
    };
  }});
  /* --- SFUN typing --- */
  QZ_GEN.push({ topic: 'fun', make: function () {
    const terms = ['max(3, square(2))', 'if x <= 0 then 1 else x * fact(x - 1)', '1 + True',
      'if x > 0 then 1 else True', 'x > 0', '~(x > 0)', 'square(2) + x', 'fact(x) > 2'];
    const t = qzPick(terms);
    const G = tyParseGamma('x : int');
    const E = tyParseEps('max : (int,int)->int, square : (int)->int, fact : (int)->int');
    let ans;
    try { ans = tyCheck(sfParseTerm(sfLex(t), 0).e, G, E).ty; } catch (e) { ans = 'untypeable'; }
    return {
      topic: 'SFUN typing (W8)',
      prompt: `With Γ(x) = int and ε(max) = (int,int)→int, ε(square) = ε(fact) = (int)→int, what is the type of<pre>${esc(t)}</pre>`,
      kind: 'choice', choices: ['int', 'bool', 'untypeable'],
      answer: ans,
      check: function (inp) { return { ok: qzNorm(inp) === qzNorm(ans) }; },
      explain: ans === 'untypeable'
        ? `<strong>Untypeable</strong> — no typing rule applies (both operands of an arithmetic operator must be int, and both branches of an <code>if</code> must share one type τ).`
        : `Γ ⊢<sub>ε</sub> <code>${esc(t)}</code> : <strong>${ans}</strong>. Build the derivation in the <em>typing tool</em>.`
    };
  }});
  /* --- pattern matching / lists --- */
  QZ_GEN.push({ topic: 'fun', make: function () {
    const defs = "size [] = 0\nsize (x : xs) = 1 + size xs\nadd Zero x = x\nadd (Succ x) y = Succ (add x y)\nheight (Leaf a) = 1\nheight (Branch l r) = 1 + max (height l) (height r)\nmax x y = if x > y then x else y";
    const exprs = ['size [1, 2, 3, 4]', 'size []', 'add (Succ (Succ Zero)) Zero',
      'height (Branch (Leaf 1) (Branch (Leaf 2) (Leaf 3)))', 'height (Leaf 7)', 'size [9, 9]'];
    const e = qzPick(exprs);
    const D = pmParseDefs(defs);
    let cur = pmParseExpr(pmLex(e), 0).e, g = 0;
    while (g++ < 200) { const r = pmStep(cur, D); if (!r) break; cur = r.e; }
    const ans = pmShow(cur, 0);
    return {
      topic: 'Lists &amp; data types (W8)',
      prompt: `Reduce to normal form:<pre>${esc(defs)}\n\n${esc(e)}</pre>`,
      placeholder: 'the value',
      answer: ans,
      check: function (inp) { return { ok: qzNorm(inp) === qzNorm(ans) }; },
      explain: `The normal form is <code>${esc(ans)}</code>. Equations are tried <strong>in the order written</strong>, and a constructor pattern forces its argument. Step through it in the <em>pattern-matching evaluator</em>.`
    };
  }});
  /* --- ambiguity / parse trees --- */
  QZ_GEN.push({ topic: 'imp', make: function () {
    const a = qzInt(1, 9), b = qzInt(1, 9), c = qzInt(1, 9);
    const op = qzPick(['-', '-', '*']);
    const expr = `${a} ${op} ${b} ${op} ${c}`;
    const toks = ptTokenize(expr);
    const L = ptEval(ptBuild(toks, 'left')), R = ptEval(ptBuild(toks, 'right'));
    const askLeft = Math.random() < 0.5;
    return {
      topic: 'Ambiguity (W1)',
      prompt: `Under the ambiguous grammar <code>Exp ::= Num | Exp Op Exp</code>, the string <code>${esc(expr)}</code> has two parse trees. What value does the <strong>${askLeft ? 'left' : 'right'}-associative</strong> reading give?`,
      placeholder: 'a number',
      answer: String(askLeft ? L : R),
      check: function (inp) { return { ok: parseInt(inp, 10) === (askLeft ? L : R) }; },
      explain: `Left-associative <code>(${a} ${op} ${b}) ${op} ${c}</code> gives <strong>${L}</strong>; right-associative <code>${a} ${op} (${b} ${op} ${c})</code> gives <strong>${R}</strong>.${L === R ? ' Here they coincide — but the two parse trees are still distinct, and that is what ambiguity means.' : ''}`
    };
  }});
  /* --- concept MCQs --- */
  const QZ_CONCEPT = [
    ['Which of these is specific to <em>logic</em> programming rather than shared with functional programming?', ['The same program can be used in many different ways', 'A declarative style of programming', 'Precise and simple semantics', 'Knowledge-based programming'], 0, 'The other three are shared with functional languages; only the last point in the advantages list is specific to logic programming.'],
    ['In SIMP, what does <code>!l</code> denote?', ['The value stored in l (the r-value)', 'The address of l (the l-value)', 'Negation of l', 'A pointer to l'], 0, 'A bare <code>l</code> is the address — that is why assignment is <code>l := E</code> — and <code>!l</code> is its contents.'],
    ['Which is true of call-by-value?', ['More efficient in general, but may fail to find a value', 'Always finds the value if one exists', 'It is what Haskell uses', 'It is call-by-name plus sharing'], 0, 'Call-by-<em>name</em> always finds the value; lazy evaluation = call-by-name + sharing, and that is what Haskell uses.'],
    ['What is the disadvantage of the abstract machine for SIMP?', ['Not very intuitive — many transitions only do phrase analysis', 'It cannot express while loops', 'It is non-deterministic', 'It requires a type system'], 0, 'Only a few transitions really compute; most are decomposition. The structural approach (Plotkin) was developed to fix this.'],
    ['A grammar is ambiguous when…', ['some string has more than one distinct parse tree', 'it contains recursive rules', 'it has more than one non-terminal', 'it cannot be parsed left-to-right'], 0, 'Recursion is fine; two <em>distinct parse trees</em> for one string is the definition.'],
    ['Under dynamic scoping, the reference to x in P2 depends on…', ['the calling sequence of subprograms', 'the nesting of the program text', 'the declaration order', 'the type of x'], 0, 'That is why static type-checking becomes impossible: the type of a reference depends on run-time control flow.'],
    ['In big-step semantics, a divergent program…', ['has no derivation at all', 'derives to a special value ⊥', 'has an infinite derivation tree', 'is a type error'], 0, 'Big-step relates a configuration only to a <em>terminal</em> one, so divergence and stuckness are both simply absent from the relation.'],
    ['What does the SIMP while rule <code>⟨while·c, True·B·C·r, m⟩ → ⟨C·(while B do C)·c, r, m⟩</code> do?', ['Pushes the body and then rebuilds the whole loop behind it', 'Evaluates the test again immediately', 'Discards the loop', 'Copies the memory'], 0, 'That rebuilding is what makes the loop repeat; it is why while-decomp had to save B and C on the results stack.'],
    ['Which is <em>not</em> a valid term, given f binary and g unary?', ['g(f)', 'g(X)', 'f(X, g(a))', 'f(f(X,a), Y)'], 0, '<code>f</code> is a binary function supplied without its two arguments, so it is not itself a well-formed term.'],
    ['Negation as failure means…', ['failure to prove A is taken as proof of ¬A', 'A is proved false by resolution', '¬A may appear in the head of a clause', 'the program contains negative facts'], 0, 'It is negation relative to what the program says — the closed-world assumption. Negative heads remain impossible.'],
    ['Why must Prolog rename clause variables apart?', ['Otherwise unification can fail the occur-check', 'To make the program shorter', 'Because variables are existentially quantified', 'To speed up backtracking'], 0, 'The <code>myappend</code> example: <code>{[X|Y] = Y, …}</code> fails rule (6) unless the clause is renamed.'],
    ['Prolog\'s implementation of SLD-resolution is incomplete because…', ['it searches the SLD-tree depth-first', 'SLD-resolution is itself incomplete', 'it selects the left-most literal', 'it uses the occur-check'], 0, 'SLD-resolution <em>is</em> complete; depth-first search can get stuck in an infinite branch and never reach a solution further right.'],
    ['In the type <code>Int -&gt; Int -&gt; Int</code>, the arrow associates…', ['to the right, so it is Int → (Int → Int)', 'to the left, so it is (Int → Int) → Int', 'it is ambiguous', 'to neither — it needs brackets'], 0, 'Right-associative types plus left-associative application is what makes currying work.'],
    ['<code>square square 3</code> is untypeable because…', ['the constraint Int = (Int → Int) cannot be solved', 'square is not defined', 'it needs three arguments', 'application associates to the right'], 0, 'Application associates <em>left</em>, so it reads <code>(square square) 3</code> and the first square is handed a function.'],
    ['A post-test loop differs from a pre-test loop in that…', ['it always executes its body at least once', 'it cannot terminate', 'the condition is evaluated twice', 'it needs a counter'], 0, 'That single fact answers most exam questions comparing <code>while</code> with <code>do</code>.'],
    ['In the mgu definition, σ is most general when…', ['every other unifier is an instance of σ', 'σ has the smallest domain', 'σ maps variables to constants', 'σ is unique'], 0, 'Committing variables to constants early destroys generality and blocks later resolutions.'],
    ['Structural induction over a data type has…', ['one case per constructor', 'one case per function', 'two cases always', 'as many cases as there are values'], 0, 'The <code>data</code> declaration hands you the induction principle: base cases for leaves, a step per recursive constructor.'],
    ['What does the "D" in SLD-resolution stand for?', ['Definite — all program clauses are definite clauses', 'Depth-first', 'Deterministic', 'Declarative'], 0, 'S = selective, L = linear, D = definite. Depth-first is Prolog\'s <em>search</em>, not part of SLD.'],
    ['Overloading (ad-hoc polymorphism) is…', ['several functions with different types sharing one name', 'one function usable at many types', 'a function with a type variable', 'a function defined by pattern matching'], 0, 'The second describes parametric polymorphism. Haskell handles overloading with type classes: <code>Num a ⇒ a → a → a</code>.'],
    ['A typeable SFUN program…', ['may still fail to terminate', 'always terminates', 'has no free variables', 'must be first-order'], 0, '<code>infinity = infinity + 1</code> is perfectly well-typed and has no value — types rule out <code>1 + True</code>, not divergence.']
  ];
  QZ_GEN.push({ topic: 'concept', make: function () {
    const q = qzPick(QZ_CONCEPT);
    const idx = q[1].map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const choices = idx.map(i => q[1][i]);
    const answer = q[1][q[2]];
    return {
      topic: 'Concept recall',
      prompt: q[0],
      kind: 'choice', choices: choices, answer: answer,
      check: function (inp) { return { ok: inp === answer }; },
      explain: q[3]
    };
  }});
  /* ---------- quiz driver ---------- */
  let qzCur = null, qzScore = { right: 0, total: 0 }, qzAnswered = false, qzPicked = null;
  function qzNext() {
    const topic = document.getElementById('qz-topic').value;
    const pool = QZ_GEN.filter(g => topic === 'all' ? true : g.topic === topic);
    if (!pool.length) { document.getElementById('qz-output').innerHTML = '<div class="tool-error">No questions for that topic.</div>'; return; }
    let tries = 0;
    while (tries++ < 12) {
      try { qzCur = qzPick(pool).make(); break; } catch (e) { qzCur = null; }
    }
    if (!qzCur) { document.getElementById('qz-output').innerHTML = '<div class="tool-error">Could not generate a question — try again.</div>'; return; }
    qzAnswered = false; qzPicked = null;
    qzRender();
  }
  function qzChoose(i) {
    if (qzAnswered || !qzCur) return;
    qzPicked = qzCur.choices[i];
    qzSubmit(qzPicked);
  }
  function qzSubmitText() {
    if (!qzCur || qzAnswered) return;
    qzSubmit(document.getElementById('qz-answer').value);
  }
  function qzSubmit(val) {
    if (!qzCur || qzAnswered) return;
    if (!String(val).trim()) return;
    let res;
    try { res = qzCur.check(val); } catch (e) { res = { ok: false, msg: 'Could not read that answer.' }; }
    qzAnswered = true; qzCur.given = val; qzCur.result = res;
    qzScore.total++; if (res.ok) qzScore.right++;
    qzRender();
  }
  function qzReveal() {
    if (!qzCur) { qzNext(); return; }
    if (!qzAnswered) { qzAnswered = true; qzScore.total++; qzCur.result = { ok: false, revealed: true }; }
    qzRender();
  }
  function qzResetScore() { qzScore = { right: 0, total: 0 }; qzRender(); }
  function qzRender() {
    const out = document.getElementById('qz-output');
    let html = '';
    const pct = qzScore.total ? Math.round(100 * qzScore.right / qzScore.total) : 0;
    html += `<div class="quiz-score" style="margin-bottom:10px;"><span class="stat-pill dark">score ${qzScore.right} / ${qzScore.total}</span>`;
    if (qzScore.total) html += `<span class="stat-pill ${pct >= 70 ? 'b' : pct >= 40 ? 'a' : 'c'}">${pct}%</span>`;
    html += '</div>';
    if (!qzCur) { out.innerHTML = html + '<div class="quiz-prompt">Press <strong>New question</strong> to start.</div>'; return; }
    html += `<div class="quiz-prompt"><div class="qp-topic">${qzCur.topic}</div>${qzCur.prompt}</div>`;
    if (qzCur.kind === 'choice') {
      html += '<div class="quiz-choices">';
      qzCur.choices.forEach((c, i) => {
        let cls = 'quiz-choice';
        if (qzAnswered) {
          if (qzNorm(c) === qzNorm(qzCur.answer)) cls += ' right';
          else if (qzCur.given !== undefined && qzNorm(c) === qzNorm(qzCur.given)) cls += ' wrong';
        }
        html += `<button class="${cls}" onclick="qzChoose(${i})">${c}</button>`;
      });
      html += '</div>';
    } else {
      html += `<div class="tool-controls" style="margin:8px 0;">
        <div class="tool-field" style="flex:1; min-width:220px;">
          <label>your answer</label>
          <input type="text" id="qz-answer" placeholder="${esc(qzCur.placeholder || '')}" style="width:100%;"
                 onkeydown="if(event.key==='Enter'){qzSubmitText();}" ${qzAnswered ? 'disabled' : ''}
                 value="${qzAnswered && qzCur.given !== undefined ? esc(String(qzCur.given)) : ''}">
        </div>
        <button class="tool-btn" onclick="qzSubmitText()" ${qzAnswered ? 'disabled' : ''}>Check</button>
      </div>`;
    }
    if (qzAnswered) {
      const r = qzCur.result || {};
      if (r.ok) html += `<div class="verdict safe quiz-fb">✓ <strong>Correct.</strong> ${qzCur.explain}</div>`;
      else if (r.revealed) html += `<div class="verdict warn quiz-fb"><strong>Answer:</strong> <code>${esc(String(qzCur.answer))}</code><br><br>${qzCur.explain}</div>`;
      else html += `<div class="verdict bad quiz-fb">✗ Not quite. ${r.msg ? r.msg + '<br><br>' : ''}<strong>The answer is</strong> <code>${esc(String(qzCur.answer))}</code>.<br><br>${qzCur.explain}</div>`;
      html += `<div class="tool-controls" style="margin-top:10px;"><button class="tool-btn green" onclick="qzNext()">Next question ▶</button></div>`;
    }
    out.innerHTML = html;
  }
