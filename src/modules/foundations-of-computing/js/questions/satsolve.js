  /* ---------- Topic 05 · SAT solving ----------

     Marked by running the solvers, and cross-checked against
     exhaustive search where an answer is claimed.
     ------------------------------------------------------------ */

  function ssNum(target) {
    return function (v) {
      var s = String(v).trim().replace(/,/g, '');
      if (!/^-?[0-9]+$/.test(s)) return { ok: false, msg: 'Give a whole number.' };
      return { ok: parseInt(s, 10) === target };
    };
  }

  /* ---- Score an assignment ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var p = stParse(ST_PRESETS.greedy);
    var asg = {};
    p.vars.forEach(function (v) { asg[v] = Math.random() < 0.5; });
    var score = stScore(p.clauses, asg);

    return {
      topic: 'satsolve · greedy',
      prompt: 'For the seven clauses <code>' + esc(stShow(p.clauses)) + '</code>, how many are ' +
        'satisfied by ' + stShowAsg(asg, p.vars) + '?',
      placeholder: 'a whole number',
      answer: String(score),
      check: ssNum(score),
      explain: 'Counting clause by clause gives ' + score + ' of ' + p.nC + '. This is the score ' +
        'GREEDY-SAT maximises — and the reason it can fail: two assignments here score 6 with no ' +
        'improving flip available, while the only satisfying one scores 7.',
    };
  } });

  /* ---- Is greedy's False trustworthy? ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var right = 'Nothing — it only means no single flip improved the score';
    var choices = [right,
      'That the formula is unsatisfiable',
      'That the formula has no satisfying assignment with that many true variables',
      'That DPLL would also return False'];
    return {
      topic: 'satsolve · greedy',
      kind: 'choice',
      prompt: 'GREEDY-SAT returns <strong>False</strong>. What does that tell you about the formula?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Greedy is <strong>sound but incomplete</strong>. True comes with an assignment you ' +
        'can check; False means only that it reached a local maximum. On the worked ' +
        'example it returns False from half of all starting assignments, and the formula is ' +
        'satisfiable. Polynomial time is worth nothing if the answer is wrong.',
    };
  } });

  /* ---- Unit or pure? ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var asUnit = Math.random() < 0.5;
    var right = asUnit ? 'Unit propagation' : 'Pure literal elimination';
    var prompt = asUnit
      ? 'Which DPLL rule assigns literals that <strong>must</strong> be assigned, and can therefore ' +
        'produce a conflict?'
      : 'Which DPLL rule assigns literals that <strong>should</strong> be assigned, and can never ' +
        'produce a conflict?';
    return {
      topic: 'satsolve · DPLL',
      kind: 'choice',
      prompt: prompt,
      choices: ['Unit propagation', 'Pure literal elimination', 'Branching', 'Clause splitting'],
      answer: right,
      check: textCheck(right),
      explain: '<strong>Unit propagation</strong> fires on a clause with one literal left: there is ' +
        'no choice, so the assignment is forced — and forced assignments can collide, which is how ' +
        'DPLL detects a dead branch. <strong>Pure literal elimination</strong> fires on a literal ' +
        'with only one sign in the whole formula: making it true satisfies every clause holding it ' +
        'and damages nothing, so it can never conflict.',
    };
  } });

  /* ---- Find the pure literals ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var src = qzPick([ST_PRESETS.pure, ST_PRESETS.horn, ST_PRESETS.twosat, ST_PRESETS.greedy]);
    var p = stParse(src);
    var pures = dpPure(p.clauses);
    if (!pures.length) throw new Error('retry');
    var want = pures.map(fmLitShow).join(', ');

    return {
      topic: 'satsolve · DPLL',
      prompt: 'Which literals are <strong>pure</strong> in <code>' + esc(stShow(p.clauses)) +
        '</code>? (comma separated, or <code>none</code>)',
      placeholder: 'e.g. P, ¬S',
      answer: want,
      check: function (v) {
        var norm = function (s) {
          return String(s).replace(/[¬!]/g, '~').replace(/\s/g, '').toUpperCase()
            .split(',').filter(function (x) { return x; }).sort().join(',');
        };
        return { ok: norm(v) === norm(want) };
      },
      explain: 'A literal is pure when it appears with only one sign anywhere in the formula. ' +
        'Here that is <strong>' + want + '</strong>. Setting ' +
        pures.map(function (l) { return l.v + ' := ' + (l.neg ? 'False' : 'True'); }).join(' and ') +
        ' satisfies every clause containing them, and cannot hurt, because their negations occur ' +
        'nowhere.',
    };
  } });

  /* ---- Count the unit clauses ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var src = qzPick([ST_PRESETS.unit, ST_PRESETS.horn, ST_PRESETS.greedy, ST_PRESETS.twosat]);
    var p = stParse(src);
    var units = dpUnits(p.clauses);

    return {
      topic: 'satsolve · DPLL',
      prompt: 'How many <strong>unit clauses</strong> does <code>' + esc(stShow(p.clauses)) +
        '</code> contain?',
      placeholder: 'a whole number',
      answer: String(units.length),
      check: ssNum(units.length),
      explain: units.length
        ? 'There ' + (units.length === 1 ? 'is one' : 'are ' + units.length) + ': ' +
          units.map(fmLitShow).join(', ') + '. A unit clause has exactly one literal left, so its ' +
          'value is forced — no branching required.'
        : 'None. Every clause has at least two literals, so nothing is forced and DPLL will have to ' +
          'branch (or find a pure literal first).',
    };
  } });

  /* ---- Is this formula satisfiable? Marked by DPLL and brute force ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var src = qzPick([ST_PRESETS.greedy, ST_PRESETS.unit, ST_PRESETS.twosat,
                      ST_PRESETS.twobad, ST_PRESETS.horn, ST_PRESETS.unsat]);
    var p = stParse(src);
    var truth = stBrute(p.clauses, p.vars);
    var solver = dpSolve(p.clauses, p.vars);
    if (!solver.ok || solver.sat !== truth.sat) throw new Error('retry');

    var yes = 'Satisfiable', no = 'Unsatisfiable';
    return {
      topic: 'satsolve · DPLL',
      kind: 'choice',
      prompt: 'Is <code>' + esc(stShow(p.clauses)) + '</code> satisfiable?',
      choices: [yes, no],
      answer: truth.sat ? yes : no,
      check: textCheck(truth.sat ? yes : no),
      explain: truth.sat
        ? 'Yes — ' + stShowAsg(truth.model, p.vars) + ' works, and ' + truth.count +
          ' assignment' + (truth.count === 1 ? '' : 's') + ' in total do' +
          (truth.count === 1 ? 'es' : '') + '. DPLL finds it in ' + solver.calls + ' calls.'
        : 'No — all ' + truth.searched + ' assignments fail. DPLL establishes this in ' +
          solver.calls + ' calls with ' + solver.conflicts + ' conflict' +
          (solver.conflicts === 1 ? '' : 's') + ', which is the difference between it and greedy: ' +
          'its False is a proof.',
    };
  } });

  /* ---- 2SAT: what makes it unsatisfiable? ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var right = 'Some component contains a literal and its own negation';
    var choices = [right,
      'Some component contains two different variables',
      'The implication graph has a cycle',
      'The implication graph is not connected'];
    return {
      topic: 'satsolve · 2SAT',
      kind: 'choice',
      prompt: 'After computing the strongly connected components of the implication graph, when is ' +
        'a 2SAT instance <strong>unsatisfiable</strong>?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'A path x ⇝ y means &ldquo;x forces y&rdquo;. If x and ¬x share a component then x ' +
        'forces ¬x <em>and</em> ¬x forces x, so neither value survives. Components containing ' +
        'several different variables are perfectly normal — the worked example has {P, Q, R} as one ' +
        'component and is satisfiable. Cycles are likewise normal: they are what components are.',
    };
  } });

  /* ---- 2SAT verdict, computed ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var vars = ['P', 'Q', 'R'], lines = [];
    var n = qzInt(3, 5);
    for (var i = 0; i < n; i++) {
      lines.push((Math.random() < 0.5 ? '~' : '') + qzPick(vars) + ' | ' +
                 (Math.random() < 0.5 ? '~' : '') + qzPick(vars));
    }
    var p = stParse(lines.join('\n'));
    if (!p.ok || p.nV < 2) throw new Error('retry');
    var r = tsSolve(p.clauses, p.vars);
    var truth = stBrute(p.clauses, p.vars);
    if (!r.ok || r.sat !== truth.sat) throw new Error('retry');

    var yes = 'Satisfiable', no = 'Unsatisfiable';
    return {
      topic: 'satsolve · 2SAT',
      kind: 'choice',
      prompt: 'Is this 2SAT instance satisfiable? <code>' + esc(stShow(p.clauses)) + '</code>',
      choices: [yes, no],
      answer: r.sat ? yes : no,
      check: textCheck(r.sat ? yes : no),
      explain: r.sat
        ? 'Yes — ' + stShowAsg(r.asg, p.vars) + '. No component of the implication graph holds a ' +
          'literal together with its negation, and the assignment is read off by taking, for each ' +
          'variable, whichever literal sits downstream.'
        : 'No. ' + esc(r.why) + ' Building the graph and finding its components is all polynomial, ' +
          'which is the whole proof that 2SAT is in P.',
    };
  } });

  /* ---- SAT to 3SAT arithmetic ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var k = qzInt(4, 8);
    var lits = [];
    for (var i = 1; i <= k; i++) lits.push('P' + i);
    var p = stParse(lits.join(' | '));
    var r = tsTo3(p.clauses, p.vars);
    var askVars = Math.random() < 0.5;

    return {
      topic: 'satsolve · SAT ≤ₚ 3SAT',
      prompt: 'A single clause has <strong>' + k + '</strong> literals. Splitting it into 3-literal ' +
        'clauses produces how many <strong>' + (askVars ? 'fresh variables' : 'clauses') + '</strong>?',
      placeholder: 'a whole number',
      answer: String(askVars ? r.added : r.clauses.length),
      check: ssNum(askVars ? r.added : r.clauses.length),
      explain: 'The first new clause takes two original literals plus a bridge; each middle one takes ' +
        'one original literal, spending a slot on ¬carry; the last takes two and needs no new bridge. ' +
        'So k literals give <strong>k−2 = ' + (k - 2) + ' clauses</strong> and <strong>k−3 = ' +
        (k - 3) + ' fresh variables</strong>. Here: ' + r.clauses.length + ' clauses, ' + r.added +
        ' fresh variables.',
    };
  } });

  /* ---- Why must the bridge variable be fresh? ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var right = 'It would impose a constraint the original formula never had';
    var choices = [right,
      'The clause would end up with four literals',
      'The reduction would no longer run in polynomial time',
      'The resulting formula would not be in CNF'];
    return {
      topic: 'satsolve · SAT ≤ₚ 3SAT',
      kind: 'choice',
      prompt: 'In SAT ≤<sub>p</sub> 3SAT, why must the bridging variable X be <strong>fresh</strong> ' +
        'rather than one already in the formula?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'X exists only to route the obligation between the two halves, so it must be free to ' +
        'take whichever value that requires. Reusing an existing variable ties its value to that ' +
        'routing, which can make a satisfiable formula come out unsatisfiable — breaking the ' +
        '&ldquo;if and only if&rdquo; the reduction has to preserve.',
    };
  } });

  /* ---- Horn or not ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var src = qzPick([ST_PRESETS.horn, ST_PRESETS.twosat, ST_PRESETS.unit, ST_PRESETS.greedy]);
    var p = stParse(src);
    var cls = hnClassify(p.clauses);
    var yes = 'Yes — every clause has at most one positive literal';
    var no = 'No — some clause has two or more positive literals';

    return {
      topic: 'satsolve · Horn clauses',
      kind: 'choice',
      prompt: 'Is <code>' + esc(stShow(p.clauses)) + '</code> a Horn formula?',
      choices: [yes, no],
      answer: cls.horn ? yes : no,
      check: textCheck(cls.horn ? yes : no),
      explain: cls.horn
        ? 'Yes. Every clause has at most one positive literal, so each reads as a rule with a single ' +
          'head — and forward chaining from the facts decides it in linear time.'
        : 'No. ' + esc(cls.why[0]) + ' Without a single head there is no rule to fire, and forward ' +
          'chaining has nothing to do.',
    };
  } });

  /* ---- Which fragments are in P ---- */
  QZ_GEN.push({ topic: 'satsolve', make: function () {
    var right = '2SAT and Horn are; 3SAT is not known to be';
    var choices = [right,
      'All three are in P',
      'Only 2SAT is in P',
      '2SAT and 3SAT are; Horn is not'];
    return {
      topic: 'satsolve · what is easy',
      kind: 'choice',
      prompt: 'Which of 2SAT, 3SAT and Horn satisfiability are known to be solvable in polynomial ' +
        'time?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: '2SAT is in P because it is secretly a graph problem; Horn is in P because it has a ' +
        'unique minimal model reachable by a fixed point. Two unrelated reasons, which is why the ' +
        'usual diagram draws them as overlapping circles rather than one inside the other. 3SAT is ' +
        'NP-complete — a polynomial algorithm for it would prove P = NP.',
    };
  } });
