  /* ============================================================
     TOOL 11 (W4): THREE SEMANTICS COMPARED
     ============================================================ */
  function runCompare() {
    const out = document.getElementById('cm-output');
    let P, s;
    try { P = smParse(document.getElementById('cm-prog').value); s = smParseMem(document.getElementById('cm-store').value); }
    catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    // 1. abstract machine (W3)
    let am = { steps: 0, store: null, note: '' };
    try {
      let cfg = { c: [P], r: [], m: s }, g = 0, stuck = null;
      while (g < 6000) {
        const nx = smStepCfg(cfg);
        if (nx === null) break;
        if (nx.stuck) { stuck = nx.stuck; break; }
        cfg = { c: nx.c, r: nx.r, m: nx.m }; g++;
        if (cfg.c.length === 0) break;
      }
      am.steps = g; am.store = cfg.m;
      am.note = stuck ? 'stuck' : (g >= 6000 ? 'did not terminate' : (cfg.c.length === 0 && cfg.r.length === 0 ? '⟨nil, nil, m′⟩' : 'ended with ' + cfg.r.length + ' on r'));
    } catch (e) { am.note = 'error'; }
    // 2. small-step
    let ss = { steps: 0, store: null, note: '' };
    try {
      let p = P, st = s, g = 0, blocked = null;
      while (g < 4000) {
        const r = ssStep(p, st);
        if (r === null) break;
        if (r.blocked) { blocked = r.why; break; }
        p = r.p; st = r.s; g++;
      }
      ss.steps = g; ss.store = st;
      ss.note = blocked ? 'blocked: ' + blocked : (g >= 4000 ? 'divergent' : '⟨' + smShow(p, false) + ', s′⟩');
    } catch (e) { ss.note = 'error'; }
    // 3. big-step
    let bs = { size: 0, store: null, note: '' };
    bsFresh = 0; bsBudget = 0;
    try { const r = bsEval(P, s); bs.size = infSize(r.deriv); bs.store = r.s; bs.note = '⟨' + smShow(r.v, false) + ', s′⟩'; }
    catch (e) { bs.note = e && e.bsErr ? 'no derivation' : 'error'; }
    const agree = am.store && ss.store && bs.store &&
      JSON.stringify(am.store) === JSON.stringify(ss.store) && JSON.stringify(ss.store) === JSON.stringify(bs.store);
    let html = '<table><tr><th>Semantics</th><th>Unit of progress</th><th>Count</th><th>Result</th><th>Final store</th></tr>';
    html += `<tr><td><strong>Abstract machine</strong> <span style="font-size:11px; color:var(--ink-muted);">(W3)</span></td>
      <td>⟨c, r, m⟩ transition</td><td><strong>${am.steps}</strong></td><td>${esc(am.note)}</td><td>${am.store ? stShow(am.store) : '—'}</td></tr>`;
    html += `<tr><td><strong>Small-step</strong></td><td>⟨P, s⟩ → ⟨P′, s′⟩</td><td><strong>${ss.steps}</strong></td><td>${esc(ss.note)}</td><td>${ss.store ? stShow(ss.store) : '—'}</td></tr>`;
    html += `<tr><td><strong>Big-step</strong></td><td>rule application in one ⇓ tree</td><td><strong>${bs.size || '—'}</strong></td><td>${esc(bs.note)}</td><td>${bs.store ? stShow(bs.store) : '—'}</td></tr>`;
    html += '</table>';
    if (agree) {
      html += `<div class="verdict safe">✓ All three agree on the final store — as they must, since they are three descriptions of <em>the same language</em>. What differs is the granularity: the abstract machine takes ${am.steps} steps (many of them pure phrase analysis), small-step takes ${ss.steps} (each doing part of the computation), and big-step produces a single judgement whose proof uses ${bs.size} rule applications.</div>`;
    } else {
      html += `<div class="verdict warn">The three do not all report a final store — that happens when the program is blocked or divergent. Note especially that big-step reports only "<em>no derivation</em>", while small-step can distinguish <strong>blocked</strong> from <strong>divergent</strong>.</div>`;
    }
    out.innerHTML = html;
  }
