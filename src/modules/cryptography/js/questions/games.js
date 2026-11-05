  /* ---------- Topic 02 · syntax, counting, and the security games ----------

     The counting questions take their answers from the same functions the
     tools use, which are themselves checked against an enumeration of the
     objects being counted. The game questions take theirs from games that
     were actually played.
     ------------------------------------------------------------------- */

  var GMEMO = {};
  function gonce(key, fn) {
    if (!(key in GMEMO)) GMEMO[key] = fn();
    return GMEMO[key];
  }

  /* ---- how many functions ---- */

  QZ_GEN.push({ topic: 'games', make: function () {
    var s = qzInt(1, 4), t = qzInt(s, 5);
    var r = gmCount(s, t);
    var which = qzInt(0, 1);
    var answer = which === 0 ? r.functions : r.injective;
    return {
      topic: 'games · counting Enc',
      prompt: 'With <code>|M| = ' + s + '</code> and <code>|C| = ' + t + '</code>, how many ' +
        (which === 0 ? '' : '<strong>injective</strong> ') +
        'functions are there from <code>M</code> to <code>C</code>?',
      placeholder: 'a number',
      answer: String(answer),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === answer };
      },
      explain: which === 0
        ? 'Each of the ' + s + ' messages can go to any of the ' + t + ' ciphertexts ' +
          'independently, so it is <code>t<sup>s</sup> = ' + t + '<sup>' + s + '</sup> = ' +
          r.functions + '</code>.'
        : 'Choose which ' + s + ' of the ' + t + ' ciphertexts get used and then order them: ' +
          '<code>C(' + t + ', ' + s + ') &middot; ' + s + '! = ' + r.injective + '</code>. ' +
          'Equivalently ' + t + ' choices for the first message, ' + (t - 1) + ' for the ' +
          'second, and so on.'
    };
  } });

  /* ---- why injective ---- */

  QZ_GEN.push({ topic: 'games', make: function () {
    var s = 3, t = 4;
    var r = gonce('inj-' + s + '-' + t, function () { return gmInjectiveNeeded(s, t); });
    return {
      topic: 'games · why Enc is injective',
      prompt: 'Of the ' + r.functions + ' functions from a 3-element <code>M</code> to a ' +
        '4-element <code>C</code>, how many could be an <code>Enc<sub>sk</sub></code> of a ' +
        '<em>correct</em> scheme?',
      placeholder: 'a number',
      answer: String(r.invertible),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === r.invertible };
      },
      explain: 'Exactly the ' + r.invertible + ' injective ones. <code>Dec</code> sees only ' +
        'the ciphertext, so if two messages share one it can return at most one of them and ' +
        'correctness fails for the other. Every function was checked: ' + r.invertible +
        ' admit a working <code>Dec</code>, ' + r.injective + ' are injective, and the two ' +
        'groups differ on ' + r.mismatch + ' functions.'
    };
  } });

  /* ---- which algorithms may be randomised ---- */

  QZ_GEN.push({ topic: 'games', make: function () {
    var items = [
      { a: 'KGen', ok: 'randomised',
        why: 'KGen is randomised — a key sampled the same way every time is not a secret.' },
      { a: 'Dec', ok: 'deterministic',
        why: 'Dec is deterministic. It may output ⊥, but it does not get to toss coins.' },
      { a: 'Vf', ok: 'deterministic',
        why: 'Vf is deterministic, and outputs 0 or 1.' },
      { a: 'Enc', ok: 'either',
        why: 'Enc is <em>potentially</em> randomised — which is written c ← Enc(sk, m) when ' +
          'it is and c = Enc(sk, m) when it is not. A deterministic Enc cannot be IND-CPA ' +
          'secure.' },
      { a: 'Tag', ok: 'either',
        why: 'Tag is potentially randomised. A deterministic one is assumed here, which is ' +
          'what makes canonical verification available.' }
    ];
    var pick = items[qzInt(0, items.length - 1)];
    return {
      topic: 'games · which may use randomness',
      kind: 'choice',
      prompt: 'Is <code>' + pick.a + '</code> randomised, deterministic, or either?',
      choices: ['randomised', 'deterministic', 'either'],
      answer: pick.ok,
      check: textCheck(pick.ok),
      explain: pick.why
    };
  } });

  /* ---- the baseline for each game ---- */

  QZ_GEN.push({ topic: 'games', make: function () {
    var g = ['IND-EAV', 'IND-CPA', 'IND-CCA', 'EUF-CMA'][qzInt(0, 3)];
    var euf = g === 'EUF-CMA';
    return {
      topic: 'games · what secure means',
      kind: 'choice',
      prompt: 'A scheme is <strong>' + g + ' secure</strong> when no efficient adversary ' +
        'wins with probability noticeably different from what?',
      choices: ['zero', 'one half', 'one', 'one over the size of the key space'],
      answer: euf ? 'zero' : 'one half',
      check: textCheck(euf ? 'zero' : 'one half'),
      explain: euf
        ? 'Zero. In EUF-CMA the adversary has to produce a valid tag on a new message — ' +
          'there is nothing to guess between, so any noticeable success rate is a break.'
        : 'One half. The adversary names a bit, and can always flip a coin, so one half is ' +
          'what a win rate looks like when nothing has been learned. The bar is doing ' +
          'noticeably better than that.'
    };
  } });

  /* ---- the measured win rates ---- */

  QZ_GEN.push({ topic: 'games', make: function () {
    var cases = [
      { s: 'shiftFixed', a: 'replay', g: 'cpa',
        why: 'The oracle encrypts m₀ under the same key the challenge used, and a ' +
          'deterministic Enc gives the same ciphertext for the same message. Compare the two ' +
          'and you know b. No deterministic scheme survives IND-CPA.' },
      { s: 'shiftFresh', a: 'pattern', g: 'eav',
        why: 'A fresh key does not help: a shift sends two equal letters to two equal ' +
          'letters whatever the shift is. m₀ = aa and m₁ = ab are told apart by looking.' },
      { s: 'otpFresh', a: 'pattern', g: 'eav',
        why: 'The pad gives each letter its own uniform key, so the pattern does not ' +
          'survive and the ciphertext is uniform whichever message was sent. The adversary ' +
          'is reduced to guessing.' },
      { s: 'otpFresh', a: 'coin', g: 'eav',
        why: 'Guessing wins half the time by definition — which is why one half is the bar ' +
          'rather than zero.' }
    ];
    var pick = cases[qzInt(0, cases.length - 1)];
    var r = gonce('play-' + pick.s + pick.a + pick.g, function () {
      return gmPlay(pick.s, pick.a, pick.g, 4000, 20251009);
    });
    var near = Math.abs(r.rate - 0.5) < 0.03;
    return {
      topic: 'games · playing it out',
      kind: 'choice',
      prompt: '<strong>' + GM_SCHEMES[pick.s].label + '</strong> in <strong>' +
        pick.g.toUpperCase() + '</strong>, against an adversary that will ' +
        GM_ADVERSARIES[pick.a].label + '. Roughly what win rate?',
      choices: ['about a half — the adversary is guessing',
                'essentially always — the scheme is broken'],
      answer: near ? 'about a half — the adversary is guessing'
                   : 'essentially always — the scheme is broken',
      check: textCheck(near ? 'about a half — the adversary is guessing'
                            : 'essentially always — the scheme is broken'),
      explain: 'Measured over ' + r.rounds.toLocaleString() + ' rounds: ' +
        (100 * r.rate).toFixed(1) + '%. ' + pick.why
    };
  } });

  /* ---- the rules that stop the games being vacuous ---- */

  QZ_GEN.push({ topic: 'games', make: function () {
    var items = [
      { q: 'Why does the challenger abort when <code>|m<sub>0</sub>| &ne; |m<sub>1</sub>|</code>?',
        a: 'because ciphertext length leaks message length',
        d: ['because longer messages are harder to encrypt',
            'because the adversary could then run out of time',
            'because Enc is injective'],
        why: 'Essentially every scheme leaks the length of its message, so an adversary ' +
          'allowed to submit messages of different lengths would win against all of them ' +
          'and the definition would rule out nothing. The leak is real; the definition ' +
          'declines to forbid it.' },
      { q: 'Why does <code>O<sub>Dec</sub></code> refuse <code>c<sub>b</sub></code> in IND-CCA?',
        a: 'because otherwise the adversary just asks for the answer',
        d: ['because decrypting it twice would be slow',
            'because c_b might not be a valid ciphertext',
            'because Dec is deterministic'],
        why: 'Hand the challenge ciphertext to a decryption oracle and it tells you the ' +
          'message, so every scheme loses and the definition is empty. Note the refusal is ' +
          'for that exact ciphertext only — anything differing by one letter is allowed, ' +
          'which is how malleable schemes lose this game.' },
      { q: 'In EUF-CMA, why must the forged message be outside <code>Q</code>?',
        a: 'because returning a tag you were given is not a forgery',
        d: ['because Q might be very large',
            'because the challenger cannot verify messages it has seen',
            'because Tag is deterministic'],
        why: 'The oracle hands out valid tags on request. Replaying one proves nothing, so ' +
          'the win condition requires a message the oracle was never asked about.' }
    ];
    var pick = items[qzInt(0, items.length - 1)];
    return {
      topic: 'games · the rules',
      kind: 'choice',
      prompt: pick.q,
      choices: [pick.a].concat(pick.d),
      answer: pick.a,
      check: textCheck(pick.a),
      explain: pick.why
    };
  } });

  /* ---- Kerckhoffs ---- */

  QZ_GEN.push({ topic: 'games', make: function () {
    return {
      topic: 'games · Kerckhoffs',
      kind: 'choice',
      prompt: 'Which of these is Kerckhoffs’ principle, in the sense the term is ' +
        'normally used?',
      choices: ['The system must not require secrecy, and may be stolen without causing trouble',
                'The key must be long enough to resist exhaustive search',
                'The system must be mathematically proven secure',
                'The system must be published before it is used'],
      answer: 'The system must not require secrecy, and may be stolen without causing trouble',
      check: textCheck('The system must not require secrecy, and may be stolen without causing trouble'),
      explain: 'The secret is the key, not the design. Designs leak, get reverse-engineered ' +
        'or get guessed, and unlike a key they cannot be changed afterwards. It is one of ' +
        'six requirements in the original list — the others are about keys, telegraphs, ' +
        'portability and ease of use, and are usually forgotten.'
    };
  } });

  /* ---- EUF-CMA forgery ---- */

  QZ_GEN.push({ topic: 'games', make: function () {
    var r = gonce('forge-2', function () { return gmForgeRate(2); });
    return {
      topic: 'games · forging a sum',
      prompt: 'A MAC uses <code>Tag(ik, m) = (&Sigma;m) + ik mod 26</code>. An adversary ' +
        'asks for a tag on one message and outputs its reversal with the same tag. Over ' +
        'every two-letter message and every key — ' + r.total.toLocaleString() + ' games — ' +
        'in what percentage does the forgery verify? (a whole number)',
      placeholder: 'a percentage',
      answer: String(Math.round(100 * r.rate)),
      check: function (v) {
        var x = parseFloat(String(v).replace(/[^0-9.]/g, ''));
        if (isNaN(x)) return { ok: false, msg: 'Give a percentage.' };
        return { ok: Math.abs(x - 100 * r.rate) < 0.5 };
      },
      explain: 'All of them. A sum does not depend on the order of what it adds, so every ' +
        'rearrangement of a message carries the same tag — and the forger needs no key to ' +
        'know that. One query, one forgery, every time.'
    };
  } });

  /* ---- canonical verification ---- */

  QZ_GEN.push({ topic: 'games', make: function () {
    return {
      topic: 'games · canonical verification',
      kind: 'choice',
      prompt: 'Canonical verification recomputes the tag and compares. Why does it require ' +
        '<code>Tag</code> to be deterministic?',
      choices: ['Otherwise honest tags get rejected, so correctness fails',
                'Otherwise the adversary learns the key',
                'Otherwise verification takes too long',
                'Otherwise the tag space would be infinite'],
      answer: 'Otherwise honest tags get rejected, so correctness fails',
      check: textCheck('Otherwise honest tags get rejected, so correctness fails'),
      explain: 'With a randomised Tag a message has several valid tags. The verifier can ' +
        'produce only one of them, so it rejects the others — and those were genuine tags ' +
        'from the honest tagger. That is a correctness failure, before security is even ' +
        'discussed. A Vf for a randomised Tag has to check a property instead of recomputing.'
    };
  } });
