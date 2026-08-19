/**
 * render-studio-pdf.js — render the print magazine PDF *directly from the document
 * the web studio shows*.
 *
 *   node render-studio-pdf.js "<out.pdf>" [--model <model.json>] [--emit-html <file>]
 *
 * WHY THIS EXISTS
 * The magazine PDF used to be rendered from `Daily Bread Issue 01-print.html`, a
 * hand-built <doc-page> kit that had no connection to the studio's model — the
 * studio's own button said so ("independent of the model above"). Editing the
 * magazine in the studio could not change the PDF, and the PDF could not tell you
 * what the studio would show. This script removes that gap: it renders
 * `DB.render(model)` — byte-for-byte the same HTML the studio drops into its
 * preview iframe and publishes — so the PDF is the studio view, paginated.
 *
 * The pagination is not invented here. db.js's own print stylesheet sizes the media
 * box to trim + bleed + slug, insets the body to the safe area, draws crop marks and
 * breaks each section onto a fresh page. All this script does is drive a browser
 * over that document and press print. Page size therefore follows the studio's
 * Print & bleed panel; change the trim there and the PDF follows.
 *
 * Determinism (see also the render-print-pdf workflow):
 *   - fonts come from ./vendor by default, so an upstream font revision or a network
 *     hiccup cannot move the layout. NO_VENDOR_FONTS=1 uses live Google Fonts.
 *   - the body face is a real webfont (IBM Plex Mono) declared by db.js, not a
 *     system stack, so the text does not reflow with whatever sans the runner has.
 *   - SOURCE_DATE_EPOCH, when set, pins the PDF's own timestamps.
 * The script refuses to print until all three faces report loaded, every image has
 * decoded, and the page count has stopped moving.
 *
 * Finally it verifies the result against the source rather than against a constant:
 * the PDF's MediaBox must equal the size the studio document's own `@page` rule
 * declares. A hardcoded "A4 landscape" check would keep passing after the studio's
 * trim changed; this one cannot.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const VENDOR = path.join(__dirname, "vendor");
const DB = require(path.join(ROOT, "db.js"));

/* ---- args ------------------------------------------------------------- */
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const OUT = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")))[0];
const MODEL_ARG = opt("--model");
const EMIT_HTML = opt("--emit-html");
if (!OUT) { console.error('usage: node render-studio-pdf.js "<out.pdf>" [--model <model.json>] [--emit-html <file>]'); process.exit(2); }

/* ---- the model the studio is showing ----------------------------------
   Precedence: --model > MAGAZINE_MODEL > <repo>/magazine.model.json > DB.DEFAULT_MODEL.
   The studio's "Export JSON" writes exactly this shape, so committing that file is
   what makes an edit in the studio reach the PDF. With no file present the default
   model is used, which is what a freshly-opened studio shows. */
function resolveModel() {
  const candidates = [
    MODEL_ARG && { why: "--model", file: path.resolve(MODEL_ARG) },
    process.env.MAGAZINE_MODEL && { why: "MAGAZINE_MODEL", file: path.resolve(process.env.MAGAZINE_MODEL) },
    { why: "magazine.model.json", file: path.join(ROOT, "magazine.model.json") },
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c.file)) {
      const m = JSON.parse(fs.readFileSync(c.file, "utf8"));
      return { model: m, source: `${c.why} (${path.relative(ROOT, c.file)})` };
    }
    if (c.why !== "magazine.model.json") { console.error(`model not found: ${c.file}`); process.exit(2); }
  }
  return { model: DB.clone(DB.DEFAULT_MODEL), source: "DB.DEFAULT_MODEL (db.js) — what a freshly-opened studio shows" };
}

