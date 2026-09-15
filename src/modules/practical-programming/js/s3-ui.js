  /* ============================================================
     SCALA TOPIC 03 · rendering
     ============================================================ */

  /* ---------- Tool 1 · which argument goes where ---------- */

  var dfCurrent = 'one';

  function runDefaults(which) {
    var out = document.getElementById('df-output');
    if (!out) return;
    if (which) dfCurrent = which;
    var c = DF_CALLS[dfCurrent] || DF_CALLS.one;
    var r = dfBind(DF_PARAMS, c.args);

    var h = '<div class="rd-stats">' +
      '<span class="stat-pill a"><code>' + esc(c.label) + '</code></span>' +
      '<span class="stat-pill ' + (r.ok ? 'b' : 'c') + '">' +
        (r.ok ? 'compiles' : 'does not compile') + '</span></div>';

    h += '<div class="df-choices">';
    Object.keys(DF_CALLS).forEach(function (k) {
      h += '<button class="chip' + (k === dfCurrent ? ' on' : '') +
        '" onclick="runDefaults(\'' + k + '\')">' + esc(DF_CALLS[k].label) + '</button>';
    });
    h += '</div>';

    h += '<pre class="pp-snippet">def collatzHelper(n: Int, a: Int = 0): Int = ...\n\n' +
      esc(c.label) + '</pre>';

    h += '<table class="pp-table"><thead><tr><th>parameter</th><th>gets</th><th>from</th>' +
      '</tr></thead><tbody>';
    r.slots.forEach(function (s) {
      h += '<tr><td><code>' + esc(s.name) + ': ' + esc(s.type) +
        (s.def !== undefined ? ' = ' + esc(s.def) : '') + '</code></td>' +
        '<td>' + (s.value === null ? '—' : '<code>' + esc(s.value) + '</code>') + '</td>' +
        '<td>' + (s.from === null ? '<span class="mt-no">nothing</span>' : esc(s.from)) +
        '</td></tr>';
    });
    h += '</tbody></table>';

    if (r.ok) {
      h += '<div class="verdict safe">Positional arguments fill the parameters left to right; ' +
        'anything left over falls back to its default.</div>';
    } else {
      h += '<div class="verdict bad">' + r.errors.join('<br>') + '</div>';
    }

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">The rule people trip over</div>' +
      'A default lets you <em>omit the end</em> of the argument list, not the middle. To skip ' +
      '<code>n</code> and supply only <code>a</code> you have to name it — and once you name one, ' +
      'everything after it must be named too, because position no longer means anything.' +
      '<br><br>Named arguments may also be given in any order: ' +
      '<code>collatzHelper(a = 3, n = 7)</code> is the same call as ' +
      '<code>collatzHelper(7, 3)</code>.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 2 · what the pattern matches ---------- */

  var rxPattern = 'http', rxPage = 'simple';

  function runRegex(which, page) {
    var out = document.getElementById('rx-output');
    if (!out) return;
    if (which) rxPattern = which;
    if (page) rxPage = page;
    var p = RX_PATTERNS[rxPattern] || RX_PATTERNS.http;
    var g = RX_PAGES[rxPage] || RX_PAGES.simple;

    var r = rxFind(p.source, g.text);

    var h = '<div class="rx-choices">';
    Object.keys(RX_PATTERNS).forEach(function (k) {
      h += '<button class="chip' + (k === rxPattern ? ' on' : '') +
        '" onclick="runRegex(\'' + k + '\')">' + esc(RX_PATTERNS[k].label) + '</button>';
    });
    h += '</div><div class="rx-choices">';
    Object.keys(RX_PAGES).forEach(function (k) {
      h += '<button class="chip' + (k === rxPage ? ' on' : '') +
        '" onclick="runRegex(null, \'' + k + '\')">' + esc(RX_PAGES[k].label) + '</button>';
    });
    h += '</div>';

    h += '<pre class="pp-snippet">' + esc(p.scala) + '</pre>';

    if (!r.ok) {
      out.innerHTML = h + '<div class="verdict bad">' + r.error + '</div>';
      return;
    }

    h += '<div class="rd-stats">' +
      '<span class="stat-pill a">' + esc(p.label) + '</span>' +
      '<span class="stat-pill ' + (r.count ? 'b' : 'dark') + '">' + r.count + ' match' +
        (r.count === 1 ? '' : 'es') + '</span></div>';

    /* The page, with every match highlighted. */
    var text = g.text, marked = '', at = 0;
    r.matches.forEach(function (m) {
      marked += esc(text.slice(at, m.index)) + '<mark class="rx-hit">' + esc(m.text) + '</mark>';
      at = m.index + m.text.length;
    });
    marked += esc(text.slice(at));
    h += '<div class="rx-page"><div class="pp-cap">the page</div><pre>' + marked + '</pre></div>';

    if (r.count) {
      h += '<table class="pp-table"><thead><tr><th>at</th><th>match</th>' +
        (r.matches[0].groups.length ? '<th>groups</th>' : '') + '</tr></thead><tbody>';
      r.matches.forEach(function (m) {
        h += '<tr><td>' + m.index + '</td><td><code>' + esc(m.text) + '</code>' +
          (rxPattern === 'http'
            ? '<div class="pp-note" style="margin:2px 0 0;">unquoted: <code>' +
              esc(rxUnquote(m.text)) + '</code></div>'
            : '') + '</td>' +
          (m.groups.length
            ? '<td>' + m.groups.map(function (gr, i) {
                return '<code>' + (i + 1) + ': ' + esc(gr === null ? '—' : gr) + '</code>';
              }).join('<br>') + '</td>'
            : '') + '</tr>';
      });
      h += '</tbody></table>';
    } else {
      h += '<div class="verdict warn">Nothing matched.</div>';
    }

    h += '<div class="callout tip" style="margin:14px 0;">' +
      '<div class="callout-label">' + esc(p.label) + '</div>' + p.note + '</div>';

    h += '<div class="pp-note">Scala&rsquo;s regular expressions are Java&rsquo;s. The test suite ' +
      'runs every pattern here through <code>java.util.regex</code> on a real JVM and compares ' +
      'the matches, positions and groups one by one.</div>';

    out.innerHTML = h;
  }

  /* ---------- Tool 3 · the crawl ---------- */

  var cwDepth = 3, cwVisited = false;

  function runCrawl(depth, visited) {
    var out = document.getElementById('cr-output');
    if (!out) return;
    if (depth !== undefined && depth !== null) cwDepth = depth;
    if (visited !== undefined && visited !== null) cwVisited = visited;

    var r = cwCrawl('a.example', cwDepth, { visited: cwVisited });
    var reach = cwReachable('a.example', cwDepth);

    var h = '<div class="cr-controls"><span class="pp-cap" style="margin:0 6px 0 0;">depth</span>';
    [1, 2, 3, 4, 5].forEach(function (d) {
      h += '<button class="chip' + (d === cwDepth ? ' on' : '') +
        '" onclick="runCrawl(' + d + ')">' + d + '</button>';
    });
    h += '<span class="pp-cap" style="margin:0 6px 0 14px;">visited set</span>' +
      '<button class="chip' + (!cwVisited ? ' on' : '') + '" onclick="runCrawl(null, false)">no</button>' +
      '<button class="chip' + (cwVisited ? ' on' : '') + '" onclick="runCrawl(null, true)">yes</button>' +
      '</div>';

    h += '<div class="rd-stats">' +
      '<span class="stat-pill a">' + r.total + ' visits</span>' +
      '<span class="stat-pill b">' + r.distinct + ' distinct pages</span>' +
      (r.repeats.length
        ? '<span class="stat-pill c">' + r.repeats.length + ' fetched more than once</span>'
        : '<span class="stat-pill b">nothing fetched twice</span>') +
      '</div>';

    h += '<pre class="pp-snippet">def crawl(url: String, n: Int): Unit = {\n' +
      '  if (n == 0) ()\n  else {\n    println(s"Visiting: $n $url")\n' +
      '    val page = get_page(url)\n    for (u &lt;- get_all_URLs(page))\n' +
      '      crawl(u, n - 1)\n  }\n}</pre>';

    h += '<div class="cr-log"><div class="pp-cap">what it prints</div><pre>';
    r.visits.slice(0, 40).forEach(function (v) {
      h += (v.skipped
        ? '<span class="cr-skip">  (already seen: ' + esc(v.url) + ')</span>'
        : 'Visiting: ' + v.depth + ' ' + esc(v.url)) + '\n';
    });
    if (r.visits.length > 40) h += '… and ' + (r.visits.length - 40) + ' more\n';
    h += '</pre></div>';

    h += '<div class="cr-counts"><div class="pp-cap">times each page was fetched</div>';
    Object.keys(r.counts).sort().forEach(function (u) {
      h += '<span class="cr-count' + (r.counts[u] > 1 ? ' many' : '') + '">' + esc(u) +
        ' <strong>&times;' + r.counts[u] + '</strong></span>';
    });
    h += '</div>';

    h += '<div class="verdict ' + (r.repeats.length ? 'warn' : 'safe') + '">' +
      (r.repeats.length
        ? '<strong>' + r.total + ' fetches for ' + r.distinct + ' pages.</strong> Nothing here ' +
          'remembers where it has been, so a page reachable by two routes is fetched twice — and ' +
          '<code>b.example</code> links back to <code>a.example</code>, so the only thing ' +
          'stopping this is the depth counter. Over the real web that is somebody else&rsquo;s ' +
          'bandwidth.'
        : 'Every page fetched once. The visited set is what makes that true; the depth limit ' +
          'alone only bounds how long the damage lasts.') +
      '</div>';

    h += '<div class="pp-note">Pages within ' + cwDepth + ' hop' + (cwDepth === 1 ? '' : 's') +
      ' of the start: <code>' + esc(reach.join(', ')) + '</code> — computed separately by ' +
      'breadth-first search, and compared against this crawl by the test suite.</div>';

    var em = cwCrawl('a.example', cwDepth, { visited: true });
    h += '<div class="cr-emails"><div class="pp-cap">what the harvester would collect</div>' +
      (em.emails.length
        ? em.emails.map(function (e) { return '<code>' + esc(e) + '</code>'; }).join(' ')
        : '<span class="pp-note">nothing at this depth</span>') + '</div>';

    out.innerHTML = h;
  }
