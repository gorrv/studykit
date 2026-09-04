'use strict';
/**
 * Foundations of Computing — Topics 01 and 02.
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

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 2000);

  return s;
};
