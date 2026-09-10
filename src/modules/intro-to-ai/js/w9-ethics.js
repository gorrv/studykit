  /* ============================================================
     W9 · AI ETHICS
       harm taxonomy · bias causes · fairness objectives · principles
     ============================================================ */
  function etN(v, dp) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    const d = dp === undefined ? 2 : dp;
    const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
    return r.toFixed(d);
  }
  /* a small seeded shuffle so drills are reproducible per draw */
  function etRnd(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s + 0x9E3779B9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x21F0AAAD) >>> 0;
      z = Math.imul(z ^ (z >>> 15), 0x735A2D97) >>> 0;
      return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------
     TOOL · the harm taxonomy, browsable and drillable  (runHarm)
     ------------------------------------------------------------ */
  const HARMS = [
    { k: 'agency', n: 'Human agency', ic: '🕹', sub: [
        'Loss of human control over algorithms',
        'Loss of the human right to contest decisions',
        'Over-delegation',
        'Loss of critical thinking'] },
    { k: 'account', n: 'Accountability', ic: '⚖', sub: [
        'Loss of human accountability for harm',
        'Incorrect blaming of humans for AI failures (e.g. warehouse workers blamed for robot mistakes)'] },
    { k: 'safety', n: 'Safety and wellbeing', ic: '⛑', sub: [
        'Physical safety',
        'Abuse and tech-facilitated violence',
        'Health',
        'Wellbeing'] },
    { k: 'privacy', n: 'Privacy invasion', ic: '🔒', sub: [
        'Privacy in intimate spaces',
        'Privacy at work &amp; school',
        'Privacy in public spaces'] },
    { k: 'fair', n: 'Fairness and dignity', ic: '⚖', sub: [
        '<strong>Allocative / distributional</strong> — distribution of opportunities · of resources · of quality-of-service',
        '<strong>Representational</strong> — stereotyping · demeaning (cast as less deserving of respect) · erasing · alienating (cast as not belonging) · loss of the opportunity to self-identify · essentialist social categories'] },
    { k: 'social', n: 'Societal', ic: '🏛', sub: [
        'Information', 'Cultural', 'Civic and political', 'Social relationships', 'Deskilling'] },
    { k: 'env', n: 'Environmental', ic: '🌍', sub: [
        'Energy consumption and pollution',
        'Mineral mining for datacentres',
        'AI and robots for the oil &amp; gas industry'] }
  ];
  const HARM_CASES = [
    { q: 'A bank refuses a loan and cannot tell the applicant why, and there is no route to appeal the decision.', a: 'agency',
      e: 'The <strong>loss of the human right to contest decisions</strong> is listed under human agency. It is tempting to file this under fairness — but nothing here says the decision was <em>discriminatory</em>, only that it was unchallengeable.' },
    { q: 'A hospital consultant stops double-checking a diagnostic model because it is usually right.', a: 'agency',
      e: '<strong>Over-delegation</strong>, and in time <strong>loss of critical thinking</strong> — both human-agency harms. The system may be perfectly accurate and this harm still occurs.' },
    { q: 'Warehouse staff are disciplined for picking errors that were actually caused by the sorting robot.', a: 'account',
      e: 'A standard example: <strong>incorrect blaming of humans for AI failures</strong>. An accountability harm — responsibility has been misassigned, not merely lost.' },
    { q: 'After an autonomous vehicle collision, no person or organisation can be held answerable for the decision the system made.', a: 'account',
      e: '<strong>Loss of human accountability for harm.</strong> Note the contrast with the previous case: here accountability evaporates, there it lands on the wrong person. Both are accountability harms.' },
    { q: 'A warehouse robot arm injures a worker who stepped into its path.', a: 'safety',
      e: '<strong>Physical safety</strong>, the first item under safety and wellbeing.' },
    { q: 'A messaging app\'s AI features are used by an abusive partner to track and harass someone.', a: 'safety',
      e: '<strong>Abuse and tech-facilitated violence</strong> — listed under safety and wellbeing, not under privacy, because the harm is the abuse the tool enables.' },
    { q: 'A recommender keeps serving self-harm content to a teenager because it maximises engagement.', a: 'safety',
      e: '<strong>Health</strong> and <strong>wellbeing</strong> both sit under safety and wellbeing. (The societal category covers effects on <em>information and social relationships at large</em>, not harm to an individual\'s health.)' },
    { q: 'A smart speaker records conversations inside people\'s bedrooms.', a: 'privacy',
      e: '<strong>Privacy in intimate spaces</strong> — the first of the three privacy settings.' },
    { q: 'Software monitors employees\' keystrokes and webcams to score their productivity.', a: 'privacy',
      e: '<strong>Privacy at work &amp; school.</strong> Privacy splits by <em>setting</em> — intimate spaces, work and school, public spaces — so name the setting in an answer.' },
    { q: 'City-wide camera networks with face recognition track everyone who walks through the centre.', a: 'privacy',
      e: '<strong>Privacy in public spaces.</strong> Note that if the same system misidentifies minorities at a higher rate, you would <em>also</em> have a fairness harm — real cases usually span several categories.' },
    { q: 'A CV-screening model shortlists fewer women for engineering roles.', a: 'fair',
      e: '<strong>Allocative / distributional</strong> — specifically the <strong>distribution of opportunities</strong>. Allocative harms are about who gets things; representational harms are about how people are portrayed.' },
    { q: 'Speech recognition works noticeably worse for speakers with regional accents.', a: 'fair',
      e: 'Allocative, under <strong>distribution of quality-of-service</strong>. The service is offered to everyone, but not at the same standard — that is the quality-of-service sub-type.' },
    { q: 'An image generator asked for "a nurse" returns only women and asked for "a CEO" returns only men.', a: 'fair',
      e: '<strong>Representational — stereotyping.</strong> Nobody is denied a resource; the harm is in the depiction. The GPT-3 and DALL·E examples are exactly this.' },
    { q: 'A translation system has no support at all for a widely spoken minority language.', a: 'fair',
      e: '<strong>Representational — erasing.</strong> Also arguably allocative (quality-of-service), but the primary listed harm for absence-from-the-system is erasure.' },
    { q: 'A form forces users to pick "male" or "female" with no other option.', a: 'fair',
      e: '<strong>Loss of the opportunity to self-identify</strong>, and <strong>essentialist social categories</strong> — both representational sub-types, and both directly relevant to phrenology.' },
    { q: 'Recommendation feeds push users into increasingly polarised political bubbles.', a: 'social',
      e: '<strong>Civic and political</strong>, and <strong>information</strong> — societal harms. These are harms to the public sphere rather than to one identifiable person.' },
    { q: 'Junior radiologists never develop the skill of reading scans unaided, because the model does it first.', a: 'social',
      e: '<strong>Deskilling</strong>, a societal harm. Distinguish it from over-delegation (human agency): over-delegation is about a decision being handed over now, deskilling is about the capability being lost across a profession.' },
    { q: 'Generated content in a dominant style crowds out a region\'s own musical traditions.', a: 'social',
      e: '<strong>Cultural</strong> harm, under societal.' },
    { q: 'People increasingly substitute chatbot conversation for contact with friends and family.', a: 'social',
      e: '<strong>Social relationships</strong> — a societal harm.' },
    { q: 'Training a large model consumes as much electricity as hundreds of homes use in a year.', a: 'env',
      e: '<strong>Energy consumption and pollution.</strong>' },
    { q: 'Cobalt and lithium extraction expands to supply hardware for new datacentres.', a: 'env',
      e: '<strong>Mineral mining for datacentres</strong> — this is listed separately from energy use, so it is worth naming on its own.' },
    { q: 'Machine learning is used to locate new oil reserves more efficiently.', a: 'env',
      e: '<strong>AI and robots for the oil &amp; gas industry</strong> — the third environmental item, and the one people forget. The harm is not the model\'s own footprint but what it is used to accelerate.' }
  ];
  const HM = { mode: 'map', open: '', cur: null, given: '', score: { r: 0, t: 0 }, seed: 11, seen: [] };
  function hmMode(m) { HM.mode = m; HM.cur = null; HM.given = ''; hmRender(); }
  function hmOpen(k) { HM.open = (HM.open === k ? '' : k); hmRender(); }
  function hmNew() {
    if (HM.seen.length >= HARM_CASES.length) HM.seen = [];
    const rnd = etRnd(HM.seed++);
    let i, guard = 0;
    do { i = Math.floor(rnd() * HARM_CASES.length) % HARM_CASES.length; } while (HM.seen.indexOf(i) >= 0 && guard++ < 60);
    HM.seen.push(i);
    HM.cur = i; HM.given = '';
    hmRender();
  }
  function hmAnswer(k) {
    if (HM.cur === null || HM.given) return;
    HM.given = k;
    HM.score.t++;
    if (k === HARM_CASES[HM.cur].a) HM.score.r++;
    hmRender();
  }
  function hmResetScore() { HM.score = { r: 0, t: 0 }; HM.seen = []; hmRender(); }
  function hmRender() {
    const out = document.getElementById('hm-output');
    if (!out) return;
    let html = `<div class="ix-bar"><span class="ix-seg">
      <button class="${HM.mode === 'map' ? 'on' : ''}" onclick="hmMode('map')">the seven harms</button>
      <button class="${HM.mode === 'drill' ? 'on' : ''}" onclick="hmMode('drill')">★ classify a case</button></span>`;
    if (HM.mode === 'drill') {
      const pct = HM.score.t ? Math.round(100 * HM.score.r / HM.score.t) : 0;
      html += `<span class="stat-pill dark">score ${HM.score.r} / ${HM.score.t}</span>`;
      if (HM.score.t) html += `<span class="stat-pill ${pct >= 70 ? 'b' : pct >= 40 ? 'a' : 'c'}">${pct}%</span>`;
      html += `<button class="ix-btn" onclick="hmNew()">${HM.cur === null ? 'start ▶' : 'next case ▶'}</button>
        <button class="ix-btn" onclick="hmResetScore()">reset score</button>`;
    }
    html += '</div>';
    if (HM.mode === 'map') {
      html += '<div class="concept-grid" style="margin-top:14px;">';
      HARMS.forEach(h => {
        const on = HM.open === h.k;
        html += `<div class="concept-card" style="cursor:pointer; ${on ? 'border-color:var(--accent);' : ''}" onclick="hmOpen('${h.k}')">
          <h4 style="margin:0 0 6px 0;">${h.ic} &nbsp;${h.n} harms</h4>
          <div style="font-size:11.5px; color:var(--ink-muted); font-family:'IBM Plex Mono',monospace;">${h.sub.length} listed ${on ? '▾' : '▸'}</div>`;
        if (on) html += '<ul style="margin:10px 0 0 0; font-size:13px; line-height:1.7;">' + h.sub.map(s => `<li>${s}</li>`).join('') + '</ul>';
        html += '</div>';
      });
      html += '</div>';
      html += `<p class="ix-hint">These seven are the standard list, in the standard order — <strong>“human agency, accountability, safety and wellbeing, privacy, fairness and dignity, societal, environmental”</strong>.
        A question asking you to name the harms of a system wants you to work down this list; a question about one harm wants the <em>sub-type</em>, which is where the detail marks are. Click any card to open it.</p>`;
    } else {
      if (HM.cur === null) {
        html += `<div class="quiz-prompt" style="margin-top:14px;">Press <strong>start</strong> and a short scenario appears. Pick the harm category it belongs under. ${HARM_CASES.length} cases, each with the reasoning spelled out — including the ones that span two categories.</div>`;
      } else {
        const c = HARM_CASES[HM.cur];
        html += `<div class="quiz-prompt" style="margin-top:14px;"><div class="qp-topic">classify this harm</div>${c.q}</div>`;
        html += '<div class="quiz-choices">';
        HARMS.forEach(h => {
          let cls = 'quiz-choice';
          if (HM.given) {
            if (h.k === c.a) cls += ' right';
            else if (h.k === HM.given) cls += ' wrong';
          }
          html += `<button class="${cls}" onclick="hmAnswer('${h.k}')">${h.ic} ${h.n}</button>`;
        });
        html += '</div>';
        if (HM.given) {
          const right = HM.given === c.a;
          const nm = HARMS.filter(h => h.k === c.a)[0].n;
          html += `<div class="verdict ${right ? 'safe' : 'bad'} quiz-fb">${right ? '✓ <strong>Correct.</strong>' : `✗ This is filed under <strong>${nm}</strong>.`} ${c.e}</div>`;
          html += `<div class="tool-controls" style="margin-top:10px;"><button class="tool-btn green" onclick="hmNew()">Next case ▶</button></div>`;
        }
      }
    }
    out.innerHTML = html;
  }
  function runHarm() { hmRender(); }
  TOOL_RUNNERS.runHarm = runHarm;

  /* ------------------------------------------------------------
     TOOL · where bias enters the pipeline  (runBias)
     ------------------------------------------------------------ */
  const BIAS = [
    { k: 'world', n: 'World bias', stage: 'the world', dev: false,
      d: 'World distribution problem.',
      long: 'The inequality is already out there in the world, and the data faithfully records it. A hiring model trained on a profession that has historically been 90% men learns that pattern because it is true of the record.',
      fix: 'Cannot be fixed by better data collection alone — the data is not wrong. Needs a fairness objective, reweighting, or a decision not to use historical outcomes as the label at all.' },
    { k: 'repr', n: 'Representation bias', stage: 'data collection', dev: true,
      d: 'Data collection problem.',
      long: 'Some groups are under-sampled relative to the population you will deploy on. The Gender Shades result is the canonical case: benchmark face sets dominated by lighter-skinned faces, and error rates on the darkest skin types over 40% for two of the three systems tested.',
      fix: 'Dataset curation, participatory design, resampling, reweighting.' },
    { k: 'meas', n: 'Measurement bias', stage: 'measurement', dev: true,
      d: 'Wrong categorization of people, or wrong measurements.',
      long: 'The quantity you recorded is not the quantity you care about. Using <em>re-arrest</em> as a stand-in for <em>reoffending</em> imports whatever bias exists in who gets arrested. Forcing people into categories they do not belong to — phrenology — is the other half of this.',
      fix: 'Interrogate the label. Ask whether the category is even observable, or whether only the subject can say.' },
    { k: 'algo', n: 'Algorithm bias', stage: 'the algorithm', dev: true,
      d: 'Wrong choice of algorithm.',
      long: 'The model or objective itself creates or amplifies the disparity, even on adequate data — for example an objective that maximises average accuracy and is therefore happy to sacrifice a small group.',
      fix: 'Change the objective — the <em>fairness functions</em> idea: maximise the minimum accuracy rather than the average.' },
    { k: 'eval', n: 'Evaluation bias', stage: 'evaluation', dev: true,
      d: 'Wrong choice of evaluation metric or test set.',
      long: 'The model is fine but your measurement of it is not. A single overall accuracy number on a test set with the same skew as the training set will report success while the system fails for a minority group — Topic 05\'s accuracy trap, arriving as an ethics problem.',
      fix: 'Disaggregate every metric by group; choose test sets that over-represent the groups you are worried about.' }
  ];
  const BIAS_OBV = [
    { n: 'Ethics board does not flag a problem', dev: false },
    { n: 'Developer doesn\'t oppose building it, doesn\'t report, doesn\'t blow the whistle', dev: true },
    { n: 'Management makes the decision to deploy', dev: false }
  ];
  const BIAS_CASES = [
    { q: 'A face dataset contains 80% lighter-skinned faces because it was scraped from Western news photos.', a: 'repr',
      e: 'A <strong>data collection</strong> problem — the sample does not match the deployment population. Marked <strong>developer\'s fault</strong>.' },
    { q: 'A recidivism model predicts re-arrest, and uses that as its definition of "reoffending".', a: 'meas',
      e: '<strong>Measurement bias</strong> — wrong measurement. Re-arrest is a measurement of <em>policing</em> as much as of offending, which is precisely how the COMPAS-style disparity arises.' },
    { q: 'A model is tuned to maximise overall accuracy, and reaches it by performing badly on a group that is 3% of the data.', a: 'algo',
      e: '<strong>Algorithm bias</strong> — the wrong choice of algorithm/objective. The remedy is a <strong>fairness function</strong>: maximise the minimum accuracy instead.' },
    { q: 'A team reports a single accuracy figure on a test set drawn the same way as the training set.', a: 'eval',
      e: '<strong>Evaluation bias</strong> — wrong choice of metric and test set. Note how close this sits to algorithm bias: here the model might be fine and only the <em>measurement of it</em> is broken.' },
    { q: 'Historical promotion records show few women in senior roles, and the model reproduces that pattern.', a: 'world',
      e: '<strong>World bias</strong> — the world distribution problem. The only cause <em>not</em> marked as the developer\'s fault, because the data is an accurate record. That does not make deploying it acceptable.' },
    { q: 'A system asks annotators to label people\'s sexuality from photographs.', a: 'meas',
      e: '<strong>Measurement bias</strong> — wrong categorization of people. The phrenology point: these are <strong>social constructs / unobservable</strong>, and <strong>only the subjects can say</strong>. There is no correct measurement to be made.' },
    { q: 'A pedestrian detector is trained mostly on adult pedestrians and misses children more often.', a: 'repr',
      e: '<strong>Representation bias.</strong> This is the Brandao (2019) pedestrian-detection result — age and gender disparities in miss rates.' },
    { q: 'A model scores well on the benchmark everyone uses, and the benchmark contains almost no examples from the deployment country.', a: 'eval',
      e: '<strong>Evaluation bias</strong> — the test set is the wrong test set. If the <em>training</em> set had the same skew you would also have representation bias; the two often travel together.' }
  ];
  const BI = { mode: 'pipe', sel: 'repr', cur: null, given: '', score: { r: 0, t: 0 }, seed: 5, seen: [] };
  function biMode(m) { BI.mode = m; BI.cur = null; BI.given = ''; biRender(); }
  function biPick(k) { BI.sel = k; biRender(); }
  function biNew() {
    if (BI.seen.length >= BIAS_CASES.length) BI.seen = [];
    const rnd = etRnd(BI.seed++);
    let i, guard = 0;
    do { i = Math.floor(rnd() * BIAS_CASES.length) % BIAS_CASES.length; } while (BI.seen.indexOf(i) >= 0 && guard++ < 60);
    BI.seen.push(i); BI.cur = i; BI.given = '';
    biRender();
  }
  function biAnswer(k) {
    if (BI.cur === null || BI.given) return;
    BI.given = k; BI.score.t++;
    if (k === BIAS_CASES[BI.cur].a) BI.score.r++;
    biRender();
  }
  function biResetScore() { BI.score = { r: 0, t: 0 }; BI.seen = []; biRender(); }
  function biRender() {
    const out = document.getElementById('bi-output');
    if (!out) return;
    let html = `<div class="ix-bar"><span class="ix-seg">
      <button class="${BI.mode === 'pipe' ? 'on' : ''}" onclick="biMode('pipe')">the pipeline</button>
      <button class="${BI.mode === 'drill' ? 'on' : ''}" onclick="biMode('drill')">★ diagnose a case</button></span>`;
    if (BI.mode === 'drill') {
      const pct = BI.score.t ? Math.round(100 * BI.score.r / BI.score.t) : 0;
      html += `<span class="stat-pill dark">score ${BI.score.r} / ${BI.score.t}</span>`;
      if (BI.score.t) html += `<span class="stat-pill ${pct >= 70 ? 'b' : pct >= 40 ? 'a' : 'c'}">${pct}%</span>`;
      html += `<button class="ix-btn" onclick="biNew()">${BI.cur === null ? 'start ▶' : 'next case ▶'}</button>
        <button class="ix-btn" onclick="biResetScore()">reset score</button>`;
    }
    html += '</div>';
    if (BI.mode === 'pipe') {
      const W = 640, H = 150, bw = 112, gap = 16, y = 40;
      let g = '';
      BIAS.forEach((b, i) => {
        const x = 10 + i * (bw + gap), on = BI.sel === b.k;
        if (i) g += `<path d="M ${x - gap + 2} ${y + 26} L ${x - 3} ${y + 26}" stroke="var(--ink-muted)" stroke-width="1.6" marker-end="url(#biarrow)"/>`;
        g += `<rect class="hit" onclick="biPick('${b.k}')" x="${x}" y="${y}" width="${bw}" height="52" rx="9"
          fill="${on ? 'var(--tint-a)' : 'var(--surface-2)'}" stroke="${on ? 'var(--accent)' : 'var(--rule)'}" stroke-width="${on ? 2.4 : 1.3}"/>`;
        g += `<text x="${x + bw / 2}" y="${y + 21}" text-anchor="middle" pointer-events="none" font-family="IBM Plex Mono" font-size="10.5" font-weight="600" fill="${on ? 'var(--accent)' : 'var(--ink)'}">${b.n.split(' ')[0]}</text>`;
        g += `<text x="${x + bw / 2}" y="${y + 35}" text-anchor="middle" pointer-events="none" font-family="IBM Plex Mono" font-size="9" fill="var(--ink-muted)">bias</text>`;
        g += `<text x="${x + bw / 2}" y="${y + 46}" text-anchor="middle" pointer-events="none" font-family="IBM Plex Mono" font-size="8.5" fill="${b.dev ? 'var(--accent-2)' : 'var(--accent-3)'}">${b.dev ? '★ developer' : 'not developer'}</text>`;
        g += `<text x="${x + bw / 2}" y="${y - 8}" text-anchor="middle" pointer-events="none" font-family="IBM Plex Sans" font-size="9.5" fill="var(--ink-muted)">${b.stage}</text>`;
      });
      g += `<text x="10" y="${y + 86}" font-family="IBM Plex Sans" font-size="10.5" fill="var(--ink-muted)">bias can enter at any stage — and four of the five are marked ★ the developer's fault</text>`;
      html += `<div class="ix-canvas" style="overflow-x:auto;"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg" style="min-width:100%;">
        <title>Where bias enters</title><desc>Five stages from the world through data collection, measurement, the algorithm and evaluation, each with its named bias.</desc>
        <defs><marker id="biarrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="var(--ink-muted)"/></marker></defs>${g}</svg></div>`;
      const b = BIAS.filter(x => x.k === BI.sel)[0];
      html += `<div class="kmstep"><h5>${b.n} &nbsp;·&nbsp; ${b.d}</h5>
        <p style="margin:0 0 10px 0;">${b.long}</p>
        <div class="verdict ${b.dev ? 'warn' : 'safe'}" style="margin:0 0 10px 0;">${b.dev
          ? '<strong>★ Marked the developer\'s fault</strong> in the causes list.'
          : '<strong>Not marked the developer\'s fault</strong> — the data is an accurate record of an unequal world. It is the only one of the five without the marker, and that is an easy exam question.'}</div>
        <p style="margin:0;"><strong>Typical mitigation:</strong> ${b.fix}</p></div>`;
      html += '<table style="margin-top:14px;"><tr><th>cause</th><th>description</th><th>developer\'s fault?</th></tr>'
        + BIAS.map(x => `<tr><td><strong>${x.n}</strong></td><td>${x.d}</td><td>${x.dev ? '<strong style="color:var(--accent-2);">★ yes</strong>' : '<span style="color:var(--accent-3);">no</span>'}</td></tr>`).join('')
        + '</table>';
      html += `<p class="ix-hint">The five above are the branch where <strong>the risk was not anticipated, tested, or alleviated</strong>. There is a second branch — <strong>the risk is obvious and the task itself is problematic</strong> — with three failures, only one of them the developer's:</p>`;
      html += '<table>' + BIAS_OBV.map(x => `<tr><td>${x.n}</td><td>${x.dev ? '<strong style="color:var(--accent-2);">★ developer\'s fault</strong>' : '<span style="color:var(--ink-muted);">—</span>'}</td></tr>`).join('') + '</table>';
    } else {
      if (BI.cur === null) {
        html += `<div class="quiz-prompt" style="margin-top:14px;">Press <strong>start</strong>. Each case describes something that went wrong; name the cause. ${BIAS_CASES.length} cases.</div>`;
      } else {
        const c = BIAS_CASES[BI.cur];
        html += `<div class="quiz-prompt" style="margin-top:14px;"><div class="qp-topic">which cause of discrimination?</div>${c.q}</div>`;
        html += '<div class="quiz-choices">';
        BIAS.forEach(b => {
          let cls = 'quiz-choice';
          if (BI.given) {
            if (b.k === c.a) cls += ' right';
            else if (b.k === BI.given) cls += ' wrong';
          }
          html += `<button class="${cls}" onclick="biAnswer('${b.k}')">${b.n}</button>`;
        });
        html += '</div>';
        if (BI.given) {
          const right = BI.given === c.a;
          const b = BIAS.filter(x => x.k === c.a)[0];
          html += `<div class="verdict ${right ? 'safe' : 'bad'} quiz-fb">${right ? '✓ <strong>Correct.</strong>' : `✗ This one is <strong>${b.n}</strong>.`} ${c.e}</div>`;
          html += `<div class="tool-controls" style="margin-top:10px;"><button class="tool-btn green" onclick="biNew()">Next case ▶</button></div>`;
        }
      }
    }
    out.innerHTML = html;
  }
  function runBias() { biRender(); }
  TOOL_RUNNERS.runBias = runBias;

  /* ------------------------------------------------------------
     TOOL · fairness objectives  (runFair)
     ------------------------------------------------------------ */
  const FR = { groups: [], models: [], err: '' };
  function frParse(text) {
    const lines = String(text).split(/\n+/).map(s => s.trim()).filter(s => s.length && s.charAt(0) !== '#');
    if (lines.length < 2) return { err: 'Give a header line and at least one model row.' };
    const split = s => (s.indexOf(',') >= 0 ? s.split(',') : s.split(/\t+|\s{2,}/)).map(t => t.trim()).filter(t => t.length);
    const head = split(lines[0]);
    if (head.length < 2) return { err: 'The header needs a label and at least one group name.' };
    const groups = head.slice(1).map(g => {
      const m = g.match(/^(.*?)\s*\(\s*n\s*=\s*([0-9.]+)\s*\)\s*$/i);
      return m ? { name: m[1].trim(), n: Number(m[2]) } : { name: g, n: 1 };
    });
    if (groups.length > 10) return { err: 'Ten groups at most.' };
    const models = [];
    for (let i = 1; i < lines.length; i++) {
      const b = split(lines[i]);
      if (b.length !== groups.length + 1) return { err: `Row ${i} has ${b.length - 1} value${b.length === 2 ? '' : 's'} but there are ${groups.length} groups: “${esc(lines[i])}”` };
      const acc = b.slice(1).map(Number);
      if (acc.some(v => !isFinite(v))) return { err: `Row ${i} contains something that is not a number: “${esc(lines[i])}”` };
      if (acc.some(v => v < 0 || v > 100)) return { err: `Row ${i}: accuracies are percentages, so they must sit between 0 and 100.` };
      models.push({ name: b[0], acc: acc });
    }
    if (models.length > 8) return { err: 'Eight models at most.' };
    return { groups: groups, models: models };
  }
  function frStats(m, groups) {
    const N = groups.reduce((a, g) => a + g.n, 0);
    let w = 0;
    m.acc.forEach((a, i) => { w += a * groups[i].n; });
    const weighted = N ? w / N : 0;
    const macro = m.acc.reduce((a, b) => a + b, 0) / m.acc.length;
    const min = Math.min.apply(null, m.acc), max = Math.max.apply(null, m.acc);
    return { weighted: weighted, macro: macro, min: min, max: max, gap: max - min, worst: m.acc.indexOf(min) };
  }
  function frLoad(which) {
    const el = document.getElementById('fr-data');
    if (!el) return;
    if (which === 'gs') el.value = 'system, Type I, Type II, Type III, Type IV, Type V, Type VI\nMicrosoft, 98.3, 98.9, 96.7, 100, 76.8, 75.0\nFace++, 88.1, 90.3, 91.8, 86.1, 67.6, 53.5\nIBM, 94.9, 92.6, 91.8, 91.7, 66.7, 53.2';
    else if (which === 'conflict') el.value = 'model, majority (n=970), minority (n=30)\nA — high average, 96, 55\nB — best for the worst-off, 90, 88\nC — equally mediocre, 70, 70';
    else if (which === 'trap') el.value = 'model, group A (n=9500), group B (n=500)\nbaseline, 90, 90\ntuned for accuracy, 95, 40';
    runFair();
  }
  function frRender() {
    const out = document.getElementById('fr-output');
    if (!out) return;
    if (FR.err) { out.innerHTML = `<div class="tool-error">${FR.err}</div>`; return; }
    const G = FR.groups, M = FR.models;
    const st = M.map(m => frStats(m, G));
    const pick = key => {
      let bi = 0;
      st.forEach((s, i) => {
        if (key === 'gap') { if (s.gap < st[bi].gap - 1e-9) bi = i; }
        else if (s[key] > st[bi][key] + 1e-9) bi = i;
      });
      return bi;
    };
    const bW = pick('weighted'), bM = pick('macro'), bMin = pick('min'), bGap = pick('gap');
    /* per-group bar chart */
    const W = 520, H = 60 + M.length * (G.length * 13 + 26), L = 128;
    let g = '', y = 22;
    g += `<text x="8" y="12" font-family="IBM Plex Sans" font-size="10" fill="var(--ink-muted)">accuracy per group (%) — the red bar is each model's worst group</text>`;
    M.forEach((m, mi) => {
      g += `<text x="8" y="${y + 8}" font-family="IBM Plex Mono" font-size="10.5" font-weight="600" fill="var(--ink)">${esc(m.name).slice(0, 20)}</text>`;
      m.acc.forEach((a, gi) => {
        const yy = y + gi * 13;
        const w = Math.max(1, (a / 100) * (W - L - 46));
        const worst = gi === st[mi].worst && st[mi].gap > 0;
        g += `<text x="${L - 6}" y="${yy + 7}" text-anchor="end" font-family="IBM Plex Mono" font-size="8.5" fill="var(--ink-muted)">${esc(G[gi].name).slice(0, 16)}</text>`;
        g += `<rect x="${L}" y="${yy}" width="${(W - L - 46).toFixed(1)}" height="9" rx="2" fill="var(--rule)" opacity="0.5"/>`;
        g += `<rect x="${L}" y="${yy}" width="${w.toFixed(1)}" height="9" rx="2" fill="${worst ? 'var(--accent-2)' : 'var(--accent)'}"/>`;
        g += `<text x="${(L + (W - L - 46) + 4).toFixed(1)}" y="${yy + 7.5}" font-family="IBM Plex Mono" font-size="8.5" fill="${worst ? 'var(--accent-2)' : 'var(--ink-muted)'}">${etN(a, 1)}</text>`;
      });
      y += G.length * 13 + 26;
    });
    let html = `<div class="ix-canvas"><svg width="100%" viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">`
      + `<title>Accuracy by group</title><desc>One bar per group per model, with each model's worst group highlighted.</desc>${g}</svg></div>`;
    html += '<table><tr><th>model</th><th>overall accuracy<br><span style="font-weight:400; opacity:.7;">weighted by group size</span></th><th>macro average<br><span style="font-weight:400; opacity:.7;">every group counts once</span></th><th>minimum<br><span style="font-weight:400; opacity:.7;">worst group</span></th><th>gap<br><span style="font-weight:400; opacity:.7;">max − min</span></th></tr>';
    M.forEach((m, i) => {
      const s = st[i];
      const tag = (b, lbl) => b === i ? ` <span class="tag" style="background:var(--tint-c2); color:var(--accent-3);">${lbl}</span>` : '';
      html += `<tr><td><strong>${esc(m.name)}</strong></td>
        <td><code>${etN(s.weighted, 2)}</code>${tag(bW, 'best')}</td>
        <td><code>${etN(s.macro, 2)}</code>${tag(bM, 'best')}</td>
        <td><code>${etN(s.min, 2)}</code>${tag(bMin, 'best')} <span style="opacity:.6; font-size:11px;">(${esc(G[s.worst].name)})</span></td>
        <td><code>${etN(s.gap, 2)}</code>${tag(bGap, 'smallest')}</td></tr>`;
    });
    html += '</table>';
    html += `<div class="metrics">
      <div class="metric"><div class="mn">maximise overall accuracy</div><div class="mv" style="font-size:15px;">${esc(M[bW].name)}</div><div class="mf">${etN(st[bW].weighted, 2)}% — worst group ${etN(st[bW].min, 1)}%</div></div>
      <div class="metric"><div class="mn">maximise minimum accuracy</div><div class="mv" style="font-size:15px;">${esc(M[bMin].name)}</div><div class="mf">${etN(st[bMin].min, 2)}% for its worst group</div></div>
      <div class="metric"><div class="mn">minimise the gap</div><div class="mv" style="font-size:15px;">${esc(M[bGap].name)}</div><div class="mf">${etN(st[bGap].gap, 2)} points between best and worst</div></div>
      <div class="metric dim"><div class="mn">do the objectives agree?</div><div class="mv" style="font-size:15px;">${(bW === bMin && bMin === bGap) ? 'yes' : 'no'}</div><div class="mf">${(bW === bMin && bMin === bGap) ? 'all three pick the same model' : 'different objectives, different winner'}</div></div>
    </div>`;
    const notes = [];
    if (bW !== bMin) notes.push(`<strong>The objective decides the answer.</strong> Maximising overall accuracy selects <strong>${esc(M[bW].name)}</strong>, whose worst group sits at ${etN(st[bW].min, 1)}%. Maximising the <em>minimum</em> selects <strong>${esc(M[bMin].name)}</strong> instead, at the cost of ${etN(st[bMin].weighted - st[bW].weighted, 2)} points of overall accuracy. That trade is the whole content of the <em>fairness functions</em> idea.`);
    else notes.push(`Here all objectives happen to prefer <strong>${esc(M[bMin].name)}</strong> — but look at its worst group: <strong>${etN(st[bMin].min, 1)}%</strong> against ${etN(st[bMin].max, 1)}% for its best. <strong>Being the least bad system is not the same as being fair.</strong>`);
    const N = G.reduce((a, x) => a + x.n, 0);
    const small = G.filter(x => x.n / N < 0.1);
    if (bGap !== bMin && st[bGap].min < st[bMin].min - 1e-9) {
      notes.push(`<strong>And minimising the gap is not the same as helping anyone.</strong> <strong>${esc(M[bGap].name)}</strong> has the smallest gap (${etN(st[bGap].gap, 2)}) but its worst group sits at ${etN(st[bGap].min, 1)}%, <em>below</em> ${esc(M[bMin].name)}'s ${etN(st[bMin].min, 1)}%. A disparity objective can always be satisfied by making the system equally bad for everybody — which is why the wording is <em>“maximise minimum accuracy”</em>, or <em>“maximise accuracy <strong>and</strong> minimise performance differences”</em>, never disparity alone.`);
    }
    if (small.length && G.some(x => x.n !== G[0].n)) {
      notes.push(`<strong>Why the overall figure hides it:</strong> ${small.map(x => esc(x.name)).join(', ')} ${small.length === 1 ? 'is' : 'are'} only ${etN(100 * small.reduce((a, x) => a + x.n, 0) / N, 1)}% of the data, so even a catastrophic accuracy there barely moves the weighted number. <strong>The macro average, which counts every group once, is the column that notices.</strong> This is Topic 05's accuracy trap arriving as an ethics problem — and it is exactly <em>evaluation bias</em>.`);
    }
    html += '<div class="verdict warn" style="margin-top:12px;">' + notes.join('<br><br>') + '</div>';
    html += `<div class="ix-bar"><span class="ix-lab">load</span>
      <button class="ix-btn" onclick="frLoad('gs')">Gender Shades</button>
      <button class="ix-btn" onclick="frLoad('conflict')">objectives disagree</button>
      <button class="ix-btn" onclick="frLoad('trap')">the accuracy trap</button></div>`;
    html += `<p class="ix-hint">Group sizes go in the header as <code>name (n=…)</code>; leave them off and every group counts equally.
      The <strong>Gender Shades</strong> preset is the published table — gender-classification error rates by Fitzpatrick skin type, from Buolamwini &amp; Gebru (2018), converted here to accuracies. Even the best of the three systems drops from <strong>100% on Type IV to 75% on Type VI</strong>.</p>`;
    out.innerHTML = html;
  }
  function runFair() {
    const out = document.getElementById('fr-output');
    if (!out) return;
    const el = document.getElementById('fr-data');
    const p = frParse(el ? el.value : '');
    if (p.err) { FR.err = p.err; out.innerHTML = `<div class="tool-error">${p.err}</div>`; return; }
    FR.err = ''; FR.groups = p.groups; FR.models = p.models;
    frRender();
  }
  TOOL_RUNNERS.runFair = runFair;

  /* ------------------------------------------------------------
     TOOL · principles and mitigations  (runPrin)
     ------------------------------------------------------------ */
  const PRINCIPLES = [
    { n: 'Human oversight and agency', d: 'Upholding fundamental rights, informed decisions, correct trust, human-in-the-loop' },
    { n: 'Safety and robustness', d: 'Minimization of errors, functioning for a range of settings, resilience to attack' },
    { n: 'Privacy', d: 'Consent, anonymity, access, de-anonymization' },
    { n: 'Transparency', d: 'Documentation and logging of data/decisions, explainability, informing when AI is used' },
    { n: 'Fairness', d: 'Non-discrimination, accessibility, stakeholder participation' },
    { n: 'Societal &amp; environmental wellbeing', d: 'Environmental impact, impact to social relationships, democracy, politics' },
    { n: 'Accountability', d: 'Auditability, documenting how dilemmas and trade-offs were resolved, responsibility for harms' }
  ];
  const MITIG = [
    { g: 'Bias', n: 'Dataset curation', d: 'Improve the curation process so minority and marginalized groups are appropriately represented, and harmful content is removed. Includes <strong>participatory design</strong>.' },
    { g: 'Bias', n: 'Reweighting', d: 'During training, weight data from minority groups more highly.' },
    { g: 'Bias', n: 'Resampling', d: 'During training, sample data from minority groups more often.' },
    { g: 'Bias', n: 'Fairness functions', d: 'During training, instead of maximising average accuracy → <strong>maximise the minimum accuracy</strong>; or maximise accuracy while minimising performance differences.' },
    { g: 'Privacy', n: 'Anonymization algorithms', d: 'Face blurring; text anonymization techniques.' },
    { g: 'Privacy', n: 'Differential privacy', d: 'Release information about a dataset in a way that does not reveal whether any given person is in it — usually by <strong>adding noise to computations in a smart way</strong>.' },
    { g: 'Environment', n: 'Emission estimation', d: 'Code emission estimation methods; many libraries exist, e.g. <strong>CodeCarbon</strong>.' },
    { g: 'Environment', n: 'Smaller models', d: 'Solve the problem with smaller models.' },
    { g: 'Governance', n: 'Regulations, standards, codes of conduct', d: 'Safeguard current deployments; guide and constrain the trajectory of future development.' },
    { g: 'Governance', n: 'Auditing, verification, validation', d: 'Implement processes of <strong>internal and external</strong> auditing, verification and validation.' },
    { g: 'Governance', n: '“Trustworthy AI”', d: 'Design <em>and</em> governance together: designing AI with ethical principles, and governing its development and deployment.' },
    { g: 'Values', n: 'Value alignment', d: 'Align AI behaviour with human values — e.g. a model trained to predict how aligned an output is to values like honesty and clarity. <strong>Both a technical and a social problem</strong>: how to encode rules, and finding out what values we want.' }
  ];
  const PN = { mode: 'ref', cur: null, given: '', score: { r: 0, t: 0 }, seed: 3, seen: [] };
  function pnMode(m) { PN.mode = m; PN.cur = null; PN.given = ''; pnRender(); }
  function pnNew() {
    if (PN.seen.length >= PRINCIPLES.length) PN.seen = [];
    const rnd = etRnd(PN.seed++);
    let i, guard = 0;
    do { i = Math.floor(rnd() * PRINCIPLES.length) % PRINCIPLES.length; } while (PN.seen.indexOf(i) >= 0 && guard++ < 40);
    PN.seen.push(i); PN.cur = i; PN.given = '';
    pnRender();
  }
  function pnAnswer(i) {
    if (PN.cur === null || PN.given !== '') return;
    PN.given = String(i); PN.score.t++;
    if (i === PN.cur) PN.score.r++;
    pnRender();
  }
  function pnResetScore() { PN.score = { r: 0, t: 0 }; PN.seen = []; pnRender(); }
  function pnRender() {
    const out = document.getElementById('pn-output');
    if (!out) return;
    let html = `<div class="ix-bar"><span class="ix-seg">
      <button class="${PN.mode === 'ref' ? 'on' : ''}" onclick="pnMode('ref')">principles</button>
      <button class="${PN.mode === 'mit' ? 'on' : ''}" onclick="pnMode('mit')">mitigation methods</button>
      <button class="${PN.mode === 'drill' ? 'on' : ''}" onclick="pnMode('drill')">★ name the principle</button></span>`;
    if (PN.mode === 'drill') {
      const pct = PN.score.t ? Math.round(100 * PN.score.r / PN.score.t) : 0;
      html += `<span class="stat-pill dark">score ${PN.score.r} / ${PN.score.t}</span>`;
      if (PN.score.t) html += `<span class="stat-pill ${pct >= 70 ? 'b' : pct >= 40 ? 'a' : 'c'}">${pct}%</span>`;
      html += `<button class="ix-btn" onclick="pnNew()">${PN.cur === null ? 'start ▶' : 'next ▶'}</button>
        <button class="ix-btn" onclick="pnResetScore()">reset score</button>`;
    }
    html += '</div>';
    if (PN.mode === 'ref') {
      html += '<table style="margin-top:14px;"><tr><th>Principle</th><th>Description</th></tr>'
        + PRINCIPLES.map(p => `<tr><td><strong>${p.n}</strong></td><td>${p.d}</td></tr>`).join('') + '</table>';
      html += `<p class="ix-hint">Seven principles, adopted in various forms by <strong>governmental bodies (UK EPSRC, NHS, EU…)</strong> and <strong>professional ones (IEEE, ACM…)</strong>.
        Note how tightly they map onto the seven harms — <em>fairness</em> answers fairness-and-dignity harms, <em>privacy</em> answers privacy harms, and so on. If you can state a harm you can usually state the principle that addresses it.</p>`;
    } else if (PN.mode === 'mit') {
      let last = '';
      html += '<table style="margin-top:14px;"><tr><th>area</th><th>method</th><th>what it does</th></tr>';
      MITIG.forEach(m => {
        html += `<tr><td>${m.g === last ? '' : '<strong>' + m.g + '</strong>'}</td><td><strong>${m.n}</strong></td><td>${m.d}</td></tr>`;
        last = m.g;
      });
      html += '</table>';
      html += `<p class="ix-hint">A question asking how to mitigate a harm wants a <em>named</em> method from this table, not a general sentiment.
        <strong>Reweighting and resampling are different things</strong> — one changes the weight of each example in the loss, the other changes how often it is drawn — and both are distinct from <strong>dataset curation</strong>, which changes the data itself.
        Try the <a href="#mt-ftool" onclick="showSection('t9-mitig')">fairness-function tool</a> to see what the fourth bias method actually does to a decision.</p>`;
    } else {
      if (PN.cur === null) {
        html += `<div class="quiz-prompt" style="margin-top:14px;">Press <strong>start</strong>. A description from the principles table appears; name the principle it belongs to.</div>`;
      } else {
        html += `<div class="quiz-prompt" style="margin-top:14px;"><div class="qp-topic">which principle?</div>${PRINCIPLES[PN.cur].d}</div>`;
        html += '<div class="quiz-choices">';
        PRINCIPLES.forEach((p, i) => {
          let cls = 'quiz-choice';
          if (PN.given !== '') {
            if (i === PN.cur) cls += ' right';
            else if (String(i) === PN.given) cls += ' wrong';
          }
          html += `<button class="${cls}" onclick="pnAnswer(${i})">${p.n}</button>`;
        });
        html += '</div>';
        if (PN.given !== '') {
          const right = Number(PN.given) === PN.cur;
          html += `<div class="verdict ${right ? 'safe' : 'bad'} quiz-fb">${right ? '✓ <strong>Correct.</strong>' : `✗ That description belongs to <strong>${PRINCIPLES[PN.cur].n}</strong>.`}</div>`;
          html += `<div class="tool-controls" style="margin-top:10px;"><button class="tool-btn green" onclick="pnNew()">Next ▶</button></div>`;
        }
      }
    }
    out.innerHTML = html;
  }
  function runPrin() { pnRender(); }
  TOOL_RUNNERS.runPrin = runPrin;
