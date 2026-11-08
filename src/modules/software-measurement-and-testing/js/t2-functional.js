  /* ============================================================
     SMT TOPIC 02 · functional testing

     The topic hangs on one worked example — a mortgage calculator
     with a specification, an implementation that does not match it,
     and eight ways of choosing test cases. All of that is runnable,
     so the question the notes ask with bar charts ("how many test
     cases, how many faults, how many test cases per fault?") is
     answered here with numbers instead.

     The specification and the implementation below are transcribed
     from the notes. The test suite checks them against every
     Pass/Fail entry the notes print, which is 22 of them.

     Algorithms only — no DOM.
     ============================================================ */

  /* ---------------------------------------------------------------
     The specification.

        full-time ∈ {true, false},  age ∈ [18,55],  salary ∈ [0,10000]
        mortgage = salary × factor

        full-time:  18–35 → 75    36–45 → 55    46–55 → 30
        part-time:  18–30 → 70    31–40 → 50    41–50 → 35

     Note the gap: a part-timer of 51 to 55 is inside the stated age
     range and outside every category. The notes treat that as an
     error — "too late" — and so does this.
     --------------------------------------------------------------- */

  function fnSpec(ft, age, sal) {
    if (!(age >= 18 && age <= 55) || !(sal >= 0 && sal <= 10000)) {
      return { error: true, category: 'out of range', factor: null, value: null };
    }
    if (ft) {
      if (age <= 35) return { error: false, category: 'full-time, young', factor: 75,
                              value: 75 * sal };
      if (age <= 45) return { error: false, category: 'full-time, middle', factor: 55,
                              value: 55 * sal };
      return { error: false, category: 'full-time, old', factor: 30, value: 30 * sal };
    }
    if (age <= 30) return { error: false, category: 'part-time, young', factor: 70,
                            value: 70 * sal };
    if (age <= 40) return { error: false, category: 'part-time, middle', factor: 50,
                            value: 50 * sal };
    if (age <= 50) return { error: false, category: 'part-time, old', factor: 35,
                            value: 35 * sal };
    return { error: true, category: 'part-time, too late', factor: null, value: null };
  }

  /* ---------------------------------------------------------------
     The implementation, exactly as the notes print it — including
     the absence of any range checking at all.

       if (full-time) return (18 ≤ age < 35) ? 75*salary
                           : (31 ≤ age < 40) ? 55*salary : 30*salary
       else           return (18 ≤ age < 30) ? 75*salary
                           : (31 ≤ age < 40) ? 50*salary : 35*salary
     --------------------------------------------------------------- */

  function fnImpl(ft, age, sal) {
    var factor;
    if (ft) factor = (age >= 18 && age < 35) ? 75 : ((age >= 31 && age < 40) ? 55 : 30);
    else    factor = (age >= 18 && age < 30) ? 75 : ((age >= 31 && age < 40) ? 50 : 35);
    return { factor: factor, value: factor * sal };
  }

  /**
   * One test case, run. A test fails when the implementation does not
   * agree with the specification — including when the specification
   * says the input should have been rejected and the code happily
   * returns a number.
   */
  function fnRun(ft, age, sal) {
    var s = fnSpec(ft, age, sal), i = fnImpl(ft, age, sal);
    var pass = s.error ? false : (s.value === i.value);
    return {
      ft: ft, age: age, sal: sal,
      expected: s.error ? s.category : String(s.value),
      expectedFactor: s.factor,
      got: String(i.value), gotFactor: i.factor,
      category: s.category,
      pass: pass,
      /* What kind of failure this is: which case was wanted, and which
         factor was applied instead. Two tests with the same signature
         have found the same fault. */
      signature: pass ? null : s.category + ' → ×' + i.factor
    };
  }

  /* ---------------------------------------------------------------
     Where the two disagree, as regions rather than as points.
     --------------------------------------------------------------- */

  function fnFaultMap(sal) {
    sal = sal === undefined ? 1000 : sal;
    var regions = [], run = null;
    [true, false].forEach(function (ft) {
      run = null;
      for (var age = 18; age <= 55; age++) {
        var bad = !fnRun(ft, age, sal).pass;
        if (bad && run === null) run = age;
        if (!bad && run !== null) { regions.push(mk(ft, run, age - 1)); run = null; }
      }
      if (run !== null) { regions.push(mk(ft, run, 55)); run = null; }
    });
    function mk(ft, a, b) {
      var r = fnRun(ft, a, sal);
      return { ft: ft, from: a, to: b, expected: r.expected, got: r.got,
               category: r.category, signature: r.signature };
    }
    return { ok: true, salary: sal, regions: regions };
  }

  /** Every distinct fault anywhere in the space, so suites can be scored. */
  function fnAllFaults() {
    var sigs = {};
    var sals = [-1, 0, 1, 500, 5000, 9999, 10000, 10001];
    for (var age = 10; age <= 65; age++) {
      for (var f = 0; f < 2; f++) {
        for (var s = 0; s < sals.length; s++) {
          var r = fnRun(f === 0, age, sals[s]);
          if (r.signature) sigs[r.signature] = true;
        }
      }
    }
    return Object.keys(sigs).sort();
  }

  /* ---------------------------------------------------------------
     The equivalence classes, and the values each technique draws on.
     --------------------------------------------------------------- */

  var FN_CLASSES = {
    ft:  { name: 'full-time', classes: [[1, 1], [0, 0]], boolean: true },
    age: { name: 'age',
           classes: [[18, 30], [31, 35], [36, 40], [41, 45], [46, 50], [51, 55]],
           below: 17, above: 56,
           bv: [18, 19, 36, 54, 55] },
    sal: { name: 'salary', classes: [[0, 10000]],
           below: -1, above: 10001,
           bv: [0, 1, 5000, 9999, 10000] }
  };

  var FN_NOMINAL = { ft: true, age: 36, sal: 5000 };

  function fnMid(r) { return Math.floor((r[0] + r[1]) / 2); }

  /* ---------------------------------------------------------------
     The eight techniques.

     Each returns a list of test cases. The sizes are then compared
     against the formulas the notes give, which is where a wrinkle
     turns up — see fnFormulas below.
     --------------------------------------------------------------- */

  /**
   * How many test cases weak normal EC needs, for any set of class counts.
   *
   * Extracted so the rule itself can be tested rather than only its effect
   * on one example. It matters: with the mortgage's class counts of 2, 6
   * and 1, summing instead of taking the maximum produces three extra test
   * cases that are all duplicates of earlier ones — so the suite still
   * comes out at six and the mistake is invisible. With counts of 2, 3 and
   * 5 it is not.
   */
  function fnWeakCount(sizes) { return Math.max.apply(null, sizes); }

  function fnSuite(id, nominal) {
    var NOM = nominal || FN_NOMINAL;
    var A = FN_CLASSES.age, S = FN_CLASSES.sal;
    var ages = A.classes.map(fnMid), sals = S.classes.map(fnMid), fts = [true, false];
    var out = [], i, j, k;

    if (id === 'ec') {
      /* Weak normal: cover every class of every variable, as few tests as
         possible. The count is max|Sx| — which is the token puzzle. */
      var n = fnWeakCount([fts.length, ages.length, sals.length]);
      for (i = 0; i < n; i++) {
        out.push([fts[i % fts.length], ages[i % ages.length], sals[i % sals.length]]);
      }
    } else if (id === 'wkrobec') {
      out = fnSuite('ec', NOM).slice();
      /* One test either side of the range, per variable — where there is
         an either side. A boolean has none. */
      [A, S].forEach(function (V, vi) {
        [V.below, V.above].forEach(function (v) {
          out.push(vi === 0 ? [NOM.ft, v, NOM.sal] : [NOM.ft, NOM.age, v]);
        });
      });
    } else if (id === 'stnorec') {
      for (i = 0; i < fts.length; i++)
        for (j = 0; j < ages.length; j++)
          for (k = 0; k < sals.length; k++) out.push([fts[i], ages[j], sals[k]]);
    } else if (id === 'strobec') {
      var ages2 = ages.concat([A.below, A.above]);
      var sals2 = sals.concat([S.below, S.above]);
      for (i = 0; i < fts.length; i++)
        for (j = 0; j < ages2.length; j++)
          for (k = 0; k < sals2.length; k++) out.push([fts[i], ages2[j], sals2[k]]);
    } else if (id === 'bv' || id === 'robv') {
      var ab = id === 'robv' ? [A.below].concat(A.bv, [A.above]) : A.bv;
      var sb = id === 'robv' ? [S.below].concat(S.bv, [S.above]) : S.bv;
      out.push([NOM.ft, NOM.age, NOM.sal]);
      fts.forEach(function (v) { out.push([v, NOM.age, NOM.sal]); });
      ab.forEach(function (v) { out.push([NOM.ft, v, NOM.sal]); });
      sb.forEach(function (v) { out.push([NOM.ft, NOM.age, v]); });
    } else if (id === 'wc' || id === 'robwc') {
      var aw = id === 'robwc' ? [A.below].concat(A.bv, [A.above]) : A.bv;
      var sw = id === 'robwc' ? [S.below].concat(S.bv, [S.above]) : S.bv;
      for (i = 0; i < fts.length; i++)
        for (j = 0; j < aw.length; j++)
          for (k = 0; k < sw.length; k++) out.push([fts[i], aw[j], sw[k]]);
    } else {
      return [];
    }

    /* A technique does not gain anything by running the same case twice. */
    var seen = {}, uniq = [];
    out.forEach(function (t) {
      var key = t.join('|');
      if (!seen[key]) { seen[key] = true; uniq.push(t); }
    });
    return uniq;
  }

  var FN_TECHNIQUES = [
    { id: 'ec', label: 'EC (weak normal)',
      formula: 'max |Sₓ|',
      idea: 'cover every class of every variable; single fault assumption' },
    { id: 'wkrobec', label: 'weak robust EC',
      formula: 'max |Sₓ| + 2n',
      idea: 'weak normal, plus one test either side of each range' },
    { id: 'stnorec', label: 'strong normal EC',
      formula: '∏ |Sₓ|',
      idea: 'every combination of classes; multiple fault assumption' },
    { id: 'strobec', label: 'strong robust EC',
      formula: '∏ (|Sₓ| + 2)',
      idea: 'every combination, including out of range' },
    { id: 'bv', label: 'BV',
      formula: '4n + 1',
      idea: 'extreme values, one variable at a time, others nominal' },
    { id: 'robv', label: 'robust BV',
      formula: '6n + 1',
      idea: 'boundary values plus just outside the range' },
    { id: 'wc', label: 'WC (worst case)',
      formula: '5ⁿ',
      idea: 'every combination of boundary values' },
    { id: 'robwc', label: 'robust WC',
      formula: '7ⁿ',
      idea: 'every combination, including just outside' }
  ];

  /** Run a suite and score it. */
  function fnEvaluate(suite) {
    var rows = suite.map(function (t) { return fnRun(t[0], t[1], t[2]); });
    var sigs = {};
    rows.forEach(function (r) { if (r.signature) sigs[r.signature] = true; });
    var faults = Object.keys(sigs);
    return {
      ok: true, rows: rows, tests: rows.length,
      failures: rows.filter(function (r) { return !r.pass; }).length,
      faults: faults.length, signatures: faults.sort(),
      perFault: faults.length ? rows.length / faults.length : null
    };
  }

  /** Every technique, scored — the three charts the notes draw. */
  function fnCompare(nominal) {
    return FN_TECHNIQUES.map(function (T) {
      var suite = fnSuite(T.id, nominal);
      var e = fnEvaluate(suite);
      return { id: T.id, label: T.label, formula: T.formula, idea: T.idea,
               tests: e.tests, faults: e.faults, failures: e.failures,
               perFault: e.perFault };
    });
  }

  /**
   * The formulas the notes give, against the suites that can actually be
   * built.
   *
   * They agree for the two normal techniques and disagree for the two
   * robust ones, and the reason is in the notes already: full-time is a
   * boolean, and a boolean has no value just outside its range. The
   * formulas assume every variable has two out-of-range neighbours;
   * this one has none, so the robust counts come out lower.
   */
  function fnFormulas() {
    var sizes = {
      ft: FN_CLASSES.ft.classes.length,
      age: FN_CLASSES.age.classes.length,
      sal: FN_CLASSES.sal.classes.length
    };
    var n = 3;
    var maxS = Math.max(sizes.ft, sizes.age, sizes.sal);
    var prodS = sizes.ft * sizes.age * sizes.sal;
    var prodPlus = (sizes.ft + 2) * (sizes.age + 2) * (sizes.sal + 2);
    var rows = [
      { id: 'ec', formula: 'max |Sₓ|', says: maxS },
      { id: 'wkrobec', formula: 'max |Sₓ| + 2n', says: maxS + 2 * n },
      { id: 'stnorec', formula: '∏ |Sₓ|', says: prodS },
      { id: 'strobec', formula: '∏ (|Sₓ| + 2)', says: prodPlus }
    ];
    return rows.map(function (r) {
      var built = fnSuite(r.id).length;
      return { id: r.id, formula: r.formula, says: r.says, built: built,
               agrees: r.says === built };
    });
  }

  /** How much the boundary-value result depends on the nominal values chosen. */
  function fnNominalSweep() {
    var out = [];
    [true, false].forEach(function (ft) {
      [20, 36, 42, 50].forEach(function (age) {
        var e = fnEvaluate(fnSuite('bv', { ft: ft, age: age, sal: 5000 }));
        out.push({ ft: ft, age: age, tests: e.tests, faults: e.faults });
      });
    });
    return out;
  }

  /* ---------------------------------------------------------------
     The little puzzle, which is why weak normal EC costs max |Sx|.

     The minimum number of tokens on an m × n grid so that every row
     and every column holds one is max(m, n): put token i at
     (min(i, m), min(i, n)). Each variable's classes are the rows of
     one dimension, so covering them all costs the largest of them.
     --------------------------------------------------------------- */

  function fnPuzzle(m, n) {
    if (m < 1 || n < 1 || m > 12 || n > 12) {
      return { ok: false, error: 'Use grids between 1 and 12 a side.' };
    }
    var k = Math.max(m, n), cells = [];
    for (var i = 1; i <= k; i++) cells.push([Math.min(i, m), Math.min(i, n)]);
    var rows = {}, cols = {};
    cells.forEach(function (c) { rows[c[0]] = true; cols[c[1]] = true; });
    return {
      ok: true, m: m, n: n, tokens: k, cells: cells,
      rowsCovered: Object.keys(rows).length,
      colsCovered: Object.keys(cols).length,
      valid: Object.keys(rows).length === m && Object.keys(cols).length === n
    };
  }

  /** No arrangement of fewer than max(m,n) tokens can work — checked. */
  function fnPuzzleMinimal(m, n) {
    var k = Math.max(m, n);
    /* With fewer than m tokens some row is empty, and likewise for columns,
       so k − 1 is impossible. Verified by exhaustion on small grids. */
    if (m > 6 || n > 6) return { ok: false, error: 'Exhausted up to 6 a side.' };
    var cellsTotal = m * n, best = null;
    for (var size = 1; size <= k && best === null; size++) {
      if (chooseWorks(size)) best = size;
    }
    function chooseWorks(size) {
      var idx = [], found = false;
      (function rec(start, picked) {
        if (found) return;
        if (picked.length === size) {
          var r = {}, c = {};
          picked.forEach(function (p) { r[Math.floor(p / n)] = 1; c[p % n] = 1; });
          if (Object.keys(r).length === m && Object.keys(c).length === n) found = true;
          return;
        }
        for (var p = start; p < cellsTotal; p++) rec(p + 1, picked.concat([p]));
      })(0, []);
      return found;
    }
    return { ok: true, m: m, n: n, smallest: best, formula: k, agrees: best === k };
  }

  /* ---------------------------------------------------------------
     Decision tables.
     --------------------------------------------------------------- */

  /**
   * Completeness: for independent binary conditions there must be
   * 2^|conditions| rules, and a don't-care entry counts as two. For
   * n-valued conditions it is the product of the arities.
   */
  function dtCount(rules, arities) {
    var required = arities.reduce(function (a, b) { return a * b; }, 1);
    var covered = 0;
    rules.forEach(function (rule) {
      var k = 1;
      rule.forEach(function (entry, i) { if (entry === '-') k *= arities[i]; });
      covered += k;
    });
    return {
      ok: true, rules: rules.length, required: required, covered: covered,
      complete: covered === required,
      missing: required - covered
    };
  }

  /* The table from the notes: three conditions, with don't-cares. */
  var DT_EXAMPLE = {
    conditions: ['c1', 'c2', 'c3'],
    rules: [['F', '-', '-'], ['T', 'F', '-'], ['T', 'T', 'F'], ['T', 'T', 'T']],
    actions: ['a1', 'a2', 'a1;a2', 'error']
  };

  /* The notes' own decision table about choosing a technique. */
  var DT_CHOICE = [
    { physical: true,  independent: true,  single: true,  exceptions: true,  pick: 'Robust' },
    { physical: true,  independent: true,  single: true,  exceptions: false, pick: 'BV' },
    { physical: true,  independent: true,  single: false, exceptions: true,  pick: 'Robust WC' },
    { physical: true,  independent: true,  single: false, exceptions: false, pick: 'WC' },
    { physical: true,  independent: false, single: null,  exceptions: null,  pick: 'Decision Table' },
    { physical: false, independent: true,  single: true,  exceptions: true,  pick: '(Weak) Robust EC' },
    { physical: false, independent: true,  single: true,  exceptions: false, pick: 'EC' },
    { physical: false, independent: true,  single: false, exceptions: true,  pick: 'Strong Robust EC' },
    { physical: false, independent: true,  single: false, exceptions: false, pick: 'Strong (Normal) EC' },
    { physical: false, independent: false, single: null,  exceptions: null,  pick: 'Decision Table' }
  ];

  window.FN_CLASSES = FN_CLASSES;
  window.FN_NOMINAL = FN_NOMINAL;
  window.FN_TECHNIQUES = FN_TECHNIQUES;
  window.DT_EXAMPLE = DT_EXAMPLE;
  window.DT_CHOICE = DT_CHOICE;
  window.fnSpec = fnSpec;
  window.fnImpl = fnImpl;
  window.fnRun = fnRun;
  window.fnFaultMap = fnFaultMap;
  window.fnAllFaults = fnAllFaults;
  window.fnWeakCount = fnWeakCount;
  window.fnSuite = fnSuite;
  window.fnEvaluate = fnEvaluate;
  window.fnCompare = fnCompare;
  window.fnFormulas = fnFormulas;
  window.fnNominalSweep = fnNominalSweep;
  window.fnPuzzle = fnPuzzle;
  window.fnPuzzleMinimal = fnPuzzleMinimal;
  window.dtCount = dtCount;
