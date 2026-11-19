/**
 * test-studio-rows.mjs — a one-line row prints whole on one page.
 *
 *   node db-render/test-studio-rows.mjs
 *
 * A list row (the ledger's "1958 · bridge opens… · PIVOT") is a flex row on one
 * line. When a section runs over a page, db-print.js's splitFlow moved the tail
 * to the next page one block at a time and divided that row too: the year
 * printed on one page and its words on the next. Opens studio.html, lays the
 * edition out as the Web PDF and the press do (buildPrintFrame), and checks that
 * every row the page renders prints once, with all its cells, on one sheet.
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
                ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const ROW = ".list .li";         // a list row: cells side by side on one line
const CONTENTS = "#contents";    // its rows get their page numbers at print time

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

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("http://127.0.0.1:" + server.address().port + "/studio.html", { waitUntil: "networkidle" });

const got = await page.evaluate(async ([ROW, CONTENTS]) => {
  // each row as its cells' text: "1958|bridge opens; ferry workers obsolete overnight|Pivot"
  const cells = li => Array.from(li.children).map(c => c.textContent.trim()).join("|");
  const rows = el => Array.from(el.querySelectorAll(ROW)).filter(li => !li.closest(CONTENTS));

  const web = new DOMParser().parseFromString(DB.render(model), "text/html");
  const want = rows(web).map(cells);

  const job = await buildPrintFrame();
  const sheets = Array.from(job.frame.contentDocument.querySelectorAll(".pp-book > .pp-sheet"));
  const printed = sheets.flatMap((s, i) => rows(s).map(li => ({ sheet: i + 1, row: cells(li) })));
  job.frame.remove();

  return { want, printed };
}, [ROW, CONTENTS]);

const printedRows = got.printed.map(p => p.row);
const lost = got.want.filter(r => !printedRows.includes(r));
const parts = got.printed.filter(p => !got.want.includes(p.row));

check("the edition has list rows to print", got.want.length > 0, String(got.want.length));
check("every row prints whole", lost.length === 0, lost.slice(0, 3).join(" ; "));
check("no row prints in parts", parts.length === 0,
  parts.slice(0, 4).map(p => "sheet " + p.sheet + ": " + p.row).join(" ; "));

await browser.close();
server.close();

for (const l of ok) {
  console.log("  ✓ " + l);
}

for (const l of bad) {
  console.log("  ✗ " + l);
}

console.log(`studio rows: ${ok.length} pass, ${bad.length} fail`);
process.exit(bad.length ? 1 : 0);
