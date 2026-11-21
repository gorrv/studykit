  /* ============================================================
     SMT TOPIC 05 · rendering

     HTML only. Every number comes from t5-mocking.js and
     t5-refactor.js.
     ============================================================ */

  var T5_ONCE = {};
  function t5Once(key, fn) {
    if (!(key in T5_ONCE)) T5_ONCE[key] = fn();
    return T5_ONCE[key];
  }

  function t5Pct(x) { return (x * 100).toFixed(2).replace(/\.00$/, '') + '%'; }

  /* ---------- Tool 1 · the broker test, run ---------- */

  function runMockBroker() {
    var out = document.getElementById('mb-output');
    if (!out) return;
    var price = parseFloat(((document.getElementById('mb-price') || {}).value) || '11.20');
    if (isNaN(price)) price = 11.20;

    mkReset();
    var portfolio = mkMock('portfolio', ['getAvgPrice', 'sell', 'buy', 'getCurrentValue']);
    var market = mkMock('marketWatcher', ['getQuote']);
    var stock = brStock('A', 'A Corp', price);

    mkWhenOn(portfolio, 'getAvgPrice',
      [mkArgThat(function (x) { return !!(x && x.symbol); }, 'isA(Stock.class)')])
      .thenReturn(10.00);
    mkWhenOn(market, 'getQuote', [mkAnyString()]).thenReturn(stock);

    var result = brPerform(null, portfolio, market, stock);
    var sold = mkVerify(portfolio).sell(stock, 10);
    var bought = mkVerify(portfolio).buy(stock);
    var noMore = mkVerifyNoMoreInteractions(portfolio, market);

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">average 10.00</span>' +
      '<span class="stat-pill dark">live ' + price.toFixed(2) + '</span>' +
      '<span class="stat-pill ' + (result.action === 'none' ? 'c' : 'b') + '">' +
      (result.gain === undefined ? '&mdash;' : t5Pct(result.gain)) + '</span>' +
      '<span class="stat-pill a">' + esc(result.action) + '</span></div>';

    h += '<div class="st-cap">arrange &mdash; two mocks, stubbed</div>';
    h += '<pre class="st-snippet">when(portfolio.getAvgPrice(isA(Stock.class)))\n' +
      '    .thenReturn(new BigDecimal("10.00"));\n' +
      'when(marketWatcher.getQuote(anyString())).thenReturn(aCorp);</pre>';

    h += '<div class="st-cap">act &mdash; the unit under test, using the mocks</div>';
    h += '<pre class="st-snippet">broker.perform(portfolio, aCorp);</pre>';

    h += '<div class="st-cap">assert &mdash; what the mocks were asked to do</div>';
    h += '<table class="st-table"><thead><tr><th>verification</th><th>wanted</th>' +
      '<th>got</th><th></th></tr></thead><tbody>';
    [['verify(portfolio).sell(aCorp, 10)', sold],
     ['verify(portfolio).buy(aCorp)', bought]].forEach(function (pair) {
      var r = pair[1];
      h += '<tr><td><code>' + esc(pair[0]) + '</code></td><td>' + esc(r.wanted) +
        '</td><td>' + r.got + '</td><td><span class="stat-pill ' +
        (r.ok ? 'b' : 'c') + '">' + (r.ok ? 'ok' : 'fails') + '</span></td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="verdict ' + (result.action === 'none' ? 'bad' : 'safe') + '">';
    if (result.action === 'sell') {
      h += 'A gain of ' + t5Pct(result.gain) + ' is above the ten percent limit, so ten ' +
        'shares are sold. Nothing in this test touches a database or a price feed: the ' +
        'two collaborators are mocks, and the assertion is about what the unit <em>asked ' +
        'them to do</em> rather than about a value it returned.';
    } else if (result.action === 'buy') {
      h += 'A gain of ' + t5Pct(result.gain) + ' is below the limit, so the broker buys.';
    } else {
      h += '<strong>Nothing happens.</strong> The gain is exactly ' + t5Pct(result.gain) +
        ', and the code sells when the gain is <em>greater than</em> the limit and buys ' +
        'when it is <em>less than</em> it. Equal to the limit falls between the two ' +
        'branches.';
    }
    h += '</div>';

    if (!noMore.ok) {
      h += '<div class="tool-note"><code>verifyNoMoreInteractions</code> would fail here: ' +
        noMore.unverified.length + ' call' + (noMore.unverified.length === 1 ? '' : 's') +
        ' on those mocks ' + (noMore.unverified.length === 1 ? 'was' : 'were') +
        ' never verified &mdash; <code>' +
        esc(noMore.unverified.slice(0, 3).join('</code>, <code>')) + '</code>. ' +
        'Stubbing calls do not count: a call made inside <code>when()</code> is taken back ' +
        'out of the log, or no test using a stub could ever pass this check.</div>';
    }
    out.innerHTML = h;
  }

  /* ---------- Tool 2 · the boundary ---------- */

  function runBrokerGap() {
    var out = document.getElementById('bg-output');
    if (!out) return;
    var sweep = t5Once('sweep', function () { return brSweep(10.00, 10.00, 12.00, 1); });

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">' + sweep.rows.length + ' prices</span>' +
      '<span class="stat-pill b">' +
      sweep.rows.filter(function (r) { return r.action === 'sell'; }).length +
      ' sell</span>' +
      '<span class="stat-pill a">' +
      sweep.rows.filter(function (r) { return r.action === 'buy'; }).length + ' buy</span>' +
      '<span class="stat-pill c">' +
      sweep.rows.filter(function (r) { return r.action === 'none'; }).length +
      ' neither</span></div>';

    h += '<pre class="st-snippet">if (percentGain.compareTo(LIMIT) &gt; 0) {\n' +
      '  portfolio.sell(stock, 10);\n' +
      '} else if (percentGain.compareTo(LIMIT) &lt; 0) {\n' +
      '  portfolio.buy(stock);\n}</pre>';

    h += '<div class="st-cap">every penny from 10.00 to 12.00, against an average of ' +
      '10.00</div>';
    h += '<div class="fn-strip-row"><span class="fn-strip-l">action</span>' +
      '<span class="fn-strip">';
    sweep.rows.forEach(function (r) {
      var cls = r.action === 'none' ? ' bad' : '';
      h += '<span class="fn-cell' + cls + '" title="' + r.price.toFixed(2) + ' — ' +
        r.action + '"></span>';
    });
    h += '</span></div>';
    h += '<div class="fn-legend"><span class="fn-cell"></span> buys or sells &nbsp; ' +
      '<span class="fn-cell bad"></span> does nothing</div>';

    if (sweep.gap) {
      h += '<div class="verdict bad"><strong>One price in two hundred does nothing at ' +
        'all</strong> &mdash; <code>' + sweep.gap.from.toFixed(2) + '</code>, where the ' +
        'gain is exactly ten percent. The test that would have found it is the one named ' +
        'after it: <em>when ten percent gain then the stock is sold</em>. It uses 11.20, ' +
        'which is twelve percent.</div>';
      h += '<div class="tool-note">Topic 2 has a name for the input that should have been ' +
        'chosen here, and Topic 4 has a letter for it &mdash; <strong>R</strong> for Range ' +
        'in CORRECT. A boundary is not only the ends of a range; it is every value where ' +
        'the behaviour changes, and <code>&gt;</code> next to <code>&lt;</code> with ' +
        'nothing for <code>==</code> makes one.</div>';
    }
    out.innerHTML = h;
  }

  /* ---------- Tool 3 · consecutive stubbing ---------- */

  function runConsecutive() {
    var out = document.getElementById('cc-output');
    if (!out) return;
    var calls = parseInt(((document.getElementById('cc-calls') || {}).value) || '5', 10);
    if (isNaN(calls) || calls < 1) calls = 5;
    calls = Math.min(calls, 10);

    var values = [10, 0, 10];
    var got = mkConsecutive(values, calls);

    var h = '<pre class="st-snippet">when(portfolio.getAvgPrice(stock))\n' +
      '    .thenReturn(BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.TEN);</pre>';

    h += '<div class="st-cap">the rule the notes state</div>';
    h += '<div class="callout-quote">the first call to the stubbed method will return the ' +
      'first argument; thereafter, all other calls will return the last argument</div>';

    h += '<table class="st-table"><thead><tr><th>call</th><th>by that rule</th>' +
      '<th>the printed test asserts</th></tr></thead><tbody>';
    got.forEach(function (v, i) {
      var printed = MK_PRINTED_CONSECUTIVE[i];
      var clash = printed !== undefined && printed !== v;
      h += '<tr' + (clash ? ' class="st-wrong"' : '') + '><td>' + (i + 1) + '</td>' +
        '<td><code>' + v + '</code></td><td>' +
        (printed === undefined ? '<span class="st-dim">&mdash;</span>'
                               : '<code' + (clash ? ' class="st-bad"' : '') + '>' +
                                 printed + '</code>') + '</td></tr>';
    });
    h += '</tbody></table>';

    var clashes = got.map(function (v, i) {
      return MK_PRINTED_CONSECUTIVE[i] !== undefined && MK_PRINTED_CONSECUTIVE[i] !== v
        ? i + 1 : null;
    }).filter(function (x) { return x; });

    if (clashes.length) {
      h += '<div class="verdict bad"><strong>The example disagrees with its own rule ' +
        'at call ' + clashes.join(' and ') + '.</strong> Three values are given, so by ' +
        'the rule above the fourth call and everything after it return the last one, ' +
        '<code>10</code>. The printed assertions are ' +
        MK_PRINTED_CONSECUTIVE.join(', ') + '; the comment one line above them says the ' +
        'sequence is "10, 0, 10, &hellip; and 10 forever", which is the rule and not the ' +
        'assertions.</div>';
      h += '<div class="tool-note">Worth deciding which one to remember before an exam ' +
        'asks. The rule is the one that matches the library and the one the comment ' +
        'states; the fifth assertion is the odd one out. It is also a small lesson in ' +
        'the topic it appears in &mdash; a test that is never run is a claim nobody has ' +
        'checked.</div>';
    }
    out.innerHTML = h;
  }

  /* ---------- Tool 4 · verification modes ---------- */

  function runVerifyModes() {
    var out = document.getElementById('vm-output');
    if (!out) return;
    var n = parseInt(((document.getElementById('vm-calls') || {}).value) || '3', 10);
    if (isNaN(n) || n < 0) n = 3;
    n = Math.min(n, 6);

    var rows = mkModeTable(n);
    var h = '<div class="st-stats"><span class="stat-pill dark">' + n +
      ' call' + (n === 1 ? '' : 's') + ' to <code>portfolio.sell</code></span></div>';
    h += '<table class="st-table"><thead><tr><th>verify mode</th><th>wants</th>' +
      '<th>sees</th><th></th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td><code>' + esc(r.mode) + '</code></td><td>' + esc(r.wanted) +
        '</td><td>' + r.got + '</td><td><span class="stat-pill ' +
        (r.ok ? 'b' : 'c') + '">' + (r.ok ? 'passes' : 'fails') + '</span></td></tr>';
    });
    h += '</tbody></table>';
    h += '<div class="tool-note"><code>never()</code> is <code>times(0)</code>, and ' +
      '<code>only()</code> is the strict one: it wants this call to have happened once ' +
      '<em>and</em> to be the only call on the mock at all, so it fails as soon as ' +
      'anything else is invoked on it.</div>';
    out.innerHTML = h;
  }

  /* ---------- Tool 5 · the refactoring chain ---------- */

  function runRefactorChain() {
    var out = document.getElementById('rc-output');
    if (!out) return;
    var vi = parseInt(((document.getElementById('rc-version') || {}).value) || '0', 10);
    var who = ((document.getElementById('rc-who') || {}).value) || 'Dinsdale Pirhana';
    if (isNaN(vi) || !RF_VERSIONS[vi]) vi = 0;
    var version = RF_VERSIONS[vi];
    var customer = RF_CUSTOMERS[who];
    if (!customer) { out.innerHTML = ''; return; }

    var text = version.run(customer);
    var original = RF_VERSIONS[0].run(customer);
    var agree = t5Once('agree', function () { return rfAgreement(12, 2); });

    var h = '<div class="st-stats">' +
      '<span class="stat-pill dark">step ' + (vi + 1) + ' of ' + RF_VERSIONS.length +
      '</span>' +
      '<span class="stat-pill ' + (text === original ? 'b' : 'c') + '">' +
      (text === original ? 'same output as the original' : 'OUTPUT CHANGED') + '</span>' +
      (version.smells.length
        ? '<span class="stat-pill a">' + esc(version.smells.join(', ')) + '</span>'
        : '<span class="stat-pill a">a rename</span>') + '</div>';

    h += '<div class="st-cap">' + esc(version.name) + ' &mdash; ' + esc(version.change) +
      '</div>';
    h += '<pre class="st-snippet">' + esc(text) + '</pre>';

    h += '<div class="verdict ' + (agree.disagreements.length ? 'bad' : 'safe') + '">';
    if (!agree.disagreements.length) {
      h += '<strong>Every version agrees with every other.</strong> ' +
        agree.comparisons.toLocaleString() + ' comparisons over ' +
        agree.baskets.toLocaleString() + ' baskets &mdash; every rental of every ' +
        'classification from one to twelve days, alone and in pairs &mdash; and not one ' +
        'produces a different statement. That is "behaviour preserving" as a measurement ' +
        'rather than an intention.';
    } else {
      h += '<strong>' + agree.disagreements.length + ' disagreements.</strong> One of the ' +
        'steps changed behaviour, which means it was not a refactoring.';
    }
    h += '</div>';

    if (vi === RF_VERSIONS.length - 1) {
      h += '<div class="st-cap">and the feature the chain was for</div>';
      h += '<pre class="st-snippet">' + esc(rfHtmlStatement(customer)) + '</pre>';
      h += '<div class="tool-note">Adding this to the original would have meant copying ' +
        'the pricing switch and the points rule into a second method. After the chain it ' +
        'is presentation and nothing else, and the hat changes: this step adds behaviour, ' +
        'so it is not a refactoring and the tests for it are new.</div>';
    }
    out.innerHTML = h;
  }

  /* ---------- Tool 6 · the price table ---------- */

  function runPriceTable() {
    var out = document.getElementById('pt-output');
    if (!out) return;
    var rows = rfChargeTable(8);

    var h = '<table class="st-table"><thead><tr><th>days</th><th>Regular</th>' +
      '<th>New release</th><th>Children\'s</th><th>points for a new release</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td><code>' + r.days + '</code></td><td><code>' + r.regular +
        '</code></td><td><code>' + r.newRelease + '</code></td><td><code>' +
        r.childrens + '</code></td><td><code>' + r.pointsNew + '</code></td></tr>';
    });
    h += '</tbody></table>';
    h += '<div class="tool-note">Three different shapes of rule: a flat fee with a ' +
      'surcharge after two days, a pure per-day rate, and a flat fee with a surcharge ' +
      'after three. Every rental earns one point and a new release kept more than one day ' +
      'earns two &mdash; which is why the bonus is the only part of the points rule that ' +
      'ever had a condition in it.</div>';
    out.innerHTML = h;
  }
