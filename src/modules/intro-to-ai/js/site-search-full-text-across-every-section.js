  /* ============================================================
     SITE SEARCH — full text across every section
     Type in the sidebar box (or press Ctrl/Cmd+K, or "/") to
     search all weeks at once, including the ones not on screen.
     ============================================================ */
  var NS_SEL = 'h1, h2, h3, h4, p, li, td, th, pre, blockquote, .callout-label, .caption, ' +
               '.week-subtitle, .tool-desc, .gw-label, .qlab, .rpg-a, .term';
  var NS_SKIP = 'textarea, script, style, select, option, input, .tool-output, .search-results, nav';
  var nsIndex = null, nsHits = [], nsSel = -1, nsMarks = [], nsTerms = [];

  function nsEscRx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function nsEscHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function nsBuild() {
    var idx = [], seen = {};
    var secs = document.querySelectorAll('.week-section');
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      var h1 = sec.querySelector('.week-header h1');
      var eb = sec.querySelector('.week-eyebrow');
      var title = h1 ? h1.textContent.trim() : sec.id;
      var label = eb ? eb.textContent.trim() : title;
      var heading = '';
      var els = sec.querySelectorAll(NS_SEL);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (el.closest && el.closest(NS_SKIP)) continue;
        var tag = el.tagName.toLowerCase();
        var isHead = tag.charAt(0) === 'h' && tag.length === 2;
        var txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (isHead) heading = txt;
        if (!txt || txt.length < 2 || txt.length > 900) continue;
        var key = sec.id + '|' + txt;
        if (seen[key]) continue;
        seen[key] = 1;
        idx.push({ el: el, sec: sec.id, label: label, title: title,
                   head: isHead ? '' : heading, txt: txt, low: txt.toLowerCase(), isHead: isHead });
      }
    }
    nsIndex = idx;
    return idx;
  }
  function nsQuery(q) {
    if (!nsIndex) nsBuild();
    var terms = String(q).toLowerCase().split(/\s+/).filter(function (t) { return t.length > 0; });
    if (!terms.length) return { terms: terms, hits: [], total: 0 };
    var res = [];
    for (var i = 0; i < nsIndex.length; i++) {
      var e = nsIndex[i], ok = true, first = 1e9;
      for (var j = 0; j < terms.length; j++) {
        var p = e.low.indexOf(terms[j]);
        if (p < 0) { ok = false; break; }
        if (p < first) first = p;
      }
      if (!ok) continue;
      var score = first + (e.isHead ? -500 : 0) + (e.low.indexOf(terms[0]) === 0 ? -70 : 0) + i * 0.001;
      /* the cram sheet and practice pages summarise material taught elsewhere,
         so nudge them below the section that actually explains the thing */
      if (e.sec === 'cram' || e.sec === 'practice') score += 420;
      res.push({ e: e, score: score, first: first });
    }
    res.sort(function (a, b) { return a.score - b.score; });
    return { terms: terms, hits: res.slice(0, 60), total: res.length };
  }
  function nsSnippet(txt, first, terms) {
    var start = Math.max(0, first - 55), end = Math.min(txt.length, first + 135);
    if (start > 0) { var sp = txt.indexOf(' ', start); if (sp > -1 && sp < start + 15) start = sp + 1; }
    var s = (start > 0 ? '…' : '') + txt.slice(start, end) + (end < txt.length ? '…' : '');
    var rx = new RegExp('(' + terms.map(function (t) { return nsEscRx(nsEscHtml(t)); }).join('|') + ')', 'gi');
    return nsEscHtml(s).replace(rx, '<mark>$1</mark>');
  }
  function nsPlace() {
    var box = document.getElementById('ns-input'), panel = document.getElementById('ns-results');
    if (!box || !panel) return;
    var r = box.getBoundingClientRect();
    panel.style.left = Math.round(r.left) + 'px';
    panel.style.top = Math.round(r.bottom + 6) + 'px';
    panel.style.width = Math.round(Math.max(r.width, Math.min(400, window.innerWidth - r.left - 16))) + 'px';
  }
  function nsRender(q) {
    var panel = document.getElementById('ns-results');
    if (!panel) return;
    var R = nsQuery(q);
    nsHits = R.hits; nsTerms = R.terms; nsSel = -1;
    if (!R.terms.length) { nsClose(); return; }
    var h = '';
    if (!R.hits.length) {
      h = '<div class="sr-none">No match for <strong>' + nsEscHtml(q) + '</strong>.<br>' +
          'Try a single word, or part of one — the search is a plain substring match over every week.</div>';
    } else {
      h = '<div class="sr-meta">' + R.total + ' match' + (R.total === 1 ? '' : 'es') +
          (R.total > R.hits.length ? ' · showing first ' + R.hits.length : '') +
          ' · ↑↓ to move, ↵ to open</div>';
      for (var i = 0; i < R.hits.length; i++) {
        var e = R.hits[i].e;
        var crumb = nsEscHtml(e.label) + (e.head ? ' <span class="sep">›</span> ' + nsEscHtml(e.head) : '');
        h += '<button class="sr-item" onclick="nsGo(' + i + ')" onmousemove="nsHover(' + i + ')">' +
             '<div class="sr-crumb">' + crumb + '</div>' +
             '<div class="sr-snip">' + nsSnippet(e.txt, R.hits[i].first, R.terms) + '</div></button>';
      }
    }
    panel.innerHTML = h;
    panel.hidden = false;
    nsPlace();
  }
  function nsInput() {
    var box = document.getElementById('ns-input');
    if (!box) return;
    var v = box.value;
    var wrap = document.getElementById('ns-box');
    if (wrap) wrap.className = 'search-box' + (v ? ' filled' : '');
    nsRender(v);
  }
  function nsClose() {
    var panel = document.getElementById('ns-results');
    if (panel) { panel.hidden = true; panel.innerHTML = ''; }
    nsSel = -1;
  }
  function nsClear() {
    var box = document.getElementById('ns-input');
    if (box) { box.value = ''; box.focus(); }
    var wrap = document.getElementById('ns-box');
    if (wrap) wrap.className = 'search-box';
    nsUnmark();
    nsClose();
  }
  function nsFocus() {
    var box = document.getElementById('ns-input');
    if (box) { box.focus(); box.select(); nsInput(); }
  }
  function nsHover(i) { nsSelect(i, false); }
  function nsSelect(i, scroll) {
    var panel = document.getElementById('ns-results');
    if (!panel) return;
    var items = panel.querySelectorAll('.sr-item');
    if (!items.length) return;
    if (i < 0) i = items.length - 1;
    if (i >= items.length) i = 0;
    for (var k = 0; k < items.length; k++) items[k].className = 'sr-item' + (k === i ? ' sel' : '');
    nsSel = i;
    if (scroll && items[i].scrollIntoView) items[i].scrollIntoView({ block: 'nearest' });
  }
  function nsKey(ev) {
    var k = ev.key;
    if (k === 'Escape') { ev.preventDefault(); nsClear(); return; }
    if (k === 'ArrowDown') { ev.preventDefault(); nsSelect(nsSel + 1, true); return; }
    if (k === 'ArrowUp') { ev.preventDefault(); nsSelect(nsSel - 1, true); return; }
    if (k === 'Enter') { ev.preventDefault(); nsGo(nsSel < 0 ? 0 : nsSel); return; }
  }
  function nsUnmark() {
    for (var i = 0; i < nsMarks.length; i++) {
      var m = nsMarks[i], p = m.parentNode;
      if (!p) continue;
      p.replaceChild(document.createTextNode(m.textContent), m);
      if (p.normalize) p.normalize();
    }
    nsMarks = [];
  }
  function nsMark(root, terms) {
    if (!root || !terms.length || !document.createTreeWalker) return;
    var rx = new RegExp('(' + terms.map(nsEscRx).join('|') + ')', 'gi');
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    for (var i = 0; i < nodes.length && nsMarks.length < 500; i++) {
      var node = nodes[i], v = node.nodeValue;
      if (!v || !v.trim()) continue;
      var par = node.parentElement;
      if (!par || (par.closest && par.closest(NS_SKIP))) continue;
      if (par.tagName === 'MARK') continue;
      rx.lastIndex = 0;
      if (!rx.test(v)) continue;
      rx.lastIndex = 0;
      var frag = document.createDocumentFragment(), last = 0, m;
      while ((m = rx.exec(v)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(v.slice(last, m.index)));
        var mk = document.createElement('mark');
        mk.className = 'ns-mark';
        mk.textContent = m[0];
        frag.appendChild(mk);
        nsMarks.push(mk);
        last = m.index + m[0].length;
        if (m[0].length === 0) rx.lastIndex++;
      }
      if (last < v.length) frag.appendChild(document.createTextNode(v.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }
  function nsGo(i) {
    var hit = nsHits[i];
    if (!hit) return;
    nsUnmark();
    if (typeof showWeek === 'function') showWeek(hit.e.sec);
    var sec = document.getElementById(hit.e.sec);
    if (sec) nsMark(sec, nsTerms);
    var el = hit.e.el;
    setTimeout(function () {
      if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el.classList) {
        el.classList.add('search-flash');
        setTimeout(function () { el.classList.remove('search-flash'); }, 2500);
      }
    }, 70);
    nsClose();
  }
  function nsInit() {
    nsBuild();
    document.addEventListener('keydown', function (ev) {
      var t = ev.target, tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
      var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable);
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) { ev.preventDefault(); nsFocus(); return; }
      if (ev.key === '/' && !typing) { ev.preventDefault(); nsFocus(); return; }
      if (ev.key === 'Escape' && !typing) { nsUnmark(); nsClose(); }
    });
    document.addEventListener('click', function (ev) {
      var panel = document.getElementById('ns-results'), box = document.getElementById('ns-box');
      if (!panel || panel.hidden) return;
      if ((box && box.contains(ev.target)) || panel.contains(ev.target)) return;
      nsClose();
    });
    window.addEventListener('resize', nsPlace);
    var aside = document.querySelector('aside');
    if (aside) aside.addEventListener('scroll', nsPlace);
    window.addEventListener('scroll', nsPlace, true);
  }
  document.addEventListener('DOMContentLoaded', nsInit);
  document.addEventListener('DOMContentLoaded', function () {
    snapshotTools();
    ixLive();
    IX.initReveal();
    applyThemeLabel();
    qzRender();
    try { runSearch(); runCompareAlgos(); runAdmissible(); } catch (e) {}
    try { runALab(); } catch (e) {}
    try { runGameTree(); runCSP(); runAC3(); } catch (e) {}
    try { runRPG(); runPlanner(); } catch (e) {}
    try { runVI(); runEU(); runSweep(); } catch (e) {}
    try { runSpread(); } catch (e) {}
    try { runCM(); runReg(); runFit(); } catch (e) {}
    try { runWCV(); runKM(); runHC(); } catch (e) {}
    try { runNorm(); runLSQ(); runGini(); } catch (e) {}
    try { runDT(); } catch (e) {}
    try { runHarm(); runBias(); runPrin(); } catch (e) {}
    try { runFair(); } catch (e) {}
    try { runBandit(); runQT(); runUCB(); } catch (e) {}
    try { runEG(); } catch (e) {}
    try { runExam(); } catch (e) {}
  });
