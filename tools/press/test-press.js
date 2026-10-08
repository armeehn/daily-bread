#!/usr/bin/env node
/**
 * test-press.js — the press makes the Web PDF's pages, and makes them properly.
 *
 *   cd tools/press && npm test
 *
 * (1) The studio's Web PDF and the press lay the default edition out on the same
 *     sheets: same order, same sections, same scale. One renderer, no drift.
 * (2) print.pdf is those pages cut to the trim; printer.pdf puts each on trim +
 *     bleed + slug with /TrimBox and /BleedBox where the trim and bleed are;
 *     booklet.pdf imposes them two to a Letter side in saddle-stitch order.
 * (3) Every face the magazine declares is loaded, from assets/fonts/.
 * (4) Two renders with SOURCE_DATE_EPOCH set are byte-identical.
 */
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { PDFDocument } = require("pdf-lib");
const { press, geometry } = require("./render.js");

const ROOT = path.resolve(__dirname, "..", "..");
const DB = require(path.join(ROOT, "db.js"));
const ok = [], bad = [];
const check = (name, cond, extra) => (cond ? ok : bad).push(name + (extra != null ? " — " + extra : ""));
const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;

(async () => {
  process.env.SOURCE_DATE_EPOCH = "0";
  const model = DB.clone(DB.DEFAULT_MODEL);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "db-press-test-"));
  const browser = await chromium.launch();
  try {
    /* ---- (1) the studio's Web PDF sheets ---- */
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
      const f = path.join(ROOT, rel);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      const ext = path.extname(f);
      res.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" }[ext] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    });
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/studio.html`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => typeof buildPrintFrame === "function");
    const { studio, cover } = await page.evaluate(async () => {
      const { frame, sheets } = await buildPrintFrame();
      const out = sheets.map(s => ({ key: s.key, label: s.label, scale: +s.scale.toFixed(3) }));
      // the cover art's sheet: how much of it the picture covers, and whether the masthead kept an inset
      const d = frame.contentDocument, sheet = d.querySelector(".pp-sheet"), img = sheet && sheet.querySelector("img");
      const s = sheet.getBoundingClientRect(), r = img ? img.getBoundingClientRect() : { left: 1e9, top: 1e9, right: 0, bottom: 0 };
      const cover = { full: r.left <= s.left + 0.5 && r.top <= s.top + 0.5 && r.right >= s.right - 0.5 && r.bottom >= s.bottom - 0.5,
                      alone: sheet.querySelectorAll("img").length === 1 &&
                             sheet.textContent.trim() === (sheet.querySelector(".free") || {}).textContent,
                      inset: !!d.querySelector(".pp-sheet .hero .cover-frame"),
                      stamp: (() => { const f = sheet.querySelector(".free"); if (!f) { return false; }
                        const b = f.getBoundingClientRect(), bl = parseFloat(getComputedStyle(d.querySelector(".pp-sheet:not(.pp-full)")).paddingLeft);
                        return b.left >= s.left + bl && b.top >= s.top + bl && b.right <= s.right - bl && b.bottom <= s.bottom - bl; })() };
      frame.remove();
      return { studio: out, cover };
    });
    await page.close();
    server.close();

    const info = await press(model, tmp, { browser });
    const pressed = info.sheets.map(s => ({ key: s.key, label: s.label, scale: +s.scale.toFixed(3) }));
    check("the press lays out the same sheets as the studio's Web PDF",
      JSON.stringify(studio.map(s => s.key + " " + s.label)) === JSON.stringify(pressed.map(s => s.key + " " + s.label)),
      pressed.length + " sheets");
    const off = studio.map((s, i) => pressed[i] && Math.abs(s.scale - pressed[i].scale) > 0.01 ? `${s.label} ${s.scale}/${pressed[i].scale}` : null).filter(Boolean);
    check("…at the same scales", !off.length, off.join(", ") || "all within 0.01");
    check("the cover art is the first page, on its own, then the masthead",
      pressed[0] && pressed[0].key === "cover" && pressed[1] && pressed[1].key === "hero" && cover.alone,
      pressed.slice(0, 2).map(s => s.label).join(", "));
    check("…edge to edge: the picture fills the trim and the bleed", cover.full);
    check("…and the masthead page no longer carries an inset of it", !cover.inset);
    check("…with the price stamp on the cover, inside the trim", cover.stamp);
    check("text pages never print larger than the magazine's one text size",
      info.sheets.filter(s => !/^(cover|hero|footer|comics|art|stickers)$/.test(s.key)).every(s => s.scale <= 0.8 + 1e-6));

    /* ---- (2) the products ---- */
    const g = geometry(model), n = info.pages;
    const load = async f => PDFDocument.load(fs.readFileSync(info.files[f]));
    const sheets = await load("sheets"), print = await load("print"), printer = await load("printer"), booklet = await load("booklet");
    const [sw, sh] = sheets.getPage(0).getSize().width !== undefined ? [sheets.getPage(0).getWidth(), sheets.getPage(0).getHeight()] : [0, 0];
    check("the sheets are the trim plus bleed", near(sw, g.tw + 2 * g.b) && near(sh, g.th + 2 * g.b), `${sw.toFixed(1)} x ${sh.toFixed(1)} pt`);
    const printed = Math.ceil(n / 4) * 4;
    check("print.pdf is every sheet cut to the trim, padded to a multiple of four before the back cover", print.getPageCount() === printed &&
      print.getPages().every(p => near(p.getWidth(), g.tw) && near(p.getHeight(), g.th)), `${print.getPageCount()} pages`);
    const slug = 5 * 72 / 25.4;
    const pp = printer.getPages();
    const trimOk = pp.every(p => { const t = p.getTrimBox(); return near(t.x, slug + g.b) && near(t.width, g.tw) && near(t.height, g.th); });
    const bleedOk = pp.every(p => { const b = p.getBleedBox(); return near(b.x, slug) && near(b.width, g.tw + 2 * g.b); });
    check("printer.pdf: every page on trim + bleed + slug", printer.getPageCount() === printed &&
      pp.every(p => near(p.getWidth(), g.tw + 2 * (g.b + slug))), `${pp[0].getWidth().toFixed(1)} pt wide`);
    check("…with its TrimBox on the trim", trimOk);
    check("…and its BleedBox on the bleed", bleedOk);
    const sides = Math.ceil(n / 4) * 2;
    check("booklet.pdf: two pages to a Letter-landscape side, a multiple of four pages",
      booklet.getPageCount() === sides && booklet.getPages().every(p => near(p.getWidth(), 792) && near(p.getHeight(), 612)),
      `${booklet.getPageCount()} sides for ${n} pages`);

    // the back cover is the last page, as a saddle-stitched magazine has it
    const lastIsBack = info.sheets[n - 1].key === "footer" && info.printedPages === printed &&
      (await PDFDocument.load(fs.readFileSync(info.files.print))).getPage(printed - 1).node.Contents() != null;
    check("the back cover is the last printed page; spare pages go before it", lastIsBack, `${info.spare} spare of ${printed}`);

    /* ---- (3) fonts ---- */
    check("every face the magazine declares is loaded", !info.fontsMissing.length, info.fontsMissing.join(", ") || "all");
    const { PDFName, PDFDict } = require("pdf-lib");
    const faces = new Set();
    for (const [, obj] of sheets.context.enumerateIndirectObjects()) {
      if (obj instanceof PDFDict && obj.get(PDFName.of("Type")) === PDFName.of("Font")) {
        const bf = obj.get(PDFName.of("BaseFont"));
        if (bf) faces.add(bf.toString().replace(/^\/(?:[A-Z]{6}\+)?/, "").replace(/[-,].*$/, ""));
      }
    }
    const foreign = [...faces].filter(f => !/^(IBMPlexMono|Caveat|UnifrakturMaguntia|DBSymbols)$/.test(f));
    check("the PDF carries only the magazine's faces", faces.size > 0 && !foreign.length, [...faces].join(", "));

    /* ---- (4) determinism ---- */
    const again = await press(model, path.join(tmp, "again"), { browser });
    const same = ["sheets", "print", "printer", "booklet"].filter(k =>
      Buffer.compare(fs.readFileSync(info.files[k]), fs.readFileSync(again.files[k])) === 0);
    check("two renders are byte-identical", same.length === 4, same.join(", "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  for (const l of ok) console.log("  ✓ " + l);
  for (const l of bad) console.log("  ✗ " + l);
  console.log(`press: ${ok.length} pass, ${bad.length} fail`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
