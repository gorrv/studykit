  /* ============================================================
     W4 SHARED: store helpers, value tests, inference-tree rendering
     ============================================================ */
  function stShow(s) {
    const ks = Object.keys(s).sort();
    return ks.length ? '{' + ks.map(k => `${esc(k)}↦${s[k]}`).join(', ') + '}' : '{}';
  }
  function stSet(s, l, n) { const t = Object.assign({}, s); t[l] = n; return t; }
  const isNum  = p => p && p.k === 'num';
  const isBool = p => p && p.k === 'bool';
  const isVal  = p => isNum(p) || isBool(p);
  const isSkip = p => p && p.k === 'skip';
  /* an inference node: {rule, side, concl, prem:[...]}  */
  let INF_SEQ = 0;
  function infNumber(node) {
    /* post-order: a rule can only be applied once its premises are proved */
    if (!node) return;
    (node.prem || []).forEach(infNumber);
    node.__step = INF_SEQ++;
  }
  function infHtml(node, top) {
    if (!node) return '';
    if (top) { INF_SEQ = 0; infNumber(node); }
    let h = '<div class="inf' + (top ? ' hl' : '') + '"' + (node.__step === undefined ? '' : ' data-step="' + node.__step + '"') + '>';
    if (node.prem && node.prem.length) {
      h += '<div class="inf-prem">' + node.prem.map(p => infHtml(p, false)).join('') + '</div>';
    }
    h += '<div class="inf-rule"><span class="inf-line"></span>';
    if (node.rule) h += `<span class="inf-name">${esc(node.rule)}</span>`;
    h += '</div>';
    h += `<div class="inf-concl">${node.concl}</div>`;
    if (node.side) h += `<div class="inf-rule" style="margin-top:1px;"><span class="inf-side">${esc(node.side)}</span></div>`;
    h += '</div>';
    return h;
  }
  function infSize(n) { return n && n.prem ? 1 + n.prem.reduce((a, p) => a + infSize(p), 0) : 1; }
