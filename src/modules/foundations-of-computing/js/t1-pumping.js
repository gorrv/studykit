  /* ============================================================
     THE PUMPING LEMMA (Topic 01)

     The statement is a stack of alternating quantifiers, and that is
     the only reason it is hard:

         L regular  =>  ∃p  ∀w∈L, |w|≥p  ∃x,y,z  ∀n≥0
                            w = xyz,  |xy| ≤ p,  |y| > 0,  xyⁿz ∈ L

     Read as a game between you and an opponent who claims L is
     regular, the alternation becomes a turn order:

         they pick p        (you do not get to choose it)
         you pick w         (any word of L that is long enough)
         they pick x, y, z  (any legal split — you must beat them all)
         you pick n         (one exponent that throws xyⁿz out of L)

     Win every time and L is not regular. The step people skip is the
     third: it is not enough to find one split that breaks, you have
     to beat every split they could have chosen. So this plays the
     opponent properly — it searches all legal splits and picks the
     one that is worst for you.

     Nothing here is asserted. Each language is given as a decidable
     predicate, so every claim about whether a pumped word is in the
     language is computed by running that predicate.
     ============================================================ */

  /**
   * Every legal way to cut `w` into xyz under a pumping length `p`:
   * |xy| ≤ p and |y| > 0.
   */
  function pumpSplits(w, p) {
    var out = [];
    var reach = Math.min(p, w.length);
    for (var i = 0; i < reach; i++) {              // |x| = i
      for (var j = i + 1; j <= reach; j++) {       // |xy| = j, so |y| = j - i > 0
        out.push({ x: w.slice(0, i), y: w.slice(i, j), z: w.slice(j) });
      }
    }
    return out;
  }

  /** The word xyⁿz. */
  function pumpWord(split, n) {
    return split.x + repeat(split.y, n) + split.z;
  }

  function repeat(s, n) {
    var out = '';
    for (var i = 0; i < n; i++) out += s;
    return out;
  }

  /**
   * Analyse one choice of w against a language.
   *
   * For each legal split, find the exponents that throw the pumped word
   * out of the language. A split you cannot beat is what loses you the
   * game, so those are reported first.
   *
   * @param {function(string): boolean} inL  membership, decided not asserted
   * @returns {{splits, beaten, survivors, wins}}
   */
  function pumpAnalyse(inL, w, p, maxN) {
    var top = maxN || 4;
    var splits = pumpSplits(w, p);
    var survivors = [], beaten = [];

    for (var i = 0; i < splits.length; i++) {
      var s = splits[i], killers = [];
      for (var n = 0; n <= top; n++) {
        if (n === 1) continue;                     // xy¹z is w itself, which is in L
        if (!inL(pumpWord(s, n))) killers.push(n);
      }
      var rec = { x: s.x, y: s.y, z: s.z, killers: killers };
      if (killers.length) beaten.push(rec); else survivors.push(rec);
    }

    return {
      splits: splits.length,
      beaten: beaten,
      survivors: survivors,
      wins: survivors.length === 0 && splits.length > 0,
    };
  }

  /**
   * Play the opponent's third move: choose the split that is hardest
   * for you. If any split survives every exponent we tried, that is the
   * one they play — it is the one that beats you. Otherwise they play
   * the one with the fewest ways out.
   */
  function pumpAdversary(analysis) {
    if (analysis.survivors.length) return { split: analysis.survivors[0], survives: true };
    var best = analysis.beaten[0];
    for (var i = 1; i < analysis.beaten.length; i++) {
      if (analysis.beaten[i].killers.length < best.killers.length) best = analysis.beaten[i];
    }
    return { split: best, survives: false };
  }

  /**
   * Would this word win against *every* pumping length up to `maxP`?
   *
   * A good choice of w is written in terms of p rather than picked as a
   * fixed string, and this checks that the shape works whatever p turns
   * out to be — which is what a written proof has to argue.
   */
  function pumpRobust(inL, shape, maxP, maxN) {
    var fails = [];
    for (var p = 1; p <= (maxP || 8); p++) {
      var w = shape(p);
      if (!inL(w)) { fails.push({ p: p, w: w, why: 'the word is not in the language' }); continue; }
      if (w.length < p) { fails.push({ p: p, w: w, why: 'the word is shorter than p' }); continue; }
      var a = pumpAnalyse(inL, w, p, maxN);
      if (!a.wins) fails.push({ p: p, w: w, why: 'a split survives: y = ' + (a.survivors[0].y || 'ε') });
    }
    return { wins: fails.length === 0, fails: fails };
  }

  /**
   * The languages the tool offers.
   *
   * Two of these are regular. That is deliberate: the lemma cannot
   * prove a language regular, and the fastest way to learn that is to
   * play the game on one that is and find yourself unable to win.
   */
  var PUMP_LANGS = {
    anbn: {
      label: 'aⁿbⁿ',
      desc: 'equal numbers of a then b',
      alphabet: ['a', 'b'],
      regular: false,
      inL: function (w) { var m = /^(a*)(b*)$/.exec(w); return !!m && m[1].length === m[2].length; },
      hint: function (p) { return repeat('a', p) + repeat('b', p); },
    },
    anbm: {
      label: 'aⁿbᵐ, n < m',
      desc: 'more b than a, all a first',
      alphabet: ['a', 'b'],
      regular: false,
      inL: function (w) { var m = /^(a*)(b*)$/.exec(w); return !!m && m[1].length < m[2].length; },
      hint: function (p) { return repeat('a', p) + repeat('b', p + 1); },
    },
    ww: {
      label: 'ww',
      desc: 'a word followed by an exact copy of itself',
      alphabet: ['a', 'b'],
      regular: false,
      inL: function (w) {
        if (w.length % 2) return false;
        var h = w.length / 2;
        return w.slice(0, h) === w.slice(h);
      },
      hint: function (p) { return repeat('a', p) + 'b' + repeat('a', p) + 'b'; },
    },
    squares: {
      label: 'aⁿ where n is a square',
      desc: 'a run of a whose length is 0, 1, 4, 9, 16, …',
      alphabet: ['a'],
      regular: false,
      inL: function (w) {
        if (!/^a*$/.test(w)) return false;
        var r = Math.round(Math.sqrt(w.length));
        return r * r === w.length;
      },
      hint: function (p) { return repeat('a', p * p); },
    },
    evenLen: {
      label: 'even length',
      desc: 'REGULAR — the game is unwinnable, and that is the lesson',
      alphabet: ['a', 'b'],
      regular: true,
      inL: function (w) { return w.length % 2 === 0; },
      hint: function (p) { return repeat('ab', p); },
    },
    endsAB: {
      label: 'ends in ab',
      desc: 'REGULAR — try to win and see where it goes wrong',
      alphabet: ['a', 'b'],
      regular: true,
      inL: function (w) { return /ab$/.test(w); },
      hint: function (p) { return repeat('a', p) + 'ab'; },
    },
  };

  /* ---------- rendering ---------- */

  var PUMP = { key: 'anbn', p: 4 };

  function pumpPick(key) { PUMP.key = key; runPumping(); }

  function runPumping() {
    var out = document.getElementById('pl-output');
    if (!out) return;

    var sel = document.getElementById('pl-lang');
    var key = (sel && sel.value) || PUMP.key;
    var L = PUMP_LANGS[key] || PUMP_LANGS.anbn;
    PUMP.key = key;

    var p = parseInt((document.getElementById('pl-p') || {}).value, 10);
    if (!isFinite(p) || p < 1) p = 1;
    if (p > 8) p = 8;

    var w = ((document.getElementById('pl-w') || {}).value || '').trim();

    var html = '<div class="pl-lang">Playing against <strong>L = { ' + L.label + ' }</strong> — ' +
      esc(L.desc) + '</div>';

    if (!w) {
      html += '<div class="callout tip"><div class="callout-label">Your move</div>' +
        'They have chosen p = <strong>' + p + '</strong>. Pick a word of L that is at least that long. ' +
        'A word built <em>out of</em> p is what a written proof uses — for this language, ' +
        '<code>' + esc(L.hint(p)) + '</code> works.</div>';
      out.innerHTML = html;
      return;
    }

    if (!L.inL(w)) {
      html += '<div class="tool-error"><code>' + esc(w) + '</code> is not in this language, ' +
        'so it is not a legal move. You have to pick a word L actually contains.</div>';
      out.innerHTML = html;
      return;
    }
    if (w.length < p) {
      html += '<div class="tool-error"><code>' + esc(w) + '</code> has length ' + w.length +
        ', which is less than p = ' + p + '. The lemma says nothing about words shorter than p, ' +
        'so this choice proves nothing.</div>';
      out.innerHTML = html;
      return;
    }

    var a = pumpAnalyse(L.inL, w, p, 4);
    var adv = pumpAdversary(a);

    html += '<div class="pl-split-head">They split <code>' + esc(w) + '</code> into the worst case for you:</div>';
    html += '<div class="pl-split"><span class="pl-x">' + esc(adv.split.x || 'ε') + '</span>' +
      '<span class="pl-y">' + esc(adv.split.y) + '</span>' +
      '<span class="pl-z">' + esc(adv.split.z || 'ε') + '</span></div>' +
      '<div class="pl-legend"><span class="pl-x">x</span><span class="pl-y">y — this is what gets pumped</span><span class="pl-z">z</span></div>';

    html += '<table class="results-table"><tr><th>n</th><th>xyⁿz</th><th>in L?</th></tr>';
    for (var n = 0; n <= 3; n++) {
      var pw = pumpWord(adv.split, n);
      var inside = L.inL(pw);
      html += '<tr' + (!inside ? ' class="awt-row"' : '') + '><td>' + n + '</td><td><code>' +
        esc(pw || 'ε') + '</code></td><td>' + (inside ? 'yes' : '<strong>no</strong>') + '</td></tr>';
    }
    html += '</table>';

    if (a.wins) {
      html += '<p class="xl-result">You win. Every one of the ' + a.splits +
        ' legal splits can be broken — this one by n = ' + adv.split.killers.join(' or ') +
        '. Since the opponent had no safe move, L is <strong>not regular</strong>.</p>';
    } else {
      html += '<p class="xl-result miss">You lose with this word. ' + a.survivors.length +
        ' of the ' + a.splits + ' splits survive every exponent, and they only need one. ' +
        (L.regular
          ? 'That is not your fault — this language <strong>is</strong> regular, so no word can ever win. ' +
            'The pumping lemma can only ever show a language is <em>not</em> regular; failing to win proves nothing either way.'
          : 'Try a word whose shape forces y to sit entirely inside one block.') + '</p>';
    }

    // A written proof has to work for every p, not just this one.
    var robust = pumpRobust(L.inL, L.hint, 6, 4);
    html += '<div class="callout ' + (robust.wins ? 'tip' : 'warn') + '"><div class="callout-label">And for every other p?</div>' +
      'A proof cannot pick p — it has to work whatever p turns out to be. The suggested shape <code>' +
      esc(L.hint(4)).replace(/4/g, 'p') + '</code> was tried against p = 1…6: ' +
      (robust.wins ? 'it wins every time.' : 'it fails at p = ' + robust.fails[0].p + ', because ' + robust.fails[0].why + '.') +
      '</div>';

    out.innerHTML = html;
  }

  window.PUMP = PUMP;
  window.PUMP_LANGS = PUMP_LANGS;
  window.pumpPick = pumpPick;
  window.pumpSplits = pumpSplits;
  window.pumpWord = pumpWord;
  window.pumpAnalyse = pumpAnalyse;
  window.pumpAdversary = pumpAdversary;
  window.pumpRobust = pumpRobust;
