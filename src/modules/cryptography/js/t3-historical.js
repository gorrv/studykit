  /* ============================================================
     CRYPTOGRAPHY TOPIC 03 · the historical ciphers, and breaking them

     Three ciphers that were each a fix for the last one's flaw, and
     the cryptanalysis that caught up with all of them. Everything here
     runs: the key spaces are counted exactly rather than quoted, the
     trace argument is settled by exhaustion, Vigenère is broken column
     by column with the success rate measured against ciphertext
     length, and the two-time pad gives up the difference of its
     messages on demand.

     Algorithms only — no DOM.
     ============================================================ */

  var HI_A = 26;
  var HI_ALPHA = 'abcdefghijklmnopqrstuvwxyz';

  function hiNums(s) {
    var out = [], t = String(s == null ? '' : s).toLowerCase();
    for (var i = 0; i < t.length; i++) {
      var k = HI_ALPHA.indexOf(t.charAt(i));
      if (k >= 0) out.push(k);
    }
    return out;
  }

  function hiText(v) {
    var s = '';
    for (var i = 0; i < v.length; i++) s += HI_ALPHA.charAt(((v[i] % HI_A) + HI_A) % HI_A);
    return s;
  }

  /* ---------------------------------------------------------------
     The three ciphers.
     --------------------------------------------------------------- */

  /** Caesar: one shift, every letter. */
  function hiCaesarEnc(k, m) { return m.map(function (x) { return (x + k) % HI_A; }); }
  function hiCaesarDec(k, c) { return c.map(function (x) { return (x - k + HI_A) % HI_A; }); }

  /** Monoalphabetic substitution: an arbitrary permutation of the alphabet. */
  function hiSubstEnc(perm, m) { return m.map(function (x) { return perm[x]; }); }
  function hiSubstDec(perm, c) {
    var inv = [];
    for (var i = 0; i < perm.length; i++) inv[perm[i]] = i;
    return c.map(function (x) { return inv[x]; });
  }

  /** A permutation from a seed, so the page is reproducible. */
  function hiPerm(seed) {
    var p = [], s = (seed | 0) || 1;
    for (var i = 0; i < HI_A; i++) p.push(i);
    for (var j = HI_A - 1; j > 0; j--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var r = s % (j + 1);
      var t = p[j]; p[j] = p[r]; p[r] = t;
    }
    return p;
  }

  /** Vigenère: a repeating key of shifts. */
  function hiVigEnc(key, m) {
    return m.map(function (x, i) { return (x + key[i % key.length]) % HI_A; });
  }
  function hiVigDec(key, c) {
    return c.map(function (x, i) { return (x - key[i % key.length] + HI_A) % HI_A; });
  }

  /* ---------------------------------------------------------------
     How big the key spaces are.

     26! does not fit in a double, so it is computed with BigInt and
     reported both exactly and as a power of two — the notes quote
     2^88.4, and that figure is worth being able to check.
     --------------------------------------------------------------- */

  function hiKeySpaces(vigMax) {
    var n = vigMax || 5;

    var fact = BigInt(1);
    for (var i = 2n; i <= 26n; i++) fact *= i;

    /* 26 + 26² + … + 26ⁿ */
    var vig = BigInt(0), p = BigInt(1);
    for (var j = 1; j <= n; j++) { p *= 26n; vig += p; }

    return {
      ok: true,
      caesar: { size: '26', bits: Math.log2(26) },
      subst: { size: fact.toString(), bits: bigLog2(fact) },
      vigenere: { size: vig.toString(), bits: bigLog2(vig), n: n, atLeast: pow26(n) },
      /* The notes' own claim about the substitution key space. */
      substIsFactorial: fact === factorialBig(26)
    };
  }

  function factorialBig(n) {
    var r = BigInt(1);
    for (var i = 2n; i <= BigInt(n); i++) r *= i;
    return r;
  }

  function pow26(n) {
    var r = BigInt(1);
    for (var i = 0; i < n; i++) r *= 26n;
    return r.toString();
  }

  /** log2 of a BigInt, to a couple of decimal places. */
  function bigLog2(v) {
    var s = v.toString();
    /* log2(d × 10^e) = log2(d) + e·log2(10), taking the leading digits. */
    var head = Number(s.slice(0, 15));
    var rest = s.length - Math.min(15, s.length);
    return Math.log2(head) + rest * Math.log2(10);
  }

  /* ---------------------------------------------------------------
     The trace: the gaps between consecutive letters.

     trace(hello) = (23, 7, 0, 3). A Caesar shift moves every letter by
     the same amount, so the gaps are untouched — which means the trace
     is a property the encryption fails to hide, and a ciphertext can
     decrypt to a word exactly when they share a trace.
     --------------------------------------------------------------- */

  function hiTrace(v) {
    var out = [];
    for (var i = 1; i < v.length; i++) out.push((v[i] - v[i - 1] + HI_A) % HI_A);
    return out;
  }

  function hiSameTrace(a, b) {
    var x = hiTrace(a), y = hiTrace(b);
    if (x.length !== y.length) return false;
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }

  /**
   * The claim, settled rather than asserted: for words of a given
   * length, c decrypts to m under some Caesar key exactly when the two
   * share a trace. Checked over every pair of words of that length.
   */
  function hiTraceClaim(len) {
    if (len < 2 || len > 4) return { ok: false, error: 'Two to four letters.' };
    var size = Math.pow(HI_A, len), bad = 0, pairs = 0;

    /* Done per message rather than per pair. For each m, the ciphertexts
       reachable from it are the 26 encryptions of it, and the strings
       sharing its trace are the 26 obtained by choosing a first letter and
       following the gaps. Showing those two sets of 26 are the same set
       settles every pair at once — and in 26^(len+1) steps instead of
       26^(2·len), which at four letters is the difference between a second
       and a fortnight. */
    var m = [], reach = {}, byTrace = {};
    for (var a = 0; a < size; a++) {
      var t = a;
      for (var p = 0; p < len; p++) { m[p] = t % HI_A; t = Math.floor(t / HI_A); }

      reach = {}; byTrace = {};
      var tr = hiTrace(m);

      for (var k = 0; k < HI_A; k++) reach[hiText(hiCaesarEnc(k, m))] = true;

      /* Every string with this trace: pick the first letter, follow the gaps. */
      for (var f = 0; f < HI_A; f++) {
        var w = [f];
        for (var g = 0; g < tr.length; g++) w.push((w[g] + tr[g]) % HI_A);
        byTrace[hiText(w)] = true;
      }

      var rk = Object.keys(reach), bk = Object.keys(byTrace);
      pairs += rk.length;
      if (rk.length !== HI_A || bk.length !== HI_A) { bad++; continue; }
      for (var i = 0; i < rk.length; i++) if (!byTrace[rk[i]]) { bad++; break; }
    }
    return { ok: true, len: len, messages: size, pairs: pairs,
             perMessage: HI_A, mismatch: bad };
  }

  /** Common words whose trace might show up in a ciphertext. */
  var HI_CRIB = ['the', 'and', 'hello', 'yes', 'attack', 'secret', 'message', 'enemy',
                 'that', 'with', 'this', 'crypto'];

  /**
   * Scan a ciphertext for any window whose trace matches a common word.
   * No key is used, and none is needed.
   */
  function hiCribScan(ct) {
    var c = hiNums(ct), hits = [];
    for (var w = 0; w < HI_CRIB.length; w++) {
      var word = hiNums(HI_CRIB[w]);
      if (word.length > c.length) continue;
      for (var s = 0; s + word.length <= c.length; s++) {
        var win = c.slice(s, s + word.length);
        if (hiSameTrace(win, word)) {
          hits.push({ word: HI_CRIB[w], at: s, seen: hiText(win),
                      key: (win[0] - word[0] + HI_A) % HI_A });
        }
      }
    }
    return { ok: true, hits: hits, letters: c.length };
  }

  /* ---------------------------------------------------------------
     Brute force, as the notes write it.

     Note it runs Dec on the ciphertexts rather than Enc on the
     messages. With a deterministic Enc the two are interchangeable,
     but Enc may be randomised — in which case re-encrypting a known
     message need not reproduce the ciphertext at all, and the test
     would reject the right key.
     --------------------------------------------------------------- */

  function hiBruteCaesar(pairs) {
    var survivors = [], tried = 0;
    for (var k = 0; k < HI_A; k++) {
      tried++;
      var ok = true;
      for (var i = 0; i < pairs.length && ok; i++) {
        var got = hiText(hiCaesarDec(k, hiNums(pairs[i].c)));
        if (got !== hiNums(pairs[i].m).map(function (x) {
          return HI_ALPHA.charAt(x); }).join('')) ok = false;
      }
      if (ok) survivors.push(k);
    }
    return { ok: true, tried: tried, survivors: survivors };
  }

  /* ---------------------------------------------------------------
     Frequency analysis, and Vigenère.

     For Vigenère the ciphertext is split into one column per key
     position — each column is a single Caesar shift — and each column
     is attacked on its own.
     --------------------------------------------------------------- */

  var HI_FREQ = [8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153,
                 0.772, 4.025, 2.406, 6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056,
                 2.758, 0.978, 2.360, 0.150, 1.974, 0.074];
  var HI_EXPECT = HI_FREQ.map(function (x) { return x / 100; });

  /** Best shift for one column, by chi-squared against English. */
  function hiBestShift(col) {
    var hist = [], n = col.length;
    for (var i = 0; i < HI_A; i++) hist[i] = 0;
    for (var j = 0; j < n; j++) hist[col[j]]++;
    var best = 0, bestChi = Infinity;
    for (var k = 0; k < HI_A; k++) {
      var x = 0;
      for (var q = 0; q < HI_A; q++) {
        var e = n * HI_EXPECT[q];
        var d = hist[(q + k) % HI_A] - e;
        x += d * d / e;
      }
      if (x < bestChi) { bestChi = x; best = k; }
    }
    return { key: best, chi: bestChi };
  }

  /** Recover a Vigenère key, given its length. */
  function hiBreakVigenere(ct, keyLen) {
    var c = hiNums(ct);
    if (keyLen < 1 || keyLen > 12) return { ok: false, error: 'Key length 1 to 12.' };
    if (c.length < keyLen) return { ok: false, error: 'Ciphertext shorter than the key.' };
    var key = [], cols = [];
    for (var i = 0; i < keyLen; i++) {
      var col = [];
      for (var j = i; j < c.length; j += keyLen) col.push(c[j]);
      var r = hiBestShift(col);
      key.push(r.key);
      cols.push({ i: i, size: col.length, key: r.key, chi: r.chi });
    }
    return { ok: true, key: key, keyText: hiText(key), columns: cols,
             plaintext: hiText(hiVigDec(key, c)) };
  }

  /**
   * How well that works, measured against the amount of ciphertext.
   *
   * The sample is encrypted under a fixed key, truncated to `len`
   * letters, and the attack is run. Deterministic: the same inputs
   * give the same answer every time.
   */
  var HI_SAMPLE = 'the trouble with the historical ciphers is not that they are weak but ' +
    'that nobody ever said what they were supposed to achieve so there was never a moment ' +
    'at which anyone could say that they had failed and that is the whole reason modern ' +
    'cryptography begins by writing the definition down first';

  function hiVigSuccess(keyText, len) {
    var key = hiNums(keyText);
    var full = hiNums(HI_SAMPLE);
    if (len > full.length) return { ok: false, error: 'Longer than the sample.' };
    var m = full.slice(0, len);
    var c = hiVigEnc(key, m);
    var r = hiBreakVigenere(hiText(c), key.length);
    var right = 0;
    for (var i = 0; i < key.length; i++) if (r.key[i] === key[i]) right++;
    return {
      ok: true, len: len, keyLen: key.length,
      found: r.keyText, want: hiText(key),
      correct: r.keyText === hiText(key),
      lettersRight: right,
      perColumn: Math.floor(len / key.length)
    };
  }

  /**
   * And the step before that: finding the key length at all, by trying
   * each and keeping the one whose columns look most like English.
   */
  function hiGuessKeyLength(ct, maxLen) {
    var c = hiNums(ct), out = [];
    var top = Math.min(maxLen || 10, Math.floor(c.length / 2));
    for (var L = 1; L <= top; L++) {
      var total = 0;
      for (var i = 0; i < L; i++) {
        var col = [];
        for (var j = i; j < c.length; j += L) col.push(c[j]);
        total += hiBestShift(col).chi / Math.max(1, col.length);
      }
      out.push({ len: L, score: total / L });
    }
    var best = out[0];
    for (var k = 1; k < out.length; k++) if (out[k].score < best.score) best = out[k];
    return { ok: true, scores: out, best: best.len };
  }

  /* ---------------------------------------------------------------
     Perfect secrecy, and the two ways it is lost.
     --------------------------------------------------------------- */

  /**
   * The notes' example: every message of the right length has exactly
   * one key carrying it to a given ciphertext. Given c and any m, the
   * key is forced and can be written down.
   */
  function hiKeyFor(m, c) {
    var mm = hiNums(m), cc = hiNums(c);
    if (mm.length !== cc.length) return { ok: false, error: 'Lengths differ.' };
    var k = [];
    for (var i = 0; i < mm.length; i++) k.push((cc[i] - mm[i] + HI_A) % HI_A);
    return { ok: true, key: hiText(k),
             checks: hiText(hiVigEnc(k, mm)) === hiText(cc) };
  }

  /** Several candidate messages for one ciphertext, each with its key. */
  function hiCandidates(c, words) {
    var out = [];
    for (var i = 0; i < words.length; i++) {
      var r = hiKeyFor(words[i], c);
      if (r.ok) out.push({ message: words[i], key: r.key, checks: r.checks });
    }
    return out;
  }

  /**
   * Reusing a key leaks the difference of the messages: c₂ − c₁ =
   * m₂ − m₁, with the key cancelling. Nobody needs the key to compute
   * it, which is the whole failure.
   */
  function hiTwoTime(m1, m2, keyText) {
    var a = hiNums(m1), b = hiNums(m2), k = hiNums(keyText);
    if (!a.length || !b.length) return { ok: false, error: 'Give two messages.' };
    var n = Math.min(a.length, b.length);
    if (k.length < n) return { ok: false, error: 'The key must cover both messages: at ' +
      'least ' + n + ' letters.' };
    a = a.slice(0, n); b = b.slice(0, n);
    var c1 = hiVigEnc(k, a), c2 = hiVigEnc(k, b);
    var cdiff = [], mdiff = [];
    for (var i = 0; i < n; i++) {
      cdiff.push((c2[i] - c1[i] + HI_A) % HI_A);
      mdiff.push((b[i] - a[i] + HI_A) % HI_A);
    }
    return {
      ok: true,
      m1: hiText(a), m2: hiText(b), key: hiText(k.slice(0, n)),
      c1: hiText(c1), c2: hiText(c2),
      cdiff: hiText(cdiff), mdiff: hiText(mdiff),
      /* The point: these are the same string, and the key is gone. */
      leaks: hiText(cdiff) === hiText(mdiff),
      /* And if you guess one message, the other falls out. */
      recovered: hiText(a.map(function (x, i) { return (x + cdiff[i]) % HI_A; }))
    };
  }

  /** Does the leak hold for every pair and every key? Exhausted at one letter. */
  function hiTwoTimeAlways(len) {
    if (len > 1) return { ok: false, error: 'One letter exhausts it; the pad acts on each ' +
      'letter separately.' };
    var size = Math.pow(HI_A, len), bad = 0, total = 0;
    for (var a = 0; a < size; a++) {
      for (var b = 0; b < size; b++) {
        for (var k = 0; k < size; k++) {
          var c1 = (a + k) % HI_A, c2 = (b + k) % HI_A;
          total++;
          if ((c2 - c1 + HI_A) % HI_A !== (b - a + HI_A) % HI_A) bad++;
        }
      }
    }
    return { ok: true, total: total, bad: bad };
  }

  /* ---------------------------------------------------------------
     Elementwise arithmetic, for the worked examples in the notes.
     --------------------------------------------------------------- */

  function hiAddMod(aText, bText, sign) {
    var a = hiNums(aText), b = hiNums(bText);
    var n = Math.min(a.length, b.length), out = [];
    for (var i = 0; i < n; i++) {
      out.push(((sign < 0 ? a[i] - b[i] : a[i] + b[i]) % HI_A + HI_A) % HI_A);
    }
    return hiText(out);
  }

  function hiXor(aBits, bBits) {
    var out = '';
    var n = Math.min(aBits.length, bBits.length);
    for (var i = 0; i < n; i++) {
      out += (aBits.charAt(i) === bBits.charAt(i)) ? '0' : '1';
    }
    return out;
  }

  window.HI_ALPHA = HI_ALPHA;
  window.HI_CRIB = HI_CRIB;
  window.HI_SAMPLE = HI_SAMPLE;
  window.hiNums = hiNums;
  window.hiText = hiText;
  window.hiCaesarEnc = hiCaesarEnc;
  window.hiCaesarDec = hiCaesarDec;
  window.hiSubstEnc = hiSubstEnc;
  window.hiSubstDec = hiSubstDec;
  window.hiPerm = hiPerm;
  window.hiVigEnc = hiVigEnc;
  window.hiVigDec = hiVigDec;
  window.hiKeySpaces = hiKeySpaces;
  window.hiTrace = hiTrace;
  window.hiSameTrace = hiSameTrace;
  window.hiTraceClaim = hiTraceClaim;
  window.hiCribScan = hiCribScan;
  window.hiBruteCaesar = hiBruteCaesar;
  window.hiBestShift = hiBestShift;
  window.hiBreakVigenere = hiBreakVigenere;
  window.hiVigSuccess = hiVigSuccess;
  window.hiGuessKeyLength = hiGuessKeyLength;
  window.hiKeyFor = hiKeyFor;
  window.hiCandidates = hiCandidates;
  window.hiTwoTime = hiTwoTime;
  window.hiTwoTimeAlways = hiTwoTimeAlways;
  window.hiAddMod = hiAddMod;
  window.hiXor = hiXor;
