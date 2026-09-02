# Adding a module

A module is a directory under `src/modules/`. `build.js` assembles it into one self-contained file
in `dist/modules/`. Nothing is fetched at runtime, so a built module works offline.

```
src/modules/<id>/
  index.html     the template — the only file that lists includes
  nav.html       sidebar: brand, theme toggle, search box, section links
  sections/      one .html per section
  js/            one .js per tool
  js/questions/  one .js per topic's question generators
  styles.css     module-specific rules and design tokens
```

The fastest route is to copy `src/modules/operating-systems` — it is the smallest complete example,
with tools, generators and a mock exam — and replace the content.

---

## 1. The template

`index.html` is ordinary HTML with `<!--@include path-->` directives. `@/` resolves from `src/`;
anything else resolves from the module directory. Order is source order: the engine first, then your
tools, then your question generators, then `boot.js` last.

```html
<style>
<!--@include @/styles/theme.css-->
<!--@include @/styles/chrome.css-->
<!--@include styles.css--></style>
...
<script>
  <!--@include @/engine/helpers.js-->
  <!--@include @/engine/theme.js-->
  <!--@include @/engine/nav.js-->
  <!--@include @/engine/ix.js-->
  <!--@include @/engine/tools.js-->
  <!--@include @/engine/quiz.js-->
  <!--@include @/engine/search.js-->
  <!--@include js/w2-scheduling.js-->
  <!--@include js/questions/scheduling.js-->
  <!--@include @/engine/boot.js-->
</script>
```

Everything is concatenated into one classic script, so a top-level `function foo()` is a global and
the engine can find it by name. `const` and `let` at top level are not — if the tests need to read
your state, assign it to `window` explicitly (see §6).

Keep the `<head>` boot script that reads `studykit-theme` from localStorage. It runs before first
paint, and without it a dark-theme reader gets a white flash on every page load.

---

## 2. Sections

Content lives in `<section class="topic-section">`. Exactly one carries `active`; the sidebar calls
`showSection(id)` to switch.

```html
<section id="t4-paging" class="topic-section">
  <div class="topic-header">
    <div class="topic-eyebrow">Topic 04</div>
    <h1>Demand Paging</h1>
    <div class="topic-subtitle">faults as a feature</div>
  </div>

  <h2 id="t4-replacement">Page replacement</h2>
  <div class="callout exam">
    <div class="callout-label">The definition</div>
    …
  </div>
</section>
```

Callout variants: plain, `exam` (things to memorise), `tip` (helpful asides), `warn` (traps and
corrections). Give every `<h2>` an `id` so it can be linked and found by search, and add a matching
entry to `nav.html`.

If a section needs to do something when it opens — build a paper, seed a tool — push a handler
rather than editing the engine:

```js
NAV.onShow.push(function (id) {
  if (id === 'mock') renderMock();
});
```

---

## 3. Tools

A tool is `<div class="tool" data-run="fnName">` containing inputs and an output pane. The engine
calls `fnName()` on load, again ~300 ms after any input changes, and again on reset.

```html
<div class="tool" data-run="runGini">
  <div class="tool-header">
    <span class="tool-badge">Practice tool</span>
    <h3>Every term, and where you sit on the curve</h3>
  </div>
  <div class="tool-desc">Type a count vector and watch the total move.</div>

  <div class="tool-field">
    <label for="gi-v">Class counts</label>
    <input type="text" id="gi-v" value="6 5 4" spellcheck="false">
  </div>

  <div class="tool-controls"><button class="tool-btn" onclick="runGini()">Compute</button></div>
  <div class="tool-reset"><button class="tool-btn ghost" onclick="toolReset(this)">↺ Reset tool</button></div>
  <div id="gi-output" class="tool-output"></div>
</div>
```

```js
function runGini() {
  var out = document.getElementById('gi-output');
  if (!out) return;
  var v = parse(document.getElementById('gi-v').value);
  if (!v.ok) { out.innerHTML = '<div class="tool-error">' + v.message + '</div>'; return; }
  out.innerHTML = render(v.value);
}
```

Rules the tests enforce:

- a `.tool-output` pane, which must render something without erroring
- report bad input as `<div class="tool-error">`, never by throwing
- never leak `undefined` or `NaN` into a value position
- `data-run` must resolve — as a top-level function, or via `TOOL_RUNNERS.fnName = fn` if your
  function is inside a closure

**Separate the algorithm from the rendering.** Every tool worth testing has a pure function at its
centre that takes inputs and returns a result. Write that first, expose it on `window`, and let the
render function only turn it into HTML. That is what makes it possible to assert `prRun(refs, 3,
'fifo').faults === 15` instead of scraping the DOM for a number.

### The interaction layer

`IX` provides the shared behaviours:

