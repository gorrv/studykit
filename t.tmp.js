const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
for (const f of ['cryptography','practical-programming','intro-to-ai']) {
  const t0=Date.now();
  const dom=new JSDOM(fs.readFileSync(`dist/modules/${f}.html`,'utf8'),
    {runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
  console.log(`  ${f.padEnd(24)} ${String(Date.now()-t0).padStart(5)} ms to parse + run every tool`);
  dom.window.close();
}
