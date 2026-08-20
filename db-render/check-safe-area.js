/**
 * check-safe-area.js — prepress check: no type may fall outside the safe area.
 *
 *   node check-safe-area.js "<file.pdf>" [--model <model.json>] [--verbose]
 *
 * WHY THIS EXISTS
 * The magazine's media box is the whole sheet — trim + bleed + slug — and `@page`
 * takes no margin, so backgrounds can bleed. The consequence is that the safe inset
 * lives in the document flow (`.sec` padding, and a matching pad on anything that
 * starts a fresh sheet), and a section that outgrows its page fragments: the
 * continuation sheet then begins its first line hard against the sheet EDGE, several
 * millimetres outside the trim, and that line is cut off the finished copy.
 *
 * Nothing shows you this. The studio preview is a scrolling web page with no sheets
 * in it; a page thumbnail shows ink near an edge and looks deliberate; and the render
 * itself succeeds. The first studio-driven render had it on nine of thirty-three
 * sheets. So it is checked here, on the rendered PDF, where it is a fact rather than
 * an intention.
 *
 * The geometry is the document's own — `DB.printGeom(model)`, the same function the
 * print stylesheet sizes itself from — so changing the trim in the studio moves this
 * check with it. A hardcoded "A4 landscape, 12mm" would keep passing after the studio
 * had moved on, which is the failure mode a previous check here already had.
 *
 * Requires poppler's `pdftotext` (the render workflow already uses `pdfinfo`).
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DB = require(path.join(ROOT, "db.js"));

/* ---- args -------------------------------------------------------------- */
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const VERBOSE = argv.includes("--verbose");
const PDF = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1] === "--model"))[0];
if (!PDF) {
  console.error('usage: node check-safe-area.js "<file.pdf>" [--model <model.json>] [--verbose]');
  process.exit(2);
}

/* ---- the model the PDF was rendered from -------------------------------
   Same precedence as render-studio-pdf.js, so the check reads the document the
   renderer wrote rather than a different one. */
function resolveModel() {
  const MODEL_ARG = opt("--model");
  const candidates = [
    MODEL_ARG && path.resolve(MODEL_ARG),
    process.env.MAGAZINE_MODEL && path.resolve(process.env.MAGAZINE_MODEL),
    path.join(ROOT, "magazine.model.json"),
  ].filter(Boolean);
  for (const f of candidates) {
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  }
  return DB.clone ? DB.clone(DB.DEFAULT_MODEL) : DB.DEFAULT_MODEL;
}

/* ---- "12mm" / "0.5in" / "36pt" -> points -------------------------------- */
function toPt(v) {
  const m = String(v).trim().match(/^([\d.]+)\s*(mm|cm|in|pt|px)?$/);
  if (!m) throw new Error("cannot read a length from " + JSON.stringify(v));
  const n = parseFloat(m[1]);
  switch (m[2] || "pt") {
    case "mm": return n / 25.4 * 72;
    case "cm": return n / 2.54 * 72;
    case "in": return n * 72;
    case "px": return n / 96 * 72;
    default:   return n;
  }
}
const mm = (pt) => pt / 72 * 25.4;

/* ---- geometry, from the document ---------------------------------------- */
const g = DB.printGeom(resolveModel());
const edge  = toPt(g.slug) + toPt(g.bleed);   // sheet edge -> trim line
const inset = edge + toPt(g.safe);            // sheet edge -> safe area
const TOL   = 0.5;                            // pt; rounding in the text extractor

/* ---- every word box on every sheet -------------------------------------- */
let xml;
try {
  xml = execFileSync("pdftotext", ["-bbox", PDF, "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
} catch (e) {
  console.error("could not run pdftotext (poppler-utils): " + e.message);
  process.exit(2);
}

const WORD = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/g;
const PAGE = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g;

const bad = [];
let sheets = 0, words = 0;
for (let p; (p = PAGE.exec(xml)); ) {
  const w = parseFloat(p[1]), h = parseFloat(p[2]);
  sheets++;
  WORD.lastIndex = 0;
  for (let m; (m = WORD.exec(p[3])); ) {
    const [x0, y0, x1, y1] = m.slice(1, 5).map(parseFloat);
    words++;
    const outside = x0 < inset - TOL || x1 > w - inset + TOL ||
                    y0 < inset - TOL || y1 > h - inset + TOL;
    if (!outside) continue;
    const cut = x0 < edge || x1 > w - edge || y0 < edge || y1 > h - edge;
    bad.push({ sheet: sheets, text: m[5].trim(), cut,
               x0: mm(x0), y0: mm(y0), x1: mm(x1), y1: mm(y1) });
  }
}

/* ---- report -------------------------------------------------------------- */
const trimDesc = `${g.tw} x ${g.th} trim, ${g.bleed} bleed, ${g.slug} slug, ${g.safe} safe`;
console.log(`safe area: ${trimDesc}`);
console.log(`checked:   ${words} words on ${sheets} sheets, ` +
            `type must stay ${mm(inset).toFixed(0)}mm in from the sheet edge`);

if (!bad.length) {
  console.log("PASS       every word on every sheet is inside the safe area");
  process.exit(0);
}

const bySheet = new Map();
for (const b of bad) { if (!bySheet.has(b.sheet)) bySheet.set(b.sheet, []); bySheet.get(b.sheet).push(b); }
const cut = bad.filter((b) => b.cut).length;
console.log(`FAIL       ${bad.length} words outside the safe area on ${bySheet.size} sheets` +
            (cut ? ` — ${cut} of them past the TRIM, i.e. cut off the finished copy` : ""));
for (const [sheet, ws] of [...bySheet.entries()].sort((a, b) => a[0] - b[0])) {
  const ys = ws.flatMap((b) => [b.y0, b.y1]);
  console.log(`  sheet ${String(sheet).padStart(3)}: ${String(ws.length).padStart(4)} words, ` +
              `y ${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)}mm` +
              (ws.some((b) => b.cut) ? "  CUT OFF" : "") +
              `   ${JSON.stringify(ws.slice(0, 6).map((b) => b.text).join(" ").slice(0, 60))}`);
  if (VERBOSE) for (const b of ws) {
    console.log(`      ${b.cut ? "CUT " : "safe"} x ${b.x0.toFixed(1)}..${b.x1.toFixed(1)}mm ` +
                `y ${b.y0.toFixed(1)}..${b.y1.toFixed(1)}mm  ${JSON.stringify(b.text)}`);
  }
}
console.log("\nA sheet that starts at y≈0 is a section that outgrew its page: the fragment");
console.log("begins at the sheet edge, where no padding reaches. Fit the section, or break");
console.log("it at a block that pads itself (see printCss in db.js).");
process.exit(1);
