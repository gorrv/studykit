  /* ============================================================
     TOPIC 02 · rendering for the pointer and ownership tools
     ============================================================ */

  /* ---------- Tool 1 · is this initialisation legal? ---------- */

  function runPtrQuiz() {
    var out = document.getElementById('pq-output');
    if (!out) return;

    var raw = ((document.getElementById('pq-decl') || {}).value || 'string * h = &a;').trim();
    var m = /^string\s*(\*?)\s*(\w+)\s*=\s*(.+?);?$/.exec(raw);
    if (!m) {
      return ppBad('pq-output', { error: 'Write a declaration like <code>string * h = &amp;a;</code>' });
    }
    var declStars = m[1] === '*' ? 1 : 0;
    var r = ptCheck(declStars, m[3], PT_ENV);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">given <code>string a("Hello");</code></span>' +
      '<span class="stat-pill a">and <code>string * b = new string("Hello");</code></span>' +
      '<span class="stat-pill ' + (r.legal ? 'b' : 'c') + '">' +
        (r.legal ? 'legal' : 'not legal') + '</span></div>';

    h += '<pre class="pp-snippet">' + esc(raw) + '</pre>';
    h += '<div class="verdict ' + (r.legal ? 'safe' : 'bad') + '">' + r.why + '</div>';

    h += '<div class="pt-quiz"><div class="pp-cap">all six lines</div><table class="pt-table">' +
      '<tr><th></th><th>line</th><th>left is</th><th>right is</th><th></th></tr>';
    PT_QUIZ.forEach(function (q) {
      var res = ptCheck(q.decl, q.expr, PT_ENV);
      h += '<tr><td class="pt-tag">' + q.tag + '</td>' +
        '<td class="pt-src">' + esc(q.src) + '</td>' +
        '<td>' + ptName(res.lhs) + '</td>' +
        '<td>' + (res.rhs === undefined ? '—' : ptName(res.rhs)) + '</td>' +
        '<td class="' + (res.legal ? 'pp-ok' : 'pp-no') + '">' + (res.legal ? '✓' : '✗') + '</td></tr>';
    });
    h += '</table></div>';

    h += '<div class="pp-foot">Count the stars. <code>*</code> takes one off, <code>&amp;</code> puts ' +
      'one on, and both sides have to end up with the same number. There is no conversion between an ' +
      'object and its address — that is exactly the distinction a pointer exists to make.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · the Rule of Three ---------- */

  function rtPreset(which) {
    var set = function (id, v) { var e = document.getElementById(id); if (e) e.value = v; };
    if (which === 'default') { set('rt-copy', 'default'); set('rt-assign', 'default'); set('rt-dtor', 'no'); }
    if (which === 'leaky')   { set('rt-copy', 'deep'); set('rt-assign', 'deep'); set('rt-dtor', 'no'); }
    if (which === 'partial') { set('rt-copy', 'deep'); set('rt-assign', 'default'); set('rt-dtor', 'yes'); }
    if (which === 'correct') { set('rt-copy', 'deep'); set('rt-assign', 'deep-delete-guard'); set('rt-dtor', 'yes'); }
    runRuleOfThree();
  }

  function runRuleOfThree() {
    var out = document.getElementById('rt-output');
    if (!out) return;
    var opts = {
      copy: ((document.getElementById('rt-copy') || {}).value) || 'default',
      assign: ((document.getElementById('rt-assign') || {}).value) || 'default',
      dtor: ((document.getElementById('rt-dtor') || {}).value) === 'yes',
      scenario: ((document.getElementById('rt-scenario') || {}).value) || 'copy'
    };
    var sim = rtSimulate(opts);
    var advice = rtAdvice(opts);
    var gen = rtGenerate(opts);

    var kinds = {};
    sim.problems.forEach(function (p) { kinds[p.kind] = true; });

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + sim.blocks.length + ' string' +
        (sim.blocks.length === 1 ? '' : 's') + ' allocated</span>' +
      '<span class="stat-pill ' + (kinds.leak ? 'c' : 'b') + '">' +
        (kinds.leak ? sim.leaks + ' leaked' : 'no leak') + '</span>' +
      '<span class="stat-pill ' + (kinds['double-free'] ? 'c' : 'b') + '">' +
        (kinds['double-free'] ? 'double free' : 'no double free') + '</span>' +
      '<span class="stat-pill ' + (kinds['use-after-free'] ? 'c' : 'b') + '">' +
        (kinds['use-after-free'] ? 'use after free' : 'no use after free') + '</span></div>';

    // the memory picture
    h += '<div class="pp-cap">what is in memory</div><div class="rt-mem">';
    sim.blocks.forEach(function (b) {
      var owners = sim.objs.filter(function (o) { return o.ptr === b.id; })
        .map(function (o) { return o.name; });
      h += '<div class="rt-block' + (b.freed ? ' freed' : '') +
        (owners.length > 1 ? ' shared' : '') + (owners.length === 0 ? ' orphan' : '') + '">' +
        '<div class="rt-bid">block #' + b.id + '</div>' +
        '<div class="rt-btext">"' + esc(b.text) + '"</div>' +
        '<div class="rt-bown">' + (owners.length
          ? owners.map(function (n) { return '<span class="pp-name">' + esc(n) + '.str</span>'; }).join('')
          : '<span class="rt-lost">nothing points here</span>') + '</div></div>';
    });
    h += '</div>';

    if (sim.sharing.length) {
      h += '<div class="verdict warn">' + sim.sharing.map(function (s) {
        return '<strong>' + s.names.join(' and ') + '</strong> share block #' + s.block;
      }).join('; ') + '. One string, two owners — and each of them believes it owns it.</div>';
    }

    // what happened
    h += '<div class="rt-events"><div class="pp-cap">step by step</div>';
    sim.events.forEach(function (e) {
      h += '<div class="rt-ev"><span class="rt-who">' + esc(e.name) + '</span>' +
        '<span class="rt-what">' + e.what + '</span>' +
        '<span class="rt-detail">' + e.detail + '</span></div>';
    });
    sim.destroyed.forEach(function (d) {
      h += '<div class="rt-ev dtor"><span class="rt-who">~' + esc(d.name) + '</span>' +
        '<span class="rt-what">scope ends</span>' +
        '<span class="rt-detail">' + d.what + '</span></div>';
    });
    h += '</div>';

    if (sim.problems.length) {
      h += '<div class="verdict bad"><strong>' + sim.problems.length + ' problem' +
        (sim.problems.length === 1 ? '' : 's') + ':</strong><ul style="margin:6px 0 0;">' +
        sim.problems.map(function (p) {
          return '<li><strong>' + esc(p.kind.replace(/-/g, ' ')) + '</strong> — ' + p.msg + '</li>';
        }).join('') + '</ul></div>';
    } else {
      var expected = rtExpectedOutput(sim);
      h += '<div class="verdict safe">Nothing leaked, nothing freed twice.' +
        (expected ? ' It prints <code>' + expected.map(esc).join('</code>, <code>') + '</code>.' : '') +
        '</div>';
    }

    // the rule
    h += '<div class="rt-rule"><div class="pp-cap">the Rule of Three</div>' +
      '<div class="rt-three">' + RT_MEMBERS.map(function (mem) {
        var written = advice.writes.indexOf(mem.id) >= 0;
        return '<div class="rt-member' + (written ? ' on' : '') + '">' +
          '<div class="rt-mname">' + esc(mem.name) + '</div>' +
          '<code>' + esc(mem.sig) + '</code>' +
          '<div class="rt-mwhen">' + (written ? 'you wrote it' : 'the compiler’s') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="pp-note">' + advice.note + '</div></div>';

    h += '<details class="pp-src"><summary>the same class as real C++</summary><pre>' +
      esc(gen.source) + '</pre><div class="pp-foot">The test suite builds this with ' +
      '<code>g++ -fsanitize=address</code> on every run and checks that the leaks and double frees ' +
      'reported above are the ones that actually happen. All 36 combinations of the three switches ' +
      'are covered.</div></details>';

    out.innerHTML = h;
  }
