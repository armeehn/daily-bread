"""A Daily Bread edition, turned into the statement that gets signed.

Upstream newsproof signs markdown news articles; here the "article" is a whole
built HTML edition (`index.html`, `fr/index.html`, ...) and the signed content is
the exact bytes that Cloudflare serves. Everything else is the same: the
statement carries stable metadata plus the SHA-256 of the served bytes, a
revision names the version it supersedes, and both stay in the log forever.

The field set is exactly upstream's, on purpose. That is what lets the unmodified
verify.js and verify_standalone.py check these proofs.
"""

from __future__ import annotations

from . import canon

CONTENT_TYPE = "text/html; charset=utf-8"


def build_statement(
    issue: dict,
    edition: dict,
    body: bytes,
    version: int,
    supersedes: str | None = None,
    revision_note: str | None = None,
) -> dict:
    """One version of one language edition.

    `issue`   -- id, title, published_at, authors, origin (from site.json)
    `edition` -- code, endo, path, url
    `body`    -- the exact served bytes of that edition's index.html
    """
    return {
        "schema": canon.SCHEMA,
        # article_id namespaces the issue and the language, e.g. dailybread/1/fr
        "article_id": f"{issue['id']}/{edition['code']}",
        "version": version,
        "title": f"{issue['title']} ({edition['endo']})",
        "authors": list(issue["authors"]),
        "canonical_url": issue["origin"].rstrip("/") + edition["url"],
        "published_at": issue["published_at"],
        "content_type": CONTENT_TYPE,
        "content_sha256": canon.content_digest(body),
        "supersedes": supersedes,
        "revision_note": revision_note,
    }
