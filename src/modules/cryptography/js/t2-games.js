  /* ============================================================
     CRYPTOGRAPHY TOPIC 02 · counting, and the security games

     Two kinds of thing are made runnable here.

     First, counting. How many functions are there from M to C, how
     many of those are injective, and why Enc has to be one of the
     injective ones. The closed forms are in the notes; what is done
     here is to enumerate every function for small spaces and count,
     so the formula is checked against the thing it claims to count
     rather than taken on trust.

     Second, the games. IND-EAV, IND-CPA, IND-CCA and EUF-CMA are
     played for real — a challenger that samples a key and a bit, an
     adversary that follows a named strategy, and a measured win rate
     over many rounds. Where the right answer is known exactly (a
     one-time pad wins at exactly one half; a deterministic scheme
     loses IND-CPA every single time) the measurement has something to
     be checked against.

     Algorithms only — no DOM.
     ============================================================ */

  var GM_A = 26;
  var GM_ALPHA = 'abcdefghijklmnopqrstuvwxyz';

  /* ---------------------------------------------------------------
     Counting functions M -> C.
     --------------------------------------------------------------- */

  /** The closed forms from the notes, for |M| = s and |C| = t. */
  function gmCount(s, t) {
    if (s < 0 || t < 0) return { ok: false, error: 'Sizes cannot be negative.' };
    var functions = Math.pow(t, s);
    /* Injective: choose which s of the t ciphertexts get used, then
       order them. C(t, s) · s!, which is the falling factorial. */
    var injective = 1;
    for (var i = 0; i < s; i++) injective *= (t - i);
    if (injective < 0) injective = 0;
    return {
      ok: true, s: s, t: t,
      functions: functions,
      injective: injective,
      bijections: s === t ? factorial(s) : 0,
      possible: t >= s
    };
  }

  function factorial(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }

  /**
   * The same two numbers, by enumeration.
   *
   * Every one of the tˢ functions is built and inspected, so the
   * formulas above are compared against a count of the actual objects.
   * Only worth doing for small spaces, which is all it takes.
   */
  function gmEnumerate(s, t) {
    var total = Math.pow(t, s);
    if (total > 300000) return { ok: false, error: 'Too many functions to enumerate.' };
    var injective = 0, surjective = 0;
    var f = [];
    for (var n = 0; n < total; n++) {
      var x = n;
      for (var i = 0; i < s; i++) { f[i] = x % t; x = Math.floor(x / t); }
      var seen = {}, inj = true;
      for (var j = 0; j < s; j++) {
        if (seen[f[j]]) { inj = false; break; }
        seen[f[j]] = true;
      }
      if (inj) injective++;
      if (Object.keys(seen).length === t) surjective++;
    }
    return { ok: true, s: s, t: t, functions: total, injective: injective,
             surjective: surjective };
  }

  /**
   * Why Enc has to be injective, decided rather than argued.
   *
   * Correctness says Dec(sk, Enc(sk, m)) = m for every m. Dec is a
   * function of the ciphertext alone, so if two messages share a
   * ciphertext, Dec has one value to return and two messages that need
   * returning — it can satisfy at most one of them. Enumerate every
   * Enc and ask, for each, whether any Dec at all makes it correct.
   */
  function gmInjectiveNeeded(s, t) {
    var total = Math.pow(t, s);
    if (total > 300000) return { ok: false, error: 'Too many functions to enumerate.' };
    var invertible = 0, injective = 0, mismatch = 0;
    var f = [];
    for (var n = 0; n < total; n++) {
      var x = n;
      for (var i = 0; i < s; i++) { f[i] = x % t; x = Math.floor(x / t); }

      /* Build the best possible Dec: send each used ciphertext back to
         a message that maps to it. Then check every message. */
      var dec = {};
      for (var j = 0; j < s; j++) if (!(f[j] in dec)) dec[f[j]] = j;
      var allBack = true;
      for (var k = 0; k < s; k++) if (dec[f[k]] !== k) { allBack = false; break; }

      var seen = {}, inj = true;
      for (var p = 0; p < s; p++) {
        if (seen[f[p]]) { inj = false; break; }
        seen[f[p]] = true;
      }

      if (allBack) invertible++;
      if (inj) injective++;
      if (allBack !== inj) mismatch++;
    }
    return {
      ok: true, s: s, t: t, functions: total,
      invertible: invertible, injective: injective,
      /* The claim: a scheme can be made correct exactly when Enc is
         injective. Any mismatch would refute it. */
      mismatch: mismatch
    };
  }

  /* ---------------------------------------------------------------
     The schemes the games are played against.

     Each carries its own key handling, because the games turn on
     precisely that: whether a key is fresh per encryption, and whether
     Enc uses randomness at all.
     --------------------------------------------------------------- */

  var GM_SCHEMES = {

    otpFresh: {
      label: 'One-time pad, fresh key each time',
      det: false,
      note: 'A new uniform pad for every encryption, as the name demands.',
      enc: function (st, m, rnd) {
        var k = [], c = [];
        for (var i = 0; i < m.length; i++) {
          k.push(Math.floor(rnd() * GM_A));
          c.push((m[i] + k[i]) % GM_A);
        }
        return c;
      }
    },

    otpReused: {
      label: 'One-time pad, one key for the whole game',
      det: true,
      note: 'The same pad every time — the mistake the name is warning about.',
      setup: function (rnd, len) {
        var k = [];
        for (var i = 0; i < len; i++) k.push(Math.floor(rnd() * GM_A));
        return k;
      },
      enc: function (st, m) {
        return m.map(function (x, i) { return (x + st[i % st.length]) % GM_A; });
      }
    },

    shiftFixed: {
      label: 'Shift, one key for the whole game',
      det: true,
      note: 'One shift, applied to every letter of every message.',
      setup: function (rnd) { return Math.floor(rnd() * GM_A); },
      enc: function (st, m) { return m.map(function (x) { return (x + st) % GM_A; }); }
    },

    shiftFresh: {
      label: 'Shift, fresh key each time',
      det: false,
      note: 'A new shift for every encryption — randomised, but only 26 ways.',
      enc: function (st, m, rnd) {
        var k = Math.floor(rnd() * GM_A);
        return m.map(function (x) { return (x + k) % GM_A; });
      }
    }
  };

  /* A small deterministic generator, so a measured win rate is the
     same number every time the page is opened and in the tests. */
  function gmRandom(seed) {
    var s = (seed | 0) || 1;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /* ---------------------------------------------------------------
     The adversaries.

     Each is a named strategy with a stated reason, not a black box.
     `pick` chooses the challenge pair; `guess` sees the challenge
     ciphertext and whatever the oracles returned, and names a bit.
     --------------------------------------------------------------- */

  var GM_ADVERSARIES = {

    /* Ask the encryption oracle for m0, then see whether the challenge
       ciphertext is the same. Beats anything with a deterministic Enc,
       and needs an oracle, so it is a CPA strategy. */
    replay: {
      label: 'encrypt m₀ yourself and compare',
      needs: 'enc',
      pick: function () { return [[0, 0], [1, 1]]; },
      guess: function (cb, oracles) {
        var c0 = oracles.enc([0, 0]);
        return same(c0, cb) ? 0 : 1;
      }
    },

    /* No oracle. Choose a pair that differ in the *pattern* of their
       letters: "aa" has two equal letters, "ab" does not. A single
       shift preserves that, whatever the key. */
    pattern: {
      label: 'choose m₀ = aa and m₁ = ab, and look at the pattern',
      needs: null,
      pick: function () { return [[0, 0], [0, 1]]; },
      guess: function (cb) { return cb[0] === cb[1] ? 0 : 1; }
    },

    /* No oracle, and no idea. The baseline every definition is measured
       against: you can always just guess. */
    coin: {
      label: 'flip a coin',
      needs: null,
      pick: function () { return [[0, 0], [0, 1]]; },
      guess: function (cb, oracles, rnd) { return rnd() < 0.5 ? 0 : 1; }
    },

    /* Hand the challenge straight back to the decryption oracle and ask
       what it says. This is the attack the game's one exception exists to
       stop, and it is worth watching it fail: the oracle returns nothing,
       and the adversary is left guessing like anyone else. */
    askback: {
      label: 'hand the challenge ciphertext back for decryption',
      needs: 'dec',
      pick: function () { return [[0, 0], [0, 1]]; },
      guess: function (cb, oracles, rnd) {
        var m = oracles.dec(cb);
        if (m === null) return rnd() < 0.5 ? 0 : 1;     /* refused — nothing learned */
        return same(m, [0, 0]) ? 0 : 1;
      }
    },

    /* Hand the challenge ciphertext back to the decryption oracle with
       one letter changed, undo the change, and read the message. Only
       available with a decryption oracle, and only because the pad lets
       a change pass straight through — the malleability from Topic 1,
       now cashed in as a distinguisher. */
    maul: {
      label: 'alter the challenge ciphertext and have it decrypted',
      needs: 'dec',
      pick: function () { return [[0, 0], [0, 1]]; },
      guess: function (cb, oracles) {
        var tweaked = cb.map(function (x, i) { return i === 0 ? (x + 1) % GM_A : x; });
        var m = oracles.dec(tweaked);
        if (m === null) return 0;                       /* refused: learn nothing */
        var undone = m.map(function (x, i) { return i === 0 ? (x - 1 + GM_A) % GM_A : x; });
        return same(undone, [0, 0]) ? 0 : 1;
      }
    }
  };

  function same(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /* ---------------------------------------------------------------
     Playing a game.

     game: 'eav' (no oracles), 'cpa' (encryption oracle), 'cca' (both,
     with the challenge ciphertext refused by the decryption oracle —
     without that rule every scheme loses and the definition says
     nothing).
     --------------------------------------------------------------- */

  function gmPlay(schemeId, advId, game, rounds, seed) {
    var S = GM_SCHEMES[schemeId], ADV = GM_ADVERSARIES[advId];
    if (!S || !ADV) return { ok: false, error: 'No such scheme or adversary.' };

    var allowed = { eav: [], cpa: ['enc'], cca: ['enc', 'dec'] }[game];
    if (!allowed) return { ok: false, error: 'No such game.' };
    if (ADV.needs && allowed.indexOf(ADV.needs) < 0) {
      return { ok: false, unavailable: true,
        error: 'That strategy needs the ' + (ADV.needs === 'enc' ? 'encryption' : 'decryption') +
          ' oracle, which ' + game.toUpperCase() + ' does not give the adversary.' };
    }

    var rnd = gmRandom(seed || 1);
    var wins = 0, n = rounds || 2000, decRefusals = 0;

    for (var r = 0; r < n; r++) {
      /* Challenger: sample a key and a uniform bit. */
      var st = S.setup ? S.setup(rnd, 2) : null;
      var b = rnd() < 0.5 ? 0 : 1;

      var pair = ADV.pick();
      var m0 = pair[0], m1 = pair[1];
      if (m0.length !== m1.length) continue;           /* the challenger aborts */

      var cb = S.enc(st, b === 0 ? m0 : m1, rnd);

      var oracles = {
        enc: allowed.indexOf('enc') >= 0
          ? function (m) { return S.enc(st, m, rnd); }
          : null,
        dec: allowed.indexOf('dec') >= 0
          ? function (c) {
              /* The rule that keeps IND-CCA from being vacuous. */
              if (same(c, cb)) { decRefusals++; return null; }
              return gmDecrypt(schemeId, st, c);
            }
          : null
      };

      if (ADV.guess(cb, oracles, rnd) === b) wins++;
    }

    return {
      ok: true, scheme: schemeId, adversary: advId, game: game,
      rounds: n, wins: wins, rate: wins / n, refusals: decRefusals
    };
  }

  /** Decryption, for the schemes whose key is fixed for the game. */
  function gmDecrypt(schemeId, st, c) {
    if (schemeId === 'shiftFixed') {
      return c.map(function (x) { return (x - st + GM_A) % GM_A; });
    }
    if (schemeId === 'otpReused') {
      return c.map(function (x, i) { return (x - st[i % st.length] + GM_A) % GM_A; });
    }
    /* With a fresh key per encryption there is nothing for a decryption
       oracle to use, so the game simply does not offer one here. */
    return null;
  }

  /* ---------------------------------------------------------------
     EUF-CMA, and a MAC that loses it.

     Tag(ik, m) = (sum of the letters of m) + ik, mod 26. Perfectly
     usable-looking, and it cannot tell one arrangement of a message
     from another: anagrams share a tag. So one query is enough.
     --------------------------------------------------------------- */

  function gmSumTag(ik, m) {
    var s = ik;
    for (var i = 0; i < m.length; i++) s += m[i];
    return ((s % GM_A) + GM_A) % GM_A;
  }

  function gmSumVerify(ik, m, tag) { return gmSumTag(ik, m) === tag; }

  /**
   * Play EUF-CMA against it: query a tag for one message, output a
   * rearrangement of that message with the same tag. The forgery is a
   * message not in Q, so it counts.
   */
  function gmForge(msg) {
    var m = [];
    var s = String(msg || 'abc').toLowerCase();
    for (var i = 0; i < s.length; i++) {
      var k = GM_ALPHA.indexOf(s.charAt(i));
      if (k >= 0) m.push(k);
    }
    if (m.length < 2) return { ok: false, error: 'Use at least two letters.' };

    var forged = m.slice().reverse();
    if (same(forged, m)) {                       /* a palindrome is not a new message */
      forged = m.slice();
      var tmp = forged[0]; forged[0] = (forged[0] + 1) % GM_A;
      forged[1] = (forged[1] - 1 + GM_A) % GM_A;
      if (same(forged, m)) forged[0] = (forged[0] + 1) % GM_A;
    }

    /* It works for every key, which is the point: the forger does not
       have one and does not need one. */
    var bad = 0;
    for (var ik = 0; ik < GM_A; ik++) {
      if (gmSumTag(ik, m) !== gmSumTag(ik, forged)) bad++;
    }

    return {
      ok: true,
      queried: letters(m), forged: letters(forged),
      isNew: !same(m, forged),
      tagAt: function (ik) { return gmSumTag(ik, m); },
      worksForEveryKey: bad === 0,
      keysChecked: GM_A, keysFailed: bad
    };
  }

  function letters(v) {
    var s = '';
    for (var i = 0; i < v.length; i++) s += GM_ALPHA.charAt(v[i]);
    return s;
  }

  /**
   * How often a forgery succeeds, over every key and a sweep of
   * messages — the EUF-CMA win probability of this MAC, measured.
   * "Noticeably different from zero" is an understatement: it is one.
   */
  function gmForgeRate(len) {
    if (len < 2 || len > 3) return { ok: false, error: 'Two or three letters.' };
    var size = Math.pow(GM_A, len), wins = 0, total = 0;
    for (var n = 0; n < size; n++) {
      var m = [], x = n;
      for (var i = 0; i < len; i++) { m.push(x % GM_A); x = Math.floor(x / GM_A); }
      var f = m.slice().reverse();
      if (same(f, m)) continue;                 /* no new message to forge for */
      for (var ik = 0; ik < GM_A; ik++) {
        total++;
        if (gmSumVerify(ik, f, gmSumTag(ik, m))) wins++;
      }
    }
    return { ok: true, len: len, wins: wins, total: total, rate: total ? wins / total : 0 };
  }

  /* ---------------------------------------------------------------
     Canonical verification, and why it needs a deterministic Tag.

     Canonical Vf recomputes the tag and compares. If Tag is randomised,
     the tag that arrives is one of several valid ones and the recomputed
     tag is another, so a perfectly honest message-tag pair is rejected —
     correctness fails, before security is even discussed.
     --------------------------------------------------------------- */

  function gmCanonical(randomised, trials, seed) {
    var rnd = gmRandom(seed || 7);
    var n = trials || 2000, rejected = 0;
    for (var i = 0; i < n; i++) {
      var ik = Math.floor(rnd() * GM_A);
      var m = [Math.floor(rnd() * GM_A), Math.floor(rnd() * GM_A)];

      /* Tag: deterministic, or salted with a value the verifier cannot
         see. Both are legitimate tags produced by the honest tagger. */
      var tau = randomised
        ? { t: gmSumTag(ik, m), salt: Math.floor(rnd() * 5) }
        : { t: gmSumTag(ik, m), salt: 0 };
      if (randomised) tau.t = (tau.t + tau.salt) % GM_A;

      /* Canonical Vf: recompute and compare. It has no salt to use. */
      var recomputed = gmSumTag(ik, m);
      if (recomputed !== tau.t) rejected++;
    }
    return {
      ok: true, randomised: !!randomised, trials: n, rejected: rejected,
      rate: rejected / n
    };
  }

  window.GM_SCHEMES = GM_SCHEMES;
  window.GM_ADVERSARIES = GM_ADVERSARIES;
  window.gmCount = gmCount;
  window.gmEnumerate = gmEnumerate;
  window.gmInjectiveNeeded = gmInjectiveNeeded;
  window.gmPlay = gmPlay;
  window.gmDecrypt = gmDecrypt;
  window.gmSumTag = gmSumTag;
  window.gmSumVerify = gmSumVerify;
  window.gmForge = gmForge;
  window.gmForgeRate = gmForgeRate;
  window.gmCanonical = gmCanonical;
  window.gmLetters = letters;
