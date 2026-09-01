  /* ============================================================
     SHARED HELPERS
     ============================================================ */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* an inference node: {rule, side, concl, prem:[...]} — for derivation / proof trees */
  function infHtml(node, top) {
    if (!node) return '';
    let h = '<div class="inf' + (top ? ' hl' : '') + '">';
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
