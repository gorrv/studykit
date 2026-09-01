  /* ============================================================
     MOCK EXAM — a scored, optionally timed test over any set of weeks
     ============================================================ */
  const EX_WEEKS = [
    { w: 1, label: 'W1 · Intro, search &amp; A*', topics: ['ai-intro', 'search', 'astar'] },
    { w: 2, label: 'W2 · Adversarial &amp; CSP', topics: ['minimax', 'csp'] },
    { w: 3, label: 'W3 · Planning', topics: ['planning'] },
    { w: 4, label: 'W4 · MDPs', topics: ['mdp'] },
    { w: 5, label: 'W5 · Machine learning', topics: ['ml'] },
    { w: 6, label: 'W6 · Clustering', topics: ['clustering'] },
    { w: 7, label: 'W7 · Regression &amp; trees', topics: ['supervised'] },
    { w: 8, label: 'W8 · Reinforcement learning', topics: ['rl'] },
    { w: 9, label: 'W9 · AI ethics', topics: ['ethics'] }
  ];
  const EX_TOPIC_W = {};
  EX_WEEKS.forEach(x => x.topics.forEach(t => EX_TOPIC_W[t] = x.w));
  const EX = { phase: 'setup', weeks: {}, n: 20, limit: 0, qs: [], answers: [], i: 0,
               endsAt: 0, timer: null, reveal: false, err: '', requested: 20, short: false };
  EX_WEEKS.forEach(x => EX.weeks[x.w] = true);

  function exWeek(w) { EX.weeks[w] = !EX.weeks[w]; EX.err = ''; exRender(); }
  function exAll(on) { EX_WEEKS.forEach(x => EX.weeks[x.w] = on); EX.err = ''; exRender(); }
  function exSet(k, v) { EX[k] = Number(v); exRender(); }
  function exPool() {
    const topics = [];
    EX_WEEKS.forEach(x => { if (EX.weeks[x.w]) topics.push.apply(topics, x.topics); });
    return QZ_GEN.filter(g => topics.indexOf(g.topic) >= 0);
  }
  function exBuild() {
    const pool = exPool();
    if (!pool.length) return [];
    const qs = [], seen = {};
    let guard = 0;
    while (qs.length < EX.n && guard < EX.n * 80) {
      guard++;
      const g = pool[Math.floor(Math.random() * pool.length) % pool.length];
      let q = null;
      try { q = g.make(); } catch (e) { continue; }
      if (!q || !q.prompt) continue;
      const sig = String(q.prompt).replace(/\s+/g, ' ') + '||' + String(q.answer);
      if (seen[sig]) continue;
      seen[sig] = 1;
      q.gtopic = g.topic; q.week = EX_TOPIC_W[g.topic];
      qs.push(q);
    }
    return qs;
  }
  function exStart() {
    if (!EX_WEEKS.some(x => EX.weeks[x.w])) { EX.err = 'Pick at least one week first.'; exRender(); return; }
    const qs = exBuild();
    if (!qs.length) { EX.err = 'No questions available for that selection.'; exRender(); return; }
    EX.err = ''; EX.qs = qs; EX.answers = qs.map(() => null); EX.i = 0;
    EX.requested = EX.n; EX.short = qs.length < EX.n;
    EX.phase = 'run'; EX.reveal = false;
    exClock(true);
    exRender();
  }
  function exClock(on) {
    if (EX.timer) { clearInterval(EX.timer); EX.timer = null; }
    if (!on || !EX.limit) { EX.endsAt = 0; return; }
    EX.endsAt = Date.now() + EX.limit * 1000;
    EX.timer = setInterval(function () {
      if (EX.phase !== 'run') { exClock(false); return; }
      const left = Math.max(0, Math.round((EX.endsAt - Date.now()) / 1000));
      const el = document.getElementById('ex-clock');
      if (el) { el.textContent = exMMSS(left); el.style.color = left <= 60 ? 'var(--accent-2)' : ''; }
      if (left <= 0) { exFinish(); }
    }, 1000);
  }
  function exMMSS(s) { const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }
  function exAnswer(v) {
    const q = EX.qs[EX.i];
    if (!q || EX.answers[EX.i] !== null) return;
    if (v === null || String(v).trim() === '') {
      EX.err = 'Type an answer, or press Skip.';
      exRender(); return;
    }
    EX.err = '';
    let res;
    try { res = q.check(v); } catch (e) { res = { ok: false, msg: 'Could not read that answer.' }; }
    EX.answers[EX.i] = { given: v, ok: !!res.ok, msg: res.msg || '' };
    exRender();
  }
  function exTextAnswer() {
    const el = document.getElementById('ex-input');
    exAnswer(el ? el.value : '');
  }
  function exSkip() {
    if (EX.answers[EX.i] === null) EX.answers[EX.i] = { given: null, ok: false, skipped: true };
    EX.err = '';
    exGo(1);
  }
  function exGo(d) {
    const n = EX.qs.length;
    EX.i = Math.max(0, Math.min(n - 1, EX.i + d));
    EX.err = '';
    exRender();
  }
  function exJump(i) { EX.i = i; EX.err = ''; exRender(); }
  function exFinish() {
    EX.qs.forEach((q, i) => { if (EX.answers[i] === null) EX.answers[i] = { given: null, ok: false, skipped: true }; });
    EX.phase = 'done'; exClock(false); exRender();
  }
  function exRestart() { EX.phase = 'setup'; EX.err = ''; exClock(false); exRender(); }
  function exRetryWrong() {
    const wrong = EX.qs.filter((q, i) => !EX.answers[i].ok);
    if (!wrong.length) return;
    EX.qs = wrong; EX.answers = wrong.map(() => null); EX.i = 0;
    EX.phase = 'run'; EX.reveal = false; EX.err = '';
    exClock(!!EX.limit);
    exRender();
  }
  function exToggleReveal() { EX.reveal = !EX.reveal; exRender(); }

  function exRender() {
    const out = document.getElementById('ex-output');
    if (!out) return;
    let html = '';
    if (EX.phase === 'setup') {
      const pool = exPool();
      html += '<div class="ix-bar"><span class="ix-lab"><strong>which weeks?</strong></span>'
        + `<button class="ix-btn" onclick="exAll(true)">all</button><button class="ix-btn" onclick="exAll(false)">none</button></div>`;
      html += '<div class="concept-grid" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:8px; margin-top:0;">';
      EX_WEEKS.forEach(x => {
        const on = EX.weeks[x.w], cnt = QZ_GEN.filter(g => x.topics.indexOf(g.topic) >= 0).length;
        html += `<label style="display:flex; align-items:center; gap:8px; border:1px solid ${on ? 'var(--accent)' : 'var(--rule)'};
          border-radius:8px; padding:9px 11px; cursor:pointer; background:${on ? 'var(--tint-a)' : 'var(--surface-2)'};">
          <input type="checkbox" ${on ? 'checked' : ''} onchange="exWeek(${x.w})" style="accent-color:var(--accent); cursor:pointer;">
          <span style="flex:1;"><span style="font-size:13px;">${x.label}</span>
          <span style="display:block; font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--ink-muted);">${cnt} generators</span></span></label>`;
      });
      html += '</div>';
      html += `<div class="ix-bar" style="margin-top:14px;"><span class="ix-lab">questions</span><span class="ix-seg">`
        + [10, 20, 40, 60].map(n => `<button class="${EX.n === n ? 'on' : ''}" onclick="exSet('n',${n})">${n}</button>`).join('')
        + `</span><span class="ix-lab">time limit</span><span class="ix-seg">`
        + [[0, 'none'], [600, '10 min'], [1200, '20 min'], [2700, '45 min'], [5400, '90 min']]
            .map(t => `<button class="${EX.limit === t[0] ? 'on' : ''}" onclick="exSet('limit',${t[0]})">${t[1]}</button>`).join('')
        + '</span></div>';
      html += `<div class="metrics"><div class="metric"><div class="mn">question pool</div><div class="mv">${pool.length}</div><div class="mf">generators across the weeks you picked</div></div>
        <div class="metric"><div class="mn">paper length</div><div class="mv">${EX.n}</div><div class="mf">${EX.limit ? 'in ' + exMMSS(EX.limit) : 'untimed'}</div></div>
        <div class="metric dim"><div class="mn">per question</div><div class="mv">${EX.limit ? Math.round(EX.limit / EX.n) + 's' : '—'}</div><div class="mf">${EX.limit ? 'average budget' : 'take as long as you like'}</div></div></div>`;
      if (EX.err) html += `<div class="tool-error">${EX.err}</div>`;
      html += `<div class="tool-controls" style="margin-top:12px;"><button class="tool-btn green" onclick="exStart()">Start the paper ▶</button></div>`;
      html += `<p class="ix-hint">Questions are drawn from the same generators as the self-test, but <strong>numbers are freshly randomised every time</strong>, so you cannot learn the answers.
        Nothing is graded until you finish, you can move back and forth, and at the end you get a <strong>per-week breakdown</strong> and every question you got wrong with its explanation.</p>`;
      out.innerHTML = html; return;
    }
    if (EX.phase === 'run') {
      const n = EX.qs.length, q = EX.qs[EX.i], a = EX.answers[EX.i];
      const done = EX.answers.filter(x => x !== null).length;
      html += `<div class="ix-bar"><span class="ix-lab">question <strong>${EX.i + 1}</strong> of ${n}</span>
        <span class="ix-lab">answered <strong>${done}</strong></span>`;
      if (EX.limit) html += `<span class="ix-lab">time left <strong id="ex-clock">${exMMSS(Math.max(0, Math.round((EX.endsAt - Date.now()) / 1000)))}</strong></span>`;
      html += `<button class="ix-btn" onclick="exGo(-1)" ${EX.i === 0 ? 'disabled' : ''}>◀ back</button>
        <button class="ix-btn" onclick="exGo(1)" ${EX.i >= n - 1 ? 'disabled' : ''}>next ▶</button>
        <button class="ix-btn" onclick="exSkip()">skip</button>
        <button class="ix-btn" onclick="exFinish()">finish &amp; mark</button></div>`;
      /* progress strip */
      html += '<div style="display:flex; gap:3px; margin:10px 0 4px 0; flex-wrap:wrap;">';
      EX.qs.forEach((qq, i) => {
        const st = EX.answers[i];
        const col = i === EX.i ? 'var(--accent)' : st === null ? 'var(--rule)' : st.skipped ? 'var(--ink-muted)' : 'var(--accent-4)';
        html += `<button onclick="exJump(${i})" title="question ${i + 1}" aria-label="go to question ${i + 1}"
          style="width:18px; height:8px; border-radius:3px; border:none; padding:0; cursor:pointer; background:${col};"></button>`;
      });
      html += '</div>';
      const wk = EX_WEEKS.filter(x => x.w === q.week)[0];
      if (EX.short && EX.i === 0) html += `<div class="verdict warn" style="margin:10px 0;">You asked for ${EX.requested} questions but this selection only has
        <strong>${n} distinct ones</strong> — the generators for these weeks run out before that. Tick more weeks, or sit a shorter paper and re-sit it.</div>`;
      html += `<div class="quiz-prompt"><div class="qp-topic">${wk ? wk.label : q.gtopic}</div>${q.prompt}</div>`;
      if (q.kind === 'choice') {
        html += '<div class="quiz-choices">';
        q.choices.forEach((c, i) => {
          let cls = 'quiz-choice';
          if (a && a.given !== null && qzNorm(c) === qzNorm(a.given)) cls += ' right';
          html += `<button class="${cls}" onclick="exAnswer(${JSON.stringify(c).replace(/"/g, '&quot;')})" ${a ? 'disabled' : ''}>${c}</button>`;
        });
        html += '</div>';
      } else {
        html += `<div class="tool-controls" style="margin:8px 0;">
          <div class="tool-field" style="flex:1; min-width:220px;"><label>your answer</label>
            <input type="text" id="ex-input" data-nolive placeholder="${esc(q.placeholder || '')}" style="width:100%;"
              onkeydown="if(event.key==='Enter'){exTextAnswer();}" ${a ? 'disabled' : ''}
              value="${a && a.given !== null ? esc(String(a.given)) : ''}"></div>
          <button class="tool-btn" onclick="exTextAnswer()" ${a ? 'disabled' : ''}>Lock in</button></div>`;
      }
      if (EX.err) html += `<div class="tool-error">${EX.err}</div>`;
      if (a) html += `<div class="verdict safe" style="margin-top:10px;">Answer recorded${EX.i < n - 1 ? ' — <strong>next ▶</strong> when ready.' : ' — that was the last one, press <strong>finish &amp; mark</strong>.'} Nothing is marked until you finish.</div>`;
      out.innerHTML = html; return;
    }
    /* ---- results ---- */
    const n = EX.qs.length, right = EX.answers.filter(x => x.ok).length;
    const pct = n ? Math.round(100 * right / n) : 0;
    const skipped = EX.answers.filter(x => x.skipped).length;
    const byW = {};
    EX.qs.forEach((q, i) => {
      const k = q.week || 0;
      if (!byW[k]) byW[k] = { r: 0, t: 0 };
      byW[k].t++; if (EX.answers[i].ok) byW[k].r++;
    });
    html += `<div class="metrics">
      <div class="metric"><div class="mn">score</div><div class="mv">${right} / ${n}</div><div class="mf">${skipped ? skipped + ' skipped' : 'nothing skipped'}</div></div>
      <div class="metric"><div class="mn">percentage</div><div class="mv" style="color:${pct >= 70 ? 'var(--accent-3)' : pct >= 50 ? 'var(--accent)' : 'var(--accent-2)'};">${pct}%</div><div class="mf">${pct >= 70 ? 'comfortable' : pct >= 50 ? 'passable — tighten the weak weeks' : 'go back to the notes first'}</div></div>
      <div class="metric dim"><div class="mn">weeks covered</div><div class="mv">${Object.keys(byW).length}</div><div class="mf">${EX.limit ? 'timed paper' : 'untimed'}</div></div>
    </div>`;
    if (EX.short) html += `<div class="verdict warn" style="margin-top:12px;">This paper was <strong>${n} questions, not the ${EX.requested} you asked for</strong> — that selection has no more distinct questions in it.</div>`;
    html += '<table><tr><th>week</th><th>score</th><th></th><th>verdict</th></tr>';
    Object.keys(byW).sort((a, b) => a - b).forEach(k => {
      const s = byW[k], p = Math.round(100 * s.r / s.t);
      const wk = EX_WEEKS.filter(x => x.w === Number(k))[0];
      const col = p >= 70 ? 'var(--accent-3)' : p >= 50 ? 'var(--accent)' : 'var(--accent-2)';
      html += `<tr><td><strong>${wk ? wk.label : 'week ' + k}</strong></td><td><code>${s.r}/${s.t}</code></td>
        <td><span style="display:inline-block; height:9px; border-radius:3px; background:${col}; width:${Math.max(3, p * 1.4).toFixed(0)}px;"></span> ${p}%</td>
        <td style="color:${col};">${p >= 70 ? 'solid' : p >= 50 ? 'shaky' : 'revise this'}</td></tr>`;
    });
    html += '</table>';
    const weak = Object.keys(byW).filter(k => byW[k].r / byW[k].t < 0.5);
    if (weak.length) {
      const names = weak.map(k => (EX_WEEKS.filter(x => x.w === Number(k))[0] || {}).label || k);
      html += `<div class="verdict bad" style="margin-top:12px;">Below half on ${names.join(', ')}. Re-run the paper with <strong>only those weeks ticked</strong> until they come up green.</div>`;
    } else if (n) {
      html += `<div class="verdict safe" style="margin-top:12px;">No week below 50%. Widen the selection or lengthen the paper.</div>`;
    }
    html += `<div class="ix-bar" style="margin-top:14px;">
      <button class="ix-btn" onclick="exToggleReveal()">${EX.reveal ? 'hide' : 'show'} every question</button>
      <button class="ix-btn" onclick="exRetryWrong()" ${right === n ? 'disabled' : ''}>retry the ${n - right} I got wrong</button>
      <button class="ix-btn" onclick="exRestart()">new paper</button></div>`;
    const list = EX.qs.map((q, i) => ({ q: q, a: EX.answers[i], i: i })).filter(o => EX.reveal || !o.a.ok);
    if (!list.length) html += '<div class="verdict safe">Everything correct.</div>';
    list.forEach(o => {
      const wk = EX_WEEKS.filter(x => x.w === o.q.week)[0];
      html += `<div class="kmstep" style="border-color:${o.a.ok ? 'var(--accent-3)' : 'var(--accent-2)'};">
        <h5>${o.a.ok ? '✓' : '✗'} &nbsp;Q${o.i + 1} · ${wk ? wk.label : o.q.gtopic}</h5>
        <div style="margin:0 0 10px 0;">${o.q.prompt}</div>
        <div style="font-family:'IBM Plex Mono',monospace; font-size:12.5px; margin-bottom:8px;">
          your answer: <strong style="color:${o.a.ok ? 'var(--accent-3)' : 'var(--accent-2)'};">${o.a.skipped ? 'skipped' : esc(String(o.a.given))}</strong>
          ${o.a.ok ? '' : `<br>correct: <strong style="color:var(--accent-3);">${esc(String(o.q.answer))}</strong>`}</div>
        <div style="font-size:13px;">${o.q.explain}</div></div>`;
    });
    out.innerHTML = html;
  }
  function runExam() { exRender(); }
  TOOL_RUNNERS.runExam = runExam;
  /* ---------- W1: quiz generators ---------- */
  (function () {
    const ROMANIA = `ARAD - A : 118\nARAD - B : 75\nARAD - D : 140\nB - C : 71\nD - C : 151\nD - E : 80\nD - F : 99\nA - I : 111\nI - L : 70\nL - M : 75\nM - H : 120\nH - E : 146\nH - G : 138\nE - G : 97\nG - BUCHAREST : 101\nF - BUCHAREST : 211`;
    const RH = { ARAD: 366, A: 329, B: 374, C: 380, D: 253, E: 193, F: 176, G: 100, H: 160, I: 244, L: 241, M: 242, BUCHAREST: 0 };
    const RG = sxParseGraph(ROMANIA).adj;
    const numCheck = (ans) => (v) => {
      const x = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
      if (isNaN(x)) return { ok: false, msg: 'Give a number.' };
      return { ok: Math.abs(x - ans) < 0.001 };
    };
    const textCheck = (ans) => (v) => ({ ok: qzNorm(v) === qzNorm(ans) });
    /* --- definitions --- */
    const DEFS = [
      { q: 'Which approach to AI does the <strong>Turing test</strong> test for?', a: 'Systems that act like humans',
        c: ['Systems that act like humans', 'Systems that think like humans', 'Systems that act rationally', 'Systems that think rationally'],
        e: 'The Turing test judges <em>behaviour only</em> (question and answer) against a human benchmark — so: act, like humans. The total Turing test adds physical behaviour.' },
      { q: 'What extra thing does the <strong>total</strong> Turing test involve?', a: 'A robot — physical behaviour',
        c: ['A robot — physical behaviour', 'A panel of judges instead of one', 'A time limit on answers', 'Testing the internal reasoning, not just the output'],
        e: 'The total Turing test asks whether a <strong>robot</strong>’s behaviour, including physical behaviour, is distinguishable from a human’s.' },
      { q: 'Which is the correct definition of a <strong>rational agent</strong>?', a: 'One that always takes the best action at a given point',
        c: ['One that always takes the best action at a given point', 'One that makes decisions without human input', 'One that makes a decision when given the opportunity', 'One whose behaviour is indistinguishable from a human’s'],
        e: 'Careful with the neighbours: <em>agent</em> = makes an intelligent decision when given the opportunity; <em>autonomous agent</em> = decides without human input; <em>rational agent</em> = always takes the <strong>best</strong> action.' },
      { q: 'Which is the correct definition of an <strong>autonomous agent</strong>?', a: 'One that makes decisions without human input',
        c: ['One that makes decisions without human input', 'One that always takes the best action', 'One that learns from data rather than a model', 'One that can perceive its whole environment'],
        e: 'Autonomy is about <strong>who supplies the decision</strong>, not about how good the decision is. Rationality is the separate property of always choosing the best action.' },
      { q: 'Explicit knowledge, an encoding of the world, and searching for strategies — which approach is this?', a: 'Model-based',
        c: ['Model-based', 'Data-driven', 'The Turing test', 'Value alignment'],
        e: 'Model-based = explicit knowledge = Symbolic / Classical AI: define an encoding, define how the world changes, then <strong>search</strong>. It "pretends to think" like a human. Data-driven = tacit knowledge = machine learning, which "pretends to learn".' },
      { q: 'Tacit knowledge, coarse data, and changing a model until it gives the right output — which approach is this?', a: 'Data-driven',
        c: ['Data-driven', 'Model-based', 'Symbolic AI', 'Classical AI'],
        e: 'Data-driven = tacit knowledge = machine learning. Note "symbolic AI" and "classical AI" are both other names for the <strong>model-based</strong> side.' },
      { q: 'The <strong>value alignment problem</strong> is about…', a: 'Aligning the system’s values with those of the humans it affects',
        c: ['Aligning the system’s values with those of the humans it affects', 'Making the heuristic agree with the true cost', 'Getting an agent to act autonomously', 'Making training data match test data'],
        e: 'It is the difficulty of <strong>exactly specifying</strong> what "good" means — a good recommendation, a good conversation. Look at the agent diagram: <em>goals</em> is one of the three things in the knowledge box, and a rational agent optimises exactly what you put there.' },
      { q: 'A search problem where an action does not always have the same effect is called…', a: 'stochastic',
        c: ['stochastic', 'dynamic', 'durative', 'partially observable'],
        e: 'Actions: instantaneous vs <strong>durative</strong> (takes time), deterministic vs <strong>stochastic</strong> (effect varies). Environment: fully vs <strong>partially observable</strong>, static vs <strong>dynamic</strong>.' },
      { q: 'An environment that changes while the agent is still deciding is called…', a: 'dynamic',
        c: ['dynamic', 'stochastic', 'partially observable', 'durative'],
        e: 'Static vs <strong>dynamic</strong> is about the <em>environment changing on its own</em>. Deterministic vs stochastic is about <em>an action’s effect</em>. Fully vs partially observable is about <em>how much the agent can see</em>.' },
      { q: 'In which year did Deep Blue beat Gary Kasparov?', a: '1997',
        c: ['1997', '1956', '2016', '1967'],
        e: '1950 Turing test · 1956 McCarthy’s definition · 1958 Simon predicts chess in 10 years · 1967 Minsky predicts AI solved in a generation · <strong>1997 Deep Blue</strong> · 2016 AlphaGo · 2017 AlphaZero · 2019 AlphaStar. Simon was 39 years out.' }
    ];
    DEFS.forEach(d => QZ_GEN.push({ topic: 'ai-intro', make: () => ({
      topic: 'intro · definitions', kind: 'choice', prompt: d.q, choices: d.c.slice(), answer: d.a,
      check: textCheck(d.a), explain: d.e }) }));
    /* --- f(n) identification --- */
    const FQ = [
      { f: 'f(n) = g(n)', a: 'Uniform-cost search' },
      { f: 'f(n) = h(n)', a: 'Greedy best-first search' },
      { f: 'f(n) = g(n) + h(n)', a: 'A*' },
      { f: 'f(n) = depth(n)', a: 'Breadth-first search' },
      { f: 'f(n) = −depth(n)', a: 'Depth-first search' }
    ];
    QZ_GEN.push({ topic: 'search', make: () => {
      const p = qzPick(FQ);
      return { topic: 'search · best-first', kind: 'choice',
        prompt: `Best-first search expands the frontier node with the lowest <code>f</code>. Which algorithm is <code>${p.f}</code>?`,
        choices: FQ.map(x => x.a).sort(() => Math.random() - 0.5), answer: p.a, check: textCheck(p.a),
        explain: 'All five algorithms are one algorithm with five values of <code>f</code>: BFS <code>depth</code>, DFS <code>−depth</code>, UCS <code>g</code>, greedy <code>h</code>, A* <code>g + h</code>.' };
    } });
    /* --- properties --- */
    const PROPS = [
      { q: 'Is <strong>BFS</strong> optimal?', a: 'Yes, but only if all action costs are equal', c: ['Yes, but only if all action costs are equal', 'Yes, always', 'No, never', 'Yes, but only if the heuristic is admissible'],
        e: 'BFS returns the plan with the <strong>fewest actions</strong>. That is the cheapest plan only when every action costs the same. On the map, BFS gives D→F→BUCHAREST at cost 310 while UCS gives 278.' },
      { q: 'Is <strong>DFS</strong> optimal?', a: 'No — it returns the left-most solution', c: ['No — it returns the left-most solution', 'Yes, always', 'Yes, if costs are equal', 'Yes, if redundant paths are prevented'],
        e: 'Preventing redundant paths makes DFS <strong>complete</strong>, not optimal. It still returns whichever solution its first deep dive happens to hit.' },
      { q: 'What is the <strong>space</strong> complexity of DFS?', a: 'b · m', c: ['b · m', 'b^m', 'b + b² + … + b^d', 'b^d'],
        e: 'DFS stores only the current branch and its siblings: <code>b·m</code>. Its <em>time</em> is <code>b^m</code>. BFS is <code>b + b² + … + b^d</code> for both — that memory cost is why DFS exists.' },
      { q: 'What is the <strong>time</strong> complexity of BFS?', a: 'b + b² + … + b^d', c: ['b + b² + … + b^d', 'b^m', 'b · m', 'b · d'],
        e: 'BFS explores complete depth slices, so time <em>and</em> space are <code>b + b² + … + b^d</code>, where <code>d</code> is the depth of the shallowest solution.' },
      { q: 'What is the time and space complexity of <strong>UCS</strong>?', a: 'Proportional to the number of nodes with cost less than the goal’s', c: ['Proportional to the number of nodes with cost less than the goal’s', 'b^m', 'b · m', 'Proportional to the number of nodes at the goal’s depth'],
        e: 'UCS works in <strong>cost contours</strong>, not depth slices: it expands everything cheaper than the optimal goal before stopping.' },
      { q: 'Two fixes stop redundant paths making a search tree infinite. One is tracking visited states. What is the other?', a: 'Check the path back to the root', c: ['Check the path back to the root', 'Limit the depth of the tree', 'Use a priority queue', 'Use an admissible heuristic'],
        e: 'Checking the parents up to the root kills cycles <em>on the current branch</em> cheaply; a visited/reached set is stronger but costs memory.' }
    ];
    PROPS.forEach(d => QZ_GEN.push({ topic: 'search', make: () => ({
      topic: 'search · properties', kind: 'choice', prompt: d.q, choices: d.c.slice(), answer: d.a,
      check: textCheck(d.a), explain: d.e }) }));
    /* --- computed: f-value on the Romania map --- */
    QZ_GEN.push({ topic: 'astar', make: () => {
      const opts = [
        { n: 'A', g: 118 }, { n: 'B', g: 75 }, { n: 'D', g: 140 },
        { n: 'E', g: 220 }, { n: 'F', g: 239 }, { n: 'C', g: 291 }, { n: 'G', g: 317 }, { n: 'H', g: 366 }
      ];
      const p = qzPick(opts), ans = p.g + RH[p.n];
      return { topic: 'A* · compute f', prompt:
        `On the Romania map, node <strong>${p.n}</strong> is reached with <code>g = ${p.g}</code> and its straight-line heuristic is <code>h = ${RH[p.n]}</code>.<br><br>What is <code>f(${p.n})</code> under <strong>A*</strong>?`,
        placeholder: 'a number', answer: String(ans), check: numCheck(ans),
        explain: `<code>f(n) = g(n) + h(n) = ${p.g} + ${RH[p.n]} = <strong>${ans}</strong></code>. Read it as: "if the answer goes through ${p.n}, the whole trip would cost about ${ans}."` };
    } });
    /* --- computed: run a search on a random pair --- */
    QZ_GEN.push({ topic: 'astar', make: () => {
      const alg = qzPick(['ucs', 'astar', 'greedy', 'bfs']);
      const starts = ['ARAD', 'D', 'A', 'B', 'I'];
      const s = qzPick(starts), R = sxSearch(RG, RH, s, 'BUCHAREST', alg, 2000);
      if (!R.found) throw new Error('retry');
      const ask = qzPick(['cost', 'actions']);
      const ans = ask === 'cost' ? R.cost : R.actions;
      const optimal = sxSearch(RG, RH, s, 'BUCHAREST', 'ucs', 2000);
      let note = '';
      if (alg === 'greedy' && R.cost > optimal.cost) note = ` Greedy is not optimal — the cheapest route costs <strong>${optimal.cost}</strong>.`;
      if (alg === 'bfs' && R.cost > optimal.cost) note = ` BFS minimises actions, not cost — the cheapest route costs <strong>${optimal.cost}</strong>.`;
      if (alg === 'astar') note = ' A* with an admissible heuristic is optimal, so this matches UCS.';
      return { topic: 'search · run it', prompt:
        `Run <strong>${SX_ALG_NAME[alg]}</strong> (<code>${SX_ALG_F[alg]}</code>) on the Romania map in the Search explorer, from <strong>${s}</strong> to <strong>BUCHAREST</strong>.<br><br>What is the <strong>total ${ask === 'cost' ? 'cost' : 'number of actions'}</strong> of the path it returns?`,
        placeholder: 'a number', answer: String(ans), check: numCheck(ans),
        explain: `It returns <code>${sxPath(R.path)}</code> — cost <strong>${R.cost}</strong>, <strong>${R.actions}</strong> action(s), expanding ${R.expansions} nodes.${note}` };
    } });
    /* --- admissibility --- */
    QZ_GEN.push({ topic: 'astar', make: () => {
      const dist = adTrueCosts(RG, 'BUCHAREST');
      const n = qzPick(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'M']);
      const t = dist[n];
      const over = Math.random() < 0.5;
      const h = over ? Math.round(t + qzInt(10, 60)) : Math.round(t - qzInt(5, 60));
      const ans = over ? 'No — it over-estimates' : 'Yes — it under-estimates';
      return { topic: 'A* · admissibility', kind: 'choice', prompt:
        `Someone proposes <code>h(${n}) = ${h}</code>. The true cheapest cost from <strong>${n}</strong> to BUCHAREST is <strong>${t}</strong>.<br><br>Is this value admissible?`,
        choices: ['Yes — it under-estimates', 'No — it over-estimates'], answer: ans, check: textCheck(ans),
        explain: `Admissible means <strong>never over-estimates</strong>: actual cost ≥ h(n). Here actual = ${t} and h = ${h}, so it ${over ? '<strong>fails</strong> — A* may now leave the right node on the frontier and return a worse route' : 'is fine. The closer it gets to ' + t + ' without passing it, the more <em>informative</em> it is'}.` };
    } });
    const ADEFS = [
      { q: 'Why is <strong><code>h ≡ 0</code></strong> a bad heuristic, even though it is admissible?', a: 'A* degenerates into UCS', c: ['A* degenerates into UCS', 'It over-estimates', 'A* becomes greedy best-first', 'A* stops being complete'],
        e: 'With <code>h = 0</code>, <code>f = g + 0 = g</code> — which is exactly the UCS row of the best-first table. Admissible but carrying no information. The challenge is admissible <strong>and</strong> informative.' },
      { q: 'How do you obtain an admissible heuristic?', a: 'By relaxing the constraints of the problem', c: ['By relaxing the constraints of the problem', 'By running UCS first', 'By adding the action costs so far', 'By taking the average of all path costs'],
        e: 'Removing a constraint can only make the problem cheaper, so a relaxed solution can never over-estimate. Straight-line distance is "roads removed"; misplaced-tile count is "the sliding rule removed".' },
      { q: 'When does A* stop?', a: 'When it expands the goal', c: ['When it expands the goal', 'When it generates the goal', 'When the frontier is empty', 'When f stops decreasing'],
        e: 'This is the classic mistake. On the map, BUCHAREST is <em>generated</em> via F with <code>f = 450</code> — but 450 is not the smallest <code>f</code>, so A* keeps going and later expands the goal at <strong>418</strong>. Stopping at generation would give the greedy answer.' },
      { q: 'Greedy best-first returns ARAD → D → F → BUCHAREST. What does it cost, and is it optimal?', a: '450 — not optimal', c: ['450 — not optimal', '418 — optimal', '450 — optimal', '418 — not optimal'],
        e: '140 + 99 + 211 = <strong>450</strong>. The optimal route ARAD → D → E → G → BUCHAREST costs <strong>418</strong>. Greedy ignores <code>g</code>, so it walked into F because F merely <em>looked</em> close (h = 176).' }
    ];
    ADEFS.forEach(d => QZ_GEN.push({ topic: 'astar', make: () => ({
      topic: 'A* · concepts', kind: 'choice', prompt: d.q, choices: d.c.slice(), answer: d.a,
      check: textCheck(d.a), explain: d.e }) }));
