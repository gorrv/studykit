  /* ============================================================
     SMT TOPIC 03 · structural testing

     Functional testing reads the specification. Structural testing
     reads the program: build a graph out of it, and measure a test
     set by how much of that graph it touches.

     So this file has two halves that meet in the middle.

       1. A small imperative language — assignments, if, while,
          repeat-until, return — with a parser, a flow-graph builder
          and an interpreter. The interpreter records which node it
          is standing on at each step, so running a program yields a
          path through the graph the builder produced. Those are two
          independent pieces of code, and the test suite checks they
          agree: every consecutive pair in every trace must be an
          edge of the graph.

       2. Graph machinery that does not know programs exist: chains,
          DD-paths, the DD-path graph, simple paths, prime paths,
          the cyclomatic number, and coverage of a set of paths
          against each criterion.

     The running example is the one the notes use:

        input x in [1..2^16]
        output  x+2 if x < 50,  x-1 if x > 50,  50 otherwise

        if x < 50 then x = x + 2 end
        if x > 50 then x = x - 1 end
        return x

     Algorithms only — no DOM.
     ============================================================ */

  /* =============================================================
     PART 1 · a small language
     ============================================================= */

  /* ---------------------------------------------------------------
     Tokens. Deliberately tiny: integers, names, the arithmetic and
     comparison operators, parentheses, and the keywords below.
     --------------------------------------------------------------- */

  var PG_KEYWORDS = ['if', 'then', 'else', 'end', 'while', 'do', 'repeat',
                     'until', 'return'];

  function pgTokens(src) {
    var out = [], i = 0, n = src.length;
    var two = ['<=', '>=', '==', '!=' ];
    while (i < n) {
      var c = src.charAt(i);
      if (c === '\n') { out.push({ t: 'nl' }); i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '#') { while (i < n && src.charAt(i) !== '\n') i++; continue; }
      if (two.indexOf(src.substr(i, 2)) >= 0) { out.push({ t: 'op', v: src.substr(i, 2) }); i += 2; continue; }
      if ('+-*/%<>=()'.indexOf(c) >= 0) { out.push({ t: 'op', v: c }); i++; continue; }
      if (c >= '0' && c <= '9') {
        var j = i; while (j < n && src.charAt(j) >= '0' && src.charAt(j) <= '9') j++;
        out.push({ t: 'num', v: parseInt(src.slice(i, j), 10) }); i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var k = i; while (k < n && /[A-Za-z0-9_]/.test(src.charAt(k))) k++;
        var w = src.slice(i, k);
        out.push({ t: PG_KEYWORDS.indexOf(w) >= 0 ? 'kw' : 'name', v: w });
        i = k; continue;
      }
      return { error: 'I do not know what to do with "' + c + '"' };
    }
    out.push({ t: 'eof' });
    return { tokens: out };
  }

  /* ---------------------------------------------------------------
     Parser. Recursive descent, one statement per line.

     Produces an AST of
        { k:'assign', name, expr }
        { k:'if',     cond, then:[...], els:[...] }
        { k:'while',  cond, body:[...] }
        { k:'repeat', body:[...], cond }
        { k:'return', expr }
     --------------------------------------------------------------- */

  function pgParse(src) {
    var lex = pgTokens(src);
    if (lex.error) return { ok: false, error: lex.error };
    var ts = lex.tokens, p = 0;

    function peek() { return ts[p]; }
    function at(t, v) { var x = ts[p]; return x.t === t && (v === undefined || x.v === v); }
    function eat(t, v) {
      if (!at(t, v)) throw new Error('expected ' + (v || t) + ', found ' +
        (ts[p].v !== undefined ? '"' + ts[p].v + '"' : ts[p].t));
      return ts[p++];
    }
    function skipNl() { while (at('nl')) p++; }

    /* precedence climbing: comparисons bind loosest */
    function expr() { return cmp(); }
    function cmp() {
      var a = sum();
      while (at('op') && ['<', '>', '<=', '>=', '==', '!='].indexOf(peek().v) >= 0) {
        var o = eat('op').v; a = { k: 'bin', op: o, a: a, b: sum() };
      }
      return a;
    }
    function sum() {
      var a = term();
      while (at('op') && ['+', '-'].indexOf(peek().v) >= 0) {
        var o = eat('op').v; a = { k: 'bin', op: o, a: a, b: term() };
      }
      return a;
    }
    function term() {
      var a = atom();
      while (at('op') && ['*', '/', '%'].indexOf(peek().v) >= 0) {
        var o = eat('op').v; a = { k: 'bin', op: o, a: a, b: atom() };
      }
      return a;
    }
    function atom() {
      if (at('num')) return { k: 'num', v: eat('num').v };
      if (at('name')) return { k: 'var', v: eat('name').v };
      if (at('op', '-')) { eat('op'); return { k: 'bin', op: '-', a: { k: 'num', v: 0 }, b: atom() }; }
      if (at('op', '(')) { eat('op'); var e = expr(); eat('op', ')'); return e; }
      throw new Error('expected a value, found ' +
        (peek().v !== undefined ? '"' + peek().v + '"' : peek().t));
    }

    function block(stops) {
      var out = [];
      for (;;) {
        skipNl();
        if (at('eof')) break;
        if (at('kw') && stops.indexOf(peek().v) >= 0) break;
        out.push(stmt());
      }
      return out;
    }

    function stmt() {
      if (at('kw', 'if')) {
        eat('kw'); var c = expr(); eat('kw', 'then');
        var th = block(['else', 'end']);
        var el = [];
        if (at('kw', 'else')) { eat('kw'); el = block(['end']); }
        eat('kw', 'end');
        return { k: 'if', cond: c, then: th, els: el };
      }
      if (at('kw', 'while')) {
        eat('kw'); var wc = expr(); eat('kw', 'do');
        var wb = block(['end']); eat('kw', 'end');
        return { k: 'while', cond: wc, body: wb };
      }
      if (at('kw', 'repeat')) {
        eat('kw'); var rb = block(['until']); eat('kw', 'until');
        return { k: 'repeat', body: rb, cond: expr() };
      }
      if (at('kw', 'return')) { eat('kw'); return { k: 'return', expr: expr() }; }
      if (at('name')) {
        var nm = eat('name').v; eat('op', '=');
        return { k: 'assign', name: nm, expr: expr() };
      }
      throw new Error('I cannot read a statement starting with ' +
        (peek().v !== undefined ? '"' + peek().v + '"' : peek().t));
    }

    try {
      var body = block([]);
      skipNl();
      if (!at('eof')) throw new Error('trailing input');
      if (!body.length) throw new Error('the program is empty');
      return { ok: true, body: body };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* ---------------------------------------------------------------
     Program → flow graph.

     Nodes are statements; an edge p → q means q may execute
     immediately after p. Conditions become one node with two
     outgoing edges, labelled T and F.

     Every statement node is stamped with its id as it is built, so
     the interpreter below can report where it has been without
     rebuilding anything.
     --------------------------------------------------------------- */

  function pgGraph(prog) {
    var nodes = [], edges = [], next = 0;
    function add(label, kind) {
      var id = next++;
      nodes.push({ id: id, label: label, kind: kind || 'stmt' });
      return id;
    }
    function link(a, b, tag) {
      if (a === null || b === null) return;
      edges.push({ from: a, to: b, tag: tag || '' });
    }

    /* Returns { entry, exits:[{node, tag}] } — the open ends to be
       wired to whatever comes next. A return statement has no open
       end at all, which is how dead code after it stays unlinked. */
    function build(list) {
      var entry = null, open = [];
      for (var i = 0; i < list.length; i++) {
        var st = list[i], r = one(st);
        if (entry === null) entry = r.entry;
        open.forEach(function (o) { link(o.node, r.entry, o.tag); });
        open = r.exits;
        if (!open.length) break;          /* unreachable tail */
      }
      return { entry: entry, exits: open };
    }

    function one(st) {
      if (st.k === 'assign') {
        var a = add(st.name + ' = ' + pgShow(st.expr));
        st.node = a;
        return { entry: a, exits: [{ node: a, tag: '' }] };
      }
      if (st.k === 'return') {
        var r = add('return ' + pgShow(st.expr), 'exit');
        st.node = r;
        return { entry: r, exits: [] };
      }
      if (st.k === 'if') {
        var c = add('if ' + pgShow(st.cond), 'cond');
        st.node = c;
        var th = build(st.then);
        var ends = [];
        link(c, th.entry, 'T');
        ends = ends.concat(th.exits);
        if (st.els.length) {
          var el = build(st.els);
          link(c, el.entry, 'F');
          ends = ends.concat(el.exits);
        } else {
          ends = ends.concat([{ node: c, tag: 'F' }]);
        }
        return { entry: c, exits: ends };
      }
      if (st.k === 'while') {
        var w = add('while ' + pgShow(st.cond), 'cond');
        st.node = w;
        var b = build(st.body);
        link(w, b.entry, 'T');
        b.exits.forEach(function (o) { link(o.node, w, o.tag); });
        return { entry: w, exits: [{ node: w, tag: 'F' }] };
      }
      if (st.k === 'repeat') {
        var bb = build(st.body);
        var u = add('until ' + pgShow(st.cond), 'cond');
        st.node = u;
        bb.exits.forEach(function (o) { link(o.node, u, o.tag); });
        link(u, bb.entry, 'F');
        return { entry: bb.entry, exits: [{ node: u, tag: 'T' }] };
      }
      throw new Error('unknown statement');
    }

    var top = build(prog.body);
    /* Anything still open falls off the end of the program: give it a
       terminal node so the graph has one exit, which the cyclomatic
       number below requires. */
    if (top.exits.length) {
      var e = add('end', 'exit');
      top.exits.forEach(function (o) { link(o.node, e, o.tag); });
    }
    return {
      nodes: nodes.map(function (n) { return n.id; }),
      labels: nodes,
      edges: edges.map(function (e2) { return [e2.from, e2.to]; }),
      tags: edges,
      entry: top.entry
    };
  }

  function pgShow(e) {
    if (e.k === 'num') return String(e.v);
    if (e.k === 'var') return e.v;
    return pgShow(e.a) + ' ' + e.op + ' ' + pgShow(e.b);
  }

  /* ---------------------------------------------------------------
     The interpreter. Walks the AST, not the graph — which is the
     point: the trace it produces is evidence about the graph rather
     than a restatement of it.
     --------------------------------------------------------------- */

  function pgRun(prog, env, limit) {
    var vars = {}, trace = [], steps = 0, cap = limit || 10000;
    Object.keys(env || {}).forEach(function (k) { vars[k] = env[k]; });

    function val(e) {
      if (e.k === 'num') return e.v;
      if (e.k === 'var') {
        if (!(e.v in vars)) throw new Error('"' + e.v + '" has no value');
        return vars[e.v];
      }
      var a = val(e.a), b = val(e.b);
      switch (e.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': if (b === 0) throw new Error('division by zero');
                  return Math.trunc(a / b);
        case '%': if (b === 0) throw new Error('division by zero');
                  return a % b;
        case '<': return a < b ? 1 : 0;
        case '>': return a > b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
        case '==': return a === b ? 1 : 0;
        case '!=': return a !== b ? 1 : 0;
      }
      throw new Error('unknown operator ' + e.op);
    }

    var RETURN = {};
    var result = null;

    function visit(id) {
      trace.push(id);
      if (++steps > cap) throw new Error('still running after ' + cap + ' steps');
    }

    function exec(list) {
      for (var i = 0; i < list.length; i++) {
        var st = list[i];
        if (st.k === 'assign') { visit(st.node); vars[st.name] = val(st.expr); continue; }
        if (st.k === 'return') { visit(st.node); result = val(st.expr); throw RETURN; }
        if (st.k === 'if') {
          visit(st.node);
          if (val(st.cond)) exec(st.then); else exec(st.els);
          continue;
        }
        if (st.k === 'while') {
          for (;;) { visit(st.node); if (!val(st.cond)) break; exec(st.body); }
          continue;
        }
        if (st.k === 'repeat') {
          for (;;) { exec(st.body); visit(st.node); if (val(st.cond)) break; }
          continue;
        }
      }
    }

    try {
      exec(prog.body);
    } catch (e) {
      if (e !== RETURN) return { ok: false, error: e.message, trace: trace };
    }
    return { ok: true, value: result, vars: vars, trace: trace };
  }

  /* ---------------------------------------------------------------
     The programs the notes use, and two more that exist to put a
     loop in front of the graph machinery.
     --------------------------------------------------------------- */

  var PG_PRESETS = {
    'two conditions': {
      note: 'The running example: increment below 50, decrement above it, 50 exactly ' +
            'stays put.',
      src: 'if x < 50 then\n  x = x + 2\nend\nif x > 50 then\n  x = x - 1\nend\nreturn x'
    },
    'the same, as a choice': {
      note: 'The same specification written so the three cases cannot run into one ' +
            'another. The notes recommend exactly this.',
      src: 'if x < 50 then\n  x = x + 2\nelse\n  if x > 50 then\n    x = x - 1\n  else\n' +
           '    x = 50\n  end\nend\nreturn x'
    },
    'a while loop': {
      note: 'Sum the numbers from 1 to x. A loop turns one edge into a cycle, and the ' +
            'cycle is what makes path coverage infinite.',
      src: 'total = 0\ni = 1\nwhile i <= x do\n  total = total + i\n  i = i + 1\nend\n' +
           'return total'
    },
    'a repeat-until loop': {
      note: 'The body runs before the condition is read, so the graph enters the loop ' +
            'body rather than the test.',
      src: 'total = 0\ni = 1\nrepeat\n  total = total + i\n  i = i + 1\nuntil i > x\n' +
           'return total'
    }
  };

  /* The specification of the running example, written separately from
     the program so that comparing them means something. */
  function pgSpec50(x) {
    if (x < 50) return x + 2;
    if (x > 50) return x - 1;
    return 50;
  }

  /* Every input in the stated range, put through both. */
  function pgSweep(hi) {
    var prog = pgParse(PG_PRESETS['two conditions'].src);
    var top = hi || 65536, bad = [], i;
    for (i = 1; i <= top; i++) {
      var r = pgRun(prog, { x: i });
      if (!r.ok || r.value !== pgSpec50(i)) bad.push(i);
    }
    return { checked: top, failing: bad };
  }

  /* =============================================================
     PART 2 · graphs, knowing nothing about programs
     ============================================================= */

  function sgSucc(g, n) {
    var out = [], i;
    for (i = 0; i < g.edges.length; i++) if (g.edges[i][0] === n) out.push(g.edges[i][1]);
    return out;
  }
  function sgPred(g, n) {
    var out = [], i;
    for (i = 0; i < g.edges.length; i++) if (g.edges[i][1] === n) out.push(g.edges[i][0]);
    return out;
  }
  function sgIndeg(g, n) { return sgPred(g, n).length; }
  function sgOutdeg(g, n) { return sgSucc(g, n).length; }

  function sgReachable(g, from) {
    var seen = {}, stack = [from];
    while (stack.length) {
      var n = stack.pop();
      if (seen[n]) continue;
      seen[n] = true;
      sgSucc(g, n).forEach(function (m) { if (!seen[m]) stack.push(m); });
    }
    return g.nodes.filter(function (n) { return seen[n]; });
  }

  /* ---------------------------------------------------------------
     DD-paths, by the simplified definition:

       1. {n} where indeg(n) ≠ 1 or outdeg(n) ≠ 1
       2. {n0..ni} a maximal chain — every node on it has
          indeg = outdeg = 1

     The property worth checking afterwards is that these partition
     the nodes: each node belongs to precisely one DD-path.
     --------------------------------------------------------------- */

  function sgDDPaths(g) {
    var solo = {}, inner = [];
    g.nodes.forEach(function (n) {
      if (sgIndeg(g, n) !== 1 || sgOutdeg(g, n) !== 1) solo[n] = true;
      else inner.push(n);
    });

    var out = g.nodes.filter(function (n) { return solo[n]; })
                     .map(function (n) { return [n]; });
    var seen = {};
    inner.forEach(function (n) {
      if (seen[n]) return;
      /* walk back to the head of this chain */
      var head = n, guard = 0;
      for (;;) {
        var p = sgPred(g, head);
        if (p.length === 1 && !solo[p[0]] && p[0] !== head && guard++ < g.nodes.length) head = p[0];
        else break;
      }
      var chain = [], cur = head;
      while (cur !== null && cur !== undefined && !solo[cur] && !seen[cur]) {
        chain.push(cur); seen[cur] = true;
        var s = sgSucc(g, cur);
        cur = s.length === 1 ? s[0] : null;
      }
      out.push(chain);
    });
    out.sort(function (a, b) { return a[0] - b[0]; });
    return out;
  }

  function sgDDGraph(g) {
    var paths = sgDDPaths(g), owner = {}, place = {};
    paths.forEach(function (p, i) {
      p.forEach(function (n, j) { owner[n] = i; place[n] = j; });
    });

    /* An edge disappears into a DD-path only when it is one of that
       chain's own consecutive links. Everything else survives — in
       particular a self-loop, whose two ends are the same DD-path but
       which is not a step along the chain. Dropping those too looked
       right and was not: a random search found graphs whose self-loop
       was never taken and whose DD-path graph was nonetheless fully
       covered, which would have made DD-path coverage weaker than
       edge coverage rather than equivalent to it. */
    function internal(a, b) {
      return owner[a] === owner[b] && place[b] === place[a] + 1;
    }

    var seen = {}, edges = [];
    g.edges.forEach(function (e) {
      if (internal(e[0], e[1])) return;
      var a = owner[e[0]], b = owner[e[1]];
      var k = a + '>' + b;
      if (!seen[k]) { seen[k] = true; edges.push([a, b]); }
    });
    edges.sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; });
    return { paths: paths, edges: edges, owner: owner, place: place };
  }

  /* ---------------------------------------------------------------
     Simple paths and prime paths.

     A simple path visits each node at most once, except that the
     first and last may be the same node — that is how a loop gets
     one complete iteration into the set.

     A prime path is a simple path that is not a proper subpath of
     another simple path.
     --------------------------------------------------------------- */

  function sgSimplePaths(g, cap) {
    var out = [], seen = {}, limit = cap || 200000;

    function record(p) {
      var k = p.join(',');
      if (!seen[k]) { seen[k] = true; out.push(p.slice()); }
    }
    function go(path, on) {
      if (out.length > limit) return;
      record(path);
      var last = path[path.length - 1], s = sgSucc(g, last), i;
      for (i = 0; i < s.length; i++) {
        var q = s[i];
        if (q === path[0]) record(path.concat([q]));   /* closed: cannot extend */
        else if (!on[q]) {
          on[q] = true; path.push(q);
          go(path, on);
          path.pop(); on[q] = false;
        }
      }
    }
    g.nodes.forEach(function (n) {
      var on = {}; on[n] = true;
      go([n], on);
    });
    return out;
  }

  function sgIsSubpath(a, b) {
    if (a.length >= b.length) return false;
    for (var i = 0; i + a.length <= b.length; i++) {
      var ok = true;
      for (var j = 0; j < a.length; j++) if (b[i + j] !== a[j]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }

  function sgPrimePaths(g, cap) {
    var sp = sgSimplePaths(g, cap);
    return sp.filter(function (p) {
      return !sp.some(function (q) { return sgIsSubpath(p, q); });
    });
  }

  /* ---------------------------------------------------------------
     The cyclomatic number.

     The formula holds for a program graph: one connected component,
     one entry, one exit.

         V(G) = #edges − #nodes + 2

     That is not self-evidently a count of anything, so it is worth
     computing the same number a second way that shares none of its
     reasoning. Join the exit back to the entry, and V(G) is the
     dimension of the cycle space of the resulting graph — the number
     of independent cycles. sgCycleRank measures that directly, by
     elimination over GF(2) on the edge/node incidence vectors, and
     never mentions the formula.
     --------------------------------------------------------------- */

  function sgCyclomatic(g) { return g.edges.length - g.nodes.length + 2; }

  function sgCycleRank(g) {
    var index = {}, i;
    g.nodes.forEach(function (n, k) { index[n] = k; });
    /* Each edge becomes the sum of its endpoints over GF(2); a
       self-loop becomes zero, which is exactly a cycle on its own. */
    var rows = g.edges.map(function (e) {
      var a = index[e[0]], b = index[e[1]];
      return a === b ? [] : [a, b];
    });
    var pivots = {}, rank = 0;
    for (i = 0; i < rows.length; i++) {
      var r = {}, j;
      for (j = 0; j < rows[i].length; j++) r[rows[i][j]] = 1;
      for (;;) {
        var lead = -1, keys = Object.keys(r);
        for (j = 0; j < keys.length; j++) if (+keys[j] > lead) lead = +keys[j];
        if (lead < 0) break;                       /* reduced to nothing */
        if (!pivots[lead]) { pivots[lead] = r; rank++; break; }
        var p = pivots[lead], ks = Object.keys(p);
        for (j = 0; j < ks.length; j++) {
          if (r[ks[j]]) delete r[ks[j]]; else r[ks[j]] = 1;
        }
      }
    }
    return g.edges.length - rank;
  }

  /* The graph with its exit joined back to its entry, which is what
     the formula silently assumes. */
  function sgClose(g) {
    var entry = g.nodes.filter(function (n) { return sgIndeg(g, n) === 0; });
    var exit = g.nodes.filter(function (n) { return sgOutdeg(g, n) === 0; });
    if (entry.length !== 1 || exit.length !== 1) return null;
    return { nodes: g.nodes.slice(), edges: g.edges.concat([[exit[0], entry[0]]]) };
  }

  /* n copies of g, each one's exit identified with the next one's
     entry. The notes ask for the cyclomatic number of this. */
  function sgCompose(g, n) {
    var closed = sgClose(g);
    if (!closed) return null;
    var entry = g.nodes.filter(function (x) { return sgIndeg(g, x) === 0; })[0];
    var exit = g.nodes.filter(function (x) { return sgOutdeg(g, x) === 0; })[0];
    var nodes = [], edges = [], k, map = [];
    for (k = 0; k < n; k++) {
      map[k] = {};
      g.nodes.forEach(function (x) {
        /* the exit of copy k is the entry of copy k+1 */
        if (k > 0 && x === entry) { map[k][x] = map[k - 1][exit]; return; }
        var id = nodes.length;
        map[k][x] = id; nodes.push(id);
      });
    }
    for (k = 0; k < n; k++) {
      g.edges.forEach(function (e) { edges.push([map[k][e[0]], map[k][e[1]]]); });
    }
    return { nodes: nodes, edges: edges };
  }

  /* ---------------------------------------------------------------
     Coverage of a set of paths.

     Each criterion is measured the same way: list what has to be
     covered, then ask which of those appear in some path.
     --------------------------------------------------------------- */

  function sgPairs(path) {
    var out = [], i;
    for (i = 0; i + 1 < path.length; i++) out.push([path[i], path[i + 1]]);
    return out;
  }

  function sgCoverage(g, paths, cap) {
    var dd = sgDDGraph(g);
    var seenN = {}, seenE = {};
    paths.forEach(function (p) {
      p.forEach(function (n) { seenN[n] = true; });
      sgPairs(p).forEach(function (e) { seenE[e[0] + '>' + e[1]] = true; });
    });

    var nodes = g.nodes.filter(function (n) { return seenN[n]; });
    var edges = g.edges.filter(function (e) { return seenE[e[0] + '>' + e[1]]; });

    var ddNodes = dd.paths.filter(function (p) {
      return p.some(function (n) { return seenN[n]; });
    });
    var ddEdges = dd.edges.filter(function (e) {
      /* a DD-path edge is covered when some flow-graph edge it stands
         for was taken */
      return g.edges.some(function (fe) {
        return dd.owner[fe[0]] === e[0] && dd.owner[fe[1]] === e[1] &&
               !(dd.owner[fe[0]] === dd.owner[fe[1]] &&
                 dd.place[fe[1]] === dd.place[fe[0]] + 1) &&
               seenE[fe[0] + '>' + fe[1]];
      });
    });

    var prime = sgPrimePaths(g, cap);
    var hit = prime.filter(function (pp) {
      return paths.some(function (p) {
        return sgIsSubpath(pp, p) || pp.join(',') === p.join(',');
      });
    });

    return {
      nodes: { hit: nodes.length, of: g.nodes.length, missing:
        g.nodes.filter(function (n) { return !seenN[n]; }) },
      edges: { hit: edges.length, of: g.edges.length, missing:
        g.edges.filter(function (e) { return !seenE[e[0] + '>' + e[1]]; }) },
      ddNodes: { hit: ddNodes.length, of: dd.paths.length },
      ddEdges: { hit: ddEdges.length, of: dd.edges.length },
      prime: { hit: hit.length, of: prime.length, missing:
        prime.filter(function (pp) { return hit.indexOf(pp) < 0; }) },
      checks: { flow: g.nodes.length + g.edges.length,
                dd: dd.paths.length + dd.edges.length }
    };
  }

  /* ---------------------------------------------------------------
     The graphs the notes draw, transcribed.
     --------------------------------------------------------------- */

  var SG_GRAPHS = {
    'the running graph': {
      note: 'The graph the adequacy criteria are demonstrated on. Ten nodes, thirteen ' +
            'edges, one self-loop at 3.',
      nodes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      edges: [[0, 1], [1, 2], [1, 3], [3, 3], [2, 4], [3, 4], [4, 5], [4, 7],
              [5, 6], [7, 6], [7, 8], [6, 9], [8, 9]]
    },
    'the DD-path example': {
      note: 'Chosen so that two chains collapse: {3,4} and {6,7}.',
      nodes: [1, 2, 3, 4, 5, 6, 7, 8],
      edges: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 2], [5, 8]]
    },
    'the prime path example': {
      note: 'Two loops sharing a node, which is where prime paths start to differ from ' +
            'complete paths.',
      nodes: [0, 1, 2, 3, 4, 5, 6, 7],
      edges: [[0, 1], [1, 2], [2, 3], [3, 1], [3, 4], [4, 5], [5, 3], [1, 6], [6, 7]]
    },
    'a straight line': {
      note: 'No choice anywhere.',
      nodes: [1, 2, 3], edges: [[1, 2], [2, 3]]
    },
    'a longer straight line': {
      note: 'Longer, and no more complex — which is the observation.',
      nodes: [1, 2, 3, 4], edges: [[1, 2], [2, 3], [3, 4]]
    },
    'one loop': {
      note: 'A single self-loop.',
      nodes: [1, 2, 3], edges: [[1, 2], [2, 2], [2, 3]]
    },
    'a branch and a loop': {
      note: 'One branch, one self-loop.',
      nodes: [1, 2, 3, 4, 5, 6, 7],
      edges: [[1, 5], [1, 2], [2, 3], [3, 3], [3, 4], [4, 7], [5, 6], [6, 7]]
    }
  };

  /* The unreachable pair the notes add to make finite feasibility
     bite: nodes 10 and 11 hang off nothing. */
  function sgWithUnreachable(g) {
    var hi = Math.max.apply(null, g.nodes);
    return {
      nodes: g.nodes.concat([hi + 1, hi + 2]),
      edges: g.edges.concat([[hi + 1, hi + 2]])
    };
  }

  /* The risk bands the notes give for V(G). */
  var SG_RISK = [
    { from: 1, to: 10, text: 'a simple program, without much risk' },
    { from: 11, to: 20, text: 'more complex, moderate risk' },
    { from: 21, to: 50, text: 'complex, high risk program' },
    { from: 51, to: Infinity, text: 'untestable program (very high risk)' }
  ];

  function sgRisk(v) {
    for (var i = 0; i < SG_RISK.length; i++) {
      if (v >= SG_RISK[i].from && v <= SG_RISK[i].to) return SG_RISK[i].text;
    }
    return SG_RISK[0].text;
  }

  /* The ladder of criteria, in the order the notes build it. */
  var SG_CRITERIA = [
    { id: 'nodes', name: 'all nodes', also: 'statement coverage' },
    { id: 'edges', name: 'all edges', also: 'DD-path coverage' },
    { id: 'prime', name: 'all prime paths', also: 'single-loop coverage' },
    { id: 'pairs', name: 'all edges + all combinations of data-flow dependent edges',
      also: 'dependent pairs coverage' },
    { id: 'cond', name: 'all edges + all combinations of condition edges',
      also: 'multiple-condition coverage' },
    { id: 'paths', name: 'all paths', also: 'full path coverage' }
  ];
