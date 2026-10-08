/**
 * test-studio-cutter.mjs — the sticker sheet for every cutting machine.
 *
 *   node db-render/test-studio-cutter.mjs
 *
 * A Cricut cuts only what Design Space printed, so the magazine's sticker page
 * is its sheet (the studio's "Stickers for a cutter" PNG goes to Design Space)
 * and stays the default. Machines that read marks printed anywhere get the
 * appendix: one page each for Silhouette, Brother ScanNCut and crosshairs, the
 * twelve stickers with that machine's marks, measured from the trim. Checks:
 * (1) the appendix pages, after the Continued pages and before the back cover;
 * (2) on each, the marks sit where the geometry says, in mm from the trim, the
 * stickers sit on their islands clear of the marks, and nothing on a sticker
 * runs off it; (3) the cut files trace the same islands on the trim; (4) the
 * Print menu keeps the Cricut PNG first and saves every machine's cut files.
 * Needs the press's Playwright (cd tools/press && npm install).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { chromium } = createRequire(new URL("../tools/press/package.json", import.meta.url))("playwright");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".jpg": "image/jpeg" };
const KINDS = ["silhouette", "scanncut", "crosshair"];
const TOL_MM = 0.15;               // a laid-out box against its geometry

const ok = [], bad = [];
const check = (name, cond, extra) => (cond ? ok : bad).push(name + (extra ? " — " + extra : ""));

/* ---- static server over the repo root ---- */
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const URL_ = "http://127.0.0.1:" + server.address().port + "/studio.html";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(URL_, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
const ready = await page.evaluate(() => typeof DBPrint.cutterPage === "function" && typeof buildPrintFrame === "function");
check("the pager knows the cutters' pages", ready);

if (ready) {
  /* (1)-(2) the appendix as laid out */
  const laid = await page.evaluate(async kinds => {
    const { frame, sheets } = await buildPrintFrame();
    const d = frame.contentDocument, sh = Array.from(d.querySelectorAll(".pp-sheet"));
    const T = DBPrint.trimMm(model), n = (model.stickers.items || []).length;
    const keys = sheets.map(s => s.key), out = { keys, pages: {} };
    for (const kind of kinds) {
      const i = keys.indexOf("appendix." + kind);
      if (i < 0) { continue; }
      const s = sh[i], r = s.getBoundingClientRect(), b = parseFloat(getComputedStyle(d.querySelector(".pp-sheet:not(.pp-full)")).paddingLeft);
      const pxmm = (r.width - 2 * b) / T.w;                       // px to the mm, on the trim
      const mmBox = e => { const q = e.getBoundingClientRect(); return { x: (q.left - r.left - b) / pxmm, y: (q.top - r.top - b) / pxmm, w: q.width / pxmm, h: q.height / pxmm }; };
      const marks = Array.from(s.querySelectorAll("svg .mk")).map(mmBox);
      const isl = Array.from(s.querySelectorAll(".pp-appx-st")).map(mmBox);
      // anything with its own text, or a picture, that runs off its sticker
      const spill = Array.from(s.querySelectorAll(".pp-appx-st")).filter(st => {
        const q = st.getBoundingClientRect();
        return Array.from(st.querySelectorAll("*")).some(e => {
          const own = Array.from(e.childNodes).some(c => c.nodeType === 3 && /\S/.test(c.nodeValue)) || /^(svg|IMG)$/.test(e.tagName);
          const z = e.getBoundingClientRect();
          return own && z.width && (z.left < q.left - 1 || z.right > q.right + 1 || z.top < q.top - 1 || z.bottom > q.bottom + 1);
        });
      }).length;
      out.pages[kind] = { marks, isl, spill, geo: DBPrint.cutterPage(kind, T, n), text: s.textContent.replace(/\s+/g, " ").trim().slice(0, 400) };
    }
    frame.remove();
    return out;
  }, KINDS);

  const at = laid.keys.indexOf("appendix.silhouette"), back = laid.keys.indexOf("footer"), lastCont = laid.keys.map(k => /\.cont$/.test(k)).lastIndexOf(true);
  check("the appendix is a page per machine, after the Continued pages, before the back cover",
    at > lastCont && laid.keys.slice(at, at + 3).join() === KINDS.map(k => "appendix." + k).join() && at + 3 <= back,
    laid.keys.slice(Math.max(0, at - 1), at + 4).join(", "));
  check("the sticker page itself stays (the Cricut's sheet)", laid.keys.includes("stickers"));

  for (const kind of KINDS) {
    const p = laid.pages[kind];
    if (!p) { check(`${kind}: has its page`, false); continue; }
    const G = p.geo, near = (a, b) => Math.abs(a - b) < TOL_MM;
    const same = (a, b) => near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h);
    check(`${kind}: the marks print where the geometry puts them, from the trim`,
      p.marks.length === G.marks.length && G.marks.every((m, i) => same(m, p.marks[i])),
      p.marks.length + " of " + G.marks.length);
    check(`${kind}: every sticker on its island`, p.isl.length === 12 && G.islands.every((s, i) => same({ x: s.x, y: s.y, w: s.side, h: s.side }, p.isl[i])),
      p.isl.length + " stickers");
    check(`${kind}: no sticker within 3 mm of a mark, all inside the trim`,
      G.islands.every(s => s.x > 0 && s.y > 0 && s.x + s.side < G.w && s.y + s.side < G.h &&
        G.marks.every(m => m.x + m.w + 3 < s.x || s.x + s.side + 3 < m.x || m.y + m.h + 3 < s.y || s.y + s.side + 3 < m.y)));
    check(`${kind}: nothing on a sticker runs off it`, p.spill === 0, p.spill + " stickers spill");
    check(`${kind}: the page says how to cut it`, /100 ?%/.test(p.text) && (kind !== "silhouette" || (/Type 1/.test(p.text) && /10 mm/.test(p.text))), p.text.slice(0, 90));
  }
  const sil = laid.pages.silhouette && laid.pages.silhouette.geo;
  if (sil) {
    check("silhouette: a 5 mm square 10 mm in from the trim's top-left, 20 mm L-brackets at two corners",
      Math.abs(sil.marks[0].x - 10) < 0.01 && Math.abs(sil.marks[0].w - 5) < 0.01 && sil.marks.length === 5);
  }
  check("scanncut: no marks, an outline round each sticker", laid.pages.scanncut && laid.pages.scanncut.marks.length === 0 && laid.pages.scanncut.geo.outline === true);
  check("crosshair: three crosshairs", laid.pages.crosshair && laid.pages.crosshair.marks.length === 6);

  /* (3)-(4) the Print menu and the cut files */
  const menu = await page.evaluate(() => Array.from(document.querySelectorAll("#pdfMenu button")).map(b => b.id || b.dataset.cutter || ""));
  check("the Cricut PNG is the default, first of the sticker outputs", menu.indexOf("cutBtn") >= 0 && menu.indexOf("cutBtn") < menu.indexOf("cutFilesBtn"), menu.join(", "));
  check("the per-machine Letter sheets are gone", !menu.some(m => KINDS.includes(m)));
  const saved = {};
  page.on("download", async d => { saved[d.suggestedFilename()] = fs.readFileSync(await d.path(), "utf8"); });
  await page.click("#pdfMenuBtn");
  await page.click("#cutFilesBtn");
  await page.waitForFunction(() => /Cut files saved/.test(document.querySelector("#toast")?.textContent || ""), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  for (const kind of KINDS) {
    const svg = saved[`daily-bread-stickers-${kind}-cut.svg`] || "", dxf = saved[`daily-bread-stickers-${kind}-cut.dxf`] || "";
    const G = laid.pages[kind] && laid.pages[kind].geo;
    const rects = [...svg.matchAll(/<rect [^>]*>/g)].map(m => m[0]);
    const num = (s, a) => parseFloat((s.match(new RegExp(" " + a + '="([\\d.]+)"')) || [])[1]);
    check(`${kind}: the SVG cut file is the trim, in mm, one path per sticker on its island`,
      G && new RegExp(`width="${G.w}mm"`).test(svg) && new RegExp(`height="${G.h}mm"`).test(svg) && rects.length === G.islands.length &&
      rects.every((r, i) => Math.abs(num(r, "x") - G.islands[i].x) < 0.01 && Math.abs(num(r, "y") - G.islands[i].y) < 0.01 && Math.abs(num(r, "width") - G.islands[i].side) < 0.01),
      rects.length + " paths");
    const polys = dxf.split(/\n/).filter(l => l.trim() === "POLYLINE").length;
    const v1 = dxf.match(/VERTEX\n\s*8\nCUT\n\s*10\n([\d.]+)\n\s*20\n([\d.]+)/);
    check(`${kind}: the DXF has the same paths, in inches from the trim's bottom-left`,
      G && polys === G.islands.length && /\$INSUNITS\n\s*70\n1\b/.test(dxf) && v1 &&
      Math.abs(+v1[1] - (G.islands[0].x + G.islands[0].r) / 25.4) < 0.001 && Math.abs(+v1[2] - (G.h - G.islands[0].y) / 25.4) < 0.001,
      polys + " polylines");
  }
}

await browser.close();
server.close();
for (const l of ok) console.log("  ✓ " + l);
for (const l of bad) console.log("  ✗ " + l);
console.log(`studio cutter: ${ok.length} pass, ${bad.length} fail`);
process.exit(bad.length ? 1 : 0);
