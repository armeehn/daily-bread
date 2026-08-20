/**
 * from-issue.js — the strings the website and the printed issue must agree on.
 *
 * Most of the site's copy is not the magazine's copy. A web hero is not a cover, a
 * section intro is not a dek, and roughly two thirds of the keys in en.js say
 * something the printed page never says. Those stay written where they are.
 *
 * But some of it is the same *fact*, set twice: the nine calendar entries, the
 * fourteen directory lines, the three screenings, the contents table, the collapse
 * ledger, the lab's status board. Duplicating a fact is how the website ends up
 * advertising a screening the printed issue moved. So those keys are not written in
 * en.js at all — they are read from content/issue-01.js, the same file the print
 * build compiles, and there is exactly one place to change a date.
 *
 * An address names a page by its id, then the prop, then the row and field:
 *
 *     at('p38.content.rows[2]|1')
 *      │   │       │        │  └ field 2 of the row, splitting on "|"
 *      │   │       │        └─── third row of the block
 *      │   │       └──────────── the prop
 *      │   └──────────────────── content or chrome
 *      └──────────────────────── the page's id, stable across reordering
 *
 * Anything that does not resolve throws. That is deliberate: a page renamed or a row
 * deleted must break the build loudly, not quietly serve the website a stale string
 * or an empty one.
 */
const issue = require("../../content/issue-01.js");

const byId = new Map();
for (const p of issue.pages) {
  if (byId.has(p.id)) throw new Error(`content/issue-01.js: two pages share the id "${p.id}"`);
  byId.set(p.id, p);
}

const ADDR = /^([A-Za-z0-9_-]+)\.(content|chrome)\.([A-Za-z0-9_]+)(?:\[(\d+)\])?(?:\|(\d+))?$/;

function at(address) {
  const m = ADDR.exec(address);
  if (!m) throw new Error(`from-issue: "${address}" is not an address (want e.g. p38.content.rows[2]|1)`);
  const [, id, bag, prop, index, field] = m;

  const page = byId.get(id);
  if (!page) throw new Error(`from-issue: no page "${id}" in the issue (${[...byId.keys()].join(", ")})`);

  const bagObj = page[bag];
  if (!bagObj || !(prop in bagObj)) {
    throw new Error(`from-issue: page "${id}" has no ${bag}.${prop}` +
      (bagObj ? ` — it has ${Object.keys(bagObj).join(", ")}` : ""));
  }
  let v = bagObj[prop];

  if (index !== undefined) {
    if (!Array.isArray(v)) throw new Error(`from-issue: ${id}.${bag}.${prop} is not a block sequence, so [${index}] means nothing`);
    if (index >= v.length) throw new Error(`from-issue: ${id}.${bag}.${prop} has ${v.length} rows; [${index}] is past the end`);
    v = v[index];
  } else if (Array.isArray(v)) {
    throw new Error(`from-issue: ${id}.${bag}.${prop} is a block sequence — say which row, e.g. ${prop}[0]`);
  }

  if (field !== undefined) {
    const parts = String(v).split("|");
    if (field >= parts.length) {
      throw new Error(`from-issue: "${v}" has ${parts.length} field(s); |${field} is past the end`);
    }
    return parts[field].trim();
  }
  return v;
}

module.exports = { at, issue };
