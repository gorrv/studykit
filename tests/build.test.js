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

    // Both palettes must define every token the stylesheet reads. A token
    // defined only in the light palette is invisible in dark mode, which is
    // the one CSS bug the DOM tests can never see.
    const css = (built.html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
    const used = new Set((css.match(/var\(\s*(--[\w-]+)/g) || [])
      .map(v => v.replace(/var\(\s*/, '')));

    const palette = re => {
      const block = css.match(re);
      return new Set(block ? (block[1].match(/(--[\w-]+)\s*:/g) || [])
        .map(d => d.replace(/\s*:$/, '')) : []);
    };
    const light = palette(/:root[^{]*\{([\s\S]*?)\}/);
    const dark = palette(/html\[data-theme="dark"\][^{]*\{([\s\S]*?)\}/);

    // Some modules declare extra tokens in a second :root block; collect those too.
    let m2, extra = /:root[^{]*\{([\s\S]*?)\}/g;
    while ((m2 = extra.exec(css))) {
      (m2[1].match(/(--[\w-]+)\s*:/g) || []).forEach(d => light.add(d.replace(/\s*:$/, '')));
    }
    let m3, extraDark = /html\[data-theme="dark"\][^{]*\{([\s\S]*?)\}/g;
    while ((m3 = extraDark.exec(css))) {
      (m3[1].match(/(--[\w-]+)\s*:/g) || []).forEach(d => dark.add(d.replace(/\s*:$/, '')));
    }

    const undef = [...used].filter(t => !light.has(t));
    s.ok(`${id}: every CSS token is defined`, undef.length === 0, undef.join(', '));

    const lightOnly = [...used].filter(t => light.has(t) && !dark.has(t));
    s.ok(`${id}: every token used has a dark value`, lightOnly.length === 0, lightOnly.join(', '));
  }

  // Orphan check: every source file should reach a module, except the
  // templates themselves and the static site files copied verbatim.
  const all = walk(SRC).filter(f =>
    !f.endsWith(path.join('index.html')) || !f.startsWith('modules'));
  const orphans = all.filter(f =>
    !includedByAll.has(f) &&
    !f.startsWith('site' + path.sep));
  s.ok('no orphaned source files', orphans.length === 0, orphans.slice(0, 5).join(', '));

  // The built site must carry its own landing page.
  s.ok('dist has a landing page', fs.existsSync(path.join(DIST, 'index.html')));
  s.ok('dist has .nojekyll', fs.existsSync(path.join(DIST, '.nojekyll')));

  return s;
};
