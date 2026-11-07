  /* ============================================================
     CRYPTOGRAPHY TOPIC 04 · block ciphers, SPNs, Feistel, PRP

     Two constructions and one security game. Everything runs on
     blocks small enough to exhaust: an 8-bit block has 256 inputs, so
     "F_sk is a permutation" and "a Feistel round inverts" are not
     claims to be argued but tables to be checked.

     The small block is also the honest limitation, and the page says
     so: at ℓ = 8 an adversary can simply read the whole function off.
     Real block ciphers use 64 or 128 bits for exactly that reason.

     Algorithms only — no DOM.
     ============================================================ */

  /* ---------------------------------------------------------------
     Bits.
     --------------------------------------------------------------- */

  function bkBits(s, len) {
    var out = [], t = String(s == null ? '' : s).replace(/[^01]/g, '');
    for (var i = 0; i < t.length; i++) out.push(t.charAt(i) === '1' ? 1 : 0);
    while (len && out.length < len) out.push(0);
    return len ? out.slice(0, len) : out;
  }

  function bkStr(v) { return v.join(''); }

  function bkFromInt(n, len) {
    var out = [];
    for (var i = len - 1; i >= 0; i--) out.push((n >> i) & 1);
    return out;
  }

  function bkToInt(v) {
    var n = 0;
    for (var i = 0; i < v.length; i++) n = n * 2 + v[i];
    return n;
  }

  function bkXor(a, b) {
    var out = [];
    for (var i = 0; i < a.length; i++) out.push(a[i] ^ b[i % b.length]);
    return out;
  }

  /* ---------------------------------------------------------------
     The substitution-permutation network.

     The S-box and the bit permutation below are the ones printed in
     the notes, extended to a full table so the construction actually
     runs. The two entries the notes give — 0110 ↦ 0101 and
     0111 ↦ 1110 — are kept exactly, and the test suite checks the
     worked example against them.
     --------------------------------------------------------------- */

  /* S: {0,1}⁴ → {0,1}⁴, as a table indexed by the 4-bit value. The
     notes print 0000↦0100, 0001↦0011, 0110↦0101, 0111↦1110; the rest
     is a permutation chosen to complete it. */
  var BK_S = [4, 3, 9, 12, 7, 15, 5, 14, 0, 13, 11, 6, 2, 8, 10, 1];

  var BK_SINV = (function () {
    var inv = [];
    for (var i = 0; i < BK_S.length; i++) inv[BK_S[i]] = i;
    return inv;
  })();

  /* P on indices 1..8, as printed: 1↦2, 2↦6, 3↦5, 4↦1, 5↦3, 6↦4,
     7↦7, 8↦8. The bit at position i moves to position P(i). */
  var BK_P = [2, 6, 5, 1, 3, 4, 7, 8];

  var BK_PINV = (function () {
    var inv = [];
    for (var i = 0; i < BK_P.length; i++) inv[BK_P[i] - 1] = i + 1;
    return inv;
  })();

  /** Apply the S-box to each ℓ′-bit sub-block. */
  function bkSub(bits, sub) {
    var out = [];
    for (var i = 0; i < bits.length; i += sub) {
      var chunk = bits.slice(i, i + sub);
      out = out.concat(bkFromInt(BK_S[bkToInt(chunk)], sub));
    }
    return out;
  }

  function bkSubInv(bits, sub) {
    var out = [];
    for (var i = 0; i < bits.length; i += sub) {
      var chunk = bits.slice(i, i + sub);
      out = out.concat(bkFromInt(BK_SINV[bkToInt(chunk)], sub));
    }
    return out;
  }

  /** Move the bit at index i to index P(i). */
  function bkPerm(bits) {
    var out = new Array(bits.length);
    for (var i = 0; i < bits.length; i++) out[BK_P[i] - 1] = bits[i];
    return out;
  }

  function bkPermInv(bits) {
    var out = new Array(bits.length);
    for (var i = 0; i < bits.length; i++) out[i] = bits[BK_P[i] - 1];
    return out;
  }

  /**
   * One SPN, with the trace of every round.
   *
   * Each round is: XOR the round key, substitute, permute. The last
   * round does neither S nor P — it only XORs the final round key,
   * because a public permutation applied after the last key does
   * nothing an attacker cannot simply undo.
   */
  function bkSPN(keyBits, msgBits, rounds, sub, quiet) {
    var l = msgBits.length;
    sub = sub || 4;
    var steps = quiet ? null : [], state = msgBits.slice();
    if (steps) steps.push({ label: 'm⁽⁰⁾', bits: bkStr(state) });

    for (var r = 1; r <= rounds; r++) {
      var rk = bkRoundKey(keyBits, r, l);
      state = bkXor(state, rk);
      if (steps) steps.push({ label: 'sk' + r + ' ⊕', bits: bkStr(state),
                              key: bkStr(rk), round: r });
      if (r === rounds) break;                   /* no S or P in the last round */
      state = bkSub(state, sub);
      if (steps) steps.push({ label: 'S', bits: bkStr(state), round: r });
      state = bkPerm(state);
      if (steps) steps.push({ label: 'P', bits: bkStr(state), round: r });
    }
    return { ok: true, out: bkStr(state), bits: state, steps: steps, rounds: rounds };
  }

  /** Undo it, which needs S⁻¹ and P⁻¹ — and therefore needs S and P to be permutations. */
  function bkSPNInv(keyBits, ctBits, rounds, sub, quiet) {
    var l = ctBits.length;
    sub = sub || 4;
    var steps = quiet ? null : [], state = ctBits.slice();
    if (steps) steps.push({ label: 'm⁽ʳ⁾', bits: bkStr(state) });

    for (var r = rounds; r >= 1; r--) {
      var rk = bkRoundKey(keyBits, r, l);
      state = bkXor(state, rk);
      if (steps) steps.push({ label: '⊕ sk' + r, bits: bkStr(state),
                              key: bkStr(rk), round: r });
      if (r === 1) break;
      state = bkPermInv(state);
      if (steps) steps.push({ label: 'P⁻¹', bits: bkStr(state), round: r });
      state = bkSubInv(state, sub);
      if (steps) steps.push({ label: 'S⁻¹', bits: bkStr(state), round: r });
    }
    return { ok: true, out: bkStr(state), bits: state, steps: steps };
  }

  /* A key schedule: round i takes a rotated window of the key. Simple
     on purpose — designing a real one is its own subject. */
  function bkRoundKey(keyBits, r, l) {
    var out = [];
    for (var i = 0; i < l; i++) out.push(keyBits[(i + (r - 1) * 3) % keyBits.length]);
    return out;
  }

  /**
   * Is F_sk a permutation? For an 8-bit block that is 256 inputs, so
   * the question is settled by building the table.
   */
  function bkIsPermutation(keyBits, rounds, l, sub) {
    var seen = {}, n = Math.pow(2, l), collisions = 0;
    for (var x = 0; x < n; x++) {
      var y = bkSPN(keyBits, bkFromInt(x, l), rounds, sub, true).out;
      if (seen[y] !== undefined) collisions++;
      seen[y] = x;
    }
    return { ok: true, inputs: n, images: Object.keys(seen).length,
             collisions: collisions, isPerm: collisions === 0 };
  }

  /** And does inverting really return the message, for every input? */
  function bkSPNRoundTrips(keyBits, rounds, l, sub) {
    var n = Math.pow(2, l), bad = 0, first = null;
    for (var x = 0; x < n; x++) {
      var m = bkFromInt(x, l);
      var c = bkSPN(keyBits, m, rounds, sub, true).bits;
      var back = bkSPNInv(keyBits, c, rounds, sub, true).out;
      if (back !== bkStr(m)) { bad++; if (!first) first = bkStr(m) + ' → ' + back; }
    }
    return { ok: true, inputs: n, bad: bad, first: first };
  }

  /* ---------------------------------------------------------------
     Feistel networks.

     L_i = R_{i-1},  R_i = L_{i-1} ⊕ f_i(sk_i, R_{i-1}).

     The striking part is that f need not be invertible, or injective,
     or anything at all — the structure does the work. The engine
     therefore offers a deliberately terrible round function (one that
     throws away its input entirely) so that claim can be tested
     rather than believed.
     --------------------------------------------------------------- */

  var BK_ROUND_FNS = {
    mix: {
      label: 'a mixing function',
      note: 'Substitutes and rotates. Invertible, as it happens — but nothing requires it.',
      f: function (k, R) {
        var v = bkSub(bkXor(R, k), R.length);
        return v.slice(1).concat(v.slice(0, 1));
      }
    },
    constant: {
      label: 'a constant function',
      note: 'Ignores its input completely and returns zeros. As far from a permutation as ' +
        'a function can get.',
      f: function (k, R) { return R.map(function () { return 0; }); }
    },
    crush: {
      label: 'a function that collapses its input',
      note: 'Sets the second half to zero, so it is not injective: many inputs share an ' +
        'output.',
      f: function (k, R) {
        var half = Math.floor(R.length / 2);
        return R.map(function (b, i) { return i < half ? (b ^ k[i % k.length]) : 0; });
      }
    }
  };

  function bkFeistel(keyBits, msgBits, rounds, fnId, quiet) {
    var F = BK_ROUND_FNS[fnId] || BK_ROUND_FNS.mix;
    var half = msgBits.length / 2;
    var L = msgBits.slice(0, half), R = msgBits.slice(half);
    var steps = quiet ? null : [{ label: 'L₀ ∥ R₀', L: bkStr(L), R: bkStr(R) }];

    for (var i = 1; i <= rounds; i++) {
      var rk = bkRoundKey(keyBits, i, half);
      var newL = R.slice();
      var newR = bkXor(L, F.f(rk, R));
      L = newL; R = newR;
      if (steps) steps.push({ label: 'L' + i + ' ∥ R' + i, L: bkStr(L), R: bkStr(R),
                              key: bkStr(rk), round: i });
    }
    return { ok: true, out: bkStr(L) + bkStr(R), bits: L.concat(R), steps: steps };
  }

  /** The same rounds, downwards. Note f is never inverted. */
  function bkFeistelInv(keyBits, ctBits, rounds, fnId, quiet) {
    var F = BK_ROUND_FNS[fnId] || BK_ROUND_FNS.mix;
    var half = ctBits.length / 2;
    var L = ctBits.slice(0, half), R = ctBits.slice(half);
    var steps = quiet ? null
      : [{ label: 'L' + rounds + ' ∥ R' + rounds, L: bkStr(L), R: bkStr(R) }];

    for (var i = rounds; i >= 1; i--) {
      var rk = bkRoundKey(keyBits, i, half);
      var prevR = L.slice();
      var prevL = bkXor(R, F.f(rk, prevR));
      L = prevL; R = prevR;
      if (steps) steps.push({ label: 'L' + (i - 1) + ' ∥ R' + (i - 1),
                              L: bkStr(L), R: bkStr(R), key: bkStr(rk), round: i });
    }
    return { ok: true, out: bkStr(L) + bkStr(R), bits: L.concat(R), steps: steps };
  }

  /**
   * The claim worth testing: a Feistel network inverts for every
   * input and every round function, including ones that are not
   * injective. Exhausted over the whole block.
   */
  function bkFeistelRoundTrips(keyBits, rounds, l, fnId) {
    var n = Math.pow(2, l), bad = 0, first = null, images = {};
    for (var x = 0; x < n; x++) {
      var m = bkFromInt(x, l);
      var c = bkFeistel(keyBits, m, rounds, fnId, true).bits;
      var back = bkFeistelInv(keyBits, c, rounds, fnId, true).out;
      images[bkStr(c)] = true;
      if (back !== bkStr(m)) { bad++; if (!first) first = bkStr(m) + ' → ' + back; }
    }
    return { ok: true, inputs: n, bad: bad, first: first,
             images: Object.keys(images).length,
             isPerm: Object.keys(images).length === n };
  }

  /** Is the round function itself injective? Usually not, and it does not matter. */
  function bkRoundFnInjective(fnId, half) {
    var F = BK_ROUND_FNS[fnId] || BK_ROUND_FNS.mix;
    var k = bkFromInt(5, half), seen = {}, n = Math.pow(2, half), coll = 0;
    for (var x = 0; x < n; x++) {
      var y = bkStr(F.f(k, bkFromInt(x, half)));
      if (seen[y]) coll++;
      seen[y] = true;
    }
    return { ok: true, inputs: n, images: Object.keys(seen).length,
             injective: coll === 0 };
  }

  /* ---------------------------------------------------------------
     How many permutations there are, and why a key cannot be one.
     --------------------------------------------------------------- */

  function bkPermCount(l) {
    if (l < 1 || l > 7) return { ok: false, error: 'Up to ℓ = 7 here; beyond that the ' +
      'number is reported by its logarithm instead.' };
    var t = Math.pow(2, l);
    var f = BigInt(1);
    for (var i = 2n; i <= BigInt(t); i++) f *= i;
    return {
      ok: true, l: l, t: t, count: f.toString(),
      bits: bkLog2Fact(t),
      toWrite: l * t            /* ℓ·2^ℓ bits to write one down */
    };
  }

  /** log2(N!) by Stirling, which is what the notes' 2^(4.31×10⁴⁰) is. */
  function bkLog2Fact(N) {
    if (N < 2) return 0;
    var LOG2E = Math.LOG2E;
    return N * Math.log2(N) - N * LOG2E + 0.5 * Math.log2(2 * Math.PI * N);
  }

  /** The headline number from the notes, for ℓ = 128. */
  function bkHugeCase(l) {
    var logN = l;                         /* log2 of N = 2^l */
    var N = Math.pow(2, l);               /* only finite for small l */
    /* log2(N!) ≈ N·log2(N) − N·log2(e), with N = 2^l. Computed in the
       exponent so it survives ℓ = 128. */
    var term1 = Math.pow(2, l) * l;
    var term2 = Math.pow(2, l) * Math.LOG2E;
    return {
      ok: isFinite(term1),
      l: l,
      log2OfCount: term1 - term2,         /* the exponent, e.g. 4.31e40 */
      bitsToWrite: Math.pow(2, l) * l
    };
  }

  /* ---------------------------------------------------------------
     The PRP game.

     b = 0: the adversary talks to F(sk, ·). b = 1: it talks to a
     uniform permutation, built lazily — a fresh uniform image is
     chosen the first time each input is asked for, and remembered.

     The distinguisher below is a named strategy, not a black box: ask
     for two inputs and see whether the difference of the outputs is
     the difference of the inputs. A cipher that is only a XOR with
     the key has that property for every pair; one with an S-box does
     not.
     --------------------------------------------------------------- */

  var BK_CIPHERS = {
    xoronly: {
      label: 'XOR with the key, and nothing else',
      note: 'A permutation for every key, and hopeless: the key cancels out of any pair.',
      f: function (key, x) { return bkXor(x, key); }
    },
    oneround: {
      label: 'One round: key, S, P',
      note: 'The S-box breaks the difference relation, but one round leaves plenty else.',
      f: function (key, x) { return bkSPN(key, x, 2, 4, true).bits; }
    },
    threeround: {
      label: 'Three rounds',
      note: 'Confusion and diffusion applied often enough that this particular ' +
        'distinguisher stops working.',
      f: function (key, x) { return bkSPN(key, x, 4, 4, true).bits; }
    }
  };

  function bkRandom(seed) {
    var s = (seed | 0) || 1;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  /** A uniform permutation, sampled lazily as it is queried. */
  function bkLazyPerm(l, rnd) {
    var used = {}, table = {}, n = Math.pow(2, l);
    return function (x) {
      var k = bkStr(x);
      if (table[k]) return table[k];
      var y;
      do { y = bkStr(bkFromInt(Math.floor(rnd() * n), l)); } while (used[y]);
      used[y] = true; table[k] = y;
      return y;
    };
  }

  /* Where the bits of the first sub-block can land after one P. Flip a
     bit in the first nibble of a one-round network and only these output
     positions can possibly change — the S-box works on each sub-block on
     its own, and one P is not enough to carry the change anywhere else.
     Diffusion is exactly the property this measures the absence of. */
  var BK_REACH_1 = (function () {
    var set = {};
    for (var i = 0; i < 4; i++) set[BK_P[i] - 1] = true;
    return set;
  })();

  var BK_STRATEGIES = {
    difference: {
      label: 'flip one input bit and see whether the output flips the same way',
      note: 'If the output difference always equals the input difference, there is nothing ' +
        'there but a XOR. Any S-box defeats this immediately.',
      guess: function (oracle, l, rnd) {
        var x1 = bkFromInt(Math.floor(rnd() * Math.pow(2, l)), l);
        var x2 = x1.slice(); x2[0] ^= 1;
        var y1 = bkBits(oracle(x1), l), y2 = bkBits(oracle(x2), l);
        return bkStr(bkXor(x1, x2)) === bkStr(bkXor(y1, y2)) ? 0 : 1;
      }
    },
    locality: {
      label: 'flip a bit in the first half and see how far the change travels',
      note: 'One round cannot move a change outside the positions one P can reach. A ' +
        'uniform permutation scatters it everywhere. This is what "enough rounds" buys.',
      guess: function (oracle, l, rnd) {
        var x1 = bkFromInt(Math.floor(rnd() * Math.pow(2, l)), l);
        var x2 = x1.slice(); x2[0] ^= 1;
        var y1 = bkBits(oracle(x1), l), y2 = bkBits(oracle(x2), l);
        var d = bkXor(y1, y2);
        for (var i = 0; i < l; i++) {
          if (d[i] && !BK_REACH_1[i]) return 1;        /* travelled: not one round */
        }
        return 0;                                      /* contained: looks like one round */
      }
    }
  };

  /**
   * Play PRP: a uniform bit, a uniform key, and either the cipher or a
   * lazily sampled uniform permutation behind the oracle.
   */
  function bkPlayPRP(cipherId, l, strategyId, trials, seed) {
    var C = BK_CIPHERS[cipherId];
    var S = BK_STRATEGIES[strategyId] || BK_STRATEGIES.difference;
    if (!C) return { ok: false, error: 'No such cipher.' };
    var rnd = bkRandom(seed || 1);
    var n = trials || 2000, wins = 0;

    for (var t = 0; t < n; t++) {
      var b = rnd() < 0.5 ? 0 : 1;
      var key = bkFromInt(Math.floor(rnd() * Math.pow(2, l)), l);
      var oracle = b === 0
        ? (function (kk) { return function (x) { return bkStr(C.f(kk, x)); }; })(key)
        : bkLazyPerm(l, rnd);

      if (S.guess(oracle, l, rnd) === b) wins++;
    }
    return { ok: true, cipher: cipherId, strategy: strategyId,
             trials: n, wins: wins, rate: wins / n };
  }

  window.BK_S = BK_S;
  window.BK_SINV = BK_SINV;
  window.BK_P = BK_P;
  window.BK_ROUND_FNS = BK_ROUND_FNS;
  window.BK_CIPHERS = BK_CIPHERS;
  window.bkBits = bkBits;
  window.bkStr = bkStr;
  window.bkFromInt = bkFromInt;
  window.bkToInt = bkToInt;
  window.bkXor = bkXor;
  window.bkSub = bkSub;
  window.bkSubInv = bkSubInv;
  window.bkPerm = bkPerm;
  window.bkPermInv = bkPermInv;
  window.bkSPN = bkSPN;
  window.bkSPNInv = bkSPNInv;
  window.bkRoundKey = bkRoundKey;
  window.bkIsPermutation = bkIsPermutation;
  window.bkSPNRoundTrips = bkSPNRoundTrips;
  window.bkFeistel = bkFeistel;
  window.bkFeistelInv = bkFeistelInv;
  window.bkFeistelRoundTrips = bkFeistelRoundTrips;
  window.bkRoundFnInjective = bkRoundFnInjective;
  window.bkPermCount = bkPermCount;
  window.bkLog2Fact = bkLog2Fact;
  window.bkHugeCase = bkHugeCase;
  window.bkPlayPRP = bkPlayPRP;
  window.BK_STRATEGIES = BK_STRATEGIES;
