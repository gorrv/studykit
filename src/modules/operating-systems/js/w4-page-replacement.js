  /* ============================================================
     PAGE REPLACEMENT (Week 4)

     The policy is a pure function of (reference string, frame count,
     algorithm), which is what lets the same code drive both the
     step-through view and the Belady sweep underneath it.
     ============================================================ */

  /**
   * Run a reference string to completion.
   *
   * @param {number[]} refs
   * @param {number} numFrames
   * @param {string} algo  fifo | lru | opt | clock
   * @returns {{faults, hits, steps}} steps[i] describes what happened on refs[i]
   */
  function prRun(refs, numFrames, algo) {
    var frames = [];        // resident pages, in the order the policy cares about
    var use = {};           // clock's reference bits
    var hand = 0;
    var faults = 0, hits = 0, steps = [];

    for (var pos = 0; pos < refs.length; pos++) {
      var r = refs[pos], victim = null, fault;

      if (frames.indexOf(r) >= 0) {
        fault = false; hits++;
        if (algo === 'lru') { frames.splice(frames.indexOf(r), 1); frames.push(r); }
        if (algo === 'clock') use[r] = 1;
      } else {
        fault = true; faults++;

        if (frames.length < numFrames) {
          frames.push(r);
          if (algo === 'clock') use[r] = 1;
        } else if (algo === 'fifo' || algo === 'lru') {
          // FIFO evicts the oldest arrival; LRU keeps `frames` in
          // least-recently-used order, so the front is the victim either way.
          victim = frames.shift();
          frames.push(r);
        } else if (algo === 'opt') {
          // Evict whichever resident page is next used furthest away — or
          // never again, which is the best possible choice.
          //
          // Several pages can share "never again", and how that tie is broken
          // matters more than it looks. Breaking it by frame slot makes the
          // choice depend on the frame count, and OPT then loses the stack
          // property: the pages held with n frames stop being a subset of
          // those held with n+1, and the algorithm can appear to show Belady's
          // anomaly, which OPT cannot actually do. Breaking it on the page
          // number instead — a fixed order that does not depend on the frame
          // layout — restores it. The fault count is the same either way.
          var far = -1, at = 0;
          for (var f = 0; f < frames.length; f++) {
            var next = Infinity;
            for (var k = pos + 1; k < refs.length; k++) {
              if (refs[k] === frames[f]) { next = k; break; }
            }
            if (next > far || (next === far && frames[f] > frames[at])) { far = next; at = f; }
          }
          victim = frames[at];
          frames[at] = r;
        } else if (algo === 'clock') {
          // Sweep, clearing use bits, until one is already clear.
          for (var guard = 0; guard < 2 * numFrames + 2; guard++) {
            var cand = frames[hand];
            if (use[cand] === 0) {
              victim = cand;
              frames[hand] = r;
              delete use[cand];
              use[r] = 1;
              hand = (hand + 1) % numFrames;
              break;
            }
            use[cand] = 0;
            hand = (hand + 1) % numFrames;
          }
        }
      }

      steps.push({
        ref: r, fault: fault, victim: victim,
        frames: frames.slice(),
        use: algo === 'clock' ? Object.assign({}, use) : null,
        hand: algo === 'clock' ? hand : null,
      });
    }

    return { faults: faults, hits: hits, steps: steps };
  }

  /** Faults for every frame count from 1 to max — the Belady sweep. */
  function prCurve(refs, algo, max) {
    var out = [];
    for (var n = 1; n <= max; n++) out.push({ frames: n, faults: prRun(refs, n, algo).faults });
    return out;
  }

  /* ---------- the step-through view ---------- */

  var PR = { refs: [], numFrames: 3, algo: 'fifo', pos: 0, res: null };

  function prParse() {
    var raw = (document.getElementById('pr-refs') || {}).value || '';
    var refs = raw.trim().split(/[\s,]+/).filter(function (x) { return x !== ''; }).map(Number);
    if (!refs.length || refs.some(isNaN)) return null;
    return refs;
  }

  function prInit() {
    var refs = prParse();
    if (!refs) return false;
    PR.refs = refs;
    PR.numFrames = Math.max(1, Math.min(8,
      parseInt((document.getElementById('pr-numframes') || {}).value, 10) || 3));
    PR.algo = (document.getElementById('pr-algo') || {}).value || 'fifo';
    PR.res = prRun(PR.refs, PR.numFrames, PR.algo);
    PR.pos = 0;
    return true;
  }

  function prRender() {
    var out = document.getElementById('pr-output');
    if (!out) return;
    if (!PR.res) {
      out.innerHTML = '<div class="tool-error">Give a reference string, e.g. 7 0 1 2 0 3 0 4.</div>';
      return;
    }

    var shown = PR.res.steps.slice(0, PR.pos);
    var last = shown[shown.length - 1] || null;
    var html = '';

    html += '<div class="pr-refstring">';
    PR.refs.forEach(function (r, i) {
      var cls = '';
      if (i < PR.pos) cls = PR.res.steps[i].fault ? 'done-fault' : 'done-hit';
      else if (i === PR.pos) cls = 'current';
      html += '<div class="pr-ref ' + cls + '">' + r + '</div>';
    });
    html += '</div>';

    html += '<div class="pr-frames">';
    for (var i = 0; i < PR.numFrames; i++) {
      var v = last ? last.frames[i] : undefined;
      if (v === undefined) { html += '<div class="pr-frame empty">·</div>'; continue; }
      var cls = '';
      if (last && last.ref === v) cls = last.fault ? 'fault' : 'hit';
      var mark = (PR.algo === 'clock' && last && i === last.hand)
        ? ' style="box-shadow:0 0 0 2px var(--accent-2);"' : '';
      var bit = (PR.algo === 'clock' && last && last.use[v] !== undefined)
        ? '<sub style="font-size:9px;">U' + last.use[v] + '</sub>' : '';
      html += '<div class="pr-frame ' + cls + '"' + mark + '>' + v + bit + '</div>';
    }
    html += '</div>';

    if (last) {
      html += last.fault
        ? '<p class="tool-note">Accessed <strong>' + last.ref + '</strong> → <span style="color:var(--accent-2);">PAGE FAULT</span>' +
          (last.victim !== null ? ' → evicted <strong>' + last.victim + '</strong>.' : ' → loaded into a free frame.') + '</p>'
        : '<p class="tool-note">Accessed <strong>' + last.ref + '</strong> → <span style="color:var(--accent-3);">hit</span>, already resident.</p>';
    } else {
      html += '<p class="tool-note">Press Step to walk the string one reference at a time, or Run all.</p>';
    }

    var f = shown.filter(function (s) { return s.fault; }).length;
    var h = shown.length - f;
    html += '<div style="margin-top:10px;"><span class="pr-stat faults">Faults: ' + f + '</span>' +
      '<span class="pr-stat hits">Hits: ' + h + '</span>';

    if (PR.pos >= PR.refs.length && shown.length) {
      var total = shown.length, pMiss = f / total;
      var amat = 100 + pMiss * 10000000;
      var amatStr = amat >= 1e6 ? (amat / 1e6).toFixed(3) + 'ms'
        : amat >= 1e3 ? (amat / 1e3).toFixed(1) + 'µs' : amat.toFixed(0) + 'ns';
      html += '<span class="pr-stat" style="background:var(--chip-bg); color:var(--chip-fg);">' +
        'Done · hit rate ' + ((h / total) * 100).toFixed(1) + '% · fault rate ' + (pMiss * 100).toFixed(1) + '%</span></div>' +
        '<div class="tool-note" style="font-family:\'IBM Plex Mono\',monospace;">AMAT ≈ 100ns + ' +
        pMiss.toFixed(3) + ' × 10ms = <strong>' + amatStr + '</strong>' +
        ' &nbsp;(T<sub>M</sub>=100ns, T<sub>D</sub>=10ms)</div>';
      html += prBeladyHtml();
    } else {
      html += '</div>';
    }

    out.innerHTML = html;
  }

  /**
   * More frames should mean fewer faults. For FIFO it sometimes means more —
   * Belady's anomaly. Sweeping every frame count makes it visible rather than
   * something to take on trust, and the same sweep on LRU or OPT stays
   * monotone, which is the point worth seeing.
   */
  function prBeladyHtml() {
    var curve = prCurve(PR.refs, PR.algo, 7);
    var worst = curve.reduce(function (a, c) { return Math.max(a, c.faults); }, 1);

    var anomalies = [];
    for (var i = 1; i < curve.length; i++) {
      if (curve[i].faults > curve[i - 1].faults) anomalies.push(curve[i]);
    }

    var html = '<div class="pr-belady"><h4>Faults as the frame count grows</h4><div class="pr-curve">';
    curve.forEach(function (c, i) {
      var up = i > 0 && c.faults > curve[i - 1].faults;
      var h = Math.round((c.faults / worst) * 64) + 6;
      html += '<div class="pr-bar-wrap">' +
        '<div class="pr-bar' + (up ? ' anomaly' : '') + '" style="height:' + h + 'px;" ' +
        'title="' + c.frames + ' frames → ' + c.faults + ' faults"></div>' +
        '<span class="pr-bar-n">' + c.faults + '</span>' +
        '<span class="pr-bar-x">' + c.frames + '</span></div>';
    });
    html += '</div>';

    if (anomalies.length) {
      html += '<p class="tool-note"><strong>Belady’s anomaly.</strong> Going from ' +
        (anomalies[0].frames - 1) + ' to ' + anomalies[0].frames + ' frames takes the fault count ' +
        '<em>up</em>, from ' + curve[anomalies[0].frames - 2].faults + ' to ' + anomalies[0].faults +
        '. More memory, worse performance. FIFO can do this because the page it evicts has nothing ' +
        'to do with how likely the page is to be needed again.</p>';
    } else if (PR.algo === 'fifo') {
      html += '<p class="tool-note">No anomaly on this string. FIFO can show one — try ' +
        '<code>1 2 3 4 1 2 5 1 2 3 4 5</code>, where 3 frames beats 4.</p>';
    } else {
      html += '<p class="tool-note">' + PR.algo.toUpperCase() + ' is a stack algorithm: the pages held ' +
        'with <em>n</em> frames are always a subset of those held with <em>n</em>+1, so more frames can ' +
        'never mean more faults. Only FIFO and Clock can show the anomaly.</p>';
    }

    return html + '</div>';
  }

  function prStep() {
    if (!PR.res || PR.pos >= PR.refs.length) { if (!prInit()) { prRender(); return; } }
    if (PR.pos < PR.refs.length) PR.pos++;
    prRender();
  }

  function prRunAll() {
    if (!prInit()) { PR.res = null; prRender(); return; }
    PR.pos = PR.refs.length;
    prRender();
  }

  function prReset() {
    if (!prInit()) { PR.res = null; }
    prRender();
  }

  window.PR = PR;
  window.prRun = prRun;
  window.prCurve = prCurve;
