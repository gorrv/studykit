  /* ============================================================
     TOOL 2: SCHEDULING PLAYGROUND (Week 2)
     ============================================================ */

  let procs = [
    { name: 'P1', arrival: 0, burst: 5 },
    { name: 'P2', arrival: 0, burst: 4 },
    { name: 'P3', arrival: 0, burst: 3 },
  ];
  const ganttColors = ['gantt-p1','gantt-p2','gantt-p3','gantt-p4','gantt-p5'];

  function renderProcRows() {
    const c = document.getElementById('sch-rows');
    if (!c) return;
    c.innerHTML = procs.map((p, i) => `
      <div class="proc-input-row">
        <span class="pname">${p.name}</span>
        <input type="number" min="0" value="${p.arrival}" onchange="updateProc(${i},'arrival',this.value)">
        <input type="number" min="1" value="${p.burst}" onchange="updateProc(${i},'burst',this.value)">
        <button class="mini-btn" onclick="removeProc(${i})" title="Remove">×</button>
      </div>`).join('');
  }

  function updateProc(i, field, val) {
    procs[i][field] = Math.max(0, parseInt(val,10) || 0);
  }
  function addProc() {
    if (procs.length >= 5) return;
    procs.push({ name: 'P'+(procs.length+1), arrival: 0, burst: 3 });
    renderProcRows();
  }
  function removeProc(i) {
    procs.splice(i,1);
    procs.forEach((p,idx) => p.name = 'P'+(idx+1));
    renderProcRows();
  }
  function toggleQuantum() {
    const algo = document.getElementById('sch-algo').value;
    document.getElementById('sch-quantum-field').style.display = (algo === 'rr') ? 'flex' : 'none';
  }

  function runSchedule() {
    const algo = document.getElementById('sch-algo').value;
    const out = document.getElementById('sch-output');
    if (procs.length === 0) { out.innerHTML = '<div class="tool-error">Add at least one process.</div>'; return; }

    const colorMap = {};
    procs.forEach((p,i) => colorMap[p.name] = ganttColors[i % ganttColors.length]);

    let timeline = []; // {name, start, end}
    const ps = procs.map(p => ({...p, remaining: p.burst}));

    if (algo === 'fcfs') {
      const sorted = [...ps].sort((a,b)=> a.arrival - b.arrival);
      let t = 0;
      for (const p of sorted) {
        if (t < p.arrival) { timeline.push({name:'idle', start:t, end:p.arrival}); t = p.arrival; }
        timeline.push({name:p.name, start:t, end:t+p.burst}); t += p.burst;
      }
    } else if (algo === 'sjf') {
      // non-preemptive
      let t = 0, done = 0;
      const n = ps.length;
      const finished = {};
      while (done < n) {
        const avail = ps.filter(p => p.arrival <= t && !finished[p.name]);
        if (avail.length === 0) {
          const next = ps.filter(p=>!finished[p.name]).sort((a,b)=>a.arrival-b.arrival)[0];
          timeline.push({name:'idle', start:t, end:next.arrival}); t = next.arrival; continue;
        }
        avail.sort((a,b)=> a.burst - b.burst || a.arrival - b.arrival);
        const p = avail[0];
        timeline.push({name:p.name, start:t, end:t+p.burst}); t += p.burst;
        finished[p.name] = true; done++;
      }
    } else if (algo === 'rr') {
      const q = Math.max(1, parseInt(document.getElementById('sch-quantum').value,10) || 2);
      const arrivalSorted = [...ps].sort((a,b)=>a.arrival-b.arrival);
      const queue = [];
      let t = 0, idx = 0, done = 0;
      const n = ps.length;
      // seed
      while (idx < arrivalSorted.length && arrivalSorted[idx].arrival <= t) queue.push(arrivalSorted[idx++]);
      if (queue.length === 0 && arrivalSorted.length) { t = arrivalSorted[0].arrival; while (idx<arrivalSorted.length && arrivalSorted[idx].arrival<=t) queue.push(arrivalSorted[idx++]); }
      while (done < n) {
        if (queue.length === 0) {
          if (idx < arrivalSorted.length) { timeline.push({name:'idle',start:t,end:arrivalSorted[idx].arrival}); t=arrivalSorted[idx].arrival; while(idx<arrivalSorted.length && arrivalSorted[idx].arrival<=t) queue.push(arrivalSorted[idx++]); continue; }
          else break;
        }
        const p = queue.shift();
        const run = Math.min(q, p.remaining);
        timeline.push({name:p.name, start:t, end:t+run});
        t += run; p.remaining -= run;
        // enqueue newly arrived during this slice
        while (idx < arrivalSorted.length && arrivalSorted[idx].arrival <= t) queue.push(arrivalSorted[idx++]);
        if (p.remaining > 0) queue.push(p); else done++;
      }
    }

    // merge consecutive same-name blocks for cleaner gantt
    const merged = [];
    for (const b of timeline) {
      const last = merged[merged.length-1];
      if (last && last.name === b.name) last.end = b.end; else merged.push({...b});
    }

    const totalTime = merged.length ? merged[merged.length-1].end : 0;
    const unit = Math.max(20, Math.min(46, 600 / Math.max(totalTime,1)));

    // build gantt
    let html = '<div class="live-gantt"><div class="live-gantt-row">';
    for (const b of merged) {
      const w = (b.end - b.start) * unit;
      const cls = b.name === 'idle' ? 'gantt-idle' : colorMap[b.name];
      html += `<div class="live-gantt-cell ${cls}" style="width:${w}px;">${b.name==='idle'?'idle':b.name}</div>`;
    }
    html += '</div><div class="live-gantt-axis" style="position:relative; height:16px;">';
    // axis ticks
    const ticks = new Set([0]);
    merged.forEach(b => ticks.add(b.end));
    [...ticks].sort((a,b)=>a-b).forEach(tk => {
      html += `<span style="position:absolute; left:${tk*unit}px; transform:translateX(-50%);">${tk}</span>`;
    });
    html += '</div></div>';

    // compute waiting times: completion - arrival - burst
    const completion = {};
    const firstRun = {};
    merged.forEach(b => {
      if (b.name !== 'idle') {
        completion[b.name] = b.end;
        if (firstRun[b.name] === undefined) firstRun[b.name] = b.start;
      }
    });
    let totalWait = 0, totalTAT = 0, totalResp = 0;
    const rows = procs.map(p => {
      const comp = completion[p.name];
      const tat = comp - p.arrival;            // turnaround
      const wait = tat - p.burst;              // waiting
      const resp = firstRun[p.name] - p.arrival; // response
      totalWait += wait; totalTAT += tat; totalResp += resp;
      return `<tr><td><strong>${p.name}</strong></td><td>${p.arrival}</td><td>${p.burst}</td><td>${comp}</td><td>${tat}</td><td>${wait}</td><td>${resp}</td></tr>`;
    }).join('');

    const awt = (totalWait / procs.length).toFixed(2);
    const atat = (totalTAT / procs.length).toFixed(2);
    const aresp = (totalResp / procs.length).toFixed(2);

    html += `<table class="results-table">
      <tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Completion</th><th>Turnaround</th><th>Waiting</th><th>Response</th></tr>
      ${rows}
      <tr class="awt-row"><td colspan="6">Average Waiting Time (AWT)</td><td>${awt}</td></tr>
      <tr class="awt-row"><td colspan="6">Average Turnaround Time</td><td>${atat}</td></tr>
      <tr class="awt-row"><td colspan="6">Average Response Time</td><td>${aresp}</td></tr>
    </table>
    <p style="font-size:12px; color:var(--ink-muted); margin-top:6px;">📘 Notice the trade-off: turnaround-optimisers (SJF) and response-optimisers (Round-Robin) pull these averages in opposite directions.</p>`;

    out.innerHTML = html;
  }

  // initialise tools on load
  document.addEventListener('DOMContentLoaded', function() {
    renderProcRows();
    stkRender();
  });

