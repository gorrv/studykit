  /* ---------- Topic 01 · C++ first steps ----------

     Marked by running the tracer, which the test suite checks
     against g++ on every run. So the answer a question is marked
     against is the answer a real compiler gives.
     ------------------------------------------------------------ */

  function ppListCheck(expected) {
    var want = expected.join(',');
    return function (v) {
      var got = String(v).replace(/[\s\[\]]/g, '');
      if (!got) return { ok: false, msg: 'Give the printed values, comma separated.' };
      return { ok: got === want };
    };
  }

  /** A short program mixing copies and references, and what it prints. */
  function ppProgram() {
    var x0 = qzInt(-9, 9);
    var names = ['b', 'c'];
    var lines = ['Coordinate a(' + x0 + ', 0);'];
    var live = [{ n: 'a', ref: false, con: false }];

    var howMany = qzInt(1, 2);
    for (var i = 0; i < howMany; i++) {
      var from = qzPick(live.filter(function (v) { return !v.con; }) );
      if (!from) break;
      var nm = names[i];
      var kind = qzPick(['copy', 'ref']);
      if (kind === 'copy') {
        lines.push('Coordinate ' + nm + ' = ' + from.n + ';');
        live.push({ n: nm, ref: false, con: false });
      } else {
        lines.push('Coordinate & ' + nm + ' = ' + from.n + ';');
        live.push({ n: nm, ref: true, con: false });
      }
    }
    var target = qzPick(live);
    lines.push(target.n + '.setX(' + qzInt(-9, 9) + ');');
    live.forEach(function (v) { lines.push('print ' + v.n + '.getX();'); });

    var text = lines.join('\n');
    var prog = cppParse(text);
    if (!prog.ok) return null;
    var run = cppRun(prog);
    if (!run.ok || !run.compiles || !run.out.length) return null;
    return { text: text, out: run.out, run: run, names: live };
  }

  /* ---- What does it print? ---- */
  QZ_GEN.push({ topic: 'cppbasics', make: function () {
    var p = ppProgram();
    if (!p) return null;
    return {
      topic: 'C++ · copies and references',
      kind: 'text',
      prompt: 'What does this print?<pre class="pp-snippet">' + esc(p.text) + '</pre>' +
        '(one value per <code>print</code>, comma separated)',
      answer: p.out.join(', '),
      check: ppListCheck(p.out),
      explain: 'It creates <strong>' + p.run.heap.length + '</strong> object' +
        (p.run.heap.length === 1 ? '' : 's') + '. ' +
        (p.text.indexOf('&') >= 0
          ? 'The line with <code>&amp;</code> does not make a new object — it gives an existing one a ' +
            'second name, so a change through either name is visible through both. '
          : 'Every declaration here copies, so each name has its own object and changing one leaves ' +
            'the others alone. ') +
        'Answer: <strong>' + p.out.join(', ') + '</strong>.'
    };
  } });

  /* ---- How many objects? ---- */
  QZ_GEN.push({ topic: 'cppbasics', make: function () {
    var p = ppProgram();
    if (!p) return null;
    var n = p.run.heap.length;
    return {
      topic: 'C++ · object identity',
      kind: 'text',
      prompt: 'How many Coordinate objects does this program create?<pre class="pp-snippet">' +
        esc(p.text) + '</pre>',
      answer: String(n),
      check: function (v) {
        var s = String(v).trim();
        return /^\d+$/.test(s) ? { ok: +s === n } : { ok: false, msg: 'Give a whole number.' };
      },
      explain: 'Each <code>Coordinate name(…)</code> and each <code>Coordinate name = other;</code> ' +
        'makes one. A <code>Coordinate &amp; name = other;</code> makes <strong>none</strong> — it is ' +
        'a second name for an object that already exists. Here that comes to <strong>' + n +
        '</strong>.'
    };
  } });

  /* ---- Which parameter form? ---- */
  QZ_GEN.push({ topic: 'cppbasics', make: function () {
    var cases = [
      { want: 'const Coordinate &', d: 'read the object and not modify it, without paying for a copy' },
      { want: 'Coordinate &', d: 'modify the caller’s object' },
      { want: 'Coordinate', d: 'work on your own copy and leave the caller’s object alone' }
    ];
    var c = qzPick(cases);
    var choices = cases.map(function (x) { return x.want; });
    return {
      topic: 'C++ · parameter forms',
      kind: 'choice',
      prompt: 'You want a function that will <strong>' + c.d + '</strong>. How should the parameter ' +
        'be declared?',
      choices: choices.slice().sort(),
      answer: c.want,
      check: textCheck(c.want),
      explain: c.want === 'const Coordinate &'
        ? 'A const reference: no copy is made, and the compiler enforces that the function does not ' +
          'modify it. This is the default choice for any class-type parameter you only read.'
        : (c.want === 'Coordinate &'
            ? 'A plain reference aliases the caller’s object, so changes stick. Use it deliberately — ' +
              'a caller cannot see from the call site that their object may change.'
            : 'By value makes a copy, which is what you want when the function needs to modify ' +
              'something without disturbing the caller. For a large object it costs a copy, so say ' +
              'it on purpose.')
    };
  } });

  /* ---- Will it compile? ---- */
  QZ_GEN.push({ topic: 'cppbasics', make: function () {
    var cases = [
      { src: 'Coordinate a(4, 2);\nCoordinate b;', ok: false,
        why: '<code>Coordinate b;</code> needs a default constructor — one taking no arguments — and ' +
             'writing <code>Coordinate(int, int)</code> removed the free one.' },
      { src: 'Coordinate a(4, 2);\nCoordinate & r = a;\nr.setX(0);', ok: true,
        why: 'A reference to a modifiable object, modified through it. Fine.' },
      { src: 'Coordinate a(4, 2);\nconst Coordinate & c = a;\nc.setX(0);', ok: false,
        why: '<code>c</code> is const, and <code>setX</code> modifies. Through a const reference only ' +
             'methods marked <code>const</code> may be called.' },
      { src: 'const Coordinate a(4, 2);\nCoordinate & r = a;', ok: false,
        why: 'That would bind a non-const reference to a const object, discarding the const. Const is ' +
             'one-way.' },
      { src: 'Coordinate a(4, 2);\nCoordinate b = a;\nb.setX(0);', ok: true,
        why: 'A copy, then a change to the copy. <code>a</code> is untouched.' }
    ];
    var c = qzPick(cases);
    var right = c.ok ? 'Yes' : 'No';
    return {
      topic: 'C++ · will it compile?',
      kind: 'choice',
      prompt: 'Given <code>Coordinate</code> with only <code>Coordinate(int, int)</code> and a ' +
        'non-const <code>setX</code>, does this compile?<pre class="pp-snippet">' + esc(c.src) + '</pre>',
      choices: ['Yes', 'No'],
      answer: right,
      check: textCheck(right),
      explain: (c.ok ? 'Yes. ' : 'No. ') + c.why
    };
  } });

  /* ---- The initialiser list ---- */
  QZ_GEN.push({ topic: 'cppbasics', make: function () {
    var hasDefault = Math.random() < 0.5;
    var isConst = Math.random() < 0.35;
    var style = qzPick(['list', 'body']);
    var r = miCheck({ memberHasDefault: hasDefault, memberIsConst: isConst, style: style });
    var right = r.compiles ? 'Yes' : 'No';
    var body = style === 'list' ? 'Journey(Coordinate s) : start(s) { }'
                                : 'Journey(Coordinate s) { start = s; }';
    return {
      topic: 'C++ · initialiser lists',
      kind: 'choice',
      prompt: 'Journey has a member <code>' + (isConst ? 'const ' : '') + 'Coordinate start;</code>, ' +
        'and Coordinate ' + (hasDefault ? '<strong>has</strong>' : '<strong>has no</strong>') +
        ' default constructor. Does this compile?<pre class="pp-snippet">' + esc(body) + '</pre>',
      choices: ['Yes', 'No'],
      answer: right,
      check: textCheck(right),
      explain: r.note + ' Members are constructed <em>before</em> the constructor body runs — that ' +
        'single fact decides every case here.'
    };
  } });

  /* ---- Operator placement ---- */
  QZ_GEN.push({ topic: 'cppbasics', make: function () {
    var where = qzPick(['member', 'free', 'wrongside', 'none']);
    var r = opEqCheck(where);
    var right = r.works ? 'Yes' : 'No';
    return {
      topic: 'C++ · operator==',
      kind: 'choice',
      prompt: 'You have <code>Alice a; Bob b;</code> and want to write <code>a == b</code>. ' +
        'Given only this, does it resolve?<pre class="pp-snippet">' + esc(r.decl) + '</pre>',
      choices: ['Yes', 'No'],
      answer: right,
      check: textCheck(right),
      explain: r.note
    };
  } });

  /* ---- operator<< chaining ---- */
  QZ_GEN.push({ topic: 'cppbasics', make: function () {
    var right = 'ostream &';
    var choices = [right, 'void', 'bool', 'Coordinate'];
    return {
      topic: 'C++ · operator<<',
      kind: 'choice',
      prompt: 'What must <code>operator&lt;&lt;</code> return for ' +
        '<code>cout &lt;&lt; "at " &lt;&lt; a &lt;&lt; endl;</code> to compile?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'The expression is <code>((cout &lt;&lt; "at ") &lt;&lt; a) &lt;&lt; endl</code>, so ' +
        'each call has to hand the stream back for the next one. Return <code>void</code> and the ' +
        'last step is <code>void &lt;&lt; endl</code>, which does not exist.'
    };
  } });

  /* ---- Java versus C++ ---- */
  QZ_GEN.push({ topic: 'cppbasics', make: function () {
    var c = qzPick(PP_CONTRASTS);
    var others = PP_CONTRASTS.filter(function (x) { return x.id !== c.id; });
    var wrong = [];
    while (wrong.length < 3 && wrong.length < others.length) {
      var o = others[wrong.length];
      wrong.push(o.cpp);
    }
    return {
      topic: 'C++ · coming from Java',
      kind: 'choice',
      prompt: 'In Java you would write <code>' + esc(c.java) + '</code>. What is the C++ equivalent?',
      choices: [c.cpp].concat(wrong).sort(),
      answer: c.cpp,
      check: textCheck(c.cpp),
      explain: c.note
    };
  } });
