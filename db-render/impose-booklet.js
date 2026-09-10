/**
 * impose-booklet.js — fold the studio's print render into a saddle-stitched booklet.
 *
 *   node impose-booklet.js "<print.pdf>" "<booklet.pdf>" [--model <model.json>]
 *
 * WHY THIS EXISTS
 * render-studio-pdf.js prints DB.render(model) one magazine page per sheet, in
 * reading order — the file a proofreader wants. A printer wants the same pages
 * imposed: two to a side, paired so that a stack of sheets folded once and stapled
 * on the fold reads 1, 2, 3 … n. That pairing is tools/print/imposition.js, the same
 * module the template kit uses, and it is verified here the same way: by simulating
 * the fold, never by re-deriving the formula.
 *
 * GEOMETRY
 * Every source sheet is trim + bleed + slug on all four sides. On a side of the
 * booklet the two trims butt at the spine, so each page is clipped at its inner
 * trim line — the inner bleed and slug would otherwise land on the facing page —
 * and keeps its outer edge whole, crop marks and all. There is no cut at the fold,
 * so no marks are lost. A screen rasteriser with vector anti-aliasing (pdftoppm's
 * default) shows a one-pixel pale hairline down the fold: the page's stacked fills
 * (stock, then ink) each blend at partial coverage along the clip edge. It is not
 * in the file — `pdftoppm -aaVector no` shows none — and a press RIP does not draw it.
 *
 *     ┌slug┬bleed┬────── trim ──────┬────── trim ──────┬bleed┬slug┐
 *     │    │     │   page  n-s+1    │      page  s     │     │    │   side s, odd
 *     └────┴─────┴──────────────────┴──────────────────┴─────┴────┘
 *                                   ↑ fold
 *
 * A booklet needs a multiple of four pages. Blanks are added before the back
 * cover, painted the model's stock colour so they read as paper, not as a hole.
 *
 * DETERMINISM
 * Pure JavaScript over a fixed input: the same print.pdf imposes to the same bytes
 * on any machine, which the workstation render never does. Dates are pinned to
 * SOURCE_DATE_EPOCH, else to the epoch the sidecar manifest says the print render
 * was made at, so the pair always carries one date.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PDFDocument, rgb } = require("pdf-lib");
const { ROOT, resolveModel, edgePt } = require("./studio-model");
const { saddleStitch, assertReadsInOrder } = require(path.join(ROOT, "tools/print/imposition.js"));

const MANIFEST = "magazine-render.json";
const PAGES_PER_SIGNATURE = 4;     // one folded sheet = four pages

/* ---- args ------------------------------------------------------------- */
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const [IN, OUT] = positional;
if (!IN || !OUT) {
  console.error('usage: node impose-booklet.js "<print.pdf>" "<booklet.pdf>" [--model <model.json>]');
  process.exit(2);
}

const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");

