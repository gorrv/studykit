  /* ---------- W3 · address translation, W4 · page replacement ---------- */

  function qmHex(target) {
    return function (v) {
      var s = String(v).trim().toLowerCase().replace(/^0x/, '');
      var x = parseInt(s, 16);
      if (isNaN(x)) return { ok: false, msg: 'Give a hex number, e.g. 0x1f.' };
      return { ok: x === target };
    };
  }

  function qmInt(target) {
    return function (v) {
      var x = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
      if (isNaN(x)) return { ok: false, msg: 'Give a whole number.' };
      return { ok: x === target };
    };
  }

  // Split an address into page number and offset.
  QZ_GEN.push({ topic: 'translation', make: function () {
    var kb = qzPick([1, 2, 4, 8, 16]);
    var offsetBits = Math.round(Math.log2(kb * 1024));
    var addr = qzInt(1, 0xffff);
    var part = qzPick(['page', 'offset']);
    var split = xlSplit(addr, 32, offsetBits, 1);
    if (split.page === 0) throw new Error('retry');

    var want = part === 'page' ? split.page : split.offset;
    return {
      topic: 'translation · splitting an address',
      prompt: 'Pages are <strong>' + kb + ' kB</strong>. For the virtual address <code>0x' +
        addr.toString(16) + '</code>, what is the <strong>' +
        (part === 'page' ? 'page number' : 'offset within the page') + '</strong>? (hex)',
      placeholder: 'hex, e.g. 0x1f',
      answer: '0x' + want.toString(16),
      check: qmHex(want),
      explain: 'A ' + kb + ' kB page needs ' + offsetBits + ' offset bits, so the low ' +
        (offsetBits / 4) + ' hex digits are the offset and everything above is the page number. ' +
        '0x' + addr.toString(16) + ' = page <strong>0x' + split.page.toString(16) +
        '</strong>, offset <strong>0x' + split.offset.toString(16) + '</strong>. ' +
        'Check: 0x' + split.page.toString(16) + ' × ' + kb + 'k + 0x' + split.offset.toString(16) +
        ' = 0x' + addr.toString(16) + '.',
    };
  } });

  // How big a flat page table gets.
  QZ_GEN.push({ topic: 'translation', make: function () {
    var width = qzPick([16, 24, 32]);
    var kb = qzPick([1, 4, 8]);
    var entryBytes = qzPick([2, 4]);
    var offsetBits = Math.round(Math.log2(kb * 1024));
    var pageBits = width - offsetBits;
    if (pageBits < 4) throw new Error('retry');

    var bytes = Math.pow(2, pageBits) * entryBytes;
    var human = bytes >= 1048576 ? (bytes / 1048576) + ' MB'
      : bytes >= 1024 ? (bytes / 1024) + ' kB' : bytes + ' bytes';

    return {
      topic: 'translation · page table size',
      prompt: 'A <strong>' + width + '-bit</strong> address space with <strong>' + kb +
        ' kB</strong> pages and <strong>' + entryBytes + '-byte</strong> page-table entries. ' +
        'How many <strong>entries</strong> does a single-level page table need?',
      placeholder: 'a number of entries',
      answer: String(Math.pow(2, pageBits)),
      check: qmInt(Math.pow(2, pageBits)),
      explain: 'Offset = log₂(' + kb + ' × 1024) = ' + offsetBits + ' bits, so the page number is ' +
        width + ' − ' + offsetBits + ' = ' + pageBits + ' bits. One entry per page means 2<sup>' +
        pageBits + '</sup> = <strong>' + Math.pow(2, pageBits).toLocaleString() + '</strong> entries, ' +
        'which at ' + entryBytes + ' bytes each is ' + human + ' per process. That number is the ' +
        'argument for multi-level tables.',
    };
  } });

  // Page faults for a random reference string.
  QZ_GEN.push({ topic: 'replacement', make: function () {
    var algo = qzPick(['fifo', 'lru', 'opt']);
    var frames = qzInt(2, 4);
    var pages = qzInt(4, 6);
    var refs = [];
    for (var i = 0; i < qzInt(10, 14); i++) refs.push(qzInt(0, pages - 1));

    var faults = prRun(refs, frames, algo).faults;
    // Reject strings where the algorithms agree — nothing to distinguish.
    var all = ['fifo', 'lru', 'opt'].map(function (a) { return prRun(refs, frames, a).faults; });
    if (Math.max.apply(null, all) === Math.min.apply(null, all)) throw new Error('retry');

    var name = { fifo: 'FIFO', lru: 'LRU', opt: 'Optimal (MIN)' }[algo];
    var run = prRun(refs, frames, algo);
    return {
      topic: 'replacement · counting faults',
      prompt: 'Reference string <code>' + refs.join(' ') + '</code> with <strong>' + frames +
        ' frames</strong> under <strong>' + name + '</strong>. How many page faults?',
      placeholder: 'a number',
      answer: String(faults),
      check: qmInt(faults),
      explain: 'Step by step: ' + run.steps.map(function (st, i) {
        return refs[i] + (st.fault ? '✗' : '✓');
      }).join(' ') + ' → <strong>' + faults + ' faults</strong>, ' + (refs.length - faults) + ' hits. ' +
        'The first ' + frames + ' distinct pages always fault; those are compulsory misses.',
    };
  } });

  // Which policy is immune to Belady's anomaly.
  //
  // Asked in this direction on purpose. The other direction — "which CAN
  // suffer it" — has two right answers among these policies, and a question
  // with two right answers and one marked answer is a broken question.
  QZ_GEN.push({ topic: 'replacement', make: function () {
    var immune = qzPick(['LRU', 'Optimal (MIN)']);
    var vulnerable = ['FIFO', 'Clock (second chance)', 'Random'];
    var choices = vulnerable.concat([immune]);
    choices.sort(function () { return Math.random() - 0.5; });

    return {
      topic: 'replacement · Belady’s anomaly',
      kind: 'choice',
      prompt: 'Which of these page-replacement policies <strong>cannot</strong> suffer Belady’s anomaly ' +
        '— that is, for which is it impossible for more frames to produce more faults?',
      choices: choices,
      answer: immune,
      check: textCheck(immune),
      explain: 'LRU and Optimal are <em>stack algorithms</em>: the pages resident with n frames are always ' +
        'a subset of those resident with n+1, so extra memory can never cost you a hit. FIFO and Clock ' +
        'evict on arrival order rather than on use, so that guarantee does not hold and both can show ' +
        'the anomaly. The classic case is <code>1 2 3 4 1 2 5 1 2 3 4 5</code> under FIFO: 9 faults with ' +
        '3 frames, 10 with 4.',
    };
  } });
