const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/db-shots';
const BASE = 'http://127.0.0.1:8765/.claude/worktrees/fix-studio-themes';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const studio = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await studio.goto(BASE + '/studio.html');
  await studio.waitForTimeout(800);
  const keys = await studio.evaluate(() => Object.keys(DB.THEMES));
  console.log('themes', keys);
  for (const k of keys) {
    await studio.selectOption('#themeSel', 'b:' + k);
    await studio.waitForTimeout(600);
    const html = await studio.evaluate(() => document.querySelector('#preview').srcdoc);
    fs.writeFileSync(`/home/user/daily-bread/.claude/worktrees/fix-studio-themes/tmp-${k}.html`, html);
    const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(`${BASE}/tmp-${k}.html`);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${k}-full.png`, fullPage: true });
    for (const sel of ['.signoff', '.stamp.free', '.scribble', '.sticker', '.stamp']) {
      const el = await p.$(sel); if (!el) { console.log('missing', k, sel); continue; } await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
      const box = await el.boundingBox();
      await p.screenshot({ path: `${OUT}/${k}-${sel.replace(/[^a-z]/g,'')}.png`,
        clip: { x: Math.max(0, box.x - 60), y: Math.max(0, box.y - 60), width: box.width + 120, height: box.height + 120 } });
      console.log(k, sel, JSON.stringify(box));
    }
    await p.close();
  }
  await b.close();
})();
