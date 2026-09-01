  /* ============================================================
     TOOL 1: FETCH-EXECUTE CYCLE SIMULATOR
     ============================================================ */
  let feState = null;
  function feParse() {
    const raw = document.getElementById('fe-prog').value;
    return raw.split('\n').map(l => l.trim()).filter(l => l !== '' && !l.startsWith('#'));
  }
  function feInit() {
    feState = {
      prog: feParse(), pc: 0, acc: 0, mem: {}, out: [], log: [],
      phase: 'idle', halted: false, fetched: null, steps: 0
    };
  }
  function feStep() {
    if (!feState || feState.halted) feInit();
    const s = feState;
    if (s.pc < 0 || s.pc >= s.prog.length) {
      s.halted = true;
      s.log.push('PC out of range → control returns to the operating system');
      feRender(); return;
    }
    if (s.steps++ > 500) { s.halted = true; s.log.push('⚠ step limit reached (possible infinite loop)'); feRender(); return; }
    // PHASE 1: FETCH
    const addr = s.pc;
    const instr = s.prog[addr];
    s.fetched = instr;
    s.log.push(`FETCH   → read "${instr}" from address ${addr}`);
    // PHASE 2: INCREMENT PC
    s.pc = s.pc + 1;
    s.log.push(`INC PC  → program counter is now ${s.pc}`);
    // PHASE 3: DECODE & EXECUTE
    const parts = instr.split(/\s+/);
    const op = parts[0].toUpperCase();
    const arg = parts.length > 1 ? parseInt(parts[1], 10) : null;
    let desc = '';
    switch (op) {
      case 'LOAD':  s.acc = arg; desc = `acc := ${arg}`; break;
      case 'ADD':   s.acc = s.acc + arg; desc = `acc := acc + ${arg} = ${s.acc}`; break;
      case 'SUB':   s.acc = s.acc - arg; desc = `acc := acc − ${arg} = ${s.acc}`; break;
      case 'STORE': s.mem[arg] = s.acc; desc = `mem[${arg}] := ${s.acc}`; break;
      case 'LOADM': s.acc = (s.mem[arg] === undefined ? 0 : s.mem[arg]); desc = `acc := mem[${arg}] = ${s.acc}`; break;
      case 'PRINT': s.out.push(s.acc); desc = `output ${s.acc}`; break;
      case 'JMP':   s.pc = arg; desc = `PC := ${arg}  (overwrites the increment!)`; break;
      case 'JMPZ':
        if (s.acc === 0) { s.pc = arg; desc = `acc = 0 → PC := ${arg}`; }
        else { desc = `acc = ${s.acc} ≠ 0 → no jump`; }
        break;
      case 'HALT':  s.halted = true; desc = 'halt → control returns to the operating system'; break;
      default:      desc = `⚠ unknown instruction "${op}" — ignored`; break;
    }
    s.log.push(`EXECUTE → ${desc}`);
    s.log.push('—');
    feRender();
  }
  function feRunAll() {
    feInit();
    let guard = 0;
    while (!feState.halted && guard++ < 1200) feStep();
    feRender();
  }
  function feReset() { feInit(); feRender(); }
  function feRender() {
    const s = feState, out = document.getElementById('fe-output');
    if (!s) { out.innerHTML = ''; return; }
    let html = '<div class="fe-machine">';
    // memory / program panel
    html += '<div class="fe-panel"><div class="fe-title">Memory — the program</div>';
    s.prog.forEach((ins, i) => {
      const cls = (i === s.pc && !s.halted) ? 'current' : (i < s.pc ? 'done' : '');
      html += `<div class="fe-instr ${cls}"><div class="fe-addr">${i}</div><div class="fe-code">${esc(ins)}</div></div>`;
    });
    html += '</div>';
    // registers panel
    html += '<div class="fe-panel"><div class="fe-title">Registers &amp; data</div>';
    html += `<div class="fe-reg"><span class="rn">program counter</span><span class="rv">${s.pc}</span></div>`;
    html += `<div class="fe-reg"><span class="rn">accumulator</span><span class="rv">${s.acc}</span></div>`;
    html += `<div class="fe-reg"><span class="rn">last fetched</span><span class="rv">${s.fetched === null ? '—' : esc(s.fetched)}</span></div>`;
    const memKeys = Object.keys(s.mem);
    if (memKeys.length) {
      memKeys.sort((a,b)=>a-b).forEach(k => {
        html += `<div class="fe-reg"><span class="rn">mem[${k}]</span><span class="rv">${s.mem[k]}</span></div>`;
      });
    }
    html += '</div></div>';
    // phases
    html += '<div class="fe-phase">';
    html += '<span class="fe-step' + (!s.halted ? ' active' : '') + '">1 · fetch</span>';
    html += '<span class="fe-step' + (!s.halted ? ' active' : '') + '">2 · increment PC</span>';
    html += '<span class="fe-step' + (!s.halted ? ' active' : '') + '">3 · decode &amp; execute</span>';
    html += '</div>';
    html += `<div class="fe-out">output: ${s.out.length ? s.out.join('  ') : '<span style="color:var(--ink-muted);">(nothing yet)</span>'}</div>`;
    html += '<div class="fe-log">' + (s.log.length ? s.log.map((l, i) => `<div data-step="${i}">${esc(l)}</div>`).join('') : '<div>Press Step to begin.</div>') + '</div>';
    if (s.halted) {
      html += '<div class="verdict safe">✓ Halted — all instructions executed, control returns to the operating system.</div>';
    }
    out.innerHTML = html;
    ixTrace('feT', 'fe-output', { label: 'log line', reset: true });
  }
