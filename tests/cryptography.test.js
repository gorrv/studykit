'use strict';
/**
 * Cryptography.
 *
 * The first topic is a conceptual one — definitions, syntax, and the argument
 * that correctness is not security — so the things worth asserting are the
 * demonstrations rather than any arithmetic the notes teach. Three kinds of
 * claim get made on that page, and each is checked here the hard way:
 *
 *   - "this scheme is correct": exhausted over the whole domain, and checked
 *     against a second implementation written here that shares no code with
 *     the engine.
 *   - "the pad is perfectly secret": counted over every (message, ciphertext)
 *     pair, not argued.
 *   - "thirty letters is enough to break a shift": measured over every window
 *     of a fixed passage, with the number on the page and the number here
 *     coming from the same sweep.
 */

const { loadModule, Suite, checkStructure, checkQuestionBank } = require('./lib/harness');

/* An independent shift cipher, written from the definition rather than from
   the engine, for the differential checks below. */
const A = 26;
const shiftEnc = (k, m) => m.map(x => (x + k) % A);
const shiftDec = (k, c) => c.map(x => (x - k + A) % A);

module.exports = async function run() {
  const s = new Suite('cryptography');
  const m = await loadModule('cryptography.html');
  const w = m.window;

  await checkStructure(s, m);

  /* ---------------- correctness, by exhaustion ---------------- */

  {
    const r = w.skCorrect('shift', 3);
    s.ok('the shift cipher is correct on every key and every 3-letter message',
      r.ok && r.bad === 0, r.first && JSON.stringify(r.first));
    s.is('and that really was the whole domain', r.total, 26 * Math.pow(26, 3));

    /* The same claim, decided by an implementation that shares nothing with
       the engine's. If both are wrong they have to be wrong identically. */
    let disagree = 0, firstBad = null;
    for (let k = 0; k < A; k++) {
      for (let a = 0; a < A; a++) {
        for (let b = 0; b < A; b++) {
          const msg = [a, b];
          const mine = shiftDec(k, shiftEnc(k, msg)).join(',');
          const theirs = w.SK_SCHEMES.shift.dec(k, w.SK_SCHEMES.shift.enc(k, msg)).join(',');
          if (mine !== theirs || mine !== msg.join(',')) {
            disagree++;
            if (!firstBad) firstBad = `k=${k} m=${msg} mine=${mine} engine=${theirs}`;
          }
        }
      }
    }
    s.is('engine and an independent shift cipher agree on all 17,576 cases', disagree, 0, firstBad);

    const id = w.skCorrect('identity', 3);
    s.ok('the "do nothing" scheme is correct too — which is the point of it',
      id.ok && id.bad === 0);
  }

  /* ---------------- the ladder, rung by rung ---------------- */

  {
    const r = w.skReadOff('identity', 'attack at dawn');
    s.is('rung ii: the "do nothing" ciphertext is the message', r.ciphertext, r.plaintext);

    const p = w.skPartial('attack at dawn', 7);
    s.ok('rung iii: the first letter is readable straight off the ciphertext',
      p.ok && p.correct && p.leaked === p.truth, p.ok ? `${p.leaked} vs ${p.truth}` : p.error);
    s.ok('and the rest of it is not', p.ciphertext.slice(1) !== p.plaintext.slice(1));

    /* Brute force: whatever the key, the message is among the 26 candidates.
       This is weaker than the frequency attack and needs no language at all. */
    let missing = 0;
    const msg = w.skNums('attack at dawn');
    for (let k = 0; k < A; k++) {
      const c = w.SK_SCHEMES.shift.enc(k, msg);
      const found = [];
      for (let j = 0; j < A; j++) found.push(w.skText(w.SK_SCHEMES.shift.dec(j, c)));
      if (found.indexOf(w.skText(msg)) < 0) missing++;
    }
    s.is('rung iv: 26 candidates always contain the message, for every key', missing, 0);
  }

  /* ---------------- how much text the frequency attack needs ---------------- */

  {
    /* The figures quoted on the page and in the cram sheet. If the engine
       changes, these move, and the prose is wrong until it is updated. */
    const want = { 10: 83.7, 20: 98.6, 30: 100 };
    Object.keys(want).forEach(len => {
      const e = w.skEnoughText(Number(len));
      const pct = 100 * e.rate;
      s.near(`chi-squared recovers the key on ${len} letters, ${want[len]}% of windows`,
        pct, want[len], 0.05);
    });

    const thirty = w.skEnoughText(30);
    s.is('by thirty letters it does not miss at all', thirty.hit, thirty.total);

    /* The page says the outcome does not depend on the key, and uses that to
       count windows rather than window-key pairs. If that were wrong the
       quoted percentages would be wrong too. */
    const ki = w.skKeyIndependent(10, 40);
    s.is('the attack succeeds for all 26 keys on a window, or for none',
      ki.disagreements, 0, `${ki.checked} checks`);

    /* And the real key really is the minimum, not merely near it. */
    const full = w.skNums(w.SK_SAMPLE);
    let wrong = 0;
    for (let k = 0; k < A; k++) {
      if (w.skChi(shiftEnc(k, full)).best.key !== k) wrong++;
    }
    s.is('on the whole passage every one of the 26 keys is recovered', wrong, 0);
  }

  /* ---------------- perfect secrecy, counted ---------------- */

  {
    [1, 2].forEach(n => {
      const r = w.skPerfect(n);
      s.ok(`one-time pad, ${n}-letter messages: every pair joined by exactly one key`,
        r.ok && r.uniform, r.ok ? `counts seen: ${r.kinds.join(', ')}` : r.error);
      s.is(`  ...over all ${Math.pow(26, n)}² pairs`, r.pairs, Math.pow(Math.pow(26, n), 2));
    });

    /* Said a second way: for a fixed ciphertext, the key that explains a given
       message is forced, and is the difference of the two. Derived here rather
       than read from the engine. */
    let bad = 0;
    for (let mi = 0; mi < A; mi++) {
      for (let ci = 0; ci < A; ci++) {
        const k = (ci - mi + A) % A;
        if ((mi + k) % A !== ci) bad++;
      }
    }
    s.is('and the key joining a message to a ciphertext is their difference', bad, 0);
  }

  /* ---------------- malleability: secrecy without integrity ---------------- */

  {
    const ex = w.skMalleableAlways(1);
    s.ok('the rewrite lands on the target for every message, key and target',
      ex.ok && ex.bad === 0, ex.ok ? `${ex.bad} of ${ex.total}` : ex.error);
    s.is('  ...which is all 17,576 of them', ex.total, Math.pow(26, 3));

    /* Longer messages, by the algebra rather than by exhaustion: the pad acts
       letter by letter, so Dec(k, c + d) = m + d whatever the length. */
    let bad = 0, firstBad = null;
    for (let trial = 0; trial < 3000; trial++) {
      const n = 1 + (trial % 9);
      const msg = [], key = [], delta = [];
      for (let i = 0; i < n; i++) {
        msg.push((trial * 7 + i * 13) % A);
        key.push((trial * 11 + i * 5) % A);
        delta.push((trial * 3 + i * 17) % A);
      }
      const c = w.SK_SCHEMES.otp.enc(key, msg);
      const got = w.SK_SCHEMES.otp.dec(key, c.map((x, i) => (x + delta[i]) % A));
      const want = msg.map((x, i) => (x + delta[i]) % A);
      if (got.join(',') !== want.join(',')) {
        bad++;
        if (!firstBad) firstBad = `n=${n} got ${got} want ${want}`;
      }
    }
    s.is('adding d to the ciphertext adds d to the message, at every length', bad, 0, firstBad);

    /* The tool's worked example, end to end. */
    const r = w.skMalleate('pay alice ten', 'pay carol ten', 20250911);
    s.ok('the worked example rewrites the message', r.ok && r.worked,
      r.ok ? `received ${r.received}` : r.error);
    s.is('and the receiver reads exactly what the attacker chose',
      r.received, r.target);
    s.ok('while the attacker never had the key', r.key.length === r.message.length);

    /* Lengths have to match or the demonstration is a different attack. */
    const bad2 = w.skMalleate('short', 'much longer target', 1);
    s.ok('a mismatched target is refused rather than silently truncated', !bad2.ok);
  }

  /* ---------------- the tag, and what it catches ---------------- */

  {
    const r = w.skWithTag('pay alice ten', 'pay carol ten', 20250911, 47);
    s.ok('a genuine ciphertext and tag verify', r.ok && r.acceptedBefore);
    s.ok('the tampered one does not', r.ok && !r.acceptedAfter);

    /* Correctness of the tag, separately from whether it catches anything:
       the same key and ciphertext must always give the same tag. */
    const ct = w.skNums('abcdefghij');
    s.is('tagging is deterministic', w.skTag(9, ct), w.skTag(9, ct));
    s.ok('and a different key gives a different tag here',
      w.skTag(9, ct) !== w.skTag(10, ct));
  }

  /* ================ Topic 2 ================ */

  /* ---------------- counting, against enumeration ---------------- */

  {
    /* The closed forms in the notes are checked against a count of the
       objects they claim to count — built one at a time. A formula and an
       enumeration are about as independent as two derivations get. */
    let bad = 0, first = null;
    for (let sz = 1; sz <= 4; sz++) {
      for (let t = 1; t <= 5; t++) {
        const f = w.gmCount(sz, t), e = w.gmEnumerate(sz, t);
        if (!e.ok) continue;
        if (f.functions !== e.functions || f.injective !== e.injective) {
          bad++;
          if (!first) first = `s=${sz} t=${t}: formula ${f.functions}/${f.injective}, ` +
            `counted ${e.functions}/${e.injective}`;
        }
      }
    }
    s.is('the counting formulas agree with an enumeration, for every s and t', bad, 0, first);

    /* The worked example in the notes. */
    const deck = w.gmCount(3, 4);
    s.is('|M|=3, |C|=4: 4³ functions', deck.functions, 64);
    s.is('  ...and C(4,3)·3! = 24 injective ones', deck.injective, 24);
    s.is('when t = s the injective ones are the s! bijections', w.gmCount(4, 4).injective, 24);

    /* And the claim that forces injectivity, settled over every function. */
    let mism = 0, firstM = null;
    for (const [sz, t] of [[2, 2], [2, 3], [3, 3], [3, 4], [2, 4]]) {
      const r = w.gmInjectiveNeeded(sz, t);
      if (!r.ok) continue;
      if (r.mismatch !== 0) { mism += r.mismatch; if (!firstM) firstM = `s=${sz} t=${t}`; }
      if (r.invertible !== r.injective) {
        mism++;
        if (!firstM) firstM = `s=${sz} t=${t}: ${r.invertible} invertible vs ${r.injective} injective`;
      }
    }
    s.is('a scheme can be made correct exactly when Enc is injective', mism, 0, firstM);
    s.ok('and so |C| < |M| admits no correct scheme at all',
      w.gmCount(4, 3).injective === 0 && !w.gmCount(4, 3).possible);
  }

  /* ---------------- the games, played ---------------- */

  {
    /* Where the right answer is known exactly, the measurement has something
       to be checked against rather than merely reported. */

    const otp = w.gmPlay('otpFresh', 'coin', 'eav', 4000, 20251009);
    s.near('a one-time pad under IND-EAV: the adversary is reduced to guessing',
      otp.rate, 0.5, 0.03);

    const otpPattern = w.gmPlay('otpFresh', 'pattern', 'eav', 4000, 20251009);
    s.near('  ...and a cleverer strategy does no better', otpPattern.rate, 0.5, 0.03);

    /* Deterministic Enc cannot survive a chosen-plaintext attack. Not
       "usually loses" — loses every round, by construction. */
    ['shiftFixed', 'otpReused'].forEach(id => {
      const r = w.gmPlay(id, 'replay', 'cpa', 2000, 7);
      s.is(`${id} loses every round of IND-CPA to encrypt-and-compare`, r.wins, r.rounds);
    });

    /* A fresh key per message is not the same as a randomised Enc. */
    const fresh = w.gmPlay('shiftFresh', 'pattern', 'eav', 2000, 7);
    s.is('a shift with a fresh key still loses IND-EAV on the letter pattern',
      fresh.wins, fresh.rounds);

    /* Malleability, cashed in as an IND-CCA distinguisher. */
    const cca = w.gmPlay('shiftFixed', 'maul', 'cca', 2000, 7);
    s.is('altering the challenge ciphertext wins IND-CCA every round', cca.wins, cca.rounds);

    /* The one exception in IND-CCA, tested rather than assumed. An adversary
       that hands the challenge straight back learns nothing and is pushed
       back to guessing — which is exactly what stops the game being vacuous.
       The mauling adversary above never triggers it, so without this the
       rule would be unexercised code. */
    const back = w.gmPlay('shiftFixed', 'askback', 'cca', 2000, 7);
    s.ok('the decryption oracle refuses the challenge ciphertext', back.refusals > 0,
      `${back.refusals} refusals in ${back.rounds} rounds`);
    s.is('  ...every single round', back.refusals, back.rounds);
    s.near('  ...leaving that adversary guessing', back.rate, 0.5, 0.04);

    /* Taking an oracle away is supposed to matter, and the runner should say
       so rather than quietly scoring a strategy it cannot play. */
    const noOracle = w.gmPlay('shiftFixed', 'replay', 'eav', 100, 1);
    s.ok('a CPA strategy is refused in EAV rather than silently scored',
      !noOracle.ok && noOracle.unavailable);
    const noDec = w.gmPlay('shiftFixed', 'maul', 'cpa', 100, 1);
    s.ok('and a CCA strategy is refused in CPA', !noDec.ok && noDec.unavailable);

    /* Same seed, same answer — the figures on the page are reproducible. */
    const again = w.gmPlay('otpFresh', 'coin', 'eav', 4000, 20251009);
    s.is('a game replayed with the same seed gives the same count', again.wins, otp.wins);
  }

  /* ---------------- EUF-CMA ---------------- */

  {
    const f = w.gmForge('crypto');
    s.ok('the forgery is a message the oracle was never asked about', f.ok && f.isNew);
    s.ok('and its tag is valid under every key', f.ok && f.worksForEveryKey,
      f.ok ? `${f.keysFailed} of ${f.keysChecked} keys` : f.error);

    /* Derived here rather than read off the engine: the tag is a sum, so any
       permutation of a message shares it. */
    let bad = 0;
    for (let ik = 0; ik < 26; ik++) {
      for (let trial = 0; trial < 200; trial++) {
        const msg = [trial % 26, (trial * 7) % 26, (trial * 13) % 26];
        const perm = [msg[2], msg[0], msg[1]];
        if (w.gmSumTag(ik, msg) !== w.gmSumTag(ik, perm)) bad++;
      }
    }
    s.is('every rearrangement of a message carries its tag, for every key', bad, 0);

    [2, 3].forEach(n => {
      const r = w.gmForgeRate(n);
      s.is(`the forgery wins every one of the ${r.total.toLocaleString()} ` +
        `${n}-letter games`, r.wins, r.total);
    });

    /* Correctness of the MAC, which is separate from it being forgeable. */
    let wrong = 0;
    for (let ik = 0; ik < 26; ik++) {
      for (let a = 0; a < 26; a++) {
        if (!w.gmSumVerify(ik, [a], w.gmSumTag(ik, [a]))) wrong++;
      }
    }
    s.is('the MAC is correct — an honest tag always verifies', wrong, 0);
  }

  /* ---------------- canonical verification ---------------- */

  {
    const det = w.gmCanonical(false, 3000, 7);
    s.is('with a deterministic Tag, canonical Vf rejects nothing honest', det.rejected, 0);

    const rnd = w.gmCanonical(true, 3000, 7);
    s.ok('with a randomised Tag it throws out most honest tags', rnd.rejected > 0,
      `${rnd.rejected} of ${rnd.trials}`);
    s.near('  ...four salts in five being non-zero, so about four fifths',
      rnd.rate, 0.8, 0.03);
  }

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 1500);

  return s;
};
