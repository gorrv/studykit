  /* ---------- Topic 01 · finite automata ---------- */

  /**
   * A random DFA over {0,1} with `n` states, every row filled in.
   *
   * Every state is reachable from the start, which stops the generator
   * producing questions whose answer is "the machine ignores half of
   * itself" — technically valid, pedagogically useless.
   */
  function fqDfa(n) {
    var states = [];
    for (var i = 0; i < n; i++) states.push('q' + i);

    var lines = ['start: q0'];
    var accept = states.filter(function () { return Math.random() < 0.4; });
    if (!accept.length) accept = [qzPick(states)];
    lines.push('accept: ' + accept.join(' '));

    for (var s = 0; s < n; s++) {
      lines.push(states[s] + ' 0 ' + qzPick(states));
      lines.push(states[s] + ' 1 ' + qzPick(states));
    }

    var p = faParse(lines.join('\n'));
    if (!p.ok) throw new Error('retry');

    // Reject machines where some state can never be reached.
    var seen = ['q0'], queue = ['q0'];
    while (queue.length) {
      var q = queue.shift();
      ['0', '1'].forEach(function (sym) {
        faStep(p.m, q, sym).forEach(function (t) {
          if (seen.indexOf(t) < 0) { seen.push(t); queue.push(t); }
        });
      });
    }
    if (seen.length < n) throw new Error('retry');

    return { m: p.m, src: lines.join('\n'), accept: accept };
  }

  /** The transition table, laid out the way the tools draw it. */
  function fqTable(m) {
    var h = '<table class="results-table"><tr><th>State</th><th>0</th><th>1</th></tr>';
    m.states.forEach(function (q) {
      var mark = (q === m.start ? ' ▸' : '') + (m.accept.indexOf(q) >= 0 ? ' ◉' : '');
      h += '<tr><td><strong>' + q + '</strong>' + mark + '</td><td>' +
        faStep(m, q, '0').join(', ') + '</td><td>' + faStep(m, q, '1').join(', ') + '</td></tr>';
    });
    return h + '</table><div class="fa-key">▸ start &nbsp; ◉ accepting</div>';
  }

  function fqWord(lo, hi) {
    var n = qzInt(lo, hi), w = '';
    for (var i = 0; i < n; i++) w += qzPick(['0', '1']);
    return w;
  }

  /* ---- Does this machine accept this word? ---- */
  QZ_GEN.push({ topic: 'automata', make: function () {
    var d = fqDfa(qzInt(3, 4));
    var w = fqWord(4, 7);
    var r = dfaRun(d.m, w);
    if (r.verdict === 'stuck') throw new Error('retry');
    var yes = r.verdict === 'accept';

    return {
      topic: 'automata · running a DFA',
      kind: 'choice',
      prompt: 'Does this machine accept <code>' + w + '</code>?' + fqTable(d.m),
      choices: ['Yes, it accepts', 'No, it rejects'],
      answer: yes ? 'Yes, it accepts' : 'No, it rejects',
      check: textCheck(yes ? 'Yes, it accepts' : 'No, it rejects'),
      explain: 'The computation is ' +
        r.configs.map(function (c) { return '(' + c.state + ', ' + (c.rest.join('') || 'ε') + ')'; }).join(' → ') +
        '. It ends in <strong>' + r.at + '</strong>, which is ' +
        (yes ? '' : 'not ') + 'an accepting state.',
    };
  } });

  /* ---- Which state does it finish in? ---- */
  QZ_GEN.push({ topic: 'automata', make: function () {
    var d = fqDfa(qzInt(3, 4));
    var w = fqWord(5, 8);
    var r = dfaRun(d.m, w);
    if (r.verdict === 'stuck') throw new Error('retry');

    return {
      topic: 'automata · following a computation',
      prompt: 'Starting from q0, which state does this machine end in after reading <code>' +
        w + '</code>?' + fqTable(d.m),
      placeholder: 'a state name',
      answer: r.at,
      check: function (v) {
        var x = String(v).trim().toLowerCase().replace(/\s+/g, '');
        return { ok: x === r.at.toLowerCase() };
      },
      explain: 'Step through it: ' +
        r.configs.map(function (c) { return '(' + c.state + ', ' + (c.rest.join('') || 'ε') + ')'; }).join(' → ') +
        '. So the answer is <strong>' + r.at + '</strong>.',
    };
  } });

  /* ---- Epsilon closure ---- */
  QZ_GEN.push({ topic: 'automata', make: function () {
    var names = ['p', 'q', 'r', 's'];
    var lines = ['start: p', 'accept: s'];
    var epsCount = 0;
    for (var i = 0; i < names.length; i++) {
      for (var j = 0; j < names.length; j++) {
        if (i !== j && Math.random() < 0.28) { lines.push(names[i] + ' eps ' + names[j]); epsCount++; }
      }
      lines.push(names[i] + ' a ' + qzPick(names));
    }
    if (epsCount < 2) throw new Error('retry');

    var p = faParse(lines.join('\n'));
    if (!p.ok) throw new Error('retry');
    var from = qzPick(names);
    var cl = faClosure(p.m, [from]);
    if (cl.length === 1 || cl.length === names.length) throw new Error('retry');

    var eps = lines.filter(function (l) { return / eps /.test(l); })
      .map(function (l) { var t = l.split(/\s+/); return t[0] + ' → ' + t[2]; });

    return {
      topic: 'automata · ε-closure',
      prompt: 'An NFA has these ε-moves:<br><code>' + eps.join('</code>, <code>') + '</code><br><br>' +
        'What is the ε-closure of <strong>' + from + '</strong>? List the states alphabetically, separated by commas.',
      placeholder: 'e.g. p, q',
      answer: cl.join(', '),
      check: function (v) {
        var got = String(v).toLowerCase().replace(/[{}\s]/g, '').split(',').filter(Boolean).sort();
        return { ok: got.join(',') === cl.join(',').toLowerCase() };
      },
      explain: 'The closure always contains the state itself, then everything reachable by following ' +
        'ε-moves repeatedly. Here that gives <strong>{' + cl.join(', ') + '}</strong>.',
    };
  } });

  /* ---- How big does the subset construction get? ---- */
  QZ_GEN.push({ topic: 'automata', make: function () {
    var names = ['s', 't', 'u'];
    var lines = ['start: s', 'accept: ' + qzPick(names)];
    for (var i = 0; i < names.length; i++) {
      ['a', 'b'].forEach(function (sym) {
        var targets = names.filter(function () { return Math.random() < 0.45; });
        if (targets.length) lines.push(names[i] + ' ' + sym + ' ' + targets.join(' '));
      });
    }
    var p = faParse(lines.join('\n'));
    if (!p.ok || p.m.deterministic || p.m.alphabet.length < 2) throw new Error('retry');

    var sc = subsetConstruct(p.m);
    if (sc.blowup.to < 3) throw new Error('retry');

    var table = '<table class="results-table"><tr><th>State</th><th>a</th><th>b</th></tr>';
    p.m.states.forEach(function (q) {
      table += '<tr><td><strong>' + q + '</strong>' + (p.m.accept.indexOf(q) >= 0 ? ' ◉' : '') + '</td><td>' +
        (faStep(p.m, q, 'a').join(', ') || '—') + '</td><td>' + (faStep(p.m, q, 'b').join(', ') || '—') + '</td></tr>';
    });
    table += '</table>';

    return {
      topic: 'automata · subset construction',
      prompt: 'Run the subset construction on this NFA. How many states does the resulting DFA have, ' +
        'counting only the subsets that are actually reachable (and counting ∅ if you reach it)?' + table,
      placeholder: 'a number',
      answer: String(sc.blowup.to),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
        return isNaN(x) ? { ok: false, msg: 'Give a whole number.' } : { ok: x === sc.blowup.to };
      },
      explain: 'Starting from {' + faClosure(p.m, [p.m.start]).join(',') + '} and following each symbol ' +
        'gives <strong>' + sc.blowup.to + '</strong> reachable subsets: ' +
        sc.dfa.states.join(', ') + '. The worst case would have been 2³ = 8.',
    };
  } });
