  /* ============================================================
     TOPIC 10 · enumerating words, encoding machines, and running
                a universal machine
     ------------------------------------------------------------
     The undecidability proofs all rest on two mundane facts:
     you can list every word, and you can write a machine down as
     a word. Neither is deep, and both have to be exactly right,
     because the diagonal argument indexes machines by the same
     numbers it indexes words by.

     One thing the slides gloss. The tuple encoding

         <w0, w1, ..., wn>  :=  # w0 # w1 # ... # wn #

     is described as taking strings over the EXPANDED alphabet
     Sigma union {#}, which means a component may itself contain a
     #. It is then ambiguous: #a#b# is both the pair (a, b) and
     the single string "a#b".

     The slide offers a binary code as the alternative -- 0 -> 00,
     1 -> 01, # -> 11 -- and it does NOT fix this, because it gives
     the data character # and the separator the same pattern, so
     the two encodings stay identical bit for bit. What fixes it is
     reserving a pattern the data can never produce: # -> 10, with
     11 kept for the separator alone. enAmbiguity() shows all three
     side by side and enCodeIsInjective checks the repair by
     exhaustion.
     ============================================================ */

  /**
     Every word over the alphabet, shortest first and
     alphabetically within a length.

     This is a bijection between the natural numbers and Sigma*,
     which is what lets the diagonal argument say "the i-th word"
     at all. The slide prints it as

         eps, 1, 0, 00, 01, 10, 11, 000, ...

     listing 1 before 0 and then every later block in the other
     order. Either convention is a fine enumeration; mixing them
     is not, because then there is no rule that says which word
     w_i is.
  */
  function enWords(n, alphabet) {
    var alpha = (alphabet && alphabet.length ? alphabet : ['0', '1']).slice();
    var out = [''], i = 0;
    while (out.length < n) {
      var w = out[i++];
      for (var a = 0; a < alpha.length; a++) out.push(w + alpha[a]);
      if (i > n + 8) break;
    }
    return out.slice(0, n);
  }

  /**
     The index of a word in that enumeration.

     Two parts: how many words are shorter than this one (a
     geometric sum), plus where it sits among the words of its own
     length (its digits read in base k).
  */
  function enIndexOf(word, alphabet) {
    var alpha = (alphabet && alphabet.length ? alphabet : ['0', '1']).slice();
    var k = alpha.length, s = String(word);

    var before = 0;
    for (var L = 0; L < s.length; L++) before += Math.pow(k, L);

    var within = 0;
    for (var j = 0; j < s.length; j++) {
      var d = alpha.indexOf(s.charAt(j));
      if (d < 0) return { ok: false, error: 'The symbol <code>' + esc(s.charAt(j)) +
        '</code> is not in the alphabet.' };
      within = within * k + d;
    }
    return { ok: true, index: before + within, before: before, within: within };
  }

  function enWordAt(index, alphabet) {
    var alpha = (alphabet && alphabet.length ? alphabet : ['0', '1']).slice();
    var k = alpha.length, n = Math.floor(index);
    if (!(n >= 0)) return { ok: false, error: 'The index must be a non-negative whole number.' };
    var len = 0;
    while (n >= Math.pow(k, len)) { n -= Math.pow(k, len); len++; }
    var out = '';
    for (var i = len - 1; i >= 0; i--) {
      var p = Math.pow(k, i);
      var d = Math.floor(n / p);
      out += alpha[d];
      n -= d * p;
    }
    return { ok: true, word: out };
  }

  /* ---------- the tuple encoding, and why it needs the binary code ---------- */

  /** The slide's encoding: #w0#w1#...#wn#. */
  function enTuple(parts) {
    return '#' + parts.join('#') + '#';
  }

  /** Splitting it back up, which only works if no part contains a #. */
  function enUntuple(s) {
    var t = String(s);
    if (t.charAt(0) !== '#' || t.charAt(t.length - 1) !== '#') {
      return { ok: false, error: 'A tuple has to start and end with <code>#</code>.' };
    }
    return { ok: true, parts: t.slice(1, -1).split('#') };
  }

  /* The slide's own code table, kept so the collision can be shown. */
  var EN_SLIDE_BITS = { '0': '00', '1': '01', '#': '11' };
  /* A table that works: the separator gets a pattern no data symbol has. */
  var EN_BITS = { '0': '00', '1': '01', '#': '10' };
  var EN_SEP = '11';

  function enCode(s, table) {
    var out = '', t = String(s);
    for (var i = 0; i < t.length; i++) {
      var b = table[t.charAt(i)];
      if (!b) return { ok: false, error: 'No binary code for <code>' + esc(t.charAt(i)) + '</code>. ' +
        'The code covers 0, 1 and # only.' };
      out += b;
    }
    return { ok: true, bits: out };
  }

  function enBin(s) { return enCode(s, EN_BITS); }

  function enBinDecode(bits) {
    var t = String(bits);
    if (t.length % 2) return { ok: false, error: 'A coded string has even length — two bits per symbol.' };
    var inv = { '00': '0', '01': '1', '10': '#' }, out = '';
    for (var i = 0; i < t.length; i += 2) {
      var c = inv[t.substr(i, 2)];
      if (c === undefined) return { ok: false, error: 'The pair <code>' + esc(t.substr(i, 2)) +
        '</code> is not a code for any symbol.' };
      out += c;
    }
    return { ok: true, text: out };
  }

  /** A tuple in the working code: components in 2-bit symbols, 11 between them. */
  function enTupleBin(parts, table) {
    var tab = table || EN_BITS;
    var coded = parts.map(function (p) { return enCode(p, tab); });
    var bad = coded.filter(function (c) { return !c.ok; })[0];
    if (bad) return bad;
    return { ok: true, bits: EN_SEP + coded.map(function (c) { return c.bits; }).join(EN_SEP) + EN_SEP };
  }

  function enUntupleBin(bits) {
    var t = String(bits);
    if (t.slice(0, 2) !== EN_SEP || t.slice(-2) !== EN_SEP) {
      return { ok: false, error: 'A coded tuple begins and ends with the separator ' + EN_SEP + '.' };
    }
    var body = t.slice(2, -2), parts = [], cur = '';
    for (var i = 0; i < body.length; i += 2) {
      var pair = body.substr(i, 2);
      if (pair === EN_SEP) { parts.push(cur); cur = ''; continue; }
      var c = { '00': '0', '01': '1', '10': '#' }[pair];
      if (c === undefined) return { ok: false, error: 'Bad symbol code <code>' + esc(pair) + '</code>.' };
      cur += c;
    }
    parts.push(cur);
    return { ok: true, parts: parts };
  }

  /**
     Two separate ambiguities, both demonstrated rather than
     asserted.

     First, the plain #-delimited tuple: with components drawn from
     Sigma union {#}, as the slide says, #a#b# is both the pair
     (a, b) and the one-element tuple containing "a#b".

     Second -- and this is the part worth knowing -- the slide's
     suggested repair does not repair it. Coding 0 -> 00, 1 -> 01,
     # -> 11 gives the separator and the data character # the SAME
     pattern, so the collision survives the translation intact.
     What fixes it is reserving a pattern for the separator that no
     data symbol uses: 0 -> 00, 1 -> 01, # -> 10, separator -> 11.
     Checked exhaustively over every tuple of up to three
     components of length up to two: no collisions.
  */
  function enAmbiguity() {
    var flatPair = enTuple(['0', '1']);
    var flatSingle = enTuple(['0#1']);
    var slidePair = enTupleBin(['0', '1'], EN_SLIDE_BITS);
    var slideSingle = enTupleBin(['0#1'], EN_SLIDE_BITS);
    var fixedPair = enTupleBin(['0', '1']);
    var fixedSingle = enTupleBin(['0#1']);
    return {
      ok: true,
      flat: { pair: flatPair, single: flatSingle, collide: flatPair === flatSingle },
      slide: { pair: slidePair.bits, single: slideSingle.bits, collide: slidePair.bits === slideSingle.bits },
      fixed: { pair: fixedPair.bits, single: fixedSingle.bits, collide: fixedPair.bits === fixedSingle.bits },
      note: 'The pair (0, 1) and the single string "0#1" have the same plain encoding, and the same ' +
        'encoding again under the slide’s code table, because # and the separator are both 11. ' +
        'Reserving 11 for the separator alone — and giving the data character # its own 10 — ' +
        'separates them.'
    };
  }

  /** Exhaustive injectivity check on the fixed code. */
  function enCodeIsInjective(maxParts, maxLen) {
    var alpha = ['0', '1', '#'];
    var comps = [''];
    (function build(prefix, depth) {
      if (depth === 0) return;
      alpha.forEach(function (a) { comps.push(prefix + a); build(prefix + a, depth - 1); });
    })('', maxLen || 2);

    var seen = {}, clashes = 0, n = 0, witness = null;
    function walk(parts, k) {
      if (parts.length === k) {
        var e = enTupleBin(parts);
        if (!e.ok) return;
        n++;
        var key = e.bits;
        if (seen[key] !== undefined && seen[key] !== parts.join(' ')) {
          clashes++;
          if (!witness) witness = { a: seen[key].split(' '), b: parts.slice(), bits: key };
        }
        seen[key] = parts.join(' ');
        return;
      }
      for (var i = 0; i < comps.length; i++) walk(parts.concat([comps[i]]), k);
    }
    for (var k = 1; k <= (maxParts || 3); k++) walk([], k);
    return { ok: true, tested: n, clashes: clashes, witness: witness, injective: clashes === 0 };
  }

  /* ---------- encoding a Turing machine ---------- */

  /**
     code(M) := <q_init, q_accept, q_reject, <delta>>, with delta
     encoded as a tuple of pairs, exactly as the slide describes
     a finite function.

     Encoded and decoded with the binary form, because the naive
     one cannot survive the nesting.
  */
  function enCodeMachine(m) {
    /* FLAT, not nested. The slide encodes delta as a tuple of pairs,
       nesting tuples inside tuples -- and enAmbiguity() above shows
       that the flat #-delimited format cannot be read back once a
       component contains a #, which a nested tuple always does. So
       the five fields of each rule are laid out end to end and the
       rule count is carried explicitly. Nothing is lost: the shape
       is recoverable from the count, and the result really does
       decode, which the nested version does not.

       This is the same information the slide's binary code supplies
       by making 11 a separator that cannot occur inside a symbol. */
    var fields = [];
    var rules = 0;
    Object.keys(m.delta).forEach(function (from) {
      Object.keys(m.delta[from]).forEach(function (read) {
        var r = m.delta[from][read];
        fields.push(from, read === TM_BLANK ? '_' : read,
                    r.to, r.write === TM_BLANK ? '_' : r.write,
                    r.move > 0 ? '>' : '<');
        rules++;
      });
    });
    var plain = enTuple([m.start, m.accept, m.reject || '-', String(rules)].concat(fields));
    return { ok: true, plain: plain, rules: rules };
  }

  /**
     Decode back to the source text Topic 1's parser reads.

     Round-tripping through the machine's own text is the honest
     check: if code(M) has lost anything, the decoded machine will
     behave differently, and enRoundTrip runs both on real inputs
     to find out.
  */
  function enDecodeMachine(plain) {
    var top = enUntuple(plain);
    if (!top.ok) return top;
    if (top.parts.length < 4) {
      return { ok: false, error: 'code(M) needs at least the three states and a rule count.' };
    }
    var start = top.parts[0], accept = top.parts[1], reject = top.parts[2];
    var rules = parseInt(top.parts[3], 10);
    if (!(rules >= 0)) return { ok: false, error: 'The rule count is not a number.' };

    var fields = top.parts.slice(4);
    if (fields.length !== rules * 5) {
      return { ok: false, error: 'code(M) claims ' + rules + ' rules, which needs ' + (rules * 5) +
        ' fields, but ' + fields.length + ' are present.' };
    }

    var lines = ['start: ' + start, 'accept: ' + accept];
    if (reject && reject !== '-') lines.push('reject: ' + reject);
    for (var i = 0; i < rules; i++) {
      lines.push(fields.slice(i * 5, i * 5 + 5).join(' '));
    }
    return { ok: true, text: lines.join('\n'), rules: rules };
  }

  /**
     The universal machine, and its correctness check.

     Mu(<code(M), w>) = M(w) is the specification. It is checked by
     decoding code(M) back into a machine and running BOTH on the
     same words: if the encoding lost anything, the verdicts part
     company.
  */
  function enRoundTrip(text, words, cap) {
    var p = tmParse(text);
    if (!p.ok) return p;
    var coded = enCodeMachine(p.m);
    var back = enDecodeMachine(coded.plain);
    if (!back.ok) return { ok: false, error: 'Could not decode: ' + back.error, code: coded.plain };
    var q = tmParse(back.text);
    if (!q.ok) return { ok: false, error: 'The decoded text does not parse: ' + q.error,
                        code: coded.plain, decoded: back.text };

    var rows = [], same = true;
    (words || []).forEach(function (w) {
      var a = tmRun(p.m, w, cap || 300);
      var b = tmRun(q.m, w, cap || 300);
      var agree = a.verdict === b.verdict;
      if (!agree) same = false;
      rows.push({ w: w, original: a.verdict, simulated: b.verdict, agree: agree, steps: a.configs.length - 1 });
    });

    /* The binary code only covers 0, 1 and #, so a machine whose state
       names use other letters has no bit string here. Reported as
       absent rather than as undefined. */
    var bits = enBin(coded.plain);

    return {
      ok: true, code: coded.plain,
      bits: bits.ok ? bits.bits : null,
      bitsWhy: bits.ok ? null : bits.error,
      decoded: back.text, rules: coded.rules,
      rows: rows, same: same,
      note: same
        ? 'The decoded machine gives the same verdict on every word tried, which is what ' +
          'M<sub>u</sub>(⟨code(M), w⟩) = M(w) asks for.'
        : 'The decoded machine DISAGREES with the original, so the encoding has lost something.'
    };
  }

  var EN_PRESETS = {
    parity:
      '; accepts binary strings with an even number of 1s\n' +
      'start: even\naccept: acc\nreject: rej\n' +
      'even 0 even 0 >\neven 1 odd 1 >\neven _ acc _ >\n' +
      'odd 0 odd 0 >\nodd 1 even 1 >\nodd _ rej _ >\n',
    ones:
      '; accepts any string of 1s, rejects anything else\n' +
      'start: q0\naccept: acc\nreject: rej\n' +
      'q0 1 q0 1 >\nq0 0 rej 0 >\nq0 _ acc _ >\n'
  };
