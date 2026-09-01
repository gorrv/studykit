  /* ---------- W2 · CPU scheduling ---------- */

  /** A small random workload. Bursts stay short so the sums are doable by hand. */
  function qsWorkload(n) {
    var ps = [];
    for (var i = 0; i < n; i++) {
      ps.push({
        name: 'P' + (i + 1),
        arrival: i === 0 ? 0 : qzInt(0, 5),
        burst: qzInt(1, 8),
        priority: qzInt(1, 4),
      });
    }
    return ps;
  }

  function qsTable(ps, withPriority) {
    var h = '<table class="results-table"><tr><th>Process</th><th>Arrival</th><th>Burst</th>' +
      (withPriority ? '<th>Priority</th>' : '') + '</tr>';
    ps.forEach(function (p) {
      h += '<tr><td>' + p.name + '</td><td>' + p.arrival + '</td><td>' + p.burst + '</td>' +
        (withPriority ? '<td>' + p.priority + '</td>' : '') + '</tr>';
    });
    return h + '</table>';
  }

  /** Accept a number within tol, tolerating a unicode minus or a stray unit. */
  function qsNum(target, tol) {
    return function (v) {
      var x = parseFloat(String(v).replace(/−/g, '-').replace(/[^0-9.\-]/g, ''));
      if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
      return { ok: Math.abs(x - target) <= (tol || 0.011) };
    };
  }

  // Average waiting time under a named algorithm.
  QZ_GEN.push({ topic: 'scheduling', make: function () {
    var algo = qzPick(['fcfs', 'sjf', 'srtf', 'rr']);
    var ps = qsWorkload(qzInt(3, 4));
    var q = qzInt(2, 3);
    var res = schSimulate(ps, algo, q, false);

    // Reject a draw where every algorithm agrees — it teaches nothing.
    var others = ['fcfs', 'sjf', 'srtf', 'rr'].map(function (a) {
      return schSimulate(ps, a, q, false).avg.waiting;
    });
    if (Math.max.apply(null, others) - Math.min.apply(null, others) < 0.5) throw new Error('retry');

    var name = { fcfs: 'FCFS', sjf: 'SJF (non-preemptive)', srtf: 'SRTF', rr: 'Round Robin' }[algo];
    return {
      topic: 'scheduling · average waiting time',
      prompt: 'Under <strong>' + name + '</strong>' + (algo === 'rr' ? ' with quantum ' + q : '') +
        ', what is the average waiting time?' + qsTable(ps, false),
      placeholder: 'a number, 2 d.p.',
      answer: res.avg.waiting.toFixed(2),
      check: qsNum(res.avg.waiting, 0.011),
      explain: 'Completion times: ' + res.rows.map(function (r) { return r.name + '=' + r.completion; }).join(', ') +
        '. Waiting = turnaround − burst = (completion − arrival) − burst, giving ' +
        res.rows.map(function (r) { return r.waiting; }).join(' + ') + ' = ' +
        res.rows.reduce(function (a, r) { return a + r.waiting; }, 0) + ' over ' + res.rows.length +
        ' processes = <strong>' + res.avg.waiting.toFixed(2) + '</strong>.',
    };
  } });

  // Completion time of one named process.
  QZ_GEN.push({ topic: 'scheduling', make: function () {
    var algo = qzPick(['fcfs', 'sjf', 'srtf', 'rr']);
    var ps = qsWorkload(qzInt(3, 4));
    var q = qzInt(2, 3);
    var res = schSimulate(ps, algo, q, false);
    var i = qzInt(0, ps.length - 1);
    var row = res.rows[i];
    if (row.completion === row.arrival + row.burst) throw new Error('retry');  // it never waited

    var name = { fcfs: 'FCFS', sjf: 'SJF (non-preemptive)', srtf: 'SRTF', rr: 'Round Robin' }[algo];
    return {
      topic: 'scheduling · completion time',
      prompt: 'Under <strong>' + name + '</strong>' + (algo === 'rr' ? ' with quantum ' + q : '') +
        ', at what time does <strong>' + row.name + '</strong> finish?' + qsTable(ps, false),
      placeholder: 'a time',
      answer: String(row.completion),
      check: qsNum(row.completion, 0.001),
      explain: 'The CPU runs ' + res.timeline.map(function (b) {
        return (b.name === null ? 'idle' : b.name) + ' [' + b.start + '–' + b.end + ']';
      }).join(', ') + '. So ' + row.name + ' finishes at <strong>' + row.completion + '</strong>, ' +
        'giving turnaround ' + row.turnaround + ' and waiting ' + row.waiting + '.',
    };
  } });

  // Which algorithm wins on which metric — the trade-off, as a fact question.
  QZ_GEN.push({ topic: 'scheduling', make: function () {
    var ps = qsWorkload(4);
    var metric = qzPick(['waiting', 'response']);
    var scores = ['fcfs', 'sjf', 'srtf', 'rr'].map(function (a) {
      return { a: a, v: schSimulate(ps, a, 2, false).avg[metric] };
    });
    scores.sort(function (x, y) { return x.v - y.v; });
    if (Math.abs(scores[0].v - scores[1].v) < 0.4) throw new Error('retry');   // no clear winner

    var label = { fcfs: 'FCFS', sjf: 'SJF', srtf: 'SRTF', rr: 'Round Robin (q=2)' };
    return {
      topic: 'scheduling · comparing algorithms',
      kind: 'choice',
      prompt: 'For these processes, which algorithm gives the lowest average <strong>' +
        (metric === 'waiting' ? 'waiting' : 'response') + ' time</strong>?' + qsTable(ps, false),
      choices: ['FCFS', 'SJF', 'SRTF', 'Round Robin (q=2)'],
      answer: label[scores[0].a],
      check: textCheck(label[scores[0].a]),
      explain: 'Averages: ' + scores.map(function (x) {
        return label[x.a] + ' ' + x.v.toFixed(2);
      }).join(', ') + '. ' + (metric === 'waiting'
        ? 'Shortest-job-first policies minimise waiting time by getting small jobs out of the way, at the cost of starving long ones.'
        : 'Round Robin usually wins on response time because every process gets the CPU within one cycle of the queue — and usually loses on turnaround for the same reason.'),
    };
  } });
