  /* ============================================================
     TOOL 4: BASE & LIMIT CHECKER (Week 3)
     ============================================================ */
  function parseHex(s) { s = s.trim().toLowerCase(); return s.startsWith('0x') ? parseInt(s,16) : parseInt(s,16); }

  function blCheck() {
    const out = document.getElementById('bl-output');
    const base = parseHex(document.getElementById('bl-base').value);
    const limit = parseHex(document.getElementById('bl-limit').value);
    const va = parseHex(document.getElementById('bl-vaddr').value);
    if ([base,limit,va].some(isNaN)) { out.innerHTML = '<div class="tool-error">Could not parse one of the hex values.</div>'; return; }

    const valid = va >= 0 && va < limit;
    const pct = Math.max(0, Math.min(100, (va / limit) * 100));
    const windowPct = 60; // visual width of the window in the bar

    let html = '<div class="bl-bar">';
    html += `<div class="bl-window" style="left:8%; width:${windowPct}%;">allowed window [0, 0x${limit.toString(16)})</div>`;
    // pointer position: within window if valid, beyond if not
    const ptrLeft = valid ? (8 + pct * windowPct/100) : (8 + windowPct + 8);
    html += `<div class="bl-pointer-label" style="left:${ptrLeft}%;">0x${va.toString(16)}</div>`;
    html += `<div class="bl-pointer" style="left:calc(${ptrLeft}% - 7px);"></div>`;
    html += '</div>';

    if (valid) {
      const phys = base + va;
      html += `<div class="mmu-check pass">✓ 0x${va.toString(16)} &lt; limit (0x${limit.toString(16)}) → physical = base + virtual = 0x${base.toString(16)} + 0x${va.toString(16)} = <strong>0x${phys.toString(16)}</strong></div>`;
    } else {
      html += `<div class="mmu-check fail">✗ 0x${va.toString(16)} ≥ limit (0x${limit.toString(16)}) → out of bounds → hardware interrupt → OS kills the process</div>`;
    }
    out.innerHTML = html;
  }

