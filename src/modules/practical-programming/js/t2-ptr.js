  /* ============================================================
     TOPIC 02 · pointers, ownership, and the Rule of Three
     ------------------------------------------------------------
     Two engines.

     The first is a type checker for the small language of
     pointers: given some names of type T and T*, which of
     `T c = a;`, `T * e = a;`, `T f = *b;` and so on are legal.
     That is slide 10's quiz, and it is decidable by looking only
     at how many stars each side has.

     The second is the week's real subject. A class holding a
     `string *` has three special members the compiler will write
     for you -- copy constructor, assignment operator, destructor
     -- and the versions it writes copy the POINTER. Two objects
     then share one string, which is wrong in three separate ways:
     they see each other's changes, the second destructor frees
     memory the first already freed, and the string the assignment
     overwrote is never freed at all.

     rtSimulate models exactly that: pick which of the three you
     write and whether they copy deeply, run a scenario, and it
     reports what prints, what leaks and what is freed twice.
     rtGenerate emits the same class as real C++ so the test suite
     can check the verdict with g++ and AddressSanitizer.
     ============================================================ */

  /* ---------- slide 10: is this initialisation legal? ---------- */

  /**
     Every expression here is a name with some number of stars
     applied or removed. `*` takes one off, `&` puts one on, and
     the two sides have to end up equal.
  */
  function ptTypeOf(expr, env) {
    var e = String(expr).trim();
    var stars = 0;
    while (/^[*&]/.test(e)) {
      stars += e.charAt(0) === '*' ? -1 : 1;
      e = e.slice(1).trim();
    }
    /* `in`, not a truth test: a plain `string a;` has depth 0, and `!env[e]`
       is true for 0, so testing truthiness rejects every non-pointer name.
       That made lines i and vi of the slide-10 quiz come out illegal. */
    if (!(e in env)) return { ok: false, error: 'No name <code>' + esc(e) + '</code> is declared.' };
    var depth = env[e] + stars;
    if (depth < 0) {
      return { ok: false, error: 'Too many <code>*</code>: <code>' + esc(e) + '</code> is ' +
        ptName(env[e]) + ', and dereferencing it that many times runs out of pointers.' };
    }
    return { ok: true, depth: depth, base: e, applied: stars };
  }

  function ptName(depth) {
    return depth === 0 ? 'a string' : 'a pointer to ' + (depth === 1 ? 'a string' : ptName(depth - 1));
  }

  /** `string c = a;` or `string * e = a;` — does it typecheck? */
  function ptCheck(declStars, expr, env) {
    var t = ptTypeOf(expr, env);
    if (!t.ok) return { ok: true, legal: false, why: t.error };
    var legal = t.depth === declStars;
    return {
      ok: true, legal: legal,
      lhs: declStars, rhs: t.depth,
      why: legal
        ? 'Both sides are ' + ptName(declStars) + '.'
        : 'The left is ' + ptName(declStars) + ' but the right is ' + ptName(t.depth) +
          '. C++ will not convert between the two on its own — a pointer is an address, and an ' +
          'object is not.'
    };
  }

  /** The slide's own six lines, with the quiz's own numbering. */
  var PT_QUIZ = [
    { tag: 'i',   decl: 0, expr: 'a',  src: 'string c = a;' },
    { tag: 'ii',  decl: 0, expr: 'b',  src: 'string d = b;' },
    { tag: 'iii', decl: 1, expr: 'a',  src: 'string * e = a;' },
    { tag: 'iv',  decl: 0, expr: '*b', src: 'string f = *b;' },
    { tag: 'v',   decl: 1, expr: 'b',  src: 'string * g = b;' },
    { tag: 'vi',  decl: 1, expr: '&a', src: 'string * h = &a;' }
  ];
  var PT_ENV = { a: 0, b: 1 };   // string a; string * b;

  /* ---------- the Rule of Three ---------- */

  /**
     Run a scenario over a class holding one `string *`.

     opts.copy    'default' (shallow) | 'deep' | 'none' (same as default)
     opts.assign  'default' (shallow) | 'deep' | 'deep-delete' | 'deep-delete-guard'
     opts.dtor    true if the class has ~C(){ delete str; }
     opts.scenario 'copy' | 'assign' | 'self' | 'scope'
  */
  function rtSimulate(opts) {
    opts = opts || {};
    var copyKind = opts.copy || 'default';
    var assignKind = opts.assign || 'default';
    var hasDtor = !!opts.dtor;
    var scenario = opts.scenario || 'copy';

    var blocks = [];          // heap strings
    var objs = [];            // the C++ objects
    var events = [];
    var problems = [];

    function alloc(text, why) {
      blocks.push({ id: blocks.length + 1, text: text, freed: false, why: why });
      return blocks.length;
    }
    function make(name) {
      objs.push({ name: name, ptr: alloc('', name + ' constructed') });
      events.push({ name: name, what: 'default constructor: <code>str(new string())</code>',
        detail: 'allocates block #' + objs[objs.length - 1].ptr });
      return objs[objs.length - 1];
    }
    function find(n) { return objs.filter(function (o) { return o.name === n; })[0]; }
    function push(name, ch) {
      var o = find(name);
      blocks[o.ptr - 1].text += ch;
      events.push({ name: name, what: 'addCharacter(<code>' + ch + '</code>)',
        detail: 'appends to block #' + o.ptr });
    }

    /* Slide 52's order matters and is easy to get subtly wrong: BOTH objects
       exist before either gets a character. Copying first is what makes the
       shallow case print "ab" twice and the deep case print "a" and "b" —
       add the character to a first and the deep case prints "a" and "ab",
       which muddles the very distinction the example exists to show.

       A differential test cannot catch this on its own: the simulation and
       the generated C++ would simply agree on the wrong program. It is the
       assertion written from the slide that pins it. */
    var a = make('a');

    if (scenario === 'copy') {
      var b;
      if (copyKind === 'deep') {
        b = { name: 'b', ptr: alloc(blocks[a.ptr - 1].text, 'deep copy of a') };
        objs.push(b);
        events.push({ name: 'b', what: 'your copy constructor',
          detail: '<code>str = new string(*(other.str))</code> — a new block #' + b.ptr +
            ' holding the same characters' });
      } else {
        b = { name: 'b', ptr: a.ptr };
        objs.push(b);
        events.push({ name: 'b', what: 'the compiler’s copy constructor',
          detail: '<code>str(other.str)</code> — copies the <strong>pointer</strong>, so b shares ' +
            'block #' + a.ptr + ' with a' });
      }
      push('a', 'a');
      push('b', 'b');

    } else if (scenario === 'assign' || scenario === 'self') {
      push('a', 'a');
      var second = make('b');
      push('b', 'b');
      var lhs = scenario === 'self' ? a : second;
      var rhs = a;
      var label = scenario === 'self' ? 'a = a' : 'b = a';

      if (assignKind === 'deep-delete-guard' && lhs === rhs) {
        events.push({ name: label, what: 'your assignment operator, with the guard',
          detail: '<code>if (this == &amp;other) return *this;</code> — assigning something to ' +
            'itself is a no-op, and nothing is freed' });
      } else {
        if (assignKind === 'deep-delete' || assignKind === 'deep-delete-guard') {
          if (!blocks[lhs.ptr - 1].freed) {
            blocks[lhs.ptr - 1].freed = true;
            events.push({ name: label, what: '<code>if (str) delete str;</code>',
              detail: 'frees block #' + lhs.ptr + ', which ' + lhs.name + ' was holding' });
          }
        }
        if (assignKind === 'default') {
          lhs.ptr = rhs.ptr;
          events.push({ name: label, what: 'the compiler’s assignment operator',
            detail: '<code>str = other.str</code> — copies the pointer. ' + lhs.name +
              ' and ' + rhs.name + ' now share block #' + rhs.ptr +
              ', and whatever ' + lhs.name + ' was holding is now unreachable' });
        } else {
          var srcBlock = blocks[rhs.ptr - 1];
          if (srcBlock.freed) {
            problems.push({ kind: 'use-after-free',
              msg: 'The assignment freed the block first, and then read from it — because ' +
                '<code>other</code> is the same object. <code>new string(*(other.str))</code> ' +
                'dereferences a pointer to memory that was released a line earlier.' });
            events.push({ name: label, what: '<code>new string(*(other.str))</code>',
              detail: '<strong>reads block #' + rhs.ptr + ', which was just freed</strong>' });
          } else {
            lhs.ptr = alloc(srcBlock.text, 'deep copy in assignment');
            events.push({ name: label, what: 'your assignment operator',
              detail: '<code>str = new string(*(other.str))</code> — a fresh block #' + lhs.ptr });
          }
        }
      }
    }

    /* Scope exit: destructors run in reverse order of construction. */
    var destroyed = [];
    objs.slice().reverse().forEach(function (o) {
      if (!hasDtor) {
        destroyed.push({ name: o.name, what: 'no destructor — block #' + o.ptr + ' is simply abandoned' });
        return;
      }
      var blk = blocks[o.ptr - 1];
      if (blk.freed) {
        problems.push({ kind: 'double-free',
          msg: '<code>~C()</code> for <strong>' + o.name + '</strong> deletes block #' + o.ptr +
            ', which has already been deleted. Two objects held the same pointer, and both ' +
            'destructors ran.' });
        destroyed.push({ name: o.name, what: '<strong>deletes block #' + o.ptr + ' a second time</strong>' });
      } else {
        blk.freed = true;
        destroyed.push({ name: o.name, what: 'deletes block #' + o.ptr });
      }
    });

    var leaked = blocks.filter(function (b2) { return !b2.freed; });
    if (leaked.length) {
      problems.push({ kind: 'leak',
        msg: leaked.length + ' block' + (leaked.length === 1 ? '' : 's') + ' never freed (' +
          leaked.map(function (b2) { return '#' + b2.id; }).join(', ') + '). ' +
          (hasDtor
            ? 'The assignment replaced a pointer without deleting what it was holding, so nothing ' +
              'points at that memory any more and nothing will ever free it.'
            : 'Without a destructor the class never frees what its constructor allocated — and in ' +
              'C++ nothing else will.') });
    }

    /* What printIt() shows for each object, before any of this. */
    var prints = objs.map(function (o) {
      return { name: o.name, text: blocks[o.ptr - 1].text, block: o.ptr };
    });
    var shared = {};
    objs.forEach(function (o) { (shared[o.ptr] || (shared[o.ptr] = [])).push(o.name); });
    var sharing = Object.keys(shared).filter(function (k) { return shared[k].length > 1; })
      .map(function (k) { return { block: +k, names: shared[k] }; });

    return {
      ok: true, blocks: blocks, objs: objs, events: events, destroyed: destroyed,
      prints: prints, sharing: sharing, problems: problems,
      clean: problems.length === 0,
      leaks: leaked.length,
      copyKind: copyKind, assignKind: assignKind, hasDtor: hasDtor, scenario: scenario
    };
  }

  /** The same class and scenario as real C++. */
  function rtGenerate(opts) {
    var copyKind = opts.copy || 'default';
    var assignKind = opts.assign || 'default';
    var hasDtor = !!opts.dtor;
    var scenario = opts.scenario || 'copy';

    var L = ['#include <iostream>', '#include <string>',
      'using std::string; using std::cout; using std::endl;',
      'class IHazStringPtr {', 'private:', '  string * str;', 'public:',
      '  IHazStringPtr() : str(new string()) {}'];

    if (copyKind === 'deep') {
      L.push('  IHazStringPtr(const IHazStringPtr & other)');
      L.push('    : str(other.str == nullptr ? nullptr : new string(*(other.str))) {}');
    }
    if (assignKind !== 'default') {
      L.push('  IHazStringPtr & operator=(const IHazStringPtr & other) {');
      if (assignKind === 'deep-delete-guard') L.push('    if (this == &other) return *this;');
      if (assignKind === 'deep-delete' || assignKind === 'deep-delete-guard') {
        L.push('    if (str) delete str;');
      }
      L.push('    if (other.str) { str = new string(*(other.str)); } else { str = nullptr; }');
      L.push('    return *this;');
      L.push('  }');
    }
    if (hasDtor) L.push('  ~IHazStringPtr() { delete str; }');
    L.push('  void addCharacter(const char c) { str->push_back(c); }');
    L.push('  void printIt() const { cout << *str << endl; }');
    L.push('};');

    L.push('int main() {');
    if (scenario === 'copy') {
      L.push('  IHazStringPtr a;');
      L.push('  IHazStringPtr b = a;');
      L.push('  a.addCharacter(\'a\');');
      L.push('  b.addCharacter(\'b\');');
      L.push('  a.printIt(); b.printIt();');
    } else if (scenario === 'assign') {
      L.push('  IHazStringPtr a; a.addCharacter(\'a\');');
      L.push('  IHazStringPtr b; b.addCharacter(\'b\');');
      L.push('  b = a;');
      L.push('  a.printIt(); b.printIt();');
    } else if (scenario === 'self') {
      L.push('  IHazStringPtr a; a.addCharacter(\'a\');');
      L.push('  IHazStringPtr b; b.addCharacter(\'b\');');
      L.push('  a = a;');
      L.push('  a.printIt(); b.printIt();');
    }
    L.push('  return 0;');
    L.push('}');
    return { ok: true, source: L.join('\n') };
  }

  /**
     What the simulation says the program prints.

     A leak does not change the output -- the memory is simply never given
     back -- so a leaking program still has a predictable answer. A double
     free or a use-after-free is undefined behaviour, and there the honest
     answer is that there is no prediction to make.
  */
  function rtExpectedOutput(sim) {
    var undef = sim.problems.some(function (p) {
      return p.kind === 'double-free' || p.kind === 'use-after-free';
    });
    if (undef) return null;
    return sim.prints.map(function (p) { return p.text; });
  }

  /* ---------- the Rule of Three itself ---------- */

  var RT_MEMBERS = [
    { id: 'copy', name: 'copy constructor', sig: 'C(const C & other)',
      when: 'a new object is made from an existing one — <code>C b = a;</code>, passing by value, ' +
            'returning by value' },
    { id: 'assign', name: 'assignment operator', sig: 'C & operator=(const C & other)',
      when: 'an object that already exists is overwritten — <code>b = a;</code>' },
    { id: 'dtor', name: 'destructor', sig: '~C()',
      when: 'an object goes out of scope, or is deleted' }
  ];

  /**
     The rule: if a class needs any one of the three, it almost
     certainly needs all three, because all three exist for the
     same reason — the class owns something the compiler does not
     know how to copy or release.
  */
  function rtAdvice(opts) {
    var writes = [];
    if (opts.copy === 'deep') writes.push('copy');
    if (opts.assign !== 'default') writes.push('assign');
    if (opts.dtor) writes.push('dtor');

    var missing = ['copy', 'assign', 'dtor'].filter(function (k) { return writes.indexOf(k) < 0; });
    return {
      ok: true, writes: writes, missing: missing,
      complete: missing.length === 0,
      none: writes.length === 0,
      note: writes.length === 0
        ? 'None of the three is written, so the compiler supplies all of them — and every one copies ' +
          'or abandons the pointer rather than the string it points at.'
        : (missing.length === 0
            ? 'All three written. The class owns its string, copies it when copied, releases it when ' +
              'destroyed.'
            : 'Writing ' + writes.length + ' of the three and leaving ' + missing.length +
              ' to the compiler is the dangerous middle. The ones you wrote exist because the ' +
              'compiler’s versions were wrong for this class — and the same argument applies to ' +
              'the ' + missing.map(function (k) {
                return RT_MEMBERS.filter(function (m) { return m.id === k; })[0].name;
              }).join(' and ') + '.')
    };
  }

  var RT_SCENARIOS = {
    copy:   { label: 'IHazStringPtr b = a;', blurb: 'construct one object from another' },
    assign: { label: 'b = a;', blurb: 'overwrite an object that already exists' },
    self:   { label: 'a = a;', blurb: 'assign an object to itself — rarer, and rarely tested' }
  };
