  /* ============================================================
     SCALA TOPIC 01 · rendering
     ============================================================ */

  /* ---------- Tool 1 · the REPL ---------- */

  function runScalaEval(preset) {
    var out = document.getElementById('sc-output');
    if (!out) return;
    var box = document.getElementById('sc-input');
    if (preset && SC_EXPRS[preset] && box) box.value = SC_EXPRS[preset].src;
    var src = box ? box.value : '1 + 1';

    var r = scEval(src, {});

    var h = '<div class="sc-choices">';
    Object.keys(SC_EXPRS).forEach(function (k) {
      h += '<button class="chip" onclick="runScalaEval(\'' + k + '\')">' +
        esc(SC_EXPRS[k].label) + '</button>';
    });
    h += '</div>';

    h += '<div class="sc-repl"><span class="sc-prompt">scala&gt;</span> <code>' +
      esc(src.trim()) + '</code></div>';

    if (!r.ok) {
      h += '<div class="verdict bad">' +
        (r.runtime ? '<strong>It compiles, and then throws.</strong><br>' : '') +
        r.error + '</div>';
    } else {
      h += '<div class="sc-result"><span class="sc-res">val res0:</span> ' +
        '<span class="sc-type">' + esc(r.type) + '</span> = ' +
        '<span class="sc-val">' + esc(r.show) + '</span></div>';
      h += '<div class="verdict safe">The type is worked out first, and it decides what the ' +
        'operators mean. <code>/</code> on two <code>Int</code>s is a different function from ' +
        '<code>/</code> on two <code>Double</code>s.</div>';
    }

    if (preset && SC_EXPRS[preset]) {
      h += '<div class="callout tip" style="margin:14px 0;">' +
        '<div class="callout-label">' + esc(SC_EXPRS[preset].label) + '</div>' +
        SC_EXPRS[preset].note + '</div>';
    }

    h += '<div class="pp-note">Int arithmetic here is the JVM&rsquo;s: 32 bits, wrapping on ' +
      'overflow, division truncating towards zero. The test suite generates hundreds of ' +
      'expressions and checks this against a real JVM, so if it disagreed with Scala the build ' +
      'would fail.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · cons cells ---------- */

  var lsCurrent = 'cons';

  function runCons(which) {
    var out = document.getElementById('ls-output');
    if (!out) return;
    if (which) lsCurrent = which;
    var preset = LS_PRESETS[lsCurrent] || LS_PRESETS.cons;
    var r = lsRun(preset.steps);

    var alloc = r.events.reduce(function (a, e) { return a + (e.allocated || 0); }, 0);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + esc(preset.label) + '</span>' +
      '<span class="stat-pill b">' + alloc + ' cells allocated</span>' +
      '<span class="stat-pill ' + (r.shared.length ? 'a' : 'dark') + '">' +
        r.shared.length + ' shared</span></div>';

    h += '<div class="ls-choices">';
    Object.keys(LS_PRESETS).forEach(function (k) {
      h += '<button class="chip' + (k === lsCurrent ? ' on' : '') +
        '" onclick="runCons(\'' + k + '\')">' + esc(LS_PRESETS[k].label) + '</button>';
    });
    h += '</div>';

    h += '<table class="up-trace"><thead><tr><th>line</th><th>new cells</th><th>shared</th>' +
      '<th>what happens</th></tr></thead><tbody>';
    r.events.forEach(function (e, i) {
      h += '<tr' + (e.error ? ' class="bad"' : '') + ' data-step="' + i + '">' +
        '<td><code>' + esc(e.text) + '</code></td>' +
        '<td>' + (e.error ? '—' : e.allocated) + '</td>' +
        '<td>' + (e.error ? '—' : e.shared) + '</td>' +
        '<td>' + (e.error ? esc(e.error) : e.note) + '</td></tr>';
    });
    h += '</tbody></table>';

    /* Each name, with the cells it can reach; shared cells marked. */
    h += '<div class="ls-views"><div class="pp-cap">what each name sees</div>';
    r.views.forEach(function (v) {
      h += '<div class="ls-row"><span class="ls-name">' + esc(v.name) + '</span>';
      if (!v.items.length) h += '<span class="ls-nil">Nil</span>';
      v.items.forEach(function (item, i) {
        var isShared = r.shared.indexOf(v.ids[i]) >= 0;
        h += '<span class="ls-cell' + (isShared ? ' shared' : '') + '">' + esc(String(item)) +
          '<span class="ls-id">#' + v.ids[i] + '</span></span>';
        if (i < v.items.length - 1) h += '<span class="ls-arrow">&rarr;</span>';
      });
      h += '<span class="ls-arrow">&rarr;</span><span class="ls-nil">Nil</span></div>';
    });
    h += '</div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">Why immutability is affordable</div>' +
      'The obvious objection to "never change anything, make a new one instead" is that copying ' +
      'is expensive. It would be — but nothing is copied. Cells with the same number above are ' +
      'the same cell in memory, reachable from both names. It is safe to share precisely because ' +
      'nobody can write to them: there is no operation that could make one name see a change ' +
      'made through another.<br><br>' +
      'This is also why <code>::</code> adds to the <em>front</em>. Adding to the back would ' +
      'mean changing the last cell, which is shared, so the whole list would have to be copied.' +
      '</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · the refactor, checked ---------- */

  function runRefactor() {
    var out = document.getElementById('rc-output');
    if (!out) return;
    var a = ((document.getElementById('rc-a') || {}).value) || 'imperative';
    var b = ((document.getElementById('rc-b') || {}).value) || 'functional';
    var dim = Number(((document.getElementById('rc-dim') || {}).value) || 3);

    var r = rfCompare(a, b, dim);
    if (!r.ok) return ppBad('rc-output', r);

    var src = {
      imperative: 'def is_legal(dim: Int, path: Path)(x: Pos): Boolean = {\n' +
        '  var boolReturn = false\n' +
        '  if (x._1 >= dim || x._2 >= dim || x._1 < 0 || x._2 < 0) {\n' +
        '    boolReturn = false\n  } else {\n    var breakLoop = false\n' +
        '    if (path == Nil) { boolReturn = true }\n    else {\n' +
        '      boolReturn = true\n      for (i <- 0 until path.length) {\n' +
        '        if (!breakLoop) {\n' +
        '          if (path(i) == x) { boolReturn = false; breakLoop = true }\n' +
        '        }\n      }\n    }\n  }\n  boolReturn\n}',
      buggy: 'def is_legal(dim: Int, path: Path)(x: Pos): Boolean = {\n' +
        '  var boolReturn = false\n' +
        '  if (x._1 >= dim || x._2 >= dim || x._1 < 0 || x._2 < 0) {\n' +
        '    boolReturn = false\n  } else {\n' +
        '    if (path == Nil) { boolReturn = true }\n    else {\n' +
        '      for (i <- 0 until path.length) {\n' +
        '        if (path(i) == x) boolReturn = false\n' +
        '        else boolReturn = true      // overwrites an earlier false\n' +
        '      }\n    }\n  }\n  boolReturn\n}',
      functional: 'def is_legal(dim: Int, path: Path)(x: Pos): Boolean =\n' +
        '  x._1 >= 0 && x._1 < dim && x._2 >= 0 && x._2 < dim && !path.contains(x)'
    };

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + r.checked + ' cases</span>' +
      '<span class="stat-pill a">' + r.paths + ' paths &times; ' + r.positions + ' positions</span>' +
      '<span class="stat-pill ' + (r.same ? 'b' : 'c') + '">' +
        (r.same ? 'identical on every one' : r.differCount + ' disagree') + '</span></div>';

    h += '<div class="rc-pair">';
    [[a, 'left'], [b, 'right']].forEach(function (pair) {
      h += '<div class="rc-side"><div class="pp-cap">' + esc(RF_VERSIONS[pair[0]].label) +
        '</div><pre class="pp-snippet">' + esc(src[pair[0]]) + '</pre></div>';
    });
    h += '</div>';

    if (r.same) {
      h += '<div class="verdict safe"><strong>The same function.</strong> Every position on a ' +
        r.dim + '&times;' + r.dim + ' board, for every path of up to two moves, and every ' +
        'off-board position — ' + r.checked + ' cases, all agreeing. Not a sample: that is the ' +
        'whole domain, so this is settled rather than likely.</div>';
    } else {
      h += '<div class="verdict bad"><strong>Not the same function.</strong> They differ on ' +
        r.differCount + ' of ' + r.checked + ' cases. The first few:</div>' +
        '<table class="pp-table"><thead><tr><th>path</th><th>position</th>' +
        '<th>' + esc(a) + '</th><th>' + esc(b) + '</th></tr></thead><tbody>';
      r.differences.forEach(function (d) {
        h += '<tr><td><code>List(' + d.path.map(function (p) {
          return '(' + p[0] + ',' + p[1] + ')';
        }).join(', ') + ')</code></td>' +
          '<td><code>(' + d.x[0] + ',' + d.x[1] + ')</code></td>' +
          '<td class="' + (d.a ? 'yes' : 'no') + '">' + d.a + '</td>' +
          '<td class="' + (d.b ? 'yes' : 'no') + '">' + d.b + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">What the mutable version made easy to get wrong</div>' +
        'The failing cases all have <strong>more than one</strong> position in the path. With a ' +
        'single-element path the two agree, so it passes the first test anyone writes. The flag ' +
        'is assigned on every pass of the loop, so the last element silently overwrites what the ' +
        'earlier ones decided.<br><br>' +
        'The one-line version cannot have this bug. There is no variable to overwrite: ' +
        '<code>contains</code> either finds the position or it does not.</div>';
    }

    h += '<div class="pp-note">Both versions are run here, in this page, on every input in the ' +
      'domain — the counts above are measured, not asserted.</div>';

    out.innerHTML = h;
  }
