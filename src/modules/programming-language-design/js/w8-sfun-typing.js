  /* ============================================================
     TOOL 15 (W8): SFUN TYPING DERIVATIONS   Γ ⊢ε t : τ
     ============================================================ */
  function tyParseGamma(s) {
    const G = {};
    s.split(',').forEach(part => {
      const p = part.trim(); if (!p) return;
      const m = p.split(':');
      if (m.length !== 2) throw new Error('Bad entry in Γ: "' + p + '" — write it as  x : int');
      const name = m[0].trim(), ty = m[1].trim();
      if (!['int', 'bool'].includes(ty)) throw new Error('Γ must map variables to int or bool, found "' + ty + '"');
      G[name] = ty;
    });
    return G;
  }
  function tyParseEps(s) {
    const E = {};
    // split on commas that are not inside brackets
    const parts = []; let d = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') d++; if (ch === ')') d--;
      if (ch === ',' && d === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    parts.forEach(part => {
      const p = part.trim(); if (!p) return;
      const i = p.indexOf(':');
      if (i < 0) throw new Error('Bad entry in ε: "' + p + '"');
      const name = p.slice(0, i).trim(), rest = p.slice(i + 1).trim();
      const arrow = rest.indexOf('->');
      if (arrow < 0) {
        if (!['int', 'bool'].includes(rest)) throw new Error('Bad type for ' + name + ' in ε');
        E[name] = { args: [], res: rest };
      } else {
        let lhs = rest.slice(0, arrow).trim(), res = rest.slice(arrow + 2).trim();
        if (!['int', 'bool'].includes(res)) throw new Error('Bad result type for ' + name + ' in ε');
        lhs = lhs.replace(/^\(|\)$/g, '');
        const args = lhs === '' ? [] : lhs.split(',').map(x => x.trim());
        args.forEach(a => { if (!['int', 'bool'].includes(a)) throw new Error('Bad argument type "' + a + '" for ' + name + ' in ε'); });
        E[name] = { args: args, res: res };
      }
    });
    return E;
  }
  function tyShowEnvs(G, E) {
    const g = Object.keys(G).length ? Object.keys(G).map(k => k + ' : ' + G[k]).join(', ') : '∅';
    const e = Object.keys(E).map(k => k + ' : ' + (E[k].args.length ? '(' + E[k].args.join(',') + ')→' + E[k].res : E[k].res)).join(', ');
    return { g: g, e: e };
  }
  function tyCheck(t, G, E) {
    const J = ty => 'Γ ⊢<sub>ε</sub> ' + esc(sfShow(t, 0)) + ' : ' + ty;
    switch (t.k) {
      case 'num': return { ty: 'int', d: { rule: '', concl: J('int'), prem: [] } };
      case 'bool': return { ty: 'bool', d: { rule: '', concl: J('bool'), prem: [] } };
      case 'var': {
        if (!(t.v in G)) throw { tyErr: 'the variable ' + t.v + ' is not in Γ, so no axiom applies' };
        return { ty: G[t.v], d: { rule: '', concl: J(G[t.v]), prem: [], side: 'if Γ(' + t.v + ') = ' + G[t.v] } };
      }
      case 'op': {
        const a = tyCheck(t.t1, G, E), b = tyCheck(t.t2, G, E);
        if (a.ty !== 'int' || b.ty !== 'int') throw { tyErr: 'both operands of an arithmetic operator must be int, but got ' + a.ty + ' and ' + b.ty };
        return { ty: 'int', d: { rule: '', concl: J('int'), prem: [a.d, b.d] } };
      }
      case 'bop': {
        const a = tyCheck(t.t1, G, E), b = tyCheck(t.t2, G, E);
        if (a.ty !== 'int' || b.ty !== 'int') throw { tyErr: 'both operands of a comparison must be int, but got ' + a.ty + ' and ' + b.ty };
        return { ty: 'bool', d: { rule: '', concl: J('bool'), prem: [a.d, b.d] } };
      }
      case 'and': {
        const a = tyCheck(t.t1, G, E), b = tyCheck(t.t2, G, E);
        if (a.ty !== 'bool' || b.ty !== 'bool') throw { tyErr: 'both operands of ∧ must be bool, but got ' + a.ty + ' and ' + b.ty };
        return { ty: 'bool', d: { rule: '', concl: J('bool'), prem: [a.d, b.d] } };
      }
      case 'not': {
        const a = tyCheck(t.t, G, E);
        if (a.ty !== 'bool') throw { tyErr: 'the operand of ¬ must be bool, but got ' + a.ty };
        return { ty: 'bool', d: { rule: '', concl: J('bool'), prem: [a.d] } };
      }
      case 'if': {
        const c = tyCheck(t.t0, G, E);
        if (c.ty !== 'bool') throw { tyErr: 'the condition of an if must be bool, but got ' + c.ty };
        const a = tyCheck(t.t1, G, E), b = tyCheck(t.t2, G, E);
        if (a.ty !== b.ty) throw { tyErr: 'both branches of an if must have the same type τ, but the then-branch is ' + a.ty + ' and the else-branch is ' + b.ty };
        return { ty: a.ty, d: { rule: '', concl: J(a.ty), prem: [c.d, a.d, b.d] } };
      }
      case 'call': {
        const sig = E[t.f];
        if (!sig) throw { tyErr: 'the function ' + t.f + ' is not in the function environment ε' };
        if (sig.args.length !== t.args.length) throw { tyErr: t.f + ' has arity ' + sig.args.length + ' in ε but is applied to ' + t.args.length + ' argument(s)' };
        const ds = [];
        for (let i = 0; i < t.args.length; i++) {
          const r = tyCheck(t.args[i], G, E);
          if (r.ty !== sig.args[i]) throw { tyErr: 'argument ' + (i + 1) + ' of ' + t.f + ' should be ' + sig.args[i] + ' but is ' + r.ty };
          ds.push(r.d);
        }
        const side = 'if ε(' + t.f + ') = ' + (sig.args.length ? '(' + sig.args.join(',') + ')→' + sig.res : sig.res);
        return { ty: sig.res, d: { rule: '', concl: J(sig.res), prem: ds, side: side } };
      }
      default: throw { tyErr: 'unknown term' };
    }
  }
  function tyPreset(w) {
    const G = document.getElementById('ty-gamma'), E = document.getElementById('ty-eps'), T = document.getElementById('ty-term');
    E.value = 'max : (int,int)->int, square : (int)->int, fact : (int)->int';
    if (w === 'max') { G.value = 'x : int'; T.value = 'max(3, square(2))'; }
    else if (w === 'fact') { G.value = 'x : int'; T.value = 'if x <= 0 then 1 else x * fact(x - 1)'; }
    else if (w === 'bad') { G.value = 'x : int'; T.value = '1 + True'; }
    else if (w === 'mismatch') { G.value = 'x : int'; T.value = 'if x > 0 then 1 else True'; }
    runTyping();
  }
  function runTyping() {
    const out = document.getElementById('ty-output');
    let G, E, t;
    try {
      G = tyParseGamma(document.getElementById('ty-gamma').value);
      E = tyParseEps(document.getElementById('ty-eps').value);
      const r = sfParseTerm(sfLex(document.getElementById('ty-term').value), 0);
      t = r.e;
    } catch (e) { out.innerHTML = `<div class="tool-error">${esc(e.message)}</div>`; return; }
    const envs = tyShowEnvs(G, E);
    let html = `<div style="font-family:'IBM Plex Mono',monospace; font-size:12.5px; color:var(--ink-soft); margin-bottom:10px;">Γ = ${esc(envs.g)}<br>ε = ${esc(envs.e)}</div>`;
    let res;
    try { res = tyCheck(t, G, E); }
    catch (e) {
      if (e && e.tyErr) {
        html += `<div class="verdict bad">✗ <strong>The term is not typeable.</strong> ${esc(e.tyErr)}.
          <br><br>Recall §7.1: an expression that cannot be typed is <em>rejected by the compiler without evaluation</em> — the constraints simply have no solution.</div>`;
        out.innerHTML = html; return;
      }
      out.innerHTML = html + `<div class="tool-error">${esc(String(e && e.message || e))}</div>`; return;
    }
    html += `<div class="verdict safe">✓ <strong>Γ ⊢<sub>ε</sub> ${esc(sfShow(t, 0))} : ${res.ty}</strong> &nbsp;<span style="font-weight:400;">(${infSize(res.d)} rule applications)</span></div>`;
    html += `<div class="deriv-box"><div class="db-title">typing derivation</div>${infHtml(res.d, true)}</div>`;
    out.innerHTML = html;
    ixTrace('tyT', 'ty-output', { label: 'rule application', reset: true });
  }
