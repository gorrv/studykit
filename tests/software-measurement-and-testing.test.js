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

  /* ================ Topic 3 · structural testing ================

     Two independent readings again. The graphs the notes draw are
     transcribed below as plain edge lists, and the properties of them
     are recomputed here by code that shares nothing with the engine —
     a second DD-path partition, a second prime-path search, and the
     cyclomatic number as the rank of a cycle space rather than as a
     formula. Where the notes print an answer, that answer is the
     assertion.
     ============================================================== */

  /* The running graph, transcribed from the drawing: ten nodes, a
     self-loop at 3, and 7 reaching both 6 and 8. */
  const RUNNING = [[0,1],[1,2],[1,3],[3,3],[2,4],[3,4],[4,5],[4,7],[5,6],[7,6],[7,8],[6,9],[8,9]];

  const succOf = (edges, n) => edges.filter(e => e[0] === n).map(e => e[1]);
  const inOf = (edges, n) => edges.filter(e => e[1] === n).length;
  const outOf = (edges, n) => edges.filter(e => e[0] === n).length;

  /* An independent DD-path partition, written from the definition
     rather than from the engine: group the nodes whose degrees are
     both 1 with the neighbour they are forced to follow. */
  function ddAgain(nodes, edges) {
    const solo = n => inOf(edges, n) !== 1 || outOf(edges, n) !== 1;
    const parent = {};
    nodes.forEach(n => { parent[n] = n; });
    const find = x => { while (parent[x] !== x) x = parent[x]; return x; };
    edges.forEach(([a, b]) => {
      if (a !== b && !solo(a) && !solo(b)) {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent[rb] = ra;
      }
    });
    const groups = {};
    nodes.forEach(n => { (groups[find(n)] = groups[find(n)] || []).push(n); });
    return Object.keys(groups).map(k => groups[k].sort((x, y) => x - y))
                 .sort((a, b) => a[0] - b[0]);
  }

  /* An independent prime-path search. */
  function primeAgain(nodes, edges) {
    const seen = new Set(), all = [];
    const push = p => { const k = p.join(','); if (!seen.has(k)) { seen.add(k); all.push(p.slice()); } };
    const walk = p => {
      push(p);
      for (const q of succOf(edges, p[p.length - 1])) {
        if (q === p[0]) push(p.concat([q]));
        else if (p.indexOf(q) < 0) walk(p.concat([q]));
      }
    };
    nodes.forEach(n => walk([n]));
    const inside = (a, b) => a.length < b.length &&
      b.join(',').split(',').some((_, i) =>
        b.slice(i, i + a.length).join(',') === a.join(','));
    return { simple: all, prime: all.filter(p => !all.some(q => inside(p, q))) };
  }

  /* The cyclomatic number as a rank, over the rationals this time —
     the engine does it over GF(2), and neither uses E − N + 2. */
  function cycleDim(nodes, edges) {
    const idx = {};
    nodes.forEach((n, i) => { idx[n] = i; });
    const rows = edges.map(([a, b]) => {
      const r = new Array(nodes.length).fill(0);
      if (a !== b) { r[idx[a]] += 1; r[idx[b]] -= 1; }
      return r;
    });
    let rank = 0;
    for (let c = 0; c < nodes.length; c++) {
      let piv = -1;
      for (let r = rank; r < rows.length; r++) if (Math.abs(rows[r][c]) > 1e-9) { piv = r; break; }
      if (piv < 0) continue;
      const t = rows[rank]; rows[rank] = rows[piv]; rows[piv] = t;
      for (let r = 0; r < rows.length; r++) {
        if (r === rank || Math.abs(rows[r][c]) < 1e-9) continue;
        const f = rows[r][c] / rows[rank][c];
        for (let k = 0; k < nodes.length; k++) rows[r][k] -= f * rows[rank][k];
      }
      rank++;
    }
    return edges.length - rank;
  }

  /* ---------------- the graphs, as transcribed ---------------- */

  {
    const g = w.SG_GRAPHS['the running graph'];
    s.same('the running graph is the one drawn in the notes', g.edges, RUNNING);
    s.is('  ...ten nodes', g.nodes.length, 10);
    s.is('  ...thirteen edges', g.edges.length, 13);
  }

  /* ---------------- DD-paths ---------------- */

  {
    const g = w.SG_GRAPHS['the DD-path example'];
    const dd = w.sgDDPaths(g);
    s.same('the DD-path example collapses to the six the notes mark',
      dd, [[1], [2], [3, 4], [5], [6, 7], [8]]);
    s.same('  ...and an independent partition agrees', dd, ddAgain(g.nodes, g.edges));

    const dg = w.sgDDGraph(g);
    s.is('its DD-path graph has six nodes', dg.paths.length, 6);
    s.is('  ...and six edges', dg.edges.length, 6);
    const named = dg.edges.map(([a, b]) =>
      dg.paths[a].join('') + '>' + dg.paths[b].join(''));
    s.same('  ...exactly the ones drawn', named.sort(),
      ['1>2', '2>34', '34>5', '5>67', '5>8', '67>2'].sort());

    /* The property the notes state. */
    [g, w.SG_GRAPHS['the running graph'], w.SG_GRAPHS['the prime path example'],
     w.SG_GRAPHS['a branch and a loop']].forEach(gg => {
      const parts = w.sgDDPaths(gg);
      const flat = [].concat.apply([], parts);
      s.is(`each node is in exactly one DD-path (${gg.nodes.length} nodes)`,
        flat.length, gg.nodes.length);
      s.is('  ...with none of them repeated', new Set(flat).size, gg.nodes.length);
      s.same('  ...and the partition matches an independent one',
        parts, ddAgain(gg.nodes, gg.edges));
    });

    /* A chain has to be collected from its head, and the head is not
       always the lowest-numbered node on it. This graph runs 0 → 3 →
       2 → 1 → 4, so walking the chain in node order would split it in
       two; the deck's examples all happen to be numbered along the
       flow, which hides the difference. */
    const crooked = { nodes: [0, 2, 3, 1, 4],
                      edges: [[0, 3], [3, 2], [2, 1], [1, 4]] };
    s.same('a chain numbered against the flow is still one DD-path',
      w.sgDDPaths(crooked), [[0], [3, 2, 1], [4]]);
    s.same('  ...and an independent partition groups the same nodes',
      w.sgDDPaths(crooked).map(p => p.slice().sort((a, b) => a - b)),
      ddAgain(crooked.nodes, crooked.edges));
    s.ok('  ...with the engine keeping them in flow order, not node order',
      w.sgDDPaths(crooked)[1].join(',') === '3,2,1');

    /* The running graph has no chains at all: every node either
       branches, merges, or is an end. */
    s.is('the running graph has as many DD-paths as nodes',
      w.sgDDPaths(w.SG_GRAPHS['the running graph']).length, 10);
  }

  /* ---------------- DD-path coverage vs edge coverage ----------------

     "Equivalent to edge coverage, but requires fewer checks" is the
     claim. Both halves are measured, over random program-shaped
     graphs and complete executions of them. The completeness matters:
     a path that stops in the middle of a chain breaks the equivalence,
     and finding that out is what the search is for.
     ------------------------------------------------------------------ */

  {
    let rng = 20260110;
    const rand = n => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng % n; };

    let checked = 0, disagree = 0, fewer = 0, more = 0, full = 0;
    for (let t = 0; t < 400; t++) {
      const n = 4 + rand(5);
      const nodes = Array.from({ length: n }, (_, i) => i);
      const edges = [];
      for (let i = 0; i + 1 < n; i++) edges.push([i, i + 1]);
      for (let k = 0; k < rand(4); k++) {
        const a = rand(n - 1), b = rand(n - 1);
        if (!edges.some(e => e[0] === a && e[1] === b)) edges.push([a, b]);
      }
      /* self-loops on purpose: they are the shape the equivalence
         nearly broke on */
      if (rand(3) === 0) {
        const a = 1 + rand(n - 2);
        if (!edges.some(e => e[0] === a && e[1] === a)) edges.push([a, a]);
      }
      const g = { nodes, edges };
      if (inOf(edges, 0) !== 0) continue;

      const paths = [];
      for (let k = 0; k <= rand(4); k++) {
        let cur = 0, p = [0], ok = false;
        for (let i = 0; i < 60; i++) {
          const sx = succOf(edges, cur);
          if (!sx.length) { ok = true; break; }
          cur = sx[rand(sx.length)];
          p.push(cur);
        }
        if (ok) paths.push(p);
      }
      if (!paths.length) continue;

      const c = w.sgCoverage(g, paths);
      const edgeFull = c.nodes.hit === c.nodes.of && c.edges.hit === c.edges.of;
      const ddFull = c.ddNodes.hit === c.ddNodes.of && c.ddEdges.hit === c.ddEdges.of;
      checked++;
      if (edgeFull !== ddFull) disagree++;
      if (edgeFull) full++;
      if (c.checks.dd < c.checks.flow) fewer++;
      if (c.checks.dd > c.checks.flow) more++;
    }
    s.ok(`the search ran on ${checked} random graphs`, checked > 200, `only ${checked}`);
    s.ok('  ...with some of them fully covered and some not',
      full > 0 && full < checked, `${full} of ${checked}`);
    s.is('DD-path coverage is full exactly when edge coverage is', disagree, 0);
    s.is('  ...and never needs more checks than the flow graph', more, 0);
    s.ok('  ...usually fewer', fewer > checked / 3, `only ${fewer} of ${checked}`);

    /* A self-loop has both ends in the same DD-path, and the obvious
       way to build the DD-path graph drops it. Then a test set can
       cover the whole DD-path graph without ever taking the loop, and
       DD-path coverage is strictly weaker than edge coverage rather
       than equivalent to it. The random search above found this; it
       is pinned here so it stays found. */
    const selfy = { nodes: [0, 1, 2], edges: [[0, 1], [1, 1], [1, 2]] };
    const sdd = w.sgDDGraph(selfy);
    s.ok('a self-loop survives into the DD-path graph',
      sdd.edges.some(e => e[0] === e[1]), JSON.stringify(sdd.edges));
    const skip = w.sgCoverage(selfy, [[0, 1, 2]]);
    s.is('  ...so a run that skips it leaves an edge uncovered',
      `${skip.edges.hit}/${skip.edges.of}`, '2/3');
    s.is('  ...and the DD-path graph says so too',
      `${skip.ddEdges.hit}/${skip.ddEdges.of}`, '2/3');
    const took = w.sgCoverage(selfy, [[0, 1, 1, 2]]);
    s.is('  ...while a run that takes it covers both', 
      `${took.edges.hit}/${took.edges.of} ${took.ddEdges.hit}/${took.ddEdges.of}`,
      '3/3 3/3');

    /* And the case that breaks it, kept as a live example: a path that
       stops inside a chain covers every DD-path without covering every
       edge. If this ever stops holding, the caveat on the page is
       wrong and should go. */
    const chain = { nodes: [0, 1, 2, 3], edges: [[0, 1], [1, 2], [2, 3], [3, 0]] };
    const cut = w.sgCoverage(chain, [[3, 0]]);
    s.ok('a path that stops inside a chain can cover every DD-path',
      cut.ddNodes.hit === cut.ddNodes.of && cut.ddEdges.hit === cut.ddEdges.of);
    s.ok('  ...while leaving edges of that chain untaken', cut.edges.hit < cut.edges.of);
  }

  /* ---------------- simple and prime paths ---------------- */

  {
    const g = w.SG_GRAPHS['the prime path example'];
    const mine = primeAgain(g.nodes, g.edges);
    s.is('the prime path example has 52 simple paths', w.sgSimplePaths(g).length, 52);
    s.is('  ...which an independent search agrees with', mine.simple.length, 52);
    s.is('  ...and 11 of them are prime', w.sgPrimePaths(g).length, 11);
    s.is('  ...independently too', mine.prime.length, 11);
    s.same('  ...the same eleven',
      w.sgPrimePaths(g).map(p => p.join('')).sort(),
      mine.prime.map(p => p.join('')).sort());

    /* The informal description: a complete route, or one trip round a
       loop. Nothing else should appear. */
    const prime = w.sgPrimePaths(g);
    const loops = prime.filter(p => p[0] === p[p.length - 1]);
    const ends = prime.filter(p => p[0] !== p[p.length - 1]);
    s.is('six of them are closed loops', loops.length, 6);
    s.is('  ...three per cycle, one starting at each node of it', loops.length / 2, 3);
    s.is('  ...and five run from one end of the graph to the other', ends.length, 5);

    /* The property that actually defines them: a prime path cannot be
       extended at either end and still be a simple path. I first
       asserted something stronger and untrue — that every open prime
       path starts where nothing enters — and 4->5->3->1->2 is the
       counterexample: it begins in the middle of a loop and stops in
       the middle of another, and neither end can be extended without
       repeating a node. */
    const isSimple = p => {
      const seen = {};
      for (let i = 0; i < p.length; i++) {
        if (seen[p[i]] && !(i === p.length - 1 && p[i] === p[0])) return false;
        seen[p[i]] = true;
      }
      for (let i = 0; i + 1 < p.length; i++) {
        if (!g.edges.some(e => e[0] === p[i] && e[1] === p[i + 1])) return false;
      }
      return true;
    };
    s.ok('no prime path can be extended at either end',
      prime.every(p =>
        succOf(g.edges, p[p.length - 1]).every(q => !isSimple(p.concat([q]))) &&
        g.edges.filter(e => e[1] === p[0]).map(e => e[0])
          .every(q => !isSimple([q].concat(p)))),
      JSON.stringify(prime.filter(p =>
        succOf(g.edges, p[p.length - 1]).some(q => isSimple(p.concat([q]))))));

    /* A loop contributes one prime path per node on it. */
    const one = w.SG_GRAPHS['one loop'];
    s.is('a single self-loop is a prime path on its own',
      w.sgPrimePaths(one).filter(p => p.length === 2 && p[0] === p[1]).length, 1);

    for (const name of ['the running graph', 'the DD-path example', 'a branch and a loop']) {
      const gg = w.SG_GRAPHS[name];
      s.same(`prime paths of "${name}" survive a second search`,
        w.sgPrimePaths(gg).map(p => p.join(',')).sort(),
        primeAgain(gg.nodes, gg.edges).prime.map(p => p.join(',')).sort());
    }
  }

  /* ---------------- the cyclomatic number ---------------- */

  {
    /* The four answers the notes print for their four small graphs,
       and the one for the running graph. */
    const want = {
      'a straight line': 1,
      'a longer straight line': 1,
      'one loop': 2,
      'a branch and a loop': 3,
      'the running graph': 5
    };
    Object.keys(want).forEach(name => {
      const g = w.SG_GRAPHS[name];
      s.is(`V(G) of "${name}" is ${want[name]}`, w.sgCyclomatic(g), want[name]);
      const closed = w.sgClose(g);
      s.is('  ...and counting independent cycles agrees',
        w.sgCycleRank(closed), want[name]);
      s.is('  ...over the rationals too', cycleDim(closed.nodes, closed.edges), want[name]);
    });

    s.is('size independence: two straight lines of different length score the same',
      w.sgCyclomatic(w.SG_GRAPHS['a straight line']),
      w.sgCyclomatic(w.SG_GRAPHS['a longer straight line']));

    /* Sequential composition. The notes give 9 for two copies and
       4n+1 in general. */
    const G = w.SG_GRAPHS['the running graph'];
    s.is('two copies of the running graph score 9', w.sgCyclomatic(w.sgCompose(G, 2)), 9);
    for (let n = 1; n <= 6; n++) {
      s.is(`  ...and ${n} copies score ${4 * n + 1}`,
        w.sgCyclomatic(w.sgCompose(G, n)), 4 * n + 1);
    }
    /* Which is the general rule V₁ + V₂ − 1, applied n−1 times. */
    for (const name of ['one loop', 'a branch and a loop', 'the prime path example']) {
      const g = w.SG_GRAPHS[name], v = w.sgCyclomatic(g);
      s.is(`"${name}" composed with itself is 2V − 1`,
        w.sgCyclomatic(w.sgCompose(g, 2)), 2 * v - 1);
    }

    /* The risk bands. */
    s.is('V = 10 is still the low band', w.sgRisk(10), 'a simple program, without much risk');
    s.is('V = 11 is not', w.sgRisk(11), 'more complex, moderate risk');
    s.is('V = 51 is untestable', w.sgRisk(51), 'untestable program (very high risk)');
  }

  /* ---------------- the little language ----------------

     The parser, the graph builder and the interpreter are three
     separate pieces of code. The check that matters is that they
     agree: every step the interpreter takes must be an edge the
     builder drew.
     ------------------------------------------------------------- */

  {
    const names = Object.keys(w.PG_PRESETS);
    s.is('there are four example programs', names.length, 4);

    names.forEach(name => {
      const prog = w.pgParse(w.PG_PRESETS[name].src);
      s.ok(`"${name}" parses`, prog.ok, prog.error);
      if (!prog.ok) return;
      const g = w.pgGraph(prog);
      s.ok(`  ...and its graph has one entry`,
        g.nodes.filter(n => w.sgIndeg(g, n) === 0).length === 1);
      s.ok(`  ...and one exit`,
        g.nodes.filter(n => w.sgOutdeg(g, n) === 0).length === 1);
      s.is(`  ...with every node reachable from the entry`,
        w.sgReachable(g, g.entry).length, g.nodes.length);

      /* Run it on a spread of inputs and insist each trace is a walk. */
      let steps = 0, offGraph = 0;
      for (const x of [0, 1, 2, 3, 5, 17, 48, 49, 50, 51, 99, 3222]) {
        const r = w.pgRun(prog, { x }, 20000);
        if (!r.ok) continue;
        for (let i = 0; i + 1 < r.trace.length; i++) {
          steps++;
          if (!g.edges.some(e => e[0] === r.trace[i] && e[1] === r.trace[i + 1])) offGraph++;
        }
      }
      s.ok(`  ...and ${steps} recorded steps are all edges of it`,
        steps > 5 && offGraph === 0, `${offGraph} were not`);
    });

    /* The two loop shapes, which differ in exactly one place: where
       the graph enters the loop. */
    {
      const wl = w.pgGraph(w.pgParse(w.PG_PRESETS['a while loop'].src));
      const test = wl.labels.filter(n => /^while /.test(n.label))[0];
      s.ok('the while loop has a test node', !!test);
      s.is('  ...reached from before the loop and from the body',
        w.sgIndeg(wl, test.id), 2);
      s.is('  ...and leading into the body and out of it',
        w.sgOutdeg(wl, test.id), 2);
      s.is('  ...and the test is where the program enters the loop',
        wl.entry === test.id, false);
      s.same('  ...entered from the statement before it and from the end of the body',
        w.sgPred(wl, test.id).map(n => wl.labels[n].label).sort(),
        ['i = 1', 'i = i + 1']);

      const rl = w.pgGraph(w.pgParse(w.PG_PRESETS['a repeat-until loop'].src));
      const until = rl.labels.filter(n => /^until /.test(n.label))[0];
      s.ok('the repeat loop has an until node', !!until);
      s.ok('  ...which the program does not enter through',
        rl.entry !== until.id);
      s.ok('  ...and which goes back to the first statement of the body',
        rl.edges.some(e => e[0] === until.id && rl.labels[e[1]].label === 'total = total + i'));
      s.is('  ...so the body always runs at least once',
        w.pgRun(w.pgParse(w.PG_PRESETS['a repeat-until loop'].src), { x: 0 }).value, 1);
      s.is('  ...where the while version runs it no times at all',
        w.pgRun(w.pgParse(w.PG_PRESETS['a while loop'].src), { x: 0 }).value, 0);
    }

    s.ok('a program that does not parse says why',
      w.pgParse('if x then').ok === false);
    s.ok('  ...and so does one with a stray symbol',
      w.pgParse('x = 1 @ 2').ok === false);
  }

  /* ---------------- the two-condition program ----------------

     The four rows the notes tabulate, then the whole input range.
     ------------------------------------------------------------- */

  {
    const prog = w.pgParse(w.PG_PRESETS['two conditions'].src);
    const g = w.pgGraph(prog);
    const run = x => w.pgRun(prog, { x }).value;

    /* A second reading of the specification, not the engine's. */
    const spec = x => (x < 50 ? x + 2 : x > 50 ? x - 1 : 50);

    const table = [[3222, 3221, 'P'], [30, 32, 'P'], [49, 51, 'F'], [50, 50, 'P']];
    table.forEach(([x, want, verdict]) => {
      s.is(`the specification wants ${want} for ${x}`, spec(x), want);
      s.is(`  ...and the engine's specification agrees`, w.pgSpec50(x), want);
      s.is(`  ...so input ${x} is a ${verdict}`, run(x) === want ? 'P' : 'F', verdict);
    });

    s.is('the program has five statements', g.nodes.length, 5);
    s.is('  ...and six edges', g.edges.length, 6);
    s.is('  ...so V(G) is 3', w.sgCyclomatic(g), 3);

    /* The two test cases the notes start with. */
    const traces = [3222, 30].map(x => w.pgRun(prog, { x }).trace);
    const cov = w.sgCoverage(g, traces);
    s.is('{3222, 30} covers every statement', `${cov.nodes.hit}/${cov.nodes.of}`, '5/5');
    s.is('  ...and every edge', `${cov.edges.hit}/${cov.edges.of}`, '6/6');
    s.is('  ...and every DD-path', `${cov.ddNodes.hit}/${cov.ddNodes.of}`, '5/5');
    s.ok('  ...and both of them pass',
      [3222, 30].every(x => run(x) === spec(x)));

    /* And misses the fault. */
    const sweep = w.pgSweep(65536);
    s.is('the sweep checked the whole stated range', sweep.checked, 65536);
    s.same('exactly one input in 65536 disagrees with the specification',
      sweep.failing, [49]);

    let mine = [];
    for (let x = 1; x <= 65536; x++) if (run(x) !== spec(x)) mine.push(x);
    s.same('  ...which a second sweep confirms', mine, [49]);

    /* Why it is missed: 49 is the only input that runs both bodies. */
    let both = [];
    for (let x = 1; x <= 65536; x++) {
      if (w.pgRun(prog, { x }).trace.length === 5) both.push(x);
    }
    s.same('49 is the only input that executes every statement in one run', both, [49]);

    /* Prime path coverage does ask for that path. */
    const prime = w.sgPrimePaths(g);
    s.is('the program has four prime paths', prime.length, 4);
    s.ok('  ...one of which is both conditions true',
      prime.some(p => p.join(',') === '0,1,2,3,4'));
    s.is('  ...which {3222, 30} does not cover', `${cov.prime.hit}/${cov.prime.of}`, '2/4');
    const one = w.sgCoverage(g, [w.pgRun(prog, { x: 30 }).trace]);
    s.is('  ...and one test case covers one of them',
      `${one.prime.hit}/${one.prime.of}`, '1/4');
    const withFault = w.sgCoverage(g, [3222, 30, 49, 50].map(x => w.pgRun(prog, { x }).trace));
    s.is('  ...and {3222, 30, 49, 50} does', `${withFault.prime.hit}/${withFault.prime.of}`,
      '4/4');

    /* The third fix the notes suggest actually works. */
    const fixed = w.pgParse(w.PG_PRESETS['the same, as a choice'].src);
    let bad = 0;
    for (let x = 1; x <= 65536; x++) if (w.pgRun(fixed, { x }).value !== spec(x)) bad++;
    s.is('writing the three cases as a choice agrees everywhere', bad, 0);
    s.is('  ...at the same cyclomatic number', w.sgCyclomatic(w.pgGraph(fixed)), 3);
  }

  /* ---------------- unreachable code ---------------- */

  {
    const g = w.SG_GRAPHS['the running graph'];
    const withDead = w.sgWithUnreachable(g);
    s.is('the unreachable pair adds two nodes', withDead.nodes.length, g.nodes.length + 2);
    s.is('  ...which the entry cannot reach',
      w.sgReachable(withDead, 0).length, g.nodes.length);
    s.ok('  ...so statement coverage of it is unsatisfiable',
      w.sgCoverage(withDead, [[0, 1, 2, 4, 5, 6, 9], [0, 1, 3, 4, 7, 8, 9]])
        .nodes.hit < withDead.nodes.length);
  }

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 1200);

  return s;
};
