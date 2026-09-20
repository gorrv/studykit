  /* ============================================================
     CPU SCHEDULING (Topic 02)

     Five algorithms, one simulator. Rather than a branch per algorithm,
     the loop below advances the clock one unit at a time and asks a
     policy which ready process should hold the CPU. FCFS, SJF, SRTF,
     Round Robin and Priority differ only in that answer, and in whether
     they are allowed to interrupt a running process — which is exactly
     the distinction the exam asks about.
     ============================================================ */

  var SCH = {
    procs: [
      { name: 'P1', arrival: 0, burst: 5, priority: 2 },
      { name: 'P2', arrival: 0, burst: 4, priority: 1 },
      { name: 'P3', arrival: 0, burst: 3, priority: 3 },
    ],
    res: null,
  };

  /**
   * `key` — lowest wins when choosing the next process to run.
   * `preemptive` — may take the CPU from a running process the moment a
   *   better-keyed one becomes ready. Round Robin is deliberately false here:
   *   it preempts on quantum expiry only, never because another process looks
   *   more attractive, and it serves its queue strictly first-in-first-out.
   */
  var SCH_ALGOS = {
    fcfs: { label: 'FCFS', preemptive: false, fifo: false, key: function (p) { return p.arrival; } },
    sjf:  { label: 'SJF',  preemptive: false, fifo: false, key: function (p) { return p.burst; } },
    srtf: { label: 'SRTF', preemptive: true,  fifo: false, key: function (p) { return p.remaining; } },
    prio: { label: 'Priority', preemptive: false, fifo: false, key: function (p) { return p.priority; } },
    rr:   { label: 'Round Robin', preemptive: false, fifo: true, key: function (p) { return p.arrival; } },
  };

  /**
   * Run one schedule.
   *
   * @param {Array} input  [{name, arrival, burst, priority}]
   * @param {string} algo  a key of SCH_ALGOS
   * @param {number} quantum  time slice, Round Robin only
   * @param {boolean} preempt  force preemption (turns Priority into preemptive Priority)
   * @returns {{timeline, rows, avg, cpuBusy, span}}
   */
  function schSimulate(input, algo, quantum, preempt) {
    var spec = SCH_ALGOS[algo] || SCH_ALGOS.fcfs;
    var preemptive = spec.preemptive || !!preempt;
    var q = Math.max(1, quantum | 0);

    var ps = input.map(function (p, i) {
      return {
        i: i, name: p.name, arrival: p.arrival, burst: p.burst,
        priority: p.priority, remaining: p.burst,
        admitted: -1, firstRun: -1, completion: -1,
      };
    });

    var ready = [], cur = null, sliceLeft = 0, done = 0, t = 0;
    var timeline = [], busy = 0;
    var horizon = ps.reduce(function (a, p) { return a + p.burst; }, 0) +
                  ps.reduce(function (a, p) { return Math.max(a, p.arrival); }, 0) + 2;

    /* Lowest key wins; ties break on arrival, then on the order the user
       typed the processes in, so the result is deterministic. Round Robin
       ignores the key entirely and takes the head of the queue. */
    function best(list) {
      if (spec.fifo) return list.shift();
      var pick = 0;
      for (var k = 1; k < list.length; k++) {
        var a = list[k], b = list[pick];
        var ka = spec.key(a), kb = spec.key(b);
        if (ka < kb || (ka === kb && (a.arrival < b.arrival ||
            (a.arrival === b.arrival && a.i < b.i)))) pick = k;
      }
      return list.splice(pick, 1)[0];
    }

    while (done < ps.length && t <= horizon) {
      // 1. admit everything that has arrived by now, in the order given
      for (var i = 0; i < ps.length; i++) {
        if (ps[i].arrival === t) { ps[i].admitted = t; ready.push(ps[i]); }
      }

      // 2. a quantum that has run out returns the process to the back of the
      //    queue — after this instant's arrivals, which is the usual convention
      //    and the one that changes the answer in exam questions
      if (cur && algo === 'rr' && sliceLeft === 0) { ready.push(cur); cur = null; }

      // 3. a preemptive policy may take the CPU away mid-burst
      if (cur && preemptive && ready.length) {
        var challenger = ready.reduce(function (a, b) { return spec.key(b) < spec.key(a) ? b : a; });
        if (spec.key(challenger) < spec.key(cur)) { ready.push(cur); cur = null; }
      }

      // 4. hand the CPU to whoever the policy picks
      if (!cur && ready.length) {
        cur = best(ready);
        sliceLeft = q;
        if (cur.firstRun < 0) cur.firstRun = t;
      }

      // 5. run for one unit (or idle)
      if (cur) {
        var last = timeline[timeline.length - 1];
        if (last && last.name === cur.name) last.end = t + 1;
        else timeline.push({ name: cur.name, start: t, end: t + 1 });
        cur.remaining--; sliceLeft--; busy++;
        if (cur.remaining === 0) { cur.completion = t + 1; done++; cur = null; }
      } else {
        var lastI = timeline[timeline.length - 1];
        if (lastI && lastI.name === null) lastI.end = t + 1;
        else if (done < ps.length) timeline.push({ name: null, start: t, end: t + 1 });
      }
      t++;
    }

    var rows = ps.map(function (p) {
      var turnaround = p.completion - p.arrival;
      return {
        name: p.name, arrival: p.arrival, burst: p.burst, priority: p.priority,
        completion: p.completion,
        turnaround: turnaround,
        waiting: turnaround - p.burst,
        response: p.firstRun - p.arrival,
      };
    });

    var n = rows.length || 1;
    var sum = function (f) { return rows.reduce(function (a, r) { return a + f(r); }, 0); };

    return {
      timeline: timeline,
      rows: rows,
      span: t,
      cpuBusy: busy,
      avg: {
        turnaround: sum(function (r) { return r.turnaround; }) / n,
        waiting: sum(function (r) { return r.waiting; }) / n,
        response: sum(function (r) { return r.response; }) / n,
      },
    };
  }

  /* ---------- the editable process table ---------- */

  function renderProcRows() {
    var c = document.getElementById('sch-rows');
    if (!c) return;
    c.innerHTML = SCH.procs.map(function (p, i) {
      return '<div class="proc-input-row">' +
        '<span class="pname">' + p.name + '</span>' +
        '<input type="number" min="0" value="' + p.arrival + '" aria-label="' + p.name + ' arrival"' +
        ' onchange="updateProc(' + i + ',\'arrival\',this.value)">' +
        '<input type="number" min="1" value="' + p.burst + '" aria-label="' + p.name + ' burst"' +
        ' onchange="updateProc(' + i + ',\'burst\',this.value)">' +
        '<input type="number" min="1" value="' + p.priority + '" aria-label="' + p.name + ' priority"' +
        ' onchange="updateProc(' + i + ',\'priority\',this.value)">' +
        '<button class="mini-btn" onclick="removeProc(' + i + ')" title="Remove ' + p.name + '">×</button>' +
        '</div>';
    }).join('');
  }

  function updateProc(i, field, val) {
    var v = parseInt(val, 10);
    if (isNaN(v)) v = 0;
    SCH.procs[i][field] = field === 'arrival' ? Math.max(0, v) : Math.max(1, v);
    runSchedule();
  }

  function addProc() {
    if (SCH.procs.length >= 6) return;
    SCH.procs.push({ name: 'P' + (SCH.procs.length + 1), arrival: 0, burst: 3, priority: 2 });
    renderProcRows();
    runSchedule();
  }

  function removeProc(i) {
    if (SCH.procs.length <= 1) return;
    SCH.procs.splice(i, 1);
    SCH.procs.forEach(function (p, idx) { p.name = 'P' + (idx + 1); });
    renderProcRows();
    runSchedule();
  }

  function toggleQuantum() {
    var algo = document.getElementById('sch-algo').value;
    var qf = document.getElementById('sch-quantum-field');
    var pf = document.getElementById('sch-preempt-field');
    if (qf) qf.style.display = (algo === 'rr') ? 'flex' : 'none';
    if (pf) pf.style.display = (algo === 'prio') ? 'flex' : 'none';
    runSchedule();
  }

  /* ---------- render ---------- */

  var SCH_COLOURS = ['gantt-p1', 'gantt-p2', 'gantt-p3', 'gantt-p4', 'gantt-p5'];

  function runSchedule() {
    var out = document.getElementById('sch-output');
    if (!out) return;

    var algo = (document.getElementById('sch-algo') || {}).value || 'fcfs';
    var quantum = parseInt((document.getElementById('sch-quantum') || {}).value, 10) || 2;
    var preempt = !!(document.getElementById('sch-preempt') || {}).checked;

    if (!SCH.procs.length) {
      out.innerHTML = '<div class="tool-error">Add at least one process.</div>';
      return;
    }
    if (!document.getElementById('sch-rows').children.length) renderProcRows();

    var res = schSimulate(SCH.procs, algo, quantum, preempt);
    SCH.res = res;

    var colour = {};
    SCH.procs.forEach(function (p, i) { colour[p.name] = SCH_COLOURS[i % SCH_COLOURS.length]; });

    var unit = Math.max(18, Math.min(46, 620 / Math.max(res.span, 1)));

    var html = '<div class="live-gantt"><div class="live-gantt-row">';
    res.timeline.forEach(function (b) {
      var w = (b.end - b.start) * unit;
      var cls = b.name === null ? 'gantt-idle' : colour[b.name];
      html += '<div class="live-gantt-cell ' + cls + '" style="width:' + w + 'px;">' +
        (b.name === null ? 'idle' : b.name) + '</div>';
    });
    html += '</div><div class="live-gantt-axis" style="position:relative; height:16px;">';
    var ticks = { 0: true };
    res.timeline.forEach(function (b) { ticks[b.end] = true; });
    Object.keys(ticks).map(Number).sort(function (a, b) { return a - b; }).forEach(function (tk) {
      html += '<span style="position:absolute; left:' + (tk * unit) + 'px; transform:translateX(-50%);">' + tk + '</span>';
    });
    html += '</div></div>';

    html += '<table class="results-table">' +
      '<tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Priority</th>' +
      '<th>Completion</th><th>Turnaround</th><th>Waiting</th><th>Response</th></tr>';
    res.rows.forEach(function (r) {
      html += '<tr><td><strong>' + r.name + '</strong></td><td>' + r.arrival + '</td><td>' + r.burst +
        '</td><td>' + r.priority + '</td><td>' + r.completion + '</td><td>' + r.turnaround +
        '</td><td>' + r.waiting + '</td><td>' + r.response + '</td></tr>';
    });
    html += '<tr class="awt-row"><td colspan="7">Average turnaround time</td><td>' +
      res.avg.turnaround.toFixed(2) + '</td></tr>' +
      '<tr class="awt-row"><td colspan="7">Average waiting time (AWT)</td><td>' +
      res.avg.waiting.toFixed(2) + '</td></tr>' +
      '<tr class="awt-row"><td colspan="7">Average response time</td><td>' +
      res.avg.response.toFixed(2) + '</td></tr></table>';

    var idle = res.span - res.cpuBusy;
    html += '<p class="tool-note">Turnaround = completion − arrival. Waiting = turnaround − burst. ' +
      'Response = first time on the CPU − arrival. ' +
      'The CPU was busy for ' + res.cpuBusy + ' of ' + res.span + ' units' +
      (idle ? ' (' + idle + ' idle)' : '') + '.</p>';

    html += '<p class="tool-note">Try the same processes under every algorithm. ' +
      'SJF and SRTF give the lowest average waiting time and can starve a long job; ' +
      'Round Robin gives the lowest average response time and the worst turnaround. ' +
      'That trade-off is the whole point — no algorithm wins both.</p>';

    out.innerHTML = html;
  }

  window.SCH = SCH;
  window.schSimulate = schSimulate;
