  /* ============================================================
     TOOL 4 (W2): STATIC vs DYNAMIC SCOPE RESOLVER
     main declares x:real · P1 declares x:integer · P2 declares nothing
     ============================================================ */
  const SC_DECL = { main: 'x : real', P1: 'x : integer', P2: null };
  const SC_PARENT = { main: null, P1: 'main', P2: 'main' };  // lexical nesting
  let scStack = ['main'];
  function scCall(p) { if (scStack.length < 7) scStack.push(p); scRender(); }
  function scReturn() { if (scStack.length > 1) scStack.pop(); scRender(); }
  function scReset() { scStack = ['main']; scRender(); }
  function scResolveStatic(proc) {
    // walk outwards through the lexical nesting
    let cur = proc;
    const path = [];
    while (cur) {
      path.push(cur);
      if (SC_DECL[cur]) return { owner: cur, decl: SC_DECL[cur], path: path };
      cur = SC_PARENT[cur];
    }
    return { owner: null, decl: null, path: path };
  }
  function scResolveDynamic(stack) {
    // walk down the call stack, most recent activation first
    const path = [];
    for (let i = stack.length - 1; i >= 0; i--) {
      path.push(stack[i]);
      if (SC_DECL[stack[i]]) return { owner: stack[i], decl: SC_DECL[stack[i]], path: path };
    }
    return { owner: null, decl: null, path: path };
  }
  function scRender() {
    const out = document.getElementById('sc-output');
    const top = scStack[scStack.length - 1];
    const st = scResolveStatic(top);
    const dy = scResolveDynamic(scStack);
    let html = '';
    // call chain
    html += `<div style="font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--ink-muted); margin-bottom:6px;">call chain: ${scStack.join(' → ')}</div>`;
    html += '<div class="res-pair" style="grid-template-columns: 1fr 1.4fr;">';
    // stack visual
    html += '<div><div style="font-family:\'IBM Plex Mono\',monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.1em; color:var(--ink-muted); margin-bottom:6px;">call stack (top = executing)</div><div class="callstack">';
    scStack.forEach((p, i) => {
      const isTop = i === scStack.length - 1;
      const d = SC_DECL[p];
      html += `<div class="frame ${isTop ? 'top' : ''}"><span>${p}${isTop ? '  ← executing' : ''}</span>`;
      html += `<span class="fr-decl ${d ? 'has' : ''}">${d ? 'declares ' + d : 'no x declared'}</span></div>`;
    });
    html += '</div></div>';
    // resolutions
    html += '<div>';
    html += `<div class="res-box static" style="margin-bottom:10px;"><h5>Static scope</h5>`;
    html += `<div class="res-answer" style="color:var(--accent);">x &nbsp;→&nbsp; ${st.owner}'s &nbsp;${st.decl}</div>`;
    html += `<p class="res-why">Search the program <em>text</em> outwards: ${st.path.join(' → ')}. `;
    html += (SC_DECL[top] ? `<strong>${top}</strong> declares x itself, so the reference is <strong>local</strong>.` : `<strong>${top}</strong> declares no x, so it resolves to the enclosing block — the reference is <strong>global</strong>.`);
    html += ` This never changes, whoever calls ${top}.</p></div>`;
    html += `<div class="res-box dynamic"><h5>Dynamic scope</h5>`;
    html += `<div class="res-answer" style="color:var(--accent-2);">x &nbsp;→&nbsp; ${dy.owner}'s &nbsp;${dy.decl}</div>`;
    html += `<p class="res-why">Search the <em>call stack</em> downwards: ${dy.path.join(' → ')}. The first activation declaring x is <strong>${dy.owner}</strong>.</p></div>`;
    html += '</div></div>';
    // verdict
    if (st.owner === dy.owner) {
      html += `<div class="verdict safe">✓ Both disciplines agree here: <strong>${st.owner}'s ${st.decl}</strong>. Agreement is the common case — you need the right call chain to expose the difference. Try <em>call P1</em> then <em>call P2</em>.</div>`;
    } else {
      html += `<div class="verdict bad">💥 They disagree. Static scope gives <strong>${st.owner}'s ${st.decl}</strong>; dynamic scope gives <strong>${dy.owner}'s ${dy.decl}</strong>. `;
      html += `The reference in ${top} is identical in both cases — only the <em>calling sequence</em> differs. Note the types differ too (<code>${st.decl.split(':')[1].trim()}</code> vs <code>${dy.decl.split(':')[1].trim()}</code>), which is exactly why <strong>static type-checking is impossible</strong> under dynamic scoping.</div>`;
    }
    out.innerHTML = html;
  }
