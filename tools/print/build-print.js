#!/usr/bin/env node
/**
 * build-print.js — compile the issue into a printable document.
 *
 *   node tools/print/build-print.js [--issue content/issue-01.js]
 *                                   [--out <file.dc.html>] [--proof] [--render <file.pdf>]
 *
 * WHAT THIS IS
 * The magazine's pages are drawn once, as fifteen A5 templates in db-render/
 * ("DB Feature.dc.html", "DB Listings.dc.html", …). They take their content as
 * props, the way a LaTeX macro takes arguments. This script is the other half:
 * it reads the issue — content/issue-01.js, one file, no layout in it — and
 * writes the document that hands each page's content to its template, imposed
 * for the press.
 *
 * It replaces hand-laying an issue in the canvas. The previous print document
 * carried its content inline as attributes on 48 hand-written <dc-import> tags,
 * with the rest falling back to values baked into the templates themselves, so
 * "the issue" existed in two places at once and neither was readable as prose.
 * Now the templates are layout only and the issue is content only.
 *
 * OUTPUT
 *   default   the saddle-stitch booklet: 24 A4-landscape sides, two A5 pages per
 *             side, imposed so the folded stack reads in order (imposition.js).
 *   --proof   the same pages one-up on A5 in reading order. Nothing is imposed,
 *             so this is what you read to check the issue before trusting a
 *             booklet whose page order is deliberately scrambled.
 *
 * The props are checked against each template's own declared schema, so a
 * misspelled prop is an error here rather than a silently blank panel on paper.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const KIT = path.join(ROOT, "db-render");

/* ---- args -------------------------------------------------------------- */
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const PROOF = argv.includes("--proof");
const ISSUE = path.resolve(ROOT, opt("--issue", "content/issue-01.js"));
// The document is written INTO db-render/ because that is where the templates,
// support.js and the vendored fonts live, and it loads them by relative path. It is
// a build artifact, not a source file, and .gitignore says so.
const OUT = path.resolve(ROOT, opt("--out",
  PROOF ? "db-render/build-proof.dc.html" : "db-render/build-booklet.dc.html"));

/* ---- the page geometry every template is drawn at ----------------------- */
const PAGE_W = 561, PAGE_H = 794;      // A5 at 96dpi, the templates' own size
const GUTTER = 40;                     // fold allowance between the two-up pages
const SHEET_W = 1122, SHEET_H = 767;   // A4 landscape, less the press margin

/* ---- template schemas, read from the templates themselves ---------------
   Each "DB *.dc.html" declares its props in a data-props JSON blob. Reading it
   here means the issue is validated against what the templates actually accept,
   not against a list in this file that would drift away from them. */
function loadSchemas() {
  const out = {};
  for (const f of fs.readdirSync(KIT)) {
    const m = /^DB (.+)\.dc\.html$/.exec(f);
    if (!m) continue;
    const src = fs.readFileSync(path.join(KIT, f), "utf8");
    const a = /data-props="([^"]*)"/.exec(src);
    if (!a) continue;
    try { out[m[1]] = JSON.parse(unescapeAttr(a[1])); }
    catch (e) { throw new Error(`${f}: could not read its prop schema — ${e.message}`); }
  }
  if (!Object.keys(out).length) throw new Error(`no page templates found in ${KIT}`);
  return out;
}
const unescapeAttr = (s) => s
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const escAttr = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;");
const kebab = (s) => s.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());

/* ---- issue -> flat props ------------------------------------------------
   The issue file keeps content, chrome and layout apart because that is how a
   person thinks about a page. The templates take one flat bag of props, so the
   three are merged here. Arrays are the issue file's way of writing a block
   sequence — paragraphs, table rows, comic panels — and the templates split on
   "||", so that is what an array becomes. Writing the separator by hand is what
   the array notation exists to avoid. */
function flatten(page) {
  const props = {};
  if (page.variant) props.variant = page.variant;
  if (page.slug) props.slug = page.slug;
  for (const bag of [page.chrome, page.content]) {
    if (!bag) continue;
    for (const [k, v] of Object.entries(bag)) {
      if (v === undefined || v === null) continue;
      props[k] = Array.isArray(v) ? v.join("||") : String(v);
    }
  }
  return props;
}

