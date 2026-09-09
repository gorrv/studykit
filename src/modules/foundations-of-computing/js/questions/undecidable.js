  /* ---------- Topic 10 · undecidability ----------

     Marked by running the engines where there is anything to run:
     the enumeration questions by indexing words, the diagonal
     questions by building the table and computing L.
     ------------------------------------------------------------ */

  /* ---- Indexing the enumeration ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var i = qzInt(0, 30);
    var w = enWordAt(i);
    if (!w.ok) return null;
    return {
      topic: 'undecidable · enumerating Σ*',
      kind: 'text',
      prompt: 'Words over {0, 1} are listed shortest first, alphabetically within each length: ' +
        '<code>ε, 0, 1, 00, 01, 10, 11, 000, …</code><br>What is w<sub>' + i + '</sub>? ' +
        '(Write <code>ε</code> for the empty word.)',
      answer: w.word === '' ? 'ε' : w.word,
      check: function (v) {
        var s = String(v).trim();
        if (s === 'ε' || s === '' || /^(eps|epsilon|empty)$/i.test(s)) return { ok: w.word === '' };
        return { ok: s === w.word };
      },
      explain: 'There are 2<sup>L</sup> words of length L, so 1 + 2 + 4 + … words come before each ' +
        'block. Index ' + i + ' lands on <strong>' + (w.word === '' ? 'ε' : w.word) + '</strong>. ' +
        'The listing has to be a bijection for "the i-th word" to mean anything — which is exactly ' +
        'what the diagonal argument relies on.'
    };
  } });

  /* ---- Is this language decidable? ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var p = qzPick(UD_PROBLEMS);
    var right = 'Undecidable';
    return {
      topic: 'undecidable · the catalogue',
      kind: 'choice',
      prompt: 'Is <strong>' + p.name + '</strong> — ' + p.output.replace(/^True if and only if /, '') +
        ' — decidable?',
      choices: ['Undecidable', 'Decidable', 'Decidable but only in exponential time'].sort(),
      answer: right,
      check: textCheck(right),
      explain: '<strong>Undecidable.</strong> ' + p.how.charAt(0).toUpperCase() + p.how.slice(1) +
        '. Note this is not a statement about cost: an undecidable problem is not one that takes a ' +
        'long time, it is one for which no algorithm exists at all.'
    };
  } });

  /* ---- The direction of a reduction ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var right = 'Reduce HALT to B';
    var choices = [right, 'Reduce B to HALT', 'Show B is in NP', 'Show B has no polynomial algorithm'];
    return {
      topic: 'undecidable · reductions',
      kind: 'choice',
      prompt: 'You want to prove a new problem B is undecidable, and you already know ' +
        'HALT<sub>TM</sub> is. What do you do?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Reduce the <em>known-undecidable</em> problem to the new one: <strong>HALT ≤ B</strong>. ' +
        'Then a decider for B would give a decider for HALT, which cannot exist, so B has none either. ' +
        'Reducing B to HALT is the common error and proves nothing — it only shows B is no harder ' +
        'than something already impossible.'
    };
  } });

  /* ---- Decidable vs recognisable ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var items = [
      { q: 'A machine that is sound, complete and terminating shows its language is…',
        a: 'decidable',
        w: ['recognisable but not decidable', 'undecidable', 'regular'],
        e: 'All three conditions together are the definition of decidable.' },
      { q: 'A machine that is sound and complete but may run forever shows its language is…',
        a: 'recognisable',
        w: ['decidable', 'undecidable', 'finite'],
        e: 'Sound and complete without termination gives recognisability, sometimes called ' +
           'semi-decidability. HALT<sub>TM</sub> is recognisable: simulate the machine and accept if ' +
           'it stops. What you can never do is say "no", because more waiting is always possible.' },
      { q: 'HALT<sub>TM</sub> is…',
        a: 'recognisable but not decidable',
        w: ['decidable', 'neither recognisable nor decidable', 'regular'],
        e: 'Simulating gives a machine that accepts exactly the halting pairs, so HALT is ' +
           'recognisable. The diagonal argument shows no machine decides it. Its complement is not ' +
           'even recognisable — if both were, the language would be decidable.' }
    ];
    var it = qzPick(items);
    return {
      topic: 'undecidable · decidable vs recognisable',
      kind: 'choice',
      prompt: it.q,
      choices: [it.a].concat(it.w).sort(),
      answer: it.a,
      check: textCheck(it.a),
      explain: it.e
    };
  } });

  /* ---- The diagonal, computed ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var n = qzInt(4, 5), rows = [];
    for (var i = 0; i < n; i++) {
      var r = [];
      for (var j = 0; j < n; j++) r.push(Math.random() < 0.5 ? '✓' : '✗');
      rows.push(r);
    }
    var g = dgParse(rows.map(function (r) { return r.join(' '); }).join('\n'));
    if (!g.ok) return null;
    var d = dgDiagonal(g);
    var answer = d.members.length ? d.members.map(function (i2) { return 'w' + i2; }).join(', ') : 'none';

    var grid = '<table class="qz-grid"><tr><th></th>' +
      rows[0].map(function (_, j) { return '<th>w' + j + '</th>'; }).join('') + '</tr>' +
      rows.map(function (r, i2) {
        return '<tr><th>M' + i2 + '</th>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') +
          '</tr>';
      }).join('') + '</table>';

    return {
      topic: 'undecidable · diagonalisation',
      kind: 'text',
      prompt: 'A ✓ means M<sub>i</sub> accepts w<sub>j</sub>.' + grid +
        'L = { w<sub>i</sub> : M<sub>i</sub> does not accept w<sub>i</sub> }. Which of ' +
        'w<sub>0</sub>…w<sub>' + (n - 1) + '</sub> are in L? (comma separated, or <code>none</code>)',
      answer: answer,
      check: function (v) {
        var s = String(v).toLowerCase().replace(/\s|w/g, '');
        var want = d.members.join(',');
        if (!d.members.length) return { ok: /^(none|-|∅)$/.test(s) || s === '' };
        return { ok: s.split(',').filter(Boolean).sort().join(',') === want.split(',').sort().join(',') };
      },
      explain: 'Read down the diagonal — the cell where row i meets column i — and take the words ' +
        'where it is ✗. The diagonal here is ' +
        d.diag.map(function (x) { return x ? '✓' : '✗'; }).join(' ') + ', so L holds <strong>' +
        answer + '</strong>. Every row now differs from L at its own column, which is why no machine ' +
        'on the list can have L as its language.'
    };
  } });

  /* ---- The halting construction ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var right = 'It loops forever';
    var choices = [right, 'It accepts', 'It rejects', 'It returns the value halt gave it'];
    return {
      topic: 'undecidable · the halting proof',
      kind: 'choice',
      prompt: 'In the halting proof, M* asks <code>halt</code> whether the input halts on itself. ' +
        'If <code>halt</code> answers <strong>yes</strong>, what does M* do?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'M* does the <em>opposite</em> of the prediction: told "halts", it loops. Fed its own ' +
        'code, it therefore halts exactly when it does not, and the only assumption available to ' +
        'blame is that <code>halt</code> exists.'
    };
  } });

  /* ---- Church–Turing ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var right = 'A thesis — it identifies an informal notion with a formal one, so it cannot be proved';
    var choices = [right,
      'A theorem, proved by Turing in 1936',
      'A conjecture that was disproved',
      'An axiom of set theory'];
    return {
      topic: 'undecidable · Church–Turing',
      kind: 'choice',
      prompt: 'What kind of statement is the Church–Turing thesis?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'It claims that anything <em>effectively computable by a finite process</em> — an ' +
        'informal idea — is computable by a Turing machine, a formal one. There is nothing to prove ' +
        'against, only evidence: every model of computation anyone has proposed has turned out ' +
        'equivalent. Calling it a theorem is a common slip.'
    };
  } });

  /* ---- Undecidable is not NP-hard ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var right = 'Every NP-hard problem in this course is decidable; undecidable ones have no algorithm at all';
    var choices = [right,
      'They are the same thing',
      'Undecidable problems are a subset of NP-hard ones',
      'NP-hard problems are undecidable in the worst case'];
    return {
      topic: 'undecidable · what it is not',
      kind: 'choice',
      prompt: 'How does undecidable differ from NP-hard?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Different axes. SAT is NP-complete and perfectly decidable — try every assignment; it ' +
        'takes exponential time but it terminates. HALT is undecidable: no procedure terminates with ' +
        'the right answer on every input, at any cost. "Hard" and "impossible" are not the same claim.'
    };
  } });

  /* ---- The Entscheidungsproblem ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var items = [
      { q: 'What does the Entscheidungsproblem ask?',
        a: 'Given a predicate formula F, is F a tautology?',
        w: ['Given a propositional formula F, is F satisfiable?',
            'Given a machine M, does M halt?',
            'Given two machines, do they accept the same language?'],
        e: 'It asks about <em>validity</em> in predicate logic. Hilbert posed it in 1928; Turing ' +
           'answered it in 1936, inventing the machines as the means to do so.' },
      { q: 'Why does the proof need predicate logic rather than propositional logic?',
        a: 'Only ∃t can express "the machine eventually accepts" in a finite formula',
        w: ['Propositional logic is undecidable too',
            'Predicate formulas are shorter',
            'Cook–Levin does not apply to propositional logic'],
        e: 'Cook–Levin gives a propositional formula for "accepts within a bounded number of steps". ' +
           'Removing the bound would need an infinite disjunction S<sub>q</sub>(0) ∨ S<sub>q</sub>(1) ∨ …, ' +
           'which is not a formula. Making time an argument turns that into <strong>∃t ' +
           'S<sub>q</sub>(t)</strong>, which is.' }
    ];
    var it = qzPick(items);
    return {
      topic: 'undecidable · the Entscheidungsproblem',
      kind: 'choice',
      prompt: it.q,
      choices: [it.a].concat(it.w).sort(),
      answer: it.a,
      check: textCheck(it.a),
      explain: it.e
    };
  } });

  /* ---- Why the counting argument is not enough ---- */
  QZ_GEN.push({ topic: 'undecidable', make: function () {
    var right = 'It shows undecidable languages exist, but does not exhibit one';
    var choices = [right,
      'It is circular',
      'It only works for finite alphabets',
      'It proves the opposite of what is wanted'];
    return {
      topic: 'undecidable · counting',
      kind: 'choice',
      prompt: 'There are countably many Turing machines and uncountably many languages, so some ' +
        'language has no machine. Why is the diagonal construction still needed?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'The counting argument is pure existence: it tells you machines run out before ' +
        'languages do, and nothing about <em>which</em> languages are missed. The diagonal ' +
        'construction names one, and the halting proof names one anybody cares about.'
    };
  } });
