  /* ============================================================
     SAT ≤p CLIQUE — A REDUCTION YOU CAN RUN (Topic 02)

     A polynomial reduction from X to Y is a function f, computable
     in polynomial time, with

         w ∈ X   ⟺   f(w) ∈ Y

     The double arrow is the whole content, and it is what makes a
     reduction hard to believe on paper: you are asked to accept
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

     THE CONSTRUCTION (the standard one)

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

  /* ---------- rendering ---------- */

  var RD_COLOURS = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)', 'var(--accent-4)'];
  function rdColour(c) { return RD_COLOURS[c % RD_COLOURS.length]; }

  function rdPreset(src) {
    var box = document.getElementById('rd-formula');
    if (box) box.value = src;
    runReduce();
  }

  /**
   * Lay the vertices out on a circle, clause by clause, with a gap
   * between clauses so the grouping is visible without drawing a hull
   * around each one.
   */
  function rdLayout(g, W, H) {
    var n = g.vertices.length, k = g.clauses.length;
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    var unit = (2 * Math.PI) / (n + k);
    var a = -Math.PI / 2 - unit * 0.5;
    var pos = [], clauseAngle = [];

    for (var c = 0; c < k; c++) {
      var first = a;
      for (var p = 0; p < g.clauses[c].length; p++) {
        pos.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a: a });
        a += unit;
      }
      clauseAngle.push((first + (a - unit)) / 2);
      a += unit;                                     // the gap
    }
    return { pos: pos, clauseAngle: clauseAngle, cx: cx, cy: cy, R: R };
  }

  function rdSvg(g, clique) {
    var W = 720, H = 420;
    var L = rdLayout(g, W, H);
    var inClique = {};
    (clique || []).forEach(function (i) { inClique[i] = true; });

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-height:440px;" ' +
            'role="img" aria-label="The graph built from the formula">';

    /* edges: ordinary ones first so the clique draws on top */
    for (var e = 0; e < g.edges.length; e++) {
      var u = g.edges[e][0], v = g.edges[e][1];
      var hot = inClique[u] && inClique[v];
      if (hot) continue;
      s += '<line x1="' + L.pos[u].x.toFixed(1) + '" y1="' + L.pos[u].y.toFixed(1) +
           '" x2="' + L.pos[v].x.toFixed(1) + '" y2="' + L.pos[v].y.toFixed(1) +
           '" stroke="var(--rule)" stroke-width="1" opacity="0.55"/>';
    }
    for (var f = 0; f < g.edges.length; f++) {
      var a = g.edges[f][0], b = g.edges[f][1];
      if (!(inClique[a] && inClique[b])) continue;
      s += '<line x1="' + L.pos[a].x.toFixed(1) + '" y1="' + L.pos[a].y.toFixed(1) +
           '" x2="' + L.pos[b].x.toFixed(1) + '" y2="' + L.pos[b].y.toFixed(1) +
           '" stroke="var(--accent-2)" stroke-width="3.5" stroke-linecap="round"/>';
    }

    /* clause labels, just outside the ring */
    for (var c = 0; c < L.clauseAngle.length; c++) {
      var la = L.clauseAngle[c];
      var lx = L.cx + (L.R + 46) * Math.cos(la), ly = L.cy + (L.R + 46) * Math.sin(la);
      s += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="middle" ' +
           'dominant-baseline="middle" font-size="11" font-family="IBM Plex Mono, monospace" ' +
           'fill="' + rdColour(c) + '" opacity="0.85">clause ' + (c + 1) + '</text>';
    }

    /* vertices */
    for (var i = 0; i < g.vertices.length; i++) {
      var vtx = g.vertices[i], pt = L.pos[i], hotV = inClique[i];
      s += '<circle cx="' + pt.x.toFixed(1) + '" cy="' + pt.y.toFixed(1) + '" r="' + (hotV ? 19 : 16) +
           '" fill="var(--surface)" stroke="' + (hotV ? 'var(--accent-2)' : rdColour(vtx.clause)) +
           '" stroke-width="' + (hotV ? 3 : 1.6) + '"/>';
      s += '<text x="' + pt.x.toFixed(1) + '" y="' + pt.y.toFixed(1) + '" text-anchor="middle" ' +
           'dominant-baseline="central" font-size="12" font-family="IBM Plex Mono, monospace" ' +
           'fill="var(--ink)" font-weight="' + (hotV ? '600' : '400') + '">' + esc(vtx.label) + '</text>';
    }

    return s + '</svg>';
  }

  function runReduce() {
    var out = document.getElementById('rd-output');
    if (!out) return;

    var src = ((document.getElementById('rd-formula') || {}).value || '').trim();
    var p = fmParse(src);
    if (!p.ok) { out.innerHTML = '<div class="tool-error">' + p.error + '</div>'; return; }

    var cl = fmClauses(p.ast);
    if (!cl.ok) {
      out.innerHTML = '<div class="tool-error">' + cl.error +
        '<br><br>The reduction takes CNF as its input. Use the truth-table tool above to convert ' +
        'this formula first, then paste the CNF back in here.</div>';
      return;
    }
    if (cl.clauses.length > 6) {
      out.innerHTML = '<div class="tool-error">' + cl.clauses.length +
        ' clauses would need a clique of that size and a graph too dense to read. Six is the limit here.</div>';
      return;
    }

    var r = rdCheck(cl.clauses);
    var g = r.g;

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + g.vertices.length + ' vertices</span>' +
      '<span class="stat-pill a">' + g.edges.length + ' edges</span>' +
      '<span class="stat-pill dark">k = ' + g.k + '</span>' +
      '</div>';

    h += '<div class="rd-rule">An edge joins two literals exactly when they sit in ' +
         '<strong>different clauses</strong> and are <strong>not each other&rsquo;s negation</strong>. ' +
         'Both conditions matter: the first forces a clique to take one literal per clause, ' +
         'the second stops it choosing P and ¬P at once.</div>';

    h += rdSvg(g, r.clique);

    /* the verdict, both sides computed separately */
    h += '<div class="verdict ' + (r.sat ? 'safe' : 'bad') + '">' +
      'F is ' + (r.sat ? 'SATISFIABLE' : 'UNSATISFIABLE') + '  &nbsp;⟺&nbsp;  G<sub>F</sub> ' +
      (r.clique ? 'HAS' : 'HAS NO') + ' clique of size ' + g.k +
      '<br>' + (r.agree
        ? '✓ the two sides agree — which is the reduction doing its job'
        : '✗ THE TWO SIDES DISAGREE. The construction is wrong; do not trust this.') +
      '</div>';

    /* the two directions, spelled out */
    if (r.sat && r.forward) {
      h += '<div class="rd-dir"><div class="rd-dir-head">⟹ from a satisfying assignment to a clique</div>' +
        '<div class="rd-dir-body">Take the assignment ' +
        '<code>' + Object.keys(r.model).map(function (v) {
          return v + '=' + (r.model[v] ? 'T' : 'F'); }).join(', ') + '</code> ' +
        'and pick one true literal out of each clause:<br>' +
        r.forward.picks.map(function (pk) {
          return 'clause ' + (pk.clause + 1) + ' → <strong>' + esc(pk.label) + '</strong>';
        }).join('<br>') +
        '<br><br>' + (r.forward.ok
          ? '✓ Checked: those ' + r.forward.clique.length + ' vertices are pairwise joined, so they are a clique.'
          : '✗ Those vertices are not a clique — a bug.') +
        '</div></div>';
    }

    if (r.clique && r.back) {
      h += '<div class="rd-dir"><div class="rd-dir-head">⟸ from a clique back to a satisfying assignment</div>' +
        '<div class="rd-dir-body">The clique is ' +
        r.clique.map(function (i) { return '<strong>' + esc(g.vertices[i].label) + '</strong>'; }).join(', ') +
        '. No two of them share a clause, and none is the negation of another, so setting every one ' +
        'of them true is consistent:<br><code>' +
        Object.keys(r.back.model).map(function (v) {
          return v + '=' + (r.back.model[v] ? 'T' : 'F');
        }).join(', ') + '</code>' +
        (r.back.free.length ? '<br><span class="rd-free">' + r.back.free.join(', ') +
          ' never appear in the clique, so nothing constrains them — they are set false arbitrarily.</span>' : '') +
        '<br><br>' + (r.back.satisfies
          ? '✓ Checked: running F on that assignment gives <strong>true</strong>.'
          : '✗ That assignment does not satisfy F — a bug.') +
        '</div></div>';
    }

    if (!r.clique) {
      var best = rdMaxClique(g);
      h += '<p class="tool-note">The largest clique in this graph has <strong>' + best.length +
        '</strong> vertices (' + best.map(function (i) { return esc(g.vertices[i].label); }).join(', ') +
        '), short of the ' + g.k + ' needed. Every set of ' + g.k + ' vertices either repeats a clause ' +
        'or contains a literal and its negation.</p>';
    }

    /* the cost, which is the point of the exercise */
    var checkCost = (g.k * (g.k - 1)) / 2;
    h += '<p class="tool-note"><strong>Finding</strong> the clique took ' + r.steps +
      ' search steps. <strong>Checking</strong> one takes ' + checkCost + ' edge lookups — ' +
      'k(k−1)/2, which is the k² quoted loosely elsewhere. That gap between finding and checking ' +
      'is what NP is.</p>';

    h += '<p class="tool-note">Both sides were computed independently: satisfiability by trying all ' +
      Math.pow(2, rdVars(cl.clauses).length) + ' assignments, the clique by searching the graph. ' +
      'Neither answer was derived from the other.</p>';

    out.innerHTML = h;
  }
