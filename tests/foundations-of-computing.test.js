'use strict';
/**
 * Foundations of Computing — Topics 01 to 03.
 *
 * The tools in this module are simulators, so the only test worth writing is
 * one that runs them and compares the answer to something established
 * independently. Three kinds of check appear below, in increasing order of
 * how much they are worth:
 *
 *   1. Published values. The mod-3 automaton and the a^n b^n Turing machine
 *      have verdicts printed against them in the standard treatments; those
 *      are hard-coded here and must still hold.
 *   2. Agreement between independent routes to the same answer. The regular
 *      expression, the automaton and integer arithmetic all decide "is this
 *      binary string a multiple of three", by completely different means. If
 *      any one of them breaks, they stop agreeing.
 *   3. Invariants over exhaustive input. A construction that claims to
 *      preserve a language is run on every word up to a length and checked.
 *   4. Theorems, checked by running them. Topic 2's reduction claims that a
 *      formula is satisfiable exactly when its graph has a clique of a given
 *      size. Both sides are computed by unrelated means, so the claim can be
 *      tested on formulas rather than assumed — which is done below on every
 *      three-clause two-variable formula there is.
 */

const { loadModule, Suite, checkStructure, checkQuestionBank } = require('./lib/harness');

module.exports = async function run() {
  const s = new Suite('foundations-of-computing');
  const m = await loadModule('foundations-of-computing.html');
  const w = m.window;

  await checkStructure(s, m);

  /* ---------------- finite automata ---------------- */

  // The three-state machine whose state is the value read so far mod 3.
  const mod3src = ['start: q0', 'accept: q0',
    'q0 0 q0', 'q0 1 q1', 'q1 0 q2', 'q1 1 q0', 'q2 0 q1', 'q2 1 q2'].join('\n');
  const parsed = w.faParse(mod3src);
  s.ok('the mod-3 machine parses', parsed.ok, parsed.error);
  const mod3 = parsed.m;
  s.ok('and is recognised as deterministic', mod3.deterministic);
  s.same('with the alphabet it was given', mod3.alphabet, ['0', '1']);

  // Verdicts printed against this machine in the standard treatment.
  const published = {
    '1111': true, '10001': false, '1001': true, '111': false, '11100': false,
    '110': true, '11': true, '11111': false, '101': false, '0': true, '10010': true,
  };
  Object.keys(published).forEach(word => {
    s.ok(`mod-3 machine on ${word}`,
      (w.dfaRun(mod3, word).verdict === 'accept') === published[word],
      `expected ${published[word] ? 'accept' : 'reject'}`);
  });

  // The same machine against arithmetic, over every binary string to length 13.
  {
    let bad = 0, first = null;
    w.faWords(['0', '1'], 13).forEach(word => {
      if (!word) return;
      const got = w.dfaRun(mod3, word).verdict === 'accept';
      if (got !== (parseInt(word, 2) % 3 === 0)) { bad++; if (!first) first = word; }
    });
    s.ok('mod-3 machine agrees with value % 3 on all 16382 words to length 13',
      bad === 0, `${bad} disagreements, first at ${first}`);
  }

  // The configuration sequence is the thing the tool displays, so check it.
  {
    const r = w.dfaRun(mod3, '1001');
    const trace = r.configs.map(c => `(${c.state},${c.rest.join('') || 'ε'})`).join(' ');
    s.has('the computation on 1001 is written out in full', trace,
      '(q0,1001) (q1,001) (q2,01) (q1,1) (q0,ε)');
  }

  // A machine with a hole in its table is stuck, not silently rejecting.
  {
    const partial = w.faParse(['start: a', 'accept: b', 'a 0 b'].join('\n')).m;
    s.ok('a missing transition reports "stuck"', w.dfaRun(partial, '00').verdict === 'stuck');
  }

  /* ---------------- non-determinism ---------------- */

  const nfa = w.faParse(['start: s', 'accept: q',
    's a q', 's b q f', 'q a f', 'f a f', 'f b s f'].join('\n')).m;
  s.ok('an NFA is recognised as non-deterministic', !nfa.deterministic);

  {
    const t = w.nfaRun(nfa, 'aaabbb');
    s.ok('aaabbb is accepted by some branch', t.verdict === 'accept');
    s.ok('and the tree records which branches accepted', t.accepting.length > 0);
    // The spine of the tree is the sequence a reader would draw first.
    let n = t.root, spine = [];
    while (n && spine.length < 4) { spine.push(`(${n.state},${n.rest.join('') || 'ε'})`); n = n.children[0]; }
    s.has('the first branch is the expected one', spine.join(' '),
      '(s,aaabbb) (q,aabbb) (f,abbb) (f,bbb)');
  }

  s.ok('a dead branch alone does not reject', w.nfaRun(nfa, 'a').verdict === 'accept');

  /* ---------------- subset construction ---------------- */

  {
    const sc = w.subsetConstruct(nfa);
    s.ok('the construction stays inside the power set',
      sc.blowup.to <= sc.blowup.worst, `${sc.blowup.to} > 2^${sc.blowup.from}`);
    const agree = w.faAgree(nfa, sc.dfa, 11);
    s.ok('NFA and constructed DFA accept the same words to length 11',
      agree.same, `differ on ${agree.word}`);
  }

  // ε-moves are the part that goes wrong, so give them their own machine.
  {
    const eps = w.faParse(['start: s', 'accept: f', 's eps a', 's eps b',
      'a 0 a', 'a eps f', 'b 1 b', 'b eps f', 'f 0 f'].join('\n')).m;
    s.same('the ε-closure of the start state', w.faClosure(eps, ['s']), ['a', 'b', 'f', 's']);
    const agree = w.faAgree(eps, w.subsetConstruct(eps).dfa, 11);
    s.ok('an ε-NFA and its DFA agree to length 11', agree.same, `differ on ${agree.word}`);
  }

  /* ---------------- regular expressions ---------------- */

  const exprs = [
    ['1(1∪0)*0', word => word.length >= 2 && word[0] === '1' && word[word.length - 1] === '0', ['0', '1'], 12],
    ['((a∪b)(a∪b))*', word => word.length % 2 === 0, ['a', 'b'], 12],
    ['(0∪1(01*0)*1)*', word => word === '' || parseInt(word, 2) % 3 === 0, ['0', '1'], 13],
  ];
  exprs.forEach(([src, truth, alphabet, len]) => {
    const built = w.reToNfa(w.reParse(src).ast).m;
    let bad = 0, first = null;
    w.faWords(alphabet, len).forEach(word => {
      const got = w.nfaRun(built, word, 5000).verdict === 'accept';
      if (got !== truth(word)) { bad++; if (!first) first = word || 'ε'; }
    });
    s.ok(`${src} matches exactly what it should, to length ${len}`, bad === 0,
      `${bad} wrong, first at ${first}`);
  });

  // Expression -> NFA -> DFA must land on the same language as the hand-built
  // machine at the top of this file. Five independent routes, one answer.
  {
    const fromRe = w.subsetConstruct(w.reToNfa(w.reParse('(0∪1(01*0)*1)*').ast).m).dfa;
    const agree = w.faAgree(fromRe, mod3, 12);
    s.ok('the expression compiles to a machine equivalent to the hand-built one',
      agree.same, `differ on ${agree.word}`);
  }

  // The classic misreading, which the enumeration exists to expose.
  s.same('(ab)* lists as copies of ab',
    w.reEnumerate('(ab)*', 4).words, ['', 'ab', 'abab', 'ababab']);
  s.same('ab* lists as a then bs',
    w.reEnumerate('ab*', 4).words, ['a', 'ab', 'abb', 'abbb']);

  s.ok('a malformed expression is reported, not thrown', w.reParse('(a|').ok === false);
  s.ok('so is a stray star', w.reParse('*a').ok === false);

  /* ---------------- Turing machines ---------------- */

  const anbn = w.tmParse([
    'start: qinit', 'accept: qacc', 'reject: qrej',
    'qinit a q1 _ >', 'qinit b qrej _ >', 'qinit _ qacc _ >',
    'q1 a q1 a >', 'q1 b q1 b >', 'q1 _ q2 _ <',
    'q2 b q3 _ <', 'q2 a qrej _ >', 'q2 _ qrej _ >',
    'q3 a q3 a <', 'q3 b q3 b <', 'q3 _ qinit _ >',
  ].join('\n'));
  s.ok('the a^n b^n machine parses', anbn.ok, anbn.error);

  // Published verdicts for this machine.
  [['aabb', 1], ['aaabbb', 1], ['ab', 1], ['aaab', 0], ['bbab', 0], ['bab', 0]].forEach(([word, want]) => {
    s.ok(`a^n b^n machine on ${word}`, w.tmVerdict(anbn.m, word) === want,
      `expected ${want}, got ${w.tmVerdict(anbn.m, word)}`);
  });

  // Stronger: it must decide exactly that language, and always halt.
  {
    const sv = w.tmSurvey(anbn.m, ['a', 'b'], 9, 3000);
    const isAnBn = word => { const mm = /^(a*)(b*)$/.exec(word); return !!mm && mm[1].length === mm[2].length; };
    const wrong = sv.accept.filter(x => !isAnBn(x)).concat(sv.reject.filter(isAnBn));
    s.ok('it decides exactly { a^n b^n } over every word to length 9',
      wrong.length === 0, `wrong on ${wrong.slice(0, 3)}`);
    s.ok('and halts on every one of them', sv.never.length === 0,
      `${sv.never.length} did not halt`);
  }

  // The three outcomes have to stay distinguishable — that is the topic.
  {
    const runner = w.tmParse(['start: q0', 'accept: qacc', 'reject: qrej',
      'q0 a q0 a >', 'q0 _ q0 _ >'].join('\n')).m;
    const r = w.tmRun(runner, 'aa', 200);
    s.ok('a machine that runs off to the right gets no verdict', r.verdict === 'nolimit');
    s.ok('and is not reported as rejecting', r.verdict !== 'reject');
    s.ok('and says plainly that it gave up', /gave up|may halt later|Still running/i.test(r.why || ''));
    s.ok('tmVerdict reports "never halts" as null', w.tmVerdict(runner, 'aa', 200) === null);
  }

  {
    // A machine that genuinely repeats a configuration is provably looping,
    // which is a different and stronger claim than running out of steps.
    const spin = w.tmParse(['start: q0', 'accept: qacc',
      'q0 a q1 a >', 'q1 a q0 a <', 'q1 _ q0 _ <'].join('\n')).m;
    const r = w.tmRun(spin, 'aa', 500);
    s.ok('a repeated configuration is called looping, not "gave up"', r.verdict === 'looping', r.verdict);
  }

  s.ok('two instructions for the same state and symbol are refused',
    w.tmParse(['start: q0', 'accept: qa', 'q0 a q0 a >', 'q0 a q0 b <'].join('\n')).ok === false);

  /* ---------------- the pumping lemma ---------------- */

  // The count of legal splits depends only on p, which is the thing students
  // get wrong when they beat one split and stop.
  [2, 3, 4, 5].forEach(p => {
    s.ok(`p = ${p} allows ${p * (p + 1) / 2} splits`,
      w.pumpSplits('a'.repeat(p + 2), p).length === p * (p + 1) / 2);
  });

  Object.keys(w.PUMP_LANGS).forEach(key => {
    const L = w.PUMP_LANGS[key];
    const robust = w.pumpRobust(L.inL, L.hint, 6, 4);
    // Winnable exactly when the language is not regular. Both directions
    // matter: the two regular languages must be unwinnable, or the tool
    // would be teaching the converse of the lemma, which is false.
    s.ok(`${L.label}: ${L.regular ? 'regular, so unwinnable' : 'not regular, so winnable'}`,
      robust.wins === !L.regular,
      robust.fails.length ? `p=${robust.fails[0].p}: ${robust.fails[0].why}` : 'won when it should not');
  });

  {
    const a = w.pumpAnalyse(w.PUMP_LANGS.anbn.inL, 'aaaabbbb', 4, 4);
    s.ok('every split of a⁴b⁴ under p=4 can be pumped out', a.wins);
    s.ok('and the opponent still has a best try to show', !!w.pumpAdversary(a).split);
  }

  {
    // The regular control. If this ever "wins", the tool has started proving
    // something false.
    const a = w.pumpAnalyse(w.PUMP_LANGS.evenLen.inL, 'abababab', 4, 6);
    s.ok('the regular language cannot be beaten', !a.wins);
    s.ok('and some split visibly survives', a.survivors.length > 0);
  }

  /* ================================================================
     TOPIC 02 — complexity

     The reduction is the interesting thing to test here, because it
     is a theorem rather than a value: SAT <=p CLIQUE claims that F is
     satisfiable exactly when G_F has a clique of size k. Both sides
     are computed independently, so the claim can be checked by
     running it on formulas rather than by trusting the construction.
     ================================================================ */

  /* ---------------- truth tables and normal forms ---------------- */

  {
    // The formula worked through in the lecture slides, with its column
    // of eight values, the rows its DNF is read from, and the rows its
    // CNF rules out. All three are published, so all three are pinned.
    const p = w.fmParse('(P | ~R) -> ~(~Q | R)');
    s.ok('the worked formula parses', p.ok, p.error);

    const t = w.fmTable(p.ast);
    s.same('its columns are P, Q, R', t.vars, ['P', 'Q', 'R']);
    s.is('with 2^3 rows', t.rows.length, 8);
    s.is('and the published column of values',
      t.rows.map(r => (r.value ? 'T' : 'F')).join(''), 'FTFFTTTF');

    const dnf = w.fmDnf(t);
    s.same('the DNF comes off rows 2, 5, 6, 7', dnf.rows, [2, 5, 6, 7]);
    s.is('as four conjunctions', dnf.terms.length, 4);
    s.is('reading (P ∧ Q ∧ ¬R) ∨ (¬P ∧ Q ∧ R) ∨ (¬P ∧ Q ∧ ¬R) ∨ (¬P ∧ ¬Q ∧ R)',
      w.fmDnfShow(dnf.terms),
      '(P ∧ Q ∧ ¬R) ∨ (¬P ∧ Q ∧ R) ∨ (¬P ∧ Q ∧ ¬R) ∨ (¬P ∧ ¬Q ∧ R)');

    const cnf = w.fmCnf(t);
    s.same('the CNF rules out rows 1, 3, 4, 8', cnf.rows, [1, 3, 4, 8]);
    s.is('reading (¬P ∨ ¬Q ∨ ¬R) ∧ (¬P ∨ Q ∨ ¬R) ∧ (¬P ∨ Q ∨ R) ∧ (P ∨ Q ∨ R)',
      w.fmCnfShow(cnf.clauses),
      '(¬P ∨ ¬Q ∨ ¬R) ∧ (¬P ∨ Q ∨ ¬R) ∧ (¬P ∨ Q ∨ R) ∧ (P ∨ Q ∨ R)');

    const agree = w.fmAgree(p.ast, dnf.terms, cnf.clauses);
    s.ok('formula, DNF and CNF agree on every assignment', agree.ok,
      agree.first ? JSON.stringify(agree.first) : '');
  }

  {
    // The slides' second formula is false on all eight rows.
    const p = w.fmParse('~(P -> Q) & ~(P | ~R)');
    s.ok('the second worked formula parses', p.ok, p.error);
    const t = w.fmTable(p.ast);
    s.is('and is false on all eight rows',
      t.rows.map(r => (r.value ? 'T' : 'F')).join(''), 'FFFFFFFF');
    s.ok('so it is unsatisfiable', w.fmSat(p.ast).sat === false);
    s.is('its DNF is a contradiction', w.fmDnfShow(w.fmDnf(t).terms), '⊥');
    s.is('and its CNF has a clause for every row', w.fmCnf(t).clauses.length, 8);
  }

  {
    // Implication is right-associative, and the two bracketings must differ.
    const val = src => w.fmTable(w.fmParse(src).ast).rows.map(r => r.value).join('');
    s.is('P->Q->R is read as P->(Q->R)', val('P->Q->R'), val('P->(Q->R)'));
    s.ok('and is not the same as (P->Q)->R', val('P->Q->R') !== val('(P->Q)->R'));
    s.ok('a tautology has no false rows', w.fmCnf(w.fmTable(w.fmParse('P | ~P').ast)).clauses.length === 0);
    s.is('so its CNF is ⊤', w.fmCnfShow(w.fmCnf(w.fmTable(w.fmParse('P | ~P').ast)).clauses), '⊤');
  }

  {
    // Every formula round-trips through its own printed form.
    const srcs = ['P&Q|R', 'P|Q&R', '~P&Q', '(P->Q)->R', '~(P|Q)&R', '(P|~R)->~(~Q|R)'];
    let bad = 0;
    srcs.forEach(src => {
      const a = w.fmParse(src);
      const b = w.fmParse(w.fmShow(a.ast));
      if (!b.ok) { bad++; return; }
      const va = w.fmTable(a.ast).rows.map(r => r.value).join('');
      const vb = w.fmTable(b.ast).rows.map(r => r.value).join('');
      if (va !== vb) bad++;
    });
    s.is(`all ${srcs.length} formulas survive being printed and reparsed`, bad, 0);
  }

  /* ---------------- SAT <=p CLIQUE ---------------- */

  {
    // The graph the slides build, and the three 3-cliques they highlight.
    const F = w.fmParse('(P | ~Q | R) & (~P | ~Q | ~R) & (P | Q | ~R)');
    const cl = w.fmClauses(F.ast);
    s.ok('the slides\' CNF yields three clauses', cl.ok && cl.clauses.length === 3, cl.error);

    const g = w.rdBuild(cl.clauses);
    s.is('the graph has nine vertices', g.vertices.length, 9);
    s.is('and k is the clause count', g.k, 3);
    s.same('the vertices are labelled by clause',
      g.vertices.map(v => v.label),
      ['P₁', '¬Q₁', 'R₁', '¬P₂', '¬Q₂', '¬R₂', 'P₃', 'Q₃', '¬R₃']);
    // 3 clause-pairs x 3 x 3 = 27 cross-clause pairs, less 6 complementary ones.
    s.is('and it has 21 edges', g.edges.length, 21);

    const at = {};
    g.vertices.forEach(v => { at[v.label] = v.i; });
    [['P₁', 'Q₃', '¬R₂'], ['¬Q₁', '¬R₃', '¬R₂'], ['R₁', 'P₃', '¬Q₂']].forEach(set => {
      const idx = set.map(l => at[l]);
      s.ok(`the published clique {${set.join(', ')}} really is one`, w.rdIsClique(g, idx));
      s.ok('  and it yields an assignment satisfying F', w.rdCliqueToModel(g, idx).satisfies);
    });

    const chk = w.rdCheck(cl.clauses);
    s.ok('the formula is satisfiable', chk.sat);
    s.ok('the graph has a clique of size 3', chk.clique !== null);
    s.ok('both directions of the reduction close', chk.agree && chk.sound);
  }

  {
    // Two vertices in the same clause are never joined, even when they are
    // the same literal; complementary literals are never joined, even across
    // clauses. Both halves of the edge rule, checked separately.
    const taut = w.rdBuild([[{ v: 'P', neg: false }, { v: 'P', neg: true }], [{ v: 'Q', neg: false }]]);
    s.ok('P₁ and ¬P₁ share a clause, so they are not joined', taut.adj[0][1] === false);
    s.ok('but P₁ and Q₂ are', taut.adj[0][2] === true);
    const opp = w.rdBuild([[{ v: 'P', neg: false }], [{ v: 'P', neg: true }]]);
    s.ok('P₁ and ¬P₂ are complementary, so they are not joined', opp.adj[0][1] === false);
  }

  {
    // The theorem, over every three-clause two-variable formula there is.
    // No randomness: the clauses are all 1- and 2-literal clauses over P, Q,
    // and all 10^3 ordered triples of them are tried.
    const lits = [{ v: 'P', neg: false }, { v: 'P', neg: true },
                  { v: 'Q', neg: false }, { v: 'Q', neg: true }];
    const clauses = lits.map(l => [l]);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) clauses.push([lits[i], lits[j]]);

    let n = 0, sat = 0, unsat = 0, disagreed = 0, unsound = 0, first = null;
    for (const a of clauses) for (const b of clauses) for (const c of clauses) {
      const F = [a, b, c];
      const r = w.rdCheck(F);
      n++;
      r.sat ? sat++ : unsat++;
      if (!r.agree) { disagreed++; if (!first) first = w.fmCnfShow(F); }
      if (!r.sound) unsound++;
    }
    s.is(`the reduction is tested on all ${n} three-clause two-variable formulas`, n, 1000);
    s.ok(`and both answers arise (${sat} satisfiable, ${unsat} not), so the test is not vacuous`,
      sat > 0 && unsat > 0);
    s.is('F is satisfiable exactly when G_F has a k-clique — no disagreements',
      disagreed, 0, first ? `first: ${first}` : '');
    s.is('and every clique round-trips to a model that satisfies F', unsound, 0);
  }

  /* ---------------- cliques and Hamiltonian cycles ---------------- */

  {
    const dod = w.gphPetersen(10, 2);          // GP(10,2) is the dodecahedron
    s.is('the dodecahedron has 20 vertices', dod.n, 20);
    s.is('and 30 edges', dod.edges.length, 30);
    s.ok('and is 3-regular', dod.deg.every(d => d === 3));
    const cyc = w.gphHamCycle(dod);
    s.ok('it has a Hamiltonian cycle', cyc.cycle !== null && !cyc.capped);
    s.ok('and the cycle verifies', w.gphIsCycle(dod, cyc.cycle));
    s.ok('no cheap argument rules one out', w.gphWhyNoCycle(dod) === null);
  }

  {
    const pet = w.gphPetersen(5, 2);           // GP(5,2) is the Petersen graph
    s.is('the Petersen graph has 10 vertices', pet.n, 10);
    s.is('and 15 edges', pet.edges.length, 15);
    const cyc = w.gphHamCycle(pet);
    s.ok('it has NO Hamiltonian cycle, and the search proves it', cyc.cycle === null && !cyc.capped);
    s.ok('but it does have a Hamiltonian path', w.gphHamPath(pet).path !== null);
    s.ok('and no one-line argument explains the difference', w.gphWhyNoCycle(pet) === null);
  }

  {
    // The parity argument: a cycle in a bipartite graph alternates sides.
    const k34 = w.gphBiclique(3, 4);
    const why = w.gphWhyNoCycle(k34);
    s.ok('K(3,4) is ruled out by unequal sides', why && why.why === 'unequal sides',
      why ? why.why : 'no reason found');
    s.ok('and an exhaustive search agrees', w.gphHamCycle(k34).cycle === null);

    const k33 = w.gphBiclique(3, 3);
    s.ok('K(3,3) has equal sides, so the argument does not apply', w.gphWhyNoCycle(k33) === null);
    s.ok('and it really is Hamiltonian', w.gphIsCycle(k33, w.gphHamCycle(k33).cycle));
  }

  {
    const pend = w.gphParse('a b\nb c\nc a\nc d');
    s.ok('a vertex of degree 1 is spotted without searching',
      w.gphWhyNoCycle(pend.g).why.indexOf('degree') >= 0);
    const split = w.gphParse('a b\nb c\nc a\nx y\ny z\nz x');
    s.is('a disconnected graph is spotted too', w.gphWhyNoCycle(split.g).why, 'not connected');
  }

  {
    // K_n is the one graph whose largest clique is known without searching.
    let wrong = 0;
    for (let n = 3; n <= 7; n++) {
      const k = w.gphComplete(n);
      if (w.cqMax(k.adj, n).clique.length !== n) wrong++;
      if (k.edges.length !== (n * (n - 1)) / 2) wrong++;
    }
    s.is('the largest clique in K3…K7 is n every time', wrong, 0);
  }

  {
    // Clique search against brute force over all 2^n subsets, and the
    // impossibility proofs against the search that would have to agree.
    let seed = 4242;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    let cliqueWrong = 0, unsound = 0, reasons = 0, found = 0;
    for (let t = 0; t < 300; t++) {
      const n = 3 + Math.floor(rnd() * 5);
      const names = [], pairs = [];
      for (let i = 0; i < n; i++) names.push('v' + i);
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (rnd() < 0.5) pairs.push([a, b]);
      const g = w.gphMake(names, pairs);

      // brute force: the largest subset that is pairwise joined
      let best = 0;
      for (let mask = 0; mask < (1 << n); mask++) {
        const set = [];
        for (let i = 0; i < n; i++) if (mask & (1 << i)) set.push(i);
        if (set.length <= best) continue;
        let good = true;
        for (let i = 0; i < set.length && good; i++)
          for (let j = i + 1; j < set.length; j++) if (!g.adj[set[i]][set[j]]) { good = false; break; }
        if (good) best = set.length;
      }
      const mine = w.cqMax(g.adj, g.n);
      if (mine.clique.length !== best || !w.cqIs(g.adj, mine.clique)) cliqueWrong++;

      const reason = w.gphWhyNoCycle(g), cyc = w.gphHamCycle(g);
      if (reason) reasons++;
      if (cyc.cycle) found++;
      if (reason && cyc.cycle) unsound++;                       // claimed impossible, yet found
      if (cyc.cycle && !w.gphIsCycle(g, cyc.cycle)) unsound++;  // found one that is not a cycle
    }
    s.is('clique search agrees with brute force on 300 random graphs', cliqueWrong, 0);
    s.ok(`both outcomes occur (${reasons} impossibility proofs, ${found} cycles found)`,
      reasons > 0 && found > 0);
    s.is('and no impossibility proof was ever given for a graph that has a cycle', unsound, 0);
  }

  /* ---------------- growth rates ---------------- */

  {
    const ladder = w.gwLadder().map(l => l.show);
    s.same('the ladder sorts into the lectured order', ladder,
      ['1', 'log n', '√n', 'n', 'n log n', 'n²', 'n³', '2ⁿ', 'n!']);

    // The symbolic ordering has to match the arithmetic at a decent n.
    const L = w.gwLadder();
    let inversions = 0;
    for (let i = 0; i < L.length - 1; i++) if (L[i].f(60) >= L[i + 1].f(60)) inversions++;
    s.is('and each rung really is smaller than the next at n = 60', inversions, 0);
  }

  {
    const cases = [
      ['3n^2 + 500n + 9000', 'n^2', 'Theta'],
      ['n^2', '3n^2 + 500n + 9000', 'Theta'],
      ['1000000', '1', 'Theta'],
      ['n', 'n^2', 'O'],
      ['sqrt n', 'n', 'O'],
      ['log n', 'sqrt n', 'O'],
      ['n log n', 'n^2', 'O'],
      ['n^2', 'n', 'Omega'],
      ['n log n', 'n', 'Omega'],
      ['2^n', 'n^3', 'Omega'],
      ['n!', '2^n', 'Omega'],
    ];
    let wrong = 0, firstBad = '';
    cases.forEach(([a, b, want]) => {
      const fa = w.gwParse(a), fb = w.gwParse(b);
      if (!fa.ok || !fb.ok) { wrong++; return; }
      const got = w.gwCompare(fa, fb).verdict;
      if (got !== want) { wrong++; if (!firstBad) firstBad = `${a} vs ${b}: got ${got}, want ${want}`; }
    });
    s.is(`all ${cases.length} O/Ω/Θ verdicts are right`, wrong, 0, firstBad);
  }

  {
    // "log n" must not be read as log × n, nor "sqrt n" as √n × n.
    s.ok('log n is slower than n', w.gwCompare(w.gwParse('log n'), w.gwParse('n')).verdict === 'O');
    s.ok('sqrt n is slower than n', w.gwCompare(w.gwParse('sqrt n'), w.gwParse('n')).verdict === 'O');
    s.ok('but n log n is faster', w.gwCompare(w.gwParse('n log n'), w.gwParse('n')).verdict === 'Omega');

    // The headline example: the ratio has to collapse onto the coefficient.
    const r = w.gwCompare(w.gwParse('3n^2 + 500n + 9000'), w.gwParse('n^2'), 1024);
    s.ok('the ratio starts far above 3', r.samples[0].ratio > 1000, r.samples[0].ratio);
    s.ok('and has settled near 3 by n = 1024',
      Math.abs(r.samples[r.samples.length - 1].ratio - 3) < 0.6,
      r.samples[r.samples.length - 1].ratio);
    s.ok('the O witness is a genuine finite constant', isFinite(r.cO) && r.cO > 3);

    s.ok('gibberish is rejected', w.gwParse('n^2 + wibble').ok === false);
    s.ok('and so is an empty term', w.gwParse('n^2 + ').ok === false);
  }

  /* ================================================================
     TOPIC 03 — recurrences, induction, divide-and-conquer

     Two things are worth testing here that the earlier topics did not
     have. First, the published tables: the lecture slides tabulate
     T(n) for Hanoi and for merge sort, so those sequences are pinned.
     Second, the inductive step, which is a stronger claim than "the
     values agree" -- and the tests below include a formula that
     matches values for a while and still fails the step, so the
     difference is not hypothetical.
     ================================================================ */

  /* ---------------- recurrences ---------------- */

  {
    const r = w.rcBuild({ 1: 1 }, '2T(n-1) + 1');
    s.ok('the Hanoi recurrence builds', r.ok, r.error);
    s.is('and gives the published 1, 3, 7, 15, 31, 63, 127, 255',
      [1, 2, 3, 4, 5, 6, 7, 8].map(n => r.T(n)).join(','), '1,3,7,15,31,63,127,255');

    // The slide states 2T(n-1) - 1, which is constant at 1 and cannot be
    // 2^n - 1. The proof on the following slide uses + 1. Pinned so the
    // distinction stays visible.
    const minus = w.rcBuild({ 1: 1 }, '2T(n-1) - 1');
    s.ok('2T(n-1) − 1 is constant at 1, so it is not 2^n − 1',
      [1, 2, 3, 4, 5].every(n => minus.T(n) === 1));
  }

  {
    const r = w.rcBuild({ 1: 1 }, 'T(n-1) + n');
    s.is('T(n-1)+n with T(1)=1 gives the triangular numbers',
      [1, 2, 3, 4, 5].map(n => r.T(n)).join(','), '1,3,6,10,15');
    const two = w.rcBuild({ 1: 2 }, 'T(n-1) + n');
    s.ok('and with T(1)=2 it does not match (n²+n)/2', two.T(3) !== 6, two.T(3));
  }

  {
    const approx = w.rcBuild({ 1: 1 }, '2T(ceil(n/2)) + n');
    s.is('the merge-sort approximation gives the table printed in the notes',
      [1, 2, 3, 4, 5, 6, 7, 8].map(n => approx.T(n)).join(','), '1,4,11,12,27,28,31,32');
    const exact = w.rcBuild({ 1: 1 }, 'T(floor(n/2)) + T(ceil(n/2)) + n');
    s.is('while the exact recurrence gives a different sequence',
      [1, 2, 3, 4, 5, 6, 7, 8].map(n => exact.T(n)).join(','), '1,4,8,12,17,22,27,32');
    s.ok('the two agree at powers of two and nowhere else in 1..8',
      [1, 2, 4, 8].every(n => approx.T(n) === exact.T(n)) &&
      [3, 5, 6, 7].every(n => approx.T(n) !== exact.T(n)));
  }

  {
    const fib = w.rcBuild({ 0: 0, 1: 1 }, 'T(n-1) + T(n-2)');
    s.is('two base cases work, and give Fibonacci',
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => fib.T(n)).join(','),
      '0,1,1,2,3,5,8,13,21,34,55');
  }

  {
    // A recurrence whose argument never shrinks must be reported, not
    // allowed to exhaust the stack and take the page down.
    const spin = w.rcBuild({ 1: 1 }, '2T(n) + 1');
    const v = spin.T(5);
    s.ok('a recurrence that never reaches its base case is caught',
      !Number.isFinite(v) && /never reached a base case|too deeply nested/.test(spin.failed() || ''),
      spin.failed());
  }

  {
    s.ok('a closed form may not mention T', w.rcCompile('2T(n-1)', false).ok === false);
    s.ok('and unreadable base cases are rejected', w.rcParseBase('T one = 1').ok === false);
  }

  /* ---------------- the inductive step ---------------- */

  {
    const i = w.rcInduction({ 1: 1 }, '2T(n-1) + 1', '2^n - 1', '=', 1, 40);
    s.ok('Hanoi: the base case holds', i.base.every(b => b.ok));
    s.ok('and the step survives substitution for 40 values of k', i.allOk,
      JSON.stringify(i.steps.find(x => !x.ok)));
  }

  {
    const good = w.rcInduction({ 1: 1 }, 'T(n-1) + n', '(n^2 + n)/2', '=', 1, 40);
    s.ok('(n²+n)/2 survives the step with T(1)=1', good.allOk);

    // The instructive failure: a bad base case with a perfect step.
    const bad = w.rcInduction({ 1: 2 }, 'T(n-1) + n', '(n^2 + n)/2', '=', 1, 40);
    s.ok('with T(1)=2 the base case fails', !bad.base[0].ok);
    s.ok('but the step still holds at every k — so the base is the culprit',
      bad.steps.every(x => x.ok));
  }

  {
    const i = w.rcInduction({ 1: 1 }, '2T(ceil(n/2)) + n', 'n*log2(n)', '>=', 1, 60);
    s.ok('strong induction: T(n) ≥ n log₂ n survives the step', i.allOk,
      JSON.stringify(i.steps.find(x => !x.ok)));
  }

  {
    // The point of substituting rather than comparing values: a formula can
    // agree on a stretch of values and still fail the step.
    const wrong = w.rcInduction({ 1: 1 }, '2T(n-1) + 1', 'n^2', '=', 1, 10);
    s.ok('a formula that is not the solution fails the step', !wrong.allOk);
    const r = w.rcBuild({ 1: 1 }, '2T(n-1) + 1');
    s.is('while the correct one agrees on values too', w.rcAgree(r, '2^n - 1', '=', 14).bad, 0);
  }

  /* ---------------- the Master Theorem ---------------- */

  {
    const sol = w.mtSolve(9, 3, 'sqrt((n+1)^5)');
    s.ok('lecture example 1 parses √((n+1)⁵)', sol.ok, sol.error);
    s.is('k = log₃(9) = 2', sol.kShown, 2);
    s.is('f ∈ Θ(n^2.5)', w.gwClassShow(sol.clsF), 'n²·⁵');
    s.is('Case 3', sol.caseNo, 3);
    s.is('T(n) = Θ(n^2.5)', sol.answer, 'Θ(n²·⁵)');
  }

  {
    const sol = w.mtSolve(2, 2, 'n');
    s.is('merge sort: k = 1', sol.kShown, 1);
    s.is('Case 2', sol.caseNo, 2);
    s.is('T(n) = Θ(n log n)', sol.answer, 'Θ(n log n)');
  }

  {
    const sol = w.mtSolve(2, 3, 'log2(5n^2)');
    s.ok('lecture example 3 parses log₂(5n²)', sol.ok, sol.error);
    s.is('f ∈ Θ(log n)', w.gwClassShow(sol.clsF), 'log n');
    s.is('Case 1', sol.caseNo, 1);
    // The slide prints 1.5849 for log_3(2). That is log_2(3); the bases are
    // swapped. The answer happens to survive, which is exactly why it is
    // worth pinning both numbers.
    s.ok('k = log₃(2) ≈ 0.6309', Math.abs(sol.k - 0.6309) < 1e-3, sol.k);
    s.ok('and log₂(3) ≈ 1.5849 is the other one, not k', Math.abs(sol.kWrong - 1.5849) < 1e-3,
      sol.kWrong);
  }

  {
    // k = 0 must not render as "Theta(1 log n)".
    s.is('binary search comes out as Θ(log n)', w.mtSolve(1, 2, '1').answer, 'Θ(log n)');
    s.is('Strassen falls in Case 1', w.mtSolve(7, 2, 'n^2').caseNo, 1);
  }

  {
    // The theorem's verdict against the recurrence's own numbers.
    const cases = [[9, 3, 'sqrt((n+1)^5)'], [2, 2, 'n'], [2, 3, 'log2(5n^2)'],
                   [8, 2, 'n^2'], [4, 2, 'n^2'], [3, 2, 'n'], [1, 2, '1']];
    let bad = 0, first = '';
    cases.forEach(([a, b, f]) => {
      const sol = w.mtSolve(a, b, f);
      // Guard rather than assume. A regression that makes mtSolve fail would
      // otherwise throw here and take the remaining assertions in this file
      // down with it — one broken thing should produce one failure, not a
      // dead suite.
      if (!sol.ok) { bad++; if (!first) first = `a=${a} b=${b} f=${f}: ${sol.error}`; return; }
      const num = w.mtNumeric(a, b, sol.fFn, 4096);
      const agr = w.mtAgrees(sol, num.estimate);
      if (!agr.ok) { bad++; if (!first) first = `a=${a} b=${b} f=${f}: measured ${num.estimate}, want ${agr.want}`; }
    });
    s.is(`the theorem agrees with the unfolded recurrence on all ${cases.length} cases`, bad, 0, first);
  }

  s.ok('a < 1 is rejected', w.mtSolve(0, 2, 'n').ok === false);
  s.ok('b < 2 is rejected', w.mtSolve(2, 1, 'n').ok === false);

  /* ---------------- the algorithms themselves ---------------- */

  {
    let bad = 0, first = '';
    for (let n = 1; n <= 12; n++) {
      const run = w.hanoiRun(n);
      const chk = w.hanoiCheck(n, run.moves);
      if (!chk.ok) { bad++; if (!first) first = `n=${n}: ${chk.why}`; continue; }
      if (run.count !== Math.pow(2, n) - 1) { bad++; if (!first) first = `n=${n}: ${run.count} moves`; }
      if (run.count !== w.hanoiRecurrence(n)) { bad++; if (!first) first = `n=${n}: recurrence disagrees`; }
    }
    s.is('Hanoi is legal and takes exactly 2ⁿ−1 moves for n = 1..12', bad, 0, first);

    // An illegal sequence must be rejected, or the check above proves nothing.
    const run3 = w.hanoiRun(3);
    const tampered = run3.moves.slice();
    tampered[1] = { disc: 3, from: 0, to: 2 };
    s.ok('and a tampered move sequence is rejected', w.hanoiCheck(3, tampered).ok === false);
  }

  {
    let bad = 0, first = '';
    for (let n = 1; n <= 40; n++) {
      const input = w.msSample(n, 500 + n);
      const r = w.msRun(input);
      const chk = w.msCheck(input, r.sorted);
      if (!chk.ok) { bad++; if (!first) first = `n=${n}: ${chk.why}`; continue; }
      // The recurrence charges n per merge level and 1 per leaf, so the
      // elements that actually pass through a merge come to T(n) - n.
      if (r.merged !== w.msRecurrence(n, 'exact') - n) {
        bad++;
        if (!first) first = `n=${n}: merged ${r.merged}, T(n)-n = ${w.msRecurrence(n, 'exact') - n}`;
      }
      if (r.comparisons > r.merged) { bad++; if (!first) first = `n=${n}: compared more than it merged`; }
    }
    s.is('merge sort sorts, and its merged-element count is T(n) − n, for n = 1..40', bad, 0, first);

    s.ok('an unsorted output is rejected', w.msCheck([3, 1, 2], [1, 3, 2]).ok === false);
    s.ok('and so is one that is not a rearrangement', w.msCheck([3, 1, 2], [1, 2, 2]).ok === false);
  }

  /* ---------------- Topic 4 · graphs ---------------- */
  {
    const g = w.grParse(w.GR_PRESETS.search);
    s.ok('the lecture search graph parses', g.ok, g.error);
    s.is('9 vertices', g.nV, 9);
    s.is('13 edges', g.nE, 13);
    s.ok('and is read as directed', g.directed === true);

    // ---- BFS, against the slide ----
    const b = w.grBfs(g, 'A');
    s.is('BFS from A reproduces the lecture visit order',
      b.order.join(' '), 'A B E G C F H D I');
    s.is('and every vertex is reached', b.reached, 9);
    s.is('D sits at distance 3', b.dist.D, 3);
    s.is('and B at distance 1', b.dist.B, 1);

    // BFS distances must BE shortest paths. Checked against a
    // completely separate computation: repeated edge relaxation.
    {
      const far = {};
      g.vertices.forEach(v => { far[v] = v === 'A' ? 0 : Infinity; });
      for (let i = 0; i < g.nV; i++) {
        g.edges.forEach(e => {
          if (far[e.u] + 1 < far[e.v]) far[e.v] = far[e.u] + 1;
          if (!g.directed && far[e.v] + 1 < far[e.u]) far[e.u] = far[e.v] + 1;
        });
      }
      const bad = g.vertices.filter(v => (b.dist[v] === undefined ? Infinity : b.dist[v]) !== far[v]);
      s.is('BFS distances agree with independent relaxation', bad.length, 0, bad.join(','));
    }

    // ---- DFS, against the slide's timestamps ----
    const d = w.grDfs(g, 'A');
    s.is('DFS stamps A 1/10/18/21, as the slide does', d.show('A'), '1/10/18/21');
    s.is('E 11/14/17', d.show('E'), '11/14/17');
    s.is('G 2/9', d.show('G'), '2/9');
    s.is('H 3/8', d.show('H'), '3/8');
    s.is('I 4/7', d.show('I'), '4/7');
    s.is('D 5/6', d.show('D'), '5/6');
    s.is('F 12/13', d.show('F'), '12/13');
    s.is('C 15/16', d.show('C'), '15/16');
    s.is('B 19/20', d.show('B'), '19/20');
    s.is('and the whole run takes 21 ticks', d.ticks, 21);

    // The stamps are not decoration: they have to be a consistent
    // schedule. Every number 1..t used exactly once, and a child's
    // whole interval nested inside its parent's.
    {
      const all = [];
      g.vertices.forEach(v => d.stamps[v].forEach(x => all.push(x)));
      all.sort((x, y) => x - y);
      const contiguous = all.length === d.ticks && all.every((x, i) => x === i + 1);
      s.ok('every tick from 1 to 21 is used exactly once', contiguous,
        `got ${all.length} stamps: ${all.join(',')}`);

      const lo = v => d.stamps[v][0], hi = v => d.stamps[v][d.stamps[v].length - 1];
      const bad = d.tree.filter(e => !(lo(e.u) < lo(e.v) && hi(e.v) < hi(e.u)));
      s.is('every child interval nests inside its parent', bad.length, 0,
        bad.map(e => `${e.u}->${e.v}`).join(','));
    }

    s.is('neighbour order changes the trace but not the vertex set',
      w.grDfs(g, 'A', 'listed').order.slice().sort().join(''),
      d.order.slice().sort().join(''));

    // A search only finds what its root reaches.
    s.is('from D, which has one way out, only D and its descendants are found',
      w.grBfs(g, 'D').order.join(' '), 'D');
    s.ok('and the rest are reported as missed', w.grBfs(g, 'D').missed.length === 8);

    s.ok('an unknown root is refused', w.grBfs(g, 'Z').ok === false);
    s.ok('a self-loop is refused', w.grParse('A > A').ok === false);
    s.ok('mixing > and - is refused', w.grParse('A > B\nB - C').ok === false);
    s.ok('a contradictory weight is refused', w.grParse('A - B:3\nB - A:5').ok === false);

    // The transpose must be an involution, and must reverse reachability.
    {
      const t = w.grTranspose(g), tt = w.grTranspose(t);
      const key = x => x.edges.map(e => e.u + e.v).sort().join(' ');
      s.is('transposing twice gives the original graph back', key(tt), key(g));
      let bad = 0;
      g.vertices.forEach(u => g.vertices.forEach(v => {
        if ((w.grReach(g, u).indexOf(v) >= 0) !== (w.grReach(t, v).indexOf(u) >= 0)) bad++;
      }));
      s.is('u reaches v in G exactly when v reaches u in G^T', bad, 0);
    }
  }

  /* ---------------- Topic 4 · spanning trees ---------------- */
  {
    const g = w.grParse(w.GR_PRESETS.mst);
    s.ok('the lecture MST graph parses', g.ok, g.error);
    s.ok('as undirected and weighted', g.directed === false && g.weighted === true);
    s.is('14 edges', g.nE, 14);

    const k = w.mstKruskal(g), p = w.mstPrim(g, 'A');
    s.is('Kruskal totals 37, as the slide says', k.weight, 37);
    s.is('Prim totals 37 too', p.weight, 37);
    s.ok('Kruskal returns a genuine spanning tree', w.mstIsTree(g, k.tree).ok,
      w.mstIsTree(g, k.tree).why.join(' '));
    s.ok('and so does Prim', w.mstIsTree(g, p.tree).ok, w.mstIsTree(g, p.tree).why.join(' '));

    // The claim that matters, and the reason both are computed:
    // greedy really is optimal here, checked by exhaustion.
    const brute = w.mstBrute(g);
    s.ok('brute force over all spanning trees succeeds', brute.ok, brute.error);
    s.is('the graph has 662 spanning trees', brute.spanningTrees, 662);
    s.is('whose minimum weight is 37', brute.weight, 37);
    s.is('and exactly two of them achieve it', brute.minimumTrees, 2);

    // Which is why the two algorithms can disagree without either
    // being wrong. Pinned, because it is the topic's best lesson.
    const show = t => w.mstSortEdges(t).map(e => [e.u, e.v].sort().join('') + ':' + e.w).join(' ');
    s.is('Kruskal takes A–H at the weight-8 tie',
      show(k.tree), 'GH:1 CI:2 FG:2 AB:4 CF:4 CD:7 AH:8 DE:9');
    s.is('and the lecture Prim trace takes B–C instead, for the same total',
      show(w.mstPrim(g, 'A', 'late').tree), 'GH:1 CI:2 FG:2 AB:4 CF:4 CD:7 BC:8 DE:9');
    s.ok('the two trees really are different',
      show(k.tree) !== show(w.mstPrim(g, 'A', 'late').tree));

    // Every tie-break, and every root, must still give weight 37.
    {
      let bad = 0, first = '';
      ['alpha', 'late', 'early'].forEach(tie => {
        g.vertices.forEach(r => {
          const t = w.mstPrim(g, r, tie);
          if (t.weight !== 37) { bad++; if (!first) first = `root ${r}, tie ${tie}: ${t.weight}`; }
          if (!w.mstIsTree(g, t.tree).ok) { bad++; if (!first) first = `root ${r}, tie ${tie}: not a tree`; }
        });
      });
      s.is('Prim gives a spanning tree of weight 37 from every root, under every tie-break', bad, 0, first);
    }

    // Random graphs: greedy must match brute force every time.
    {
      let bad = 0, first = '', tested = 0;
      let seed = 20240904;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let trial = 0; trial < 120; trial++) {
        const n = 4 + Math.floor(rnd() * 3);
        const names = 'ABCDEFG'.slice(0, n).split('');
        const lines = [];
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            if (rnd() < 0.55) lines.push(names[i] + ' - ' + names[j] + ':' + (1 + Math.floor(rnd() * 9)));
          }
        }
        const rg = w.grParse(lines.join('\n'));
        if (!rg.ok || rg.nV !== n || !w.grConnected(rg)) continue;
        tested++;
        const rk = w.mstKruskal(rg), rp = w.mstPrim(rg, names[0]);
        const rb = w.mstBrute(rg);
        if (!rb.ok) continue;
        if (rk.weight !== rb.weight || rp.weight !== rb.weight) {
          bad++;
          if (!first) first = `${lines.join(';')} — Kruskal ${rk.weight}, Prim ${rp.weight}, true min ${rb.weight}`;
        }
        if (!w.mstIsTree(rg, rk.tree).ok || !w.mstIsTree(rg, rp.tree).ok) {
          bad++; if (!first) first = `${lines.join(';')} — not a spanning tree`;
        }
      }
      s.ok('enough random connected graphs were generated', tested > 40, `only ${tested}`);
      s.is('on every one, both greedy algorithms hit the true minimum', bad, 0, first);
    }

    // The tree checker has to reject things, or it proves nothing.
    s.ok('a tree with too few edges is rejected',
      w.mstIsTree(g, w.mstKruskal(g).tree.slice(1)).ok === false);
    s.ok('an edge not in the graph is rejected',
      w.mstIsTree(g, [{ u: 'A', v: 'E', w: 1 }]).ok === false);
    s.ok('a directed graph is refused', w.mstKruskal(w.grParse('A > B')).ok === false);
  }

  /* ---------------- Topic 4 · topological sort and SCC ---------------- */
  {
    const dress = w.grParse(w.GR_PRESETS.dress);
    const t = w.tsSort(dress);
    s.ok('the dressing DAG sorts', t.ok, t.error);
    s.ok('and the order it returns is valid by the definition', t.check.ok,
      JSON.stringify(t.check.backwards));
    s.is('all nine garments appear', t.order.length, 9);

    // Not unique -- so what is tested is validity, under every
    // setting, rather than one remembered answer.
    {
      let bad = 0, first = '';
      ['stack', 'listed'].forEach(mode => {
        dress.vertices.forEach(start => {
          const r = w.tsSort(dress, { mode: mode, start: [start] });
          if (!r.ok || !r.check.ok) { bad++; if (!first) first = `${mode} from ${start}`; }
        });
      });
      s.is('every starting vertex and neighbour order gives a valid topological sort', bad, 0, first);
    }

    s.ok('an order the student might type is accepted when correct',
      w.tsCheck(dress, ['socks', 'underwear', 'trousers', 'shoes', 'watch',
                        'shirt', 'belt', 'tie', 'jacket']).ok);
    s.ok('and rejected when an edge points backwards',
      w.tsCheck(dress, ['jacket', 'socks', 'underwear', 'trousers', 'shoes', 'watch',
                        'shirt', 'belt', 'tie']).ok === false);
    s.ok('and rejected when a vertex is missing',
      w.tsCheck(dress, ['socks', 'underwear']).ok === false);

    // A cyclic graph must be refused, with a witness.
    const cyc = w.grParse(w.GR_PRESETS.cyclic);
    const bad = w.tsSort(cyc);
    s.ok('a cyclic graph has no topological sort', bad.ok === false);
    s.ok('and the cycle is named rather than merely denied', Array.isArray(bad.cycle) && bad.cycle.length === 3,
      JSON.stringify(bad.cycle));
    {
      // The witness must actually be a cycle in the graph.
      const c = bad.cycle;
      let realCycle = true;
      for (let i = 0; i < c.length; i++) {
        const from = c[i], to = c[(i + 1) % c.length];
        if (w.grNbrs(cyc, from).indexOf(to) < 0) realCycle = false;
      }
      s.ok('and every step of the witness is a real edge', realCycle, c.join('->'));
    }
    s.ok('a DAG is recognised', w.tsIsDag(w.grParse(w.GR_PRESETS.dag)));
    s.ok('and a cyclic graph is not', w.tsIsDag(cyc) === false);

    // ---- SCC ----
    const g = w.grParse(w.GR_PRESETS.scc);
    s.is('the lecture SCC graph has 10 vertices', g.nV, 10);
    const sc = w.sccFind(g);
    const asText = x => x.components.map(c => '{' + c.join(',') + '}').join(' ');
    s.is('the components are the four on the slide',
      asText(sc), '{A,B,C,D} {E,F,H} {G} {I,J}');
    s.ok('and they satisfy the definition, checked by plain reachability',
      w.sccCheck(g, sc.components).ok, w.sccCheck(g, sc.components).why.join(' '));

    // The deck's own trace, reproduced exactly.
    s.is('the lecture settings reproduce its finishing order',
      w.tsFinish(g, { mode: 'listed', start: ['F', 'C'] }).order.join(' '),
      'C B A D F H G I J E');

    // The answer must not depend on the trace.
    {
      let bad = 0, first = '';
      ['stack', 'listed'].forEach(mode => {
        g.vertices.forEach(start => {
          const r = w.sccFind(g, { mode: mode, start: [start] });
          if (asText(r) !== asText(sc)) { bad++; if (!first) first = `${mode} from ${start}: ${asText(r)}`; }
        });
      });
      s.is('every starting vertex and neighbour order gives the same components', bad, 0, first);
    }

    // The theorem, on this instance and on many random ones.
    const cd = w.sccCondense(g, sc.components);
    s.ok('the component graph is acyclic', cd.acyclic);
    s.is('with one vertex per component', cd.nV, 4);

    {
      let bad = 0, first = '', tested = 0, seed = 77777;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let trial = 0; trial < 250; trial++) {
        const n = 3 + Math.floor(rnd() * 5);
        const names = 'ABCDEFG'.slice(0, n).split('');
        const lines = [];
        names.forEach(u => {
          const outs = names.filter(v => v !== u && rnd() < 0.35);
          lines.push(outs.length ? u + ' > ' + outs.join(' ') : u);
        });
        // A graph of bare names carries no > or -, so its directedness
        // has to be stated rather than inferred.
        const rg = w.grParse(lines.join('\n'), { directed: true });
        if (!rg.ok) continue;
        const rs = w.sccFind(rg);
        if (!rs.ok) { bad++; if (!first) first = lines.join(';') + ' — ' + rs.error; continue; }
        tested++;
        const chk = w.sccCheck(rg, rs.components);
        if (!chk.ok) { bad++; if (!first) first = lines.join(';') + ' — ' + chk.why[0]; }
        const rc = w.sccCondense(rg, rs.components);
        if (!rc.acyclic) { bad++; if (!first) first = lines.join(';') + ' — condensation has a cycle'; }
        // Every vertex in exactly one component.
        const total = rs.components.reduce((a, c) => a + c.length, 0);
        if (total !== rg.nV) { bad++; if (!first) first = lines.join(';') + ' — components do not partition V'; }
        // A DAG must have all-singleton components.
        if (w.tsIsDag(rg) && rs.components.some(c => c.length > 1)) {
          bad++; if (!first) first = lines.join(';') + ' — a DAG got a component of size > 1';
        }
      }
      s.ok('enough random digraphs were generated', tested > 200, `only ${tested}`);
      s.is('over ' + tested + ' random digraphs: components satisfy the definition, partition V, ' +
           'and condense to a DAG', bad, 0, first);
    }

    s.ok('an undirected graph is refused', w.sccFind(w.grParse('A - B')).ok === false);
  }

  /* ---------------- Topic 5 · greedy SAT ---------------- */
  {
    const p = w.stParse(w.ST_PRESETS.greedy);
    s.ok('the lecture greedy example parses', p.ok, p.error);
    s.is('7 clauses', p.nC, 7);
    s.is('over P, Q, R', p.vars.join(''), 'PQR');

    // The eight hypercube scores on the slide, one assertion each,
    // so a wrong one names itself.
    const land = w.gdLandscape(p.clauses, p.vars);
    s.ok('the landscape is computable', land.ok, land.error);
    const at = (P, Q, R) => land.nodes.filter(n =>
      n.asg.P === P && n.asg.Q === Q && n.asg.R === R)[0].score;
    s.is('FFF scores 5', at(false, false, false), 5);
    s.is('TFF scores 6', at(true, false, false), 6);
    s.is('FTF scores 5', at(false, true, false), 5);
    s.is('FFT scores 5', at(false, false, true), 5);
    s.is('TTF scores 6', at(true, true, false), 6);
    s.is('TFT scores 5', at(true, false, true), 5);
    s.is('FTT scores 7 — every clause', at(false, true, true), 7);
    s.is('TTT scores 5', at(true, true, true), 5);

    // Scores must agree with a direct count, not just with each other.
    {
      let bad = 0;
      land.nodes.forEach(n => {
        const byHand = p.clauses.filter(c =>
          c.some(l => (n.asg[l.v] === true) !== l.neg)).length;
        if (byHand !== n.score) bad++;
      });
      s.is('every score matches a direct clause-by-clause count', bad, 0);
    }

    s.is('there are exactly two local maxima that are not solutions', land.traps.length, 2);
    s.is('and one satisfying assignment', land.solutions.length, 1);

    // The point of the whole section: greedy is wrong, from the very
    // start the lecture picks.
    const run = w.gdRun(p.clauses, p.vars, { P: true, Q: false, R: false });
    s.ok('greedy from the deck start returns False', run.verdict === false);
    s.ok('having stopped at a local maximum rather than run out of iterations',
      run.stuck === true && !run.capped,
      run.capped ? 'it hit the iteration cap — it is taking non-improving moves'
                 : 'it did not report being stuck');
    s.is('with a score of 6', run.score, 6);
    const truth = w.stBrute(p.clauses, p.vars);
    s.ok('but the formula is satisfiable', truth.sat);
    s.is('by exactly one assignment', truth.count, 1);
    s.is('namely P false, Q true, R true',
      [truth.model.P, truth.model.Q, truth.model.R].join(','), 'false,true,true');

    const survey = w.gdSurvey(p.clauses, p.vars);
    s.is('greedy fails from 4 of the 8 possible starts', survey.wrong, 4);

    // When greedy says True it must be telling the truth -- soundness
    // is the one property it does have, and it has to hold always.
    {
      let unsound = 0, first = '', seed = 991, tested = 0;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const vars = ['P', 'Q', 'R', 'S'];
      for (let t = 0; t < 400; t++) {
        const n = 3 + Math.floor(rnd() * 6), lines = [];
        for (let i = 0; i < n; i++) {
          const k = 1 + Math.floor(rnd() * 3), lits = [];
          for (let j = 0; j < k; j++) {
            lits.push((rnd() < 0.5 ? '~' : '') + vars[Math.floor(rnd() * 4)]);
          }
          lines.push(lits.join(' | '));
        }
        const f = w.stParse(lines.join('\n'));
        if (!f.ok) continue;
        tested++;
        const start = {};
        f.vars.forEach(v => { start[v] = rnd() < 0.5; });
        const r = w.gdRun(f.clauses, f.vars, start);
        // Sound: True must mean the final assignment really works.
        if (r.verdict && !w.stEval(f.clauses, r.asg).all) {
          unsound++; if (!first) first = lines.join(' ; ');
        }
        // And the score must never have gone down. A run that takes
        // sideways moves can circle forever, so hitting the cap is a
        // bug rather than bad luck: every step is a strict increase in
        // a quantity bounded by the clause count, so the number of
        // steps is bounded by the clause count too.
        if (r.capped) { unsound++; if (!first) first = lines.join(' ; ') + ' — hit the iteration cap'; }
        if (r.steps.length > f.nC + 2) {
          unsound++;
          if (!first) first = `${lines.join(' ; ')} — ${r.steps.length} steps for ${f.nC} clauses`;
        }
        for (let i = 1; i < r.steps.length; i++) {
          if (r.steps[i].score < r.steps[i - 1].score) {
            unsound++; if (!first) first = lines.join(' ; ') + ' — score decreased';
          }
        }
      }
      s.ok('enough random formulas were generated', tested > 300, `only ${tested}`);
      s.is('greedy is sound, never lowers its score, and always terminates within |C| steps',
        unsound, 0, first);
    }
  }

  /* ---------------- Topic 5 · DPLL ---------------- */
  {
    // Pure literals, against the slide.
    const pure = w.stParse(w.ST_PRESETS.pure);
    s.is('the deck pure-literal example gives P and ¬S',
      w.dpPure(pure.clauses).map(l => (l.neg ? '~' : '') + l.v).join(','), 'P,~S');

    // Unit propagation, against the slide, ending in the conflict the
    // deck displays but does not name.
    const unit = w.stParse(w.ST_PRESETS.unit);
    s.is('the deck unit example starts with ¬Q and R',
      w.dpUnits(unit.clauses).map(l => (l.neg ? '~' : '') + l.v).join(','), '~Q,R');
    const prop = w.dpPropagate(unit.clauses, {});
    s.ok('and propagation ends in a conflict', prop.conflict === true, prop.why);
    s.ok('naming S as the variable forced both ways', /\bS\b/.test(prop.why), prop.why);
    s.ok('so that clause set is unsatisfiable', w.stBrute(unit.clauses, unit.vars).sat === false);

    // Pure literal elimination must never conflict. That is its
    // defining property, so it is worth testing rather than assuming.
    {
      let bad = 0, first = '', seed = 31337, tested = 0;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const vars = ['P', 'Q', 'R', 'S'];
      for (let t = 0; t < 500; t++) {
        const n = 2 + Math.floor(rnd() * 6), lines = [];
        for (let i = 0; i < n; i++) {
          const k = 1 + Math.floor(rnd() * 3), lits = [];
          for (let j = 0; j < k; j++) lits.push((rnd() < 0.5 ? '~' : '') + vars[Math.floor(rnd() * 4)]);
          lines.push(lits.join(' | '));
        }
        const f = w.stParse(lines.join('\n'));
        if (!f.ok) continue;
        tested++;
        const pe = w.dpPureEliminate(f.clauses, {});
        if (pe.conflict) { bad++; if (!first) first = lines.join(' ; '); }
        // And it must preserve satisfiability.
        const before = w.stBrute(f.clauses, f.vars).sat;
        const after = w.stBrute(w.stSimplify(f.clauses, pe.asg), f.vars).sat;
        if (before !== after) { bad++; if (!first) first = lines.join(' ; ') + ' — changed the answer'; }
      }
      s.ok('enough formulas were generated', tested > 400, `only ${tested}`);
      s.is('pure literal elimination never conflicts and never changes the answer', bad, 0, first);
    }

    // DPLL against exhaustive search, under every combination of rules.
    {
      let bad = 0, first = '', seed = 5150, tested = 0;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const vars = ['P', 'Q', 'R', 'S'];
      for (let t = 0; t < 400; t++) {
        const n = 2 + Math.floor(rnd() * 7), lines = [];
        for (let i = 0; i < n; i++) {
          const k = 1 + Math.floor(rnd() * 3), lits = [];
          for (let j = 0; j < k; j++) lits.push((rnd() < 0.5 ? '~' : '') + vars[Math.floor(rnd() * 4)]);
          lines.push(lits.join(' | '));
        }
        const f = w.stParse(lines.join('\n'));
        if (!f.ok) continue;
        tested++;
        const want = w.stBrute(f.clauses, f.vars).sat;
        [[true, true], [true, false], [false, true], [false, false]].forEach(([pu, un]) => {
          const r = w.dpSolve(f.clauses, f.vars, { pure: pu, unit: un });
          if (!r.ok) { bad++; if (!first) first = lines.join(' ; ') + ' — ' + r.error; return; }
          if (r.sat !== want) {
            bad++;
            if (!first) first = `${lines.join(' ; ')} — pure=${pu} unit=${un} said ${r.sat}, truth ${want}`;
          }
          // A model returned must actually work.
          if (r.sat && !w.stEval(f.clauses, r.model).all) {
            bad++; if (!first) first = lines.join(' ; ') + ' — returned a model that fails';
          }
        });
      }
      s.ok('enough formulas were generated', tested > 300, `only ${tested}`);
      s.is('DPLL matches exhaustive search under all four rule settings, and every model verifies',
        bad, 0, first);
    }

    // The rules are an optimisation, not a correctness fix: turning
    // them off must never change the answer, only the effort.
    {
      const f = w.stParse(w.ST_PRESETS.greedy);
      const on = w.dpSolve(f.clauses, f.vars, { pure: true, unit: true });
      const off = w.dpSolve(f.clauses, f.vars, { pure: false, unit: false });
      s.is('the rules do not change the verdict', on.sat, off.sat);
      s.ok('but they do reduce the work', on.calls <= off.calls,
        `${on.calls} with, ${off.calls} without`);
    }
  }

  /* ---------------- Topic 5 · 2SAT, Horn, SAT ≤p 3SAT ---------------- */
  {
    const p = w.stParse(w.ST_PRESETS.twosat);
    const r = w.tsSolve(p.clauses, p.vars);
    s.ok('the lecture 2SAT example solves', r.ok, r.error);
    s.ok('and is satisfiable', r.sat === true);
    s.is('with the two components the slide draws',
      r.components.map(c => '{' + c.join(',') + '}').sort().join(' '),
      '{P,Q,R} {¬P,¬Q,¬R}');
    s.ok('and the assignment it produces really satisfies every clause', r.verified,
      w.stShowAsg(r.asg, p.vars));

    const bad2 = w.stParse(w.ST_PRESETS.twobad);
    const rb = w.tsSolve(bad2.clauses, bad2.vars);
    s.ok('an unsatisfiable 2SAT instance is detected', rb.sat === false);
    s.ok('by naming a variable whose two literals share a component',
      rb.clashes.length > 0, JSON.stringify(rb.clashes));

    s.ok('a 3-literal clause is refused rather than mis-solved',
      w.tsSolve(w.stParse('(P | Q | R)').clauses, ['P', 'Q', 'R']).ok === false);
    s.ok('a tautological clause is handled, not crashed on',
      w.tsSolve(w.stParse('(P | ~P)\n(Q | ~Q)').clauses, ['P', 'Q']).sat === true);

    // 2SAT against exhaustive search, at volume.
    {
      let bad = 0, first = '', tested = 0, sat = 0, unsat = 0, seed = 909;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const vars = ['P', 'Q', 'R', 'S'];
      for (let t = 0; t < 1200; t++) {
        const n = 2 + Math.floor(rnd() * 7), lines = [];
        for (let i = 0; i < n; i++) {
          lines.push((rnd() < 0.5 ? '~' : '') + vars[Math.floor(rnd() * 4)] + ' | ' +
                     (rnd() < 0.5 ? '~' : '') + vars[Math.floor(rnd() * 4)]);
        }
        const f = w.stParse(lines.join('\n'));
        if (!f.ok) continue;
        tested++;
        const got = w.tsSolve(f.clauses, f.vars), want = w.stBrute(f.clauses, f.vars);
        if (!got.ok) { bad++; if (!first) first = lines.join(' ; ') + ' — ' + got.error; continue; }
        if (got.sat !== want.sat) {
          bad++; if (!first) first = `${lines.join(' ; ')} — 2SAT said ${got.sat}, truth ${want.sat}`;
        }
        if (got.sat) {
          sat++;
          if (!w.stEval(f.clauses, got.asg).all) {
            bad++; if (!first) first = lines.join(' ; ') + ' — assignment does not satisfy';
          }
        } else unsat++;
      }
      s.ok('enough 2SAT instances were generated', tested > 1000, `only ${tested}`);
      s.ok('and both answers occur', sat > 100 && unsat > 20, `${sat} sat, ${unsat} unsat`);
      s.is('the SCC method agrees with exhaustive search every time, ' +
           'and every assignment it returns works', bad, 0, first);
    }

    // Horn.
    const h = w.stParse(w.ST_PRESETS.horn);
    const hr = w.hnSolve(h.clauses);
    s.ok('the lecture Horn example is recognised as Horn', hr.ok, hr.error);
    s.is('forward chaining derives all five atoms', hr.known.join(','), 'P,Q,R,S,T');
    s.ok('and it is satisfiable', hr.sat === true);
    s.is('agreeing with exhaustive search', hr.sat, w.stBrute(h.clauses, h.vars).sat);
    s.ok('a non-Horn clause is reported as such',
      w.hnClassify(w.stParse('(P | Q)').clauses).horn === false);
    s.ok('and (¬P ∨ Q) is Horn', w.hnClassify(w.stParse('(~P | Q)').clauses).horn === true);

    {
      // Horn forward chaining vs exhaustive search.
      let bad = 0, first = '', tested = 0, seed = 246;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const vars = ['P', 'Q', 'R', 'S'];
      for (let t = 0; t < 600; t++) {
        const n = 2 + Math.floor(rnd() * 5), lines = [];
        for (let i = 0; i < n; i++) {
          const body = vars.filter(() => rnd() < 0.4);
          const lits = body.map(v => '~' + v);
          if (rnd() < 0.75) lits.push(vars[Math.floor(rnd() * 4)]);
          if (!lits.length) continue;
          lines.push(lits.join(' | '));
        }
        if (!lines.length) continue;
        const f = w.stParse(lines.join('\n'));
        if (!f.ok) continue;
        const cls = w.hnClassify(f.clauses);
        if (!cls.horn) continue;
        tested++;
        const got = w.hnSolve(f.clauses), want = w.stBrute(f.clauses, f.vars);
        if (got.sat !== want.sat) {
          bad++; if (!first) first = `${lines.join(' ; ')} — Horn said ${got.sat}, truth ${want.sat}`;
        }
        if (got.sat && !w.stEval(f.clauses, got.asg).all) {
          bad++; if (!first) first = lines.join(' ; ') + ' — minimal model does not satisfy';
        }
      }
      s.ok('enough Horn formulas were generated', tested > 300, `only ${tested}`);
      s.is('forward chaining decides every one correctly', bad, 0, first);
    }

    // SAT ≤p 3SAT.
    const wide = w.stParse(w.ST_PRESETS.wide);
    const three = w.tsTo3(wide.clauses, wide.vars);
    s.is('the lecture wide clause is split to width 3', three.widest, 3);
    s.is('using one fresh variable', three.added, 1);
    s.is('giving exactly the clauses on the slide',
      w.stShow(three.clauses), '(P ∨ ¬Q ∨ X1) ∧ (¬X1 ∨ R ∨ S) ∧ (Q ∨ ¬R ∨ ¬T)');

    {
      // The reduction's actual claim, at volume: equisatisfiable.
      let bad = 0, first = '', tested = 0, split = 0, seed = 767;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const vars = ['P', 'Q', 'R', 'S', 'T'];
      for (let t = 0; t < 400; t++) {
        const n = 1 + Math.floor(rnd() * 4), lines = [];
        for (let i = 0; i < n; i++) {
          const k = 2 + Math.floor(rnd() * 4), lits = [];
          for (let j = 0; j < k; j++) lits.push((rnd() < 0.5 ? '~' : '') + vars[Math.floor(rnd() * 5)]);
          lines.push(lits.join(' | '));
        }
        const f = w.stParse(lines.join('\n'));
        if (!f.ok) continue;
        tested++;
        const chk = w.tsTo3Check(f.clauses, f.vars);
        if (!chk.ok) continue;
        if (f.widest > 3) split++;
        if (!chk.agree) {
          bad++; if (!first) first = `${lines.join(' ; ')} — ${chk.before} became ${chk.after}`;
        }
        if (chk.widest > 3) {
          bad++; if (!first) first = lines.join(' ; ') + ' — still has a wide clause';
        }
      }
      s.ok('enough formulas were generated', tested > 300, `only ${tested}`);
      s.ok('and many actually needed splitting', split > 100, `only ${split}`);
      s.is('every one comes out at width 3 with satisfiability preserved', bad, 0, first);
    }
  }

  /* ---------------- Topic 7 · TSP and 2OPT ---------------- */
  {
    const g = w.tspParse(w.TSP_PRESETS.lecture);
    s.ok('the lecture point set parses', g.ok, g.error);
    s.is('8 vertices', g.n, 8);
    s.ok('and being Euclidean, it satisfies the triangle inequality', g.metric.ok);

    // The MST, the traversal and the three cycle lengths on the slide.
    const mst = w.tspMst(g);
    s.is('the MST is the one drawn in red',
      mst.tree.map(e => e.u + e.v).sort().join(' '), 'AB AD BC BH DE EF EG');
    s.near('of weight 11.8929', mst.weight, 11.8929, 1e-4);
    s.is('the preorder traversal is the slide\'s H0',
      w.tspPreorder(g, mst.tree).join(','), 'A,B,C,H,D,E,F,G');

    const H0 = ['A', 'B', 'C', 'H', 'D', 'E', 'F', 'G'];
    const H1 = ['A', 'B', 'C', 'H', 'G', 'F', 'E', 'D'];
    const H2 = ['A', 'B', 'C', 'H', 'F', 'G', 'E', 'D'];
    s.near('H1 is 16.08, as printed', w.tspLen(g, H1), 16.0843, 1e-3);
    s.near('H2 is 14.71, as printed', w.tspLen(g, H2), 14.7148, 1e-3);
    // The slide says H0 is 19.06. It is 19.07 -- pinned so that a
    // corrected deck shows up here rather than passing silently.
    s.near('H0 is 19.0740 — the slide rounds it to 19.06, which is a hair low',
      w.tspLen(g, H0), 19.0740, 1e-3);

    // Taking the best improving swap reproduces the slide exactly.
    const best = w.tspTwoOpt(g, { pick: 'best' });
    s.is('steepest descent reaches the answer in two swaps, as the slides do',
      best.steps.filter(x => x.move).length, 2);
    s.is('via H1', best.steps[1].tour.join(','), H1.join(','));
    s.is('and then H2', best.steps[2].tour.join(','), H2.join(','));

    // First-improvement is also valid 2-opt, and lands in the same place.
    const first = w.tspTwoOpt(g, { pick: 'first' });
    s.near('first-improvement reaches the same length', first.length, best.length, 1e-9);
    s.ok('but takes more swaps to get there',
      first.steps.filter(x => x.move).length > 2,
      `${first.steps.filter(x => x.move).length} swaps`);

    // And that answer is in fact globally optimal here.
    const brute = w.tspBrute(g);
    s.ok('brute force over every tour succeeds', brute.ok, brute.error);
    s.is('checking 5040 of them', brute.searched, 5040);
    s.near('the 2OPT answer is the true optimum on this instance', best.length, brute.length, 1e-9);
    s.near('so the achieved ratio is 1, not 2', w.tspRatio(best.length, brute.length).ratio, 1, 1e-9);

    // The ratio is symmetric and never below 1.
    s.near('R is 1 when the two agree', w.tspRatio(10, 10).ratio, 1, 1e-12);
    s.near('and 2 when the approximation is twice the optimum', w.tspRatio(20, 10).ratio, 2, 1e-12);
    s.near('and still 2 the other way round', w.tspRatio(10, 20).ratio, 2, 1e-12);

    // A tour must be a permutation, and its length independent of
    // where you start or which way round you go.
    {
      const rot = H2.slice(3).concat(H2.slice(0, 3));
      s.near('rotating a tour does not change its length',
        w.tspLen(g, rot), w.tspLen(g, H2), 1e-12);
      s.near('nor does reversing it',
        w.tspLen(g, H2.slice().reverse()), w.tspLen(g, H2), 1e-12);
    }

    s.ok('a repeated vertex is refused', w.tspParse('A 0 0\nA 1 1\nB 2 2').ok === false);
    s.ok('an incomplete distance matrix is refused',
      w.tspParse('A B 1\nB C 1\nC D 1\nD A 1').ok === false);
    s.ok('and mixing coordinates with distances is refused',
      w.tspParse('A 0 0\nB C 3').ok === false);
    s.ok('fewer than three vertices is refused', w.tspParse('A 0 0\nB 1 1').ok === false);
  }

  /* ---------------- Topic 7 · the swap, and the proof chain ---------------- */
  {
    const g = w.tspParse(w.TSP_PRESETS.lecture);
    const tour = ['A', 'B', 'C', 'H', 'D', 'E', 'F', 'G'];

    // The reconnection that is a tour, and the one that is not.
    const rec = w.tspReconnect(tour, 3, 7);
    s.is('the valid reconnection is the slide\'s H1', rec.good.tour.join(','),
      'A,B,C,H,G,F,E,D');
    s.is('and it is still a permutation of all 8 vertices',
      rec.good.tour.slice().sort().join(''), 'ABCDEFGH');
    s.is('while the other pairing splits into two cycles', rec.bad.cycles.length, 2);
    s.is('covering every vertex between them',
      rec.bad.cycles[0].concat(rec.bad.cycles[1]).sort().join(''), 'ABCDEFGH');
    s.ok('but neither of them alone is a tour',
      rec.bad.cycles[0].length < 8 && rec.bad.cycles[1].length < 8);

    // Every link of the R = 2 proof, on many random metric instances.
    {
      let bad = 0, first = '', tested = 0, worst = 0, seed = 8888;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let t = 0; t < 120; t++) {
        const n = 5 + Math.floor(rnd() * 4), lines = [];
        for (let i = 0; i < n; i++) {
          lines.push('V' + i + ' ' + (rnd() * 20).toFixed(3) + ' ' + (rnd() * 20).toFixed(3));
        }
        const inst = w.tspParse(lines.join('\n'));
        if (!inst.ok) continue;
        // Euclidean points are always metric; if that ever fails the
        // distance function itself is wrong.
        if (!inst.metric.ok) { bad++; if (!first) first = 'Euclidean instance was not metric'; continue; }
        const opt = w.tspBrute(inst);
        if (!opt.ok) continue;
        tested++;

        const run = w.tspTwoOpt(inst);
        const H0len = w.tspLen(inst, run.start);
        const T0 = run.mst.weight;

        // Step 4: the traversal costs at most twice the tree.
        if (H0len > 2 * T0 + 1e-9) {
          bad++; if (!first) first = `H0 ${H0len} > 2*MST ${2 * T0}`;
        }
        // Step 3: the MST is no heavier than any spanning tree, in
        // particular the optimal tour minus its longest edge.
        if (T0 > opt.length + 1e-9) {
          bad++; if (!first) first = `MST ${T0} > optimal tour ${opt.length}`;
        }
        // Step 5: swaps never lengthen the tour.
        for (let k = 1; k < run.steps.length; k++) {
          if (run.steps[k].length > run.steps[k - 1].length + 1e-9) {
            bad++; if (!first) first = 'a swap made the tour longer';
          }
        }
        // Step 6: the conclusion.
        const ratio = run.length / opt.length;
        if (ratio > worst) worst = ratio;
        if (ratio > 2 + 1e-9) {
          bad++; if (!first) first = `ratio ${ratio} exceeded 2 on ${lines.join(';')}`;
        }
        // And the result must be a genuine tour.
        if (run.tour.slice().sort().join(',') !== inst.vertices.slice().sort().join(',')) {
          bad++; if (!first) first = '2OPT returned something that is not a permutation';
        }
      }
      s.ok('enough random metric instances were generated', tested > 90, `only ${tested}`);
      s.is('every link of the R = 2 chain holds on all of them, and the result is always a tour',
        bad, 0, first);
      s.ok('and the worst ratio actually seen is well under 2', worst < 2,
        `worst was ${worst.toFixed(4)}`);
    }

    // The triangle inequality, detected with a witness.
    {
      const nm = w.tspParse(w.TSP_PRESETS.nonmetric);
      s.ok('the non-metric preset parses', nm.ok, nm.error);
      s.ok('and is correctly flagged as violating the triangle inequality', nm.metric.ok === false);
      const wt = nm.metric.worst;
      s.ok('with a witness that really is a violation',
        nm.d(wt.x, wt.z) > nm.d(wt.x, wt.y) + nm.d(wt.y, wt.z),
        JSON.stringify(wt));
      s.ok('a Euclidean instance is never flagged',
        w.tspParse(w.TSP_PRESETS.cross).metric.ok === true);
    }
  }

  /* ---------------- Topic 7 · unapproximability ---------------- */
  {
    const G = w.grParse(w.AP_PRESETS.ham.replace(/>/g, '-'));
    const r = w.apUnapprox(G, 2);
    s.ok('the gadget builds', r.ok, r.error);
    s.is('with long edges costing nR+1', r.gadget.long, 5 * 2 + 1);
    s.is('and a threshold of nR', r.threshold, 10);
    s.ok('this graph has a Hamiltonian cycle', r.hasHam);
    s.is('so the optimal tour costs exactly n', r.optimal, 5);
    s.ok('which is under the threshold', r.short);
    s.ok('and the two agree, as the theorem says', r.agrees);

    // The construction's real claim is that the penalty outgrows ANY
    // claimed ratio, because nR+1 is chosen after R. A fixed penalty
    // would work for small R and quietly fail for large -- so the
    // separation is tested at a ratio big enough to expose that.
    {
      let bad = 0, first = '';
      [1, 2, 5, 20, 100].forEach(R => {
        const withCycle = w.apUnapprox(w.grParse(w.AP_PRESETS.ham.replace(/>/g, '-')), R);
        const without = w.apUnapprox(w.grParse(w.AP_PRESETS.path.replace(/>/g, '-')), R);
        if (!withCycle.ok || !without.ok) { bad++; return; }
        if (withCycle.gadget.long !== withCycle.gadget.n * R + 1) {
          bad++; if (!first) first = `R=${R}: long edge ${withCycle.gadget.long}, expected nR+1`;
        }
        if (!withCycle.short) { bad++; if (!first) first = `R=${R}: Hamiltonian graph not under nR`; }
        if (without.short) { bad++; if (!first) first = `R=${R}: non-Hamiltonian graph slipped under nR`; }
        if (!withCycle.agrees || !without.agrees) {
          bad++; if (!first) first = `R=${R}: the separation failed`;
        }
      });
      s.is('the gadget separates Hamiltonian from non-Hamiltonian at every R, however large',
        bad, 0, first);
    }

    const noham = w.apUnapprox(w.grParse(w.AP_PRESETS.path.replace(/>/g, '-')), 2);
    s.ok('a path has no Hamiltonian cycle', noham.hasHam === false);
    s.ok('so its cheapest tour must exceed the threshold', noham.short === false);
    s.ok('and the two still agree', noham.agrees);

    // The theorem at volume, over random graphs and several R.
    {
      let bad = 0, first = '', tested = 0, yes = 0, no = 0, seed = 20260909;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let t = 0; t < 300; t++) {
        const n = 4 + Math.floor(rnd() * 3);
        const V = 'ABCDEF'.slice(0, n).split(''), lines = [];
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) if (rnd() < 0.55) lines.push(V[i] + ' - ' + V[j]);
        }
        if (lines.length < 3) continue;
        const g2 = w.grParse(lines.join('\n'));
        if (!g2.ok || g2.nV !== n) continue;
        const R = 1 + Math.floor(rnd() * 3);
        const res = w.apUnapprox(g2, R);
        if (!res.ok) continue;
        tested++;
        if (res.hasHam) yes++; else no++;
        // The claim: cheap tour <=> Hamiltonian cycle exists.
        if (!res.agrees) {
          bad++;
          if (!first) first = `${lines.join(';')} R=${R}: short=${res.short} ham=${res.hasHam}`;
        }
        // And when one exists the optimum is exactly n.
        if (res.hasHam && Math.abs(res.optimal - n) > 1e-9) {
          bad++; if (!first) first = `${lines.join(';')}: optimum ${res.optimal} != n=${n}`;
        }
        // When none does, every tour must cost more than nR.
        if (!res.hasHam && res.optimal <= res.threshold) {
          bad++; if (!first) first = `${lines.join(';')}: no cycle but tour ${res.optimal} <= ${res.threshold}`;
        }
      }
      s.ok('enough random graphs were generated', tested > 200, `only ${tested}`);
      s.ok('with both outcomes represented', yes > 40 && no > 40, `${yes} with, ${no} without`);
      s.is('"cheapest tour ≤ nR" matches "has a Hamiltonian cycle" every time', bad, 0, first);
    }

    // The binary search, and the slide's inverted condition.
    {
      const g3 = w.tspParse(w.TSP_PRESETS.square);
      const good = w.apBinarySearch(g3, { buggy: false });
      s.ok('the corrected binary search runs', good.ranAtAll);
      s.ok('and closes on the true optimum', good.correct,
        `got ${good.answer}, truth ${good.truth}`);
      s.ok('taking a handful of calls', good.calls > 1 && good.calls < 60, `${good.calls} calls`);

      const printed = w.apBinarySearch(g3, { buggy: true });
      s.ok('the condition as printed never enters the loop', printed.ranAtAll === false);
      s.is('so it makes no calls at all', printed.calls, 0);
    }

    // apAssess: examples can refute a ratio but never establish one.
    {
      const refuted = w.apAssess([{ approx: 30, optimal: 10 }, { approx: 11, optimal: 10 }], 2);
      s.ok('a ratio claim is refuted by a single bad input', refuted.consistent === false);
      s.is('naming the offender', refuted.violations.length, 1);
      const survives = w.apAssess([{ approx: 19, optimal: 10 }, { approx: 11, optimal: 10 }], 2);
      s.ok('and survives when nothing exceeds it', survives.consistent === true);
      s.near('reporting the worst seen', survives.worst, 1.9, 1e-9);
    }
  }

  /* ---------------- Topic 08 · linear and integer programming ----------------

     Two engines solve every linear program here and they share no code: the
     simplex method walks corner to corner, and lpSolveByVertices enumerates
     every intersection of constraint boundaries and picks the best feasible
     one. Neither is trusted; they are made to agree.
  */
  {
    const fr = w.fr, frStr = w.frStr, frCmp = w.frCmp, frNum = w.frNum;
    const eq = (a, b) => frCmp(a, b) === 0;

    /* ---- exact arithmetic, because everything rests on it ---- */
    {
      s.is('1/2 + 1/3 is 5/6', frStr(w.frAdd(fr(1, 2), fr(1, 3))), '5/6');
      s.is('fractions reduce', frStr(fr(6, 8)), '3/4');
      s.is('and normalise the sign to the numerator', frStr(fr(1, -2)), '-1/2');
      s.is('0.5 parses exactly', frStr(w.frParse('0.5')), '1/2');
      s.is('as does 13/3', frStr(w.frParse('13/3')), '13/3');
      s.is('13/3 is never shown as a decimal', w.frShow(fr(13, 3)), '13/3');
      s.is('but 5/2 is', w.frShow(fr(5, 2)), '2.5');

      // A hundred random rationals: a/b + c/d - c/d must return exactly a/b.
      let drift = 0;
      for (let i = 0; i < 400; i++) {
        const a = fr(ri(-40, 40), ri(1, 30)), b = fr(ri(-40, 40), ri(1, 30));
        if (!eq(w.frSub(w.frAdd(a, b), b), a)) drift++;
      }
      s.is('adding and subtracting the same rational is exactly the identity', drift, 0);
    }

    /* ---- the lecture's program, against the lecture's own figures ---- */
    const lp = w.lpParse(w.LP_PRESETS.lecture);
    s.ok('the lecture program parses', lp.ok, lp.error);
    s.same('with the variables it names', lp.vars, ['x', 'y']);
    s.is('three constraints written, plus one per variable for x ≥ 0',
      lp.cons.length, 5);

    {
      const sol = w.lpSolveByVertices(lp);
      s.is('the feasible region has five vertices', sol.verts.length, 5);
      const pts = sol.verts.map(v => `(${frStr(v.x[0])},${frStr(v.x[1])})`).sort();
      s.same('and they are the ones on the slide',
        pts, ['(0,0)', '(0,5/2)', '(1,3)', '(4,3/2)', '(5,0)']);
      s.is('the optimum is at (4, 3/2)', `${frStr(sol.x[0])},${frStr(sol.x[1])}`, '4,3/2');
      s.is('with C = 25/2', frStr(sol.obj), '25/2');
      s.ok('and it is unique', sol.multiple === false);
    }

    /* ---- simplex reproduces the slides, tableau for tableau ---- */
    {
      const run = w.spRun(lp);
      s.ok('simplex terminates optimally', run.ok && run.status === 'optimal');
      s.is('in three pivots, as the slides show', run.pivots, 3);
      s.ok('agreeing with vertex enumeration', run.agrees);
      s.ok('and returning a point that satisfies the constraints', run.pointFeasible);
      s.ok('with the tableau feasible at every round', run.lostFeasibility === null);

      // Guarded: a broken pivot rule changes how many rounds there are, and
      // an unguarded run.rounds[3].T[3] then throws, which costs one nameless
      // "suite crashed" instead of the several named failures below.
      const show = r => (r && r.T ? r.T.map(row => row.map(w.frShow)) : null);
      s.is('there are four tableaux to compare', run.rounds.length, 4);
      s.same('round 1 matches the slide entry for entry', show(run.rounds[1]), [
        ['4', '0', '1', '-1', '0', '0', '10'],
        ['-0.5', '1', '0', '0.5', '0', '0', '2.5'],
        ['2', '0', '0', '-1', '1', '0', '2'],
        ['-3.5', '0', '0', '1.5', '0', '1', '7.5']]);
      s.same('and so does round 2', show(run.rounds[2]), [
        ['0', '0', '1', '1', '-2', '0', '6'],
        ['0', '1', '0', '0.25', '0.25', '0', '3'],
        ['1', '0', '0', '-0.5', '0.5', '0', '1'],
        ['0', '0', '0', '-0.25', '1.75', '1', '11']]);

      // Round 3 does NOT match: the slide prints 2.25 for the s3 coefficient
      // of the final row. Checked here a second way, by the identity the row
      // asserts — C = 12.5 - 0.25 s1 - L s3 must hold for all x and y, and
      // substituting s1 = 15-3x-2y, s3 = 7-x-2y forces L = 5/4 from the x
      // coefficient and again from the y coefficient.
      const final = (run.rounds[3] && run.rounds[3].T ? run.rounds[3].T[3] : null) ||
        [fr(0), fr(0), fr(0), fr(0), fr(0), fr(0), fr(0)];
      s.is('the final cost row has s1 coefficient 1/4', frStr(final[2]), '1/4');
      s.is('and s3 coefficient 5/4, where the slide prints 2.25', frStr(final[4]), '5/4');
      const L = w.frSub(fr(2), fr(3, 4));                    // from matching x
      const L2 = w.frDiv(w.frSub(fr(3), fr(1, 2)), fr(2));   // from matching y
      s.ok('both coefficient matches give the same value', eq(L, L2));
      s.ok('and it is what the tableau produced', eq(L, final[4]), frStr(L));
      s.is('the constant then works out to zero',
        frStr(w.frSub(w.frSub(fr(25, 2), w.frMul(fr(1, 4), fr(15))), w.frMul(L, fr(7)))), '0');
      s.is('and the reported optimum is unaffected', frStr(run.cost), '25/2');
    }

    /* ---- step 4 as printed breaks on a degenerate program ---- */
    {
      const dg = w.lpParse(w.LP_PRESETS.degenerate);
      const truth = w.lpSolveByVertices(dg);
      s.is('the degenerate program has optimum 10 at (2,2)',
        `${frStr(truth.obj)}@${frStr(truth.x[0])},${frStr(truth.x[1])}`, '10@2,2');

      const std = w.spRun(dg, { rule: 'standard' });
      s.ok('the standard rule agrees with vertex enumeration', std.agrees);
      s.ok('keeping every right-hand side non-negative', std.lostFeasibility === null);

      const deck = w.spRun(dg, { rule: 'deck' });
      s.ok('the slide\'s both-positive rule skips a zero-quotient row',
        deck.rounds.some(r => r.degenerateSkipped));
      s.ok('after which the tableau is no longer feasible', deck.lostFeasibility !== null);
      s.ok('and the point it finally reports breaks a constraint',
        w.lpCheck(dg, deck.x).feasible === false);
      s.ok('while claiming a value ABOVE the true optimum, which is the dangerous part',
        frCmp(deck.cost, truth.obj) > 0, `${frStr(deck.cost)} vs ${frStr(truth.obj)}`);
    }

    /* ---- and it cannot start at all on a ≥ constraint ---- */
    {
      const en = w.lpParse(w.LP_PRESETS.energy);
      s.ok('the energy program parses', en.ok, en.error);
      const built = w.spBuild(en);
      s.ok('the lecture tableau refuses to be built on it', built.ok === false);
      s.ok('naming the phase-one problem', built.needsPhaseOne === true);
      const tp = w.spTwoPhase(en);
      s.ok('the phase-one method solves it', tp.ok && tp.status === 'optimal');
      s.ok('using an artificial variable', tp.artificials > 0);
      s.ok('and returning a feasible point', tp.feasible);
      s.ok('that agrees with vertex enumeration',
        eq(tp.obj, w.lpSolveByVertices(en).obj), frStr(tp.obj));
    }

    /* ---- the three outcomes ---- */
    {
      s.is('an empty region is reported as infeasible',
        w.lpSolveByVertices(w.lpParse(w.LP_PRESETS.empty)).status, 'infeasible');
      s.is('an improving unbounded direction is reported as unbounded',
        w.lpSolveByVertices(w.lpParse(w.LP_PRESETS.unbounded)).status, 'unbounded');
      const many = w.lpSolveByVertices(w.lpParse(w.LP_PRESETS.many));
      s.ok('a contour parallel to an edge gives multiple optima', many.multiple);
      s.is('two vertices tie', many.ties.length, 2);
      s.ok('a strict inequality is rejected rather than silently relaxed',
        w.lpParse('max x\nx < 1').ok === false);
    }

    /* ---- Klee and Minty: the prediction is computed, not fitted ---- */
    for (let n = 0; n <= 5; n++) {
      const km = w.spKleeMinty(n);
      const run = w.spRun(w.lpParse(km.text), { cap: 2000, check: false });
      s.is(`Klee–Minty n=${n} takes 2^${n + 1}-1 = ${km.predicted} pivots`,
        run.pivots, km.predicted);
      s.is(`and reaches 5^${n + 1} = ${km.optimum}`, frNum(run.cost), km.optimum);
    }

    /* ---- branch and bound ---- */
    {
      const bb = w.ipBranchBound(lp);
      s.is('branch and bound explores the slide\'s five nodes', bb.explored, 5);
      s.is('every branch excluded the point that caused it', bb.stuck, 0);
      s.ok('and nothing hit the node cap',
        bb.nodes.every(n => n.status !== 'capped') && bb.explored < 200);
      s.is('and returns (3,2) with C = 12',
        `${frStr(bb.x[0])},${frStr(bb.x[1])}@${frStr(bb.obj)}`, '3,2@12');
      s.is('no node disagreed between the two relaxation engines', bb.disagreements.length, 0);

      const left = bb.nodes.find(n => n.label === 'y <= 1') || { x: [fr(0)], obj: fr(0) };
      s.is('the y ≤ 1 child has x = 13/3, not the slide\'s 4.3', frStr(left.x[0]), '13/3');
      s.is('and objective 35/3, not 11.6', frStr(left.obj), '35/3');
      const right = bb.nodes.find(n => n.label === 'y >= 2');
      s.ok('the y ≥ 2 child exists', !!right);
      s.ok('and is exactly the case the lecture tableau cannot start on',
        !!right && w.spBuild(right.lp).needsPhaseOne === true);

      const brute = w.ipBrute(lp);
      s.ok('brute force over the lattice agrees', eq(brute.obj, bb.obj));
      s.is('having found 16 feasible integer points', brute.feasible, 16);

      const bounded = w.ipBranchBound(lp, { bound: true });
      s.ok('adding the bounding step does not change the answer', eq(bounded.obj, bb.obj));
      s.ok('and it does prune', bounded.pruned > 0);

      // Random programs: branch and bound must equal brute force every time.
      let checked = 0, bad = 0, first = null;
      for (let t = 0; t < 120; t++) {
        const text = `max ${ri(1, 6)}x + ${ri(1, 6)}y\n` +
          `${ri(1, 4)}x + ${ri(1, 4)}y <= ${ri(6, 22)}\n` +
          `${ri(1, 4)}x + ${ri(1, 4)}y <= ${ri(6, 22)}`;
        const p = w.lpParse(text);
        if (!p.ok) continue;
        const a = w.ipBranchBound(p, { bound: true, cap: 200 });
        const b = w.ipBrute(p);
        if (!a.ok || !b.ok || !a.obj || !b.obj) continue;
        checked++;
        if (a.stuck) { bad++; if (!first) first = text + ' (branch made no progress)'; }
        if (!eq(a.obj, b.obj)) { bad++; if (!first) first = text; }
        if (w.lpCheck(p, a.x).feasible === false) { bad++; if (!first) first = text + ' (infeasible)'; }
        if (a.x.some(v => !w.frInt(v))) { bad++; if (!first) first = text + ' (not integral)'; }
      }
      s.ok('enough random programs were checked', checked > 80, `${checked}`);
      s.is('branch and bound matches brute force on every one, feasibly and integrally',
        bad, 0, first);
    }

    /* ---- SAT ≤p IP, decided twice by unrelated means ---- */
    {
      const cls = [['P', 'Q', '~R'], ['~P', 'Q', 'R'], ['~Q', 'S']];
      const red = w.ipFromCnf(cls);
      s.is('a clause becomes a ≥ 1 constraint over its literals\' variables',
        red.clauseRows[0], 'xP + xQ + xNR >= 1');
      s.is('and each variable gets two constraints', red.pairRows.length, 8);

      const chk = w.ipCheckReduction(cls);
      s.ok('the Topic 5 solver was actually reached', chk.satSolvable !== null, chk.satError);
      s.ok('and both routes agree on the slide example', chk.agree === true);

      const unsat = w.ipCheckReduction([['P'], ['~P']]);
      s.ok('an unsatisfiable formula gives an unsolvable integer program',
        unsat.agree === true && unsat.ipSolvable === false);

      // Which half of the pairing constraint is load-bearing? Build the
      // reduction with and without the ">= 1" row and test the equivalence
      // both ways, against brute-force satisfiability. The claim in the
      // notes is that only "<= 1" is needed for correctness.
      {
        const solvable = prog => {
          const pick = new Array(prog.n);
          let found = false;
          (function rec(i) {
            if (found) return;
            if (i === prog.n) {
              if (w.lpCheck(prog, pick.map(v => fr(v))).feasible) found = true;
              return;
            }
            for (let b = 0; b <= 2 && !found; b++) { pick[i] = b; rec(i + 1); }
          })(0);
          return found;
        };
        const build = (cl, vs, withGe) => {
          const col = l => (l[0] === '~' ? 'xN' + l.slice(1) : 'x' + l);
          const rows = ['max ' + vs.map(v => 'x' + v).join(' + ')];
          cl.forEach(c => rows.push(c.map(col).join(' + ') + ' >= 1'));
          vs.forEach(v => {
            rows.push('x' + v + ' + xN' + v + ' <= 1');
            if (withGe) rows.push('x' + v + ' + xN' + v + ' >= 1');
          });
          return w.lpParse(rows.join('\n'));
        };
        const satBrute = (cl, vs) => {
          for (let mask = 0; mask < (1 << vs.length); mask++) {
            const a = {};
            vs.forEach((v, i) => { a[v] = !!(mask & (1 << i)); });
            if (cl.every(c => c.some(l => (l[0] === '~' ? !a[l.slice(1)] : a[l])))) return true;
          }
          return false;
        };
        // Two propositional variables is enough to produce plenty of
        // unsatisfiable formulas, and keeps the 3^(2k) enumeration cheap.
        let seen = 0, unsat = 0, withBad = 0, withoutBad = 0, bothOnesOk = 0;
        for (let t = 0; t < 200; t++) {
          const vs = ['P', 'Q'].slice(0, ri(1, 2));
          const lits = [];
          vs.forEach(v => { lits.push(v, '~' + v); });
          const cl = [];
          for (let i = 0; i < ri(1, 6); i++) {
            const pool = lits.slice(), c = [];
            const width = ri(1, Math.min(3, pool.length));
            for (let j = 0; j < width; j++) c.push(pool.splice(ri(0, pool.length - 1), 1)[0]);
            cl.push(c);
          }
          const truth = satBrute(cl, vs);
          seen++; if (!truth) unsat++;
          if (solvable(build(cl, vs, true)) !== truth) withBad++;
          if (solvable(build(cl, vs, false)) !== truth) withoutBad++;
          // and with NEITHER half, every formula becomes solvable by setting
          // both variables of every pair to 1 — which is what "<= 1" prevents
          if (!truth) {
            const rows = ['max ' + vs.map(v => 'x' + v).join(' + ')];
            cl.forEach(c => rows.push(c.map(l => (l[0] === '~' ? 'xN' + l.slice(1) : 'x' + l))
              .join(' + ') + ' >= 1'));
            if (solvable(w.lpParse(rows.join('\n')))) bothOnesOk++;
          }
        }
        s.ok('the pairing check saw unsatisfiable formulas too', unsat > 8, `${unsat} of ${seen}`);
        s.ok('and satisfiable ones', seen - unsat > 8, `${seen - unsat} of ${seen}`);
        s.is('the reduction as stated is correct on all of them', withBad, 0);
        s.is('and stays correct with the ">= 1" half removed', withoutBad, 0);
        s.is('while removing "<= 1" makes every unsatisfiable formula solvable',
          bothOnesOk, unsat);
      }

      let n = 0, disagree = 0, undecided = 0, sats = 0, first = null;
      for (let t = 0; t < 400; t++) {
        const vs = ['P', 'Q', 'R', 'S'].slice(0, ri(1, 4));
        const lits = [];
        vs.forEach(v => { lits.push(v, '~' + v); });
        const cl = [];
        for (let i = 0; i < ri(1, 8); i++) {
          const pool = lits.slice(), c = [];
          const width = ri(1, Math.min(3, pool.length));
          for (let j = 0; j < width; j++) c.push(pool.splice(ri(0, pool.length - 1), 1)[0]);
          cl.push(c);
        }
        const r = w.ipCheckReduction(cl, vs);
        if (!r.ok) continue;
        n++;
        if (r.satSolvable) sats++;
        if (r.agree === null) { undecided++; if (!first) first = JSON.stringify(cl); }
        else if (r.agree === false) { disagree++; if (!first) first = JSON.stringify(cl); }
      }
      s.ok('a healthy sample of formulas was decided', n > 300, `${n}`);
      s.ok('containing both satisfiable and unsatisfiable ones',
        sats > 40 && n - sats > 40, `${sats} satisfiable of ${n}`);
      s.is('none was left undecided, which would make the check vacuous', undecided, 0, first);
      s.is('"F is satisfiable" matches "IP_F has an integer solution" every time',
        disagree, 0, first);
    }

    /* ---- the assignment example ---- */
    {
      const spec = w.IP_MATCHING_PRESET;
      const built = w.ipMatching(spec);
      s.ok('the assignment program builds', built.ok, built.error);
      s.is('with one variable per edge', built.vars.length, spec.edges.length);

      const brute = w.ipMatchingBrute(spec);
      s.ok('brute force over 0/1 assignments finds one', brute.ok && brute.best);
      const bb = w.ipBranchBound(w.lpParse(built.text), { bound: true, cap: 600 });
      s.is('and branch and bound matches it', frNum(bb.obj), brute.best.count);
      s.ok('every variable of the answer is 0 or 1',
        bb.x.every(v => frNum(v) === 0 || frNum(v) === 1));
      s.is('and the relaxation was integral, so no branching was needed', bb.explored, 1);

      // capacities and requirements, checked directly rather than trusted
      const load = {}, cover = {};
      w.lpParse(built.text).vars.forEach((nm, i) => {
        if (frNum(bb.x[i]) <= 0) return;
        const [, wk, tk] = nm.split('_');
        load[wk] = (load[wk] || 0) + 1;
        cover[tk] = (cover[tk] || 0) + 1;
      });
      s.ok('no worker is over capacity',
        spec.workers.every(v => (load[v.id] || 0) <= v.capacity), JSON.stringify(load));
      s.ok('and every task requirement is met',
        spec.tasks.every(t => (cover[t.id] || 0) >= t.requires), JSON.stringify(cover));
    }
  }

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 2000);

  return s;
};

/** A small integer in [lo, hi], for the randomised checks above. */
function ri(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
