'use strict';
/**
 * Real toolchains, for the suites that have one to check against.
 *
 * The Practical Programming notes are the one module whose claims a machine
 * can settle: g++ is a real C++ compiler and a JVM is real int arithmetic, so
 * the engines on the page are compared against them rather than against my
 * expectations. Those comparisons are slow, which is why the compiler's
 * answers are cached here, and slow enough that the checks live in two suites
 * — the C++ half and the Scala half — sharing this file. Splitting them was
 * not tidiness: one suite that takes longer than the operator can give a
 * single command can never be recorded by --resume, so it can never be part
 * of a verified total. Two suites each half the length can.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { ROOT } = require('./harness');

const HAVE_GPP = spawnSync('g++', ['--version'], { encoding: 'utf8' }).status === 0;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-'));

/* ------------------------------------------------------------------
   Not recompiling what has not changed.

   This suite builds and runs about 330 small C++ programs, nearly all of
   them distinct, and that is most of the minute it takes. The programs do
   not change between runs; only the engine being compared against them
   does. So the compiler's answers are cached on disk, keyed by the exact
   source, the exact argv, and the compiler's own version and target. Change
   any of those and the key changes, so there is no such thing as a stale
   hit — a modified program is simply a different key and gets compiled.

   What the cache assumes is that these programs are deterministic: same
   source, same compiler, same answer. They have to be, or the suite would
   already be flaky. But an assumption that is never checked is just a hope,
   so a sample of hits is recompiled anyway and compared against what was
   stored; a disagreement fails the suite rather than being papered over.
   That costs a few per cent and turns the assumption into a measurement.

   The cache lives outside git and CI never sees one, so CI always does the
   full work. Set STUDYKIT_CACHE=0 to do the same locally.
   ------------------------------------------------------------------ */

const CACHE_ON = process.env.STUDYKIT_CACHE !== '0';
const CACHE_DIR = path.join(ROOT, 'tests', '.cache', 'cxx');
/* How often to recompile a hit and check the stored answer still holds. */
const VERIFY_RATE = Number(process.env.STUDYKIT_CACHE_VERIFY || 0.02);

const TOOLCHAIN = HAVE_GPP
  ? [spawnSync('g++', ['--version'], { encoding: 'utf8' }).stdout,
     spawnSync('g++', ['-dumpmachine'], { encoding: 'utf8' }).stdout].join('|')
  : 'none';

const cacheStats = { hit: 0, miss: 0, verified: 0, stored: 0, pruned: 0 };

/* Some of the programs below embed randomly generated values, so their key is
   new on every run: they are written once, never asked for again, and would
   pile up for as long as anyone kept running the suite. Hits touch their file,
   so the live set is the recently used one — drop the rest when there are
   clearly more than a run needs. */
function pruneCache(keep) {
  let files = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.json')) files.push(full);
    }
  };
  try { walk(CACHE_DIR); } catch (e) { return; }
  if (files.length <= keep * 1.5) return;

  files = files
    .map(f => ({ f, t: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(keep)) {
    try { fs.unlinkSync(f); cacheStats.pruned++; } catch (e) {}
  }
}

function cachePath(argv, source) {
  const key = crypto.createHash('sha256')
    .update(TOOLCHAIN).update('\0').update(argv.join(' ')).update('\0').update(source)
    .digest('hex');
  return path.join(CACHE_DIR, key.slice(0, 2), key.slice(2) + '.json');
}

/**
 * Run `compute()` unless its answer is already on disk for this exact input.
 *
 * @param {string[]} argv    everything that affects the answer but is not the source
 * @param {string} source    the program
 * @param {function} compute produces the answer; must be deterministic
 */
function cached(argv, source, compute, dontStore) {
  if (!CACHE_ON) return compute();
  const file = cachePath(argv, source);

  let stored = null;
  try { stored = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { stored = null; }

  if (stored) {
    cacheStats.hit++;
    /* Mark it as still in use, so the prune below can tell the live set from
       the leftovers. */
    try { fs.utimesSync(file, new Date(), new Date()); } catch (e) {}
    if (Math.random() >= VERIFY_RATE) return stored.value;
    /* Spot-check: recompute and insist the compiler still says the same. */
    const fresh = compute();
    cacheStats.verified++;
    if (JSON.stringify(fresh) !== JSON.stringify(stored.value)) {
      throw new Error('cached compiler result no longer reproduces — the cache is stale or the ' +
        'program is not deterministic.\n  stored: ' + JSON.stringify(stored.value) +
        '\n  fresh : ' + JSON.stringify(fresh) +
        '\n  Delete tests/.cache to rebuild it, and if that does not settle it the program ' +
        'itself varies between runs and should not be asserted on.');
    }
    return fresh;
  }

  cacheStats.miss++;
  const value = compute();
  if (dontStore && dontStore(value)) return value;
  cacheStats.stored++;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ argv, source, value }));
  } catch (e) { /* a cache that cannot be written is a slow cache, not a broken run */ }
  return value;
}

