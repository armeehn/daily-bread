/* Reading an incoming email: who it is from, what the draft is, whether to
 * answer at all. Pure functions over postal-mime's output and the headers, so
 * the tests can drive them without a Worker. */
import PostalMime from "postal-mime";

export const MAX_RAW_BYTES = 4 * 1024 * 1024;   // a draft, not a portfolio: pictures go to the editors
export const MAX_DRAFT_CHARS = 60000;           // ~10,000 words; the longest piece holds under 600

// the studio counts words this way (studio.html WORD_RE); the desk must agree
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;
export function countWords(s) { return (String(s || "").match(WORD_RE) || []).length; }

export async function parse(raw) {
  return await PostalMime.parse(raw);
}

export function address(a) {
  return String((a && (a.address || a)) || "").trim().toLowerCase();
}

/* Mail the desk must never answer: bounces, auto-replies, lists, itself.
   Answering those is how two robots end up writing to each other all night. */
export function isAutomated(headers, from, deskAddress) {
  const h = k => (headers.get(k) || "").toLowerCase();
  if (!from || from === address(deskAddress)) return "self or no sender";
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?)[@+]/.test(from)) return "system sender";
  if (h("auto-submitted") && h("auto-submitted") !== "no") return "auto-submitted";
  if (/^(bulk|list|junk|auto_reply)$/.test(h("precedence"))) return "precedence " + h("precedence");
  if (h("list-id") || h("list-unsubscribe")) return "mailing list";
  if (h("x-autoreply") || h("x-autorespond") || h("x-auto-response-suppress").includes("all")) return "auto-reply";
  return null;
}

/* The writer's own words: the body, less the quoted history of the thread, plus
   any plain-text or Markdown attachment. Word files are not read (they would
   need a parser the Worker does not carry); the reply asks for pasted text. */
export function draftFrom(email) {
  let body = email.text || htmlToText(email.html || "");
  body = stripQuoted(body);
  const parts = [body.trim()];
  const skipped = [];
  for (const a of email.attachments || []) {
    const name = a.filename || "attachment";
    if (/^text\/(plain|markdown)$/.test(a.mimeType || "") || /\.(txt|md)$/i.test(name)) {
      parts.push(new TextDecoder().decode(a.content).trim());
    } else if (!/^image\//.test(a.mimeType || "")) {
      skipped.push(name);
    }
  }
  let text = parts.filter(Boolean).join("\n\n");
  const cut = text.length > MAX_DRAFT_CHARS;
  if (cut) text = text.slice(0, MAX_DRAFT_CHARS);
  return { text, skipped, cut, images: (email.attachments || []).filter(a => /^image\//.test(a.mimeType || "")).length };
}

// "On Tue, 1 Sep 2026, Desk wrote:" and everything after it; "> " lines
export function stripQuoted(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (const line of lines) {
    if (/^On .{4,200}wrote:\s*$/.test(line.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  // a signature separator ends the draft too
  const sig = out.findIndex(l => l === "-- ");
  return (sig >= 0 ? out.slice(0, sig) : out).join("\n");
}

function htmlToText(html) {
  return String(html)
    .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, "\n")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// one conversation per writer and subject, whatever "Re:" and "Fwd:" pile up
export function subjectKey(subject) {
  return String(subject || "").replace(/^\s*((re|fwd?|aw|sv|tr)\s*:\s*)+/i, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function threadId(from, subject) {
  const data = new TextEncoder().encode(from + "\n" + subjectKey(subject));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}
