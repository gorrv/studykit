  /* ============================================================
     TOPIC 06 · revision week
     ------------------------------------------------------------
     Topic 6 introduces nothing new — it is a consolidation topic — so
     this section has no new material in it and does not pretend
     to. It does two things instead.

     The first is an audit: take the central claim of each topic so
     far, generate fresh random instances of it, and check it still
     holds by running two unrelated engines against each other. It
     is the same discipline the rest of the module is built on,
     turned on the module itself, and it doubles as a map — every
     row names which topic the theorem comes from and which other
     topic it leans on.

     The second is a drill that mixes questions from Topics 1 to 5
     and keeps a separate score for each, so that "revise" turns
     into a specific list rather than a mood.
     ============================================================ */

  function rvPick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rvInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  /* ---------- random instances for the audit ---------- */

  function rvNfa() {
    var states = rvInt(3, 4), alpha = ['a', 'b'], lines = [];
    lines.push('start: q0');
    var accept = [];
    for (var i = 0; i < states; i++) if (Math.random() < 0.4) accept.push('q' + i);
    if (!accept.length) accept.push('q' + (states - 1));
    lines.push('accept: ' + accept.join(' '));
    var edges = 0;
    for (var s = 0; s < states; s++) {
      for (var k = 0; k < alpha.length; k++) {
        var n = rvInt(0, 2);                        // 0, 1 or 2 targets — non-determinism
        for (var t = 0; t < n; t++) {
          lines.push('q' + s + ' ' + alpha[k] + ' q' + rvInt(0, states - 1));
          edges++;
        }
      }
    }
    if (!edges) lines.push('q0 a q0');
    return lines.join('\n');
  }

  function rvFormula() {
    var vs = ['P', 'Q', 'R'].slice(0, rvInt(2, 3));
    function lit() { return (Math.random() < 0.35 ? '~' : '') + rvPick(vs); }
    function part() {
      return '(' + lit() + ' ' + rvPick(['&', '|']) + ' ' + lit() + ')';
    }
    return part() + ' ' + rvPick(['&', '|', '->']) + ' ' + part();
  }

  function rvCnf(maxWidth, nVars, nClauses) {
    var vs = ['P', 'Q', 'R', 'S'].slice(0, nVars);
    var out = [];
    for (var c = 0; c < nClauses; c++) {
      var pool = [], cl = [];
      vs.forEach(function (v) { pool.push(v, '~' + v); });
      var width = rvInt(1, Math.min(maxWidth, pool.length));
      for (var i = 0; i < width; i++) {
        cl.push(pool.splice(rvInt(0, pool.length - 1), 1)[0]);
      }
      out.push('(' + cl.join(' | ') + ')');
    }
    return out.join('\n');
  }

  function rvDigraph() {
    var n = rvInt(4, 6), names = [], lines = [];
    for (var i = 0; i < n; i++) names.push(String.fromCharCode(65 + i));
    var seen = {};
    var want = rvInt(n, n * 2);
    for (var e = 0; e < want; e++) {
      var u = rvPick(names), v = rvPick(names);
      if (u === v) continue;                       // self-loops: the parser refuses them
      var key = u + '>' + v;
      if (seen[key]) continue;
      seen[key] = true;
      lines.push(u + ' > ' + v);
    }
    return lines.length ? lines.join('\n') : 'A > B\nB > A';
  }

  /* ---------- the audit ---------- */

  /**
     Each entry states a theorem, produces a random instance of it,
     and returns { ok, detail } having checked it by two routes that
     do not share reasoning. `from` and `uses` are what make the
     table a map rather than a list.
  */
  var RV_CHECKS = [
    {
      id: 'subset', from: 'Topic 01', uses: 'exhaustive word testing',
      claim: 'The subset construction turns an NFA into a DFA accepting the same language.',
      run: function () {
        var src = rvNfa();
        var p = faParse(src);
        if (!p.ok) return { ok: false, detail: p.error };
        var sub = subsetConstruct(p.m);
        var agree = faAgree(p.m, sub.dfa, 5);
        return {
          ok: agree.same,
          detail: agree.tested + ' words up to length 5 tested; the NFA had ' +
            p.m.states.length + ' states, the DFA has ' + sub.dfa.states.length +
            (sub.blowup ? ' — an exponential blow-up' : ''),
          instance: src
        };
      }
    },
    {
      id: 'normal', from: 'Topic 02', uses: 'the truth table',
      claim: 'The DNF and CNF read off a truth table are both equivalent to the formula.',
      run: function () {
        var src = rvFormula();
        var p = fmParse(src);
        if (!p.ok) return { ok: false, detail: p.error };
        var t = fmTable(p.ast);
        var a = fmAgree(p.ast, fmDnf(t).terms, fmCnf(t).clauses);
        return { ok: a.ok, detail: a.checked + ' rows checked, all three forms agreeing',
                 instance: src };
      }
    },
    {
      id: 'clique', from: 'Topic 02', uses: 'brute-force SAT and clique search',
      claim: 'SAT ≤ₚ CLIQUE: a formula is satisfiable exactly when its graph has a clique of size m.',
      run: function () {
        var src = rvCnf(3, 3, rvInt(2, 3));
        var f = stParse(src);
        if (!f.ok) return { ok: false, detail: f.error };
        var r = rdCheck(f.clauses);
        return {
          ok: r.agree,
          detail: 'the formula is ' + (r.clique && r.clique.clique ? 'satisfiable' : 'unsatisfiable') +
            ' and the graph ' + (r.clique && r.clique.clique ? 'has' : 'has no') +
            ' clique of the required size',
          instance: src
        };
      }
    },
    {
      id: 'master', from: 'Topic 03', uses: 'unfolding the recurrence numerically',
      claim: 'The Master Theorem’s answer matches what the recurrence actually does.',
      run: function () {
        var a = rvInt(1, 9), b = rvInt(2, 4);
        // These are the forms mtSolve's own parser accepts; "n*log2(n)"
        // is not one of them and was silently costing a third of the runs.
        var f = rvPick(['1', 'n', 'n^2', 'n^3', 'log n', 'n log n', 'sqrt n', 'n^2 log n']);
        var sol = mtSolve(a, b, f);
        if (!sol.ok) return { ok: false, detail: sol.error, instance: 'T(n) = ' + a + 'T(n/' + b + ') + ' + f };
        var num = mtNumeric(a, b, sol.fFn, 4096);
        var agr = mtAgrees(sol, num.estimate);
        return {
          ok: agr.ok,
          detail: 'Case ' + sol.caseNo + ' gives ' + sol.answer +
            '; measuring the growth of the unfolded recurrence gives an exponent of ' +
            num.estimate.toFixed(3) + ' against a predicted ' + agr.want,
          instance: 'T(n) = ' + a + 'T(n/' + b + ') + ' + f
        };
      }
    },
    {
      id: 'condense', from: 'Topic 04', uses: 'plain reachability',
      claim: 'Contracting each strongly connected component to a point leaves a DAG.',
      run: function () {
        var src = rvDigraph();
        var g = grParse(src, { directed: true });
        if (!g.ok) return { ok: false, detail: g.error, instance: src };
        var sc = sccFind(g);
        if (!sc.ok) return { ok: false, detail: 'sccFind refused this graph', instance: src };
        var verify = sccCheck(g, sc.components);
        var cd = sccCondense(g, sc.components);
        return {
          ok: !!(cd.acyclic && verify.ok),
          detail: sc.components.length + ' components, verified by reachability alone, and the ' +
            'condensation ' + (cd.acyclic ? 'is acyclic' : 'CONTAINS A CYCLE'),
          instance: src
        };
      }
    },
    {
      id: 'twosat', from: 'Topic 05', uses: 'Topic 04’s SCC algorithm, and brute force',
      claim: '2SAT is decided by strongly connected components of the implication graph.',
      run: function () {
        var src = rvCnf(2, 4, rvInt(3, 6));
        var f = stParse(src);
        if (!f.ok) return { ok: false, detail: f.error };
        var viaScc = tsSolve(f.clauses, f.vars);
        var viaBrute = stBrute(f.clauses, f.vars);
        if (!viaScc.ok || !viaBrute.ok) {
          return { ok: false, detail: viaScc.error || viaBrute.error, instance: src };
        }
        return {
          ok: viaScc.sat === viaBrute.sat && (!viaScc.sat || viaScc.verified),
          detail: 'the implication graph says ' + (viaScc.sat ? 'satisfiable' : 'unsatisfiable') +
            ', enumerating all ' + viaBrute.searched + ' assignments says ' +
            (viaBrute.sat ? 'satisfiable' : 'unsatisfiable') +
            (viaScc.sat ? ', and the assignment it returns was checked against the clauses' : ''),
          instance: src
        };
      }
    },
    {
      id: 'threesat', from: 'Topic 05', uses: 'brute force on both formulas',
      claim: 'Splitting long clauses preserves satisfiability: SAT ≤ₚ 3SAT.',
      run: function () {
        var src = rvCnf(5, 4, rvInt(1, 3));
        var f = stParse(src);
        if (!f.ok) return { ok: false, detail: f.error };
        var r = tsTo3Check(f.clauses, f.vars);
        if (!r.ok) return { ok: false, detail: r.error, instance: src };
        return {
          ok: r.agree,
          detail: 'widest clause after splitting is ' + r.widest + ', with ' + r.added +
            ' new variable' + (r.added === 1 ? '' : 's') + '; both formulas are ' +
            (r.before ? 'satisfiable' : 'unsatisfiable'),
          instance: src
        };
      }
    },
    {
      id: 'simplex', from: 'Topic 08', uses: 'enumerating the vertices',
      claim: 'The simplex method finds the same optimum as checking every corner.',
      run: function () {
        var text = 'max ' + rvInt(1, 6) + 'x + ' + rvInt(1, 6) + 'y\n' +
          rvInt(1, 4) + 'x + ' + rvInt(1, 4) + 'y <= ' + rvInt(6, 22) + '\n' +
          rvInt(1, 4) + 'x + ' + rvInt(1, 4) + 'y <= ' + rvInt(6, 22);
        var lp = lpParse(text);
        if (!lp.ok) return { ok: false, detail: lp.error, instance: text };
        var run = spRun(lp);
        if (!run.ok) return { ok: false, detail: run.error, instance: text };
        return {
          ok: run.agrees === true && run.pointFeasible !== false,
          detail: run.pivots + ' pivots reach ' + frShow(run.cost) +
            '; the vertex enumerator checks ' + (run.truth ? run.truth.verts.length : '?') +
            ' corners and gets ' + (run.truth && run.truth.obj ? frShow(run.truth.obj) : '?'),
          instance: text
        };
      }
    }
  ];

  function runAudit() {
    var out = document.getElementById('rv-output');
    if (!out) return;
    var rounds = parseInt((document.getElementById('rv-rounds') || {}).value, 10);
    if (!(rounds >= 1)) rounds = 5;
    if (rounds > 60) rounds = 60;

    var results = RV_CHECKS.map(function (c) {
      var pass = 0, fail = 0, lastOk = null, firstBad = null;
      for (var i = 0; i < rounds; i++) {
        var r;
        try { r = c.run(); } catch (e) { r = { ok: false, detail: 'threw: ' + e.message }; }
        if (r.ok) { pass++; lastOk = r; } else { fail++; if (!firstBad) firstBad = r; }
      }
      return { c: c, pass: pass, fail: fail, shown: firstBad || lastOk };
    });

    var broken = results.filter(function (r) { return r.fail; });
    var total = results.reduce(function (s, r) { return s + r.pass + r.fail; }, 0);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + RV_CHECKS.length + ' theorems</span>' +
      '<span class="stat-pill a">' + total + ' instances</span>' +
      '<span class="stat-pill ' + (broken.length ? 'warn' : 'b') + '">' +
        (broken.length ? broken.length + ' failing' : 'all holding') + '</span></div>';

    h += '<div class="verdict ' + (broken.length ? 'bad' : 'safe') + '">' +
      (broken.length
        ? '<strong>' + broken.length + ' of ' + RV_CHECKS.length + ' claims failed</strong> on ' +
          'freshly generated instances. Either the engine that checks it or the engine it is ' +
          'checked against is wrong; both are named in the row.'
        : 'Every claim held on every one of the ' + total + ' random instances just generated. ' +
          'That is not a proof — the instances are small and there are finitely many of them — but ' +
          'each one was decided twice, by methods that share no reasoning, and they never ' +
          'disagreed.') + '</div>';

    h += '<div class="rv-list">';
    results.forEach(function (r) {
      h += '<div class="rv-row ' + (r.fail ? 'bad' : 'ok') + '">' +
        '<div class="rv-head">' +
          '<span class="rv-mark">' + (r.fail ? '×' : '✓') + '</span>' +
          '<span class="rv-from">' + esc(r.c.from) + '</span>' +
          '<span class="rv-claim">' + r.c.claim + '</span>' +
          '<span class="rv-count">' + r.pass + '/' + (r.pass + r.fail) + '</span>' +
        '</div>' +
        '<div class="rv-uses">checked against <strong>' + esc(r.c.uses) + '</strong></div>' +
        (r.shown
          ? '<div class="rv-detail">' + r.shown.detail + '</div>' +
            (r.shown.instance
              ? '<pre class="rv-inst">' + esc(r.shown.instance) + '</pre>' : '')
          : '') +
        '</div>';
    });
    h += '</div>';

    h += '<div class="lp-foot">Press it again and every instance is different. The point of a ' +
      'revision week is to find the thing you have quietly stopped believing; this is the same ' +
      'question asked of the notes.</div>';

    out.innerHTML = h;
  }

  /* ---------- the weak-spot drill ---------- */

  var RV_TOPICS = [
    { key: 'automata',   label: 'finite automata',        topic: 'Topic 01' },
    { key: 'languages',  label: 'expressions & pumping',  topic: 'Topic 01' },
    { key: 'machines',   label: 'Turing machines',        topic: 'Topic 01' },
    { key: 'complexity', label: 'P, NP & reductions',     topic: 'Topic 02' },
    { key: 'recursion',  label: 'recurrences',            topic: 'Topic 03' },
    { key: 'graphs',     label: 'graph algorithms',       topic: 'Topic 04' },
    { key: 'satsolve',   label: 'SAT solving',            topic: 'Topic 05' }
  ];

  var rvDrill = { cur: null, answered: false, tally: {}, asked: 0, right: 0 };

  function rvTally(k) {
    if (!rvDrill.tally[k]) rvDrill.tally[k] = { right: 0, total: 0 };
    return rvDrill.tally[k];
  }

  function rvNext() {
    var keys = RV_TOPICS.map(function (t) { return t.key; });
    var pool = QZ_GEN.filter(function (g) { return keys.indexOf(g.topic) >= 0; });
    if (!pool.length) { rvDrill.cur = null; return rvRender(); }

    /* Pick the AREA first, then a generator inside it. Picking a generator
       straight out of the pool would sample in proportion to how many
       generators each area happens to have, which is an accident of how the
       notes were written -- SAT solving has three times as many as Turing
       machines -- and it would leave the thin bars thin for the wrong
       reason. Within that, bias towards whatever is going worst: an area
       answered badly, or not yet touched at all, comes up more often than
       one at 100%. */
    var byArea = {};
    pool.forEach(function (g) { (byArea[g.topic] = byArea[g.topic] || []).push(g); });

    var weighted = [];
    Object.keys(byArea).forEach(function (k) {
      var t = rvTally(k);
      var rate = t.total ? t.right / t.total : 0.5;
      var weight = Math.max(1, Math.round((1 - rate) * 4) + 1);
      if (!t.total) weight += 2;                 // untouched areas first
      for (var i = 0; i < weight; i++) weighted.push(k);
    });

    var tries = 0;
    rvDrill.cur = null;
    while (tries++ < 15) {
      try {
        var area = rvPick(weighted);
        var q = rvPick(byArea[area]).make();
        if (q) { rvDrill.cur = q; rvDrill.cur.gen = area; break; }
      } catch (e) { rvDrill.cur = null; }
    }
    rvDrill.answered = false;
    rvRender();
  }

  /** Which of the seven buckets did this question come from? */
  function rvBucket(q) {
    if (q && q.gen) return q.gen;
    var head = String(q && q.topic || '').split('·')[0].trim();
    for (var i = 0; i < RV_TOPICS.length; i++) {
      if (RV_TOPICS[i].key === head) return RV_TOPICS[i].key;
    }
    return head;
  }

  function rvChoose(i) {
    if (!rvDrill.answered && rvDrill.cur) rvSubmit(rvDrill.cur.choices[i]);
  }
  function rvSubmitText() {
    var el = document.getElementById('rv-answer');
    if (rvDrill.cur && !rvDrill.answered && el) rvSubmit(el.value);
  }
  function rvSubmit(val) {
    if (!rvDrill.cur || rvDrill.answered) return;
    if (!String(val).trim()) { rvDrill.nudge = 'Type an answer first.'; return rvRender(); }
    var res;
    try { res = rvDrill.cur.check(val); } catch (e) { res = { ok: false, msg: 'Could not read that.' }; }
    rvDrill.answered = true;
    rvDrill.cur.given = val;
    rvDrill.cur.result = res;
    var t = rvTally(rvBucket(rvDrill.cur));
    t.total++; rvDrill.asked++;
    if (res.ok) { t.right++; rvDrill.right++; }
    rvRender();
  }
  function rvRevealAnswer() {
    if (!rvDrill.cur) return rvNext();
    if (!rvDrill.answered) {
      rvDrill.answered = true;
      rvDrill.cur.result = { ok: false, revealed: true };
      var t = rvTally(rvBucket(rvDrill.cur));
      t.total++; rvDrill.asked++;
    }
    rvRender();
  }
  function rvResetDrill() {
    rvDrill = { cur: null, answered: false, tally: {}, asked: 0, right: 0 };
    rvRender();
  }

  function rvRender() {
    var out = document.getElementById('rv-drill-output');
    if (!out) return;
    var h = '';

    // the scoreboard, weakest first
    var rows = RV_TOPICS.map(function (t) {
      var s = rvDrill.tally[t.key] || { right: 0, total: 0 };
      return { t: t, s: s, rate: s.total ? s.right / s.total : null };
    });
    var attempted = rows.filter(function (r) { return r.s.total > 0; });
    rows.sort(function (a, b) {
      if (a.rate === null && b.rate === null) return 0;
      if (a.rate === null) return 1;
      if (b.rate === null) return -1;
      return a.rate - b.rate;
    });

    h += '<div class="rd-stats"><span class="stat-pill dark">' + rvDrill.right + ' / ' +
      rvDrill.asked + '</span>' +
      (rvDrill.asked
        ? '<span class="stat-pill ' + (rvDrill.right / rvDrill.asked >= 0.7 ? 'b' : 'a') + '">' +
          Math.round(100 * rvDrill.right / rvDrill.asked) + '%</span>'
        : '') +
      '<span class="stat-pill a">' + attempted.length + ' of ' + RV_TOPICS.length +
      ' areas touched</span></div>';

    h += '<div class="rv-board">';
    rows.forEach(function (r) {
      var pct = r.rate === null ? 0 : Math.round(100 * r.rate);
      h += '<div class="rv-bar-row">' +
        '<span class="rv-bar-lab">' + esc(r.t.label) + '<em>' + r.t.topic + '</em></span>' +
        '<span class="rv-bar-track"><span class="rv-bar-fill ' +
          (r.rate === null ? 'none' : pct >= 70 ? 'good' : pct >= 40 ? 'mid' : 'poor') +
          '" style="width:' + (r.rate === null ? 0 : Math.max(3, pct)) + '%"></span></span>' +
        '<span class="rv-bar-n">' + (r.s.total ? r.s.right + '/' + r.s.total : '—') + '</span>' +
        '</div>';
    });
    h += '</div>';

    if (attempted.length >= 3) {
      var worst = rows.filter(function (r) { return r.rate !== null; })[0];
      var untouched = rows.filter(function (r) { return r.rate === null; });
      h += '<div class="rv-advice">Weakest so far: <strong>' + esc(worst.t.label) + '</strong> (' +
        worst.t.topic + '), at ' + worst.s.right + ' of ' + worst.s.total + '.' +
        (untouched.length
          ? ' Not yet tested: ' + untouched.map(function (r) { return esc(r.t.label); }).join(', ') + '.'
          : '') +
        ' Questions are drawn more often from whatever is going worst, so the shape of this ' +
        'board changes as you fix things.</div>';
    }

    if (rvDrill.nudge) {
      h += '<div class="verdict warn">' + esc(rvDrill.nudge) + '</div>';
      rvDrill.nudge = null;
    }

    var q = rvDrill.cur;
    if (!q) {
      h += '<div class="quiz-prompt"><div class="qp-topic">ready</div>' +
        'Press <strong>New question</strong>. Questions come from Topics 1 to 5 only — the ' +
        'material this revision week covers.</div>';
      out.innerHTML = h;
      return;
    }

    h += '<div class="quiz-prompt"><div class="qp-topic">' + esc(q.topic) + '</div>' +
      q.prompt + '</div>';

    if (q.kind === 'choice') {
      h += '<div class="quiz-choices">';
      q.choices.forEach(function (c, i) {
        var cls = 'quiz-choice';
        if (rvDrill.answered) {
          if (String(c) === String(q.answer)) cls += ' right';
          else if (String(c) === String(q.given)) cls += ' wrong';
        }
        h += '<button class="' + cls + '" onclick="rvChoose(' + i + ')"' +
          (rvDrill.answered ? ' disabled' : '') + '>' + c + '</button>';
      });
      h += '</div>';
    } else {
      h += '<div class="quiz-answer"><input type="text" id="rv-answer" ' +
        'placeholder="' + esc(q.placeholder || 'your answer') + '" ' +
        'onkeydown="if(event.key===\'Enter\'){rvSubmitText();}"' +
        (rvDrill.answered ? ' disabled value="' + esc(q.given || '') + '"' : '') + '>' +
        '<button class="tool-btn" onclick="rvSubmitText()"' +
        (rvDrill.answered ? ' disabled' : '') + '>Check</button></div>';
    }

    if (rvDrill.answered) {
      var r = q.result || {};
      h += '<div class="verdict ' + (r.ok ? 'safe' : 'bad') + '">' +
        (r.ok ? 'Correct.' : (r.revealed ? 'Answer: ' : 'Not quite — the answer is ') +
          '<strong>' + q.answer + '</strong>' + (r.msg ? ' (' + r.msg + ')' : '')) + '</div>';
      if (q.explain) h += '<div class="quiz-explain">' + q.explain + '</div>';
    }

    out.innerHTML = h;
  }
