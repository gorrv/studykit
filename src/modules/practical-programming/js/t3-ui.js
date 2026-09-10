  /* ============================================================
     TOPIC 03 · rendering for the template and container tools
     ============================================================ */

  /* ---------- Tool 1 · template type deduction ---------- */

  function runDeduce() {
    var out = document.getElementById('td-output');
    if (!out) return;
    var a = ((document.getElementById('td-a') || {}).value) || 'int';
    var b = ((document.getElementById('td-b') || {}).value) || 'int';
    var explicit = ((document.getElementById('td-explicit') || {}).value) || '';

    var r = tdDeduce(['T', 'T'], [a, b]);
    var forced = explicit && explicit !== 'deduce';

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">a is <code>' + esc(a) + '</code></span>' +
      '<span class="stat-pill a">b is <code>' + esc(b) + '</code></span>' +
      '<span class="stat-pill ' + (forced || !r.fails ? 'b' : 'c') + '">' +
        (forced ? 'T given explicitly' : (r.fails ? 'deduction fails' : 'T deduced')) +
      '</span></div>';

    h += '<pre class="pp-snippet">template&lt;typename T&gt;\n' +
      'const T &amp; max(const T &amp; a, const T &amp; b) {\n' +
      '  if (a &lt; b) { return b; } else { return a; }\n}</pre>';

    var call = forced ? 'max&lt;' + esc(explicit) + '&gt;(a, b)' : 'max(a, b)';
    h += '<div class="td-call">the call: <code>' + call + '</code></div>';

    if (forced) {
      var bothConvert = (explicit === a || explicit === b) ||
        (['int', 'double', 'char', 'bool'].indexOf(explicit) >= 0 &&
         ['int', 'double', 'char', 'bool'].indexOf(a) >= 0 &&
         ['int', 'double', 'char', 'bool'].indexOf(b) >= 0);
      h += '<div class="verdict ' + (bothConvert ? 'safe' : 'warn') + '">' +
        'You have said <strong>T = ' + esc(explicit) + '</strong>, so there is nothing to deduce. ' +
        (bothConvert
          ? 'Both arguments convert to it, so the call compiles — and any conversion happens at the ' +
            'call, which is worth knowing if it loses precision.'
          : 'Whether it compiles now depends on whether both arguments convert to <code>' +
            esc(explicit) + '</code>.') +
        '</div>';
    } else {
      h += '<div class="verdict ' + (r.fails ? 'bad' : 'safe') + '">' + r.why + '</div>';
    }

    if (!r.fails && !forced) {
      h += '<div class="td-inst"><div class="pp-cap">what the compiler generates</div>' +
        '<pre class="pp-snippet">' +
        esc(tdInstantiate('const T & max(const T & a, const T & b)', r.deduced)) +
        '</pre><div class="pp-note">One function is produced per set of template arguments actually ' +
        'used. That is why templates live in headers — the compiler needs the body at the point of ' +
        'use, not just a signature.</div></div>';
    }

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">Deduction does not convert</div>' +
      'Given <code>int a</code> and <code>double b</code>, deduction does not decide that ' +
      '<code>double</code> is the wider type and promote. <strong>T appears twice, so the two ' +
      'answers have to agree</strong>, and when they do not the compiler stops rather than choosing. ' +
      'Say <code>max&lt;double&gt;(a, b)</code> if that is what you meant, or give the template two ' +
      'parameters and decide the return type yourself.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · range-for and what it desugars to ---------- */

  function runRangeFor() {
    var out = document.getElementById('rf-output');
    if (!out) return;
    var container = ((document.getElementById('rf-container') || {}).value) || 'vector<int>';
    var kind = ((document.getElementById('rf-kind') || {}).value) || 'ref';
    var type = ((document.getElementById('rf-type') || {}).value) || 'int';

    var r = rfBind(container, { kind: kind, type: type });
    if (!r.ok) return ppBad('rf-output', r);

    var declared = kind.indexOf('auto') >= 0 ? 'auto' : type;
    var loop = 'for (' +
      (kind === 'constref' || kind === 'constautoref' ? 'const ' : '') + declared +
      (kind === 'ref' || kind === 'autoref' || kind === 'constref' || kind === 'constautoref'
        ? ' & ' : ' ') + 'elem : c) { ... }';

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + esc(container) + '</span>' +
      '<span class="stat-pill a">yields <code>' + esc(r.yields) + '</code></span>' +
      (r.isAuto ? '<span class="stat-pill a">auto = <code>' + esc(r.autoIs) + '</code></span>' : '') +
      '<span class="stat-pill ' + (r.legal ? 'b' : 'c') + '">' +
        (r.legal ? 'binds' : 'does not compile') + '</span></div>';

    h += '<pre class="pp-snippet">' + esc(loop) + '</pre>';
    h += '<div class="verdict ' + (r.legal ? (r.copies ? 'warn' : 'safe') : 'bad') + '">' +
      r.why + '</div>';

    h += '<div class="rf-elem"><div class="pp-cap">what one element actually is</div>' +
      '<code>' + esc(r.elem) + '</code><div class="pp-note">' + r.note + '</div></div>';

    h += '<div class="rf-desugar"><div class="pp-cap">the same loop, written out</div>' +
      '<pre class="pp-snippet">' + esc(r.desugared) + '</pre>' +
      '<div class="pp-note">A range-for is exactly this. There is no magic in it: anything with a ' +
      '<code>begin()</code> and an <code>end()</code> can be looped over this way, including classes ' +
      'you write yourself.</div></div>';

    if (container === 'map<int,string>' && kind === 'ref' && type === 'pair<int, string>') {
      h += '<div class="callout warn" style="margin:14px 0;">' +
        '<div class="callout-label">This is the line on slide 61, and it does not compile</div>' +
        'The slide writes <code>for (pair&lt;int,string&gt; &amp; elem : kNumbers)</code>. A map ' +
        'element is a <code>pair&lt;const int, string&gt;</code> — the key is const, because a map ' +
        'is a search tree ordered by it and changing a key in place would leave the tree wrong. So ' +
        'there is no <code>pair&lt;int, string&gt;</code> anywhere for that reference to name.<br><br>' +
        'Three things work: drop the <code>&amp;</code> and take a copy; write the type out in full ' +
        'as <code>const pair&lt;const int, string&gt; &amp;</code>; or use <code>auto &amp;</code>, ' +
        'which is what the slides themselves recommend nine slides earlier and is the reason ' +
        '<code>auto</code> earns its place.</div>';
    }

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · containers and iterators ---------- */

  function ctPreset(which) {
    var el = document.getElementById('ct-preset');
    if (el) el.value = which;
    runContainer();
  }

  function runContainer() {
    var out = document.getElementById('ct-output');
    if (!out) return;
    var which = ((document.getElementById('ct-preset') || {}).value) || 'listInsert';
    var p = CT_PRESETS[which];
    if (!p) return ppBad('ct-output', { error: 'Unknown scenario.' });

    var r = ctRun(p.kind, p.ops);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">std::' + esc(p.kind) + '</span>' +
      '<span class="stat-pill a">' + r.steps.length + ' steps</span>' +
      '<span class="stat-pill ' + (r.errors.length ? 'c' : 'b') + '">' +
        (r.errors.length ? r.errors.length + ' refused' : 'all legal') + '</span></div>';

    if (r.errors.length) {
      h += '<div class="verdict bad"><ul style="margin:4px 0 0;">' +
        r.errors.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul></div>';
    }

    h += '<div class="ct-steps">';
    r.steps.forEach(function (st, i) {
      h += '<div class="ct-step" data-step="' + i + '">' +
        '<div class="ct-op">' + esc(ctOpText(st.op, p.kind)) + '</div>' +
        '<div class="ct-row">' + st.items.map(function (v, idx) {
          var here = st.iters.filter(function (it) { return it.at === idx; });
          return '<div class="ct-cell' + (here.length ? ' pointed' : '') + '">' +
            '<span class="ct-val">' + esc(v) + '</span>' +
            (here.length ? '<span class="ct-ptr">' + here.map(function (it) {
              return esc(it.name);
            }).join('<br>') + '</span>' : '') + '</div>';
        }).join('') +
        '<div class="ct-cell end' +
          (st.iters.some(function (it) { return it.atEnd; }) ? ' pointed' : '') + '">' +
          '<span class="ct-val">end()</span>' +
          (st.iters.some(function (it) { return it.atEnd; })
            ? '<span class="ct-ptr">' + st.iters.filter(function (it) { return it.atEnd; })
                .map(function (it) { return esc(it.name); }).join('<br>') + '</span>'
            : '') + '</div>' +
        '</div>' +
        '<div class="pp-note">' + st.note + '</div></div>';
    });
    h += '</div>';

    h += '<div class="pp-foot">' + ctLesson(which) + '</div>';
    out.innerHTML = h;
  }

  function ctOpText(op, kind) {
    switch (op.kind) {
      case 'push':    return kind === 'map' ? 'emplace(' + op.key + ', ' + op.value + ')'
                                            : (kind === 'set' ? 'insert(' + op.key + ')'
                                                              : 'push_back(' + op.key + ')');
      case 'assign':  return '[' + op.key + '] = ' + op.value;
      case 'begin':   return 'auto ' + op.name + ' = c.begin();';
      case 'end':     return 'auto ' + op.name + ' = c.end();';
      case 'advance': return op.by === 1 ? '++' + op.name + ';'
                                         : 'auto ' + op.name + ' = c.begin() + ' + op.by + ';';
      case 'deref':   return 'cout << *' + op.name + ';';
      case 'insert':  return 'auto ' + (op.result || 'newItr') + ' = c.insert(' + op.name + ', ' +
                             op.key + ');';
      case 'erase':   return 'auto ' + (op.result || 'newItr') + ' = c.erase(' + op.name + ');';
      case 'find':    return 'auto ' + op.name + ' = c.find(' + op.key + ');';
    }
    return '';
  }

  function ctLesson(which) {
    var lessons = {
      listInsert: 'Insert puts the new element <strong>before</strong> the iterator, and hands you ' +
        'an iterator to what it just inserted — which is the only reliable way to keep hold of it.',
      listErase: 'Erase invalidates the iterator you gave it, and returns one pointing at whatever ' +
        'is now in that position. That return value is what makes ' +
        '<code>itr = c.erase(itr);</code> the correct way to remove while looping — and why ' +
        '<code>++itr</code> after an erase is a bug.',
      vectorJump: 'A vector stores its elements contiguously, so its iterator can move any distance ' +
        'in one step. <code>begin() + 2</code> is a real address calculation.',
      listJump: 'A list is nodes joined by pointers, so there is no arithmetic to do — you have to ' +
        'follow the links one at a time. This is the difference the two containers are really ' +
        'about, and it is why <code>+</code> is defined for one and not the other.',
      endDeref: '<code>end()</code> points <em>past</em> the last element. For a vector of size 10 ' +
        'the elements are 0 to 9 and <code>end()</code> is the position 10, which holds nothing. ' +
        'It exists to be compared against, not read.',
      mapEmplace: 'Adding a key that is already present does <strong>nothing</strong> — it does not ' +
        'overwrite. <code>emplace</code> returns a <code>pair&lt;iterator, bool&gt;</code>, and the ' +
        'bool is how you find out which happened. This surprises people who expect a map to behave ' +
        'like an assignment.',
      mapAssign: '<code>operator[]</code> does overwrite, and creates the entry if it is missing. ' +
        'It is also the reason <code>m[k]</code> on a const map does not compile: it might insert.',
      mapFind: '<code>find</code> returns <code>end()</code> when there is no match, so the ' +
        'comparison against <code>end()</code> comes first and the dereference second. Getting that ' +
        'order wrong reads memory past the end of the container.',
      setOrder: 'A set keeps itself sorted and holds each value once. Both properties come from the ' +
        'same place: it is a search tree ordered by <code>&lt;</code>, so equal elements have ' +
        'nowhere separate to go.'
    };
    return lessons[which] || '';
  }
