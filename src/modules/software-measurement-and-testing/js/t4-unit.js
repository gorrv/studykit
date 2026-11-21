  /* ============================================================
     SMT TOPIC 04 · unit testing and test-driven development

     This topic is about a practice rather than an algorithm, which
     makes it look untestable. It is not. A test-driven session is a
     sequence of (test list, production code) pairs, and the whole
     claim of the method is a claim about that sequence: each new test
     fails when it is written, and passes once the next scrap of code
     is added, and nothing that passed before stops passing.

     So the FizzBuzz session from the notes is transcribed below —
     every version of evaluate() and every test, in the order they
     were written — and the test suite checks the claim step by step.
     It is also where the interesting result comes from: there is a
     version that passes every test written so far and is still wrong
     about 15.

     The second half is about the test fixture: the same test class
     run in every possible order, with and without a fresh object per
     test. That is what "self-contained and stateless" means, and the
     cost of ignoring it is measurable rather than a matter of taste.

     Algorithms only — no DOM.
     ============================================================ */

  /* =============================================================
     PART 1 · FizzBuzz, as it was driven
     ============================================================= */

  /* The specification, written once and never touched again.
     Everything below is compared against this. */
  function fbSpec(n) {
    if (n % 3 === 0 && n % 5 === 0) return 'FizzBuzz';
    if (n % 3 === 0) return 'Fizz';
    if (n % 5 === 0) return 'Buzz';
    return String(n);
  }

  /* Every version of evaluate(), in the order the notes write them.
     `code` is what is on the slide; `run` is that code, in JavaScript.
     The two are kept side by side on purpose: the page shows the
     first and the suite checks the second. */
  var FB_STEPS = [
    {
      id: 'empty',
      note: 'The test will not even compile: there is no class and no method. A compiler ' +
            'error counts as a failing test.',
      code: '// no class, no method yet',
      run: null
    },
    {
      id: 'null',
      note: 'Enough to compile, and no more. Now the test can fail for the right reason.',
      code: 'public String evaluate(int number) {\n  return null;\n}',
      run: function () { return null; }
    },
    {
      id: 'one',
      note: 'The smallest thing that makes the first test pass. It is meant to look absurd.',
      code: 'public String evaluate(int number) {\n  return "1";\n}',
      run: function () { return '1'; }
    },
    {
      id: 'ternary',
      note: 'The second test fails, so the second test is made to pass. Still absurd, and ' +
            'still the smallest step.',
      code: 'public String evaluate(int number) {\n  return number == 1 ? "1" : "2";\n}',
      run: function (n) { return n === 1 ? '1' : '2'; }
    },
    {
      id: 'valueOf',
      note: 'A refactoring: the hard-coded values go, the behaviour on the two tests does ' +
            'not. This is the third bar of the rhythm, and no test is added for it.',
      code: 'public String evaluate(int number) {\n  return String.valueOf(number);\n}',
      run: function (n) { return String(n); }
    },
    {
      id: 'fizz',
      note: 'The first real rule, written because a test asked for it.',
      code: 'public String evaluate(int number) {\n  if (number % 3 == 0) {\n' +
            '    return "Fizz";\n  }\n  return String.valueOf(number);\n}',
      run: function (n) { return n % 3 === 0 ? 'Fizz' : String(n); }
    },
    {
      id: 'buzz',
      note: 'And the second. Notice what is still missing, and that nothing written so far ' +
            'asks for it.',
      code: 'public String evaluate(int number) {\n  if (number % 3 == 0) {\n' +
            '    return "Fizz";\n  }\n  if (number % 5 == 0) {\n    return "Buzz";\n  }\n' +
            '  return String.valueOf(number);\n}',
      run: function (n) {
        if (n % 3 === 0) return 'Fizz';
        if (n % 5 === 0) return 'Buzz';
        return String(n);
      }
    },
    {
      id: 'extract',
      note: 'A refactoring again: the divisibility test is given a name. Behaviour ' +
            'identical to the step before it, which is what makes it a refactoring.',
      code: 'public String evaluate(int number) {\n  if (isDivisibleBy(number, 3)) {\n' +
            '    return "Fizz";\n  }\n  if (isDivisibleBy(number, 5)) {\n' +
            '    return "Buzz";\n  }\n  return String.valueOf(number);\n}\n\n' +
            'private boolean isDivisibleBy(int dividend, int divisor) {\n' +
            '  return dividend % divisor == 0;\n}',
      run: function (n) {
        function isDivisibleBy(a, b) { return a % b === 0; }
        if (isDivisibleBy(n, 3)) return 'Fizz';
        if (isDivisibleBy(n, 5)) return 'Buzz';
        return String(n);
      }
    },
    {
      id: 'fizzbuzz',
      note: 'The last rule, and the first time the order of the three conditions matters.',
      code: 'public String evaluate(int number) {\n' +
            '  if (isDivisibleBy(number, 3) && isDivisibleBy(number, 5)) {\n' +
            '    return "FizzBuzz";\n  }\n  if (isDivisibleBy(number, 3)) {\n' +
            '    return "Fizz";\n  }\n  if (isDivisibleBy(number, 5)) {\n' +
            '    return "Buzz";\n  }\n  return String.valueOf(number);\n}',
      run: function (n) {
        function isDivisibleBy(a, b) { return a % b === 0; }
        if (isDivisibleBy(n, 3) && isDivisibleBy(n, 5)) return 'FizzBuzz';
        if (isDivisibleBy(n, 3)) return 'Fizz';
        if (isDivisibleBy(n, 5)) return 'Buzz';
        return String(n);
      }
    }
  ];

  /* The test list, in the order it was written, and the step at which
     each test first appears. A test, once written, is run for ever
     after: that is what the green bar means. */
  var FB_TESTS = [
    { name: 'testOne', input: 1, expected: '1', from: 'one' },
    { name: 'testTwo', input: 2, expected: '2', from: 'ternary' },
    { name: 'testThree', input: 3, expected: 'Fizz', from: 'fizz' },
    { name: 'testFour', input: 4, expected: '4', from: 'fizz' },
    { name: 'testFive', input: 5, expected: 'Buzz', from: 'buzz' },
    { name: 'testFifteen', input: 15, expected: 'FizzBuzz', from: 'fizzbuzz' }
  ];

  function fbStepIndex(id) {
    for (var i = 0; i < FB_STEPS.length; i++) if (FB_STEPS[i].id === id) return i;
    return -1;
  }

  /* Which tests exist at a given step. A test is written just before
     the code that makes it pass, so the list at step i is every test
     whose `from` step is at or before i. */
  function fbTestsAt(i) {
    return FB_TESTS.filter(function (t) { return fbStepIndex(t.from) <= i; });
  }

  /* Run one test list against one version. */
  function fbRun(step, tests) {
    var impl = FB_STEPS[step];
    return tests.map(function (t) {
      if (!impl.run) {
        return { name: t.name, input: t.input, expected: t.expected,
                 got: null, pass: false, why: 'does not compile' };
      }
      var got;
      try { got = impl.run(t.input); } catch (e) { got = null; }
      return { name: t.name, input: t.input, expected: t.expected,
               got: got, pass: got === t.expected, why: null };
    });
  }

  /* The whole session, step by step: at each step, the test list as it
     stood, which of them passed, and whether the code was actually
     right. */
  function fbSession(upTo) {
    var out = [], i;
    var last = upTo === undefined ? FB_STEPS.length - 1 : upTo;
    for (i = 0; i <= last; i++) {
      var tests = fbTestsAt(i);
      var results = fbRun(i, tests);
      out.push({
        step: i,
        id: FB_STEPS[i].id,
        tests: results,
        green: results.length > 0 && results.every(function (r) { return r.pass; }),
        wrong: fbWrongCount(i, 100)
      });
    }
    return out;
  }

  /* How many inputs in 1..n the version at this step gets wrong. */
  function fbWrongCount(step, n) {
    var impl = FB_STEPS[step], bad = 0, i;
    if (!impl.run) return n;
    for (i = 1; i <= n; i++) {
      var got;
      try { got = impl.run(i); } catch (e) { got = null; }
      if (got !== fbSpec(i)) bad++;
    }
    return bad;
  }

  /* Every input in 1..n on which two versions disagree. Used to show
     that a refactoring step changed nothing. */
  function fbDiff(a, b, n) {
    var out = [], i;
    for (i = 1; i <= n; i++) {
      var x = FB_STEPS[a].run ? FB_STEPS[a].run(i) : null;
      var y = FB_STEPS[b].run ? FB_STEPS[b].run(i) : null;
      if (x !== y) out.push({ input: i, a: x, b: y });
    }
    return out;
  }

  /* The smallest input the version at this step gets wrong, or null.
     This is what a test list would have to reach to catch it. */
  function fbFirstWrong(step, n) {
    var impl = FB_STEPS[step], i;
    if (!impl.run) return 1;
    for (i = 1; i <= n; i++) {
      if (impl.run(i) !== fbSpec(i)) return i;
    }
    return null;
  }

  /* =============================================================
     PART 2 · the fixture

     The Account from the notes, and what happens when the tests
     share one.
     ============================================================= */

  function acMake(id, balance) {
    return {
      id: id,
      balance: balance,
      deposit: function (amount) {
        if (amount < 0) throw new Error('deposit of a negative amount');
        this.balance += amount;
      },
      withdraw: function (amount) {
        if (amount < 0) throw new Error('withdraw of a negative amount');
        if (amount > this.balance) throw new Error('Balance exceeded!');
        this.balance -= amount;
      },
      getBalance: function () { return this.balance; }
    };
  }

  /* Four tests of the same unit, each written the way the notes
     write them: arrange, act, assert, one scenario each. */
  var AC_TESTS = [
    {
      name: 'testInitialBalance',
      run: function (a) { return a.getBalance() === 2000; }
    },
    {
      name: 'testWithdraw',
      run: function (a) { a.withdraw(300); return a.getBalance() === 1700; }
    },
    {
      name: 'testDeposit',
      run: function (a) { a.deposit(500); return a.getBalance() === 2500; }
    },
    {
      name: 'testWithdrawTooMuch',
      run: function (a) {
        try { a.withdraw(999999); } catch (e) { return true; }
        return false;
      }
    }
  ];

  /* Run the tests in the given order. With `fresh`, setUp builds a new
     Account before each one; without it, they all share the object the
     first test got. */
  function acRunOrder(order, fresh) {
    var shared = acMake('1234-9999', 2000);
    return order.map(function (i) {
      var t = AC_TESTS[i];
      var account = fresh ? acMake('1234-9999', 2000) : shared;
      var pass;
      try { pass = t.run(account); } catch (e) { pass = false; }
      return { name: t.name, pass: pass };
    });
  }

  function acPermutations(n) {
    if (n === 0) return [[]];
    var out = [];
    acPermutations(n - 1).forEach(function (p) {
      for (var i = 0; i <= p.length; i++) {
        out.push(p.slice(0, i).concat([n - 1], p.slice(i)));
      }
    });
    return out;
  }

  /* Every order, both ways. The number that matters is how many orders
     come out green. */
  function acEveryOrder(fresh) {
    var orders = acPermutations(AC_TESTS.length);
    var green = 0, failures = {};
    var rows = orders.map(function (o) {
      var r = acRunOrder(o, fresh);
      var ok = r.every(function (x) { return x.pass; });
      if (ok) green++;
      else r.forEach(function (x) { if (!x.pass) failures[x.name] = (failures[x.name] || 0) + 1; });
      return { order: o, results: r, green: ok };
    });
    return { orders: rows, total: orders.length, green: green, failures: failures };
  }

  /* =============================================================
     PART 3 · the checklists
     ============================================================= */

  var BICEP = [
    { letter: 'Right', name: 'Are the results right?',
      note: 'The obvious one, and the only one most people do.' },
    { letter: 'B', name: 'Are all the boundary conditions CORRECT?',
      note: 'The acronym below, applied to every input.' },
    { letter: 'I', name: 'Can you check inverse relationships?',
      note: 'Square it and take the root; insert it and read it back.' },
    { letter: 'C', name: 'Can you cross-check results using other means?',
      note: 'A second method of computing the same answer, however slow.' },
    { letter: 'E', name: 'Can you force error conditions to happen?',
      note: 'Disk full, network down, clock wrong. If it cannot be forced, it cannot be ' +
            'tested.' },
    { letter: 'P', name: 'Are performance characteristics within bounds?',
      note: 'The one that turns into a test nobody can keep green; set bounds, not ' +
            'targets.' }
  ];

  var CORRECT = [
    { letter: 'C', name: 'Conformance',
      note: 'Does the value conform to an expected format?', example: '1 000 SEK' },
    { letter: 'O', name: 'Ordering',
      note: 'Is the set of values ordered, or unordered, as appropriate?', example: '' },
    { letter: 'R', name: 'Range',
      note: 'Is the value within reasonable minimum and maximum values?', example: '0–100%' },
    { letter: 'R', name: 'Reference',
      note: 'Does the code reference anything external that is not under its own control?',
      example: '' },
    { letter: 'E', name: 'Existence',
      note: 'Does the value exist — non-null, non-zero, present in a set, file present?',
      example: '' },
    { letter: 'C', name: 'Cardinality',
      note: 'Are there exactly enough values?', example: 'exactly two parents' },
    { letter: 'T', name: 'Time',
      note: 'Absolute and relative: is everything happening in the right order, at the ' +
            'right time, in time?', example: '' }
  ];

  var SMART = [
    { letter: 'S', name: 'Self-contained (and stateless)',
      note: 'No test may depend on another having run first.' },
    { letter: 'M', name: 'Maintainable',
      note: 'Test-first yields five to ten times more test code than production code, so ' +
            'its maintenance cost is the larger of the two.' },
    { letter: 'A', name: 'Act as documentation',
      note: 'The tests are the definitive reference for what the system is supposed to do.' },
    { letter: 'R', name: 'Repeatable and robust',
      note: 'Passes alone and in a suite, today and tomorrow.' },
    { letter: 'T', name: 'To the point',
      note: 'One scenario per test, so a failure points at one thing — "defect ' +
            'triangulation".' }
  ];

  /* The three A's, and the step of the Account test each line is. */
  var THREE_AS = [
    { a: 'Arrange', what: 'instantiate the unit under test and set up the test data',
      code: 'AccountImpl account = new AccountImpl("1234-9999", 2000);' },
    { a: 'Act', what: 'execute one or more methods on the unit under test',
      code: 'account.withdraw(300);' },
    { a: 'Assert', what: 'verify the results',
      code: 'Assert.assertEquals(1700, account.getBalance());' }
  ];

  /* The red/green/refactor cycle, in the order the notes give it. */
  var TDD_CYCLE = [
    { step: 'Think', what: 'about what you want to do, and about how to test it' },
    { step: 'Write a small test', what: 'which is also where the API gets designed' },
    { step: 'Watch it fail', what: 'the red bar — a test that has never failed proves ' +
      'nothing' },
    { step: 'Write just enough code', what: 'to pass it, and every earlier test — the ' +
      'green bar' },
    { step: 'Refactor', what: 'to remove duplication and increase expressiveness, then ' +
      'run them all again' },
    { step: 'Repeat', what: 'until no test you can think of drives new production code' }
  ];
