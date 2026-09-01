  /* ============================================================
     TOOL 3: TRANSITION SYSTEM EXPLORER
     ============================================================ */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function tsPreset(which) {
    const box = document.getElementById('ts-rel');
    if (which === 'nondet') {
      box.value = 'c0 -> c1\nc0 -> c2\nc1 -> c3\nc2 -> c3';
      document.getElementById('ts-start').value = 'c0';
    } else if (which === 'loop') {
      box.value = 'c0 -> c1\nc1 -> c2\nc2 -> c1';
      document.getElementById('ts-start').value = 'c0';
    }
    runTS();
  }
  function tsParse(raw) {
    const edges = [];
    const errors = [];
    raw.split('\n').forEach((line, i) => {
      const l = line.trim();
      if (l === '' || l.startsWith('#')) return;
      const m = l.split(/->|→/);
      if (m.length !== 2) { errors.push(`Line ${i + 1}: expected the form  c -> c'`); return; }
      const from = m[0].trim(), to = m[1].trim();
      if (!from || !to) { errors.push(`Line ${i + 1}: missing a configuration name`); return; }
      edges.push([from, to]);
    });
    return { edges, errors };
  }
  function runTS() {
    const out = document.getElementById('ts-output');
    const { edges, errors } = tsParse(document.getElementById('ts-rel').value);
    if (errors.length) { out.innerHTML = `<div class="tool-error">${errors.join('<br>')}</div>`; return; }
    if (edges.length === 0) { out.innerHTML = '<div class="tool-error">No transitions given.</div>'; return; }
    // Config = every name mentioned
    const configs = [];
    const succ = {};
    edges.forEach(([a, b]) => {
      [a, b].forEach(x => { if (!configs.includes(x)) { configs.push(x); succ[x] = succ[x] || []; } });
      if (!succ[a].includes(b)) succ[a].push(b);
    });
    // terminal: no outgoing transitions
    const terminal = configs.filter(c => succ[c].length === 0);
    // determinism: some c with 2+ distinct successors
    const branching = configs.filter(c => succ[c].length > 1);
    const deterministic = branching.length === 0;
    // reachability by ->* from start
    const start = document.getElementById('ts-start').value.trim();
    let html = '';
    // summary pills
    html += `<div style="margin-bottom:12px;">`;
    html += `<span class="stat-pill dark">|Config| = ${configs.length}</span>`;
    html += `<span class="stat-pill a">|→| = ${edges.length} transitions</span>`;
    html += `<span class="stat-pill b">T = { ${terminal.length ? terminal.map(esc).join(', ') : '∅'} }</span>`;
    html += `</div>`;
    // determinism verdict
    if (deterministic) {
      html += `<div class="verdict safe">✓ <strong>Deterministic.</strong> Every configuration has at most one successor, so for all c, c₁, c₂: c → c₁ and c → c₂ implies c₁ = c₂.</div>`;
    } else {
      const witness = branching[0];
      const [s1, s2] = succ[witness];
      html += `<div class="verdict bad">✗ <strong>Not deterministic.</strong> Counter-example: ${esc(witness)} → ${esc(s1)} and ${esc(witness)} → ${esc(s2)}, but ${esc(s1)} ≠ ${esc(s2)}. That violates the condition c → c₁ ∧ c → c₂ ⇒ c₁ = c₂.</div>`;
    }
    // terminal explanation
    if (terminal.length === 0) {
      html += `<div class="verdict warn">⚠ <strong>No terminal configurations.</strong> Every configuration has an outgoing transition, so no run can ever stop — this system has no T, and therefore no completed runs.</div>`;
    }
    // reachability
    if (!configs.includes(start)) {
      html += `<div class="tool-error">Start configuration "${esc(start)}" does not appear in the relation.</div>`;
      out.innerHTML = html; return;
    }
    const seen = new Set([start]);
    const order = [start];
    const queue = [start];
    while (queue.length) {
      const c = queue.shift();
      succ[c].forEach(n => { if (!seen.has(n)) { seen.add(n); order.push(n); queue.push(n); } });
    }
    html += `<h4 style="font-size:16px; margin-top:18px;">Reachability: ${esc(start)} →* ?</h4>`;
    html += `<p style="font-size:13px; margin:0 0 8px 0;">Reachable in zero or more steps (note ${esc(start)} reaches itself — that's the <em>reflexive</em> part of →*):</p>`;
    html += `<div style="margin-bottom:10px;">` + order.map(c => {
      const cls = c === start ? 'init' : (succ[c].length === 0 ? 'term' : (succ[c].length > 1 ? 'branch' : 'mid'));
      return `<span class="ts-node ${cls}" style="display:inline-block; margin:0 5px 5px 0; font-size:12px; padding:5px 12px;">${esc(c)}</span>`;
    }).join('') + `</div>`;
    const unreachable = configs.filter(c => !seen.has(c));
    if (unreachable.length) {
      html += `<p style="font-size:13px; color:var(--ink-muted);"><strong>Unreachable from ${esc(start)}:</strong> ${unreachable.map(esc).join(', ')}</p>`;
    }
    // sample run(s)
    html += `<h4 style="font-size:16px; margin-top:16px;">Sample run${deterministic ? '' : 's'} from ${esc(start)}</h4>`;
    const paths = [];
    (function walk(c, path, depth) {
      if (paths.length >= 4) return;
      if (path.includes(c)) { paths.push({ path: path.concat(c + ' ↺'), kind: 'loop' }); return; }
      const p = path.concat(c);
      if (succ[c].length === 0) { paths.push({ path: p, kind: 'terminal' }); return; }
      if (depth > 24) { paths.push({ path: p.concat('…'), kind: 'deep' }); return; }
      succ[c].forEach(n => walk(n, p, depth + 1));
    })(start, [], 0);
    paths.slice(0, 4).forEach(pr => {
      html += `<div class="ts-chain" style="justify-content:flex-start;">`;
      pr.path.forEach((c, i) => {
        if (i > 0) html += `<span class="ts-arrow">→</span>`;
        const isLast = i === pr.path.length - 1;
        let cls = 'mid';
        if (i === 0) cls = 'init';
        else if (isLast && pr.kind === 'terminal') cls = 'term';
        else if (isLast && pr.kind === 'loop') cls = 'branch';
        html += `<span class="ts-node ${cls}" style="font-size:12px; padding:6px 12px;">${esc(c)}</span>`;
      });
      if (pr.kind === 'terminal') html += `<span style="font-size:11px; color:var(--accent-3); font-family:'IBM Plex Mono',monospace; margin-left:6px;">✓ reaches T — a complete run</span>`;
      if (pr.kind === 'loop') html += `<span style="font-size:11px; color:var(--accent-2); font-family:'IBM Plex Mono',monospace; margin-left:6px;">↺ cycles — never terminates</span>`;
      html += `</div>`;
    });
    out.innerHTML = html;
  }
