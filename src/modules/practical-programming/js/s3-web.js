  /* ============================================================
     SCALA TOPIC 03 · default arguments, regexes, crawling

       dfBind    — which argument goes to which parameter
       rxFind    — every match of a pattern in a page
       cwCrawl   — a depth-limited crawl over a small web

     Scala's regular expressions are java.util.regex, so the test
     suite puts every pattern and page below to a real JVM and
     compares the matches one by one. The crawl is checked against
     an independently computed reachability set.
     ============================================================ */

  /* ---------- default and named arguments ---------- */

  /*
     def collatzHelper(n: Int, a: Int = 0): Int

     A call supplies some arguments positionally, some by name, and
     leaves the rest to their defaults. The rules are short and
     everyone assumes at least one of them wrongly:

       - positional arguments fill parameters left to right;
       - a named argument may appear anywhere and picks its own;
       - once you have used a name, everything after it must be named
         too, because the position is no longer meaningful;
       - a parameter with no default must end up filled.
  */
  function dfBind(params, args) {
    var slots = params.map(function (p) {
      return { name: p.name, type: p.type, def: p.def, from: null, value: null };
    });
    var errors = [];
    var seenNamed = false;

    (args || []).forEach(function (a, i) {
      if (a.name) {
        seenNamed = true;
        var hit = -1;
        slots.forEach(function (s, j) { if (s.name === a.name) hit = j; });
        if (hit < 0) {
          errors.push('There is no parameter called <code>' + esc(a.name) + '</code>.');
          return;
        }
        if (slots[hit].from !== null) {
          errors.push('<code>' + esc(a.name) + '</code> is given twice.');
          return;
        }
        slots[hit].from = 'named';
        slots[hit].value = a.value;
      } else {
        if (seenNamed) {
          errors.push('Argument ' + (i + 1) + ' is positional but comes after a named one. ' +
            'Once a name is used, the ones after it have no position left to mean anything, so ' +
            'they must be named too.');
          return;
        }
        /* The next unfilled slot, left to right. */
        var next = -1;
        for (var k = 0; k < slots.length; k++) {
          if (slots[k].from === null) { next = k; break; }
        }
        if (next < 0) {
          errors.push('Too many arguments: the function takes ' + slots.length + '.');
          return;
        }
        slots[next].from = 'positional';
        slots[next].value = a.value;
      }
    });

    slots.forEach(function (s) {
      if (s.from === null) {
        if (s.def === undefined || s.def === null) {
          errors.push('<code>' + esc(s.name) + '</code> has no default and was not supplied.');
        } else {
          s.from = 'default';
          s.value = s.def;
        }
      }
    });

    return {
      ok: errors.length === 0, slots: slots, errors: errors,
      call: 'collatzHelper(' + (args || []).map(function (a) {
        return (a.name ? a.name + ' = ' : '') + a.value;
      }).join(', ') + ')'
    };
  }

  var DF_PARAMS = [
    { name: 'n', type: 'Int' },
    { name: 'a', type: 'Int', def: '0' }
  ];

  var DF_CALLS = {
    both: { label: 'collatzHelper(7, 3)', args: [{ value: '7' }, { value: '3' }] },
    one: { label: 'collatzHelper(7)', args: [{ value: '7' }] },
    explicit: { label: 'collatzHelper(7, 0)', args: [{ value: '7' }, { value: '0' }] },
    named: { label: 'collatzHelper(n = 7, a = 3)',
      args: [{ name: 'n', value: '7' }, { name: 'a', value: '3' }] },
    reordered: { label: 'collatzHelper(a = 3, n = 7)',
      args: [{ name: 'a', value: '3' }, { name: 'n', value: '7' }] },
    skipFirst: { label: 'collatzHelper(a = 3)', args: [{ name: 'a', value: '3' }] },
    afterNamed: { label: 'collatzHelper(n = 7, 3)',
      args: [{ name: 'n', value: '7' }, { value: '3' }] },
    none: { label: 'collatzHelper()', args: [] }
  };

  /* ---------- regular expressions ---------- */

  /*
     The two patterns everyone writes first. Kept exactly as they are
     normally given, because the point of the tool is what they do and
     do not match — and both have a quirk worth seeing.
  */
  var RX_PATTERNS = {
    http: {
      label: 'URLs in quotes',
      source: '"https?://[^"]*"',
      scala: 'val http_pattern = """"https?://[^"]*"""".r',
      note: 'The quotes are part of the pattern, which is why the matches include them and ' +
        'why <code>unquote</code> — <code>s.drop(1).dropRight(1)</code> — exists.'
    },
    email: {
      label: 'email addresses',
      source: '([a-z\\d\\.-]+)@([\\da-z\\.-]+)\\.([a-z\\.]{2,6})',
      scala: 'val email_pattern =\n  """([a-z\\d\\.-]+)@([\\da-z\\.-]+)\\.([a-z\\.]{2,6})""".r',
      note: 'Three groups: the local part, the domain, and the suffix. Lower case only, and — ' +
        'because nothing anchors either end — it does not fail on an address it cannot handle, ' +
        'it matches <em>part</em> of one. <code>Ada@example.com</code> comes back as ' +
        '<code>da@example.com</code>, and <code>ada@example.technology</code> as ' +
        '<code>ada@example.techno</code>. A wrong answer, quietly.'
    },
    href: {
      label: 'href attributes',
      source: 'href="([^"]*)"',
      scala: 'val href_pattern = """href="([^"]*)"""".r',
      note: 'One group, holding just the target. Reading the group rather than the whole match ' +
        'saves the unquoting step.'
    }
  };

  var RX_PAGES = {
    simple: { label: 'a small page', text:
      '<html><body>\n' +
      '  <a href="https://example.com/a">first</a>\n' +
      '  <a href="https://example.com/b">second</a>\n' +
      '  <p>write to ada@example.com or to grace.hopper@navy.mil</p>\n' +
      '</body></html>' },
    tricky: { label: 'one with awkward cases', text:
      'Contact: Ada@example.com (a capital A, which is not in the character class)\n' +
      'or ada@example.museum — a six-letter suffix, which just fits\n' +
      'or ada@example.technology, which does not.\n' +
      'Links: "https://a.example" and "http://b.example/page?q=1"' },
    none: { label: 'nothing to find', text: 'Just some ordinary prose, with no links in it.' }
  };

  /**
     Every match of a pattern in a page, with the groups and where it
     starts. Uses the host's own regex engine — the test suite compares
     these against java.util.regex, which is the one Scala uses.
  */
  function rxFind(patternSource, text) {
    var re;
    try {
      re = new RegExp(patternSource, 'g');
    } catch (e) {
      return { ok: false, error: 'That is not a pattern this engine accepts: ' + esc(e.message) };
    }
    var out = [], m, guard = 0;
    while ((m = re.exec(text)) !== null) {
      if (guard++ > 500) break;
      out.push({
        text: m[0],
        index: m.index,
        groups: m.slice(1).map(function (g) { return g === undefined ? null : g; })
      });
      if (m.index === re.lastIndex) re.lastIndex++;   // never loop on an empty match
    }
    return { ok: true, matches: out, count: out.length };
  }

  /** s.drop(1).dropRight(1) — what unquote does. */
  function rxUnquote(s) { return s.slice(1, -1); }

  /* ---------- the crawler ---------- */

  /*
     A small web, as a map from URL to the links on that page. Real
     crawling needs the network; the shape of the problem does not.

     The interesting part is what the depth limit does, and what
     happens when pages link back to each other.
  */
  var CW_WEB = {
    'a.example': ['b.example', 'c.example'],
    'b.example': ['d.example', 'a.example'],
    'c.example': ['d.example'],
    'd.example': ['e.example'],
    'e.example': [],
    'lonely.example': []
  };

  var CW_EMAILS = {
    'a.example': ['ada@a.example'],
    'b.example': ['bob@b.example', 'ada@a.example'],
    'c.example': [],
    'd.example': ['dee@d.example'],
    'e.example': ['eve@e.example'],
    'lonely.example': []
  };

  /**
     crawl(url, n) as written: recurse to depth n, with no memory of
     where it has been.

     opts.visited — keep a set of pages already seen
     opts.limit   — stop after this many visits, so a cycle without a
                    visited set cannot hang the page
  */
  function cwCrawl(start, depth, opts) {
    var o = opts || {};
    var limit = o.limit || 400;
    var visits = [];
    var seen = {};
    var stopped = false;
    var emails = {};

    function go(url, n, path) {
      if (visits.length >= limit) { stopped = true; return; }
      if (n === 0) return;
      if (o.visited) {
        if (seen[url]) {
          visits.push({ url: url, depth: n, skipped: true, path: path });
          return;
        }
        seen[url] = true;
      }
      visits.push({ url: url, depth: n, skipped: false, path: path });
      (CW_EMAILS[url] || []).forEach(function (e) { emails[e] = true; });
      var links = CW_WEB[url] || [];
      links.forEach(function (l) { go(l, n - 1, path.concat([url])); });
    }

    go(start, depth, []);

    var counts = {};
    visits.forEach(function (v) {
      if (v.skipped) return;
      counts[v.url] = (counts[v.url] || 0) + 1;
    });

    return {
      ok: true, visits: visits, stopped: stopped,
      total: visits.filter(function (v) { return !v.skipped; }).length,
      skipped: visits.filter(function (v) { return v.skipped; }).length,
      distinct: Object.keys(counts).length,
      repeats: Object.keys(counts).filter(function (k) { return counts[k] > 1; }),
      counts: counts,
      emails: Object.keys(emails).sort()
    };
  }

  /**
     Which pages are within n hops of the start — worked out by
     breadth-first search, which shares no code with the crawl above.
     The test suite compares the two.
  */
  function cwReachable(start, depth) {
    var seen = {};
    var frontier = [start];
    seen[start] = true;
    for (var d = 1; d < depth; d++) {
      var next = [];
      frontier.forEach(function (u) {
        (CW_WEB[u] || []).forEach(function (v) {
          if (!seen[v]) { seen[v] = true; next.push(v); }
        });
      });
      frontier = next;
      if (!frontier.length) break;
    }
    return Object.keys(seen).sort();
  }

  /** The emails findable within n hops, by the same independent route. */
  function cwReachableEmails(start, depth) {
    var out = {};
    cwReachable(start, depth).forEach(function (u) {
      (CW_EMAILS[u] || []).forEach(function (e) { out[e] = true; });
    });
    return Object.keys(out).sort();
  }
