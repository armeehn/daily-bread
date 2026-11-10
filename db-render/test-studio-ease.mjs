/* Ease-of-use checks for studio.html: the things a first-time editor meets.
 *
 *   cd db-render && node test-studio-ease.mjs
 *
 *   1. a tablet or a phone: one pane at a time, the page first, a tap on the
 *      page brings up its field, and the switch between the two is one row
 *   2. Find answers the way people ask: "add event", "change cover", "photo"
 *   3. the studio's own type can be read: 11px or more, 4.5:1 on its ground
 *   4. help and the place the work is saved are one click away
 *
 * Same harness as test-studio-design.mjs: the repo root on an ephemeral port,
 * studio.html in a real browser. Not wired into CI; a missing browser fails.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
// the press's pinned Playwright: `cd tools/press && npm install` once
const { chromium } = createRequire(new URL("../tools/press/package.json", import.meta.url))("playwright");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const SETTLE = 800;                  // ms: past the studio's render debounce and the tap-or-double-tap wait
const TAP_WAIT = 10000;              // ms: a tap on something that is not on screen is a failed check, not a hang
const MIN_TYPE_PX = 11;              // the smallest type the studio's own chrome may set
const MIN_CONTRAST = 4.5;            // WCAG AA for text; 3 for large text
const LARGE_CONTRAST = 3;
const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 820, height: 1100 };
const PHONE = { width: 390, height: 844 };
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

/* the pinned headless shell is often not the build installed: find a chromium */
function findChrome() {
  if (process.env.DB_CHROME) { return process.env.DB_CHROME; }

  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ||
                path.join(process.env.HOME || "/root", ".cache", "ms-playwright");

  if (!fs.existsSync(cache)) { return null; }

  const shapes = [
    ["chromium-", "chrome-linux64", "chrome"],
    ["chromium-", "chrome-linux", "chrome"],
    ["chromium_headless_shell-", "chrome-headless-shell-linux64", "chrome-headless-shell"],
  ];

  for (const [prefix, dir, bin] of shapes) {
    const builds = fs.readdirSync(cache).filter(d => d.startsWith(prefix)).sort().reverse();

    for (const b of builds) {
      const exe = path.join(cache, b, dir, bin);
      if (fs.existsSync(exe)) { return exe; }
    }
  }

  return null;
}
const exe = findChrome();
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(exe ? { executablePath: exe } : {}) });

/* a fresh studio (empty storage) at one window size */
async function open(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(TAP_WAIT);
  page.on("pageerror", e => bad.push("pageerror: " + e.message));
  await page.goto(URL_, { waitUntil: "load" });
  await page.waitForTimeout(SETTLE);
  return page;
}
// a control that is not there is a control that is not shown
const shown = (page, sel) => page.$eval(sel, e => e.getBoundingClientRect().height > 0).catch(() => false);
const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; }).catch(() => ({ w: 0, h: 0 }));

/* Every visible run of the studio's own text (the preview is another document):
   its size, and its contrast against the nearest painted ground, with the
   element's opacity counted. Disabled controls are exempt, as in WCAG. */
function readType() {
  const rgba = s => { const m = /rgba?\(([^)]+)\)/.exec(s); const p = m ? m[1].split(/[, /]+/).map(Number) : [0, 0, 0, 0]; return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const mix = (top, under, a) => ({ r: top.r * a + under.r * (1 - a), g: top.g * a + under.g * (1 - a), b: top.b * a + under.b * (1 - a) });
  const out = [];

  for (const el of document.querySelectorAll("body *")) {
    if (/^(SCRIPT|STYLE|IFRAME|OPTION|SVG|PATH)$/i.test(el.tagName)) { continue; }

    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
    const rect = el.getBoundingClientRect();

    if (!own || rect.width === 0 || rect.height === 0 || el.closest("[disabled]")) { continue; }

    const style = getComputedStyle(el);

    if (style.visibility === "hidden") { continue; }

    // the ground: the nearest ancestor that paints one; opacity on the way up fades the text
    let ground = { r: 255, g: 255, b: 255 }, alpha = rgba(style.color).a;

    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n), bg = rgba(s.backgroundColor);

      if (bg.a > 0.5) { ground = bg; break; }

      alpha *= parseFloat(s.opacity);
    }

    if (alpha < 0.05) { continue; }          // faded right out until hovered: not text yet

    const ink = mix(rgba(style.color), ground, Math.min(1, alpha));
    const hi = Math.max(lum(ink), lum(ground)), lo = Math.min(lum(ink), lum(ground));
    const px = parseFloat(style.fontSize), bold = parseInt(style.fontWeight, 10) >= 700;

    out.push({ what: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && el.className.baseVal === undefined ? "." + String(el.className).trim().split(/\s+/).join(".") : "") + " “" + el.textContent.trim().slice(0, 18) + "”",
               px, large: px >= 24 || (bold && px >= 18.66), ratio: (hi + 0.05) / (lo + 0.05) });
  }

  return out;
}
async function typeProblems(page, state) {
  const runs = await page.evaluate(readType);
  const small = runs.filter(r => r.px < MIN_TYPE_PX);
  const faint = runs.filter(r => r.ratio < (r.large ? LARGE_CONTRAST : MIN_CONTRAST) - 0.05);
  const list = a => [...new Set(a.map(r => r.what + " " + r.px + "px " + r.ratio.toFixed(1) + ":1"))].slice(0, 4).join(" · ");

  check(state + ": no type under " + MIN_TYPE_PX + "px", small.length === 0, small.length ? small.length + " run(s): " + list(small) : runs.length + " runs");
  check(state + ": every run reads against its ground", faint.length === 0, faint.length ? faint.length + " run(s): " + list(faint) : "");
}

