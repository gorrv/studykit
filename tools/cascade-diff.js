#!/usr/bin/env node
'use strict';
/**
 * Compare the CSS cascade between two builds of the same module.
 *
 * Moving rules between stylesheets is only safe if the winning declaration for
 * every property on every element is unchanged. jsdom will not compute that
 * for us — its cascade support is partial — so this walks the DOM, matches
 * every rule with Element.matches(), sorts by (specificity, source order) and
 * reports the winner per property. Then it does the same for the other build
 * and diffs.
 *
 *   node tools/cascade-diff.js <baseline.html> <candidate.html>
 */

const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

/** Split a stylesheet into flat (selector, declarations) pairs. */
function parseRules(css) {
  const out = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    let sel = css.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    let depth = 1, k = open + 1;
    while (k < css.length && depth) {
      if (css[k] === '{') depth++;
      else if (css[k] === '}') depth--;
      k++;
    }
    const body = css.slice(open + 1, k - 1);
    if (sel.startsWith('@')) {
      // Recurse into @media / @supports so nested rules are compared too,
      // tagging the selector so media-specific rules don't collide.
      if (/^@(media|supports)/i.test(sel)) {
        for (const r of parseRules(body)) out.push({ sel: sel + ' :: ' + r.sel, decls: r.decls });
      }
    } else if (sel) {
      const decls = {};
      for (const d of body.split(';')) {
        const c = d.indexOf(':');
        if (c < 0) continue;
        const prop = d.slice(0, c).trim();
        if (prop && !prop.startsWith('/*')) decls[prop] = d.slice(c + 1).trim();
      }
      for (const one of sel.split(',')) {
        const s = one.trim();
        if (s) out.push({ sel: s, decls });
      }
    }
    i = k;
  }
  return out;
}

/** CSS specificity (a, b, c) flattened to one sortable number. */
function specificity(sel) {
  let s = sel;
  const ids = (s.match(/#[\w-]+/g) || []).length;
  s = s.replace(/#[\w-]+/g, ' ');

  const attrs = (s.match(/\[[^\]]*\]/g) || []).length;
  s = s.replace(/\[[^\]]*\]/g, ' ');

  // ::before and friends count as elements; :hover and friends as classes.
  const pseudoEl = (s.match(/::[\w-]+/g) || []).length;
  s = s.replace(/::[\w-]+/g, ' ');
  const pseudoCls = (s.match(/:[\w-]+(\([^)]*\))?/g) || []).length;
  s = s.replace(/:[\w-]+(\([^)]*\))?/g, ' ');

  const classes = (s.match(/\.[\w-]+/g) || []).length;
  s = s.replace(/\.[\w-]+/g, ' ');

  const elements = (s.match(/(^|[\s>+~(])([a-z][\w-]*)/gi) || []).length;

  return ids * 10000 + (classes + attrs + pseudoCls) * 100 + (elements + pseudoEl);
}

/** For every element with an id or class, the winning value per property. */
function cascade(file) {
  const html = fs.readFileSync(file, 'utf8');
  const dom = new JSDOM(html, { virtualConsole: new VirtualConsole() });
  const doc = dom.window.document;

  const css = Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n');
  const rules = parseRules(css).map((r, order) => ({ ...r, order, spec: specificity(r.sel) }));

  const result = new Map();
  const els = doc.querySelectorAll('*');
  for (const el of els) {
    const winners = {};
    for (const r of rules) {
      let hit = false;
      try { hit = el.matches(r.sel.replace(/^@[^:]+:: /, '')); } catch (e) { continue; }
      if (!hit) continue;
      for (const [prop, val] of Object.entries(r.decls)) {
        const prev = winners[prop];
        if (!prev || r.spec > prev.spec || (r.spec === prev.spec && r.order > prev.order)) {
          winners[prop] = { val, spec: r.spec, order: r.order };
        }
      }
    }
    const key = path(el);
    const flat = {};
    for (const [p, w] of Object.entries(winners)) flat[p] = w.val;
    result.set(key, flat);
  }
  return result;
}

/** A stable-ish identifier for an element. */
function path(el) {
  const bits = [];
  let n = el, guard = 0;
  while (n && n.nodeType === 1 && guard++ < 6) {
    let b = n.tagName.toLowerCase();
    if (n.id) { b += '#' + n.id; bits.unshift(b); break; }
    if (n.className && typeof n.className === 'string') b += '.' + n.className.trim().split(/\s+/).join('.');
    const sibs = n.parentNode ? Array.from(n.parentNode.children).filter(c => c.tagName === n.tagName) : [];
    if (sibs.length > 1) b += `:nth(${sibs.indexOf(n)})`;
    bits.unshift(b);
    n = n.parentNode;
  }
  return bits.join('>');
}

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('usage: cascade-diff.js <baseline.html> <candidate.html>'); process.exit(2); }

const A = cascade(a), B = cascade(b);
let checked = 0, changed = 0;
const examples = [];

for (const [key, propsA] of A) {
  const propsB = B.get(key);
  if (!propsB) { changed++; examples.push(`element gone: ${key}`); continue; }
  for (const [prop, val] of Object.entries(propsA)) {
    checked++;
    const other = propsB[prop];
    if (other !== val) {
      changed++;
      if (examples.length < 12) examples.push(`${key}\n     ${prop}: ${val}   ->   ${other}`);
    }
  }
}

console.log(`${checked} winning declarations compared across ${A.size} elements`);
if (changed === 0) {
  console.log('no cascade differences');
} else {
  console.log(`${changed} DIFFERENCES:\n`);
  examples.forEach(e => console.log('  ' + e));
}
process.exit(changed ? 1 : 0);
