/* Editor checks for studio.html — undo, Find, the preview holding its place,
 * the formatting strip, All fields ↔ page, and the keyboard.
 *
 *   cd db-render && node test-studio-editor.mjs
 *
 * Serves the repo root on an ephemeral port and drives studio.html in a real
 * browser: scroll positions, focus and key presses are browser state, and the
 * rich-field probe needs a DOM parser.
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
const SETTLE = 700;                  // ms: past studio.html's 160ms save/render debounce and a reload
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
                ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

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
await page.addInitScript(() => {
  window.__prompt = undefined;                 // undefined = accept the default
  window.prompt = (msg, def) => (window.__prompt === undefined ? def : window.__prompt);
  window.confirm = () => true;
});

await page.goto(URL_, { waitUntil: "load" });
await page.evaluate(() => localStorage.clear());     // start from the built-in default model
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(1500);
const settle = () => page.waitForTimeout(SETTLE);
const frame = () => page.frames().find(f => f !== page.mainFrame());

/* ---- 1. boot: nothing to undo, and the rich-field probe found its fields ---- */
const boot = await page.evaluate(() => ({
  undoOff: document.querySelector("#undoBtn").disabled,
  redoOff: document.querySelector("#redoBtn").disabled,
  rich: RICH.size,
  para: RICH.has("letter.paragraphs.#"), toc: RICH.has("contents.toc.#.t"),
  plain: RICH.has("meta.issueNo") || RICH.has("contents.toc.#.pg"),
  css: Array.from(RICH).filter(p => /^(print|fonts|theme)\.|maxw/.test(p)),
}));
check("undo and redo start disabled", boot.undoOff && boot.redoOff);
check("the renderer says which fields keep formatting", boot.rich > 40, boot.rich + " fields");
check("paragraphs and contents titles take formatting", boot.para && boot.toc);
check("fields the renderer escapes do not", !boot.plain);
check("nothing in CSS counts as formatting", boot.css.length === 0, boot.css.join(","));

/* ---- 2. an edit no longer throws the preview back to the cover ---- */
const kept = await page.evaluate(async ms => {
  const w = document.querySelector("#preview").contentWindow;
  w.document.querySelector("#calendar").scrollIntoView({ behavior: "instant" });
  const before = w.scrollY;
  const title = model.calendar.title = model.calendar.title + " x"; schedule("f:calendar.title");
  await new Promise(r => setTimeout(r, ms));
  // the re-render is a new document: wait for it (a busy page may take longer), then read
  const fresh = () => { const d = document.querySelector("#preview").contentDocument;
    return d && d.readyState === "complete" && d.body && d.body.textContent.indexOf(title) >= 0; };
  for (let k = 0; k < 100 && !fresh(); k++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 100));
  return { before, after: document.querySelector("#preview").contentWindow.scrollY };
}, SETTLE);
check("the preview keeps its scroll across a re-render",
  kept.before > 1000 && Math.abs(kept.after - kept.before) < 4, JSON.stringify(kept));

/* ---- 3. typing is one undo step; undo and redo put it back ---- */
const typed = await page.evaluate(async ms => {
  // the preview re-maps after each render; wait for the sign-off to be on the map
  let el = null;
  for (let k = 0; k < 60 && !el; k++) {
    const d = document.querySelector("#preview").contentDocument;
    el = Array.from(d.querySelectorAll("[data-dbp]")).find(n => entryFor(n) && entryFor(n).paths[0] === "letter.signoff");
    if (!el) await new Promise(r => setTimeout(r, 100));
  }
  el.click();
  await new Promise(r => setTimeout(r, 200));
  const inp = document.querySelector('#designPane [data-path="letter.signoff"]');
  const was = inp.value, steps0 = hist().undo.length;
  inp.focus();
  for (const s of ["A", "AB", "ABC"]) { inp.value = s; inp.dispatchEvent(new Event("input", { bubbles: true })); await new Promise(r => setTimeout(r, 60)); }
  await new Promise(r => setTimeout(r, ms));
  return { was, steps: hist().undo.length - steps0, now: model.letter.signoff };
}, SETTLE);
check("three keystrokes in one field are one undo step", typed.steps === 1 && typed.now === "ABC", JSON.stringify(typed));
await page.keyboard.press("Control+z");
await settle();
const undone = await page.evaluate(() => ({
  v: model.letter.signoff,
  inp: (document.querySelector('#designPane [data-path="letter.signoff"]') || {}).value,
  focus: document.activeElement && document.activeElement.dataset.path,
  redo: !document.querySelector("#redoBtn").disabled,
}));
check("Ctrl+Z in a field undoes the typing", undone.v === typed.was, undone.v);
check("the panel shows the undone value", undone.inp === typed.was, undone.inp);
check("the field keeps focus through an undo", undone.focus === "letter.signoff", undone.focus);
check("redo is offered after an undo", undone.redo);
await page.keyboard.press("Control+Shift+z");
await settle();
check("Ctrl+Shift+Z redoes it", await page.evaluate(() => model.letter.signoff) === "ABC");

