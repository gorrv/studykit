  /* ============================================================
     SCALA TOPIC 04 · reverse Polish notation, bytecode, and
     catastrophic backtracking

       rpConvert   — infix to RPN, by the shunting-yard algorithm
       rpEval      — run RPN on a stack
       rpCompile   — RPN to stack-machine instructions
       bkMatch     — a regex matcher that backtracks, with the steps
                     counted
       bkDeriv     — one that does not, for comparison

     The compiler chain is checked by evaluating the same expression
     three independent ways — the Scala evaluator, the RPN stack, and
     the compiled instructions — and requiring all three to agree.
     The backtracking claim is not asserted at all: the tool runs the
     host's own regex engine and times it.
     ============================================================ */

  /* ---------- infix to reverse Polish ---------- */

  var RP_OPS = {
    '+': { prec: 1, right: false, instr: 'iadd', apply: function (a, b) { return (a + b) | 0; } },
    '-': { prec: 1, right: false, instr: 'isub', apply: function (a, b) { return (a - b) | 0; } },
    '*': { prec: 2, right: false, instr: 'imul', apply: function (a, b) { return Math.imul(a, b); } },
    '/': { prec: 2, right: false, instr: 'idiv', apply: function (a, b) { return (a / b) | 0; } },
    '%': { prec: 2, right: false, instr: 'irem', apply: function (a, b) { return a % b; } }
  };

  function rpTokens(src) {
    var toks = [], i = 0;
    while (i < src.length) {
      var c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c)) {
        var n = '';
        while (i < src.length && /[0-9]/.test(src[i])) { n += src[i]; i++; }
        toks.push({ k: 'num', v: Number(n) });
        continue;
      }
      if (c in RP_OPS) { toks.push({ k: 'op', v: c }); i++; continue; }
      if (c === '(' || c === ')') { toks.push({ k: c }); i++; continue; }
      return { ok: false, error: 'I do not know what to do with <code>' + esc(c) + '</code>.' };
    }
    return { ok: true, toks: toks };
  }

  /**
     Shunting-yard: read left to right, numbers go straight out,
     operators wait on a stack until something of at least their own
     precedence needs to come off. The output is the same expression
     with the brackets gone, because the order says what they said.
  */
  function rpConvert(src) {
    var lexed = rpTokens(src);
    if (!lexed.ok) return lexed;
    var out = [], stack = [], steps = [];

    function snap(what, tok) {
      steps.push({
        token: tok, action: what,
        output: out.map(function (o) { return o.k === 'num' ? o.v : o.v; }).join(' '),
        stack: stack.map(function (s) { return s.k === 'op' ? s.v : '('; }).join(' ')
      });
    }

    for (var i = 0; i < lexed.toks.length; i++) {
      var t = lexed.toks[i];
      if (t.k === 'num') {
        out.push(t);
        snap('a number goes straight to the output', String(t.v));
      } else if (t.k === 'op') {
        var o1 = RP_OPS[t.v];
        while (stack.length) {
          var top = stack[stack.length - 1];
          if (top.k !== 'op') break;
          var o2 = RP_OPS[top.v];
          if (o2.prec > o1.prec || (o2.prec === o1.prec && !o1.right)) {
            out.push(stack.pop());
          } else break;
        }
        stack.push(t);
        snap('an operator waits on the stack until something tighter has come off', t.v);
      } else if (t.k === '(') {
        stack.push(t);
        snap('an open bracket goes on the stack', '(');
      } else {
        var found = false;
        while (stack.length) {
          var s = stack.pop();
          if (s.k === '(') { found = true; break; }
          out.push(s);
        }
        if (!found) return { ok: false, error: 'A closing bracket with nothing to close.' };
        snap('everything back to the open bracket comes off', ')');
      }
    }
    while (stack.length) {
      var last = stack.pop();
      if (last.k === '(') return { ok: false, error: 'An open bracket that is never closed.' };
      out.push(last);
    }
    snap('and the rest of the stack', '');

    return {
      ok: true,
      rpn: out.map(function (o) { return o.k === 'num' ? String(o.v) : o.v; }),
      tokens: out, steps: steps
    };
  }

  /** Run RPN on a stack — the whole point of the notation. */
  function rpEval(tokens) {
    var stack = [], steps = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.k === 'num') {
        stack.push(t.v);
        steps.push({ token: String(t.v), did: 'push', stack: stack.slice() });
      } else {
        if (stack.length < 2) {
          return { ok: false, error: 'Not enough values on the stack for <code>' +
            esc(t.v) + '</code>.' };
        }
        var b = stack.pop(), a = stack.pop();
        if ((t.v === '/' || t.v === '%') && b === 0) {
          return { ok: false, error: 'Division by zero.', runtime: true };
        }
        var r = RP_OPS[t.v].apply(a, b);
        stack.push(r);
        steps.push({ token: t.v, did: 'pop two, ' + a + ' ' + t.v + ' ' + b + ' = ' + r,
                     stack: stack.slice() });
      }
    }
    if (stack.length !== 1) {
      return { ok: false, error: 'The stack ended with ' + stack.length + ' values on it.' };
    }
    return { ok: true, value: stack[0], steps: steps };
  }

  /**
     RPN to stack-machine instructions. This is the whole compiler:
     a number becomes a push, an operator becomes the instruction
     that pops two and pushes one. The notation was already the
     instruction order — that is why it is worth converting to.
  */
  function rpCompile(tokens) {
    return tokens.map(function (t) {
      return t.k === 'num' ? 'ldc ' + t.v : RP_OPS[t.v].instr;
    });
  }

  /** Run the compiled instructions, which must agree with rpEval. */
  function rpRunCode(code) {
    var stack = [];
    for (var i = 0; i < code.length; i++) {
      var ins = code[i];
      if (ins.indexOf('ldc ') === 0) { stack.push(Number(ins.slice(4))); continue; }
      if (stack.length < 2) return { ok: false, error: 'stack underflow' };
      var b = stack.pop(), a = stack.pop();
      var op = null;
      Object.keys(RP_OPS).forEach(function (k) { if (RP_OPS[k].instr === ins) op = k; });
      if (!op) return { ok: false, error: 'unknown instruction ' + ins };
      if ((op === '/' || op === '%') && b === 0) return { ok: false, error: 'divide by zero' };
      stack.push(RP_OPS[op].apply(a, b));
    }
    return stack.length === 1 ? { ok: true, value: stack[0] } : { ok: false, error: 'bad stack' };
  }

  var RP_PRESETS = {
    brackets: { label: '(3 + 1) * (2 + 9)', src: '(3 + 1) * (2 + 9)' },
    precedence: { label: '3 + 1 * 2', src: '3 + 1 * 2' },
    left: { label: '10 - 4 - 3', src: '10 - 4 - 3' },
    nested: { label: '2 * (3 + 4 * (5 - 1))', src: '2 * (3 + 4 * (5 - 1))' },
    div: { label: '7 / 2 * 2', src: '7 / 2 * 2' }
  };

  /* ---------- backtracking ---------- */

  /*
     A tiny regular expression engine written the way most of them are:
     try an alternative, and if the rest of the match fails, come back
     and try the next one. It is correct, and on some patterns it does
     an exponential amount of work before finding out.

     Only the operators the demonstration needs: concatenation, star,
     alternation, brackets, single characters.
  */
  function bkParse(src) {
    var pos = 0;

    function peek() { return src[pos]; }
    function eat(c) {
      if (src[pos] !== c) throw { msg: 'Expected ' + c };
      pos++;
    }
    function parseAlt() {
      var left = parseSeq();
      while (peek() === '|') { pos++; left = { k: 'alt', a: left, b: parseSeq() }; }
      return left;
    }
    function parseSeq() {
      var parts = [];
      while (pos < src.length && peek() !== ')' && peek() !== '|') parts.push(parseStar());
      if (!parts.length) return { k: 'eps' };
      return parts.reduce(function (a, b) { return { k: 'seq', a: a, b: b }; });
    }
    function parseStar() {
      var a = parseAtom();
      for (;;) {
        if (peek() === '*') { pos++; a = { k: 'star', a: a }; continue; }
        if (peek() === '+') { pos++; a = { k: 'seq', a: a, b: { k: 'star', a: a } }; continue; }
        if (peek() === '?') { pos++; a = { k: 'alt', a: a, b: { k: 'eps' } }; continue; }
        break;
      }
      return a;
    }
    function parseAtom() {
      if (peek() === '(') { pos++; var inner = parseAlt(); eat(')'); return inner; }
      var c = src[pos++];
      if (c === undefined) throw { msg: 'The pattern stops early.' };
      return { k: 'chr', c: c };
    }

    try {
      var ast = parseAlt();
      if (pos < src.length) return { ok: false, error: 'Left over: ' + esc(src.slice(pos)) };
      return { ok: true, ast: ast };
    } catch (e) {
      return { ok: false, error: e.msg || 'Could not read that pattern.' };
    }
  }

  /**
     Match by backtracking, counting every step taken. `budget` stops
     it before the page freezes — running out is itself the result
     worth seeing.
  */
  function bkMatch(ast, input, budget) {
    var steps = 0;
    var cap = budget || 2000000;
    var overflowed = false;

    /* m(node, i, k): can node match starting at i, such that the rest
       of the work k also succeeds? Continuation-passing, which is how
       a backtracking matcher is naturally written. */
    function m(node, i, k) {
      if (overflowed) return false;
      if (++steps > cap) { overflowed = true; return false; }
      switch (node.k) {
        case 'eps': return k(i);
        case 'chr': return input[i] === node.c ? k(i + 1) : false;
        case 'seq': return m(node.a, i, function (j) { return m(node.b, j, k); });
        case 'alt': return m(node.a, i, k) || m(node.b, i, k);
        case 'star': {
          /* Greedy: try one more repetition first, then give up and
             match nothing. The `j > i` guard stops an empty body from
             looping for ever — it does not stop the exponential. */
          var tryMore = m(node.a, i, function (j) {
            return j > i ? m(node, j, k) : false;
          });
          return tryMore || k(i);
        }
      }
      return false;
    }

    var ok = m(ast, 0, function (i) { return i === input.length; });
    return { matched: !!ok && !overflowed, steps: steps, overflowed: overflowed };
  }

  /**
     The same question, answered by derivatives: walk the input once,
     rewriting the pattern as you go. No backtracking, so the work is
     bounded by the input length times the size of the pattern.
  */
  function bkNullable(r) {
    switch (r.k) {
      case 'eps': return true;
      case 'chr': return false;
      case 'seq': return bkNullable(r.a) && bkNullable(r.b);
      case 'alt': return bkNullable(r.a) || bkNullable(r.b);
      case 'star': return true;
    }
    return false;
  }

  function bkDerive(r, c) {
    switch (r.k) {
      case 'eps': return { k: 'nul' };
      case 'nul': return { k: 'nul' };
      case 'chr': return r.c === c ? { k: 'eps' } : { k: 'nul' };
      case 'seq': {
        var d = bkSimp({ k: 'seq', a: bkDerive(r.a, c), b: r.b });
        if (bkNullable(r.a)) return bkSimp({ k: 'alt', a: d, b: bkDerive(r.b, c) });
        return d;
      }
      case 'alt':
        return bkSimp({ k: 'alt', a: bkDerive(r.a, c), b: bkDerive(r.b, c) });
      case 'star':
        return bkSimp({ k: 'seq', a: bkDerive(r.a, c), b: r });
    }
    return { k: 'nul' };
  }

  /* Without simplification the rewritten pattern grows without bound,
     which would trade one blow-up for another. These are the four
     rules that keep it small. */
  function bkSimp(r) {
    if (r.k === 'seq') {
      if (r.a.k === 'nul' || r.b.k === 'nul') return { k: 'nul' };
      if (r.a.k === 'eps') return r.b;
      if (r.b.k === 'eps') return r.a;
      return r;
    }
    if (r.k === 'alt') {
      if (r.a.k === 'nul') return r.b;
      if (r.b.k === 'nul') return r.a;
      if (bkShow(r.a) === bkShow(r.b)) return r.a;
      return r;
    }
    return r;
  }

  function bkShow(r) {
    switch (r.k) {
      case 'eps': return 'ε';
      case 'nul': return '∅';
      case 'chr': return r.c;
      case 'seq': return bkShow(r.a) + bkShow(r.b);
      case 'alt': return '(' + bkShow(r.a) + '|' + bkShow(r.b) + ')';
      case 'star': return '(' + bkShow(r.a) + ')*';
    }
    return '?';
  }

  function bkDerivMatch(ast, input) {
    var r = ast, steps = 0, biggest = 0;
    for (var i = 0; i < input.length; i++) {
      r = bkDerive(r, input[i]);
      steps++;
      var size = bkShow(r).length;
      if (size > biggest) biggest = size;
      if (r.k === 'nul') return { matched: false, steps: steps, biggest: biggest };
    }
    return { matched: bkNullable(r), steps: steps, biggest: biggest };
  }

  var BK_PATTERNS = {
    nested: { label: '(a*)*b', src: '(a*)*b',
      note: 'The classic. The outer star can split a run of a&rsquo;s between its repetitions in ' +
        'exponentially many ways, and a backtracking engine tries all of them before concluding ' +
        'there is no b.' },
    simple: { label: '(a*)b', src: '(a*)b',
      note: 'One star, one way to match each prefix. Linear, and the contrast that makes the ' +
        'point: the nesting is what costs, not the star.' },
    alt: { label: '(a|a)*b', src: '(a|a)*b',
      note: 'Two identical alternatives, so every character can be matched two ways and the ' +
        'engine tries both. Same blow-up, a different route to it.' },
    plain: { label: 'aaa*b', src: 'aaa*b',
      note: 'Nothing ambiguous at all.' }
  };
