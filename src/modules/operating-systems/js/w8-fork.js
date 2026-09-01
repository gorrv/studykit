  /* ============================================================
     TOOL 8: FORK() SIMULATOR (Week 8)
     ============================================================ */
  function runFork() {
    const n = parseInt(document.getElementById('fork-n').value, 10);
    const out = document.getElementById('fork-output');

    // After each fork, every existing process becomes two.
    // Track processes as labels; show how many print statements run.
    let procs = ['P0'];
    const stages = [{ after: 0, procs: [...procs] }];
    for (let i = 1; i <= n; i++) {
      const next = [];
      procs.forEach(p => {
        next.push(p);                 // parent continues
        next.push(p + '→c' + i);      // new child
      });
      procs = next;
      stages.push({ after: i, procs: [...procs] });
    }

    const total = Math.pow(2, n);
    let html = '';
    html += `<p style="font-size:14px;">After <strong>${n}</strong> fork() call${n>1?'s':''}, there are <strong>2<sup>${n}</sup> = ${total} processes</strong>. Each fork doubles the count, because every existing process (parent <em>and</em> previous children) executes the next fork.</p>`;

    html += '<div style="overflow-x:auto;">';
    stages.forEach(st => {
      const label = st.after === 0 ? 'start' : `after fork #${st.after}`;
      html += `<div style="display:flex; align-items:center; gap:10px; margin:6px 0;">`;
      html += `<div style="width:110px; font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--ink-muted);">${label}</div>`;
      html += `<div style="display:flex; gap:4px; flex-wrap:wrap;">`;
      st.procs.forEach(p => {
        const isChild = p.includes('→');
        html += `<div class="pr-frame ${isChild?'hit':''}" style="width:auto; min-width:40px; padding:0 8px; height:30px; font-size:11px;">${st.procs.length<=8?p:'•'}</div>`;
      });
      html += `</div><div style="font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--accent);">${st.procs.length} proc${st.procs.length>1?'s':''}</div>`;
      html += `</div>`;
    });
    html += '</div>';

    html += `<div class="smash-verdict safe" style="margin-top:12px;">💡 If each process ran <code>printf("hello\\n")</code> once <em>after</em> all the forks, you'd see <strong>${total}</strong> "hello" lines. Remember: in each process, fork() returned the child's PID (parent) or 0 (child) — that's how code tells which one it's in.</div>`;

    out.innerHTML = html;
  }

