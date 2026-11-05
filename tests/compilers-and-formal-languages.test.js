'use strict';
/**
 * Compilers and Formal Languages.
 *
 * A new module: the start page and nothing else yet. The structural
 * invariants still apply, and they are the reason this file exists now
 * rather than later — a shell that is already under test cannot acquire a
 * duplicate id, a dead link or an unstyled class quietly as it fills up.
 *
 * Every topic added here should bring assertions with it, checking the
 * mathematics against a value derived some other way. Until then there is
 * nothing to assert, and this suite says so rather than pretending.
 */

const { loadModule, Suite, checkStructure, checkQuestionBank } = require('./lib/harness');

module.exports = async function run() {
  const s = new Suite('compilers-and-formal-languages');
  const m = await loadModule('compilers-and-formal-languages.html');

  await checkStructure(s, m);
  checkQuestionBank(s, m);

  // The start page is the whole module for now, so check it is actually
  // usable: it has to be the section that shows, and its sidebar links have
  // to land somewhere (checkStructure catches dead links, not empty navs).
  const secs = m.$$('.topic-section');
  s.is('the start page is the only section so far', secs.length, 1,
    secs.map(x => x.id).join(', '));
  s.is('and it is the one that shows', secs[0] && secs[0].id, 'start');

  const links = m.$$('nav a[href^="#"]');
  s.ok('the sidebar offers a way into it', links.length > 0);

  return s;
};
