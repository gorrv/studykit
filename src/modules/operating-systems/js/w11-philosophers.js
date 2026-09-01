  /* ============================================================
     TOOL 10: DINING PHILOSOPHERS (Week 11)
     ============================================================ */
  function runPhil() {
    const mode = document.getElementById('phil-mode').value;
    const out = document.getElementById('phil-output');
    const N = 5;

    // Each philosopher i wants two forks. In naive mode, philosopher i grabs
    // left = fork[i], then right = fork[(i+1)%N].
    // In fixed mode, the LAST philosopher grabs right first (reversed), which
    // breaks the circular wait.
    // first[i] = the fork philosopher i tries to grab FIRST.
    const firstFork = [], secondFork = [];
    for (let i = 0; i < N; i++) {
      const left = i;
      const right = (i + 1) % N;
      if (mode === 'fixed' && i === N - 1) { firstFork[i] = right; secondFork[i] = left; }
      else { firstFork[i] = left; secondFork[i] = right; }
    }

    // Simulate: every philosopher grabs their FIRST fork simultaneously.
    const forkOwner = new Array(N).fill(null);
    for (let i = 0; i < N; i++) {
      if (forkOwner[firstFork[i]] === null) forkOwner[firstFork[i]] = i;
    }
    // Now each tries their SECOND fork.
    const gotSecond = new Array(N).fill(false);
    for (let i = 0; i < N; i++) {
      if (forkOwner[firstFork[i]] === i && forkOwner[secondFork[i]] === null) {
        forkOwner[secondFork[i]] = i; gotSecond[i] = true;
      }
    }
    const eating = [];
    for (let i = 0; i < N; i++) if (gotSecond[i]) eating.push(i);
    const deadlock = eating.length === 0;

    // Build circular table visual. Positions around a circle.
    let html = '<div class="phil-tool">';
    html += '<div class="phil-table">';
    html += '<div class="phil-center">food</div>';
    const R = 120, cx = 150, cy = 150;
    // philosophers at angles, forks between them
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * 2 * Math.PI - Math.PI / 2;
      const px = cx + R * Math.cos(ang);
      const py = cy + R * Math.sin(ang);
      let cls = 'thinking', emoji = '🤔';
      if (gotSecond[i]) { cls = 'eating'; emoji = '😋'; }
      else if (forkOwner[firstFork[i]] === i) { cls = 'waiting'; emoji = '😣'; }
      html += `<div class="phil ${cls}" style="left:${px}px; top:${py}px;"><span class="pemoji">${emoji}</span>P${i+1}</div>`;
    }
    // forks between philosophers: fork f sits between philosopher f and (f-1+N)%N... place at mid angle
    for (let f = 0; f < N; f++) {
      const ang = ((f - 0.5) / N) * 2 * Math.PI - Math.PI / 2;
      const fr = 78;
      const fx = cx + fr * Math.cos(ang);
      const fy = cy + fr * Math.sin(ang);
      const held = forkOwner[f] !== null;
      html += `<div class="fork ${held?'held':''}" style="left:${fx}px; top:${fy}px; transform:translate(-50%,-50%) rotate(${ang + Math.PI/2}rad);" title="fork ${f}"></div>`;
    }
    html += '</div>'; // phil-table

    if (deadlock) {
      html += `<div class="phil-status deadlock">💀 DEADLOCK! All 5 philosophers grabbed their left fork and now wait forever for their right (held by their neighbour). Classic circular wait — everyone starves.</div>`;
    } else {
      const names = eating.map(i => 'P' + (i+1)).join(', ');
      html += `<div class="phil-status ok">✓ No deadlock. ${eating.length} philosopher(s) eating: ${names}. The last philosopher grabbing right-first broke the circular wait — so the cycle can't close and someone always gets both forks.</div>`;
    }

    html += `<div style="font-size:12px; color:var(--ink-muted); max-width:340px; text-align:center;">`;
    if (mode === 'naive') {
      html += `Each philosopher grabs <strong>left then right</strong>. With all grabbing simultaneously, every fork is held as a "left" fork → no "right" forks free → circular wait.`;
    } else {
      html += `Philosophers 1–4 grab <strong>left then right</strong>, but philosopher 5 grabs <strong>right then left</strong>. This asymmetry means two philosophers compete for the same fork first, leaving another free to eat — the cycle is broken.`;
    }
    html += `</div></div>`;

    out.innerHTML = html;
  }