/* ============================== 1. small screens ============================== */
for (const [name, viewport] of [["tablet", TABLET], ["phone", PHONE]]) {
  const page = await open(viewport);
  const frame = page.frameLocator("#preview");

  const tabs = await box(page, ".tabs");
  check(name + ": the Page / Edit switch is one row", tabs.h > 0 && tabs.h <= 56, Math.round(tabs.h) + "px tall");

  const labels = (await page.evaluate(readType)).filter(r => /^button#tab/.test(r.what));
  check(name + ": both labels on the switch can be read", labels.length === 2 && labels.every(r => r.ratio >= MIN_CONTRAST),
    labels.map(r => r.what + " " + r.ratio.toFixed(1) + ":1").join(" · "));

  check(name + ": the page shows first", (await shown(page, "#previewPane")) && !(await shown(page, "#editPane")));

  const pane = await box(page, "#previewPane");
  check(name + ": the page gets the screen", pane.h >= viewport.height * 0.6, Math.round(pane.h) + " of " + viewport.height + "px");

  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(name + ": nothing runs off the side", sideways <= 0, sideways + "px");

  // a tap on the page: its field comes up, and there is a way back
  await frame.locator(".hero .tagline").click({ timeout: TAP_WAIT }).catch(() => {});
  await page.waitForTimeout(SETTLE);
  const field = await page.evaluate(() => {
    const pane = document.querySelector("#editPane"), input = document.querySelector("#designPane input[type=text], #designPane textarea");
    return { edit: pane.getBoundingClientRect().height > 0, value: input ? input.value : null, px: input ? parseFloat(getComputedStyle(input).fontSize) : 0 };
  });
  check(name + ": a tap on the page brings up its field", field.edit && /queer magazine/i.test(field.value || ""), JSON.stringify(field));
  check(name + ": the field does not make a phone zoom in", field.px >= 16, field.px + "px");

  const back = page.locator("#designPane .back");
  check(name + ": the panel offers the way back", await back.isVisible().catch(() => false));
  await back.click({ timeout: 2000 }).catch(() => {});
  check(name + ": …and it goes back to the page", await shown(page, "#previewPane"));

  // a double tap still types on the page, and stays there
  await frame.locator(".hero .tagline").dblclick({ timeout: TAP_WAIT }).catch(() => {});
  await page.waitForTimeout(SETTLE);
  const inline = await frame.locator(".hero .tagline").evaluate(e => e.isContentEditable);
  check(name + ": a double tap still types on the page", inline && (await shown(page, "#previewPane")));
  await page.close();
}

/* the phone's header: two rows, the rest behind More */
{
  const page = await open(PHONE);
  const bar = await box(page, "header.bar");
  check("phone: the header is two rows at most", bar.h <= 100, Math.round(bar.h) + "px");
  check("phone: Publish waits behind More", !(await shown(page, "#publishBtn")) && (await shown(page, "#moreBtn")));
  await page.click("#moreBtn").catch(() => {});
  check("phone: More shows the edition, theme, print and publish controls",
    (await shown(page, "#publishBtn")) && (await shown(page, "#editionSel")) && (await shown(page, "#pdfMenuBtn")));
  await page.click("#pdfMenuBtn").catch(() => {});
  const menu = await page.$eval("#pdfMenu", e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: window.innerWidth }; });
  check("phone: an open menu stays on the screen", menu.l >= 0 && menu.r <= menu.w, JSON.stringify(menu));
  await page.close();
}

