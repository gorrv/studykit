#!/usr/bin/env node
'use strict';
/**
 * Test runner.
 *
 *   node tests/run.js              run everything
 *   node tests/run.js intro        run only suites whose name matches
 *
 * Exits non-zero if anything fails, so CI can gate on it.
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const filter = process.argv[2];

const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.test.js'))
  .filter(f => !filter || f.includes(filter))
  .sort();

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

  for (const file of files) {
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
    DIM(` across ${suites.length} suites in ${secs}s`));

  process.exit(failed.length ? 1 : 0);
})();
