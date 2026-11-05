#!/usr/bin/env node
'use strict';
/**
 * Test runner.
 *
 *   node tests/run.js              run everything
 *   node tests/run.js intro        run only suites whose name matches
 *   node tests/run.js --resume     reuse results for suites already run
 *                                  against this exact tree
 *
 * Exits non-zero if anything fails, so CI can gate on it.
 *
 * About --resume. The total assertion count is only meaningful from a run of
 * everything, and on a slow machine a run of everything can take longer than
 * the operator is able to give one command — at which point the choice is
 * between reporting a number nobody checked and not reporting one. Neither is
 * much good, so instead each suite's result is written out with a hash of the
 * whole tree it was produced from (every built module, every test file, the
 * harness). On a resumed run, a suite whose hash still matches is reported
 * from that record and the rest are run for real; change anything at all and
 * every hash changes, so there is no way for a stale result to be counted.
 * It is off unless asked for, so CI always does the full work.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const args = process.argv.slice(2);
const resume = args.includes('--resume');
const filter = args.find(a => !a.startsWith('-'));

const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.test.js'))
  .filter(f => !filter || f.includes(filter))
  .sort();

/* Everything a suite's result could possibly depend on. Deliberately coarse:
   a per-suite dependency list would resume more often and would be one
   oversight away from counting a result that no longer holds. */
function treeHash() {
  const h = crypto.createHash('sha256');
  const add = dir => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === '.cache' || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) add(full);
      else { h.update(full); h.update(fs.readFileSync(full)); }
    }
  };
  add(path.join(DIR, '..', 'dist'));
  add(DIR);
  try { h.update(fs.readFileSync(path.join(DIR, '..', 'README.md'))); } catch (e) {}
  return h.digest('hex');
}

const TREE = resume ? treeHash() : null;
const RESUME_DIR = path.join(DIR, '.cache', 'suites');

function recall(file) {
  if (!resume) return null;
  try {
    const r = JSON.parse(fs.readFileSync(path.join(RESUME_DIR, file + '.json'), 'utf8'));
    return r.tree === TREE ? r.suite : null;
  } catch (e) { return null; }
}

function remember(file, suite) {
  if (!resume) return;
  try {
    fs.mkdirSync(RESUME_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESUME_DIR, file + '.json'),
      JSON.stringify({ tree: TREE, suite: {
        name: suite.name, passed: suite.passed, failed: suite.failed,
        total: suite.total, ms: suite.ms, failures: suite.failures
      } }));
  } catch (e) { /* a cache that cannot be written is not a failed run */ }
}

if (!files.length) {
  console.error(filter ? `no suites match "${filter}"` : 'no test files found');
  process.exit(1);
}

const BOLD = s => `\x1b[1m${s}\x1b[0m`;
const RED = s => `\x1b[31m${s}\x1b[0m`;
const GREEN = s => `\x1b[32m${s}\x1b[0m`;
const DIM = s => `\x1b[2m${s}\x1b[0m`;

(async () => {
  const started = Date.now();
  const suites = [];

  let reused = 0;
  for (const file of files) {
    const known = recall(file);
    if (known) {
      reused++;
      console.log(DIM(`  ${file} … `) +
        (known.failed ? RED(`${known.failed} failed`) : GREEN(`${known.passed} passed`)) +
        DIM(' (from the last run against this tree)'));
      suites.push(known);
      continue;
    }

    process.stdout.write(DIM(`  running ${file} … `));
    let suite;
    try {
      suite = await require(path.join(DIR, file))();
    } catch (err) {
      console.log(RED('crashed'));
      console.log(RED(`    ${err.stack.split('\n').slice(0, 4).join('\n    ')}`));
      suites.push({ name: file, passed: 0, failed: 1, total: 1, ms: 0, failures: [{ label: 'suite crashed', detail: err.message }] });
      continue;
    }
    console.log(suite.failed ? RED(`${suite.failed} failed`) : GREEN(`${suite.passed} passed`) + DIM(` (${suite.ms}ms)`));
    suites.push(suite);
    remember(file, suite);
  }

  const failed = suites.filter(s => s.failed);
  if (failed.length) {
    console.log('\n' + BOLD('Failures'));
    failed.forEach(s => {
      console.log(`\n  ${BOLD(s.name)}`);
      s.failures.forEach(f => {
        console.log(RED(`    ✗ ${f.label}`));
        if (f.detail) console.log(DIM(`      ${f.detail}`));
      });
    });
  }

  const passed = suites.reduce((n, s) => n + s.passed, 0);
  const total = suites.reduce((n, s) => n + s.total, 0);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log('\n' + BOLD(`${passed} / ${total} assertions passed`) +
    DIM(` across ${suites.length} suites in ${secs}s`) +
    (reused ? DIM(` (${reused} recalled, ${suites.length - reused} run here)`) : ''));

  // The README and the landing page both quote this total in prose. Prose does
  // not get updated when a suite grows, so both went stale — check them here,
  // where the real number is known. Only on a full run: a filtered run has a
  // smaller total and would flag a drift that is not one.
  let drifted = false;
  if (!filter) {
    const claims = [
      ['README.md', /(\d[\d,]*) \/ \1 assertions passed/],
      [path.join('src', 'site', 'index.html'), /([\d,]+) assertions that drive/],
    ];
    for (const [rel, re] of claims) {
      const file = path.join(DIR, '..', rel);
      let text;
      try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
      const m = text.match(re);
      if (!m) {
        console.log(RED(`\n  ✗ ${rel} no longer states an assertion total — the check below is blind`));
        drifted = true;
      } else if (Number(m[1].replace(/,/g, '')) !== total) {
        console.log(RED(`\n  ✗ ${rel} claims ${m[1]} assertions; there are ${total}`));
        drifted = true;
      }
    }
  }

  process.exit(failed.length || drifted ? 1 : 0);
})();
