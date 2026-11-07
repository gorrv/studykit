  /* ---------- Topic 04 · block ciphers, SPNs, Feistel, PRP ----------

     The bit-level questions are answered by the same engine the tools run,
     which is checked against the worked example printed in the notes.
     ------------------------------------------------------------------- */

  var BMEMO = {};
  function bonce(key, fn) {
    if (!(key in BMEMO)) BMEMO[key] = fn();
    return BMEMO[key];
  }

  /* ---- applying S and P ---- */

  QZ_GEN.push({ topic: 'blockciphers', make: function () {
    var x = qzInt(0, 255);
    var m = bkFromInt(x, 8);
    var which = qzInt(0, 1);
    var ans = which === 0 ? bkStr(bkSub(m, 4)) : bkStr(bkPerm(bkSub(m, 4)));
    return {
      topic: 'blockciphers · S and P',
      prompt: 'With the S-box and bit permutation from the notes, and ' +
        '<code>m = ' + bkStr(m).replace(/(.{4})/, '$1 ') + '</code>, what is <code>' +
        (which === 0 ? 'S(m)' : 'P(S(m))') + '</code>? (8 bits)',
      placeholder: 'eight bits',
      answer: ans,
      check: function (v) {
        var s = String(v).replace(/[^01]/g, '');
        if (s.length !== 8) return { ok: false, msg: 'Give eight bits.' };
        return { ok: s === ans };
      },
      explain: which === 0
        ? 'S acts on each 4-bit half separately: <code>S(' + bkStr(m).slice(0, 4) +
          ') = ' + ans.slice(0, 4) + '</code> and <code>S(' + bkStr(m).slice(4) + ') = ' +
          ans.slice(4) + '</code>.'
        : 'First S on each half, giving <code>' + bkStr(bkSub(m, 4)) + '</code>. Then P ' +
          'moves the bit at index i to index P(i), giving <code>' + ans + '</code>.'
    };
  } });

  /* ---- a Feistel round ---- */

  QZ_GEN.push({ topic: 'blockciphers', make: function () {
    var key = bkFromInt(qzInt(0, 255), 8);
    var m = bkFromInt(qzInt(0, 255), 8);
    var rounds = qzInt(1, 3);
    var r = bkFeistel(key, m, rounds, 'mix');
    var last = r.steps[r.steps.length - 1];
    var which = qzInt(0, 1);
    var ans = which === 0 ? last.L : last.R;
    return {
      topic: 'blockciphers · a Feistel round',
      prompt: 'A Feistel network with the mixing round function, key <code>' + bkStr(key) +
        '</code>, message <code>' + bkStr(m) + '</code>, after <strong>' + rounds +
        '</strong> round' + (rounds === 1 ? '' : 's') + '. What is <code>' +
        (which === 0 ? 'L' : 'R') + '<sub>' + rounds + '</sub></code>? (4 bits)',
      placeholder: 'four bits',
      answer: ans,
      check: function (v) {
        var s = String(v).replace(/[^01]/g, '');
        if (s.length !== 4) return { ok: false, msg: 'Give four bits.' };
        return { ok: s === ans };
      },
      explain: 'Each round sets <code>L<sub>i</sub> = R<sub>i−1</sub></code> and ' +
        '<code>R<sub>i</sub> = L<sub>i−1</sub> ⊕ f(sk<sub>i</sub>, R<sub>i−1</sub>)</code>. ' +
        'After ' + rounds + ': <code>L = ' + last.L + '</code>, <code>R = ' + last.R +
        '</code>.'
    };
  } });

  /* ---- counting permutations ---- */

  QZ_GEN.push({ topic: 'blockciphers', make: function () {
    var l = qzInt(1, 4);
    var r = bkPermCount(l);
    var which = qzInt(0, 1);
    var ans = which === 0 ? r.count : String(r.toWrite);
    return {
      topic: 'blockciphers · counting permutations',
      prompt: which === 0
        ? 'How many permutations are there of <code>{0,1}<sup>' + l + '</sup></code>?'
        : 'About how many bits does it take to write down one permutation of ' +
          '<code>{0,1}<sup>' + l + '</sup></code>?',
      placeholder: 'a number',
      answer: ans,
      check: function (v) {
        var s = String(v).replace(/[^0-9]/g, '');
        if (!s) return { ok: false, msg: 'Give a whole number.' };
        return { ok: s === ans };
      },
      explain: which === 0
        ? 'It is <code>(2<sup>' + l + '</sup>)! = ' + r.t + '! = ' + r.count + '</code>. ' +
          'That grows fast enough that at ℓ = 128 the count is about ' +
          '2<sup>4.31×10⁴⁰</sup>.'
        : 'One image of ℓ bits for each of the 2<sup>ℓ</sup> inputs: ' +
          '<code>ℓ · 2<sup>ℓ</sup> = ' + l + ' × ' + r.t + ' = ' + r.toWrite + '</code> ' +
          'bits. This is exactly why a key cannot simply name a permutation.'
    };
  } });

  /* ---- what must be a permutation ---- */

  QZ_GEN.push({ topic: 'blockciphers', make: function () {
    var items = [
      { q: 'the S-box of an SPN', a: 'yes',
        why: 'Inverting an SPN applies S<sup>−1</sup>, so S must be invertible — and since ' +
          'its domain and codomain are the same finite set, that means it is a permutation.' },
      { q: 'the bit permutation P of an SPN', a: 'yes',
        why: 'Same reason: inverting applies P<sup>−1</sup>.' },
      { q: 'the round function f of a Feistel network', a: 'no',
        why: 'Remarkably, no. Inverting a round recomputes f rather than undoing it — ' +
          'R<sub>i−1</sub> is just L<sub>i</sub>, so f can be evaluated again and XORed ' +
          'away. f need not even be injective.' },
      { q: 'F(sk, ·) itself, for every key', a: 'yes',
        why: 'That is the definition of a block cipher. For an SPN it follows because each ' +
          'round composes permutations; for a Feistel network it follows from the structure, ' +
          'whatever f is.' }
    ];
    var pick = items[qzInt(0, items.length - 1)];
    return {
      topic: 'blockciphers · what must be invertible',
      kind: 'choice',
      prompt: 'Must <strong>' + pick.q + '</strong> be a permutation?',
      choices: ['yes', 'no'],
      answer: pick.a,
      check: textCheck(pick.a),
      explain: pick.why
    };
  } });

  /* ---- the final round ---- */

  QZ_GEN.push({ topic: 'blockciphers', make: function () {
    return {
      topic: 'blockciphers · the final round',
      kind: 'choice',
      prompt: 'Why does the last round of an SPN apply neither <code>S</code> nor ' +
        '<code>P</code>?',
      choices: ['they are public, so after the final key they add nothing',
                'because the block would no longer be a permutation',
                'to save one round of computation',
                'because the round key is shorter in the last round'],
      answer: 'they are public, so after the final key they add nothing',
      check: textCheck('they are public, so after the final key they add nothing'),
      explain: 'S and P are not secret. An adversary holding the output could simply apply ' +
        'S<sup>−1</sup> and P<sup>−1</sup> itself, so performing them after the last key ' +
        'XOR provides nothing. The security comes from the key, not from the public parts.'
    };
  } });

  /* ---- PRP ---- */

  QZ_GEN.push({ topic: 'blockciphers', make: function () {
    return {
      topic: 'blockciphers · PRP',
      kind: 'choice',
      prompt: 'What does PRP security require?',
      choices: ['no efficient adversary tells F(sk, ·) from a uniform permutation better than half the time',
                'no efficient adversary recovers sk from message-ciphertext pairs',
                'the output of F(sk, ·) is uniformly distributed',
                'F(sk, ·) has no fixed points'],
      answer: 'no efficient adversary tells F(sk, ·) from a uniform permutation better than half the time',
      check: textCheck('no efficient adversary tells F(sk, ·) from a uniform permutation better than half the time'),
      explain: 'It is an indistinguishability game, like IND-EAV: a uniform bit decides ' +
        'whether the oracle is the cipher or a uniform permutation, and the adversary must ' +
        'name the bit. Note the comparison is against a uniform <em>permutation</em>, not a ' +
        'uniform function — a permutation never collides, which is itself a detectable ' +
        'property.'
    };
  } });

  QZ_GEN.push({ topic: 'blockciphers', make: function () {
    var cases = [
      { c: 'xoronly', s: 'difference',
        why: 'With F(sk, x) = x ⊕ sk the key cancels out of any pair: the output difference ' +
          'always equals the input difference. A uniform permutation does that essentially ' +
          'never.' },
      { c: 'oneround', s: 'difference',
        why: 'The S-box breaks the difference relation immediately, so this strategy learns ' +
          'nothing here. That does not make one round secure — it makes this the wrong ' +
          'question to ask it.' },
      { c: 'oneround', s: 'locality',
        why: 'One application of P cannot carry a flipped bit outside the few positions it ' +
          'reaches, so the change stays local — and a uniform permutation scatters it. This ' +
          'is diffusion, or rather the lack of it.' },
      { c: 'threeround', s: 'locality',
        why: 'Three rounds spread a one-bit change across the whole block, so locality no ' +
          'longer separates it from a uniform permutation. (At ℓ = 8 an adversary could ' +
          'still just read the whole table — the toy is small, the lesson is not.)' }
    ];
    var pick = cases[qzInt(0, cases.length - 1)];
    var r = bonce('prp-' + pick.c + pick.s, function () {
      return bkPlayPRP(pick.c, 8, pick.s, 2000, 4242);
    });
    var wins = Math.abs(r.rate - 0.5) > 0.1;
    return {
      topic: 'blockciphers · playing PRP',
      kind: 'choice',
      prompt: '<strong>' + BK_CIPHERS[pick.c].label + '</strong>, against an adversary who ' +
        'will ' + BK_STRATEGIES[pick.s].label + '. Does the strategy win?',
      choices: ['yes — noticeably better than half', 'no — about half, so it is guessing'],
      answer: wins ? 'yes — noticeably better than half' : 'no — about half, so it is guessing',
      check: textCheck(wins ? 'yes — noticeably better than half'
                            : 'no — about half, so it is guessing'),
      explain: 'Measured over ' + r.trials.toLocaleString() + ' rounds: ' +
        (100 * r.rate).toFixed(0) + '%. ' + pick.why
    };
  } });

  /* ---- DES ---- */

  QZ_GEN.push({ topic: 'blockciphers', make: function () {
    var facts = [
      { q: 'the key length n of DES', a: '56' },
      { q: 'the block length ℓ of DES', a: '64' },
      { q: 'the number of rounds r in DES', a: '16' }
    ];
    var pick = facts[qzInt(0, facts.length - 1)];
    return {
      topic: 'blockciphers · DES',
      prompt: 'What is <strong>' + pick.q + '</strong>?',
      placeholder: 'a number',
      answer: pick.a,
      check: function (v) {
        var s = String(v).replace(/[^0-9]/g, '');
        if (!s) return { ok: false, msg: 'Give a whole number.' };
        return { ok: s === pick.a };
      },
      explain: 'DES is a Feistel network with n = 56, ℓ = 64 and r = 16. The 56-bit key is ' +
        'brute-forceable today, which is why Triple DES lingered in legacy systems — and ' +
        'why all DES variants were withdrawn from the standard in January 2024.'
    };
  } });

  /* ---- why not just let the key be a permutation ---- */

  QZ_GEN.push({ topic: 'blockciphers', make: function () {
    return {
      topic: 'blockciphers · why build one',
      kind: 'choice',
      prompt: 'Why can the key of a block cipher not simply <em>be</em> a permutation of ' +
        'the block space?',
      choices: ['it would need about ℓ · 2^ℓ bits',
                'permutations cannot be sampled uniformly',
                'the permutation would not be invertible',
                'it would make Enc deterministic'],
      answer: 'it would need about ℓ · 2^ℓ bits',
      check: textCheck('it would need about ℓ · 2^ℓ bits'),
      explain: 'A permutation of {0,1}<sup>ℓ</sup> is an image of ℓ bits for each of the ' +
        '2<sup>ℓ</sup> inputs. At ℓ = 128 that is around 4×10<sup>40</sup> bits of key. So ' +
        'the key is short and the permutation is <em>built</em> from it — by an SPN or a ' +
        'Feistel network — and we settle for behaving like a uniform permutation rather ' +
        'than being one.'
    };
  } });
