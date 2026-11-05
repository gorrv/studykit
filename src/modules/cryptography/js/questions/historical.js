  /* ---------- Topic 03 · historical ciphers and their cryptanalysis ----------

     The arithmetic questions are marked by the same functions the tools use,
     which are themselves checked against the worked examples printed in the
     notes and against exhaustive sweeps.
     ------------------------------------------------------------------- */

  var HMEMO = {};
  function honce(key, fn) {
    if (!(key in HMEMO)) HMEMO[key] = fn();
    return HMEMO[key];
  }

  /* ---- modular arithmetic ---- */

  QZ_GEN.push({ topic: 'historical', make: function () {
    var a = qzInt(0, 25), b = qzInt(0, 25);
    var sub = qzInt(0, 1) === 1;
    var r = sub ? ((a - b + 26) % 26) : ((a + b) % 26);
    return {
      topic: 'historical · mod 26',
      prompt: 'With <code>a &harr; 0, &hellip;, z &harr; 25</code>, what is <code>' +
        HI_ALPHA.charAt(a) + (sub ? ' &minus; ' : ' + ') + HI_ALPHA.charAt(b) +
        '</code> mod 26, as a letter?',
      placeholder: 'a letter',
      answer: HI_ALPHA.charAt(r),
      check: function (v) {
        var s = String(v).trim().toLowerCase();
        if (!/^[a-z]$/.test(s)) return { ok: false, msg: 'Give a single letter.' };
        return { ok: s === HI_ALPHA.charAt(r) };
      },
      explain: a + (sub ? ' − ' : ' + ') + b + ' = ' + (sub ? a - b : a + b) + ', which is ' +
        r + ' mod 26, and ' + r + ' ↔ ' + HI_ALPHA.charAt(r) + '.'
    };
  } });

  /* ---- encrypting with each cipher ---- */

  QZ_GEN.push({ topic: 'historical', make: function () {
    var words = ['hello', 'attack', 'secret', 'dawn', 'crypto', 'retreat'];
    var m = words[qzInt(0, words.length - 1)];
    var which = qzInt(0, 1);
    if (which === 0) {
      var k = qzInt(1, 25);
      var c = hiText(hiCaesarEnc(k, hiNums(m)));
      return {
        topic: 'historical · Caesar',
        prompt: 'Encrypt <code>' + m + '</code> with the Caesar cipher under ' +
          '<code>sk = ' + k + '</code>.',
        placeholder: 'the ciphertext',
        answer: c,
        check: function (v) {
          var s = String(v).trim().toLowerCase().replace(/[^a-z]/g, '');
          if (!s) return { ok: false, msg: 'Give the ciphertext.' };
          return { ok: s === c };
        },
        explain: 'Add ' + k + ' to every letter mod 26: <code>' + m + '</code> → <code>' +
          c + '</code>.'
      };
    }
    var keyWord = ['key', 'abc', 'crypt'][qzInt(0, 2)];
    var cv = hiText(hiVigEnc(hiNums(keyWord), hiNums(m)));
    return {
      topic: 'historical · Vigenère',
      prompt: 'Encrypt <code>' + m + '</code> with Vigenère under the key <code>' +
        keyWord + '</code>.',
      placeholder: 'the ciphertext',
      answer: cv,
      check: function (v) {
        var s = String(v).trim().toLowerCase().replace(/[^a-z]/g, '');
        if (!s) return { ok: false, msg: 'Give the ciphertext.' };
        return { ok: s === cv };
      },
      explain: 'The key repeats under the message and each column gets its own shift: ' +
        '<code>' + m + '</code> + <code>' + keyWord + '</code> → <code>' + cv + '</code>.'
    };
  } });

  /* ---- key space sizes ---- */

  QZ_GEN.push({ topic: 'historical', make: function () {
    var ks = honce('spaces', function () { return hiKeySpaces(5); });
    var which = qzInt(0, 2);
    var opts = [
      { q: 'the Caesar cipher', a: '26',
        why: 'One shift, and 26 of them. Five coin flips, with a retry.' },
      { q: 'the monoalphabetic substitution cipher over 26 letters', a: '26!',
        why: 'Any permutation of the alphabet, so 26! ≈ 2<sup>88.4</sup> — which really is ' +
          '' + ks.subst.size + '. Far beyond brute force, and the cipher still falls to ' +
          'frequency analysis, which never touches the key space.' },
      { q: 'the Vigenère cipher with keys of length at most n', a: '26 + 26² + … + 26ⁿ',
        why: 'Every key of every length up to n, which is at least 26<sup>n</sup>.' }
    ];
    var pick = opts[which];
    return {
      topic: 'historical · key spaces',
      kind: 'choice',
      prompt: 'What is <code>|K|</code> for <strong>' + pick.q + '</strong>?',
      choices: ['26', '26!', '26 + 26² + … + 26ⁿ', '26<sup>2</sup>'],
      answer: pick.a,
      check: textCheck(pick.a),
      explain: pick.why
    };
  } });

  /* ---- the trace ---- */

  QZ_GEN.push({ topic: 'historical', make: function () {
    var words = ['hello', 'yes', 'the', 'dawn', 'cab'];
    var w = words[qzInt(0, words.length - 1)];
    var tr = hiTrace(hiNums(w));
    return {
      topic: 'historical · the trace',
      prompt: 'What is <code>trace(' + w + ')</code>? Give the gaps between consecutive ' +
        'letters mod 26, separated by commas.',
      placeholder: 'e.g. 23, 7, 0, 3',
      answer: tr.join(', '),
      check: function (v) {
        var got = String(v).split(/[^0-9]+/).filter(function (x) { return x.length; })
          .map(Number);
        if (got.length !== tr.length) {
          return { ok: false, msg: 'Expected ' + tr.length + ' number' +
            (tr.length === 1 ? '' : 's') + '.' };
        }
        for (var i = 0; i < tr.length; i++) if (got[i] !== tr[i]) return { ok: false };
        return { ok: true };
      },
      explain: 'Each gap is the next letter minus the one before it, mod 26: (' +
        tr.join(', ') + '). A Caesar shift moves both letters equally, so the gap does not ' +
        'move at all — which is why all 26 encryptions of this word share this trace.'
    };
  } });

  QZ_GEN.push({ topic: 'historical', make: function () {
    var r = honce('traceclaim', function () { return hiTraceClaim(3); });
    return {
      topic: 'historical · what the trace settles',
      kind: 'choice',
      prompt: 'When can a ciphertext <code>c</code> decrypt to a message <code>m</code> ' +
        'under <em>some</em> Caesar key?',
      choices: ['exactly when they have the same trace',
                'exactly when they have the same first letter',
                'exactly when they have the same letter frequencies',
                'always, for some key'],
      answer: 'exactly when they have the same trace',
      check: textCheck('exactly when they have the same trace'),
      explain: 'Checked over every three-letter message: for each of the ' +
        r.messages.toLocaleString() + ', the 26 ciphertexts reachable under some key are ' +
        'exactly the 26 strings sharing its trace, with ' + r.mismatch + ' exceptions. So ' +
        'you can hunt for a likely word by its gaps alone, without trying a single key.'
    };
  } });

  /* ---- brute force uses Dec ---- */

  QZ_GEN.push({ topic: 'historical', make: function () {
    return {
      topic: 'historical · brute force',
      kind: 'choice',
      prompt: 'Brute force is written as <code>Dec(k, c<sub>i</sub>) &ne; m<sub>i</sub></code> ' +
        'rather than <code>Enc(k, m<sub>i</sub>) &ne; c<sub>i</sub></code>. Why?',
      choices: ['because Enc may be randomised, so re-encrypting need not reproduce c',
                'because Dec is faster than Enc',
                'because Enc needs the message and Dec does not',
                'because Dec can output ⊥ and Enc cannot'],
      answer: 'because Enc may be randomised, so re-encrypting need not reproduce c',
      check: textCheck('because Enc may be randomised, so re-encrypting need not reproduce c'),
      explain: 'With a randomised Enc the same message under the same key can give many ' +
        'ciphertexts, so comparing against the one you have would discard the correct key. ' +
        'Dec is deterministic, so it is always safe to test that way. For the deterministic ' +
        'ciphers in this topic the two are interchangeable — the point is that the general ' +
        'statement is not.'
    };
  } });

  /* ---- Vigenère cryptanalysis ---- */

  QZ_GEN.push({ topic: 'historical', make: function () {
    return {
      topic: 'historical · breaking Vigenère',
      kind: 'choice',
      prompt: 'What is the first step in a frequency attack on a Vigenère ciphertext?',
      choices: ['work out the key length, then split the ciphertext into that many columns',
                'count the letter frequencies of the whole ciphertext',
                'try all 26 shifts on the whole ciphertext',
                'look for repeated letters'],
      answer: 'work out the key length, then split the ciphertext into that many columns',
      check: textCheck('work out the key length, then split the ciphertext into that many columns'),
      explain: 'Counting frequencies over the whole thing gives nothing, because several ' +
        'different shifts are mixed together. Split it by key length and each column is a ' +
        'single Caesar cipher with ordinary English statistics. If no length makes the ' +
        'columns look like English, try the next one.'
    };
  } });

  QZ_GEN.push({ topic: 'historical', make: function () {
    var key = ['key', 'crypto'][qzInt(0, 1)];
    var len = [40, 120][qzInt(0, 1)];
    var r = honce('vig-' + key + '-' + len, function () { return hiVigSuccess(key, len); });
    return {
      topic: 'historical · how much ciphertext',
      kind: 'choice',
      prompt: 'A Vigenère ciphertext of <strong>' + len + ' letters</strong> under a key of ' +
        'length <strong>' + key.length + '</strong>, attacked column by column. Is the key ' +
        'recovered?',
      choices: ['yes', 'no'],
      answer: r.correct ? 'yes' : 'no',
      check: textCheck(r.correct ? 'yes' : 'no'),
      explain: 'Each column gets about ' + r.perColumn + ' letters. ' + (r.correct
        ? 'That is enough for the counting to settle, and the key comes out as <code>' +
          r.found + '</code>.'
        : 'That is not enough: the attack returned <code>' + r.found + '</code> against a ' +
          'real key of <code>' + r.want + '</code>, getting ' + r.lettersRight + ' of ' +
          r.keyLen + ' letters. A longer key is not stronger in itself — it just spreads ' +
          'the ciphertext more thinly.')
    };
  } });

  /* ---- perfect secrecy and its cost ---- */

  QZ_GEN.push({ topic: 'historical', make: function () {
    var pairs = [
      ['leopard', 'caracal'], ['lioness', 'cheetah'], ['panther', 'leopard']
    ];
    var p = pairs[qzInt(0, pairs.length - 1)];
    var ct = 'aaaaaaa';
    var r = hiKeyFor(p[0], ct);
    return {
      topic: 'historical · perfect secrecy',
      prompt: 'A 7-letter message is encrypted with a uniform 7-letter key, giving ' +
        '<code>' + ct + '</code>. If the message was <code>' + p[0] + '</code>, what was ' +
        'the key?',
      placeholder: 'seven letters',
      answer: r.key,
      check: function (v) {
        var s = String(v).trim().toLowerCase().replace(/[^a-z]/g, '');
        if (!s) return { ok: false, msg: 'Give the key.' };
        return { ok: s === r.key };
      },
      explain: 'The key is forced: it is <code>c &minus; m</code> letter by letter, giving ' +
        '<code>' + r.key + '</code>. The point is that <em>every</em> seven-letter message ' +
        'has such a key, each one unique, and all keys are equally likely — so the ' +
        'ciphertext does not favour any message over any other.'
    };
  } });

  QZ_GEN.push({ topic: 'historical', make: function () {
    return {
      topic: 'historical · the cost of perfect secrecy',
      kind: 'choice',
      prompt: 'Perfect secrecy forces which of these?',
      choices: ['|K| ≥ |M|, so the key is at least as long as the message',
                '|C| ≥ |K|, so the ciphertext grows',
                '|M| ≥ |K|, so messages must be long',
                'nothing about the sizes of the spaces'],
      answer: '|K| ≥ |M|, so the key is at least as long as the message',
      check: textCheck('|K| ≥ |M|, so the key is at least as long as the message'),
      explain: 'Each message needs its own key carrying it to a given ciphertext, so there ' +
        'must be at least as many keys as messages. That is exactly the property that makes ' +
        'the secrecy perfect, and exactly what makes it impractical: key distribution is ' +
        'hard, so you want a small key and large messages, and this gives you the opposite.'
    };
  } });

  /* ---- key reuse ---- */

  QZ_GEN.push({ topic: 'historical', make: function () {
    var alpha = 'abcdefghijklmnopqrstuvwxyz';
    var m1 = qzInt(0, 25), m2 = qzInt(0, 25), k = qzInt(0, 25);
    var c1 = (m1 + k) % 26, c2 = (m2 + k) % 26;
    var d = (c2 - c1 + 26) % 26;
    return {
      topic: 'historical · reusing a key',
      prompt: 'Two one-letter messages are sent under the <em>same</em> pad, giving ' +
        '<code>c₁ = ' + alpha.charAt(c1) + '</code> and <code>c₂ = ' + alpha.charAt(c2) +
        '</code>. What does <code>c₂ &minus; c₁</code> tell an eavesdropper, as a letter?',
      placeholder: 'a letter',
      answer: alpha.charAt(d),
      check: function (v) {
        var s = String(v).trim().toLowerCase();
        if (!/^[a-z]$/.test(s)) return { ok: false, msg: 'Give a single letter.' };
        return { ok: s === alpha.charAt(d) };
      },
      explain: 'The key cancels: <code>c₂ &minus; c₁ = (m₂ + sk) &minus; (m₁ + sk) = ' +
        'm₂ &minus; m₁</code>, which here is <code>' + alpha.charAt(d) + '</code>. The ' +
        'eavesdropper now holds the difference of two secret messages without the key and ' +
        'without either message — and a guess at one gives the other exactly.'
    };
  } });
