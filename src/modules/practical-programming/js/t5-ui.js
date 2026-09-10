  /* ============================================================
     TOPIC 05 · rendering for the dispatch, layout and cast tools
     ============================================================ */

  /* ---------- Tool 1 · which function runs ---------- */

  function runDispatch() {
    var out = document.getElementById('dp-output');
    if (!out) return;
    var isVirtual = !!(document.getElementById('dp-virtual') || {}).checked;
    var how = ((document.getElementById('dp-how') || {}).value) || 'ref';
    var real = ((document.getElementById('dp-real') || {}).value) || 'Bikes';
    var stat = how === 'object' ? real
      : ((document.getElementById('dp-static') || {}).value) || 'Coordinate';

    var r = dpCall({ isVirtual: isVirtual, staticType: stat, dynamicType: real, how: how });
    if (!r.ok) {
      out.innerHTML = '<div class="verdict bad">' + r.error + '</div>';
      return;
    }

    var handle = {
      ref: stat + ' &amp; r = real;  r.printDetails();',
      ptr: stat + ' * p = &amp;real;  p-&gt;printDetails();',
      value: stat + ' copy = real;  copy.printDetails();',
      object: 'real.printDetails();'
    }[how];

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill ' + (isVirtual ? 'b' : 'dark') + '">' +
        (isVirtual ? 'virtual' : 'not virtual') + '</span>' +
      '<span class="stat-pill a">object is a ' + esc(real) + '</span>' +
      '<span class="stat-pill a">named as ' + esc(stat) + '</span>' +
      '<span class="stat-pill ' + (r.runs === real && !r.sliced ? 'b' : 'c') + '">' +
        esc(r.runs) + '::printDetails</span>' +
      (r.sliced ? '<span class="stat-pill c">sliced</span>' : '') + '</div>';

    h += '<pre class="pp-snippet">class Coordinate {\n' +
      '  ' + (isVirtual ? 'virtual ' : '') + 'void printDetails() { cout &lt;&lt; x &lt;&lt; "," &lt;&lt; y; }\n' +
      '};\nclass Bikes : public Coordinate {\n' +
      '  ' + (isVirtual ? 'virtual ' : '') + 'void printDetails()' + (isVirtual ? ' override' : '') +
      ' { Coordinate::printDetails(); cout &lt;&lt; ": " &lt;&lt; howMany &lt;&lt; " bikes"; }\n};\n\n' +
      (real === 'Bikes' ? 'Bikes real(20,10,100);' : 'Coordinate real(20,10);') + '\n' +
      handle + '</pre>';

    /* Which of the two bodies is reached. */
    h += '<div class="dp-bodies">';
    ['Coordinate', 'Bikes'].forEach(function (t) {
      h += '<div class="dp-body' + (r.runs === t ? ' on' : '') + '">' +
        '<code>' + t + '::printDetails()</code>' +
        '<span class="dp-tag">' + (r.runs === t ? 'this one runs' : '') + '</span></div>';
    });
    h += '</div>';

    h += '<div class="verdict ' + (r.sliced ? 'bad' : (r.dynamic ? 'safe' : 'warn')) + '">' +
      r.why + '</div>';

    h += '<div class="dp-out"><div class="pp-cap">output</div>' +
      '<pre class="pp-snippet">' + esc(r.output) + '</pre></div>';

    if (r.dynamic) {
      h += '<div class="dp-vt"><div class="pp-cap">how the choice is made</div>' +
        '<div class="dp-vt-row"><div class="dp-obj"><span class="vt">vptr</span>' +
        '<span class="fld">x</span><span class="fld">y</span>' +
        (real === 'Bikes' ? '<span class="fld">howMany</span>' : '') + '</div>' +
        '<div class="dp-arrow">&rarr;</div>' +
        '<div class="dp-table"><div class="dp-th">' + esc(real) + ' vtable</div>' +
        '<div class="dp-tr"><code>printDetails</code><span>&rarr; ' + esc(real) +
        '::printDetails</span></div></div></div>' +
        '<div class="pp-note">Every object of a class with virtual functions carries a hidden ' +
        'first member: a pointer to its class’s table. The call reads the address out of that ' +
        'table rather than being fixed at compile time. The cost is one pointer per object and one ' +
        'indirection per call — which is why it is opt-in rather than the default.</div></div>';
    }

    if (r.sliced) {
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">Slicing</div>' +
        'A <code>Coordinate</code> variable is exactly big enough for a Coordinate. Copying a ' +
        'Bikes into one copies the Coordinate part and nothing else — no error, no warning, and ' +
        'the result behaves as a Coordinate for ever after. This is the reason polymorphic code ' +
        'passes references or pointers, never objects by value.</div>';
    }

    out.innerHTML = h;
  }

  function dpToggleStatic() {
    var how = ((document.getElementById('dp-how') || {}).value) || 'ref';
    var f = document.getElementById('dp-static-field');
    if (f) f.style.display = how === 'object' ? 'none' : '';
    runDispatch();
  }

  /* ---------- Tool 2 · what the object looks like in memory ---------- */

  var lyCurrent = 'derived';

  function runLayout(which) {
    var out = document.getElementById('ly-output');
    if (!out) return;
    if (which) lyCurrent = which;
    var preset = LY_PRESETS[lyCurrent] || LY_PRESETS.derived;
    var r = lyLayout(preset.spec);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + esc(preset.label) + '</span>' +
      '<span class="stat-pill b">sizeof = ' + r.size + '</span>' +
      (r.hasVptr ? '<span class="stat-pill dark">has a vtable pointer</span>' : '') + '</div>';

    h += '<div class="ly-choices">';
    Object.keys(LY_PRESETS).forEach(function (k) {
      h += '<button class="chip' + (k === lyCurrent ? ' on' : '') +
        '" onclick="runLayout(\'' + k + '\')">' + esc(LY_PRESETS[k].label) + '</button>';
    });
    h += '</div>';

    /* The bar. Each byte is one unit wide. */
    h += '<div class="ly-bar">';
    var used = 0;
    r.all.forEach(function (f) {
      if (f.offset > used) {
        h += '<div class="ly-cell pad" style="flex:' + (f.offset - used) + '">' +
          '<span class="ly-name">padding</span><span class="ly-sz">' + (f.offset - used) +
          '</span></div>';
      }
      h += '<div class="ly-cell' + (f.vptr ? ' vptr' : '') + '" style="flex:' + f.size + '">' +
        '<span class="ly-name">' + esc(f.name) + '</span>' +
        '<span class="ly-sz">' + f.offset + '&ndash;' + (f.offset + f.size - 1) + '</span></div>';
      used = f.offset + f.size;
    });
    if (r.size > used) {
      h += '<div class="ly-cell pad" style="flex:' + (r.size - used) + '">' +
        '<span class="ly-name">padding</span><span class="ly-sz">' + (r.size - used) +
        '</span></div>';
    }
    h += '</div>';

    if (r.groups.length) {
      h += '<div class="ly-bases"><div class="pp-cap">where each base class starts</div><ul>';
      r.baseOffsets.forEach(function (b) {
        if (!b.name) return;
        h += '<li><code>' + esc(b.name) + ' * p = &amp;d;</code> gives an address ' +
          (b.offset === 0
            ? '<strong>equal to</strong> the object’s own'
            : '<strong>' + b.offset + ' bytes past</strong> the object’s own') + '</li>';
      });
      h += '</ul><div class="pp-note">' +
        (r.groups.length > 1
          ? 'With more than one base, only the first can start at offset zero. Converting to a ' +
            'pointer to any other base <strong>changes the address</strong> — quietly, and by ' +
            'exactly the right amount. Casting back adjusts it again. This is why comparing a ' +
            '<code>Derived *</code> with a <code>Base *</code> can be true even though the two ' +
            'numbers differ.'
          : 'A derived object begins with a complete base object, so a pointer to the derived ' +
            'class is already a valid pointer to the base. No conversion is needed at run time.') +
        '</div></div>';
    }

    if (r.hasVptr) {
      h += '<div class="callout tip" style="margin:14px 0;">' +
        '<div class="callout-label">What one virtual function costs</div>' +
        'Eight bytes on every object, for the pointer to the table, and one extra indirection on ' +
        'every virtual call. Compare the sizes above with and without it. For a handful of objects ' +
        'this is nothing; for a vector of ten million it is eighty megabytes, which is the ' +
        'reasoning behind making it something you ask for.</div>';
    }

    var hasPad = false;
    (function () {
      var u = 0;
      r.all.forEach(function (f) { if (f.offset > u) hasPad = true; u = f.offset + f.size; });
      if (r.size > u) hasPad = true;
    })();
    if (hasPad) {
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">Padding</div>' +
        'A member has to sit at an address that is a multiple of its own size, so the compiler ' +
        'inserts gaps. Reordering members largest-first often shrinks the object without changing ' +
        'a line of logic.</div>';
    }

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · which cast ---------- */

  function runCast(picked) {
    var out = document.getElementById('cw-output');
    if (!out) return;
    var caseName = ((document.getElementById('cw-case') || {}).value) || 'downUnknown';
    var c = CT_CASES[caseName];

    var h = '<div class="cw-question">' + c.text + '</div>';

    h += '<div class="cw-picks">';
    ['static_cast', 'dynamic_cast', 'reinterpret_cast', 'const_cast', 'no cast needed']
      .forEach(function (k) {
        var state = '';
        if (picked) {
          if (k === c.right) state = ' right';
          else if (k === picked) state = ' wrong';
        }
        h += '<button class="chip' + state + '" onclick="runCast(\'' + k + '\')">' +
          '<code>' + esc(k) + '</code></button>';
      });
    h += '</div>';

    if (picked) {
      var r = ctChoose(caseName, picked);
      h += '<div class="verdict ' + (r.correct ? 'safe' : 'bad') + '">' +
        (r.correct ? '<strong>Yes.</strong> ' : '<strong>Not this one.</strong> ') + r.why +
        (r.note ? '<br><br>' + r.note : '') + '</div>';
      if (r.detail) {
        h += '<div class="cw-detail"><div class="pp-cap">' + esc(r.right) + '</div>' +
          '<table class="pp-table"><tbody>' +
          '<tr><td>use it when</td><td>' + r.detail.when + '</td></tr>' +
          '<tr><td>checks</td><td>' + r.detail.checks + '</td></tr>' +
          '<tr><td>costs at run time</td><td>' + r.detail.runtime + '</td></tr>' +
          '<tr><td>if it cannot</td><td>' + r.detail.fails + '</td></tr>' +
          '</tbody></table></div>';
      }
    } else {
      h += '<div class="pp-note">Pick one.</div>';
    }

    out.innerHTML = h;
  }
