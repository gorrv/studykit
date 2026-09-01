  /* ============================================================
     SECTION SWITCHING
     ============================================================ */
  function showWeek(id) {
    document.querySelectorAll('.week-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) { target.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }
