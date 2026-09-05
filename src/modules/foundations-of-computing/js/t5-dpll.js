  /* ============================================================
     TOPIC 05 · DPLL: pure literal elimination and unit propagation
     ------------------------------------------------------------
     The two rules are easy to confuse, and the slides give the
     distinction in one line each, so it is worth keeping sharp:

       A UNIT clause has one literal left. Its value is FORCED --
       there is no other way to satisfy that clause. Unit
       propagation assigns literals that MUST be assigned, and it
       can produce a conflict.

       A PURE literal appears with only one polarity anywhere in
       the formula. Setting it true satisfies every clause it is in
       and hurts nothing. Pure literal elimination assigns literals
       that SHOULD be assigned, and it can never cause a conflict.

     Unit propagation preserves satisfiability exactly. Pure literal
     elimination preserves it too, but it can discard models -- it
     is safe for a yes/no answer, not for enumerating solutions.
     ============================================================ */

  /** Literals appearing with only one polarity in the live clauses. */
  function dpPure(clauses) {
    var pos = {}, neg = {}, out = [];
    clauses.forEach(function (c) {
      c.forEach(function (l) { (l.neg ? neg : pos)[l.v] = true; });
    });
    Object.keys(pos).forEach(function (v) { if (!neg[v]) out.push({ v: v, neg: false }); });
    Object.keys(neg).forEach(function (v) { if (!pos[v]) out.push({ v: v, neg: true }); });
    return out.sort(function (a, b) { return a.v < b.v ? -1 : a.v > b.v ? 1 : 0; });
  }

  /** Clauses with exactly one literal. */
  function dpUnits(clauses) {
    var out = [], seen = {};
    clauses.forEach(function (c) {
      if (c.length !== 1) return;
      var k = (c[0].neg ? '~' : '') + c[0].v;
      if (!seen[k]) { seen[k] = true; out.push(c[0]); }
    });
    return out;
  }

  /** Unit propagation to a fixed point, reporting a conflict when
      one literal and its negation are both forced. */
  function dpPropagate(clauses, asg) {
    var work = stSimplify(clauses, asg), applied = [], steps = [];
    var cur = {};
    Object.keys(asg).forEach(function (k) { cur[k] = asg[k]; });

    for (var guard = 0; guard < 500; guard++) {
      // The empty clause means every literal in it was falsified.
      var empty = work.filter(function (c) { return c.length === 0; });
      if (empty.length) {
        return { ok: true, conflict: true, asg: cur, clauses: work, applied: applied, steps: steps,
                 why: 'A clause has had every one of its literals falsified — the empty clause □. ' +
                      'Nothing can satisfy it, so this branch fails.' };
      }
      var units = dpUnits(work);
      if (!units.length) break;

      // Contradictory units in the same round: P and ~P both forced.
      for (var i = 0; i < units.length; i++) {
        for (var j = i + 1; j < units.length; j++) {
          if (units[i].v === units[j].v && units[i].neg !== units[j].neg) {
            return { ok: true, conflict: true, asg: cur, clauses: work, applied: applied, steps: steps,
                     why: 'Both ' + fmLitShow(units[i]) + ' and ' + fmLitShow(units[j]) +
                          ' are unit clauses, so ' + units[i].v + ' is forced both ways. Conflict.' };
          }
        }
      }

      // Apply the whole round at once, which is how the lecture
      // states the rule -- it reads off every unit clause it can see
      // and assigns them all before simplifying again.
      var bad = null;
      for (var k = 0; k < units.length; k++) {
        var u = units[k];
        if (cur[u.v] !== undefined && cur[u.v] === u.neg) { bad = u; break; }
        cur[u.v] = !u.neg;
        applied.push(u);
      }
      if (bad) {
        return { ok: true, conflict: true, asg: cur, clauses: work, applied: applied, steps: steps,
                 why: 'Unit clause ' + fmLitShow(bad) + ' contradicts the current assignment.' };
      }
      var before = work.length;
      work = stSimplify(clauses, cur);
      steps.push({ lits: units.slice(), before: before, after: work.length,
                   note: units.map(fmLitShow).join(' and ') +
                         (units.length === 1 ? ' is a unit clause, so ' : ' are unit clauses, so ') +
                         units.map(function (x) {
                           return x.v + ' := ' + (!x.neg ? 'True' : 'False');
                         }).join(' and ') + ' ' +
                         (units.length === 1 ? 'is' : 'are') + ' forced. ' +
                         (before - work.length) + ' clause' + (before - work.length === 1 ? '' : 's') +
                         ' satisfied and removed.' });
    }

    return { ok: true, conflict: false, asg: cur, clauses: work, applied: applied, steps: steps };
  }

  /** Pure literal elimination to a fixed point. Never conflicts. */
  function dpPureEliminate(clauses, asg) {
    var work = stSimplify(clauses, asg), applied = [], steps = [];
    var cur = {};
    Object.keys(asg).forEach(function (k) { cur[k] = asg[k]; });

    for (var guard = 0; guard < 500; guard++) {
      var pures = dpPure(work);
      if (!pures.length) break;
      pures.forEach(function (l) {
        if (cur[l.v] !== undefined) return;
        cur[l.v] = !l.neg;
        applied.push(l);
      });
      var before = work.length;
      work = stSimplify(clauses, cur);
      steps.push({ lits: pures.slice(), before: before, after: work.length,
                   note: pures.map(fmLitShow).join(', ') +
                         (pures.length === 1 ? ' is pure' : ' are pure') +
                         ' — ' + (pures.length === 1 ? 'it appears' : 'they appear') +
                         ' with only one sign anywhere — so setting ' +
                         pures.map(function (l) { return l.v + ' := ' + (!l.neg ? 'True' : 'False'); }).join(', ') +
                         ' can only help. ' + (before - work.length) + ' clauses removed.' });
      if (work.length === before) break;
    }
    return { ok: true, conflict: false, asg: cur, clauses: work, applied: applied, steps: steps };
  }

  /** DPLL as the lecture writes it, recording a full trace so the
      search tree can be drawn. `usePure` and `useUnit` are switches
      so the tool can show what each rule is actually buying. */
  function dpSolve(clauses, vars, opts) {
    opts = opts || {};
    var usePure = opts.pure !== false, useUnit = opts.unit !== false;
    var trace = [], calls = 0, decisions = 0, conflicts = 0;
    var cap = opts.cap || 4000;
    var blown = false;

    function go(asg, depth, why) {
      if (calls > cap) { blown = true; return false; }
      calls++;
      var node = { id: calls, depth: depth, why: why, asg: gdCopy(asg), rules: [] };
      trace.push(node);

      var cur = gdCopy(asg);
      var work = stSimplify(clauses, cur);

      // A falsified clause is a conflict, whatever produced it.
      if (work.some(function (c) { return c.length === 0; })) {
        conflicts++; node.result = 'conflict';
        node.note = 'A clause is falsified — the empty clause. Backtrack.';
        return false;
      }

      if (useUnit) {
        var up = dpPropagate(clauses, cur);
        up.steps.forEach(function (s) { node.rules.push({ kind: 'unit', note: s.note }); });
        if (up.conflict) {
          conflicts++; node.result = 'conflict'; node.note = up.why;
          return false;
        }
        cur = up.asg; work = up.clauses;
      }

      if (usePure) {
        var pe = dpPureEliminate(clauses, cur);
        pe.steps.forEach(function (s) { node.rules.push({ kind: 'pure', note: s.note }); });
        cur = pe.asg; work = pe.clauses;
      }

      if (!work.length) {
        node.result = 'sat'; node.model = gdCopy(cur);
        node.note = 'No clauses left — everything is satisfied.';
        return { asg: cur };
      }
      if (work.some(function (c) { return c.length === 0; })) {
        conflicts++; node.result = 'conflict';
        node.note = 'A clause is falsified — the empty clause. Backtrack.';
        return false;
      }

      // Branch on the alphabetically first unassigned variable that
      // still appears, so the trace is reproducible.
      var pick = null;
      for (var i = 0; i < vars.length && !pick; i++) {
        if (cur[vars[i]] === undefined &&
            work.some(function (c) { return c.some(function (l) { return l.v === vars[i]; }); })) {
          pick = vars[i];
        }
      }
      if (!pick) {
        // Nothing left to branch on but clauses remain: unsatisfiable here.
        node.result = 'conflict';
        node.note = 'Clauses remain but no variable in them is unassigned. Backtrack.';
        conflicts++;
        return false;
      }

      node.branch = pick;
      node.result = 'branch';
      node.note = 'Branch on ' + pick + '. Try False first, as the lecture does.';
      decisions++;

      // False first, matching the deck's step 5 then step 6.
      var a = gdCopy(cur); a[pick] = false;
      var r = go(a, depth + 1, pick + ' := False');
      if (r) return r;

      var b = gdCopy(cur); b[pick] = true;
      r = go(b, depth + 1, pick + ' := True');
      if (r) return r;

      return false;
    }

    var res = go({}, 0, 'start');
    if (blown) {
      return { ok: false, error: 'The search grew past ' + cap + ' calls. Try a smaller formula.' };
    }

    // Fill in any variable the search never needed to decide.
    var model = null;
    if (res) {
      model = gdCopy(res.asg);
      vars.forEach(function (v) { if (model[v] === undefined) model[v] = false; });
    }

    return { ok: true, sat: !!res, model: model, trace: trace,
             calls: calls, decisions: decisions, conflicts: conflicts };
  }
