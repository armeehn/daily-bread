/* Design-mode checks for studio.html — the click/drag/drop editing layer.
 *
 *   cd db-render && node test-studio-design.mjs
 *
 * Serves the repo root on an ephemeral port and drives studio.html in a real
 * browser: nothing here can be checked without layout, because the whole layer
 * rests on where things ended up on the page.
 *
 * Needs playwright and a chromium, so it runs on the build host only and is NOT
 * wired into CI. It never exits 0 without running — a missing browser is a
 * failure, not a skip.
 *
 * Set DB_CHROME to override the browser. Needs playwright in db-render/node_modules
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const RENDER_DEBOUNCE = 700;         // ms: past studio.html's 160ms save/render debounce
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
page.on("console", m => {
  if (m.type() === "error" && !/fonts|net::|Failed to load/.test(m.text())) bad.push("console: " + m.text());
});

await page.goto(URL_, { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());     // start from the built-in default model
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1500);

/* ---- 1. the probe render mapped the page back to model paths ---- */
const mapped = await page.evaluate(() => {
  const d = document.querySelector("#preview").contentDocument;
  return { p: d.querySelectorAll("[data-dbp]").length,
           i: d.querySelectorAll("[data-dbi]").length,
           img: d.querySelectorAll("[data-dbimg]").length,
           dz: d.body.classList.contains("dz-on") };
});
check("prose nodes are mapped", mapped.p > 50, mapped.p + " nodes");
check("list rows are mapped", mapped.i > 10, mapped.i + " rows");
check("images are mapped", mapped.img >= 1, mapped.img + " images");
check("design mode is on at boot", mapped.dz === true);

/* ---- 2. clicking a field opens it in the inspector ---- */
const clicked = await page.evaluate(() => {
  const d = document.querySelector("#preview").contentDocument;
  const el = Array.from(d.querySelectorAll("[data-dbp]")).find(n => n.textContent.trim().length > 8);
  el.scrollIntoView({ block: "center" });
  el.click();
  return { sel: d.querySelectorAll(".dz-sel").length };
});
await page.waitForTimeout(200);
const insp = await page.evaluate(() => {
  const p = document.querySelector("#designPane");
  return { what: (p.querySelector(".what") || {}).textContent, fields: p.querySelectorAll(".field").length };
});
check("a click selects on the page", clicked.sel === 1, clicked.sel + " outlined");
check("a click fills the inspector", !!insp.what && insp.fields > 0, insp.what);

/* ---- 3. double-click types straight onto the page ---- */
const inline = await page.evaluate(async ms => {
  const d = document.querySelector("#preview").contentDocument;
  const el = Array.from(d.querySelectorAll("[data-dbp]")).find(n => {
    const en = entryFor(n);
    return en && en.paths.length === 1 && n.textContent.trim().length > 6 && !n.querySelector("*");
  });
  if (!el) return { missing: true };
  const path = entryFor(el).paths[0];
  el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  const editable = el.isContentEditable;
  el.textContent = "ZZTOP";
  el.blur();
  await new Promise(r => setTimeout(r, ms));
  return { editable, path, after: getPath(model, path) };
}, RENDER_DEBOUNCE);
check("double-click makes the text editable", inline.editable === true, JSON.stringify(inline));
check("an in-place edit reaches the model", inline.after === "ZZTOP", JSON.stringify(inline));

/* ---- 4. dragging a row reorders the model ---- */
await page.waitForTimeout(400);
const drag = await page.evaluate(async ms => {
  const d = document.querySelector("#preview").contentDocument;
  const groups = {};
  d.querySelectorAll("[data-dbi]").forEach(r => {
    const k = r.getAttribute("data-dbi").split("#")[0];
    (groups[k] = groups[k] || []).push(r);
  });
  const key = Object.keys(groups).find(k => groups[k].length >= 3 &&
    groups[k].every(r => r.parentElement === groups[k][0].parentElement));
  if (!key) return { missing: true };
  const g = groups[key].sort((a, b) =>
    +a.getAttribute("data-dbi").split("#")[1] - +b.getAttribute("data-dbi").split("#")[1]);
  const before = JSON.stringify(getPath(model, key));
  const src = g[0], dst = g[2];
  src.scrollIntoView({ block: "center" });
  const sr = src.getBoundingClientRect(), dr = dst.getBoundingClientRect();
  const fire = (t, x, y) => src.dispatchEvent(
    new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1 }));
  fire("pointerdown", sr.left + 4, sr.top + 4);
  fire("pointermove", sr.left + 4, sr.top + 30);
  fire("pointermove", dr.left + 4, dr.bottom - 2);
  fire("pointerup", dr.left + 4, dr.bottom - 2);
  await new Promise(r => setTimeout(r, ms));
  return { key, before, after: JSON.stringify(getPath(model, key)) };
}, RENDER_DEBOUNCE);
check("dragging a row reorders its list", !drag.missing && drag.before !== drag.after, drag.key);

