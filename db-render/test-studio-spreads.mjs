/**
 * test-studio-spreads.mjs — the studio's "Spreads" view shows the printed pages
 * as the folded booklet shows them.
 *
 *   node db-render/test-studio-spreads.mjs
 *
 * Opens studio.html, picks Print ▸ Spreads and checks: (1) a dialog opens with
 * the magazine's sheets, padded with spare pages to a multiple of four, the
 * spares just before the back cover (as tools/press/render.js pads); (2) the
 * cover sits alone on the right, the back cover alone on the left, and each pair
 * between meets at the fold, cut to the trim; (3) pinning the layout before the
 * frame grows leaves every sheet's content as it was laid out, the back cover
 * too; (4) resized, the view fits the window as one opened at that size does;
 * (5) Escape closes
 * it and takes the frame away; (6) an edition two pages short of a multiple of
 * four gets its two spares just before the back cover.
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
const PAGES_PER_SIGNATURE = 4;   // a saddle-stitched booklet: a multiple of four pages
const FOLD_PX = 1;               // facing pages meet: no gap wider than this at the fold
const LAYOUT_MS = 60000;
const MIN_PAGE_PX = 250;         // a page in a 1400 x 900 window, a whole spread in its height
const SMALL = { width: 800, height: 600 };    // the window shrunk after the view opens
const LARGE = { width: 1900, height: 1000 };  // and grown past where it opened
const CENTRE_PX = 2;             // the view sits centred in the window to this
const ODD_SECTION = "essay";     // without it the default edition is 46 pages

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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(URL_, { waitUntil: "networkidle" });

/* ---- (1) the dialog and its pages ---- */
await page.click("#pdfMenuBtn");
const hasButton = await page.isVisible("#spreadsBtn");
check("Print menu has a Spreads button", hasButton);

if (!hasButton) {
  await finish();
}

await page.click("#spreadsBtn");
await page.waitForSelector(".spreads[role=dialog]", { timeout: LAYOUT_MS });
await page.waitForFunction(() => document.querySelector(".spreads-frame")?.dataset.laid === "1", null, { timeout: LAYOUT_MS });

const measure = () => page.evaluate(() => {
  const fr = document.querySelector(".spreads-frame"), doc = fr.contentDocument;
  const fb = fr.getBoundingClientRect();
  const sheets = [...doc.querySelectorAll(".pp-book > .pp-sheet")];

  // the frame is scaled up by k from its own pixels to the window's
  const k = fb.width / fr.offsetWidth;

  // the visible page: the sheet's box less its clip, in the window's pixels
  const box = s => {
    const r = s.getBoundingClientRect(), cs = doc.defaultView.getComputedStyle(s);
    const m = cs.clipPath.match(/inset\(([\d.]+)px ([\d.]+)px\)/);
    const z = parseFloat(doc.querySelector(".pp-book").dataset.scale) || 1;
    const [y, x] = m ? [parseFloat(m[1]) * z, parseFloat(m[2]) * z] : [0, 0];
    return { left: fb.left + (r.left + x) * k, right: fb.left + (r.right - x) * k, top: fb.top + (r.top + y) * k, bottom: fb.top + (r.bottom - y) * k, clipped: !!m };
  };

  return {
    count: sheets.length,
    spares: sheets.map((s, i) => s.classList.contains("pp-spare") ? i : -1).filter(i => i >= 0),
    boxes: sheets.map(box),
    mid: fb.left + fb.width / 2,
    width: window.innerWidth,
    height: window.innerHeight,
    pinned: sheets.map(s => s.dataset.h || ""),
    // layout pixels, which the view's scaling does not change: what a sheet
    // holds is its .pp-fit, or on the covers the section itself
    after: sheets.map(s => { const f = s.querySelector(".pp-fit") || s.firstElementChild; return f ? String(f.offsetHeight) : ""; }),
    frame: { left: fb.left, right: fb.right },
  };
});
const got = await measure();

check("pages are a multiple of four", got.count > 0 && got.count % PAGES_PER_SIGNATURE === 0, String(got.count));

const n = got.count, firstSpare = got.spares.length ? got.spares[0] : n - 1;
const sparesLast = got.spares.every((s, i) => s === firstSpare + i) && (got.spares.length === 0 || got.spares[got.spares.length - 1] === n - 2);
check("spare pages sit just before the back cover", sparesLast, got.spares.join(","));

/* ---- (2) cover right, back left, pairs at the fold ---- */
const [cover, p2, p3] = got.boxes;
const back = got.boxes[n - 1];
check("every page is cut to its trim", got.boxes.every(b => b.clipped));
check("every page shows at a readable size", got.boxes.every(b => b.right - b.left >= MIN_PAGE_PX),
  `cover ${Math.round(cover.right - cover.left)} px wide`);