/* ---- 4. delete a row from the page: no dialog, and Undo in the toast ---- */
const del = await page.evaluate(async ms => {
  let asked = false; const c = window.confirm; window.confirm = () => { asked = true; return true; };
  const d = document.querySelector("#preview").contentDocument;
  const row = d.querySelector('[data-dbi^="contents.toc#"]');
  row.scrollIntoView({ block: "center" }); row.click();
  await new Promise(r => setTimeout(r, 200));
  const n0 = model.contents.toc.length, first = JSON.stringify(model.contents.toc[0]);
  Array.from(document.querySelectorAll("#designPane .acts button")).find(b => /Delete/.test(b.textContent)).click();
  await new Promise(r => setTimeout(r, ms));
  const n1 = model.contents.toc.length;
  const btn = document.querySelector("#toast button");
  const offered = !!btn && /Undo/.test(btn.textContent);
  if (btn) btn.click();
  await new Promise(r => setTimeout(r, ms));
  window.confirm = c;
  return { asked, n0, n1, offered, n2: model.contents.toc.length, back: JSON.stringify(model.contents.toc[0]) === first };
}, SETTLE);
check("deleting a row asks nothing", !del.asked);
check("the row is gone", del.n1 === del.n0 - 1, JSON.stringify(del));
check("the toast offers Undo", del.offered);
check("Undo in the toast brings the row back where it was", del.n2 === del.n0 && del.back, JSON.stringify(del));

/* ---- 5. the keyboard works a selected row ---- */
const keys0 = await page.evaluate(async () => {
  const d = document.querySelector("#preview").contentDocument;
  const row = d.querySelector('[data-dbi="contents.toc#1"]');
  row.scrollIntoView({ block: "center" }); row.click();
  await new Promise(r => setTimeout(r, 200));
  document.activeElement.blur();
  return { t1: model.contents.toc[1].t, n: model.contents.toc.length };
});
await page.keyboard.press("Alt+ArrowDown");
await settle();
const moved = await page.evaluate(() => ({ t2: model.contents.toc[2].t, sel: sel && sel.paths[0] }));
check("Alt+↓ moves the selected row down", moved.t2 === keys0.t1, JSON.stringify(moved));
check("the selection follows the row", moved.sel === "contents.toc.2", moved.sel);
await page.keyboard.press("Control+d");
await settle();
const dup = await page.evaluate(() => ({ n: model.contents.toc.length, t3: model.contents.toc[3].t }));
check("Ctrl+D duplicates it", dup.n === keys0.n + 1 && dup.t3 === keys0.t1, JSON.stringify(dup));
await page.keyboard.press("Delete");
await settle();
check("Delete removes it", await page.evaluate(() => model.contents.toc.length) === keys0.n);
await page.keyboard.press("Escape");
check("Esc clears the selection", await page.evaluate(() => sel === null));
for (let i = 0; i < 3; i++) { await page.keyboard.press("Control+z"); await settle(); }
check("three undos walk back delete, duplicate and move",
  await page.evaluate(t => model.contents.toc[1].t === t, keys0.t1));

