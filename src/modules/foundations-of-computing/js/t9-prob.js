  /* ============================================================
     TOPIC 09 · probability, expectation, variance
     ------------------------------------------------------------
     The rationals from Topic 8 are reused here rather than floats,
     because the answers in this topic are things like 1/3 and 2/9
     and the whole point of the ZPP proof is a comparison against
     exactly 1/3. Floating point would turn "is this at most 1/3?"
     into a question about rounding.

     One thing to know before reading further. The lecture states
     Markov's inequality as

         Prob(X >= a E[X]) <= 1/a     for any a > 0

     with no hypothesis on X. That is false as written: take X to
     be -10 always, so E[X] = -10, and then Prob(X >= 2 E[X]) =
     Prob(X >= -20) = 1, which is not <= 1/2. The theorem needs
     X >= 0, and mkCheck below reports the missing hypothesis
     rather than quietly assuming it.
     ============================================================ */

  /** A distribution: values with probabilities, kept exact. */
  function pbParse(text) {
    var lines = String(text || '').split(/\n+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s && s.charAt(0) !== '#'; });
    if (!lines.length) {
      return { ok: false, error: 'Nothing to read. Give one <code>value probability</code> pair per line, ' +
        'for example <code>1 0.15</code>.' };
    }

    var pts = [], seen = {};
    for (var i = 0; i < lines.length; i++) {
      var p = lines[i].split(/[\s,:]+/).filter(Boolean);
      if (p.length !== 2) {
        return { ok: false, error: 'Cannot read "' + esc(lines[i]) + '". Each line is a value and a ' +
          'probability, like <code>3 1/4</code> or <code>3 0.25</code>.' };
      }
      var v = frParse(p[0]), q = frParse(p[1]);
      if (!v) return { ok: false, error: 'Cannot read the value in "' + esc(lines[i]) + '".' };
      if (!q) return { ok: false, error: 'Cannot read the probability in "' + esc(lines[i]) + '".' };
      if (frCmp(q, fr(0)) < 0 || frCmp(q, fr(1)) > 0) {
        return { ok: false, error: 'The probability in "' + esc(lines[i]) + '" is outside [0, 1]. ' +
          'A probability measure maps into [0, 1] by definition.' };
      }
      var key = frStr(v);
      if (seen[key]) {
        return { ok: false, error: 'The value ' + esc(key) + ' appears twice. Give each outcome one ' +
          'probability — the measure is a function.' };
      }
      seen[key] = true;
      pts.push({ v: v, p: q });
    }

    var total = pts.reduce(function (s, x) { return frAdd(s, x.p); }, fr(0));
    var sums = frCmp(total, fr(1)) === 0;
    pts.sort(function (a, b) { return frCmp(a.v, b.v); });

    return {
      ok: true, pts: pts, total: total, sums: sums, n: pts.length,
      note: sums ? null : 'The probabilities sum to ' + frShow(total) + ', not 1. Everything below is ' +
        'still computed, but a probability measure over the whole sample space must total exactly 1, ' +
        'so treat the numbers as meaningless until that is fixed.'
    };
  }

  /** E[X] = sum over k of k * p_X(k) — the slide's definition, literally. */
  function pbMean(d) {
    return d.pts.reduce(function (s, x) { return frAdd(s, frMul(x.v, x.p)); }, fr(0));
  }

  /** E[g(X)] for any g, which is all the moments need. */
  function pbMoment(d, power) {
    return d.pts.reduce(function (s, x) {
      var t = fr(1);
      for (var i = 0; i < power; i++) t = frMul(t, x.v);
      return frAdd(s, frMul(t, x.p));
    }, fr(0));
  }

  /**
     Variance, both ways.

     The lecture derives Var[X] = E[(X - mu)^2] and then states
     Var[X] = E[X^2] - E[X]^2 as a theorem. Both are computed here
     and compared, so the theorem is checked on every distribution
     the tool is given rather than trusted.
  */
  function pbVar(d) {
    var mu = pbMean(d);
    var direct = d.pts.reduce(function (s, x) {
      var dv = frSub(x.v, mu);
      return frAdd(s, frMul(frMul(dv, dv), x.p));
    }, fr(0));
    var shortcut = frSub(pbMoment(d, 2), frMul(mu, mu));
    return {
      mu: mu, direct: direct, shortcut: shortcut,
      agree: frCmp(direct, shortcut) === 0,
      sd: Math.sqrt(Math.max(0, frNum(direct)))
    };
  }

  /** Prob(X >= k), Prob(X <= k), Prob(X = k) — the slide's three forms. */
  function pbTail(d, k, rel) {
    return d.pts.reduce(function (s, x) {
      var c = frCmp(x.v, k);
      var hit = rel === 'ge' ? c >= 0 : rel === 'le' ? c <= 0 : rel === 'gt' ? c > 0 : c === 0;
      return hit ? frAdd(s, x.p) : s;
    }, fr(0));
  }

  /**
     Markov's inequality, checked rather than asserted.

     Returns the two sides and, crucially, whether the hypothesis
     the slide omits actually holds. When X can be negative the
     bound is not merely unproven, it is false, and the tool says
     which of the two it is.
  */
  function mkCheck(d, a) {
    if (frCmp(a, fr(0)) <= 0) return { ok: false, error: 'Markov needs <strong>a &gt; 0</strong>.' };
    var mu = pbMean(d);
    var negative = d.pts.filter(function (x) { return frCmp(x.v, fr(0)) < 0; });
    var threshold = frMul(a, mu);
    var lhs = pbTail(d, threshold, 'ge');
    var rhs = frDiv(fr(1), a);
    var holds = frCmp(lhs, rhs) <= 0;
    return {
      ok: true, a: a, mu: mu, threshold: threshold, lhs: lhs, rhs: rhs,
      holds: holds,
      nonNegative: negative.length === 0,
      negatives: negative.map(function (x) { return frStr(x.v); }),
      tight: frCmp(lhs, rhs) === 0,
      // A violation is only possible when the missing hypothesis fails.
      violates: !holds,
      note: negative.length
        ? 'This X takes negative values (' + negative.map(function (x) { return frShow(x.v); }).join(', ') +
          '), so the slide’s statement does not apply — the theorem needs <strong>X ≥ 0</strong>, ' +
          'a hypothesis the slide leaves out.'
        : (frCmp(lhs, rhs) === 0
            ? 'The bound is met exactly. Markov is tight: a distribution putting 1/a of its mass at ' +
              'a·E[X] and the rest at 0 achieves equality, which is why no better bound is possible ' +
              'from the mean alone.'
            : 'The bound holds, with room to spare. Markov uses nothing but the mean, so it is usually ' +
              'loose; knowing the variance as well gives Chebyshev, which is tighter.')
    };
  }

  /** A witness that the slide's Markov, as stated, is false. */
  function mkCounterexample(a) {
    var d = pbParse('-10 1');
    var r = mkCheck(d, a || fr(2));
    return { d: d, r: r };
  }

  /* ---------- joint distributions: what linearity does and does not need ----------

     E[X + Y] = E[X] + E[Y] for ANY two random variables, dependent
     or not. Var[X + Y] = Var[X] + Var[Y] needs independence. That
     asymmetry is the single most useful thing in the topic and the
     slide does not draw attention to it, so the tool computes both
     on a joint distribution the user can make as dependent as they
     like.
  */

  function pjParse(text) {
    var lines = String(text || '').split(/\n+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s && s.charAt(0) !== '#'; });
    if (!lines.length) return { ok: false, error: 'Give one <code>x y probability</code> triple per line.' };

    var cells = [], xs = [], ys = [];
    for (var i = 0; i < lines.length; i++) {
      var p = lines[i].split(/[\s,]+/).filter(Boolean);
      if (p.length !== 3) {
        return { ok: false, error: 'Cannot read "' + esc(lines[i]) + '". Each line is ' +
          '<code>x y probability</code>, for example <code>0 1 1/4</code>.' };
      }
      var x = frParse(p[0]), y = frParse(p[1]), q = frParse(p[2]);
      if (!x || !y || !q) return { ok: false, error: 'Cannot read the numbers in "' + esc(lines[i]) + '".' };
      cells.push({ x: x, y: y, p: q });
      if (!xs.some(function (v) { return frCmp(v, x) === 0; })) xs.push(x);
      if (!ys.some(function (v) { return frCmp(v, y) === 0; })) ys.push(y);
    }
    xs.sort(frCmp); ys.sort(frCmp);

    var total = cells.reduce(function (s, c) { return frAdd(s, c.p); }, fr(0));

    function marginal(pick) {
      var m = {};
      cells.forEach(function (c) {
        var k = frStr(pick(c));
        m[k] = frAdd(m[k] || fr(0), c.p);
      });
      return m;
    }
    var mx = marginal(function (c) { return c.x; });
    var my = marginal(function (c) { return c.y; });

    // independent iff every cell equals the product of its marginals
    var independent = true, witness = null;
    cells.forEach(function (c) {
      var want = frMul(mx[frStr(c.x)], my[frStr(c.y)]);
      if (frCmp(c.p, want) !== 0 && !witness) {
        independent = false;
        witness = { x: c.x, y: c.y, joint: c.p, product: want };
      }
    });

    function E(f) { return cells.reduce(function (s, c) { return frAdd(s, frMul(f(c), c.p)); }, fr(0)); }
    var EX = E(function (c) { return c.x; });
    var EY = E(function (c) { return c.y; });
    var EXY = E(function (c) { return frAdd(c.x, c.y); });
    function V(f, m) {
      return cells.reduce(function (s, c) {
        var d = frSub(f(c), m);
        return frAdd(s, frMul(frMul(d, d), c.p));
      }, fr(0));
    }
    var VX = V(function (c) { return c.x; }, EX);
    var VY = V(function (c) { return c.y; }, EY);
    var VXY = V(function (c) { return frAdd(c.x, c.y); }, frAdd(EX, EY));
    var EXtY = E(function (c) { return frMul(c.x, c.y); });

    return {
      ok: true, cells: cells, xs: xs, ys: ys, total: total,
      sums: frCmp(total, fr(1)) === 0,
      independent: independent, witness: witness,
      EX: EX, EY: EY, EXY: EXY, EXtimesY: EXtY,
      VX: VX, VY: VY, VXY: VXY,
      linearHolds: frCmp(EXY, frAdd(EX, EY)) === 0,
      varAdds: frCmp(VXY, frAdd(VX, VY)) === 0,
      covariance: frSub(EXtY, frMul(EX, EY))
    };
  }

  var PB_PRESETS = {
    lecture: '# the distribution on slide 10 — E[X] should come out at 3.35\n' +
             '1 0.15\n2 0.3\n3 0.15\n4 0.1\n5 0.05\n6 0.25',
    die:     '# a fair six-sided die\n1 1/6\n2 1/6\n3 1/6\n4 1/6\n5 1/6\n6 1/6',
    tight:   '# the distribution that makes Markov an equality at a = 3\n0 2/3\n3 1/3',
    negative:'# X is never positive — the hypothesis the slide omits\n-10 1',
    skewed:  '# almost all the mass at 0, a little far out\n0 0.99\n100 0.01'
  };

  var PJ_PRESETS = {
    dependent: '# Y is always equal to X — as dependent as it gets\n0 0 1/2\n1 1 1/2',
    independent: '# a product distribution: every cell is the product of its marginals\n' +
                 '0 0 1/4\n0 1 1/4\n1 0 1/4\n1 1 1/4',
    anti: '# Y is always the opposite of X\n0 1 1/2\n1 0 1/2'
  };
