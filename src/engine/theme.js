  /* ============================================================
     THEME
     Light and dark. The chosen theme is written to localStorage under
     one key for the whole site, so it follows the reader from module
     to module. The <head> boot script reads the same key before first
     paint, which is what stops the white flash on a dark-theme load.
     ============================================================ */
  var THEME_KEY = 'studykit-theme';

  function applyThemeLabel() {
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Dark' : 'Light';
    var el = document.getElementById('tt-label');
    if (el) el.textContent = cur;
  }

  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyThemeLabel();
  }
