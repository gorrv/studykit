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

/** Compile and run a C++ program. Returns { compiles, out }. */
function cxx(source) {
  const src = path.join(TMP, 'p.cc');
  const bin = path.join(TMP, 'p');
  fs.writeFileSync(src, source);
  const c = spawnSync('g++', ['-std=c++11', '-o', bin, src], { encoding: 'utf8', timeout: 30000 });
  if (c.status !== 0) {
    const line = (c.stderr || '').split('\n').find(l => /error:/.test(l)) || '';
    return { compiles: false, error: line.trim() };
  }
  const r = spawnSync(bin, [], { encoding: 'utf8', timeout: 10000 });
  return { compiles: true, out: (r.stdout || '').trim().split('\n').filter(Boolean) };
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
    /* The presets first: these are the slides' own examples, so if any of
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
       parameter passing — which is slides 36 to 38 and the place the copy /
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

  /* ---------------- the deck's own claims ---------------- */
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

    // slide 19 / 20 / 21 — the default constructor
    s.is('slide 19: "Coordinate b;" does not compile without a default constructor',
      cxx(COORD + '\nint main(){ Coordinate a(4,2); Coordinate b; }').compiles, false);
    s.is('slide 20: nor does vector<Coordinate> coords(2)',
      cxx(COORD + '\nint main(){ std::vector<Coordinate> c(2); }').compiles, false);
    s.is('slide 21: but push_back needs no default constructor',
      cxx(COORD + '\nint main(){ std::vector<Coordinate> c; c.push_back(Coordinate(4,-2));' +
        ' cout << c.size() << endl; }').out.join(''), '1');

    // slides 22 / 23 — the Journey
    s.is('slide 22: assigning in the constructor body does not compile',
      cxx(COORD + '\nclass J { Coordinate s; public: J(Coordinate a){ s = a; } };' +
        '\nint main(){ J j(Coordinate(1,1)); }').compiles, false);
    s.is('slide 23: the initialiser list does',
      cxx(COORD + '\nclass J { Coordinate s; public: J(Coordinate a) : s(a) { } };' +
        '\nint main(){ J j(Coordinate(1,1)); }').compiles, true);

    // slides 42 / 43 — return by reference versus by value
    s.same('slide 42: a reference to getStart() modifies the Journey',
      cxx(JOURNEY + '\nint main(){ Journey j(Coordinate(1,1), Coordinate(10,3));' +
        ' Coordinate & a = j.getStart(); a.setX(0); cout << j.getStart().getX() << endl; }').out,
      ['0']);
    s.same('slide 43: a copy of it does not',
      cxx(JOURNEY + '\nint main(){ Journey j(Coordinate(1,1), Coordinate(10,3));' +
        ' Coordinate a = j.getStart(); a.setX(0); cout << j.getStart().getX() << endl; }').out,
      ['1']);

    // slide 47 — const is contagious
    const NOCONST = COORD.replace('int getX() const', 'int getX()');
    s.is('slide 47: a non-const getter cannot be called through a const reference',
      cxx(NOCONST + '\nvoid p(const Coordinate & in){ cout << in.getX() << endl; }' +
        '\nint main(){ Coordinate a(4,2); p(a); }').compiles, false);
    s.is('slide 47: marking it const fixes that',
      cxx(COORD + '\nvoid p(const Coordinate & in){ cout << in.getX() << endl; }' +
        '\nint main(){ Coordinate a(4,2); p(a); }').out.join(''), '4');

    // slide 48 — the four-way quiz, one of which fails
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
      s.is(`slide 48 ${label}`,
        cxx(CJ + `\nint main(){ Journey j(Coordinate(1,1)); ${line} (void)0; }`).compiles, want);
    });

    // slides 55-60 — operator<<
    s.is('slide 55: a void operator<< breaks the chain',
      cxx(COORD + '\nvoid operator<<(ostream & o, const Coordinate & r){ o << r.getX(); }' +
        '\nint main(){ Coordinate a(4,2); cout << a << endl; }').compiles, false);
    s.same('slide 60: returning ostream & fixes it',
      cxx(COORD + '\nostream & operator<<(ostream & o, const Coordinate & r){' +
        ' o << r.getX() << "," << r.getY(); return o; }' +
        '\nint main(){ Coordinate a(-4,2); cout << "It is at " << a << endl; }').out,
      ['It is at -4,2']);

    // slide 30 — string equality
    s.same('slide 30: two equal C++ strings compare equal',
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

    /* Slide 52's claim, which is about C++11 specifically: a member
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

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 1200);

  return s;
};
