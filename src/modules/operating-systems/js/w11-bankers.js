  /* ============================================================
     BANKER'S ALGORITHM (Week 11)

     Deadlock avoidance. The philosophers next door show deadlock
     happening; this shows the system refusing to let it happen, by
     never entering a state from which some completion order isn't
     still available.
     ============================================================ */

  /** Parse "3 3 2" into [3,3,2]; returns null if anything isn't a number. */
  function bkVec(s) {
    var v = String(s).trim().split(/[\s,]+/).filter(function (x) { return x !== ''; }).map(Number);
    return v.length && !v.some(isNaN) ? v : null;
  }

  /** Parse a matrix, one process per line. Every row must be the same width. */
  function bkMatrix(s, width) {
    var rows = String(s).trim().split(/\n+/).map(bkVec);
    if (!rows.length || rows.some(function (r) { return !r; })) return null;
    if (width && rows.some(function (r) { return r.length !== width; })) return null;
    if (rows.some(function (r) { return r.length !== rows[0].length; })) return null;
    return rows;
  }

  /**
   * The safety algorithm.
   *
   * Repeatedly look for a process whose remaining need can be met from what is
   * free right now. Pretend it runs to completion and hands everything back,
   * then look again. If every process can be retired this way the state is
   * safe, and the order found is a sequence that is guaranteed to work.
   *
   * @returns {{safe, sequence, steps, need}}
   */
  function bkSafe(available, max, alloc) {
    var n = alloc.length, m = available.length;
    var need = alloc.map(function (row, i) {
      return row.map(function (a, j) { return max[i][j] - a; });
    });

    var work = available.slice();
    var finished = new Array(n).fill(false);
    var sequence = [], steps = [];

    for (var pass = 0; pass < n; pass++) {
      var picked = -1;
      for (var i = 0; i < n; i++) {
        if (finished[i]) continue;
        var ok = true;
        for (var j = 0; j < m; j++) if (need[i][j] > work[j]) { ok = false; break; }
        if (ok) { picked = i; break; }
      }
      if (picked < 0) break;

      var before = work.slice();
      for (var k = 0; k < m; k++) work[k] += alloc[picked][k];
      finished[picked] = true;
      sequence.push(picked);
      steps.push({ pid: picked, need: need[picked].slice(), before: before, after: work.slice() });
    }

    var stuck = [];
    for (var q = 0; q < n; q++) if (!finished[q]) stuck.push(q);

    return { safe: stuck.length === 0, sequence: sequence, steps: steps, need: need, stuck: stuck, work: work };
  }

  /**
   * Should a request be granted?
   *
   * Three tests, in order, and the order matters: a request beyond the stated
   * maximum is an error, a request beyond what is free must wait, and a request
   * that could be met but would leave an unsafe state is refused even though
   * the resources are sitting there. That last case is the whole idea.
   */
  function bkRequest(available, max, alloc, pid, req) {
    var m = available.length;
    var need = max[pid].map(function (x, j) { return x - alloc[pid][j]; });

    for (var j = 0; j < m; j++) {
      if (req[j] > need[j]) {
        return { verdict: 'error', why: 'P' + pid + ' asked for more than it declared it would ever need.' };
      }
    }
    for (var k = 0; k < m; k++) {
      if (req[k] > available[k]) {
        return { verdict: 'wait', why: 'Not enough free right now — P' + pid + ' blocks until another process releases.' };
      }
    }

    var avail2 = available.map(function (a, j) { return a - req[j]; });
    var alloc2 = alloc.map(function (r, i) {
      return i === pid ? r.map(function (a, j) { return a + req[j]; }) : r.slice();
    });
    var after = bkSafe(avail2, max, alloc2);

    return after.safe
      ? { verdict: 'grant', why: 'The state after granting is still safe.', after: after }
      : { verdict: 'refuse', why: 'The resources are free, but granting would leave a state with no safe sequence, so the banker says no.', after: after };
  }

  /* ---------- render ---------- */

  function runBankers() {
    var out = document.getElementById('bk-output');
    if (!out) return;

    var avail = bkVec((document.getElementById('bk-avail') || {}).value || '');
    if (!avail) { out.innerHTML = '<div class="tool-error">Available should be numbers, e.g. <code>3 3 2</code>.</div>'; return; }

    var max = bkMatrix((document.getElementById('bk-max') || {}).value || '', avail.length);
    if (!max) { out.innerHTML = '<div class="tool-error">Max needs one row per process, each with ' + avail.length + ' numbers.</div>'; return; }

    var alloc = bkMatrix((document.getElementById('bk-alloc') || {}).value || '', avail.length);
    if (!alloc) { out.innerHTML = '<div class="tool-error">Allocation needs one row per process, each with ' + avail.length + ' numbers.</div>'; return; }

    if (alloc.length !== max.length) {
      out.innerHTML = '<div class="tool-error">Max has ' + max.length + ' processes but Allocation has ' + alloc.length + '.</div>';
      return;
    }
    for (var i = 0; i < alloc.length; i++) {
      for (var j = 0; j < avail.length; j++) {
        if (alloc[i][j] > max[i][j]) {
          out.innerHTML = '<div class="tool-error">P' + i + ' already holds more of resource ' +
            String.fromCharCode(65 + j) + ' than its stated maximum.</div>';
          return;
        }
      }
    }

    var res = bkSafe(avail, max, alloc);
    BK.res = res;

    var letters = avail.map(function (_, j) { return String.fromCharCode(65 + j); });
    var html = '';

    // Need = Max − Allocation
    html += '<table class="results-table"><tr><th>Process</th><th>Allocation</th><th>Max</th><th>Need = Max − Alloc</th></tr>';
    alloc.forEach(function (row, i) {
      html += '<tr><td><strong>P' + i + '</strong></td><td>' + row.join(' ') + '</td><td>' +
        max[i].join(' ') + '</td><td><strong>' + res.need[i].join(' ') + '</strong></td></tr>';
    });
    html += '<tr class="awt-row"><td colspan="3">Available (' + letters.join(' ') + ')</td><td><strong>' +
      avail.join(' ') + '</strong></td></tr></table>';

    // the trace
    html += '<div class="xl-walk">';
    res.steps.forEach(function (s, i) {
      html += '<div class="xl-step"><span class="xl-step-n">' + (i + 1) + '</span><span class="xl-step-body">' +
        '<strong>P' + s.pid + '</strong> needs ' + s.need.join(' ') + ', work is ' + s.before.join(' ') +
        ' → it can finish.<br><span class="tool-note">It returns everything it holds, so work becomes ' +
        s.after.join(' ') + '.</span></span></div>';
    });
    if (!res.safe) {
      html += '<div class="xl-step miss"><span class="xl-step-n">×</span><span class="xl-step-body">' +
        'Stuck with work = ' + res.work.join(' ') + '.<br><span class="tool-note">' +
        res.stuck.map(function (p) { return 'P' + p + ' needs ' + res.need[p].join(' '); }).join('; ') +
        ' — none of them can be satisfied, so no safe sequence exists.</span></span></div>';
    }
    html += '</div>';

    html += res.safe
      ? '<p class="xl-result">Safe. One sequence that works: <strong>' +
        res.sequence.map(function (p) { return 'P' + p; }).join(' → ') + '</strong></p>'
      : '<p class="xl-result miss">Unsafe state. There is no order in which every process is guaranteed to finish.</p>';

    // an optional request on top of the current state
    var pid = parseInt((document.getElementById('bk-pid') || {}).value, 10);
    var reqRaw = ((document.getElementById('bk-req') || {}).value || '').trim();
    if (reqRaw) {
      var req = bkVec(reqRaw);
      if (!req || req.length !== avail.length) {
        html += '<p class="tool-note">The request needs ' + avail.length + ' numbers, one per resource type.</p>';
      } else if (isNaN(pid) || pid < 0 || pid >= alloc.length) {
        html += '<p class="tool-note">Pick a process between 0 and ' + (alloc.length - 1) + '.</p>';
      } else {
        var v = bkRequest(avail, max, alloc, pid, req);
        var label = { grant: 'Granted', wait: 'Must wait', refuse: 'Refused', error: 'Invalid' }[v.verdict];
        html += '<div class="bk-verdict ' + v.verdict + '"><strong>P' + pid + ' requests ' + req.join(' ') +
          ' → ' + label + '.</strong><br>' + v.why;
        if (v.after && v.after.safe) {
          html += '<br>New safe sequence: ' + v.after.sequence.map(function (p) { return 'P' + p; }).join(' → ');
        }
        html += '</div>';
      }
    }

    html += '<p class="tool-note">Safe does not mean deadlock is impossible in general — it means deadlock is ' +
      'impossible <em>from here</em>, because at least one completion order survives. The banker refuses any ' +
      'request that would cost it that guarantee, even when the resources are free.</p>';

    out.innerHTML = html;
  }

  var BK = { res: null };
  window.BK = BK;
  window.bkSafe = bkSafe;
  window.bkRequest = bkRequest;
