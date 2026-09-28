/* The two emails the desk writes: the reply to the writer and the copy to the
 * editors. Both are built here from the review's fields, never taken whole from
 * the model, so what a writer receives always has the same honest frame: who
 * read it, what the limit is, and that a person reads it too. */

const MAX_NOTE = 600, MAX_QUOTE = 300;
const clip = (s, n) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

/* Keep a note's quote only if it really is in the draft (whitespace aside).
   A quote the draft does not contain is dropped, not "fixed". */
export function checkQuotes(notes, draft) {
  const flat = s => String(s).replace(/\s+/g, " ").trim();
  const hay = flat(draft);
  return notes.map(n => {
    const q = flat(n.quote || "");
    return Object.assign({}, n, { quote: q && hay.includes(q) ? q : "", quoteDropped: !!q && !hay.includes(q) });
  });
}

export function writerReply({ magazine, pieceLabel, words, limit, review, mode, skipped, cut, first }) {
  const r = review;
  const L = [];
  L.push(first ? "Thanks for sending this to " + magazine + "." : "Thanks for the revision.");
  L.push("");
  L.push(clip(r.summary, 900));
  L.push("");
  if (pieceLabel) L.push("Piece: " + pieceLabel);
  if (limit) {
    const over = words - limit;
    L.push("Length: " + words + " words; the limit is " + limit + (over > 0 ? " — about " + over + " over." : " — " + (limit - words) + " to spare."));
  } else {
    L.push("Length: " + words + " words.");
  }
  if (cut) L.push("(Only the first part was read: the draft was longer than the desk takes by email.)");
  if (skipped && skipped.length) L.push("(Not read: " + skipped.join(", ") + ". Please paste the text into the email body or attach it as .txt.)");
  const notes = (r.notes || []).slice(0, 8);
  if (notes.length) {
    L.push("", "Notes");
    notes.forEach((n, i) => {
      L.push("");
      L.push((i + 1) + ". " + (n.rule && n.rule !== "—" ? "[" + clip(n.rule, 12) + "] " : "") + clip(n.note, MAX_NOTE));
      if (n.quote) L.push("   You wrote: “" + clip(n.quote, MAX_QUOTE) + "”");
      if (mode !== "point" && n.suggestion) L.push("   Perhaps: “" + clip(n.suggestion, MAX_QUOTE) + "”");
    });
  } else {
    L.push("", "No notes: nothing the style guide asks for is missing.");
  }
  L.push("");
  L.push(r.ready && (!limit || words <= limit)
    ? "It reads as ready from here. An editor will be in touch."
    : "Reply to this email with your revised draft in the body when you are ready; the desk will read it again.");
  L.push("");
  L.push("—");
  L.push("These notes were written by the " + magazine + " submissions desk, which is an AI (Claude), against the magazine's house style guide. " +
         "A person on the editorial team reads every submission and every note. Nothing here accepts or rejects your piece, and your words stay yours.");
  return L.join("\n");
}

export function editorsCopy({ writer, subject, pieceLabel, words, limit, review, draft, reason, threadId }) {
  const L = [
    "Writer: " + writer,
    "Subject: " + (subject || "(none)"),
    "Thread: " + threadId,
    "Piece: " + (pieceLabel || "unknown") + " · " + words + " words" + (limit ? " / limit " + limit : ""),
  ];
  if (reason) L.push("", "The desk did not review this one: " + reason + ". It sent the writer an acknowledgement only.");
  if (review) {
    if (review.to_editors) L.push("", "For the editors: " + clip(review.to_editors, 800));
    L.push("", "Summary sent to the writer:", clip(review.summary, 900));
    const dropped = (review.notes || []).filter(n => n.quoteDropped).length;
    L.push("", (review.notes || []).length + " note(s) sent" + (dropped ? "; " + dropped + " quote(s) dropped because the draft does not contain them" : "") + ".");
  }
  L.push("", "----- draft -----", draft);
  return L.join("\n");
}

export function acknowledgement({ magazine, reason }) {
  return [
    "Thanks — the " + magazine + " submissions desk has your email.",
    "",
    reason === "rate"
      ? "You have sent several drafts today, so the desk will not send notes on this one; it has gone to the editors, who read everything."
      : "The desk could not write notes on this one automatically, so it has gone straight to the editors, who read everything.",
    "",
    "—",
    "The submissions desk is an AI (Claude); a person reads every submission.",
  ].join("\n");
}
