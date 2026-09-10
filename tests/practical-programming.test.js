'use strict';
/**
 * Practical Experiences of Programming — Topic 1, C++.
 *
 * This module is checked differently from the others, because for once the
 * reference implementation is available: g++ is a real C++ compiler, and the
 * questions this topic asks — does it compile, what does it print — are
 * exactly the questions a compiler answers.
 *
 * So the tracer is not tested against my expectations of C++. It is tested
 * against C++. cppToSource() emits the same program as real code, g++ builds
 * and runs it, and the two answers are compared. Where they disagree, the
 * tracer is wrong.
 *
 * If no compiler is present the differential tests SKIP — and say so loudly,
 * counting as a reported skip rather than a silent pass. A check that
 * quietly returns "cannot tell" is a check that always passes.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadModule, Suite, checkStructure, checkQuestionBank } = require('./lib/harness');

const HAVE_GPP = spawnSync('g++', ['--version'], { encoding: 'utf8' }).status === 0;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-'));

/* Running a child process safely here takes more care than it looks.
   spawnSync's `timeout` sends SIGTERM by default and then waits for the child
   to exit; and even once the child is gone, it goes on waiting for the stdout
   pipe to close, which a surviving grandchild (g++ forks cc1plus and as) can
   hold open indefinitely. Because spawnSync blocks the event loop, the suite
   then hangs with no output and cannot even be interrupted -- SIGTERM to the
   test runner is never handled.

   So: kill with SIGKILL, which cannot be ignored, and give the child real
   files for stdout and stderr rather than pipes, so there is nothing left to
   wait on. Reading the files afterwards gives the same output. A stuck child
   now costs its timeout and is reported, which is what a test run is for. */
function runSync(cmd, args, ms, extraEnv) {
  const o = path.join(TMP, 'out'), e = path.join(TMP, 'err');
  const fo = fs.openSync(o, 'w'), fe = fs.openSync(e, 'w');
  let r;
  try {
    r = spawnSync(cmd, args, {
      stdio: ['ignore', fo, fe],
      timeout: ms,
      killSignal: 'SIGKILL',
      env: extraEnv ? Object.assign({}, process.env, extraEnv) : process.env
    });
  } finally {
    fs.closeSync(fo);
    fs.closeSync(fe);
  }
  return {
    status: r.status,
    signal: r.signal,
    stdout: fs.readFileSync(o, 'utf8'),
    stderr: fs.readFileSync(e, 'utf8')
  };
}

/** Compile and run a C++ program. Returns { compiles, out }. */
function cxx(source) {
  const src = path.join(TMP, 'p.cc');
  const bin = path.join(TMP, 'p');
  fs.writeFileSync(src, source);
  const c = runSync('g++', ['-std=c++11', '-o', bin, src], 30000);
  if (c.status !== 0) {
    const line = (c.stderr || '').split('\n').find(l => /error:/.test(l)) || '';
    return { compiles: false, error: line.trim() };
  }
  const r = runSync(bin, [], 10000);
  return { compiles: true, out: (r.stdout || '').trim().split('\n').filter(Boolean) };
}

/** Compile with AddressSanitizer, run, and report leaks and crashes. */
function asan(source) {
  const src = path.join(TMP, 'a.cc');
  const bin = path.join(TMP, 'a');
  fs.writeFileSync(src, source);
  const c = runSync('g++', ['-std=c++11', '-g', '-fsanitize=address', '-o', bin, src], 60000);
  if (c.status !== 0) return { compiles: false };
  const r = runSync(bin, [], 20000, {
    /* Deterministic reports rather than whatever the environment asks for. */
    ASAN_OPTIONS: 'detect_leaks=1:abort_on_error=0:exitcode=1',
    LSAN_OPTIONS: 'report_objects=0'
  });
  /* Killed rather than exited: the sanitizer deadlocked, which tells us
     nothing about the program. Report it as such instead of reading its
     empty output as "no leak, no abort". */
  if (r.signal === 'SIGKILL') return { compiles: true, out: [], leaked: 0, aborted: false,
                                       stalled: true };
  const err = r.stderr || '';
  const m = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked/.exec(err);
  const leaked = m ? +m[1] : 0;
  /* This aarch64 build reports a double free as a SEGV inside its own
     allocator rather than by name, so any AddressSanitizer error that is
     not a leak report counts as an abort. */
  const aborted = /ERROR: AddressSanitizer/.test(err) && leaked === 0;
  return { compiles: true, out: (r.stdout || '').trim().split('\n').filter(Boolean),
           leaked, aborted };
}

/* Scala's Int IS the JVM's int, and Scala has no compiler here, so the
   arithmetic is checked against the next best thing: a real JVM. Java 11
   runs a single source file directly, no javac needed. Each expression
   is printed on its own line, and anything that throws prints the
   exception's name, so both answers are comparable. */
const HAVE_JAVA = spawnSync('java', ['--version'], { encoding: 'utf8' }).status === 0;

function javaEval(exprs) {
  const body = exprs.map(e =>
    '    try { System.out.println(' + e + '); } ' +
    'catch (Exception ex) { System.out.println("THROWS " + ex.getClass().getSimpleName()); }'
  ).join('\n');
  const src = 'public class P {\n  public static void main(String[] a) {\n' + body + '\n  }\n}\n';
  const f = path.join(TMP, 'P.java');
  fs.writeFileSync(f, src);
  const r = runSync('java', [f], 90000);
  if (r.status !== 0) return { ok: false, error: (r.stderr || '').split('\n')[0] };
  return { ok: true, out: r.stdout.trim().split('\n') };
}

