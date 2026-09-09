  /* ============================================================
     ASYMPTOTIC GROWTH — O, Ω AND Θ (Topic 02)

     The definition from lectures:

         f ∈ O(g)   ⟺   ∃c ∃N ∀n > N :  f(n) ≤ c · g(n)
         f ∈ Ω(g)   ⟺   ∃c ∃N ∀n > N :  f(n) ≥ c · g(n)
         Θ(g)       =    O(g) ∩ Ω(g)

     Two things follow, and both are what the notation is *for*:
     constant factors do not matter, and neither do lower-order terms.
     3n² + 500n + 9000 and n² are the same Θ class, and the only way
     to believe that is to watch the ratio between them settle down.

     So this file does two separate jobs and keeps them apart:

       — the CLASS of an expression, decided symbolically. The class
         of a sum is the class of its largest term, which is a fact
         about the ordering of the standard functions, not something
         to be guessed from a handful of sampled values.

       — the WITNESS constants c and N, found numerically. These are
         evidence over a tested range, and the tool says so. A ratio
         that looks flat is not a proof, and no output here pretends
         otherwise.

     Sampling alone would be a bad way to decide the question — over
     any finite range, n^1.0001 and n look identical — which is
     precisely why the verdict comes from the symbolic side.
     ============================================================ */

  /**
   * A growth class, as an orderable record.
   *
   *   kind  0 polynomial, 1 exponential, 2 factorial
   *   p     the power of n (0 for a constant, 0.5 for √n)
   *   logs  how many log factors ride along on top
   */
  function gwClass(kind, p, logs) { return { kind: kind, p: p, logs: logs || 0 }; }

  /** Order two classes: -1 slower, 0 same, 1 faster. */
  function gwCmp(a, b) {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.p !== b.p) return a.p < b.p ? -1 : 1;
    if (a.logs !== b.logs) return a.logs < b.logs ? -1 : 1;
    return 0;
  }

  function gwClassShow(c) {
    if (c.kind === 2) return 'n!';
    if (c.kind === 1) return '2ⁿ';
    var base;
    if (c.p === 0) base = '1';
    else if (c.p === 0.5) base = '√n';
    else if (c.p === 1) base = 'n';
    else base = 'n' + gwSup(c.p);
    var out = (c.p === 0 && c.logs) ? '' : base;
    // Two or more logs print as log² n, not "log n log n" — which only
    // started arising once the Master Theorem's gap case began reporting
    // the extended n^k log^(p+1) n form.
    if (c.logs === 1) out += (out ? ' ' : '') + 'log n';
    else if (c.logs > 1) out += (out ? ' ' : '') + 'log' + gwSup(c.logs) + ' n';
    return out || '1';
  }

  var GW_SUPS = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
                  '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '.': '·' };
  function gwSup(p) {
    return String(p).split('').map(function (d) { return GW_SUPS[d] || d; }).join('');
  }

  /**
   * Parse an expression in n: a sum of terms.
   *
   *   3n^2 + 500n + 9000
   *   n log n
   *   2^n + n^3
   *   n!
   *
   * Recognised factors are 1, log n, sqrt n (or √n), n, n^k, 2^n and
   * n!, each with an optional numeric coefficient. Multiplication is
   * written by juxtaposition, as in "n log n".
   *
   * @returns {{ok: true, terms, cls, f} | {ok: false, error: string}}
   */
  function gwParse(src) {
    var s = String(src).replace(/\s*\^\s*/g, '^').replace(/\s+/g, ' ').trim();
    if (!s) return { ok: false, error: 'Nothing to read yet.' };

    var chunks = s.split('+');
    var terms = [];

    for (var i = 0; i < chunks.length; i++) {
      var t = chunks[i].trim();
      if (!t) return { ok: false, error: 'An empty term around a <code>+</code>.' };

      var coeff = 1;
      var m = /^([0-9]+(?:\.[0-9]+)?)\s*/.exec(t);
      if (m && !/^[0-9.]+\^/.test(t)) { coeff = parseFloat(m[1]); t = t.slice(m[0].length).trim(); }

      if (t === '') { terms.push({ coeff: coeff, cls: gwClass(0, 0, 0), show: String(coeff) }); continue; }

      var kind = 0, p = 0, logs = 0, bad = null;
      var parts = t.split(' ').filter(Boolean);

      // `log` and `sqrt` take the n after them as their argument, so they
      // consume it. Without that, "log n" reads as log × n and "sqrt n"
      // as √n × n — both a whole class out.
      for (var j = 0; j < parts.length; j++) {
        var f = parts[j];
        if (f === 'n!') { kind = 2; }
        else if (f === '2^n' || f === '2ⁿ') { kind = 1; }
        else if (f === 'log' || f === 'logn' || f === 'log(n)' || f === 'lg' || f === 'lgn') {
          logs++;
          if (parts[j + 1] === 'n') j++;
        }
        else if (f === 'sqrt' || f === 'sqrtn' || f === '√n' || f === '√' || f === 'sqrt(n)') {
          p += 0.5;
          if (parts[j + 1] === 'n') j++;
        }
        else if (f === 'n') { p += 1; }
        else if (/^n\^[0-9]+(\.[0-9]+)?$/.test(f)) { p += parseFloat(f.slice(2)); }
        else if (f === '1') { /* a bare 1 contributes nothing */ }
        else { bad = f; break; }
      }

      if (bad) {
        return { ok: false, error: 'Do not recognise <code>' + esc(bad) + '</code>. ' +
          'Try things like <code>1</code>, <code>log n</code>, <code>sqrt n</code>, ' +
          '<code>n</code>, <code>n log n</code>, <code>n^2</code>, <code>2^n</code>, <code>n!</code>.' };
      }
      terms.push({ coeff: coeff, cls: gwClass(kind, p, logs), show: chunks[i].trim() });
    }

    // The class of a sum is the class of its fastest-growing term.
    var top = terms[0].cls;
    for (var k = 1; k < terms.length; k++) if (gwCmp(terms[k].cls, top) > 0) top = terms[k].cls;

    return {
      ok: true,
      terms: terms,
      cls: top,
      f: function (n) {
        var sum = 0;
        for (var q = 0; q < terms.length; q++) sum += terms[q].coeff * gwEvalClass(terms[q].cls, n);
        return sum;
      },
    };
  }

  /** Evaluate one class at n. */
  function gwEvalClass(c, n) {
    if (c.kind === 2) return gwFactorial(n);
    if (c.kind === 1) return Math.pow(2, n);
    var v = Math.pow(n, c.p);
    for (var i = 0; i < c.logs; i++) v *= Math.max(1, Math.log2(Math.max(2, n)));
    return v;
  }

  function gwFactorial(n) {
    var v = 1;
    for (var i = 2; i <= n; i++) { v *= i; if (!isFinite(v)) return Infinity; }
    return v;
  }

  /**
   * Compare two expressions.
   *
   * The verdict is symbolic. The constants are numeric, and are found
   * by taking the worst ratio over the sampled range — so `c` is the
   * smallest constant that works *for the values tried*, which is
   * evidence for the definition rather than a proof of it.
   *
   * @returns {{verdict, big, cls, samples, cO, cOmega}}
   */
  function gwCompare(fx, gx, upto) {
    var top = upto || 1024;
    var order = gwCmp(fx.cls, gx.cls);

    var samples = [], n = 1, worstHigh = 0, worstLow = Infinity;
    while (n <= top) {
      var fv = fx.f(n), gv = gx.f(n);
      var ratio = gv === 0 ? Infinity : fv / gv;
      samples.push({ n: n, f: fv, g: gv, ratio: ratio });
      if (isFinite(ratio)) {
        if (ratio > worstHigh) worstHigh = ratio;
        if (ratio < worstLow) worstLow = ratio;
      }
      n = n < 4 ? n + 1 : n * 2;
    }

    var verdict;
    if (order < 0) verdict = 'O';                    // f grows strictly slower
    else if (order > 0) verdict = 'Omega';           // f grows strictly faster
    else verdict = 'Theta';

    return {
      verdict: verdict,
      order: order,
      clsF: fx.cls,
      clsG: gx.cls,
      samples: samples,
      cO: worstHigh,                                 // f(n) ≤ cO · g(n) over the range
      cOmega: worstLow,                              // f(n) ≥ cOmega · g(n) over the range
    };
  }

  /**
   * The ladder from the lecture slides, slowest first.
   *
   * Sorted by gwCmp rather than written down in order, so the ordering
   * shown to a reader is the one the comparison actually uses. If the
   * two ever disagreed, the list on screen would come out shuffled.
   */
  function gwLadder() {
    var names = ['1', 'log n', 'sqrt n', 'n', 'n log n', 'n^2', 'n^3', '2^n', 'n!'];
    var out = [];
    for (var i = 0; i < names.length; i++) {
      var p = gwParse(names[i]);
      if (p.ok) out.push({ src: names[i], cls: p.cls, show: gwClassShow(p.cls), f: p.f });
    }
    return out.sort(function (a, b) { return gwCmp(a.cls, b.cls); });
  }

  /* ---------- rendering ---------- */

  function gwPreset(f, g) {
    var bf = document.getElementById('gw-f'), bg = document.getElementById('gw-g');
    if (bf) bf.value = f;
    if (bg) bg.value = g;
    runGrowth();
  }

  function gwNum(x) {
    if (!isFinite(x)) return '∞';
    if (x >= 1e12) return x.toExponential(2);
    if (x >= 1000) return Math.round(x).toLocaleString('en-GB');
    if (x >= 10) return x.toFixed(1);
    return x.toFixed(3);
  }

  function runGrowth() {
    var out = document.getElementById('gw-output');
    if (!out) return;

    var fs = ((document.getElementById('gw-f') || {}).value || '').trim();
    var gs = ((document.getElementById('gw-g') || {}).value || '').trim();

    var fx = gwParse(fs), gx = gwParse(gs);
    if (!fx.ok) { out.innerHTML = '<div class="tool-error">In f(n): ' + fx.error + '</div>'; return; }
    if (!gx.ok) { out.innerHTML = '<div class="tool-error">In g(n): ' + gx.error + '</div>'; return; }

    var r = gwCompare(fx, gx, 1024);

    var verdictText, verdictClass;
    if (r.verdict === 'Theta') {
      verdictText = 'f ∈ Θ(g)  —  and so also f ∈ O(g) and f ∈ Ω(g)';
      verdictClass = 'safe';
    } else if (r.verdict === 'O') {
      verdictText = 'f ∈ O(g)  —  f grows strictly slower, so f ∉ Ω(g) and f ∉ Θ(g)';
      verdictClass = 'warn';
    } else {
      verdictText = 'f ∈ Ω(g)  —  f grows strictly faster, so f ∉ O(g) and f ∉ Θ(g)';
      verdictClass = 'warn';
    }

    var h = '<div class="gw-classes">' +
      '<div class="gw-cls"><span>f(n) = ' + esc(fs) + '</span><strong>Θ(' + gwClassShow(r.clsF) + ')</strong></div>' +
      '<div class="gw-cls"><span>g(n) = ' + esc(gs) + '</span><strong>Θ(' + gwClassShow(r.clsG) + ')</strong></div>' +
      '</div>';

    h += '<div class="verdict ' + verdictClass + '">' + verdictText + '</div>';

    /* the ratio, which is where the intuition lives */
    h += '<table class="results-table gw-table"><tr><th>n</th><th>f(n)</th><th>g(n)</th>' +
         '<th>f(n) / g(n)</th></tr>';
    for (var i = 0; i < r.samples.length; i++) {
      var s = r.samples[i];
      h += '<tr><td>' + s.n + '</td><td>' + gwNum(s.f) + '</td><td>' + gwNum(s.g) +
           '</td><td class="gw-ratio">' + gwNum(s.ratio) + '</td></tr>';
    }
    h += '</table>';

    if (r.verdict === 'Theta') {
      h += '<p class="tool-note">The ratio settles. Over n ≤ 1024 the definition is met with ' +
        '<strong>c = ' + gwNum(r.cO) + '</strong> for the O side and <strong>c = ' + gwNum(r.cOmega) +
        '</strong> for the Ω side, both from N = 1. Whatever constants and lower-order terms you ' +
        'wrote, they are absorbed — that is exactly what Θ is for.</p>';
    } else if (r.verdict === 'O') {
      h += '<p class="tool-note">The ratio falls towards zero, so no constant c can hold f above g. ' +
        'The O direction is met easily: <strong>f(n) ≤ ' + gwNum(r.cO) + ' · g(n)</strong> throughout ' +
        'the range above.</p>';
    } else {
      h += '<p class="tool-note">The ratio grows without bound, so no constant c can hold f below g. ' +
        'The Ω direction is met: <strong>f(n) ≥ ' + gwNum(r.cOmega) + ' · g(n)</strong> throughout ' +
        'the range above.</p>';
    }

    /* the ladder, with both ends marked */
    var ladder = gwLadder();
    h += '<div class="gw-ladder"><div class="gw-ladder-head">The standard ladder, slowest first</div><div class="gw-rungs">';
    for (var k = 0; k < ladder.length; k++) {
      var isF = gwCmp(ladder[k].cls, r.clsF) === 0;
      var isG = gwCmp(ladder[k].cls, r.clsG) === 0;
      h += '<span class="gw-rung' + (isF ? ' is-f' : '') + (isG ? ' is-g' : '') + '">' +
           ladder[k].show + (isF && isG ? ' (f, g)' : isF ? ' (f)' : isG ? ' (g)' : '') + '</span>';
      if (k < ladder.length - 1) h += '<span class="gw-lt">&lt;</span>';
    }
    h += '</div></div>';

    h += '<p class="tool-note">The verdict above comes from comparing the classes symbolically, ' +
      'not from the numbers in the table. Sampling could not tell n from n<sup>1.0001</sup> over any ' +
      'finite range, so the constants are offered as evidence and the ordering does the deciding.</p>';

    out.innerHTML = h;
  }
