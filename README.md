# StudyKit

**Revision notes that compute.** Each university module builds into a single self-contained HTML
file — open it in a browser and you get the notes, interactive tools that run the actual
algorithms, self-marking questions generated fresh every time, full-text search, and a mock exam
that scores you per topic.

No runtime dependencies. No server. It works offline.

**[→ Open the notes](https://gorrv.github.io/studykit/)**

---

## What's in it

| Module | Year | Sections | Tools | Question generators | Figures |
|---|---|---|---|---|---|
| Foundations of Computing | 2 | 12 | 46 | 91 | 5 |
| Introduction to AI | 2 | 40 | 33 | 230 | 44 |
| Practical Experiences of Programming | 2 | 12 | 30 | 74 | 0 |
| Programming Language Design | 2 | 11 | 24 | 10 | 4 |
| Operating Systems | 2 | 13 | 12 | 10 | 1 |
| Cryptography | 3 | 8 | 23 | 49 | 1 |
| Software Measurement and Testing | 3 | 6 | 12 | 28 | 1 |
| Compilers and Formal Languages | 3 | 1 | 0 | 0 | 0 |

Operating Systems also carries a hand-written bank of 123 exam questions behind its mock paper.
The table is checked against the built modules by `tests/landing.test.js`, so it cannot drift.

The year-3 modules are being written as the material is covered, so their counts are small and
will grow. One of them is still a shell — it opens, searches, prints and is under test, but has
only an orientation page. The landing page marks those as in progress, and the tests check that
label against the file behind it in both directions, so a module cannot gain topics and go on
looking unfinished, nor be presented as ready while still empty.

---

## Why it isn't just a notes site

**The tools execute the algorithms.** Value iteration really sweeps the grid. UCB really picks the
arm. The scheduler really simulates the clock. The decision tree really computes every Gini-Split
and rebuilds itself when you edit the dataset. Nothing is a pre-rendered picture of a result —
change an input and everything downstream recomputes.

**Questions are generated, not stored.** Numbers are randomised on every draw, and answers are
marked by the same code the tools use, so you can't learn the answers by repetition. Every question
explains its own working when you get it wrong.

**Every figure is computed.** Nothing is a screenshot. The overfitting plots come from a
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
<!--@include js/t4-mdp.js-->         this module's own
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
  running build.test.js …                             60 passed (146ms)
  running compilers-and-formal-languages.test.js …    29 passed (2648ms)
  running cryptography.test.js …                     297 passed (77233ms)
  running foundations-of-computing.test.js …         875 passed (9515ms)
  running intro-to-ai.test.js …                      274 passed (11104ms)
  running landing.test.js …                           81 passed (25409ms)
  running operating-systems.test.js …                141 passed (2653ms)
  running practical-programming-scala.test.js …      157 passed (8842ms)
  running practical-programming.test.js …
    compiler differentials: 89 compiled, 247 from cache (8 recompiled and confirmed)
                                                     388 passed (17267ms)
  running programming-language-design.test.js …      169 passed (5399ms)
  running software-measurement-and-testing.test.js … 322 passed (13183ms)

2793 / 2793 assertions passed across 11 suites
```

Run one suite with `node tests/run.js intro` (after a build).

### Why the second run is faster

Practical Programming compiles about 330 small C++ programs with g++ and runs them, which was most
of the suite's wall clock. The programs do not change between runs — only the engine being compared
against them does — so the compiler's answers are cached on disk under `tests/.cache`, keyed by the
exact source, the exact argv, and g++'s own version and target. A changed program is a different
key, so there is no such thing as a stale hit. A cold run takes about a minute; a warm one about
eighteen seconds.

That rests on the programs being deterministic, which they have to be or the suite would already be
flaky. An unchecked assumption is a hope, so 2% of hits are recompiled and compared against what was
stored, and a disagreement fails the run. It earned this immediately: the first version of the cache
stored g++'s error text including the temp directory, which is new every run, and the spot-check
caught it before the cache was ever committed.

`STUDYKIT_CACHE=0` disables it, `STUDYKIT_CACHE_VERIFY=1` recompiles and checks *every* hit — which
is the honest way to confirm a warm green run means what a cold one does. The cache is outside git
and CI never has one, so CI always does the full work.

`node tests/run.js --resume` is for the other half of the same problem. The total above only means
something if it comes from running everything, and on a slow machine that can take longer than
whoever is waiting is able to give it — at which point the temptation is to quote a number nobody
checked. Instead each suite's result is stored with a hash of the whole tree it came from, and a
resumed run reports the stored result for any suite whose hash still matches. Change one byte
anywhere and every hash changes, so a stale result cannot be counted: a single added newline took
the number of recalled suites from eleven to zero. Also off by default.

That rule has exactly one exception, and it has to. The grand total is quoted in this file and on
the landing page, so learning it means running everything, and writing it down then threw the run
away — the number could never be both current and verified. So the digits of those two quoted
totals are blanked before hashing. Nothing reads them but the drift check, and only the digits are
excluded: every other number in both files, and the sentences around these, still count. The
sample run above quotes no wall time for the same reason, and because it is a property of the
machine rather than of the suite: it is anywhere from under three minutes to over ten depending on
what else is running.

Checkpointing per suite leaves one gap, and the Practical Programming suite fell into it: a suite
that on its own takes longer than a single command is allowed to run can never be recorded, so it
can never be part of a verified total, however many times it is restarted. That is a reason to keep
suites to a size one sitting can finish. Its C++ and Scala halves are now two suites sharing
`tests/lib/toolchain.js`, which is where g++, AddressSanitizer, the JVM and the compile cache live.
The assertion count is unchanged — the same checks, in two records instead of one.

The suites come in three layers.

**Structural invariants**, in `tests/lib/harness.js`, applied to every module: no duplicate element
ids, no dead internal links, every tool registered and rendering without errors, no unresolved
template literals or leaked `undefined`/`NaN`, exactly one section visible with the nav able to
change which, every class used on the page backed by a rule, no runtime warnings, and every CSS
token defined in both palettes — a token with no dark value is invisible in dark mode, which is the
one class of bug the DOM tests can never see. Also that nothing refers to the teaching the notes
were written alongside: no numbered slide, no lecture, no week, no institution. These pages are
meant to stand on their own, and one sentence at a time is how that quietly stops being true.

The counts in this file and on the landing page are checked against the built modules too, so the
documentation cannot drift from what it describes.

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

In the source material:

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
