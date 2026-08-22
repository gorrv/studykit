'use strict';
/**
 * Operating Systems — structural tests only.
 *
 * This module is prose. It has no tools and no question bank yet, so there
 * is nothing computational to verify; the structural invariants still apply.
 */

const { loadModule, Suite, checkStructure } = require('./lib/harness');

module.exports = async function run() {
  const s = new Suite('operating-systems');
  const m = await loadModule('operating-systems.html', 1200);

  await checkStructure(s, m);
  s.ok('has content sections', m.$$('section').length >= 5, `${m.$$('section').length} sections`);

  return s;
};