/* "#f6f1e7" → pdf-lib colour; the stock the blanks are painted. */
function hexRgb(hex) {
  const m = String(hex || "").match(/^#([0-9a-f]{6})$/i);
  if (!m) { return rgb(1, 1, 1); }
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/* The manifest beside the input, if the render left one. */
function readManifest() {
  const file = path.join(path.dirname(path.resolve(IN)), MANIFEST);
  if (!fs.existsSync(file)) { return { file, data: null }; }
  return { file, data: JSON.parse(fs.readFileSync(file, "utf8")) };
}

(async () => {
  const { model, source: modelSource } = resolveModel(opt("--model"));
  const edge = edgePt(model);
  const stock = hexRgb(model.theme && model.theme.bone);

  const inBytes = fs.readFileSync(IN);
  const src = await PDFDocument.load(inBytes);
  const n = src.getPageCount();
  if (n < 1) { console.error("::error::the print PDF has no pages"); process.exit(1); }
  const { width: W, height: H } = src.getPage(0).getSize();

  /* Pad to a signature, blanks before the back cover so it stays outermost. */
  const blanks = (PAGES_PER_SIGNATURE - n % PAGES_PER_SIGNATURE) % PAGES_PER_SIGNATURE;
  const order = [...Array(n - 1).keys(), ...Array(blanks).fill(null), n - 1]; // source index or null
  const N = order.length;

  const sides = saddleStitch(N);
  assertReadsInOrder(sides, N);   // throws if the folded stack would not read 1..N

  /* Manifest first: refuse to describe a booklet against the wrong print. */
  const manifest = readManifest();
  if (manifest.data && manifest.data.pdfSha256 !== sha256(inBytes)) {
    console.error(`::error::${MANIFEST} describes a different PDF than ${IN} — re-render before imposing`);
    process.exit(1);
  }

  const epoch = process.env.SOURCE_DATE_EPOCH || (manifest.data && manifest.data.sourceDateEpoch) || null;

  const out = await PDFDocument.create({ updateMetadata: false });
  const halfW = W - edge;                 // a page clipped at its inner trim line
  const sheetW = halfW * 2;

  /* Embed one page clipped on the spine side. `at` is where its outer edge sits. */
  const clip = {
    left:  { box: { left: 0, bottom: 0, right: halfW, top: H }, shift: 0 },
    right: { box: { left: edge, bottom: 0, right: W, top: H }, shift: -edge },
  };
  async function place(sheet, pageNo, slot) {
    const idx = order[pageNo - 1];
    if (idx === null) { return; }         // a padded blank: stock only
    const c = clip[slot];
    const emb = await out.embedPage(src.getPage(idx), c.box, [1, 0, 0, 1, c.shift, 0]);
    sheet.drawPage(emb, { x: slot === "left" ? 0 : halfW, y: 0 });
  }

  for (const s of sides) {
    const sheet = out.addPage([sheetW, H]);
    sheet.drawRectangle({ x: 0, y: 0, width: sheetW, height: H, color: stock });
    await place(sheet, s.left, "left");
    await place(sheet, s.right, "right");
  }

  const when = epoch ? new Date(Number(epoch) * 1000) : new Date();
  out.setCreationDate(when);
  out.setModificationDate(when);
  out.setProducer("impose-booklet.js (pdf-lib)");
  out.setCreator("Daily Bread studio — DB.render(model), saddle-stitch imposed");

  const bytes = Buffer.from(await out.save());
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  fs.writeFileSync(OUT, bytes);

  const pairs = sides.map(s => `${s.left}|${s.right}`);
  console.log(`wrote    ${OUT}`);
  console.log(`model:   ${modelSource}`);
  console.log(`pages:   ${n} rendered + ${blanks} blank = ${N}, on ${sides.length} sides (${sides.length / 2} sheets)`);
  console.log(`sheet:   ${sheetW.toFixed(2)} x ${H.toFixed(2)} pts (two ${W.toFixed(2)} x ${H.toFixed(2)} pages, ${edge.toFixed(2)} pt clipped at the spine)`);
  console.log(`order:   ${pairs.join("  ")}`);
  console.log(`dates:   ${epoch ? "pinned to epoch " + epoch : "wall clock (set SOURCE_DATE_EPOCH for a reproducible file)"}`);
  console.log("check:   folded and read, the stack goes 1.." + N);

  if (!manifest.data) { console.log(`manifest none beside ${IN}; nothing recorded`); return; }
  manifest.data.booklet = {
    file: path.basename(OUT),
    pages: N, blankPages: blanks, sides: sides.length, sheets: sides.length / 2,
    sheetWidthPt: +sheetW.toFixed(2), sheetHeightPt: +H.toFixed(2),
    order: pairs,
    pdfSha256: sha256(bytes), pdfBytes: bytes.length,
    imposer: "impose-booklet.js (tools/print/imposition.js, fold-simulated)"
  };
  fs.writeFileSync(manifest.file, JSON.stringify(manifest.data, null, 2) + "\n");
  console.log(`manifest ${path.relative(ROOT, manifest.file)}  (+booklet)`);
})().catch(e => { console.error("::error::" + e.message); process.exit(1); });
