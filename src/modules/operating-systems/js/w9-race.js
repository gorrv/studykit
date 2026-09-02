  /* ============================================================
     TOOL 9: RACE CONDITION SIMULATOR (Topic 08)
     ============================================================ */
  function runRace() {
    const iters = Math.max(1, Math.min(1000, parseInt(document.getElementById('race-iters').value, 10) || 20));
    const mode = document.getElementById('race-mode').value;
    const out = document.getElementById('race-output');

    // Model counter++ as READ, INC, WRITE per increment.
    // We simulate two threads. Each has a private register and a "program" of
    // (iters) increments, each = [READ, INC, WRITE].
    function makeOps(tid) {
      const ops = [];
      for (let i = 0; i < iters; i++) { ops.push({tid, op:'R'}); ops.push({tid, op:'I'}); ops.push({tid, op:'W'}); }
      return ops;
    }
    const t0 = makeOps(0), t1 = makeOps(1);

    // Build an execution order
    let order = [];
    if (mode === 'sequential') {
      order = t0.concat(t1);
    } else if (mode === 'synchronized') {
      // synchronized: each thread's full READ-INC-WRITE triple is atomic (a critical section).
      // Interleave at the granularity of whole increments, never mid-triple.
      const inc0 = [], inc1 = [];
      for (let i = 0; i < iters; i++) { inc0.push([t0[i*3],t0[i*3+1],t0[i*3+2]]); inc1.push([t1[i*3],t1[i*3+1],t1[i*3+2]]); }
      const max = Math.max(inc0.length, inc1.length);
      for (let i = 0; i < max; i++) { if (i < inc0.length) order.push(...inc0[i]); if (i < inc1.length) order.push(...inc1[i]); }
    } else if (mode === 'interleave') {
      // strict alternation by single op -> maximises lost updates
      const max = Math.max(t0.length, t1.length);
      for (let i = 0; i < max; i++) { if (i < t0.length) order.push(t0[i]); if (i < t1.length) order.push(t1[i]); }
    } else { // random
      let i0 = 0, i1 = 0;
      while (i0 < t0.length || i1 < t1.length) {
        if (i1 >= t1.length || (i0 < t0.length && Math.random() < 0.5)) order.push(t0[i0++]);
        else order.push(t1[i1++]);
      }
    }

    // Execute
    let counter = 0;
    const reg = {0: 0, 1: 0};
    let lostUpdates = 0;
    let lastWriteVal = 0;
    order.forEach(step => {
      if (step.op === 'R') reg[step.tid] = counter;
      else if (step.op === 'I') reg[step.tid] = reg[step.tid] + 1;
      else { // W
        // detect a lost update: writing a value <= current counter when another write happened in between
        if (reg[step.tid] <= counter && counter > 0) lostUpdates++;
        counter = reg[step.tid];
      }
    });

    const expected = iters * 2;
    const lost = expected - counter;

    let html = '';
    html += `<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">`;
    html += `<span class="pr-stat hits">Expected: ${expected}</span>`;
    html += `<span class="pr-stat ${counter === expected ? 'hits' : 'faults'}">Actual: ${counter}</span>`;
    if (lost > 0) html += `<span class="pr-stat faults">Lost updates: ${lost}</span>`;
    html += `</div>`;

    if (mode === 'sequential') {
      html += `<div class="smash-verdict safe">✓ Sequential execution: Thread-0 fully finishes, then Thread-1. No interleaving → no lost updates → counter = ${counter}. This is the result we naively expect, but real threads don't run this way.</div>`;
    } else if (mode === 'synchronized') {
      html += `<div class="smash-verdict safe">🔒 <strong>synchronized fixes it!</strong> Each <code>counter++</code> (READ→INC→WRITE) is now an atomic critical section — a thread can't be interrupted mid-operation. The threads still interleave between increments, but never <em>within</em> one. Result is reliably <strong>${counter} = ${expected}</strong> every time. This is mutual exclusion in action.</div>`;
    } else if (counter === expected) {
      html += `<div class="smash-verdict warn">By chance this run had no lost updates (counter = ${counter}). Run it again — with interleaving, results vary and are usually wrong. That non-determinism IS the race condition.</div>`;
    } else {
      html += `<div class="smash-verdict pwned">💥 Race condition! ${lost} update${lost>1?'s were':' was'} lost — two threads read the same value, incremented, and one overwrote the other. The counter reached <strong>${counter}</strong> instead of <strong>${expected}</strong>. Re-run for a different (still wrong) answer — the result depends on timing, not logic.</div>`;
    }

    // show a short trace for small iteration counts
    if (iters <= 6) {
      html += `<p style="font-size:12px; color:var(--ink-muted); margin-top:10px;">Step-by-step trace:</p>`;
      html += `<table class="race-table"><tr><th>Step</th><th>Thread-0</th><th>Thread-1</th><th>counter</th></tr>`;
      let c = 0; const r = {0:0,1:0};
      const opName = {R:'READ', I:'INC', W:'WRITE'};
      order.forEach((step, idx) => {
        if (step.op === 'R') r[step.tid] = c;
        else if (step.op === 'I') r[step.tid]++;
        else c = r[step.tid];
        const desc = step.op === 'R' ? `READ → reg=${r[step.tid]}` : step.op === 'I' ? `INC → reg=${r[step.tid]}` : `WRITE → ${r[step.tid]}`;
        html += `<tr><td>${idx+1}</td><td class="${step.tid===0?'race-t0':''}">${step.tid===0?desc:''}</td><td class="${step.tid===1?'race-t1':''}">${step.tid===1?desc:''}</td><td class="race-counter">${c}</td></tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p style="font-size:12px; color:var(--ink-muted); margin-top:8px;">💡 Tip: set increments to ≤6 to see a full step-by-step READ/INC/WRITE trace.</p>`;
    }

    out.innerHTML = html;
  }

