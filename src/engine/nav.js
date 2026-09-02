  /* ============================================================
     SECTION SWITCHING
     Only one .topic-section is visible at a time. A module that needs to
     do something when a particular section appears — build a paper, seed
     a tool — pushes a handler onto NAV.onShow rather than editing this.
     ============================================================ */
  var NAV = { onShow: [], current: null };

  function showSection(id) {
    var all = document.querySelectorAll('.topic-section');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');

    var target = document.getElementById(id);
    if (!target) return;
    target.classList.add('active');
    NAV.current = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    for (var j = 0; j < NAV.onShow.length; j++) {
      // A misbehaving hook must not stop the section from opening.
      try { NAV.onShow[j](id); } catch (e) {}
    }
  }