/* ---- 5. selecting a whole row, not one of its fields ---- */
const rowsel = await page.evaluate(async () => {
  const d = document.querySelector("#preview").contentDocument;
  const row = Array.from(d.querySelectorAll("[data-dbi]"))
    .find(r => /toc|ledger|events/.test(r.getAttribute("data-dbi"))) || d.querySelector("[data-dbi]");
  row.scrollIntoView({ block: "center" });
  row.click();
  await new Promise(r => setTimeout(r, 250));
  const p = document.querySelector("#designPane");
  return { crumb: (p.querySelector(".crumb") || {}).textContent,
           fields: p.querySelectorAll(".field").length,
           acts: p.querySelectorAll(".acts button").length,
           outlined: d.querySelectorAll(".dz-sel").length };
});
check("a row names its section", rowsel.crumb && rowsel.crumb !== "Model", rowsel.crumb);
check("a row lists all its fields", rowsel.fields >= 2, rowsel.fields + " fields");
check("a row offers up/down/duplicate/add/delete", rowsel.acts === 5, rowsel.acts + " actions");
check("a row is outlined on the page", rowsel.outlined === 1);

/* ---- 6. the row actions edit the list ---- */
const acts = await page.evaluate(async ms => {
  const d = document.querySelector("#preview").contentDocument;
  const row = d.querySelector("[data-dbi]");
  const listPath = row.getAttribute("data-dbi").split("#")[0];
  row.click();
  await new Promise(r => setTimeout(r, 200));
  const dup = Array.from(document.querySelectorAll("#designPane .acts button"))
    .find(b => /Duplicate/.test(b.textContent));
  if (!dup) return { missing: true };
  const n0 = getPath(model, listPath).length;
  dup.click();
  await new Promise(r => setTimeout(r, ms));
  return { listPath, n0, n1: getPath(model, listPath).length };
}, RENDER_DEBOUNCE);
check("Duplicate adds a row", !acts.missing && acts.n1 === acts.n0 + 1, JSON.stringify(acts));

/* ---- 7. an image file dropped on a picture replaces it ---- */
const dropped = await page.evaluate(async ms => {
  const d = document.querySelector("#preview").contentDocument;
  const im = d.querySelector("[data-dbimg]");
  if (!im) return { missing: true };
  const p = im.getAttribute("data-dbimg"), before = getPath(model, p);
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const dt = new DataTransfer();
  dt.items.add(new File([Uint8Array.from(atob(png), c => c.charCodeAt(0))], "dot.png", { type: "image/png" }));
  im.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
  await new Promise(r => setTimeout(r, ms));
  const after = getPath(model, p);
  return { p, changed: after !== before, isData: /^data:image\/png/.test(after) };
}, RENDER_DEBOUNCE);
check("an image dropped on a picture replaces it",
  !dropped.missing && dropped.changed && dropped.isData, JSON.stringify(dropped));

/* ---- 8. typing in the inspector survives the re-render ---- */
const focus = await page.evaluate(async ms => {
  const d = document.querySelector("#preview").contentDocument;
  const el = Array.from(d.querySelectorAll("[data-dbp]"))
    .find(n => entryFor(n) && entryFor(n).paths.length === 1);
  el.scrollIntoView({ block: "center" });
  el.click();
  await new Promise(r => setTimeout(r, 250));
  const inp = document.querySelector("#designPane .field input[type=text], #designPane .field textarea");
  if (!inp) return { missing: true };
  const path = entryFor(el).paths[0];
  inp.focus();
  inp.value = "Focus Held";
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise(r => setTimeout(r, ms));
  return { path, held: document.activeElement === inp && document.body.contains(inp),
           value: getPath(model, path) };
}, RENDER_DEBOUNCE);
check("the inspector keeps focus across a re-render", !focus.missing && focus.held, JSON.stringify(focus));
check("an inspector edit reaches the model", focus.value === "Focus Held", focus.value);

/* ---- 9. Arrange mode takes over and hands back ---- */
await page.click("#arrangeBtn");
await page.waitForTimeout(300);
const onArr = await page.evaluate(() => {
  const c = document.querySelector("#preview").contentDocument.body.classList;
  return { mv: c.contains("mv-arrange"), dz: c.contains("dz-on") };
});
check("Arrange suspends design mode", onArr.mv && !onArr.dz, JSON.stringify(onArr));
await page.click("#arrangeBtn");
await page.waitForTimeout(RENDER_DEBOUNCE);
const offArr = await page.evaluate(() => {
  const d = document.querySelector("#preview").contentDocument;
  return { mv: d.body.classList.contains("mv-arrange"), dz: d.body.classList.contains("dz-on"),
           p: d.querySelectorAll("[data-dbp]").length };
});
check("leaving Arrange restores design mode",
  offArr.dz && !offArr.mv && offArr.p > 50, JSON.stringify(offArr));

/* ---- 10. the all-fields accordion still works ---- */
await page.click("#modeFields");
await page.waitForTimeout(400);
const fields = await page.evaluate(() => ({
  secs: document.querySelectorAll("#fieldsPane .sec").length,
  grips: document.querySelectorAll("#fieldsPane .grip").length,
  hidden: document.querySelector("#designPane").classList.contains("off"),
}));
check("every schema section builds", fields.secs === (await page.evaluate(() => DB.SCHEMA.length)),
  fields.secs + " sections");
check("sidebar rows carry a drag grip", fields.grips > 20, fields.grips + " grips");
check("the mode switch hides the inspector", fields.hidden === true);

/* ---- 11. none of this leaks into what publishes ---- */
const clean = await page.evaluate(() => !/data-dbp|data-dbi|data-dbimg|⁣/.test(DB.render(model)));
check("published HTML carries no editor hooks", clean);

await browser.close();
server.close();

console.log("studio design mode: " + ok.length + " pass, " + bad.length + " fail");
ok.forEach(s => console.log("  ✓ " + s));
bad.forEach(s => console.log("  ✗ " + s));
process.exit(bad.length ? 1 : 0);
