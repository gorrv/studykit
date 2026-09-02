  /* ============================================================
     REGULAR EXPRESSIONS (Topic 01)

     Three operations build every regular expression:

         concatenation   wv          one after the other
         alternation     (w ∪ v)     either one
         Kleene star     w*          zero or more copies

     and the theorem that matters is that this is exactly as
     expressive as a finite automaton — anything you can write with
     these three, some machine recognises, and vice versa.

     Rather than write a matcher and take that theorem on trust, this
     builds the machine. Thompson's construction turns an expression
     into an NFA with epsilon moves, one small gadget per operator,
     and membership is then just running that NFA. So the tool *is*
     the proof of one direction, and every regular expression in the
     notes can be handed to the subset construction and come out as a
     DFA you can step through.
     ============================================================ */

  /**
   * Parse an expression into a tree.
   *
   *   expr   -> term ('∪' term)*
   *   term   -> factor+
   *   factor -> atom '*'*
   *   atom   -> symbol | '(' expr ')' | 'ε' | '∅'
   *
   * Union is written ∪, but `|` and `+` are accepted too, since those
   * are what a keyboard offers.
   *
   * @returns {{ok: true, ast} | {ok: false, error: string}}
   */
  function reParse(src) {
    var s = String(src).replace(/\s+/g, '');
    if (!s) return { ok: false, error: 'Nothing to parse yet.' };

    var at = 0;
    var fail = null;

    function peek() { return s.charAt(at); }
    function isUnion(c) { return c === '∪' || c === '|' || c === '+'; }

    function expr() {
      var left = term();
      if (fail) return null;
      while (isUnion(peek())) {
        at++;
        var right = term();
        if (fail) return null;
        left = { op: 'union', a: left, b: right };
      }
      return left;
    }

    function term() {
      var parts = [];
      while (at < s.length && !isUnion(peek()) && peek() !== ')') {
        var f = factor();
        if (fail) return null;
        parts.push(f);
      }
      if (!parts.length) return { op: 'empty' };            // the empty string
      return parts.reduce(function (a, b) { return { op: 'cat', a: a, b: b }; });
    }

    function factor() {
      var a = atom();
      if (fail) return null;
      while (peek() === '*') { at++; a = { op: 'star', a: a }; }
      return a;
    }

    function atom() {
      var c = peek();
      if (c === '(') {
        at++;
        var inner = expr();
        if (fail) return null;
        if (peek() !== ')') { fail = 'Missing a closing bracket.'; return null; }
        at++;
        return inner;
      }
      if (c === ')') { fail = 'A closing bracket with nothing to close.'; return null; }
      if (c === '*') { fail = 'A star needs something in front of it.'; return null; }
      if (c === '') { fail = 'The expression stops in the middle.'; return null; }
      at++;
      if (c === 'ε' || c === 'e') return { op: 'empty' };
      if (c === '∅') return { op: 'none' };
      return { op: 'sym', sym: c };
    }

    var ast = expr();
    if (fail) return { ok: false, error: fail };
    if (at < s.length) return { ok: false, error: 'Unexpected <code>' + esc(s.charAt(at)) + '</code>.' };
    return { ok: true, ast: ast };
  }

  /** Write a tree back out, bracketed just enough to read unambiguously. */
  function reShow(ast) {
    switch (ast.op) {
      case 'sym': return ast.sym;
      case 'empty': return 'ε';
      case 'none': return '∅';
      case 'star': return (ast.a.op === 'sym' || ast.a.op === 'empty')
        ? reShow(ast.a) + '*' : '(' + reShow(ast.a) + ')*';
      case 'cat': return reShow(ast.a) + reShow(ast.b);
      case 'union': return '(' + reShow(ast.a) + ' ∪ ' + reShow(ast.b) + ')';
    }
    return '';
  }

  /**
   * Thompson's construction: an expression becomes an NFA with exactly
   * one start state and one accepting state, built by gluing together
   * one small gadget per operator.
   *
   * The result is in the same shape the automata tools use, so it can
   * be run, drawn, or fed straight to the subset construction.
   *
   * @returns {{m: object, gadgets: Array}}  the machine, and the pieces
   *          it was assembled from, in the order they were built
   */
  function reToNfa(ast) {
    var n = 0, edges = [], gadgets = [];
    function fresh() { return 'n' + (n++); }

    function build(node) {
      var s, f, a, b;
      switch (node.op) {

        case 'sym':                                   // s --a--> f
          s = fresh(); f = fresh();
          edges.push({ from: s, sym: node.sym, to: [f] });
          break;

        case 'empty':                                 // s --ε--> f
          s = fresh(); f = fresh();
          edges.push({ from: s, sym: FA_EPS, to: [f] });
          break;

        case 'none':                                  // no way across at all
          s = fresh(); f = fresh();
          break;

        case 'cat':                                   // run a, then b
          a = build(node.a); b = build(node.b);
          edges.push({ from: a.f, sym: FA_EPS, to: [b.s] });
          s = a.s; f = b.f;
          break;

        case 'union':                                 // branch into a or b, rejoin
          a = build(node.a); b = build(node.b);
          s = fresh(); f = fresh();
          edges.push({ from: s, sym: FA_EPS, to: [a.s, b.s] });
          edges.push({ from: a.f, sym: FA_EPS, to: [f] });
          edges.push({ from: b.f, sym: FA_EPS, to: [f] });
          break;

        case 'star':                                  // skip it, or go round again
          a = build(node.a);
          s = fresh(); f = fresh();
          edges.push({ from: s, sym: FA_EPS, to: [a.s, f] });
          edges.push({ from: a.f, sym: FA_EPS, to: [a.s, f] });
          break;
      }
      var g = { op: node.op, s: s, f: f, show: reShow(node) };
      gadgets.push(g);
      return g;
    }

    var top = build(ast);

    // Reindex into the machine shape the rest of the module expects.
    var delta = {}, states = {}, alphabet = {};
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      states[e.from] = true;
      var row = delta[e.from] || (delta[e.from] = {});
      var bucket = row[e.sym] || (row[e.sym] = []);
      for (var k = 0; k < e.to.length; k++) {
        states[e.to[k]] = true;
        if (bucket.indexOf(e.to[k]) < 0) bucket.push(e.to[k]);
      }
      if (e.sym !== FA_EPS) alphabet[e.sym] = true;
    }
    states[top.s] = true; states[top.f] = true;

    return {
      m: {
        start: top.s,
        accept: [top.f],
        states: Object.keys(states),
        alphabet: Object.keys(alphabet).sort(),
        delta: delta,
        edges: edges,
        deterministic: false,
      },
      gadgets: gadgets,
    };
  }

  /**
   * Does this expression match this word?
   *
   * Compiled and cached, because the enumeration below asks the same
   * expression about thousands of words in a row.
   */
  var RE_CACHE = {};
  function reMatch(src, word) {
    var key = String(src);
    var m = RE_CACHE[key];
    if (!m) {
      var p = reParse(key);
      if (!p.ok) return { ok: false, error: p.error };
      m = RE_CACHE[key] = reToNfa(p.ast).m;
    }
    return { ok: true, match: nfaRun(m, word, 5000).verdict === 'accept' };
  }

  /**
   * The first `want` words the expression matches, shortest first.
   *
   * Seeing the language listed out is what makes an expression click —
   * and it catches the classic misreading of `(ab)*` as `ab*` straight
   * away, because the lists differ at the second word.
   */
  function reEnumerate(src, want, maxLen) {
    var p = reParse(src);
    if (!p.ok) return { ok: false, error: p.error };
    var m = reToNfa(p.ast).m;
    var alphabet = m.alphabet.slice();
    if (!alphabet.length) alphabet = ['0', '1'];

    var found = [], len = 0, cap = maxLen || 12;
    var frontier = [''];
    while (len <= cap && found.length < want) {
      for (var i = 0; i < frontier.length && found.length < want; i++) {
        if (nfaRun(m, frontier[i], 5000).verdict === 'accept') found.push(frontier[i]);
      }
      var next = [];
      for (var f = 0; f < frontier.length; f++) {
        for (var a = 0; a < alphabet.length; a++) next.push(frontier[f] + alphabet[a]);
      }
      frontier = next;
      len++;
      if (frontier.length > 40000) break;
    }
    return { ok: true, words: found, upTo: len - 1, complete: found.length < want };
  }

  /* ---------- rendering ---------- */

  function runRegex() {
    var out = document.getElementById('re-output');
    if (!out) return;

    var src = (document.getElementById('re-expr') || {}).value || '';
    var word = ((document.getElementById('re-word') || {}).value || '').trim();

    var p = reParse(src);
    if (!p.ok) { out.innerHTML = '<div class="tool-error">' + p.error + '</div>'; return; }

    var built = reToNfa(p.ast);
    var m = built.m;
    var html = '';

    html += '<div class="re-read">Read as: <strong>' + esc(reShow(p.ast)) + '</strong></div>';

    // Does it match the word in the box?
    var hit = nfaRun(m, word, 5000).verdict === 'accept';
    html += '<p class="xl-result' + (hit ? '' : ' miss') + '"><code>' + esc(word || 'ε') + '</code> ' +
      (hit ? 'matches' : 'does not match') + '.</p>';

    // The first words of the language, which is what makes an
    // expression click — and catches (ab)* read as ab* immediately.
    var e = reEnumerate(src, 14, 12);
    if (e.ok) {
      html += '<div class="re-words"><div class="re-words-label">The first words it matches, shortest first</div>';
      for (var i = 0; i < e.words.length; i++) {
        html += '<span class="re-word' + (e.words[i] === word ? ' on' : '') + '">' +
          esc(e.words[i] || 'ε') + '</span>';
      }
      if (!e.words.length) html += '<span class="fa-none">none at all — this expression matches nothing</span>';
      html += '</div>';
    }

    // Thompson's construction, gadget by gadget.
    html += '<div class="re-build"><div class="re-words-label">Built from ' + built.gadgets.length +
      ' pieces, innermost first</div><ol class="re-gadgets">';
    for (var g = 0; g < built.gadgets.length; g++) {
      var gg = built.gadgets[g];
      html += '<li><code>' + esc(gg.show) + '</code> <span class="fa-none">' +
        esc(gg.s) + ' → ' + esc(gg.f) + '</span></li>';
    }
    html += '</ol></div>';

    var sc = subsetConstruct(m);
    html += '<p class="xl-result">As a machine: <strong>' + m.states.length + '</strong> states with ε-moves, ' +
      'which the subset construction turns into a DFA of <strong>' + sc.blowup.to + '</strong> states.</p>';

    out.innerHTML = html;
  }

  window.reParse = reParse;
  window.reShow = reShow;
  window.reToNfa = reToNfa;
  window.reMatch = reMatch;
  window.reEnumerate = reEnumerate;
