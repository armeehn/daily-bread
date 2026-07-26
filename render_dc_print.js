/**
 * render_dc_print.js — export a Daily Bread *.dc.html print/booklet layout to PDF.
 *
 * Usage:
 *   URL="http://localhost:8471/Daily%20Bread%20Issue%2001%20v2-booklet.dc.html" \
 *   OUT="/path/out.pdf" node render_dc_print.js
 *
 * Env vars:
 *   URL         (required) page to render — MUST be served over http://, not file://
 *   OUT         (required) output PDF path
 *   SHEETS      (optional) expected number of [data-sheet] pages; if unset, the
 *               script waits until the count is stable across 3 consecutive polls
 *   VENDOR      (optional) dir with vendored CDN assets (react.production.min.js,
 *               react-dom.production.min.js, babel.min.js, fonts.css, files/*.woff2).
 *               If unset/missing, CDN requests go out directly.
 *   PATCH_CSS   (optional) replaces the built-in print-fix CSS.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const VENDOR = process.env.VENDOR || '';
const useVendor = VENDOR && fs.existsSync(VENDOR);
const CDN_MAP = [
  [/unpkg\.com\/react@[^/]+\/umd\/react\.production\.min\.js/, '/react.production.min.js', 'application/javascript'],
  [/unpkg\.com\/react-dom@[^/]+\/umd\/react-dom\.production\.min\.js/, '/react-dom.production.min.js', 'application/javascript'],
  [/unpkg\.com\/@babel\/standalone/, '/babel.min.js', 'application/javascript'],
  [/fonts\.googleapis\.com\/css2/, '/fonts.css', 'text/css'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const consoleMsgs = [];
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') consoleMsgs.push(t + ': ' + m.text()); });
  page.on('pageerror', e => consoleMsgs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => consoleMsgs.push('requestfailed: ' + r.url()));

  if (useVendor) {
    await page.route('**/*', route => {
      const u = route.request().url();
      for (const [re, file, type] of CDN_MAP) {
        if (re.test(u)) return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(VENDOR + file) });
      }
      // font files referenced by fonts.css resolve relative to the googleapis
      // stylesheet URL, so they come back to fonts.googleapis.com/<vendor path>
      const ff = u.match(/fonts\.googleapis\.com\/.*?\/files\/([\w.-]+\.(woff2?))$/);
      if (ff) {
        const p = VENDOR + '/files/' + ff[1];
        return fs.existsSync(p)
          ? route.fulfill({ status: 200, contentType: 'font/' + ff[2], body: fs.readFileSync(p) })
          : route.fulfill({ status: 404, body: '' });
      }
      if (/fonts\.gstatic\.com|unpkg\.com/.test(u)) return route.abort();
      return route.continue();
    });
  }

  await page.goto(process.env.URL, { waitUntil: 'networkidle', timeout: 90000 });

  // ---- readiness wait -------------------------------------------------------
  // The dc runtime fetches sibling *.dc.html components and mounts them with
  // React, so the DOM fills in asynchronously. Ready means: sheets mounted, no
  // pending .sc-placeholder, all <img> decoded, all three webfonts loaded.
  const expected = parseInt(process.env.SHEETS || '0', 10);
  const statusFn = (exp) => {
    const root = document.querySelector('#dc-root');
    if (!root) return { ok: false, why: 'no #dc-root yet' };
    const sheets = root.querySelectorAll('[data-sheet]').length;
    const ph = root.querySelectorAll('.sc-placeholder').length;
    const badImgs = Array.from(root.querySelectorAll('img'))
      .filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.src.slice(-60));
    const fontsOk = document.fonts.status === 'loaded'
      && document.fonts.check('16px "IBM Plex Mono"')
      && document.fonts.check('600 16px Caveat')
      && document.fonts.check('16px UnifrakturMaguntia');
    const ok = sheets > 0 && (exp === 0 || sheets >= exp) && ph === 0 && badImgs.length === 0 && fontsOk;
    return { ok, sheets, ph, badImgs: badImgs.slice(0, 5), fontsOk };
  };
  let last = null, stable = 0, prevSheets = -1;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    last = await page.evaluate(statusFn, expected);
    if (last.ok) {
      if (expected > 0) { stable = 3; break; }         // explicit count reached
      stable = (last.sheets === prevSheets) ? stable + 1 : 1;
      prevSheets = last.sheets;
      if (stable >= 3) break;                          // count stable across 3 polls
    } else { stable = 0; prevSheets = -1; }
    await page.waitForTimeout(1200);
  }
  if (stable < 3) {
    console.error('NOT READY:', JSON.stringify(last), '\nconsole:', JSON.stringify(consoleMsgs.slice(0, 20)));
    process.exit(1);
  }
  console.log('ready:', JSON.stringify(last));

  const errs = await page.evaluate(() => document.querySelectorAll('.sc-placeholder-error').length);
  if (errs > 0) { console.error(errs + ' component(s) failed to load'); process.exit(1); }

  // ---- print-fix patch, injected LAST so it wins the cascade ---------------
  // 1. the runtime injects a late `html,body{background:#2a2723}` style that
  //    defeats the kit's own @media print body{background:#fff} -> force white
  // 2. the kit's print reset `.sc-host>div{height:auto!important}` collapses
  //    every mounted page component (each dc-import mounts inside its own
  //    .sc-host wrapper) -> restore the fixed 794px page height inside sheets
  //    with a more specific !important rule
  // 3. the outer container's `padding:24px 0` pushes sheet 1 past the bottom
  //    page edge (24+13+767 > 793.7px) -> zero it in print
  const PATCH = process.env.PATCH_CSS || `
    @media print{
      html,body{background:#fff!important}
      #dc-root>.sc-host>div{padding:0!important}
      [data-sheet] .sc-host{height:794px!important;min-height:794px!important;max-height:794px!important}
      [data-sheet] .sc-host>div{height:794px!important;min-height:794px!important;max-height:794px!important;overflow:hidden!important}
    }`;
  await page.addStyleTag({ content: PATCH });

  await page.pdf({
    path: process.env.OUT,
    printBackground: true,          // full-bleed panels, checker strips, dark pages
    preferCSSPageSize: true,        // honor @page (A4 landscape / A5) from the kit
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  console.log('wrote', process.env.OUT);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
