# StudyKit

**Revision notes that compute.** Each university module builds into a single self-contained HTML
file — open it in a browser and you get the notes, interactive tools that run the actual
algorithms, self-marking questions generated fresh every time, full-text search, and a mock exam
that scores you per topic.

No runtime dependencies. No server. It works offline.

**[→ Open the notes](https://gorrv.github.io/studykit/)**

---

## What's in it

| Module | Sections | Tools | Question generators | Figures |
|---|---|---|---|---|
| Introduction to AI | 40 | 33 | 230 | 44 |
| Programming Language Design | 11 | 24 | 10 | 4 |
| Operating Systems | 13 | 12 | 10 | 1 |
| Foundations of Computing | 3 | 6 | 11 | — |

Operating Systems also carries a hand-written bank of 123 exam questions behind its mock paper.

---

## Why it isn't just a notes site

**The tools execute the algorithms.** Value iteration really sweeps the grid. UCB really picks the
arm. The scheduler really simulates the clock. The decision tree really computes every Gini-Split
and rebuilds itself when you edit the dataset. Nothing is a pre-rendered picture of a result —
change an input and everything downstream recomputes.

**Questions are generated, not stored.** Numbers are randomised on every draw, and answers are
marked by the same code the tools use, so you can't learn the answers by repetition. Every question
explains its own working when you get it wrong.

**Every figure is computed.** No screenshots of lecture slides. The overfitting plots come from a
real polynomial fit; the ε-greedy curves from a 400-run simulation; the dendrogram from an actual
complete-linkage merge; the A\* map from the real graph.

**The numbers are verified.** Each module has a test suite that loads the built page in jsdom,
drives the real tools, and checks results against independently derived values.

---

## Building

```bash
npm install
npm run build      # src/ -> dist/
npm test           # builds, then runs the suites
npm run serve      # dist/ on http://localhost:8080
```

Modules are assembled from `src/` by `build.js`, which resolves `<!--@include path-->` directives
into one self-contained file per module. `@/` resolves from `src/`, anything else from the module's
own directory:

```html
<!--@include @/engine/quiz.js-->     shared by every module
<!--@include js/w4-mdp.js-->         this module's own
```

The build inlines everything, so a built module still opens from a USB stick on a machine with no
network. `dist/` is not committed; CI builds it and deploys that.

```
src/
  engine/      theme, nav, tools, quiz, search, boot, the SVG interaction layer
  styles/      the two-palette theme and the shared chrome
  modules/<id>/
    index.html   the template
    nav.html     sidebar
    sections/    one file per section
    js/          tools, then js/questions/ for the generators
    styles.css   module-specific rules and tokens
  site/        landing page
build.js
tests/
```

Each module was a single HTML file with everything inline — 17,238 lines for Intro to AI. The split
was done positionally first, so the rebuilt output was byte-identical to the file it replaced before
any code moved. See [`docs/AUTHORING.md`](docs/AUTHORING.md) to add a module.

---

## Running the tests

```
  running build.test.js …                             32 passed (80ms)
  running foundations-of-computing.test.js …          99 passed (4136ms)
  running intro-to-ai.test.js …                      230 passed (3790ms)
  running landing.test.js …                           20 passed (7676ms)
  running operating-systems.test.js …                110 passed (1829ms)
  running programming-language-design.test.js …      130 passed (3132ms)

621 / 621 assertions passed across 6 suites in 21.7s
```

Run one suite with `node tests/run.js intro` (after a build).

The suites come in three layers.

**Structural invariants**, in `tests/lib/harness.js`, applied to every module: no duplicate element
ids, no dead internal links, every tool registered and rendering without errors, no unresolved
template literals or leaked `undefined`/`NaN`, every section reachable through the nav, no runtime
warnings, and every CSS token defined in both palettes — a token with no dark value is invisible in
dark mode, which is the one class of bug the DOM tests can never see.

**Generated-question fuzzing**: thousands of draws per run, each checked to be self-consistent —
the stated answer is accepted by its own marker, no wrong choice is, and nonsense is rejected.

**Correctness tests** per module, asserting the mathematics against a value derived a different way:
a closed form, exact rational arithmetic, a published worked example, or exhaustive search.

```js
// A* on the Romania graph must find the optimal path and never expand Zerind —
// the cheapest first step, and the whole point of the worked example.
s.same('A* expansion order', frames.map(f => f.pick),
  ['ARAD', 'D', 'E', 'F', 'G', 'BUCHAREST']);

// A value-iteration guarantee: information moves exactly one square per sweep,
// so a square d steps from a terminal cannot change before sweep d.
s.ok('no square gains value before information can reach it', violations === 0);

// Type inference must agree with a Haskell compiler, and reject what it rejects.
s.ok('rejects \\x -> x x  (infinite type — the occurs check)', rejected);

// The Banker's safety check is greedy; safety is defined by existence. So
// compare it against every possible completion order.
s.ok('the greedy safety check agrees with exhaustive search', disagree === 0);

// LRU and OPT are stack algorithms and cannot show Belady's anomaly.
// FIFO and Clock are not, and must be able to.
s.ok('OPT is a stack algorithm', viol.opt === 0);
s.ok('FIFO is not — which is why it can show the anomaly', viol.fifo > 0);
```

---

## Errors this caught

In the source lecture material:

- A decision tree figure whose printed class labels contradicted its own class-count vectors in
  three nodes.
- A value-iteration figure whose U₁ map was inconsistent with its own converged map.
- A proposition with a factor-of-2 mismatch against the chapter's own summation convention.
- Seven exercises whose printed solution boxes were empty, worked from scratch and cross-checked in
  exact rational arithmetic.

And in this repo:

- The optimal page-replacement policy broke ties between never-again pages by frame slot, which made
  the choice depend on the frame count. OPT then lost the stack property and appeared to suffer
  Belady's anomaly, which it cannot. The fault count was correct either way, so no worked example
  would have caught it — the invariant did.
- A drag handler that closed over an SVG node, so any tool re-rendering during the drag pinned the
  dragged point to the corner. Fixed once in one module, and still present in the copy next door
  until the engine was unified.
- `checkQuestionBank` returned quietly when a module's bank was not exposed on `window`, so one
  module appeared to pass thousands of checks it had never run.

---

## Licence

MIT for the software — engine, tools, generators, search, exam, figures, build and tests.

**Not** for the course content. Definitions, exercise text and some figures derive from lecture
material owned by its authors and institutions. If you reuse this project, replace the module
content with your own or get permission. See [LICENSE](LICENSE).
