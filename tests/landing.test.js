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
  const { loadModule } = require('./lib/harness');
  const onDisk = fs.readdirSync(path.join(DIST, 'modules')).filter(f => f.endsWith('.html'));
  const linked = cards.map(a => path.basename(a.getAttribute('href')));
  const unlisted = onDisk.filter(f => linked.indexOf(f) < 0);

  s.ok('every module file is linked from the landing page', unlisted.length === 0,
    unlisted.join(', '));

  // Modules still being written carry `.soon` on the card, which dashes the
  // border and says "no topics yet". That label is a promise about the file
  // behind it, and both directions of it rot: a module can gain topics and go
  // on looking unfinished, or be marked ready while still empty. So the class
  // is checked against the module rather than trusted — which also means
  // nobody has to remember to remove it.
  for (const a of cards) {
    const file = path.basename(a.getAttribute('href'));
    const mod = await loadModule(file, 1200);
    const sections = mod.$$('.topic-section').map(x => x.id);
    const empty = sections.length === 1 && sections[0] === 'start';
    const marked = a.classList.contains('soon');

    if (marked) {
      s.ok(`${file}: marked "in progress", and really is`, empty,
        `card says no topics yet, but the module has: ${sections.join(', ')}`);
    } else {
      s.ok(`${file}: not marked "in progress", and has topics`, !empty,
        'the module is still just a start page — the card needs class="soon"');
    }
  }

  // Each year heading should have cards under it, or it is an empty promise.
  const years = Array.from(doc.querySelectorAll('.year'));
  s.ok('the modules are grouped by year', years.length > 0);
  years.forEach(y => {
    const heading = y.querySelector('h3');
    const grid = y.nextElementSibling && y.nextElementSibling.classList.contains('cards')
      ? y.nextElementSibling
      : (y.nextElementSibling && y.nextElementSibling.nextElementSibling);
    const n = grid ? grid.querySelectorAll('a.card').length : 0;
    s.ok(`${heading ? heading.textContent.trim() : '?'} has modules under it`, n > 0);
  });

  // The card stats are hand-written and were wrong within a day of the module
  // changing. Check them against the module they describe.
  const byTitle = {};
  for (const a of cards) {
    const file = path.basename(a.getAttribute('href'));
    const stats = {};
    Array.from(a.querySelectorAll('.stat')).forEach(el => {
      const mm = el.textContent.trim().match(/^(\d+)\s+(.+)$/);
      if (mm) stats[mm[2].toLowerCase()] = Number(mm[1]);
    });

    const mod = await loadModule(file, 1500);
    const actual = {
      sections: mod.$$('.topic-section').length,
      tools: mod.$$('.tool[data-run]').length,
      'question generators': (mod.window.QZ_GEN || []).length,
      figures: (mod.raw.match(/<svg/g) || []).length,
      'exam questions': (mod.window.mockQuestionBank || []).length,
    };
    const h3 = a.querySelector('h3');
    if (h3) byTitle[h3.textContent.trim()] = actual;

    Object.keys(stats).forEach(k => {
      if (actual[k] === undefined) return;
      s.ok(`${file}: card claims ${stats[k]} ${k}`, actual[k] === stats[k],
        `card says ${stats[k]}, module has ${actual[k]}`);
    });
  }

  // The README repeats the same figures in a table. It went stale twice before
  // anyone noticed, so check it against the modules too — same numbers, one
  // source of truth, no hand-updating.
  const readme = fs.readFileSync(path.join(DIST, '..', 'README.md'), 'utf8');
  const cells = readme.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('|') && !/^\|[\s|:-]+\|$/.test(l))
    .map(l => l.slice(1, -1).split('|').map(c => c.trim()));

  // Find the header row and read the columns off it by name, so a column can
  // be added or moved without silently disabling the check below. Matching by
  // position is what would make that failure quiet.
  const header = cells.find(r => r.some(c => /^module$/i.test(c)));
  s.ok('the README has a module table with a header', !!header);
  const where = {};
  (header || []).forEach((c, i) => { where[c.toLowerCase()] = i; });
  const nameAt = where.module;

  const rows = cells.filter(r => r !== header && nameAt !== undefined && byTitle[r[nameAt]]);
  s.ok('the README table lists every module', rows.length === Object.keys(byTitle).length,
    `README has ${rows.length} recognised rows, the landing page has ${Object.keys(byTitle).length} cards`);

  ['sections', 'tools', 'question generators', 'figures'].forEach(col => {
    const at = where[col];
    if (at === undefined) return;
    rows.forEach(r => {
      const claimed = Number(r[at]);
      const name = r[nameAt];
      if (!Number.isFinite(claimed)) return;
      s.ok(`README: ${name} — ${claimed} ${col}`, byTitle[name][col] === claimed,
        `README says ${claimed}, module has ${byTitle[name][col]}`);
    });
  });

  s.ok('theme toggle flips the attribute', (() => {
    const before = doc.documentElement.getAttribute('data-theme');
    dom.window.tog();
    return doc.documentElement.getAttribute('data-theme') !== before;
  })());

  return s;
};
