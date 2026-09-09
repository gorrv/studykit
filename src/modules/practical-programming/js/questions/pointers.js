  /* ---------- Topic 02 · pointers and ownership ----------

     Marked by running the engines, which the test suite checks
     against g++ and AddressSanitizer on every run.
     ------------------------------------------------------------ */

  /* ---- star counting ---- */
  QZ_GEN.push({ topic: 'pointers', make: function () {
    var q = qzPick(PT_QUIZ);
    var r = ptCheck(q.decl, q.expr, PT_ENV);
    var right = r.legal ? 'Yes' : 'No';
    return {
      topic: 'C++ · pointers',
      kind: 'choice',
      prompt: 'Given <code>string a("Hello");</code> and ' +
        '<code>string * b = new string("Hello");</code>, does this compile?' +
        '<pre class="pp-snippet">' + esc(q.src) + '</pre>',
      choices: ['Yes', 'No'],
      answer: right,
      check: textCheck(right),
      explain: r.why + ' Count the stars: <code>*</code> takes one off, <code>&amp;</code> puts one ' +
        'on, and both sides have to end up equal.'
    };
  } });

  /* ---- what does the shallow copy print? ---- */
  QZ_GEN.push({ topic: 'pointers', make: function () {
    var deep = Math.random() < 0.5;
    var sim = rtSimulate({ copy: deep ? 'deep' : 'default', assign: 'default',
                           dtor: true, scenario: 'copy' });
    var out = rtExpectedOutput(sim);
    if (!out) return null;
    return {
      topic: 'C++ · shallow and deep copies',
      kind: 'text',
      prompt: 'IHazStringPtr holds a <code>string *</code>, allocated in its default constructor. ' +
        (deep
          ? 'It has a <strong>deep</strong> copy constructor, <code>str(new string(*(other.str)))</code>.'
          : 'It has <strong>no</strong> copy constructor of its own.') +
        '<pre class="pp-snippet">IHazStringPtr a;\nIHazStringPtr b = a;\na.addCharacter(\'a\');\n' +
        'b.addCharacter(\'b\');\na.printIt();\nb.printIt();</pre>What does it print? (two lines, ' +
        'comma separated)',
      answer: out.join(', '),
      check: function (v) {
        return { ok: String(v).replace(/[\s\[\]"']/g, '') === out.join(',') };
      },
      explain: deep
        ? 'The deep copy gives b its own string, so the two characters land in different places: ' +
          '<strong>' + out.join(', ') + '</strong>.'
        : 'The compiler’s copy constructor does <code>str(other.str)</code> — it copies the ' +
          '<em>pointer</em>. There is one string, both objects append to it, and both print ' +
          '<strong>' + out.join(', ') + '</strong>.'
    };
  } });

  /* ---- does it leak? ---- */
  QZ_GEN.push({ topic: 'pointers', make: function () {
    var copy = qzPick(['default', 'deep']);
    var assign = qzPick(['default', 'deep', 'deep-delete']);
    var dtor = Math.random() < 0.5;
    var scenario = qzPick(['copy', 'assign']);
    if (scenario === 'copy' && assign !== 'default') assign = 'default';
    var sim = rtSimulate({ copy: copy, assign: assign, dtor: dtor, scenario: scenario });
    var leaks = sim.problems.some(function (p) { return p.kind === 'leak'; });
    var right = leaks ? 'Yes' : 'No';
    var desc = [];
    desc.push(copy === 'deep' ? 'a deep copy constructor' : 'no copy constructor');
    desc.push(assign === 'default' ? 'no assignment operator'
      : (assign === 'deep' ? 'a deep assignment operator that never deletes the old string'
                           : 'an assignment operator that deletes the old string then deep copies'));
    desc.push(dtor ? 'a destructor that deletes str' : 'no destructor');
    return {
      topic: 'C++ · leaks',
      kind: 'choice',
      prompt: 'IHazStringPtr holds a <code>string *</code> allocated in its constructor, and has ' +
        desc.join(', ') + '. Running <code>' + esc(RT_SCENARIOS[scenario].label) +
        '</code> and then letting everything go out of scope — does any memory leak?',
      choices: ['Yes', 'No'],
      answer: right,
      check: textCheck(right),
      explain: leaks
        ? 'Yes. ' + sim.problems.filter(function (p) { return p.kind === 'leak'; })[0].msg
        : 'No — every allocation is matched by a delete here.' +
          (sim.problems.length ? ' (Though there is another problem: ' +
            sim.problems[0].kind.replace(/-/g, ' ') + '.)' : '')
    };
  } });

  /* ---- the Rule of Three ---- */
  QZ_GEN.push({ topic: 'pointers', make: function () {
    var right = 'The copy constructor, the assignment operator and the destructor';
    var choices = [right,
      'The constructor, the destructor and operator==',
      'The copy constructor, the destructor and operator<<',
      'The default constructor, the copy constructor and the assignment operator'];
    return {
      topic: 'C++ · the Rule of Three',
      kind: 'choice',
      prompt: 'Which three functions does the Rule of Three name?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'All three exist for the same reason — the class owns something the compiler cannot ' +
        'copy or release correctly — so needing one is strong evidence you need all three. Writing ' +
        'only some of them is worse than writing none, because the ones you left behind are the ones ' +
        'you have already proved wrong.'
    };
  } });

  /* ---- why operator= returns a reference ---- */
  QZ_GEN.push({ topic: 'pointers', make: function () {
    var items = [
      { q: 'Why does <code>operator=</code> return <code>SomeClass &amp;</code>?',
        a: 'So that c = b = a works',
        w: ['So that the assignment is faster', 'So that it can be called on const objects',
            'So that the destructor is not called'],
        e: '<code>c = b = a;</code> is <code>c.operator=(b.operator=(a));</code>, so whatever the ' +
           'inner call returns is what c is assigned from. Returning by value would work but copy ' +
           'for nothing; returning void would not compile.' },
      { q: 'Why must the copy constructor take a <strong>reference</strong>?',
        a: 'Taking it by value would require a copy, which would call the copy constructor',
        w: ['References are faster than pointers', 'So that it can accept nullptr',
            'Because const objects cannot be copied'],
        e: 'The parameter would have to be copied before the function could start, and copying is ' +
           'exactly what this function does. The signature has to be a reference or it cannot exist.' },
      { q: 'What is <code>*this</code>?',
        a: 'The current object',
        w: ['A pointer to the current object', 'A copy of the current object',
            'The address of the current object'],
        e: '<code>this</code> is a <em>pointer</em> to the current object, so <code>*this</code> ' +
           'dereferences it to give the object — the same <code>*</code> as everywhere else.' }
    ];
    var it = qzPick(items);
    return {
      topic: 'C++ · assignment and copying',
      kind: 'choice',
      prompt: it.q,
      choices: [it.a].concat(it.w).sort(),
      answer: it.a,
      check: textCheck(it.a),
      explain: it.e
    };
  } });

  /* ---- self-assignment ---- */
  QZ_GEN.push({ topic: 'pointers', make: function () {
    var sim = rtSimulate({ copy: 'deep', assign: 'deep-delete', dtor: true, scenario: 'self' });
    var right = 'It reads memory it has just freed';
    var choices = [right, 'Nothing — it is a no-op', 'It leaks one string',
                   'It fails to compile'];
    return {
      topic: 'C++ · self-assignment',
      kind: 'choice',
      prompt: 'An assignment operator does <code>if (str) delete str;</code> and then ' +
        '<code>str = new string(*(other.str));</code>. What happens on <code>a = a;</code>?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'The delete frees the string, and then <code>other.str</code> — which is the same ' +
        'pointer, because <code>other</code> is <code>a</code> — is dereferenced. Under ' +
        '<code>-fsanitize=address</code> this is a hard crash inside <code>operator=</code>. ' +
        'One line fixes it: <code>if (this == &amp;other) return *this;</code>'
    };
  } });

  /* ---- delete vs delete[] ---- */
  QZ_GEN.push({ topic: 'pointers', make: function () {
    var arr = Math.random() < 0.5;
    var src = arr ? 'int * a = new int[10];' : 'int * a = new int;';
    var right = arr ? 'delete [] a;' : 'delete a;';
    return {
      topic: 'C++ · delete',
      kind: 'choice',
      prompt: 'How should this be released?<pre class="pp-snippet">' + esc(src) + '</pre>',
      choices: ['delete a;', 'delete [] a;', 'free(a);', 'nothing — it is collected'].sort(),
      answer: right,
      check: textCheck(right),
      explain: '<code>new</code> pairs with <code>delete</code>, and <code>new []</code> pairs with ' +
        '<code>delete []</code>. Mixing them is undefined behaviour, not a diagnosed error — a ' +
        'sanitiser will call it an alloc-dealloc mismatch, and an ordinary build will say nothing ' +
        'at all.'
    };
  } });

  /* ---- const operator[] ---- */
  QZ_GEN.push({ topic: 'pointers', make: function () {
    var right = 'const int & operator[](int idx) const';
    var choices = [right, 'int & operator[](int idx)', 'int operator[](int idx)',
                   'neither — it does not compile'];
    return {
      topic: 'C++ · const overloads',
      kind: 'choice',
      prompt: 'A vector class declares both <code>int &amp; operator[](int)</code> and ' +
        '<code>const int &amp; operator[](int) const</code>. Inside ' +
        '<code>int addNumbers(const vector&lt;int&gt; &amp; toAdd)</code>, which does ' +
        '<code>toAdd[i]</code> call?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'The vector is reached through a const reference, so only const member functions may ' +
        'be called on it — the const overload. Provide only the non-const version and this function ' +
        'stops compiling, which is the usual reason a class ends up with both.'
    };
  } });
