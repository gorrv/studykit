'use strict';
/**
 * Introduction to AI — correctness tests.
 *
 * These do not check that the page "looks right". They check that the
 * algorithms it teaches produce the answers the notes claim, by driving the
 * real tools and comparing against values derived independently.
 */

const { loadModule, Suite, checkStructure, checkQuestionBank } = require('./lib/harness');

module.exports = async function run() {
  const s = new Suite('intro-to-ai');
  const m = await loadModule('intro-to-ai.html');
  const w = m.window;

  await checkStructure(s, m);
  checkQuestionBank(s, m, 3000);

  // ---------------------------------------------------------------- Topic 1
  // A* on the Romania graph must find ARAD → SIBIU → RV → PITESTI → BUCHAREST
  // at a cost of 418, and must never expand B (Zerind) — the cheapest first
  // step, and the whole point of the worked example.
  const astar = w.AL.frames[w.AL.frames.length - 1];
  s.same('A* expansion order', w.AL.frames.map(f => f.pick),
    ['ARAD', 'D', 'E', 'F', 'G', 'BUCHAREST']);
  s.same('A* returns the optimal path', astar.path, ['ARAD', 'D', 'E', 'G', 'BUCHAREST']);
  s.near('A* path cost is 418', astar.cost, 140 + 80 + 97 + 101);
  s.ok('A* never expands B', w.AL.frames.every(f => f.pick !== 'B'));
  s.ok('B is still queued when the search ends', astar.rows.some(r => r.n === 'B'));

  // Admissibility: every supplied heuristic must under-estimate the true cost.
  const over = w.AL.G.order.filter(n => w.AL.h[n] > w.AL.star[n] + 1e-9);
  s.ok('all supplied heuristics are admissible', over.length === 0, over.join(', '));
  s.near('h(D) = 253 under-estimates the true 278', w.AL.star.D, 278);

  // h = 0 must reduce A* to uniform-cost search exactly.
  w.alZero();
  const zeroed = w.AL.frames.map(f => f.pick).join(',');
  w.alSetKey('g');
  s.ok('A* with h = 0 expands exactly what UCS does',
    zeroed === w.AL.frames.map(f => f.pick).join(','));
  w.alSetKey('f'); w.alReset();

  // ---------------------------------------------------------------- Topic 4
  // One Bellman sweep must move information exactly one square, and the first
  // interesting value must be U₁(3,3) = −0.04 + 0.8×1 = 0.76.
  const SP = w.SP;
  s.near('U₁(3,3) = 0.76', SP.res.hist[1][2][2], 0.76);
  s.near('U₂(3,3) = 0.832', SP.res.hist[2][2][2], 0.832, 1e-9);
  s.near('converged U(4,1) = 0.388', SP.res.hist[SP.res.hist.length - 1][3][0], 0.388, 5e-4);

  // The hard guarantee: a square d steps from a terminal cannot move before sweep d.
  let violations = 0, checked = 0;
  for (let k = 1; k <= 4; k++) {
    const U = SP.res.hist[k], baseline = SP.cfg.R * k;   // γ = 1 on this grid
    for (let x = 0; x < SP.G.W; x++) for (let y = 0; y < SP.G.H; y++) {
      const c = SP.G.g[x][y];
      if (c.wall || c.term) continue;
      if (SP.dist[x][y] > k) {
        checked++;
        if (Math.abs(U[x][y] - baseline) > 1e-9) violations++;
      }
    }
  }
  s.ok('no square gains value before information can reach it', violations === 0,
    `${violations} violations across ${checked} checks`);
  s.ok('that guarantee was actually exercised', checked > 0, String(checked));

  // ---------------------------------------------------------------- Topic 7
  // Decision tree: HasJob must win the root split, at 8/27 against OwnsHome's 64/135.
  s.ok('root splits on HasJob', w.DT.tree.featName === 'HasJob', w.DT.tree.featName);
  s.near('Gini-Split(HasJob) = 8/27', w.DT.tree.score, 8 / 27);
  s.near('Gini(root) = 148/225', w.DT.tree.gini, 148 / 225);
  const owns = w.DT.tree.cand.filter(c => c.name === 'OwnsHome')[0];
  s.near('Gini-Split(OwnsHome) = 64/135', owns.score, 64 / 135);

  // The class labels that are easy to get wrong — read them off the vectors.
  const hasJobYes = w.DT.tree.kids.filter(k => k.val === 'Yes')[0].node;
  s.same('HasJob=Yes has vector [0,5,4]', hasJobYes.vec, [0, 5, 4]);
  s.ok('HasJob=Yes is labelled Low, not Medium', hasJobYes.cls === 'Low', hasJobYes.cls);

  // Least squares on the notes' three points: β̂₀ = 6/7, β̂₁ = −4/7.
  w.lsPreset('notes');
  s.has('least squares reports 6/7', m.text('ls-output'), '6/7');
  s.has('least squares reports −4/7', m.text('ls-output'), /−4\/7|-4\/7/);

  // ---------------------------------------------------------------- Topic 8
  // Exercise 8's UCB trace, with c = 2.
  s.same('UCB pulls a1 a2 a3 a3 a1 a1 a1 a2',
    w.UC.trace.map(r => w.UC.names[r.pick]),
    ['a1', 'a2', 'a3', 'a3', 'a1', 'a1', 'a1', 'a2']);
  const t8 = w.UC.trace[7];
  s.near('UCB₈(a1) = 4.75 + 2√(ln8/4)', t8.arms[0].v, 4.75 + 2 * Math.sqrt(Math.log(8) / 4));
  s.near('UCB₈(a2) = 3.5 + 2√(ln8/1)', t8.arms[1].v, 3.5 + 2 * Math.sqrt(Math.log(8) / 1));
  s.ok('the chosen arm has the worst estimate of the three',
    t8.arms[1].q < t8.arms[0].q, `${t8.arms[1].q} vs ${t8.arms[0].q}`);
  s.same('N₈ = (4,1,2)', t8.arms.map(a => a.n), [4, 1, 2]);

  // c = 0 must collapse UCB into the greedy method.
  w.ucSet('c', 0);
  const greedyLike = w.UC.trace.slice(3).every(r => {
    const best = Math.max(...r.arms.map(a => a.q));
    return Math.abs(r.arms[r.pick].q - best) < 1e-9;
  });
  s.ok('c = 0 makes UCB behave greedily', greedyLike);
  w.ucSet('c', 2);

  // ---------------------------------------------------------------- Topic 9
  s.ok('seven harm categories', w.HARMS.length === 7);
  s.same('only world bias is not the developer\'s fault',
    w.BIAS.filter(b => !b.dev).map(b => b.k), ['world']);

  // ------------------------------------------------------------ Mock exam
  // Every topic must be able to produce a paper containing only its own topics.
  w.EX_TOPICS.forEach(topic => {
    w.exRestart(); w.exAll(false); w.exTopic(topic.w); w.exSet('n', 12); w.exStart();
    s.ok(`exam: topic ${topic.w} builds a paper`, w.EX.phase === 'run' && w.EX.qs.length > 0);
    s.ok(`exam: topic ${topic.w} draws only its own topics`,
      w.EX.qs.every(q => q.topic === topic.w));
    w.exFinish();
  });

  // Answering everything correctly must score 100%.
  w.exRestart(); w.exAll(true); w.exSet('n', 15); w.exStart();
  for (let i = 0; i < w.EX.qs.length; i++) {
    w.exJump(i);
    const q = w.EX.qs[i];
    const a = q.kind === 'choice' ? q.answer : (String(q.answer).match(/-?[0-9]+\.?[0-9]*$/) || [q.answer])[0];
    w.exAnswer(a);
  }
  w.exFinish();
  s.ok('exam marks a perfect paper as perfect', w.EX.answers.every(a => a.ok));
  s.has('exam reports 100%', m.text('ex-output'), '100%');

  return s;
};
