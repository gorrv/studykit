  /* ============================================================
     TOPIC 08 · linear programs, in exact arithmetic
     ------------------------------------------------------------
     Every number here is a rational, not a float. That is not
     fussiness. The standard tableau is full of 0.25, 1.75 and
     2.5; one branch-and-bound subproblem has optimum x = 13/3,
     which the usual write-up rounds to 4.3 and then reports a cost of 11.6
     when it is 35/3 = 11.6667; and the final cost row
     contains an arithmetic slip that floating point would have
     buried under a rounding excuse. Exact arithmetic means a
     disagreement with the worked answer is always a real disagreement.

     The other decision worth naming: the optimum is found here by
     enumerating the vertices of the feasible region, NOT by the
     simplex method. Simplex lives in t8-simplex.js and is checked
     against this file. Two engines that share no reasoning are the
     only way to know either of them is right.
     ============================================================ */

  /* ---------- exact rationals ---------- */

  var FR_MAX = 9e14;   // beyond this, 53-bit integers stop being exact

  function frGcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }

  /** n/d, always reduced, denominator positive. */
  function fr(n, d) {
    if (d === undefined) d = 1;
    if (d === 0 || !isFinite(n) || !isFinite(d)) return { n: NaN, d: 1, bad: true };
    if (d < 0) { n = -n; d = -d; }
    var g = frGcd(n, d) || 1;
    n = n / g; d = d / g;
    if (Math.abs(n) > FR_MAX || d > FR_MAX) return { n: n, d: d, bad: true, huge: true };
    return { n: n, d: d };
  }

  function frBad(x) { return !x || x.bad; }
  function frAdd(a, b) { return frBad(a) || frBad(b) ? fr(NaN, 1) : fr(a.n * b.d + b.n * a.d, a.d * b.d); }
  function frSub(a, b) { return frBad(a) || frBad(b) ? fr(NaN, 1) : fr(a.n * b.d - b.n * a.d, a.d * b.d); }
  function frMul(a, b) { return frBad(a) || frBad(b) ? fr(NaN, 1) : fr(a.n * b.n, a.d * b.d); }
  function frDiv(a, b) { return frBad(a) || frBad(b) || b.n === 0 ? fr(NaN, 1) : fr(a.n * b.d, a.d * b.n); }
  function frNeg(a) { return frBad(a) ? a : fr(-a.n, a.d); }
  function frCmp(a, b) {
    if (frBad(a) || frBad(b)) return NaN;
    var l = a.n * b.d, r = b.n * a.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  function frZero(a) { return !frBad(a) && a.n === 0; }
  function frNum(a) { return frBad(a) ? NaN : a.n / a.d; }
  function frInt(a) { return !frBad(a) && a.d === 1; }
  function frFloor(a) { return frBad(a) ? a : fr(Math.floor(a.n / a.d), 1); }
  function frCeil(a) { return frBad(a) ? a : fr(Math.ceil(a.n / a.d), 1); }

  /** "3", "0.5", "3/2", "-2" -> a rational. Returns null if unreadable. */
  function frParse(s) {
    s = String(s).trim();
    if (s === '' || s === '+') return fr(1);
    if (s === '-') return fr(-1);
    var m = /^([+-]?\d+)\/(\d+)$/.exec(s);
    if (m) return fr(parseInt(m[1], 10), parseInt(m[2], 10));
    m = /^([+-]?)(\d*)(?:\.(\d+))?$/.exec(s);
    if (!m || (m[2] === '' && !m[3])) return null;
    var sign = m[1] === '-' ? -1 : 1;
    var whole = m[2] === '' ? 0 : parseInt(m[2], 10);
    if (!m[3]) return fr(sign * whole, 1);
    var pow = Math.pow(10, m[3].length);
    return fr(sign * (whole * pow + parseInt(m[3], 10)), pow);
  }

  /** Display: 5, -3/2, 0 — the form a marker expects to see. */
  function frStr(a) {
    if (frBad(a)) return '?';
    return a.d === 1 ? String(a.n) : a.n + '/' + a.d;
  }
  /**
     Display as a decimal only when the decimal is EXACT — that is,
     when the denominator divides some power of ten. 1/2 prints as
     0.5; 1/3 prints as 1/3 and never as 0.3333, because the whole
     point of this file is that 13/3 is not 4.3.
  */
  function frShow(a) {
    if (frBad(a)) return '?';
    if (a.d === 1) return String(a.n);
    var d = a.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    if (d !== 1) return frStr(a);
    var s = String(a.n / a.d);
    return s.length <= 12 ? s : frStr(a);
  }

  /* ---------- parsing a linear program ---------- */

  /** "2x + 3y - 4" -> { coef: {x:2, y:3}, cons: -4 } in rationals. */
  function lpExpr(src) {
    var s = String(src).replace(/\s+/g, '').replace(/−/g, '-');
    if (!s) return { ok: false, error: 'Empty expression.' };
    var toks = s.replace(/-/g, '+-').split('+').filter(function (t) { return t !== ''; });
    if (!toks.length) return { ok: false, error: 'Empty expression.' };

    var coef = {}, cons = fr(0), order = [];
    for (var i = 0; i < toks.length; i++) {
      var m = /^(-?)([0-9]*\.?[0-9]*(?:\/[0-9]+)?)\*?([A-Za-z][A-Za-z0-9_]*)?$/.exec(toks[i]);
      if (!m) return { ok: false, error: 'Cannot read the term "' + esc(toks[i]) + '".' };
      var num = frParse((m[1] || '') + (m[2] === '' ? '1' : m[2]));
      if (!num) return { ok: false, error: 'Cannot read the number in "' + esc(toks[i]) + '".' };
      if (m[3]) {
        if (!coef[m[3]]) { coef[m[3]] = fr(0); order.push(m[3]); }
        coef[m[3]] = frAdd(coef[m[3]], num);
      } else {
        if (m[2] === '') return { ok: false, error: 'Cannot read the term "' + esc(toks[i]) + '".' };
        cons = frAdd(cons, num);
      }
    }
    return { ok: true, coef: coef, cons: cons, order: order };
  }

  var LP_RELS = [
    { re: /<=|≤/, kind: 'le' },
    { re: />=|≥/, kind: 'ge' },
    { re: /=/,    kind: 'eq' }
  ];

  /**
     max 2x + 3y
     3x + 2y <= 15
     2y - x  <= 5
     x + 2y  <= 7

     Non-negativity is implicit for every variable, because the LP
     problem as the standard treatment defines it outputs x in (R>=0)^n. Those
     rows are kept in the constraint list but marked, so the tools
     can show them separately from what the user typed.
  */
  function lpParse(text) {
    var lines = String(text || '').split(/\n+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s && s.charAt(0) !== '#'; });
    if (!lines.length) return { ok: false, error: 'Nothing to solve. Start with a line like <code>max 2x + 3y</code>.' };

    var dir = null, obj = null, rows = [], names = {}, order = [];

    function note(coef) {
      for (var v in coef) if (!names[v]) { names[v] = true; order.push(v); }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var dm = /^(max|maximi[sz]e|min|minimi[sz]e)\b[:\s]*(.*)$/i.exec(line);
      if (dm) {
        if (obj) return { ok: false, error: 'Two objective functions. A linear program has one.' };
        dir = /^max/i.test(dm[1]) ? 'max' : 'min';
        var e = lpExpr(dm[2]);
        if (!e.ok) return { ok: false, error: 'In the objective: ' + e.error };
        obj = e; note(e.coef);
        continue;
      }

      if (/[<>](?!=)/.test(line.replace(/<=|>=/g, ''))) {
        return { ok: false, error: 'Strict inequality in "' + esc(line) + '". A linear program uses ' +
          '&le; and &ge; only — with a strict inequality the feasible region is not closed and the ' +
          'optimum need not be attained at all (maximise x subject to x &lt; 1 has no solution).' };
      }

      var rel = null, at = -1;
      for (var r = 0; r < LP_RELS.length; r++) {
        var m = LP_RELS[r].re.exec(line);
        if (m) { rel = LP_RELS[r].kind; at = m.index; var w = m[0].length; break; }
      }
      if (!rel) return { ok: false, error: 'No relation in "' + esc(line) + '". A constraint needs ' +
        '<code>&lt;=</code>, <code>&gt;=</code> or <code>=</code>.' };

      var lhs = lpExpr(line.slice(0, at));
      var rhs = lpExpr(line.slice(at + w));
      if (!lhs.ok) return { ok: false, error: 'In "' + esc(line) + '": ' + lhs.error };
      if (!rhs.ok) return { ok: false, error: 'In "' + esc(line) + '": ' + rhs.error };
      note(lhs.coef); note(rhs.coef);
      rows.push({ lhs: lhs, rhs: rhs, rel: rel, src: line });
    }

    if (!obj) return { ok: false, error: 'No objective function. Add a line like <code>max 2x + 3y</code>.' };
    if (!order.length) return { ok: false, error: 'No variables anywhere in the program.' };
    if (!rows.length) return { ok: false, error: 'No constraints — the objective is unbounded by construction.' };

    order.sort();
    var n = order.length, idx = {};
    order.forEach(function (v, k) { idx[v] = k; });

    // Normalise every row to  a . x <= b.
    var cons = [];
    function push(row, flip, label) {
      var a = [], b = frSub(row.rhs.cons, row.lhs.cons);
      for (var k = 0; k < n; k++) {
        var l = row.lhs.coef[order[k]] || fr(0), rr = row.rhs.coef[order[k]] || fr(0);
        a.push(frSub(l, rr));
      }
      if (flip) { a = a.map(frNeg); b = frNeg(b); }
      if (a.every(frZero)) {
        return frCmp(b, fr(0)) < 0
          ? { ok: false, error: 'The constraint "' + esc(row.src) + '" has no variables and is false — ' +
              'the feasible region is empty.' }
          : null;   // vacuously true, drop it
      }
      cons.push({ a: a, b: b, src: row.src, kind: 'user', label: label || row.src });
      return null;
    }

    for (var q = 0; q < rows.length; q++) {
      var row = rows[q], bad;
      if (row.rel === 'le') bad = push(row, false);
      else if (row.rel === 'ge') bad = push(row, true);
      else { bad = push(row, false) || push(row, true); }
      if (bad) return bad;
    }
    if (!cons.length) return { ok: false, error: 'Every constraint you wrote is vacuous.' };

    var userCount = cons.length;
    for (var v = 0; v < n; v++) {
      var a2 = [];
      for (var k2 = 0; k2 < n; k2++) a2.push(fr(k2 === v ? -1 : 0));
      cons.push({ a: a2, b: fr(0), src: order[v] + ' >= 0', kind: 'nonneg', label: order[v] + ' ≥ 0' });
    }

    return {
      ok: true, vars: order, n: n, idx: idx, dir: dir,
      obj: order.map(function (v) { return obj.coef[v] || fr(0); }),
      objConst: obj.cons,
      cons: cons, userCount: userCount, m: cons.length,
      text: lines.join('\n')
    };
  }

  /** Objective value at a point. */
  function lpEval(lp, x) {
    var s = lp.objConst || fr(0);
    for (var i = 0; i < lp.n; i++) s = frAdd(s, frMul(lp.obj[i], x[i]));
    return s;
  }

  /** Which constraints does a point satisfy, and which does it break? */
  function lpCheck(lp, x) {
    var broken = [], tight = [];
    for (var i = 0; i < lp.cons.length; i++) {
      var s = fr(0), c = lp.cons[i];
      for (var j = 0; j < lp.n; j++) s = frAdd(s, frMul(c.a[j], x[j]));
      var d = frCmp(s, c.b);
      if (d > 0) broken.push({ i: i, con: c, lhs: s });
      else if (d === 0) tight.push(i);
    }
    return { ok: !broken.length, broken: broken, tight: tight, feasible: !broken.length };
  }

  /* ---------- vertices of the feasible region ---------- */

  /** Solve an n x n rational system by Gauss-Jordan. null if singular. */
  function lpSolveSquare(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.slice().concat([b[i]]); });
    for (var col = 0; col < n; col++) {
      var p = -1;
      for (var r = col; r < n; r++) if (!frZero(M[r][col])) { p = r; break; }
      if (p < 0) return null;
      var t = M[col]; M[col] = M[p]; M[p] = t;
      var piv = M[col][col];
      for (var k = col; k <= n; k++) M[col][k] = frDiv(M[col][k], piv);
      for (var r2 = 0; r2 < n; r2++) {
        if (r2 === col || frZero(M[r2][col])) continue;
        var f = M[r2][col];
        for (var k2 = col; k2 <= n; k2++) M[r2][k2] = frSub(M[r2][k2], frMul(f, M[col][k2]));
      }
    }
    var x = M.map(function (r) { return r[n]; });
    return x.some(frBad) ? null : x;
  }

  function lpKey(x) { return x.map(frStr).join(','); }

  /**
     Every vertex of the feasible region, by brute force: a vertex is
     where n of the constraint boundaries meet, so take every n of
     them, solve, and keep the solutions that satisfy the rest.

     Slow — C(m, n) systems — and deliberately so. This is the
     definition, not an algorithm anyone would ship, and its whole
     job is to be obviously right so that simplex can be checked
     against it.
  */
  function lpVertices(lp, opts) {
    opts = opts || {};
    var cap = opts.cap || 20000;
    var m = lp.cons.length, n = lp.n;
    if (n > m) return { ok: false, error: 'Fewer constraints than variables — no vertex can exist.' };

    var count = 1;
    for (var t = 0; t < n; t++) count = count * (m - t) / (t + 1);
    if (count > cap) {
      return { ok: false, error: 'That would need ' + Math.round(count) + ' systems of equations ' +
        '(' + m + ' constraints choose ' + n + '). Vertex enumeration is exponential — which is the ' +
        'whole reason simplex exists.' };
    }

    var seen = {}, verts = [], combo = [];
    (function choose(start, depth) {
      if (depth === n) {
        var A = combo.map(function (i) { return lp.cons[i].a; });
        var b = combo.map(function (i) { return lp.cons[i].b; });
        var x = lpSolveSquare(A, b);
        if (x) {
          var chk = lpCheck(lp, x);
          if (chk.feasible) {
            var key = lpKey(x);
            if (!seen[key]) {
              seen[key] = true;
              verts.push({ x: x, tight: chk.tight, obj: lpEval(lp, x), key: key });
            }
          }
        }
        return;
      }
      for (var i = start; i < m; i++) { combo[depth] = i; choose(i + 1, depth + 1); }
    })(0, 0);

    return { ok: true, verts: verts, systems: Math.round(count) };
  }

  /**
     The optimum, by enumerating vertices.

     Sound because the feasible region sits inside x >= 0, so it is
     pointed: if it is non-empty it has at least one vertex, and if
     the objective is bounded on it the optimum is attained at one.
     Unboundedness is caught by re-solving inside a box and then a
     bigger box: if the answer moves, nothing was holding it in.
  */
  function lpSolveByVertices(lp, opts) {
    opts = opts || {};
    var res = lpVertices(lp, opts);
    if (!res.ok) return res;

    if (!res.verts.length) {
      return { ok: true, status: 'infeasible', verts: [],
        note: 'No point satisfies every constraint. The feasible region is empty, so there is nothing ' +
              'to optimise — the LP definition allows this outcome.' };
    }

    var sign = lp.dir === 'max' ? 1 : -1;
    function better(a, b) { return sign * frCmp(a, b) > 0; }

    var best = res.verts[0];
    res.verts.forEach(function (v) { if (better(v.obj, best.obj)) best = v; });
    var ties = res.verts.filter(function (v) { return frCmp(v.obj, best.obj) === 0; });

    // Unbounded? Box it in, twice, and see whether the answer moves.
    var boxed = opts.noBoundCheck ? null : lpBoxProbe(lp, res.verts);

    return {
      ok: true,
      status: boxed && boxed.unbounded ? 'unbounded' : 'optimal',
      verts: res.verts, systems: res.systems,
      best: best, x: best.x, obj: best.obj,
      ties: ties, multiple: ties.length > 1,
      unbounded: !!(boxed && boxed.unbounded), probe: boxed,
      note: boxed && boxed.unbounded
        ? 'The objective is unbounded: enlarging an artificial box around the region moves the ' +
          'optimum with it, so no finite maximum exists.'
        : (ties.length > 1
            ? 'The optimum is attained at ' + ties.length + ' vertices, so every point on the edge ' +
              'between them is optimal too — the "infinitely many solutions" case.'
            : 'A unique optimal vertex.')
    };
  }

  /** Add x_i <= M for a big M, then for 2M. If the optimum improves, it was unbounded. */
  function lpBoxProbe(lp, verts) {
    var big = 16;
    verts.forEach(function (v) {
      v.x.forEach(function (c) { big = Math.max(big, Math.abs(frNum(c)) * 4); });
    });
    big = Math.ceil(big);

    function solveBoxed(M) {
      var lp2 = { ok: true, vars: lp.vars, n: lp.n, idx: lp.idx, dir: lp.dir,
                  obj: lp.obj, objConst: lp.objConst, cons: lp.cons.slice(),
                  userCount: lp.userCount, m: 0 };
      for (var v = 0; v < lp.n; v++) {
        var a = [];
        for (var k = 0; k < lp.n; k++) a.push(fr(k === v ? 1 : 0));
        lp2.cons.push({ a: a, b: fr(M), src: 'box', kind: 'box', label: lp.vars[v] + ' ≤ ' + M });
      }
      lp2.m = lp2.cons.length;
      var r = lpVertices(lp2, { cap: 60000 });
      if (!r.ok || !r.verts.length) return null;
      var sign = lp.dir === 'max' ? 1 : -1;
      var b = r.verts[0];
      r.verts.forEach(function (v2) { if (sign * frCmp(v2.obj, b.obj) > 0) b = v2; });
      return b.obj;
    }

    var a1 = solveBoxed(big), a2 = solveBoxed(big * 2);
    if (!a1 || !a2) return { unbounded: false, inconclusive: true };
    var sign = lp.dir === 'max' ? 1 : -1;
    return { unbounded: sign * frCmp(a2, a1) > 0, at: big, atBig: a2, atSmall: a1 };
  }

  /** For drawing: the feasible polygon of a two-variable LP, in order. */
  function lpPolygon(lp) {
    if (lp.n !== 2) return null;
    var r = lpVertices(lp);
    if (!r.ok || r.verts.length < 3) return r.ok ? { ok: true, pts: r.verts } : r;
    var pts = r.verts.map(function (v) { return { v: v, x: frNum(v.x[0]), y: frNum(v.x[1]) }; });
    var cx = pts.reduce(function (s, p) { return s + p.x; }, 0) / pts.length;
    var cy = pts.reduce(function (s, p) { return s + p.y; }, 0) / pts.length;
    pts.sort(function (p, q) {
      return Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx);
    });
    return { ok: true, pts: pts.map(function (p) { return p.v; }), ring: pts };
  }

  /* ---------- the standard programs ---------- */

  var LP_PRESETS = {
    worked: 'max 2x + 3y\n3x + 2y <= 15\n2y - x <= 5\nx + 2y <= 7',
    unique:  'max 3x + y\nx + y <= 4\nx <= 3\ny <= 3',
    many:    'max 2x + 2y\nx + y <= 4\nx <= 3\ny <= 3',
    empty:   'max x + y\nx + y <= 2\nx + y >= 5',
    unbounded: 'max x + y\nx - y <= 1',
    degenerate: 'max 3x + 2y\nx + y <= 4\nx - y <= 0\nx <= 3',
    energy: '# capacities in GW, cost in GBP/kWh, CO2 normalised so coal = 1\n' +
            'min 40G + 80C + 22S + 22W + 120N\n' +
            'G <= 32\nC <= 8\nS <= 13.5\nW <= 24\nN <= 10\n' +
            'G + C + S + W + N >= 60\n' +
            '0.5G + 1C <= 10'
  };
