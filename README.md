# StudyKit

**Revision notes that compute.** Each university module is a single self-contained HTML
file — open it in a browser and you get the notes, interactive tools that run the actual
algorithms, self-marking questions generated fresh every time, full-text search, and a
mock exam that scores you per topic.

No build step. No server. No dependencies. It works offline.

**[→ Open the notes](https://yourname.github.io/studykit/)**

---

## What's in it

| Module | Sections | Tools | Question generators | Figures |
|---|---|---|---|---|
| Introduction to AI | 40 | 33 | 43 | 44 |
| Programming Language Design | 11 | 24 | 10 | 4 |
| Operating Systems | 12 | — | — | 1 |

Roughly 29,000 lines of JavaScript across the three, all inline and dependency-free.

---

## Why it isn't just a notes site

**The tools execute the algorithms.** Value iteration really sweeps the grid. UCB really
picks the arm. The decision tree really computes every Gini-Split and rebuilds itself when
you edit the dataset. Nothing is a pre-rendered picture of a result — change an input and
everything downstream recomputes.

**Questions are generated, not stored.** Numbers are randomised on every draw, and answers
are marked by the same code the tools use, so you can't learn the answers by repetition.
Every question explains its own working when you get it wrong.

**Every figure is computed.** No screenshots of lecture slides. The overfitting plots come
from a real polynomial fit; the ε-greedy curves from a 400-run simulation; the dendrogram
from an actual complete-linkage merge; the A\* map from the real graph.

**The numbers are verified.** Each module has a test suite that loads the real page in
jsdom, drives the real tools, and checks results against independently derived values.

That last point caught several genuine errors in the source lecture material:

- A decision tree figure whose printed class labels contradicted its own class-count
  vectors in three nodes.
- A value-iteration figure whose U₁ map was inconsistent with its own converged map.
- A proposition with a factor-of-2 mismatch against the chapter's own summation convention.
- Seven exercises whose printed solution boxes were empty, worked from scratch and
  cross-checked in exact rational arithmetic.

---

## Running the tests

```bash
npm install
npm test
```

```
  running intro-to-ai.test.js …                229 passed (6003ms)
  running landing.test.js …                      6 passed (448ms)
  running operating-systems.test.js …           19 passed (1786ms)
  running programming-language-design.test.js … 127 passed (3451ms)

381 / 381 assertions passed across 4 suites in 15.6s
```

Run one suite with `node tests/run.js intro`.

The suites are in two layers:

- **Structural invariants** in `tests/lib/harness.js`, applied to every module: no duplicate
  element ids, no dead internal links, every tool registered and rendering without errors,
  no unresolved template literals or leaked `undefined`/`NaN`, every section reachable
  through the nav, no runtime warnings.
- **Correctness tests** per module, asserting the mathematics. For example:

```js
// A* on the Romania graph must find the optimal path and never expand Zerind —
// the cheapest first step, and the whole point of the worked example.
s.same('A* expansion order', frames.map(f => f.pick),
  ['ARAD', 'D', 'E', 'F', 'G', 'BUCHAREST']);
s.near('A* path cost is 418', last.cost, 140 + 80 + 97 + 101);
s.ok('A* never expands B', frames.every(f => f.pick !== 'B'));

// A value-iteration guarantee: information moves exactly one square per sweep,
// so a square d steps from a terminal cannot change before sweep d.
s.ok('no square gains value before information can reach it', violations === 0);

// Type inference must agree with a Haskell compiler, and reject what it rejects.
s.ok('infers \\x y z -> x + y + z', sameType(got, 'Num a => a -> a -> a -> a'));
s.ok('rejects \\x -> x x  (infinite type — the occurs check)', rejected);
```

The question banks are fuzzed rather than enumerated: 3,000 draws per run, each checked to
be self-consistent — the stated answer is accepted by its own marker, and no wrong choice is.

---

## Structure

```
index.html                      landing page
modules/
  intro-to-ai.html              one self-contained file per module
  programming-language-design.html
  operating-systems.html
tests/
  lib/harness.js                jsdom loader + shared structural checks
  *.test.js                     one suite per module
  run.js                        runner
.github/workflows/ci.yml        test on push, deploy to Pages on main
```

Each module file contains its own CSS, its own engine and its own content. That's a
deliberate trade: it means duplication between modules, but it also means any single file
can be emailed, printed, or opened from a USB stick in an exam-prep room with no wifi,
and will still work in five years.

---

## Adding your own module

See [`docs/AUTHORING.md`](docs/AUTHORING.md). Short version: copy the closest existing
module, replace the content sections, register your tools in `TOOL_RUNNERS`, add question
generators to `QZ_GEN`, and add a suite in `tests/`. The structural checks apply
automatically.

---

## Licence

MIT for the software — tools, generators, search, exam, figures, tests.

**Not** for the course content. Definitions, exercise text and some figures derive from
lecture material owned by its authors and institutions. If you reuse this project, replace
the module content with your own or get permission. See [LICENSE](LICENSE).
