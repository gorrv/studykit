  /* ---------- Topic 05 · inheritance, dispatch, layout, casts ----------

     Marked by the same engines the tools use. Every layout figure and
     every dispatch answer below is checked against g++ by the test
     suite, so a wrong answer here would fail the build.
     ------------------------------------------------------------ */

  /* ---- which body runs ---- */
  QZ_GEN.push({ topic: 'inheritance', make: function () {
    var isVirtual = Math.random() < 0.5;
    var how = qzPick(['ref', 'ptr', 'value']);
    var r = dpCall({ isVirtual: isVirtual, staticType: 'Coordinate',
                     dynamicType: 'Bikes', how: how });
    var handle = {
      ref: 'Coordinate & r = strand;  r.printDetails();',
      ptr: 'Coordinate * p = &strand;  p->printDetails();',
      value: 'Coordinate copy = strand;  copy.printDetails();'
    }[how];
    var right = r.output;
    return {
      topic: 'C++ · virtual functions',
      kind: 'choice',
      prompt: 'Coordinate::printDetails prints <code>20,10</code>; Bikes adds ' +
        '<code>: 100 bikes</code>. printDetails is <strong>' +
        (isVirtual ? 'virtual' : 'not virtual') + '</strong>. What is printed?' +
        '<pre class="pp-snippet">Bikes strand(20,10,100);\n' + esc(handle) + '</pre>',
      choices: ['20,10', '20,10: 100 bikes'],
      answer: right,
      check: textCheck(right),
      explain: r.why
    };
  } });

  /* ---- sizeof ---- */
  QZ_GEN.push({ topic: 'inheritance', make: function () {
    var k = qzPick(Object.keys(LY_PRESETS));
    var preset = LY_PRESETS[k];
    var r = lyLayout(preset.spec);
    var decl = [];
    (preset.spec.bases || []).forEach(function (b) {
      decl.push('class ' + b.name + ' { ' +
        (b.members || []).map(function (m) { return m.type + ' ' + m.name + '; '; }).join('') +
        (b.hasVirtual ? 'virtual void f(); virtual ~' + b.name + '(); ' : '') + '};');
    });
    decl.push('class Derived' +
      ((preset.spec.bases || []).length
        ? ' : ' + preset.spec.bases.map(function (b) { return 'public ' + b.name; }).join(', ')
        : '') + ' { ' +
      (preset.spec.members || []).map(function (m) { return m.type + ' ' + m.name + '; '; }).join('') +
      (preset.spec.hasVirtual ? 'virtual void g(); ' : '') + '};');
    var right = String(r.size);
    var choices = [right, String(r.size - 8), String(r.size + 8), String(r.size - 4)]
      .filter(function (v, i, a) { return +v > 0 && a.indexOf(v) === i; });
    return {
      topic: 'C++ · object layout',
      kind: 'choice',
      prompt: 'On a 64-bit build, what is <code>sizeof(Derived)</code>?' +
        '<pre class="pp-snippet">' + esc(decl.join('\n')) + '</pre>',
      choices: choices.sort(function (a, b) { return +a - +b; }),
      answer: right,
      check: textCheck(right),
      explain: 'Members sit in order, base classes first, each aligned to its own size' +
        (r.hasVptr ? ', and a class with virtual functions carries an extra 8-byte pointer to ' +
          'its vtable before anything else' : '') + '. Total ' + r.size + '.'
    };
  } });

  /* ---- where does a base subobject start ---- */
  QZ_GEN.push({ topic: 'inheritance', make: function () {
    var k = qzPick(['multiple', 'multipleVirtual']);
    var spec = LY_PRESETS[k].spec;
    var r = lyLayout(spec);
    var target = r.baseOffsets[1];
    var right = String(target.offset);
    var choices = ['0', '4', '8', '16'];
    if (choices.indexOf(right) < 0) choices.push(right);
    return {
      topic: 'C++ · multiple inheritance',
      kind: 'choice',
      prompt: '<code>class Derived : public ' + esc(spec.bases[0].name) + ', public ' +
        esc(spec.bases[1].name) + '</code>, where <code>' + esc(spec.bases[0].name) +
        '</code> holds two ints' +
        (spec.bases[0].hasVirtual ? ' <strong>and has virtual functions</strong>' : '') +
        '. Given <code>Derived d;</code>, how many bytes past <code>&amp;d</code> does ' +
        '<code>(' + esc(spec.bases[1].name) + ' *) &amp;d</code> point?',
      choices: choices.sort(function (a, b) { return +a - +b; }),
      answer: right,
      check: textCheck(right),
      explain: 'Only the first base can start at offset zero. The second starts after it — ' +
        (spec.bases[0].hasVirtual
          ? 'here 8 bytes of vtable pointer plus two ints, so 16.'
          : 'here two ints, so 8.') +
        ' The compiler adjusts the pointer for you, and adjusts it back on the way down.'
    };
  } });

  /* ---- which cast ---- */
  QZ_GEN.push({ topic: 'inheritance', make: function () {
    var c = qzPick(Object.keys(CT_CASES));
    var right = CT_CASES[c].right;
    return {
      topic: 'C++ · casts',
      kind: 'choice',
      prompt: CT_CASES[c].text + ' Which cast?',
      choices: ['static_cast', 'dynamic_cast', 'reinterpret_cast', 'const_cast', 'no cast needed'],
      answer: right,
      check: textCheck(right),
      explain: CT_CASES[c].why
    };
  } });

  /* ---- what does a failed cast do ---- */
  QZ_GEN.push({ topic: 'inheritance', make: function () {
    var isRef = Math.random() < 0.5;
    var right = isRef ? 'It throws std::bad_cast' : 'It evaluates to nullptr';
    return {
      topic: 'C++ · casts',
      kind: 'choice',
      prompt: 'A <code>dynamic_cast&lt;Bikes' + (isRef ? '&amp;' : '*') + '&gt;</code> is applied ' +
        'to a Coordinate ' + (isRef ? 'reference' : 'pointer') + ' that is not really a Bikes. ' +
        'What happens?',
      choices: ['It evaluates to nullptr', 'It throws std::bad_cast',
                'It does not compile', 'It succeeds and the object is corrupt'],
      answer: right,
      check: textCheck(right),
      explain: isRef
        ? 'A reference cannot be null, so there is no value to hand back that means failure — it ' +
          'throws instead, and needs a try/catch.'
        : 'Which is why the result is always tested: <code>if (b) { … }</code>.'
    };
  } });

  /* ---- slicing ---- */
  QZ_GEN.push({ topic: 'inheritance', make: function () {
    var right = 'Only the Coordinate part is copied, and c behaves as a Coordinate';
    return {
      topic: 'C++ · slicing',
      kind: 'choice',
      prompt: 'With <code>virtual void printDetails()</code> on both classes, what does ' +
        '<code>Coordinate c = Bikes(3,4,100);</code> do?',
      choices: [
        right,
        'c keeps its Bikes behaviour, as it would in Java',
        'It does not compile',
        'c holds a pointer to the Bikes object'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'A Coordinate variable is the size of a Coordinate. The Bikes is copied into it and ' +
        'only what fits is copied — no error, no warning. What remains is a real Coordinate, ' +
        'vtable pointer and all, so even virtual calls find the base version.'
    };
  } });

  /* ---- virtual destructors ---- */
  QZ_GEN.push({ topic: 'inheritance', make: function () {
    var right = 'Only ~Coordinate runs, so the Bikes part is never destroyed';
    return {
      topic: 'C++ · destructors',
      kind: 'choice',
      prompt: 'Coordinate’s destructor is <strong>not</strong> virtual. What does ' +
        '<code>Coordinate * c = new Bikes(...); delete c;</code> do?',
      choices: [
        right,
        'Both destructors run, base last',
        'It does not compile',
        'Only ~Bikes runs'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'Destructors follow the same rule as any other function: without virtual, the ' +
        'declared type decides. Anything the Bikes part owned is leaked. The habit to build: any ' +
        'class with a virtual function gets a virtual destructor.'
    };
  } });

  /* ---- pure virtual ---- */
  QZ_GEN.push({ topic: 'inheritance', make: function () {
    var right = '= 0 after the declaration';
    return {
      topic: 'C++ · abstract classes',
      kind: 'choice',
      prompt: 'How do you make a class abstract?',
      choices: [
        right,
        'Mark the class abstract',
        'Give it a protected constructor and nothing else',
        'Declare it with the interface keyword'
      ],
      answer: right,
      check: textCheck(right),
      explain: 'There is no <code>abstract</code> keyword. <code>virtual void f() = 0;</code> ' +
        'makes the function pure virtual, and any class with one — inherited or declared — cannot ' +
        'be instantiated.'
    };
  } });

  /* ---- holding derived objects ---- */
  QZ_GEN.push({ topic: 'inheritance', make: function () {
    var right = 'vector<unique_ptr<Coordinate> >';
    return {
      topic: 'C++ · containers and inheritance',
      kind: 'choice',
      prompt: 'You need a container of Coordinates where some elements are really Bikes, and you ' +
        'would rather not write any <code>delete</code>. What do you use?',
      choices: [right, 'vector<Coordinate>', 'vector<Coordinate *>', 'vector<Bikes>'],
      answer: right,
      check: textCheck(right),
      explain: '<code>vector&lt;Coordinate&gt;</code> slices every element. ' +
        '<code>vector&lt;Coordinate *&gt;</code> works but leaves the deleting to you. Add ' +
        'elements with <code>emplace_back(new Bikes(...))</code> — <code>push_back</code> wants a ' +
        'unique_ptr, and the conversion from a raw pointer is explicit.'
    };
  } });
