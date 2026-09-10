  /* ============================================================
     TOPIC 07 · the Travelling Salesman Problem and 2OPT
     ------------------------------------------------------------
     Two ways to give an instance, because the topic needs both:

       points     A 1 0        Euclidean, and therefore metric --
                               the triangle inequality holds for
                               free, which is what the 2-approx-
                               imation proof quietly relies on.
       distances  A B 5        an explicit matrix, which may
                               violate the triangle inequality --
                               and that is where TSP becomes
                               unapproximable.

     Keeping both available is the point. "TSP is 2-approximable"
     and "TSP is unapproximable" are both standard claims, and
     they are only consistent because the first silently assumes the
     triangle inequality and the second explicitly drops it.
     ============================================================ */

  function tspParse(text) {
    var lines = String(text || '').split(/\n+/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s && s.charAt(0) !== '#'; });
    if (!lines.length) return { ok: false, error: 'No vertices. Try a line like <code>A 1 0</code>.' };

    var pts = {}, order = [], explicit = {}, mode = null;

    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split(/[\s,]+/).filter(function (s) { return s; });

      // "A 1 0" -- a point
      var asPoint = parts.length === 3 && /^[A-Za-z][A-Za-z0-9_]*$/.test(parts[0]) &&
        isFinite(parts[1]) && isFinite(parts[2]);
      // "A B 5" -- an explicit distance
      var asDist = parts.length === 3 && /^[A-Za-z][A-Za-z0-9_]*$/.test(parts[0]) &&
        /^[A-Za-z][A-Za-z0-9_]*$/.test(parts[1]) && isFinite(parts[2]);

      if (asDist && !asPoint) {
        if (mode === 'points') return { ok: false, error: 'Mixing coordinates and distances. Use one or the other.' };
        mode = 'dist';
        var a = parts[0], b = parts[1], w = parseFloat(parts[2]);
        if (a === b) return { ok: false, error: 'A vertex cannot have a distance to itself.' };
        if (w < 0) return { ok: false, error: 'Negative distance ' + esc(lines[i]) + '.' };
        [a, b].forEach(function (v) { if (order.indexOf(v) < 0) order.push(v); });
        explicit[[a, b].sort().join(' ')] = w;
      } else if (asPoint) {
        if (mode === 'dist') return { ok: false, error: 'Mixing coordinates and distances. Use one or the other.' };
        mode = 'points';
        if (pts[parts[0]]) return { ok: false, error: 'Vertex ' + esc(parts[0]) + ' given twice.' };
        pts[parts[0]] = [parseFloat(parts[1]), parseFloat(parts[2])];
        order.push(parts[0]);
      } else {
        return { ok: false, error: 'Cannot read "' + esc(lines[i]) + '". Write either a point ' +
                 '<code>A 1 0</code> or a distance <code>A B 5</code>.' };
      }
    }

    order.sort();
    if (order.length < 3) return { ok: false, error: 'A tour needs at least 3 vertices.' };

    // Complete the matrix, and refuse an incomplete explicit one:
    // TSP is defined on a COMPLETE graph.
    var missing = [];
    if (mode === 'dist') {
      for (var a = 0; a < order.length; a++) {
        for (var b = a + 1; b < order.length; b++) {
          if (explicit[[order[a], order[b]].sort().join(' ')] === undefined) {
            missing.push(order[a] + '–' + order[b]);
          }
        }
      }
      if (missing.length) {
        return { ok: false, error: 'TSP needs a <strong>complete</strong> weighted graph, but ' +
                 missing.length + ' pair' + (missing.length === 1 ? ' is' : 's are') +
                 ' missing: ' + esc(missing.slice(0, 6).join(', ')) +
                 (missing.length > 6 ? ' …' : '') + '.' };
      }
    }

    var g = {
      ok: true, mode: mode, vertices: order, n: order.length, pts: pts, explicit: explicit,
      d: function (x, y) {
        if (x === y) return 0;
        if (mode === 'points') {
          var p = pts[x], q = pts[y];
          return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]));
        }
        return explicit[[x, y].sort().join(' ')];
      }
    };
    g.metric = tspMetric(g);
    return g;
  }

  /** Does d satisfy the triangle inequality? Reported with a
      witness, because "it fails" is not an answer you can use. */
  function tspMetric(g) {
    var V = g.vertices, worst = null;
    for (var i = 0; i < V.length; i++) {
      for (var j = 0; j < V.length; j++) {
        for (var k = 0; k < V.length; k++) {
          if (i === j || j === k || i === k) continue;
          var direct = g.d(V[i], V[k]), via = g.d(V[i], V[j]) + g.d(V[j], V[k]);
          if (direct > via + 1e-12) {
            var excess = direct - via;
            if (!worst || excess > worst.excess) {
              worst = { x: V[i], y: V[j], z: V[k], direct: direct, via: via, excess: excess };
            }
          }
        }
      }
    }
    return { ok: !worst, worst: worst };
  }

  function tspLen(g, tour) {
    var s = 0;
    for (var i = 0; i < tour.length; i++) s += g.d(tour[i], tour[(i + 1) % tour.length]);
    return s;
  }

  /** Every tour, for instances small enough. The oracle the
      approximation is measured against. */
  function tspBrute(g, cap) {
    cap = cap || 200000;
    var V = g.vertices, n = V.length;
    // (n-1)! tours with the start fixed; each counted twice.
    var total = 1;
    for (var i = 2; i < n; i++) total *= i;
    if (total > cap) return { ok: false, error: 'Too many tours to enumerate (' + n + ' vertices).' };

    var best = Infinity, bestTour = null, count = 0;
    var rest = V.slice(1);
    (function perm(left, acc) {
      if (!left.length) {
        count++;
        var t = [V[0]].concat(acc), L = tspLen(g, t);
        if (L < best - 1e-12) { best = L; bestTour = t; }
        return;
      }
      for (var i = 0; i < left.length; i++) {
        perm(left.slice(0, i).concat(left.slice(i + 1)), acc.concat([left[i]]));
      }
    })(rest, []);

    return { ok: true, length: best, tour: bestTour, searched: count };
  }

  /* ---------- Step 1 of 2OPT: the minimum spanning tree ---------- */

  function tspMst(g) {
    var V = g.vertices, edges = [];
    for (var i = 0; i < V.length; i++) {
      for (var j = i + 1; j < V.length; j++) edges.push({ u: V[i], v: V[j], w: g.d(V[i], V[j]) });
    }
    edges = mstSortEdges(edges);                  // Topic 4's tie-break
    var ds = dsMake(V), tree = [];
    edges.forEach(function (e) { if (ds.union(e.u, e.v)) tree.push(e); });
    return { ok: true, tree: tree, weight: mstWeight(tree) };
  }

  /** Preorder traversal of the tree, rooted at the alphabetically
      first vertex, children in alphabetical order. */
  function tspPreorder(g, tree, root) {
    var adj = {};
    g.vertices.forEach(function (v) { adj[v] = []; });
    tree.forEach(function (e) { adj[e.u].push(e.v); adj[e.v].push(e.u); });
    g.vertices.forEach(function (v) { adj[v].sort(); });

    var seen = {}, out = [];
    (function go(u) {
      seen[u] = true; out.push(u);
      adj[u].forEach(function (w) { if (!seen[w]) go(w); });
    })(root || g.vertices[0]);
    return out;
  }

  /* ---------- The 2OPT swap move ----------

     The labelling is worth getting right, because the
     wrong reconnection silently splits the tour into two cycles --
     which is exactly what its Step 4 is warning about.

     Going round the tour you meet   x … u   v … y   and back to x,
     so the two removed edges are (u,v) and (y,x), leaving the paths
     x…u and v…y. Their four ends are x, u, v, y.

       (x,v) + (u,y)  joins each path to the OTHER one   -> one cycle
       (x,u) + (v,y)  joins each path to ITSELF          -> two cycles

     In tour terms the good move is "reverse the segment between the
     two removed edges", which is what the code does. */

  function tspReverse(tour, i, j) {
    // Reverse tour[i+1 .. j] -- the standard 2-opt move.
    return tour.slice(0, i + 1).concat(tour.slice(i + 1, j + 1).reverse(), tour.slice(j + 1));
  }

  /** Both ways of reconnecting after removing two edges, so a tool
      can show why only one of them is a tour. */
  function tspReconnect(tour, i, j) {
    var n = tour.length;
    var x = tour[i], y = tour[(i + 1) % n], u = tour[j], v = tour[(j + 1) % n];
    var good = tspReverse(tour, i, j);

    // The other pairing closes each path on itself: report the two
    // cycles it produces rather than pretending it is a tour.
    var pathA = tour.slice(i + 1, j + 1);            // y … u
    var pathB = tour.slice(j + 1).concat(tour.slice(0, i + 1));   // v … x

    return {
      removed: [{ u: x, v: y }, { u: u, v: v }],
      x: x, y: y, u: u, v: v,
      good: { added: [{ u: x, v: u }, { u: y, v: v }], tour: good },
      bad: { added: [{ u: y, v: u }, { u: v, v: x }], cycles: [pathA, pathB] }
    };
  }

  /** One SWAP-MOVE.

      The standard pseudocode returns as soon as it finds an
      improving pair ("first"), but its worked example takes the
      biggest available gain each round ("best") -- that is what
      produces its H0 -> H1 -> H2 in exactly two swaps rather than
      the six that first-improvement needs. Both are legitimate
      2-opt; they land on the same local optimum here but need not
      in general, so it is a knob rather than a silent choice. */
  function tspSwapMove(g, tour, pick) {
    var n = tour.length, cur = tspLen(g, tour), best = null;

    for (var i = 0; i < n - 1; i++) {
      for (var j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;         // adjacent in the cycle
        var x = tour[i], y = tour[i + 1], u = tour[j], v = tour[(j + 1) % n];
        var before = g.d(x, y) + g.d(u, v);
        var after = g.d(x, u) + g.d(y, v);
        if (after >= before - 1e-12) continue;

        var cand = { found: true, i: i, j: j, x: x, y: y, u: u, v: v,
                     before: before, after: after, gain: before - after, was: cur };
        if (pick === 'first') {
          cand.tour = tspReverse(tour, i, j);
          cand.length = tspLen(g, cand.tour);
          return cand;
        }
        if (!best || cand.gain > best.gain + 1e-12) best = cand;
      }
    }

    if (!best) return { found: false, tour: tour, length: cur, was: cur };
    best.tour = tspReverse(tour, best.i, best.j);
    best.length = tspLen(g, best.tour);
    return best;
  }

  /** The whole algorithm: MST, preorder, then swap to a local
      optimum -- recording every stage. */
  function tspTwoOpt(g, opts) {
    opts = opts || {};
    var cap = opts.cap || 500;
    var pick = opts.pick || 'best';        // reproduces the worked trace
    var mst = tspMst(g);
    var start = opts.start || tspPreorder(g, mst.tree, g.vertices[0]);

    var steps = [], tour = start.slice();
    steps.push({ n: 0, tour: tour.slice(), length: tspLen(g, tour), move: null,
                 note: 'Preorder traversal of the minimum spanning tree: ' + tour.join(', ') +
                       ', ' + tour[0] + '. Length ' + tspLen(g, tour).toFixed(4) + '.' });

    for (var k = 1; k <= cap; k++) {
      var mv = tspSwapMove(g, tour, pick);
      if (!mv.found) {
        steps.push({ n: k, tour: tour.slice(), length: mv.length, move: null, done: true,
                     note: 'No pair of non-adjacent edges can be swapped for a gain — this tour ' +
                           'is 2-opt optimal. Length ' + mv.length.toFixed(4) + '.' });
        break;
      }
      tour = mv.tour;
      steps.push({ n: k, tour: tour.slice(), length: mv.length, move: mv,
                   note: 'Swap (' + mv.x + ',' + mv.y + ') and (' + mv.u + ',' + mv.v + ') for (' +
                         mv.x + ',' + mv.u + ') and (' + mv.y + ',' + mv.v + '): ' +
                         mv.before.toFixed(4) + ' becomes ' + mv.after.toFixed(4) + ', saving ' +
                         mv.gain.toFixed(4) + '. Tour now ' + mv.length.toFixed(4) + '.' });
    }

    return { ok: true, mst: mst, start: start, tour: tour, length: tspLen(g, tour),
             pick: pick, steps: steps, swaps: steps.length - 2 >= 0 ? steps.filter(function (s) { return s.move; }).length : 0 };
  }

  /* ---------- The approximation ratio ---------- */

  /** R_M(w) as usually defined: always at least 1, whichever
      of the two costs is larger. For a MINIMISATION problem the
      approximate cost can never beat the optimum, so in practice
      this is always C_approx / C_global -- but the definition is
      written symmetrically so it also covers maximisation. */
  function tspRatio(approx, optimal) {
    if (!optimal || !approx) return { ok: false, error: 'Costs must be non-zero.' };
    var r = optimal <= approx ? approx / optimal : optimal / approx;
    return { ok: true, ratio: r, approx: approx, optimal: optimal,
             which: optimal <= approx ? 'approx/optimal' : 'optimal/approx' };
  }

  /* ---------- Presets ---------- */

  var TSP_PRESETS = {
    // The worked example, read off the usual grid. The MST,
    // the preorder traversal and the H1/H2 lengths all reproduce.
    worked: 'A 1 0\nB 1 2\nC 0 3\nD 3 0\nE 4 1\nF 3 2\nG 5 2\nH 2 4',
    square: 'A 0 0\nB 0 3\nC 4 3\nD 4 0',
    // Deliberately violates the triangle inequality: A-C is a huge
    // detour compared with going through B.
    nonmetric: 'A B 1\nB C 1\nA C 40\nA D 1\nB D 1\nC D 1',
    cross: 'A 0 0\nB 2 0\nC 2 2\nD 0 2\nE 1 1',
    line: 'A 0 0\nB 1 0\nC 2 0\nD 3 0\nE 4 0\nF 5 0'
  };
