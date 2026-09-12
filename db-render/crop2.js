const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('http://127.0.0.1:8765/tmp-kelowna.html'); await p.waitForTimeout(1200);
  for (const [n, sel] of [['stickers','#stickers .sticker-grid'],['letterfoot','.letter .signoff'],['submit','#submit'],['history','#history .annot']]) {
    const el = await p.$(sel); if (!el) { console.log('missing', sel); continue; }
    await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
    const box = await el.boundingBox();
    await p.screenshot({ path: `/tmp/db-shots/z-${n}.png`, clip: { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 120), width: Math.min(1280, box.width + 80), height: Math.min(900, box.height + 200) } });
  }
  await b.close();
})();
