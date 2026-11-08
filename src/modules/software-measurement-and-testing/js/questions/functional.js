  /* ---------- Topic 02 · functional testing ---------- */

  var FMEMO = {};
  function fonce(key, fn) {
    if (!(key in FMEMO)) FMEMO[key] = fn();
    return FMEMO[key];
  }

  /* ---- the counting formulas ---- */

  QZ_GEN.push({ topic: 'functional', make: function () {
    var sizes = [qzInt(2, 5), qzInt(2, 6), qzInt(1, 3)];
    var which = qzInt(0, 3);
    var n = sizes.length;
    var vals = [
      Math.max.apply(null, sizes),
      Math.max.apply(null, sizes) + 2 * n,
      sizes.reduce(function (a, b) { return a * b; }, 1),
      sizes.map(function (x) { return x + 2; }).reduce(function (a, b) { return a * b; }, 1)
    ];
    var names = ['weak normal EC', 'weak robust EC', 'strong normal EC', 'strong robust EC'];
    var forms = ['max |Sₓ|', 'max |Sₓ| + 2n', '∏ |Sₓ|', '∏ (|Sₓ| + 2)'];
    return {
      topic: 'functional · counting test cases',
      prompt: 'Three variables with <strong>' + sizes.join(', ') + '</strong> equivalence ' +
        'classes. How many test cases does <strong>' + names[which] + '</strong> need?',
      placeholder: 'a number',
      answer: String(vals[which]),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === vals[which] };
      },
      explain: '<code>' + forms[which] + '</code> = <strong>' + vals[which] + '</strong>. ' +
        (which === 0
          ? 'The maximum, not the sum — one test case covers one class of every variable at ' +
            'once, which is the token puzzle.'
          : which === 2
            ? 'Every combination, so the product.'
            : 'The robust variants add the out-of-range values, two per variable.')
    };
  } });

  /* ---- weak vs strong, normal vs robust ---- */

  QZ_GEN.push({ topic: 'functional', make: function () {
    var items = [
      { q: 'the single fault assumption', a: 'weak',
        why: 'Weak variants assume faults arise from one variable at a time, so covering ' +
          'each class of each variable separately is enough.' },
      { q: 'the multiple fault assumption', a: 'strong',
        why: 'Strong variants cover every combination of classes, which is what you need if ' +
          'faults can arise from variables interacting.' },
      { q: 'out-of-range values', a: 'robust',
        why: 'Robust variants add values outside each variable’s range. The notes note ' +
          'they are especially effective for weakly typed languages, where nothing else ' +
          'stops such a value.' }
    ];
    var pick = items[qzInt(0, items.length - 1)];
    return {
      topic: 'functional · which variant',
      kind: 'choice',
      prompt: 'Which word in the name of an equivalence class technique tells you it uses ' +
        '<strong>' + pick.q + '</strong>?',
      choices: ['weak', 'strong', 'robust', 'normal'],
      answer: pick.a,
      check: textCheck(pick.a),
      explain: pick.why
    };
  } });

  /* ---- the mortgage program, run ---- */

  QZ_GEN.push({ topic: 'functional', make: function () {
    var ft = qzInt(0, 1) === 1;
    var age = qzInt(18, 55);
    var sal = 1000;
    var r = fnRun(ft, age, sal);
    return {
      topic: 'functional · the mortgage program',
      kind: 'choice',
      prompt: 'The mortgage code is given <code>full-time = ' + ft + '</code>, <code>age = ' +
        age + '</code>, <code>salary = 1000</code>. Does it agree with the specification?',
      choices: ['yes', 'no'],
      answer: r.pass ? 'yes' : 'no',
      check: textCheck(r.pass ? 'yes' : 'no'),
      explain: r.pass
        ? 'Yes. The specification says ' + r.category + ', factor ' + r.expectedFactor +
          ', and the code applies ' + r.gotFactor + '.'
        : 'No. The specification says <strong>' + r.category + '</strong> (' + r.expected +
          ') and the code returns ' + r.got + ', applying factor ' + r.gotFactor + '.'
    };
  } });

  QZ_GEN.push({ topic: 'functional', make: function () {
    var map = fonce('faultmap', function () { return fnFaultMap(1000); });
    return {
      topic: 'functional · where the faults are',
      prompt: 'Over the whole valid input range &mdash; both employment types, ages 18 to ' +
        '55 &mdash; in how many separate stretches of age does the mortgage code disagree ' +
        'with its specification?',
      placeholder: 'a number',
      answer: String(map.regions.length),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === map.regions.length };
      },
      explain: 'Five: ' + map.regions.map(function (g) {
        return (g.ft ? 'full-time ' : 'part-time ') + g.from +
          (g.from === g.to ? '' : '–' + g.to);
      }).join(', ') + '. Two are off-by-one at a boundary, one is a wrong constant, and one ' +
        'is a missing range check — a fault of omission.'
    };
  } });

  /* ---- the measured comparison ---- */

  QZ_GEN.push({ topic: 'functional', make: function () {
    var rows = fonce('compare', function () { return fnCompare(); });
    var pick = rows[qzInt(0, rows.length - 1)];
    return {
      topic: 'functional · what each technique catches',
      prompt: 'On the mortgage example, how many test cases does <strong>' +
        esc(pick.label) + '</strong> generate?',
      placeholder: 'a number',
      answer: String(pick.tests),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === pick.tests };
      },
      explain: '<strong>' + pick.tests + '</strong> test cases, finding ' + pick.faults +
        ' distinct fault' + (pick.faults === 1 ? '' : 's') +
        (pick.perFault ? ' — ' + pick.perFault.toFixed(1) + ' tests per fault' : '') +
        '. The classes here are 2 for full-time, 6 for age and 1 for salary.'
    };
  } });

  QZ_GEN.push({ topic: 'functional', make: function () {
    var sweep = fonce('nominal', function () { return fnNominalSweep(); });
    var lo = Math.min.apply(null, sweep.map(function (r) { return r.faults; }));
    var hi = Math.max.apply(null, sweep.map(function (r) { return r.faults; }));
    return {
      topic: 'functional · how good is boundary value testing',
      kind: 'choice',
      prompt: 'Boundary value testing is run on the mortgage example eight times, changing ' +
        'only which values are treated as <em>nominal</em>. What happens to the number of ' +
        'faults it finds?',
      choices: ['it varies between ' + lo + ' and ' + hi,
                'it stays the same every time',
                'it increases with every change',
                'it finds all of them each time'],
      answer: 'it varies between ' + lo + ' and ' + hi,
      check: textCheck('it varies between ' + lo + ' and ' + hi),
      explain: 'Measured: between ' + lo + ' and ' + hi + ' faults, from the same technique ' +
        'on the same program. With full-time nominal and age 36 it finds none at all. This ' +
        'is the first drawback the notes list for BV — <em>no sense of covering the input ' +
        'domain</em> — with a number attached.'
    };
  } });

  /* ---- the formula wrinkle ---- */

  QZ_GEN.push({ topic: 'functional', make: function () {
    return {
      topic: 'functional · when the formula overcounts',
      kind: 'choice',
      prompt: 'On the mortgage example the strong robust EC formula gives 96, but only 48 ' +
        'distinct test cases can actually be built. Why?',
      choices: ['full-time is a boolean, so it has no out-of-range values',
                'some test cases are duplicates of each other',
                'the salary range is too narrow',
                'the formula counts combinations that fail the range check'],
      answer: 'full-time is a boolean, so it has no out-of-range values',
      check: textCheck('full-time is a boolean, so it has no out-of-range values'),
      explain: '<code>∏(|Sₓ| + 2)</code> adds two values per variable — one just below the ' +
        'range and one just above. A boolean has neither, so the two phantom values for ' +
        'full-time double the count. (2+2)(6+2)(1+2) = 96 against the 2×8×3 = 48 that exist. ' +
        'The same thing takes weak robust from 12 down to 10. The notes flag it in passing: ' +
        'full-time is "as strange as boundary value".'
    };
  } });

  /* ---- the puzzle ---- */

  QZ_GEN.push({ topic: 'functional', make: function () {
    var m = qzInt(2, 6), n = qzInt(2, 6);
    var p = fnPuzzle(m, n);
    return {
      topic: 'functional · the token puzzle',
      prompt: 'What is the fewest tokens you can place on a <strong>' + m + ' &times; ' + n +
        '</strong> grid so that every row and every column holds at least one?',
      placeholder: 'a number',
      answer: String(p.tokens),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === p.tokens };
      },
      explain: '<code>max(' + m + ', ' + n + ') = ' + p.tokens + '</code> — put token ' +
        '<em>i</em> at <code>(min(i, ' + m + '), min(i, ' + n + '))</code>. Fewer than ' + m +
        ' leaves a row empty and fewer than ' + n + ' leaves a column empty, so neither can ' +
        'be beaten. This is weak normal EC: a test case is a token covering one class of ' +
        'every variable at once.'
    };
  } });

  /* ---- decision tables ---- */

  QZ_GEN.push({ topic: 'functional', make: function () {
    var k = qzInt(2, 5);
    return {
      topic: 'functional · decision table completeness',
      prompt: 'A decision table has <strong>' + k + '</strong> independent binary ' +
        'conditions. How many rules must it account for?',
      placeholder: 'a number',
      answer: String(Math.pow(2, k)),
      check: function (v) {
        var x = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
        if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
        return { ok: x === Math.pow(2, k) };
      },
      explain: '<code>2<sup>' + k + '</sup> = ' + Math.pow(2, k) + '</code>. The table may ' +
        'have fewer columns than that, because each <code>&ndash;</code> (don’t care) ' +
        'entry stands for both values and therefore counts as two rules. If the total comes ' +
        'up short, some input combinations have no specified behaviour at all.'
    };
  } });

  QZ_GEN.push({ topic: 'functional', make: function () {
    return {
      topic: 'functional · what decision tables add',
      kind: 'choice',
      prompt: 'What assumption do decision tables relax, that every equivalence class and ' +
        'boundary value technique had to make?',
      choices: ['that the input variables are independent',
                'that the specification is correct',
                'that faults occur one at a time',
                'that the input domain is finite'],
      answer: 'that the input variables are independent',
      check: textCheck('that the input variables are independent'),
      explain: 'Decision table conditions need not be independent, so dependencies between ' +
        'inputs can finally be written down. In the mortgage example the age categories ' +
        'depend on full-time, and equivalence class testing has no way to express that — ' +
        'which is why its age classes had to be the six-way intersection of both columns.'
    };
  } });

  /* ---- classification trees ---- */

  QZ_GEN.push({ topic: 'functional', make: function () {
    return {
      topic: 'functional · classification trees',
      kind: 'choice',
      prompt: 'In a classification tree, what must each partition satisfy?',
      choices: ['it must cover the whole domain of its parent node',
                'it must contain exactly two classes',
                'it must be independent of every other aspect',
                'it must have the same size as its siblings'],
      answer: 'it must cover the whole domain of its parent node',
      check: textCheck('it must cover the whole domain of its parent node'),
      explain: 'The hierarchy is the point: aspects are ordered with the more global ' +
        'conditions first, and each partition splits up its parent’s domain completely. ' +
        'That is what lets "which kind of triangle" exist only under "large" and "triangle", ' +
        'and lets the mortgage age classes depend on full-time.'
    };
  } });
