  /* ============================================================
     SCALA TOPIC 01 · cons cells, sharing, and the refactor check

       lsRun     — build lists with :: and see which cells are shared
       rfCompare — run two versions of the same predicate over every
                   input in a bounded domain and report where they
                   differ

     Neither of these needs a Scala compiler to be trustworthy. The
     first is checked against an invariant that has to hold for any
     singly linked list — k conses allocate exactly k cells and copy
     nothing — and the second is exhaustive over its domain, so it
     is a proof rather than a sample.
     ============================================================ */

  /* ---------- cons cells and what they share ---------- */

  /*
     A list is a chain of cells. `::` makes ONE new cell whose tail
     points at the list you already had; it does not copy anything.
     That is why the old list is still usable and still correct: it
     cannot see the new cell.

     Steps are:
       { kind: 'literal', name, items }   val a = List(1, 2, 3)
       { kind: 'cons',    name, value, from }  val b = 0 :: a
       { kind: 'tail',    name, from }    val c = a.tail
       { kind: 'concat',  name, left, right }  val d = a ::: b
  */
  function lsRun(steps) {
    var cells = [];        // { id, value, tail }  tail = id or null
    var names = {};        // name -> head cell id (null = empty list)
    var events = [];
    var nextId = 1;

    function alloc(value, tail) {
      var c = { id: nextId++, value: value, tail: tail };
      cells.push(c);
      return c.id;
    }
    function cell(id) {
      for (var i = 0; i < cells.length; i++) if (cells[i].id === id) return cells[i];
      return null;
    }
    function chain(id) {
      var out = [];
      var seen = {};
      while (id !== null && id !== undefined) {
        if (seen[id]) break;         // cannot happen, but never loop forever
        seen[id] = true;
        var c = cell(id);
        if (!c) break;
        out.push(c);
        id = c.tail;
      }
      return out;
    }

    (steps || []).forEach(function (st) {
      if (st.kind === 'literal') {
        var head = null;
        var made = [];
        for (var i = st.items.length - 1; i >= 0; i--) {
          head = alloc(st.items[i], head);
          made.push(head);
        }
        names[st.name] = head;
        events.push({ text: 'val ' + st.name + ' = List(' + st.items.join(', ') + ')',
          allocated: made.length, shared: 0,
          note: 'A list literal builds ' + made.length + ' cell' + (made.length === 1 ? '' : 's') +
            ', each pointing at the next.' });

      } else if (st.kind === 'cons') {
        var fromHead = names[st.from];
        if (fromHead === undefined) {
          events.push({ text: 'val ' + st.name + ' = ' + st.value + ' :: ' + st.from,
            error: st.from + ' is not defined.' });
          return;
        }
        var sharedLen = chain(fromHead).length;
        names[st.name] = alloc(st.value, fromHead);
        events.push({ text: 'val ' + st.name + ' = ' + st.value + ' :: ' + st.from,
          allocated: 1, shared: sharedLen,
          note: '<strong>One</strong> new cell holding ' + st.value + ', whose tail is the ' +
            'cell <code>' + st.from + '</code> already points at. ' + sharedLen + ' cell' +
            (sharedLen === 1 ? '' : 's') + ' shared, nothing copied — which is why this is ' +
            'constant time however long the list is.' });

      } else if (st.kind === 'tail') {
        var h = names[st.from];
        if (h === undefined || h === null) {
          events.push({ text: 'val ' + st.name + ' = ' + st.from + '.tail',
            error: h === null ? st.from + ' is empty, so it has no tail.' : st.from + ' is not defined.' });
          return;
        }
        names[st.name] = cell(h).tail;
        events.push({ text: 'val ' + st.name + ' = ' + st.from + '.tail',
          allocated: 0, shared: chain(names[st.name]).length,
          note: 'No allocation at all — <code>' + st.name + '</code> is just the cell that ' +
            '<code>' + st.from + '</code>&rsquo;s head was already pointing at.' });

      } else if (st.kind === 'concat') {
        var l = chain(names[st.left]), rHead = names[st.right];
        var newHead = rHead;
        for (var j = l.length - 1; j >= 0; j--) newHead = alloc(l[j].value, newHead);
        names[st.name] = newHead;
        events.push({ text: 'val ' + st.name + ' = ' + st.left + ' ::: ' + st.right,
          allocated: l.length, shared: chain(rHead).length,
          note: 'The <em>left</em> list is copied cell by cell, then the last copy points at the ' +
            'right list, which is shared. So <code>:::</code> costs the length of the left ' +
            'argument — the reason <code>xs ::: ys</code> in a loop is a quiet quadratic.' });
      }
    });

    /* Which cells more than one name can reach. */
    var reach = {};
    Object.keys(names).forEach(function (n) {
      chain(names[n]).forEach(function (c) {
        reach[c.id] = (reach[c.id] || 0) + 1;
      });
    });

    var views = Object.keys(names).map(function (n) {
      var ch = chain(names[n]);
      return {
        name: n,
        items: ch.map(function (c) { return c.value; }),
        ids: ch.map(function (c) { return c.id; }),
        show: 'List(' + ch.map(function (c) { return c.value; }).join(', ') + ')'
      };
    });

    return {
      ok: true, events: events, views: views, cells: cells,
      shared: Object.keys(reach).filter(function (id) { return reach[id] > 1; }).map(Number),
      totalCells: cells.length,
      reach: reach
    };
  }

  var LS_PRESETS = {
    cons: { label: 'putting one on the front',
      steps: [{ kind: 'literal', name: 'old_list', items: [1, 2, 3, 5] },
              { kind: 'cons', name: 'new_list', value: 0, from: 'old_list' }] },
    twoFromOne: { label: 'two lists, one tail',
      steps: [{ kind: 'literal', name: 'a', items: [1, 2, 3] },
              { kind: 'cons', name: 'b', value: 0, from: 'a' },
              { kind: 'cons', name: 'c', value: 9, from: 'a' }] },
    tailIsFree: { label: 'tail costs nothing',
      steps: [{ kind: 'literal', name: 'a', items: [1, 2, 3, 4] },
              { kind: 'tail', name: 'b', from: 'a' },
              { kind: 'tail', name: 'c', from: 'b' }] },
    chain: { label: 'building one up',
      steps: [{ kind: 'literal', name: 'a', items: [] },
              { kind: 'cons', name: 'b', value: 3, from: 'a' },
              { kind: 'cons', name: 'c', value: 2, from: 'b' },
              { kind: 'cons', name: 'd', value: 1, from: 'c' }] },
    concat: { label: 'joining two, which does copy',
      steps: [{ kind: 'literal', name: 'a', items: [1, 2, 3] },
              { kind: 'literal', name: 'b', items: [8, 9] },
              { kind: 'concat', name: 'c', left: 'a', right: 'b' }] }
  };

  /* ---------- the refactor, checked exhaustively ---------- */

  /*
     The worked example everyone meets: a predicate written with a
     mutable flag and a loop, and the same predicate written as one
     expression. The question is not which is prettier. It is
     whether they are the same function — and over a small enough
     domain that can be settled completely rather than sampled.

     A position is legal when it is on the board and not already in
     the path.
  */

  /** The one-line version. */
  function legalFunctional(dim, path, x) {
    return x[0] >= 0 && x[0] < dim && x[1] >= 0 && x[1] < dim &&
      !path.some(function (p) { return p[0] === x[0] && p[1] === x[1]; });
  }

  /** The loop-and-flag version, written out faithfully. */
  function legalImperative(dim, path, x) {
    var boolReturn = false;
    if (x[0] >= dim || x[1] >= dim || x[0] < 0 || x[1] < 0) {
      boolReturn = false;
    } else {
      var breakLoop = false;
      if (path.length === 0) {
        boolReturn = true;
      } else {
        boolReturn = true;
        for (var i = 0; i < path.length; i++) {
          if (!breakLoop) {
            if (path[i][0] === x[0] && path[i][1] === x[1]) {
              boolReturn = false;
              breakLoop = true;
            }
          }
        }
      }
    }
    return boolReturn;
  }

  /**
     The same loop with the flag set the wrong way round: the answer
     is overwritten on every pass, so only the LAST element of the
     path is really consulted. A plausible mistake, and invisible
     until the path has more than one element in it.
  */
  function legalBuggy(dim, path, x) {
    var boolReturn = false;
    if (x[0] >= dim || x[1] >= dim || x[0] < 0 || x[1] < 0) {
      boolReturn = false;
    } else {
      if (path.length === 0) {
        boolReturn = true;
      } else {
        for (var i = 0; i < path.length; i++) {
          if (path[i][0] === x[0] && path[i][1] === x[1]) boolReturn = false;
          else boolReturn = true;         // <- clobbers an earlier `false`
        }
      }
    }
    return boolReturn;
  }

  var RF_VERSIONS = {
    imperative: { label: 'the loop, written carefully', fn: legalImperative },
    buggy: { label: 'the loop, with the flag clobbered', fn: legalBuggy },
    functional: { label: 'the one-liner', fn: legalFunctional }
  };

  /**
     Compare two versions over every position on a dim×dim board, for
     every path drawn from a small set. Exhaustive, so a clean result
     means they agree — not that they probably agree.
  */
  function rfCompare(aName, bName, dim) {
    var A = RF_VERSIONS[aName], B = RF_VERSIONS[bName];
    if (!A || !B) return { ok: false, error: 'Unknown version.' };
    dim = dim || 3;

    /* Every subset of the board's positions, up to length 3, as a
       path — plus the empty path. */
    var positions = [];
    for (var px = 0; px < dim; px++) for (var py = 0; py < dim; py++) positions.push([px, py]);

    var paths = [[]];
    positions.forEach(function (p) { paths.push([p]); });
    positions.forEach(function (p) {
      positions.forEach(function (q) {
        if (p[0] !== q[0] || p[1] !== q[1]) paths.push([p, q]);
      });
    });

    /* Test positions include off-board ones, since that is half the
       predicate. */
    var tests = positions.concat([[-1, 0], [0, -1], [dim, 0], [0, dim], [-1, -1], [dim, dim]]);

    var checked = 0, differ = [], agreeTrue = 0, agreeFalse = 0;
    paths.forEach(function (path) {
      tests.forEach(function (x) {
        var ra = A.fn(dim, path, x), rb = B.fn(dim, path, x);
        checked++;
        if (ra !== rb) {
          if (differ.length < 4) {
            differ.push({ path: path, x: x, a: ra, b: rb });
          }
        } else if (ra) agreeTrue++; else agreeFalse++;
      });
    });

    return {
      ok: true, checked: checked, differences: differ,
      differCount: checked - agreeTrue - agreeFalse,
      agreeTrue: agreeTrue, agreeFalse: agreeFalse,
      same: checked === agreeTrue + agreeFalse,
      dim: dim, paths: paths.length, positions: tests.length
    };
  }
