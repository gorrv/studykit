  /* ---------- Topic 03 · recurrences, induction, divide-and-conquer ----------

     As in Topic 02, every answer is computed rather than stored: the
     recurrence questions are marked by unfolding the recurrence, the
     Master Theorem questions by running the theorem, and the Hanoi
     questions by actually moving the discs.
     ------------------------------------------------------------------- */

  function rqNum(target) {
    return function (v) {
      var s = String(v).trim().replace(/,/g, '');
      if (!/^-?[0-9]+$/.test(s)) return { ok: false, msg: 'Give a whole number.' };
      return { ok: parseInt(s, 10) === target };
    };
  }

  var RQ_RECS = [
    { base: 'T(1) = 1', rec: '2T(n-1) + 1',  form: '2^n - 1',      say: 'Towers of Hanoi' },
    { base: 'T(1) = 1', rec: 'T(n-1) + n',   form: '(n^2 + n)/2',  say: 'the triangular numbers' },
    { base: 'T(1) = 1', rec: 'T(n-1) + 2',   form: '2n - 1',       say: 'a fixed cost per level' },
    { base: 'T(1) = 2', rec: '2T(n-1)',      form: '2^n',          say: 'pure doubling' },
    { base: 'T(1) = 1', rec: 'T(n-1) + 2n - 1', form: 'n^2',       say: 'the odd numbers summing to a square' },
  ];

  /* ---- Evaluate a recurrence ---- */
  QZ_GEN.push({ topic: 'recursion', make: function () {
    var r = qzPick(RQ_RECS);
    var n = qzInt(4, 8);
    var bp = rcParseBase(r.base);
    if (!bp.ok) throw new Error('retry');
    var rec = rcBuild(bp.base, r.rec);
    if (!rec.ok) throw new Error('retry');
    var v = rec.T(n);
    if (!isFinite(v) || Math.abs(v - Math.round(v)) > 1e-9) throw new Error('retry');
    v = Math.round(v);

    var chain = [];
    for (var k = 1; k <= n; k++) chain.push('T(' + k + ') = ' + Math.round(rec.T(k)));

    return {
      topic: 'recursion · unfolding a recurrence',
      prompt: 'Given <code>' + esc(r.base) + '</code> and <code>T(n) = ' + esc(r.rec) +
        '</code>, what is <strong>T(' + n + ')</strong>?',
      placeholder: 'a whole number',
      answer: String(v),
      check: rqNum(v),
      explain: 'Unfold from the base case: ' + chain.join(', ') + '. This is ' + r.say +
        ', with closed form <code>' + esc(r.form) + '</code>.',
    };
  } });

  /* ---- Which closed form solves it? ---- */
  QZ_GEN.push({ topic: 'recursion', make: function () {
    var r = qzPick(RQ_RECS);
    var wrong = RQ_RECS.filter(function (x) { return x.form !== r.form; })
      .map(function (x) { return x.form; });
    if (wrong.length < 3) throw new Error('retry');
    var choices = [r.form, wrong[0], wrong[1], wrong[2]].slice().sort();

    // Confirm the claimed answer really does survive the inductive step,
    // and that the distractors really do not — so a mis-keyed question
    // cannot be generated in the first place.
    var bp = rcParseBase(r.base);
    var ok = rcInduction(bp.base, r.rec, r.form, '=', 1, 20);
    if (!ok.ok || !ok.allOk) throw new Error('retry');
    for (var i = 0; i < wrong.length; i++) {
      var bad = rcInduction(bp.base, r.rec, wrong[i], '=', 1, 20);
      if (bad.ok && bad.allOk && bad.base.every(function (b) { return b.ok; })) throw new Error('retry');
    }

    return {
      topic: 'recursion · closed forms',
      kind: 'choice',
      prompt: 'Which closed form solves <code>' + esc(r.base) + '</code>, <code>T(n) = ' +
        esc(r.rec) + '</code>?',
      choices: choices,
      answer: r.form,
      check: textCheck(r.form),
      explain: 'Check the base case, then substitute into the step: assuming T(k) = <code>' +
        esc(r.form) + '</code> and putting it into the recurrence at k+1 gives the same formula ' +
        'at k+1. This is ' + r.say + '. The other three fail either the base case or the step.',
    };
  } });

  /* ---- Which half of the induction fails? ---- */
  QZ_GEN.push({ topic: 'recursion', make: function () {
    var badBase = 'The base case';
    var badStep = 'The inductive step';
    var breakBase = Math.random() < 0.5;

    var base = breakBase ? 'T(1) = 2' : 'T(1) = 1';
    var rec = breakBase ? 'T(n-1) + n' : '2T(n-1) + 1';
    var form = breakBase ? '(n^2 + n)/2' : 'n^2';

    var bp = rcParseBase(base);
    var ind = rcInduction(bp.base, rec, form, '=', 1, 20);
    if (!ind.ok) throw new Error('retry');
    var baseOk = ind.base.every(function (b) { return b.ok; });
    var stepOk = ind.steps.every(function (x) { return x.ok; });
    if (baseOk === stepOk) throw new Error('retry');     // want exactly one to fail

    var right = baseOk ? badStep : badBase;
    return {
      topic: 'recursion · induction',
      kind: 'choice',
      prompt: 'Someone claims <code>' + esc(base) + '</code>, <code>T(n) = ' + esc(rec) +
        '</code> has closed form <code>' + esc(form) + '</code>. Which part of the proof fails?',
      choices: [badBase, badStep, 'Both', 'Neither — the proof is fine'],
      answer: right,
      check: textCheck(right),
      explain: baseOk
        ? 'The base case is fine, but substituting the formula into the recurrence at k+1 does not ' +
          'give the formula at k+1 — it first parts company at k = ' +
          ind.steps.filter(function (x) { return !x.ok; })[0].k + '. Matching a few values is not a proof.'
        : 'The step is fine at every k — but the base case is wrong (T(1) = ' + ind.base[0].lhs +
          ', while the formula gives ' + ind.base[0].rhs + '), and a bad base propagates all the way up. ' +
          'Both halves are needed.',
    };
  } });

  /* ---- Master theorem: what is k? ---- */
  QZ_GEN.push({ topic: 'recursion', make: function () {
    var pairs = [[4,2],[8,2],[2,2],[9,3],[27,3],[16,4],[16,2],[3,3],[25,5]];
    var ab = qzPick(pairs);
    var sol = mtSolve(ab[0], ab[1], 'n');
    if (!sol.ok || !sol.exact) throw new Error('retry');

    return {
      topic: 'recursion · Master Theorem',
      prompt: 'For <code>T(n) = ' + ab[0] + ' T(n/' + ab[1] + ') + f(n)</code>, what is ' +
        '<strong>k = log<sub>b</sub> a</strong>?',
      placeholder: 'a whole number',
      answer: String(sol.kShown),
      check: rqNum(sol.kShown),
      explain: 'k = log<sub>' + ab[1] + '</sub>(' + ab[0] + ') = ' + sol.kShown + ', because ' +
        ab[1] + '<sup>' + sol.kShown + '</sup> = ' + ab[0] + '. The base is <strong>b</strong>, the ' +
        'number you divide by — log<sub>' + ab[0] + '</sub>(' + ab[1] + ') = ' +
        sol.kWrong.toFixed(4) + ' is the flipped version, and getting it that way round is the ' +
        'commonest slip in this topic.',
    };
  } });

  /* ---- Master theorem: which case, and what answer? ---- */
  QZ_GEN.push({ topic: 'recursion', make: function () {
    var setups = [
      [2, 2, 'n'], [4, 2, 'n^2'], [8, 2, 'n^2'], [9, 3, 'n^3'],
      [2, 2, 'n^2'], [4, 2, 'n'], [1, 2, '1'], [16, 4, 'n^2'], [3, 2, 'n'],
    ];
    var s = qzPick(setups);
    var sol = mtSolve(s[0], s[1], s[2]);
    if (!sol.ok) throw new Error('retry');

    var right = 'Case ' + sol.caseNo;
    return {
      topic: 'recursion · Master Theorem',
      kind: 'choice',
      prompt: 'Which case of the Master Theorem applies to <code>T(n) = ' + s[0] + ' T(n/' + s[1] +
        ') + ' + esc(s[2]) + '</code>?',
      choices: ['Case 1', 'Case 2', 'Case 3'],
      answer: right,
      check: textCheck(right),
      explain: 'k = log<sub>' + s[1] + '</sub>(' + s[0] + ') = ' +
        (sol.exact ? sol.kShown : sol.k.toFixed(4)) + ', so the recursion costs Θ(' +
        gwClassShow(sol.clsCrit) + '), while f(n) = ' + esc(s[2]) + ' ∈ Θ(' + gwClassShow(sol.clsF) + '). ' +
        (sol.caseNo === 1 ? 'f is the slower of the two, so the recursion dominates.'
          : sol.caseNo === 2 ? 'They grow at the same rate, so every level costs the same and an extra log n appears.'
          : 'f is the faster of the two, so the top-level combine dominates.') +
        ' Answer: <strong>' + sol.answer + '</strong>.',
    };
  } });

  /* ---- Hanoi, counted by moving the discs ---- */
  QZ_GEN.push({ topic: 'recursion', make: function () {
    var n = qzInt(3, 9);
    var run = hanoiRun(n);
    var chk = hanoiCheck(n, run.moves);
    if (!chk.ok) throw new Error('retry');

    return {
      topic: 'recursion · Towers of Hanoi',
      prompt: 'How many moves does MOVETOWER take for <strong>' + n + ' discs</strong>?',
      placeholder: 'a whole number',
      answer: String(run.count),
      check: rqNum(run.count),
      explain: 'T(1) = 1, T(n) = 2T(n−1) + 1 gives T(' + n + ') = 2<sup>' + n + '</sup> − 1 = ' +
        run.count + '. That is not a formula being quoted at you — the discs were actually moved, ' +
        'and every move checked legal, to get this number.',
    };
  } });

  /* ---- Merge sort: the two recurrences disagree ---- */
  QZ_GEN.push({ topic: 'recursion', make: function () {
    var n = qzPick([3, 5, 6, 7, 9, 10, 11]);
    var exact = msRecurrence(n, 'exact'), approx = msRecurrence(n, 'approx');
    if (exact === approx) throw new Error('retry');
    var which = qzPick(['exact', 'approx']);
    var want = which === 'exact' ? exact : approx;

    return {
      topic: 'recursion · merge sort',
      prompt: 'Using the <strong>' + (which === 'exact'
        ? 'exact recurrence T(n) = T(⌊n/2⌋) + T(⌈n/2⌉) + n'
        : 'approximation T(n) ≈ 2T(⌈n/2⌉) + n') + '</strong> with T(1) = 1, what is <strong>T(' +
        n + ')</strong>?',
      placeholder: 'a whole number',
      answer: String(want),
      check: rqNum(want),
      explain: 'The exact recurrence gives ' + exact + '; the approximation gives ' + approx +
        '. They agree only when n is a power of two, and n = ' + n + ' is not one. Both are ' +
        'Θ(n log n), so the growth rate is unaffected — but if you are asked to tabulate T(n), ' +
        'say which recurrence you are using.',
    };
  } });

  /* ---- Which induction do you need? ---- */
  QZ_GEN.push({ topic: 'recursion', make: function () {
    var jumps = ['T(n) = 2T(n/2) + n', 'T(n) = T(⌈n/2⌉) + 1', 'T(n) = T(n-1) + T(n-2)'];
    var simple = ['T(n) = 2T(n-1) + 1', 'T(n) = T(n-1) + n', 'T(n) = 3T(n-1)'];
    var strong = Math.random() < 0.5;
    var rec = strong ? qzPick(jumps) : qzPick(simple);
    var right = strong ? 'Strong induction — assume it for all m ≤ k' : 'Ordinary induction — assume it for k alone';

    return {
      topic: 'recursion · induction',
      kind: 'choice',
      prompt: 'To prove a closed form for <code>' + rec + '</code>, which hypothesis do you need?',
      choices: ['Ordinary induction — assume it for k alone',
                'Strong induction — assume it for all m ≤ k'],
      answer: right,
      check: textCheck(right),
      explain: strong
        ? 'The recurrence refers to something other than n−1, so assuming the result at k alone is ' +
          'not enough — you need it at the value the recurrence actually reaches for. ⌈k/2⌉ is not ' +
          'k−1, and neither is k−2.'
        : 'The recurrence only ever refers to n−1, so the ordinary hypothesis at k is exactly what ' +
          'the step needs. Strong induction would work too, but is more than required.',
    };
  } });
