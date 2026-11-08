  /* ============================================================
     SMT TOPIC 02 · rendering
     ============================================================ */

  /* ---------- Tool 1 · the mortgage program ---------- */

  function runMortgage() {
    var out = document.getElementById('mg-output');
    if (!out) return;
    var ft = ((document.getElementById('mg-ft') || {}).value) === 'true';
    var age = parseInt(((document.getElementById('mg-age') || {}).value) || '38', 10);
    var sal = parseInt(((document.getElementById('mg-sal') || {}).value) || '1000', 10);

    if (isNaN(age) || isNaN(sal)) {
      out.innerHTML = '<div class="tool-error">Age and salary need to be whole numbers.</div>';
      return;
    }

    var r = fnRun(ft, age, sal);

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">full-time ' + (ft ? 'true' : 'false') + '</span>' +
      '<span class="stat-pill dark">age ' + age + '</span>' +
      '<span class="stat-pill dark">salary ' + sal + '</span>' +
      '<span class="stat-pill ' + (r.pass ? 'b' : 'c') + '">' +
        (r.pass ? 'pass' : 'FAIL') + '</span></div>';

    h += '<table class="st-table"><tbody>' +
      '<tr><th>the specification says</th><td>' + esc(r.category) +
        (r.expectedFactor ? ' &mdash; factor <code>' + r.expectedFactor + '</code>' : '') +
        '<br><code>' + esc(r.expected) + '</code></td></tr>' +
      '<tr><th>the code returns</th><td>factor <code>' + r.gotFactor +
        '</code><br><code class="' + (r.pass ? '' : 'st-bad') + '">' + esc(r.got) +
        '</code></td></tr></tbody></table>';

    h += '<div class="verdict ' + (r.pass ? 'safe' : 'bad') + '">' +
      (r.pass
        ? 'Agrees here. That is one input; the map below shows where it does not.'
        : '<strong>Disagrees.</strong> ' + esc(r.signature) + '.') + '</div>';

    /* The whole valid domain, as a strip per employment type. */
    var map = ftOnce('faultmap', function () { return fnFaultMap(1000); });
    h += '<div class="st-cap">every age from 18 to 55, at salary 1000</div>';
    [true, false].forEach(function (which) {
      h += '<div class="fn-strip-row"><span class="fn-strip-l">' +
        (which ? 'full-time' : 'part-time') + '</span><span class="fn-strip">';
      for (var a = 18; a <= 55; a++) {
        var bad = !fnRun(which, a, 1000).pass;
        var here = (which === ft && a === age);
        h += '<span class="fn-cell' + (bad ? ' bad' : '') + (here ? ' here' : '') +
          '" title="age ' + a + (bad ? ' — wrong' : ' — correct') + '"></span>';
      }
      h += '</span></div>';
    });
    h += '<div class="fn-legend"><span class="fn-cell"></span> agrees &nbsp; ' +
      '<span class="fn-cell bad"></span> disagrees &nbsp; ' +
      '<span class="fn-cell here"></span> the input above</div>';

    h += '<div class="st-cap">the ' + map.regions.length + ' places they part company</div>' +
      '<table class="st-table"><thead><tr><th>who</th><th>ages</th><th>wanted</th>' +
      '<th>got</th></tr></thead><tbody>';
    map.regions.forEach(function (g) {
      h += '<tr><td>' + (g.ft ? 'full-time' : 'part-time') + '</td>' +
        '<td>' + g.from + (g.from === g.to ? '' : '&ndash;' + g.to) + '</td>' +
        '<td><code>' + esc(g.expected) + '</code></td>' +
        '<td><code class="st-bad">' + esc(g.got) + '</code></td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="tool-note">Three kinds of mistake are visible there. Two are ' +
      '<strong>off-by-one</strong> at a boundary &mdash; <code>age &lt; 35</code> where the ' +
      'specification says up to and including 35, and the same at 40 for part-timers. One ' +
      'is a <strong>wrong constant</strong>: part-timers under 30 get 75 rather than 70. ' +
      'And one is <strong>missing entirely</strong>: there is no range check, so a ' +
      'part-timer of 51 to 55 is quietly given a mortgage the specification says they ' +
      'should be refused. That last one is a fault of omission &mdash; there is no wrong ' +
      'line to point at.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · the eight techniques ---------- */

  function runTechniques() {
    var out = document.getElementById('tq-output');
    if (!out) return;
    var show = ((document.getElementById('tq-show') || {}).value) || 'all';

    var rows = ftOnce('compare', function () { return fnCompare(); });
    var maxT = Math.max.apply(null, rows.map(function (r) { return r.tests; }));
    var maxF = Math.max.apply(null, rows.map(function (r) { return r.faults; }));

    var h = '<div class="st-stats">' +
      '<span class="stat-pill a">' + fnAllFaults().length +
      ' distinct faults exist</span>' +
      '<span class="stat-pill dark">8 techniques</span></div>';

    h += '<table class="st-table fn-cmp"><thead><tr><th>technique</th>' +
      '<th>test cases</th><th>faults found</th><th>tests per fault</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td>' + esc(r.label) + '<br><span class="st-note-i">' + esc(r.idea) +
        '</span></td>' +
        '<td>' + bar(r.tests, maxT, 'a') + '</td>' +
        '<td>' + bar(r.faults, maxF, r.faults ? 'b' : 'c') + '</td>' +
        '<td>' + (r.perFault === null
          ? '<span class="st-mark no">found nothing</span>'
          : r.perFault.toFixed(1)) + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="tool-note">The notes give these three as bar charts without printed ' +
      'values. These are the numbers, for the specification and implementation exactly as ' +
      'printed &mdash; and they are produced by running every test case rather than by ' +
      'counting on paper.</div>';

    if (show === 'all' || show === 'formulas') {
      var f = ftOnce('formulas', function () { return fnFormulas(); });
      h += '<div class="st-cap">the counting formulas, against the suites that can be built</div>' +
        '<table class="st-table"><thead><tr><th>formula</th><th>says</th><th>built</th>' +
        '<th></th></tr></thead><tbody>';
      f.forEach(function (x) {
        h += '<tr><td><code>' + x.formula + '</code></td><td>' + x.says + '</td>' +
          '<td>' + x.built + '</td><td>' +
          (x.agrees ? '<span class="st-mark yes">agree</span>'
                    : '<span class="st-mark no">differ</span>') + '</td></tr>';
      });
      h += '</tbody></table>';

      h += '<div class="verdict warn"><strong>The two robust formulas overcount here, and ' +
        'the notes already say why.</strong> <code>max |S&#8339;| + 2n</code> and ' +
        '<code>&prod;(|S&#8339;| + 2)</code> both assume every variable has a value just ' +
        'below its range and one just above. <code>full-time</code> is a boolean &mdash; ' +
        '"as strange as boundary value", as the notes put it &mdash; and has neither. Drop ' +
        'those phantom tests and the counts fall from 12 to 10 and from 96 to 48.' +
        '<br><br>Worth noticing in an exam: the formula is the answer to "how many test ' +
        'cases does this technique need", and it is right whenever every variable has a ' +
        'range. Booleans and enumerations are the exception.</div>';
    }

    if (show === 'all' || show === 'nominal') {
      var sweep = ftOnce('nominal', function () { return fnNominalSweep(); });
      h += '<div class="st-cap">boundary value testing, under eight different choices of ' +
        'nominal value</div><table class="st-table"><thead><tr><th>nominal full-time</th>' +
        '<th>nominal age</th><th>tests</th><th>faults found</th></tr></thead><tbody>';
      sweep.forEach(function (r) {
        h += '<tr><td>' + (r.ft ? 'true' : 'false') + '</td><td>' + r.age + '</td>' +
          '<td>' + r.tests + '</td><td class="' +
          (r.faults ? '' : 'st-bad') + '">' + r.faults + '</td></tr>';
      });
      h += '</tbody></table>';

      var lo = Math.min.apply(null, sweep.map(function (r) { return r.faults; }));
      var hi = Math.max.apply(null, sweep.map(function (r) { return r.faults; }));
      h += '<div class="verdict bad"><strong>Between ' + lo + ' and ' + hi + ' faults, ' +
        'from the same technique on the same program.</strong> Nothing changed but which ' +
        'values were called "nominal" &mdash; a choice boundary value testing never asks ' +
        'you to justify. With full-time nominal and age 36 it finds <em>nothing at ' +
        'all</em>.<br><br>This is the first of the drawbacks the notes list for BV: ' +
        '<em>no sense of covering the input domain</em>. Equivalence classes exist to ' +
        'make that choice deliberate rather than accidental.</div>';
    }

    out.innerHTML = h;
  }

  function bar(v, max, cls) {
    var w = max ? Math.max(2, Math.round(100 * v / max)) : 0;
    return '<span class="fn-bar-n">' + v + '</span>' +
      '<span class="fn-bar"><span class="fn-bar-f ' + cls + '" style="width:' + w +
      '%"></span></span>';
  }

  /* ---------- Tool 3 · the token puzzle ---------- */

  function runPuzzle() {
    var out = document.getElementById('pz-output');
    if (!out) return;
    var m = Number(((document.getElementById('pz-m') || {}).value) || 3);
    var n = Number(((document.getElementById('pz-n') || {}).value) || 5);

    var p = fnPuzzle(m, n);
    if (!p.ok) { out.innerHTML = '<div class="tool-error">' + esc(p.error) + '</div>'; return; }
    var min = fnPuzzleMinimal(m, n);

    var h = '<div class="st-stats">' +
      '<span class="stat-pill a">' + m + ' &times; ' + n + '</span>' +
      '<span class="stat-pill b">max(' + m + ', ' + n + ') = ' + p.tokens +
      ' tokens</span></div>';

    h += '<div class="fn-grid">';
    for (var r = 1; r <= m; r++) {
      h += '<div class="fn-grid-row">';
      for (var c = 1; c <= n; c++) {
        var has = p.cells.some(function (x) { return x[0] === r && x[1] === c; });
        h += '<span class="fn-sq' + (has ? ' on' : '') + '"></span>';
      }
      h += '</div>';
    }
    h += '</div>';

    h += '<div class="verdict ' + (p.valid ? 'safe' : 'bad') + '">' +
      'Token <em>i</em> at <code>(min(i, ' + m + '), min(i, ' + n + '))</code>. ' +
      'Rows covered: ' + p.rowsCovered + ' of ' + m + '. Columns: ' + p.colsCovered +
      ' of ' + n + '.' +
      (min.ok
        ? ' An exhaustive search over every arrangement finds the smallest possible is <strong>' +
          min.smallest + '</strong>, so the formula is not merely sufficient but minimal.'
        : '') + '</div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">Why this puzzle is here</div>' +
      'It is weak normal equivalence class testing in disguise. Each variable contributes ' +
      'one dimension, its classes are the positions along that dimension, and a test case ' +
      'is a token: it covers one class of every variable at once. Covering every class of ' +
      'every variable therefore costs <code>max&#8339; |S&#8339;|</code> test cases, not the ' +
      'sum and not the product.<br><br>For the mortgage example that is max(2, 6, 1) = ' +
      '<strong>6</strong>, which is exactly the number of rows in the first table of the ' +
      'notes.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · decision table completeness ---------- */

  function runDecisionTable() {
    var out = document.getElementById('dt-output');
    if (!out) return;
    var drop = ((document.getElementById('dt-drop') || {}).value) || 'none';

    var rules = DT_EXAMPLE.rules.map(function (r) { return r.slice(); });
    var actions = DT_EXAMPLE.actions.slice();
    if (drop === 'last') { rules.pop(); actions.pop(); }
    if (drop === 'dontcare') { rules[0] = ['F', 'T', 'T']; }

    var r = dtCount(rules, [2, 2, 2]);

    var h = '<div class="st-stats">' +
      '<span class="stat-pill a">' + DT_EXAMPLE.conditions.length + ' conditions</span>' +
      '<span class="stat-pill dark">' + r.rules + ' rules</span>' +
      '<span class="stat-pill ' + (r.complete ? 'b' : 'c') + '">' +
        (r.complete ? 'complete' : r.missing + ' combinations unaccounted for') +
      '</span></div>';

    h += '<table class="st-table dt-table"><thead><tr><th>stub</th>';
    rules.forEach(function (_, i) { h += '<th>' + (i + 1) + '</th>'; });
    h += '</tr></thead><tbody>';
    DT_EXAMPLE.conditions.forEach(function (c, ci) {
      h += '<tr><th>' + esc(c) + '</th>';
      rules.forEach(function (rule) {
        h += '<td class="dt-e' + (rule[ci] === '-' ? ' dt-dash' : '') + '">' +
          esc(rule[ci]) + '</td>';
      });
      h += '</tr>';
    });
    h += '<tr class="dt-split"><th>action</th>';
    actions.forEach(function (a) { h += '<td class="dt-e">' + esc(a) + '</td>'; });
    h += '</tr></tbody></table>';

    h += '<div class="st-cap">counting the rules</div><table class="st-table"><tbody>' +
      '<tr><th>combinations that must be covered</th><td><code>2<sup>' +
        DT_EXAMPLE.conditions.length + '</sup> = ' + r.required + '</code></td></tr>' +
      '<tr><th>covered by these rules</th><td>' + r.covered +
        ' <span class="st-note-i">(each don’t care counts for two)</span></td></tr>' +
      '</tbody></table>';

    h += '<div class="verdict ' + (r.complete ? 'safe' : 'bad') + '">' +
      (r.complete
        ? '<strong>Complete.</strong> Every one of the ' + r.required + ' combinations of ' +
          'the three conditions falls under exactly one rule, even though there are only ' +
          r.rules + ' columns &mdash; the don’t cares are doing the work.'
        : '<strong>Incomplete: ' + r.missing + ' combinations have no rule.</strong> A ' +
          'decision table that does not cover its own condition space has inputs whose ' +
          'behaviour nobody has decided, and those are exactly the ones that turn into ' +
          'faults of omission.') + '</div>';

    h += '<div class="tool-note">The check is <code>2<sup>|conditions|</sup></code> for ' +
      'binary conditions, and <code>&prod;&#8336; n&#8336;</code> when conditions take more ' +
      'than two values. A <code>&ndash;</code> entry counts as two rules because it stands ' +
      'for both, which is what lets four columns cover eight cases.</div>';

    out.innerHTML = h;
  }
