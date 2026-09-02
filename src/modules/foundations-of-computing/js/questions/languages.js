  /* ---------- Topic 01 · regular expressions, pumping, Turing machines ---------- */

  /** Small expressions whose languages are easy to state and easy to check. */
  var FQ_EXPRS = [
    { re: '1(0|1)*0',   say: 'binary strings that start with 1 and end with 0' },
    { re: '(01)*',      say: 'zero or more copies of 01' },
    { re: '0*1',        say: 'any number of 0s followed by a single 1' },
    { re: '(0|1)*11',   say: 'binary strings ending in 11' },
    { re: '0(0|1)*',    say: 'binary strings starting with 0' },
    { re: '(0|1)(0|1)', say: 'binary strings of length exactly 2' },
    { re: '1*01*',      say: 'binary strings containing exactly one 0' },
  ];

  /* ---- Does this expression match this word? ---- */
  QZ_GEN.push({ topic: 'languages', make: function () {
    var e = qzPick(FQ_EXPRS);
    var w = '';
    var n = qzInt(2, 6);
    for (var i = 0; i < n; i++) w += qzPick(['0', '1']);

    var r = reMatch(e.re, w);
    if (!r.ok) throw new Error('retry');

    return {
      topic: 'languages · regular expressions',
      kind: 'choice',
      prompt: 'Does <code>' + e.re + '</code> match the word <code>' + w + '</code>?',
      choices: ['Yes, it matches', 'No, it does not match'],
      answer: r.match ? 'Yes, it matches' : 'No, it does not match',
      check: textCheck(r.match ? 'Yes, it matches' : 'No, it does not match'),
      explain: 'The expression describes ' + e.say + '. <code>' + w + '</code> ' +
        (r.match ? 'fits that description.' : 'does not fit that description.'),
    };
  } });

  /* ---- Which of these four does the expression NOT match? ---- */
  QZ_GEN.push({ topic: 'languages', make: function () {
    var e = qzPick(FQ_EXPRS);
    var listed = reEnumerate(e.re, 12, 8);
    if (!listed.ok || listed.words.length < 4) throw new Error('retry');

    // Three words it matches, and one it does not.
    var yes = [];
    var pool = listed.words.slice();
    while (yes.length < 3 && pool.length) {
      var take = pool.splice(qzInt(0, pool.length - 1), 1)[0];
      if (take !== '') yes.push(take);
    }
    if (yes.length < 3) throw new Error('retry');

    var no = null;
    for (var t = 0; t < 40 && !no; t++) {
      var cand = '', n = qzInt(2, 6);
      for (var i = 0; i < n; i++) cand += qzPick(['0', '1']);
      var r = reMatch(e.re, cand);
      if (r.ok && !r.match && yes.indexOf(cand) < 0) no = cand;
    }
    if (!no) throw new Error('retry');

    var choices = yes.concat([no]);
    if (new Set(choices).size !== 4) throw new Error('retry');
    choices.sort();

    return {
      topic: 'languages · regular expressions',
      kind: 'choice',
      prompt: 'Which of these words is <strong>not</strong> matched by <code>' + e.re + '</code>?',
      choices: choices,
      answer: no,
      check: textCheck(no),
      explain: 'The expression describes ' + e.say + '. The other three fit; <code>' + no +
        '</code> does not.',
    };
  } });

  /* ---- How many legal splits does the pumping lemma allow? ---- */
  QZ_GEN.push({ topic: 'languages', make: function () {
    var p = qzInt(2, 5);
    var len = qzInt(p, p + 3);
    var w = '';
    for (var i = 0; i < len; i++) w += 'a';
    var count = pumpSplits(w, p).length;
    var expect = p * (p + 1) / 2;
    if (count !== expect) throw new Error('retry');

    return {
      topic: 'languages · the pumping lemma',
      prompt: 'The pumping length is p = ' + p + ' and you have chosen a word of length ' + len +
        '. In how many ways can it be split as w = xyz obeying <strong>|xy| ≤ ' + p +
        '</strong> and <strong>|y| &gt; 0</strong>?',
      placeholder: 'a number',
      answer: String(count),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
        return isNaN(x) ? { ok: false, msg: 'Give a whole number.' } : { ok: x === count };
      },
      explain: 'Choose where y starts (' + p + ' places, from 0 to ' + (p - 1) + ') and where it ends ' +
        '(anywhere after that, up to position ' + p + '). That is 1 + 2 + … + ' + p + ' = <strong>' +
        count + '</strong>. Note it depends only on p, not on how long w is — and you have to beat ' +
        'every one of them.',
    };
  } });

  /* ---- Can this word win the pumping game? ---- */
  QZ_GEN.push({ topic: 'languages', make: function () {
    var keys = ['anbn', 'anbm', 'ww', 'evenLen', 'endsAB'];
    var key = qzPick(keys);
    var L = PUMP_LANGS[key];
    var p = qzInt(2, 4);
    var w = L.hint(p);
    if (w.length > 12) throw new Error('retry');

    var a = pumpAnalyse(L.inL, w, p, 4);

    return {
      topic: 'languages · the pumping lemma',
      kind: 'choice',
      prompt: 'Playing the pumping game on <strong>L = { ' + L.label + ' }</strong> with p = ' + p +
        ', you choose w = <code>' + w + '</code>. Can you beat <em>every</em> legal split?',
      choices: ['Yes — every split can be pumped out of L', 'No — at least one split survives'],
      answer: a.wins ? 'Yes — every split can be pumped out of L' : 'No — at least one split survives',
      check: textCheck(a.wins ? 'Yes — every split can be pumped out of L' : 'No — at least one split survives'),
      explain: a.wins
        ? 'All ' + a.splits + ' splits break. Because y must sit inside the first ' + p +
          ' symbols, pumping it always unbalances the word. That is a complete proof that L is not regular.'
        : a.survivors.length + ' of the ' + a.splits + ' splits survive every exponent — for instance y = <code>' +
          (a.survivors[0].y || 'ε') + '</code>. ' + (L.regular
            ? 'This language is regular, so no choice of w could ever have won. The lemma cannot prove regularity.'
            : 'A different choice of w would do better.'),
    };
  } });

  /* ---- Turing machine: how many steps? ---- */
  QZ_GEN.push({ topic: 'machines', make: function () {
    // A machine that walks right over a's and halts on the first blank.
    var flip = Math.random() < 0.5;
    var src = ['start: q0', 'accept: qacc', 'reject: qrej',
      'q0 a q0 ' + (flip ? 'b' : 'a') + ' >',
      'q0 b q0 ' + (flip ? 'a' : 'b') + ' >',
      'q0 _ qacc _ >'].join('\n');
    var p = tmParse(src);
    if (!p.ok) throw new Error('retry');

    var n = qzInt(3, 7), w = '';
    for (var i = 0; i < n; i++) w += qzPick(['a', 'b']);

    var r = tmRun(p.m, w, 200);
    if (r.verdict !== 'accept') throw new Error('retry');

    return {
      topic: 'machines · counting steps',
      prompt: 'This machine' + (flip ? ' swaps every a for b and every b for a as it goes' : ' copies the tape unchanged') +
        ', then halts on the first blank:<br><code>' + src.replace(/\n/g, '<br>') + '</code><br><br>' +
        'How many steps does it take on input <code>' + w + '</code>? (A step is one application of δ.)',
      placeholder: 'a number',
      answer: String(r.steps),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
        return isNaN(x) ? { ok: false, msg: 'Give a whole number.' } : { ok: x === r.steps };
      },
      explain: 'It reads each of the ' + n + ' symbols, moving right once per symbol, then makes one ' +
        'more move on the blank to reach q<sub>acc</sub>. That is ' + n + ' + 1 = <strong>' +
        r.steps + '</strong> steps.',
    };
  } });

  /* ---- Turing machine: what is on the tape at the end? ---- */
  QZ_GEN.push({ topic: 'machines', make: function () {
    var src = ['start: q0', 'accept: qacc', 'reject: qrej',
      'q0 a q0 b >', 'q0 b q0 a >', 'q0 _ qacc _ >'].join('\n');
    var p = tmParse(src);
    if (!p.ok) throw new Error('retry');

    var n = qzInt(3, 6), w = '';
    for (var i = 0; i < n; i++) w += qzPick(['a', 'b']);

    var r = tmRun(p.m, w, 200);
    if (r.verdict !== 'accept') throw new Error('retry');

    return {
      topic: 'machines · reading the tape',
      prompt: 'A machine has just three instructions:<br>' +
        '<code>q0 a q0 b &gt;</code><br><code>q0 b q0 a &gt;</code><br><code>q0 _ qacc _ &gt;</code><br><br>' +
        'It starts on the leftmost symbol of <code>' + w + '</code>. What does the tape read when it halts?',
      placeholder: 'the tape contents',
      answer: r.tape,
      check: function (v) {
        var x = String(v).trim().toLowerCase().replace(/[\s␣_]/g, '');
        return { ok: x === r.tape.toLowerCase() };
      },
      explain: 'Each instruction writes the opposite symbol and moves right, so every a becomes b and ' +
        'every b becomes a: <code>' + w + '</code> → <strong>' + r.tape + '</strong>.',
    };
  } });

  /* ---- Which outcome is possible for a Turing machine but not a DFA? ---- */
  QZ_GEN.push({ topic: 'machines', make: function () {
    var opts = [
      'It never halts, so it gives no answer at all',
      'It halts and accepts the word',
      'It halts and rejects the word',
      'It reads the whole input exactly once',
    ];
    return {
      topic: 'machines · deciding vs recognising',
      kind: 'choice',
      prompt: 'A DFA always produces a verdict on every input. Which of these can happen to a ' +
        '<strong>Turing machine</strong> but never to a DFA?',
      choices: opts,
      answer: opts[0],
      check: textCheck(opts[0]),
      explain: 'A DFA reads n symbols and stops, so it always answers. A Turing machine can move its ' +
        'head back and forth forever and never reach a halting state — written M(w) = ↑. That third ' +
        'outcome is exactly what separates <em>deciding</em> a language from merely <em>recognising</em> it.',
    };
  } });
