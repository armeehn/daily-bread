#!/usr/bin/env node
/**
 * extract.js — the magazine's page plan, measured off the pages the press prints.
 *
 *   node tools/wireframe/extract.js [--model <edition.json>] [--out <spec.json>]
 *
 * The press (tools/press/render.js) lays DB.render(model) out on A5 sheets with
 * db-print.js. This walks those laid-out sheets and records, page by page, where
 * every block lands — headlines, kickers, decks, body text, cards, pictures,
 * stats, pull quotes, captions — as a box in millimetres from the trim's top
 * left, with its role, its section, its ground and (for a writer's piece) its
 * word limit. It also measures the type styles off the CSS at the magazine's
 * print scale, and takes the swatches from the edition's theme.
 *
 * The result (spec.json) is what build_sla.py and build_idml.py turn into a
 * Scribus document and an InDesign/Affinity IDML package, so the DTP wireframe
 * is the same layout as the website, the Web PDF and the printed booklet.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const { renderSheets, geometry, limits } = require(path.join(ROOT, "tools", "press", "render.js"));
const DB = require(path.join(ROOT, "db.js"));

/* ---- in the page: classify and measure every block on every sheet ---------- */
function measureInPage() {
  // role -> selectors, first match wins; a text block takes its whole subtree
  const ROLES = [
    ["image", "img, svg, .slot, .comic-strip, .cover-frame, .centrefold, .sticker-grid, .barcode, .plate-row"],
    ["card", ".card"],
    ["stat", ".stat"],
    ["stamp", ".stamp, .printbtn"],
    ["sechead", ".sechead"],
    ["wordmark", ".hero .mast"],
    ["headline", "h1, h2, .brandline, .poem h3, .colour-h, .report h3, .revcard h3, .pp-cont-t"],
    ["pull", ".pull, .said, .bigquote, .signoff, .scribble"],
    ["dek", ".dek, p.intro, footer p.blurb"],
    ["caption", "figcaption"],
    ["body", ".prose, .report .bd > p, .poem .lines, .qa, .checkline, .list, .bd > p, footer .colophon"],
    ["kicker", ".kicker, .tagline, .issueline, .meta, .fine, .tg, .attrib, .tagend, .hd, .pp-cont-k, .pp-jump"],
  ];
  const TEXTY = new Set(["sechead", "wordmark", "headline", "pull", "dek", "caption", "body", "kicker", "stamp", "stat"]);
  const sheets = Array.from(document.querySelectorAll(".pp-book > .pp-sheet"));
  const out = [];
  const px = (v) => parseFloat(v) || 0;
  const styleOf = (el, zoom) => {
    // the type of a block: the element that holds most of its text (not a drop cap
    // or a chip that happens to come first)
    let t = el;
    const tally = new Map();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const k = n.nodeValue.trim().length;
      if (k) tally.set(n.parentElement, (tally.get(n.parentElement) || 0) + k);
    }
    let most = 0;
    for (const [e, k] of tally) if (k > most) { most = k; t = e; }
    const cs = getComputedStyle(t);
    const lh = cs.lineHeight === "normal" ? px(cs.fontSize) * 1.2 : px(cs.lineHeight);
    return {
      family: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      sizePt: +(px(cs.fontSize) * zoom * 0.75).toFixed(2),
      leadingPt: +(lh * zoom * 0.75).toFixed(2),
      weight: +cs.fontWeight || 400, italic: cs.fontStyle === "italic",
      trackingEm: cs.letterSpacing === "normal" ? 0 : +(px(cs.letterSpacing) / px(cs.fontSize)).toFixed(3),
      caps: cs.textTransform === "uppercase", align: cs.textAlign, color: cs.color,
    };
  };
  sheets.forEach((sheet, si) => {
    const r0 = sheet.getBoundingClientRect();
    const B = px(getComputedStyle(sheet).paddingLeft);
    const trimW = r0.width - 2 * B, trimH = r0.height - 2 * B;
    const fit = sheet.querySelector(".pp-fit");
    const zoom = parseFloat(fit.style.zoom) || 1;
    const boxes = [];
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - r0.left - B, y: r.top - r0.top - B, w: r.width, h: r.height };
    };
    const visit = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      let role = null;
      for (const [k, sel] of ROLES) if (el.matches(sel)) { role = k; break; }
      if (role === "image" && el.closest(".slot") && el !== el.closest(".slot")) role = null;
      if (role) {
        const b = box(el);
        if (b.w >= 2 && b.h >= 2) {
          // line breaks kept (a headline's <br>), runs of space folded
          const text = (el.innerText || "").replace(/[ \t\u00a0]+/g, " ").replace(/ *\n[\s]*/g, "\n").trim();
          const item = { role, ...b, text: text.slice(0, 400), words: (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || []).length,
                         cls: el.className && typeof el.className === "string" ? el.className : el.tagName.toLowerCase() };
          if (TEXTY.has(role)) item.style = styleOf(el, zoom);
          if (role === "image") item.alt = el.getAttribute("aria-label") || el.getAttribute("alt") || (el.querySelector("img") || {}).alt || text.slice(0, 120);
          if (role === "card") {
            const hd = el.querySelector(":scope > .hd"), bd = el.querySelector(":scope > .bd");
            item.stroke = cs.borderTopColor; item.fill = cs.backgroundColor; item.shadow = cs.boxShadow !== "none";
            boxes.push(item);
            if (hd) { const hb = box(hd); boxes.push({ role: "cardhead", ...hb, text: hd.innerText.replace(/\s+/g, " ").trim(), words: 0,
                        style: styleOf(hd, zoom), fill: getComputedStyle(hd).backgroundColor }); }
            if (bd) {
              if (bd.querySelector("img, svg, .slot")) Array.from(bd.children).forEach(visit);
              else { const t = bd.innerText.replace(/\s+/g, " ").trim(); const bb = box(bd);
                     boxes.push({ role: "cardbody", ...bb, text: t.slice(0, 400), words: (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || []).length, style: styleOf(bd, zoom) }); }
            }
            return;
          }
          if (role === "stat") { item.fill = cs.backgroundColor; item.stroke = cs.borderTopColor; }
          boxes.push(item);
          if (role !== "sechead") return;           // a block takes its subtree
          return;
        }
      }
      Array.from(el.children).forEach(visit);
    };
    Array.from(fit.children).forEach(visit);
    out.push({ index: si, trimPx: [trimW, trimH], zoom, ground: sheet.style.background || getComputedStyle(sheet).backgroundColor, boxes });
  });
  return out;
}

