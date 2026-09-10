  /* ============================================================
     TOPIC 04 · minimum spanning trees: Kruskal and Prim
     ------------------------------------------------------------
     Both are greedy, both are correct, and on the example graph
     they return DIFFERENT trees of the same weight. That is not a
     bug in either -- it is what "minimum spanning tree" not being
     unique looks like, and it is the single most useful thing to
     understand here, so the two are computed independently and
     compared rather than one being checked against the other.
     ============================================================ */

  /* ---------- Disjoint sets, which is how "would this edge close
       a cycle?" becomes a primitive operation. ---------- */

  function dsMake(vertices) {
    var parent = {}, rank = {};
    vertices.forEach(function (v) { parent[v] = v; rank[v] = 0; });
    return {
      find: function find(x) {
        while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
        return x;
      },
      union: function (a, b) {
        var ra = this.find(a), rb = this.find(b);
        if (ra === rb) return false;
        if (rank[ra] < rank[rb]) { var t = ra; ra = rb; rb = t; }
        parent[rb] = ra;
        if (rank[ra] === rank[rb]) rank[ra]++;
        return true;
      },
      /** The components drawn the usual way: sorted sets. */
      groups: function () {
        var by = {}, self = this;
        vertices.forEach(function (v) {
          var r = self.find(v);
          (by[r] = by[r] || []).push(v);
        });
        return Object.keys(by).map(function (r) { return by[r].sort(); })
          .sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
      }
    };
  }

  /** Sort edges by weight, then by endpoints, so that ties are
      broken the same way every run and a trace can be checked. */
  function mstSortEdges(edges) {
    return edges.slice().sort(function (a, b) {
      if (a.w !== b.w) return a.w - b.w;
      var ka = [a.u, a.v].sort().join(''), kb = [b.u, b.v].sort().join('');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }

  function mstWeight(edges) {
    return edges.reduce(function (s, e) { return s + e.w; }, 0);
  }

  function mstShow(edges) {
    return edges.map(function (e) { return e.u + '–' + e.v + ':' + e.w; }).join(', ');
  }

  /* ---------- Kruskal ---------- */

  function mstKruskal(g) {
    if (g.directed) return { ok: false, error: 'Spanning trees are defined for undirected graphs.' };
    var ds = dsMake(g.vertices), tree = [], steps = [];
    var sorted = mstSortEdges(g.edges);

    steps.push({ n: 0, edge: null, taken: null, groups: ds.groups(),
                 note: 'Sort the edges by weight. Every vertex starts in its own component.' });

    sorted.forEach(function (e, i) {
      var joins = ds.union(e.u, e.v);
      if (joins) tree.push(e);
      steps.push({
        n: i + 1, edge: e, taken: joins, groups: ds.groups(),
        weightSoFar: mstWeight(tree),
        note: joins
          ? 'Take ' + e.u + '–' + e.v + ' (' + e.w + '): it joins two components.'
          : 'Skip ' + e.u + '–' + e.v + ' (' + e.w + '): both ends are already connected, ' +
            'so adding it would close a cycle.'
      });
    });

    return { ok: true, tree: tree, steps: steps, weight: mstWeight(tree),
             sorted: sorted, components: ds.groups().length };
  }

  /* ---------- Prim ---------- */

  /** The usual write-up keeps a priority queue of edges rather than of
      vertices, and lets stale edges sit in the queue until they are
      dequeued and rejected -- which is why the trace shows crossed
      out entries. Reproduced faithfully, because those rejections
      are half of what the worked example is teaching. */
  function mstPrim(g, root, tie) {
    if (g.directed) return { ok: false, error: 'Spanning trees are defined for undirected graphs.' };
    if (!g.adj[root]) return { ok: false, error: 'No vertex called ' + root + '.' };
    tie = tie || 'alpha';

    var inTree = {}, tree = [], steps = [], queue = [], seq = 0;
    inTree[root] = true;

    // Equal weights have to be broken somehow, and the choice is not
    // cosmetic: on the example graph it decides whether the tree ends
    // up with A–H or B–C, both weight 8. The total is 37 either way,
    // which is the point -- so the rule is a knob rather than a
    // hidden convention.
    function order() {
      queue.sort(function (a, b) {
        if (a.w !== b.w) return a.w - b.w;
        if (tie === 'late') return b.seq - a.seq;      // newest first
        if (tie === 'early') return a.seq - b.seq;     // oldest first
        var ka = [a.u, a.v].sort().join(''), kb = [b.u, b.v].sort().join('');
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
    }

    function push(v) {
      (g.adj[v] || []).forEach(function (e) {
        if (!inTree[e.to]) queue.push({ u: v, v: e.to, w: e.w, seq: seq++ });
      });
      order();
    }
    push(root);
    steps.push({ n: 0, edge: null, taken: null, queue: queue.slice(), tree: [],
                 note: 'Start at ' + root + '. Enqueue every edge leaving it.' });

    var n = 0;
    while (queue.length) {
      var e = queue.shift();
      n++;
      if (inTree[e.u] && inTree[e.v]) {
        steps.push({ n: n, edge: e, taken: false, queue: queue.slice(), tree: tree.slice(),
                     note: 'Reject ' + e.u + '–' + e.v + ' (' + e.w + '): both ends are ' +
                           'already in the tree, so it would close a cycle.' });
        continue;
      }
      var fresh = inTree[e.u] ? e.v : e.u;
      inTree[fresh] = true;
      tree.push(e);
      push(fresh);
      steps.push({ n: n, edge: e, taken: true, queue: queue.slice(), tree: tree.slice(),
                   weightSoFar: mstWeight(tree),
                   note: 'Take ' + e.u + '–' + e.v + ' (' + e.w + '), bringing ' + fresh +
                         ' into the tree, and enqueue its edges.' });
    }

    return { ok: true, tree: tree, steps: steps, weight: mstWeight(tree),
             reached: Object.keys(inTree).sort() };
  }

  /* ---------- Checking a claimed spanning tree ----------

     Deliberately independent of both algorithms: a set of edges is a
     spanning tree iff it has |V|-1 edges, all from the graph, and
     connects every vertex. (Those two together force acyclicity, so
     there is no need to test for cycles separately -- a connected
     graph on |V| vertices with |V|-1 edges is a tree.) */

  function mstIsTree(g, edges) {
    var why = [];
    if (edges.length !== g.nV - 1) {
      why.push('A spanning tree of ' + g.nV + ' vertices has exactly ' + (g.nV - 1) +
               ' edges; this has ' + edges.length + '.');
    }
    var have = {};
    g.edges.forEach(function (e) { have[[e.u, e.v].sort().join(' ')] = e.w; });
    edges.forEach(function (e) {
      var k = [e.u, e.v].sort().join(' ');
      if (have[k] === undefined) why.push(e.u + '–' + e.v + ' is not an edge of the graph.');
      else if (have[k] !== e.w) why.push(e.u + '–' + e.v + ' has weight ' + have[k] + ', not ' + e.w + '.');
    });

    var ds = dsMake(g.vertices);
    edges.forEach(function (e) { ds.union(e.u, e.v); });
    var comps = ds.groups();
    if (comps.length !== 1) {
      why.push('It leaves ' + comps.length + ' components: ' +
               comps.map(function (c) { return '{' + c.join(', ') + '}'; }).join(' '));
    }
    return { ok: !why.length, why: why, weight: mstWeight(edges), components: comps.length };
  }

  /** Brute force over all spanning trees, for graphs small enough to
      afford it. Used to confirm the greedy answer is genuinely
      minimum, rather than merely what the greedy rule produced. */
  function mstBrute(g, cap) {
    cap = cap || 200000;
    var m = g.edges.length, need = g.nV - 1;
    if (m > 24) return { ok: false, error: 'Too many edges to enumerate.' };
    var best = null, bestSets = 0, count = 0, total = 1 << m;
    if (total > cap) return { ok: false, error: 'Too many subsets to enumerate.' };

    for (var mask = 0; mask < total; mask++) {
      var bits = 0, mm = mask;
      while (mm) { bits += mm & 1; mm >>= 1; }
      if (bits !== need) continue;
      var pick = [];
      for (var i = 0; i < m; i++) if (mask & (1 << i)) pick.push(g.edges[i]);
      var ds = dsMake(g.vertices), okTree = true;
      for (var j = 0; j < pick.length; j++) if (!ds.union(pick[j].u, pick[j].v)) { okTree = false; break; }
      if (!okTree || ds.groups().length !== 1) continue;
      count++;
      var w = mstWeight(pick);
      if (best === null || w < best) { best = w; bestSets = 1; }
      else if (w === best) bestSets++;
    }
    return { ok: true, weight: best, spanningTrees: count, minimumTrees: bestSets };
  }
