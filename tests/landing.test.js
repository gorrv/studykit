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

  // The card stats are hand-written and were wrong within a day of the module
  // changing. Check them against the module they describe.
  const { loadModule } = require('./lib/harness');
  for (const a of cards) {
    const file = path.basename(a.getAttribute('href'));
    const stats = {};
    Array.from(a.querySelectorAll('.stat')).forEach(el => {
      const mm = el.textContent.trim().match(/^(\d+)\s+(.+)$/);
      if (mm) stats[mm[2].toLowerCase()] = Number(mm[1]);
    });
    if (!Object.keys(stats).length) continue;

    const mod = await loadModule(file, 1500);
    const actual = {
      sections: mod.$$('.topic-section').length,
      tools: mod.$$('.tool[data-run]').length,
      'question generators': (mod.window.QZ_GEN || []).length,
      figures: (mod.raw.match(/<svg/g) || []).length,
      'exam questions': (mod.window.mockQuestionBank || []).length,
    };

    Object.keys(stats).forEach(k => {
      if (actual[k] === undefined) return;
      s.ok(`${file}: card claims ${stats[k]} ${k}`, actual[k] === stats[k],
        `card says ${stats[k]}, module has ${actual[k]}`);
    });
  }

  s.ok('theme toggle flips the attribute', (() => {
    const before = doc.documentElement.getAttribute('data-theme');
    dom.window.tog();
    return doc.documentElement.getAttribute('data-theme') !== before;
  })());

  return s;
};
