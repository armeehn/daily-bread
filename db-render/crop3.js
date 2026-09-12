const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const s = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await s.goto('http://127.0.0.1:8765/studio.html'); await s.waitForTimeout(1500);
  await s.screenshot({ path: '/tmp/db-shots/studio-ui.png' });
  await s.close();
  for (const w of [390, 760]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
    await p.goto('http://127.0.0.1:8765/tmp-kelowna.html'); await p.waitForTimeout(1200);
    for (const [n, sel] of [['hero','.cover-wrap'],['signoff','.letter .signoff'],['scribble','#history .annot'],['submit','#submit .annot'],['stickers','#stickers .sticker-grid']]) {
      const el = await p.$(sel); if (!el) { console.log('missing', sel); continue; }
      await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
      const box = await el.boundingBox();
      const y = Math.max(0, box.y - 80), h = Math.min(900 - y, box.height + 160);
      await p.screenshot({ path: `/tmp/db-shots/n${w}-${n}.png`, clip: { x: 0, y, width: w, height: h } });
    }
    await p.close();
  }
  await b.close();
})();
