  /* ---------- Topic 04 · unit testing and TDD ---------- */

  var UMEMO = {};
  function uonce(key, fn) {
    if (!(key in UMEMO)) UMEMO[key] = fn();
    return UMEMO[key];
  }

  function uShuffle(a) {
    var out = a.slice(), i, j, t;
    for (i = out.length - 1; i > 0; i--) {
      j = qzInt(0, i);
      t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* ---- the three A's ---- */

  QZ_GEN.push({ topic: 'unit', make: function () {
    var i = qzInt(0, THREE_AS.length - 1);
    var a = THREE_AS[i];
    return {
      topic: 'unit testing · the three A\'s',
      kind: 'choice',
      prompt: 'Which step of a test is <code>' + esc(a.code) + '</code>?',
      choices: THREE_AS.map(function (x) { return x.a; }),
      answer: a.a,
      check: textCheck(a.a),
      explain: '<strong>' + a.a + '</strong> &mdash; ' + a.what + '. The three run in that ' +
        'order and a test that mixes them up is usually a test doing two things.'
    };
  } });

  /* ---- CORRECT ---- */

  QZ_GEN.push({ topic: 'unit', make: function () {
    var i = qzInt(0, CORRECT.length - 1);
    var c = CORRECT[i];
    var names = CORRECT.map(function (x) { return x.name; });
    var wrong = names.filter(function (n) { return n !== c.name; });
    var choices = [c.name, wrong[qzInt(0, wrong.length - 1)]];
    while (choices.length < 4) {
      var pick = wrong[qzInt(0, wrong.length - 1)];
      if (choices.indexOf(pick) < 0) choices.push(pick);
    }
    return {
      topic: 'unit testing · CORRECT',
      kind: 'choice',
      prompt: 'Which boundary condition asks: <em>' + esc(c.note) + '</em>',
      choices: uShuffle(choices),
      answer: c.name,
      check: textCheck(c.name),
      explain: '<strong>' + c.name + '</strong>' +
        (c.example ? ' &mdash; for instance <code>' + esc(c.example) + '</code>' : '') +
        '. The seven are Conformance, Ordering, Range, Reference, Existence, Cardinality, ' +
        'Time.'
    };
  } });

  /* ---- Right-BICEP ---- */

  QZ_GEN.push({ topic: 'unit', make: function () {
    var i = qzInt(1, BICEP.length - 1);          /* skip "Right", which is not a letter */
    var b = BICEP[i];
    return {
      topic: 'unit testing · Right-BICEP',
      kind: 'choice',
      prompt: 'In Right-BICEP, what does <strong>' + b.letter + '</strong> stand for?',
      choices: BICEP.slice(1).map(function (x) { return x.name; }),
      answer: b.name,
      check: textCheck(b.name),
      explain: '<strong>' + b.letter + '</strong> &mdash; ' + esc(b.name) + ' ' + esc(b.note)
    };
  } });

  /* ---- the TDD cycle, in order ---- */

  QZ_GEN.push({ topic: 'unit', make: function () {
    var i = qzInt(1, TDD_CYCLE.length - 2);
    return {
      topic: 'unit testing · the TDD cycle',
      kind: 'choice',
      prompt: 'In the cycle, what comes immediately after <strong>' +
        esc(TDD_CYCLE[i - 1].step) + '</strong>?',
      choices: TDD_CYCLE.map(function (x) { return x.step; }),
      answer: TDD_CYCLE[i].step,
      check: textCheck(TDD_CYCLE[i].step),
      explain: '<strong>' + esc(TDD_CYCLE[i].step) + '</strong> &mdash; ' +
        esc(TDD_CYCLE[i].what) + '.'
    };
  } });

  /* ---- the bar at a given step, from running it ---- */

  QZ_GEN.push({ topic: 'unit', make: function () {
    var i = qzInt(2, FB_STEPS.length - 1);
    var tests = fbTestsAt(i);
    var results = fbRun(i, tests);
    var passing = results.filter(function (r) { return r.pass; }).length;
    return {
      topic: 'unit testing · the FizzBuzz session',
      prompt: 'At the step where <code>evaluate</code> is<pre class="st-snippet">' +
        esc(FB_STEPS[i].code) + '</pre>' + tests.length +
        (tests.length === 1 ? ' test has' : ' tests have') + ' been written: <code>' +
        tests.map(function (t) { return t.input; }).join('</code>, <code>') +
        '</code>. How many of them pass?',
      placeholder: 'a number',
      answer: String(passing),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === passing };
      },
      explain: '<strong>' + passing + ' of ' + tests.length + '</strong>. ' +
        (passing === tests.length
          ? 'A green bar &mdash; which says the code does what the tests ask, and nothing ' +
            'more than that. ' + (fbFirstWrong(i, 1000) === null
              ? 'Here it happens to be right as well.'
              : 'The smallest input it still gets wrong is ' + fbFirstWrong(i, 1000) + '.')
          : 'Red, which is where the next scrap of code comes from.')
    };
  } });

  /* ---- the smallest input a version gets wrong ---- */

  QZ_GEN.push({ topic: 'unit', make: function () {
    var ids = ['one', 'ternary', 'valueOf', 'fizz', 'buzz'];
    var id = ids[qzInt(0, ids.length - 1)];
    var i = fbStepIndex(id);
    var first = fbFirstWrong(i, 1000);
    return {
      topic: 'unit testing · green is not right',
      prompt: 'With <code>evaluate</code> as<pre class="st-snippet">' +
        esc(FB_STEPS[i].code) + '</pre>what is the <strong>smallest</strong> input it ' +
        'answers wrongly?',
      placeholder: 'a number',
      answer: String(first),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === first };
      },
      explain: '<strong>' + first + '</strong>. ' +
        (id === 'buzz'
          ? 'And every test written by this point passes &mdash; the largest number any of ' +
            'them mentions is 5.'
          : 'The tests at this point reach nowhere near it, which is the whole point of ' +
            'the next step.')
    };
  } });

  /* ---- the fixture ---- */

  QZ_GEN.push({ topic: 'unit', make: function () {
    var shared = uonce('shared', function () { return acEveryOrder(false); });
    return {
      topic: 'unit testing · the fixture',
      prompt: 'Four tests of one account &mdash; initial balance, withdraw, deposit, ' +
        'withdraw too much &mdash; share a single account object instead of building a ' +
        'fresh one in <code>setUp</code>. Of the <strong>' + shared.total +
        '</strong> possible orders, how many come out all green?',
      placeholder: 'a number',
      answer: String(shared.green),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === shared.green };
      },
      explain: '<strong>' + shared.green + '</strong>. Every order fails, including the one ' +
        'you would naturally write them in: the balance each test expects is the balance ' +
        'the previous test left behind. With a fresh account per test, all ' + shared.total +
        ' orders pass.'
    };
  } });

  /* ---- S.M.A.R.T. ---- */

  QZ_GEN.push({ topic: 'unit', make: function () {
    var i = qzInt(0, SMART.length - 1);
    var s = SMART[i];
    return {
      topic: 'unit testing · S.M.A.R.T.',
      kind: 'choice',
      prompt: 'Which goal for test automation does this describe: <em>' + esc(s.note) +
        '</em>',
      choices: SMART.map(function (x) { return x.name; }),
      answer: s.name,
      check: textCheck(s.name),
      explain: '<strong>' + esc(s.name) + '</strong>. The five are self-contained, ' +
        'maintainable, act as documentation, repeatable and robust, to the point.'
    };
  } });

  /* ---- what refactoring means ---- */

  QZ_GEN.push({ topic: 'unit', make: function () {
    return {
      topic: 'unit testing · refactoring',
      kind: 'choice',
      prompt: 'Replacing <code>number == 1 ? "1" : "2"</code> with ' +
        '<code>String.valueOf(number)</code> changes the answer for 998 of the first 1000 ' +
        'inputs. Why is it still called a refactoring?',
      choices: ['because every test that existed still passed',
                'because the two are equal for all inputs the method accepts',
                'because the change made the code shorter',
                'because refactoring only means removing magic numbers'],
      answer: 'because every test that existed still passed',
      check: textCheck('because every test that existed still passed'),
      explain: 'Behaviour-preserving means preserving the behaviour that has been ' +
        'specified, and the tests are the specification. With two tests, almost any change ' +
        'preserves it. That is what lets the early steps be so crude, and it is why the ' +
        'test list has to keep growing.'
    };
  } });
