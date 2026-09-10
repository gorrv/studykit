  /* ============================================================
     TOPIC 04 · value categories, binding, overload resolution
     and unique_ptr ownership

     Three engines, each answering a question a compiler answers:

       vcBind   — can this reference name that expression?
       ovPick   — with these overloads, which one runs?
       upRun    — who owns the object, and when is it deleted?

     All three are checked against g++ in the test suite. The
     rules below are the ones the compiler actually applies, not
     a summary of them.
     ============================================================ */

  /* ---------- expressions, and what category they are ---------- */

  /*
     An expression is an *lvalue* if it names something that will
     still be there on the next line — a variable, or a reference
     to one. It is an *rvalue* if it is a value that exists only
     for the duration of the expression it appears in.

     `cc` is the same expression as real C++, so the test suite can
     hand it to a compiler and check the category by seeing which
     references bind to it.
  */
  var VC_EXPRS = {
    'x': {
      cat: 'lvalue', decl: 'int x = 7;', cc: 'x',
      why: 'A variable. It has a name and an address, and it is still there afterwards.'
    },
    'x + 7': {
      cat: 'rvalue', decl: 'int x = 7;', cc: 'x + 7',
      why: 'The sum is computed into a temporary. Nothing is called <code>x + 7</code> ' +
        'afterwards, so there is nothing for a reference to name.'
    },
    '42': {
      cat: 'rvalue', decl: '', cc: '42',
      why: 'A literal. It is a value, not a place where a value is kept.'
    },
    'byValue()': {
      cat: 'rvalue', decl: '', cc: 'byValue()',
      fn: 'int byValue() { int a = 3, b = 4; return a + b; }',
      why: 'The function returns <code>int</code>, so the result is copied into a temporary. ' +
        'The variables inside the function are gone by the time you see it.'
    },
    'byRef()': {
      cat: 'lvalue', decl: '', cc: 'byRef()',
      fn: 'int global = 5;\nint & byRef() { return global; }',
      why: 'The function returns <code>int &amp;</code> — a reference to something that outlives ' +
        'the call. The call expression names that object.'
    },
    'obj.getX()': {
      cat: 'lvalue', decl: 'OneInt obj;', cc: 'obj.getX()',
      fn: 'class OneInt { int x; public: OneInt() : x(0) {} int & getX() { return x; } };',
      why: 'Returns a reference to a member of an object that still exists, so the call names ' +
        '<code>obj.x</code>. Changing it through the reference changes the object.'
    },
    'obj.copyX()': {
      cat: 'rvalue', decl: 'OneInt obj;', cc: 'obj.copyX()',
      fn: 'class OneInt { int x; public: OneInt() : x(0) {} int copyX() { return x; } };',
      why: 'The same member, returned <em>by value</em>. What you get is a copy in a temporary; ' +
        'writing to it would change nothing.'
    },
    '*p': {
      cat: 'lvalue', decl: 'int x = 7; int * p = &x;', cc: '*p',
      why: 'Following a pointer lands you on the object it points at. That object has a name and ' +
        'an address — the dereference is an lvalue even though the pointer was a copy.'
    },
    'arr[0]': {
      cat: 'lvalue', decl: 'int arr[3] = {1,2,3};', cc: 'arr[0]',
      why: 'Indexing is a dereference in disguise, so it names an element of the array.'
    },
    'std::move(x)': {
      cat: 'rvalue', decl: 'int x = 7;', cc: 'std::move(x)',
      why: '<code>std::move</code> does not move anything. It is a cast: it takes an lvalue and ' +
        'hands back the same object described as an rvalue, so that the machinery below picks ' +
        'the stealing overload. <code>x</code> is still there — you have just promised not to ' +
        'care what is left in it.'
    }
  };

  var VC_BINDINGS = {
    value: { text: 'int y = <em>e</em>;', takes: 'a copy',
      lvalue: true, rvalue: true },
    ref: { text: 'int &amp; y = <em>e</em>;', takes: 'an lvalue reference',
      lvalue: true, rvalue: false },
    constref: { text: 'const int &amp; y = <em>e</em>;', takes: 'a const lvalue reference',
      lvalue: true, rvalue: true },
    rvalueref: { text: 'int &amp;&amp; y = <em>e</em>;', takes: 'an rvalue reference',
      lvalue: false, rvalue: true }
  };

  /**
     Does `binding` bind to `expr`?
     -> { ok, legal, cat, why, consequence }
  */
  function vcBind(exprName, bindingName) {
    var e = VC_EXPRS[exprName];
    var b = VC_BINDINGS[bindingName];
    if (!e || !b) return { ok: false, error: 'Unknown expression or binding.' };

    var legal = e.cat === 'lvalue' ? b.lvalue : b.rvalue;
    var why, consequence = null;

    if (bindingName === 'value') {
      why = 'A copy is always allowed. The value is read and a new <code>int</code> is made from ' +
        'it, so it does not matter whether the source survives the line.';
      consequence = 'Writing to <code>y</code> changes nothing else.';
    } else if (bindingName === 'ref') {
      why = legal
        ? 'A plain reference has to name an object that will still exist, and this expression ' +
          'names one.'
        : 'A plain reference has to name an object that will still exist. This expression is a ' +
          'temporary that disappears at the end of the line, so there is nothing to name — and ' +
          'the compiler stops rather than letting you hold a reference to something gone.';
      consequence = legal ? 'Writing through <code>y</code> writes to the original.' : null;
    } else if (bindingName === 'constref') {
      why = e.cat === 'lvalue'
        ? 'A const reference binds to an lvalue like any other reference; you simply cannot write ' +
          'through it.'
        : 'This is the special case worth remembering: a <strong>const</strong> lvalue reference ' +
          'may bind to a temporary, and doing so <strong>extends the temporary’s lifetime</strong> ' +
          'to match the reference. Since you cannot write through it, nothing can be silently lost.';
      consequence = e.cat === 'rvalue'
        ? 'The temporary lives as long as <code>y</code> does.'
        : 'Read-only access to the original.';
    } else {
      why = legal
        ? 'An rvalue reference is for exactly this: something about to be thrown away. Binding to ' +
          'it says you intend to take what is inside.'
        : 'An rvalue reference will not bind to an lvalue. The whole point of it is to mark ' +
          'something as expendable, and a named variable is not — you might use it on the next ' +
          'line. Write <code>std::move(x)</code> if you really mean it.';
      consequence = legal
        ? 'You may now gut the object: take its pointers and leave it empty.'
        : null;
    }

    return { ok: true, legal: legal, cat: e.cat, why: why, consequence: consequence,
             exprWhy: e.why, decl: e.decl, fn: e.fn || null };
  }

  /** The whole table at once, for the summary grid. */
  function vcTable() {
    var rows = [];
    Object.keys(VC_EXPRS).forEach(function (name) {
      var cells = {};
      Object.keys(VC_BINDINGS).forEach(function (b) { cells[b] = vcBind(name, b).legal; });
      rows.push({ expr: name, cat: VC_EXPRS[name].cat, cells: cells });
    });
    return rows;
  }

  /** The C++ for one cell, so this can be checked rather than believed. */
  function vcSource(exprName, bindingName) {
    var e = VC_EXPRS[exprName];
    if (!e) return null;
    var decl = {
      value: 'int y = ', ref: 'int & y = ', constref: 'const int & y = ',
      rvalueref: 'int && y = '
    }[bindingName];
    return '#include <iostream>\n#include <utility>\n' +
      (e.fn ? e.fn + '\n' : '') +
      'int main() {\n' +
      (e.decl ? '  ' + e.decl + '\n' : '') +
      '  ' + decl + e.cc + ';\n' +
      '  std::cout << y << std::endl;\n' +
      '  return 0;\n}\n';
  }

  /* ---------- which overload runs ---------- */

  /*
     Given some subset of

       void f(Thing & t);        // 'ref'
       void f(const Thing & t);  // 'constref'
       void f(Thing && t);       // 'rvalueref'

     and an argument, which one does the compiler pick? The rule is
     that each candidate is first checked for viability, and the
     viable ones are then ranked: an exact match beats one that adds
     const, and both beat nothing.
  */
  var OV_ARGS = {
    lvalue: { text: 'a named variable', cc: 'thing', decl: 'Thing thing;' },
    constlvalue: { text: 'a const variable', cc: 'kthing', decl: 'const Thing kthing;' },
    rvalue: { text: 'a temporary', cc: 'Thing()', decl: '' },
    moved: { text: 'std::move(thing)', cc: 'std::move(thing)', decl: 'Thing thing;' }
  };

  function ovPick(present, arg) {
    var has = {};
    (present || []).forEach(function (p) { has[p] = true; });
    if (!OV_ARGS[arg]) return { ok: false, error: 'Unknown argument kind.' };

    var isRvalue = (arg === 'rvalue' || arg === 'moved');
    var isConst = (arg === 'constlvalue');

    /* Viability. */
    var viable = [];
    if (has.ref && !isRvalue && !isConst) viable.push('ref');
    if (has.constref) viable.push('constref');           // binds to anything
    if (has.rvalueref && isRvalue && !isConst) viable.push('rvalueref');

    /* Ranking: the exact-match overload for this category wins; the
       const reference is the fallback that takes everything. */
    var order = isRvalue ? ['rvalueref', 'ref', 'constref'] : ['ref', 'rvalueref', 'constref'];
    var chosen = null;
    for (var i = 0; i < order.length; i++) {
      if (viable.indexOf(order[i]) >= 0) { chosen = order[i]; break; }
    }

    var label = {
      ref: 'void f(Thing &amp; t)',
      constref: 'void f(const Thing &amp; t)',
      rvalueref: 'void f(Thing &amp;&amp; t)'
    };

    var why;
    if (!chosen) {
      if (isConst && has.ref && !has.constref) {
        why = 'The only candidate takes a non-const reference, and the argument is const. ' +
          'Binding it would hand the function permission to modify something declared not to change.';
      } else if (isRvalue && !has.constref && !has.rvalueref) {
        why = 'The only candidate takes a non-const lvalue reference, and the argument is a ' +
          'temporary. There is nothing for that reference to name once the line ends.';
      } else {
        why = 'No candidate can take this argument.';
      }
    } else if (chosen === 'rvalueref') {
      why = 'The argument is an rvalue and there is an overload for exactly that, so it wins — ' +
        'even though the const reference could also have taken it. This is what makes moving ' +
        'automatic: you do not ask for it, you simply provide the overload and it gets used ' +
        'whenever the argument is expendable.';
    } else if (chosen === 'ref') {
      why = 'The argument is a modifiable lvalue and there is an overload taking exactly that. ' +
        'It is preferred over the const version, which would be a worse match.';
    } else {
      why = has.rvalueref && isRvalue
        ? 'The const reference takes it.'
        : (isRvalue
            ? 'No overload takes an rvalue reference, so the const reference picks it up. Nothing ' +
              'is stolen — this is the pre-2011 behaviour, where a temporary gets copied and then ' +
              'thrown away.'
            : 'The const reference is the only viable candidate, so it is chosen. The function ' +
              'cannot modify what it was given.');
    }

    return {
      ok: true, compiles: chosen !== null, chosen: chosen,
      chosenText: chosen ? label[chosen] : null,
      viable: viable, why: why,
      steals: chosen === 'rvalueref',
      copies: chosen === 'constref' && isRvalue
    };
  }

  /** Real C++ for a case, each overload printing its own name. */
  function ovSource(present, arg) {
    var has = {};
    (present || []).forEach(function (p) { has[p] = true; });
    var a = OV_ARGS[arg];
    var s = '#include <iostream>\n#include <utility>\nusing namespace std;\n' +
      'struct Thing { int v; Thing() : v(0) {} };\n';
    if (has.ref) s += 'void f(Thing & t) { (void)t; cout << "ref" << endl; }\n';
    if (has.constref) s += 'void f(const Thing & t) { (void)t; cout << "constref" << endl; }\n';
    if (has.rvalueref) s += 'void f(Thing && t) { (void)t; cout << "rvalueref" << endl; }\n';
    s += 'int main() {\n' + (a.decl ? '  ' + a.decl + '\n' : '') +
      '  f(' + a.cc + ');\n  return 0;\n}\n';
    return s;
  }

  /* ---------- unique_ptr ownership ---------- */

  /*
     A tiny program over one or two unique_ptrs. Each step is checked
     for whether it would compile, and the objects are tracked so the
     trace can say exactly when each one is deleted.

     Ops:
       { kind:'make',    name, value }        unique_ptr<Res> a(new Res(v));
       { kind:'copy',    to, from }           b = a;              (refused)
       { kind:'copyctor',to, from }           unique_ptr<Res> b = a;  (refused)
       { kind:'move',    to, from }           b = std::move(a);
       { kind:'fromfn',  name }               a = makeOne();
       { kind:'release', name }               a.release();
       { kind:'reset',   name, value }        a.reset(new Res(v));
       { kind:'deref',   name }               a->v
       { kind:'ifnull',  name }               if (a)
       { kind:'scope' }                       end of block
  */
  function upRun(ops) {
    var owns = {};        // name -> object id or null
    var alive = {};       // id -> value
    var next = 1;
    var steps = [];
    var errors = [];
    var leaked = [];
    var out = [];         // what the generated program would print
    var stopped = false;

    function ownersOf(id) {
      return Object.keys(owns).filter(function (n) { return owns[n] === id; });
    }
    function destroy(id, note) {
      if (!(id in alive)) return;
      out.push('deleted ' + alive[id]);
      delete alive[id];
      Object.keys(owns).forEach(function (n) { if (owns[n] === id) owns[n] = null; });
      if (note) steps[steps.length - 1].deleted = alive[id];
    }
    function snap(text, note, extra) {
      var row = {
        text: text, note: note,
        owners: Object.keys(owns).map(function (n) {
          return { name: n, holds: owns[n] === null ? null : alive[owns[n]] };
        }),
        printed: out.slice()
      };
      if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
      steps.push(row);
    }

    (ops || []).forEach(function (op) {
      if (stopped) return;

      if (op.kind === 'make') {
        var id = next++;
        alive[id] = op.value;
        owns[op.name] = id;
        snap('unique_ptr<Res> ' + op.name + '(new Res(' + op.value + '));',
          op.name + ' now owns ' + op.value + '. Nothing else can: that is the whole promise.');

      } else if (op.kind === 'copy' || op.kind === 'copyctor') {
        var line = op.kind === 'copy'
          ? op.to + ' = ' + op.from + ';'
          : 'unique_ptr<Res> ' + op.to + ' = ' + op.from + ';';
        errors.push({
          line: line,
          why: op.kind === 'copy'
            ? 'The copy assignment operator is <code>= delete</code>d. If it were not, ' +
              op.to + ' and ' + op.from + ' would hold the same pointer and both would delete it.'
            : 'The copy constructor is <code>= delete</code>d, for the same reason: two owners, ' +
              'two deletes, one object.'
        });
        snap(line, 'Does not compile.', { fails: true });
        stopped = true;

      } else if (op.kind === 'move') {
        var src = owns[op.from];
        var had = owns[op.to];
        if (had != null) destroy(had);
        owns[op.to] = src == null ? null : src;
        owns[op.from] = null;
        snap(op.to + ' = std::move(' + op.from + ');',
          (had != null
            ? 'Whatever ' + op.to + ' held is deleted first — it is about to point somewhere else. '
            : '') +
          'Then the pointer is taken from ' + op.from + ' and ' + op.from +
          ' is set to null. One owner throughout; nothing is copied.');

      } else if (op.kind === 'fromfn') {
        var had2 = owns[op.name];
        if (had2 != null) destroy(had2);
        var id2 = next++;
        alive[id2] = op.value === undefined ? 'f' : op.value;
        owns[op.name] = id2;
        snap(op.name + ' = makeOne();',
          'The function returns a temporary, which is an rvalue — so the <em>move</em> assignment ' +
          'is picked without you asking. This is why returning a unique_ptr from a function works ' +
          'while assigning from a variable does not.');

      } else if (op.kind === 'release') {
        var id3 = owns[op.name];
        if (id3 == null) {
          snap(op.name + '.release();', op.name + ' holds nothing, so this returns null.');
        } else {
          owns[op.name] = null;
          leaked.push(alive[id3]);
          snap(op.name + '.release();',
            op.name + ' gives up ownership and returns the raw pointer. <strong>Nothing is ' +
            'deleted.</strong> Whoever catches that pointer is now responsible for it — and here ' +
            'nobody did.', { leak: alive[id3] });
        }

      } else if (op.kind === 'reset') {
        var id4 = owns[op.name];
        if (id4 != null) destroy(id4);
        var id5 = next++;
        alive[id5] = op.value;
        owns[op.name] = id5;
        snap(op.name + '.reset(new Res(' + op.value + '));',
          'Deletes what was held, then takes the new pointer.');

      } else if (op.kind === 'deref') {
        var id6 = owns[op.name];
        if (id6 == null) {
          errors.push({
            /* This one compiles. A null unique_ptr is a perfectly good object;
               it is following the null pointer inside it that is undefined,
               and no compiler can see that coming. */
            runtime: true,
            line: op.name + '->value();',
            why: op.name + ' holds nothing. This <strong>compiles</strong> — the mistake is not ' +
              'one the compiler can catch. Following the null pointer inside is undefined ' +
              'behaviour: usually a crash, sometimes silence, which is worse.'
          });
          snap(op.name + '->value();', 'Undefined behaviour: ' + op.name + ' is null.',
            { fails: true, runtime: true });
          stopped = true;
        } else {
          out.push('read ' + alive[id6]);
          snap('cout << ' + op.name + '->value();', 'Prints ' + alive[id6] + '.');
        }

      } else if (op.kind === 'ifnull') {
        var id7 = owns[op.name];
        out.push(id7 == null ? op.name + ' is empty' : op.name + ' holds something');
        snap('if (' + op.name + ') { ... }',
          'A unique_ptr converts to bool, so this asks whether it holds anything. Here it ' +
          (id7 == null ? 'does not' : 'does') + '. This is the check to make before dereferencing.');

      } else if (op.kind === 'scope') {
        /* Destruction is in reverse order of declaration. */
        var names = Object.keys(owns).reverse();
        names.forEach(function (n) {
          var id8 = owns[n];
          if (id8 != null) destroy(id8);
        });
        snap('}  // end of scope',
          'Every unique_ptr is destroyed, in reverse order of declaration, and each deletes what ' +
          'it still owns. This is the point of the class: you never wrote <code>delete</code>.');
      }
    });

    return {
      ok: true, steps: steps, errors: errors, leaked: leaked,
      out: out, compiles: errors.filter(function (e) { return !e.runtime; }).length === 0
    };
  }

  /** The same program as C++, printing a line whenever an object is destroyed. */
  function upSource(ops) {
    var head = '#include <iostream>\n#include <memory>\n#include <utility>\nusing namespace std;\n' +
      'struct Res {\n' +
      '  int v;\n' +
      '  Res(int vIn) : v(vIn) {}\n' +
      '  ~Res() { cout << "deleted " << v << endl; }\n' +
      '  int value() const { return v; }\n' +
      '};\n' +
      'unique_ptr<Res> makeOne() { return unique_ptr<Res>(new Res(99)); }\n' +
      'int main() {\n  {\n';
    var body = '';
    var declared = {};
    (ops || []).forEach(function (op) {
      if (op.kind === 'make') {
        declared[op.name] = true;
        body += '    unique_ptr<Res> ' + op.name + '(new Res(' + op.value + '));\n';
      } else if (op.kind === 'copy') {
        body += '    ' + op.to + ' = ' + op.from + ';\n';
      } else if (op.kind === 'copyctor') {
        body += '    unique_ptr<Res> ' + op.to + ' = ' + op.from + ';\n';
      } else if (op.kind === 'move') {
        if (!declared[op.to]) { declared[op.to] = true; body += '    unique_ptr<Res> ' + op.to + ';\n'; }
        body += '    ' + op.to + ' = std::move(' + op.from + ');\n';
      } else if (op.kind === 'fromfn') {
        if (!declared[op.name]) { declared[op.name] = true; body += '    unique_ptr<Res> ' + op.name + ';\n'; }
        body += '    ' + op.name + ' = makeOne();\n';
      } else if (op.kind === 'release') {
        body += '    ' + op.name + '.release();\n';
      } else if (op.kind === 'reset') {
        body += '    ' + op.name + '.reset(new Res(' + op.value + '));\n';
      } else if (op.kind === 'deref') {
        body += '    cout << "read " << ' + op.name + '->value() << endl;\n';
      } else if (op.kind === 'ifnull') {
        body += '    if (' + op.name + ') { cout << "' + op.name + ' holds something" << endl; }\n' +
                '    else { cout << "' + op.name + ' is empty" << endl; }\n';
      }
    });
    return head + body + '  }\n  return 0;\n}\n';
  }

  var UP_PRESETS = {
    scope: { label: 'owning something, and letting it go',
      ops: [{ kind: 'make', name: 'a', value: 1 }, { kind: 'deref', name: 'a' },
            { kind: 'scope' }] },
    copy: { label: 'copying one (refused)',
      ops: [{ kind: 'make', name: 'a', value: 1 }, { kind: 'copyctor', to: 'b', from: 'a' }] },
    move: { label: 'moving one',
      ops: [{ kind: 'make', name: 'a', value: 1 }, { kind: 'make', name: 'b', value: 2 },
            { kind: 'move', to: 'b', from: 'a' }, { kind: 'ifnull', name: 'a' },
            { kind: 'scope' }] },
    fromFunction: { label: 'assigning from a function',
      ops: [{ kind: 'make', name: 'a', value: 1 }, { kind: 'fromfn', name: 'a', value: 99 },
            { kind: 'scope' }] },
    release: { label: 'release, and the leak it makes',
      ops: [{ kind: 'make', name: 'a', value: 1 }, { kind: 'release', name: 'a' },
            { kind: 'ifnull', name: 'a' }, { kind: 'scope' }] },
    reset: { label: 'reset',
      ops: [{ kind: 'make', name: 'a', value: 1 }, { kind: 'reset', name: 'a', value: 2 },
            { kind: 'scope' }] },
    useAfterMove: { label: 'reading one after moving from it',
      ops: [{ kind: 'make', name: 'a', value: 1 }, { kind: 'move', to: 'b', from: 'a' },
            { kind: 'deref', name: 'a' }] }
  };
