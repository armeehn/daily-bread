/**
 * studio-model.js — the model the studio is showing, and its print geometry in pt.
 *
 * Shared by render-studio-pdf.js (which paginates DB.render(model)) and
 * impose-booklet.js (which folds that render into a saddle-stitched booklet), so the
 * two can never resolve a different model or disagree on where the trim line is.
 *
 * Precedence: --model > MAGAZINE_MODEL > <repo>/magazine.model.json > DB.DEFAULT_MODEL.
 * The studio's "Export JSON" writes exactly this shape, so committing that file is
 * what makes an edit in the studio reach the PDF. With no file present the default
 * model is used, which is what a freshly-opened studio shows.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DB = require(path.join(ROOT, "db.js"));

function resolveModel(modelArg) {
  const candidates = [
    modelArg && { why: "--model", file: path.resolve(modelArg) },
    process.env.MAGAZINE_MODEL && { why: "MAGAZINE_MODEL", file: path.resolve(process.env.MAGAZINE_MODEL) },
    { why: "magazine.model.json", file: path.join(ROOT, "magazine.model.json") },
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c.file)) {
      const m = JSON.parse(fs.readFileSync(c.file, "utf8"));
      return { model: m, source: `${c.why} (${path.relative(ROOT, c.file)})` };
    }
    if (c.why !== "magazine.model.json") { console.error(`model not found: ${c.file}`); process.exit(2); }
  }
  return { model: DB.clone(DB.DEFAULT_MODEL), source: "DB.DEFAULT_MODEL (db.js) — what a freshly-opened studio shows" };
}

/* A CSS length from the model's Print & bleed panel ("3mm", "0.125in") in PDF points. */
const PT_PER = { pt: 1, px: 0.75, in: 72, mm: 72 / 25.4, cm: 72 / 2.54, q: 72 / 25.4 / 4 };
function cssPt(len) {
  const m = String(len).trim().match(/^(-?[\d.]+)\s*(pt|px|in|mm|cm|q)$/i);
  if (!m) { throw new Error(`not a CSS length: ${JSON.stringify(len)}`); }
  return parseFloat(m[1]) * PT_PER[m[2].toLowerCase()];
}

/* Sheet edge → trim line, in pt: the slug (crop marks) plus the bleed. */
function edgePt(model) {
  const g = DB.printGeom(model);
  return cssPt(g.slug) + cssPt(g.bleed);
}

module.exports = { ROOT, DB, resolveModel, cssPt, edgePt };
