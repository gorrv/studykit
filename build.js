#!/usr/bin/env node
'use strict';
/**
 * Build the modules.
 *
 * Each module is a template in src/modules/<id>/index.html containing
 * `<!--@include path-->` directives. The build resolves them recursively and
 * writes one self-contained file to dist/modules/<id>.html — no <link>, no
 * <script src>, nothing fetched at runtime. That is the whole point: a built
 * module opens from a USB stick on a machine with no network.
 *
 * Include paths are resolved:
 *   @/engine/quiz.js   from src/            (shared across modules)
 *   js/w1-search.js    from the module dir  (module's own)
 *
 *   node build.js            build every module
 *   node build.js intro      build only modules matching a filter
 *   node build.js --check    build in memory and report, writing nothing
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const INCLUDE = /<!--@include\s+([^\s>]+?)\s*-->/g;
const MAX_DEPTH = 16;

/**
 * Resolve every @include in `text`. `dir` is the module directory that
 * module-relative paths resolve against.
 *
 * @param {string} text
 * @param {string} dir
 * @param {Set<string>} stack   guards against an include cycle
 * @param {string[]} used       every file that contributed, for the manifest
 */
function resolve(text, dir, stack = new Set(), used = [], depth = 0) {
  if (depth > MAX_DEPTH) throw new Error('include nesting too deep — likely a cycle');

  return text.replace(INCLUDE, (_, rel) => {
    const full = rel.startsWith('@/')
      ? path.join(SRC, rel.slice(2))
      : path.join(dir, rel);

    if (stack.has(full)) {
      throw new Error(`include cycle: ${path.relative(SRC, full)}`);
    }
    if (!fs.existsSync(full)) {
      throw new Error(`missing include: ${rel}  (resolved to ${path.relative(ROOT, full)})`);
    }

    used.push(path.relative(SRC, full));
    const body = fs.readFileSync(full, 'utf8');
    const next = new Set(stack).add(full);
    return resolve(body, dir, next, used, depth + 1);
  });
}

function buildModule(id) {
  const dir = path.join(SRC, 'modules', id);
  const entry = path.join(dir, 'index.html');
  if (!fs.existsSync(entry)) throw new Error(`no template for module "${id}"`);

  const used = [];
  const html = resolve(fs.readFileSync(entry, 'utf8'), dir, new Set([entry]), used);

  const leftover = html.match(INCLUDE);
  if (leftover) throw new Error(`unresolved include in ${id}: ${leftover[0]}`);

  return { id, html, used, bytes: Buffer.byteLength(html) };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const filter = args.find(a => !a.startsWith('-'));

  const ids = fs.readdirSync(path.join(SRC, 'modules'))
    .filter(d => fs.statSync(path.join(SRC, 'modules', d)).isDirectory())
    .filter(d => !filter || d.includes(filter))
    .sort();

  if (!ids.length) {
    console.error(filter ? `no modules match "${filter}"` : 'no modules found in src/modules');
    process.exit(1);
  }

  if (!check) {
    fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(path.join(DIST, 'modules'), { recursive: true });
  }

  const built = [];
  for (const id of ids) {
    const r = buildModule(id);
    if (!check) fs.writeFileSync(path.join(DIST, 'modules', `${id}.html`), r.html);
    built.push(r);
    console.log(`  ${id.padEnd(30)} ${String(r.used.length).padStart(3)} parts  ` +
      `${(r.bytes / 1024).toFixed(0).padStart(5)} KB`);
  }

  // Static files that ship alongside the modules.
  if (!check && !filter) {
    for (const f of ['index.html', '.nojekyll']) {
      const from = path.join(SRC, 'site', f);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(DIST, f));
    }
  }

  const total = built.reduce((n, b) => n + b.bytes, 0);
  console.log(`\n${built.length} modules, ${(total / 1024 / 1024).toFixed(2)} MB` +
    (check ? ' (--check: nothing written)' : ` → ${path.relative(ROOT, DIST)}/`));
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('\nbuild failed: ' + err.message);
    process.exit(1);
  }
}

module.exports = { buildModule, resolve };
