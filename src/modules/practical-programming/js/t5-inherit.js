  /* ============================================================
     TOPIC 05 · inheritance, dispatch, object layout and casts

       dpCall    — which function body actually runs?
       lyLayout  — where does each member sit, and how big is it?
       ctCast    — which cast, and what does it check?

     Layout and dispatch are both checked against g++ in the test
     suite: the offsets below are compared with what the compiler
     reports for the same class, so they are measurements rather
     than a diagram.
     ============================================================ */

  /* ---------- which body runs ---------- */

  /*
     A call through a name of static type S, on an object whose real
     type is D. Without `virtual`, the compiler picks the function by
     the static type, at compile time. With it, the object carries a
     pointer to a table and the choice happens at run time.
  */
  var DP_TYPES = ['Coordinate', 'Bikes'];

  function dpCall(opts) {
    var o = opts || {};
    var isVirtual = !!o.isVirtual;
    var stat = o.staticType || 'Coordinate';
    var dyn = o.dynamicType || 'Bikes';
    var how = o.how || 'ref';        // 'ref' | 'ptr' | 'value' | 'object'

    if (DP_TYPES.indexOf(stat) < 0 || DP_TYPES.indexOf(dyn) < 0) {
      return { ok: false, error: 'Unknown type.' };
    }
    /* Calling straight on the variable: there is no second name
       involved, so the static type is the object's own type and the
       question of virtual dispatch never arises. */
    if (how === 'object') stat = dyn;
    /* A Coordinate is not a Bikes: you cannot name a base object
       through a derived reference without a cast. */
    if (stat === 'Bikes' && dyn === 'Coordinate') {
      return { ok: false, error: 'A Coordinate is not a Bikes — this does not compile.' };
    }

    var sliced = (how === 'value') && stat === 'Coordinate' && dyn === 'Bikes';
    /* Copying a Bikes into a Coordinate keeps only the Coordinate
       part. What is left really is a Coordinate, vtable included. */
    var effective = sliced ? 'Coordinate' : dyn;
    var runs = (isVirtual && !sliced) ? effective : stat;

    var output = runs === 'Bikes' ? '20,10: 100 bikes' : '20,10';

    var why;
    if (sliced) {
      why = 'The object is <strong>copied into</strong> a Coordinate, and only the Coordinate part ' +
        'fits. The extra members are not truncated so much as never copied, and what remains is a ' +
        'genuine Coordinate — so even with <code>virtual</code>, Coordinate’s version is what runs. ' +
        'This is <strong>slicing</strong>, and it is silent.';
    } else if (!isVirtual) {
      why = 'Without <code>virtual</code>, the compiler resolves the call from the ' +
        '<strong>declared</strong> type, which is <code>' + stat + '</code>. It fixes the address ' +
        'of the function at compile time; the object’s real type never enters into it. Efficient, ' +
        'and the opposite of what Java does.';
    } else if (stat === dyn) {
      why = 'Static and real type are the same here, so the answer is the same either way.';
    } else {
      why = 'With <code>virtual</code>, the object carries a pointer to its class’s table of ' +
        'virtual functions. The call reads that table, so the version belonging to the ' +
        '<strong>real</strong> type runs — <code>' + dyn + '</code>’s.';
    }

    return {
      ok: true, runs: runs, output: output, sliced: sliced,
      dynamic: isVirtual && !sliced, why: why,
      staticType: stat, dynamicType: dyn, how: how
    };
  }

  /** The same case as C++, so it can be run rather than trusted. */
  function dpSource(opts) {
    var o = opts || {};
    var v = o.isVirtual ? 'virtual ' : '';
    var ov = o.isVirtual ? ' override' : '';
    var how = o.how || 'ref';
    var s = '#include <iostream>\nusing namespace std;\n' +
      'class Coordinate {\nprotected:\n  int x, y;\npublic:\n' +
      '  Coordinate(int a, int b) : x(a), y(b) {}\n' +
      '  ' + v + 'void printDetails() { cout << x << "," << y; }\n' +
      (o.isVirtual ? '  virtual ~Coordinate() {}\n' : '') +
      '};\n' +
      'class Bikes : public Coordinate {\nprotected:\n  int howMany;\npublic:\n' +
      '  Bikes(int a, int b, int h) : Coordinate(a,b), howMany(h) {}\n' +
      '  ' + v + 'void printDetails()' + ov +
      ' { Coordinate::printDetails(); cout << ": " << howMany << " bikes"; }\n' +
      '};\n';

    var make = o.dynamicType === 'Bikes' ? 'Bikes real(20,10,100);' : 'Coordinate real(20,10);';
    var body;
    if (how === 'ref') {
      body = '  ' + make + '\n  ' + o.staticType + ' & r = real;\n  r.printDetails();\n';
    } else if (how === 'ptr') {
      body = '  ' + make + '\n  ' + o.staticType + ' * p = &real;\n  p->printDetails();\n';
    } else if (how === 'value') {
      body = '  ' + make + '\n  ' + o.staticType + ' copy = real;\n  copy.printDetails();\n';
    } else {
      body = '  ' + make + '\n  real.printDetails();\n';
    }
    return s + 'int main() {\n' + body + '  cout << endl;\n  return 0;\n}\n';
  }

  /* ---------- object layout ---------- */

  /*
     Sizes and alignments as g++ uses them on a 64-bit target. The
     test suite compares every field of every layout below with what
     the compiler reports, so if this table were wrong the suite
     would say so.
  */
  var LY_SIZES = { int: 4, double: 8, char: 1, 'pointer': 8, vptr: 8 };

  function lyLayout(spec) {
    var s = spec || {};
    var bases = s.bases || [];        // [{ name, members:[{name,type}], hasVirtual }]
    var own = s.members || [];
    var isVirtual = !!s.hasVirtual;

    var fields = [];
    var off = 0;
    function align(a) { if (off % a) off += a - (off % a); }

    /* The first base contributes its own vtable pointer, if there is
       one, at offset zero: a derived object begins with a valid base
       object, which is why a Derived* converts to a Base* for free. */
    var anyVirtual = isVirtual || bases.some(function (b) { return b.hasVirtual; });

    bases.forEach(function (b, i) {
      var start = off;
      var sub = [];
      if (b.hasVirtual || (i === 0 && isVirtual)) {
        align(LY_SIZES.vptr);
        sub.push({ name: '(vtable pointer)', type: 'vptr', offset: off,
                   size: LY_SIZES.vptr, vptr: true });
        off += LY_SIZES.vptr;
      }
      (b.members || []).forEach(function (m) {
        var sz = LY_SIZES[m.type] || 4;
        align(sz);
        sub.push({ name: m.name, type: m.type, offset: off, size: sz });
        off += sz;
      });
      /* An empty base still occupies nothing here only if it has no
         members and no vtable; otherwise its subobject is padded to
         its own alignment before the next one starts. */
      if (off === start) { sub.push({ name: '(empty)', type: 'char', offset: off, size: 1, pad: true }); off += 1; }
      align(8);
      fields.push({ base: b.name, from: start, to: off, members: sub });
    });

    /* No bases: the vtable pointer, if any, goes first. */
    if (!bases.length && isVirtual) {
      align(LY_SIZES.vptr);
      fields.push({ base: null, from: 0, to: LY_SIZES.vptr,
        members: [{ name: '(vtable pointer)', type: 'vptr', offset: 0,
                    size: LY_SIZES.vptr, vptr: true }] });
      off = LY_SIZES.vptr;
    }

    var mine = [];
    own.forEach(function (m) {
      var sz = LY_SIZES[m.type] || 4;
      align(sz);
      mine.push({ name: m.name, type: m.type, offset: off, size: sz });
      off += sz;
    });

    /* The object is padded to the alignment of its widest member. */
    var widest = 1;
    fields.concat([{ members: mine }]).forEach(function (g) {
      g.members.forEach(function (m) { widest = Math.max(widest, Math.min(m.size, 8)); });
    });
    align(widest);

    var flat = [];
    fields.forEach(function (g) { g.members.forEach(function (m) { flat.push(m); }); });
    mine.forEach(function (m) { flat.push(m); });

    return {
      ok: true, size: off, groups: fields, own: mine, all: flat,
      hasVptr: anyVirtual,
      baseOffsets: fields.map(function (g) { return { name: g.base, offset: g.from }; })
    };
  }

  /** The class the layout describes, as C++ that prints its own offsets. */
  function lySource(spec) {
    var s = spec || {};
    var bases = s.bases || [];
    var decl = '';
    bases.forEach(function (b) {
      decl += 'class ' + b.name + ' {\npublic:\n';
      (b.members || []).forEach(function (m) { decl += '  ' + m.type + ' ' + m.name + ';\n'; });
      if (b.hasVirtual) decl += '  virtual void f_' + b.name + '() {}\n  virtual ~' + b.name + '() {}\n';
      decl += '};\n';
    });
    decl += 'class Derived' + (bases.length
      ? ' : ' + bases.map(function (b) { return 'public ' + b.name; }).join(', ') : '') +
      ' {\npublic:\n';
    (s.members || []).forEach(function (m) { decl += '  ' + m.type + ' ' + m.name + ';\n'; });
    if (s.hasVirtual) decl += '  virtual void g() {}\n  virtual ~Derived() {}\n';
    decl += '};\n';

    var prints = '';
    (s.members || []).forEach(function (m) {
      prints += '  cout << "' + m.name + '=" << ((char*)&d.' + m.name + ' - (char*)&d) << endl;\n';
    });
    bases.forEach(function (b) {
      (b.members || []).forEach(function (m) {
        prints += '  cout << "' + m.name + '=" << ((char*)&d.' + m.name + ' - (char*)&d) << endl;\n';
      });
      prints += '  { ' + b.name + ' * bp = &d; cout << "base ' + b.name +
        '=" << ((char*)bp - (char*)&d) << endl; }\n';
    });

    return '#include <iostream>\nusing namespace std;\n' + decl +
      'int main() {\n  Derived d;\n  cout << "size=" << sizeof(Derived) << endl;\n' +
      prints + '  return 0;\n}\n';
  }

  var LY_PRESETS = {
    plain: { label: 'two ints, no inheritance',
      spec: { members: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }] } },
    derived: { label: 'a derived class adds one',
      spec: { bases: [{ name: 'Coordinate', members: [{ name: 'x', type: 'int' },
                                                      { name: 'y', type: 'int' }] }],
              members: [{ name: 'howMany', type: 'int' }] } },
    virtualBase: { label: 'the same, with a virtual function',
      spec: { bases: [{ name: 'Coordinate', hasVirtual: true,
                        members: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }] }],
              members: [{ name: 'howMany', type: 'int' }] } },
    multiple: { label: 'two base classes',
      spec: { bases: [{ name: 'Coordinate', members: [{ name: 'x', type: 'int' },
                                                      { name: 'y', type: 'int' }] },
                      { name: 'StreetAddress', members: [{ name: 'number', type: 'int' },
                                                         { name: 'floors', type: 'int' }] }],
              members: [{ name: 'howMany', type: 'int' }] } },
    multipleVirtual: { label: 'two base classes, first one virtual',
      spec: { bases: [{ name: 'Coordinate', hasVirtual: true,
                        members: [{ name: 'x', type: 'int' }, { name: 'y', type: 'int' }] },
                      { name: 'StreetAddress', members: [{ name: 'number', type: 'int' },
                                                         { name: 'floors', type: 'int' }] }],
              members: [{ name: 'howMany', type: 'int' }] } },
    padding: { label: 'a double after an int',
      spec: { members: [{ name: 'a', type: 'int' }, { name: 'b', type: 'double' },
                        { name: 'c', type: 'int' }] } }
  };

  /* ---------- casts ---------- */

  var CT_CASTS = {
    static_cast: {
      when: 'the conversion is one the compiler can verify makes sense',
      checks: 'at compile time, that the types are related',
      runtime: 'nothing at all',
      fails: 'it does not compile'
    },
    dynamic_cast: {
      when: 'you have a base pointer and need to know whether it really points at a derived object',
      checks: 'at run time, what the object actually is',
      runtime: 'compares the object’s vtable pointer against the target type’s',
      fails: 'returns <code>nullptr</code> for pointers, throws <code>std::bad_cast</code> for references'
    },
    reinterpret_cast: {
      when: 'you want the same bits read as a different type and are prepared to be responsible',
      checks: 'nothing',
      runtime: 'nothing',
      fails: 'it does not, and whatever happens next is on you'
    },
    const_cast: {
      when: 'you need to remove const, usually to call an older interface',
      checks: 'that const is the only difference',
      runtime: 'nothing',
      fails: 'it does not compile'
    }
  };

  /*
     Situations, and which cast is the right answer. `verify` says
     whether the safe answer can be checked by compiling.
  */
  var CT_CASES = {
    numeric: {
      text: 'You have an <code>int</code> and want a <code>double</code>.',
      right: 'static_cast',
      why: 'A conversion the language already defines. <code>static_cast&lt;double&gt;(a)</code> is ' +
        'the same as the old <code>(double) a</code>, written so that it can be searched for.'
    },
    downKnown: {
      text: 'You have a <code>Coordinate *</code> and you are certain it points at a ' +
        '<code>Bikes</code>.',
      right: 'static_cast',
      why: 'It compiles, because Bikes really is derived from Coordinate, and it costs nothing at ' +
        'run time. But nothing checks your certainty — if you are wrong, the program reads whatever ' +
        'happens to be there.'
    },
    downUnknown: {
      text: 'You have a <code>Coordinate *</code> and want to know <em>whether</em> it points at a ' +
        '<code>Bikes</code>.',
      right: 'dynamic_cast',
      why: 'This is the question <code>instanceof</code> answers in Java, and the cast answers it ' +
        'here: you get the pointer if it is one, and <code>nullptr</code> if it is not, so ' +
        '<code>if (b)</code> is the test.'
    },
    downRef: {
      text: 'The same, but you have a <code>Coordinate &amp;</code> rather than a pointer.',
      right: 'dynamic_cast',
      why: 'A reference cannot be null, so failure cannot be reported by returning nothing — it ' +
        'throws <code>std::bad_cast</code> instead, and you need a try/catch.'
    },
    up: {
      text: 'You have a <code>Bikes *</code> and want a <code>Coordinate *</code>.',
      right: 'no cast needed',
      why: 'Casting upwards is a conversion the language performs by itself. Every Bikes object ' +
        'begins with a complete Coordinate, so the pointer is already valid — though with multiple ' +
        'inheritance it may be adjusted by a few bytes.'
    },
    removeConst: {
      text: 'You have a <code>const Thing *</code> and need to call a non-const function on it.',
      right: 'const_cast',
      why: 'The only cast that removes const. Modifying an object that was really declared ' +
        '<code>const</code> is undefined behaviour, so this is for interfaces that forgot to say ' +
        'const, not for changing your mind.'
    },
    bits: {
      text: 'You want to read the two ints inside an object as a plain array.',
      right: 'reinterpret_cast',
      why: 'No check of any kind. It is the right tool for talking to hardware or a wire format, ' +
        'and the wrong tool for almost everything else.'
    },
    unrelated: {
      text: 'You have a <code>std::string *</code> and want a <code>Bikes *</code>.',
      right: 'reinterpret_cast',
      why: '<code>static_cast</code> refuses, because the types are unrelated, and ' +
        '<code>dynamic_cast</code> refuses too. Only <code>reinterpret_cast</code> will do it, and ' +
        'the result is meaningless — the refusal was the useful part.'
    }
  };

  function ctChoose(caseName, picked) {
    var c = CT_CASES[caseName];
    if (!c) return { ok: false, error: 'Unknown situation.' };
    var right = c.right;
    var correct = picked === right;

    var note = null;
    if (!correct && picked && CT_CASTS[picked]) {
      if (picked === 'reinterpret_cast') {
        note = 'It would compile — <code>reinterpret_cast</code> always does. That is the problem: ' +
          'it would also compile if the answer were nonsense.';
      } else if (picked === 'dynamic_cast' && right === 'static_cast') {
        note = 'It may well work, but it costs a run-time lookup to answer a question you already ' +
          'know the answer to, and it needs the class to have a vtable.';
      } else if (picked === 'static_cast' && right === 'dynamic_cast') {
        note = 'This compiles and tells you nothing. You get a pointer either way, and using it ' +
          'when the object is not really that type is undefined behaviour.';
      } else if (picked === 'const_cast') {
        note = '<code>const_cast</code> changes only const. It cannot change the type.';
      }
    }

    return { ok: true, correct: correct, right: right, why: c.why, note: note,
             detail: CT_CASTS[right] || null, text: c.text };
  }

  /** Compilable evidence for the cases that turn on whether it compiles. */
  function ctSource(caseName, which) {
    var head = '#include <iostream>\n#include <string>\n#include <typeinfo>\nusing namespace std;\n' +
      'class Coordinate {\npublic:\n  int x, y;\n  Coordinate(int a,int b):x(a),y(b){}\n' +
      '  virtual void f() {}\n  virtual ~Coordinate() {}\n};\n' +
      'class Bikes : public Coordinate {\npublic:\n  int howMany;\n' +
      '  Bikes(int a,int b,int h):Coordinate(a,b),howMany(h){}\n};\n';
    var body;
    if (caseName === 'downUnknown') {
      body = '  Coordinate c(1,2);\n  Coordinate * p = &c;\n' +
        '  Bikes * b = ' + which + '<Bikes*>(p);\n  cout << (b == nullptr) << endl;\n';
    } else if (caseName === 'unrelated') {
      body = '  string s;\n  Bikes * b = ' + which + '<Bikes*>(&s);\n  (void)b;\n  cout << 1 << endl;\n';
    } else if (caseName === 'removeConst') {
      body = '  const Coordinate c(1,2);\n  Coordinate * d = ' + which + '<Coordinate*>(&c);\n' +
        '  (void)d;\n  cout << 1 << endl;\n';
    } else if (caseName === 'numeric') {
      body = '  int a = 7;\n  double b = ' + which + '<double>(a);\n  cout << b << endl;\n';
    } else {
      return null;
    }
    return head + 'int main() {\n' + body + '  return 0;\n}\n';
  }
