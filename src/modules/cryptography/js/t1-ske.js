  /* ============================================================
     CRYPTOGRAPHY TOPIC 01 · schemes, breaks and malleability

     Everything here works over the 26-letter alphabet, which is small
     enough that most of the claims on the page can be settled by
     exhaustion rather than asserted. That is the point of the topic:
     the difference between a scheme being *correct* and a scheme being
     *secure* is only visible when you can run the attack.

     Algorithms only — no DOM. t1-ui.js renders what these return.
     ============================================================ */

  var SK_A = 26;
  var SK_ALPHA = 'abcdefghijklmnopqrstuvwxyz';

  /* English letter frequencies, in percent. The table every frequency
     attack is built on; the attack below is only as good as this is. */
  var SK_FREQ = {
    a: 8.167, b: 1.492, c: 2.782, d: 4.253, e: 12.702, f: 2.228, g: 2.015,
    h: 6.094, i: 6.966, j: 0.153, k: 0.772, l: 4.025, m: 2.406, n: 6.749,
    o: 7.507, p: 1.929, q: 0.095, r: 5.987, s: 6.327, t: 9.056, u: 2.758,
    v: 0.978, w: 2.360, x: 0.150, y: 1.974, z: 0.074
  };

  /* The passage the frequency attack is measured on, here and in the tests, so
     the percentages quoted on the page are about something fixed and checkable
     rather than about whatever happened to be typed in. */
  var SK_SAMPLE = 'the point of a definition is that it says what an adversary may do ' +
    'and what they must not be able to achieve and until you have written both halves ' +
    'down you have not said anything at all about security';

  /** Letters only, lowercased, as indices 0..25. Everything else is dropped. */
  function skNums(text) {
    var out = [];
    var s = String(text == null ? '' : text).toLowerCase();
    for (var i = 0; i < s.length; i++) {
      var k = SK_ALPHA.indexOf(s.charAt(i));
      if (k >= 0) out.push(k);
    }
    return out;
  }

  /** Indices back to letters. */
  function skText(nums) {
    var s = '';
    for (var i = 0; i < nums.length; i++) s += SK_ALPHA.charAt(((nums[i] % SK_A) + SK_A) % SK_A);
    return s;
  }

  /* ---------------------------------------------------------------
     The schemes.

     Each is a triple in the sense the notes give: a key space, an Enc
     and a Dec. `rung` records the first rung of the ladder the scheme
     fails, and `why` says in one line what goes wrong. Both are claims
     the tests check by running the attack, not labels to be trusted.
     --------------------------------------------------------------- */

  var SK_SCHEMES = {

    identity: {
      label: 'Do nothing',
      keyKind: 'ignored',
      note: 'Ignores the key and writes the message out as the ciphertext.',
      rung: 2,
      why: 'The key is safe because it is never used. The message is in plain view.',
      keys: function () { return [0]; },
      enc: function (k, m) { return m.slice(); },
      dec: function (k, c) { return c.slice(); }
    },

    keepfirst: {
      label: 'Shift, but the first letter is left alone',
      keyKind: 'a shift, 0–25',
      note: 'A shift cipher that forgets to encrypt the first letter.',
      rung: 3,
      why: 'The whole message is not recoverable, but its first letter always is.',
      keys: function () { var r = []; for (var k = 0; k < SK_A; k++) r.push(k); return r; },
      enc: function (k, m) {
        return m.map(function (x, i) { return i === 0 ? x : (x + k) % SK_A; });
      },
      dec: function (k, c) {
        return c.map(function (x, i) { return i === 0 ? x : (x - k + SK_A) % SK_A; });
      }
    },

    shift: {
      label: 'Shift (Caesar)',
      keyKind: 'a shift, 0–25',
      note: 'Adds the same number to every letter.',
      rung: 4,
      why: 'Nothing is recoverable letter by letter, but the letter statistics survive ' +
           'the encryption untouched, and they identify the key.',
      keys: function () { var r = []; for (var k = 0; k < SK_A; k++) r.push(k); return r; },
      enc: function (k, m) { return m.map(function (x) { return (x + k) % SK_A; }); },
      dec: function (k, c) { return c.map(function (x) { return (x - k + SK_A) % SK_A; }); }
    },

    otp: {
      label: 'One-time pad',
      keyKind: 'one letter of key per letter of message',
      note: 'Adds a fresh random letter to each letter of the message.',
      rung: 5,
      why: 'An eavesdropper learns nothing at all — but anyone who can touch the ' +
           'ciphertext can change the message underneath it.',
      keys: null,                       /* key space depends on the message length */
      enc: function (k, m) { return m.map(function (x, i) { return (x + k[i]) % SK_A; }); },
      dec: function (k, c) { return c.map(function (x, i) { return (x - k[i] + SK_A) % SK_A; }); }
    }
  };

  /* ---------------------------------------------------------------
     Correctness, by exhaustion.

     Dec(sk, Enc(sk, m)) = m, for every key and every message of the
     given length. For the small schemes that is the whole domain, so
     the answer is settled rather than sampled — and it is deliberately
     reported separately from any security claim, because the notes'
     point is that one says nothing about the other.
     --------------------------------------------------------------- */

  function skCorrect(id, len) {
    var S = SK_SCHEMES[id];
    if (!S) return { ok: false, error: 'No scheme called ' + id + '.' };
    if (!S.keys) return { ok: false, error: 'This scheme’s key space depends on the ' +
      'message, so there is no fixed key space to run through.' };

    var keys = S.keys();
    var total = 0, bad = 0, first = null;
    var msgs = Math.pow(SK_A, len);
    if (msgs * keys.length > 2e6) return { ok: false, error: 'Too many cases to exhaust.' };

    for (var ki = 0; ki < keys.length; ki++) {
      for (var n = 0; n < msgs; n++) {
        var m = [], t = n;
        for (var p = 0; p < len; p++) { m.push(t % SK_A); t = Math.floor(t / SK_A); }
        var back = S.dec(keys[ki], S.enc(keys[ki], m));
        total++;
        var same = back.length === m.length;
        for (var q = 0; same && q < m.length; q++) if (back[q] !== m[q]) same = false;
        if (!same && !first) first = { key: keys[ki], m: skText(m), got: skText(back) };
        if (!same) bad++;
      }
    }
    return { ok: true, total: total, bad: bad, first: first, keys: keys.length, len: len };
  }

  /* ---------------------------------------------------------------
     Rung ii — the message is simply there.
     --------------------------------------------------------------- */

  function skReadOff(id, msg) {
    var S = SK_SCHEMES[id];
    var m = skNums(msg);
    var c = S.enc(S.keys ? S.keys()[0] : [], m);
    return { plaintext: skText(m), ciphertext: skText(c), identical: skText(m) === skText(c) };
  }

  /* ---------------------------------------------------------------
     Rung iii — a part of the message is recoverable.

     With the first letter left in the clear, you do not need the key
     to read it: it is the ciphertext's own first letter.
     --------------------------------------------------------------- */

  function skPartial(msg, key) {
    var S = SK_SCHEMES.keepfirst;
    var m = skNums(msg);
    if (!m.length) return { ok: false, error: 'Give a message with at least one letter.' };
    var c = S.enc(key, m);
    return {
      ok: true,
      plaintext: skText(m), ciphertext: skText(c),
      leaked: skText([c[0]]), truth: skText([m[0]]),
      correct: c[0] === m[0]
    };
  }

  /* ---------------------------------------------------------------
     Rung iv — the statistics survive.

     Chi-squared against the English table, for each of the 26 shifts.
     The smallest score names the key. Nothing here knows the key; it
     is recovered from the ciphertext and the language alone.
     --------------------------------------------------------------- */

  /* The expected proportions, as a plain array indexed by letter. Looking the
     frequency up by character inside the scoring loop was the single slowest
     thing on the page: in a browser a global lookup is cheap, but the test
     harness runs the page in jsdom, where every one goes through a proxy. */
  var SK_EXPECT = [];
  for (var skE = 0; skE < SK_A; skE++) SK_EXPECT[skE] = SK_FREQ[SK_ALPHA.charAt(skE)] / 100;

  /** Letter histogram of a ciphertext. */
  function skHist(ct) {
    var h = [];
    for (var i = 0; i < SK_A; i++) h[i] = 0;
    for (var j = 0; j < ct.length; j++) h[ct[j]]++;
    return h;
  }

  /**
   * Score all 26 shifts from a histogram alone.
   *
   * Decrypting by k maps ciphertext letter j+k to plaintext letter j, so the
   * decrypted histogram is this one rotated — there is no need to decrypt the
   * text to score it. That makes the work 26×26 whatever the message length.
   */
  function skChiHist(hist, n) {
    var scores = [], A = SK_A, E = SK_EXPECT;
    for (var k = 0; k < A; k++) {
      var x = 0;
      for (var j = 0; j < A; j++) {
        var e = n * E[j];
        var d = hist[(j + k) % A] - e;
        x += d * d / e;
      }
      scores.push({ key: k, chi: x });
    }
    return scores;
  }

  function skChi(ct) {
    var scores = skChiHist(skHist(ct), ct.length);
    for (var i = 0; i < scores.length; i++) {
      scores[i].guess = skText(ct.map(function (y) {
        return (y - scores[i].key + SK_A) % SK_A;
      }));
    }
    var best = scores[0];
    for (var b = 1; b < scores.length; b++) if (scores[b].chi < best.chi) best = scores[b];
    return { scores: scores, best: best };
  }

  function skBreakShift(msg, key) {
    var m = skNums(msg);
    if (m.length < 1) return { ok: false, error: 'Give a message with some letters in it.' };
    var c = SK_SCHEMES.shift.enc(key, m);
    var r = skChi(c);
    var ranked = r.scores.slice().sort(function (a, b) { return a.chi - b.chi; });
    return {
      ok: true,
      plaintext: skText(m), ciphertext: skText(c),
      key: key, found: r.best.key, correct: r.best.key === key,
      letters: m.length, ranked: ranked
    };
  }

  /** Letter counts, for showing that encryption moved them but did not change them. */
  function skCounts(nums) {
    var out = [];
    for (var i = 0; i < SK_A; i++) out.push(0);
    for (var j = 0; j < nums.length; j++) out[nums[j]]++;
    return out;
  }

  /* ---------------------------------------------------------------
     The one-time pad is perfectly secret — by exhaustion.

     For an n-letter message, count the keys that carry each message to
     each ciphertext. Every count is 1, so after seeing a ciphertext
     every message remains exactly as likely as it was before: the
     ciphertext has told the eavesdropper nothing. This is the whole
     argument, done by counting rather than asserted.
     --------------------------------------------------------------- */

  function skPerfect(n) {
    if (n < 1 || n > 2) return { ok: false, error: 'Only n = 1 or 2 is small enough to exhaust.' };
    var size = Math.pow(SK_A, n);

    /* Count by tallying rather than by searching. Walking every (message,
       key) pair and recording which ciphertext it produces fills in the same
       table as asking, for every (message, ciphertext), how many keys join
       them — and does it in size² steps instead of size³. For two letters
       that is the difference between half a million and three hundred
       million, which is the difference between a tool and a hung tab. */
    var table = new Uint32Array(size * size);          /* [ciphertext][message] */
    var digits = [];

    for (var mi = 0; mi < size; mi++) {
      /* message as digits, low-order first */
      var t = mi;
      for (var p = 0; p < n; p++) { digits[p] = t % SK_A; t = Math.floor(t / SK_A); }
      for (var ki = 0; ki < size; ki++) {
        var u = ki, ci = 0, place = 1;
        for (var q = 0; q < n; q++) {
          ci += ((digits[q] + (u % SK_A)) % SK_A) * place;
          u = Math.floor(u / SK_A);
          place *= SK_A;
        }
        table[ci * size + mi]++;
      }
    }

    var distinct = {};
    for (var i = 0; i < table.length; i++) distinct[table[i]] = true;
    var kinds = Object.keys(distinct).map(Number).sort(function (a, b) { return a - b; });

    return {
      ok: true, n: n,
      messages: size, ciphertexts: size, keys: size,
      pairs: size * size,
      kinds: kinds,                                   /* should be exactly [1] */
      uniform: kinds.length === 1 && kinds[0] === 1
    };
  }

  /* ---------------------------------------------------------------
     Rung v, and the reason integrity is a separate property.

     The pad hides the message completely, and is still no protection
     at all against someone who can write on the parchment. Add d to
     the ciphertext and the receiver decrypts m + d: the attacker never
     learns m, never touches the key, and still chooses what the
     receiver reads. Secrecy and integrity are different things.
     --------------------------------------------------------------- */

  function skMalleate(msg, target, keySeed) {
    var m = skNums(msg), t = skNums(target);
    if (!m.length) return { ok: false, error: 'Give a message with some letters in it.' };
    if (!t.length) return { ok: false, error: 'Give a target with some letters in it.' };
    if (t.length !== m.length) {
      return { ok: false, error: 'The target has to be the same length as the message: ' +
        m.length + ' letter' + (m.length === 1 ? '' : 's') + ', not ' + t.length +
        '. (An attacker who can also change the length has an easier job, not a harder one.)' };
    }

    /* A key the attacker never sees. Seeded so the page is reproducible. */
    var k = [], seed = (keySeed | 0) || 1;
    for (var i = 0; i < m.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      k.push(seed % SK_A);
    }

    var c = SK_SCHEMES.otp.enc(k, m);
    var delta = m.map(function (x, j) { return (t[j] - x + SK_A) % SK_A; });
    var c2 = c.map(function (x, j) { return (x + delta[j]) % SK_A; });
    var got = SK_SCHEMES.otp.dec(k, c2);

    return {
      ok: true,
      message: skText(m), target: skText(t),
      key: skText(k), ciphertext: skText(c), delta: skText(delta),
      tampered: skText(c2), received: skText(got),
      worked: skText(got) === skText(t),
      /* The honest caveat: this particular attack needs to know m. The
         weaker one below needs nothing at all. */
      blindShift: skText(SK_OTP_blind(k, m, 1))
    };
  }

  /** Add one to every ciphertext letter knowing nothing: the message shifts by one. */
  function SK_OTP_blind(k, m, d) {
    var c = SK_SCHEMES.otp.enc(k, m);
    var c2 = c.map(function (x) { return (x + d) % SK_A; });
    return SK_SCHEMES.otp.dec(k, c2);
  }

  /**
   * Does the attack work for every message, target and key?
   *
   * One letter is the whole proof. The pad acts on each letter on its own,
   * so a longer message is the one-letter case repeated, not a new case —
   * which is why exhausting 26³ here settles it rather than sampling it.
   * (Two letters would be 26⁶ = 308 million, and says nothing more.)
   */
  function skMalleableAlways(len) {
    if (len > 1) return { ok: false, error: 'One letter exhausts the argument; the pad ' +
      'treats each letter separately, so longer messages add cases but no new behaviour.' };
    var size = Math.pow(SK_A, len), bad = 0, total = 0;
    function vec(i) { var v = [], t = i; for (var p = 0; p < len; p++) { v.push(t % SK_A); t = Math.floor(t / SK_A); } return v; }
    for (var mi = 0; mi < size; mi++) {
      for (var ki = 0; ki < size; ki++) {
        for (var ti = 0; ti < size; ti++) {
          var m = vec(mi), k = vec(ki), t = vec(ti);
          var c = SK_SCHEMES.otp.enc(k, m);
          var d = m.map(function (x, j) { return (t[j] - x + SK_A) % SK_A; });
          var got = SK_SCHEMES.otp.dec(k, c.map(function (x, j) { return (x + d[j]) % SK_A; }));
          total++;
          for (var q = 0; q < len; q++) if (got[q] !== t[q]) { bad++; break; }
        }
      }
    }
    return { ok: true, total: total, bad: bad, len: len };
  }

  /* ---------------------------------------------------------------
     A tag, and what it does and does not do.

     This is illustrative, not a real MAC: it is a keyed checksum over
     the ciphertext, and it is here to show the *shape* of integrity —
     a tag computed with a second key, checked before decrypting —
     rather than to be relied on. A real construction is the business
     of a later topic; the notes say so on the page too.
     --------------------------------------------------------------- */

  function skTag(ik, ct) {
    var acc = 7;
    for (var i = 0; i < ct.length; i++) acc = (acc * 31 + ct[i] + ik * (i + 1)) % 9973;
    return acc;
  }

  function skVerify(ik, ct, tag) { return skTag(ik, ct) === tag; }

  /** The same tampering, now with the tag checked first. */
  function skWithTag(msg, target, keySeed, ik) {
    var r = skMalleate(msg, target, keySeed);
    if (!r.ok) return r;
    var c = skNums(r.ciphertext), c2 = skNums(r.tampered);
    var tag = skTag(ik, c);
    return {
      ok: true, base: r,
      tag: tag,
      tagOnArrival: skTag(ik, c2),
      acceptedBefore: skVerify(ik, c, tag),
      acceptedAfter: skVerify(ik, c2, tag)
    };
  }

  /**
   * How much ciphertext the frequency attack needs, measured rather than
   * guessed: every window of `len` letters of the sample, counting how often
   * the smallest chi-squared names the right key. No randomness — the same
   * sweep gives the same number every time.
   *
   * The key does not come into it, which is worth seeing. Encrypting with k
   * rotates the histogram by k, and decrypting with k' rotates it back by k',
   * so every score depends only on k − k′. The winning guess is therefore
   * always the true key shifted by the same amount, and whether the attack is
   * right is a fact about the window alone. Running all 26 keys would repeat
   * each window's answer 26 times and report a larger, no better, number;
   * skKeyIndependent() below checks that this reasoning is sound.
   */
  function skEnoughText(len) {
    var nums = skNums(SK_SAMPLE);
    if (len > nums.length) return { ok: false, error: 'Longer than the sample.' };
    var hit = 0, total = 0;
    var hist = [];
    for (var z = 0; z < SK_A; z++) hist[z] = 0;
    for (var i = 0; i < len; i++) hist[nums[i]]++;

    for (var s = 0; ; s++) {
      var scores = skChiHist(hist, len), best = 0;
      for (var b = 1; b < SK_A; b++) if (scores[b].chi < scores[best].chi) best = b;
      if (best === 0) hit++;          /* the unshifted text scores best = key found */
      total++;
      if (s + len >= nums.length) break;
      hist[nums[s]]--;                /* slide the window one letter along */
      hist[nums[s + len]]++;
    }
    return { ok: true, len: len, hit: hit, total: total, rate: hit / total };
  }

  /**
   * The claim the function above leans on: for a given stretch of text, the
   * attack either works for every key or fails for every key.
   */
  function skKeyIndependent(len, windows) {
    var nums = skNums(SK_SAMPLE), bad = 0, checked = 0;
    var last = Math.min(windows || 20, nums.length - len);
    for (var s = 0; s < last; s++) {
      var win = nums.slice(s, s + len), agree = null;
      for (var k = 0; k < SK_A; k++) {
        var ct = win.map(function (x) { return (x + k) % SK_A; });
        var right = skChi(ct).best.key === k;
        if (agree === null) agree = right;
        else if (agree !== right) bad++;
        checked++;
      }
    }
    return { ok: true, checked: checked, disagreements: bad };
  }

  window.SK_SCHEMES = SK_SCHEMES;
  window.SK_SAMPLE = SK_SAMPLE;
  window.SK_FREQ = SK_FREQ;
  window.skEnoughText = skEnoughText;
  window.skKeyIndependent = skKeyIndependent;
  window.skHist = skHist;
  window.skChiHist = skChiHist;
  window.skNums = skNums;
  window.skText = skText;
  window.skCorrect = skCorrect;
  window.skReadOff = skReadOff;
  window.skPartial = skPartial;
  window.skChi = skChi;
  window.skBreakShift = skBreakShift;
  window.skCounts = skCounts;
  window.skPerfect = skPerfect;
  window.skMalleate = skMalleate;
  window.skMalleableAlways = skMalleableAlways;
  window.skTag = skTag;
  window.skVerify = skVerify;
  window.skWithTag = skWithTag;
