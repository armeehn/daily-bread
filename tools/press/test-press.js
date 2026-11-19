#!/usr/bin/env node
/**
 * test-press.js — the press makes the Web PDF's pages, and makes them properly.
 *
 *   cd tools/press && npm test
 *
 * (1) The studio's Web PDF and the press lay the default edition out on the same
 *     sheets: same order, same sections, same scale. One renderer, no drift.
 * (2) print.pdf is those pages cut to the trim; printer.pdf imposes them as
 *     printer's spreads (two to a sheet, saddle-stitch order) on trim + bleed +
 *     slug with /TrimBox and /BleedBox on the spread; printer-pages.pdf puts each
 *     page on its own sheet the same way; booklet.pdf imposes them two to a
 *     Letter side in saddle-stitch order.
 * (3) Every face the magazine declares is loaded, from assets/fonts/.
 * (4) Two renders with SOURCE_DATE_EPOCH set are byte-identical.
 */
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { PDFDocument, PDFName } = require("pdf-lib");
const { press, geometry } = require("./render.js");

const ROOT = path.resolve(__dirname, "..", "..");
const DB = require(path.join(ROOT, "db.js"));
const { TEXT_SCALE, NO_FLOW } = require(path.join(ROOT, "db-print.js"));   // the one body scale, and the pages scaled whole
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
    const { studio, cover, spill, cardSpill } = await page.evaluate(async () => {
      const { frame, sheets } = await buildPrintFrame();
      const out = sheets.map(s => ({ key: s.key, label: s.label, scale: +s.scale.toFixed(3) }));
      // the cover art's sheet: how much of it the picture covers, and whether the masthead kept an inset
      const d = frame.contentDocument, sheet = d.querySelector(".pp-sheet"), img = sheet && sheet.querySelector("img");
      const s = sheet.getBoundingClientRect(), r = img ? img.getBoundingClientRect() : { left: 1e9, top: 1e9, right: 0, bottom: 0 };
      const cover = { full: r.left <= s.left + 0.5 && r.top <= s.top + 0.5 && r.right >= s.right - 0.5 && r.bottom >= s.bottom - 0.5,
                      // the art, with only the price stamp and the issue on it
                      alone: sheet.querySelectorAll("img").length === 1 &&
                             sheet.textContent.replace(/\s+/g, "") === Array.from(sheet.querySelectorAll(".free, .pp-cover-issue")).map(e => e.textContent).join("").replace(/\s+/g, ""),
                      inset: !!d.querySelector(".pp-sheet .hero .cover-frame"),
                      stamp: (() => { const f = sheet.querySelector(".free"); if (!f) { return false; }
                        const b = f.getBoundingClientRect(), bl = parseFloat(getComputedStyle(d.querySelector(".pp-sheet:not(.pp-full)")).paddingLeft);
                        return b.left >= s.left + bl && b.top >= s.top + bl && b.right <= s.right - bl && b.bottom <= s.bottom - bl; })() };
      // anything printed past the trim is cut off: every visible box on a sheet
      // must sit inside it (the cover art alone is meant to bleed; the appendix
      // pages are full sheets too, but their ink stays on the trim)
      const spill = [], cardSpill = [];
      // what prints is ink: text, pictures, rules, a card's border or fill; a
      // section's own ground may run into the bleed
      const own = el => Array.from(el.childNodes).some(n => n.nodeType === 3 && /\S/.test(n.nodeValue));
      const ink = (el, cs) => own(el) || /^(IMG|SVG|CANVAS|HR|svg)$/.test(el.tagName) ||
        (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none") ||
        (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent" && !el.matches(".pp-fit > *"));
      d.querySelectorAll(".pp-sheet").forEach((sh, i) => {
        if (sh.querySelector(".pp-cover")) { return; }
        const r = sh.getBoundingClientRect(), b = parseFloat(getComputedStyle(sh).paddingLeft);
        const trim = { left: r.left + b, top: r.top + b, right: r.right - b, bottom: r.bottom - b };
        let worst = null;
        sh.querySelectorAll(".pp-fit *").forEach(el => {
          const e = el.getBoundingClientRect(), cs = getComputedStyle(el);
          if (!e.width || !e.height || cs.visibility === "hidden" || +cs.opacity === 0 || !ink(el, cs)) { return; }
          const over = Math.max(trim.left - e.left, trim.top - e.top, e.right - trim.right, e.bottom - trim.bottom);
          if (over > 1 && (!worst || over > worst.over)) {
            worst = { over: Math.round(over), el: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "") };
          }
        });
        if (worst) { spill.push(`${out[i] ? out[i].label : i} (${worst.el} +${worst.over}px)`); }
        // nor out of the card it is printed in
        sh.querySelectorAll(".card").forEach(card => {
          const c = card.getBoundingClientRect();
          const out2 = Array.from(card.querySelectorAll("*")).find(el => {
            const e = el.getBoundingClientRect(), cs = getComputedStyle(el);
            return e.width && own(el) && cs.visibility !== "hidden" && (e.right > c.right + 1 || e.left < c.left - 1 || e.bottom > c.bottom + 1);
          });
          if (out2) { cardSpill.push(`${out[i] ? out[i].label : i} (“${out2.textContent.trim().slice(0, 24)}”)`); }
        });
      });
      frame.remove();
      return { studio: out, cover, spill, cardSpill };
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
    check("nothing prints past the trim", !spill.length, spill.join("; ") || "every sheet");
    check("…nor out of the card it is printed in", !cardSpill.length, cardSpill.join("; ") || "every card");
    check("text pages never print larger than the magazine's one text size",
      info.sheets.filter(s => !NO_FLOW.test(s.key)).every(s => s.scale <= TEXT_SCALE + 1e-6));

    /* ---- (2) the products ---- */
    const g = geometry(model), n = info.pages;
    const load = async f => PDFDocument.load(fs.readFileSync(info.files[f]));
    const sheets = await load("sheets"), print = await load("print"), printer = await load("printer"), booklet = await load("booklet");
    const singles = await load("printer-pages");
    const [sw, sh] = sheets.getPage(0).getSize().width !== undefined ? [sheets.getPage(0).getWidth(), sheets.getPage(0).getHeight()] : [0, 0];
    check("the sheets are the trim plus bleed", near(sw, g.tw + 2 * g.b) && near(sh, g.th + 2 * g.b), `${sw.toFixed(1)} x ${sh.toFixed(1)} pt`);
    const printed = Math.ceil(n / 4) * 4;
    check("print.pdf is every sheet cut to the trim, padded to a multiple of four before the back cover", print.getPageCount() === printed &&
      print.getPages().every(p => near(p.getWidth(), g.tw) && near(p.getHeight(), g.th)), `${print.getPageCount()} pages`);
    const slug = 5 * 72 / 25.4;

    // printer.pdf: printer's spreads. Side k of a saddle-stitched book of N
    // pages holds pages k and N-k+1, the even one on the left: 48|1, 2|47, …
    const pp = printer.getPages(), spreads = printed / 2;
    check("printer.pdf: printer's spreads, two pages to a sheet on trim + bleed + slug", printer.getPageCount() === spreads &&
      pp.every(p => near(p.getWidth(), 2 * g.tw + 2 * (g.b + slug)) && near(p.getHeight(), g.th + 2 * (g.b + slug))),
      `${printer.getPageCount()} sheets, ${pp[0].getWidth().toFixed(1)} pt wide`);
    check("…with its TrimBox on the spread's trim", pp.every(p => { const t = p.getTrimBox();
      return near(t.x, slug + g.b) && near(t.y, slug + g.b) && near(t.width, 2 * g.tw) && near(t.height, g.th); }));
    check("…and its BleedBox on the spread's bleed", pp.every(p => { const b = p.getBleedBox();
      return near(b.x, slug) && near(b.width, 2 * g.tw + 2 * g.b) && near(b.height, g.th + 2 * g.b); }));
    const ps = info.printerSides || [];
    check("…in saddle-stitch order: the back and front covers share the first sheet", ps.length === spreads &&
      ps[0][0] === printed && ps[0][1] === 1 && ps.every(([l, r]) => l + r === printed + 1 && l % 2 === 0),
      ps.slice(0, 3).map(s => s.join("|")).join(" "));
    const drawn = pp.reduce((sum, p) => sum + p.node.Resources().lookup(PDFName.of("XObject")).keys().length, 0);
    check("…every page drawn once, the spares left blank", drawn === n, `${drawn} of ${n} pages`);

    // What each sheet really draws. A page is a form XObject; its content
    // stream is the same bytes in printer-pages.pdf, where page j is printed
    // page j. So a form's fingerprint names its page. Its BBox says which edge
    // lost its bleed, and the cm before its Do says where it sits:
    //   left  page: BBox [0 0 b+tw …], drawn at x = slug
    //   right page: BBox [b 0 …],      drawn at x = slug + b + tw
    const crypto = require("crypto");
    const zlib = require("zlib");
    const fp = st => crypto.createHash("sha1").update(Buffer.from(st.getContents())).digest("hex");
    const formsOf = (doc, p) => {
      const xo = p.node.Resources().lookup(PDFName.of("XObject"));
      return xo ? xo.keys().map(k => ({ name: k.decodeText ? k.decodeText() : k.toString().slice(1), st: doc.context.lookup(xo.get(k)) })) : [];
    };
    const ops = (doc, p) => {
      const c = p.node.Contents(), parts = c.asArray ? c.asArray().map(r => doc.context.lookup(r)) : [c];
      return parts.map(st => {
        const raw = Buffer.from(st.getContents());
        return st.dict.get(PDFName.of("Filter")) ? zlib.inflateSync(raw).toString("latin1") : raw.toString("latin1");
      }).join("\n");
    };
    // pdf-lib draws a page as  q  1 0 0 1 x y cm  …  /Name Do  Q : the first cm of its block places it
    const xAt = (text, name) => {
      const block = text.split(/\bQ\b/).find(b => b.includes("/" + name + " Do"));
      const cm = block && block.match(/1 0 0 1 ([-\d.]+) ([-\d.]+) cm/);
      return cm ? +cm[1] : NaN;
    };
    const pageOf = new Map();
    singles.getPages().forEach((p, j) => formsOf(singles, p).forEach(f => pageOf.set(fp(f.st), j + 1)));
    const wrong = [];
    ps.forEach(([L, R], k) => {
      const text = ops(printer, pp[k]);
      for (const f of formsOf(printer, pp[k])) {
        const box = f.st.dict.lookup(PDFName.of("BBox")).asArray().map(v => v.asNumber());
        const isLeft = near(box[0], 0) && near(box[2], g.b + g.tw);
        const isRight = near(box[0], g.b) && near(box[2], g.tw + 2 * g.b);
        const want = isLeft ? L : isRight ? R : null;
        const x = xAt(text, f.name), wantX = isLeft ? slug : slug + g.b + g.tw;
        if (want === null || pageOf.get(fp(f.st)) !== want || !near(x, wantX)) {
          wrong.push(`sheet ${k + 1}: page ${pageOf.get(fp(f.st))} as ${isLeft ? "left" : isRight ? "right" : "?"} at x ${x.toFixed(1)}, want ${want} at ${wantX.toFixed(1)}`);
        }
      }
    });
    check("…each sheet draws its two pages, left and right, cut at the fold", pageOf.size === n && !wrong.length,
      wrong.slice(0, 3).join("; ") || `${ps.length} sheets`);

    // printer-pages.pdf: the same pages one to a sheet, for a shop that imposes them itself
    const sp = singles.getPages();
    check("printer-pages.pdf: every page on trim + bleed + slug", singles.getPageCount() === printed &&
      sp.every(p => near(p.getWidth(), g.tw + 2 * (g.b + slug))), `${sp[0].getWidth().toFixed(1)} pt wide`);
    check("…with its TrimBox on the trim", sp.every(p => { const t = p.getTrimBox(); return near(t.x, slug + g.b) && near(t.width, g.tw) && near(t.height, g.th); }));
    check("…and its BleedBox on the bleed", sp.every(p => { const b = p.getBleedBox(); return near(b.x, slug) && near(b.width, g.tw + 2 * g.b); }));
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
    const { PDFDict } = require("pdf-lib");
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
    const kinds = ["sheets", "print", "printer", "printer-pages", "booklet"];
    const same = kinds.filter(k =>
      Buffer.compare(fs.readFileSync(info.files[k]), fs.readFileSync(again.files[k])) === 0);
    check("two renders are byte-identical", same.length === kinds.length, same.join(", "));
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  for (const l of ok) console.log("  ✓ " + l);
  for (const l of bad) console.log("  ✗ " + l);
  console.log(`press: ${ok.length} pass, ${bad.length} fail`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
