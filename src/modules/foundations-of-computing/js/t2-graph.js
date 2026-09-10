  /* ============================================================
     CLIQUES AND HAMILTONIAN CYCLES (Topic 02)

     Both problems in this file are NP-complete, and both are stated
     the same way: *does this graph contain a certain shape?*

         CLIQUE       — k vertices, every pair joined
         HAMILTONIAN  — a cycle visiting every vertex exactly once

     The same argument is made for both. Searching is
     expensive — (n choose k) subsets for CLIQUE, n! permutations for
     HAMILTONIAN — but *checking* a candidate is cheap: k² edges for a
     clique, n edges for a cycle. That gap is the entire content of
     NP, so the tools built on this file always report both numbers:
     how long the search took, and how little the check took.

     A word about the negative answers. Proving that a graph has *no*
     Hamiltonian cycle is the hard direction, and "the search failed"
     is a weak thing to show a reader. Two of the reasons are cheap
     enough to give properly, and gphWhyNoCycle finds them:

       — a vertex of degree < 2 cannot lie on any cycle;
       — a bipartite graph with unequal sides has no Hamiltonian
         cycle at all, because a cycle in a bipartite graph must
         alternate sides and so uses equally many from each.

     The second is worth knowing: it is a complete proof you can
     write in one line, and it is exactly why the standard small
     counterexamples are built the way they are.
     ============================================================ */

  /* ---------- generic clique search, shared with the reduction ---------- */

  /**
   * Find a clique of exactly k vertices, or null.
   *
   * Backtracking, with the one prune that matters: if what is chosen
   * plus what remains available cannot reach k, give up on this branch.
   * `steps` counts the calls, so the cost is reported rather than
   * described.
   */
  function cqFind(adj, n, k) {
    var steps = 0, found = null;

    function extend(chosen, cands) {
      if (found) return;
      steps++;
      if (chosen.length === k) { found = chosen.slice(); return; }
      if (chosen.length + cands.length < k) return;
      for (var i = 0; i < cands.length; i++) {
        var v = cands[i], next = [];
        for (var j = i + 1; j < cands.length; j++) if (adj[v][cands[j]]) next.push(cands[j]);
        chosen.push(v);
        extend(chosen, next);
        chosen.pop();
        if (found) return;
      }
    }

    var all = [];
    for (var i = 0; i < n; i++) all.push(i);
    if (k >= 0 && k <= n) extend([], all);
    return { clique: found, steps: steps };
  }

  /** The largest clique in the graph. */
  function cqMax(adj, n) {
    var best = [], steps = 0;

    function extend(chosen, cands) {
      steps++;
      if (chosen.length > best.length) best = chosen.slice();
      if (chosen.length + cands.length <= best.length) return;
      for (var i = 0; i < cands.length; i++) {
        var v = cands[i], next = [];
        for (var j = i + 1; j < cands.length; j++) if (adj[v][cands[j]]) next.push(cands[j]);
        chosen.push(v);
        extend(chosen, next);
        chosen.pop();
      }
    }

    var all = [];
    for (var i = 0; i < n; i++) all.push(i);
    extend([], all);
    return { clique: best, steps: steps };
  }

  /** Verify a claimed clique. The cheap half of the problem. */
  function cqIs(adj, set) {
    for (var i = 0; i < set.length; i++) {
      for (var j = i + 1; j < set.length; j++) {
        if (set[i] === set[j]) return false;
        if (!adj[set[i]][set[j]]) return false;
      }
    }
    return true;
  }

  /* ---------- graphs ---------- */

  /**
   * Parse an undirected graph from an edge list.
   *
   *   a b            an edge
   *   a b, b c       several on a line
   *   isolated: z    vertices with no edges, if you want them
   *
   * Anything after a # is ignored. Vertex names are whatever you type.
   *
   * @returns {{ok: true, g} | {ok: false, error: string}}
   */
  function gphParse(text) {
    var lines = String(text).split(/\n/);
    var names = [], pairs = [];

    function id(nm) {
      var i = names.indexOf(nm);
      if (i < 0) { names.push(nm); i = names.length - 1; }
      return i;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/#.*$/, '').trim();
      if (!line) continue;

      var iso = line.match(/^isolated\s*:\s*(.*)$/i);
      if (iso) {
        var solo = iso[1].trim().split(/[\s,]+/).filter(Boolean);
        for (var s = 0; s < solo.length; s++) id(solo[s]);
        continue;
      }

      var groups = line.split(',');
      for (var gI = 0; gI < groups.length; gI++) {
        var parts = groups[gI].trim().split(/[\s]+/).filter(Boolean);
        if (!parts.length) continue;
        if (parts.length !== 2) {
          return { ok: false, error: 'Line ' + (i + 1) + ': an edge is two vertex names, ' +
            'but this has ' + parts.length + ' — <code>' + esc(groups[gI].trim()) + '</code>.' };
        }
        if (parts[0] === parts[1]) {
          return { ok: false, error: 'Line ' + (i + 1) + ': <code>' + esc(parts[0]) +
            '</code> joined to itself. Loops are not allowed here.' };
        }
        pairs.push([id(parts[0]), id(parts[1])]);
      }
    }

    if (!names.length) return { ok: false, error: 'No vertices yet. Add an edge, like <code>a b</code>.' };
    return { ok: true, g: gphMake(names, pairs) };
  }

  /** Build the graph record from names and index pairs, dropping duplicates. */
  function gphMake(names, pairs) {
    var n = names.length, adj = [], edges = [];
    for (var i = 0; i < n; i++) adj.push(new Array(n).fill(false));
    for (var p = 0; p < pairs.length; p++) {
      var a = pairs[p][0], b = pairs[p][1];
      if (a === b || adj[a][b]) continue;
      adj[a][b] = adj[b][a] = true;
      edges.push([a, b]);
    }
    var deg = [];
    for (var v = 0; v < n; v++) {
      var d = 0;
      for (var w = 0; w < n; w++) if (adj[v][w]) d++;
      deg.push(d);
    }
    return { names: names, n: n, adj: adj, edges: edges, deg: deg };
  }

  /** Neighbours of v, as indices. */
  function gphNbrs(g, v) {
    var out = [];
    for (var w = 0; w < g.n; w++) if (g.adj[v][w]) out.push(w);
    return out;
  }

  function gphConnected(g) {
    if (!g.n) return true;
    var seen = new Array(g.n).fill(false), stack = [0], count = 0;
    seen[0] = true;
    while (stack.length) {
      var v = stack.pop(); count++;
      var nb = gphNbrs(g, v);
      for (var i = 0; i < nb.length; i++) if (!seen[nb[i]]) { seen[nb[i]] = true; stack.push(nb[i]); }
    }
    return count === g.n;
  }

  /**
   * Two-colour the graph.
   *
   * @returns {{ok: true, colour: number[], sizes: [number, number]}
   *          | {ok: false, oddCycle: true}}
   */
  function gphBipartite(g) {
    var colour = new Array(g.n).fill(-1);
    for (var s = 0; s < g.n; s++) {
      if (colour[s] >= 0) continue;
      colour[s] = 0;
      var queue = [s];
      while (queue.length) {
        var v = queue.shift(), nb = gphNbrs(g, v);
        for (var i = 0; i < nb.length; i++) {
          var w = nb[i];
          if (colour[w] < 0) { colour[w] = 1 - colour[v]; queue.push(w); }
          else if (colour[w] === colour[v]) return { ok: false, oddCycle: true };
        }
      }
    }
    var a = 0, b = 0;
    for (var k = 0; k < g.n; k++) (colour[k] === 0 ? a++ : b++);
    return { ok: true, colour: colour, sizes: [a, b] };
  }

  /* ---------- Hamiltonian cycles ---------- */

  /**
   * Search for a Hamiltonian cycle.
   *
   * Every Hamiltonian cycle passes through every vertex, so the search
   * may start at vertex 0 without loss of generality — which divides
   * the work by n before it begins.
   *
   * Two prunes beyond that: a vertex not yet visited and now having
   * fewer than two usable neighbours can never be entered and left
   * again, and the path must be able to get home. Even so this is
   * exponential, and `steps` says so out loud.
   *
   * @returns {{cycle: number[]|null, steps: number, capped: boolean}}
   */
  function gphHamCycle(g, limit) {
    var cap = limit || 400000;
    if (g.n < 3) return { cycle: null, steps: 0, capped: false };

    var visited = new Array(g.n).fill(false);
    var path = [0], steps = 0, capped = false, found = null;
    visited[0] = true;

    function feasible() {
      // Any unvisited vertex needs two available ends to be passed through.
      for (var v = 0; v < g.n; v++) {
        if (visited[v]) continue;
        var free = 0, nb = gphNbrs(g, v);
        for (var i = 0; i < nb.length; i++) {
          var w = nb[i];
          if (!visited[w] || w === 0 || w === path[path.length - 1]) free++;
        }
        if (free < 2) return false;
      }
      return true;
    }

    function go() {
      if (found || capped) return;
      if (++steps > cap) { capped = true; return; }

      if (path.length === g.n) {
        if (g.adj[path[path.length - 1]][0]) found = path.slice();
        return;
      }
      if (!feasible()) return;

      var nb = gphNbrs(g, path[path.length - 1]);
      for (var i = 0; i < nb.length; i++) {
        var w = nb[i];
        if (visited[w]) continue;
        visited[w] = true; path.push(w);
        go();
        path.pop(); visited[w] = false;
        if (found || capped) return;
      }
    }

    go();
    return { cycle: found, steps: steps, capped: capped };
  }

  /** The same search without the closing edge: a path, not a cycle. */
  function gphHamPath(g, limit) {
    var cap = limit || 400000;
    var steps = 0, capped = false, found = null;

    function from(start) {
      var visited = new Array(g.n).fill(false), path = [start];
      visited[start] = true;

      function go() {
        if (found || capped) return;
        if (++steps > cap) { capped = true; return; }
        if (path.length === g.n) { found = path.slice(); return; }
        var nb = gphNbrs(g, path[path.length - 1]);
        for (var i = 0; i < nb.length; i++) {
          var w = nb[i];
          if (visited[w]) continue;
          visited[w] = true; path.push(w);
          go();
          path.pop(); visited[w] = false;
          if (found || capped) return;
        }
      }
      go();
    }

    for (var s = 0; s < g.n && !found && !capped; s++) from(s);
    return { path: found, steps: steps, capped: capped };
  }

  /** Verify a claimed Hamiltonian cycle. The cheap half: n edge lookups. */
  function gphIsCycle(g, cycle) {
    if (!cycle || cycle.length !== g.n) return false;
    var seen = new Array(g.n).fill(false);
    for (var i = 0; i < cycle.length; i++) {
      if (seen[cycle[i]]) return false;
      seen[cycle[i]] = true;
    }
    for (var j = 0; j < cycle.length; j++) {
      if (!g.adj[cycle[j]][cycle[(j + 1) % cycle.length]]) return false;
    }
    return true;
  }

  /**
   * A reason there can be no Hamiltonian cycle, when one is cheap to find.
   *
   * These are proofs, not search results, and they are worth far more
   * to a reader than "nothing was found" — so they are looked for
   * before the search runs, not after it fails.
   *
   * @returns {{why: string, proof: string}|null}
   */
  function gphWhyNoCycle(g) {
    if (g.n < 3) {
      return { why: 'too small', proof: 'A cycle needs at least three vertices.' };
    }
    if (!gphConnected(g)) {
      return { why: 'not connected',
        proof: 'The graph falls into separate pieces, and a single cycle cannot visit two of them.' };
    }
    for (var v = 0; v < g.n; v++) {
      if (g.deg[v] < 2) {
        return { why: 'a vertex of degree ' + g.deg[v],
          proof: 'A cycle enters and leaves every vertex it visits, so it needs two distinct edges there. ' +
                 '<strong>' + esc(g.names[v]) + '</strong> has ' + g.deg[v] + '.' };
      }
    }
    var bip = gphBipartite(g);
    if (bip.ok && bip.sizes[0] !== bip.sizes[1]) {
      return { why: 'unequal sides',
        proof: 'The graph is bipartite with sides of ' + bip.sizes[0] + ' and ' + bip.sizes[1] +
               ' vertices. A cycle in a bipartite graph alternates between the sides, so it uses ' +
               'equally many from each — which a Hamiltonian cycle here cannot do, since ' +
               bip.sizes[0] + ' ≠ ' + bip.sizes[1] + '.' };
    }
    return null;                                    // no cheap reason; the search must decide
  }

  /* ---------- named graphs ---------- */

  /**
   * The generalised Petersen graph GP(n, k): an outer n-cycle, an inner
   * set of n vertices joined in steps of k, and a spoke between them.
   *
   * Two of its members do the work here. GP(10,2) is the dodecahedron,
   * the graph of Hamilton's own puzzle — it has a cycle. GP(5,2) is the
   * Petersen graph, which has no Hamiltonian cycle but does have a
   * Hamiltonian path, and no short argument explains why.
   */
  function gphPetersen(n, k) {
    var names = [], pairs = [];
    for (var i = 0; i < n; i++) names.push('u' + i);
    for (var j = 0; j < n; j++) names.push('v' + j);
    for (var a = 0; a < n; a++) {
      pairs.push([a, (a + 1) % n]);                 // outer cycle
      pairs.push([a, n + a]);                       // spoke
      pairs.push([n + a, n + ((a + k) % n)]);       // inner step-k
    }
    return gphMake(names, pairs);
  }

  /** The complete graph on n vertices: one big clique, obviously cyclic. */
  function gphComplete(n) {
    var names = [], pairs = [];
    for (var i = 0; i < n; i++) names.push(String.fromCharCode(97 + i));
    for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) pairs.push([a, b]);
    return gphMake(names, pairs);
  }

  /** Complete bipartite K(a,b) — unequal sides make the parity argument bite. */
  function gphBiclique(a, b) {
    var names = [], pairs = [];
    for (var i = 0; i < a; i++) names.push('x' + (i + 1));
    for (var j = 0; j < b; j++) names.push('y' + (j + 1));
    for (var p = 0; p < a; p++) for (var q = 0; q < b; q++) pairs.push([p, a + q]);
    return gphMake(names, pairs);
  }

  /** Write a graph back out in the edge-list format the parser reads. */
  function gphText(g) {
    var lines = [];
    for (var i = 0; i < g.edges.length; i++) {
      lines.push(g.names[g.edges[i][0]] + ' ' + g.names[g.edges[i][1]]);
    }
    return lines.join('\n');
  }

  /* ---------- rendering ---------- */

  var GPH_PRESETS = {
    dodeca:  { label: 'Dodecahedron — Hamilton’s own puzzle', build: function () { return gphPetersen(10, 2); } },
    petersen:{ label: 'Petersen graph — no cycle, and no easy reason', build: function () { return gphPetersen(5, 2); } },
    k34:     { label: 'K(3,4) — no cycle, for a reason you can prove', build: function () { return gphBiclique(3, 4); } },
    k33:     { label: 'K(3,3) — equal sides, so the argument fails', build: function () { return gphBiclique(3, 3); } },
    k5:      { label: 'K5 — everything joined to everything', build: function () { return gphComplete(5); } },
    k6:      { label: 'K6 — a clique of six', build: function () { return gphComplete(6); } },
  };

  function gpPreset(key) {
    var p = GPH_PRESETS[key];
    if (!p) return;
    var box = document.getElementById('gp-graph');
    if (box) box.value = gphText(p.build());
    runGraph();
  }

  /** Adjacency in the shape IX.layout wants. */
  function gphForLayout(g) {
    var adj = {};
    for (var v = 0; v < g.n; v++) {
      adj[g.names[v]] = gphNbrs(g, v).map(function (w) { return { to: g.names[w] }; });
    }
    return adj;
  }

  function gphSvg(g, clique, cycle) {
    var W = 720, H = 430;
    var pos = IX.layout(g.names, gphForLayout(g), W, H);

    var inClique = {};
    (clique || []).forEach(function (i) { inClique[i] = true; });

    /* which edges the cycle uses */
    var onCycle = {};
    if (cycle) {
      for (var i = 0; i < cycle.length; i++) {
        var a = cycle[i], b = cycle[(i + 1) % cycle.length];
        onCycle[Math.min(a, b) + ':' + Math.max(a, b)] = true;
      }
    }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-height:450px;" ' +
            'role="img" aria-label="The graph, with any clique or Hamiltonian cycle marked">';

    for (var e = 0; e < g.edges.length; e++) {
      var u = g.edges[e][0], v = g.edges[e][1];
      var pu = pos[g.names[u]], pv = pos[g.names[v]];
      var hot = onCycle[Math.min(u, v) + ':' + Math.max(u, v)];
      var cliqueEdge = inClique[u] && inClique[v];
      s += '<line x1="' + pu.x.toFixed(1) + '" y1="' + pu.y.toFixed(1) +
           '" x2="' + pv.x.toFixed(1) + '" y2="' + pv.y.toFixed(1) + '" stroke="' +
           (hot ? 'var(--accent-3)' : cliqueEdge ? 'var(--accent-2)' : 'var(--rule)') +
           '" stroke-width="' + (hot ? 3.5 : cliqueEdge ? 3 : 1.2) +
           '" opacity="' + (hot || cliqueEdge ? '1' : '0.6') + '" stroke-linecap="round"/>';
    }

    for (var n = 0; n < g.n; n++) {
      var pt = pos[g.names[n]];
      s += '<circle cx="' + pt.x.toFixed(1) + '" cy="' + pt.y.toFixed(1) + '" r="' +
           (inClique[n] ? 16 : 13) + '" fill="var(--surface)" stroke="' +
           (inClique[n] ? 'var(--accent-2)' : 'var(--accent)') + '" stroke-width="' +
           (inClique[n] ? 3 : 1.6) + '"/>';
      s += '<text x="' + pt.x.toFixed(1) + '" y="' + pt.y.toFixed(1) + '" text-anchor="middle" ' +
           'dominant-baseline="central" font-size="10" font-family="IBM Plex Mono, monospace" ' +
           'fill="var(--ink)">' + esc(g.names[n]) + '</text>';
    }

    return s + '</svg>';
  }

  function runGraph() {
    var out = document.getElementById('gp-output');
    if (!out) return;

    var src = ((document.getElementById('gp-graph') || {}).value || '').trim();
    var parsed = gphParse(src);
    if (!parsed.ok) { out.innerHTML = '<div class="tool-error">' + parsed.error + '</div>'; return; }
    var g = parsed.g;

    if (g.n > 30) {
      out.innerHTML = '<div class="tool-error">' + g.n + ' vertices is more than this will search. ' +
        'Thirty is the limit — which is itself worth noticing, given that the check is instant.</div>';
      return;
    }

    var want = parseInt(((document.getElementById('gp-k') || {}).value), 10);
    if (!isFinite(want) || want < 2) want = 3;

    var best = cqMax(g.adj, g.n);
    var asked = cqFind(g.adj, g.n, want);

    var reason = gphWhyNoCycle(g);
    var cyc = reason ? { cycle: null, steps: 0, capped: false } : gphHamCycle(g);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + g.n + ' vertices</span>' +
      '<span class="stat-pill a">' + g.edges.length + ' edges</span>' +
      '<span class="stat-pill dark">degrees ' + Math.min.apply(null, g.deg) + '–' +
        Math.max.apply(null, g.deg) + '</span>' +
      '</div>';

    h += gphSvg(g, best.clique, cyc.cycle);

    h += '<div class="gp-legend">' +
      '<span class="gp-key gp-key-clique"></span> largest clique &nbsp;&nbsp;' +
      '<span class="gp-key gp-key-cycle"></span> Hamiltonian cycle</div>';

    /* ---- CLIQUE ---- */
    h += '<div class="gp-block"><div class="gp-block-head">CLIQUE</div>';
    h += '<div class="verdict ' + (asked.clique ? 'safe' : 'warn') + '">' +
      (asked.clique
        ? 'There IS a clique of size ' + want + ': ' +
          asked.clique.map(function (i) { return esc(g.names[i]); }).join(', ')
        : 'There is NO clique of size ' + want) + '</div>';
    h += '<p class="tool-note">The largest clique here has <strong>' + best.clique.length +
      '</strong> vertices: ' + best.clique.map(function (i) { return esc(g.names[i]); }).join(', ') +
      '. Found in ' + best.steps + ' search steps; verifying it takes ' +
      (best.clique.length * (best.clique.length - 1) / 2) + ' edge lookups.</p>';
    h += '</div>';

    /* ---- HAMILTONIAN ---- */
    h += '<div class="gp-block"><div class="gp-block-head">HAMILTONIAN CYCLE</div>';

    if (reason) {
      h += '<div class="verdict bad">No Hamiltonian cycle — and here the search never had to run</div>';
      h += '<div class="gp-proof"><div class="gp-proof-label">Why, in one line</div>' + reason.proof + '</div>';
    } else if (cyc.capped) {
      h += '<div class="verdict warn">Gave up after ' + cyc.steps +
        ' search steps without an answer. This is not "no" — it is the exponential blow-up, ' +
        'showing up on a graph small enough to draw.</div>';
    } else if (cyc.cycle) {
      h += '<div class="verdict safe">Found one: ' +
        cyc.cycle.map(function (i) { return esc(g.names[i]); }).join(' → ') +
        ' → ' + esc(g.names[cyc.cycle[0]]) + '</div>';
      h += '<p class="tool-note">' + (gphIsCycle(g, cyc.cycle)
        ? '✓ Checked: all ' + g.n + ' vertices appear once, and every consecutive pair is an edge.'
        : '✗ The cycle does not verify — a bug.') +
        ' The search took <strong>' + cyc.steps + '</strong> steps; the check took <strong>' + g.n +
        '</strong> edge lookups. Finding is the hard half.</p>';
    } else {
      h += '<div class="verdict bad">No Hamiltonian cycle exists</div>';
      h += '<p class="tool-note">The search ran to exhaustion in <strong>' + cyc.steps +
        '</strong> steps, so this is a definite no — but it is a no with no short explanation behind it. ' +
        'Unlike the answer above, there is nothing here you could write down and check quickly. ' +
        'That asymmetry is why NP is defined the way it is.</p>';
      var pth = gphHamPath(g);
      if (pth.path) {
        h += '<p class="tool-note">It does have a Hamiltonian <em>path</em>: ' +
          pth.path.map(function (i) { return esc(g.names[i]); }).join(' → ') +
          '. Every vertex once — it just cannot get home.</p>';
      }
    }
    h += '</div>';

    out.innerHTML = h;
  }