/* ---- split "calc(a) calc(b)" on top-level whitespace -------------------- */
function splitTopLevel(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s.trim()) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) { out.push(cur); cur = ""; } continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/* ---- reproducible timestamps ------------------------------------------- */
function pdfDate(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
         `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}+00'00'`;
}
function pinDates(file) {
  const sde = process.env.SOURCE_DATE_EPOCH;
  if (!sde || !/^\d+$/.test(sde)) return false;
  const stamp = pdfDate(Number(sde));
  const buf = fs.readFileSync(file);
  let s = buf.toString("latin1");
  let hits = 0;
  s = s.replace(/\/(CreationDate|ModDate)\s*\(([^)]*)\)/g, (m, key, val) => {
    if (val.length !== stamp.length) return m;  // unexpected form: leave it alone
    hits++;
    return `/${key} (${stamp})`;
  });
  if (hits) fs.writeFileSync(file, Buffer.from(s, "latin1"));
  return hits > 0;
}

/* ---- which faces actually ended up in the file --------------------------
   The studio document declares exactly three families. Anything else in the PDF
   arrived by system fallback for a glyph none of them carry, which means that text
   is set in whatever the rendering machine happened to have — the precise failure
   that made the previous print PDF unreproducible. Report it (with the offending
   characters) instead of letting it stay invisible; STRICT_FONTS=1 makes it fatal. */
const DECLARED_FAMILIES = ["IBMPlexMono", "Caveat", "UnifrakturMaguntia", "DBSymbols"];
function auditFonts(file) {
  const zlib = require("zlib");
  const raw = fs.readFileSync(file);
  const s = raw.toString("latin1");
  const objs = new Map();
  for (const m of s.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objs.set(+m[1], m[2]);

  const inflate = (n) => {
    const b = objs.get(n); if (!b) return "";
    const m = b.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
    if (!m) return "";
    try { return zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); }
    catch { return m[1]; }
  };

  const foreign = new Map(); // family -> Set(chars)
  for (const [, body] of objs) {
    const bf = body.match(/\/BaseFont\s*\/(?:[A-Z]{6}\+)?([A-Za-z0-9-]+)/);
    if (!bf || !/\/Subtype\s*\/Type0/.test(body)) continue;
    const fam = bf[1];
    if (DECLARED_FAMILIES.some(d => fam.replace(/-.*$/, "") === d)) continue;
    const tu = body.match(/\/ToUnicode\s+(\d+) 0 R/);
    const chars = new Set();
    if (tu) {
      for (const c of inflate(+tu[1]).matchAll(/<([0-9a-fA-F]{4})>\s*<([0-9a-fA-F]{4,})>/g)) {
        const hex = c[2];
        let str = "";
        for (let i = 0; i < hex.length; i += 4) str += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
        if (str && str !== "\uffff") chars.add(str);
      }
    }
    if (!foreign.has(fam)) foreign.set(fam, new Set());
    chars.forEach(c => foreign.get(fam).add(c));
  }
  return foreign;
}

/* ---- model fingerprint --------------------------------------------------
   Key order must not change the hash: the studio's model is round-tripped through
   localStorage and JSON files, and JSON.stringify follows insertion order. Sort
   every object key so the studio (crypto.subtle) and this script (node:crypto)
   agree on the digest for the same content. */
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}
function sha256(str) { return require("crypto").createHash("sha256").update(str).digest("hex"); }

