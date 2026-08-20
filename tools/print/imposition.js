/**
 * imposition.js — turn a reading-order issue into printer's sheets.
 *
 * A saddle-stitched booklet is one stack of sheets folded together and stapled
 * on the fold, so the pages that share a side of paper are not neighbours in the
 * magazine: the outermost sheet carries the back cover beside the front one, and
 * every sheet inwards pairs the next page from the front with the next from the
 * back. Get this wrong and the booklet still prints, still has the right page
 * count, and is simply out of order once folded — which is why the pairing is
 * derived here rather than typed out.
 *
 * For N pages there are N/2 sides. Side s pairs page s with page N-s+1; the sides
 * alternate which of the two falls on the left, because every other side is the
 * back of a sheet and is therefore seen flipped.
 *
 *   48 pages -> side 1: 48|1   side 2: 2|47   side 3: 46|3   side 4: 4|45 …
 *
 * Sides come in pairs: side 1 is the front of sheet 1, side 2 its back.
 */
function saddleStitch(n) {
  if (!Number.isInteger(n) || n < 4 || n % 4 !== 0) {
    throw new Error(
      `a saddle-stitched booklet needs a multiple of 4 pages; the issue has ${n}. ` +
      `Add or remove pages (blank ones count) until it divides by 4.`
    );
  }
  const sides = [];
  for (let s = 1; s <= n / 2; s++) {
    const near = s, far = n - s + 1;
    const flipped = s % 2 === 0;                 // even sides are sheet backs
    sides.push({
      side: s,
      sheet: Math.ceil(s / 2),
      face: flipped ? "BACK" : "FRONT",
      left: flipped ? near : far,                // 1-based page numbers
      right: flipped ? far : near,
    });
  }
  return sides;
}

/**
 * Fold the stack and read it.
 *
 * The imposition above is four lines of arithmetic, and arithmetic that is wrong by
 * one still produces a booklet with the right sheet count, the right page count and
 * nothing obviously amiss on screen — you find out after it is folded and stapled.
 * So this does not re-derive the formula (that would only agree with itself); it
 * simulates the paper. Sheets are stacked with sheet 1 outermost and folded together
 * once. Reading from the front you take the right half of each sheet's front, then
 * the left half of its back, working inwards to the centre spread; past the centre
 * you come back out again taking the other halves in reverse. If that sequence is
 * not 1, 2, 3 … n, the imposition is wrong.
 */
function foldOrder(sides) {
  const bySheet = new Map();
  for (const s of sides) {
    if (!bySheet.has(s.sheet)) bySheet.set(s.sheet, {});
    bySheet.get(s.sheet)[s.face] = s;
  }
  const sheets = [...bySheet.keys()].sort((a, b) => a - b);
  const order = [];
  for (const n of sheets) {                       // outermost inwards, to the centre
    order.push(bySheet.get(n).FRONT.right, bySheet.get(n).BACK.left);
  }
  for (const n of [...sheets].reverse()) {        // centre back out to the covers
    order.push(bySheet.get(n).BACK.right, bySheet.get(n).FRONT.left);
  }
  return order;
}

/** Throw unless the folded stack reads 1..n. */
function assertReadsInOrder(sides, n) {
  const got = foldOrder(sides);
  for (let i = 0; i < n; i++) {
    if (got[i] !== i + 1) {
      throw new Error(
        `imposition is wrong: folded, the stack reads ` +
        `${got.slice(0, Math.min(8, n)).join(", ")}… — page ${i + 1} of the magazine ` +
        `lands at position ${got.indexOf(i + 1) + 1}.`
      );
    }
  }
  return true;
}

module.exports = { saddleStitch, foldOrder, assertReadsInOrder };
