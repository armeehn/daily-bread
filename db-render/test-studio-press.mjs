/**
 * test-studio-press.mjs — the studio's "Magazine PDF" button typesets the edition
 * in view through the press, and falls back to the CI booklet when it cannot.
 *
 *   node db-render/test-studio-press.mjs
 *
 * Serves the repo root, opens studio.html with the press pointed at a routed
 * origin, and checks: (1) the button POSTs {edition, model} for the edition on
 * screen and the browser saves exactly the bytes the press returns; (2) with the
 * press unreachable it downloads press/<edition>/booklet.pdf and the toast says
 * the edits are not in it; (3) an edition maps to its .tex by issue number.
 * Needs playwright and a chromium, so it runs on the build host only and is NOT
 * in CI. The press itself is proven by `db-latex.py press --model`.
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
const PRESS = "http://press.test";
const FAKE_PDF = Buffer.from("%PDF-1.7\n% typeset by the routed press\n%%EOF\n");

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

async function open(pressRoute) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  await ctx.addInitScript(p => { window.DB_PRESS_URL = p; }, PRESS);
  await ctx.route(PRESS + "/**", pressRoute);
  const page = await ctx.newPage();
  await page.goto(URL_, { waitUntil: "networkidle" });
  return { ctx, page };
}
const toastText = (page) => page.evaluate(() => document.querySelector("#toast")?.textContent || "");

/* ---- (1) the press is reachable: POST the edition in view, save the reply ---- */
{
  let posted = null;
  const { ctx, page } = await open(async route => {
    const req = route.request();
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type",
                   "Access-Control-Expose-Headers": "X-Press-Pages, X-Press-Sheets, X-Press-Seconds, X-Press-Overfull" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    posted = JSON.parse(req.postData() || "null");
    return route.fulfill({ status: 200, body: FAKE_PDF, contentType: "application/pdf",
      headers: { ...cors, "X-Press-Pages": "48", "X-Press-Sheets": "12", "X-Press-Seconds": "7.0", "X-Press-Overfull": "0" } });
  });
  const map = await page.evaluate(() => [
    pressEdition({ meta: { issueNo: "№1" } }), pressEdition({ meta: { issueNo: "№12" } }),
    pressEdition({ meta: { issueNo: "" } }), pressEdition({ meta: {} }),
  ]);
  check("№1 → issue-01, №12 → issue-12", map[0] === "issue-01" && map[1] === "issue-12", map.join(","));
  check("no number → no press", map[2] === null && map[3] === null);

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.click("#magPdfBtn"),
  ]);
  const got = fs.readFileSync(await download.path());
  check("POSTs the edition on screen", posted && posted.edition === EDITION, JSON.stringify(posted && posted.edition));
  check("POSTs the model in view", posted && posted.model && posted.model.meta && posted.model.meta.issueNo === "№1");
  check("saves exactly what the press returned", sha(got) === sha(FAKE_PDF), `${got.length} bytes`);
  check("suggested name carries the edition", download.suggestedFilename() === `daily-bread-${EDITION}-booklet.pdf`, download.suggestedFilename());
  const t = await toastText(page);
  check("toast says it typeset the edition in view", /Typeset the edition in view — 48 pages on 12 sheets/.test(t), t);
  check("button is usable again", await page.evaluate(() => !document.querySelector("#magPdfBtn").disabled));
  await ctx.close();
}

/* ---- (2) the press is out of reach: the CI booklet, and an honest toast ---- */
{
  const { ctx, page } = await open(route => route.abort("connectionrefused"));
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.click("#magPdfBtn"),
  ]);
  const got = fs.readFileSync(await download.path());
  const want = fs.readFileSync(path.join(ROOT, "press", EDITION, "booklet.pdf"));
  check("falls back to press/<edition>/booklet.pdf", download.url().endsWith(`/press/${EDITION}/booklet.pdf`), download.url());
  check("fallback bytes are the tracked CI booklet", sha(got) === sha(want), `${got.length} vs ${want.length} bytes`);
  const t = await toastText(page);
  check("toast says the edits are not in it", /out of reach/.test(t) && /without your edits/.test(t), t);
  await ctx.close();
}

await browser.close();
server.close();
for (const l of ok) console.log("  ✓ " + l);
for (const l of bad) console.log("  ✗ " + l);
console.log(`studio press: ${ok.length} pass, ${bad.length} fail`);
process.exit(bad.length ? 1 : 0);
