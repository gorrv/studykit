  /* ---------- Topic 05 · mocking and refactoring ---------- */

  var MMEMO = {};
  function monce(key, fn) {
    if (!(key in MMEMO)) MMEMO[key] = fn();
    return MMEMO[key];
  }

  /* ---- consecutive stubbing ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    var vals = [qzInt(1, 9), qzInt(1, 9), qzInt(1, 9)];
    var nth = qzInt(4, 8);
    var got = mkConsecutive(vals, nth);
    var answer = got[nth - 1];
    return {
      topic: 'mocking · consecutive calls',
      prompt: '<code>when(mock.get()).thenReturn(' + vals.join(', ') +
        ')</code>. What does call number <strong>' + nth + '</strong> return?',
      placeholder: 'a number',
      answer: String(answer),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === answer };
      },
      explain: '<strong>' + answer + '</strong>. Three values are given, so calls one to ' +
        'three return them in turn and <em>every call after that returns the last one</em>. ' +
        'The sequence is ' + got.join(', ') + '.'
    };
  } });

  /* ---- what an unstubbed method returns ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    return {
      topic: 'mocking · stubs that do not match',
      kind: 'choice',
      prompt: '<code>when(mock.getValue(1)).thenReturn(x)</code> is the only stub, and the ' +
        'code under test calls <code>mock.getValue(100)</code>. What happens?',
      choices: ['it returns the default value of the return type',
                'it throws, because no stub matches',
                'it returns x anyway, because the method matches',
                'the verification fails later'],
      answer: 'it returns the default value of the return type',
      check: textCheck('it returns the default value of the return type'),
      explain: 'Null for an object, false for a boolean, zero for a number. Nothing ' +
        'complains, which is why a mis-stubbed argument shows up as a strange null a long ' +
        'way from the stub.'
    };
  } });

  /* ---- the matcher rule ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    return {
      topic: 'mocking · argument matchers',
      kind: 'choice',
      prompt: 'Why does <code>verify(mock).m(1, anyString(), "third")</code> fail?',
      choices: ['if any argument is a matcher, all of them must be',
                'matchers cannot be used inside verify, only inside when',
                'anyString() does not match a literal String',
                'the arguments are in the wrong order'],
      answer: 'if any argument is a matcher, all of them must be',
      check: textCheck('if any argument is a matcher, all of them must be'),
      explain: 'Matchers are pushed onto a stack as they are evaluated, so the mock learns ' +
        'how many arrived but not which positions they came from. One matcher among three ' +
        'arguments is indistinguishable from three matchers, two of them missing.'
    };
  } });

  /* ---- verification modes, measured ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    var calls = qzInt(0, 4);
    var rows = mkModeTable(calls);
    var row = rows[qzInt(0, rows.length - 1)];
    return {
      topic: 'mocking · verification modes',
      kind: 'choice',
      prompt: 'A mocked method is called <strong>' + calls + '</strong> time' +
        (calls === 1 ? '' : 's') + '. Does <code>verify(mock, ' + esc(row.mode) +
        ').m(...)</code> pass?',
      choices: ['yes', 'no'],
      answer: row.ok ? 'yes' : 'no',
      check: textCheck(row.ok ? 'yes' : 'no'),
      explain: '<code>' + esc(row.mode) + '</code> wants ' + esc(row.wanted) + ' and sees ' +
        row.got + ', so it <strong>' + (row.ok ? 'passes' : 'fails') + '</strong>.' +
        (row.mode === 'only()'
          ? ' <code>only()</code> also fails if anything else was called on that mock.'
          : '')
    };
  } });

  /* ---- verifyNoMoreInteractions ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    return {
      topic: 'mocking · verifying nothing else happened',
      kind: 'choice',
      prompt: 'What does <code>verifyNoMoreInteractions(mock)</code> check?',
      choices: ['that nothing unverified was called on the mock',
                'that the mock was never called at all',
                'that no further calls will be made after this line',
                'that every stub on the mock was used'],
      answer: 'that nothing unverified was called on the mock',
      check: textCheck('that nothing unverified was called on the mock'),
      explain: 'So it goes <em>after</em> the verifications it is checking. ' +
        '<code>verifyNoInteractions</code> is the stronger one: nothing at all. Stubbing ' +
        'calls do not count as interactions, or no test using a stub could pass either.'
    };
  } });

  /* ---- the broker boundary ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    var sweep = monce('sweep', function () { return brSweep(10.00, 10.00, 12.00, 1); });
    var none = sweep.rows.filter(function (r) { return r.action === 'none'; });
    return {
      topic: 'mocking · the broker example',
      prompt: 'The broker sells when the gain is <em>greater than</em> ten percent and buys ' +
        'when it is <em>less than</em> ten percent. Against an average price of 10.00, how ' +
        'many of the 201 prices from 10.00 to 12.00 make it do <strong>neither</strong>?',
      placeholder: 'a number',
      answer: String(none.length),
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === none.length };
      },
      explain: '<strong>' + none.length + '</strong> &mdash; the price ' +
        none.map(function (r) { return '<code>' + r.price.toFixed(2) + '</code>'; })
          .join(', ') + ', where the gain is exactly the limit and neither branch runs. ' +
        'The notes\' own test is called "when ten percent gain then the stock is sold" and ' +
        'uses 11.20, which is twelve percent.'
    };
  } });

  /* ---- refactoring, defined ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    return {
      topic: 'refactoring · the definition',
      kind: 'choice',
      prompt: 'Which of these is <strong>not</strong> true of a refactoring?',
      choices: ['it makes the code shorter',
                'it changes the internal structure',
                'it leaves the external behaviour alone',
                'it proceeds in small mechanical steps'],
      answer: 'it makes the code shorter',
      check: textCheck('it makes the code shorter'),
      explain: 'Refactoring does not mean reduction. The purpose is to improve the ' +
        'structure; shorter code is a frequent side effect and never the test of whether ' +
        'the change was worth making.'
    };
  } });

  /* ---- the rule of three ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    return {
      topic: 'refactoring · the rule of three',
      kind: 'choice',
      prompt: 'By the rule of three, when do you refactor duplicated code?',
      choices: ['the third time you write something similar',
                'the first time, immediately',
                'the second time, when you wince at it',
                'when a code review asks you to'],
      answer: 'the third time you write something similar',
      check: textCheck('the third time you write something similar'),
      explain: 'First time, you just do it. Second time, you wince and do it anyway. ' +
        'Third time, you refactor. Three strikes.'
    };
  } });

  /* ---- the smells in the example ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    var cases = [
      { q: 'a method on Customer that uses nothing from Customer and everything from Rental',
        a: 'Feature Envy' },
      { q: 'a <code>switch</code> on a type code, repeated wherever the type matters',
        a: 'Switch Statements' },
      { q: 'one method holding the pricing, the points and the presentation',
        a: 'Long Method' },
      { q: 'a field that is only set some of the time, for the use of one method',
        a: 'Temporary Field' }
    ];
    var c = cases[qzInt(0, cases.length - 1)];
    return {
      topic: 'refactoring · bad smells',
      kind: 'choice',
      prompt: 'Which smell is this: <em>' + c.q + '</em>',
      choices: cases.map(function (x) { return x.a; }),
      answer: c.a,
      check: textCheck(c.a),
      explain: '<strong>' + c.a + '</strong>. The value of the catalogue is that each name ' +
        'has a refactoring attached, so spotting one tells you what to do next &mdash; ' +
        'feature envy means move the method, a type-code switch means replace it with ' +
        'polymorphism.'
    };
  } });

  /* ---- the charge rules, run ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    var codes = [
      { code: 0, name: 'Regular' },
      { code: 1, name: 'a new release' },
      { code: 2, name: 'a children\'s film' }
    ];
    var c = codes[qzInt(0, codes.length - 1)];
    var days = qzInt(1, 8);
    var charge = rfChargeV6({ movie: { title: 'x', priceCode: c.code }, daysRented: days });
    return {
      topic: 'refactoring · the video store',
      prompt: 'What does ' + c.name + ' cost for <strong>' + days + '</strong> day' +
        (days === 1 ? '' : 's') + '?',
      placeholder: 'a number',
      answer: String(charge),
      check: function (x) {
        var k = parseFloat(String(x).replace(/[^0-9.-]/g, ''));
        if (isNaN(k)) return { ok: false, msg: 'Give a number.' };
        return { ok: Math.abs(k - charge) < 1e-9 };
      },
      explain: '<strong>' + charge + '</strong>. Regular is 2 plus 1.5 a day beyond two ' +
        'days; a new release is 3 a day flat; a children\'s film is 1.5 plus 1.5 a day ' +
        'beyond three days.'
    };
  } });

  /* ---- behaviour preservation ---- */

  QZ_GEN.push({ topic: 'mocking', make: function () {
    var n = RF_VERSIONS.length;
    return {
      topic: 'refactoring · behaviour preservation',
      prompt: 'The video-store example is carried through <strong>' + n +
        '</strong> versions. How many of them produce a different statement from the ' +
        'original, for any basket of rentals?',
      placeholder: 'a number',
      answer: '0',
      check: function (x) {
        var k = parseInt(String(x).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(k)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: k === 0 };
      },
      explain: '<strong>None.</strong> That is the definition rather than a happy accident: ' +
        'a step that changed the output would not be a refactoring. Every version here is ' +
        'run against every other on just under eight thousand comparisons to check it.'
    };
  } });
