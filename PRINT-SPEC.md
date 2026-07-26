# Daily Bread `.dc.html` → PDF — Render Instructions (agent handoff)

These instructions reproduce a verified pipeline that exports the Daily Bread magazine kit (`*.dc.html` files + `support.js`) to a print-ready PDF via headless Chromium. It was validated on both layouts in the kit — `Daily Bread Issue 01 v2-booklet.dc.html` (24 A4-landscape sides) and `Daily Bread Issue 01 v2-print.dc.html` (48 A5 pages) — and it scales to any page count without modification. Follow it exactly; every step exists because skipping it produced a broken export.

## 0. How the kit works (read this first)

Each `*.dc.html` file is not static HTML. `support.js` is a client-side runtime that loads React (+ ReactDOM, Babel standalone) from unpkg, fetches sibling component files by name (`<dc-import name="DB Cover">` → `./DB%20Cover.dc.html`), compiles them, and mounts everything into a `#dc-root` element. The visible document only exists after that async boot completes. Consequences:

1. **You must serve the whole folder over HTTP.** `file://` breaks the sibling `fetch()` calls. Keep all files siblings, exactly as unzipped (`support.js`, `doc-page.js`, `image-slot.js`, `logo.svg`, `uploads/`, all `DB *.dc.html` components, and the issue file you're rendering).
2. **You must wait for readiness before export.** "Load event fired" or `networkidle` is NOT sufficient — components mount for several seconds afterward. Export criteria (all must hold): `#dc-root` exists; every `[data-sheet]` is mounted; zero `.sc-placeholder` elements remain; zero `.sc-placeholder-error` elements; every `<img>` is `complete` with `naturalWidth > 0`; and `document.fonts.check()` passes for `16px "IBM Plex Mono"`, `600 16px Caveat`, and `16px UnifrakturMaguntia`.
3. **The kit's own print CSS has three bugs in Chromium** that must be patched at export time (section 3). Without the patch you get pages that collapse to content height (some to 0px — the front cover renders blank), dark background bleeding into page margins, and ~10px clipped off the bottom of the first sheet.

## 1. Serve the folder

```bash
cd <kit-folder>
python3 -m http.server 8471 &
# sanity: curl -s -o /dev/null -w "%{http_code}" "http://localhost:8471/Daily%20Bread%20Issue%2001%20v2-booklet.dc.html"  → 200
```

A harmless `GET /.image-slots.state.json → 404` will appear in the server log; ignore it (optional editor state file).

## 2. CDN dependencies — try direct, vendor if blocked

The runtime loads from `unpkg.com` (react@18.3.1 UMD, react-dom@18.3.1 UMD, @babel/standalone@7.29.0) and `fonts.googleapis.com` (IBM Plex Mono 400/500/600/700 + italics 400/600, Caveat 600/700, UnifrakturMaguntia 400). If your environment can reach those hosts from the *browser*, skip this section.

If browser requests to those hosts fail (in my sandbox they died with `ERR_TUNNEL_CONNECTION_FAILED` while npm still worked), vendor everything from npm and serve it via request interception:

```bash
mkdir deps && cd deps && npm init -y
npm install react@18.3.1 react-dom@18.3.1 @babel/standalone@7.29.0 \
  @fontsource/ibm-plex-mono @fontsource/caveat @fontsource/unifrakturmaguntia
mkdir -p <kit-folder>/vendor/files
cp node_modules/react/umd/react.production.min.js \
   node_modules/react-dom/umd/react-dom.production.min.js \
   node_modules/@babel/standalone/babel.min.js  <kit-folder>/vendor/
```

Build `vendor/fonts.css` by concatenating these @fontsource per-weight CSS files (they include every subset with correct `unicode-range` — keep the cyrillic subsets, the `№` glyph U+2116 needs them): `ibm-plex-mono/{400,500,600,700,400-italic,600-italic}.css`, `caveat/{600,700}.css`, `unifrakturmaguntia/400.css`. Copy every `./files/*.woff2` and `*.woff` they reference into `vendor/files/`, and rewrite `./files/` → `/vendor/files/` in the concatenated CSS.

**Trap:** even after interception, font URLs inside the stylesheet resolve relative to the *original* googleapis URL, so the browser requests `https://fonts.googleapis.com/vendor/files/*.woff2`. The render script below intercepts those too. Don't fight this by editing the HTML — interception keeps the kit files pristine.

## 3. The print-fix CSS patch (mandatory)

Inject this as the LAST stylesheet (`page.addStyleTag`) after render is ready, immediately before `page.pdf()`:

```css
@media print{
  html,body{background:#fff!important}
  #dc-root>.sc-host>div{padding:0!important}
  [data-sheet] .sc-host{height:794px!important;min-height:794px!important;max-height:794px!important}
  [data-sheet] .sc-host>div{height:794px!important;min-height:794px!important;max-height:794px!important;overflow:hidden!important}
}
```

Why each line exists:

1. `html,body` white — the runtime injects a late `html,body{background:#2a2723}` style that outranks the kit's own `@media print{body{background:#fff}}`, so page margins print dark without this.
2. `padding:0` — the outer container's inline `padding:24px 0` makes sheet 1 start at 37px (24 + 13px print margin); 37 + 767 = 804px > the 793.7px A4-landscape page, clipping the first sheet's bottom.
3./4. The 794px height locks — every `<dc-import>` mounts inside its own `.sc-host` wrapper, and the kit's print reset `.sc-host>div{height:auto!important;min-height:0!important}` (meant only for the outer document host) collapses each page component's root `<div style="height:794px">` to content height — some pages to 0px. These higher-specificity rules restore the fixed A5 page height (all page components in this system are designed at exactly 561×794 px). The outer host stays `auto` because the selector only matches hosts inside `[data-sheet]`.

If future issues change the page-component design height, change `794px` accordingly — it is the only kit-specific number in the patch.

## 4. Export with `page.pdf()` — not screenshots

Use Chromium's PDF printer, not element screenshots: text stays vector (fonts embed as subsets), `@page` sizes are honored exactly, `break-after:page` gives you one sheet per page, and the file is print-shop usable. Export settings that matter:

```js
await page.pdf({ path: out, printBackground: true, preferCSSPageSize: true,
                 margin: { top: 0, right: 0, bottom: 0, left: 0 } });
```

`printBackground:true` (full-bleed panels and checker strips are backgrounds), `preferCSSPageSize:true` (booklet declares `@page{size:297mm 210mm}` A4 landscape; sequential declares `148mm 210mm` A5), zero margins. Do not pass `scale`, `format`, `width`, or `height`.

If your tool can *only* do screenshots: apply the identical serve/wait/patch steps, use `page.emulateMedia({media:'print'})`, screenshot each `[data-sheet]` element at `deviceScaleFactor: 2+`, and assemble with `img2pdf` at the exact page size. Expect rasterized (non-selectable, larger) output — last resort only.

## 5. The complete render script (validated)

Playwright signature trap baked in below: `waitForFunction(fn, {timeout})` silently passes your options object as the function *argument* and keeps the default 30s timeout — the polling loop below avoids the whole class of bug. Run with `NODE_PATH=$(npm root -g)` if playwright is installed globally.

```js
/**
 * render_dc_print.js — export a Daily Bread *.dc.html print/booklet layout to PDF.
 * Env: URL (required, http:// only), OUT (required),
 *      SHEETS (optional expected page count; else auto-detects via stability),
 *      VENDOR (optional vendored-CDN dir; omit to load CDNs directly),
 *      PATCH_CSS (optional override of the built-in print-fix CSS).
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
      // fonts.css URLs resolve relative to the googleapis stylesheet URL
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

  // readiness wait — sheets mounted, no placeholders, images decoded, fonts live
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
      if (expected > 0) { stable = 3; break; }
      stable = (last.sheets === prevSheets) ? stable + 1 : 1;
      prevSheets = last.sheets;
      if (stable >= 3) break;
    } else { stable = 0; prevSheets = -1; }
    await page.waitForTimeout(1200);
  }
  if (stable < 3) {
    console.error('NOT READY:', JSON.stringify(last), '\nconsole:', JSON.stringify(consoleMsgs.slice(0, 20)));
    process.exit(1);
  }
  const errs = await page.evaluate(() => document.querySelectorAll('.sc-placeholder-error').length);
  if (errs > 0) { console.error(errs + ' component(s) failed to load'); process.exit(1); }

  // mandatory print-fix patch — see instructions section 3
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
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  console.log('wrote', process.env.OUT);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
```

Invocation:

```bash
NODE_PATH=$(npm root -g) \
URL="http://localhost:8471/Daily%20Bread%20Issue%2001%20v2-booklet.dc.html" \
OUT="booklet.pdf" VENDOR="<kit-folder>/vendor" node render_dc_print.js
```

## 6. Adding pages (the "more pages" part)

The pipeline is page-count agnostic — it counts `[data-sheet]` elements at runtime, waits for the count to stabilize, and Chromium emits one PDF page per sheet via `break-after:page`. When you add pages, pass `SHEETS=<expected count>` so the script asserts completeness instead of trusting stability. Two layouts, two editing recipes:

### Sequential proof (`…v2-print.dc.html` style, one A5 page per sheet)

Append one note + sheet block per page, anywhere in the sheet sequence:

```html
<div data-note style="color:#8d857a;font-size:10px;letter-spacing:.16em;text-align:center;margin:0 auto 8px;font-family:ui-monospace,monospace">P49 · 45</div>
<div data-sheet style="width:561px;height:794px;margin:0 auto 24px;position:relative;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5)"><dc-import name="DB Body" slug="v2-p45" folio="45" hint-size="561px,794px"></dc-import></div>
```

Any count works. Every page component must be designed at 561×794 px (the kit's A5 grid). Reuse the existing `DB *` components with new props (`variant`, `slug`, `folio`, `title`, `body`, …) — see how the existing 48 imports parameterize them.

### Saddle-stitch booklet (`…v2-booklet.dc.html` style, two pages per side)

Total logical page count N **must be divisible by 4** (each physical sheet carries 4 pages); pad with blanks or a second insert if needed. Number pages 1..N in reading order (1 = front cover, 2 = inside front cover, …, N−1 = inside back cover, N = back cover). For sheet `i` of `S = N/4`:

```
FRONT: left = page N−2i+2, right = page 2i−1
BACK:  left = page 2i,     right = page N−2i+1
```

Check against the kit (N=48): sheet 1 front = 48|1 = BC|FC, back = 2|47 = IC|IBC; sheet 2 front = 46|3 = "44|01" in the kit's folio labels — matches the shipped file. Emit the sheets in order S01-FRONT, S01-BACK, S02-FRONT, … Each side is one block (this is sheet 2 front verbatim from the kit — copy it and swap the two `dc-import`s and the note label):

```html
<div data-note style="color:#8d857a;font-size:10px;letter-spacing:.16em;text-align:center;margin:0 auto 8px;font-family:ui-monospace,monospace">SHEET 02 · FRONT — LEFT: 44 · RIGHT: 01</div>
<div data-sheet style="width:1122px;height:767px;margin:0 auto 24px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5);background:#fff;position:relative"><div style="width:1162px;height:794px;transform:scale(0.96558);transform-origin:top left;display:flex;gap:40px;position:relative"><div style="width:561px;height:794px;overflow:hidden;position:relative;flex:none"><dc-import name="DB Colophon" slug="v2-p44" doc-no="DB-044-A" folio="44" hint-size="561px,794px"></dc-import></div><div style="width:561px;height:794px;overflow:hidden;position:relative;flex:none"><dc-import name="DB Letter" folio="01" hint-size="561px,794px"></dc-import></div><div style="position:absolute;left:581px;top:0;bottom:0;border-left:1px dashed #b9b2a6;pointer-events:none"></div><div style="position:absolute;left:581px;top:4px;transform:translateX(-50%);font-size:7px;letter-spacing:.14em;color:#b9b2a6;pointer-events:none">▼FOLD</div></div></div>
```

Geometry, so you don't have to reverse-engineer it: two 561×794 panels + 40px fold gutter = 1162×794, pre-scaled by 0.96558 into the 1122×767 sheet, which fits A4 landscape (1122.5×793.7 px) with the 13px print top margin. Don't change these numbers. `data-note` banners are screen-only (hidden in print) — keep them updated anyway; they're the human-readable imposition map.

New sheet count for the script: sequential SHEETS = N; booklet SHEETS = N/2 (sides).

## 7. Verify before shipping

```bash
pdfinfo out.pdf              # page count (24/48/…), size: 841.92×594.96 pts booklet, 420×594.96 sequential
pdffonts out.pdf             # every row: emb=yes (DejaVu rows are fallback glyphs like ✗/⚑ — fine)
pdftoppm -png -r 72 out.pdf pg   # rasterize and actually LOOK at every page
```

Failure signatures from this session, so you recognize them instantly: content collapsed to the top of pages / blank front cover → patch rule 3/4 missing. Dark strips in margins → patch rule 1 missing. Bottom of sheet 1 clipped → patch rule 2 missing. Wrong page count → readiness wait failed or a `dc-import` name doesn't match a sibling file (check console for `[dc-runtime] sibling fetch failed`). Boxy/wrong glyphs → a `document.fonts.check()` family was skipped or the vendored fonts.css lost subsets. Dashed "photo — …" boxes are intentional placeholder slots in the kit, not bugs.

Optional finishing touches: set metadata with pypdf (`/Title` etc.) and `qpdf --linearize in.pdf out.pdf`.

Physical print settings for the booklet PDF (unchanged from the kit's banner): A4 at 100% — or US Letter with fit-to-page — double-sided **flipped on the short edge**, stack in order, fold on the dashed line, two staples on the fold.
