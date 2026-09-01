  /* ============================================================
     TOOL 5: PAGE REPLACEMENT SIMULATOR (Week 4)
     ============================================================ */
  let prState = null;

  function prInit() {
    const refsRaw = document.getElementById('pr-refs').value.trim();
    const refs = refsRaw.split(/[\s,]+/).filter(x => x !== '').map(Number);
    const numFrames = Math.max(1, Math.min(8, parseInt(document.getElementById('pr-numframes').value,10) || 3));
    const algo = document.getElementById('pr-algo').value;
    prState = { refs, numFrames, algo, frames: [], clockBits: {}, hand: 0, pos: 0, faults: 0, hits: 0, history: [] };
  }

  function prStepLogic() {
    const s = prState;
    if (s.pos >= s.refs.length) return false;
    const r = s.refs[s.pos];
    let isFault, victim = null;

    if (s.frames.includes(r)) {
      isFault = false; s.hits++;
      if (s.algo === 'lru') { s.frames = s.frames.filter(x=>x!==r); s.frames.push(r); }
      if (s.algo === 'clock') s.clockBits[r] = 1;
    } else {
      isFault = true; s.faults++;
      if (s.frames.length < s.numFrames) {
        s.frames.push(r);
        if (s.algo === 'clock') s.clockBits[r] = 1;
      } else if (s.algo === 'fifo' || s.algo === 'lru') {
        victim = s.frames.shift(); s.frames.push(r);
      } else if (s.algo === 'opt') {
        // evict the page used furthest in the future (or never)
        let bestIdx = 0, bestDist = -1;
        for (let fi = 0; fi < s.frames.length; fi++) {
          const pg = s.frames[fi];
          let dist = Infinity;
          for (let k = s.pos + 1; k < s.refs.length; k++) {
            if (s.refs[k] === pg) { dist = k; break; }
          }
          if (dist > bestDist) { bestDist = dist; bestIdx = fi; }
        }
        victim = s.frames[bestIdx];
        s.frames[bestIdx] = r;
      } else if (s.algo === 'clock') {
        while (true) {
          const cand = s.frames[s.hand];
          if (s.clockBits[cand] === 0) { victim = cand; s.frames[s.hand] = r; delete s.clockBits[cand]; s.clockBits[r] = 1; s.hand = (s.hand+1)%s.numFrames; break; }
          else { s.clockBits[cand] = 0; s.hand = (s.hand+1)%s.numFrames; }
        }
      }
    }
    s.history.push({r, isFault, victim});
    s.pos++;
    return true;
  }

  function prRender() {
    const s = prState;
    const out = document.getElementById('pr-output');
    let html = '';

    // reference string with progress
    html += '<div class="pr-refstring">';
    s.refs.forEach((r, i) => {
      let cls = '';
      if (i < s.pos) { const h = s.history[i]; cls = h.isFault ? 'done-fault' : 'done-hit'; }
      else if (i === s.pos) cls = 'current';
      html += `<div class="pr-ref ${cls}">${r}</div>`;
    });
    html += '</div>';

    // current frames
    const last = s.history[s.history.length-1];
    html += '<div class="pr-frames">';
    for (let i = 0; i < s.numFrames; i++) {
      const v = s.frames[i];
      if (v === undefined) { html += '<div class="pr-frame empty">·</div>'; }
      else {
        let cls = '';
        if (last && !last.isFault && last.r === v) cls = 'hit';
        else if (last && last.isFault && last.r === v) cls = 'fault';
        const handMark = (s.algo === 'clock' && i === s.hand) ? ' style="box-shadow:0 0 0 2px var(--accent-2);"' : '';
        const ub = (s.algo === 'clock' && s.clockBits[v] !== undefined) ? `<sub style="font-size:9px;">U${s.clockBits[v]}</sub>` : '';
        html += `<div class="pr-frame ${cls}"${handMark}>${v}${ub}</div>`;
      }
    }
    html += '</div>';

    // status of last action
    if (last) {
      if (last.isFault) {
        html += `<p style="font-size:13px; margin:6px 0;">Accessed <strong>${last.r}</strong> → <span style="color:var(--accent-2);">PAGE FAULT</span>${last.victim!==null?` → evicted <strong>${last.victim}</strong>`:' → loaded into free frame'}.</p>`;
      } else {
        html += `<p style="font-size:13px; margin:6px 0;">Accessed <strong>${last.r}</strong> → <span style="color:var(--accent-3);">hit</span> (already resident).</p>`;
      }
    }

    // stats
    html += `<div style="margin-top:10px;"><span class="pr-stat faults">Faults: ${s.faults}</span><span class="pr-stat hits">Hits: ${s.hits}</span>`;
    if (s.pos >= s.refs.length) {
      const total = s.hits + s.faults;
      const hitRate = ((s.hits/total)*100).toFixed(1);
      const faultRate = ((s.faults/total)*100).toFixed(1);
      // AMAT with TM=100ns, TD=10ms=10,000,000ns
      const pMiss = s.faults/total;
      const amat = (100 + pMiss * 10000000);
      const amatStr = amat >= 1000000 ? (amat/1000000).toFixed(3)+'ms' : amat >= 1000 ? (amat/1000).toFixed(1)+'µs' : amat.toFixed(0)+'ns';
      html += `<span class="pr-stat" style="background:var(--ink); color:var(--paper);">Done · hit rate ${hitRate}% · fault rate ${faultRate}%</span>`;
      html += `</div><div style="margin-top:8px; font-size:12px; color:var(--ink-muted); font-family:'IBM Plex Mono',monospace;">AMAT ≈ 100ns + ${pMiss.toFixed(3)} × 10ms = <strong>${amatStr}</strong> &nbsp;(T<sub>M</sub>=100ns, T<sub>D</sub>=10ms)</div>`;
    } else {
      html += '</div>';
    }

    out.innerHTML = html;
  }

  function prStep() {
    if (!prState || prState.pos >= prState.refs.length) prInit();
    prStepLogic();
    prRender();
  }
  function prRunAll() {
    prInit();
    while (prStepLogic()) {}
    prRender();
  }
  function prReset() { prInit(); document.getElementById('pr-output').innerHTML = '<p style="font-size:13px; color:var(--ink-muted);">Ready. Press Step or Run all.</p>'; }

