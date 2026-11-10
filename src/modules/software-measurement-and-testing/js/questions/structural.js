  /* ---------- Topic 03 · structural testing ---------- */

  var SMEMO = {};
  function sonce(key, fn) {
    if (!(key in SMEMO)) SMEMO[key] = fn();
    return SMEMO[key];
  }

  /* ---- the cyclomatic number of a generated graph ---- */

  QZ_GEN.push({ topic: 'structural', make: function () {
    /* A random program-shaped graph: a spine, plus a few branches and
       at most one loop. The answer comes from running sgCyclomatic on
       it, not from a formula typed here twice. */
    var n = qzInt(4, 7);
    var nodes = [], edges = [], i;
    for (i = 0; i < n; i++) nodes.push(i);
    for (i = 0; i + 1 < n; i++) edges.push([i, i + 1]);
    var extra = qzInt(0, 2);
    for (i = 0; i < extra; i++) {
      var a = qzInt(0, n - 3), b = qzInt(a + 2, n - 1);
      if (!edges.some(function (e) { return e[0] === a && e[1] === b; })) edges.push([a, b]);
    }
    if (qzInt(0, 1)) {
      var s = qzInt(1, n - 2);
      if (!edges.some(function (e) { return e[0] === s && e[1] === s; })) edges.push([s, s]);
    }
    var g = { nodes: nodes, edges: edges };
    var v = sgCyclomatic(g);
    var desc = edges.map(function (e) { return e[0] + '&rarr;' + e[1]; }).join(', ');
    return {
      topic: 'structural · cyclomatic number',
      prompt: 'A graph on nodes <code>0&hellip;' + (n - 1) + '</code> with edges <code>' +
        desc + '</code>. What is <code>V(G)</code>?',
      placeholder: 'a number',
      answer: String(v),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === v };
      },
      explain: '<code>#edges &minus; #nodes + 2 = ' + edges.length + ' &minus; ' + n +
        ' + 2 = <strong>' + v + '</strong></code>. Count the edges carefully: a self-loop ' +
        'is an edge like any other, and it is the one people miss.'
    };
  } });

  /* ---- DD-paths of a generated graph ---- */

  QZ_GEN.push({ topic: 'structural', make: function () {
    var chain = qzInt(2, 4);                 /* statements in a row */
    var nodes = [], edges = [], i, n = chain + 4;
    for (i = 0; i < n; i++) nodes.push(i);
    /* 0 branches to a chain and to a single node; both meet at n-2,
       which goes to the terminal n-1. */
    edges.push([0, 1]);
    for (i = 1; i < chain; i++) edges.push([i, i + 1]);
    edges.push([chain, n - 2]);
    edges.push([0, n - 3]);
    edges.push([n - 3, n - 2]);
    edges.push([n - 2, n - 1]);
    var g = { nodes: nodes, edges: edges };
    var dd = sgDDPaths(g);
    return {
      topic: 'structural · DD-paths',
      prompt: 'A graph on <code>0&hellip;' + (n - 1) + '</code> with edges <code>' +
        edges.map(function (e) { return e[0] + '&rarr;' + e[1]; }).join(', ') +
        '</code>. How many DD-paths does it have?',
      placeholder: 'a number',
      answer: String(dd.length),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === dd.length };
      },
      explain: 'They are <code>' +
        dd.map(function (p) { return p.length === 1 ? String(p[0]) : '{' + p.join(',') + '}'; })
          .join('</code>, <code>') + '</code> &mdash; <strong>' + dd.length +
        '</strong>. Every node whose indegree or outdegree is not 1 stands alone; the ' +
        'rest collapse into maximal chains.'
    };
  } });

  /* ---- the ladder, in order ---- */

  QZ_GEN.push({ topic: 'structural', make: function () {
    var i = qzInt(0, SG_CRITERIA.length - 1);
    var c = SG_CRITERIA[i];
    return {
      topic: 'structural · adequacy criteria',
      kind: 'choice',
      prompt: 'Which criterion is also called <strong>' + c.also + '</strong>?',
      choices: SG_CRITERIA.map(function (x) { return x.name; }),
      answer: c.name,
      check: textCheck(c.name),
      explain: '<code>' + c.also + '</code> is the other name for <strong>' + c.name +
        '</strong>. The six run weakest to strongest: all nodes, all edges, all prime ' +
        'paths, dependent pairs, multiple conditions, all paths.'
    };
  } });

  /* ---- finite feasibility ---- */

  QZ_GEN.push({ topic: 'structural', make: function () {
    return {
      topic: 'structural · finite feasibility',
      kind: 'choice',
      prompt: 'Restricting every criterion to the <em>reachable</em> nodes, edges and ' +
        'paths does not fix finite feasibility. Why not?',
      choices: ['reachability is undecidable in general',
                'the reachable set can still be infinite for loops',
                'unreachable code is not allowed in a flow graph',
                'reachability depends on the test set rather than the program'],
      answer: 'reachability is undecidable in general',
      check: textCheck('reachability is undecidable in general'),
      explain: 'Asking only for the reachable parts makes each criterion satisfiable in ' +
        'principle, and leaves you unable to decide what you are asking for. In practice ' +
        'the infeasible parts of a program are argued about by hand.'
    };
  } });

  /* ---- prime vs simple ---- */

  QZ_GEN.push({ topic: 'structural', make: function () {
    var names = ['the prime path example', 'the DD-path example', 'one loop',
                 'a branch and a loop'];
    var which = names[qzInt(0, names.length - 1)];
    var g = SG_GRAPHS[which];
    var counts = sonce('pp:' + which, function () {
      return { simple: sgSimplePaths(g).length, prime: sgPrimePaths(g).length };
    });
    return {
      topic: 'structural · prime paths',
      prompt: 'A graph with edges <code>' +
        g.edges.map(function (e) { return e[0] + '&rarr;' + e[1]; }).join(', ') +
        '</code> has <strong>' + counts.simple + '</strong> simple paths. How many of ' +
        'them are prime?',
      placeholder: 'a number',
      answer: String(counts.prime),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === counts.prime };
      },
      explain: '<strong>' + counts.prime + '</strong>. A prime path is a simple path that ' +
        'no other simple path contains as a sub-path, so everything that sits inside a ' +
        'longer route disappears &mdash; which is most of them.'
    };
  } });

  /* ---- sequential composition ---- */

  QZ_GEN.push({ topic: 'structural', make: function () {
    var a = qzInt(2, 7), b = qzInt(2, 7);
    return {
      topic: 'structural · composing graphs',
      prompt: 'Two program graphs with <code>V = ' + a + '</code> and <code>V = ' + b +
        '</code> are composed in sequence &mdash; the exit of the first <em>is</em> the ' +
        'entry of the second. What is the cyclomatic number of the result?',
      placeholder: 'a number',
      answer: String(a + b - 1),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === a + b - 1 };
      },
      explain: '<code>' + a + ' + ' + b + ' &minus; 1 = <strong>' + (a + b - 1) +
        '</strong></code>. The two graphs share a node, so the node count is one short of ' +
        'the sum while the edge count is exactly the sum &mdash; and <code>E &minus; N + ' +
        '2</code> picks up the difference.'
    };
  } });

  /* ---- the running example's fault ---- */

  QZ_GEN.push({ topic: 'structural', make: function () {
    var sweep = sonce('sweep', function () { return pgSweep(65536); });
    var only = sweep.failing[0];
    return {
      topic: 'structural · the two-condition program',
      prompt: '<code>if x &lt; 50 then x = x + 2 end; if x &gt; 50 then x = x - 1 end; ' +
        'return x</code>, against a specification of <em>+2 below 50, &minus;1 above 50, ' +
        '50 exactly</em>. Which single input in <code>1&hellip;65536</code> does it get ' +
        'wrong?',
      placeholder: 'a number',
      answer: String(only),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === only };
      },
      explain: '<strong>' + only + '</strong>. It is the only input for which both ' +
        'conditions fire: 49 + 2 = 51, which is greater than 50, so one is taken away ' +
        'again. 48 escapes because 50 is not greater than 50. It is also the only input ' +
        'that executes every statement in one run, which is why statement and edge ' +
        'coverage can both be satisfied without it.'
    };
  } });

  /* ---- what DD-path coverage is equivalent to ---- */

  QZ_GEN.push({ topic: 'structural', make: function () {
    return {
      topic: 'structural · DD-path coverage',
      kind: 'choice',
      prompt: 'DD-path coverage is equivalent to which criterion on the flow graph?',
      choices: ['all edges', 'all nodes', 'all prime paths', 'all paths'],
      answer: 'all edges',
      check: textCheck('all edges'),
      explain: 'Equivalent to edge coverage, and it subsumes node coverage. The point of ' +
        'the DD-path graph is that it needs fewer checks for the same answer, because a ' +
        'chain of statements with one way in and one way out collapses to a single node.'
    };
  } });
