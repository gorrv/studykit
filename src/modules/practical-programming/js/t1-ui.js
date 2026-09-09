  /* ============================================================
     TOPIC 01 · rendering for the four tools
     ============================================================ */

  function ppBad(outId, r) {
    var out = document.getElementById(outId);
    if (out) out.innerHTML = '<div class="verdict bad">' + r.error + '</div>';
  }

  /* ---------- Tool 1 · the value-and-reference tracer ---------- */

  function cppPreset(which) {
    var el = document.getElementById('tr-text');
    if (el) el.value = CPP_PRESETS[which] || CPP_PRESETS.copy;
    runTrace();
  }

  /** Objects as boxes, names as labels pointing at them. */
  function ppMemory(step) {
    var live = step.heap.filter(function (o) { return true; });
    if (!live.length) return '';
    var h = '<div class="pp-mem">';
    live.forEach(function (o) {
      var names = (step.aliases[o.id] || []);
      h += '<div class="pp-obj' + (names.length ? '' : ' dead') +
        (names.length > 1 ? ' shared' : '') + '">' +
        '<div class="pp-obj-id">#' + o.id + '</div>' +
        '<div class="pp-obj-val">x = ' + o.x + '<br>y = ' + o.y + '</div>' +
        '<div class="pp-obj-names">' + (names.length
          ? names.map(function (n) {
              var e = step.env.filter(function (v) { return v.name === n; })[0] || {};
              return '<span class="pp-name' + (e.isRef ? ' ref' : '') +
                (e.isConst ? ' const' : '') + '">' + esc(n) +
                (e.isRef ? ' &amp;' : '') + '</span>';
            }).join('')
          : '<span class="pp-none">no name</span>') + '</div>' +
        '<div class="pp-obj-born">' + esc(o.born) + '</div></div>';
    });
    return h + '</div>';
  }

  function runTrace() {
    var out = document.getElementById('tr-output');
    if (!out) return;
    var el = document.getElementById('tr-text');
    var prog = cppParse((el ? el.value : '') || CPP_PRESETS.copy);
    if (!prog.ok) return ppBad('tr-output', prog);

    var run = cppRun(prog);
    if (!run.ok) return ppBad('tr-output', run);
    var src = cppToSource(prog);

    var copies = run.heap.filter(function (o) { return /copied/.test(o.born); }).length;

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + run.heap.length + ' object' +
        (run.heap.length === 1 ? '' : 's') + ' created</span>' +
      '<span class="stat-pill a">' + copies + ' of them copies</span>' +
      '<span class="stat-pill ' + (run.compiles ? 'b' : 'c') + '">' +
        (run.compiles ? 'compiles' : 'does not compile') + '</span></div>';

    if (!run.compiles) {
      h += '<div class="verdict bad"><strong>This does not compile.</strong><ul style="margin:6px 0 0;">' +
        run.errors.map(function (e) {
          return '<li>Line ' + e.line + ': ' + e.msg + '</li>';
        }).join('') + '</ul></div>';
    } else {
      h += '<div class="verdict safe">Output:<br>' +
        (run.out.length
          ? '<code class="pp-out">' + run.out.map(esc).join('<br>') + '</code>'
          : '<em>nothing printed</em>') + '</div>';
    }

    h += '<div class="pp-steps" id="tr-trace">';
    run.steps.forEach(function (st, i) {
      h += '<div class="pp-step" data-step="' + i + '">' +
        '<div class="pp-code">' + esc(st.stmt.src || '') + '</div>' +
        ppMemory(st) +
        '<div class="pp-note">' + st.note + '</div>' +
        (st.out.length ? '<div class="pp-sofar">printed so far: ' +
          st.out.map(esc).join(', ') + '</div>' : '') +
        '</div>';
    });
    h += '</div>';

    h += '<details class="pp-src"><summary>the same program as real C++</summary><pre>' +
      esc(src.source) + '</pre>' +
      '<div class="pp-foot">Compile it with <code>g++ -std=c++11 -o demo demo.cc</code> and run ' +
      '<code>./demo</code>. This module’s test suite does exactly that on every run and compares the ' +
      'output against the trace above — the tracer is only worth trusting for as long as it keeps ' +
      'agreeing with a real compiler.</div></details>';

    out.innerHTML = h;
    ixTrace('tr', 'tr-output', { label: 'statement', reset: true });
  }

  /* ---------- Tool 2 · member initialisation ---------- */

  function runMemberInit() {
    var out = document.getElementById('mi-output');
    if (!out) return;
    var opts = {
      memberHasDefault: ((document.getElementById('mi-default') || {}).value) === 'yes',
      memberIsConst: ((document.getElementById('mi-const') || {}).value) === 'yes',
      style: ((document.getElementById('mi-style') || {}).value) || 'list'
    };
    var r = miCheck(opts);
    var gen = miGenerate(opts);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + (opts.style === 'list' ? 'initialiser list' : 'assign in the body') +
        '</span>' +
      '<span class="stat-pill a">member ' + (opts.memberHasDefault ? 'has' : 'has no') +
        ' default constructor</span>' +
      (opts.memberIsConst ? '<span class="stat-pill a">const member</span>' : '') +
      '<span class="stat-pill ' + (r.compiles ? 'b' : 'c') + '">' +
        (r.compiles ? 'compiles' : 'does not compile') + '</span></div>';

    h += '<pre class="pp-snippet">' + esc(gen.source.split('class Journey')[1]
      ? 'class Journey' + gen.source.split('class Journey')[1].split('int main')[0].trim()
      : gen.source) + '</pre>';

    h += '<div class="verdict ' + (r.compiles ? (r.wasteful ? 'warn' : 'safe') : 'bad') + '">' +
      r.note + '</div>';

    h += '<div class="pp-order"><div class="pp-cap">what actually happens to the member</div><ol>' +
      r.order.map(function (o) { return '<li>' + o + '</li>'; }).join('') + '</ol></div>';

    if (r.reasons.length > 1) {
      h += '<div class="pp-foot">More than one thing is wrong here: ' +
        r.reasons.join('; and ') + '.</div>';
    }

    h += '<div class="callout warn" style="margin:14px 0;">' +
      '<div class="callout-label">The rule is not "assignment in the body is illegal"</div>' +
      'The slides show one Journey that compiles and one that does not, which reads as a rule about ' +
      'where you put the assignment. It is not. <strong>Members are constructed before the ' +
      'constructor body runs.</strong> Everything follows from that:<br><br>' +
      '• No default constructor on the member? Then there is nothing to construct it <em>with</em>, ' +
      'and the body version cannot compile. That is the deck’s Journey.<br>' +
      '• A default constructor exists? The body version compiles — and default-constructs, then ' +
      'assigns over it. Two operations where the list does one. Set the switches above to see it.<br>' +
      '• A <code>const</code> member, or a reference member? The list is the only option, whatever ' +
      'the defaults, because neither can be assigned after the fact.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · operators ---------- */

  function runOperators() {
    var out = document.getElementById('op-output');
    if (!out) return;
    var where = ((document.getElementById('op-where') || {}).value) || 'member';
    var ret = ((document.getElementById('op-return') || {}).value) || 'ostream&';

    var eq = opEqCheck(where);
    var sh = opShiftCheck(ret);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill ' + (eq.works ? 'b' : 'c') + '">a == b: ' +
        (eq.works ? 'resolves' : 'does not resolve') + '</span>' +
      '<span class="stat-pill ' + (sh.chains ? 'b' : 'c') + '">chaining: ' +
        (sh.chains ? 'works' : 'breaks') + '</span></div>';

    h += '<div class="pp-two"><div class="pp-half">' +
      '<div class="pp-cap">operator== &nbsp;·&nbsp; <code>Alice a; Bob b; a == b;</code></div>' +
      '<pre class="pp-snippet">' + esc(eq.decl) + '</pre>' +
      '<div class="pp-verdict ' + (eq.works ? 'yes' : 'no') + '">' +
        (eq.works ? 'resolves' : 'does not resolve') + '</div>' +
      '<div class="pp-note">' + eq.note + '</div></div>';

    h += '<div class="pp-half">' +
      '<div class="pp-cap">operator&lt;&lt; &nbsp;·&nbsp; <code>cout &lt;&lt; "It is at " &lt;&lt; a &lt;&lt; endl;</code></div>' +
      '<pre class="pp-snippet">' + esc(ret) + ' operator&lt;&lt;(ostream &amp; o, const Coordinate &amp; rhs)</pre>' +
      '<div class="pp-expand">reads as ' + sh.expansion + '</div>' +
      '<div class="pp-verdict ' + (sh.chains ? 'yes' : 'no') + '">' +
        (sh.chains ? 'chains' : 'breaks after the first shift') + '</div>' +
      '<div class="pp-note">' + sh.note + '</div></div></div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">The recipe, and why there are two forms</div>' +
      'For <code>a == b</code> with a of type A and b of type B, provide <em>one</em> of:<br>' +
      '<code>class A { public: bool operator==(const B &amp; rhs) const; };</code><br>' +
      '<code>bool operator==(const A &amp; lhs, const B &amp; rhs);</code><br><br>' +
      'The member form puts the operator on the <strong>left-hand</strong> type, because ' +
      '<code>a == b</code> means <code>a.operator==(b)</code>. That is fine until the left-hand type ' +
      'is one the system gave you and you cannot edit — which is the situation slide 52 describes. ' +
      'The free function needs nobody’s permission, which is why it is the general answer.<br><br>' +
      'Both take the right-hand side by <strong>const reference</strong>: no copy, and a promise not ' +
      'to modify what you were only asked to compare. The member form is <code>const</code> too, so ' +
      'that comparing works on const objects — <em>const is contagious</em>, and comparison is where ' +
      'people first meet that.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 4 · coming from Java ---------- */

  function runContrast() {
    var out = document.getElementById('jc-output');
    if (!out) return;
    var h = '<div class="rd-stats"><span class="stat-pill a">' + PP_CONTRASTS.length +
      ' places the two languages part company</span></div>';

    h += '<div class="jc-list">';
    PP_CONTRASTS.forEach(function (c) {
      h += '<div class="jc-item"><div class="jc-topic">' + esc(c.topic) + '</div>' +
        '<div class="jc-pair">' +
          '<div class="jc-side java"><div class="jc-lang">Java</div><code>' + esc(c.java) + '</code></div>' +
          '<div class="jc-side cpp"><div class="jc-lang">C++</div><code>' + esc(c.cpp) + '</code></div>' +
        '</div>' +
        '<div class="jc-note">' + c.note + '</div></div>';
    });
    h += '</div>';

    h += '<div class="pp-foot">The one to actually internalise is the second. Every other difference ' +
      'announces itself — a missing <code>new</code> will not compile, a null check that cannot fail ' +
      'is harmless. <code>Coordinate b = a;</code> compiles in both languages, means something ' +
      'different in each, and says nothing about it either way.</div>';

    out.innerHTML = h;
  }
