  /* ============================================================
     SCALA TOPIC 01 · a small evaluator for the expression subset

     Enough Scala to answer the questions this topic asks: what does
     this evaluate to, what is its type, and what happens to the old
     list when you build a new one.

     The arithmetic is the part most likely to be wrong in a hand
     model, so it is the part that is checked hardest: every numeric
     expression the tool can produce is emitted as Java and run on a
     real JVM by the test suite. Scala's Int is the JVM's int —
     32 bits, wrapping on overflow, division truncating towards
     zero — so agreeing with Java is agreeing with Scala.

     BigInt is arbitrary precision and is modelled with BigInt.
     ============================================================ */

  /* ---------- values ---------- */

  /*
     A value is { t: type, v: payload }, where t is one of
     'Int' | 'BigInt' | 'Double' | 'Boolean' | 'String' | 'Char' |
     'List' | 'Tuple' | 'Unit', and List/Tuple carry `el` (the
     element type) and an array of values.
  */
  function scInt(n) { return { t: 'Int', v: n | 0 }; }
  function scBig(n) { return { t: 'BigInt', v: n }; }
  function scDbl(n) { return { t: 'Double', v: n }; }
  function scBool(b) { return { t: 'Boolean', v: !!b }; }
  function scStr(s) { return { t: 'String', v: s }; }
  function scChar(c) { return { t: 'Char', v: c }; }
  function scList(items, el) { return { t: 'List', el: el || scElemType(items), v: items }; }
  function scTuple(items) { return { t: 'Tuple', v: items }; }

  /** The element type of a list literal, as far as this subset goes. */
  function scElemType(items) {
    if (!items.length) return 'Nothing';
    var kinds = {};
    items.forEach(function (i) { kinds[scTypeName(i)] = true; });
    var ks = Object.keys(kinds);
    if (ks.length === 1) return ks[0];
    /* The one widening this subset allows, because it is the one
       that comes up: an Int among Doubles is widened. Anything else
       mixed is refused rather than guessed at. */
    if (ks.length === 2 && kinds.Int && kinds.Double) return 'Double';
    if (ks.length === 2 && kinds.Int && kinds.BigInt) return 'BigInt';
    return null;
  }

  function scTypeName(val) {
    if (!val) return '?';
    if (val.t === 'List') {
      return 'List[' + (val.el === null ? '…' : val.el) + ']';
    }
    if (val.t === 'Tuple') {
      return '(' + val.v.map(scTypeName).join(', ') + ')';
    }
    return val.t;
  }

  /** How Scala's REPL would print the value. */
  function scShow(val) {
    if (!val) return '?';
    switch (val.t) {
      case 'Int': return String(val.v);
      case 'BigInt': return val.v.toString();
      case 'Double': {
        if (!isFinite(val.v)) return val.v > 0 ? 'Infinity' : (val.v < 0 ? '-Infinity' : 'NaN');
        if (Number.isNaN(val.v)) return 'NaN';
        /* Scala prints a Double with a trailing .0 when it is whole. */
        return Number.isInteger(val.v) ? val.v.toFixed(1) : String(val.v);
      }
      case 'Boolean': return val.v ? 'true' : 'false';
      case 'String': return '"' + val.v + '"';
      case 'Char': return "'" + val.v + "'";
      case 'List': return 'List(' + val.v.map(scShow).join(', ') + ')';
      case 'Tuple': return '(' + val.v.map(scShow).join(', ') + ')';
      case 'Unit': return '()';
    }
    return '?';
  }

  /* ---------- tokens ---------- */

  function scLex(src) {
    var toks = [], i = 0;
    var WORD = /[A-Za-z_][A-Za-z_0-9]*/y;
    while (i < src.length) {
      var c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '"') {
        var j = i + 1, s = '';
        while (j < src.length && src[j] !== '"') { s += src[j]; j++; }
        if (j >= src.length) return { ok: false, error: 'Unterminated string literal.' };
        toks.push({ k: 'str', v: s }); i = j + 1; continue;
      }
      if (c === "'") {
        if (src[i + 2] !== "'") return { ok: false, error: 'A Char literal holds exactly one character.' };
        toks.push({ k: 'char', v: src[i + 1] }); i += 3; continue;
      }
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
      WORD.lastIndex = i;
      var m = WORD.exec(src);
      if (m) { toks.push({ k: 'word', v: m[0] }); i = WORD.lastIndex; continue; }
      var three = src.substr(i, 3), two = src.substr(i, 2);
      if (three === ':::') { toks.push({ k: 'op', v: ':::' }); i += 3; continue; }
      if (['::', '==', '!=', '<=', '>=', '&&', '||'].indexOf(two) >= 0) {
        toks.push({ k: 'op', v: two }); i += 2; continue;
      }
      if ('+-*/%<>!(),.'.indexOf(c) >= 0) { toks.push({ k: 'op', v: c }); i++; continue; }
      return { ok: false, error: 'I do not know what to do with <code>' + esc(c) + '</code>.' };
    }
    return { ok: true, toks: toks };
  }

  /* ---------- parsing and evaluating ---------- */

  /*
     Precedence, low to high. Scala decides an operator's precedence
     from its first character, which is why `::` binds tighter than
     `==` and why `+` and `-` sit together.
  */
  var SC_PREC = {
    '||': 1, '&&': 2,
    '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4,
    '::': 5, ':::': 5,
    '+': 6, '-': 6,
    '*': 7, '/': 7, '%': 7
  };
  /* `::` is right-associative — that is what makes 1 :: 2 :: Nil work.
     In Scala any operator ending in a colon is. */
  function scRightAssoc(op) { return op.charAt(op.length - 1) === ':'; }

  function scEval(src, env) {
    var lexed = scLex(src);
    if (!lexed.ok) return lexed;
    var toks = lexed.toks, pos = 0;
    var scope = {};
    Object.keys(env || {}).forEach(function (k) { scope[k] = env[k]; });

    function peek() { return toks[pos]; }
    function next() { return toks[pos++]; }
    function isOp(v) { var t = peek(); return t && t.k === 'op' && t.v === v; }
    function eat(v) {
      if (!isOp(v)) throw { msg: 'Expected <code>' + esc(v) + '</code>.' };
      pos++;
    }

    function parseExpr(minPrec) {
      var left = parseUnary();
      for (;;) {
        var t = peek();
        if (!t || t.k !== 'op' || !(t.v in SC_PREC)) break;
        var prec = SC_PREC[t.v];
        if (prec < minPrec) break;
        next();
        var right = parseExpr(scRightAssoc(t.v) ? prec : prec + 1);
        left = applyBinary(t.v, left, right);
      }
      return left;
    }

    function parseUnary() {
      if (isOp('-')) { next(); return applyBinary('-', scInt(0), parseUnary()); }
      if (isOp('!')) {
        next();
        var v = parseUnary();
        if (v.t !== 'Boolean') throw { msg: '<code>!</code> wants a Boolean, not a ' + v.t + '.' };
        return scBool(!v.v);
      }
      return parsePostfix();
    }

    function parsePostfix() {
      var v = parsePrimary();
      while (isOp('.')) {
        next();
        var name = next();
        if (!name || name.k !== 'word') throw { msg: 'Expected a method name after <code>.</code>' };
        var args = [];
        if (isOp('(')) {
          next();
          if (!isOp(')')) {
            args.push(parseExpr(1));
            while (isOp(',')) { next(); args.push(parseExpr(1)); }
          }
          eat(')');
        }
        v = applyMethod(v, name.v, args);
      }
      return v;
    }

    function parsePrimary() {
      var t = next();
      if (!t) throw { msg: 'The expression stops early.' };
      if (t.k === 'int') {
        var n = Number(t.v);
        if (!Number.isSafeInteger(n)) throw { msg: 'That literal is too big for an Int.' };
        /* An Int literal that does not fit in 32 bits is a compile
           error in Scala, not a silent wrap. */
        if (n > 2147483647) {
          throw { msg: '<code>' + esc(t.v) + '</code> does not fit in an <code>Int</code>. ' +
            'Scala rejects the literal outright — the wrapping only happens to results of ' +
            'arithmetic, never to something you wrote down.' };
        }
        return scInt(n);
      }
      if (t.k === 'dbl') return scDbl(t.v);
      if (t.k === 'str') return scStr(t.v);
      if (t.k === 'char') return scChar(t.v);
      if (t.k === 'word') {
        if (t.v === 'true') return scBool(true);
        if (t.v === 'false') return scBool(false);
        if (t.v === 'Nil') return scList([], 'Nothing');
        if (t.v === 'List' || t.v === 'BigInt' || t.v === 'Set') {
          var items = [];
          eat('(');
          if (!isOp(')')) {
            items.push(parseExpr(1));
            while (isOp(',')) { next(); items.push(parseExpr(1)); }
          }
          eat(')');
          if (t.v === 'BigInt') {
            if (items.length !== 1 || (items[0].t !== 'Int' && items[0].t !== 'String')) {
              throw { msg: '<code>BigInt(…)</code> takes one Int or String.' };
            }
            return scBig(BigInt(items[0].t === 'Int' ? items[0].v : items[0].v));
          }
          if (t.v === 'Set') {
            var seen = [], out = [];
            items.forEach(function (it) {
              var k = scShow(it);
              if (seen.indexOf(k) < 0) { seen.push(k); out.push(it); }
            });
            var sl = scList(out, scElemType(out));
            sl.isSet = true;
            return sl;
          }
          var el = scElemType(items);
          if (el === null) {
            throw { msg: 'This subset does not mix types in a list. Scala would give you ' +
              'a list of the nearest common supertype, which is rarely what you meant.' };
          }
          /* Widening: an Int among Doubles becomes a Double. */
          if (el === 'Double') items = items.map(function (i) {
            return i.t === 'Int' ? scDbl(i.v) : i;
          });
          if (el === 'BigInt') items = items.map(function (i) {
            return i.t === 'Int' ? scBig(BigInt(i.v)) : i;
          });
          return scList(items, el);
        }
        if (scope[t.v] !== undefined) return scope[t.v];
        throw { msg: '<code>' + esc(t.v) + '</code> is not defined here.' };
      }
      if (t.k === 'op' && t.v === '(') {
        var first = parseExpr(1);
        if (isOp(',')) {
          var parts = [first];
          while (isOp(',')) { next(); parts.push(parseExpr(1)); }
          eat(')');
          return scTuple(parts);
        }
        eat(')');
        return first;
      }
      throw { msg: 'Unexpected <code>' + esc(String(t.v)) + '</code>.' };
    }

    /* ---- operators ---- */

    function numericPair(a, b) {
      if (a.t === 'Double' || b.t === 'Double') return 'Double';
      if (a.t === 'BigInt' || b.t === 'BigInt') return 'BigInt';
      if (a.t === 'Int' && b.t === 'Int') return 'Int';
      return null;
    }

    function applyBinary(op, a, b) {
      if (op === '::') {
        if (b.t !== 'List') throw { msg: '<code>::</code> puts an element on the front of a ' +
          '<em>list</em>. The right-hand side here is a ' + scTypeName(b) + '.' };
        var items = [a].concat(b.v);
        var el = scElemType(items);
        if (el === null) throw { msg: 'That would make a list of mixed types.' };
        return scList(items, el);
      }
      if (op === ':::') {
        if (a.t !== 'List' || b.t !== 'List') {
          throw { msg: '<code>:::</code> joins two lists.' };
        }
        var all = a.v.concat(b.v);
        return scList(all, scElemType(all));
      }
      if (op === '&&' || op === '||') {
        if (a.t !== 'Boolean' || b.t !== 'Boolean') {
          throw { msg: '<code>' + esc(op) + '</code> wants two Booleans.' };
        }
        return scBool(op === '&&' ? (a.v && b.v) : (a.v || b.v));
      }
      if (op === '==' || op === '!=') {
        var same = scShow(a) === scShow(b) && scTypeName(a) === scTypeName(b);
        /* Scala's == compares values, not references —
           List(1,2) == List(1,2) is true, unlike Java's ==. */
        if ((a.t === 'Int' || a.t === 'Double' || a.t === 'BigInt') &&
            (b.t === 'Int' || b.t === 'Double' || b.t === 'BigInt')) {
          same = Number(a.v) === Number(b.v);
        }
        return scBool(op === '==' ? same : !same);
      }
      if (op === '+' && (a.t === 'String' || b.t === 'String')) {
        return scStr((a.t === 'String' ? a.v : scShow(a).replace(/^"|"$/g, '')) +
                     (b.t === 'String' ? b.v : scShow(b).replace(/^"|"$/g, '')));
      }
      if ('<><=>='.indexOf(op) >= 0 && ['<', '>', '<=', '>='].indexOf(op) >= 0) {
        var kindC = numericPair(a, b);
        if (!kindC) throw { msg: 'Cannot compare a ' + scTypeName(a) + ' with a ' + scTypeName(b) + '.' };
        var x = Number(a.v), y = Number(b.v);
        return scBool(op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y);
      }

      var kind = numericPair(a, b);
      if (!kind) {
        throw { msg: '<code>' + esc(op) + '</code> is not defined for a ' + scTypeName(a) +
          ' and a ' + scTypeName(b) + '.' };
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
          throw { msg: 'Division by zero. On a BigInt this throws an ' +
            '<code>ArithmeticException</code>, exactly as it does on an Int.', runtime: true };
        }
        if (op === '+') return scBig(A + B);
        if (op === '-') return scBig(A - B);
        if (op === '*') return scBig(A * B);
        if (op === '/') return scBig(A / B);
        if (op === '%') return scBig(A % B);
      }
      /* Int: 32-bit, wrapping, division truncating towards zero. */
      var i1 = a.v | 0, i2 = b.v | 0;
      if ((op === '/' || op === '%') && i2 === 0) {
        throw { msg: 'Division by zero. <code>Int</code> division by zero throws an ' +
          '<code>ArithmeticException</code> — it does not give Infinity the way Double does.',
          runtime: true };
      }
      if (op === '+') return scInt((i1 + i2) | 0);
      if (op === '-') return scInt((i1 - i2) | 0);
      if (op === '*') return scInt(Math.imul(i1, i2));
      if (op === '/') return scInt((i1 / i2) | 0);      // truncates towards zero
      if (op === '%') return scInt(i1 % i2);
      throw { msg: 'Unknown operator <code>' + esc(op) + '</code>.' };
    }

    /* ---- methods ---- */

    function applyMethod(v, name, args) {
      if (v.t === 'List') {
        switch (name) {
          case 'sum': {
            if (!v.v.length) return v.el === 'Double' ? scDbl(0) : scInt(0);
            return v.v.reduce(function (acc, x) { return applyBinary('+', acc, x); },
              v.el === 'Double' ? scDbl(0) : v.el === 'BigInt' ? scBig(0n) : scInt(0));
          }
          case 'length': case 'size': return scInt(v.v.length);
          case 'isEmpty': return scBool(v.v.length === 0);
          case 'nonEmpty': return scBool(v.v.length > 0);
          case 'head':
            if (!v.v.length) throw { msg: '<code>head</code> of an empty list throws a ' +
              '<code>NoSuchElementException</code>.', runtime: true };
            return v.v[0];
          case 'last':
            if (!v.v.length) throw { msg: '<code>last</code> of an empty list throws a ' +
              '<code>NoSuchElementException</code>.', runtime: true };
            return v.v[v.v.length - 1];
          case 'tail':
            if (!v.v.length) throw { msg: '<code>tail</code> of an empty list throws an ' +
              '<code>UnsupportedOperationException</code>.', runtime: true };
            return scList(v.v.slice(1), v.el);
          case 'reverse': return scList(v.v.slice().reverse(), v.el);
          case 'distinct': {
            var seen = {}, out = [];
            v.v.forEach(function (x) {
              var k = scShow(x);
              if (!seen[k]) { seen[k] = true; out.push(x); }
            });
            return scList(out, v.el);
          }
          case 'contains':
            if (args.length !== 1) throw { msg: '<code>contains</code> takes one argument.' };
            return scBool(v.v.some(function (x) { return scShow(x) === scShow(args[0]); }));
          case 'mkString': {
            var sep = args.length ? String(args[0].v) : '';
            return scStr(v.v.map(function (x) {
              return x.t === 'String' ? x.v : scShow(x);
            }).join(sep));
          }
          case 'min': case 'max': {
            if (!v.v.length) throw { msg: '<code>' + name + '</code> of an empty list throws.',
              runtime: true };
            var best = v.v[0];
            v.v.forEach(function (x) {
              var better = name === 'min' ? Number(x.v) < Number(best.v) : Number(x.v) > Number(best.v);
              if (better) best = x;
            });
            return best;
          }
        }
      }
      if (v.t === 'String') {
        switch (name) {
          case 'length': case 'size': return scInt(v.v.length);
          case 'toUpperCase': return scStr(v.v.toUpperCase());
          case 'toLowerCase': return scStr(v.v.toLowerCase());
          case 'reverse': return scStr(v.v.split('').reverse().join(''));
          case 'toList': return scList(v.v.split('').map(scChar), 'Char');
          case 'isEmpty': return scBool(v.v.length === 0);
        }
      }
      if (v.t === 'Char' && name === 'toInt') return scInt(v.v.charCodeAt(0));
      if (v.t === 'Int' && name === 'toDouble') return scDbl(v.v);
      if (v.t === 'Int' && name === 'toString') return scStr(String(v.v));
      if (v.t === 'Double' && name === 'toInt') return scInt(Math.trunc(v.v) | 0);
      if (v.t === 'Tuple' && /^_[12]$/.test(name)) {
        var idx = Number(name.slice(1)) - 1;
        if (idx >= v.v.length) throw { msg: 'This tuple has no <code>' + esc(name) + '</code>.' };
        return v.v[idx];
      }
      throw { msg: 'A ' + scTypeName(v) + ' has no <code>' + esc(name) + '</code> in this subset.' };
    }

    try {
      var val = parseExpr(1);
      if (pos < toks.length) {
        return { ok: false, error: 'Left over after the expression: <code>' +
          esc(String(toks[pos].v)) + '</code>.' };
      }
      return { ok: true, value: val, show: scShow(val), type: scTypeName(val) };
    } catch (e) {
      if (e && e.msg) return { ok: false, error: e.msg, runtime: !!e.runtime };
      throw e;
    }
  }

  /** The same expression as Java, for the numeric cases the tests compare. */
  function scToJava(src) {
    /* Only the Int and Double arithmetic subset translates directly;
       the caller checks scJavaSafe first. */
    return src
      .replace(/\bBigInt\((\d+)\)/g, 'new java.math.BigInteger("$1")')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Is this expression pure Int/Double arithmetic, so Java can check it? */
  function scJavaSafe(src) {
    return /^[\s0-9+\-*/%().]+$/.test(src);
  }

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
