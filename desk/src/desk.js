/* The submissions desk: one email in, at most one reply out.
 *
 *   writer ──email──▶ desk ──▶ read it (review.js, Claude) ──▶ reply with notes
 *                        │                                        │
 *                        └──── original to the editors ◀──────────┘ copy of the notes
 *
 * The writer replies with a revision and the same thread goes round again: the
 * desk keys a conversation by sender and subject and remembers each round's
 * summary (KV, 180 days). It never writes to anyone but the sender (reply) and
 * the editors (a verified address), never answers automated mail, and reads at
 * most DAILY_LIMIT drafts per sender per day; past that, and whenever the review
 * fails, the writer gets an acknowledgement and the editors get the draft. */
import { MAX_RAW_BYTES, address, countWords, draftFrom, isAutomated, parse, threadId } from "./mail.js";
import { review as readDraft } from "./review.js";
import { acknowledgement, checkQuotes, editorsCopy, writerReply } from "./compose.js";

// what each measured section is called when talking to a writer
const PIECE_LABELS = {
  letter: "Editor's letter", contents: "Contents introduction", history: "History feature",
  voices: "A Young Voices report", waitlist: "The Waitlist feature (introduction)",
  interview: "Interview pull quote", calendar: "Calendar introduction",
  directory: "Directory note", lab: "From the Lab",
};
const THREAD_TTL = 180 * 86400, ROUNDS_KEPT = 10;

/* One entry per writer's piece from press/<edition>/limits.json. A section with
   several slots (Young Voices: a report each) takes the tightest of them. */
export function piecesFrom(limits) {
  const by = {};
  for (const s of (limits && limits.slots) || []) {
    if (s.capacity == null) continue;
    by[s.section] = Math.min(by[s.section] == null ? Infinity : by[s.section], s.capacity);
  }
  return Object.keys(by).map(k => ({ key: k, label: PIECE_LABELS[k] || k, limit: by[k] }));
}

export async function handle(message, env, deps) {
  const log = deps.log || (() => {});
  const now = deps.now || Date.now;
  const desk = env.DESK_ADDRESS, magazine = env.MAGAZINE || "the magazine";
  const from = address(message.from);

  const auto = isAutomated(message.headers, from, desk);
  if (auto) { log("ignored", auto); return { action: "ignored", why: auto }; }
  if (message.rawSize > MAX_RAW_BYTES) {
    message.setReject("Too large for the submissions desk: put the text in the email and send pictures to the editors.");
    return { action: "rejected" };
  }

  const email = await parse(await new Response(message.raw).arrayBuffer());
  const subject = (email.subject || "").slice(0, 200);
  const tid = await threadId(from, subject);
  const thread = JSON.parse((await env.DESK.get("t:" + tid)) || "null") ||
    { writer: from, subject, piece: null, rounds: [] };
  const { text: draft, skipped, cut } = draftFrom(email);
  const words = countWords(draft);
  const pieces = piecesFrom(deps.limits);

  // a day's allowance per sender, counted before the model is called
  const day = new Date(now()).toISOString().slice(0, 10), rk = "r:" + from + ":" + day;
  const seen = +((await env.DESK.get(rk)) || 0);
  await env.DESK.put(rk, String(seen + 1), { expirationTtl: 2 * 86400 });

  let result = null, reason = null;
  if (!draft.trim()) reason = "empty";
  else if (seen >= (+env.DAILY_LIMIT || 8)) reason = "rate";
  else {
    try {
      result = await readDraft({
        apiKey: env.ANTHROPIC_API_KEY, client: deps.client, style: deps.style, pieces,
        mode: env.DESK_MODE || "suggest", magazine,
        input: { piece: thread.piece, words, limit: (pieces.find(p => p.key === thread.piece) || {}).limit,
                 subject, thread: thread.rounds, draft },
      });
      if (!result.ok) reason = result.reason;
    } catch (e) {
      reason = "error " + ((e && (e.status || e.name)) || "unknown");
      log("review failed", e && e.message);
    }
  }

  let text, notes = null, piece = thread.piece;
  if (!reason) {
    notes = Object.assign({}, result.notes, { notes: checkQuotes(result.notes.notes || [], draft) });
    if (notes.piece !== "other") piece = notes.piece;
  }
  const p = pieces.find(x => x.key === piece);
  if (notes) {
    text = writerReply({ magazine, pieceLabel: p && p.label, words, limit: p && p.limit, review: notes,
                         mode: env.DESK_MODE || "suggest", skipped, cut, first: !thread.rounds.length });
  } else if (reason === "empty") {
    text = "Thanks for writing to the " + magazine + " submissions desk. It found no text to read" +
      (skipped.length ? " (it cannot open " + skipped.join(", ") + ")" : "") +
      ". Please paste your draft into the body of an email, or attach it as a .txt file.\n\n—\nThe submissions desk is an AI (Claude); a person reads every submission.";
  } else {
    text = acknowledgement({ magazine, reason: reason === "rate" ? "rate" : "error" });
  }

  let replied = true;
  try {
    await message.reply({ from: desk, subject: /^\s*re:/i.test(subject) ? subject : "Re: " + (subject || "your submission"), text });
  } catch (e) { replied = false; log("reply failed", e && e.message); }

  // the editors see everything: the original (attachments and all) and what the desk said
  if (env.EDITORS_ADDRESS) {
    try { await message.forward(env.EDITORS_ADDRESS); } catch (e) { log("forward failed", e && e.message); }
  }
  if (env.EDITORS) {
    try {
      await env.EDITORS.send({
        from: desk, to: env.EDITORS_ADDRESS, subject: "[desk] " + (p ? p.label + " · " : "") + (subject || "(no subject)"),
        text: editorsCopy({ writer: from, subject, pieceLabel: p && p.label, words, limit: p && p.limit, review: notes,
                            draft, threadId: tid, reason: reason && reason !== "empty" ? reason : (replied ? null : "the reply could not be sent") }),
      });
    } catch (e) { log("editors copy failed", e && e.message); }
  }

  thread.piece = piece;
  thread.rounds.push({ at: new Date(now()).toISOString(), words, piece, summary: notes ? notes.summary : "(no review: " + reason + ")" });
  thread.rounds = thread.rounds.slice(-ROUNDS_KEPT);
  await env.DESK.put("t:" + tid, JSON.stringify(thread), { expirationTtl: THREAD_TTL });

  return { action: notes ? "reviewed" : "acknowledged", reason, piece, words, replied, thread: tid };
}
