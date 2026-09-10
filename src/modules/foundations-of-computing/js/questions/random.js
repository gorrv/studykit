  /* ---------- Topic 09 · probability and probabilistic classes ----------

     Marked by running the engines: expectations by summing the
     distribution, Markov by evaluating both sides, class membership
     by the same classifier the tool uses.
     ------------------------------------------------------------ */

  function rnFrCheck(target) {
    return function (v) {
      var f = frParse(String(v).trim().replace(/,/g, ''));
      if (!f) return { ok: false, msg: 'Give a number, as a fraction like <code>2/3</code> or a decimal.' };
      return { ok: frCmp(f, target) === 0 };
    };
  }

  /** A small distribution with a tidy mean. */
  function rnDist(n) {
    var k = n || qzInt(3, 5), den = qzPick([4, 8, 10, 20]);
    var parts = [], left = den;
    for (var i = 0; i < k - 1; i++) {
      var take = qzInt(1, Math.max(1, left - (k - 1 - i)));
      parts.push(take); left -= take;
    }
    parts.push(left);
    var lines = parts.map(function (p, i) { return (i + 1) + ' ' + p + '/' + den; });
    return pbParse(lines.join('\n'));
  }

  /* ---- E[X] from a table ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var d = rnDist();
    if (!d.ok || !d.sums) return null;
    var mu = pbMean(d);
    return {
      topic: 'random · expectation',
      kind: 'text',
      prompt: 'A random variable X has this probability mass function:<br><code>' +
        d.pts.map(function (x) { return 'p(' + frShow(x.v) + ') = ' + frShow(x.p); }).join(', ') +
        '</code><br>What is E[X]?',
      answer: frShow(mu),
      check: rnFrCheck(mu),
      explain: 'E[X] = Σ k · p<sub>X</sub>(k) = ' +
        d.pts.map(function (x) { return frShow(x.v) + '·' + frShow(x.p); }).join(' + ') + ' = <strong>' +
        frShow(mu) + '</strong>. Check Σp = 1 before you start; if it does not, the question is broken ' +
        'rather than hard.'
    };
  } });

  /* ---- Variance ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var d = rnDist(3);
    if (!d.ok || !d.sums) return null;
    var v = pbVar(d), m2 = pbMoment(d, 2);
    return {
      topic: 'random · variance',
      kind: 'text',
      prompt: 'For the distribution <code>' +
        d.pts.map(function (x) { return 'p(' + frShow(x.v) + ') = ' + frShow(x.p); }).join(', ') +
        '</code>, what is Var[X]?',
      answer: frShow(v.direct),
      check: rnFrCheck(v.direct),
      explain: 'Use Var[X] = E[X²] − E[X]². Here E[X] = ' + frShow(v.mu) + ' and E[X²] = ' +
        frShow(m2) + ', so Var[X] = ' + frShow(m2) + ' − ' + frShow(frMul(v.mu, v.mu)) +
        ' = <strong>' + frShow(v.direct) + '</strong>. Computing E[(X − μ)²] directly gives the same ' +
        'answer and more arithmetic.'
    };
  } });

  /* ---- Why the first attempt at variance fails ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var right = 'It is always zero, for every random variable';
    var choices = [right,
      'It is negative whenever X is',
      'It is only defined when X ≥ 0',
      'It equals the standard deviation'];
    return {
      topic: 'random · variance',
      kind: 'choice',
      prompt: 'A first attempt at defining variance is E[X − μ]. What is wrong with it?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'By linearity, E[X − μ] = E[X] − μ = 0. Deviations above and below the mean cancel ' +
        'exactly — that is what makes μ the mean. Squaring first stops the cancellation, which is why ' +
        'Var[X] = E[(X − μ)²].'
    };
  } });

  /* ---- Linearity versus independence ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var items = [
      { q: 'E[X + Y] = E[X] + E[Y] requires…', a: 'nothing — it holds for any X and Y',
        w: ['X and Y to be independent', 'X and Y to be non-negative', 'X and Y to have the same distribution'],
        e: 'Linearity of expectation holds unconditionally. Y may even be X itself. That is what makes ' +
           'it so useful: you can break a total into parts and add up their expectations without ever ' +
           'arguing about how the parts interact.' },
      { q: 'Var[X + Y] = Var[X] + Var[Y] requires…', a: 'X and Y to be independent',
        w: ['nothing — it holds for any X and Y', 'X and Y to be non-negative', 'X and Y to have equal means'],
        e: 'Var[X + Y] = Var[X] + Var[Y] + 2·Cov[X, Y] always, so the variances add exactly when the ' +
           'covariance is zero. Independence gives that; nothing weaker is guaranteed to.' }
    ];
    var it = qzPick(items);
    return {
      topic: 'random · linearity',
      kind: 'choice',
      prompt: it.q,
      choices: [it.a].concat(it.w).sort(),
      answer: it.a,
      check: textCheck(it.a),
      explain: it.e
    };
  } });

  /* ---- Markov's inequality, applied ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var a = qzPick([2, 3, 4, 5, 10]);
    var bound = fr(1, a);
    return {
      topic: 'random · Markov',
      kind: 'text',
      prompt: 'X is a non-negative random variable. By Markov’s inequality, what is the largest value ' +
        'Prob( X ≥ ' + a + '·E[X] ) can take?',
      answer: frShow(bound),
      check: rnFrCheck(bound),
      explain: 'Markov gives Prob(X ≥ a·E[X]) ≤ 1/a, so the answer is <strong>1/' + a +
        '</strong>. It is achievable: a variable equal to ' + a + '·E[X] with probability 1/' + a +
        ' and 0 otherwise meets it exactly, so no smaller bound follows from the mean alone.'
    };
  } });

  /* ---- The hypothesis the usual write-up omits ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var right = 'X ≥ 0';
    var choices = [right, 'X is independent of a', 'E[X] > 1', 'X has finite variance'];
    return {
      topic: 'random · Markov',
      kind: 'choice',
      prompt: 'Markov’s inequality needs one hypothesis on X that is often left out. ' +
        'Which?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Without <strong>X ≥ 0</strong> the theorem is false. Take X = −10 always, so ' +
        'E[X] = −10; then Prob(X ≥ 2·E[X]) = Prob(X ≥ −20) = 1, which is not ≤ ½. With a negative ' +
        'mean, a larger a moves the threshold down rather than up, so the event gets <em>more</em> ' +
        'likely as the bound tightens. Every use of Markov in this topic is on a running time, which ' +
        'is non-negative, so nothing later breaks — but state the hypothesis.'
    };
  } });

  /* ---- Reading a computation tree ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var a = qzInt(1, 3), den = qzPick([3, 4, 5]);
    if (a >= den) return null;
    var p1 = fr(a, den), p2 = frSub(fr(1), p1);
    var b = qzInt(1, den - 1);
    var q1 = fr(b, den), q2 = frSub(fr(1), q1);
    // root splits p1 (accept) / p2, then the right child splits q1 (reject) / q2 (accept)
    var acc = frAdd(p1, frMul(p2, q2));
    return {
      topic: 'random · computation trees',
      kind: 'text',
      prompt: 'A probabilistic machine branches at the root with probability ' + frShow(p1) +
        ' to an accepting halt and ' + frShow(p2) + ' to a second choice, which then rejects with ' +
        'probability ' + frShow(q1) + ' and accepts with probability ' + frShow(q2) + '. ' +
        'What is Prob(M accepts)?',
      answer: frShow(acc),
      check: rnFrCheck(acc),
      explain: 'Multiply along each branch, add across accepting branches. The two accepting branches ' +
        'have probability ' + frShow(p1) + ' and ' + frShow(p2) + '·' + frShow(q2) + ' = ' +
        frShow(frMul(p2, q2)) + ', giving <strong>' + frShow(acc) + '</strong>. The rejecting branch ' +
        'is ' + frShow(frMul(p2, q1)) + ', and all three total 1 — a useful check.'
    };
  } });

  /* ---- BPP or ZPP? ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var cases = [
      { d: 'always returns the right answer, and runs in expected polynomial time', a: 'ZPP' },
      { d: 'always runs in polynomial time, and is right at least two thirds of the time', a: 'BPP' },
      { d: 'is a Monte Carlo algorithm running in polynomial time', a: 'BPP' },
      { d: 'is a Las Vegas algorithm running in polynomial time', a: 'ZPP' }
    ];
    var c = qzPick(cases);
    var choices = ['BPP', 'ZPP', 'NP', 'neither'];
    return {
      topic: 'random · BPP and ZPP',
      kind: 'choice',
      prompt: 'A machine for L ' + c.d + '. Which class does that put L in?',
      choices: choices.slice().sort(),
      answer: c.a,
      check: textCheck(c.a),
      explain: c.a === 'ZPP'
        ? 'Zero error with an expected time bound is <strong>ZPP</strong> — a Las Vegas algorithm. ' +
          'Since ZPP ⊆ BPP it is in BPP as well, but ZPP is the sharper answer.'
        : 'Bounded error with a worst-case time bound is <strong>BPP</strong> — a Monte Carlo ' +
          'algorithm. It is not ZPP, because ZPP allows no error at all.'
    };
  } });

  /* ---- Which containments are known ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var pairs = [
      { from: 'P', to: 'ZPP' }, { from: 'ZPP', to: 'BPP' },
      { from: 'BPP', to: 'NP' }, { from: 'NP', to: 'BPP' }, { from: 'BPP', to: 'PSPACE' }
    ];
    var p = qzPick(pairs);
    var r = pcAsk(p.from, p.to);
    var right = r.status === 'proved' ? 'Proved' : 'Open';
    var shown = { PSPACE: 'PSpace', coNP: 'co-NP' };
    return {
      topic: 'random · the hierarchy',
      kind: 'choice',
      prompt: 'Is <strong>' + (shown[p.from] || p.from) + ' ⊆ ' + (shown[p.to] || p.to) +
        '</strong> known to hold?',
      choices: ['Proved', 'Open', 'Known to be false'].sort(),
      answer: right,
      check: textCheck(right),
      explain: r.status === 'proved'
        ? 'Proved: ' + r.why + '.'
        : 'This one is <strong>open</strong>. The containments this course proves are ' +
          'P ⊆ ZPP ⊆ BPP ⊆ PSpace and P ⊆ NP ⊆ PSpace; the relationship between BPP and NP is not ' +
          'known in either direction.'
    };
  } });

  /* ---- The ZPP ⊆ BPP construction ---- */
  QZ_GEN.push({ topic: 'random', make: function () {
    var right = 'flip a fair coin';
    var choices = [right, 'reject', 'accept', 'run it for another 3·E[T] steps'];
    return {
      topic: 'random · ZPP ⊆ BPP',
      kind: 'choice',
      prompt: 'In the proof that ZPP ⊆ BPP, the Las Vegas machine is run for K = 3·E[T] steps. ' +
        'What does the new machine do if it has not finished by then?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'It <strong>flips a fair coin</strong>. Markov bounds the chance of getting that far by ' +
        '1/3, so the guess costs at most 1/3 of the probability mass — enough to stay inside BPP’s ' +
        '1/3 and 2/3. Always rejecting would also work for soundness but would break completeness, ' +
        'since a word in L that ran long would then be rejected outright.'
    };
  } });
