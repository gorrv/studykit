  /* ============================================================
     TURING MACHINES (Topic 01)

     One tape, infinite in both directions, one head that can read,
     write and move one cell either way. The transition function is

         (state, symbol read)  ->  (new state, symbol written, move)

     and a configuration is written the way the notes write it:
     (state, everything left of the head, everything from the head
     rightwards).

     The interesting difference from a finite automaton is that a run
     need not end. A DFA reads its input and stops; a Turing machine
     can wander forever. This simulator therefore has three outcomes,
     not two, and is careful about which one it claims:

       accept / reject   the machine halted in a halting state
       looping           the *identical* configuration came round
                         again, so it provably runs forever
       no verdict        the step cap ran out — the machine may halt
                         later, and there is no general way to know

     That last distinction is the whole point of the topic and is
     worth keeping honest in the code: "we gave up" is not the same
     claim as "it never stops".
     ============================================================ */

  /** The blank symbol. Typed as `_`, shown as the usual open box. */
  var TM_BLANK = '␣';

  /**
   * Parse a machine written one instruction per line:
   *
   *   start:  qinit
   *   accept: qacc
   *   reject: qrej
   *   qinit  a  q1  _  >
   *
   * reading as "in qinit, seeing a, go to q1, write a blank, move
   * right". Use `_` for the blank and `>` / `<` for the moves.
   *
   * @returns {{ok: true, m: object} | {ok: false, error: string}}
   */
  function tmParse(text) {
    var lines = String(text).split(/\n/);
    var start = null, accept = null, reject = null;
    var delta = {}, states = {}, tape = {}, rules = 0;

    for (var i = 0; i < lines.length; i++) {
      // Comments start with `;`, not `#` — `#` is a perfectly good tape
      // symbol and one of the example machines uses it as a marker.
      var line = lines[i].replace(/;.*$/, '').trim();
      if (!line) continue;

      var head = line.match(/^(start|accept|reject)\s*:\s*(\S+)\s*$/i);
      if (head) {
        var q = head[2];
        states[q] = true;
        if (/start/i.test(head[1])) start = q;
        else if (/accept/i.test(head[1])) accept = q;
        else reject = q;
        continue;
      }

      var p = line.split(/[\s,]+/).filter(Boolean);
      if (p.length !== 5) {
        return { ok: false, error: 'Line ' + (i + 1) + ': an instruction needs five parts — ' +
          'state, symbol read, new state, symbol written, and <code>&gt;</code> or <code>&lt;</code>.' };
      }

      var from = p[0], read = p[1], to = p[2], write = p[3], move = p[4];
      if (read === '_') read = TM_BLANK;
      if (write === '_') write = TM_BLANK;

      if (move === '>' || move === '→' || move === 'r') move = 1;
      else if (move === '<' || move === '←' || move === 'l') move = -1;
      else return { ok: false, error: 'Line ' + (i + 1) + ': the move must be <code>&gt;</code> or <code>&lt;</code>, not <code>' + esc(p[4]) + '</code>.' };

      states[from] = true; states[to] = true;
      if (read !== TM_BLANK) tape[read] = true;
      if (write !== TM_BLANK) tape[write] = true;

      var row = delta[from] || (delta[from] = {});
      if (row[read]) {
        return { ok: false, error: 'Line ' + (i + 1) + ': <code>' + esc(from) + '</code> already has an ' +
          'instruction for <code>' + esc(p[1]) + '</code>. A deterministic machine may only have one.' };
      }
      row[read] = { to: to, write: write, move: move };
      rules++;
    }

    if (!start) return { ok: false, error: 'No start state. Add a line like <code>start: qinit</code>.' };
    if (!accept) return { ok: false, error: 'No accepting state. Add a line like <code>accept: qacc</code>.' };
    if (!rules) return { ok: false, error: 'No instructions yet.' };

    return { ok: true, m: {
      start: start, accept: accept, reject: reject,
      states: Object.keys(states),
      alphabet: Object.keys(tape).sort(),
      delta: delta,
      rules: rules,
    } };
  }

  /**
   * Run a machine on a word.
   *
   * The tape is an array that grows at either end as the head walks off
   * it, with `origin` recording where cell zero ended up so the display
   * can stay still while the tape moves under it.
   *
   * @param {number} cap  give up after this many steps
   * @returns {{verdict, steps, configs, tape, why}}
   */
  function tmRun(m, word, cap) {
    var limit = cap || 500;
    var tape = String(word).trim().split('');
    if (!tape.length) tape = [TM_BLANK];

    var head = 0, origin = 0, state = m.start, steps = 0;
    var configs = [], seen = {}, verdict = null, why = null;

    /** The tape as a string, with the blanks at each end trimmed off. */
    function shown() {
      var a = 0, b = tape.length - 1;
      while (a < b && tape[a] === TM_BLANK) a++;
      while (b > a && tape[b] === TM_BLANK) b--;
      return { from: a, to: b };
    }

    /** A configuration in the notes' notation: (state, left, right). */
    function snapshot() {
      var s = shown();
      var lo = Math.min(s.from, head), hi = Math.max(s.to, head);
      return {
        step: steps,
        state: state,
        left: tape.slice(lo, head).join(''),
        right: tape.slice(head, hi + 1).join(''),
        head: head - origin,
        read: tape[head],
      };
    }

    while (true) {
      if (head < 0) { tape.unshift(TM_BLANK); head = 0; origin++; }
      if (head >= tape.length) tape.push(TM_BLANK);

      configs.push(snapshot());

      if (state === m.accept) { verdict = 'accept'; break; }
      if (m.reject && state === m.reject) { verdict = 'reject'; break; }

      // An identical configuration means the machine is in a genuine
      // loop — same state, same tape, same head position, so it will do
      // exactly the same thing again, forever. This is provable; the
      // step cap below is not.
      var key = state + '|' + head + '|' + tape.join('');
      if (seen[key]) {
        verdict = 'looping';
        why = 'The machine came back to a configuration it had already been in, so it repeats forever.';
        break;
      }
      seen[key] = true;

      var row = m.delta[state];
      var rule = row && row[tape[head]];
      if (!rule) {
        // No instruction. Halting with nothing to do is a rejection,
        // but say so plainly rather than silently calling it one.
        verdict = 'stuck';
        why = 'No instruction for state <code>' + esc(state) + '</code> reading <code>' +
          esc(tape[head] === TM_BLANK ? '_' : tape[head]) + '</code>, so the machine halts here.';
        break;
      }

      tape[head] = rule.write;
      head += rule.move;
      state = rule.to;
      steps++;

      if (steps >= limit) {
        verdict = 'nolimit';
        why = 'Still running after ' + limit + ' steps. It may halt later — there is no way to tell in general.';
        break;
      }
    }

    var s = shown();
    return {
      verdict: verdict,
      why: why,
      steps: steps,
      configs: configs,
      state: state,
      tape: tape.slice(s.from, s.to + 1).join(''),
      halted: verdict === 'accept' || verdict === 'reject' || verdict === 'stuck',
    };
  }

  /** Just the answer: 1 accepts, 0 halts without accepting, null never halts. */
  function tmVerdict(m, word, cap) {
    var r = tmRun(m, word, cap);
    if (r.verdict === 'accept') return 1;
    if (r.verdict === 'reject' || r.verdict === 'stuck') return 0;
    return null;
  }

  /**
   * Classify every word over `alphabet` up to `maxLen`.
   *
   * Used to check a machine against a claim about what it decides, and
   * to find the shortest word it fails on — which is nearly always more
   * informative than a count.
   */
  function tmSurvey(m, alphabet, maxLen, cap) {
    var words = faWords(alphabet, maxLen);
    var out = { accept: [], reject: [], never: [] };
    for (var i = 0; i < words.length; i++) {
      var v = tmVerdict(m, words[i], cap);
      (v === 1 ? out.accept : v === 0 ? out.reject : out.never).push(words[i]);
    }
    return out;
  }

  /* ---------- rendering ---------- */

  var TM = { res: null, frame: 0, m: null };

  /** The transport bar's handler — IX.player emits onclick="tmStep(...)". */
  function tmStep(d, fromSlider) {
    if (!TM.res) return;
    var total = TM.res.configs.length;
    if (d === 'play') {
      IX.play('tm', total, function () { return TM.frame; },
        function (f) { TM.frame = f; tmPaint(); }, 380);
      tmPaint();
      return;
    }
    IX.stop('tm');
    if (d === 'first') TM.frame = 0;
    else if (d === 'last') TM.frame = total - 1;
    else if (typeof d === 'number' && fromSlider) TM.frame = d;
    else TM.frame = Math.max(0, Math.min(total - 1, TM.frame + d));
    tmPaint();
  }

  /** Jump straight to a configuration by clicking it. */
  function tmSet(i) {
    if (!TM.res) return;
    IX.stop('tm');
    TM.frame = Math.max(0, Math.min(i, TM.res.configs.length - 1));
    tmPaint();
  }

  /** The tape, with the cell under the head picked out and the state above it. */
  function tmTapeHtml(c) {
    var all = (c.left + c.right).split('');
    var headAt = c.left.length;
    var cells = '';
    for (var i = 0; i < all.length; i++) {
      cells += '<span class="tm-cell' + (i === headAt ? ' here' : '') + '">' +
        esc(all[i] === TM_BLANK ? '' : all[i]) + '</span>';
    }
    return '<div class="tm-tape"><div class="tm-head" style="margin-left:' + (headAt * 33) + 'px">' +
      esc(c.state) + '</div><div class="tm-cells">' + cells + '</div></div>';
  }

  function tmPaint() {
    var out = document.getElementById('tm-output');
    if (!out || !TM.res) return;
    var r = TM.res, c = r.configs[TM.frame];

    var html = tmTapeHtml(c);
    html += IX.player('tm', TM.frame, r.configs.length,
      'step <strong>' + c.step + '</strong> of ' + r.steps,
      [c.state === TM.m.accept ? 'done' : 'assign',
       '(' + esc(c.state) + ', ' + esc(c.left || 'ε') + ', ' + esc(c.right || 'ε') + ')']);

    html += '<div class="fa-configs">';
    var from = Math.max(0, TM.frame - 6), to = Math.min(r.configs.length, from + 13);
    if (from > 0) html += '<span class="fa-none">… ' + from + ' earlier …</span>';
    for (var i = from; i < to; i++) {
      var k = r.configs[i];
      html += '<span class="fa-config' + (i === TM.frame ? ' on' : '') + '" onclick="tmSet(' + i + ')">(' +
        esc(k.state) + ', ' + esc(k.left || 'ε') + ', ' + esc(k.right || 'ε') + ')</span>' +
        (i < to - 1 ? '<span class="fa-arrow">→</span>' : '');
    }
    if (to < r.configs.length) html += '<span class="fa-none">… ' + (r.configs.length - to) + ' more …</span>';
    html += '</div>';

    var verdicts = {
      accept:  ['', 'Accepted after ' + r.steps + ' steps. The tape now reads <code>' + esc(r.tape || 'ε') + '</code>.'],
      reject:  [' miss', 'Rejected after ' + r.steps + ' steps — it halted in the rejecting state.'],
      stuck:   [' miss', r.why],
      looping: [' warn', r.why + ' It has now run ' + r.steps + ' steps and never will halt.'],
      nolimit: [' warn', r.why],
    };
    var v = verdicts[r.verdict] || ['', ''];
    html += '<p class="xl-result' + v[0] + '">' + v[1] + '</p>';

    if (r.verdict === 'nolimit') {
      html += '<div class="callout warn"><div class="callout-label">This is the point of the topic</div>' +
        'The simulator cannot tell you whether this machine halts. Neither can any other program — ' +
        'that is the halting problem. All it can honestly report is that it gave up.</div>';
    }

    out.innerHTML = html;
  }

  function runTuring() {
    var out = document.getElementById('tm-output');
    if (!out) return;

    var src = (document.getElementById('tm-machine') || {}).value || '';
    var word = (document.getElementById('tm-word') || {}).value || '';
    var cap = parseInt((document.getElementById('tm-cap') || {}).value, 10);
    if (!isFinite(cap) || cap < 1) cap = 500;

    var p = tmParse(src);
    if (!p.ok) { out.innerHTML = '<div class="tool-error">' + p.error + '</div>'; return; }

    TM.m = p.m;
    TM.res = tmRun(p.m, word, cap);
    TM.frame = 0;
    tmPaint();
  }

  window.TM = TM;
  window.tmStep = tmStep;
  window.tmSet = tmSet;
  window.tmParse = tmParse;
  window.tmRun = tmRun;
  window.tmVerdict = tmVerdict;
  window.tmSurvey = tmSurvey;
