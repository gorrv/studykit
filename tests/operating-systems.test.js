'use strict';
/**
 * Operating Systems — correctness tests.
 *
 * Where a standard textbook answer exists, that is what gets asserted: the
 * point of the tools is to reproduce the results a student will be marked
 * against. Where no single published number exists, an invariant is asserted
 * instead — the stack property, the equivalence of the greedy safety check
 * with exhaustive search — because those catch classes of error that a
 * handful of worked examples never would.
 */

const { loadModule, Suite, checkStructure } = require('./lib/harness');

/** Every ordering of 0..n-1. Small n only — used for exhaustive checks. */
function permutations(items) {
  if (items.length <= 1) return [items];
  const out = [];
  items.forEach((x, i) => {
    permutations(items.slice(0, i).concat(items.slice(i + 1)))
      .forEach(rest => out.push([x].concat(rest)));
  });
  return out;
}

/** A tiny deterministic RNG, so a failure is always reproducible. */
function rng(seed) {
  return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
}

module.exports = async function run() {
  const s = new Suite('operating-systems');
  const m = await loadModule('operating-systems.html', 1500);
  const w = m.window;

  await checkStructure(s, m);
  s.ok('has content sections', m.$$('section').length >= 5, `${m.$$('section').length} sections`);

  // ------------------------------------------------------------ Week 2
  // Silberschatz's worked examples, which is what the exam questions look like.
  const P = (n, a, b, pr) => ({ name: n, arrival: a, burst: b, priority: pr });

  const three = [P('P1', 0, 24, 1), P('P2', 0, 3, 2), P('P3', 0, 3, 3)];
  s.near('FCFS on 24/3/3 gives AWT 17', w.schSimulate(three, 'fcfs', 2, false).avg.waiting, 17);
  s.near('SJF on the same set gives AWT 3', w.schSimulate(three, 'sjf', 2, false).avg.waiting, 3);
  s.near('Round Robin q=4 gives AWT 17/3',
    w.schSimulate(three, 'rr', 4, false).avg.waiting, 17 / 3, 1e-9);

  const four = [P('P1', 0, 8, 1), P('P2', 1, 4, 2), P('P3', 2, 9, 3), P('P4', 3, 5, 4)];
  const srtf = w.schSimulate(four, 'srtf', 2, false);
  s.near('SRTF gives AWT 6.5', srtf.avg.waiting, 6.5);
  s.same('SRTF completion times are 17, 5, 26, 10',
    srtf.rows.map(r => r.completion), [17, 5, 26, 10]);
  s.near('non-preemptive SJF on the same set gives AWT 7.75',
    w.schSimulate(four, 'sjf', 2, false).avg.waiting, 7.75);

  const five = [P('P1', 0, 10, 3), P('P2', 0, 1, 1), P('P3', 0, 2, 4), P('P4', 0, 1, 5), P('P5', 0, 5, 2)];
  s.near('Priority scheduling gives AWT 8.2',
    w.schSimulate(five, 'prio', 2, false).avg.waiting, 8.2);

  // Identities that must hold whatever the algorithm, on random instances.
  {
    const r = rng(4242);
    let bad = 0, checked = 0, first = '';
    for (let c = 0; c < 120; c++) {
      const n = 2 + Math.floor(r() * 4);
      const ps = [];
      for (let i = 0; i < n; i++) ps.push(P('P' + (i + 1), Math.floor(r() * 8), 1 + Math.floor(r() * 7), 1 + Math.floor(r() * 4)));
      for (const algo of ['fcfs', 'sjf', 'srtf', 'rr', 'prio']) {
        const res = w.schSimulate(ps, algo, 1 + Math.floor(r() * 3), false);
        const cpu = res.timeline.filter(b => b.name !== null).reduce((a, b) => a + (b.end - b.start), 0);
        const totalBurst = ps.reduce((a, p) => a + p.burst, 0);
        res.rows.forEach(row => {
          checked++;
          const ok = row.turnaround === row.completion - row.arrival &&
            row.waiting === row.turnaround - row.burst &&
            row.waiting >= 0 && row.response >= 0 && row.response <= row.waiting;
          if (!ok && !first) first = `${algo} ${row.name} ${JSON.stringify(row)}`;
          if (!ok) bad++;
        });
        if (cpu !== totalBurst) { bad++; if (!first) first = `${algo}: CPU busy ${cpu} != total burst ${totalBurst}`; }
      }
    }
    s.ok('scheduling identities hold on 600 random schedules', bad === 0, `${bad} of ${checked}: ${first}`);
  }

  // A guarantee specific to SJF: it minimises average waiting time when every
  // process is present from the start. Checked against every possible order.
  {
    const r = rng(77);
    let worse = 0;
    for (let c = 0; c < 40; c++) {
      const n = 3 + Math.floor(r() * 2);
      const ps = [];
      for (let i = 0; i < n; i++) ps.push(P('P' + (i + 1), 0, 1 + Math.floor(r() * 9), 1));
      const sjf = w.schSimulate(ps, 'sjf', 2, false).avg.waiting;
      // any non-preemptive order, evaluated directly
      let best = Infinity;
      permutations(ps.map((_, i) => i)).forEach(order => {
        let t = 0, wait = 0;
        order.forEach(i => { wait += t; t += ps[i].burst; });
        best = Math.min(best, wait / n);
      });
      if (Math.abs(sjf - best) > 1e-9) worse++;
    }
    s.ok('SJF achieves the minimum possible average waiting time', worse === 0, `${worse} of 40`);
  }

  // ------------------------------------------------------------ Week 3
  {
    const split = w.xlSplit(0x5123, 32, 12, 1);
    s.near('0x5123 with 4kB pages is page 5', split.page, 5);
    s.near('…and offset 0x123', split.offset, 0x123);
    const walk = w.xlWalk(split, 1);
    s.near('page 5 maps to frame 0x1ffa', walk[walk.length - 1].found, 0x1ffa);
    s.ok('an unmapped page reports a fault',
      w.xlWalk(w.xlSplit(0x0123, 32, 12, 1), 1)[0].found === null);

    // Two levels must partition exactly the same bits as one.
    const two = w.xlSplit(0x5123, 32, 12, 2);
    s.ok('two-level split covers the whole page number',
      two.outerBits + two.innerBits === 32 - 12, `${two.outerBits}+${two.innerBits}`);
    s.ok('the two indices reconstruct the page number',
      two.fields[0].value * Math.pow(2, two.innerBits) + two.fields[1].value === two.page);
    s.near('the offset is unchanged by the number of levels', two.offset, split.offset);
  }

  // ------------------------------------------------------------ Week 4
  {
    const S = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
    s.near('FIFO on the standard string, 3 frames: 15 faults', w.prRun(S, 3, 'fifo').faults, 15);
    s.near('LRU on the same string: 12 faults', w.prRun(S, 3, 'lru').faults, 12);
    s.near('OPT on the same string: 9 faults', w.prRun(S, 3, 'opt').faults, 9);

    // Belady's anomaly, on the string it is always shown with.
    const B = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    s.near('Belady: FIFO with 3 frames takes 9 faults', w.prRun(B, 3, 'fifo').faults, 9);
    s.near('Belady: FIFO with 4 frames takes 10 — more memory, more faults',
      w.prRun(B, 4, 'fifo').faults, 10);
    s.ok('LRU on the same string does not get worse',
      w.prRun(B, 4, 'lru').faults <= w.prRun(B, 3, 'lru').faults);

    // OPT is optimal by definition: no policy can beat it.
    {
      const r = rng(505);
      let beaten = 0;
      for (let c = 0; c < 150; c++) {
        const len = 6 + Math.floor(r() * 18), pages = 2 + Math.floor(r() * 5);
        const refs = Array.from({ length: len }, () => Math.floor(r() * pages));
        for (let n = 1; n <= 4; n++) {
          const o = w.prRun(refs, n, 'opt').faults;
          ['fifo', 'lru', 'clock'].forEach(a => { if (w.prRun(refs, n, a).faults < o) beaten++; });
        }
      }
      s.ok('no policy ever beats OPT', beaten === 0, `${beaten} cases`);
    }

    // The stack property. LRU and OPT must satisfy it; FIFO and Clock must
    // not, since that is precisely what lets them show Belady's anomaly.
    {
      const r = rng(808);
      const viol = { fifo: 0, lru: 0, opt: 0, clock: 0 };
      for (let c = 0; c < 200; c++) {
        const len = 8 + Math.floor(r() * 20), pages = 2 + Math.floor(r() * 5);
        const refs = Array.from({ length: len }, () => Math.floor(r() * pages));
        for (const a of Object.keys(viol)) {
          for (let n = 1; n <= 4; n++) {
            const s1 = w.prRun(refs, n, a).steps.map(x => x.frames);
            const s2 = w.prRun(refs, n + 1, a).steps.map(x => new Set(x.frames));
            if (s1.some((f, i) => f.some(p => !s2[i].has(p)))) { viol[a]++; break; }
          }
        }
      }
      s.ok('LRU is a stack algorithm', viol.lru === 0, String(viol.lru));
      s.ok('OPT is a stack algorithm', viol.opt === 0, String(viol.opt));
      s.ok('FIFO is not — which is why it can show the anomaly', viol.fifo > 0);
      s.ok('Clock is not either', viol.clock > 0);
    }
  }

  // ------------------------------------------------------------ Week 11
  {
    const max = [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]];
    const alloc = [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]];
    const avail = [3, 3, 2];

    const safe = w.bkSafe(avail, max, alloc);
    s.ok('the standard example is a safe state', safe.safe);
    s.same('Need = Max − Allocation', safe.need,
      [[7, 4, 3], [1, 2, 2], [6, 0, 0], [0, 1, 1], [4, 3, 1]]);
    s.ok('every process appears exactly once in the sequence',
      new Set(safe.sequence).size === 5 && safe.sequence.length === 5);

    // The sequence must actually work when replayed.
    {
      const work = avail.slice();
      let ok = true;
      safe.sequence.forEach(i => {
        if (safe.need[i].some((v, j) => v > work[j])) ok = false;
        alloc[i].forEach((v, j) => { work[j] += v; });
      });
      s.ok('the reported safe sequence really is safe when replayed', ok);
    }

    // Silberschatz's three follow-up requests, from the state after P1's
    // request for (1,0,2) has been granted.
    const avail2 = [2, 3, 0];
    const alloc2 = [[0, 1, 0], [3, 0, 2], [3, 0, 2], [2, 1, 1], [0, 0, 2]];
    s.ok('P1 asking for 1 0 2 is granted',
      w.bkRequest(avail, max, alloc, 1, [1, 0, 2]).verdict === 'grant');
    s.ok('P4 asking for 3 3 0 must wait — not enough is free',
      w.bkRequest(avail2, max, alloc2, 4, [3, 3, 0]).verdict === 'wait');
    s.ok('P0 asking for 0 2 0 is refused — free, but the result is unsafe',
      w.bkRequest(avail2, max, alloc2, 0, [0, 2, 0]).verdict === 'refuse');
    s.ok('a request beyond the declared maximum is an error',
      w.bkRequest(avail, max, alloc, 0, [9, 9, 9]).verdict === 'error');

    // The safety check is greedy. Confirm it agrees with exhaustive search,
    // which is the definition of safety.
    {
      const r = rng(1301);
      let disagree = 0, safeCount = 0, unsafeCount = 0;
      for (let c = 0; c < 400; c++) {
        const n = 2 + Math.floor(r() * 3), k = 1 + Math.floor(r() * 3);
        const mx = Array.from({ length: n }, () => Array.from({ length: k }, () => Math.floor(r() * 6)));
        const al = mx.map(row => row.map(v => Math.floor(r() * (v + 1))));
        const av = Array.from({ length: k }, () => Math.floor(r() * 4));
        const need = al.map((row, i) => row.map((v, j) => mx[i][j] - v));

        const exhaustive = permutations(al.map((_, i) => i)).some(order => {
          const work = av.slice();
          return order.every(i => {
            if (need[i].some((v, j) => v > work[j])) return false;
            al[i].forEach((v, j) => { work[j] += v; });
            return true;
          });
        });

        if (w.bkSafe(av, mx, al).safe !== exhaustive) disagree++;
        exhaustive ? safeCount++ : unsafeCount++;
      }
      s.ok('the greedy safety check agrees with exhaustive search',
        disagree === 0, `${disagree} disagreements`);
      s.ok('the random states covered both outcomes',
        safeCount > 50 && unsafeCount > 50, `${safeCount} safe / ${unsafeCount} unsafe`);
    }
  }

  return s;
};
