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

  /* ================ Topic 3 ================ */

  /* ---------------- the worked examples printed in the notes ---------------- */

  {
    /* The strongest kind of assertion available here: someone else wrote the
       answer down, and the engine has to produce it. */
    s.is('hello − abcde = hdjik', w.hiAddMod('hello', 'abcde', -1), 'hdjik');
    s.is('01000101 ⊕ 01110110 = 00110011',
      w.hiXor('01000101', '01110110'), '00110011');
    s.is('Enc(yajayap, caracal) = aaaaaaa',
      w.hiText(w.hiVigEnc(w.hiNums('yajayap'), w.hiNums('caracal'))), 'aaaaaaa');
    s.same('trace(hello) = (23, 7, 0, 3)', w.hiTrace(w.hiNums('hello')), [23, 7, 0, 3]);
    s.is('Enc(1, hello) = ifmmp', w.hiText(w.hiCaesarEnc(1, w.hiNums('hello'))), 'ifmmp');
    s.ok('and ifmmp has the same trace as hello',
      w.hiSameTrace(w.hiNums('hello'), w.hiNums('ifmmp')));

    /* 26! — the notes say ≈ 2^88.4, which is worth being able to check. */
    const ks = w.hiKeySpaces(5);
    s.is('26! exactly', ks.subst.size, '403291461126605635584000000');
    s.near('  ...which is about 2^88.4 as the notes say', ks.subst.bits, 88.4, 0.05);
    s.is('the Caesar key space is 26', ks.caesar.size, '26');
    s.ok('and the Vigenère key space is at least 26ⁿ',
      BigInt(ks.vigenere.size) >= BigInt(ks.vigenere.atLeast));
  }

  /* ---------------- correctness of all three ciphers ---------------- */

  {
    const msg = w.hiNums('attackatdawn');
    let bad = 0;
    for (let k = 0; k < 26; k++) {
      if (w.hiText(w.hiCaesarDec(k, w.hiCaesarEnc(k, msg))) !== w.hiText(msg)) bad++;
    }
    s.is('Caesar round-trips under every key', bad, 0);

    let badP = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const perm = w.hiPerm(seed);
      const sorted = perm.slice().sort((a, b) => a - b).join(',');
      if (sorted !== Array.from({ length: 26 }, (_, i) => i).join(',')) badP++;
      if (w.hiText(w.hiSubstDec(perm, w.hiSubstEnc(perm, msg))) !== w.hiText(msg)) badP++;
    }
    s.is('every generated substitution key really is a permutation, and round-trips',
      badP, 0);

    let badV = 0;
    for (const key of ['a', 'key', 'crypto', 'zzzz']) {
      const kk = w.hiNums(key);
      if (w.hiText(w.hiVigDec(kk, w.hiVigEnc(kk, msg))) !== w.hiText(msg)) badV++;
    }
    s.is('Vigenère round-trips', badV, 0);

    /* A one-letter Vigenère key is a Caesar cipher — same cipher, two names. */
    let same = 0;
    for (let k = 0; k < 26; k++) {
      if (w.hiText(w.hiVigEnc([k], msg)) === w.hiText(w.hiCaesarEnc(k, msg))) same++;
    }
    s.is('a one-letter Vigenère key is exactly Caesar', same, 26);
  }

  /* ---------------- the trace claim, by exhaustion ---------------- */

  {
    [2, 3].forEach(len => {
      const r = w.hiTraceClaim(len);
      s.is(`${len}-letter words: reachable by some key = shares a trace, no exceptions`,
        r.mismatch, 0, `${r.messages} messages checked`);
      s.is(`  ...and each has exactly 26 of each`, r.pairs, r.messages * 26);
    });

    /* Said another way, derived here: a shift leaves every gap alone. */
    let moved = 0;
    for (let a = 0; a < 26; a++) {
      for (let b = 0; b < 26; b++) {
        for (let k = 0; k < 26; k++) {
          const before = (b - a + 26) % 26;
          const after = (((b + k) % 26) - ((a + k) % 26) + 26) % 26;
          if (before !== after) moved++;
        }
      }
    }
    s.is('a shift changes no gap, over all 17,576 letter-pair-and-key cases', moved, 0);

    /* The crib scan finds the right key when it finds anything at all. */
    const ct = w.hiText(w.hiCaesarEnc(5, w.hiNums('the secret message')));
    const scan = w.hiCribScan(ct);
    s.ok('a crib scan finds common words by their gaps alone', scan.hits.length > 0);
    s.ok('and every hit names the real key',
      scan.hits.every(h => h.key === 5),
      scan.hits.map(h => `${h.word}:${h.key}`).join(' '));
  }

  /* ---------------- brute force ---------------- */

  {
    const ct = w.hiText(w.hiCaesarEnc(5, w.hiNums('thesecretmessage')));
    const r = w.hiBruteCaesar([{ m: 'thesecretmessage', c: ct }]);
    s.is('brute force tries the whole key space', r.tried, 26);
    s.same('and one known pair leaves exactly the right key', r.survivors, [5]);

    /* A single short pair need not pin it down — worth knowing rather than
       assuming the attack always succeeds outright. */
    const short = w.hiText(w.hiCaesarEnc(5, w.hiNums('a')));
    const rs = w.hiBruteCaesar([{ m: 'a', c: short }]);
    s.is('one letter is still enough for Caesar, since the key is one letter',
      rs.survivors.length, 1);
  }

  /* ---------------- breaking Vigenère ---------------- */

  {
    /* Enough ciphertext and the key falls out; too little and it does not.
       Both directions are asserted, because a tool that always succeeded
       would be teaching that the attack is free. */
    const easy = w.hiVigSuccess('key', 120);
    s.ok('a 3-letter key is recovered from 120 letters', easy.correct,
      `got ${easy.found}`);

    const long = w.hiVigSuccess('crypto', 200);
    s.ok('a 6-letter key is recovered from 200 letters', long.correct,
      `got ${long.found}`);

    const thin = w.hiVigSuccess('crypto', 40);
    s.ok('but not from 40 — about six letters a column is not enough', !thin.correct,
      `got ${thin.found}, which would mean the attack is free`);

    /* The key length is found before the key, from the ciphertext alone. */
    const ct = w.hiText(w.hiVigEnc(w.hiNums('crypto'), w.hiNums(w.HI_SAMPLE)));
    s.is('the key length is recovered from the ciphertext alone',
      w.hiGuessKeyLength(ct, 10).best, 6);

    /* And each column really is a Caesar cipher: attacking one directly
       agrees with what the full break says about it. */
    const full = w.hiBreakVigenere(ct, 6);
    const c = w.hiNums(ct);
    let disagree = 0;
    for (let i = 0; i < 6; i++) {
      const col = [];
      for (let j = i; j < c.length; j += 6) col.push(c[j]);
      if (w.hiBestShift(col).key !== full.key[i]) disagree++;
    }
    s.is('each column attacked on its own agrees with the full break', disagree, 0);
  }

  /* ---------------- perfect secrecy and its price ---------------- */

  {
    /* The notes' own list of candidate messages for aaaaaaa. */
    const words = ['leopard', 'caracal', 'lioness', 'cheetah', 'panther'];
    const cands = w.hiCandidates('aaaaaaa', words);
    s.is('every seven-letter candidate has a key reaching aaaaaaa',
      cands.length, words.length);
    s.ok('and each of those keys really produces it', cands.every(c => c.checks),
      cands.filter(c => !c.checks).map(c => c.message).join(', '));

    /* The keys are all different — which is the uniqueness that forces
       |K| ≥ |M|, derived here rather than quoted. */
    const keys = new Set(cands.map(c => c.key));
    s.is('and they are all different keys', keys.size, words.length);

    const ex = w.hiTwoTimeAlways(1);
    s.is('reuse leaks the difference, over every message pair and key', ex.bad, 0);
    s.is('  ...all 17,576 of them', ex.total, Math.pow(26, 3));

    const tt = w.hiTwoTime('attackatdawn', 'retreatatten', 'qwertyuiopas');
    s.ok('the worked example leaks m₂ − m₁', tt.ok && tt.leaks);
    s.is('and guessing m₁ recovers m₂ exactly', tt.recovered, 'retreatatten');
    s.ok('a key shorter than the messages is refused rather than silently repeated',
      !w.hiTwoTime('attackatdawn', 'retreatatten', 'abc').ok);
  }

  /* ================ Topic 4 ================ */

  /* ---------------- the worked SPN example from the notes ---------------- */

  {
    const msg = w.bkBits('01100111', 8);
    s.is('S(0110 0111) = 0101 1110', w.bkStr(w.bkSub(msg, 4)), '01011110');
    s.is('P(S(m)) = 1011 0110', w.bkStr(w.bkPerm(w.bkSub(msg, 4))), '10110110');

    /* The four S-box entries the notes print, kept exactly. */
    s.is('S(0000) = 0100', w.bkStr(w.bkFromInt(w.BK_S[0], 4)), '0100');
    s.is('S(0001) = 0011', w.bkStr(w.bkFromInt(w.BK_S[1], 4)), '0011');
    s.is('S(0110) = 0101', w.bkStr(w.bkFromInt(w.BK_S[6], 4)), '0101');
    s.is('S(0111) = 1110', w.bkStr(w.bkFromInt(w.BK_S[7], 4)), '1110');

    s.is('the S-box is a permutation of the 16 nibbles', new Set(w.BK_S).size, 16);
    s.same('and P is the one printed', w.BK_P, [2, 6, 5, 1, 3, 4, 7, 8]);
    s.is('P is a permutation of the 8 indices', new Set(w.BK_P).size, 8);

    /* P and its inverse really undo each other, on every block. */
    let bad = 0;
    for (let x = 0; x < 256; x++) {
      const b = w.bkFromInt(x, 8);
      if (w.bkStr(w.bkPermInv(w.bkPerm(b))) !== w.bkStr(b)) bad++;
      if (w.bkStr(w.bkSubInv(w.bkSub(b, 4), 4)) !== w.bkStr(b)) bad++;
    }
    s.is('S⁻¹ and P⁻¹ undo S and P on all 256 blocks', bad, 0);
  }

  /* ---------------- an SPN is a permutation, and inverts ---------------- */

  {
    let notPerm = 0, failed = 0, first = null;
    for (let k = 0; k < 8; k++) {
      const key = w.bkFromInt(k * 31, 8);
      for (const r of [2, 3, 4]) {
        const p = w.bkIsPermutation(key, r, 8, 4);
        const t = w.bkSPNRoundTrips(key, r, 8, 4);
        if (!p.isPerm) notPerm++;
        if (t.bad) { failed += t.bad; if (!first) first = `key ${k}, ${r} rounds: ${t.first}`; }
      }
    }
    s.is('F_sk is a permutation for every key and round count tried', notPerm, 0);
    s.is('and inverting returns the message on every one of the 256 blocks',
      failed, 0, first);

    /* The construction's own argument: a composition of permutations. Checked
       at the level of a single round rather than assumed. */
    const key = w.bkFromInt(178, 8);
    const seen = new Set();
    for (let x = 0; x < 256; x++) {
      seen.add(w.bkStr(w.bkPerm(w.bkSub(w.bkXor(w.bkFromInt(x, 8), key), 4))));
    }
    s.is('one round alone is already a permutation', seen.size, 256);
  }

  /* ---------------- Feistel inverts whatever f is ---------------- */

  {
    /* The claim the notes call remarkable, and the reason to test it: the
       round function may be as far from invertible as you like. */
    ['mix', 'crush', 'constant'].forEach(fn => {
      const inj = w.bkRoundFnInjective(fn, 4);
      let bad = 0, notPerm = 0;
      for (let k = 0; k < 8; k++) {
        const r = w.bkFeistelRoundTrips(w.bkFromInt(k * 31, 8), 3, 8, fn);
        bad += r.bad;
        if (!r.isPerm) notPerm++;
      }
      s.is(`Feistel with "${fn}" inverts on every block, for every key`, bad, 0);
      s.is(`  ...and is still a permutation`, notPerm, 0);
      if (fn !== 'mix') {
        s.ok(`  ...even though "${fn}" is not injective (${inj.images} of ${inj.inputs} images)`,
          !inj.injective);
      }
    });

    /* The constant round function is the extreme case: one image out of 16. */
    s.is('the constant round function really does collapse everything to one value',
      w.bkRoundFnInjective('constant', 4).images, 1);

    /* And f is genuinely never inverted — inverting a round only ever calls f
       forwards, which is why the above can hold. */
    const key = w.bkFromInt(178, 8);
    const m0 = w.bkFromInt(103, 8);
    const ct = w.bkFeistel(key, m0, 4, 'constant');
    s.is('a four-round Feistel round-trips too',
      w.bkFeistelInv(key, ct.bits, 4, 'constant').out, w.bkStr(m0));
  }

  /* ---------------- counting permutations ---------------- */

  {
    /* The notes' three small numbers. */
    s.is('(2¹)! = 2', w.bkPermCount(1).count, '2');
    s.is('(2²)! = 24', w.bkPermCount(2).count, '24');
    s.is('(2³)! = 40320', w.bkPermCount(3).count, '40320');
    s.is('(2⁴)! = 16!', w.bkPermCount(4).count, '20922789888000');

    /* Derived here rather than read from the engine. */
    let fact = 1n;
    for (let i = 2n; i <= 16n; i++) fact *= i;
    s.is('  ...which an independent factorial agrees with',
      w.bkPermCount(4).count, fact.toString());

    s.is('writing a permutation of {0,1}³ down takes ℓ·2^ℓ = 24 bits',
      w.bkPermCount(3).toWrite, 24);

    /* The headline figure: the notes say ≈ 2^(4.31×10⁴⁰) at ℓ = 128. */
    const big = w.bkHugeCase(128);
    s.near('at ℓ = 128 the exponent is about 4.31×10⁴⁰',
      big.log2OfCount / 1e40, 4.31, 0.02);
  }

  /* ---------------- the PRP game ---------------- */

  {
    /* Each cell of the table on the page, asserted. A strategy that beat
       everything, or nothing, would make the tool decorative. */
    const rate = (c, st) => w.bkPlayPRP(c, 8, st, 2000, 4242).rate;

    s.ok('a plain XOR falls to the difference strategy', rate('xoronly', 'difference') > 0.9);
    s.ok('and to the locality strategy too', rate('xoronly', 'locality') > 0.9);

    s.near('one round defeats the difference strategy',
      rate('oneround', 'difference'), 0.5, 0.04);
    s.ok('but falls to the locality strategy — one P cannot diffuse',
      rate('oneround', 'locality') > 0.9);

    s.near('three rounds defeat the difference strategy',
      rate('threeround', 'difference'), 0.5, 0.04);
    s.near('and the locality strategy as well', rate('threeround', 'locality'), 0.5, 0.04);

    /* Reproducible: the figures quoted on the page are the same every time. */
    s.is('the same seed gives the same count',
      w.bkPlayPRP('oneround', 8, 'locality', 500, 99).wins,
      w.bkPlayPRP('oneround', 8, 'locality', 500, 99).wins);
  }

  /* ---------------- question bank ---------------- */

  checkQuestionBank(s, m, 1500);

  return s;
};
