  /* ============================================================
     TOPIC 01 · a value-and-reference tracer for a C++ subset
     ------------------------------------------------------------
     Topic 1's real subject is object identity: when does a line
     make a NEW object, and when does it just give an existing one
     another name? Java answers that uniformly (everything is a
     reference); C++ does not, and the difference is where the
     week's bugs live.

     So this is not a syntax highlighter. It keeps a heap of
     objects with identities, an environment of names bound to
     them, and it reports after every statement which names share
     an object. A copy makes a new identity; a reference does not.

     The subset is small and deliberately so:

         Coordinate a(4, -3);        construct
         Coordinate b = a;           copy-construct
         Coordinate & r = a;         bind a reference (an alias)
         const Coordinate & c = a;   bind a read-only reference
         a.setX(8);                  mutate
         print a.getX();             observe
         f(a);                       call a declared function

     with functions declared as

         void f(Coordinate in) { ... }        by value
         void f(Coordinate & in) { ... }      by reference
         void f(const Coordinate & in) { ... } by const reference

     Everything it claims is checkable: cppToSource() emits the
     equivalent real C++, and the test suite compiles that with
     g++ and compares the output line for line. The tracer is only
     worth anything for as long as it keeps agreeing with a real
     compiler.
     ============================================================ */

  var CPP_FIELDS = ['x', 'y'];

  /** A parsed statement, or an error naming the line. */
  function cppParse(text) {
    var lines = String(text || '').split(/\n/);
    var stmts = [], funcs = {}, errors = [];

    // A function definition may span lines; collect it first.
    var joined = [], buf = null, bufLine = 0, depth = 0;
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i].replace(/\/\/.*$/, '').trim();
      if (!raw) { if (!buf) joined.push({ line: i + 1, text: '' }); continue; }
      if (buf === null && /^(void|int)\s+\w+\s*\(/.test(raw)) {
        buf = raw; bufLine = i + 1;
        depth = (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
        if (depth <= 0 && /\}/.test(raw)) { joined.push({ line: bufLine, text: buf }); buf = null; }
        continue;
      }
      if (buf !== null) {
        buf += ' ' + raw;
        depth += (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
        if (depth <= 0) { joined.push({ line: bufLine, text: buf }); buf = null; }
        continue;
      }
      joined.push({ line: i + 1, text: raw });
    }
    if (buf !== null) return { ok: false, error: 'Line ' + bufLine + ': this function is never closed.' };

    for (var k = 0; k < joined.length; k++) {
      var t = joined[k].text, ln = joined[k].line;
      if (!t) continue;

      // void f(Coordinate & in) { body }
      var fn = /^(void|int)\s+(\w+)\s*\(\s*(const\s+)?Coordinate\s*(&?)\s*(\w+)\s*\)\s*\{(.*)\}$/.exec(t);
      if (fn) {
        var body = cppParse(fn[6].split(';').map(function (s) { return s.trim(); })
          .filter(Boolean).join(';\n') + (fn[6].trim() ? ';' : ''));
        if (!body.ok) return { ok: false, error: 'Inside ' + fn[2] + '(): ' + body.error };
        funcs[fn[2]] = {
          name: fn[2], param: fn[5],
          byRef: fn[4] === '&', isConst: !!fn[3],
          body: body.stmts, line: ln
        };
        continue;
      }

      if (!/;$/.test(t)) {
        return { ok: false, error: 'Line ' + ln + ': every statement ends in a semicolon.' };
      }
      var s = t.slice(0, -1).trim();

      var m;
      // const Coordinate & c = a;
      if ((m = /^const\s+Coordinate\s*&\s*(\w+)\s*=\s*(\w+)$/.exec(s))) {
        stmts.push({ kind: 'bindref', name: m[1], from: m[2], isConst: true, line: ln, src: t });
      // Coordinate & r = a;
      } else if ((m = /^Coordinate\s*&\s*(\w+)\s*=\s*(\w+)$/.exec(s))) {
        stmts.push({ kind: 'bindref', name: m[1], from: m[2], isConst: false, line: ln, src: t });
      // const Coordinate d = a;
      } else if ((m = /^const\s+Coordinate\s+(\w+)\s*=\s*(\w+)$/.exec(s))) {
        stmts.push({ kind: 'copy', name: m[1], from: m[2], isConst: true, line: ln, src: t });
      // Coordinate b = a;
      } else if ((m = /^Coordinate\s+(\w+)\s*=\s*(\w+)$/.exec(s))) {
        stmts.push({ kind: 'copy', name: m[1], from: m[2], isConst: false, line: ln, src: t });
      // Coordinate a(4, -3);
      } else if ((m = /^Coordinate\s+(\w+)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/.exec(s))) {
        stmts.push({ kind: 'construct', name: m[1], x: +m[2], y: +m[3], line: ln, src: t });
      // Coordinate a;   -- the classic "this won't compile"
      } else if ((m = /^Coordinate\s+(\w+)$/.exec(s))) {
        stmts.push({ kind: 'default', name: m[1], line: ln, src: t });
      // a.setX(8);
      } else if ((m = /^(\w+)\.set([XY])\s*\(\s*(-?\d+)\s*\)$/.exec(s))) {
        stmts.push({ kind: 'set', name: m[1], field: m[2].toLowerCase(), value: +m[3], line: ln, src: t });
      // print a.getX();
      } else if ((m = /^print\s+(\w+)\.get([XY])\s*\(\s*\)$/.exec(s))) {
        stmts.push({ kind: 'print', name: m[1], field: m[2].toLowerCase(), line: ln, src: t });
      // f(a);
      } else if ((m = /^(\w+)\s*\(\s*(\w+)\s*\)$/.exec(s))) {
        stmts.push({ kind: 'call', fn: m[1], arg: m[2], line: ln, src: t });
      } else {
        return { ok: false, error: 'Line ' + ln + ': cannot read <code>' + esc(t) + '</code>. ' +
          'This tracer understands construction, copying, references, setX/setY, ' +
          '<code>print</code> and calls to functions you declare above.' };
      }
    }
    return { ok: true, stmts: stmts, funcs: funcs, errors: errors };
  }

  /**
     Run it.

     The heap holds objects with identities; the environment maps
     names to an identity plus whether that name is an alias and
     whether it is read-only. A copy allocates; a reference does
     not. That single distinction produces every result below.
  */
  function cppRun(prog, opts) {
    opts = opts || {};
    if (!prog.ok) return prog;

    var heap = [], env = {}, out = [], steps = [], errors = [];
    var scopes = [Object.keys(env)];

    function fresh(x, y, why) {
      heap.push({ id: heap.length + 1, x: x, y: y, born: why, alive: true });
      return heap.length;
    }
    function lookup(name, ln) {
      if (!env[name]) {
        errors.push({ line: ln, msg: '<code>' + esc(name) + '</code> is not declared here.' });
        return null;
      }
      return env[name];
    }

    /** Which names currently denote the same object? */
    function aliasMap() {
      var byId = {};
      Object.keys(env).forEach(function (n) {
        (byId[env[n].id] || (byId[env[n].id] = [])).push(n);
      });
      return byId;
    }

    function snapshot(st, note) {
      steps.push({
        stmt: st, note: note,
        heap: heap.map(function (o) { return { id: o.id, x: o.x, y: o.y, born: o.born }; }),
        env: Object.keys(env).map(function (n) {
          return { name: n, id: env[n].id, isRef: env[n].isRef, isConst: env[n].isConst };
        }),
        aliases: aliasMap(),
        out: out.slice()
      });
    }

    function exec(list, depth) {
      for (var i = 0; i < list.length; i++) {
        var st = list[i];

        if (st.kind === 'construct') {
          env[st.name] = { id: fresh(st.x, st.y, 'constructed'), isRef: false, isConst: false };
          snapshot(st, 'A new object. <code>' + esc(st.name) + '</code> <em>is</em> that object — ' +
            'not a handle to it, which is the whole difference from Java.');

        } else if (st.kind === 'default') {
          errors.push({ line: st.line, msg: '<code>Coordinate ' + esc(st.name) +
            ';</code> needs a <strong>default constructor</strong> — one taking no arguments. ' +
            'Coordinate only has Coordinate(int, int), so there is nothing for this line to call.' });
          snapshot(st, 'Refused: no default constructor.');

        } else if (st.kind === 'copy') {
          var src = lookup(st.from, st.line);
          if (!src) { snapshot(st, 'Refused.'); continue; }
          var o = heap[src.id - 1];
          env[st.name] = { id: fresh(o.x, o.y, 'copied from ' + st.from), isRef: false,
                           isConst: !!st.isConst };
          snapshot(st, 'The <strong>copy constructor</strong> runs: a second object with the same ' +
            'values. Changing one from now on cannot affect the other.');

        } else if (st.kind === 'bindref') {
          var s2 = lookup(st.from, st.line);
          if (!s2) { snapshot(st, 'Refused.'); continue; }
          if (s2.isConst && !st.isConst) {
            errors.push({ line: st.line, msg: 'Cannot bind a non-const <code>Coordinate &amp;</code> ' +
              'to <code>' + esc(st.from) + '</code>, which is read-only. Const is one-way: you may ' +
              'promise not to modify something modifiable, never the reverse.' });
            snapshot(st, 'Refused: that would discard const.');
            continue;
          }
          env[st.name] = { id: s2.id, isRef: true, isConst: !!st.isConst };
          snapshot(st, 'No new object. <code>' + esc(st.name) + '</code> is another name for the ' +
            'same one' + (st.isConst ? ', through which it cannot be modified' : '') + '.');

        } else if (st.kind === 'set') {
          var b = lookup(st.name, st.line);
          if (!b) { snapshot(st, 'Refused.'); continue; }
          if (b.isConst) {
            errors.push({ line: st.line, msg: '<code>' + esc(st.name) + '</code> is const, and ' +
              '<code>set' + st.field.toUpperCase() + '</code> modifies the object. A const object ' +
              'may only be used through methods marked <code>const</code>.' });
            snapshot(st, 'Refused: modifying through a const name.');
            continue;
          }
          heap[b.id - 1][st.field] = st.value;
          var shared = aliasMap()[b.id].filter(function (n) { return n !== st.name; });
          snapshot(st, shared.length
            ? 'Object #' + b.id + ' changes — and <strong>' + shared.join(', ') + '</strong> ' +
              (shared.length === 1 ? 'names' : 'name') + ' that same object, so ' +
              (shared.length === 1 ? 'it sees' : 'they see') + ' the change too.'
            : 'Object #' + b.id + ' changes. No other name refers to it.');

        } else if (st.kind === 'print') {
          var p = lookup(st.name, st.line);
          if (!p) { snapshot(st, 'Refused.'); continue; }
          out.push(String(heap[p.id - 1][st.field]));
          snapshot(st, 'Reads object #' + p.id + '.');

        } else if (st.kind === 'call') {
          var f = prog.funcs[st.fn];
          if (!f) {
            errors.push({ line: st.line, msg: 'No function called <code>' + esc(st.fn) +
              '</code> is declared above.' });
            snapshot(st, 'Refused.');
            continue;
          }
          var arg = lookup(st.arg, st.line);
          if (!arg) { snapshot(st, 'Refused.'); continue; }
          if (f.byRef && !f.isConst && arg.isConst) {
            errors.push({ line: st.line, msg: '<code>' + esc(st.fn) + '</code> takes a non-const ' +
              'reference, but <code>' + esc(st.arg) + '</code> is read-only.' });
            snapshot(st, 'Refused: that would discard const.');
            continue;
          }
          if (depth > 4) { errors.push({ line: st.line, msg: 'Calls nested too deeply.' }); return; }

          var saved = env, param;
          env = Object.create(null);
          Object.keys(saved).forEach(function (n) { env[n] = saved[n]; });

          if (f.byRef) {
            param = { id: arg.id, isRef: true, isConst: f.isConst };
            env[f.param] = param;
            snapshot(st, '<strong>By reference.</strong> The parameter <code>' + esc(f.param) +
              '</code> is an alias for <code>' + esc(st.arg) + '</code> — no copy is made' +
              (f.isConst ? ', and being const it may only look' : '') + '.');
          } else {
            var ao = heap[arg.id - 1];
            param = { id: fresh(ao.x, ao.y, 'copied for ' + f.name + '()'), isRef: false, isConst: false };
            env[f.param] = param;
            snapshot(st, '<strong>By value.</strong> A copy is made for the parameter. Anything ' +
              '<code>' + esc(f.name) + '</code> does to it happens to the copy, and is lost on return.');
          }

          exec(f.body, (depth || 0) + 1);

          // the parameter goes out of scope; a by-value copy dies with it
          if (!f.byRef) heap[param.id - 1].dead = true;
          env = saved;
          snapshot({ kind: 'return', line: st.line, src: 'return from ' + f.name + '()' },
            f.byRef ? 'The alias goes out of scope; the object it named is untouched by that.'
                    : 'The copy goes out of scope and is destroyed. The caller’s object never changed.');
        }
      }
    }

    exec(prog.stmts, 0);

    return {
      ok: true, heap: heap, out: out, steps: steps, errors: errors,
      compiles: errors.length === 0,
      objects: heap.length
    };
  }

  /**
     The same program as real C++, so a compiler can be asked
     whether the tracer is telling the truth.

     Kept deliberately small: two ints and a couple of accessors.
  */
  function cppToSource(prog) {
    if (!prog.ok) return prog;
    var L = [
      '#include <iostream>',
      'using std::cout; using std::endl;',
      'class Coordinate {',
      'protected:',
      '  int x; int y;',
      'public:',
      '  Coordinate(int xIn, int yIn) : x(xIn), y(yIn) { }',
      '  int getX() const { return x; }',
      '  int getY() const { return y; }',
      '  void setX(int v) { x = v; }',
      '  void setY(int v) { y = v; }',
      '};'
    ];

    function emit(st) {
      switch (st.kind) {
        case 'construct': return '  Coordinate ' + st.name + '(' + st.x + ', ' + st.y + ');';
        case 'default':   return '  Coordinate ' + st.name + ';';
        case 'copy':      return '  ' + (st.isConst ? 'const ' : '') + 'Coordinate ' + st.name +
                                 ' = ' + st.from + ';';
        case 'bindref':   return '  ' + (st.isConst ? 'const ' : '') + 'Coordinate & ' + st.name +
                                 ' = ' + st.from + ';';
        case 'set':       return '  ' + st.name + '.set' + st.field.toUpperCase() + '(' + st.value + ');';
        case 'print':     return '  cout << ' + st.name + '.get' + st.field.toUpperCase() + '() << endl;';
        case 'call':      return '  ' + st.fn + '(' + st.arg + ');';
      }
      return '';
    }

    Object.keys(prog.funcs).forEach(function (n) {
      var f = prog.funcs[n];
      L.push('void ' + f.name + '(' + (f.isConst ? 'const ' : '') + 'Coordinate ' +
        (f.byRef ? '& ' : '') + f.param + ') {');
      f.body.forEach(function (st) { L.push('  ' + emit(st)); });
      L.push('}');
    });

    L.push('int main() {');
    prog.stmts.forEach(function (st) { L.push(emit(st)); });
    L.push('  return 0;');
    L.push('}');
    return { ok: true, source: L.join('\n') };
  }

  var CPP_PRESETS = {
    copy:
      '// b is a COPY of a, so changing a leaves b alone.\n' +
      'Coordinate a(4, -3);\n' +
      'Coordinate b = a;\n' +
      'a.setX(8);\n' +
      'print a.getX();\n' +
      'print b.getX();\n',
    reference:
      '// A reference is a second name for the SAME object.\n' +
      'Coordinate a(4, -3);\n' +
      'Coordinate & r = a;\n' +
      'r.setX(8);\n' +
      'print a.getX();\n' +
      'print r.getX();\n',
    byvalue:
      '// the function gets a copy, so main\'s object is untouched.\n' +
      'void moveXToZero(Coordinate in) {\n' +
      '  in.setX(0);\n' +
      '}\n' +
      'Coordinate a(4, -3);\n' +
      'moveXToZero(a);\n' +
      'print a.getX();\n',
    byref:
      '// one ampersand, and the same call now changes a.\n' +
      'void moveXToZero(Coordinate & in) {\n' +
      '  in.setX(0);\n' +
      '}\n' +
      'Coordinate a(4, -3);\n' +
      'moveXToZero(a);\n' +
      'print a.getX();\n',
    constref:
      '// const means look but do not touch — this is refused.\n' +
      'void printX(const Coordinate & in) {\n' +
      '  in.setX(0);\n' +
      '}\n' +
      'Coordinate a(4, -3);\n' +
      'printX(a);\n',
    nodefault:
      '// Coordinate has no constructor taking no arguments.\n' +
      'Coordinate a(4, 2);\n' +
      'Coordinate b;\n'
  };