/* ---- 6. a theme preset is one step, and history belongs to its edition ---- */
const themed = await page.evaluate(async ms => {
  const was = model.theme.name, sel_ = document.querySelector("#themeSel");
  const opt = Array.from(sel_.options).find(o => o.value.startsWith("b:") && DB.THEMES[o.value.slice(2)].name !== was);
  sel_.value = opt.value; sel_.dispatchEvent(new Event("change"));
  await new Promise(r => setTimeout(r, ms));
  const applied = model.theme.name;
  undo();
  await new Promise(r => setTimeout(r, ms));
  return { was, applied, back: model.theme.name };
}, SETTLE);
check("a preset can be undone", themed.applied !== themed.was && themed.back === themed.was, JSON.stringify(themed));
const shelfH = await page.evaluate(async ms => {
  const first = shelf.current;
  window.__prompt = "Second";
  document.querySelector("#edNewBtn").click();
  await new Promise(r => setTimeout(r, ms));
  const fresh = document.querySelector("#undoBtn").disabled;
  switchEdition(first);
  await new Promise(r => setTimeout(r, ms));
  return { fresh, resumed: !document.querySelector("#undoBtn").disabled };
}, SETTLE);
check("a new edition starts with nothing to undo", shelfH.fresh);
check("switching back resumes that edition's history", shelfH.resumed);

/* ---- 7. cancelling the theme wizard restores the model exactly ----
   Two accents set to one colour used to collapse on the way back: re-tinting
   from the draft mapped both to whichever role came first. */
const wiz_ = await page.evaluate(async ms => {
  const before = JSON.stringify(model);
  openThemeWizard();
  wiz.step = 1; renderWizard();
  const hex = Array.from(document.querySelectorAll(".wiz .swrow input.hex"));
  hex[0].value = model.theme.orange; hex[0].dispatchEvent(new Event("input"));     // pink := orange
  await new Promise(r => setTimeout(r, ms));
  document.querySelector(".wiz .x").click();
  await new Promise(r => setTimeout(r, ms));
  return { same: JSON.stringify(model) === before };
}, SETTLE);
check("cancelling the theme wizard puts the model back exactly", wiz_.same);

/* ---- 8. Find: a field on the page, a field that is not, copy, a command ---- */
await page.keyboard.press("Control+k");
await page.waitForTimeout(150);
check("Ctrl+K opens Find", await page.evaluate(() => !document.querySelector("#palBack").hidden &&
  document.activeElement === document.querySelector("#palIn")));
await page.keyboard.type("deadline");
await page.waitForTimeout(100);
const found = await page.evaluate(() => ({
  first: palRes[0] && (palRes[0].path || palRes[0].label),
  groups: Array.from(document.querySelectorAll("#palList .grp")).map(g => g.textContent),
}));
check("Find ranks the field named for the query first", found.first === "submit.deadline", JSON.stringify(found));
await page.keyboard.press("Enter");
await settle();
// a long page takes a smooth scroll a moment: wait for it to land (up to 5 s)
await page.waitForFunction(() => {
  const d = document.querySelector("#preview").contentDocument, s = d && d.querySelector(".dz-sel");
  const r = s && s.getBoundingClientRect(), h = document.querySelector("#preview").clientHeight;
  return !!r && r.top >= 0 && r.bottom <= h;
}, null, { timeout: 5000 }).catch(() => {});
const went = await page.evaluate(() => {
  const d = document.querySelector("#preview").contentDocument, s = d.querySelector(".dz-sel");
  const r = s && s.getBoundingClientRect(), h = document.querySelector("#preview").clientHeight;
  return { closed: document.querySelector("#palBack").hidden, design: designOn,
           sel: sel && sel.paths.includes("submit.deadline"),
           focus: document.activeElement && document.activeElement.dataset.path,
           inView: !!r && r.top >= 0 && r.bottom <= h };
});
check("picking it closes Find", went.closed);
check("picking a printed field selects it on the page", went.design && went.sel, JSON.stringify(went));
check("…scrolls it into view", went.inView);
check("…and puts the cursor in it", went.focus === "submit.deadline", went.focus);

await page.evaluate(() => openPalette("golem"));
await page.waitForTimeout(100);
const copy = await page.evaluate(() => ({
  groups: Array.from(document.querySelectorAll("#palList .grp")).map(g => g.textContent),
  marked: !!document.querySelector("#palList .opt mark"),
}));
check("Find searches the copy itself", copy.groups.includes("In the copy"), copy.groups.join(","));
check("…and marks the words it matched", copy.marked);
await page.keyboard.press("Escape");

await page.evaluate(() => openPalette("bleed"));
await page.waitForTimeout(100);
await page.keyboard.press("Enter");
await settle();
const offpage = await page.evaluate(() => ({ fields: !designOn,
  focus: document.activeElement && document.activeElement.dataset.path }));
check("a field that never prints opens in All fields", offpage.fields && offpage.focus === "print.bleed", JSON.stringify(offpage));

