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

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 1200);

  return s;
};
