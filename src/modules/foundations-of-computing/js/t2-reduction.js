  /* ============================================================
     SAT ≤p CLIQUE — A REDUCTION YOU CAN RUN (Topic 02)

     A polynomial reduction from X to Y is a function f, computable
     in polynomial time, with

         w ∈ X   ⟺   f(w) ∈ Y

     The double arrow is the whole content, and it is what makes a
     reduction hard to believe on a slide: you are asked to accept
     that a graph built out of a formula has a k-clique in exactly
     the cases where the formula has a satisfying assignment.

     So this builds f and then checks the arrow, in both directions
     and constructively:

       ⟹  given a satisfying assignment, pick one true literal from
          each clause. Those vertices are pairwise joined, because
          they sit in different clauses and no two of them can be
          complementary — a model cannot make both L and ¬L true.
          That is a clique of size k.

       ⟸  given a clique of size k, no two of its vertices share a
          clause (same-clause vertices are never joined), so it has
          exactly one vertex per clause; and no two are
          complementary, so setting every chosen literal to true is
          consistent. Each clause then has a true literal.

     Both constructions are implemented, and each is *verified after
     running*: the model built from a clique is fed back through the
     formula, and the clique built from a model is checked to be a
     clique. Nothing here is asserted.

     THE CONSTRUCTION (from the lecture slides)

       vertices — one per literal *occurrence*. The same literal in
                  two clauses gives two different vertices, which is
                  why they carry the clause number: P₁ and P₃.

       edges    — (L¹ᵢ, L²ⱼ) ∈ E ⟺ i ≠ j and L¹ ≢ ¬L²
                  different clauses, and not each other's negation.

       k        — the number of clauses.
     ============================================================ */

  var RD_SUBS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

  function rdSub(n) {
    return String(n).split('').map(function (d) { return RD_SUBS[+d]; }).join('');
  }

  /**
   * Build G_F from a list of clauses.
   *
   * @param {Array<Array<{v,neg}>>} clauses
   * @returns {{vertices, adj, edges, k, clauses}}
   */
  function rdBuild(clauses) {
    var vertices = [];
    for (var c = 0; c < clauses.length; c++) {
      for (var p = 0; p < clauses[c].length; p++) {
        vertices.push({
          i: vertices.length,
          clause: c,
          pos: p,
          lit: clauses[c][p],
          label: fmLitShow(clauses[c][p]) + rdSub(c + 1),
        });
      }
    }

    var n = vertices.length, adj = [], edges = [];
    for (var a = 0; a < n; a++) adj.push(new Array(n).fill(false));

    for (var u = 0; u < n; u++) {
      for (var w = u + 1; w < n; w++) {
        if (rdJoined(vertices[u], vertices[w])) {
          adj[u][w] = adj[w][u] = true;
          edges.push([u, w]);
        }
      }
    }

    return { vertices: vertices, adj: adj, edges: edges, k: clauses.length, clauses: clauses };
  }

  /** The edge rule, written once: different clauses, not complementary. */
  function rdJoined(u, w) {
    if (u.clause === w.clause) return false;
    if (u.lit.v === w.lit.v && u.lit.neg !== w.lit.neg) return false;
    return true;
  }

  /* ---------- clique search ---------- */

  /*
     The search itself lives in t2-graph.js as cqFind / cqMax / cqIs,
     because the graph tool needs exactly the same thing and two copies
     of a backtracking search is two chances to get it wrong. These are
     the thin wrappers that speak in terms of G_F.
  */

  /** Find a clique of size exactly k in G_F, or null. */
  function rdFindClique(g, k) { return cqFind(g.adj, g.vertices.length, k); }

  /** The largest clique in G_F, for when k is out of reach. */
  function rdMaxClique(g) { return cqMax(g.adj, g.vertices.length).clique; }

  /** Is this set of vertex indices really a clique? Checked, not assumed. */
  function rdIsClique(g, set) { return cqIs(g.adj, set); }

  /* ---------- satisfiability, independently ---------- */

  /** Every variable appearing in the clauses, in first-appearance order. */
  function rdVars(clauses) {
    var seen = [];
    for (var c = 0; c < clauses.length; c++) {
      for (var p = 0; p < clauses[c].length; p++) {
        if (seen.indexOf(clauses[c][p].v) < 0) seen.push(clauses[c][p].v);
      }
    }
    return seen;
  }

  /**
   * Satisfiability of a clause list by brute force over 2ⁿ assignments.
   *
   * Deliberately not clever. This is the honest exponential baseline
   * that the clique search is compared against, and the answer it gives
   * is what the reduction has to reproduce.
   */
  function rdSat(clauses) {
    var vars = rdVars(clauses), n = vars.length, total = Math.pow(2, n);
    for (var i = 0; i < total; i++) {
      var env = {};
      for (var j = 0; j < n; j++) env[vars[j]] = ((i >> (n - 1 - j)) & 1) === 0;
      if (fmCnfEval(clauses, env)) return { sat: true, model: env, vars: vars, tried: i + 1, total: total };
    }
    return { sat: false, model: null, vars: vars, tried: total, total: total };
  }

  /* ---------- the two directions, both constructive ---------- */

  /**
   * ⟹ A satisfying assignment gives a clique.
   *
   * Take the first true literal in each clause. The result is verified
   * to be a clique before it is returned, so a wrong construction
   * fails loudly rather than producing a plausible-looking set.
   *
   * @returns {{clique: number[], picks: Array, ok: boolean}}
   */
  function rdModelToClique(g, model) {
    var clique = [], picks = [];
    for (var c = 0; c < g.clauses.length; c++) {
      var chosen = -1;
      for (var p = 0; p < g.clauses[c].length; p++) {
        if (fmLitEval(g.clauses[c][p], model)) { chosen = p; break; }
      }
      if (chosen < 0) return { clique: [], picks: [], ok: false, why: 'clause ' + (c + 1) + ' has no true literal' };

      // vertices were built clause by clause, in order
      var idx = 0;
      for (var q = 0; q < c; q++) idx += g.clauses[q].length;
      idx += chosen;

      clique.push(idx);
      picks.push({ clause: c, vertex: idx, label: g.vertices[idx].label });
    }
    return { clique: clique, picks: picks, ok: rdIsClique(g, clique) };
  }

  /**
   * ⟸ A clique of size k gives a satisfying assignment.
   *
   * Every chosen literal is set true. Variables the clique says nothing
   * about are left false — they are genuinely unconstrained, and the
   * tool says so rather than pretending the model is unique.
   *
   * The assignment is then run back through the formula. If the
   * reduction were wrong, this is where it would show.
   *
   * @returns {{model, free: string[], satisfies: boolean, conflict: object|null}}
   */
  function rdCliqueToModel(g, clique) {
    var model = {}, forced = {}, conflict = null;

    for (var i = 0; i < clique.length; i++) {
      var lit = g.vertices[clique[i]].lit;
      var want = !lit.neg;
      if (forced[lit.v] !== undefined && forced[lit.v] !== want) {
        conflict = { v: lit.v };                    // impossible in a real clique
      }
      forced[lit.v] = want;
      model[lit.v] = want;
    }

    var all = rdVars(g.clauses), free = [];
    for (var j = 0; j < all.length; j++) {
      if (model[all[j]] === undefined) { model[all[j]] = false; free.push(all[j]); }
    }

    return {
      model: model,
      free: free,
      satisfies: fmCnfEval(g.clauses, model),
      conflict: conflict,
    };
  }

  /**
   * The reduction theorem, checked on one formula.
   *
   *     F is satisfiable  ⟺  G_F has a clique of size k
   *
   * Both sides are computed independently — the left by brute force
   * over assignments, the right by searching the graph — and compared.
   * Running this over many formulas is a test of the construction
   * itself rather than of any particular answer.
   *
   * @returns {{sat, clique, agree, model, back}}
   */
  function rdCheck(clauses) {
    var g = rdBuild(clauses);
    var sat = rdSat(clauses);
    var found = rdFindClique(g, g.k);
    var agree = sat.sat === (found.clique !== null);

    var forward = sat.sat ? rdModelToClique(g, sat.model) : null;
    var back = found.clique ? rdCliqueToModel(g, found.clique) : null;

    return {
      g: g,
      sat: sat.sat,
      model: sat.model,
      clique: found.clique,
      steps: found.steps,
      agree: agree,
      forward: forward,
      back: back,
      // The round trip has to close: a clique must yield a model that
      // satisfies the formula, and a model must yield a real clique.
      sound: agree &&
             (!forward || (forward.ok && forward.clique.length === g.k)) &&
             (!back || back.satisfies),
    };
  }
