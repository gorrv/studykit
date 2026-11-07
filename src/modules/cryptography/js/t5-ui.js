  /* ============================================================
     CRYPTOGRAPHY TOPIC 05 · rendering
     ============================================================ */

  /* ---------- Tool 1 · the three modes ---------- */

  function runModes() {
    var out = document.getElementById('mo-output');
    if (!out) return;
    var mode = ((document.getElementById('mo-mode') || {}).value) || 'ecb';
    var msg = bkBits(((document.getElementById('mo-msg') || {}).value) || '0011110000111100', 16);
    var key = bkBits(((document.getElementById('mo-key') || {}).value) || '01011101', 8);

    var M = MD_MODES[mode];
    var r = mdRun(mode, key, msg, 7);
    var det = mdDeterministic(mode, key, msg);
    var leak = mdRepeatLeak(mode, key);

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">' + esc(M.label) + '</span>' +
      '<span class="stat-pill ' + (M.randomised ? 'b' : 'c') + '">' +
        (M.randomised ? 'randomised' : 'deterministic') + '</span>' +
      '<span class="stat-pill dark">' + (M.needsInverse ? 'needs F⁻¹' : 'never inverts F') +
      '</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>message</th><td><code>' + bkSpaced(bkStr(msg)) + '</code></td></tr>' +
      (r.iv ? '<tr><th>IV</th><td><code>' + esc(r.iv) + '</code>' +
        (mode === 'ctr' ? ' <span class="cr-dim">(3&ell;/4 = 6 bits)</span>' : '') +
        '</td></tr>' : '') +
      '<tr><th>ciphertext blocks</th><td><code>' +
        r.blocks.map(esc).join('</code> <code>') + '</code></td></tr>' +
      '<tr><th>decrypted again</th><td><code>' + bkSpaced(r.recovered) + '</code> ' +
        (r.correct ? '<span class="cr-hit">&#10003;</span>'
                   : '<span class="cr-miss">&#10007;</span>') + '</td></tr>' +
      '</tbody></table>';

    h += '<div class="cr-cap">two things to try on any mode</div>' +
      '<table class="cr-table"><tbody>' +
      '<tr><th>encrypt the same message twice</th><td>' +
        (det.same ? '<span class="cr-miss">the same ciphertext both times</span>'
                  : '<span class="cr-hit">different ciphertexts</span>') + '</td></tr>' +
      '<tr><th>encrypt two identical blocks</th><td>' +
        (leak.leaks ? '<span class="cr-miss">the ciphertext blocks are identical too</span>'
                    : '<span class="cr-hit">the ciphertext blocks differ</span>') +
        '</td></tr></tbody></table>';

    h += '<div class="verdict ' + (mode === 'ecb' ? 'bad' : 'safe') + '">' +
      (mode === 'ecb'
        ? '<strong>Both of those are fatal.</strong> A deterministic <code>Enc</code> cannot ' +
          'be IND-CPA secure &mdash; ask the oracle to encrypt <code>m<sub>0</sub></code> ' +
          'and compare. And equal blocks giving equal ciphertext loses the game without any ' +
          'oracle at all.'
        : '<strong>Randomised, so the same message does not give the same ciphertext.</strong> ' +
          'That is the minimum IND-CPA requires, and it is what ECB cannot offer. The price ' +
          'is a longer ciphertext: the IV has to travel too.') + '</div>';

    h += '<div class="cr-cap">how the three compare</div>' +
      '<table class="cr-table"><thead><tr><th></th><th>randomised</th>' +
      '<th>encrypt in parallel</th><th>decrypt in parallel</th><th>needs F⁻¹</th>' +
      '</tr></thead><tbody>';
    ['ecb', 'cbc', 'ctr'].forEach(function (id) {
      var X = MD_MODES[id];
      h += '<tr' + (id === mode ? ' class="cr-best"' : '') + '><td>' + esc(X.label) + '</td>' +
        '<td>' + yn(X.randomised) + '</td><td>' + yn(X.parallelEnc) + '</td>' +
        '<td>' + yn(X.parallelDec) + '</td><td>' + yn(X.needsInverse) + '</td></tr>';
    });
    h += '</tbody></table>';

    if (mode === 'ctr') {
      var lossy = mdRoundTrips('ctr', key, 1, true);
      h += '<div class="callout tip" style="margin:14px 0;">' +
        '<div class="callout-label">Counter mode never inverts F</div>' +
        'Both encryption and decryption compute <code>F(sk, IV&#8741;i)</code> and XOR it ' +
        'in. Nothing ever runs <code>F<sup>&minus;1</sup></code>, so <strong>F does not ' +
        'have to be a permutation</strong>. Running this mode with a deliberately ' +
        'non-invertible F &mdash; one that throws a bit away &mdash; still round-trips on ' +
        'all ' + lossy.messages.toLocaleString() + ' messages, with ' + lossy.bad +
        ' failures.</div>';

      var cw = crOnce('ctrwrap', function () {
        return mdCounterWrap(bkBits('110111', 6));
      });
      h += '<div class="cr-cap">and the condition attached to it</div>' +
        '<table class="cr-table"><thead><tr><th>i</th><th>IV&#8741;i</th><th></th>' +
        '</tr></thead><tbody>';
      cw.sequence.slice(0, 6).forEach(function (sq) {
        h += '<tr' + (sq.repeatOf ? ' class="cr-bad-row"' : '') + '><td>' + sq.i + '</td>' +
          '<td><code>' + esc(sq.block) + '</code></td><td class="cr-dim">' +
          (sq.repeatOf ? 'the same block as i = ' + sq.repeatOf : '') + '</td></tr>';
      });
      h += '</tbody></table>' +
        '<div class="verdict warn">The IV takes <code>3&ell;/4</code> bits, leaving ' +
        cw.counterBits + ' for the counter &mdash; so the keystream repeats after <strong>' +
        cw.limit + ' blocks</strong>, here at <code>i = ' + cw.repeatAt + '</code>. That is ' +
        'why the notes require messages of fewer than <code>2<sup>&ell;/4</sup></code> ' +
        'blocks. Past it, counter mode reuses a pad, and a reused pad leaks the difference ' +
        'of the messages &mdash; the same failure as reusing a one-time pad. At ' +
        '<code>&ell; = 128</code> the limit is <code>2<sup>32</sup></code> blocks and nobody ' +
        'notices; at <code>&ell; = 8</code> it is four.</div>';
    }

    out.innerHTML = h;
  }

  function yn(b) {
    return b ? '<span class="cr-hit">yes</span>' : '<span class="cr-dim">no</span>';
  }

  /* ---------- Tool 2 · the famous picture, computed ---------- */

  function runPicture() {
    var out = document.getElementById('pi-output');
    if (!out) return;
    var key = bkBits(((document.getElementById('pi-key') || {}).value) || '01011101', 8);

    var modes = [
      { id: 'plain', label: 'the picture' },
      { id: 'ecb', label: 'ECB' },
      { id: 'cbc', label: 'CBC' }
    ];

    var h = '<div class="cr-pics">';
    var stats = [];
    modes.forEach(function (mo) {
      var p = crOnce('pic' + mo.id + bkStr(key), function () {
        return mdPicture(mo.id, key, 32, 32);
      });
      stats.push({ id: mo.id, label: mo.label, p: p });
      h += '<div class="cr-pic"><div class="cr-cap">' + esc(mo.label) + '</div>' +
        '<svg viewBox="0 0 32 32" width="140" height="140" role="img" ' +
        'shape-rendering="crispEdges">' +
        '<title>' + esc(mo.label) + '</title>' +
        '<desc>A 32 by 32 bitmap' + (mo.id === 'plain' ? '' : ' after encryption in ' +
          esc(mo.label) + ' mode') + ', one pixel per bit.</desc>' +
        '<rect width="32" height="32" fill="var(--surface-2)"/>';
      p.rows.forEach(function (row, y) {
        row.forEach(function (v, x) {
          if (v) h += '<rect x="' + x + '" y="' + y + '" width="1" height="1" ' +
            'fill="var(--ink)"/>';
        });
      });
      h += '</svg><div class="cr-pic-n">' + p.distinctOut + ' distinct blocks</div></div>';
    });
    h += '</div>';

    var plain = stats[0].p, ecb = stats[1].p, cbc = stats[2].p;

    h += '<div class="verdict bad"><strong>ECB keeps the picture’s block structure ' +
      'exactly.</strong> The bitmap contains only ' + plain.distinctPlain + ' distinct ' +
      'blocks out of ' + plain.totalBlocks + ' &mdash; large flat areas are the same block ' +
      'over and over. ECB maps blocks one-to-one, so the ciphertext has ' + ecb.distinctOut +
      ' distinct blocks: <em>the same number</em>. The outline survives because the ' +
      'repetition survives. CBC gives ' + cbc.distinctOut + '.</div>';

    h += '<div class="tool-note">This is the famous picture, computed here rather than ' +
      'reproduced: a shape is drawn, packed a row at a time into eight-bit blocks, encrypted ' +
      'block by block and drawn again. Nothing about ECB is broken in this demonstration ' +
      '&mdash; it is doing exactly what it is defined to do, which is the problem. ' +
      'Identical inputs give identical outputs, and pictures are full of identical ' +
      'inputs.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · breaking ECB, two ways ---------- */

  function runEcbBreak() {
    var out = document.getElementById('eb-output');
    if (!out) return;
    var which = ((document.getElementById('eb-which') || {}).value) || 'oracle';

    var r = which === 'oracle'
      ? crOnce('ecbcpa', function () { return mdEcbIndCpa(3000, 7); })
      : crOnce('ecbnooracle', function () { return mdEcbNoOracle(3000, 7); });

    var pct = 100 * r.rate;

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">' + (which === 'oracle' ? 'IND-CPA' : 'IND-EAV') +
      '</span><span class="stat-pill dark">ECB</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>';
    if (which === 'oracle') {
      h += '<tr><th>the attack</th><td>pick any distinct <code>m<sub>0</sub>, ' +
        'm<sub>1</sub></code> of the same length; ask the oracle for both encryptions; see ' +
        'which one the challenge equals</td></tr>' +
        '<tr><th>why it works</th><td><code>Enc</code> is deterministic, so ' +
        '<code>c<sub>b</sub></code> is literally one of the two ciphertexts already in ' +
        'hand</td></tr>';
    } else {
      h += '<tr><th>the attack</th><td><code>m<sub>0</sub></code> is one block repeated ' +
        'twice, <code>m<sub>1</sub></code> is two different blocks. Same length, so the ' +
        'challenger does not abort. Look at whether the two ciphertext blocks match</td></tr>' +
        '<tr><th>why it works</th><td>equal plaintext blocks give equal ciphertext blocks ' +
        '&mdash; and <strong>no oracle was needed</strong></td></tr>';
    }
    h += '</tbody></table>';

    h += '<div class="cr-cap">' + r.trials.toLocaleString() + ' rounds</div>' +
      '<div class="cr-meter"><div class="cr-meter-bar" style="width:' +
        Math.min(100, pct).toFixed(1) + '%"></div><div class="cr-meter-half"></div></div>' +
      '<div class="cr-meter-l"><span>0%</span><span>½ &mdash; guessing</span>' +
      '<span>100%</span></div>';

    h += '<div class="verdict bad"><strong>' + pct.toFixed(1) + '%.</strong> ' +
      (which === 'oracle'
        ? 'Every round. This is not a weakness in the block cipher &mdash; F could be a ' +
          'perfect PRP and this would still work. The mode is what fails.'
        : 'Every round, without an encryption oracle. ECB is not merely non-IND-CPA; it ' +
          'loses the weaker game too.') + '</div>';

    h += '<div class="tool-note">The fundamental problem, which both attacks share: ' +
      '<strong><code>Enc</code> must not be deterministic.</strong> A function has no ' +
      'notion of randomness, so the randomness is supplied as an extra input &mdash; ' +
      '<code>Enc(sk, m; &rho;)</code> with <code>&rho;</code> uniform. One consequence is ' +
      'unavoidable: if the same message can produce many ciphertexts, then ' +
      '<code>|C| &gt; |M|</code>, and ciphertexts are longer than messages.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · CBC-MAC, and the rules that keep it safe ---------- */

  function runCbcMacForge() {
    var out = document.getElementById('cm-output');
    if (!out) return;
    var relax = ((document.getElementById('cm-relax') || {}).value) || 'none';
    var ik = bkBits(((document.getElementById('cm-key') || {}).value) || '01011101', 8);
    var m1 = bkBits(((document.getElementById('cm-msg') || {}).value) || '01101011', 8);

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">CBC-MAC</span>' +
      '<span class="stat-pill ' + (relax === 'none' ? 'b' : 'c') + '">' +
      ({ none: 'the rules kept',
         length: 'any message length allowed',
         iv: 'a random IV allowed',
         inter: 'intermediate tags published' })[relax] + '</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>the construction</th><td><code>&tau;<sub>0</sub> = 0<sup>&ell;</sup></code>, ' +
      '<code>&tau;<sub>i</sub> = F(ik, &tau;<sub>i&minus;1</sub> &oplus; m<sub>i</sub>)</code>, ' +
      'return <code>&tau;<sub>t</sub></code> &mdash; the last one only</td></tr>' +
      '</tbody></table>';

    if (relax === 'none') {
      var r = mdCbcMac(ik, m1.concat(bkBits('00101101', 8)));
      h += '<table class="cr-table cr-steps"><tbody>' +
        '<tr><th>message</th><td><code>' + bkSpaced(bkStr(m1.concat(bkBits('00101101', 8)))) +
          '</code></td></tr>' +
        '<tr><th>&tau;<sub>1</sub> (not published)</th><td><code class="cr-dim">' +
          esc(r.intermediates[0]) + '</code></td></tr>' +
        '<tr><th>&tau; = &tau;<sub>2</sub></th><td><code>' + esc(r.tagText) +
          '</code></td></tr></tbody></table>' +
        '<div class="verdict safe"><strong>Secure, for fixed-length messages.</strong> No ' +
        'IV, no intermediate tags, every message the same number of blocks. Relax any one ' +
        'of those three and it stops being EUF-CMA secure &mdash; pick one above and watch.' +
        '</div>';
      out.innerHTML = h + macFoot();
      return;
    }

    if (relax === 'length') {
      var f = mdForgeVariableLength(ik, m1);
      h += '<table class="cr-table cr-steps"><tbody>' +
        '<tr><th>1 &middot; query one block</th><td><code>' + esc(f.queried) +
          '</code> &rarr; <code>&tau; = ' + esc(f.tag) + '</code></td></tr>' +
        '</tbody></table>' +
        '<table class="cr-table cr-steps cr-attack"><tbody>' +
        '<tr><th>2 &middot; output two blocks</th><td><code>' + bkSpaced(f.forged) +
          '</code>, which is <code>m<sub>1</sub></code> followed by ' +
          '<code>&tau; &oplus; m<sub>1</sub></code></td></tr>' +
        '<tr><th>its real tag</th><td><code class="cr-hit">' + esc(f.forgedTag) +
          '</code></td></tr>' +
        '<tr><th>the tag submitted</th><td><code>' + esc(f.tag) + '</code></td></tr>' +
        '</tbody></table>' +
        '<div class="verdict bad"><strong>' + (f.works ? 'Forged.' : 'Did not forge.') +
        '</strong> The chain computes <code>F(&tau; &oplus; (&tau; &oplus; m<sub>1</sub>)) ' +
        '= F(m<sub>1</sub>) = &tau;</code> &mdash; the second block is chosen so the ' +
        'chaining cancels it out. One query, a message never asked about, a valid tag.</div>';
      var ex = crOnce('forgealways', function () { return mdForgeAlways(); });
      h += '<div class="tool-note">Over every key and every one-block message &mdash; ' +
        ex.total.toLocaleString() + ' cases &mdash; the forgery succeeds, with ' + ex.bad +
        ' failures. This is why CBC-MAC is only claimed secure for <em>fixed-length</em> ' +
        'messages, and why the real fix is to bind the length in: prepend ' +
        '<code>|m|</code> as the first block.</div>';
      out.innerHTML = h + macFoot();
      return;
    }

    if (relax === 'iv') {
      var ivb = bkBits('00010001', 8), delta = bkBits('00001111', 8);
      var g = mdForgeRandomIV(ik, m1, delta, ivb);
      h += '<table class="cr-table cr-steps"><tbody>' +
        '<tr><th>1 &middot; query, with its IV</th><td>IV <code>' + esc(g.iv) +
          '</code>, message <code>' + esc(g.queried) + '</code> &rarr; <code>&tau; = ' +
          esc(g.tag) + '</code></td></tr></tbody></table>' +
        '<table class="cr-table cr-steps cr-attack"><tbody>' +
        '<tr><th>2 &middot; XOR &Delta; into both</th><td>&Delta; = <code>' +
          bkStr(delta) + '</code></td></tr>' +
        '<tr><th>new IV</th><td><code>' + esc(g.newIv) + '</code></td></tr>' +
        '<tr><th>new message</th><td><code>' + esc(g.forged) + '</code></td></tr>' +
        '<tr><th>same tag still valid?</th><td><code class="' +
          (g.works ? 'cr-hit' : 'cr-miss') + '">' + (g.works ? 'yes' : 'no') +
          '</code></td></tr></tbody></table>' +
        '<div class="verdict bad"><strong>Forged.</strong> The very first thing the chain ' +
        'does is <code>IV &oplus; m<sub>1</sub></code>. XOR the same &Delta; into both and ' +
        'that value is unchanged, so every later step is unchanged, so the tag is ' +
        'unchanged &mdash; for a message that was never queried.</div>';
      var ex2 = crOnce('forgeiv', function () { return mdForgeIvAlways(); });
      h += '<div class="tool-note">Checked over ' + ex2.total.toLocaleString() +
        ' combinations of key, message and &Delta;: ' + ex2.bad + ' failures. The IV is not ' +
        'an optional extra here &mdash; <code>&tau;<sub>0</sub></code> must be fixed at ' +
        '<code>0<sup>&ell;</sup></code>.</div>';
      out.innerHTML = h + macFoot();
      return;
    }

    var i3 = mdForgeIntermediate(ik, m1, bkBits('00101101', 8));
    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>1 &middot; query two blocks</th><td><code>' + bkSpaced(i3.queried) +
        '</code></td></tr>' +
      '<tr><th>published tags</th><td>&tau;<sub>1</sub> = <code>' + esc(i3.leaked) +
        '</code>, &tau;<sub>2</sub> = <code>' + esc(i3.tag) + '</code></td></tr>' +
      '</tbody></table>' +
      '<table class="cr-table cr-steps cr-attack"><tbody>' +
      '<tr><th>2 &middot; output</th><td>the one-block message <code>' + esc(i3.forgedFor) +
        '</code> with tag <code>' + esc(i3.leaked) + '</code></td></tr>' +
      '<tr><th>accepted?</th><td><code class="' + (i3.works ? 'cr-hit' : 'cr-miss') + '">' +
        (i3.works ? 'yes' : 'no') + '</code></td></tr></tbody></table>' +
      '<div class="verdict bad"><strong>Forged, and barely an attack.</strong> ' +
      '<code>&tau;<sub>1</sub></code> <em>is</em> the CBC-MAC of the one-block message ' +
      '<code>m<sub>1</sub></code>. Publishing it hands over a valid tag for a message the ' +
      'oracle was never asked about. Only the final output may be returned.</div>';

    out.innerHTML = h + macFoot();
  }

  function macFoot() {
    return '<div class="tool-note">All three failures come from the same place: CBC-MAC is ' +
      'secure only in exactly the shape it is specified in. That brittleness is why it is ' +
      'not standardised, outside one old ISO standard &mdash; a construction that is correct ' +
      'only when used precisely as written is a poor thing to hand to implementers.</div>';
  }

  /* ---------- Tool 5 · composing the two ---------- */

  function runCompose() {
    var out = document.getElementById('co-output');
    if (!out) return;
    var order = ((document.getElementById('co-order') || {}).value) || 'etm';
    var C = MD_COMPOSE[order];

    var sk = bkBits('01011101', 8), ik = bkBits('00010001', 8);
    var msg = bkBits('01101011', 8);
    var r = mdCompose(order, sk, ik, msg, 5);

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill ' + (C.secure ? 'b' : 'c') + '">' + esc(C.label) + '</span>' +
      '<span class="stat-pill dark">tag on ' + esc(C.tagOn) + '</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>message</th><td><code>' + esc(bkStr(msg)) + '</code></td></tr>' +
      '<tr><th>ciphertext</th><td><code>' + bkSpaced(r.ciphertext) + '</code></td></tr>' +
      (r.tag ? '<tr><th>tag, sent alongside</th><td><code>' + esc(r.tag) + '</code></td></tr>'
             : '<tr><th>tag</th><td><span class="cr-dim">inside the ciphertext</span></td></tr>') +
      '</tbody></table>';

    if (order === 'etm') {
      var rej = mdEtmRejects(sk, ik, msg, 3);
      var hold = crOnce('etmhold', function () { return mdEtmHoldsUp(3000, 7); });
      h += '<div class="cr-cap">a tampered ciphertext arrives</div>' +
        '<table class="cr-table cr-steps"><tbody>' +
        '<tr><th>tag recomputed on arrival</th><td><code>' + esc(rej.tagOnArrival) +
          '</code></td></tr>' +
        '<tr><th>tag that was sent</th><td><code>' + esc(rej.tagSent) + '</code></td></tr>' +
        '<tr><th>result</th><td><code class="' + (rej.accepted ? 'cr-miss' : 'cr-hit') +
          '">' + (rej.accepted ? 'accepted' : '&perp; — rejected, and never decrypted') +
          '</code></td></tr></tbody></table>' +
        '<div class="verdict safe"><strong>This is the one with a theorem.</strong> If the ' +
        'SKE is IND-CPA secure and the MAC is EUF-CMA secure, Encrypt-then-MAC is ' +
        '<strong>IND-CCA secure</strong>. The decryption oracle an IND-CCA adversary gets ' +
        'is useless to it: anything it has altered fails verification and returns ' +
        '&perp;.<br><br>Measured on the equality test that defeats Encrypt-and-MAC: ' +
        (100 * hold.rate).toFixed(1) + '%, which is guessing.</div>';
    } else if (order === 'eam') {
      var br = crOnce('eambreak', function () { return mdEamBreaksCpa(3000, 7); });
      h += '<div class="cr-cap">the problem, measured</div>' +
        '<div class="cr-meter"><div class="cr-meter-bar" style="width:' +
          Math.min(100, 100 * br.rate).toFixed(1) + '%"></div>' +
        '<div class="cr-meter-half"></div></div>' +
        '<div class="cr-meter-l"><span>0%</span><span>½</span><span>100%</span></div>' +
        '<div class="verdict bad"><strong>Wins IND-CPA ' + (100 * br.rate).toFixed(1) +
        '% of the time.</strong> The tag is computed on the <em>message</em> and is ' +
        'deterministic, so two encryptions of the same message carry the same tag &mdash; ' +
        'however well the encryption hides things. Ask the oracle for a tag on ' +
        '<code>m<sub>0</sub></code>, then see whether the challenge carries it.<br><br>' +
        'Note this fails <em>IND-CPA</em>, which Encrypt-then-MAC’s components already ' +
        'had. The composition destroyed a property its parts possessed.</div>';
    } else {
      h += '<div class="verdict warn"><strong>The receiver must decrypt before it can check ' +
        'anything.</strong> The tag is inside the ciphertext, so verification cannot happen ' +
        'until after <code>Dec</code> has run on input the attacker chose. Whatever ' +
        '<code>Dec</code> does with malformed input &mdash; padding checks, error messages, ' +
        'timing &mdash; is now part of the attack surface, and that is where real protocols ' +
        'have come apart.<br><br>It is not that MAC-then-Encrypt is always broken; it is ' +
        'that it does not <em>generically</em> give IND-CCA, so each use needs its own ' +
        'argument.</div>';
    }

    h += '<div class="cr-cap">the three orders</div><table class="cr-table"><thead><tr>' +
      '<th></th><th>tag computed on</th><th>generically IND-CCA?</th></tr></thead><tbody>';
    ['etm', 'eam', 'mte'].forEach(function (id) {
      var X = MD_COMPOSE[id];
      h += '<tr' + (id === order ? ' class="cr-best"' : '') + '><td>' + esc(X.label) +
        '</td><td class="cr-dim">' + esc(X.tagOn) + '</td><td>' +
        (X.secure ? '<span class="cr-hit">yes</span>'
                  : '<span class="cr-miss">no</span>') + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="tool-note">' + esc(C.note) + '</div>';

    out.innerHTML = h;
  }
