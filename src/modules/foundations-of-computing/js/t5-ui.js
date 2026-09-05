  /* ============================================================
     TOPIC 05 · rendering for the five SAT tools
     ============================================================ */

  function stRead(id, fallback) {
    var el = document.getElementById(id);
    return stParse((el ? el.value : fallback) || fallback);
  }

  function stBad(outId, p) {
    var out = document.getElementById(outId);
    if (out) out.innerHTML = '<div class="verdict bad">' + p.error + '</div>';
  }

  function stSummary(p) {
    return '<div class="rd-stats">' +
      '<span class="stat-pill a">' + p.nC + ' clauses</span>' +
      '<span class="stat-pill a">' + p.nV + ' variables</span>' +
      '<span class="stat-pill dark">widest clause: ' + p.widest + '</span>' +
      (p.widest <= 2 ? '<span class="stat-pill b">a 2SAT instance</span>' : '') +
      '</div>';
  }

  /* ---------- Tool 1 · greedy ---------- */

  function gdPreset(which) {
    var el = document.getElementById('gd-text');
    if (el) el.value = ST_PRESETS[which] || ST_PRESETS.greedy;
    runGreedy();
  }

  function runGreedy() {
    var out = document.getElementById('gd-output');
    if (!out) return;
    var p = stRead('gd-text', ST_PRESETS.greedy);
    if (!p.ok) return stBad('gd-output', p);

    var startStr = ((document.getElementById('gd-start') || {}).value || '').trim();
    var start = {};
    p.vars.forEach(function (v, i) {
      start[v] = /^[TtY1]/.test(startStr.charAt(i) || 'F');
    });

    var run = gdRun(p.clauses, p.vars, start);
    var truth = stBrute(p.clauses, p.vars);
    var land = gdLandscape(p.clauses, p.vars);
    var survey = gdSurvey(p.clauses, p.vars);

    var wrong = truth.sat && !run.verdict;
    var h = stSummary(p);

    h += '<div class="verdict ' + (wrong ? 'bad' : run.verdict ? 'safe' : 'warn') + '">' +
      'GREEDY-SAT returns <strong>' + (run.verdict ? 'True' : 'False') + '</strong> from this start, ' +
      'after ' + run.iterations + ' improving flip' + (run.iterations === 1 ? '' : 's') +
      ', ending on ' + stShowAsg(run.asg, p.vars) + ' with ' + run.score + '/' + p.nC + ' satisfied.' +
      '<br>The formula is really <strong>' + (truth.sat ? 'satisfiable' : 'unsatisfiable') + '</strong>' +
      (truth.sat ? ' — ' + truth.count + ' assignment' + (truth.count === 1 ? '' : 's') + ' work' +
                   (truth.count === 1 ? 's' : '') + ', e.g. ' + stShowAsg(truth.model, p.vars) : '') + '.' +
      (wrong
        ? '<br><strong>So greedy is wrong here.</strong> It stopped at a local maximum: no single ' +
          'flip improves the score, but a better assignment exists further away.'
        : run.verdict ? '' : '<br>Greedy returns False, and False happens to be right — but it ' +
          'did not prove anything. It stopped because it ran out of uphill moves.') +
      '</div>';

    h += '<div class="gr-trace" id="gd-trace">';
    run.steps.forEach(function (s, i) {
      var cls = s.done === 'sat' ? 'took' : s.done === 'stuck' ? 'skipped' : '';
      h += '<div class="gr-row ' + cls + '" data-step="' + i + '">' +
        '<span class="gr-n">' + s.n + '</span>' +
        '<span class="gr-at">' + p.vars.map(function (v) { return s.asg[v] ? 'T' : 'F'; }).join('') + '</span>' +
        '<span class="gr-w">' + s.score + '</span>' +
        '<span class="gr-queue">' +
          s.neighbours.map(function (nb) {
            return '<span class="gr-chip' + (nb.delta > 0 ? ' up' : nb.delta < 0 ? ' down' : '') + '">' +
              'flip ' + esc(nb.v) + ': ' + nb.score + '</span>';
          }).join('') +
        '</span>' +
        '<span class="gr-note">' + esc(s.note) + '</span></div>';
    });
    h += '</div>';

    if (land.ok) {
      h += '<h4 class="tool-sub">Every assignment, and what it scores</h4>';
      h += '<table class="results-table"><tr><th>' + p.vars.join(' ') + '</th><th>Score</th><th></th></tr>' +
        land.nodes.map(function (nd) {
          var tag = nd.score === p.nC ? '<strong>satisfies everything</strong>'
                  : nd.trap ? 'local maximum — greedy stops here and says False'
                  : '';
          return '<tr><td><code>' + p.vars.map(function (v) { return nd.asg[v] ? 'T' : 'F'; }).join(' ') +
            '</code></td><td>' + nd.score + ' / ' + p.nC + '</td><td>' + tag + '</td></tr>';
        }).join('') + '</table>';
    }

    if (survey.ok) {
      h += '<div class="verdict ' + (survey.wrong ? 'warn' : 'safe') + '">' +
        'Running greedy from <strong>every one of the ' + survey.starts + ' possible starting ' +
        'assignments</strong>: ' + survey.wins + ' find a solution, ' + survey.losses + ' get stuck.' +
        (survey.wrong
          ? ' Since the formula is satisfiable, that is a <strong>' +
            Math.round(100 * survey.wrong / survey.starts) + '% failure rate</strong> — greedy ' +
            'answers False on a satisfiable formula from ' + survey.wrong + ' of ' + survey.starts +
            ' starts. Polynomial time bought you nothing if the answer is wrong.'
          : ' The formula is unsatisfiable, so getting stuck is the only possible outcome.') +
        '</div>';
    }

    h += '<p class="tool-note">The lecture proves this algorithm runs in polynomial time and stops ' +
      'there. That proof is correct and it is not the whole story: an algorithm is only useful if it ' +
      'is <em>also right</em>. Greedy is <strong>sound but incomplete</strong> — when it says True it ' +
      'hands you an assignment you can check, but its False means only &ldquo;I got stuck&rdquo;. ' +
      'That is precisely the gap DPLL closes, and why the next section exists.</p>';

    out.innerHTML = h;
    ixTrace('gd', 'gd-output', { label: 'flip', reset: true });
  }

  /* ---------- Tool 2 · DPLL ---------- */

  function dpPreset(which) {
    var el = document.getElementById('dp-text');
    if (el) el.value = ST_PRESETS[which] || ST_PRESETS.unit;
    runDpll();
  }

  function runDpll() {
    var out = document.getElementById('dp-output');
    if (!out) return;
    var p = stRead('dp-text', ST_PRESETS.unit);
    if (!p.ok) return stBad('dp-output', p);

    var usePure = ((document.getElementById('dp-pure') || {}).value || 'on') === 'on';
    var useUnit = ((document.getElementById('dp-unit') || {}).value || 'on') === 'on';

    var run = dpSolve(p.clauses, p.vars, { pure: usePure, unit: useUnit });
    if (!run.ok) { out.innerHTML = '<div class="verdict bad">' + esc(run.error) + '</div>'; return; }
    var truth = stBrute(p.clauses, p.vars);
    var plain = dpSolve(p.clauses, p.vars, { pure: false, unit: false });

    var agrees = run.sat === truth.sat;
    var modelOk = !run.sat || stEval(p.clauses, run.model).all;

    var h = stSummary(p);
    h += '<div class="verdict ' + (agrees && modelOk ? 'safe' : 'bad') + '">' +
      'DPLL returns <strong>' + (run.sat ? 'True' : 'False') + '</strong>' +
      (run.sat ? ', with ' + stShowAsg(run.model, p.vars) : '') + '.<br>' +
      (agrees
        ? 'Exhaustive search over all ' + truth.searched + ' assignments agrees' +
          (run.sat ? ', and the model returned really does satisfy every clause ✓'
                   : ' — no assignment works ✓')
        : 'Exhaustive search DISAGREES — it says ' + (truth.sat ? 'satisfiable' : 'unsatisfiable') + ' ✗') +
      '</div>';

    h += '<div class="rd-stats">' +
      '<span class="stat-pill a">' + run.calls + ' calls</span>' +
      '<span class="stat-pill a">' + run.decisions + ' branches</span>' +
      '<span class="stat-pill a">' + run.conflicts + ' conflicts</span>' +
      (plain.ok ? '<span class="stat-pill dark">without the two rules: ' + plain.calls + ' calls</span>' : '') +
      '</div>';

    h += '<div class="gr-trace" id="dp-trace">';
    run.trace.forEach(function (nd, i) {
      var cls = nd.result === 'sat' ? 'took' : nd.result === 'conflict' ? 'skipped' : '';
      h += '<div class="gr-row ' + cls + '" data-step="' + i + '">' +
        '<span class="gr-n">' + nd.id + '</span>' +
        '<span class="gr-at" style="padding-left:' + (nd.depth * 12) + 'px;">' +
          esc(nd.why) + '</span>' +
        '<span class="gr-note">' +
          nd.rules.map(function (r) {
            return '<span class="dp-rule ' + r.kind + '">' +
              (r.kind === 'unit' ? 'unit' : 'pure') + '</span> ' + esc(r.note);
          }).join('<br>') +
          (nd.rules.length ? '<br>' : '') + esc(nd.note || '') +
        '</span></div>';
    });
    h += '</div>';

    if (plain.ok && (usePure || useUnit)) {
      h += '<p class="tool-note">With both rules switched off this same formula takes <strong>' +
        plain.calls + ' calls</strong> instead of ' + run.calls + '. That is what the two rules buy: ' +
        'they are not needed for correctness — plain branching is already complete — they are there ' +
        'to make the search stop sooner. Turn them off above and watch the trace grow.</p>';
    }

    h += '<div class="callout tip"><div class="callout-label">The two rules, kept apart</div>' +
      '<strong>Unit propagation</strong> assigns what <strong>MUST</strong> be assigned. A clause ' +
      'down to one literal leaves no choice, so the assignment is forced — and forced assignments ' +
      'can collide, which is how DPLL detects a dead branch.<br><br>' +
      '<strong>Pure literal elimination</strong> assigns what <strong>SHOULD</strong> be assigned. ' +
      'A literal appearing with only one sign anywhere can be made true for free: every clause ' +
      'holding it is satisfied and nothing is harmed. It can never cause a conflict.</div>';

    out.innerHTML = h;
    ixTrace('dp', 'dp-output', { label: 'call', reset: true });
  }

  /* ---------- Tool 3 · 2SAT ---------- */

  function twoPreset(which) {
    var el = document.getElementById('two-text');
    if (el) el.value = ST_PRESETS[which] || ST_PRESETS.twosat;
    runTwoSat();
  }

  function runTwoSat() {
    var out = document.getElementById('two-output');
    if (!out) return;
    var p = stRead('two-text', ST_PRESETS.twosat);
    if (!p.ok) return stBad('two-output', p);

    var r = tsSolve(p.clauses, p.vars);
    if (!r.ok) {
      out.innerHTML = stSummary(p) + '<div class="verdict bad">' + esc(r.error) + '</div>';
      return;
    }
    var truth = stBrute(p.clauses, p.vars);
    var g = tsImplication(p.clauses);

    var h = stSummary(p);
    h += '<div class="verdict ' + (r.sat === truth.sat ? 'safe' : 'bad') + '">' +
      '<strong>' + (r.sat ? 'Satisfiable' : 'Unsatisfiable') + '</strong>' +
      (r.sat ? ' — ' + stShowAsg(r.asg, p.vars) : '') + '<br>' +
      (r.sat
        ? (r.verified ? 'That assignment satisfies every clause ✓' : 'The assignment FAILS ✗')
        : esc(r.why)) +
      '<br>Exhaustive search agrees: ' + (truth.sat ? 'satisfiable' : 'unsatisfiable') +
      (r.sat === truth.sat ? ' ✓' : ' ✗') +
      '</div>';

    h += '<h4 class="tool-sub">Step 1 · every clause as two implications</h4>';
    h += '<table class="results-table"><tr><th>Clause</th><th>becomes</th></tr>' +
      p.clauses.map(function (c) {
        var pieces = g.impl.filter(function (x) { return x.clause === c; })
          .map(function (x) {
            return esc(x.from.replace('~', '¬')) + ' → ' + esc(x.to.replace('~', '¬'));
          });
        return '<tr><td>' + stShowClause(c) + '</td><td>' + pieces.join(' &nbsp;∧&nbsp; ') + '</td></tr>';
      }).join('') + '</table>';

    h += '<h4 class="tool-sub">Steps 2–4 · components of the implication graph</h4>';
    h += '<div class="gr-trace" id="two-trace">';
    r.components.forEach(function (c, i) {
      var clash = c.some(function (l) {
        return c.indexOf(l.charAt(0) === '¬' ? l.slice(1) : '¬' + l) >= 0;
      });
      h += '<div class="gr-row ' + (clash ? 'skipped' : 'took') + '" data-step="' + i + '">' +
        '<span class="gr-n">' + (i + 1) + '</span>' +
        '<span class="gr-queue">' + c.map(function (l) {
          return '<span class="gr-chip">' + esc(l) + '</span>';
        }).join('') + '</span>' +
        '<span class="gr-note">' + (clash
          ? 'contains a literal <strong>and</strong> its negation — this is what makes the ' +
            'formula unsatisfiable'
          : 'no literal appears here alongside its own negation') + '</span></div>';
    });
    h += '</div>';

    h += '<p class="tool-note">Everything above is polynomial: building the graph is linear in the ' +
      'number of clauses, and the components come from the same two-pass algorithm as Topic 4. ' +
      'That is the whole proof that <strong>2SAT is in P</strong> — no cleverness, just a problem ' +
      'whose structure happens to be a graph question in disguise.<br><br>' +
      'It does not extend. A three-literal clause is not an implication between two things, so ' +
      'there is no graph to build. If there were, 3SAT would be in P and P would equal NP.</p>';

    out.innerHTML = h;
    ixTrace('two', 'two-output', { label: 'component', reset: true });
  }

  /* ---------- Tool 4 · SAT to 3SAT ---------- */

  function runTo3() {
    var out = document.getElementById('r3-output');
    if (!out) return;
    var p = stRead('r3-text', ST_PRESETS.wide);
    if (!p.ok) return stBad('r3-output', p);

    var r = tsTo3(p.clauses, p.vars);
    var chk = tsTo3Check(p.clauses, p.vars);

    var h = stSummary(p);
    h += '<div class="verdict ' + (chk.ok && chk.agree ? 'safe' : chk.ok ? 'bad' : 'warn') + '">' +
      'Widest clause goes from <strong>' + p.widest + '</strong> to <strong>' + r.widest + '</strong>, ' +
      'using ' + r.added + ' fresh variable' + (r.added === 1 ? '' : 's') + ' and turning ' +
      p.nC + ' clauses into ' + r.clauses.length + '.' +
      (chk.ok
        ? '<br>Checked exhaustively: the original is ' + (chk.before ? 'satisfiable' : 'unsatisfiable') +
          ' and the result is ' + (chk.after ? 'satisfiable' : 'unsatisfiable') + ' — ' +
          (chk.agree ? 'the reduction preserves satisfiability ✓' : 'THEY DISAGREE ✗')
        : '<br>Too large to verify exhaustively, but the construction is the standard one.') +
      '</div>';

    h += '<div class="gr-trace" id="r3-trace">';
    h += '<div class="gr-row" data-step="0"><span class="gr-n">0</span>' +
      '<span class="gr-note">' + stShow(p.clauses) + '</span></div>';
    h += '<div class="gr-row took" data-step="1"><span class="gr-n">1</span>' +
      '<span class="gr-note">' + stShow(r.clauses) + '</span></div>';
    h += '</div>';

    if (r.log.length) {
      h += '<table class="results-table"><tr><th>Clause</th><th>What happened</th></tr>' +
        r.log.map(function (l) {
          return '<tr><td>' + stShowClause(l.from) + '</td><td>' + esc(l.note) + '</td></tr>';
        }).join('') + '</table>';
    } else {
      h += '<p class="tool-note">Nothing to do — every clause already had at most three literals.</p>';
    }

    h += '<p class="tool-note">The fresh variable is a hinge. In <code>(l₁ ∨ l₂ ∨ X)</code> and ' +
      '<code>(¬X ∨ l₃ ∨ l₄)</code>, if X is false the first clause must be satisfied by l₁ or l₂; ' +
      'if X is true the second must be satisfied by l₃ or l₄. Either way <em>something</em> from the ' +
      'original clause is true, and conversely any satisfying assignment for the original can be ' +
      'extended by choosing X appropriately. That two-way argument is what &ldquo;≤<sub>p</sub>&rdquo; ' +
      'demands — and note the direction: this shows SAT is no harder than 3SAT, so 3SAT inherits ' +
      'SAT&rsquo;s NP-hardness.</p>';

    out.innerHTML = h;
    ixTrace('r3', 'r3-output', { label: 'stage', reset: true });
  }

  function r3Preset(which) {
    var el = document.getElementById('r3-text');
    if (el) el.value = ST_PRESETS[which] || ST_PRESETS.wide;
    runTo3();
  }

  /* ---------- Tool 5 · Horn ---------- */

  function runHorn() {
    var out = document.getElementById('hn-out2');
    if (!out) return;
    var p = stRead('hn-text', ST_PRESETS.horn);
    if (!p.ok) return stBad('hn-out2', p);

    var cls = hnClassify(p.clauses);
    var h = stSummary(p);

    if (!cls.horn) {
      h += '<div class="verdict warn">Not a Horn formula. ' + esc(cls.why.join(' ')) +
        '<br>A Horn clause has <strong>at most one positive literal</strong>, which is what lets it ' +
        'be read as a rule with a single head.</div>';
      h += '<table class="results-table"><tr><th>Clause</th><th>Positive literals</th></tr>' +
        p.clauses.map(function (c) {
          var pos = c.filter(function (l) { return !l.neg; });
          return '<tr><td>' + stShowClause(c) + '</td><td>' + (pos.length
            ? pos.map(fmLitShow).join(', ') + (pos.length > 1 ? ' — too many' : '')
            : 'none — a goal clause') + '</td></tr>';
        }).join('') + '</table>';
      out.innerHTML = h;
      return;
    }

    var r = hnSolve(p.clauses);
    var truth = stBrute(p.clauses, p.vars);

    h += '<div class="verdict ' + (r.sat === truth.sat ? 'safe' : 'bad') + '">' +
      '<strong>' + (r.sat ? 'Satisfiable' : 'Unsatisfiable') + '</strong> — ' + esc(r.why) +
      '<br>Exhaustive search agrees: ' + (truth.sat ? 'satisfiable' : 'unsatisfiable') +
      (r.sat === truth.sat ? ' ✓' : ' ✗') + '</div>';

    h += '<h4 class="tool-sub">Every clause as a rule</h4>';
    h += '<table class="results-table"><tr><th>Clause</th><th>Rule form</th></tr>' +
      cls.rules.map(function (rr) {
        var form = rr.goal
          ? 'not all of ' + rr.body.join(' ∧ ') + '  (a goal)'
          : rr.body.length ? rr.body.join(' ∧ ') + ' → ' + rr.head : rr.head + '  (a fact)';
        return '<tr><td>' + stShowClause(rr.clause) + '</td><td><code>' + esc(form) + '</code></td></tr>';
      }).join('') + '</table>';

    h += '<div class="gr-trace" id="hn2-trace">';
    r.steps.forEach(function (s, i) {
      h += '<div class="gr-row took" data-step="' + i + '">' +
        '<span class="gr-n">' + (i + 1) + '</span>' +
        '<span class="gr-at">' + esc(s.head) + '</span>' +
        '<span class="gr-note">' + esc(s.note) + '</span></div>';
    });
    if (!r.steps.length) {
      h += '<div class="gr-row" data-step="0"><span class="gr-n">0</span>' +
        '<span class="gr-note">No facts to start from, so nothing is derived — ' +
        'setting everything false satisfies every rule vacuously.</span></div>';
    }
    h += '</div>';

    h += '<p class="tool-note">Forward chaining runs once through the rules and never backtracks, so ' +
      'it is linear. It works because a Horn formula has a <strong>unique minimal model</strong>: ' +
      'the set of atoms the rules force. Nothing else needs trying — if the minimal model breaks a ' +
      'goal clause, every larger model breaks it too.<br><br>' +
      'Horn and 2SAT are both in P for completely unrelated reasons — one is a graph question, the ' +
      'other a fixed point — which is why the lecture&rsquo;s Venn diagram draws them overlapping ' +
      'rather than nested.</p>';

    out.innerHTML = h;
    ixTrace('hn2', 'hn-out2', { label: 'rule', reset: true });
  }

  function hornPreset(which) {
    var el = document.getElementById('hn-text');
    if (el) el.value = ST_PRESETS[which] || ST_PRESETS.horn;
    runHorn();
  }
