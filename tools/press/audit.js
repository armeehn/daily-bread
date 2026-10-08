#!/usr/bin/env node
/**
 * audit.js — measure the printed magazine against the local-magazine design
 * rules: can it be read, can its listings be found, does the cover work on a
 * rack. The rules and their sources are in the local-magazine-design skill;
 * this is the part a machine can check.
 *
 *   node tools/press/audit.js [--json] [--strict]
 *
 * Lays the default edition out exactly as the press does (studio.html's
 * buildPrintFrame, db-print.js) and measures each page at print size:
 *
 *   rule              what is measured                              bar
 *   body-size         running text, pt at print (≥ 40 words)         ≥ 10 pt
 *                     captions and credits (15–39 words)             ≥ 8 pt
 *   leading           line height / type size                       ≥ 1.25
 *   measure           characters per line of running text            45–75 (mono)
 *   ragged-right      justified running text                        none
 *   roman-body        italic running text                           none
 *   body-contrast     running text against its ground (WCAG ratio)  ≥ 4.5
 *   script-short      Caveat (handwriting) runs                     ≤ 10 words
 *   folios            a page number on every page but covers/plates  all
 *   contents-pages    contents' page numbers point at the real pages all
 *   cover-rack        price and issue in the cover's top-left third  yes
 *
 * Exit code: 0, or 1 with --strict when any rule fails.
 */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..", "..");
const JSON_OUT = process.argv.includes("--json");
const STRICT = process.argv.includes("--strict");
const PT_PER_PX = 0.75;                 // CSS px at 96 to the inch, pt at 72
const RUNNING_WORDS = 15;               // a block with this many words of its own is running text
const BAR = { size: 10, small: 8, leading: 1.25, measureMin: 45, measureMax: 75, contrast: 4.5, scriptWords: 10 };
const PT_SLACK = 0.1;                   // a size this close to the bar is the bar, after zoom rounding
const BODY_WORDS = 40;                  // a block this long is body copy; shorter running text is a caption or credit
const MONO_ADVANCE = 0.6;               // IBM Plex Mono: every glyph is 600/1000 em wide
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css",
                ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

async function main() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/studio.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof buildPrintFrame === "function");

  const found = await page.evaluate(measure, { RUNNING_WORDS, PT_PER_PX, MONO_ADVANCE, BAR });
  await browser.close();
  server.close();

  const rules = judge(found);
  if (JSON_OUT) {
    console.log(JSON.stringify({ pages: found.pages.length, rules }, null, 1));
  } else {
    for (const r of rules) {
      console.log(`${r.ok ? "  ✓" : "  ✗"} ${r.id.padEnd(15)} ${r.summary}`);
      for (const o of r.offenders.slice(0, 8)) { console.log(`      ${o}`); }
      if (r.offenders.length > 8) { console.log(`      … ${r.offenders.length - 8} more`); }
    }
    const bad = rules.filter(r => !r.ok).length;
    console.log(`design audit: ${rules.length - bad} of ${rules.length} rules met, ${found.pages.length} pages`);
  }
  process.exit(STRICT && rules.some(r => !r.ok) ? 1 : 0);
}

