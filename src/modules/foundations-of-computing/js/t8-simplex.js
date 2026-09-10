  /* ============================================================
     TOPIC 08 · the simplex method, step by step
     ------------------------------------------------------------
     The standard treatment states seven steps. They are implemented here
     literally, including the parts that are wrong, because seeing
     the wrong rule fail is the fastest way to remember the right
     one:

       Step 4 says "the row with the smallest row quotient where
       BOTH the numerator and denominator are positive". The
       standard rule needs numerator >= 0, not > 0. On a degenerate
       tableau — one with a zero on the right-hand side — the
       printed rule skips the row it must pick and the next
       tableau is no longer feasible. spRun(lp, {rule:'printed'})
       reproduces that; the default is the standard rule.

     Everything the method produces is checked against t8-lp.js,
     which finds the optimum by enumerating vertices and shares no
     code with any of this.
     ============================================================ */

  /**
     Build the initial tableau from the slack form.

     Columns are  x1..xn | s1..sm | C | rhs.

     The method only starts if every constraint is <= with a
     non-negative right-hand side: that is what makes "all slacks
     basic, all variables zero" a feasible corner to start from. A
     >= row, or a negative right-hand side, needs a phase-one
     method the standard treatment never gives — which matters later, because
     branch-and-bound creates exactly those rows.
  */
  function spBuild(lp) {
    if (!lp.ok) return lp;

    // Every row EXCEPT the implicit x >= 0 ones becomes a slack row.
    // Selecting only kind === 'user' here would quietly drop the rows
    // that branch-and-bound adds and then solve a different program
    // from the one it was handed.
    var user = lp.cons.filter(function (c) { return c.kind !== 'nonneg'; });
    var bad = user.filter(function (c) { return frCmp(c.b, fr(0)) < 0; });
    if (bad.length) {
      return { ok: false, needsPhaseOne: true,
        error: 'The constraint <code>' + esc(bad[0].src) + '</code> has a negative right-hand side ' +
          'once it is written as a &le; row. Setting every variable to zero then breaks it, so ' +
          '&ldquo;all slack variables basic&rdquo; is not a feasible starting corner and the ' +
          'usual tableau cannot be built. Getting started needs a phase-one method, which ' +
          'is usually left out.' };
    }
    if (!user.length) return { ok: false, error: 'No constraints to make slack variables from.' };

    var n = lp.n, m = user.length;
    var maximise = lp.dir === 'max';
    var rows = [];

    for (var i = 0; i < m; i++) {
      var row = [];
      for (var j = 0; j < n; j++) row.push(user[i].a[j]);
      for (var s = 0; s < m; s++) row.push(fr(s === i ? 1 : 0));
      row.push(fr(0));                 // C
      row.push(user[i].b);             // rhs
      rows.push(row);
    }

    // Cost row: C - (objective) = 0, i.e. the objective coefficients negated.
    // A minimisation is run as a maximisation of the negated objective;
    // the reported cost is negated back at the end.
    var cost = [];
    for (var j2 = 0; j2 < n; j2++) cost.push(maximise ? frNeg(lp.obj[j2]) : lp.obj[j2]);
    for (var s2 = 0; s2 < m; s2++) cost.push(fr(0));
    cost.push(fr(1));
    cost.push(fr(0));
    rows.push(cost);

    var labels = lp.vars.slice();
    for (var k = 1; k <= m; k++) labels.push('s' + k);
    labels.push('C');

    return {
      ok: true, T: rows, n: n, m: m, labels: labels, lp: lp,
      maximise: maximise, negated: !maximise,
      srcRows: user.map(function (c) { return c.src; })
    };
  }

  /* ---------- one round ---------- */

  /** Step 2: the column with the most negative coefficient in the final row. */
  function spPivotColumn(tab) {
    var last = tab.T[tab.m], best = -1;
    for (var j = 0; j < tab.n + tab.m; j++) {
      if (frCmp(last[j], fr(0)) < 0 && (best < 0 || frCmp(last[j], last[best]) < 0)) best = j;
    }
    return best;
  }

  /** Steps 3 and 4: the row quotients, and which row wins. */
  function spQuotients(tab, pc, rule) {
    var out = [], W = tab.n + tab.m + 1;
    for (var i = 0; i < tab.m; i++) {
      var den = tab.T[i][pc], num = tab.T[i][W];
      var q = frZero(den) ? null : frDiv(num, den);
      var denPos = frCmp(den, fr(0)) > 0;
      var numPos = frCmp(num, fr(0)) > 0;
      var numNonNeg = frCmp(num, fr(0)) >= 0;
      out.push({
        i: i, num: num, den: den, q: q,
        // the printed rule vs the standard one
        usableDeck: denPos && numPos,
        usable: denPos && numNonNeg,
        why: !denPos
          ? 'denominator not positive — increasing this variable never makes this row binding'
          : (!numNonNeg ? 'right-hand side negative' : (!numPos ? 'right-hand side is zero (degenerate)' : ''))
      });
    }
    var key = rule === 'printed' ? 'usableDeck' : 'usable';
    var pick = -1;
    out.forEach(function (r) {
      if (!r[key]) return;
      if (pick < 0 || frCmp(r.q, out[pick].q) < 0) pick = r.i;
    });
    return { rows: out, pick: pick,
      degenerateSkipped: out.some(function (r) { return r.usable && !r.usableDeck; }) };
  }

  /** Step 5: scale the pivot row, clear the column everywhere else. */
  function spPivot(tab, pr, pc) {
    var W = tab.n + tab.m + 2, old = tab.T.map(function (r) { return r.slice(); });
    var piv = old[pr][pc], ops = [];
    var T = [];
    for (var i = 0; i <= tab.m; i++) {
      if (i === pr) {
        T.push(old[i].map(function (v) { return frDiv(v, piv); }));
        ops.push({ i: i, kind: 'scale', factor: frDiv(fr(1), piv),
          text: 'R' + (i + 1) + ' ← (1/' + frShow(piv) + ') × R' + (pr + 1) });
      } else {
        var f = frDiv(old[i][pc], piv);
        var row = [];
        for (var k = 0; k < W; k++) row.push(frSub(old[i][k], frMul(f, old[pr][k])));
        T.push(row);
        ops.push({ i: i, kind: 'clear', factor: f,
          text: 'R' + (i + 1) + ' ← R' + (i + 1) + ' − (' + frShow(old[i][pc]) + '/' +
                frShow(piv) + ') × R' + (pr + 1) });
      }
    }
    return { T: T, ops: ops, pivot: piv };
  }

  /**
     Read the solution off a tableau. A variable is basic when its
     column is zero everywhere except a single 1; it then takes the
     right-hand side of that row. Every other variable is zero.
  */
  function spRead(tab) {
    var W = tab.n + tab.m + 1, vals = {}, basis = [], usedRow = {};
    for (var j = 0; j < tab.n + tab.m + 1; j++) {
      var ones = [], nonzero = 0;
      for (var i = 0; i <= tab.m; i++) {
        if (!frZero(tab.T[i][j])) {
          nonzero++;
          if (frCmp(tab.T[i][j], fr(1)) === 0) ones.push(i);
        }
      }
      /* Each basic variable owns ONE row, and a row has ONE basic variable.
         Checking only "is this a unit column" misses that: on

             x + y + 0.25 s2 = 1.5

         the x and y columns are identical unit columns, so both were being
         read as basic and both took the row's right-hand side, giving
         x = y = 1.5 for a program whose constraint is x + y <= 1.5. The
         cost came out right, which is why this survived until an audit
         checked the POINT rather than the value. Claim rows in order; a
         column whose row is already spoken for is non-basic and zero. */
      if (nonzero === 1 && ones.length === 1 && !usedRow[ones[0]]) {
        usedRow[ones[0]] = true;
        vals[tab.labels[j]] = tab.T[ones[0]][W];
        basis.push({ j: j, row: ones[0], name: tab.labels[j] });
      } else {
        vals[tab.labels[j]] = fr(0);
      }
    }
    var x = tab.lp.vars.map(function (v) { return vals[v] || fr(0); });
    var C = vals['C'] || fr(0);
    return { vals: vals, basis: basis, x: x,
             cost: tab.negated ? frNeg(C) : C, rawCost: C };
  }

  /** Is every right-hand side still non-negative? (Is the corner still real?) */
  function spFeasibleTableau(tab) {
    var W = tab.n + tab.m + 1, bad = [];
    for (var i = 0; i < tab.m; i++) if (frCmp(tab.T[i][W], fr(0)) < 0) bad.push(i);
    return { ok: !bad.length, rows: bad };
  }

  /* ---------- the whole method ---------- */

  function spRun(lp, opts) {
    opts = opts || {};
    var rule = opts.rule === 'printed' ? 'printed' : 'standard';
    var cap = opts.cap || 60;

    var tab = spBuild(lp);
    if (!tab.ok) return tab;

    var rounds = [{ n: 0, T: tab.T.map(function (r) { return r.slice(); }),
                    read: spRead(tab), note: 'The initial tableau: every variable zero, every slack ' +
                    'variable holding the whole of its constraint. That is the corner at the origin.' }];

    var status = 'optimal', guard = 0, lostFeasibility = null;

    while (guard++ < cap) {
      var pc = spPivotColumn(tab);
      if (pc < 0) { status = 'optimal'; break; }

      var quo = spQuotients(tab, pc, rule);
      if (quo.pick < 0) {
        status = 'unbounded';
        rounds.push({ n: rounds.length, unbounded: true, pc: pc, quo: quo,
          note: 'No row has a positive entry in the ' + tab.labels[pc] + ' column with a usable ' +
                'right-hand side, so ' + tab.labels[pc] + ' can grow for ever without breaking a ' +
                'constraint. The objective is unbounded.' });
        break;
      }

      var done = spPivot(tab, quo.pick, pc);
      tab.T = done.T;
      var feas = spFeasibleTableau(tab);
      if (!feas.ok && !lostFeasibility) lostFeasibility = rounds.length;

      rounds.push({
        n: rounds.length, pc: pc, pr: quo.pick, pivot: done.pivot,
        quo: quo, ops: done.ops,
        T: tab.T.map(function (r) { return r.slice(); }),
        read: spRead(tab),
        feasible: feas.ok, badRows: feas.rows,
        degenerateSkipped: quo.degenerateSkipped,
        note: 'Pivot on ' + tab.labels[pc] + ' in R' + (quo.pick + 1) +
              ' (value ' + frShow(done.pivot) + '). ' + tab.labels[pc] + ' enters the basis.'
      });
    }
    if (guard >= cap && status === 'optimal') status = 'capped';

    var read = spRead(tab);
    var out = {
      ok: true, status: status, rule: rule, tab: tab, rounds: rounds,
      pivots: rounds.length - 1, labels: tab.labels, n: tab.n, m: tab.m,
      x: read.x, cost: read.cost, read: read,
      lostFeasibility: lostFeasibility,
      finalFeasible: spFeasibleTableau(tab).ok
    };

    // The independent check: does the vertex enumerator agree?
    if (opts.check !== false) {
      var truth = lpSolveByVertices(lp);
      out.truth = truth;
      if (truth.ok && truth.status === 'optimal' && status === 'optimal') {
        out.agrees = frCmp(out.cost, truth.obj) === 0;
        out.pointFeasible = lpCheck(lp, out.x).feasible;
      } else if (truth.ok) {
        out.agrees = (truth.status === status) ||
                     (truth.status === 'unbounded' && status === 'unbounded');
        out.pointFeasible = null;
      }
    }
    return out;
  }

  /* ============================================================
     The phase-one method the usual write-up leaves out
     ------------------------------------------------------------
     spRun above is the standard method and, correctly, refuses to
     start when a constraint has a negative right-hand side. But
     the standard treatment needs exactly that case twice over — its own
     energy example has a ">= demand" row, and branch-and-bound
     adds "y >= 2" at the first branch — so something has to fill
     the gap.

     The standard fix: give every awkward row an artificial
     variable, spend a first phase driving the artificials to zero
     (which is a linear program with an obvious starting corner),
     and if that succeeds you have a real corner to start the
     genuine objective from. If it does not succeed, the region is
     empty. No pedagogy here, just machinery: this one returns an
     answer, not a tableau to read.
     ============================================================ */

  function spTwoPhase(lp, opts) {
    opts = opts || {};
    var cap = opts.cap || 4000;
    var rows = lp.cons.filter(function (c) { return c.kind !== 'nonneg'; });
    var n = lp.n, m = rows.length;
    if (!m) return { ok: false, error: 'No constraints.' };

    // a.x + s = b, flipped to keep b >= 0; flipped rows get an artificial.
    var flip = [], art = [];
    for (var i = 0; i < m; i++) flip.push(frCmp(rows[i].b, fr(0)) < 0);
    var nArt = flip.filter(Boolean).length;
    var W = n + m + nArt;           // columns, excluding the rhs

    var T = [], basis = [], a = 0;
    for (var i2 = 0; i2 < m; i2++) {
      var sgn = flip[i2] ? -1 : 1, row = [];
      for (var j = 0; j < n; j++) row.push(frMul(rows[i2].a[j], fr(sgn)));
      for (var s = 0; s < m; s++) row.push(fr(s === i2 ? sgn : 0));
      for (var k = 0; k < nArt; k++) row.push(fr(0));
      row.push(frMul(rows[i2].b, fr(sgn)));
      if (flip[i2]) { row[n + m + a] = fr(1); art.push(n + m + a); basis.push(n + m + a); a++; }
      else basis.push(n + i2);
      T.push(row);
    }

    function pivotAt(pr, pc) {
      var piv = T[pr][pc];
      T[pr] = T[pr].map(function (v) { return frDiv(v, piv); });
      for (var r = 0; r < T.length; r++) {
        if (r === pr || frZero(T[r][pc])) continue;
        var f = T[r][pc];
        for (var c = 0; c <= W; c++) T[r][c] = frSub(T[r][c], frMul(f, T[pr][c]));
      }
      basis[pr] = pc;
    }

    /* Bland's rule: lowest index in, lowest index out on ties. Slower
       than Dantzig's, and the only one that cannot cycle — which
       matters here because nobody is watching this run. */
    function solve(cost, allowed) {
      var guard = 0, pivots = 0;
      while (guard++ < cap) {
        var z = [], pc = -1;
        for (var c = 0; c < W; c++) {
          if (!allowed[c]) { z.push(fr(0)); continue; }
          var red = cost[c];
          for (var r = 0; r < m; r++) red = frSub(red, frMul(cost[basis[r]], T[r][c]));
          z.push(red);
          if (pc < 0 && frCmp(red, fr(0)) > 0) pc = c;
        }
        if (pc < 0) return { status: 'optimal', pivots: pivots };
        var pr = -1;
        for (var r2 = 0; r2 < m; r2++) {
          if (frCmp(T[r2][pc], fr(0)) <= 0) continue;
          var q = frDiv(T[r2][W], T[r2][pc]);
          if (pr < 0) { pr = r2; continue; }
          var qb = frDiv(T[pr][W], T[pr][pc]), d = frCmp(q, qb);
          if (d < 0 || (d === 0 && basis[r2] < basis[pr])) pr = r2;
        }
        if (pr < 0) return { status: 'unbounded', pivots: pivots };
        pivotAt(pr, pc); pivots++;
      }
      return { status: 'capped', pivots: pivots };
    }

    var allowAll = [], allowReal = [];
    for (var c2 = 0; c2 < W; c2++) {
      allowAll.push(true);
      allowReal.push(art.indexOf(c2) < 0);
    }

    var p1 = { status: 'optimal', pivots: 0 };
    if (nArt) {
      var c1 = [];
      for (var c3 = 0; c3 < W; c3++) c1.push(fr(art.indexOf(c3) >= 0 ? -1 : 0));
      p1 = solve(c1, allowAll);
      if (p1.status !== 'optimal') return { ok: false, error: 'Phase one did not terminate.' };
      var resid = fr(0);
      for (var r3 = 0; r3 < m; r3++) if (art.indexOf(basis[r3]) >= 0) resid = frAdd(resid, T[r3][W]);
      if (frCmp(resid, fr(0)) > 0) {
        return { ok: true, status: 'infeasible', phase1: p1,
                 note: 'Phase one cannot drive the artificial variables to zero, so no point ' +
                       'satisfies every constraint.' };
      }
      // Any artificial still basic sits at zero; pivot it out if we can.
      for (var r4 = 0; r4 < m; r4++) {
        if (art.indexOf(basis[r4]) < 0) continue;
        for (var c4 = 0; c4 < n + m; c4++) {
          if (!frZero(T[r4][c4])) { pivotAt(r4, c4); break; }
        }
      }
    }

    var sign = lp.dir === 'max' ? 1 : -1;
    var c2r = [];
    for (var c5 = 0; c5 < W; c5++) {
      c2r.push(c5 < n ? frMul(lp.obj[c5], fr(sign)) : fr(0));
    }
    var p2 = solve(c2r, allowReal);
    if (p2.status === 'unbounded') {
      return { ok: true, status: 'unbounded', phase1: p1, phase2: p2 };
    }
    if (p2.status !== 'optimal') return { ok: false, error: 'Phase two did not terminate.' };

    var x = [];
    for (var v = 0; v < n; v++) {
      var at = basis.indexOf(v);
      x.push(at < 0 ? fr(0) : T[at][W]);
    }
    var chk = lpCheck(lp, x);
    return {
      ok: true, status: 'optimal', x: x, obj: lpEval(lp, x),
      phase1: p1, phase2: p2, pivots: p1.pivots + p2.pivots,
      artificials: nArt, feasible: chk.feasible, broken: chk.broken
    };
  }

  /* ---------- Klee and Minty's cube ---------- */

  /**
     The standard worst case, verbatim:

       maximise   2^n x0 + 2^(n-1) x1 + ... + xn
       subject to 2 * sum_{j<i} 2^(i-j) xj + xi <= 5^(i+1)

     (The usual write-up writes x3 in the third constraint where it means
     x2.) With the most-negative-coefficient rule this takes
     2^(n+1) - 1 pivots on n+1 variables: the path visits every
     vertex of a squashed cube. The optimum is 5^(n+1), reached in
     one step by a different pivot rule — which is the point.
  */
  function spKleeMinty(n) {
    if (!(n >= 0) || n > 8) return { ok: false, error: 'Use 0 ≤ n ≤ 8 — the pivot count doubles each time.' };
    var k = n + 1, lines = [];
    var obj = [];
    for (var i = 0; i < k; i++) obj.push(Math.pow(2, n - i) + 'x' + i);
    lines.push('max ' + obj.join(' + '));
    for (var r = 0; r < k; r++) {
      var terms = [];
      for (var j = 0; j < r; j++) terms.push((2 * Math.pow(2, r - j)) + 'x' + j);
      terms.push('1x' + r);
      lines.push(terms.join(' + ') + ' <= ' + Math.pow(5, r + 1));
    }
    return { ok: true, text: lines.join('\n'), n: n, vars: k,
             predicted: Math.pow(2, n + 1) - 1, optimum: Math.pow(5, n + 1) };
  }
