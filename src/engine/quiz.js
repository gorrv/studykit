  /* ============================================================
     SELF-TEST QUIZ — driver.  Question generators get pushed into
     QZ_GEN as each topic's content is added.
     Each generator: { topic:'key', make: () => ({
         topic, prompt, answer, check(input)->{ok,msg}, explain,
         kind:'choice'|undefined, choices:[], placeholder }) }
     ============================================================ */
  const QZ_GEN = [];
  const qzPick = a => a[Math.floor(Math.random() * a.length)];
  const qzInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  function qzNorm(s) { return String(s).toLowerCase().replace(/\s+/g, '').replace(/[.;]$/, ''); }
  /* The commonest marker: accept the stated answer, ignoring case and spacing. */
  const textCheck = ans => v => ({ ok: qzNorm(v) === qzNorm(ans) });
  let qzCur = null, qzScore = { right: 0, total: 0 }, qzAnswered = false;
  /* Set when a press could not be acted on, and cleared by the next render. */
  let qzNudge = null;
  function qzNext() {
    const sel = document.getElementById('qz-topic');
    const topic = sel ? sel.value : 'all';
    const pool = QZ_GEN.filter(g => topic === 'all' ? true : g.topic === topic);
    if (!pool.length) { qzCur = null; qzRender(); return; }
    let tries = 0;
    qzCur = null;
    while (tries++ < 12) { try { qzCur = qzPick(pool).make(); break; } catch (e) { qzCur = null; } }
    qzAnswered = false;
    qzRender();
  }
  function qzChoose(i) { if (!qzAnswered && qzCur) qzSubmit(qzCur.choices[i]); }
  function qzSubmitText() { if (qzCur && !qzAnswered) qzSubmit(document.getElementById('qz-answer').value); }
  function qzSubmit(val) {
    if (!qzCur || qzAnswered) return;
    // Pressing Check with an empty box used to return in silence, which reads
    // as a broken button. Say what is missing instead.
    if (!String(val).trim()) { qzNudge = 'Type an answer first, then press Check.'; qzRender(); return; }
    let res;
    try { res = qzCur.check(val); } catch (e) { res = { ok: false, msg: 'Could not read that answer.' }; }
    qzAnswered = true; qzCur.given = val; qzCur.result = res;
    qzScore.total++; if (res.ok) qzScore.right++;
    qzRender();
  }
  function qzReveal() {
    if (!qzCur) { qzNext(); return; }
    if (!qzAnswered) { qzAnswered = true; qzScore.total++; qzCur.result = { ok: false, revealed: true }; }
    qzRender();
  }
  function qzResetScore() { qzScore = { right: 0, total: 0 }; qzRender(); }
  function qzRender() {
    const out = document.getElementById('qz-output');
    if (!out) return;
    let html = '';
    const pct = qzScore.total ? Math.round(100 * qzScore.right / qzScore.total) : 0;
    html += `<div class="quiz-score" style="margin-bottom:10px;"><span class="stat-pill dark">score ${qzScore.right} / ${qzScore.total}</span>`;
    if (qzScore.total) html += `<span class="stat-pill ${pct >= 70 ? 'b' : pct >= 40 ? 'a' : 'c'}">${pct}%</span>`;
    html += '</div>';
    if (!QZ_GEN.length) {
      out.innerHTML = `<div class="quiz-prompt"><div class="qp-topic">no questions yet</div>
        Questions are generated per topic and marked automatically. This module has no
        generators wired up yet.</div>`;
      return;
    }
    if (!qzCur) { out.innerHTML = html + '<div class="quiz-prompt">Press <strong>New question</strong> to start.</div>'; return; }
    html += `<div class="quiz-prompt"><div class="qp-topic">${qzCur.topic}</div>${qzCur.prompt}</div>`;
    if (qzNudge) { html += `<div class="tool-error">${qzNudge}</div>`; qzNudge = null; }
    if (qzCur.kind === 'choice') {
      html += '<div class="quiz-choices">';
      qzCur.choices.forEach((c, i) => {
        let cls = 'quiz-choice';
        if (qzAnswered) {
          if (qzNorm(c) === qzNorm(qzCur.answer)) cls += ' right';
          else if (qzCur.given !== undefined && qzNorm(c) === qzNorm(qzCur.given)) cls += ' wrong';
        }
        html += `<button class="${cls}" onclick="qzChoose(${i})">${c}</button>`;
      });
      html += '</div>';
    } else {
      html += `<div class="tool-controls" style="margin:8px 0;">
        <div class="tool-field" style="flex:1; min-width:220px;">
          <label>your answer</label>
          <input type="text" id="qz-answer" placeholder="${esc(qzCur.placeholder || '')}" style="width:100%;"
                 onkeydown="if(event.key==='Enter'){qzSubmitText();}" ${qzAnswered ? 'disabled' : ''}
                 value="${qzAnswered && qzCur.given !== undefined ? esc(String(qzCur.given)) : ''}">
        </div>
        <button class="tool-btn" onclick="qzSubmitText()" ${qzAnswered ? 'disabled' : ''}>Check</button>
      </div>`;
    }
    if (qzAnswered) {
      const r = qzCur.result || {};
      if (r.ok) html += `<div class="verdict safe quiz-fb">✓ <strong>Correct.</strong> ${qzCur.explain}</div>`;
      else if (r.revealed) html += `<div class="verdict warn quiz-fb"><strong>Answer:</strong> <code>${esc(String(qzCur.answer))}</code><br><br>${qzCur.explain}</div>`;
      else html += `<div class="verdict bad quiz-fb">✗ Not quite. ${r.msg ? r.msg + '<br><br>' : ''}<strong>The answer is</strong> <code>${esc(String(qzCur.answer))}</code>.<br><br>${qzCur.explain}</div>`;
      html += `<div class="tool-controls" style="margin-top:10px;"><button class="tool-btn green" onclick="qzNext()">Next question ▶</button></div>`;
    }
    out.innerHTML = html;
  }
