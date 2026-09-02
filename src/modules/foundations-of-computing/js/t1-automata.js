  /* ============================================================
     FINITE AUTOMATA (Topic 01)

     A DFA and an NFA differ in exactly one place — what the
     transition function returns. Everything else, including the
     notion of a configuration and the way a computation is written
     down, is shared. So one parser and one stepper serve both, and
     the difference shows up only in how many successors a
     configuration has.

     A configuration is (current state, the input still to the right
     of the head). A computation is the sequence of configurations
     you get by running the machine. For a DFA that sequence is
     unique; for an NFA it branches into a tree.
     ============================================================ */

  /** The symbol standing for an epsilon move — one that reads nothing. */
  var FA_EPS = 'ε';

  /**
   * Parse a machine from the plain-text format the tools use:
   *
   *   start: q0
   *   accept: q0 q3
   *   q0 0 q0
   *   q0 1 q1 q2        (several targets — this makes it an NFA)
   *   q1 eps q2         (an epsilon move — also an NFA)
   *
   * Blank lines and anything after a # are ignored. States and symbols
   * are whatever you type; they need not be single characters, though
   * symbols that appear in an input word are easier to read if they are.
   *
   * @returns {{ok: true, m: object} | {ok: false, error: string}}
   */
  function faParse(text) {
    var lines = String(text).split(/\n/);
    var start = null, accept = [], edges = [], alphabet = {}, states = {};

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/#.*$/, '').trim();
      if (!line) continue;

      var head = line.match(/^(start|accept)\s*:\s*(.*)$/i);
      if (head) {
        var names = head[2].trim().split(/[\s,]+/).filter(Boolean);
        if (head[1].toLowerCase() === 'start') {
          if (names.length !== 1) {
            return { ok: false, error: 'Line ' + (i + 1) + ': there must be exactly one start state.' };
          }
          start = names[0];
          states[start] = true;
        } else {
          for (var a = 0; a < names.length; a++) { accept.push(names[a]); states[names[a]] = true; }
        }
        continue;
      }

      var parts = line.split(/[\s,]+/).filter(Boolean);
      if (parts.length < 3) {
        return { ok: false, error: 'Line ' + (i + 1) + ': expected a state, a symbol, then one or more targets.' };
      }

      var from = parts[0], sym = parts[1], targets = parts.slice(2);
      if (sym === 'eps' || sym === FA_EPS || sym === '_') sym = FA_EPS;
      else alphabet[sym] = true;

      states[from] = true;
      for (var t = 0; t < targets.length; t++) states[targets[t]] = true;
      edges.push({ from: from, sym: sym, to: targets });
    }

    if (!start) return { ok: false, error: 'No start state. Add a line like <code>start: q0</code>.' };
    if (!edges.length) return { ok: false, error: 'No transitions. Add a line like <code>q0 0 q1</code>.' };

    // Index the transitions as delta[state][symbol] -> [targets], and
    // notice on the way whether anything makes this machine
    // non-deterministic: a choice of targets, or an epsilon move.
    var delta = {}, nondet = false;
    for (var e = 0; e < edges.length; e++) {
      var row = delta[edges[e].from] || (delta[edges[e].from] = {});
      var bucket = row[edges[e].sym] || (row[edges[e].sym] = []);
      for (var k = 0; k < edges[e].to.length; k++) {
        if (bucket.indexOf(edges[e].to[k]) < 0) bucket.push(edges[e].to[k]);
      }
      if (bucket.length > 1 || edges[e].sym === FA_EPS) nondet = true;
    }

    var stateList = Object.keys(states);
    var symList = Object.keys(alphabet).sort();

    var missing = accept.filter(function (q) { return stateList.indexOf(q) < 0; });
    if (missing.length) {
      return { ok: false, error: 'Accepting state' + (missing.length > 1 ? 's' : '') +
        ' never mentioned anywhere else: ' + missing.join(', ') + '.' };
    }

    return { ok: true, m: {
      start: start,
      accept: accept,
      states: stateList,
      alphabet: symList,
      delta: delta,
      edges: edges,
      deterministic: !nondet,
    } };
  }

  /** Every state reachable from `q` on `sym`; empty when the machine is stuck. */
  function faStep(m, q, sym) {
    var row = m.delta[q];
    return (row && row[sym]) || [];
  }

  /**
   * The epsilon closure of a set of states: everything reachable
   * without consuming input, including the states you started from.
   */
  function faClosure(m, set) {
    var out = set.slice(), queue = set.slice();
    while (queue.length) {
      var q = queue.shift();
      var next = faStep(m, q, FA_EPS);
      for (var i = 0; i < next.length; i++) {
        if (out.indexOf(next[i]) < 0) { out.push(next[i]); queue.push(next[i]); }
      }
    }
    return out.sort();
  }

  /**
   * Split a word into symbols of this machine's alphabet.
   *
   * Single-character symbols are the normal case and split the way you
   * would expect. Longer names are matched greedily, so a machine over
   * {a, ab} reads "ab" as one symbol rather than two.
   */
  function faSplit(m, word) {
    var w = String(word).trim();
    if (!w) return { ok: true, syms: [] };

    var byLength = m.alphabet.slice().sort(function (a, b) { return b.length - a.length; });
    var syms = [], at = 0;
    outer: while (at < w.length) {
      for (var i = 0; i < byLength.length; i++) {
        if (w.substr(at, byLength[i].length) === byLength[i]) {
          syms.push(byLength[i]);
          at += byLength[i].length;
          continue outer;
        }
      }
      return { ok: false, error: 'The machine has no transitions on <code>' + esc(w[at]) +
        '</code>. Its alphabet is {' + m.alphabet.join(', ') + '}.' };
    }
    return { ok: true, syms: syms };
  }

  /**
   * Run a deterministic machine and return the whole computation.
   *
   * A DFA with no transition for the symbol under the head is *stuck*,
   * which rejects — but is worth distinguishing from an honest
   * rejection, because a half-filled transition table is the commonest
   * reason a machine "doesn't work".
   *
   * @returns {{verdict: 'accept'|'reject'|'stuck'|'error', configs: Array}}
   */
  function dfaRun(m, word) {
    var split = faSplit(m, word);
    if (!split.ok) return { verdict: 'error', error: split.error, configs: [] };

    var syms = split.syms, q = m.start;
    var configs = [{ state: q, read: null, rest: syms.slice() }];

    for (var i = 0; i < syms.length; i++) {
      var next = faStep(m, q, syms[i]);
      if (!next.length) {
        return { verdict: 'stuck', configs: configs, at: q, stuckOn: syms[i], read: i };
      }
      q = next[0];
      configs.push({ state: q, read: syms[i], rest: syms.slice(i + 1) });
    }

    return {
      verdict: m.accept.indexOf(q) >= 0 ? 'accept' : 'reject',
      configs: configs,
      at: q,
    };
  }

  /**
   * Run a non-deterministic machine, building the computation tree.
   *
   * The accept criterion is that *some* branch ends in an accepting
   * state having consumed the whole word. That is the part people get
   * wrong, so every branch is marked with how it ended: accepted, out
   * of transitions, or finished somewhere non-final.
   *
   * Epsilon moves could loop forever without consuming anything, so a
   * branch never revisits a configuration it has already been in.
   *
   * @returns {{verdict, root, nodes, accepting}}
   */
  function nfaRun(m, word, cap) {
    var split = faSplit(m, word);
    if (!split.ok) return { verdict: 'error', error: split.error, nodes: [] };

    var syms = split.syms;
    var limit = cap || 400;
    var nodes = [], accepting = [], truncated = false;

    function node(state, at, seen, depth) {
      if (nodes.length >= limit) { truncated = true; return null; }
      var n = {
        id: nodes.length,
        state: state,
        at: at,                            // how many symbols are consumed
        rest: syms.slice(at),
        depth: depth,
        children: [],
        end: null,
      };
      nodes.push(n);

      var moved = false;

      // Epsilon moves first: they branch without consuming input.
      var eps = faStep(m, state, FA_EPS);
      for (var e = 0; e < eps.length; e++) {
        var keyE = eps[e] + '@' + at;
        if (seen.indexOf(keyE) >= 0) continue;         // a loop that eats nothing
        var childE = node(eps[e], at, seen.concat([keyE]), depth + 1);
        if (childE) { childE.via = FA_EPS; n.children.push(childE); moved = true; }
      }

      if (at < syms.length) {
        var next = faStep(m, state, syms[at]);
        for (var i = 0; i < next.length; i++) {
          var keyN = next[i] + '@' + (at + 1);
          var childN = node(next[i], at + 1, seen.concat([keyN]), depth + 1);
          if (childN) { childN.via = syms[at]; n.children.push(childN); moved = true; }
        }
        if (!next.length && !moved) n.end = 'stuck';
      } else {
        // The whole word is consumed, so this branch has finished.
        if (m.accept.indexOf(state) >= 0) { n.end = 'accept'; accepting.push(n); }
        else if (!moved) n.end = 'reject';
      }

      return n;
    }

    var root = node(m.start, 0, [m.start + '@0'], 0);

    return {
      verdict: accepting.length ? 'accept' : (truncated ? 'unknown' : 'reject'),
      root: root,
      nodes: nodes,
      accepting: accepting,
      truncated: truncated,
      syms: syms,
    };
  }

  /**
   * The subset construction: turn an NFA into a DFA accepting the same
   * language.
   *
   * A state of the new machine is a *set* of old states — "everywhere
   * the NFA could be right now". That is the whole idea, and the reason
   * the construction can blow up: n states become up to 2^n. Only
   * reachable subsets are built, which is usually far fewer.
   *
   * @returns {{dfa, steps, blowup}}
   */
  function subsetConstruct(m) {
    var name = function (set) { return set.length ? '{' + set.join(',') + '}' : '∅'; };
    var startSet = faClosure(m, [m.start]);

    var seen = {}, order = [], steps = [], delta = {}, accept = [];
    var queue = [startSet];
    seen[name(startSet)] = true;
    order.push(startSet);

    while (queue.length) {
      var set = queue.shift();
      var from = name(set);
      var row = { set: set, name: from, moves: [] };
      delta[from] = {};

      for (var i = 0; i < m.alphabet.length; i++) {
        var sym = m.alphabet[i], reached = [];
        for (var s = 0; s < set.length; s++) {
          var next = faStep(m, set[s], sym);
          for (var k = 0; k < next.length; k++) {
            if (reached.indexOf(next[k]) < 0) reached.push(next[k]);
          }
        }
        reached = faClosure(m, reached);
        var target = name(reached);

        delta[from][sym] = [target];
        row.moves.push({ sym: sym, to: target, set: reached });

        if (!seen[target]) {
          seen[target] = true;
          order.push(reached);
          queue.push(reached);
        }
      }

      // A subset accepts exactly when it contains some accepting state —
      // "one of the branches could be in a final state right now".
      var isFinal = set.some(function (q) { return m.accept.indexOf(q) >= 0; });
      row.accepting = isFinal;
      if (isFinal) accept.push(from);

      steps.push(row);
    }

    return {
      dfa: {
        start: name(startSet),
        accept: accept,
        states: order.map(name),
        alphabet: m.alphabet.slice(),
        delta: delta,
        deterministic: true,
      },
      steps: steps,
      blowup: { from: m.states.length, to: order.length, worst: Math.pow(2, m.states.length) },
    };
  }

  /**
   * Every word over `alphabet` up to `maxLen`, shortest first and in
   * alphabetical order within a length.
   */
  function faWords(alphabet, maxLen) {
    var out = [''], frontier = [''];
    for (var len = 1; len <= maxLen; len++) {
      var next = [];
      for (var i = 0; i < frontier.length; i++) {
        for (var a = 0; a < alphabet.length; a++) next.push(frontier[i] + alphabet[a]);
      }
      out = out.concat(next);
      frontier = next;
    }
    return out;
  }

  /** Does a machine accept this word? Works for either kind. */
  function faAccepts(m, w) {
    return (m.deterministic ? dfaRun(m, w) : nfaRun(m, w)).verdict === 'accept';
  }

  /**
   * Do two machines accept the same words up to a given length?
   *
   * Brute force is the only honest way to check that a construction
   * preserved the language, and returning the first disagreement is far
   * more useful than a boolean when it did not.
   */
  function faAgree(a, b, maxLen) {
    var alphabet = a.alphabet.length >= b.alphabet.length ? a.alphabet : b.alphabet;
    var words = faWords(alphabet, maxLen);
    for (var i = 0; i < words.length; i++) {
      if (faAccepts(a, words[i]) !== faAccepts(b, words[i])) {
        return { same: false, word: words[i] || 'ε', tested: i + 1 };
      }
    }
    return { same: true, tested: words.length };
  }

  /* ---------- rendering ---------- */

  /** The tape as the notes draw it: cells, with a marker over the head. */
  function faTape(syms, at, done) {
    var cells = '', heads = '';
    for (var i = 0; i < syms.length; i++) {
      var cls = i < at ? 'fa-cell read' : (i === at ? 'fa-cell here' : 'fa-cell');
      cells += '<span class="' + cls + '">' + esc(syms[i]) + '</span>';
    }
    cells += '<span class="fa-cell blank">' + (done ? '' : '') + '</span>';
    return '<div class="fa-tape">' + cells + '</div>';
  }

  /** The transition table, with the row being used right now picked out. */
  function faTable(m, live) {
    var html = '<table class="results-table fa-delta"><tr><th>State</th>';
    for (var a = 0; a < m.alphabet.length; a++) html += '<th>' + esc(m.alphabet[a]) + '</th>';
    var anyEps = m.states.some(function (q) { return faStep(m, q, FA_EPS).length; });
    if (anyEps) html += '<th>' + FA_EPS + '</th>';
    html += '</tr>';

    for (var i = 0; i < m.states.length; i++) {
      var q = m.states[i];
      var mark = (q === m.start ? '▸' : '') + (m.accept.indexOf(q) >= 0 ? '◉' : '');
      html += '<tr' + (live === q ? ' class="fa-live"' : '') + '><td><strong>' + esc(q) +
        '</strong> <span class="fa-mark">' + mark + '</span></td>';
      for (var s = 0; s < m.alphabet.length; s++) {
        var to = faStep(m, q, m.alphabet[s]);
        html += '<td>' + (to.length ? esc(to.join(', ')) : '<span class="fa-none">—</span>') + '</td>';
      }
      if (anyEps) {
        var e = faStep(m, q, FA_EPS);
        html += '<td>' + (e.length ? esc(e.join(', ')) : '<span class="fa-none">—</span>') + '</td>';
      }
      html += '</tr>';
    }
    return html + '</table><div class="fa-key">▸ start &nbsp; ◉ accepting</div>';
  }

  var FA = { res: null, frame: 0 };

  function faSet(i) {
    if (!FA.res || !FA.res.configs) return;
    FA.frame = Math.max(0, Math.min(i, FA.res.configs.length - 1));
    faPaint();
  }

  function faPaint() {
    var out = document.getElementById('fa-output');
    if (!out || !FA.res) return;
    var r = FA.res, m = FA.m;
    var c = r.configs[FA.frame];
    var syms = r.configs[0].rest;

    var html = faTape(syms, syms.length - c.rest.length, false);
    html += IX.player('fa', FA.frame, r.configs.length,
      'Configuration ' + (FA.frame + 1) + ' of ' + r.configs.length,
      '(' + esc(c.state) + ', ' + (c.rest.join('') || 'ε') + ')');

    html += '<div class="fa-configs">';
    for (var i = 0; i < r.configs.length; i++) {
      var k = r.configs[i];
      html += '<span class="fa-config' + (i === FA.frame ? ' on' : '') + '" onclick="faSet(' + i + ')">(' +
        esc(k.state) + ', ' + (k.rest.join('') || 'ε') + ')</span>' +
        (i < r.configs.length - 1 ? '<span class="fa-arrow">→</span>' : '');
    }
    html += '</div>';

    html += faTable(m, c.state);

    if (r.verdict === 'accept') {
      html += '<p class="xl-result">Accepted. The computation ends in <strong>' + esc(r.at) +
        '</strong>, which is an accepting state.</p>';
    } else if (r.verdict === 'reject') {
      html += '<p class="xl-result miss">Rejected. The whole word was read, but <strong>' + esc(r.at) +
        '</strong> is not an accepting state.</p>';
    } else if (r.verdict === 'stuck') {
      html += '<p class="xl-result miss">Stuck. There is no transition from <strong>' + esc(r.at) +
        '</strong> on <code>' + esc(r.stuckOn) + '</code>, so the machine cannot go on. ' +
        'That is a rejection — but usually it means the table is missing a row.</p>';
    }
    out.innerHTML = html;
  }

  /** Draw one branch of an NFA computation tree and everything below it. */
  function faBranch(n) {
    var tag = n.end === 'accept' ? '<span class="fa-leaf ok">accepts</span>'
            : n.end === 'reject' ? '<span class="fa-leaf no">ends in a non-final state</span>'
            : n.end === 'stuck' ? '<span class="fa-leaf no">no transition — this branch dies</span>' : '';
    var via = n.via ? '<span class="fa-via">' + esc(n.via) + '</span>' : '';
    var html = '<li>' + via + '<span class="fa-node' + (n.end === 'accept' ? ' ok' : '') + '">(' +
      esc(n.state) + ', ' + (n.rest.join('') || 'ε') + ')</span> ' + tag;
    if (n.children.length) {
      html += '<ul>';
      for (var i = 0; i < n.children.length; i++) html += faBranch(n.children[i]);
      html += '</ul>';
    }
    return html + '</li>';
  }

  function runAutomaton() {
    var out = document.getElementById('fa-output');
    if (!out) return;

    var src = (document.getElementById('fa-machine') || {}).value || '';
    var word = (document.getElementById('fa-word') || {}).value || '';

    var p = faParse(src);
    if (!p.ok) { out.innerHTML = '<div class="tool-error">' + p.error + '</div>'; return; }
    var m = p.m;
    FA.m = m;

    if (m.deterministic) {
      var r = dfaRun(m, word);
      if (r.verdict === 'error') { out.innerHTML = '<div class="tool-error">' + r.error + '</div>'; return; }
      FA.res = r; FA.frame = 0;
      faPaint();
      return;
    }

    // Non-deterministic: there is no single computation to step through,
    // so show the tree instead and say why.
    var t = nfaRun(m, word);
    if (t.verdict === 'error') { out.innerHTML = '<div class="tool-error">' + t.error + '</div>'; return; }
    FA.res = null;

    var html = '<div class="callout tip" style="margin-top:0;"><div class="callout-label">This machine is non-deterministic</div>' +
      'Either some row of the table offers a choice, or there are ε-moves. So there is no single ' +
      'computation — there is a tree of them, and the word is accepted if <strong>any</strong> branch ' +
      'finishes in an accepting state with the whole word read.</div>';

    html += '<div class="fa-tree"><ul>' + faBranch(t.root) + '</ul></div>';
    html += '<p class="xl-result' + (t.verdict === 'accept' ? '' : ' miss') + '">' +
      (t.verdict === 'accept'
        ? 'Accepted — ' + t.accepting.length + ' of the ' + t.nodes.length + ' branches finishes in an accepting state.'
        : 'Rejected — none of the ' + t.nodes.length + ' branches finishes in an accepting state.') + '</p>';
    html += faTable(m, null);
    out.innerHTML = html;
  }

  function runSubset() {
    var out = document.getElementById('sc-output');
    if (!out) return;

    var src = (document.getElementById('sc-machine') || {}).value || '';
    var p = faParse(src);
    if (!p.ok) { out.innerHTML = '<div class="tool-error">' + p.error + '</div>'; return; }
    var m = p.m;

    var sc = subsetConstruct(m);
    var html = '';

    html += '<table class="results-table"><tr><th>Subset</th>';
    for (var a = 0; a < m.alphabet.length; a++) html += '<th>on ' + esc(m.alphabet[a]) + '</th>';
    html += '</tr>';
    for (var i = 0; i < sc.steps.length; i++) {
      var row = sc.steps[i];
      html += '<tr' + (row.accepting ? ' class="awt-row"' : '') + '><td><strong>' + esc(row.name) +
        '</strong>' + (row.accepting ? ' <span class="fa-mark">◉</span>' : '') +
        (i === 0 ? ' <span class="fa-mark">▸</span>' : '') + '</td>';
      for (var k = 0; k < row.moves.length; k++) html += '<td>' + esc(row.moves[k].to) + '</td>';
      html += '</tr>';
    }
    html += '</table>';

    html += '<p class="xl-result">' + sc.blowup.from + ' states became <strong>' + sc.blowup.to +
      '</strong>. The worst case for ' + sc.blowup.from + ' states is 2<sup>' + sc.blowup.from + '</sup> = ' +
      sc.blowup.worst + ', so only the reachable subsets get built.</p>';

    // The construction is only worth anything if it preserved the language,
    // so check rather than claim.
    var agree = faAgree(m, sc.dfa, 9);
    html += '<div class="callout ' + (agree.same ? 'tip' : 'warn') + '"><div class="callout-label">Checked, not assumed</div>' +
      (agree.same
        ? 'The two machines were run on all ' + agree.tested + ' words up to length 9 and agreed on every one.'
        : 'They disagree on <code>' + esc(agree.word) + '</code> — that is a bug, please report it.') +
      '</div>';

    out.innerHTML = html;
  }

  window.FA = FA;
  window.faSet = faSet;
  window.faParse = faParse;
  window.faClosure = faClosure;
  window.faWords = faWords;
  window.faAccepts = faAccepts;
  window.faAgree = faAgree;
  window.dfaRun = dfaRun;
  window.nfaRun = nfaRun;
  window.subsetConstruct = subsetConstruct;