await page.evaluate(() => openPalette("phone"));
await page.waitForTimeout(100);
const cmd = await page.evaluate(() => palRes[0] && palRes[0].kind);
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
check("Find runs commands", cmd === "cmd" &&
  await page.evaluate(() => document.querySelector("#preview").classList.contains("w-phone")));
await page.evaluate(() => setWidth("full"));

/* ---- 9. All fields: focus a field and the page shows where it goes ---- */
await page.evaluate(() => showMode("fields"));
await page.waitForTimeout(200);
const loc = await page.evaluate(async () => {
  const w = document.querySelector("#preview").contentWindow;
  w.scrollTo({ top: 0, behavior: "instant" });
  const inp = document.querySelector('#fieldsPane [data-path="calendar.title"]');
  inp.closest(".sec").classList.add("open");
  inp.focus();
  await new Promise(r => setTimeout(r, 900));        // a smooth scroll
  const el = elForPath("calendar.title"), r = el.getBoundingClientRect();
  return { y: w.scrollY, flashed: el.classList.contains("dz-flash"),
           inView: r.top >= 0 && r.bottom <= document.querySelector("#preview").clientHeight };
});
check("focusing a field scrolls the page to it", loc.y > 1000 && loc.inView, JSON.stringify(loc));
check("…and flashes it there", loc.flashed);

/* ---- 10. the accordion keeps its sections open through a rebuild ---- */
const acc = await page.evaluate(async ms => {
  const pane = document.querySelector("#fieldsPane");
  pane.querySelectorAll(".sec").forEach(s => s.classList.toggle("open", s.dataset.sec === "voices" || s.dataset.sec === "calendar"));
  applyTheme(DB.THEMES[Object.keys(DB.THEMES)[1]]);
  await new Promise(r => setTimeout(r, ms));
  return Array.from(pane.querySelectorAll(".sec.open")).map(s => s.dataset.sec).sort().join(",");
}, SETTLE);
check("a rebuild keeps the open sections open", acc === "calendar,voices", acc);

/* ---- 11. the formatting strip: where it shows, what it writes ---- */
const fmt = await page.evaluate(async ms => {
  const pane = document.querySelector("#fieldsPane");
  const rich = pane.querySelector('[data-path="calendar.dek"]').closest(".field");
  const plain = pane.querySelector('[data-path="calendar.sec"]').closest(".field");
  const inp = rich.querySelector("textarea");
  inp.value = "one two three"; inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.focus(); inp.setSelectionRange(4, 7);
  rich.querySelector(".fmt .fb").click();
  const wrapped = inp.value, sel1 = inp.value.slice(inp.selectionStart, inp.selectionEnd);
  rich.querySelector(".fmt .fb").click();
  const unwrapped = inp.value;
  inp.setSelectionRange(0, 3);
  inp.dispatchEvent(new KeyboardEvent("keydown", { key: "i", ctrlKey: true, bubbles: true, cancelable: true }));
  const italic = inp.value;
  window.__prompt = "https://example.org/?a=1";
  inp.setSelectionRange(inp.value.length - 5, inp.value.length);
  rich.querySelector(".fmt .fl").click();
  window.__prompt = undefined;
  await new Promise(r => setTimeout(r, ms));
  const html = DB.render(model);
  return { strip: !!rich.querySelector(".fmt"), none: !plain.querySelector(".fmt"),
           wrapped, sel1, unwrapped, italic, model: model.calendar.dek,
           rendered: html.includes('<i>one</i> two <a href="https://example.org/?a=1">three</a>') };
}, SETTLE);
check("fields that keep formatting get the strip", fmt.strip);
check("fields that escape it do not", fmt.none);
check("B wraps the selection and keeps it selected", fmt.wrapped === "one <b>two</b> three" && fmt.sel1 === "two", fmt.wrapped);
check("B again unwraps it", fmt.unwrapped === "one two three", fmt.unwrapped);
check("Ctrl+I in the field wraps in <i>", fmt.italic === "<i>one</i> two three", fmt.italic);
check("Link wraps in <a href>", /<a href="https:\/\/example\.org\/\?a=1">three<\/a>$/.test(fmt.model), fmt.model);
check("…and it prints as markup", fmt.rendered);

