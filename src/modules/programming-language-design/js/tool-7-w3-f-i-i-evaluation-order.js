  /* ============================================================
     TOOL 7 (W3): f(i++, --i) EVALUATION ORDER
     ============================================================ */
  function runEvalOrder() {
    const i0 = parseInt(document.getElementById('eo-i').value, 10) || 0;
    const out = document.getElementById('eo-output');
    // left-to-right
    let i = i0, log1 = [], a1, a2;
    log1.push(['start', '—', i]);
    a1 = i; i = i + 1; log1.push(['i++  (1st arg)', 'returns old i = ' + a1, i]);
    i = i - 1; a2 = i; log1.push(['--i  (2nd arg)', 'returns new i = ' + a2, i]);
    const L = { a1: a1, a2: a2, fin: i, log: log1 };
    // right-to-left
    i = i0; let log2 = [], b1, b2;
    log2.push(['start', '—', i]);
    i = i - 1; b2 = i; log2.push(['--i  (2nd arg)', 'returns new i = ' + b2, i]);
    b1 = i; i = i + 1; log2.push(['i++  (1st arg)', 'returns old i = ' + b1, i]);
    const R = { a1: b1, a2: b2, fin: i, log: log2 };
    function tbl(x) {
      let h = '<table class="trace-table"><tr><th>evaluated</th><th>value passed to f</th><th>i afterwards</th></tr>';
      x.log.forEach(row => { h += `<tr><td class="body">${row[0]}</td><td>${row[1]}</td><td class="test-t">${row[2]}</td></tr>`; });
      h += '</table>';
      return h;
    }
    let html = '<div class="res-pair">';
    html += `<div class="res-box static"><h5>Left-to-right</h5>${tbl(L)}
      <div class="res-answer" style="color:var(--accent);">f(${L.a1}, ${L.a2})</div>
      <p class="res-why">final i = ${L.fin}</p></div>`;
    html += `<div class="res-box dynamic"><h5>Right-to-left</h5>${tbl(R)}
      <div class="res-answer" style="color:var(--accent-2);">f(${R.a1}, ${R.a2})</div>
      <p class="res-why">final i = ${R.fin}</p></div>`;
    html += '</div>';
    if (L.a1 === R.a1 && L.a2 === R.a2) {
      html += `<div class="verdict warn">For i = ${i0} the two orders happen to agree on the arguments. Try another starting value — the point stands regardless: <em>nothing in the definition of C says which order a compiler must use.</em></div>`;
    } else {
      html += `<div class="verdict bad">💥 Same source text, two legal answers: <strong>f(${L.a1}, ${L.a2})</strong> or <strong>f(${R.a1}, ${R.a2})</strong>. Both operators were precisely defined; what was missing is the <strong>order of evaluation of parameters</strong>, which the definition of C left unspecified — so different C compilers could generate very different code. Note that final <code>i</code> is ${L.fin} either way: the side-effects cancel, but the <em>values seen by f</em> do not.</div>`;
    }
    out.innerHTML = html;
  }
