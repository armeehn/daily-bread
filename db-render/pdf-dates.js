/**
 * pdf-dates.js — make a Chromium-rendered PDF byte-stable across runs.
 *
 * Chromium stamps the wall clock into /CreationDate and /ModDate and does not
 * honour SOURCE_DATE_EPOCH itself, so those two strings are the only thing that
 * differs between two otherwise identical renders — which is enough to defeat any
 * "render twice and compare" check. Rewriting them to SOURCE_DATE_EPOCH (the
 * reproducible-builds convention) is what makes that check mean something.
 *
 * The replacement is the same length as the original (D:YYYYMMDDHHMMSS+00'00' is
 * always 23 characters), so no xref offset moves; latin1 is byte-preserving in both
 * directions, so the binary streams survive the round-trip intact.
 *
 * Shared by render-print-pdf.js (the legacy <doc-page> kit) and render-studio-pdf.js
 * (the studio document) so the two cannot drift apart on something this load-bearing.
 */
const fs = require("fs");

function stampFor(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  const p2 = (n) => String(n).padStart(2, "0");
  return "D:" + d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate())
    + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds()) + "+00'00'";
}

/**
 * Rewrite a PDF's date fields from SOURCE_DATE_EPOCH, in place.
 * Returns {applied, hits, stamp}; applied is false when the variable is unset,
 * which is the normal case for an interactive render.
 * Throws if the rewrite would change the file's length — that would invalidate the
 * xref table, and a corrupt PDF is worse than a non-reproducible one.
 */
function pinPdfDates(file, epoch = process.env.SOURCE_DATE_EPOCH) {
  if (!epoch || !/^\d+$/.test(String(epoch))) return { applied: false, hits: 0, stamp: null };
  const stamp = stampFor(parseInt(epoch, 10));
  const before = fs.readFileSync(file).toString("latin1");
  let hits = 0;
  const after = before.replace(/\/(CreationDate|ModDate) \(D:\d{14}\+00'00'\)/g,
    (_m, key) => { hits++; return "/" + key + " (" + stamp + ")"; });
  if (after.length !== before.length) throw new Error("date rewrite changed file length");
  if (hits) fs.writeFileSync(file, Buffer.from(after, "latin1"));
  return { applied: true, hits, stamp };
}

module.exports = { pinPdfDates, stampFor };
