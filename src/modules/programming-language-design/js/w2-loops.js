  /* ============================================================
     TOOL 6 (W2): LOOP TRACER — pre-test vs post-test
     ============================================================ */
  function lpTrace(kind, init, N) {
    const rows = [];
    let i = init, iters = 0, guard = 0;
    const cond = v => v < N;                 // the loop expression: i < N
    if (kind === 'while' || kind === 'for') {
      while (guard++ < 40) {
        const t = cond(i);
        rows.push({ phase: 'test', i: i, res: t });
        if (!t) break;
        i = i + 1; iters++;
        rows.push({ phase: 'body', i: i });
      }
    } else if (kind === 'do') {
      // post-test: body first, continue WHILE the expression is true
      while (guard++ < 40) {
        i = i + 1; iters++;
        rows.push({ phase: 'body', i: i });
        const t = cond(i);
        rows.push({ phase: 'test', i: i, res: t });
        if (!t) break;
      }
    } else if (kind === 'repeat') {
      // post-test: body first, stop WHEN the expression becomes true
      while (guard++ < 40) {
        i = i + 1; iters++;
        rows.push({ phase: 'body', i: i });
        const t = cond(i);
        rows.push({ phase: 'test', i: i, res: t });
        if (t) break;
      }
    }
    return { rows: rows, iters: iters, final: i, capped: guard >= 40 };
  }
  function lpTable(tr) {
    let html = '<table class="trace-table"><tr><th>step</th><th>phase</th><th>i</th><th>i &lt; N</th></tr>';
    tr.rows.slice(0, 16).forEach((r, k) => {
      if (r.phase === 'test') {
        html += `<tr data-step="${k}"><td>${k + 1}</td><td>test</td><td>${r.i}</td><td class="${r.res ? 'test-t' : 'test-f'}">${r.res ? 'True' : 'False'}</td></tr>`;
      } else {
        html += `<tr data-step="${k}"><td>${k + 1}</td><td class="body">body: i = i + 1</td><td class="body">${r.i}</td><td>—</td></tr>`;
      }
    });
    if (tr.rows.length > 16) html += `<tr><td colspan="4">… ${tr.rows.length - 16} more steps</td></tr>`;
    html += '</table>';
    return html;
  }
  function runLoops() {
    const init = parseInt(document.getElementById('lp-init').value, 10) || 0;
    const N = parseInt(document.getElementById('lp-n').value, 10) || 0;
    const out = document.getElementById('lp-output');
    const defs = [
      { k: 'while',  title: 'while',        kind: 'pre-test · logically-controlled', code: `i = ${init}; while (i &lt; ${N}) i = i + 1;`, cls: '' },
      { k: 'for',    title: 'for',          kind: 'pre-test · counter-controlled',   code: `for (i = ${init}; i &lt; ${N}; i++) ;`, cls: '' },
      { k: 'do',     title: 'do … while',   kind: 'post-test · runs while True',     code: `i = ${init}; do i = i + 1; while (i &lt; ${N});`, cls: 'post' },
      { k: 'repeat', title: 'repeat … until', kind: 'post-test · stops when True',   code: `i := ${init}; repeat i := i + 1 until (i &lt; ${N});`, cls: 'post' }
    ];
    const traces = defs.map(d => ({ d: d, t: lpTrace(d.k, init, N) }));
    let html = '<div style="margin-bottom:12px;">';
    traces.forEach(x => {
      const cls = x.t.iters === 0 ? 'a' : (x.t.capped ? 'c' : 'b');
      html += `<span class="stat-pill ${cls}">${x.d.title}: ${x.t.capped ? '∞' : x.t.iters} iteration${x.t.iters === 1 ? '' : 's'}</span>`;
    });
    html += '</div>';
    traces.forEach(x => {
      html += `<div class="loop-card ${x.d.cls}">`;
      html += `<div class="lc-kind">${x.d.kind}</div><h5>${x.d.title}</h5>`;
      html += `<div class="lc-code">${x.d.code}</div>`;
      html += lpTable(x.t);
      if (x.t.capped) {
        html += `<p style="font-size:13px; margin:6px 0 0 0; color:var(--accent-2);"><strong>Does not terminate</strong> — the condition never becomes what this construct needs to stop. Trace capped at 40 steps.</p>`;
      } else {
        html += `<p style="font-size:13px; margin:6px 0 0 0;">Body executed <strong>${x.t.iters}</strong> time${x.t.iters === 1 ? '' : 's'}; final i = <strong>${x.t.final}</strong>.</p>`;
      }
      html += '</div>';
    });
    // verdict
    const w = traces[0].t, d = traces[2].t, r = traces[3].t;
    if (init >= N) {
      html += `<div class="verdict bad">💥 The condition <code>i &lt; N</code> is <strong>False at the start</strong> — and this is where the classification bites. The pre-test loops (<code>while</code>, <code>for</code>) execute the body <strong>zero</strong> times; the post-test <code>do…while</code> executes it <strong>${d.iters}</strong> time${d.iters === 1 ? '' : 's'} before it can even check. <em>A post-test loop always runs its body at least once.</em></div>`;
    } else {
      html += `<div class="verdict warn">Note <code>do…while</code> and <code>repeat…until</code> use the <em>same</em> expression <code>i &lt; N</code> but are <strong>opposites</strong>: <code>do</code> continues <em>while</em> it is True, <code>repeat</code> stops <em>when</em> it becomes True. Here that gives ${d.capped ? '∞' : d.iters} vs ${r.capped ? '∞' : r.iters} iterations. Pre-test <code>while</code> gives ${w.capped ? '∞' : w.iters}.</div>`;
    }
    out.innerHTML = html;
    ixTrace('loT', 'lp-output', { label: 'trace row', reset: true });
  }
