  /* ============================================================
     SMT TOPIC 05 (a) · mocking

     A mocking library is a description of a behaviour: what a stub
     returns on the third call, what counts as an interaction, when
     an argument matcher is allowed. All of that is checkable, so
     rather than describe Mockito this file implements a small one
     and the tests check it against what the notes say Mockito does.

     That turned something up. The notes state the consecutive-call
     rule in prose — "if we pass two arguments to thenReturn, the
     first call returns the first argument; thereafter, all other
     calls will return the last argument" — and then print a test
     whose fifth assertion contradicts it. Implementing the stated
     rule makes the disagreement unmissable; see mkConsecutive.

     Algorithms only — no DOM.
     ============================================================ */

  /* ---------------------------------------------------------------
     Argument matchers.

     Mockito's rule, which trips everyone up once: if any argument is
     given by a matcher, every argument must be. The reason is in the
     implementation rather than the documentation — matchers are
     pushed onto a stack as they are evaluated, and the mock has no
     way to tell which positions they came from. So a call with two
     matchers and one literal looks exactly like a call with three
     matchers, two of which are missing.
     --------------------------------------------------------------- */

  var MK_STACK = [];

  function mkMatcher(kind, fn, label) {
    var m = { __matcher: true, kind: kind, test: fn, label: label };
    MK_STACK.push(m);
    return m;
  }

  function mkAny() { return mkMatcher('any', function () { return true; }, 'any()'); }
  function mkAnyString() {
    return mkMatcher('anyString', function (v) { return typeof v === 'string'; },
      'anyString()');
  }
  function mkAnyInt() {
    return mkMatcher('anyInt', function (v) {
      return typeof v === 'number' && Math.floor(v) === v;
    }, 'anyInt()');
  }
  function mkEq(x) {
    return mkMatcher('eq', function (v) { return mkSame(v, x); }, 'eq(' + mkShow(x) + ')');
  }
  function mkArgThat(fn, label) {
    return mkMatcher('argThat', fn, label || 'argThat(...)');
  }

  function mkSame(a, b) {
    if (a === b) return true;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  }

  function mkShow(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (v && v.__matcher) return v.label;
    if (typeof v === 'string') return '"' + v + '"';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  /* Turn the arguments of a call into a list of predicates, applying
     the all-or-none rule. Returns { ok, spec, error }. */
  function mkSpec(args) {
    var used = MK_STACK.slice();
    MK_STACK.length = 0;
    var matchers = args.filter(function (a) { return a && a.__matcher; });

    if (used.length && matchers.length !== args.length) {
      return {
        ok: false,
        error: 'Invalid use of argument matchers. ' + args.length +
          ' arguments were given and ' + matchers.length +
          ' of them are matchers — if any argument is a matcher, all of them must be.'
      };
    }
    return {
      ok: true,
      spec: args.map(function (a) {
        if (a && a.__matcher) return a;
        return { __matcher: true, kind: 'value', value: a, label: mkShow(a),
                 test: function (v) { return mkSame(v, a); } };
      })
    };
  }

  function mkSpecMatches(spec, args) {
    if (spec.length !== args.length) return false;
    for (var i = 0; i < spec.length; i++) if (!spec[i].test(args[i])) return false;
    return true;
  }

  /* ---------------------------------------------------------------
     The mock itself.

     Every call is recorded. A recorded call is also remembered as
     "the last one", which is how when(mock.foo(1)) can work: the
     expression is evaluated first, so by the time when() runs, the
     call it is talking about has already happened. Mockito does
     exactly this, and it is why a stubbing call must then be taken
     back out of the interaction log — otherwise every stub would
     count as an interaction and verifyNoMoreInteractions would never
     pass.
     --------------------------------------------------------------- */

  function mkMock(name, methods) {
    var mock = {
      __mock: true,
      __name: name,
      __calls: [],          /* every call, in order */
      __stubs: []           /* { method, spec, answers, i } */
    };

    methods.forEach(function (method) {
      mock[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        var call = { mock: mock, method: method, args: args, verified: false };
        mock.__calls.push(call);
        MK_LAST = call;
        MK_SEQ.push(call);

        /* Latest matching stub wins, as in Mockito. */
        for (var i = mock.__stubs.length - 1; i >= 0; i--) {
          var st = mock.__stubs[i];
          if (st.method !== method) continue;
          if (!mkSpecMatches(st.spec, args)) continue;
          return mkAnswer(st, args);
        }
        return mkDefault(method);
      };
    });
    return mock;
  }

  var MK_LAST = null;        /* the most recent call, for when() */
  var MK_SEQ = [];           /* every call on every mock, for inOrder */

  /* An unstubbed method returns the default value of its return type:
     the notes are explicit that this is false, null or zero rather
     than an error. */
  function mkDefault() { return null; }

  function mkAnswer(stub, args) {
    var a = stub.answers[Math.min(stub.i, stub.answers.length - 1)];
    stub.i++;
    if (a.kind === 'return') return a.value;
    if (a.kind === 'throw') throw a.value;
    if (a.kind === 'answer') return a.fn.apply(null, args);
    if (a.kind === 'real') return a.fn.apply(null, args);
    return null;
  }

  /* when(mock.method(args)) — the call has already happened, so take
     it back out of the log and turn it into a stub. */
  function mkWhen() {
    var call = MK_LAST;
    if (!call) throw new Error('when() needs a call on a mock');
    var mock = call.mock;
    var i = mock.__calls.indexOf(call);
    if (i >= 0) mock.__calls.splice(i, 1);           /* stubbing is not interaction */
    var j = MK_SEQ.indexOf(call);
    if (j >= 0) MK_SEQ.splice(j, 1);
    MK_LAST = null;

    var made = mkSpec(call.args);
    if (!made.ok) throw new Error(made.error);

    var stub = { method: call.method, spec: made.spec, answers: [], i: 0 };
    mock.__stubs.push(stub);

    var api = {
      thenReturn: function () {
        Array.prototype.slice.call(arguments).forEach(function (v) {
          stub.answers.push({ kind: 'return', value: v });
        });
        return api;
      },
      thenThrow: function (e) { stub.answers.push({ kind: 'throw', value: e }); return api; },
      thenAnswer: function (fn) { stub.answers.push({ kind: 'answer', fn: fn }); return api; },
      thenCallRealMethod: function (fn) {
        stub.answers.push({ kind: 'real', fn: fn }); return api;
      }
    };
    return api;
  }

  /* doThrow(e).when(mock).voidMethod(args) — the form for a method
     that returns nothing, where when(mock.voidMethod()) would call
     the real thing before the stub existed. */
  function mkDoThrow(err) {
    return {
      when: function (mock) {
        var proxy = {};
        Object.keys(mock).forEach(function (k) {
          if (typeof mock[k] !== 'function' || k.indexOf('__') === 0) return;
          proxy[k] = function () {
            var made = mkSpec(Array.prototype.slice.call(arguments));
            if (!made.ok) throw new Error(made.error);
            mock.__stubs.push({ method: k, spec: made.spec,
                                answers: [{ kind: 'throw', value: err }], i: 0 });
          };
        });
        return proxy;
      }
    };
  }

  /* ---------------------------------------------------------------
     Verification.
     --------------------------------------------------------------- */

  var MK_MODES = {
    times: function (n) {
      return { name: 'times(' + n + ')', ok: function (c) { return c === n; },
               says: 'exactly ' + n };
    },
    never: function () {
      return { name: 'never()', ok: function (c) { return c === 0; }, says: 'never' };
    },
    atLeastOnce: function () {
      return { name: 'atLeastOnce()', ok: function (c) { return c >= 1; },
               says: 'at least once' };
    },
    atLeast: function (n) {
      return { name: 'atLeast(' + n + ')', ok: function (c) { return c >= n; },
               says: 'at least ' + n };
    },
    atMost: function (n) {
      return { name: 'atMost(' + n + ')', ok: function (c) { return c <= n; },
               says: 'at most ' + n };
    },
    only: function () {
      return { name: 'only()', ok: function (c, total) { return c === 1 && total === 1; },
               says: 'the only call on this mock' };
    }
  };

  /* verify(mock, mode).method(args) — returns a report rather than
     throwing, so the page can show what happened either way. */
  function mkVerify(mock, mode) {
    var m = mode || MK_MODES.times(1);
    var proxy = {};
    Object.keys(mock).forEach(function (k) {
      if (typeof mock[k] !== 'function' || k.indexOf('__') === 0) return;
      proxy[k] = function () {
        var made = mkSpec(Array.prototype.slice.call(arguments));
        if (!made.ok) return { ok: false, error: made.error, mode: m.name };
        var hits = mock.__calls.filter(function (c) {
          return c.method === k && mkSpecMatches(made.spec, c.args);
        });
        hits.forEach(function (c) { c.verified = true; });
        var ok = m.ok(hits.length, mock.__calls.length);
        return {
          ok: ok, mode: m.name, wanted: m.says, got: hits.length,
          call: mock.__name + '.' + k + '(' +
            made.spec.map(function (x) { return x.label; }).join(', ') + ')',
          error: ok ? null : 'wanted ' + m.says + ', got ' + hits.length
        };
      };
    });
    return proxy;
  }

  function mkVerifyNoInteractions() {
    var mocks = Array.prototype.slice.call(arguments);
    var busy = mocks.filter(function (m) { return m.__calls.length; });
    return {
      ok: busy.length === 0,
      error: busy.length ? busy.map(function (m) {
        return m.__name + ' had ' + m.__calls.length + ' call' +
          (m.__calls.length === 1 ? '' : 's');
      }).join('; ') : null
    };
  }

  function mkVerifyNoMoreInteractions() {
    var mocks = Array.prototype.slice.call(arguments);
    var left = [];
    mocks.forEach(function (m) {
      m.__calls.forEach(function (c) {
        if (!c.verified) left.push(m.__name + '.' + c.method + '(' +
          c.args.map(mkShow).join(', ') + ')');
      });
    });
    return { ok: left.length === 0, unverified: left,
             error: left.length ? left.join('; ') + ' was never verified' : null };
  }

  /* inOrder(...).verify(mock).method(args) — each verification must
     find its call after the one before it. */
  function mkInOrder() {
    var mocks = Array.prototype.slice.call(arguments);
    var at = 0;
    return {
      verify: function (mock) {
        var proxy = {};
        Object.keys(mock).forEach(function (k) {
          if (typeof mock[k] !== 'function' || k.indexOf('__') === 0) return;
          proxy[k] = function () {
            var made = mkSpec(Array.prototype.slice.call(arguments));
            if (!made.ok) return { ok: false, error: made.error };
            for (var i = at; i < MK_SEQ.length; i++) {
              var c = MK_SEQ[i];
              if (c.mock === mock && c.method === k && mkSpecMatches(made.spec, c.args)) {
                c.verified = true;
                at = i + 1;
                return { ok: true, at: i };
              }
            }
            return { ok: false,
                     error: mock.__name + '.' + k + ' does not occur after the previous ' +
                       'verified call' };
          };
        });
        return proxy;
      },
      mocks: mocks
    };
  }

  function mkReset() { MK_SEQ = []; MK_LAST = null; MK_STACK.length = 0; }

  /* ---------------------------------------------------------------
     The consecutive-call rule, on its own, because it is where the
     notes contradict themselves.

     Stated rule: "if we pass two arguments to the thenReturn method,
     then the first call to the stubbed method will return the first
     argument. Thereafter, all other calls will return the last
     argument."

     The printed example stubs thenReturn(TEN, ZERO, TEN) and then
     asserts five calls return TEN, ZERO, TEN, TEN, ZERO. The fifth
     assertion wants ZERO where the rule says TEN, and the comment
     above the same example says "10,0,10, ...... and 10 forever".
     --------------------------------------------------------------- */

  function mkConsecutive(values, calls) {
    mkReset();
    var p = mkMock('portfolio', ['getAvgPrice']);
    var w = mkWhenOn(p, 'getAvgPrice', ['stock']);
    w.thenReturn.apply(null, values);
    var out = [], i;
    for (i = 0; i < calls; i++) out.push(p.getAvgPrice('stock'));
    return out;
  }

  /* A small helper so the examples above do not have to rely on the
     evaluation-order trick to stub. */
  function mkWhenOn(mock, method, args) {
    mock[method].apply(mock, args);
    return mkWhen();
  }

  /* What the notes' printed test asserts, in order. */
  var MK_PRINTED_CONSECUTIVE = [10, 0, 10, 10, 0];

  /* =============================================================
     The worked example: a stock broker

     perform() is transcribed from the notes:

       percentGain = (live price − average price) / average price
       if      percentGain >  LIMIT  sell(stock, 10)
       else if percentGain <  LIMIT  buy(stock)

     Note what is not there: percentGain exactly equal to LIMIT does
     nothing at all. The notes do not mention it and their own test
     is named "when ten percent gain then the stock is sold", which
     is the one case the code does not handle.
     ============================================================= */

  var BR_LIMIT = 0.10;

  /* The decision, on its own. brPerform and the sweep below both go
     through this rather than each writing the comparison out: two
     copies of a rule is two places to fix it, and a sabotage of one
     of them leaves the other quietly agreeing with the notes. */
  function brDecide(avg, livePrice) {
    var gain = (livePrice - avg) / avg;
    if (gain > BR_LIMIT) return { action: 'sell', gain: gain };
    if (gain < BR_LIMIT) return { action: 'buy', gain: gain };
    return { action: 'none', gain: gain, reason: 'exactly at the limit' };
  }

  function brPerform(broker, portfolio, market, stock) {
    var live = market.getQuote(stock.symbol);
    if (!live) return { action: 'none', reason: 'no quote' };
    var avg = portfolio.getAvgPrice(stock);
    if (avg === null || avg === 0) return { action: 'none', reason: 'no average price' };
    var d = brDecide(avg, live.price);
    if (d.action === 'sell') portfolio.sell(stock, 10);
    if (d.action === 'buy') portfolio.buy(stock);
    return d;
  }

  function brStock(symbol, name, price) {
    return { symbol: symbol, name: name, price: price };
  }

  /* The notes' own test, run: a stock bought at 10.00 and now worth
     11.20 is a 12% gain, so it is sold. */
  function brTenPercentTest() {
    mkReset();
    var portfolio = mkMock('portfolio', ['getAvgPrice', 'sell', 'buy', 'getCurrentValue']);
    var market = mkMock('marketWatcher', ['getQuote']);
    var aCorp = brStock('A', 'A Corp', 11.20);

    mkWhenOn(portfolio, 'getAvgPrice', [mkArgThat(function (x) {
      return !!(x && x.symbol);
    }, 'isA(Stock.class)')]).thenReturn(10.00);
    mkWhenOn(market, 'getQuote', [mkAnyString()]).thenReturn(aCorp);

    var result = brPerform(null, portfolio, market, aCorp);
    var sold = mkVerify(portfolio).sell(aCorp, 10);
    var notBought = mkVerify(portfolio, MK_MODES.never()).buy(aCorp);

    return { result: result, sold: sold, notBought: notBought,
             portfolio: portfolio, market: market };
  }

  /* Every price the broker could see, against a 10.00 average: which
     ones sell, which buy, and which fall into the gap. */
  function brSweep(avg, from, to, stepCents) {
    var out = [], gapFrom = null, gapTo = null;
    var step = stepCents || 1;
    for (var cents = Math.round(from * 100); cents <= Math.round(to * 100); cents += step) {
      var price = cents / 100;
      var d = brDecide(avg, price);
      var action = d.action;
      out.push({ price: price, gain: d.gain, action: action });
      if (action === 'none') {
        if (gapFrom === null) gapFrom = price;
        gapTo = price;
      }
    }
    return { rows: out, gap: gapFrom === null ? null : { from: gapFrom, to: gapTo } };
  }

  /* The verification modes, run against a known number of calls, so
     the table on the page is measured rather than copied. */
  function mkModeTable(callCount) {
    mkReset();
    var p = mkMock('portfolio', ['sell']);
    var i;
    for (i = 0; i < callCount; i++) p.sell('X', 10);
    var modes = [
      MK_MODES.times(1), MK_MODES.times(callCount), MK_MODES.never(),
      MK_MODES.atLeastOnce(), MK_MODES.atLeast(2), MK_MODES.atMost(1), MK_MODES.only()
    ];
    return modes.map(function (m) {
      var r = mkVerify(p, m).sell('X', 10);
      return { mode: m.name, wanted: m.says, got: r.got, ok: r.ok };
    });
  }
