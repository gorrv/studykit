  /* ============================================================
     TOPIC 05 · SAT solving: the shared clause core
     ------------------------------------------------------------
     A clause is an array of literals {v, neg}, matching what
     fmClauses in Topic 2 already produces, so the two topics speak
     the same language and the CLIQUE reduction and the SAT solvers
     can be pointed at the same formula.

     Everything below is deliberately kept separate from the
     solvers: satisfiability computed here by exhaustive search is
     what the solvers get checked against.
     ============================================================ */

  /** Read clauses, either as one CNF formula or one clause per line.
      Students type both, and refusing either is just friction. */
  function stParse(text) {
    var raw = String(text || '').trim();
    if (!raw) return { ok: false, error: 'No clauses. Try (P | ~Q) & (Q | R), or one clause per line.' };

    // Normalise the symbols people actually type.
    var s = raw
      .replace(/[¬!]/g, '~')
      .replace(/[∨]/g, '|')
      .replace(/[∧]/g, '&')
      .replace(/[→]/g, '->');

    // A single formula if it has explicit conjunction; otherwise one
    // clause per line, which is how the lecture writes its examples.
    if (/&/.test(s)) {
      var p = fmParse(s);
      if (!p.ok) return { ok: false, error: p.error };
      var c = fmClauses(p.ast);
      if (!c.ok) return { ok: false, error: c.error };
      return stFinish(c.clauses);
    }

    var lines = s.split(/\n+/).map(function (x) { return x.trim(); })
      .filter(function (x) { return x && x.charAt(0) !== '#'; });
    if (!lines.length) return { ok: false, error: 'No clauses found.' };

    var clauses = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^\(|\)$/g, '').trim();
      if (!line) continue;
      var parts = line.split(/\|/).map(function (x) { return x.trim(); });
      var cl = [];
      for (var j = 0; j < parts.length; j++) {
        var m = parts[j].match(/^(~*)\s*([A-Za-z][A-Za-z0-9_]*)$/);
        if (!m) {
          return { ok: false, error: 'Cannot read "' + esc(parts[j]) + '" as a literal. ' +
                   'A clause is literals separated by |, for example <code>P | ~Q | R</code>.' };
        }
        cl.push(fmLit(m[2], m[1].length % 2 === 1));
      }
      clauses.push(cl);
    }
    return stFinish(clauses);
  }

  function stFinish(clauses) {
    if (!clauses.length) return { ok: false, error: 'No clauses found.' };
    var vars = [];
    clauses.forEach(function (c) {
      c.forEach(function (l) { if (vars.indexOf(l.v) < 0) vars.push(l.v); });
    });
    vars.sort();
    var widest = clauses.reduce(function (m, c) { return Math.max(m, c.length); }, 0);
    return { ok: true, clauses: clauses, vars: vars, widest: widest,
             nC: clauses.length, nV: vars.length };
  }

  function stShowClause(c) {
    if (!c.length) return '□';          // the empty clause: unsatisfiable
    return '(' + c.map(fmLitShow).join(' ∨ ') + ')';
  }

  function stShow(clauses) {
    return clauses.map(stShowClause).join(' ∧ ');
  }

  /** Is this clause satisfied / falsified / still open, under a
      partial assignment? Partial is the point -- DPLL never has a
      total assignment until the very end. */
  function stClauseState(c, asg) {
    var open = 0;
    for (var i = 0; i < c.length; i++) {
      var val = asg[c[i].v];
      if (val === undefined) { open++; continue; }
      if (val !== c[i].neg) return 'sat';       // literal is true
    }
    return open ? 'open' : 'unsat';
  }

  function stEval(clauses, asg) {
    var sat = 0, unsat = 0, open = 0;
    clauses.forEach(function (c) {
      var st = stClauseState(c, asg);
      if (st === 'sat') sat++; else if (st === 'unsat') unsat++; else open++;
    });
    return { sat: sat, unsat: unsat, open: open, all: unsat === 0 && open === 0 };
  }

  /** The score the greedy algorithm maximises. */
  function stScore(clauses, asg) { return stEval(clauses, asg).sat; }

  /** Exhaustive search. Slow by design: this is the oracle that
      every solver here is checked against, so it must be as dumb
      and as obviously-correct as possible. */
  function stBrute(clauses, vars, wantAll) {
    if (vars.length > 20) return { ok: false, error: 'Too many variables to enumerate.' };
    var n = vars.length, total = 1 << n, models = [], first = null, count = 0;
    for (var mask = 0; mask < total; mask++) {
      var asg = {};
      for (var i = 0; i < n; i++) asg[vars[i]] = !!(mask & (1 << i));
      if (stEval(clauses, asg).all) {
        count++;
        if (!first) first = asg;
        if (wantAll) models.push(asg);
      }
    }
    return { ok: true, sat: count > 0, count: count, model: first,
             models: models, searched: total };
  }

  function stShowAsg(asg, vars) {
    return (vars || Object.keys(asg).sort()).map(function (v) {
      return v + ' := ' + (asg[v] === undefined ? '—' : asg[v] ? 'True' : 'False');
    }).join(',  ');
  }

  /** Simplify under a partial assignment: drop satisfied clauses,
      drop false literals from the rest. This is DPLL's step 3, and
      it is also just "what is left to do". */
  function stSimplify(clauses, asg) {
    var out = [];
    for (var i = 0; i < clauses.length; i++) {
      var c = clauses[i], keep = [], done = false;
      for (var j = 0; j < c.length; j++) {
        var val = asg[c[j].v];
        if (val === undefined) { keep.push(c[j]); continue; }
        if (val !== c[j].neg) { done = true; break; }   // clause satisfied
      }
      if (!done) out.push(keep);                        // may be empty = conflict
    }
    return out;
  }

  var ST_PRESETS = {
    greedy: '(P | Q)\n(P | R)\n(P | ~Q | R)\n(~P | ~Q)\n(~P | Q)\n(~P | ~R)\n(P | Q | ~R)',
    unit: '~Q\n(P | Q)\n(~P | ~R | S)\n(~P | Q | ~S)\n(~P | ~Q)\nR\n(Q | R | S)',
    pure: '(P | Q | ~S)\n(P | ~Q)\n(Q | R)\n(Q | ~R | ~S)',
    twosat: '(~P | Q)\n(~Q | R)\n(P | ~R)\n(R | Q)',
    twobad: '(P | Q)\n(P | ~Q)\n(~P | Q)\n(~P | ~Q)',
    horn: '(P)\n(~P | Q)\n(~P | ~Q | R)\n(~Q | S)\n(~S | ~R | T)',
    wide: '(P | ~Q | R | S)\n(Q | ~R | ~T)',
    unsat: '(P | Q)\n(P | ~Q)\n(~P | Q)\n(~P | ~Q)'
  };
