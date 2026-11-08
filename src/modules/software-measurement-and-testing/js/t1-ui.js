  /* ============================================================
     SMT TOPIC 01 · rendering
     ============================================================ */

  var FT_ONCE = {};
  function ftOnce(key, fn) {
    if (!(key in FT_ONCE)) FT_ONCE[key] = fn();
    return FT_ONCE[key];
  }

  /* ---------- Tool 1 · the example, run ---------- */

  function runFaultTrace() {
    var out = document.getElementById('ft-output');
    if (!out) return;
    var raw = ((document.getElementById('ft-input') || {}).value) || '1';
    var model = ((document.getElementById('ft-model') || {}).value) || 'math';

    var i = parseInt(String(raw).replace(/[^0-9-]/g, ''), 10);
    if (isNaN(i)) {
      out.innerHTML = '<div class="tool-error">Give a whole number for the input.</div>';
      return;
    }

    var t = ftTrace(i, model);
    var rip = ftRip(i, model);

    var h = '<div class="st-stats">' +
      '<span class="stat-pill a">input ' + i + '</span>' +
      '<span class="stat-pill dark">' +
        (model === 'int32' ? '32-bit int, as the program has'
                           : 'exact integers, as the specification has') + '</span>' +
      '<span class="stat-pill ' + (t.failed ? 'c' : 'b') + '">' +
        (t.failed ? 'this test fails' : 'this test passes') + '</span></div>';

    h += '<div class="st-cap">the four lines, and the state after each</div>' +
      '<table class="st-table"><thead><tr><th></th><th>the code as written</th>' +
      '<th>i, if it were right</th><th>i, as it is</th></tr></thead><tbody>';
    t.steps.forEach(function (s) {
      h += '<tr' + (s.differs ? ' class="st-wrong"' : '') + '>' +
        '<td class="st-ln">' + s.line + '</td>' +
        '<td><code>' + esc(s.code) + '</code>' +
          (s.note ? '<br><span class="st-note-i">' + esc(s.note) + '</span>' : '') + '</td>' +
        '<td><code>' + esc(s.intended) + '</code></td>' +
        '<td><code class="' + (s.differs ? 'st-bad' : '') + '">' + esc(s.actual) +
        '</code></td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="st-cap">and the three words for what just happened</div>' +
      '<table class="st-table st-rip"><tbody>' +
      '<tr><th>Fault</th><td>statements 2 and 3 are in the wrong order &mdash; a mistake ' +
        'about the binding power of the operators. It is in the file whether or not anyone ' +
        'runs it.</td><td>' + ripMark(true, 'always there') + '</td></tr>' +
      '<tr><th>Reached</th><td>the faulty statements executed. These four lines are ' +
        'straight through, so this is never in doubt here &mdash; in a program with ' +
        'branches it very much would be.</td><td>' + ripMark(rip.reached, 'executed') +
        '</td></tr>' +
      '<tr><th>Error</th><td>the state is wrong: after line 3 <code>i</code> holds ' +
        '<code>(2i)&sup3;</code> where it should hold <code>2i&sup3;</code>.</td><td>' +
        ripMark(rip.infected, rip.infected ? 'state is wrong' : 'state is still correct') +
        '</td></tr>' +
      '<tr><th>Failure</th><td>the wrong state reached the output, where somebody could ' +
        'see it.</td><td>' + ripMark(rip.propagated,
          rip.propagated ? 'visible' : 'nothing visible') + '</td></tr>' +
      '</tbody></table>';

    h += '<div class="verdict ' + (t.failed ? 'bad' : 'warn') + '">' +
      '<strong>Expected <code>' + esc(t.expected) + '</code>, got <code>' + esc(t.got) +
      '</code>.</strong> ' +
      (t.failed
        ? 'The fault ran, the state went wrong, and the wrongness came out. All three had ' +
          'to happen.'
        : rip.infected
          ? 'The state <em>did</em> go wrong &mdash; and then came right again before ' +
            'anything was printed. A fault was executed, an error occurred, and there was ' +
            'no failure, so this test tells you nothing.'
          : 'Nothing went wrong at all on this input: the two programs agree here, so this ' +
            'test could never have caught the fault.') + '</div>';

    if (!t.failed) {
      h += '<div class="tool-note">This is the whole reason the three words are three ' +
        'words. A test case that executes faulty code is not the same as a test case that ' +
        'detects it. Try the second tool to see how many inputs are in this position.</div>';
    }

    out.innerHTML = h;
  }

  function ripMark(yes, label) {
    return '<span class="st-mark ' + (yes ? 'yes' : 'no') + '">' +
      (yes ? '&#10003;' : '&#10007;') + ' ' + esc(label) + '</span>';
  }

  /* ---------- Tool 2 · which test cases would have caught it ---------- */

  function runCatchSweep() {
    var out = document.getElementById('cs-output');
    if (!out) return;
    var model = ((document.getElementById('cs-model') || {}).value) || 'math';
    var span = Number(((document.getElementById('cs-span') || {}).value) || 5000);

    var s = ftSweep(-span, span, model);
    var rule = ftOnce('rule-' + model, function () { return ftHiddenRule(model, 20000); });

    var h = '<div class="st-stats">' +
      '<span class="stat-pill a">' + s.total.toLocaleString() + ' inputs tried</span>' +
      '<span class="stat-pill b">' + s.revealed.toLocaleString() + ' reveal the fault</span>' +
      '<span class="stat-pill ' + (s.hidden.length ? 'c' : 'b') + '">' +
        s.hidden.length + ' hide it</span></div>';

    h += '<table class="st-table"><tbody>' +
      '<tr><th>range swept</th><td><code>' + s.from.toLocaleString() + '</code> to <code>' +
        s.to.toLocaleString() + '</code></td></tr>' +
      '<tr><th>inputs where the test passes anyway</th><td>' +
        (s.hidden.length
          ? '<code>' + s.hidden.slice(0, 12).map(String).join(', ') +
            (s.hidden.length > 12 ? ', …' : '') + '</code>'
          : '<span class="st-mark yes">none</span>') + '</td></tr>' +
      '<tr><th>the pattern</th><td>' + esc(rule.rule) + '</td></tr>' +
      '</tbody></table>';

    if (model === 'math') {
      h += '<div class="verdict warn"><strong>Over the integers, exactly one input hides ' +
        'it.</strong> The two programs compute <code>2i&sup3;</code> and ' +
        '<code>8i&sup3;</code>, which differ by <code>6i&sup3;</code> &mdash; zero only when ' +
        '<code>i = 0</code>. So a tester would have to be remarkably unlucky, picking zero ' +
        'and nothing else.</div>';
    } else {
      h += '<div class="verdict bad"><strong>In the program as actually written, every ' +
        'multiple of 2048 hides it.</strong> <code>int</code> is 32 bits, so the difference ' +
        '<code>6i&sup3;</code> has to be zero <em>modulo 2&sup3;&sup2;</em> rather than ' +
        'simply zero. That needs <code>i&sup3; &equiv; 0 (mod 2&sup3;&sup1;)</code>, which ' +
        'needs <code>i</code> divisible by <code>2<sup>&lceil;31/3&rceil;</sup> = 2048</code>.' +
        '<br><br>So a test suite using round numbers &mdash; 2048, 4096, 8192 &mdash; passes ' +
        'cleanly against a program that is wrong for almost every other input.</div>';
    }

    h += '<div class="tool-note">The pattern above is not asserted. Every input from ' +
      '&minus;20,000 to 20,000 was checked against it, and the prediction and the ' +
      'measurement disagreed on <strong>' + rule.mismatches + '</strong> of ' +
      rule.checked.toLocaleString() + '.<br><br>Which is the lesson of the topic in one ' +
      'number: <em>&ldquo;testing can show the presence of bugs, but not their absence&rdquo;</em>. ' +
      'Here is a fault that is present for almost every input and invisible to an entire ' +
      'family of perfectly reasonable test cases.</div>';

    out.innerHTML = h;
  }
