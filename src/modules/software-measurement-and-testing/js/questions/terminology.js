  /* ---------- Topic 01 · fault, error, failure ---------- */

  var TMEMO = {};
  function tonce(key, fn) {
    if (!(key in TMEMO)) TMEMO[key] = fn();
    return TMEMO[key];
  }

  /* ---- which of the three words ---- */

  QZ_GEN.push({ topic: 'terminology', make: function () {
    var items = [
      { s: 'Two statements are in the wrong order in the source file.', a: 'Fault',
        why: 'A fault is an incorrect implementation — it is in the code, whether or not ' +
          'anybody runs it.' },
      { s: 'A required check was never written at all.', a: 'Fault',
        why: 'Still a fault, and the harder kind: a fault of <em>omission</em>. There is no ' +
          'wrong line to find, only a missing one.' },
      { s: 'Partway through execution, a variable holds a value it should not.', a: 'Error',
        why: 'An error is an incorrect system state. The fault has run and done damage, but ' +
          'nothing has been observed yet.' },
      { s: 'The program prints 8 where the specification says 2.', a: 'Failure',
        why: 'A failure is a visible error in the behaviour — the incorrect state reaching ' +
          'somewhere an observer can see it.' },
      { s: 'A user reports that the totals on their invoice are wrong.', a: 'Failure',
        why: 'Visible incorrect behaviour. Also called an anomaly or an incident.' },
      { s: 'After the faulty line runs, the state is wrong, but the value is overwritten ' +
           'before anything is printed.', a: 'Error',
        why: 'An error with no failure. The state really did go wrong; it simply never ' +
          'became visible, so no test observing only the output could catch it.' }
    ];
    var pick = items[qzInt(0, items.length - 1)];
    return {
      topic: 'terminology · which word',
      kind: 'choice',
      prompt: pick.s + '<br><br>Is this a fault, an error, or a failure?',
      choices: ['Fault', 'Error', 'Failure'],
      answer: pick.a,
      check: textCheck(pick.a),
      explain: pick.why
    };
  } });

  /* ---- the worked example, computed ---- */

  QZ_GEN.push({ topic: 'terminology', make: function () {
    var i = qzInt(1, 40);
    var got = ftImpl(i, 'math').toString();
    var want = ftSpec(i, 'math').toString();
    return {
      topic: 'terminology · the worked example',
      prompt: 'The specification says output <code>2i&sup3;</code>, but the code does ' +
        '<code>i = 2 * i;</code> then <code>i = pow(i, 3);</code>. For input <code>' + i +
        '</code>, what does it actually print?',
      placeholder: 'a number',
      answer: got,
      check: function (v) {
        var s = String(v).replace(/[^0-9-]/g, '');
        if (!s) return { ok: false, msg: 'Give a whole number.' };
        return { ok: s === got };
      },
      explain: 'Doubling first gives <code>(2&middot;' + i + ')&sup3; = ' + got +
        '</code>, where the specification wanted <code>2&middot;' + i + '&sup3; = ' + want +
        '</code>. The program computes <code>8i&sup3;</code> instead of <code>2i&sup3;</code>.'
    };
  } });

  /* ---- the three conditions ---- */

  QZ_GEN.push({ topic: 'terminology', make: function () {
    return {
      topic: 'terminology · why a test can pass anyway',
      kind: 'choice',
      prompt: 'A test case executes a line of code containing a fault, and the test passes. ' +
        'Which of these is <strong>not</strong> a possible reason?',
      choices: ['the fault was not reached',
                'the state did not become incorrect on this input',
                'the state became incorrect but did not reach the output',
                'the expected output was computed from the faulty code'],
      answer: 'the fault was not reached',
      check: textCheck('the fault was not reached'),
      explain: 'The question says the line executed, so reachability is not the ' +
        'explanation. The other two are the remaining conditions — infection and ' +
        'propagation — and both can fail independently. (The fourth is a real and separate ' +
        'disaster, but it is a broken test rather than a reason a correct test passes.)'
    };
  } });

  QZ_GEN.push({ topic: 'terminology', make: function () {
    var model = qzInt(0, 1) === 0 ? 'math' : 'int32';
    var r = tonce('sweep-' + model, function () { return ftSweep(-5000, 5000, model); });
    return {
      topic: 'terminology · which inputs catch it',
      prompt: 'The <code>2i&sup3;</code> program is tested on every input from &minus;5,000 ' +
        'to 5,000, using ' + (model === 'int32' ? '<strong>32-bit integers</strong>, as the ' +
        'program really does' : '<strong>exact integer arithmetic</strong>') +
        '. On how many of those ' + r.total.toLocaleString() + ' inputs does the test ' +
        '<em>pass</em> &mdash; that is, fail to reveal the fault?',
      placeholder: 'a number',
      answer: String(r.hidden.length),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === r.hidden.length };
      },
      explain: model === 'math'
        ? 'Just one: <code>i = 0</code>. The two programs differ by <code>6i&sup3;</code>, ' +
          'which is zero only at zero.'
        : 'Five: <code>' + r.hidden.join(', ') + '</code> — the multiples of 2048. In ' +
          '32-bit arithmetic <code>6i&sup3;</code> must vanish <em>modulo 2&sup3;&sup2;</em>, ' +
          'which needs <code>i</code> divisible by <code>2<sup>11</sup></code>. A test suite ' +
          'built from round numbers would pass against a program that is wrong almost ' +
          'everywhere.'
    };
  } });

  /* ---- test case / test suite ---- */

  QZ_GEN.push({ topic: 'terminology', make: function () {
    return {
      topic: 'terminology · what a test case is',
      kind: 'choice',
      prompt: 'A test case is a pair. Of what?',
      choices: ['inputs and expected outputs',
                'inputs and actual outputs',
                'a program and its specification',
                'a fault and the failure it causes'],
      answer: 'inputs and expected outputs',
      check: textCheck('inputs and expected outputs'),
      explain: 'Inputs — values, preconditions, the environment, the timing of events — ' +
        'together with the <em>expected</em> outputs, which may be concrete values or ' +
        'symbolic properties relating input to output. The prediction is half the ' +
        'definition: without it the test cannot fail, so it cannot pass either. A test ' +
        'suite is a set or list of test cases.'
    };
  } });

  /* ---- validation vs verification ---- */

  QZ_GEN.push({ topic: 'terminology', make: function () {
    var v = qzInt(0, 1) === 0;
    return {
      topic: 'terminology · V and V',
      kind: 'choice',
      prompt: v ? 'Which question does <strong>validation</strong> ask?'
                : 'Which question does <strong>verification</strong> ask?',
      choices: ['Have we made the right product?', 'Have we made the product right?',
                'Is the product fast enough?', 'Does the product compile?'],
      answer: v ? 'Have we made the right product?' : 'Have we made the product right?',
      check: textCheck(v ? 'Have we made the right product?'
                         : 'Have we made the product right?'),
      explain: v
        ? 'Validation is about compliance with the <em>intended use</em> — usually ' +
          'user-centred, usually manual, usually applied to the finished product. You can ' +
          'build something flawlessly and still have built the wrong thing.'
        : 'Verification is about compliance <em>between the artefacts of different ' +
          'phases</em> — artefact-driven, and open to being formalised and mechanised all ' +
          'the way through.'
    };
  } });

  /* ---- levels ---- */

  QZ_GEN.push({ topic: 'terminology', make: function () {
    var L = FT_LEVELS[qzInt(0, FT_LEVELS.length - 1)];
    return {
      topic: 'terminology · levels of testing',
      kind: 'choice',
      prompt: 'At which level of testing would you expect to find <strong>' +
        esc(L.tools.split(',')[0]) + '</strong> and ' + esc(L.techniques.split(',')[0]) +
        '?',
      choices: FT_LEVELS.map(function (x) { return x.level; }),
      answer: L.level,
      check: textCheck(L.level),
      explain: '<strong>' + L.level + '</strong> testing covers ' + L.scope +
        '. Tools: ' + L.tools + '. Techniques: ' + L.techniques + '.'
    };
  } });

  /* ---- beyond testing ---- */

  QZ_GEN.push({ topic: 'terminology', make: function () {
    var items = [
      { a: 'Model checking', c: 'it does not yet scale to very large systems, because of ' +
           'state-space explosion',
        why: 'Model checking examines the whole state space against formal properties — ' +
          'rigorous and push-button once a model exists, and limited by the size of that ' +
          'state space.' },
      { a: 'Static analysis', c: 'it approximates, so it reports false positives',
        why: 'Static analysis checks abstract properties without running the program. That ' +
          'makes it automatic and scalable, and means it must approximate — hence false ' +
          'positives and true negatives.' }
    ];
    var pick = items[qzInt(0, 1)];
    return {
      topic: 'terminology · beyond testing',
      kind: 'choice',
      prompt: 'Which technique has this as its main drawback: <em>' + pick.c + '</em>?',
      choices: ['Model checking', 'Static analysis', 'Unit testing', 'Acceptance testing'],
      answer: pick.a,
      check: textCheck(pick.a),
      explain: pick.why
    };
  } });

  /* ---- Dijkstra ---- */

  QZ_GEN.push({ topic: 'terminology', make: function () {
    return {
      topic: 'terminology · what testing can show',
      kind: 'choice',
      prompt: '"Testing can show the presence of bugs, but not their absence." What follows ' +
        'from that for a test suite that passes completely?',
      choices: ['no fault was revealed by these test cases',
                'the program has no faults',
                'the program has faults that were not revealed',
                'the test suite is inadequate'],
      answer: 'no fault was revealed by these test cases',
      check: textCheck('no fault was revealed by these test cases'),
      explain: 'That is all a green suite licenses. It does not establish absence — and it ' +
        'does not establish presence either, so "the program has faults" overclaims in the ' +
        'other direction. The <code>2i&sup3;</code> example makes it concrete: a suite of ' +
        'multiples of 2048 passes completely against a program that is wrong for nearly ' +
        'every other input.'
    };
  } });
