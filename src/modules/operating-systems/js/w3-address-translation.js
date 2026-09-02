  /* ============================================================
     ADDRESS TRANSLATION (Topic 03)

     One virtual address, split into fields and walked through the page
     table. Single-level is the exam's worked example; two-level shows
     where the extra index comes from and why anyone would accept a
     second memory access to get it.
     ============================================================ */

  /* The worked example from the notes: page 5 lives in frame 0x1ffa.
     null means "not present" — a page fault. */
  var XL_PT = { 0: null, 1: null, 2: null, 3: 0x2, 4: 0x4, 5: 0x1ffa, 6: null, 7: null };

  /**
   * Split a virtual address into its fields.
   *
   * @param {number} vaddr
   * @param {number} width       address width in bits
   * @param {number} offsetBits  log2 of the page size
   * @param {number} levels      1 or 2
   * @returns {{offset, page, fields}} fields are high-order first
   */
  function xlSplit(vaddr, width, offsetBits, levels) {
    var offset = vaddr % Math.pow(2, offsetBits);
    var page = Math.floor(vaddr / Math.pow(2, offsetBits));
    var pageBits = width - offsetBits;

    if (levels === 1) {
      return {
        offset: offset, page: page,
        fields: [{ name: 'page number p', short: 'p', bits: pageBits, value: page }],
      };
    }

    // Split the page number as evenly as possible, the outer index taking
    // the extra bit when it does not divide.
    var innerBits = Math.floor(pageBits / 2);
    var outerBits = pageBits - innerBits;
    return {
      offset: offset, page: page,
      innerBits: innerBits, outerBits: outerBits,
      fields: [
        { name: 'directory index p₁', short: 'p₁', bits: outerBits, value: Math.floor(page / Math.pow(2, innerBits)) },
        { name: 'table index p₂', short: 'p₂', bits: innerBits, value: page % Math.pow(2, innerBits) },
      ],
    };
  }

  /** Walk the table(s) and report each lookup. */
  function xlWalk(split, levels) {
    var steps = [];
    if (levels === 1) {
      var f = XL_PT[split.page];
      steps.push({
        what: 'page table', index: split.page,
        found: (f === null || f === undefined) ? null : f,
        note: (f === null || f === undefined)
          ? 'entry not present — the MMU raises a page fault and the OS takes over'
          : 'frame number',
      });
    } else {
      var dir = split.fields[0].value, idx = split.fields[1].value;
      // Only directories containing a mapped page have an inner table at all.
      var present = Object.keys(XL_PT).some(function (p) {
        return XL_PT[p] !== null && Math.floor(p / Math.pow(2, split.innerBits)) === dir;
      });
      steps.push({
        what: 'page directory', index: dir,
        found: present ? 'inner table' : null,
        note: present
          ? 'points at a second-level table'
          : 'no second-level table allocated for this region — that is the space saving, and it faults',
      });
      if (present) {
        var page = dir * Math.pow(2, split.innerBits) + idx;
        var fr = XL_PT[page];
        steps.push({
          what: 'second-level table', index: idx,
          found: (fr === null || fr === undefined) ? null : fr,
          note: (fr === null || fr === undefined) ? 'entry not present — page fault' : 'frame number',
        });
      }
    }
    return steps;
  }

  function runTranslate() {
    var out = document.getElementById('xl-output');
    if (!out) return;

    var raw = (document.getElementById('xl-vaddr') || {}).value || '';
    var pageKB = parseInt((document.getElementById('xl-pagesize') || {}).value, 10) || 4;
    var width = parseInt((document.getElementById('xl-width') || {}).value, 10) || 32;
    var levels = parseInt((document.getElementById('xl-levels') || {}).value, 10) || 1;

    var vaddr = parseInt(raw.trim().replace(/^0x/i, ''), 16);
    if (isNaN(vaddr) || vaddr < 0) {
      out.innerHTML = '<div class="tool-error">Could not read that address. Use hex, e.g. 0x5123.</div>';
      return;
    }

    var pageBytes = pageKB * 1024;
    var offsetBits = Math.round(Math.log2(pageBytes));
    var maxAddr = Math.pow(2, width);

    if (vaddr >= maxAddr) {
      out.innerHTML = '<div class="tool-error">0x' + vaddr.toString(16) +
        ' does not fit in a ' + width + '-bit address space (max 0x' + (maxAddr - 1).toString(16) + ').</div>';
      return;
    }

    var split = xlSplit(vaddr, width, offsetBits, levels);
    var steps = xlWalk(split, levels);
    var offHex = Math.ceil(offsetBits / 4);

    var html = '<div class="bits-display">';
    split.fields.forEach(function (f, i) {
      html += '<div class="bit-cell ' + (i === 0 && levels === 2 ? 'dirbits' : 'pbits') + '">0x' +
        f.value.toString(16) + '<small>' + f.name + ' · ' + f.bits + ' bits</small></div>';
    });
    html += '<div class="bit-cell obits">0x' + split.offset.toString(16).padStart(offHex, '0') +
      '<small>offset d · ' + offsetBits + ' bits</small></div></div>';

    html += '<p class="tool-note" style="text-align:center;">A ' + pageKB + ' kB page needs ' + offsetBits +
      ' bits of offset, so the low ' + offHex + ' hex digit' + (offHex > 1 ? 's are' : ' is') +
      ' carried through untouched. The remaining ' + (width - offsetBits) + ' bits ' +
      (levels === 1 ? 'index the page table.'
        : 'are split ' + split.outerBits + ' / ' + split.innerBits + ' across the two levels.') + '</p>';

    // the walk
    html += '<div class="xl-walk">';
    steps.forEach(function (s, i) {
      var ok = s.found !== null;
      html += '<div class="xl-step' + (ok ? '' : ' miss') + '">' +
        '<span class="xl-step-n">' + (i + 1) + '</span>' +
        '<span class="xl-step-body"><strong>' + s.what + '</strong>[0x' + s.index.toString(16) + '] → ' +
        (ok ? (typeof s.found === 'number' ? 'frame 0x' + s.found.toString(16) : s.found) : '<em>invalid</em>') +
        '<br><span class="tool-note">' + s.note + '</span></span></div>';
    });
    html += '</div>';

    // the single-level table stays visible: it is the exam's worked example
    if (levels === 1) {
      html += '<div class="pt-grid">';
      for (var i = 7; i >= 0; i--) {
        var f = XL_PT[i];
        var val = (f === null || f === undefined) ? 'X' : f.toString(16);
        html += '<div class="pt-entry' + (i === split.page ? ' highlight' : '') + '">' +
          '<div class="idx">' + i + '</div>' +
          '<div class="frame' + (val === 'X' ? ' invalid' : '') + '">' + val + '</div></div>';
      }
      html += '</div>';
    }

    var last = steps[steps.length - 1];
    if (typeof last.found === 'number') {
      var phys = last.found * pageBytes + split.offset;
      html += '<p class="xl-result">Physical address = frame 0x' + last.found.toString(16) +
        ' × ' + pageKB + 'kB + offset 0x' + split.offset.toString(16) +
        ' = <strong>0x' + phys.toString(16) + '</strong></p>';
    } else {
      html += '<p class="xl-result miss">Page fault. The MMU cannot complete this translation; ' +
        'it traps to the OS, which loads the page and restarts the instruction.</p>';
    }

    // why anyone bothers with two levels
    var entries = Math.pow(2, width - offsetBits);
    var flatMB = (entries * 4) / 1024 / 1024;
    if (levels === 1) {
      html += '<p class="tool-note">A flat table needs one entry per page: 2<sup>' + (width - offsetBits) +
        '</sup> = ' + entries.toLocaleString() + ' entries. At 4 bytes each that is ' +
        (flatMB >= 1 ? flatMB.toFixed(0) + ' MB' : (flatMB * 1024).toFixed(0) + ' kB') +
        ' <em>per process</em>, whether or not the address space is actually used. Switch to two levels ' +
        'to see where that goes.</p>';
    } else {
      var outerSz = Math.pow(2, split.outerBits) * 4;
      var innerSz = Math.pow(2, split.innerBits) * 4;
      html += '<p class="tool-note">Two levels: a directory of 2<sup>' + split.outerBits + '</sup> entries (' +
        (outerSz / 1024).toFixed(outerSz >= 1024 ? 0 : 1) + ' kB) plus one ' +
        (innerSz / 1024).toFixed(innerSz >= 1024 ? 0 : 1) + ' kB table <em>for each region actually used</em>. ' +
        'A process touching only code, heap and stack allocates a handful instead of the full ' +
        (flatMB >= 1 ? flatMB.toFixed(0) + ' MB' : (flatMB * 1024).toFixed(0) + ' kB') + '. ' +
        'The cost is a second memory access per translation, which is why the TLB matters.</p>';
    }

    out.innerHTML = html;
  }

  window.XL_PT = XL_PT;
  window.xlSplit = xlSplit;
  window.xlWalk = xlWalk;
