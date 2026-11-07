  /* ============================================================
     CRYPTOGRAPHY TOPIC 03 · rendering
     ============================================================ */

  /* ---------- Tool 1 · the three ciphers, and their key spaces ---------- */

  function runCiphers() {
    var out = document.getElementById('hc-output');
    if (!out) return;
    var which = ((document.getElementById('hc-which') || {}).value) || 'caesar';
    var msg = ((document.getElementById('hc-msg') || {}).value) || 'attack at dawn';
    var keyText = ((document.getElementById('hc-key') || {}).value) || 'key';

    var m = hiNums(msg);
    if (!m.length) { out.innerHTML = '<div class="tool-error">Type a message with letters in it.</div>'; return; }

    var ks = hiKeySpaces(5);
    var c, dec, keyShown, space;

    if (which === 'caesar') {
      var k = hiNums(keyText).length ? hiNums(keyText)[0] : 3;
      c = hiCaesarEnc(k, m); dec = hiCaesarDec(k, c);
      keyShown = k + ' &nbsp;<span class="cr-dim">(' + HI_ALPHA.charAt(k) + ')</span>';
      space = ks.caesar;
    } else if (which === 'subst') {
      var perm = hiPerm(hiNums(keyText).reduce(function (a, x) { return a * 31 + x; }, 7) || 1);
      c = hiSubstEnc(perm, m); dec = hiSubstDec(perm, c);
      keyShown = '<code class="cr-small">' + hiText(perm) + '</code>';
      space = ks.subst;
    } else {
      var key = hiNums(keyText);
      if (!key.length) key = hiNums('key');
      c = hiVigEnc(key, m); dec = hiVigDec(key, c);
      keyShown = '<code>' + esc(hiText(key)) + '</code> &nbsp;<span class="cr-dim">(' +
        key.length + ' letters, repeating)</span>';
      space = ks.vigenere;
    }

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">|K| = ' + (space.size.length > 12
        ? space.size.slice(0, 3) + '…' + ' (' + space.size.length + ' digits)'
        : Number(space.size).toLocaleString()) + '</span>' +
      '<span class="stat-pill dark">&asymp; 2<sup>' + space.bits.toFixed(1) + '</sup></span>' +
      '<span class="stat-pill ' + (space.bits < 40 ? 'c' : 'b') + '">' +
        (space.bits < 40 ? 'brute-forceable' : 'too big to search') + '</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>key</th><td>' + keyShown + '</td></tr>' +
      '<tr><th>message</th><td><code>' + esc(hiText(m)) + '</code></td></tr>' +
      '<tr><th>ciphertext</th><td><code>' + esc(hiText(c)) + '</code></td></tr>' +
      '<tr><th>decrypted again</th><td><code>' + esc(hiText(dec)) + '</code> ' +
        (hiText(dec) === hiText(m) ? '<span class="cr-hit">&#10003;</span>'
                                   : '<span class="cr-miss">&#10007;</span>') + '</td></tr>' +
      '</tbody></table>';

    if (which === 'vigenere') {
      var key2 = hiNums(keyText).length ? hiNums(keyText) : hiNums('key');
      h += '<div class="cr-cap">which shift each letter gets</div><div class="cr-strip">';
      for (var i = 0; i < Math.min(m.length, 30); i++) {
        h += '<span class="cr-cell"><b>' + HI_ALPHA.charAt(m[i]) + '</b>' +
          '<i>+' + key2[i % key2.length] + '</i>' +
          '<u>' + HI_ALPHA.charAt(c[i]) + '</u></span>';
      }
      h += '</div><div class="tool-note">The key repeats, so this is ' + key2.length +
        ' separate Caesar ciphers interleaved &mdash; which is exactly how it is broken.</div>';
    }

    h += '<div class="cr-cap">the weaknesses this one has</div><ul class="cr-weak">';
    var weak = {
      caesar: ['the key space is 26, so you can simply try them all',
               'one message-ciphertext pair hands over the key',
               'the gaps between letters survive untouched &mdash; see the trace below',
               'letter frequencies pass straight through',
               'and most fundamentally, <strong>Enc is deterministic</strong>'],
      subst: ['a message-ciphertext pair gives away part of the key',
              'letter frequencies still pass through, one letter at a time',
              'and most fundamentally, <strong>Enc is deterministic</strong>'],
      vigenere: ['a message-ciphertext pair gives away the key',
                 'frequency analysis is harder, not impossible: split by key length first',
                 'and most fundamentally, <strong>Enc is deterministic</strong>']
    }[which];
    weak.forEach(function (x) { h += '<li>' + x + '</li>'; });
    h += '</ul>';

    h += '<div class="tool-note">Only the first of these is fixed by a bigger key space, ' +
      'which is why each cipher here is a patch on the last one and none of them is secure. ' +
      'A larger key is necessary, and nowhere near sufficient.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · the trace ---------- */

  function runTrace() {
    var out = document.getElementById('tr-output');
    if (!out) return;
    var word = ((document.getElementById('tr-word') || {}).value) || 'hello';
    var ctText = ((document.getElementById('tr-ct') || {}).value) || '';

    var m = hiNums(word);
    if (m.length < 2) { out.innerHTML = '<div class="tool-error">Give a word of at least two letters.</div>'; return; }
    var tr = hiTrace(m);

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">trace(' + esc(hiText(m)) + ') = (' + tr.join(', ') +
      ')</span></div>';

    h += '<div class="cr-cap">every Caesar encryption of it, and its trace</div>' +
      '<table class="cr-table"><thead><tr><th>key</th><th>ciphertext</th><th>trace</th>' +
      '</tr></thead><tbody>';
    var allSame = true;
    for (var k = 0; k < 26; k += (26 / 6 | 0) || 1) {
      var c = hiCaesarEnc(k, m), t2 = hiTrace(c);
      if (t2.join(',') !== tr.join(',')) allSame = false;
      h += '<tr><td>' + k + '</td><td><code>' + esc(hiText(c)) + '</code></td>' +
        '<td><code>(' + t2.join(', ') + ')</code></td></tr>';
    }
    h += '</tbody></table>';

    var every = true;
    for (var kk = 0; kk < 26; kk++) {
      if (hiTrace(hiCaesarEnc(kk, m)).join(',') !== tr.join(',')) every = false;
    }

    h += '<div class="verdict ' + (every ? 'bad' : 'warn') + '">' +
      (every
        ? '<strong>All 26 keys, the same trace.</strong> A shift moves every letter by the ' +
          'same amount, so the gaps between them are exactly what it fails to change. The ' +
          'trace is information about the message that the ciphertext carries in the open.'
        : 'Something is wrong: the trace changed under a shift.') + '</div>';

    var claim = crOnce('traceclaim3', function () { return hiTraceClaim(3); });
    h += '<div class="tool-note">And it goes the other way: a ciphertext can decrypt to a ' +
      'message exactly when the two share a trace. Checked over every three-letter message ' +
      '&mdash; for each of the ' + claim.messages.toLocaleString() + ' of them, the 26 ' +
      'ciphertexts reachable by some key are precisely the 26 strings with the same trace, ' +
      'with ' + claim.mismatch + ' exceptions.</div>';

    /* The crib scan, which needs no key at all. */
    var ct = ctText || hiText(hiCaesarEnc(5, hiNums('the secret message')));
    var scan = hiCribScan(ct);
    h += '<div class="cr-cap">scanning a ciphertext for the trace of a common word</div>' +
      '<table class="cr-table cr-steps"><tbody><tr><th>ciphertext</th><td><code>' +
      esc(hiText(hiNums(ct))) + '</code></td></tr></tbody></table>';

    if (!scan.hits.length) {
      h += '<div class="verdict safe">No common word’s trace appears in it.</div>';
    } else {
      h += '<table class="cr-table"><thead><tr><th>word</th><th>at</th><th>appears as</th>' +
        '<th>so the key is</th></tr></thead><tbody>';
      scan.hits.slice(0, 6).forEach(function (hit) {
        h += '<tr><td><code>' + esc(hit.word) + '</code></td><td>' + hit.at + '</td>' +
          '<td><code>' + esc(hit.seen) + '</code></td>' +
          '<td><code class="cr-hit">' + hit.key + '</code></td></tr>';
      });
      h += '</tbody></table>' +
        '<div class="verdict bad">Found by matching gaps alone. No key was tried and no ' +
        'frequencies were counted &mdash; and once a single crib lands, the key follows ' +
        'from one subtraction.</div>';
    }

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · breaking Vigenère ---------- */

  function runVigBreak() {
    var out = document.getElementById('vb-output');
    if (!out) return;
    var keyText = ((document.getElementById('vb-key') || {}).value) || 'crypto';
    var len = Number(((document.getElementById('vb-len') || {}).value) || 120);

    var key = hiNums(keyText);
    if (!key.length) { out.innerHTML = '<div class="tool-error">Give a key with letters in it.</div>'; return; }

    var full = hiNums(HI_SAMPLE).slice(0, len);
    var ct = hiText(hiVigEnc(key, full));

    var guess = hiGuessKeyLength(ct, 10);
    var r = hiBreakVigenere(ct, guess.best);

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">' + len + ' letters of ciphertext</span>' +
      '<span class="stat-pill dark">true key ' + esc(hiText(key)) + ' (' + key.length +
      ')</span>' +
      '<span class="stat-pill ' + (guess.best === key.length ? 'b' : 'c') + '">' +
        'length guessed: ' + guess.best + '</span></div>';

    h += '<div class="cr-cap">step 1 &mdash; which key length makes the columns look like English</div>' +
      '<table class="cr-table"><thead><tr><th>length</th><th>score (lower is better)</th>' +
      '</tr></thead><tbody>';
    guess.scores.slice(0, 8).forEach(function (sc) {
      h += '<tr' + (sc.len === guess.best ? ' class="cr-best"' : '') + '><td>' + sc.len +
        (sc.len === key.length ? ' <span class="cr-tag">the real one</span>' : '') +
        '</td><td>' + sc.score.toFixed(3) + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="cr-cap">step 2 &mdash; each column is one Caesar cipher</div>' +
      '<table class="cr-table"><thead><tr><th>column</th><th>letters in it</th>' +
      '<th>best shift</th></tr></thead><tbody>';
    r.columns.forEach(function (col) {
      var right = col.key === key[col.i % key.length] && guess.best === key.length;
      h += '<tr><td>' + (col.i + 1) + '</td><td>' + col.size + '</td>' +
        '<td><code class="' + (right ? 'cr-hit' : 'cr-miss') + '">' + col.key +
        ' (' + HI_ALPHA.charAt(col.key) + ')</code></td></tr>';
    });
    h += '</tbody></table>';

    var got = r.keyText === hiText(key);
    h += '<div class="verdict ' + (got ? 'bad' : 'warn') + '">' +
      '<strong>Recovered <code>' + esc(r.keyText) + '</code></strong>' +
      (got ? ' &mdash; the key, from the ciphertext alone.'
           : ', against a real key of <code>' + esc(hiText(key)) + '</code>. Not enough ' +
             'ciphertext: each column only had about ' + Math.floor(len / guess.best) +
             ' letters to work with.') + '</div>';

    h += '<div class="cr-cap">what it reads as</div><pre class="cr-snippet">' +
      esc(r.plaintext.slice(0, 160)) + (r.plaintext.length > 160 ? '…' : '') + '</pre>';

    /* How much is needed, measured. */
    h += '<div class="cr-cap">how much ciphertext this needs, measured</div>' +
      '<table class="cr-table"><thead><tr><th>letters</th><th>per column</th>' +
      '<th>key recovered</th></tr></thead><tbody>';
    [40, 80, 120, 200].forEach(function (n) {
      var e = crOnce('vig' + keyText + n, function () { return hiVigSuccess(keyText, n); });
      if (!e.ok) return;
      h += '<tr><td>' + n + '</td><td>' + e.perColumn + '</td><td>' +
        (e.correct ? '<span class="cr-hit">yes</span>'
                   : '<span class="cr-miss">' + e.lettersRight + ' of ' + e.keyLen +
                     ' letters</span>') + '</td></tr>';
    });
    h += '</tbody></table><div class="tool-note">A longer key is not stronger in any deep ' +
      'sense &mdash; it only means each column gets fewer letters, so you need more ' +
      'ciphertext before the counting works. Double the key and you roughly double the ' +
      'ciphertext required.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · perfect secrecy, and the candidate messages ---------- */

  function runCandidates() {
    var out = document.getElementById('cd-output');
    if (!out) return;
    var ct = ((document.getElementById('cd-ct') || {}).value) || 'aaaaaaa';

    var words = ['leopard', 'caracal', 'lioness', 'cheetah', 'panther'];
    var cands = hiCandidates(ct, words);
    var n = hiNums(ct).length;

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill a">ciphertext <code>' + esc(hiText(hiNums(ct))) +
      '</code></span><span class="stat-pill dark">' + n + ' letters</span></div>';

    if (!cands.length) {
      out.innerHTML = h + '<div class="tool-error">None of the sample words is ' + n +
        ' letters long. Try a seven-letter ciphertext.</div>';
      return;
    }

    h += '<table class="cr-table"><thead><tr><th>could the message have been&hellip;</th>' +
      '<th>then the key was</th><th>check</th></tr></thead><tbody>';
    cands.forEach(function (c) {
      h += '<tr><td><code>' + esc(c.message) + '</code></td>' +
        '<td><code>' + esc(c.key) + '</code></td>' +
        '<td>' + (c.checks ? '<span class="cr-hit">&#10003;</span>'
                           : '<span class="cr-miss">&#10007;</span>') + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="verdict safe"><strong>Every one of them, and each by exactly one ' +
      'key.</strong> The keys are drawn uniformly, so all of these messages are equally ' +
      'likely after seeing the ciphertext &mdash; exactly as likely as they were before. ' +
      'There is nothing to work out, however long you work at it.</div>';

    h += '<div class="callout warn" style="margin:14px 0;">' +
      '<div class="callout-label">And the price</div>' +
      'The same uniqueness that gives perfect secrecy forces <code>|K| &ge; |M|</code>: ' +
      'there must be a distinct key for every message. So the key is at least as long as ' +
      'the message, it may never be reused, and the problem of getting a secret message to ' +
      'someone has become the problem of getting an equally long secret key to them.' +
      '<br><br>Which is the wrong way round. What is wanted is a small key and large ' +
      'messages; perfect secrecy offers the exact opposite, and that is why it is a corner ' +
      'case rather than the answer.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 5 · reusing the key ---------- */

  function runTwoTime() {
    var out = document.getElementById('tt-output');
    if (!out) return;
    var m1 = ((document.getElementById('tt-m1') || {}).value) || 'attackatdawn';
    var m2 = ((document.getElementById('tt-m2') || {}).value) || 'retreatatten';
    var key = ((document.getElementById('tt-key') || {}).value) || 'qwertyuiopas';

    var r = hiTwoTime(m1, m2, key);
    if (!r.ok) { out.innerHTML = '<div class="tool-error">' + esc(r.error) + '</div>'; return; }

    var h = '<div class="cr-stats">' +
      '<span class="stat-pill c">one key, two messages</span>' +
      '<span class="stat-pill dark">' + r.m1.length + ' letters</span></div>';

    h += '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>m₁</th><td><code>' + esc(r.m1) + '</code></td></tr>' +
      '<tr><th>m₂</th><td><code>' + esc(r.m2) + '</code></td></tr>' +
      '<tr><th>the key, used twice</th><td><code class="cr-dim">' + esc(r.key) +
        '</code></td></tr>' +
      '<tr><th>c₁</th><td><code>' + esc(r.c1) + '</code></td></tr>' +
      '<tr><th>c₂</th><td><code>' + esc(r.c2) + '</code></td></tr>' +
      '</tbody></table>';

    h += '<div class="cr-cap">what anyone watching can compute</div>' +
      '<table class="cr-table cr-steps cr-attack"><tbody>' +
      '<tr><th>c₂ &minus; c₁</th><td><code>' + esc(r.cdiff) + '</code></td></tr>' +
      '<tr><th>m₂ &minus; m₁</th><td><code>' + esc(r.mdiff) + '</code></td></tr>' +
      '</tbody></table>';

    h += '<div class="verdict ' + (r.leaks ? 'bad' : 'warn') + '">' +
      (r.leaks
        ? '<strong>The same string.</strong> The key is in both ciphertexts and cancels: ' +
          '<code>c₂ &minus; c₁ = (m₂ + sk) &minus; (m₁ + sk) = m₂ &minus; m₁</code>. An ' +
          'eavesdropper now holds the difference of two secret messages without holding ' +
          'either, and without the key.'
        : 'They differ, which would mean the arithmetic above is wrong.') + '</div>';

    h += '<div class="cr-cap">and guessing one gives the other</div>' +
      '<table class="cr-table cr-steps"><tbody>' +
      '<tr><th>suppose you guess m₁ = </th><td><code>' + esc(r.m1) + '</code></td></tr>' +
      '<tr><th>then m₂ must be</th><td><code class="cr-hit">' + esc(r.recovered) +
        '</code></td></tr></tbody></table>';

    var ex = crOnce('twotime1', function () { return hiTwoTimeAlways(1); });
    h += '<div class="tool-note">Not a property of these messages: over every pair of ' +
      'single-letter messages and every key &mdash; ' + ex.total.toLocaleString() +
      ' cases &mdash; the difference of the ciphertexts equals the difference of the ' +
      'messages, with ' + ex.bad + ' exceptions. The pad acts on each letter separately, so ' +
      'length changes nothing.<br><br>This is what "one time" is doing in the name. The ' +
      'scheme is not weakened by key reuse; it is <em>a different scheme</em>, and that one ' +
      'has no security argument at all.</div>';

    out.innerHTML = h;
  }
