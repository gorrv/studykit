  /* ============================================================
     SCALA TOPIC 02 · rendering
     ============================================================ */

  /* ---------- Tool 1 · the same thing, two ways ---------- */

  var FC_PRESETS = {
    squares: { label: 'squares', list: 'List(1, 2, 3, 4, 5)', body: 'n * n', guard: '' },
    evens: { label: 'keep the even ones', list: 'List(1, 2, 3, 4, 5, 6)', body: 'n', guard: 'n % 2 == 0' },
    both: { label: 'filter and transform', list: 'List(1, 2, 3, 4, 5, 6)', body: 'n * 10', guard: 'n % 2 == 0' },
    doubled: { label: 'doubling', list: 'List(3, 1, 4, 1, 5)', body: 'n * 2', guard: '' },
    negatives: { label: 'a guard that keeps nothing', list: 'List(1, 2, 3)', body: 'n', guard: 'n > 99' }
  };

  var fcCurrent = 'squares';

  function runForComp(which) {
    var out = document.getElementById('fc-output');
    if (!out) return;
    if (which) fcCurrent = which;
    var p = FC_PRESETS[fcCurrent] || FC_PRESETS.squares;

    var forSrc = p.guard
      ? 'for (n <- ' + p.list + ' if ' + p.guard + ') yield ' + p.body
      : 'for (n <- ' + p.list + ') yield ' + p.body;
    var mapSrc = p.guard
      ? p.list + '.filter(n => ' + p.guard + ').map(n => ' + p.body + ')'
      : p.list + '.map(n => ' + p.body + ')';

    var a = scEval(forSrc, {});
    var b = scEval(mapSrc, {});
    var same = a.ok && b.ok && a.show === b.show;

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + esc(p.label) + '</span>' +
      '<span class="stat-pill ' + (same ? 'b' : 'c') + '">' +
        (same ? 'the same answer' : 'different!') + '</span></div>';

    h += '<div class="fc-choices">';
    Object.keys(FC_PRESETS).forEach(function (k) {
      h += '<button class="chip' + (k === fcCurrent ? ' on' : '') +
        '" onclick="runForComp(\'' + k + '\')">' + esc(FC_PRESETS[k].label) + '</button>';
    });
    h += '</div>';

    h += '<div class="fc-pair">';
    [['for-comprehension', forSrc, a], ['what it desugars to', mapSrc, b]].forEach(function (col) {
      h += '<div class="fc-side"><div class="pp-cap">' + col[0] + '</div>' +
        '<pre class="pp-snippet">' + esc(col[1]) + '</pre>' +
        '<div class="sc-result"><span class="sc-type">' +
        esc(col[2].ok ? col[2].type : 'error') + '</span> = <span class="sc-val">' +
        esc(col[2].ok ? col[2].show : col[2].error.replace(/<[^>]*>/g, '')) +
        '</span></div></div>';
    });
    h += '</div>';

    h += '<div class="verdict ' + (same ? 'safe' : 'bad') + '">' +
      (same
        ? 'A for-comprehension is not a loop. It is <strong>syntax</strong> for exactly the ' +
          'method calls on the right, and the compiler rewrites one into the other before ' +
          'anything runs. The <code>if</code> becomes a <code>filter</code>, the ' +
          '<code>yield</code> becomes a <code>map</code>.'
        : 'These should be identical. If you are reading this, the desugaring is wrong.') +
      '</div>';

    h += '<div class="pp-note">Both sides are evaluated here, every time this renders. The test ' +
      'suite does the same on 200 randomly generated pairs.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · what to do when there might be nothing ---------- */

  function runOption() {
    var out = document.getElementById('so-output');
    if (!out) return;
    var raw = ((document.getElementById('so-input') || {}).value);
    if (raw === undefined) raw = '1234';

    var lit = '"' + raw.replace(/"/g, '') + '"';
    var direct = scEval(lit + '.toInt', {});
    var opt = scEval(lit + '.toIntOption', {});

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">input ' + esc(lit) + '</span>' +
      '<span class="stat-pill ' + (direct.ok ? 'b' : 'c') + '">' +
        (direct.ok ? 'parses' : 'throws') + '</span>' +
      '<span class="stat-pill b">' + esc(opt.ok ? opt.show : '?') + '</span></div>';

    h += '<div class="so-row">';
    h += '<div class="so-side"><div class="pp-cap">the Java way</div>' +
      '<pre class="pp-snippet">' + esc(raw.slice(0, 24)) + '.toInt</pre>' +
      '<div class="verdict ' + (direct.ok ? 'safe' : 'bad') + '">' +
      (direct.ok
        ? 'Gives <code>' + esc(direct.show) + '</code>. Nothing in the type said it might not.'
        : direct.error) + '</div></div>';

    h += '<div class="so-side"><div class="pp-cap">the Scala way</div>' +
      '<pre class="pp-snippet">' + esc(raw.slice(0, 24)) + '.toIntOption</pre>' +
      '<div class="verdict safe">Gives <code>' + esc(opt.ok ? opt.show : '?') + '</code>, of type ' +
      '<code>Option[Int]</code>. The type says it might be nothing, so the compiler makes you ' +
      'deal with that.</div></div>';
    h += '</div>';

    /* The four ways of getting at what is inside. */
    var ways = [
      { src: lit + '.toIntOption.getOrElse(0)', label: 'getOrElse — supply a fallback' },
      { src: lit + '.toIntOption.map(n => n * 2)', label: 'map — do something only if there is something' },
      { src: lit + '.toIntOption match { case Some(n) => n case None => -1 }',
        label: 'match — handle both, visibly' },
      { src: lit + '.toIntOption.get', label: 'get — assume, and throw when wrong' }
    ];
    h += '<div class="so-ways"><div class="pp-cap">getting at the value</div>' +
      '<table class="pp-table"><thead><tr><th>expression</th><th>result</th></tr></thead><tbody>';
    ways.forEach(function (way) {
      var r = scEval(way.src, {});
      h += '<tr><td><code>' + esc(way.src.replace(lit + '.toIntOption', 'opt')) + '</code>' +
        '<div class="pp-note" style="margin:2px 0 0;">' + esc(way.label) + '</div></td>' +
        '<td class="' + (r.ok ? 'yes' : 'no') + '"><code>' +
        esc(r.ok ? r.show : 'throws') + '</code></td></tr>';
    });
    h += '</tbody></table></div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">Why this is better than null</div>' +
      'A <code>null</code> has the same type as a real value, so the compiler cannot tell them ' +
      'apart and the mistake surfaces at run time, somewhere else, as a ' +
      '<code>NullPointerException</code>. An <code>Option[Int]</code> is a <em>different type</em> ' +
      'from <code>Int</code>: you cannot add one to a number by accident, and the one place you ' +
      'are forced to think about emptiness is the place that knows what to do about it.' +
      '<br><br>The cost is that you write the handling out. That is the point.</div>';

    h += '<div class="pp-note">Which strings parse and which throw is ' +
      '<code>Integer.parseInt</code>, and the test suite checks these answers against a real JVM. ' +
      'Try <code>12x</code>, a leading space, or <code>2147483648</code>.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · which case wins ---------- */

  var MT_PRESETS = {
    fizz: { label: 'fizz buzz, on a pair',
      src: '(n % 3, n % 5) match {\n' +
        '  case (0, 0) => "fizz buzz"\n  case (0, _) => "fizz"\n' +
        '  case (_, 0) => "buzz"\n  case _ => n.toString\n}',
      vars: [{ name: 'n', values: [1, 3, 5, 15, 7, 9, 10, 30] }] },
    wildFirst: { label: 'the same, with case _ moved up',
      src: '(n % 3, n % 5) match {\n' +
        '  case _ => n.toString\n  case (0, 0) => "fizz buzz"\n' +
        '  case (0, _) => "fizz"\n  case (_, 0) => "buzz"\n}',
      vars: [{ name: 'n', values: [15, 3, 5, 7] }] },
    list: { label: 'taking a list apart',
      src: 'xs match {\n  case Nil => "empty"\n' +
        '  case h :: Nil => "just " + h\n  case h :: t => h + " then " + t.length + " more"\n}',
      vars: [{ name: 'xs', values: ['Nil', 'List(7)', 'List(1, 2, 3)'] }] },
    option: { label: 'unwrapping an Option',
      src: 'o match {\n  case Some(v) if v > 10 => "big: " + v\n' +
        '  case Some(v) => "small: " + v\n  case None => "nothing"\n}',
      vars: [{ name: 'o', values: ['Some(42)', 'Some(3)', 'None'] }] },
    missing: { label: 'a match with a gap in it',
      src: 'n match {\n  case 1 => "one"\n  case 2 => "two"\n}',
      vars: [{ name: 'n', values: [1, 2, 3] }] }
  };

  var mtCurrent = 'fizz', mtValue = 0;

  function runMatch(which, valueIndex) {
    var out = document.getElementById('mt-output');
    if (!out) return;
    if (which) { mtCurrent = which; mtValue = 0; }
    if (valueIndex !== undefined && valueIndex !== null) mtValue = valueIndex;
    var p = MT_PRESETS[mtCurrent] || MT_PRESETS.fizz;
    var v = p.vars[0];
    var chosen = v.values[Math.min(mtValue, v.values.length - 1)];

    var env = {};
    var bound = scEval(String(chosen), {});
    if (bound.ok) env[v.name] = bound.value;

    var oneLine = p.src.replace(/\n\s*/g, ' ');
    var r = scMatchTrace(oneLine, env);

    var h = '<div class="mt-choices">';
    Object.keys(MT_PRESETS).forEach(function (k) {
      h += '<button class="chip' + (k === mtCurrent ? ' on' : '') +
        '" onclick="runMatch(\'' + k + '\')">' + esc(MT_PRESETS[k].label) + '</button>';
    });
    h += '</div>';

    h += '<div class="mt-values"><span class="pp-cap" style="margin:0 6px 0 0;">' +
      esc(v.name) + ' =</span>';
    v.values.forEach(function (val, i) {
      h += '<button class="chip' + (i === Math.min(mtValue, v.values.length - 1) ? ' on' : '') +
        '" onclick="runMatch(null, ' + i + ')">' + esc(String(val)) + '</button>';
    });
    h += '</div>';

    h += '<pre class="pp-snippet">' + esc(p.src) + '</pre>';

    if (!r.ok) {
      h += '<div class="verdict bad">' + r.error + '</div>';
      out.innerHTML = h;
      return;
    }

    h += '<div class="rd-stats">' +
      '<span class="stat-pill a">scrutinee: <code>' + esc(r.scrutinee) + '</code></span>' +
      '<span class="stat-pill a">' + esc(r.scrutType) + '</span>' +
      '<span class="stat-pill ' + (r.exhaustive ? 'b' : 'c') + '">' +
        (r.exhaustive ? 'case ' + (r.winner + 1) + ' wins' : 'nothing matches') + '</span></div>';

    h += '<table class="mt-table"><thead><tr><th>#</th><th>pattern</th><th>tried?</th>' +
      '<th>matches?</th><th>binds</th></tr></thead><tbody>';
    r.rows.forEach(function (row, i) {
      var state = i === r.winner ? 'win' : (!row.reached ? 'dead' : (row.matched ? 'win' : 'miss'));
      h += '<tr class="mt-' + state + '"><td>' + (i + 1) + '</td>' +
        '<td><code>' + esc(row.pattern) + '</code>' +
        (row.guard ? ' <span class="mt-guard">if ' + esc(row.guard) + '</span>' : '') + '</td>' +
        '<td>' + (row.reached ? 'yes' : '<span class="mt-no">never reached</span>') + '</td>' +
        '<td>' + (row.matched ? '<strong>yes</strong>' : 'no') +
        (row.guardResult === false ? ' <span class="mt-guard">(guard false)</span>' : '') + '</td>' +
        '<td>' + (row.binds.length
          ? row.binds.map(function (b) {
              return '<code>' + esc(b.name) + ' = ' + esc(b.value) + '</code>';
            }).join(', ')
          : '—') + '</td></tr>';
    });
    h += '</tbody></table>';

    if (r.result !== null) {
      h += '<div class="sc-result"><span class="sc-res">result:</span> <span class="sc-val">' +
        esc(r.result) + '</span></div>';
    } else {
      h += '<div class="verdict bad">' + r.error + '</div>';
    }

    var deadCount = r.rows.filter(function (row) { return !row.reached && row.matched; }).length;
    if (deadCount) {
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">' + deadCount + ' case' + (deadCount === 1 ? '' : 's') +
        ' would have matched and never got the chance</div>' +
        'Cases are tried <strong>in order</strong> and the first match wins. That is the whole ' +
        'rule, and it is why the specific cases go first: put <code>case _</code> at the top and ' +
        'everything below it is unreachable. Scala warns about some of these and not others, so ' +
        'reading the order yourself is the reliable habit.</div>';
    }

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · recursion over a list ---------- */

  var RC_PRESETS = {
    flatten: { label: 'my_flatten — drop the Nones',
      code: 'def my_flatten(xs: List[Option[Int]]): List[Int] =\n  xs match {\n' +
        '    case Nil => Nil\n    case None :: rest => my_flatten(rest)\n' +
        '    case Some(v) :: rest => v :: my_flatten(rest)\n  }',
      input: [null, 3, null, 7, 1] },
    fib: { label: 'fib — two calls per step', code: null, input: null }
  };

  var rcCurrent = 'flatten', rcN = 6;

  function runRecursion(which, n) {
    var out = document.getElementById('rc2-output');
    if (!out) return;
    if (which) rcCurrent = which;
    if (n !== undefined && n !== null) rcN = n;

    var h = '<div class="mt-choices">';
    Object.keys(RC_PRESETS).forEach(function (k) {
      h += '<button class="chip' + (k === rcCurrent ? ' on' : '') +
        '" onclick="runRecursion(\'' + k + '\')">' + esc(RC_PRESETS[k].label) + '</button>';
    });
    h += '</div>';

    if (rcCurrent === 'flatten') {
      var p = RC_PRESETS.flatten;
      h += '<pre class="pp-snippet">' + esc(p.code) + '</pre>';
      var trace = scFlattenTrace(p.input);
      h += '<table class="up-trace"><thead><tr><th>call</th><th>case</th><th>gives</th>' +
        '</tr></thead><tbody>';
      trace.steps.forEach(function (st, i) {
        h += '<tr data-step="' + i + '"><td><code>' + esc(st.call) + '</code></td>' +
          '<td><code>' + esc(st.matched) + '</code></td>' +
          '<td><code>' + esc(st.gives) + '</code></td></tr>';
      });
      h += '</tbody></table>';
      h += '<div class="verdict safe">Each call does one thing and hands the rest of the list to ' +
        'itself. There is no accumulator and no index — the base case <code>Nil</code> stops it, ' +
        'and the answer is built on the way back out.</div>';
      h += '<div class="pp-note">' + trace.steps.length + ' calls for a list of ' +
        p.input.length + ', which is one per element plus one for the empty tail.</div>';
    } else {
      h += '<pre class="pp-snippet">def fib(n: Int): Int = {\n' +
        '  if (n == 0 || n == 1) 1\n  else fib(n - 1) + fib(n - 2)\n}</pre>';
      h += '<div class="mt-values"><span class="pp-cap" style="margin:0 6px 0 0;">n =</span>';
      [4, 6, 8, 10, 12, 14, 16, 18, 20].forEach(function (k) {
        h += '<button class="chip' + (k === rcN ? ' on' : '') +
          '" onclick="runRecursion(null, ' + k + ')">' + k + '</button>';
      });
      h += '</div>';
      var f = scFibCount(rcN);
      h += '<div class="rd-stats">' +
        '<span class="stat-pill a">fib(' + rcN + ') = ' + f.value + '</span>' +
        '<span class="stat-pill ' + (f.calls > 5000 ? 'c' : 'b') + '">' + f.calls + ' calls</span>' +
        '<span class="stat-pill a">depth ' + f.depth + '</span></div>';
      h += '<div class="rc-bars">';
      [4, 6, 8, 10, 12, 14, 16, 18, 20].forEach(function (k) {
        var c = scFibCount(k).calls;
        var w2 = Math.max(1, Math.round(100 * c / scFibCount(20).calls));
        h += '<div class="rc-bar-row"><span class="rc-bar-n">' + k + '</span>' +
          '<span class="rc-bar" style="width:' + w2 + '%"></span>' +
          '<span class="rc-bar-c">' + c + '</span></div>';
      });
      h += '</div>';
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">Correct, and the wrong shape</div>' +
        'This is the definition of the Fibonacci numbers written out directly, and it is right. ' +
        'It is also exponential: <code>fib(n - 1)</code> and <code>fib(n - 2)</code> recompute ' +
        'the same values over and over, and the call count roughly doubles every time n goes up ' +
        'by two — counted above by running it.<br><br>' +
        'Note also the indexing: this returns 1 for both 0 and 1, so it is shifted by one from ' +
        'the definition that starts 0, 1, 1, 2.</div>';
    }

    out.innerHTML = h;
  }

  /** my_flatten, traced call by call. */
  function scFlattenTrace(items) {
    var steps = [];
    function show(xs) {
      return 'List(' + xs.map(function (x) {
        return x === null ? 'None' : 'Some(' + x + ')';
      }).join(', ') + ')';
    }
    function go(xs) {
      if (!xs.length) {
        steps.push({ call: 'my_flatten(Nil)', matched: 'case Nil', gives: 'Nil' });
        return [];
      }
      var head = xs[0], rest = xs.slice(1);
      if (head === null) {
        var r1 = go(rest);
        steps.push({ call: 'my_flatten(' + show(xs) + ')', matched: 'case None :: rest',
          gives: 'List(' + r1.join(', ') + ')' });
        return r1;
      }
      var r2 = go(rest);
      var out = [head].concat(r2);
      steps.push({ call: 'my_flatten(' + show(xs) + ')', matched: 'case Some(v) :: rest',
        gives: v2(head) + ' :: List(' + r2.join(', ') + ') = List(' + out.join(', ') + ')' });
      return out;
    }
    function v2(x) { return String(x); }
    var result = go(items);
    steps.reverse();
    return { steps: steps, result: result };
  }

  /** fib as written, with the calls counted rather than estimated. */
  function scFibCount(n) {
    var calls = 0, maxDepth = 0;
    function fib(k, d) {
      calls++;
      if (d > maxDepth) maxDepth = d;
      if (k === 0 || k === 1) return 1;
      return fib(k - 1, d + 1) + fib(k - 2, d + 1);
    }
    var v = fib(n, 1);
    return { value: v, calls: calls, depth: maxDepth };
  }
