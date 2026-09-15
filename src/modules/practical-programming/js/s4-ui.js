  /* ============================================================
     SCALA TOPIC 04 · rendering
     ============================================================ */

  /* ---------- Tool 1 · infix to RPN to instructions ---------- */

  var rpCurrent = 'brackets';

  function runRPN(which) {
    var out = document.getElementById('rp-output');
    if (!out) return;
    if (which) rpCurrent = which;
    var box = document.getElementById('rp-input');
    if (which && box) box.value = RP_PRESETS[which].src;
    var src = box ? box.value : RP_PRESETS.brackets.src;

    var conv = rpConvert(src);

    var h = '';

    if (!conv.ok) {
      out.innerHTML = h + '<div class="verdict bad">' + conv.error + '</div>';
      return;
    }

    var stackRun = rpEval(conv.tokens);
    var code = rpCompile(conv.tokens);
    var codeRun = rpRunCode(code);
    var direct = scEval(src, {});

    var agree = stackRun.ok && codeRun.ok && direct.ok &&
      stackRun.value === codeRun.value && String(stackRun.value) === direct.show;

    h += '<div class="rd-stats">' +
      '<span class="stat-pill a"><code>' + esc(src) + '</code></span>' +
      '<span class="stat-pill b">' + esc(conv.rpn.join(' ')) + '</span>' +
      (stackRun.ok
        ? '<span class="stat-pill ' + (agree ? 'b' : 'c') + '">= ' + stackRun.value + '</span>'
        : '<span class="stat-pill c">' + esc(stackRun.error.replace(/<[^>]*>/g, '')) + '</span>') +
      '</div>';

    /* The conversion, step by step. */
    h += '<table class="up-trace"><thead><tr><th>reading</th><th>output so far</th>' +
      '<th>operator stack</th><th>why</th></tr></thead><tbody>';
    conv.steps.forEach(function (st, i) {
      h += '<tr data-step="' + i + '"><td><code>' + esc(st.token || '(end)') + '</code></td>' +
        '<td><code>' + esc(st.output || '—') + '</code></td>' +
        '<td><code>' + esc(st.stack || '—') + '</code></td>' +
        '<td>' + esc(st.action) + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="rp-pair">';
    h += '<div class="rp-side"><div class="pp-cap">the instructions</div>' +
      '<pre class="pp-snippet">' + code.map(esc).join('\n') + '</pre></div>';

    if (stackRun.ok) {
      h += '<div class="rp-side"><div class="pp-cap">the stack, as it runs</div>' +
        '<table class="pp-table"><tbody>';
      stackRun.steps.forEach(function (st) {
        h += '<tr><td><code>' + esc(st.token) + '</code></td>' +
          '<td>' + esc(st.did) + '</td>' +
          '<td><code>[' + st.stack.join(', ') + ']</code></td></tr>';
      });
      h += '</tbody></table></div>';
    }
    h += '</div>';

    h += '<div class="verdict ' + (agree ? 'safe' : 'bad') + '">' +
      (agree
        ? '<strong>Three routes, one number.</strong> The expression evaluated directly, the RPN ' +
          'run on a stack, and the compiled instructions run on the same stack all give ' +
          stackRun.value + '. That agreement is what makes the conversion a compiler rather than ' +
          'a rearrangement.'
        : 'These should agree. If you are reading this, the conversion is wrong.') + '</div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">Why bother with the notation</div>' +
      'Reverse Polish has no brackets and needs no precedence rules — the order <em>is</em> the ' +
      'answer. Which means the last step is not really a compiler at all: a number becomes ' +
      '<code>ldc</code>, an operator becomes <code>iadd</code> or <code>imul</code>, and that is ' +
      'the whole translation. The work was done by the conversion.<br><br>' +
      'The JVM is a stack machine, so this is close to what <code>scalac</code> actually emits ' +
      'for an arithmetic expression.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · what backtracking costs ---------- */

  var bkPattern = 'nested', bkMax = 18;

  function runBacktrack(which, max) {
    var out = document.getElementById('bk-output');
    if (!out) return;
    bkPattern = ((document.getElementById('bk-pattern') || {}).value) || 'nested';
    bkMax = Number(((document.getElementById('bk-max') || {}).value) || '18');
    var p = BK_PATTERNS[bkPattern] || BK_PATTERNS.nested;

    var parsed = bkParse(p.src);
    if (!parsed.ok) {
      out.innerHTML = '<div class="verdict bad">' + parsed.error + '</div>';
      return;
    }

    var h = '';

    h += '<div class="pp-note">Matching <code>' + esc(p.src) + '</code> against a string of ' +
      'n a&rsquo;s — which has no <code>b</code>, so the answer is always <em>no</em>. The ' +
      'question is how much work it takes to find that out.</div>';

    /* Three columns: our backtracking matcher, our derivative matcher,
       and the host's own regex engine, timed. */
    var rows = [];
    var hostRe = null;
    try { hostRe = new RegExp('^' + p.src + '$'); } catch (e) { hostRe = null; }

    for (var n = 2; n <= bkMax; n += 2) {
      var input = new Array(n + 1).join('a');
      var back = bkMatch(parsed.ast, input, 8000000);
      var deriv = bkDerivMatch(parsed.ast, input);
      var ms = null;
      if (hostRe) {
        var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
        hostRe.test(input);
        var t1 = (window.performance && performance.now) ? performance.now() : Date.now();
        ms = t1 - t0;
      }
      rows.push({ n: n, back: back, deriv: deriv, ms: ms });
    }

    var worst = rows.reduce(function (a, r) {
      return Math.max(a, r.back.overflowed ? 8000000 : r.back.steps);
    }, 1);

    h += '<table class="bk-table"><thead><tr><th>n</th>' +
      '<th>backtracking steps</th><th></th>' +
      '<th>derivative steps</th><th>your browser&rsquo;s own regex engine</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var w = Math.max(1, Math.round(100 * (r.back.overflowed ? 8000000 : r.back.steps) / worst));
      h += '<tr><td>' + r.n + '</td>' +
        '<td class="bk-num">' + (r.back.overflowed ? 'gave up past 8,000,000'
          : r.back.steps.toLocaleString()) + '</td>' +
        '<td class="bk-barcell"><span class="bk-bar" style="width:' + w + '%"></span></td>' +
        '<td class="bk-num">' + r.deriv.steps + '</td>' +
        '<td class="bk-num">' + (r.ms === null ? '—'
          : (r.ms < 1 ? r.ms.toFixed(2) : r.ms.toFixed(1)) + ' ms') + '</td></tr>';
    });
    h += '</tbody></table>';

    var first = rows[0], last = rows[rows.length - 1];
    var growth = (!last.back.overflowed && first.back.steps > 0)
      ? Math.round(last.back.steps / first.back.steps) : null;

    h += '<div class="verdict ' + (last.back.overflowed || (growth && growth > 1000) ? 'bad' : 'safe') + '">' +
      (last.back.overflowed
        ? '<strong>It ran out of budget.</strong> Somewhere below n = ' + last.n + ' the number of ' +
          'ways to split the a&rsquo;s between the repetitions passed eight million.'
        : growth && growth > 1000
          ? '<strong>' + growth.toLocaleString() + ' times more work</strong> going from n = ' +
            first.n + ' to n = ' + last.n + ', for ' + (last.n - first.n) + ' more characters.'
          : 'The work grows in step with the input — roughly ' +
            (last.back.steps / last.n).toFixed(1) + ' steps per character, whatever n is.') +
      '<br><br>The derivative column is the same question answered without backtracking: it never ' +
      'exceeds one step per character, because it rewrites the pattern as it goes instead of ' +
      'trying alternatives.</div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">' + esc(p.src) + '</div>' + p.note + '</div>';

    if (bkPattern === 'nested' || bkPattern === 'alt') {
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">The last column is not a simulation</div>' +
        'Those milliseconds were measured just now, in this tab, by handing ' +
        '<code>/^' + esc(p.src) + '$/</code> to the regular expression engine built into your ' +
        'browser. It is the same class of engine used by Java, Python, JavaScript and Ruby, and ' +
        'it behaves the same way on this pattern.<br><br>' +
        'This is not a curiosity. A pattern like this one, reachable from user input, is a way to ' +
        'take a server down with a short string — which is why it has a name, ReDoS, and why the ' +
        'alternative below matters.</div>';
    }

    h += '<div class="pp-note">Both matchers here are checked against each other in the test ' +
      'suite: every string over {a, b} up to length 8, for every pattern above, has to get the ' +
      'same yes or no from both.</div>';

    out.innerHTML = h;
  }
