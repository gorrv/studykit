# Adding a module

A module is one HTML file in `modules/`. It carries its own CSS, its own engine and its own
content, so there is nothing to wire up beyond adding a card to the landing page and a test
suite.

The fastest route is to copy `modules/intro-to-ai.html` — it has the most complete engine —
and replace the content.

---

## 1. Sections

Content lives in `<section class="week-section">`. Exactly one carries `active`; the sidebar
calls `showWeek(id)` to switch between them.

```html
<section id="w1-search" class="week-section">
  <div class="week-header">
    <div class="week-eyebrow">Week 01 · Part 2</div>
    <h1>Search</h1>
    <div class="week-subtitle">breadth, depth and cost</div>
  </div>

  <h2 id="s-problem">What a search problem is</h2>
  <div class="callout exam">
    <div class="callout-label">The definition</div>
    …
  </div>
</section>
```

Callout variants: plain, `exam` (things to memorise), `tip` (helpful asides),
`warn` (traps and corrections).

Add a matching entry to the sidebar `<nav>`, and give every `<h2>` an `id` so it can be
linked and found by search.

---

## 2. Tools

A tool is a `<div class="tool" data-run="fnName">` containing inputs and an output pane.
The engine calls `fnName()` on load, and again ~300 ms after any input changes.

```html
<div class="tool" data-run="runGini">
  <div class="tool-header">
    <span class="tool-badge">Interactive</span>
    <h3>Every term, and where you sit on the curve</h3>
  </div>
  <p class="tool-desc">Type a count vector and watch the total move.</p>

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
  const out = document.getElementById('gi-output');
  if (!out) return;
  const v = parse(document.getElementById('gi-v').value);
  if (!v.ok) { out.innerHTML = `<div class="tool-error">${v.message}</div>`; return; }
  out.innerHTML = render(v.value);
}
TOOL_RUNNERS.runGini = runGini;      // required — the tests check this
```

Rules the tests enforce:

- register the runner in `TOOL_RUNNERS`
- report bad input as `<div class="tool-error">`, never by throwing
- never leak `undefined` or `NaN` into a value position
- expose your state object on `window` if the tests need to inspect it

### The interaction layer

`IX` provides the shared behaviours:

| | |
|---|---|
| `IX.drag(svg, {W, H, onMove, onDrop, onRemove, onBlank})` | dragging inside an SVG, letterbox-aware |
| `IX.player(id, frame, total, label, phase)` | the ⏮ ◀ ▶ ⏭ transport bar |
| `IX.play(id, total, get, set, ms)` | animate through frames |
| `IX.toggles([{label, on, fn}])` | checkbox row |
| `IX.layout(names, adj, W, H)` | deterministic force-directed graph layout |

`IX.drag` resolves the live SVG by `id` at event time rather than closing over the node, so
a tool that re-renders on every mouse-move keeps working. Give every draggable SVG a stable
`id` and put `data-ix="key"` on the draggable elements.

For step-through tools, define `<id>Step(d, fromSlider)` and let `IX.player` drive it:

```js
function giStep(d, fromSlider) {
  const total = GI.frames.length;
  if (d === 'play') { IX.play('gi', total, () => GI.frame, f => { GI.frame = f; giRender(); }); giRender(); return; }
  IX.stop('gi');
  if (d === 'first') GI.frame = 0;
  else if (d === 'last') GI.frame = total - 1;
  else if (typeof d === 'number' && fromSlider) GI.frame = d;
  else GI.frame = Math.max(0, Math.min(total - 1, GI.frame + d));
  giRender();
}
```

---

## 3. Questions

Push generators onto `QZ_GEN`. Each has a `topic` and a `make()` returning one question.
`make()` may `throw` to reject an unsuitable random draw — the engine retries.

```js
// Multiple choice, fixed wording
QZ_GEN.push({ topic: 'search', make: () => ({
  topic: 'search · properties',
  kind: 'choice',
  prompt: 'Which search is optimal only when all step costs are equal?',
  choices: ['Breadth-first', 'Depth-first', 'Uniform-cost', 'A*'],
  answer: 'Breadth-first',
  check: textCheck('Breadth-first'),
  explain: 'BFS expands the shallowest node, so it finds the shortest path in <em>edges</em>…',
}) });

// Computed, with randomised numbers
QZ_GEN.push({ topic: 'clustering', make: () => {
  const a = [qzInt(0, 9), qzInt(0, 9)], b = [qzInt(0, 9), qzInt(0, 9)];
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (d === 0) throw new Error('retry');           // reject a degenerate draw
  return {
    topic: 'clustering · metrics',
    prompt: `p₁ = (${a}), p₂ = (${b}).<br><br>What is the Euclidean distance?`,
    placeholder: 'a number',
    answer: d.toFixed(4),
    check: v => {
      const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
      if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
      return { ok: Math.abs(x - d) < 0.011 };
    },
    explain: `√((${a[0]}−${b[0]})² + (${a[1]}−${b[1]})²) = <strong>${d.toFixed(4)}</strong>`,
  };
} });
```

Write the `explain` as if the reader got it wrong — show the working, not just the answer.

To include the topic in the mock exam, add it to `EX_WEEKS`:

```js
{ w: 1, label: 'W1 · Search', topics: ['search', 'astar'] },
```

---

## 4. Figures

Compute them; don't screenshot them. The repo's figures are generated by scripts that run
the real algorithm and emit SVG path data, then inlined.

Use CSS variables for every colour so figures work in both themes:

```html
<svg width="100%" viewBox="0 0 680 300" role="img">
  <title>Underfitting, just right, overfitting</title>
  <desc>Three fits to the same thirty noisy points…</desc>
  <path d="…" fill="none" stroke="var(--accent)" stroke-width="2.2"/>
</svg>
```

`role="img"` with `<title>` and `<desc>` is required — screen readers get nothing otherwise.
Never hardcode a hex colour: it will be invisible in one of the two themes.

---

## 5. Tests

Add `tests/<module>.test.js`:

```js
const { loadModule, Suite, checkStructure, checkQuestionBank } = require('./lib/harness');

module.exports = async function run() {
  const s = new Suite('my-module');
  const m = await loadModule('my-module.html');

  await checkStructure(s, m);         // structural invariants, free
  checkQuestionBank(s, m, 2000);      // fuzz the generators

  // then assert the mathematics your module actually teaches
  s.near('Gini of [2,0,4] is 16/36', m.window.giOf([2, 0, 4]), 16 / 36);

  return s;
};
```

`checkStructure` and `checkQuestionBank` apply to any module. The value is in what you add
after them: assert the results your notes claim, ideally against a value derived a different
way — a closed form, exact rational arithmetic, or a second implementation. That is what
turns the suite from a smoke test into something that catches errors in the source material.

Finally, add a card to `index.html`. `tests/landing.test.js` fails if a module file exists
but nothing links to it.
