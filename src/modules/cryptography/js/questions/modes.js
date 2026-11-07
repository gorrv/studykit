  /* ---------- Topic 05 · modes of operation ---------- */

  var DMEMO = {};
  function donce(key, fn) {
    if (!(key in DMEMO)) DMEMO[key] = fn();
    return DMEMO[key];
  }

  /* ---- the counter block ---- */

  QZ_GEN.push({ topic: 'modes', make: function () {
    var ivNum = qzInt(0, 63), i = qzInt(1, 4);
    var iv = bkFromInt(ivNum, 6);
    var ans = bkStr(mdCounterBlock(iv, i));
    return {
      topic: 'modes · counter mode',
      prompt: 'In counter mode with <code>&ell; = 8</code>, the IV is <code>' +
        bkStr(iv) + '</code>. What is <code>IV&#8741;' + i + '</code>? (8 bits)',
      placeholder: 'eight bits',
      answer: ans,
      check: function (v) {
        var s = String(v).replace(/[^01]/g, '');
        if (s.length !== 8) return { ok: false, msg: 'Give eight bits.' };
        return { ok: s === ans };
      },
      explain: 'The IV is 3&ell;/4 = 6 bits, leaving 2 for the counter. So it is the IV ' +
        'followed by ' + i + ' in two bits: <code>' + ans + '</code>.'
    };
  } });

  /* ---- properties of each mode ---- */

  QZ_GEN.push({ topic: 'modes', make: function () {
    var qs = [
      { k: 'randomised', q: 'Is <strong>%s</strong> randomised?',
        v: function (M) { return M.randomised; },
        why: function (id) {
          return id === 'ecb'
            ? 'No. ECB has no IV and no coins, so the same message always gives the same ' +
              'ciphertext — which is exactly why it cannot be IND-CPA secure.'
            : 'Yes. It samples a uniform IV, which is why two encryptions of one message ' +
              'differ, and why the ciphertext is longer than the message.';
        } },
      { k: 'needsInverse', q: 'Does <strong>%s</strong> ever need <code>F<sup>&minus;1</sup></code>?',
        v: function (M) { return M.needsInverse; },
        why: function (id) {
          return id === 'ctr'
            ? 'No. Both directions compute F(sk, IV‖i) and XOR it in, so F is never ' +
              'inverted — and need not be a permutation at all. The same is true of ' +
              'CBC-MAC.'
            : 'Yes. Decryption applies F<sup>−1</sup> to each ciphertext block, so F must ' +
              'be invertible.';
        } },
      { k: 'parallelEnc', q: 'Can <strong>%s</strong> encrypt in parallel?',
        v: function (M) { return M.parallelEnc; },
        why: function (id) {
          return id === 'cbc'
            ? 'No. Each block is XORed with the <em>previous ciphertext</em>, so block i ' +
              'cannot start until block i−1 is done. Decryption, however, is parallel.'
            : 'Yes — each block is handled independently of the others.';
        } }
    ];
    var ids = ['ecb', 'cbc', 'ctr'];
    var id = ids[qzInt(0, 2)], q = qs[qzInt(0, qs.length - 1)];
    var M = MD_MODES[id];
    var yes = q.v(M);
    return {
      topic: 'modes · properties',
      kind: 'choice',
      prompt: q.q.replace('%s', M.label),
      choices: ['yes', 'no'],
      answer: yes ? 'yes' : 'no',
      check: textCheck(yes ? 'yes' : 'no'),
      explain: q.why(id)
    };
  } });

  /* ---- breaking ECB ---- */

  QZ_GEN.push({ topic: 'modes', make: function () {
    var r = donce('ecbno', function () { return mdEcbNoOracle(2000, 7); });
    return {
      topic: 'modes · breaking ECB',
      kind: 'choice',
      prompt: 'To beat ECB in IND-EAV &mdash; with <strong>no</strong> encryption oracle ' +
        '&mdash; what should the adversary submit as <code>m<sub>0</sub></code> and ' +
        '<code>m<sub>1</sub></code>?',
      choices: ['one block repeated twice, versus two different blocks',
                'a long message versus a short one',
                'the all-zero message versus the all-one message',
                'two messages differing in one bit'],
      answer: 'one block repeated twice, versus two different blocks',
      check: textCheck('one block repeated twice, versus two different blocks'),
      explain: 'Equal plaintext blocks give equal ciphertext blocks under ECB, so the ' +
        'repeat is visible in the ciphertext. Both messages are two blocks long, so the ' +
        'challenger does not abort. Measured over ' + r.trials.toLocaleString() +
        ' rounds this wins ' + (100 * r.rate).toFixed(0) + '% of the time. (Different ' +
        'lengths would simply be rejected.)'
    };
  } });

  /* ---- the ECB picture ---- */

  QZ_GEN.push({ topic: 'modes', make: function () {
    var key = bkFromInt(93, 8);
    var p = donce('picecb', function () { return mdPicture('ecb', key, 32, 32); });
    return {
      topic: 'modes · why the picture survives',
      prompt: 'A bitmap containing only <strong>' + p.distinctPlain + '</strong> distinct ' +
        'blocks is encrypted with ECB. How many distinct blocks does the ciphertext have?',
      placeholder: 'a number',
      answer: String(p.distinctOut),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === p.distinctOut };
      },
      explain: 'The same number. ECB maps blocks one-to-one, so distinct blocks stay ' +
        'distinct and equal blocks stay equal — the count cannot change. That is the whole ' +
        'reason the outline of the picture survives: a flat area is one block repeated, and ' +
        'repetition is exactly what ECB preserves.'
    };
  } });

  /* ---- CBC-MAC forgeries ---- */

  QZ_GEN.push({ topic: 'modes', make: function () {
    var items = [
      { r: 'messages of any length are allowed',
        a: 'query m₁, then output m₁ ‖ (τ ⊕ m₁) with the same tag',
        why: 'The chain computes F(τ ⊕ (τ ⊕ m₁)) = F(m₁) = τ, so the two-block message ' +
          'carries the tag of the one-block message. One query, and the forged message was ' +
          'never asked about.' },
      { r: 'a random IV is sent with the tag',
        a: 'XOR the same Δ into the IV and into m₁; the tag still verifies',
        why: 'The first step is IV ⊕ m₁. Change both by Δ and that value is unchanged, so ' +
          'the whole chain is unchanged and the tag still fits a different message.' },
      { r: 'the intermediate tags are published',
        a: 'τ₁ is already a valid tag on the one-block message m₁',
        why: 'τ₁ is by definition the CBC-MAC of m₁ alone, so publishing it hands out a ' +
          'tag for a message that was never queried as such.' }
    ];
    var pick = items[qzInt(0, items.length - 1)];
    var wrong = items.filter(function (x) { return x !== pick; }).map(function (x) {
      return x.a;
    });
    return {
      topic: 'modes · forging CBC-MAC',
      kind: 'choice',
      prompt: 'CBC-MAC, but <strong>' + pick.r + '</strong>. What is the forgery?',
      choices: [pick.a].concat(wrong).concat(['brute force the key, which is now feasible']),
      answer: pick.a,
      check: textCheck(pick.a),
      explain: pick.why
    };
  } });

  QZ_GEN.push({ topic: 'modes', make: function () {
    return {
      topic: 'modes · CBC-MAC vs CBC',
      kind: 'choice',
      prompt: 'Which of these is <em>not</em> a difference between CBC-MAC and CBC mode?',
      choices: ['CBC-MAC requires F to be a permutation',
                'CBC-MAC has no IV — it is fixed at 0^ℓ',
                'CBC-MAC outputs only the final value, not the intermediates',
                'CBC-MAC is only secure for fixed-length messages'],
      answer: 'CBC-MAC requires F to be a permutation',
      check: textCheck('CBC-MAC requires F to be a permutation'),
      explain: 'That is the one that is false. CBC-MAC never inverts F — it only ever ' +
        'computes it forwards — so F need not be a permutation, exactly as in counter mode. ' +
        'The other three are real differences, and all three are what the security depends ' +
        'on.'
    };
  } });

  /* ---- composition ---- */

  QZ_GEN.push({ topic: 'modes', make: function () {
    var opts = [
      { id: 'etm', q: 'Encrypt-then-MAC', a: 'the ciphertext' },
      { id: 'eam', q: 'Encrypt-and-MAC', a: 'the message' },
      { id: 'mte', q: 'MAC-then-Encrypt', a: 'the message' }
    ];
    var pick = opts[qzInt(0, 2)];
    return {
      topic: 'modes · composition',
      kind: 'choice',
      prompt: 'In <strong>' + pick.q + '</strong>, what is the tag computed on?',
      choices: ['the ciphertext', 'the message', 'the key', 'the IV'],
      answer: pick.a,
      check: textCheck(pick.a),
      explain: pick.id === 'etm'
        ? 'The ciphertext — the thing that actually travels. That is what lets the receiver ' +
          'verify <em>before</em> decrypting, and it is why this is the order with a theorem ' +
          'attached: IND-CPA SKE plus EUF-CMA MAC gives IND-CCA.'
        : 'The message. In Encrypt-and-MAC the tag is sent alongside the ciphertext; in ' +
          'MAC-then-Encrypt it is encrypted along with the message. Neither generically ' +
          'gives IND-CCA.'
    };
  } });

  QZ_GEN.push({ topic: 'modes', make: function () {
    var r = donce('eam', function () { return mdEamBreaksCpa(2000, 7); });
    return {
      topic: 'modes · why Encrypt-and-MAC fails',
      kind: 'choice',
      prompt: 'Encrypt-and-MAC sends <code>(c, Tag(ik, m))</code>. Which security property ' +
        'does it lose, with a deterministic MAC?',
      choices: ['IND-CPA — the tag reveals when two messages are equal',
                'EUF-CMA — the tag can be forged',
                'correctness — decryption can fail',
                'none; it is secure but slower'],
      answer: 'IND-CPA — the tag reveals when two messages are equal',
      check: textCheck('IND-CPA — the tag reveals when two messages are equal'),
      explain: 'The tag is on the message and is deterministic, so equal messages carry ' +
        'equal tags no matter how good the encryption is. Ask the oracle for m₀, then check ' +
        'whether the challenge carries the same tag: measured over ' +
        r.trials.toLocaleString() + ' rounds this wins ' + (100 * r.rate).toFixed(0) +
        '%. Note what that means — the composition destroyed a property both components ' +
        'had on their own.'
    };
  } });

  /* ---- AES ---- */

  QZ_GEN.push({ topic: 'modes', make: function () {
    var v = MD_AES.variants[qzInt(0, 2)];
    var which = qzInt(0, 1);
    var ans = which === 0 ? String(v.rounds) : String(MD_AES.block);
    return {
      topic: 'modes · AES',
      prompt: which === 0
        ? 'How many rounds does <strong>AES-' + v.n + '</strong> use?'
        : 'What is the block length of <strong>AES-' + v.n + '</strong>?',
      placeholder: 'a number',
      answer: ans,
      check: function (vv) {
        var x = parseInt(String(vv).replace(/[^0-9]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: String(x) === ans };
      },
      explain: which === 0
        ? 'AES-128, AES-192 and AES-256 use 10, 12 and 14 rounds respectively. The rounds ' +
          'are otherwise identical; only the key schedule and the count differ.'
        : 'ℓ = 128 for all three variants — only the <em>key</em> length changes. The state ' +
          'is therefore always 16 bytes, held as a 4×4 square.'
    };
  } });

  QZ_GEN.push({ topic: 'modes', make: function () {
    return {
      topic: 'modes · AES structure',
      kind: 'choice',
      prompt: 'AES is which kind of construction?',
      choices: ['a substitution-permutation network', 'a Feistel network',
                'a stream cipher', 'a counter mode'],
      answer: 'a substitution-permutation network',
      check: textCheck('a substitution-permutation network'),
      explain: 'AES is an SPN: SubBytes is S (acting on bytes, so ℓ′ = 8), and ShiftRows ' +
        'followed by MixColumns together form P. DES, which AES replaced, is the Feistel ' +
        'network — a common thing to get the wrong way round.'
    };
  } });

  /* ---- the counter limit ---- */

  QZ_GEN.push({ topic: 'modes', make: function () {
    var cw = donce('wrap', function () { return mdCounterWrap(bkFromInt(55, 6)); });
    return {
      topic: 'modes · the counter limit',
      prompt: 'With <code>&ell; = 8</code>, the counter-mode IV takes <code>3&ell;/4</code> ' +
        'bits. After how many blocks does the keystream start repeating?',
      placeholder: 'a number',
      answer: String(cw.limit),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === cw.limit };
      },
      explain: 'The IV takes 6 bits, leaving ℓ/4 = 2 for the counter, so there are only ' +
        '2² = 4 distinct counter blocks and the fifth repeats the first. In general the ' +
        'limit is 2^(ℓ/4) blocks — at ℓ = 128 that is 2³² and nobody notices, which is why ' +
        'the condition looks like a formality until ℓ is small. Past it, a pad is reused, ' +
        'and a reused pad leaks the difference of the messages.'
    };
  } });
