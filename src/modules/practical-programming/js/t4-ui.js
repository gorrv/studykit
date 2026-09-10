  /* ============================================================
     TOPIC 04 · rendering for the value-category, overload and
     ownership tools
     ============================================================ */

  /* ---------- Tool 1 · what binds to what ---------- */

  function runBind() {
    var out = document.getElementById('vc-output');
    if (!out) return;
    var expr = ((document.getElementById('vc-expr') || {}).value) || 'x';
    var bind = ((document.getElementById('vc-bind') || {}).value) || 'ref';

    var r = vcBind(expr, bind);
    if (!r.ok) return ppBad('vc-output', r);

    var b = VC_BINDINGS[bind];

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a"><code>' + esc(expr) + '</code></span>' +
      '<span class="stat-pill ' + (r.cat === 'lvalue' ? 'b' : 'dark') + '">' + r.cat + '</span>' +
      '<span class="stat-pill a">' + b.takes + '</span>' +
      '<span class="stat-pill ' + (r.legal ? 'b' : 'c') + '">' +
        (r.legal ? 'binds' : 'does not compile') + '</span></div>';

    h += '<pre class="pp-snippet">' +
      (r.fn ? esc(r.fn) + '\n\n' : '') +
      (r.decl ? esc(r.decl) + '\n' : '') +
      b.text.replace(/&lt;/g, '<').replace('<em>e</em>', esc(expr)) + '</pre>';

    h += '<div class="vc-cat"><div class="pp-cap">why <code>' + esc(expr) + '</code> is an ' +
      r.cat + '</div>' + r.exprWhy + '</div>';

    h += '<div class="verdict ' + (r.legal ? 'safe' : 'bad') + '">' + r.why +
      (r.legal && r.consequence ? '<br><br><strong>Consequence:</strong> ' + r.consequence : '') +
      '</div>';

    /* The whole table, with this cell picked out. */
    h += '<div class="vc-grid-wrap"><div class="pp-cap">the whole table</div>' +
      '<table class="vc-grid"><thead><tr><th>expression</th><th></th>';
    Object.keys(VC_BINDINGS).forEach(function (k) {
      h += '<th' + (k === bind ? ' class="on"' : '') + '>' +
        VC_BINDINGS[k].text.replace('<em>e</em>', 'e') + '</th>';
    });
    h += '</tr></thead><tbody>';
    vcTable().forEach(function (row) {
      var here = row.expr === expr;
      h += '<tr' + (here ? ' class="on"' : '') + '><td><code>' + esc(row.expr) + '</code></td>' +
        '<td class="cat ' + row.cat + '">' + row.cat + '</td>';
      Object.keys(VC_BINDINGS).forEach(function (k) {
        var yes = row.cells[k];
        h += '<td class="' + (yes ? 'yes' : 'no') + (here && k === bind ? ' cell-on' : '') + '">' +
          (yes ? '&#10003;' : '&times;') + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table>' +
      '<div class="pp-note">Two columns take everything, and they are the two that cannot lose ' +
      'anything: a copy, and a const reference. The other two are the interesting ones — ' +
      '<code>&amp;</code> insists the thing survives, <code>&amp;&amp;</code> insists it does ' +
      'not.</div></div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · which overload runs ---------- */

  function runOverload() {
    var out = document.getElementById('ov-output');
    if (!out) return;
    var present = [];
    ['ref', 'constref', 'rvalueref'].forEach(function (k) {
      var el = document.getElementById('ov-' + k);
      if (el && el.checked) present.push(k);
    });
    var arg = ((document.getElementById('ov-arg') || {}).value) || 'lvalue';

    if (!present.length) {
      out.innerHTML = '<div class="verdict bad">No overloads at all. Tick at least one — with ' +
        'none of them there is no function called <code>f</code> to call.</div>';
      return;
    }

    var r = ovPick(present, arg);
    if (!r.ok) return ppBad('ov-output', r);

    var label = {
      ref: 'void f(Thing &amp; t)',
      constref: 'void f(const Thing &amp; t)',
      rvalueref: 'void f(Thing &amp;&amp; t)'
    };

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + present.length + ' overload' +
        (present.length === 1 ? '' : 's') + '</span>' +
      '<span class="stat-pill a">argument: ' + esc(OV_ARGS[arg].text) + '</span>' +
      '<span class="stat-pill ' + (r.compiles ? 'b' : 'c') + '">' +
        (r.compiles ? 'calls ' + r.chosen : 'does not compile') + '</span></div>';

    h += '<div class="ov-set">';
    ['ref', 'constref', 'rvalueref'].forEach(function (k) {
      var on = present.indexOf(k) >= 0;
      var state = !on ? 'off' : (r.chosen === k ? 'chosen'
        : (r.viable.indexOf(k) >= 0 ? 'viable' : 'unviable'));
      h += '<div class="ov-row ' + state + '"><code>' + label[k] + '</code>' +
        '<span class="ov-tag">' + (
          !on ? 'not declared'
            : state === 'chosen' ? 'chosen'
            : state === 'viable' ? 'could take it, but is a worse match'
            : 'cannot take this argument'
        ) + '</span></div>';
    });
    h += '</div>';

    h += '<pre class="pp-snippet">' +
      (OV_ARGS[arg].decl ? esc(OV_ARGS[arg].decl) + '\n' : '') +
      'f(' + esc(OV_ARGS[arg].cc) + ');</pre>';

    h += '<div class="verdict ' + (r.compiles ? (r.steals ? 'safe' : 'warn') : 'bad') + '">' +
      r.why + '</div>';

    if (r.steals) {
      h += '<div class="callout tip" style="margin:14px 0;">' +
        '<div class="callout-label">What the chosen function may now do</div>' +
        'It has been handed something the caller has finished with, so it can take the contents ' +
        'rather than copy them: grab the pointer, set the original to null, done. For a vector of ' +
        'a million ints that is one pointer instead of a million copies.</div>';
    } else if (r.copies) {
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">A copy, and then the original is thrown away</div>' +
        'The argument was a temporary — nobody would have noticed if its contents had been taken. ' +
        'But without an overload taking <code>&amp;&amp;</code>, the const reference picks it up ' +
        'and the function has to copy: it cannot modify what it was given. Add the rvalue ' +
        'reference overload and the same call gets faster with no change at the call site.</div>';
    }

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · who owns it ---------- */

  var upCurrent = 'scope';

  function runOwnership(which) {
    var out = document.getElementById('up-output');
    if (!out) return;
    if (which) upCurrent = which;
    var preset = UP_PRESETS[upCurrent] || UP_PRESETS.scope;
    var r = upRun(preset.ops);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + esc(preset.label) + '</span>' +
      '<span class="stat-pill ' + (r.compiles ? 'b' : 'c') + '">' +
        (r.compiles ? 'compiles' : 'does not compile') + '</span>' +
      (r.leaked.length
        ? '<span class="stat-pill c">' + r.leaked.length + ' never deleted</span>'
        : '<span class="stat-pill b">nothing leaks</span>') +
      '</div>';

    h += '<div class="up-choices">';
    Object.keys(UP_PRESETS).forEach(function (k) {
      h += '<button class="chip' + (k === upCurrent ? ' on' : '') +
        '" onclick="runOwnership(\'' + k + '\')">' + esc(UP_PRESETS[k].label) + '</button>';
    });
    h += '</div>';

    h += '<table class="up-trace"><thead><tr><th>line</th><th>owners</th><th>what happens</th>' +
      '</tr></thead><tbody>';
    r.steps.forEach(function (st, i) {
      h += '<tr class="' + (st.fails ? 'bad' : '') + '" data-step="' + i + '">' +
        '<td><code>' + esc(st.text) + '</code></td><td class="up-owners">';
      if (!st.owners.length) h += '<span class="up-none">—</span>';
      st.owners.forEach(function (o) {
        h += '<span class="up-own' + (o.holds === null ? ' empty' : '') + '">' +
          esc(o.name) + ' &rarr; ' + (o.holds === null ? 'null' : esc(String(o.holds))) +
          '</span>';
      });
      h += '</td><td>' + st.note + (st.leak
        ? ' <strong class="up-leakflag">Leaked.</strong>' : '') + '</td></tr>';
    });
    h += '</tbody></table>';

    r.errors.forEach(function (e) {
      h += '<div class="verdict bad"><code>' + esc(e.line) + '</code><br>' + e.why + '</div>';
    });

    h += '<div class="up-out"><div class="pp-cap">what the program prints</div>' +
      (r.out.length
        ? '<pre class="pp-snippet">' + esc(r.out.join('\n')) + '</pre>'
        : '<div class="pp-note">Nothing at all.</div>') + '</div>';

    if (r.leaked.length) {
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">release() is not a delete</div>' +
        'It hands the raw pointer back and forgets about it. That is exactly what you want when ' +
        'you are passing ownership to something else — and a leak when you are not, because the ' +
        'unique_ptr no longer holds it and nothing else does either.</div>';
    }

    out.innerHTML = h;
  }
