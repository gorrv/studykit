  /* ============================================================
     TOPIC 07 · approximation ratios, and the unapproximability
                construction
     ------------------------------------------------------------
     The gadget is the whole argument, and it is worth running
     rather than reading: take a Hamiltonian-cycle instance, make
     the edges cost 1 and the non-edges cost nR+1, and the cheapest
     tour is n exactly when a Hamiltonian cycle exists -- otherwise
     every tour must use at least one non-edge and so costs more
     than nR. An R-approximation could therefore decide
     HAMILTONIAN, which is NP-complete.
     ============================================================ */

  /** Build G' = (V, d) from a graph and a claimed ratio R. */
  function apGadget(graph, R) {
    if (!graph.ok) return graph;
    if (!(R > 0)) return { ok: false, error: 'R must be positive.' };
    var V = graph.vertices, n = V.length;
    var long = n * R + 1;

    var have = {};
    graph.edges.forEach(function (e) { have[[e.u, e.v].sort().join(' ')] = true; });

    var lines = [];
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var isEdge = !!have[[V[i], V[j]].sort().join(' ')];
        lines.push(V[i] + ' ' + V[j] + ' ' + (isEdge ? 1 : long));
      }
    }

    var g = tspParse(lines.join('\n'));
    if (!g.ok) return g;

    return { ok: true, tsp: g, n: n, R: R, long: long, threshold: n * R,
             text: lines.join('\n'), original: graph,
             shortCount: graph.edges.length,
             longCount: (n * (n - 1) / 2) - graph.edges.length };
  }

  /** Run the argument end to end and check every claim it makes. */
  function apUnapprox(graph, R) {
    var gad = apGadget(graph, R);
    if (!gad.ok) return gad;

    var brute = tspBrute(gad.tsp);
    if (!brute.ok) return { ok: false, error: brute.error };

    // Does the ORIGINAL graph have a Hamiltonian cycle? Computed
    // independently, by the Topic 2 engine, so the gadget's claim
    // is checked against something that has never heard of it.
    //
    // Two traps here, both of which bit on the way in: that engine
    // uses its own index-based graph shape, so a Topic 4 graph has
    // to be converted rather than handed over; and gphHamCycle
    // returns an OBJECT whose .cycle is null when none exists, so
    // testing the return value for truthiness always says yes.
    var names = graph.vertices.slice();
    var pairs = graph.edges.map(function (e) {
      return [names.indexOf(e.u), names.indexOf(e.v)];
    });
    var ham = gphHamCycle(gphMake(names, pairs));
    var hasHam = !!(ham && ham.cycle);

    var short_ = brute.length <= gad.threshold;

    return {
      ok: true, gadget: gad, brute: brute, ham: ham, hasHam: hasHam,
      threshold: gad.threshold, optimal: brute.length,
      short: short_,
      // The theorem: optimal tour is 'short' exactly when a
      // Hamiltonian cycle exists.
      agrees: short_ === hasHam,
      expected: hasHam ? gad.n : null,
      metric: gad.tsp.metric
    };
  }

  /* ---------- TSP vs TSP_dec ----------

     The lecture proves the two are equivalent by binary search on
     the target length D. The loop condition on the slide is the
     wrong way round -- it continues WHILE the interval is smaller
     than the shortest edge, which is false from the start, so the
     search never runs and the algorithm returns an undefined route.
     Both versions are implemented so the difference is visible. */

  function apBinarySearch(g, opts) {
    opts = opts || {};
    var buggy = !!opts.buggy;
    var V = g.vertices, n = V.length;

    var total = 0, shortest = Infinity;
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        var w = g.d(V[i], V[j]);
        total += w;
        if (w < shortest) shortest = w;
      }
    }

    // The decision oracle, done honestly by brute force: does a
    // tour of length <= D exist?
    var brute = tspBrute(g);
    if (!brute.ok) return { ok: false, error: brute.error };
    function decide(D) { return brute.length <= D + 1e-12; }

    var lo = 0, hi = total, steps = [], guard = 0;
    steps.push({ n: 0, lo: lo, hi: hi, mid: null,
                 note: 'Start with D⁻ = 0 and D⁺ = ' + total.toFixed(4) +
                       ' (the total weight of all edges), an interval that certainly ' +
                       'contains the answer.' });

    while (guard++ < 200) {
      var gap = hi - lo;
      var keepGoing = buggy ? (gap < shortest) : (gap >= shortest);
      if (!keepGoing) break;

      var mid = (hi + lo) / 2;
      var yes = decide(mid);
      if (yes) hi = mid; else lo = mid;
      steps.push({ n: steps.length, lo: lo, hi: hi, mid: mid, yes: yes,
                   note: 'Ask TSP-DEC for D = ' + mid.toFixed(4) + ': ' +
                         (yes ? 'yes, a tour that short exists — so the answer is at most ' + mid.toFixed(4)
                              : 'no — so the answer is more than ' + mid.toFixed(4)) + '.' });
    }

    return {
      ok: true, buggy: buggy, lo: lo, hi: hi, steps: steps,
      calls: steps.length - 1,
      total: total, shortest: shortest,
      answer: hi,
      // With the correct condition the interval closes to within
      // one edge length, which is enough to pin the optimum.
      correct: Math.abs(hi - brute.length) <= shortest + 1e-9,
      truth: brute.length,
      ranAtAll: steps.length > 1
    };
  }

  /* ---------- Classifying a claimed ratio ---------- */

  /** Given an algorithm's results across several inputs, what ratio
      does it actually achieve, and is a claimed R consistent? */
  function apAssess(rows, claimedR) {
    var worst = 0, worstRow = null, bad = [];
    rows.forEach(function (r) {
      var q = tspRatio(r.approx, r.optimal);
      if (!q.ok) return;
      r.ratio = q.ratio;
      if (q.ratio > worst) { worst = q.ratio; worstRow = r; }
      if (claimedR && q.ratio > claimedR + 1e-9) bad.push(r);
    });
    return {
      ok: true, worst: worst, worstRow: worstRow, violations: bad,
      consistent: !bad.length,
      note: claimedR
        ? (bad.length
            ? 'The claim R = ' + claimedR + ' is refuted: ' + bad.length + ' input' +
              (bad.length === 1 ? '' : 's') + ' exceed it, the worst at ' + worst.toFixed(4) + '.'
            : 'No input exceeds R = ' + claimedR + '; the worst seen is ' + worst.toFixed(4) +
              '. That is consistent with the claim, but consistency is not proof — a ratio ' +
              'holds only if it holds for EVERY input.')
        : 'Worst ratio seen: ' + worst.toFixed(4) + '.'
    };
  }

  var AP_PRESETS = {
    ham: 'A > B\nB > C\nC > D\nD > E\nE > A\nA > C',
    noham: 'A > B\nB > C\nC > A\nD > A',
    square: 'A > B\nB > C\nC > D\nD > A',
    path: 'A > B\nB > C\nC > D'
  };
