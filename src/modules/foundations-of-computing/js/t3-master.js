  /* ============================================================
     THE MASTER THEOREM (Topic 03)

     For a recurrence of the divide-and-conquer shape

         T(n) = a T(n/b) + f(n)        a ≥ 1,  b ≥ 2

     set k = log_b a. That number is the growth of the *recursion*
     alone — a branches at each of log_b n levels. The theorem then
     compares f, the cost of dividing and recombining, against n^k:

         Case 1   f grows strictly slower   →  T = Θ(n^k)
         Case 2   f grows at the same rate  →  T = Θ(n^k log n)
         Case 3   f grows strictly faster   →  T = Θ(f(n))

     Whichever of the two dominates wins; when they tie, an extra
     log n appears because every one of the log_b n levels costs the
     same.

     Two things this file is careful about.

     First, k = log_b a, not log_a b. Getting the base the wrong way
     round is the commonest slip in the topic and it is invisible in
     the answer when the case does not change — so mtSolve reports
     both values and names which is which.

     Second, the theorem's verdict is checked against the recurrence
     itself. The recurrence is unfolded numerically and its growth
     exponent estimated from the values; if that disagrees with the
     case the theorem picked, something is wrong and the tool says
     so rather than presenting the theorem's answer as fact.
     ============================================================ */

  /**
   * Reduce f(n) to its growth class, explaining the simplification.
   *
   * Slides write things like √((n+1)⁵) and log₂(5n²), which are not
   * in the small grammar the growth engine reads — but both simplify
   * on sight, and the simplification is itself examinable:
   *
   *     √((n+1)⁵) = (n+1)^2.5 ∈ Θ(n^2.5)   the +1 cannot matter
   *     log₂(5n²) = log₂5 + 2log₂n ∈ Θ(log n)   constants drop
   *
   * @returns {{src, cls, notes: string[]} | {error}}
   */
  function mtNormalise(src) {
    var s = String(src).trim(), notes = [];

    // √(expr) and expr^(p/2) forms
    s = s.replace(/√\s*\(([^()]*)\)\s*\^?/g, function (_, inner) { return 'sqrt(' + inner + ')'; });

    // sqrt((n+c)^p)  ->  n^(p/2)
    var m = /^sqrt\(\s*\(?\s*n\s*([+-]\s*[0-9]+)?\s*\)?\s*\^\s*([0-9.]+)\s*\)$/.exec(s.replace(/\s+/g, ''));
    if (m) {
      var p = parseFloat(m[2]) / 2;
      notes.push('√((n' + (m[1] || '') + ')<sup>' + m[2] + '</sup>) = (n' + (m[1] || '') +
                 ')<sup>' + p + '</sup>, and adding a constant to n cannot change the growth rate');
      return { src: 'n^' + p, notes: notes };
    }

    // log(anything containing n^p)  ->  p log n, i.e. Θ(log n)
    var lg = /^(log2|log|lg)\(\s*([0-9]*)\s*n\s*(\^\s*([0-9.]+))?\s*\)$/.exec(s.replace(/\s+/g, ''));
    if (lg) {
      var coeff = lg[2] && lg[2] !== '1' ? lg[2] : null;
      var pow = lg[4] ? parseFloat(lg[4]) : 1;
      var bits = [];
      if (coeff) bits.push('log ' + coeff);
      bits.push((pow !== 1 ? pow + ' ' : '') + 'log n');
      notes.push('log(' + (coeff || '') + 'n' + (pow !== 1 ? '^' + pow : '') + ') = ' +
                 bits.join(' + ') + ', and both the constant and the multiple drop out');
      return { src: 'log n', notes: notes };
    }

    // (n+c)^p -> n^p
    var pc = /^\(\s*n\s*([+-]\s*[0-9]+)\s*\)\s*\^\s*([0-9.]+)$/.exec(s.replace(/\s+/g, ''));
    if (pc) {
      notes.push('(n' + pc[1] + ')<sup>' + pc[2] + '</sup> ∈ Θ(n<sup>' + pc[2] +
                 '</sup>) — the constant shift cannot change the growth rate');
      return { src: 'n^' + pc[2], notes: notes };
    }

    return { src: s, notes: notes };
  }

  /**
   * Apply the theorem.
   *
   * @param {number} a  subproblems, a ≥ 1
   * @param {number} b  shrink factor, b ≥ 2
   * @param {string} fSrc  the combine cost
   * @returns {{ok, k, kWrong, clsF, clsCrit, caseNo, answer, notes} | {ok:false,error}}
   */
  function mtSolve(a, b, fSrc) {
    if (!(a >= 1)) return { ok: false, error: 'The theorem needs <strong>a ≥ 1</strong>.' };
    if (!(b >= 2)) return { ok: false, error: 'The theorem needs <strong>b ≥ 2</strong>, ' +
      'otherwise the subproblems do not get smaller and the recursion never ends.' };

    var norm = mtNormalise(fSrc);
    var f = gwParse(norm.src);
    if (!f.ok) return { ok: false, error: 'In f(n): ' + f.error };

    var k = Math.log(a) / Math.log(b);
    var kWrong = Math.log(b) / Math.log(a);          // the classic slip, for contrast

    // n^k as a growth class, rounded where it is exactly an integer
    var kShown = Math.abs(k - Math.round(k)) < 1e-12 ? Math.round(k) : k;
    var crit = gwParse('n^' + (Math.abs(k - Math.round(k)) < 1e-12
      ? Math.round(k) : k.toFixed(4)));
    if (!crit.ok) return { ok: false, error: 'Could not form n^k.' };

    /*
       Cases 1 and 3 need f to be POLYNOMIALLY separated from n^k --
       O(n^(k-e)) and Omega(n^(k+e)) for some e > 0 -- not merely
       slower or faster. Ordering the two classes and reading off
       -1 / 0 / +1 misses that, because n^k log n is ordered above
       n^k while being only a log factor above it, and there is no
       e > 0 with log n in Omega(n^e).

       That gap is not a technicality. T(n) = 9T(n/3) + n^2 log n
       was reported here as Case 3 with answer Theta(n^2 log n);
       unfolding the recurrence numerically shows T/(n^2 log n)
       still climbing at n = 3^14 while T/(n^2 log^2 n) settles,
       so the true answer is Theta(n^2 log^2 n) and NO case of the
       theorem as stated applies. caseNo 0 says so.
    */
    var cmp = gwCmp(f.cls, crit.cls);
    var samePower = f.cls.kind === crit.cls.kind && f.cls.p === crit.cls.p;
    var caseNo;
    if (cmp === 0) caseNo = 2;
    else if (samePower) caseNo = 0;               // faster or slower, but only by logs
    else caseNo = cmp < 0 ? 1 : 3;

    var answer;
    if (caseNo === 0) {
      // The extended form, checked numerically on five instances:
      // f = n^k log^p n gives T = n^k log^(p+1) n. Offered as an aside,
      // because the examinable answer is "the theorem does not apply".
      answer = f.cls.logs > crit.cls.logs
        ? 'no case applies — but Θ(' +
          gwClassShow(gwClass(crit.cls.kind, crit.cls.p, f.cls.logs + 1)) + ') by the extended form'
        : 'no case applies';
    }
    else if (caseNo === 1) answer = 'Θ(' + gwClassShow(crit.cls) + ')';
    else if (caseNo === 2) {
      // Build the class with one extra log rather than gluing " log n" on the
      // end: for k = 0 (binary search) the n^0 has to disappear, and
      // gwClassShow already knows how to do that. Concatenating gives the
      // nonsense "Theta(1 log n)".
      answer = 'Θ(' + gwClassShow(gwClass(crit.cls.kind, crit.cls.p, crit.cls.logs + 1)) + ')';
    }
    else answer = 'Θ(' + gwClassShow(f.cls) + ')';

    return {
      ok: true,
      a: a, b: b,
      k: k, kShown: kShown, kWrong: kWrong,
      exact: Math.abs(k - Math.round(k)) < 1e-12,
      fSrc: norm.src, notes: norm.notes,
      clsF: f.cls, clsCrit: crit.cls,
      caseNo: caseNo, answer: answer,
      fFn: f.f,
    };
  }

  /**
   * Unfold the recurrence numerically and estimate its growth.
   *
   * The exponent is read off consecutive recursion levels:
   *
   *     T(bn) / T(n)  ≈  b^p   for T ∈ Θ(n^p)
   *
   * so p ≈ log_b(T(bn)/T(n)). Stepping by b rather than by 2 matters:
   * see the comment in the loop. For a Θ(n^k log n) answer the estimate
   * drifts slightly above k, which is the log showing up — worth
   * seeing rather than hiding.
   *
   * This is a sanity check on the theorem's verdict, not a proof, and
   * it is reported as such.
   *
   * @returns {{rows, estimate}}
   */
  function mtNumeric(a, b, fFn, upto) {
    var memo = { 1: 1 };
    function T(n) {
      n = Math.max(1, Math.round(n));
      if (memo[n] !== undefined) return memo[n];
      var v = a * T(Math.floor(n / b)) + fFn(n);
      memo[n] = v;
      return v;
    }

    /*
       Sample at powers of b, not powers of 2.

       T is only defined by the recurrence at multiples of b, and the
       floor(n/b) makes it a staircase between them. Reading the ratio
       across a DOUBLING therefore measures where each sample happens to
       land relative to the steps rather than the growth itself, and for
       b = 3 it is badly wrong: T(n) = 9T(n/3) + 1 is a textbook Case 1
       with answer Theta(n^2), and doubling-based sampling reported an
       exponent of 1.585 -- so the tool printed "these disagree, do not
       trust the answer above" underneath a correct answer. Stepping by b
       lines the samples up with the recursion levels exactly, and the
       exponent is then log_b of the ratio.
    */
    var rows = [], n = b;
    var top = upto || 4096;
    var levels = Math.max(6, Math.ceil(Math.log(top) / Math.log(2) / Math.log2(b)) + 4);
    for (var lv = 1; lv <= levels; lv++) {
      var t = T(n), prev = T(n / b);
      if (!isFinite(t) || t > 1e300) break;
      rows.push({ n: n, T: t, ratio: prev > 0 ? t / prev : NaN,
                  exp: prev > 0 ? Math.log(t / prev) / Math.log(b) : NaN });
      n *= b;
    }
    var tail = rows.slice(-4).filter(function (r) { return isFinite(r.exp); });
    var estimate = tail.length
      ? tail.reduce(function (s, r) { return s + r.exp; }, 0) / tail.length
      : NaN;
    return { rows: rows, estimate: estimate };
  }

  /**
   * Does the numeric growth agree with the case the theorem picked?
   *
   * Case 1 and 2 both predict exponent k; case 3 predicts the
   * exponent of f. Case 2 carries a log, so its measured exponent
   * sits a little above k — the tolerance allows for that and the
   * caller is told which case it is.
   */
  function mtAgrees(sol, est) {
    if (!isFinite(est)) return { ok: false, why: 'no numeric estimate' };
    var want = sol.caseNo === 3 ? sol.clsF.p : sol.k;
    // Case 2 answers carry an extra log, so the measured exponent sits a
    // little above k; the gap case carries two, so it drifts further still.
    var slack = sol.caseNo === 2 ? 0.35 : sol.caseNo === 0 ? 0.6 : 0.2;
    return { ok: Math.abs(est - want) <= slack, want: want, got: est, slack: slack };
  }

  /* ---------- rendering ---------- */

  function mtPreset(a, b, f) {
    var set = function (id, v) { var e = document.getElementById(id); if (e) e.value = v; };
    set('mt-a', a); set('mt-b', b); set('mt-f', f);
    runMaster();
  }

  function mtNum(v) {
    if (!isFinite(v)) return '∞';
    if (v >= 1e12) return v.toExponential(2);
    if (Math.abs(v - Math.round(v)) < 1e-9) return Math.round(v).toLocaleString('en-GB');
    return v.toFixed(3);
  }

  function runMaster() {
    var out = document.getElementById('mt-output');
    if (!out) return;

    var a = parseFloat((document.getElementById('mt-a') || {}).value);
    var b = parseFloat((document.getElementById('mt-b') || {}).value);
    var f = ((document.getElementById('mt-f') || {}).value || '').trim();

    var sol = mtSolve(a, b, f);
    if (!sol.ok) { out.innerHTML = '<div class="tool-error">' + sol.error + '</div>'; return; }

    var kTxt = sol.exact ? String(sol.kShown) : sol.k.toFixed(4);

    var h = '<div class="mt-steps">';

    /* Step 1 — the parameters, and the log that gets flipped */
    h += '<div class="mt-step"><div class="mt-step-n">1</div><div class="mt-step-body">' +
      '<strong>Identify the parameters.</strong><br>' +
      'a = ' + a + ', b = ' + b + ', so <strong>k = log<sub>' + b + '</sub>(' + a + ') = ' + kTxt + '</strong>' +
      // Only worth warning when the flip would actually give a different
      // number. With a = b the two agree, and with a = 1 the flipped version
      // is not even defined -- printing either as a scare would be noise.
      (a !== b && isFinite(sol.kWrong)
        ? '<div class="mt-warn">Not log<sub>' + a + '</sub>(' + b + ') = ' + sol.kWrong.toFixed(4) +
          '. The base is the number you <em>divide</em> by; the argument is the number of subproblems. ' +
          'Flipping them is the commonest slip in this topic, and it is invisible whenever the case ' +
          'happens not to change.</div>'
        : '') +
      '</div></div>';

    /* Step 2 — the class of f */
    h += '<div class="mt-step"><div class="mt-step-n">2</div><div class="mt-step-body">' +
      '<strong>Identify the growth rate of f(n).</strong><br>' +
      'f(n) = ' + esc(f) + ' ∈ <strong>Θ(' + gwClassShow(sol.clsF) + ')</strong>';
    if (sol.notes.length) {
      h += '<div class="tool-note">' + sol.notes.join('<br>') + '</div>';
    }
    h += '</div></div>';

    /* Step 3 — the comparison */
    var cmpTxt = sol.caseNo === 1
      ? 'f grows <strong>strictly slower</strong> than n<sup>k</sup>, so the recursion dominates'
      : sol.caseNo === 2
        ? 'f grows at <strong>the same rate</strong> as n<sup>k</sup>, so every one of the log<sub>' +
          b + '</sub> n levels costs the same — which is where the extra log n comes from'
        : sol.caseNo === 0
          ? 'f is ' + (sol.clsF.logs > sol.clsCrit.logs ? 'faster' : 'slower') + ' than ' +
            'n<sup>k</sup>, but only by a <strong>logarithmic</strong> factor — and Cases 1 and 3 ' +
            'need a <strong>polynomial</strong> one. This is the gap in the theorem'
          : 'f grows <strong>strictly faster</strong> than n<sup>k</sup>, so the top-level combine dominates';

    h += '<div class="mt-step"><div class="mt-step-n">3</div><div class="mt-step-body">' +
      '<strong>Identify the case.</strong><br>' +
      'Compare Θ(' + gwClassShow(sol.clsF) + ') against Θ(' + gwClassShow(sol.clsCrit) + '): ' +
      cmpTxt + '.' +
      '</div></div>';
    h += '</div>';

    /* the three cases, with the live one marked */
    h += '<div class="mt-cases">';
    [[1, 'f ∈ O(n^(k−ε))', 'Θ(n^k)'],
     [2, 'f ∈ Θ(n^k)', 'Θ(n^k log n)'],
     [3, 'f ∈ Ω(n^(k+ε))', 'Θ(f(n))']].forEach(function (c) {
      h += '<div class="mt-case' + (c[0] === sol.caseNo ? ' on' : '') + '">' +
        '<div class="mt-case-n">Case ' + c[0] + '</div>' +
        '<div class="mt-case-if">' + c[1] + '</div>' +
        '<div class="mt-case-then">' + c[2] + '</div></div>';
    });
    h += '</div>';

    if (sol.caseNo === 0) {
      h += '<div class="mt-case on" style="margin-top:8px;">' +
        '<div class="mt-case-n">No case</div>' +
        '<div class="mt-case-if">f is within a log factor of n<sup>k</sup></div>' +
        '<div class="mt-case-then">the theorem is silent</div></div>';
    }

    h += '<div class="verdict ' + (sol.caseNo === 0 ? 'warn' : 'safe') + '">T(n) = <strong>' +
      sol.answer + '</strong></div>';

    if (sol.caseNo === 0) {
      h += '<div class="callout warn" style="margin:10px 0;">' +
        '<div class="callout-label">The Master Theorem does not apply here</div>' +
        'Case 1 needs f ∈ O(n<sup>k−ε</sup>) and Case 3 needs f ∈ Ω(n<sup>k+ε</sup>), for some ' +
        '<strong>ε &gt; 0</strong>. Here f and n<sup>k</sup> have the same exponent and differ only ' +
        'by a factor of log n — and there is no ε &gt; 0 for which log n ∈ Ω(n<sup>ε</sup>), so ' +
        'neither condition can be met. The classic instance is T(n) = 2T(n/2) + n log n.<br><br>' +
        'The recurrence still has an answer; it just is not one the theorem gives you. Unfolding it ' +
        'shows that an f of the form n<sup>k</sup> log<sup>p</sup> n produces ' +
        'n<sup>k</sup> log<sup>p+1</sup> n — one more log, from the log<sub>b</sub> n levels each ' +
        'contributing the same amount. In an exam, say that no case applies and why; the extended ' +
        'form is worth a sentence but is not what was asked.</div>';
    }

    /* the numeric cross-check */
    var num = mtNumeric(a, b, sol.fFn, 4096);
    var agr = mtAgrees(sol, num.estimate);

    h += '<table class="results-table mt-table"><tr><th>n</th><th>T(n)</th>' +
         '<th>T(n) / T(n/' + b + ')</th><th>log<sub>' + b + '</sub> of that</th></tr>';
    num.rows.forEach(function (r) {
      h += '<tr><td>' + r.n + '</td><td>' + mtNum(r.T) + '</td><td>' + mtNum(r.ratio) +
           '</td><td class="mt-exp">' + (isFinite(r.exp) ? r.exp.toFixed(3) : '—') + '</td></tr>';
    });
    h += '</table>';

    h += '<p class="tool-note">' + (agr.ok ? '✓' : '✗') + ' <strong>Cross-check.</strong> ' +
      'The recurrence was unfolded numerically with this a, b and f, and its growth exponent ' +
      'read off consecutive levels — one factor of ' + b + ' apart, so the samples line up with ' +
      'the recursion rather than straddling it: <strong>' + (isFinite(num.estimate) ? num.estimate.toFixed(3) : '—') +
      '</strong>, against the <strong>' + agr.want.toFixed(3) + '</strong> the theorem predicts.' +
      (sol.caseNo === 2
        ? ' Case 2 answers carry a log n, so the measured exponent sits a little <em>above</em> k — ' +
          'that drift is the log, not an error.'
        : '') +
      (agr.ok ? '' : ' <strong>These disagree, which they should not. Do not trust the answer above.</strong>') +
      '</p>';

    h += '<p class="tool-note">The theorem needs T to be monotonically increasing, and Case 3 ' +
      'additionally needs a regularity condition — a·f(n/b) ≤ c·f(n) for some c &lt; 1 — which holds ' +
      'for every f you are likely to meet but is what the dagger on the lecture slide refers to.</p>';

    out.innerHTML = h;
  }
