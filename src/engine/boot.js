  /* ============================================================
     BOOT
     One ordered start-up for every module. Anything a module needs on
     top of this pushes onto BOOT.after — the order below is fixed
     because each step depends on the one before it.
     ============================================================ */
  var BOOT = { after: [], errors: [] };

  function boot() {
    snapshotTools();   // capture pristine inputs before any tool edits them
    ixLive();          // wire live re-runs
    IX.initReveal();   // restore the reader's "how much lies ahead" choice
    applyThemeLabel();
    if (typeof nsInit === 'function') nsInit();   // search index + shortcuts
    toolBoot();        // render every tool once

    for (var i = 0; i < BOOT.after.length; i++) {
      try { BOOT.after[i](); } catch (e) { BOOT.errors.push(e.message); }
    }
  }

  document.addEventListener('DOMContentLoaded', boot);

  /* Exposed so the test suite — and anyone poking at the page in a browser
     console — can reach the engine's state without reading the source. */
  window.IX = IX;
  window.NAV = NAV;
  window.TOOL_RUNNERS = TOOL_RUNNERS;
  window.QZ_GEN = QZ_GEN;
  window.TOOL_BOOT_ERRORS = TOOL_BOOT_ERRORS;
  window.BOOT = BOOT;
  window.showSection = showSection;
  window.toggleTheme = toggleTheme;
  window.toolReset = toolReset;
