  /* ============================================================
     SCALA TOPIC 05 · finite automata

       daRun    — a DFA, one state at a time, including getting stuck
       naRun    — an NFA, as a set of states at a time
       naSubset — the DFA that set-of-states construction gives you

     Checked two ways that share no code: the NFA and the DFA built
     from it must accept exactly the same strings (tested by
     exhaustion over every string up to a given length), and the DFA
     from Topic 04's derivative matcher must agree with both.
     ============================================================ */

  /*
     A(Σ, Qs, Q0, F, δ) — the five things a DFA is.

     δ is written as a map from state to a map from character to
     state, and it is deliberately allowed to be incomplete: a
     missing entry means there is no move, and the machine is stuck.
     Textbook definitions vary on whether that is allowed; letting it
     happen and showing what it means is more useful than hiding it.
  */
  var DA_MACHINES = {
    worked: {
      label: 'the worked example',
      alphabet: ['a', 'b'],
      states: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4'],
      start: 'Q0',
      accepting: ['Q4'],
      delta: {
        Q0: { a: 'Q1', b: 'Q2' },
        Q1: { a: 'Q4', b: 'Q2' },
        Q2: { a: 'Q3', b: 'Q2' },
        Q3: { a: 'Q4', b: 'Q2' },
        Q4: { a: 'Q4', b: 'Q4' }
      },
      note: 'Q4 accepts and never leaves, so this accepts any string that ever reaches it.'
    },
    evenA: {
      label: 'an even number of a&rsquo;s',
      alphabet: ['a', 'b'],
      states: ['even', 'odd'],
      start: 'even',
      accepting: ['even'],
      delta: { even: { a: 'odd', b: 'even' }, odd: { a: 'even', b: 'odd' } },
      note: 'Two states are enough: the machine only has to remember one bit.'
    },
    endsAB: {
      label: 'ends in ab',
      alphabet: ['a', 'b'],
      states: ['S', 'A', 'AB'],
      start: 'S',
      accepting: ['AB'],
      delta: { S: { a: 'A', b: 'S' }, A: { a: 'A', b: 'AB' }, AB: { a: 'A', b: 'S' } },
      note: 'It remembers just enough of the past: nothing, an a, or an ab.'
    },
    partial: {
      label: 'a partial machine',
      alphabet: ['a', 'b'],
      states: ['P0', 'P1', 'P2'],
      start: 'P0',
      accepting: ['P2'],
      delta: { P0: { a: 'P1' }, P1: { b: 'P2' }, P2: {} },
      note: 'δ has no entry for a b in P0, or for anything at all in P2. The machine gets stuck ' +
        'and the string is rejected — which is a perfectly good answer, just not a transition.'
    }
  };

  /** Run a DFA, reporting each step and where it stopped. */
  function daRun(machine, input) {
    var state = machine.start;
    var steps = [{ at: 0, state: state, read: null, to: state }];
    var stuck = false;

    for (var i = 0; i < input.length; i++) {
      var c = input[i];
      if (machine.alphabet.indexOf(c) < 0) {
        return { ok: false, error: '<code>' + esc(c) + '</code> is not in the alphabet.' };
      }
      var row = machine.delta[state] || {};
      var next = row[c];
      if (next === undefined) {
        steps.push({ at: i, state: state, read: c, to: null, stuck: true });
        stuck = true;
        break;
      }
      steps.push({ at: i, state: state, read: c, to: next });
      state = next;
    }

    return {
      ok: true, steps: steps, stuck: stuck,
      end: stuck ? null : state,
      accepted: !stuck && machine.accepting.indexOf(state) >= 0
    };
  }

  /** Every string over the alphabet up to a length, in shortlex order. */
  function daStrings(alphabet, maxLen) {
    var out = [''];
    var frontier = [''];
    for (var len = 1; len <= maxLen; len++) {
      var next = [];
      frontier.forEach(function (s) {
        alphabet.forEach(function (c) { next.push(s + c); });
      });
      out = out.concat(next);
      frontier = next;
    }
    return out;
  }

  /* ---------- nondeterminism ---------- */

  /*
     The same five things, except δ gives a *set* of next states, and
     a state may have none for a character. Running it means keeping
     the set of states you could be in — which is the idea that makes
     backtracking unnecessary.
  */
  var NA_MACHINES = {
    worked: {
      label: 'the worked example',
      alphabet: ['a', 'b'],
      states: ['Q0', 'Q1', 'Q2'],
      start: 'Q0',
      accepting: ['Q2'],
      delta: {
        Q0: { a: ['Q0', 'Q1'], b: ['Q0'] },
        Q1: { b: ['Q2'] },
        Q2: {}
      },
      note: 'Q0 loops on everything <em>and</em> may step to Q1 on an a. The machine is guessing ' +
        'where the interesting part of the string starts.'
    },
    endsAB: {
      label: 'ends in ab, guessed',
      alphabet: ['a', 'b'],
      states: ['N0', 'N1', 'N2'],
      start: 'N0',
      accepting: ['N2'],
      delta: { N0: { a: ['N0', 'N1'], b: ['N0'] }, N1: { b: ['N2'] }, N2: {} },
      note: 'Three states and no bookkeeping, against the deterministic version that has to ' +
        'remember what it has seen.'
    },
    twoWays: {
      label: 'two routes to the same place',
      alphabet: ['a', 'b'],
      states: ['R', 'X', 'Y', 'Z'],
      start: 'R',
      accepting: ['Z'],
      delta: { R: { a: ['X', 'Y'] }, X: { b: ['Z'] }, Y: { b: ['Z'] }, Z: {} },
      note: 'Both branches accept <code>ab</code>. A backtracking matcher would try one and then ' +
        'the other; tracking the set does both at once.'
    }
  };

  /** Run an NFA by keeping the set of states it could be in. */
  function naRun(machine, input) {
    var current = [machine.start];
    var steps = [{ at: 0, before: null, read: null, after: current.slice() }];

    for (var i = 0; i < input.length; i++) {
      var c = input[i];
      if (machine.alphabet.indexOf(c) < 0) {
        return { ok: false, error: '<code>' + esc(c) + '</code> is not in the alphabet.' };
      }
      var next = {};
      current.forEach(function (s) {
        var row = machine.delta[s] || {};
        (row[c] || []).forEach(function (t) { next[t] = true; });
      });
      var after = Object.keys(next).sort();
      steps.push({ at: i, before: current.slice(), read: c, after: after });
      current = after;
      if (!current.length) break;     // dead, but keep the trace
    }

    return {
      ok: true, steps: steps, end: current.slice(),
      dead: current.length === 0,
      accepted: current.some(function (s) { return machine.accepting.indexOf(s) >= 0; })
    };
  }

  /**
     The subset construction: make one DFA state for each set of NFA
     states that is actually reachable. This is the same idea as
     running the NFA, done once in advance instead of every time.
  */
  function naSubset(machine) {
    function key(set) { return set.length ? set.join(',') : '∅'; }

    var startSet = [machine.start];
    var states = {}, order = [];
    var queue = [startSet];
    states[key(startSet)] = { set: startSet, delta: {} };
    order.push(key(startSet));

    while (queue.length) {
      var set = queue.shift();
      var k = key(set);
      machine.alphabet.forEach(function (c) {
        var next = {};
        set.forEach(function (s) {
          var row = machine.delta[s] || {};
          (row[c] || []).forEach(function (t) { next[t] = true; });
        });
        var after = Object.keys(next).sort();
        var ak = key(after);
        if (!states[ak]) {
          states[ak] = { set: after, delta: {} };
          order.push(ak);
          queue.push(after);
        }
        states[k].delta[c] = ak;
      });
    }

    var accepting = order.filter(function (k) {
      return states[k].set.some(function (s) { return machine.accepting.indexOf(s) >= 0; });
    });

    return {
      ok: true,
      alphabet: machine.alphabet,
      states: order,
      start: key(startSet),
      accepting: accepting,
      delta: order.reduce(function (acc, k) { acc[k] = states[k].delta; return acc; }, {}),
      sets: order.map(function (k) { return { name: k, set: states[k].set }; })
    };
  }
