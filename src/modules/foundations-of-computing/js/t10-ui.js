  /* ============================================================
     TOPIC 10 · rendering for the five undecidability tools
     ============================================================ */

  function udBad(outId, r) {
    var out = document.getElementById(outId);
    if (out) out.innerHTML = '<div class="verdict bad">' + r.error + '</div>';
  }

  /* ---------- Tool 1 · enumerating every word ---------- */

  function runEnum() {
    var out = document.getElementById('en-output');
    if (!out) return;
    var alphaRaw = ((document.getElementById('en-alpha') || {}).value || '01').replace(/[\s,]/g, '');
    var alpha = alphaRaw.split('').filter(function (c, i, a) { return a.indexOf(c) === i; });
    if (alpha.length < 1) return udBad('en-output', { error: 'The alphabet needs at least one symbol.' });
    var count = parseInt((document.getElementById('en-count') || {}).value, 10);
    if (!(count >= 1)) count = 16;
    if (count > 200) count = 200;

    var words = enWords(count, alpha);

    // the bijection has to work both ways, on every word shown
    var bad = 0;
    words.forEach(function (w, i) {
      var idx = enIndexOf(w, alpha);
      var back = enWordAt(i, alpha);
      if (!idx.ok || idx.index !== i || !back.ok || back.word !== w) bad++;
    });

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">|Σ| = ' + alpha.length + '</span>' +
      '<span class="stat-pill a">' + count + ' words</span>' +
      '<span class="stat-pill ' + (bad ? 'warn' : 'b') + '">' +
        (bad ? bad + ' indexing failures' : 'index ↔ word checks out both ways') + '</span></div>';

    h += '<div class="en-grid">';
    words.forEach(function (w, i) {
      h += '<div class="en-cell"><span class="en-i">w<sub>' + i + '</sub></span>' +
        '<span class="en-w">' + (w === '' ? 'ε' : esc(w)) + '</span></div>';
    });
    h += '</div>';

    h += '<div class="verdict ' + (bad ? 'bad' : 'safe') + '">' +
      (bad ? 'The enumeration is not a bijection, which breaks everything downstream.'
           : 'Shortest first, alphabetical within a length. Every word appears exactly once and has a ' +
             'definite index, which is what lets the diagonal argument say "the i-th word".') +
      '</div>';

    if (alpha.length === 2 && alpha[0] === '0' && alpha[1] === '1') {
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">Two entries are easy to swap</div>' +
        'It prints <code>ε, 1, 0, 00, 01, 10, 11, 000, …</code> — 1 before 0, and then every later ' +
        'block in the opposite order, 00 before 01 before 10 before 11. Either convention enumerates ' +
        'Σ*; mixing them means there is no rule saying which word w<sub>i</sub> is, and the diagonal ' +
        'argument needs exactly that. The order above is the consistent one.</div>';
    }

    h += '<div class="lp-foot">The point is only that Σ* is <strong>countable</strong>: finitely many ' +
      'words of each length, so listing them by length exhausts the set. The same trick lists every ' +
      'Turing machine, because a machine is a finite string too. Both lists being countable is what ' +
      'makes a table with machines down the side and words along the top a sensible object — and ' +
      'once you have the table, you can walk its diagonal.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · encoding, and where it goes wrong ---------- */

  function runEncode() {
    var out = document.getElementById('cd-output');
    if (!out) return;
    var raw = ((document.getElementById('cd-parts') || {}).value || '0, 1, 0#1');
    var parts = raw.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
    if (!parts.length) return udBad('cd-output', { error: 'Give at least one component.' });

    var plain = enTuple(parts);
    var flat = enUntuple(plain);
    var fixed = enTupleBin(parts);
    var back = fixed.ok ? enUntupleBin(fixed.bits) : null;

    var roundTripsPlain = flat.ok && JSON.stringify(flat.parts) === JSON.stringify(parts);
    var roundTripsFixed = !!(back && back.ok && JSON.stringify(back.parts) === JSON.stringify(parts));

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + parts.length + ' components</span>' +
      '<span class="stat-pill ' + (roundTripsPlain ? 'b' : 'c') + '">plain: ' +
        (roundTripsPlain ? 'decodes' : 'does not decode') + '</span>' +
      '<span class="stat-pill ' + (roundTripsFixed ? 'b' : 'warn') + '">binary: ' +
        (roundTripsFixed ? 'decodes' : (fixed.ok ? 'does not decode' : 'not codeable')) + '</span></div>';

    h += '<div class="cd-row"><span class="cd-lab">⟨' + parts.map(esc).join(', ') + '⟩</span>' +
      '<span class="cd-val">' + esc(plain) + '</span></div>';
    if (flat.ok) {
      h += '<div class="cd-row"><span class="cd-lab">read back</span>' +
        '<span class="cd-val">⟨' + flat.parts.map(esc).join(', ') + '⟩' +
        (roundTripsPlain ? '' : ' <span class="cd-bad">— not what went in</span>') + '</span></div>';
    }
    if (fixed.ok) {
      h += '<div class="cd-row"><span class="cd-lab">in the fixed binary code</span>' +
        '<span class="cd-val cd-bits">' + esc(fixed.bits) + '</span></div>';
      if (back && back.ok) {
        h += '<div class="cd-row"><span class="cd-lab">read back</span>' +
          '<span class="cd-val">⟨' + back.parts.map(esc).join(', ') + '⟩</span></div>';
      }
    } else {
      h += '<div class="verdict warn">' + fixed.error + '</div>';
    }

    // the collision, always shown — it is the point of the tool
    var am = enAmbiguity();
    h += '<div class="cd-clash"><div class="pb-cap">Why a plain #-tuple cannot be decoded</div>' +
      '<table class="cd-table"><tr><th></th><th>the pair ⟨0, 1⟩</th><th>the single string "0#1"</th>' +
      '<th></th></tr>' +
      '<tr><th>plain</th><td>' + esc(am.flat.pair) + '</td><td>' + esc(am.flat.single) + '</td>' +
        '<td class="' + (am.flat.collide ? 'pc-no' : 'pc-ok') + '">' +
        (am.flat.collide ? 'identical' : 'distinct') + '</td></tr>' +
      '<tr><th>the usual repair<br><span class="cd-small">0→00, 1→01, #→11</span></th><td class="cd-bits">' +
        esc(am.usual.pair) + '</td><td class="cd-bits">' + esc(am.usual.single) + '</td>' +
        '<td class="' + (am.usual.collide ? 'pc-no' : 'pc-ok') + '">' +
        (am.usual.collide ? 'still identical' : 'distinct') + '</td></tr>' +
      '<tr><th>a code that works<br><span class="cd-small">0→00, 1→01, #→10, sep→11</span></th>' +
        '<td class="cd-bits">' + esc(am.fixed.pair) + '</td><td class="cd-bits">' +
        esc(am.fixed.single) + '</td>' +
        '<td class="' + (am.fixed.collide ? 'pc-no' : 'pc-ok') + '">' +
        (am.fixed.collide ? 'identical' : 'distinct') + '</td></tr></table></div>';

    var inj = enCodeIsInjective(3, 2);
    h += '<div class="callout warn" style="margin:14px 0;">' +
      '<div class="callout-label">The usual repair does not repair it</div>' +
      'The tuple ⟨w₀, …, wₙ⟩ = #w₀#…#wₙ# is described as built from strings over Σ ∪ {#}, so a ' +
      'component may contain a separator — and then ⟨0, 1⟩ and ⟨"0#1"⟩ have the same encoding. The ' +
      'usual fix is a binary code, but <strong>it gives the data character # and ' +
      'the separator the same pattern, 11</strong>, so the collision survives translation unchanged.' +
      '<br><br>What fixes it is reserving a pattern the data can never produce: code # as 10 and keep ' +
      '11 for the separator alone. Checked exhaustively over ' + inj.tested + ' tuples of up to three ' +
      'components: <strong>' + inj.clashes + ' collisions</strong>. This is not pedantry — code(M) ' +
      'nests tuples inside tuples, so its components contain separators by construction, and a ' +
      'universal machine that cannot parse code(M) is not a universal machine.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · the universal machine ---------- */

  function utmPreset(which) {
    var el = document.getElementById('ut-text');
    if (el) el.value = EN_PRESETS[which] || EN_PRESETS.parity;
    runUniversal();
  }

  function runUniversal() {
    var out = document.getElementById('ut-output');
    if (!out) return;
    var el = document.getElementById('ut-text');
    var text = (el ? el.value : '') || EN_PRESETS.parity;
    var wordsRaw = ((document.getElementById('ut-words') || {}).value || 'ε, 0, 1, 11, 101, 1111');
    var words = wordsRaw.split(',').map(function (s) { return s.trim(); })
      .map(function (s) { return (s === 'ε' || s === '') ? '' : s; });

    var r = enRoundTrip(text, words, 400);
    if (!r.ok) return udBad('ut-output', r);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + r.rules + ' rules</span>' +
      '<span class="stat-pill a">' + r.code.length + ' characters</span>' +
      '<span class="stat-pill ' + (r.same ? 'b' : 'warn') + '">' +
        (r.same ? 'M_u agrees with M everywhere' : 'M_u DISAGREES with M') + '</span></div>';

    h += '<div class="cd-row"><span class="cd-lab">code(M)</span>' +
      '<span class="cd-val cd-code">' + esc(r.code) + '</span></div>';
    if (r.bits) {
      h += '<div class="cd-row"><span class="cd-lab">as bits</span>' +
        '<span class="cd-val cd-bits">' + esc(r.bits) + '</span></div>';
    } else {
      h += '<div class="cd-row"><span class="cd-lab">as bits</span><span class="cd-val cd-small">' +
        'not available — the two-bit code covers 0, 1 and # only, and this machine’s state names use ' +
        'other letters. Nothing turns on it: rename the states and the code applies.</span></div>';
    }

    h += '<div class="ut-decoded"><div class="pb-cap">decoded back into a machine</div><pre>' +
      esc(r.decoded) + '</pre></div>';

    h += '<table class="ut-table"><tr><th>w</th><th>M(w)</th><th>M<sub>u</sub>(⟨code(M), w⟩)</th>' +
      '<th>steps</th><th></th></tr>';
    r.rows.forEach(function (row) {
      h += '<tr><td>' + (row.w === '' ? 'ε' : esc(row.w)) + '</td>' +
        '<td>' + row.original + '</td><td>' + row.simulated + '</td>' +
        '<td>' + row.steps + '</td>' +
        '<td class="' + (row.agree ? 'pc-ok' : 'pc-no') + '">' + (row.agree ? '✓' : '✗') + '</td></tr>';
    });
    h += '</table>';

    h += '<div class="verdict ' + (r.same ? 'safe' : 'bad') + '">' + r.note + '</div>';

    h += '<div class="lp-foot">This is the whole content of the universal machine: a Turing machine is ' +
      'a finite object, so it can be written down as a string, and a machine can read that string and ' +
      'do what it says. It is the theoretical statement of something now unremarkable — that a ' +
      'computer runs programs, and that a program is just data. What follows is less comfortable: ' +
      'because a machine can be fed its own description, it can be asked about itself, and that is ' +
      'where the next two tools go.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · the diagonal ---------- */

  function dgPreset() {
    var el = document.getElementById('dg-text');
    if (el) el.value = DG_PRESET;
    runDiagonal();
  }

  function dgRandomise() {
    var el = document.getElementById('dg-text');
    if (!el) return;
    var n = 6, rows = [];
    for (var i = 0; i < n; i++) {
      var r = [];
      for (var j = 0; j < n + 3; j++) r.push(Math.random() < 0.5 ? '✓' : '✗');
      rows.push(r.join(' '));
    }
    el.value = rows.join('\n');
    runDiagonal();
  }

  function runDiagonal() {
    var out = document.getElementById('dg-output');
    if (!out) return;
    var el = document.getElementById('dg-text');
    var g = dgParse((el ? el.value : '') || DG_PRESET);
    if (!g.ok) return udBad('dg-output', g);
    var d = dgDiagonal(g);
    if (!d.ok) return udBad('dg-output', d);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + g.n + ' machines</span>' +
      '<span class="stat-pill a">' + g.width + ' words</span>' +
      '<span class="stat-pill ' + (d.anyRowEqualsL ? 'warn' : 'b') + '">' +
        (d.anyRowEqualsL ? 'a row equals L — impossible' : 'no row equals L') + '</span></div>';

    h += '<table class="dg-table"><tr><th></th>' +
      Array.apply(null, { length: g.width }).map(function (_, j) {
        return '<th>w<sub>' + j + '</sub></th>';
      }).join('') + '</tr>';
    for (var i = 0; i < g.n; i++) {
      h += '<tr><th>M<sub>' + i + '</sub></th>';
      for (var j = 0; j < g.width; j++) {
        var onDiag = i === j;
        h += '<td class="' + (onDiag ? 'dg-diag ' : '') + (g.rows[i][j] ? 'dg-yes' : 'dg-no') + '">' +
          (g.rows[i][j] ? '✓' : '✗') + '</td>';
      }
      h += '</tr>';
    }
    h += '<tr class="dg-lrow"><th>L</th>';
    for (var j2 = 0; j2 < g.width; j2++) {
      h += '<td class="' + (j2 < g.n ? (d.inL[j2] ? 'dg-yes' : 'dg-no') : 'dg-off') + '">' +
        (j2 < g.n ? (d.inL[j2] ? '✓' : '✗') : '·') + '</td>';
    }
    h += '</tr></table>';

    h += '<div class="verdict safe">' +
      'The diagonal reads <strong>' + d.diag.map(function (x) { return x ? '✓' : '✗'; }).join(' ') +
      '</strong>, so L — which is its opposite — holds ' +
      (d.members.length ? '<strong>' + d.members.map(function (i2) { return 'w' + i2; }).join(', ') +
        '</strong>' : 'nothing') +
      ' among the words shown.</div>';

    h += '<div class="dg-clashes"><div class="pb-cap">Where each machine differs from L</div>';
    d.clashes.forEach(function (c) {
      h += '<div class="dg-clash"><span class="dg-m">M<sub>' + c.row + '</sub></span>' +
        '<span class="dg-diff">differs at ' +
        c.differsAt.map(function (x) {
          return '<span class="' + (x === c.row ? 'dg-own' : '') + '">w' + x + '</span>';
        }).join(', ') + '</span>' +
        '<span class="dg-because">including w<sub>' + c.row + '</sub>, its own column — by ' +
        'construction</span></div>';
    });
    h += '</div>';

    h += '<div class="lp-foot">Every row differs from L, and each one differs at <em>its own index</em>. ' +
      'That is not luck and it does not depend on the table: L was defined to disagree with ' +
      'M<sub>i</sub> exactly at w<sub>i</sub>. Press <strong>Randomise</strong> as often as you like — ' +
      'no table will ever produce a row equal to L.<br><br>Since the list contained every Turing ' +
      'machine, L is a language <em>no</em> machine recognises. It exists because the definition of L ' +
      'is perfectly clear; it is simply not something any machine can decide.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 5 · halting, attempted honestly ---------- */

  function hpPreset(which) {
    var presets = {
      halts: '; stops almost immediately\nstart: q0\naccept: acc\nreject: rej\n' +
             'q0 1 q0 1 >\nq0 _ acc _ >\n',
      loops: '; bounces between two cells forever — and can be PROVED to\n' +
             'start: q0\naccept: acc\nreject: rej\n' +
             'q0 1 q1 1 >\nq1 1 q0 1 <\nq0 _ acc _ >\n',
      runaway: '; walks right forever, never repeating a configuration\n' +
               'start: q0\naccept: acc\nreject: rej\n' +
               'q0 1 q0 1 >\nq0 _ q0 _ >\n'
    };
    var el = document.getElementById('hp-text');
    if (el) el.value = presets[which] || presets.halts;
    var w = document.getElementById('hp-word');
    if (w) w.value = '11';
    runHalting();
  }

  function runHalting() {
    var out = document.getElementById('hp-output');
    if (!out) return;
    var el = document.getElementById('hp-text');
    var p = tmParse((el ? el.value : '') ||
      'start: q0\naccept: acc\nreject: rej\nq0 1 q0 1 >\nq0 _ acc _ >\n');
    if (!p.ok) return udBad('hp-output', p);

    var word = ((document.getElementById('hp-word') || {}).value || '11');
    var cap = parseInt((document.getElementById('hp-cap') || {}).value, 10);
    if (!(cap >= 10)) cap = 200;

    var a = hpAttempt(p.m, word, cap);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + a.steps + ' steps run</span>' +
      '<span class="stat-pill a">cap ' + cap + '</span>' +
      '<span class="stat-pill ' + (a.proven ? 'b' : 'warn') + '">' + a.answer + '</span></div>';

    h += '<div class="hp-three">' +
      ['halts', 'never halts', 'unknown'].map(function (k) {
        return '<div class="hp-box' + (a.answer === k ? ' on' : '') + '">' +
          '<div class="hp-k">' + k + '</div>' +
          '<div class="hp-d">' + (k === 'halts' ? 'we watched it stop'
            : k === 'never halts' ? 'a configuration repeated' : 'still going at the cap') +
          '</div></div>';
      }).join('') + '</div>';

    h += '<div class="verdict ' + (a.proven ? 'safe' : 'warn') + '">' + a.why + '</div>';

    var c = hpContradiction();
    h += '<div class="hp-proof"><div class="pb-cap">Why no cap will ever be enough</div>' +
      'Suppose <code>halt(⟨code(M), w⟩)</code> existed and always answered correctly. Build ' +
      '<strong>M*</strong>: clone the input, ask halt about it, and then do the opposite — loop if ' +
      'halt says "halts", accept if it says "does not". Now run M* on its own code.' +
      '<table class="hp-table"><tr><th>if halt says M* …</th><th>then halt returns</th>' +
      '<th>so M* actually …</th><th></th></tr>';
    c.cases.forEach(function (x) {
      h += '<tr><td>' + (x.assumption ? 'halts' : 'does not halt') + '</td>' +
        '<td>' + x.haltReturns + '</td><td>' + x.behaviour + '</td>' +
        '<td class="' + (x.consistent ? 'pc-ok' : 'pc-no') + '">' +
        (x.consistent ? 'consistent' : 'contradiction') + '</td></tr>';
    });
    h += '</table><div class="lp-foot">' + c.note + '</div></div>';

    out.innerHTML = h;
  }

  /* ---------- the catalogue, rendered as a static panel ---------- */

  function runCatalogue() {
    var out = document.getElementById('ud-output');
    if (!out) return;
    var h = '<div class="rd-stats"><span class="stat-pill a">' + UD_PROBLEMS.length +
      ' undecidable problems</span><span class="stat-pill dark">all reduce from HALT or A</span></div>';

    h += '<div class="ud-list">';
    UD_PROBLEMS.forEach(function (p) {
      h += '<div class="ud-item"><div class="ud-name">' + p.name + '</div>' +
        '<div class="ud-io"><strong>Input)</strong> ' + p.input + '<br>' +
        '<strong>Output)</strong> ' + p.output + '</div>' +
        '<div class="ud-set">' + p.set + '</div>' +
        '<div class="ud-how"><strong>Why undecidable:</strong> ' + p.how + '</div></div>';
    });
    h += '</div>';

    h += '<div class="callout warn" style="margin:14px 0;">' +
      '<div class="callout-label">The direction of a reduction</div>' +
      'To show B is undecidable you reduce a problem already known to be undecidable <em>to</em> B: ' +
      'A ≤ B with A undecidable makes B undecidable, because a decider for B would give you one for A. ' +
      'Reducing B to A tells you nothing about B. The hardness travels along the arrow, away from the ' +
      'problem you already know is hard — the same direction as in Topic 2, and the same mistake is ' +
      'available.</div>';

    out.innerHTML = h;
  }
