  /* ============================================================
     RECURRENCE RELATIONS AND INDUCTION (Topic 03)

     A recurrence defines T(n) in terms of smaller values of T. To
     turn it into a closed form you guess the answer and prove it by
     induction, sometimes called the method of substitution:

         Base case)      the formula holds at the smallest n
         Inductive case) assume it holds at k (or at all m ≤ k),
                         substitute, and confirm it holds at k+1

     The second half is the part worth mechanising. Checking that
     T(n) = g(n) for lots of n is weak evidence — it says the values
     agree, not that the *argument* works. The inductive step is a
     different claim:

         take the recurrence for T(k+1), replace every T(m) inside it
         by g(m), and the result must come out as g(k+1)

     That is exactly the substitution a student does by hand, and it
     can be done numerically for every k in a range. rcInduction does
     that, and reports the two sides separately so a failure shows
     you where the algebra goes wrong rather than just saying no.

     What this cannot do is prove the step symbolically for all k. It
     checks a range, and it says so. That is the honest limit of the
     tool, and the notes repeat it.
     ============================================================ */

  /**
   * Tokenise and evaluate arithmetic over n, with calls to T.
   *
   * Grammar:
   *   expr   -> term (('+'|'-') term)*
   *   term   -> power (('*'|'/') power)*
   *   power  -> unary ('^' power)?          right-associative
   *   unary  -> '-' unary | atom
   *   atom   -> number | 'n' | T(expr) | fn(expr) | '(' expr ')'
   *             | floor/ceil brackets
   *
   * Juxtaposition means multiplication, so 2T(n-1) and 9T(n/3) parse
   * the way they are written on paper.
   *
   * @param {function(number): number} T  called for T(...) subterms
   * @returns {{ok: true, f: function(number): number} | {ok: false, error}}
   */
  function rcCompile(src, allowT) {
    var s = String(src)
      .replace(/⌊/g, 'floor(').replace(/⌋/g, ')')
      .replace(/⌈/g, 'ceil(').replace(/⌉/g, ')')
      .replace(/√/g, 'sqrt')
      .replace(/\s+/g, '');
    if (!s) return { ok: false, error: 'Nothing to read yet.' };

    var at = 0, fail = null;

    function peek() { return s.charAt(at); }
    function eat(str) {
      if (s.substr(at, str.length) === str) { at += str.length; return true; }
      return false;
    }

    function expr() {
      var v = term();
      for (;;) {
        if (eat('+')) v = mk('+', v, term());
        else if (eat('-')) v = mk('-', v, term());
        else return v;
        if (fail) return null;
      }
    }

    function term() {
      var v = power();
      for (;;) {
        if (fail) return null;
        if (eat('*')) v = mk('*', v, power());
        else if (eat('/')) v = mk('/', v, power());
        else if (startsAtom()) v = mk('*', v, power());   // juxtaposition
        else return v;
      }
    }

    /* Does an atom start here? Used to spot implicit multiplication. */
    function startsAtom() {
      var c = peek();
      return c === '(' || c === 'n' || c === 'T' ||
             /[0-9.]/.test(c) ||
             /^(floor|ceil|log2|log|sqrt|lg)\(/.test(s.slice(at));
    }

    function power() {
      var base = unary();
      if (fail) return null;
      if (eat('^')) {
        var ex = power();
        if (fail) return null;
        return mk('^', base, ex);
      }
      return base;
    }

    function unary() {
      if (eat('-')) { var v = unary(); return fail ? null : mk('neg', v, null); }
      return atom();
    }

    function atom() {
      var c = peek();

      if (c === '(') { at++; var inner = expr(); if (fail) return null;
        if (!eat(')')) { fail = 'Missing a closing bracket.'; return null; }
        return inner; }

      var fn = /^(floor|ceil|log2|log|sqrt|lg)\(/.exec(s.slice(at));
      if (fn) {
        at += fn[0].length;
        var a = expr();
        if (fail) return null;
        if (!eat(')')) { fail = 'Missing a closing bracket after ' + fn[1] + '.'; return null; }
        return mk('fn:' + fn[1], a, null);
      }

      if (c === 'T') {
        if (!allowT) { fail = 'A closed form may not mention <code>T</code> — that is what you are solving for.'; return null; }
        at++;
        if (!eat('(')) { fail = 'Expected <code>(</code> after T.'; return null; }
        var arg = expr();
        if (fail) return null;
        if (!eat(')')) { fail = 'Missing a closing bracket after T(.'; return null; }
        return mk('T', arg, null);
      }

      if (c === 'n') { at++; return mk('n', null, null); }

      var num = /^[0-9]+(\.[0-9]+)?/.exec(s.slice(at));
      if (num) { at += num[0].length; return mk('num', parseFloat(num[0]), null); }

      fail = c ? 'Do not understand <code>' + esc(c) + '</code> here.' : 'The expression stops in the middle.';
      return null;
    }

    function mk(op, a, b) { return { op: op, a: a, b: b }; }

    var ast = expr();
    if (fail) return { ok: false, error: fail };
    if (at < s.length) {
      return { ok: false, error: 'Unexpected <code>' + esc(s.slice(at, at + 6)) + '</code>.' };
    }

    return { ok: true, ast: ast, f: function (n, T) { return rcEval(ast, n, T); } };
  }

  function rcEval(node, n, T) {
    switch (node.op) {
      case 'num': return node.a;
      case 'n':   return n;
      case 'neg': return -rcEval(node.a, n, T);
      case '+':   return rcEval(node.a, n, T) + rcEval(node.b, n, T);
      case '-':   return rcEval(node.a, n, T) - rcEval(node.b, n, T);
      case '*':   return rcEval(node.a, n, T) * rcEval(node.b, n, T);
      case '/':   return rcEval(node.a, n, T) / rcEval(node.b, n, T);
      case '^':   return Math.pow(rcEval(node.a, n, T), rcEval(node.b, n, T));
      case 'T':   return T(rcEval(node.a, n, T));
      case 'fn:floor': return Math.floor(rcEval(node.a, n, T));
      case 'fn:ceil':  return Math.ceil(rcEval(node.a, n, T));
      case 'fn:sqrt':  return Math.sqrt(rcEval(node.a, n, T));
      case 'fn:log2':
      case 'fn:lg':
      case 'fn:log':   return Math.log2(rcEval(node.a, n, T));
    }
    return NaN;
  }

  /**
   * Build a memoised T from a base case and a recurrence.
   *
   * The guard matters: a recurrence whose argument does not actually
   * shrink — T(n) = 2T(n) + 1, or T(n/2) written where the base is
   * never reached — would recurse until the stack gives out. Rather
   * than crash the page, the depth is capped and reported as an
   * error the reader can act on.
   *
   * @param {Object} base   {1: 1} style map of base cases
   * @returns {{ok: true, T} | {ok: false, error}}
   */
  function rcBuild(base, recSrc) {
    var c = rcCompile(recSrc, true);
    if (!c.ok) return c;

    var memo = {}, depth = 0, blew = null;
    for (var k in base) memo[k] = base[k];

    function T(n) {
      n = Math.round(n);
      if (blew) return NaN;
      if (memo[n] !== undefined) return memo[n];
      if (n < 0 || !isFinite(n)) { blew = 'T(' + n + ') is outside the recurrence.'; return NaN; }
      // 800, not something larger: each level of T costs several stack
      // frames inside rcEval, so a cap set near the engine's own limit
      // is reached only after the stack has already blown. A recurrence
      // that legitimately needs more than 800 levels is not something
      // this tool should be drawing anyway.
      if (++depth > 800) {
        blew = 'The recursion never reached a base case. Check that the argument of T ' +
               'really gets smaller, and that you gave a base case it can land on.';
        depth--;
        return NaN;
      }
      var v = c.f(n, T);
      depth--;
      memo[n] = v;
      return v;
    }

    return {
      ok: true,
      T: function (n) {
        blew = null;
        depth = 0;
        // Even with the cap, a pathological expression could nest deeply
        // enough to throw. Catching it keeps a bad recurrence from taking
        // the whole page down with it.
        try {
          var v = T(n);
          return blew ? NaN : v;
        } catch (e) {
          blew = 'That recurrence is too deeply nested to evaluate — check that ' +
                 'the argument of T gets smaller each time.';
          return NaN;
        }
      },
      error: function () { return blew; },
      raw: T,
      failed: function () { return blew; },
    };
  }

  /** Tabulate T(1..upto). */
  function rcTable(rec, upto) {
    var rows = [];
    for (var n = 1; n <= upto; n++) {
      var v = rec.T(n);
      rows.push({ n: n, value: v, ok: isFinite(v) });
      if (!isFinite(v)) break;
    }
    return rows;
  }

  /**
   * The inductive step, done numerically.
   *
   * For each k in the range: take the recurrence's right-hand side at
   * n = k+1, but answer every T(m) inside it with the *claimed* g(m)
   * rather than the real T(m). That is the substitution the proof
   * performs. The result must equal (or satisfy the relation with)
   * g(k+1).
   *
   * Doing it this way means a claimed formula that happens to agree
   * with T at the values tested, but does not actually survive
   * substitution, is still caught.
   *
   * @param {string} recSrc  the recurrence, right-hand side
   * @param {string} gSrc    the claimed closed form
   * @param {string} rel     '=', '>=' or '<='
   * @returns {{ok, base, steps, checked}}
   */
  function rcInduction(base, recSrc, gSrc, rel, from, to) {
    var c = rcCompile(recSrc, true);
    if (!c.ok) return { ok: false, error: c.error };
    var g = rcCompile(gSrc, false);
    if (!g.ok) return { ok: false, error: g.error };

    var G = function (n) { return g.f(Math.round(n), null); };
    var holds = function (lhs, rhs) {
      var eps = 1e-9 * Math.max(1, Math.abs(lhs), Math.abs(rhs));
      if (rel === '>=') return lhs > rhs - eps;
      if (rel === '<=') return lhs < rhs + eps;
      return Math.abs(lhs - rhs) <= eps;
    };

    /* base cases */
    var baseRows = [];
    for (var b in base) {
      var n0 = Number(b);
      baseRows.push({ n: n0, lhs: base[b], rhs: G(n0), ok: holds(base[b], G(n0)) });
    }

    /* the inductive step, with g substituted for T */
    var steps = [], allOk = baseRows.every(function (r) { return r.ok; });
    for (var k = from; k <= to; k++) {
      var lhs = c.f(k + 1, G);            // recurrence at k+1, using g inside
      var rhs = G(k + 1);
      var ok = holds(lhs, rhs);
      steps.push({ k: k, lhs: lhs, rhs: rhs, ok: ok });
      if (!ok) allOk = false;
    }

    return { ok: true, base: baseRows, steps: steps, allOk: allOk, rel: rel,
             checked: steps.length };
  }

  /**
   * Do the recurrence and the claimed formula agree as *values*?
   *
   * Weaker than the induction check above, and offered alongside it
   * so the difference is visible: values can agree while the step
   * fails, and the step is what a proof needs.
   */
  function rcAgree(rec, gSrc, rel, upto) {
    var g = rcCompile(gSrc, false);
    if (!g.ok) return { ok: false, error: g.error };
    var rows = [], bad = 0;
    for (var n = 1; n <= upto; n++) {
      var t = rec.T(n), gv = g.f(n, null);
      if (!isFinite(t)) break;
      var eps = 1e-9 * Math.max(1, Math.abs(t), Math.abs(gv));
      var ok = rel === '>=' ? t > gv - eps : rel === '<=' ? t < gv + eps : Math.abs(t - gv) <= eps;
      if (!ok) bad++;
      rows.push({ n: n, T: t, g: gv, ok: ok });
    }
    return { ok: true, rows: rows, bad: bad };
  }

  /* ---------- rendering ---------- */

  /** Read "T(1) = 1" — or several, separated by commas or newlines. */
  function rcParseBase(src) {
    var out = {}, any = false;
    var parts = String(src).split(/[\n,;]+/);
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i].trim();
      if (!t) continue;
      var m = /^T\s*\(\s*([0-9]+)\s*\)\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)$/i.exec(t);
      if (!m) return { ok: false, error: 'Could not read <code>' + esc(t) +
        '</code>. Base cases look like <code>T(1) = 1</code>.' };
      out[Number(m[1])] = parseFloat(m[2]);
      any = true;
    }
    if (!any) return { ok: false, error: 'Give at least one base case, like <code>T(1) = 1</code>.' };
    return { ok: true, base: out };
  }

  function rcPreset(base, rec, form, rel) {
    var set = function (id, v) { var e = document.getElementById(id); if (e) e.value = v; };
    set('rc-base', base); set('rc-rec', rec); set('rc-form', form);
    var r = document.getElementById('rc-rel');
    if (r) r.value = rel || '=';
    runRecur();
  }

  function rcNum(v) {
    if (!isFinite(v)) return '—';
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    return v.toFixed(4);
  }

  var RC_REL = { '=': '=', '>=': '≥', '<=': '≤' };

  function runRecur() {
    var out = document.getElementById('rc-output');
    if (!out) return;

    var bp = rcParseBase((document.getElementById('rc-base') || {}).value || '');
    if (!bp.ok) { out.innerHTML = '<div class="tool-error">' + bp.error + '</div>'; return; }

    var recSrc = ((document.getElementById('rc-rec') || {}).value || '').trim();
    var formSrc = ((document.getElementById('rc-form') || {}).value || '').trim();
    var rel = ((document.getElementById('rc-rel') || {}).value) || '=';
    var upto = parseInt(((document.getElementById('rc-upto') || {}).value), 10);
    if (!isFinite(upto) || upto < 2) upto = 12;
    if (upto > 40) upto = 40;

    var rec = rcBuild(bp.base, recSrc);
    if (!rec.ok) { out.innerHTML = '<div class="tool-error">In the recurrence: ' + rec.error + '</div>'; return; }

    var rows = rcTable(rec, upto);
    if (rows.length && !rows[rows.length - 1].ok) {
      out.innerHTML = '<div class="tool-error">' + (rec.failed() || 'Could not evaluate that recurrence.') + '</div>';
      return;
    }

    var h = '<div class="rc-shown">T(n) = ' + esc(recSrc) + ' &nbsp;·&nbsp; ' +
      Object.keys(bp.base).map(function (k) { return 'T(' + k + ') = ' + bp.base[k]; }).join(', ') +
      '</div>';

    /* the sequence */
    var agree = formSrc ? rcAgree(rec, formSrc, rel, upto) : null;
    if (agree && !agree.ok) {
      h += '<div class="tool-error">In the closed form: ' + agree.error + '</div>';
      out.innerHTML = h;
      return;
    }

    h += '<table class="results-table rc-table"><tr><th>n</th>';
    rows.forEach(function (r) { h += '<th>' + r.n + '</th>'; });
    h += '</tr><tr><td class="rc-lab">T(n)</td>';
    rows.forEach(function (r) { h += '<td>' + rcNum(r.value) + '</td>'; });
    h += '</tr>';
    if (agree) {
      h += '<tr><td class="rc-lab">' + esc(formSrc) + '</td>';
      agree.rows.forEach(function (r) {
        h += '<td class="' + (r.ok ? 'rc-hit' : 'rc-miss') + '">' + rcNum(r.g) + '</td>';
      });
      h += '</tr>';
    }
    h += '</table>';

    if (!formSrc) {
      h += '<p class="tool-note">Add a closed form to test it against this sequence, and to have ' +
        'the inductive step checked.</p>';
      out.innerHTML = h;
      return;
    }

    /* the inductive step — the part that is actually a proof obligation */
    var ind = rcInduction(bp.base, recSrc, formSrc, rel, 1, Math.max(upto, 30));
    if (!ind.ok) { h += '<div class="tool-error">' + ind.error + '</div>'; out.innerHTML = h; return; }

    h += '<div class="rc-proof">';
    h += '<div class="rc-proof-head">Base case</div>';
    ind.base.forEach(function (b) {
      h += '<div class="rc-line ' + (b.ok ? 'good' : 'bad') + '">' +
        'T(' + b.n + ') = <strong>' + rcNum(b.lhs) + '</strong> &nbsp;' + RC_REL[rel] + '&nbsp; ' +
        'the formula at n = ' + b.n + ' gives <strong>' + rcNum(b.rhs) + '</strong>' +
        (b.ok ? ' ✓' : ' ✗') + '</div>';
    });

    var firstBad = null;
    for (var i = 0; i < ind.steps.length; i++) if (!ind.steps[i].ok) { firstBad = ind.steps[i]; break; }

    h += '<div class="rc-proof-head">Inductive step</div>' +
      '<div class="rc-line">Assume the formula at k' +
      (rel === '=' ? '' : ' (and below)') +
      ', substitute into the recurrence at k+1, and compare with the formula at k+1.</div>';

    if (firstBad) {
      h += '<div class="rc-line bad">First failure at k = ' + firstBad.k +
        ': substituting gives <strong>' + rcNum(firstBad.lhs) + '</strong>, but the formula at n = ' +
        (firstBad.k + 1) + ' is <strong>' + rcNum(firstBad.rhs) + '</strong> ✗</div>';
    } else {
      var sample = ind.steps[Math.min(3, ind.steps.length - 1)];
      h += '<div class="rc-line good">Holds for every k from 1 to ' + ind.steps[ind.steps.length - 1].k +
        '. At k = ' + sample.k + ', for instance, substituting gives <strong>' + rcNum(sample.lhs) +
        '</strong> and the formula at n = ' + (sample.k + 1) + ' gives <strong>' + rcNum(sample.rhs) +
        '</strong> ✓</div>';
    }
    h += '</div>';

    var allGood = ind.allOk;
    h += '<div class="verdict ' + (allGood ? 'safe' : 'bad') + '">' +
      (allGood
        ? 'Base case and inductive step both hold — T(n) ' + RC_REL[rel] + ' ' + esc(formSrc)
        : 'The proof does not go through as written') + '</div>';

    h += '<p class="tool-note"><strong>What was and was not checked.</strong> The step was verified ' +
      'for ' + ind.checked + ' values of k by substituting the claimed formula into the recurrence — ' +
      'which is the substitution you would do on paper. It is <em>not</em> a symbolic proof for all k; ' +
      'no finite check can be. What it does rule out is the commonest failure, where a formula matches ' +
      'the first few values but does not survive substitution.</p>';

    if (agree && agree.bad > 0) {
      h += '<p class="tool-note">The values themselves disagree in <strong>' + agree.bad +
        '</strong> of the ' + agree.rows.length + ' places shown above.</p>';
    }

    out.innerHTML = h;
  }