function validate(pages, schemas) {
  const problems = [];
  pages.forEach((pg, i) => {
    const where = `page ${i + 1} (${pg.template}${pg.variant ? "/" + pg.variant : ""})`;
    const sc = schemas[pg.template];
    if (!sc) {
      problems.push(`${where}: no template "DB ${pg.template}.dc.html" in db-render/. ` +
                    `Known: ${Object.keys(schemas).join(", ")}`);
      return;
    }
    const known = new Set(Object.keys(sc).filter((k) => !k.startsWith("$")));
    for (const k of Object.keys(flatten(pg))) {
      if (!known.has(k)) {
        problems.push(`${where}: "${k}" is not a prop of DB ${pg.template} — it would be ignored. ` +
                      `Props: ${[...known].join(", ")}`);
      }
    }
    const variants = sc.variant && sc.variant.options;
    if (pg.variant && variants && !variants.includes(pg.variant)) {
      problems.push(`${where}: variant "${pg.variant}" is not one of ${variants.join(", ")}`);
    }
  });
  if (problems.length) {
    throw new Error("the issue does not fit the templates:\n  - " + problems.join("\n  - "));
  }
}

/* ---- emit ---------------------------------------------------------------- */
function importTag(page) {
  const props = flatten(page);
  const attrs = Object.entries(props)
    .map(([k, v]) => `${kebab(k)}="${escAttr(v)}"`).join(" ");
  return `<dc-import name="DB ${page.template}" ${attrs} ` +
         `hint-size="${PAGE_W}px,${PAGE_H}px"></dc-import>`;
}

const NOTE = 'style="color:#8d857a;font-size:10px;letter-spacing:.16em;text-align:center;' +
             'margin:0 auto 8px;font-family:ui-monospace,monospace"';

