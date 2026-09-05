  /* ============================================================
     TOPIC 04 · graphs: parsing, BFS, DFS
     ------------------------------------------------------------
     Neighbour order is not an implementation detail here -- it is
     what makes a trace reproducible, and the lecture traces only
     make sense once it is pinned down:

       BFS enqueues neighbours in the order listed, so it visits
       them in that order.
       DFS pushes them in the order listed onto a STACK, so it
       explores them in the REVERSE of that order.

     That is why the deck's DFS leaves A by way of G, when A's
     neighbours are B, E, G. Getting this backwards produces a
     perfectly valid depth-first search that matches no slide.
     ============================================================ */

  /** Parse a graph. Each line is `src OP tgt [tgt ...]`, OP being
      `>` (directed) or `-` (undirected). A target may carry `:w`. */
  function grParse(text, opts) {
    opts = opts || {};
    var lines = String(text).split(/[\n;]+/);
    var order = [], adj = {}, edges = [], seenEdge = {};
    var directed = null, weighted = false;

    function vertex(name) {
      if (!adj[name]) { adj[name] = []; order.push(name); }
      return name;
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === '#') continue;

      var m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*([>-])\s*(.*)$/);
      if (!m) {
        // A bare name declares an isolated vertex.
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(line)) { vertex(line); continue; }
        return { ok: false, error: 'Cannot read "' + line + '". Write edges as A > B or A - B, ' +
                 'and weights as A - B : 4.' };
      }
      var src = m[1], op = m[2], rest = m[3].trim();
      var isDir = op === '>';
      if (directed === null) directed = isDir;
      else if (directed !== isDir) {
        return { ok: false, error: 'Mixed > and - in one graph. A graph is either directed ' +
                 'throughout or undirected throughout.' };
      }
      vertex(src);
      if (!rest) continue;

      var parts = rest.split(/[\s,]+/).filter(function (s) { return s; });
      for (var j = 0; j < parts.length; j++) {
        var pm = parts[j].match(/^([A-Za-z_][A-Za-z0-9_]*)(?::(-?[0-9]+(?:\.[0-9]+)?))?$/);
        if (!pm) return { ok: false, error: 'Cannot read the target "' + parts[j] + '".' };
        var tgt = vertex(pm[1]);
        var w = pm[2] === undefined ? 1 : parseFloat(pm[2]);
        if (pm[2] !== undefined) weighted = true;
        if (src === tgt) return { ok: false, error: 'Self-loop ' + src + ' → ' + src +
                                  '. These algorithms assume an irreflexive graph.' };

        var key = directed ? src + ' ' + tgt : [src, tgt].sort().join(' ');
        if (seenEdge[key] !== undefined) {
          if (edges[seenEdge[key]].w !== w) {
            return { ok: false, error: 'The edge ' + src + (directed ? ' → ' : ' — ') + tgt +
                     ' is given twice with different weights.' };
          }
          continue;
        }
        seenEdge[key] = edges.length;
        edges.push({ u: src, v: tgt, w: w });
        adj[src].push({ to: tgt, w: w });
        if (!directed) adj[tgt].push({ to: src, w: w });
      }
    }

    if (!order.length) return { ok: false, error: 'No vertices. Try A > B.' };
    if (directed === null) directed = !!opts.directed;

    // Sort each adjacency list, so a trace depends on the graph and
    // not on the order the lines happened to be typed in.
    order.forEach(function (v) {
      adj[v].sort(function (a, b) { return a.to < b.to ? -1 : a.to > b.to ? 1 : 0; });
    });
    order.sort();

    return { ok: true, directed: directed, weighted: weighted,
             vertices: order, adj: adj, edges: edges,
             nV: order.length, nE: edges.length };
  }

  function grNbrs(g, v) {
    return (g.adj[v] || []).map(function (e) { return e.to; });
  }

  /* The two Week 4 decks disagree about this, and it is worth being
     explicit rather than picking one and hoping.

       The BFS/DFS deck pushes neighbours onto a stack and so explores
       them in REVERSE of the listed order: A leaves for G, not B.
       The SCC deck's TOPOLOGICAL-SORT explores them in the LISTED
       order: F leaves for E, not H.

     Both are depth-first search. Neither is wrong. But they produce
     different traces, so a tool that hard-codes one silently
     contradicts half the slides. Hence a mode. */
  function grOrderNbrs(g, v, mode) {
    var ns = grNbrs(g, v);
    return mode === 'listed' ? ns : ns.slice().reverse();
  }

  /** The transpose: every edge reversed. An undirected graph is its
      own transpose, which is why SCC is a question about digraphs. */
  function grTranspose(g) {
    var adj = {}, edges = [];
    g.vertices.forEach(function (v) { adj[v] = []; });
    g.edges.forEach(function (e) {
      edges.push({ u: e.v, v: e.u, w: e.w });
      adj[e.v].push({ to: e.u, w: e.w });
      if (!g.directed) adj[e.u].push({ to: e.v, w: e.w });
    });
    g.vertices.forEach(function (v) {
      adj[v].sort(function (a, b) { return a.to < b.to ? -1 : a.to > b.to ? 1 : 0; });
    });
    return { ok: true, directed: g.directed, weighted: g.weighted,
             vertices: g.vertices.slice(), adj: adj, edges: edges,
             nV: g.nV, nE: edges.length };
  }

  /* ---------- Breadth-first search ---------- */

  /** Returns the visit order with the queue at every step, plus the
      BFS tree and the distance from the root -- which is the shortest
      path length in edges, and the reason the queue is worth having. */
  function grBfs(g, root) {
    if (!g.adj[root]) return { ok: false, error: 'No vertex called ' + root + '.' };
    var seen = {}, queue = [root], order = [], steps = [], parent = {}, dist = {};
    seen[root] = true; dist[root] = 0; parent[root] = null;

    steps.push({ n: 0, at: null, queue: queue.slice(), added: [root],
                 note: 'Enqueue the root ' + root + '.' });

    while (queue.length) {
      var u = queue[0];
      order.push(u);
      var added = [];
      grNbrs(g, u).forEach(function (w) {
        if (!seen[w]) { seen[w] = true; parent[w] = u; dist[w] = dist[u] + 1;
                        queue.push(w); added.push(w); }
      });
      queue.shift();
      steps.push({ n: order.length, at: u, queue: queue.slice(), added: added,
                   note: added.length
                     ? 'Inspect ' + u + ', enqueue ' + added.join(', ') + ', dequeue ' + u + '.'
                     : 'Inspect ' + u + ' — no unvisited neighbours — dequeue ' + u + '.' });
    }

    var tree = [];
    Object.keys(parent).forEach(function (v) {
      if (parent[v]) tree.push({ u: parent[v], v: v });
    });
    return { ok: true, order: order, steps: steps, parent: parent, dist: dist,
             tree: tree, reached: order.length,
             missed: g.vertices.filter(function (v) { return !seen[v]; }) };
  }

  /* ---------- Depth-first search ---------- */

  /** The deck's timestamp scheme. A vertex is stamped whenever control
      arrives at it: once on entry, once after each child returns; a
      leaf instead gets one closing stamp. So A, with three children,
      carries four numbers -- which is what makes the slide's
      1/10/18/21 reproducible rather than mysterious. */
  function grDfs(g, root, mode) {
    if (!g.adj[root]) return { ok: false, error: 'No vertex called ' + root + '.' };
    mode = mode || 'stack';
    var seen = {}, stamps = {}, order = [], steps = [], parent = {}, t = 0;
    var back = [], forward = [], cross = [], treeEdges = [], stack = [];
    var state = {};                      // 'open' while on the stack

    g.vertices.forEach(function (v) { stamps[v] = []; });

    function stamp(v, why) {
      t++; stamps[v].push(t);
      steps.push({ t: t, at: v, why: why, stack: stack.slice() });
    }

    function visit(u, from) {
      seen[u] = true; state[u] = 'open'; parent[u] = from; order.push(u);
      stack.push(u);
      stamp(u, 'enter');
      var kids = 0;
      var nbrs = grOrderNbrs(g, u, mode);
      for (var i = 0; i < nbrs.length; i++) {
        var w = nbrs[i];
        if (!seen[w]) {
          treeEdges.push({ u: u, v: w });
          visit(w, u);
          kids++;
          stamp(u, 'return');
        } else if (state[w] === 'open') {
          back.push({ u: u, v: w });      // closes a cycle
        } else if (stamps[w][0] > stamps[u][0]) {
          forward.push({ u: u, v: w });
        } else {
          cross.push({ u: u, v: w });
        }
      }
      if (!kids) stamp(u, 'leaf');
      state[u] = 'done';
      stack.pop();
    }
    visit(root, null);

    return { ok: true, order: order, stamps: stamps, steps: steps, parent: parent,
             tree: treeEdges, back: back, forward: forward, cross: cross,
             ticks: t, reached: order.length,
             missed: g.vertices.filter(function (v) { return !seen[v]; }),
             show: function (v) { return (stamps[v] || []).join('/'); } };
  }

  /** Every vertex, restarting at the alphabetically first unvisited
      one -- what you need when no single root reaches the whole
      graph, which is the normal case for SCC. */
  function grDfsAll(g, opts) {
    opts = opts || {};
    var mode = opts.mode || 'stack';
    var seen = {}, roots = [], finish = [], stamps = {}, t = 0, state = {}, back = [];
    g.vertices.forEach(function (v) { stamps[v] = []; });

    // "Select ANY unsorted vertex" leaves the starting vertex free, and
    // the choice changes the trace. Callers that want to reproduce a
    // particular slide can say which vertices to start from.
    var tryOrder = (opts.start || []).filter(function (v) { return g.adj[v]; })
      .concat(g.vertices);

    function visit(u) {
      seen[u] = true; state[u] = 'open';
      t++; stamps[u].push(t);
      var kids = 0;
      var nbrs = grOrderNbrs(g, u, mode);
      for (var i = 0; i < nbrs.length; i++) {
        var w = nbrs[i];
        if (!seen[w]) { visit(w); kids++; t++; stamps[u].push(t); }
        else if (state[w] === 'open') back.push({ u: u, v: w });
      }
      if (!kids) { t++; stamps[u].push(t); }
      state[u] = 'done';
      finish.push(u);
    }
    tryOrder.forEach(function (v) { if (!seen[v]) { roots.push(v); visit(v); } });
    return { ok: true, roots: roots, finish: finish, stamps: stamps, back: back, ticks: t };
  }

  /** Which vertices can u reach? Lets an SCC be checked against the
      definition rather than against the algorithm that computed it. */
  function grReach(g, u) {
    var seen = {}, stack = [u], out = [];
    seen[u] = true;
    while (stack.length) {
      var v = stack.pop();
      out.push(v);
      grNbrs(g, v).forEach(function (w) { if (!seen[w]) { seen[w] = true; stack.push(w); } });
    }
    return out.sort();
  }

  function grConnected(g) {
    if (!g.vertices.length) return true;
    return grBfs(g, g.vertices[0]).reached === g.nV;
  }

  /* ---------- Preset graphs from the lectures ---------- */

  var GR_PRESETS = {
    search: 'A > B E G\nB > C\nC > D\nE > C F G H\nF > D\nG > H\nH > I\nI > D',
    mst: 'A - B:4 H:8\nB - C:8 H:11\nC - D:7 F:4 I:2\nD - E:9 F:14\nE - F:10\n' +
         'F - G:2\nG - H:1 I:6\nH - I:7',
    scc: 'A > D\nB > D F\nC > A B\nD > C E\nE > F\nF > E H\nG > I\nH > E G I J\nI > J\nJ > I',
    dress: 'underwear > shoes trousers\nsocks > shoes\ntrousers > belt shoes\n' +
           'shirt > belt tie\nbelt > jacket\ntie > jacket\nwatch\njacket\nshoes',
    dag: 'A > B C\nB > D\nC > D E\nD > F\nE > F',
    cyclic: 'A > B\nB > C\nC > A\nC > D'
  };
