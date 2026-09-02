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
