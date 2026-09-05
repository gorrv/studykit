  /* ============================================================
     TOPIC 05 · GREEDY-SAT, and why polynomial is not the whole story
     ------------------------------------------------------------
     The lecture proves this algorithm runs in polynomial time and
     stops there, which invites exactly the wrong conclusion. It is
     polynomial AND it is wrong: it climbs to a local maximum and
     reports False from there, on formulas that are satisfiable.

     The deck's own example demonstrates this and does not say so.
     Starting at (True, False, False) -- the assignment the slide
     picks -- greedy scores 6, every neighbour scores 6 or less, and
     it gives up. The formula is satisfiable: (False, True, True)
     scores 7. So the tools below always report the true answer
     alongside greedy's, because the gap IS the lesson.
     ============================================================ */

  /** Flip one variable. */
  function gdFlip(asg, v) {
    var out = {}, k;
    for (k in asg) if (Object.prototype.hasOwnProperty.call(asg, k)) out[k] = asg[k];
    out[v] = !out[v];
    return out;
  }

  function gdAsgKey(asg, vars) {
    return vars.map(function (v) { return asg[v] ? 'T' : 'F'; }).join('');
  }

  /** Hill-climbing, as the deck writes it: at each step try every
      single-variable flip, take the best STRICT improvement, and
      stop when none exists. */
  function gdRun(clauses, vars, start, cap) {
    cap = cap || 200;
    var asg = {}, steps = [];
    vars.forEach(function (v) { asg[v] = start ? !!start[v] : false; });

    var score = stScore(clauses, asg);
    steps.push({ n: 0, asg: gdCopy(asg), score: score, flipped: null,
                 neighbours: [], note: 'Start from ' + stShowAsg(asg, vars) +
                 ', which satisfies ' + score + ' of ' + clauses.length + ' clauses.' });

    for (var n = 1; n <= cap; n++) {
      if (score === clauses.length) {
        steps.push({ n: n, asg: gdCopy(asg), score: score, flipped: null, neighbours: [],
                     done: 'sat', note: 'Every clause is satisfied — return True.' });
        return { ok: true, verdict: true, asg: asg, score: score, steps: steps, iterations: n - 1 };
      }

      // Score every single-variable flip.
      var best = null, nbrs = [];
      vars.forEach(function (v) {
        var alt = gdFlip(asg, v), s = stScore(clauses, alt);
        nbrs.push({ v: v, score: s, delta: s - score });
        if (!best || s > best.score) best = { v: v, score: s, asg: alt };
      });

      if (!best || best.score <= score) {
        steps.push({ n: n, asg: gdCopy(asg), score: score, flipped: null, neighbours: nbrs,
                     done: 'stuck',
                     note: 'No single flip improves on ' + score + ' — the best any neighbour ' +
                           'manages is ' + (nbrs.reduce(function (m, x) { return Math.max(m, x.score); }, 0)) +
                           '. GREEDY-SAT returns False here.' });
        return { ok: true, verdict: false, asg: asg, score: score, steps: steps,
                 stuck: true, iterations: n - 1 };
      }

      asg = best.asg;
      score = best.score;
      steps.push({ n: n, asg: gdCopy(asg), score: score, flipped: best.v, neighbours: nbrs,
                   note: 'Flipping ' + best.v + ' raises the score to ' + score + '.' });
    }
    return { ok: true, verdict: false, asg: asg, score: score, steps: steps,
             capped: true, iterations: cap };
  }

  function gdCopy(a) {
    var o = {}, k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
    return o;
  }

  /** Every assignment with its score -- the hypercube the deck
      draws. Also identifies which of them are local maxima, since
      those are exactly the places greedy can strand itself. */
  function gdLandscape(clauses, vars) {
    if (vars.length > 12) return { ok: false, error: 'Too many variables to draw the landscape.' };
    var n = vars.length, total = 1 << n, nodes = [];

    for (var mask = 0; mask < total; mask++) {
      var asg = {};
      for (var i = 0; i < n; i++) asg[vars[i]] = !!(mask & (1 << i));
      nodes.push({ mask: mask, asg: asg, key: gdAsgKey(asg, vars),
                   score: stScore(clauses, asg) });
    }

    var best = nodes.reduce(function (m, x) { return Math.max(m, x.score); }, 0);
    nodes.forEach(function (nd) {
      var better = 0, equal = 0;
      for (var i = 0; i < n; i++) {
        var s = nodes[nd.mask ^ (1 << i)].score;
        if (s > nd.score) better++;
        else if (s === nd.score) equal++;
      }
      nd.localMax = better === 0;                 // no strict improvement available
      nd.globalMax = nd.score === best;
      // A trap is a local maximum that is not a solution: greedy
      // reaching one returns False on a satisfiable formula.
      nd.trap = nd.localMax && nd.score < clauses.length;
      nd.plateau = equal;
    });

    return { ok: true, nodes: nodes, best: best, total: clauses.length,
             traps: nodes.filter(function (x) { return x.trap; }),
             solutions: nodes.filter(function (x) { return x.score === clauses.length; }) };
  }

  /** Run greedy from every possible start. Answers the question the
      deck raises but leaves hanging: how often does it actually
      work? */
  function gdSurvey(clauses, vars) {
    if (vars.length > 12) return { ok: false, error: 'Too many variables to survey.' };
    var n = vars.length, total = 1 << n, wins = 0, losses = 0, examples = [];
    for (var mask = 0; mask < total; mask++) {
      var start = {};
      for (var i = 0; i < n; i++) start[vars[i]] = !!(mask & (1 << i));
      var r = gdRun(clauses, vars, start);
      if (r.verdict) wins++;
      else { losses++; if (examples.length < 4) examples.push({ start: start, score: r.score }); }
    }
    var truth = stBrute(clauses, vars);
    return { ok: true, starts: total, wins: wins, losses: losses, examples: examples,
             reallySat: truth.sat,
             // The number that matters: how often greedy is WRONG,
             // as opposed to merely unlucky.
             wrong: truth.sat ? losses : 0 };
  }