function helmet(pageCss) {
  return '<helmet data-dc-atomics><meta name="omelette-owns-print">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600' +
    '&amp;family=Caveat:wght@600;700&amp;family=UnifrakturMaguntia&amp;display=swap" rel="stylesheet">' +
    "<style>body{margin:0;background:#2a2723;font-family:'IBM Plex Mono',ui-monospace,monospace;" +
    "-webkit-print-color-adjust:exact;print-color-adjust:exact}a{color:#f0477d}a:hover{color:#12b795}" +
    pageCss +
    "[data-sheet]{break-after:page;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    "@media print{body{background:#fff;padding:0}[data-note]{display:none!important}" +
    "[data-sheet]{margin:13px auto 0!important;box-shadow:none!important}}" +
    "@media print{html,body,#dc-root,.sc-host,#dc-root>div,.sc-host>div{height:auto!important;" +
    "min-height:0!important;max-height:none!important;overflow:visible!important}}</style></helmet>";
}

function doc(helmetHtml, banner, body) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="./support.js"></script>
</head>
<body>
<x-dc>
${helmetHtml}
<div style="padding:24px 0">
<div data-note style="color:#8d857a;font-size:10px;letter-spacing:.16em;text-align:center;margin:0 auto 8px;font-family:ui-monospace,monospace;padding:10px 20px;max-width:80ch;line-height:1.8">${banner}</div>
${body}
</div>
</x-dc>
</body>
</html>
`;
}

function buildProof(pages, meta) {
  const sheet = `width:${PAGE_W}px;height:${PAGE_H}px;margin:0 auto 24px;position:relative;` +
                `overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5)`;
  const body = pages.map((pg, i) => {
    const folio = (pg.chrome && pg.chrome.folio) || (i === 0 ? "FC" : i === pages.length - 1 ? "BC" : "");
    return `<div data-note ${NOTE}>P${String(i + 1).padStart(2, "0")} · ${folio}</div>\n` +
           `<div data-sheet style="${sheet}">${importTag(pg)}</div>`;
  }).join("\n");
  const banner = `DAILY BREAD ${meta.issue} · PRINT PROOF · ${pages.length} PP SEQUENTIAL<br>` +
    `Reading order, one page per sheet — not imposed. Print at 100% on A5 · enable “Background graphics” · this banner does not print`;
  return doc(helmet("@page{size:148mm 210mm;margin:0}"), banner, body);
}

function buildBooklet(pages, meta, sides) {
  const scale = SHEET_W / (PAGE_W * 2 + GUTTER);
  const sheetStyle = `width:${SHEET_W}px;height:${SHEET_H}px;margin:0 auto 24px;overflow:hidden;` +
                     `box-shadow:0 12px 40px rgba(0,0,0,.5);background:#fff;position:relative`;
  const innerStyle = `width:${PAGE_W * 2 + GUTTER}px;height:${PAGE_H}px;transform:scale(${scale.toFixed(5)});` +
                     `transform-origin:top left;display:flex;gap:${GUTTER}px;position:relative`;
  const cell = `width:${PAGE_W}px;height:${PAGE_H}px;overflow:hidden;position:relative;flex:none`;
  const foldX = PAGE_W + GUTTER / 2;
  const label = (n) => {
    const pg = pages[n - 1];
    return (pg.chrome && pg.chrome.folio) || (n === 1 ? "FC" : n === pages.length ? "BC" : `p${n}`);
  };
  const body = sides.map((s) => {
    const note = `SHEET ${String(s.sheet).padStart(2, "0")} · ${s.face} — ` +
                 `LEFT: ${label(s.left)} · RIGHT: ${label(s.right)}`;
    return `<div data-note ${NOTE}>${note}</div>\n` +
      `<div data-sheet style="${sheetStyle}"><div style="${innerStyle}">` +
      `<div style="${cell}">${importTag(pages[s.left - 1])}</div>` +
      `<div style="${cell}">${importTag(pages[s.right - 1])}</div>` +
      `<div style="position:absolute;left:${foldX}px;top:0;bottom:0;border-left:1px dashed #b9b2a6;pointer-events:none"></div>` +
      `<div style="position:absolute;left:${foldX}px;top:4px;transform:translateX(-50%);font-size:7px;` +
      `letter-spacing:.14em;color:#b9b2a6;pointer-events:none">▼FOLD</div>` +
      `</div></div>`;
  }).join("\n");
  const banner = `DAILY BREAD ${meta.issue} · SADDLE-STITCH BOOKLET · ${sides.length / 2} SHEETS · FOLD GUTTER ${GUTTER}PX<br>` +
    `Export at A4 landscape · double-sided, FLIP ON SHORT EDGE · enable “Background graphics”<br>` +
    `Stack in order, fold on the dashed line, two staples on the fold.`;
  return doc(helmet("@page{size:297mm 210mm;margin:0}"), banner, body);
}

/* ---- run ---------------------------------------------------------------- */
const { saddleStitch, assertReadsInOrder } = require("./imposition.js");
const issue = require(ISSUE);
const pages = issue.pages;
const schemas = loadSchemas();
validate(pages, schemas);

let html, sheets;
if (PROOF) { html = buildProof(pages, issue.meta); sheets = pages.length; }
else {
  const sides = saddleStitch(pages.length);
  // Folded, the stack must read 1..n. Checked on every build, because a booklet
  // imposed one page out looks entirely correct until it is folded and stapled.
  assertReadsInOrder(sides, pages.length);
  html = buildBooklet(pages, issue.meta, sides);
  sheets = sides.length;
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

console.log(`issue:    ${path.relative(ROOT, ISSUE)} — ${pages.length} pages, ` +
            `${new Set(pages.map((p) => p.template)).size} templates`);
console.log(`format:   ${PROOF ? "A5 proof, reading order" : `A4 landscape saddle-stitch, ${sheets / 2} sheets — folded, the stack reads in order`}`);
console.log(`wrote     ${path.relative(ROOT, OUT)}  (${sheets} sheets)`);

const RENDER = opt("--render", null);
if (RENDER) {
  const { spawnSync } = require("child_process");
  const r = spawnSync("node", [path.join(KIT, "serve-and-render.js"), KIT, path.basename(OUT),
                               path.resolve(ROOT, RENDER), String(sheets)],
                      { stdio: "inherit", cwd: KIT });
  process.exit(r.status ?? 1);
}
