  /* ---------- W11 · deadlock and the Banker's algorithm ---------- */

  /** A random allocation state, small enough to check by hand. */
  function qdState() {
    var n = qzInt(3, 4), k = qzInt(2, 3);
    var max = [], alloc = [], avail = [];
    for (var i = 0; i < n; i++) {
      var mrow = [], arow = [];
      for (var j = 0; j < k; j++) {
        var mx = qzInt(1, 6);
        mrow.push(mx);
        arow.push(qzInt(0, mx));
      }
      max.push(mrow); alloc.push(arow);
    }
    for (var j2 = 0; j2 < k; j2++) avail.push(qzInt(0, 4));
    return { max: max, alloc: alloc, avail: avail, n: n, k: k };
  }

  function qdTable(st) {
    var letters = [];
    for (var j = 0; j < st.k; j++) letters.push(String.fromCharCode(65 + j));
    var h = '<table class="results-table"><tr><th>Process</th><th>Allocation (' + letters.join(' ') +
      ')</th><th>Max</th></tr>';
    for (var i = 0; i < st.n; i++) {
      h += '<tr><td>P' + i + '</td><td>' + st.alloc[i].join(' ') + '</td><td>' + st.max[i].join(' ') + '</td></tr>';
    }
    return h + '</table><p style="font-family:\'IBM Plex Mono\',monospace; font-size:13px;">Available = ' +
      st.avail.join(' ') + '</p>';
  }

  // Need = Max − Allocation, one row.
  QZ_GEN.push({ topic: 'deadlock', make: function () {
    var st = qdState();
    var i = qzInt(0, st.n - 1);
    var need = st.max[i].map(function (m, j) { return m - st.alloc[i][j]; });
    if (need.every(function (v) { return v === 0; })) throw new Error('retry');

    return {
      topic: 'deadlock · the Need matrix',
      prompt: 'What is the <strong>Need</strong> row for <strong>P' + i + '</strong>?' + qdTable(st),
      placeholder: need.map(function () { return 'n'; }).join(' '),
      answer: need.join(' '),
      check: function (v) {
        var got = String(v).trim().split(/[\s,]+/).map(Number);
        if (got.length !== need.length || got.some(isNaN)) {
          return { ok: false, msg: 'Give ' + need.length + ' numbers, separated by spaces.' };
        }
        return { ok: got.every(function (x, j) { return x === need[j]; }) };
      },
      explain: 'Need = Max − Allocation, element by element: ' +
        st.max[i].map(function (m, j) { return m + '−' + st.alloc[i][j]; }).join(', ') +
        ' = <strong>' + need.join(' ') + '</strong>. It is what P' + i +
        ' might still ask for, and the safety check compares it against what is free.',
    };
  } });

  // Safe or not?
  QZ_GEN.push({ topic: 'deadlock', make: function () {
    var st = qdState();
    var res = bkSafe(st.avail, st.max, st.alloc);
    return {
      topic: 'deadlock · safe states',
      kind: 'choice',
      prompt: 'Is this state <strong>safe</strong>?' + qdTable(st),
      choices: ['Safe', 'Unsafe'],
      answer: res.safe ? 'Safe' : 'Unsafe',
      check: textCheck(res.safe ? 'Safe' : 'Unsafe'),
      explain: res.safe
        ? 'Yes. Work starts at ' + st.avail.join(' ') + ', and ' +
          res.steps.map(function (x) {
            return 'P' + x.pid + ' (needs ' + x.need.join(' ') + ') can finish, releasing to ' + x.after.join(' ');
          }).join('; then ') + '. Every process retires, so <strong>' +
          res.sequence.map(function (p) { return 'P' + p; }).join(' → ') + '</strong> is a safe sequence.'
        : 'No. ' + (res.steps.length
            ? res.steps.map(function (x) { return 'P' + x.pid; }).join(', ') + ' can finish, taking work to ' + res.work.join(' ') + ', but then '
            : 'Nothing can start: work is ' + res.work.join(' ') + ' and ') +
          res.stuck.map(function (p) { return 'P' + p + ' still needs ' + res.need[p].join(' '); }).join(', ') +
          ' — none of which can be met. No completion order exists, so the state is unsafe.',
    };
  } });

  // The four conditions.
  QZ_GEN.push({ topic: 'deadlock', make: function () {
    var conds = [
      { t: 'Mutual exclusion', why: 'a resource can be held by only one process at a time' },
      { t: 'Hold and wait', why: 'a process holds one resource while waiting for another' },
      { t: 'No preemption', why: 'a resource cannot be taken away, only released voluntarily' },
      { t: 'Circular wait', why: 'a cycle of processes each waiting on the next' },
    ];
    var fake = qzPick(['Starvation', 'Priority inversion', 'Race condition', 'Context switching']);
    var right = qzPick(conds);
    var choices = [fake].concat(conds.filter(function (c) { return c !== right; })
      .slice(0, 2).map(function (c) { return c.t; })).concat([right.t]);
    // shuffle deterministically enough for a quiz
    choices.sort(function () { return Math.random() - 0.5; });

    return {
      topic: 'deadlock · the four conditions',
      kind: 'choice',
      prompt: 'Which of these is one of the <strong>four necessary conditions</strong> for deadlock, ' +
        'described as “' + right.why + '”?',
      choices: choices,
      answer: right.t,
      check: textCheck(right.t),
      explain: 'The four are mutual exclusion, hold and wait, no preemption and circular wait. ' +
        'All four must hold at once, so breaking any one of them prevents deadlock — and circular ' +
        'wait is usually the practical target, via a fixed global lock order. ' +
        '<em>' + fake + '</em> is a real problem but not one of the four.',
    };
  } });
