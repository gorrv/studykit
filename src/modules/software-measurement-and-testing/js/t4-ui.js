  /* ============================================================
     SMT TOPIC 04 · rendering

     HTML only. Every number comes from t4-unit.js.
     ============================================================ */

  var T4_ONCE = {};
  function t4Once(key, fn) {
    if (!(key in T4_ONCE)) T4_ONCE[key] = fn();
    return T4_ONCE[key];
  }

  /* ---------- Tool 1 · the session, one step at a time ---------- */

  function runTddStep() {
    var out = document.getElementById('td-output');
    if (!out) return;
    var i = parseInt(((document.getElementById('td-step') || {}).value) || '0', 10);
    if (isNaN(i) || i < 0 || i >= FB_STEPS.length) i = 0;

    var step = FB_STEPS[i];
    var tests = fbTestsAt(i);
    var results = fbRun(i, tests);
    var green = results.length > 0 && results.every(function (r) { return r.pass; });
    var wrong = fbWrongCount(i, 100);
    var first = fbFirstWrong(i, 1000);

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">step ' + (i + 1) + ' of ' + FB_STEPS.length + '</span>' +
      '<span class="stat-pill dark">' + results.length +
        (results.length === 1 ? ' test' : ' tests') + '</span>' +
      '<span class="stat-pill ' + (green ? 'b' : 'c') + '">' +
        (results.length ? (green ? 'green bar' : 'red bar') : 'nothing to run') + '</span>' +
      '<span class="stat-pill ' + (wrong ? 'c' : 'b') + '">' + wrong +
        ' of 100 wrong</span></div>';

    h += '<div class="sg-split"><div class="sg-code"><div class="st-cap">the production ' +
      'code</div><pre class="st-snippet">' + esc(step.code) + '</pre></div>' +
      '<div><div class="st-cap">the test list, as it stood</div>';

    if (!results.length) {
      h += '<div class="td-empty">No test has been written yet.</div>';
    } else {
      h += '<table class="st-table"><tbody>';
      results.forEach(function (r) {
        h += '<tr><td><code>' + esc(r.name) + '</code></td>' +
          '<td><code>' + r.input + '</code> &rarr; <code>' + esc(String(r.expected)) +
          '</code></td><td><code' + (r.pass ? '' : ' class="st-bad"') + '>' +
          esc(r.why || String(r.got)) + '</code></td>' +
          '<td><span class="stat-pill ' + (r.pass ? 'b' : 'c') + '">' +
          (r.pass ? 'pass' : 'FAIL') + '</span></td></tr>';
      });
      h += '</tbody></table>';
    }
    h += '</div></div>';

    h += '<div class="verdict ' + (green && first !== null ? 'bad' : green ? 'safe' : '') +
      '">';
    if (!results.length) {
      h += 'Nothing written yet. The first test comes before the first line of code.';
    } else if (!green) {
      h += '<strong>Red.</strong> ' +
        results.filter(function (r) { return !r.pass; })
          .map(function (r) { return '<code>' + esc(r.name) + '</code>'; }).join(', ') +
        ' is what the next scrap of code has to answer.';
    } else if (first === null) {
      h += '<strong>Green, and right.</strong> Nothing in <code>1&hellip;1000</code> ' +
        'disagrees with the specification.';
    } else {
      h += '<strong>Green, and wrong.</strong> Every test passes; the smallest input it ' +
        'gets wrong is <code>' + first + '</code>, and the largest input any test uses is ' +
        '<code>' + Math.max.apply(null, results.map(function (r) { return r.input; })) +
        '</code>.';
    }
    h += '</div>';

    h += '<div class="tool-note">' + esc(step.note) + '</div>';
    out.innerHTML = h;
  }

  /* ---------- Tool 2 · the whole session at once ---------- */

  function runTddSession() {
    var out = document.getElementById('ts-output');
    if (!out) return;
    var session = t4Once('session', function () { return fbSession(); });

    var h = '<table class="st-table"><thead><tr><th>step</th><th>tests</th><th>bar</th>' +
      '<th>wrong in 1&ndash;100</th><th>smallest wrong input</th></tr></thead><tbody>';
    session.forEach(function (s, i) {
      var first = fbFirstWrong(i, 1000);
      /* No row highlighting here. Every green step but the last is
         green-and-wrong, so marking them all marks nothing. */
      h += '<tr>' +
        '<td><code>' + esc(s.id) + '</code></td>' +
        '<td>' + s.tests.length + '</td>' +
        '<td>' + (s.tests.length
          ? '<span class="stat-pill ' + (s.green ? 'b' : 'c') + '">' +
            (s.green ? 'green' : 'red') + '</span>'
          : '<span class="st-dim">&mdash;</span>') + '</td>' +
        '<td>' + s.wrong + '</td>' +
        '<td>' + (first === null ? '<span class="st-ok">none</span>'
                                 : '<code>' + first + '</code>') + '</td></tr>';
    });
    h += '</tbody></table>';

    var buzz = fbStepIndex('buzz');
    var biggest = Math.max.apply(null, fbTestsAt(buzz).map(function (t) { return t.input; }));
    h += '<div class="verdict bad"><strong>Look at <code>buzz</code>.</strong> ' +
      'Five tests, all passing, and the code is wrong about <code>' +
      fbFirstWrong(buzz, 1000) + '</code> &mdash; which is more than three times the ' +
      'largest number any of those five tests mentions (<code>' + biggest + '</code>). ' +
      'The green bar says the code does what the tests ask. It has never said anything ' +
      'else.</div>';

    h += '<div class="tool-note">The rule that keeps this honest is the one in the middle ' +
      'of the cycle: watch the test fail first. A test that has never been red is a test ' +
      'that has never been shown to test anything. Of the six tests here, exactly one ' +
      '&mdash; <code>testFour</code> &mdash; passed the moment it was written, and the ' +
      'notes flag it as possibly superfluous rather than quietly keeping it.</div>';
    out.innerHTML = h;
  }

  /* ---------- Tool 3 · was that really a refactoring? ---------- */

  function runRefactorCheck() {
    var out = document.getElementById('rf-output');
    if (!out) return;
    var a = parseInt(((document.getElementById('rf-a') || {}).value) || '3', 10);
    var b = parseInt(((document.getElementById('rf-b') || {}).value) || '4', 10);
    if (isNaN(a) || isNaN(b) || !FB_STEPS[a] || !FB_STEPS[b]) { out.innerHTML = ''; return; }

    var diffs = fbDiff(a, b, 1000);

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">' + esc(FB_STEPS[a].id) + '</span>' +
      '<span class="stat-pill dark">vs ' + esc(FB_STEPS[b].id) + '</span>' +
      '<span class="stat-pill ' + (diffs.length ? 'c' : 'b') + '">' + diffs.length +
      ' of 1000 differ</span></div>';

    h += '<div class="sg-split"><div class="sg-code"><pre class="st-snippet">' +
      esc(FB_STEPS[a].code) + '</pre></div><div class="sg-code"><pre class="st-snippet">' +
      esc(FB_STEPS[b].code) + '</pre></div></div>';

    if (!diffs.length) {
      h += '<div class="verdict safe"><strong>Behaviour preserved.</strong> The two ' +
        'versions agree on every input from 1 to 1000. That is what makes the change a ' +
        'refactoring rather than a fix.</div>';
    } else {
      h += '<div class="verdict bad"><strong>Behaviour changed</strong> on ' +
        diffs.length + ' of the first 1000 inputs. The first few:</div>';
      h += '<table class="st-table"><thead><tr><th>input</th><th>' +
        esc(FB_STEPS[a].id) + '</th><th>' + esc(FB_STEPS[b].id) +
        '</th></tr></thead><tbody>';
      diffs.slice(0, 6).forEach(function (d) {
        h += '<tr><td><code>' + d.input + '</code></td><td><code>' + esc(String(d.a)) +
          '</code></td><td><code>' + esc(String(d.b)) + '</code></td></tr>';
      });
      h += '</tbody></table>';
      var tests = fbTestsAt(a);
      var covered = diffs.filter(function (d) {
        return tests.some(function (t) { return t.input === d.input; });
      });
      h += '<div class="tool-note">None of this is caught by the tests that existed at ' +
        'the time: ' + covered.length + ' of those ' + diffs.length +
        ' inputs appear in the ' + tests.length + ' tests written so far. A change is ' +
        'behaviour-preserving <em>as far as the tests can tell</em>, and with ' +
        tests.length + ' tests that is not far. The notes still call this step a ' +
        'refactoring, and in the sense that matters &mdash; the bar stayed green &mdash; ' +
        'it was one.</div>';
    }
    out.innerHTML = h;
  }

  /* ---------- Tool 4 · the fixture, in every order ---------- */

  function runFixture() {
    var out = document.getElementById('fx-output');
    if (!out) return;
    var fresh = ((document.getElementById('fx-fresh') || {}).value) !== 'shared';

    var r = t4Once('orders:' + fresh, function () { return acEveryOrder(fresh); });

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">' + AC_TESTS.length + ' tests</span>' +
      '<span class="stat-pill dark">' + r.total + ' possible orders</span>' +
      '<span class="stat-pill ' + (r.green === r.total ? 'b' : 'c') + '">' + r.green +
      ' come out green</span></div>';

    h += '<div class="sg-code"><pre class="st-snippet">' + esc(fresh
      ? '@Before\npublic void setUp() {\n' +
        '  account = new AccountImpl("1234-9999", 2000);\n}'
      : '// no setUp: one account, built once, shared by every test\n' +
        'private AccountImpl account =\n' +
        '    new AccountImpl("1234-9999", 2000);') + '</pre></div>';

    h += '<div class="st-cap">the first eight orders</div>';
    h += '<table class="st-table"><thead><tr><th>order</th><th>result</th></tr></thead>' +
      '<tbody>';
    r.orders.slice(0, 8).forEach(function (o) {
      h += '<tr' + (o.green ? '' : ' class="st-wrong"') + '><td><code>' +
        o.order.map(function (i) { return AC_TESTS[i].name.replace(/^test/, ''); })
          .join(' &rarr; ') + '</code></td><td>' +
        o.results.map(function (x) {
          return '<span class="st-mark ' + (x.pass ? 'yes' : 'no') + '">' +
            (x.pass ? '&#10003;' : '&times;') + '</span>';
        }).join(' ') + '</td></tr>';
    });
    h += '</tbody></table>';

    if (r.green === r.total) {
      h += '<div class="verdict safe"><strong>Every order passes.</strong> Each test gets ' +
        'an account of its own, so no test can be affected by what another one did. That ' +
        'is the whole content of "self-contained and stateless".</div>';
    } else {
      h += '<div class="verdict bad"><strong>' + (r.total - r.green) + ' of ' + r.total +
        ' orders fail</strong>, including the one you would write them in. ' +
        Object.keys(r.failures).map(function (k) {
          return '<code>' + esc(k) + '</code> fails in ' + r.failures[k] + ' of them';
        }).join(', ') + '. Nothing is wrong with the account: the tests are reading each ' +
        'other\'s leftovers.</div>';
      h += '<div class="tool-note">This is why a failure in a suite like this tells you ' +
        'almost nothing. The test that goes red is rarely the test that is wrong, so the ' +
        'first thing you do is not debug &mdash; it is run it alone, which is a diagnostic ' +
        'step that would not exist if the fixture were fresh.</div>';
    }
    out.innerHTML = h;
  }
