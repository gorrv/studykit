  /* ============================================================
     SMT TOPIC 03 · rendering

     Layout and HTML only. Every number shown here comes from
     t3-structural.js, which knows nothing about the DOM.
     ============================================================ */

  var SG_ONCE = {};
  function sgOnce(key, fn) {
    if (!(key in SG_ONCE)) SG_ONCE[key] = fn();
    return SG_ONCE[key];
  }

  /* ---------------------------------------------------------------
     A layered layout for a flow graph.

     Depth is distance from the entry, so the drawing runs top to
     bottom the way the program does; nodes at the same depth are
     spread across the row. Edges that go backwards or sideways are
     drawn as curves so they do not disappear behind the nodes they
     pass. Purely presentational: nothing below is used by any
     assertion.
     --------------------------------------------------------------- */

  function sgLayout(g, labels) {
    var depth = {}, i;
    var entry = g.nodes.filter(function (n) { return sgIndeg(g, n) === 0; });
    var roots = entry.length ? entry : [g.nodes[0]];
    roots.forEach(function (r) { depth[r] = 0; });

    var queue = roots.slice();
    while (queue.length) {
      var n = queue.shift();
      sgSucc(g, n).forEach(function (m) {
        if (!(m in depth)) { depth[m] = depth[n] + 1; queue.push(m); }
      });
    }
    /* anything the entry cannot reach goes in a row of its own */
    var maxd = 0;
    g.nodes.forEach(function (n) { if (n in depth) maxd = Math.max(maxd, depth[n]); });
    g.nodes.forEach(function (n) { if (!(n in depth)) depth[n] = maxd + 1; });

    var rows = {};
    g.nodes.forEach(function (n) { (rows[depth[n]] = rows[depth[n]] || []).push(n); });

    var W = 420, rowH = 62, pad = 34;
    var depths = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    var pos = {};
    depths.forEach(function (d, ri) {
      var row = rows[d], step = W / (row.length + 1);
      row.forEach(function (n, k) {
        pos[n] = { x: step * (k + 1), y: pad + ri * rowH };
      });
    });
    return { pos: pos, depth: depth, width: W, height: pad * 2 + (depths.length - 1) * rowH };
  }

  /* Each drawing needs its own arrowhead ids: two SVGs in the page
     carrying the same id is a duplicate id, which the structural
     checks reject — and rightly, since the second definition is the
     one every arrow in both pictures would end up using. */
  var SG_DRAW_N = 0;

  function sgDraw(g, opts) {
    opts = opts || {};
    var uid = 'sg-ar-' + (++SG_DRAW_N);
    var lay = sgLayout(g);
    var pos = lay.pos, R = 15;
    var hotN = opts.nodes || {}, hotE = opts.edges || {};
    var groups = opts.groups || null;        /* node -> group index, for DD-paths */

    var s = '<svg viewBox="0 0 ' + lay.width + ' ' + lay.height + '" width="100%" ' +
      'style="max-height:420px;" role="img" aria-label="' +
      esc(opts.alt || 'the flow graph') + '">';

    s += '<defs><marker id="' + uid + '" viewBox="0 0 8 8" refX="7" refY="4" ' +
      'markerWidth="6" markerHeight="6" orient="auto">' +
      '<path d="M0,0 L8,4 L0,8 z" fill="var(--ink-muted)"/></marker>' +
      '<marker id="' + uid + '-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" ' +
      'markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--accent-3)"/>' +
      '</marker></defs>';

    /* the DD-path rings go underneath everything */
    if (groups) {
      var byGroup = {};
      Object.keys(groups).forEach(function (n) {
        (byGroup[groups[n]] = byGroup[groups[n]] || []).push(+n);
      });
      Object.keys(byGroup).forEach(function (k) {
        var ns = byGroup[k];
        if (ns.length < 2) return;
        var xs = ns.map(function (n) { return pos[n].x; });
        var ys = ns.map(function (n) { return pos[n].y; });
        var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
        var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
        s += '<rect x="' + (x0 - R - 6).toFixed(1) + '" y="' + (y0 - R - 6).toFixed(1) +
          '" width="' + (x1 - x0 + 2 * R + 12).toFixed(1) + '" height="' +
          (y1 - y0 + 2 * R + 12).toFixed(1) + '" rx="16" fill="none" ' +
          'stroke="var(--accent-2)" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.8"/>';
      });
    }

    g.edges.forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]];
      var hot = hotE[e[0] + '>' + e[1]];
      var stroke = hot ? 'var(--accent-3)' : 'var(--ink-muted)';
      var w = hot ? 2.4 : 1.2;
      var mk = 'url(#' + uid + (hot ? '-hot' : '') + ')';
      if (e[0] === e[1]) {
        /* self-loop: a small circle off to the right */
        s += '<path d="M' + (a.x + R * 0.7).toFixed(1) + ',' + (a.y - R * 0.7).toFixed(1) +
          ' a 14,12 0 1,1 -3,' + (R * 1.3).toFixed(1) + '" fill="none" stroke="' + stroke +
          '" stroke-width="' + w + '" marker-end="' + mk + '"/>';
        return;
      }
      var dx = b.x - a.x, dy = b.y - a.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ax = a.x + dx / len * R, ay = a.y + dy / len * R;
      var bx = b.x - dx / len * (R + 4), by = b.y - dy / len * (R + 4);
      if (dy <= 0) {
        /* backwards or sideways: bow it out so it stays readable */
        var cx = (ax + bx) / 2 + 58, cy = (ay + by) / 2;
        s += '<path d="M' + ax.toFixed(1) + ',' + ay.toFixed(1) + ' Q' + cx.toFixed(1) +
          ',' + cy.toFixed(1) + ' ' + bx.toFixed(1) + ',' + by.toFixed(1) +
          '" fill="none" stroke="' + stroke + '" stroke-width="' + w +
          '" marker-end="' + mk + '"/>';
        return;
      }
      s += '<line x1="' + ax.toFixed(1) + '" y1="' + ay.toFixed(1) + '" x2="' +
        bx.toFixed(1) + '" y2="' + by.toFixed(1) + '" stroke="' + stroke +
        '" stroke-width="' + w + '" marker-end="' + mk + '"/>';
    });

    g.nodes.forEach(function (n) {
      var p = pos[n], on = hotN[n];
      s += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + R +
        '" fill="var(--surface)" stroke="' + (on ? 'var(--accent-3)' : 'var(--accent)') +
        '" stroke-width="' + (on ? 2.6 : 1.5) + '"/>';
      s += '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) +
        '" text-anchor="middle" dominant-baseline="central" font-size="11" ' +
        'font-family="IBM Plex Mono, monospace" fill="var(--ink)">' + n + '</text>';
    });

    return s + '</svg>';
  }

  /* ---------- Tool 1 · a program, as a graph ---------- */

  function runFlowGraph() {
    var out = document.getElementById('fg-output');
    if (!out) return;
    var which = ((document.getElementById('fg-prog') || {}).value) || 'two conditions';
    var show = ((document.getElementById('fg-show') || {}).value) || 'dd';
    var preset = PG_PRESETS[which];
    if (!preset) { out.innerHTML = ''; return; }

    var prog = pgParse(preset.src);
    if (!prog.ok) {
      out.innerHTML = '<div class="tool-error">' + esc(prog.error) + '</div>';
      return;
    }
    var g = pgGraph(prog);
    var dd = sgDDGraph(g);

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">' + g.nodes.length + ' nodes</span>' +
      '<span class="stat-pill dark">' + g.edges.length + ' edges</span>' +
      '<span class="stat-pill b">' + dd.paths.length + ' DD-paths</span>' +
      '<span class="stat-pill b">' + dd.edges.length + ' DD-edges</span>' +
      '<span class="stat-pill a">V(G) = ' + sgCyclomatic(g) + '</span></div>';

    h += '<div class="sg-split"><div class="sg-code"><pre class="st-snippet">' +
      esc(preset.src) + '</pre></div><div class="sg-pic">';
    h += sgDraw(g, { groups: show === 'dd' ? dd.owner : null,
                     alt: 'the flow graph of the program' });
    h += '</div></div>';

    h += '<div class="st-cap">what each node is</div>';
    h += '<table class="st-table"><thead><tr><th>node</th><th>statement</th>' +
      '<th>goes to</th><th>DD-path</th></tr></thead><tbody>';
    g.labels.forEach(function (n) {
      var outs = g.tags.filter(function (e) { return e.from === n.id; })
        .map(function (e) { return (e.tag ? e.tag + ' &rarr; ' : '&rarr; ') + e.to; });
      h += '<tr><td><code>' + n.id + '</code></td><td><code>' + esc(n.label) +
        '</code></td><td>' + (outs.join(', ') || '<span class="st-dim">nothing</span>') +
        '</td><td><code>' + sgShowSet(dd.paths[dd.owner[n.id]]) + '</code></td></tr>';
    });
    h += '</tbody></table>';

    if (show === 'dd') {
      h += '<div class="st-cap">the DD-path graph</div>';
      h += '<table class="st-table"><tbody><tr><th>nodes</th><td>' +
        dd.paths.map(function (p) { return '<code>' + sgShowSet(p) + '</code>'; }).join(' ') +
        '</td></tr><tr><th>edges</th><td>' +
        dd.edges.map(function (e) {
          return '<code>' + sgShowSet(dd.paths[e[0]]) + '&rarr;' +
            sgShowSet(dd.paths[e[1]]) + '</code>';
        }).join(' ') + '</td></tr></tbody></table>';

      var flow = g.nodes.length + g.edges.length, ddc = dd.paths.length + dd.edges.length;
      h += '<div class="tool-note">Checking DD-path coverage here means ' + ddc +
        ' checks where edge coverage means ' + flow + '. ' +
        (ddc === flow
          ? 'No saving on this program &mdash; nothing in it is a chain of more than one ' +
            'statement, so every DD-path is a single node.'
          : 'The saving is exactly the statements that had nowhere else to go.') +
        '</div>';
    } else {
      h += '<div class="st-cap">every prime path</div><div class="sg-paths">' +
        sgPrimePaths(g).map(function (p) {
          return '<code>' + p.join('&rarr;') + '</code>';
        }).join('') + '</div>';
    }

    h += '<div class="tool-note">' + esc(preset.note) + '</div>';
    out.innerHTML = h;
  }

  function sgShowSet(p) {
    if (!p) return '?';
    return p.length === 1 ? String(p[0]) : '{' + p.join(',') + '}';
  }

  /* ---------- Tool 2 · a test set, measured ---------- */

  function runCoverage() {
    var out = document.getElementById('cv-output');
    if (!out) return;
    var raw = ((document.getElementById('cv-inputs') || {}).value) || '3222, 30';
    var xs = raw.split(/[^0-9-]+/).filter(function (t) { return t.length; })
      .map(function (t) { return parseInt(t, 10); })
      .filter(function (v) { return !isNaN(v); });

    if (!xs.length) {
      out.innerHTML = '<div class="tool-error">Give me at least one input ' +
        'value &mdash; try <code>3222, 30</code>.</div>';
      return;
    }
    xs = xs.slice(0, 12);

    var prog = pgParse(PG_PRESETS['two conditions'].src);
    var g = pgGraph(prog);
    var rows = xs.map(function (x) {
      var r = pgRun(prog, { x: x });
      var want = pgSpec50(x);
      return { x: x, got: r.ok ? r.value : null, want: want,
               pass: r.ok && r.value === want, trace: r.trace };
    });
    var cov = sgCoverage(g, rows.map(function (r) { return r.trace; }));
    var fails = rows.filter(function (r) { return !r.pass; });

    var h = '<table class="st-table"><thead><tr><th>input</th><th>path taken</th>' +
      '<th>wanted</th><th>got</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td><code>' + r.x + '</code></td><td><code>' + r.trace.join('&rarr;') +
        '</code></td><td><code>' + r.want + '</code></td><td><code' +
        (r.pass ? '' : ' class="st-bad"') + '>' + r.got + '</code></td>' +
        '<td><span class="stat-pill ' + (r.pass ? 'b' : 'c') + '">' +
        (r.pass ? 'P' : 'F') + '</span></td></tr>';
    });
    h += '</tbody></table>';

    var hotN = {}, hotE = {};
    rows.forEach(function (r) {
      r.trace.forEach(function (n) { hotN[n] = true; });
      for (var i = 0; i + 1 < r.trace.length; i++) hotE[r.trace[i] + '>' + r.trace[i + 1]] = true;
    });
    h += '<div class="sg-pic">' + sgDraw(g, { nodes: hotN, edges: hotE,
      alt: 'the flow graph with the covered nodes and edges marked' }) + '</div>';

    function bar(label, hit, of, note) {
      var pc = of ? Math.round(hit / of * 100) : 100;
      return '<div class="sg-bar-row"><span class="sg-bar-l">' + label + '</span>' +
        '<span class="sg-bar"><span class="sg-bar-fill' + (hit === of ? ' done' : '') +
        '" style="width:' + pc + '%"></span></span>' +
        '<span class="sg-bar-n">' + hit + '/' + of + '</span>' +
        '<span class="sg-bar-note">' + (note || '') + '</span></div>';
    }
    h += '<div class="st-cap">what this test set covers</div>';
    h += bar('statements', cov.nodes.hit, cov.nodes.of, '');
    h += bar('edges', cov.edges.hit, cov.edges.of, '');
    h += bar('DD-paths', cov.ddNodes.hit, cov.ddNodes.of, '');
    h += bar('DD-edges', cov.ddEdges.hit, cov.ddEdges.of, '');
    h += bar('prime paths', cov.prime.hit, cov.prime.of, '');

    var adequate = cov.nodes.hit === cov.nodes.of && cov.edges.hit === cov.edges.of;
    h += '<div class="verdict ' + (adequate && !fails.length ? 'bad' :
                                   adequate ? 'safe' : '') + '">';
    if (adequate && !fails.length) {
      h += '<strong>Adequate, and wrong.</strong> Every statement and every edge is ' +
        'covered, every test passes, and the program still does not meet its ' +
        'specification. That is the whole argument against stopping at DD-path ' +
        'coverage.';
    } else if (adequate) {
      h += 'Adequate for statement and DD-path coverage, and it found something: ' +
        fails.map(function (r) { return '<code>' + r.x + '</code>'; }).join(', ') + '.';
    } else {
      h += 'Not adequate yet &mdash; ' +
        (cov.nodes.hit < cov.nodes.of
          ? 'statements ' + cov.nodes.missing.join(', ') + ' never run.'
          : 'the edges ' + cov.edges.missing.map(function (e) {
              return e[0] + '&rarr;' + e[1]; }).join(', ') + ' are never taken.');
    }
    h += '</div>';

    if (cov.prime.hit < cov.prime.of) {
      h += '<div class="tool-note">Prime paths still missing: ' +
        cov.prime.missing.map(function (p) {
          return '<code>' + p.join('&rarr;') + '</code>';
        }).join(' ') + '. Only one input in the whole range takes ' +
        '<code>0&rarr;1&rarr;2&rarr;3&rarr;4</code>, and it is the input that fails.</div>';
    }
    out.innerHTML = h;
  }

  /* ---------- Tool 3 · the whole input range ---------- */

  function runSweep() {
    var out = document.getElementById('sw-output');
    if (!out) return;
    var top = parseInt(((document.getElementById('sw-top') || {}).value) || '65536', 10);
    if (isNaN(top) || top < 1) top = 65536;
    top = Math.min(top, 65536);

    var sweep = sgOnce('sweep' + top, function () { return pgSweep(top); });
    var prog = pgParse(PG_PRESETS['two conditions'].src);

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">' + sweep.checked.toLocaleString() + ' inputs</span>' +
      '<span class="stat-pill ' + (sweep.failing.length ? 'c' : 'b') + '">' +
      sweep.failing.length + ' disagree</span></div>';

    h += '<div class="st-cap">the four inputs the notes tabulate</div>';
    h += '<table class="st-table"><thead><tr><th>input</th><th>specification says</th>' +
      '<th>program returns</th><th></th></tr></thead><tbody>';
    [3222, 30, 49, 50].forEach(function (x) {
      var r = pgRun(prog, { x: x }), want = pgSpec50(x);
      var ok = r.ok && r.value === want;
      h += '<tr><td><code>' + x + '</code></td><td><code>' + want + '</code></td>' +
        '<td><code' + (ok ? '' : ' class="st-bad"') + '>' + r.value + '</code></td>' +
        '<td><span class="stat-pill ' + (ok ? 'b' : 'c') + '">' + (ok ? 'P' : 'F') +
        '</span></td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="verdict ' + (sweep.failing.length === 1 ? 'bad' : '') + '">';
    if (!sweep.failing.length) {
      h += 'Nothing in <code>1&hellip;' + sweep.checked.toLocaleString() +
        '</code> disagrees &mdash; widen the range.';
    } else {
      h += '<strong>Exactly ' + (sweep.failing.length === 1 ? 'one input' :
        sweep.failing.length + ' inputs') + ' in ' + sweep.checked.toLocaleString() +
        '</strong> makes the program disagree with its specification: ' +
        sweep.failing.slice(0, 8).map(function (v) { return '<code>' + v + '</code>'; })
          .join(', ') +
        (sweep.failing.length > 8 ? ' &hellip;' : '') + '.';
    }
    h += '</div>';

    h += '<div class="tool-note">49 is below 50, so the first condition adds two and ' +
      'makes it 51 &mdash; which is above 50, so the second condition takes one away. ' +
      'The two conditions were written as if only one of them could fire. 48 escapes ' +
      'because 50 is not greater than 50, and every input above 50 escapes because the ' +
      'first condition never fired.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · simple paths and prime paths ---------- */

  function runPrimePaths() {
    var out = document.getElementById('pp-output');
    if (!out) return;
    var which = ((document.getElementById('pp-graph') || {}).value) || 'the prime path example';
    var g = SG_GRAPHS[which];
    if (!g) { out.innerHTML = ''; return; }

    var simple = sgOnce('simple:' + which, function () { return sgSimplePaths(g); });
    var prime = sgOnce('prime:' + which, function () { return sgPrimePaths(g); });

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">' + g.nodes.length + ' nodes</span>' +
      '<span class="stat-pill dark">' + g.edges.length + ' edges</span>' +
      '<span class="stat-pill b">' + simple.length + ' simple paths</span>' +
      '<span class="stat-pill a">' + prime.length + ' prime</span></div>';

    h += '<div class="sg-pic">' + sgDraw(g, { alt: 'the graph' }) + '</div>';

    var complete = prime.filter(function (p) { return p[0] !== p[p.length - 1]; });
    var loops = prime.filter(function (p) { return p[0] === p[p.length - 1]; });

    h += '<div class="st-cap">prime paths that run from one end to the other</div>' +
      '<div class="sg-paths">' + (complete.length
        ? complete.map(function (p) { return '<code>' + p.join('&rarr;') + '</code>'; }).join('')
        : '<span class="st-dim">none</span>') + '</div>';
    h += '<div class="st-cap">prime paths that are one trip round a loop</div>' +
      '<div class="sg-paths">' + (loops.length
        ? loops.map(function (p) { return '<code>' + p.join('&rarr;') + '</code>'; }).join('')
        : '<span class="st-dim">none</span>') + '</div>';

    h += '<div class="tool-note">Every prime path is a simple path that nothing longer ' +
      'contains. ' + simple.length + ' simple paths reduce to ' + prime.length +
      ', because a path that sits inside another one is covered whenever that other one ' +
      'is. A loop contributes one prime path per node it passes through, each starting ' +
      'and ending at a different point of the same cycle &mdash; which is why the count ' +
      'climbs so fast once there are two loops.' + esc(g.note ? ' ' + g.note : '') +
      '</div>';
    out.innerHTML = h;
  }

  /* ---------- Tool 5 · the cyclomatic number ---------- */

  function runCyclomatic() {
    var out = document.getElementById('cy-output');
    if (!out) return;
    var which = ((document.getElementById('cy-graph') || {}).value) || 'the running graph';
    var g = SG_GRAPHS[which];
    if (!g) { out.innerHTML = ''; return; }

    var v = sgCyclomatic(g);
    var closed = sgClose(g);
    var rank = closed ? sgCycleRank(closed) : null;

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">' + g.edges.length + ' edges</span>' +
      '<span class="stat-pill dark">' + g.nodes.length + ' nodes</span>' +
      '<span class="stat-pill a">V(G) = ' + v + '</span></div>';

    h += '<div class="sg-split"><div class="sg-pic">' +
      sgDraw(g, { alt: 'the graph' }) + '</div><div class="sg-code">';
    h += '<table class="st-table"><tbody>' +
      '<tr><th>by the formula</th><td><code>' + g.edges.length + ' &minus; ' +
        g.nodes.length + ' + 2 = ' + v + '</code></td></tr>' +
      '<tr><th>as independent cycles</th><td>' + (rank === null
        ? '<span class="st-dim">needs one entry and one exit</span>'
        : '<code>' + rank + '</code>' + (rank === v
            ? ' <span class="st-ok">agrees</span>'
            : ' <span class="st-bad">disagrees</span>')) + '</td></tr>' +
      '<tr><th>risk</th><td>' + esc(sgRisk(v)) + '</td></tr>' +
      '</tbody></table></div></div>';

    h += '<div class="tool-note">The second row joins the exit back to the entry and ' +
      'measures the dimension of the cycle space by elimination &mdash; a different ' +
      'calculation that happens to give the same answer. That is what the formula is ' +
      'counting, and it is why adding statements in a straight line does not change it: ' +
      'a new node brings a new edge with it, and the two cancel.</div>';

    if (closed) {
      h += '<div class="st-cap">the same graph laid end to end with itself</div>';
      h += '<table class="st-table"><thead><tr><th>copies</th><th>nodes</th><th>edges</th>' +
        '<th>V</th></tr></thead><tbody>';
      for (var n = 1; n <= 5; n++) {
        var c = sgCompose(g, n);
        h += '<tr><td><code>' + n + '</code></td><td>' + c.nodes.length + '</td><td>' +
          c.edges.length + '</td><td><code>' + sgCyclomatic(c) + '</code></td></tr>';
      }
      h += '</tbody></table>';
      var v1 = sgCyclomatic(sgCompose(g, 1)), v2 = sgCyclomatic(sgCompose(g, 2));
      h += '<div class="tool-note">Two copies cost <code>' + v1 + ' + ' + v1 +
        ' &minus; 1 = ' + v2 + '</code>, not <code>' + (2 * v1) + '</code>: the exit of ' +
        'one is the entry of the next, so the two graphs share a node. In general ' +
        '<code>' + (v1 - 1) + 'n + 1</code>.</div>';
    }
    out.innerHTML = h;
  }
