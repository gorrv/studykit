  /* ---------- Scala 03–05 · text, RPN, automata ----------

     Marked by the same engines the tools use. The regex answers are
     compared against java.util.regex by the test suite, the RPN
     answers against two other evaluators, and the automata answers
     against exhaustive runs.
     ------------------------------------------------------------ */

  /* ---- default arguments ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var k = qzPick(Object.keys(DF_CALLS));
    var c = DF_CALLS[k];
    var r = dfBind(DF_PARAMS, c.args);
    var right = r.ok
      ? 'n = ' + r.slots[0].value + ', a = ' + r.slots[1].value
      : 'It does not compile';
    var choices = ['It does not compile', 'n = 7, a = 0', 'n = 7, a = 3', 'n = 3, a = 7'];
    if (choices.indexOf(right) < 0) choices.push(right);
    return {
      topic: 'Scala · default arguments',
      kind: 'choice',
      prompt: 'Given <code>def collatzHelper(n: Int, a: Int = 0)</code>, what does ' +
        '<code>' + esc(c.label) + '</code> do?',
      choices: choices.filter(function (v, i, a) { return a.indexOf(v) === i; }),
      answer: right,
      check: textCheck(right),
      explain: r.ok
        ? 'Positional arguments fill left to right; anything left over takes its default.'
        : r.errors[0]
    };
  } });

  /* ---- named arguments after positional ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var right = 'Every argument after the first named one must also be named';
    return {
      topic: 'Scala · named arguments',
      kind: 'choice',
      prompt: 'Why does <code>collatzHelper(n = 7, 3)</code> not compile?',
      choices: [
        right,
        'Named arguments are not allowed with defaults',
        'n cannot be named because it has no default',
        'The arguments are in the wrong order'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'Once a name is used, position no longer identifies anything, so the compiler ' +
        'refuses to guess. <code>collatzHelper(7, a = 3)</code> is fine, and named arguments may ' +
        'be reordered freely among themselves.'
    };
  } });

  /* ---- regex matching ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var cases = [
      { s: 'ada@example.com', why: 'all lower case, three-letter suffix — the shape it was ' +
        'written for' },
      { s: 'Ada@example.com', why: 'the capital is not in <code>[a-z\\d\\.-]</code>, but nothing ' +
        'anchors the start, so the match simply begins one character later' },
      { s: 'ada@example.museum', why: 'six characters in the suffix, and the bound is ' +
        '<code>{2,6}</code>' },
      { s: 'ada@example.technology', why: 'the suffix is too long for <code>{2,6}</code>, and ' +
        'nothing anchors the end, so it takes the first six characters of it' }
    ];
    var c = qzPick(cases);
    var r = rxFind(RX_PATTERNS.email.source, c.s);
    var right = r.matches.length ? r.matches[0].text : 'nothing at all';
    var choices = [right, c.s, 'nothing at all']
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
    return {
      topic: 'Scala · regular expressions',
      kind: 'choice',
      prompt: 'What does <code>"""([a-z\\d\\.-]+)@([\\da-z\\.-]+)\\.([a-z\\.]{2,6})""".r</code> ' +
        'find in <code>' + esc(c.s) + '</code>?',
      choices: choices,
      answer: right,
      check: textCheck(right),
      explain: c.why + (right === c.s
        ? ''
        : right === 'nothing at all'
          ? ''
          : ' — so it returns <code>' + esc(right) + '</code>, which is a wrong address rather ' +
            'than a failure.')
    };
  } });

  /* ---- raw strings ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var right = 'No escape processing — a backslash is a backslash';
    return {
      topic: 'Scala · raw strings',
      kind: 'choice',
      prompt: 'What does <code>"""…"""</code> do that <code>"…"</code> does not?',
      choices: [
        right,
        'It compiles the string into a regex',
        'It allows string interpolation',
        'It trims whitespace from both ends'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'Which is why regexes are written in them: <code>"""\\d"""</code> is the two ' +
        'characters the regex engine wants, where an ordinary string would need ' +
        '<code>"\\\\d"</code>. <code>.r</code> is the part that makes it a regex.'
    };
  } });

  /* ---- crawling without a visited set ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var d = qzPick([2, 3, 4]);
    var noMem = cwCrawl('a.example', d, {});
    var withMem = cwCrawl('a.example', d, { visited: true });
    var right = String(noMem.total);
    var choices = [right, String(withMem.total), String(d), String(noMem.distinct)]
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
    return {
      topic: 'Scala · recursion',
      kind: 'choice',
      prompt: 'The crawler has no visited set. Starting from <code>a.example</code> at depth ' +
        d + ', over a web where <code>a</code> links to <code>b</code> and <code>c</code>, both ' +
        'link on to <code>d</code>, and <code>b</code> links back to <code>a</code> — how many ' +
        'page fetches happen?',
      choices: choices.sort(function (x, y) { return +x - +y; }),
      answer: right,
      check: textCheck(right),
      explain: noMem.total > withMem.total
        ? noMem.total + ' fetches for only ' + noMem.distinct + ' distinct pages. Pages reachable ' +
          'by two routes are fetched twice, and the link back means the only thing stopping it is ' +
          'the depth counter. With a visited set it would be ' + withMem.total + '.'
        : 'At this depth nothing is reached twice yet.'
    };
  } });

  /* ---- RPN conversion ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var k = qzPick(Object.keys(RP_PRESETS));
    var src = RP_PRESETS[k].src;
    var r = rpConvert(src);
    var right = r.rpn.join(' ');
    var wrong = [
      r.tokens.slice().reverse().map(function (t) {
        return t.k === 'num' ? String(t.v) : t.v;
      }).join(' '),
      src.replace(/[()]/g, '').split(/\s+/).join(' ')
    ];
    var choices = [right].concat(wrong).filter(function (v, i, a) {
      return v && a.indexOf(v) === i;
    });
    return {
      topic: 'Scala · reverse Polish',
      kind: 'choice',
      prompt: 'What is <code>' + esc(src) + '</code> in reverse Polish notation?',
      choices: choices,
      answer: right,
      check: textCheck(right),
      explain: 'Every operator comes after both its operands. Running it on a stack gives ' +
        rpEval(r.tokens).value + ', the same as evaluating the original.'
    };
  } });

  /* ---- what the stack does ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var right = 'Pops two values and pushes one';
    return {
      topic: 'Scala · stack machines',
      kind: 'choice',
      prompt: 'When a stack machine meets <code>iadd</code>, what does it do?',
      choices: [right, 'Pushes two values', 'Pops one value and pushes two', 'Clears the stack'],
      answer: right,
      check: textCheck(right),
      explain: 'Which is why RPN needs no brackets: the number of things on the stack tells you ' +
        'everything, and when the input runs out there should be exactly one left.'
    };
  } });

  /* ---- backtracking ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var pat = qzPick(['nested', 'simple']);
    var p = bkParse(BK_PATTERNS[pat].src);
    var small = bkMatch(p.ast, 'aaaaaaaa', 5000000);
    var big = bkMatch(p.ast, 'aaaaaaaaaaaa', 5000000);
    var exponential = big.steps > small.steps * 4;
    var right = exponential ? 'Exponentially' : 'In step with the input';
    return {
      topic: 'Scala · backtracking',
      kind: 'choice',
      prompt: 'A backtracking matcher is given <code>' + esc(BK_PATTERNS[pat].src) + '</code> and ' +
        'a string of n a&rsquo;s, with no b. How does the work grow with n?',
      choices: ['Exponentially', 'In step with the input', 'It does not grow', 'Logarithmically'],
      answer: right,
      check: textCheck(right),
      explain: exponential
        ? 'Measured: ' + small.steps.toLocaleString() + ' steps at n = 8 and ' +
          big.steps.toLocaleString() + ' at n = 12. The nested star can divide the a&rsquo;s ' +
          'between its repetitions in exponentially many ways, and every one has to fail.'
        : 'Measured: ' + small.steps + ' steps at n = 8 and ' + big.steps + ' at n = 12. One ' +
          'star with only one way to match each prefix costs nothing extra — the nesting is what ' +
          'hurts, not the star.'
    };
  } });

  /* ---- DFA run ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var m = DA_MACHINES.worked;
    var s = qzPick(['abaaa', 'bb', 'aa', 'ba', 'abab']);
    var r = daRun(m, s);
    var right = r.accepted ? 'Accepted' : 'Rejected';
    return {
      topic: 'Scala · DFAs',
      kind: 'choice',
      prompt: 'δ: Q0 —a→ Q1, Q0 —b→ Q2, Q1 —a→ Q4, Q1 —b→ Q2, Q2 —a→ Q3, Q2 —b→ Q2, ' +
        'Q3 —a→ Q4, Q3 —b→ Q2, Q4 —a,b→ Q4. Start Q0, accepting {Q4}.<br><br>' +
        'Is <code>' + esc(s) + '</code> accepted?',
      choices: ['Accepted', 'Rejected'],
      answer: right,
      check: textCheck(right),
      explain: 'It runs ' + r.steps.filter(function (x) { return x.read !== null; })
        .map(function (x) { return x.state + '—' + x.read + '→' + (x.to || 'stuck'); }).join(', ') +
        '. ' + (r.accepted ? 'Q4 is accepting.' : 'The state it ends in does not accept.')
    };
  } });

  /* ---- partial delta ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var right = 'The string is rejected';
    return {
      topic: 'Scala · DFAs',
      kind: 'choice',
      prompt: 'A DFA reads a character for which δ has no entry in the current state. What ' +
        'happens?',
      choices: [right, 'It stays in the same state', 'It returns to the start state',
                'It is a run-time error'],
      answer: right,
      check: textCheck(right),
      explain: 'δ is allowed to be partial. Getting stuck is a perfectly good way of saying no — ' +
        'the same machine can be written with a total δ by adding a dead state that everything ' +
        'unmatched goes to.'
    };
  } });

  /* ---- NFA acceptance ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var right = 'Some path through the machine ends on an accepting state';
    return {
      topic: 'Scala · NFAs',
      kind: 'choice',
      prompt: 'What does it mean for an NFA to accept a string?',
      choices: [
        right,
        'Every path ends on an accepting state',
        'The first path tried ends on an accepting state',
        'The machine never gets stuck'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'Some, not all. Running it by carrying the set of states you could be in answers ' +
        'that in one pass — a state in the final set that accepts is a path that accepted.'
    };
  } });

  /* ---- subset construction ---- */
  QZ_GEN.push({ topic: 'scalaweb', make: function () {
    var k = qzPick(Object.keys(NA_MACHINES));
    var nfa = NA_MACHINES[k];
    var dfa = naSubset(nfa);
    var right = String(dfa.states.length);
    var choices = [right, String(nfa.states.length),
                   String(Math.pow(2, nfa.states.length))]
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
    return {
      topic: 'Scala · subset construction',
      kind: 'choice',
      prompt: 'An NFA with ' + nfa.states.length + ' states is turned into a DFA by the subset ' +
        'construction. How many states does the DFA have?',
      choices: choices.sort(function (x, y) { return +x - +y; }),
      answer: right,
      check: textCheck(right),
      explain: 'The bound is 2<sup>' + nfa.states.length + '</sup> = ' +
        Math.pow(2, nfa.states.length) + ', but only the <em>reachable</em> sets get built, and ' +
        'here that is ' + dfa.states.length + '. The blow-up is a worst case, not the usual one.'
    };
  } });
