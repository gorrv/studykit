  /* ============================================================
     CRYPTOGRAPHY TOPIC 04 · rendering
     ============================================================ */

  /* ---------- Tool 1 · how many permutations there are ---------- */

  function runPermCount() {
    var out = document.getElementById('pc-output');
    if (!out) return;
    var l = Number(((document.getElementById('pc-l') || {}).value) || 3);

    var r = bkPermCount(l);
    if (!r.ok) { out.innerHTML = '<div class="tool-error">' + esc(r.error) + '</div>'; return; }

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">&ell; = ' + l + '</span>' +
      '<span class="stat-pill dark">2<sup>' + l + '</sup> = ' + r.t + ' strings</span>' +
      '</div>';

    h += '<table class="cr-table"><tbody>' +
      '<tr><th>permutations of {0,1}<sup>' + l + '</sup></th><td><code>(2<sup>' + l +
        '</sup>)! = ' + r.t + '! = ' + r.count + '</code></td></tr>' +
      '<tr><th>as a power of two</th><td>&asymp; 2<sup>' + r.bits.toFixed(1) +
        '</sup></td></tr>' +
      '<tr><th>bits to write one down</th><td><code>&ell; &middot; 2<sup>&ell;</sup> = ' +
        r.toWrite + '</code> bits</td></tr>' +
      '</tbody></table>';

    h += '<div class="cr-cap">the same three numbers, as &ell; grows</div>' +
      '<table class="cr-table"><thead><tr><th>&ell;</th><th>(2<sup>&ell;</sup>)!</th>' +
      '<th>bits to write one down</th></tr></thead><tbody>';
    [1, 2, 3, 4, 5].forEach(function (n) {
      var q = bkPermCount(n);
      if (!q.ok) return;
      h += '<tr' + (n === l ? ' class="cr-best"' : '') + '><td>' + n + '</td>' +
        '<td><code>' + (q.count.length > 20 ? q.count.slice(0, 12) + '… (' +
          q.count.length + ' digits)' : q.count) + '</code></td>' +
        '<td>' + q.toWrite + '</td></tr>';
    });
    var big = bkHugeCase(128);
    h += '<tr><td>128</td><td>&asymp; 2<sup>' + big.log2OfCount.toExponential(2) +
      '</sup></td><td>&asymp; ' + big.bitsToWrite.toExponential(2) + '</td></tr>';
    h += '</tbody></table>';

    h += '<div class="verdict bad"><strong>So a key cannot simply be a permutation.</strong> ' +
      'At the block length a real cipher uses, writing one down takes about ' +
      big.bitsToWrite.toExponential(2) + ' bits &mdash; more bits than there are atoms worth ' +
      'of anything. The key has to be short and the permutation has to be <em>built</em> ' +
      'from it, which is what the rest of this topic is about.</div>';

    h += '<div class="tool-note">The exponent for &ell; = 128 is Stirling’s ' +
      'approximation, <code>log&#8322;(N!) &asymp; N log&#8322; N &minus; N log&#8322; e</code> ' +
      'with <code>N = 2<sup>128</sup></code>. The smaller rows are exact factorials, ' +
      'computed rather than quoted.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · the SPN, round by round ---------- */

  function runSPN() {
    var out = document.getElementById('sp-output');
    if (!out) return;
    var msg = bkBits(((document.getElementById('sp-msg') || {}).value) || '01100111', 8);
    var key = bkBits(((document.getElementById('sp-key') || {}).value) || '10110010', 8);
    var rounds = Number(((document.getElementById('sp-rounds') || {}).value) || 3);

    var f = bkSPN(key, msg, rounds, 4);
    var back = bkSPNInv(key, f.bits, rounds, 4);

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">&ell; = 8, &ell;&prime; = 4</span>' +
      '<span class="stat-pill dark">' + rounds + ' rounds</span>' +
      '<span class="stat-pill ' + (back.out === bkStr(msg) ? 'b' : 'c') + '">' +
        (back.out === bkStr(msg) ? 'inverts correctly' : 'does not invert') + '</span></div>';

    h += '<div class="cr-cap">forwards</div><table class="cr-table bk-trace"><tbody>';
    f.steps.forEach(function (st) {
      h += '<tr><th>' + st.label + '</th><td><code>' + bkSpaced(st.bits) + '</code></td>' +
        '<td class="cr-dim">' + (st.key ? 'round key <code>' + bkSpaced(st.key) + '</code>'
          : '') + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="cr-cap">and back again, using S&#8315;&sup1; and P&#8315;&sup1;</div>' +
      '<table class="cr-table bk-trace"><tbody>';
    back.steps.forEach(function (st) {
      h += '<tr><th>' + st.label + '</th><td><code>' + bkSpaced(st.bits) + '</code></td>' +
        '<td class="cr-dim"></td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="verdict ' + (back.out === bkStr(msg) ? 'safe' : 'bad') + '">' +
      (back.out === bkStr(msg)
        ? 'Back to <code>' + bkSpaced(back.out) + '</code>. Inverting needs <code>S' +
          '&#8315;&sup1;</code> and <code>P&#8315;&sup1;</code>, so <strong>an SPN only works ' +
          'if S and P are permutations</strong> &mdash; which is the difference between this ' +
          'and the Feistel construction below.'
        : 'It did not come back, which would mean S or P is not invertible.') + '</div>';

    /* Permutation for every key — the defining requirement, checked. */
    var p = crOnce('isperm' + bkStr(key) + rounds, function () {
      return bkIsPermutation(key, rounds, 8, 4);
    });
    h += '<div class="tool-note">A block cipher must be a permutation for <em>every</em> key. ' +
      'For this key, all ' + p.inputs + ' inputs were run: ' + p.images + ' distinct outputs, ' +
      p.collisions + ' collisions. Why it must be: &oplus; with a fixed string is a ' +
      'permutation, S is a permutation, P is a permutation, and a composition of ' +
      'permutations is a permutation &mdash; so every round is, and so is any number of ' +
      'them.<br><br>Note the last round applies no S and no P. They are public, so anyone ' +
      'could undo them; after the final key they would add nothing.</div>';

    out.innerHTML = h;
  }

  function bkSpaced(s) {
    return String(s).replace(/(.{4})/g, '$1 ').trim();
  }

  /* ---------- Tool 3 · Feistel, and why f need not invert ---------- */

  function runFeistel() {
    var out = document.getElementById('fe-output');
    if (!out) return;
    var msg = bkBits(((document.getElementById('fe-msg') || {}).value) || '01100111', 8);
    var key = bkBits(((document.getElementById('fe-key') || {}).value) || '10110010', 8);
    var rounds = Number(((document.getElementById('fe-rounds') || {}).value) || 3);
    var fnId = ((document.getElementById('fe-fn') || {}).value) || 'mix';

    var F = BK_ROUND_FNS[fnId];
    var f = bkFeistel(key, msg, rounds, fnId);
    var back = bkFeistelInv(key, f.bits, rounds, fnId);
    var inj = crOnce('inj' + fnId, function () { return bkRoundFnInjective(fnId, 4); });

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill dark">' + esc(F.label) + '</span>' +
      '<span class="stat-pill ' + (inj.injective ? 'a' : 'c') + '">' +
        (inj.injective ? 'f is injective' : 'f is NOT injective (' + inj.images + ' of ' +
          inj.inputs + ' outputs)') + '</span>' +
      '<span class="stat-pill ' + (back.out === bkStr(msg) ? 'b' : 'c') + '">' +
        (back.out === bkStr(msg) ? 'still inverts' : 'does not invert') + '</span></div>';

    h += '<div class="cr-cap">forwards &mdash; L<sub>i</sub> = R<sub>i&minus;1</sub>, ' +
      'R<sub>i</sub> = L<sub>i&minus;1</sub> &oplus; f(sk<sub>i</sub>, R<sub>i&minus;1</sub>)' +
      '</div><table class="cr-table bk-trace"><tbody>';
    f.steps.forEach(function (st) {
      h += '<tr><th>' + st.label + '</th><td><code>' + st.L + '</code> &#8741; <code>' +
        st.R + '</code></td><td class="cr-dim">' +
        (st.key ? 'sk<sub>' + st.round + '</sub> = <code>' + st.key + '</code>' : '') +
        '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="cr-cap">backwards &mdash; the same rounds, and f is never inverted</div>' +
      '<table class="cr-table bk-trace"><tbody>';
    back.steps.forEach(function (st) {
      h += '<tr><th>' + st.label + '</th><td><code>' + st.L + '</code> &#8741; <code>' +
        st.R + '</code></td><td class="cr-dim"></td></tr>';
    });
    h += '</tbody></table>';

    var rt = crOnce('frt' + bkStr(key) + rounds + fnId, function () {
      return bkFeistelRoundTrips(key, rounds, 8, fnId);
    });

    h += '<div class="verdict ' + (rt.bad === 0 ? 'safe' : 'bad') + '">' +
      (rt.bad === 0
        ? '<strong>Inverts on every one of the ' + rt.inputs + ' blocks</strong>, and the ' +
          'whole thing is still a permutation (' + rt.images + ' distinct outputs). ' +
          (inj.injective
            ? ''
            : 'And this round function is <em>not</em> injective &mdash; ' + inj.images +
              ' of its ' + inj.inputs + ' possible outputs ever occur. It does not matter.')
        : 'It failed to invert on ' + rt.bad + ' of ' + rt.inputs + ' blocks.') + '</div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">Why it works without inverting f</div>' +
      'Undoing a round needs <code>R<sub>i&minus;1</sub></code>, and that is just ' +
      '<code>L<sub>i</sub></code> &mdash; it was copied across untouched. Once you have it ' +
      'you can <em>recompute</em> <code>f(sk<sub>i</sub>, R<sub>i&minus;1</sub>)</code> and ' +
      'XOR it away: <code>L<sub>i&minus;1</sub> = R<sub>i</sub> &oplus; f(sk<sub>i</sub>, ' +
      'R<sub>i&minus;1</sub>)</code>. At no point is <code>f&#8315;&sup1;</code> needed, so ' +
      '<code>f</code> can be any function at all.<br><br>' +
      'That is a real design freedom: an SPN needs an invertible S-box, and a Feistel ' +
      'network needs nothing of its round function but that it be computable. Decryption is ' +
      'also the same circuit with the round keys in reverse.' +
      '</div>';

    h += '<div class="tool-note">' + esc(F.note) + '</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · the PRP game ---------- */

  function runPRP() {
    var out = document.getElementById('pr-output');
    if (!out) return;
    var cipher = ((document.getElementById('pr-cipher') || {}).value) || 'xoronly';
    var strat = ((document.getElementById('pr-strat') || {}).value) || 'difference';

    var r = crOnce('prp' + cipher + strat, function () {
      return bkPlayPRP(cipher, 8, strat, 3000, 4242);
    });
    var C = BK_CIPHERS[cipher], S = BK_STRATEGIES[strat];
    var pct = 100 * r.rate;
    var guessing = Math.abs(pct - 50) < 3;

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">PRP</span>' +
      '<span class="stat-pill dark">' + esc(C.label) + '</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>the challenger</th><td>samples a uniform bit <code>b</code> and a uniform ' +
        'key. For <code>b = 0</code> the oracle is <code>F(sk, &middot;)</code>; for ' +
        '<code>b = 1</code> it is a uniform permutation, built one answer at a time as it ' +
        'is asked.</td></tr>' +
      '<tr><th>the strategy</th><td>' + esc(S.label) + '</td></tr>' +
      '</tbody></table>';

    h += '<div class="cr-cap">' + r.trials.toLocaleString() + ' rounds</div>' +
      '<div class="cr-meter"><div class="cr-meter-bar" style="width:' +
        Math.max(0, Math.min(100, pct)).toFixed(1) + '%"></div>' +
      '<div class="cr-meter-half"></div></div>' +
      '<div class="cr-meter-l"><span>0%</span><span>½ &mdash; guessing</span>' +
      '<span>100%</span></div>';

    h += '<div class="verdict ' + (guessing ? 'safe' : 'bad') + '">' +
      '<strong>' + pct.toFixed(1) + '%.</strong> ' +
      (guessing
        ? 'Guessing. This strategy cannot tell the cipher from a uniform permutation.'
        : 'Noticeably better than a half, so this cipher is not a PRP &mdash; at least not ' +
          'against an adversary who thinks of this.') + '</div>';

    h += '<div class="tool-note">' + esc(S.note) + '</div>';

    /* The whole table, which is the actual lesson. */
    h += '<div class="cr-cap">every cipher against every strategy</div>' +
      '<table class="cr-table"><thead><tr><th></th>';
    var strats = ['difference', 'locality'];
    strats.forEach(function (sid) {
      h += '<th>' + esc(sid) + '</th>';
    });
    h += '</tr></thead><tbody>';
    ['xoronly', 'oneround', 'threeround'].forEach(function (cid) {
      h += '<tr><td>' + esc(BK_CIPHERS[cid].label) + '</td>';
      strats.forEach(function (sid) {
        var q = crOnce('prptab' + cid + sid, function () {
          return bkPlayPRP(cid, 8, sid, 2000, 4242);
        });
        var p = 100 * q.rate;
        h += '<td class="' + (Math.abs(p - 50) < 3 ? 'cr-hit' : 'cr-miss') + '">' +
          p.toFixed(0) + '%</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table>';

    h += '<div class="callout warn" style="margin:14px 0;">' +
      '<div class="callout-label">Read that table along the rows</div>' +
      'A plain XOR falls to both strategies. <strong>One round survives the first and falls ' +
      'to the second</strong>: the S-box breaks the difference relation immediately, but one ' +
      'application of P cannot carry a flipped bit outside the handful of positions it ' +
      'reaches, so the change stays local and that is visible. Three rounds survive both.' +
      '<br><br>That is the answer to "how many rounds?" in miniature. Each round buys ' +
      'diffusion, and you need enough of it that a one-bit change reaches everywhere.' +
      '</div>';

    h += '<div class="tool-note"><strong>An honest caveat.</strong> The block here is 8 bits, ' +
      'so the whole function is 256 entries and an adversary allowed enough queries simply ' +
      'reads it off and wins outright, whatever the round count. "Three rounds survive both" ' +
      'means these two strategies, not that this toy is a PRP. Real block ciphers use ' +
      '&ell; = 64 or 128 precisely so that reading the table is not an option.</div>';

    out.innerHTML = h;
  }
