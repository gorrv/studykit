  /* ============================================================
     TOPIC 09 · rendering for the five randomness tools
     ============================================================ */

  function pbRead(id, fallback) {
    var el = document.getElementById(id);
    return pbParse((el ? el.value : fallback) || fallback);
  }
  function pbBad(outId, r) {
    var out = document.getElementById(outId);
    if (out) out.innerHTML = '<div class="verdict bad">' + r.error + '</div>';
  }

  /** The probability mass function, drawn. */
  function pbChart(d, opts) {
    opts = opts || {};
    var W = 420, H = 190, pad = 30;
    var maxP = d.pts.reduce(function (m, x) { return Math.max(m, frNum(x.p)); }, 0) || 1;
    var n = d.pts.length;
    var bw = Math.max(6, Math.min(46, (W - 2 * pad) / Math.max(1, n) - 8));

    var s = '<svg class="pb-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="probability mass function">';
    s += '<line class="pb-axis" x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - 10) +
         '" y2="' + (H - pad) + '"/>';

    d.pts.forEach(function (x, i) {
      var cx = pad + 10 + (i + 0.5) * ((W - 2 * pad) / Math.max(1, n));
      var h = (frNum(x.p) / maxP) * (H - 2 * pad);
      var hl = opts.highlight && opts.highlight(x);
      s += '<rect class="pb-bar' + (hl ? ' hot' : '') + '" x="' + (cx - bw / 2) + '" y="' +
           (H - pad - h) + '" width="' + bw + '" height="' + Math.max(1, h) + '"/>';
      s += '<text class="pb-lab" x="' + cx + '" y="' + (H - pad + 13) + '">' + frShow(x.v) + '</text>';
      s += '<text class="pb-val" x="' + cx + '" y="' + (H - pad - h - 4) + '">' + frShow(x.p) + '</text>';
    });

    if (opts.mean !== undefined && n > 1) {
      // the mean sits between the bars, so place it proportionally
      var lo = frNum(d.pts[0].v), hi = frNum(d.pts[n - 1].v);
      if (hi > lo) {
        var t = (frNum(opts.mean) - lo) / (hi - lo);
        var mx = pad + 10 + (0.5 + t * (n - 1)) * ((W - 2 * pad) / Math.max(1, n));
        s += '<line class="pb-mean" x1="' + mx + '" y1="' + pad + '" x2="' + mx + '" y2="' + (H - pad) + '"/>';
        s += '<text class="pb-meanlab" x="' + (mx + 4) + '" y="' + (pad + 10) + '">E[X] = ' +
             frShow(opts.mean) + '</text>';
      }
    }
    return s + '</svg>';
  }

  /* ---------- Tool 1 · expectation and variance ---------- */

  function pbPreset(which) {
    var el = document.getElementById('pb-text');
    if (el) el.value = PB_PRESETS[which] || PB_PRESETS.lecture;
    runDist();
  }

  function runDist() {
    var out = document.getElementById('pb-output');
    if (!out) return;
    var d = pbRead('pb-text', PB_PRESETS.lecture);
    if (!d.ok) return pbBad('pb-output', d);

    var mu = pbMean(d), v = pbVar(d), m2 = pbMoment(d, 2);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + d.n + ' outcomes</span>' +
      '<span class="stat-pill ' + (d.sums ? 'b' : 'warn') + '">Σ p = ' + frShow(d.total) + '</span>' +
      '<span class="stat-pill ' + (v.agree ? 'b' : 'warn') + '">' +
        (v.agree ? 'both variance formulas agree' : 'the variance formulas DISAGREE') + '</span></div>';

    if (!d.sums) h += '<div class="verdict warn">' + d.note + '</div>';

    h += pbChart(d, { mean: mu });

    h += '<table class="pb-table"><tr><th>k</th>' +
      d.pts.map(function (x) { return '<th>' + frShow(x.v) + '</th>'; }).join('') + '</tr>' +
      '<tr><th>p<sub>X</sub>(k)</th>' +
      d.pts.map(function (x) { return '<td>' + frShow(x.p) + '</td>'; }).join('') + '</tr>' +
      '<tr><th>k · p<sub>X</sub>(k)</th>' +
      d.pts.map(function (x) { return '<td>' + frShow(frMul(x.v, x.p)) + '</td>'; }).join('') +
      '</tr></table>';

    h += '<div class="verdict safe">' +
      '<strong>E[X] = ' + frShow(mu) + '</strong>' +
      (frNum(mu) !== Math.round(frNum(mu) * 1e6) / 1e6 ? '' : ' = ' + frNum(mu)) +
      ' — the sum of the bottom row.<br>' +
      '<strong>Var[X] = ' + frShow(v.direct) + '</strong>, ' +
      '<strong>σ = ' + v.sd.toFixed(4) + '</strong>.</div>';

    h += '<div class="pb-two">' +
      '<div class="pb-half"><div class="pb-cap">The definition</div>' +
        'Var[X] = E[(X − μ)²] = ' + frShow(v.direct) + '</div>' +
      '<div class="pb-half"><div class="pb-cap">The theorem on slide 13</div>' +
        'E[X²] − E[X]² = ' + frShow(m2) + ' − ' + frShow(frMul(mu, mu)) + ' = ' +
        frShow(v.shortcut) + '</div></div>';

    h += '<div class="lp-foot">' + (v.agree
      ? 'The two agree, as they must — expanding (X − μ)² and using linearity turns one into the ' +
        'other. The second form is the one to compute with: it needs one pass for E[X] and one for ' +
        'E[X²], where the definition needs μ before it can start.'
      : '<strong>They do not agree, which is impossible if both are computed correctly.</strong>') +
      '</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · Markov's inequality ---------- */

  function mkPreset(which) {
    var el = document.getElementById('mk-text');
    if (el) el.value = PB_PRESETS[which] || PB_PRESETS.skewed;
    runMarkov();
  }

  function runMarkov() {
    var out = document.getElementById('mk-output');
    if (!out) return;
    var d = pbRead('mk-text', PB_PRESETS.skewed);
    if (!d.ok) return pbBad('mk-output', d);

    var aRaw = (document.getElementById('mk-a') || {}).value || '2';
    var a = frParse(aRaw);
    if (!a) return pbBad('mk-output', { error: 'Cannot read <code>' + esc(aRaw) + '</code> as a number.' });

    var r = mkCheck(d, a);
    if (!r.ok) return pbBad('mk-output', r);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">E[X] = ' + frShow(r.mu) + '</span>' +
      '<span class="stat-pill a">a = ' + frShow(a) + '</span>' +
      '<span class="stat-pill ' + (r.nonNegative ? 'b' : 'warn') + '">' +
        (r.nonNegative ? 'X ≥ 0 — the theorem applies' : 'X takes negative values') + '</span>' +
      '<span class="stat-pill ' + (r.holds ? 'b' : 'c') + '">' +
        (r.holds ? 'bound holds' : 'bound VIOLATED') + '</span></div>';

    h += pbChart(d, { mean: r.mu, highlight: function (x) { return frCmp(x.v, r.threshold) >= 0; } });

    h += '<div class="mk-sides">' +
      '<div class="mk-side"><div class="pb-cap">the left-hand side</div>' +
        'Prob( X ≥ ' + frShow(a) + ' · ' + frShow(r.mu) + ' ) = Prob( X ≥ ' + frShow(r.threshold) +
        ' ) = <strong>' + frShow(r.lhs) + '</strong>' +
        '<div class="mk-note">the shaded bars</div></div>' +
      '<div class="mk-rel">' + (r.holds ? '≤' : '<span class="mk-bad">&gt;</span>') + '</div>' +
      '<div class="mk-side"><div class="pb-cap">the bound</div>' +
        '1 / a = <strong>' + frShow(r.rhs) + '</strong></div></div>';

    h += '<div class="verdict ' + (r.nonNegative ? (r.holds ? 'safe' : 'bad') : 'warn') + '">' +
      r.note + '</div>';

    if (!r.nonNegative && !r.holds) {
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">This is a counterexample to the slide as written</div>' +
        'The slide states Markov’s inequality with no condition on X at all. Here the bound fails, ' +
        'and it fails because the missing hypothesis <strong>X ≥ 0</strong> is missing. With a ' +
        'negative mean, multiplying it by a larger a moves the threshold <em>down</em>, so the event ' +
        'gets more likely rather than less — the inequality runs backwards. Write the hypothesis down ' +
        'when you quote the theorem.</div>';
    }

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · linearity versus independence ---------- */

  function pjPreset(which) {
    var el = document.getElementById('pj-text');
    if (el) el.value = PJ_PRESETS[which] || PJ_PRESETS.dependent;
    runJoint();
  }

  function runJoint() {
    var out = document.getElementById('pj-output');
    if (!out) return;
    var el = document.getElementById('pj-text');
    var j = pjParse((el ? el.value : '') || PJ_PRESETS.dependent);
    if (!j.ok) return pbBad('pj-output', j);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill ' + (j.sums ? 'b' : 'warn') + '">Σ p = ' + frShow(j.total) + '</span>' +
      '<span class="stat-pill ' + (j.independent ? 'b' : 'a') + '">' +
        (j.independent ? 'independent' : 'dependent') + '</span>' +
      '<span class="stat-pill b">E adds: ' + j.linearHolds + '</span>' +
      '<span class="stat-pill ' + (j.varAdds ? 'b' : 'c') + '">Var adds: ' + j.varAdds + '</span></div>';

    // the joint table
    h += '<table class="pj-table"><tr><th></th>' +
      j.ys.map(function (y) { return '<th>Y = ' + frShow(y) + '</th>'; }).join('') + '<th>row</th></tr>';
    j.xs.forEach(function (x) {
      var rowSum = fr(0);
      var cells = j.ys.map(function (y) {
        var c = j.cells.filter(function (c2) {
          return frCmp(c2.x, x) === 0 && frCmp(c2.y, y) === 0;
        })[0];
        var p = c ? c.p : fr(0);
        rowSum = frAdd(rowSum, p);
        return '<td>' + frShow(p) + '</td>';
      }).join('');
      h += '<tr><th>X = ' + frShow(x) + '</th>' + cells + '<td class="pj-marg">' + frShow(rowSum) +
           '</td></tr>';
    });
    h += '</table>';

    if (!j.independent && j.witness) {
      h += '<div class="verdict warn">Not independent: at X = ' + frShow(j.witness.x) + ', Y = ' +
        frShow(j.witness.y) + ' the joint probability is ' + frShow(j.witness.joint) +
        ' but the product of the marginals is ' + frShow(j.witness.product) + '.</div>';
    }

    h += '<div class="pb-two">' +
      '<div class="pb-half"><div class="pb-cap">E[X + Y] = E[X] + E[Y]?</div>' +
        frShow(j.EXY) + ' &nbsp;versus&nbsp; ' + frShow(j.EX) + ' + ' + frShow(j.EY) + ' = ' +
        frShow(frAdd(j.EX, j.EY)) +
        '<div class="pj-verdict ' + (j.linearHolds ? 'yes' : 'no') + '">' +
        (j.linearHolds ? 'holds' : 'fails') + '</div></div>' +
      '<div class="pb-half"><div class="pb-cap">Var[X + Y] = Var[X] + Var[Y]?</div>' +
        frShow(j.VXY) + ' &nbsp;versus&nbsp; ' + frShow(j.VX) + ' + ' + frShow(j.VY) + ' = ' +
        frShow(frAdd(j.VX, j.VY)) +
        '<div class="pj-verdict ' + (j.varAdds ? 'yes' : 'no') + '">' +
        (j.varAdds ? 'holds' : 'fails') + '</div></div></div>';

    h += '<div class="lp-foot">Covariance here is <strong>' + frShow(j.covariance) + '</strong>, and ' +
      'Var[X + Y] = Var[X] + Var[Y] + 2·Cov[X, Y] always — which is why the variance only adds when ' +
      'the covariance vanishes. <strong>Linearity of expectation needs nothing at all.</strong> ' +
      'It holds for any two random variables on any joint distribution, however tangled, and that is ' +
      'what makes it the most useful line in the topic: you can split a total into parts, take the ' +
      'expectation of each, and never once argue that the parts are independent.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · the computation tree ---------- */

  function ptmPreset(which) {
    var el = document.getElementById('pt-text');
    if (el) el.value = PTM_PRESETS[which] || PTM_PRESETS.lecture;
    var w = document.getElementById('pt-word');
    if (w) w.value = which === 'biased' ? '' : (which === 'deterministic' ? '111' : '111');
    runPtm();
  }

  function runPtm() {
    var out = document.getElementById('pt-output');
    if (!out) return;
    var el = document.getElementById('pt-text');
    var p = ptmParse((el ? el.value : '') || PTM_PRESETS.lecture);
    if (!p.ok) return pbBad('pt-output', p);

    var word = ((document.getElementById('pt-word') || {}).value || '');
    var depth = parseInt((document.getElementById('pt-depth') || {}).value, 10);
    if (!(depth >= 1)) depth = 8;

    var t = ptmTree(p.m, word, { depth: depth });

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + t.nodes.length + ' configurations</span>' +
      '<span class="stat-pill a">' + t.branches + ' branches</span>' +
      '<span class="stat-pill a">' + p.m.branching + ' branching rules</span>' +
      '<span class="stat-pill ' + (t.exhaustive ? 'b' : 'warn') + '">' +
        (t.exhaustive ? 'probabilities total 1' : 'total ' + frShow(t.total) + ', not 1') +
      '</span></div>';

    h += '<div class="verdict ' + (t.exhaustive ? 'safe' : 'bad') + '">' +
      '<strong>Prob(M accepts) = ' + frShow(t.pAccept) + '</strong>' +
      (frCmp(t.pReject, fr(0)) > 0 ? ' &nbsp; Prob(rejects) = ' + frShow(t.pReject) : '') +
      (frCmp(t.pStuck, fr(0)) > 0 ? ' &nbsp; Prob(gets stuck) = ' + frShow(t.pStuck) : '') +
      (frCmp(t.pOpen, fr(0)) > 0 ? ' &nbsp; Prob(still running at step ' + depth + ') = ' +
        frShow(t.pOpen) : '') +
      '<br>Every branch is a disjoint outcome and the tree covers all of them, so the four ' +
      'probabilities must total exactly 1 — and they ' + (t.exhaustive ? 'do' : '<strong>do not</strong>') +
      '.</div>';

    if (frCmp(t.pStuck, fr(0)) > 0) {
      h += '<div class="callout warn" style="margin:12px 0;"><div class="callout-label">' +
        'Some branches get stuck</div>δ has no instruction for the state and symbol they reached. ' +
        'A stuck machine is not the same as a rejecting one and not the same as a looping one — it ' +
        'halts without a verdict, which is usually a gap in the machine rather than a design.</div>';
    }

    // the branches, with the multiplication spelled out
    h += '<div class="pt-branches">';
    t.leaves.forEach(function (l, i) {
      var path = ptmPath(t, l);
      var factors = path.slice(1).map(function (n) { return frShow(n.edgeProb); });
      h += '<div class="pt-branch ' + l.verdict + '" data-step="' + i + '">' +
        '<div class="pt-head"><span class="pt-verdict">' + l.verdict + '</span>' +
        '<span class="pt-prob">' + (factors.length ? factors.join(' × ') + ' = ' : '') +
        '<strong>' + frShow(l.prob) + '</strong></span>' +
        '<span class="pt-depth">' + l.depth + ' step' + (l.depth === 1 ? '' : 's') + '</span></div>' +
        '<div class="pt-configs">' + path.map(function (n) {
          return '<span class="pt-cfg">(' + esc(n.state) + ', ' +
            esc(n.tape.slice(0, n.head).join('') || 'ε') + ', ' +
            esc(n.tape.slice(n.head).join('') || 'ε') + ')</span>';
        }).join('<span class="pt-arrow">→</span>') + '</div></div>';
    });
    h += '</div>';

    h += '<div class="lp-foot">The probability of a branch is the <strong>product</strong> along it, ' +
      'because each choice is made independently of the last. The probability the machine accepts is ' +
      'the <strong>sum</strong> over accepting branches, because distinct branches are mutually ' +
      'exclusive — two different sequences of choices cannot both happen. Those are the only two ' +
      'rules in this tool.' +
      (t.eTGivenHalt ? ' Expected running time over the branches that finished: <strong>' +
        frShow(t.eTGivenHalt) + '</strong> steps.' : '') +
      (t.truncated ? ' <strong>The tree was cut off at depth ' + depth + '</strong>, so the mass ' +
        'marked "still running" is genuinely undecided, not lost.' : '') +
      '</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 5 · BPP, ZPP and amplification ---------- */

  function runClasses() {
    var out = document.getElementById('pc-output');
    if (!out) return;
    var inRaw = (document.getElementById('pc-in') || {}).value || '2/3';
    var outRaw = (document.getElementById('pc-out') || {}).value || '1/3';
    var pIn = frParse(inRaw), pOut = frParse(outRaw);
    if (!pIn || !pOut) return pbBad('pc-output', { error: 'Cannot read those probabilities.' });
    if (frCmp(pIn, fr(0)) < 0 || frCmp(pIn, fr(1)) > 0 || frCmp(pOut, fr(0)) < 0 || frCmp(pOut, fr(1)) > 0) {
      return pbBad('pc-output', { error: 'Both probabilities must lie in [0, 1].' });
    }

    var c = pcClassify(pIn, pOut, {});

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill ' + (c.inBPP ? 'b' : 'a') + '">BPP: ' + (c.inBPP ? 'yes' : 'no') + '</span>' +
      '<span class="stat-pill ' + (c.inZPP ? 'b' : 'a') + '">ZPP: ' + (c.inZPP ? 'yes' : 'no') + '</span>' +
      '<span class="stat-pill a">gap ' + frShow(c.gap) + '</span></div>';

    h += '<table class="pc-table"><tr><th></th><th>this machine</th><th>BPP needs</th><th>ZPP needs</th></tr>' +
      '<tr><th>w ∈ L ⇒ Prob(accept)</th><td>' + frShow(pIn) + '</td>' +
        '<td class="' + (c.bppComplete ? 'pc-ok' : 'pc-no') + '">≥ 2/3</td>' +
        '<td class="' + (c.zppComplete ? 'pc-ok' : 'pc-no') + '">= 1</td></tr>' +
      '<tr><th>w ∉ L ⇒ Prob(accept)</th><td>' + frShow(pOut) + '</td>' +
        '<td class="' + (c.bppSound ? 'pc-ok' : 'pc-no') + '">≤ 1/3</td>' +
        '<td class="' + (c.zppSound ? 'pc-ok' : 'pc-no') + '">= 0</td></tr>' +
      '<tr><th>running time</th><td>—</td><td>worst case O(n<sup>k</sup>)</td>' +
        '<td>expected O(n<sup>k</sup>)</td></tr></table>';

    h += '<div class="verdict ' + (c.inBPP || c.inZPP ? 'safe' : (c.straddles ? '' : 'warn')) + '">' +
      c.note + '</div>';

    // amplification
    if (c.straddles) {
      var acc = frSub(fr(1), pOut);
      var worst = frCmp(pIn, acc) < 0 ? pIn : acc;   // the worse of the two sides
      h += '<div class="pc-amp"><div class="pb-cap">Majority vote over k independent runs</div>' +
        '<table class="pc-table"><tr><th>k</th><th>chance the majority is wrong</th><th></th></tr>';
      [1, 3, 5, 11, 21, 51, 101, 201].forEach(function (k) {
        var a = pcAmplify(worst, k);
        if (!a.ok) return;
        var w = Math.max(1, Math.round(260 * a.error / Math.max(1e-12, 1 - frNum(worst))));
        h += '<tr><td>' + k + '</td><td>' + (a.error < 1e-4 ? a.error.toExponential(3) : a.error.toFixed(6)) +
          '</td><td><span class="pc-bar" style="width:' + w + 'px"></span></td></tr>';
      });
      h += '</table>';
      var rep = pcRepetitions(worst, 1e-9);
      h += '<div class="lp-foot">Single-run accuracy here is <strong>' + frShow(worst) + '</strong>. ' +
        (rep.ok
          ? '<strong>' + rep.k + '</strong> repetitions bring the error below 10⁻⁹ — smaller than the ' +
            'chance of the hardware being hit by a cosmic ray mid-computation. '
          : '') +
        'This is why the 1/3 and 2/3 in the definition are a convention and not a boundary: any ' +
        'constant strictly on the right side of 1/2 amplifies to any other, at the cost of a constant ' +
        'factor in the running time, which O(n<sup>k</sup>) absorbs. Note the one thing amplification ' +
        'cannot do: if the gap shrinks with n rather than staying constant, a <em>polynomial</em> ' +
        'number of repetitions may not be enough.</div></div>';
    }

    // the ZPP ⊆ BPP construction on a concrete runtime distribution
    var geo = pbParse(PB_PRESETS.geometric);
    if (geo.ok) {
      var z = pcZppToBpp(geo);
      if (z.ok) {
        h += '<div class="pc-zpp"><div class="pb-cap">ZPP ⊆ BPP, on a concrete runtime</div>' +
          'Take a Las Vegas machine whose running time is the distribution below, cut it off at ' +
          'K = 3·E[T] = ' + frShow(z.K) + ' steps, and flip a coin if it has not finished.' +
          '<table class="pc-table"><tr><th></th><th>this machine</th><th>the slide’s bound</th>' +
          '<th>the honest bound</th></tr>' +
          '<tr><th>Prob(accept | w ∈ L)</th><td>' + frShow(z.accIn) + '</td><td>≥ ' +
            frShow(z.slideBoundIn) + '</td><td>≥ ' + frShow(z.honestBoundIn) + '</td></tr>' +
          '<tr><th>Prob(accept | w ∉ L)</th><td>' + frShow(z.accOut) + '</td><td>≤ ' +
            frShow(z.slideBoundOut) + '</td><td>≤ ' + frShow(z.honestBoundOut) + '</td></tr>' +
          '<tr><th>Prob(T &gt; K)</th><td>' + frShow(z.pOver) + '</td><td colspan="2">Markov caps this ' +
            'at 1/3 whatever the distribution</td></tr></table>' +
          '<div class="lp-foot">' + z.note + '</div></div>';
      }
    }

    out.innerHTML = h;
  }

  /* The runtime distribution the ZPP panel uses: geometric, mean 2. */
  PB_PRESETS.geometric = (function () {
    var lines = [];
    for (var i = 1; i <= 13; i++) lines.push(i + ' 1/' + Math.pow(2, i));
    lines.push('14 1/8192');
    return lines.join('\n');
  })();
