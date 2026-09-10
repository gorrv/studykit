  /* ---------- Scala 01 · values, types, lists ----------

     Marked by the same evaluator the REPL tool uses, whose
     arithmetic the test suite checks against a real JVM.
     ------------------------------------------------------------ */

  /* ---- what does this evaluate to ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var a = qzPick([3, 7, 9, 13, 25, 100]);
    var b = qzPick([2, 3, 4, 5]);
    var src = a + ' / ' + b;
    var r = scEval(src, {});
    var right = r.show;
    var real = a / b;
    var choices = [right, String(Math.round(real)), real.toFixed(1), String(a % b)]
      .filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    return {
      topic: 'Scala · Int arithmetic',
      kind: 'choice',
      prompt: 'Both operands are <code>Int</code>. What is <code>' + esc(src) + '</code>?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'Int division throws the fraction away rather than rounding, and truncates towards ' +
        'zero. ' + a + ' / ' + b + ' is ' + right + (Math.round(real) !== Number(right)
          ? ' — rounding would have given ' + Math.round(real) + '.' : '.')
    };
  } });

  /* ---- the type, not the value ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var cases = [
      { src: 'List(1, 2, 3)', t: 'List[Int]' },
      { src: '(1, "two")', t: '(Int, String)' },
      { src: '1 :: 2 :: Nil', t: 'List[Int]' },
      { src: '"a" + 1', t: 'String' },
      { src: '1 / 2', t: 'Int' },
      { src: '1.0 / 2', t: 'Double' },
      { src: "'a'.toInt", t: 'Int' },
      { src: 'List(1, 2).length', t: 'Int' },
      { src: 'List(1, 2).isEmpty', t: 'Boolean' },
      { src: 'BigInt(2) * 3', t: 'BigInt' }
    ];
    var c = qzPick(cases);
    var r = scEval(c.src, {});
    return {
      topic: 'Scala · types',
      kind: 'choice',
      prompt: 'What type does <code>' + esc(c.src) + '</code> have?',
      choices: ['Int', 'Double', 'BigInt', 'String', 'Boolean', 'List[Int]', '(Int, String)']
        .filter(function (t) { return t === c.t || Math.random() < 0.55; })
        .concat([c.t]).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(),
      answer: c.t,
      check: textCheck(c.t),
      explain: 'It evaluates to <code>' + esc(r.ok ? r.show : '?') + '</code>. The type is decided ' +
        'before anything runs, and it is what decides which <code>/</code> or <code>+</code> is ' +
        'meant.'
    };
  } });

  /* ---- overflow ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var right = 'It wraps round to a negative number, silently';
    return {
      topic: 'Scala · Int overflow',
      kind: 'choice',
      prompt: 'What does <code>2147483647 + 1</code> do?',
      choices: [
        right,
        'It throws an ArithmeticException',
        'It widens to Long automatically',
        'It does not compile'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'An Int is the JVM\'s 32-bit int. One past the largest is the smallest, with no ' +
        'error at all. Use <code>BigInt</code> — or <code>Long</code>, if you are sure of the ' +
        'range — when the numbers might get big.'
    };
  } });

  /* ---- cons and sharing ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var n = qzPick([3, 4, 5]);
    var items = [];
    for (var i = 1; i <= n; i++) items.push(i);
    var steps = [{ kind: 'literal', name: 'a', items: items },
                 { kind: 'cons', name: 'b', value: 0, from: 'a' }];
    var r = lsRun(steps);
    var right = '1';
    return {
      topic: 'Scala · lists',
      kind: 'choice',
      prompt: 'Given <code>val a = List(' + items.join(', ') + ')</code>, how many new cons cells ' +
        'does <code>val b = 0 :: a</code> allocate?',
      choices: ['0', '1', String(n), String(n + 1)]
        .filter(function (v, i, arr) { return arr.indexOf(v) === i; }),
      answer: right,
      check: textCheck(right),
      explain: 'One. Its tail is the list that already existed, so ' + n + ' cells are shared ' +
        'between <code>a</code> and <code>b</code> and nothing is copied. That is why ' +
        '<code>::</code> is constant time, and why immutability does not cost what you would ' +
        'expect.'
    };
  } });

  /* ---- what is the old list afterwards ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var right = 'List(1, 2, 3, 5)';
    return {
      topic: 'Scala · immutability',
      kind: 'choice',
      prompt: 'After<pre class="pp-snippet">val old_list = List(1, 2, 3, 5)\n' +
        'val new_list = 0 :: old_list</pre>what is <code>old_list</code>?',
      choices: [right, 'List(0, 1, 2, 3, 5)', 'List(1, 2, 3)', 'Nil'],
      answer: right,
      check: textCheck(right),
      explain: 'Unchanged — that is the whole point. <code>new_list</code> is ' +
        '<code>List(0, 1, 2, 3, 5)</code>, built from one new cell in front of the old list.'
    };
  } });

  /* ---- the average trap ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var xs = qzPick([[1, 2], [1, 2, 3, 4], [5, 6], [3, 4]]);
    var src = 'List(' + xs.join(', ') + ').sum / List(' + xs.join(', ') + ').length';
    var r = scEval(src, {});
    var real = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
    var right = r.show;
    var choices = [right, String(real), real.toFixed(1), String(Math.ceil(real))]
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
    return {
      topic: 'Scala · Int division',
      kind: 'choice',
      prompt: '<code>def average(xs: List[Int]): Int = xs.sum / xs.length</code><br><br>' +
        'What is <code>average(List(' + xs.join(', ') + '))</code>?',
      choices: choices.sort(),
      answer: right,
      check: textCheck(right),
      explain: Number(right) === real
        ? 'It divides exactly here, so the Int division does no damage — which is what makes the ' +
          'bug hard to spot in testing.'
        : 'The true mean is ' + real + ', but both operands are Ints so the division is Int ' +
          'division and the fraction is discarded.'
    };
  } });

  /* ---- average of nothing ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var right = 'It throws an ArithmeticException';
    return {
      topic: 'Scala · total functions',
      kind: 'choice',
      prompt: 'With that same <code>average</code>, what does <code>average(Nil)</code> do?',
      choices: [right, 'It returns 0', 'It does not compile', 'It returns None'],
      answer: right,
      check: textCheck(right),
      explain: 'The length is 0 and Int division by zero throws. The signature says every ' +
        '<code>List[Int]</code> has an average, which is a promise the code cannot keep — the ' +
        'honest return type is <code>Option[Int]</code>.'
    };
  } });

  /* ---- val vs var ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var right = 'It does not compile';
    return {
      topic: 'Scala · val and var',
      kind: 'choice',
      prompt: 'What happens?<pre class="pp-snippet">val x = 42\nx = 43</pre>',
      choices: [right, 'x becomes 43', 'It throws at run time', 'x stays 42, silently'],
      answer: right,
      check: textCheck(right),
      explain: 'Reassignment to a <code>val</code> is a compile error. Use <code>var</code> if you ' +
        'genuinely need a box — but most loops that need one can be written as an expression ' +
        'instead.'
    };
  } });

  /* ---- cons associativity ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var r = scEval('1 :: 2 :: 3 :: Nil', {});
    var right = r.show;
    return {
      topic: 'Scala · lists',
      kind: 'choice',
      prompt: 'What is <code>1 :: 2 :: 3 :: Nil</code>?',
      choices: [right, 'List(3, 2, 1)', 'It does not compile', 'List(List(1, 2), 3)'],
      answer: right,
      check: textCheck(right),
      explain: '<code>::</code> is right-associative — any operator ending in a colon is — so this ' +
        'reads from the right: Nil, then 3 on the front, then 2, then 1.'
    };
  } });

  /* ---- where lists are expensive ---- */
  QZ_GEN.push({ topic: 'scalabasics', make: function () {
    var right = 'xs ::: List(y), because the left list is copied';
    return {
      topic: 'Scala · lists',
      kind: 'choice',
      prompt: 'Which of these is <strong>not</strong> constant time on a list of length n?',
      choices: [right, 'y :: xs', 'xs.head', 'xs.tail'],
      answer: right,
      check: textCheck(right),
      explain: 'Adding to the front is one new cell. Adding to the back cannot be, because the ' +
        'last cell would need a new tail and it may be shared — so the left list is copied. ' +
        'Build backwards with <code>::</code> and <code>reverse</code> at the end.'
    };
  } });