/* ---- MediaBox of every page, in points ---------------------------------- */
function mediaBoxes(buf) {
  const s = buf.toString("latin1");
  const out = [];
  const re = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g;
  let m;
  while ((m = re.exec(s))) out.push([+m[3] - +m[1], +m[4] - +m[2]]);
  return out;
}
function countPages(buf) {
  const s = buf.toString("latin1");
  const c = (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  return c;
}

const { model, source: modelSource } = resolveModel();
const html = DB.render(model);
if (EMIT_HTML) { fs.mkdirSync(path.dirname(path.resolve(EMIT_HTML)), { recursive: true }); fs.writeFileSync(EMIT_HTML, html); }

/* the @page size the studio document itself declares */
const pageRule = html.match(/@page\{\s*size:([^;]+);/);
if (!pageRule) { console.error("the rendered studio document declares no @page size — db.js printCss changed?"); process.exit(1); }
const [declW, declH] = splitTopLevel(pageRule[1]);

const useVendor = process.env.NO_VENDOR_FONTS !== "1" && fs.existsSync(path.join(VENDOR, "fonts.css"));
const PORT = Number(process.env.RENDER_PORT || 8489);
const DOC = "/__studio-magazine.html";
const TYPES = { ".html":"text/html; charset=utf-8", ".js":"application/javascript", ".css":"text/css",
  ".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp",
  ".json":"application/json", ".woff2":"font/woff2", ".woff":"font/woff", ".ico":"image/x-icon" };

/* Serve the repo root so the document's own /assets/* references resolve exactly as
   they do for the published site; the document itself is served from memory. */
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/" || rel === DOC) {
    res.writeHead(200, { "Content-Type": TYPES[".html"] });
    return res.end(html);
  }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("no"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, "127.0.0.1", async () => {
  console.log("model:  ", modelSource);
  console.log("fonts:  ", useVendor ? "vendored (deterministic)" : "live Google Fonts");
  console.log("@page:  ", declW, declH);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  if (useVendor) {
    await page.route("**/*", route => {
      const u = route.request().url();
      if (/fonts\.googleapis\.com\/css2/.test(u))
        return route.fulfill({ status: 200, contentType: "text/css", body: fs.readFileSync(path.join(VENDOR, "fonts.css")) });
      const ff = u.match(/fonts\.googleapis\.com\/.*?\/files\/([\w.-]+\.(woff2?))$/);
      if (ff) {
        const p = path.join(VENDOR, "files", ff[1]);
        return fs.existsSync(p)
          ? route.fulfill({ status: 200, contentType: "font/" + ff[2], body: fs.readFileSync(p) })
          : route.fulfill({ status: 404, body: "" });
      }
      if (/fonts\.gstatic\.com/.test(u)) return route.abort();
      return route.continue();
    });
  }

  await page.goto(`http://127.0.0.1:${PORT}${DOC}`, { waitUntil: "networkidle", timeout: 90000 });

  /* Ready = the three declared faces are loaded, every image decoded, and the
     print-media page count has settled. db.js emits no runtime JS, so there is no
     component boot to wait on — but webfonts still reflow the text under us. */
  await page.emulateMedia({ media: "print" });
  const statusFn = () => {
    const fontsOk = document.fonts.status === "loaded"
      && document.fonts.check('16px "IBM Plex Mono"')
      && document.fonts.check("600 16px Caveat")
      && document.fonts.check("16px UnifrakturMaguntia");
    const badImgs = Array.from(document.images).filter(i => !(i.complete && i.naturalWidth > 0)).length;
    return { fontsOk, badImgs, imgs: document.images.length,
      secs: document.querySelectorAll("section.sec").length,
      height: document.documentElement.scrollHeight,
      ok: fontsOk && badImgs === 0 };
  };
  let last = null, stable = 0, prev = -1;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    last = await page.evaluate(statusFn);
    if (last.ok) { stable = (last.height === prev) ? stable + 1 : 1; prev = last.height; if (stable >= 3) break; }
    else { stable = 0; prev = -1; }
    await page.waitForTimeout(500);
  }
  console.log("ready:  ", JSON.stringify(last), stable >= 3 ? "STABLE" : "NOT-STABLE");
  if (stable < 3) { console.error("render never settled — refusing to print"); await browser.close(); server.close(); process.exit(1); }

  /* Resolve the document's own @page lengths with the same CSS engine that will
     size the sheets, so the check below compares like with like. */
  const declared = await page.evaluate(([w, h]) => {
    const d = document.createElement("div");
    d.style.cssText = `position:absolute;left:-9999px;top:0;visibility:hidden;width:${w};height:${h}`;
    document.body.appendChild(d);
    const r = d.getBoundingClientRect();
    d.remove();
    return { w: r.width * 0.75, h: r.height * 0.75 }; // css px -> pt
  }, [declW, declH]);

  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  await page.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true,
                   margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await browser.close();
  server.close();

  /* Chromium stamps wall-clock /CreationDate and /ModDate and does NOT honour
     SOURCE_DATE_EPOCH, so two runs of an identical document differ in exactly those
     two strings. Rewrite them in place when SOURCE_DATE_EPOCH is set: the PDF date
     form is fixed-width, so this is a same-length substitution and every xref offset
     stays valid. Without it, "render twice and require byte-identical output" tests
     the clock rather than the render. */
  pinDates(OUT);

  /* Verify against the source, not against a constant. */
  const buf = fs.readFileSync(OUT);
  const boxes = mediaBoxes(buf);
  const pages = countPages(buf) || boxes.length;
  const bad = boxes.filter(([w, h]) => Math.abs(w - declared.w) > 1 || Math.abs(h - declared.h) > 1);
  console.log(`wrote   ${OUT}`);
  console.log(`dates:  ${process.env.SOURCE_DATE_EPOCH ? "pinned to SOURCE_DATE_EPOCH=" + process.env.SOURCE_DATE_EPOCH : "wall clock (set SOURCE_DATE_EPOCH for a reproducible file)"}`);
  console.log(`pages:  ${pages}`);
  console.log(`size:   ${boxes.length ? boxes[0].map(n => n.toFixed(2)).join(" x ") : "?"} pts ` +
              `(studio declares ${declared.w.toFixed(2)} x ${declared.h.toFixed(2)})`);
  if (!boxes.length) { console.error("could not read a MediaBox out of the PDF"); process.exit(1); }
  if (bad.length) {
    console.error(`::error::${bad.length}/${boxes.length} sheets do not match the size the studio document declares`);
    process.exit(1);
  }
  if (pages < 1) { console.error("::error::no pages"); process.exit(1); }
  console.log("check:   every sheet matches the studio's declared trim + bleed + slug");

  const foreign = auditFonts(OUT);
  if (foreign.size) {
    console.log("fonts:   NOT fully pinned — these faces came from the rendering machine, not ./vendor:");
    for (const [fam, chars] of foreign)
      console.log(`           ${fam}  for  ${[...chars].join(" ")}`);
    console.log("         Those glyphs are absent from IBM Plex Mono, so they fall back to a system");
    console.log("         face and can differ (or go missing) on another machine. Vendor a face that");
    console.log("         covers them, or replace them in the model, to make the PDF fully portable.");
    if (process.env.STRICT_FONTS === "1") { console.error("::error::STRICT_FONTS=1 and the render used unpinned faces"); process.exit(1); }
  } else {
    console.log("fonts:   every face in the PDF is one the studio document declares");
  }

  /* Sidecar manifest. The studio reads this to tell you whether the file behind its
     download button was rendered from the model you are actually editing — without
     it, a stale PDF and a live edit look identical from the studio. */
  const manifest = {
    modelSource, modelHash: sha256(canonical(model)),
    pages, pageWidthPt: +boxes[0][0].toFixed(2), pageHeightPt: +boxes[0][1].toFixed(2),
    trim: (model.print && model.print.preset) || "custom",
    pdfSha256: sha256(buf), pdfBytes: buf.length,
    sourceDateEpoch: process.env.SOURCE_DATE_EPOCH ? Number(process.env.SOURCE_DATE_EPOCH) : null,
    unpinnedFonts: Object.fromEntries([...foreign].map(([f, c]) => [f, [...c].join(" ")])),
    renderer: "render-studio-pdf.js (DB.render(model) — the document the studio shows)"
  };
  const manifestPath = path.join(path.dirname(path.resolve(OUT)), "magazine-render.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`manifest ${path.relative(ROOT, manifestPath)}  (model ${manifest.modelHash.slice(0, 12)})`);
  process.exit(0);
});
server.on("error", e => { console.error("BIND ERR", e.code); process.exit(1); });
