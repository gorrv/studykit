  /* ============================================================
     TOOL 7: CAESAR / ROT13 CIPHER (Week 7)
     ============================================================ */
  function shiftCipher(s, k) {
    return Array.from(s).map(c => {
      const code = c.charCodeAt(0);
      if (code >= 97 && code <= 122) return String.fromCharCode((code - 97 + (k % 26) + 26) % 26 + 97);
      if (code >= 65 && code <= 90)  return String.fromCharCode((code - 65 + (k % 26) + 26) % 26 + 65);
      return c;
    }).join('');
  }

  function runCipher() {
    const text = document.getElementById('cip-text').value;
    const k = parseInt(document.getElementById('cip-key').value, 10) || 0;
    const out = document.getElementById('cip-output');

    const ct = shiftCipher(text, k);
    const decrypted = shiftCipher(ct, -k);
    const isRot13 = ((((k % 26) + 26) % 26) === 13);

    let html = '';
    html += `<div style="font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--ink-muted); margin-bottom:4px;">PLAINTEXT</div>`;
    html += `<div class="cipher-io">${text || '<span style="color:#bbb;">(empty)</span>'}</div>`;
    html += `<div class="cipher-arrow">&darr; encrypt with K=${k} &darr;</div>`;
    html += `<div style="font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--accent-2); margin-bottom:4px;">CIPHERTEXT</div>`;
    html += `<div class="cipher-io ct">${ct || '<span style="color:#bbb;">(empty)</span>'}</div>`;
    html += `<div class="cipher-arrow">&darr; decrypt with &minus;K=${-k} &darr;</div>`;
    html += `<div style="font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--accent-3); margin-bottom:4px;">RECOVERED PLAINTEXT</div>`;
    html += `<div class="cipher-io" style="background:#ecf4e6;">${decrypted || '<span style="color:#bbb;">(empty)</span>'}</div>`;

    if (isRot13) {
      html += `<div class="smash-verdict safe" style="margin-top:12px;">🔁 K=13 is ROT13 — it's self-inverting! Encrypting the ciphertext again with K=13 gives back the plaintext.</div>`;
    }

    const letters = (text.toLowerCase().match(/[a-z]/g) || []);
    if (letters.length >= 12) {
      const freq = {};
      letters.forEach(c => freq[c] = (freq[c]||0)+1);
      const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,n])=>`'${c}'&times;${n}`).join(', ');
      html += `<div class="smash-verdict warn" style="margin-top:8px;">🔍 Frequency analysis: most common letters here are ${top}. In English, 'e' 't' 'a' dominate — an attacker matches peaks to guess K <em>without</em> the key. That's why the Caesar cipher is trivially broken.</div>`;
    }

    out.innerHTML = html;
  }

