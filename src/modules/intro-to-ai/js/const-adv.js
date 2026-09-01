    /* ================= W2 · adversarial search ================= */
    const ADV = [
      { q: 'What exactly is <strong>MINIMAX(n)</strong>?', a: 'The utility for MAX of that state, assuming both play optimally',
        c: ['The utility for MAX of that state, assuming both play optimally', 'The utility for whichever player moves next', 'The average payoff over all terminal nodes below n', 'The best payoff MAX could get if MIN played randomly'],
        e: 'Three load-bearing parts: <em>utility</em> (a number), <em>for MAX</em> (one shared scale), and <em>assuming both play optimally</em> (a worst-case guarantee — if MIN blunders, MAX does no worse).' },
      { q: 'Which nodes, and only which nodes, have no children in a game tree?', a: 'Terminal nodes',
        c: ['Terminal nodes', 'Min nodes', 'Max nodes', 'Nodes at even depth'],
        e: 'Children of MAX nodes are MIN or terminal; children of MIN nodes are MAX or terminal; <strong>terminal nodes, and only them, have no children</strong>. The evaluation function supplies their payoffs.' },
      { q: 'What is the <strong>space</strong> complexity of minimax?', a: 'O(b · d)', c: ['O(b · d)', 'O(b^d)', 'O(d²)', 'O(b^(d/2))'],
        e: 'Time is <code>O(b^d)</code>, space is <code>O(b·d)</code> — because <strong>minimax is a depth-first search</strong>, so it only stores the current branch. Memory was never the problem; time is.' },
      { q: 'Minimax is optimal — under what condition?', a: 'If the opponent is optimal', c: ['If the opponent is optimal', 'If the tree is finite', 'If the branching factor is constant', 'If all payoffs are positive'],
        e: 'Two separate conditions, often confused: <strong>complete</strong> if the tree is <em>finite</em>; <strong>optimal</strong> if the <em>opponent</em> is optimal.' },
      { q: 'What is <strong>α</strong>?', a: 'The minimum score the MAX player could get',
        c: ['The minimum score the MAX player could get', 'The maximum score the MAX player could get', 'The minimum score the MIN player could get', 'The maximum score the MIN player could get'],
        e: 'α is a <em>floor</em> for MAX — already secured, can only rise. β is a <em>ceiling</em> for MIN — the maximum score MIN could get, and it can only fall.' },
      { q: 'When do you skip the rest of a <strong>MIN</strong> node’s children?', a: 'When β ≤ α', c: ['When β ≤ α', 'When α ≤ β', 'When β &lt; 0', 'When all children have been evaluated'],
        e: 'The condition is <strong>β ≤ α at both node types</strong> — that is why it is one algorithm rather than two. It reads: "the best this branch can offer MAX is already no better than something MAX can guarantee elsewhere."' },
      { q: 'Does alpha-beta pruning change the value minimax returns?', a: 'No — the value is identical',
        c: ['No — the value is identical', 'Yes, it may return a worse move', 'Yes, it returns a bound rather than a value', 'Only when the tree has odd depth'],
        e: 'Alpha-beta is <strong>exact, not approximate</strong>. It changes only how many terminal nodes get evaluated. In an exam the marks are for the α/β values and the crossed-out leaves.' },
      { q: 'With <em>perfect</em> move ordering, alpha-beta costs roughly…', a: 'O(b^(d/2))', c: ['O(b^(d/2))', 'O(b^d)', 'O(b · d)', 'O(d log b)'],
        e: 'Halving the exponent means you can search <strong>twice as deep</strong> in the same time. With the worst ordering you get no cuts at all and are back to <code>O(b^d)</code>.' },
      { q: 'Which game has roughly 2 × 10¹⁷⁰ states?', a: 'Go', c: ['Go', 'Chess', 'Draughts', 'Tic-Tac-Toe'],
        e: 'Tic-Tac-Toe ~765 · Draughts 5×10²⁰ · Chess 8.73×10³⁹ · <strong>Go 2×10¹⁷⁰</strong>. The jump is why you cannot search the whole tree.' }
    ];
    ADV.forEach(d => QZ_GEN.push({ topic: 'minimax', make: () => ({
      topic: 'adversarial · concepts', kind: 'choice', prompt: d.q, choices: d.c.slice(), answer: d.a,
      check: textCheck(d.a), explain: d.e }) }));
    /* computed: minimax value of a random 2-level tree */
    QZ_GEN.push({ topic: 'minimax', make: () => {
      const groups = [];
      for (let i = 0; i < 3; i++) { const g = []; for (let j = 0; j < 3; j++) g.push(qzInt(0, 15)); groups.push(g); }
      const txt = '[' + groups.map(g => '[' + g.join(',') + ']').join(',') + ']';
      const mins = groups.map(g => Math.min.apply(null, g));
      const ans = Math.max.apply(null, mins);
      return { topic: 'minimax · compute', prompt:
        `MAX at the root, MIN below, terminals at the bottom:<pre>${txt}</pre>What is the <strong>minimax value of the root</strong>?`,
        placeholder: 'a number', answer: String(ans), check: numCheck(ans),
        explain: `Each MIN node takes the smallest of its three children: ${mins.join(', ')}. The MAX root then takes the largest of those: <strong>${ans}</strong>.` };
    } });
    /* computed: how many leaves does alpha-beta evaluate */
    QZ_GEN.push({ topic: 'minimax', make: () => {
      const groups = [];
      for (let i = 0; i < 3; i++) { const g = []; for (let j = 0; j < 3; j++) g.push(qzInt(0, 15)); groups.push(g); }
      const txt = '[' + groups.map(g => '[' + g.join(',') + ']').join(',') + ']';
      const t = gtParse(txt), inf = gtAnnotate(t, true);
      const R = gtAlphaBeta(t);
      const pruned = inf.leaves.filter(l => l.pruned);
      const ans = R.evals;
      return { topic: 'alpha-beta · count', prompt:
        `Evaluating left to right, MAX at the root:<pre>${txt}</pre>How many of the <strong>9 leaves</strong> does alpha-beta actually evaluate?`,
        placeholder: 'a number 1–9', answer: String(ans), check: numCheck(ans),
        explain: `<strong>${ans}</strong> evaluated, ${pruned.length} pruned${pruned.length ? ' (the values ' + pruned.map(l => l.val).join(', ') + ' are never looked at)' : ' — with this ordering no cut is possible'}. The value returned is ${t.ab}, identical to plain minimax. Paste the tree into the Game tree solver to see the α/β trace.` };
    } });
