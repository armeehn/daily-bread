/* Edition-shelf checks for studio.html — the switcher that lets several issues
 * be prepped side by side.
 *
 *   cd db-render && node test-studio-editions.mjs
 *
 * Serves the repo root on an ephemeral port and drives studio.html in a real
 * browser. localStorage is the whole feature, so it cannot be checked without
 * one: the store, the migration off the old single-model key, and what survives
 * a reload are all browser state.
 *
 * Needs playwright and a chromium, so it runs on the build host only and is NOT
 * wired into CI. It never exits 0 without running — a missing browser is a
 * failure, not a skip.
 *
 * Set DB_CHROME to override the browser. Needs playwright in db-render/node_modules
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const SAVE_DEBOUNCE = 700;           // ms: past studio.html's 160ms save/render debounce
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };

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

/* playwright pins one browser build per version and the pinned headless shell is
   often not the one actually installed, so find a chromium rather than trust the
   default. DB_CHROME wins; otherwise take the newest build in the cache. */
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
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", e => bad.push("pageerror: " + e.message));

/* Every edition action asks through prompt()/confirm(). Answer them from the
   test rather than from a dialog handler, so each check states its own answer. */
await page.addInitScript(() => {
  window.__prompt = undefined;                 // undefined = accept the default
  window.__confirm = true;
  window.prompt = (msg, def) => (window.__prompt === undefined ? def : window.__prompt);
  window.confirm = () => window.__confirm;
});

const state = () => page.evaluate(() => ({
  n: shelf.order.length,
  cur: shelf.items[shelf.current].name,
  curId: shelf.current,
  ids: shelf.order.slice(),
  names: shelf.order.map(id => shelf.items[id].name),
  brand: model.meta.brand,
  opts: Array.from(document.querySelectorAll("#editionSel option")).map(o => o.textContent),
  optVal: document.querySelector("#editionSel").value,
  delOff: document.querySelector("#edDelBtn").disabled,
  menuOpen: !document.querySelector("#edMenu").classList.contains("off"),
}));

// the edition verbs live behind one menu button, so every action opens it first
async function act(id) {
  await page.click("#edMenuBtn");
  await page.click(id);
  await page.waitForTimeout(300);
}

// edit through the studio's own debounced save path, not by poking the store
async function setBrand(v) {
  await page.evaluate(b => { model.meta.brand = b; schedule(); }, v);
  await page.waitForTimeout(SAVE_DEBOUNCE);
}

/* ---- 1. a browser that predates editions keeps its work ---- */
await page.goto(URL_);
await page.evaluate(() => {
  localStorage.clear();
  const m = JSON.parse(JSON.stringify(DB.DEFAULT_MODEL));
  m.meta.issueNo = "№7"; m.meta.issueName = "Old Key"; m.meta.brand = "LEGACY";
  localStorage.setItem("dailybread:model:v1", JSON.stringify(m));
});
await page.reload();
const mig = await state();
const keyGone = await page.evaluate(() => localStorage.getItem("dailybread:model:v1") === null);
check("the pre-editions model becomes edition one", mig.n === 1 && mig.brand === "LEGACY", mig.brand);
check("that edition is named after its issue", mig.cur === "№7 · Old Key", mig.cur);
check("the old single-model key is retired", keyGone);
check("the switcher lists the edition", mig.opts.length === 1 && mig.opts[0] === mig.cur);
check("Delete is off while one edition is left", mig.delOff === true);

/* ---- 2. a second edition, started from the default ---- */
const firstId = mig.curId;
await page.evaluate(() => { window.__prompt = "The Thaw"; });
await act("#edNewBtn");
const two = await state();
const defBrand = await page.evaluate(() => DB.DEFAULT_MODEL.meta.brand);
check("New adds an edition and opens it", two.n === 2 && two.cur === "The Thaw", two.names.join(" | "));
check("a new edition starts from the default", two.brand === defBrand, two.brand);
check("the switcher follows the open edition", two.optVal === two.curId);
check("Delete is on once there are two", two.delOff === false);

/* ---- 3. editions do not leak into one another ---- */
await setBrand("THAW BRAND");
await page.selectOption("#editionSel", firstId);
await page.waitForTimeout(300);
const back = await state();
check("switching back shows the other edition's content", back.brand === "LEGACY", back.brand);
check("the switch does not disturb the shelf", back.n === 2 && back.curId === firstId);
await page.selectOption("#editionSel", two.curId);
await page.waitForTimeout(300);
const fwd = await state();
check("the edit made in the second edition survived the round trip", fwd.brand === "THAW BRAND", fwd.brand);

/* ---- 4. duplicate copies what is on screen ---- */
await page.evaluate(() => { window.__prompt = "Thaw copy"; });
await act("#edDupBtn");
const dup = await state();
check("Copy adds a third edition and opens it", dup.n === 3 && dup.cur === "Thaw copy", dup.names.join(" | "));
check("the copy carries the live content", dup.brand === "THAW BRAND", dup.brand);
await setBrand("COPY ONLY");
await page.selectOption("#editionSel", two.curId);
await page.waitForTimeout(300);
const src = await state();
check("editing the copy leaves its source alone", src.brand === "THAW BRAND", src.brand);

