'use strict';
/**
 * Test harness for StudyKit modules.
 *
 * Each module is a single self-contained HTML file with its own inline engine.
 * The only honest way to test it is to load the real file in a DOM, let its
 * scripts run, and then drive it exactly as a user would — so that is what
 * this does. No mocking, no reaching into internals that the page does not
 * itself expose on `window`.
 */

const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Tests run against the built output, not the source tree, so that what is
 * asserted is the artifact a student actually opens. `npm test` builds first.
 */
const DIST = path.join(ROOT, 'dist');

/** Warnings we expect from jsdom and do not care about. */
const IGNORED = /Could not parse CSS|Not implemented:/i;

/**
 * Load a module file, run its scripts, and resolve once its DOMContentLoaded
 * handlers have had a chance to render every tool.
 *
 * @param {string} file   e.g. 'intro-to-ai.html'
 * @param {number} settle ms to wait for the page to finish initialising
 * @returns {Promise<{window, doc, warnings, $, $$, text, html}>}
 */
function loadModule(file, settle = 2500) {
  const full = path.join(DIST, 'modules', file);
  if (!fs.existsSync(full)) {
    throw new Error(fs.existsSync(DIST)
      ? 'no such module: ' + path.relative(ROOT, full)
      : 'dist/ not found — run `node build.js` first (npm test does this for you)');
  }

  const warnings = [];
  const vc = new VirtualConsole()
    .on('jsdomError', e => { if (!IGNORED.test(String(e.message))) warnings.push('jsdomError: ' + e.message); })
    .on('error', e => warnings.push('console.error: ' + e));

  const dom = new JSDOM(fs.readFileSync(full, 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  const { window } = dom;
  const doc = window.document;

  return new Promise(resolve => setTimeout(() => resolve({
    window, doc, warnings,
    raw: fs.readFileSync(full, 'utf8'),
    $: sel => doc.querySelector(sel),
    $$: sel => Array.from(doc.querySelectorAll(sel)),
    /** textContent of an element by id, or '' */
    text: id => { const e = doc.getElementById(id); return e ? e.textContent : ''; },
    /** innerHTML of an element by id, or '' */
    html: id => { const e = doc.getElementById(id); return e ? e.innerHTML : ''; },
  }), settle));
}

/** Collects assertions for one test file and reports at the end. */
class Suite {
  constructor(name) {
    this.name = name;
    this.passed = 0;
    this.failures = [];
    this.started = Date.now();
  }

  /** Assert `cond` is truthy. `detail` is printed only on failure. */
  ok(label, cond, detail) {
    if (cond) this.passed++;
    else this.failures.push({ label, detail });
    return !!cond;
  }

  /** Assert two numbers are equal within `tol`. */
  near(label, actual, expected, tol = 1e-9) {
    const good = Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
    return this.ok(label, good, `expected ≈ ${expected}, got ${actual}`);
  }

  /**
   * Assert `actual === expected`, for exact values.
   *
   * `same` would do the job via JSON, but it reports mismatches as quoted
   * blobs; for a count or a single string this reads better and puts the
   * two values side by side. `detail` is appended when a failure needs
   * more context than the two values give.
   */
  is(label, actual, expected, detail) {
    const good = actual === expected;
    return this.ok(label, good,
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` +
      (detail ? ` — ${detail}` : ''));
  }

  /** Assert `actual` deep-equals `expected` by JSON shape. */
  same(label, actual, expected) {
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    return this.ok(label, a === b, `expected ${b}, got ${a}`);
  }

  /** Assert a string contains a substring or matches a regex. */
  has(label, haystack, needle) {
    const good = needle instanceof RegExp
      ? needle.test(haystack)
      : String(haystack).indexOf(needle) >= 0;
    return this.ok(label, good, `missing: ${needle}`);
  }

  get failed() { return this.failures.length; }
  get total() { return this.passed + this.failed; }
  get ms() { return Date.now() - this.started; }
}

/**
 * Structural invariants every module must satisfy, whatever its subject.
 * Kept here so a new module gets them for free.
 */
async function checkStructure(s, m) {
  const ids = m.$$('[id]').map(e => e.id);
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  s.ok('no duplicate element ids', dupes.length === 0, dupes.join(', '));

  const dead = m.$$('a[href^="#"]')
    .map(a => a.getAttribute('href').slice(1))
    .filter(h => h && !m.doc.getElementById(h));
  s.ok('no dead internal links', dead.length === 0, [...new Set(dead)].join(', '));

  s.ok('no NUL bytes in source', m.raw.indexOf('\u0000') < 0);
  s.ok('has a title', !!m.doc.title, m.doc.title);

  /* Every class on the page has a rule somewhere in the page.
   *
   * Modules are built by concatenating a shared stylesheet with a
   * module-local one, so a class defined in *another* module's local sheet
   * looks fine in the source tree and renders unstyled here. That is not a
   * cosmetic nitpick: it is how the non-regularity walkthrough came to draw
   * with no borders, no step numbers and no spacing, and how a grid-world
   * wall came to look like an ordinary empty square. Both were invisible to
   * every other check in this file, because the markup was perfectly valid.
   *
   * A class may legitimately carry no rule of its own when it only ever
   * selects other things — ix-mode-dim is the default reveal mode, and the
   * dimming comes from .ix-future — so those are named rather than waved
   * through in bulk.
   */
  const STYLELESS_BY_DESIGN = new Set(['ix-mode-dim']);
  const sheets = [...m.doc.querySelectorAll('style')].map(t => t.textContent).join('\n');
  const defined = new Set([...sheets.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)].map(x => x[1]));
  const applied = new Map();
  m.$$('[class]').forEach(el => {
    String(el.getAttribute('class')).split(/\s+/).filter(Boolean).forEach(c => {
      if (!applied.has(c)) applied.set(c, el.tagName.toLowerCase());
    });
  });
  const unstyled = [...applied.keys()]
    .filter(c => !defined.has(c) && !STYLELESS_BY_DESIGN.has(c))
    .sort();
  s.ok('every class used on the page has a rule in the page',
    unstyled.length === 0,
    unstyled.map(c => `${c} <${applied.get(c)}>`).join(', '));

  /* The reset control is the same control in every module, so it should be
   * the same markup in every module.
   *
   * Putting class="tool-reset" straight on the button looks right and passes
   * the check above -- .tool-reset is a real rule -- but it is the rule for
   * the *wrapper*, so the button loses .tool-btn.ghost and renders as a bare
   * browser button. The result is one module whose reset looks nothing like
   * the others, which is the kind of thing a reader notices immediately and
   * a test suite never does.
   */
  const resets = m.$$('[onclick*="toolReset"]');
  const malformed = resets.filter(el => {
    const cls = String(el.getAttribute('class') || '').split(/\s+/);
    return el.tagName !== 'BUTTON' ||
           !cls.includes('tool-btn') || !cls.includes('ghost') ||
           !el.parentElement ||
           !String(el.parentElement.getAttribute('class') || '').split(/\s+/).includes('tool-reset');
  });
  s.ok('every reset control is a .tool-btn.ghost button inside a .tool-reset wrapper',
    malformed.length === 0,
    malformed.map(el => `<${el.tagName.toLowerCase()} class="${el.getAttribute('class')}">`).join(', '));

  // Every registered tool must be callable and must render without erroring.
  const runners = m.$$('.tool[data-run]').map(t => t.getAttribute('data-run'));
  const unreachable = runners.filter(r =>
    typeof m.window[r] !== 'function' &&
    !(m.window.TOOL_RUNNERS && m.window.TOOL_RUNNERS[r]));
  s.ok('every tool has a registered runner', unreachable.length === 0, unreachable.join(', '));

  m.$$('.tool[data-run]').forEach(tool => {
    const name = tool.getAttribute('data-run');
    const out = tool.querySelector('.tool-output');
    if (!out) return s.ok(`${name}: has an output pane`, false);
    // A tool may legitimately render only a prompt until the user drives it
    // (the self-test generator does), so the invariant is "rendered without
    // erroring", not "rendered a lot".
    s.ok(`${name}: rendered`, out.textContent.trim().length > 0);
    s.ok(`${name}: no error box`, !/tool-error/.test(out.innerHTML));
    s.ok(`${name}: no unresolved template`, out.innerHTML.indexOf('${') < 0);
    // Only flag `undefined` / `NaN` where a *value* should be. Prose may say
    // "Precision is undefined" quite deliberately — that is the 0/0 case.
    const leaked = out.innerHTML.match(/(?:>|=|:)\s*(undefined|NaN)\s*(?:<|,|\.|$)/);
    s.ok(`${name}: no leaked undefined/NaN value`, !leaked,
      leaked ? leaked[0] : '');
  });

  // The engine renders every tool on load and collects failures rather than
  // throwing, so a broken tool can't blank the page. Nothing collects them at
  // runtime, so this is where they have to be caught.
  const bootErrors = m.window.TOOL_BOOT_ERRORS || [];
  s.ok('every tool booted', bootErrors.length === 0, bootErrors.slice(0, 4).join(' | '));

  // Every handler a tool wires up must actually exist.
  //
  // A tool can render perfectly and still be dead: IX.player generates
  // onclick="<id>Step(...)" from the id you hand it, so a module that never
  // defines that function, or that already uses the name for something else,
  // ships buttons which throw the moment anyone presses them. Rendering tests
  // cannot see this, because nothing is wrong until a click happens.
  {
    const missing = new Set();
    m.$$('[onclick]').forEach(el => {
      // Blank out string arguments first. A handler like
      // setExpr('map f xs') carries source code in a literal, and every
      // identifier in it would otherwise look like a call.
      const src = (el.getAttribute('onclick') || '')
        .replace(/'(\\.|[^'\\])*'/g, "''")
        .replace(/"(\\.|[^"\\])*"/g, '""');
      let call;
      const names = /(^|[^\w.])([A-Za-z_$][\w$]*)\s*\(/g;
      while ((call = names.exec(src))) {
        const fn = call[2];
        if (['if', 'return', 'for', 'while', 'typeof', 'new', 'Number', 'String', 'parseInt', 'parseFloat'].includes(fn)) continue;
        if (typeof m.window[fn] !== 'function') missing.add(fn);
      }
    });
    s.ok('every onclick handler resolves to a function',
      missing.size === 0, [...missing].join(', '));
  }

  // Every transport bar must actually transport.
  //
  // The check above only notices a handler that is *absent*. It cannot notice
  // one that exists but is the wrong function — which is the more likely
  // mistake, because IX.player derives the handler name from the id you give
  // it, so any module that already uses that name silently wires the buttons
  // to something else. The only way to tell is to press the button and see
  // whether anything moved.
  m.$$('.tool[data-run]').forEach(tool => {
    const name = tool.getAttribute('data-run');
    const out = tool.querySelector('.tool-output');
    const next = tool.querySelector('.ix-bar .ix-btn.nav[title="Next step"]');
    if (!out || !next || next.hasAttribute('disabled')) return;

    const before = out.innerHTML;
    try {
      next.dispatchEvent(new m.window.Event('click', { bubbles: true }));
    } catch (e) {
      return s.ok(`${name}: the transport bar steps forward`, false, e.message);
    }
    s.ok(`${name}: the transport bar steps forward`, out.innerHTML !== before,
      'pressing ▶ changed nothing — the handler is probably wired to the wrong function');
  });

  // Every button in a tool must do something when pressed.
  //
  // "Does something" cannot mean "changes the output", because a live tool
  // asked to recompute an unchanged input correctly produces the same answer.
  // What it must do is re-render — replace the children of the output pane —
  // which a MutationObserver can see even when the HTML is identical. A button
  // that neither re-renders nor throws is wired to nothing.
  m.$$('.tool[data-run]').forEach(tool => {
    const name = tool.getAttribute('data-run');
    const pane = tool.querySelector('.tool-output');
    if (!pane) return;

    const label = b => b.textContent.trim();
    const labels = Array.from(tool.querySelectorAll('button.tool-btn'))
      .filter(b => !/reset tool/i.test(b.textContent))
      .map(label);
    if (!labels.length) return;

    // MutationObserver callbacks are delivered asynchronously, so a counter
    // would still be zero when this loop read it. takeRecords() drains the
    // queue synchronously, which is what makes click-then-check work.
    const obs = new m.window.MutationObserver(() => {});
    obs.observe(pane, { childList: true });

    const dead = [];
    labels.forEach(text => {
      // Buttons rendered inside the output pane are destroyed and rebuilt by
      // the previous click, so the node captured above is detached and
      // clicking it does nothing. Find the live one each time.
      const b = Array.from(tool.querySelectorAll('button.tool-btn')).find(x => label(x) === text);
      if (!b || b.hasAttribute('disabled')) return;

      obs.takeRecords();
      try {
        b.dispatchEvent(new m.window.Event('click', { bubbles: true }));
      } catch (e) {
        return dead.push(`${text} threw: ${e.message}`);
      }
      if (obs.takeRecords().length === 0) dead.push(text);
    });
    obs.disconnect();

    s.ok(`${name}: all ${labels.length} buttons re-render the output`,
      dead.length === 0, `did nothing: ${dead.join(' | ')}`);
  });

  // Every section must be reachable through the nav without throwing.
  if (typeof m.window.showSection === 'function') {
    m.$$('.topic-section').forEach(sec => {
      try {
        m.window.showSection(sec.id);
        s.ok(`showSection(${sec.id})`, m.doc.getElementById(sec.id).classList.contains('active'));
      } catch (e) {
        s.ok(`showSection(${sec.id})`, false, e.message);
      }
    });
  }

  s.ok('no runtime warnings', m.warnings.length === 0, m.warnings.slice(0, 3).join(' | '));
}

/**
 * Draw `n` questions from the module's generator bank and check each is
 * internally consistent: it has a prompt and an explanation, its stated
 * answer is accepted by its own marker, and no wrong choice is.
 */
function checkQuestionBank(s, m, n = 2000) {
  const GEN = m.window.QZ_GEN;

  // This used to return quietly when QZ_GEN was not on window, which meant a
  // module whose bank was not exposed appeared to pass thousands of checks it
  // had never run. If a module ships a question tool, its bank must be
  // reachable.
  const hasQuizTool = m.$$('.tool[data-run="qzNext"]').length > 0;
  if (!Array.isArray(GEN)) {
    s.ok('question bank is reachable from the page', !hasQuizTool,
      'the page has a question tool but window.QZ_GEN is not exposed');
    return;
  }
  if (!GEN.length) {
    s.ok('question bank is not empty', !hasQuizTool, 'QZ_GEN is empty');
    return;
  }

  let made = 0, bad = 0, firstBad = null;
  for (let i = 0; i < n; i++) {
    const gen = GEN[i % GEN.length];
    let q = null;
    for (let k = 0; k < 25 && !q; k++) {
      try { q = gen.make(); } catch (e) { q = null; }   // generators may reject a draw
    }
    if (!q) { bad++; continue; }
    made++;

    const fail = reason => { bad++; if (!firstBad) firstBad = `${gen.topic}: ${reason}`; };

    if (!q.prompt || !q.explain || q.answer === undefined) { fail('missing prompt/explain/answer'); continue; }

    if (q.kind === 'choice') {
      if (q.choices.indexOf(q.answer) < 0) { fail('answer not among the choices'); continue; }
      if (new Set(q.choices).size !== q.choices.length) { fail('duplicate choices'); continue; }
      if (!q.check(q.answer).ok) { fail('marker rejects its own answer'); continue; }
      if (q.choices.filter(c => c !== q.answer).some(w => q.check(w).ok)) { fail('marker accepts a wrong choice'); }
    } else {
      // Free text. Not every module answers with a number — the type-inference
      // and term-unification questions answer with syntax — so the invariant
      // is that the marker accepts what the question says the answer is, in
      // whatever form it states it, and rejects something that plainly isn't.
      const stated = String(q.answer);
      const numericTail = (stated.match(/-?[0-9]+\.?[0-9]*$/) || [])[0];
      const accepts = v => { try { return q.check(v).ok; } catch (e) { return false; } };

      if (!accepts(stated) && !(numericTail && accepts(numericTail))) {
        fail('marker rejects its own answer: ' + stated);
        continue;
      }
      if (accepts('banana')) { fail('marker accepts nonsense'); }
    }
  }
  s.ok(`${n} generated questions are self-consistent`, bad === 0,
    `${bad} bad of ${made} made — first: ${firstBad}`);
  s.ok('generator bank is non-trivial', GEN.length >= 5, `${GEN.length} generators`);
}

module.exports = { loadModule, Suite, checkStructure, checkQuestionBank, ROOT, DIST };
