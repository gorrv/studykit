  /* ============================================================
     GENERIC TOOL RESET
     Snapshots every input in every .tool on load, so "Reset tool"
     restores the original inputs (not just the output) and re-runs.
     ============================================================ */
  const TOOL_DEFAULTS = new WeakMap();
  function snapshotTools() {
    document.querySelectorAll('.tool').forEach(t => {
      const fields = [];
      t.querySelectorAll('input, textarea, select').forEach(el => {
        fields.push({ el: el, v: (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value });
      });
      TOOL_DEFAULTS.set(t, fields);
    });
  }
  /* explicit registry: the function each tool re-runs after a reset */
  const TOOL_RUNNERS = {
    feReset: feReset, runParse: runParse, runTS: runTS, scReset: scReset,
    runDangling: runDangling, runLoops: runLoops, runEvalOrder: runEvalOrder,
    smRunAll: smRunAll, ssRunAll: ssRunAll, runBigStep: runBigStep,
    runCompare: runCompare, runReduce: runReduce, runCompose: runCompose, runCurry: runCurry,
    runPatMatch: runPatMatch, runSfun: runSfun, runTyping: runTyping,
    runLpCheck: runLpCheck, runSubst: runSubst, runProlog: runProlog,
    runUnify: runUnify, runSLD: runSLD, qzNext: qzNext
  };
  function toolReset(btn) {
    const t = btn.closest('.tool');
    if (!t) return;
    const fields = TOOL_DEFAULTS.get(t);
    if (fields) fields.forEach(f => {
      if (f.el.type === 'checkbox' || f.el.type === 'radio') f.el.checked = f.v; else f.el.value = f.v;
    });
    const fn = TOOL_RUNNERS[t.getAttribute('data-run')];
    if (typeof fn === 'function') fn();
    if (t.scrollIntoView) t.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  /* initialise tools on load */