/* Running a child process safely here takes more care than it looks.
   spawnSync's `timeout` sends SIGTERM by default and then waits for the child
   to exit; and even once the child is gone, it goes on waiting for the stdout
   pipe to close, which a surviving grandchild (g++ forks cc1plus and as) can
   hold open indefinitely. Because spawnSync blocks the event loop, the suite
   then hangs with no output and cannot even be interrupted -- SIGTERM to the
   test runner is never handled.

   So: kill with SIGKILL, which cannot be ignored, and give the child real
   files for stdout and stderr rather than pipes, so there is nothing left to
   wait on. Reading the files afterwards gives the same output. A stuck child
   now costs its timeout and is reported, which is what a test run is for. */
function runSync(cmd, args, ms, extraEnv) {
  const o = path.join(TMP, 'out'), e = path.join(TMP, 'err');
  const fo = fs.openSync(o, 'w'), fe = fs.openSync(e, 'w');
  let r;
  try {
    r = spawnSync(cmd, args, {
      stdio: ['ignore', fo, fe],
      timeout: ms,
      killSignal: 'SIGKILL',
      env: extraEnv ? Object.assign({}, process.env, extraEnv) : process.env
    });
  } finally {
    fs.closeSync(fo);
    fs.closeSync(fe);
  }
  return {
    status: r.status,
    signal: r.signal,
    stdout: fs.readFileSync(o, 'utf8'),
    stderr: fs.readFileSync(e, 'utf8')
  };
}

/** Compile and run a C++ program. Returns { compiles, out }. */
function cxx(source) {
  return cached(['g++', '-std=c++11'], source, function () {
    const src = path.join(TMP, 'p.cc');
    const bin = path.join(TMP, 'p');
    fs.writeFileSync(src, source);
    const c = runSync('g++', ['-std=c++11', '-o', bin, src], 30000);
    if (c.status !== 0) {
      const line = (c.stderr || '').split('\n').find(l => /error:/.test(l)) || '';
      /* The temp directory is new on every run, so leaving its path in the
         message would make the same program produce a different answer each
         time — which the cache's spot-check duly caught the first time it
         ran. Strip it: the file is always the same one, and the line and
         column are the part worth reading anyway. */
      return { compiles: false, error: line.trim().split(TMP + path.sep).join('') };
    }
    const r = runSync(bin, [], 10000);
    return { compiles: true, out: (r.stdout || '').trim().split('\n').filter(Boolean) };
  });
}

/** Compile with AddressSanitizer, run, and report leaks and crashes. */
function asan(source) {
  /* A stalled sanitizer is the one answer here that is not a property of the
     program, so it is never written to the cache — otherwise one unlucky
     deadlock would be remembered as this program's behaviour for good. */
  return cached(['g++', '-std=c++11', '-g', '-fsanitize=address'], source, function () {
    const src = path.join(TMP, 'a.cc');
    const bin = path.join(TMP, 'a');
    fs.writeFileSync(src, source);
    const c = runSync('g++', ['-std=c++11', '-g', '-fsanitize=address', '-o', bin, src], 60000);
    if (c.status !== 0) return { compiles: false };
    const r = runSync(bin, [], 20000, {
      /* Deterministic reports rather than whatever the environment asks for. */
      ASAN_OPTIONS: 'detect_leaks=1:abort_on_error=0:exitcode=1',
      LSAN_OPTIONS: 'report_objects=0'
    });
    /* Killed rather than exited: the sanitizer deadlocked, which tells us
       nothing about the program. Report it as such instead of reading its
       empty output as "no leak, no abort". */
    if (r.signal === 'SIGKILL') return { compiles: true, out: [], leaked: 0, aborted: false,
                                         stalled: true };
    const err = r.stderr || '';
    const m = /SUMMARY: AddressSanitizer: (\d+) byte\(s\) leaked/.exec(err);
    const leaked = m ? +m[1] : 0;
    /* This aarch64 build reports a double free as a SEGV inside its own
       allocator rather than by name, so any AddressSanitizer error that is
       not a leak report counts as an abort. */
    const aborted = /ERROR: AddressSanitizer/.test(err) && leaked === 0;
    return { compiles: true, out: (r.stdout || '').trim().split('\n').filter(Boolean),
             leaked, aborted };
  }, v => v.stalled);
}

/* Scala's Int IS the JVM's int, and Scala has no compiler here, so the
   arithmetic is checked against the next best thing: a real JVM. Java 11
   runs a single source file directly, no javac needed. Each expression
   is printed on its own line, and anything that throws prints the
   exception's name, so both answers are comparable. */
const HAVE_JAVA = spawnSync('java', ['--version'], { encoding: 'utf8' }).status === 0;

function javaEval(exprs) {
  const body = exprs.map(e =>
    '    try { System.out.println(' + e + '); } ' +
    'catch (Exception ex) { System.out.println("THROWS " + ex.getClass().getSimpleName()); }'
  ).join('\n');
  const src = 'public class P {\n  public static void main(String[] a) {\n' + body + '\n  }\n}\n';
  const f = path.join(TMP, 'P.java');
  fs.writeFileSync(f, src);
  const r = runSync('java', [f], 90000);
  if (r.status !== 0) return { ok: false, error: (r.stderr || '').split('\n')[0] };
  return { ok: true, out: r.stdout.trim().split('\n') };
}

function ri(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

module.exports = {
  HAVE_GPP, HAVE_JAVA, CACHE_ON, TMP,
  cxx, asan, javaEval, runSync, cached,
  cacheStats, pruneCache, ri, pick
};
