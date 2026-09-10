  /* ============================================================
     TOPIC 05 · 2SAT, the implication graph, and Horn clauses
     ------------------------------------------------------------
     The standard treatment solves 2SAT "using our strongly connected component
     algorithm", so this file calls Topic 4's sccFind rather than
     reimplementing it. That is not laziness: it means a bug in the
     SCC engine shows up here too, and the cross-topic link the
     write-ups claim is real in the code as well.

     Why it works. Each 2-literal clause (a ∨ b) is two implications,
     ¬a → b and ¬b → a. A path x ⇝ y in that graph means "x forces
     y". If x and ¬x are in the same component then x forces ¬x AND
     ¬x forces x, so neither value of x is possible and the formula
     is unsatisfiable. Otherwise it is satisfiable, and the
     component order tells you which value to pick.
     ============================================================ */

  function tsLitKey(l) { return (l.neg ? '~' : '') + l.v; }
  function tsNegKey(k) { return k.charAt(0) === '~' ? k.slice(1) : '~' + k; }

  /** Build the implication graph in the format Topic 4's engine
      reads, so the same sccFind can be pointed at it. */
  function tsImplication(clauses) {
    var bad = clauses.filter(function (c) { return c.length > 2; });
    if (bad.length) {
      return { ok: false,
               error: 'This is not a 2SAT instance: ' + stShowClause(bad[0]) + ' has ' +
                      bad[0].length + ' literals. The implication trick needs at most 2 per ' +
                      'clause, because "one of these two must hold" is what becomes an ' +
                      'implication. With three literals there is no such rewriting — which ' +
                      'is exactly why 3SAT stays hard.' };
    }

    var edges = [], nodes = {}, impl = [];
    function node(k) { if (!nodes[k]) nodes[k] = []; return k; }

    clauses.forEach(function (c) {
      if (c.length === 1) {
        // A unit clause (a) is ¬a → a: the only way out is a itself.
        var a = tsLitKey(c[0]);
        node(a); node(tsNegKey(a));
        edges.push([tsNegKey(a), a]);
        impl.push({ from: tsNegKey(a), to: a, clause: c });
        return;
      }
      if (c.length === 0) return;
      var x = tsLitKey(c[0]), y = tsLitKey(c[1]);
      node(x); node(y); node(tsNegKey(x)); node(tsNegKey(y));
      edges.push([tsNegKey(x), y]);
      edges.push([tsNegKey(y), x]);
      impl.push({ from: tsNegKey(x), to: y, clause: c });
      impl.push({ from: tsNegKey(y), to: x, clause: c });
    });

    // Topic 4's parser wants names without ~, so encode it.
    function enc(k) { return k.charAt(0) === '~' ? 'n_' + k.slice(1) : 'p_' + k; }
    function dec(k) { return k.slice(0, 2) === 'n_' ? '¬' + k.slice(2) : k.slice(2); }

    var byFrom = {};
    Object.keys(nodes).forEach(function (k) { byFrom[enc(k)] = []; });
    edges.forEach(function (e) {
      // A tautology like (¬P ∨ P) yields P → P, which is vacuous and
      // would otherwise be a self-loop the graph parser refuses.
      // Dropping it is correct: the clause constrains nothing.
      if (e[0] === e[1]) return;
      byFrom[enc(e[0])].push(enc(e[1]));
    });
    var text = Object.keys(byFrom).sort().map(function (k) {
      return byFrom[k].length ? k + ' > ' + byFrom[k].join(' ') : k;
    }).join('\n');

    return { ok: true, text: text, edges: edges, impl: impl,
             nodes: Object.keys(nodes).sort(), enc: enc, dec: dec };
  }

  /** Decide a 2SAT instance, and produce an assignment when there
      is one. Unsatisfiable exactly when some component holds both a
      literal and its negation. */
  function tsSolve(clauses, vars) {
    var g = tsImplication(clauses);
    if (!g.ok) return g;

    var graph = grParse(g.text, { directed: true });
    if (!graph.ok) return { ok: false, error: graph.error };

    var scc = sccFind(graph);
    if (!scc.ok) return { ok: false, error: scc.error };

    // Which component is each literal in?
    var comp = {};
    scc.components.forEach(function (c, i) { c.forEach(function (v) { comp[v] = i; }); });

    // Step 4: does any component contain a literal and its negation?
    var clashes = [];
    vars.forEach(function (v) {
      var pos = g.enc(v), neg = g.enc('~' + v);
      if (comp[pos] !== undefined && comp[pos] === comp[neg]) clashes.push(v);
    });

    var readable = scc.components.map(function (c) {
      return c.map(g.dec).sort();
    });

    if (clashes.length) {
      return { ok: true, sat: false, components: readable, clashes: clashes, graph: g,
               why: clashes.map(function (v) {
                 return v + ' and ¬' + v + ' lie in the same component, so ' + v +
                        ' implies ¬' + v + ' and ¬' + v + ' implies ' + v + ' — ' +
                        'neither value is possible.';
               }).join(' ') };
    }

    // Satisfiable. Choose x true when x's component sits DOWNSTREAM
    // of ¬x's in the condensation.
    //
    // The reason is the whole trick: an implication only ever runs
    // from an earlier component to a later one, so picking the later
    // literal cannot force anything that has already been settled the
    // other way. Picking the earlier one can, and does.
    //
    // sccFind returns components sources-first, so "downstream" is a
    // LARGER index. Getting this backwards produces a well-formed
    // assignment that satisfies nothing, which is why the returned
    // assignment is checked against the clauses below rather than
    // trusted.
    var asg = {};
    vars.forEach(function (v) {
      var pos = comp[g.enc(v)], neg = comp[g.enc('~' + v)];
      if (pos === undefined || neg === undefined) { asg[v] = true; return; }
      asg[v] = pos > neg;
    });

    return { ok: true, sat: true, asg: asg, components: readable, clashes: [], graph: g,
             verified: stEval(clauses, asg).all };
  }

  /* ---------- Horn clauses ---------- */

  /** A definite Horn clause has exactly one positive literal, and so
      reads as a rule: the negatives are the body, the positive the
      head. (Goal clauses, with no positive literal, are allowed
      too -- those are the queries.) */
  function hnClassify(clauses) {
    var rules = [], why = [], horn = true;
    clauses.forEach(function (c, i) {
      var pos = c.filter(function (l) { return !l.neg; });
      var negs = c.filter(function (l) { return l.neg; });
      if (pos.length > 1) {
        horn = false;
        why.push(stShowClause(c) + ' has ' + pos.length + ' positive literals, so it is not Horn.');
        return;
      }
      rules.push({
        clause: c,
        head: pos.length ? pos[0].v : null,
        body: negs.map(function (l) { return l.v; }).sort(),
        goal: pos.length === 0
      });
    });
    return { horn: horn, rules: rules, why: why };
  }

  /** Forward chaining: start from the facts and fire rules until
      nothing new appears. Linear, and it decides Horn satisfiability
      -- which is why Horn sits in P alongside 2SAT despite the two
      restrictions being completely different in shape. */
  function hnSolve(clauses) {
    var cls = hnClassify(clauses);
    if (!cls.horn) return { ok: false, error: cls.why.join(' ') };

    var known = {}, steps = [], fired = {};
    var rules = cls.rules;

    for (var round = 0; round < 200; round++) {
      var grew = false;
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (fired[i] || r.goal) continue;
        var ready = r.body.every(function (b) { return known[b]; });
        if (!ready) continue;
        fired[i] = true;
        if (!known[r.head]) {
          known[r.head] = true;
          grew = true;
          steps.push({ head: r.head, body: r.body.slice(),
                       note: r.body.length
                         ? r.body.join(' ∧ ') + ' → ' + r.head + ' fires, so ' + r.head + ' := True.'
                         : r.head + ' is a fact, so ' + r.head + ' := True.' });
        }
      }
      if (!grew) break;
    }

    // A goal clause (all negative) is violated if its whole body is known.
    var broken = rules.filter(function (r) {
      return r.goal && r.body.every(function (b) { return known[b]; });
    });

    var asg = {};
    clauses.forEach(function (c) { c.forEach(function (l) { asg[l.v] = !!known[l.v]; }); });

    return { ok: true, sat: !broken.length, known: Object.keys(known).sort(), steps: steps,
             asg: asg, broken: broken,
             why: broken.length
               ? 'The goal clause ' + stShowClause(broken[0].clause) + ' says not all of ' +
                 broken[0].body.join(', ') + ' can hold — but forward chaining derives all of ' +
                 'them. Unsatisfiable.'
               : 'Setting exactly the derived atoms true satisfies every clause. This is the ' +
                 'minimal model, and it is unique — which is what makes Horn easy.' };
  }

  /* ---------- SAT ≤p 3SAT ---------- */

  /** Split every clause wider than 3 by chaining fresh variables.
      Satisfiability is preserved in both directions, which is the
      whole content of the reduction. */
  function tsTo3(clauses, vars) {
    var out = [], fresh = 0, log = [];
    function newVar() {
      var n;
      do { n = 'X' + (++fresh); } while (vars.indexOf(n) >= 0);
      return n;
    }

    clauses.forEach(function (c) {
      if (c.length <= 3) { out.push(c.slice()); return; }
      var before = out.length;
      var rest = c.slice();
      // (l1 ∨ … ∨ lk) becomes
      //   (l1 ∨ l2 ∨ X1) (¬X1 ∨ l3 ∨ X2) … (¬X(k-3) ∨ l(k-1) ∨ lk)
      //
      // Every clause after the first spends one slot on ¬carry, so it
      // can absorb only ONE original literal -- except the last, which
      // takes two because it needs no new bridge. Stopping the loop at
      // "more than three left" instead of "more than two" leaves a
      // four-literal clause at the end, which is invisible on the
      // worked k = 4 example and shows up at k = 5.
      var x = newVar();
      out.push([rest.shift(), rest.shift(), fmLit(x, false)]);
      var carry = x;
      while (rest.length > 2) {
        var y = newVar();
        out.push([fmLit(carry, true), rest.shift(), fmLit(y, false)]);
        carry = y;
      }
      out.push([fmLit(carry, true)].concat(rest));
      log.push({ from: c, made: out.length - before,
                 note: stShowClause(c) + ' has ' + c.length + ' literals, so it becomes ' +
                       (out.length - before) + ' clauses joined by fresh variables.' });
    });

    var newVars = vars.slice();
    for (var i = 1; i <= fresh; i++) if (newVars.indexOf('X' + i) < 0) newVars.push('X' + i);
    newVars.sort();

    return { ok: true, clauses: out, vars: newVars, added: fresh, log: log,
             widest: out.reduce(function (m, c) { return Math.max(m, c.length); }, 0) };
  }

  /** The claim the reduction has to make, checked rather than
      asserted: the new formula is satisfiable iff the old one was. */
  function tsTo3Check(clauses, vars) {
    var r = tsTo3(clauses, vars);
    if (!r.ok) return r;
    var a = stBrute(clauses, vars);
    var b = stBrute(r.clauses, r.vars);
    if (!a.ok || !b.ok) return { ok: false, error: 'Too large to verify exhaustively.' };
    return { ok: true, agree: a.sat === b.sat, before: a.sat, after: b.sat,
             widest: r.widest, added: r.added, clauses: r.clauses, vars: r.vars, log: r.log };
  }