/* ---- 12. a deleted list row in All fields comes back too ---- */
const side = await page.evaluate(async ms => {
  const n0 = model.calendar.events.length;
  const wrap = document.querySelector('#fieldsPane .list-wrap[data-path="calendar.events"]');
  wrap.querySelector(".item .mini.del").click();
  await new Promise(r => setTimeout(r, ms));
  const n1 = model.calendar.events.length;
  document.querySelector("#undoBtn").click();
  await new Promise(r => setTimeout(r, ms));
  return { n0, n1, n2: model.calendar.events.length };
}, SETTLE);
check("✕ in All fields is undoable", side.n1 === side.n0 - 1 && side.n2 === side.n0, JSON.stringify(side));

/* ---- 13. the shortcuts sheet, Ctrl+S, and the menus ---- */
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await page.keyboard.press("?");
await page.waitForTimeout(100);
check("? opens the shortcuts sheet", await page.evaluate(() => !!document.querySelector("#keysBack")));
await page.keyboard.press("Escape");
await page.waitForTimeout(100);
check("Esc closes it", await page.evaluate(() => !document.querySelector("#keysBack")));
await page.keyboard.press("Control+s");
await page.waitForTimeout(100);
check("Ctrl+S is the studio's, not the browser's", /Saved/.test(await page.textContent("#toast")));
await page.click("#pdfMenuBtn");
const menus = await page.evaluate(() => ({
  pdf: !document.querySelector("#pdfMenu").classList.contains("off"),
  ed: !document.querySelector("#edMenu").classList.contains("off") }));
await page.click("#edMenuBtn");
const swapped = await page.evaluate(() => ({
  pdf: !document.querySelector("#pdfMenu").classList.contains("off"),
  ed: !document.querySelector("#edMenu").classList.contains("off") }));
await page.click("header.bar .brand");
const shut = await page.evaluate(() => document.querySelectorAll(".edmenu:not(.off)").length);
check("the PDF menu opens", menus.pdf && !menus.ed);
check("one menu at a time", swapped.ed && !swapped.pdf);
check("a click elsewhere closes it", shut === 0);

/* ---- 14. every upload goes through the image editor ---- */
await page.evaluate(() => { showMode("fields"); document.querySelector('.sec[data-sec="hero"]').classList.add("open"); });
const cover0 = await page.evaluate(() => model.hero.coverSrc);
await page.evaluate(() => document.querySelector('.sec[data-sec="hero"] .imgrow .btn2').click());
await page.locator("#fileImage").setInputFiles(path.join(ROOT, "assets/cover.jpg"));
await page.waitForSelector("#ieBack");
check("an upload opens the image editor, not the page", await page.evaluate(c => model.hero.coverSrc === c, cover0));
await page.click('#ieBack [data-a="cancel"]');
await page.waitForTimeout(200);
check("Cancel leaves the picture as it was", await page.evaluate(c => !document.querySelector("#ieBack") && model.hero.coverSrc === c, cover0));
await page.evaluate(() => document.querySelector('.sec[data-sec="hero"] .imgrow .btn2').click());
await page.locator("#fileImage").setInputFiles(path.join(ROOT, "assets/cover.jpg"));
await page.waitForSelector("#ieBack");
await page.click('.ie-ratios button[data-r="1"]');
await page.click('#ieBack [data-a="rr"]');
await page.click('#ieBack [data-a="ok"]');
await settle();
const edited = await page.evaluate(async () => {
  const im = new Image(); im.src = model.hero.coverSrc; await im.decode();
  return { w: im.width, h: im.height, data: /^data:image\/jpeg/.test(model.hero.coverSrc),
           edit: !document.querySelector('.sec[data-sec="hero"] .imgrow .btn2.edit').disabled };
});
check("a square crop comes out square", edited.data && edited.w === edited.h && edited.w > 100, JSON.stringify(edited));
check("a placed picture can be edited again", edited.edit);
await page.click("#undoBtn");
await settle();
check("an edited upload is one undo step", await page.evaluate(c => model.hero.coverSrc === c, cover0));

