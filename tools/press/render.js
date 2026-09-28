#!/usr/bin/env node
/**
 * render.js — the press. One renderer for every output.
 *
 *   node tools/press/render.js [--model <edition.json> | --model -] [--out <dir>]
 *                              [--only sheets,print,booklet,printer]
 *   node tools/press/render.js --publish [--model …]
 *                              (press/<edition>/booklet.pdf + booklet.json + limits.json)
 *   node tools/press/render.js --limits [--model …] [--out <file>]
 *                              (press/<edition>/limits.json, for the submissions desk)
 *
 * The magazine is DB.render(model) (db.js), the document the studio previews and
 * publishes. db-print.js lays it out on sheets of the edition's trim: the cover,
 * every section, a sheet per Young Voices report, a Continued sheet for a long
 * piece, the back cover. The studio's Web PDF is that layout, printed by the
 * browser. This script is the same layout in headless Chromium, so the printed
 * PDFs are the Web PDF's pages — same CSS, same fonts (assets/fonts/), same
 * pagination code — and then pdf-lib makes the press's products out of them:
 *
 *   sheets.pdf   the pages as Chromium printed them: trim + bleed, no marks.
 *                Byte for byte what the Web PDF would be.
 *   print.pdf    the same pages cut to the trim (MediaBox = TrimBox), one-up in
 *                reading order: the proof.
 *   printer.pdf  for a print shop: each sheet on trim + bleed + slug, crop marks in
 *                the slug, /TrimBox and /BleedBox set. The bleed is real: a
 *                section's ground runs into it because the sheet is laid out that
 *                size.
 *   booklet.pdf  for a desktop duplex printer: the trimmed pages imposed two to a
 *                Letter-landscape side in saddle-stitch order (padded with blank
 *                pages to a multiple of four), clear of the band a laser cannot
 *                ink; print, fold, staple. A trim too wide for half a sheet goes
 *                one to a side instead.
 *
 * Exported as press(model, outDir, opts) for tools/press-server.py's worker and
 * the tests; on the command line it writes the files and prints a JSON summary.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");
const { PDFDocument, rgb } = require("pdf-lib");

const ROOT = path.resolve(__dirname, "..", "..");
const DB = require(path.join(ROOT, "db.js"));
const DB_JS = fs.readFileSync(path.join(ROOT, "db.js"), "utf8");
const PRINT_JS = fs.readFileSync(path.join(ROOT, "db-print.js"), "utf8");

const PT_PER = { pt: 1, px: 0.75, in: 72, mm: 72 / 25.4, cm: 72 / 2.54 };
function pt(len) {
  const m = String(len).trim().match(/^(-?[\d.]+)\s*(pt|px|in|mm|cm)$/i);
  if (!m) throw new Error(`not a length: ${JSON.stringify(len)}`);
  return parseFloat(m[1]) * PT_PER[m[2].toLowerCase()];
}

const SLUG_PT = 5 * PT_PER.mm;          // room for crop marks, outside the bleed
const MARK_PT = 0.25;
// Letter landscape: the paper in a desktop printer; a laser leaves ~4.2 mm bare
const SHEET_PT = [792, 612], BAND_PT = 5 * PT_PER.mm;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".json": "application/json",
  ".woff2": "font/woff2", ".woff": "font/woff" };

function getPath(o, p) { return p.split(".").reduce((c, k) => (c == null ? c : c[k]), o); }

// the magazine served as the site serves it: the document at the root, the repo's
// files (assets/, fonts) beside it
function serve(html) {
  const DOC = "/__press.html";
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === DOC) { res.writeHead(200, { "Content-Type": TYPES[".html"] }); return res.end(html); }
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) || rel.split("/").some(p => p.startsWith("."))) { res.writeHead(404); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(buf);
    });
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r({ server, url: `http://127.0.0.1:${server.address().port}${DOC}` })));
}

/** DB.render(model) on sheets, as the Web PDF lays it out. */
async function renderSheets(model, { browser } = {}) {
  const m = DB.clone(model);
  m.print = Object.assign({}, m.print, { marks: "off" });   // the slug and its marks are added below, as PDF
  const html = DB.render(m);
  const conts = DB_PRINT_LONG(m);
  const { server, url } = await serve(html);
  const own = !browser;
  browser = browser || await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    // the magazine carries no script of its own: the engine and the pager go in for the layout only
    await page.addScriptTag({ content: DB_JS });
    await page.addScriptTag({ content: PRINT_JS });
    // the sheet is the viewport, as the studio makes it its frame: 100vh is a sheet
    const S = await page.evaluate(mm => DBPrint.sheetPx(document, mm), m);
    await page.setViewportSize({ width: Math.round(S.w), height: Math.round(S.h) });
    const sheets = await page.evaluate(async ({ mm, conts }) => {
      const out = await DBPrint.paginate({ doc: document, win: window, size: () => {} }, mm, {}, { conts });
      return out.map(s => ({ key: s.key, label: s.label, scale: +s.scale.toFixed(4) }));
    }, { mm: m, conts });
    const fonts = await page.evaluate(() => document.fonts.ready.then(() =>
      Array.from(document.fonts).filter(f => f.status === "loaded").map(f => f.family.replace(/["']/g, ""))));
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await page.close();
    return { pdf, sheets, fonts: [...new Set(fonts)], model: m };
  } finally {
    if (own) await browser.close();
    server.close();
  }
}
function DB_PRINT_LONG(m) {
  return require(path.join(ROOT, "db-print.js")).longPieces(m).filter(p => getPath(m, p) != null);
}

function geometry(m) {
  const g = DB.printGeom(m);
  return { tw: pt(g.tw), th: pt(g.th), b: pt(g.bleed) };
}
function stamp(doc) {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  const when = epoch != null ? new Date(Number(epoch) * 1000) : new Date();
  doc.setCreationDate(when); doc.setModificationDate(when);
  doc.setProducer("Daily Bread press (tools/press/render.js)"); doc.setCreator("DB.render + db-print.js, Chromium, pdf-lib");
}

/** sheets.pdf -> the trimmed pages, the printer's pages and the booklet. */
async function products(sheetsPdf, geom, title, only) {
  const out = {};
  const src = await PDFDocument.load(sheetsPdf);
  const n = src.getPageCount();
  const { tw, th, b } = geom;
  const [W0, H0] = [tw + 2 * b, th + 2 * b];
  const trimBox = { left: b, bottom: b, right: b + tw, top: b + th };

  if (only.has("print")) {
    const d = await PDFDocument.create(); stamp(d); d.setTitle(title + " — pages");
    const embT = await Promise.all(src.getPages().map(p => d.embedPage(p, trimBox)));
    embT.forEach(e => { const pg = d.addPage([tw, th]); pg.drawPage(e, { x: 0, y: 0 }); });
    out.print = await d.save();
  }
  if (only.has("printer")) {
    const s = SLUG_PT, W = W0 + 2 * s, H = H0 + 2 * s, o = s + b;
    const d = await PDFDocument.create(); stamp(d); d.setTitle(title + " — for the printer");
    const emb = await Promise.all(src.getPages().map(p => d.embedPage(p)));
    const ink = rgb(0, 0, 0);
    emb.forEach(e => {
      const pg = d.addPage([W, H]);
      pg.drawPage(e, { x: s, y: s, width: W0, height: H0 });
      // crop marks: from the sheet's edge to the bleed, in line with the trim
      for (const x of [o, o + tw]) {
        pg.drawLine({ start: { x, y: 0 }, end: { x, y: s }, thickness: MARK_PT, color: ink });
        pg.drawLine({ start: { x, y: H - s }, end: { x, y: H }, thickness: MARK_PT, color: ink });
      }
      for (const y of [o, o + th]) {
        pg.drawLine({ start: { x: 0, y }, end: { x: s, y }, thickness: MARK_PT, color: ink });
        pg.drawLine({ start: { x: W - s, y }, end: { x: W, y }, thickness: MARK_PT, color: ink });
      }
      pg.setTrimBox(o, o, tw, th);
      pg.setBleedBox(s, s, W0, H0);
    });
    out.printer = await d.save();
  }
  if (only.has("booklet")) {
    const d = await PDFDocument.create(); stamp(d); d.setTitle(title + " — booklet");
    const emb = await Promise.all(src.getPages().map(p => d.embedPage(p, trimBox)));
    const [SW, SH] = SHEET_PT;
    const cellW = SW / 2 - BAND_PT, cellH = SH - 2 * BAND_PT;
    const twoUp = Math.min(cellW / tw, cellH / th) >= 0.6;   // a portrait trim: two to a side
    if (twoUp) {
      const k = Math.min(cellW / tw, cellH / th), w = tw * k, h = th * k, y = (SH - h) / 2;
      const pages = emb.slice();
      while (pages.length % 4) pages.push(null);           // blank pages to a multiple of four
      const N = pages.length;
      for (let side = 1; side <= N / 2; side++) {
        const near = side, far = N - side + 1;
        const [L, R] = side % 2 ? [far, near] : [near, far];
        const pg = d.addPage([SW, SH]);
        if (pages[L - 1]) pg.drawPage(pages[L - 1], { x: SW / 2 - w, y, width: w, height: h });   // flush at the fold
        if (pages[R - 1]) pg.drawPage(pages[R - 1], { x: SW / 2, y, width: w, height: h });
      }
      d.catalog.set(d.context.obj("ViewerPreferences"), d.context.obj({ Duplex: "DuplexFlipShortEdge", PickTrayByPDFSize: true }));
      out.bookletLayout = { perSide: 2, sides: N / 2, blank: N - n, scale: +k.toFixed(4) };
    } else {
      for (const e of emb) {
        const land = tw > th, [PW, PH] = land ? SHEET_PT : [SHEET_PT[1], SHEET_PT[0]];
        const k = Math.min((PW - 2 * BAND_PT) / tw, (PH - 2 * BAND_PT) / th);
        const pg = d.addPage([PW, PH]);
        pg.drawPage(e, { x: (PW - tw * k) / 2, y: (PH - th * k) / 2, width: tw * k, height: th * k });
      }
      out.bookletLayout = { perSide: 1, sides: n, blank: 0 };
    }
    out.booklet = await d.save();
  }
  return out;
}

/** model -> { pages, sheets, files: { name: path }, ... } in outDir */
async function press(model, outDir, opts = {}) {
  const only = new Set(opts.only || ["sheets", "print", "printer", "booklet"]);
  const t0 = Date.now();
  const r = await renderSheets(model, opts);
  const geom = geometry(r.model);
  const title = "Daily Bread " + ((model.meta && model.meta.issueNo) || "");
  const made = await products(r.pdf, geom, title, only);
  fs.mkdirSync(outDir, { recursive: true });
  const files = {};
  const write = (name, bytes) => { const f = path.join(outDir, name + ".pdf"); fs.writeFileSync(f, bytes); files[name] = f; };
  if (only.has("sheets")) {
    // Chromium stamps the clock into its PDF; pdf-lib's copy carries SOURCE_DATE_EPOCH instead
    const d = await PDFDocument.load(r.pdf); stamp(d); d.setTitle(title + " — sheets");
    write("sheets", await d.save());
  }
  for (const k of ["print", "printer", "booklet"]) if (made[k]) write(k, made[k]);
  const declared = [model.fonts && model.fonts.displayFont, model.fonts && model.fonts.monoFont,
    model.fonts && model.fonts.scriptFont].filter(Boolean);
  return {
    pages: r.sheets.length, sheets: r.sheets, files,
    trimPt: [+geom.tw.toFixed(2), +geom.th.toFixed(2)], bleedPt: +geom.b.toFixed(2),
    booklet: made.bookletLayout || null,
    shrunk: r.sheets.filter(s => s.scale < 0.999).map(s => ({ label: s.label, scale: s.scale })),
    fontsMissing: declared.filter(f => !r.fonts.includes(f)),
    seconds: +((Date.now() - t0) / 1000).toFixed(1),
  };
}

/** Each writer's piece and the words it may hold, measured on these pages. */
async function limits(model, { browser } = {}) {
  const P = require(path.join(ROOT, "db-print.js"));
  const slots = P.writerSlots(model);
  const marked = P.markModel(model, slots.map(s => s[1]));
  const { server, url } = await serve(DB.render(marked));
  const own = !browser;
  browser = browser || await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    await page.addScriptTag({ content: DB_JS });
    await page.addScriptTag({ content: PRINT_JS });
    const S = await page.evaluate(mm => DBPrint.sheetPx(document, mm), marked);
    await page.setViewportSize({ width: Math.round(S.w), height: Math.round(S.h) });
    const pieces = await page.evaluate(async ({ mm, model, slots }) => {
      const conts = DBPrint.longPieces(mm).filter(p => DBPrint.getPath(mm, p) != null);
      const sheets = await DBPrint.paginate({ doc: document, win: window, size: () => {} }, mm, {}, { conts, measure: true });
      return DBPrint.measurePieces(document, sheets, model, slots);
    }, { mm: marked, model, slots });
    await page.close();
    return pieces;
  } finally {
    if (own) await browser.close();
    server.close();
  }
}
function writeLimits(file, ed, model, pieces) {
  const g = geometry(model);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    edition: ed, measuredOn: "db-print.js sheets of DB.render(model) (tools/press/render.js)",
    trimPt: [+g.tw.toFixed(2), +g.th.toFixed(2)],
    slots: pieces.map(p => Object.assign({ section: p.section, path: p.path, words: p.now, capacity: p.limit },
      p.pages ? { first: p.pages[0], continued: p.pages[1] } : {})),
  }, null, 2) + "\n");
}
// key order must not change the hash: every object's keys sorted
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}
// "№1" -> issue-01: the edition's folder under press/
function editionOf(model) {
  const n = String((model.meta && model.meta.issueNo) || "").match(/\d+/);
  return n ? "issue-" + n[0].padStart(2, "0") : null;
}

