  /* ============================================================
     TOOL 5 (W2): DANGLING ELSE
     ============================================================ */
  function runDangling() {
    const sum = parseInt(document.getElementById('de-sum').value, 10) || 0;
    const count = parseInt(document.getElementById('de-count').value, 10) || 0;
    const out = document.getElementById('de-output');
    // Reading A (Java rule): else pairs with the INNER if
    let a = null, aWhy = '';
    if (sum === 0) {
      if (count === 0) { a = 0; aWhy = 'sum == 0 ✓ → count == 0 ✓ → result = 0'; }
      else { a = 1; aWhy = 'sum == 0 ✓ → count == 0 ✗ → else → result = 1'; }
    } else { a = null; aWhy = 'sum == 0 ✗ → the whole statement is skipped → result is never assigned'; }
    // Reading B: else pairs with the OUTER if
    let b = null, bWhy = '';
    if (sum === 0) {
      if (count === 0) { b = 0; bWhy = 'sum == 0 ✓ → count == 0 ✓ → result = 0'; }
      else { b = null; bWhy = 'sum == 0 ✓ → count == 0 ✗ → inner if has no else → result is never assigned'; }
    } else { b = 1; bWhy = 'sum == 0 ✗ → else → result = 1'; }
    const fmt = v => v === null ? '<span style="color:var(--ink-muted);">unassigned</span>' : v;
    // code rendering with active-branch highlighting
    function codeA() {
      const l1 = sum === 0 ? 'on' : 'off';
      const l2 = (sum === 0) ? (count === 0 ? 'on' : 'off') : 'off';
      const l3 = (sum === 0 && count === 0) ? 'hit' : 'off';
      const l4 = (sum === 0 && count !== 0) ? 'on' : 'off';
      const l5 = (sum === 0 && count !== 0) ? 'hit' : 'off';
      return `<div class="codelines">
<div class="cl ${l1}"><span class="kw">if</span> (sum == 0)</div>
<div class="cl ${l2}">    <span class="kw">if</span> (count == 0)</div>
<div class="cl ${l3}">        result = 0;</div>
<div class="cl ${l4}">    <span class="kw">else</span>          <span class="cm">// belongs to the INNER if</span></div>
<div class="cl ${l5}">        result = 1;</div>
</div>`;
    }
    function codeB() {
      const l1 = sum === 0 ? 'on' : 'off';
      const l2 = (sum === 0) ? (count === 0 ? 'on' : 'off') : 'off';
      const l3 = (sum === 0 && count === 0) ? 'hit' : 'off';
      const l4 = sum !== 0 ? 'on' : 'off';
      const l5 = sum !== 0 ? 'hit' : 'off';
      return `<div class="codelines">
<div class="cl ${l1}"><span class="kw">if</span> (sum == 0) {</div>
<div class="cl ${l2}">    <span class="kw">if</span> (count == 0)</div>
<div class="cl ${l3}">        result = 0;</div>
<div class="cl ${l4}">} <span class="kw">else</span>            <span class="cm">// belongs to the OUTER if</span></div>
<div class="cl ${l5}">    result = 1;</div>
</div>`;
    }
    let html = '<div class="res-pair">';
    html += `<div class="res-box static"><h5>Reading A — Java's rule</h5>
      <div style="font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.1em; color:var(--ink-muted); margin-bottom:2px;">else ↔ most recent unpaired then</div>
      ${codeA()}<div class="res-answer">result = ${fmt(a)}</div><p class="res-why">${aWhy}</p></div>`;
    html += `<div class="res-box dynamic"><h5>Reading B — what the indentation suggests</h5>
      <div style="font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.1em; color:var(--ink-muted); margin-bottom:2px;">requires braces in Java / begin-end in Algol 60</div>
      ${codeB()}<div class="res-answer">result = ${fmt(b)}</div><p class="res-why">${bWhy}</p></div>`;
    html += '</div>';
    if (a === b) {
      html += `<div class="verdict warn">⚠ For sum=${sum}, count=${count} both readings happen to give the same answer — but they are still <strong>different programs</strong>. Try <em>sum=1</em> or <em>sum=0, count=1</em> to make them disagree.</div>`;
    } else {
      html += `<div class="verdict bad">💥 The readings disagree: <strong>result = ${a === null ? 'unassigned' : a}</strong> under Java's rule vs <strong>result = ${b === null ? 'unassigned' : b}</strong> under the outer pairing. Identical characters, two parse trees, two meanings — the dangling else is an ambiguous grammar, and Java resolves it by decree.</div>`;
    }
    out.innerHTML = html;
  }
