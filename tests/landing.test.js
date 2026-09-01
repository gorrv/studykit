'use strict';
/** Landing page — every module card must point at a file that exists. */

const { Suite, DIST } = require('./lib/harness');
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

module.exports = async function run() {
  const s = new Suite('landing');
  const file = path.join(DIST, 'index.html');
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'),
    { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });

  await new Promise(r => setTimeout(r, 400));
  const doc = dom.window.document;
  const cards = Array.from(doc.querySelectorAll('a.card'));

  s.ok('lists at least one module', cards.length > 0);
  cards.forEach(a => {
    const href = a.getAttribute('href');
    s.ok(`card links to a real file: ${href}`, fs.existsSync(path.join(DIST, href)));
  });

  // Every built module should be listed, so none silently goes missing.
  const onDisk = fs.readdirSync(path.join(DIST, 'modules')).filter(f => f.endsWith('.html'));
  const linked = cards.map(a => path.basename(a.getAttribute('href')));
  const unlisted = onDisk.filter(f => linked.indexOf(f) < 0);
  s.ok('every module file is linked from the landing page', unlisted.length === 0, unlisted.join(', '));

  s.ok('theme toggle flips the attribute', (() => {
    const before = doc.documentElement.getAttribute('data-theme');
    dom.window.tog();
    return doc.documentElement.getAttribute('data-theme') !== before;
  })());

  return s;
};
