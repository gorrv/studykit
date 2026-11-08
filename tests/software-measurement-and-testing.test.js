'use strict';
/**
 * Software Measurement and Testing.
 *
 * The first topic is terminology, which is not obviously testable — but its
 * worked example is a real program with a real fault, and that is. The
 * assertions below are about the thing the notes actually claim: that a
 * fault, an error and a failure are three separate events, and that the
 * first two can happen without the third.
 *
 * The specification and the implementation are each written out again here,
 * directly from the notes, so the engine is compared against a second
 * reading of the same source rather than against itself.
 */

const { loadModule, Suite, checkStructure, checkQuestionBank } = require('./lib/harness');

/* The two programs, from the notes, independent of the engine.
   Spec: output 2i³.  Code: i = 2*i; i = pow(i,3);  so (2i)³. */
const specExact = i => 2n * BigInt(i) ** 3n;
const implExact = i => (2n * BigInt(i)) ** 3n;

const wrap32 = v => {
  let x = BigInt(v) & 0xFFFFFFFFn;
  return x >= 0x80000000n ? x - 0x100000000n : x;
};
const specInt32 = i => {
  const v = wrap32(i);
  return wrap32(2n * wrap32(v * v * v));
};
const implInt32 = i => {
  const d = wrap32(2n * wrap32(i));
  return wrap32(d * d * d);
};

