'use strict';
/**
 * Foundations of Computing — Topic 01.
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

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 2000);

  return s;
};
