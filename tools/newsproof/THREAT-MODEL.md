> Adapted for Daily Bread. "Article" below means one language edition of an
> issue; the guarantees are identical. This is the upstream newsproof threat
> model, and it is worth reading in full before you rely on any green badge.

# What this actually defends against

Read this before deploying anything. A security control you have mis-scoped is
worse than none, because you will trust it.

## The property being claimed

> This is the exact text published under this byline at this time, and every
> earlier version of it is still provable.

Not "this is true". Not "this is accurate". Only that the words are the ones
that were published, and that the edit history is complete.

## Defended

**Tampering by anyone who is not the publisher.** Compromised web server,
compromised CDN, a malicious edge worker, a poisoned cache, an intercepting
proxy, a mirror that "helpfully" cleaned up the text. None of these hold the
publisher's private key, so none can produce a statement that verifies. The
offline verifier catches every one.

**Silent revision by the publisher.** This is the one a self-referential hash
can never give you, and the reason the transparency log exists. Corrections
stay possible — publish v2, it supersedes v1 — but v1 remains in the log
forever, with its own signature and timestamp. Rewriting history means
producing a log that contradicts a root already published in public, and the
consistency proof fails the moment anyone checks.

**Backdating.** A statement's `published_at` is inside the signature, and the
tree head that includes it is anchored at a known time. Claiming an article
existed earlier than it did requires an anchor from that earlier time.

**Confusion between message types.** Every signature covers a domain-separated
message, so a signature over an article can never be replayed as a signature
over a tree head.

## Not defended

**A publisher who lies from the start.** Signing attests authorship, not
accuracy. A signed fabrication is a fabrication with a signature on it. This
system makes you accountable for what you published; it cannot make you honest.

**Theft of the publisher key.** Whoever holds it can mint articles. That is
exactly why it belongs offline, and why the log helps even here: forged
articles still have to appear in the log to verify, which makes them
discoverable rather than deniable. Plan a rotation and revocation procedure
before you need one.

**The in-browser badge, against the publisher.** The badge ships from the same
origin as the article. A publisher — or anyone who has taken over the server —
can serve a verifier that always says yes. The badge is honest signal against
third parties and accidents, and no signal at all against the origin. The
offline verifier, run from a copy you keep, is the real check. The UI says so.

**Split view.** Nothing stops a server from showing one log to readers in one
country and a different log elsewhere, *unless* the anchors are genuinely
public and people compare them. Certificate Transparency solves this with
gossip between monitors. Here the substitute is that `leaves.jsonl` is served
in full, so any third party can mirror the log and check consistency over time.
Encourage that; a log nobody mirrors is a log you could quietly replace.

**Availability.** Deleting an article is not tampering. Readers who kept a
proof bundle can still prove what it said, which is often the point — but
nothing here keeps the page up.

**Coercion and legal compulsion.** A court order to unpublish, or to hand over
a key, is outside what cryptography addresses.

## The weakest link, honestly

It is the anchor. Everything else is mathematics; the anchor is a judgement
about where you cannot quietly edit. Ranked:

An RFC 3161 timestamp authority signs your tree root with its own key, offline
verifiable forever, and cannot re-issue a past date — the strongest option here
and worth the setup. A signed git tag pushed to a repository with third-party
mirrors is good, and cheap. Posting the anchor line to a social account is weak
alone but useful in aggregate, since deletion is visible. Writing it into your
RSS feed or a daily newsletter reaches many independent inboxes, none of which
you control after sending.

Anchor on a schedule, not on a whim — a gap in the anchor record is itself
information. And publish the anchor line somewhere a reader can find it without
asking you.

## Operational requirements

The publisher private key must not live on the web server; if it does, you have
built an elaborate way to sign whatever an attacker wants. Publish the key
fingerprint somewhere other than the site — the print edition masthead, a
verified profile, an industry body — because on a reader's first visit the key
they fetch from you proves nothing about you. Anchor at least daily. Serve
`leaves.jsonl` publicly and invite mirroring. Keep `verify_standalone.py`
available for download, and expect the people who most need it to have their
own copy already.

## What a reader gets

With the badge alone: protection against everyone except you. With the offline
verifier and a fingerprint they obtained independently: protection against you
as well, to the extent your anchors are real. That gap is the entire design,
and it is worth stating plainly to readers rather than hiding behind a green
tick.
