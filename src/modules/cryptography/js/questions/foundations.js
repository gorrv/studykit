  /* ---------- Topic 01 · definitions, syntax, secrecy and integrity ----------

     Where a question has a number in it, the number comes from the same
     functions the tools use, so a wrong engine makes a wrong question and the
     suite catches both at once. The conceptual ones are the other half of the
     topic, and are marked by matching text rather than arithmetic.
     ------------------------------------------------------------------- */

  /* These sweeps are exhaustive and their answers never change, so compute
     each one once and hand the same result to every draw. Recomputing them
     per question made generating one cost as much as running the whole
     exhaustive check — unnoticeable in a single click, and a minute and a
     half across the suite's fifteen hundred draws. */
  var QMEMO = {};
  function once(key, fn) {
    if (!(key in QMEMO)) QMEMO[key] = fn();
    return QMEMO[key];
  }

  var RUNGS = {
    ii: 'ii — messages cannot be recovered',
    iii: 'iii — partial messages cannot be recovered',
    iv: 'iv — no further information can be inferred',
    v: 'v — iv, even given encryption and decryption of chosen inputs'
  };
  var YES = 'Yes — one of the two covers it';
  var NO = 'No — it needs a further property';

  /* ---- the ladder: which rung does this scheme fail ---- */

  QZ_GEN.push({ topic: 'foundations', make: function () {
    var opts = [
      { id: 'identity', name: 'a scheme that ignores the key and copies the message to the ciphertext',
        rung: 'ii', why: 'The key cannot be recovered, because nothing ever uses it — so it ' +
          'passes rung i. The message is in plain sight, so it fails rung ii.' },
      { id: 'keepfirst', name: 'a shift cipher that leaves the first letter of the message unencrypted',
        rung: 'iii', why: 'The message as a whole is not recoverable, so rung ii survives. ' +
          'One letter of it is recoverable with no work at all, which is exactly what rung ' +
          'iii rules out.' },
      { id: 'shift', name: 'a shift cipher',
        rung: 'iv', why: 'No single letter can be read off, so rung iii survives in the ' +
          'narrow sense — but the letter frequencies pass through unchanged, and that is ' +
          '"further information about the message", which rung iv forbids. It is also ' +
          'enough to recover the key outright.' },
      { id: 'otp', name: 'the one-time pad',
        rung: 'v', why: 'Against an adversary who only watches, nothing is learned at all. ' +
          'Hand that adversary the ability to tamper and the scheme offers nothing: adding ' +
          'to the ciphertext adds to the message.' }
    ];
    var pick = opts[qzInt(0, opts.length - 1)];
    return {
      topic: 'foundations · the ladder',
      kind: 'choice',
      prompt: 'Which is the first rung of the security ladder that <strong>' + pick.name +
        '</strong> fails?',
      choices: ['i — the key cannot be recovered',
                'ii — messages cannot be recovered',
                'iii — partial messages cannot be recovered',
                'iv — no further information can be inferred',
                'v — iv, even given encryption and decryption of chosen inputs'],
      answer: RUNGS[pick.rung],
      check: textCheck(RUNGS[pick.rung]),
      explain: pick.why
    };
  } });

  /* ---- correctness is not security ---- */

  QZ_GEN.push({ topic: 'foundations', make: function () {
    var len = 3;
    var r = once('correct-identity', function () { return skCorrect('identity', len); });
    return {
      topic: 'foundations · correctness',
      prompt: 'The "do nothing" scheme copies the message into the ciphertext and ignores ' +
        'the key. Over every key and every ' + len + '-letter message — ' +
        r.total.toLocaleString() + ' cases — in how many does <code>Dec(sk, Enc(sk, m))</code> ' +
        'fail to return <code>m</code>?',
      placeholder: 'a number',
      answer: String(r.bad),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === r.bad };
      },
      explain: 'None of them. The scheme is perfectly correct: what comes out of Dec is ' +
        'exactly what went into Enc, every time. That is the point of the example — ' +
        'correctness is a statement about the scheme agreeing with itself, and it says ' +
        'nothing whatever about whether anyone else can read the message.'
    };
  } });

  /* ---- the two halves of a definition ---- */

  QZ_GEN.push({ topic: 'foundations', make: function () {
    return {
      topic: 'foundations · what a definition needs',
      kind: 'choice',
      prompt: 'A security definition is incomplete unless it states two things. Which pair?',
      choices: [
        'what must not be possible, and what capabilities the adversary has',
        'which cipher is used, and how long the key is',
        'how much computation an attack needs, and how much memory',
        'what must not be possible, and how likely an attack is to be attempted'
      ],
      answer: 'what must not be possible, and what capabilities the adversary has',
      check: textCheck('what must not be possible, and what capabilities the adversary has'),
      explain: 'Both halves, or the sentence says nothing. "You cannot recover the message" ' +
        'is a different claim depending on whether the adversary may only watch, or may also ' +
        'have ciphertexts of their choice decrypted. A scheme is never secure on its own — ' +
        'it is secure against a stated adversary, for a stated goal.'
    };
  } });

  /* ---- frequency analysis, with the measured numbers ---- */

  QZ_GEN.push({ topic: 'foundations', make: function () {
    var len = [10, 20, 30][qzInt(0, 2)];
    var e = once('enough-' + len, function () { return skEnoughText(len); });
    var pct = (100 * e.rate).toFixed(1);
    return {
      topic: 'foundations · breaking a shift',
      prompt: 'Chi-squared against English letter frequencies is run on every window of ' +
        len + ' letters of a fixed passage, against all 26 shifts — ' +
        e.total.toLocaleString() + ' attempts. In what percentage does the lowest score ' +
        'identify the right key? (to one decimal place)',
      placeholder: 'e.g. 91.4',
      answer: pct,
      check: function (v) {
        var x = parseFloat(String(v).replace(/[^0-9.]/g, ''));
        if (isNaN(x)) return { ok: false, msg: 'Give a percentage.' };
        return { ok: Math.abs(x - parseFloat(pct)) < 0.15 };
      },
      explain: 'It is ' + pct + '%. ' + (len >= 30
        ? 'By thirty letters the attack simply does not miss: a shift cipher protects a ' +
          'message only while the message is too short to have English statistics.'
        : 'Short messages are the only thing protecting a shift cipher, and the protection ' +
          'runs out fast — by thirty letters the attack is never wrong.')
    };
  } });

  /* ---- perfect secrecy, counted ---- */

  QZ_GEN.push({ topic: 'foundations', make: function () {
    var n = qzInt(1, 2);
    var r = once('perfect-' + n, function () { return skPerfect(n); });
    return {
      topic: 'foundations · perfect secrecy',
      prompt: 'For one-time-pad messages of ' + n + ' letter' + (n === 1 ? '' : 's') +
        ' over the 26-letter alphabet, take any message and any ciphertext. How many keys ' +
        'carry that message to that ciphertext?',
      placeholder: 'a number',
      answer: '1',
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === 1 };
      },
      explain: 'Exactly one, for every one of the ' + r.pairs.toLocaleString() + ' pairs — ' +
        'the key is forced, being the difference between the two. That is perfect secrecy ' +
        'in a sentence: every message explains the ciphertext you are holding equally well, ' +
        'so the ciphertext has not made any message more likely than it was before.'
    };
  } });

  /* ---- malleability ---- */

  QZ_GEN.push({ topic: 'foundations', make: function () {
    var A = 26, alpha = 'abcdefghijklmnopqrstuvwxyz';
    var m = qzInt(0, A - 1), t = qzInt(0, A - 1), k = qzInt(0, A - 1);
    var c = (m + k) % A;
    var d = (t - m + A) % A;
    var got = ((c + d) - k + A * 2) % A;
    return {
      topic: 'foundations · malleability',
      prompt: 'A one-letter message <code>' + alpha.charAt(m) + '</code> is sent under a ' +
        'one-time pad. Without knowing the key, an attacker adds <code>' + d +
        '</code> to the ciphertext. Which letter does the receiver decrypt?',
      placeholder: 'a letter',
      answer: alpha.charAt(got),
      check: function (v) {
        /* One letter, and only one. Taking the first character of whatever
           was typed meant "banana" was accepted whenever the answer was b. */
        var s = String(v).trim().toLowerCase();
        if (!/^[a-z]$/.test(s)) return { ok: false, msg: 'Give a single letter.' };
        return { ok: s === alpha.charAt(got) };
      },
      explain: 'Decryption subtracts the same pad that was added, so whatever is added to ' +
        'the ciphertext survives into the message: <code>Dec(k, c + d) = m + d</code>. Here ' +
        'that is ' + alpha.charAt(m) + ' + ' + d + ' = ' + alpha.charAt(got) +
        '. The attacker never learned the message and never saw the key, and still chose ' +
        'what the receiver reads — which is why integrity is a separate property needing a ' +
        'separate mechanism.'
    };
  } });

  /* ---- syntax of the two objects ---- */

  QZ_GEN.push({ topic: 'foundations', make: function () {
    var which = qzInt(0, 1);
    if (which === 0) {
      return {
        topic: 'foundations · syntax',
        kind: 'choice',
        prompt: 'What are the three algorithms of a secret key encryption scheme?',
        choices: ['KGen, Enc, Dec', 'KGen, Tag, Vf', 'Enc, Dec, Vf', 'KGen, Enc, Vf'],
        answer: 'KGen, Enc, Dec',
        check: textCheck('KGen, Enc, Dec'),
        explain: 'SKE = (KGen, Enc, Dec), over a key space K, a message space M and a ' +
          'ciphertext space C. (KGen, Tag, Vf) is a MAC — a different object, for integrity ' +
          'rather than secrecy, and with its own key.'
      };
    }
    return {
      topic: 'foundations · syntax',
      kind: 'choice',
      prompt: 'What does <code>Vf</code> output?',
      choices: ['0 or 1', 'a tag τ', 'a message m', 'an integrity key ik'],
      answer: '0 or 1',
      check: textCheck('0 or 1'),
      explain: 'Vf takes the integrity key, a message and a tag, and answers a single ' +
        'question: does this tag belong to this message under this key? That is a yes or a ' +
        'no — 1 or 0. Tag is the algorithm that produces τ.'
    };
  } });

  /* ---- secrecy vs integrity ---- */

  QZ_GEN.push({ topic: 'foundations', make: function () {
    return {
      topic: 'foundations · secrecy and integrity',
      kind: 'choice',
      prompt: 'Which statement is true of the one-time pad?',
      choices: [
        'It gives perfect secrecy and no integrity',
        'It gives perfect secrecy and therefore integrity',
        'It gives integrity but only computational secrecy',
        'It gives neither, which is why it is only of historical interest'
      ],
      answer: 'It gives perfect secrecy and no integrity',
      check: textCheck('It gives perfect secrecy and no integrity'),
      explain: 'The pad is the cleanest proof that secrecy does not imply integrity. An ' +
        'eavesdropper learns nothing at all — that is not a claim about computational ' +
        'difficulty, it is that the information is absent. But adding to the ciphertext adds ' +
        'to the message, so anyone who can write on the parchment chooses what arrives.'
    };
  } });

  /* ---- what is and is not covered by the two properties ---- */

  QZ_GEN.push({ topic: 'foundations', make: function () {
    var items = [
      { a: 'An attacker records a valid ciphertext and tag, and delivers it a second time.',
        ok: false, why: 'Replay. Both the ciphertext and the tag are genuine, so integrity ' +
          'as stated is satisfied and secrecy was never threatened. It needs a property of ' +
          'its own — freshness — which is why the list of desirable properties does not stop ' +
          'at two.' },
      { a: 'An attacker reorders two ciphertexts in transit.',
        ok: false, why: 'Each ciphertext is untouched, so per-message integrity holds. The ' +
          'ordering was never something either property claimed to protect.' },
      { a: 'An attacker changes a letter of the ciphertext so it decrypts to a different message.',
        ok: true, why: 'This is exactly what integrity rules out: what arrived is not what ' +
          'was sent, and a tag over the ciphertext catches it.' },
      { a: 'An attacker works out which letters are most common in the message.',
        ok: true, why: 'That is information about the message inferred from the ciphertext, ' +
          'which is what rung iv — secrecy — forbids.' }
    ];
    var pick = items[qzInt(0, items.length - 1)];
    return {
      topic: 'foundations · which property',
      kind: 'choice',
      prompt: pick.a + '<br><br>Is this ruled out by secrecy or integrity as the topic ' +
        'states them?',
      choices: ['Yes — one of the two covers it', 'No — it needs a further property'],
      answer: pick.ok ? YES : NO,
      check: textCheck(pick.ok ? YES : NO),
      explain: pick.why
    };
  } });
