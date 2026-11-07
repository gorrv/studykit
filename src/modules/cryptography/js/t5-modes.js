  /* ============================================================
     CRYPTOGRAPHY TOPIC 05 · modes of operation

     A block cipher encrypts one block. These are the ways of using
     one on a message, and the ways each of them goes wrong.

     Everything runs on 8-bit blocks with the S-box and permutation
     from the previous topic, so a mode's whole behaviour over a small
     message space can be exhausted rather than sampled — including
     the forgeries, which hold for every key rather than for the one
     that was tried.

     Algorithms only — no DOM.
     ============================================================ */

  var MD_L = 8;                       /* block length, in bits */

  /** The block cipher the modes are built on: three SPN rounds. */
  function mdF(key, block) { return bkSPN(key, block, 3, 4, true).bits; }

  /** And its inverse, which CBC and ECB need and counter mode does not. */
  function mdFInv(key, block) { return bkSPNInv(key, block, 3, 4, true).bits; }

  /** A deliberately non-invertible "block cipher", for the counter-mode point. */
  function mdFLossy(key, block) {
    var v = bkSPN(key, block, 3, 4, true).bits.slice();
    v[MD_L - 1] = 0;                  /* throw a bit away: no longer a permutation */
    return v;
  }

  function mdBlocks(bits) {
    var out = [];
    for (var i = 0; i + MD_L <= bits.length; i += MD_L) out.push(bits.slice(i, i + MD_L));
    return out;
  }

  function mdJoin(blocks) {
    var out = [];
    for (var i = 0; i < blocks.length; i++) out = out.concat(blocks[i]);
    return out;
  }

  function mdRandom(seed) {
    var s = (seed | 0) || 1;
    return function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  function mdRandBlock(rnd) { return bkFromInt(Math.floor(rnd() * 256), MD_L); }

  /* ---------------------------------------------------------------
     ECB — each block on its own, and nothing else.
     --------------------------------------------------------------- */

  function mdEcbEnc(key, msgBits) {
    return { blocks: mdBlocks(msgBits).map(function (b) { return mdF(key, b); }) };
  }

  function mdEcbDec(key, ctBlocks) {
    return mdJoin(ctBlocks.map(function (b) { return mdFInv(key, b); }));
  }

  /* ---------------------------------------------------------------
     CBC — chain each block into the next, starting from a uniform IV.
        c₀ = IV,  cᵢ = F(sk, cᵢ₋₁ ⊕ mᵢ)
     --------------------------------------------------------------- */

  function mdCbcEnc(key, msgBits, rnd) {
    var iv = mdRandBlock(rnd);
    var out = [iv], prev = iv;
    mdBlocks(msgBits).forEach(function (mi) {
      prev = mdF(key, bkXor(prev, mi));
      out.push(prev);
    });
    return { blocks: out, iv: iv };
  }

  function mdCbcDec(key, ctBlocks) {
    var out = [];
    for (var i = 1; i < ctBlocks.length; i++) {
      out.push(bkXor(ctBlocks[i - 1], mdFInv(key, ctBlocks[i])));
    }
    return mdJoin(out);
  }

  /* ---------------------------------------------------------------
     Counter — never chain, never invert.
        cᵢ = F(sk, IV‖i) ⊕ mᵢ

     The notes' worked example: with ℓ = 8 the IV is 3ℓ/4 = 6 bits, so
     IV = 110111 gives IV‖1 = 11011101 and IV‖2 = 11011110. The two
     low bits are the counter.
     --------------------------------------------------------------- */

  function mdCounterBlock(ivBits, i) {
    var ctrBits = MD_L - ivBits.length;
    return ivBits.concat(bkFromInt(i, ctrBits));
  }

  function mdCtrEnc(key, msgBits, rnd, lossy) {
    var f = lossy ? mdFLossy : mdF;
    var iv = [];
    for (var b = 0; b < (3 * MD_L) / 4; b++) iv.push(rnd() < 0.5 ? 0 : 1);
    var out = [], blocks = mdBlocks(msgBits);
    for (var i = 0; i < blocks.length; i++) {
      out.push(bkXor(f(key, mdCounterBlock(iv, i + 1)), blocks[i]));
    }
    return { blocks: out, iv: iv };
  }

  function mdCtrDec(key, ctBlocks, ivBits, lossy) {
    var f = lossy ? mdFLossy : mdF;
    var out = [];
    for (var i = 0; i < ctBlocks.length; i++) {
      out.push(bkXor(ctBlocks[i], f(key, mdCounterBlock(ivBits, i + 1))));
    }
    return mdJoin(out);
  }

  /* ---------------------------------------------------------------
     Running a mode, with everything the page needs to show it.
     --------------------------------------------------------------- */

  var MD_MODES = {
    ecb: { label: 'ECB', randomised: false, parallelEnc: true, parallelDec: true,
           needsInverse: true,
           note: 'Each block encrypted on its own. Deterministic, which is fatal.' },
    cbc: { label: 'CBC', randomised: true, parallelEnc: false, parallelDec: true,
           needsInverse: true,
           note: 'Each block is XORed with the previous ciphertext before encryption, ' +
                 'starting from a uniform IV.' },
    ctr: { label: 'Counter', randomised: true, parallelEnc: true, parallelDec: true,
           needsInverse: false,
           note: 'The cipher encrypts a counter, never the message. F is never inverted, ' +
                 'so it need not even be a permutation.' }
  };

  function mdRun(modeId, keyBits, msgBits, seed, lossy) {
    var rnd = mdRandom(seed || 1);
    var r, ct, back;
    if (modeId === 'ecb') {
      r = mdEcbEnc(keyBits, msgBits);
      ct = r.blocks;
      back = mdEcbDec(keyBits, ct);
    } else if (modeId === 'cbc') {
      r = mdCbcEnc(keyBits, msgBits, rnd);
      ct = r.blocks;
      back = mdCbcDec(keyBits, ct);
    } else {
      r = mdCtrEnc(keyBits, msgBits, rnd, lossy);
      ct = r.blocks;
      back = mdCtrDec(keyBits, ct, r.iv, lossy);
    }
    return {
      ok: true, mode: modeId,
      iv: r.iv ? bkStr(r.iv) : null,
      blocks: ct.map(bkStr),
      ciphertext: ct.map(bkStr).join(''),
      recovered: bkStr(back),
      correct: bkStr(back) === bkStr(msgBits.slice(0, back.length))
    };
  }

  /** Does encrypting the same message twice give the same ciphertext? */
  function mdDeterministic(modeId, keyBits, msgBits) {
    var a = mdRun(modeId, keyBits, msgBits, 11);
    var b = mdRun(modeId, keyBits, msgBits, 22);
    return { same: a.ciphertext === b.ciphertext, first: a.ciphertext, second: b.ciphertext };
  }

  /** Round-trip every message of the given number of blocks. */
  function mdRoundTrips(modeId, keyBits, blocks, lossy) {
    var n = Math.pow(256, blocks), bad = 0, first = null;
    if (n > 70000) return { ok: false, error: 'Too many messages to exhaust.' };
    for (var x = 0; x < n; x++) {
      var bits = [], t = x;
      for (var i = 0; i < blocks; i++) {
        bits = bkFromInt(t % 256, MD_L).concat(bits);
        t = Math.floor(t / 256);
      }
      var r = mdRun(modeId, keyBits, bits, (x % 97) + 1, lossy);
      if (!r.correct) { bad++; if (!first) first = bkStr(bits) + ' → ' + r.recovered; }
    }
    return { ok: true, messages: n, bad: bad, first: first };
  }

  /* ---------------------------------------------------------------
     ECB, broken twice over.
     --------------------------------------------------------------- */

  /**
   * The IND-CPA attack from the notes: ask the oracle for encryptions
   * of m₀ and m₁, then see which the challenge matches. It works
   * because Enc is deterministic, and for no other reason.
   */
  function mdEcbIndCpa(trials, seed) {
    var rnd = mdRandom(seed || 1), n = trials || 2000, wins = 0;
    var m0 = bkFromInt(0x5a, MD_L), m1 = bkFromInt(0xa5, MD_L);
    for (var t = 0; t < n; t++) {
      var key = mdRandBlock(rnd);
      var b = rnd() < 0.5 ? 0 : 1;
      var c0 = bkStr(mdEcbEnc(key, m0).blocks[0]);
      var c1 = bkStr(mdEcbEnc(key, m1).blocks[0]);
      var cb = bkStr(mdEcbEnc(key, b === 0 ? m0 : m1).blocks[0]);
      var guess = (cb === c0) ? 0 : 1;
      if (guess === b) wins++;
    }
    return { ok: true, trials: n, wins: wins, rate: wins / n };
  }

  /**
   * And the attack that needs no oracle at all: equal plaintext
   * blocks give equal ciphertext blocks, so a message with a repeat
   * is distinguishable from one without by looking.
   */
  function mdEcbNoOracle(trials, seed) {
    var rnd = mdRandom(seed || 1), n = trials || 2000, wins = 0;
    /* m₀ is two identical blocks, m₁ is two different ones. Same length. */
    var blockA = bkFromInt(0x3c, MD_L), blockB = bkFromInt(0xc3, MD_L);
    var m0 = blockA.concat(blockA), m1 = blockA.concat(blockB);
    for (var t = 0; t < n; t++) {
      var key = mdRandBlock(rnd);
      var b = rnd() < 0.5 ? 0 : 1;
      var c = mdEcbEnc(key, b === 0 ? m0 : m1).blocks.map(bkStr);
      var guess = (c[0] === c[1]) ? 0 : 1;
      if (guess === b) wins++;
    }
    return { ok: true, trials: n, wins: wins, rate: wins / n };
  }

  /** The same two-identical-block test, under each mode. */
  function mdRepeatLeak(modeId, keyBits) {
    var blockA = bkFromInt(0x3c, MD_L);
    var r = mdRun(modeId, keyBits, blockA.concat(blockA), 7);
    var bl = r.blocks.slice(modeId === 'cbc' ? 1 : 0);
    return { ok: true, blocks: r.blocks, leaks: bl[0] === bl[1] };
  }

  /* ---------------------------------------------------------------
     The famous picture, computed rather than borrowed.

     A small bitmap is encrypted a block at a time. Under ECB an area
     of one colour is a run of identical blocks, and identical blocks
     give identical ciphertext — so the shape survives. Under counter
     mode each block is masked differently and it does not.
     --------------------------------------------------------------- */

  function mdPicture(modeId, keyBits, w, h) {
    w = w || 32; h = h || 32;
    var rows = [];
    for (var y = 0; y < h; y++) {
      var row = [];
      for (var x = 0; x < w; x++) {
        /* A shape with large flat areas: that is what ECB fails to hide. */
        var cx = x - w / 2 + 0.5, cy = y - h / 2 + 0.5;
        var inside = (cx * cx + cy * cy) < (w * 0.32) * (w * 0.32) ||
                     (y > h * 0.72 && Math.abs(cx) < w * 0.30);
        row.push(inside ? 1 : 0);
      }
      rows.push(row);
    }

    /* Pack each row into bytes, encrypt, unpack. */
    var plainBits = [];
    rows.forEach(function (r) {
      r.forEach(function (p) { plainBits.push(p); });
    });

    var rnd = mdRandom(99);
    var out;
    if (modeId === 'ecb') {
      out = mdJoin(mdEcbEnc(keyBits, plainBits).blocks);
    } else if (modeId === 'cbc') {
      var cb = mdCbcEnc(keyBits, plainBits, rnd);
      out = mdJoin(cb.blocks.slice(1));
    } else if (modeId === 'ctr') {
      out = mdJoin(mdCtrEnc(keyBits, plainBits, rnd).blocks);
    } else {
      out = plainBits;
    }

    var pix = [];
    for (var yy = 0; yy < h; yy++) pix.push(out.slice(yy * w, (yy + 1) * w));

    /* The measure that actually captures the leak. ECB maps blocks to
       blocks one-to-one, so the number of *distinct* blocks in the
       ciphertext is exactly the number in the picture — a picture with
       large flat areas has very few, and that count survives encryption
       untouched. Counting neighbouring pixels instead would mostly
       measure the randomness inside a block, which is not the point. */
    var distinctPlain = {}, distinctOut = {};
    for (var a = 0; a < h; a++) {
      for (var bx = 0; bx + MD_L <= w; bx += MD_L) {
        distinctPlain[rows[a].slice(bx, bx + MD_L).join('')] = true;
        distinctOut[pix[a].slice(bx, bx + MD_L).join('')] = true;
      }
    }
    var totalBlocks = Math.floor(w / MD_L) * h;
    return {
      ok: true, w: w, h: h, rows: pix,
      totalBlocks: totalBlocks,
      distinctPlain: Object.keys(distinctPlain).length,
      distinctOut: Object.keys(distinctOut).length
    };
  }

  /**
   * How many blocks before the counter wraps, which is the condition
   * the notes attach to counter mode.
   *
   * The IV is 3ℓ/4 bits, leaving ℓ/4 for the counter — so the keystream
   * repeats after 2^(ℓ/4) blocks, and at ℓ = 8 that is four. Beyond
   * that, counter mode reuses a pad, and reusing a pad is the failure
   * from the perfect-secrecy topic all over again.
   */
  function mdCounterWrap(ivBits) {
    var seen = {}, repeatAt = null, seq = [];
    for (var i = 1; i <= 10; i++) {
      var blk = bkStr(mdCounterBlock(ivBits, i));
      seq.push({ i: i, block: blk, repeatOf: seen[blk] || null });
      if (seen[blk] && repeatAt === null) repeatAt = i;
      if (!seen[blk]) seen[blk] = i;
    }
    return {
      ok: true, ivBits: ivBits.length, counterBits: MD_L - ivBits.length,
      limit: Math.pow(2, MD_L - ivBits.length),
      repeatAt: repeatAt, sequence: seq
    };
  }

  /* ---------------------------------------------------------------
     CBC-MAC, and the three ways the notes say it breaks.
        τ₀ = 0ᶫ,  τᵢ = F(ik, τᵢ₋₁ ⊕ mᵢ),  τ = τ_t
     --------------------------------------------------------------- */

  function mdCbcMac(ik, msgBits, ivBits) {
    var tau = ivBits ? ivBits.slice() : bkFromInt(0, MD_L);
    var inter = [];
    mdBlocks(msgBits).forEach(function (mi) {
      tau = mdF(ik, bkXor(tau, mi));
      inter.push(bkStr(tau));
    });
    return { tag: tau, tagText: bkStr(tau), intermediates: inter };
  }

  function mdCbcMacVf(ik, msgBits, tagBits, ivBits) {
    return bkStr(mdCbcMac(ik, msgBits, ivBits).tag) === bkStr(tagBits);
  }

  /**
   * Forgery 1 — allowing messages of any length.
   *
   * Query a one-block message m₁ and get τ = F(m₁). Then the two-block
   * message m₁ ‖ (τ ⊕ m₁) has tag F(τ ⊕ (τ ⊕ m₁)) = F(m₁) = τ. One
   * query, and the forged message was never asked about.
   */
  function mdForgeVariableLength(ik, m1) {
    var tau = mdCbcMac(ik, m1).tag;
    var second = bkXor(tau, m1);
    var forged = m1.concat(second);
    var realTag = mdCbcMac(ik, forged).tag;
    return {
      ok: true,
      queried: bkStr(m1), tag: bkStr(tau),
      forged: bkStr(forged), forgedTag: bkStr(realTag),
      works: bkStr(realTag) === bkStr(tau),
      isNew: bkStr(forged) !== bkStr(m1)
    };
  }

  /** Does it work for every key and every one-block message? */
  function mdForgeAlways() {
    var bad = 0, total = 0;
    for (var k = 0; k < 256; k++) {
      var ik = bkFromInt(k, MD_L);
      for (var x = 0; x < 256; x++) {
        var r = mdForgeVariableLength(ik, bkFromInt(x, MD_L));
        total++;
        if (!r.works || !r.isNew) bad++;
      }
    }
    return { ok: true, total: total, bad: bad };
  }

  /**
   * Forgery 2 — allowing a random IV, sent alongside the tag.
   *
   * Given (IV, τ) valid for m₁, the pair (IV ⊕ Δ, τ) is valid for
   * m₁ ⊕ Δ: the first thing the chain does is XOR them together.
   */
  function mdForgeRandomIV(ik, m1, delta, ivBits) {
    var tau = mdCbcMac(ik, m1, ivBits).tag;
    var iv2 = bkXor(ivBits, delta);
    var m2 = bkXor(m1, delta);
    return {
      ok: true,
      iv: bkStr(ivBits), queried: bkStr(m1), tag: bkStr(tau),
      newIv: bkStr(iv2), forged: bkStr(m2),
      works: mdCbcMacVf(ik, m2, tau, iv2),
      isNew: bkStr(m2) !== bkStr(m1)
    };
  }

  function mdForgeIvAlways() {
    var bad = 0, total = 0;
    for (var k = 0; k < 64; k++) {
      var ik = bkFromInt(k * 4, MD_L);
      for (var x = 0; x < 64; x++) {
        for (var d = 1; d < 8; d++) {
          var r = mdForgeRandomIV(ik, bkFromInt(x * 4, MD_L), bkFromInt(d, MD_L),
                                  bkFromInt(x + 17, MD_L));
          total++;
          if (!r.works || !r.isNew) bad++;
        }
      }
    }
    return { ok: true, total: total, bad: bad };
  }

  /**
   * Forgery 3 — publishing the intermediate tags.
   *
   * τ₁ is itself a valid tag on the one-block message m₁, so handing
   * it out gives away a tag on a message that was never queried as
   * such.
   */
  function mdForgeIntermediate(ik, m1, m2) {
    var full = m1.concat(m2);
    var r = mdCbcMac(ik, full);
    var firstTag = bkBits(r.intermediates[0], MD_L);
    return {
      ok: true,
      queried: bkStr(full), tag: r.tagText,
      leaked: r.intermediates[0],
      forgedFor: bkStr(m1),
      works: mdCbcMacVf(ik, m1, firstTag)
    };
  }

  /* ---------------------------------------------------------------
     Composing an SKE and a MAC: the three orders.
     --------------------------------------------------------------- */

  var MD_COMPOSE = {
    etm: {
      label: 'Encrypt-then-MAC',
      tagOn: 'the ciphertext',
      note: 'Tag the ciphertext. Verify before decrypting. This is the one with a theorem.',
      secure: true
    },
    eam: {
      label: 'Encrypt-and-MAC',
      tagOn: 'the message, sent alongside',
      note: 'Tag the message, send both. A deterministic tag on the message gives away ' +
            'when two messages are equal — which loses IND-CPA before IND-CCA is even ' +
            'discussed.',
      secure: false
    },
    mte: {
      label: 'MAC-then-Encrypt',
      tagOn: 'the message, then encrypted with it',
      note: 'Tag the message, then encrypt message and tag together. The receiver must ' +
            'decrypt before it can check anything, so it acts on attacker-chosen input ' +
            'first.',
      secure: false
    }
  };

  function mdCompose(order, skKey, ikKey, msgBits, seed) {
    var rnd = mdRandom(seed || 1);
    if (order === 'etm') {
      var e = mdCtrEnc(skKey, msgBits, rnd);
      var c = mdJoin(e.blocks);
      return { ok: true, iv: bkStr(e.iv), ciphertext: bkStr(c),
               tag: mdCbcMac(ikKey, c).tagText, tagOn: 'the ciphertext' };
    }
    if (order === 'eam') {
      var e2 = mdCtrEnc(skKey, msgBits, rnd);
      return { ok: true, iv: bkStr(e2.iv), ciphertext: bkStr(mdJoin(e2.blocks)),
               tag: mdCbcMac(ikKey, msgBits).tagText, tagOn: 'the message' };
    }
    var tag = mdCbcMac(ikKey, msgBits).tag;
    var e3 = mdCtrEnc(skKey, msgBits.concat(tag), rnd);
    return { ok: true, iv: bkStr(e3.iv), ciphertext: bkStr(mdJoin(e3.blocks)),
             tag: null, tagOn: 'the message, and then encrypted with it' };
  }

  /**
   * Encrypt-and-MAC loses IND-CPA, measured.
   *
   * The tag is computed on the message and is deterministic, so two
   * encryptions of the same message carry the same tag however good
   * the encryption is. Submit m₀ = m₁' and watch.
   */
  function mdEamBreaksCpa(trials, seed) {
    var rnd = mdRandom(seed || 1), n = trials || 2000, wins = 0;
    var m0 = bkFromInt(0x5a, MD_L), m1 = bkFromInt(0xa5, MD_L);
    for (var t = 0; t < n; t++) {
      var sk = mdRandBlock(rnd), ik = mdRandBlock(rnd);
      var b = rnd() < 0.5 ? 0 : 1;
      /* The oracle call the adversary is allowed in IND-CPA. */
      var seen = mdCompose('eam', sk, ik, m0, Math.floor(rnd() * 1e6)).tag;
      var chal = mdCompose('eam', sk, ik, b === 0 ? m0 : m1,
                           Math.floor(rnd() * 1e6)).tag;
      var guess = (chal === seen) ? 0 : 1;
      if (guess === b) wins++;
    }
    return { ok: true, trials: n, wins: wins, rate: wins / n };
  }

  /** And Encrypt-then-MAC does not leak that, for the same test. */
  function mdEtmHoldsUp(trials, seed) {
    var rnd = mdRandom(seed || 1), n = trials || 2000, wins = 0;
    var m0 = bkFromInt(0x5a, MD_L), m1 = bkFromInt(0xa5, MD_L);
    for (var t = 0; t < n; t++) {
      var sk = mdRandBlock(rnd), ik = mdRandBlock(rnd);
      var b = rnd() < 0.5 ? 0 : 1;
      var seen = mdCompose('etm', sk, ik, m0, Math.floor(rnd() * 1e6)).tag;
      var chal = mdCompose('etm', sk, ik, b === 0 ? m0 : m1,
                           Math.floor(rnd() * 1e6)).tag;
      var guess = (chal === seen) ? 0 : 1;
      if (guess === b) wins++;
    }
    return { ok: true, trials: n, wins: wins, rate: wins / n };
  }

  /** Encrypt-then-MAC refuses a tampered ciphertext before decrypting it. */
  function mdEtmRejects(skKey, ikKey, msgBits, flipAt) {
    var r = mdCompose('etm', skKey, ikKey, msgBits, 5);
    var c = bkBits(r.ciphertext, r.ciphertext.length);
    var tampered = c.slice();
    tampered[flipAt % tampered.length] ^= 1;
    return {
      ok: true,
      tagOnArrival: mdCbcMac(ikKey, tampered).tagText,
      tagSent: r.tag,
      accepted: mdCbcMac(ikKey, tampered).tagText === r.tag,
      decryptedAnything: false
    };
  }

  /* ---------------------------------------------------------------
     AES, as facts rather than an implementation.
     --------------------------------------------------------------- */

  var MD_AES = {
    block: 128,
    subBlock: 8,
    variants: [
      { n: 128, rounds: 10 },
      { n: 192, rounds: 12 },
      { n: 256, rounds: 14 }
    ],
    stateBytes: 16,
    bruteForce: 126,
    chosen: 'Rijndael', designers: 'Vincent Rijmen and Joan Daemen',
    announced: 1997, submissions: 15, finalists: 5
  };

  window.MD_L = MD_L;
  window.MD_MODES = MD_MODES;
  window.MD_COMPOSE = MD_COMPOSE;
  window.MD_AES = MD_AES;
  window.mdF = mdF;
  window.mdFInv = mdFInv;
  window.mdFLossy = mdFLossy;
  window.mdBlocks = mdBlocks;
  window.mdJoin = mdJoin;
  window.mdCounterBlock = mdCounterBlock;
  window.mdEcbEnc = mdEcbEnc;
  window.mdEcbDec = mdEcbDec;
  window.mdCbcEnc = mdCbcEnc;
  window.mdCbcDec = mdCbcDec;
  window.mdCtrEnc = mdCtrEnc;
  window.mdCtrDec = mdCtrDec;
  window.mdRun = mdRun;
  window.mdDeterministic = mdDeterministic;
  window.mdRoundTrips = mdRoundTrips;
  window.mdEcbIndCpa = mdEcbIndCpa;
  window.mdEcbNoOracle = mdEcbNoOracle;
  window.mdRepeatLeak = mdRepeatLeak;
  window.mdPicture = mdPicture;
  window.mdCounterWrap = mdCounterWrap;
  window.mdCbcMac = mdCbcMac;
  window.mdCbcMacVf = mdCbcMacVf;
  window.mdForgeVariableLength = mdForgeVariableLength;
  window.mdForgeAlways = mdForgeAlways;
  window.mdForgeRandomIV = mdForgeRandomIV;
  window.mdForgeIvAlways = mdForgeIvAlways;
  window.mdForgeIntermediate = mdForgeIntermediate;
  window.mdCompose = mdCompose;
  window.mdEamBreaksCpa = mdEamBreaksCpa;
  window.mdEtmHoldsUp = mdEtmHoldsUp;
  window.mdEtmRejects = mdEtmRejects;