/* ---- 15. sticker artwork from local artists ---- */
const stick = await page.evaluate(async ms => {
  showMode("fields");
  const box = document.querySelector('.sec[data-sec="stickers"]'); box.classList.add("open");
  const field = box.querySelector('[data-path="stickers.items.0.img"]');
  model.stickers.items[0].img = "assets/cover.jpg"; model.stickers.items[0].by = "Jo Rivera";
  schedule();
  await new Promise(r => setTimeout(r, ms));
  // wait for the preview to re-map the new picture, however busy the page is
  for (let k = 0; k < 60; k++) {
    const im = document.querySelector("#preview").contentDocument.querySelector(".sticker-grid .sticker img.art");
    if (im && im.hasAttribute("data-dbimg")) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const d = document.querySelector("#preview").contentDocument, s0 = d.querySelector(".sticker-grid .sticker");
  return { field: !!field && !!field.closest(".field").querySelector(".imgrow"),
           img: !!s0.querySelector("img.art"), by: (s0.querySelector(".by") || {}).textContent,
           dropTarget: s0.querySelector("img.art") && s0.querySelector("img.art").getAttribute("data-dbimg") };
}, SETTLE);
check("each sticker has an artwork upload in All fields", stick.field);
check("uploaded artwork replaces the drawn sticker", stick.img);
check("…with the artist's credit under it", stick.by === "Jo Rivera", stick.by);
check("a file can be dropped straight onto a sticker on the page", stick.dropTarget === "stickers.items.0.img", stick.dropTarget);

/* ---- 16. Web PDF: one section, one sheet, no crop marks ---- */
const pp = await page.evaluate(async () => {
  const { frame, sheets } = await buildPrintFrame();
  const d = frame.contentDocument, W = parseFloat(frame.style.width), H = parseFloat(frame.style.height);
  const units = d.querySelectorAll(".pp-sheet").length;
  const sizes = Array.from(d.querySelectorAll(".pp-sheet")).every(s => {
    const r = s.getBoundingClientRect(); return Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1; });
  const inside = Array.from(d.querySelectorAll(".pp-fit")).every(f => {
    const r = f.getBoundingClientRect(), s = f.parentElement.getBoundingClientRect();
    return r.bottom <= s.bottom + 1 && r.right <= s.right + 1 && r.left >= s.left - 1; });
  const marks = d.querySelector(".cropmarks"), shown = marks && getComputedStyle(marks).display !== "none";
  const html = "<!doctype html>" + d.documentElement.outerHTML;
  frame.remove();
  const want = DB.SCHEMA.filter(s => /^Sec\./.test(s.tag || "")).length;
  return { n: sheets.length, units, sizes, inside, shown, W, H, html, labels: sheets.map(s => s.label) };
});
check("one sheet per section (a report each for Young Voices), plus the covers", pp.n === pp.units && pp.n >= 16, pp.n + " sheets: " + pp.labels.join(", "));
check("every sheet is exactly the trim size", pp.sizes);
check("nothing on a sheet runs past it", pp.inside);
check("the Web PDF carries no crop marks", !pp.shown);
{
  const q = await browser.newPage({ viewport: { width: Math.round(pp.W), height: Math.round(pp.H) } });
  await q.goto(URL_);
  await q.setContent(pp.html, { waitUntil: "load" });
  const pdf = (await q.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
  const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
  await q.close();
  check("printed, it is exactly that many pages", pages === pp.n, pages + " pages for " + pp.n + " sheets");
}

/* ---- 17. the sticker sheet for a cutting machine ---- */
const cut = await page.evaluate(async () => {
  const s = await stickerCutSheets();
  const im = new Image(); im.src = s[0]; await im.decode();
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  const x = c.getContext("2d"); x.drawImage(im, 0, 0);
  const a = (px, py) => x.getImageData(px, py, 1, 1).data[3];
  const L = s.layout, side = L.side * 300, gap = 75;
  const ox = (im.width - (L.cols * side + (L.cols - 1) * gap)) / 2, oy = (im.height - (L.rows * side + (L.rows - 1) * gap)) / 2;
  return { n: s.length, w: im.width, h: im.height, layout: L,
           corner: a(2, 2), gap: a(Math.round(ox + side + gap / 2), Math.round(oy + side / 2)),
           island: a(Math.round(ox + side / 2), Math.round(oy + side * 0.9)) };
});
check("the cutter sheet is Print Then Cut's 6.75 × 9.25 in at 300 dpi", cut.w === 2025 && cut.h === 2775, cut.w + "×" + cut.h);
check("twelve stickers fit one sheet at 2 in", cut.n === 1 && cut.layout.perSheet >= 12 && cut.layout.side === 2, JSON.stringify(cut.layout));
check("between stickers is transparent, so the blade goes round each", cut.corner === 0 && cut.gap === 0, JSON.stringify(cut));
check("each sticker is solid", cut.island === 255, cut.island);

/* ---- 18. word limits: one per writer's piece, measured on the pages that print ---- */
const wl = await page.evaluate(async () => {
  const a = await measureWordLimits();
  const pieces = [].concat(...Object.values(a).filter(x => x.pieces && !x.webOnly).map(x => x.pieces));
  const letter = a.letter.pieces[0];
  // fill the letter to its limit: its sheets must print at full size, nothing moved or lost
  const words = (PLAIN(model.letter.paragraphs.join(" ")).match(WORD_RE) || []);
  model.letter.paragraphs.push(Array.from({ length: letter.limit - letter.now }, (_, j) => words[j % words.length]).join(" "));
  const { frame, sheets } = await buildPrintFrame();
  const main = sheets.find(s => s.key === "letter");
  const ci = sheets.findIndex(s => s.key === "letter.cont"), cs = sheets[ci];
  const count = el => (PLAIN(el.textContent).match(WORD_RE) || []).length;
  const jump = main.unit.querySelector(".pp-jump");
  const cont = cs && { scale: cs.scale, sheet: ci + 1, of: sheets.length,
    split: count(main.unit.querySelector(".prose")) - count(jump) - 1 + count(cs.unit.querySelector(".pp-cont-body")),  // less the drop cap
    jump: jump.textContent, head: cs.unit.querySelector(".pp-cont-k").textContent,
    beforeBack: sheets.slice(ci + 1).every(s => /\.cont$|^footer$/.test(s.key)) };
  frame.remove();
  model.letter.paragraphs[model.letter.paragraphs.length - 1] += " " + Array(400).fill("word").join(" ");
  const b = await measureWordLimits();
  model.letter.paragraphs.pop();
  return { n: pieces.length, letter, atLimit: main.scale, after: b.letter.pieces[0], cont, target: letter.limit,
           voices: a.voices.pieces.length, voiceSheets: sheets.filter(s => /^voices\.\d+$/.test(s.key)).length,
           comics: a.comics, submit: a.submit };
});
check("every writer's piece gets a limit", wl.n >= 10, wl.n + " pieces");
check("a long piece's limit is its first page and its Continued page", wl.letter.pages && wl.letter.pages.length === 2 &&
  wl.letter.pages[0] + wl.letter.pages[1] === wl.letter.limit, JSON.stringify(wl.letter));
check("each young-voices report is its own piece and its own sheet", wl.voices === 3 && wl.voiceSheets === 3, wl.voices + " pieces, " + wl.voiceSheets + " sheets");
check("a piece at its limit prints at the size it was measured at, not shrunk", wl.atLimit >= wl.letter.scale - 0.01, wl.atLimit + " vs " + wl.letter.scale);
check("a long piece at its limit carries on onto a Continued sheet before the back cover",
  wl.cont && wl.cont.beforeBack, JSON.stringify(wl.cont));
check("…which prints at the magazine's one text size", wl.cont && Math.abs(wl.cont.scale - 0.8) < 0.005, wl.cont && String(wl.cont.scale));
check("…and between the two sheets no word is lost or doubled", wl.cont && wl.cont.split === wl.target, wl.cont && wl.cont.split + " of " + wl.target);
check("…and each sheet points to the other", wl.cont && wl.cont.jump === "Continued on sheet " + wl.cont.sheet + " →" && /^Continued from sheet \d+$/.test(wl.cont.head),
  wl.cont && wl.cont.jump + " / " + wl.cont.head);
check("400 more words puts it over, by about that much",
  wl.after.over && Math.abs((wl.after.now - wl.after.limit) - (wl.after.now - wl.letter.limit)) < 30, JSON.stringify(wl.after));
check("a page its pictures fill says so instead of a number", wl.comics && wl.comics.pictures === true, JSON.stringify(wl.comics));
check("a section with no printed slot keeps its web measure", wl.submit && wl.submit.webOnly, JSON.stringify(wl.submit));

/* ---- 19. none of this leaks into what publishes ---- */
const clean = await page.evaluate(() => !/data-dbp|data-dbi|dz-flash|dz-locate|⁣/.test(DB.render(model)));
check("published HTML carries no editor hooks", clean);

await browser.close();
server.close();

console.log("studio editor: " + ok.length + " pass, " + bad.length + " fail");
ok.forEach(s => console.log("  ✓ " + s));
bad.forEach(s => console.log("  ✗ " + s));
process.exit(bad.length ? 1 : 0);
