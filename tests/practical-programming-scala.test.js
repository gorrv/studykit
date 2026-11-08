'use strict';
/**
 * Practical Experiences of Programming — the Scala half.
 *
 * Same principle as the C++ half: Scala's Int IS the JVM's int, so the
 * evaluator on the page is checked against a real JVM rather than against my
 * reading of the spec. Where they disagree, the evaluator is wrong.
 *
 * It is a separate suite from the C++ half only because of how long the two
 * take together — see lib/toolchain.js. The structural checks and the
 * question bank are done once, over there.
 */

const fs = require('fs');
const path = require('path');
const { loadModule, Suite } = require('./lib/harness');
const { HAVE_JAVA, TMP, javaEval, runSync, ri, pick } = require('./lib/toolchain');

module.exports = async function run() {
  const s = new Suite('practical-programming-scala');
  const m = await loadModule('practical-programming.html');
  const w = m.window;

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

  /* ---------------- Scala 2 · functions, Option, matching ---------------- */
  {
    const ev = src => w.scEval(src, {});

    /* Higher-order functions. */
    s.is('filter keeps what the function accepts',
      ev('List(1, 2, 3, 4, 5).filter(x => x % 2 == 0)').show, 'List(2, 4)');
    s.is('and the underscore means the same thing',
      ev('List(1, 2, 3, 4, 5).filter(_ % 2 == 0)').show, 'List(2, 4)');
    s.is('count counts them', ev('List(1, 2, 3, 4, 5).count(_ % 2 == 0)').show, '2');
    s.is('map transforms each', ev('List(1,2,3,4,5,6,7,8).map(n => n * n)').show,
      'List(1, 4, 9, 16, 25, 36, 49, 64)');
    s.is('find gives the first, wrapped', ev('List(7,2,3,4,5,6).find(_ < 4)').show, 'Some(2)');
    s.is('and None when there is none', ev('List(5,6,7,8,9).find(_ < 4)').show, 'None');
    s.is('find is typed as an Option', ev('List(7,2,3).find(_ < 4)').type, 'Option[Int]');
    s.ok('two underscores mean two parameters, so this is refused',
      ev('List(1,2,3).map(_ * _)').ok === false,
      'in Scala `_ * _` is (a, b) => a * b, which map cannot use');

    /* for-comprehensions. */
    s.is('a for-comprehension yields a list',
      ev('for (n <- List(1, 2, 3, 4, 5)) yield n * n').show, 'List(1, 4, 9, 16, 25)');
    s.is('a guard filters', ev('for (n <- List(1,2,3,4,5,6) if n % 2 == 0) yield n').show,
      'List(2, 4, 6)');
    s.is('two generators nest, outer first',
      ev('for (x <- List(1,2); y <- List(10,20)) yield x * y').show, 'List(10, 20, 20, 40)');

    /* Option. */
    s.is('getOrElse on Some', ev('Some(42).getOrElse(0)').show, '42');
    s.is('getOrElse on None', ev('None.getOrElse(0)').show, '0');
    s.is('map on Some applies', ev('Some(3).map(_ * 2)').show, 'Some(6)');
    s.is('map on None does not', ev('None.map(_ * 2)').show, 'None');
    s.ok('get on None throws', ev('None.get').ok === false && ev('None.get').runtime === true);
    s.is('toIntOption on rubbish', ev('"12x".toIntOption').show, 'None');
    s.is('and on a number', ev('"1234".toIntOption').show, 'Some(1234)');
    s.ok('toInt on rubbish throws instead', ev('"12x".toInt').ok === false);

    /* Map. */
    s.is('Map.get returns an Option', ev("Map('a' -> 97).get('a')").show, 'Some(97)');
    s.is('and None for a missing key', ev("Map('a' -> 97).get('z')").show, 'None');
    s.ok('applying the map directly throws on a missing key',
      ev("Map('a' -> 97)('z')").ok === false);
    s.is('a to z is 26 characters', ev("('a' to 'z').length").show, '26');
    s.is('and the codes come out right',
      ev("('a' to 'e').map(c => (c, c.toInt)).toMap.get('c')").show, 'Some(99)');

    /* Pattern matching: order decides. */
    const fizz = n => '(' + n + ' % 3, ' + n + ' % 5) match { case (0, 0) => "fizz buzz" ' +
      'case (0, _) => "fizz" case (_, 0) => "buzz" case _ => "' + n + '" }';
    s.is('15 is fizz buzz', ev(fizz(15)).show, '"fizz buzz"');
    s.is('3 is fizz', ev(fizz(3)).show, '"fizz"');
    s.is('5 is buzz', ev(fizz(5)).show, '"buzz"');
    s.is('7 is itself', ev(fizz(7)).show, '"7"');
    s.is('a list pattern binds head and tail',
      ev('List(1,2,3) match { case Nil => 0 case h :: t => h + t.length }').show, '3');
    s.is('Some binds what is inside',
      ev('Some(5) match { case None => 0 case Some(v) => v * 2 }').show, '10');
    s.ok('and a match with a gap throws at run time',
      ev('3 match { case 1 => "one" case 2 => "two" }').ok === false);

    /* A guard can reject a pattern that matched, and then the next case
       gets its turn. Without this the guard could be ignored entirely
       and every other assertion here would still pass. */
    const guarded = n =>
      'Some(' + n + ') match { case Some(v) if v > 10 => "big" case Some(v) => "small" ' +
      'case None => "nothing" }';
    s.is('a guard that holds keeps the case', ev(guarded(42)).show, '"big"');
    s.is('a guard that fails passes it on', ev(guarded(3)).show, '"small"');
    const gt = w.scMatchTrace(guarded(3), {});
    s.is('the tracer says which guard failed', gt.rows[0].guardResult, false);
    s.is('and the case is reported as not matching', gt.rows[0].matched, false);
    s.is('so the second case is the winner', gt.winner, 1);
    s.ok('a for-comprehension guard actually filters',
      ev('for (n <- List(1,2,3,4,5,6) if n % 2 == 0) yield n').show === 'List(2, 4, 6)' &&
      ev('for (n <- List(1,2,3,4,5,6)) yield n').show === 'List(1, 2, 3, 4, 5, 6)');

    /* The tracer: which cases were reached, which matched. */
    const tr = w.scMatchTrace(fizz(15), {});
    s.is('all four fizz-buzz patterns match 15', tr.rows.filter(r => r.matched).length, 4);
    s.is('and only the first is reached', tr.rows.filter(r => r.reached).length, 1);
    s.is('so the answer is the first one', tr.result, '"fizz buzz"');
    const dead = w.scMatchTrace(
      '(15 % 3, 15 % 5) match { case _ => "other" case (0, 0) => "fizz buzz" }', {});
    s.is('putting case _ first makes the rest unreachable',
      dead.rows.filter(r => !r.reached).length, 1);
    s.is('and changes the answer', dead.result, '"other"');
    const bindTr = w.scMatchTrace('List(1,2,3) match { case Nil => 0 case h :: t => h }', {});
    s.same('the tracer reports what a pattern bound',
      bindTr.rows[1].binds.map(b => b.name + '=' + b.value), ['h=1', 't=List(2, 3)']);

    /* The collection methods, against JavaScript's own — a separate
       implementation of the same operations, which is the nearest thing
       to a second opinion available without a Scala compiler. */
    const PREDS = [['_ % 2 == 0', x => x % 2 === 0], ['_ > 3', x => x > 3],
                   ['_ < 4', x => x < 4], ['x => x * x > 9', x => x * x > 9]];
    const MAPS = [['_ * 2', x => x * 2], ['n => n * n', x => x * x], ['_ + 1', x => x + 1]];
    const showList = a => 'List(' + a.join(', ') + ')';
    let cbad = 0, cn = 0, cfirst = null;
    for (let t = 0; t < 120; t++) {
      const xs = Array.from({ length: ri(0, 7) }, () => ri(-5, 9));
      const lit = 'List(' + xs.join(', ') + ')';
      const [ps, pf] = pick(PREDS), [ms, mf] = pick(MAPS);
      [[`${lit}.filter(${ps})`, showList(xs.filter(pf))],
       [`${lit}.map(${ms})`, showList(xs.map(mf))],
       [`${lit}.count(${ps})`, String(xs.filter(pf).length)],
       [`${lit}.exists(${ps})`, String(xs.some(pf))],
       [`${lit}.forall(${ps})`, String(xs.every(pf))],
       [`${lit}.find(${ps})`, xs.some(pf) ? 'Some(' + xs.find(pf) + ')' : 'None'],
       [`${lit}.reverse`, showList(xs.slice().reverse())],
       [`${lit}.sorted`, showList(xs.slice().sort((a, b) => a - b))],
       [`${lit}.distinct`, showList([...new Set(xs)])],
       [`${lit}.sum`, String(xs.reduce((a, b) => a + b, 0) | 0)]
      ].forEach(([src, want]) => {
        const r = ev(src);
        const got = r.ok ? r.show : 'ERR';
        cn++;
        if (got !== want) {
          cbad++;
          if (!cfirst) cfirst = `${src}: engine ${got}, JavaScript ${want}`;
        }
      });
    }
    s.is(`all ${cn} collection results match JavaScript's own array methods`, cbad, 0, cfirst);

    /* And the law this topic is about: a for-comprehension is the map it
       desugars to. Generated both ways and compared. */
    let fbad = 0, fn = 0, ffirst = null;
    for (let t = 0; t < 120; t++) {
      const xs = Array.from({ length: ri(0, 6) }, () => ri(-4, 9));
      const lit = 'List(' + xs.join(', ') + ')';
      const body = pick(['q * q', 'q + 1', 'q * 2 - 1']);
      const guard = pick([null, 'q % 2 == 0', 'q > 0']);
      const forSrc = guard ? `for (q <- ${lit} if ${guard}) yield ${body}`
                           : `for (q <- ${lit}) yield ${body}`;
      const mapSrc = guard ? `${lit}.filter(q => ${guard}).map(q => ${body})`
                           : `${lit}.map(q => ${body})`;
      const a = ev(forSrc), b = ev(mapSrc);
      fn++;
      const ga = a.ok ? a.show : 'ERR', gb = b.ok ? b.show : 'ERR';
      if (ga !== gb) {
        fbad++;
        if (!ffirst) ffirst = `${forSrc} gave ${ga}, ${mapSrc} gave ${gb}`;
      }
    }
    s.is(`all ${fn} for-comprehensions equal the map they desugar to`, fbad, 0, ffirst);

    /* find is the first thing filter keeps — a law relating two of them. */
    let lbad = 0;
    for (let t = 0; t < 60; t++) {
      const xs = Array.from({ length: ri(0, 6) }, () => ri(-4, 9));
      const lit = 'List(' + xs.join(', ') + ')';
      const p = pick(PREDS)[0];
      const found = ev(`${lit}.find(${p})`).show;
      const kept = ev(`${lit}.filter(${p})`);
      const firstKept = kept.value.v.length ? 'Some(' + w.scShow(kept.value.v[0]) + ')' : 'None';
      if (found !== firstKept) lbad++;
    }
    s.is('find always agrees with the first element filter keeps', lbad, 0);

    /* The recursion trace and the call count are measured, not asserted. */
    const fl = w.scFlattenTrace([null, 3, null, 7, 1]);
    s.same('my_flatten drops the Nones', fl.result, [3, 7, 1]);
    s.is('and takes one call per element plus one', fl.steps.length, 6);
    const f10 = w.scFibCount(10), f12 = w.scFibCount(12);
    s.is('fib(10) is 89 with this indexing', f10.value, 89);
    s.ok('and the call count grows exponentially', f12.calls > 2 * f10.calls,
      `${f10.calls} then ${f12.calls}`);
  }

  if (HAVE_JAVA) {
    /* Which strings parse is Integer.parseInt, so ask a real JVM. */
    const inputs = ['1234', '0', '-7', '12x', '', '  12', '2147483648', '3.0', '007'];
    const jr = javaEval(inputs.map(s2 => 'Integer.parseInt("' + s2 + '")'));
    s.ok('the JVM ran the parse cases', jr.ok, jr.error);
    if (jr.ok) {
      let bad = 0, first = null, threw = 0;
      inputs.forEach((s2, i) => {
        const mine = w.scEval('"' + s2 + '".toInt', {});
        const got = mine.ok ? mine.show : 'THROWS NumberFormatException';
        if (/THROWS/.test(jr.out[i])) threw++;
        if (got !== jr.out[i]) {
          bad++;
          if (!first) first = `"${s2}".toInt: engine ${got}, JVM ${jr.out[i]}`;
        }
      });
      s.is('toInt agrees with Integer.parseInt on every case', bad, 0, first);
      s.ok('and several of them throw, so the check is not vacuous', threw >= 4, `${threw}`);

      /* toIntOption is the same question with the failure in the type. */
      let obad = 0;
      inputs.forEach((s2, i) => {
        const opt = w.scEval('"' + s2 + '".toIntOption', {});
        const threwInJava = /THROWS/.test(jr.out[i]);
        const isNone = opt.ok && opt.show === 'None';
        if (threwInJava !== isNone) obad++;
      });
      s.is('toIntOption is None exactly where parseInt throws', obad, 0);
    }

    /* The pair-match fizz buzz, against the nested-if version written in
       Java — a different shape of code for the same function. */
    const cases = [];
    for (let n = 1; n <= 40; n++) cases.push(n);
    const jl = javaEval(cases.map(n =>
      '((' + n + ' % 3 == 0 && ' + n + ' % 5 == 0) ? "fizz buzz" : ' +
      '(' + n + ' % 3 == 0) ? "fizz" : (' + n + ' % 5 == 0) ? "buzz" : "' + n + '")'));
    if (jl.ok) {
      let bad = 0, first = null;
      cases.forEach((n, i) => {
        const src = '(' + n + ' % 3, ' + n + ' % 5) match { case (0, 0) => "fizz buzz" ' +
          'case (0, _) => "fizz" case (_, 0) => "buzz" case _ => "' + n + '" }';
        const got = w.scEval(src, {}).show.replace(/"/g, '');
        if (got !== jl.out[i]) {
          bad++;
          if (!first) first = `n=${n}: match gave ${got}, Java gave ${jl.out[i]}`;
        }
      });
      s.is('the pair-match fizz buzz agrees with the nested-if version on 1..40', bad, 0, first);
    }
  }

  /* ---------------- Scala 3 · defaults, regexes, crawling ---------------- */
  {
    /* Argument binding. The three that must be refused matter more than
       the five that work. */
    const bind = k => w.dfBind(w.DF_PARAMS, w.DF_CALLS[k].args);
    s.same('two positional arguments fill both parameters',
      bind('both').slots.map(x => x.name + '=' + x.value + '/' + x.from),
      ['n=7/positional', 'a=3/positional']);
    s.same('one leaves the second to its default',
      bind('one').slots.map(x => x.name + '=' + x.value + '/' + x.from),
      ['n=7/positional', 'a=0/default']);
    s.ok('named arguments may be reordered', bind('reordered').ok);
    s.same('and still land in the right places',
      bind('reordered').slots.map(x => x.name + '=' + x.value), ['n=7', 'a=3']);
    s.ok('a default does not let you skip an earlier parameter',
      bind('skipFirst').ok === false);
    s.ok('a positional argument after a named one is refused',
      bind('afterNamed').ok === false);
    s.ok('and a parameter with no default must be supplied', bind('none').ok === false);

    /* The crawl, against a reachability set computed by breadth-first
       search — different code, same question. */
    let cbad = 0, cfirst = null;
    for (let d = 1; d <= 5; d++) {
      const withMem = w.cwCrawl('a.example', d, { visited: true });
      const reach = w.cwReachable('a.example', d);
      const fetched = Object.keys(withMem.counts).sort();
      if (JSON.stringify(fetched) !== JSON.stringify(reach)) {
        cbad++;
        if (!cfirst) cfirst = `depth ${d}: crawled ${fetched}, reachable ${reach}`;
      }
      /* With a visited set, nothing is fetched twice. */
      if (Object.keys(withMem.counts).some(k => withMem.counts[k] > 1)) {
        cbad++;
        if (!cfirst) cfirst = `depth ${d}: a visited set did not prevent a repeat`;
      }
      const em = w.cwCrawl('a.example', d, { visited: true }).emails;
      const em2 = w.cwReachableEmails('a.example', d);
      if (JSON.stringify(em) !== JSON.stringify(em2)) {
        cbad++;
        if (!cfirst) cfirst = `depth ${d}: emails ${em} vs ${em2}`;
      }
    }
    s.is('the crawl reaches exactly the pages breadth-first search says it should', cbad, 0, cfirst);

    /* And without a visited set it really does repeat itself — the
       whole point of that half of the tool. */
    const noMem3 = w.cwCrawl('a.example', 3, {});
    const withMem3 = w.cwCrawl('a.example', 3, { visited: true });
    s.ok('without one, some page is fetched more than once',
      noMem3.repeats.length > 0, `${noMem3.total} fetches, ${noMem3.distinct} pages`);
    s.ok('and the fetch count is higher than the page count',
      noMem3.total > noMem3.distinct, `${noMem3.total} vs ${noMem3.distinct}`);
    s.is('while with one they are equal', withMem3.total, withMem3.distinct);
    s.ok('the gap widens with depth',
      w.cwCrawl('a.example', 4, {}).total > noMem3.total);

    /* The regexes find what they should. These live outside the JVM
       block deliberately: with them inside, a change that made every
       pattern match nothing passed cleanly on a machine without java. */
    const email = t2 => {
      const m3 = w.rxFind(w.RX_PATTERNS.email.source, t2).matches;
      return m3.length ? m3[0].text : null;
    };
    s.is('an ordinary address matches whole', email('ada@example.com'), 'ada@example.com');
    s.is('a capital in the local part gives a wrong address, not no address',
      email('Ada@example.com'), 'da@example.com');
    s.is('and a long suffix gives a truncated one',
      email('ada@example.technology'), 'ada@example.techno');
    s.is('a six-character suffix is fine', email('ada@example.museum'), 'ada@example.museum');
    s.is('all upper case does fail outright', email('ADA@EXAMPLE.COM'), null);

    s.is('the URL pattern finds both links on the sample page',
      w.rxFind(w.RX_PATTERNS.http.source, w.RX_PAGES.simple.text).count, 2);
    /* Indexing into the matches is what turns a wrong answer into a
       crash, and a crash stops every assertion after it. Read the
       first match defensively so a regression is reported rather than
       thrown. */
    const firstMatch = (pat, text) => {
      const m4 = w.rxFind(pat, text).matches;
      return m4.length ? m4[0] : { text: '(no match)', groups: [] };
    };
    s.is('and keeps the quotes, which is what unquote is for',
      firstMatch(w.RX_PATTERNS.http.source, w.RX_PAGES.simple.text).text,
      '"https://example.com/a"');
    s.is('unquote removes them', w.rxUnquote('"https://example.com/a"'), 'https://example.com/a');
    s.is('the email pattern finds both addresses too',
      w.rxFind(w.RX_PATTERNS.email.source, w.RX_PAGES.simple.text).count, 2);
    s.is('href captures just the target',
      firstMatch(w.RX_PATTERNS.href.source, w.RX_PAGES.simple.text).groups[0],
      'https://example.com/a');
    s.is('and a page with nothing in it finds nothing',
      w.rxFind(w.RX_PATTERNS.http.source, w.RX_PAGES.none.text).count, 0);
  }

  if (HAVE_JAVA) {
    /* Scala's regexes are java.util.regex. Every pattern and page in the
       tool goes to a real JVM, and the matches, their positions and
       their groups are compared one by one. */
    let rbad = 0, rn = 0, rfirst = null, totalMatches = 0;
    Object.keys(w.RX_PATTERNS).forEach(pk => {
      Object.keys(w.RX_PAGES).forEach(gk => {
        const pattern = w.RX_PATTERNS[pk].source;
        const text = w.RX_PAGES[gk].text;
        const b64 = x => Buffer.from(x, 'utf8').toString('base64');
        const prog = 'import java.util.regex.*;\npublic class P {\n' +
          '  public static void main(String[] a) throws Exception {\n' +
          '    String p = new String(java.util.Base64.getDecoder().decode("' + b64(pattern) + '"), "UTF-8");\n' +
          '    String t = new String(java.util.Base64.getDecoder().decode("' + b64(text) + '"), "UTF-8");\n' +
          '    Matcher m = Pattern.compile(p).matcher(t);\n' +
          '    while (m.find()) {\n' +
          '      StringBuilder sb = new StringBuilder();\n' +
          '      sb.append(m.start()).append("|").append(m.group());\n' +
          '      for (int g = 1; g <= m.groupCount(); g++) sb.append("|").append(m.group(g));\n' +
          '      System.out.println(sb.toString());\n' +
          '    }\n    System.out.println("--END--");\n  }\n}\n';
        const f = path.join(TMP, 'P.java');
        fs.writeFileSync(f, prog);
        const jr = runSync('java', [f], 90000);
        rn++;
        if (jr.status !== 0) {
          rbad++;
          if (!rfirst) rfirst = `${pk}/${gk}: the JVM would not run it — ` +
            (jr.stderr || '').split('\n')[0];
          return;
        }
        const real = [];
        for (const line of jr.stdout.split('\n')) {
          if (line === '--END--') break;
          if (line.trim()) real.push(line);
        }
        const mine = w.rxFind(pattern, text).matches.map(m2 =>
          [m2.index, m2.text].concat(m2.groups.map(g => g === null ? '' : g)).join('|'));
        totalMatches += mine.length;
        if (JSON.stringify(mine) !== JSON.stringify(real)) {
          rbad++;
          if (!rfirst) {
            rfirst = `${pk} on ${gk}:\n   here: ${JSON.stringify(mine)}\n   JVM : ${JSON.stringify(real)}`;
          }
        }
      });
    });
    s.is(`all ${rn} pattern/page pairs match java.util.regex exactly`, rbad, 0, rfirst);
    s.ok('and there were matches to compare', totalMatches > 8, `${totalMatches}`);

  }

  /* ---------------- Scala 4 · RPN, bytecode, backtracking ---------------- */
  {
    /* The conversion is checked by evaluating the result three ways that
       share no code: on an RPN stack, by running the compiled
       instructions, and by the Scala evaluator on the original infix. */
    s.same('the worked example converts as expected',
      w.rpConvert('(3 + 1) * (2 + 9)').rpn, ['3', '1', '+', '2', '9', '+', '*']);
    s.same('precedence is spent by the conversion',
      w.rpConvert('3 + 1 * 2').rpn, ['3', '1', '2', '*', '+']);
    s.same('and left associativity is kept',
      w.rpConvert('10 - 4 - 3').rpn, ['10', '4', '-', '3', '-']);
    s.same('the instructions are a substitution',
      w.rpCompile(w.rpConvert('(3 + 1) * (2 + 9)').tokens),
      ['ldc 3', 'ldc 1', 'iadd', 'ldc 2', 'ldc 9', 'iadd', 'imul']);

    let rbad = 0, rn = 0, rfirst = null;
    const gen = d => {
      if (d <= 0 || Math.random() < 0.35) return String(ri(1, 20));
      return '(' + gen(d - 1) + ' ' + pick(['+', '-', '*']) + ' ' + gen(d - 1) + ')';
    };
    for (let t = 0; t < 150; t++) {
      const src = gen(3);
      const conv = w.rpConvert(src);
      const viaStack = w.rpEval(conv.tokens);
      const viaCode = w.rpRunCode(w.rpCompile(conv.tokens));
      const viaEval = w.scEval(src, {});
      rn++;
      const ok = conv.ok && viaStack.ok && viaCode.ok && viaEval.ok &&
        viaStack.value === viaCode.value && String(viaStack.value) === viaEval.show;
      if (!ok) {
        rbad++;
        if (!rfirst) {
          rfirst = `${src}: stack ${viaStack.value}, code ${viaCode.value}, ` +
            `evaluator ${viaEval.ok ? viaEval.show : viaEval.error}`;
        }
      }
    }
    s.is(`all ${rn} expressions agree across the stack, the compiled code and the evaluator`,
      rbad, 0, rfirst);
    s.ok('an unbalanced bracket is refused', w.rpConvert('(1 + 2').ok === false);
    s.ok('and so is a stray closing one', w.rpConvert('1 + 2)').ok === false);

    /* Backtracking. The claim is about growth, so it is measured. */
    const nested = w.bkParse('(a*)*b');
    const simple = w.bkParse('(a*)b');
    s.ok('both patterns parse', nested.ok && simple.ok);
    const n8 = w.bkMatch(nested.ast, 'aaaaaaaa', 5000000);
    const n12 = w.bkMatch(nested.ast, 'aaaaaaaaaaaa', 5000000);
    const n16 = w.bkMatch(nested.ast, 'a'.repeat(16), 5000000);
    s.ok('the nested pattern never matches a string of only a\'s', !n8.matched && !n12.matched);
    s.ok('and the work grows faster than the input',
      n12.steps > n8.steps * 4 && n16.steps > n12.steps * 4,
      `${n8.steps}, ${n12.steps}, ${n16.steps}`);
    const s8 = w.bkMatch(simple.ast, 'aaaaaaaa', 5000000);
    const s16 = w.bkMatch(simple.ast, 'a'.repeat(16), 5000000);
    s.ok('while one star costs the same per character',
      s16.steps < s8.steps * 3, `${s8.steps} then ${s16.steps}`);

    /* The derivative matcher: one step per character, always. */
    [4, 8, 16, 64, 256].forEach(n => {
      const r = w.bkDerivMatch(nested.ast, 'a'.repeat(n));
      s.is('derivatives take one step per character at n = ' + n, r.steps, n);
    });

    /* And the two matchers must agree on every short string, or the fast
       one is fast because it is wrong. */
    let dbad = 0, dn = 0, dfirst = null, accepted = 0;
    Object.keys(w.BK_PATTERNS).forEach(pk => {
      const p = w.bkParse(w.BK_PATTERNS[pk].src);
      for (let len = 0; len <= 8; len++) {
        for (let mask = 0; mask < Math.pow(2, len); mask++) {
          let str = '';
          for (let i = 0; i < len; i++) str += 'ab'[(mask >> i) & 1];
          const a = w.bkMatch(p.ast, str, 3000000);
          const b = w.bkDerivMatch(p.ast, str);
          dn++;
          if (b.matched) accepted++;
          if (!a.overflowed && a.matched !== b.matched) {
            dbad++;
            if (!dfirst) dfirst = `${w.BK_PATTERNS[pk].src} on "${str}": ${a.matched} vs ${b.matched}`;
          }
        }
      }
    });
    s.is(`the two matchers agree on all ${dn} strings`, dbad, 0, dfirst);
    s.ok('and some of them matched, so this is not vacuous', accepted > 20, `${accepted}`);
  }

  /* ---------------- Scala 5 · DFAs and NFAs ---------------- */
  {
    const worked = w.DA_MACHINES.worked;
    const r = w.daRun(worked, 'abaaa');
    s.ok('the worked string is accepted', r.accepted);
    s.same('and it takes the expected route',
      r.steps.filter(x => x.read !== null).map(x => x.state + x.read + x.to),
      ['Q0aQ1', 'Q1bQ2', 'Q2aQ3', 'Q3aQ4', 'Q4aQ4']);

    /* A partial delta means getting stuck, and stuck means rejected. */
    const partial = w.DA_MACHINES.partial;
    s.ok('a machine with a gap in delta accepts what it can', w.daRun(partial, 'ab').accepted);
    s.ok('and gets stuck otherwise', w.daRun(partial, 'b').stuck);
    s.ok('which is a rejection, not an error', w.daRun(partial, 'b').accepted === false);
    s.ok('and it stops reading at that point',
      w.daRun(partial, 'baaaa').steps.length === 2);

    /* Each machine against an independent description of its language. */
    const strings = w.daStrings(['a', 'b'], 10);
    s.is('that is every string up to length 10', strings.length, 2047);
    const checks = [
      ['evenA', s2 => (s2.match(/a/g) || []).length % 2 === 0, 'an even number of a\'s'],
      ['endsAB', s2 => /ab$/.test(s2), 'ends in ab']
    ];
    checks.forEach(([key, oracle, what]) => {
      let bad = 0, first = null, yes = 0;
      strings.forEach(s2 => {
        const got = w.daRun(w.DA_MACHINES[key], s2).accepted;
        const want = oracle(s2);
        if (want) yes++;
        if (got !== want) {
          bad++;
          if (!first) first = `"${s2}": machine ${got}, ${what} ${want}`;
        }
      });
      s.is(`the ${key} machine accepts exactly the strings that are ${what}`, bad, 0, first);
      s.ok('and that is a real split', yes > 100 && yes < strings.length - 100, `${yes}`);
    });

    /* The NFA and the DFA built from it must accept the same strings.
       Two implementations, one question, every string up to length 10. */
    Object.keys(w.NA_MACHINES).forEach(key => {
      const nfa = w.NA_MACHINES[key];
      const dfa = w.naSubset(nfa);
      let bad = 0, first = null, yes = 0;
      strings.forEach(s2 => {
        const a = w.naRun(nfa, s2).accepted;
        const b = w.daRun(dfa, s2).accepted;
        if (a) yes++;
        if (a !== b) {
          bad++;
          if (!first) first = `"${s2}": NFA ${a}, subset DFA ${b}`;
        }
      });
      s.is(`"${key}": the NFA and its subset construction agree on all 2047 strings`, bad, 0, first);
      s.ok('and it accepts something', yes > 0, `${yes}`);
      s.ok('the DFA has no more states than the bound allows',
        dfa.states.length <= Math.pow(2, nfa.states.length),
        `${dfa.states.length} from ${nfa.states.length}`);
    });

    /* The NFA for "ends in ab" against a regex — a third opinion. */
    let nbad = 0;
    strings.forEach(s2 => {
      if (w.naRun(w.NA_MACHINES.endsAB, s2).accepted !== /ab$/.test(s2)) nbad++;
    });
    s.is('the guessing NFA agrees with a regular expression too', nbad, 0);

    /* Acceptance is "some path", not "all paths". */
    const two = w.NA_MACHINES.twoWays;
    s.ok('two routes to the same accepting state still accept once',
      w.naRun(two, 'ab').accepted);
    s.same('and the set carries both', w.naRun(two, 'a').end, ['X', 'Y']);
    s.ok('a string with no path at all is rejected', w.naRun(two, 'ba').accepted === false);
  }

  return s;
};