check("the cover sits alone on the right", cover.left >= got.mid - FOLD_PX, `${Math.round(cover.left)} vs mid ${Math.round(got.mid)}`);
check("pages 2 and 3 face each other at the fold",
  Math.abs(p2.right - p3.left) <= FOLD_PX && Math.abs(p2.top - p3.top) <= FOLD_PX && p2.top > cover.top,
  `${Math.round(p2.right)}|${Math.round(p3.left)}`);
check("the back cover sits alone on the left", back.right <= got.mid + FOLD_PX, `${Math.round(back.right)} vs mid ${Math.round(got.mid)}`);
check("the spreads fit the window's width", got.boxes.every(b => b.left >= 0 && b.right <= got.width + FOLD_PX));
check("a whole spread fits the window's height", p2.bottom - p2.top <= got.height, `${Math.round(p2.bottom - p2.top)} of ${got.height} px`);

/* ---- (3) growing the frame left the laid-out pages alone ---- */
const same = got.pinned.every((h, i) => !h || h === got.after[i]);
const allPinned = got.pinned.every((h, i) => h || got.spares.includes(i));
check("every page, the back cover too, was measured before the frame grew", allPinned,
  got.pinned.map((h, i) => h || got.spares.includes(i) ? "" : "page " + (i + 1)).filter(Boolean).join(", "));
check("each page holds what it held when laid out", got.pinned.some(Boolean) && same,
  got.pinned.map((h, i) => h + "/" + got.after[i]).filter((s, i) => got.pinned[i] && got.pinned[i] !== got.after[i]).slice(0, 4).join(" "));

/* ---- (4) the view follows the window ---- */
const fits = m => {
  const spread = m.boxes[1];
  return m.boxes.every(b => b.left >= -FOLD_PX && b.right <= m.width + FOLD_PX) && spread.bottom - spread.top <= m.height &&
    Math.abs((m.frame.left + m.frame.right) / 2 - m.width / 2) <= CENTRE_PX;
};
const show = m => `frame ${Math.round(m.frame.left)}..${Math.round(m.frame.right)}, spread ${Math.round(m.boxes[1].bottom - m.boxes[1].top)} px tall in ${m.width}x${m.height}`;
const openSpreads = async () => {
  await page.click("#pdfMenuBtn");
  await page.click("#spreadsBtn");
  await page.waitForFunction(() => document.querySelector(".spreads-frame")?.dataset.laid === "1", null, { timeout: LAYOUT_MS });
};
const tall = m => m.boxes[1].bottom - m.boxes[1].top;
for (const [name, size] of [["shrunk", SMALL], ["grown", LARGE]]) {
  await page.setViewportSize(size);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const m = await measure();

  // the same size, opened fresh: what the resized view must match
  await page.keyboard.press("Escape");
  await openSpreads();
  const fresh = await measure();
  const asOpened = Math.abs(tall(m) - tall(fresh)) <= FOLD_PX && Math.abs(m.frame.left - fresh.frame.left) <= CENTRE_PX;
  check(`window ${name} to ${size.width}x${size.height}: the spreads fit, centred, as if opened at that size`,
    fits(m) && asOpened, show(m) + `; opened fresh ${Math.round(tall(fresh))} px`);
}
await page.setViewportSize({ width: 1400, height: 900 });

/* ---- (5) Escape closes it ---- */
await page.keyboard.press("Escape");
const gone = await page.evaluate(() => !document.querySelector(".spreads") && !document.querySelector(".spreads-frame"));
check("Escape closes the spreads and drops the frame", gone);

/* ---- (6) spares, on an edition that needs them ---- */
await page.evaluate(key => { window.__keep = model[key]; delete model[key]; }, ODD_SECTION);
await openSpreads();
const odd = await measure();
const m2 = odd.count;
check(`without the ${ODD_SECTION}: two spares, just before the back cover`,
  m2 % PAGES_PER_SIGNATURE === 0 && JSON.stringify(odd.spares) === JSON.stringify([m2 - 3, m2 - 2]),
  `spares at ${odd.spares.map(i => i + 1).join(", ") || "none"} of ${m2}`);
await page.keyboard.press("Escape");
await page.evaluate(key => { model[key] = window.__keep; }, ODD_SECTION);

await finish();

async function finish() {
  await browser.close();
  server.close();


  for (const l of ok) {
    console.log("  ✓ " + l);
  }

  for (const l of bad) {
    console.log("  ✗ " + l);
  }

  console.log(`studio spreads: ${ok.length} pass, ${bad.length} fail`);
  process.exit(bad.length ? 1 : 0);
}
