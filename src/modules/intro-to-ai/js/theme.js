  /* ============================================================
     THEME
     ============================================================ */
  function applyThemeLabel() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Dark' : 'Light';
    const el = document.getElementById('tt-label');
    if (el) el.textContent = cur;
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ai-theme', next); } catch (e) {}
    applyThemeLabel();
  }