module.exports = async function run() {
  const s = new Suite('software-measurement-and-testing');
  const m = await loadModule('software-measurement-and-testing.html');
  const w = m.window;

  await checkStructure(s, m);

  /* ---------------- the notes' own test case ---------------- */

  {
    const t = w.ftTrace(1, 'math');
    s.is('input 1: the specification wants 2', t.expected, '2');
    s.is('  ...and the program prints 8', t.got, '8');
    s.ok('  ...so the test fails, as the notes say', t.failed);

    /* The fault is in the ordering, so the state is already wrong partway. */
    s.ok('the state is wrong before anything is printed',
      t.steps[1].differs || t.steps[2].differs);
  }

  /* ---------------- engine against an independent reading ---------------- */

  {
    let bad = 0, first = null;
    for (let i = -500; i <= 500; i++) {
      if (w.ftSpec(i, 'math').toString() !== specExact(i).toString() ||
          w.ftImpl(i, 'math').toString() !== implExact(i).toString()) {
        bad++;
        if (!first) first = `i=${i}`;
      }
    }
    s.is('engine and an independent transcription agree, exact arithmetic', bad, 0, first);

    let bad32 = 0, first32 = null;
    for (let i = -3000; i <= 3000; i++) {
      if (w.ftSpec(i, 'int32').toString() !== specInt32(i).toString() ||
          w.ftImpl(i, 'int32').toString() !== implInt32(i).toString()) {
        bad32++;
        if (!first32) first32 = `i=${i}`;
      }
    }
    s.is('  ...and in 32-bit arithmetic too', bad32, 0, first32);

    /* The program really does compute 8i³ rather than 2i³. */
    let ratio = 0;
    for (let i = 1; i <= 100; i++) {
      if (implExact(i) === 4n * specExact(i)) ratio++;
    }
    s.is('the implementation computes 8i³, which is four times 2i³', ratio, 100);
  }

  /* ---------------- reachability, infection, propagation ---------------- */

  {
    /* The ordinary case: all three happen. */
    const one = w.ftRip(1, 'math');
    s.ok('i = 1: reached, infected and propagated', one.reached && one.infected && one.propagated);

    /* Reached, but never infected — the two programs agree at zero. */
    const zero = w.ftRip(0, 'math');
    s.ok('i = 0: the fault runs', zero.reached);
    s.ok('  ...but the state never goes wrong', !zero.infected);
    s.ok('  ...so there is no failure', !zero.propagated);

    /* The interesting one: infected but not propagated. This is the case
       that makes the three words worth distinguishing, and it only exists
       because the program's integers are 32 bits wide. */
    const wrapped = w.ftRip(2048, 'int32');
    s.ok('i = 2048 in 32-bit: the fault runs', wrapped.reached);
    s.ok('  ...the state genuinely goes wrong', wrapped.infected);
    s.ok('  ...and yet nothing wrong comes out', !wrapped.propagated,
      `expected ${wrapped.expected}, got ${wrapped.got}`);
    s.is('  ...because both sides overflow to the same value',
      wrapped.expected, wrapped.got);

    /* In exact arithmetic that same input does fail, which is the point. */
    s.ok('the same input fails under exact arithmetic', w.ftRip(2048, 'math').propagated);
  }

  /* ---------------- which inputs hide the fault ---------------- */

  {
    const exact = w.ftSweep(-5000, 5000, 'math');
    s.same('over the integers, only zero hides it', exact.hidden, [0]);
    s.is('  ...so every other input in the range reveals it', exact.revealed, exact.total - 1);

    const wrapped = w.ftSweep(-5000, 5000, 'int32');
    s.same('in 32-bit, the multiples of 2048 hide it',
      wrapped.hidden, [-4096, -2048, 0, 2048, 4096]);

    /* The rule, checked against the measurement rather than asserted. */
    const ruleA = w.ftHiddenRule('math', 20000);
    s.is('the "only zero" rule has no exceptions', ruleA.mismatches, 0);
    s.is('  ...and finds exactly one hidden input', ruleA.hidden, 1);

    const ruleB = w.ftHiddenRule('int32', 20000);
    s.is('the "multiples of 2048" rule has no exceptions', ruleB.mismatches, 0);
    s.is('  ...and finds 19 hidden inputs in ±20,000', ruleB.hidden, 19);

    /* And the reason, derived here: the two differ by 6i³, which vanishes
       mod 2³² exactly when i is divisible by 2^⌈31/3⌉ = 2048. */
    let wrong = 0;
    for (let i = -20000; i <= 20000; i++) {
      const vanishes = wrap32(6n * wrap32(i) ** 3n) === 0n;
      if (vanishes !== (i % 2048 === 0)) wrong++;
    }
    s.is('6i³ vanishes mod 2³² exactly on the multiples of 2048', wrong, 0);
  }

  /* ---------------- the vocabulary the page and questions share ---------------- */

  {
    s.is('three terms are defined', Object.keys(w.FT_TERMS).length, 3);
    ['fault', 'error', 'failure'].forEach(k => {
      s.ok(`${k} has a definition and an instance in the example`,
        w.FT_TERMS[k] && w.FT_TERMS[k].short && w.FT_TERMS[k].inExample);
    });
    s.ok('and the fault is recorded as having two kinds',
      w.FT_TERMS.fault.kinds.length === 2 &&
      w.FT_TERMS.fault.kinds.some(x => x.k === 'omission'));

    s.is('three levels of testing', w.FT_LEVELS.length, 3);
    s.same('named as in the notes', w.FT_LEVELS.map(x => x.level),
      ['Unit', 'Integration', 'System']);

    s.is('two alternatives to testing', w.FT_ALTERNATIVES.length, 2);
    s.ok('each with both an advantage and a drawback',
      w.FT_ALTERNATIVES.every(a => a.pro.length && a.con.length));
  }

  /* ================ Topic 2 ================ */

  /* ---------------- the Pass/Fail columns the notes print ---------------- */

  {
    /* Twenty-two entries across three tables. Reproducing all of them is
       the strongest evidence available that the specification and the
       implementation here are the ones the notes mean. */
    const tables = {
      'weak normal EC': [[1, 20, 1000, 'P'], [0, 32, 1000, 'P'], [1, 38, 1000, 'P'],
                         [0, 42, 1000, 'P'], [1, 48, 1000, 'P'], [0, 52, 1000, 'F']],
      'strong normal EC, part-time': [[0, 20, 1000, 'F'], [0, 32, 1000, 'P'],
                         [0, 38, 1000, 'P'], [0, 42, 1000, 'P'], [0, 48, 1000, 'P'],
                         [0, 52, 1000, 'F']],
      'strong normal EC, full-time': [[1, 20, 1000, 'P'], [1, 32, 1000, 'P'],
                         [1, 38, 1000, 'P'], [1, 42, 1000, 'F'], [1, 48, 1000, 'P'],
                         [1, 52, 1000, 'P']],
      'weak robust EC': [[1, 17, 1000, 'F'], [0, 56, 1000, 'F'], [1, 36, -1, 'F'],
                         [0, 36, 10001, 'F']]
    };
    let rows = 0, bad = 0, first = null;
    Object.keys(tables).forEach(name => {
      tables[name].forEach(([ft, age, sal, want]) => {
        rows++;
        const got = w.fnRun(ft === 1, age, sal).pass ? 'P' : 'F';
        if (got !== want) {
          bad++;
          if (!first) first = `${name}: ft=${ft} age=${age} sal=${sal} want ${want} got ${got}`;
        }
      });
    });
    s.is('every Pass/Fail entry the notes print is reproduced', bad, 0, first);
    s.is('  ...and there were 22 of them', rows, 22);
  }

  /* ---------------- the specification, read a second time ---------------- */

  {
    /* Transcribed again here from the table in the notes, so the engine is
       compared against a second reading rather than against itself. */
    const factor = (ft, age) => {
      if (ft) return age <= 35 ? 75 : age <= 45 ? 55 : 30;
      return age <= 30 ? 70 : age <= 40 ? 50 : age <= 50 ? 35 : null;
    };
    let bad = 0, first = null;
    for (const ft of [true, false]) {
      for (let age = 18; age <= 55; age++) {
        const sp = w.fnSpec(ft, age, 1000);
        const want = factor(ft, age);
        const got = sp.error ? null : sp.factor;
        if (got !== want) { bad++; if (!first) first = `ft=${ft} age=${age}`; }
      }
    }
    s.is('the specification agrees with an independent transcription', bad, 0, first);

    /* Out of range really is rejected. */
    s.ok('age 17 is out of range', w.fnSpec(true, 17, 1000).error);
    s.ok('age 56 is out of range', w.fnSpec(true, 56, 1000).error);
    s.ok('salary -1 is out of range', w.fnSpec(true, 30, -1).error);
    s.ok('salary 10001 is out of range', w.fnSpec(true, 30, 10001).error);
    s.ok('a part-timer of 52 is in range and in no category',
      w.fnSpec(false, 52, 1000).error);
    s.ok('  ...while a full-timer of 52 is fine', !w.fnSpec(true, 52, 1000).error);
  }

  /* ---------------- where the two part company ---------------- */

  {
    const map = w.fnFaultMap(1000);
    s.is('five separate stretches of age go wrong', map.regions.length, 5);

    const describe = map.regions.map(g => `${g.ft ? 'ft' : 'pt'}:${g.from}-${g.to}`);
    s.same('and they are exactly these', describe,
      ['ft:35-35', 'ft:40-45', 'pt:18-30', 'pt:40-40', 'pt:51-55']);

    /* Each of the four mistakes in the code, named and checked. */
    s.ok('age < 35 excludes 35, which the specification includes',
      !w.fnRun(true, 35, 1000).pass && w.fnRun(true, 34, 1000).pass);
    s.ok('the full-time middle band stops at 40 instead of 45',
      !w.fnRun(true, 42, 1000).pass);
    s.ok('part-timers under 30 get 75 where the specification says 70',
      !w.fnRun(false, 25, 1000).pass && w.fnImpl(false, 25, 1000).factor === 75);
    s.ok('and there is no range check at all, so a part-timer of 53 is served',
      !w.fnRun(false, 53, 1000).pass && w.fnImpl(false, 53, 1000).factor === 35);
  }

  /* ---------------- the techniques, generated and scored ---------------- */

  {
    const by = {};
    w.fnCompare().forEach(r => { by[r.id] = r; });

    /* Suite sizes, which the formulas in the notes predict. */
    s.is('weak normal EC generates max|Sx| = 6 test cases', by.ec.tests, 6);

    /* The rule on its own, across class counts where max and sum differ.
       With the mortgage's own counts they do not differ after duplicates
       are removed, so testing only this example would not notice a
       generator that added them up — which a sabotage check duly proved. */
    [[2, 6, 1], [2, 3, 5], [4, 4, 4], [1, 1, 9], [3, 7, 2]].forEach(sizes => {
      s.is(`max|Sx| for classes ${sizes.join(', ')}`,
        w.fnWeakCount(sizes), Math.max(...sizes));
      s.ok(`  ...and it is not the sum`,
        w.fnWeakCount(sizes) <= sizes.reduce((a, b) => a + b, 0));
    });
    s.is('strong normal EC generates ∏|Sx| = 12', by.stnorec.tests, 12);
    s.is('worst case generates 5 × 5 × 2 = 50', by.wc.tests, 50);
    s.is('robust worst case generates 7 × 7 × 2 = 98', by.robwc.tests, 98);

    /* What they find. The notes draw these as bar charts with no numbers. */
    s.is('weak normal EC finds 1 fault', by.ec.faults, 1);
    s.is('  ...which matches the notes\' own table: one F in six rows',
      w.fnEvaluate(w.fnSuite('ec')).failures, 1);
    s.is('strong normal EC finds 3', by.stnorec.faults, 3);

    /* More test cases does not mean more faults, and this example says so
       sharply: robust worst case runs twice as many tests as strong robust
       EC and finds one fault fewer. Boundary values for age are 17, 18, 19,
       36, 54, 55, 56 — none of which lands in 40–45, where one of the faults
       lives. Class midpoints do. */
    s.ok('robust worst case runs about twice as many tests as strong robust EC',
      by.robwc.tests > by.strobec.tests * 1.9);
    s.ok('  ...and still finds fewer faults', by.robwc.faults < by.strobec.faults);
    s.is('  ...98 tests and 7 faults against 48 and 8',
      `${by.robwc.tests}/${by.robwc.faults} vs ${by.strobec.tests}/${by.strobec.faults}`,
      '98/7 vs 48/8');

    /* The one it misses, and why. */
    const wcSigs = new Set(w.fnEvaluate(w.fnSuite('robwc')).signatures);
    const ecSigs = new Set(w.fnEvaluate(w.fnSuite('strobec')).signatures);
    const missed = [...ecSigs].filter(x => !wcSigs.has(x));
    s.same('the fault boundary values cannot reach is the one in the middle of a class',
      missed, ['full-time, middle → ×30']);
    s.ok('  ...because no boundary value for age falls in 40–45',
      !w.FN_CLASSES.age.bv.concat([w.FN_CLASSES.age.below, w.FN_CLASSES.age.above])
        .some(v => v >= 40 && v <= 45));

    /* Boundary value testing finds nothing here, which is the point. */
    s.is('boundary value testing finds none at all', by.bv.faults, 0);
    s.is('  ...despite running 10 test cases', by.bv.tests, 10);

    /* Every technique is a subset-of relation in the notes' hierarchy, so
       more tests should never mean fewer faults for the robust pairs. */
    s.ok('robust BV finds at least what BV finds', by.robv.faults >= by.bv.faults);
    s.ok('robust WC finds at least what WC finds', by.robwc.faults >= by.wc.faults);
    s.ok('weak robust EC finds at least what weak normal finds',
      by.wkrobec.faults >= by.ec.faults);
    s.ok('strong robust EC finds at least what strong normal finds',
      by.strobec.faults >= by.stnorec.faults);
  }

  /* ---------------- the formulas, and where they overcount ---------------- */

  {
    const f = {};
    w.fnFormulas().forEach(x => { f[x.id] = x; });

    s.ok('max|Sx| matches the suite built', f.ec.agrees);
    s.is('  ...at 6', f.ec.says, 6);
    s.ok('∏|Sx| matches the suite built', f.stnorec.agrees);
    s.is('  ...at 12', f.stnorec.says, 12);

    /* And the two that do not, because full-time is a boolean with no
       value just outside it. */
    s.ok('max|Sx| + 2n overcounts', !f.wkrobec.agrees);
    s.is('  ...saying 12 where 10 exist', `${f.wkrobec.says}/${f.wkrobec.built}`, '12/10');
    s.ok('∏(|Sx| + 2) overcounts', !f.strobec.agrees);
    s.is('  ...saying 96 where 48 exist', `${f.strobec.says}/${f.strobec.built}`, '96/48');
  }

  /* ---------------- boundary values depend on the nominal choice ---------------- */

  {
    const sweep = w.fnNominalSweep();
    const faults = sweep.map(r => r.faults);
    s.is('eight different nominal choices were tried', sweep.length, 8);
    s.is('the worst finds nothing', Math.min(...faults), 0);
    s.ok('and the best finds several', Math.max(...faults) >= 3);
    s.ok('so the technique is not stable under a choice it never asks you to justify',
      Math.max(...faults) > Math.min(...faults));
  }

  /* ---------------- the token puzzle ---------------- */

  {
    let bad = 0, notMinimal = 0;
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const p = w.fnPuzzle(a, b);
        if (!p.valid || p.tokens !== Math.max(a, b)) bad++;
        const min = w.fnPuzzleMinimal(a, b);
        if (min.ok && !min.agrees) notMinimal++;
      }
    }
    s.is('max(m,n) tokens cover every row and column, for every grid up to 6×6', bad, 0);
    s.is('and an exhaustive search finds nothing smaller works', notMinimal, 0);

    /* The connection to the formula the puzzle explains. */
    s.is('which is why weak normal EC costs max|Sx|',
      w.fnPuzzle(2, 6).tokens, w.fnSuite('ec').length);
  }

  /* ---------------- decision table completeness ---------------- */

  {
    const full = w.dtCount(w.DT_EXAMPLE.rules, [2, 2, 2]);
    s.ok('the table from the notes is complete', full.complete);
    s.is('  ...covering 8 combinations with 4 rules', `${full.covered}/${full.rules}`, '8/4');
    s.is('  ...because 2³ = 8 are required', full.required, 8);

    const short = w.dtCount(w.DT_EXAMPLE.rules.slice(0, 3), [2, 2, 2]);
    s.ok('dropping a rule makes it incomplete', !short.complete);
    s.is('  ...by exactly one combination', short.missing, 1);

    /* A don't care really does count for two. */
    const specific = w.dtCount([['F', 'T', 'T'], ['T', 'F', '-'], ['T', 'T', 'F'],
                                ['T', 'T', 'T']], [2, 2, 2]);
    s.ok('making a don\'t care specific loses coverage', !specific.complete);

    /* Non-binary conditions use the product of the arities. */
    s.is('three conditions of arity 2, 3 and 2 need 12 rules',
      w.dtCount([], [2, 3, 2]).required, 12);
  }

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 1200);

  return s;
};