| | |
|---|---|
| `IX.drag(svg, {W, H, onMove, onDrop, onRemove, onBlank})` | dragging inside an SVG, letterbox-aware |
| `IX.player(id, frame, total, label, phase)` | the ⏮ ◀ ▶ ⏭ transport bar |
| `IX.play(id, total, get, set, ms)` | animate through frames |
| `ixTrace(id, outputId, {label})` | free transport bar for any output with `data-step="k"` rows |
| `IX.toggles([{label, on, fn}])` | checkbox row |
| `IX.layout(names, adj, W, H)` | deterministic force-directed graph layout |

`IX.drag` resolves the live SVG by `id` at event time rather than closing over the node, so a tool
that re-renders on every mouse-move keeps working. Give every draggable SVG a stable `id` and put
`data-ix="key"` on the draggable elements.

---

## 4. Questions

Push generators onto `QZ_GEN`. Each has a `topic` and a `make()` returning one question. `make()`
may `throw` to reject an unsuitable random draw — the engine retries.

```js
QZ_GEN.push({ topic: 'replacement', make: function () {
  var refs = [], frames = qzInt(2, 4);
  for (var i = 0; i < 12; i++) refs.push(qzInt(0, 5));
  var faults = prRun(refs, frames, 'lru').faults;      // the tool's own function
  if (faults === refs.length) throw new Error('retry'); // every reference faulting is a dull question
  return {
    topic: 'replacement · counting faults',
    prompt: 'Reference string <code>' + refs.join(' ') + '</code> with ' + frames + ' frames under LRU…',
    placeholder: 'a number',
    answer: String(faults),
    check: function (v) {
      var x = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
      if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
      return { ok: x === faults };
    },
    explain: '…show the working here…',
  };
} });
```

Multiple choice sets `kind: 'choice'` with `choices` and usually `check: textCheck(answer)`.

Two things the fuzzer will catch, and both are easy to do by accident:

- **Exactly one choice may be correct.** "Which of these can suffer Belady's anomaly" has two right
  answers among FIFO, LRU, OPT and Clock, so it is a broken question however it is marked. Ask it in
  the direction that has one.
- **The marker must accept the answer the question states.** If `answer` is `'6/7'`, `check('6/7')`
  has to pass.

Write the `explain` as if the reader got it wrong — show the working, not just the answer.

---

## 5. Figures

Compute them; don't screenshot them. The repo's figures are generated by running the real algorithm
and emitting SVG path data.

```html
<svg width="100%" viewBox="0 0 680 300" role="img">
  <title>Underfitting, just right, overfitting</title>
  <desc>Three fits to the same thirty noisy points…</desc>
  <path d="…" fill="none" stroke="var(--accent)" stroke-width="2.2"/>
</svg>
```

`role="img"` with `<title>` and `<desc>` is required — screen readers get nothing otherwise.

**Never hardcode a colour.** Use the tokens in `src/styles/theme.css`, which are defined for both
palettes. If you need a colour the shared set doesn't have, add it to your module's `styles.css` in
*both* a `:root` block and an `html[data-theme="dark"]` block — `build.test.js` fails if a token you
use has no dark value, because that is invisible in dark mode and nothing else will tell you.

---

## 6. Tests

Add `tests/<module>.test.js`:

```js
const { loadModule, Suite, checkStructure, checkQuestionBank } = require('./lib/harness');

module.exports = async function run() {
  const s = new Suite('my-module');
  const m = await loadModule('my-module.html');   // loads from dist/

  await checkStructure(s, m);         // structural invariants, free
  checkQuestionBank(s, m, 2000);      // fuzz the generators

  // then assert the mathematics your module actually teaches
  s.near('Gini of [2,0,4] is 16/36', m.window.giOf([2, 0, 4]), 16 / 36);

  return s;
};
```

Expose whatever the suite needs on `window` — by convention in a `js/expose.js` included just before
`boot.js`, so it is obvious what the test surface is.

`checkStructure` and `checkQuestionBank` apply to any module. The value is in what you add after
them. Assert against a value derived a *different* way — a closed form, exact rational arithmetic, a
published worked example, or exhaustive search over small inputs. Three kinds of assertion have
earned their place here:

- **Published worked examples.** If a textbook prints the answer, assert that number. It is what a
  student will be marked against.
- **Invariants over random inputs.** "No policy ever beats OPT." "Waiting time equals turnaround
  minus burst." These cover the whole input space, not the three cases you thought of.
- **Agreement with a slower, obviously-correct implementation.** The Banker's safety check is
  greedy; safety is defined by the *existence* of a completion order. Comparing the greedy answer
  against every permutation on small instances tests the algorithm rather than the code.

The last two are what catch the errors a handful of examples never will. The OPT tie-breaking bug
produced correct fault counts on every worked example and was found only by the stack property.

Finally, add a card to `src/site/index.html`. `tests/landing.test.js` fails if a module builds but
nothing links to it.