function ri(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

module.exports = async function run() {
  const s = new Suite('practical-programming');
  const m = await loadModule('practical-programming.html');
  const w = m.window;

  await checkStructure(s, m);

  s.ok('a C++ compiler is available for the differential tests', HAVE_GPP,
    HAVE_GPP ? null : 'g++ not found — the differential tests below are SKIPPED, so the tracer is ' +
      'unverified in this run. Install g++ to check it against a real compiler.');

  /* ---------------- the tracer, against a real compiler ---------------- */
  {
    /* The presets first: these are the standard own examples, so if any of
       them disagrees with g++ the notes are teaching something false. */
    Object.keys(w.CPP_PRESETS).forEach(k => {
      const prog = w.cppParse(w.CPP_PRESETS[k]);
      s.ok(`the "${k}" preset parses`, prog.ok, prog.error);
      if (!prog.ok) return;
      const run = w.cppRun(prog);
      s.ok(`and traces`, run.ok, run.error);
      if (!HAVE_GPP || !run.ok) return;
      const real = cxx(w.cppToSource(prog).source);
      s.is(`"${k}": tracer and g++ agree on whether it compiles`,
        run.compiles, real.compiles, real.error);
      if (run.compiles && real.compiles) {
        s.same(`"${k}": and on what it prints`, run.out, real.out);
      }
    });
  }

  /* ---------------- generated programs ----------------

     Built so that copies and references DIVERGE — otherwise a tracer that
     treated every binding as a reference would pass, and the test would be
     measuring nothing. The strawman check below makes that explicit.
  */
  if (HAVE_GPP) {
    let checked = 0, disagree = 0, nonUniform = 0, strawmanCaught = 0, first = null;

    for (let t = 0; t < 60; t++) {
      const lines = [`Coordinate a(${ri(-9, 9)}, 0);`];
      const live = [{ n: 'a', con: false }];
      const names = ['b', 'c', 'd'];

      for (let i = 0; i < ri(2, 3); i++) {
        const from = pick(live);
        const nm = names[i];
        const kind = Math.random();
        if (kind < 0.4) {
          lines.push(`Coordinate ${nm} = ${from.n};`);
          live.push({ n: nm, con: false });
        } else if (kind < 0.75 && !from.con) {
          lines.push(`Coordinate & ${nm} = ${from.n};`);
          live.push({ n: nm, con: false });
        } else {
          lines.push(`const Coordinate & ${nm} = ${from.n};`);
          live.push({ n: nm, con: true });
        }
        const writable = live.filter(v => !v.con);
        if (writable.length) lines.push(`${pick(writable).n}.setX(${ri(-20, 20)});`);
      }
      live.forEach(v => lines.push(`print ${v.n}.getX();`));
      const text = lines.join('\n');

      const prog = w.cppParse(text);
      if (!prog.ok) { disagree++; if (!first) first = 'parse: ' + prog.error; continue; }
      const run = w.cppRun(prog);
      const real = cxx(w.cppToSource(prog).source);
      checked++;

      const agree = run.compiles === real.compiles &&
        (!run.compiles || JSON.stringify(run.out) === JSON.stringify(real.out));
      if (!agree) {
        disagree++;
        if (!first) {
          first = `${text}\n   tracer: ${run.compiles} ${JSON.stringify(run.out)}\n` +
                  `   g++   : ${real.compiles} ${JSON.stringify(real.out || [])}`;
        }
      }
      if (real.compiles && new Set(real.out).size > 1) nonUniform++;

      /* Would a tracer that treated every binding as a reference — i.e. one
         that had missed the entire point of the week — get a different
         answer? If not, this program proves nothing. */
      if (real.compiles) {
        const straw = text.replace(/^Coordinate (\w) = (\w);$/gm, 'Coordinate & $1 = $2;');
        if (straw !== text) {
          const sp = w.cppParse(straw);
          const sr = sp.ok ? w.cppRun(sp) : null;
          if (sr && sr.compiles && JSON.stringify(sr.out) !== JSON.stringify(real.out)) {
            strawmanCaught++;
          }
        }
      }
    }

    /* The declarations above never call a function, so they never exercise
       parameter passing — which is where the copy /
       reference distinction actually bites in practice. Generate those too. */
    let callChecked = 0, callDisagree = 0, callFirst = null, callDiverged = 0;
    for (let t = 0; t < 40; t++) {
      const form = pick(['', '& ', 'const & ']);
      const start = ri(-9, 9);
      const set = ri(-20, 20);
      const decl = form === 'const & '
        ? 'void touch(const Coordinate & in) {\n  print in.getX();\n}'
        : `void touch(Coordinate ${form}in) {\n  in.setX(${set});\n  print in.getX();\n}`;
      const text = `${decl}\nCoordinate a(${start}, 0);\ntouch(a);\nprint a.getX();`;

      const prog = w.cppParse(text);
      if (!prog.ok) { callDisagree++; if (!callFirst) callFirst = 'parse: ' + prog.error; continue; }
      const run = w.cppRun(prog);
      const real = cxx(w.cppToSource(prog).source);
      callChecked++;
      const agree = run.compiles === real.compiles &&
        (!run.compiles || JSON.stringify(run.out) === JSON.stringify(real.out));
      if (!agree) {
        callDisagree++;
        if (!callFirst) {
          callFirst = `${text}\n   tracer: ${run.compiles} ${JSON.stringify(run.out)}\n` +
                      `   g++   : ${real.compiles} ${JSON.stringify(real.out || [])}`;
        }
      }
      /* By value, the caller's object is unchanged, so the two printed values
         differ. By reference they match. If nothing ever diverges, the test
         is not distinguishing the two forms at all. */
      if (real.compiles && real.out.length === 2 && real.out[0] !== real.out[1]) callDiverged++;
    }
    s.ok('function-call programs were generated too', callChecked >= 30, `${callChecked}`);
    s.is('and the tracer agrees with g++ on those as well', callDisagree, 0, callFirst);
    s.ok('with by-value calls visibly leaving the caller’s object alone',
      callDiverged > 5, `${callDiverged} of ${callChecked} printed two different values`);

    s.ok('a decent number of programs was generated', checked >= 50, `${checked}`);
    s.is('the tracer agrees with g++ on every one', disagree, 0, first);
    s.ok('and most of them print more than one distinct value',
      nonUniform > checked * 0.4, `${nonUniform} of ${checked}`);
    s.ok('so the set discriminates: an "everything is a reference" tracer would fail many',
      strawmanCaught > checked * 0.2, `${strawmanCaught} of ${checked} would catch it`);
  }

  /* ---------------- the usual own claims ---------------- */
  if (HAVE_GPP) {
    const COORD = [
      '#include <iostream>', '#include <vector>', '#include <string>',
      'using std::cout; using std::endl; using std::ostream;',
      'class Coordinate {', 'protected:', '  int x; int y;', 'public:',
      '  Coordinate(int a, int b) : x(a), y(b) { }',
      '  int getX() const { return x; }', '  int getY() const { return y; }',
      '  void setX(int v) { x = v; }', '};'
    ].join('\n');

    const JOURNEY = COORD + '\n' + [
      'class Journey { private: Coordinate start; Coordinate end;',
      'public: Journey(Coordinate s, Coordinate e) : start(s), end(e) { }',
      '  Coordinate & getStart() { return start; } };'
    ].join('\n');

    // the default constructor
    s.is('"Coordinate b;" does not compile without a default constructor',
      cxx(COORD + '\nint main(){ Coordinate a(4,2); Coordinate b; }').compiles, false);
    s.is('nor does vector<Coordinate> coords(2)',
      cxx(COORD + '\nint main(){ std::vector<Coordinate> c(2); }').compiles, false);
    s.is('but push_back needs no default constructor',
      cxx(COORD + '\nint main(){ std::vector<Coordinate> c; c.push_back(Coordinate(4,-2));' +
        ' cout << c.size() << endl; }').out.join(''), '1');

    // the Journey
    s.is('assigning in the constructor body does not compile',
      cxx(COORD + '\nclass J { Coordinate s; public: J(Coordinate a){ s = a; } };' +
        '\nint main(){ J j(Coordinate(1,1)); }').compiles, false);
    s.is('the initialiser list does',
      cxx(COORD + '\nclass J { Coordinate s; public: J(Coordinate a) : s(a) { } };' +
        '\nint main(){ J j(Coordinate(1,1)); }').compiles, true);

    // return by reference versus by value
    s.same('a reference to getStart() modifies the Journey',
      cxx(JOURNEY + '\nint main(){ Journey j(Coordinate(1,1), Coordinate(10,3));' +
        ' Coordinate & a = j.getStart(); a.setX(0); cout << j.getStart().getX() << endl; }').out,
      ['0']);
    s.same('a copy of it does not',
      cxx(JOURNEY + '\nint main(){ Journey j(Coordinate(1,1), Coordinate(10,3));' +
        ' Coordinate a = j.getStart(); a.setX(0); cout << j.getStart().getX() << endl; }').out,
      ['1']);

    // const is contagious
    const NOCONST = COORD.replace('int getX() const', 'int getX()');
    s.is('a non-const getter cannot be called through a const reference',
      cxx(NOCONST + '\nvoid p(const Coordinate & in){ cout << in.getX() << endl; }' +
        '\nint main(){ Coordinate a(4,2); p(a); }').compiles, false);
    s.is('marking it const fixes that',
      cxx(COORD + '\nvoid p(const Coordinate & in){ cout << in.getX() << endl; }' +
        '\nint main(){ Coordinate a(4,2); p(a); }').out.join(''), '4');

    // the four-way quiz, one of which fails
    const CJ = COORD + '\n' + [
      'class Journey { private: Coordinate start;',
      'public: Journey(Coordinate s) : start(s) { }',
      '  const Coordinate & getStart() { return start; } };'
    ].join('\n');
    const four = [
      ['[i]   Coordinate a = j.getStart();', 'Coordinate a = j.getStart();', true],
      ['[ii]  Coordinate & b = j.getStart();', 'Coordinate & b = j.getStart();', false],
      ['[iii] const Coordinate & c = j.getStart();', 'const Coordinate & c = j.getStart();', true],
      ['[iv]  const Coordinate d = j.getStart();', 'const Coordinate d = j.getStart();', true]
    ];
    four.forEach(([label, line, want]) => {
      s.is(`binding ${label}`,
        cxx(CJ + `\nint main(){ Journey j(Coordinate(1,1)); ${line} (void)0; }`).compiles, want);
    });

    // operator<<
    s.is('a void operator<< breaks the chain',
      cxx(COORD + '\nvoid operator<<(ostream & o, const Coordinate & r){ o << r.getX(); }' +
        '\nint main(){ Coordinate a(4,2); cout << a << endl; }').compiles, false);
    s.same('returning ostream & fixes it',
      cxx(COORD + '\nostream & operator<<(ostream & o, const Coordinate & r){' +
        ' o << r.getX() << "," << r.getY(); return o; }' +
        '\nint main(){ Coordinate a(-4,2); cout << "It is at " << a << endl; }').out,
      ['It is at -4,2']);

    // string equality
    s.same('two equal C++ strings compare equal',
      cxx('#include <iostream>\n#include <string>\nint main(){ std::string a="Dave", b="Dave";' +
        ' if (a==b) std::cout << "Dave is Dave" << std::endl; }').out, ['Dave is Dave']);
  }

  /* ---------------- the rule engines, against g++ ---------------- */
  if (HAVE_GPP) {
    let bad = 0, n = 0, first = null;
    [true, false].forEach(hasDefault => {
      [true, false].forEach(isConst => {
        ['list', 'body'].forEach(style => {
          const opts = { memberHasDefault: hasDefault, memberIsConst: isConst, style };
          const pred = w.miCheck(opts);
          const real = cxx(w.miGenerate(opts).source);
          n++;
          if (pred.compiles !== real.compiles) {
            bad++;
            if (!first) first = `default=${hasDefault} const=${isConst} style=${style}: ` +
              `predicted ${pred.compiles}, g++ ${real.compiles}`;
          }
        });
      });
    });
    s.is(`the initialiser-list engine matches g++ on all ${n} combinations`, bad, 0, first);

    /* The point the notes make: the body version is not illegal, it is
       wasteful — and only impossible when the member cannot be default
       constructed. Both halves checked. */
    s.is('a member WITH a default constructor compiles either way',
      w.miCheck({ memberHasDefault: true, memberIsConst: false, style: 'body' }).compiles, true);
    s.ok('and the notes call that out as wasteful rather than wrong',
      w.miCheck({ memberHasDefault: true, memberIsConst: false, style: 'body' }).wasteful);
    s.is('a member WITHOUT one forces the initialiser list',
      w.miCheck({ memberHasDefault: false, memberIsConst: false, style: 'body' }).compiles, false);
    s.is('and a const member forces it whatever the defaults',
      w.miCheck({ memberHasDefault: true, memberIsConst: true, style: 'body' }).compiles, false);

    const ops = [['eq-member', true], ['eq-free', true], ['eq-none', false],
                 ['shift-void', false], ['shift-ref', true], ['shift-write', true]];
    let obad = 0, ofirst = null;
    ops.forEach(([kind, want]) => {
      const gen = w.opGenerate(kind);
      const real = cxx(gen.source);
      const okc = real.compiles === want;
      const oko = !want || gen.expect === null || real.out.join('') === gen.expect;
      if (!okc || !oko) {
        obad++;
        if (!ofirst) ofirst = `${kind}: compiles ${real.compiles} (want ${want}) ` +
          `out ${JSON.stringify(real.out || [])} (want ${gen.expect})`;
      }
    });
    s.is('every operator case behaves as the engine predicts', obad, 0, ofirst);

    /* A claim specific to C++11: a member
       operator== on the RIGHT-hand type does not resolve a == b. */
    const wrongSide = cxx([
      '#include <iostream>',
      'class Alice { public: int v; Alice(int a):v(a){} };',
      'class Bob { public: int v; Bob(int a):v(a){}',
      '  bool operator==(const Alice & r) const { return v==r.v; } };',
      'int main(){ Alice a(1); Bob b(1); std::cout << (a == b) << std::endl; }'
    ].join('\n'));
    s.is('operator== on the right-hand type does not resolve a == b under C++11',
      wrongSide.compiles, false);
    s.is('and the engine says the same', w.opEqCheck('wrongside').works, false);
    s.is('while the member on the left-hand type does', w.opEqCheck('member').works, true);
    s.is('as does a free function taking both', w.opEqCheck('free').works, true);

    s.ok('operator<< returning ostream & chains', w.opShiftCheck('ostream&').chains);
    s.ok('and returning void does not', w.opShiftCheck('void').chains === false);
  }

  /* ---------------- the tracer's own refusals ---------------- */
  {
    const refuses = [
      ['no default constructor', 'Coordinate a(4,2);\nCoordinate b;'],
      ['modifying through a const reference',
        'Coordinate a(4,2);\nconst Coordinate & c = a;\nc.setX(0);'],
      ['binding a non-const reference to a const name',
        'const Coordinate a = a;\nCoordinate & r = a;']
    ];
    refuses.slice(0, 2).forEach(([label, src]) => {
      const p = w.cppParse(src);
      s.ok(`${label} parses`, p.ok, p.error);
      if (!p.ok) return;
      const r = w.cppRun(p);
      s.ok(`and is refused: ${label}`, r.compiles === false);
      s.ok('with a reason attached', r.errors.length > 0 && r.errors[0].msg.length > 20);
    });

    // an unreadable line is an error, not a silent skip
    s.ok('an unparseable line is reported', w.cppParse('Coordinate a = ;').ok === false);
    s.ok('a missing semicolon is reported', w.cppParse('Coordinate a(1,2)').ok === false);
  }

  /* ---------------- Topic 2 · pointers and ownership ---------------- */
  {
    /* The pointer quiz, decided by star counting and confirmed by g++. */
    const want = { i: true, ii: false, iii: false, iv: true, v: true, vi: true };
    w.PT_QUIZ.forEach(q => {
      const r = w.ptCheck(q.decl, q.expr, w.PT_ENV);
      s.is(`line ${q.tag}: ${q.src}`, r.legal, want[q.tag], r.why);
      if (!HAVE_GPP) return;
      const real = cxx('#include <string>\nusing std::string;\n' +
        'int main(){ string a("Hello"); string * b = new string("Hello");\n  ' +
        q.src.replace(/;$/, '') + '; (void)0; delete b; }');
      s.is(`  ...and g++ agrees`, real.compiles, want[q.tag], real.error);
    });

    /* A depth of 0 is falsy in JavaScript, which once made every
       non-pointer name look undeclared. Both quiz lines that start from a
       plain string are the regression test. */
    s.ok('a plain string is recognised as declared', w.ptTypeOf('a', w.PT_ENV).ok);
    s.is('and has pointer depth 0', w.ptTypeOf('a', w.PT_ENV).depth, 0);
    s.is('&a has depth 1', w.ptTypeOf('&a', w.PT_ENV).depth, 1);
    s.is('*b has depth 0', w.ptTypeOf('*b', w.PT_ENV).depth, 0);
    s.ok('**b is refused', w.ptTypeOf('**b', w.PT_ENV).ok === false);
    s.ok('an unknown name is refused', w.ptTypeOf('zz', w.PT_ENV).ok === false);
  }

  /* The Rule of Three, every combination, against AddressSanitizer. */
  if (HAVE_GPP) {
    let n = 0, bad = 0, skipped = 0, first = null, stalled = 0;
    let sawLeak = 0, sawAbort = 0, sawClean = 0;

    ['copy', 'assign', 'self'].forEach(scenario => {
      ['default', 'deep'].forEach(copy => {
        ['default', 'deep', 'deep-delete', 'deep-delete-guard'].forEach(assign => {
          [false, true].forEach(dtor => {
            if (scenario === 'copy' && assign !== 'default') return;
            const opts = { copy, assign, dtor, scenario };
            const sim = w.rtSimulate(opts);
            const real = asan(w.rtGenerate(opts).source);
            n++;
            if (real.stalled) { stalled++; return; }
            if (!real.compiles) {
              bad++;
              if (!first) first = `${JSON.stringify(opts)} did not compile`;
              return;
            }
            const simLeak = sim.problems.some(p => p.kind === 'leak');
            const simAbort = sim.problems.some(
              p => p.kind === 'double-free' || p.kind === 'use-after-free');

            /* Once the program aborts, LeakSanitizer never runs its
               end-of-process report — so g++ cannot tell us about leaks in
               that case and the comparison is skipped rather than asserted.
               The simulation still reports both, which is more than the
               tool can observe. */
            const leakComparable = !real.aborted;
            if (!leakComparable) skipped++;

            const okLeak = !leakComparable || simLeak === (real.leaked > 0);
            const okAbort = simAbort === real.aborted;
            const expected = w.rtExpectedOutput(sim);
            const okOut = expected === null || real.aborted ||
              JSON.stringify(expected) === JSON.stringify(real.out);

            if (real.aborted) sawAbort++;
            else if (real.leaked > 0) sawLeak++;
            else sawClean++;

            if (!(okLeak && okAbort && okOut)) {
              bad++;
              if (!first) {
                first = `${scenario} copy=${copy} assign=${assign} dtor=${dtor}\n` +
                  `   sim: leak=${simLeak} abort=${simAbort} out=${JSON.stringify(expected)}\n` +
                  `   g++: leak=${real.leaked > 0} abort=${real.aborted} out=${JSON.stringify(real.out || [])}`;
              }
            }
          });
        });
      });
    });

    s.ok('every Rule-of-Three combination was built', n >= 30, `${n}`);
    s.is('and the simulation agrees with AddressSanitizer on all of them', bad, 0, first);
    s.ok('the set contains clean runs', sawClean > 3, `${sawClean}`);
    s.ok('and leaking ones', sawLeak > 3, `${sawLeak}`);
    s.ok('and ones that crash', sawAbort > 3, `${sawAbort}`);
    s.ok('some leak checks were skipped because the program aborted first',
      skipped > 0, `${skipped} — reported, not silently passed`);
    /* A sanitizer deadlock is not a result. Tolerated, but never quietly:
       if most of the run stalled, the block below proved nothing. */
    s.ok('the sanitizer did not stall on more than a couple of programs',
      stalled <= 2, stalled ? `${stalled} of ${n} runs were killed after deadlocking` : null);

    /* The specific findings the notes make. */
    const shallowCopy = w.rtSimulate({ copy: 'default', assign: 'default', dtor: false,
                                       scenario: 'copy' });
    s.same('the compiler\'s copy constructor makes both objects print "ab"',
      w.rtExpectedOutput(shallowCopy), ['ab', 'ab']);
    const deepCopy = w.rtSimulate({ copy: 'deep', assign: 'default', dtor: true,
                                    scenario: 'copy' });
    s.same('a deep one keeps them apart', w.rtExpectedOutput(deepCopy), ['a', 'b']);

    const selfBug = w.rtSimulate({ copy: 'deep', assign: 'deep-delete', dtor: true,
                                   scenario: 'self' });
    s.ok('a = a on the usual final operator= reads freed memory',
      selfBug.problems.some(p => p.kind === 'use-after-free'));
    const guarded = w.rtSimulate({ copy: 'deep', assign: 'deep-delete-guard', dtor: true,
                                   scenario: 'self' });
    s.ok('and the self-assignment guard fixes it', guarded.clean);

    const noDelete = w.rtSimulate({ copy: 'deep', assign: 'deep', dtor: true, scenario: 'assign' });
    s.ok('an assignment that never frees the old string leaks',
      noDelete.problems.some(p => p.kind === 'leak'));

    s.ok('the advice reports a partially-written Rule of Three',
      w.rtAdvice({ copy: 'deep', assign: 'default', dtor: true }).complete === false);
    s.ok('and a complete one',
      w.rtAdvice({ copy: 'deep', assign: 'deep-delete-guard', dtor: true }).complete);
  }

  /* ---------------- Topic 3 · templates, iterators, containers ---------------- */
  {
    /* Type deduction: T appears twice, so both must agree. */
    s.is('two ints deduce T = int', w.tdDeduce(['T', 'T'], ['int', 'int']).deduced.T, 'int');
    s.ok('an int and a double make deduction fail',
      w.tdDeduce(['T', 'T'], ['int', 'double']).fails);
    s.ok('two doubles are fine', w.tdDeduce(['T', 'T'], ['double', 'double']).fails === false);
    s.ok('an argument count mismatch fails', w.tdDeduce(['T', 'T'], ['int']).fails);
    s.ok('one odd argument out of three still fails',
      w.tdDeduce(['T', 'T', 'T'], ['int', 'int', 'double']).fails);
    s.ok('a concrete parameter given the wrong type fails',
      w.tdDeduce(['int', 'T'], ['double', 'int']).fails);
    s.ok('and the same concrete parameter given the right one does not',
      w.tdDeduce(['int', 'T'], ['int', 'string']).fails === false);
    s.is('two parameters deduce independently',
      JSON.stringify(w.tdDeduce(['T', 'U'], ['int', 'double']).deduced), '{"T":"int","U":"double"}');

    /* Range-for element binding — the map-element case is the one that matters. */
    const cases = [
      ['vector<int>', { kind: 'ref', type: 'int' }, true],
      ['vector<int>', { kind: 'constref', type: 'int' }, true],
      ['vector<int>', { kind: 'value', type: 'int' }, true],
      ['vector<int>', { kind: 'autoref' }, true],
      ['set<int>', { kind: 'ref', type: 'int' }, false],
      ['set<int>', { kind: 'constref', type: 'int' }, true],
      ['map<int,string>', { kind: 'ref', type: 'pair<int, string>' }, false],
      ['map<int,string>', { kind: 'value', type: 'pair<int, string>' }, true],
      ['map<int,string>', { kind: 'constref', type: 'pair<const int, string>' }, true],
      ['map<int,string>', { kind: 'autoref' }, true]
    ];
    cases.forEach(([c, decl, want]) => {
      const r = w.rfBind(c, decl);
      s.is(`${c} taken as ${decl.kind}${decl.type ? ' ' + decl.type : ''}`, r.legal, want, r.why);
    });
    s.is('a map element is pair<const int, string>',
      w.rfBind('map<int,string>', { kind: 'autoref' }).elem, 'pair<const int, string>');

    /* Containers: what insert, erase and find do. */
    const li = w.ctRun('list', w.CT_PRESETS.listInsert.ops);
    s.same('insert goes before the iterator', li.items, ['1', '10', '2', '3']);
    s.is('and returns an iterator to the new element', li.items[li.iters.newItr], '10');
    s.is('while the original iterator still points at what it did',
      li.items[li.iters.itr], '2');
    const le = w.ctRun('list', w.CT_PRESETS.listErase.ops);
    s.same('erase removes what the iterator pointed at', le.items, ['1', '3']);
    s.is('and returns an iterator to what is now in that place',
      le.items[le.iters.newItr], '3');
    const mf = w.ctRun('map', w.CT_PRESETS.mapFind.ops);
    s.is('find returns an iterator to the element it found',
      mf.items[mf.iters.itr], '1194384→"Andrew"');
    s.is('and end() when there is no such key', mf.iters.miss, mf.items.length);
    s.is('dereferencing that is the error worth warning about', mf.errors.length, 1);
    s.ok('and a list cannot jump two places',
      w.ctRun('list', w.CT_PRESETS.listJump.ops).errors.length > 0);
    s.is('but a vector can',
      w.ctRun('vector', w.CT_PRESETS.vectorJump.ops).errors.length, 0);
    s.ok('dereferencing end() is refused',
      w.ctRun('vector', w.CT_PRESETS.endDeref.ops).errors.length > 0);
    const me = w.ctRun('map', w.CT_PRESETS.mapEmplace.ops);
    s.same('emplace on an existing key changes nothing',
      me.items, ['1194384→"Andrew"', '1234567→"Someone"']);
    const ma = w.ctRun('map', w.CT_PRESETS.mapAssign.ops);
    s.same('but operator[] overwrites', ma.items, ['1194384→"Andrew Coles"']);
    const so = w.ctRun('set', w.CT_PRESETS.setOrder.ops);
    s.same('a set sorts and de-duplicates', so.items, ['2', '7', '9']);
  }

  /* Every one of those, put to g++. */
  if (HAVE_GPP) {
    const H = ['#include <iostream>', '#include <string>', '#include <vector>', '#include <list>',
               '#include <set>', '#include <map>', '#include <tuple>', '#include <utility>',
               'using namespace std;'].join('\n') + '\n';

    /* The two errors in the usual write-up. */
    s.is('ans.get<0>() does not compile',
      cxx(H + 'int main(){ tuple<int,int,bool> a(3,7,true); cout << a.get<0>() << endl; }').compiles,
      false);
    s.same('std::get<0>(ans) is the accessor',
      cxx(H + 'int main(){ tuple<int,int,bool> a(3,7,true);\n' +
        ' cout << get<0>(a) << "," << get<1>(a) << "," << get<2>(a) << endl; }').out, ['3,7,1']);

    const MAP = 'int main(){ map<int,string> m; m[1]="a"; m[2]="b";\n';
    s.is('pair<int,string> & does not bind to a map element',
      cxx(H + MAP + ' for (pair<int,string> & e : m) cout << e.first; }').compiles, false);
    s.same('auto & does', cxx(H + MAP + ' for (auto & e : m) cout << e.first; cout << endl; }').out,
      ['12']);
    s.same('and so does a copy',
      cxx(H + MAP + ' for (pair<int,string> e : m) cout << e.first; cout << endl; }').out, ['12']);

    /* Deduction. */
    const MAXT = 'template<typename T> const T & mymax(const T & a, const T & b)' +
      '{ return a < b ? b : a; }\n';
    s.is('deduction with two ints compiles',
      cxx(H + MAXT + 'int main(){ int a=3,b=4; cout << mymax(a,b) << endl; }').out.join(''), '4');
    s.is('with an int and a double it does not',
      cxx(H + MAXT + 'int main(){ int a=3; double b=4.5; cout << mymax(a,b) << endl; }').compiles,
      false);
    s.is('unless T is given explicitly',
      cxx(H + MAXT + 'int main(){ int a=3; double b=4.5;' +
        ' cout << mymax<double>(a,b) << endl; }').out.join(''), '4.5');

    /* Element binding, each case compiled. */
    const bind = [
      ['vector<int> c{1,2};', 'int &', true], ['vector<int> c{1,2};', 'const int &', true],
      ['set<int> c{1,2};', 'int &', false], ['set<int> c{1,2};', 'const int &', true],
      ['map<int,string> c; c[1]="a";', 'pair<int, string> &', false],
      ['map<int,string> c; c[1]="a";', 'const pair<const int, string> &', true],
      ['map<int,string> c; c[1]="a";', 'auto &', true]
    ];
    let bad = 0, first = null;
    bind.forEach(([decl, elem, want]) => {
      const r = cxx(H + `int main(){ ${decl} for (${elem} e : c) { (void)e; } }`);
      if (r.compiles !== want) {
        bad++;
        if (!first) first = `${decl} with ${elem}: g++ says ${r.compiles}, expected ${want}`;
      }
    });
    s.is('g++ agrees on every element-binding case', bad, 0, first);

    /* insert / erase / find return values. */
    s.same('the iterator passed to insert still names the same element',
      cxx(H + 'int main(){ list<int> a{1,2,3}; auto i=a.begin(); ++i;' +
        ' auto n=a.insert(i,10); cout << *n << "|" << *i << endl; }').out, ['10|2']);
    s.same('list insert returns the new element and inserts before',
      cxx(H + 'int main(){ list<int> a{1,2,3}; auto i=a.begin(); ++i;' +
        ' auto n=a.insert(i,10); cout << *n << "|"; for(int x:a) cout << x; cout << endl; }').out,
      ['10|11023']);
    s.same('list erase returns what is now there',
      cxx(H + 'int main(){ list<int> a{1,2,3}; auto i=a.begin(); ++i;' +
        ' auto n=a.erase(i); cout << *n << "|"; for(int x:a) cout << x; cout << endl; }').out,
      ['3|13']);
    s.same('find returns end() when absent',
      cxx(H + 'int main(){ set<int> a{1,2,3};' +
        ' cout << (a.find(7)==a.end()) << (a.find(2)==a.end()) << endl; }').out, ['10']);
    s.same('emplace on an existing key changes nothing and reports false',
      cxx(H + 'int main(){ map<int,string> k; k.emplace(1,"Andrew");' +
        ' auto r = k.emplace(1,"Coles");' +
        ' cout << r.second << "|" << r.first->second << "|" << k.size() << endl; }').out,
      ['0|Andrew|1']);
    s.same('operator[] does overwrite',
      cxx(H + 'int main(){ map<int,string> k; k.emplace(1,"Andrew"); k[1]="Coles";' +
        ' cout << k[1] << "|" << k.size() << endl; }').out, ['Coles|1']);
    s.is('a list iterator cannot jump',
      cxx(H + 'int main(){ list<int> a{1,2,3}; auto i = a.begin() + 2; (void)i; }').compiles, false);
    s.is('a vector iterator can',
      cxx(H + 'int main(){ vector<int> a{1,2,3}; auto i = a.begin() + 2;' +
        ' cout << *i << endl; }').out.join(''), '3');

    /* Function objects and a custom map comparator. */
    s.same('a comparator picks range rather than speed',
      cxx(H + 'class Car { double sp, rg; public: Car(double a,double b):sp(a),rg(b){}' +
        ' double getRange() const { return rg; } double getSpeed() const { return sp; }' +
        ' bool operator<(const Car&o) const { return sp < o.sp; } };\n' +
        'struct LTByRange { bool operator()(const Car&a,const Car&b) const' +
        ' { return a.getRange() < b.getRange(); } };\n' +
        'template<typename T,typename C> const T & mymax(const T&a,const T&b,C c)' +
        ' { return c(a,b) ? b : a; }\n' +
        'int main(){ Car a(120,300), b(100,400);' +
        ' cout << mymax(a,b,LTByRange()).getRange() << ","' +
        ' << (a<b?b:a).getSpeed() << endl; }').out, ['400,120']);
  }

  /* ---------------- Topic 4 · value categories, overloads, ownership ---------------- */
  {
    /* The engine's own claims first, so a failure says which rule broke
       rather than only that g++ disagreed somewhere. */
    s.is('a variable is an lvalue', w.VC_EXPRS['x'].cat, 'lvalue');
    s.is('a function returning by value gives an rvalue', w.VC_EXPRS['byValue()'].cat, 'rvalue');
    s.is('a function returning a reference gives an lvalue', w.VC_EXPRS['byRef()'].cat, 'lvalue');
    s.is('std::move gives an rvalue', w.VC_EXPRS['std::move(x)'].cat, 'rvalue');
    s.ok('a plain reference refuses a temporary', w.vcBind('byValue()', 'ref').legal === false);
    s.ok('a const reference accepts one', w.vcBind('byValue()', 'constref').legal);
    s.ok('an rvalue reference refuses a variable', w.vcBind('x', 'rvalueref').legal === false);
    s.ok('and accepts std::move of one', w.vcBind('std::move(x)', 'rvalueref').legal);

    s.is('an rvalue prefers the && overload',
      w.ovPick(['constref', 'rvalueref'], 'rvalue').chosen, 'rvalueref');
    s.is('an lvalue prefers the plain reference',
      w.ovPick(['ref', 'constref'], 'lvalue').chosen, 'ref');
    s.is('a const lvalue can only use the const reference',
      w.ovPick(['ref', 'constref', 'rvalueref'], 'constlvalue').chosen, 'constref');
    s.ok('and with only a plain reference declared, it does not compile',
      w.ovPick(['ref'], 'constlvalue').compiles === false);
    s.ok('a temporary does not bind to a plain reference either',
      w.ovPick(['ref'], 'rvalue').compiles === false);
    s.is('without a && overload the const reference takes the temporary, and copies',
      w.ovPick(['constref'], 'rvalue').copies, true);

    const mv = w.upRun(w.UP_PRESETS.move.ops);
    s.same('moving deletes what the target held, then hands the pointer over',
      mv.out, ['deleted 2', 'a is empty', 'deleted 1']);
    s.ok('copying is refused', w.upRun(w.UP_PRESETS.copy.ops).compiles === false);
    s.same('release reports the object as leaked', w.upRun(w.UP_PRESETS.release.ops).leaked, [1]);
    /* And says so by there being no delete, not merely by labelling one.
       A trace that both deleted it and called it leaked would be wrong
       in the more dangerous direction. */
    s.same('and nothing is deleted',
      w.upRun(w.UP_PRESETS.release.ops).out.filter(l => /^deleted/.test(l)), []);
    s.same('while an ordinary scope exit deletes exactly once',
      w.upRun(w.UP_PRESETS.scope.ops).out.filter(l => /^deleted/.test(l)), ['deleted 1']);
    s.same('reset deletes what was held', w.upRun(w.UP_PRESETS.reset.ops).out,
      ['deleted 1', 'deleted 2']);
    s.ok('dereferencing after a move compiles — it is a run-time mistake',
      w.upRun(w.UP_PRESETS.useAfterMove.ops).compiles);
  }

  if (HAVE_GPP) {
    /* Every cell of the binding table, compiled. */
    let bad = 0, n = 0, first = null;
    Object.keys(w.VC_EXPRS).forEach(e => {
      Object.keys(w.VC_BINDINGS).forEach(b => {
        const mine = w.vcBind(e, b).legal;
        const real = cxx(w.vcSource(e, b));
        n++;
        if (mine !== real.compiles) {
          bad++;
          if (!first) first = `${e} bound to ${b}: engine ${mine}, g++ ${real.compiles}` +
            (real.error ? ' :: ' + real.error : '');
        }
      });
    });
    s.is(`g++ agrees on all ${n} expression/binding pairs`, bad, 0, first);
    s.ok('and the table is not all one answer',
      w.vcTable().some(r => r.cells.ref) && w.vcTable().some(r => !r.cells.ref));

    /* Every overload subset against every argument. */
    const subsets = [];
    for (let m2 = 1; m2 < 8; m2++) {
      const set = [];
      if (m2 & 1) set.push('ref');
      if (m2 & 2) set.push('constref');
      if (m2 & 4) set.push('rvalueref');
      subsets.push(set);
    }
    let ovBad = 0, ovN = 0, ovFirst = null;
    subsets.forEach(set => Object.keys(w.OV_ARGS).forEach(a => {
      const mine = w.ovPick(set, a);
      const real = cxx(w.ovSource(set, a));
      ovN++;
      const chosen = real.compiles ? real.out[0] : null;
      if (mine.compiles !== real.compiles || (real.compiles && mine.chosen !== chosen)) {
        ovBad++;
        if (!ovFirst) ovFirst = `[${set.join(', ')}] called with ${a}: engine ` +
          `${mine.compiles ? mine.chosen : 'no compile'}, g++ ${chosen || 'no compile'}`;
      }
    }));
    s.is(`g++ picks the same overload in all ${ovN} cases`, ovBad, 0, ovFirst);

    /* The ownership traces, run for real. Each Res prints when destroyed,
       so the order and count of deletes is observable. */
    Object.keys(w.UP_PRESETS).forEach(k => {
      const ops = w.UP_PRESETS[k].ops;
      const mine = w.upRun(ops);
      const real = cxx(w.upSource(ops));
      s.is(`"${k}": engine and g++ agree on whether it compiles`,
        mine.compiles, real.compiles, real.error);
      /* The use-after-move program is undefined at run time, so its
         output is not something to assert on — only that it built. */
      if (mine.compiles && real.compiles && k !== 'useAfterMove') {
        s.same(`"${k}": and on every delete, in order`, mine.out, real.out);
      }
    });
    s.ok('release really does leak — g++ never prints that delete',
      cxx(w.upSource(w.UP_PRESETS.release.ops)).out.join('|').indexOf('deleted') < 0);
  }

  /* ---------------- Topic 5 · inheritance, layout, casts ---------------- */
  {
    s.is('without virtual, the declared type wins',
      w.dpCall({ isVirtual: false, staticType: 'Coordinate', dynamicType: 'Bikes', how: 'ref' }).runs,
      'Coordinate');
    s.is('with virtual, the object wins',
      w.dpCall({ isVirtual: true, staticType: 'Coordinate', dynamicType: 'Bikes', how: 'ref' }).runs,
      'Bikes');
    s.ok('copying into a base variable slices, virtual or not',
      w.dpCall({ isVirtual: true, staticType: 'Coordinate', dynamicType: 'Bikes',
                 how: 'value' }).sliced);
    s.is('and a sliced object runs the base version',
      w.dpCall({ isVirtual: true, staticType: 'Coordinate', dynamicType: 'Bikes',
                 how: 'value' }).runs, 'Coordinate');
    s.ok('naming a Coordinate through a Bikes reference is refused',
      w.dpCall({ isVirtual: true, staticType: 'Bikes', dynamicType: 'Coordinate',
                 how: 'ref' }).ok === false);

    s.is('two ints', w.lyLayout(w.LY_PRESETS.plain.spec).size, 8);
    s.is('plus one in a derived class', w.lyLayout(w.LY_PRESETS.derived.spec).size, 12);
    s.is('a virtual function adds eight bytes',
      w.lyLayout(w.LY_PRESETS.virtualBase.spec).size, 24);
    s.is('the second base of two starts after the first',
      w.lyLayout(w.LY_PRESETS.multiple.spec).baseOffsets[1].offset, 8);
    s.is('and a vtable in the first base moves it',
      w.lyLayout(w.LY_PRESETS.multipleVirtual.spec).baseOffsets[1].offset, 16);
    s.is('the first base always starts at zero',
      w.lyLayout(w.LY_PRESETS.multiple.spec).baseOffsets[0].offset, 0);

    s.is('finding out whether it is a Bikes needs dynamic_cast',
      w.ctChoose('downUnknown', 'dynamic_cast').right, 'dynamic_cast');
    s.ok('static_cast is the wrong answer there',
      w.ctChoose('downUnknown', 'static_cast').correct === false);
    s.is('going up needs no cast', w.ctChoose('up', 'static_cast').right, 'no cast needed');
    s.is('removing const needs const_cast',
      w.ctChoose('removeConst', 'const_cast').right, 'const_cast');
  }

  if (HAVE_GPP) {
    /* Dispatch: all four ways of reaching the object, both types, both
       with and without virtual. */
    let dpBad = 0, dpN = 0, dpFirst = null, dpVaried = new Set();
    [false, true].forEach(isVirtual =>
      ['Coordinate', 'Bikes'].forEach(staticType =>
        ['Coordinate', 'Bikes'].forEach(dynamicType =>
          ['ref', 'ptr', 'value', 'object'].forEach(how => {
            const opts = { isVirtual, staticType, dynamicType, how };
            const mine = w.dpCall(opts);
            const real = cxx(w.dpSource(opts));
            dpN++;
            if (!mine.ok) {
              if (real.compiles) {
                dpBad++;
                if (!dpFirst) dpFirst = `${JSON.stringify(opts)}: engine refuses, g++ does not`;
              }
              return;
            }
            if (!real.compiles) {
              dpBad++;
              if (!dpFirst) dpFirst = `${JSON.stringify(opts)}: g++ will not build it`;
              return;
            }
            dpVaried.add(real.out[0]);
            if (real.out[0] !== mine.output) {
              dpBad++;
              if (!dpFirst) dpFirst = `${JSON.stringify(opts)}: engine ${mine.output}, ` +
                `g++ ${real.out[0]}`;
            }
          }))));
    s.is(`g++ agrees on all ${dpN} dispatch cases`, dpBad, 0, dpFirst);
    s.is('and the cases do not all give the same answer', dpVaried.size, 2);

    /* Layout: every offset, measured. */
    let lyBad = 0, lyFirst = null;
    Object.keys(w.LY_PRESETS).forEach(k => {
      const spec = w.LY_PRESETS[k].spec;
      const mine = w.lyLayout(spec);
      const real = cxx(w.lySource(spec));
      if (!real.compiles) {
        lyBad++;
        if (!lyFirst) lyFirst = `${k} did not compile: ${real.error}`;
        return;
      }
      const got = {};
      real.out.forEach(line => {
        const bits = line.split('=');
        got[bits[0]] = +bits[1];
      });
      if (got.size !== mine.size) {
        lyBad++;
        if (!lyFirst) lyFirst = `${k}: engine sizeof ${mine.size}, g++ ${got.size}`;
      }
      mine.all.forEach(f => {
        if (f.vptr || f.pad) return;
        if (got[f.name] !== f.offset) {
          lyBad++;
          if (!lyFirst) lyFirst = `${k}: ${f.name} at ${f.offset}, g++ says ${got[f.name]}`;
        }
      });
      mine.baseOffsets.forEach(b => {
        if (!b.name) return;
        if (got['base ' + b.name] !== b.offset) {
          lyBad++;
          if (!lyFirst) lyFirst = `${k}: base ${b.name} at ${b.offset}, ` +
            `g++ says ${got['base ' + b.name]}`;
        }
      });
    });
    s.is('every offset and size matches what g++ produces', lyBad, 0, lyFirst);

    /* Casts: which ones the compiler will even accept. */
    const castCases = [
      ['numeric', 'static_cast', true], ['numeric', 'dynamic_cast', false],
      ['numeric', 'reinterpret_cast', false], ['numeric', 'const_cast', false],
      ['removeConst', 'const_cast', true], ['removeConst', 'static_cast', false],
      ['unrelated', 'static_cast', false], ['unrelated', 'dynamic_cast', false],
      ['unrelated', 'reinterpret_cast', true],
      ['downUnknown', 'dynamic_cast', true], ['downUnknown', 'static_cast', true]
    ];
    let ctBad = 0, ctFirst = null;
    castCases.forEach(([c, k, want]) => {
      const r = cxx(w.ctSource(c, k));
      if (r.compiles !== want) {
        ctBad++;
        if (!ctFirst) ctFirst = `${k} for "${c}": g++ ${r.compiles}, expected ${want}`;
      }
    });
    s.is('the casts compile exactly where the engine says they should', ctBad, 0, ctFirst);
    s.same('and only dynamic_cast reports the failure — static_cast hands back a pointer anyway',
      [cxx(w.ctSource('downUnknown', 'dynamic_cast')).out[0],
       cxx(w.ctSource('downUnknown', 'static_cast')).out[0]], ['1', '0']);

    /* The two claims from the notes that are easiest to get wrong. */
    const H5 = '#include <iostream>\n#include <memory>\n#include <vector>\nusing namespace std;\n' +
      'struct B { int x; B():x(0){} virtual void f(){ cout << "B"; } virtual ~B(){} };\n' +
      'struct D : B { int y; D():y(0){} void f() override { cout << "D"; } };\n';
    s.same('deleting through a base pointer without a virtual destructor skips the derived one',
      cxx('#include <iostream>\nusing namespace std;\n' +
        'struct B { ~B(){ cout << "~B" << endl; } };\n' +
        'struct D : B { ~D(){ cout << "~D" << endl; } };\n' +
        'int main(){ B * p = new D(); delete p; }').out, ['~B']);
    s.same('with a virtual destructor both run, derived first',
      cxx('#include <iostream>\nusing namespace std;\n' +
        'struct B { virtual ~B(){ cout << "~B" << endl; } };\n' +
        'struct D : B { ~D(){ cout << "~D" << endl; } };\n' +
        'int main(){ B * p = new D(); delete p; }').out, ['~D', '~B']);
    s.is('push_back with a raw pointer is refused for a vector of unique_ptr',
      cxx(H5 + 'int main(){ vector<unique_ptr<B> > v; v.push_back(new D()); }').compiles, false);
    s.same('emplace_back is the way in, and dispatch still works',
      cxx(H5 + 'int main(){ vector<unique_ptr<B> > v; v.emplace_back(new D());' +
        ' v[0]->f(); cout << endl; }').out, ['D']);
    s.is('a pure virtual function makes the class impossible to instantiate',
      cxx('struct B { virtual void f() = 0; };\nint main(){ B b; (void)b; }').compiles, false);
    s.is('dynamic_cast needs a vtable',
      cxx('struct B { int x; };\nstruct D : B { int y; };\n' +
        'int main(){ B b; B * p = &b; D * d = dynamic_cast<D*>(p); (void)d; }').compiles, false);
  }

  /* ---------------- Scala 1 · values, types, lists ---------------- */
  {
    /* The evaluator's own claims. Each of these is a thing the notes
       state, so a change to either has to be deliberate. */
    const ev = src => w.scEval(src, {});
    s.is('Int division truncates', ev('(1 + 2) / 2').show, '1');
    s.is('and truncates towards zero, not down', ev('-7 / 2').show, '-3');
    s.is('the remainder takes the left sign', ev('-7 % 2').show, '-1');
    s.is('Int overflow wraps', ev('2147483647 + 1').show, '-2147483648');
    s.ok('Int division by zero throws rather than giving Infinity',
      ev('1 / 0').ok === false && ev('1 / 0').runtime === true);
    s.is('Double division by zero does not', ev('1.0 / 0').show, 'Infinity');
    s.is('BigInt does not overflow',
      ev('BigInt(13) * 12 * 11 * 10 * 9 * 8 * 7 * 6 * 5 * 4 * 3 * 2').show, '6227020800');
    s.is('and the same product in Int does',
      ev('13 * 12 * 11 * 10 * 9 * 8 * 7 * 6 * 5 * 4 * 3 * 2').show, '1932053504');
    s.is("a Char is a number", ev("'a'.toInt").show, '97');
    s.is('cons builds on the front', ev('0 :: List(1, 2, 3, 5)').show, 'List(0, 1, 2, 3, 5)');
    s.is('cons is right-associative', ev('1 :: 2 :: 3 :: Nil').show, 'List(1, 2, 3)');
    s.is('and types it', ev('1 :: 2 :: 3 :: Nil').type, 'List[Int]');
    s.is('a tuple keeps both types', ev('(1 + 1, "two")').type, '(Int, String)');
    s.is('a literal too large for Int is refused outright',
      ev('2147483648').ok, false, 'Scala rejects the literal; only arithmetic wraps');
    s.ok('an empty list has no head',
      ev('Nil.head').ok === false && ev('Nil.head').runtime === true);
    s.is('the average body on a list that does not divide evenly',
      ev('List(1, 2).sum / List(1, 2).length').show, '1');
    s.ok('and on the empty list it divides by zero',
      ev('Nil.sum / Nil.length').ok === false);

    /* Sharing. The invariant holds for any singly linked list: k conses
       allocate exactly k cells, and the list you started from is
       untouched. Checked over every small shape rather than one. */
    let shareBad = 0, shareFirst = null;
    for (let n = 0; n <= 6; n++) {
      for (let k = 1; k <= 4; k++) {
        const steps = [{ kind: 'literal', name: 'a',
                         items: Array.from({ length: n }, (_, i) => i + 1) }];
        let prev = 'a';
        for (let j = 0; j < k; j++) {
          steps.push({ kind: 'cons', name: 'b' + j, value: 100 + j, from: prev });
          prev = 'b' + j;
        }
        const r = w.lsRun(steps);
        const a = r.views.find(v => v.name === 'a');
        if (r.totalCells !== n + k) {
          shareBad++;
          if (!shareFirst) shareFirst = `n=${n} k=${k}: ${r.totalCells} cells, expected ${n + k}`;
        }
        if (a.items.length !== n) {
          shareBad++;
          if (!shareFirst) shareFirst = `n=${n} k=${k}: the original list changed`;
        }
      }
    }
    s.is('k conses allocate exactly k cells and leave the original alone', shareBad, 0, shareFirst);

    const two = w.lsRun(w.LS_PRESETS.twoFromOne.steps);
    s.is('two lists built from one share its cells', two.shared.length, 3);
    s.is('and only five cells exist in total', two.totalCells, 5);
    s.same('both see a correct list',
      two.views.map(v => v.show),
      ['List(1, 2, 3)', 'List(0, 1, 2, 3)', 'List(9, 1, 2, 3)']);
    const cat = w.lsRun(w.LS_PRESETS.concat.steps);
    s.is('::: copies the left list', cat.events[2].allocated, 3);
    s.is('and shares the right one', cat.events[2].shared, 2);
    s.is('while .tail allocates nothing',
      w.lsRun(w.LS_PRESETS.tailIsFree.steps).events[1].allocated, 0);

    /* The refactor, exhaustively over the whole domain. */
    const same = w.rfCompare('imperative', 'functional', 3);
    s.ok('the careful loop and the one-liner agree on every input', same.same,
      same.same ? null : JSON.stringify(same.differences[0]));
    s.ok('and that is a real domain, not three cases', same.checked > 1000, `${same.checked}`);
    s.ok('both answers occur, so the test is not vacuous',
      same.agreeTrue > 50 && same.agreeFalse > 50, `${same.agreeTrue} true, ${same.agreeFalse} false`);
    const diff = w.rfCompare('buggy', 'functional', 3);
    s.ok('the clobbered flag is caught', diff.same === false);
    s.ok('and only ever with a path longer than one',
      diff.differences.every(d => d.path.length > 1),
      'a single-element path hides the bug, which is why it survives testing');
  }

  /* Every numeric claim above, put to a real JVM. */
  s.ok('a JVM is available for the Scala arithmetic checks', HAVE_JAVA,
    HAVE_JAVA ? null : 'java not found — the Int semantics below are UNVERIFIED in this run');

  if (HAVE_JAVA) {
    /* Scala has no compiler here. But Scala's Int is the JVM's int, its
       / and % are the JVM's, and its overflow is the JVM's — so if the
       evaluator agrees with Java on arithmetic it agrees with Scala. */
    const fixed = ['(1 + 2) / 2', '-7 / 2', '-7 % 2', '7 % -2', '2147483647 + 1',
                   '13 * 12 * 11 * 10 * 9 * 8 * 7 * 6 * 5 * 4 * 3 * 2', '1 / 0',
                   '(int)(1.0 / 0)'];
    const askJava = fixed.slice(0, 7);
    const jr = javaEval(askJava);
    s.ok('the JVM ran', jr.ok, jr.error);
    if (jr.ok) {
      let bad = 0, first = null;
      askJava.forEach((e, i) => {
        const mine = w.scEval(e, {});
        const got = mine.ok ? mine.show : (mine.runtime ? 'THROWS ArithmeticException' : 'ERR');
        if (got !== jr.out[i]) {
          bad++;
          if (!first) first = `${e}: engine ${got}, JVM ${jr.out[i]}`;
        }
      });
      s.is('the named cases match the JVM exactly', bad, 0, first);
    }

    /* And a few hundred random ones, so the agreement is not down to a
       lucky choice of example. */
    const gen = depth => {
      if (depth <= 0 || Math.random() < 0.3) {
        return String(ri(0, pick([9, 99, 100000, 2147483647])));
      }
      return '(' + gen(depth - 1) + ' ' + pick(['+', '-', '*', '/', '%']) + ' ' +
        gen(depth - 1) + ')';
    };
    const cases = [];
    for (let t = 0; t < 250; t++) cases.push(gen(3));
    const rr = javaEval(cases);
    if (!rr.ok) {
      s.ok('the random arithmetic batch ran', false, rr.error);
    } else {
      let bad = 0, first = null, threw = 0, wrapped = 0;
      cases.forEach((c, i) => {
        const mine = w.scEval(c, {});
        const got = mine.ok ? mine.show : (mine.runtime ? 'THROWS ArithmeticException' : 'ERR');
        if (/THROWS/.test(rr.out[i])) threw++;
        if (/^-/.test(rr.out[i]) && !/-/.test(c)) wrapped++;
        if (got !== rr.out[i]) {
          bad++;
          if (!first) first = `${c}\n   engine: ${got}\n   JVM   : ${rr.out[i]}`;
        }
      });
      s.is(`all ${cases.length} random Int expressions match the JVM`, bad, 0, first);
      s.ok('some of them divided by zero', threw > 0, `${threw}`);
      s.ok('and some overflowed, so wrapping is actually exercised', wrapped > 0,
        `${wrapped} came out negative from positive inputs`);
    }
  }

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 1200);

  return s;
};
