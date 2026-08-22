'use strict';
/**
 * Programming Language Design — correctness tests.
 *
 * The interesting piece here is the Hindley–Milner type inference engine:
 * it should infer the same types a Haskell compiler would, and reject the
 * things a compiler would reject.
 */

const { loadModule, Suite, checkStructure, checkQuestionBank } = require('./lib/harness');

module.exports = async function run() {
  const s = new Suite('programming-language-design');
  const m = await loadModule('programming-language-design.html');
  const w = m.window;

  await checkStructure(s, m);
  checkQuestionBank(s, m, 1500);

  if (typeof w.hmTypeOf !== 'function') {
    s.ok('type inference engine is exposed', false, 'window.hmTypeOf missing');
    return s;
  }

  // Types the engine must infer, written as a Haskell programmer would.
  const infers = [
    ['\\x -> x',                 'a -> a'],
    ['\\x y -> x',               'a -> b -> a'],
    ['square x = x * x',         'Num a => a -> a'],
    ['\\x y z -> x + y + z',     'Num a => a -> a -> a -> a'],
    ['(.)',                      '(b -> c) -> (a -> b) -> a -> c'],
    ['map',                      '(a -> b) -> [a] -> [b]'],
    ['(+1)',                     'Num a => a -> a'],
    ['filter (>0)',              '(Num a, Ord a) => [a] -> [a]'],
  ];
  infers.forEach(([src, expected]) => {
    let got = null;
    try { got = w.hmTypeOf(src); } catch (e) { /* reported below */ }
    const shown = got && (got.full || got.type);
    s.ok(`infers  ${src}`, !!shown && w.hmSameType(shown, expected),
      `expected ${expected}, got ${shown}`);
  });

  // Programs that must fail to typecheck.
  const rejects = [
    ['square square 3', 'applying a function where a number is required'],
    ['\\x -> x x',      'infinite type — the occurs check'],
    ['1 + True',        'no Num instance for Bool'],
    ['head 5',          'a number is not a list'],
  ];
  rejects.forEach(([src, why]) => {
    let threw = false, res = null;
    try { res = w.hmTypeOf(src); } catch (e) { threw = true; }
    const rejected = threw || !res || res.error || !(res.full || res.type);
    s.ok(`rejects ${src}  (${why})`, rejected, 'unexpectedly typechecked');
  });

  // Alpha-equivalence: variable names must not matter when marking.
  s.ok('a -> a equals b -> b', w.hmSameType('a -> a', 'b -> b'));
  s.ok('a -> b differs from a -> a', !w.hmSameType('a -> b', 'a -> a'));

  return s;
};