function rgbOf(css) {
  const m = String(css).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
  if (!m) return null;
  if (m[4] !== undefined && +m[4] === 0) return null;
  return [+m[1], +m[2], +m[3]];
}
const hex = (rgb) => "#" + rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");

async function extract(model) {
  const r = await renderSheets(model, { inspect: (page) => page.evaluate(measureInPage) });
  const g = geometry(r.model);
  const MM = 25.4 / 72;
  const trimMm = [g.tw * MM, g.th * MM], bleedMm = g.b * MM;
  const theme = model.theme || {};
  const swatches = Object.entries(theme).filter(([k, v]) => /^#[0-9a-f]{6}$/i.test(v))
    .map(([k, v]) => ({ name: k, hex: v.toLowerCase() }));
  const near = (rgb) => {
    if (!rgb) return null;
    let best = null, d = Infinity;
    for (const s of swatches) {
      const c = [1, 3, 5].map(i => parseInt(s.hex.slice(i, i + 2), 16));
      const e = Math.hypot(c[0] - rgb[0], c[1] - rgb[1], c[2] - rgb[2]);
      if (e < d) { d = e; best = s.name; }
    }
    if (d > 24) {                      // a colour the theme does not name: its own swatch
      const h = hex(rgb);
      if (!swatches.some(s => s.hex === h)) swatches.push({ name: "extra " + h, hex: h });
      return "extra " + h;
    }
    return best;
  };

  // writers' pieces and their limits, to label the frames that hold them
  const lim = await limits(model);
  const P = require(path.join(ROOT, "db-print.js"));

  const pages = r.sheets.map((sh, i) => {
    const m = r.inspected[i];
    const k = trimMm[0] / m.trimPx[0];
    const ground = near(rgbOf(m.ground));
    const frames = m.boxes.map(b => {
      const f = { role: b.role, x: +(b.x * k).toFixed(2), y: +(b.y * k).toFixed(2), w: +(b.w * k).toFixed(2), h: +(b.h * k).toFixed(2),
                  text: b.text, words: b.words };
      if (b.alt) f.alt = b.alt;
      if (b.style) f.style = Object.assign({}, b.style, { color: near(rgbOf(b.style.color)) });
      if (b.fill) f.fill = near(rgbOf(b.fill));
      if (b.stroke) f.stroke = near(rgbOf(b.stroke));
      if (b.shadow) f.shadow = true;
      return f;
    }).filter(f => f.w > 0.5 && f.h > 0.5 && f.x < trimMm[0] + bleedMm && f.y < trimMm[1] + bleedMm);
    // the writer's piece on this page: its largest body frame gets the limit
    const pieces = lim.filter(p => P.pieceSheet(p.path) === sh.key.replace(/\.cont$/, ""));
    if (pieces.length) {
      const body = frames.filter(f => f.role === "body" || f.role === "dek").sort((a, b) => b.w * b.h - a.w * a.h)[0];
      if (body) {
        const pc = pieces[0];
        body.piece = { path: pc.path, limit: pc.pages ? (/\.cont$/.test(sh.key) ? pc.pages[1] : pc.pages[0]) : pc.limit, total: pc.limit };
      }
    }
    return { n: i + 1, key: sh.key, label: sh.label, scale: sh.scale, ground, frames };
  });

  // A saddle-stitched magazine has a multiple of four pages with the back cover
  // last: spare pages go in just before it, as the press puts them.
  while (pages.length % 4) {
    pages.splice(pages.length - 1, 0, { key: "spare", label: "spare page", scale: 0.8, ground: "bone", frames: [
      { role: "kicker", x: 12, y: 12, w: trimMm[0] - 27, h: 6, words: 0,
        text: "SPARE PAGE — the issue needs a multiple of four pages. An ad, a notes page, or room for a piece to run on.",
        style: { family: "IBM Plex Mono", sizePt: 6.6, leadingPt: 9, weight: 700, caps: true, trackingEm: 0.18, align: "left", color: "muted" } }] });
  }
  pages.forEach((p, i) => { p.n = i + 1; });

  return {
    title: "Daily Bread " + ((model.meta && model.meta.issueNo) || ""),
    issue: (model.meta && model.meta.issueNo) || "", theme: theme.name || "",
    trimMm: trimMm.map(v => +v.toFixed(2)), bleedMm: +bleedMm.toFixed(2),
    // A5 magazine margins: the type area every page is drawn inside (guides only;
    // the frames sit where the layout puts them)
    marginsMm: { top: 12, bottom: 15, inside: 15, outside: 12 },
    columns: { count: 2, gutterMm: 5 },
    baselinePt: 15,
    fonts: ["IBM Plex Mono", "Caveat", "UnifrakturMaguntia"],
    swatches, pages,
  };
}

module.exports = { extract };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  (async () => {
    const model = opt("--model") ? JSON.parse(fs.readFileSync(opt("--model"), "utf8")) : DB.clone(DB.DEFAULT_MODEL);
    const spec = await extract(model);
    const out = path.resolve(opt("--out") || path.join(ROOT, "build", "wireframe", "spec.json"));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(spec, null, 1) + "\n");
    const n = spec.pages.reduce((a, p) => a + p.frames.length, 0);
    console.log(`${path.relative(ROOT, out)}: ${spec.pages.length} pages, ${n} frames, ${spec.swatches.length} swatches`);
  })().catch(e => { console.error(e && e.stack || e); process.exit(1); });
}
