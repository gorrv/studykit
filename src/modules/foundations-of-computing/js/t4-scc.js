  /* ============================================================
     TOPIC 04 · topological sort, strongly connected components
     ------------------------------------------------------------
     The lecture's SCC algorithm calls TOPOLOGICAL-SORT on a graph
     that has cycles, which sounds like nonsense -- a cyclic graph
     has no topological order. It is not nonsense: what the routine
     actually computes is the reverse DFS finishing order, which
     happens to BE a topological order when the graph is acyclic and
     is exactly the right starting order for the second pass when it
     is not. The two uses are separated below (tsSort vs tsFinish)
     so that the tool can say honestly whether the list it returned
     is a topological sort or merely a finishing order.
     ============================================================ */

  /** Reverse DFS finishing order. Always defined, cyclic or not. */
  function tsFinish(g, opts) {
    var run = grDfsAll(g, opts);
    return { ok: true, order: run.finish.slice().reverse(), finish: run.finish,
             roots: run.roots, stamps: run.stamps, back: run.back };
  }

  /** A topological sort, and an honest answer when there isn't one. */
  function tsSort(g, opts) {
    if (!g.directed) {
      return { ok: false, error: 'Topological sorting needs a directed graph — ' +
               'an undirected edge has no upstream end.' };
    }
    var cyc = tsFindCycle(g);
    if (cyc) {
      return { ok: false, cycle: cyc,
               error: 'This graph has a cycle: ' + cyc.join(' → ') + ' → ' + cyc[0] +
                      '. No ordering can put every arrow forwards, because each of these ' +
                      'vertices would have to come before the next and after it.' };
    }
    var f = tsFinish(g, opts);
    return { ok: true, order: f.order, finish: f.finish, roots: f.roots, stamps: f.stamps,
             check: tsCheck(g, f.order) };
  }

  /** Verify an order directly against the definition: every edge must
      point forwards. Independent of how the order was produced. */
  function tsCheck(g, order) {
    var pos = {}, bad = [];
    order.forEach(function (v, i) { pos[v] = i; });
    var missing = g.vertices.filter(function (v) { return pos[v] === undefined; });
    g.edges.forEach(function (e) {
      if (pos[e.u] === undefined || pos[e.v] === undefined) return;
      if (pos[e.u] >= pos[e.v]) bad.push(e);
    });
    return { ok: !bad.length && !missing.length && order.length === g.nV,
             backwards: bad, missing: missing };
  }

  /** A concrete cycle, or null. Reported as a witness rather than as
      a bare "not a DAG", because on an exam you have to name one. */
  function tsFindCycle(g) {
    var state = {}, path = [], found = null;
    function go(u) {
      if (found) return;
      state[u] = 'open'; path.push(u);
      var nbrs = grNbrs(g, u);
      for (var i = 0; i < nbrs.length && !found; i++) {
        var w = nbrs[i];
        if (state[w] === 'open') found = path.slice(path.indexOf(w));
        else if (!state[w]) go(w);
      }
      state[u] = 'done'; path.pop();
    }
    g.vertices.forEach(function (v) { if (!state[v] && !found) go(v); });
    return found;
  }

  function tsIsDag(g) { return g.directed && !tsFindCycle(g); }

  /* ---------- Strongly connected components ---------- */

  /** The lecture's algorithm: finishing order, then DFS on the
      transpose, taking components in that order. */
  function sccFind(g, opts) {
    if (!g.directed) return { ok: false, error: 'Strong connectivity is a property of directed graphs.' };

    var pass1 = tsFinish(g, opts);
    var gt = grTranspose(g);
    var seen = {}, comps = [], steps = [];

    pass1.order.forEach(function (u) {
      if (seen[u]) return;
      // DFS on the transpose, collecting everything reachable.
      var stack = [u], part = [];
      seen[u] = true;
      while (stack.length) {
        var v = stack.pop();
        part.push(v);
        grNbrs(gt, v).forEach(function (w) { if (!seen[w]) { seen[w] = true; stack.push(w); } });
      }
      part.sort();
      comps.push(part);
      steps.push({ root: u, part: part.slice(),
                   note: 'From ' + u + ', DFS on the transpose reaches {' + part.join(', ') +
                         '} — everything that can reach ' + u + ' in the original graph. ' +
                         'Combined with ' + u + ' reaching them, that is one component.' });
    });

    return { ok: true, components: comps, steps: steps, order: pass1.order,
             count: comps.length, transpose: gt };
  }

  /** Check components against the definition -- u ~ v iff each
      reaches the other -- computed by plain reachability, with no
      reference to the algorithm above. Also confirms maximality,
      which is the half students forget: {A} is always "strongly
      connected", it is just not a component unless nothing else
      belongs with it. */
  function sccCheck(g, comps) {
    var reach = {};
    g.vertices.forEach(function (v) { reach[v] = {}; grReach(g, v).forEach(function (w) { reach[v][w] = true; }); });
    function mutual(a, b) { return reach[a][b] && reach[b][a]; }

    var why = [], covered = {};
    comps.forEach(function (c) {
      c.forEach(function (v) {
        if (covered[v]) why.push(v + ' appears in more than one component.');
        covered[v] = true;
      });
      // Every pair inside a component must be mutually reachable.
      for (var i = 0; i < c.length; i++) {
        for (var j = i + 1; j < c.length; j++) {
          if (!mutual(c[i], c[j])) {
            why.push(c[i] + ' and ' + c[j] + ' are in one component but are not mutually reachable.');
          }
        }
      }
      // And nothing outside may belong.
      g.vertices.forEach(function (v) {
        if (c.indexOf(v) >= 0) return;
        if (mutual(v, c[0])) why.push(v + ' is mutually reachable with ' + c[0] +
                                      ' but was left out of its component — not maximal.');
      });
    });
    g.vertices.forEach(function (v) { if (!covered[v]) why.push(v + ' is in no component.'); });

    return { ok: !why.length, why: why };
  }

  /** The component graph, and the theorem that it is always a DAG. */
  function sccCondense(g, comps) {
    var idx = {}, names = [];
    comps.forEach(function (c, i) { names.push('{' + c.join(',') + '}'); c.forEach(function (v) { idx[v] = i; }); });

    var seen = {}, edges = [];
    g.edges.forEach(function (e) {
      var a = idx[e.u], b = idx[e.v];
      if (a === b) return;                       // inside a component, not between
      var k = a + ' ' + b;
      if (seen[k]) return;
      seen[k] = true;
      edges.push({ u: names[a], v: names[b], from: a, to: b });
    });

    var text = names.map(function (n, i) {
      var outs = edges.filter(function (e) { return e.from === i; }).map(function (e) { return e.v; });
      return outs.length ? n + ' > ' + outs.join(' ') : n;
    }).join('\n');

    // Confirm the theorem on this instance rather than asserting it.
    var order = names.map(function (n, i) { return i; });
    var acyclic = (function () {
      var st = {}, bad = false;
      function go(i) {
        st[i] = 1;
        edges.filter(function (e) { return e.from === i; }).forEach(function (e) {
          if (st[e.to] === 1) bad = true;
          else if (!st[e.to]) go(e.to);
        });
        st[i] = 2;
      }
      order.forEach(function (i) { if (!st[i]) go(i); });
      return !bad;
    })();

    return { ok: true, names: names, edges: edges, text: text, acyclic: acyclic,
             nV: names.length, nE: edges.length };
  }
