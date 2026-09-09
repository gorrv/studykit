  /* ============================================================
     TOPIC 01 · two rules the tracer does not cover
     ------------------------------------------------------------
     Member initialisation, and operator resolution. Both are
     "will this compile?" questions with a definite answer, and
     both are checkable — miGenerate and opGenerate emit real C++
     that the test suite hands to g++.

     On the first, the slides say "A Journey -- this won't
     compile!" for the version that assigns in the constructor
     body, and "This will compile" for the initialiser-list
     version. True for that class, but the rule underneath is not
     "assignment in the body is illegal". Members are constructed
     BEFORE the body runs; without a default constructor there is
     nothing legal to construct them with, so the error is the
     missing default constructor rather than the assignment.

     Give Coordinate a default constructor and the body version
     compiles — and does more work: default-construct, then assign
     over it. Watching a counting constructor confirms it,
     "default assign" against "copy". A const member, or a
     reference member, forces the list whatever the defaults are.
     ============================================================ */

  /**
     Will this constructor compile, and how does the member get
     built?

     memberHasDefault  does the member's type have a no-argument constructor
     memberIsConst     is the member declared const
     style             'list' or 'body'
  */
  function miCheck(opts) {
    var hasDefault = !!opts.memberHasDefault;
    var isConst = !!opts.memberIsConst;
    var isRef = !!opts.memberIsRef;
    var style = opts.style === 'body' ? 'body' : 'list';

    var reasons = [], compiles = true;

    if (style === 'body') {
      if (isConst) {
        compiles = false;
        reasons.push('the member is <code>const</code>, so it can never be assigned — only ' +
          'initialised, which is what the initialiser list does');
      }
      if (isRef) {
        compiles = false;
        reasons.push('the member is a reference, and a reference must be bound when it is created; ' +
          'assigning to it would assign through it, not rebind it');
      }
      if (!hasDefault) {
        compiles = false;
        reasons.push('the member has no default constructor, and members are built <em>before</em> ' +
          'the body runs — so there is nothing this line can construct it with');
      }
    }

    var order = style === 'list'
      ? ['the member is constructed directly from the argument — one construction']
      : (compiles
          ? ['the member is <strong>default-constructed</strong> first, before the body runs',
             'then the body <strong>assigns</strong> over it — two operations where one would do']
          : ['the member would have to be default-constructed before the body runs, and it cannot be']);

    return {
      ok: true, compiles: compiles, style: style, reasons: reasons, order: order,
      wasteful: compiles && style === 'body',
      note: compiles
        ? (style === 'list'
            ? 'Compiles, and constructs the member exactly once.'
            : 'Compiles — but only because the member type has a default constructor. It is built ' +
              'once with that, then overwritten. The initialiser list does it in one step.')
        : 'Does not compile: ' + reasons[0] + '.'
    };
  }

  /** The same case as real C++, so a compiler can confirm it. */
  function miGenerate(opts) {
    var hasDefault = !!opts.memberHasDefault;
    var isConst = !!opts.memberIsConst;
    var style = opts.style === 'body' ? 'body' : 'list';
    var L = ['#include <iostream>', 'using std::cout; using std::endl;', 'class Coordinate {',
      'protected:', '  int x; int y;', 'public:'];
    if (hasDefault) L.push('  Coordinate() : x(0), y(0) { }');
    L.push('  Coordinate(int a, int b) : x(a), y(b) { }');
    L.push('  int getX() const { return x; }');
    L.push('};');
    L.push('class Journey {');
    L.push('protected:');
    L.push('  ' + (isConst ? 'const ' : '') + 'Coordinate start;');
    L.push('public:');
    if (style === 'list') L.push('  Journey(Coordinate s) : start(s) { }');
    else L.push('  Journey(Coordinate s) { start = s; }');
    L.push('  int startX() const { return start.getX(); }');
    L.push('};');
    L.push('int main() { Journey j(Coordinate(7, 1)); cout << j.startX() << endl; return 0; }');
    return { ok: true, source: L.join('\n'), expectX: 7 };
  }

  /* ---------- operator resolution ---------- */

  /**
     The slide's recipe: for a == b with a of type A and b of type
     B, provide EITHER a member on A taking a B, OR a free function
     taking both. The member form only works when you can edit A,
     which is the point of slide 52 — you cannot edit a class the
     system gave you.
  */
  function opEqCheck(where) {
    var opts = {
      member: {
        decl: 'class Alice { public: bool operator==(const Bob & rhs) const; };',
        works: true,
        note: 'A member of the left-hand type. <code>a == b</code> becomes ' +
          '<code>a.operator==(b)</code>, so the member has to live on <strong>Alice</strong>, the ' +
          'thing on the left.'
      },
      free: {
        decl: 'bool operator==(const Alice & lhs, const Bob & rhs);',
        works: true,
        note: 'A free function taking both sides. This is the one that works when Alice belongs to ' +
          'somebody else — you cannot add a member to a class you did not write, but you can always ' +
          'write a free function.'
      },
      wrongside: {
        decl: 'class Bob { public: bool operator==(const Alice & rhs) const; };',
        works: false,
        note: 'A member on <strong>Bob</strong>, the right-hand type. That defines ' +
          '<code>b == a</code>, not <code>a == b</code>. In C++11 the two are separate declarations ' +
          'and neither implies the other. (C++20 added reversed candidates, which is why this ' +
          'sometimes appears to work in newer compilers — but not under the standard this course uses.)'
      },
      none: {
        decl: '(nothing declared)',
        works: false,
        note: 'Nothing to call. Unlike Java there is no inherited <code>equals</code> to fall back ' +
          'on, and no default: comparing two objects with <code>==</code> is an error unless somebody ' +
          'wrote the operator.'
      }
    };
    var o = opts[where] || opts.none;
    return { ok: true, kind: where, decl: o.decl, works: o.works, note: o.note };
  }

  /**
     operator<< and the reason it must return the stream.

     cout << "It is at " << a << endl  is
     ((cout << "It is at ") << a) << endl, so whatever the middle
     call returns is what endl is applied to. Return void and the
     last step tries to shift into nothing.
  */
  function opShiftCheck(returns) {
    var isRef = returns === 'ostream&';
    return {
      ok: true, returns: returns, chains: isRef,
      expansion: '((cout &lt;&lt; "It is at ") &lt;&lt; a) &lt;&lt; endl',
      note: isRef
        ? 'Returning <code>ostream &amp;</code> hands the same stream back, so the next ' +
          '<code>&lt;&lt;</code> has something to shift into and the chain continues.'
        : 'Returning <code>void</code> works for a single <code>cout &lt;&lt; a</code> and breaks the ' +
          'moment anything follows it: the outer call becomes <code>void &lt;&lt; endl</code>, and ' +
          'there is no such operator.'
    };
  }

  function opGenerate(kind) {
    var head = ['#include <iostream>', '#include <string>',
      'using std::cout; using std::endl; using std::ostream;',
      'class Coordinate {', 'protected:', '  int x; int y;', 'public:',
      '  Coordinate(int a, int b) : x(a), y(b) { }',
      '  int getX() const { return x; }', '  int getY() const { return y; }'];

    if (kind === 'eq-member') {
      head.push('  bool operator==(const Coordinate & rhs) const { return x == rhs.x && y == rhs.y; }');
      head.push('};');
      head.push('int main() { Coordinate a(4,2), b(4,2); cout << (a == b) << endl; return 0; }');
      return { ok: true, source: head.join('\n'), expect: '1' };
    }
    if (kind === 'eq-free') {
      head.push('};');
      head.push('bool operator==(const Coordinate & l, const Coordinate & r) {');
      head.push('  return l.getX() == r.getX() && l.getY() == r.getY(); }');
      head.push('int main() { Coordinate a(4,2), b(4,2); cout << (a == b) << endl; return 0; }');
      return { ok: true, source: head.join('\n'), expect: '1' };
    }
    if (kind === 'eq-none') {
      head.push('};');
      head.push('int main() { Coordinate a(4,2), b(4,2); cout << (a == b) << endl; return 0; }');
      return { ok: true, source: head.join('\n'), expect: null, shouldFail: true };
    }
    if (kind === 'shift-void') {
      head.push('};');
      head.push('void operator<<(ostream & o, const Coordinate & r) { o << r.getX() << "," << r.getY(); }');
      head.push('int main() { Coordinate a(-4,2); cout << "It is at " << a << endl; return 0; }');
      return { ok: true, source: head.join('\n'), expect: null, shouldFail: true };
    }
    if (kind === 'shift-ref') {
      head.push('};');
      head.push('ostream & operator<<(ostream & o, const Coordinate & r) {');
      head.push('  o << r.getX() << "," << r.getY(); return o; }');
      head.push('int main() { Coordinate a(-4,2); cout << "It is at " << a << endl; return 0; }');
      return { ok: true, source: head.join('\n'), expect: 'It is at -4,2' };
    }
    if (kind === 'shift-write') {
      head.push('  void write(ostream & o) const { o << x << "," << y; }');
      head.push('};');
      head.push('ostream & operator<<(ostream & o, const Coordinate & r) { r.write(o); return o; }');
      head.push('int main() { Coordinate a(-4,2); cout << "It is at " << a << endl; return 0; }');
      return { ok: true, source: head.join('\n'), expect: 'It is at -4,2' };
    }
    return { ok: false, error: 'Unknown case.' };
  }

  /* ---------- Java against C++, on the points the week raises ---------- */

  var PP_CONTRASTS = [
    { id: 'new', topic: 'Making an object',
      java: 'Coordinate a = new Coordinate(4, -3);',
      cpp: 'Coordinate a(4, -3);',
      note: 'No <code>new</code>. <code>a</code> is not a handle to a Coordinate somewhere else — it ' +
        '<em>is</em> the Coordinate, sitting in this function’s frame, destroyed when the frame goes.' },
    { id: 'assign', topic: 'One object, or two?',
      java: 'Coordinate b = a;   // b and a are the same object',
      cpp: 'Coordinate b = a;   // b is a COPY of a',
      note: 'Identical syntax, opposite meaning. This is the single most common source of confusion ' +
        'coming from Java, and the tracer above exists for it.' },
    { id: 'equals', topic: 'Comparing',
      java: 'if (a.equals(b))    // == compares references',
      cpp: 'if (a == b)         // if somebody wrote operator==',
      note: 'In Java <code>==</code> on two <code>new String("Dave")</code>s is false, because there ' +
        'are two objects. In C++ <code>string</code> defines <code>==</code> to compare contents, so ' +
        'it is true. For your own classes, nothing compares them until you say how.' },
    { id: 'null', topic: 'Null',
      java: 'String a = null;    // NullPointerException waiting',
      cpp: 'string a;           // an empty string, not a null one',
      note: 'A C++ object of type <code>string</code> is a string. References cannot be null either. ' +
        'You can still get null pointers in C++ — but a great deal of code has nowhere to put one.' },
    { id: 'init', topic: 'Uninitialised values',
      java: 'int x;              // 0, guaranteed',
      cpp: 'int x;              // indeterminate — reading it is undefined behaviour',
      note: 'Java default-initialises; C++ does not, for local built-in types. Reading such a value is ' +
        'undefined behaviour, which means anything at all is permitted to happen — not "some ' +
        'unpredictable number". Do not demonstrate it and reason from what you saw.' },
    { id: 'bounds', topic: 'Off the end of an array',
      java: 'ArrayIndexOutOfBoundsException',
      cpp: 'v[10] on a vector of 3 — undefined behaviour, usually silence',
      note: 'No exception, no check. <code>v.at(10)</code> does throw, and is worth the keystrokes ' +
        'while you are learning.' },
    { id: 'compile', topic: 'What you run',
      java: 'javac then java — the JVM runs the bytecode',
      cpp: 'g++ -std=c++11 -o hello hello.cc, then ./hello',
      note: 'The compiler produces a native executable that the operating system runs directly. ' +
        'There is no JVM in the picture, which is where the performance argument comes from.' }
  ];
