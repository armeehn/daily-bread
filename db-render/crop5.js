const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  for (const k of ['night-shift','orchard']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(`http://127.0.0.1:8765/.claude/worktrees/fix-studio-themes/tmp-${k}.html`); await p.waitForTimeout(1200);
    for (const [n, sel] of [['contents','#contents'],['stickers','#stickers .sticker-grid'],['lab','#lab']]) {
      const el = await p.$(sel); if (!el) { console.log('missing', sel); continue; }
      await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
      await p.screenshot({ path: `/tmp/db-shots/v3-${k}-${n}.png` });
    }
    await p.close();
  }
  await b.close();
})();
