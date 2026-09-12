const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  for (const k of ['night-shift','kelowna']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(`http://127.0.0.1:8765/.claude/worktrees/fix-studio-themes/tmp-${k}.html`); await p.waitForTimeout(1200);
    await p.screenshot({ path: `/tmp/db-shots/v2-${k}-hero.png` });
    for (const [n, sel] of [['foot','footer'],['wall','.centrefold'],['stickers','#stickers .sticker-grid'],['letter','.letter .signoff'],['lab','#lab']]) {
      const el = await p.$(sel); if (!el) { console.log('missing', sel); continue; }
      await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
      await p.screenshot({ path: `/tmp/db-shots/v2-${k}-${n}.png` });
    }
    await p.close();
  }
  await b.close();
})();
