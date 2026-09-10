  /* ============================================================
     TOPIC 10 · diagonalisation, halting, and the catalogue
     ------------------------------------------------------------
     Three arguments, each of which is a machine being handed a
     description of itself.

       - Diagonalisation builds a language that disagrees with
         every machine on the list, at the one word indexed by
         that machine.
       - The halting proof builds a machine that does the opposite
         of what halt predicts about it.
       - Every other undecidable problem here reduces from one of
         those two.

     The grid, the diagonal and the contradiction are all computed
     rather than described, so a claim like "no row equals L" is
     checked against every row rather than asserted.
     ============================================================ */

  /**
     The standard table: rows are machines, columns are
     words, and a cell says whether M_i accepts w_j.

     Written with ✓ and ✗ (or 1 and 0, or the 3 and 7 sometimes used,
     which are a checkmark and a cross in the font it was set in).
  */
  function dgParse(text) {
    var lines = String(text || '').split(/\n+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s && s.charAt(0) !== '#'; });
    if (!lines.length) return { ok: false, error: 'Give one row per machine.' };

    var rows = [], width = null;
    for (var i = 0; i < lines.length; i++) {
      var cells = [];
      var raw = lines[i].replace(/[\s,]/g, '');
      for (var j = 0; j < raw.length; j++) {
        var c = raw.charAt(j);
        if (c === '✓' || c === '1' || c === 'y' || c === 'Y' || c === '3') cells.push(true);
        else if (c === '✗' || c === 'x' || c === 'X' || c === '0' || c === 'n' || c === 'N' || c === '7') cells.push(false);
        else return { ok: false, error: 'Row ' + (i + 1) + ': cannot read <code>' + esc(c) +
          '</code>. Use ✓/1/y for accepts and ✗/0/n for does not.' };
      }
      if (!cells.length) continue;
      if (width === null) width = cells.length;
      else if (cells.length !== width) {
        return { ok: false, error: 'Row ' + (i + 1) + ' has ' + cells.length + ' cells but row 1 has ' +
          width + '. The table must be rectangular for the diagonal to exist.' };
      }
      rows.push(cells);
    }
    if (!rows.length) return { ok: false, error: 'No rows found.' };
    if (width < rows.length) {
      return { ok: false, error: 'The diagonal needs at least as many columns as rows: there are ' +
        rows.length + ' machines but only ' + width + ' words.' };
    }
    return { ok: true, rows: rows, n: rows.length, width: width };
  }

  /**
     L = { w_i : M_i does not accept w_i }.

     Then check the point of the whole construction: L differs
     from the language of every machine on the list, and it does
     so at a named word. That is computed here for each row rather
     than argued, so the tool can say WHERE they differ.
  */
  function dgDiagonal(g) {
    if (!g.ok) return g;
    /* One source of truth. inL and members were computed separately
       here, which meant a fault could put them out of step and still
       satisfy a test that only looked at one of them — so members is
       now read off inL rather than recomputed from the diagonal. */
    var diag = [], inL = [];
    for (var i = 0; i < g.n; i++) {
      var accepts = g.rows[i][i];
      diag.push(accepts);
      inL.push(!accepts);
    }
    var members = [];
    inL.forEach(function (yes, i2) { if (yes) members.push(i2); });

    /* Does any machine's row agree with L everywhere it can be
       compared? It cannot -- row i differs from L at column i by
       construction -- but checking is the point. */
    var clashes = [];
    for (var r = 0; r < g.n; r++) {
      var differsAt = [];
      for (var c = 0; c < g.n; c++) {
        if (g.rows[r][c] !== inL[c]) differsAt.push(c);
      }
      clashes.push({
        row: r,
        differsAt: differsAt,
        equalsL: differsAt.length === 0,
        diagonalWitness: differsAt.indexOf(r) >= 0
      });
    }

    return {
      ok: true, grid: g, diag: diag, inL: inL, members: members, clashes: clashes,
      anyRowEqualsL: clashes.some(function (c) { return c.equalsL; }),
      everyRowDiffersOnDiagonal: clashes.every(function (c) { return c.diagonalWitness; }),
      note: 'L is built to disagree with M<sub>i</sub> at w<sub>i</sub>, so no row can equal it. ' +
        'That is the whole proof: a language no machine on the list recognises, and the list was ' +
        'every machine there is.'
    };
  }

  /** The standard table, so the tool starts on the figure being explained. */
  var DG_PRESET =
    '# the standard halting table: ✓ = M_i accepts w_j, ✗ = it does not\n' +
    '✓ ✗ ✓ ✓ ✗ ✓ ✗ ✗ ✓\n' +
    '✗ ✗ ✓ ✗ ✗ ✓ ✓ ✗ ✗\n' +
    '✓ ✗ ✗ ✓ ✓ ✗ ✓ ✓ ✗\n' +
    '✗ ✓ ✓ ✓ ✗ ✓ ✗ ✗ ✓\n' +
    '✗ ✓ ✗ ✓ ✗ ✗ ✗ ✓ ✗\n';

  /* ---------- the halting problem ---------- */

  /**
     The contradiction, worked both ways.

     M*(w) accepts exactly when halt says w does not halt on
     itself, and loops otherwise. Feed M* its own code and both
     assumptions about what halt returns are self-defeating.
     Enumerated rather than described, so there is nowhere for a
     hand-wave to hide.
  */
  function hpContradiction() {
    var cases = [true, false].map(function (haltSays) {
      // haltSays: does halt claim M* halts on code(M*)?
      var haltReturns = haltSays ? 1 : 0;
      // M* accepts (and so halts) exactly when halt returns 0
      var actuallyHalts = haltReturns === 0;
      return {
        assumption: haltSays,
        haltReturns: haltReturns,
        behaviour: actuallyHalts ? 'accepts, and so halts' : 'enters the loop, and so does not halt',
        actuallyHalts: actuallyHalts,
        consistent: actuallyHalts === haltSays
      };
    });
    return {
      ok: true, cases: cases,
      contradictory: cases.every(function (c) { return !c.consistent; }),
      note: 'Both branches contradict, so the only assumption that can be wrong is the one we started ' +
        'from: that <code>halt</code> exists at all. Note what is NOT concluded — halting is not ' +
        '"hard", and no cleverer algorithm will do it. There is no such algorithm.'
    };
  }

  /**
     Halting, attempted honestly, on a real machine.

     There are three outcomes, not two, and the third is the
     undecidability made concrete: the simulator can prove a
     machine halts (it did), can sometimes prove it never will (it
     returned to a configuration it had already been in, so it
     will repeat forever), and otherwise has to say it does not
     know. No step cap can turn that third answer into one of the
     first two.
  */
  function hpAttempt(m, word, cap) {
    var run = tmRun(m, word, cap || 400);
    var known = run.verdict === 'accept' || run.verdict === 'reject';
    var provenLoop = run.verdict === 'looping';
    return {
      ok: true, verdict: run.verdict, steps: run.configs.length - 1,
      answer: known ? 'halts' : (provenLoop ? 'never halts' : 'unknown'),
      proven: known || provenLoop,
      why: known
        ? 'It reached ' + run.verdict + ' after ' + (run.configs.length - 1) + ' steps, so it halts. ' +
          'This is a proof: we watched it happen.'
        : (provenLoop
            ? 'It returned to a configuration it had already been in — same state, same tape, same ' +
              'head position — so it will do exactly the same thing again forever. This is also a ' +
              'proof, and it is why some non-halting machines can be detected.'
            : 'It was still running after ' + cap + ' steps and has not repeated a configuration. ' +
              'That is not evidence either way. Raising the cap moves the boundary; it never removes ' +
              'it, because a machine that halts at step cap + 1 looks exactly like one that never ' +
              'halts.'),
      run: run
    };
  }

  /* ---------- the catalogue ---------- */

  var UD_PROBLEMS = [
    { id: 'HALT', name: 'HALT<sub>TM</sub>',
      input: 'an encoding code(M) and a word w',
      output: 'True iff M terminates on input w',
      set: '{ ⟨code(M), w⟩ : M terminates on input w }',
      status: 'undecidable',
      how: 'the diagonal construction: build M* that loops exactly when halt says it stops, then feed ' +
           'it its own code' },
    { id: 'A', name: 'A<sub>TM</sub>',
      input: 'an encoding code(M) and a word w',
      output: 'True iff M accepts w',
      set: '{ ⟨code(M), w⟩ : M(w) = 1 }',
      status: 'undecidable',
      how: 'a decider for A would let you decide HALT, by also running M on w and seeing which way it went' },
    { id: 'R', name: 'R<sub>TM</sub>',
      input: 'an encoding code(M) and a word w',
      output: 'True iff M rejects w',
      set: '{ ⟨code(M), w⟩ : M(w) = 0 }',
      status: 'undecidable',
      how: 'swap the accept and reject states of M and you have turned R into A' },
    { id: 'E', name: 'E<sub>TM</sub>',
      input: 'an encoding code(M)',
      output: 'True iff M accepts nothing at all',
      set: '{ code(M) : Language(M) = ∅ }',
      status: 'undecidable',
      how: 'from A: build a machine that ignores its input and simulates M on w, so its language is ' +
           'empty exactly when M does not accept w' },
    { id: 'EQ', name: 'EQ<sub>TM</sub>',
      input: 'two encodings code(M₁) and code(M₂)',
      output: 'True iff the two machines accept the same language',
      set: '{ ⟨code(M₁), code(M₂)⟩ : Language(M₁) = Language(M₂) }',
      status: 'undecidable',
      how: 'from E: take M₂ to be a machine that accepts nothing, and EQ answers emptiness' },
    { id: 'REG', name: 'REGULAR<sub>TM</sub>',
      input: 'an encoding code(M)',
      output: 'True iff the language of M is regular',
      set: '{ code(M) : Language(M) is regular }',
      status: 'undecidable',
      how: 'a property of the LANGUAGE rather than the machine, which by Rice’s theorem is undecidable ' +
           'for every property that is neither always nor never true' },
    { id: 'ENTS', name: 'the Entscheidungsproblem',
      input: 'a formula F of predicate logic',
      output: 'True iff F is a tautology',
      set: '{ F : F is valid }',
      status: 'undecidable',
      how: 'Cook–Levin writes "M accepts w within t steps" as a formula; predicate logic’s ∃t turns ' +
           'that into "M eventually accepts", so A reduces to the complement of validity' }
  ];

  /**
     A reduction only transfers undecidability one way, and getting
     the direction backwards is the standard way to lose the marks.
     A <= B and A undecidable gives B undecidable; it says nothing
     about A when B is undecidable.
  */
  function udDirection(fromUndecidable, toUnknown, claim) {
    var valid = claim === 'to-is-undecidable';
    return {
      ok: true, valid: valid,
      note: valid
        ? 'Correct. A reduction from a problem already known to be undecidable shows the TARGET is ' +
          'undecidable: if you could decide ' + toUnknown + ', the reduction would let you decide ' +
          fromUndecidable + ', which cannot be done.'
        : 'Backwards. Reducing ' + fromUndecidable + ' to ' + toUnknown + ' tells you about ' +
          toUnknown + ', not about ' + fromUndecidable + '. The hardness flows along the arrow, ' +
          'from the problem you already know is hard to the one you are asking about.'
    };
  }

  /* ---------- decidable vs recognisable ----------

     The usual write-up defines decidable as sound + complete + terminating
     and leaves it there. Dropping only the third gives
     RECOGNISABLE, and the distinction is what makes HALT
     interesting: it is recognisable but not decidable, because you
     can confirm a "yes" by simulating and waiting, and can never
     confirm a "no".
  */
  var UD_CLASSES = [
    { id: 'decidable', label: 'Decidable',
      needs: ['sound', 'complete', 'terminating'],
      blurb: 'some machine always halts and always gives the right answer' },
    { id: 'recognisable', label: 'Recognisable (semi-decidable)',
      needs: ['sound', 'complete'],
      blurb: 'some machine accepts every word of L, and may run forever on words outside it' },
    { id: 'co-recognisable', label: 'Co-recognisable',
      needs: ['sound', 'complete-on-complement'],
      blurb: 'the complement is recognisable: "no" is confirmable, "yes" is not' }
  ];

  function udClassify(flags) {
    var d = flags.sound && flags.complete && flags.terminating;
    return {
      ok: true,
      decidable: d,
      recognisable: !!(flags.sound && flags.complete),
      note: d
        ? 'Sound, complete and terminating — decidable.'
        : (flags.sound && flags.complete
            ? 'Sound and complete but not guaranteed to terminate: this recognises L without deciding ' +
              'it. HALT<sub>TM</sub> is exactly here — simulate, and accept if the machine stops. If it ' +
              'never stops, neither do you, and you never get to say "no".'
            : 'Not even recognising L: ' +
              (!flags.sound ? 'it accepts words outside L' : 'it misses words inside L') + '.')
    };
  }
