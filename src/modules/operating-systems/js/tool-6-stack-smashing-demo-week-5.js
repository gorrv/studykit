  /* ============================================================
     TOOL 6: STACK-SMASHING DEMO (Week 5)
     ============================================================ */
  function runSmash() {
    const input = document.getElementById('smash-input').value;
    const out = document.getElementById('smash-output');

    // Layout (high address at top, stack grows down):
    //   return address : 8 bytes  @ 0x7fffc8
    //   saved rbp      : 8 bytes  @ 0x7fffc0
    //   buf[10]        : 16 bytes (rounded) @ 0x7fffb0..0x7fffbf
    // scanf writes from buf upward (toward higher addresses), so it fills
    // buf, then saved rbp, then return address.
    const BUF = 10;        // declared buffer size
    const BUF_SLOT = 16;   // actual aligned space for buf
    const SAVED = 8;
    const RET = 8;
    const bytes = Array.from(input).map(c => c);

    // distribute bytes into regions
    const bufBytes = bytes.slice(0, BUF_SLOT);
    const savedBytes = bytes.slice(BUF_SLOT, BUF_SLOT + SAVED);
    const retBytes = bytes.slice(BUF_SLOT + SAVED, BUF_SLOT + SAVED + RET);
    const overflowExtra = bytes.length - (BUF_SLOT + SAVED + RET);

    function cell(addr, label, content, cls) {
      return `<div class="smash-cell"><div class="saddr">${addr}<span class="smash-label">${label}</span></div><div class="sval ${cls}">${content || '<span style="color:#bbb;">·</span>'}</div></div>`;
    }
    function fmt(arr, total) {
      let s = arr.map(c => c === ' ' ? '␣' : c).join(' ');
      const pad = total - arr.length;
      if (pad > 0) s += (s ? ' ' : '') + Array(pad).fill('<span style="color:#bbb;">·</span>').join(' ');
      return s;
    }

    let html = '<div class="smash-stack">';
    // return address (top, high addr)
    const retClass = retBytes.length > 0 ? (retBytes.length >= RET ? 'danger' : 'overwritten') : 'retaddr';
    html += cell('0x7fffc8', 'return address', retBytes.length > 0 ? fmt(retBytes, RET) : 'return addr in main', retClass);
    // saved rbp
    const savedClass = savedBytes.length > 0 ? 'overwritten' : 'saved';
    html += cell('0x7fffc0', 'saved rbp', savedBytes.length > 0 ? fmt(savedBytes, SAVED) : '(saved frame ptr)', savedClass);
    // buffer (show as two 8-byte rows)
    html += cell('0x7fffb8', 'buf[8..15]', fmt(bufBytes.slice(8,16), 8), 'buf');
    html += cell('0x7fffb0', 'buf[0..7]', fmt(bufBytes.slice(0,8), 8), 'buf');
    html += '</div>';

    // verdict
    if (bytes.length <= BUF) {
      html += `<div class="smash-verdict safe">✓ ${bytes.length} bytes — fits within buf[10]. No overflow. Program behaves normally.</div>`;
    } else if (retBytes.length === 0) {
      html += `<div class="smash-verdict warn">⚠ ${bytes.length} bytes — overflowed buf[10] into padding / saved frame pointer, but hasn't reached the return address yet. Likely corrupts local state (undefined behaviour) but control flow is intact.</div>`;
    } else if (retBytes.length < RET) {
      html += `<div class="smash-verdict warn">⚠ ${bytes.length} bytes — started overwriting the RETURN ADDRESS (${retBytes.length}/${RET} bytes). On return, the program will jump to a corrupted address → likely crash (segfault).</div>`;
    } else {
      html += `<div class="smash-verdict pwned">💀 ${bytes.length} bytes — the return address is FULLY overwritten${overflowExtra>0?' (and '+overflowExtra+' bytes beyond)':''}. When main returns, it jumps to attacker-controlled bytes. <strong>This is a successful stack smash.</strong></div>`;
      html += `<p style="font-size:12px; color:var(--ink-muted); margin-top:6px;">It took <strong>${BUF_SLOT + SAVED + 1}</strong> bytes to start hijacking control and <strong>${BUF_SLOT + SAVED + RET}</strong> to fully control the return address (16 buffer + 8 saved rbp + 8 return).</p>`;
    }

    out.innerHTML = html;
  }

