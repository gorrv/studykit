  /* ============================================================
     TOOL 18 (W9): SUBSTITUTION APPLIER
     ============================================================ */
  function sbParseSigma(s) {
    const pairs = []; let d = 0, cur = '';
    for (const ch of s) {
      if ('(['.includes(ch)) d++; if (')]'.includes(ch)) d--;
      if (ch === ',' && d === 0) { pairs.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) pairs.push(cur);
    const sigma = [];
    pairs.forEach(p => {
      const t = p.trim(); if (!t) return;
      const i = t.indexOf('->');
      if (i < 0) throw new Error('Bad mapping "' + t + '" — write it as  X -> g(Y)');
      const v = t.slice(0, i).trim();
      if (!/^[A-Z_][A-Za-z0-9_]*$/.test(v)) throw new Error('"' + v + '" is not a variable — only variables can be replaced');
      sigma.push({ v: v, t: plParse(t.slice(i + 2)) });
    });
    return sigma;
  }
  function sbApplySim(t, sigma) {                      // simultaneous
    switch (t.k) {
      case 'V': { const m = sigma.find(x => x.v === t.n); return m ? m.t : t; }
      case 'N': return t;
      case 'C': return { k: 'C', f: t.f, args: t.args.map(a => sbApplySim(a, sigma)) };
      default: return t;
    }
  }
  function sbPreset(w) {
    const T = document.getElementById('sb-term'), S = document.getElementById('sb-sigma');
    if (w === 'ex1') { T.value = 'f(f(X, g(a)), Y)'; S.value = 'X -> g(Y), Y -> a'; }
    else if (w === 'ex2') { T.value = '~p(X, X, f(g(a), Y))'; S.value = 'X -> f(a,b), Y -> Z, Z -> b'; }
    else if (w === 'trap') { T.value = 'f(X, Y)'; S.value = 'X -> Y, Y -> a'; }
    runSubst();
  }
  function runSubst() {
    const out = document.getElementById('sb-output');
    let lits, sigma;
    try { lits = lpParseClause(document.getElementById('sb-term').value); sigma = sbParseSigma(document.getElementById('sb-sigma').value); }
    catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    if (lits.length !== 1) { out.innerHTML = `<div class="tool-error">Give a single term or literal.</div>`; return; }
    const lit = lits[0];
    const show = a => (lit.neg ? '¬' : '') + plShow(a, 0);
    const sim = sbApplySim(lit.atom, sigma);
    // sequential (wrong) application, left to right
    let seq = lit.atom;
    sigma.forEach(m => { seq = sbApplySim(seq, [m]); });
    const sigmaTxt = '{' + sigma.map(m => m.v + ' ↦ ' + plShow(m.t, 0)).join(', ') + '}';
    const domTxt = '{' + sigma.map(m => m.v).join(', ') + '}';
    let html = '<div class="subst-grid">';
    html += `<span class="sg-lbl">t</span><span class="sg-val">${esc(show(lit.atom))}</span>`;
    html += `<span class="sg-lbl">σ</span><span class="sg-val">${esc(sigmaTxt)}</span>`;
    html += `<span class="sg-lbl">dom(σ)</span><span class="sg-val">${esc(domTxt)}</span>`;
    html += `<span class="sg-lbl">tσ</span><span class="sg-val res">${esc(show(sim))}</span>`;
    html += '</div>';
    const seqStr = show(seq), simStr = show(sim);
    if (seqStr !== simStr) {
      html += `<div class="verdict bad">💥 <strong>This is exactly the case to watch for.</strong> Applying the mappings <em>one after another</em>, left to right, would give
        <br><br><code style="font-size:14px;">${esc(seqStr)}</code><br><br>
        which is <strong>wrong</strong>. σ is a <em>set</em>, and all the replacements must happen <strong>at the same time</strong>, giving <code style="font-size:14px;">${esc(simStr)}</code>.</div>`;
    } else {
      html += `<div class="verdict safe">✓ Here sequential and simultaneous application happen to agree — but only because no variable introduced by one mapping is itself in dom(σ). Try <code>X -&gt; Y, Y -&gt; a</code> to break it.</div>`;
    }
    const unused = sigma.filter(m => !esc(plShow(lit.atom, 0)).includes(m.v));
    if (unused.length) {
      html += `<div style="font-size:13px; color:var(--ink-muted); margin-top:8px;">Note: ${unused.map(m => '<code>' + esc(m.v) + '</code>').join(', ')} ${unused.length === 1 ? 'does' : 'do'} not occur in t, so ${unused.length === 1 ? 'that mapping has' : 'those mappings have'} no effect — <em>variables that do not appear in the term are not affected by the application</em>.</div>`;
    }
    out.innerHTML = html;
  }
