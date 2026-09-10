/**
 * test-studio-press.mjs — the studio's "Magazine PDF" button hands over the TeX
 * press booklet for the edition on screen, byte for byte.
 *
 *   node db-render/test-studio-press.mjs
 *
 * Serves the repo root, opens studio.html, clicks the button, and checks that what
 * the browser downloads is press/<edition>/booklet.pdf — the .tex typeset and
 * imposed, not a render of the studio's model — and that an edition maps to its
 * .tex by issue number. Needs playwright and a chromium, so it runs on the build
 * host only and is NOT in CI.
 */
import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".png": "image/png", ".pdf": "application/pdf" };
const EDITION = "issue-01";      // what a fresh studio shows: DB.DEFAULT_MODEL, "№1"

const ok = [], bad = [];
const check = (name, cond, extra) => (cond ? ok : bad).push(name + (extra ? " — " + extra : ""));
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

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

function findChrome() {
  if (process.env.DB_CHROME) return process.env.DB_CHROME;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ||
                path.join(process.env.HOME || "/root", ".cache", "ms-playwright");
  if (!fs.existsSync(cache)) return null;
  const shapes = [
    ["chromium-", "chrome-linux64", "chrome"],
    ["chromium-", "chrome-linux", "chrome"],
    ["chromium_headless_shell-", "chrome-headless-shell-linux64", "chrome-headless-shell"],
  ];
  for (const [prefix, dir, bin] of shapes) {
    const builds = fs.readdirSync(cache).filter(d => d.startsWith(prefix)).sort().reverse();
    for (const b of builds) {
      const exe = path.join(cache, b, dir, bin);
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}
const exe = findChrome();
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(exe ? { executablePath: exe } : {}) });
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(URL_, { waitUntil: "networkidle" });

/* the edition on screen maps to its .tex by issue number */
const map = await page.evaluate(() => [
  pressEdition({ meta: { issueNo: "№1" } }),
  pressEdition({ meta: { issueNo: "№12" } }),
  pressEdition({ meta: { issueNo: "" } }),
  pressEdition({ meta: {} }),
]);
check("№1 → issue-01", map[0] === "issue-01", map[0]);
check("№12 → issue-12", map[1] === "issue-12", map[1]);
check("no number → no press", map[2] === null && map[3] === null);

/* the button fetches the manifest, then downloads the booklet */
const requests = [];
page.on("request", r => requests.push(new URL(r.url()).pathname));
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 15000 }),
  page.click("#magPdfBtn"),
]);
const got = fs.readFileSync(await download.path());
const want = fs.readFileSync(path.join(ROOT, "press", EDITION, "booklet.pdf"));
check("reads the manifest first", requests.includes(`/press/${EDITION}/booklet.json`));
check("downloads press/<edition>/booklet.pdf", download.url().endsWith(`/press/${EDITION}/booklet.pdf`), download.url());
check("suggested name carries the edition", download.suggestedFilename() === `daily-bread-${EDITION}-booklet.pdf`, download.suggestedFilename());
check("bytes are the tracked press booklet", sha(got) === sha(want), `${got.length} vs ${want.length} bytes`);
check("nothing under db-render/out is asked for", !requests.some(p => p.startsWith("/db-render/out/")));

/* the toast says what was handed over */
const toast = await page.evaluate(() => document.querySelector("#toast")?.textContent || "");
check("toast names the source", /typeset from content\/issue-01\.tex/.test(toast), toast);

await browser.close();
server.close();
for (const l of ok) console.log("  ✓ " + l);
for (const l of bad) console.log("  ✗ " + l);
console.log(`studio press: ${ok.length} pass, ${bad.length} fail`);
process.exit(bad.length ? 1 : 0);
