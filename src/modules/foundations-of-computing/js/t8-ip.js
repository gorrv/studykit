  /* ============================================================
     TOPIC 08 · integer programming, branch-and-bound, SAT <=p IP
     ------------------------------------------------------------
     Two things worth knowing before reading the code.

     First, the relaxation at every node below the root is solved
     by vertex enumeration, not by simplex. That is forced, not
     lazy: branching adds a row like y >= 2, whose <= form has a
     negative right-hand side, so the all-slacks corner is not
     feasible and the standard tableau cannot even be started.
     The usual write-up says "solve the linear relaxation using the Simplex
     Method" and skips the part where you would need a phase-one
     method to do it.

     Second, the usual pseudocode is branch-and-*branch*.
     There is no bounding step anywhere in it: both children are
     always explored, whatever has already been found. Bounding is
     what makes the method worth its name, so it is here as a
     switch, and the tool reports how many nodes it saves.
     ============================================================ */

  /** A copy of an LP with one more constraint a.x <= b. */
  function lpWith(lp, a, b, label) {
    var cons = lp.cons.slice();
    // keep the implicit x >= 0 rows last, purely so displays read well
    var user = cons.filter(function (c) { return c.kind !== 'nonneg'; });
    var neg = cons.filter(function (c) { return c.kind === 'nonneg'; });
    user.push({ a: a, b: b, src: label, kind: 'branch', label: label });
    return {
      ok: true, vars: lp.vars, n: lp.n, idx: lp.idx, dir: lp.dir,
      obj: lp.obj, objConst: lp.objConst,
      cons: user.concat(neg), userCount: user.length, m: user.length + neg.length,
      text: lp.text + '\n' + label, branched: (lp.branched || []).concat([label])
    };
  }

  /** x_i <= floor(v)  and  x_i >= ceil(v), as the two children. */
  function ipSplit(lp, i, v) {
    var lo = frFloor(v), hi = frCeil(v);
    var aL = [], aR = [];
    for (var k = 0; k < lp.n; k++) { aL.push(fr(k === i ? 1 : 0)); aR.push(fr(k === i ? -1 : 0)); }
    return {
      left:  lpWith(lp, aL, lo, lp.vars[i] + ' <= ' + frStr(lo)),
      right: lpWith(lp, aR, frNeg(hi), lp.vars[i] + ' >= ' + frStr(hi)),
      lo: lo, hi: hi
    };
  }

  /**
     BRANCH-AND-BOUND, as usually written, with the bounding step
     available as an option.

     opts.bound   prune a node whose relaxation cannot beat the best
                  integer solution found so far (default false, to
                  match the usual write-up)
     opts.branchOn 'first' (the usual "choose a non-integer x_i")
                  or 'mostfrac'
     opts.cap     node limit
  */
  function ipBranchBound(lp, opts) {
    opts = opts || {};
    var cap = opts.cap || 200;
    var useBound = !!opts.bound;
    var mostFrac = opts.branchOn === 'mostfrac';
    var sign = lp.dir === 'max' ? 1 : -1;

    var nodes = [], best = null, pruned = 0, seq = 0, stuck = 0, disagreements = [];

    function betterThanBest(v) { return !best || sign * frCmp(v, best.obj) > 0; }

    /**
       Solve one node's relaxation. Phase-one simplex does the work,
       because vertex enumeration is C(m, n) and dies on anything
       with more than a handful of variables. When the node IS small
       enough, both are run and any disagreement is recorded rather
       than hidden — the fast engine is only trustworthy for as long
       as the slow one keeps agreeing with it.
    */
    function relax(sub, id) {
      var s = spTwoPhase(sub);
      if (!s.ok) return { ok: false, error: s.error };

      if (opts.verify !== false && sub.n <= 3 && sub.cons.length <= 12) {
        var v = lpSolveByVertices(sub, { noBoundCheck: true });
        if (v.ok) {
          var same = v.status === s.status &&
                     (s.status !== 'optimal' || frCmp(v.obj, s.obj) === 0);
          if (!same) {
            disagreements.push({ node: id, simplex: s.status + ':' +
              (s.obj ? frStr(s.obj) : '-'), vertices: v.status + ':' +
              (v.obj ? frStr(v.obj) : '-') });
          }
        }
      }
      return { ok: true, status: s.status, x: s.x, obj: s.obj, engine: s };
    }

    function visit(sub, depth, label, parent, parentX) {
      if (seq >= cap) return { status: 'capped' };
      var id = seq++;
      var rel = relax(sub, id);
      var node = { id: id, depth: depth, label: label, parent: parent, lp: sub,
                   branched: sub.branched || [] };
      nodes.push(node);

      if (!rel.ok) { node.status = 'error'; node.error = rel.error; return node; }

      /* A branch must exclude the fractional point that caused it: adding
         x <= floor(a) or x >= ceil(a) makes a itself infeasible. If a child
         hands back its parent's point anyway, the split is wrong and the
         recursion will never terminate — so say so here rather than
         discovering it as a hang. */
      if (parentX && rel.status === 'optimal' && lpKey(rel.x) === lpKey(parentX)) {
        node.status = 'stuck'; node.x = rel.x; node.obj = rel.obj;
        stuck++;
        node.note = 'This child returned the same point as its parent, so the branch excluded ' +
          'nothing and the recursion cannot make progress. That means the split is malformed — ' +
          'x ≤ ⌊a⌋ and x ≥ ⌈a⌉ must both rule out a itself.';
        return node;
      }
      if (rel.status === 'infeasible') {
        node.status = 'infeasible';
        node.note = 'No point at all satisfies these constraints, so this whole subtree is dead. ' +
          'The textbook pseudocode has no case for this.';
        return node;
      }
      if (rel.status === 'unbounded') {
        node.status = 'unbounded';
        node.note = 'The relaxation is unbounded, so branching here would never terminate.';
        return node;
      }

      node.status = 'relaxed';
      node.x = rel.x; node.obj = rel.obj; node.rel = rel;

      // Bounding: a relaxation is an upper bound on every integer
      // point below it, so if it cannot beat what we already have,
      // nothing below it can either.
      if (useBound && best && sign * frCmp(rel.obj, best.obj) <= 0) {
        node.status = 'pruned'; pruned++;
        node.note = 'Relaxation gives ' + frShow(rel.obj) + ', which cannot beat the integer ' +
          'solution already found (' + frShow(best.obj) + '). Pruned without exploring.';
        return node;
      }

      var frac = [];
      rel.x.forEach(function (v, i) { if (!frInt(v)) frac.push(i); });

      if (!frac.length) {
        node.status = 'integral';
        node.note = 'Every variable is already a whole number, so this is a solution to the integer ' +
          'program, not just to its relaxation.';
        if (betterThanBest(rel.obj)) best = { x: rel.x, obj: rel.obj, node: id };
        return node;
      }

      var pick = frac[0];
      if (mostFrac) {
        var worst = -1;
        frac.forEach(function (i) {
          var f = Math.abs(frNum(rel.x[i]) - Math.round(frNum(rel.x[i])));
          if (f > worst) { worst = f; pick = i; }
        });
      }
      node.branchVar = lp.vars[pick];
      node.branchVal = rel.x[pick];

      var kids = ipSplit(sub, pick, rel.x[pick]);
      node.children = [];
      var L = visit(kids.left, depth + 1, kids.left.branched[kids.left.branched.length - 1],
                    id, rel.x);
      if (L) node.children.push(L.id);
      var R = visit(kids.right, depth + 1, kids.right.branched[kids.right.branched.length - 1],
                    id, rel.x);
      if (R) node.children.push(R.id);
      return node;
    }

    var root = visit(lp, 0, 'root', null, null);

    return {
      ok: true, root: root, nodes: nodes, best: best, pruned: pruned,
      explored: nodes.length, bounded: useBound, stuck: stuck,
      disagreements: disagreements,
      status: best ? 'optimal' : (root && root.status === 'infeasible' ? 'infeasible' : 'none'),
      x: best ? best.x : null, obj: best ? best.obj : null
    };
  }

  /**
     The independent check: every integer point in a box that is
     guaranteed to contain the feasible region, tested one by one.
     Hopeless as an algorithm, unimpeachable as an oracle.
  */
  function ipBrute(lp, opts) {
    opts = opts || {};
    var rel = lpSolveByVertices(lp, { noBoundCheck: true });
    if (!rel.ok) return rel;
    if (rel.status === 'infeasible') return { ok: true, status: 'infeasible' };

    var hi = [];
    for (var i = 0; i < lp.n; i++) {
      var h = 0;
      rel.verts.forEach(function (v) { h = Math.max(h, frNum(v.x[i])); });
      hi.push(Math.floor(h + 1e-9));
      if (!isFinite(hi[i]) || hi[i] > (opts.max || 60)) {
        return { ok: false, error: 'The feasible region is too large to enumerate by hand.' };
      }
    }
    var total = hi.reduce(function (s, h) { return s * (h + 1); }, 1);
    if (total > (opts.cap || 400000)) return { ok: false, error: 'Too many integer points (' + total + ').' };

    var sign = lp.dir === 'max' ? 1 : -1;
    var best = null, feasible = 0, x = new Array(lp.n).fill(0);
    (function rec(i) {
      if (i === lp.n) {
        var pt = x.map(function (v) { return fr(v); });
        if (!lpCheck(lp, pt).feasible) return;
        feasible++;
        var o = lpEval(lp, pt);
        if (!best || sign * frCmp(o, best.obj) > 0) best = { x: pt, obj: o };
        return;
      }
      for (var v = 0; v <= hi[i]; v++) { x[i] = v; rec(i + 1); }
    })(0);

    return { ok: true, status: best ? 'optimal' : 'infeasible', best: best,
             x: best ? best.x : null, obj: best ? best.obj : null,
             feasible: feasible, searched: total, box: hi };
  }

  /* ---------- SAT <=p IP ---------- */

  /**
     The reduction in the standard form. Each variable P becomes two
     numerical variables xP and xNP with

         xP + xNP <= 1     and     xP + xNP >= 1

     which together force xP + xNP = 1; since both are non-negative
     integers, exactly one of them is 1. That is the whole trick —
     the pair of inequalities is doing the work an "x in {0,1}"
     declaration would do.

     Each clause becomes "the sum of its literals' variables >= 1",
     i.e. at least one literal is true.
  */
  function ipFromCnf(clauses, vars) {
    if (!clauses || !clauses.length) return { ok: false, error: 'No clauses.' };
    var names = (vars || []).slice();
    clauses.forEach(function (cl) {
      cl.forEach(function (l) {
        var v = l.charAt(0) === '~' ? l.slice(1) : l;
        if (names.indexOf(v) < 0) names.push(v);
      });
    });
    names.sort();
    if (!names.length) return { ok: false, error: 'No variables.' };

    function col(l) { return l.charAt(0) === '~' ? 'xN' + l.slice(1) : 'x' + l; }

    var lines = ['max ' + names.map(function (v) { return 'x' + v; }).join(' + ')];
    var clauseRows = clauses.map(function (cl) {
      var row = cl.map(col).join(' + ') + ' >= 1';
      lines.push(row);
      return row;
    });
    var pairRows = [];
    names.forEach(function (v) {
      pairRows.push('x' + v + ' + xN' + v + ' <= 1');
      pairRows.push('x' + v + ' + xN' + v + ' >= 1');
    });
    lines = lines.concat(pairRows);

    return { ok: true, text: lines.join('\n'), vars: names,
             clauseRows: clauseRows, pairRows: pairRows,
             ipVars: names.reduce(function (a, v) { return a.concat(['x' + v, 'xN' + v]); }, []) };
  }

  /**
     Check the reduction on an instance rather than trusting it:
     decide the CNF with the Topic 5 solver, decide the integer
     program by enumerating 0/1 assignments, and see whether the
     two answers match.
  */
  function ipCheckReduction(clauses, vars) {
    var red = ipFromCnf(clauses, vars);
    if (!red.ok) return red;
    var names = red.vars, k = names.length;
    if (k > 12) return { ok: false, error: 'Too many variables to check exhaustively.' };

    /* The integer program is decided by PARSING AND SOLVING the program
       this module actually prints, not by re-checking the clauses in
       JavaScript. Those are not the same test: a version of this that
       re-implemented the constraint inline went on passing when the
       generated text was changed from ">= 1" to "<= 1", because nothing
       was reading the text. What the tool displays is what gets solved.

       Values are enumerated over {0, 1, 2} rather than {0, 1}: the
       restriction to 0/1 is a *consequence* of the pairing constraints,
       so assuming it would hide a fault in exactly those constraints. */
    var prog = lpParse(red.text);
    if (!prog.ok) return { ok: false, error: 'The generated program does not parse: ' + prog.error };

    var MAXV = 2;
    var found = null;
    var pick = new Array(prog.n);

    /* Pruning, or this is 3^(2k) full feasibility checks. After fixing the
       first i variables, the smallest value the left-hand side of a
       constraint can still reach is the partial sum plus the most negative
       completion of the rest. If even that exceeds b, no completion works. */
    function deadEnd(i) {
      for (var c = 0; c < prog.cons.length; c++) {
        var con = prog.cons[c], lo = fr(0);
        for (var j = 0; j < prog.n; j++) {
          if (j < i) lo = frAdd(lo, frMul(con.a[j], fr(pick[j])));
          else if (frCmp(con.a[j], fr(0)) < 0) lo = frAdd(lo, frMul(con.a[j], fr(MAXV)));
        }
        if (frCmp(lo, con.b) > 0) return true;
      }
      return false;
    }

    (function rec(i) {
      if (found) return;
      if (deadEnd(i)) return;
      if (i === prog.n) {
        var pt = pick.map(function (v) { return fr(v); });
        if (!lpCheck(prog, pt).feasible) return;
        var byName = {};
        prog.vars.forEach(function (v, j) { byName[v] = pick[j]; });
        found = names.map(function (v) {
          return { v: v, x: byName['x' + v] || 0, xn: byName['xN' + v] || 0 };
        });
        return;
      }
      for (var b = 0; b <= MAXV; b++) { pick[i] = b; rec(i + 1); }
    })(0);

    // The CNF, by the Topic 5 solver — a completely different route.
    //
    // Topic 5 represents a literal as {v: 'P', neg: true}, not as the
    // string '~P' used here. Handing it strings does not throw; it
    // quietly decides a different formula, which is how this check
    // first "passed" while comparing two unrelated answers. Convert.
    //
    // A failure is reported, never swallowed: a check that returns
    // "cannot tell" is a check that always passes.
    var sat = null, satError = null;
    try {
      var t5 = clauses.map(function (c) {
        return c.map(function (l) {
          return l.charAt(0) === '~' ? fmLit(l.slice(1), true) : fmLit(l, false);
        });
      });
      sat = dpSolve(t5, names.slice(), {});
    } catch (e) { satError = String(e && e.message || e); }
    if (sat && !sat.ok) satError = sat.error;
    var satSays = sat && sat.ok && sat.sat !== undefined ? !!sat.sat : null;

    return {
      ok: true, reduction: red,
      ipSolvable: !!found, ipWitness: found,
      satSolvable: satSays, satError: satError,
      agree: satSays === null ? null : (!!found === satSays),
      note: satSays === null
        ? 'The integer program ' + (found ? 'has' : 'has no') + ' solution, but the Topic 5 solver ' +
          'could not be run to cross-check it' + (satError ? ' (' + esc(satError) + ')' : '') + '.'
        : ((!!found === satSays)
            ? 'Both routes agree: the formula is ' + (satSays ? 'satisfiable' : 'unsatisfiable') +
              ' and the integer program ' + (found ? 'has' : 'has no') + ' integer solution — which ' +
              'is exactly what the reduction promises.'
            : 'The two routes DISAGREE, so something here is wrong.')
    };
  }

  /* ---------- the matching example ---------- */

  /**
     The assignment example. Workers with capacities, tasks with requirements,
     an edge for every pair that can be assigned.

     Two things about the usual write-up. Step 5 states the task
     constraint as "sum over j of x_{i,j} >= requirements of j",
     summing over the wrong index — it should be over i, the
     workers, as step 3 correctly has it. And the result is called a
     "maximal matching": what the program actually finds is a
     *maximum* one, and with capacities above 1 it is not a matching
     at all but a degree-constrained subgraph.
  */
  function ipMatching(spec) {
    var workers = spec.workers, tasks = spec.tasks, edges = spec.edges;
    if (!workers.length || !tasks.length) return { ok: false, error: 'Need at least one worker and one task.' };

    var vars = [], has = {};
    edges.forEach(function (e) {
      var k = e[0] + ',' + e[1];
      if (!has[k]) { has[k] = true; vars.push({ w: e[0], t: e[1], name: 'x_' + e[0] + '_' + e[1] }); }
    });
    if (!vars.length) return { ok: false, error: 'No edges — no worker can do any task.' };

    var lines = ['max ' + vars.map(function (v) { return v.name; }).join(' + ')];
    vars.forEach(function (v) { lines.push(v.name + ' <= 1'); });
    workers.forEach(function (w) {
      var mine = vars.filter(function (v) { return v.w === w.id; });
      if (mine.length) lines.push(mine.map(function (v) { return v.name; }).join(' + ') +
        ' <= ' + w.capacity);
    });
    tasks.forEach(function (t) {
      var mine = vars.filter(function (v) { return v.t === t.id; });
      if (mine.length && t.requires) lines.push(mine.map(function (v) { return v.name; }).join(' + ') +
        ' >= ' + t.requires);
    });

    return { ok: true, text: lines.join('\n'), vars: vars,
             workers: workers, tasks: tasks };
  }

  /** Brute force over 0/1 assignments — the check on the matching IP. */
  function ipMatchingBrute(spec) {
    var built = ipMatching(spec);
    if (!built.ok) return built;
    var vars = built.vars, k = vars.length;
    if (k > 22) return { ok: false, error: 'Too many edges to enumerate (' + k + ').' };

    var capOf = {}, reqOf = {};
    spec.workers.forEach(function (w) { capOf[w.id] = w.capacity; });
    spec.tasks.forEach(function (t) { reqOf[t.id] = t.requires || 0; });

    var best = null, feasible = 0, total = Math.pow(2, k);
    for (var mask = 0; mask < total; mask++) {
      var loadW = {}, loadT = {}, count = 0;
      for (var i = 0; i < k; i++) {
        if (mask & (1 << i)) {
          var v = vars[i];
          loadW[v.w] = (loadW[v.w] || 0) + 1;
          loadT[v.t] = (loadT[v.t] || 0) + 1;
          count++;
        }
      }
      var ok = true;
      for (var w in capOf) if ((loadW[w] || 0) > capOf[w]) { ok = false; break; }
      if (ok) for (var t in reqOf) if ((loadT[t] || 0) < reqOf[t]) { ok = false; break; }
      if (!ok) continue;
      feasible++;
      if (!best || count > best.count) {
        best = { count: count, mask: mask,
                 chosen: vars.filter(function (v, i2) { return mask & (1 << i2); }) };
      }
    }
    return { ok: true, built: built, best: best, feasible: feasible, searched: total };
  }

  var IP_MATCHING_PRESET = {
    workers: [
      { id: 'Ada', capacity: 2 }, { id: 'Bo', capacity: 1 }, { id: 'Cy', capacity: 3 },
      { id: 'Dev', capacity: 1 }, { id: 'Eli', capacity: 1 }, { id: 'Fay', capacity: 2 }
    ],
    tasks: [
      { id: 'A', requires: 4 }, { id: 'B', requires: 2 },
      { id: 'C', requires: 1 }, { id: 'D', requires: 2 }
    ],
    edges: [
      ['Ada', 'A'], ['Ada', 'C'], ['Ada', 'D'],
      ['Bo', 'A'], ['Bo', 'B'],
      ['Cy', 'A'], ['Cy', 'B'], ['Cy', 'C'], ['Cy', 'D'],
      ['Dev', 'A'], ['Dev', 'D'],
      ['Eli', 'B'], ['Eli', 'C'],
      ['Fay', 'A'], ['Fay', 'D']
    ]
  };