/* ---- in the studio: lay the issue out and measure every page (runs in the browser) ---- */
async function measure(K) {
  const { frame, sheets } = await buildPrintFrame();
  const d = frame.contentDocument, win = frame.contentWindow, els = Array.from(d.querySelectorAll(".pp-sheet"));
  const ownText = el => Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.nodeValue).join(" ").trim();
  const words = s => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  const zoomOf = el => { let z = 1; for (let e = el; e; e = e.parentElement) { const v = parseFloat(e.style && e.style.zoom); if (v) { z *= v; } } return z; };
  // rgb(…) is 0-255; color(srgb …), what color-mix() computes to, is 0-1
  const rgb = s => { const v = (s.match(/[\d.]+/g) || []).map(Number); return /^color\(srgb/.test(s) ? v.map((x, i) => i < 3 ? x * 255 : x) : v; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  // the colour behind a block: the first solid background up the tree; a painted
  // (image or gradient) ground cannot be read this way, so it is left unmeasured
  const ground = el => {
    for (let e = el; e; e = e.parentElement) {
      const cs = win.getComputedStyle(e), c = rgb(cs.backgroundColor);
      if (c.length >= 3 && (c.length < 4 || c[3] > 0.5)) { return c; }
      if (cs.backgroundImage && cs.backgroundImage !== "none") { return null; }
      if (e.classList && e.classList.contains("pp-sheet")) { const sc = rgb(e.style.background || ""); return sc.length >= 3 ? sc : null; }
    }
    return null;
  };
  const ratio = (a, b) => { if (!b) { return null; } const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  const pages = sheets.map((s, i) => {
    const sh = els[i], fit = sh.querySelector(".pp-fit");
    const blocks = [], script = [];
    fit.querySelectorAll("p, li, .li, dd, blockquote, .t, .bd, .prose > *").forEach(el => {
      const t = ownText(el), n = words(t), cs = win.getComputedStyle(el);
      if (/Caveat/i.test(cs.fontFamily) && n) { script.push({ words: n, text: t.slice(0, 40) }); }
      if (n < K.RUNNING_WORDS || cs.display === "none") { return; }
      const z = zoomOf(el), px = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) || px * 1.2;
      const width = el.getBoundingClientRect().width / z;          // laid-out width, in its own px
      blocks.push({
        text: t.slice(0, 40), words: n, pt: +(px * z * K.PT_PER_PX).toFixed(2), leading: +(lh / px).toFixed(2),
        cpl: Math.round(width / (px * K.MONO_ADVANCE)), mono: /Mono/i.test(cs.fontFamily),
        justify: cs.textAlign === "justify", italic: cs.fontStyle === "italic",
        contrast: (r => r === null ? null : +r.toFixed(2))(ratio(rgb(cs.color), ground(el))),
        cls: el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).join(".") : ""),
        colors: cs.color + " on " + (ground(el) ? "rgb(" + ground(el).slice(0, 3).join(", ") + ")" : "painted"),
      });
    });
    // a folio: a page number printed on the page (db-print.js marks it .pp-folio)
    const folio = sh.querySelector(".pp-folio");
    return { n: i + 1, key: s.key, label: s.label, blocks, script, folio: folio ? folio.textContent.trim() : null };
  });

  // the contents page: each entry's page chip against where that section really prints
  const toc = [];
  const ci = sheets.findIndex(s => s.key === "contents");
  if (ci >= 0) {
    els[ci].querySelectorAll(".toc-grid .li").forEach(li => {
      const pg = (li.querySelector(".pgchip") || {}).textContent || "", t = (li.querySelector(".t") || li).textContent.trim();
      toc.push({ pg: pg.trim(), title: t.slice(0, 60) });
    });
  }
  // the cover on a rack: where the price and the issue sit, as shares of the page
  let cover = null;
  if (sheets[0] && sheets[0].key === "cover") {
    const r = els[0].getBoundingClientRect(), at = sel => { const e = els[0].querySelector(sel); if (!e) { return null; } const q = e.getBoundingClientRect(); return { x: (q.left - r.left) / r.width, y: (q.top - r.top) / r.height, text: e.textContent.trim() }; };
    cover = { price: at(".free"), issue: at(".pp-cover-issue") };
  }
  const where = {};
  sheets.forEach((s, i) => { if (!(s.key in where)) { where[s.key] = i + 1; } });
  frame.remove();
  return { pages, toc, cover, where };
}

