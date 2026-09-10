  /* ============================================================
     TOPIC 04 · rendering for the four graph tools
     ============================================================ */

  function grRead(id, fallback) {
    var el = document.getElementById(id);
    var text = el ? el.value : fallback;
    return grParse(text || fallback);
  }

  function grBadGraph(outId, g) {
    var out = document.getElementById(outId);
    if (out) out.innerHTML = '<div class="verdict bad">' + esc(g.error) + '</div>';
  }

  /** A compact edge list, used under every tool so the graph the tool
      actually parsed is visible rather than assumed. */
  function grSummary(g) {
    return '<div class="rd-stats">' +
      '<span class="stat-pill a">' + g.nV + ' vertices</span>' +
      '<span class="stat-pill a">' + g.nE + ' edges</span>' +
      '<span class="stat-pill dark">' + (g.directed ? 'directed' : 'undirected') + '</span>' +
      (g.weighted ? '<span class="stat-pill dark">weighted</span>' : '') +
      '</div>';
  }

  function grChips(list, cls) {
    if (!list.length) return '<span class="gr-empty">empty</span>';
    return list.map(function (v) {
      return '<span class="gr-chip ' + (cls || '') + '">' + esc(v) + '</span>';
    }).join('');
  }

  /* ---------- Tool 1 · BFS and DFS ---------- */

  function grPreset(which) {
    var el = document.getElementById('gr-text');
    if (el) el.value = GR_PRESETS[which] || GR_PRESETS.search;
    var root = document.getElementById('gr-root');
    if (root) root.value = which === 'scc' ? 'C' : 'A';
    runSearch();
  }

  function runSearch() {
    var out = document.getElementById('gr-output');
    if (!out) return;
    var g = grRead('gr-text', GR_PRESETS.search);
    if (!g.ok) return grBadGraph('gr-output', g);

    var root = ((document.getElementById('gr-root') || {}).value || '').trim() || g.vertices[0];
    if (!g.adj[root]) {
      out.innerHTML = grSummary(g) + '<div class="verdict bad">No vertex called ' + esc(root) +
        '. This graph has ' + esc(g.vertices.join(', ')) + '.</div>';
      return;
    }
    var mode = ((document.getElementById('gr-mode') || {}).value) || 'bfs';
    var nbr = ((document.getElementById('gr-nbr') || {}).value) || 'stack';

    var h = grSummary(g);

    if (mode === 'bfs') {
      var b = grBfs(g, root);
      h += '<div class="verdict ' + (b.missed.length ? 'warn' : 'safe') + '">' +
        'Visited ' + b.reached + ' of ' + g.nV + ' vertices: <strong>' + b.order.join(' ') + '</strong>' +
        (b.missed.length
          ? '<br>Unreached from ' + esc(root) + ': ' + b.missed.join(', ') +
            ' — a search only ever finds what its root can reach.'
          : '') + '</div>';

      h += '<div class="gr-trace" id="gr-trace">';
      b.steps.forEach(function (s, i) {
        h += '<div class="gr-row" data-step="' + i + '">' +
          '<span class="gr-n">' + (s.at ? s.n : '·') + '</span>' +
          '<span class="gr-at">' + (s.at ? esc(s.at) : '—') + '</span>' +
          '<span class="gr-queue"><span class="gr-lbl">queue</span>' + grChips(s.queue) + '</span>' +
          '<span class="gr-note">' + esc(s.note) + '</span>' +
          '</div>';
      });
      h += '</div>';

      h += '<table class="results-table"><tr><th>Vertex</th>' +
        g.vertices.map(function (v) { return '<th>' + esc(v) + '</th>'; }).join('') + '</tr>' +
        '<tr><th>Distance from ' + esc(root) + '</th>' +
        g.vertices.map(function (v) {
          return '<td>' + (b.dist[v] === undefined ? '∞' : b.dist[v]) + '</td>';
        }).join('') + '</tr></table>';

      h += '<p class="tool-note">Those distances are the <strong>shortest path lengths in edges</strong>, ' +
        'and they come free: because the queue is first-in-first-out, everything at distance k is ' +
        'dequeued before anything at distance k+1. Depth-first search gives you no such guarantee.</p>';

      out.innerHTML = h;
      ixTrace('gr', 'gr-output', { label: 'step', reset: true });
      return;
    }

    var d = grDfs(g, root, nbr);
    h += '<div class="verdict ' + (d.missed.length ? 'warn' : 'safe') + '">' +
      'Visited ' + d.reached + ' of ' + g.nV + ' vertices in <strong>' + d.order.join(' ') + '</strong>' +
      ', taking ' + d.ticks + ' ticks.' +
      (d.missed.length ? '<br>Unreached from ' + esc(root) + ': ' + d.missed.join(', ') : '') +
      (d.back.length
        ? '<br>Back edges (each one closes a cycle): ' +
          d.back.map(function (e) { return e.u + '→' + e.v; }).join(', ')
        : '<br>No back edges, so nothing reachable from ' + esc(root) + ' lies on a cycle.') +
      '</div>';

    h += '<table class="results-table"><tr><th>Vertex</th>' +
      g.vertices.map(function (v) { return '<th>' + esc(v) + '</th>'; }).join('') + '</tr>' +
      '<tr><th>Timestamps</th>' +
      g.vertices.map(function (v) { return '<td>' + (d.show(v) || '—') + '</td>'; }).join('') +
      '</tr></table>';

    h += '<div class="gr-trace" id="gr-trace">';
    d.steps.forEach(function (s, i) {
      var why = s.why === 'enter' ? 'first arrival' :
                s.why === 'return' ? 'back from a child' : 'nothing left below it';
      h += '<div class="gr-row" data-step="' + i + '">' +
        '<span class="gr-n">' + s.t + '</span>' +
        '<span class="gr-at">' + esc(s.at) + '</span>' +
        '<span class="gr-queue"><span class="gr-lbl">stack</span>' + grChips(s.stack) + '</span>' +
        '<span class="gr-note">' + esc(s.at) + ' is stamped ' + s.t + ' — ' + why + '.</span>' +
        '</div>';
    });
    h += '</div>';

    h += '<p class="tool-note">A vertex collects a stamp every time control arrives at it: once on ' +
      'entry, and once more after each child returns. So a vertex with three children carries four ' +
      'numbers, which is why A comes out as 1/10/18/21 rather than a tidy pair. ' +
      'The <em>neighbour order</em> control matters: pushing neighbours onto a stack explores them ' +
      'in reverse, which is what the stack-based presentation does; the topological-sort version walks them ' +
      'in listed order instead. Same algorithm, different trace.</p>';

    out.innerHTML = h;
    ixTrace('gr', 'gr-output', { label: 'tick', reset: true });
  }

  /* ---------- Tool 2 · minimum spanning trees ---------- */

  function runMst() {
    var out = document.getElementById('mst-output');
    if (!out) return;
    var g = grRead('mst-text', GR_PRESETS.mst);
    if (!g.ok) return grBadGraph('mst-output', g);
    if (g.directed) {
      out.innerHTML = '<div class="verdict bad">A spanning tree needs an undirected graph. ' +
        'Write the edges with <code>-</code> rather than <code>&gt;</code>.</div>';
      return;
    }

    var which = ((document.getElementById('mst-alg') || {}).value) || 'kruskal';
    var root = ((document.getElementById('mst-root') || {}).value || '').trim() || g.vertices[0];
    var tie = ((document.getElementById('mst-tie') || {}).value) || 'alpha';

    var run = which === 'kruskal' ? mstKruskal(g) : mstPrim(g, root, tie);
    if (!run.ok) { out.innerHTML = '<div class="verdict bad">' + esc(run.error) + '</div>'; return; }

    var chk = mstIsTree(g, run.tree);
    var other = which === 'kruskal' ? mstPrim(g, root, tie) : mstKruskal(g);
    var brute = mstBrute(g);

    var h = grSummary(g);
    h += '<div class="verdict ' + (chk.ok ? 'safe' : 'bad') + '">' +
      (chk.ok
        ? 'A spanning tree: ' + run.tree.length + ' edges, every vertex connected, no cycle. ' +
          '<strong>Total weight ' + run.weight + '</strong>.'
        : 'Not a spanning tree — ' + chk.why.join(' ')) +
      (brute.ok
        ? '<br>Checked against every one of the ' + brute.spanningTrees + ' spanning trees this graph ' +
          'has: the minimum weight is ' + brute.weight + ', achieved by ' + brute.minimumTrees +
          ' of them. ' + (run.weight === brute.weight
            ? 'The greedy answer is genuinely optimal ✓'
            : 'The greedy answer is NOT optimal ✗')
        : '') +
      '</div>';

    h += '<div class="gr-trace" id="mst-trace">';
    run.steps.forEach(function (s, i) {
      var cls = s.taken === null ? '' : s.taken ? 'took' : 'skipped';
      h += '<div class="gr-row ' + cls + '" data-step="' + i + '">' +
        '<span class="gr-n">' + s.n + '</span>' +
        '<span class="gr-at">' + (s.edge ? esc(s.edge.u + '–' + s.edge.v) : '—') + '</span>' +
        '<span class="gr-w">' + (s.edge ? s.edge.w : '') + '</span>' +
        '<span class="gr-queue">' +
          (which === 'kruskal'
            ? '<span class="gr-lbl">components</span>' +
              s.groups.map(function (c) {
                return '<span class="gr-chip">{' + esc(c.join(',')) + '}</span>';
              }).join('')
            : '<span class="gr-lbl">queue</span>' +
              (s.queue || []).slice(0, 8).map(function (e) {
                return '<span class="gr-chip">' + esc(e.u + e.v) + ':' + e.w + '</span>';
              }).join('')) +
        '</span>' +
        '<span class="gr-note">' + esc(s.note) + '</span>' +
        '</div>';
    });
    h += '</div>';

    var sameSet = mstShow(mstSortEdges(run.tree)) === mstShow(mstSortEdges(other.tree));
    h += '<table class="results-table">' +
      '<tr><th></th><th>Edges chosen</th><th>Weight</th></tr>' +
      '<tr><th>Kruskal</th><td>' + esc(mstShow(mstSortEdges((which === 'kruskal' ? run : other).tree))) +
        '</td><td>' + (which === 'kruskal' ? run : other).weight + '</td></tr>' +
      '<tr><th>Prim from ' + esc(root) + '</th><td>' +
        esc(mstShow(mstSortEdges((which === 'kruskal' ? other : run).tree))) +
        '</td><td>' + (which === 'kruskal' ? other : run).weight + '</td></tr>' +
      '</table>';

    h += '<p class="tool-note">' + (sameSet
      ? 'Here the two agree edge for edge. Change a tie — two edges of equal weight — and they need not.'
      : '<strong>The two algorithms return different trees of the same weight.</strong> Neither is ' +
        'wrong: a minimum spanning tree is not unique, and where weights tie, which one you get ' +
        'depends on the order the algorithm happens to consider them. What is guaranteed is the ' +
        'total, not the edge set.') +
      ' The <em>tie-break</em> control changes only which of the equally-good trees comes out — the ' +
      'usual Prim trace resolves the weight-8 tie in favour of B–C, which is the ' +
      '&ldquo;most recent&rdquo; setting.</p>';

    out.innerHTML = h;
    ixTrace('mst', 'mst-output', { label: 'edge', reset: true });
  }

  function mstPreset(which) {
    var el = document.getElementById('mst-text');
    if (el) el.value = GR_PRESETS[which] || GR_PRESETS.mst;
    runMst();
  }

  /* ---------- Tool 3 · topological sort ---------- */

  function runTopo() {
    var out = document.getElementById('ts-output');
    if (!out) return;
    var g = grRead('ts-text', GR_PRESETS.dress);
    if (!g.ok) return grBadGraph('ts-output', g);

    var nbr = ((document.getElementById('ts-nbr') || {}).value) || 'stack';
    var t = tsSort(g, { mode: nbr });
    var h = grSummary(g);

    if (!t.ok) {
      h += '<div class="verdict bad">' + esc(t.error) + '</div>';
      h += '<p class="tool-note">This is the whole content of the DAG condition. A topological order ' +
        'exists <strong>exactly when</strong> the graph is acyclic — so &ldquo;find a topological ' +
        'sort&rdquo; and &ldquo;prove there is no cycle&rdquo; are the same task. Note what the ' +
        'standard SCC algorithm does with this: it runs TOPOLOGICAL-SORT on a graph that ' +
        '<em>does</em> have cycles. What it gets back is not a topological order — it is the reverse ' +
        'finishing order, which is a perfectly good thing to want, and is exactly the order the ' +
        'second pass needs.</p>';
      out.innerHTML = h;
      return;
    }

    h += '<div class="verdict safe">' +
      '<strong>' + t.order.join(' → ') + '</strong><br>' +
      'Every one of the ' + g.nE + ' edges points forwards in this list ✓</div>';

    h += '<div class="gr-trace" id="ts-trace">';
    t.order.forEach(function (v, i) {
      var outs = grNbrs(g, v);
      h += '<div class="gr-row" data-step="' + i + '">' +
        '<span class="gr-n">' + (i + 1) + '</span>' +
        '<span class="gr-at">' + esc(v) + '</span>' +
        '<span class="gr-note">' + (outs.length
          ? 'must come before ' + esc(outs.join(', '))
          : 'nothing depends on it') + '</span>' +
        '</div>';
    });
    h += '</div>';

    h += '<p class="tool-note">A topological order is usually <strong>not unique</strong> — the ' +
      'algorithm says &ldquo;select <em>any</em> unsorted vertex&rdquo;, and different choices give ' +
      'different, equally valid answers. Vertices with no edges between them (a watch and a pair of ' +
      'socks) can go in either order. So do not memorise one answer; check that every arrow points ' +
      'forwards, which is the only thing being asked.</p>';

    out.innerHTML = h;
    ixTrace('ts', 'ts-output', { label: 'position', reset: true });
  }

  /** Mark an order the student types, against the definition. */
  function tsMark() {
    var out = document.getElementById('ts-mark-output');
    if (!out) return;
    var g = grRead('ts-text', GR_PRESETS.dress);
    if (!g.ok) return grBadGraph('ts-mark-output', g);

    var raw = ((document.getElementById('ts-guess') || {}).value || '').trim();
    if (!raw) { out.innerHTML = '<p class="tool-note">Type an ordering to have it checked.</p>'; return; }
    var order = raw.split(/[\s,>→]+/).filter(function (s) { return s; });

    var unknown = order.filter(function (v) { return !g.adj[v]; });
    if (unknown.length) {
      out.innerHTML = '<div class="verdict bad">Not vertices of this graph: ' +
        esc(unknown.join(', ')) + '</div>';
      return;
    }
    var c = tsCheck(g, order);
    out.innerHTML = '<div class="verdict ' + (c.ok ? 'safe' : 'bad') + '">' +
      (c.ok
        ? 'Valid. Every edge points forwards, and all ' + g.nV + ' vertices appear.'
        : (c.missing.length ? 'Missing: ' + esc(c.missing.join(', ')) + '. ' : '') +
          (c.backwards.length
            ? 'These edges point backwards: ' +
              c.backwards.map(function (e) { return esc(e.u + '→' + e.v); }).join(', ') +
              ' — each needs its source earlier than its target.'
            : '')) +
      '</div>';
  }

  function tsPreset(which) {
    var el = document.getElementById('ts-text');
    if (el) el.value = GR_PRESETS[which] || GR_PRESETS.dress;
    runTopo();
  }

  /* ---------- Tool 4 · strongly connected components ---------- */

  function runScc() {
    var out = document.getElementById('scc-output');
    if (!out) return;
    var g = grRead('scc-text', GR_PRESETS.scc);
    if (!g.ok) return grBadGraph('scc-output', g);
    if (!g.directed) {
      out.innerHTML = '<div class="verdict bad">Strong connectivity is a property of directed ' +
        'graphs — with undirected edges every connected component is trivially strongly connected. ' +
        'Write the edges with <code>&gt;</code>.</div>';
      return;
    }

    var nbr = ((document.getElementById('scc-nbr') || {}).value) || 'stack';
    var s = sccFind(g, { mode: nbr });
    var chk = sccCheck(g, s.components);
    var cd = sccCondense(g, s.components);

    var h = grSummary(g);
    h += '<div class="verdict ' + (chk.ok ? 'safe' : 'bad') + '">' +
      '<strong>' + s.count + ' components:</strong> ' +
      s.components.map(function (c) { return '{' + esc(c.join(', ')) + '}'; }).join(' &nbsp; ') +
      '<br>' + (chk.ok
        ? 'Checked straight against the definition — every pair inside a component reaches the ' +
          'other and comes back, and no vertex outside any component belongs in it ✓'
        : chk.why.join(' ')) +
      '</div>';

    h += '<div class="gr-trace" id="scc-trace">';
    h += '<div class="gr-row" data-step="0">' +
      '<span class="gr-n">1</span><span class="gr-at">pass&nbsp;1</span>' +
      '<span class="gr-note">Depth-first search on the original graph gives the finishing order, ' +
      'reversed: <strong>' + esc(s.order.join(' ')) + '</strong></span></div>';
    s.steps.forEach(function (st, i) {
      h += '<div class="gr-row took" data-step="' + (i + 1) + '">' +
        '<span class="gr-n">' + (i + 2) + '</span>' +
        '<span class="gr-at">' + esc(st.root) + '</span>' +
        '<span class="gr-queue">' + grChips(st.part) + '</span>' +
        '<span class="gr-note">' + esc(st.note) + '</span></div>';
    });
    h += '</div>';

    h += '<table class="results-table"><tr><th>Component graph</th><th>Edges</th></tr>' +
      cd.names.map(function (n, i) {
        var outs = cd.edges.filter(function (e) { return e.from === i; })
          .map(function (e) { return e.v; });
        return '<tr><td><code>' + esc(n) + '</code></td><td>' +
          (outs.length ? esc(outs.join('  ')) : '<span class="gr-empty">— a sink</span>') +
          '</td></tr>';
      }).join('') + '</table>';

    h += '<div class="verdict ' + (cd.acyclic ? 'safe' : 'bad') + '">' +
      (cd.acyclic
        ? 'The component graph is acyclic ✓ — the theorem, confirmed on this instance rather than ' +
          'quoted. If it had a cycle, every vertex on that cycle would reach every other and come ' +
          'back, so they would all have been one component in the first place.'
        : 'The component graph has a cycle, which contradicts the theorem — something is wrong.') +
      '</div>';

    h += '<p class="tool-note">Why the transpose? Pass one finds everything <em>u</em> can reach. ' +
      'Pass two, on the reversed graph, finds everything that can reach <em>u</em>. A vertex in both ' +
      'sets sits on a round trip through <em>u</em> — which is precisely the definition of being in ' +
      'the same component. The finishing order matters because it makes the second pass stop at the ' +
      'component boundary instead of spilling into the next one.</p>';

    out.innerHTML = h;
    ixTrace('scc', 'scc-output', { label: 'pass', reset: true });
  }

  function sccPreset(which) {
    var el = document.getElementById('scc-text');
    if (el) el.value = GR_PRESETS[which] || GR_PRESETS.scc;
    runScc();
  }
