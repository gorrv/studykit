  /* ============================================================
     TOPIC 03 · templates, iterators, containers
     ------------------------------------------------------------
     Three engines, each answering a question with a definite
     answer that g++ can confirm.

     tdDeduce   what T is inferred to be for a call, and when
                deduction fails
     rfBind     what a range-for loop desugars to, and whether the
                element type you wrote can bind to what the
                container yields -- which is exactly where the
                obvious map loop goes wrong
     ctRun      what a container holds as begin/end/++/insert/erase
                are applied, and where each iterator points

     The map loop is worth stating plainly. The obvious version is

         for (pair<int,string> & elem : kNumbers)

     and that does not compile. A map's element type is
     pair<const K, V> -- the key is const, because changing it in
     place would put the tree out of order -- so a non-const
     pair<int,string> & has nothing to bind to. Loop by value, by
     const reference to the right type, or with auto &, which is
     what auto is for.
     ============================================================ */

  /* ---------- template type deduction ---------- */

  var TD_TYPES = ['int', 'double', 'string', 'char', 'bool'];

  /**
     For `template<typename T> const T & max(const T & a, const T & b)`
     called with two arguments, T has to be the same in both
     positions. Two different types is not a promotion question --
     deduction simply has no single answer and the call is refused.
  */
  function tdDeduce(params, args) {
    if (params.length !== args.length) {
      return { ok: true, deduced: null, fails: true,
        why: 'The call has ' + args.length + ' argument' + (args.length === 1 ? '' : 's') +
          ' but the template takes ' + params.length + '.' };
    }
    var bind = {}, clash = null;
    for (var i = 0; i < params.length; i++) {
      var p = params[i];
      if (TD_TYPES.indexOf(p) >= 0) {
        if (p !== args[i]) {
          clash = clash || { at: i, wanted: p, got: args[i], fixed: true };
        }
        continue;
      }
      if (bind[p] === undefined) bind[p] = args[i];
      else if (bind[p] !== args[i] && !clash) {
        clash = { at: i, param: p, first: bind[p], second: args[i] };
      }
    }
    if (clash) {
      return {
        ok: true, deduced: null, fails: true, clash: clash,
        why: clash.fixed
          ? 'Argument ' + (clash.at + 1) + ' is a <code>' + esc(clash.got) + '</code> where the ' +
            'parameter is a fixed <code>' + esc(clash.wanted) + '</code>.'
          : 'Deduction gets two different answers for <strong>' + esc(clash.param) + '</strong>: ' +
            '<code>' + esc(clash.first) + '</code> from one argument and <code>' +
            esc(clash.second) + '</code> from another. The compiler will not pick one and convert ' +
            'the other — it reports that deduction failed. Say which you meant, as ' +
            '<code>max&lt;' + esc(clash.first) + '&gt;(a, b)</code>, or give the template two ' +
            'type parameters.'
      };
    }
    return {
      ok: true, deduced: bind, fails: false,
      why: Object.keys(bind).length
        ? Object.keys(bind).map(function (k) {
            return '<strong>' + esc(k) + '</strong> = <code>' + esc(bind[k]) + '</code>';
          }).join(', ') + ' — every use agrees, so there is one answer.'
        : 'Nothing to deduce; the parameters are all concrete types.'
    };
  }

  /** The call, written out with T substituted. */
  function tdInstantiate(tmpl, bind) {
    var out = String(tmpl);
    Object.keys(bind || {}).forEach(function (k) {
      out = out.replace(new RegExp('\\b' + k + '\\b', 'g'), bind[k]);
    });
    return out;
  }

  /* ---------- range-for, and what it desugars to ---------- */

  /**
     Containers, and what their elements actually are. The map row
     is the one that matters.
  */
  var RF_CONTAINERS = {
    'vector<int>':       { elem: 'int',                  yields: 'int &',                    note: 'a plain sequence of ints' },
    'vector<string>':    { elem: 'string',               yields: 'string &',                 note: 'a plain sequence of strings' },
    'list<int>':         { elem: 'int',                  yields: 'int &',                    note: 'a doubly linked list' },
    'set<int>':          { elem: 'int',                  yields: 'const int &', alwaysConst: true,
                           note: 'set elements are const — changing one in place would break the ordering' },
    'map<int,string>':   { elem: 'pair<const int, string>', yields: 'pair<const int, string> &',
                           note: 'the KEY is const, for the same reason: the tree is ordered by it' }
  };

  /**
     Can the element type the loop declares bind to what the
     container yields?

     decl: { kind: 'value' | 'ref' | 'constref' | 'auto' | 'autoref' | 'constautoref',
             type: 'int' | 'pair<int, string>' | ... }
  */
  function rfBind(containerName, decl) {
    var c = RF_CONTAINERS[containerName];
    if (!c) return { ok: false, error: 'Unknown container.' };

    var isAuto = decl.kind.indexOf('auto') >= 0;
    var wanted = isAuto ? c.elem : decl.type;
    var byRef = decl.kind === 'ref' || decl.kind === 'autoref';
    var byConstRef = decl.kind === 'constref' || decl.kind === 'constautoref';
    var byValue = decl.kind === 'value' || decl.kind === 'auto';

    var typesMatch = isAuto || wanted === c.elem;
    var legal, why;

    if (byValue) {
      /* A copy is made, so the types need only be convertible --
         and pair<const int,string> converts to pair<int,string>. */
      legal = isAuto || wanted === c.elem ||
        (c.elem === 'pair<const int, string>' && wanted === 'pair<int, string>');
      why = legal
        ? 'A <strong>copy</strong> of each element is made. That is always allowed here, and it ' +
          'means writing to <code>elem</code> changes the copy and not the container.' +
          (c.elem === 'pair<const int, string>' && wanted === 'pair<int, string>'
            ? ' The <code>const</code> on the key disappears because this is a new pair, not the ' +
              'one in the map.'
            : '')
        : 'The element is a <code>' + esc(c.elem) + '</code> and there is no conversion to <code>' +
          esc(wanted) + '</code>.';
    } else if (byConstRef) {
      legal = isAuto || wanted === c.elem;
      why = legal
        ? 'Binds directly, no copy, and read-only. Always safe.'
        : 'A reference has to name the element exactly. The element is a <code>' + esc(c.elem) +
          '</code>, not a <code>' + esc(wanted) + '</code>, so there is nothing for this reference ' +
          'to name. (A <em>const</em> reference will bind to a temporary, but only if a conversion ' +
          'exists, and there is none between these two.)';
    } else {
      // non-const reference
      legal = (isAuto || wanted === c.elem) && !c.alwaysConst;
      if (c.alwaysConst) {
        why = 'The container yields <code>' + esc(c.yields) + '</code>. A non-const reference ' +
          'would let you modify an element the container needs to keep as it is.';
      } else if (!typesMatch && !isAuto) {
        why = 'The element is a <code>' + esc(c.elem) + '</code>, not a <code>' + esc(wanted) +
          '</code>. A non-const reference cannot bind to a temporary either, so there is no ' +
          'conversion to fall back on — this is a hard error.' +
          (c.elem === 'pair<const int, string>'
            ? ' <strong>This is the classic mistake.</strong> The key in a map element is ' +
              '<code>const</code>, so the element is <code>pair&lt;const int, string&gt;</code> and ' +
              'never <code>pair&lt;int, string&gt;</code>.'
            : '');
      } else {
        why = 'Binds directly to the element, no copy, and you may modify it through the loop ' +
          'variable.';
      }
    }

    var desugared = [
      'auto __it = c.begin();',
      'auto __end = c.end();',
      'for (; __it != __end; ++__it) {',
      '  ' + rfDeclText(decl, c) + ' = *__it;',
      '  ...',
      '}'
    ].join('\n');

    return {
      ok: true, legal: legal, why: why, container: containerName,
      elem: c.elem, yields: c.yields, note: c.note,
      isAuto: isAuto, autoIs: isAuto ? rfAutoIs(decl, c) : null,
      desugared: desugared,
      copies: byValue
    };
  }

  function rfDeclText(decl, c) {
    var t = decl.kind.indexOf('auto') >= 0 ? 'auto' : decl.type;
    if (decl.kind === 'ref' || decl.kind === 'autoref') return t + ' & elem';
    if (decl.kind === 'constref' || decl.kind === 'constautoref') return 'const ' + t + ' & elem';
    return t + ' elem';
  }

  /** What auto is actually standing for. */
  function rfAutoIs(decl, c) {
    if (decl.kind === 'auto') return c.elem.replace(/^const /, '');
    if (decl.kind === 'autoref') return c.elem;
    return 'const ' + c.elem;
  }

  /* ---------- containers and iterators ---------- */

  /**
     A small model of vector, list, set and map, with the
     operations that matter. Every step records where each
     named iterator points, because "the iterator returned by
     insert" and "the iterator returned by erase" are the two
     things worth being sure about.
  */
  function ctRun(kind, ops) {
    var isMap = kind === 'map', isSet = kind === 'set';
    var ordered = isMap || isSet;
    var items = [];              // {key, value} for map; {key} otherwise
    var steps = [];
    var iters = {};              // name -> index (items.length means end())
    var errors = [];

    function show() {
      return items.map(function (it) {
        return isMap ? it.key + '→' + it.value : String(it.key);
      });
    }
    function snapshot(op, note) {
      steps.push({
        op: op, note: note, items: show(),
        iters: Object.keys(iters).map(function (n) {
          return { name: n, at: iters[n], atEnd: iters[n] >= items.length };
        })
      });
    }
    function place(key) {
      if (!ordered) return items.length;
      for (var i = 0; i < items.length; i++) if (items[i].key > key) return i;
      return items.length;
    }

    (ops || []).forEach(function (op) {
      if (op.kind === 'push') {
        if (ordered) {
          var existing = items.filter(function (it) { return it.key === op.key; })[0];
          if (existing) {
            snapshot(op, isMap
              ? 'A node with key ' + op.key + ' is already there, so <strong>nothing happens</strong> ' +
                '— the value stays ' + existing.value + '. This is the surprising part.'
              : 'Already in the set; nothing is added.');
            return;
          }
          var at = place(op.key);
          items.splice(at, 0, { key: op.key, value: op.value });
          // inserting shifts every iterator at or after `at`
          Object.keys(iters).forEach(function (n) { if (iters[n] >= at) iters[n]++; });
          snapshot(op, 'Inserted in key order at position ' + at + '.');
        } else {
          items.push({ key: op.key });
          snapshot(op, 'Appended at the end.');
        }

      } else if (op.kind === 'assign') {
        var found = items.filter(function (it) { return it.key === op.key; })[0];
        if (found) {
          found.value = op.value;
          snapshot(op, '<code>[' + op.key + ']</code> already exists, so this <strong>overwrites' +
            '</strong> the value — which is exactly what emplace would not have done.');
        } else {
          var at2 = place(op.key);
          items.splice(at2, 0, { key: op.key, value: op.value });
          Object.keys(iters).forEach(function (n) { if (iters[n] >= at2) iters[n]++; });
          snapshot(op, '<code>[' + op.key + ']</code> was not there, so it is created.');
        }

      } else if (op.kind === 'begin') {
        iters[op.name] = 0;
        snapshot(op, '<code>' + op.name + '</code> points at the first element.');

      } else if (op.kind === 'end') {
        iters[op.name] = items.length;
        snapshot(op, '<code>' + op.name + '</code> points <em>past</em> the last element. There is ' +
          'nothing there to read — dereferencing it is undefined behaviour.');

      } else if (op.kind === 'advance') {
        if (iters[op.name] === undefined) {
          errors.push('No iterator called ' + op.name + '.');
          return;
        }
        if (kind === 'list' && op.by > 1) {
          errors.push('A list iterator cannot jump ' + op.by + ' places — <code>+</code> is not ' +
            'defined for it. Only a vector’s iterator supports that, because its elements are ' +
            'contiguous; a list has to be walked one node at a time.');
          snapshot(op, 'Refused.');
          return;
        }
        iters[op.name] = Math.min(items.length, iters[op.name] + op.by);
        snapshot(op, '<code>' + op.name + '</code> moves ' + op.by + ' forward' +
          (iters[op.name] >= items.length ? ' and is now at end()' : '') + '.');

      } else if (op.kind === 'deref') {
        var at3 = iters[op.name];
        if (at3 === undefined) { errors.push('No iterator called ' + op.name + '.'); return; }
        if (at3 >= items.length) {
          errors.push('<code>*' + op.name + '</code> dereferences <code>end()</code>, which points ' +
            'past the last element. Undefined behaviour — and it will often appear to work.');
          snapshot(op, 'Refused.');
          return;
        }
        snapshot(op, '<code>*' + op.name + '</code> is <strong>' + show()[at3] + '</strong>.');

      } else if (op.kind === 'insert') {
        var at4 = iters[op.name];
        if (at4 === undefined) { errors.push('No iterator called ' + op.name + '.'); return; }
        items.splice(at4, 0, { key: op.key, value: op.value });
        /* Every iterator at or after the insertion point shifts along -- including
           the one passed in. It still names the element it always named; that
           element is simply one position further down now. Confirmed against g++:
           after a.insert(itr, 10) on 1,2,3 with itr at 2, *itr is still 2. */
        Object.keys(iters).forEach(function (n) { if (iters[n] >= at4) iters[n]++; });
        iters[op.result || 'newItr'] = at4;
        if (kind === 'vector') {
          Object.keys(iters).forEach(function (n) {
            if (n !== (op.result || 'newItr')) iters[n] = Math.min(iters[n], items.length);
          });
        }
        snapshot(op, 'Inserted <strong>before</strong> where <code>' + op.name + '</code> pointed. ' +
          '<code>' + (op.result || 'newItr') + '</code> now points at the new element, and ' +
          '<code>' + op.name + '</code> still names the element it always named.' +
          (kind === 'vector'
            ? ' <strong>Every other iterator into a vector is now invalid</strong> — inserting may ' +
              'move the whole array to make room. A list’s iterators survive, because only the ' +
              'links change.'
            : ' Iterators into a list survive an insert; only the links around it change.'));

      } else if (op.kind === 'erase') {
        var at5 = iters[op.name];
        if (at5 === undefined) { errors.push('No iterator called ' + op.name + '.'); return; }
        if (at5 >= items.length) {
          errors.push('Cannot erase at <code>end()</code>.');
          snapshot(op, 'Refused.');
          return;
        }
        var gone = show()[at5];
        items.splice(at5, 1);
        Object.keys(iters).forEach(function (n) { if (iters[n] > at5) iters[n]--; });
        iters[op.result || 'newItr'] = at5;
        snapshot(op, 'Removed <strong>' + gone + '</strong>. <code>' + (op.result || 'newItr') +
          '</code> points at what is now in that position — what used to be next' +
          (at5 >= items.length ? ', which here is end()' : '') + '.');

      } else if (op.kind === 'find') {
        var idx = -1;
        for (var i2 = 0; i2 < items.length; i2++) if (items[i2].key === op.key) { idx = i2; break; }
        iters[op.name] = idx < 0 ? items.length : idx;
        snapshot(op, idx < 0
          ? 'Not found, so <code>find</code> returns <code>end()</code>. <strong>That is the check' +
            '</strong>: compare the result against <code>end()</code> before dereferencing it.'
          : 'Found at position ' + idx + '.');
      }
    });

    return { ok: true, kind: kind, items: show(), steps: steps, iters: iters, errors: errors };
  }

  var CT_PRESETS = {
    listInsert: { kind: 'list', label: 'insert into a list',
      ops: [{ kind: 'push', key: 1 }, { kind: 'push', key: 2 }, { kind: 'push', key: 3 },
            { kind: 'begin', name: 'itr' }, { kind: 'advance', name: 'itr', by: 1 },
            { kind: 'insert', name: 'itr', key: 10, result: 'newItr' },
            { kind: 'deref', name: 'newItr' }] },
    listErase: { kind: 'list', label: 'erase from a list',
      ops: [{ kind: 'push', key: 1 }, { kind: 'push', key: 2 }, { kind: 'push', key: 3 },
            { kind: 'begin', name: 'itr' }, { kind: 'advance', name: 'itr', by: 1 },
            { kind: 'erase', name: 'itr', result: 'newItr' },
            { kind: 'deref', name: 'newItr' }] },
    vectorJump: { kind: 'vector', label: 'a vector iterator can jump',
      ops: [{ kind: 'push', key: 1 }, { kind: 'push', key: 2 }, { kind: 'push', key: 3 },
            { kind: 'push', key: 4 },
            { kind: 'begin', name: 'itr' }, { kind: 'advance', name: 'itr', by: 2 },
            { kind: 'deref', name: 'itr' }] },
    listJump: { kind: 'list', label: 'a list iterator cannot',
      ops: [{ kind: 'push', key: 1 }, { kind: 'push', key: 2 }, { kind: 'push', key: 3 },
            { kind: 'begin', name: 'itr' }, { kind: 'advance', name: 'itr', by: 2 }] },
    endDeref: { kind: 'vector', label: 'dereferencing end()',
      ops: [{ kind: 'push', key: 1 }, { kind: 'push', key: 2 },
            { kind: 'end', name: 'itr' }, { kind: 'deref', name: 'itr' }] },
    mapEmplace: { kind: 'map', label: 'emplace an existing key',
      ops: [{ kind: 'push', key: 1194384, value: '"Andrew"' },
            { kind: 'push', key: 1234567, value: '"Someone"' },
            { kind: 'push', key: 1194384, value: '"Andrew Coles"' }] },
    mapAssign: { kind: 'map', label: 'operator[] overwrites',
      ops: [{ kind: 'push', key: 1194384, value: '"Andrew"' },
            { kind: 'assign', key: 1194384, value: '"Andrew Coles"' }] },
    mapFind: { kind: 'map', label: 'find, hit and miss',
      ops: [{ kind: 'push', key: 1194384, value: '"Andrew"' },
            { kind: 'find', name: 'itr', key: 1194384 }, { kind: 'deref', name: 'itr' },
            { kind: 'find', name: 'miss', key: 999 }, { kind: 'deref', name: 'miss' }] },
    setOrder: { kind: 'set', label: 'a set keeps itself in order',
      ops: [{ kind: 'push', key: 7 }, { kind: 'push', key: 2 }, { kind: 'push', key: 9 },
            { kind: 'push', key: 2 }] }
  };