/* ---- the verdicts ---- */
function judge(f) {
  const all = f.pages.flatMap(p => p.blocks.map(b => ({ ...b, page: p.n, label: p.label })));
  const at = b => `p${b.page} ${b.label} ${b.cls}: “${b.text}”`;
  const rule = (id, offenders, summary) => ({ id, ok: !offenders.length, offenders, summary });
  const size = all.map(b => b.pt).sort((a, b) => a - b), median = size[Math.floor(size.length / 2)] || 0;
  const PLATES = /^(cover|footer|appendix\..+)$/;     // the covers, and the appendix's cutter pages
  // a contents entry names a section; the section's first page is where it should point
  // (an entry naming several, "Ask a Local Gay / Reviews / Calendar", points at the first)
  const KEYS = { "editor": "letter", "history": "history", "photo": "essay", "young voices": "voices.0", "crumbs —": "comics",
                 "interview": "interview", "nerve": "interview", "poem": "poetry", "calendar": "calendar", "directory": "directory",
                 "go-bag": "gobag", "ask a local": "advice", "review": "reviews", "lab": "lab", "sticker": "stickers",
                 "crumbs mail": "mail", "submit": "submit", "waitlist": "waitlist", "wall": "art", "colour": "colouring" };
  const tocOff = !f.toc.length ? ["the contents page lists no entries"] : f.toc.map(e => {
    const first = e.title.toLowerCase().split(/\s[\/+]\s/)[0];
    const hits = Object.keys(KEYS).map(w => [first.indexOf(w), w]).filter(h => h[0] >= 0).sort((a, b) => a[0] - b[0]);
    const k = hits.length ? hits[0][1] : null, real = k && f.where[KEYS[k]];
    return real && parseInt(e.pg, 10) !== real ? `“${e.title}” says ${e.pg}, prints on p${real}` : null;
  }).filter(Boolean);
  return [
    rule("body-size", all.filter(b => b.pt < (b.words >= BODY_WORDS ? BAR.size : BAR.small) - PT_SLACK).map(b => `${at(b)} ${b.pt} pt`),
      `body ≥ ${BAR.size} pt, captions ≥ ${BAR.small} pt at print: median ${median} pt, smallest ${size[0]} pt over ${all.length} blocks`),
    rule("leading", all.filter(b => b.leading < BAR.leading).map(b => `${at(b)} ×${b.leading}`), `line height ≥ ${BAR.leading}× the type size`),
    rule("measure", all.filter(b => b.mono && b.words >= BODY_WORDS && (b.cpl < BAR.measureMin || b.cpl > BAR.measureMax)).map(b => `${at(b)} ${b.cpl} chars/line`),
      `body copy ${BAR.measureMin}–${BAR.measureMax} characters a line`),
    rule("ragged-right", all.filter(b => b.justify).map(at), "running text set ragged right, never justified"),
    rule("roman-body", all.filter(b => b.italic).map(at), "running text in roman, italic only for titles"),
    rule("body-contrast", all.filter(b => b.contrast !== null && b.contrast < BAR.contrast).map(b => `${at(b)} ${b.contrast}:1 (${b.colors})`),
      `running text ≥ ${BAR.contrast}:1 against its ground (${all.filter(b => b.contrast === null).length} on painted grounds not measured)`),
    rule("script-short", f.pages.flatMap(p => p.script.filter(s => s.words > BAR.scriptWords).map(s => `p${p.n} ${p.label}: “${s.text}” ${s.words} words`)),
      `handwriting (Caveat) ≤ ${BAR.scriptWords} words a use`),
    rule("folios", f.pages.filter(p => !PLATES.test(p.key) && !p.folio).map(p => `p${p.n} ${p.label}`), "a page number on every page but the covers and plates"),
    rule("contents-pages", tocOff, "the contents' page numbers point at the pages that print them"),
    rule("cover-rack", !f.cover ? ["no cover page"] : [
      ...(!f.cover.price || f.cover.price.x > 1 / 3 || f.cover.price.y > 1 / 3 ? [`price at ${f.cover.price ? `${Math.round(f.cover.price.x * 100)}%, ${Math.round(f.cover.price.y * 100)}%` : "nowhere"}`] : []),
      ...(!f.cover.issue || f.cover.issue.x > 1 / 3 || f.cover.issue.y > 1 / 3 ? ["issue number not in the top-left third"] : []),
    ], "the cover's price and issue number in its top-left third, where a rack shows it"),
  ];
}

main().catch(e => { console.error(e); process.exit(2); });
