  /* ---------- Topic 07 · approximation and TSP ----------

     Marked by running the algorithms: the ratio questions by
     brute-forcing the optimum, the gadget questions by building it.
     ------------------------------------------------------------ */

  function apNum(target, tol) {
    return function (v) {
      var s = String(v).trim().replace(/,/g, '');
      if (!/^-?[0-9]*\.?[0-9]+$/.test(s)) return { ok: false, msg: 'Give a number.' };
      return { ok: Math.abs(parseFloat(s) - target) <= (tol === undefined ? 1e-9 : tol) };
    };
  }

  /* ---- Decision or optimisation? ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var dec = ['SAT', 'the Halting Problem', 'HAMILTONIAN', 'Graph Isomorphism'];
    var opt = ['CLIQUE', 'Vertex Cover', 'TSP'];
    var isDec = Math.random() < 0.5;
    var name = qzPick(isDec ? dec : opt);
    var right = isDec ? 'A decision problem' : 'An optimisation problem';
    return {
      topic: 'approx · decision vs optimisation',
      kind: 'choice',
      prompt: 'Is <strong>' + esc(name) + '</strong> a decision problem or an optimisation problem?',
      choices: ['A decision problem', 'An optimisation problem'],
      answer: right,
      check: textCheck(right),
      explain: isDec
        ? 'A decision problem asks whether a solution <em>exists</em> — the answer is yes or no.'
        : 'An optimisation problem asks for the <em>best</em> solution, which needs a cost function ' +
          'to compare candidates. Note the two are usually closely related: TSP and TSP<sub>dec</sub> ' +
          'are polynomially equivalent, so neither is easier than the other.',
    };
  } });

  /* ---- Compute an approximation ratio ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var opt = qzInt(8, 30);
    var app = opt + qzInt(0, opt);
    var r = tspRatio(app, opt);
    return {
      topic: 'approx · the approximation ratio',
      prompt: 'An approximation returns a tour of cost <strong>' + app + '</strong> where the optimum ' +
        'is <strong>' + opt + '</strong>. What is R<sub>M</sub>(w), to 3 decimal places?',
      placeholder: 'e.g. 1.250',
      answer: r.ratio.toFixed(3),
      check: apNum(r.ratio, 0.0011),
      explain: 'R<sub>M</sub>(w) = max(C<sub>approx</sub>/C<sub>global</sub>, ' +
        'C<sub>global</sub>/C<sub>approx</sub>) = ' + app + '/' + opt + ' = ' + r.ratio.toFixed(4) +
        '. For a minimisation problem the approximate cost can never be below the optimum, so it is ' +
        'always the first of the two — and the ratio is always at least 1.',
    };
  } });

  /* ---- What does R-approximable require? ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var right = 'R_M(w) ≤ R for every input w';
    var choices = [right, 'R_M(w) ≤ R on average over all inputs',
      'R_M(w) ≤ R for at least one input w', 'R_M(w) = R for every input w'];
    return {
      topic: 'approx · R-approximable',
      kind: 'choice',
      prompt: 'A problem is <strong>R-approximable</strong> when a polynomial-time algorithm M ' +
        'satisfies which condition?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'A ratio is a <strong>worst-case guarantee</strong>. An algorithm that is perfect on a ' +
        'million inputs and ten times too long on the next is not 2-approximable. This is why a ' +
        'table of examples can refute a claimed ratio but never establish one — establishing it ' +
        'takes a proof covering every input.',
    };
  } });

  /* ---- The 2OPT stages ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var right = 'A minimum spanning tree';
    var choices = [right, 'A random Hamiltonian cycle', 'The convex hull of the points',
      'A greedy nearest-neighbour tour'];
    return {
      topic: 'approx · 2OPT',
      kind: 'choice',
      prompt: 'What does the 2OPT algorithm construct <strong>first</strong>?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Step 1 builds a minimum spanning tree; step 2 takes its <strong>preorder ' +
        'traversal</strong> as the starting tour; step 3 improves that tour with swaps. The factor ' +
        'of 2 in the guarantee comes entirely from steps 1 and 2 — the traversal walks each tree ' +
        'edge at most twice — so the swaps are for practical quality, not for the bound.',
    };
  } });

  /* ---- Where does the factor of 2 come from? ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var right = 'The preorder traversal walks each tree edge at most twice';
    var choices = [right,
      'Each 2-opt swap at most halves the tour length',
      'The MST has at most twice as many edges as a tour',
      'The tour visits each vertex twice'];
    return {
      topic: 'approx · 2OPT',
      kind: 'choice',
      prompt: 'In the proof that 2OPT has ratio 2, where does the <strong>factor of 2</strong> ' +
        'actually come from?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'length_of(H<sub>0</sub>) ≤ 2 × length_of(T<sub>0</sub>), because a preorder walk goes ' +
        'down and back up every edge of the tree. The rest of the chain is a sequence of ≤ steps ' +
        'that cost nothing. In particular the swaps contribute <em>nothing</em> to the bound — they ' +
        'only guarantee the tour does not get worse.',
    };
  } });

  /* ---- The missing hypothesis ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var right = 'The triangle inequality';
    var choices = [right, 'That the graph is connected',
      'That all distances are integers', 'That the graph has an even number of vertices'];
    return {
      topic: 'approx · 2OPT',
      kind: 'choice',
      prompt: 'The 2-approximation proof needs an assumption about d that the theorem statement often ' +
        'leaves out. Which?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Turning the preorder traversal into a Hamiltonian cycle means <strong>shortcutting</strong> ' +
        'past already-visited vertices, and a shortcut only helps if d(x,z) ≤ d(x,y) + d(y,z). So the ' +
        'result is about <strong>metric</strong> TSP. Without it, general TSP is not just harder to ' +
        'approximate — it is unapproximable for <em>any</em> fixed ratio.',
    };
  } });

  /* ---- The gadget's long edge ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var n = qzInt(4, 9), R = qzInt(2, 5);
    var askLong = Math.random() < 0.5;
    var val = askLong ? n * R + 1 : n * R;
    return {
      topic: 'approx · unapproximability',
      prompt: 'In the unapproximability construction with <strong>n = ' + n + '</strong> vertices and ' +
        'a claimed ratio <strong>R = ' + R + '</strong>, what is ' +
        (askLong ? 'the cost given to a <strong>non-edge</strong>' :
                   'the <strong>threshold</strong> the returned tour is compared against') + '?',
      placeholder: 'a whole number',
      answer: String(val),
      check: apNum(val, 1e-9),
      explain: 'Edges of G cost 1; non-edges cost <strong>nR + 1 = ' + (n * R + 1) + '</strong>. ' +
        'If G has a Hamiltonian cycle the optimum is exactly n = ' + n + ', so an R-approximation ' +
        'returns at most <strong>nR = ' + (n * R) + '</strong>. If it does not, any tour uses a ' +
        'non-edge and costs at least (n−1) + (nR+1) = ' + ((n - 1) + n * R + 1) + ' > nR. So the ' +
        'test "is it ≤ nR?" decides HAMILTONIAN.',
    };
  } });

  /* ---- Why nR+1 rather than a fixed big number ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var right = 'Because it is chosen after R, so it outgrows any ratio you claim';
    var choices = [right,
      'Because it keeps the distances integers',
      'Because it makes the graph satisfy the triangle inequality',
      'Because it keeps the construction polynomial'];
    return {
      topic: 'approx · unapproximability',
      kind: 'choice',
      prompt: 'Why does the construction use <strong>nR + 1</strong> for non-edges, rather than some ' +
        'fixed large constant?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'The argument starts by <em>assuming</em> a ratio R, then builds a penalty bigger than ' +
        'R can absorb. A fixed constant would only rule out approximations better than that constant. ' +
        'Because nR+1 is built after R is fixed, the conclusion is the much stronger one: ' +
        '<strong>no R-approximation exists for any R at all</strong>.',
    };
  } });

  /* ---- Reconnecting a 2-opt swap ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var right = 'Two disjoint cycles, not a tour';
    var choices = [right, 'A shorter tour', 'The same tour', 'A tour that misses a vertex'];
    return {
      topic: 'approx · 2OPT',
      kind: 'choice',
      prompt: 'Removing two edges from a tour leaves two paths. If you rejoin <strong>each ' +
        'path&rsquo;s own two ends</strong>, what do you get?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Closing each path on itself gives two separate cycles — every vertex is still ' +
        'covered, but it is not a single Hamiltonian cycle. You have to join each path to the ' +
        '<em>other</em> one. This is what the slides&rsquo; Step 4, &ldquo;make sure the swap does ' +
        'not disconnect the graph&rdquo;, is about; stated as a tour operation it is simply ' +
        '&ldquo;reverse the segment between the two removed edges&rdquo;.',
    };
  } });

  /* ---- 2OPT on a real instance, marked by running it ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var which = qzPick(['square', 'cross', 'line']);
    var g = tspParse(TSP_PRESETS[which]);
    if (!g.ok) throw new Error('retry');
    var b = tspBrute(g);
    if (!b.ok) throw new Error('retry');
    return {
      topic: 'approx · TSP',
      prompt: 'For the points <code>' + esc(g.vertices.map(function (v) {
        return v + '(' + g.pts[v][0] + ',' + g.pts[v][1] + ')';
      }).join(' ')) + '</code>, what is the length of the shortest tour, to 2 decimal places?',
      placeholder: 'e.g. 14.00',
      answer: b.length.toFixed(2),
      check: apNum(b.length, 0.011),
      explain: 'Brute force over all ' + b.searched + ' tours gives <strong>' + b.length.toFixed(4) +
        '</strong>, achieved by ' + b.tour.join(' → ') + ' → ' + b.tour[0] + '. 2OPT on this ' +
        'instance returns ' + tspTwoOpt(g).length.toFixed(4) + '.',
    };
  } });

  /* ---- Is this instance metric? ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var useMetric = Math.random() < 0.5;
    var g = tspParse(TSP_PRESETS[useMetric ? qzPick(['lecture', 'cross', 'square']) : 'nonmetric']);
    if (!g.ok) throw new Error('retry');
    if (g.metric.ok !== useMetric) throw new Error('retry');
    var yes = 'Yes — the triangle inequality holds';
    var no = 'No — some direct distance exceeds a detour';
    return {
      topic: 'approx · metric TSP',
      kind: 'choice',
      prompt: 'Does this instance satisfy the triangle inequality, so that the 2-approximation ' +
        'guarantee applies? <code>' + esc(g.mode === 'points'
          ? g.vertices.map(function (v) { return v + '(' + g.pts[v][0] + ',' + g.pts[v][1] + ')'; }).join(' ')
          : Object.keys(g.explicit).map(function (k) { return k.replace(' ', '–') + ':' + g.explicit[k]; }).join(' ')) +
        '</code>',
      choices: [yes, no],
      answer: g.metric.ok ? yes : no,
      check: textCheck(g.metric.ok ? yes : no),
      explain: g.metric.ok
        ? 'Yes. These are points in the plane, and Euclidean distance always satisfies the triangle ' +
          'inequality — so this is metric TSP and the ratio 2 applies.'
        : 'No: ' + esc(g.metric.worst.x) + '→' + esc(g.metric.worst.z) + ' costs ' +
          g.metric.worst.direct + ' directly but only ' + g.metric.worst.via + ' going via ' +
          esc(g.metric.worst.y) + '. With no triangle inequality the 2-approximation proof collapses, ' +
          'and general TSP is unapproximable.',
    };
  } });

  /* ---- Christofides ---- */
  QZ_GEN.push({ topic: 'approx', make: function () {
    var right = '3/2';
    var choices = [right, '2', '5/4', '1'];
    return {
      topic: 'approx · Christofides',
      kind: 'choice',
      prompt: 'What approximation ratio does Christofides&rsquo; 1976 algorithm achieve for metric TSP?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Christofides improves on 2OPT&rsquo;s ratio of 2 by adding a minimum-weight perfect ' +
        'matching on the odd-degree vertices of the MST, giving an Eulerian multigraph to shortcut. ' +
        'It is still about <strong>metric</strong> TSP — nothing helps in the general case, which is ' +
        'unapproximable.',
    };
  } });
