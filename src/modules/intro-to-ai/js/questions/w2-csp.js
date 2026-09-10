    /* ================= W2 · CSP ================= */
    const CSPQ = [
      { q: 'A constraint C<sub>i</sub> in a CSP is a pairing of…', a: 'scope and relation',
        c: ['scope and relation', 'variable and domain', 'precondition and effect', 'arc and queue'],
        e: 'The <strong>scope</strong> is which variables it talks about, e.g. ⟨SA, WA⟩; the <strong>relation</strong> is which combinations are allowed. Separating them is what lets a solver reason about a constraint without knowing the problem it came from.' },
      { q: 'Single-variable assignment plus commutativity reduces the number of paths from n! × m<sup>n</sup> to…', a: 'm^n',
        c: ['m^n', 'n!', 'n × m', 'm^(n/2)'],
        e: '[WA=red, NT=green] and [NT=green, WA=red] are the <em>same state</em>, so all n! orderings collapse into one. That leaves <strong>m<sup>n</sup></strong>.' },
      { q: 'The <strong>MRV</strong> heuristic chooses…', a: 'the variable with the fewest legal values',
        c: ['the variable with the fewest legal values', 'the variable in the most constraints', 'the value ruling out the fewest others', 'the variable with the largest domain'],
        e: 'MRV = minimum remaining values = <em>most constrained variable</em>. Don’t confuse it with the <em>most constraining</em> variable, which is the degree heuristic.' },
      { q: 'The <strong>least constraining value</strong> heuristic chooses…', a: 'the value that rules out the fewest values in the remaining variables',
        c: ['the value that rules out the fewest values in the remaining variables', 'the value that appears in the fewest constraints', 'the first value in the domain', 'the value that rules out the most values, to fail fast'],
        e: 'Variables "fail first", values "fail last" — you must assign <em>every</em> variable, but you only need <em>one</em> value per variable to work.' },
      { q: 'Forward checking propagates information…', a: 'from assigned to unassigned variables',
        c: ['from assigned to unassigned variables', 'between pairs of unassigned variables', 'from the goal backwards', 'across the whole constraint graph until a fixpoint'],
        e: 'That limitation is exactly why arc consistency does better: <strong>FC never compares two unassigned variables with each other</strong>, so it misses NT = {blue} and SA = {blue} being neighbours.' },
      { q: 'When you check the arc X → Y, which domain can lose values?', a: 'X only',
        c: ['X only', 'Y only', 'Both X and Y', 'Neither — it is only a test'],
        e: 'Arcs are <strong>directed</strong>: X → Y and Y → X are separate checks. X → Y throws out values of X that have no supporting value in Y.' },
      { q: 'In AC-3, if X loses a value, which arcs must be rechecked?', a: 'All arcs Z → X',
        c: ['All arcs Z → X', 'All arcs X → Z', 'Only the arc just processed', 'None — the queue is processed once'],
        e: 'Shrinking X can break arcs that <em>point into</em> X, so <code>for each X_k in NEIGHBORS[Xᵢ]: add (X_k, Xᵢ) to queue</code>. Arcs out of X are unaffected.' },
      { q: 'On the Australia map, {SA = blue} cuts the neighbours’ possibilities from 243 to…', a: '32', c: ['32', '81', '64', '16'],
        e: 'SA has <strong>five</strong> neighbours. Before: 3⁵ = 243. After removing blue from each: 2⁵ = <strong>32</strong>. That is the <strong>87%</strong> reduction usually quoted.' },
      { q: 'How many constraints are in the Australia map-colouring CSP?', a: '9', c: ['9', '7', '5', '21'],
        e: 'SA≠WA, SA≠NT, SA≠Q, SA≠NSW, SA≠V, WA≠NT, NT≠Q, Q≠NSW, NSW≠V — <strong>nine</strong>. Five of them involve SA; T appears in none.' },
      { q: 'Backtracking search is a variation of which Topic 01 algorithm?', a: 'Depth-first search', c: ['Depth-first search', 'Breadth-first search', 'Uniform-cost search', 'A*'],
        e: 'One variable assigned per level, dive down, back up on failure. All solutions sit at depth n, so there is nothing for BFS to gain.' }
    ];
    CSPQ.forEach(d => QZ_GEN.push({ topic: 'csp', make: () => ({
      topic: 'CSP · concepts', kind: 'choice', prompt: d.q, choices: d.c.slice(), answer: d.a,
      check: textCheck(d.a), explain: d.e }) }));
    /* computed: which variable would MRV+degree pick */
    QZ_GEN.push({ topic: 'csp', make: () => {
      const AUS = 'WA : red green blue\nNT : red green blue\nQ : red green blue\nNSW : red green blue\nV : red green blue\nSA : red green blue\nT : red green blue';
      const CON = 'SA != WA\nSA != NT\nSA != Q\nSA != NSW\nSA != V\nWA != NT\nNT != Q\nQ != NSW\nNSW != V';
      const P = cspParse(AUS, CON);
      const v = qzPick(P.vars);
      const ans = String(P.nbr[v].length);
      return { topic: 'CSP · constraint graph', prompt:
        `In the Australia map-colouring constraint graph, what is the <strong>degree of ${v}</strong> — how many constraints is it involved in?`,
        placeholder: 'a number', answer: ans, check: numCheck(parseInt(ans, 10)),
        explain: `${v} has degree <strong>${ans}</strong>. Degrees across the whole problem: ${P.vars.map(x => x + '=' + P.nbr[x].length).join(', ')}. SA is the hub with 5; T is isolated with 0, which is why MRV + degree picks SA first.` };
    } });
