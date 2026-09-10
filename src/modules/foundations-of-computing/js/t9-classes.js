  /* ============================================================
     TOPIC 09 · BPP, ZPP, and the constants that do not matter
     ------------------------------------------------------------
     The standard definitions, verbatim:

       BPP  w not in L  =>  Prob(M(w) = 1) <= 1/3
            w in L      =>  Prob(M(w) = 1) >= 2/3
            T(n) in O(n^k)                       -- worst case

       ZPP  w not in L  =>  Prob(M(w) = 1) = 0
            w in L      =>  Prob(M(w) = 1) = 1
            E[T(n)] in O(n^k)                    -- expected

     The difference is where the randomness is allowed to hurt
     you. A Monte Carlo algorithm (BPP) always finishes on time
     and may be wrong; a Las Vegas algorithm (ZPP) is never wrong
     and may take a while. Neither is allowed to be both.

     The 1/3 and 2/3 look like magic numbers. They are not: any
     gap around 1/2 that a polynomial number of repetitions can
     widen gives the same class, which is what pcAmplify shows.
     ============================================================ */

  /** Which of the standard two classes do these guarantees meet? */
  function pcClassify(pIn, pOut, opts) {
    opts = opts || {};
    var worstCasePoly = opts.worstCasePoly !== false;
    var expectedPoly = opts.expectedPoly !== false;

    var one = fr(1), zero = fr(0);
    var bppSound = frCmp(pOut, fr(1, 3)) <= 0;
    var bppComplete = frCmp(pIn, fr(2, 3)) >= 0;
    var zppSound = frCmp(pOut, zero) === 0;
    var zppComplete = frCmp(pIn, one) === 0;

    var inBPP = bppSound && bppComplete && worstCasePoly;
    var inZPP = zppSound && zppComplete && expectedPoly;

    var reasons = [];
    if (!bppSound) reasons.push('accepts a word outside L with probability ' + frShow(pOut) +
      ', above BPP’s 1/3');
    if (!bppComplete) reasons.push('accepts a word inside L with probability only ' + frShow(pIn) +
      ', below BPP’s 2/3');
    if (!worstCasePoly) reasons.push('has no polynomial worst-case bound, which BPP requires');
    if (!expectedPoly) reasons.push('has no polynomial expected bound, which ZPP requires');

    // The useful part: is the gap around 1/2 wide enough to amplify?
    var gap = frSub(pIn, pOut);
    var straddles = frCmp(pIn, fr(1, 2)) > 0 && frCmp(pOut, fr(1, 2)) < 0;

    return {
      ok: true, pIn: pIn, pOut: pOut,
      inBPP: inBPP, inZPP: inZPP,
      bppSound: bppSound, bppComplete: bppComplete,
      zppSound: zppSound, zppComplete: zppComplete,
      gap: gap, straddles: straddles,
      reasons: reasons,
      note: inZPP
        ? 'Always right, expected polynomial time — a Las Vegas algorithm, so L ∈ ZPP. And since ' +
          'ZPP ⊆ BPP, it is in BPP too.'
        : (inBPP
            ? 'Bounded error either side of 1/2, worst-case polynomial time — a Monte Carlo ' +
              'algorithm, so L ∈ BPP.'
            : (straddles
                ? 'This misses the usual constants, but the two probabilities still sit on ' +
                  'opposite sides of 1/2 with a gap of ' + frShow(gap) + '. Repeating the machine and ' +
                  'taking a majority vote widens any such gap, so this is in BPP anyway — the 1/3 and ' +
                  '2/3 are a convention, not a boundary.'
                : 'The two probabilities do not straddle 1/2, so repetition cannot separate them and ' +
                  'nothing here puts L in BPP.'))
    };
  }

  /**
     Amplification: run the machine k times and take the majority.

     Each run is independent, so the number of correct runs is
     binomial. The majority is wrong when at most floor(k/2) runs
     are correct, and that probability collapses as k grows for any
     single-run accuracy strictly above 1/2.

     Computed in floating point, deliberately: the binomial
     coefficients here reach 10^29 and the interesting answers are
     things like 3e-13, where an exact rational would be a very
     precise way of saying "small".
  */
  function pcAmplify(correct, k) {
    var p = frNum(correct);
    if (!(p > 0 && p < 1)) return { ok: false, error: 'The single-run accuracy must be strictly between 0 and 1.' };
    if (!(k >= 1) || k % 2 === 0) {
      return { ok: false, error: 'Use an odd number of repetitions, so a majority always exists.' };
    }
    // log-space, so k = 999 does not overflow
    function logC(n, r) {
      var s = 0;
      for (var i = 1; i <= r; i++) s += Math.log(n - r + i) - Math.log(i);
      return s;
    }
    var err = 0;
    for (var w = 0; w <= Math.floor(k / 2); w++) {
      err += Math.exp(logC(k, w) + w * Math.log(p) + (k - w) * Math.log(1 - p));
    }
    return {
      ok: true, p: p, k: k, error: err, accuracy: 1 - err,
      single: 1 - p,
      improved: err < 1 - p
    };
  }

  /** How many repetitions to push the error below a target? */
  function pcRepetitions(correct, target) {
    for (var k = 1; k <= 9999; k += 2) {
      var a = pcAmplify(correct, k);
      if (a.ok && a.error <= target) return { ok: true, k: k, error: a.error };
    }
    return { ok: false, error: 'More than 9999 repetitions needed.' };
  }

  /**
     The standard proof that ZPP is contained in BPP, computed
     exactly on a given runtime distribution rather than bounded.

     The construction: run the Las Vegas machine M for
     K = 3·E[T] steps. If it finished, answer what it answered.
     If it did not, flip a fair coin.

     The usual write-up bounds the failure probability by Prob(T > K) and
     then applies Markov to get 1/3. It drops the factor of 1/2
     from the coin, which is safe in both directions but leaves a
     lot on the table: the honest bounds are 1/6 and 5/6.
  */
  function pcZppToBpp(dist) {
    if (!dist.ok) return dist;
    var eT = pbMean(dist);
    if (frCmp(eT, fr(0)) <= 0) return { ok: false, error: 'The expected runtime must be positive.' };
    var K = frMul(fr(3), eT);

    var pOver = pbTail(dist, K, 'gt');       // still running after K steps
    var pDone = frSub(fr(1), pOver);
    var half = fr(1, 2);

    // w in L: M accepts whenever it finishes; otherwise the coin decides
    var accIn = frAdd(pDone, frMul(pOver, half));
    // w not in L: M never accepts, so only a winning coin toss accepts
    var accOut = frMul(pOver, half);

    var markov = fr(1, 3);                   // Prob(T >= 3E[T]) <= 1/3

    return {
      ok: true, eT: eT, K: K, pOver: pOver, pDone: pDone,
      accIn: accIn, accOut: accOut,
      markovBound: markov,
      markovHolds: frCmp(pOver, markov) <= 0,
      slideBoundIn: frSub(fr(1), markov),           // 2/3
      slideBoundOut: markov,                        // 1/3
      honestBoundIn: frAdd(frSub(fr(1), markov), frMul(markov, half)),   // 5/6
      honestBoundOut: frMul(markov, half),                                // 1/6
      meetsBPP: frCmp(accIn, fr(2, 3)) >= 0 && frCmp(accOut, fr(1, 3)) <= 0,
      note: 'Markov gives Prob(T ≥ 3·E[T]) ≤ 1/3 whatever the distribution, and here the actual tail ' +
        'is ' + frShow(pOver) + '. The usual proof bounds the error by that tail alone; including the ' +
        'coin’s factor of ½ would give 1/6 and 5/6 rather than 1/3 and 2/3. Both are valid — the ' +
        'simplification only throws away slack — but it is worth knowing the construction is more ' +
        'comfortable than that bound makes it look.'
    };
  }

  /* ---------- the hierarchy at the end ---------- */

  var PC_HIERARCHY = [
    { id: 'P',      label: 'P',       blurb: 'decidable in deterministic polynomial time' },
    { id: 'ZPP',    label: 'ZPP',     blurb: 'Las Vegas: always right, expected polynomial time' },
    { id: 'BPP',    label: 'BPP',     blurb: 'Monte Carlo: polynomial time, bounded error' },
    { id: 'NP',     label: 'NP',      blurb: 'a "yes" has a polynomially checkable certificate' },
    { id: 'coNP',   label: 'co-NP',   blurb: 'a "no" has a polynomially checkable certificate' },
    { id: 'PSPACE', label: 'PSpace',  blurb: 'decidable in polynomial space, however long it takes' }
  ];

  /* Containments that are actually proved, kept separate from the
     ones the usual write-up raises as questions. Getting these two lists the
     wrong way round is the easiest mark to lose in this topic. */
  var PC_KNOWN = [
    { from: 'P', to: 'ZPP', why: 'a deterministic machine is a probabilistic one that never branches' },
    { from: 'ZPP', to: 'BPP', why: 'the standard theorem: cut the Las Vegas machine off at ' +
      '3·E[T] and flip a coin, then Markov bounds the damage' },
    { from: 'P', to: 'NP', why: 'a machine that decides is a certificate checker that ignores the certificate' },
    { from: 'P', to: 'coNP', why: 'the same, on the complement' },
    { from: 'NP', to: 'PSPACE', why: 'try every certificate, reusing the space' },
    { from: 'coNP', to: 'PSPACE', why: 'the same, on the complement' },
    { from: 'BPP', to: 'PSPACE', why: 'enumerate every sequence of coin flips and count, reusing the space' }
  ];

  var PC_OPEN = [
    { q: 'BPP ⊆ NP?', note: 'open' },
    { q: 'NP ⊆ BPP?', note: 'open, and widely disbelieved — it would put SAT within reach of randomness' },
    { q: 'ZPP = P?', note: 'open' },
    { q: 'BPP = P?', note: 'open, and widely believed TRUE — the modern expectation is that randomness ' +
      'buys no asymptotic power for decision problems, which is the opposite of the guess most people ' +
      'make on first meeting the class' }
  ];

  /** Is a claimed containment one of the proved ones, or one of the open questions? */
  function pcAsk(from, to) {
    var known = PC_KNOWN.filter(function (e) { return e.from === from && e.to === to; })[0];
    if (known) return { status: 'proved', why: known.why };
    // transitive closure of the known containments
    var seen = {}, stack = [from];
    while (stack.length) {
      var cur = stack.pop();
      if (seen[cur]) continue;
      seen[cur] = true;
      PC_KNOWN.forEach(function (e) { if (e.from === cur) stack.push(e.to); });
    }
    if (seen[to] && from !== to) {
      return { status: 'proved', why: 'follows by chaining the containments above' };
    }
    if (from === to) return { status: 'trivial', why: 'every class contains itself' };
    return { status: 'open', why: 'not among the containments this course proves, and not known either way' };
  }
