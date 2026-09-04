  /* ---------- Topic 02 · complexity, satisfiability, reductions ----------

     Every answer below is computed by the same engine the tools on the
     page use — the satisfiability questions are marked by running the
     truth table, the clique questions by building G_F and searching it.
     Nothing here is a stored answer key, so a question and its marking
     cannot drift apart.
     ------------------------------------------------------------------ */

  /** A numeric marker that will not accept a valid prefix of junk. */
  function cqNum(target) {
    return function (v) {
      var s = String(v).trim().replace(/,/g, '');
      if (!/^-?[0-9]+$/.test(s)) return { ok: false, msg: 'Give a whole number.' };
      return { ok: parseInt(s, 10) === target };
    };
  }

  var CQ_FORMULAS = [
    '(P | ~Q) & (~P | Q)',
    '(P | Q) & (~P | ~Q)',
    '(P | Q | R) & (~P | ~Q)',
    '(P -> Q) & (Q -> R)',
    '~(P & Q) | R',
    '(P | ~R) -> ~(~Q | R)',
    '(P & Q) | (~P & R)',
    '(P -> Q) & P & ~Q',
  ];

  /* ---- Is this formula satisfiable? ---- */
  QZ_GEN.push({ topic: 'complexity', make: function () {
    var src = qzPick(CQ_FORMULAS);
    var p = fmParse(src);
    if (!p.ok) throw new Error('retry');
    var sat = fmSat(p.ast);
    var vars = fmVars(p.ast);

    return {
      topic: 'complexity · satisfiability',
      kind: 'choice',
      prompt: 'Is <code>' + esc(src) + '</code> satisfiable?',
      choices: ['Satisfiable', 'Unsatisfiable'],
      answer: sat.sat ? 'Satisfiable' : 'Unsatisfiable',
      check: textCheck(sat.sat ? 'Satisfiable' : 'Unsatisfiable'),
      explain: sat.sat
        ? 'Row ' + sat.row + ' of the truth table does it: ' +
          vars.map(function (v) { return v + ' = ' + (sat.model[v] ? 'T' : 'F'); }).join(', ') +
          '. One true row is all satisfiability needs.'
        : 'All ' + sat.rows + ' rows come out false, so no assignment works.',
    };
  } });

  /* ---- How many terms does the DNF have? ---- */
  QZ_GEN.push({ topic: 'complexity', make: function () {
    var src = qzPick(CQ_FORMULAS);
    var p = fmParse(src);
    if (!p.ok) throw new Error('retry');
    var t = fmTable(p.ast);
    var dnf = fmDnf(t);
    if (!dnf.terms.length) throw new Error('retry');

    return {
      topic: 'complexity · normal forms',
      prompt: 'The truth table for <code>' + esc(src) + '</code> has ' + t.rows.length +
        ' rows. How many <strong>∧-terms</strong> does its DNF have?',
      placeholder: 'a whole number',
      answer: String(dnf.terms.length),
      check: cqNum(dnf.terms.length),
      explain: 'DNF takes one term per <strong>true</strong> row. This formula is true on ' +
        dnf.rows.length + ' of its ' + t.rows.length + ' rows (rows ' + dnf.rows.join(', ') +
        '), giving <code>' + esc(fmDnfShow(dnf.terms)) + '</code>.',
    };
  } });

  /* ---- Which clause rules out a given false row? ---- */
  QZ_GEN.push({ topic: 'complexity', make: function () {
    var src = qzPick(CQ_FORMULAS);
    var p = fmParse(src);
    if (!p.ok) throw new Error('retry');
    var t = fmTable(p.ast);
    var cnf = fmCnf(t);
    if (!cnf.clauses.length) throw new Error('retry');

    var i = qzInt(0, cnf.clauses.length - 1);
    var rowNo = cnf.rows[i];
    var row = t.rows[rowNo - 1];
    var right = '(' + cnf.clauses[i].map(fmLitShow).join(' ∨ ') + ')';

    // The classic wrong answer: the same literals unflipped.
    var unflipped = '(' + t.vars.map(function (v, j) {
      return (row.bits[j] ? '' : '¬') + v; }).join(' ∨ ') + ')';
    if (unflipped === right) throw new Error('retry');

    var choices = [right, unflipped,
      '(' + t.vars.join(' ∨ ') + ')',
      '(' + t.vars.map(function (v) { return '¬' + v; }).join(' ∨ ') + ')'];
    choices = choices.filter(function (c, k) { return choices.indexOf(c) === k; });
    if (choices.length < 3) throw new Error('retry');

    return {
      topic: 'complexity · normal forms',
      kind: 'choice',
      prompt: 'In the CNF of <code>' + esc(src) + '</code>, row ' + rowNo + ' is <strong>false</strong> (' +
        t.vars.map(function (v, j) { return v + '=' + (row.bits[j] ? 'T' : 'F'); }).join(', ') +
        '). Which clause rules that row out?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'A CNF clause exists to be <em>false</em> on its row and true everywhere else, so every ' +
        'literal is <strong>flipped</strong>: a variable that is T in the row appears negated. ' +
        'Row ' + rowNo + ' gives <code>' + right + '</code>. Forgetting to flip is the commonest slip ' +
        'in the topic.',
    };
  } });

  /* ---- Order two growth rates ---- */
  var CQ_GROW = ['1', 'log n', 'sqrt n', 'n', 'n log n', 'n^2', 'n^3', '2^n', 'n!'];
  QZ_GEN.push({ topic: 'complexity', make: function () {
    var i = qzInt(0, CQ_GROW.length - 2), j = qzInt(i + 1, CQ_GROW.length - 1);
    var f = gwParse(CQ_GROW[i]), g = gwParse(CQ_GROW[j]);
    if (!f.ok || !g.ok) throw new Error('retry');
    var flip = Math.random() < 0.5;
    var A = flip ? g : f, B = flip ? f : g;
    var As = flip ? CQ_GROW[j] : CQ_GROW[i], Bs = flip ? CQ_GROW[i] : CQ_GROW[j];
    var r = gwCompare(A, B);

    var say = { 'O': 'f ∈ O(g), and not Θ(g)', 'Omega': 'f ∈ Ω(g), and not Θ(g)', 'Theta': 'f ∈ Θ(g)' };
    return {
      topic: 'complexity · growth rates',
      kind: 'choice',
      prompt: 'With f(n) = <code>' + As + '</code> and g(n) = <code>' + Bs +
        '</code>, which is true?',
      choices: [say.O, say.Omega, say.Theta],
      answer: say[r.verdict],
      check: textCheck(say[r.verdict]),
      explain: 'The ordering is 1 &lt; log n &lt; √n &lt; n &lt; n log n &lt; n² &lt; n³ &lt; 2ⁿ &lt; n!. ' +
        As + ' sits ' + (r.verdict === 'O' ? 'below' : r.verdict === 'Omega' ? 'above' : 'level with') +
        ' ' + Bs + ', so ' + say[r.verdict] + '. Remember O is an upper bound only — it does not ' +
        'say the bound is tight.',
    };
  } });

  /* ---- Which way does a hardness reduction go? ---- */
  QZ_GEN.push({ topic: 'complexity', make: function () {
    var X = qzPick(['CLIQUE', 'HAMILTONIAN', 'the Graph Colouring problem', 'the Knapsack problem']);
    var right = 'SAT ≤ₚ ' + X;
    var choices = [right, X + ' ≤ₚ SAT', X + ' ≤ₚ ' + X, 'SAT ≤ₚ SAT'];
    return {
      topic: 'complexity · reductions',
      kind: 'choice',
      prompt: 'To prove that <strong>' + X + '</strong> is NP-hard, which reduction do you construct?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'To show a problem is <em>hard</em>, reduce a known-hard problem <strong>to</strong> it. ' +
        'X ≤ₚ Y means Y is at least as hard as X, so SAT ≤ₚ ' + X + ' transfers SAT’s hardness ' +
        'upward. Reducing ' + X + ' to SAT would only show ' + X + ' is no <em>harder</em> than SAT.',
    };
  } });

  /* ---- Both halves of NP-completeness ---- */
  QZ_GEN.push({ topic: 'complexity', make: function () {
    var right = 'It is NP-hard, and it is in NP';
    var choices = [right, 'It is NP-hard', 'It is in NP',
      'Every problem in NP reduces to it, and it is not in P'];
    return {
      topic: 'complexity · NP-completeness',
      kind: 'choice',
      prompt: 'What must be shown to prove a problem is <strong>NP-complete</strong>?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Both halves. NP-hard is the lower bound (everything in NP reduces to it); membership ' +
        'in NP is the upper bound (a certificate you can check in polynomial time). Giving only one ' +
        'gives away half the marks — and note that nothing here mentions P, since whether ' +
        'NP-complete problems lie outside P is exactly the open question.',
    };
  } });

  /* ---- How big is G_F? ---- */
  QZ_GEN.push({ topic: 'complexity', make: function () {
    var srcs = [
      '(P | ~Q | R) & (~P | ~Q | ~R) & (P | Q | ~R)',
      '(P | ~Q) & (~P | ~R)',
      '(P | Q) & (~P | R) & (Q | ~R)',
      '(P | Q | R) & (~P | Q)',
    ];
    var src = qzPick(srcs);
    var p = fmParse(src);
    if (!p.ok) throw new Error('retry');
    var cl = fmClauses(p.ast);
    if (!cl.ok) throw new Error('retry');
    var g = rdBuild(cl.clauses);
    var ask = qzPick(['vertices', 'k']);
    var want = ask === 'vertices' ? g.vertices.length : g.k;

    return {
      topic: 'complexity · SAT ≤ₚ CLIQUE',
      prompt: 'Build G<sub>F</sub> for <code>' + esc(src) + '</code>. How many <strong>' +
        (ask === 'vertices' ? 'vertices' : 'vertices must the clique have (k)') + '</strong>?',
      placeholder: 'a whole number',
      answer: String(want),
      check: cqNum(want),
      explain: ask === 'vertices'
        ? 'One vertex per literal <em>occurrence</em>, not per literal: ' +
          cl.clauses.map(function (c) { return c.length; }).join(' + ') + ' = ' + g.vertices.length + '.'
        : 'k is the number of clauses — ' + g.k + ' — because a clique must take exactly one literal ' +
          'from each clause, which is what "every clause has a true literal" means.',
    };
  } });

  /* ---- Satisfiable, and does the graph agree? ---- */
  QZ_GEN.push({ topic: 'complexity', make: function () {
    var srcs = [
      '(P) & (~P)',
      '(P | Q) & (~P | Q) & (P | ~Q) & (~P | ~Q)',
      '(P | ~Q | R) & (~P | ~Q | ~R) & (P | Q | ~R)',
      '(P | Q) & (~P | ~Q)',
    ];
    var src = qzPick(srcs);
    var p = fmParse(src);
    if (!p.ok) throw new Error('retry');
    var cl = fmClauses(p.ast);
    if (!cl.ok) throw new Error('retry');
    var chk = rdCheck(cl.clauses);

    var yes = 'Yes — it has a clique of size ' + chk.g.k;
    var no = 'No — its largest clique is smaller than ' + chk.g.k;
    return {
      topic: 'complexity · SAT ≤ₚ CLIQUE',
      kind: 'choice',
      prompt: 'For <code>' + esc(src) + '</code>, does G<sub>F</sub> contain a clique of size k?',
      choices: [yes, no],
      answer: chk.clique ? yes : no,
      check: textCheck(chk.clique ? yes : no),
      explain: 'F is ' + (chk.sat ? 'satisfiable' : 'unsatisfiable') + ', and the reduction guarantees ' +
        'the graph agrees: F is satisfiable exactly when G<sub>F</sub> has a clique of size k. ' +
        (chk.clique
          ? 'The clique is ' + chk.clique.map(function (i) { return chk.g.vertices[i].label; }).join(', ') + '.'
          : 'Every set of ' + chk.g.k + ' vertices either repeats a clause or contains a literal and its negation.'),
    };
  } });
