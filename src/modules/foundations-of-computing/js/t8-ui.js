  /* ============================================================
     TOPIC 08 · rendering for the five linear programming tools
     ============================================================ */

  function lpRead(id, fallback) {
    var el = document.getElementById(id);
    return lpParse((el ? el.value : fallback) || fallback);
  }

  function lpBad(outId, r) {
    var out = document.getElementById(outId);
    if (out) out.innerHTML = '<div class="verdict bad">' + r.error + '</div>';
  }

  function lpProgramHtml(lp) {
    var h = '<div class="lp-prog"><div class="lp-prog-line"><span class="lp-kw">' +
      (lp.dir === 'max' ? 'Maximise' : 'Minimise') + '</span> ' +
      lpTermsHtml(lp.obj, lp.vars) + '</div>';
    var first = true;
    lp.cons.forEach(function (c) {
      if (c.kind === 'nonneg') return;
      h += '<div class="lp-prog-line"><span class="lp-kw">' +
        (first ? 'Subject to' : '') + '</span> ' +
        lpTermsHtml(c.a, lp.vars) + ' &le; ' + frShow(c.b) +
        (c.kind === 'branch' ? ' <span class="lp-tag">branch</span>' : '') + '</div>';
      first = false;
    });
    h += '<div class="lp-prog-line"><span class="lp-kw"></span> ' +
      lp.vars.join(', ') + ' &ge; 0 <span class="lp-tag">implicit</span></div></div>';
    return h;
  }

  function lpTermsHtml(coefs, vars) {
    var parts = [];
    coefs.forEach(function (c, i) {
      if (frZero(c)) return;
      var s = frShow(c);
      var sign = s.charAt(0) === '-' ? ' − ' : (parts.length ? ' + ' : '');
      if (s.charAt(0) === '-') s = s.slice(1);
      parts.push(sign + (s === '1' ? '' : s) + vars[i]);
    });
    return '<span class="lp-terms">' + (parts.join('') || '0') + '</span>';
  }

  /* ---------- the feasible region, drawn ---------- */

  function lpDraw(lp, sol, opts) {
    opts = opts || {};
    if (lp.n !== 2) return '';
    var poly = lpPolygon(lp);
    if (!poly || !poly.ok) return '';

    var W = 400, H = 300, pad = 34;
    var xs = [0], ys = [0];
    (poly.ring || []).forEach(function (p) { xs.push(p.x); ys.push(p.y); });
    var xmax = Math.max.apply(null, xs) * 1.25 + 1;
    var ymax = Math.max.apply(null, ys) * 1.25 + 1;
    function px(x) { return pad + (x / xmax) * (W - 2 * pad); }
    function py(y) { return H - pad - (y / ymax) * (H - 2 * pad); }

    var s = '<svg class="lp-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="feasible region of a two-variable linear program">';

    // grid
    for (var gx = 0; gx <= Math.ceil(xmax); gx++) {
      s += '<line class="lp-grid" x1="' + px(gx) + '" y1="' + py(0) + '" x2="' + px(gx) + '" y2="' + pad + '"/>';
    }
    for (var gy = 0; gy <= Math.ceil(ymax); gy++) {
      s += '<line class="lp-grid" x1="' + px(0) + '" y1="' + py(gy) + '" x2="' + (W - pad) + '" y2="' + py(gy) + '"/>';
    }

    // constraint boundaries: a0 x + a1 y = b, clipped to the box
    lp.cons.forEach(function (c) {
      if (c.kind === 'nonneg') return;
      var a0 = frNum(c.a[0]), a1 = frNum(c.a[1]), b = frNum(c.b), pts = [];
      if (a1 !== 0) {
        pts.push([0, b / a1], [xmax, (b - a0 * xmax) / a1]);
      } else if (a0 !== 0) {
        pts.push([b / a0, 0], [b / a0, ymax]);
      } else return;
      s += '<line class="lp-line' + (c.kind === 'branch' ? ' branch' : '') + '" x1="' + px(pts[0][0]) +
           '" y1="' + py(pts[0][1]) + '" x2="' + px(pts[1][0]) + '" y2="' + py(pts[1][1]) + '"/>';
    });

    // the region
    if (poly.ring && poly.ring.length >= 3) {
      s += '<polygon class="lp-region" points="' +
        poly.ring.map(function (p) { return px(p.x) + ',' + py(p.y); }).join(' ') + '"/>';
    }

    // an objective contour through the optimum
    if (sol && sol.status === 'optimal' && opts.contour !== false) {
      var c0 = frNum(lp.obj[0]), c1 = frNum(lp.obj[1]);
      var v = frNum(sol.obj) - frNum(lp.objConst || fr(0));
      var q = [];
      if (c1 !== 0) q.push([0, v / c1], [xmax, (v - c0 * xmax) / c1]);
      else if (c0 !== 0) q.push([v / c0, 0], [v / c0, ymax]);
      if (q.length) {
        s += '<line class="lp-obj" x1="' + px(q[0][0]) + '" y1="' + py(q[0][1]) +
             '" x2="' + px(q[1][0]) + '" y2="' + py(q[1][1]) + '"/>';
      }
    }

    // axes
    s += '<line class="lp-axis" x1="' + px(0) + '" y1="' + py(0) + '" x2="' + (W - pad) + '" y2="' + py(0) + '"/>';
    s += '<line class="lp-axis" x1="' + px(0) + '" y1="' + py(0) + '" x2="' + px(0) + '" y2="' + pad + '"/>';
    s += '<text class="lp-axlab" x="' + (W - pad + 8) + '" y="' + (py(0) + 4) + '">' + esc(lp.vars[0]) + '</text>';
    s += '<text class="lp-axlab" x="' + (px(0) - 4) + '" y="' + (pad - 8) + '">' + esc(lp.vars[1]) + '</text>';

    // vertices
    (poly.ring || []).forEach(function (p) {
      var best = sol && sol.status === 'optimal' && sol.ties &&
        sol.ties.some(function (t) { return t.key === p.v.key; });
      s += '<circle class="lp-vert' + (best ? ' opt' : '') + '" cx="' + px(p.x) + '" cy="' + py(p.y) + '" r="' +
        (best ? 7 : 4.5) + '"/>';
      s += '<text class="lp-vlab' + (best ? ' opt' : '') + '" x="' + (px(p.x) + 9) + '" y="' + (py(p.y) - 7) + '">(' +
        frShow(p.v.x[0]) + ', ' + frShow(p.v.x[1]) + ')</text>';
    });

    return s + '</svg>';
  }

  /* ---------- Tool 1 · the feasible region ---------- */

  function lpPreset(which) {
    var el = document.getElementById('lr-text');
    if (el) el.value = LP_PRESETS[which] || LP_PRESETS.lecture;
    runFeasible();
  }

  function runFeasible() {
    var out = document.getElementById('lr-output');
    if (!out) return;
    var lp = lpRead('lr-text', LP_PRESETS.lecture);
    if (!lp.ok) return lpBad('lr-output', lp);

    var sol = lpSolveByVertices(lp);
    if (!sol.ok) return lpBad('lr-output', sol);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + lp.n + ' variable' + (lp.n === 1 ? '' : 's') + '</span>' +
      '<span class="stat-pill a">' + lp.userCount + ' constraint' + (lp.userCount === 1 ? '' : 's') + '</span>' +
      '<span class="stat-pill dark">' + (sol.systems || 0) + ' systems solved</span>' +
      '<span class="stat-pill ' + (sol.status === 'optimal' ? 'b' : 'warn') + '">' + sol.status + '</span>' +
      '</div>';

    h += lpProgramHtml(lp);

    if (sol.status === 'infeasible') {
      h += '<div class="verdict bad">The feasible region <strong>R</strong> is empty. No assignment ' +
        'satisfies every constraint at once, so the set of optimal solutions is empty too — one of the ' +
        'three outcomes the slide lists.</div>';
    } else if (sol.status === 'unbounded') {
      h += '<div class="verdict warn">The feasible region is <strong>unbounded in an improving ' +
        'direction</strong>: you can keep moving through it and the objective keeps rising, so there ' +
        'is no maximum to report. (Boxing the region in at ' + sol.probe.at + ' and then at ' +
        (sol.probe.at * 2) + ' moved the answer from ' + frShow(sol.probe.atSmall) + ' to ' +
        frShow(sol.probe.atBig) + ' — nothing was holding it in.)</div>';
    } else {
      h += '<div class="verdict safe">Optimum <strong>' +
        lp.vars.map(function (v, i) { return v + ' = ' + frShow(sol.x[i]); }).join(', ') +
        '</strong> giving <strong>' + (lp.dir === 'max' ? 'max' : 'min') + ' = ' + frShow(sol.obj) +
        '</strong>.<br>' + sol.note + '</div>';
    }

    h += lpDraw(lp, sol);

    if (sol.verts && sol.verts.length) {
      var ordered = sol.verts.slice().sort(function (a, b) {
        return (lp.dir === 'max' ? -1 : 1) * frCmp(a.obj, b.obj);
      });
      h += '<div class="lp-verts"><table class="lp-table"><tr><th>vertex</th>' +
        lp.vars.map(function (v) { return '<th>' + esc(v) + '</th>'; }).join('') +
        '<th>objective</th><th>tight constraints</th></tr>';
      ordered.forEach(function (v, i) {
        var best = frCmp(v.obj, sol.obj) === 0;
        h += '<tr class="' + (best ? 'lp-best' : '') + '"><td>' + (i + 1) + '</td>' +
          v.x.map(function (c) { return '<td>' + frShow(c) + '</td>'; }).join('') +
          '<td><strong>' + frShow(v.obj) + '</strong></td>' +
          '<td class="lp-tight">' + v.tight.map(function (t) {
            return esc(lp.cons[t].label);
          }).join(', ') + '</td></tr>';
      });
      h += '</table></div>';
      h += '<div class="lp-foot">Every vertex is where <strong>' + lp.n + '</strong> constraint ' +
        'boundaries meet — which is why exactly ' + lp.n + ' of them are tight in each row above. ' +
        'The optimum is always at a vertex, so in principle you could stop here; in practice there are ' +
        'C(m, n) candidates, and that is the number simplex exists to avoid.</div>';
    }

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · the simplex method ---------- */

  function spPreset(which) {
    var el = document.getElementById('sx-text');
    if (el) el.value = LP_PRESETS[which] || LP_PRESETS.lecture;
    runSimplex();
  }

  function spTableauHtml(run, rd, showQuo) {
    var labels = run.labels, n = run.n, m = run.m, W = n + m + 1;
    var h = '<table class="tb-table"><tr><th></th>';
    labels.forEach(function (l, j) {
      h += '<th class="' + (rd && rd.pc === j ? 'tb-col' : '') + '">' +
        (l.charAt(0) === 's' && l.length > 1 ? 's<sub>' + l.slice(1) + '</sub>' : esc(l)) + '</th>';
    });
    h += '<th class="tb-rhs">=</th>' + (showQuo ? '<th class="tb-quo">quotient</th>' : '') + '</tr>';

    for (var i = 0; i <= m; i++) {
      var isCost = i === m;
      var isPiv = rd && rd.pr === i;
      h += '<tr class="' + (isCost ? 'tb-cost' : '') + (isPiv ? ' tb-row' : '') + '">' +
        '<td class="tb-lab">' + (isCost ? 'C' : 'R' + (i + 1)) + '</td>';
      for (var j2 = 0; j2 <= W; j2++) {
        var cell = frShow(rd.T[i][j2]);
        var cls = '';
        if (rd.pc === j2) cls += ' tb-col';
        if (isPiv && rd.pc === j2) cls += ' tb-piv';
        if (j2 === W) cls += ' tb-rhs';
        h += '<td class="' + cls.trim() + '">' + cell + '</td>';
      }
      if (showQuo) {
        var q = rd.quo && !isCost ? rd.quo.rows[i] : null;
        h += '<td class="tb-quo">' + (q
          ? (q.q === null ? '—'
             : '<span class="' + (q.usable ? 'tb-ok' : 'tb-skip') + '">' + frShow(q.q) + '</span>' +
               (q.why ? '<span class="tb-why">' + esc(q.why) + '</span>' : ''))
          : '') + '</td>';
      }
      h += '</tr>';
    }
    return h + '</table>';
  }

  function runSimplex() {
    var out = document.getElementById('sx-output');
    if (!out) return;
    var lp = lpRead('sx-text', LP_PRESETS.lecture);
    if (!lp.ok) return lpBad('sx-output', lp);

    var rule = ((document.getElementById('sx-rule') || {}).value) || 'standard';
    var run = spRun(lp, { rule: rule });

    if (!run.ok) {
      var h0 = lpProgramHtml(lp) + '<div class="verdict bad">' + run.error + '</div>';
      var tp = spTwoPhase(lp);
      if (tp.ok) {
        h0 += '<div class="verdict">Solved anyway, by the phase-one method the slides do not give: ' +
          '<strong>' + (tp.status === 'optimal'
            ? lp.vars.map(function (v, i) { return v + ' = ' + frShow(tp.x[i]); }).join(', ') +
              '</strong>, objective <strong>' + frShow(tp.obj) + '</strong>' +
              ' (' + tp.artificials + ' artificial variable' + (tp.artificials === 1 ? '' : 's') +
              ', ' + tp.pivots + ' pivots).'
            : tp.status + '</strong>.') + '</div>';
      }
      out.innerHTML = h0;
      return;
    }

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + run.pivots + ' pivot' + (run.pivots === 1 ? '' : 's') + '</span>' +
      '<span class="stat-pill a">' + run.m + ' slack variables</span>' +
      '<span class="stat-pill dark">' + (rule === 'deck' ? 'the slide’s rule' : 'standard rule') + '</span>' +
      '<span class="stat-pill ' + (run.agrees ? 'b' : 'warn') + '">' +
        (run.agrees ? 'agrees with vertex enumeration' : 'DISAGREES with vertex enumeration') +
      '</span></div>';

    h += lpProgramHtml(lp);

    if (run.status === 'unbounded') {
      h += '<div class="verdict warn">Unbounded — a variable can grow without ever making a ' +
        'constraint binding.</div>';
    } else {
      var truth = run.truth;
      h += '<div class="verdict ' + (run.agrees ? 'safe' : 'bad') + '">' +
        'Simplex reads off <strong>' +
        lp.vars.map(function (v, i) { return v + ' = ' + frShow(run.x[i]); }).join(', ') +
        '</strong> with cost <strong>' + frShow(run.cost) + '</strong>' +
        (run.m ? ', and slacks ' + run.tab.labels.slice(run.n, run.n + run.m).map(function (l) {
          return l + ' = ' + frShow(run.read.vals[l]);
        }).join(', ') : '') + '.<br>' +
        (truth && truth.ok && truth.status === 'optimal'
          ? 'Enumerating the vertices of the region — a completely different method — gives <strong>' +
            frShow(truth.obj) + '</strong>. ' +
            (run.agrees ? 'They agree.' : '<strong>They do not agree, so one of them is wrong.</strong>')
          : '') +
        (run.pointFeasible === false
          ? '<br><strong>And the point simplex returned does not satisfy the constraints.</strong>'
          : '') +
        '</div>';
    }

    if (rule === 'deck' && run.lostFeasibility !== null) {
      h += '<div class="callout warn" style="margin:14px 0;"><div class="callout-label">' +
        'The tableau stopped being feasible at round ' + run.lostFeasibility + '</div>' +
        'A right-hand side went negative, which means the corner the tableau describes is outside ' +
        'the feasible region. That happens because the slide requires the row quotient to have a ' +
        '<em>positive</em> numerator, so a row whose right-hand side is exactly zero is skipped — and ' +
        'that is precisely the row that had to be chosen. The standard rule asks for a ' +
        '<em>non-negative</em> numerator and picks it.</div>';
    }

    // the rounds, as a player
    h += '<div class="tb-rounds" id="sx-trace">';
    run.rounds.forEach(function (rd, i) {
      h += '<div class="tb-round" data-step="' + i + '">' +
        '<div class="tb-cap"><span class="tb-n">' + (i === 0 ? 'initial tableau' : 'round ' + i) + '</span>' +
        (rd.pc !== undefined && rd.T
          ? '<span class="tb-detail">pivot column <strong>' + esc(run.labels[rd.pc]) +
            '</strong>, pivot row <strong>R' + (rd.pr + 1) + '</strong>, pivot value <strong>' +
            frShow(rd.pivot) + '</strong></span>'
          : '') +
        (rd.feasible === false ? '<span class="tb-warn">right-hand side went negative</span>' : '') +
        '</div>';
      if (rd.T) {
        h += spTableauHtml(run, rd, !!rd.quo);
        if (rd.ops) {
          h += '<div class="tb-ops">' + rd.ops.map(function (o) {
            return '<span class="tb-op">' + esc(o.text) + '</span>';
          }).join('') + '</div>';
        }
        h += '<div class="tb-read">' + run.labels.slice(0, run.n + run.m).map(function (l) {
          return '<span class="tb-val">' + (l.charAt(0) === 's' && l.length > 1
            ? 's<sub>' + l.slice(1) + '</sub>' : esc(l)) + ' = ' + frShow(rd.read.vals[l]) + '</span>';
        }).join('') + '<span class="tb-val cost">C = ' + frShow(rd.read.cost) + '</span></div>';
      }
      h += '<div class="tb-note">' + rd.note + '</div></div>';
    });
    h += '</div>';

    out.innerHTML = h;
    ixTrace('sx', 'sx-output', { label: 'round', reset: true });
  }

  /* ---------- Tool 3 · Klee and Minty ---------- */

  function runKlee() {
    var out = document.getElementById('km-output');
    if (!out) return;
    var n = parseInt((document.getElementById('km-n') || {}).value, 10);
    if (!(n >= 0)) n = 3;

    var h = '<table class="km-table"><tr><th>n</th><th>variables</th><th>pivots taken</th>' +
      '<th>2<sup>n+1</sup> − 1</th><th>optimum</th><th></th></tr>';
    var worst = Math.pow(2, n + 1) - 1, allMatch = true;

    for (var k = 0; k <= n; k++) {
      var km = spKleeMinty(k);
      var lp = lpParse(km.text);
      var run = spRun(lp, { cap: 2000, check: false });
      var match = run.ok && run.pivots === km.predicted;
      if (!match) allMatch = false;
      var w = Math.round(280 * (run.ok ? run.pivots : 0) / worst);
      h += '<tr><td>' + k + '</td><td>' + km.vars + '</td>' +
        '<td class="km-piv"><strong>' + (run.ok ? run.pivots : '—') + '</strong></td>' +
        '<td>' + km.predicted + '</td>' +
        '<td>' + km.optimum + '</td>' +
        '<td><span class="km-bar" style="width:' + Math.max(2, w) + 'px"></span></td></tr>';
    }
    h += '</table>';

    var last = spKleeMinty(n);
    h += '<div class="verdict ' + (allMatch ? 'safe' : 'bad') + '">' +
      (allMatch
        ? 'Every row matches: with the most-negative-coefficient rule, this program takes exactly ' +
          '<strong>2<sup>n+1</sup> − 1</strong> pivots. The feasible region is a cube that has been ' +
          'squashed so that the rule walks every one of its 2<sup>n+1</sup> vertices in turn — and the ' +
          'optimum, 5<sup>n+1</sup>, sits at the last one it visits.'
        : 'A row does not match the prediction.') + '</div>';

    h += '<div class="km-prog"><div class="km-cap">The program for n = ' + n + '</div><pre>' +
      esc(last.text) + '</pre></div>';

    h += '<div class="lp-foot">Nothing is wrong with the arithmetic here — every pivot is legal and ' +
      'the answer is right. What is exponential is the <em>route</em>. A different pivot rule reaches ' +
      'the same corner in one step on this program, which is why "does some pivot rule make simplex ' +
      'polynomial?" stayed open long after 1972. Khachiyan settled the underlying question in 1979 by ' +
      'a different method entirely: linear programming is in <strong>P</strong>, whatever simplex does.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · branch and bound ---------- */

  function bbPreset(which) {
    var el = document.getElementById('bb-text');
    if (!el) return;
    if (which === 'matching') {
      var m = ipMatching(IP_MATCHING_PRESET);
      el.value = m.text;
    } else {
      el.value = LP_PRESETS[which] || LP_PRESETS.lecture;
    }
    runBranch();
  }

  function runBranch() {
    var out = document.getElementById('bb-output');
    if (!out) return;
    var lp = lpRead('bb-text', LP_PRESETS.lecture);
    if (!lp.ok) return lpBad('bb-output', lp);

    var useBound = ((document.getElementById('bb-bound') || {}).value) === 'on';
    var bb = ipBranchBound(lp, { bound: useBound, cap: 400 });
    if (!bb.ok) return lpBad('bb-output', bb);

    var plain = ipBranchBound(lp, { bound: false, cap: 400 });
    var brute = ipBrute(lp);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + bb.explored + ' nodes</span>' +
      '<span class="stat-pill a">' + bb.pruned + ' pruned</span>' +
      '<span class="stat-pill dark">' + (useBound ? 'with bounding' : 'the slide’s pseudocode') + '</span>' +
      (bb.disagreements.length
        ? '<span class="stat-pill warn">engines disagree at ' + bb.disagreements.length + ' node(s)</span>'
        : '<span class="stat-pill b">relaxations cross-checked</span>') +
      '</div>';

    h += lpProgramHtml(lp);

    if (!bb.best) {
      h += '<div class="verdict bad">No integer point satisfies the constraints.</div>';
    } else {
      var agrees = brute.ok && brute.obj && frCmp(brute.obj, bb.obj) === 0;
      h += '<div class="verdict ' + (brute.ok ? (agrees ? 'safe' : 'bad') : '') + '">' +
        'Best integer solution: <strong>' +
        lp.vars.map(function (v, i) { return v + ' = ' + frShow(bb.x[i]); }).join(', ') +
        '</strong>, objective <strong>' + frShow(bb.obj) + '</strong>.<br>' +
        (brute.ok
          ? 'Checking every one of the ' + brute.searched + ' lattice points in a box round the ' +
            'region (' + brute.feasible + ' of them feasible) gives <strong>' + frShow(brute.obj) +
            '</strong>. ' + (agrees ? 'They agree.' : '<strong>They disagree.</strong>')
          : 'Too large to check exhaustively: ' + esc(brute.error)) +
        '</div>';
    }

    if (bb.nodes.length === 1 && bb.nodes[0].status === 'integral') {
      h += '<div class="callout tip" style="margin:14px 0;"><div class="callout-label">' +
        'No branching was needed</div>The relaxation came out integral on its own, so the integer ' +
        'program was solved by one linear program. That is not luck: for an assignment problem the ' +
        'constraint matrix is <strong>totally unimodular</strong>, which forces every vertex of the ' +
        'relaxation to have whole-number coordinates. It is why matching is in <strong>P</strong> ' +
        'while integer programming in general is <strong>NP</strong>-hard.</div>';
    }

    if (useBound) {
      h += '<div class="lp-foot">Without the bounding step — which is how the slide&rsquo;s pseudocode ' +
        'is written, since it explores both children unconditionally — this takes <strong>' +
        plain.explored + '</strong> nodes. With it, <strong>' + bb.explored + '</strong>.' +
        (plain.explored === bb.explored
          ? ' On a problem this small the saving is nothing, which is how the omission goes unnoticed.'
          : '') + '</div>';
    }

    h += '<div class="bb-tree" id="bb-trace">';
    bb.nodes.forEach(function (nd, i) {
      var cls = 'bb-node ' + nd.status;
      h += '<div class="' + cls + '" data-step="' + i + '" style="margin-left:' + (nd.depth * 22) + 'px">' +
        '<div class="bb-head"><span class="bb-id">' + nd.id + '</span>' +
        '<span class="bb-label">' + esc(nd.label) + '</span>' +
        '<span class="bb-status">' + nd.status + '</span>' +
        (nd.obj !== undefined && nd.obj
          ? '<span class="bb-obj">C = ' + frShow(nd.obj) + '</span>' : '') +
        '</div>' +
        (nd.x
          ? '<div class="bb-x">' + lp.vars.map(function (v, k) {
              var val = nd.x[k];
              return '<span class="bb-var' + (frInt(val) ? '' : ' frac') + '">' + esc(v) + ' = ' +
                frShow(val) + '</span>';
            }).join('') + '</div>'
          : '') +
        (nd.branchVar
          ? '<div class="bb-branch">' + esc(nd.branchVar) + ' = ' + frShow(nd.branchVal) +
            ' is not a whole number, so split on it: ' + esc(nd.branchVar) + ' &le; ' +
            frShow(frFloor(nd.branchVal)) + ' and ' + esc(nd.branchVar) + ' &ge; ' +
            frShow(frCeil(nd.branchVal)) + '.</div>'
          : '') +
        (nd.note ? '<div class="bb-note">' + nd.note + '</div>' : '') +
        (nd.error ? '<div class="bb-note">' + nd.error + '</div>' : '') +
        '</div>';
    });
    h += '</div>';

    out.innerHTML = h;
    ixTrace('bb', 'bb-output', { label: 'node', reset: true });
  }

  /* ---------- Tool 5 · SAT <=p IP ---------- */

  function satIpPreset(which) {
    var el = document.getElementById('si-text');
    var presets = {
      lecture: '(P | Q | ~R)\n(~P | Q | R)\n(~Q | S)',
      unsat: '(P)\n(~P)',
      tight: '(P | Q)\n(~P | Q)\n(P | ~Q)\n(~P | ~Q)'
    };
    if (el) el.value = presets[which] || presets.lecture;
    runSatIp();
  }

  function runSatIp() {
    var out = document.getElementById('si-output');
    if (!out) return;
    var el = document.getElementById('si-text');
    var f = stParse((el ? el.value : '') || '(P | Q | ~R)\n(~P | Q | R)\n(~Q | S)');
    if (!f.ok) return lpBad('si-output', f);

    var lits = f.clauses.map(function (c) {
      return c.map(function (l) { return (l.neg ? '~' : '') + l.v; });
    });
    var chk = ipCheckReduction(lits, f.vars);
    if (!chk.ok) return lpBad('si-output', chk);
    var red = chk.reduction;

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + f.vars.length + ' propositional variables</span>' +
      '<span class="stat-pill a">' + (f.vars.length * 2) + ' numerical variables</span>' +
      '<span class="stat-pill a">' + (f.clauses.length + f.vars.length * 2) + ' constraints</span>' +
      '<span class="stat-pill ' + (chk.agree ? 'b' : 'warn') + '">' +
        (chk.agree ? 'both routes agree' : 'routes disagree') + '</span></div>';

    h += '<div class="si-cols"><div class="si-col"><div class="si-cap">The formula</div>' +
      lits.map(function (c, i) {
        return '<div class="si-row">(' + c.map(function (l) {
          return l.charAt(0) === '~' ? '¬' + esc(l.slice(1)) : esc(l);
        }).join(' ∨ ') + ')</div>';
      }).join('') + '</div>';

    h += '<div class="si-col"><div class="si-cap">The integer program</div>' +
      red.clauseRows.map(function (r) { return '<div class="si-row">' + esc(r) + '</div>'; }).join('') +
      '</div></div>';

    h += '<div class="si-pairs"><div class="si-cap">One pair of constraints per variable</div>' +
      f.vars.map(function (v) {
        return '<div class="si-row">x<sub>' + esc(v) + '</sub> + x<sub>¬' + esc(v) + '</sub> ≤ 1' +
          '&nbsp;&nbsp;and&nbsp;&nbsp;x<sub>' + esc(v) + '</sub> + x<sub>¬' + esc(v) + '</sub> ≥ 1</div>';
      }).join('') +
      '<div class="si-why">Together these force x<sub>P</sub> + x<sub>¬P</sub> = 1. Since both are ' +
      'non-negative <em>integers</em>, exactly one of them is 1 — so the pair is doing the work that ' +
      'a declaration &ldquo;x ∈ {0,1}&rdquo; would do, using nothing but linear inequalities. Drop the ' +
      'integrality requirement and x<sub>P</sub> = x<sub>¬P</sub> = ½ satisfies everything, which is ' +
      'exactly why the <em>linear</em> relaxation is easy and the integer problem is not.</div></div>';

    h += '<div class="verdict ' + (chk.agree ? 'safe' : 'bad') + '">' + chk.note + '</div>';

    if (chk.ipWitness) {
      h += '<div class="si-model"><div class="si-cap">The integer solution, read back as an assignment</div>' +
        chk.ipWitness.map(function (w) {
          return '<span class="si-chip ' + (w.x ? 'on' : 'off') + '">x<sub>' + esc(w.v) + '</sub> = ' +
            w.x + ', x<sub>¬' + esc(w.v) + '</sub> = ' + w.xn + ' &nbsp;⇒&nbsp; ' + esc(w.v) + ' is ' +
            (w.x ? 'true' : 'false') + '</span>';
        }).join('') + '</div>';
    }

    h += '<div class="lp-foot">The reduction runs in polynomial time — two variables and two ' +
      'constraints per propositional variable, one constraint per clause — so <strong>SAT ≤<sub>p</sub> ' +
      'IP</strong>, and since SAT is <strong>NP</strong>-complete, integer programming is ' +
      '<strong>NP</strong>-hard. Note what is <em>not</em> claimed: NP-<em>hard</em>, not ' +
      'NP-<em>complete</em>. Membership of NP needs the extra argument that a solution can be written ' +
      'down in polynomial space, which is not obvious for integer programs in general.</div>';

    out.innerHTML = h;
  }
