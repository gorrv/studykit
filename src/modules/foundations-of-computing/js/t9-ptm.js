  /* ============================================================
     TOPIC 09 · probabilistic Turing machines
     ------------------------------------------------------------
     Same six-tuple as Topic 1's Turing machine, with one change:
     delta maps a (state, symbol) pair to a DISTRIBUTION over
     instructions rather than to a single instruction. So the
     syntax is Topic 1's, plus a probability at the end of each
     line:

         q0 1 q1 1 > 1/3
         q0 1 q0 0 > 2/3

     Everything a deterministic machine had is the special case
     where every group has one instruction at probability 1.

     Running it produces a TREE rather than a sequence. The
     probability of a branch is the product along it, and the
     probability that the machine accepts is the sum over all
     accepting branches — which is exactly what the slides say,
     and is only true because distinct branches are disjoint
     events.
     ============================================================ */

  function ptmParse(text) {
    var lines = String(text || '').split(/\n/);
    var start = null, accept = null, reject = null;
    var groups = {}, states = {}, tape = {}, rules = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/;.*$/, '').trim();
      if (!line) continue;

      var head = line.match(/^(start|accept|reject)\s*:\s*(\S+)\s*$/i);
      if (head) {
        var q = head[2];
        states[q] = true;
        if (/start/i.test(head[1])) start = q;
        else if (/accept/i.test(head[1])) accept = q;
        else reject = q;
        continue;
      }

      var p = line.split(/[\s,]+/).filter(Boolean);
      if (p.length !== 5 && p.length !== 6) {
        return { ok: false, error: 'Line ' + (i + 1) + ': an instruction is ' +
          '<code>state read newstate write move</code> and optionally a probability — five or six parts, ' +
          'not ' + p.length + '.' };
      }

      var from = p[0], read = p[1], to = p[2], write = p[3], move = p[4];
      if (read === '_') read = TM_BLANK;
      if (write === '_') write = TM_BLANK;
      if (move === '>' || move === '→' || move === 'r') move = 1;
      else if (move === '<' || move === '←' || move === 'l') move = -1;
      else return { ok: false, error: 'Line ' + (i + 1) + ': the move must be <code>&gt;</code> or ' +
        '<code>&lt;</code>, not <code>' + esc(p[4]) + '</code>.' };

      var prob = p.length === 6 ? frParse(p[5]) : fr(1);
      if (!prob) return { ok: false, error: 'Line ' + (i + 1) + ': cannot read the probability ' +
        '<code>' + esc(p[5]) + '</code>.' };
      if (frCmp(prob, fr(0)) <= 0 || frCmp(prob, fr(1)) > 0) {
        return { ok: false, error: 'Line ' + (i + 1) + ': the probability must be in (0, 1].' };
      }

      states[from] = true; states[to] = true;
      if (read !== TM_BLANK) tape[read] = true;
      if (write !== TM_BLANK) tape[write] = true;

      var key = from + ' ' + read;
      (groups[key] || (groups[key] = { from: from, read: read, opts: [] }))
        .opts.push({ to: to, write: write, move: move, prob: prob });
      rules++;
    }

    if (!start) return { ok: false, error: 'No start state. Add <code>start: q0</code>.' };
    if (!accept) return { ok: false, error: 'No accepting state. Add <code>accept: qacc</code>.' };
    if (!rules) return { ok: false, error: 'No instructions yet.' };

    /* Every group must be a distribution. A group summing to less
       than 1 is not a machine that sometimes stops — it is an
       ill-defined delta, and the accept probabilities computed from
       it would not mean anything. */
    var bad = [];
    for (var k in groups) {
      var g = groups[k];
      var s = g.opts.reduce(function (a, o) { return frAdd(a, o.prob); }, fr(0));
      g.total = s;
      if (frCmp(s, fr(1)) !== 0) {
        bad.push(esc(g.from) + ' reading ' + esc(g.read === TM_BLANK ? '␣' : g.read) +
                 ' sums to ' + frShow(s));
      }
    }
    if (bad.length) {
      return { ok: false, error: 'δ must give a <strong>probability distribution</strong> for each ' +
        '(state, symbol) pair, so each group has to sum to exactly 1. These do not: ' +
        bad.join('; ') + '.' };
    }

    return { ok: true, m: {
      start: start, accept: accept, reject: reject,
      states: Object.keys(states),
      alphabet: Object.keys(tape).sort(),
      groups: groups,
      rules: rules,
      branching: Object.keys(groups).filter(function (k) { return groups[k].opts.length > 1; }).length
    } };
  }

  /**
     The computation tree.

     Explored breadth-first so that the depth cap means "all
     branches to this many steps", which is what makes the
     leftover probability mass interpretable: it is exactly the
     chance the machine is still running at that step.
  */
  function ptmTree(m, word, opts) {
    opts = opts || {};
    var maxDepth = opts.depth || 12;
    var maxNodes = opts.nodes || 3000;

    var root = {
      id: 0, depth: 0, state: m.start,
      tape: (String(word).trim() || TM_BLANK).split(''),
      head: 0, prob: fr(1), parent: null, children: [], edgeProb: null
    };
    var nodes = [root], frontier = [root], leaves = [];
    var truncated = false;

    while (frontier.length) {
      var next = [];
      for (var i = 0; i < frontier.length; i++) {
        var nd = frontier[i];

        if (nd.head < 0) { nd.tape.unshift(TM_BLANK); nd.head = 0; }
        if (nd.head >= nd.tape.length) nd.tape.push(TM_BLANK);

        if (nd.state === m.accept) { nd.verdict = 'accept'; leaves.push(nd); continue; }
        if (m.reject && nd.state === m.reject) { nd.verdict = 'reject'; leaves.push(nd); continue; }

        var g = m.groups[nd.state + ' ' + nd.tape[nd.head]];
        if (!g) { nd.verdict = 'stuck'; leaves.push(nd); continue; }

        if (nd.depth >= maxDepth || nodes.length >= maxNodes) {
          nd.verdict = 'open'; nd.truncated = true; truncated = true; leaves.push(nd); continue;
        }

        for (var j = 0; j < g.opts.length; j++) {
          var o = g.opts[j];
          var tape = nd.tape.slice();
          tape[nd.head] = o.write;
          var kid = {
            id: nodes.length, depth: nd.depth + 1, state: o.to,
            tape: tape, head: nd.head + o.move,
            prob: frMul(nd.prob, o.prob), edgeProb: o.prob,
            parent: nd.id, children: [],
            wrote: o.write, moved: o.move, readWas: nd.tape[nd.head]
          };
          nodes.push(kid);
          nd.children.push(kid.id);
          next.push(kid);
        }
      }
      frontier = next;
    }

    function massOf(kind) {
      return leaves.reduce(function (s, l) {
        return l.verdict === kind ? frAdd(s, l.prob) : s;
      }, fr(0));
    }
    var pAccept = massOf('accept'), pReject = massOf('reject');
    var pStuck = massOf('stuck'), pOpen = massOf('open');
    var total = frAdd(frAdd(pAccept, pReject), frAdd(pStuck, pOpen));

    // E[T] over the branches that finished, plus how much mass that covers
    var halted = frAdd(frAdd(pAccept, pReject), pStuck);
    var eT = leaves.reduce(function (s, l) {
      return l.verdict === 'open' ? s : frAdd(s, frMul(fr(l.depth), l.prob));
    }, fr(0));

    return {
      ok: true, nodes: nodes, leaves: leaves, root: root,
      pAccept: pAccept, pReject: pReject, pStuck: pStuck, pOpen: pOpen,
      total: total,
      /* Every leaf is a disjoint event and the tree is exhaustive, so
         the four masses must total exactly 1. If they do not, the tree
         was built wrongly — checked here rather than assumed. */
      exhaustive: frCmp(total, fr(1)) === 0,
      halted: halted,
      eT: eT,
      eTGivenHalt: frCmp(halted, fr(0)) === 0 ? null : frDiv(eT, halted),
      truncated: truncated, depth: maxDepth,
      branches: leaves.length
    };
  }

  /** The path from the root to a leaf, for showing the multiplication. */
  function ptmPath(tree, leaf) {
    var path = [], nd = leaf;
    while (nd) {
      path.unshift(nd);
      nd = nd.parent === null ? null : tree.nodes[nd.parent];
    }
    return path;
  }

  var PTM_PRESETS = {
    /* Reproduces the shape on slides 9 and 10: a 1/3 : 2/3 split at
       the root and again on the right, giving leaf probabilities
       1/3, 2/9 and 4/9. */
    lecture:
      '; the branching on slides 9-10: leaves at 1/3, 2/9 and 4/9\n' +
      'start: q0\naccept: qacc\nreject: qrej\n' +
      'q0 1 qacc 1 > 1/3\n' +
      'q0 1 q1 1 > 2/3\n' +
      'q1 1 qrej 1 > 1/3\n' +
      'q1 1 qacc 1 > 2/3\n',
    coin:
      '; a fair coin: accept half the time, reject half the time\n' +
      'start: q0\naccept: qacc\nreject: qrej\n' +
      'q0 1 qacc 1 > 1/2\n' +
      'q0 1 qrej 1 > 1/2\n',
    biased:
      '; Keeps flipping until it accepts. Halts with probability 1, but\n' +
      '; there is no bound on how long that takes -- which is exactly the\n' +
      '; shape of a Las Vegas algorithm. Run it on an empty input.\n' +
      ';\n' +
      '; q1 exists only to step back: a Turing machine must move every\n' +
      '; step, so "loop in place" takes two states, and a machine that\n' +
      '; walks off its input gets stuck instead of looping.\n' +
      'start: q0\naccept: qacc\nreject: qrej\n' +
      'q0 _ qacc _ > 1/2\n' +
      'q0 _ q1 _ > 1/2\n' +
      'q1 _ q0 _ <\n',
    deterministic:
      '; no probabilities at all, so the tree is a single path\n' +
      'start: q0\naccept: qacc\nreject: qrej\n' +
      'q0 1 q0 1 >\n' +
      'q0 _ qacc _ >\n'
  };