/* ============================== 2. desktop ============================== */
const page = await open(DESKTOP);
const frame = page.frameLocator("#preview");

check("desktop: both panes side by side, no switch, no More",
  (await shown(page, "#editPane")) && (await shown(page, "#previewPane")) && !(await shown(page, ".tabs")) && !(await shown(page, "#moreBtn")));
check("desktop: the header is one row", (await box(page, "header.bar")).h <= 56, Math.round((await box(page, "header.bar")).h) + "px");

for (const width of [1440, 1100]) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(200);
  const spill = await page.$eval("#previewPane", e => e.scrollHeight - e.clientHeight);
  check("desktop " + width + ": the page fits its pane, one scrollbar", spill <= 1, spill + "px over");
}
await page.setViewportSize(DESKTOP);

/* ---- Find answers the way people ask ---- */
const find = async q => {
  await page.click("#findBtn");
  await page.fill("#palIn", q);
  await page.waitForTimeout(150);
  return page.$$eval("#palList .opt .l", els => els.map(e => e.textContent.trim()));
};
const closeFind = () => page.keyboard.press("Escape");

const events = () => page.evaluate(() => model.calendar.events.length);
const before = await events();
const adds = await find("add event");
check("find: “add event” offers to add one", adds.length > 0 && /add/i.test(adds[0]) && /event/i.test(adds[0]), adds.slice(0, 2).join(" · ") || "nothing");
await page.keyboard.press("Enter");
await page.waitForTimeout(SETTLE);
check("find: …and adds it", (await events()) === before + 1, before + " → " + (await events()));
check("find: …with the new row open in the panel", /Events · row/.test(await page.$eval("#designPane", e => e.innerText).catch(() => "")));
await page.keyboard.press("Escape");
await page.click("#undoBtn").catch(() => {});
await page.waitForTimeout(SETTLE);
check("find: …and Undo takes it away again", (await events()) === before);

const cover = await find("change cover");
check("find: “change cover” finds the cover", cover.some(l => /cover/i.test(l)), cover.slice(0, 3).join(" · ") || "nothing");
await closeFind();

const photo = await find("photo");
check("find: “photo” finds the pictures", photo.length > 2, photo.length + " result(s)");
await closeFind();

await find("zzqx");
const none = await page.$eval("#palList", e => e.innerText);
check("find: a miss says what to try", /try/i.test(none), none.replace(/\s+/g, " ").slice(0, 80));

/* ---- 3. the studio's own type, in the states an editor passes through ---- */
await typeProblems(page, "find");
await closeFind();
await typeProblems(page, "first screen");

await frame.locator(".hero .tagline").click();
await page.waitForTimeout(SETTLE);
await typeProblems(page, "a field selected");

await page.click("#modeFields");
await page.locator("#fieldsPane .sec > .head").nth(1).click();
await page.waitForTimeout(300);
await typeProblems(page, "all fields");
await page.click("#modeDesign");

await page.click("#edMenuBtn");
await typeProblems(page, "edition menu");
await page.click("#pdfMenuBtn");
await typeProblems(page, "print menu");
await page.keyboard.press("Escape");
await page.mouse.click(5, 500);

/* ---- 4. help, and where the work is ---- */
check("help: a Help button is on the bar", await page.locator("#helpBtn").isVisible().catch(() => false));
await page.click("#helpBtn", { timeout: 2000 }).catch(() => {});
const sheet = await page.$eval("#keysBack", e => e.innerText).catch(() => "");
check("help: it opens the sheet", sheet.length > 0);
check("help: the sheet says where the work is saved and how to keep a copy", /this browser/i.test(sheet) && /export/i.test(sheet));
if (sheet) { await typeProblems(page, "help sheet"); }
await page.keyboard.press("Escape");

const statusTitle = await page.$eval("#status", e => e.title);
check("status: says where “Saved” is", /this browser/i.test(statusTitle), statusTitle || "no title");

await browser.close();
server.close();

console.log("studio ease of use: " + ok.length + " pass, " + bad.length + " fail");
ok.forEach(s => console.log("  ✓ " + s));
bad.forEach(s => console.log("  ✗ " + s));
process.exit(bad.length ? 1 : 0);
