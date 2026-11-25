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
const { press, products, geometry } = require("./render.js");

const ROOT = path.resolve(__dirname, "..", "..");
const DB = require(path.join(ROOT, "db.js"));
const { TEXT_SCALE, NO_FLOW } = require(path.join(ROOT, "db-print.js"));   // the one body scale, and the pages scaled whole
const ok = [], bad = [];
const check = (name, cond, extra) => (cond ? ok : bad).push(name + (extra != null ? " — " + extra : ""));
const near = (a, b, t = 0.6) => Math.abs(a - b) <= t;
const CREEP_TOL_PT = 0.05;       // finer than one sheet's creep (0.1 mm = 0.28 pt)
const DEFAULT_PAPER_MM = 0.1;    // db.js print.paper: 100 gsm uncoated
const ODD_PAGES = 46;            // a book two pages short of a multiple of four

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
    // The book as it folds, worked out here and not taken from the press:
    // sheet s from the outside carries pages 2s+1, 2s+2 and their mirrors.
    // Its outer side is N-2s | 2s+1, its inner side 2s+2 | N-2s-1.
    const ps = info.printerSides || [], book = [];
    for (let s = 0; s < printed / 4; s++) {
      book.push([printed - 2 * s, 2 * s + 1], [2 * s + 2, printed - 2 * s - 1]);
    }
    check("…in saddle-stitch order: each folded sheet nests inside the one before", ps.length === spreads &&
      JSON.stringify(ps) === JSON.stringify(book), ps.slice(0, 3).map(s => s.join("|")).join(" "));
    const drawn = pp.reduce((sum, p) => sum + p.node.Resources().lookup(PDFName.of("XObject")).keys().length, 0);
    check("…every page drawn once, the spares left blank", drawn === n, `${drawn} of ${n} pages`);

    // What each sheet really draws. A page is a form XObject; its content
    // stream is the same bytes in printer-pages.pdf, where page j is printed
    // page j. So a form's fingerprint names its page. Its BBox says which edge
    // lost its bleed, and the cm before its Do says where it sits:
    //   left  page: BBox [0 0 b+tw-d …], drawn at x = slug + d
    //   right page: BBox [b+d 0 …],      drawn at x = slug + b + tw
    // d is the creep: sheet i from the outside (0 = the cover's) moves its
    // pages i × the paper's thickness toward the spine, cut at the fold.
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
        const d = Math.floor(k / 2) * g.creep, fine = (a, c) => near(a, c, CREEP_TOL_PT);
        const isLeft = fine(box[0], 0) && fine(box[2], g.b + g.tw - d);
        const isRight = fine(box[0], g.b + d) && fine(box[2], g.tw + 2 * g.b);
        const want = isLeft ? L : isRight ? R : null;
        const x = xAt(text, f.name), wantX = isLeft ? slug + d : slug + g.b + g.tw;
        if (want === null || pageOf.get(fp(f.st)) !== want || !fine(x, wantX)) {
          wrong.push(`sheet ${k + 1}: page ${pageOf.get(fp(f.st))} as ${isLeft ? "left" : isRight ? "right" : "?"} at x ${x.toFixed(1)}, want ${want} at ${wantX.toFixed(1)}`);
        }
      }
    });
    check("…each sheet draws its two pages, left and right, cut at the fold", pageOf.size === n && !wrong.length,
      wrong.slice(0, 3).join("; ") || `${ps.length} sheets`);
    const MM = 72 / 25.4, folded = spreads / 2;
    check("…with creep: the centre spread sits (sheets - 1) × the paper's thickness nearer the spine",
      near(g.creep, DEFAULT_PAPER_MM * MM, CREEP_TOL_PT) && !wrong.length,
      `${(g.creep / MM).toFixed(2)} mm paper, centre moved ${((folded - 1) * g.creep / MM).toFixed(2)} mm over ${folded} sheets`);

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

    // the home booklet nests too. Side j's left page is cut at the fold (its
    // right edge) and its right page at the fold (its left edge) by the
    // sheet's creep in paper millimetres: the sheet prints at scale k, so the
    // cut in page units is creep / k. Each page sits flush at the fold.
    const kB = info.booklet.scale, foldX = 792 / 2;
    const bookletOff = booklet.getPages().map((p, j) => {
      const c = Math.floor(j / 2) * g.creep / kB, text = ops(booklet, p), fine = (a, v) => near(a, v, CREEP_TOL_PT);
      const [L, R] = ps[j];
      const forms = formsOf(booklet, p).map(f => ({ box: f.st.dict.lookup(PDFName.of("BBox")).asArray().map(v => v.asNumber()), x: xAt(text, f.name) }));
      const left = forms.find(f => f.x < foldX), right = forms.find(f => f.x >= foldX);
      const okL = !!left && fine(left.box[0], g.b) && fine(left.box[2], g.b + g.tw - c) && fine(left.x, foldX - (g.tw - c) * kB);
      const okR = !!right && fine(right.box[0], g.b + c) && fine(right.box[2], g.b + g.tw) && fine(right.x, foldX);
      const spare = P => P >= n && P < printed;   // the spares sit just before the back cover
      const good = forms.length === 2 - spare(L) - spare(R) && (spare(L) || okL) && (spare(R) || okR);
      return good ? null : `side ${j + 1} (${forms.length} pages)`;
    }).filter(Boolean);
    check("booklet.pdf: the same creep, each page cut at the fold, sheet by sheet", !bookletOff.length,
      bookletOff.slice(0, 3).join(", ") || `${booklet.getPageCount()} sides`);

    // a Paper thickness a person might type: bare numbers are millimetres, a
    // comma is a decimal point, and anything else means no creep, never a failed press
    const paper = v => geometry({ ...model, print: { ...model.print, paper: v } }).creep / MM;
    const typed = [["0", 0], ["0.1", 0.1], ["0,1mm", 0.1], ["0.004in", 0.1016], ["thin", 0], ["", 0.1], [".", 0], ["..", 0]];
    const misread = typed.filter(([v, want]) => { try { return !near(paper(v), want, 0.001); } catch (e) { return true; } });
    check("a typed Paper thickness never stops the press", !misread.length, misread.map(([v]) => JSON.stringify(v)).join(", ") || typed.length + " forms");

    // the back cover is the last page, as a saddle-stitched magazine has it
    const lastIsBack = info.sheets[n - 1].key === "footer" && info.printedPages === printed &&
      (await PDFDocument.load(fs.readFileSync(info.files.print))).getPage(printed - 1).node.Contents() != null;
    check("the back cover is the last printed page; spare pages go before it", lastIsBack, `${info.spare} spare of ${printed}`);

    // Spare pages, on a book that needs them: the edition above has none. Each
    // made-up page draws a mark, so a blank page in the output is a spare.
    // 46 pages: spares are printed pages 46 and 47, the back cover is 48.
    const odd = await PDFDocument.create();
    for (let i = 0; i < ODD_PAGES; i++) {
      odd.addPage([g.tw + 2 * g.b, g.th + 2 * g.b]).drawRectangle({ x: g.b, y: g.b, width: i + 1, height: 1 });
    }
    const made = await products(await odd.save(), g, "spares", new Set(["print", "printer", "booklet"]));
    const formsOn = p => {
      const xo = p.node.Resources() && p.node.Resources().lookup(PDFName.of("XObject"));
      return xo ? xo.keys().length : 0;
    };
    const oddPrint = await PDFDocument.load(made.print);
    const blank = oddPrint.getPages().map((p, i) => formsOn(p) ? -1 : i).filter(i => i >= 0);
    check(`a ${ODD_PAGES}-page book gets two spare pages, just before the back cover`,
      oddPrint.getPageCount() === ODD_PAGES + 2 && JSON.stringify(blank) === JSON.stringify([ODD_PAGES - 1, ODD_PAGES]),
      `blank: ${blank.map(i => i + 1).join(", ")} of ${oddPrint.getPageCount()}`);

    // The sides that carry them are 2|47 and 46|3. Each draws one page, and on
    // the right half: page 2 on the left of its side, page 3 on the right.
    // (Spares at 2 and 3 would draw one page on those sides too, on the wrong half.)
    const halfOf = (doc, p) => {
      const f = formsOf(doc, p);
      return f.length === 1 ? (xAt(ops(doc, p), f[0].name) < p.getWidth() / 2 ? "left" : "right") : "";
    };
    for (const [what, bytes] of [["printer's spreads", made.printer], ["booklet", made.booklet]]) {
      const doc = await PDFDocument.load(bytes), sides = doc.getPages(), forms = sides.map(formsOn);
      const halves = [halfOf(doc, sides[1]), halfOf(doc, sides[2])];
      check(`…and the ${what} leave those two pages blank`, forms.length === (ODD_PAGES + 2) / 2 &&
        forms.reduce((a, b) => a + b, 0) === ODD_PAGES && halves.join() === "left,right",
        `${forms.length} sides; 2|47 draws ${halves[0] || "?"}, 46|3 draws ${halves[1] || "?"}`);
    }

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
