  /* ---------- Topic 03 · templates, iterators and containers ----------

     Marked by the same engines the tools use, which the test suite
     checks against g++ on every run.
     ------------------------------------------------------------ */

  /* ---- type deduction ---- */
  QZ_GEN.push({ topic: 'templates', make: function () {
    var types = ['int', 'double', 'string', 'char'];
    var a = qzPick(types), b = Math.random() < 0.5 ? a : qzPick(types);
    var r = tdDeduce(['T', 'T'], [a, b]);
    var right = r.fails ? 'Deduction fails' : r.deduced.T;
    var choices = ['Deduction fails'].concat(types);
    return {
      topic: 'C++ · type deduction',
      kind: 'choice',
      prompt: 'Given <code>template&lt;typename T&gt; const T &amp; max(const T &amp; a, const T &amp; b);</code>' +
        ' and <code>' + esc(a) + ' a; ' + esc(b) + ' b;</code>, what is T deduced to be in ' +
        '<code>max(a, b)</code>?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: r.why + (r.fails
        ? ' Deduction matches types; it does not rank them and convert.'
        : '')
    };
  } });

  /* ---- range-for binding ---- */
  QZ_GEN.push({ topic: 'templates', make: function () {
    var containers = Object.keys(RF_CONTAINERS);
    var c = qzPick(containers);
    var kinds = ['ref', 'constref', 'value', 'autoref'];
    var kind = qzPick(kinds);
    var type = RF_CONTAINERS[c].elem === 'pair<const int, string>'
      ? qzPick(['pair<int, string>', 'pair<const int, string>'])
      : RF_CONTAINERS[c].elem;
    var r = rfBind(c, { kind: kind, type: type });
    var declared = kind.indexOf('auto') >= 0 ? 'auto' : type;
    var loop = 'for (' + (kind === 'constref' ? 'const ' : '') + declared +
      (kind === 'value' ? ' ' : ' & ') + 'elem : c)';
    var right = r.legal ? 'Yes' : 'No';
    return {
      topic: 'C++ · range-for',
      kind: 'choice',
      prompt: 'For a <code>' + esc(c) + ' c;</code>, does this loop compile?' +
        '<pre class="pp-snippet">' + esc(loop) + '</pre>',
      choices: ['Yes', 'No'],
      answer: right,
      check: textCheck(right),
      explain: 'One element of a <code>' + esc(c) + '</code> is a <code>' + esc(r.elem) +
        '</code>. ' + r.why
    };
  } });

  /* ---- what does a map element look like? ---- */
  QZ_GEN.push({ topic: 'templates', make: function () {
    var right = 'pair<const int, string>';
    var choices = [right, 'pair<int, string>', 'pair<int, string> &', 'string'];
    return {
      topic: 'C++ · map elements',
      kind: 'choice',
      prompt: 'What is the element type of a <code>map&lt;int, string&gt;</code>?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: 'The <strong>key is const</strong>. A map is a search tree ordered by its keys, so ' +
        'changing a key in place would leave the tree sorted wrongly with no way to detect it. ' +
        'That is why <code>for (pair&lt;int,string&gt; &amp; e : m)</code> does not compile — there ' +
        'is no non-const pair anywhere for the reference to bind to — and why <code>auto &amp;</code> ' +
        'is the usual answer.'
    };
  } });

  /* ---- insert / erase return values ---- */
  QZ_GEN.push({ topic: 'templates', make: function () {
    var items = [
      { q: 'What does <code>c.insert(itr, x)</code> return?',
        a: 'An iterator to the newly inserted element',
        w: ['An iterator to the element after it', 'void', 'true if it was inserted'],
        e: 'And it inserts <em>before</em> where the iterator pointed. The return value is the only ' +
           'reliable handle on the new element.' },
      { q: 'What does <code>c.erase(itr)</code> return?',
        a: 'An iterator to what is now in that position',
        w: ['An iterator to the element that was removed', 'void', 'the erased value'],
        e: 'That is what used to be next. It is why <code>itr = c.erase(itr);</code> is the right ' +
           'way to remove inside a loop — the iterator you passed in is invalid afterwards, so ' +
           '<code>++itr</code> would be a bug.' },
      { q: 'What does <code>c.find(k)</code> return when k is not present?',
        a: 'c.end()',
        w: ['nullptr', 'an iterator to where it would go', 'it throws'],
        e: 'So the comparison against <code>end()</code> comes first and the dereference second. ' +
           'Getting that order wrong reads past the end of the container.' },
      { q: 'What does <code>m.emplace(k, v)</code> return?',
        a: 'A pair of an iterator and a bool',
        w: ['An iterator', 'void', 'the value that was stored'],
        e: 'The bool says whether anything was inserted — <code>false</code> means the key was ' +
           'already there and <strong>nothing was changed</strong>. Use <code>m[k] = v</code> if ' +
           'you meant to overwrite.' }
    ];
    var it = qzPick(items);
    return {
      topic: 'C++ · iterators and containers',
      kind: 'choice',
      prompt: it.q,
      choices: [it.a].concat(it.w).sort(),
      answer: it.a,
      check: textCheck(it.a),
      explain: it.e
    };
  } });

  /* ---- run a container scenario ---- */
  QZ_GEN.push({ topic: 'templates', make: function () {
    var key = qzPick(['listInsert', 'listErase', 'mapEmplace', 'mapAssign', 'setOrder']);
    var p = CT_PRESETS[key];
    var r = ctRun(p.kind, p.ops);
    var answer = r.items.join(', ');
    var ops = p.ops.map(function (o) { return ctOpText(o, p.kind); })
      .filter(function (t) { return t && !/^cout/.test(t); });
    return {
      topic: 'C++ · containers',
      kind: 'text',
      prompt: 'Starting from an empty <code>std::' + esc(p.kind) + '</code>:' +
        '<pre class="pp-snippet">' + esc(ops.join('\n')) + '</pre>' +
        'What does it contain afterwards? (in order, comma separated)',
      answer: answer,
      check: function (v) {
        var got = String(v).replace(/[\s"']/g, '');
        return { ok: got === answer.replace(/[\s"']/g, '') };
      },
      explain: ctLesson(key) + ' It ends up holding <strong>' + esc(answer) + '</strong>.'
    };
  } });

  /* ---- vector vs list iterator arithmetic ---- */
  QZ_GEN.push({ topic: 'templates', make: function () {
    var isVector = Math.random() < 0.5;
    var right = isVector ? 'Yes' : 'No';
    return {
      topic: 'C++ · iterator arithmetic',
      kind: 'choice',
      prompt: 'For a <code>std::' + (isVector ? 'vector' : 'list') + '&lt;int&gt; a;</code>, does ' +
        '<code>auto itr = a.begin() + 2;</code> compile?',
      choices: ['Yes', 'No'],
      answer: right,
      check: textCheck(right),
      explain: isVector
        ? 'A vector stores its elements contiguously, so moving two places is an address ' +
          'calculation and <code>+</code> is defined.'
        : 'A list is nodes joined by pointers — there is no arithmetic that gets you two nodes ' +
          'along, so you have to <code>++</code> twice. This is the practical difference between ' +
          'the two containers.'
    };
  } });

  /* ---- function objects ---- */
  QZ_GEN.push({ topic: 'templates', make: function () {
    var items = [
      { q: 'What makes a class a <em>function object</em>?',
        a: 'It defines operator()',
        w: ['It defines operator<', 'It is a template', 'It has no member variables'],
        e: '<code>comp(a, b)</code> is <code>comp.operator()(a, b)</code>. Because it is an object ' +
           'it can also carry state, which a plain function pointer cannot — that is why the STL is ' +
           'built around them.' },
      { q: 'Why pass a comparison as a function object rather than rely on <code>operator&lt;</code>?',
        a: 'A type can only have one operator<',
        w: ['Function objects are faster', 'operator< cannot be const',
            'operator< does not work with templates'],
        e: 'Car might sort by speed <em>or</em> by range, and <code>operator&lt;</code> can only ' +
           'mean one of them. Passing the comparison in lets the caller decide.' },
      { q: 'What does a <code>map&lt;K,V&gt;</code> use to order its keys by default?',
        a: 'std::less<K>, which calls operator<',
        w: ['operator==', 'a hash of the key', 'the order they were inserted'],
        e: 'It is the third template parameter, defaulted: ' +
           '<code>template&lt;typename K, typename V, typename Comp = less&lt;K&gt;&gt;</code>. ' +
           'Supply your own to order keys some other way.' }
    ];
    var it = qzPick(items);
    return {
      topic: 'C++ · function objects',
      kind: 'choice',
      prompt: it.q,
      choices: [it.a].concat(it.w).sort(),
      answer: it.a,
      check: textCheck(it.a),
      explain: it.e
    };
  } });

  /* ---- reading a tuple ---- */
  QZ_GEN.push({ topic: 'templates', make: function () {
    var right = 'std::get<0>(ans)';
    var choices = [right, 'ans.get<0>()', 'ans[0]', 'ans.first'];
    return {
      topic: 'C++ · tuples',
      kind: 'choice',
      prompt: 'How do you read the first element of a <code>std::tuple&lt;int,int,bool&gt; ans;</code>?',
      choices: choices.slice().sort(),
      answer: right,
      check: textCheck(right),
      explain: '<code>get</code> is a free function template, not a member, so ' +
        '<code>ans.get&lt;0&gt;()</code> does not compile. The index must be a compile-time ' +
        'constant, because the return type depends on it, which is also why there is no ' +
        '<code>ans[i]</code>.'
    };
  } });
