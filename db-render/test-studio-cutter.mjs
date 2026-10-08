/**
 * test-studio-cutter.mjs — the sticker sheet with a cutting machine's own marks.
 *
 *   node db-render/test-studio-cutter.mjs
 *
 * A Cricut only cuts what Design Space printed (the PNG export covers it).
 * Silhouette and Brother machines cut a sheet printed from anywhere, if the page
 * carries what they look for and a cut file says where each sticker is. For each
 * of the three kinds this checks: (1) the marks sit where the machine's software
 * is told they are, and no sticker touches them; (2) the printed page is a US
 * Letter PDF with the marks and the stickers where the geometry says; (3) the SVG
 * and DXF cut files trace every sticker's island at the same place; (4) the Print
 * menu offers one button per machine, which saves the cut files and prints.
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
const LETTER_PT = [612, 792];
const SHOT_SCALE = 4;              // screenshot at 4x, so a 0.5 mm line is two pixels wide and more
const PX_PER_MM = 96 / 25.4 * SHOT_SCALE;

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
const ready = await page.evaluate(() => typeof stickerMarkSheet === "function" && typeof cutPage === "function");
check("the studio has the marked sticker sheet", ready);

for (const kind of ready ? KINDS : []) {
  const job = await page.evaluate(async k => {
    const j = await stickerMarkSheet(k);
    const out = { page: j.page, sheets: j.sheets, html: "<!doctype html>" + j.frame.contentDocument.documentElement.outerHTML,
                  svg: j.svg, dxf: j.dxf };
    j.frame.remove();
    return out;
  }, kind);
  const P = job.page, isl = P.islands, near = (a, b) => Math.abs(a - b) < 0.01;

  /* (1) the geometry */
  if (kind === "silhouette") {
    const sq = P.marks[0];
    check(`${kind}: a 5 mm square 10 mm in from the top-left corner`, sq && near(sq.x, 10) && near(sq.y, 10) && near(sq.w, 5) && near(sq.h, 5));
    const tr = P.marks.filter(m => m.x > P.w / 2 && m.y < P.h / 2), bl = P.marks.filter(m => m.x < P.w / 2 && m.y > P.h / 2);
    const reach = ms => [Math.max(...ms.map(m => m.w)), Math.max(...ms.map(m => m.h))];
    check(`${kind}: 20 mm L-brackets at the top-right and bottom-left, 0.5 mm thick`,
      tr.length === 2 && bl.length === 2 && reach(tr).every(v => near(v, 20)) && reach(bl).every(v => near(v, 20)) &&
      [...tr, ...bl].every(m => near(Math.min(m.w, m.h), 0.5)) &&
      near(Math.max(...tr.map(m => m.x + m.w)), P.w - 10) && near(Math.max(...bl.map(m => m.y + m.h)), P.h - 10),
      JSON.stringify(P.marks.map(m => [m.x, m.y, m.w, m.h].map(v => +v.toFixed(2)))));
  }
  if (kind === "scanncut") {
    check(`${kind}: no registration marks (the machine scans), an outline round each sticker`, P.marks.length === 0 && P.outline === true);
  }
  if (kind === "crosshair") {
    check(`${kind}: crosshairs at three corners, 10 mm in`, P.marks.length === 6, P.marks.length + " bars");
  }
  check(`${kind}: the page is US Letter`, near(P.w, 215.9) && near(P.h, 279.4), P.w + " x " + P.h);
  check(`${kind}: every sticker of the edition is on it`, isl.length === 12, isl.length + " stickers");
  const clear = isl.every(s => P.marks.every(m => m.x + m.w + 3 < s.x || s.x + s.side + 3 < m.x || m.y + m.h + 3 < s.y || s.y + s.side + 3 < m.y));
  check(`${kind}: no sticker comes within 3 mm of a mark`, clear);

  /* (2) the printed page */
  const q = await browser.newPage({ viewport: { width: 816, height: 1056 }, deviceScaleFactor: SHOT_SCALE });
  await q.setContent(job.html, { waitUntil: "load" });
  await q.evaluate(() => Promise.all(Array.from(document.images).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
  const pdf = (await q.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
  const box = (pdf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/) || []).slice(1).map(Number);
  const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
  check(`${kind}: it prints on US Letter, one page per sheet`,
    Math.round(box[0]) === LETTER_PT[0] && Math.round(box[1]) === LETTER_PT[1] && pages === job.sheets, box.join(" x ") + ", " + pages + " page(s)");
  const shot = await q.screenshot({ clip: { x: 0, y: 0, width: 816, height: 1056 } });
  await q.close();
  const px = await page.evaluate(async ({ b64, pts }) => {
    const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const x = c.getContext("2d"); x.drawImage(im, 0, 0);
    return pts.map(([u, v]) => Array.from(x.getImageData(Math.round(u), Math.round(v), 1, 1).data.slice(0, 3)));
  }, { b64: shot.toString("base64"), pts: [
    ...P.marks.map(m => [(m.x + m.w / 2) * PX_PER_MM, (m.y + m.h / 2) * PX_PER_MM]),
    [(isl[0].x + isl[0].side / 2) * PX_PER_MM, (isl[0].y + isl[0].side * 0.9) * PX_PER_MM],
    [(isl[0].x - 2) * PX_PER_MM, (isl[0].y + isl[0].side / 2) * PX_PER_MM],
    ...isl.map(s => [s.x * PX_PER_MM, (s.y + s.side / 2) * PX_PER_MM]),          // on the cut line
  ] });
  const dark = p => p.every(v => v < 60), white = p => p.every(v => v > 245);
  const markPx = px.slice(0, P.marks.length), islandPx = px[P.marks.length], besidePx = px[P.marks.length + 1];
  check(`${kind}: every mark prints black where the geometry puts it`, markPx.every(dark), JSON.stringify(markPx));
  const edgePx = px.slice(P.marks.length + 2);
  if (P.outline) {
    check(`${kind}: the outline prints on every sticker's edge`, edgePx.every(dark), edgePx.filter(p => !dark(p)).length + " of " + edgePx.length + " not dark");
  }
  check(`${kind}: the first sticker prints where its island is, on white paper`, !white(islandPx) && white(besidePx),
    JSON.stringify([islandPx, besidePx]));

  /* (3) the cut files */
  const rects = [...job.svg.matchAll(/<rect [^>]*>/g)].map(m => m[0]);
  const num = (s, a) => parseFloat((s.match(new RegExp(" " + a + '="([\\d.]+)"')) || [])[1]);
  check(`${kind}: the SVG cut file is Letter in millimetres`, /width="215\.9mm"/.test(job.svg) && /height="279\.4mm"/.test(job.svg) && /viewBox="0 0 215\.9 279\.4"/.test(job.svg));
  check(`${kind}: …one cut path per sticker, on its island`, rects.length === isl.length &&
    rects.every((r, i) => Math.abs(num(r, "x") - isl[i].x) < 0.01 && Math.abs(num(r, "y") - isl[i].y) < 0.01 &&
                          Math.abs(num(r, "width") - isl[i].side) < 0.01 && Math.abs(num(r, "rx") - isl[i].r) < 0.01),
    rects.length + " paths");
  const polys = job.dxf.split(/\n/).filter(l => l.trim() === "POLYLINE").length;
  const v1 = job.dxf.match(/VERTEX\n\s*8\nCUT\n\s*10\n([\d.]+)\n\s*20\n([\d.]+)/);
  check(`${kind}: the DXF cut file has the same paths, in inches`, polys === isl.length && /\$INSUNITS\n\s*70\n1\b/.test(job.dxf) &&
    v1 && Math.abs(+v1[1] - (isl[0].x + isl[0].r) / 25.4) < 0.001 && Math.abs(+v1[2] - (P.h - isl[0].y) / 25.4) < 0.001,
    polys + " polylines");
}

/* (4) the Print menu: a button for each machine */
if (ready) {
  const kinds = await page.evaluate(() => Array.from(document.querySelectorAll("#pdfMenu [data-cutter]")).map(b => b.dataset.cutter));
  check("the Print menu has a button for each machine", KINDS.every(k => kinds.includes(k)), kinds.join(", "));
  await page.evaluate(() => { window.printSheet = j => { window.__printed = j.kind; j.frame.remove(); }; });
  await page.click("#pdfMenuBtn");
  const saved = [];
  page.on("download", d => saved.push(d.suggestedFilename()));
  await page.click('#pdfMenu [data-cutter="silhouette"]');
  await page.waitForFunction(() => window.__printed, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  check("Silhouette saves its cut files and prints the sheet",
    saved.includes("daily-bread-stickers-silhouette-cut.svg") && saved.includes("daily-bread-stickers-silhouette-cut.dxf") &&
    await page.evaluate(() => window.__printed === "silhouette"), saved.join(", "));
  const t = await page.evaluate(() => document.querySelector("#toast")?.textContent || "");
  check("…and says how to set the machine up", /Type 1/.test(t) && /10 mm/.test(t) && /100 ?%/.test(t), t.slice(0, 120));
}

await browser.close();
server.close();
for (const l of ok) console.log("  ✓ " + l);
for (const l of bad) console.log("  ✗ " + l);
console.log(`studio cutter: ${ok.length} pass, ${bad.length} fail`);
process.exit(bad.length ? 1 : 0);
