    /* ================= W6 · clustering ================= */
    const CLQ = [
      { q: 'What can a clustering algorithm <em>not</em> do that a supervised classifier can?', a: 'Name the groups it finds',
        c: ['Name the groups it finds', 'Handle more than two groups', 'Work in more than two dimensions', 'Assign new data points to a group'],
        e: 'Given cat and dog photos, an unsupervised algorithm may identify two groups of similar pictures — <strong>without being able to \'name\' them</strong>. There is no label, so there is also no accuracy, precision or F1: quality has to be judged from the data\'s own geometry.' },
      { q: 'In V(C<sub>k</sub>) = (1/|C<sub>k</sub>|) Σ d(p<sub>i</sub>,p<sub>i′</sub>)², what do you divide by?', a: 'The number of points in the cluster',
        c: ['The number of points in the cluster', 'The number of pairs in the cluster', 'The total number of points', 'The number of clusters'],
        e: 'A 4-point cluster has <strong>6 pair terms</strong> but is divided by <strong>4</strong>. This normalisation is exactly what makes Exercise 1 come out the way it does — it systematically favours putting an awkward point in the bigger cluster.' },
      { q: 'For a cluster of 4 points, how many squared-distance terms go into V(C)?', a: '6',
        c: ['6', '12', '4', '16'],
        e: 'Every <em>unordered</em> pair, counted once: 4 choose 2 = 6. The notes are explicit — "we do not count each pair i, i′ twice".' },
      { q: 'How does K-means break a tie when a point is equidistant from two centres?', a: 'Assign it to the centre with the lowest index',
        c: ['Assign it to the centre with the lowest index', 'Assign it at random', 'Leave it unassigned for that iteration', 'Assign it to the smaller cluster'],
        e: 'Definition 6.2 specifies this, and it is not a footnote — <strong>Exercises 2 and 3 both hinge on a tie at p₄</strong>, and the rule is the only thing that sends it one way rather than the other.' },
      { q: 'When does the K-means algorithm stop?', a: 'When the clusters have not changed',
        c: ['When the clusters have not changed', 'After exactly K iterations', 'When the within-cluster variance reaches zero', 'When every point is its own cluster'],
        e: 'Step 4: if clusters changed, go back to step 2; if not, stop. Since the centres are computed <em>from</em> the clusters, unchanged clusters means unchanged centres too.' },
      { q: 'How are the initial cluster centres chosen in Definition 6.2?', a: 'K different data points are selected',
        c: ['K different data points are selected', 'K random points anywhere in space', 'The K points furthest apart', 'The overall mean, repeated K times'],
        e: 'Initial centres are actual <em>data points</em>. Later centres are means and generally are <strong>not</strong> data points.' },
      { q: 'Why can K-means not just try every possible cluster assignment?', a: 'The number of assignments grows exponentially in n',
        c: ['The number of assignments grows exponentially in n', 'The assignments are not computable', 'Distances are too expensive to compute', 'There are infinitely many assignments'],
        e: 'For n = 20 and K = 2 there are already <strong>2²⁰ − 1 = 1,048,575</strong> assignments, and it only gets worse.' },
      { q: 'K-means converging to a local minimum that is not global is caused mainly by…', a: 'The choice of initial cluster centres',
        c: ['The choice of initial cluster centres', 'The value of K', 'The dimensionality of the data', 'Ties in the assignment step'],
        e: 'Exercise 3 shows it: the <em>same</em> two centres, merely relabelled, converge to a worse clustering (16.00 vs 14.75). Fixes: many random restarts (<code>n_init</code>) and smarter initial centres (<code>k-means++</code>).' },
      { q: 'Proposition 6.3 says within-cluster variance equals…', a: 'Twice the sum of squared distances from each point to the cluster centre',
        c: ['Twice the sum of squared distances from each point to the cluster centre', 'The sum of squared distances from each point to the cluster centre', 'Half the sum of pairwise squared distances', 'The squared distance between the two furthest points'],
        e: 'This is what justifies step 2 — reducing distances to centres also reduces the pairwise variance. Remark 6.4 adds that this is specific to <strong>Euclidean</strong> distance; with Manhattan it is not clear that assigning by nearest centre minimises anything.' },
      { q: 'In hierarchical clustering, what is the state at t = 0?', a: 'n clusters, one per point',
        c: ['n clusters, one per point', 'One cluster containing everything', 'K clusters chosen at random', 'Two clusters split at the median'],
        e: 'Then each step merges the closest pair, so K falls from n towards 1 — which is why you get <em>every</em> K in one run, instead of having to pick one up front.' },
      { q: 'Single-linkage defines the distance between two clusters as the…', a: 'Minimum distance between points from one cluster and the other',
        c: ['Minimum distance between points from one cluster and the other', 'Maximum distance between points from one cluster and the other', 'Average distance over all cross-cluster pairs', 'Distance between the two cluster centres'],
        e: 'Single = min, complete = max, average = mean. Average divides by <strong>mn</strong>, the number of cross-cluster pairs.' },
      { q: 'Which linkage produces long, straggly clusters that can "chain" through a bridge of stray points?', a: 'Single-linkage',
        c: ['Single-linkage', 'Complete-linkage', 'Average-linkage', 'All of them equally'],
        e: 'Single-linkage only needs <em>one</em> close pair to merge. Complete-linkage requires <em>every</em> pair to be close, so it produces compact clusters — which is exactly why Exercise 7\'s helicopters need it.' },
      { q: 'Is the linkage criterion tied to the choice of metric?', a: 'No — any linkage combines with any metric',
        c: ['No — any linkage combines with any metric', 'Yes — single-linkage requires L₁', 'Yes — average-linkage requires L₂', 'Only complete-linkage is metric-independent'],
        e: 'The notes make the point explicitly, and then draw <strong>all six combinations</strong> of three linkages × two metrics as dendograms.' },
      { q: 'On a tie, Definition 6.10 says to…', a: 'Merge all clusters that are threshold(t) away from each other',
        c: ['Merge all clusters that are threshold(t) away from each other', 'Merge the pair with the lowest indices', 'Merge one pair chosen at random', 'Stop the algorithm'],
        e: 'Two separate tied pairs give two merges; a <em>chain</em> C₁–C₂–C₃ all at the threshold gives one big cluster. The cost, which the notes admit, is that <strong>some values of K become unreachable</strong>.' },
      { q: 'With n points, what is the maximum number of steps hierarchical clustering can take?', a: 'n − 1',
        c: ['n − 1', 'n', 'n(n−1)/2', '2ⁿ'],
        e: 'Each step reduces the cluster count by <em>at least</em> one, from n down to 1. It is a <em>maximum</em> because the tie rule can remove two or more clusters in a single step.' },
      { q: 'In a dendogram, what does the height of a horizontal join represent?', a: 'The threshold at which those clusters merged',
        c: ['The threshold at which those clusters merged', 'The number of points in the merged cluster', 'The within-cluster variance', 'The iteration number'],
        e: 'And a <strong>long vertical gap</strong> means the next merge needed a much larger threshold — the clusters were far apart, so just below that gap is a good place to cut.' },
      { q: 'A dendogram shows a merge at height 20 and the next at height 36, with all earlier merges below 8. What K does this suggest?', a: 'K = 2',
        c: ['K = 2', 'K = 3', 'K = 6', 'K = 1'],
        e: 'This is the notes\' own reading of Figure 6.9 (complete linkage, L₁): "one needs to increase the threshold from around 20 to around 35 to go from 2 clusters to 1", so cut just below that jump.' },
      { q: 'Helicopters can fly at most 100 miles non-stop, and you need <em>every</em> pair of cities in a cluster to be reachable directly. Which linkage?', a: 'Complete-linkage',
        c: ['Complete-linkage', 'Single-linkage', 'Average-linkage', 'Any of them'],
        e: 'Exercise 7. Complete-linkage bounds the <strong>diameter</strong>: merging at threshold 100 guarantees every pair is within 100. Single-linkage would allow A–B 90 and B–C 90 but <strong>A–C 180</strong>, and the helicopter never arrives.' }
    ];
    CLQ.forEach(d => QZ_GEN.push({ topic: 'clustering', make: () => ({
      topic: 'clustering · concepts', kind: 'choice', prompt: d.q, choices: d.c.slice(), answer: d.a,
      check: textCheck(d.a), explain: d.e }) }));
    /* computed: within-cluster variance of a small cluster */
    QZ_GEN.push({ topic: 'clustering', make: () => {
      const n = qzInt(3, 4), pts = [];
      for (let i = 0; i < n; i++) pts.push({ name: 'p' + (i + 1), x: [qzInt(0, 9), qzInt(0, 9)] });
      const W = clWCV(pts);
      if (W.sum === 0) throw new Error('retry');
      const ans = +W.V.toFixed(4);
      return { topic: 'clustering · variance', prompt:
        `A cluster contains these points:<pre>${pts.map(p => p.name + ' = (' + p.x.join(', ') + ')').join('\n')}</pre>`
        + `What is <strong>V(C) = (1/|C|) Σ<sub>i,i′</sub> d(p<sub>i</sub>,p<sub>i′</sub>)²</strong>, to 2 decimal places?`,
        placeholder: 'a number', answer: String(ans), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - W.V) < 0.011 };
        },
        explain: `The ${W.terms.length} unordered pairs give ${W.terms.map(t => `d(${t.a},${t.b})²=${t.d}`).join(', ')} — sum <strong>${W.sum}</strong>.`
          + `<br>Divide by <strong>|C| = ${n}</strong> (the number of <em>points</em>, not pairs): V = ${W.sum}/${n} = <strong>${W.V.toFixed(4)}</strong>.` };
    } });
    /* computed: L1 / L2 distance */
    QZ_GEN.push({ topic: 'clustering', make: () => {
      const D = qzInt(2, 4), a = [], b = [];
      for (let i = 0; i < D; i++) { a.push(qzInt(-8, 8)); b.push(qzInt(-8, 8)); }
      const which = qzPick(['Manhattan (L₁)', 'Euclidean (L₂)']);
      const l1 = clL1(a, b), l2 = clL2(a, b);
      if (l1 === 0) throw new Error('retry');
      const val = which[0] === 'M' ? l1 : l2;
      const ans = +val.toFixed(3);
      return { topic: 'clustering · metrics', prompt:
        `p₁ = (${a.join(', ')})<br>p₂ = (${b.join(', ')})<br><br>What is the <strong>${which}</strong> distance, to 2 decimal places?`,
        placeholder: 'a number', answer: String(ans), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - val) < 0.011 };
        },
        explain: `L₁ = ${a.map((x, i) => `|${x} − ${b[i]}|`).join(' + ')} = ${a.map((x, i) => Math.abs(x - b[i])).join(' + ')} = <strong>${l1}</strong>.`
          + `<br>L₂ = √(${a.map((x, i) => `(${x} − ${b[i]})²`).join(' + ')}) = √${clD2(a, b)} = <strong>${l2.toFixed(4)}</strong>.`
          + `<br><br>Remember <strong>L₂ ≤ L₁ always</strong> — a useful sanity check.` };
    } });
    /* computed: cluster distance under a linkage */
    QZ_GEN.push({ topic: 'clustering', make: () => {
      const mk = n => { const a = []; for (let i = 0; i < n; i++) a.push({ name: 'q' + (a.length + 1), x: [qzInt(-9, 9), qzInt(-9, 9)] }); return a; };
      const c1 = mk(qzInt(2, 3)), c2 = mk(qzInt(2, 3));
      c1.forEach((p, i) => p.name = 'a' + (i + 1));
      c2.forEach((p, i) => p.name = 'b' + (i + 1));
      const crit = qzPick(['single', 'complete', 'average']);
      const mn = qzPick(['l1', 'l2']);
      const metric = mn === 'l1' ? clL1 : clL2;
      const val = hcLink(c1, c2, metric, crit);
      const ans = +val.toFixed(3);
      const all = [];
      c1.forEach(p => c2.forEach(q => all.push(`${p.name}–${q.name}: ${metric(p.x, q.x).toFixed(2)}`)));
      const cname = { single: 'single-linkage (min)', complete: 'complete-linkage (max)', average: 'average-linkage (mean)' }[crit];
      return { topic: 'clustering · linkage', prompt:
        `Two clusters, using <strong>${mn === 'l1' ? 'Manhattan L₁' : 'Euclidean L₂'}</strong>:`
        + `<pre>C1: ${c1.map(p => p.name + '=(' + p.x.join(',') + ')').join('  ')}\nC2: ${c2.map(p => p.name + '=(' + p.x.join(',') + ')').join('  ')}</pre>`
        + `What is dist(C1, C2) under <strong>${cname}</strong>, to 2 decimal places?`,
        placeholder: 'a number', answer: String(ans), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - val) < 0.011 };
        },
        explain: `All ${c1.length * c2.length} cross-cluster distances: ${all.join(', ')}.`
          + `<br><br>${cname} takes the ${crit === 'single' ? '<strong>smallest</strong>' : crit === 'complete' ? '<strong>largest</strong>' : '<strong>mean</strong> (divide by mn = ' + (c1.length * c2.length) + ')'} → <strong>${val.toFixed(4)}</strong>.` };
    } });
    /* ---------- W7 · supervised learning ---------- */
    const SUPQ = [
      { q: 'In N(µ, σ²), what is the second argument?', a: 'The variance',
        c: ['The variance', 'The standard deviation', 'The mean of the squares', 'The sample size'],
        e: 'σ is the standard deviation, σ² the variance. The notes\' example has σ = 0.3, so it is written <strong>N(2.5, 0.09)</strong> — writing N(2.5, 0.3) is a common and costly slip.' },
      { q: 'For a continuous distribution, what is the probability of getting one specific value exactly?', a: 'Zero',
        c: ['Zero', 'The height of the density at that point', '1/n', 'Undefined'],
        e: 'Normal distributions are continuous, so <strong>the chance of any specific value is always zero</strong>. Only intervals have probability, given by the area under the curve.' },
      { q: 'Roughly what proportion of a normal distribution lies between µ − σ and µ + σ?', a: 'About 68%',
        c: ['About 68%', 'About 95%', 'About 50%', 'About 99.7%'],
        e: 'The 68 / 95 / 99.7 rule for ±1σ, ±2σ, ±3σ. In the notes\' example (µ = 2.5, σ = 0.3) that is the interval <strong>2.2 to 2.8</strong>.' },
      { q: 'Is polynomial regression a special case of linear regression?', a: 'Yes',
        c: ['Yes', 'No — the curve is not a line', 'Only for degree 2', 'Only if the errors are normal'],
        e: '<strong>“Linear” refers to the parameters βᵢ, not to the variables xᵢ.</strong> Treat x, x², x³ … as separate features and Definition 7.1 applies unchanged — so polynomial regression is linear regression.' },
      { q: 'What does the hat in ŷ signal?', a: 'It is a prediction, not an observed value',
        c: ['It is a prediction, not an observed value', 'It has been normalised', 'It is the mean of the ys', 'It is an estimate of the error'],
        e: 'y is what the data recorded; <strong>ŷ = β₀ + β₁x</strong> is what the fitted line says. The gap between them is the residual ε.' },
      { q: 'Is the assumption that the errors are normally distributed used in the proof of Theorem 7.3?', a: 'No',
        c: ['No', 'Yes, it is essential', 'Only for the β₀ formula', 'Only when n is small'],
        e: 'The notes are explicit: <strong>we do not use the assumption of normality of errors in the proof.</strong> You need it only to prove further properties of the estimators, such as unbiasedness.' },
      { q: 'Why is having a closed-form solution for linear regression described as remarkable?', a: 'Most ML methods cannot be proved optimal, only shown to work well in practice',
        c: ['Most ML methods cannot be proved optimal, only shown to work well in practice', 'Because it is fast to compute', 'Because it needs no training data', 'Because it never overfits'],
        e: '“This is very rare in machine learning — not often can we actually prove that a method gives the best solution possible.” Contrast K-means, which only reaches a local optimum.' },
      { q: 'Which algorithm minimises the absolute error rather than the squared error?', a: 'Least Absolute Deviations',
        c: ['Least Absolute Deviations', 'Ridge regression', 'Gradient descent', 'K-means'],
        e: 'Named in §7.2.4 as the alternative. Squared error is preferred here because it has a closed-form solution — not because absolute error is wrong.' },
      { q: 'In a binary decision tree, which branch is taken when the node\'s statement is True?', a: 'The left branch',
        c: ['The left branch', 'The right branch', 'Either — it is arbitrary', 'The branch with more samples'],
        e: 'A stated convention of the chapter. For a non-binary branch you instead <strong>label each arrow with the attribute value</strong>.' },
      { q: 'What is the maximum possible Gini index for k classes?', a: '1 − 1/k',
        c: ['1 − 1/k', '1', '1/2', 'k − 1'],
        e: 'Gini = 1 − Σpᵢ², minimised inside when all pᵢ = 1/k, giving <strong>1 − 1/k</strong>. For k = 2 that is ½ (Exercise 4); for k = 3, ⅔; for k = 4, ¾.' },
      { q: 'Gini-Split combines the children\'s Gini values how?', a: 'As a weighted average, each child weighted by nⱼ/n',
        c: ['As a weighted average, each child weighted by nⱼ/n', 'As a plain average', 'By taking the minimum', 'By summing them'],
        e: 'Definition 7.5: <strong>Gini-Split(Aᵢ) = Σⱼ (nⱼ/n)·Gini(vⱼ)</strong>. Dropping the weights is the single most common way to lose marks here.' },
      { q: 'Having computed Gini-Split for every attribute, what do you do?', a: 'Take the arg min — the attribute with the lowest value',
        c: ['Take the arg min — the attribute with the lowest value', 'Take the arg max', 'Take the one closest to the parent\'s Gini', 'Take the attribute with the most values'],
        e: 'Equation (7.11). Lower Gini-Split means purer children. And note it is <strong>arg</strong> min — the answer is an attribute name, not a number.' },
      { q: 'Must every branch of a decision tree split on the same attribute at the same depth?', a: 'No — different branches may split differently',
        c: ['No — different branches may split differently', 'Yes, otherwise the tree is invalid', 'Yes, unless the node is pure', 'Only for binary features'],
        e: 'Nothing stops us forcing it, but it makes more sense to allow different splits: a new point\'s feature values are no secret, so we can traverse the tree taking the best option at each node. <strong>This is what scikit-learn does.</strong>' },
      { q: 'A node has value [0, 5, 4] over classes ordered (High, Low, Medium). What class label does it carry?', a: 'Low',
        c: ['Low', 'Medium', 'High', 'None — it is impure'],
        e: 'The label is the <strong>majority class</strong>, ties broken by lowest index. Low has 5 against Medium\'s 4. Note this is the node Figure 7.5 mislabels as Medium — <strong>read the label off the vector.</strong>' },
      { q: 'Is Decision Tree Regression covered by this course?', a: 'No — it is explicitly out of scope',
        c: ['No — it is explicitly out of scope', 'Yes, in §7.3.3', 'Yes, it is the same as Gini-Split', 'Only for binary features'],
        e: 'Out of scope. What <em>is</em> in scope is continuous values appearing as <strong>attributes</strong> in a classification tree — Salary, for instance, split with a test like <code>Salary ≤ 30000</code>.' },
      { q: 'What does a Gini index of 0 tell you about a node?', a: 'Every point in it belongs to the same class',
        c: ['Every point in it belongs to the same class', 'The node is empty', 'The classes are perfectly balanced', 'The node cannot be split'],
        e: 'Gini measures impurity, so 0 means <strong>pure</strong>. Balanced classes give the <em>maximum</em>, 1 − 1/k, not the minimum.' },
      { q: 'What is the algorithmic reason for not splitting again on a feature already used higher up the same branch?', a: 'Every point in the node shares that value, so the split has one child and cannot reduce impurity',
        c: ['Every point in the node shares that value, so the split has one child and cannot reduce impurity', 'It would make the tree non-binary', 'The Gini index becomes undefined', 'scikit-learn forbids it'],
        e: 'Its Gini-Split would equal the node\'s own Gini exactly — no improvement is possible, ever.' },
      { q: 'Are neural networks examinable in this module?', a: 'No',
        c: ['No', 'Yes, at a high level', 'Only backpropagation', 'Only the 3Blue1Brown material'],
        e: '“Neural networks are beyond the scope of this course.” The chapter lists 3Blue1Brown, Prince\'s <em>Understanding Deep Learning</em> and Goodfellow et al. as optional reading only.' }
    ];
    SUPQ.forEach(d => QZ_GEN.push({ topic: 'supervised', make: () => ({
      topic: 'supervised · concepts', kind: 'choice', prompt: d.q, choices: d.c.slice(), answer: d.a,
      check: textCheck(d.a), explain: d.e }) }));
    /* computed: fit a line to three or four integer points */
    QZ_GEN.push({ topic: 'supervised', make: () => {
      const n = qzInt(3, 4), pts = [], xs = [];
      while (xs.length < n) { const x = qzInt(-3, 5); if (xs.indexOf(x) < 0) xs.push(x); }
      xs.sort((a, b) => a - b);
      xs.forEach(x => pts.push({ x: x, y: qzInt(-6, 6) }));
      const f = lsFit(pts);
      if (!f.den || !isFinite(f.b0) || !isFinite(f.b1)) throw new Error('retry');
      const which = qzPick(['β₀', 'β₁']);
      const val = which === 'β₀' ? f.b0 : f.b1;
      const r = w7Rat(which === 'β₀' ? f.num0 : f.num1, f.den);
      return { topic: 'supervised · least squares', prompt:
        `Fit a simple linear regression <code>ŷ = β₀ + β₁x</code> to these points:`
        + `<pre>${pts.map(p => `x = ${p.x}, y = ${p.y}`).join('\n')}</pre>`
        + `What is <strong>${which}</strong>, to 2 decimal places?`,
        placeholder: 'a number', answer: (r ? w7RatStr(r) + ' = ' : '') + val.toFixed(4), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - val) < 0.011 };
        },
        explain: `n = ${f.n}, Σxᵢ = ${f.Sx}, Σyᵢ = ${f.Sy}, Σxᵢ² = ${f.Sxx}, Σxᵢyᵢ = ${f.Sxy}.`
          + `<br>Denominator n·Σx² − (Σx)² = ${f.n}·${f.Sxx} − ${f.Sx}² = <strong>${f.den}</strong>.`
          + `<br>β̂₁ = (${f.n}·${f.Sxy} − ${f.Sx}·${f.Sy}) / ${f.den} = ${f.num1}/${f.den} = <strong>${f.b1.toFixed(4)}</strong>`
          + `<br>β̂₀ = (${f.Sxx}·${f.Sy} − ${f.Sx}·${f.Sxy}) / ${f.den} = ${f.num0}/${f.den} = <strong>${f.b0.toFixed(4)}</strong>`
          + `<br><br>Check: the residuals must sum to zero.` };
    } });
    /* computed: predict from a fitted line */
    QZ_GEN.push({ topic: 'supervised', make: () => {
      const n = 3, pts = [], xs = [];
      while (xs.length < n) { const x = qzInt(-3, 4); if (xs.indexOf(x) < 0) xs.push(x); }
      xs.sort((a, b) => a - b);
      xs.forEach(x => pts.push({ x: x, y: qzInt(-5, 5) }));
      const f = lsFit(pts);
      if (!f.den || !isFinite(f.b0)) throw new Error('retry');
      const at = qzInt(5, 9), val = f.b0 + f.b1 * at;
      return { topic: 'supervised · prediction', prompt:
        `Fit <code>ŷ = β₀ + β₁x</code> to these points, then predict at <strong>x = ${at}</strong>:`
        + `<pre>${pts.map(p => `x = ${p.x}, y = ${p.y}`).join('\n')}</pre>`
        + `What is ŷ(${at}), to 2 decimal places?`,
        placeholder: 'a number', answer: val.toFixed(4), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - val) < 0.015 };
        },
        explain: `β̂₁ = ${f.num1}/${f.den} = ${f.b1.toFixed(4)}, β̂₀ = ${f.num0}/${f.den} = ${f.b0.toFixed(4)}.`
          + `<br>ŷ(${at}) = ${f.b0.toFixed(4)} + ${f.b1.toFixed(4)}·${at} = <strong>${val.toFixed(4)}</strong>.`
          + `<br><br>x = ${at} is outside the data range ${pts[0].x} … ${pts[n - 1].x}, so this is <strong>extrapolation</strong> — worth saying so in an exam.` };
    } });
    /* computed: Gini of a count vector */
    QZ_GEN.push({ topic: 'supervised', make: () => {
      const k = qzInt(2, 4), v = [];
      for (let i = 0; i < k; i++) v.push(qzInt(0, 8));
      const n = v.reduce((a, b) => a + b, 0);
      if (n < 4) throw new Error('retry');
      const g = giOf(v);
      return { topic: 'supervised · Gini', prompt:
        `A node contains <strong>${n}</strong> points with class counts <code>v = (${v.join(', ')})</code>.`
        + `<br><br>What is <strong>Gini(v) = Σ pᵢ(1 − pᵢ)</strong>, to 3 decimal places?`,
        placeholder: 'a number', answer: g.toFixed(4), check: x => {
          const y = parseFloat(String(x).replace(/[^0-9.\-]/g, ''));
          if (isNaN(y)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(y - g) < 0.0015 };
        },
        explain: `pᵢ = vᵢ/n, so Gini = ${v.map(c => `(${c}/${n})(${n - c}/${n})`).join(' + ')} = <strong>${g.toFixed(4)}</strong>.`
          + `<br><br>The maximum for k = ${k} is 1 − 1/${k} = ${(1 - 1 / k).toFixed(4)}${g < 1e-12 ? ', and 0 means this node is <strong>pure</strong>' : ''}.` };
    } });
    /* computed: which feature to split by */
    QZ_GEN.push({ topic: 'supervised', make: () => {
      const nF = qzInt(2, 3), nC = qzInt(2, 3), nR = qzInt(8, 12);
      const fname = ['A', 'B', 'C'].slice(0, nF), cname = ['X', 'Y', 'Z'].slice(0, nC);
      const rows = [];
      for (let i = 0; i < nR; i++) {
        const fv = []; for (let j = 0; j < nF; j++) fv.push(qzInt(0, 1));
        rows.push({ f: fv, c: cname[qzInt(0, nC - 1)] });
      }
      const vecOf = rs => cname.map(c => rs.filter(r => r.c === c).length);
      const root = giOf(vecOf(rows));
      if (root < 1e-9) throw new Error('retry');
      const scores = fname.map((nm, j) => {
        let s = 0; const parts = [];
        [0, 1].forEach(v => {
          const sub = rows.filter(r => r.f[j] === v);
          if (!sub.length) return;
          const vec = vecOf(sub), gg = giOf(vec);
          s += (sub.length / nR) * gg;
          parts.push(`(${sub.length}/${nR})·Gini(${vec.join(',')}) = (${sub.length}/${nR})·${gg.toFixed(4)}`);
        });
        return { name: nm, score: s, parts: parts };
      });
      let best = scores[0];
      scores.forEach(s => { if (s.score < best.score - 1e-9) best = s; });
      const ties = scores.filter(s => Math.abs(s.score - best.score) < 1e-9);
      if (ties.length > 1) throw new Error('retry');
      return { topic: 'supervised · Gini-Split', kind: 'choice', prompt:
        `Classes are <code>${cname.join(', ')}</code>, in that order. Which feature should the root split by?`
        + `<pre>${fname.join('  ')}  class\n${rows.map(r => r.f.join('  ') + '  ' + r.c).join('\n')}</pre>`,
        choices: fname.slice(), answer: best.name, check: textCheck(best.name),
        explain: `Gini at the root = ${root.toFixed(4)} over <code>(${vecOf(rows).join(', ')})</code>.`
          + '<br><br>' + scores.map(s => `<strong>Gini-Split(${s.name})</strong> = ${s.parts.join(' + ')} = <strong>${s.score.toFixed(4)}</strong>`).join('<br>')
          + `<br><br>arg min is <strong>${best.name}</strong>. Remember the weights nⱼ/n — an unweighted average can pick the wrong feature.` };
    } });
    /* ---------- W8 · reinforcement learning ---------- */
    const RLQ = [
      { q: 'What does q⋆(a) denote in the k-armed bandit problem?', a: 'The true expected reward of action a',
        c: ['The true expected reward of action a', 'Our current estimate of a\'s reward', 'The largest reward a has paid', 'The number of times a was chosen'],
        e: 'Definition 8.2: <strong>q⋆(a,t) = E[R<sub>t</sub> | A<sub>t</sub> = a]</strong>. It is a property of the world, unknown to the agent. The <em>estimate</em> is Q<sub>t</sub>(a).' },
      { q: 'Why can the t be dropped from q⋆(a, t) but not from Q<sub>t</sub>(a)?', a: 'The distributions are assumed stationary, but our estimate changes as data arrives',
        c: ['The distributions are assumed stationary, but our estimate changes as data arrives', 'q⋆ is a limit and Q is not', 'Because t starts at 1 in both', 'Because Q is an average and q⋆ is a sum'],
        e: 'For a stationary distribution q⋆(a,t) = q⋆(a,t′) for all t, t′, so the t is redundant. But <strong>we expect our estimate to change over time</strong> — that is the entire point of it.' },
      { q: 'Q<sub>t</sub>(a) averages the rewards from which steps?', a: 'Every step strictly before t on which a was chosen',
        c: ['Every step strictly before t on which a was chosen', 'Every step up to and including t', 'Every step before t, whatever action was taken', 'The last N steps on which a was chosen'],
        e: 'Definition 8.3 sums i = 1 to <strong>t − 1</strong>, filtered by 1<sub>Aᵢ=a</sub>. So Q<sub>t</sub> is what you know when about to choose A<sub>t</sub> — it cannot contain R<sub>t</sub>.' },
      { q: 'What is Q₁(a) for every action a?', a: '0',
        c: ['0', 'Undefined — no data yet', 'The mean of the reward distribution', '1/k'],
        e: 'Nothing has happened before t = 1, so the count is zero and the stated convention applies: <strong>Q₁(a) = 0</strong>. Definitions 8.5 and 8.6 build this in as the initial estimate.' },
      { q: 'What is 1<sub>predicate</sub> doing in equation (8.4)?', a: 'Counting only the steps on which a was the chosen action',
        c: ['Counting only the steps on which a was the chosen action', 'Normalising the rewards to [0,1]', 'Marking whether the reward was positive', 'Indexing the time steps'],
        e: 'The indicator function is 1 when the predicate holds and 0 otherwise, so it zeroes out every step where a different action was taken — in both the numerator and the denominator.' },
      { q: 'Under the random method, what is Pr(A<sub>t</sub> = a<sub>i</sub>)?', a: '1/k',
        c: ['1/k', '1/t', 'Q<sub>t</sub>(a<sub>i</sub>) / Σ Q<sub>t</sub>(a)', 'ε/k'],
        e: 'Definition 8.4 — uniformly at random over the k actions, on every step, regardless of everything learned so far.' },
      { q: 'In the greedy method, what happens when two actions tie for the maximum estimate?', a: 'Randomise between them',
        c: ['Randomise between them', 'Take the lowest index', 'Take the one sampled least', 'Take neither and explore'],
        e: 'Definition 8.5 randomises among the maxima. <strong>Careful:</strong> UCB\'s Remark 8.8 uses the opposite rule — lowest index. Mixing them up derails a whole trace.' },
      { q: 'In UCB, what happens when two actions tie for the maximum?', a: 'Take the lowest index',
        c: ['Take the lowest index', 'Randomise between them', 'Take the one with the larger Q', 'Take the one with the smaller N'],
        e: 'Remark 8.8: <strong>we define an increasing order in action index for action selection</strong>. This is deliberately different from the greedy method\'s tie rule.' },
      { q: 'Under ε-greedy with k arms, what is the probability of taking the (unique) greedy action?', a: '1 − ε + ε/k',
        c: ['1 − ε + ε/k', '1 − ε', 'ε/k', '1 − ε/k'],
        e: 'The greedy branch gives it 1 − ε, <strong>and the random branch reaches it too</strong>, with probability ε·(1/k). Forgetting the ε/k is the single most common error in these questions.' },
      { q: 'Under ε-greedy, what is the probability of taking one specific non-greedy action?', a: 'ε/k',
        c: ['ε/k', 'ε', 'ε/(k−1)', '(1−ε)/k'],
        e: 'It can only be reached through the random branch, which fires with probability ε and then picks uniformly among all k arms — including the greedy one.' },
      { q: 'What ε turns the ε-greedy method into the greedy method?', a: 'ε = 0',
        c: ['ε = 0', 'ε = 1', 'ε = 1/k', 'ε = 0.01'],
        e: 'Exercise 6. With ε = 0 the random branch never fires, so every step is arg max<sub>a</sub> Q<sub>t</sub>(a) — Definition 8.5 exactly. <strong>ε = 1</strong> gives the random method.' },
      { q: 'What ε turns the ε-greedy method into the random method?', a: 'ε = 1',
        c: ['ε = 1', 'ε = 0', 'ε = 1/k', 'ε = 0.5'],
        e: 'Exercise 6. With ε = 1 the greedy branch never fires and every step is uniform over the k arms — Definition 8.4 exactly.' },
      { q: 'In Figure 8.4, why does the random method hover around an average reward of 0?', a: 'The action values were drawn from N(0, 1), so the average arm is worth 0',
        c: ['The action values were drawn from N(0, 1), so the average arm is worth 0', 'Because rewards are normalised', 'Because it never updates its estimates', 'Because 5000 simulations cancel out'],
        e: 'Random samples uniformly forever, so its expected reward is the mean over all arms — and the arm values themselves came from a standard normal, whose mean is 0.' },
      { q: 'Why does the greedy method under-perform ε = 0.1 in Figure 8.4?', a: 'It gets stuck on an action with a positive value and never finds better ones',
        c: ['It gets stuck on an action with a positive value and never finds better ones', 'It updates its estimates too slowly', 'It has a higher variance', 'It ignores the reward it receives'],
        e: 'Once an arm pays something positive it is greedy\'s permanent choice, since with Q₁ = 0 no untried arm can beat it. It <strong>misses the ones possibly much better than that</strong>.' },
      { q: 'Why will ε = 0.01 eventually out-perform ε = 0.1?', a: 'Both converge by the law of large numbers, and then the larger ε keeps paying more to randomise',
        c: ['Both converge by the law of large numbers, and then the larger ε keeps paying more to randomise', 'Because 0.01 explores more thoroughly', 'Because smaller ε reduces the variance of the estimates', 'Because 0.1 never finds the optimal action'],
        e: 'For <strong>any ε > 0</strong> all actions are sampled infinitely often, so all estimates converge. Once both have found the optimal action, ε = 0.1 <strong>pays a higher price as it is randomising more</strong>.' },
      { q: 'At 500 steps in Figure 8.4, which ε has the highest average reward?', a: 'ε = 0.1',
        c: ['ε = 0.1', 'ε = 0.01', 'ε = 0 (greedy)', 'ε = 1 (random)'],
        e: 'ε = 0.1 leads <em>at 500 steps</em>; ε = 0.01 wins only in the long run, and the crossover is well beyond the right edge of the plot. Read the horizon the question asks about.' },
      { q: 'What is the flaw in ε-greedy that UCB is designed to fix?', a: 'When exploring it treats all actions equally, including ones it is confident are bad',
        c: ['When exploring it treats all actions equally, including ones it is confident are bad', 'It converges too slowly', 'It requires knowing k in advance', 'It cannot handle negative rewards'],
        e: 'If Q(a₁) = 1, Q(a₂) = 10, Q(a₃) = 100, the random branch still picks each with equal probability — <strong>even if we have sampled a₁ several times and are very confident of its low value</strong>.' },
      { q: 'In UCB, what happens when N<sub>t</sub>(a) = 0?', a: 'The expression is +∞, so a counts as a maximising action',
        c: ['The expression is +∞, so a counts as a maximising action', 'The action is skipped', 'Q₁(a) = 0 is used instead', 'The term is set to c'],
        e: 'Remark 8.8. A consequence worth stating: <strong>no initial value Q₁(a) is needed</strong>, and the first k steps are forced to be a₁ … a<sub>k</sub> in index order.' },
      { q: 'In UCB<sub>t</sub>(a) = Q<sub>t</sub>(a) + c√(ln t / N<sub>t</sub>(a)), which part is the exploitation term?', a: 'Q<sub>t</sub>(a)',
        c: ['Q<sub>t</sub>(a)', 'c', 'c√(ln t / N<sub>t</sub>(a))', '√(ln t)'],
        e: 'Q<sub>t</sub>(a) → exploitation term; c → exploration <em>parameter</em>; c√(ln t / N<sub>t</sub>(a)) → exploration term. The exploration term represents the <strong>uncertainty</strong> of the estimate.' },
      { q: 'What effect does increasing the exploration parameter c have?', a: 'More exploration',
        c: ['More exploration', 'More exploitation', 'Faster convergence of Q', 'None — it cancels out'],
        e: 'The larger c, the more prone to exploration the formula is. <strong>c = 0 collapses UCB into the greedy method.</strong> A common value is √2; Exercise 8 uses c = 2.' },
      { q: 'Why is c called a parameter rather than a variable?', a: 'It is defined a priori and does not depend on the samples or other data',
        c: ['It is defined a priori and does not depend on the samples or other data', 'Because it is always √2', 'Because it appears outside the square root', 'Because it must be an integer'],
        e: 'Exactly the notes\' phrasing. Everything else in (8.5) — Q<sub>t</sub>, N<sub>t</sub>, t — is determined by what has happened; c is your choice, made before play starts.' },
      { q: 'What does √(ln t / t) → 0 as t → ∞ tell us?', a: 'Confidence intervals keep shrinking if the same action is repeatedly sampled',
        c: ['Confidence intervals keep shrinking if the same action is repeatedly sampled', 'Every action is eventually sampled infinitely often', 'UCB converges to the random method', 'The estimates converge to q⋆'],
        e: 'This is the case N<sub>t</sub>(a) = t — that arm has taken every step. The notes are careful to add that this <strong>doesn\'t mean an action will be sampled infinitely many times without any other in between</strong>.' },
      { q: 'Why does an arm you have <em>stopped</em> pulling eventually become attractive to UCB again?', a: 'ln t keeps growing while N<sub>t</sub>(a) stays fixed, so its exploration term rises',
        c: ['ln t keeps growing while N<sub>t</sub>(a) stays fixed, so its exploration term rises', 'Its Q<sub>t</sub> decays towards zero', 'The tie-breaking rule eventually favours it', 'It does not — UCB never revisits a rejected arm'],
        e: 'The numerator depends on the global clock, the denominator only on that arm. This is why UCB cannot get permanently stuck — and why the notes note an upper bound <strong>may change over time even if the action is not sampled</strong>.' },
      { q: 'What is the main difference between the k-armed bandit setting and an MDP?', a: 'There is only one state, and the reward function is unknown',
        c: ['There is only one state, and the reward function is unknown', 'Bandits have no actions', 'MDPs have no rewards', 'Bandits are deterministic'],
        e: '§8.7 gives both: <strong>the reward function is not known</strong> and must be estimated, and <strong>there is only one state</strong> — whichever action you take you return to the same choice. With more states you must estimate <strong>q⋆(s, a)</strong>.' },
      { q: 'In a richer RL problem with many states, what replaces q⋆(a)?', a: 'q⋆(s, a) — one value per state-action pair',
        c: ['q⋆(s, a) — one value per state-action pair', 'Q<sub>t</sub>(a) with a larger t', 'The Bellman equation only', 'Nothing — bandits generalise directly'],
        e: 'This is the bridge to Q-learning and everything beyond the course: the same machinery, indexed by state as well as action.' },
      { q: 'Why is the optimal action in the 10-armed testbed safe to assume unique?', a: 'The probability of two exactly equal values from a normal distribution is null',
        c: ['The probability of two exactly equal values from a normal distribution is null', 'Because the means are integers', 'Because ties are broken by index', 'Because k = 10 is small'],
        e: 'Normal distributions are continuous, so any specific value has probability zero — including the event that two arms coincide. (The same continuity fact as Week 7\'s P(exact value) = 0.)' },
      { q: 'B ∼ N(11, 4). What is B\'s standard deviation?', a: '2',
        c: ['2', '4', '16', '11'],
        e: 'N(µ, σ²) carries the <strong>variance</strong>, so σ² = 4 and σ = 2. Figure 8.1 confirms it: B\'s peak density is about 0.20 = 1/(2√(2π)).' }
    ];
    RLQ.forEach(d => QZ_GEN.push({ topic: 'rl', make: () => ({
      topic: 'reinforcement learning · concepts', kind: 'choice', prompt: d.q, choices: d.c.slice(), answer: d.a,
      check: textCheck(d.a), explain: d.e }) }));
    /* computed: Q_t(a) from a random history */
    QZ_GEN.push({ topic: 'rl', make: () => {
      const names = ['A', 'B'], n = qzInt(4, 7), rows = [];
      for (let i = 0; i < n; i++) rows.push({ a: qzPick(names), r: Math.round((qzInt(-20, 20) / 10) * 10) / 10 });
      if (!rows.some(r => r.a === 'A') || !rows.some(r => r.a === 'B')) throw new Error('retry');
      const t = qzInt(2, n + 1), who = qzPick(names);
      const got = [];
      for (let i = 0; i < t - 1; i++) if (rows[i].a === who) got.push({ i: i + 1, r: rows[i].r });
      const val = got.length ? got.reduce((x, y) => x + y.r, 0) / got.length : 0;
      return { topic: 'reinforcement learning · Q<sub>t</sub>', prompt:
        `A 2-armed bandit produced this history:`
        + `<pre>t   ${rows.map((_, i) => String(i + 1).padEnd(6)).join('')}\nA_t ${rows.map(r => r.a.padEnd(6)).join('')}\nR_t ${rows.map(r => String(r.r).padEnd(6)).join('')}</pre>`
        + `Using Definition 8.3 (and Q = 0 when the action has not been taken), what is <strong>Q<sub>${t}</sub>(${who})</strong>?`,
        placeholder: 'a number', answer: val.toFixed(4), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - val) < 0.0015 };
        },
        explain: got.length
          ? `Q<sub>t</sub> averages the steps <strong>strictly before t = ${t}</strong>. ${who} was chosen at t = ${got.map(g => g.i).join(', ')}, paying ${got.map(g => g.r).join(', ')}.`
            + `<br>Q<sub>${t}</sub>(${who}) = ${got.map(g => g.r).join(' + ').replace(/\+ -/g, '− ')} over ${got.length} = <strong>${val.toFixed(4)}</strong>.`
          : `${who} was never chosen before t = ${t}, so the count is zero and the stated convention gives <strong>Q<sub>${t}</sub>(${who}) = 0</strong>.` };
    } });
    /* computed: epsilon-greedy action probability */
    QZ_GEN.push({ topic: 'rl', make: () => {
      const k = qzInt(2, 6), eps = qzPick([0.1, 0.2, 0.25, 0.4, 0.5]);
      const Q = [];
      for (let i = 0; i < k; i++) Q.push(qzInt(0, 40) / 10);
      const mx = Math.max.apply(null, Q);
      const G = [];
      for (let i = 0; i < k; i++) if (Q[i] === mx) G.push(i);
      const which = qzInt(0, k - 1);
      const greedy = G.indexOf(which) >= 0;
      const val = eps / k + (greedy ? (1 - eps) / G.length : 0);
      return { topic: 'reinforcement learning · ε-greedy', prompt:
        `A ${k}-armed bandit under <strong>ε-greedy with ε = ${eps}</strong>. The current estimates are`
        + `<pre>${Q.map((q, i) => 'Q_t(a' + (i + 1) + ') = ' + q.toFixed(1)).join('\n')}</pre>`
        + `What is <strong>Pr(A<sub>t</sub> = a${which + 1})</strong>, to 3 decimal places?`,
        placeholder: 'a probability', answer: val.toFixed(4), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - val) < 0.0015 };
        },
        explain: `Every action gets <strong>ε/k = ${eps}/${k} = ${(eps / k).toFixed(4)}</strong> from the random branch.`
          + `<br>The maximum estimate is ${mx.toFixed(1)}, held by ${G.map(i => 'a' + (i + 1)).join(', ')}${G.length > 1 ? ' — a ' + G.length + '-way tie, and Definition 8.5 randomises among them' : ''}.`
          + (greedy
            ? `<br>a${which + 1} is greedy, so it also gets (1 − ε)/${G.length} = ${((1 - eps) / G.length).toFixed(4)}.`
              + `<br>Total = ${(eps / k).toFixed(4)} + ${((1 - eps) / G.length).toFixed(4)} = <strong>${val.toFixed(4)}</strong>.`
            : `<br>a${which + 1} is not greedy, so the random branch is its only route: <strong>${val.toFixed(4)}</strong>. Answering 0 here is the classic mistake.`) };
    } });
    /* computed: one UCB value */
    QZ_GEN.push({ topic: 'rl', make: () => {
      const t = qzInt(5, 40), N = qzInt(1, Math.min(9, t - 1));
      const Q = qzInt(-30, 60) / 10, c = qzPick([1, 2, Math.SQRT2]);
      const ex = c * Math.sqrt(Math.log(t) / N), val = Q + ex;
      const cs = Math.abs(c - Math.SQRT2) < 1e-9 ? '√2' : String(c);
      return { topic: 'reinforcement learning · UCB', prompt:
        `At step <strong>t = ${t}</strong>, an action a has <strong>Q<sub>t</sub>(a) = ${Q.toFixed(1)}</strong> and has been chosen <strong>N<sub>t</sub>(a) = ${N}</strong> time${N === 1 ? '' : 's'} before now.`
        + `<br><br>With exploration parameter <strong>c = ${cs}</strong>, what is <strong>UCB<sub>t</sub>(a)</strong>, to 3 decimal places?`,
        placeholder: 'a number', answer: val.toFixed(4), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - val) < 0.0025 };
        },
        explain: `UCB<sub>t</sub>(a) = Q<sub>t</sub>(a) + c·√(ln t / N<sub>t</sub>(a)).`
          + `<br>ln ${t} = ${Math.log(t).toFixed(4)}, so √(${Math.log(t).toFixed(4)} / ${N}) = ${Math.sqrt(Math.log(t) / N).toFixed(4)}.`
          + `<br>Exploration term = ${cs} × ${Math.sqrt(Math.log(t) / N).toFixed(4)} = <strong>${ex.toFixed(4)}</strong>.`
          + `<br>UCB = ${Q.toFixed(1)} + ${ex.toFixed(4)} = <strong>${val.toFixed(4)}</strong>.`
          + `<br><br>Two traps: it is <strong>ln</strong>, not log₁₀; and c sits <strong>outside</strong> the square root.` };
    } });
    /* computed: which arm does UCB pick next */
    QZ_GEN.push({ topic: 'rl', make: () => {
      const k = qzInt(2, 4), t = qzInt(4, 30), c = qzPick([1, 2]);
      const Q = [], N = [];
      for (let i = 0; i < k; i++) { Q.push(qzInt(-20, 60) / 10); N.push(qzInt(1, Math.min(8, t - 1))); }
      const v = Q.map((q, i) => q + c * Math.sqrt(Math.log(t) / N[i]));
      let bi = 0;
      for (let i = 1; i < k; i++) if (v[i] > v[bi] + 1e-9) bi = i;
      const ties = [];
      for (let i = 0; i < k; i++) if (Math.abs(v[i] - v[bi]) < 1e-6) ties.push(i);
      if (ties.length > 1) throw new Error('retry');
      /* only keep questions where UCB disagrees with greedy — that is the interesting case half the time */
      let gi = 0;
      for (let i = 1; i < k; i++) if (Q[i] > Q[gi] + 1e-9) gi = i;
      return { topic: 'reinforcement learning · UCB', kind: 'choice', prompt:
        `A ${k}-armed bandit at <strong>t = ${t}</strong>, with exploration parameter <strong>c = ${c}</strong>:`
        + `<pre>${Q.map((q, i) => 'a' + (i + 1) + ':  Q_t = ' + q.toFixed(1) + '   N_t = ' + N[i]).join('\n')}</pre>`
        + `Which action does UCB choose?`,
        choices: Q.map((_, i) => 'a' + (i + 1)), answer: 'a' + (bi + 1), check: textCheck('a' + (bi + 1)),
        explain: `ln ${t} = ${Math.log(t).toFixed(4)}.<br>`
          + Q.map((q, i) => `UCB(a${i + 1}) = ${q.toFixed(1)} + ${c}·√(${Math.log(t).toFixed(4)}/${N[i]}) = ${q.toFixed(1)} + ${(c * Math.sqrt(Math.log(t) / N[i])).toFixed(4)} = <strong>${v[i].toFixed(4)}</strong>`).join('<br>')
          + `<br><br>arg max is <strong>a${bi + 1}</strong>.`
          + (bi !== gi ? ` Note the greedy choice would have been a${gi + 1} — <strong>a${bi + 1} wins on the width of its interval, not on its estimate.</strong> That is Figure 8.5.` : '') };
    } });
    /* computed: random method hits the optimal action */
    QZ_GEN.push({ topic: 'rl', make: () => {
      const k = qzPick([4, 5, 8, 10, 20, 25, 50, 100]);
      const val = 1 / k;
      return { topic: 'reinforcement learning · random', prompt:
        `Consider a <strong>${k}-armed bandit</strong>. What is the probability, at each time t, that the <strong>random</strong> method selects the optimal action? Give it as a decimal to 3 places.`,
        placeholder: 'a probability', answer: val.toFixed(4), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - val) < 0.0015 };
        },
        explain: `Definition 8.4 gives every action probability 1/k, and the optimal action is unique (two equal draws from a normal distribution have probability zero).`
          + `<br>So Pr = 1/${k} = <strong>${val.toFixed(4)}</strong> — <strong>and it never improves</strong>, however long the method plays.`
          + `<br><br>By contrast ε-greedy with ε = 0.1 approaches a ceiling of 1 − ε + ε/k = ${(0.9 + 0.1 / k).toFixed(4)}.` };
    } });
    /* ---------- W9 · AI ethics ---------- */
    const ETHQ = [
      { q: 'Which pair of questions does the lecture attach to the two columns of applications?', a: '"What are the hidden risks?" for well-intentioned; "Should we even build this?" for fundamentally problematic',
        c: ['"What are the hidden risks?" for well-intentioned; "Should we even build this?" for fundamentally problematic', 'Both columns get "what are the hidden risks?"', '"Who benefits?" and "who is harmed?"', '"Is it accurate?" and "is it fast?"'],
        e: 'The distinction matters: for the left column ethics is mitigation; for the right column no mitigation is the answer, and the question is whether the system should exist at all.' },
      { q: 'The lecture links worse facial recognition on minorities to which immediate cause?', a: 'Lack of data',
        c: ['Lack of data', 'Poor camera hardware', 'Choice of loss function', 'Insufficient compute'],
        e: 'From the policing slide: <strong>worse facial recognition performance on minorities due to lack of data → wrongful arrests / stop-and-search</strong>. In the causes taxonomy that is <strong>representation bias</strong>.' },
      { q: 'Which of these is listed under "automated defense" rather than "search for specific targets"?', a: 'Easier escalation and arms races',
        c: ['Easier escalation and arms races', 'Propagation of bias into war', 'More deaths', 'Wrongful arrests'],
        e: 'Targeting → propagation of bias into war, more deaths. Automated defense → dehumanization of war, loss of moral engagement, simplification of complex moral choices, easier escalation, arms races.' },
      { q: 'How does the lecture define phrenology?', a: 'A disproved pseudoscience assuming gender, intelligence, criminality and internal states can be predicted from facial analysis',
        c: ['A disproved pseudoscience assuming gender, intelligence, criminality and internal states can be predicted from facial analysis', 'The study of skull measurements in archaeology', 'A method for facial recognition using landmarks', 'A statistical technique for measuring bias'],
        e: 'The lecture\'s charge is that current AI reviving it — predicting gender, sexuality, race, emotion, criminality from images — repeats the same error.' },
      { q: 'Why does the lecture say predicting sexuality or criminality from faces is not fixable with better data?', a: 'They are social constructs or unobservable — only the subjects can say',
        c: ['They are social constructs or unobservable — only the subjects can say', 'The datasets are too small', 'Faces change over time', 'The models are not deep enough'],
        e: 'There is no ground truth to get right, so this is <strong>measurement bias</strong> in its purest form: wrong categorization of people. No amount of collection repairs a label that was never a property of the face.' },
      { q: 'What does the lecture give as the consequence of AI being expensive?', a: 'Universities can\'t compete and poorer labs/countries can\'t afford it',
        c: ['Universities can\'t compete and poorer labs/countries can\'t afford it', 'Models become less accurate', 'Research slows down globally', 'Open source becomes dominant'],
        e: 'Compute, hardware, money to train and house, and a Big Tech monopoly. The result is that university resources get used for <strong>Big Tech\'s priority problems</strong>.' },
      { q: 'Which is NOT one of the seven harm categories?', a: 'Economic harms',
        c: ['Economic harms', 'Human agency harms', 'Accountability harms', 'Environmental harms'],
        e: 'The seven are: human agency · accountability · safety and wellbeing · privacy · fairness and dignity · societal · environmental.' },
      { q: '"Warehouse workers blamed for robot mistakes" is an example of which harm?', a: 'Accountability',
        c: ['Accountability', 'Human agency', 'Safety and wellbeing', 'Societal'],
        e: 'Specifically <strong>incorrect blaming of humans for AI failures</strong>. Accountability fails in two directions: it evaporates, or it lands on the wrong person.' },
      { q: 'Loss of the human right to contest a decision falls under which harm category?', a: 'Human agency',
        c: ['Human agency', 'Accountability', 'Fairness and dignity', 'Societal'],
        e: 'Human agency covers loss of control over algorithms, loss of the right to contest, over-delegation and loss of critical thinking — all of which can occur while the system works perfectly.' },
      { q: 'How does the lecture subdivide privacy harms?', a: 'By setting: intimate spaces, work & school, public spaces',
        c: ['By setting: intimate spaces, work & school, public spaces', 'By data type: images, text, audio', 'By actor: state, company, individual', 'By severity: minor, major, catastrophic'],
        e: 'Naming the setting is what earns the mark. "Privacy in public spaces" is the least intuitive and covers city-scale camera networks.' },
      { q: 'A hiring model shortlists fewer women. Which sub-type of fairness harm is this?', a: 'Allocative — distribution of opportunities',
        c: ['Allocative — distribution of opportunities', 'Representational — stereotyping', 'Representational — erasing', 'Allocative — distribution of resources'],
        e: '<strong>Allocative harms are about who gets things; representational harms are about how people are portrayed.</strong> A shortlist is an opportunity.' },
      { q: 'An image generator returns only men for "CEO". Which sub-type?', a: 'Representational — stereotyping',
        c: ['Representational — stereotyping', 'Allocative — quality-of-service', 'Allocative — opportunities', 'Societal — cultural'],
        e: 'Nobody is denied a resource; the harm is in the depiction. This is the lecture\'s GPT-3 / DALL·E example, captioned <strong>"All white male."</strong>' },
      { q: 'Speech recognition works worse for some accents but is offered to everyone. Which sub-type?', a: 'Allocative — distribution of quality-of-service',
        c: ['Allocative — distribution of quality-of-service', 'Representational — alienating', 'Representational — erasing', 'Allocative — distribution of resources'],
        e: '<strong>Quality-of-service</strong> is the sub-type most often missed: the service is available to all, just not at the same standard. Gender Shades and pedestrian detection are both this.' },
      { q: 'Which is a representational sub-type meaning "cast as not belonging"?', a: 'Alienating',
        c: ['Alienating', 'Demeaning', 'Erasing', 'Essentialising'],
        e: 'The six representational sub-types: stereotyping · demeaning (less deserving of respect) · erasing · <strong>alienating (not belonging)</strong> · loss of opportunity to self-identify · essentialist social categories.' },
      { q: 'Junior radiologists never learn to read scans unaided. Which harm?', a: 'Societal — deskilling',
        c: ['Societal — deskilling', 'Human agency — over-delegation', 'Accountability', 'Safety and wellbeing'],
        e: '<strong>Over-delegation</strong> (agency) is about this decision being handed over now; <strong>deskilling</strong> (societal) is about the capability being lost across a profession, so nobody could take it back.' },
      { q: 'Which environmental harm is about what AI is used FOR rather than its own footprint?', a: 'AI and robots for the oil & gas industry',
        c: ['AI and robots for the oil & gas industry', 'Energy consumption and pollution', 'Mineral mining for datacentres', 'GPU manufacturing'],
        e: 'The three environmental items are energy/pollution, mineral mining for datacentres, and <strong>AI and robots for oil & gas</strong> — a perfectly efficient model that finds new oil reserves is still an environmental harm by this taxonomy.' },
      { q: 'Which of these is a type of harm REPARATION rather than anticipation?', a: 'Product discontinuation',
        c: ['Product discontinuation', 'Ablation studies', 'Ethnography', 'Measuring performance differences between social groups'],
        e: 'Reparation happens <em>after</em> harm — outcry, perpetrator communication, investigation, legal action, legal repercussions, compensation, removal, discontinuation, design changes, law change. The other three are anticipation methods.' },
      { q: 'Which family of harm-anticipation methods does "ethnography" belong to?', a: 'Qualitative methods',
        c: ['Qualitative methods', 'Quantitative measurement', 'Ablation studies', 'Critique'],
        e: 'The four families: quantitative measurement, ablation studies, <strong>qualitative methods</strong> (interviews, surveys, workshops, literature reviews, ethnography) and critique (speculation, logical or philosophical argument).' },
      { q: 'What is an ablation study, as the lecture describes it?', a: 'Removing/changing data or algorithm parameters and observing the results',
        c: ['Removing/changing data or algorithm parameters and observing the results', 'Interviewing affected communities', 'Auditing a deployed system externally', 'Measuring carbon emissions of training'],
        e: 'One of the four anticipation families. It sits between the purely quantitative and the qualitative: you intervene, then measure.' },
      { q: 'What is direct discrimination also called?', a: 'Disparate treatment',
        c: ['Disparate treatment', 'Disparate impact', 'Representational harm', 'World bias'],
        e: '<strong>Direct = disparate treatment</strong> (disadvantaged because of a personal attribute). <strong>Indirect = disparate impact</strong> (disadvantaged even though the attribute is not explicitly considered).' },
      { q: 'A model uses postcode, which correlates with race, and disadvantages one group. This is…', a: 'Indirect discrimination',
        c: ['Indirect discrimination', 'Direct discrimination', 'Not discrimination, since race is not used', 'World bias only'],
        e: 'Indirect discrimination = disparate impact: <strong>disadvantage even though the attribute is not explicitly considered</strong>. Deleting the protected attribute rules out direct discrimination and leaves indirect untouched.' },
      { q: 'The lecture gives bias two senses in AI ethics. What are they?', a: 'Imbalance or tendency in data (input), and direct or indirect discrimination (output)',
        c: ['Imbalance or tendency in data (input), and direct or indirect discrimination (output)', 'Statistical bias and variance', 'Conscious and unconscious bias', 'Training bias and inference bias'],
        e: 'Connected but distinct: imbalanced data does not automatically produce discrimination, and discrimination can arise from balanced data via the label, the objective or the metric.' },
      { q: 'Which of the five causes of discrimination is NOT marked as the developer\'s fault?', a: 'World bias',
        c: ['World bias', 'Representation bias', 'Algorithm bias', 'Evaluation bias'],
        e: 'World bias is the world distribution problem — the data is an accurate record of an unequal world, so no better collection fixes it. <strong>The other four all carry the ★.</strong>' },
      { q: 'A team reports one accuracy figure on a test set drawn the same way as the training set. Which cause?', a: 'Evaluation bias',
        c: ['Evaluation bias', 'Representation bias', 'Algorithm bias', 'Measurement bias'],
        e: '<strong>Wrong choice of evaluation metric or test set.</strong> The model might be fine and only the measurement of it broken — that is what separates evaluation bias from algorithm bias.' },
      { q: 'Using "re-arrest" as the label for "reoffending" is which cause?', a: 'Measurement bias',
        c: ['Measurement bias', 'World bias', 'Representation bias', 'Evaluation bias'],
        e: '<strong>Wrong measurement</strong> — re-arrest measures policing as much as offending. This is how the ProPublica-style disparity arises.' },
      { q: 'An objective that maximises average accuracy sacrifices a small group. Which cause, and which fix?', a: 'Algorithm bias — fixed by a fairness function',
        c: ['Algorithm bias — fixed by a fairness function', 'Evaluation bias — fixed by a better test set', 'Representation bias — fixed by resampling', 'World bias — no fix exists'],
        e: '<strong>Wrong choice of algorithm</strong>, and the lecture\'s remedy is the fairness-functions bullet: maximise the <em>minimum</em> accuracy instead of the average.' },
      { q: 'What did the ProPublica "Machine Bias" investigation find?', a: 'The algorithm more often mistakenly predicted high-risk for Black than White defendants',
        c: ['The algorithm more often mistakenly predicted high-risk for Black than White defendants', 'The algorithm refused to score Black defendants', 'The algorithm used race as an explicit input', 'The algorithm was less accurate overall than judges'],
        e: 'Note the precision: it is about <strong>mistaken</strong> high-risk predictions — a false-positive-rate difference between groups, not simply different score distributions.' },
      { q: 'In the Gender Shades table on the slide, roughly what error rate do the worst systems reach on the darkest skin type?', a: 'About 47%',
        c: ['About 47%', 'About 25%', 'About 10%', 'About 5%'],
        e: 'Face++ 46.5% and IBM 46.8% — close to a coin flip on a <em>binary</em> task, against near-zero error on the lightest types. Microsoft\'s best-to-worst span is 0% (Type IV) to 25% (Type VI).' },
      { q: 'Why is the Gender Shades result described as "intersectional"?', a: 'The disparity is far larger for combinations of attributes than for either attribute alone',
        c: ['The disparity is far larger for combinations of attributes than for either attribute alone', 'It tested three companies at once', 'It combined images and text', 'It used intersecting training sets'],
        e: 'A system can look nearly even across gender overall and across skin type overall, yet fail badly at the intersection. <strong>Checking one attribute at a time is not enough.</strong>' },
      { q: 'The lecture notes who is discovering these issues. What does it conclude?', a: 'The importance of lived experience and diversity',
        c: ['The importance of lived experience and diversity', 'The importance of larger datasets', 'The importance of peer review', 'The importance of regulation'],
        e: 'Women, Black scholars, LGBTQ researchers. The argument is practical: <strong>you cannot test for a harm you have not imagined</strong>, which is why team diversity is proposed as an error-detection mechanism.' },
      { q: 'Which principle covers "documentation and logging of data/decisions, explainability, informing when AI is used"?', a: 'Transparency',
        c: ['Transparency', 'Accountability', 'Human oversight and agency', 'Safety and robustness'],
        e: 'Careful with the neighbour: <strong>accountability</strong> is auditability, documenting how dilemmas and trade-offs were resolved, and responsibility for harms.' },
      { q: 'Which principle covers "auditability, documenting how dilemmas and trade-offs were resolved, responsibility for harms"?', a: 'Accountability',
        c: ['Accountability', 'Transparency', 'Fairness', 'Human oversight and agency'],
        e: 'Note what it asks for: not <em>avoiding</em> trade-offs but <strong>recording how you made them</strong>.' },
      { q: 'Which principle covers "consent, anonymity, access, de-anonymization"?', a: 'Privacy',
        c: ['Privacy', 'Safety and robustness', 'Transparency', 'Accountability'],
        e: 'The seven principles map almost one-to-one onto the seven harms, with transparency as the extra — so if you can recall the harms you can reconstruct the table.' },
      { q: 'What does the lecture mean by "Trustworthy AI"?', a: 'Design AND governance that leads to AI we can trust',
        c: ['Design AND governance that leads to AI we can trust', 'A model that reports its own confidence', 'An externally audited model', 'A model trained on verified data'],
        e: 'The capitalised AND is the lecture\'s emphasis: a perfectly principled system inside an ungoverned organisation is not trustworthy, and vice versa.' },
      { q: 'Reweighting and resampling differ how?', a: 'Reweighting changes each example\'s weight in training; resampling changes how often it is drawn',
        c: ['Reweighting changes each example\'s weight in training; resampling changes how often it is drawn', 'They are two names for the same method', 'Reweighting happens after training, resampling before', 'Reweighting applies to features, resampling to labels'],
        e: 'Both are bias-mitigation methods that leave the dataset itself alone — unlike <strong>dataset curation</strong>, which changes the data. Treating them as synonyms loses an easy mark.' },
      { q: 'What does the "fairness functions" mitigation actually change?', a: 'The training objective — e.g. maximise minimum accuracy instead of average accuracy',
        c: ['The training objective — e.g. maximise minimum accuracy instead of average accuracy', 'The dataset composition', 'The evaluation test set', 'The deployment threshold'],
        e: 'Or: maximise accuracy while minimising performance differences. It is the mitigation aimed squarely at <strong>algorithm bias</strong>.' },
      { q: 'What does differential privacy protect that plain anonymization does not?', a: 'Whether a given person is in the dataset at all',
        c: ['Whether a given person is in the dataset at all', 'The accuracy of the model', 'The identity of the data collector', 'The training source code'],
        e: 'Releasing information <strong>in a way that does not allow you to know if a person is part of that dataset</strong>, usually by adding noise to computations in a smart way. If the dataset is "patients treated for X", membership is the sensitive fact.' },
      { q: 'Which is a named environmental mitigation method?', a: 'Code emission estimation, e.g. CodeCarbon',
        c: ['Code emission estimation, e.g. CodeCarbon', 'Differential privacy', 'Reweighting', 'Participatory design'],
        e: 'Two are named: emission estimation methods, and <strong>solving problems with smaller models</strong>. Measure first, then reduce.' },
      { q: 'Why does the lecture hold developers responsible for harms?', a: 'Many harms are best anticipated by them and can only be tested or minimized by them',
        c: ['Many harms are best anticipated by them and can only be tested or minimized by them', 'They have the most to gain financially', 'They sign off the deployment decision', 'They own the training data'],
        e: '<strong>Responsibility follows capability</strong>, not blame. Developers are also named as responsible for algorithm transparency, inefficiency and power consumption.' },
      { q: 'Besides developers, who else does the lecture hold responsible?', a: 'The institution that designs the system, and the ethics board',
        c: ['The institution that designs the system, and the ethics board', 'Only the end users', 'Only the regulator', 'Only management'],
        e: 'The institution <strong>for allowing any of the harms to take place</strong>, the ethics board <strong>for passing an unethical product/application</strong>. The conclusion slide adds managers.' },
      { q: 'Which item on the "minimising harms" list is the remedy when the organisation decides to proceed anyway?', a: 'Whistleblowing',
        c: ['Whistleblowing', 'Ethics boards', 'Participatory design', 'Balanced datasets'],
        e: 'It is last on the list for a reason: <strong>every other item assumes good faith.</strong> It is the remedy for the second causes branch — obvious risk, problematic task, deployed regardless.' },
      { q: 'Why does the lecture recommend team diversity?', a: 'Marginalized communities have different lived experience, which is important to anticipate issues',
        c: ['Marginalized communities have different lived experience, which is important to anticipate issues', 'It improves model accuracy directly', 'It is required by the EU AI Act', 'It reduces training costs'],
        e: 'The argument is about <strong>error detection</strong>: you cannot test for a harm you have not imagined, and what gets imagined is bounded by who is in the room.' }
    ];
    ETHQ.forEach(d => QZ_GEN.push({ topic: 'ethics', make: () => ({
      topic: 'AI ethics · concepts', kind: 'choice', prompt: d.q, choices: d.c.slice(), answer: d.a,
      check: textCheck(d.a), explain: d.e }) }));
    /* generated: classify a case into one of the seven harms */
    QZ_GEN.push({ topic: 'ethics', make: () => {
      const c = qzPick(HARM_CASES);
      const nm = k => HARMS.filter(h => h.k === k)[0].n;
      return { topic: 'AI ethics · harm taxonomy', kind: 'choice',
        prompt: `Which harm category would the lecture file this under?<br><br><em>${c.q}</em>`,
        choices: HARMS.map(h => h.n), answer: nm(c.a), check: textCheck(nm(c.a)), explain: c.e };
    } });
    /* generated: name the cause of discrimination */
    QZ_GEN.push({ topic: 'ethics', make: () => {
      const c = qzPick(BIAS_CASES);
      const nm = k => BIAS.filter(b => b.k === k)[0].n;
      return { topic: 'AI ethics · causes of bias', kind: 'choice',
        prompt: `Which cause of discrimination does the lecture name here?<br><br><em>${c.q}</em>`,
        choices: BIAS.map(b => b.n), answer: nm(c.a), check: textCheck(nm(c.a)), explain: c.e };
    } });
    /* generated: developer's fault or not */
    QZ_GEN.push({ topic: 'ethics', make: () => {
      const b = qzPick(BIAS);
      return { topic: 'AI ethics · responsibility', kind: 'choice',
        prompt: `Is <strong>${b.n}</strong> (${b.d.toLowerCase().replace(/\.$/, '')}) marked as the developer's fault on the causes slide?`,
        choices: ['Yes', 'No'], answer: b.dev ? 'Yes' : 'No', check: textCheck(b.dev ? 'Yes' : 'No'),
        explain: b.dev
          ? `<strong>Yes</strong> — it carries the ★. Four of the five causes do; the only exception is <strong>world bias</strong>, because the data is an accurate record of an unequal world.`
          : `<strong>No</strong> — world bias is the one cause without the ★, since no amount of better data collection fixes a faithful record of an unequal world. That does not make deploying it acceptable.` };
    } });
    /* generated: match a principle to its description */
    QZ_GEN.push({ topic: 'ethics', make: () => {
      const i = Math.floor(Math.random() * PRINCIPLES.length) % PRINCIPLES.length;
      const p = PRINCIPLES[i];
      return { topic: 'AI ethics · principles', kind: 'choice',
        prompt: `Which ethical principle does this description belong to?<br><br><em>${p.d}</em>`,
        choices: PRINCIPLES.map(x => x.n.replace(/&amp;/g, '&')), answer: p.n.replace(/&amp;/g, '&'),
        check: textCheck(p.n.replace(/&amp;/g, '&')),
        explain: `The seven principles mirror the seven harms almost one-to-one, with <strong>transparency</strong> as the extra. Recall the harms and you can reconstruct the table.` };
    } });
    /* computed: fairness objectives disagree */
    QZ_GEN.push({ topic: 'ethics', make: () => {
      const nMaj = qzInt(85, 97), nMin = 100 - nMaj;
      const aMaj1 = qzInt(90, 98), aMin1 = qzInt(35, 60);
      const aMaj2 = qzInt(80, aMaj1 - 3), aMin2 = qzInt(aMin1 + 15, 92);
      const ovr1 = (aMaj1 * nMaj + aMin1 * nMin) / 100;
      const ovr2 = (aMaj2 * nMaj + aMin2 * nMin) / 100;
      if (ovr2 >= ovr1) throw new Error('retry');
      if (aMin2 <= aMin1) throw new Error('retry');
      const which = qzPick(['overall (weighted) accuracy', 'minimum accuracy']);
      const ans = which === 'minimum accuracy' ? 'Model B' : 'Model A';
      return { topic: 'AI ethics · fairness functions', kind: 'choice', prompt:
        `Two models on a population that is <strong>${nMaj}% group A</strong> and <strong>${nMin}% group B</strong>:`
        + `<pre>            group A    group B\nModel A      ${aMaj1}%        ${aMin1}%\nModel B      ${aMaj2}%        ${aMin2}%</pre>`
        + `Which model does <strong>maximising ${which}</strong> select?`,
        choices: ['Model A', 'Model B'], answer: ans, check: textCheck(ans),
        explain: `Overall accuracy weights by group size: Model A = ${ovr1.toFixed(2)}%, Model B = ${ovr2.toFixed(2)}% → <strong>Model A wins on the average</strong>.`
          + `<br>Minimum accuracy is the worst group: Model A = ${aMin1}%, Model B = ${aMin2}% → <strong>Model B wins on the minimum</strong>.`
          + `<br><br>This is exactly the lecture's <strong>fairness functions</strong> bullet — “instead of maximizing average accuracy → maximize minimum accuracy”. `
          + `Group B is only ${nMin}% of the data, so its ${aMin1}% accuracy barely moves the overall number: <strong>the accuracy trap, arriving as evaluation bias.</strong>` };
    } });
    /* computed: classification metric from a confusion matrix */
    QZ_GEN.push({ topic: 'ml', make: () => {
      const tp = qzInt(2, 90), fp = qzInt(0, 60), fn = qzInt(1, 60), tn = qzInt(20, 400);
      const which = qzPick(['accuracy', 'precision', 'recall', 'F1']);
      const acc = (tp + tn) / (tp + fp + fn + tn), prec = tp / (tp + fp), rec = tp / (tp + fn);
      const f1 = 2 * prec * rec / (prec + rec);
      const val = { accuracy: acc, precision: prec, recall: rec, F1: f1 }[which];
      const form = { accuracy: `(TP+TN)/total = (${tp}+${tn})/${tp + fp + fn + tn}`,
        precision: `TP/(TP+FP) = ${tp}/(${tp}+${fp})`, recall: `TP/(TP+FN) = ${tp}/(${tp}+${fn})`,
        F1: `2PR/(P+R) with P = ${prec.toFixed(4)}, R = ${rec.toFixed(4)}` }[which];
      const ans = +val.toFixed(3);
      return { topic: 'ML · metrics', prompt:
        `A classifier on a test set gives:<pre>TP = ${tp}    FP = ${fp}\nFN = ${fn}    TN = ${tn}</pre>What is the <strong>${which}</strong>, to 3 decimal places?`,
        placeholder: '0.000', answer: String(ans), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number between 0 and 1.' };
          return { ok: Math.abs(x - val) < 0.0015 };
        },
        explain: `<code>${which} = ${form} = <strong>${val.toFixed(4)}</strong></code>.<br><br>All four for this matrix: accuracy ${acc.toFixed(3)}, precision ${prec.toFixed(3)}, recall ${rec.toFixed(3)}, F1 ${f1.toFixed(3)}. Paste the counts into the <strong>confusion matrix tool</strong> to see them all at once.` };
    } });
    /* computed: regression metric */
    QZ_GEN.push({ topic: 'ml', make: () => {
      const n = qzInt(4, 6), pred = [], truev = [];
      for (let i = 0; i < n; i++) { const y = qzInt(0, 20); truev.push(y); pred.push(y + qzPick([-3, -2, -1, 0, 1, 2, 3, 4])); }
      let sa = 0, sq = 0;
      for (let i = 0; i < n; i++) { const e = pred[i] - truev[i]; sa += Math.abs(e); sq += e * e; }
      if (sa === 0) throw new Error('retry');
      const which = qzPick(['MAE', 'MSE', 'RMSE']);
      const val = which === 'MAE' ? sa / n : which === 'MSE' ? sq / n : Math.sqrt(sq / n);
      const ans = +val.toFixed(3);
      const form = which === 'MAE' ? `(1/n)Σ|ŷ−y| = ${sa}/${n}` : which === 'MSE' ? `(1/n)Σ(ŷ−y)² = ${sq}/${n}` : `√(${sq}/${n})`;
      return { topic: 'ML · regression metrics', prompt:
        `Predictions and true values:<pre>ŷ = ${pred.join(', ')}\ny = ${truev.join(', ')}</pre>What is the <strong>${which}</strong>, to 3 decimal places?`,
        placeholder: 'a number', answer: String(ans), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
          return { ok: Math.abs(x - val) < 0.0015 };
        },
        explain: `<code>${which} = ${form} = <strong>${val.toFixed(4)}</strong></code>.<br><br>For this data: MAE ${(sa / n).toFixed(3)}, MSE ${(sq / n).toFixed(3)}, RMSE ${Math.sqrt(sq / n).toFixed(3)}. Note <strong>RMSE ≥ MAE</strong> — always.` };
    } });
    /* computed: diagnose under/overfitting from two errors */
    QZ_GEN.push({ topic: 'ml', make: () => {
      const cases = [
        { tr: '1.89e−01', va: '3.79e−01', a: 'Underfitting', e: 'Both errors are high and of a similar size — the model is too simple to capture the pattern at all. This is the slides\' degree-1 straight line.' },
        { tr: '6.91e−03', va: '1.20e−02', a: 'About right', e: 'Both errors are low and close to each other. This is the bottom of the U — the slides\' degree 4.' },
        { tr: '3.22e−03', va: '1.76e+15', a: 'Overfitting', e: 'The <em>best</em> training error of the three, and a validation error fifteen orders of magnitude worse than a straight line. This is the slides\' degree 29.' },
        { tr: '2.0e−04', va: '9.1e−01', a: 'Overfitting', e: 'Training error near zero with validation error high is the signature of memorising the noise.' },
        { tr: '4.4e−01', va: '4.6e−01', a: 'Underfitting', e: 'Both high, both close: the model is not even fitting the data it was given.' }
      ];
      const c = qzPick(cases);
      const numOf = v => Number(String(v).replace(/\u2212/g, '-').replace(/\u2013|\u2014/g, '-'));
      const trv = numOf(c.tr), vav = numOf(c.va);
      const ratio = trv > 0 ? vav / trv : Infinity;
      const rtxt = !isFinite(ratio) ? 'enormous'
        : ratio >= 1e6 ? ratio.toExponential(1) + '\u00d7'
        : ratio.toFixed(1) + '\u00d7';
      return { topic: 'ML · diagnosis', kind: 'choice', prompt:
        `A model gives:<pre>Train MSE      = ${c.tr}\nValidation MSE = ${c.va}</pre>What is happening?`,
        choices: ['Underfitting', 'Overfitting', 'About right'], answer: c.a, check: textCheck(c.a),
        explain: c.e
          + `<br><br><strong>Work the gap as a ratio, not a subtraction.</strong> Here validation \u00f7 training = ${vav} / ${trv} = <strong>${rtxt}</strong>.`
          + ' Roughly: <strong>1\u20133\u00d7 is close, 10\u00d7 or more is a real gap.</strong>'
          + '<br><br>Then use the two numbers for two different jobs:'
          + '<br>\u2022 <strong>the gap</strong> tells you about <strong>overfitting</strong>'
          + '<br>\u2022 <strong>the level</strong> of the training error tells you about <strong>underfitting</strong>'
          + '<br><br>big gap \u2192 overfitting \u00b7 small gap + high level \u2192 underfitting \u00b7 small gap + low level \u2192 about right.'
          + '<br><br><span style="color:var(--ink-muted);">Reminder: 6.91e-03 means 0.00691, and 1.76e+15 means 1,760,000,000,000,000.</span>' };
    } });
    /* computed: expected value of a small gamble */
    QZ_GEN.push({ topic: 'mdp', make: () => {
      const p = qzPick([0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 0.8]);
      const a = qzInt(0, 12), b = qzInt(0, 12);
      if (a === b) throw new Error('retry');
      const ans = +(p * a + (1 - p) * b).toFixed(4);
      return { topic: 'expected value', prompt:
        `A gamble pays <strong>£${a}</strong> with probability <strong>${p}</strong> and <strong>£${b}</strong> otherwise.<br><br>What is <code>E[U]</code>?`,
        placeholder: 'a number', answer: String(ans), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          return isNaN(x) ? { ok: false, msg: 'Give a number.' } : { ok: Math.abs(x - ans) < 0.005 };
        },
        explain: `<code>E[U] = Σ P(c)U(c) = ${p}×${a} + ${+(1 - p).toFixed(4)}×${b} = <strong>${ans}</strong></code>. The two probabilities must sum to 1 — miss an outcome and the answer is wrong.` };
    } });
    /* computed: E[U|s,a] on the standard grid with U0 */
    QZ_GEN.push({ topic: 'mdp', make: () => {
      const G = mdpParse('.  .  .  +1\n.  #  .  -1\nS  .  .  .');
      const which = qzPick(['final', '0']);
      const S = mdpVI(G, -0.04, 1, 0.8, 1e-9, 2000);
      const U = which === '0' ? S.hist[0] : S.U;
      const cells = [];
      for (let x = 0; x < G.W; x++) for (let y = 0; y < G.H; y++) if (!G.g[x][y].wall && !G.g[x][y].term) cells.push([x, y]);
      const c = qzPick(cells), act = qzPick(MDP_ACTS);
      const ans = +mdpEU(G, U, c[0], c[1], act, 0.8).toFixed(4);
      const outs = mdpOutcomes(G, c[0], c[1], act, 0.8)
        .map(o => `${o.p.toFixed(1)}×U(${o.x + 1},${o.y + 1})=${o.p.toFixed(1)}×${U[o.x][o.y].toFixed(3)}`).join(' + ');
      const grid = [];
      for (let i = 0; i < G.H; i++) { const r = []; const y = G.H - 1 - i;
        for (let x = 0; x < G.W; x++) r.push(G.g[x][y].wall ? '  ####' : (U[x][y] >= 0 ? ' ' : '') + U[x][y].toFixed(3));
        grid.push(r.join('  ')); }
      return { topic: 'MDP · expected utility', prompt:
        `Standard 4×3 grid, 0.8 intended / 0.1 each side, blocked ⇒ stay put. ${which === '0' ? '<strong>U₀</strong>' : '<strong>Converged U</strong>'}:<pre>${grid.join('\n')}</pre>`
        + `What is <code>E[U | (${c[0] + 1},${c[1] + 1}), ${act.name}]</code> = Σ P(s′|s,a)U(s′)?<br><span style="font-size:12px;">(columns numbered 1–4 from the left, rows 1–3 from the bottom)</span>`,
        placeholder: 'to 3 decimal places', answer: String(ans), check: v => {
          const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
          return isNaN(x) ? { ok: false, msg: 'Give a number.' } : { ok: Math.abs(x - ans) < 0.006 };
        },
        explain: `<code>${outs} = <strong>${ans}</strong></code>. Then the Bellman update would give U′ = R + γ·max over <em>all four</em> actions — this is just one of them. Use the <strong>Bellman calculator</strong> to see all four side by side.` };
    } });
    /* computed: policy at a cell for a given R(s) */
    QZ_GEN.push({ topic: 'mdp', make: () => {
      const G = mdpParse('.  .  .  +1\n.  #  .  -1\nS  .  .  .');
      const r = qzPick([-1.65, -0.4, -0.04, -0.01]);
      const S = mdpVI(G, r, 1, 0.8, 1e-9, 3000);
      const P = mdpPolicy(G, S.U, 0.8);
      const cells = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
      const c = qzPick(cells);
      const a = P[c[0]][c[1]];
      if (!a) throw new Error('retry');
      return { topic: 'MDP · policy', kind: 'choice', prompt:
        `Standard 4×3 grid (+1 at column 4 row 3, −1 at column 4 row 2, wall at column 2 row 2), 0.8/0.1/0.1 actions, γ = 1, <strong>R(s) = ${r}</strong>.<br><br>What is the optimal action at <strong>(${c[0] + 1}, ${c[1] + 1})</strong>?`,
        choices: ['Up', 'Down', 'Left', 'Right'], answer: a.name, check: textCheck(a.name),
        explain: `π(${c[0] + 1},${c[1] + 1}) = <strong>${a.arrow} ${a.name}</strong> when R(s) = ${r}. Remember the regimes: very negative R makes the agent rush for <em>any</em> exit, R ≈ −0.04 balances risk against speed, and R close to 0 makes it refuse all risk. Run it in the <strong>reward sweep</strong> tool.` };
    } });
    /* computed: RPG heuristic of a random blocks state */
    QZ_GEN.push({ topic: 'planning', make: () => {
      const blocks = ['A', 'B', 'C'];
      const states = [
        { s: ['onCA', 'onAT', 'onBT', 'clearB', 'clearC'], d: 'C on A; A and B on the table' },
        { s: ['onAT', 'onBT', 'onCT', 'clearA', 'clearB', 'clearC'], d: 'all three on the table' },
        { s: ['onAB', 'onBT', 'onCT', 'clearA', 'clearC'], d: 'A on B; B and C on the table' },
        { s: ['onBC', 'onCT', 'onAT', 'clearA', 'clearB'], d: 'B on C; C and A on the table' },
        { s: ['onCB', 'onBA', 'onAT', 'clearC'], d: 'C on B on A' }
      ];
      const st = qzPick(states);
      const goal = ['onAB', 'onBC'];
      const G = rpgBuild(blocks, st.s, goal, 40);
      if (!G.found) throw new Error('retry');
      const E = rpgExtract(G, goal);
      return { topic: 'planning · RPG', prompt:
        `Blocks World, one action <code>Put X on Y from Z</code>. Goal: <strong>onAB, onBC</strong> (A on B on C).<br><br>State: <strong>${st.d}</strong><pre>${st.s.join('  ')}</pre>What is <strong>h<sub>RPG</sub></strong> for this state?`,
        placeholder: 'a number', answer: String(E.h), check: numCheck(E.h),
        explain: `<strong>h = ${E.h}</strong>. The goals first all appear in fact layer <strong>f(${E.m})</strong>, and the extracted relaxed plan is: ${E.h ? E.chosen.map((o, i) => 'O<sub>' + i + '</sub> = {' + o.map(a => a.pretty).join(', ') + '}').join(' · ') : 'empty — the goals already hold'}. Remember h counts <em>actions</em>, not layers. Paste the state into the RPG builder to see the graph.` };
    } });
  })();

  /* Interactive state, exposed so you can poke at it from the browser console:
     KM.pts, KM.mu, KM.frames … then call kmRender() to redraw. */
  /* initialise on load */
