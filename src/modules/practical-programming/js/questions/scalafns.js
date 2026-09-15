  /* ---------- Scala 02 · functions, Option, matching ----------

     Marked by the same evaluator the tools use, whose collection
     methods the test suite compares against JavaScript's own and
     whose arithmetic it compares against a JVM.
     ------------------------------------------------------------ */

  /* ---- what does this collection call give ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var xs = [];
    var n = 4 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) xs.push(1 + Math.floor(Math.random() * 9));
    var lit = 'List(' + xs.join(', ') + ')';
    var op = qzPick([
      { src: '.filter(_ % 2 == 0)', what: 'keeps the elements the function says yes to' },
      { src: '.map(_ * 2)', what: 'applies the function to every element' },
      { src: '.count(_ > 4)', what: 'counts how many satisfy it' },
      { src: '.exists(_ > 4)', what: 'asks whether any does' },
      { src: '.forall(_ > 0)', what: 'asks whether all do' }
    ]);
    var r = scEval(lit + op.src, {});
    var right = r.show;
    var wrong = [
      scEval(lit + '.map(_ * 2)', {}).show,
      scEval(lit + '.filter(_ % 2 == 0)', {}).show,
      String(xs.length),
      'true', 'false'
    ];
    var choices = [right].concat(wrong.filter(function (c) { return c !== right; }).slice(0, 3));
    return {
      topic: 'Scala · higher-order functions',
      kind: 'choice',
      prompt: 'What is <code>' + esc(lit + op.src) + '</code>?',
      choices: choices.sort(),
      answer: right,
      check: textCheck(right),
      explain: 'It ' + op.what + '. The result is <code>' + esc(right) + '</code>, of type ' +
        '<code>' + esc(r.type) + '</code>.'
    };
  } });

  /* ---- find returns an Option ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var hasOne = Math.random() < 0.6;
    var xs = hasOne ? [7, 2, 3, 4, 5, 6] : [5, 6, 7, 8, 9];
    var lit = 'List(' + xs.join(', ') + ')';
    var r = scEval(lit + '.find(_ < 4)', {});
    var right = r.show;
    return {
      topic: 'Scala · Option',
      kind: 'choice',
      prompt: 'What is <code>' + esc(lit) + '.find(_ &lt; 4)</code>?',
      choices: ['Some(2)', 'None', '2', '-1'].filter(function (v, i, a) { return a.indexOf(v) === i; }),
      answer: right,
      check: textCheck(right),
      explain: hasOne
        ? '<code>find</code> gives the <em>first</em> element the function accepts, wrapped: ' +
          '<code>Some(2)</code>. Not 2 — the type has to allow for there being none.'
        : 'Nothing is below 4, so <code>None</code>. Not null, not −1: a value of type ' +
          '<code>Option[Int]</code> that the compiler will make you unwrap.'
    };
  } });

  /* ---- for-comprehension desugaring ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var right = 'xs.filter(n => n > 2).map(n => n * n)';
    return {
      topic: 'Scala · for-comprehensions',
      kind: 'choice',
      prompt: 'What does <code>for (n &lt;- xs if n &gt; 2) yield n * n</code> turn into?',
      choices: [
        right,
        'xs.map(n => n * n).filter(n => n > 2)',
        'xs.foreach(n => n * n)',
        'xs.flatMap(n => n * n)'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'The <code>if</code> becomes a <code>filter</code> and the <code>yield</code> ' +
        'becomes a <code>map</code> — in that order, because the guard decides what reaches the ' +
        'transformation. Filtering afterwards would test the squares instead.'
    };
  } });

  /* ---- no yield ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var right = 'Unit — it produces nothing';
    return {
      topic: 'Scala · for-comprehensions',
      kind: 'choice',
      prompt: 'What is the type of <code>for (n &lt;- List(1, 2, 3)) println(n)</code>, with no ' +
        '<code>yield</code>?',
      choices: [right, 'List[Int]', 'List[Unit]', 'Int'],
      answer: right,
      check: textCheck(right),
      explain: 'Without <code>yield</code> it is a <code>foreach</code>: it runs the body for its ' +
        'effect and gives back <code>Unit</code>. Forgetting the <code>yield</code> and wondering ' +
        'where the list went is a rite of passage.'
    };
  } });

  /* ---- parsing and Option ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var s = qzPick(['1234', '12x', '  12', '2147483648', '-7', '']);
    var r = scEval('"' + s + '".toInt', {});
    var right = r.ok ? r.show : 'It throws a NumberFormatException';
    return {
      topic: 'Scala · parsing',
      kind: 'choice',
      prompt: 'What does <code>"' + esc(s) + '".toInt</code> do?',
      choices: ['It throws a NumberFormatException', '1234', '-7', '12', '0']
        .filter(function (v, i, a) { return a.indexOf(v) === i; }),
      answer: right,
      check: textCheck(right),
      explain: r.ok
        ? 'A clean integer, so it parses.'
        : (s === '  12' ? 'No trimming — <code>Integer.parseInt</code> rejects the spaces.'
          : s === '2147483648' ? 'One past the largest Int, so it will not fit.'
          : s === '' ? 'An empty string is not a number.'
          : 'Not an integer, so it throws.') +
          ' <code>toIntOption</code> gives <code>None</code> instead, which the type system can see.'
    };
  } });

  /* ---- Map.get ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var present = Math.random() < 0.5;
    var key = present ? "'a'" : "'A'";
    var r = scEval("('a' to 'e').map(c => (c, c.toInt)).toMap.get(" + key + ")", {});
    var right = r.show;
    return {
      topic: 'Scala · Map',
      kind: 'choice',
      prompt: 'With <code>val m = (\'a\' to \'e\').map(c =&gt; (c, c.toInt)).toMap</code>, what is ' +
        '<code>m.get(' + esc(key) + ')</code>?',
      choices: ['Some(97)', 'None', '97', 'null'],
      answer: right,
      check: textCheck(right),
      explain: present
        ? '<code>get</code> returns an <code>Option</code>, so the value comes back wrapped: ' +
          '<code>Some(97)</code>. Writing <code>m(\'a\')</code> gives the bare 97 — and throws ' +
          'when the key is missing.'
        : 'There is no such key, and a missing key is exactly what <code>Option</code> is for. ' +
          '<code>m(\'A\')</code> would throw a <code>NoSuchElementException</code> instead.'
    };
  } });

  /* ---- which case wins ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var n = qzPick([3, 5, 15, 7, 9, 10, 30, 4]);
    var src = '(' + n + ' % 3, ' + n + ' % 5) match { case (0, 0) => "fizz buzz" ' +
      'case (0, _) => "fizz" case (_, 0) => "buzz" case _ => "' + n + '" }';
    var r = scEval(src, {});
    var right = r.show.replace(/"/g, '');
    return {
      topic: 'Scala · pattern matching',
      kind: 'choice',
      prompt: 'What does <code>fizz_buzz(' + n + ')</code> give?' +
        '<pre class="pp-snippet">(n % 3, n % 5) match {\n  case (0, 0) => "fizz buzz"\n' +
        '  case (0, _) => "fizz"\n  case (_, 0) => "buzz"\n  case _ => n.toString\n}</pre>',
      choices: ['fizz buzz', 'fizz', 'buzz', String(n)],
      answer: right,
      check: textCheck(right),
      explain: '(' + n + ' % 3, ' + n + ' % 5) is (' + (n % 3) + ', ' + (n % 5) + '). Cases are ' +
        'tried in order and the first match wins' +
        (n % 15 === 0
          ? ' — all four patterns match here, and only the first one runs.'
          : '.')
    };
  } });

  /* ---- order matters ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var right = 'Every case below it becomes unreachable';
    return {
      topic: 'Scala · pattern matching',
      kind: 'choice',
      prompt: 'What happens if <code>case _</code> is written as the <strong>first</strong> case?',
      choices: [
        right,
        'The compiler reorders them by specificity',
        'The most specific case still wins',
        'It does not compile'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'Cases are tried top to bottom and the first match wins. <code>case _</code> ' +
        'matches everything, so nothing after it can ever run. Scala warns about some of these ' +
        'and not all, so reading the order is the reliable habit.'
    };
  } });

  /* ---- binding vs comparing ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var right = 'It matches anything and binds it to a new n';
    return {
      topic: 'Scala · pattern matching',
      kind: 'choice',
      prompt: 'Inside <code>x match { case n => … }</code>, where an <code>n</code> is already in ' +
        'scope, what does <code>case n</code> do?',
      choices: [
        right,
        'It matches only when x equals the existing n',
        'It does not compile',
        'It matches only when x is null'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'A lowercase name in a pattern <strong>binds</strong>; it does not compare. The ' +
        'outer <code>n</code> is shadowed. To compare against it, use a guard — ' +
        '<code>case y if y == n</code> — or give the value an uppercase name.'
    };
  } });

  /* ---- the list pattern ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var xs = qzPick([[1, 2, 3], [7], []]);
    var lit = xs.length ? 'List(' + xs.join(', ') + ')' : 'Nil';
    var src = lit + ' match { case Nil => "empty" case h :: Nil => "just one" case h :: t => "head " + h }';
    var r = scEval(src, {});
    var right = r.show.replace(/"/g, '');
    return {
      topic: 'Scala · list patterns',
      kind: 'choice',
      prompt: 'What does this give for <code>' + esc(lit) + '</code>?' +
        '<pre class="pp-snippet">xs match {\n  case Nil      => "empty"\n' +
        '  case h :: Nil => "just one"\n  case h :: t   => "head " + h\n}</pre>',
      choices: ['empty', 'just one', 'head 1', 'head 7']
        .filter(function (v, i, a) { return a.indexOf(v) === i; }),
      answer: right,
      check: textCheck(right),
      explain: '<code>h :: t</code> matches any non-empty list, binding the head and the rest. ' +
        '<code>h :: Nil</code> is the special case of exactly one element — and it has to come ' +
        'first, because <code>h :: t</code> would match that too.'
    };
  } });

  /* ---- fib's shape ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var right = 'Exponential — the same values are recomputed over and over';
    return {
      topic: 'Scala · recursion',
      kind: 'choice',
      prompt: 'How many calls does <code>fib(n) = fib(n-1) + fib(n-2)</code> make, as written?',
      choices: [
        right,
        'Linear — one call per value of n',
        'Logarithmic — it halves each time',
        'Constant — the compiler memoises it'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'Each call makes two more, so the count roughly doubles every time n rises by two. ' +
        'The tool counts them by running it: fib(20) takes over thirteen thousand calls. Correct ' +
        'is not the same as the right shape.'
    };
  } });

  /* ---- the placeholder ---- */
  QZ_GEN.push({ topic: 'scalafns', make: function () {
    var right = '(a, b) => a * b';
    return {
      topic: 'Scala · anonymous functions',
      kind: 'choice',
      prompt: 'What does <code>_ * _</code> mean?',
      choices: [right, 'x => x * x', 'x => x * 2', 'It does not compile'],
      answer: right,
      check: textCheck(right),
      explain: 'Each <code>_</code> is a separate parameter, taken in order. For the same argument ' +
        'twice you have to write the lambda out: <code>x =&gt; x * x</code>.'
    };
  } });
