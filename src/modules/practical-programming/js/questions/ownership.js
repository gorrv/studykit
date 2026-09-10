  /* ---------- Topic 04 · ownership, value categories, moving ----------

     Marked by the same engines the tools use, which the test suite
     checks against g++ on every run.
     ------------------------------------------------------------ */

  /* ---- lvalue or rvalue ---- */
  QZ_GEN.push({ topic: 'ownership', make: function () {
    var names = Object.keys(VC_EXPRS);
    var e = qzPick(names);
    var right = VC_EXPRS[e].cat;
    return {
      topic: 'C++ · value categories',
      kind: 'choice',
      prompt: 'Is <code>' + esc(e) + '</code> an lvalue or an rvalue?',
      choices: ['lvalue', 'rvalue'],
      answer: right,
      check: textCheck(right),
      explain: VC_EXPRS[e].why
    };
  } });

  /* ---- does this reference bind? ---- */
  QZ_GEN.push({ topic: 'ownership', make: function () {
    var e = qzPick(Object.keys(VC_EXPRS));
    var b = qzPick(Object.keys(VC_BINDINGS));
    var r = vcBind(e, b);
    var decl = { value: 'int y = ', ref: 'int & y = ', constref: 'const int & y = ',
                 rvalueref: 'int && y = ' }[b];
    var right = r.legal ? 'Yes' : 'No';
    return {
      topic: 'C++ · references',
      kind: 'choice',
      prompt: 'Does this compile?<pre class="pp-snippet">' + esc(decl + e + ';') + '</pre>',
      choices: ['Yes', 'No'],
      answer: right,
      check: textCheck(right),
      explain: '<code>' + esc(e) + '</code> is an ' + r.cat + '. ' + r.why
    };
  } });

  /* ---- which overload runs ---- */
  QZ_GEN.push({ topic: 'ownership', make: function () {
    var all = ['ref', 'constref', 'rvalueref'];
    var present = all.filter(function () { return Math.random() < 0.6; });
    if (!present.length) present = ['constref'];
    var arg = qzPick(Object.keys(OV_ARGS));
    var r = ovPick(present, arg);
    var label = { ref: 'f(Thing &)', constref: 'f(const Thing &)', rvalueref: 'f(Thing &&)' };
    var right = r.compiles ? label[r.chosen] : 'It does not compile';
    var choices = ['It does not compile'].concat(present.map(function (p) { return label[p]; }));
    return {
      topic: 'C++ · overload resolution',
      kind: 'choice',
      prompt: 'These overloads are declared:<pre class="pp-snippet">' +
        present.map(function (p) { return 'void ' + label[p] + ';'; }).join('\n') +
        '</pre>Which runs for <code>f(' + esc(OV_ARGS[arg].cc) + ')</code>?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: r.why
    };
  } });

  /* ---- what does the ownership program print ---- */
  QZ_GEN.push({ topic: 'ownership', make: function () {
    var keys = Object.keys(UP_PRESETS).filter(function (k) {
      return UP_PRESETS[k].ops.every(function (o) {
        return o.kind !== 'copy' && o.kind !== 'copyctor' && o.kind !== 'deref';
      });
    });
    var k = qzPick(keys);
    var r = upRun(UP_PRESETS[k].ops);
    var right = r.out.length ? r.out.join(' / ') : 'nothing at all';
    var wrong = [
      'deleted 1 / deleted 1',
      'deleted 1',
      'nothing at all',
      'deleted 1 / deleted 2'
    ].filter(function (c) { return c !== right; });
    var choices = [right, wrong[0], wrong[1], wrong[2]].filter(Boolean);
    var seen = {};
    choices = choices.filter(function (c) {
      if (seen[c]) return false; seen[c] = true; return true;
    });
    var src = upSource(UP_PRESETS[k].ops)
      .split('int main() {\n  {\n')[1].split('  }\n')[0]
      .replace(/^    /gm, '').trim();
    return {
      topic: 'C++ · unique_ptr',
      kind: 'choice',
      prompt: 'Each <code>Res</code> prints <code>deleted &lt;n&gt;</code> from its destructor. ' +
        'What does this print?<pre class="pp-snippet">{\n  ' +
        esc(src).replace(/\n/g, '\n  ') + '\n}</pre>',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: r.steps.length ? r.steps[r.steps.length - 1].note : ''
    };
  } });

  /* ---- reset vs release ---- */
  QZ_GEN.push({ topic: 'ownership', make: function () {
    var which = qzPick(['reset', 'release', 'get']);
    var map = {
      reset: 'It deletes what was held, then takes the new pointer',
      release: 'It hands back the raw pointer and deletes nothing',
      get: 'It hands back the raw pointer and ownership does not change'
    };
    var right = map[which];
    return {
      topic: 'C++ · unique_ptr',
      kind: 'choice',
      prompt: 'What does <code>p.' + which + '(…)</code> do?',
      choices: [map.reset, map.release, map.get, 'It deletes what was held and leaves p null'],
      answer: right,
      check: textCheck(right),
      explain: which === 'release'
        ? 'The one that leaks if you ignore what comes back. Use it to hand ownership to ' +
          'something that is not a unique_ptr.'
        : which === 'reset'
          ? 'The one that frees. Passing nothing, <code>p.reset()</code>, just deletes and leaves ' +
            'it null.'
          : 'Never delete what <code>get()</code> returns — the unique_ptr will delete it again.'
    };
  } });

  /* ---- std::move ---- */
  QZ_GEN.push({ topic: 'ownership', make: function () {
    var right = 'It casts the argument to an rvalue reference';
    return {
      topic: 'C++ · std::move',
      kind: 'choice',
      prompt: 'What does <code>std::move(x)</code> do?',
      choices: [
        right,
        'It copies x somewhere else and empties x',
        'It frees the memory x was using',
        'It swaps x with a default-constructed object'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'It moves nothing. The cast changes which overload is chosen, and any moving is ' +
        'done by that overload — a move constructor or move assignment operator. If the type has ' +
        'neither, the copy is still what runs.'
    };
  } });

  /* ---- compiler flags ---- */
  QZ_GEN.push({ topic: 'ownership', make: function () {
    var flags = {
      '-Wall': 'Ask for the warnings that are off by default',
      '-Werror': 'Turn warnings into errors, so the build fails until they are fixed',
      '-D_GLIBCXX_DEBUG': 'Turn on the standard library’s own checking, such as vector bounds',
      '-g': 'Keep the information a debugger needs'
    };
    var k = qzPick(Object.keys(flags));
    return {
      topic: 'C++ · compiler flags',
      kind: 'choice',
      prompt: 'What does <code>' + esc(k) + '</code> do?',
      choices: Object.keys(flags).map(function (f) { return flags[f]; }),
      answer: flags[k],
      check: textCheck(flags[k]),
      explain: k === '-D_GLIBCXX_DEBUG'
        ? 'It makes the program much slower, so it is for development rather than release.'
        : k === '-Wall'
          ? 'Despite the name it is not every warning; <code>-Wextra</code> asks for more.'
          : 'Worth having on from the first day of a project — retrofitting it later means ' +
            'fixing hundreds at once.'
    };
  } });
