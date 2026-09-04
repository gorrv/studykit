  /* ============================================================
     TWO DIVIDE-AND-CONQUER ALGORITHMS (Topic 03)

     Divide) split into self-similar subproblems
     Conquer) solve them recursively
     Combine) put the answers back together

     The recurrences in the lectures are *claimed* to describe these
     algorithms. That claim is checkable: run the algorithm, count
     what it actually does, and compare the count to the recurrence.
     Both functions here therefore return their real work — every
     Hanoi move, every merge-sort comparison — rather than just a
     total, so the count and the recurrence can be put side by side.

     The merge-sort case is where it earns its keep. The slides give
     the exact recurrence

         T(n) = T(⌊n/2⌋) + T(⌈n/2⌉) + n

     and then a table computed from the *approximation*

         T(n) ≈ 2 T(⌈n/2⌉) + n

     which is a different sequence: they part company at n = 3 and
     stay apart. Both are worth having, and mixing them up silently
     is not, so hanoiCount and msRecurrence expose each separately.
     ============================================================ */

  /* ---------- Towers of Hanoi ---------- */

  /**
   * MOVETOWER(n, from, to), recorded move by move.
   *
   *   if n = 1        move the single disc
   *   otherwise       move n−1 to the spare, move the largest,
   *                   move the n−1 back on top
   *
   * @returns {{moves: Array<{disc, from, to}>, states, count}}
   */
  function hanoiRun(n, limit) {
    var cap = limit || 4096;
    var moves = [];
    var pegs = [[], [], []];
    for (var d = n; d >= 1; d--) pegs[0].push(d);      // largest at the bottom

    var states = [pegs.map(function (p) { return p.slice(); })];
    var overflow = false;

    function move(from, to) {
      if (moves.length >= cap) { overflow = true; return; }
      var disc = pegs[from].pop();
      pegs[to].push(disc);
      moves.push({ disc: disc, from: from, to: to });
      states.push(pegs.map(function (p) { return p.slice(); }));
    }

    function tower(k, from, to) {
      if (overflow) return;
      if (k === 1) { move(from, to); return; }
      var spare = 3 - from - to;
      tower(k - 1, from, spare);
      move(from, to);
      tower(k - 1, spare, to);
    }

    if (n >= 1) tower(n, 0, 2);
    return { moves: moves, states: states, count: moves.length, overflow: overflow, n: n };
  }

  /**
   * Was that a legal solution?
   *
   * Replays the moves against the rules — one disc at a time, never
   * onto a smaller one — and checks the tower really ends up on peg
   * 3. Without this the move count would be a number with nothing
   * behind it.
   */
  function hanoiCheck(n, moves) {
    var pegs = [[], [], []];
    for (var d = n; d >= 1; d--) pegs[0].push(d);

    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var top = pegs[m.from][pegs[m.from].length - 1];
      if (top === undefined) return { ok: false, why: 'move ' + (i + 1) + ' takes a disc from an empty peg' };
      if (top !== m.disc) return { ok: false, why: 'move ' + (i + 1) + ' moves a disc that is not on top' };
      var onto = pegs[m.to][pegs[m.to].length - 1];
      if (onto !== undefined && onto < m.disc) {
        return { ok: false, why: 'move ' + (i + 1) + ' puts disc ' + m.disc + ' on the smaller disc ' + onto };
      }
      pegs[m.from].pop();
      pegs[m.to].push(m.disc);
    }

    if (pegs[2].length !== n) return { ok: false, why: 'the tower did not all arrive on peg 3' };
    for (var j = 0; j < n; j++) if (pegs[2][j] !== n - j) return { ok: false, why: 'peg 3 is out of order' };
    return { ok: true };
  }

  /** The recurrence the lectures claim: T(1) = 1, T(n) = 2T(n−1) + 1. */
  function hanoiRecurrence(n) {
    var t = 1;
    for (var i = 2; i <= n; i++) t = 2 * t + 1;
    return t;
  }

  /* ---------- merge sort ---------- */

  /**
   * MERGESORT, counting the comparisons the merge step actually makes.
   *
   * The lectures charge n for the combine step, which is the length
   * of the merged result — an upper bound on the comparisons, since
   * a merge stops comparing once one side runs out. Both numbers are
   * returned so the difference is visible instead of assumed away.
   *
   * @returns {{sorted, comparisons, merged, depth, trace}}
   */
  function msRun(arr) {
    var comparisons = 0, merged = 0, trace = [];

    function sort(a, depth) {
      if (a.length <= 1) return a.slice();
      var mid = Math.floor(a.length / 2);
      var L = sort(a.slice(0, mid), depth + 1);
      var R = sort(a.slice(mid), depth + 1);

      var out = [], i = 0, j = 0;
      while (i < L.length && j < R.length) {
        comparisons++;
        if (L[i] <= R[j]) out.push(L[i++]); else out.push(R[j++]);
      }
      while (i < L.length) out.push(L[i++]);
      while (j < R.length) out.push(R[j++]);
      merged += out.length;

      trace.push({ depth: depth, left: L.slice(), right: R.slice(), out: out.slice() });
      return out;
    }

    var sorted = sort(arr.slice(), 0);
    return { sorted: sorted, comparisons: comparisons, merged: merged, trace: trace };
  }

  /** Is it sorted, and is it a permutation of the input? Both are needed. */
  function msCheck(input, sorted) {
    if (input.length !== sorted.length) return { ok: false, why: 'the output has a different length' };
    for (var i = 1; i < sorted.length; i++) {
      if (sorted[i - 1] > sorted[i]) return { ok: false, why: 'out of order at position ' + (i + 1) };
    }
    var a = input.slice().sort(function (x, y) { return x - y; });
    for (var j = 0; j < a.length; j++) {
      if (a[j] !== sorted[j]) return { ok: false, why: 'the output is not a rearrangement of the input' };
    }
    return { ok: true };
  }

  /**
   * The two recurrences the slides give for merge sort.
   *
   *   exact  T(n) = T(⌊n/2⌋) + T(⌈n/2⌉) + n
   *   approx T(n) ≈ 2 T(⌈n/2⌉) + n
   *
   * They agree at n = 1, 2, 4, 8 … and differ everywhere else, which
   * is exactly why the table in the notes needs saying which one it
   * came from.
   */
  function msRecurrence(n, mode) {
    var memo = { 1: 1 };
    function T(k) {
      k = Math.round(k);
      if (memo[k] !== undefined) return memo[k];
      var v = mode === 'approx'
        ? 2 * T(Math.ceil(k / 2)) + k
        : T(Math.floor(k / 2)) + T(Math.ceil(k / 2)) + k;
      memo[k] = v;
      return v;
    }
    return T(n);
  }

  /** A deterministic shuffle, so a reader's example is reproducible. */
  function msSample(n, seed) {
    var s = seed || 12345;
    var rnd = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    var a = [];
    for (var i = 1; i <= n; i++) a.push(i);
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(rnd() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  /* ---------- rendering ---------- */

  var HN_PEG = ['1', '2', '3'];

  function hnPegs(state) {
    var s = '<span class="hn-pegs">';
    for (var p = 0; p < 3; p++) {
      s += '<span class="hn-peg"><span class="hn-peg-n">' + HN_PEG[p] + '</span>' +
        (state[p].length
          ? state[p].map(function (d) { return '<span class="hn-disc d' + d + '">' + d + '</span>'; }).join('')
          : '<span class="hn-empty">·</span>') +
        '</span>';
    }
    return s + '</span>';
  }

  function runHanoi() {
    var out = document.getElementById('hn-output');
    if (!out) return;

    var n = parseInt(((document.getElementById('hn-n') || {}).value), 10);
    if (!isFinite(n) || n < 1) n = 3;
    if (n > 9) n = 9;

    var run = hanoiRun(n);
    var chk = hanoiCheck(n, run.moves);
    var claimed = hanoiRecurrence(n);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + n + ' discs</span>' +
      '<span class="stat-pill a">' + run.count + ' moves</span>' +
      '<span class="stat-pill dark">2<sup>' + n + '</sup> − 1 = ' + (Math.pow(2, n) - 1) + '</span>' +
      '</div>';

    h += '<div class="verdict ' + (chk.ok && run.count === claimed ? 'safe' : 'bad') + '">' +
      (chk.ok
        ? 'Legal throughout — never two discs at once, never a larger disc on a smaller one, ' +
          'and the whole tower arrives on peg 3'
        : 'ILLEGAL: ' + chk.why) +
      '<br>' + (run.count === claimed
        ? 'Moves made: ' + run.count + '. The recurrence T(1)=1, T(n)=2T(n−1)+1 predicts ' + claimed + ' ✓'
        : 'Moves made: ' + run.count + ', but the recurrence predicts ' + claimed + ' ✗') +
      '</div>';

    h += '<div class="hn-trace" id="hn-trace">';
    h += '<div class="hn-row" data-step="0"><span class="hn-move">start</span>' +
         hnPegs(run.states[0]) + '</div>';
    for (var i = 0; i < run.moves.length; i++) {
      var m = run.moves[i];
      h += '<div class="hn-row" data-step="' + (i + 1) + '">' +
        '<span class="hn-move">disc <strong>' + m.disc + '</strong> &nbsp;' +
        HN_PEG[m.from] + ' → ' + HN_PEG[m.to] + '</span>' +
        hnPegs(run.states[i + 1]) + '</div>';
    }
    h += '</div>';

    h += '<p class="tool-note">The recursion is <code>MOVETOWER(n−1)</code>, one move, ' +
      '<code>MOVETOWER(n−1)</code> — which reads off as T(n) = 2T(n−1) + 1 directly. ' +
      'Adding one disc doubles the work and adds a move: 64 discs would take ' +
      '18,446,744,073,709,551,615 moves.</p>';

    out.innerHTML = h;
    ixTrace('hn', 'hn-output', { label: 'move', reset: true });
  }

  function mgPreset(list) {
    var box = document.getElementById('mg-list');
    if (box) box.value = list;
    runMerge();
  }

  function mgShuffle() {
    var box = document.getElementById('mg-list');
    if (box) box.value = msSample(10, Date.now() % 100000).join(', ');
    runMerge();
  }

  function runMerge() {
    var out = document.getElementById('mg-output');
    if (!out) return;

    var raw = ((document.getElementById('mg-list') || {}).value || '').trim();
    var nums = raw.split(/[\s,]+/).filter(Boolean).map(Number);
    if (!nums.length || nums.some(function (x) { return !isFinite(x); })) {
      out.innerHTML = '<div class="tool-error">Give a list of numbers, separated by commas.</div>';
      return;
    }
    if (nums.length > 32) {
      out.innerHTML = '<div class="tool-error">Thirty-two is the most this will trace.</div>';
      return;
    }

    var n = nums.length;
    var r = msRun(nums);
    var chk = msCheck(nums, r.sorted);
    var exact = msRecurrence(n, 'exact'), approx = msRecurrence(n, 'approx');

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a">' + n + ' items</span>' +
      '<span class="stat-pill a">' + r.comparisons + ' comparisons</span>' +
      '<span class="stat-pill dark">' + r.merged + ' elements merged</span>' +
      '</div>';

    h += '<div class="verdict ' + (chk.ok ? 'safe' : 'bad') + '">' +
      (chk.ok ? 'Sorted, and a genuine rearrangement of the input' : 'WRONG: ' + chk.why) +
      '<br>' + r.sorted.join(', ') + '</div>';

    h += '<div class="mg-trace" id="mg-trace">';
    r.trace.forEach(function (t, i) {
      h += '<div class="mg-row" data-step="' + i + '">' +
        '<span class="mg-halves">[' + t.left.join(' ') + ']&nbsp;+&nbsp;[' + t.right.join(' ') + ']</span>' +
        '<span class="mg-arrow">→</span>' +
        '<span class="mg-out">[' + t.out.join(' ') + ']</span></div>';
    });
    h += '</div>';

    /* the two recurrences the slides give, side by side */
    h += '<table class="results-table mg-table"><tr><th>n</th>';
    for (var k = 1; k <= Math.min(12, Math.max(8, n)); k++) h += '<th>' + k + '</th>';
    h += '</tr><tr><td class="rc-lab">exact T(⌊n/2⌋)+T(⌈n/2⌉)+n</td>';
    for (var e = 1; e <= Math.min(12, Math.max(8, n)); e++) h += '<td>' + msRecurrence(e, 'exact') + '</td>';
    h += '</tr><tr><td class="rc-lab">approx 2T(⌈n/2⌉)+n</td>';
    for (var q = 1; q <= Math.min(12, Math.max(8, n)); q++) {
      var same = msRecurrence(q, 'approx') === msRecurrence(q, 'exact');
      h += '<td class="' + (same ? '' : 'rc-miss') + '">' + msRecurrence(q, 'approx') + '</td>';
    }
    h += '</tr></table>';

    h += '<p class="tool-note">The lecture slides give the exact recurrence and then tabulate the ' +
      'approximation; the two agree only when n is a power of two, and part company from n = 3. ' +
      'For this input the exact recurrence gives <strong>' + exact + '</strong> and the approximation <strong>' +
      approx + '</strong>.</p>';

    h += '<p class="tool-note">Counted for real: <strong>' + r.merged + '</strong> elements passed through ' +
      'a merge, which is exactly T(' + n + ') − ' + n + ' = ' + (exact - n) + ' — the recurrence charges n per ' +
      'merge level and 1 for each of the n leaves. The <strong>' + r.comparisons + '</strong> comparisons ' +
      'are fewer, because a merge stops comparing as soon as one side runs out; n is the upper bound the ' +
      'lectures charge.</p>';

    out.innerHTML = h;
    ixTrace('mg', 'mg-output', { label: 'merge', reset: true });
  }
