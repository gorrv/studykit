  /* ============================================================
     CRYPTOGRAPHY TOPIC 01 · rendering

     Nothing is computed here. Every number below comes from t1-ske.js,
     which the test suite drives directly.
     ============================================================ */

  /* ---------- Tool 1 · correct, and still broken ---------- */

  function runSchemeAudit() {
    var out = document.getElementById('sa-output');
    if (!out) return;
    var id = ((document.getElementById('sa-scheme') || {}).value) || 'identity';
    var S = SK_SCHEMES[id];
    var msg = ((document.getElementById('sa-msg') || {}).value) || 'attack at dawn';

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">' + esc(S.label) + '</span>' +
      '<span class="stat-pill dark">key: ' + esc(S.keyKind) + '</span></div>';

    /* Correctness first, and separately — that is the whole point. */
    var corr = id === 'otp'
      ? { ok: true, skip: true }
      : skCorrect(id, 3);

    if (corr.skip) {
      h += '<div class="verdict safe"><strong>Correct.</strong> Subtracting the same pad ' +
        'that was added returns the message, for any key and any message. The key space ' +
        'here depends on the message length, so there is no fixed set to run through — ' +
        'the tool below exhausts the one-letter case instead.</div>';
    } else {
      h += '<div class="verdict ' + (corr.bad === 0 ? 'safe' : 'bad') + '">' +
        '<strong>' + (corr.bad === 0 ? 'Correct.' : 'Not even correct.') + '</strong> ' +
        'Decrypting an encryption returns the message in ' +
        (corr.total - corr.bad).toLocaleString() + ' of ' + corr.total.toLocaleString() +
        ' cases — every key (' + corr.keys + ') against every three-letter message (' +
        Math.pow(26, 3).toLocaleString() + '). That is the whole domain, not a sample.</div>';
    }

    /* Then security, which correctness said nothing about. */
    var rungName = { 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v' };
    h += '<div class="cr-break"><div class="cr-cap">and here is what breaks it</div>';

    if (id === 'identity') {
      var r = skReadOff('identity', msg);
      h += '<table class="cr-table"><tbody>' +
        '<tr><th>message</th><td><code>' + esc(r.plaintext) + '</code></td></tr>' +
        '<tr><th>ciphertext</th><td><code>' + esc(r.ciphertext) + '</code></td></tr>' +
        '</tbody></table>' +
        '<div class="verdict bad">No attack required. The ciphertext <em>is</em> the ' +
        'message' + (r.identical ? '' : ' (up to the letters that were dropped)') +
        '. The key is perfectly safe, because nothing ever uses it — which is exactly ' +
        'why "you cannot recover the key" is not a definition of security.</div>';

    } else if (id === 'keepfirst') {
      var k = Number(((document.getElementById('sa-key') || {}).value) || 7);
      var p = skPartial(msg, k);
      if (!p.ok) { out.innerHTML = h + '<div class="tool-error">' + esc(p.error) + '</div>'; return; }
      h += '<table class="cr-table"><tbody>' +
        '<tr><th>message</th><td><code>' + esc(p.plaintext) + '</code></td></tr>' +
        '<tr><th>ciphertext</th><td><code>' + esc(p.ciphertext) + '</code></td></tr>' +
        '<tr><th>read straight off</th><td><code class="cr-hit">' + esc(p.leaked) +
          '</code> &mdash; the first letter, which really is <code>' + esc(p.truth) +
          '</code></td></tr></tbody></table>' +
        '<div class="verdict ' + (p.correct ? 'bad' : 'warn') + '">' +
        'The rest of the message is as hidden as the shift cipher makes it, and one letter ' +
        'is simply there. Nobody needed the key, and nobody had to do any work. "You cannot ' +
        'recover <em>the</em> message" is not enough either: a part is enough to lose.</div>';

    } else if (id === 'shift') {
      var k2 = Number(((document.getElementById('sa-key') || {}).value) || 7);
      var b = skBreakShift(msg, k2);
      if (!b.ok) { out.innerHTML = h + '<div class="tool-error">' + esc(b.error) + '</div>'; return; }
      h += '<table class="cr-table"><tbody>' +
        '<tr><th>message</th><td><code>' + esc(b.plaintext) + '</code></td></tr>' +
        '<tr><th>ciphertext</th><td><code>' + esc(b.ciphertext) + '</code></td></tr>' +
        '<tr><th>key used</th><td><code>' + b.key + '</code></td></tr>' +
        '<tr><th>key the attack found</th><td><code class="' +
          (b.correct ? 'cr-hit' : 'cr-miss') + '">' + b.found + '</code>' +
          (b.correct ? '' : ' &mdash; wrong, on only ' + b.letters + ' letters') +
        '</td></tr></tbody></table>';
      h += '<div class="cr-cap">the three best-scoring shifts, by &chi;&sup2; against English</div>' +
        '<table class="cr-table"><thead><tr><th>shift</th><th>&chi;&sup2;</th>' +
        '<th>what it reads as</th></tr></thead><tbody>';
      b.ranked.slice(0, 3).forEach(function (s, i) {
        h += '<tr' + (i === 0 ? ' class="cr-best"' : '') + '><td>' + s.key + '</td>' +
          '<td>' + s.chi.toFixed(1) + '</td><td><code>' + esc(s.guess.slice(0, 48)) +
          (s.guess.length > 48 ? '…' : '') + '</code></td></tr>';
      });
      h += '</tbody></table>' +
        '<div class="verdict bad">Nothing here knew the key. The attack had the ciphertext ' +
        'and a table of English letter frequencies, and that was enough — because a shift ' +
        'moves the letter counts around without changing them.</div>';

    } else if (id === 'otp') {
      var mal = skMalleate(msg, msg.replace(/[a-z]/gi, 'x'), 1234);
      h += '<div class="verdict warn"><strong>Not broken by looking.</strong> No amount of ' +
        'ciphertext tells an eavesdropper anything about the message — the tool further down ' +
        'the page counts that out in full. It falls at the last rung instead: someone who ' +
        'can <em>write</em> on the parchment chooses what the receiver reads, without ever ' +
        'learning the message or touching the key.</div>';
    }
    h += '</div>';

    h += '<div class="tool-note">This scheme is the first one that fails rung <strong>' +
      (rungName[S.rung] || '?') + '</strong>: ' + S.why + '</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · what the letters give away ---------- */

  function runFreq() {
    var out = document.getElementById('fq-output');
    if (!out) return;
    var msg = ((document.getElementById('fq-msg') || {}).value) || SK_SAMPLE;
    var key = Number(((document.getElementById('fq-key') || {}).value) || 7);

    var m = skNums(msg);
    if (!m.length) { out.innerHTML = '<div class="tool-error">Type something with letters in it.</div>'; return; }
    var c = SK_SCHEMES.shift.enc(key, m);
    var before = skCounts(m), after = skCounts(c);
    var top = Math.max.apply(null, before.concat(after)) || 1;

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">' + m.length + ' letters</span>' +
      '<span class="stat-pill dark">shift ' + key + '</span></div>';

    h += '<div class="cr-cap">the counts before, and after &mdash; the same bars, moved ' +
      key + ' place' + (key === 1 ? '' : 's') + ' along</div><div class="cr-bars">';
    for (var i = 0; i < 26; i++) {
      h += '<div class="cr-bar"><div class="cr-bar-pair">' +
        '<span class="cr-b before" style="height:' + (100 * before[i] / top).toFixed(1) + '%"></span>' +
        '<span class="cr-b after" style="height:' + (100 * after[i] / top).toFixed(1) + '%"></span>' +
        '</div><span class="cr-bar-l">' + SK_ALPHA_UI.charAt(i) + '</span></div>';
    }
    h += '</div><div class="cr-legend"><span class="cr-key before"></span>message ' +
      '<span class="cr-key after"></span>ciphertext</div>';

    var r = skChi(c);
    var ranked = r.scores.slice().sort(function (a, b) { return a.chi - b.chi; });
    h += '<div class="cr-cap">every shift, scored against English</div>' +
      '<table class="cr-table"><thead><tr><th>shift</th><th>&chi;&sup2;</th>' +
      '<th>reads as</th></tr></thead><tbody>';
    ranked.slice(0, 5).forEach(function (s, i) {
      h += '<tr' + (i === 0 ? ' class="cr-best"' : '') + '><td>' + s.key +
        (s.key === key ? ' <span class="cr-tag">the real one</span>' : '') + '</td>' +
        '<td>' + s.chi.toFixed(1) + '</td>' +
        '<td><code>' + esc(s.guess.slice(0, 44)) + (s.guess.length > 44 ? '…' : '') +
        '</code></td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="verdict ' + (r.best.key === key ? 'bad' : 'warn') + '">' +
      (r.best.key === key
        ? 'Recovered the key from the ciphertext alone, on ' + m.length + ' letters.'
        : 'On ' + m.length + ' letters the attack guessed ' + r.best.key + ' rather than ' +
          key + '. Short messages are the only thing protecting this cipher, and they do ' +
          'not protect it for long.') + '</div>';

    /* How much is enough — measured over the sample, not estimated. */
    h += '<div class="cr-cap">how much ciphertext this needs, measured</div>' +
      '<table class="cr-table"><thead><tr><th>letters</th><th>key recovered</th>' +
      '<th>windows tried</th></tr></thead><tbody>';
    [5, 10, 20, 30, 40].forEach(function (n) {
      var e = skEnoughText(n);
      if (!e.ok) return;
      h += '<tr><td>' + n + '</td><td>' + (100 * e.rate).toFixed(1) + '%</td>' +
        '<td>' + e.total.toLocaleString() + '</td></tr>';
    });
    h += '</tbody></table><div class="tool-note">Every window of that many letters taken ' +
      'from a fixed passage. No randomness: the same sweep gives the same figure every time, ' +
      'and the test suite runs it too. Thirty letters is enough to make the shift cipher a ' +
      'formality.<br><br>The key is not a variable here. Encrypting rotates the letter ' +
      'counts and decrypting rotates them back, so every score depends only on the ' +
      '<em>difference</em> between the real key and the guess &mdash; which means the attack ' +
      'either works for all 26 keys on a given stretch of text or for none of them. Running ' +
      'each window 26 times would report a bigger number and learn nothing; the suite checks ' +
      'that reasoning separately.</div>';

    out.innerHTML = h;
  }

  var SK_ALPHA_UI = 'abcdefghijklmnopqrstuvwxyz';

  /* ---------- Tool 3 · rewriting a message you cannot read ---------- */

  function runMalleate() {
    var out = document.getElementById('ml-output');
    if (!out) return;
    var msg = ((document.getElementById('ml-msg') || {}).value) || 'pay alice ten';
    var tgt = ((document.getElementById('ml-target') || {}).value) || 'pay carol ten';
    var tagged = !!(document.getElementById('ml-tag') || {}).checked;

    var r = skWithTag(msg, tgt, 20250911, 47);
    if (!r.ok) { out.innerHTML = '<div class="tool-error">' + esc(r.error) + '</div>'; return; }
    var b = r.base;

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">' + b.message.length + ' letters</span>' +
      '<span class="stat-pill ' + (tagged ? 'b' : 'c') + '">' +
      (tagged ? 'tag checked on arrival' : 'no integrity check') + '</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>Francis writes</th><td><code>' + esc(b.message) + '</code></td></tr>' +
      '<tr><th>key, which only the lords have</th><td><code class="cr-dim">' +
        esc(b.key) + '</code></td></tr>' +
      '<tr><th>ciphertext on the parchment</th><td><code>' + esc(b.ciphertext) +
        '</code></td></tr>' +
      (tagged ? '<tr><th>tag written beside it</th><td><code>' + r.tag + '</code></td></tr>' : '') +
      '</tbody></table>';

    h += '<div class="cr-cap">the rider, who knows neither the key nor what it says</div>' +
      '<table class="cr-table cr-steps cr-attack"><tbody>' +
      '<tr><th>wants it to read</th><td><code>' + esc(b.target) + '</code></td></tr>' +
      '<tr><th>adds this, letter by letter</th><td><code>' + esc(b.delta) + '</code></td></tr>' +
      '<tr><th>parchment now says</th><td><code>' + esc(b.tampered) + '</code></td></tr>' +
      '</tbody></table>';

    if (tagged) {
      h += '<table class="cr-table cr-steps"><tbody>' +
        '<tr><th>tag Henry recomputes</th><td><code>' + r.tagOnArrival + '</code></td></tr>' +
        '<tr><th>tag on the parchment</th><td><code>' + r.tag + '</code></td></tr>' +
        '</tbody></table>' +
        '<div class="verdict ' + (r.acceptedAfter ? 'bad' : 'safe') + '">' +
        (r.acceptedAfter
          ? '<strong>Accepted.</strong> The tag did not notice.'
          : '<strong>Rejected.</strong> Henry never decrypts it. The tag depends on the ' +
            'ciphertext and on a key the rider does not have, so changing one without the ' +
            'other is caught.') + '</div>';
    } else {
      h += '<div class="verdict ' + (b.worked ? 'bad' : 'warn') + '">' +
        '<strong>Henry decrypts <code>' + esc(b.received) + '</code>.</strong> ' +
        (b.worked
          ? 'Exactly what the rider chose, and the decryption is perfectly valid: Henry has ' +
            'no way to tell. The pad kept the message secret from the rider the entire time ' +
            '&mdash; secrecy was never the property that was going to help here.'
          : 'Which is not what the rider was aiming at.') + '</div>';
    }

    var ex = skMalleableAlways(1);
    h += '<div class="tool-note">This is not a quirk of the message above. Over every ' +
      'single-letter message, every key and every target &mdash; ' +
      ex.total.toLocaleString() + ' cases &mdash; the rewrite lands on the target exactly ' +
      (ex.total - ex.bad).toLocaleString() + ' times. The pad adds a letter to each letter ' +
      'independently, so a longer message is that case repeated, not a different one.' +
      '<br><br>The tag here is a keyed checksum written to show the <em>shape</em> of the ' +
      'fix &mdash; a second key, a value that depends on the ciphertext, checked before ' +
      'decrypting. It is not a construction to rely on, and building one that holds up is a ' +
      'topic of its own.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · why the pad is in a different class ---------- */

  function runPerfect() {
    var out = document.getElementById('pf-output');
    if (!out) return;
    var n = Number(((document.getElementById('pf-n') || {}).value) || 1);

    var r = skPerfect(n);
    if (!r.ok) { out.innerHTML = '<div class="tool-error">' + esc(r.error) + '</div>'; return; }

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">' + r.messages.toLocaleString() + ' messages</span>' +
      '<span class="stat-pill a">' + r.keys.toLocaleString() + ' keys</span>' +
      '<span class="stat-pill a">' + r.ciphertexts.toLocaleString() + ' ciphertexts</span>' +
      '<span class="stat-pill ' + (r.uniform ? 'b' : 'c') + '">' +
        r.pairs.toLocaleString() + ' pairs checked</span></div>';

    h += '<div class="verdict ' + (r.uniform ? 'safe' : 'bad') + '">' +
      (r.uniform
        ? '<strong>Every message explains every ciphertext, in exactly one way.</strong> ' +
          'For each of the ' + r.pairs.toLocaleString() + ' (message, ciphertext) pairs there ' +
          'is precisely ' + r.kinds.join(' and ') + ' key that connects them.'
        : '<strong>Not uniform.</strong> Some pairs are joined by ' + r.kinds.join(' or ') +
          ' keys, so some messages are better explanations of a ciphertext than others.') +
      '</div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">Why that sentence is the whole argument</div>' +
      'Suppose you intercept a ciphertext and you believed, before seeing it, that the ' +
      'message was <code>no</code> with some probability. There is exactly one key that ' +
      'turns <code>no</code> into what you are holding — and exactly one that turns ' +
      '<code>go</code> into it, and one for every other message of that length. The key ' +
      'was chosen uniformly, so every message remains as likely as it was. ' +
      'The ciphertext has told you nothing, and that is not a statement about how hard you ' +
      'are willing to work: no amount of computation extracts information that is not ' +
      'there.<br><br>' +
      'This is counted above rather than argued: ' + r.pairs.toLocaleString() + ' pairs, ' +
      'every one with the same number of keys behind it.</div>';

    h += '<div class="tool-note">Two letters is 456,976 pairs and is as far as this goes in ' +
      'a browser. The argument does not depend on the length &mdash; it is the same count ' +
      'at every size &mdash; but seeing it done for every case at one size is worth more ' +
      'than being told it holds at all of them.</div>';

    out.innerHTML = h;
  }