/* ---- 5. rename touches one edition ---- */
await page.evaluate(() => { window.__prompt = "The Thaw №2"; });
await act("#edRenBtn");
const ren = await state();
check("Rename renames the open edition", ren.cur === "The Thaw №2", ren.cur);
check("Rename leaves the other names alone",
  ren.names.filter(n => n === "№7 · Old Key" || n === "Thaw copy").length === 2, ren.names.join(" | "));
check("the switcher shows the new name", ren.opts.includes("The Thaw №2"));

/* ---- 6. the shelf and the open edition survive a reload ---- */
await page.reload();
await page.waitForTimeout(300);
const rl = await state();
const status = await page.textContent("#status");
check("every edition is still there after a reload", rl.n === 3, rl.names.join(" | "));
check("the reload reopens the edition that was open", rl.curId === ren.curId && rl.brand === "THAW BRAND", rl.cur);
check("the status says the work was restored", /Restored/.test(status), status);

/* ---- 7. importing a file adds an edition instead of overwriting one ---- */
const tmp = path.join(os.tmpdir(), "imported-issue.json");
const imported = await page.evaluate(() => {
  const m = JSON.parse(JSON.stringify(DB.DEFAULT_MODEL));
  m.meta.brand = "FROM FILE";
  return JSON.stringify(m);
});
fs.writeFileSync(tmp, imported);
await page.setInputFiles("#fileImport", tmp);
await page.waitForTimeout(500);
const imp = await state();
check("Import lands as a new edition", imp.n === 4 && imp.brand === "FROM FILE", imp.cur);
check("the imported edition is named after the file", imp.cur === "imported-issue", imp.cur);
check("the edition that was open is untouched",
  imp.names.includes("The Thaw №2") && imp.ids.includes(ren.curId));
fs.unlinkSync(tmp);

/* ---- 8. a swap drops design mode's selection ---- */
await page.evaluate(() => {
  const d = document.querySelector("#preview").contentDocument;
  const el = Array.from(d.querySelectorAll("[data-dbp]")).find(n => n.textContent.trim().length > 8);
  el.scrollIntoView({ block: "center" });
  el.click();
});
await page.waitForTimeout(200);
const held = await page.evaluate(() => sel !== null);
await page.selectOption("#editionSel", firstId);
await page.waitForTimeout(500);
const swapped = await page.evaluate(() => ({
  sel: sel,
  outlined: document.querySelector("#preview").contentDocument.querySelectorAll(".dz-sel").length,
}));
check("a click still selects before the swap", held === true);
check("switching edition clears the selection", swapped.sel === null);
check("nothing stays outlined in the new edition", swapped.outlined === 0, swapped.outlined + " outlined");

/* ---- 9. delete removes one edition and lands on a neighbour ---- */
const before = await state();
await page.evaluate(() => { window.__confirm = true; });
await act("#edDelBtn");
const del = await state();
const gone = before.ids.indexOf(before.curId);
const rest = before.ids.filter(id => id !== before.curId);
const neighbour = rest[Math.min(gone, rest.length - 1)];
check("Delete removes the open edition", del.n === before.n - 1 && !del.ids.includes(before.curId), del.names.join(" | "));
check("Delete lands on the neighbouring edition", del.curId === neighbour, del.cur);
check("the switcher drops the deleted edition", del.opts.length === del.n);

/* ---- 10. a refused confirm deletes nothing ---- */
await page.evaluate(() => { window.__confirm = false; });
await act("#edDelBtn");
const kept = await state();
check("cancelling the confirm keeps the edition", kept.n === del.n && kept.curId === del.curId);
check("the menu closes after an action", kept.menuOpen === false);

/* ---- 11. the bar the switcher sits in still holds its contents ----
   It was `height:52px` AND `flex-wrap:wrap`, so a bar too full to fit put its
   last controls on a second row that landed on top of the pane below. */
// measure the worst case: the select is capped, so a name long enough to hit
// the cap is the widest the switcher can ever be
await page.evaluate(() => { window.__prompt = "A Very Long Edition Name That Never Ends"; });
await act("#edRenBtn");
const bars = [];
for (const w of [1920, 1600, 1400, 1280]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(250);
  bars.push([w, await page.evaluate(() => {
    const bar = document.querySelector("header.bar").getBoundingClientRect();
    const st = document.querySelector("#status").getBoundingClientRect();
    return { h: Math.round(bar.height), inside: st.bottom <= bar.bottom + 1,
             wide: document.body.scrollWidth > window.innerWidth };
  })]);
}
check("the top bar is one row at the studio's design width, longest name and all",
  bars.filter(([w]) => w >= 1600).every(([, m]) => m.h === 52),
  bars.map(([w, m]) => w + ":" + m.h).join(" "));
check("a fuller bar grows instead of covering the pane below",
  bars.every(([, m]) => m.inside), bars.map(([w, m]) => w + ":" + m.inside).join(" "));
check("nothing pushes the page sideways", bars.every(([, m]) => !m.wide));

await browser.close();
server.close();

console.log("studio editions: " + ok.length + " pass, " + bad.length + " fail");
ok.forEach(s => console.log("  ✓ " + s));
bad.forEach(s => console.log("  ✗ " + s));
process.exit(bad.length ? 1 : 0);
