  /* ============================================================
     CRYPTOGRAPHY TOPIC 02 · rendering
     ============================================================ */

  /* ---------- Tool 1 · counting the functions ---------- */

  function runCount() {
    var out = document.getElementById('ct-output');
    if (!out) return;
    var s = Number(((document.getElementById('ct-s') || {}).value) || 3);
    var t = Number(((document.getElementById('ct-t') || {}).value) || 4);

    var f = gmCount(s, t);
    var e = gmEnumerate(s, t);
    if (!e.ok) { out.innerHTML = '<div class="tool-error">' + esc(e.error) + '</div>'; return; }

    var agree = f.functions === e.functions && f.injective === e.injective;

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">|M| = ' + s + '</span>' +
      '<span class="stat-pill a">|C| = ' + t + '</span>' +
      '<span class="stat-pill ' + (f.possible ? 'b' : 'c') + '">' +
      (f.possible ? 'a correct scheme is possible' : 'no correct scheme exists') +
      '</span></div>';

    h += '<table class="cr-table"><thead><tr><th></th><th>the formula</th>' +
      '<th>counted by building them all</th></tr></thead><tbody>' +
      '<tr><td>functions M &rarr; C</td><td><code>t<sup>s</sup></code> = ' +
        f.functions.toLocaleString() + '</td><td>' + e.functions.toLocaleString() + '</td></tr>' +
      '<tr><td>injective ones</td><td><code>C(t, s) &middot; s!</code> = ' +
        f.injective.toLocaleString() + '</td><td>' + e.injective.toLocaleString() + '</td></tr>' +
      (s === t
        ? '<tr><td>bijections</td><td><code>s!</code> = ' + f.bijections.toLocaleString() +
          '</td><td>' + e.injective.toLocaleString() + '</td></tr>'
        : '') +
      '</tbody></table>';

    h += '<div class="verdict ' + (agree ? 'safe' : 'bad') + '">' +
      (agree
        ? 'The formula and the count agree. Every one of the ' + e.functions.toLocaleString() +
          ' functions was built and inspected, so this is the number of objects there are, ' +
          'not the number the formula says there should be.'
        : 'They disagree, which means one of them is wrong.') + '</div>';

    /* Why Enc has to be one of the injective ones. */
    var inj = gmInjectiveNeeded(s, t);
    if (inj.ok) {
      h += '<div class="cr-cap">and how many of them could be an Enc at all</div>' +
        '<table class="cr-table"><tbody>' +
        '<tr><th>have some Dec making them correct</th><td>' +
          inj.invertible.toLocaleString() + '</td></tr>' +
        '<tr><th>are injective</th><td>' + inj.injective.toLocaleString() + '</td></tr>' +
        '<tr><th>in one group but not the other</th><td><code class="' +
          (inj.mismatch === 0 ? 'cr-hit' : 'cr-miss') + '">' + inj.mismatch +
          '</code></td></tr></tbody></table>' +
        '<div class="verdict ' + (inj.mismatch === 0 ? 'safe' : 'bad') + '">' +
        (inj.mismatch === 0
          ? 'The same functions, exactly. A scheme can be made correct precisely when Enc ' +
            'is injective — checked here against every function, rather than argued.'
          : 'The two groups differ, which would refute the claim.') + '</div>';
    }

    h += '<div class="tool-note">The reason is short. <code>Dec</code> sees the ciphertext ' +
      'and nothing else. If two messages share a ciphertext, <code>Dec</code> has one value ' +
      'to return and two messages needing it, so it fails for at least one of them. Hence ' +
      '<code>Enc</code> is injective, and hence <code>|C| &ge; |M|</code>: you cannot encrypt ' +
      'into a space smaller than the one you started in.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · play the game ---------- */

  function runGame() {
    var out = document.getElementById('gm-output');
    if (!out) return;
    var scheme = ((document.getElementById('gm-scheme') || {}).value) || 'otpFresh';
    var adv = ((document.getElementById('gm-adv') || {}).value) || 'coin';
    var game = ((document.getElementById('gm-game') || {}).value) || 'eav';

    var r = gmPlay(scheme, adv, game, 4000, 20251009);
    var S = GM_SCHEMES[scheme], A = GM_ADVERSARIES[adv];

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">' + game.toUpperCase() + '</span>' +
      '<span class="stat-pill dark">' + esc(S.label) + '</span>' +
      '<span class="stat-pill dark">' + (S.det ? 'deterministic Enc' : 'randomised Enc') +
      '</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>the adversary may</th><td>' +
        ({ eav: 'see one challenge ciphertext, and nothing else',
           cpa: 'encrypt messages of its choice, then see the challenge',
           cca: 'encrypt and decrypt messages of its choice &mdash; except the challenge ' +
                'ciphertext itself &mdash; then see the challenge' })[game] + '</td></tr>' +
      '<tr><th>its strategy</th><td>' + esc(A.label) + '</td></tr>' +
      '</tbody></table>';

    if (!r.ok) {
      h += '<div class="verdict warn"><strong>Not available in this game.</strong> ' +
        esc(r.error) + '</div>' +
        '<div class="tool-note">That is the whole point of having three definitions. A ' +
        'scheme is not secure or insecure on its own; it is secure against an adversary ' +
        'with stated powers, and taking a power away can make the same scheme look fine.</div>';
      out.innerHTML = h;
      return;
    }

    var pct = 100 * r.rate;
    var decisive = pct > 95 || pct < 5;
    var baseline = Math.abs(pct - 50) < 3;

    h += '<div class="cr-cap">' + r.rounds.toLocaleString() + ' rounds played</div>' +
      '<div class="cr-meter"><div class="cr-meter-bar" style="width:' +
        Math.max(0, Math.min(100, pct)).toFixed(1) + '%"></div>' +
      '<div class="cr-meter-half" title="guessing"></div></div>' +
      '<div class="cr-meter-l"><span>0%</span><span>½ &mdash; guessing</span>' +
      '<span>100%</span></div>';

    h += '<div class="verdict ' + (baseline ? 'safe' : (decisive ? 'bad' : 'warn')) + '">' +
      '<strong>Wins ' + pct.toFixed(1) + '% of the time.</strong> ' +
      (baseline
        ? 'Which is guessing. The adversary learned nothing from the ciphertext, so this ' +
          'scheme survives ' + game.toUpperCase() + ' against this strategy.'
        : decisive
          ? 'Not a slight advantage &mdash; it is right essentially every time. The scheme ' +
            'is broken under ' + game.toUpperCase() + ', and no amount of key length fixes ' +
            'a distinguisher that does not care about the key.'
          : 'Noticeably different from one half, which is all the definition asks for. ' +
            'A definition that demanded certainty would call this secure.') + '</div>';

    if (game === 'cca' && r.refusals > 0) {
      h += '<div class="tool-note">The decryption oracle refused the challenge ciphertext ' +
        r.refusals.toLocaleString() + ' times, as the game requires. Without that rule the ' +
        'adversary would simply hand back <code>c<sub>b</sub></code> and be told the answer, ' +
        'and no scheme could ever win &mdash; the definition would be empty.</div>';
    }

    h += '<div class="tool-note">Why one half and not zero: the adversary can always flip a ' +
      'coin, so half is what winning means when nothing has been learned. For a MAC the ' +
      'baseline is zero instead, because forging a tag is making something rather than ' +
      'choosing between two equally likely answers.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · forging a tag ---------- */

  function runForge() {
    var out = document.getElementById('fg-output');
    if (!out) return;
    var msg = ((document.getElementById('fg-msg') || {}).value) || 'crypto';
    var ik = Number(((document.getElementById('fg-ik') || {}).value) || 9);

    var r = gmForge(msg);
    if (!r.ok) { out.innerHTML = '<div class="tool-error">' + esc(r.error) + '</div>'; return; }

    var tag = r.tagAt(ik);

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">EUF-CMA</span>' +
      '<span class="stat-pill dark">Tag(ik, m) = &Sigma;m + ik mod 26</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>1 &middot; asks the oracle for a tag on</th><td><code>' + esc(r.queried) +
        '</code> &rarr; <code>&tau; = ' + tag + '</code></td></tr>' +
      '<tr><th>Q is now</th><td><code>{' + esc(r.queried) + '}</code></td></tr>' +
      '</tbody></table>';

    h += '<table class="cr-table cr-steps cr-attack"><tbody>' +
      '<tr><th>2 &middot; outputs the pair</th><td><code>(' + esc(r.forged) + ', ' + tag +
        ')</code></td></tr>' +
      '<tr><th>is that message in Q?</th><td><code class="' +
        (r.isNew ? 'cr-hit' : 'cr-miss') + '">' + (r.isNew ? 'no — it is new' : 'yes') +
        '</code></td></tr>' +
      '<tr><th>does Vf accept it?</th><td><code class="cr-hit">' +
        (gmSumVerify(ik, gmNums2(r.forged), tag) ? '1' : '0') + '</code></td></tr>' +
      '</tbody></table>';

    h += '<div class="verdict bad"><strong>Forged.</strong> A valid tag on a message the ' +
      'oracle was never asked about, which is exactly what EUF-CMA says must not happen. ' +
      'The tag is a sum, and a sum does not notice the order of what it adds up &mdash; so ' +
      'any rearrangement of a tagged message carries its tag with it.</div>';

    h += '<div class="cr-cap">and it does not depend on the key</div>' +
      '<div class="tool-note">The forger has no key and never learns one. Checked against ' +
      'all ' + r.keysChecked + ' keys for this message: ' + r.keysFailed + ' failures. ' +
      'Over every two-letter message and every key &mdash; ' +
      gmForgeRate(2).total.toLocaleString() + ' games &mdash; the forgery succeeds ' +
      (100 * gmForgeRate(2).rate).toFixed(0) + '% of the time. "Noticeably different from ' +
      'zero" is doing a lot of understating here.</div>';

    out.innerHTML = h;
  }

  function gmNums2(s) {
    var out = [], a = 'abcdefghijklmnopqrstuvwxyz';
    for (var i = 0; i < s.length; i++) {
      var k = a.indexOf(s.charAt(i));
      if (k >= 0) out.push(k);
    }
    return out;
  }

  /* ---------- Tool 4 · canonical verification ---------- */

  function runCanonical() {
    var out = document.getElementById('cv-output');
    if (!out) return;
    var randomised = ((document.getElementById('cv-mode') || {}).value) === 'random';

    var r = gmCanonical(randomised, 4000, 7);

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill ' + (randomised ? 'c' : 'b') + '">' +
      (randomised ? 'randomised Tag' : 'deterministic Tag') + '</span>' +
      '<span class="stat-pill dark">canonical Vf</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>what canonical Vf does</th><td>recompute <code>&tau;&prime; = Tag(ik, m)</code> ' +
        'and output 1 exactly when <code>&tau; = &tau;&prime;</code></td></tr>' +
      '<tr><th>honest pairs tested</th><td>' + r.trials.toLocaleString() + '</td></tr>' +
      '<tr><th>rejected</th><td><code class="' + (r.rejected ? 'cr-miss' : 'cr-hit') + '">' +
        r.rejected.toLocaleString() + '</code> (' + (100 * r.rate).toFixed(1) + '%)</td></tr>' +
      '</tbody></table>';

    h += '<div class="verdict ' + (r.rejected === 0 ? 'safe' : 'bad') + '">' +
      (r.rejected === 0
        ? '<strong>Correct.</strong> Every honestly produced tag verifies. With a ' +
          'deterministic Tag there is only one tag per message, so recomputing it is the ' +
          'same as checking it &mdash; which is why canonical verification costs nothing ' +
          'here.'
        : '<strong>Correctness fails.</strong> These are tags the honest tagger produced, ' +
          'on messages it was asked about, and canonical Vf threw ' + (100 * r.rate).toFixed(0) +
          '% of them out. Nothing has been attacked; the scheme simply does not work.') +
      '</div>';

    h += '<div class="tool-note">That is the answer to "why does canonical verification ' +
      'require a deterministic Tag?". If Tag may use randomness, a message has many valid ' +
      'tags, and the verifier can only produce one of them &mdash; so it rejects the other ' +
      'ones, which were perfectly genuine. A Vf for a randomised Tag has to check some ' +
      'property the tag satisfies, not simply recompute and compare.</div>';

    out.innerHTML = h;
  }
