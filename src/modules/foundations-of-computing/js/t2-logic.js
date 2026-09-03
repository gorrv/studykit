  /* ============================================================
     PROPOSITIONAL LOGIC, TRUTH TABLES AND NORMAL FORMS (Topic 02)

     Everything in this file exists to make one claim checkable:
     that a formula, its disjunctive normal form and its conjunctive
     normal form all say the same thing.

     The lectures prove that in two directions:

       DNF — one conjunction per row where the formula is TRUE,
             joined by ∨. Any true row makes the whole thing true.

       CNF — one disjunction per row where the formula is FALSE,
             joined by ∧, each clause written to *rule that row out*.
             So the literals are flipped: a row with P true is
             excluded by the clause containing ¬P.

     Both are read straight off the truth table, so the table is the
     primitive here and the normal forms are derived from it — not
     asserted, and not produced by a separate rewriting pass that
     could disagree with it. fmAgree() then re-evaluates all three
     over every assignment, which is the whole theorem for a given
     formula, checked by exhaustion.
     ============================================================ */

  /**
   * Parse a propositional formula.
   *
   *   expr -> imp
   *   imp  -> or  ('→' or)*        right-associative
   *   or   -> and ('∨' and)*
   *   and  -> not ('∧' not)*
   *   not  -> '¬' not | atom
   *   atom -> VAR | '(' expr ')' | '⊤' | '⊥'
   *
   * Keyboards do not have the logical symbols, so ASCII stands in:
   * ~ ! for ¬, & for ∧, | for ∨, -> for →. Variables are an
   * upper-case letter with optional digits: P, Q, R, P1, P2.
   *
   * @returns {{ok: true, ast} | {ok: false, error: string}}
   */
  function fmParse(src) {
    var s = String(src).replace(/\s+/g, '');
    if (!s) return { ok: false, error: 'Nothing to parse yet.' };

    var at = 0, fail = null;

    function peek() { return s.charAt(at); }
    function eat(str) {
      if (s.substr(at, str.length) === str) { at += str.length; return true; }
      return false;
    }
    function isNot() { return peek() === '¬' || peek() === '~' || peek() === '!'; }
    function isAnd() { return peek() === '∧' || peek() === '&'; }
    function isOr() { return peek() === '∨' || peek() === '|'; }
    function isImp() { return s.substr(at, 2) === '->' || peek() === '→' || peek() === '⇒'; }

    function expr() { return imp(); }

    function imp() {
      var left = orX();
      if (fail) return null;
      if (isImp()) {
        if (!eat('->')) at++;
        var right = imp();                       // right-associative
        if (fail) return null;
        return { op: 'imp', a: left, b: right };
      }
      return left;
    }

    function orX() {
      var left = andX();
      if (fail) return null;
      while (isOr()) {
        at++;
        var right = andX();
        if (fail) return null;
        left = { op: 'or', a: left, b: right };
      }
      return left;
    }

    function andX() {
      var left = notX();
      if (fail) return null;
      while (isAnd()) {
        at++;
        var right = notX();
        if (fail) return null;
        left = { op: 'and', a: left, b: right };
      }
      return left;
    }

    function notX() {
      if (isNot()) { at++; var inner = notX(); return fail ? null : { op: 'not', a: inner }; }
      return atom();
    }

    function atom() {
      var c = peek();
      if (c === '(') {
        at++;
        var inner = expr();
        if (fail) return null;
        if (peek() !== ')') { fail = 'Missing a closing bracket.'; return null; }
        at++;
        return inner;
      }
      if (c === ')') { fail = 'A closing bracket with nothing to close.'; return null; }
      if (c === '') { fail = 'The formula stops in the middle.'; return null; }
      if (c === '⊤' || c === '1') { at++; return { op: 'true' }; }
      if (c === '⊥' || c === '0') { at++; return { op: 'false' }; }

      var m = /^[A-Z][0-9]*/.exec(s.slice(at));
      if (!m) {
        fail = 'Expected a variable but found <code>' + esc(c) + '</code>. ' +
               'Variables are capital letters: P, Q, R.';
        return null;
      }
      at += m[0].length;
      return { op: 'var', name: m[0] };
    }

    var ast = expr();
    if (fail) return { ok: false, error: fail };
    if (at < s.length) {
      return { ok: false, error: 'Unexpected <code>' + esc(s.charAt(at)) + '</code> after a complete formula.' };
    }
    return { ok: true, ast: ast };
  }

  /**
   * Every variable in the formula, in alphabetical order.
   *
   * Sorted rather than in order of appearance, because a truth table is
   * something you compare against someone else's — the lecturer's, or
   * your own from last week. Columns in P, Q, R order make the rows
   * line up; columns in the order the variables happen to appear in the
   * text do not, and two correct tables would then look different.
   */
  function fmVars(ast) {
    var seen = [];
    (function walk(n) {
      if (!n) return;
      if (n.op === 'var') { if (seen.indexOf(n.name) < 0) seen.push(n.name); return; }
      walk(n.a); walk(n.b);
    })(ast);
    return seen.sort(function (a, b) {
      var la = a.replace(/[0-9]+$/, ''), lb = b.replace(/[0-9]+$/, '');
      if (la !== lb) return la < lb ? -1 : 1;
      return (parseInt(a.slice(la.length), 10) || 0) - (parseInt(b.slice(lb.length), 10) || 0);
    });
  }

  /** Evaluate under an assignment {P: true, Q: false, ...}. */
  function fmEval(ast, env) {
    switch (ast.op) {
      case 'var':   return !!env[ast.name];
      case 'true':  return true;
      case 'false': return false;
      case 'not':   return !fmEval(ast.a, env);
      case 'and':   return fmEval(ast.a, env) && fmEval(ast.b, env);
      case 'or':    return fmEval(ast.a, env) || fmEval(ast.b, env);
      case 'imp':   return !fmEval(ast.a, env) || fmEval(ast.b, env);
    }
    return false;
  }

  /** Precedence, so fmShow can drop brackets that carry no meaning. */
  var FM_PREC = { imp: 1, or: 2, and: 3, not: 4, var: 5, true: 5, false: 5 };

  /** Write a formula back out with the minimum brackets needed. */
  function fmShow(ast) {
    function go(n, outer, right) {
      var p = FM_PREC[n.op], txt;
      switch (n.op) {
        case 'var':   return n.name;
        case 'true':  return '⊤';
        case 'false': return '⊥';
        case 'not':   return '¬' + go(n.a, p, false);
        case 'and':   txt = go(n.a, p, false) + ' ∧ ' + go(n.b, p, true); break;
        case 'or':    txt = go(n.a, p, false) + ' ∨ ' + go(n.b, p, true); break;
        case 'imp':   txt = go(n.a, p + 1, false) + ' → ' + go(n.b, p, true); break;
      }
      return (p < outer || (p === outer && right && n.op !== 'imp')) ? '(' + txt + ')' : txt;
    }
    return go(ast, 0, false);
  }

  /**
   * The full truth table.
   *
   * Row order is the one the lecture slides use: all variables TRUE in
   * the first row, all FALSE in the last, counting down in binary with
   * TRUE as the high value. Row numbers here match the numbering used
   * when the notes say things like "read the DNF off rows 2, 5, 6, 7".
   *
   * @returns {{vars, rows: Array<{n, env, bits, value}>}}
   */
  function fmTable(ast) {
    var vars = fmVars(ast);
    var n = vars.length, total = Math.pow(2, n), rows = [];

    for (var i = 0; i < total; i++) {
      var env = {}, bits = [];
      for (var j = 0; j < n; j++) {
        // bit 0 means TRUE, so i = 0 is the all-true row.
        var val = ((i >> (n - 1 - j)) & 1) === 0;
        env[vars[j]] = val;
        bits.push(val);
      }
      rows.push({ n: i + 1, env: env, bits: bits, value: fmEval(ast, env) });
    }
    return { vars: vars, rows: rows };
  }

  /* ---------- literals ---------- */

  function fmLit(v, neg) { return { v: v, neg: !!neg }; }
  function fmLitShow(l) { return (l.neg ? '¬' : '') + l.v; }
  function fmLitEval(l, env) { return l.neg ? !env[l.v] : !!env[l.v]; }

  /**
   * DNF, read off the rows where the formula is TRUE.
   *
   * Each true row becomes one conjunction that is satisfied by exactly
   * that row: a variable true in the row appears plain, a variable
   * false in the row appears negated.
   */
  function fmDnf(table) {
    var terms = [], rows = [];
    for (var i = 0; i < table.rows.length; i++) {
      var r = table.rows[i];
      if (!r.value) continue;
      var term = [];
      for (var j = 0; j < table.vars.length; j++) {
        term.push(fmLit(table.vars[j], !r.bits[j]));
      }
      terms.push(term);
      rows.push(r.n);
    }
    return { terms: terms, rows: rows };
  }

  /**
   * CNF, read off the rows where the formula is FALSE.
   *
   * Each false row becomes one disjunction whose only job is to rule
   * that row out, so every literal is the opposite of what the row
   * says: a variable true in the row appears negated. Every other row
   * satisfies the clause automatically.
   */
  function fmCnf(table) {
    var clauses = [], rows = [];
    for (var i = 0; i < table.rows.length; i++) {
      var r = table.rows[i];
      if (r.value) continue;
      var clause = [];
      for (var j = 0; j < table.vars.length; j++) {
        clause.push(fmLit(table.vars[j], r.bits[j]));      // flipped
      }
      clauses.push(clause);
      rows.push(r.n);
    }
    return { clauses: clauses, rows: rows };
  }

  function fmDnfShow(terms) {
    if (!terms.length) return '⊥';                          // true nowhere
    return terms.map(function (t) {
      return (t.length > 1 ? '(' : '') + t.map(fmLitShow).join(' ∧ ') + (t.length > 1 ? ')' : '');
    }).join(' ∨ ');
  }

  function fmCnfShow(clauses) {
    if (!clauses.length) return '⊤';                        // false nowhere
    return clauses.map(function (c) {
      return (c.length > 1 ? '(' : '') + c.map(fmLitShow).join(' ∨ ') + (c.length > 1 ? ')' : '');
    }).join(' ∧ ');
  }

  function fmDnfEval(terms, env) {
    if (!terms.length) return false;
    return terms.some(function (t) { return t.every(function (l) { return fmLitEval(l, env); }); });
  }

  function fmCnfEval(clauses, env) {
    if (!clauses.length) return true;
    return clauses.every(function (c) { return c.some(function (l) { return fmLitEval(l, env); }); });
  }

  /**
   * The check that matters: do the formula, its DNF and its CNF agree
   * on every assignment?
   *
   * This is the theorem the lecture proves, evaluated rather than
   * trusted. It runs on every render, so a tool that got the normal
   * form wrong would say so on screen instead of teaching it.
   *
   * @returns {{ok: boolean, checked: number, first: object|null}}
   */
  function fmAgree(ast, terms, clauses) {
    var table = fmTable(ast);
    for (var i = 0; i < table.rows.length; i++) {
      var r = table.rows[i];
      var d = fmDnfEval(terms, r.env), c = fmCnfEval(clauses, r.env);
      if (d !== r.value || c !== r.value) {
        return { ok: false, checked: i + 1, first: { row: r.n, formula: r.value, dnf: d, cnf: c } };
      }
    }
    return { ok: true, checked: table.rows.length, first: null };
  }

  /**
   * Satisfiability by exhaustion, and the first model found.
   *
   * 2ⁿ rows is exactly the cost the lectures point at when they say a
   * truth table is not a polynomial-time decision procedure. The tool
   * reports the row count so the growth is visible rather than stated.
   */
  function fmSat(ast) {
    var table = fmTable(ast);
    for (var i = 0; i < table.rows.length; i++) {
      if (table.rows[i].value) {
        return { sat: true, model: table.rows[i].env, row: table.rows[i].n, rows: table.rows.length };
      }
    }
    return { sat: false, model: null, row: null, rows: table.rows.length };
  }

  /**
   * Pull the clause list out of a formula that is already in CNF.
   *
   * The SAT ≤p CLIQUE reduction takes CNF as its input, and the graph
   * it builds depends on how the formula is *written*, not only on
   * what it means — so the clauses have to come from the text rather
   * than from a re-derived normal form.
   *
   * @returns {{ok: true, clauses} | {ok: false, error: string}}
   */
  function fmClauses(ast) {
    var clauses = [], bad = null;

    function literal(n) {
      if (n.op === 'var') return fmLit(n.name, false);
      if (n.op === 'not' && n.a.op === 'var') return fmLit(n.a.name, true);
      bad = 'This is not in CNF: <code>' + esc(fmShow(n)) + '</code> is not a literal. ' +
            'A CNF clause may only contain variables and negated variables.';
      return null;
    }

    function clause(n, into) {
      if (n.op === 'or') { clause(n.a, into); clause(n.b, into); return; }
      var l = literal(n);
      if (l) into.push(l);
    }

    function conj(n) {
      if (n.op === 'and') { conj(n.a); conj(n.b); return; }
      var c = [];
      clause(n, c);
      if (!bad) clauses.push(c);
    }

    conj(ast);
    if (bad) return { ok: false, error: bad };
    return { ok: true, clauses: clauses };
  }

  function fmClausesShow(clauses) { return fmCnfShow(clauses); }
