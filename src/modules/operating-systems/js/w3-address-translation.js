  /* ============================================================
     TOOL 1: ADDRESS TRANSLATOR (Week 3)
     ============================================================ */

  // Default page table: page -> frame (matches the worked example: page 5 -> 0x1ffa)
  const defaultPT = { 0: null, 1: null, 2: null, 3: 0x2, 4: 0x4, 5: 0x1ffa, 6: null, 7: null };

  function runTranslate() {
    const out = document.getElementById('xl-output');
    const raw = document.getElementById('xl-vaddr').value.trim();
    const pageKB = parseInt(document.getElementById('xl-pagesize').value, 10);
    const width = parseInt(document.getElementById('xl-width').value, 10);

    // parse hex
    let vaddr;
    try {
      vaddr = raw.toLowerCase().startsWith('0x') ? parseInt(raw, 16) : parseInt(raw, 16);
      if (isNaN(vaddr)) throw new Error();
    } catch (e) {
      out.innerHTML = '<div class="tool-error">Could not parse the address. Use hex, e.g. 0x5123.</div>';
      return;
    }

    const pageBytes = pageKB * 1024;
    const offsetBits = Math.log2(pageBytes);
    const pBits = width - offsetBits;
    const maxAddr = Math.pow(2, width);

    if (vaddr >= maxAddr) {
      out.innerHTML = `<div class="tool-error">Address 0x${vaddr.toString(16)} exceeds the ${width}-bit address space (max 0x${(maxAddr-1).toString(16)}).</div>`;
      return;
    }

    const offset = vaddr & (pageBytes - 1);
    const pageNum = Math.floor(vaddr / pageBytes);

    // get frame from page table (use a small editable table; default mapping for low pages)
    let frame = defaultPT.hasOwnProperty(pageNum) ? defaultPT[pageNum] : null;

    const offsetHexDigits = Math.ceil(offsetBits / 4);

    let html = '';

    // bit breakdown
    html += '<div class="bits-display">';
    html += `<div class="bit-cell pbits">0x${pageNum.toString(16)}<small>page # p · ${pBits} bits</small></div>`;
    html += `<div class="bit-cell obits">0x${offset.toString(16).padStart(offsetHexDigits,'0')}<small>offset o · ${offsetBits} bits</small></div>`;
    html += '</div>';

    html += `<p style="text-align:center; font-size:13px; color:var(--ink-muted);">Page size ${pageKB}kB → offset is ${offsetBits} bits (low ${offsetHexDigits} hex digit${offsetHexDigits>1?'s':''}). Page number = upper ${pBits} bits.</p>`;

    // page table display (editable)
    html += '<div style="display:flex; gap:24px; align-items:flex-start; justify-content:center; flex-wrap:wrap; margin:16px 0;">';
    html += '<div><div style="font-family:\'IBM Plex Mono\',monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.1em; color:var(--ink-muted); text-align:center; margin-bottom:6px;">Page table (editable)</div><div class="pt-grid">';
    for (let i = 7; i >= 0; i--) {
      const f = defaultPT[i];
      const isHit = (i === pageNum);
      const valStr = (f === null || f === undefined) ? 'X' : f.toString(16);
      html += `<div class="pt-entry ${isHit ? 'highlight' : ''}">`;
      html += `<div class="idx">${i}</div>`;
      html += `<div class="frame ${(f===null||f===undefined)?'invalid':''}" contenteditable="true" data-page="${i}" oninput="editPT(this)" style="min-width:70px;">${valStr}</div>`;
      html += '</div>';
    }
    html += '</div></div>';

    // steps
    html += '<div style="font-family:\'IBM Plex Mono\',monospace; font-size:13px; max-width:320px;">';
    html += `<div class="translate-step"><span class="step-num">1</span><div>Split: page <strong>0x${pageNum.toString(16)}</strong>, offset <strong>0x${offset.toString(16)}</strong></div></div>`;
    if (frame === null || frame === undefined) {
      html += `<div class="translate-step"><span class="step-num" style="background:var(--accent-2);">!</span><div>Page <strong>0x${pageNum.toString(16)}</strong> is <strong style="color:var(--accent-2);">invalid (X)</strong> → page fault! The OS would trap this.</div></div>`;
      html += '</div></div>';
      html += '<div class="tool-error" style="text-align:center;">⚠ Page fault: this page isn\'t mapped. Edit the table to map it, or try a mapped page (3, 4, or 5).</div>';
      out.innerHTML = html;
      return;
    }
    html += `<div class="translate-step"><span class="step-num">2</span><div>Look up page ${pageNum} → frame <strong>0x${frame.toString(16)}</strong></div></div>`;
    html += `<div class="translate-step"><span class="step-num">3</span><div>Keep offset <strong>0x${offset.toString(16)}</strong> unchanged</div></div>`;
    html += `<div class="translate-step"><span class="step-num">4</span><div>Combine (f, o)</div></div>`;
    html += '</div></div>';

    const paddr = (frame * pageBytes) + offset;
    html += `<div class="paddr-result">physical address = 0x${paddr.toString(16)}</div>`;

    out.innerHTML = html;
  }

  function editPT(el) {
    const page = parseInt(el.getAttribute('data-page'), 10);
    const v = el.textContent.trim().toLowerCase();
    if (v === 'x' || v === '') {
      defaultPT[page] = null;
    } else {
      const f = parseInt(v, 16);
      defaultPT[page] = isNaN(f) ? null : f;
    }
  }

