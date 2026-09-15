  /* ============================================================
     SCALA TOPIC 05 · rendering
     ============================================================ */

  /* ---------- Tool 1 · a DFA, one character at a time ---------- */

  var daCurrent = 'worked', daInput = 'abaaa';

  function runDFA(which, input) {
    var out = document.getElementById('da-output');
    if (!out) return;
    var picked = ((document.getElementById('da-machine') || {}).value) || 'worked';
    if (picked !== daCurrent) {
      /* A different machine wants a string it can actually read. */
      daCurrent = picked;
      daInput = picked === 'worked' ? 'abaaa' : (picked === 'partial' ? 'ab' : 'abba');
      var box0 = document.getElementById('da-input');
      if (box0) box0.value = daInput;
    } else {
      var box = document.getElementById('da-input');
      if (box) daInput = box.value;
    }
    var m = DA_MACHINES[daCurrent] || DA_MACHINES.worked;

    var h = '';

    /* The five things it is. */
    h += '<div class="da-tuple"><div class="pp-cap">A(Σ, Qs, Q₀, F, δ)</div>' +
      '<table class="pp-table"><tbody>' +
      '<tr><td>Σ</td><td>the alphabet</td><td><code>{' + m.alphabet.join(', ') + '}</code></td></tr>' +
      '<tr><td>Qs</td><td>the states</td><td><code>{' + m.states.join(', ') + '}</code></td></tr>' +
      '<tr><td>Q₀</td><td>where it starts</td><td><code>' + esc(m.start) + '</code></td></tr>' +
      '<tr><td>F</td><td>which ones accept</td><td><code>{' + m.accepting.join(', ') +
        '}</code></td></tr>' +
      '<tr><td>δ</td><td>state and character to state</td><td>below</td></tr>' +
      '</tbody></table></div>';

    /* δ as a table, with gaps shown as gaps. */
    h += '<table class="da-delta"><thead><tr><th>δ</th>';
    m.alphabet.forEach(function (c) { h += '<th>' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    m.states.forEach(function (s) {
      h += '<tr><td class="da-state">' + esc(s) +
        (s === m.start ? ' <span class="da-mark">start</span>' : '') +
        (m.accepting.indexOf(s) >= 0 ? ' <span class="da-mark acc">accept</span>' : '') + '</td>';
      m.alphabet.forEach(function (c) {
        var to = (m.delta[s] || {})[c];
        h += '<td>' + (to === undefined ? '<span class="da-gap">—</span>' : esc(to)) + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table>';

    var r = daRun(m, daInput);
    if (!r.ok) {
      out.innerHTML = h + '<div class="verdict bad">' + r.error + '</div>';
      return;
    }

    h += '<div class="rd-stats">' +
      '<span class="stat-pill a">input <code>' + esc(daInput || 'ε') + '</code></span>' +
      (r.stuck
        ? '<span class="stat-pill c">stuck</span>'
        : '<span class="stat-pill a">ends in ' + esc(r.end) + '</span>') +
      '<span class="stat-pill ' + (r.accepted ? 'b' : 'c') + '">' +
        (r.accepted ? 'accepted' : 'rejected') + '</span></div>';

    /* The run, as a row of states with the characters between them. */
    h += '<div class="da-run">';
    r.steps.forEach(function (st, i) {
      if (i > 0) {
        h += '<span class="da-arrow">' + esc(st.read) + ' &rarr;</span>';
      }
      if (st.to === null) {
        h += '<span class="da-node stuck">stuck</span>';
      } else {
        h += '<span class="da-node' +
          (m.accepting.indexOf(st.to) >= 0 ? ' acc' : '') + '">' + esc(st.to) + '</span>';
      }
    });
    h += '</div>';

    h += '<div class="verdict ' + (r.accepted ? 'safe' : (r.stuck ? 'bad' : 'warn')) + '">' +
      (r.stuck
        ? 'There is no entry in δ for <code>' + esc(r.steps[r.steps.length - 1].read) +
          '</code> in state <code>' + esc(r.steps[r.steps.length - 1].state) + '</code>, so the ' +
          'machine has nowhere to go. A partial δ is allowed, and getting stuck means the string ' +
          'is rejected — no special case needed.'
        : r.accepted
          ? 'It ends in <code>' + esc(r.end) + '</code>, which is in F, so the string is accepted.'
          : 'It ends in <code>' + esc(r.end) + '</code>, which is not in F. The machine read the ' +
            'whole string; it simply did not finish anywhere that accepts.') +
      '</div>';

    /* Which short strings this machine accepts — computed by running it. */
    var accepted = daStrings(m.alphabet, 4).filter(function (s) {
      var rr = daRun(m, s);
      return rr.ok && rr.accepted;
    });
    h += '<div class="da-lang"><div class="pp-cap">every string up to length 4 that it accepts</div>' +
      (accepted.length
        ? accepted.map(function (s) {
            return '<code>' + (s === '' ? 'ε' : esc(s)) + '</code>';
          }).join(' ')
        : '<span class="pp-note">none</span>') +
      '<div class="pp-note">' + accepted.length + ' of ' + daStrings(m.alphabet, 4).length +
      ', worked out by running the machine on each.</div></div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">' + m.label + '</div>' + m.note + '</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · nondeterminism as a set of states ---------- */

  var naCurrent = 'worked', naInput = 'aab';

  function runNFA(which) {
    var out = document.getElementById('na-output');
    if (!out) return;
    var picked = ((document.getElementById('na-machine') || {}).value) || 'worked';
    if (picked !== naCurrent) {
      naCurrent = picked;
      naInput = 'aab';
      var box0 = document.getElementById('na-input');
      if (box0) box0.value = naInput;
    } else {
      var box = document.getElementById('na-input');
      if (box) naInput = box.value;
    }
    var m = NA_MACHINES[naCurrent] || NA_MACHINES.worked;

    var h = '';

    h += '<table class="da-delta"><thead><tr><th>δ</th>';
    m.alphabet.forEach(function (c) { h += '<th>' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    m.states.forEach(function (s) {
      h += '<tr><td class="da-state">' + esc(s) +
        (s === m.start ? ' <span class="da-mark">start</span>' : '') +
        (m.accepting.indexOf(s) >= 0 ? ' <span class="da-mark acc">accept</span>' : '') + '</td>';
      m.alphabet.forEach(function (c) {
        var to = (m.delta[s] || {})[c];
        h += '<td>' + (!to || !to.length
          ? '<span class="da-gap">∅</span>'
          : '{' + to.map(esc).join(', ') + '}') + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table>';

    var r = naRun(m, naInput);
    if (!r.ok) {
      out.innerHTML = h + '<div class="verdict bad">' + r.error + '</div>';
      return;
    }

    h += '<div class="rd-stats">' +
      '<span class="stat-pill a">input <code>' + esc(naInput || 'ε') + '</code></span>' +
      '<span class="stat-pill a">ends in {' + r.end.join(', ') + '}</span>' +
      '<span class="stat-pill ' + (r.accepted ? 'b' : 'c') + '">' +
        (r.accepted ? 'accepted' : 'rejected') + '</span></div>';

    h += '<table class="up-trace"><thead><tr><th>read</th><th>could be in</th>' +
      '</tr></thead><tbody>';
    r.steps.forEach(function (st, i) {
      h += '<tr data-step="' + i + '"><td><code>' +
        (st.read === null ? 'start' : esc(st.read)) + '</code></td>' +
        '<td>' + (st.after.length
          ? st.after.map(function (s) {
              return '<span class="da-node' +
                (m.accepting.indexOf(s) >= 0 ? ' acc' : '') + '">' + esc(s) + '</span>';
            }).join(' ')
          : '<span class="da-node stuck">∅ — nowhere</span>') + '</td></tr>';
    });
    h += '</tbody></table>';

    h += '<div class="verdict ' + (r.accepted ? 'safe' : 'warn') + '">' +
      (r.dead
        ? 'Every possibility died. There is no path through the machine for this string.'
        : r.accepted
          ? 'One of the states it could be in is an accepting one, and that is all acceptance ' +
            'means for an NFA: <em>some</em> path works.'
          : 'It could be in {' + r.end.join(', ') + '}, none of which accept.') +
      '<br><br>Note what this did <strong>not</strong> do: try one path, fail, and start again. ' +
      'Carrying the set of possible states explores all of them at once, in one pass — which is ' +
      'exactly what the backtracking matcher in the previous topic was failing to do.</div>';

    /* The DFA the subset construction gives. */
    var d = naSubset(m);
    h += '<div class="na-subset"><div class="pp-cap">the DFA this becomes — one state per set</div>';
    h += '<table class="da-delta"><thead><tr><th>δ</th>';
    d.alphabet.forEach(function (c) { h += '<th>' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    d.states.forEach(function (s) {
      h += '<tr><td class="da-state">{' + esc(s) + '}' +
        (s === d.start ? ' <span class="da-mark">start</span>' : '') +
        (d.accepting.indexOf(s) >= 0 ? ' <span class="da-mark acc">accept</span>' : '') + '</td>';
      d.alphabet.forEach(function (c) {
        h += '<td>{' + esc(d.delta[s][c]) + '}</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table>';
    h += '<div class="pp-note">' + m.states.length + ' states became ' + d.states.length +
      '. Doing this once in advance is what turns "explore every possibility as you go" into ' +
      'an ordinary deterministic machine — and the test suite checks the two accept exactly the ' +
      'same strings, by trying every string up to length 10.</div></div>';

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">' + m.label + '</div>' + m.note + '</div>';

    out.innerHTML = h;
  }
