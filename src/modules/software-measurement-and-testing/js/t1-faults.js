  /* ============================================================
     SMT TOPIC 01 · faults, errors, failures

     The topic's worked example is a four-line program with one
     mistake in it, and that is enough to make the whole fault →
     error → failure chain runnable: the program is executed here,
     statement by statement, alongside the program that was meant.

     The part worth running is not the single failing test case the
     notes give. It is the question underneath it — which test cases
     would have *missed* this fault — and the answer is less obvious
     than it looks, because the program's integers are 32 bits wide
     and not the integers of arithmetic.

     Algorithms only — no DOM.
     ============================================================ */

  /* ---------------------------------------------------------------
     Two models of the same arithmetic.

     The specification is over the integers. The program is over
     `int`, which wraps at 32 bits. Most of the time that makes no
     difference; here it makes all the difference to which tests
     catch the bug, so both are offered and the page compares them.
     --------------------------------------------------------------- */

  function ftWrap32(x) {
    var v = BigInt(x) & 0xFFFFFFFFn;
    if (v >= 0x80000000n) v -= 0x100000000n;
    return v;
  }

  function ftApply(model, v) {
    return model === 'int32' ? ftWrap32(v) : BigInt(v);
  }

  /* ---------------------------------------------------------------
     The program that was meant, and the program that was written.

        spec:  output 2 · i³
        impl:  i = 2 * i;  i = pow(i, 3);     which is (2i)³ = 8i³

     The mistake is conceptual — the binding power of the operators —
     and it shows up as two statements in the wrong order.
     --------------------------------------------------------------- */

  /* Each program is written once, as the sequence of states it passes
     through. Everything else on this page — the final values, the three
     conditions, the sweeps — reads those states, so there is exactly one
     description of each program and no way for two copies to drift apart.
     (There were two copies, briefly, and a sabotage check found them by
     breaking one and watching the other carry on regardless.) */

  function ftStatesIntended(i, model) {
    var v = ftApply(model, i);
    var cube = ftApply(model, v * v * v);
    return [v, cube, ftApply(model, 2n * cube)];
  }

  function ftStatesActual(i, model) {
    var v = ftApply(model, i);
    var doubled = ftApply(model, 2n * v);
    return [v, doubled, ftApply(model, doubled * doubled * doubled)];
  }

  function ftSpec(i, model) { return ftStatesIntended(i, model)[2]; }
  function ftImpl(i, model) { return ftStatesActual(i, model)[2]; }

  /**
   * Both programs, statement by statement, with the state after each
   * line. This is where "error" lives: a state that is already wrong
   * before anything has been printed.
   */
  function ftTrace(i, model) {
    var want = ftStatesIntended(i, model);
    var have = ftStatesActual(i, model);

    var lines = [
      { line: 1, code: 'cin >> i;', at: 0 },
      { line: 2, code: 'i = 2 * i;', at: 1,
        note: 'written second in the specification, first in the code' },
      { line: 3, code: 'i = pow(i, 3);', at: 2 },
      { line: 4, code: 'cout << i;', at: 2 }
    ];

    var steps = lines.map(function (L) {
      return {
        line: L.line, code: L.code, note: L.note,
        intended: want[L.at].toString(),
        actual: have[L.at].toString(),
        differs: want[L.at] !== have[L.at]
      };
    });

    return {
      ok: true, input: String(i), model: model,
      steps: steps,
      expected: want[2].toString(), got: have[2].toString(),
      failed: want[2] !== have[2]
    };
  }

  /* ---------------------------------------------------------------
     Reachability, infection, propagation.

     A fault only becomes a failure if three things happen in order:
     the faulty code runs at all; running it makes the state wrong;
     and that wrongness reaches the output. Naming them separately is
     the point of the topic's three words, and here each one can be
     checked rather than asserted.
     --------------------------------------------------------------- */

  function ftRip(i, model) {
    var t = ftTrace(i, model);
    var afterTwo = t.steps[1];
    var afterThree = t.steps[2];
    return {
      ok: true,
      /* The statements are straight-line, so the fault is always executed. */
      reached: true,
      /* Did executing it actually make the state wrong? */
      infected: afterTwo.differs || afterThree.differs,
      /* Did the wrong state reach the output? */
      propagated: t.failed,
      expected: t.expected, got: t.got
    };
  }

  /* ---------------------------------------------------------------
     Which test cases would have caught it.

     Over the integers the two programs differ by 6i³, so they agree
     only at i = 0 — one unlucky test case. In 32-bit arithmetic
     6i³ ≡ 0 (mod 2³²) needs i³ ≡ 0 (mod 2³¹), so i must be divisible
     by 2^⌈31/3⌉ = 2048, and there are a great many more unlucky test
     cases than the notes' example suggests.
     --------------------------------------------------------------- */

  function ftReveals(i, model) { return ftSpec(i, model) !== ftImpl(i, model); }

  function ftSweep(from, to, model) {
    var hidden = [], total = 0;
    for (var i = from; i <= to; i++) {
      total++;
      if (!ftReveals(i, model)) hidden.push(i);
    }
    return {
      ok: true, from: from, to: to, model: model,
      total: total, hidden: hidden,
      revealed: total - hidden.length,
      rate: total ? (total - hidden.length) / total : 0
    };
  }

  /** The characterisation, checked against a sweep rather than asserted. */
  function ftHiddenRule(model, limit) {
    var n = limit || 300000;
    var step = model === 'int32' ? 2048 : 0;
    var bad = 0, checked = 0, hidden = 0;
    for (var i = -n; i <= n; i += 1) {
      var predicted = step ? (i % step === 0) : (i === 0);
      var actual = !ftReveals(i, model);
      checked++;
      if (actual) hidden++;
      if (predicted !== actual) bad++;
    }
    return {
      ok: true, model: model, checked: checked, hidden: hidden,
      rule: step ? 'the multiples of ' + step : 'only zero',
      mismatches: bad
    };
  }

  /* ---------------------------------------------------------------
     The vocabulary, as data so the page and the questions agree.
     --------------------------------------------------------------- */

  var FT_TERMS = {
    fault: {
      term: 'Fault',
      short: 'an incorrect implementation',
      detail: 'The mistake in the code itself. It is there whether or not anybody runs ' +
        'the program.',
      kinds: [
        { k: 'commission', d: 'something wrong was written' },
        { k: 'omission', d: 'something was never written at all — the harder kind to find, ' +
             'because there is no line to look at' }
      ],
      inExample: 'statements 2 and 3 are in the wrong order'
    },
    error: {
      term: 'Error',
      short: 'an incorrect system state',
      detail: 'What the fault does when it runs. The program is now in a state it should ' +
        'not be in, and nothing has been printed yet.',
      inExample: 'after line 3, i holds (2i)³ rather than 2i³'
    },
    failure: {
      term: 'Failure',
      short: 'a visible error in the behaviour',
      detail: 'The incorrect state reaching the outside world, where somebody can see it. ' +
        'Also called an anomaly or an incident.',
      inExample: 'input 1, expected output 2, actual output 8'
    }
  };

  var FT_LEVELS = [
    { level: 'Unit', scope: 'single units',
      tools: 'jUnit, QuickCheck, test-driven development',
      techniques: 'equivalence partitioning, decision tables, classification trees' },
    { level: 'Integration', scope: 'subsystems together',
      tools: 'jUnit, Mockito',
      techniques: 'dependency injection, mocking' },
    { level: 'System', scope: 'the whole thing, including acceptance and user testing',
      tools: 'Selenium',
      techniques: 'GUI model testing, automated GUI testing' }
  ];

  var FT_ALTERNATIVES = [
    { name: 'Model checking',
      what: 'check the state space — every execution — against formally specified properties',
      pro: ['rigorous analysis', 'push-button technology once the model exists'],
      con: ['not yet scalable to very large systems, because of state-space explosion'] },
    { name: 'Static analysis',
      what: 'check abstract properties without running the program at all, such as division ' +
            'by zero or unhandled cases',
      pro: ['automatic and scalable for generic properties', 'powerful tools already exist'],
      con: ['involves approximation, so false positives and true negatives',
            'gets complicated for concrete, specific properties — it may need theorem proving ' +
            'to show the abstraction itself is correct'] }
  ];

  window.FT_TERMS = FT_TERMS;
  window.FT_LEVELS = FT_LEVELS;
  window.FT_ALTERNATIVES = FT_ALTERNATIVES;
  window.ftWrap32 = ftWrap32;
  window.ftStatesIntended = ftStatesIntended;
  window.ftStatesActual = ftStatesActual;
  window.ftSpec = ftSpec;
  window.ftImpl = ftImpl;
  window.ftTrace = ftTrace;
  window.ftRip = ftRip;
  window.ftReveals = ftReveals;
  window.ftSweep = ftSweep;
  window.ftHiddenRule = ftHiddenRule;
