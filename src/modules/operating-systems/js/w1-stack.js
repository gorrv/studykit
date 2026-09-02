  /* ============================================================
     TOOL 3: STACK VISUALISER (Topic 01)
     ============================================================ */
  let stack = [];
  let stkLog = [];

  function stkRender() {
    const viz = document.getElementById('stk-viz');
    if (!viz) return;
    if (stack.length === 0) {
      viz.innerHTML = '<div class="stack-empty">— stack empty —</div>';
    } else {
      viz.innerHTML = stack.map((v, i) => {
        const isTop = i === stack.length - 1;
        return `<div class="stack-frame ${isTop ? 'sp-marker' : ''}"><span>${v}</span><span style="color:var(--ink-muted);">${isTop ? '← SP (top)' : ''}</span></div>`;
      }).join('');
    }
    const log = document.getElementById('stk-log');
    if (log) log.innerHTML = stkLog.slice(-8).map(l => `<div>${l}</div>`).join('');
  }

  function stkPush() {
    const v = document.getElementById('stk-val').value.trim() || '?';
    if (stack.length >= 8) { stkLog.push('⚠ stack full (max 8 for display)'); stkRender(); return; }
    stack.push(v);
    stkLog.push(`push ${v} → SP moves up`);
    stkRender();
  }
  function stkPop() {
    if (stack.length === 0) { stkLog.push('⚠ pop on empty stack!'); stkRender(); return; }
    const v = stack.pop();
    stkLog.push(`pop → got ${v} back, SP moves down`);
    stkRender();
  }
  function stkClear() { stack = []; stkLog = ['cleared']; stkRender(); }

  async function stkDemo() {
    stack = []; stkLog = ['▶ tri(3): each call pushes its N, then unwinds adding up']; stkRender();
    const seq = [
      ['push','tri(3): save N=3'], ['push','tri(2): save N=2'], ['push','tri(1): base case, N=1'],
      ['pop','return 1, add N=2 → 3'], ['pop','return 3, add N=3 → 6'], ['pop','return 6 = tri(3) ✓']
    ];
    for (const [op, msg] of seq) {
      await new Promise(r => setTimeout(r, 750));
      if (op === 'push') stack.push(msg.match(/N=(\d)/) ? 'N=' + msg.match(/N=(\d)/)[1] : '?');
      else stack.pop();
      stkLog.push(msg);
      stkRender();
    }
  }

