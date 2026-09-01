'use strict';
/**
 * The build itself.
 *
 * A source tree fails quietly in two directions: an include that points
 * nowhere (loud, the build throws) and a file nothing includes (silent — it
 * looks like live code, gets maintained, and ships to no one). These check
 * both, plus that the built output really is self-contained.
 */

const fs = require('fs');
const path = require('path');
const { Suite, ROOT, DIST } = require('./lib/harness');
const { buildModule } = require('../build');

const SRC = path.join(ROOT, 'src');

/** Every file under a directory, as paths relative to src/. */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(path.relative(SRC, full));
  }
  return out;
}

module.exports = async function run() {
  const s = new Suite('build');

  const ids = fs.readdirSync(path.join(SRC, 'modules'))
    .filter(d => fs.statSync(path.join(SRC, 'modules', d)).isDirectory());
  s.ok('there are modules to build', ids.length > 0);

  const includedByAll = new Set();
  for (const id of ids) {
    let built = null;
    try {
      built = buildModule(id);
    } catch (e) {
      s.ok(`${id}: builds`, false, e.message);
      continue;
    }
    s.ok(`${id}: builds`, true);
    built.used.forEach(u => includedByAll.add(u));

    // Self-contained: nothing may be fetched at runtime except web fonts,
    // which degrade to a system stack offline.
    const external = (built.html.match(/<script[^>]+\bsrc=|<link[^>]+\brel="stylesheet"[^>]*>/g) || [])
      .filter(tag => !/fonts\.googleapis\.com/.test(tag));
    s.ok(`${id}: no external scripts or stylesheets`, external.length === 0, external.join(' | '));

    s.ok(`${id}: no unresolved include`, built.html.indexOf('@include') < 0);
    s.ok(`${id}: has a title`, /<title>[^<]+<\/title>/.test(built.html));
    s.ok(`${id}: closes its html`, built.html.trim().endsWith('</html>'));
  }

  // Orphan check: every source file should reach a module, except the
  // templates themselves and the static site files copied verbatim.
  const all = walk(SRC).filter(f =>
    !f.endsWith(path.join('index.html')) || !f.startsWith('modules'));
  const orphans = all.filter(f =>
    !includedByAll.has(f) &&
    !f.startsWith('site' + path.sep) &&
    path.basename(f) !== 'module.json');
  s.ok('no orphaned source files', orphans.length === 0, orphans.slice(0, 5).join(', '));

  // The built site must carry its own landing page.
  s.ok('dist has a landing page', fs.existsSync(path.join(DIST, 'index.html')));
  s.ok('dist has .nojekyll', fs.existsSync(path.join(DIST, '.nojekyll')));

  return s;
};
