  /* ---------- Topic 08 · linear and integer programming ----------

     Marked by running the engines: the optimum questions by solving
     the program, the tableau questions by actually pivoting, the
     reduction questions by building the constraint.
     ------------------------------------------------------------ */

  function lpNumCheck(target) {
    return function (v) {
      var s = String(v).trim().replace(/,/g, '');
      var f = frParse(s);
      if (!f) return { ok: false, msg: 'Give a number, as a fraction like <code>13/3</code> or a decimal.' };
      return { ok: frCmp(f, target) === 0 };
    };
  }

  /** A random two-variable program with a bounded region and a corner optimum. */
  function lpRandomProgram() {
    for (var tries = 0; tries < 60; tries++) {
      var a = qzInt(1, 4), b = qzInt(1, 4), c = qzInt(6, 20);
      var d = qzInt(1, 4), e = qzInt(1, 4), g = qzInt(6, 20);
      var p = qzInt(1, 6), q = qzInt(1, 6);
      var text = 'max ' + p + 'x + ' + q + 'y\n' +
        a + 'x + ' + b + 'y <= ' + c + '\n' +
        d + 'x + ' + e + 'y <= ' + g;
      var lp = lpParse(text);
      if (!lp.ok) continue;
      var sol = lpSolveByVertices(lp);
      if (!sol.ok || sol.status !== 'optimal') continue;
      if (sol.verts.length < 3) continue;
      return { text: text, lp: lp, sol: sol };
    }
    return null;
  }

  /* ---- What is the optimum? ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var r = lpRandomProgram();
    if (!r) return null;
    return {
      topic: 'linprog · the optimum',
      kind: 'text',
      prompt: 'For the linear program<br><code>' + esc(r.text).replace(/\n/g, '<br>') +
        '</code><br>with x, y ≥ 0, what is the maximum value of the objective?',
      answer: frShow(r.sol.obj),
      check: lpNumCheck(r.sol.obj),
      explain: 'The feasible region has ' + r.sol.verts.length + ' vertices: ' +
        r.sol.verts.map(function (v) {
          return '(' + frShow(v.x[0]) + ', ' + frShow(v.x[1]) + ') giving ' + frShow(v.obj);
        }).join('; ') + '. The optimum of a linear objective over a convex region is always at a ' +
        'vertex, so the answer is the best of those: <strong>' + frShow(r.sol.obj) + '</strong> at ' +
        '(' + frShow(r.sol.x[0]) + ', ' + frShow(r.sol.x[1]) + '). Remember x ≥ 0 and y ≥ 0 are ' +
        'constraints too — two of the edges come from them.'
    };
  } });

  /* ---- How many vertices? ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var r = lpRandomProgram();
    if (!r) return null;
    var n = r.sol.verts.length;
    var choices = [n];
    while (choices.length < 4) {
      var c = n + qzInt(-2, 3);
      if (c >= 2 && choices.indexOf(c) < 0) choices.push(c);
    }
    return {
      topic: 'linprog · counting corners',
      kind: 'choice',
      prompt: 'How many vertices does the feasible region of<br><code>' +
        esc(r.text).replace(/\n/g, '<br>') + '</code><br>have, counting the ones on the axes?',
      choices: choices.sort(function (a, b) { return a - b; }).map(String),
      answer: String(n),
      check: textCheck(String(n)),
      explain: 'There are ' + n + ': ' + r.sol.verts.map(function (v) {
        return '(' + frShow(v.x[0]) + ', ' + frShow(v.x[1]) + ')';
      }).join(', ') + '. Each is where two constraint boundaries cross — and x ≥ 0, y ≥ 0 count as ' +
      'boundaries, which is where the origin and the two axis points come from.'
    };
  } });

  /* ---- Slack form ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var a = qzInt(1, 5), b = qzInt(1, 5), c = qzInt(5, 20);
    var flip = Math.random() < 0.5;
    var lhs = flip ? (b + 'y - ' + a + 'x') : (a + 'x + ' + b + 'y');
    var right = flip ? ('s = ' + c + ' + ' + a + 'x - ' + b + 'y')
                     : ('s = ' + c + ' - ' + a + 'x - ' + b + 'y');
    var wrong = flip ? ('s = ' + c + ' - ' + a + 'x - ' + b + 'y')
                     : ('s = ' + c + ' + ' + a + 'x - ' + b + 'y');
    var choices = [right, wrong,
                   's = ' + a + 'x + ' + b + 'y - ' + c,
                   's = ' + c + ' + ' + a + 'x + ' + b + 'y'];
    return {
      topic: 'linprog · slack form',
      kind: 'choice',
      prompt: 'Introducing a slack variable for the constraint <code>' + lhs + ' &le; ' + c +
        '</code>, what is s equal to?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'The slack variable measures the room left in the constraint, so the equation is ' +
        '<code>' + lhs + ' + s = ' + c + '</code> and therefore <strong>' + right + '</strong>. ' +
        'Rearranging is where signs go wrong: every term moved across the equals sign changes sign. ' +
        's ≥ 0 exactly when the constraint holds, and s = 0 exactly when it is tight.'
    };
  } });

  /* ---- Which column does simplex pivot on? ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var r = lpRandomProgram();
    if (!r) return null;
    var run = spRun(r.lp, { check: false });
    if (!run.ok || !run.rounds[1] || run.rounds[1].pc === undefined) return null;
    var pc = run.rounds[1].pc;
    var right = run.labels[pc];
    var cost = run.rounds[0].T[run.m];
    return {
      topic: 'linprog · choosing the pivot column',
      kind: 'choice',
      prompt: 'The initial cost row of a tableau with columns ' +
        run.labels.slice(0, run.n + run.m).join(', ') + ' reads<br><code>' +
        run.labels.slice(0, run.n + run.m).map(function (l, i) {
          return l + ': ' + frShow(cost[i]);
        }).join(' &nbsp; ') + '</code><br>Which column does step 2 select?',
      choices: run.labels.slice(0, run.n + run.m),
      answer: right,
      check: textCheck(right),
      explain: 'Step 2 takes the <strong>most negative</strong> coefficient in the final row, which ' +
        'is ' + frShow(cost[pc]) + ' in the ' + right + ' column. A negative entry means increasing ' +
        'that variable increases the cost, so a row with no negative entries left is one where ' +
        'nothing can be improved — that is the stopping condition.'
    };
  } });

  /* ---- Row quotients and the degenerate trap ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var right = 'the row with the smallest quotient, allowing a numerator of zero';
    var choices = [
      right,
      'the row with the smallest quotient, requiring a strictly positive numerator',
      'the row with the largest quotient',
      'the row with the largest entry in the pivot column'
    ];
    return {
      topic: 'linprog · choosing the pivot row',
      kind: 'choice',
      prompt: 'Which row should step 4 of the simplex method select?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'The quotient says how far the entering variable can grow before that row&rsquo;s ' +
        'basic variable hits zero, so the smallest one is the first constraint you run into. The ' +
        'denominator must be positive, but the numerator only has to be <strong>non-negative</strong>. ' +
        'One common phrasing asks for both to be positive, which skips a row whose right-hand side is ' +
        'zero — and on a degenerate problem that is exactly the row that must be chosen, after which ' +
        'the tableau describes a corner outside the feasible region.'
    };
  } });

  /* ---- Branch and bound: the two subproblems ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var whole = qzInt(1, 6), den = qzPick([2, 3, 4]);
    var num = whole * den + qzInt(1, den - 1);
    var v = qzPick(['x', 'y']);
    var right = v + ' ≤ ' + whole + ' and ' + v + ' ≥ ' + (whole + 1);
    var choices = [
      right,
      v + ' ≤ ' + (whole + 1) + ' and ' + v + ' ≥ ' + whole,
      v + ' = ' + whole + ' and ' + v + ' = ' + (whole + 1),
      v + ' ≤ ' + whole + ' and ' + v + ' ≥ ' + whole
    ];
    return {
      topic: 'linprog · branching',
      kind: 'choice',
      prompt: 'A linear relaxation returns <code>' + v + ' = ' + num + '/' + den +
        '</code>. Which two subproblems does branch-and-bound create?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: num + '/' + den + ' = ' + (num / den).toFixed(4) + ', so ⌊·⌋ = ' + whole +
        ' and ⌈·⌉ = ' + (whole + 1) + ', giving <strong>' + right + '</strong>. The two branches are ' +
        'disjoint and between them keep every integer point: nothing whole lies strictly between ' +
        whole + ' and ' + (whole + 1) + ', so cutting out the fractional strip loses no solutions. ' +
        'Using ≤ ⌈·⌉ and ≥ ⌊·⌋ instead would overlap and would leave the fractional value in both.'
    };
  } });

  /* ---- Integer optimum versus the relaxation ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var r = lpRandomProgram();
    if (!r) return null;
    var bb = ipBranchBound(r.lp, { bound: true, cap: 150 });
    if (!bb.ok || !bb.best) return null;
    var brute = ipBrute(r.lp);
    if (!brute.ok || !brute.obj || frCmp(brute.obj, bb.obj) !== 0) return null;
    return {
      topic: 'linprog · the integer optimum',
      kind: 'text',
      prompt: 'For<br><code>' + esc(r.text).replace(/\n/g, '<br>') +
        '</code><br>with x, y ≥ 0 <strong>and both required to be whole numbers</strong>, what is the ' +
        'maximum value of the objective?',
      answer: frShow(bb.obj),
      check: lpNumCheck(bb.obj),
      explain: 'The linear relaxation gives ' + frShow(r.sol.obj) + ' at (' + frShow(r.sol.x[0]) +
        ', ' + frShow(r.sol.x[1]) + '). ' +
        (frCmp(r.sol.obj, bb.obj) === 0
          ? 'That happens to be integral already, so it is also the integer optimum.'
          : 'Branch-and-bound then brings it down to <strong>' + frShow(bb.obj) + '</strong> at (' +
            frShow(bb.x[0]) + ', ' + frShow(bb.x[1]) + '), which checking all ' + brute.feasible +
            ' feasible lattice points confirms. Note the relaxation is an upper bound and never a ' +
            'lower one — rounding it down is not a reliable shortcut, and the integer optimum is ' +
            'often at a quite different point.')
    };
  } });

  /* ---- The SAT reduction ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var vs = ['P', 'Q', 'R', 'S'];
    var k = qzInt(2, 3);
    var lits = [], seen = {};
    while (lits.length < k) {
      var v = qzPick(vs);
      if (seen[v]) continue;
      seen[v] = true;
      lits.push(Math.random() < 0.5 ? '~' + v : v);
    }
    var red = ipFromCnf([lits]);
    var right = red.clauseRows[0];
    var shown = lits.map(function (l) {
      return l.charAt(0) === '~' ? '¬' + l.slice(1) : l;
    }).join(' ∨ ');
    var wrongs = [
      right.replace('>= 1', '<= 1'),
      right.replace(/ \+ /g, ' × '),
      red.clauseRows[0].replace(/xN/g, 'x') + ' (negations ignored)'
    ];
    return {
      topic: 'linprog · SAT ≤p IP',
      kind: 'choice',
      prompt: 'Under the reduction from SAT to integer programming, what linear constraint does the ' +
        'clause <code>(' + shown + ')</code> become?',
      choices: [right].concat(wrongs).sort(),
      answer: right,
      check: textCheck(right),
      explain: 'A clause is satisfied when <em>at least one</em> of its literals is true, and each ' +
        'literal has its own numerical variable, so the constraint is that their sum is at least 1: ' +
        '<strong>' + right + '</strong>. Note ¬R gets its own variable x<sub>¬R</sub> rather than ' +
        'appearing as 1 − x<sub>R</sub>; the link between the two is made separately by the pair ' +
        'x<sub>R</sub> + x<sub>¬R</sub> ≤ 1 and ≥ 1, which forces exactly one of them to be 1.'
    };
  } });

  /* ---- The two theorems ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var items = [
      { q: 'What did Klee and Minty show in 1972?',
        a: 'The simplex method takes exponential time in the worst case',
        w: ['Linear programming is NP-hard',
            'Linear programming is solvable in polynomial time',
            'Integer programming is undecidable'],
        e: 'They built a linear program whose feasible region is a distorted cube, on which the ' +
           'most-negative-coefficient rule visits all 2<sup>n+1</sup> vertices before stopping. It is ' +
           'a statement about one <em>algorithm</em>, not about the problem.' },
      { q: 'What did Khachiyan show in 1979?',
        a: 'Linear programming is solvable in polynomial time',
        w: ['The simplex method is polynomial',
            'Linear programming is NP-complete',
            'Integer programming is in P'],
        e: 'By the ellipsoid method — a different algorithm entirely. It does not make simplex ' +
           'polynomial; simplex is still exponential in the worst case and still the one people run.' },
      { q: 'What is the complexity of integer programming?',
        a: 'NP-hard',
        w: ['In P', 'Undecidable', 'Solvable in polynomial time by the simplex method'],
        e: 'By the reduction SAT ≤<sub>p</sub> IP. Note the claim is NP-<em>hard</em>: hardness is ' +
           'all a reduction from an NP-complete problem gives you, and membership of NP would need ' +
           'the extra argument that a solution is polynomially large.' }
    ];
    var it = qzPick(items);
    return {
      topic: 'linprog · the named results',
      kind: 'choice',
      prompt: it.q,
      choices: [it.a].concat(it.w).sort(),
      answer: it.a,
      check: textCheck(it.a),
      explain: it.e
    };
  } });

  /* ---- Reading a final tableau ---- */
  QZ_GEN.push({ topic: 'linprog', make: function () {
    var r = lpRandomProgram();
    if (!r) return null;
    var run = spRun(r.lp, { check: false });
    if (!run.ok || run.status !== 'optimal') return null;
    var slacks = run.labels.slice(run.n, run.n + run.m);
    var zero = slacks.filter(function (l) { return frZero(run.read.vals[l]); });
    if (!zero.length || zero.length === slacks.length) return null;
    var right = 'that constraint is tight — the solution lies exactly on its boundary';
    var choices = [
      right,
      'that constraint is not tight and has room to spare',
      'that constraint was never used',
      'the program has no solution'
    ];
    return {
      topic: 'linprog · reading the tableau',
      kind: 'choice',
      prompt: 'In the final tableau the slack variable <code>' + zero[0] +
        '</code> reads 0. What does that tell you?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'A slack variable is the room left in its constraint, so a slack of zero means there ' +
        'is none: <strong>' + right + '</strong>. That is the algebra behind the geometry — the ' +
        'optimum sits at a vertex, and a vertex is where n constraint boundaries meet, so exactly ' +
        'n of the variables read zero.'
    };
  } });
