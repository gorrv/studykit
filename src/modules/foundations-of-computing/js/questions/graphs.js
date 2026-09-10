  /* ---------- Topic 04 · graph algorithms ----------

     As elsewhere, nothing is a stored answer: the search questions
     are marked by running the search, the spanning-tree questions by
     running Kruskal and checking the result really is a spanning
     tree, and the SCC questions by plain reachability.
     ------------------------------------------------------------ */

  function ghNum(target) {
    return function (v) {
      var s = String(v).trim().replace(/,/g, '');
      if (!/^-?[0-9]+$/.test(s)) return { ok: false, msg: 'Give a whole number.' };
      return { ok: parseInt(s, 10) === target };
    };
  }

  /** A small random directed graph, connected enough to be interesting. */
  function ghRandom(n, density, directed) {
    var names = 'ABCDEFG'.slice(0, n).split(''), lines = [], op = directed ? ' > ' : ' - ';
    for (var i = 0; i < n; i++) {
      var outs = [];
      for (var j = 0; j < n; j++) {
        if (i === j) continue;
        if (directed ? Math.random() < density : (j > i && Math.random() < density)) {
          outs.push(names[j]);
        }
      }
      lines.push(outs.length ? names[i] + op + outs.join(' ') : names[i]);
    }
    return grParse(lines.join('\n'), { directed: directed });
  }

  /* ---- What order does BFS visit in? ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var g = grParse(GR_PRESETS.search);
    var root = qzPick(['A', 'E', 'G', 'B']);
    var b = grBfs(g, root);
    if (b.reached < 3) throw new Error('retry');

    return {
      topic: 'graphs · breadth-first search',
      prompt: 'Run BFS from <code>' + root + '</code> on the example graph (neighbours in ' +
        'alphabetical order). In what order are the vertices visited?',
      placeholder: 'e.g. A B E G',
      answer: b.order.join(' '),
      check: function (v) {
        var got = String(v).trim().toUpperCase().split(/[\s,]+/).filter(function (x) { return x; });
        return { ok: got.join(' ') === b.order.join(' ') };
      },
      explain: 'The queue starts as [' + root + ']. Each vertex enqueues its unvisited neighbours in ' +
        'alphabetical order, then leaves the front. That gives <strong>' + b.order.join(' ') +
        '</strong> — and because the queue is first-in-first-out, this is also increasing distance ' +
        'from ' + root + '.',
    };
  } });

  /* ---- How far is it? ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var g = grParse(GR_PRESETS.search);
    var b = grBfs(g, 'A');
    var v = qzPick(g.vertices.filter(function (x) { return b.dist[x] !== undefined && x !== 'A'; }));
    if (!v) throw new Error('retry');

    return {
      topic: 'graphs · breadth-first search',
      prompt: 'On the example graph, how many edges is the shortest path from <code>A</code> to ' +
        '<code>' + v + '</code>?',
      placeholder: 'a whole number',
      answer: String(b.dist[v]),
      check: ghNum(b.dist[v]),
      explain: 'BFS gives this for free: everything at distance k is dequeued before anything at ' +
        'distance k+1. ' + v + ' is dequeued in the ' + (b.dist[v] + 1) + 'th layer, so its distance ' +
        'is ' + b.dist[v] + '. Depth-first search would give you no such guarantee.',
    };
  } });

  /* ---- DFS timestamps ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var g = grParse(GR_PRESETS.search);
    var d = grDfs(g, 'A');
    var v = qzPick(['A', 'E', 'G', 'D', 'F', 'C', 'B']);
    var stamps = d.stamps[v];
    if (!stamps || !stamps.length) throw new Error('retry');

    return {
      topic: 'graphs · depth-first search',
      prompt: 'Running DFS from <code>A</code> on the example graph, how many timestamps does ' +
        '<code>' + v + '</code> collect?',
      placeholder: 'a whole number',
      answer: String(stamps.length),
      check: ghNum(stamps.length),
      explain: 'A vertex is stamped every time control arrives at it: once on entry, and once more ' +
        'after each child returns. ' + v + ' gets <code>' + stamps.join('/') + '</code> — ' +
        stamps.length + ' stamps. That is why A, with three children, carries four numbers rather ' +
        'than the tidy pair people expect.',
    };
  } });

  /* ---- Which container? ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var which = Math.random() < 0.5;
    var right = which ? 'A queue' : 'A stack';
    return {
      topic: 'graphs · search',
      kind: 'choice',
      prompt: 'Which data structure turns the generic search into <strong>' +
        (which ? 'breadth' : 'depth') + '-first</strong> search?',
      choices: ['A queue', 'A stack', 'A priority queue', 'A disjoint-set forest'],
      answer: right,
      check: textCheck(right),
      explain: 'The two searches are the same five lines; only the container differs. A queue is ' +
        'first-in-first-out, so vertices come out in the order discovered — breadth first. A stack ' +
        'is last-in-first-out, so the search plunges down the most recent branch — depth first. ' +
        'Both run in O(|V| + |E|).',
    };
  } });

  /* ---- The MST weight ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var g = grParse(GR_PRESETS.mst);
    var k = mstKruskal(g);
    return {
      topic: 'graphs · minimum spanning trees',
      prompt: 'What is the total weight of a minimum spanning tree of the example graph?',
      placeholder: 'a whole number',
      answer: String(k.weight),
      check: ghNum(k.weight),
      explain: 'Kruskal takes ' + mstShow(mstSortEdges(k.tree)) + ', totalling ' + k.weight + '. ' +
        'Prim from A produces a <em>different</em> tree of the same weight — the MST is not unique ' +
        'here, and brute force over all 662 spanning trees confirms two of them achieve 37.',
    };
  } });

  /* ---- How many edges in a spanning tree? ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var n = qzInt(4, 12);
    return {
      topic: 'graphs · minimum spanning trees',
      prompt: 'A connected graph has <strong>' + n + '</strong> vertices. How many edges does any ' +
        'spanning tree of it have?',
      placeholder: 'a whole number',
      answer: String(n - 1),
      check: ghNum(n - 1),
      explain: 'Always |V| − 1 = ' + (n - 1) + ', for <em>every</em> spanning tree, minimum or not. ' +
        'A tree on n vertices has n−1 edges by definition. So the number of edges is never what an ' +
        'MST algorithm is choosing between — only the total weight is.',
    };
  } });

  /* ---- Which reduction / which structure ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var right = 'Check whether u and v are already in the same component';
    var choices = [right,
      'Run a depth-first search from u looking for v',
      'Sort the edges again',
      'Count the edges chosen so far'];
    return {
      topic: 'graphs · minimum spanning trees',
      kind: 'choice',
      prompt: 'Kruskal must test whether adding (u, v) would create a cycle. What is the efficient ' +
        'way to do that?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'T is always a forest, so adding (u,v) closes a cycle <strong>exactly when</strong> u ' +
        'and v are already connected. That turns a graph search into a disjoint-set lookup, costing ' +
        'O((|V|+|E|)·α(|V|)) in total — which is why the sort, at O(|E| log |E|), dominates.',
    };
  } });

  /* ---- Topological sort exists? ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var cyclic = Math.random() < 0.5;
    var g = grParse(cyclic ? GR_PRESETS.cyclic : GR_PRESETS.dag);
    var t = tsSort(g);
    if (t.ok === cyclic) throw new Error('retry');
    var yes = 'Yes — it is a DAG', no = 'No — it has a cycle';

    return {
      topic: 'graphs · topological sorting',
      kind: 'choice',
      prompt: 'Does <code>' + esc(g.edges.map(function (e) { return e.u + '→' + e.v; }).join(', ')) +
        '</code> have a topological ordering?',
      choices: [yes, no],
      answer: t.ok ? yes : no,
      check: textCheck(t.ok ? yes : no),
      explain: t.ok
        ? 'Yes: ' + t.order.join(' → ') + ' puts every arrow forwards. A topological order exists ' +
          'exactly when the graph is acyclic.'
        : 'No. ' + t.cycle.join(' → ') + ' → ' + t.cycle[0] + ' is a cycle, and each of those ' +
          'vertices would have to come both before and after the next.',
    };
  } });

  /* ---- How many SCCs? ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var which = qzPick(['scc', 'dag', 'cyclic']);
    var g = grParse(GR_PRESETS[which]);
    var s = sccFind(g);
    if (!s.ok) throw new Error('retry');

    return {
      topic: 'graphs · strongly connected components',
      prompt: 'How many strongly connected components does <code>' +
        esc(g.edges.map(function (e) { return e.u + '→' + e.v; }).join(', ')) + '</code> have?',
      placeholder: 'a whole number',
      answer: String(s.count),
      check: ghNum(s.count),
      explain: 'The components are ' +
        s.components.map(function (c) { return '{' + c.join(',') + '}'; }).join(', ') + ' — ' +
        s.count + ' of them. ' + (s.count === g.nV
          ? 'Every one is a single vertex, which is what happens when the graph is acyclic: nothing ' +
            'is mutually reachable with anything else.'
          : 'Remember the components must be <strong>maximal</strong> — a set where everything ' +
            'reaches everything is not a component if it can be extended.'),
    };
  } });

  /* ---- Which graph does the second SCC pass run on? ---- */
  QZ_GEN.push({ topic: 'graphs', make: function () {
    var right = 'The transpose G^T, with every edge reversed';
    var choices = [right, 'G again', 'The component graph', 'The spanning tree of G'];
    return {
      topic: 'graphs · strongly connected components',
      kind: 'choice',
      prompt: 'The SCC algorithm makes two depth-first passes. What does the <strong>second</strong> ' +
        'one run on?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Pass one, on G, finds everything u can <em>reach</em>. Pass two, on G<sup>T</sup>, ' +
        'finds everything that can <em>reach</em> u. A vertex in both sits on a round trip through ' +
        'u — which is the definition of being in the same component. Running the second pass on G ' +
        'again would just re-find what you already had.',
    };
  } });