module.exports = { press, renderSheets, products, geometry, limits, editionOf, canonical };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  (async () => {
    const src = opt("--model");
    const model = src === "-" ? JSON.parse(fs.readFileSync(0, "utf8"))
      : src ? JSON.parse(fs.readFileSync(src, "utf8")) : DB.clone(DB.DEFAULT_MODEL);
    if (argv.includes("--publish")) {
      // press/<edition>/: the booklet the studio offers when no press is running,
      // its manifest, and the word limits the submissions desk tells writers
      const ed = editionOf(model);
      if (!ed) throw new Error("the edition has no issue number (meta.issueNo)");
      const dir = path.join(ROOT, "press", ed);
      const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "db-press-"));
      const browser = await chromium.launch();
      try {
        const info = await press(model, tmp, { only: ["booklet"], browser });
        const pdf = fs.readFileSync(info.files.booklet);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "booklet.pdf"), pdf);
        const crypto = require("crypto");
        const sha = b => crypto.createHash("sha256").update(b).digest("hex");
        fs.writeFileSync(path.join(dir, "booklet.json"), JSON.stringify({
          edition: ed, source: src ? path.relative(ROOT, path.resolve(src)) : "db.js DEFAULT_MODEL",
          modelSha256: sha(canonical(model)),
          pages: info.pages, sides: info.booklet.sides, blankPages: info.booklet.blank,
          pageWidthPt: info.trimPt[0], pageHeightPt: info.trimPt[1], sheetWidthPt: SHEET_PT[0], sheetHeightPt: SHEET_PT[1],
          pdfSha256: sha(pdf), pdfBytes: pdf.length,
          sourceDateEpoch: process.env.SOURCE_DATE_EPOCH != null ? Number(process.env.SOURCE_DATE_EPOCH) : null,
          engine: "Chromium " + browser.version() + " (playwright " + require("playwright/package.json").version + "), pdf-lib " + require("pdf-lib/package.json").version,
          press: "tools/press/render.js (DB.render + db-print.js; saddle-stitch on Letter)",
        }, null, 2) + "\n");
        const pieces = await limits(model, { browser });
        writeLimits(path.join(dir, "limits.json"), ed, model, pieces);
        process.stdout.write(`press/${ed}: booklet ${info.pages} pages on ${info.booklet.sides} sides, limits for ${pieces.length} pieces\n`);
      } finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
      return;
    }
    if (argv.includes("--limits")) {
      // press/<edition>/limits.json: what the submissions desk tells writers
      const pieces = await limits(model);
      const ed = editionOf(model);
      const file = path.resolve(opt("--out") || path.join(ROOT, "press", ed || "issue-00", "limits.json"));
      writeLimits(file, ed, model, pieces);
      process.stdout.write(path.relative(ROOT, file) + ": " + pieces.map(p => p.path + " " + p.limit).join(", ") + "\n");
      return;
    }
    const only = opt("--only") ? opt("--only").split(",") : undefined;
    const info = await press(model, path.resolve(opt("--out") || path.join(ROOT, "build", "press")), { only });
    process.stdout.write(JSON.stringify(info) + "\n");
  })().catch(e => { console.error(e && e.stack || e); process.exit(1); });
}
