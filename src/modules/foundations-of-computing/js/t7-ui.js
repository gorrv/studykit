  /* ============================================================
     TOPIC 07 · rendering for the five TSP tools
     ============================================================ */

  function tspRead(id, fallback) {
    var el = document.getElementById(id);
    return tspParse((el ? el.value : fallback) || fallback);
  }

  function tspBad(outId, g) {
    var out = document.getElementById(outId);
    if (out) out.innerHTML = '<div class="verdict bad">' + g.error + '</div>';
  }

  function tspSummary(g) {
    return '<div class="rd-stats">' +
      '<span class="stat-pill a">' + g.n + ' vertices</span>' +
      '<span class="stat-pill a">' + (g.n * (g.n - 1) / 2) + ' edges</span>' +
      '<span class="stat-pill dark">' + (g.mode === 'points' ? 'Euclidean' : 'explicit distances') + '</span>' +
      '<span class="stat-pill ' + (g.metric.ok ? 'b' : 'warn') + '">' +
        (g.metric.ok ? 'satisfies the triangle inequality' : 'violates the triangle inequality') +
      '</span></div>';
  }

  /** A tour drawn on the plane. Only possible in point mode -- with
      an explicit matrix there are no coordinates to draw. */
  function tspDraw(g, tour, extra) {
    if (g.mode !== 'points') return '';
    var V = g.vertices, W = 380, H = 260, pad = 26;
    var xs = V.map(function (v) { return g.pts[v][0]; });
    var ys = V.map(function (v) { return g.pts[v][1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var sx = (x1 - x0) || 1, sy = (y1 - y0) || 1;
    function px(v) { return pad + (g.pts[v][0] - x0) / sx * (W - 2 * pad); }
    function py(v) { return pad + (g.pts[v][1] - y0) / sy * (H - 2 * pad); }

    var s = '<svg class="tsp-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="tour of ' + V.length + ' points">';

    // Faint background: every available edge.
    for (var i = 0; i < V.length; i++) {
      for (var j = i + 1; j < V.length; j++) {
        s += '<line class="tsp-bg" x1="' + px(V[i]) + '" y1="' + py(V[i]) +
             '" x2="' + px(V[j]) + '" y2="' + py(V[j]) + '"/>';
      }
    }
    // Optional highlighted set (the spanning tree, say).
    (extra || []).forEach(function (e) {
      s += '<line class="tsp-tree" x1="' + px(e.u) + '" y1="' + py(e.u) +
           '" x2="' + px(e.v) + '" y2="' + py(e.v) + '"/>';
    });
    // The tour itself.
    if (tour) {
      for (var k = 0; k < tour.length; k++) {
        var a = tour[k], b = tour[(k + 1) % tour.length];
        s += '<line class="tsp-tour" x1="' + px(a) + '" y1="' + py(a) +
             '" x2="' + px(b) + '" y2="' + py(b) + '"/>';
      }
    }
    V.forEach(function (v) {
      s += '<circle class="tsp-node" cx="' + px(v) + '" cy="' + py(v) + '" r="11"/>' +
           '<text class="tsp-label" x="' + px(v) + '" y="' + (py(v) + 4) + '">' + esc(v) + '</text>';
    });
    return s + '</svg>';
  }

  /* ---------- Tool 1 · the 2OPT algorithm ---------- */

  function twoOptPreset(which) {
    var el = document.getElementById('to-text');
    if (el) el.value = TSP_PRESETS[which] || TSP_PRESETS.worked;
    runTwoOpt();
  }

  function runTwoOpt() {
    var out = document.getElementById('to-output');
    if (!out) return;
    var g = tspRead('to-text', TSP_PRESETS.worked);
    if (!g.ok) return tspBad('to-output', g);

    var pick = ((document.getElementById('to-pick') || {}).value) || 'best';
    var run = tspTwoOpt(g, { pick: pick });
    var brute = tspBrute(g);

    var h = tspSummary(g);

    if (brute.ok) {
      var r = tspRatio(run.length, brute.length);
      h += '<div class="verdict ' + (r.ratio <= 2.0000001 ? 'safe' : 'warn') + '">' +
        '2OPT returns <strong>' + run.tour.join(' → ') + ' → ' + run.tour[0] + '</strong>' +
        ' of length <strong>' + run.length.toFixed(4) + '</strong>, after ' +
        run.steps.filter(function (s) { return s.move; }).length + ' swap' +
        (run.steps.filter(function (s) { return s.move; }).length === 1 ? '' : 's') + '.<br>' +
        'Brute force over all ' + brute.searched + ' tours finds the true optimum: <strong>' +
        brute.length.toFixed(4) + '</strong>.<br>' +
        'Achieved ratio <strong>' + r.ratio.toFixed(4) + '</strong>' +
        (r.ratio < 1.0000001
          ? ' — 2OPT happened to land on the optimum here.'
          : ' — the guarantee is 2, and this is well inside it.') +
        (g.metric.ok ? '' : '<br><strong>But d violates the triangle inequality</strong>, so the ' +
          'guarantee does not apply to this instance at all.') +
        '</div>';
    } else {
      h += '<div class="verdict warn">2OPT returns length <strong>' + run.length.toFixed(4) +
        '</strong>. Too many vertices to check against brute force (' + esc(brute.error) + ')</div>';
    }

    h += '<div class="tsp-panes">' +
      '<div class="tsp-pane"><div class="tsp-cap">Minimum spanning tree — weight ' +
        run.mst.weight.toFixed(4) + '</div>' + tspDraw(g, null, run.mst.tree) + '</div>' +
      '<div class="tsp-pane"><div class="tsp-cap">Final tour — ' + run.length.toFixed(4) + '</div>' +
        tspDraw(g, run.tour) + '</div></div>';

    h += '<div class="gr-trace" id="to-trace">';
    run.steps.forEach(function (s, i) {
      h += '<div class="gr-row ' + (s.done ? 'took' : '') + '" data-step="' + i + '">' +
        '<span class="gr-n">' + s.n + '</span>' +
        '<span class="gr-at">' + s.length.toFixed(3) + '</span>' +
        '<span class="gr-queue">' + s.tour.map(function (v) {
          return '<span class="gr-chip">' + esc(v) + '</span>';
        }).join('') + '</span>' +
        '<span class="gr-note">' + esc(s.note) + '</span></div>';
    });
    h += '</div>';

    h += '<p class="tool-note">The three stages are worth separating. Step 1 builds a ' +
      '<strong>minimum spanning tree</strong>; step 2 walks it in <strong>preorder</strong>, which ' +
      'gives a tour costing at most twice the tree; step 3 applies <strong>swaps</strong>, each of ' +
      'which only ever shortens it. That chain is the whole proof of the ratio 2 — and note that ' +
      'the swaps are not what earns the guarantee. The guarantee is already there after step 2; ' +
      'the swaps just make the answer better in practice.<br><br>' +
      'The <em>which swap</em> control matters: SWAP-MOVE as usually written returns the ' +
      '<em>first</em> improving pair it finds, but its worked example takes the <em>best</em> one ' +
      'each round — which is why the worked answer takes two swaps where first-improvement ' +
      'needs six. Both are 2-opt, and here both finish in the same place.</p>';

    out.innerHTML = h;
    ixTrace('to', 'to-output', { label: 'swap', reset: true });
  }

  /* ---------- Tool 2 · one swap, and the trap ---------- */

  function runSwap() {
    var out = document.getElementById('sw-output');
    if (!out) return;
    var g = tspRead('sw-text', TSP_PRESETS.worked);
    if (!g.ok) return tspBad('sw-output', g);

    var raw = ((document.getElementById('sw-tour') || {}).value || '').trim();
    var tour = raw ? raw.split(/[\s,>→]+/).filter(function (s) { return s; }) : g.vertices.slice();
    var unknown = tour.filter(function (v) { return g.vertices.indexOf(v) < 0; });
    if (unknown.length || tour.length !== g.n) {
      out.innerHTML = '<div class="verdict bad">' +
        (unknown.length ? 'Not vertices of this instance: ' + esc(unknown.join(', ')) + '. '
                        : 'A tour must list all ' + g.n + ' vertices exactly once.') + '</div>';
      return;
    }

    var i = parseInt(((document.getElementById('sw-i') || {}).value), 10);
    var j = parseInt(((document.getElementById('sw-j') || {}).value), 10);
    if (!isFinite(i)) i = 0;
    if (!isFinite(j)) j = 2;
    i = Math.max(0, Math.min(tour.length - 2, i));
    j = Math.max(i + 2, Math.min(tour.length - 1, j));
    if (i === 0 && j === tour.length - 1) j = tour.length - 2;

    var rec = tspReconnect(tour, i, j);
    var before = tspLen(g, tour), after = tspLen(g, rec.good.tour);
    var pairBefore = g.d(rec.x, rec.y) + g.d(rec.u, rec.v);
    var pairAfter = g.d(rec.x, rec.u) + g.d(rec.y, rec.v);

    var h = tspSummary(g);
    h += '<div class="verdict ' + (pairAfter < pairBefore ? 'safe' : 'warn') + '">' +
      'Removing (' + rec.x + ',' + rec.y + ') and (' + rec.u + ',' + rec.v + ') — costing ' +
      pairBefore.toFixed(4) + ' — and reconnecting as (' + rec.x + ',' + rec.u + ') and (' +
      rec.y + ',' + rec.v + ') — costing ' + pairAfter.toFixed(4) + '.<br>' +
      (pairAfter < pairBefore
        ? 'That is an improvement of ' + (pairBefore - pairAfter).toFixed(4) +
          ', so 2OPT would take it. Tour ' + before.toFixed(4) + ' → ' + after.toFixed(4) + '.'
        : 'That is not an improvement, so 2OPT would leave the tour alone.') +
      '</div>';

    h += '<div class="tsp-panes">' +
      '<div class="tsp-pane"><div class="tsp-cap">Before — ' + before.toFixed(4) + '</div>' +
        tspDraw(g, tour) + '</div>' +
      '<div class="tsp-pane"><div class="tsp-cap">After the valid reconnection — ' +
        after.toFixed(4) + '</div>' + tspDraw(g, rec.good.tour) + '</div></div>';

    h += '<table class="results-table">' +
      '<tr><th>Reconnection</th><th>Edges added</th><th>Result</th></tr>' +
      '<tr><td><strong>(' + rec.x + ',' + rec.u + ') and (' + rec.y + ',' + rec.v + ')</strong></td>' +
        '<td>joins each path to the <em>other</em></td>' +
        '<td>one tour: ' + esc(rec.good.tour.join(' ')) + ' ✓</td></tr>' +
      '<tr><td>(' + rec.y + ',' + rec.u + ') and (' + rec.v + ',' + rec.x + ')</td>' +
        '<td>joins each path to <em>itself</em></td>' +
        '<td>two separate cycles: {' + esc(rec.bad.cycles[0].join(' ')) + '} and {' +
          esc(rec.bad.cycles[1].join(' ')) + '} ✗</td></tr>' +
      '</table>';

    h += '<p class="tool-note">This is what Step 4 — &ldquo;make sure the swap ' +
      'does not disconnect the graph&rdquo; — is guarding against, and it is easy to get backwards. ' +
      'Removing two edges leaves two <strong>paths</strong>. Each has two ends. Joining end-to-end ' +
      '<em>across</em> the two paths gives a single tour; joining each path&rsquo;s own two ends ' +
      'gives two disjoint cycles that visit every vertex but are not a tour.<br><br>' +
      'In tour terms the valid move is simply &ldquo;<strong>reverse the segment between the two ' +
      'removed edges</strong>&rdquo;, which is why 2-opt is usually stated that way rather than as ' +
      'a choice of which pair of new edges to add.</p>';

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · approximation ratio ---------- */

  function runRatio() {
    var out = document.getElementById('ra-output');
    if (!out) return;
    var raw = ((document.getElementById('ra-rows') || {}).value || '').trim();
    var claimed = parseFloat(((document.getElementById('ra-R') || {}).value));
    if (!isFinite(claimed) || claimed <= 0) claimed = 2;

    var rows = [], bad = [];
    raw.split(/\n+/).forEach(function (line, n) {
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      var p = line.split(/[\s,]+/).filter(function (s) { return s; });
      if (p.length < 2 || !isFinite(p[p.length - 2]) || !isFinite(p[p.length - 1])) {
        bad.push(line); return;
      }
      rows.push({
        name: p.length > 2 ? p.slice(0, p.length - 2).join(' ') : 'input ' + (n + 1),
        approx: parseFloat(p[p.length - 2]),
        optimal: parseFloat(p[p.length - 1])
      });
    });

    if (bad.length) {
      out.innerHTML = '<div class="verdict bad">Cannot read: ' + esc(bad[0]) +
        '<br>Each line is <code>name approximate optimal</code>, e.g. <code>graph1 19 14</code>.</div>';
      return;
    }
    if (!rows.length) {
      out.innerHTML = '<p class="tool-note">Add a line like <code>graph1 19 14</code>.</p>';
      return;
    }

    var a = apAssess(rows, claimed);
    var h = '<div class="verdict ' + (a.consistent ? 'safe' : 'bad') + '">' + esc(a.note) + '</div>';

    h += '<table class="results-table">' +
      '<tr><th>Input</th><th>C<sub>approx</sub></th><th>C<sub>global</sub></th>' +
      '<th>R<sub>M</sub>(w)</th><th></th></tr>' +
      rows.map(function (r) {
        var over = r.ratio > claimed + 1e-9;
        return '<tr><td>' + esc(r.name) + '</td><td>' + r.approx + '</td><td>' + r.optimal +
          '</td><td><strong>' + r.ratio.toFixed(4) + '</strong></td><td>' +
          (over ? 'exceeds R = ' + claimed : '') + '</td></tr>';
      }).join('') + '</table>';

    h += '<p class="tool-note">The definition is deliberately symmetric — ' +
      '<code>R<sub>M</sub>(w) = max(C<sub>approx</sub>/C<sub>global</sub>, ' +
      'C<sub>global</sub>/C<sub>approx</sub>)</code> — so that it is <strong>always at least ' +
      '1</strong> whether the problem is a minimisation or a maximisation. For TSP, a minimisation, ' +
      'the approximate tour can never beat the optimum, so in practice it is always the first of ' +
      'the two.<br><br>' +
      'And a warning the table cannot give you: being <em>R</em>-approximable means ' +
      'R<sub>M</sub>(w) ≤ R for <strong>every</strong> input w. A table of examples can refute a ' +
      'claimed ratio but never establish one.</p>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · the unapproximability gadget ---------- */

  function gadPreset(which) {
    var el = document.getElementById('ga-text');
    if (el) el.value = (AP_PRESETS[which] || AP_PRESETS.ham).replace(/>/g, '-');
    runGadget();
  }

  function runGadget() {
    var out = document.getElementById('ga-output');
    if (!out) return;
    var el = document.getElementById('ga-text');
    var G = grParse((el ? el.value : AP_PRESETS.ham.replace(/>/g, '-')) ||
                    AP_PRESETS.ham.replace(/>/g, '-'));
    if (!G.ok) { out.innerHTML = '<div class="verdict bad">' + esc(G.error) + '</div>'; return; }

    var R = parseFloat(((document.getElementById('ga-R') || {}).value));
    if (!isFinite(R) || R <= 0) R = 2;

    var r = apUnapprox(G, R);
    if (!r.ok) { out.innerHTML = '<div class="verdict bad">' + esc(r.error) + '</div>'; return; }

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + r.gadget.n + ' vertices</span>' +
      '<span class="stat-pill a">' + r.gadget.shortCount + ' edges of G, cost 1</span>' +
      '<span class="stat-pill dark">' + r.gadget.longCount + ' non-edges, cost nR+1 = ' +
        r.gadget.long + '</span></div>';

    h += '<div class="verdict ' + (r.agrees ? 'safe' : 'bad') + '">' +
      'Shortest tour in G′ is <strong>' + r.optimal.toFixed(0) + '</strong>, and the threshold ' +
      'nR is <strong>' + r.threshold + '</strong>.<br>' +
      'So the tour is ' + (r.short ? '' : '<strong>not</strong> ') + 'short, and G ' +
      (r.hasHam ? 'does' : 'does <strong>not</strong>') + ' have a Hamiltonian cycle — ' +
      (r.agrees ? 'the two agree, as the theorem requires ✓' : 'THEY DISAGREE ✗') +
      (r.hasHam
        ? '<br>With a Hamiltonian cycle available the optimum is exactly n = ' + r.gadget.n +
          ', because every edge of it costs 1.'
        : '<br>Without one, every tour must use at least one non-edge, so it costs at least ' +
          '(n−1) + (nR+1) = ' + ((r.gadget.n - 1) + r.gadget.long) + ' > nR.') +
      '</div>';

    h += '<div class="gr-trace" id="ga-trace">';
    [
      ['1', 'Suppose some polynomial-time algorithm approximates TSP within a ratio R = ' + R + '.'],
      ['2', 'Take any instance G of HAMILTONIAN — an NP-complete problem.'],
      ['3', 'Build the complete graph G′ with d(x,y) = 1 for edges of G and nR+1 = ' +
            r.gadget.long + ' for non-edges.'],
      ['4', 'If G has a Hamiltonian cycle then the optimum is n = ' + r.gadget.n +
            ', so the approximation returns at most R·n = ' + r.threshold + '. ' +
            'If it does not, every tour costs more than ' + r.threshold + '.'],
      ['5', 'So testing "is the returned tour ≤ nR?" decides HAMILTONIAN in polynomial time.'],
      ['6', 'That would put an NP-complete problem in P. Assuming P ≠ NP, no such approximation ' +
            'algorithm exists — general TSP is unapproximable.']
    ].forEach(function (row, i) {
      h += '<div class="gr-row" data-step="' + i + '">' +
        '<span class="gr-n">' + row[0] + '</span>' +
        '<span class="gr-note">' + esc(row[1]) + '</span></div>';
    });
    h += '</div>';

    h += '<div class="verdict ' + (r.metric.ok ? 'warn' : 'safe') + '">' +
      (r.metric.ok
        ? 'Note: for this particular graph the constructed d happens to satisfy the triangle ' +
          'inequality, so it is not itself a counterexample to 2-approximability. Try a graph with ' +
          'more non-edges.'
        : 'And d violates the triangle inequality — ' + esc(r.metric.worst.x) + '→' +
          esc(r.metric.worst.z) + ' costs ' + r.metric.worst.direct + ' directly but only ' +
          r.metric.worst.via + ' via ' + esc(r.metric.worst.y) + '. That is exactly the assumption ' +
          'the 2-approximation needs and does not have here, which is how both theorems can be true ' +
          'at once.') + '</div>';

    h += '<p class="tool-note">The construction is doing something specific: it makes the gap ' +
      'between &ldquo;has a Hamiltonian cycle&rdquo; and &ldquo;does not&rdquo; <strong>bigger than ' +
      'any fixed ratio R</strong> — because nR+1 was chosen after R was fixed. That is why the ' +
      'conclusion is not &ldquo;no 2-approximation&rdquo; but &ldquo;no R-approximation, for any ' +
      'R&rdquo;. Change R above and watch the long edge grow to stay ahead of it.</p>';

    out.innerHTML = h;
    ixTrace('ga', 'ga-output', { label: 'step', reset: true });
  }

  /* ---------- Tool 5 · TSP from TSP-dec by binary search ---------- */

  function runBisect() {
    var out = document.getElementById('bi-output');
    if (!out) return;
    var g = tspRead('bi-text', TSP_PRESETS.square);
    if (!g.ok) return tspBad('bi-output', g);

    var which = ((document.getElementById('bi-cond') || {}).value) || 'correct';
    var run = apBinarySearch(g, { buggy: which === 'printed' });
    if (!run.ok) { out.innerHTML = '<div class="verdict bad">' + esc(run.error) + '</div>'; return; }

    var h = tspSummary(g);
    h += '<div class="verdict ' + (run.ranAtAll && run.correct ? 'safe' : 'bad') + '">' +
      (run.ranAtAll
        ? 'After ' + run.calls + ' calls to TSP-DEC the interval has closed to [' +
          run.lo.toFixed(4) + ', ' + run.hi.toFixed(4) + '], and the true optimum is ' +
          run.truth.toFixed(4) + ' — inside it ' + (run.correct ? '✓' : '✗')
        : '<strong>The loop never executed.</strong> Its condition asks the interval to be ' +
          '<em>smaller</em> than the shortest edge before it will do any work — but the interval ' +
          'starts at ' + run.total.toFixed(4) + ' and the shortest edge is ' +
          run.shortest.toFixed(4) + ', so the test is false immediately and the algorithm returns ' +
          'a route it never computed.') +
      '</div>';

    h += '<div class="gr-trace" id="bi-trace">';
    run.steps.forEach(function (s, i) {
      h += '<div class="gr-row ' + (s.yes === true ? 'took' : s.yes === false ? 'skipped' : '') +
        '" data-step="' + i + '">' +
        '<span class="gr-n">' + s.n + '</span>' +
        '<span class="gr-at">' + (s.mid === null ? '—' : s.mid.toFixed(3)) + '</span>' +
        '<span class="gr-queue"><span class="gr-chip">[' + s.lo.toFixed(2) + ', ' +
          s.hi.toFixed(2) + ']</span></span>' +
        '<span class="gr-note">' + esc(s.note) + '</span></div>';
    });
    h += '</div>';

    h += '<p class="tool-note">This is the proof that the optimisation and decision versions stand ' +
      'or fall together. One direction is trivial — solve TSP, then compare with D. The other is ' +
      'this binary search: each call to TSP-DEC halves the interval, and O(log) calls pin the ' +
      'optimum to within the shortest edge, which is enough because no tour length can fall ' +
      'strictly between two achievable values closer than that.<br><br>' +
      '<strong>The loop condition is usually written the wrong way round.</strong> It says continue ' +
      '<em>while</em> the interval is smaller than the shortest edge; it should stop then. Switch ' +
      'the control above to see: as written, the loop body never runs at all.</p>';

    out.innerHTML = h;
    ixTrace('bi', 'bi-output', { label: 'call', reset: true });
  }

  function biPreset(which) {
    var el = document.getElementById('bi-text');
    if (el) el.value = TSP_PRESETS[which] || TSP_PRESETS.square;
    runBisect();
  }
