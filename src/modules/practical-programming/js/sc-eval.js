  /* ============================================================
     SCALA · the evaluator the Scala topics share

     Enough Scala to answer the questions these topics ask: what does
     this evaluate to, what is its type, which case matches, what
     does the for-comprehension turn into.

     It parses to a tree and then evaluates, rather than evaluating
     as it parses, because a lambda's body has to be kept and run
     later — possibly many times, possibly never.

     How much of this can be trusted without a Scala compiler:

       arithmetic   every Int and Double expression is emitted as
                    Java and run on a real JVM by the test suite.
                    Scala's Int is the JVM's int, so agreeing with
                    Java is agreeing with Scala.
       collections  map / filter / find / count and the rest are
                    compared against JavaScript's own array methods,
                    which are a genuinely separate implementation of
                    the same operations.
       the rest     laws that have to hold whatever the language:
                    a for-comprehension and the map it desugars to
                    give the same answer, find agrees with the first
                    element filter keeps, and so on.

     Where none of those reach — type inference beyond this subset,
     mostly — the evaluator refuses the expression rather than
     guessing at an answer nobody has checked.
     ============================================================ */

  /* ---------- values ---------- */

  function scInt(n) { return { t: 'Int', v: n | 0 }; }
  function scBig(n) { return { t: 'BigInt', v: n }; }
  function scDbl(n) { return { t: 'Double', v: n }; }
  function scBool(b) { return { t: 'Boolean', v: !!b }; }
  function scStr(s) { return { t: 'String', v: s }; }
  function scChar(c) { return { t: 'Char', v: c }; }
  function scUnit() { return { t: 'Unit', v: null }; }
  function scList(items, el) { return { t: 'List', el: el || scElemType(items), v: items }; }
  function scTuple(items) { return { t: 'Tuple', v: items }; }
  function scSome(v) { return { t: 'Option', some: true, v: v }; }
  function scNone() { return { t: 'Option', some: false, v: null }; }
  function scMap(pairs) { return { t: 'Map', v: pairs }; }
  function scFn(params, body, env, text) {
    return { t: 'Function', params: params, body: body, env: env, text: text };
  }

  /** The element type of a list literal, as far as this subset goes. */
  function scElemType(items) {
    if (!items.length) return 'Nothing';
    var kinds = {};
    items.forEach(function (i) { kinds[scTypeName(i)] = true; });
    var ks = Object.keys(kinds);
    if (ks.length === 1) return ks[0];
    /* The one widening this subset allows, because it is the one that
       comes up. Anything else mixed is refused rather than guessed at:
       Scala would give the nearest common supertype, and saying which
       that is takes a compiler. */
    if (ks.length === 2 && kinds.Int && kinds.Double) return 'Double';
    if (ks.length === 2 && kinds.Int && kinds.BigInt) return 'BigInt';
    return null;
  }

  function scTypeName(val) {
    if (!val) return '?';
    if (val.t === 'List') return 'List[' + (val.el === null ? '…' : val.el) + ']';
    if (val.t === 'Tuple') return '(' + val.v.map(scTypeName).join(', ') + ')';
    if (val.t === 'Option') {
      return 'Option[' + (val.some ? scTypeName(val.v) : 'Nothing') + ']';
    }
    if (val.t === 'Map') {
      if (!val.v.length) return 'Map[Nothing, Nothing]';
      return 'Map[' + scTypeName(val.v[0][0]) + ', ' + scTypeName(val.v[0][1]) + ']';
    }
    if (val.t === 'Function') {
      return '(' + val.params.map(function () { return '?'; }).join(', ') + ') => ?';
    }
    return val.t;
  }

  /** How Scala's REPL would print the value. */
  function scShow(val) {
    if (!val) return '?';
    switch (val.t) {
      case 'Int': return String(val.v);
      case 'BigInt': return val.v.toString();
      case 'Double':
        if (Number.isNaN(val.v)) return 'NaN';
        if (!isFinite(val.v)) return val.v > 0 ? 'Infinity' : '-Infinity';
        return Number.isInteger(val.v) ? val.v.toFixed(1) : String(val.v);
      case 'Boolean': return val.v ? 'true' : 'false';
      case 'String': return '"' + val.v + '"';
      case 'Char': return "'" + val.v + "'";
      case 'List': return (val.isSet ? 'Set(' : 'List(') +
        val.v.map(scShow).join(', ') + ')';
      case 'Tuple': return '(' + val.v.map(scShow).join(', ') + ')';
      case 'Option': return val.some ? 'Some(' + scShow(val.v) + ')' : 'None';
      case 'Map': return 'Map(' + val.v.map(function (p) {
        return scShow(p[0]) + ' -> ' + scShow(p[1]);
      }).join(', ') + ')';
      case 'Function': return '<function>';
      case 'Unit': return '()';
    }
    return '?';
  }

  /** Value equality, which is what Scala's == does. */
  function scEq(a, b) {
    if (!a || !b) return false;
    var numeric = { Int: 1, Double: 1, BigInt: 1 };
    if (numeric[a.t] && numeric[b.t]) return Number(a.v) === Number(b.v);
    if (a.t !== b.t) return false;
    return scShow(a) === scShow(b);
  }

  /* ---------- tokens ---------- */

  function scLex(src) {
    var toks = [], i = 0;
    var WORD = /[A-Za-z_][A-Za-z_0-9]*/y;
    while (i < src.length) {
      var c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '/') {           // a line comment
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      if (c === '"') {
        var j = i + 1, s = '';
        while (j < src.length && src[j] !== '"') { s += src[j]; j++; }
        if (j >= src.length) return { ok: false, error: 'Unterminated string literal.' };
        toks.push({ k: 'str', v: s }); i = j + 1; continue;
      }
      if (c === "'" && src[i + 2] === "'") { toks.push({ k: 'char', v: src[i + 1] }); i += 3; continue; }
      if (/[0-9]/.test(c)) {
        var n = '';
        while (i < src.length && /[0-9]/.test(src[i])) { n += src[i]; i++; }
        if (src[i] === '.' && /[0-9]/.test(src[i + 1] || '')) {
          n += '.'; i++;
          while (i < src.length && /[0-9]/.test(src[i])) { n += src[i]; i++; }
          toks.push({ k: 'dbl', v: parseFloat(n) }); continue;
        }
        toks.push({ k: 'int', v: n }); continue;
      }
      /* `_` on its own is the placeholder; `_1` and `_2` are members. */
      if (c === '_' && !/[A-Za-z0-9_]/.test(src[i + 1] || '')) {
        toks.push({ k: 'op', v: '_' }); i++; continue;
      }
      WORD.lastIndex = i;
      var m = WORD.exec(src);
      if (m) { toks.push({ k: 'word', v: m[0] }); i = WORD.lastIndex; continue; }
      var three = src.substr(i, 3), two = src.substr(i, 2);
      if (three === ':::') { toks.push({ k: 'op', v: ':::' }); i += 3; continue; }
      if (['::', '==', '!=', '<=', '>=', '&&', '||', '=>', '<-', '->', '++'].indexOf(two) >= 0) {
        toks.push({ k: 'op', v: two }); i += 2; continue;
      }
      if ('+-*/%<>!(),.{}=;:'.indexOf(c) >= 0) { toks.push({ k: 'op', v: c }); i++; continue; }
      return { ok: false, error: 'I do not know what to do with <code>' + esc(c) + '</code>.' };
    }
    return { ok: true, toks: toks };
  }

  /* ---------- parsing ---------- */

  /* Scala takes an operator's precedence from its first character.
     These are the ones this subset has. */
  var SC_PREC = {
    '||': 1, '&&': 2,
    '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4,
    '::': 5, ':::': 5, '++': 5, '->': 5,
    '+': 6, '-': 6,
    '*': 7, '/': 7, '%': 7
  };
  function scRightAssoc(op) { return op.charAt(op.length - 1) === ':'; }

  /* Scala lets any single-argument method be written infix: `'a' to 'z'`
     is `'a'.to('z')`. Only the ones this subset has are recognised, so
     that a stray word is still an error rather than a mystery. */
  var SC_INFIX = { to: 1, until: 1, max: 1, min: 1, contains: 1 };

  /* ---------- pattern matching ----------

     Cases are tried in order and the first that matches wins; a
     pattern that would also have matched never gets the chance. That
     ordering is the whole of the semantics, and it is why a `case _`
     placed second makes everything below it dead.
  */
  function scMatchPat(pat, val, binds) {
    switch (pat.p) {
      case 'wild': return true;
      case 'bind': binds[pat.n] = val; return true;
      case 'lit': return scEq(pat.v, val);
      case 'none': return val.t === 'Option' && !val.some;
      case 'some':
        return val.t === 'Option' && val.some && scMatchPat(pat.inner, val.v, binds);
      case 'nil': return val.t === 'List' && val.v.length === 0;
      case 'cons':
        if (val.t !== 'List' || !val.v.length) return false;
        return scMatchPat(pat.head, val.v[0], binds) &&
               scMatchPat(pat.tail, scList(val.v.slice(1), val.el), binds);
      case 'list':
        if (val.t !== 'List' || val.v.length !== pat.items.length) return false;
        return pat.items.every(function (p, i) { return scMatchPat(p, val.v[i], binds); });
      case 'tuple':
        if (val.t !== 'Tuple' || val.v.length !== pat.parts.length) return false;
        return pat.parts.every(function (p, i) { return scMatchPat(p, val.v[i], binds); });
    }
    return false;
  }

  /** A pattern, written back out the way it was read. */
  function scPatText(pat) {
    switch (pat.p) {
      case 'wild': return '_';
      case 'bind': return pat.n;
      case 'lit': return scShow(pat.v);
      case 'none': return 'None';
      case 'some': return 'Some(' + scPatText(pat.inner) + ')';
      case 'nil': return 'Nil';
      case 'cons': return scPatText(pat.head) + ' :: ' + scPatText(pat.tail);
      case 'list': return 'List(' + pat.items.map(scPatText).join(', ') + ')';
      case 'tuple': return '(' + pat.parts.map(scPatText).join(', ') + ')';
    }
    return '?';
  }

  function scParse(src) {
    var lexed = scLex(src);
    if (!lexed.ok) return lexed;
    var toks = lexed.toks, pos = 0;

    function peek(o) { return toks[pos + (o || 0)]; }
    function next() { return toks[pos++]; }
    function isOp(v, o) { var t = peek(o); return !!t && t.k === 'op' && t.v === v; }
    function isWord(v, o) { var t = peek(o); return !!t && t.k === 'word' && t.v === v; }
    function eat(v) {
      if (!isOp(v)) fail('Expected <code>' + esc(v) + '</code>' + (peek()
        ? ', found <code>' + esc(String(peek().v)) + '</code>' : ' at the end') + '.');
      pos++;
    }
    function fail(msg) { throw { msg: msg }; }

    /* Does this subtree mention the `_` placeholder? If so, the
       enclosing expression is a lambda: `_ < 4` means `x => x < 4`. */
    function hasPlaceholder(node) {
      if (!node || typeof node !== 'object') return false;
      if (node.k === 'placeholder') return true;
      if (node.k === 'lambda') return false;     // its own `_` belongs to it
      return Object.keys(node).some(function (key) {
        var v = node[key];
        if (Array.isArray(v)) return v.some(hasPlaceholder);
        return hasPlaceholder(v);
      });
    }
    function countPlaceholders(node) {
      if (!node || typeof node !== 'object') return 0;
      if (node.k === 'placeholder') return 1;
      if (node.k === 'lambda') return 0;
      return Object.keys(node).reduce(function (acc, key) {
        var v = node[key];
        if (Array.isArray(v)) return acc + v.reduce(function (a, x) { return a + countPlaceholders(x); }, 0);
        return acc + countPlaceholders(v);
      }, 0);
    }

    function wrapPlaceholder(node) {
      if (!hasPlaceholder(node)) return node;
      /* Each `_` is its own parameter, in order: `_ + _` is
         `(a, b) => a + b`, not `x => x + x`. This subset only handles
         one, and says so rather than quietly meaning something else. */
      if (countPlaceholders(node) > 1) {
        fail('Every <code>_</code> is a <em>separate</em> parameter, so <code>_ * _</code> means ' +
          '<code>(a, b) =&gt; a * b</code> and not <code>x =&gt; x * x</code>. Write the lambda ' +
          'out — <code>x =&gt; x * x</code> — when you mean the same argument twice.');
      }
      var name = '_p';
      (function rename(n) {
        if (!n || typeof n !== 'object') return;
        if (n.k === 'placeholder') { n.k = 'name'; n.n = name; return; }
        Object.keys(n).forEach(function (key) {
          var v = n[key];
          if (Array.isArray(v)) v.forEach(rename); else rename(v);
        });
      })(node);
      return { k: 'lambda', params: [name], body: node, text: null };
    }

    function parseExpr(minPrec) {
      /* A lambda binds looser than anything else: x => ... */
      if (peek() && peek().k === 'word' && isOp('=>', 1)) {
        var p = next().v; next();
        return { k: 'lambda', params: [p], body: parseExpr(1) };
      }
      /* (x: Int) => ... and (x, y) => ... */
      if (isOp('(')) {
        var save = pos;
        var params = tryParseParams();
        if (params && isOp('=>')) {
          next();
          return { k: 'lambda', params: params, body: parseExpr(1) };
        }
        pos = save;
      }

      var left = parseUnary();
      for (;;) {
        var t = peek();
        /* An infix method call binds tighter than any operator here. */
        if (t && t.k === 'word' && SC_INFIX[t.v] && minPrec <= 8) {
          next();
          left = { k: 'call', target: left, name: t.v, args: [parseUnary()] };
          continue;
        }
        if (!t || t.k !== 'op' || !(t.v in SC_PREC)) break;
        var prec = SC_PREC[t.v];
        if (prec < minPrec) break;
        next();
        var right = parseExpr(scRightAssoc(t.v) ? prec : prec + 1);
        left = { k: 'bin', op: t.v, l: left, r: right };
      }
      return left;
    }

    /** `(x: Int, y: Int)` or `(x, y)` — returns names, or null. */
    function tryParseParams() {
      if (!isOp('(')) return null;
      var save = pos;
      next();
      var names = [];
      if (isOp(')')) { next(); return names; }
      for (;;) {
        var t = peek();
        if (!t || t.k !== 'word') { pos = save; return null; }
        next();
        names.push(t.v);
        if (isOp(':')) { next(); if (peek() && peek().k === 'word') next(); }
        else if (peek() && peek().k === 'op' && peek().v === ':') { pos = save; return null; }
        if (isOp(',')) { next(); continue; }
        if (isOp(')')) { next(); return names; }
        pos = save; return null;
      }
    }

    function parseUnary() {
      if (isOp('-')) { next(); return { k: 'un', op: '-', e: parseUnary() }; }
      if (isOp('!')) { next(); return { k: 'un', op: '!', e: parseUnary() }; }
      return parsePostfix();
    }

    function parsePostfix() {
      var v = parsePrimary();
      for (;;) {
        if (isOp('.')) {
          next();
          var name = next();
          if (!name || name.k !== 'word') fail('Expected a method name after <code>.</code>');
          var args = [];
          if (isOp('(')) args = parseArgs();
          v = { k: 'call', target: v, name: name.v, args: args };
          continue;
        }
        if (isWord('match')) {
          next();
          v = { k: 'match', scrut: v, cases: parseCases() };
          continue;
        }
        /* Applying a value that is a function: f(3) */
        if (isOp('(') && (v.k === 'name' || v.k === 'apply')) {
          v = { k: 'apply', fn: v, args: parseArgs() };
          continue;
        }
        break;
      }
      return v;
    }

    function parseArgs() {
      eat('(');
      var args = [];
      if (!isOp(')')) {
        args.push(wrapPlaceholder(parseExpr(1)));
        while (isOp(',')) { next(); args.push(wrapPlaceholder(parseExpr(1))); }
      }
      eat(')');
      return args;
    }

    function parseCases() {
      eat('{');
      var cases = [];
      while (isWord('case')) {
        next();
        var pat = parsePattern();
        var guard = null;
        if (isWord('if')) { next(); guard = parseExpr(1); }
        eat('=>');
        var body = parseExpr(1);
        cases.push({ pat: pat, guard: guard, body: body });
      }
      eat('}');
      if (!cases.length) fail('A <code>match</code> needs at least one <code>case</code>.');
      return cases;
    }

    /* Patterns: _, literals, variables, (p, p), Some(p), None, Nil,
       h :: t, List(p, ...) */
    function parsePattern() {
      var p = parsePatternPrimary();
      while (isOp('::')) {
        next();
        p = { p: 'cons', head: p, tail: parsePattern() };
      }
      return p;
    }
    function parsePatternPrimary() {
      var t = next();
      if (!t) fail('The pattern stops early.');
      if (t.k === 'op' && t.v === '_') return { p: 'wild' };
      if (t.k === 'op' && t.v === '-') {
        var lit = next();
        if (!lit || lit.k !== 'int') fail('Expected a number.');
        return { p: 'lit', v: scInt(-Number(lit.v)) };
      }
      if (t.k === 'int') return { p: 'lit', v: scInt(Number(t.v)) };
      if (t.k === 'dbl') return { p: 'lit', v: scDbl(t.v) };
      if (t.k === 'str') return { p: 'lit', v: scStr(t.v) };
      if (t.k === 'char') return { p: 'lit', v: scChar(t.v) };
      if (t.k === 'op' && t.v === '(') {
        var parts = [parsePattern()];
        while (isOp(',')) { next(); parts.push(parsePattern()); }
        eat(')');
        return parts.length === 1 ? parts[0] : { p: 'tuple', parts: parts };
      }
      if (t.k === 'word') {
        if (t.v === 'true') return { p: 'lit', v: scBool(true) };
        if (t.v === 'false') return { p: 'lit', v: scBool(false) };
        if (t.v === 'None') return { p: 'none' };
        if (t.v === 'Nil') return { p: 'nil' };
        if (t.v === 'Some') { eat('('); var inner = parsePattern(); eat(')'); return { p: 'some', inner: inner }; }
        if (t.v === 'List') {
          eat('(');
          var items = [];
          if (!isOp(')')) {
            items.push(parsePattern());
            while (isOp(',')) { next(); items.push(parsePattern()); }
          }
          eat(')');
          return { p: 'list', items: items };
        }
        /* A lowercase name binds; an uppercase one would be a constructor,
           which this subset does not have beyond Some/None. */
        if (/^[a-z_]/.test(t.v)) return { p: 'bind', n: t.v };
        fail('<code>' + esc(t.v) + '</code> is not a pattern this subset knows.');
      }
      fail('Unexpected <code>' + esc(String(t.v)) + '</code> in a pattern.');
    }

    function parsePrimary() {
      var t = next();
      if (!t) fail('The expression stops early.');

      if (t.k === 'int') {
        var n = Number(t.v);
        if (n > 2147483647) {
          fail('<code>' + esc(t.v) + '</code> does not fit in an <code>Int</code>. Scala rejects ' +
            'the literal outright — wrapping only ever happens to the result of arithmetic, ' +
            'never to something you wrote down.');
        }
        return { k: 'lit', v: scInt(n) };
      }
      if (t.k === 'dbl') return { k: 'lit', v: scDbl(t.v) };
      if (t.k === 'str') return { k: 'lit', v: scStr(t.v) };
      if (t.k === 'char') return { k: 'lit', v: scChar(t.v) };
      if (t.k === 'op' && t.v === '_') return { k: 'placeholder' };

      if (t.k === 'op' && t.v === '(') {
        var first = parseExpr(1);
        if (isOp(',')) {
          var parts = [first];
          while (isOp(',')) { next(); parts.push(parseExpr(1)); }
          eat(')');
          return { k: 'tuple', items: parts };
        }
        eat(')');
        return first;
      }

      if (t.k === 'word') {
        switch (t.v) {
          case 'true': return { k: 'lit', v: scBool(true) };
          case 'false': return { k: 'lit', v: scBool(false) };
          case 'Nil': return { k: 'lit', v: scList([], 'Nothing') };
          case 'None': return { k: 'lit', v: scNone() };
          case 'Some': return { k: 'some', e: parseArgs()[0] };
          case 'List': case 'Set': case 'Map': case 'BigInt': case 'Vector':
            return { k: 'ctor', name: t.v === 'Vector' ? 'List' : t.v, args: parseArgs() };
          case 'if': {
            eat('(');
            var c = parseExpr(1);
            eat(')');
            var th = parseExpr(1);
            var el = null;
            if (isWord('else')) { next(); el = parseExpr(1); }
            return { k: 'if', c: c, t: th, e: el };
          }
          case 'for': return parseFor();
        }
        return { k: 'name', n: t.v };
      }

      if (t.k === 'op' && t.v === '{') {
        /* A block: val bindings then a result expression. */
        var vals = [];
        while (isWord('val')) {
          next();
          var nm = next();
          if (!nm || nm.k !== 'word') fail('Expected a name after <code>val</code>.');
          if (isOp(':')) { next(); next(); }
          eat('=');
          vals.push({ name: nm.v, e: parseExpr(1) });
        }
        var result = parseExpr(1);
        eat('}');
        return { k: 'block', vals: vals, result: result };
      }

      fail('Unexpected <code>' + esc(String(t.v)) + '</code>.');
    }

    /* for (x <- xs; y <- ys if p) yield e   — and without the yield. */
    function parseFor() {
      eat('(');
      var gens = [];
      for (;;) {
        var nm = next();
        if (!nm || nm.k !== 'word') fail('Expected a name after <code>for (</code>.');
        if (!isOp('<-')) fail('Expected <code>&lt;-</code> in a for-comprehension.');
        next();
        var srcE = parseExpr(1);
        var guard = null;
        if (isWord('if')) { next(); guard = parseExpr(1); }
        gens.push({ name: nm.v, src: srcE, guard: guard });
        if (isOp(',') || isOp(';')) { next(); continue; }
        break;
      }
      eat(')');
      var y = null;
      if (isWord('yield')) { next(); y = parseExpr(1); }
      else y = parseExpr(1);
      return { k: 'for', gens: gens, yield: y, hasYield: true };
    }

    try {
      var ast = parseExpr(1);
      if (pos < toks.length) {
        return { ok: false, error: 'Left over after the expression: <code>' +
          esc(String(toks[pos].v)) + '</code>.' };
      }
      return { ok: true, ast: ast };
    } catch (e) {
      if (e && e.msg) return { ok: false, error: e.msg };
      throw e;
    }
  }

  /* ---------- evaluating ---------- */

  function scRun(ast, env) {
    var steps = [];      // for tools that want to show the work

    function die(msg, runtime) { throw { msg: msg, runtime: !!runtime }; }

    function lookup(env, n) {
      var e = env;
      while (e) {
        if (Object.prototype.hasOwnProperty.call(e.vars, n)) return e.vars[n];
        e = e.parent;
      }
      return undefined;
    }
    function child(env, vars) { return { vars: vars || {}, parent: env }; }

    function callFunction(fn, args) {
      if (fn.t !== 'Function') die('<code>' + scShow(fn) + '</code> is not a function.');
      if (fn.params.length !== args.length) {
        die('That function takes ' + fn.params.length + ' argument' +
          (fn.params.length === 1 ? '' : 's') + ', not ' + args.length + '.');
      }
      var vars = {};
      fn.params.forEach(function (p, i) { vars[p] = args[i]; });
      return ev(fn.body, child(fn.env, vars));
    }

    function truth(v) {
      if (v.t !== 'Boolean') die('Expected a Boolean, found a ' + scTypeName(v) + '.');
      return v.v;
    }

    /* ---- operators ---- */

    function numericPair(a, b) {
      if (a.t === 'Double' || b.t === 'Double') return 'Double';
      if (a.t === 'BigInt' || b.t === 'BigInt') return 'BigInt';
      if (a.t === 'Int' && b.t === 'Int') return 'Int';
      return null;
    }

    function binop(op, a, b) {
      if (op === '->') return scTuple([a, b]);
      if (op === '::') {
        if (b.t !== 'List') {
          die('<code>::</code> puts an element on the front of a <em>list</em>. The right-hand ' +
            'side here is a ' + scTypeName(b) + '.');
        }
        var items = [a].concat(b.v);
        var el = scElemType(items);
        if (el === null) die('That would make a list of mixed types.');
        return scList(items, el);
      }
      if (op === ':::' || op === '++') {
        if (a.t !== 'List' || b.t !== 'List') die('<code>' + esc(op) + '</code> joins two lists.');
        var all = a.v.concat(b.v);
        return scList(all, scElemType(all));
      }
      if (op === '&&' || op === '||') {
        return scBool(op === '&&' ? (truth(a) && truth(b)) : (truth(a) || truth(b)));
      }
      if (op === '==') return scBool(scEq(a, b));
      if (op === '!=') return scBool(!scEq(a, b));
      if (op === '+' && (a.t === 'String' || b.t === 'String')) {
        var l = a.t === 'String' ? a.v : scShow(a).replace(/^['"]|['"]$/g, '');
        var r = b.t === 'String' ? b.v : scShow(b).replace(/^['"]|['"]$/g, '');
        return scStr(l + r);
      }
      if (['<', '>', '<=', '>='].indexOf(op) >= 0) {
        if (a.t === 'String' && b.t === 'String') {
          return scBool(op === '<' ? a.v < b.v : op === '>' ? a.v > b.v :
                        op === '<=' ? a.v <= b.v : a.v >= b.v);
        }
        if (!numericPair(a, b)) {
          die('Cannot compare a ' + scTypeName(a) + ' with a ' + scTypeName(b) + '.');
        }
        var x = Number(a.v), y = Number(b.v);
        return scBool(op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y);
      }

      var kind = numericPair(a, b);
      if (!kind) {
        die('<code>' + esc(op) + '</code> is not defined for a ' + scTypeName(a) + ' and a ' +
          scTypeName(b) + '.');
      }
      if (kind === 'Double') {
        var p = Number(a.v), q = Number(b.v);
        if (op === '+') return scDbl(p + q);
        if (op === '-') return scDbl(p - q);
        if (op === '*') return scDbl(p * q);
        if (op === '/') return scDbl(p / q);
        if (op === '%') return scDbl(p % q);
      }
      if (kind === 'BigInt') {
        var A = BigInt(a.v), B = BigInt(b.v);
        if ((op === '/' || op === '%') && B === 0n) {
          die('Division by zero throws an <code>ArithmeticException</code>.', true);
        }
        if (op === '+') return scBig(A + B);
        if (op === '-') return scBig(A - B);
        if (op === '*') return scBig(A * B);
        if (op === '/') return scBig(A / B);
        if (op === '%') return scBig(A % B);
      }
      var i1 = a.v | 0, i2 = b.v | 0;
      if ((op === '/' || op === '%') && i2 === 0) {
        die('Division by zero. <code>Int</code> division by zero throws an ' +
          '<code>ArithmeticException</code> — it does not give Infinity the way Double does.', true);
      }
      if (op === '+') return scInt((i1 + i2) | 0);
      if (op === '-') return scInt((i1 - i2) | 0);
      if (op === '*') return scInt(Math.imul(i1, i2));
      if (op === '/') return scInt((i1 / i2) | 0);
      if (op === '%') return scInt(i1 % i2);
      die('Unknown operator <code>' + esc(op) + '</code>.');
    }

    /* ---- methods ---- */

    function asFn(v, what) {
      if (!v || v.t !== 'Function') {
        die('<code>' + what + '</code> wants a function, such as <code>x =&gt; x * 2</code> or ' +
          '<code>_ * 2</code>.');
      }
      return v;
    }

    function method(recv, name, args, node) {
      /* ----- List ----- */
      if (recv.t === 'List') {
        var xs = recv.v;
        switch (name) {
          case 'map': {
            var f = asFn(args[0], 'map');
            var out = xs.map(function (x) { return callFunction(f, [x]); });
            return scList(out, scElemType(out));
          }
          case 'flatMap': {
            var ff = asFn(args[0], 'flatMap');
            var acc = [];
            xs.forEach(function (x) {
              var r = callFunction(ff, [x]);
              if (r.t === 'List') acc = acc.concat(r.v);
              else if (r.t === 'Option') { if (r.some) acc.push(r.v); }
              else die('<code>flatMap</code> wants a function returning a list or an Option.');
            });
            return scList(acc, scElemType(acc));
          }
          case 'flatten': {
            var fa = [];
            xs.forEach(function (x) {
              if (x.t === 'List') fa = fa.concat(x.v);
              else if (x.t === 'Option') { if (x.some) fa.push(x.v); }
              else die('<code>flatten</code> needs a list of lists or of Options.');
            });
            return scList(fa, scElemType(fa));
          }
          case 'filter': case 'filterNot': {
            var p = asFn(args[0], name);
            var keep = xs.filter(function (x) {
              var r = truth(callFunction(p, [x]));
              return name === 'filter' ? r : !r;
            });
            return scList(keep, recv.el);
          }
          case 'find': {
            var pf = asFn(args[0], 'find');
            for (var i = 0; i < xs.length; i++) {
              if (truth(callFunction(pf, [xs[i]]))) return scSome(xs[i]);
            }
            return scNone();
          }
          case 'count': {
            var pc = asFn(args[0], 'count');
            return scInt(xs.filter(function (x) { return truth(callFunction(pc, [x])); }).length);
          }
          case 'exists': case 'forall': {
            var pe = asFn(args[0], name);
            var res = name === 'exists'
              ? xs.some(function (x) { return truth(callFunction(pe, [x])); })
              : xs.every(function (x) { return truth(callFunction(pe, [x])); });
            return scBool(res);
          }
          case 'foldLeft': {
            /* xs.foldLeft(z)(f) — the second argument list. */
            die('<code>foldLeft</code> takes two argument lists, which this subset does not parse. ' +
              'Use a for-comprehension or <code>sum</code>.');
            break;
          }
          case 'sum': {
            if (!xs.length) return recv.el === 'Double' ? scDbl(0) : scInt(0);
            return xs.reduce(function (a, x) { return binop('+', a, x); },
              recv.el === 'Double' ? scDbl(0) : recv.el === 'BigInt' ? scBig(0n) : scInt(0));
          }
          case 'product':
            if (!xs.length) return scInt(1);
            return xs.reduce(function (a, x) { return binop('*', a, x); }, scInt(1));
          case 'length': case 'size': return scInt(xs.length);
          case 'isEmpty': return scBool(!xs.length);
          case 'nonEmpty': return scBool(!!xs.length);
          case 'head':
            if (!xs.length) die('<code>head</code> of an empty list throws a ' +
              '<code>NoSuchElementException</code>.', true);
            return xs[0];
          case 'headOption': return xs.length ? scSome(xs[0]) : scNone();
          case 'last':
            if (!xs.length) die('<code>last</code> of an empty list throws.', true);
            return xs[xs.length - 1];
          case 'tail':
            if (!xs.length) die('<code>tail</code> of an empty list throws an ' +
              '<code>UnsupportedOperationException</code>.', true);
            return scList(xs.slice(1), recv.el);
          case 'reverse': return scList(xs.slice().reverse(), recv.el);
          case 'sorted': {
            var sorted = xs.slice().sort(function (a, b) {
              if (a.t === 'String') return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
              return Number(a.v) - Number(b.v);
            });
            return scList(sorted, recv.el);
          }
          case 'distinct': {
            var seen = {}, out2 = [];
            xs.forEach(function (x) {
              var k = scShow(x);
              if (!seen[k]) { seen[k] = true; out2.push(x); }
            });
            return scList(out2, recv.el);
          }
          case 'take': return scList(xs.slice(0, Math.max(0, args[0].v)), recv.el);
          case 'drop': return scList(xs.slice(Math.max(0, args[0].v)), recv.el);
          case 'contains':
            return scBool(xs.some(function (x) { return scEq(x, args[0]); }));
          case 'mkString': {
            var sep = args.length ? String(args[0].v) : '';
            return scStr(xs.map(function (x) {
              return x.t === 'String' ? x.v : scShow(x);
            }).join(sep));
          }
          case 'min': case 'max': {
            if (!xs.length) die('<code>' + name + '</code> of an empty list throws.', true);
            var best = xs[0];
            xs.forEach(function (x) {
              var better = name === 'min' ? Number(x.v) < Number(best.v) : Number(x.v) > Number(best.v);
              if (better) best = x;
            });
            return best;
          }
          case 'toSet': {
            var seen2 = {}, out3 = [];
            xs.forEach(function (x) {
              var k = scShow(x);
              if (!seen2[k]) { seen2[k] = true; out3.push(x); }
            });
            var sl = scList(out3, recv.el); sl.isSet = true; return sl;
          }
          case 'toList': return scList(xs.slice(), recv.el);
          case 'toMap': {
            var pairs = [];
            xs.forEach(function (x) {
              if (x.t !== 'Tuple' || x.v.length !== 2) {
                die('<code>toMap</code> needs a collection of pairs.');
              }
              var found = false;
              pairs.forEach(function (p2) { if (scEq(p2[0], x.v[0])) { p2[1] = x.v[1]; found = true; } });
              if (!found) pairs.push([x.v[0], x.v[1]]);
            });
            return scMap(pairs);
          }
        }
      }

      /* ----- Option ----- */
      if (recv.t === 'Option') {
        switch (name) {
          case 'isDefined': case 'nonEmpty': return scBool(recv.some);
          case 'isEmpty': return scBool(!recv.some);
          case 'get':
            if (!recv.some) die('<code>None.get</code> throws a ' +
              '<code>NoSuchElementException</code>. That is what <code>getOrElse</code>, ' +
              'pattern matching and <code>map</code> are for.', true);
            return recv.v;
          case 'getOrElse': return recv.some ? recv.v : args[0];
          case 'map': {
            var fo = asFn(args[0], 'map');
            return recv.some ? scSome(callFunction(fo, [recv.v])) : scNone();
          }
          case 'filter': {
            var pfo = asFn(args[0], 'filter');
            if (!recv.some) return scNone();
            return truth(callFunction(pfo, [recv.v])) ? recv : scNone();
          }
          case 'toList': return recv.some ? scList([recv.v]) : scList([], 'Nothing');
          case 'contains': return scBool(recv.some && scEq(recv.v, args[0]));
        }
      }

      /* ----- Map ----- */
      if (recv.t === 'Map') {
        switch (name) {
          case 'get': {
            for (var j = 0; j < recv.v.length; j++) {
              if (scEq(recv.v[j][0], args[0])) return scSome(recv.v[j][1]);
            }
            return scNone();
          }
          case 'getOrElse': {
            for (var j2 = 0; j2 < recv.v.length; j2++) {
              if (scEq(recv.v[j2][0], args[0])) return recv.v[j2][1];
            }
            return args[1];
          }
          case 'apply': {
            for (var j3 = 0; j3 < recv.v.length; j3++) {
              if (scEq(recv.v[j3][0], args[0])) return recv.v[j3][1];
            }
            die('No key <code>' + scShow(args[0]) + '</code> in the map. <code>m(k)</code> throws ' +
              'when the key is missing; <code>m.get(k)</code> gives you an Option instead.', true);
            break;
          }
          case 'contains':
            return scBool(recv.v.some(function (p3) { return scEq(p3[0], args[0]); }));
          case 'size': case 'length': return scInt(recv.v.length);
          case 'isEmpty': return scBool(!recv.v.length);
          case 'keys': case 'keySet':
            return scList(recv.v.map(function (p4) { return p4[0]; }));
          case 'values':
            return scList(recv.v.map(function (p5) { return p5[1]; }));
          case 'toList':
            return scList(recv.v.map(function (p6) { return scTuple([p6[0], p6[1]]); }));
        }
      }

      /* ----- String ----- */
      if (recv.t === 'String') {
        switch (name) {
          case 'length': case 'size': return scInt(recv.v.length);
          case 'toUpperCase': return scStr(recv.v.toUpperCase());
          case 'toLowerCase': return scStr(recv.v.toLowerCase());
          case 'reverse': return scStr(recv.v.split('').reverse().join(''));
          case 'toList': return scList(recv.v.split('').map(scChar), 'Char');
          case 'isEmpty': return scBool(!recv.v.length);
          case 'nonEmpty': return scBool(!!recv.v.length);
          case 'take': return scStr(recv.v.slice(0, args[0].v));
          case 'drop': return scStr(recv.v.slice(args[0].v));
          case 'contains': return scBool(recv.v.indexOf(String(args[0].v)) >= 0);
          case 'toInt': {
            /* Integer.parseInt, including when it throws — checked against
               a real JVM by the test suite. */
            if (!/^-?[0-9]+$/.test(recv.v)) {
              die('<code>"' + esc(recv.v) + '".toInt</code> throws a ' +
                '<code>NumberFormatException</code>. No trimming, no partial parse — this is ' +
                '<code>Integer.parseInt</code>, and it is why <code>toIntOption</code> exists.',
                true);
            }
            var parsed = Number(recv.v);
            if (parsed > 2147483647 || parsed < -2147483648) {
              die('<code>"' + esc(recv.v) + '".toInt</code> throws a ' +
                '<code>NumberFormatException</code>: it does not fit in an Int.', true);
            }
            return scInt(parsed);
          }
          case 'toIntOption': {
            if (!/^-?[0-9]+$/.test(recv.v)) return scNone();
            var p2 = Number(recv.v);
            if (p2 > 2147483647 || p2 < -2147483648) return scNone();
            return scSome(scInt(p2));
          }
        }
      }

      /* ----- scalars ----- */
      if (recv.t === 'Char') {
        if (name === 'toInt') return scInt(recv.v.charCodeAt(0));
        if (name === 'toString') return scStr(recv.v);
        if (name === 'isDigit') return scBool(/[0-9]/.test(recv.v));
        if (name === 'isLetter') return scBool(/[a-zA-Z]/.test(recv.v));
        if (name === 'toUpper') return scChar(recv.v.toUpperCase());
      }
      if (recv.t === 'Int') {
        if (name === 'toDouble') return scDbl(recv.v);
        if (name === 'toString') return scStr(String(recv.v));
        if (name === 'toChar') return scChar(String.fromCharCode(recv.v));
        if (name === 'abs') return scInt(Math.abs(recv.v) | 0);
        if (name === 'max') return scInt(Math.max(recv.v, args[0].v) | 0);
        if (name === 'min') return scInt(Math.min(recv.v, args[0].v) | 0);
        if (name === 'to' || name === 'until') {
          var end = args[0].v | 0;
          var items2 = [];
          for (var q = recv.v; name === 'to' ? q <= end : q < end; q++) items2.push(scInt(q));
          return scList(items2, 'Int');
        }
      }
      if (recv.t === 'Double') {
        if (name === 'toInt') return scInt(Math.trunc(recv.v) | 0);
        if (name === 'toString') return scStr(scShow(recv));
      }
      if (recv.t === 'Char' && (name === 'to' || name === 'until')) {
        var e2 = String(args[0].v).charCodeAt(0);
        var s2 = recv.v.charCodeAt(0);
        var cs = [];
        for (var q2 = s2; name === 'to' ? q2 <= e2 : q2 < e2; q2++) cs.push(scChar(String.fromCharCode(q2)));
        return scList(cs, 'Char');
      }
      if (recv.t === 'Tuple' && /^_[0-9]+$/.test(name)) {
        var idx = Number(name.slice(1)) - 1;
        if (idx < 0 || idx >= recv.v.length) die('This tuple has no <code>' + esc(name) + '</code>.');
        return recv.v[idx];
      }
      if (recv.t === 'Function' && name === 'apply') return callFunction(recv, args);

      die('A ' + scTypeName(recv) + ' has no <code>' + esc(name) + '</code> in this subset.');
    }

    /* ---- the walk ---- */

    function ev(node, env) {
      switch (node.k) {
        case 'lit': return node.v;
        case 'placeholder':
          die('A bare <code>_</code> only means "the argument" inside a call such as ' +
            '<code>xs.map(_ * 2)</code>.');
          break;
        case 'name': {
          var v = lookup(env, node.n);
          if (v === undefined) die('<code>' + esc(node.n) + '</code> is not defined here.');
          return v;
        }
        case 'lambda':
          return scFn(node.params, node.body, env, node.text);
        case 'un': {
          var e1 = ev(node.e, env);
          if (node.op === '-') return binop('-', e1.t === 'Double' ? scDbl(0) : scInt(0), e1);
          return scBool(!truth(e1));
        }
        case 'bin': {
          /* && and || short-circuit, which matters when the right side throws. */
          if (node.op === '&&') {
            var la = ev(node.l, env);
            return truth(la) ? scBool(truth(ev(node.r, env))) : scBool(false);
          }
          if (node.op === '||') {
            var lb = ev(node.l, env);
            return truth(lb) ? scBool(true) : scBool(truth(ev(node.r, env)));
          }
          return binop(node.op, ev(node.l, env), ev(node.r, env));
        }
        case 'tuple': return scTuple(node.items.map(function (i) { return ev(i, env); }));
        case 'some': return scSome(ev(node.e, env));
        case 'ctor': {
          var args = node.args.map(function (a) { return ev(a, env); });
          if (node.name === 'BigInt') {
            if (args.length !== 1 || (args[0].t !== 'Int' && args[0].t !== 'String')) {
              die('<code>BigInt(…)</code> takes one Int or String.');
            }
            return scBig(BigInt(args[0].v));
          }
          if (node.name === 'Map') {
            var pairs = args.map(function (a) {
              if (a.t !== 'Tuple' || a.v.length !== 2) {
                die('A Map is built from pairs: <code>Map("a" -&gt; 1, "b" -&gt; 2)</code>.');
              }
              return [a.v[0], a.v[1]];
            });
            var uniq = [];
            pairs.forEach(function (p) {
              var hit = false;
              uniq.forEach(function (u) { if (scEq(u[0], p[0])) { u[1] = p[1]; hit = true; } });
              if (!hit) uniq.push(p);
            });
            return scMap(uniq);
          }
          if (node.name === 'Set') {
            var seen = {}, out = [];
            args.forEach(function (a) {
              var k = scShow(a);
              if (!seen[k]) { seen[k] = true; out.push(a); }
            });
            var s = scList(out, scElemType(out)); s.isSet = true; return s;
          }
          var el = scElemType(args);
          if (el === null) {
            die('This subset does not mix types in a list. Scala would give you a list of the ' +
              'nearest common supertype, which is rarely what you meant.');
          }
          if (el === 'Double') args = args.map(function (a) { return a.t === 'Int' ? scDbl(a.v) : a; });
          if (el === 'BigInt') args = args.map(function (a) { return a.t === 'Int' ? scBig(BigInt(a.v)) : a; });
          return scList(args, el);
        }
        case 'call': {
          var recv = ev(node.target, env);
          var as = node.args.map(function (a) { return ev(a, env); });
          return method(recv, node.name, as, node);
        }
        case 'apply': {
          var fn = ev(node.fn, env);
          var aa = node.args.map(function (a) { return ev(a, env); });
          if (fn.t === 'Map') return method(fn, 'apply', aa, node);
          return callFunction(fn, aa);
        }
        case 'if': {
          if (truth(ev(node.c, env))) return ev(node.t, env);
          return node.e ? ev(node.e, env) : scUnit();
        }
        case 'block': {
          var scope = child(env, {});
          node.vals.forEach(function (b) { scope.vars[b.name] = ev(b.e, scope); });
          return ev(node.result, scope);
        }
        case 'match': {
          var sv = ev(node.scrut, env);
          for (var i = 0; i < node.cases.length; i++) {
            var binds = {};
            if (scMatchPat(node.cases[i].pat, sv, binds)) {
              var scope2 = child(env, binds);
              if (node.cases[i].guard && !truth(ev(node.cases[i].guard, scope2))) continue;
              steps.push({ kind: 'match', index: i, binds: binds });
              return ev(node.cases[i].body, scope2);
            }
          }
          die('No case matched <code>' + esc(scShow(sv)) + '</code>. In Scala that is a ' +
            '<code>MatchError</code> at run time — which is why a final <code>case _</code> ' +
            'is worth having.', true);
          break;
        }
        case 'for': {
          /* Desugars to nested flatMap with a final map, which is exactly
             what Scala does. Built here by direct iteration, and the test
             suite checks the two give the same answer. */
          var out2 = [];
          (function loop(gi, e) {
            if (gi >= node.gens.length) { out2.push(ev(node.yield, e)); return; }
            var g = node.gens[gi];
            var srcV = ev(g.src, e);
            var items = srcV.t === 'List' ? srcV.v
              : srcV.t === 'Option' ? (srcV.some ? [srcV.v] : [])
              : srcV.t === 'Map' ? srcV.v.map(function (p) { return scTuple([p[0], p[1]]); })
              : null;
            if (items === null) die('A for-comprehension needs something to iterate over.');
            items.forEach(function (it) {
              var vars = {}; vars[g.name] = it;
              var inner = child(e, vars);
              if (g.guard && !truth(ev(g.guard, inner))) return;
              loop(gi + 1, inner);
            });
          })(0, env);
          return scList(out2, scElemType(out2));
        }
      }
      die('I do not know how to evaluate that.');
    }

    return { value: ev(ast, env), steps: steps };
  }

  /**
     Evaluate a Scala expression.
     -> { ok, value, show, type }  or  { ok: false, error, runtime }
  */
  function scEval(src, env) {
    var parsed = scParse(src);
    if (!parsed.ok) return parsed;
    var rootEnv = { vars: {}, parent: null };
    Object.keys(env || {}).forEach(function (k) { rootEnv.vars[k] = env[k]; });
    try {
      var r = scRun(parsed.ast, rootEnv);
      return { ok: true, value: r.value, show: scShow(r.value), type: scTypeName(r.value),
               steps: r.steps, ast: parsed.ast };
    } catch (e) {
      if (e && e.msg) return { ok: false, error: e.msg, runtime: !!e.runtime };
      if (e instanceof RangeError) {
        return { ok: false, error: 'That recursed too deeply to finish.', runtime: true };
      }
      throw e;
    }
  }

  /** Is this expression pure Int/Double arithmetic, so a JVM can check it? */
  function scJavaSafe(src) { return /^[\s0-9+\-*/%().]+$/.test(src); }

  var SC_EXPRS = {
    intDiv: { label: 'integer division', src: '(1 + 2) / 2',
      note: 'Both sides are Ints, so this is Int division: the fractional part is thrown away, ' +
        'not rounded. 1.5 becomes 1.' },
    intDivNeg: { label: 'and it truncates towards zero', src: '-7 / 2',
      note: 'Not −4. Int division truncates towards zero, so −3.5 becomes −3. The remainder ' +
        'takes the sign of the left operand: <code>-7 % 2</code> is −1.' },
    overflow: { label: 'Int overflow', src: '2147483647 + 1',
      note: 'An Int is 32 bits. One past the largest is the smallest — it wraps silently, with no ' +
        'error and no warning.' },
    factorial: { label: 'why BigInt exists', src: '13 * 12 * 11 * 10 * 9 * 8 * 7 * 6 * 5 * 4 * 3 * 2',
      note: '13! is 6 227 020 800, which does not fit in 32 bits. What you get instead is the ' +
        'bottom 32 bits of the right answer.' },
    bigint: { label: 'the same in BigInt', src: 'BigInt(13) * 12 * 11 * 10 * 9 * 8 * 7 * 6 * 5 * 4 * 3 * 2',
      note: 'One BigInt anywhere in the expression and the whole thing is computed exactly. ' +
        'It is slower and it allocates, which is why it is not the default.' },
    doubleDiv: { label: 'Double division', src: '1.0 / 0',
      note: 'Doubles follow IEEE 754: dividing by zero gives Infinity rather than throwing. ' +
        '<code>1 / 0</code> on Ints throws instead.' },
    cons: { label: 'building a list', src: '0 :: List(1, 2, 3, 5)',
      note: 'A new list whose head is 0 and whose tail is the old list — which is untouched.' },
    consChain: { label: 'cons is right-associative', src: '1 :: 2 :: 3 :: Nil',
      note: 'Read right to left: Nil, then 3 on the front, then 2, then 1. Any operator ending ' +
        'in a colon associates to the right, which is exactly what makes this read well.' },
    average: { label: 'the average function, on two elements', src: 'List(1, 2).sum / List(1, 2).length',
      note: 'The body of <code>average</code>, inlined. Int division again: 3 / 2 is 1.' },
    charInt: { label: 'a Char is a number', src: "'a'.toInt",
      note: 'Char is a 16-bit unsigned integer type. This is the same 97 you would get in Java or C.' },
    strings: { label: 'strings and +', src: '"total: " + (2 + 3)',
      note: 'The right-hand side is computed first — it is an Int expression — and then converted. ' +
        'Note the brackets: without them, <code>"total: " + 2 + 3</code> gives "total: 23".' },
    tuple: { label: 'a pair', src: '(1 + 1, "two")',
      note: 'A tuple of two things with different types. Read them out with <code>_1</code> ' +
        'and <code>_2</code>.' }
  };

  /**
     Run a match expression and report what happened to every case:
     which were tried, which matched, what each one bound.
  */
  function scMatchTrace(src, env) {
    var parsed = scParse(src);
    if (!parsed.ok) return parsed;
    var ast = parsed.ast;
    if (ast.k !== 'match') {
      return { ok: false, error: 'That is not a <code>match</code> expression.' };
    }
    var scrut = scEval(scSrcOf(ast.scrut), env);
    /* Evaluating the scrutinee needs the same environment, so it goes
       through scEval on a re-rendered source rather than reaching into
       the tree — which keeps one evaluator rather than two. */
    if (!scrut.ok) return scrut;

    var rows = [], winner = -1;
    for (var i = 0; i < ast.cases.length; i++) {
      var binds = {};
      var hit = scMatchPat(ast.cases[i].pat, scrut.value, binds);
      var guardResult = null;
      if (hit && ast.cases[i].guard) {
        var genv = {};
        Object.keys(env || {}).forEach(function (k) { genv[k] = env[k]; });
        Object.keys(binds).forEach(function (k) { genv[k] = binds[k]; });
        var g = scEval(scSrcOf(ast.cases[i].guard), genv);
        guardResult = g.ok && g.value.t === 'Boolean' ? g.value.v : false;
        if (!guardResult) hit = false;
      }
      rows.push({
        pattern: scPatText(ast.cases[i].pat),
        matched: hit,
        reached: winner < 0,
        binds: Object.keys(binds).map(function (k) {
          return { name: k, value: scShow(binds[k]) };
        }),
        guard: ast.cases[i].guard ? scSrcOf(ast.cases[i].guard) : null,
        guardResult: guardResult
      });
      if (hit && winner < 0) winner = i;
    }

    var result = scEval(src, env);
    return {
      ok: true, scrutinee: scShow(scrut.value), scrutType: scTypeName(scrut.value),
      rows: rows, winner: winner,
      result: result.ok ? result.show : null,
      error: result.ok ? null : result.error,
      exhaustive: winner >= 0
    };
  }

  /** Render a parsed node back to source, for the tracer's labels. */
  function scSrcOf(node) {
    switch (node.k) {
      case 'lit': return scShow(node.v);
      case 'name': return node.n;
      case 'placeholder': return '_';
      case 'un': return node.op + scSrcOf(node.e);
      case 'bin': return '(' + scSrcOf(node.l) + ' ' + node.op + ' ' + scSrcOf(node.r) + ')';
      case 'tuple': return '(' + node.items.map(scSrcOf).join(', ') + ')';
      case 'some': return 'Some(' + scSrcOf(node.e) + ')';
      case 'ctor': return node.name + '(' + node.args.map(scSrcOf).join(', ') + ')';
      case 'call': return scSrcOf(node.target) + '.' + node.name +
        (node.args.length ? '(' + node.args.map(scSrcOf).join(', ') + ')' : '');
      case 'apply': return scSrcOf(node.fn) + '(' + node.args.map(scSrcOf).join(', ') + ')';
      case 'lambda': return node.params.join(', ') + ' => ' + scSrcOf(node.body);
      case 'if': return 'if (' + scSrcOf(node.c) + ') ' + scSrcOf(node.t) +
        (node.e ? ' else ' + scSrcOf(node.e) : '');
      case 'for': return 'for (' + node.gens.map(function (g) {
        return g.name + ' <- ' + scSrcOf(g.src) + (g.guard ? ' if ' + scSrcOf(g.guard) : '');
      }).join('; ') + ') yield ' + scSrcOf(node.yield);
      case 'block': return '{ ' + node.vals.map(function (v) {
        return 'val ' + v.name + ' = ' + scSrcOf(v.e);
      }).join('; ') + ' ' + scSrcOf(node.result) + ' }';
      case 'match': return scSrcOf(node.scrut) + ' match { … }';
    }
    return '?';
  }
